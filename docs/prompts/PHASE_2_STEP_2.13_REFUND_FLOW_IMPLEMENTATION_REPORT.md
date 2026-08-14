# PHASE 2 — STEP 2.13 — REFUND FLOW — IMPLEMENTATION REPORT

## 1. Verdict

`PHASE 2 STEP 2.13 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Архитектурных блокеров нет (все stop-conditions §55 отрицательны). Step 2.14+
не начинался.

## 2. Repository baseline

- Branch `master`, HEAD `3e89387` (2.12 STRICT REVIEW APPROVED WITH REVIEW FIXES).
- Migrations: 52; unit 520/520; serial e2e 1080/1080 (61 suites); frontend 135/135; drift 0 — подтверждено повторно в начале прохода (см. §50–§52).

## 3. Sources inspected

Roadmap v3 (§2.13/2.13A/2.14), Step 2.12 prompt/report/арх-док, Screen Design Payments FINAL, `schema.prisma` (Refund/Payment/RefundStatus/Order), migrations, PaymentService/controller/validation, OrderSubscribers, domain-events, permissions.constants, finance-domain-foundation.md, payment-flow.md, finance-temporal-contract.md, ids.md, api.md/events.md, legacy-код (0 refund-кодов), phase2-entry-audit/order-temporal-contract (глобальные счётчики).

## 4. Current → Target

| Аспект | До 2.13 | После 2.13 |
|---|---|---|
| Refund-модель | schema-only (REQUESTED default, 0 writer-ов) | runtime (RFD-*, lifecycle, milestones) |
| Source | — | CAPTURED Payment (currency/orderId verbatim) |
| Lifecycle | — | REQUESTED → APPROVED → PROCESSED \| FAILED |
| Partial refund | — | в scope (разные суммы — независимые факты) |
| Over-refund | — | serialized advisory lock + SUM(non-FAILED) |
| Payment REFUNDED | reserved (2.12) | остаётся reserved/unreachable (документировано) |
| Order projection | paymentStatus/paidAmount | + refundedAmount; REFUNDED при полном возврате |
| Milestones | — | requestedAt/approvedAt/processedAt/failedAt |

## 5. Refund ownership — HARD GATE

`finance.Refund` — Finance-owned; единственный writer — `RefundService`
(create + CAS transition). Repo-wide: 0 других refund create/update/delete в
prod; Order/Booking/Sales не пишут refund; RefundService не пишет Order/Booking
(проекция — Order-owned subscriber). Cross-domain writes = 0.

## 6. Source Payment authority — CRITICAL

Refund ссылается ТОЛЬКО на CAPTURED Payment (guard: status != CAPTURED →
422). `currency`/`orderId` server-derived verbatim из Payment (orderId — из
Payment.orderId, никакого live commercial lookup); 0 Product/Tax/FX re-read.
Payment.amount не читается как pricing authority — только как граница
refundable. Доказано e2e T1/T2.

## 7. Cardinality — CRITICAL

Partial refund'ы в scope (Roadmap): несколько Refund на Payment (разные суммы).
Ограничение — idempotency slot: ≤1 НЕ-FAILED Refund на (paymentId, amount)
(managed `isActiveRefund` + partial unique). Identical retry → no-op; attempt 2
после FAILED; второй идентичный частичный refund блокируется conservative.
Future: аддитивная переработка ключа при business-потребности — НЕ блокирует
partial semantics (задокументировано в schema/migration/арх-доке).

## 8. Refundable amount — HARD GATE

`refundable = payment.amount − Σ(refund.amount WHERE status != FAILED)`.
REQUESTED/APPROVED резервируют ёмкость; PROCESSED учитывается; FAILED
освобождает. refund > refundable → 409 (capacity-семантика reserveAvailability);
zero/negative/malformed → 422. Без float (Decimal, validateRefundAmount).

## 9. Payment REFUNDED assessment

Не активирован. Обоснование (§9 2.13-промпта): partial refund в scope → одиночный
Payment.REFUNDED семантически неверен; правда о возвратах живёт в Refund-фактах
(Σ). Payment остаётся CAPTURED после любого refund (e2e T11: status CAPTURED,
amount/currency frozen). REFUNDED reserved/unreachable — как в 2.12.

## 10. Schema/model

`finance.Refund`: + requestedAt/approvedAt/processedAt/failedAt (nullable,
first-only), + isActiveRefund (managed, default true), + `history RefundHistory[]`,
+ partial unique `Refund_one_active_per_payment_amount` (paymentId, amount) WHERE
isActiveRefund. Новая модель `finance.RefundHistory` (id/refundId/refund FK
Cascade/action/from/to/actorId/actorName/comment/createdAt). `order.Order`:
+ `refundedAmount DECIMAL(12,2) NOT NULL DEFAULT 0` (после paidAmount).

## 11. Migration

`20260814150000_add_refund_runtime` — аддитивная: 4 milestone-колонки +
isActiveRefund + partial unique + RefundHistory (+ FK Cascade) + Order.refundedAmount.
Без backfill (таблица пуста — 0 writer-ов до 2.13); без db push; fresh replay
доказан полным serial e2e (drop+recreate + migrate deploy); drift 0.

## 12. IDs

RFD-* — `IdsService.nextCode(tx, "RFD")` внутри той же tx, что и create
(атомарно). `code @unique`; коллизия кода не трактуется как idempotency
(в P2002-catch ловится только `Refund_one_active_per_payment_amount`).

## 13. Money

Decimal (decimal.js), DECIMAL(12,2); 0 float/Number() authority
(validateRefundAmount: > 0, ≤ 2 знаков). Currency server-copied (forged → 422).
Refund.amount immutable (нет update-эндпоинтов; silent rewrite невозможен).

## 14. Partial refund semantics

Append-факты (несколько Refund-строк) с собственным lifecycle; Σ(non-FAILED) —
суммарно возвращено; полный refund = Σ == payment.amount. Ограничение
идентичных сумм — idempotency slot (§7). Order-проекция: refundedAmount
аккумулирует, paymentStatus REFUNDED при полном возврате.

## 15. Over-refund protection — CRITICAL

`pg_advisory_xact_lock(hashtext('refund:' || paymentId))` + SUM(non-FAILED)
внутри tx create — concurrent частичные refund'ы не превышают amount (нет
TOCTOU; БЕЗ мутации Payment). Race-тест e2e T8: два concurrent 70 на payment 100
→ один факт, total ≤ 100, loser 409, raw 500 = 0. Sequential e2e T5: 60 + 50 на
100 → 409 (refundable 40).

## 16. Status vocabulary

REQUESTED/APPROVED/PROCESSED/FAILED — из schema-foundation enum (2.10) +
canonical Roadmap-визион (requestedAt/approvedAt/processedAt/failedAt). Не
выдуман generic PENDING/SUCCESS. Архивное «refundedAt» (2.10C-арх-док draft)
НЕ используется — канон processedAt (совпадает со статусом PROCESSED;
зафиксировано в foundation-тесте 11).

## 17. State machine

`RefundService.transition` — единственный authority: CAS updateMany
{id, status, version} + from-guard + milestone + history + audit + outbox
атомарно. Matrix: create→REQUESTED; approve REQUESTED→APPROVED; process
APPROVED→PROCESSED; fail REQUESTED|APPROVED→FAILED. Повторный переход → 409;
CAS-loss → 409 без duplicate history. Hidden transitions = 0.

## 18. Creation authority

Только `POST /finance/refunds` (finance.refund.write). Клиент: paymentId +
amount + reason. Buyer/public-маршрутов нет (Buyer refund-request — Customer
Support flow, future; endpoint не экспонируется).

## 19. PSP boundary

0 внешних вызовов/webhook/секретов. PSP/chargeback — 2.13A+ (Roadmap).
Lifecycle — manual/provider-neutral подтверждение Finance (как Payment confirm).

## 20. Provider identity

providerRef отсутствует (0 provider-identity) — добавляется только с PSP-шагом
(2.13A+), тогда provider-scoped uniqueness + replay.

## 21. Idempotency — CRITICAL

Create: managed isActiveRefund + partial unique (paymentId, amount) — identical
retry → существующий факт (no-op); concurrent → P2002 → 409; attempt 2 после
FAILED. Transitions: CAS — повторный → 409 (one effect). Unknown P2002 не
глотается. Divergent payload (другая сумма) — независимый факт (subject to
over-refund sum).

## 22. P2002

`Refund_one_active_per_payment_amount` → controlled 409; code unique — не
idempotency; unknown P2002 — rethrow.

## 23. Concurrency

Concurrent duplicate create → один факт + 409 (T7); concurrent different-amount
(70+70) → serialized, total ≤ amount (T8); approve vs fail — CAS; terminal retry
→ 409. Без duplicate event/history/milestone; raw 500 = 0.

## 24. Temporal milestones

requestedAt (create), approvedAt (approve), processedAt (process), failedAt
(fail) — server-owned UTC, first-only, атомарны с CAS, nullable до наступления,
БЕЗ backfill. E2E T3/T6 assert first-only + null-состояния.

## 25. Payment impact

Payment НЕ мутируется: status CAPTURED, amount/currency frozen (T11 assert).
REFUNDED reserved/unreachable. Finance-internal projection НЕ требуется
(правда — в Refund-фактах).

## 26. Order projection

Order-owned subscriber `order-refund-consumer` на RefundProcessed:
refundedAmount += amount (Decimal, defensive ≥ 0, cap at paidAmount);
paymentStatus REFUNDED при refundedAmount >= paidAmount, иначе PAID. Inbox
dedup + CAS version; Finance НЕ пишет order.*; paidAmount не переписывается
(T3/T4/T6 assert).

## 27. Booking/Availability boundary

0 (T11: bookings/availabilityReservation counts без изменений).

## 28. Ledger boundary

0 (T11 ledger count без изменений; posting — 2.12D).

## 29. ProviderFee boundary

0 (T11).

## 30. Commission boundary

0 (T11; 2.12C/E defer).

## 31. Settlement/Payout boundary

0 (T11).

## 32. Invoice boundary

0 (T11; 2.14).

## 33. Events

RefundCreated/RefundApproved/RefundProcessed/RefundFailed — canonical registry
(DomainEvents + RefundEventPayload {refundId, code, paymentId, orderId, amount,
currency, reason?}); outbox атомарно с фактом; одно событие на реальный
переход, 0 на no-op/stale. RefundProcessed — consumer Order; остальные —
лента/аналитика (прецедент OrderReadyForBooking/BookingCompleted).

## 34. Outbox/Inbox

emit внутри tx + publishPending после commit; Inbox dedup (inboxEvent +
isProcessed); duplicate delivery → no-op; no publish before commit.

## 35. Correlation/causation/actor

HTTP-команды: correlation = server UUID, causation = null, USER actor
(T3 assert). Consumer: causation = родительский eventId, correlation унаследован
(проекция result-event не эмитит — потребителей нет).

## 36. RBAC

`finance.refund.read` (FINANCE/DIRECTOR/ANALYST/SALES_MANAGER/ADMIN);
`finance.refund.write` — ДОБАВЛЕНО (FINANCE/ADMIN); `finance.refund.approve`
(FINANCE/ADMIN). T9: 401/403 (SALES/DIRECTOR на write+approve), FINANCE OK,
read 200 для SALES/DIRECTOR, 404 unknown.

## 37. Buyer surface

Не экспонирована (Customer Support flow, future). Buyer Cabinet payments —
не затронут (проверено phase2-entry-audit: available:false остаётся).

## 38. Mass assignment

`REFUND_CREATE_FORBIDDEN_KEYS` (raw-body 422): id/code/status/currency/orderId/
customerId/version/timestamps/requestedAt/approvedAt/processedAt/failedAt/
isActiveRefund/providerRef (T10: 7 forged-вариантов → 422, 0 строк создано).

## 39. IDOR

Unknown refund → 404 (T9); read — по whitelist-query; роль без права → 403.

## 40. PII/PCI

DTO/события/history: refs + frozen money + reason; 0 PAN/CVV/card/secrets/
traveler PII (T12 assert по ключам DTO).

## 41. History/AuditLog

RefundHistory: одна строка на реальный переход; 0 на no-op/stale (CAS-loss →
rollback; unit assert history НЕ создан). AuditLog: finance.refund.created/
approved/processed/failed, минимальные details, правильный actor, без
дублирования на no-op.

## 42. Legacy

Refund-таблица пуста (schema-only, 0 writer-ов до 2.13) — миграция безопасна;
schema-only строки читаемы без fabricated milestones (nullable, DTO null).

## 43. Write-path audit — HARD GATE

Refund create/update/updateMany: только `RefundService` (create + CAS
updateMany). refundHistory: только RefundService. isActiveRefund: только
RefundService. Order.refundedAmount/paymentStatus: только Order-owned subscriber
(+ инициализация в createOrderFromRequested — refundedAmount не трогается там,
DEFAULT 0). Payment writers: не затронуты 2.13. Unsafe writers = 0.

## 44. Money/refundable audit

Расчёт refundable — ТОЛЬКО RefundService (Decimal, source Payment.amount,
сумма non-FAILED refunds); 0 Product/Tariff/Tax/FX re-read; 0 float; over-refund
protected атомарно (advisory lock); rounding — DECIMAL(12,2) verbatim (никакого
пересчёта).

## 45. Cross-domain side effects

0: Booking/Availability/Sale/Quote/CheckoutIntent/Product/acquisitionSource/
service occurrence не тронуты (T11); LedgerTransaction/ProviderFee/Settlement/
Payout/Invoice/Commission/CommissionAccrual counts без изменений (T11).

## 46. Negative coverage

T2 (non-CAPTURED → 422; unknown → 404), T5 (over-refund → 409; zero/negative —
unit 422), T7 (concurrent duplicate — один факт, no 500), T8 (concurrent
over-refund — total ≤ amount, no 500), T9 (401/403/404), T10 (forged → 422),
T3/T9 (invalid/repeat transition → 409), unit (unknown P2002 не глотается,
CAS-loss без history), T11 (0 side-effects), T12 (PII-free), T6 (FAILED →
projection не реагирует). Product price change после freeze — N/A (Refund не
читает Catalog; source — frozen Payment; защищено 2.11/2.12 frozen-цепочкой).

## 47. Positive coverage

T1 (canonical create, RFD-*, REQUESTED+requestedAt, currency/orderId verbatim),
T3 (approve→process, milestones first-only, Order REFUNDED, события +
correlation), T4 (partial 40+60: PAID → REFUNDED, 2 факта), T5 (identical retry
no-op), T6 (attempt 2 после FAILED), T7/T8 (concurrency), T13 (BUYER_REQUEST).
Direct acquisition — во всех T (buildOrder default); legacy read — N/A (таблица
пуста); fresh replay — полный serial e2e.

## 48. Unit tests

`refund.service.spec.ts` (14): frozen money verbatim + advisory-lock/SUM assert,
404/422 guards, amount validation (0/-5/abc/1.999), over-refund 409 без create,
idempotent no-op, P2002 → 409, transitions (approve/process/fail + isActiveRefund
semantics), from-guard 409, CAS-loss без history, 404. `finance.validation.spec`
расширен: validateRefundAmount. Итого unit 534/534.

## 49. Targeted E2E

refund-flow T1–T13 (13/13) + затронутые suites (payment-flow, finance-domain-
foundation [7/11 эволюционированы], ledger, provider-fee, order-temporal,
order-lifecycle, checkout, pricing, booking-requested-consumer, phase2-entry-
audit): **166/166 (11 suites)**.

## 50. Full backend regression

tsc ✓ · build ✓ · unit **534/534** · serial e2e **1093/1093 (62 suites, +13
refund-flow T1–T13)** · без skipped/focused.

## 51. Frontend regression

tsc ✓ · Vitest **135/135** · production build ✓ (frontend не изменялся — UI
Refund-экранов вне scope 2.13).

## 52. DB regression

migrate status 53/53 applied · fresh replay (harness drop+recreate + migrate
deploy, весь serial e2e с нуля) · drift 0 («No difference detected») · без
db push.

## 53. Issues found

1. (тест) T2 initial fail — попытка создать PENDING payment повторным
   `POST /finance/payments` на order с CAPTURED payment вернула idempotent
   no-op (существующий CAPTURED) → рефакторинг helper-а (buildOrder +
   buildCapturedPayment), PENDING строится отдельной цепочкой.
2. (тест) foundation-тест 11 — `failedAt` теперь на Payment И Refund; scoped
   проверки разделены (paidAt/cancelledAt — Payment-only; requestedAt/
   approvedAt/processedAt — Refund-only; failedAt — оба).
3. (docs) api.md Payment RBAC-claim «OPERATOR read» — остаток 2.12-review-fixa,
   пропущенный в том проходе; исправлен в этом (см. §54).

## 54. Fixes applied

1. api.md: RBAC-claim Payment read-множества исправлен (OPERATOR убран) —
   консистентно с фактическим `ROLE_PERMISSIONS` и 2.12-review-fix.
2. foundation-тесты 7/11 эволюционированы (§28): refund write-path активирован
   (route существует — 404 «Payment not found», не route-missing); 2.13-
   милстоуны Refund проверены; refundedAt (архивное имя) остаётся запрещённым.

## 55. Architecture decision status

Stop-conditions §55 — все отрицательны: source Payment однозначен (CAPTURED);
cardinality определена (partial, idempotency slot); partial semantics
определены; refundable authority — Payment.amount − Σ; Payment REFUNDED не
конфликтует (reserved, документировано); Order projection представляет refund
truth (refundedAmount + REFUNDED/PAID); over-refund предотвращён атомарно;
PSP/chargeback deferred (2.13A+) без блокировки; provider identity deferred;
direct Order/Booking writes не требуются; repricing/Tax/FX/Commission/
Settlement/Payout/Invoice/double-entry не требуются; milestone authority
однозначен; migration без fabricated history; 1 writer; event contract
аддитивен. Блокеров НЕТ.

## 56. Deferred/out-of-scope

2.13A — Chargeback/Dispute Foundation (provider identity, evidence, liability,
ledger/commission/settlement adjustments); 2.13B+ — Buyer refund-request
surface; PSP refund (providerRef, webhook, attempt identity); multiple
identical partial refund'ы (аддитивная переработка ключа); reverse allocations
(нет allocation-движка); ledger posting (2.12D); commission reversal (2.12C/E);
invoice/credit-note (2.14); double-entry/balances/reconciliation (не существуют).

## 57. Exact files changed

- `backend/prisma/schema.prisma` — Refund milestones + isActiveRefund + partial
  unique + RefundHistory; Order.refundedAmount.
- `backend/prisma/migrations/20260814150000_add_refund_runtime/migration.sql` (new).
- `backend/src/modules/finance/refund.service.ts` (new), `refund.service.spec.ts` (new).
- `backend/src/modules/finance/finance.controller.ts`, `finance.validation.ts`,
  `finance.module.ts`.
- `backend/src/security/permissions.constants.ts` — `finance.refund.write`.
- `backend/src/eventbus/domain-events.ts` — RefundCreated/Approved/Processed/Failed
  + RefundEventPayload.
- `backend/src/modules/order/order.subscribers.ts` — onRefundProcessed.
- `backend/test/refund-flow.e2e-spec.ts` (new); `finance-domain-foundation.e2e-spec.ts`
  (7/11 эволюция).
- `docs/architecture/refund-flow.md` (new), `docs/contracts/api.md` (+Refund,
  +Payment RBAC fix), `docs/contracts/events.md` (+Refund), Roadmap v3 (2.13 →
  WAITING FOR STRICT REVIEW), этот отчёт (new).

## 58. Roadmap update

Step 2.13 → `🚧 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`; NEXT =
`PHASE 2 — STEP 2.13 — STRICT REVIEW` (не выполняется в этом проходе). Step
2.14+ не помечен начатым.

## 59. Exact NEXT item

`PHASE 2 — STEP 2.13 — STRICT REVIEW` (по промпту strict review, создаётся
перед ревью). HARD STOP: строгий ревью и Step 2.14 в этом проходе не
выполняются.
