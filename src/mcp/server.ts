#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { getAgentAddress, getUSDT0Balance, getBaseWalletInfo } from "../wallet/agent-wallet.js"
import { getAavePosition, getAaveApys, supplyToAave, withdrawFromAave } from "../services/lending.js"
import * as dotenv from "dotenv"
dotenv.config()

const TOOLS = [
  { name: "agelo_wallet_info",    description: "Get Plasma wallet address and USDT0 balance",          inputSchema: { type: "object", properties: {} } },
  { name: "agelo_base_wallet",    description: "Get Arbitrum wallet address, ETH and USDT balance",        inputSchema: { type: "object", properties: {} } },
  { name: "agelo_aave_rates",     description: "Get Aave V3 supply/borrow APY rates on Arbitrum",         inputSchema: { type: "object", properties: {} } },
  { name: "agelo_aave_position",  description: "Get current Aave V3 lending position",                inputSchema: { type: "object", properties: {} } },
  { name: "agelo_supply_aave",    description: "Supply USDT to Aave V3 on Arbitrum to earn yield",
    inputSchema: { type: "object", properties: { asset: { type: "string", enum: ["USDC","USDT"] }, amount: { type: "string" } }, required: ["asset","amount"] } },
  { name: "agelo_withdraw_aave",  description: "Withdraw from Aave V3 on Arbitrum",
    inputSchema: { type: "object", properties: { asset: { type: "string", enum: ["USDC","USDT"] }, amount: { type: "string" } }, required: ["asset","amount"] } }
]

const server = new Server({ name: "agelo", version: "2.0.0" }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  try {
    switch (name) {
      case "agelo_wallet_info": {
        const address = await getAgentAddress()
        const balance = await getUSDT0Balance(address)
        return { content: [{ type: "text", text: JSON.stringify({ address, balance: balance + " USDT0", chain: "Plasma", explorer: "https://plasmascan.to/address/" + address }, null, 2) }] }
      }
      case "agelo_base_wallet": {
        const info = await getBaseWalletInfo()
        return { content: [{ type: "text", text: JSON.stringify({ ...info, chain: "Arbitrum", explorer: "https://arbiscan.io/address/" + info.address }, null, 2) }] }
      }
      case "agelo_aave_rates": {
        const rates = await getAaveApys()
        return { content: [{ type: "text", text: JSON.stringify({ protocol: "Aave V3", chain: "Arbitrum", rates }, null, 2) }] }
      }
      case "agelo_aave_position": {
        const position = await getAavePosition()
        return { content: [{ type: "text", text: JSON.stringify(position || { message: "No active position" }, null, 2) }] }
      }
      case "agelo_supply_aave": {
        const { asset, amount } = args as any
        const result = await supplyToAave(asset, amount)
        return { content: [{ type: "text", text: JSON.stringify({ success: true, tx: result.hash }, null, 2) }] }
      }
      case "agelo_withdraw_aave": {
        const { asset, amount } = args as any
        const result = await withdrawFromAave(asset, amount)
        return { content: [{ type: "text", text: JSON.stringify({ success: true, tx: result.hash }, null, 2) }] }
      }
      default: throw new Error("Unknown tool: " + name)
    }
  } catch (err: any) {
    return { content: [{ type: "text", text: "Error: " + err.message }], isError: true }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Agelo MCP Server v2.0 running")
}
main().catch(console.error)
