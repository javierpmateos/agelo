import 'dotenv/config'
import { getArbAccount } from './src/wallet/wdk-setup.js'

async function main() {
  const a = await getArbAccount()
  const addr = await a.getAddress()
  const bal = await a.getTokenBalance('0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9')
  console.log('Address:', addr)
  console.log('USDT:', Number(bal) / 1e6)
  process.exit(0)
}
main()
