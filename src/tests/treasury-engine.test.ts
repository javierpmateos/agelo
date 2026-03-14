import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TreasuryEngine, DEFAULT_CONFIG } from '../agent/treasury-engine.js'

// Mock WDK calls — no queremos txs reales en unit tests
vi.mock('../wallet/wdk-setup.js', () => ({
  getArbAccount: vi.fn().mockResolvedValue({
    getTokenBalance: vi.fn().mockResolvedValue(BigInt(5_000_000)), // 5 USDT
    getAddress:      vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
    approve:         vi.fn().mockResolvedValue({ hash: '0xmock_approve' }),
  }),
  getPlasmaAccount: vi.fn().mockResolvedValue({
    getAddress: vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
  }),
}))

vi.mock('../services/lending.js', () => ({
  getAavePosition: vi.fn().mockResolvedValue({
    totalCollateral: '8.41',
    totalDebt:       '0.00',
    availableBorrow: '6.31',
    healthFactor:    '∞',
    ltv:             '0',
  }),
  getAaveApys: vi.fn().mockResolvedValue({
    USDT: { supplyApy: '4.8%', borrowApy: '6.2%' },
    USDC: { supplyApy: '4.2%', borrowApy: '5.9%' },
  }),
  supplyToAave:    vi.fn().mockResolvedValue({ hash: '0xmock_supply' }),
  withdrawFromAave: vi.fn().mockResolvedValue({ hash: '0xmock_withdraw' }),
}))

describe('TreasuryEngine', () => {
  let engine: TreasuryEngine

  beforeEach(() => {
    engine = new TreasuryEngine(DEFAULT_CONFIG)
    vi.clearAllMocks()
  })

  describe('getState()', () => {
    it('returns correct liquid balance', async () => {
      const state = await engine.getState()
      expect(state.liquidHuman).toBe('5.00')
    })

    it('returns aave human readable balance', async () => {
      const state = await engine.getState()
      expect(state.aaveHuman).toBe('8.41')
    })

    it('returns health factor from position', async () => {
      const state = await engine.getState()
      expect(state.healthFactor).toBe('∞')
    })

    it('returns APY data', async () => {
      const state = await engine.getState()
      expect(state.apys.USDT?.supplyApy).toBe('4.8%')
    })
  })

  describe('DEFAULT_CONFIG', () => {
    it('has correct minimum liquid reserve', () => {
      expect(DEFAULT_CONFIG.minLiquidReserve).toBe(2_000_000n)
    })

    it('has correct minimum deposit amount', () => {
      expect(DEFAULT_CONFIG.minDepositAmount).toBe(1_000_000n)
    })

    it('has correct minimum APY threshold', () => {
      expect(DEFAULT_CONFIG.minApy).toBe(2.0)
    })

    it('has 30 minute cycle interval', () => {
      expect(DEFAULT_CONFIG.cycleInterval).toBe(30 * 60 * 1000)
    })
  })

  describe('ensureLiquidity()', () => {
    it('returns true when sufficient liquid balance', async () => {
      // 5 USDT liquid, need 3 USDT
      const ok = await engine.ensureLiquidity(3_000_000n)
      expect(ok).toBe(true)
    })

    it('attempts withdraw when insufficient liquid', async () => {
      const { withdrawFromAave } = await import('../services/lending.js')
      // 5 USDT liquid, need 7 USDT → should withdraw
      const ok = await engine.ensureLiquidity(7_000_000n)
      expect(ok).toBe(true)
      expect(withdrawFromAave).toHaveBeenCalled()
    })

    it('records withdraw decision in audit log', async () => {
      await engine.ensureLiquidity(7_000_000n)
      const decisions = engine.getDecisions()
      expect(decisions.length).toBeGreaterThan(0)
      expect(decisions[0].action).toBe('withdraw')
    })
  })

  describe('isRunning()', () => {
    it('starts as not running', () => {
      expect(engine.isRunning()).toBe(false)
    })

    it('returns decisions array', () => {
      expect(Array.isArray(engine.getDecisions())).toBe(true)
    })
  })
})
