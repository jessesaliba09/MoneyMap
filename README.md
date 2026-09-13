# moneymap-api

A small backend proxy that sits between MoneyMap's frontend and the real market-data providers (Finnhub for stocks/ETFs, CoinMarketCap for crypto). Its entire job is to keep your API keys off the client:

```
Browser  ──►  moneymap-api (this server)  ──►  Finnhub / CoinMarketCap
             (holds the real API keys)
```

Without this, an API key placed in frontend JavaScript is visible to anyone who opens dev tools — proxying through your own server is the standard fix.

## What it does

- **Hides your keys.** `FINNHUB_API_KEY` / `COINMARKETCAP_API_KEY` live only in this server's environment variables. The browser never sees them.
- **Rate-limits per IP** so a scraper or bot can't burn through your upstream quota (and by extension, cost) via your proxy.
- **Caches responses in memory** (30s for quotes, 5min for search/history by default) so repeated requests for the same ticker don't all hit the upstream API.
- **Restricts CORS** to your real frontend origin(s) so other sites can't freeload off your proxy.
- **Validates input** (ticker format, asset type, date range) before anything reaches the upstream provider.

## Endpoints

All responses are JSON.

| Endpoint | Params | Description |
|---|---|---|
| `GET /api/health` | — | Returns `{ ok, finnhubConfigured, coinmarketcapConfigured }` |
| `GET /api/quote` | `ticker`, `type` (`stock`\|`etf`\|`crypto`) | Single quote |
| `GET /api/quotes` | `tickers` (comma-separated), `type` | Batch quotes, up to 25 |
| `GET /api/search` | `q`, `type` | Ticker autocomplete — this is what the "Add Investment" search box calls |
| `GET /api/history` | `ticker`, `type`, `range` (`1D`\|`1W`\|`1M`\|`3M`\|`1Y`\|`ALL`) | Price history for charts |

Every response is shaped the same regardless of provider:

```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "logoUrl": "https://...",
  "price": 231.42,
  "previousClose": 228.90,
  "currency": "USD",
  "sector": "Technology",
  "country": "US",
  "dividendYield": null
}
```

## Local setup

```bash
npm install
cp .env.example .env
# add your real FINNHUB_API_KEY / COINMARKETCAP_API_KEY to .env
npm start
```

Server runs on `http://localhost:8787` by default. Get a free Finnhub key at https://finnhub.io (60 calls/min free tier) and a free CoinMarketCap key at https://pro.coinmarketcap.com (Basic plan, 15,000 calls/month, 50 calls/min) - both require a key even on their free tiers.

**Note on CoinMarketCap's free tier:** it does not include historical price data (the `/api/history` endpoint will return an error for crypto tickers) or commercial-use rights - check CoinMarketCap's current pricing page directly before charging customers, since their tier structure has been known to shift.

## Deploying

Any Node host works. Two easy options:

**Render / Railway (recommended for a first deploy)**
1. Push this folder to a GitHub repo.
2. Create a new Web Service, point it at the repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Add `FINNHUB_API_KEY`, `COINMARKETCAP_API_KEY`, and `ALLOWED_ORIGINS` (your real frontend URL) as environment variables in the host's dashboard.
5. Deploy. You'll get a URL like `https://moneymap-api.onrender.com`.

**Fly.io / a VPS**
Standard Node app — `npm install && npm start`, same environment variables. Put it behind HTTPS (Fly and most PaaS hosts do this for you automatically).

Whichever you choose: **set `ALLOWED_ORIGINS` to your actual frontend domain before going live.** Leaving it unset allows any origin, which is fine for local testing but not for production.

## Wiring it into the frontend

In the React project, this replaces direct calls to Finnhub/CoinMarketCap in `src/services/marketData/`. See `PROXY_INTEGRATION.md` in that project (or the note in this repo's `frontend-integration/` folder) for the exact provider file that calls this API instead of the upstream ones directly.

## Scaling notes

- The cache is in-memory and per-instance. If you run multiple instances behind a load balancer, each will cache independently — fine at small scale, but swap in Redis (Upstash's free tier is easy to bolt on) if you need instances to share a cache.
- Consider moving from an in-memory rate limiter to a shared store (Redis-backed) for the same reason once you're running more than one instance.
