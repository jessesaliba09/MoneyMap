const fetch = require('node-fetch');
const config = require('./config');
const cache = require('./cache');
const { UpstreamError } = require('./errors');

const BASE_URL = 'https://pro-api.coinmarketcap.com';

function headers() {
  return { 'X-CMC_PRO_API_KEY': config.coinmarketcapApiKey, Accept: 'application/json' };
}

async function getQuote(ticker) {
  const symbol = ticker.toUpperCase();
  const res = await fetch(`${BASE_URL}/v1/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbol)}&convert=USD`, {
    headers: headers(),
  });
  if (!res.ok) throw new UpstreamError(`CoinMarketCap quote request failed for ${ticker}`, res.status);
  const body = await res.json();
  const coin = body.data && body.data[symbol];
  if (!coin) throw new UpstreamError(`No market data for "${ticker}".`, 404);

  const usd = coin.quote.USD;
  // CMC's free tier returns the 24h % change rather than the raw previous
  // price directly, so the previous price is derived from it - this
  // matches what the previousClose field is used for elsewhere (day-change
  // calculations), just computed instead of given outright.
  const previousClose = usd.percent_change_24h != null ? usd.price / (1 + usd.percent_change_24h / 100) : usd.price;

  return {
    ticker: symbol,
    name: coin.name,
    logoUrl: null, // CMC's quotes endpoint doesn't include logos on the free tier; would need a separate /v2/cryptocurrency/info call per coin, which isn't worth the extra rate-limit cost here
    price: usd.price,
    previousClose,
    currency: 'USD',
    sector: 'Crypto',
    country: 'Global',
    dividendYield: 0,
  };
}

async function getHistory() {
  // CoinMarketCap's free Basic tier does not include historical data
  // endpoints at all (confirmed on their pricing page) - this would need
  // a paid plan (Hobbyist/Startup or above) to work. Failing clearly here
  // beats a silent empty chart with no explanation.
  throw new UpstreamError('Historical price charts require a paid CoinMarketCap plan - the free tier does not include historical data.', 402);
}

/**
 * CoinMarketCap has no free-text "search by name" endpoint the way
 * CoinGecko does - instead it exposes a full id/name/symbol directory via
 * /v1/cryptocurrency/map. That list is large (10,000+ coins) but changes
 * rarely, so it's fetched once and cached for a day, then searched
 * in-memory here - much cheaper against the rate limit than trying to hit
 * the API on every keystroke.
 */
async function getCoinMap() {
  return cache.wrap('cmc-coin-map', 24 * 60 * 60 * 1000, async () => {
    const res = await fetch(`${BASE_URL}/v1/cryptocurrency/map?listing_status=active&limit=5000`, { headers: headers() });
    if (!res.ok) throw new UpstreamError('CoinMarketCap coin map request failed', res.status);
    const body = await res.json();
    return body.data || [];
  });
}

async function search(query) {
  const map = await getCoinMap();
  const q = query.toLowerCase();
  const matches = map
    .filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q))
    // CMC's map is roughly rank-ordered already, but sort explicitly so a
    // query like "bit" surfaces Bitcoin before an obscure coin containing
    // the same substring in its name.
    .sort((a, b) => (a.rank || 999999) - (b.rank || 999999))
    .slice(0, 10)
    .map((c) => ({ ticker: c.symbol.toUpperCase(), name: c.name, assetClass: 'crypto' }));
  return matches;
}

module.exports = { getQuote, getHistory, search };
