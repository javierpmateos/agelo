import WDK from "@tetherto/wdk"
import WalletManagerEvm from "@tetherto/wdk-wallet-evm"
import * as dotenv from "dotenv"
dotenv.config()

const PLASMA_CONFIG = {
  chainId: 9745,
  provider: process.env.PLASMA_RPC || "https://rpc.plasma.to",
}

const BASE_CONFIG = {
  chainId: 8453,
  provider: process.env.BASE_RPC || "https://mainnet.base.org",
}

let _wdk: any = null

export async function getWDK() {
  if (_wdk) return _wdk
  const seed = process.env.AGENT_SEED_PHRASE
  if (!seed) throw new Error("AGENT_SEED_PHRASE not set")
  _wdk = new WDK(seed)
    .registerWallet("plasma", WalletManagerEvm, PLASMA_CONFIG)
    .registerWallet("base", WalletManagerEvm, BASE_CONFIG)
  console.log("  🔧 WDK initialized (Plasma + Base)")
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
