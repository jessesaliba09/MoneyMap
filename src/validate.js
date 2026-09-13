const TICKER_RE = /^[A-Za-z0-9.\-]{1,15}$/;
const VALID_RANGES = new Set(['1D', '1W', '1M', '3M', '1Y', 'ALL']);
const VALID_TYPES = new Set(['stock', 'etf', 'crypto']);

function isValidTicker(ticker) {
  return typeof ticker === 'string' && TICKER_RE.test(ticker);
}

function isValidRange(range) {
  return VALID_RANGES.has(range);
}

function isValidType(type) {
  return VALID_TYPES.has(type);
}

module.exports = { isValidTicker, isValidRange, isValidType, VALID_RANGES, VALID_TYPES };
