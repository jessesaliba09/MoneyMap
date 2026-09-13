const fetch = require('node-fetch');
const config = require('./config');
const { UpstreamError } = require('./errors');

const BASE_URL = 'https://finnhub.io/api/v1';

function assertKey() {
  if (!config.finnhubApiKey) {
    throw new UpstreamError('Finnhub API key is not configured on the server.', 501);
  }
}

async function getQuote(ticker) {
  assertKey();
  const [quoteRes, profileRes] = await Promise.all([
    fetch(`${BASE_URL}/quote?symbol=${encodeURIComponent(ticker)}&token=${config.finnhubApiKey}`),
    fetch(`${BASE_URL}/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${config.finnhubApiKey}`),
  ]);
  if (!quoteRes.ok) throw new UpstreamError(`Finnhub quote request failed for ${ticker}`, quoteRes.status);
  const quote = await quoteRes.json();
  const profile = profileRes.ok ? await profileRes.json() : {};

  if (quote.c === 0 && quote.pc === 0) {
    throw new UpstreamError(`No data returned for ticker "${ticker}".`, 404);
  }

  return {
    ticker: ticker.toUpperCase(),
    name: profile.name || ticker.toUpperCase(),
    logoUrl: profile.logo || null,
    price: quote.c,
    previousClose: quote.pc,
    currency: profile.currency || 'USD',
    sector: profile.finnhubIndustry || null,
    country: profile.country || null,
    dividendYield: null, // Finnhub's free tier doesn't include this on profile2; see metric endpoint if you upgrade.
  };
}

const RESOLUTION_BY_RANGE = { '1D': '5', '1W': '15', '1M': 'D', '3M': 'D', '1Y': 'W', ALL: 'M' };
const SPAN_SECONDS_BY_RANGE = {
  '1D': 86400,
  '1W': 7 * 86400,
  '1M': 30 * 86400,
  '3M': 90 * 86400,
  '1Y': 365 * 86400,
  ALL: 5 * 365 * 86400,
};

async function getHistory(ticker, range) {
  assertKey();
  const resolution = RESOLUTION_BY_RANGE[range] || 'D';
  const span = SPAN_SECONDS_BY_RANGE[range] || SPAN_SECONDS_BY_RANGE['1M'];
  const now = Math.floor(Date.now() / 1000);
  const from = now - span;

  const res = await fetch(
    `${BASE_URL}/stock/candle?symbol=${encodeURIComponent(ticker)}&resolution=${resolution}&from=${from}&to=${now}&token=${config.finnhubApiKey}`
  );
  if (!res.ok) throw new UpstreamError(`Finnhub history request failed for ${ticker}`, res.status);
  const data = await res.json();
  if (data.s !== 'ok' || !Array.isArray(data.t)) return [];

  return data.t.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    value: data.c[i],
  }));
}

async function search(query) {
  assertKey();
  const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}&token=${config.finnhubApiKey}`);
  if (!res.ok) throw new UpstreamError('Finnhub search request failed', res.status);
  const data = await res.json();
  return (data.result || []).slice(0, 10).map((r) => ({
    ticker: r.symbol,
    name: r.description,
    assetClass: 'stock',
  }));
}

module.exports = { getQuote, getHistory, search };
