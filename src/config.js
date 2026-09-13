require('dotenv').config();

function parseList(value) {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

const config = {
  port: process.env.PORT || 8787,

  // --- Upstream API keys. These live ONLY on the server. Never send them
  // to a browser, never log them, never put them in a client bundle. ---
  finnhubApiKey: process.env.FINNHUB_API_KEY || '',
  // --- CoinMarketCap (crypto prices). Free Basic plan: sign up at
  // pro.coinmarketcap.com, key appears on your dashboard immediately. ---
  coinmarketcapApiKey: process.env.COINMARKETCAP_API_KEY || '',

  // --- Who is allowed to call this proxy at all. Set this to your real
  // frontend origin(s) in production, e.g. https://app.moneymap.com.
  // Comma-separate multiple origins. Leave empty only for local dev. ---
  allowedOrigins: parseList(process.env.ALLOWED_ORIGINS),

  // --- Basic abuse protection. Tune to your actual traffic + upstream
  // rate limits (Finnhub free tier is 60 calls/min, for example). ---
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 60),

  // --- How long to cache upstream responses in memory, per endpoint.
  // Bigger cache = fewer upstream calls = keys/quota last longer. ---
  cacheTtlQuoteMs: Number(process.env.CACHE_TTL_QUOTE_MS || 30_000),
  cacheTtlSearchMs: Number(process.env.CACHE_TTL_SEARCH_MS || 5 * 60_000),
  cacheTtlHistoryMs: Number(process.env.CACHE_TTL_HISTORY_MS || 5 * 60_000),

  // --- Stripe (subscriptions). The secret key can create charges on your
  // behalf, so it must never leave this server. The webhook secret is used
  // to verify that a webhook request genuinely came from Stripe and not
  // an attacker pretending a payment succeeded. Both come from your Stripe
  // Dashboard (Developers -> API keys / Developers -> Webhooks). ---
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePriceIds: {
    single: process.env.STRIPE_PRICE_SINGLE || '',
    dual: process.env.STRIPE_PRICE_DUAL || '',
    premium: process.env.STRIPE_PRICE_PREMIUM || '',
    plus: process.env.STRIPE_PRICE_PLUS || '',
  },
  // Where Stripe should send the browser back to after checkout.
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // --- Supabase. This uses the SERVICE ROLE key, not the public anon key -
  // the webhook handler needs to write to the profiles table on behalf of
  // whichever user just paid, which requires bypassing Row Level Security.
  // This key must never be sent to a browser or committed to git. ---
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

module.exports = config;
