import express from 'express'
import 'express-async-errors'
import cors from 'cors'
import { AgeloAgent } from './agent/agent.js'
import 'dotenv/config'

const PORT = Number(process.env.AGENT_PORT ?? 4022)

async function main() {
  const agent = new AgeloAgent()

  // Arranca el loop autónomo del treasury en background
  agent.startAutonomousLoop()

  const app = express()
  app.use(cors({ origin: '*' }))
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Agelo Agent API' })
  })

  app.get('/portfolio', async (_req, res) => {
    const state = await agent.treasury.getState()
    res.json({
      liquid_usdt:   state.liquidHuman,
      aave_usdt:     state.aaveHuman,
      health_factor: state.healthFactor,
      apy:           state.apys.USDT?.supplyApy,
      total_usdt:    (parseFloat(state.liquidHuman) + parseFloat(state.aaveHuman)).toFixed(2),
      decisions:     agent.treasury.getDecisions(),
    })
  })

  app.get('/receipts', (_req, res) => {
    res.json({
      items:        agent.payments.getReceipts(),
      total_spent:  agent.payments.getTotalSpent(),
      negotiations: agent.payments.getNegotiations(),
      total_saved:  agent.payments.getTotalSaved(),
    })
  })

  // SSE streaming para el dashboard
  app.post('/task', async (req, res) => {
    const { task } = req.body as { task: string }
    if (!task) { res.status(400).json({ error: 'task is required' }); return }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const send = (event: string, data: unknown) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

    send('start', { task, timestamp: new Date().toISOString() })

    try {
      const result = await agent.run(task)
      send('answer',   { text: result.answer })
      send('receipts', { items: result.receipts, total_spent: result.totalSpent })
      send('decisions',{ items: result.decisions })
      send('done',     { success: true })
    } catch (err) {
      send('error', { message: err instanceof Error ? err.message : String(err) })
    }

    res.end()
  })

  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('Agent API error:', err.message)
    res.status(500).json({ error: 'Internal server error', message: err.message })
  })

  app.listen(PORT, () => {
    console.log(`\n✅ Agelo API on http://localhost:${PORT}`)
    console.log(`   POST /task       → run a task (SSE)`)
    console.log(`   GET  /portfolio  → wallet + Aave state`)
    console.log(`   GET  /receipts   → payment history`)
  })
}

main().catch(console.error)
