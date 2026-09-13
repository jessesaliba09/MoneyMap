const express = require('express');
const config = require('./config');

const router = express.Router();

// Lazily create the Stripe client only if a key is actually configured,
// so this whole file is a safe no-op placeholder until real keys exist.
let stripe = null;
if (config.stripeSecretKey) {
  stripe = require('stripe')(config.stripeSecretKey);
} else {
  console.warn('[moneymap-api] STRIPE_SECRET_KEY not set — /api/create-checkout-session will return 503 until it is.');
}

/**
 * POST /api/create-checkout-session
 * body: { plan: 'single'|'dual'|'premium'|'plus', userId: string, email: string }
 *
 * Creates a Stripe Checkout Session and returns its URL. The frontend
 * should redirect the browser to that URL - Stripe hosts the actual
 * payment form, so card details never touch this server or the frontend.
 */
router.post('/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured on this server yet.' });
  }

  const { plan, userId, email } = req.body || {};
  const priceId = config.stripePriceIds[plan];

  if (!priceId) {
    return res.status(400).json({ error: `Unknown or unconfigured plan: "${plan}". Set its Stripe Price ID in this server's environment variables.` });
  }
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId - the frontend should pass the signed-in Supabase user id so the webhook can match the payment back to an account.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      // Carried through to the webhook event so we know which MoneyMap
      // account this payment belongs to - Stripe has no concept of your
      // users, only its own customer/subscription objects.
      client_reference_id: userId,
      metadata: { plan, userId },
      success_url: `${config.frontendUrl}/#/billing?checkout=success`,
      cancel_url: `${config.frontendUrl}/#/checkout?checkout=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[moneymap-api] Stripe checkout session error:', err.message);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

module.exports = router;
