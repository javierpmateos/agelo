import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentEngine } from '../agent/payment-engine.js'
import { TreasuryEngine, DEFAULT_CONFIG } from '../agent/treasury-engine.js'

vi.mock('../wallet/wdk-setup.js', () => ({
  getPlasmaAccount: vi.fn().mockResolvedValue({
    getAddress: vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
  }),
  getArbAccount: vi.fn().mockResolvedValue({
    getTokenBalance: vi.fn().mockResolvedValue(BigInt(5_000_000)),
    getAddress:      vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
    approve:         vi.fn().mockResolvedValue({ hash: '0xmock' }),
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

describe('PaymentEngine', () => {
  let engine: PaymentEngine
  let treasury: TreasuryEngine

  beforeEach(() => {
    treasury = new TreasuryEngine(DEFAULT_CONFIG)
    engine   = new PaymentEngine(treasury)
    vi.clearAllMocks()
  })

  describe('estimateAmount()', () => {
    // Test private method via reflection
    const getEstimate = (e: any, url: string) => e.estimateAmount(url)

    it('returns correct price for aave-rates', () => {
      expect(getEstimate(engine, 'http://localhost:4021/api/aave-rates')).toBe('0.003000')
    })

    it('returns correct price for financial-report', () => {
      expect(getEstimate(engine, 'http://localhost:4021/api/financial-report')).toBe('0.010000')
    })

    it('returns correct price for crypto-price', () => {
      expect(getEstimate(engine, 'http://localhost:4021/api/crypto-price/BTC')).toBe('0.001000')
    })

    it('returns correct price for ai-inference', () => {
      expect(getEstimate(engine, 'http://localhost:4021/api/ai-inference')).toBe('0.050000')
    })

    it('returns default for unknown endpoint', () => {
      expect(getEstimate(engine, 'http://localhost:4021/api/unknown')).toBe('0.001000')
    })
  })

  describe('getReceipts()', () => {
    it('starts with empty receipts', () => {
      expect(engine.getReceipts()).toEqual([])
    })
  })

  describe('getTotalSpent()', () => {
    it('returns 0.000000 with no receipts', () => {
      expect(engine.getTotalSpent()).toBe('0.000000')
    })
  })
})
