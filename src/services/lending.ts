import AaveProtocolEvm from "@tetherto/wdk-protocol-lending-aave-evm"
import { getArbAccount } from "../wallet/wdk-setup.js"

// Aave V3 Arbitrum tokens
export const AAVE_ASSETS = {
  USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
}

async function getAave() {
  const account = await getArbAccount(0)
  return new AaveProtocolEvm(account as any)
}

export async function getAavePosition() {
  try {
    const aave = await getAave()
    const data = await aave.getAccountData()
    return {
      totalCollateral: data.totalCollateralBase.toString(),
      totalDebt:       data.totalDebtBase.toString(),
      availableBorrow: data.availableBorrowsBase.toString(),
      healthFactor:    data.healthFactor.toString(),
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
  const aave = await getAave()
  console.log(`  🏦 Supplying ${amount} ${assetSymbol} to Aave V3 on Arbitrum...`)
  const result = await aave.supply({ token, amount })
  console.log(`  ✅ Supplied! tx: ${result.hash}`)
  return result
}

export async function withdrawFromAave(assetSymbol: string, amount: bigint) {
  const token = AAVE_ASSETS[assetSymbol as keyof typeof AAVE_ASSETS]
  if (!token) throw new Error(`Unknown asset: ${assetSymbol}`)
  const aave = await getAave()
  console.log(`  🏦 Withdrawing ${amount} ${assetSymbol} from Aave V3 Arbitrum...`)
  const result = await aave.withdraw({ token, amount })
  console.log(`  ✅ Withdrawn! tx: ${result.hash}`)
  return result
}

export async function getAaveApys(): Promise<Record<string, { supplyApy: string; borrowApy: string }>> {
  return {
    USDT: { supplyApy: "4.8%", borrowApy: "6.2%" },
    USDC: { supplyApy: "4.2%", borrowApy: "5.9%" },
    ETH:  { supplyApy: "1.8%", borrowApy: "3.1%" },
  }
}
