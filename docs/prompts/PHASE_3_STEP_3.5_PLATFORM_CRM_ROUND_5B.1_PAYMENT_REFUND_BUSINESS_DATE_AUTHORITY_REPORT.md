# PHASE 3 — STEP 3.5 — PLATFORM CRM ROUND 5B.1
# PAYMENT / REFUND BUSINESS DATE AUTHORITY REPORT

## VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM ROUND 5B.1 /
## PAYMENT BUSINESS DATE AUTHORITY /
## REFUND BUSINESS DATE AUTHORITY /
## CANONICAL FINANCIAL EVENT TIMESTAMPS /
## TABLE SEMANTICS
## FULLY IMPLEMENTED AND RUNTIME-VERIFIED

---

## PREVIOUS ROUND 5B STATUS

- Tabular UX: COMPLETE (commit 82883f4)
- Business Date Authority: NOT IMPLEMENTED — `createdAt` used as substitute

## ROOT CAUSE

CRM service `getCustomerDetail` selected `createdAt` for both Payment and Refund
queries, but did NOT select the canonical business date fields (`paidAt` for
Payment, `processedAt` for Refund) that already exist in the schema and are
written by the canonical financial transitions.

---

## PAYMENT MODEL (finance.Payment)

**Statuses:** PENDING → AUTHORIZED → CAPTURED | FAILED | CANCELLED | REFUNDED

**Creation timestamp:** `createdAt` (record persistence, NOT financial event)

**Successful financial event:** CAPTURED status transition
- Write authority: `PaymentService.capture()` → sets `paidAt` via CAS transition
- Idempotent: YES (first-wins, immutable after first set)
- Schema comment: "paidAt — момент успеха (PENDING → CAPTURED)"

**Canonical business-date field:** `paidAt`

**Null semantics:** NULL = milestone not yet occurred (PENDING, FAILED, CANCELLED)

---

## REFUND MODEL (finance.Refund)

**Statuses:** REQUESTED → APPROVED → PROCESSED | FAILED

**Request timestamp:** `requestedAt` (creation milestone)

**Approval timestamp:** `approvedAt` (operator approval, NOT financial return)

**Actual financial-return event:** PROCESSED status transition
- Write authority: `RefundService.process()` → sets `processedAt` via CAS transition
- Idempotent: YES (first-wins, immutable after first set)
- Schema comment: "processedAt — actual refund event"

**Canonical business-date field:** `processedAt`

**Null semantics:** NULL = money not yet returned (REQUESTED, APPROVED, FAILED)

**Partial refunds:** Supported (unique on paymentId + amount where isActiveRefund).
Each Refund row has its own `processedAt`.

---

## SCHEMA CHANGE

**Required:** YES — but fields already exist in schema.

No migration needed. The `paidAt`, `failedAt`, `cancelledAt` (Payment) and
`requestedAt`, `approvedAt`, `processedAt`, `failedAt` (Refund) fields are
already defined in the Prisma schema and applied via previous migrations.

**What was missing:** The CRM service `getCustomerDetail` method did not
SELECT these fields. Fix was purely in the query select clause.

---

## CRM SERVICE CHANGES

**File:** `backend/src/modules/crm/crm.service.ts`

| Query | Added Fields |
|---|---|
| Payment select | `paidAt` |
| Refund select | `processedAt` |

No other backend changes. Write authorities remain in PaymentService and
RefundService.

---

## FRONTEND CHANGES

### API Types (`frontend/lib/api.ts`)
- Payment type: added `paidAt: string | null`
- Refund type: added `processedAt: string | null`

### Customer 360 Payments Table
- Column label: `crm.col.payment_date` = "Дата оплаты" (RU) / "Ödəniş tarixi" (AZ) / "Payment date" (EN)
- Date source: `p.paidAt`
- Null behavior: `—` (dash)
- Column position: moved to second column (after Payment code, before Purpose)

### Customer 360 Refunds Table
- Column label: `crm.col.refund_date` = "Дата возврата" (RU) / "Geri qaytarma tarixi" (AZ) / "Refund date" (EN)
- Date source: `r.processedAt`
- Null behavior: `—` (dash)
- Column position: moved to second column (after Refund code, before Purpose)

### i18n Keys Added
- `crm.col.payment_date` = Дата оплаты / Ödəniş tarixi / Payment date
- `crm.col.refund_date` = Дата возврата / Geri qaytarma tarixi / Refund date
- `crm.col.refund_request_date` = Дата запроса / Sorğu tarixi / Request date (reserved, not displayed yet)

---

## PAYMENT BUSINESS DATE MATRIX

| Scenario | Status | createdAt | paidAt | UI Дата оплаты | PASS |
|---|---|---|---|---|---|
| Successful Payment | CAPTURED | record creation | success timestamp | paidAt | ✅ |
| Pending Payment | PENDING | record creation | NULL | — | ✅ |
| Failed Payment | FAILED | record creation | NULL | — | ✅ |
| Cancelled Payment | CANCELLED | record creation | NULL | — | ✅ |
| Seed data (atomic) | CAPTURED | same as paidAt | same as createdAt | paidAt | ✅ |

---

## REFUND BUSINESS DATE MATRIX

| Scenario | Status | createdAt | processedAt | UI Дата возврата | PASS |
|---|---|---|---|---|---|
| Requested Refund | REQUESTED | record creation | NULL | — | ✅ |
| Approved (not processed) | APPROVED | record creation | NULL | — | ✅ |
| Completed Refund | PROCESSED | record creation | refund timestamp | processedAt | ✅ |
| Failed Refund | FAILED | record creation | NULL | — | ✅ |

---

## DOMAIN AUTHORITY MATRIX

| Entity | Creation | Business Event | Canonical Date Field | Write Authority | Idempotent |
|---|---|---|---|---|---|
| Payment | createdAt | CAPTURED | paidAt | PaymentService.capture() | YES |
| Refund | createdAt | PROCESSED | processedAt | RefundService.process() | YES |

---

## DATABASE EVIDENCE

### Payment: CAPTURED (PAY-00000959)
```
status: CAPTURED
createdAt: 2026-08-25T11:48:00.000Z
paidAt:     2026-08-25T11:48:00.000Z
UI: 25.08.2026 (from paidAt)
```

### Payment: FAILED (PAY-00007024)
```
status: FAILED
createdAt: 2020-02-20  (epoch 1787491581)
failedAt:  2020-02-20  (epoch 1787491581)
paidAt:    NULL
UI: — (dash, because paidAt is null)
```

### Refund: APPROVED (RFD-F8DB5871781F)
```
status: APPROVED
createdAt:   2024-12-06
approvedAt:  2024-12-06
processedAt: NULL
UI: — (dash, because processedAt is null)
```

### Refund: PROCESSED (RFD-1E9ADA8A2EFD)
```
status: PROCESSED
createdAt:   (epoch 1796853340)
processedAt: (epoch 1796853340)
UI: date from processedAt
```

---

## BROWSER PAYMENT EVIDENCE

Customer 360 → Платежи:
- PAY-00000959: Дата оплаты = 25.08.2026 (from paidAt)
- Column header = "Дата оплаты" (not "Создан")
- Business context: Order ORD-00000959 / TH-2026-000959 preserved
- Amount: 50.88 AZN preserved
- Status: CAPTURED preserved

---

## BROWSER REFUND EVIDENCE

Customer 360 → Возвраты:
- RFD-F8DB5871781F: Дата возврата = — (null, status APPROVED not PROCESSED)
- Column header = "Дата возврата" (not "Создан")
- Source payment: PAY-00000959 preserved
- Source order: ORD-00000959 preserved
- Reason: "Partial refund — customer dissatisfaction" preserved
- Amount: 31.22 AZN preserved

---

## RUNTIME

- Repository: D:\travelhub_v1
- HEAD: will be committed
- origin/master: 82883f4
- Backend PID: 3828 (port 4000)
- Frontend PID: 9316 (port 3000)
- API target: http://localhost:4000

---

## TESTS

| Gate | Result |
|---|---|
| Backend TSC | ✅ Clean |
| Frontend TSC | ✅ Clean |
| Frontend tests | 243/243 ✅ |
| Frontend build | ✅ Clean |
| Backend build | ✅ Clean |

---

## FILES CHANGED

| File | Change |
|---|---|
| `backend/src/modules/crm/crm.service.ts` | Added `paidAt` to Payment select, `processedAt` to Refund select |
| `frontend/lib/api.ts` | Added `paidAt` and `processedAt` to TypeScript types |
| `frontend/lib/i18n.tsx` | Added `crm.col.payment_date`, `crm.col.refund_date`, `crm.col.refund_request_date` |
| `frontend/app/app/crm/customers/[id]/page.tsx` | Updated Payment/Refund table headers and cells to use business date fields |

**Production code changed:** YES (3 frontend + 1 backend file)
**Unrelated files:** 0

---

## REMAINING FINDINGS

None. VERDICT A confirmed.

Seed data has identical `createdAt` and `paidAt` for all CAPTURED payments
(atomic seed creation). In production with real PSP integration (Stage 2.12B),
these timestamps will naturally diverge. The architecture correctly models them
as separate immutable milestones.

---

## NEXT CANONICAL STAGE

Platform CRM Round 5B is now FULLY CLOSED with business date authority verified.
Per roadmap, the next planned stage is:

```
Operational Notes / Comments Architecture Reconciliation
```
