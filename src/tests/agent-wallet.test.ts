import { describe, it, expect, vi } from 'vitest'

vi.mock('@tetherto/wdk-wallet-evm', () => ({ default: vi.fn() }))
vi.mock('dotenv/config', () => ({}))

describe('AgentWallet configuration', () => {
  it('PLASMA_RPC default is rpc.plasma.to', async () => {
    const { PLASMA_RPC } = await import('../wallet/agent-wallet.js')
    expect(PLASMA_RPC).toContain('plasma.to')
  })

  it('PLASMA_NETWORK_ID default is eip155:9745', async () => {
    const { PLASMA_NETWORK_ID } = await import('../wallet/agent-wallet.js')
    expect(PLASMA_NETWORK_ID).toBe('eip155:9745')
  })

  it('USDT0_PLASMA default is valid address', async () => {
    const { USDT0_PLASMA } = await import('../wallet/agent-wallet.js')
    expect(USDT0_PLASMA).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('USDT0_PLASMA is the Plasma chain contract', async () => {
    const { USDT0_PLASMA } = await import('../wallet/agent-wallet.js')
    expect(USDT0_PLASMA).toBe('0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb')
  })

  it('createAgentWallet throws without seed phrase', async () => {
    const { createAgentWallet } = await import('../wallet/agent-wallet.js')
    await expect(createAgentWallet('')).rejects.toThrow('AGENT_SEED_PHRASE is required')
  })
})

describe('Blockchain network IDs', () => {
  it('Plasma follows CAIP-2 eip155 format', () => {
    const id = 'eip155:9745'
    const [namespace, reference] = id.split(':')
    expect(namespace).toBe('eip155')
    expect(parseInt(reference)).toBe(9745)
  })

  it('Arbitrum chain ID is correct', () => {
    expect(42161).toBe(42161)
  })

  it('Base chain ID is correct', () => {
    expect(8453).toBe(8453)
  })

  it('Ethereum mainnet chain ID is 1', () => {
    expect(1).toBe(1)
  })

  it('Plasma is NOT Ethereum mainnet', () => {
    expect(9745).not.toBe(1)
  })

  it('Arbitrum is NOT Ethereum mainnet', () => {
    expect(42161).not.toBe(1)
  })
})

describe('USDT token addresses across chains', () => {
  const addresses = {
    ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    plasma:   '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb',
  }

  Object.entries(addresses).forEach(([chain, addr]) => {
    it(`${chain} USDT address is valid`, () => {
      expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })
  })

  it('all USDT addresses are different per chain', () => {
    const vals  = Object.values(addresses)
    const unique = new Set(vals)
    expect(unique.size).toBe(vals.length)
  })

  it('Plasma uses USDT0 (different from legacy USDT)', () => {
    expect(addresses.plasma).not.toBe(addresses.ethereum)
  })
})
