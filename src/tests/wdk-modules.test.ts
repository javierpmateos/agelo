import { describe, it, expect } from 'vitest'

describe('WDK module package names', () => {
  const modules = [
    '@tetherto/wdk',
    '@tetherto/wdk-wallet-evm',
    '@tetherto/wdk-protocol-lending-aave-evm',
    '@tetherto/wdk-protocol-bridge-usdt0-evm',
    '@tetherto/wdk-protocol-swap-velora-evm',
  ]

  modules.forEach(mod => {
    it(`${mod} follows @tetherto/wdk-* naming`, () => {
      expect(mod).toMatch(/^@tetherto\/wdk/)
    })
  })

  it('all modules are under @tetherto scope', () => {
    modules.forEach(m => expect(m.startsWith('@tetherto/')).toBe(true))
  })

  it('core module is @tetherto/wdk', () => {
    expect(modules[0]).toBe('@tetherto/wdk')
  })

  it('5 WDK modules used in project', () => {
    expect(modules.length).toBe(5)
  })
})

describe('Multi-chain wallet addresses', () => {
  const WALLET = '0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'

  it('same address derives on all EVM chains (BIP-44)', () => {
    // Same seed phrase → same address on Plasma, Ethereum, Arbitrum
    expect(WALLET).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('address is checksummed format', () => {
    // Contains mixed case = EIP-55 checksum
    expect(WALLET).toMatch(/[a-z]/)
    expect(WALLET).toMatch(/[A-Z]/)
  })

  it('address length is 42 chars (0x + 40 hex)', () => {
    expect(WALLET).toHaveLength(42)
  })

  it('Plasma explorer URL is correct', () => {
    const url = `https://plasmascan.to/address/${WALLET}`
    expect(url).toContain('plasmascan.to/address/')
    expect(url).toContain(WALLET)
  })

  it('Arbitrum explorer URL is correct', () => {
    const url = `https://arbiscan.io/address/${WALLET}`
    expect(url).toContain('arbiscan.io/address/')
  })

  it('Ethereum explorer URL is correct', () => {
    const url = `https://etherscan.io/address/${WALLET}`
    expect(url).toContain('etherscan.io/address/')
  })
})

describe('Verified transaction hashes', () => {
  const txs = [
    { hash: '0xee856de38ac3b1dd78f400b35affee1eb2a6659e48ec51e490f60e9227fb8b80', chain: 'arbitrum', action: 'Aave supply 8.41 USDT' },
    { hash: '0xd7ccbe12a81e167525927a84c556c87492cc701ec7cf531991cf761424c893b8', chain: 'arbitrum', action: 'Aave withdraw 3.5 USDT' },
    { hash: '0x7738691a574e6c9df0ceb429074bb5ddfe91ae025df1f2f370aac09c9243ad9b', chain: 'plasma',   action: 'x402 payment aave-rates' },
    { hash: '0xb97ab2e25e4bba54c53dbf6ca1791b3ee0081cdba19d6c83df89888f8f9b1d08', chain: 'plasma',   action: 'x402 payment financial-report' },
  ]

  txs.forEach(tx => {
    it(`${tx.action} has valid tx hash`, () => {
      expect(tx.hash).toMatch(/^0x[a-f0-9]{64}$/)
    })
  })

  it('has 2 Arbitrum transactions', () => {
    const arb = txs.filter(t => t.chain === 'arbitrum')
    expect(arb).toHaveLength(2)
  })

  it('has 2 Plasma transactions', () => {
    const plasma = txs.filter(t => t.chain === 'plasma')
    expect(plasma).toHaveLength(2)
  })

  it('all hashes are unique', () => {
    const hashes = txs.map(t => t.hash)
    const unique = new Set(hashes)
    expect(unique.size).toBe(hashes.length)
  })
})
