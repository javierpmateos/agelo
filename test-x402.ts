import 'dotenv/config'
import { getPlasmaAccount } from './src/wallet/wdk-setup.js'
import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { registerExactEvmScheme } from '@x402/evm/exact/client'

async function main() {
  const account = await getPlasmaAccount()
  const addr = await account.getAddress()
  console.log(`Plasma wallet: ${addr}`)

  const client = new x402Client()
  registerExactEvmScheme(client, { signer: account as any })
  const fetchWithPayment = wrapFetchWithPayment(fetch, client)

  console.log('\nCalling /api/aave-rates with x402...')
  const res = await fetchWithPayment('http://localhost:4021/api/aave-rates')

  console.log('Status:', res.status)
  console.log('Headers:')
  res.headers.forEach((val, key) => console.log(`  ${key}: ${val}`))

  const data = await res.json()
  console.log('\nData:', JSON.stringify(data, null, 2))
}

main().catch(console.error)
