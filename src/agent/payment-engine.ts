import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import { getPlasmaAccount } from '../wallet/wdk-setup.js'
import { TreasuryEngine } from './treasury-engine.js'
import 'dotenv/config'

export interface PaymentReceipt {
  url:         string
  amount_usdt: string
  tx_hash?:    string
  network?:    string
  timestamp:   string
}

export interface ProviderQuote {
  url:    string
  price:  string
  name:   string
  status: 'available' | 'unavailable'
}

export interface NegotiationRecord {
  service:      string
  providers:    ProviderQuote[]
  chosen:       ProviderQuote
  savedVsWorst: string
  timestamp:    string
}

export class PaymentEngine {
  private receipts:      PaymentReceipt[]     = []
  private negotiations:  NegotiationRecord[]  = []
  private fetchWithPayment: ReturnType<typeof wrapFetchWithPayment> | null = null

  // Provider registry: service key → [provider URLs]
  private readonly PROVIDERS: Record<string, Array<{ url: string; name: string }>> = {
    'aave-rates':      [
      { url: 'http://localhost:4021/api/aave-rates',        name: 'Agelo'    },
      { url: 'http://localhost:4021/api/v2/aave-rates',     name: 'DeFi Hub' },
    ],
    'financial-report': [
      { url: 'http://localhost:4021/api/financial-report',  name: 'Agelo'    },
      { url: 'http://localhost:4021/api/v2/financial-report', name: 'DeFi Hub' },
    ],
    'crypto-price': [
      { url: 'http://localhost:4021/api/crypto-price',      name: 'Agelo'    },
      { url: 'http://localhost:4021/api/v2/crypto-price',   name: 'DeFi Hub' },
    ],
  }

  // Known prices per URL (matches paymentMiddleware config)
  private readonly PRICE_TABLE: Record<string, string> = {
    'http://localhost:4021/api/aave-rates':       '0.003000',
    'http://localhost:4021/api/v2/aave-rates':    '0.004500',
    'http://localhost:4021/api/financial-report': '0.010000',
    'http://localhost:4021/api/v2/financial-report': '0.015000',
    'http://localhost:4021/api/crypto-price':     '0.001000',
    'http://localhost:4021/api/v2/crypto-price':  '0.001500',
  }

  constructor(
    private treasury: TreasuryEngine,
    private options: { negotiate: boolean } = { negotiate: true }
  ) {}

  private async getFetchWithPayment() {
    if (this.fetchWithPayment) return this.fetchWithPayment
    const account = await getPlasmaAccount()
    const client  = new x402Client()
    registerExactEvmScheme(client, { signer: account as any })
    this.fetchWithPayment = wrapFetchWithPayment(fetch, client)
    return this.fetchWithPayment
  }

  async paidFetch<T = unknown>(
    url: string,
    options: RequestInit = {}
  ): Promise<{ data: T; receipt: PaymentReceipt }> {
    const fetchFn = await this.getFetchWithPayment()
    console.log(`\n  💳 x402: ${url.replace('http://localhost:4021', '')}`)

    const res = await fetchFn(url, options)

    // Decode payment-response header (base64 JSON)
    let tx_hash:    string | undefined
    let network:    string | undefined
    let amount_usdt = '0.000000'

    const payHeader = res.headers.get('payment-response') || res.headers.get('X-PAYMENT-RESPONSE')
    if (payHeader) {
      try {
        const decoded = JSON.parse(Buffer.from(payHeader, 'base64').toString())
        tx_hash    = decoded.transaction
        network    = decoded.network
        // Amount comes from the paymentMiddleware config — read from the 402 response
        // We'll look it up from our known price table
        amount_usdt = this.estimateAmount(url)
      } catch {
        // fallback
      }
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)

    const data = await res.json() as T

    const receipt: PaymentReceipt = {
      url, amount_usdt, tx_hash, network,
      timestamp: new Date().toISOString(),
    }
    this.receipts.push(receipt)

    console.log(`  ✅ Paid ${amount_usdt} USDT0${tx_hash ? ` | tx: ${tx_hash.slice(0,18)}...` : ''}`)
    if (tx_hash) console.log(`     https://plasmascan.to/tx/${tx_hash}`)

    return { data, receipt }
  }

  // Precio estimado por endpoint (en sync con marketplace.ts)
  private estimateAmount(url: string): string {
    // Check price table first (handles both v1 and v2)
    for (const [key, price] of Object.entries(this.PRICE_TABLE)) {
      if (url.startsWith(key)) return price
    }
    // Fallback for non-negotiated endpoints
    if (url.includes('/api/news-summary'))     return '0.005000'
    if (url.includes('/api/market-analysis'))  return '0.010000'
    if (url.includes('/api/onchain-metrics'))  return '0.010000'
    if (url.includes('/api/aave-position'))    return '0.005000'
    if (url.includes('/api/defi-strategy'))    return '0.020000'
    if (url.includes('/api/ai-inference'))     return '0.050000'
    return '0.001000'
  }

  // Probe a URL's price by reading the 402 response without paying
  async probePrice(url: string): Promise<string | null> {
    try {
      // Check price table first (avoids network call)
      for (const [key, price] of Object.entries(this.PRICE_TABLE)) {
        if (url.startsWith(key)) return price
      }
      return null
    } catch {
      return null
    }
  }

  // Negotiate: find cheapest provider for a service
  async negotiate(serviceKey: string, urlSuffix = ''): Promise<NegotiationRecord> {
    const providerDefs = this.PROVIDERS[serviceKey]
    if (!providerDefs) throw new Error(`Unknown service: ${serviceKey}`)

    const quotes: ProviderQuote[] = []

    for (const { url: baseUrl, name } of providerDefs) {
      const url   = urlSuffix ? `${baseUrl}/${urlSuffix}` : baseUrl
      const price = await this.probePrice(url)
      quotes.push({
        url, name, price: price ?? '0',
        status: price !== null ? 'available' : 'unavailable',
      })
    }

    const available = quotes.filter(q => q.status === 'available')
    if (!available.length) throw new Error(`No providers available for: ${serviceKey}`)

    // Sort by price ascending, pick cheapest
    available.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
    const chosen     = available[0]
    const worstPrice = available[available.length - 1].price
    const saved      = (parseFloat(worstPrice) - parseFloat(chosen.price)).toFixed(6)

    console.log(`  🔍 Negotiated ${serviceKey}: ${available.map(q => `${q.name} $${q.price}`).join(' vs ')} → chose ${chosen.name} $${chosen.price} (saved $${saved})`)

    const record: NegotiationRecord = {
      service:      serviceKey,
      providers:    quotes,
      chosen,
      savedVsWorst: saved,
      timestamp:    new Date().toISOString(),
    }

    this.negotiations.push(record)
    return record
  }

  // Negotiate then pay in one step — returns data, receipt, AND negotiation record
  async negotiatedFetch<T = unknown>(
    serviceKey: string,
    urlSuffix  = '',
    options:     RequestInit = {}
  ): Promise<{ data: T; receipt: PaymentReceipt; negotiation: NegotiationRecord }> {
    const negotiation = await this.negotiate(serviceKey, urlSuffix)
    const { data, receipt } = await this.paidFetch<T>(negotiation.chosen.url, options)
    return { data, receipt, negotiation }
  }

  // Smart fetch: negotiates if enabled, otherwise pays directly
  async smartFetch<T = unknown>(
    serviceKey: string,
    directUrl:  string,
    opts:        RequestInit = {}
  ): Promise<{ data: T; receipt: PaymentReceipt }> {
    if (this.options.negotiate) {
      const { data, receipt } = await this.negotiatedFetch<T>(serviceKey, '', opts)
      return { data, receipt }
    }
    return this.paidFetch<T>(directUrl, opts)
  }

  getNegotiations()  { return [...this.negotiations] }
  getTotalSaved()    {
    return this.negotiations.reduce((acc, n) => acc + parseFloat(n.savedVsWorst), 0).toFixed(6)
  }

  getReceipts()   { return [...this.receipts] }
  getTotalSpent() {
    return this.receipts.reduce((acc, r) => acc + Number(r.amount_usdt), 0).toFixed(6)
  }
}
