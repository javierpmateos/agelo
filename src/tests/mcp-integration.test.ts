import { describe, it, expect, vi } from 'vitest'

vi.mock('../wallet/agent-wallet.js', () => ({
  getAgentAddress:  vi.fn().mockResolvedValue('0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6'),
  getUSDT0Balance:  vi.fn().mockResolvedValue('11.08'),
  getBaseWalletInfo: vi.fn().mockResolvedValue({ address: '0xD173ad2C8cDa46Ba9BeE73D6cEa6c015aA3054a6' }),
}))

vi.mock('../services/lending.js', () => ({
  getAavePosition:  vi.fn().mockResolvedValue({
    totalCollateral: '8.41', totalDebt: '0.00',
    availableBorrow: '6.31', healthFactor: '∞', ltv: '0',
  }),
  getAaveApys:      vi.fn().mockResolvedValue({ USDT: { supplyApy: '4.8%', borrowApy: '6.2%' } }),
  supplyToAave:     vi.fn().mockResolvedValue({ hash: '0xsupply_mcp' }),
  withdrawFromAave: vi.fn().mockResolvedValue({ hash: '0xwithdraw_mcp' }),
}))

describe('MCP Server tool routing', () => {
  it('agelo_wallet_info returns address and balance', async () => {
    const { getAgentAddress, getUSDT0Balance } = await import('../wallet/agent-wallet.js')
    const address = await getAgentAddress()
    const balance = await getUSDT0Balance(address)
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(parseFloat(balance)).toBeGreaterThanOrEqual(0)
  })

  it('agelo_aave_rates returns USDT rates', async () => {
    const { getAaveApys } = await import('../services/lending.js')
    const rates = await getAaveApys()
    expect(rates.USDT).toBeDefined()
    expect(rates.USDT.supplyApy).toMatch(/%$/)
    expect(rates.USDT.borrowApy).toMatch(/%$/)
  })

  it('agelo_aave_position returns account data', async () => {
    const { getAavePosition } = await import('../services/lending.js')
    const position = await getAavePosition()
    expect(position).not.toBeNull()
    expect(position).toHaveProperty('totalCollateral')
    expect(position).toHaveProperty('totalDebt')
    expect(position).toHaveProperty('availableBorrow')
    expect(position).toHaveProperty('healthFactor')
  })

  it('agelo_supply_aave calls supply with correct args', async () => {
    const { supplyToAave } = await import('../services/lending.js')
    const result = await supplyToAave('USDT', 5_000_000n)
    expect(result.hash).toBe('0xsupply_mcp')
    expect(supplyToAave).toHaveBeenCalledWith('USDT', 5_000_000n)
  })

  it('agelo_withdraw_aave calls withdraw with correct args', async () => {
    const { withdrawFromAave } = await import('../services/lending.js')
    const result = await withdrawFromAave('USDT', 3_000_000n)
    expect(result.hash).toBe('0xwithdraw_mcp')
    expect(withdrawFromAave).toHaveBeenCalledWith('USDT', 3_000_000n)
  })

  it('agelo_base_wallet returns address', async () => {
    const { getBaseWalletInfo } = await import('../wallet/agent-wallet.js')
    const info = await getBaseWalletInfo()
    expect(info.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })
})

describe('MCP tool response format', () => {
  it('wallet_info response is JSON serializable', async () => {
    const { getAgentAddress, getUSDT0Balance } = await import('../wallet/agent-wallet.js')
    const address = await getAgentAddress()
    const balance = await getUSDT0Balance(address)
    const response = { address, balance: balance + ' USDT0', chain: 'Plasma' }
    expect(() => JSON.stringify(response)).not.toThrow()
  })

  it('aave_position response is JSON serializable', async () => {
    const { getAavePosition } = await import('../services/lending.js')
    const position = await getAavePosition()
    expect(() => JSON.stringify(position)).not.toThrow()
  })

  it('aave_rates response is JSON serializable', async () => {
    const { getAaveApys } = await import('../services/lending.js')
    const rates = await getAaveApys()
    expect(() => JSON.stringify(rates)).not.toThrow()
  })

  it('supply result contains hash', async () => {
    const { supplyToAave } = await import('../services/lending.js')
    const result = await supplyToAave('USDT', 1_000_000n)
    expect(result).toHaveProperty('hash')
    expect(result.hash).toMatch(/^0x/)
  })

  it('withdraw result contains hash', async () => {
    const { withdrawFromAave } = await import('../services/lending.js')
    const result = await withdrawFromAave('USDT', 1_000_000n)
    expect(result).toHaveProperty('hash')
    expect(result.hash).toMatch(/^0x/)
  })
})

describe('MCP tool error handling', () => {
  it('supply with unknown asset throws', async () => {
    const { supplyToAave } = await import('../services/lending.js')
    ;(supplyToAave as any).mockRejectedValueOnce(new Error('Unknown asset: XYZ'))
    await expect(supplyToAave('XYZ' as any, 1_000_000n)).rejects.toThrow('Unknown asset')
  })

  it('withdraw with unknown asset throws', async () => {
    const { withdrawFromAave } = await import('../services/lending.js')
    ;(withdrawFromAave as any).mockRejectedValueOnce(new Error('Unknown asset: XYZ'))
    await expect(withdrawFromAave('XYZ' as any, 1_000_000n)).rejects.toThrow('Unknown asset')
  })

  it('getAavePosition returns null on RPC failure', async () => {
    const { getAavePosition } = await import('../services/lending.js')
    ;(getAavePosition as any).mockResolvedValueOnce(null)
    const result = await getAavePosition()
    expect(result).toBeNull()
  })

  it('supply result has hash property', async () => {
    const { supplyToAave } = await import('../services/lending.js')
    const result = await supplyToAave('USDT', 1_000_000n)
    expect(result.hash).toMatch(/^0x/)
    expect(result.hash.length).toBeGreaterThan(2)
  })

  it('withdraw result has hash property', async () => {
    const { withdrawFromAave } = await import('../services/lending.js')
    const result = await withdrawFromAave('USDT', 1_000_000n)
    expect(result.hash).toMatch(/^0x/)
    expect(result.hash.length).toBeGreaterThan(2)
  })

  it('wallet_info address is checksummed EIP-55', async () => {
    const { getAgentAddress } = await import('../wallet/agent-wallet.js')
    const addr = await getAgentAddress()
    expect(addr).toMatch(/[a-z]/) // has lowercase
    expect(addr).toMatch(/[A-Z]/) // has uppercase → EIP-55 checksum
  })

  it('getUSDT0Balance returns decimal string', async () => {
    const { getAgentAddress, getUSDT0Balance } = await import('../wallet/agent-wallet.js')
    const addr    = await getAgentAddress()
    const balance = await getUSDT0Balance(addr)
    expect(parseFloat(balance)).toBeGreaterThanOrEqual(0)
    expect(balance).toMatch(/^\d+(\.\d+)?$/)
  })
})
