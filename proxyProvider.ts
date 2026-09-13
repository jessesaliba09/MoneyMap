import type { MarketDataProvider, Quote, Range } from './types'
import { ProviderError } from './types'
import type { PricePoint } from '@/types/finance'

/**
 * Calls our own backend (see the separate `moneymap-api` project) instead
 * of Finnhub/CoinGecko directly. This is the provider you actually want in
 * production — it's the only one that never exposes an API key to the
 * browser, since the key lives on the server, not in this bundle.
 *
 * Set VITE_API_BASE_URL in .env.local to your deployed proxy's URL, e.g.
 *   VITE_API_BASE_URL=https://moneymap-api.onrender.com
 */
export class ProxyProvider implements MarketDataProvider {
  id = 'proxy'
  private baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')

  private assertBaseUrl() {
    if (!this.baseUrl) {
      throw new ProviderError(this.id, 'VITE_API_BASE_URL is not set — point it at your deployed moneymap-api instance.')
    }
  }

  private assetType(ticker: string): 'stock' | 'crypto' {
    return CRYPTO_TICKERS.has(ticker.toUpperCase()) ? 'crypto' : 'stock'
  }

  async getQuote(ticker: string): Promise<Quote> {
    this.assertBaseUrl()
    const type = this.assetType(ticker)
    const res = await fetch(`${this.baseUrl}/api/quote?ticker=${encodeURIComponent(ticker)}&type=${type}`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ProviderError(this.id, body.error || `Quote request failed for ${ticker}`)
    }
    return res.json()
  }

  async getQuotes(tickers: string[]): Promise<Quote[]> {
    this.assertBaseUrl()
    // Group by asset type since the batch endpoint expects a single type per call.
    const stocks = tickers.filter((t) => this.assetType(t) === 'stock')
    const cryptos = tickers.filter((t) => this.assetType(t) === 'crypto')

    const calls: Promise<Quote[]>[] = []
    if (stocks.length) calls.push(this.getQuoteBatch(stocks, 'stock'))
    if (cryptos.length) calls.push(this.getQuoteBatch(cryptos, 'crypto'))

    const results = await Promise.all(calls)
    return results.flat()
  }

  private async getQuoteBatch(tickers: string[], type: 'stock' | 'crypto'): Promise<Quote[]> {
    const res = await fetch(`${this.baseUrl}/api/quotes?tickers=${tickers.map(encodeURIComponent).join(',')}&type=${type}`)
    if (!res.ok) throw new ProviderError(this.id, 'Batch quote request failed')
    return res.json()
  }

  async getHistory(ticker: string, range: Range): Promise<PricePoint[]> {
    this.assertBaseUrl()
    const type = this.assetType(ticker)
    const res = await fetch(`${this.baseUrl}/api/history?ticker=${encodeURIComponent(ticker)}&type=${type}&range=${range}`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ProviderError(this.id, body.error || `History request failed for ${ticker}`)
    }
    return res.json()
  }

  async search(query: string): Promise<Array<{ ticker: string; name: string; assetClass: 'stock' | 'etf' | 'crypto' }>> {
    this.assertBaseUrl()
    // Search both stocks and crypto and merge — the "Add Investment" ticker
    // field doesn't know the asset type until the user picks a result.
    const [stockRes, cryptoRes] = await Promise.all([
      fetch(`${this.baseUrl}/api/search?q=${encodeURIComponent(query)}&type=stock`),
      fetch(`${this.baseUrl}/api/search?q=${encodeURIComponent(query)}&type=crypto`),
    ])
    const stocks = stockRes.ok ? await stockRes.json() : []
    const cryptos = cryptoRes.ok ? await cryptoRes.json() : []
    return [...stocks, ...cryptos]
  }
}

const CRYPTO_TICKERS = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'AVAX', 'MATIC', 'LINK', 'LTC', 'UNI', 'ATOM', 'XLM'])
