/**
 * Billing Regression Tests
 *
 * Tests the actual billing calculation functions.
 * If these break, invoices are wrong = $$$
 */

import { describe, it, expect } from 'vitest'
import {
  CREDIT_RATES,
  DEFAULT_RATES,
  calculateCreditsUsed,
  calculateDollarAmount
} from '@/config/billing-rates'

describe('Credit/Dollar Rates Consistency', () => {
  it('credit value is $0.35', () => {
    expect(DEFAULT_RATES.CREDIT_VALUE).toBe(0.35)
  })

  it('dollar rates derived from credit rates correctly', () => {
    expect(DEFAULT_RATES.CPU_HOUR).toBeCloseTo(CREDIT_RATES.CPU_HOUR * 0.35, 10)
    expect(DEFAULT_RATES.GPU_HOUR).toBeCloseTo(CREDIT_RATES.GPU_HOUR * 0.35, 10)
    expect(DEFAULT_RATES.RAM_GB_HOUR).toBeCloseTo(CREDIT_RATES.RAM_GB_HOUR * 0.35, 10)
  })

  it('storage rates are fixed (Stripe prices)', () => {
    expect(DEFAULT_RATES.STORAGE_ONLINE_GB).toBe(0.50)
    expect(DEFAULT_RATES.STORAGE_OFFLINE_GB).toBe(0.03)
  })
})

describe('calculateCreditsUsed', () => {
  it('returns 0 for empty/undefined usage', () => {
    expect(calculateCreditsUsed({})).toBe(0)
    expect(calculateCreditsUsed({ cpuHours: undefined })).toBe(0)
  })

  it('calculates single resource correctly', () => {
    expect(calculateCreditsUsed({ cpuHours: 10 })).toBe(5)      // 10 * 0.5
    expect(calculateCreditsUsed({ gpuHours: 1 })).toBe(10)      // 1 * 10
    expect(calculateCreditsUsed({ ramGbHours: 100 })).toBe(5)   // 100 * 0.05
  })

  it('calculates mixed usage correctly', () => {
    const credits = calculateCreditsUsed({
      cpuHours: 100,    // 50 credits
      gpuHours: 5,      // 50 credits
      ramGbHours: 200,  // 10 credits
    })
    expect(credits).toBe(110)
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
