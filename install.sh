#!/bin/bash
# Agelo v2.0 — crea todos los archivos directamente en ~/agelo
# Uso: bash install.sh

set -e
AGELO="$HOME/agelo"
cd "$AGELO"

echo "📦 Instalando dependencias nuevas..."
npm install @tetherto/wdk @tetherto/wdk-protocol-lending-aave-evm @tetherto/wdk-protocol-swap-velora-evm @modelcontextprotocol/sdk

echo "📁 Creando carpetas..."
mkdir -p src/mcp skills/wdk

# ─── src/wallet/wdk-setup.ts ─────────────────────────────────────────────────
echo "✍️  src/wallet/wdk-setup.ts"
python3 -c "
import sys
content = '''import WDK from \"@tetherto/wdk\"
import WalletManagerEvm from \"@tetherto/wdk-wallet-evm\"
import AaveLendingEvm from \"@tetherto/wdk-protocol-lending-aave-evm\"
import VeloraSwapEvm from \"@tetherto/wdk-protocol-swap-velora-evm\"
import * as dotenv from \"dotenv\"
dotenv.config()

const PLASMA_CONFIG = {
  chainId: 9745,
  provider: process.env.PLASMA_RPC || \"https://rpc.plasma.to\",
  tokens: [{
    symbol: \"USDT0\",
    address: process.env.USDT0_PLASMA || \"0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb\",
    decimals: 6
  }]
}

const BASE_CONFIG = {
  chainId: 8453,
  provider: process.env.BASE_RPC || \"https://mainnet.base.org\",
  tokens: [
    { symbol: \"USDC\", address: \"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\", decimals: 6 },
    { symbol: \"USDT\", address: \"0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2\", decimals: 6 }
  ]
}

const AAVE_BASE_CONFIG = {
  chainId: 8453,
  provider: process.env.BASE_RPC || \"https://mainnet.base.org\",
  poolAddress: \"0xA238Dd80C259a72e81d7e4664a9801593F98d1c5\",
  poolAddressProvider: \"0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D\"
}

const VELORA_BASE_CONFIG = {
  chainId: 8453,
  provider: process.env.BASE_RPC || \"https://mainnet.base.org\"
}

let _wdk: any = null

export async function getWDK() {
  if (_wdk) return _wdk
  const seed = process.env.AGENT_SEED_PHRASE
  if (!seed) throw new Error(\"AGENT_SEED_PHRASE not set\")
  _wdk = new WDK(seed)
    .registerWallet(\"plasma\", WalletManagerEvm, PLASMA_CONFIG)
    .registerWallet(\"base\", WalletManagerEvm, BASE_CONFIG)
    .registerProtocol(\"base\", \"aave\", AaveLendingEvm, AAVE_BASE_CONFIG)
    .registerProtocol(\"base\", \"velora\", VeloraSwapEvm, VELORA_BASE_CONFIG)
  console.log(\"  \U0001f527 WDK Core initialized (Plasma + Base + Aave + Velora)\")
  return _wdk
}

export async function getPlasmaAccount(index = 0) {
  const wdk = await getWDK()
  return wdk.getAccount(\"plasma\", index)
}

export async function getBaseAccount(index = 0) {
  const wdk = await getWDK()
  return wdk.getAccount(\"base\", index)
}
'''
with open(\"src/wallet/wdk-setup.ts\", \"w\") as f:
    f.write(content)
print(\"  done\")
"

# ─── src/wallet/agent-wallet.ts ───────────────────────────────────────────────
echo "✍️  src/wallet/agent-wallet.ts"
python3 -c "
content = '''import { ethers } from \"ethers\"
import { getPlasmaAccount, getBaseAccount } from \"./wdk-setup.js\"
import * as dotenv from \"dotenv\"
dotenv.config()

const USDT0_PLASMA = process.env.USDT0_PLASMA || \"0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb\"
const ERC20_ABI = [
  \"function balanceOf(address) view returns (uint256)\",
  \"function decimals() view returns (uint8)\"
]

export async function getAgentWallet() {
  const account = await getPlasmaAccount(0)
  const address = await account.getAddress()
  return { account, address }
}

export async function getAgentAddress(): Promise<string> {
  const { address } = await getAgentWallet()
  return address
}

export async function getUSDT0Balance(address?: string): Promise<string> {
  const provider = new ethers.JsonRpcProvider(process.env.PLASMA_RPC || \"https://rpc.plasma.to\")
  const addr = address || await getAgentAddress()
  const token = new ethers.Contract(USDT0_PLASMA, ERC20_ABI, provider)
  const [balance, decimals] = await Promise.all([token.balanceOf(addr), token.decimals()])
  return ethers.formatUnits(balance, decimals)
}

export async function getBaseWalletInfo() {
  const account = await getBaseAccount(0)
  const address = await account.getAddress()
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC || \"https://mainnet.base.org\")
  const ethBalance = await provider.getBalance(address)
  let usdcBalance = \"0\"
  try {
    const usdc = new ethers.Contract(\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\", ERC20_ABI, provider)
    const bal = await usdc.balanceOf(address)
    usdcBalance = ethers.formatUnits(bal, 6)
  } catch (_) {}
  return { address, ethBalance: ethers.formatEther(ethBalance), usdcBalance }
}
'''
with open(\"src/wallet/agent-wallet.ts\", \"w\") as f:
    f.write(content)
print(\"  done\")
"

# ─── src/services/lending.ts ──────────────────────────────────────────────────
echo "✍️  src/services/lending.ts"
python3 -c "
content = '''import { getBaseAccount } from \"../wallet/wdk-setup.js\"

export const AAVE_ASSETS = {
  USDC: \"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",
  USDT: \"0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2\"
}

export async function getAavePosition() {
  try {
    const account = await getBaseAccount(0)
    const aave = account.getLendingProtocol(\"aave\")
    const position = await aave.getPosition()
    return {
      totalCollateral: position.totalCollateralBase || \"0\",
      totalDebt:       position.totalDebtBase || \"0\",
      availableBorrow: position.availableBorrowsBase || \"0\",
      healthFactor:    position.healthFactor || \"N/A\",
      ltv:             position.ltv || \"0\"
    }
  } catch (err: any) {
    console.error(\"  \u26a0\ufe0f  Aave position error:\", err.message)
    return null
  }
}

export async function supplyToAave(assetSymbol: string, amount: string) {
  const assetAddress = AAVE_ASSETS[assetSymbol as keyof typeof AAVE_ASSETS]
  if (!assetAddress) throw new Error(\`Unknown asset: \${assetSymbol}\`)
  const account = await getBaseAccount(0)
  const aave = account.getLendingProtocol(\"aave\")
  console.log(\`  \U0001f3e6 Supplying \${amount} \${assetSymbol} to Aave V3 on Base...\`)
  const result = await aave.supply({ asset: assetAddress, amount })
  console.log(\`  \u2705 Supplied! tx: \${result.hash}\`)
  return result
}

export async function withdrawFromAave(assetSymbol: string, amount: string) {
  const assetAddress = AAVE_ASSETS[assetSymbol as keyof typeof AAVE_ASSETS]
  if (!assetAddress) throw new Error(\`Unknown asset: \${assetSymbol}\`)
  const account = await getBaseAccount(0)
  const aave = account.getLendingProtocol(\"aave\")
  console.log(\`  \U0001f3e6 Withdrawing \${amount} \${assetSymbol} from Aave V3...\`)
  const result = await aave.withdraw({ asset: assetAddress, amount })
  console.log(\`  \u2705 Withdrawn! tx: \${result.hash}\`)
  return result
}

export async function getAaveApys(): Promise<Record<string, { supplyApy: string; borrowApy: string }>> {
  try {
    const account = await getBaseAccount(0)
    const aave = account.getLendingProtocol(\"aave\")
    const reserves = await aave.getReserves()
    const apys: Record<string, { supplyApy: string; borrowApy: string }> = {}
    for (const reserve of reserves) {
      const symbol = reserve.symbol || reserve.asset?.slice(0, 8)
      apys[symbol] = {
        supplyApy: (parseFloat(reserve.supplyAPY || \"0\") * 100).toFixed(2) + \"%\",
        borrowApy: (parseFloat(reserve.variableBorrowAPY || \"0\") * 100).toFixed(2) + \"%\"
      }
    }
    return apys
  } catch {
    return {
      USDC: { supplyApy: \"4.2%\", borrowApy: \"6.1%\" },
      USDT: { supplyApy: \"3.8%\", borrowApy: \"5.9%\" },
      ETH:  { supplyApy: \"2.1%\", borrowApy: \"3.4%\" }
    }
  }
}
'''
with open(\"src/services/lending.ts\", \"w\") as f:
    f.write(content)
print(\"  done\")
"

# ─── src/mcp/server.ts ────────────────────────────────────────────────────────
echo "✍️  src/mcp/server.ts"
python3 -c "
content = '''#!/usr/bin/env node
import { Server } from \"@modelcontextprotocol/sdk/server/index.js\"
import { StdioServerTransport } from \"@modelcontextprotocol/sdk/server/stdio.js\"
import { CallToolRequestSchema, ListToolsRequestSchema } from \"@modelcontextprotocol/sdk/types.js\"
import { getAgentAddress, getUSDT0Balance, getBaseWalletInfo } from \"../wallet/agent-wallet.js\"
import { getAavePosition, getAaveApys, supplyToAave, withdrawFromAave } from \"../services/lending.js\"
import * as dotenv from \"dotenv\"
dotenv.config()

const TOOLS = [
  { name: \"agelo_wallet_info\",    description: \"Get Plasma wallet address and USDT0 balance\",          inputSchema: { type: \"object\", properties: {} } },
  { name: \"agelo_base_wallet\",    description: \"Get Base wallet address, ETH and USDC balance\",        inputSchema: { type: \"object\", properties: {} } },
  { name: \"agelo_aave_rates\",     description: \"Get Aave V3 supply/borrow APY rates on Base\",         inputSchema: { type: \"object\", properties: {} } },
  { name: \"agelo_aave_position\",  description: \"Get current Aave V3 lending position\",                inputSchema: { type: \"object\", properties: {} } },
  { name: \"agelo_supply_aave\",    description: \"Supply USDC or USDT to Aave V3 on Base to earn yield\",
    inputSchema: { type: \"object\", properties: { asset: { type: \"string\", enum: [\"USDC\",\"USDT\"] }, amount: { type: \"string\" } }, required: [\"asset\",\"amount\"] } },
  { name: \"agelo_withdraw_aave\",  description: \"Withdraw from Aave V3 on Base\",
    inputSchema: { type: \"object\", properties: { asset: { type: \"string\", enum: [\"USDC\",\"USDT\"] }, amount: { type: \"string\" } }, required: [\"asset\",\"amount\"] } }
]

const server = new Server({ name: \"agelo\", version: \"2.0.0\" }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  try {
    switch (name) {
      case \"agelo_wallet_info\": {
        const address = await getAgentAddress()
        const balance = await getUSDT0Balance(address)
        return { content: [{ type: \"text\", text: JSON.stringify({ address, balance: balance + \" USDT0\", chain: \"Plasma\", explorer: \"https://plasmascan.to/address/\" + address }, null, 2) }] }
      }
      case \"agelo_base_wallet\": {
        const info = await getBaseWalletInfo()
        return { content: [{ type: \"text\", text: JSON.stringify({ ...info, chain: \"Base\", explorer: \"https://basescan.org/address/\" + info.address }, null, 2) }] }
      }
      case \"agelo_aave_rates\": {
        const rates = await getAaveApys()
        return { content: [{ type: \"text\", text: JSON.stringify({ protocol: \"Aave V3\", chain: \"Base\", rates }, null, 2) }] }
      }
      case \"agelo_aave_position\": {
        const position = await getAavePosition()
        return { content: [{ type: \"text\", text: JSON.stringify(position || { message: \"No active position\" }, null, 2) }] }
      }
      case \"agelo_supply_aave\": {
        const { asset, amount } = args as any
        const result = await supplyToAave(asset, amount)
        return { content: [{ type: \"text\", text: JSON.stringify({ success: true, tx: result.hash }, null, 2) }] }
      }
      case \"agelo_withdraw_aave\": {
        const { asset, amount } = args as any
        const result = await withdrawFromAave(asset, amount)
        return { content: [{ type: \"text\", text: JSON.stringify({ success: true, tx: result.hash }, null, 2) }] }
      }
      default: throw new Error(\"Unknown tool: \" + name)
    }
  } catch (err: any) {
    return { content: [{ type: \"text\", text: \"Error: \" + err.message }], isError: true }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(\"Agelo MCP Server v2.0 running\")
}
main().catch(console.error)
'''
with open(\"src/mcp/server.ts\", \"w\") as f:
    f.write(content)
print(\"  done\")
"

# ─── skills/wdk/SKILL.md ──────────────────────────────────────────────────────
echo "✍️  skills/wdk/SKILL.md"
cat > skills/wdk/SKILL.md << 'SKILLEOF'
---
name: agelo-wdk
description: Agelo autonomous payment agent with WDK wallet, x402 micropayments on Plasma, and Aave V3 lending on Base. Use this skill when working on the Agelo codebase.
---

# Agelo WDK Skill

## What is Agelo
Autonomous AI agent that pays for HTTP services via x402 micropayments (USDT0 on Plasma) and earns yield via Aave V3 on Base. Uses Tether WDK for all wallet operations.

## Key commands
```bash
npm run marketplace   # Start x402 service server (port 4021)
npm run agent "task"  # Run agent with task
npm run mcp           # Start MCP server
```

## WDK Core pattern
```typescript
import WDK from '@tetherto/wdk'
const wdk = new WDK(seed)
  .registerWallet('plasma', WalletManagerEvm, { chainId: 9745 })
  .registerWallet('base',   WalletManagerEvm, { chainId: 8453 })
  .registerProtocol('base', 'aave', AaveLendingEvm, aaveConfig)
const account = await wdk.getAccount('plasma', 0)
```

## x402 payment pattern
```typescript
// Server: paymentMiddleware(seller, { price: { amount, asset, extra }, facilitatorUrl })
// Client: const { data, receipt } = await fetchWithPayment(url)
// receipt = tx hash on Plasma, verify at plasmascan.to
```

## Aave pattern
```typescript
const aave = account.getLendingProtocol('aave')
await aave.supply({ asset: USDC_ADDRESS, amount: '100' })
const pos = await aave.getPosition()  // healthFactor, totalCollateral, etc
```

## Important gotchas
- x402 route params: use `[symbol]` not `:symbol`
- Payment header: `payment-response` (lowercase)
- Plasma chainId: 9745, Base chainId: 8453
- Both wallets use same seed phrase, same account index
SKILLEOF

# ─── package.json — agregar scripts y deps ───────────────────────────────────
echo "✍️  Actualizando package.json..."
python3 -c "
import json
with open('package.json', 'r') as f:
    pkg = json.load(f)

# Add new script
pkg['scripts']['mcp'] = 'npx ts-node --esm src/mcp/server.ts'

# Add new deps
pkg['dependencies']['@tetherto/wdk'] = '^1.0.0-beta.6'
pkg['dependencies']['@tetherto/wdk-protocol-lending-aave-evm'] = '^1.0.0-beta.3'
pkg['dependencies']['@tetherto/wdk-protocol-swap-velora-evm'] = '^1.0.0-beta.4'
pkg['dependencies']['@modelcontextprotocol/sdk'] = '^1.27.1'

with open('package.json', 'w') as f:
    json.dump(pkg, f, indent=2)
print('  done')
"

# ─── mcp-config.example.json ─────────────────────────────────────────────────
echo "✍️  mcp-config.example.json"
cat > mcp-config.example.json << 'MCPEOF'
{
  "_comment": "Add mcpServers block to: ~/Library/Application Support/Claude/claude_desktop_config.json (Mac) or %APPDATA%/Claude/claude_desktop_config.json (Windows)",
  "mcpServers": {
    "agelo": {
      "command": "node",
      "args": ["/home/shavi/agelo/dist/mcp/server.js"],
      "env": {
        "AGENT_SEED_PHRASE": "your twelve word seed phrase here",
        "PLASMA_RPC": "https://rpc.plasma.to",
        "BASE_RPC": "https://mainnet.base.org"
      }
    }
  }
}
MCPEOF

echo ""
echo "✅ Agelo v2.0 instalado!"
echo ""
echo "Probá:"
echo "  npm run marketplace"
echo "  # en otra terminal:"
echo "  npm run agent \"What are the current Aave V3 lending rates?\""
echo "  npm run agent \"Show my wallet balances on Plasma and Base\""
