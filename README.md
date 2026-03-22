# Agelo — Your USDT Never Sleeps

> Autonomous financial agent that maximizes yield on Aave V3, pays for services via x402, and reports everything with AI — built on the full Tether WDK stack.

**Hackathon:** Tether Hackathon Galáctica: WDK Edition 1  
**Track:** 🤖 Agent Wallets  
**License:** Apache 2.0

---

## What does it do?

Agelo is an autonomous financial agent with three core behaviors:

**1. Your USDT earns yield while you sleep**  
Detects idle USDT in your wallet. Automatically deposits it into Aave V3 (Arbitrum). Every 30 minutes it evaluates: deposit more? APY dropped? Withdraw? — all with documented LLM reasoning.

**2. When payment is needed, it pays itself**  
An x402 charge arrives (HTTP 402 Payment Required). Agelo checks if there is enough liquid balance. If not, it withdraws exactly what is needed from Aave, pays in USDT0 on Plasma, and redeposits the remainder.

**3. Reports how you did**  
Generates AI financial reports: accumulated yield, expenses per service, portfolio status, recommendations — all paid as x402 services.

**4. Negotiates before paying**  
Before purchasing any service, the agent probes multiple providers, compares x402 prices via `ProviderQuote` typed responses, and routes to the cheapest one. Savings are tracked per negotiation and returned as `NegotiationRecord`. Autonomous price negotiation — no human input required. **Negotiation is optional** — users can disable it and lock to a preferred provider.
> Builders define the rules → Agents do the work → Value settles onchain

---

## Verifiable On-Chain Transactions

All transactions were executed during the hackathon:

| Action | Chain | TX Hash | Explorer |
|--------|-------|---------|----------|
| Supply 9.87 USDT → Aave V3 | Arbitrum | `0xda03570a...` | [arbiscan.io](https://arbiscan.io/tx/0xda03570a224772f83c4baa1dc4a47239db274d3db41cbb6cbdef6a29f2d590b3) |
| x402 payment (aave-rates) | Plasma | `0x330f4b84...` | [plasmascan.to](https://plasmascan.to/tx/0x330f4b84385ada6194bc9808de98d5a3dbd9879facee9a8ec7e905e80ee8a5a4) |
| x402 payment (financial-report) | Plasma | `0xc82f7c1f...` | [plasmascan.to](https://plasmascan.to/tx/0xc82f7c1f3aa7e11b94b2a128442f764274c08ac0dc2c85187ce830a8dfa9149f) |

Wallet: `0x8C1b70A0189e814772B2bcb0226Fc60e79172Ff9`  
→ [Arbitrum](https://arbiscan.io/address/0x8C1b70A0189e814772B2bcb0226Fc60e79172Ff9) · [Plasma](https://plasmascan.to/address/0x8C1b70A0189e814772B2bcb0226Fc60e79172Ff9)

---

## Architecture
```
User / External Agent
        ↓ natural language task
   AgeloAgent (Claude Haiku)
        ↓ tool calls
  ┌─────────────────────────────────────┐
  │  TreasuryEngine (loop 30 min)       │
  │  ├─ WDK wallet-evm (Arbitrum)       │
  │  ├─ Aave V3 supply / withdraw       │
  │  └─ LLM decision + audit log        │
  │                                     │
  │  PaymentEngine (x402)               │
  │  ├─ WDK wallet-evm (Plasma)         │
  │  ├─ fetchWithPayment (EIP-3009)     │
  │  └─ ensureLiquidity → Aave withdraw │
  └─────────────────────────────────────┘
        ↓ paid services
  Agelo Marketplace (x402 server)
  ├─ /api/aave-rates       $0.003
  ├─ /api/financial-report $0.010
  ├─ /api/market-analysis  $0.010
  ├─ /api/crypto-price     $0.001
  └─ /api/ai-inference     $0.050
```

---

## WDK Modules Used

| Module | Usage |
|--------|-------|
| `@tetherto/wdk` | Core orchestrator |
| `@tetherto/wdk-mcp-toolkit` | Official MCP toolkit — Agelo registers 25 built-in + 6 custom = 31 tools |
| `@tetherto/wdk-wallet-evm` | Self-custodial wallets on Plasma + Ethereum + Arbitrum |
| `@tetherto/wdk-wallet-spark` | Lightning Network wallet (Spark, registered — active development) |
| `@tetherto/wdk-protocol-swap-velora-evm` | DEX aggregator swap on EVM chains |
| `@tetherto/wdk-protocol-lending-aave-evm` | Aave V3 supply, withdraw, getAccountData |
| `@tetherto/wdk-protocol-bridge-usdt0-evm` | USDT bridge (Ethereum → Arbitrum, in roadmap) |
| `@x402/fetch` + `@x402/express` + `@x402/evm` | x402 client + server payments |

---

## Quickstart

### Prerequisites
- Node.js 20+
- Seed phrase with USDT on Arbitrum (for Aave) and USDT0 on Plasma (for x402)
- Anthropic API key

### Setup
```bash
git clone https://github.com/javierpmateos/agelo
cd agelo
cp .env.example .env
# Fill in AGENT_SEED_PHRASE and ANTHROPIC_API_KEY
npm install
```

### Run

**Terminal 1 — Services Marketplace:**
```bash
npm run marketplace
```

**Terminal 2 — Agent + API:**
```bash
npm start
```

**Terminal 3 — CLI:**
```bash
npm run agent "What is my portfolio status?"
```

**Terminal 3 — Dashboard:**
```bash
npx serve src/dashboard -p 3000
# Open http://localhost:3000
```

---

## MCP Server (OpenClaw / Claude Desktop)
```bash
npm run mcp
```

Exposes **31 tools** for any MCP-compatible agent: 25 built-in WDK tools (wallet, swap, bridge, lending, pricing) + 6 Agelo domain-specific treasury tools:

| Tool | Description |
|------|-------------|
| `agelo_wallet_info` | Plasma wallet address + USDT0 balance |
| `agelo_base_wallet` | Arbitrum wallet + balances |
| `agelo_aave_rates` | Aave V3 APY rates |
| `agelo_aave_position` | Current lending position |
| `agelo_supply_aave` | Supply USDT to Aave V3 |
| `agelo_withdraw_aave` | Withdraw from Aave V3 |

Verified working with OpenClaw + WDK skill: read $8.41 Aave collateral live.

---

## How the Autonomous Loop Works
```
Every 30 minutes:
  1. Read USDT balance (Arbitrum)
  2. Read Aave position (collateral, APY, health factor)
  3. Claude Haiku evaluates: supply / withdraw / hold
  4. Execute transaction if needed
  5. Log decision with reasoning

On every x402 payment:
  1. Check liquid USDT0 balance (Plasma)
  2. If insufficient → withdraw from Aave (Arbitrum)
  3. Pay via x402 (EIP-3009 signed authorization)
  4. Redeposit excess above reserve back to Aave
```

---

## Project Structure
```
src/
├── wallet/
│   ├── wdk-setup.ts        # WDK core — Plasma + Ethereum + Arbitrum + Spark
│   └── agent-wallet.ts     # Plasma wallet helpers
├── services/
│   ├── lending.ts          # Aave V3 supply/withdraw/position
│   └── marketplace.ts      # x402 payment-gated API server
├── agent/
│   ├── treasury-engine.ts  # Autonomous 30-min yield loop
│   ├── payment-engine.ts   # x402 client with auto-liquidity
│   └── agent.ts            # AgeloAgent — LLM + tools
├── dashboard/
│   └── index.html          # Real-time portfolio dashboard
└── index.ts                # HTTP API server (SSE streaming)
```


---

## Deploy to Railway (Production)

> ⚠️ **Experimental** — configuration provided as reference, not tested end-to-end in production.

Run Agelo 24/7 in the cloud with Railway:

### 1. Fork the repo and connect to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
```

### 2. Set environment variables in Railway dashboard
```
AGENT_SEED_PHRASE=your twelve word seed phrase
ANTHROPIC_API_KEY=sk-ant-...
PLASMA_RPC=https://rpc.plasma.to
PLASMA_NETWORK_ID=eip155:9745
USDT0_PLASMA=0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb
MARKETPLACE_PORT=4021
AGENT_PORT=4022
```

### 3. Deploy
```bash
# Deploy marketplace (x402 server)
railway up --service marketplace

# Deploy agent API
railway up --service agent
```

### 4. Add a `railway.json` config
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

> **Note:** Each Railway service maps to one process. Run marketplace and agent as separate services sharing the same environment variables.

---

## Roadmap

- [ ] Dynamic negotiation with unknown providers (read price from 402 response in real-time)
- [ ] Lightning Network x402 micropayments via `@tetherto/wdk-wallet-spark` (module available — Spark wallet registered in WDK, active development)
- [ ] USA₮ support for US-regulated institutional users (architecturally ready — waiting for cross-chain expansion to Arbitrum/Plasma)
- [ ] XAU₮ (Tether Gold) as treasury diversification asset
- [ ] Live Aave APY from on-chain UI Data Provider
- [ ] Multi-chain yield optimization (compare APYs across chains)
- [ ] USDT bridge automation (Ethereum → Arbitrum via WDK bridge module)
- [x] OpenClaw SKILL.md — implemented and tested (live Aave position read via WDK skill)
- [ ] SDK for sellers: `createPaywall()` in 3 lines
- [ ] Tax estimation on yield earnings
- [ ] Multi-user support

---

## Third-Party Services & Disclosures

| Service | Usage | License/Terms |
|---------|-------|---------------|
| **Anthropic Claude API** (claude-haiku-4-5) | LLM for treasury decisions, financial reports, AI inference endpoint | [Anthropic Terms](https://anthropic.com/legal/terms) |
| **CoinGecko API** | Real-time crypto prices (free tier, no API key required) | [CoinGecko Terms](https://www.coingecko.com/en/terms) |
| **SemanticPay** | x402 payment facilitator for Plasma chain — officially recognized in Tether WDK Community Spotlight | [semanticpay.io](https://x402.semanticpay.io) |
| **Aave V3** | Decentralized lending protocol on Arbitrum | [Aave Terms](https://aave.com) |
| **Tether WDK** | Self-custodial wallet infrastructure | [Apache 2.0](https://github.com/tetherto/wdk) |

---

## Notes

- `getAaveApys()` returns hardcoded approximate rates (March 2026). Live on-chain rates via Aave UI Data Provider are on the roadmap.
- The bridge module (`wdk-protocol-bridge-usdt0-evm`) is installed and partially integrated. Full automation pending.
- All x402 payments use `ExactEvmScheme` on Plasma chain with the Semantic facilitator.
