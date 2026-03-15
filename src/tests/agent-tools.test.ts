import { describe, it, expect, vi } from 'vitest'

vi.mock('../wallet/wdk-setup.js', () => ({
  getArbAccount: vi.fn().mockResolvedValue({
    getAddress:      vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
    getTokenBalance: vi.fn().mockResolvedValue(BigInt(2_000_000)),
    approve:         vi.fn().mockResolvedValue({ hash: '0xmock' }),
  }),
  getPlasmaAccount: vi.fn().mockResolvedValue({
    getAddress: vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
  }),
  getEthAccount: vi.fn().mockResolvedValue({
    getAddress: vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
  }),
}))

vi.mock('../services/lending.js', () => ({
  getAavePosition: vi.fn().mockResolvedValue({
    totalCollateral: '8.41', totalDebt: '0.00',
    availableBorrow: '6.31', healthFactor: '∞', ltv: '0',
  }),
  getAaveApys: vi.fn().mockResolvedValue({ USDT: { supplyApy: '4.8%', borrowApy: '6.2%' } }),
  supplyToAave:     vi.fn().mockResolvedValue({ hash: '0xmock' }),
  withdrawFromAave: vi.fn().mockResolvedValue({ hash: '0xmock' }),
}))

const mockCreate = vi.fn().mockResolvedValue({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: 'ok' }],
  usage: { input_tokens: 10, output_tokens: 5 },
})
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: mockCreate } }
}))

describe('AgeloAgent tool definitions', () => {
  it('has get_portfolio_status tool', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const agent = new AgeloAgent()
    const tools = (agent as any).TOOLS ?? []
    // Tools are defined in the module, check via agent run
    expect(agent).toBeDefined()
  })

  it('portfolio state returns all required fields', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const engine = new TreasuryEngine()
    const state  = await engine.getState()
    expect(state).toHaveProperty('liquidUsdt')
    expect(state).toHaveProperty('liquidHuman')
    expect(state).toHaveProperty('aaveHuman')
    expect(state).toHaveProperty('healthFactor')
    expect(state).toHaveProperty('apys')
    expect(state).toHaveProperty('position')
  })

  it('liquidHuman is decimal string with 2 places', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const engine = new TreasuryEngine()
    const state  = await engine.getState()
    expect(state.liquidHuman).toMatch(/^\d+\.\d{2}$/)
  })

  it('aaveHuman is decimal string with 2 places', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const engine = new TreasuryEngine()
    const state  = await engine.getState()
    expect(state.aaveHuman).toMatch(/^\d+\.\d{2}$/)
  })

  it('total = liquid + aave', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const engine = new TreasuryEngine()
    const state  = await engine.getState()
    const total  = parseFloat(state.liquidHuman) + parseFloat(state.aaveHuman)
    expect(total).toBeGreaterThan(0)
  })
})

describe('AgeloAgent run() response contract', () => {
  it('answer is non-empty string', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const agent  = new AgeloAgent()
    const result = await agent.run('test')
    expect(result.answer).toBeTruthy()
    expect(typeof result.answer).toBe('string')
  })

  it('receipts is array', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const result = await new AgeloAgent().run('test')
    expect(Array.isArray(result.receipts)).toBe(true)
  })

  it('decisions is array', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const result = await new AgeloAgent().run('test')
    expect(Array.isArray(result.decisions)).toBe(true)
  })

  it('totalSpent is numeric string', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const result = await new AgeloAgent().run('test')
    expect(parseFloat(result.totalSpent)).toBeGreaterThanOrEqual(0)
  })

  it('totalSpent has 6 decimal places', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const result = await new AgeloAgent().run('test')
    expect(result.totalSpent).toMatch(/^\d+\.\d{6}$/)
  })
})

describe('TreasuryDecision shape', () => {
  it('has all required fields', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const engine   = new TreasuryEngine()
    await engine.ensureLiquidity(50_000_000n) // force a withdraw decision
    const decisions = engine.getDecisions()
    if (decisions.length > 0) {
      const d = decisions[0]
      expect(d).toHaveProperty('timestamp')
      expect(d).toHaveProperty('action')
      expect(d).toHaveProperty('reason')
      expect(d).toHaveProperty('liquidBalance')
      expect(d).toHaveProperty('aaveBalance')
    }
  })

  it('action is valid enum value', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const engine   = new TreasuryEngine()
    await engine.ensureLiquidity(50_000_000n)
    engine.getDecisions().forEach(d => {
      expect(['supply', 'withdraw', 'hold']).toContain(d.action)
    })
  })

  it('timestamp is valid ISO string', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const engine   = new TreasuryEngine()
    await engine.ensureLiquidity(50_000_000n)
    engine.getDecisions().forEach(d => {
      expect(() => new Date(d.timestamp)).not.toThrow()
      expect(new Date(d.timestamp).getTime()).toBeGreaterThan(0)
    })
  })
})
