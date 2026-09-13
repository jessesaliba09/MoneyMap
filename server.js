const express = require('express');
const cors = require('cors');
const config = require('./config');
const rateLimiter = require('./rateLimiter');
const quoteRoutes = require('./quote');
const searchRoutes = require('./search');
const historyRoutes = require('./history');
const checkoutRoutes = require('./checkout');
const webhookRoutes = require('./webhook');

const app = express();

// --- CORS: only your real frontend(s) should be able to call this proxy.
// Without this, anyone who finds the URL could use it (and your API quota)
// from their own site. Set ALLOWED_ORIGINS in production.
if (config.allowedOrigins.length === 0) {
  console.warn(
    '[moneymap-api] ALLOWED_ORIGINS is not set — allowing all origins. ' +
      'This is fine for local development but must be locked down before you deploy this publicly.'
  );
}
app.use(
  cors({
    origin: config.allowedOrigins.length === 0 ? true : config.allowedOrigins,
  })
);

// IMPORTANT: the Stripe webhook route needs the raw, unparsed request body
// to verify the signature Stripe attaches to each request. It's not enough
// to just add express.raw() for that path - express.json() below would
// still try to read the (already-consumed) request stream for that same
// path and either see an empty body or throw. So the global JSON parser
// explicitly skips this one path, letting express.raw() (below) be the
// only thing that ever touches its body.
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe-webhook') return next();
  express.json()(req, res, next);
});
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));

app.use(rateLimiter);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    finnhubConfigured: Boolean(config.finnhubApiKey),
    coinmarketcapConfigured: Boolean(config.coinmarketcapApiKey),
    stripeConfigured: Boolean(config.stripeSecretKey),
    supabaseConfigured: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
  });
});

app.use('/api', quoteRoutes);
app.use('/api', searchRoutes);
app.use('/api', historyRoutes);
app.use('/api', checkoutRoutes);
app.use('/api', webhookRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Centralized error handler as a safety net — never leak stack traces or
// upstream error bodies (which could contain the API key in the URL) to
// the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[moneymap-api] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`[moneymap-api] listening on port ${config.port}`);
  });
}

module.exports = app;
