const rateLimit = require('express-rate-limit');
const config = require('./config');

/**
 * Per-IP rate limit. This is the main thing standing between your API key
 * and someone finding this proxy and hammering it. Tune rateLimitMax to
 * comfortably cover real usage (dashboard polling, search-as-you-type)
 * while staying well under your upstream provider's own rate limit.
 */
module.exports = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});
