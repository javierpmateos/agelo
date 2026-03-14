import { describe, it, expect, vi } from 'vitest'
import { AAVE_ASSETS, getAaveApys } from '../services/lending.js'

vi.mock('@tetherto/wdk-protocol-lending-aave-evm', () => ({ default: vi.fn() }))
vi.mock('../wallet/wdk-setup.js', () => ({
  getArbAccount: vi.fn().mockResolvedValue({
    getAddress: vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
    approve:     vi.fn().mockResolvedValue({ hash: '0xmock' }),
  }),
}))

describe('Aave APY rates', () => {
  it('returns USDT supply APY', async () => {
    const apys = await getAaveApys()
    expect(apys.USDT).toBeDefined()
    expect(apys.USDT.supplyApy).toMatch(/%$/)
  })

  it('returns USDC supply APY', async () => {
    const apys = await getAaveApys()
    expect(apys.USDC).toBeDefined()
  })

  it('supply APY is higher than 0%', async () => {
    const apys = await getAaveApys()
    const apy = parseFloat(apys.USDT.supplyApy)
    expect(apy).toBeGreaterThan(0)
  })

  it('borrow APY is higher than supply APY', async () => {
    const apys = await getAaveApys()
    const supply = parseFloat(apys.USDT.supplyApy)
    const borrow = parseFloat(apys.USDT.borrowApy)
    expect(borrow).toBeGreaterThan(supply)
  })
})

describe('AAVE_ASSETS addresses', () => {
  it('USDT address is valid hex', () => {
    expect(AAVE_ASSETS.USDT).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('USDC address is valid hex', () => {
    expect(AAVE_ASSETS.USDC).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('USDT and USDC addresses are different', () => {
    expect(AAVE_ASSETS.USDT).not.toBe(AAVE_ASSETS.USDC)
  })
})
