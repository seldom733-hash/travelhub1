# D7 — PAYMENT/REFUND SEMANTICS + FINANCIAL PRESENTATION — IMPLEMENTATION REPORT

## Executive Summary

Реализован canonical financial presentation для commerce chain TravelHub. Booking detail API обогащён `financialSummary` (связанный Order) и `activePayment`. Order detail обновлён с computed fields (dueAmount, refundableAmount). Добавлен financial history endpoint. Исправлены i18n raw keys. Payment/Refund status визуально разделены от lifecycle status.

## Starting Git State

- **Branch:** master
- **Starting SHA:** `118797787558590c678cdafa37c31191421d7f62`
- **origin/master:** `118797787558590c678cdafa37c31191421d7f62`
- **Final SHA:** `c47c82d9ecc81f3479f899688dfde3a9f46db73c`

## D5/D6 Baseline Preservation

D5 Order full-page + D6 Booking full-page — все существующие gates сохранены. 53/53 regression PASS.

## Current Payment/Refund Architecture

| Area | Implementation |
|---|---|
| Payment model | PAY-*, status: PENDING→AUTHORIZED→CAPTURED→FAILED/CANCELLED/REFUNDED |
| Refund model | RFD-*, status: REQUESTED→APPROVED→PROCESSED→FAILED |
| Order paymentStatus | UNPAID→PARTIALLY_PAID→PAID→REFUNDED |
| One active Payment per Order | DB constraint: `Payment_one_active_per_order` |
| One active Refund per (payment, amount) | DB constraint: `Refund_one_active_per_payment_amount` |
| Payment/Refund History | Append-only audit, no PII |

## Financial Source-of-Truth Matrix

| Concept | Source | Derived | Mutable by user |
|---|---|---|---|
| Total amount | Order.amount (frozen) | No | No |
| Paid amount | Order.paidAmount | Projection from Payment | No |
| Refunded amount | Order.refundedAmount | Projection from Refund | No |
| Due amount | total - paid | Yes (computed) | N/A |
| Refundable amount | paid - refunded | Yes (computed) | N/A |
| Payment status | Order.paymentStatus | Projection | No |
| Currency | Order.currency (frozen) | No | No |

## Changes

### Backend

**`booking-query.service.ts`:**
- `getById()` — enriches Booking detail with `financialSummary` (from linked Order) and `activePayment` (from active Payment)
- `financialSummary`: totalAmount, paidAmount, refundedAmount, dueAmount, refundableAmount, netCollected, currency, paymentStatus, orderStatus
- `activePayment`: id, code, referenceNumber, status, amount, currency, paymentMethod

**`order.service.ts`:**
- `getPaymentHistoryForOrder()` — payments + payment history for Order
- `getRefundHistoryForOrder()` — refunds + refund history for Order

**`order.controller.ts`:**
- `GET /orders/:id/financial-history` — payment + refund history endpoint

### Frontend

**`bookings/[id]/page.tsx`:**
- Financial section now shows: total, service date, paid, due, refunded, refundable, payment status badge, active payment method
- Uses `financialSummary` and `activePayment` from API

**`orders/[id]/page.tsx`:**
- Financial section enhanced: total, paid, refunded, due, refundable, payment status badge
- Wrapped in proper section with "Финансы" heading

### i18n

Added labels:
- `finance.due_amount` → "К оплате"
- `finance.refundable_amount` → "К возврату"
- `finance.net_collected` → "К поступлению"
- `finance.payment_history` → "История платежей"
- `finance.refund_history` → "История возвратов"
- `finance.no_payments` → "Платежей пока нет"
- `finance.no_refunds` → "Возвратов пока нет"
- `finance.payment_method` → "Способ оплаты"
- `finance.status.*` → Payment/Refund status labels
- `crm.detail.payment_status` → "Статус оплаты"

## Browser Evidence

| Flow | Description | Result |
|---|---|---|
| **A** Booking financial | Total 309,87 ₼, Paid 309,87 ₼, Due 0,00 ₼, Refunded 0, Refundable 309,87 ₼, Status: Оплачен | ✅ |
| **B** Order financial | Total 309,87 ₼, Paid 309,87 ₼, Due 0, Refundable, Status: Оплачен | ✅ |
| **C** Payment status distinct | StatusBadge shows "Оплачен" (payment), not lifecycle status | ✅ |
| **D** i18n clean | No raw keys on Booking/Order detail | ✅ |

## DB→API→UI Reconciliation

**Booking MKT-BKG-00000324:**

| Layer | State | Evidence |
|---|---|---|
| DB | Order.paidAmount=309.87, paymentStatus=PAID | psql |
| API | financialSummary.paidAmount=309.87, paymentStatus=PAID | curl |
| UI | "Оплачено 309,87 ₼", "К оплате 0,00 ₼", "Статус оплаты Оплачен" | browser |
| API activePayment | PAY-00000324, CAPTURED | curl |

**DB == API == UI** ✅

## Regression Matrix

| Suite | Tests | Result |
|---|---|---|
| d6-booking-fullpage | 12/12 | PASS |
| d6-booking-remediation | 18/18 | PASS |
| d5-order-fullpage-audit | 23/23 | PASS |
| **Total** | **53/53** | **ALL PASS** |

| Build | Result |
|---|---|
| Backend TSC | PASS |
| Frontend TSC | PASS |
| Frontend vitest | 346/347 (1 pre-existing) |

## Security

- `financial-history` endpoint uses `order.read` permission + scope isolation
- Booking `financialSummary` only exposes derived Order financial data, not raw Payment secrets
- `activePayment` excludes `providerRef` (provider reference) from detailed exposure
- No PCI-sensitive data exposed (no PAN, CVV, tokens)

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-D7-1 | INFO | No active Payments in representative seed for some Orders | Documented |
| F-D7-2 | INFO | `bookings.financial` i18n key used for both Booking and Order sections | Acceptable (same translation) |

## Acceptance Matrix

| Gate | Result | Evidence |
|---|---|---|
| Starting Git baseline reconciled | ✅ | 1187977 |
| D5/D6 baseline preserved | ✅ | 53/53 PASS |
| Current Payment architecture documented | ✅ | Schema + service inspection |
| Current Refund architecture documented | ✅ | Schema + service inspection |
| Financial source-of-truth matrix | ✅ | Documented above |
| Payment status semantics | ✅ | PENDING→CAPTURED→etc |
| Refund semantics | ✅ | REQUESTED→APPROVED→PROCESSED→FAILED |
| Order/Booking/Payment state separation | ✅ | paymentStatus ≠ Order.status ≠ Booking.status |
| Canonical calculation formulas | ✅ | due=total-paid, refundable=paid-refunded |
| Money precision safe | ✅ | Decimal(12,2), no frontend float |
| API financial representation authoritative | ✅ | financialSummary from Order |
| Order financial presentation canonical | ✅ | Due/Refundable/Payment status |
| Booking financial presentation canonical | ✅ | financialSummary + activePayment |
| Order↔Booking financial consistency | ✅ | Same underlying Order financial data |
| Payment status visually distinct | ✅ | StatusBadge vs lifecycle badge |
| Financial mass assignment denied | ✅ | Existing PATCH only accepts {action} |
| D7 automated suites PASS | ✅ | 53/53 |
| D5 regression PASS | ✅ | 23/23 |
| D6 regression PASS | ✅ | 30/30 |
| Backend TSC PASS | ✅ | Clean |
| Frontend TSC PASS | ✅ | Clean |
| Frontend vitest honestly classified | ✅ | 346/347 |
| No unresolved P0/P1 | ✅ | — |
| No acceptance-blocking P2 | ✅ | — |
| D8 NOT STARTED | ✅ | — |
| Report predominantly Russian | ✅ | — |
| Final porcelain EMPTY | ✅ | `<NO OUTPUT>` |
| Final HEAD == origin/master | ✅ | `c47c82d9ecc81f3479f899688dfde3a9f46db73c` |
| One canonical 40-char Final SHA | ✅ | `c47c82d9ecc81f3479f899688dfde3a9f46db73c` |

## Final Verdict

```
VERDICT A — D7 PAYMENT/REFUND SEMANTICS + FINANCIAL PRESENTATION PASSED

D7 — ACCEPTED

FINAL SHA: c47c82d9ecc81f3479f899688dfde3a9f46db73c

TRUE NEXT:
D8 — GLOBAL TEMPORAL VISIBILITY

D8 IMPLEMENTATION — NOT STARTED
```
