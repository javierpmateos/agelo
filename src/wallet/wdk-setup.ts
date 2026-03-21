import WDK from "@tetherto/wdk"
import WalletManagerEvm from "@tetherto/wdk-wallet-evm"
import WalletManagerSpark from "@tetherto/wdk-wallet-spark"
import * as dotenv from "dotenv"
dotenv.config()

let _wdk: any = null

export async function getWDK() {
  if (_wdk) return _wdk
  const seed = process.env.AGENT_SEED_PHRASE
  if (!seed) throw new Error("AGENT_SEED_PHRASE not set")
  _wdk = new WDK(seed)
    .registerWallet("plasma",   WalletManagerEvm, { provider: process.env.PLASMA_RPC || "https://rpc.plasma.to" })
    .registerWallet("ethereum", WalletManagerEvm, { provider: process.env.ETH_RPC    || "https://eth.drpc.org" })
    .registerWallet("arbitrum", WalletManagerEvm, { provider: process.env.ARB_RPC    || "https://arb1.arbitrum.io/rpc" })
    .registerWallet("spark",    WalletManagerSpark as any, { network: 'MAINNET' })
  console.log("  🔧 WDK initialized (Plasma + Ethereum + Arbitrum + Spark/Lightning)")
  return _wdk
}

export async function getPlasmaAccount(index = 0) {
  const wdk = await getWDK()
  return wdk.getAccount("plasma", index)
}

export async function getEthAccount(index = 0) {
  const wdk = await getWDK()
  return wdk.getAccount("ethereum", index)
}

export async function getArbAccount(index = 0) {
  const wdk = await getWDK()
  return wdk.getAccount("arbitrum", index)
}
