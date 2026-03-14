import WDK from "@tetherto/wdk"
import WalletManagerEvm from "@tetherto/wdk-wallet-evm"
import AaveLendingEvm from "@tetherto/wdk-protocol-lending-aave-evm"
import VeloraSwapEvm from "@tetherto/wdk-protocol-swap-velora-evm"
import * as dotenv from "dotenv"
dotenv.config()

const PLASMA_CONFIG = {
  chainId: 9745,
  provider: process.env.PLASMA_RPC || "https://rpc.plasma.to",
  tokens: [{
    symbol: "USDT0",
    address: process.env.USDT0_PLASMA || "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    decimals: 6
  }]
}

const BASE_CONFIG = {
  chainId: 8453,
  provider: process.env.BASE_RPC || "https://mainnet.base.org",
  tokens: [
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 }
  ]
}

const AAVE_BASE_CONFIG = {
  chainId: 8453,
  provider: process.env.BASE_RPC || "https://mainnet.base.org",
  poolAddress: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  poolAddressProvider: "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D"
}

const VELORA_BASE_CONFIG = {
  chainId: 8453,
  provider: process.env.BASE_RPC || "https://mainnet.base.org"
}

let _wdk: any = null

export async function getWDK() {
  if (_wdk) return _wdk
  const seed = process.env.AGENT_SEED_PHRASE
  if (!seed) throw new Error("AGENT_SEED_PHRASE not set")
  _wdk = new WDK(seed)
    .registerWallet("plasma", WalletManagerEvm, PLASMA_CONFIG)
    .registerWallet("base", WalletManagerEvm, BASE_CONFIG)
    .registerProtocol("base", "aave", AaveLendingEvm, AAVE_BASE_CONFIG)
    .registerProtocol("base", "velora", VeloraSwapEvm, VELORA_BASE_CONFIG)
  console.log("  🔧 WDK Core initialized (Plasma + Base + Aave + Velora)")
  return _wdk
}

export async function getPlasmaAccount(index = 0) {
  const wdk = await getWDK()
  return wdk.getAccount("plasma", index)
}

export async function getBaseAccount(index = 0) {
  const wdk = await getWDK()
  return wdk.getAccount("base", index)
}
