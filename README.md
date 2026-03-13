# Agelo 🤖⚡

**Autonomous AI agent that pays for services via x402 HTTP micropayments using USDT0 on Plasma.**

No subscriptions. No API keys. Pay per call.

---

## How It Works
```
User task → Claude Agent → identifies needed services →
each service returns HTTP 402 → WDK wallet signs EIP-3009 →
fetchWithPayment retries with X-PAYMENT header →
Semantic facilitator verifies + settles → 200 OK + data →
Agent synthesizes → answer + receipt
```

The agent autonomously decides which paid services it needs, pays for each one on-chain, and returns a full answer with a payment receipt.

---

## Tech Stack

| Component | Technology |
|---|---|
| Agent LLM | Claude (Anthropic) |
| Wallet | `@tetherto/wdk-wallet-evm` |
| Payments | x402 protocol (`@x402/fetch`, `@x402/express`) |
| Token | USDT0 |
| Chain | Plasma (`eip155:9745`) — near-zero fees, instant finality |
| Facilitator | Semantic (`https://x402.semanticpay.io/`) |

---

## Marketplace Services

| Endpoint | Price | Description |
|---|---|---|
| `GET /api/crypto-price/:symbol` | $0.001 USDT0 | Live crypto price data |
| `GET /api/news-summary` | $0.005 USDT0 | Crypto news digest + sentiment |
| `GET /api/market-analysis` | $0.010 USDT0 | AI-powered market analysis |
| `GET /api/onchain-metrics` | $0.010 USDT0 | On-chain ETH/BTC metrics |
| `POST /api/ai-inference` | $0.050 USDT0 | General AI inference |

---

## Quick Start
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your seed phrase and Anthropic API key

# Terminal 1 — start the marketplace
npm run marketplace

# Terminal 2 — run the agent
npm run agent "What is the current price of BTC and ETH?"
```

### Example Output
```
🤖 Agelo Agent
   Wallet: 0xD173...54a6
   Balance: 0.015000 USDT0

📋 Task: What is the current price of BTC and ETH?

  💳 Calling: get_crypto_price
  ✅ Paid 0.001000 USDT0
  💳 Calling: get_crypto_price
  ✅ Paid 0.001000 USDT0

📊 ANSWER
BTC: $68,420.55 (+1.11%) | ETH: $3,812.33 (+2.53%)

🧾 RECEIPTS
  1. /api/crypto-price/BTC    $0.001000 USDT0  tx: 0x4f2a...
  2. /api/crypto-price/ETH    $0.001000 USDT0  tx: 0x8c1b...
  TOTAL: $0.002000 USDT0
```

---

## Environment Variables
```bash
AGENT_SEED_PHRASE="twelve word seed phrase here"
ANTHROPIC_API_KEY="sk-ant-..."
PLASMA_RPC="https://rpc.plasma.to"
PLASMA_NETWORK_ID="eip155:9745"
USDT0_PLASMA="0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb"
MARKETPLACE_PORT=4021
AGENT_PORT=4022
MOCK_PAYMENTS=false  # set to true for testing without real funds
```

---

## WDK Integration

Agelo uses the following Tether WDK modules:

- **`@tetherto/wdk-wallet-evm`** — self-custodial EVM wallet on Plasma
- **`@tetherto/wdk-protocol-bridge-usdt0-evm`** — bridge USDT → USDT0
- **`@x402/fetch`** — automatic payment client
- **`@x402/express`** — payment middleware for service endpoints
- **`@x402/evm`** — ExactEvmScheme for EIP-3009 signed transfers

---

## Hackathon

Built for **Tether Hackathon Galáctica WDK Edition 1** — Track: Agent Wallets.

[DoraHacks submission](https://dorahacks.io)

---

## License

Apache 2.0
