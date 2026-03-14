import 'dotenv/config'
import { getPlasmaAccount, getBaseAccount } from './src/wallet/wdk-setup.js'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

const USDT_ETHEREUM = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const USDT0_PLASMA  = '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb'

async function main() {
  const plasma  = await getPlasmaAccount()
  const base    = await getBaseAccount()
  const addr    = await plasma.getAddress()

  // ETH balance en Ethereum (necesitamos cuenta en mainnet eth)
  const ethManager = new WalletManagerEvm(process.env.AGENT_SEED_PHRASE!, {
    provider: 'https://eth.drpc.org'
  })
  const ethAccount = await ethManager.getAccount()

  const ethBalance    = await ethAccount.getBalance()
  const usdtEthBal    = await ethAccount.getTokenBalance(USDT_ETHEREUM)
  const plasmaBalance = await plasma.getBalance()
  const usdtPlasmaBal = await plasma.getTokenBalance(USDT0_PLASMA)

  console.log('\n=== Agelo Wallet Balances ===')
  console.log(`Address: ${addr}`)
  console.log(`\nEthereum mainnet:`)
  console.log(`  ETH:  ${(Number(ethBalance) / 1e18).toFixed(6)} ETH`)
  console.log(`  USDT: ${(Number(usdtEthBal) / 1e6).toFixed(2)} USDT`)
  console.log(`\nPlasma:`)
  console.log(`  ETH:   ${(Number(plasmaBalance) / 1e18).toFixed(6)}`)
  console.log(`  USDT0: ${(Number(usdtPlasmaBal) / 1e6).toFixed(2)} USDT0`)
  console.log(`\nExplorers:`)
  console.log(`  Eth:    https://etherscan.io/address/${addr}`)
  console.log(`  Plasma: https://plasmascan.to/address/${addr}`)
}

main().catch(console.error)
