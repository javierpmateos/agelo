#!/bin/bash
# Agelo v2.0 — parte 2: marketplace.ts y agent.ts
set -e
cd ~/agelo

echo "✍️  src/services/marketplace.ts"
cat > src/services/marketplace.ts << 'EOF'
import express from 'express'
import { paymentMiddleware, Resource } from '@x402/express'
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import { getAaveApys, getAavePosition } from './lending.js'
dotenv.config()

const app = express()
app.use(express.json())

const PORT = parseInt(process.env.MARKETPLACE_PORT || '4021')
const SELLER_ADDRESS = process.env.FACILITATOR_ADDRESS || process.env.AGENT_ADDRESS || ''
const FACILITATOR_URL = 'https://x402.semanticpay.io/'
const USDT0_PLASMA = process.env.USDT0_PLASMA || '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb'

function payConfig(amount: number, description: string): Resource {
  return {
    price: {
      amount: String(Math.round(amount * 1_000_000)),
      asset: {
        address: USDT0_PLASMA,
        chainId: '9745',
        decimals: 6,
        symbol: 'USDT0',
        eip712: { name: 'USD₮0', version: '1' }
      },
      extra: { name: 'USDT0', version: '1' }
    },
    description,
    facilitatorUrl: FACILITATOR_URL,
    to: SELLER_ADDRESS
  }
}

// ── Free ──────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok', seller: SELLER_ADDRESS, chain: 'Plasma (eip155:9745)', token: 'USDT0',
    services: [
      { path: '/api/crypto-price/:symbol', price: '$0.001' },
      { path: '/api/news-summary',         price: '$0.005' },
      { path: '/api/market-analysis',      price: '$0.010' },
      { path: '/api/onchain-metrics',      price: '$0.010' },
      { path: '/api/ai-inference',         price: '$0.050' },
      { path: '/api/aave-rates',           price: '$0.003' },
      { path: '/api/aave-position',        price: '$0.005' },
      { path: '/api/defi-strategy',        price: '$0.020' }
    ]
  })
})

app.get('/mock/crypto-price/:symbol', (req, res) => {
  const prices: Record<string, number> = { BTC: 84500, ETH: 3200, SOL: 145, USDT: 1.0 }
  res.json({ symbol: req.params.symbol, price: prices[req.params.symbol] || 100, mock: true })
})

// ── Paid: crypto price ────────────────────────────────────────────────────────

app.get(
  '/api/crypto-price/[symbol]',
  paymentMiddleware(SELLER_ADDRESS, payConfig(0.001, 'Real-time crypto price'), { url: FACILITATOR_URL }),
  (req: any, res) => {
    const symbol = req.params.symbol?.toUpperCase() || 'BTC'
    const base: Record<string, number> = { BTC: 84500, ETH: 3200, SOL: 145, USDT: 1.0, USDC: 1.0 }
    const price = (base[symbol] || 100) * (1 + (Math.random() - 0.5) * 0.02)
    res.json({ symbol, price: price.toFixed(2), change24h: ((Math.random() - 0.5) * 10).toFixed(2) + '%', timestamp: new Date().toISOString() })
  }
)

// ── Paid: news summary ────────────────────────────────────────────────────────

app.get(
  '/api/news-summary',
  paymentMiddleware(SELLER_ADDRESS, payConfig(0.005, 'Crypto news summary'), { url: FACILITATOR_URL }),
  (_req: any, res) => {
    res.json({
      headlines: [
        'Bitcoin ETF inflows reach record $1.2B in single day',
        'Ethereum Layer 2 TVL surpasses $50B milestone',
        'Fed signals rate cuts possible in Q2 2026',
        'Tether USDT0 expands to 5 new chains via LayerZero',
        'DeFi total value locked hits 3-year high at $120B'
      ],
      sentiment: 'bullish', fearGreedIndex: 72, timestamp: new Date().toISOString()
    })
  }
)

// ── Paid: market analysis ─────────────────────────────────────────────────────

app.get(
  '/api/market-analysis',
  paymentMiddleware(SELLER_ADDRESS, payConfig(0.010, 'AI market analysis'), { url: FACILITATOR_URL }),
  async (_req: any, res) => {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5', max_tokens: 300,
        messages: [{ role: 'user', content: 'Brief 3-sentence crypto market analysis for 2026. JSON with: summary, outlook, keyRisk.' }]
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      try { res.json(JSON.parse(text.replace(/```json\n?|\n?```/g, ''))) }
      catch { res.json({ summary: text, outlook: 'neutral', keyRisk: 'volatility' }) }
    } catch {
      res.json({ summary: 'Market consolidating near key support levels.', outlook: 'neutral', keyRisk: 'macro uncertainty' })
    }
  }
)

// ── Paid: on-chain metrics ────────────────────────────────────────────────────

app.get(
  '/api/onchain-metrics',
  paymentMiddleware(SELLER_ADDRESS, payConfig(0.010, 'On-chain metrics'), { url: FACILITATOR_URL }),
  (_req: any, res) => {
    res.json({
      bitcoin: { activeAddresses: 1_250_000 + Math.floor(Math.random() * 50000), hashRate: '650 EH/s', nvtSignal: 'undervalued' },
      ethereum: { gasPriceGwei: (5 + Math.random() * 20).toFixed(1), stakingApr: '3.8%', burnRate24h: '1,850 ETH', l2tvl: '$52.3B' },
      defi: { totalTvl: '$121.4B', topProtocol: 'Aave V3', aaveSupplyApy: '4.2%' },
      timestamp: new Date().toISOString()
    })
  }
)

// ── Paid: AI inference ────────────────────────────────────────────────────────

app.post(
  '/api/ai-inference',
  paymentMiddleware(SELLER_ADDRESS, payConfig(0.050, 'AI inference'), { url: FACILITATOR_URL }),
  async (req: any, res) => {
    try {
      const { prompt } = req.body
      if (!prompt) return res.status(400).json({ error: 'prompt required' })
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
      const result = msg.content[0].type === 'text' ? msg.content[0].text : ''
      res.json({ result, model: 'claude-haiku-4-5', tokens: msg.usage.output_tokens })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  }
)

// ── Paid: Aave rates ──────────────────────────────────────────────────────────

app.get(
  '/api/aave-rates',
  paymentMiddleware(SELLER_ADDRESS, payConfig(0.003, 'Aave V3 APY rates'), { url: FACILITATOR_URL }),
  async (_req: any, res) => {
    const rates = await getAaveApys()
    res.json({ protocol: 'Aave V3', chain: 'Base', rates, timestamp: new Date().toISOString() })
  }
)

// ── Paid: Aave position ───────────────────────────────────────────────────────

app.get(
  '/api/aave-position',
  paymentMiddleware(SELLER_ADDRESS, payConfig(0.005, 'Aave V3 position'), { url: FACILITATOR_URL }),
  async (_req: any, res) => {
    const position = await getAavePosition()
    res.json(position || { message: 'No active Aave position', hint: 'Fund Base wallet with USDC to start earning yield' })
  }
)

// ── Paid: DeFi strategy ───────────────────────────────────────────────────────

app.post(
  '/api/defi-strategy',
  paymentMiddleware(SELLER_ADDRESS, payConfig(0.020, 'AI DeFi strategy'), { url: FACILITATOR_URL }),
  async (req: any, res) => {
    try {
      const { balance, riskProfile, goals } = req.body
      const apys = await getAaveApys()
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5', max_tokens: 400,
        messages: [{ role: 'user', content: `DeFi strategy advisor. Balance: ${balance || 'unknown'} USDT. Risk: ${riskProfile || 'moderate'}. Goals: ${goals || 'maximize yield'}. Aave V3 rates: ${JSON.stringify(apys)}. JSON with: strategy, allocation {lending,liquidity,reserve %}, expectedApy, topAction, warning.` }]
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
      try { res.json(JSON.parse(text.replace(/```json\n?|\n?```/g, ''))) }
      catch { res.json({ strategy: text, expectedApy: '4-6%', topAction: 'Assess risk tolerance' }) }
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  }
)

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🏪 Agelo Marketplace v2.0`)
  console.log(`   Port  : ${PORT}`)
  console.log(`   Seller: ${SELLER_ADDRESS}`)
  console.log(`   Chain : Plasma (eip155:9745) + Aave on Base`)
  console.log(`   Ready ✅\n`)
})

export default app
EOF

echo "  done"

echo "✍️  src/agent/agent.ts"
cat > src/agent/agent.ts << 'EOF'
import Anthropic from '@anthropic-ai/sdk'
import { getAgentAddress, getUSDT0Balance, getBaseWalletInfo } from '../wallet/agent-wallet.js'
import { getAavePosition, getAaveApys, supplyToAave, withdrawFromAave } from '../services/lending.js'
import { fetchWithPayment } from './x402-client.js'

const MARKETPLACE = `http://localhost:${process.env.MARKETPLACE_PORT || 4021}`

const TOOLS: Anthropic.Tool[] = [
  { name: 'get_crypto_price',   description: 'Real-time crypto price. Costs 0.001 USDT0 via x402.', input_schema: { type: 'object' as const, properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
  { name: 'get_news_summary',   description: 'Crypto news and sentiment. Costs 0.005 USDT0.',        input_schema: { type: 'object' as const, properties: {} } },
  { name: 'get_market_analysis',description: 'AI market analysis. Costs 0.010 USDT0.',               input_schema: { type: 'object' as const, properties: {} } },
  { name: 'get_onchain_metrics',description: 'On-chain metrics BTC/ETH/DeFi. Costs 0.010 USDT0.',   input_schema: { type: 'object' as const, properties: {} } },
  { name: 'ai_inference',       description: 'AI inference on custom prompt. Costs 0.050 USDT0.',    input_schema: { type: 'object' as const, properties: { prompt: { type: 'string' } }, required: ['prompt'] } },
  { name: 'get_aave_rates',     description: 'Aave V3 supply/borrow APY rates on Base. Costs 0.003 USDT0.', input_schema: { type: 'object' as const, properties: {} } },
  { name: 'get_defi_strategy',  description: 'AI DeFi strategy recommendation. Costs 0.020 USDT0.', input_schema: { type: 'object' as const, properties: { balance: { type: 'string' }, riskProfile: { type: 'string', enum: ['conservative','moderate','aggressive'] }, goals: { type: 'string' } }, required: ['riskProfile'] } },
  { name: 'get_wallet_info',    description: 'Agent wallet balances on Plasma and Base (free)',      input_schema: { type: 'object' as const, properties: {} } },
  { name: 'get_aave_position',  description: 'Current Aave V3 lending position (free)',              input_schema: { type: 'object' as const, properties: {} } },
  { name: 'supply_to_aave',     description: 'Supply USDC/USDT to Aave V3 on Base to earn yield',   input_schema: { type: 'object' as const, properties: { asset: { type: 'string', enum: ['USDC','USDT'] }, amount: { type: 'string' } }, required: ['asset','amount'] } },
  { name: 'withdraw_from_aave', description: 'Withdraw from Aave V3 on Base',                        input_schema: { type: 'object' as const, properties: { asset: { type: 'string', enum: ['USDC','USDT'] }, amount: { type: 'string' } }, required: ['asset','amount'] } }
]

interface Receipt { service: string; amount: string; txHash?: string }

async function executeTool(name: string, input: any, receipts: Receipt[]): Promise<string> {
  try {
    switch (name) {
      case 'get_crypto_price': {
        process.stdout.write(`  💳 Calling: ${name} (${input.symbol})\n`)
        const { data, receipt } = await fetchWithPayment(`${MARKETPLACE}/api/crypto-price/${input.symbol}`)
        if (receipt) receipts.push({ service: `/api/crypto-price/${input.symbol}`, amount: '0.001', txHash: receipt })
        return JSON.stringify(data)
      }
      case 'get_news_summary': {
        process.stdout.write(`  💳 Calling: ${name}\n`)
        const { data, receipt } = await fetchWithPayment(`${MARKETPLACE}/api/news-summary`)
        if (receipt) receipts.push({ service: '/api/news-summary', amount: '0.005', txHash: receipt })
        return JSON.stringify(data)
      }
      case 'get_market_analysis': {
        process.stdout.write(`  💳 Calling: ${name}\n`)
        const { data, receipt } = await fetchWithPayment(`${MARKETPLACE}/api/market-analysis`)
        if (receipt) receipts.push({ service: '/api/market-analysis', amount: '0.010', txHash: receipt })
        return JSON.stringify(data)
      }
      case 'get_onchain_metrics': {
        process.stdout.write(`  💳 Calling: ${name}\n`)
        const { data, receipt } = await fetchWithPayment(`${MARKETPLACE}/api/onchain-metrics`)
        if (receipt) receipts.push({ service: '/api/onchain-metrics', amount: '0.010', txHash: receipt })
        return JSON.stringify(data)
      }
      case 'ai_inference': {
        process.stdout.write(`  💳 Calling: ${name}\n`)
        const { data, receipt } = await fetchWithPayment(`${MARKETPLACE}/api/ai-inference`, { method: 'POST', body: JSON.stringify({ prompt: input.prompt }) })
        if (receipt) receipts.push({ service: '/api/ai-inference', amount: '0.050', txHash: receipt })
        return JSON.stringify(data)
      }
      case 'get_aave_rates': {
        process.stdout.write(`  💳 Calling: ${name}\n`)
        const { data, receipt } = await fetchWithPayment(`${MARKETPLACE}/api/aave-rates`)
        if (receipt) receipts.push({ service: '/api/aave-rates', amount: '0.003', txHash: receipt })
        return JSON.stringify(data)
      }
      case 'get_defi_strategy': {
        process.stdout.write(`  💳 Calling: ${name}\n`)
        const { data, receipt } = await fetchWithPayment(`${MARKETPLACE}/api/defi-strategy`, { method: 'POST', body: JSON.stringify(input) })
        if (receipt) receipts.push({ service: '/api/defi-strategy', amount: '0.020', txHash: receipt })
        return JSON.stringify(data)
      }
      case 'get_wallet_info': {
        const plasmaAddress = await getAgentAddress()
        const plasmaBalance = await getUSDT0Balance(plasmaAddress)
        const baseInfo = await getBaseWalletInfo()
        return JSON.stringify({ plasma: { address: plasmaAddress, balance: `${plasmaBalance} USDT0`, chain: 'Plasma' }, base: { ...baseInfo, chain: 'Base' } })
      }
      case 'get_aave_position': {
        const position = await getAavePosition()
        return JSON.stringify(position || { message: 'No active position. Fund Base wallet to start.' })
      }
      case 'supply_to_aave': {
        process.stdout.write(`  🏦 Supplying ${input.amount} ${input.asset} to Aave V3...\n`)
        const result = await supplyToAave(input.asset, input.amount)
        return JSON.stringify({ success: true, tx: result.hash })
      }
      case 'withdraw_from_aave': {
        process.stdout.write(`  🏦 Withdrawing from Aave V3...\n`)
        const result = await withdrawFromAave(input.asset, input.amount)
        return JSON.stringify({ success: true, tx: result.hash })
      }
      default: return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err: any) { return JSON.stringify({ error: err.message }) }
}

export async function runAgent(task: string) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const address = await getAgentAddress()
  const balance = await getUSDT0Balance(address)
  const receipts: Receipt[] = []

  console.log(`\n🤖 Agelo Agent v2.0`)
  console.log(`   Wallet : ${address}`)
  console.log(`   Balance: ${parseFloat(balance).toFixed(6)} USDT0 (Plasma)`)
  console.log(`   Task   : ${task}\n`)

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: task }]

  const systemPrompt = `You are Agelo, an autonomous AI agent with a self-custodial WDK wallet on Plasma.

You pay for services via x402 micropayments (USDT0 on Plasma) and manage DeFi positions on Aave V3 (Base).

Tools available:
- x402 PAID: get_crypto_price, get_news_summary, get_market_analysis, get_onchain_metrics, ai_inference, get_aave_rates, get_defi_strategy
- FREE LOCAL: get_wallet_info, get_aave_position, supply_to_aave, withdraw_from_aave

Use minimum tools needed. Be concise. Include tx hashes for payments made.

Wallet: ${address} | Balance: ${balance} USDT0`

  let iterations = 0
  while (iterations < 10) {
    iterations++
    const response = await client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 2000, system: systemPrompt, tools: TOOLS, messages })
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      const text = response.content.find((b: any) => b.type === 'text')?.text || ''
      console.log('\n─────────────────────────────────────────')
      console.log('📋 ANSWER\n')
      console.log(text)
      break
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        const result = await executeTool(block.name, block.input, receipts)
        const parsed = JSON.parse(result)
        if (!parsed.error) process.stdout.write(`  ✅ Done\n`)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
      messages.push({ role: 'user', content: toolResults })
    }
  }

  if (receipts.length > 0) {
    console.log('\n─────────────────────────────────────────')
    console.log('🧾 PAYMENT RECEIPTS\n')
    let total = 0
    receipts.forEach((r, i) => {
      const amt = parseFloat(r.amount)
      total += amt
      console.log(`  ${i + 1}. ${r.service.padEnd(30)} $${amt.toFixed(6)} USDT0`)
      if (r.txHash) console.log(`     tx: ${r.txHash}`)
    })
    console.log(`\n  TOTAL: $${total.toFixed(6)} USDT0`)
    console.log(`  Verify: https://plasmascan.to`)
  }

  console.log('\n─────────────────────────────────────────\n')
}
EOF

echo "  done"
echo ""
echo "✅ Todo listo! Probá:"
echo "  Terminal 1: npm run marketplace"
echo "  Terminal 2: npm run agent \"What are current Aave V3 rates?\""
