# TravelHub — Step 3.3 Analytics Foundation — Design Addendum
## Time/Period Contract + Actor/Employee Attribution Foundation

**Date:** 2026-08-19
**Parent:** Step 3.3 Analytics Foundation Design (`docs/architecture/analytics-foundation-3.3.md`)
**Status:** DESIGN ADDENDUM (not implemented)
**Base commit:** `497e951`

---

## 1. Purpose

Close two foundation-level design gaps before Step 3.3 implementation begins:

1. Define a reusable Analytics **Time/Period Contract**
2. Ensure the Analytics Foundation can support future **Actor/Employee attribution** without prematurely designing Employee Analytics

---

## 2. Time/Period Contract

### 2.1 Period Presets

```typescript
enum AnalyticsPeriodPreset {
  TODAY
  LAST_3_DAYS
  LAST_7_DAYS
  MONTH           // current calendar month
  LAST_6_MONTHS   // trailing 6 calendar months
  YEAR            // current calendar year
  CUSTOM          // explicit startDate + endDate
}
```

### 2.2 Custom Period

```typescript
interface CustomPeriod {
  startDate: string  // ISO 8601 date (YYYY-MM-DD), inclusive
  endDate: string    // ISO 8601 date (YYYY-MM-DD), inclusive
}
```

**Hard requirements:**
- CUSTOM without startDate or endDate → reject (400)
- startDate > endDate → reject (400)
- Invalid date format → reject (400)
- Empty period (startDate == endDate) → valid (single-day period)

### 2.3 Period Resolution

Every preset resolves to a half-open interval `[startInstant, endExclusiveInstant)` in UTC:

| Preset | startInstant (UTC) | endExclusiveInstant (UTC) | Semantics |
|---|---|---|---|
| TODAY | businessTZ midnight today | businessTZ midnight tomorrow | calendar day in business timezone |
| LAST_3_DAYS | businessTZ midnight 3 days ago | businessTZ midnight tomorrow | current day + previous 2 calendar days |
| LAST_7_DAYS | businessTZ midnight 7 days ago | businessTZ midnight tomorrow | current day + previous 6 calendar days |
| MONTH | businessTZ midnight 1st of month | businessTZ midnight 1st of next month | current calendar month |
| LAST_6_MONTHS | businessTZ midnight 1st of month, 6 months ago | businessTZ midnight 1st of current month | 6 complete calendar months before current |
| YEAR | businessTZ midnight Jan 1 | businessTZ midnight Jan 1 next year | current calendar year |
| CUSTOM | businessTZ midnight startDate | businessTZ midnight (endDate + 1 day) | explicit date range |

**Note on "last N days":** These are **calendar-day presets**, NOT rolling-hour windows. "Last 7 days" means "today + previous 6 calendar days" (7 calendar days total), NOT "rolling 168 hours". This is the canonical product intent.

### 2.4 Timezone Semantics

#### 2.4.1 Authority Gap

**The repository has NO authoritative company/tenant/user timezone.**

Existing timezone references:
- `Product.serviceTimeZone` — IANA timezone for service occurrence (STEP 2.8A). This is the **service location timezone**, NOT a business reporting timezone.
- All other timestamps are stored and queried in UTC.

**Gap:** Business reporting periods like TODAY must be evaluated against an authoritative business timezone, but none exists yet.

#### 2.4.2 Resolution Contract

Until an authoritative business timezone is defined:

1. **Storage and internal queries:** UTC (unchanged)
2. **API period resolution:** Accept an optional `timezone` parameter (IANA ID, e.g. `"Asia/Baku"`)
3. **Fallback:** If no timezone is provided, use `UTC` as the default
4. **Future:** When a company/tenant timezone is introduced, it becomes the default; API timezone parameter overrides per-request

```typescript
interface AnalyticsPeriodRequest {
  preset: AnalyticsPeriodPreset
  startDate?: string    // required for CUSTOM
  endDate?: string      // required for CUSTOM
  timezone?: string     // IANA ID; default: "UTC"
}
```

#### 2.4.3 DST Behavior

- Period boundaries are computed in the specified timezone
- DST transitions are handled by the timezone library (e.g. `Intl.DateTimeFormat` with `timeZone` option)
- No manual DST arithmetic
- Ambiguous times (fall-back) use the earlier occurrence
- Non-existent times (spring-forward) resolve to the next valid time

### 2.5 Boundary Semantics

All periods use **half-open intervals** `[startInstant, endExclusiveInstant)`:

```sql
-- Example: TODAY in UTC
WHERE "createdAt" >= '2026-08-19T00:00:00Z'
  AND "createdAt" <  '2026-08-20T00:00:00Z'

-- Example: MONTH in UTC
WHERE "createdAt" >= '2026-08-01T00:00:00Z'
  AND "createdAt" <  '2026-09-01T00:00:00Z'
```

**Inclusive start, exclusive end.** This is mathematically unambiguous and avoids double-counting at boundaries.

### 2.6 Comparison Period Contract

Every resolved period supports a comparison against an equivalent preceding period.

#### 2.6.1 Calendar Presets

For calendar-aligned presets, comparison uses the **preceding calendar unit**:

| Preset | Current | Comparison | Algorithm |
|---|---|---|---|
| TODAY | today | yesterday | current.start − 1 day → current.end − 1 day |
| LAST_3_DAYS | 3 calendar days | preceding 3 calendar days | current.start − 3 days → current.start |
| LAST_7_DAYS | 7 calendar days | preceding 7 calendar days | current.start − 7 days → current.start |
| MONTH | current month | previous month | monthStart(current − 1) → monthStart(current) |
| LAST_6_MONTHS | 6 months | preceding 6 months | current.start − 6 months → current.start |
| YEAR | current year | previous year | yearStart(current − 1) → yearStart(current) |

#### 2.6.2 Custom Period

For CUSTOM, comparison uses **equivalent duration immediately preceding**:

```
comparison.start = current.start − duration
comparison.end   = current.start
```

Where `duration = current.end − current.start`.

**Example:**
- Current: `2026-04-15 → 2026-05-14` (30 days)
- Comparison: `2026-03-16 → 2026-04-14` (30 days, ending the day before current starts)

#### 2.6.3 Comparison Result Structure

```typescript
interface ComparisonResult<T> {
  current: T
  previous: T
  delta: T              // current − previous (absolute)
  deltaPercent: number | null  // (current − previous) / previous × 100
  // null when previous is 0 or unavailable
}
```

**Behavior when previous is 0, null, or unavailable:**
- `delta` = current value (or null if current is also null)
- `deltaPercent` = null (division by zero avoided)
- The UI layer is responsible for interpreting direction/trend; the foundation does NOT assign good/bad coloring

**Important:** A positive delta is NOT universally positive. Increased cancellations, refunds, or response times may be negative business outcomes. The foundation provides raw numbers; interpretation is domain-specific.

### 2.7 Time Granularity

Granularity is **automatically selected** based on period duration, but can be overridden via API:

```typescript
enum AnalyticsGranularity {
  HOUR
  DAY
  WEEK
  MONTH
  QUARTER
  YEAR
}
```

**Automatic selection rules:**

| Period Duration | Default Granularity | Rationale |
|---|---|---|
| 1 day (TODAY) | HOUR | intra-day patterns |
| 2–7 days | DAY | daily trends |
| 8–90 days (MONTH, LAST_3_DAYS extended) | DAY | daily with weekly aggregation |
| 91–365 days (LAST_6_MONTHS, YEAR) | WEEK or MONTH | weekly/monthly trends |
| > 365 days | MONTH | monthly trends |

**Override:** Consumer may request a specific granularity. If the requested granularity is finer than the period supports (e.g. HOUR for a 6-month period), the request is rejected or automatically coarsened.

### 2.8 Multiple Business Timestamps

Analytics must not collapse all facts onto `createdAt`. Each metric uses the **authoritative timestamp** for its business meaning:

| Timestamp | Source | Semantic | Use For |
|---|---|---|---|
| `createdAt` | All entities | Record creation (persistence time) | General counting, creation trends |
| `publishedAt` | Product | Product went live | Product analytics |
| `completedAt` | Sale, Booking | Business completion | Completion metrics |
| `cancelledAt` | Booking, Order | Cancellation | Cancellation metrics |
| `paidAt` | Payment | Money received | Revenue metrics |
| `requestedAt` | Booking, Refund | Request initiated | Request-to-completion timing |
| `confirmedAt` | Booking | Supplier confirmed | Confirmation time |
| `rejectedAt` | Booking | Supplier rejected | Rejection metrics |
| `processedAt` | Refund | Refund executed | Refund timing |
| `accruedAt` | CommissionAccrual | Financial recognition | Commission timing |
| `issuedAt` | Quote | Quote sent to buyer | Quote-to-sale timing |
| `occurredAt` | OutboxEvent, Behavioral | Business fact occurred | Event-based metrics |
| `serviceDate` | Order, Booking | Service delivery date | Tourism-specific analytics |
| `occurredAt` | LedgerTransaction | Financial fact occurrence | Ledger analytics |

**Rule:** Every metric definition specifies which timestamp is authoritative. If a metric uses `createdAt` but the business meaning is "when the service was completed", the metric definition must use `completedAt` instead.

### 2.9 Validation Contract

| Rule | Response |
|---|---|
| Unknown preset | 400 Bad Request |
| CUSTOM without startDate | 400 Bad Request |
| CUSTOM without endDate | 400 Bad Request |
| startDate > endDate | 400 Bad Request |
| Invalid date format | 400 Bad Request |
| Invalid timezone (unknown IANA) | 400 Bad Request |
| Unsupported granularity | 400 Bad Request |
| Granularity finer than period supports | 400 Bad Request or auto-coarsen |

Error format follows repository conventions (structured error response with code and message).

---

## 3. Actor/Employee Attribution Foundation

### 3.1 Identity Inventory

The repository has the following identity concepts:

| Concept | Source | Fields | Scope |
|---|---|---|---|
| **User** | `security.User` | id, code, username, email, fullName, roleId, partnerId, customerId, status | organization-wide |
| **Role** | `security.Role` | id, code (RoleCode enum), title | organization-wide |
| **Permission** | `security.Permission` | id, code, description | organization-wide |
| **Partner** | `crm.Partner` | id, code, name, status, companyId | tenant/partner-scoped |
| **Customer** | `crm.Customer` | id, code, type, firstName, lastName, email, phone, status | organization-wide |

**No Employee entity exists.** Users serve as the identity layer. Partner users have `User.partnerId` set; internal users have `User.partnerId = null`.

### 3.2 Role Taxonomy

```typescript
enum RoleCode {
  ADMIN           // super-admin, ALL_PERMISSIONS
  DIRECTOR        // read-only executive
  FINANCE         // financial operations
  MARKETER        // marketing (future)
  ANALYST         // read-only analytics
  MODERATOR       // content moderation
  SALES_MANAGER   // sales operations
  OPERATOR        // general operations
  PARTNER         // external partner user
  BUYER           // external buyer user
}
```

**Analytics-relevant roles:** ADMIN, DIRECTOR, FINANCE, MARKETER, ANALYST, SALES_MANAGER, OPERATOR, MODERATOR.

**Partner/BUYER are external** — they are NOT employees and should NOT appear in employee analytics.

### 3.3 Actor Attribution Fields

The repository already tracks actors in multiple places:

| Field | Found On | Type | Semantic |
|---|---|---|---|
| `createdBy` | Product, Sale, Order, etc. | String? (User UUID) | Who created the entity |
| `updatedBy` | Product, Order | String? (User UUID) | Who last modified the entity |
| `completedById` | Sale | String? (User UUID) | Who completed the sale |
| `actorUserId` | Communication | String? (User UUID) | Who sent the communication |
| `actor` | OutboxEvent | Json? (BusinessEventActor) | Typed actor: `{type: "USER", id}` or `{type: "SYSTEM"}` |
| `actorType` / `actorId` | LedgerTransaction, Settlement, Payout | String? | Financial actor provenance |
| `reviewedById` | ModerationSubmission, PartnerApplication | String? (User UUID) | Who reviewed/decided |
| `assignedModeratorId` | ModerationSubmission | String? (User UUID) | Who is assigned to review |
| `assignedToId` | Lead (reverse marketplace) | String? | Who owns the lead |
| `actorId` / `actorName` | History tables (all domains) | String? | Who performed the history action |

### 3.4 Actor Dimension Design

The Analytics Foundation exposes a **reusable Actor dimension** using canonical repository fields:

```typescript
interface ActorDimension {
  userId: string | null       // User UUID (null = SYSTEM/UNKNOWN)
  role: RoleCode | null       // User's role at query time
  isInternal: boolean         // true for non-Partner/non-BUYER users
  isPartner: boolean          // true when User.partnerId is set
}
```

**Important:** This is a **query-time dimension**, not a new entity. Analytics queries JOIN against `security.User` to resolve actor identity.

### 3.5 Three Attribution Types

The design explicitly distinguishes three attribution concepts:

#### 3.5.1 Action Attribution

**Who performed an action?**

| Action | Source Field | Entity |
|---|---|---|
| Created a Product | `Product.createdBy` | Product |
| Published a Product | `Product.updatedBy` (at publish transition) | Product |
| Confirmed a Booking | OutboxEvent `actor` (BookingConfirmed) | Booking |
| Sent a Communication | `Communication.actorUserId` | Communication |
| Reviewed a Moderation | `ModerationSubmission.assignedModeratorId` | ModerationSubmission |
| Completed a Sale | `Sale.completedById` | Sale |
| Created an Order | OutboxEvent `actor` (OrderCreated) | Order |
| Changed a Status | History table `actorId` | any History |

#### 3.5.2 Ownership Attribution

**Who owns/is responsible for the object?**

| Object | Ownership Field | Semantic |
|---|---|---|
| Product | `Product.partnerId` | Partner owns the product |
| Lead | `Lead.assignedToId` | User owns the lead |
| Opportunity | `Opportunity.assignedToId` (if exists) | User owns the opportunity |
| Customer | `Customer` (no owner field) | Not yet assigned |
| Order | `Order.sellerPartnerId` | Partner fulfills the order |

**Gap:** Many entities lack explicit ownership fields. Customer, Booking, and Payment do not have an `assignedToId` or equivalent. This is documented as a future enhancement.

#### 3.5.3 Outcome Attribution

**To whom may a business result legitimately be attributed?**

| Outcome | Attribution Basis | Notes |
|---|---|---|
| Sale completed | `Sale.completedById` (action) + `Order.sellerPartnerId` (ownership) | May differ |
| Revenue collected | `Payment.orderId → Order.sellerPartnerId` | Partner attribution |
| Booking confirmed | Booking → Product → `Product.partnerId` | Partner attribution |
| Commission earned | `Commission.partnerId` | Direct partner attribution |

**Critical distinction:** Action attribution ≠ Outcome attribution. A sales manager may confirm a booking (action), but the revenue belongs to the partner (outcome). The Analytics Foundation must NOT automatically credit every outcome to the last actor.

### 3.6 Activity ≠ Effectiveness

**Semantic invariant:**

```
PLATFORM ACTIVITY ≠ EMPLOYEE EFFECTIVENESS
```

The foundation makes activity facts **measurable** but does NOT define employee performance.

**Permitted as measurable facts:**
- Login frequency (from AuditLog `auth.*` actions)
- Entities created/modified (from createdBy/updatedBy)
- Communications sent (from Communication.actorUserId)
- Bookings confirmed (from BookingConfirmed event actor)
- Orders processed (from OrderHistory actorId)

**NOT permitted as sole performance indicators:**
- Login duration
- Page views
- Session duration
- Number of clicks
- Apparent idle time

**Future Employee Analytics** (Step 3.4+) may combine multiple dimensions:
- Platform activity
- Communications
- Workload
- Task/follow-up execution
- Funnel activity
- Business results
- Conversion
- SLA
- Quality
- Errors/cancellations

**But this pass does NOT define weights or a universal Efficiency Score.**

### 3.7 Activity Channel Classification

Where supported by existing facts, analytics can classify activity into channels:

| Channel | Evidence Source | Observable? |
|---|---|---|
| Platform interaction | AuditLog actions, entity CRUD | YES |
| Client communication | Communication.actorUserId | YES (partially — only TravelHub-mediated) |
| Workflow/business action | History tables, OutboxEvent actors | YES |
| Commercial outcome | Sale.completedById, Order.sellerPartnerId | YES |

**Limitation:** Communication activity is only partially observable. External communications (phone, email outside TravelHub) are NOT tracked. An employee may have low platform interaction but high external client communication — the analytics model must not make them appear inactive.

### 3.8 Historical Dimension Stability

| Dimension | Historical? | Limitation |
|---|---|---|
| Role | NO | Only current role is stored. Historical role changes are NOT tracked. |
| Team | N/A | No team concept exists in the repository. |
| Manager | N/A | No manager concept exists in the repository. |
| Department | N/A | No department concept exists in the repository. |
| Employment status | Partial | User.status tracks ACTIVE/INACTIVE but history is limited. |
| Partner assignment | NO | User.partnerId is current-only. |

**Gap:** If historical role/team attribution is needed for analytics, a separate audit/dimension table would be required. This is NOT implemented in Step 3.3.

### 3.9 Privacy / Access Boundary

| Access Level | Who | What They See |
|---|---|---|
| Company-wide analytics | ADMIN, DIRECTOR, ANALYST | All company data, all employees |
| Team analytics | SALES_MANAGER, MANAGER (future) | Their team's data |
| Own analytics | OPERATOR, FINANCE, MODERATOR | Their own data only |
| Partner analytics | PARTNER | Only their own partner data |
| Buyer analytics | BUYER | Only their own buyer data |

**No covert surveillance.** Analytics are based on legitimate TravelHub workflow data (entity creation, status changes, communications within the platform). The foundation does NOT track:
- Keystroke dynamics
- Mouse movement
- Screen recording
- External application usage
- GPS/location tracking

### 3.10 Read Model Impact

The Time/Period Contract is consumed by ALL five existing read models:

1. **Company KPI Summary** — period preset → resolved interval → aggregation
2. **Partner Performance Summary** — same period contract, partner-scoped
3. **Conversion Funnel** — period contract + behavioral event timestamps
4. **Time-Based Analytics** — period contract + granularity
5. **Financial Reconciliation Summary** — period contract + financial timestamps

**Actor attribution** does NOT require a new read model at foundation level. It adds **dimensions** to existing queries (filter by actorId, group by role). A dedicated **Employee Performance Read Model** is a future domain-specific step (Step 3.4+), not part of Step 3.3.

### 3.11 API Design Impact

Analytics queries express period/comparison/dimensions through a shared contract:

```typescript
interface AnalyticsQuery {
  period: {
    preset: AnalyticsPeriodPreset
    startDate?: string     // required for CUSTOM
    endDate?: string       // required for CUSTOM
    timezone?: string      // IANA ID; default "UTC"
  }
  comparison?: boolean     // default: true
  granularity?: AnalyticsGranularity  // default: auto-selected
  dimensions?: string[]    // e.g. ["partner", "acquisitionSource", "role"]
  filters?: {
    partnerId?: string
    productId?: string
    acquisitionSource?: string
    roleId?: string
    actorId?: string       // action attribution filter
  }
}
```

The Analytics query layer owns/consumes a **canonical period resolver**. Frontend does NOT compute periods separately.

### 3.12 KPI Dictionary Impact

Every KPI in the existing dictionary is reviewed for period/actor compatibility:

| KPI Category | Period Compatible? | Actor Compatible? | Notes |
|---|---|---|---|
| Revenue & Commercial | YES | Partial (partner attribution only) | Internal user attribution not yet available |
| Conversion & Funnel | YES | NO (anonymous behavioral) | Behavioral events are anonymous |
| Timing & SLA | YES | YES (action attribution) | Actor who confirmed/completed is available |
| Platform Activity | YES | YES (action attribution) | Direct actor tracking |
| Partner Performance | YES | N/A (partner-scoped) | Partner is the dimension, not internal actor |
| Product Performance | YES | NO (product-scoped) | Product is the dimension |

**Employee-specific KPIs** (efficiency score, workload, SLA) are NOT defined here — they belong to Step 3.4+ with explicit authority.

---

## 4. Design Addendum Matrix

| Capability | Existing support | Addendum decision | Authority | Implementation impact |
|---|---|---|---|---|
| Preset periods | Mentioned (hour→year) | 7 explicit presets with semantic definitions | Product concept | Enum + resolver |
| Custom start/end | Not defined | CUSTOM with explicit startDate/endDate | Product requirement | API contract |
| Timezone | Product.serviceTimeZone only | Accept optional IANA timezone; fallback UTC | Authority gap — no company timezone | Resolver parameter |
| Boundary semantics | Not defined | Half-open [start, endExclusive) in UTC | Design decision | Query pattern |
| Comparison period | Mentioned (period-over-period) | Explicit algorithm per preset type | Product concept | Resolver logic |
| Granularity | Mentioned (hour→year) | Auto-selected + optional override | Design decision | API parameter |
| Business timestamp selection | Fact model has timestamps | Authoritative timestamp per metric | Repository evidence | Metric definitions |
| Actor attribution | createdBy/updatedBy/actor fields exist | Reuse canonical fields; no new entity | Repository evidence | Query JOINs |
| Ownership attribution | partnerId, assignedToId exist | Document gaps; reuse existing fields | Repository evidence | Dimension filters |
| Outcome attribution | sellerPartnerId, completedById exist | Distinguish from action attribution | Design decision | Metric semantics |
| Activity channel | AuditLog + Communication exist | Classify into 4 channels; note limitations | Repository evidence | Dimension labels |
| Historical role/team | NOT tracked | Document limitation; no backfill | Authority gap | Future enhancement |
| RBAC/privacy | PermissionsGuard exists | Follow existing RBAC for analytics access | Repository evidence | Access control |

---

## 5. Authority Gaps

| Gap | Required For | Status | Resolution |
|---|---|---|---|
| Company/tenant timezone | Business reporting periods (TODAY, etc.) | NOT YET DEFINED | Accept timezone parameter; default UTC |
| Employee team/department | Team-scoped analytics | NOT YET DEFINED | No team concept in repository |
| Employee manager hierarchy | Manager-scoped analytics | NOT YET DEFINED | No manager concept in repository |
| Historical role tracking | Historical attribution | NOT YET DEFINED | Current role only |
| Customer ownership | Customer-scoped analytics | NOT YET DEFINED | No assignedTo on Customer |
| Employee efficiency weights | Employee scoring | NOT AUTHORIZED | Step 3.4+ with authority |

---

## 6. Negative Checks

```
analytics backend implementation: 0
API endpoints created: 0
frontend UI created: 0
schema changes: 0
migration changes: 0
employee monitoring: 0
employee efficiency weights: 0
universal employee score: 0
covert surveillance: 0
PSP implementation: 0
Phase 2 exit claimed: 0
Step 2.17B changed: 0
```

---

## 7. Testability Contract

Future implementation must include tests for:

- Every preset (TODAY through YEAR)
- Custom start/end
- Month/year boundaries (Jan 1, Dec 31, leap year)
- DST transition (spring-forward, fall-back)
- Timezone conversion (UTC → businessTZ → UTC round-trip)
- Previous-equivalent comparison (calendar and custom)
- Zero previous value (deltaPercent = null)
- Custom-period comparison (equivalent duration)
- Multiple business timestamp types (createdAt vs completedAt vs paidAt)
- Actor attribution (action vs ownership vs outcome)
- Owner vs actor distinction (different people)
- Tenant isolation (Partner A cannot see Partner B analytics)
- Missing actor (NULL createdBy → UNKNOWN)
- Historical attribution limitations (current role only)

---

## 8. Files Changed

- `docs/architecture/analytics-foundation-3.3-time-actor-addendum.md` — NEW

---

## 9. Artifact Integrity

```
artifact checker: PASS=163, WARN=0, FAIL=0
checker regression: PASS
```

---

## 10. Persistence

| Item | Value |
|---|---|
| branch | master |
| addendum commit | TBD |
| final HEAD/upstream | TBD |
| push_status | TBD |

---

## 11. Final Verdict

```
STEP 3.3 ANALYTICS FOUNDATION DESIGN ADDENDUM COMPLETED —
TIME/PERIOD AND ACTOR ATTRIBUTION CONTRACTS READY —
IMPLEMENTATION MAY PROCEED

Decision:
- verdict: A — ALL REQUIRED FOUNDATION SEMANTICS SUFFICIENTLY DEFINED
- Time/Period Contract: 7 presets + CUSTOM + half-open boundaries + comparison + granularity
- Timezone: optional IANA parameter, fallback UTC (authority gap documented)
- Actor Attribution: reuse canonical fields, 3 attribution types distinguished
- Activity ≠ Effectiveness: preserved
- No employee monitoring or scoring: preserved
- Authority gaps: documented (company timezone, team/department, historical roles)

NEXT:
PHASE 3 — STEP 3.3 — ANALYTICS FOUNDATION IMPLEMENTATION
```
