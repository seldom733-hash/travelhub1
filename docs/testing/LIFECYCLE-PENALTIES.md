# Lifecycle + penalty schedules — test task

Задача: прогон полного жизненного цикла заявки/заказа/брони с проверкой
графиков штрафов клиентов и поставщиков.

## 1. Happy path

```text
request NEW
→ confirm price
→ customer accept
→ convert to order
→ process
→ confirm
→ wait first payment
→ synthetic CASH payment
→ send
→ booking confirm
→ service
→ booking complete
→ order close
```

Проверить:

```text
status = CLOSED / COMPLETED
clientDebt = 0
supplierDebt = 0
pendingRefund = 0
penaltyAmount = 0
approval ≠ PENDING
```

## 2. Cancellation branches

### A. Client fault, no payment

```text
penalty base: 0
refund: 0
client penalty: 0
```

### B. Client fault after partial payment

```text
captured > 0
client penalty per schedule
refund = captured - client penalty (not below 0)
supplier refund/penalty per supplier terms
```

Close is allowed only after:

```text
approval approved
clientDebt = 0
supplierDebt = 0
clientRefundDue = 0
pendingRefund = 0
penalty shares reconcile
```

### C. Supplier fault

```text
client penalty = 0
client refund = captured
supplier penalty/refund share per supplier terms
```

### D. Platform fault / force majeure

```text
client penalty = 0
platform/supplier shares must sum to penalty
penaltyReason required when penalty > 0
```

### E. Penalty waiver

```text
recognized client/supplier penalty
→ cancel penalty
→ statuses WAIVED
→ reversal adjustments created
→ close guard re-evaluated
```

## 3. API checks

```text
POST /orders/:id/cancellation/submit
GET  /orders/:id/cancellation/approval
POST /orders/:id/cancellation/approve
PATCH /orders/:id { action: "close" }
POST /orders/:id/financial-settlement/...
POST /orders/:id/financial-settlement/cancel-penalty
```

Expected guard errors must be explicit:

```text
approval=PENDING
debt
refund
penalty mismatch
```

## 4. Baseline evidence

| Check | Result |
|---|---|
| `order-financial-settlement.calculator.spec.ts` | PASS — 27 tests total across three specs |
| `order-financial-settlement.supplier-terms.spec.ts` | PASS |
| `cancellation-close-guard.e2e.spec.ts` | 1 failure: self-approval test expected 403/409, received 422 on current data |

The 422 is a test-fixture/state issue: the e2e test assumes an existing cancelled
deal has a pending approval. The close guard itself is covered by the first case.
A proper lifecycle run should create its own cancellation instead of reusing an
arbitrary deal.

## 5. Safe execution

- Use `backend/test/scenarios/scenario-runner.js` with test fixtures.
- Synthetic payment only (`CASH`, reason marked).
- No external supplier calls, no real money.
- Do not delete fixtures destructively; record IDs in the report.
- Full run: `npm run scenarios:regression` (or `discovery`).

## 6. Acceptance

- all branches reach terminal status or explicit blocked state;
- penalty amounts/shares reconcile;
- close guard blocks pending approval/refund/debt/penalty mismatch;
- waivers reverse recognized penalties;
- report includes command, counts, failures, fixture IDs, limitations.
