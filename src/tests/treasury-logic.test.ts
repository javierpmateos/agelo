import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TreasuryEngine, DEFAULT_CONFIG, type TreasuryConfig } from '../agent/treasury-engine.js'

vi.mock('../wallet/wdk-setup.js', () => ({
  getArbAccount: vi.fn().mockResolvedValue({
    getAddress:      vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
    getTokenBalance: vi.fn().mockResolvedValue(BigInt(10_000_000)), // 10 USDT
    approve:         vi.fn().mockResolvedValue({ hash: '0xmock' }),
  }),
  getPlasmaAccount: vi.fn().mockResolvedValue({
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
  supplyToAave:     vi.fn().mockResolvedValue({ hash: '0xsupply_hash' }),
  withdrawFromAave: vi.fn().mockResolvedValue({ hash: '0xwithdraw_hash' }),
}))

// Mock LLM to return fallback (force deterministic path)
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: vi.fn().mockRejectedValue(new Error('LLM unavailable'))
    }
  }
}))

describe('Treasury fallback decision logic (no LLM)', () => {
  let engine: TreasuryEngine

  beforeEach(() => {
    engine = new TreasuryEngine(DEFAULT_CONFIG)
    vi.clearAllMocks()
  })

  it('supplies when idle > minDeposit and APY > minApy', async () => {
    // 10 USDT liquid, reserve 2 USDT → 8 USDT idle > 1 USDT min → should supply
    const decision = await engine.cycle()
    expect(decision.action).toBe('supply')
  })

  it('supply amount equals idle above reserve', async () => {
    const decision = await engine.cycle()
    // 10M - 2M = 8M
    expect(decision.amount).toBe('8000000')
  })

  it('supply calls supplyToAave with correct asset', async () => {
    await engine.cycle()
    const { supplyToAave } = await import('../services/lending.js')
    expect(supplyToAave).toHaveBeenCalledWith('USDT', 8_000_000n)
  })

  it('decision has tx hash after supply', async () => {
    const decision = await engine.cycle()
    expect(decision.txHash).toBe('0xsupply_hash')
  })

  it('decision has timestamp', async () => {
    const decision = await engine.cycle()
    expect(decision.timestamp).toBeTruthy()
    expect(new Date(decision.timestamp).getFullYear()).toBe(2026)
  })

  it('decision has apy field', async () => {
    const decision = await engine.cycle()
    expect(decision.apy).toBe('4.8%')
  })

  it('decision has liquidBalance field', async () => {
    const decision = await engine.cycle()
    expect(decision.liquidBalance).toBe('10.00')
  })

  it('decision is added to audit log', async () => {
    await engine.cycle()
    expect(engine.getDecisions()).toHaveLength(1)
  })

  it('multiple cycles accumulate in audit log', async () => {
    await engine.cycle()
    await engine.cycle()
    expect(engine.getDecisions().length).toBeGreaterThanOrEqual(2)
  })
})

describe('Treasury hold condition', () => {
  it('holds when APY below minimum', async () => {
    const { getAaveApys } = await import('../services/lending.js')
    ;(getAaveApys as any).mockResolvedValueOnce({ USDT: { supplyApy: '1.5%', borrowApy: '3.0%' } })

    const engine = new TreasuryEngine(DEFAULT_CONFIG)
    const decision = await engine.cycle()
    // APY 1.5% < minApy 2% → hold
    expect(decision.action).toBe('hold')
  })

  it('holds when idle below minDepositAmount', async () => {
    const { getArbAccount } = await import('../wallet/wdk-setup.js')
    ;(getArbAccount as any).mockResolvedValueOnce({
      getAddress:      vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
      getTokenBalance: vi.fn().mockResolvedValue(BigInt(2_500_000)), // only 0.5 USDT above reserve
      approve:         vi.fn().mockResolvedValue({ hash: '0xmock' }),
    })
    const engine = new TreasuryEngine(DEFAULT_CONFIG)
    const decision = await engine.cycle()
    expect(decision.action).toBe('hold')
  })
})

describe('Treasury custom config', () => {
  it('respects custom minLiquidReserve', async () => {
    const config: TreasuryConfig = {
      ...DEFAULT_CONFIG,
      minLiquidReserve: 5_000_000n, // 5 USDT reserve
    }
    const engine = new TreasuryEngine(config)
    const decision = await engine.cycle()
    // 10 USDT - 5 USDT reserve = 5 USDT idle > 1 USDT min
    expect(decision.action).toBe('supply')
    expect(decision.amount).toBe('5000000')
  })

  it('respects custom minApy threshold', async () => {
    const config: TreasuryConfig = {
      ...DEFAULT_CONFIG,
      minApy: 10.0, // require 10% APY
    }
    const engine = new TreasuryEngine(config)
    const decision = await engine.cycle()
    // 4.8% APY < 10% required → hold
    expect(decision.action).toBe('hold')
  })
})
