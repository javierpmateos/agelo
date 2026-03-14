import Anthropic from '@anthropic-ai/sdk'
import { createAgentWallet } from '../wallet/agent-wallet.js'
import { createX402Client } from './x402-client.js'
import 'dotenv/config'

const MARKETPLACE_BASE = `http://localhost:${process.env.MARKETPLACE_PORT ?? 4021}`
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_crypto_price',
    description: 'Get real-time price data for a cryptocurrency. Costs $0.001 USDT.',
    input_schema: {
      type: 'object' as const,
      properties: { symbol: { type: 'string', description: 'Token symbol e.g. BTC, ETH, SOL' } },
      required: ['symbol'],
    },
  },
  {
    name: 'get_news_summary',
    description: 'Get latest crypto news with sentiment analysis. Costs $0.005 USDT.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_market_analysis',
    description: 'Get AI-powered market analysis. Costs $0.010 USDT.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_onchain_metrics',
    description: 'Get real-time on-chain metrics for ETH and BTC. Costs $0.010 USDT.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'ai_inference',
    description: 'Run a custom LLM inference call. Costs $0.050 USDT.',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: { type: 'string', description: 'The prompt to send' },
        context: { type: 'string', description: 'Optional context' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'get_aave_rates',
    description: 'Get current Aave V3 supply and borrow APY rates on Base. Costs $0.003 USDT.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_defi_strategy',
    description: 'Get AI-powered DeFi strategy recommendation. Costs $0.020 USDT.',
    input_schema: {
      type: 'object' as const,
      properties: {
        balance: { type: 'string' },
        riskProfile: { type: 'string', enum: ['conservative', 'moderate', 'aggressive'] },
        goals: { type: 'string' },
      },
      required: ['riskProfile'],
    },
  },
]

export class PayGateAgent {
  private x402: ReturnType<typeof createX402Client>

  constructor(private wallet: Awaited<ReturnType<typeof createAgentWallet>>) {
    this.x402 = createX402Client(wallet)
  }

  private async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    console.log(`\n  💳 Calling: ${name}`)
    let url: string
    let fetchOptions: RequestInit = {}

    switch (name) {
      case 'get_crypto_price':
        url = `${MARKETPLACE_BASE}/api/crypto-price/${input.symbol}`
        break
      case 'get_news_summary':
        url = `${MARKETPLACE_BASE}/api/news-summary`
        break
      case 'get_market_analysis':
        url = `${MARKETPLACE_BASE}/api/market-analysis`
        break
      case 'get_onchain_metrics':
        url = `${MARKETPLACE_BASE}/api/onchain-metrics`
        break
      case 'ai_inference':
        url = `${MARKETPLACE_BASE}/api/ai-inference`
        fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: input.prompt, context: input.context }),
        }
        break
        case 'get_aave_rates':
          url = `${MARKETPLACE_BASE}/api/aave-rates`
          break
        case 'get_defi_strategy':
          url = `${MARKETPLACE_BASE}/api/defi-strategy`
          fetchOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance: input.balance, riskProfile: input.riskProfile, goals: input.goals }) }
          break
      default:
        throw new Error(`Unknown tool: ${name}`)
    }

    const { data, receipt } = await this.x402.paidFetch(url, fetchOptions)
    if (receipt) console.log(`  ✅ Paid ${receipt.amount_usdt} USDT0`)
    return JSON.stringify(data, null, 2)
  }

  async run(task: string) {
    const balance = await this.wallet.getUsdtBalance()
    console.log(`\n🤖 PayGate Agent`)
    console.log(`   Wallet: ${this.wallet.address}`)
    console.log(`   Balance: ${balance} USDT0`)
    console.log(`\n📋 Task: ${task}\n`)

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: task }]

    const systemPrompt = `You are PayGate, an autonomous AI agent that pays for data services to complete tasks.
You have a self-custodial wallet (${this.wallet.address}) with USDT0 on Plasma chain.
Each tool call costs a small micropayment — you pay automatically.
Only call services genuinely needed. Prefer cheaper options when possible.
Always end with a clear, actionable answer.`

    let iteration = 0
    while (iteration < 10) {
      iteration++
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1000,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      })

      messages.push({ role: 'assistant', content: response.content })

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b) => b.type === 'text')
        const answer = textBlock?.type === 'text' ? textBlock.text : 'Task completed.'
        return { answer, receipts: this.x402.getReceipts(), totalSpent: this.x402.getTotalSpent() }
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue
          try {
            const result = await this.executeTool(block.name, block.input as Record<string, unknown>)
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.log(`  ❌ Error: ${msg}`)
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${msg}`, is_error: true })
          }
        }
        messages.push({ role: 'user', content: toolResults })
      }
    }

    return { answer: 'Max iterations reached.', receipts: this.x402.getReceipts(), totalSpent: this.x402.getTotalSpent() }
  }
}

// CLI entrypoint
async function main() {
  const seedPhrase = process.env.AGENT_SEED_PHRASE
  if (!seedPhrase) throw new Error('AGENT_SEED_PHRASE not set in .env')

  const wallet = await createAgentWallet(seedPhrase)
  const agent = new PayGateAgent(wallet)
  const task = process.argv.slice(2).join(' ') ||
    'What is the current price of BTC and ETH? Give me a brief market summary.'

  const result = await agent.run(task)

  console.log('\n─────────────────────────────────')
  console.log('📊 ANSWER')
  console.log('─────────────────────────────────')
  console.log(result.answer)
  console.log('\n🧾 RECEIPTS')
  console.log('─────────────────────────────────')
  if (result.receipts.length === 0) {
    console.log('  No paid services used.')
  } else {
    result.receipts.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.url.replace('http://localhost:4021', '').padEnd(30)} $${r.amount_usdt} USDT0`)
    })
    console.log(`\n  TOTAL: $${result.totalSpent} USDT0`)
  }
}

main().catch(console.error)
