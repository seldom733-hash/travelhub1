# Chargeback / Dispute Foundation (Step 2.13A)

## 1. Purpose
Provider-neutral foundation для споров/chargeback: фиксирует канонический
финансовый факт спора против УЖЕ CAPTURED Payment. НЕ притворяется реальным
PSP chargeback engine, НЕ делает accounting/settlement recovery. Roadmap
2.13A: «Dispute/chargeback, evidence, liability, ledger/commission/settlement
adjustments» — с ограничением reconciliation: foundation (dispute/evidence/
liability факты) допустим сейчас; real-PSP chargeback → 2.12A/2.12B;
adjustments → 2.12D/2.12C/2.14A.

## 2. Canonical terminology
Одна сущность **Dispute** (DSP-*). Roadmap не различает Dispute и Chargeback
как две модели (одна тема шага «Chargeback / Dispute Foundation») — создание
двух сущностей запрещено (§5 промпта). «chargeback» — vocabulary-категория
причины спора (reason), НЕ отдельная модель и НЕ отдельный статус.

## 3. Ownership
Finance-owned (`finance.*`). Единственный writer — `DisputeService`
(create/transition). Finance НЕ пишет order.*/booking.*/sales.*/catalog.*/
availability.*; Payment aggregate не мутируется (никакого
`Payment.status = DISPUTED`). Связи на внешние домены — durable IDs/snapshots
(paymentId/orderId), не cross-domain writes.

## 4. Source authority
**CAPTURED Payment** (как Refund 2.13). PENDING/FAILED/CANCELLED/AUTHORIZED
→ 422 (e2e T2, unit). currency/orderId — server-derived verbatim из Payment
(0 reprice, 0 Product/Tax/FX re-read). Client передаёт ТОЛЬКО paymentId +
amount + reason.

## 5. Provider-neutral boundary
0 PSP-адаптеров, 0 webhook endpoints, 0 signature validation, 0 PSP API calls,
0 provider polling, 0 provider credentials, 0 provider-specific state machine,
0 automatic PSP refund/chargeback execution. Provider dispute IDs НЕ
существуют (2.12A/2.12B deferred) — не выдумываются. `providerRef` — forbidden
key на create (mass assignment).

## 6. Schema
`finance.Dispute`:
- id/code (DSP-*), paymentId (без FK), orderId (server-derived, без FK);
- amount DECIMAL(12,2), currency (verbatim из Payment);
- status DisputeStatus {OPENED, RESOLVED, CANCELLED};
- reason (descriptive, без PII/evidence-body);
- version (CAS), createdAt/updatedAt;
- milestones openedAt/resolvedAt/cancelledAt (server-owned UTC, first-only);
- isActiveDispute (idempotency slot);
- history DisputeHistory[] (audit by default, как PaymentHistory/RefundHistory).

0 speculative: PSP payload JSON, bank account, card data, evidence blobs,
provider secrets, ledger account IDs, commission fields, settlement fields.

## 7. Money snapshot
amount — server-validated `0 < amount ≤ payment.amount` (frozen captured fact;
e2e T5: 101 на 100 → 409). Decimal строки, DECIMAL(12,2), 0 float. Currency
verbatim из Payment (forged → 422).

## 8. Cardinality
Один активный Dispute на Payment (`isActiveDispute` + partial unique
`Dispute_one_active_per_payment` на paymentId). НЕ (paymentId, amount) — спор
один на платёж, не на сумму-срез (в отличие от Refund partial-срезов).
RESOLVED/CANCELLED освобождают слот — повторное открытие (attempt 2) легально
(e2e T4/T12). Future partial dispute slices — аддитивная переработка ключа
(2.13A+/2.14+), документировано, НЕ блокируется.

## 9. Idempotency
- Identical retry (активный Dispute на payment, ТОТ ЖЕ amount) → no-op
  существующий факт (findFirst в tx; e2e T5: dup.id === d1.id).
- **Divergent replay (другой amount при активном Dispute) → controlled 409**
  (STRICT REVIEW FIX 2.13A §9 Case B / §51 #1 — класс «silent divergent
  idempotency success», прецедент Ledger 2.10A FIX 1; e2e T5 + unit):
  материально другой business payload НЕ возвращается молча как успех с
  чужой суммой.
- Concurrent duplicate → P2002 → controlled 409, один факт (e2e T6).
- reason — descriptive metadata (как Refund.reason), НЕ часть business
  identity (не сравнивается).

## 10. State machine
Единственный authority `DisputeService.transition` (CAS id+status+version,
from-guard OPENED): OPENED → RESOLVED | CANCELLED. Терминальные не
перезаписываются (resolve→resolve 409; cancel из RESOLVED 409; e2e T3).
won/lost liability-исход — deferred (2.12A/2.12D — не выдумывается).
Controllers НЕ пишут status напрямую.

## 11. Temporal contract
openedAt = creation (как Refund.requestedAt); resolvedAt = resolve;
cancelledAt = cancel. Server-owned UTC, first-only (CAS гарантирует один
победитель), атомарны с переходом (milestone в том же updateMany, что и
status/version). 0 backfill. updatedAt НЕ бизнес-дата.

## 12. Concurrency
- Concurrent duplicate create → один факт + controlled 409 (e2e T6).
- CAS-transition → один победитель, проигравший 409 без duplicate
  history/milestone/event (unit CAS-loss).
- 0 raw 500.

## 13. RBAC
- `finance.dispute.read` — FINANCE/DIRECTOR/ANALYST/SALES_MANAGER/ADMIN
  (добавлено в 2.13A; проверено фактическим ROLE_PERMISSIONS).
- `finance.dispute.write` (create/resolve/cancel) — FINANCE/ADMIN.
- OPERATOR/PARTNER/BUYER/MARKETER/MODERATOR — 403; аноним — 401 (e2e T7).
- Отдельного resolve-права нет (минимальный lifecycle без approval workflow).

## 14. API
- `POST /api/v1/finance/disputes` — `{ paymentId, amount (Decimal string,
  > 0, ≤ 2 знаков), reason? }` → 201 `{ id, code (DSP-*), paymentId, orderId,
  amount, currency, status: OPENED, reason|null, openedAt (set),
  resolvedAt|null, cancelledAt|null, version, createdAt }`. Unknown Payment →
  404; НЕ-CAPTURED → 422; amount > captured → 409. Idempotent (активный спор
  → no-op); concurrent duplicate → 409.
- `POST /api/v1/finance/disputes/:code/resolve` — OPENED → RESOLVED
  (resolvedAt), `finance.dispute.write`. Повторный → 409.
- `POST /api/v1/finance/disputes/:code/cancel` — OPENED → CANCELLED
  (cancelledAt); attempt 2 легален.
- `GET /api/v1/finance/disputes` — list (read); фильтры paymentId/orderId/
  status; пагинация page/pageSize (≤100).
- `GET /api/v1/finance/disputes/:code` — detail; неизвестный → 404.
- PATCH/DELETE НЕ существуют (immutable source fields + action-only lifecycle).

## 15. Events
DisputeOpened (create), DisputeResolved (resolve), DisputeCancelled (cancel) —
outbox, PII-free, correlation=server UUID, causation=null для HTTP-команд.
Ровно одно на реальный переход; 0 на no-op. Consumer-ов НЕТ (0 cross-domain
projections — Roadmap 2.13A их не требует). События НЕ обещают PSP completion
/ ledger posting / commission reversal.

## 16. Audit/history
DisputeHistory — одна строка на реальный переход (opened/resolved/cancelled),
без PII/provider-payload/evidence-body. AuditLog: finance.dispute.opened/
resolved/cancelled, минимальные детали, корректный actor (USER из JWT),
0 дублей на no-op.

## 17. Payment interaction
Payment НЕ мутируется: остаётся CAPTURED (никакого DISPUTED-статуса — §12
промпта), paidAt/captured amount/immutable money facts не меняются (e2e T1/T9).
Dispute — отдельный Finance-owned aggregate; Payment — исторический captured
fact.

## 18. Refund interaction
Roadmap 2.13A НЕ определяет monetary netting (disputable vs already-refunded).
**Explicit restriction:** dispute amount ограничен captured amount
(payment.amount), БЕЗ вычета processed refunds (e2e T10: partial refund 40 +
dispute 100 на payment 100 → 201, а не 60). Monetary netting и двойной
financial claim — DEFERRED до adjustments-шагов (2.12D/2.14A), документировано
в Roadmap prerequisites. Refund-факты не тронуты (e2e T10: refund остаётся
PROCESSED).

## 19. Ledger boundary
0 LedgerTransaction (2.12D не выполнен; e2e T9: ledger count неизменен).
Никаких balances/double-entry/accounting reversal/ledger impact.

## 20. Commission boundary
0 Commission/CommissionAccrual runtime (2.12C/2.12E не выполнены; e2e T9).
Никаких commission reversal/platform fee recomputation.

## 21. Settlement/Payout boundary
0 Settlement/Payout/ProviderFee mutation (e2e T9). Никаких автоматических
settlement/payout adjustments (2.14A deferred).

## 22. Cross-domain boundary
0 Order-проекций (Roadmap 2.13A не требует отображение dispute в Order; §26
промпта: если не требуется — 0 Order changes). 0 Booking/Availability
эффектов (e2e T9: bookings/availabilityReservation неизменны). 0 invoice.

## 23. Migration
`20260814170000_add_chargeback_dispute_foundation` — аддитивная: enum
DisputeStatus + finance.Dispute + DisputeHistory + partial unique
`Dispute_one_active_per_payment` + milestones. Без backfill (новая таблица,
0 legacy-строк). migrate status 54/54, drift 0, fresh replay через harness.

## 24. Legacy compatibility
0 существующей модели/кода/событий/prefix до 2.13A (repo-wide поиск пуст).
Новые таблицы не затрагивают approved Finance/Payment/Refund таблицы.

## 25. Deferred PSP semantics
Real-PSP chargeback (provider dispute IDs, webhook callbacks, signature
validation, automatic PSP refund execution) — 2.12A/2.12B (не выдумывается).
Provider dispute identity отсутствует — foundation честно provider-neutral.

## 26. Future evolution
- Partial dispute slices — аддитивная переработка idempotency-ключа
  (paymentId → paymentId+slice), документировано.
- won/lost liability-исход — новый статус/поле при 2.12D/2.14A adjustments.
- Order-проекция dispute state — только если Roadmap future шаг явно
  потребует (Order-owned subscriber, inbox+CAS).
- Ledger/commission/settlement adjustments — 2.12D/2.12C/2.14A.

## 27. Invariants
1. Dispute создаётся только Finance, только против CAPTURED Payment.
2. ≤1 активный Dispute на Payment; терминальные освобождают слот.
3. amount: 0 < amount ≤ payment.amount (frozen captured; без netting с Refund).
4. currency/orderId — verbatim из Payment; 0 reprice.
5. Payment/Refund/Booking/availability immutable относительно Dispute.
6. Единственный state-machine authority: DisputeService.transition (CAS).
7. Milestones first-only server-owned, атомарны с переходом.
8. 0 Ledger/Commission/Settlement/Payout/Invoice side-effects.
9. 0 PSP/webhook/provider identity.
10. 0 Order/Booking проекций (Roadmap 2.13A их не требует).
11. События PII-free, одно на реальный переход, 0 на no-op.
12. Mass assignment: forged server-owned поля → 422.
