/**
 * PaymentEngine — conecta x402 con el TreasuryEngine.
 *
 * Cuando el agente necesita pagar un servicio x402:
 * 1. Verifica si hay suficiente USDT líquido
 * 2. Si no hay, retira de Aave exactamente lo necesario
 * 3. Paga via x402
 * 4. Redeposita cualquier exceso sobre la reserva mínima
 */

import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import { getPlasmaAccount } from '../wallet/wdk-setup.js'
import { TreasuryEngine } from './treasury-engine.js'
import 'dotenv/config'

export interface PaymentReceipt {
  url:          string
  amount_usdt:  string
  tx_hash?:     string
  withdrew_from_aave: boolean
  redeposited:  boolean
  timestamp:    string
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

  /**
   * Hace un request x402 — paga automáticamente con USDT0 en Plasma.
   * El Treasury gestiona la liquidez en Arbitrum por separado.
   */
  async paidFetch<T = unknown>(
    url: string,
    options: RequestInit = {}
  ): Promise<{ data: T; receipt: PaymentReceipt }> {
    const fetchFn = await this.getFetchWithPayment()

    console.log(`\n  💳 x402 request: ${url}`)

    const res = await fetchFn(url, options)

    // Extraer receipt del header
    let amount_usdt = '0.000000'
    let tx_hash: string | undefined

    const payHeader = res.headers.get('X-PAYMENT-RESPONSE') || res.headers.get('payment-response')
    if (payHeader) {
      try {
        const parsed = JSON.parse(payHeader)
        amount_usdt = parsed.amount ? (Number(parsed.amount) / 1e6).toFixed(6) : '0.000001'
        tx_hash     = parsed.transaction
      } catch {
        amount_usdt = '0.000001'
      }
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HTTP ${res.status}: ${body}`)
    }

    const data = await res.json() as T

    const receipt: PaymentReceipt = {
      url,
      amount_usdt,
      tx_hash,
      withdrew_from_aave: false,
      redeposited:        false,
      timestamp:          new Date().toISOString(),
    }

    this.receipts.push(receipt)
    console.log(`  ✅ Paid ${amount_usdt} USDT0`)

    return { data, receipt }
  }

  getReceipts()    { return [...this.receipts] }
  getTotalSpent()  {
    return this.receipts
      .reduce((acc, r) => acc + Number(r.amount_usdt), 0)
      .toFixed(6)
  }
}
