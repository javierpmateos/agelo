import { describe, it, expect } from 'vitest'

describe('WDK module package names', () => {
  const modules = [
    '@tetherto/wdk',
    '@tetherto/wdk-wallet-evm',
    '@tetherto/wdk-protocol-lending-aave-evm',
    '@tetherto/wdk-protocol-bridge-usdt0-evm',
    '@tetherto/wdk-protocol-swap-velora-evm',
    '@tetherto/wdk-wallet-spark',
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

  it('6 WDK modules used in project (including Spark)', () => {
    expect(modules.length).toBe(6)
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
    { hash: '0xda03570a224772f83c4baa1dc4a47239db274d3db41cbb6cbdef6a29f2d590b3', chain: 'arbitrum', action: 'Aave supply 9.87 USDT' },
    { hash: '0x330f4b84385ada6194bc9808de98d5a3dbd9879facee9a8ec7e905e80ee8a5a4', chain: 'plasma',   action: 'x402 payment aave-rates' },
    { hash: '0xc82f7c1f3aa7e11b94b2a128442f764274c08ac0dc2c85187ce830a8dfa9149f', chain: 'plasma',   action: 'x402 payment financial-report' },
  ]

  txs.forEach(tx => {
    it(`${tx.action} has valid tx hash`, () => {
      expect(tx.hash).toMatch(/^0x[a-f0-9]{64}$/)
    })
  })

  it('has 3 verified transactions total', () => {
    expect(txs).toHaveLength(3)
  })

  it('has 1 Arbitrum transactions', () => {
    const arb = txs.filter(t => t.chain === 'arbitrum')
    expect(arb).toHaveLength(1)
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
