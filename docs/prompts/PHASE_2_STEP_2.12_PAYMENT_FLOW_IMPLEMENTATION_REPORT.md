# PHASE 2 — STEP 2.12 — PAYMENT FLOW — IMPLEMENTATION REPORT

## 1. Verdict

**`PHASE 2 STEP 2.12 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`**

Provider-neutral Payment runtime активирован на существующей foundation-модели
(Payment, 2.10) с единым state-machine authority, frozen-money источником из
Order snapshot, Order-owned projection и всеми boundaries (Ledger/ProviderFee/
Settlement/Payout/Refund/Invoice/Commission — 0 auto-post).

## 2. Repository baseline

- Branch: `master`, HEAD `e6f0cc5` (2.10C commit; Step 2.11 review-fix + Roadmap
  обновлены в рабочем дереве до начала 2.12).
- Проверенный baseline: unit 508/508; serial e2e 1067/1067 (60 suites);
  frontend 135/135 + build; migrate 51/51, drift 0. **После 2.12:** unit
  **520/520** (+12), serial e2e **1080/1080** (61 suites, +13), frontend
  135/135 + build, migrate **52/52**, drift 0.

## 3. Sources inspected

Roadmap v3 (2.12–2.12G), Screen Design Brief Baseline 1.6 PAYMENTS, schema.prisma
(Payment/PaymentTerms/Refund/Invoice/Commission/CommissionAccrual/Order),
finance module (controller/service/validation/ledger/settlement/money),
eventbus (domain-events, outbox/inbox), ids (PAY- зарегистрирован в ids.md),
permissions.constants (finance.payment.read/write), order module (service/
subscribers/consumer, OrderPaymentStatus), booking module, sales.money,
legacy FinanceCenter (manual payment семантика «receive/fail»), finance arch
docs (foundation, temporal-contract defer-таблица), api.md/events.md, e2e
fixtures (pricing-financial-snapshot chain).

## 4. Current → Target

| Concern | Current (foundation) | Target (2.12) |
|---|---|---|
| Payment runtime | schema-only (2.10 §15: создание НЕ реализуется) | активирован: create + lifecycle (provider-neutral) |
| Status machine | vocabulary только (enum) | PENDING → CAPTURED/FAILED/CANCELLED (CAS); AUTHORIZED/REFUNDED reserved |
| Milestones | 0 (2.10C DEFER) | paidAt/failedAt/cancelledAt (2.10C DEFER → 2.12) |
| Money source | — | frozen Order snapshot (amount/currency verbatim) |
| Cardinality | — | 1 активный Payment на Order (isActivePayment partial unique) |
| Order projection | UNPAID/0 навсегда | PAID/paidAmount через Order-owned subscriber (PaymentCaptured) |
| Events | 0 | PaymentCreated/Captured/Failed/Cancelled |
| PSP | нет | нет (2.12A/2.12B); webhook-путей 0 |
| Ledger/ProviderFee/Settlement/Payout/Refund/Invoice/Commission | 0 | 0 (boundaries сохранены) |

## 5. Ownership — PASS

Payment — Finance-owned: единственный writer `PaymentService` (create +
transition, finance.payment.write). Order/Booking/Sales 0 прямых writes в
finance.Payment (repo-wide audit §39). Order projection — Order-owned
subscriber (не Finance). PSP-адаптеров нет → cross-domain writes не требуются.

## 6. Frozen obligation source — PASS

Canonical payable source = **Order snapshot** (Order.amount/currency,
immutable, Step 2.11 review). Payment копирует verbatim; 0 ре-read mutable
Catalog/Tax/FX (reprice-audit §40: в Payment-путях 0 Product/Tariff/Tax/FX
lookup). Обязательство payable — по Finance-команде инициации (due-date/
расписание — 2.12F).

## 7. Cardinality — PASS

Один активный Payment на Order: partial unique `Payment_one_active_per_order`
по managed `isActivePayment` (true: PENDING/AUTHORIZED/CAPTURED/REFUNDED —
блокируют второй; false: FAILED/CANCELLED — attempt 2 легален). DB-level
детерминизм concurrent create (P2002 → 409). Не блокирует 2.12F (индекс
переработается аддитивной миграцией — документировано в арх-доке §4/§27).

## 8. Schema/model

Payment (2.10 foundation) + аддитивно: `paidAt/failedAt/cancelledAt`
(DateTime?, milestones), `isActivePayment Boolean @default(true)` (managed
projection), `history PaymentHistory[]`, partial unique index. Новая модель
`PaymentHistory` (paymentId FK onDelete Cascade, action/from/to/actor/comment/
createdAt, index paymentId) — audit by default. 0 PSP-полей без canonical
need (paymentMethod — descriptive manual label; providerRef — opaque, 2.12B).

## 9. Migration

`20260814120000_add_payment_runtime/migration.sql` — аддитивная:
3 nullable milestone-колонки + `isActivePayment` (NOT NULL DEFAULT true) +
`CREATE UNIQUE INDEX ... WHERE "isActivePayment" = true` + PaymentHistory
(таблица, index, FK). 0 unrelated ALTER/backfill/db push. Fresh replay —
доказан harness-ом (drop+recreate + migrate deploy, весь serial e2e 61 suite
с нуля); dev-BD применена (52/52); drift 0.

## 10. IDs

`PAY-` через IdsService.nextCode (атомарный upsert BusinessSequence, в tx
create), DB @unique, БЕЗ MAX()+1/random. ids.md уже регистрирует `PAY-`
(2.10).

## 11. Money — PASS

`Payment.amount = Order.amount`, `Payment.currency = Order.currency` (Decimal
DECIMAL(12,2), validateFrozenMoneyFact — sales.money authority). Клиент не
передаёт деньги (forged → 422). 0 JS float, 0 альтернативных helper-ов
(единственный money authority — sales.money, finance.money реэкспорт).
Immutable после create. Proof: e2e T1/T2.

## 12. PaymentTerms

Не материализованы (PMT-* — 2.12F, schema comment + Roadmap 2.12F). Единый
источник payment terms — frozen Order snapshot (2.3B, Step 2.11 §5A);
Payment в 2.12 оперирует frozen Order.amount, термины (scheme/initial/
remaining) не пересчитываются и не используются для суммы (partial
allocation — 2.12F).

## 13. Status vocabulary

PaymentStatus (2.10 enum): PENDING/AUTHORIZED/CAPTURED/FAILED/CANCELLED/
REFUNDED. 2.12 producer-ы: PENDING (create), CAPTURED (confirm), FAILED
(fail), CANCELLED (cancel). AUTHORIZED (2.12B PSP authorize) / REFUNDED
(2.13 refund) — reserved vocabulary без producer-а (прецедент READY_TO_CLOSE).
Конфликтующих источников нет (Screen Design не задаёт Payment-статусы;
vocabulary — из milestone-имён 2.10C + OrderPaymentStatus).

## 14. Transition matrix

| Action | From | To | Guard | Permission | Event | Milestone |
|---|---|---|---|---|---|---|
| create | — | PENDING | Order exists/не CANCELLED/CLOSED; ≤1 активный | finance.payment.write | PaymentCreated | — |
| confirm | PENDING | CAPTURED | CAS id+status+version | finance.payment.write | PaymentCaptured | paidAt |
| fail | PENDING | FAILED | CAS | finance.payment.write | PaymentFailed | failedAt |
| cancel | PENDING | CANCELLED | CAS | finance.payment.write | PaymentCancelled | cancelledAt |

Все переходы протестированы (unit guards + e2e T5/T8/T10; forbidden:
confirm-after-fail, repeat confirm, CAS-проигрыш → 409). Скрытых переходов 0.

## 15. Creation authority

Единственный канонический путь — `PaymentService.createPayment`
(HTTP POST /finance/payments, finance.payment.write). Внутри: Order READ →
frozen money validate → idempotent check → tx (PAY-* + create + history +
audit + emit) → P2002 → 409 → publishPending. Без reprice, без fabrication,
без прямых Order/Booking writes.

## 16. PSP boundary

Provider-neutral: подтверждение получения — manual Finance-команда
(`confirm`). 0 активных webhook-путей (repo-wide: Stripe/payment_intent/
webhook — 0 в prod-коде). PSP/adapters/webhooks — 2.12A/2.12B. §35: 0
webhook write-path (доказано отсутствием маршрутов + e2e).

## 17. Provider identity

Не реализовано в 2.12 (providerRef nullable, не заполняется; нет провайдер-
транзакций/попыток). Попытка = новый Payment после FAILED/CANCELLED
(детерминировано index-ом). Identity-семантика — 2.12B.

## 18. Idempotency

create: identical retry → существующий активный Payment (no-op, e2e T6);
concurrent duplicate → P2002 → controlled 409, один факт (e2e T7);
overpayment after CAPTURED → no-op (второй Payment не создаётся, e2e T8).
transitions: repeat → 409 (terminal), CAS-проигрыш → 409. Raw 500 = 0.

## 19. P2002

`Payment_one_active_per_order` → controlled ConflictError (replay-путь:
fetchExisting-нет — это cardinality, не payload-идентичность; возврат
существующего выполняется ДО insert через findFirst). Unknown P2002 → не
глотается (rethrow → контролируемый 409/500-конвертация по конвенции
фильтра). Unit: P2002-путь → ConflictError, не raw 500.

## 20. Concurrency

Concurrent create — один 201 + один 409 (partial unique), ровно 1 строка
(e2e T7). Concurrent confirm+fail — CAS: один победитель, проигравший 409,
без duplicate history/event (unit CAS-проигрыш). Duplicate provider event —
N/A (2.12B). Success-vs-failure race — детерминирована CAS (from-guard).

## 21. Temporal milestones

paidAt/failedAt/cancelledAt (2.10C DEFER → 2.12): server `now()` UTC;
первый переход wins (immutable); атомарны с CAS (status+version+milestone+
history+outbox); replay не перезаписывает (terminal 409). authorizedAt/
capturedAt — DEFER (2.12B). Без backfill (e2e T1: milestones null до
перехода; T3/T5/T10: только свой milestone установлен).

## 22. PAID semantics — PASS

PAID = **CAPTURED** (деньги получены, подтверждено Finance; TravelHub
received). Не authorize (2.12B), не provider settled (2.12D). Единственное
значение; источники согласованы (2.10C: paidAt = Payment success → 2.12).

## 23. Order payment projection — PASS

`Order.paymentStatus`/`paidAmount` — Order-owned (Finance НЕ пишет order.*).
Поток: PaymentCaptured (payload refs + amount/currency) → `order-payment-
consumer` (inbox + CAS version): paymentStatus=PAID, paidAmount=amount,
history `payment_captured`; no-op при PAID. FAILED/CANCELLED не проецируются
(UNPAID). Idempotent/concurrency-safe (inbox + CAS). E2E T3: projection после
confirm; T5: FAILED не проецируется.

## 24. Booking boundary — PASS

0 прямых Booking-эффектов: не подтверждает/отменяет, не мутирует money/
temporal, не трогает availability (e2e T11: booking count без изменений).

## 25. Ledger boundary — HARD GATE PASS

0 LedgerTransaction auto-post (e2e T11). posting шаг — 2.12D. No
double-entry/balance. occurredAt authority сохранён для будущего шага.

## 26. ProviderFee boundary — PASS

0 ProviderFee (нет canonical source fact; 2.12G). e2e T11.

## 27. Refund boundary — PASS

Refund runtime не реализован (2.13). failure/cancellation ≠ refund.
REFUNDED reserved. e2e T11 (refund count без изменений).

## 28. Commission boundary — PASS

0 Commission/CommissionAccrual (2.12C/E); нет netting. e2e T11.

## 29. Events

PaymentCreated/PaymentCaptured/PaymentFailed/PaymentCancelled — canonical
registry (domain-events.ts, assertValidBusinessEventWrite enforcement);
payload PaymentEventPayload { paymentId, code, orderId, customerId|null,
amount (Decimal string), currency, method|null } — refs + frozen money,
PII-free. Только требуемые transitions/consumer-ами события (PaymentCaptured
— consumer Order projection; остальные — лента).

## 30. Outbox / Inbox

Все Payment-события — transactional outbox (emit внутри tx → publishPending
после commit). Order projection consumer — InboxEvent dedup + CAS. 0 side
effects до commit.

## 31. Correlation / causation / actor

HTTP-команды (create/confirm/fail/cancel): correlation = server UUID,
causation = null (ADR-0009/0010, как orderAction; e2e T3/T5: correlationId
не null). Actor — USER из request context (history actorId/actorName +
AuditLog userId/username). Клиентские значения не принимаются (нет полей).

## 32. RBAC

`finance.payment.read` (FINANCE/ADMIN/DIRECTOR/ANALYST/OPERATOR/...) —
read-эндпоинты; `finance.payment.write` (FINANCE/ADMIN) — create/confirm/
fail/cancel. 0 универсальных write. e2e T9: 401 аноним, 403 SALES_MANAGER/
DIRECTOR на write (read — 200), FINANCE write OK, 404 unknown.

## 33. Buyer own-scope

Не экспонирован (Buyer payment — 2.12B). BUYER/PARTNER — 403. Никаких
buyer-initiated команд в 2.12.

## 34. Mass assignment — PASS

PAYMENT_CREATE_FORBIDDEN_KEYS (raw-body assertNoForbiddenKeys): id/code/
status/amount/currency/customerId/partnerId/providerRef/version/createdAt/
updatedAt/paidAt/failedAt/cancelledAt/isActivePayment → 422 (e2e T4, 7 forged
видов, 0 строк). Transitions — bodyless.

## 35. IDOR

Unknown/foreign Payment → нейтральный 404 (e2e T9: GET/confirm
PAY-99999999 → 404). Forbidden role — 403 (не 404).

## 36. PII / PCI

0 PAN/CVV/card/секретов в schema/payload/DTO (e2e T12: DTO-ключи не
содержат pan/cvv/cardNumber/secret/firstName/passport; только refs + money
+ descriptive paymentMethod). Card data — 2.12B STOP-condition.

## 37. History / AuditLog

PaymentHistory (created/captured/failed/cancelled; from/to/actor/comment,
без provider payload/PII) + Security AuditLog (finance.payment.created/
captured/failed/cancelled, minimal details {code, orderId, amount,
currency, from, to}). Разделены от outbox.

## 38. Legacy

Migration аддитивная; существующие Payment rows (foundation) readable
(status/amount/currency как были, milestones NULL, isActivePayment=true —
default честно для строк foundation без отклонений). 0 fabricated status/
paidAt/providerRef/ledger фактов.

## 39. Write-path audit — HARD GATE (Unsafe = 0)

| Writer | Операция | Классификация |
|---|---|---|
| PaymentService.createPayment | payment.create (PENDING) | canonical Finance owner |
| PaymentService.transition | payment.updateMany (CAS) | canonical Finance owner |
| PaymentService (create/transition) | paymentHistory.create | canonical history |
| OrderSubscribers.onPaymentCaptured | order.updateMany (paymentStatus/paidAmount) | canonical Order-owned projection |
| order.service.createOrderFromRequested | order.create (UNPAID/0) | canonical Order |
| e2e/raw | — | test-only |
| Payment.update/upsert/delete | 0 в prod | — |

Order.paymentStatus/paidAmount writers: Order create (initial) + Order
projection subscriber (PaymentCaptured). Payment milestone writers: только
PaymentService.transition.

## 40. Reprice audit — PASS

В Payment-путях (create/transition/read) 0 Product/Tariff/Tax/FX lookup
(repo-wide §43): деньги — исключительно frozen Order snapshot. Product
price change после freeze → Payment неизменен (e2e T2).

## 41. Cross-domain side effects

Payment core НЕ трогает Order lifecycle (только projection полей
paymentStatus/paidAmount — Order-owned subscriber), Booking lifecycle,
Availability, acquisitionSource, service occurrence. Finance fact counts
(Ledger/ProviderFee/Settlement/Payout/Refund/Invoice/Commission/
CommissionAccrual) — 0 изменений (e2e T11).

## 42. Negative coverage

e2e: 401 (T9), 403 (T9), 404 unknown (T9), forged amount/currency/status/
milestones/version/isActivePayment/providerRef → 422 (T4), duplicate create →
no-op (T6), concurrent duplicate → один факт + 409 (T7), repeat/из FAILED →
409 (T8), overpayment после CAPTURED → no-op (T8), Order CANCELLED → 422
(unit), no direct Order write (T3 — проекция через событие; unit), no
Booking write (T11), no reprice (T2), no Refund/Commission/Settlement/
Payout/ProviderFee/Ledger (T11), no PII/PCI (T12), unknown P2002 (unit),
CAS-проигрыш → 409 без duplicate history (unit), no raw 500 (T7). Malformed
decimal/unsupported currency — недостижимы (деньги server-copied).

## 43. Positive coverage

e2e: canonical create + PAY-* + PENDING (T1), frozen money verbatim (T1),
confirm → CAPTURED + paidAt + projection PAID/paidAmount + PaymentCaptured
event (T3), fail → FAILED + failedAt + attempt 2 (T5), cancel → CANCELLED +
cancelledAt + attempt 2 + detail-read (T10), identical replay (T6),
concurrent one fact (T7), events + correlation (T3/T5), RBAC FINANCE/ADMIN
(T9), Direct (T1), BUYER_REQUEST (T13), legacy — N/A (runtime новый;
миграция аддитивная), fresh migration replay (harness 61 suite). Unit:
guards/frozen money/idempotency/milestones (12).

## 44. Unit tests

`payment.service.spec.ts` (12): frozen money verbatim; unknown Order → 404;
CANCELLED/CLOSED → 422; identical retry no-op; P2002 → 409; confirm sets
paidAt + isActivePayment=true; fail/cancel sets milestone + isActivePayment=
false; repeat confirm → 409; confirm из FAILED → 409; CAS-проигрыш → 409 без
history; unknown payment → 404.

## 45. Targeted E2E

`payment-flow.e2e-spec.ts` T1–T13 (13) + регрессия затронутых suite'ов
(finance-domain-foundation [эволюция тестов 7/11 по §28], ledger, provider-
fee, order-lifecycle, order-temporal, booking-requested, booking-lifecycle,
pricing-financial-snapshot, phase-entry): **172/172** (9 suites). Карта
§39/§40 → тесты: см. комментарий-шапку спеки.

## 46. Full backend regression

`tsc --noEmit` ✓ · `npm run build` ✓ · unit **520/520** (43 suites) · full
serial e2e **1080/1080** (61 suites, 0 skipped/focused). +13 к baseline 1067.

## 47. Frontend regression

Фронт не менялся (Payment UI — 2.12B, вне scope): `tsc --noEmit` ✓ ·
Vitest **135/135** ✓ · `next build` ✓.

## 48. DB regression

`migrate status` — 52 migrations, «Database schema is up to date!» ✓;
fresh replay — harness drop+recreate + migrate deploy (весь serial e2e с
нуля) ✓; drift — `migrate diff --from-config-datasource --to-schema` →
**No difference detected** (0) ✓. Без db push.

## 49. Issues found

1. **LOW (test-изоляция)** — payment-flow послеAll не удалял Payment-
   события (aggregateId = payment id) → глобальный счётчик
   `eventType contains "Payment" === 0` в order-temporal/acquisition/
   remove-bootstrap падал (утечка T9-платежа). Исправлено: полный cleanup
   Payment-событий + inbox (фикс ниже).
2. **NONE в prod-коде** — overpayment после CAPTURED возвращает существующий
   Payment (201, idempotent no-op), а не 409: конвенция «identical retry =
   same effect» (Ledger); overpayment protection обеспечивается на DB-уровне
   (второй Payment не создаётся). Документировано в api.md/арх-доке.

## 50. Fixes applied

1. payment-flow afterAll: удаление outbox-событий по aggregateId
   (created.payments) + inbox, до удаления Payment rows (полная изоляция).
2. T9: созданный Payment добавлен в created.payments (устранена утечка).
3. T3/T5: assertion causation → correlation (HTTP-команды: causation null по
   ADR-0009/0010 — код корректен, тест был неверен).
4. T8: overpayment-assertion 409 → idempotent no-op (201, тот же payment id,
   count 1) — соответствует поведению.
5. finance-domain-foundation e2e тесты 7/11 — эволюция по §28 (Payments
   активированы 2.12; refunds/invoices/settlements/payouts/ledger — 404;
   запрещены authorizedAt/capturedAt/settledAt/refundedAt).

## 51. Architecture decision status

0 unresolved. Stop conditions §53 (1–18): payable source однозначен (Order
snapshot); cardinality определена (1 активный; 2.12F документирован);
partial/split — deferred 2.12F (не требуется в 2.12); PAID = CAPTURED
(единственное значение); Order projection authority — Order-owned subscriber;
PSP — deferred 2.12A/B (не требуется); provider identity — deferred 2.12B;
cross-domain writes — 0 (не требуются); reprice — 0; Tax/FX — 0; Commission —
0; Settlement/Payout — 0; Refund — 0; double-entry — 0; temporal authority —
server, первый wins; legacy backfill — 0; breaking events — 0; активных
Payment writer-ов — 1 (PaymentService) + Order-owned projection subscriber
(только свои поля).

## 52. Deferred / out-of-scope

2.12A Provider Abstraction; 2.12B Buyer card/wallet + webhook (authorize/
capture, authorizedAt/capturedAt, signature, provider event idempotency);
2.12C SPLIT/Commission; 2.12D PLATFORM_COLLECT + Ledger posting; 2.12E
PARTNER_COLLECT/CommissionAccrual; 2.12F Partial payments/installments
(переработка Payment_one_active_per_order, PMT-* материализация,
PARTIALLY_PAID); 2.12G PSP fees; Refund (2.13); Invoice (2.14); Buyer payment
surface; Payment UI frontend. Все задокументированы (арх-док §27).

## 53. Exact files changed

Backend: `prisma/schema.prisma` (Payment milestones + isActivePayment +
PaymentHistory + partial index), `prisma/migrations/20260814120000_add_payment_runtime/migration.sql` (new), `src/eventbus/domain-events.ts` (4 события + payload), `src/modules/finance/finance.validation.ts` (DTO + forbidden keys), `src/modules/finance/payment.service.ts` (new), `src/modules/finance/payment.service.spec.ts` (new), `src/modules/finance/finance.controller.ts` (payments endpoints), `src/modules/finance/finance.module.ts` (PaymentService), `src/modules/order/order.subscribers.ts` (Order payment projection).
Tests: `backend/test/payment-flow.e2e-spec.ts` (new), `backend/test/finance-domain-foundation.e2e-spec.ts` (эволюция 7/11).
Docs: `docs/architecture/payment-flow.md` (new), `docs/contracts/api.md`, `docs/contracts/events.md`, `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`, `docs/prompts/PHASE_2_STEP_2.12_PAYMENT_FLOW_IMPLEMENTATION.md` (промпт, уже был), `docs/prompts/PHASE_2_STEP_2.12_PAYMENT_FLOW_IMPLEMENTATION_REPORT.md` (этот файл).

## 54. Roadmap update

Step 2.12 → `🚧 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW` (2026-08-14).
NEXT → `PHASE 2 — STEP 2.12 — STRICT REVIEW` (не выполняется в этом проходе).

## 55. Exact NEXT item

**PHASE 2 — STEP 2.12 — STRICT REVIEW** (не начинается в этом проходе; Step
2.13 и далее — тоже).

---

**PHASE 2 STEP 2.12 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW**
