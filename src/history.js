const express = require('express');
const finnhub = require('./finnhub');
const coinmarketcap = require('./coinmarketcap');
const cache = require('./cache');
const config = require('./config');
const { isValidTicker, isValidType, isValidRange } = require('./validate');

const router = express.Router();

// GET /api/history?ticker=AAPL&type=stock&range=1M
router.get('/history', async (req, res) => {
  const { ticker, type = 'stock', range = '1M' } = req.query;

  if (!isValidTicker(ticker)) {
    return res.status(400).json({ error: 'Missing or invalid "ticker" query param.' });
  }
  if (!isValidType(type)) {
    return res.status(400).json({ error: 'Invalid "type" — expected stock, etf, or crypto.' });
  }
  if (!isValidRange(range)) {
    return res.status(400).json({ error: 'Invalid "range" — expected 1D, 1W, 1M, 3M, 1Y, or ALL.' });
  }

  try {
    const provider = type === 'crypto' ? coinmarketcap : finnhub;
    const key = `history:${type}:${ticker.toUpperCase()}:${range}`;
    const points = await cache.wrap(key, config.cacheTtlHistoryMs, () => provider.getHistory(ticker, range));
    res.json(points);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || 'Failed to fetch history.' });
  }
});

module.exports = router;
