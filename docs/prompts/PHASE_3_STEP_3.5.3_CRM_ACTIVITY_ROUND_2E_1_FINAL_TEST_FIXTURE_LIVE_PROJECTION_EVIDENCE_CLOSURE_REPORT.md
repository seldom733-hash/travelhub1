# PHASE 3 — STEP 3.5.3 — PLATFORM CRM

## ROUND 2E.1 — FINAL TEST FIXTURE + LIVE PROJECTION EVIDENCE CLOSURE

### SOURCE ADAPTER TEST BASELINE ELIMINATION + DETERMINISTIC LIVE RUNTIME PROOF + FINAL STEP 3.5.3 ACCEPTANCE

---

## 1. REPOSITORY

| Поле | Значение |
|---|---|
| Starting HEAD | `a12982d` |
| Final HEAD | (pending commit) |
| origin/master | `a12982d` |
| HEAD == origin/master | ✓ |
| Worktree | master |

Коммиты `990e599` и `2ac80b6` reachable ✓

## 2. FAILURE 1 — ORDER ADAPTER

| Поле | Значение |
|---|---|
| Original failure | `OrderAdapter — projects an Order with customerId and partner binding via items` — Expected `partner-1`, Received `null` |
| Root cause | Stale test fixture: provided `items: [{ product: { partnerId: 'partner-1' } }]` but NOT `sellerPartnerId`. Production adapter reads `source.sellerPartnerId` (canonical authority since `990e599`). Fixture data didn't match canonical model. |
| Canonical authority | `Order.sellerPartnerId` (denormalized at creation) |
| Files changed | `backend/src/modules/crm-activity/crm-activity.service.spec.ts` — added `sellerPartnerId: 'partner-1'` to OrderAdapter test fixture; updated test description from "via items" to "via sellerPartnerId" |
| Assertion preserved | ✓ — `expect(result!.partnerId).toBe('partner-1')` unchanged |
| Production code changed | NO |
| Final result | PASS ✓ |

## 3. FAILURE 2 — BOOKING ADAPTER

| Поле | Значение |
|---|---|
| Original failure | `BookingAdapter — projects a Booking with indirect customer/partner binding` — Expected `partner-1`, Received `null` |
| Root cause | Stale test fixture: provided `order: { customerId: 'cust-1' }` but NOT `sellerPartnerId`. Production adapter reads `source.order?.sellerPartnerId` (canonical authority). |
| Canonical authority | `Booking → Order.sellerPartnerId` (cross-schema via Order context) |
| Files changed | `backend/src/modules/crm-activity/crm-activity.service.spec.ts` — added `sellerPartnerId: 'partner-1'` to BookingAdapter test fixture's `order` object |
| Assertion preserved | ✓ — `expect(result!.partnerId).toBe('partner-1')` unchanged |
| Production code changed | NO |
| Final result | PASS ✓ |

## 4. SOURCE ADAPTER SUITE

| Метрика | Значение |
|---|---|
| Tests | 36 |
| Passed | 36 |
| Failed | 0 |
| Skipped | 0 |

Все Source Adapter tests PASS ✓

## 5. BACKEND FULL

| Метрика | Значение |
|---|---|
| Discovered | 1236 |
| Passed | 1236 |
| Failed | 0 |
| Skipped | 0 |
| Previous baseline failures remaining | 0 (2 stale fixtures resolved) |

`--maxWorkers=4` для стабильного результата (resource contention flakiness в perf/security при полном параллельном запуске — не связано с CRM Activity).

## 6. LIVE PROJECTION

| Поле | Значение |
|---|---|
| Subject type | CUSTOMER |
| Subject ID | `0c534877-7dee-4d33-1078-68e39c8fe785` (CRM-00000089 Tatiana Pedersen) |
| Source type | OPERATIONAL_NOTE |
| Source ID | `d7ab3053-6465-4de9-900b-3ad7d5d53276` |
| Event type | NOTE_CREATED |
| Created at | `2026-08-28T07:28:22.513Z` |
| Activity before | 20 items (hasMore=true) |
| Activity after | 20 items (hasMore=true) — new note appears on first page as most recent |
| Activity occurredAt | `2026-08-28T07:28:22.513Z` |
| Correct subject | ✓ — note appears in correct customer's Activity |
| Wrong-subject leakage | 0 — note does NOT appear for other customer `b764c1cc-8036-463e-1186-1350a6f58cf9` |
| Duplicate rows | 0 (1 match = PASS) |
| Rebuild between create/query | NO — `POST /crm-activity/backfill` was NOT called |
| API proof | `GET /api/v1/customers/{id}/activity` — note with matching sourceId found |
| Browser proof | N/A (backend-only evidence sufficient for this round) |

## 7. CUSTOMER PAYMENT REGRESSION

| Метрика | Значение |
|---|---|
| Customer | CRM-00000089 (Tatiana Pedersen) |
| Payments in Activity | 1 PAYMENT_CAPTURED |
| Wrong customer | 0 |
| Duplicates | 0 |

Payment ownership from `990e599` preserved ✓

## 8. PARTNER ACTIVITY REGRESSION

| Метрика | Значение |
|---|---|
| Partner | Baku Tours Pro (`aad76dd9-93ad-4d1c-107a-54b4b5adc8a2`) |
| Activity count (page 1) | 20 (hasMore=true) |
| Source types | ORDER, PAYMENT, BOOKING |
| Cross-partner leakage | 0 (subject-bound queries) |

## 9. RBAC REGRESSION

| Path | Authorized | Unauthorized | Anonymous |
|---|---|---|---|
| Customer Activity | 200 ✓ | 401 ✓ | 401 ✓ |
| Partner Activity | 200 ✓ | 401 ✓ | 401 ✓ |

## 10. TESTS / BUILDS

| Gate | Result |
|---|---|
| Backend TSC | PASS ✓ |
| Backend build | PASS ✓ |
| Frontend TSC | PASS ✓ |
| Frontend build | PASS ✓ (next build) |
| Frontend full tests | 243/243 PASS ✓ |

## 11. PRODUCTION CODE

| Поле | Значение |
|---|---|
| Changed | 0 |
| Why | Only stale test fixtures were updated, no adapter/service/controller changes |
| Schema | 0 |
| Migration | 0 |

## 12. REPORT CORRECTION

Round 2E report §17 "Relation to Step 3.5.3" исправлен:

**Было:** `Unrelated — adapter code reads source.sellerPartnerId correctly; test fixture incomplete`

**Стало:** `Direct test coverage of Activity source adapters. Failure caused by stale fixture not matching canonical sellerPartnerId authority. Production defect: NO, after repository verification.`

Сохранено историческое fact: `Round 2E initial qualification found 2 stale fixture failures. Round 2E.1 reconciled them.`

## 13. ROUND 2E.1 REPORT

Создан: `PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2E_1_FINAL_TEST_FIXTURE_LIVE_PROJECTION_EVIDENCE_CLOSURE_REPORT.md`

## 14. ROADMAP

| Елемент | Статус |
|---|---|
| Round 2E | FULLY CLOSED |
| Step 3.5.3 | FULLY CLOSED |
| Exact canonical NEXT | `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` |

## 15. FINDINGS

- **P0:** 0
- **P1:** 0
- **P2:** 0 (2 stale fixture issues resolved in Round 2E.1)

## 16. BEFORE/AFTER FAILURE MATRIX

| Test | Before | Root Cause | Fix | After |
|---|---|---|---|---|
| OrderAdapter partner binding | FAIL | Stale fixture missing `sellerPartnerId` | Added `sellerPartnerId: 'partner-1'` to fixture | PASS |
| BookingAdapter partner binding | FAIL | Stale fixture missing `order.sellerPartnerId` | Added `sellerPartnerId: 'partner-1'` to fixture order | PASS |

## 17. FINAL TEST MATRIX

| Gate | Previous | Final |
|---|---|---|
| Backend full | 1234 PASS / 2 FAIL | 1236 PASS / 0 FAIL |
| Source Adapter failures | 2 | 0 |
| Backend TSC | PASS | PASS |
| Backend build | PASS | PASS |
| Frontend full | 243/243 PASS | 243/243 PASS |
| Frontend TSC | PASS | PASS |
| Frontend build | PASS | PASS |
| Customer Payment regression | PASS | PASS |
| Partner Activity regression | PASS | PASS |
| Live projection without rebuild | evidence gap | ✓ PROVED |

## 18. CHANGE BOUNDARY

```
Source Adapter test fixture: 1 file (crm-activity.service.spec.ts)
Round 2E report correction: 1 file (ROUND_2E report)
Round 2E.1 report: 1 file (this report)
```

```
production code = 0
schema = 0
migration = 0
```

## 19. COMMIT

Pending —将在所有报告完成后提交。

---

*Отчёт создан: 2026-08-28*
*Round 2E initial qualification found 2 stale fixture failures.*
*Round 2E.1 reconciled them.*
*VERDICT A — FULLY CLOSED*
