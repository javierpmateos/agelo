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
  getAaveApys: vi.fn().mockResolvedValue({
    USDT: { supplyApy: '4.8%', borrowApy: '6.2%' },
  }),
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

describe('TreasuryEngine state shape', () => {
  it('getState returns required fields', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const engine = new TreasuryEngine()
    const state = await engine.getState()
    expect(state).toHaveProperty('liquidUsdt')
    expect(state).toHaveProperty('liquidHuman')
    expect(state).toHaveProperty('aaveHuman')
    expect(state).toHaveProperty('healthFactor')
    expect(state).toHaveProperty('apys')
    expect(state).toHaveProperty('position')
  })

  it('liquidHuman is a formatted decimal string', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const engine = new TreasuryEngine()
    const state = await engine.getState()
    expect(state.liquidHuman).toMatch(/^\d+\.\d{2}$/)
  })

  it('getDecisions returns empty array initially', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const engine = new TreasuryEngine()
    expect(engine.getDecisions()).toEqual([])
  })

  it('stop() sets isRunning to false', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const engine = new TreasuryEngine()
    engine.stop()
    expect(engine.isRunning()).toBe(false)
  })
})

describe('PaymentEngine state shape', () => {
  it('starts with zero total spent', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const { PaymentEngine }  = await import('../agent/payment-engine.js')
    const treasury = new TreasuryEngine()
    const payments = new PaymentEngine(treasury)
    expect(payments.getTotalSpent()).toBe('0.000000')
  })

  it('starts with empty receipts', async () => {
    const { TreasuryEngine } = await import('../agent/treasury-engine.js')
    const { PaymentEngine }  = await import('../agent/payment-engine.js')
    const treasury = new TreasuryEngine()
    const payments = new PaymentEngine(treasury)
    expect(payments.getReceipts()).toHaveLength(0)
  })
})
