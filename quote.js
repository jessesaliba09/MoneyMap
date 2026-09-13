const express = require('express');
const finnhub = require('./finnhub');
const coinmarketcap = require('./coinmarketcap');
const cache = require('./cache');
const config = require('./config');
const { isValidTicker, isValidType } = require('./validate');

const router = express.Router();

function providerFor(type) {
  return type === 'crypto' ? coinmarketcap : finnhub;
}

// GET /api/quote?ticker=AAPL&type=stock
router.get('/quote', async (req, res) => {
  const { ticker, type = 'stock' } = req.query;

  if (!isValidTicker(ticker)) {
    return res.status(400).json({ error: 'Missing or invalid "ticker" query param.' });
  }
  if (!isValidType(type)) {
    return res.status(400).json({ error: 'Invalid "type" — expected stock, etf, or crypto.' });
  }

  try {
    const provider = providerFor(type);
    const key = `quote:${type}:${ticker.toUpperCase()}`;
    const quote = await cache.wrap(key, config.cacheTtlQuoteMs, () => provider.getQuote(ticker));
    res.json(quote);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || 'Failed to fetch quote.' });
  }
});

// GET /api/quotes?tickers=AAPL,MSFT,NVDA&type=stock  (batch, same asset type)
router.get('/quotes', async (req, res) => {
  const { tickers, type = 'stock' } = req.query;
  if (!tickers || typeof tickers !== 'string') {
    return res.status(400).json({ error: 'Missing "tickers" query param (comma-separated).' });
  }
  if (!isValidType(type)) {
    return res.status(400).json({ error: 'Invalid "type" — expected stock, etf, or crypto.' });
  }

  const list = tickers.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 25); // cap batch size
  if (!list.every(isValidTicker)) {
    return res.status(400).json({ error: 'One or more tickers are invalid.' });
  }

  const provider = providerFor(type);
  const results = await Promise.allSettled(
    list.map((ticker) => {
      const key = `quote:${type}:${ticker.toUpperCase()}`;
      return cache.wrap(key, config.cacheTtlQuoteMs, () => provider.getQuote(ticker));
    })
  );

  res.json(
    results.map((r, i) => (r.status === 'fulfilled' ? r.value : { ticker: list[i].toUpperCase(), error: r.reason?.message || 'Failed' }))
  );
});

module.exports = router;
