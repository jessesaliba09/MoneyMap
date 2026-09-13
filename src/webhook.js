const express = require('express');
const config = require('./config');

const router = express.Router();

let stripe = null;
if (config.stripeSecretKey) {
  stripe = require('stripe')(config.stripeSecretKey);
}

let supabaseAdmin = null;
if (config.supabaseUrl && config.supabaseServiceRoleKey) {
  const { createClient } = require('@supabase/supabase-js');
  supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
} else {
  console.warn('[moneymap-api] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — the Stripe webhook will verify events but cannot update subscription status until these are set.');
}

/**
 * POST /api/stripe-webhook
 *
 * Stripe calls this directly (not the frontend) whenever something happens
 * on a subscription - payment succeeded, subscription cancelled, a renewal
 * failed, etc. The signature check below is what proves a request claiming
 * "this user paid" genuinely came from Stripe and not an attacker hitting
 * this URL directly.
 *
 * IMPORTANT: this route must receive the raw, unparsed request body - see
 * the express.raw() wiring for this path in server.js. If Stripe's SDK
 * gets JSON-parsed data instead of the raw bytes, signature verification
 * always fails.
 */
router.post('/stripe-webhook', async (req, res) => {
  if (!stripe) {
    return res.status(503).send('Stripe is not configured on this server yet.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripeWebhookSecret);
  } catch (err) {
    console.error('[moneymap-api] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook signature verification failed.`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await upsertSubscription({
          userId: session.client_reference_id || session.metadata?.userId,
          plan: session.metadata?.plan,
          status: 'active',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
        });
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await upsertSubscription({
          stripeSubscriptionId: sub.id,
          status: sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'cancelled',
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await upsertSubscription({ stripeSubscriptionId: sub.id, status: 'cancelled' });
        break;
      }
      default:
        // Not every event type needs handling - safe to ignore the rest.
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[moneymap-api] Error handling webhook event:', err);
    // Still 200 here once signature verification passed - a 500 makes
    // Stripe retry, which won't fix a bug in this handler and can lead to
    // duplicate processing. Log it and investigate instead.
    res.json({ received: true, warning: 'Event received but not fully processed - check server logs.' });
  }
});

async function upsertSubscription({ userId, plan, status, stripeCustomerId, stripeSubscriptionId }) {
  if (!supabaseAdmin) {
    console.warn('[moneymap-api] Skipping subscription update - Supabase admin client not configured.');
    return;
  }

  const patch = {};
  if (plan) patch.plan = plan;
  if (status) patch.subscription_status = status;
  if (stripeCustomerId) patch.stripe_customer_id = stripeCustomerId;
  if (stripeSubscriptionId) patch.stripe_subscription_id = stripeSubscriptionId;

  const match = userId ? { id: userId } : { stripe_subscription_id: stripeSubscriptionId };
  const { error } = await supabaseAdmin.from('profiles').update(patch).match(match);
  if (error) console.error('[moneymap-api] Failed to update profile from webhook:', error.message);
}

module.exports = router;
