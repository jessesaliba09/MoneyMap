const express = require('express');
const finnhub = require('./finnhub');
const coinmarketcap = require('./coinmarketcap');
const cache = require('./cache');
const config = require('./config');
const { isValidType } = require('./validate');

const router = express.Router();

// GET /api/search?q=AAP&type=stock
// This is what the "Add Investment" ticker field calls as the user types.
router.get('/search', async (req, res) => {
  const { q, type = 'stock' } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length < 1) {
    return res.json([]); // empty query -> empty results, not an error
  }
  if (q.length > 40) {
    return res.status(400).json({ error: 'Query too long.' });
  }
  if (!isValidType(type)) {
    return res.status(400).json({ error: 'Invalid "type" — expected stock, etf, or crypto.' });
  }

  try {
    const provider = type === 'crypto' ? coinmarketcap : finnhub;
    const key = `search:${type}:${q.trim().toLowerCase()}`;
    const results = await cache.wrap(key, config.cacheTtlSearchMs, () => provider.search(q.trim()));
    res.json(results);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || 'Search failed.' });
  }
});

module.exports = router;
