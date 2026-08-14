# Payment Flow (Step 2.12)

**Step:** Phase 2 — 2.12 — Payment Flow
**Status:** IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW (2026-08-14)
**Predecessor:** Step 2.11 (APPROVED WITH REVIEW FIXES)
**NEXT:** Phase 2 — Step 2.12 — STRICT REVIEW

---

## 1. Purpose

Активировать Finance-owned Payment runtime: canonical Payment aggregate
(PAY-*), создание и lifecycle с **provider-neutral** механикой. Payment
погашает УЖЕ замороженное финансовое обязательство (frozen Order snapshot);
Payment НЕ является pricing authority. PSP/adapters/webhooks — 2.12A/2.12B.

## 2. Ownership — HARD GATE

Payment — Finance-owned (`finance.*`). Создание/переходы — только
`PaymentService` (finance.payment.write). Order/Booking/Sales НЕ пишут
finance.Payment. Order projection (`paymentStatus`/`paidAmount`) — Order-owned
поля: Finance НЕ пишет order.* — Order subscriber проецирует факт из события
`PaymentCaptured`. PSP-адаптеров нет (2.12A/2.12B) — прямых cross-domain
writes не требуется.

## 3. Payable obligation source — HARD GATE

Canonical источник payable money — **frozen Order snapshot**:
`Order.amount` (immutable, из OrderRequested ← Checkout ← Quote ISSUE) +
`Order.currency`. Доказательства: Order.amount/currency — server-copied
verbatim (2.5, Step 2.11 ревью); жизненный цикл Order не мутирует деньги;
reprice после freeze запрещён (2.11 T2/T2b). Payment.amount/currency
копируются verbatim из Order при создании; клиент не передаёт деньги
(forged → 422). Обязательство становится payable: Payment создаётся
Finance-командой (2.12 — manual/provider-neutral; due-date семантика схем
оплаты — 2.12F).

## 4. Cardinality — CRITICAL

**Один Payment на Order** в 2.12 (полное frozen обязательство). DB-level
инвариант: partial unique index `Payment_one_active_per_order` по managed
boolean `isActivePayment` (паттерн ModerationSubmission.isActiveSubmission):
≤1 строка с `isActivePayment=true` на orderId. `isActivePayment=true` для
PENDING/AUTHORIZED/CAPTURED/REFUNDED (overpayment protection: после успеха
повторная оплата невозможна); false для FAILED/CANCELLED (повторная
инициация — attempt 2 — легальна). Индекс поддерживается атомарно с
CAS-переходом статуса (единственный writer — PaymentService). **2.12F**
(partial/installments) переработает индекс в своей аддитивной миграции —
будущие approved semantics не блокируются (Prompt §6). Не @unique-констрейнт
на orderId — мульти-Payment expressible в схеме.

## 5. Model (reconciliation)

Существующая foundation-модель `Payment` (2.10) переиспользована, НЕ создан
второй таблицы. Поля:
- identity/code: `PAY-*` (IdsService, атомарный счётчик, DB unique);
- source ref: `orderId` (ref без FK), `customerId?`, `partnerId?` (NULL —
  platform/manual);
- amount/currency: DECIMAL(12,2), frozen verbatim из Order;
- status: PaymentStatus enum (2.10 vocabulary);
- paymentMethod?: descriptive label (manual, ≤64, без PII; НЕ authority);
- providerRef?: opaque (2.12 не используется; 2.12B);
- idempotency/cardinality: `isActivePayment` + partial unique;
- temporal: createdAt/updatedAt (entity) + 2.12-милстоуны paidAt/failedAt/
  cancelledAt;
- version/CAS: version (concurrency).
`PaymentHistory` — новый (audit by default, как Quote/Sale/Booking history).

## 6. Statuses (vocabulary)

| Status | Meaning | Terminal | Producer (2.12) | Milestone |
|---|---|---|---|---|
| PENDING | инициирован, ожидает подтверждения получения | нет | createPayment | — |
| CAPTURED | деньги получены (подтверждено Finance) | да | confirmPayment | paidAt |
| FAILED | получение не состоялось | да | failPayment | failedAt |
| CANCELLED | отменён (до успеха) | да | cancelPayment | cancelledAt |
| AUTHORIZED | резерв (PSP authorize) | нет | **2.12B** (reserved vocabulary) | authorizedAt (2.12B) |
| REFUNDED | возврат | да | **2.13** (reserved vocabulary) | refundedAt (2.13) |

AUTHORIZED/REFUNDED — reserved без producer-а в 2.12 (прецедент:
READY_TO_CLOSE/AWAITING_CONFIRMATION). Конфликтующих источников нет:
vocabulary выведен из milestone-имён 2.10C + OrderPaymentStatus прецедента.

## 7. Transition matrix

| Action | From | To | Guard | Permission | Event | Milestone |
|---|---|---|---|---|---|---|
| create | — | PENDING | Order exists, не CANCELLED/CLOSED; ≤1 активный Payment | finance.payment.write | PaymentCreated | — |
| confirm | PENDING | CAPTURED | CAS id+status+version | finance.payment.write | PaymentCaptured | paidAt |
| fail | PENDING | FAILED | CAS id+status+version | finance.payment.write | PaymentFailed | failedAt |
| cancel | PENDING | CANCELLED | CAS id+status+version | finance.payment.write | PaymentCancelled | cancelledAt |

Единственный authority — `PaymentService.transition` (CAS `updateMany`,
from-guard PENDING, ровно один победитель; повторный переход → 409).
Скрытых переходов нет. `capture`-действие (PSP) — 2.12B.

## 8. Frozen money

`Payment.amount = Order.amount`, `Payment.currency = Order.currency` — verbatim,
валидируются `validateFrozenMoneyFact` (sales.money authority). Запрещены:
текущий Product/Tariff price lookup, TaxRule пересчёт, FX-конверсия,
альтернативные rounding-helper-ы, JS float. Amount/currency immutable после
создания. Proof: e2e T2 (Product price change после freeze → Payment держит
frozen).

## 9. Creation

`POST /api/v1/finance/payments { orderId, paymentMethod? }` →
PaymentService.createPayment (Finance, finance.payment.write):
1. Order READ (unknown → 404; CANCELLED/CLOSED → 422);
2. validateFrozenMoneyFact(order.amount, order.currency);
3. idempotent retry: существующий активный Payment → no-op (тот же факт);
4. tx: PAY-* код, create PENDING (+isActivePayment=true, version 1),
   PaymentHistory "created", AuditLog, emit PaymentCreated (outbox);
5. P2002 (Payment_one_active_per_order) → controlled 409 (concurrent
   duplicate, один факт);
6. publishPending после коммита.
Без Product/Tax/FX re-read; без ProviderFee/Commission/Settlement/Payout
fabrication; без прямых Order/Booking writes.

## 10. PSP boundary

Step 2.12 — **provider-neutral**: PSP/adapters/webhooks — 2.12A/2.12B
(Roadmap). «Подтверждение получения» — manual/provider-neutral команда
Finance (confirm). 0 активных webhook-путей в prod-коде (repo-wide: нет
Stripe/payment_intent/webhook маршрутов); webhook signature/replay — 2.12B.

## 11. Provider identity

В 2.12 provider refs отсутствуют (providerRef — nullable, не используется;
2.12B заполнит). Провайдер-транзакций/попыток нет — попытка в 2.12 = новый
Payment после FAILED/CANCELLED (attempt 2), детерминировано index-ом.

## 12. Idempotency — CRITICAL

- create: identical retry (активный Payment существует) → существующий факт
  (no-op); concurrent duplicate → P2002 partial unique → controlled 409;
  unknown P2002 → rethrow/controlled conflict (не глотается);
- transitions: повторный переход из того же статуса → 409 (terminal
  protection, конвенция completeSale); CAS-проигрыш → 409.
- Raw 500 = 0 (e2e T7/T8; unit P2002-пути).

## 13. Concurrency

Concurrent create (два запроса, один Order) → partial unique: один 201, один
409, ровно один Payment (e2e T7). Concurrent confirm+fail → CAS: один
победитель, проигравший 409, один history/event (unit). Duplicate provider
event — N/A (нет webhook). Mixed old/new price — 0 (money frozen).

## 14. Temporal contract

Милстоуны 2.12 (2.10C DEFER → 2.12): `paidAt` (успех), `failedAt`, `cancelledAt`.
- authority: server (`now()`), UTC instant;
- первый переход wins (immutable; повторный переход невозможен lifecycle-ом);
- атомарны с CAS (status+version+milestone+history+outbox);
- replay: повторная доставка/retry не перезаписывает (CAS + terminal 409).
`authorizedAt`/`capturedAt` — DEFER (2.12B PSP). Backfill — нет.

## 15. Order projection — CRITICAL

`Order.paymentStatus`/`paidAmount` — Order-owned (2.10 foundation: «remain
owned by their domains»). Finance НЕ пишет order.*. Поток: Payment CAPTURED →
`PaymentCaptured` (payload: refs + frozen amount/currency, self-sufficient) →
Order-owned subscriber `order-payment-consumer` (inbox dedup + CAS по version):
`paymentStatus = PAID`, `paidAmount = amount`, history `payment_captured`.
No-op при уже PAID (идентичный replay). FAILED/CANCELLED не проецируются
(остаётся UNPAID). PARTIALLY_PAID — 2.12F; REFUNDED — 2.13. Финансовый факт
фиксируется независимо от lifecycle Order (деньги получены; refund — 2.13).

## 16. Booking boundary

Payment не трогает Booking: НЕ подтверждает/отменяет, НЕ мутирует money/
temporal факты, НЕ трогает availability (e2e T11: booking count без
изменений; lifecycle Booking — 2.9A, без Payment-связей).

## 17. Ledger boundary — HARD GATE

Авто-постинг LedgerTransaction НЕ реализован (2.12D определяет posting
шаг). E2E T11: ledger count без изменений при create+confirm. Никакого
double-entry/balance. `occurredAt` семантика (2.10C) сохраняется для
будущего posting-шага.

## 18. ProviderFee boundary

0 автоматических ProviderFee (нет canonical source fact). ProviderFee ≠
Commission (2.10B). E2E T11: providerFee count без изменений.

## 19. Refund boundary

Refund runtime НЕ реализован (2.13). Payment failure/cancellation ≠ Refund
(терминальное отклонение до успеха). Нет refundedAt/provider-refund/refund
ledger posting. REFUNDED — reserved vocabulary.

## 20. Commission boundary

0 Commission/CommissionAccrual (2.12C/E). Нет netting/settlement-вычетов.
E2E T11: commission/accrual counts без изменений.

## 21. RBAC

`finance.payment.write` — FINANCE, ADMIN (ALL_PERMISSIONS); `finance.payment.
read` — FINANCE/ADMIN/DIRECTOR/ANALYST/SALES_MANAGER (существующий каталог
прав 2.10; STRICT REVIEW 2.12 FIX: OPERATOR НЕ имеет finance.payment.* —
проверено `ROLE_PERMISSIONS`, RBAC Matrix Baseline 1.3 §2). BUYER/PARTNER —
403 (Buyer surface — 2.12B). Разделение read/initiate/manage: write-команды
только write-право; read-эндпоинты — read-право. E2E T9: 401/403/404.

## 22. Mass assignment — HARD GATE

`PAYMENT_CREATE_FORBIDDEN_KEYS` (raw-body): id/code/status/amount/currency/
customerId/partnerId/providerRef/version/createdAt/updatedAt/paidAt/failedAt/
cancelledAt/isActivePayment → loud 422 (конвенция project, не silent strip).
E2E T4: forged amount/currency/status/paidAt/version/isActivePayment/providerRef
→ 422, 0 строк. Переходы — без body (только path code).

## 23. PII / PCI / secrets — CRITICAL

0 PAN/CVV/card data/PSP secrets/webhook signing secrets/Auth headers/PII в
Payment (schema: только refs + money + descriptive paymentMethod). DTO —
whitelist без PII (e2e T12). Card data — 2.12B (STOP-condition: при вводе
реальных card данных — стоп).

## 24. Events / outbox / inbox

PaymentCreated/PaymentCaptured/PaymentFailed/PaymentCancelled — canonical
registry (domain-events.ts), outbox (PENDING → publishPending), payload —
refs + frozen amount/currency, PII-free. HTTP-команды: correlation = server
UUID, causation = null (ADR-0009/0010). Order consumer: inbox dedup +
CAS. События без потребителей (Failed/Cancelled) — лента/аналитика (как
BookingCancelled прецедент).

## 25. History / audit

PaymentHistory (domain history: created/captured/failed/cancelled, from/to,
actor, comment — без provider payload/PII) + Security AuditLog
(finance.payment.*, minimal details). Разделены от outbox-событий.

## 26. Legacy / migration

Миграция `20260814120000_add_payment_runtime` — аддитивная: 3 nullable
milestone-колонки + `isActivePayment` (NOT NULL DEFAULT true) + partial
unique + PaymentHistory. Legacy Payment rows (foundation, если есть) —
readable: status/amount/currency как были, milestones NULL, isActivePayment
true (default) — без fabricated фактов. Fresh replay безопасен.

## 27. Deferred items

2.12A Provider Abstraction; 2.12B Buyer card/wallet + webhook (authorize/
capture, authorizedAt/capturedAt, signature, provider event idempotency);
2.12C SPLIT/Commission; 2.12D PLATFORM_COLLECT + Ledger posting;
2.12E PARTNER_COLLECT/CommissionAccrual; 2.12F Partial payments/installments
(переработка Payment_one_active_per_order, PaymentTerms материализация,
PARTIALLY_PAID, allocation); 2.12G PSP fees; Refund (2.13); Invoice (2.14);
Buyer payment surface; PaymentTerms PMT-* (2.12F).
