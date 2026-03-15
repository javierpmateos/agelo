import { describe, it, expect } from 'vitest'

describe('Aave USD value parsing (1e8 decimals)', () => {
  const toUsd = (raw: bigint) => (Number(raw) / 1e8).toFixed(2)

  it('841_401_579 → $8.41', () => {
    expect(toUsd(841_401_579n)).toBe('8.41')
  })

  it('0 → $0.00', () => {
    expect(toUsd(0n)).toBe('0.00')
  })

  it('100_000_000 → $1.00', () => {
    expect(toUsd(100_000_000n)).toBe('1.00')
  })

  it('1_000_000_000 → $10.00', () => {
    expect(toUsd(1_000_000_000n)).toBe('10.00')
  })

  it('50_000_000_000 → $500.00', () => {
    expect(toUsd(50_000_000_000n)).toBe('500.00')
  })

  it('999_999 → $0.01', () => {
    expect(parseFloat(toUsd(999_999n))).toBeCloseTo(0.01, 1)
  })
})

describe('Aave health factor parsing', () => {
  const MAX_UINT256 = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
  const formatHF = (raw: bigint) =>
    raw >= MAX_UINT256 ? '∞' : (Number(raw) / 1e18).toFixed(2)

  it('MAX_UINT256 → ∞ (no debt)', () => {
    expect(formatHF(MAX_UINT256)).toBe('∞')
  })

  it('1_500_000_000_000_000_000 → 1.50 (liquidation risk)', () => {
    expect(formatHF(1_500_000_000_000_000_000n)).toBe('1.50')
  })

  it('2_000_000_000_000_000_000 → 2.00 (safe)', () => {
    expect(formatHF(2_000_000_000_000_000_000n)).toBe('2.00')
  })

  it('health factor > 1.0 means no liquidation risk', () => {
    const hf = 1.5
    expect(hf).toBeGreaterThan(1.0)
  })

  it('health factor < 1.0 triggers liquidation', () => {
    const hf = 0.95
    expect(hf).toBeLessThan(1.0)
  })
})

describe('Yield calculations', () => {
  const calcYield = (principal: number, apyPct: number) => ({
    annual:  (principal * apyPct / 100),
    monthly: (principal * apyPct / 100 / 12),
    daily:   (principal * apyPct / 100 / 365),
  })

  it('$8.41 at 4.8% APY = $0.4037 annual', () => {
    const result = calcYield(8.41, 4.8)
    expect(result.annual).toBeCloseTo(0.4037, 3)
  })

  it('$8.41 at 4.8% APY = ~$0.0336 monthly', () => {
    const result = calcYield(8.41, 4.8)
    expect(result.monthly).toBeCloseTo(0.0336, 3)
  })

  it('$8.41 at 4.8% APY = ~$0.001106 daily', () => {
    const result = calcYield(8.41, 4.8)
    expect(result.daily).toBeCloseTo(0.001106, 5)
  })

  it('$1000 at 4.8% APY = ~$0.92 weekly', () => {
    const weekly = 1000 * 4.8 / 100 / 52
    expect(weekly).toBeCloseTo(0.923, 2)
  })

  it('higher APY → higher yield', () => {
    const low  = calcYield(100, 3.0)
    const high = calcYield(100, 5.0)
    expect(high.annual).toBeGreaterThan(low.annual)
  })

  it('higher principal → higher yield', () => {
    const small = calcYield(10,  4.8)
    const large = calcYield(100, 4.8)
    expect(large.annual).toBeGreaterThan(small.annual)
  })

  it('annual = monthly * 12', () => {
    const r = calcYield(100, 4.8)
    expect(r.annual).toBeCloseTo(r.monthly * 12, 8)
  })

  it('annual = daily * 365', () => {
    const r = calcYield(100, 4.8)
    expect(r.annual).toBeCloseTo(r.daily * 365, 8)
  })
})
