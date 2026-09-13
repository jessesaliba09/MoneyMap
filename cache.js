/**
 * Minimal in-memory cache with per-entry TTL. Good enough for a single
 * server instance. If you scale to multiple instances/regions, swap this
 * for Redis (Upstash's free tier works well on Vercel/Render/Fly) so all
 * instances share one cache instead of each hammering the upstream API.
 */
class TtlCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Wraps an async fetcher: returns the cached value if fresh, otherwise
   * calls fetcher(), caches the result, and returns it. */
  async wrap(key, ttlMs, fetcher) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await fetcher();
    this.set(key, value, ttlMs);
    return value;
  }
}

module.exports = new TtlCache();
