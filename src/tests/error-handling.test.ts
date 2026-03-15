import { describe, it, expect, vi } from 'vitest'
import { TreasuryEngine, DEFAULT_CONFIG } from '../agent/treasury-engine.js'

vi.mock('../wallet/wdk-setup.js', () => ({
  getArbAccount: vi.fn().mockResolvedValue({
    getAddress:      vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
    getTokenBalance: vi.fn().mockResolvedValue(BigInt(5_000_000)),
    approve:         vi.fn().mockResolvedValue({ hash: '0xmock' }),
  }),
  getPlasmaAccount: vi.fn().mockResolvedValue({
    getAddress: vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
  }),
}))

vi.mock('../services/lending.js', () => ({
  getAavePosition:  vi.fn().mockResolvedValue(null),  // position unavailable
  getAaveApys:      vi.fn().mockResolvedValue({ USDT: { supplyApy: '4.8%', borrowApy: '6.2%' } }),
  supplyToAave:     vi.fn().mockRejectedValue(new Error('RPC timeout')),
  withdrawFromAave: vi.fn().mockRejectedValue(new Error('Insufficient liquidity')),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: vi.fn().mockRejectedValue(new Error('LLM unavailable')) }
  }
}))

describe('TreasuryEngine — Aave position unavailable', () => {
  it('getState returns null position gracefully', async () => {
    const engine = new TreasuryEngine(DEFAULT_CONFIG)
    const state  = await engine.getState()
    expect(state.position).toBeNull()
  })

  it('aaveHuman defaults to 0.00 when position null', async () => {
    const engine = new TreasuryEngine(DEFAULT_CONFIG)
    const state  = await engine.getState()
    expect(state.aaveHuman).toBe('0.00')
  })

  it('healthFactor defaults to N/A when position null', async () => {
    const engine = new TreasuryEngine(DEFAULT_CONFIG)
    const state  = await engine.getState()
    expect(state.healthFactor).toBe('N/A')
  })
})

describe('TreasuryEngine — supply failure', () => {
  it('cycle returns hold when supply fails', async () => {
    const engine   = new TreasuryEngine(DEFAULT_CONFIG)
    const decision = await engine.cycle()
    // LLM fails → fallback tries supply → supply fails → hold
    expect(decision.action).toBe('hold')
  })

  it('decision reason mentions failure', async () => {
    const engine   = new TreasuryEngine(DEFAULT_CONFIG)
    const decision = await engine.cycle()
    expect(decision.reason.toLowerCase()).toContain('fail')
  })
})

describe('TreasuryEngine — withdraw failure', () => {
  it('ensureLiquidity returns false when withdraw fails', async () => {
    const engine = new TreasuryEngine(DEFAULT_CONFIG)
    const result = await engine.ensureLiquidity(50_000_000n)
    expect(result).toBe(false)
  })

  it('getDecisions still empty after failed withdraw', async () => {
    const engine = new TreasuryEngine(DEFAULT_CONFIG)
    await engine.ensureLiquidity(50_000_000n)
    // No decision logged when withdraw fails
    expect(engine.getDecisions()).toHaveLength(0)
  })
})

describe('Edge cases', () => {
  it('ensureLiquidity with 0 required always returns true', async () => {
    const engine = new TreasuryEngine(DEFAULT_CONFIG)
    const result = await engine.ensureLiquidity(0n)
    expect(result).toBe(true)
  })

  it('getDecisions returns new array each call', () => {
    const engine = new TreasuryEngine(DEFAULT_CONFIG)
    const d1 = engine.getDecisions()
    const d2 = engine.getDecisions()
    expect(d1).not.toBe(d2)
    expect(d1).toEqual(d2)
  })

  it('TreasuryEngine can be instantiated without args', () => {
    expect(() => new TreasuryEngine()).not.toThrow()
  })

  it('multiple engines are independent', () => {
    const e1 = new TreasuryEngine()
    const e2 = new TreasuryEngine()
    expect(e1).not.toBe(e2)
    expect(e1.getDecisions()).not.toBe(e2.getDecisions())
  })
})
