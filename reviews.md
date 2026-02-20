# Code Review Findings

## 2026-02-20 — Project sync in billing paths

### Must-fix

1. **syncUserProjects() return value ignored** (CRITICAL)
   - 4 call sites: billing.ts (x2), stripe.ts (x2)
   - If Hopsworks is down, we make billing decisions on stale data without knowing
   - Fix: check return, log on failure, use `alertBillingFailure` in stripe.ts

2. **No try/catch around syncUserProjects() in billing.ts** (HIGH)
   - Unexpected throw crashes the entire billing endpoint (user sees 500)
   - Fix: wrap in try/catch, continue with stale data rather than failing

3. **numActiveProjects type still declared** (MEDIUM)
   - Removed from API response but still in dashboard.tsx and types/api.ts
   - Fix: remove from interfaces
