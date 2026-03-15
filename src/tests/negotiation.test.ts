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

function makeEngine() {
  const treasury = new TreasuryEngine(DEFAULT_CONFIG)
  return new PaymentEngine(treasury)
}

describe('Provider registry', () => {
  it('has 2 providers for aave-rates', () => {
    const engine = makeEngine()
    const providers = (engine as any).PROVIDERS['aave-rates']
    expect(providers).toHaveLength(2)
  })

  it('has 2 providers for financial-report', () => {
    const engine = makeEngine()
    const providers = (engine as any).PROVIDERS['financial-report']
    expect(providers).toHaveLength(2)
  })

  it('has 2 providers for crypto-price', () => {
    const engine = makeEngine()
    const providers = (engine as any).PROVIDERS['crypto-price']
    expect(providers).toHaveLength(2)
  })

  it('v1 URL does not contain v2', () => {
    const engine = makeEngine()
    const v1 = (engine as any).PROVIDERS['aave-rates'][0]
    expect(v1).not.toContain('v2')
  })

  it('v2 URL contains v2', () => {
    const engine = makeEngine()
    const v2 = (engine as any).PROVIDERS['aave-rates'][1]
    expect(v2).toContain('v2')
  })
})

describe('Price table', () => {
  it('v2 aave-rates is more expensive than v1', () => {
    const engine = makeEngine()
    const table  = (engine as any).PRICE_TABLE
    const v1 = parseFloat(table['http://localhost:4021/api/aave-rates'])
    const v2 = parseFloat(table['http://localhost:4021/api/v2/aave-rates'])
    expect(v2).toBeGreaterThan(v1)
  })

  it('v2 financial-report is more expensive than v1', () => {
    const engine = makeEngine()
    const table  = (engine as any).PRICE_TABLE
    const v1 = parseFloat(table['http://localhost:4021/api/financial-report'])
    const v2 = parseFloat(table['http://localhost:4021/api/v2/financial-report'])
    expect(v2).toBeGreaterThan(v1)
  })

  it('v2 premium is between 20% and 60%', () => {
    const engine = makeEngine()
    const table  = (engine as any).PRICE_TABLE
    const v1 = parseFloat(table['http://localhost:4021/api/aave-rates'])
    const v2 = parseFloat(table['http://localhost:4021/api/v2/aave-rates'])
    const premium = (v2 - v1) / v1 * 100
    expect(premium).toBeGreaterThan(20)
    expect(premium).toBeLessThan(60)
  })
})

describe('negotiate()', () => {
  it('returns cheapest provider', async () => {
    const engine = makeEngine()
    const result = await engine.negotiate('aave-rates')
    expect(result.url).not.toContain('v2')
    expect(result.price).toBe('0.003000')
  })

  it('chosen price is lower than alternative', async () => {
    const engine = makeEngine()
    const result = await engine.negotiate('financial-report')
    expect(parseFloat(result.price)).toBeLessThan(0.015)
  })

  it('throws for unknown service', async () => {
    const engine = makeEngine()
    await expect(engine.negotiate('unknown-service')).rejects.toThrow('Unknown service')
  })

  it('records negotiation in log', async () => {
    const engine = makeEngine()
    await engine.negotiate('aave-rates')
    expect(engine.getNegotiations()).toHaveLength(1)
  })

  it('negotiation log has required fields', async () => {
    const engine = makeEngine()
    await engine.negotiate('aave-rates')
    const n = engine.getNegotiations()[0]
    expect(n).toHaveProperty('service')
    expect(n).toHaveProperty('providers')
    expect(n).toHaveProperty('chosen')
    expect(n).toHaveProperty('chosenPrice')
    expect(n).toHaveProperty('savedVsWorst')
    expect(n).toHaveProperty('timestamp')
  })

  it('savedVsWorst is positive', async () => {
    const engine = makeEngine()
    await engine.negotiate('aave-rates')
    const n = engine.getNegotiations()[0]
    expect(parseFloat(n.savedVsWorst)).toBeGreaterThan(0)
  })
})

describe('getTotalSaved()', () => {
  it('starts at 0.000000', () => {
    const engine = makeEngine()
    expect(engine.getTotalSaved()).toBe('0.000000')
  })

  it('accumulates savings across negotiations', async () => {
    const engine = makeEngine()
    await engine.negotiate('aave-rates')
    await engine.negotiate('financial-report')
    const saved = parseFloat(engine.getTotalSaved())
    expect(saved).toBeGreaterThan(0)
  })

  it('getNegotiations returns copy not reference', async () => {
    const engine = makeEngine()
    await engine.negotiate('aave-rates')
    const n1 = engine.getNegotiations()
    const n2 = engine.getNegotiations()
    expect(n1).not.toBe(n2)
  })
})

describe('probePrice()', () => {
  it('returns price for known v1 URL', async () => {
    const engine = makeEngine()
    const price  = await engine.probePrice('http://localhost:4021/api/aave-rates')
    expect(price).toBe('0.003000')
  })

  it('returns price for known v2 URL', async () => {
    const engine = makeEngine()
    const price  = await engine.probePrice('http://localhost:4021/api/v2/aave-rates')
    expect(price).toBe('0.004500')
  })

  it('returns null for unknown URL', async () => {
    const engine = makeEngine()
    const price  = await engine.probePrice('http://localhost:9999/unknown')
    expect(price).toBeNull()
  })
})
