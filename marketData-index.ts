import type { MarketDataProvider } from './types'
import { MockMarketDataProvider } from './mockProvider'
import { ProxyProvider } from './proxyProvider'

// Only import these directly if you're prototyping locally without the
// proxy running yet. They call Finnhub/CoinGecko straight from the
// browser, which means your API key ships in the client bundle — fine to
// poke at on localhost, not something to ship to production.
// import { FinnhubProvider } from './finnhubProvider'
// import { CoinGeckoProvider } from './coinGeckoProvider'

/**
 * ---------------------------------------------------------------------
 * THIS IS THE ONE FILE YOU EDIT TO GO LIVE.
 * ---------------------------------------------------------------------
 * Every page/component calls `getMarketData()` and only ever sees the
 * `MarketDataProvider` interface, so switching providers never requires
 * touching a component.
 *
 * Recommended path — the backend proxy (see the separate `moneymap-api`
 * project, or `/moneymap-api` alongside this repo):
 *   1. Deploy moneymap-api with your real FINNHUB_API_KEY / COINGECKO_API_KEY
 *   2. Set VITE_API_BASE_URL in .env.local to that deployment's URL
 *   3. That's it — ProxyProvider below picks it up automatically and the
 *      app switches from mock data to live data with no other changes.
 *
 * Until VITE_API_BASE_URL is set, this falls back to mock data so the app
 * keeps working out of the box.
 */
const hasProxyConfigured = Boolean(import.meta.env.VITE_API_BASE_URL)

const equityProvider: MarketDataProvider = hasProxyConfigured ? new ProxyProvider() : new MockMarketDataProvider()
const cryptoProvider: MarketDataProvider = hasProxyConfigured ? new ProxyProvider() : new MockMarketDataProvider()

const CRYPTO_TICKERS = new Set(['BTC', 'ETH', 'SOL', 'ADA', 'DOGE', 'XRP', 'DOT', 'AVAX'])

export function resolveProvider(ticker: string): MarketDataProvider {
  return CRYPTO_TICKERS.has(ticker.toUpperCase()) ? cryptoProvider : equityProvider
}

export function getMarketData(): MarketDataProvider {
  // Kept as a single indirection point in case a unified provider
  // (routing internally by asset class) replaces the two above.
  return equityProvider
}

export type { MarketDataProvider, Quote, Range } from './types'
