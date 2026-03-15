/**
 * TreasuryEngine — el corazón de Agelo.
 * 
 * Loop autónomo que:
 * 1. Monitorea USDT idle en la wallet de Arbitrum
 * 2. Deposita en Aave V3 cuando hay idle por encima de la reserva mínima
 * 3. Retira de Aave cuando necesita fondos para un pago x402
 * 4. Registra cada decisión con razonamiento del LLM
 */

import Anthropic from '@anthropic-ai/sdk'
import { getArbAccount } from '../wallet/wdk-setup.js'
import { supplyToAave, withdrawFromAave, getAavePosition, getAaveApys } from '../services/lending.js'
import 'dotenv/config'

const USDT_ARB = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
const USDT_DECIMALS = 6

// Configuración del Treasury
export interface TreasuryConfig {
  minLiquidReserve: bigint  // USDT mínimo a mantener líquido (en base units)
  minDepositAmount: bigint  // mínimo para que valga la pena depositar
  minApy: number            // APY mínimo aceptable (porcentaje, ej: 2.0)
  cycleInterval: number     // ms entre ciclos (default: 30 min)
}

export const DEFAULT_CONFIG: TreasuryConfig = {
  minLiquidReserve: 2_000_000n,   // 2 USDT siempre líquido
  minDepositAmount: 1_000_000n,   // depositar solo si hay >1 USDT idle
  minApy: 2.0,
  cycleInterval: 30 * 60 * 1000, // 30 minutos
}

export interface TreasuryDecision {
  timestamp: string
  action: 'supply' | 'withdraw' | 'hold'
  amount?: string
  reason: string
  txHash?: string
  liquidBalance: string
  aaveBalance: string
  apy?: string
}

export class TreasuryEngine {
  private running = false
  private decisions: TreasuryDecision[] = []
  private anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  constructor(private config: TreasuryConfig = DEFAULT_CONFIG) {}

  /**
   * Obtiene el estado actual del treasury
   */
  async getState() {
    const account = await getArbAccount()
    const [liquidRaw, position, apys] = await Promise.all([
      account.getTokenBalance(USDT_ARB),
      getAavePosition(),
      getAaveApys(),
    ])

    const liquidUsdt = BigInt(liquidRaw ?? 0n)

    return {
      liquidUsdt,
      liquidHuman:  (Number(liquidUsdt) / 10 ** USDT_DECIMALS).toFixed(2),
      aaveHuman:    position?.totalCollateral ?? '0.00',
      healthFactor: position?.healthFactor ?? 'N/A',
      apys,
      position,
    }
  }

  /**
   * Un ciclo del treasury: evalúa y actúa
   */
  async cycle(): Promise<TreasuryDecision> {
    console.log(`\n⚙️  Treasury cycle — ${new Date().toISOString()}`)
    const state = await this.getState()

    console.log(`   Liquid: ${state.liquidHuman} USDT`)
    console.log(`   Aave:   ${state.aaveHuman} USDT`)
    console.log(`   APY:    ${state.apys.USDT?.supplyApy ?? 'N/A'}`)

    // LLM decide la acción
    const decision = await this.decide(state)
    console.log(`   Decision: ${decision.action.toUpperCase()} — ${decision.reason}`)

    // Ejecuta si es supply o withdraw
    if (decision.action === 'supply' && decision.amount) {
      try {
        const amount = BigInt(decision.amount)
        const result = await supplyToAave('USDT', amount)
        decision.txHash = result.hash
        console.log(`   ✅ Supplied ${Number(amount)/1e6} USDT → tx: ${result.hash}`)
      } catch (err: any) {
        console.error(`   ❌ Supply failed: ${err.message}`)
        decision.action = 'hold'
        decision.reason += ` (supply failed: ${err.message})`
      }
    }

    if (decision.action === 'withdraw' && decision.amount) {
      try {
        const amount = BigInt(decision.amount)
        const result = await withdrawFromAave('USDT', amount)
        decision.txHash = result.hash
        console.log(`   ✅ Withdrew ${Number(amount)/1e6} USDT → tx: ${result.hash}`)
      } catch (err: any) {
        console.error(`   ❌ Withdraw failed: ${err.message}`)
        decision.action = 'hold'
        decision.reason += ` (withdraw failed: ${err.message})`
      }
    }

    this.decisions.push(decision)
    return decision
  }

  /**
   * LLM decide qué hacer basado en el estado actual
   */
  private async decide(state: Awaited<ReturnType<typeof this.getState>>): Promise<TreasuryDecision> {
    const usdtApy = parseFloat(state.apys.USDT?.supplyApy ?? '0')
    const liquidUsdt = state.liquidUsdt
    const idleAboveReserve = liquidUsdt - this.config.minLiquidReserve

    const prompt = `You are Agelo's treasury manager. Make a decision based on this state:

Liquid USDT: ${state.liquidHuman} USDT
Aave USDT deposit: ${state.aaveHuman} USDT  
Current Aave APY: ${state.apys.USDT?.supplyApy ?? 'unknown'}
Min liquid reserve: ${Number(this.config.minLiquidReserve)/1e6} USDT
Min APY threshold: ${this.config.minApy}%
Idle above reserve: ${Number(idleAboveReserve > 0n ? idleAboveReserve : 0n)/1e6} USDT

Rules:
- SUPPLY: if idle above reserve > ${Number(this.config.minDepositAmount)/1e6} USDT AND APY > ${this.config.minApy}%
- WITHDRAW: if liquid < reserve (only if Aave has funds)
- HOLD: otherwise

Respond with JSON only:
{
  "action": "supply" | "withdraw" | "hold",
  "amount": "<amount in USDT base units (6 decimals), only if supply or withdraw>",
  "reason": "<one sentence explanation>"
}`

    try {
      const msg = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

      return {
        timestamp:    new Date().toISOString(),
        action:       parsed.action ?? 'hold',
        amount:       parsed.amount,
        reason:       parsed.reason ?? 'No reason provided',
        liquidBalance: state.liquidHuman,
        aaveBalance:   state.aaveHuman,
        apy:           state.apys.USDT?.supplyApy,
      }
    } catch (llmErr: any) {
      console.warn('⚠️  LLM unavailable, using deterministic fallback rules:', llmErr?.message)
      // Fallback: reglas deterministas si el LLM falla
      if (idleAboveReserve >= this.config.minDepositAmount && usdtApy >= this.config.minApy) {
        return {
          timestamp:    new Date().toISOString(),
          action:       'supply',
          amount:       idleAboveReserve.toString(),
          reason:       `Supplying ${Number(idleAboveReserve)/1e6} USDT idle above reserve at ${usdtApy}% APY`,
          liquidBalance: state.liquidHuman,
          aaveBalance:   state.aaveHuman,
          apy:           state.apys.USDT?.supplyApy,
        }
      }
      return {
        timestamp:    new Date().toISOString(),
        action:       'hold',
        reason:       'Holding — conditions not met for supply or withdraw',
        liquidBalance: state.liquidHuman,
        aaveBalance:   state.aaveHuman,
      }
    }
  }

  /**
   * Retira fondos de Aave para cubrir un pago x402.
   * Llamado por el PaymentEngine cuando no hay suficiente líquido.
   */
  async ensureLiquidity(requiredAmount: bigint): Promise<boolean> {
    const state = await this.getState()
    const available = state.liquidUsdt

    if (available >= requiredAmount) return true

    const deficit = requiredAmount - available
    const buffer  = 500_000n  // 0.5 USDT buffer

    if (!state.position || state.aaveHuman === "0.00") {
      console.log(`  ⚠️  No Aave position to withdraw from`)
      return false
    }

    console.log(`  💰 Withdrawing ${Number(deficit + buffer)/1e6} USDT from Aave for payment...`)
    try {
      const result = await withdrawFromAave('USDT', deficit + buffer)
      console.log(`  ✅ Withdrawn for payment: ${result.hash}`)

      this.decisions.push({
        timestamp:    new Date().toISOString(),
        action:       'withdraw',
        amount:       (deficit + buffer).toString(),
        reason:       `Auto-withdraw to cover x402 payment of ${Number(requiredAmount)/1e6} USDT`,
        txHash:       result.hash,
        liquidBalance: state.liquidHuman,
        aaveBalance:   state.aaveHuman,
      })
      return true
    } catch (err: any) {
      console.error(`  ❌ Withdraw failed: ${err.message}`)
      return false
    }
  }

  /**
   * Después de un pago, redeposita cualquier exceso sobre la reserva
   */
  async rebalanceAfterPayment(): Promise<void> {
    const state  = await this.getState()
    const excess = state.liquidUsdt - this.config.minLiquidReserve

    if (excess <= this.config.minDepositAmount) return

    console.log(`  ♻️  Redepositing ${Number(excess)/1e6} USDT excess after payment...`)
    try {
      const result = await supplyToAave('USDT', excess)
      console.log(`  ✅ Redeposited: ${result.hash}`)
      this.decisions.push({
        timestamp:    new Date().toISOString(),
        action:       'supply',
        amount:       excess.toString(),
        reason:       'Auto-redeposit excess after x402 payment settled',
        txHash:       result.hash,
        liquidBalance: state.liquidHuman,
        aaveBalance:   state.aaveHuman,
      })
    } catch (err: any) {
      console.error(`  ⚠️  Redeposit failed: ${err.message}`)
    }
  }

  /**
   * Arranca el loop autónomo
   */
  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    console.log(`\n🏦 TreasuryEngine started (cycle: ${this.config.cycleInterval/60000} min)`)

    // Primer ciclo inmediato
    await this.cycle().catch(console.error)

    // Loop
    const loop = setInterval(async () => {
      if (!this.running) { clearInterval(loop); return }
      await this.cycle().catch(console.error)
    }, this.config.cycleInterval)
  }

  stop() {
    this.running = false
    console.log('🛑 TreasuryEngine stopped')
  }

  getDecisions() { return [...this.decisions] }
  isRunning()    { return this.running }
}
