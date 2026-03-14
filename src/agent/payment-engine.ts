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

export class PaymentEngine {
  private receipts: PaymentReceipt[] = []
  private fetchWithPayment: ReturnType<typeof wrapFetchWithPayment> | null = null

  constructor(private treasury: TreasuryEngine) {}

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
    if (url.includes('/api/crypto-price'))    return '0.001000'
    if (url.includes('/api/news-summary'))     return '0.005000'
    if (url.includes('/api/market-analysis'))  return '0.010000'
    if (url.includes('/api/onchain-metrics'))  return '0.010000'
    if (url.includes('/api/aave-rates'))       return '0.003000'
    if (url.includes('/api/aave-position'))    return '0.005000'
    if (url.includes('/api/financial-report')) return '0.010000'
    if (url.includes('/api/defi-strategy'))    return '0.020000'
    if (url.includes('/api/ai-inference'))     return '0.050000'
    return '0.001000'
  }

  getReceipts()   { return [...this.receipts] }
  getTotalSpent() {
    return this.receipts.reduce((acc, r) => acc + Number(r.amount_usdt), 0).toFixed(6)
  }
}
