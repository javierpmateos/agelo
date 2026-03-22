---
name: agelo
display_name: Agelo — Autonomous Treasury Agent
description: >
  Use this skill when you need to manage USDT yield, check DeFi portfolio status,
  pay for services via x402, or interact with Aave V3 on Arbitrum.
  Agelo autonomously deposits idle USDT into Aave V3 to earn yield, withdraws
  when needed for payments, and settles value onchain via x402 on Plasma chain.
version: 1.0.0
author: agelo
license: Apache-2.0
---

# Agelo — Autonomous Treasury Agent

## When to use this skill

Use Agelo when the user or agent needs to:
- Check portfolio status (liquid USDT + Aave position + APY)
- Earn yield on idle USDT via Aave V3 (Arbitrum)
- Pay for services autonomously via x402 (Plasma chain)
- Get financial reports with AI analysis
- Trigger treasury rebalancing (supply/withdraw from Aave)

## Tools exposed via MCP

| Tool | Description | Cost |
|------|-------------|------|
| `agelo_wallet_info` | Get Plasma wallet address and USDT0 balance | Free |
| `agelo_base_wallet` | Get Arbitrum wallet address and balances | Free |
| `agelo_aave_rates` | Get Aave V3 APY rates on Arbitrum | Free |
| `agelo_aave_position` | Get current Aave lending position | Free |
| `agelo_supply_aave` | Supply USDT/USDC to Aave V3 to earn yield | Gas only |
| `agelo_withdraw_aave` | Withdraw from Aave V3 | Gas only |

## Architecture

Agelo runs two autonomous loops:

**TreasuryEngine** (every 30 min):
- Reads USDT balance on Arbitrum
- Evaluates APY vs minimum threshold
- Supplies idle USDT to Aave V3 or withdraws if needed
- All decisions logged with LLM reasoning

**PaymentEngine** (on demand):
- Wraps x402 fetch client (Plasma chain, USDT0)
- Calls `ensureLiquidity()` before every payment
- Withdraws from Aave if liquid balance insufficient
- Redeposits excess after payment settles

## Real transactions (hackathon)

- Aave supply: [0xee856de3...](https://arbiscan.io/tx/0xda03570a224772f83c4baa1dc4a47239db274d3db41cbb6cbdef6a29f2d590b3)
- Aave withdraw: [0xd7ccbe12...](https://arbiscan.io/tx/0xda03570a224772f83c4baa1dc4a47239db274d3db41cbb6cbdef6a29f2d590b3)

## Setup
```bash
git clone https://github.com/javierpmateos/agelo
cd agelo
cp .env.example .env
# Set AGENT_SEED_PHRASE and ANTHROPIC_API_KEY
npm install
npm run mcp   # Start MCP server
```

## MCP Server
```bash
npm run mcp
```

Connect your OpenClaw agent to: `agelo` MCP server (stdio transport)

## Stack

- **WDK:** `@tetherto/wdk-wallet-evm` · `@tetherto/wdk-protocol-lending-aave-evm`
- **Payments:** `@x402/fetch` · `@x402/express` · `@x402/evm`
- **AI:** Anthropic Claude Haiku 4.5
- **Chains:** Plasma (x402) · Arbitrum (Aave) · Ethereum (bridge)
