import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TreasuryEngine, DEFAULT_CONFIG } from '../agent/treasury-engine.js'
import { PaymentEngine } from '../agent/payment-engine.js'

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
  getAavePosition:  vi.fn().mockResolvedValue({ totalCollateral:'8.41', totalDebt:'0.00', availableBorrow:'6.31', healthFactor:'∞', ltv:'0' }),
  getAaveApys:      vi.fn().mockResolvedValue({ USDT: { supplyApy:'4.8%', borrowApy:'6.2%' } }),
  supplyToAave:     vi.fn().mockResolvedValue({ hash: '0xmock' }),
  withdrawFromAave: vi.fn().mockResolvedValue({ hash: '0xmock' }),
}))

describe('PaymentEngine price table', () => {
  let engine: PaymentEngine

  beforeEach(() => {
    const treasury = new TreasuryEngine(DEFAULT_CONFIG)
    engine = new PaymentEngine(treasury)
  })

  const cases = [
    ['/api/crypto-price/BTC', '0.001000'],
    ['/api/crypto-price/ETH', '0.001000'],
    ['/api/news-summary',      '0.005000'],
    ['/api/market-analysis',   '0.010000'],
    ['/api/onchain-metrics',   '0.010000'],
    ['/api/aave-rates',        '0.003000'],
    ['/api/aave-position',     '0.005000'],
    ['/api/financial-report',  '0.010000'],
    ['/api/defi-strategy',     '0.020000'],
    ['/api/ai-inference',      '0.050000'],
    ['/api/unknown-endpoint',  '0.001000'],
  ] as const

  cases.forEach(([url, expected]) => {
    it(`estimateAmount("${url}") = ${expected}`, () => {
      const result = (engine as any).estimateAmount(`http://localhost:4021${url}`)
      expect(result).toBe(expected)
    })
  })
})

describe('PaymentEngine receipts accumulation', () => {
  it('getTotalSpent sums all receipts', () => {
    const treasury = new TreasuryEngine(DEFAULT_CONFIG)
    const engine   = new PaymentEngine(treasury)
    // inject mock receipts directly
    const receipts = (engine as any).receipts
    receipts.push({ url: 'a', amount_usdt: '0.003000', timestamp: new Date().toISOString() })
    receipts.push({ url: 'b', amount_usdt: '0.010000', timestamp: new Date().toISOString() })
    expect(engine.getTotalSpent()).toBe('0.013000')
  })

  it('getReceipts returns copy not reference', () => {
    const treasury = new TreasuryEngine(DEFAULT_CONFIG)
    const engine   = new PaymentEngine(treasury)
    const r1 = engine.getReceipts()
    const r2 = engine.getReceipts()
    expect(r1).not.toBe(r2)
  })

  it('getTotalSpent with no receipts is 0.000000', () => {
    const treasury = new TreasuryEngine(DEFAULT_CONFIG)
    const engine   = new PaymentEngine(treasury)
    expect(engine.getTotalSpent()).toBe('0.000000')
  })
})
