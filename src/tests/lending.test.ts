import { describe, it, expect } from 'vitest'
import { AAVE_ASSETS } from '../services/lending.js'

describe('lending constants', () => {
  it('has correct USDT address on Arbitrum', () => {
    expect(AAVE_ASSETS.USDT).toBe('0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9')
  })

  it('has correct USDC address on Arbitrum', () => {
    expect(AAVE_ASSETS.USDC).toBe('0xaf88d065e77c8cC2239327C5EDb3A432268e5831')
  })

  it('has exactly 2 supported assets', () => {
    expect(Object.keys(AAVE_ASSETS).length).toBe(2)
  })
})
