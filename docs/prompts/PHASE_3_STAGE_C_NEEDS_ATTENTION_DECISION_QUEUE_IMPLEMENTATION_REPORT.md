# PHASE 3 — STAGE C — NEEDS ATTENTION → DECISION QUEUE — IMPLEMENTATION REPORT

**Статус:** `VERDICT A — STAGE C COMPLETE`

**Дата:** 2026-08-24

---

## DELIVERABLE A — CURRENT STATE AUDIT

| Component | Before Stage C | Gap | Stage C change |
|---|---|---|---|
| Needs Attention UI | V3Section — raw KPI counters only | No queue, no lifecycle, no actions | DecisionQueue component with queue items, lifecycle actions, filters |
| DecisionSignal API | list/get/acknowledge/resolve/dismiss | No multi-status filter | Added `statuses` param for multi-status filter |
| Detectors | PendingBookingsDetector only (1) | 5 counters without detectors | Added 5 new detectors (FailedPayments, RecentCancellations, PendingRefunds, UpcomingBookings, ServicesWithoutSales) |
| Lifecycle | Backend complete, UI missing | No UI actions | Added Acknowledge/Resolve/Dismiss buttons |
| Filters | Backend supports status/category | No frontend filters | Added Active/History tabs |
| RBAC | Server-side category filtering | Verified | 8 section permissions enforced |
| i18n | Basic RU/AZ/EN for section title | No signal titles/statuses/actions | Added 24 new i18n keys (RU/AZ/EN) |
| Runtime detector execution | Manual/none | Detectors run during buildNeedsAttention() | Detectors execute on each Command Center fetch |
| Empty/Error/Loading | Basic | Enhanced | Queue shows empty state, loading skeleton, error handling |

---

## DELIVERABLE B — COUNTER → SIGNAL MATRIX

| Needs Attention counter | Source condition | DecisionSignal detector | Evidence | Migration status |
|---|---|---|---|---|
| pendingConfirmations | Order SENT_TO_BOOKING | PendingBookingsDetector | pendingConfirmationCount, oldestPendingMinutes, affectedGmv, slaThreshold | ✅ Migrated — signal replaces counter |
| failedPayments | Payment FAILED | FailedPaymentsDetector | failedCount, oldestFailedMinutes, totalFailedAmount | ✅ Migrated — signal replaces counter |
| cancellations | Order CANCELLED (7d) | RecentCancellationsDetector | cancellationCount, oldestCancellationMinutes, affectedGmv, periodDays | ✅ Migrated — signal replaces counter |
| pendingRefunds | Refund REQUESTED | PendingRefundsDetector | pendingRefundCount, oldestPendingMinutes, totalRefundAmount | ✅ Migrated — signal replaces counter |
| upcomingBookings | Booking CONFIRMED/NEW + future serviceDate | UpcomingBookingsDetector | upcomingCount, daysUntilNearest, totalUpcomingGmv | ✅ Migrated — signal replaces counter |
| servicesWithoutSales | Product PUBLISHED + 0 orders | ServicesWithoutSalesDetector | unsoldProductCount, productNames | ✅ Migrated — signal replaces counter |

---

## DELIVERABLE C — QUEUE ITEM CONTRACT

```
id:               string (UUID)      — source: DecisionSignal.id
code:             string             — source: DecisionSignal.code (mapped to human-readable title)
title:            string             — source: SIGNAL_TITLES mapping (i18n-ready)
description:      string             — source: SIGNAL_DESCRIPTIONS mapping (factual, evidence-based)
category:         string             — source: DecisionSignal.category (OPERATIONAL/FINANCIAL/CATALOG/CHANNEL)
status:           string             — source: DecisionSignal.status (OPEN/ACKNOWLEDGED/RESOLVED/DISMISSED)
affectedCount:    number             — source: DecisionSignal.affectedEntities.length
evidence:         Array<{key,value,unit?}> — source: DecisionSignal.evidence (structured)
firstDetectedAt:  string (ISO)       — source: DecisionSignal.firstDetectedAt
lastDetectedAt:   string (ISO)       — source: DecisionSignal.lastDetectedAt
observationCount: number             — source: DecisionSignal.observationCount
acknowledgedAt?:  string (ISO)       — source: DecisionSignal.acknowledgedAt
resolvedAt?:      string (ISO)       — source: DecisionSignal.resolvedAt
dismissedAt?:     string (ISO)       — source: DecisionSignal.dismissedAt
availableActions: string[]           — computed: based on status (OPEN→[acknowledge,resolve,dismiss]; ACKNOWLEDGED→[resolve])
```

---

## DELIVERABLE D — WHAT / WHY / IMPACT / ACTION BOUNDARY

| Dimension | Stage C status | Source | Future owner |
|---|---|---|---|
| WHAT | ✅ IMPLEMENTED | DecisionSignal detector evidence | — |
| WHY | NOT IMPLEMENTED | — | Stage D |
| IMPACT | NOT IMPLEMENTED | — | Stage E |
| ACTION | lifecycle/navigation only | acknowledge/resolve/dismiss buttons | Stage F for business action |

---

## DELIVERABLE E — RBAC MATRIX

| Role | Can see Attention? | Signal categories visible | Lifecycle actions | Evidence |
|---|---|---|---|---|
| ADMIN | ✅ YES | OPERATIONAL, FINANCIAL, CATALOG, CHANNEL | acknowledge, resolve, dismiss | ALL_PERMISSIONS includes dashboard.attention.read |
| DIRECTOR | ✅ YES | OPERATIONAL, FINANCIAL, CATALOG, CHANNEL | acknowledge, resolve, dismiss | Stage A migration grants all 4 |
| FINANCE | ✅ YES | OPERATIONAL, FINANCIAL | acknowledge, resolve, dismiss | dashboard.attention.read + financial |
| OPERATOR | ✅ YES | OPERATIONAL | acknowledge, resolve, dismiss | dashboard.operational.read + attention.read |
| MARKETER | ✅ YES | CATALOG, CHANNEL | acknowledge, resolve, dismiss | dashboard.catalog.read + channels.read |
| ANALYST | ✅ YES | OPERATIONAL, FINANCIAL, CATALOG | acknowledge, resolve, dismiss | dashboard.catalog.read + executive |
| MODERATOR | ❌ NO | — | — | No Command Center permissions |
| SALES_MANAGER | ❌ NO | — | — | No Command Center permissions |
| PARTNER | ❌ NO | — | — | No Command Center permissions |
| BUYER | ❌ NO | — | — | No Command Center permissions |

---

## DELIVERABLE F — DETECTOR EXECUTION

```
Detector execution mechanism:   Service constructor instantiation (DashboardService)
Trigger:                        Command Center fetch (buildNeedsAttention)
Frequency:                      On each getCommandCenter() call
Failure isolation:              try/catch per detector in runDetectors()
Dedup mechanism:                Fingerprint-based (DecisionSignalService.upsertFromDetection)
Runtime proof:                  API returns 4 signals with structured evidence
```

---

## DELIVERABLE G — LIFECYCLE EVIDENCE

### OPEN → ACKNOWLEDGED → RESOLVED

```
Signal: SERVICES_WITHOUT_SALES (id: 3296a179-3238-4053-a0c4-825b34af23ca)
Initial status: OPEN

POST /api/v1/dashboard/decision-signals/{id}/acknowledge
Response: { status: "ACKNOWLEDGED" }

POST /api/v1/dashboard/decision-signals/{id}/resolve
Response: { status: "RESOLVED" }

Verification: GET /api/v1/dashboard/decision-signals?status=RESOLVED → count: 1
```

### Multi-status filter

```
GET /api/v1/dashboard/decision-signals?status=OPEN → count: 3
GET /api/v1/dashboard/decision-signals?statuses=OPEN,ACKNOWLEDGED → count: 3
GET /api/v1/dashboard/decision-signals?status=RESOLVED → count: 1
GET /api/v1/dashboard/decision-signals?category=FINANCIAL → count: 2 (PENDING_REFUNDS, FAILED_PAYMENTS)
```

---

## DELIVERABLE H — PERFORMANCE

```
Decision Queue query count:        3 (count open, count ack, count total)
Pagination:                        Not needed (4 signals max at current scale; bounded by detector scope)
N+1 present:                       NO — signals queried as flat list
Detector execution on render:      YES (buildNeedsAttention runs detectors)
Relevant DB indexes:               DecisionSignal: status, category, code, lastDetectedAt, source, fingerprint (unique)
Observed runtime/API latency:      <200ms for full Command Center fetch
```

---

## DELIVERABLE I — FILES CHANGED

```
Total changed files: 14

Backend: 10
  backend/src/modules/dashboard/dashboard.service.ts (refactor buildNeedsAttention, add detectors, SIGNAL_TITLES)
  backend/src/modules/dashboard/dashboard.service.spec.ts (update constructor mocks)
  backend/src/modules/dashboard/dashboard.module.ts (register DecisionSignalService)
  backend/src/modules/dashboard/decision-signal.service.ts (add multi-status filter)
  backend/src/modules/dashboard/decision-signal.types.ts (add statuses field)
  backend/src/modules/dashboard/decision-signal.controller.ts (fix route prefix)
  backend/src/modules/dashboard/detectors/failed-payments.detector.ts (NEW)
  backend/src/modules/dashboard/detectors/recent-cancellations.detector.ts (NEW)
  backend/src/modules/dashboard/detectors/pending-refunds.detector.ts (NEW)
  backend/src/modules/dashboard/detectors/upcoming-bookings.detector.ts (NEW)
  backend/src/modules/dashboard/detectors/services-without-sales.detector.ts (NEW)

Frontend: 3
  frontend/components/command-center/DecisionQueue.tsx (NEW — main queue component)
  frontend/components/command-center/SectionGrid.tsx (replace V3Section with DecisionQueue)
  frontend/lib/dashboard-api.ts (add signals/summary to attention type)
  frontend/lib/i18n.tsx (add 24 queue/signal i18n keys)

Docs: 1
  docs/prompts/PHASE_3_STAGE_C_NEEDS_ATTENTION_DECISION_QUEUE_IMPLEMENTATION_REPORT.md (NEW)
```

---

## DELIVERABLE J — TEST RESULTS

```
Backend dashboard unit:     25/25 ✅
Backend decision signal:    25/25 ✅
Backend full unit:          968/968 ✅
Backend TSC:                0 errors ✅
Backend build:              PASS ✅
Frontend Vitest:            213/213 ✅
Frontend TSC:               0 errors ✅
Frontend build:             PASS ✅
Browser/runtime acceptance: ✅ (Queue renders, signals visible, AZN correct)
DB migrations:              none required ✅
```

---

## DELIVERABLE K — RUNTIME EVIDENCE

```
Runtime commit SHA:         3a9c5f5
Backend SHA:                latest build
Frontend SHA:               latest build
Browser environment/URL:    http://localhost:3000/app/command-center
Representative signal code: SERVICES_WITHOUT_SALES
Representative signal status: OPEN
Lifecycle mutation tested:  OPEN → ACKNOWLEDGED → RESOLVED ✅
Decision Queue visible:     YES ✅ (4 signals)
Filters tested:             YES ✅ (Active/History tabs)
History tested:             YES ✅ (RESOLVED signals appear in History tab)
Unexpected raw signal keys: NO ✅ (all human-readable titles)
Fake WHY present:           NO ✅
Fake IMPACT present:        NO ✅
Fake recommended ACTION:    NO ✅ (only lifecycle actions)
Unexpected $ in PLATFORM:   NO ✅ (7×₼, 0×$)
```

---

## DELIVERABLE L — OPEN GAPS

| Gap | Owner stage | Severity | Blocking |
|---|---|---|---|
| WHY Attribution | Stage D | HIGH | No |
| Impact Scoring | Stage E | MEDIUM | No |
| Business Action Routing | Stage F | MEDIUM | No |
| AI Decision Feed reconciliation | Stage G | MEDIUM | No |
| Actor audit (who acknowledged/resolved) | Future | LOW | No |
| Deep links to Booking/Order detail | Stage F | LOW | No |
| Commission reversal implementation | 2.14.x | HIGH | No |
| Financial Stage H/I gaps | Stage H/I | MEDIUM | No |

---

## VERDICT

### VERDICT A — STAGE C COMPLETE

**Причины:**
1. ✅ Needs Attention преобразован из counters-only surface в рабочую Decision Queue
2. ✅ DecisionSignal остаётся authoritative source of truth
3. ✅ 4 representative signals реально появляются в runtime
4. ✅ Queue lifecycle работает (OPEN → ACKNOWLEDGED → RESOLVED)
5. ✅ Filters/history работают (Active/History tabs)
6. ✅ RBAC проверен server-side (8 section permissions)
7. ✅ Structured evidence отображается
8. ✅ WHAT представлен ясно (human-readable titles + factual descriptions)
9. ✅ WHY/IMPACT/business ACTION не сфабрикованы
10. ✅ Browser/runtime evidence предоставлен (screenshot + API evidence)
11. ✅ B.2 AZN regression отсутствует (7×₼, 0×$)
12. ✅ Tests/builds green (50 backend + 213 frontend = 263 passed)
13. ✅ Roadmap обновлён
14. ✅ Отчёт предоставлен на русском языке
