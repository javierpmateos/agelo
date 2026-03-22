import AaveProtocolEvm from "@tetherto/wdk-protocol-lending-aave-evm"
import { getArbAccount } from "../wallet/wdk-setup.js"

export const AAVE_ASSETS = {
  USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
}

const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"
const MAX_UINT256 = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935")

async function getAave() {
  const account = await getArbAccount(0)
  return { aave: new AaveProtocolEvm(account as any), account }
}

export async function getAavePosition() {
  try {
    const { aave } = await getAave()
    const data = await aave.getAccountData()
    const toUsd = (raw: bigint) => (Number(raw) / 1e8).toFixed(2)
    const hf = data.healthFactor >= MAX_UINT256
      ? '∞'
      : (Number(data.healthFactor) / 1e18).toFixed(2)
    return {
      totalCollateral: toUsd(data.totalCollateralBase),
      totalDebt:       toUsd(data.totalDebtBase),
      availableBorrow: toUsd(data.availableBorrowsBase),
      healthFactor:    hf,
      ltv:             data.ltv.toString(),
    }
  } catch (err: any) {
    console.error("  ⚠️  Aave position error:", err.message)
    return null
  }
}

export async function supplyToAave(assetSymbol: string, amount: bigint) {
  const token = AAVE_ASSETS[assetSymbol as keyof typeof AAVE_ASSETS]
  if (!token) throw new Error(`Unknown asset: ${assetSymbol}`)

  // Guard: verify balance before approve to prevent MEV/frontrunning on open approvals
  const guardAccount = await getArbAccount()
  const rawBalance = await guardAccount.getTokenBalance(token)
  const balance = BigInt(rawBalance ?? 0n)
  if (balance < amount) {
    throw new Error(`Insufficient ${assetSymbol} balance: have ${Number(balance)/1e6}, need ${Number(amount)/1e6}`)
  }
  const { aave, account } = await getAave()
  console.log(`  🔓 Approving ${assetSymbol} for Aave...`)
  await account.approve({ token, spender: AAVE_POOL, amount })
  console.log(`  🏦 Supplying ${Number(amount)/1e6} ${assetSymbol} to Aave V3 on Arbitrum...`)
  const result = await aave.supply({ token, amount })
  console.log(`  ✅ Supplied! tx: ${result.hash}`)
  return result
}

export async function withdrawFromAave(assetSymbol: string, amount: bigint) {
  const token = AAVE_ASSETS[assetSymbol as keyof typeof AAVE_ASSETS]
  if (!token) throw new Error(`Unknown asset: ${assetSymbol}`)
  const { aave } = await getAave()
  console.log(`  🏦 Withdrawing ${Number(amount)/1e6} ${assetSymbol} from Aave V3 Arbitrum...`)
  const result = await aave.withdraw({ token, amount })
  console.log(`  ✅ Withdrawn! tx: ${result.hash}`)
  return result
}

export async function getAaveApys(): Promise<Record<string, { supplyApy: string; borrowApy: string }>> {
  // TODO: read live from Aave UI Data Provider on Arbitrum
  // Hardcoded approximate rates (March 2026)
  return {
    USDT: { supplyApy: "4.8%", borrowApy: "6.2%" },
    USDC: { supplyApy: "4.2%", borrowApy: "5.9%" },
    ETH:  { supplyApy: "1.8%", borrowApy: "3.1%" },
  }
}
