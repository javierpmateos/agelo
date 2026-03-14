import AaveProtocolEvm from "@tetherto/wdk-protocol-lending-aave-evm"
import { getBaseAccount } from "../wallet/wdk-setup.js"

export const AAVE_ASSETS = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
}

async function getAave() {
  const account = await getBaseAccount(0)
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
  console.log(`  🏦 Supplying ${amount} ${assetSymbol} to Aave V3 on Base...`)
  const result = await aave.supply({ token, amount })
  console.log(`  ✅ Supplied! tx: ${result.hash}`)
  return result
}

export async function withdrawFromAave(assetSymbol: string, amount: bigint) {
  const token = AAVE_ASSETS[assetSymbol as keyof typeof AAVE_ASSETS]
  if (!token) throw new Error(`Unknown asset: ${assetSymbol}`)
  const aave = await getAave()
  console.log(`  🏦 Withdrawing ${amount} ${assetSymbol} from Aave V3...`)
  const result = await aave.withdraw({ token, amount })
  console.log(`  ✅ Withdrawn! tx: ${result.hash}`)
  return result
}

export async function getAaveApys(): Promise<Record<string, { supplyApy: string; borrowApy: string }>> {
  return {
    USDC: { supplyApy: "4.2%", borrowApy: "6.1%" },
    USDT: { supplyApy: "3.8%", borrowApy: "5.9%" },
    ETH:  { supplyApy: "2.1%", borrowApy: "3.4%" },
  }
}
