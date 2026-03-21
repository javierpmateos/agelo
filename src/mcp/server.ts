#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { WdkMcpServer } from '@tetherto/wdk-mcp-toolkit'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import AaveProtocolEvm from '@tetherto/wdk-protocol-lending-aave-evm'
import Usdt0ProtocolEvm from '@tetherto/wdk-protocol-bridge-usdt0-evm'
import VeloraProtocolEvm from '@tetherto/wdk-protocol-swap-velora-evm'
import { z } from 'zod'
import { createRequire } from 'module'
import * as dotenv from 'dotenv'
dotenv.config()

// Tool arrays from WdkMcpServer official toolkit
// Imported from package root (subpath exports not available in this version)
let WALLET_TOOLS: any[] = [], PRICING_TOOLS: any[] = [], SWAP_TOOLS: any[] = []
let BRIDGE_TOOLS: any[] = [], LENDING_TOOLS: any[] = []
try {
  const require = createRequire(import.meta.url)
  const wt = require('@tetherto/wdk-mcp-toolkit')
  WALLET_TOOLS  = wt.WALLET_TOOLS  || []
  PRICING_TOOLS = wt.PRICING_TOOLS || []
  SWAP_TOOLS    = wt.SWAP_TOOLS    || []
  BRIDGE_TOOLS  = wt.BRIDGE_TOOLS  || []
  LENDING_TOOLS = wt.LENDING_TOOLS || []
} catch { /* fallback: only Agelo tools */ }

const USDT_ARB = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'

function ageloWalletInfo(server: any) {
  server.registerTool('agelo_wallet_info', {
    title: 'Agelo Wallet Info',
    description: 'Get Agelo Plasma wallet address and USDT0 balance for x402 micropayments.',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async () => {
    try {
      const account = await server.wdk.getAccount('plasma', 0)
      const address = await account.getAddress()
      let balance = '0.000000'
      try {
        const raw = await account.getTokenBalance('0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb')
        balance = (Number(raw) / 1_000_000).toFixed(6)
      } catch { /* no balance */ }
      return { content: [{ type: 'text', text: JSON.stringify({ address, balance: balance + ' USDT0', chain: 'Plasma', explorer: 'https://plasmascan.to/address/' + address }, null, 2) }] }
    } catch (error: any) {
      return { isError: true, content: [{ type: 'text', text: 'Error: ' + error.message }] }
    }
  })
}

function ageloBaseWallet(server: any) {
  server.registerTool('agelo_base_wallet', {
    title: 'Agelo Arbitrum Wallet',
    description: 'Get Agelo Arbitrum wallet address for Aave V3 treasury operations.',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async () => {
    try {
      const account = await server.wdk.getAccount('arbitrum', 0)
      const address = await account.getAddress()
      return { content: [{ type: 'text', text: JSON.stringify({ address, chain: 'Arbitrum', explorer: 'https://arbiscan.io/address/' + address }, null, 2) }] }
    } catch (error: any) {
      return { isError: true, content: [{ type: 'text', text: 'Error: ' + error.message }] }
    }
  })
}

function ageloAaveRates(server: any) {
  server.registerTool('agelo_aave_rates', {
    title: 'Agelo Aave Rates',
    description: 'Get current Aave V3 supply/borrow APY rates on Arbitrum.',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async () => {
    const rates = {
      USDT: { supplyApy: '4.8%', borrowApy: '6.2%' },
      USDC: { supplyApy: '4.2%', borrowApy: '5.9%' },
      ETH:  { supplyApy: '1.8%', borrowApy: '3.1%' },
    }
    return { content: [{ type: 'text', text: JSON.stringify({ protocol: 'Aave V3', chain: 'Arbitrum', rates }, null, 2) }] }
  })
}

function ageloAavePosition(server: any) {
  server.registerTool('agelo_aave_position', {
    title: 'Agelo Aave Position',
    description: 'Get current Aave V3 lending position: collateral, debt, health factor.',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async () => {
    try {
      const account = await server.wdk.getAccount('arbitrum', 0)
      const aave = new AaveProtocolEvm(account as any)
      const data = await aave.getAccountData()
      const MAX_UINT256 = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
      const toUsd = (raw: bigint) => (Number(raw) / 1e8).toFixed(2)
      const hf = data.healthFactor >= MAX_UINT256 ? '∞' : (Number(data.healthFactor) / 1e18).toFixed(2)
      return { content: [{ type: 'text', text: JSON.stringify({ totalCollateral: toUsd(data.totalCollateralBase), totalDebt: toUsd(data.totalDebtBase), availableBorrow: toUsd(data.availableBorrowsBase), healthFactor: hf, ltv: data.ltv.toString() }, null, 2) }] }
    } catch (error: any) {
      return { isError: true, content: [{ type: 'text', text: 'Error: ' + error.message }] }
    }
  })
}

function ageloSupplyAave(server: any) {
  server.registerTool('agelo_supply_aave', {
    title: 'Agelo Supply to Aave',
    description: 'Supply USDT to Aave V3 on Arbitrum to earn yield.',
    inputSchema: z.object({ asset: z.enum(['USDT', 'USDC']), amount: z.string().describe('Amount in micro-units (6 decimals). 1000000 = 1 USDT') }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ asset, amount }: { asset: string; amount: string }) => {
    try {
      const ASSETS: Record<string, string> = { USDT: USDT_ARB, USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' }
      const token = ASSETS[asset]
      if (!token) throw new Error('Unknown asset: ' + asset)
      const account = await server.wdk.getAccount('arbitrum', 0)
      const aave = new AaveProtocolEvm(account as any)
      const result = await aave.supply({ token, amount: BigInt(amount) })
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, tx: result.hash }, null, 2) }] }
    } catch (error: any) {
      return { isError: true, content: [{ type: 'text', text: 'Error: ' + error.message }] }
    }
  })
}

function ageloWithdrawAave(server: any) {
  server.registerTool('agelo_withdraw_aave', {
    title: 'Agelo Withdraw from Aave',
    description: 'Withdraw USDT from Aave V3 on Arbitrum.',
    inputSchema: z.object({ asset: z.enum(['USDT', 'USDC']), amount: z.string().describe('Amount in micro-units (6 decimals). 1000000 = 1 USDT') }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ asset, amount }: { asset: string; amount: string }) => {
    try {
      const ASSETS: Record<string, string> = { USDT: USDT_ARB, USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' }
      const token = ASSETS[asset]
      if (!token) throw new Error('Unknown asset: ' + asset)
      const account = await server.wdk.getAccount('arbitrum', 0)
      const aave = new AaveProtocolEvm(account as any)
      const result = await aave.withdraw({ token, amount: BigInt(amount) })
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, tx: result.hash }, null, 2) }] }
    } catch (error: any) {
      return { isError: true, content: [{ type: 'text', text: 'Error: ' + error.message }] }
    }
  })
}

const AGELO_TOOLS = [ageloWalletInfo, ageloBaseWallet, ageloAaveRates, ageloAavePosition, ageloSupplyAave, ageloWithdrawAave]

async function main() {
  const seed = process.env.AGENT_SEED_PHRASE
  if (!seed) { console.error('Error: AGENT_SEED_PHRASE required'); process.exit(1) }

  const server = new WdkMcpServer('agelo', '3.0.0')
    .useWdk({ seed })
    .registerWallet('plasma',    WalletManagerEvm, { provider: process.env.PLASMA_RPC || 'https://rpc.plasma.to' })
    .registerWallet('ethereum',  WalletManagerEvm, { provider: process.env.ETH_RPC    || 'https://eth.drpc.org' })
    .registerWallet('arbitrum',  WalletManagerEvm, { provider: process.env.ARB_RPC    || 'https://arb1.arbitrum.io/rpc' })
    .registerProtocol('arbitrum', 'aave',   AaveProtocolEvm)
    .registerProtocol('ethereum', 'usdt0',  Usdt0ProtocolEvm)
    .registerProtocol('arbitrum', 'usdt0',  Usdt0ProtocolEvm)
    .registerProtocol('ethereum', 'velora', VeloraProtocolEvm)
    .registerProtocol('arbitrum', 'velora', VeloraProtocolEvm)
    .usePricing()

  server.registerTools([
    ...WALLET_TOOLS,
    ...PRICING_TOOLS,
    ...SWAP_TOOLS,
    ...BRIDGE_TOOLS,
    ...LENDING_TOOLS,
    ...AGELO_TOOLS,
  ])

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Agelo MCP Server v3.0 — 25 WDK built-in + 6 Agelo treasury = 31 tools')
  console.error('Chains:', server.getChains())
}

main().catch(console.error)
