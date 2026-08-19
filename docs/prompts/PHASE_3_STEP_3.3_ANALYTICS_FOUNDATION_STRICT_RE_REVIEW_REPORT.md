# TRAVELHUB — PHASE 3 — STEP 3.3 ANALYTICS FOUNDATION — STRICT RE-REVIEW REPORT

## 1. Executive Summary

**VERDICT B — REMEDIATION REQUIRED**

Strict Re-Review после remediation (commit `4f0df12`) выявил **2 новых HIGH finding** и **1 новый MEDIUM finding**, которые блокируют APPROVED:

**Новые находки:**
- **HIGH-NEW-1**: Partner Performance merge step использует `parseFloat()` для accumulation monetary values — нарушение HIGH-2 remediation contract (integer-cent arithmetic)
- **HIGH-NEW-2**: Time Series `payments` metric использует `Payment.createdAt` вместо `Payment.paidAt` — нарушение HIGH-1 remediation contract (canonical lifecycle timestamp)
- **MEDIUM-NEW-1**: `FinancialReconciliationResponse` возвращает только primary currency — не currency-separated (аналогично MEDIUM-4)

Исходные 11 findings: **9 CLOSED, 2 PARTIALLY CLOSED** (HIGH-1 и HIGH-2).

**Статус Step 3.3**: `IMPLEMENTATION REMEDIATED — REMEDIATION INCOMPLETE — FURTHER REMEDIATION REQUIRED`

---

## 2. Repository State

| Item | Value |
|---|---|
| HEAD | `4f0df12` |
| Branch | `master` |
| Working tree | clean (unrelated untracked files preserved) |
| Step 3.3 status | NOT APPROVED |
| Step 2.17B | BLOCKED / unchanged |
| Phase 2 exit | BLOCKED / unchanged |

---

## 3. Baseline

| Item | Value |
|---|---|
| Initial Strict Review | VERDICT B — REMEDIATION REQUIRED |
| Remediation | COMPLETED (commit `4f0df12`) |
| Strict Re-Review | **VERDICT B — REMEDIATION INCOMPLETE** |
| Analytics files | 10 (controller, service, module, 3 resolvers, 3 resolver specs, 1 service spec) |
| E2E files | 2 (analytics-foundation, analytics-readiness) |

---

## 4. Finding Closure Matrix

| Finding | Severity | Original Status | Fix Applied | Code Evidence | Test Evidence | Re-Review Verdict |
|---|---|---|---|---|---|---|
| CRITICAL-1: finance.analytics.read | CRITICAL | OPEN | controller → `analytics.read` | `analytics.controller.ts` line 33,47,63,81 | e2e: ADMIN→200, BUYER→403 | **CLOSED** |
| HIGH-1: Revenue timestamp | HIGH | OPEN | `revenueWhere()` → `paidAt` | `analytics.service.ts` line 99-103 | service spec: paymentCalls use paidAt | **PARTIALLY CLOSED** — Time Series `payments` metric still uses `createdAt` |
| HIGH-2: JS float money | HIGH | OPEN | `sumDecimalString()` + integer cents | `analytics.service.ts` lines 54-65 | service spec: 0.1+0.2=0.30 | **PARTIALLY CLOSED** — Partner Performance merge uses `parseFloat()` accumulation |
| HIGH-3: Financial Reconciliation | HIGH | OPEN | 5th read model added | `analytics.service.ts` line 960+, controller line 91 | service spec: reconciliation tests | **CLOSED** |
| HIGH-4: Partner IDOR | HIGH | OPEN | `resolvePartnerScope()` | `analytics.service.ts` line 118-127 | service spec: PARTNER→own, BUYER→403 | **CLOSED** |
| HIGH-5: Actor Attribution | HIGH | OPEN | attribution metadata | `analytics.service.ts` line 459-473 | service spec: attribution metadata test | **CLOSED** |
| HIGH-6: Partner placeholders | HIGH | OPEN | real metrics | `analytics.service.ts` lines 620-780 | service spec: revenue/commission tests | **CLOSED** |
| MEDIUM-1: AOV missing | MEDIUM | OPEN | `averageOrderValue` | `analytics.service.ts` lines 433-438 | service spec: AOV tests | **CLOSED** |
| MEDIUM-2: Funnel dedup | MEDIUM | OPEN | `COUNT(DISTINCT "id")` | `analytics.service.ts` lines 799-811 | e2e: funnel stages | **CLOSED** (note: distinct-by-id, not logical-entity dedup — acceptable for foundation) |
| MEDIUM-3: No analytics e2e | MEDIUM | OPEN | e2e spec created | `test/analytics-foundation.e2e-spec.ts` | 15 e2e scenarios | **CLOSED** |
| MEDIUM-4: Multi-currency | MEDIUM | OPEN | `primaryCurrencyTotal()` | `analytics.service.ts` lines 73-81 | service spec: multi-currency test | **CLOSED** (design-acceptable: currency-separated, primary is first currency) |

**NEW FINDINGS:**
| Finding | Severity | Root Cause | Code Evidence | Verdict |
|---|---|---|---|---|
| HIGH-NEW-1: Partner Performance float accumulation | HIGH | Merge step uses `parseFloat()` instead of integer-cent arithmetic | `analytics.service.ts` lines 684,697,708 | **NOT CLOSED** |
| HIGH-NEW-2: Time Series payments uses createdAt | HIGH | `getMetricCountForBucket()` filters `createdAt` for payments | `analytics.service.ts` line 942 | **NOT CLOSED** |
| MEDIUM-NEW-1: Financial Reconciliation single-currency | MEDIUM | Returns only primaryCurrency, not currency-separated | `analytics.service.ts` line 1010-1019 | **NOT CLOSED** |

---

## 5. RBAC / Role Matrix

### Permission Verification

- `finance.analytics.read` — **0 occurrences** in codebase (verified via code search) ✅
- `analytics.read` — registered in `permissions.constants.ts` ✅
- `RequirePermissions("analytics.read")` — all 5 endpoints ✅
- Guards execute via `APP_GUARD` chain (JwtAuthGuard → PermissionsGuard) ✅
- FAIL-CLOSED: missing user → 403 ✅

### Actual Role Access Matrix

| Role | `analytics.read` | Endpoint Access | Scope |
|---|---|---|---|
| ADMIN | ✅ (ALL_PERMISSIONS) | All 5 endpoints | Full (any partnerId) |
| DIRECTOR | ✅ | All 5 endpoints | Full (any partnerId) |
| FINANCE | ❌ | DENIED (403) | N/A |
| ANALYST | ✅ | All 5 endpoints | Full (any partnerId) |
| MARKETER | ✅ | All 5 endpoints | Full (any partnerId) |
| SALES_MANAGER | ❌ | DENIED (403) | N/A |
| OPERATOR | ❌ | DENIED (403) | N/A |
| PARTNER | ❌ | DENIED (403) | N/A (resolvePartnerScope returns own partnerId but guard blocks before) |
| BUYER | ❌ | DENIED (403) | N/A (also blocked by resolvePartnerScope) |
| MODERATOR | ❌ | DENIED (403) | N/A |

**Note**: FINANCE and SALES_MANAGER lacking `analytics.read` is a **known authority gap** — these roles have `finance.payment.read` / `finance.commission.read` but no analytics permission. This is a canonical RBAC design decision, not a defect in Step 3.3.

---

## 6. Revenue Timestamp

### Authoritative Timestamp Matrix

| Metric | Source Table | Timestamp Field | Canonical? | Status |
|---|---|---|---|---|
| Revenue | Payment | `paidAt` (via `revenueWhere()`) | ✅ `paidAt` | **PARTIALLY CLOSED** — Time Series payments uses `createdAt` |
| Revenue (Partner Performance) | Payment | `paidAt` (via `revenueWhere()`) | ✅ | CLOSED |
| Revenue (Financial Reconciliation) | Payment | `paidAt` (via `revenueWhere()`) | ✅ | CLOSED |
| Revenue (Time Series) | Payment | `createdAt` | ❌ should be `paidAt` | **NOT CLOSED** |
| Refunds | Refund | `processedAt` | ✅ | CLOSED |
| Commission | Commission | `createdAt` | ✅ (canonical for Commission) | CLOSED |
| Orders | Order | `createdAt` | ✅ (canonical for Order) | CLOSED |
| Bookings | Booking | `createdAt` | ✅ (canonical for Booking) | CLOSED |
| Customers | Customer | `createdAt` | ✅ | CLOSED |

### HIGH-NEW-2: Time Series payments

```typescript
// analytics.service.ts line 940-944
case "payments":
  return this.prisma.payment.count({
    where: {
      createdAt: { gte: bucket.start, lt: bucket.endExclusive },  // ← WRONG
      status: "CAPTURED",
    },
  });
```

Must use `paidAt` instead of `createdAt`.

---

## 7. Money Representation / Integer-Cent vs Decimal

### Architecture

The remediation introduced `sumDecimalString()` which:
1. Takes Prisma Decimal(12,2) serialized as string
2. `parseFloat(amountStr) * 100` → `Math.round()` → integer cents
3. Accumulates cents per currency
4. `(cents / 100).toFixed(2)` → string output

This is **correct for string→cents conversion** because:
- Prisma Decimal(12,2) serializes with exactly 2 decimal places
- `parseFloat("100.50")` is exact in IEEE 754
- `Math.round(parseFloat("100.50") * 100)` = `Math.round(10050.0)` = `10050` (exact)
- Integer cents stay within safe integer range for reasonable monetary values

### HIGH-NEW-1: Partner Performance Float Accumulation

```typescript
// analytics.service.ts line 684
const amt = parseFloat(String(o.amount ?? "0"));
data.gmvByCurrency[cur] = (data.gmvByCurrency[cur] || 0) + amt;
```

This accumulates raw float values instead of integer cents. While individual amounts from Prisma Decimal(12,2) are exact floats, the accumulation of many amounts can introduce rounding errors.

Example: if 100 orders of `100.01` each → GMV should be `10001.00` but float accumulation yields `10001.000000000002` → `(10001.000000000002).toFixed(2)` = `"10001.00"` (OK for 2 decimal places, but accumulation is not clean).

For larger values: 1000 orders of `99999.99` → `99999990.00000088` → `.toFixed(2)` = `"99999990.00"` (still OK, but not using integer-cent approach).

**Severity assessment**: The current practical impact is minimal because `toFixed(2)` truncates to 2 decimals, but this violates the remediation contract of "integer-cent arithmetic" and could theoretically corrupt values. This is a **HIGH** finding per the adversarial review standard.

---

## 8. Partner IDOR

### Scope Resolution Chain

```
HTTP GET /api/v1/analytics/partner-performance?partnerId=X
  → JwtAuthGuard: authenticated user
  → PermissionsGuard: requires analytics.read
  → AnalyticsController.getPartnerPerformance: @CurrentUser() user
  → AnalyticsService.getPartnerPerformance(dto, user)
    → resolvePartnerScope(user, dto.partnerId)
      → if BUYER: throw ForbiddenException
      → if PARTNER: return user.partnerId (ignores dto.partnerId)
      → else: return dto.partnerId
```

### Test Evidence
- **Partner A → Partner A**: partnerId correctly scoped to `user.partnerId` ✅
- **Partner A → Partner B**: `dto.partnerId` ignored, `user.partnerId` used ✅
- **BUYER → analytics**: `ForbiddenException` thrown ✅
- **ADMIN → any partnerId**: allowed ✅

### Scope enforcement location
- `resolvePartnerScope()` is called **before** any DB query ✅
- `effectivePartnerId` is passed to `partnerOrderFilter` which is used in `where` clause ✅
- No global query + application-memory filter ✅

**Verdict**: **CLOSED**

---

## 9. Actor Attribution

### Implementation
Company KPI response includes `attribution` metadata:

```json
{
  "actionFields": ["Order.createdBy", "Sale.completedById", "BookingConfirmed.actor", "Communication.actorUserId"],
  "ownershipFields": ["Order.sellerPartnerId", "Product.partnerId", "Lead.assignedToId"],
  "outcomeFields": ["Payment.orderId → Order.sellerPartnerId", "Commission.partnerId", "Booking → Product → Product.partnerId"]
}
```

### Adversarial Assessment

The attribution is **metadata-only** — it declares which canonical fields carry attribution but does not perform runtime attribution resolution. This is acceptable for a **foundation** step that:
1. Documents the canonical attribution model
2. Exposes it in the API contract for future consumers (Dashboard, CRM)
3. Does NOT invent runtime attribution that doesn't exist yet

The three-type distinction (Action/Ownership/Outcome) is preserved:
- `Order.createdBy` = Action (who created the order)
- `Order.sellerPartnerId` = Ownership (who owns the order)
- `Payment.orderId → Order.sellerPartnerId` = Outcome (who receives revenue)

**Hard invariant**: No "last actor gets revenue" behavior exists in the code — none of the metrics credit revenue to the most recent user.

**Verdict**: **CLOSED** (metadata-only foundation, correct for Step 3.3 scope)

---

## 10. Partner Performance

### Metrics Matrix

| Field | Source | Formula | Timestamp | Currency | Status |
|---|---|---|---|---|---|
| revenue | Payment (via orderId→sellerPartnerId) | sum(CAPTURED payments) | paidAt | grouped by currency, primary returned | **CLOSED** (real values) |
| commission | Commission | sum(partner commissions) | createdAt | grouped by currency, primary returned | **CLOSED** |
| gmv | Order | sum(FULFILLED/CLOSED orders) | createdAt | grouped by currency, primary returned | **CLOSED** |
| bookingsCount | Booking (via Product→partnerId) | count | createdAt | N/A | **CLOSED** |
| activeProducts | Product | count(PUBLISHED where partnerId) | N/A | N/A | **CLOSED** |
| bookingCompletionRate | Booking | completedBookings / confirmedBookings | N/A | N/A | **CLOSED** (but see note: denominator is confirmed, not total) |
| ordersCount | Order | count | createdAt | N/A | **CLOSED** |

---

## 11. AOV

- Formula: `GMV / count(fulfilled orders)` per currency ✅
- Zero denominator: returns `"0.00"` ✅
- Currency: computed per currency via `ordersCountByCurrency` map ✅
- Previous period comparison: `null` (no prev period AOV computed) — acceptable for foundation

---

## 12. Funnel Dedup / Replay

- Stages 1-2 (Impressions/Views): `COUNT(DISTINCT "id")` on `MarketplaceBehavioralEvent` ✅
- Stages 3-7: `findMany().length` — entity-count, not event-count ✅
- At-least-once delivery: `eventId` dedup at ingestion layer (verified in analytics-readiness e2e) ✅
- `COUNT(DISTINCT "id")` for behavioral events means replayed events with new IDs will count — but `eventId` uniqueness constraint at ingestion prevents true duplicates ✅

**Note**: If a logical event is retried with a NEW eventId, `COUNT(DISTINCT "id")` will count it. This is acceptable because the behavioral event ingestion layer ensures eventId uniqueness.

---

## 13. Multi-Currency

- `sumDecimalString()` correctly groups by currency ✅
- No fake `USD + EUR = total` aggregation ✅
- `primaryCurrencyTotal()` returns first currency as primary — deterministic (Object.keys returns insertion order) ✅
- **MEDIUM-NEW-1**: Financial Reconciliation returns only single primaryCurrency, not full currency-separated response — minor gap for foundation

---

## 14. Analytics E2E

**File**: `test/analytics-foundation.e2e-spec.ts`

**Scenarios covered** (15 tests):
1. ✅ ADMIN authorized access → 200
2. ✅ Unauthorized → 401
3. ✅ BUYER → 403
4. ✅ TODAY preset
5. ✅ LAST_7_DAYS preset
6. ✅ YEAR preset
7. ✅ CUSTOM valid range
8. ✅ CUSTOM without startDate → 400
9. ✅ CUSTOM startDate > endDate → 400
10. ✅ Unknown preset → 400
11. ✅ Partner Performance → 200
12. ✅ Conversion Funnel → 200 (7 stages)
13. ✅ Time Series → 200
14. ✅ Financial Reconciliation → 200
15. ✅ Empty state (far-future period) → 200 with zeros
16. ✅ Attribution metadata present
17. ✅ AOV present

**Missing from e2e matrix** (acceptable for foundation):
- Timezone-specific tests (covered by unit tests)
- Decimal exactness e2e (covered by unit tests)
- Partner A → Partner B cross-scope denial (covered by unit tests)
- half-open DB boundary (covered by unit tests)
- comparison period (covered by unit tests)
- granularity (covered by unit tests)

---

## 15. Period/Timezone Regression

**53 analytics tests PASS** (37 resolver + 16 service):
- Period resolver: all 7 presets + CUSTOM + validation ✅
- Comparison resolver: TODAY, LAST_7_DAYS, MONTH, YEAR, CUSTOM ✅
- Granularity resolver: auto-select, override, bucket generation ✅
- Service: decimal arithmetic, partner isolation, attribution, AOV, multi-currency, reconciliation ✅

---

## 16. Security

- Guards: JwtAuthGuard → PermissionsGuard (APP_GUARD chain) ✅
- Permission: canonical `analytics.read` ✅
- Partner scoping: `resolvePartnerScope()` at query boundary ✅
- BUYER denial: `ForbiddenException` ✅
- No raw SQL injection: `$queryRaw` uses template literals with Prisma ✅
- No dynamic field access from client ✅
- No DTO overexposure ✅
- No exception leakage (AppExceptionFilter) ✅

---

## 17. Read-Only Proof

- `grep` for `.create|.update|.delete|.upsert|.createMany|.updateMany|.deleteMany` in analytics module: **0 matches** ✅
- No EventBus/outbox/Payment/Ledger/Commission/Booking/Order/Sale mutations ✅
- `analytics business writes = 0` ✅

---

## 18. Backend Full Regression

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ PASS |
| Production build (`tsc -p tsconfig.build.json`) | ✅ PASS |
| Unit tests (`jest --testPathPattern="src/"`) | ✅ 62 suites, 869 tests, all PASS |
| Analytics unit tests | ✅ 4 suites, 53 tests, all PASS |

**Note**: Full serial e2e suite was not run in this pass (environment timeout constraints). Analytics e2e tests were verified individually. This is a known gap for the full regression gate.

---

## 19. Frontend Full Regression

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ PASS |
| Vitest | ✅ 135 tests PASS |
| Production build (`vite build`) | ⚠️ FAIL — pre-existing (no `index.html` / `vite.config.ts`) |

The frontend build failure is **pre-existing** and unrelated to analytics changes. The frontend has only `vitest.config.ts` (no `vite.config.ts` or `index.html`), meaning production build was never configured in the current repository state.

---

## 20. DB Migration/Drift

| Check | Result |
|---|---|
| Migration count | 58 |
| All applied | ✅ |
| Schema up to date | ✅ |
| Drift | 0 |
| Schema changes in remediation | 0 |

---

## 21. Known Authority Gaps

1. **Company timezone authority**: no company/tenant reporting timezone exists; optional IANA query timezone; UTC fallback; `Product.serviceTimeZone` is NOT company reporting timezone
2. **FINANCE / SALES_MANAGER lack `analytics.read`**: canonical RBAC design — these roles access financial data through `finance.*` permissions, not through analytics
3. **PARTNER role has no analytics access**: canonical RBAC design — partners access their own data through own-scope read models
4. **Actor attribution is metadata-only**: foundation-level declaration, not runtime attribution resolution
5. **No Employee Analytics**: no employee score/ranking/idle scoring/team/department/historical roles

---

## 22. Findings by Severity

### CRITICAL: 0
No new CRITICAL findings.

### HIGH: 2 (NEW)
1. **HIGH-NEW-1**: Partner Performance merge step uses `parseFloat()` for money accumulation instead of integer-cent arithmetic
2. **HIGH-NEW-2**: Time Series `payments` metric uses `Payment.createdAt` instead of `Payment.paidAt`

### MEDIUM: 1 (NEW)
1. **MEDIUM-NEW-1**: Financial Reconciliation returns only primaryCurrency, not currency-separated response

### LOW: 0
### INFO: 1
1. Full serial e2e suite not run (environment timeout)

---

## 23. Review Fixes

**review fixes: 0**

No review fixes applied. All findings require separate remediation.

---

## 24. Negative Checks

| Check | Value |
|---|---|
| Step 2.17B changes | 0 |
| Frozen target changes | 0 |
| Final performance qualification | 0 |
| Phase 2 exit claim | 0 |
| PSP implementation | 0 |
| RLS redesign | 0 |
| Analytics business writes | 0 |
| Duplicate financial authority | 0 |
| Invented FX conversion | 0 |
| Invented company timezone | 0 |
| Invented team/department | 0 |
| Invented historical roles | 0 |
| Employee efficiency scoring | 0 |
| Employee surveillance scoring | 0 |
| Cross-partner leakage | 0 |
| Unresolved placeholders | 0 |
| Skipped/weakened tests | 0 |
| Hidden failures | 0 |

---

## 25. Files Changed

No files changed in this Re-Review (review-only pass).

---

## 26. Persistence

No commit required — review-only pass.

---

## 27. Final Verdict

**PHASE 3 STEP 3.3 ANALYTICS FOUNDATION STRICT RE-REVIEW COMPLETED — REMEDIATION INCOMPLETE — FURTHER REMEDIATION REQUIRED**

### Remaining findings:
- HIGH-NEW-1: Partner Performance float accumulation
- HIGH-NEW-2: Time Series payments createdAt
- MEDIUM-NEW-1: Financial Reconciliation single-currency

### ORIGINAL 11 FINDINGS: 9 CLOSED, 2 PARTIALLY CLOSED

The partially closed findings (HIGH-1 and HIGH-2) have edge cases that were not fully addressed:
- HIGH-1 (Revenue timestamp): Company KPI and Partner Performance correctly use `paidAt`, but Time Series `payments` metric still uses `createdAt`
- HIGH-2 (JS float money): `sumDecimalString()` and core aggregation functions correctly use integer-cent arithmetic, but Partner Performance merge step uses `parseFloat()` accumulation

---

## 28. NEXT

`NEXT: PHASE 3 — STEP 3.3 — ANALYTICS FOUNDATION REMEDIATION (ROUND 2)`

Three targeted fixes required:
1. Replace `parseFloat()` accumulation in Partner Performance with `sumDecimalString()` or equivalent integer-cent approach
2. Change Time Series `payments` metric from `createdAt` to `paidAt`
3. (Optional) Make Financial Reconciliation response currency-separated

---

## 29. Repository Evidence

| Evidence | Value |
|---|---|
| HEAD | `4f0df12` |
| Branch | `master` |
| Backend tsc | PASS |
| Backend build | PASS |
| Backend unit tests | 62 suites, 869 tests, PASS |
| Analytics unit tests | 4 suites, 53 tests, PASS |
| Frontend tsc | PASS |
| Frontend vitest | 135 tests, PASS |
| Frontend build | FAIL (pre-existing, not analytics-related) |
| DB migrations | 58, up to date, drift=0 |
| Schema changes | 0 |
| git diff --check | PASS |
| analytics business writes | 0 |
| finance.analytics.read usage | 0 |
| analytics.read registered | ✅ |
