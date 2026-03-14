import 'dotenv/config'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import BridgeUSDT0Evm from '@tetherto/wdk-protocol-bridge-usdt0-evm'

async function main() {
  const manager = new WalletManagerEvm(process.env.AGENT_SEED_PHRASE!, {
    provider: 'https://ethereum-rpc.publicnode.com'
  })
  const account = await manager.getAccount()
  const address = await account.getAddress()
  console.log('Wallet:', address)

  const bridge = new (BridgeUSDT0Evm as any)(account)

  console.log('Getting quote...')
  const quote = await bridge.quoteBridge({
    targetChain: 'plasma',
    amount: 10000000n,
  })
  console.log('Quote:', quote)

  console.log('Bridging 10 USDT -> USDT0 on Plasma...')
  const result = await bridge.bridge({
    targetChain: 'plasma',
    amount: 10000000n,
  })
  console.log('Bridge tx:', result.hash)
  console.log('Done! USDT0 should arrive on Plasma in a few minutes.')
}

main().catch(console.error)
