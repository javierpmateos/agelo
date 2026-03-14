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
