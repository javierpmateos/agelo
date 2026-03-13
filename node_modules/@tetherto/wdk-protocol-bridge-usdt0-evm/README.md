# @tetherto/wdk-protocol-bridge-usdt0-evm

**Note**: This package is currently in beta. Please test thoroughly in development environments before using in production.

A simple and secure package that lets EVM wallet accounts bridge [USDT0](https://usdt0.to/) tokens across different blockchains. This package provides a clean SDK for moving tokens between EVM-compatible chains using the LayerZero protocol and USDT0 bridge system with support for both standard wallets and ERC-4337 smart accounts.

This module can be managed by the [`@tetherto/wdk`](https://github.com/tetherto/wdk-core) package, which provides a unified interface for managing multiple WDK wallet and protocol modules across different blockchains.

## 🔍 About WDK

This module is part of the [**WDK (Wallet Development Kit)**](https://wallet.tether.io/) project, which empowers developers to build secure, non-custodial wallets with unified blockchain access, stateless architecture, and complete user control. 

For detailed documentation about the complete WDK ecosystem, visit [docs.wallet.tether.io](https://docs.wallet.tether.io).

## 🌟 Features

- **Cross-Chain Bridge**: Move USDT0 tokens between supported EVM-compatible blockchains
- **LayerZero Integration**: Uses LayerZero protocol for secure cross-chain transfers
- **Multi-Chain Support**: Bridge between Ethereum, Arbitrum, Polygon, and other supported chains
- **Account Abstraction**: Works with both standard EVM wallets and ERC-4337 smart accounts
- **Fee Management**: Built-in fee calculation and bridge cost estimation
- **Token Support**: Supports USDT and other USDT0 ecosystem tokens
- **TypeScript Support**: Full TypeScript definitions included
- **Memory Safety**: Secure transaction handling with proper error management
- **Provider Flexibility**: Works with JSON-RPC URLs and EIP-1193 browser providers

## ⬇️ Installation

To install the `@tetherto/wdk-protocol-bridge-usdt0-evm` package, follow these instructions:

You can install it using npm:

```bash
npm install @tetherto/wdk-protocol-bridge-usdt0-evm
```

## 🚀 Quick Start

### Option 1: Using with WDK Core (Recommended)

```javascript
import WDK from '@tetherto/wdk'
import Usdt0ProtocolEvm from '@tetherto/wdk-protocol-bridge-usdt0-evm'

// Create WDK instance with EVM wallet support
const wdk = new WDK(seedPhrase)
  .registerWallet('ethereum', WalletManagerEvm, {
    provider: 'https://ethereum-rpc.publicnode.com'
  })
  .registerWallet('arbitrum', WalletManagerEvm, {
    provider: 'https://arb1.arbitrum.io/rpc'
  })
  .registerProtocol('ethereum', 'usdt0', Usdt0ProtocolEvm, {
    bridgeMaxFee: 100000000000000 // 0.0001 ETH in wei
  })

// Get account with bridge protocol
const account = await wdk.getAccount('ethereum', 0)
const usdt0Bridge = account.getBridgeProtocol('usdt0')

// Perform bridge
const result = await usdt0Bridge.bridge({
  targetChain: 'arbitrum',
  recipient: 'RECIPIENT_ADDRESS',
  token: 'USDT_TOKEN_ADDRESS',
  amount: 1000000n // 1 USDT (6 decimals)
})
```

### Option 2: Direct Usage

### Creating a New Bridge Service

```javascript
import Usdt0ProtocolEvm from '@tetherto/wdk-protocol-bridge-usdt0-evm'
import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm'

// Use a BIP-39 seed phrase (replace with your own secure phrase)
const seedPhrase = 'test only example nut use this real life secret phrase must random'

// Create wallet account with provider config
const account = new WalletAccountEvm(seedPhrase, "0'/0/0", {
  provider: 'https://ethereum-rpc.publicnode.com'
})

// Create bridge service with configuration
const bridgeProtocol = new Usdt0ProtocolEvm(account, {
  bridgeMaxFee: 100000000000000n // Optional: Maximum bridge fee in wei
})

// OR for ERC-4337 smart accounts

import { WalletAccountEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337'

// Create ERC-4337 account
const smartAccount = new WalletAccountEvmErc4337(seedPhrase, "0'/0/0", {
  provider: 'https://arb1.arbitrum.io/rpc',
  bundlerUrl: 'YOUR_BUNDLER_URL',
  paymasterUrl: 'YOUR_PAYMASTER_URL'
})

// Create bridge service for smart account
const smartBridgeProtocol = new Usdt0ProtocolEvm(smartAccount, {
  bridgeMaxFee: 100000000000000n
})
```

### Basic Cross-Chain Bridging

```javascript
// Bridge USDT from Ethereum to Arbitrum
const result = await bridgeProtocol.bridge({
  targetChain: 'arbitrum', // Where to send tokens
  recipient: 'RECIPIENT_ADDRESS', // Who gets the tokens on target chain
  token: 'USDT_TOKEN_ADDRESS', // USDT token address on source chain
  amount: 1000000n // Amount to bridge (1 USDT with 6 decimals)
})

console.log('Bridge transaction hash:', result.hash)
console.log('Total fee:', result.fee, 'wei')
console.log('Bridge fee:', result.bridgeFee, 'wei')

// Bridge from Arbitrum to Ethereum
const reverseResult = await bridgeProtocol.bridge({
  targetChain: 'ethereum',
  recipient: 'RECIPIENT_ADDRESS',
  token: 'USDT_TOKEN_ADDRESS',
  amount: 5000000n // 5 USDT
})

// Bridge to Polygon
const polygonResult = await bridgeProtocol.bridge({
  targetChain: 'polygon',
  recipient: 'RECIPIENT_ADDRESS',
  token: 'USDT_TOKEN_ADDRESS',
  amount: 10000000n // 10 USDT
})
```

### Getting Bridge Quotes

```javascript
// Get bridge cost estimate before executing
const quote = await bridgeProtocol.quoteBridge({
  targetChain: 'arbitrum',
  recipient: 'RECIPIENT_ADDRESS',
  token: 'USDT_TOKEN_ADDRESS',
  amount: 1000000n
})

console.log('Estimated gas fee:', quote.fee, 'wei')
console.log('Estimated bridge fee:', quote.bridgeFee, 'wei')
console.log('Total cost:', Number(quote.fee + quote.bridgeFee) / 1e18, 'ETH')

// Check if bridge is cost-effective
if (quote.fee + quote.bridgeFee > 100000000000000n) { // More than 0.0001 ETH
  console.log('Bridge fees too high, consider waiting for lower gas prices')
} else {
  // Execute the bridge
  const result = await bridgeProtocol.bridge({
    targetChain: 'arbitrum',
    recipient: 'RECIPIENT_ADDRESS',
    token: 'USDT_TOKEN_ADDRESS',
    amount: 1000000n
  })
}
```

### ERC-4337 Smart Account Bridging

```javascript
// Bridge using ERC-4337 smart account with sponsored transactions
const smartAccountResult = await smartBridgeProtocol.bridge({
  targetChain: 'ethereum',
  recipient: 'RECIPIENT_ADDRESS',
  token: 'USDT_TOKEN_ADDRESS',
  amount: 1000000n
}, {
  paymasterToken: 'USDT', // Use USDT to pay gas fees
  bridgeMaxFee: 100000000000000n // Override max fee
})

console.log('Smart account bridge hash:', smartAccountResult.hash)
console.log('Gas fee paid in USDT:', smartAccountResult.fee)
console.log('Bridge service fee:', smartAccountResult.bridgeFee)
```

### Multi-Token Bridging

```javascript
// Bridge different USDT0 ecosystem tokens
const tokens = [
  { address: 'USDT_TOKEN_ADDRESS', amount: 1000000n, name: 'USDT' },
  { address: 'XAUT_TOKEN_ADDRESS', amount: 1000000000000000000n, name: 'XAUT' }, // 18 decimals
]

for (const token of tokens) {
  try {
    // Get quote first
    const quote = await bridgeProtocol.quoteBridge({
      targetChain: 'arbitrum',
      recipient: 'RECIPIENT_ADDRESS',
      token: token.address,
      amount: token.amount
    })
    
    console.log(`Bridge ${token.name} quote:`)
    console.log(`  Gas fee: ${quote.fee} wei`)
    console.log(`  Bridge fee: ${quote.bridgeFee} wei`)
    
    // Execute bridge
    const result = await bridgeProtocol.bridge({
      targetChain: 'arbitrum',
      recipient: 'RECIPIENT_ADDRESS',
      token: token.address,
      amount: token.amount
    })
    
    console.log(`${token.name} bridge successful: ${result.hash}`)
    
  } catch (error) {
    console.error(`${token.name} bridge failed:`, error.message)
  }
}
```

### Advanced Bridge Operations

```javascript
// Compare bridge costs across different target chains
const sourceChain = 'ethereum'
const targetChains = ['arbitrum', 'polygon']
const amount = 1000000n
const token = 'USDT_TOKEN_ADDRESS'
const recipient = 'RECIPIENT_ADDRESS'

const quotes = await Promise.allSettled(
  targetChains.map(async (chain) => {
    const quote = await bridgeProtocol.quoteBridge({
      targetChain: chain,
      recipient,
      token,
      amount
    })
    return { chain, ...quote }
  })
)

quotes.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    const { chain, fee, bridgeFee } = result.value
    console.log(`Bridge to ${chain}:`)
    console.log(`  Total cost: ${Number(fee + bridgeFee) / 1e18} ETH`)
  } else {
    console.error(`Bridge to ${targetChains[index]} failed:`, result.reason.message)
  }
})
```

## 📚 API Reference

### Table of Contents

| Class | Description | Methods |
|-------|-------------|---------|
| [Usdt0ProtocolEvm](#usdt0protocolevm) | Main class for bridging USDT0 tokens between EVM chains. Extends `BridgeProtocol` from `@tetherto/wdk-wallet/protocols`. | [Constructor](#constructor), [Methods](#methods) |

### Usdt0ProtocolEvm

The main class for bridging USDT0 tokens between EVM-compatible blockchains using the LayerZero protocol.  
Extends `BridgeProtocol` from `@tetherto/wdk-wallet/protocols`.

#### Constructor

```javascript
new Usdt0ProtocolEvm(account, config)
```

**Parameters:**
- `account` (WalletAccountEvm | WalletAccountEvmErc4337 | WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337): The wallet account to use for bridge operations
- `config` (object, optional): Configuration object
  - `bridgeMaxFee` (bigint, optional): Maximum total bridge cost in wei

**Example:**
```javascript
const bridgeProtocol = new Usdt0ProtocolEvm(account, {
  bridgeMaxFee: 100000000000000n // Maximum bridge fee in wei (0.0001 ETH)
})
```

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `bridge(options, config?)` | Bridges tokens between EVM chains | `Promise<{hash: string, fee: bigint, bridgeFee: bigint}>` |
| `quoteBridge(options, config?)` | Gets the cost of a bridge operation | `Promise<{fee: bigint, bridgeFee: bigint}>` |

##### `bridge(options, config?)`
Bridges tokens between EVM-compatible blockchains using the USDT0 protocol.

**Parameters:**
- `options` (object): Bridge operation options
  - `targetChain` (string): Where to send tokens ('ethereum', 'arbitrum', 'polygon')
  - `recipient` (string): Address that will get the bridged tokens
  - `token` (string): Token address on source chain
  - `amount` (bigint): Amount to bridge in token base units
- `config` (object, optional): Override settings for ERC-4337 accounts
  - `paymasterToken` (string, optional): Token to use for paying gas fees
  - `bridgeMaxFee` (bigint, optional): Override maximum bridge fee

**Returns:** `Promise<BridgeResult>` - Bridge operation result

**Example:**
```javascript
const result = await bridgeProtocol.bridge({
  targetChain: 'arbitrum',
  recipient: 'RECIPIENT_ADDRESS',
  token: 'USDT_TOKEN_ADDRESS',
  amount: 1000000n // 1 USDT (6 decimals)
})
```

##### `quoteBridge(options, config?)`
Gets the cost of a bridge operation without executing it.

**Parameters:**
- `options` (object): Same as bridge method
- `config` (object, optional): Override settings for ERC-4337 accounts

**Returns:** `Promise<BridgeQuote>` - Bridge cost estimate

**Example:**
```javascript
const quote = await bridgeProtocol.quoteBridge({
  targetChain: 'arbitrum',
  recipient: 'RECIPIENT_ADDRESS',
  token: 'USDT_TOKEN_ADDRESS',
  amount: 1000000n
})
```

## 🌐 Supported Networks

This package works with EVM-compatible blockchains:

**Supported Chains:**
- **Ethereum** (Chain ID: 1, Mainnet)
- **Arbitrum** (Chain ID: 42161, ERC-4337 support)
- **Polygon** (Chain ID: 137)
- **Other EVM L2 Networks** (Various Layer 2 solutions)

**Token Support:**
- USDT and other USDT0 ecosystem tokens
- XAUT (Tether Gold) on supported networks
- Tokens with deployed OFT contracts

**Account Types:**
- **Standard EVM Wallets**: `@tetherto/wdk-wallet-evm` accounts
- **ERC-4337 Smart Accounts**: `@tetherto/wdk-wallet-evm-erc-4337` accounts with sponsored transactions
- **Read-Only Accounts**: For querying bridge costs without transaction capabilities

**Note:** Token support is determined by the contracts deployed on each chain. The protocol checks for `oftContract`, `legacyMeshContract`, and `xautOftContract` to determine available tokens.

## 🔒 Security Considerations

- **Seed Phrase Security**: Always store your seed phrase securely and never share it
- **Private Key Management**: The package handles private keys internally with memory safety features
- **RPC Provider Security**: Use trusted RPC endpoints and consider running your own node
- **Transaction Validation**: Always validate bridge details before signing
- **Gas Price Management**: Monitor gas prices and set appropriate `bridgeMaxFee` limits
- **Quote Validation**: Always get quotes before executing bridges to avoid unexpected costs
- **Token Verification**: Verify token contract addresses before bridging
- **Chain Verification**: Ensure target chain supports the token being bridged
- **Recipient Validation**: Double-check recipient addresses for target chains
- **LayerZero Security**: Trust LayerZero protocol for cross-chain message delivery
- **Smart Contract Risk**: Understand the risks of interacting with bridge smart contracts
- **ERC-4337 Considerations**: Be aware of paymaster and bundler dependencies for smart accounts
- **Slippage Protection**: Consider price impact for large bridge amounts
- **MEV Protection**: Be aware of potential MEV risks on public mempools

## 🛠️ Development

### Building

```bash
# Install dependencies
npm install

# Build TypeScript definitions
npm run build:types

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📜 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🆘 Support

For support, please open an issue on the GitHub repository.

---