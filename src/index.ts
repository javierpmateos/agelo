import express from 'express'
import cors from 'cors'
import { createAgentWallet } from './wallet/agent-wallet.js'
import { PayGateAgent } from './agent/agent.js'
import 'dotenv/config'

const PORT = Number(process.env.AGENT_PORT ?? 4022)

async function main() {
  const seedPhrase = process.env.AGENT_SEED_PHRASE
  if (!seedPhrase) throw new Error('AGENT_SEED_PHRASE not set in .env')

  const wallet = await createAgentWallet(seedPhrase)
  const agent = new PayGateAgent(wallet)

  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'PayGate Agent API' })
  })

  app.get('/wallet', async (_req, res) => {
    const balance = await wallet.getUsdtBalance()
    res.json({
      address: wallet.address,
      balance_usdt0: balance,
      chain: 'Plasma',
      network_id: process.env.PLASMA_NETWORK_ID ?? 'eip155:9745',
    })
  })

  app.post('/task', async (req, res) => {
    const { task } = req.body as { task: string }
    if (!task) { res.status(400).json({ error: 'task is required' }); return }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    send('start', { task, timestamp: new Date().toISOString() })

    try {
      const result = await agent.run(task)
      send('answer', { text: result.answer })
      send('receipts', { items: result.receipts, total_spent: result.totalSpent })
      send('done', { success: true })
    } catch (err) {
      send('error', { message: err instanceof Error ? err.message : String(err) })
    }

    res.end()
  })

  app.listen(PORT, () => {
    console.log(`✅ PayGate Agent API on http://localhost:${PORT}`)
    console.log(`   POST /task   → run a task`)
    console.log(`   GET  /wallet → wallet balance`)
  })
}

main().catch(console.error)
