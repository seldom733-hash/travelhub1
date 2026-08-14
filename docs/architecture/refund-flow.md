# Refund Flow (Step 2.13) — Architecture

## 1. Purpose

Provider-neutral **Refund runtime** для уже полученных платежей. Refund — новый
immutable/operational финансовый факт, производный от **CAPTURED Payment**;
он НИКОГДА не переписывает Payment.amount / frozen Order snapshot (никакого
reprice) и не становится Settlement/Payout/Commission/double-entry логикой.
Активация runtime, заявленного в Step 2.10 foundation (§15/§52); PSP-refund —
future (2.13A+; здесь нет).

## 2. Ownership

`finance.Refund` — Finance-owned. Единственный writer — `RefundService`
(create + CAS-переходы). Order/Booking/Sales НЕ пишут finance.Refund;
RefundService НЕ пишет Order/Booking напрямую (проекция — Order-owned
subscriber на RefundProcessed). Cross-domain writes отсутствуют (ADR-0001).

## 3. Source Payment

Canonical source — **CAPTURED Payment** (деньги получены). Refund против
PENDING/FAILED/CANCELLED → 422 (недостижимый/несостоявшийся факт). `currency`
копируется verbatim из Payment; `orderId` server-derived из Payment.orderId
(никакого live commercial lookup / Product/Tax/FX re-read). Payment НЕ
мутируется (остаётся CAPTURED).

## 4. Cardinality

Partial refund'ы — **в scope** (Roadmap: «Полный/частичный refund»): несколько
Refund на Payment (разные суммы — независимые факты). Ограничение: **один
Refund на (paymentId, amount) пока НЕ-FAILED** (idempotency slot) — identical
retry → существующий факт (no-op); attempt 2 после FAILED легален; второй
идентичный частичный refund блокируется (conservative — защита от двойного
refund при network retry). Различные суммы всегда независимы.

## 5. Refundable amount

`refundable = payment.amount − Σ(refund.amount WHERE status != FAILED)`

- REQUESTED/APPROVED резервируют ёмкость (pending-запросы учитываются);
- PROCESSED учитывается (деньги возвращены);
- FAILED исключается (ёмкость освобождена);
- refund > refundable → 409 (ConflictError, capacity-семантика как
  reserveAvailability); malformed/zero/negative → 422.

## 6. Model

`finance.Refund`: id, code (RFD-*, unique), paymentId, orderId (server-derived),
amount DECIMAL(12,2), currency (verbatim), status, reason?, version, createdAt,
updatedAt, milestones requestedAt/approvedAt/processedAt/failedAt,
isActiveRefund (managed idempotency slot) + `RefundHistory`. Без customerId
(минимальный; аддитивно при Buyer-поверхности 2.13B/future).

## 7. Status vocabulary

Из schema-foundation enum + canonical Roadmap-визион (не выдуман):
- `REQUESTED` — запрос создан (create; requestedAt);
- `APPROVED` — согласован (approve; approvedAt; finance.refund.approve);
- `PROCESSED` — деньги возвращены (process; processedAt; терминальный success);
- `FAILED` — терминальное отклонение (fail из REQUESTED|APPROVED; failedAt;
  слот освобождён — attempt 2 легален).

Нет generic PENDING/SUCCESS — vocabulary из foundation-энума (2.10).

## 8. Transition matrix

| Action | From | To | Guard | Permission | Event | Milestone |
|---|---|---|---|---|---|---|
| create | — | REQUESTED | Payment CAPTURED; amount > 0 ≤ refundable (serialized) | finance.refund.write | RefundCreated | requestedAt |
| approve | REQUESTED | APPROVED | CAS id+status+version | finance.refund.approve | RefundApproved | approvedAt |
| process | APPROVED | PROCESSED | CAS id+status+version | finance.refund.write | RefundProcessed | processedAt |
| fail | REQUESTED\|APPROVED | FAILED | CAS id+status+version | finance.refund.write | RefundFailed | failedAt |

Единственный authority — `RefundService.transition` (CAS updateMany, from-guard,
ровно один победитель; повторный переход → 409). Скрытых переходов нет.
`isActiveRefund` освобождается ТОЛЬКО на FAILED.

## 9. Money

Decimal (decimal.js), DECIMAL(12,2) платформенный контракт; 0 float/Number()
authority (validateRefundAmount — строковый Decimal, > 0, ≤ 2 знаков).
Currency server-copied verbatim (forged → 422). Refund.amount immutable после
создания (нет update-эндпоинтов).

## 10. Partial refund semantics

Несколько Refund-строк (append-факты), а не одна mutable-строка: каждая сумма —
отдельный факт с собственным lifecycle. Суммарно-refunded = Σ(non-FAILED).
Ограничение идентичных сумм — idempotency slot (§4). Полный refund = сумма
возвратов == payment.amount.

## 11. Over-refund protection

Serialized `pg_advisory_xact_lock(hashtext('refund:' || paymentId))` ВНУТРИ
транзакции create + `SUM(non-FAILED)` — два concurrent частичных refund'а не
могут вместе превысить payment.amount (нет TOCTOU; паттерн atomic capacity
проекта, но БЕЗ мутации Payment). Проигравший — controlled 409; raw 500 = 0.

## 12. Creation authority

Только Finance: `POST /finance/refunds` (finance.refund.write). Клиент
передаёт paymentId + amount (server-validated) + reason. Скрытых
Buyer/public-маршрутов нет (Buyer refund-request — Customer Support flow,
future; endpoint не экспонируется).

## 13. PSP boundary

Provider-neutral foundation: 0 внешних вызовов, 0 webhook, 0 provider-секретов.
PSP-refund / chargeback — 2.13A+ (Roadmap: 2.13A Chargeback/Dispute Foundation).
Lifecycle честно отражает internal foundation-семантику (manual подтверждение
Finance, как Payment confirm).

## 14. Provider identity

providerRef отсутствует в Refund-модели/API (0 provider-identity). Добавляется
только с PSP-шагом (2.13A+) — тогда provider-scoped uniqueness + replay.

## 15. Idempotency

- Create: managed `isActiveRefund` + partial unique `Refund_one_active_per_payment_amount`
  (paymentId, amount) — identical retry → существующий факт (no-op);
  concurrent duplicate → P2002 → controlled 409; attempt 2 после FAILED
  (слот освобождён). Unknown P2002 не глотается.
- Transitions: CAS id+status+version — повторный переход → 409 (one effect).
- Future-safe: ключ (paymentId, amount) эволюционируем аддитивно (не блокирует
  multiple identical partial refund'ы, если business потребует).

## 16. Concurrency

Concurrent duplicate create (тот же amount) → один факт + 409 (partial unique);
concurrent different-amount → advisory lock + sum → никогда > amount;
approve vs fail / process vs fail — CAS (один победитель, один milestone/
history/event); terminal retry → 409. Без duplicate событий.

## 17. Temporal contract

Милстоуны (2.10C DEFER → 2.13; canonical Roadmap-визион «Refund:
requestedAt/approvedAt/processedAt/failedAt»): server-owned UTC, first-only
(повторный переход невозможен lifecycle-ом → 409), атомарны с CAS-переходом,
nullable до наступления, БЕЗ backfill. Архивное имя «refundedAt» (2.10C-арх-док
draft) НЕ используется — канон processedAt (совпадает со статусом PROCESSED).

## 18. Payment impact

Refund НЕ мутирует Payment: статус остаётся CAPTURED, amount/currency frozen.
`Payment.REFUNDED` reserved и unreachable (partial refund делает одиночный
Payment.REFUNDED семантически неверным — §9 2.13-промпта). Правда о возвратах
живёт в Refund-фактах (Σ). Полный-возврат-маркер на Payment — при необходимости
будущий аддитивный шаг.

## 19. Order projection

Order-owned subscriber (`order-refund-consumer`) на **RefundProcessed**:
`Order.refundedAmount += amount` (Decimal, defensive ≥ 0); полный возврат
(`refundedAmount >= paidAmount`) → `paymentStatus = REFUNDED`; частичный →
остаётся PAID. `paidAmount` — исторический факт «деньги получены» НЕ
переписывается. CAS по version + Inbox dedup; Finance НЕ пишет order.*.
RefundCreated/Approved/Failed НЕ проецируются.

## 20. Booking/Availability boundary

0 Booking writes/status/money/milestones; 0 Availability-эффектов
(Refund ≠ Booking cancellation). E2E T11: counts без изменений.

## 21. Ledger boundary

Refund 2.13 НЕ создаёт LedgerTransaction (ledger posting — 2.12D, defer;
компенсирующий append-only факт — при активации, никогда мутация исходной
строки). E2E T11: ledger count без изменений.

## 22. ProviderFee boundary

0 ProviderFee creation/расчётов (refund fee не выдумывается).

## 23. Commission boundary

0 Commission/CommissionAccrual reversal/netting (2.12C/E — defer).

## 24. Settlement/Payout boundary

0 Settlement/Payout mutation (payout compensation — future).

## 25. Invoice boundary

0 Invoice/credit-note (2.14 — отдельный flow).

## 26. Events / outbox / inbox

RefundCreated/Approved/Processed/Failed — outbox, атомарно с транзакцией
факта (emit внутри tx, publishPending после); одно событие на реальный
переход, НОЛЬ на no-op/stale. RefundProcessed — consumer Order
(`order-refund-consumer`, inbox dedup, CAS). RefundCreated/Approved/Failed
consumer-ов нет (canonical факты для ленты/аналитики — прецедент
OrderReadyForBooking/BookingCompleted).

## 27. RBAC

- `finance.refund.read` — FINANCE/ADMIN/DIRECTOR/ANALYST/SALES_MANAGER;
- `finance.refund.write` (create/process/fail, добавлено в 2.13) — FINANCE/ADMIN;
- `finance.refund.approve` — FINANCE/ADMIN (approval workflow шаг);
- OPERATOR/PARTNER/BUYER/MARKETER/MODERATOR — 403; аноним — 401.
E2E T9: 401/403/404; FINANCE write OK; SALES/DIRECTOR read-only.

## 28. Mass assignment

`REFUND_CREATE_FORBIDDEN_KEYS` (raw-body, loud 422): id/code/status/currency/
orderId/customerId/version/createdAt/updatedAt/requestedAt/approvedAt/
processedAt/failedAt/isActiveRefund/providerRef. Клиент передаёт ТОЛЬКО
paymentId + amount + reason.

## 29. PII/PCI

Refund DTO/события/history: refs + frozen money + reason; 0 PAN/CVV/card/
secrets/traveler PII (E2E T12 assert).

## 30. History / audit

RefundHistory — одна строка на реальный переход (create/transition внутри tx
после успешного CAS); НОЛЬ на no-op/stale (CAS-loss → rollback). Security
AuditLog — `finance.refund.created/approved/processed/failed`, минимальные
details (code/paymentId/orderId/amount/currency), правильный actor, без
дублирования на no-op.

## 31. Legacy / migration

Refund-таблица была ПУСТА (schema-only foundation, 0 writer-ов до 2.13) —
миграция аддитивная: milestones + isActiveRefund + RefundHistory (+ FK) +
Order.refundedAmount (DEFAULT 0). Без backfill, без db push; fresh replay
через harness (drop+recreate + migrate deploy) — доказан полным serial e2e.

## 32. Deferred items

2.13A — Chargeback/Dispute (provider identity/evidence/liability, ledger/
commission/settlement adjustments); 2.13B+ — Buyer refund-request surface
(own-scope, policy-ограничения); PSP refund (providerRef, webhook, attempt
identity); несколько идентичных partial refund-ов (аддитивная переработка
idempotency-ключа); reverse allocations (Roadmap: «reverse allocations вместо
переписывания истории» — нет allocation-движка, defer); ledger/commission/
settlement компенсации (2.12D/2.12C/2.14).
