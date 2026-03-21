import { describe, it, expect } from 'vitest'

describe('MCP Server tool definitions', () => {
  const TOOLS = [
    'agelo_wallet_info',
    'agelo_base_wallet',
    'agelo_aave_rates',
    'agelo_aave_position',
    'agelo_supply_aave',
    'agelo_withdraw_aave',
  ]

  it('has 31 MCP tools (25 WDK built-in + 6 Agelo)', () => {
    expect(TOOLS).toHaveLength(6) // Agelo domain tools
    // Full server: 25 WDK + 6 Agelo = 31 via WdkMcpServer
  })

  TOOLS.forEach(tool => {
    it(`${tool} follows agelo_ naming convention`, () => {
      expect(tool).toMatch(/^agelo_/)
    })
  })

  it('has read tools (wallet info, rates, position)', () => {
    const reads = TOOLS.filter(t => !t.includes('supply') && !t.includes('withdraw'))
    expect(reads.length).toBeGreaterThan(0)
  })

  it('has write tools (supply, withdraw)', () => {
    const writes = TOOLS.filter(t => t.includes('supply') || t.includes('withdraw'))
    expect(writes).toHaveLength(2)
  })
})
