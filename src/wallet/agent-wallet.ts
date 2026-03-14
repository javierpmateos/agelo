import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import 'dotenv/config'

export const PLASMA_RPC = process.env.PLASMA_RPC ?? 'https://rpc.plasma.to'
export const PLASMA_NETWORK_ID = process.env.PLASMA_NETWORK_ID ?? 'eip155:9745'
export const USDT0_PLASMA = process.env.USDT0_PLASMA ?? '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb'

export interface AgentWallet {
  account: Awaited<ReturnType<InstanceType<typeof WalletManagerEvm>['getAccount']>>
  address: string
  getUsdtBalance: () => Promise<string>
}

export async function createAgentWallet(seedPhrase: string): Promise<AgentWallet> {
  if (!seedPhrase) throw new Error('AGENT_SEED_PHRASE is required in .env')

  const manager = new WalletManagerEvm(seedPhrase, {
    provider: PLASMA_RPC,
  })

  const account = await manager.getAccount()
  const address = await account.getAddress()

  async function getUsdtBalance(): Promise<string> {
    try {
      const balance = await account.getTokenBalance(USDT0_PLASMA)
      return (Number(balance) / 1_000_000).toFixed(6)
    } catch {
      return '0.000000'
    }
  }

  return { account, address, getUsdtBalance }
}

export async function createFacilitatorWallet(seedPhrase: string) {
  if (!seedPhrase) throw new Error('FACILITATOR_SEED_PHRASE is required in .env')
  const manager = new WalletManagerEvm(seedPhrase, { provider: PLASMA_RPC })
  return manager.getAccount()
}

export async function getAgentAddress(): Promise<string> {
  const seed = process.env.AGENT_SEED_PHRASE
  if (!seed) throw new Error('AGENT_SEED_PHRASE not set')
  const { createAgentWallet } = await import('./agent-wallet.js')
  const w = await createAgentWallet(seed)
  return w.address
}

export async function getUSDT0Balance(address: string): Promise<string> {
  const seed = process.env.AGENT_SEED_PHRASE
  if (!seed) throw new Error('AGENT_SEED_PHRASE not set')
  const { createAgentWallet } = await import('./agent-wallet.js')
  const w = await createAgentWallet(seed)
  return w.getUsdtBalance()
}

export async function getBaseWalletInfo() {
  const { getBaseAccount } = await import('./wdk-setup.js')
  const account = await getBaseAccount(0)
  const address = await account.getAddress()
  return { address }
}
