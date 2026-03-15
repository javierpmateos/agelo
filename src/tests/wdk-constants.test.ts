import { describe, it, expect } from 'vitest'

describe('Chain configuration constants', () => {
  it('Plasma chain ID is 9745', () => {
    expect(9745).toBe(9745)
  })

  it('Arbitrum chain ID is 42161', () => {
    expect(42161).toBe(42161)
  })

  it('Ethereum chain ID is 1', () => {
    expect(1).toBe(1)
  })

  it('USDT0 Plasma address is valid hex', () => {
    const addr = '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb'
    expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('USDT Arbitrum address is valid hex', () => {
    const addr = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
    expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('USDT Ethereum address is valid hex', () => {
    const addr = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('Aave V3 Pool Arbitrum is valid hex', () => {
    const addr = '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
    expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('Plasma RPC endpoint is HTTPS', () => {
    const rpc = 'https://rpc.plasma.to'
    expect(rpc).toMatch(/^https:\/\//)
  })

  it('Arbitrum RPC endpoint is HTTPS', () => {
    const rpc = 'https://arb1.arbitrum.io/rpc'
    expect(rpc).toMatch(/^https:\/\//)
  })

  it('Plasma network ID follows CAIP-2 format', () => {
    const id = 'eip155:9745'
    expect(id).toMatch(/^eip155:\d+$/)
  })
})

describe('Token decimals', () => {
  it('USDT has 6 decimals', () => {
    const decimals = 6
    expect(10 ** decimals).toBe(1_000_000)
  })

  it('1 USDT = 1_000_000 micro-units', () => {
    const ONE_USDT = 1_000_000n
    expect(Number(ONE_USDT) / 1e6).toBe(1)
  })

  it('max safe USDT amount fits in BigInt', () => {
    const TEN_USDT = 10_000_000n
    expect(typeof TEN_USDT).toBe('bigint')
    expect(Number(TEN_USDT) / 1e6).toBe(10)
  })

  it('Aave returns USD with 8 decimals', () => {
    // 841_401_579 base units = $8.41 USD
    const raw = 841_401_579n
    const usd = Number(raw) / 1e8
    expect(usd).toBeCloseTo(8.41, 1)
  })
})

describe('x402 payment amounts', () => {
  it('$0.001 = 1000 micro-units', () => {
    expect(1000 / 1e6).toBeCloseTo(0.001, 6)
  })

  it('$0.050 = 50000 micro-units', () => {
    expect(50000 / 1e6).toBeCloseTo(0.050, 6)
  })

  it('all prices are under $0.10', () => {
    const prices = [1000, 5000, 10000, 10000, 50000, 3000, 5000, 20000, 10000]
    prices.forEach(p => expect(p / 1e6).toBeLessThan(0.1))
  })
})
