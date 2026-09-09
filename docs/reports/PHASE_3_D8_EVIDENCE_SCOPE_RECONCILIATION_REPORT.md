# PHASE 3 — D8 — EVIDENCE & SCOPE RECONCILIATION
## AUDIT-FIRST RECONCILIATION REPORT

---

### Executive Summary

**VERDICT: A — RECONCILED / IMPLEMENTATION READY**

The original D8 audit identified 11 findings (B-01 through B-11). After re-examination against the actual codebase, and after the Final Correction Pass (C1–C4), the canonical classification is:

- **1 CONFIRMED DEFECT** (B-06: inconsistent invalid-date validation across registry period filters)
- **3 INTENTIONAL DIFFERENCE + DOCUMENTATION GAP** (B-01, B-02, B-03)
- **2 NO ISSUE / DOCUMENTATION GAP** (B-04, B-05 — Implementation issue = NO; Code defect = NO; Documentation gap = YES)
- **1 DOCUMENTATION GAP** (B-07)
- **2 STYLE PREFERENCE / NOT ARCHITECTURAL** (B-08, B-10)
- **1 D9-OWNED** (B-09: export column inconsistency)
- **1 TERMINOLOGY ADJUSTMENT** (B-11)

Temporal semantics foundations = EXISTING. Temporal authority/filtering foundations = EXISTING. Global Temporal Visibility contract = PARTIAL / READY FOR CANONIZATION. Canonical project-wide visibility contract = NOT YET FROZEN — completing and canonizing it is D8's core deliverable.

C2 determined the canonical invalid-date contract: **HTTP 400 + BadRequestException** (Option A, evidence-backed — see Final Correction Pass).

**Original Audit Verdict:** B (Audit Ready with Blockers)
**Reconciled Verdict:** A (Reconciled / Implementation Ready — single P2 defect + documentation items)

---

# 1. Source Hierarchy

| Source | Role | Authority |
|---|---|---|
| Canonical Master Plan v3 | D-track sequence, D8 = TRUE NEXT | Highest (D-track) |
| COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md | §21 temporal invariants, §21.3 hard rule | Frozen (D1) |
| TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md | D-track ordering | Architecture |
| D1–D7 accepted reports | Frozen temporal contracts | Accepted |
| D8 audit report | Initial findings | To reconcile |
| `docs/architecture/temporal-readiness.md` | Phase 1 temporal taxonomy | Foundation |
| `backend/src/shared/service-time.ts` | DST/cross-midnight implementation | Code evidence |
| `backend/src/shared/service-time.spec.ts` | DST test coverage | Test evidence |
| Repository HEAD | Current codebase | Ground truth |

---

# 2. Baseline

```text
HEAD: f41bd6a (origin/master)
Untracked: D8 audit report, prompt docs, Master Roadmap doc
Production changes: NONE
```

---

# 3. Reconciliation of Original Verdict

Original audit: VERDICT B — "Audit Ready with Blockers" (1 P2 + 10 P3 findings).

After reconciliation: The "blockers" were over-classified. The single P2 finding (B-06) is a real defect but does not block D8 — it IS a D8 implementation item. The P3 findings are either documentation gaps, intentional differences, or belong to other stages.

**Reconciled: VERDICT A — Reconciled / Implementation Ready.**

---

# Final Correction Pass

Governance-only correction of this report per `docs/prompts/PHASE_3_D8_FINAL_RECONCILIATION_CORRECTION_PROMPT.md`. No production code changed. Baseline HEAD f41bd6a.

## C1 — Classification Summary Consistency: PASS

Canonical classification now identical in Executive Summary, §23 and §28:

```text
B-01 = INTENTIONAL DIFFERENCE + DOCUMENTATION GAP
B-02 = INTENTIONAL DIFFERENCE + DOCUMENTATION GAP
B-03 = INTENTIONAL DIFFERENCE + DOCUMENTATION GAP
B-04 = NO ISSUE / DOCUMENTATION GAP
B-05 = NO ISSUE / DOCUMENTATION GAP
B-06 = CONFIRMED DEFECT
B-07 = DOCUMENTATION GAP
B-08 = STYLE PREFERENCE / NOT ARCHITECTURAL
B-09 = D9-OWNED
B-10 = STYLE PREFERENCE / NOT ARCHITECTURAL
B-11 = TERMINOLOGY ADJUSTMENT
```

For B-04/B-05 explicitly: `Implementation issue = NO; Code defect = NO; Documentation gap = YES`. "No issue" never means "nothing to do for D8" — the DST/cross-midnight contract must still be documented in the D8 vocabulary. "Rejected" is no longer used: B-04/B-05 are NO ISSUE / DOCUMENTATION GAP.

Count arithmetic: 3 + 2 + 1 + 1 + 2 + 1 + 1 = 11 findings. No arithmetic or semantic contradiction between buckets.

## C2 — Canonical Invalid-Date Contract: PASS (Option A)

Evidence inventory (verified at HEAD f41bd6a):

| Surface | Current behavior | Evidence |
|---|---|---|
| Requests | `validateDateParam()` → `BadRequestException` → 400 | `request.service.ts` L149-157 (list L364-365, KPI L954-955); canonical-400 convention proven in `request-sort.spec.ts` L318-327 |
| Payments | `parseDateParam()` → `ValidationDomainError` → 422 | `payment.service.ts` L646-647, L678-684; `payments-registry.spec.ts` L243; `shared/errors.ts` L26-30 |
| Orders | raw `new Date()` → silent Invalid Date | `order.service.ts` L840-841, L953-954 |
| Bookings | raw `new Date()` → silent Invalid Date | `booking.service.ts` L229-230, L333-334 |
| CRM Activity (discovered during C2) | invalid date → `NotFoundException` → **404** | `crm-activity.controller.ts` L135-142, L266-273 |
| CRM customers period (discovered during C2) | raw `new Date()` on Order.createdAt sub-filter | `crm.service.ts` L196-197, L704-705 |
| Catalog publishedAt (discovered during C2) | raw `new Date()` + inclusive `lte` end | `catalog.service.ts` L375-376 |

Existing conventions consulted: `AppExceptionFilter` (`shared/exception.filter.ts`) maps `DomainError.httpStatus` and `HttpException.getStatus()` into the canonical `{ statusCode, message, requestId }` shape; the global ValidationPipe rejects malformed DTO input with 400; documented contracts: `analytics-foundation-3.3-time-actor-addendum.md` ("Invalid date format → reject (400)"), `dashboard-command-center-backend-3.1.md` ("Invalid period → 400 (BadRequestException)"), checkout error model ("400/401/403/404/409/422/500 + requestId"). Frontend API clients surface `error.message` only — no status-specific client logic; no frontend breakage either way.

**Decision: Option A — canonical HTTP 400 + standard validation exception (`BadRequestException`).**

Rationale: a non-parseable query parameter is malformed transport input, not a domain-rule violation; the two most recent temporal-surface contracts (Command Center 3.1, Analytics 3.3 addendum) both document 400; Requests already implements and tests it as "(canonical 400)". `ValidationDomainError`/422 remains canonical for **submitted payload** domain validation (ledger `occurredAt`, forbidden keys, lifecycle guards) — that boundary is unchanged; only registry **query-param** date filters fall under the 400 contract.

```text
Exception type:        BadRequestException (HttpException branch of AppExceptionFilter)
HTTP status:           400
Response shape:        { statusCode: 400, message: "<paramName> must be a valid date", requestId? } + X-Request-Id header
Validation location:   service/controller boundary helper (validateDateParam pattern), before any Prisma where
                       construction; identical helper applied to list AND KPI scope builders (validation parity)
Invalid date cases:    any provided dateFrom/dateTo where new Date(value).getTime() is NaN; absent/empty = no
                       filter (valid); date-only "YYYY-MM-DD" → UTC midnight (B-07 semantics preserved)
Both bounds validated: YES — dateFrom and dateTo validated independently
```

B-06 fix scope (D8 MUST): Orders (list + KPI), Bookings (list + overview), CRM Activity (404 → 400), CRM customers period, Catalog publishedAt; Payments aligned 422 → 400 (`payments-registry.spec.ts` assertion updated). No new error contract is invented; no frozen contract is touched.

Additional variance recorded for the D8 vocabulary (not a new B-ID): period boundary semantics differ across surfaces — Operations registries use half-open `[from, to)` while CRM Activity and Catalog use inclusive `[from, to]` (`lte`, `lte + 23:59:59.999`). D8 MUST document canonical `[from, to)` and classify these variances explicitly.

## C3 — Analytics Visibility Ownership: PASS

Additional visibility-level audit performed (no implementation):

```text
Temporal fields:      StorefrontBehavioralEvent.occurredAt; Order.createdAt; Payment/Refund/Ledger occurrence
                      fields in financial reconciliation
Temporal dimensions:  preset (TODAY, LAST_3_DAYS, LAST_7_DAYS, MONTH, LAST_6_MONTHS, YEAR, CUSTOM) + CUSTOM
                      startDate/endDate + granularity (auto-selected, overridable) + comparison (preceding
                      calendar period) + timezone (IANA, default UTC)
Filters:              server-side resolvePeriod() → canonical [start, endExclusive); CUSTOM requires both dates,
                      rejects startDate > endDate and malformed format (DTO @Matches ^\d{4}-\d{2}-\d{2}$ → 400)
Server authority:     YES — all KPI/funnel/time-series/partner/finance aggregates filtered in SQL, server-computed
URL/state:            local component state (NOT URL params — variance vs Operations ?dateFrom=&dateTo= and
                      Command Center ?preset=)
Sorting:              N/A for KPI cards; time-series buckets chronological; partner table client-paginated
Display:              server-formatted bucket labels; period start/endExclusive transferred to drilldowns
                      (R4-02E period preservation)
Timezone:             request-level IANA override, default "UTC" in resolver; frontend sends no timezone → UTC;
                      display via browser locale/runtime timezone (same display-layer note as §17)
Tenant/RBAC:          @RequirePermissions("analytics.read") on every endpoint; PARTNER auto-scoped to own
                      partnerId; page pins acquisitionSource=MARKETPLACE (server-side channel scope)
```

Classification:

```text
Temporal visibility = PARTIAL    (D8-owned: machinery exists and is contract-documented in
                                  analytics-foundation-3.3; gaps are visibility-layer documentation:
                                  local-state period not URL-persisted, implicit UTC default, absent from
                                  the D8 vocabulary)
KPI semantics       = D11-OWNED  (KPI definitions, bucket-vs-headline reconciliation (RT2A), comparison
                                  semantics, period comparison display)
```

Analytics is NOT implemented by D8; only its §6 visibility row and vocabulary coverage are D8 deliverables.

## C4 — Temporal Visibility Contract Status: PASS

Corrected status model (replaces the prior blanket "Temporal Visibility contract: EXISTING"):

```text
Temporal semantics foundations             = EXISTING
Temporal authority/filtering foundations   = EXISTING
Global Temporal Visibility contract        = PARTIAL / READY FOR CANONIZATION
Canonical project-wide visibility contract = NOT YET FROZEN
```

"PARTIAL / READY FOR CANONIZATION" is justified by evidence: server authority and KPI/table scope parity are implemented and spec-proven across all Operations surfaces (§19, §22); the remaining gap is canonization — cross-domain intentional differences (B-01/02/03), boundary variance (C2), Analytics visibility notes (C3) and the display-timezone layer (§17) are real but bounded and documented nowhere as one contract. D8 canonizes; it does not build from scratch.

---

# 4. Global Temporal Vocabulary Reconciliation

## Original audit claim:
> "lacks a unified Global Temporal Vocabulary contract"

## Evidence:

`docs/architecture/temporal-readiness.md` (2026-08-09, Phase 1 Step 1.13A) contains:

```text
Entity time:        createdAt, updatedAt
Lifecycle time:     submittedAt, reviewStartedAt, decidedAt, publishedAt,
                    activatedAt, deactivatedAt, deprecatedAt, approvedAt,
                    reviewedAt, memberSince
Event time:         OutboxEvent.createdAt, StorefrontBehavioralEvent.occurredAt
Processing time:    receivedAt (behavioral), publishedAt (outbox), processedAt (inbox)
```

## Missing from this taxonomy (added by D2–D7):

```text
Service occurrence: serviceDate, serviceTime, serviceEndTime, serviceTimeZone,
                    serviceStartsAt, serviceEndsAt (Step 2.8A)
Financial time:     occurredAt (Ledger), paidAt, failedAt, cancelledAt (Payment),
                    requestedAt, approvedAt, processedAt, failedAt (Refund)
Presentation period: dateFrom, dateTo (URL params), period presets (Command Center)
```

## Classification: **B — Vocabulary exists but is incomplete and not a canonical project-wide contract.**

The Phase 1 taxonomy is correct for its scope but was not updated when D2.8A (service occurrence), D2.10C/D2.12/D2.13 (financial time), or C1.2F (presentation period) were added. No single document maps ALL temporal fields across ALL domains.

**D8 ownership:** YES — D8 should complete the vocabulary and canonize it as the project-wide contract.

---

# 5. Temporal Semantic Decomposition

## 5.1 Temporal Semantics (= what a temporal fact means)

| Domain | Semantic | Existing contract | Documented |
|---|---|---|---|
| Entity time | createdAt/updatedAt | ✅ temporal-readiness.md §1 | ✅ |
| Lifecycle milestones | submittedAt/confirmedAt/... | ✅ D2.5A/2.9A/2.12/2.13 | ✅ per-domain |
| Service occurrence | serviceDate/Time/TimeZone/StartsAt/EndsAt | ✅ D2.8A | ✅ service-time.ts |
| Financial occurrence | occurredAt (Ledger) | ✅ D2.10C | ✅ finance-temporal-contract.md |
| Presentation period | dateFrom/dateTo | ✅ C1.2F | ⚠️ implicit, not documented as contract |

## 5.2 Temporal Authority (= who is source of truth)

| Domain | Authority | Existing contract |
|---|---|---|
| Lifecycle milestones | Server (CAS transition) | ✅ Frozen |
| Service timezone | Catalog → frozen at CheckoutIntent → Booking | ✅ Frozen (D2.8A §8) |
| Service date/time | Frozen from OrderRequested (verbatim) | ✅ Frozen |
| Period filter | Server-side (dateFrom/dateTo → Prisma where) | ✅ Implemented |
| KPI aggregates | Server (same where as table) | ✅ Implemented |

## 5.3 Temporal Filtering

| Surface | Filter field | Boundary | Server authority |
|---|---|---|---|
| Operations Center | createdAt | [from, to) | ✅ |
| Bookings upcoming | serviceDate | >= now | ✅ |
| Bookings overdue | createdAt | < threshold | ✅ |
| CRM Activity | occurredAt | from/to | ✅ |
| Command Center | Preset → date range | Preset-dependent | ✅ |

## 5.4 Temporal Sorting

All registries sort by `createdAt` by default (desc). Explicit sort via `sortBy`/`sortDirection` URL params.

## 5.5 Temporal Presentation

| Surface | Display | Format |
|---|---|---|
| List tables | createdAt column | `fmtDate()` → `toLocaleDateString(LOCALE_TAGS[locale])` |
| Detail pages | Lifecycle milestones | Locale-aware date display |
| Timeline | OperationalNote.createdAt, CrmActivity.occurredAt | Locale-aware |
| Audit history | *History.createdAt | Locale-aware |
| KPI | Count aggregates on period scope | Server-computed |

## 5.6 Temporal Visibility

| Surface | Visible temporal facts | Filterable? | Sortable? | KPI? | Exported? |
|---|---|---|---|---|---|
| Requests list | createdAt, requestedServiceDate, supplierResponseDeadline | ✅ period | ✅ createdAt | ✅ | ✅ |
| Orders list | createdAt, cancelledAt (detector) | ✅ period | ✅ createdAt | ✅ | ✅ |
| Bookings list | createdAt, serviceDate (detector) | ✅ period | ✅ createdAt | ✅ | ✅ |
| Payments list | createdAt, paidAt | ✅ period | ✅ createdAt | ✅ | ✅ |
| Order detail | 5 lifecycle milestones + service occurrence | — | — | — | — |
| Booking detail | 5 lifecycle milestones + service occurrence | — | — | — | — |
| Payment detail | paidAt/failedAt/cancelledAt | — | — | — | — |
| CRM Activity | occurredAt | ✅ period | — | — | — |
| Command Center | Dashboard KPI periods | ✅ preset | — | ✅ | — |

---

# 6. Surface × Temporal Matrix

| Surface | Entity | Default temporal dimension | Secondary dimensions | Filter | Sort | Display | KPI | URL/state | Server authority | Timezone | D8 ownership |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Requests | Request | createdAt | requestedServiceDate, supplierResponseDeadline, customerActionDeadline | period [from,to) on createdAt | createdAt | createdAt, requestedServiceDate, supplierResponseDeadline | ✅ createdAt scope | ?dateFrom=&dateTo= | ✅ | UTC | ✅ D8 |
| Orders | Order | createdAt | serviceDate, cancelledAt, submittedAt/confirmedAt/... | period [from,to) on createdAt | createdAt | createdAt | ✅ createdAt scope | ?dateFrom=&dateTo= | ✅ | UTC | ✅ D8 |
| Bookings | Booking | createdAt | serviceDate, serviceTime/serviceTimeZone/serviceStartsAt | period [from,to) on createdAt; upcoming on serviceDate | createdAt | createdAt, serviceDate (detector) | ✅ createdAt scope | ?dateFrom=&dateTo= | ✅ | UTC + IANA | ✅ D8 |
| Payments | Payment | createdAt | paidAt | period [from,to) on createdAt or paidAt | createdAt | createdAt, paidAt | ✅ createdAt scope | ?dateFrom=&dateTo= | ✅ | UTC | ✅ D8 |
| CRM Activity | CrmActivity | occurredAt | projectedAt | period on occurredAt | occurredAt | occurredAt | — | local state | ✅ | UTC | ✅ D8 |
| Customer 360 | CrmActivity | occurredAt | — | period on occurredAt | occurredAt | occurredAt | — | local state | ✅ | UTC | ✅ D8 |
| Partner 360 | CrmActivity | occurredAt | — | period on occurredAt | occurredAt | occurredAt | — | local state | ✅ | UTC | ✅ D8 |
| Support | Case | createdAt | slaDeadline, escalatedAt, resolvedAt, closedAt | — | createdAt | createdAt | — | — | ✅ | UTC | ✅ D8 |
| Marketing | Campaign | createdAt | startAt, endAt | — | createdAt | startAt, endAt | — | — | ✅ | UTC | ✅ D8 |
| Command Center | DecisionSignal | firstDetectedAt | lastDetectedAt, acknowledgedAt, resolvedAt | Preset periods | firstDetectedAt | firstDetectedAt | ✅ preset scope | ?preset=MONTH | ✅ | UTC | ✅ D8 |
| Analytics | Behavioral/Order aggregates | preset period (server-resolved [start, endExclusive)) | CUSTOM range, granularity, comparison, timezone | preset/CUSTOM (server-side) | chronological buckets | period bounds, bucket labels | ✅ preset scope | local state (not URL) | ✅ | UTC default (IANA overridable) | PARTIAL — visibility D8 / KPI semantics D11 |
| Catalog | Product | publishedAt | createdAt | — | — | publishedAt | — | — | ✅ | UTC | ✅ D8 |
| Sales | Quote | issuedAt | validUntil, createdAt | — | — | issuedAt | — | — | ✅ | UTC | ✅ D8 |
| Sales | Sale | completedAt | serviceDate, createdAt | — | — | completedAt | — | — | ✅ | UTC | ✅ D8 |
| Reverse | BuyerRequest | createdAt | serviceDateFrom/To, submittedAt, cancelledAt | — | — | createdAt | — | — | ✅ | UTC | ✅ D8 |
| Finance | LedgerTransaction | occurredAt | createdAt | — | — | occurredAt | — | — | ✅ | UTC | ✅ D8 |

---

# 7. Entity × Temporal Matrix (Core Commerce)

## Request

| Temporal fact | Semantic meaning | Authority | Writer | Immutable? | Timezone | Date-only/instant | D8 status |
|---|---|---|---|---|---|---|---|
| createdAt | Record created | Server | Server | No | UTC | Instant | EXISTING |
| updatedAt | Record changed | Server | Server | No | UTC | Instant | EXISTING |
| requestedServiceDate | Customer-requested service date | Client | Client | No | Date-only | Date-only | EXISTING |
| supplierResponseDeadline | SLA deadline | Server | Server | Yes | UTC | Instant | EXISTING |
| supplierRespondedAt | Supplier responded | Server | Server | Yes | UTC | Instant | EXISTING |
| customerActionDeadline | Customer TTL | Server | Server | Yes | UTC | Instant | EXISTING |
| customerAcceptedAt | Customer accepted | Server | Server | Yes | UTC | Instant | EXISTING |
| convertedAt | Converted to Order | Server | Server | Yes | UTC | Instant | EXISTING |
| rejectedAt | Supplier rejected | Server | Server | Yes | UTC | Instant | EXISTING |

## Order

| Temporal fact | Semantic meaning | Authority | Writer | Immutable? | Timezone | Date-only/instant | D8 status |
|---|---|---|---|---|---|---|---|
| createdAt | Record created | Server | Server | No | UTC | Instant | EXISTING |
| updatedAt | Record changed | Server | Server | No | UTC | Instant | EXISTING |
| submittedAt | Request entered system | Server (D2.5A) | Server | Yes | UTC | Instant | FROZEN |
| confirmedAt | Confirmed → READY_FOR_BOOKING | Server (D2.5A) | Server | Yes | UTC | Instant | FROZEN |
| cancelledAt | Cancelled | Server (D2.5A) | Server | Yes | UTC | Instant | FROZEN |
| fulfilledAt | Fulfilled | Server (D2.5A) | Server | Yes | UTC | Instant | FROZEN |
| closedAt | Closed | Server (D2.5A) | Server | Yes | UTC | Instant | FROZEN |
| termsAcceptedAt | Terms accepted (D3) | Server (D3) | Server | Yes | UTC | Instant | FROZEN |
| travelerDataCompletedAt | Traveler data complete (D3) | Server (D3) | Server | Yes | UTC | Instant | FROZEN |
| finalConfirmedAt | Final confirmation (D3) | Server (D3) | Server | Yes | UTC | Instant | FROZEN |
| serviceDate | Service date | Frozen (OrderRequested) | Frozen | Yes | Date-only | Date-only | FROZEN |
| serviceTime | Service local time | Frozen (OrderRequested) | Frozen | Yes | Local "HH:mm" | Time string | FROZEN |
| serviceEndTime | Service end time | Frozen (OrderRequested) | Frozen | Yes | Local "HH:mm" | Time string | FROZEN |
| serviceTimeZone | Service timezone | Frozen (Catalog D2.8A) | Frozen | Yes | IANA | Zone string | FROZEN |

## Booking

| Temporal fact | Semantic meaning | Authority | Writer | Immutable? | Timezone | Date-only/instant | D8 status |
|---|---|---|---|---|---|---|---|
| createdAt | Record created | Server | Server | No | UTC | Instant | EXISTING |
| updatedAt | Record changed | Server | Server | No | UTC | Instant | EXISTING |
| serviceDate | Service date | Frozen (Order) | Frozen | Yes | Date-only | Date-only | FROZEN |
| serviceTime | Service local time | Frozen (Order) | Frozen | Yes | Local "HH:mm" | Time string | FROZEN |
| serviceEndTime | Service end time | Frozen (Order) | Frozen | Yes | Local "HH:mm" | Time string | FROZEN |
| serviceTimeZone | Service timezone | Frozen (Catalog D2.8A) | Frozen | Yes | IANA | Zone string | FROZEN |
| serviceStartsAt | Derived UTC start | Derived (D2.8A) | Derived | Yes | UTC | Instant | FROZEN |
| serviceEndsAt | Derived UTC end | Derived (D2.8A) | Derived | Yes | UTC | Instant | FROZEN |
| requestedAt | Sent to supplier | Server (D2.9A) | Server | Yes | UTC | Instant | FROZEN |
| confirmedAt | Confirmed | Server (D2.9A) | Server | Yes | UTC | Instant | FROZEN |
| rejectedAt | Supplier rejected | Server (D2.9A) | Server | Yes | UTC | Instant | FROZEN |
| cancelledAt | Cancelled | Server (D2.9A) | Server | Yes | UTC | Instant | FROZEN |
| completedAt | Completed | Server (D2.9A) | Server | Yes | UTC | Instant | FROZEN |

## Payment

| Temporal fact | Semantic meaning | Authority | Writer | Immutable? | Timezone | Date-only/instant | D8 status |
|---|---|---|---|---|---|---|---|
| createdAt | Record created | Server | Server | No | UTC | Instant | EXISTING |
| updatedAt | Record changed | Server | Server | No | UTC | Instant | EXISTING |
| paidAt | Payment captured | Server (D2.12) | Server | Yes | UTC | Instant | FROZEN |
| failedAt | Payment failed | Server (D2.12) | Server | Yes | UTC | Instant | FROZEN |
| cancelledAt | Payment cancelled | Server (D2.12) | Server | Yes | UTC | Instant | FROZEN |

## Refund

| Temporal fact | Semantic meaning | Authority | Writer | Immutable? | Timezone | Date-only/instant | D8 status |
|---|---|---|---|---|---|---|---|
| createdAt | Record created | Server | Server | No | UTC | Instant | EXISTING |
| updatedAt | Record changed | Server | Server | No | UTC | Instant | EXISTING |
| requestedAt | Refund requested | Server (D2.13) | Server | Yes | UTC | Instant | FROZEN |
| approvedAt | Refund approved | Server (D2.13) | Server | Yes | UTC | Instant | FROZEN |
| processedAt | Refund processed | Server (D2.13) | Server | Yes | UTC | Instant | FROZEN |
| failedAt | Refund failed | Server (D2.13) | Server | Yes | UTC | Instant | FROZEN |

## Dispute

| Temporal fact | Semantic meaning | Authority | Writer | Immutable? | Timezone | Date-only/instant | D8 status |
|---|---|---|---|---|---|---|---|
| createdAt | Record created | Server | Server | No | UTC | Instant | EXISTING |
| updatedAt | Record changed | Server | Server | No | UTC | Instant | EXISTING |
| openedAt | Dispute opened | Server (D2.13A) | Server | Yes | UTC | Instant | FROZEN |
| resolvedAt | Dispute resolved | Server (D2.13A) | Server | Yes | UTC | Instant | FROZEN |
| cancelledAt | Dispute cancelled | Server (D2.13A) | Server | Yes | UTC | Instant | FROZEN |

---

# 8. B-01 Reconciliation

## Finding:
> Booking `upcoming` detector uses `serviceDate`; Operations period uses `createdAt`.

## Evidence:
```text
booking.service.ts L250: upcoming → serviceDate { gte: now }
booking.service.ts L229-230: period → createdAt { gte: new Date(dateFrom), lt: new Date(dateTo) }
```

## Classification: **INTENTIONAL DOMAIN DIFFERENCE**

The `upcoming` detector asks "which bookings have a service in the future?" — `serviceDate` is the correct field. The period filter asks "which bookings were created in this window?" — `createdAt` is the correct field. These are semantically different questions.

**D8 ownership:** DOCUMENTATION GAP — should be documented as intentional, not a defect.

---

# 9. B-02 Reconciliation

## Finding:
> Command Center uses preset-based period; Operations Center uses free-form dateFrom/dateTo.

## Evidence:
```text
OperationsCenterShell.tsx: HeaderPeriodControl → dateFrom/dateTo inputs
command-center/PeriodSelector.tsx: preset=DAY/WEEK/MONTH/QUARTER/YEAR
```

## Classification: **INTENTIONAL DIFFERENCE — different presentation layers**

- Operations Center: operational registry (precise date range for daily work)
- Command Center: strategic dashboard (period presets for trend analysis)

These serve different analytical purposes and different user workflows. No competing global authority.

**D8 ownership:** DOCUMENTATION GAP — should document as distinct temporal presentation models.

---

# 10. B-03 Reconciliation

## Finding:
> CRM Activity uses `occurredAt`; Operations Center uses `createdAt`.

## Evidence:
```text
CustomerActivity.tsx L50: dateFrom/dateTo → occurredAt (server)
OperationsCenterShell.tsx: dateFrom/dateTo → createdAt (server)
```

## Classification: **INTENTIONAL DOMAIN DIFFERENCE**

CRM Activity tracks "when did this activity happen?" (occurredAt = business occurrence time). Operations Center tracks "when was this entity created?" (createdAt = record creation time). Different business questions, different fields.

**D8 ownership:** DOCUMENTATION GAP — should document as intentional.

---

# 11. B-04/B-05 Reconciliation (DST / Cross-midnight)

## Finding:
> `serviceTime` (local "HH:mm") not DST-aware; cross-midnight derivation undocumented.

## Evidence:

`backend/src/shared/service-time.ts` (full implementation):
- `localToUtc()` — handles DST via Intl offsets, candidates-based algorithm
- Ambiguous (fall-back) → early instant (first occurrence)
- Nonexistent (spring-forward) → instant after gap
- Cross-midnight → next local calendar day via `deriveServiceEndsAt()`

`backend/src/shared/service-time.spec.ts` (comprehensive tests):
- DST ambiguous: `2026-10-25 02:30 Paris → 00:30Z` (early instant) ✅
- DST nonexistent: `2026-03-29 02:30 Paris → 01:30Z` (after gap) ✅
- Cross-midnight: `2026-09-01 23:30→01:30 Asia/Baku → 2026-09-01T21:30Z` ✅
- Date-only: null (no UTC-midnight fabrication) ✅

## Classification: **NO ISSUE / DOCUMENTATION GAP**

The implementation is correct, comprehensive, and well-tested. The only gap is that the DST handling rules are documented in code comments but not in the D8-level temporal vocabulary document.

**D8 ownership:** DOCUMENTATION GAP — include DST contract in D8 vocabulary.

---

# 12. B-06 Reconciliation (Invalid Date Validation)

## Finding:
> Inconsistent date validation across registries.

## Evidence:

| Surface | Validation | Exception type | Behavior on "not-a-date" |
|---|---|---|---|
| Requests | `validateDateParam()` | `BadRequestException` | 400 "dateFrom must be a valid date" |
| Payments | `parseDateParam()` | `ValidationDomainError` | 422 "dateFrom must be a valid date" |
| Orders | Raw `new Date(query.dateFrom)` | None | Silent `Invalid Date` → Prisma where clause with NaN |
| Bookings | Raw `new Date(query.dateFrom)` | None | Silent `Invalid Date` → Prisma where clause with NaN |
| CRM Activity | ad-hoc `new Date()` + isNaN check | `NotFoundException` | **404** "Invalid dateFrom" (semantically wrong status) |
| CRM customers period | Raw `new Date()` | None | Silent `Invalid Date` in Order.createdAt sub-filter |
| Catalog (publishedAt) | Raw `new Date()` | None | Silent `Invalid Date` |

## Classification: **CONFIRMED DEFECT (P2)**

Orders and Bookings silently accept invalid dates; CRM Activity returns a misleading 404; CRM customers and Catalog are silent. Four different behaviors exist for the same malformed-input class (400 / 422 / 404 / silent). Canonical contract determined in Final Correction Pass C2: **Option A — HTTP 400 + BadRequestException**, applied to all registry query-param date filters.

**D8 ownership:** YES — this IS a D8 implementation item. Standardize validation across all registry period-filter surfaces.

---

# 13. B-07 Reconciliation (Date-only UTC Semantics)

## Finding:
> `dateFrom = "2026-09-01"` → `2026-09-01T00:00:00.000Z` — behavior correct but undocumented.

## Evidence:
```text
order.service.ts L840: new Date("2026-09-01") → UTC midnight
booking.service.ts L229: new Date(query.dateFrom) → UTC midnight
request.service.ts L364: new Date(dateFrom) → UTC midnight
```

`new Date("YYYY-MM-DD")` in JavaScript produces UTC midnight. This is the correct behavior for date-only filters (no timezone conversion).

## Classification: **DOCUMENTATION GAP**

The behavior is correct and consistent. Should be documented as the canonical D8 date-only filter contract.

**D8 ownership:** YES — document as canonical contract.

---

# 14. B-08/B-10 Reconciliation (Shared TemporalDisplay)

## Finding:
> `fmtDate()` defined locally per page, not shared.

## Evidence:
```text
frontend/app/app/bookings/page.tsx L86: function fmtDate(iso, locale)
frontend/app/app/orders/page.tsx L92: function fmtDate(iso, locale)
frontend/app/app/payments/page.tsx L92: function fmtDate(iso, locale)
frontend/app/app/requests/page.tsx L107: function fmtDate(iso, locale)
frontend/app/app/requests/[id]/page.tsx L238: inline lambda
frontend/app/app/finance/payments/[id]/page.tsx L82: inline lambda
```

All implementations are identical: `new Date(iso).toLocaleDateString(LOCALE_TAGS[locale])`.

## Classification: **INTENTIONAL DIFFERENCE / STYLE PREFERENCE — NOT architectural**

The duplication is real but the implementations are identical. This is a code hygiene issue, not an architectural gap. Extracting a shared component is a SHOULD, not a MUST.

**D8 ownership:** SHOULD (not MUST). Code cleanup, not temporal contract.

---

# 15. B-09 Reconciliation (Export Ownership)

## Finding:
> Orders export lacks `serviceDate` column; Bookings export has it.

## Evidence:
```text
order.controller.ts L197-225: Orders export columns — NO serviceDate
booking.controller.ts L163-191: Bookings export columns — HAS serviceDate
```

## Classification: **D9-OWNED**

Export column consistency is the domain of D9 (Export Framework Requalification). The missing `serviceDate` in Orders export is a D9 implementation item, not D8.

**D8 ownership:** NO — belongs to D9.

---

# 16. B-11 Reconciliation (Primary Temporal Dimension)

## Finding:
> "Primary temporal dimension" terminology.

## Classification: **TERMINOLOGY ADJUSTMENT — use "default registry temporal dimension"**

The term "primary" implies a hierarchy that doesn't exist. Each entity has multiple temporal dimensions for different purposes. The correct term is "default registry temporal dimension" — the field used for the default sort and period filter in the registry list view.

**D8 ownership:** TERMINOLOGY ADJUSTMENT in D8 vocabulary document.

---

# 17. Timezone / Display Timezone Reconciliation

## Storage timezone:
All `DateTime` fields stored as PostgreSQL `TIMESTAMP(3)` via Prisma. Serialized as ISO-8601 with `Z` suffix.

## Business timezone:
`Product.serviceTimeZone` — IANA zone, frozen at CheckoutIntent binding. No alternative authority.

## Display timezone:
```text
new Date(isoString).toLocaleDateString(LOCALE_TAGS[locale])
```
This converts UTC → locale display using the **browser/runtime timezone**. No explicit `timeZone` option is passed to `toLocaleDateString()`, so it uses the default timezone of the JavaScript runtime.

**Findings:**
- ✅ Storage: UTC (correct)
- ✅ Business: IANA authority (correct, frozen)
- ⚠️ Display: Browser/runtime timezone (implicit, not explicit)
- The display timezone is NOT the business timezone — this is correct for date-only display but should be documented

**D8 ownership:** DOCUMENTATION GAP — document the three timezone layers (storage/business/display).

---

# 18. Global Period Model

## Period Model Matrix

| Surface | Period type | Field | Boundary | Server authority | KPI scope | URL state | Canonical? |
|---|---|---|---|---|---|---|---|
| Operations Center | Free-form date range | createdAt | [from, to) | ✅ | KPI + table share same where | ?dateFrom=&dateTo= | ✅ CANONICAL |
| Bookings upcoming | Detector | serviceDate | >= now | ✅ | — | ?upcoming=true | ✅ CANONICAL |
| Bookings overdue | Detector | createdAt | < threshold | ✅ | — | ?overdue=true | ✅ CANONICAL |
| Command Center | Preset periods | Computed range | Preset-dependent | ✅ | Dashboard scope | ?preset=MONTH | ✅ CANONICAL (different surface) |
| CRM Activity | Free-form date range | occurredAt | from/to | ✅ | — | local state | ✅ CANONICAL (different field) |

**Classification:** All canonical. No competing authorities. No undocumented variations.

---

# 19. Server Authority

## Verified for all surfaces:

| Surface | UI state → HTTP → DTO → Controller → Service → Prisma | Server filtering | Server aggregation | KPI/table equivalence | URL authority | No client-side filtering |
|---|---|---|---|---|---|---|
| Requests | ✅ | ✅ | ✅ | ✅ (spec proven) | ✅ | ✅ |
| Orders | ✅ | ✅ | ✅ | ✅ (overviewWhere) | ✅ | ✅ |
| Bookings | ✅ | ✅ | ✅ | ✅ (overviewBookingWhere) | ✅ | ✅ |
| Payments | ✅ | ✅ | ✅ | ✅ (buildPaymentsScopes) | ✅ | ✅ |
| CRM Activity | ✅ | ✅ | — | — | local state | ✅ |
| Command Center | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

# 20. Security / Tenant / RBAC

- ✅ Temporal filters are additive predicates (never replace authorization)
- ✅ Cross-tenant: channel scope (acquisitionSource) intersected with all queries
- ✅ Partner own-scope: PARTNER users see only their own entities
- ✅ Export endpoints require same permissions as list endpoints
- ✅ No IDOR via date filters (entity ID is primary filter)
- ✅ C17 full matrix 1560/1560 covers RBAC; D8 adds no new permissions

---

# 21. Performance

| Area | Status | Classification |
|---|---|---|
| Indexes on createdAt | ✅ Present on key entities | SAFE |
| Indexes on serviceDate | ✅ Booking composite indexes | SAFE |
| Range queries | ✅ Prisma TIMESTAMP range | SAFE |
| Sorting by DateTime | ✅ Default createdAt desc | SAFE |
| KPI aggregates | ✅ Same where as table | SAFE |
| Cross-schema detectors | ✅ Raw SQL DISTINCT (acceptable scale) | OPTIMIZATION (future) |
| Full-table scans | ⚠️ paymentFailed/pendingRefund cross-schema | OPTIMIZATION (future) |

No performance blockers for D8.

---

# 22. Test Coverage

| Contract | Existing test | Exact behavior proved | Missing evidence | D8 priority |
|---|---|---|---|---|
| Date boundary [from,to) | request-kpi-date-scope.spec.ts (10 tests) | inclusive lower, exclusive upper | — | RESOLVED |
| Invalid date (Requests) | request-sort.spec.ts L318-327; request-kpi-date-scope.spec.ts T7/T8 | 400 BadRequestException from service (sort params); T7/T8 only mirror the where-builder locally and assert the legacy Invalid-Date behavior | T7/T8 predate `validateDateParam` — refresh during B-06 | D8 MUST (B-06) |
| KPI/table scope parity | booking-kpi-scope.spec.ts, order-kpi-scope.spec.ts | overview strips KPI dimensions, preserves period | — | RESOLVED |
| Payment date validation | payments-registry.spec.ts L243 | throws ValidationDomainError (to be aligned to canonical 400 during B-06) | assertion update planned | D8 MUST (B-06) |
| DST ambiguous | service-time.spec.ts | early instant (first occurrence) | — | RESOLVED |
| DST nonexistent | service-time.spec.ts | instant after gap | — | RESOLVED |
| Cross-midnight | service-time.spec.ts | next local day | — | RESOLVED |
| Date-only (no midnight fab) | service-time.spec.ts | null return | — | RESOLVED |
| Invalid date (Orders) | — | SILENT Invalid Date (no test) | ⚠️ MISSING | D8 MUST |
| Invalid date (Bookings) | — | SILENT Invalid Date (no test) | ⚠️ MISSING | D8 MUST |
| Reversed range | — | Not tested | ⚠️ MISSING | D8 SHOULD |
| Empty range | — | Not tested | ⚠️ MISSING | D8 SHOULD |
| Timezone display | — | Not tested | ⚠️ MISSING | D8 SHOULD |
| URL period persistence | — | Not tested | ⚠️ MISSING | D8 SHOULD |
| Tenant isolation + period | — | Not tested | ⚠️ MISSING | D8 SHOULD |

---

# 23. Final Reclassified Findings

| ID | Original classification | Reconciled classification | D8? |
|---|---|---|---|
| B-01 | P3 (documentation) | **INTENTIONAL DIFFERENCE — DOCUMENTATION GAP** | YES (doc) |
| B-02 | P3 (documentation) | **INTENTIONAL DIFFERENCE — DOCUMENTATION GAP** | YES (doc) |
| B-03 | P3 (documentation) | **INTENTIONAL DIFFERENCE — DOCUMENTATION GAP** | YES (doc) |
| B-04 | P3 (DST) | **NO ISSUE / DOCUMENTATION GAP** (Implementation issue = NO; Code defect = NO; Documentation gap = YES) | YES (doc only) |
| B-05 | P3 (cross-midnight) | **NO ISSUE / DOCUMENTATION GAP** (Implementation issue = NO; Code defect = NO; Documentation gap = YES) | YES (doc only) |
| B-06 | P2 (validation) | **CONFIRMED DEFECT** | YES (implementation) |
| B-07 | P3 (UTC semantics) | **DOCUMENTATION GAP** | YES (doc) |
| B-08 | P3 (shared component) | **STYLE PREFERENCE — NOT architectural** | SHOULD (not MUST) |
| B-09 | P3 (export) | **D9-OWNED** | NO (D9) |
| B-10 | P3 (shared component) | **STYLE PREFERENCE — NOT architectural** | SHOULD (not MUST) |
| B-11 | P3 (terminology) | **TERMINOLOGY ADJUSTMENT** | YES (doc) |

---

# 24. D8 MUST / SHOULD / OUT OF SCOPE / DEFERRED

## MUST

1. **Standardize invalid date validation (B-06; canonical contract = Option A: HTTP 400 + BadRequestException)** — apply the `validateDateParam()` pattern to Orders (list + KPI), Bookings (list + overview), CRM Activity (404 → 400), CRM customers period filter and Catalog publishedAt filter; align Payments from 422 to 400. Message: "<param> must be a valid date"; validate dateFrom and dateTo independently at the service boundary before any Prisma where construction; identical validation for list and KPI; prove with tests (including refreshing `request-kpi-date-scope.spec.ts` T7/T8 and updating `payments-registry.spec.ts`). This is the single CONFIRMED DEFECT.

2. **Complete the Global Temporal Vocabulary** — update `temporal-readiness.md` or create a new canonical document that includes ALL temporal categories: Entity time, Lifecycle time, Service occurrence (D2.8A), Financial time (D2.10C/D2.12/D2.13), Event time, Processing time, Presentation period — plus the Analytics visibility row (C3: PARTIAL / KPI semantics D11) and the period boundary semantics variance (C2: `[from, to)` vs `[from, to]`).

3. **Document the Operations Center Period Contract** — formalize: GLOBAL scope, [from, to) boundary, date-only UTC midnight semantics, no timezone conversion, server authority.

4. **Document cross-domain temporal vocabulary differences** — explicitly classify: createdAt (Operations) vs serviceDate (Booking upcoming) vs occurredAt (CRM Activity) as intentional domain differences.

5. **Document the primary registry temporal dimension per entity** — rename "primary" to "default registry temporal dimension" and document which field is used for default sort and period filter in each registry.

## SHOULD

1. **Shared TemporalDisplay component** — extract `fmtDate()` into a shared component (code hygiene, not architectural).

2. **Document DST handling contract** — include in D8 vocabulary: ambiguous → early instant, nonexistent → after gap, cross-midnight → next local day.

3. **Document the three timezone layers** — storage (UTC), business (IANA authority), display (browser/runtime).

4. **Edge-case tests not required for the confirmed defect** — reversed/empty date ranges, URL period persistence behavior.

## OUT OF SCOPE

1. D9 Export Framework Requalification (export column consistency)
2. D10 Partner Performance Attribution
3. D11 Project-Wide KPI/Status Semantics
4. D12 CRM/KPI Drill-down Routing
5. D13 Voucher
6. D14 PRE-STEP 3.12 Final Requalification
7. Finance Center PSP temporal milestones
8. Schema/migration changes
9. New temporal fields
10. Timezone authority changes
11. Analytics KPI definitions, comparison and drill-down semantics (D11-owned per C3)

## DEFERRED

1. Export temporal field standardization → D9
2. Full KPI read-model temporal consistency → D11
3. CRM temporal drill-down → D12
4. Finance PSP milestones → Finance track
5. Period comparison (this vs last period) → D11

---

# 25. Dependencies

```text
D7 completed ─────┐
D8 current ───────┼──► D8 implementation
D0 closed ────────┘

No blocking dependencies.
```

---

# 26. Implementation Prompt Decision

**JUSTIFIED.**

All six conditions from the correction prompt are met:

1. D8 scope bounded — 5 MUST items, all proven D8-owned; no D9/D11/Finance leakage.
2. B-06 canonical error contract determined — Option A (HTTP 400 + BadRequestException), evidence-backed.
3. Analytics visibility ownership determined — visibility = D8 (PARTIAL), KPI semantics = D11.
4. No unresolved architectural blocker remains.
5. D8 MUST items implementable without changing frozen contracts — documentation + service-boundary validation only; the Payments 422→400 alignment touches a tested module-local behavior, not a frozen contract (`finance-temporal-contract.md` 422 rule governs ledger `occurredAt` payload validation, not registry query filters).
6. D9/D11/Finance boundaries explicit (§24 DEFERRED + C3).

The D8 implementation prompt should cover:
1. B-06 fix per canonical contract (MUST item 1)
2. Complete the Global Temporal Vocabulary document (incl. Analytics visibility row, boundary variance)
3. Document the Operations Center Period Contract
4. Document cross-domain temporal differences
5. Document default registry temporal dimensions per entity

The prompt MUST NOT create new fields, modify schema, change frozen contracts, or touch D9+ scope.

---

# 27. Git Evidence

```text
BASELINE SHA: f41bd6a (correction pass baseline)
FINAL SHA: f41bd6a (report-only change; report file untracked at correction time)
HEAD == origin/master: YES
tracked clean: YES (only untracked docs: prompts, reports, roadmap)
production diff: NONE (no schema, no migrations, no backend/frontend code, no tests)
report path: docs/reports/PHASE_3_D8_EVIDENCE_SCOPE_RECONCILIATION_REPORT.md
```

---

# 28. Final Output

```text
D8 FINAL RECONCILIATION CORRECTION

VERDICT: A — FINAL RECONCILIATION ACCEPTED / IMPLEMENTATION READY

Original Audit Verdict: B (Audit Ready with Blockers)
Reconciled Verdict: A (Reconciled / Implementation Ready)

C1 Classification: PASS
C2 Invalid-Date Contract: PASS
Canonical exception: BadRequestException
Canonical HTTP status: 400
Canonical response shape: { statusCode: 400, message: "<paramName> must be a valid date", requestId? } + X-Request-Id header

C3 Analytics Visibility: PASS
D8 Analytics scope: temporal VISIBILITY only — PARTIAL (server-authoritative period/preset/granularity/
                    comparison/timezone documented into the D8 vocabulary; no Analytics implementation)
D11 Analytics scope: KPI semantic reconciliation — KPI definitions, bucket-vs-headline reconciliation (RT2A),
                     comparison semantics, period comparison display

C4 Temporal Visibility Status:
- foundations: EXISTING (temporal semantics + authority/filtering, spec-proven)
- authority/filtering: EXISTING (server-side, KPI/table parity proven)
- global contract: PARTIAL / READY FOR CANONIZATION; canonical project-wide contract NOT YET FROZEN

Confirmed defects: 1 (B-06 — surfaces: Orders, Bookings, CRM Activity 404-variant, CRM customers period, Catalog; Payments 422→400 alignment)
Documentation gaps: 6 total — 1 standalone (B-07) + 3 embedded in INTENTIONAL DIFFERENCE (B-01, B-02, B-03) + 2 embedded in NO ISSUE (B-04, B-05: Implementation issue = NO, Code defect = NO, Documentation gap = YES)
Intentional differences: 3 (B-01, B-02, B-03 — each WITH a documentation gap)
D9-owned: 1 (B-09: export column consistency)
D11-owned: 0 findings; Analytics KPI semantics explicitly assigned to D11 (C3)
Finance-owned: 0
Rejected findings: 0 (B-04/B-05 are NO ISSUE / DOCUMENTATION GAP, not "rejected")
Style preference (not architectural): 2 (B-08, B-10)
Terminology adjustment: 1 (B-11)

D8 MUST: 5 items (B-06 fix per canonical 400 contract; vocabulary completion incl. Analytics visibility row + boundary variance; Operations Period contract; cross-domain intentional semantics; default registry temporal dimension terminology)
D8 SHOULD: 4 items (shared TemporalDisplay; DST contract doc; three timezone layers doc; edge-case tests)
D8 OUT OF SCOPE: 11 items (D9–D14, schema, new fields, timezone authority, Analytics KPI semantics)
D8 DEFERRED: 5 items (D9 export fields; D11 KPI read-model + period comparison; D12 drill-down; Finance PSP)

Implementation Prompt: JUSTIFIED (all six conditions met)

Open governance decisions: NONE
Blocking issues: NONE

Git:
HEAD == origin/master: YES
Tracked clean: YES
Production changes: NONE
Final SHA: f41bd6a (report-only change; report untracked at correction time)
```

---

*Generated with Codebuff 🤖*
*Co-Authored-By: Codebuff <noreply@codebuff.com>*
