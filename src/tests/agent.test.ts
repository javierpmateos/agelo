import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  getAaveApys:      vi.fn().mockResolvedValue({ USDT: { supplyApy: '4.8%', borrowApy: '6.2%' } }),
  supplyToAave:     vi.fn().mockResolvedValue({ hash: '0xmock_supply' }),
  withdrawFromAave: vi.fn().mockResolvedValue({ hash: '0xmock_withdraw' }),
}))

const mockCreate = vi.fn().mockResolvedValue({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: 'Portfolio: $10.41 total.' }],
  usage: { input_tokens: 100, output_tokens: 50 },
})

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  }
}))

describe('AgeloAgent', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('can be instantiated', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const agent = new AgeloAgent()
    expect(agent).toBeDefined()
  })

  it('has treasury engine', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const agent = new AgeloAgent()
    expect(agent.treasury).toBeDefined()
  })

  it('has payment engine', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const agent = new AgeloAgent()
    expect(agent.payments).toBeDefined()
  })

  it('treasury is not running on init', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const agent = new AgeloAgent()
    expect(agent.treasury.isRunning()).toBe(false)
  })

  it('run() returns answer string', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const agent = new AgeloAgent()
    const result = await agent.run('What is my portfolio?')
    expect(typeof result.answer).toBe('string')
    expect(result.answer.length).toBeGreaterThan(0)
  })

  it('run() returns receipts array', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const agent = new AgeloAgent()
    const result = await agent.run('test')
    expect(Array.isArray(result.receipts)).toBe(true)
  })

  it('run() returns decisions array', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const agent = new AgeloAgent()
    const result = await agent.run('test')
    expect(Array.isArray(result.decisions)).toBe(true)
  })

  it('run() returns totalSpent string', async () => {
    const { AgeloAgent } = await import('../agent/agent.js')
    const agent = new AgeloAgent()
    const result = await agent.run('test')
    expect(typeof result.totalSpent).toBe('string')
  })
})
