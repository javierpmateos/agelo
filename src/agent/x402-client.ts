import 'dotenv/config'
import type { AgentWallet } from '../wallet/agent-wallet.js'

export interface PaymentReceipt {
  url: string
  amount_usdt: string
  tx_hash?: string
  timestamp: string
}

export interface PaidFetchResult<T> {
  data: T
  receipt: PaymentReceipt | null
}

const MOCK_MODE = process.env.MOCK_PAYMENTS === 'true'

export function createX402Client(wallet: AgentWallet) {
  const receipts: PaymentReceipt[] = []

  async function paidFetch<T = unknown>(
    url: string,
    options: RequestInit = {}
  ): Promise<PaidFetchResult<T>> {

    if (MOCK_MODE) {
      // Mock mode: call endpoint directly, simulate payment receipt
      const res = await fetch(url.replace('/api/', '/mock/'), options)
      const data = (await res.json()) as T
      const receipt: PaymentReceipt = {
        url,
        amount_usdt: '0.000001',
        tx_hash: '0xMOCK_' + Math.random().toString(16).slice(2, 12),
        timestamp: new Date().toISOString(),
      }
      receipts.push(receipt)
      return { data, receipt }
    }

    // Real x402 payment flow
    const { wrapFetchWithPayment, x402Client } = await import('@x402/fetch')
    const { registerExactEvmScheme } = await import('@x402/evm/exact/client')

    const client = new x402Client()
    registerExactEvmScheme(client, { signer: wallet.account as any })
    const fetchWithPayment = wrapFetchWithPayment(fetch, client)

    const res = await fetchWithPayment(url, options)

    let receipt: PaymentReceipt | null = null
    const paymentHeader = res.headers.get('X-PAYMENT-RESPONSE')
    if (paymentHeader) {
      try {
        const parsed = JSON.parse(paymentHeader)
        receipt = {
          url,
          amount_usdt: parsed.amount
            ? (Number(parsed.amount) / 1_000_000).toFixed(6)
            : '0.000001',
          tx_hash: parsed.transaction,
          timestamp: new Date().toISOString(),
        }
      } catch {
        receipt = { url, amount_usdt: '0.000001', timestamp: new Date().toISOString() }
      }
      receipts.push(receipt!)
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HTTP ${res.status} from ${url}: ${body}`)
    }

    const data = (await res.json()) as T
    return { data, receipt }
  }

  function getReceipts() { return [...receipts] }
  function getTotalSpent(): string {
    return receipts.reduce((acc, r) => acc + Number(r.amount_usdt), 0).toFixed(6)
  }

  return { paidFetch, getReceipts, getTotalSpent }
}
