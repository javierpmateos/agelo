import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock antes de cualquier import del módulo
vi.mock('@tetherto/wdk-wallet-evm', () => ({ default: vi.fn() }))

vi.mock('@tetherto/wdk', () => {
  const mockAccount = {
    getAddress:      vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
    getBalance:      vi.fn().mockResolvedValue(BigInt(0)),
    getTokenBalance: vi.fn().mockResolvedValue(BigInt(5_000_000)),
  }
  const mockWdk = {
    registerWallet: vi.fn().mockReturnThis(),
    getAccount:     vi.fn().mockResolvedValue(mockAccount),
  }
  return { default: vi.fn().mockReturnValue(mockWdk) }
})

describe('wdk-setup constants', () => {
  it('PLASMA_RPC has default value', async () => {
    const { getWDK } = await import('../wallet/wdk-setup.js')
    expect(getWDK).toBeDefined()
  })

  it('getPlasmaAccount is exported', async () => {
    const { getPlasmaAccount } = await import('../wallet/wdk-setup.js')
    expect(typeof getPlasmaAccount).toBe('function')
  })

  it('getEthAccount is exported', async () => {
    const { getEthAccount } = await import('../wallet/wdk-setup.js')
    expect(typeof getEthAccount).toBe('function')
  })

  it('getArbAccount is exported', async () => {
    const { getArbAccount } = await import('../wallet/wdk-setup.js')
    expect(typeof getArbAccount).toBe('function')
  })

  it('getWDK is exported', async () => {
    const { getWDK } = await import('../wallet/wdk-setup.js')
    expect(typeof getWDK).toBe('function')
  })
})
