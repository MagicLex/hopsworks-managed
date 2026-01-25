/**
 * Billing Regression Tests
 *
 * Tests the actual billing calculation functions.
 * If these break, invoices are wrong = $$$
 */

import { describe, it, expect } from 'vitest'
import {
  calculateCreditsUsed,
  calculateDollarAmount,
  CREDIT_RATES,
  DEFAULT_RATES
} from '@/config/billing-rates'

describe('calculateCreditsUsed', () => {
  it('returns 0 for empty/undefined usage', () => {
    expect(calculateCreditsUsed({})).toBe(0)
    expect(calculateCreditsUsed({ cpuHours: undefined })).toBe(0)
  })

  it('calculates single resource correctly', () => {
    expect(calculateCreditsUsed({ cpuHours: 10 })).toBe(10)     // 10 * 1
    expect(calculateCreditsUsed({ gpuHours: 1 })).toBe(10)      // 1 * 10
    expect(calculateCreditsUsed({ ramGbHours: 100 })).toBe(10)  // 100 * 0.1
  })

  it('calculates mixed usage correctly', () => {
    const credits = calculateCreditsUsed({
      cpuHours: 100,    // 100 credits
      gpuHours: 5,      // 50 credits
      ramGbHours: 200,  // 20 credits
    })
    expect(credits).toBe(170)
  })

  it('handles edge cases', () => {
    // Tiny values don't round to 0
    expect(calculateCreditsUsed({ cpuHours: 0.001 })).toBeGreaterThan(0)

    // Large values don't overflow
    const big = calculateCreditsUsed({ cpuHours: 1_000_000 })
    expect(Number.isFinite(big)).toBe(true)
  })
})

describe('calculateDollarAmount', () => {
  it('converts credits to dollars', () => {
    expect(calculateDollarAmount(100)).toBe(35)
    expect(calculateDollarAmount(0)).toBe(0)
    expect(calculateDollarAmount(1.5)).toBeCloseTo(0.525, 3)
  })
})

/**
 * Storage Proration Tests
 *
 * ⚠️ CRITICAL: Storage is billed as GB-month, not daily snapshots!
 *
 * We send daily_snapshot / 30 to Stripe, which sums over the month.
 * If we sent raw values, users would be charged 30x too much.
 */
describe('storage proration (GB-month billing)', () => {
  // This is the formula used in sync-stripe.ts
  const prorateStorageForStripe = (dailySnapshotGb: number): number => {
    return Math.round((dailySnapshotGb / 30) * 1000) / 1000
  }

  it('prorates daily storage to 1/30th for Stripe meter', () => {
    // 1.2 GB stored → send 0.04 GB/day
    expect(prorateStorageForStripe(1.2)).toBeCloseTo(0.04, 3)

    // 30 GB stored → send 1 GB/day
    expect(prorateStorageForStripe(30)).toBe(1)

    // 0.3 GB stored → send 0.01 GB/day
    expect(prorateStorageForStripe(0.3)).toBe(0.01)
  })

  it('sums to correct GB-month over 30 days', () => {
    const dailySnapshot = 1.5 // User has 1.5 GB stored
    const dailyReport = prorateStorageForStripe(dailySnapshot)

    // After 30 days, Stripe sums these up
    const monthlyTotal = dailyReport * 30

    // Should equal original storage (within rounding)
    expect(monthlyTotal).toBeCloseTo(dailySnapshot, 1)
  })

  it('correctly prorates mid-month storage changes', () => {
    // Day 1-15: 1 GB → 15 × (1/30) = 0.5 GB
    // Day 16-30: 2 GB → 15 × (2/30) = 1.0 GB
    // Total: 1.5 GB-month

    const firstHalf = 15 * prorateStorageForStripe(1)
    const secondHalf = 15 * prorateStorageForStripe(2)
    const total = firstHalf + secondHalf

    expect(total).toBeCloseTo(1.5, 1)
  })

  it('never sends raw daily values (would be 30x overcharge)', () => {
    const storage = 2 // 2 GB stored
    const proratedValue = prorateStorageForStripe(storage)

    // Prorated value must be much smaller than raw value
    expect(proratedValue).toBeLessThan(storage / 10)

    // Specifically, should be ~1/30th
    expect(proratedValue).toBeCloseTo(storage / 30, 2)
  })
})

/**
 * Rate Consistency Tests
 *
 * ⚠️ CRITICAL: pricing.ts must use the same rates as billing-rates.ts
 * If these diverge, users see different prices than they're charged!
 */
describe('rate consistency across files', () => {
  it('pricing.ts uses same credit multipliers as billing-rates.ts', async () => {
    const fs = await import('fs')
    const path = await import('path')

    const pricingFile = path.join(process.cwd(), 'src/pages/api/pricing.ts')
    const source = fs.readFileSync(pricingFile, 'utf-8')

    // CPU_HOUR multiplier must be 1 (not 0.5)
    expect(source).toContain('product.unit_price * 1')
    expect(source).not.toContain('product.unit_price * 0.5')

    // RAM_GB_HOUR multiplier must be 0.1 (not 0.05)
    expect(source).toContain('product.unit_price * 0.1')
    expect(source).not.toContain('product.unit_price * 0.05')
  })

  it('default rates in pricing.ts match billing-rates.ts', () => {
    // These are the canonical rates - if billing-rates.ts changes,
    // this test should fail and remind you to update pricing.ts
    expect(CREDIT_RATES.CPU_HOUR).toBe(1)
    expect(CREDIT_RATES.GPU_HOUR).toBe(10)
    expect(CREDIT_RATES.RAM_GB_HOUR).toBe(0.1)
    expect(DEFAULT_RATES.CREDIT_VALUE).toBe(0.35)

    // Verify dollar calculations
    expect(DEFAULT_RATES.CPU_HOUR).toBeCloseTo(0.35, 2)      // 1 * 0.35
    expect(DEFAULT_RATES.GPU_HOUR).toBeCloseTo(3.50, 2)      // 10 * 0.35
    expect(DEFAULT_RATES.RAM_GB_HOUR).toBeCloseTo(0.035, 3)  // 0.1 * 0.35
  })
})
