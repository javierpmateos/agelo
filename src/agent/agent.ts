/**
 * Agelo Agent — agente financiero autónomo.
 *
 * Combina TreasuryEngine + PaymentEngine:
 * - Treasury corre en background cada 30 min
 * - Cuando recibe una tarea, usa PaymentEngine para pagar servicios
 * - Reporta decisiones, pagos, y estado del portfolio
 */

import Anthropic from '@anthropic-ai/sdk'
import { TreasuryEngine, DEFAULT_CONFIG } from './treasury-engine.js'
import { PaymentEngine } from './payment-engine.js'
import 'dotenv/config'

const MARKETPLACE = `http://localhost:${process.env.MARKETPLACE_PORT ?? 4021}`
const anthropic   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_portfolio_status',
    description: 'Get current Agelo portfolio: liquid USDT, Aave position, APY, health factor. Free — reads onchain.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_aave_rates',
    description: 'Get current Aave V3 supply/borrow APY rates on Arbitrum. Costs $0.003 USDT0.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_financial_report',
    description: 'Get AI-generated financial report with yield analysis and recommendations. Costs $0.010 USDT0.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_crypto_price',
    description: 'Get real-time price for a cryptocurrency. Costs $0.001 USDT0.',
    input_schema: {
      type: 'object' as const,
      properties: { symbol: { type: 'string', description: 'e.g. BTC, ETH, SOL' } },
      required: ['symbol'],
    },
  },
  {
    name: 'get_market_analysis',
    description: 'Get AI-powered market analysis. Costs $0.010 USDT0.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'run_treasury_cycle',
    description: 'Manually trigger a treasury cycle: evaluate and potentially supply/withdraw from Aave.',
    input_schema: { type: 'object' as const, properties: {} },
  },
]

export class AgeloAgent {
  public treasury:  TreasuryEngine
  public payments:  PaymentEngine

  constructor() {
    this.treasury = new TreasuryEngine(DEFAULT_CONFIG)
    this.payments = new PaymentEngine(this.treasury)
  }

  private async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'get_portfolio_status': {
        const state = await this.treasury.getState()
        return JSON.stringify({
          liquid_usdt:  state.liquidHuman,
          aave_usdt:    state.aaveHuman,
          health_factor: state.healthFactor,
          apy:          state.apys.USDT?.supplyApy,
          total_usdt:   (parseFloat(state.liquidHuman) + parseFloat(state.aaveHuman)).toFixed(2),
        })
      }

      case 'run_treasury_cycle': {
        const decision = await this.treasury.cycle()
        return JSON.stringify(decision)
      }

      case 'get_aave_rates': {
        const { data } = await this.payments.paidFetch(`${MARKETPLACE}/api/aave-rates`)
        return JSON.stringify(data)
      }

      case 'get_financial_report': {
        const { data } = await this.payments.paidFetch(`${MARKETPLACE}/api/financial-report`)
        return JSON.stringify(data)
      }

      case 'get_crypto_price': {
        const { data } = await this.payments.paidFetch(
          `${MARKETPLACE}/api/crypto-price/${input.symbol}`
        )
        return JSON.stringify(data)
      }

      case 'get_market_analysis': {
        const { data } = await this.payments.paidFetch(`${MARKETPLACE}/api/market-analysis`)
        return JSON.stringify(data)
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }

  async run(task: string) {
    const state = await this.treasury.getState()
    console.log(`\n🤖 Agelo Agent`)
    console.log(`   Portfolio: ${state.liquidHuman} liquid + ${state.aaveHuman} in Aave = ${(parseFloat(state.liquidHuman) + parseFloat(state.aaveHuman)).toFixed(2)} USDT total`)
    console.log(`\n📋 Task: ${task}\n`)

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: task }]

    const system = `You are Agelo, an autonomous financial agent.
Your wallet has ${state.liquidHuman} USDT liquid and ${state.aaveHuman} USDT earning ${state.apys.USDT?.supplyApy} APY in Aave V3 on Arbitrum.
You pay for external data services using USDT0 micropayments via x402 on Plasma chain.
Always check portfolio_status first if asked about finances.
Be concise and data-driven.`

    let iter = 0
    while (iter++ < 8) {
      const response = await anthropic.messages.create({
        model:      'claude-haiku-4-5',
        max_tokens: 800,
        system,
        tools:      TOOLS,
        messages,
      })

      messages.push({ role: 'assistant', content: response.content })

      if (response.stop_reason === 'end_turn') {
        const text = response.content.find(b => b.type === 'text')
        return {
          answer:      text?.type === 'text' ? text.text : 'Done.',
          receipts:    this.payments.getReceipts(),
          totalSpent:  this.payments.getTotalSpent(),
          decisions:   this.treasury.getDecisions(),
        }
      }

      if (response.stop_reason === 'tool_use') {
        const results: Anthropic.ToolResultBlockParam[] = []
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue
          try {
            const result = await this.executeTool(block.name, block.input as Record<string, unknown>)
            results.push({ type: 'tool_result', tool_use_id: block.id, content: result })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            results.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${msg}`, is_error: true })
          }
        }
        messages.push({ role: 'user', content: results })
      }
    }

    return {
      answer:     'Max iterations reached.',
      receipts:   this.payments.getReceipts(),
      totalSpent: this.payments.getTotalSpent(),
      decisions:  this.treasury.getDecisions(),
    }
  }

  async startAutonomousLoop() {
    await this.treasury.start()
  }
}

// CLI
async function main() {
  const agent = new AgeloAgent()
  const task  = process.argv.slice(2).join(' ') || 'What is my current portfolio status and how much am I earning?'
  const result = await agent.run(task)

  console.log('\n─────────────────────────────────')
  console.log('📊 ANSWER')
  console.log('─────────────────────────────────')
  console.log(result.answer)

  if (result.receipts.length > 0) {
    console.log('\n🧾 PAYMENTS')
    console.log('─────────────────────────────────')
    result.receipts.forEach(r => {
      const path = r.url.replace(`http://localhost:${process.env.MARKETPLACE_PORT ?? 4021}`, '')
      console.log(`  ${path.padEnd(30)} $${r.amount_usdt} USDT0`)
    })
    console.log(`\n  Total: $${result.totalSpent} USDT0`)
  }
}

main().catch(console.error)
