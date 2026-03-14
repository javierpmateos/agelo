import express from 'express'
import cors from 'cors'
import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { HTTPFacilitatorClient } from '@x402/core/server'
import Anthropic from '@anthropic-ai/sdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { getAaveApys, getAavePosition } from '../services/lending.js'
import 'dotenv/config'

const PORT = Number(process.env.MARKETPLACE_PORT ?? 4021)
const PLASMA_RPC = process.env.PLASMA_RPC ?? 'https://rpc.plasma.to'
const PLASMA_NETWORK_ID = (process.env.PLASMA_NETWORK_ID ?? 'eip155:9745') as `${string}:${string}`
const USDT0_PLASMA = process.env.USDT0_PLASMA ?? '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PRICE = {
  crypto_price:    '1000',
  news_summary:    '5000',
  market_analysis: '10000',
  onchain_metrics: '10000',
  ai_inference:    '50000',
  aave_rates:      '3000',
  aave_position:   '5000',
  defi_strategy:   '20000',
  financial_report:'10000',
}

function mockCryptoPrice(symbol: string) {
  const prices: Record<string, number> = {
    BTC: 68420.55, ETH: 3812.33, SOL: 178.91,
    USDT: 1.00, BNB: 598.42, ARB: 1.23,
  }
  return {
    symbol: symbol.toUpperCase(),
    price_usd: prices[symbol.toUpperCase()] ?? Math.random() * 1000,
    change_24h: (Math.random() * 10 - 5).toFixed(2) + '%',
    timestamp: new Date().toISOString(),
  }
}

function mockNewsSummary() {
  return {
    articles: [
      { title: 'Bitcoin ETF inflows hit record $1.2B in single day', sentiment: 'bullish' },
      { title: 'Ethereum L2 TVL surpasses $50B milestone', sentiment: 'bullish' },
      { title: 'Tether reports $6.2B profit in Q1 2026', sentiment: 'positive' },
      { title: 'DeFi protocol exploit drains $8M from liquidity pool', sentiment: 'bearish' },
    ],
    overall_sentiment: 'moderately bullish',
    timestamp: new Date().toISOString(),
  }
}

async function main() {
  console.log('🚀 Starting Agelo Marketplace...')

  const sellerAccount = await new WalletManagerEvm(
    process.env.AGENT_SEED_PHRASE ?? '',
    { provider: PLASMA_RPC }
  ).getAccount()
  const sellerAddress = await sellerAccount.getAddress()
  console.log(`💳 Seller: ${sellerAddress}`)

  const facilitatorClient = new HTTPFacilitatorClient({ url: 'https://x402.semanticpay.io/' })
  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(PLASMA_NETWORK_ID, new ExactEvmScheme())

  function payConfig(amount: string, description: string) {
    return {
      accepts: [{
        scheme: 'exact' as const,
        network: PLASMA_NETWORK_ID,
        price: { amount, asset: USDT0_PLASMA, extra: { name: 'USDT0', version: '1', decimals: 6 } },
        payTo: sellerAddress,
      }],
      description,
      mimeType: 'application/json',
    }
  }

  const app = express()
  app.use(cors())
  app.use(express.json())

  app.use(paymentMiddleware({
    'GET /api/crypto-price/:symbol': payConfig(PRICE.crypto_price,    'Live crypto price'),
    'GET /api/news-summary':         payConfig(PRICE.news_summary,    'Crypto news digest'),
    'GET /api/market-analysis':      payConfig(PRICE.market_analysis, 'AI market analysis'),
    'GET /api/onchain-metrics':      payConfig(PRICE.onchain_metrics, 'On-chain metrics'),
    'POST /api/ai-inference':        payConfig(PRICE.ai_inference,    'LLM inference'),
    'GET /api/aave-rates':           payConfig(PRICE.aave_rates,      'Aave V3 APY rates'),
    'GET /api/aave-position':        payConfig(PRICE.aave_position,   'Aave V3 position'),
    'POST /api/defi-strategy':       payConfig(PRICE.defi_strategy,   'AI DeFi strategy'),
    'GET /api/financial-report':     payConfig(PRICE.financial_report,'AI financial report'),
  } as any, resourceServer))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Agelo Marketplace', seller: sellerAddress })
  })

  app.get('/api/crypto-price/:symbol', (req, res) => {
    res.json(mockCryptoPrice(req.params.symbol))
  })

  app.get('/api/news-summary', (_req, res) => {
    res.json(mockNewsSummary())
  })

  app.get('/api/market-analysis', async (_req, res) => {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 300,
      messages: [{ role: 'user', content: 'Give a 3-sentence crypto market analysis with sentiment score (0-10) for March 2026.' }],
    })
    res.json({ analysis: msg.content[0].type === 'text' ? msg.content[0].text : '', timestamp: new Date().toISOString() })
  })

  app.get('/api/onchain-metrics', (_req, res) => {
    res.json({
      ethereum: { gas_price_gwei: (Math.random() * 30 + 5).toFixed(1), defi_tvl_usd: '48.2B' },
      bitcoin:  { mempool_size_mb: (Math.random() * 200 + 50).toFixed(1) },
      timestamp: new Date().toISOString(),
    })
  })

  app.post('/api/ai-inference', async (req, res) => {
    const { prompt, context } = req.body as { prompt: string; context?: string }
    if (!prompt) { res.status(400).json({ error: 'prompt required' }); return }
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 500,
      messages: [{ role: 'user', content: context ? `Context: ${context}\n\n${prompt}` : prompt }],
    })
    res.json({ result: msg.content[0].type === 'text' ? msg.content[0].text : '', timestamp: new Date().toISOString() })
  })

  app.get('/api/aave-rates', async (_req, res) => {
    const rates = await getAaveApys()
    res.json({ protocol: 'Aave V3', chain: 'Base', rates, timestamp: new Date().toISOString() })
  })

  app.get('/api/aave-position', async (_req, res) => {
    const position = await getAavePosition()
    res.json(position ?? { message: 'No active Aave position' })
  })

  app.post('/api/defi-strategy', async (req, res) => {
    const { balance, riskProfile, goals } = req.body
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 400,
      messages: [{ role: 'user', content: `DeFi strategy. Balance: ${balance ?? 'unknown'}. Risk: ${riskProfile ?? 'moderate'}. Goals: ${goals ?? 'yield'}. Respond JSON only: { strategy, allocation, expectedApy, topAction, warning }` }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    try { res.json(JSON.parse(text.replace(/```json|```/g, '').trim())) }
    catch { res.json({ strategy: text }) }
  })

  app.get('/api/financial-report', async (_req, res) => {
    const [position, rates] = await Promise.all([getAavePosition(), getAaveApys()])
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 500,
      messages: [{ role: 'user', content: `Financial report based on real Aave V3 data:\nPosition: ${JSON.stringify(position)}\nRates: ${JSON.stringify(rates)}\nInclude: yield estimate, APY, health status, recommendations.` }],
    })
    res.json({
      report: msg.content[0].type === 'text' ? msg.content[0].text : '',
      raw: { position, rates },
      timestamp: new Date().toISOString(),
    })
  })

  app.listen(PORT, () => {
    console.log(`\n✅ Agelo Marketplace on http://localhost:${PORT}`)
    console.log(`   /api/aave-rates      $0.003  ← real data`)
    console.log(`   /api/aave-position   $0.005  ← real data`)
    console.log(`   /api/financial-report $0.010 ← real data + AI`)
  })
}

main().catch(console.error)
