# PHASE 2 — STEP 2.12 — PAYMENT FLOW — STRICT REVIEW REPORT

## 1. Verdict

**PHASE 2 STEP 2.12 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES**

Независимый adversarial-аудит (implementation-отчёт не принимался на веру; проверялись фактический код, Prisma schema, SQL миграция, все write-path-и и consumers, RBAC-матрица, repo-wide денежная арифметика, тесты, документация — с реальными прогонами). Все hard gates PASS. Один review fix (LOW, документация — RBAC-claim). Никаких архитектурных блокеров (все stop-conditions §49 отрицательны).

## 2. Repository baseline

- Branch `master`, синхронен с `origin/master` (push не выполнялся).
- HEAD: `6b2c04e` — `feat: Phase 2 Steps 2.11–2.12` (2.11 APPROVED WITH REVIEW FIXES + 2.12 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW).
- Working tree на момент ревью: только файлы 2.12 (реализация) + новые доки review.
- Migrations: 52 (последняя — `20260814120000_add_payment_runtime`); `migrate status` — «Database schema is up to date!» (52/52).
- Roadmap: 2.12 → `🚧 WAITING FOR STRICT REVIEW`; NEXT = STEP 2.13 — REFUND FLOW.
- Заявленный baseline для проверки: unit 520/520; serial e2e 1080/1080 (61 suites); frontend 135/135; migrate 52/52 drift 0.

## 3. Sources inspected

- Roadmap v3 (§560–587), Step 2.12 prompt + implementation report, strict review prompt.
- `backend/prisma/schema.prisma` (model Payment, PaymentHistory, PaymentStatus enum, Order/OrderItem money-поля).
- `backend/prisma/migrations/20260814120000_add_payment_runtime/migration.sql`.
- `backend/src/modules/finance/payment.service.ts`, `finance.controller.ts`, `finance.validation.ts`, `finance.module.ts`, `finance.service.ts`, `ledger.service.ts`, `settlement.service.ts`.
- `backend/src/modules/order/order.subscribers.ts` (onPaymentCaptured), `order.service.ts` (createOrderFromRequested — frozen Order money), `order.module.ts`.
- `backend/src/modules/booking/booking.subscribers.ts`, `booking.service.ts` (0 money-писателей).
- `backend/src/eventbus/domain-events.ts` (registry + PaymentEventPayload), `eventbus.service.ts`.
- `backend/src/security/permissions.constants.ts` (ROLE_PERMISSIONS), `security.service.ts`.
- `backend/src/modules/sales/sales.money.ts` (validateFrozenMoneyFact), `sales.service.ts`, `sales.payment-terms.ts`.
- Тесты: `test/payment-flow.e2e-spec.ts`, `test/finance-domain-foundation.e2e-spec.ts` (эволюция 7/11), `test/ledger-transaction-foundation.e2e-spec.ts`, `test/provider-fee-settlement-payout-foundation.e2e-spec.ts`, `test/order-temporal.e2e-spec.ts`, `src/modules/finance/payment.service.spec.ts`, `sales.money.spec.ts`.
- Доки: `docs/architecture/payment-flow.md`, `docs/contracts/api.md`, `docs/contracts/events.md`, Roadmap.

## 4. Current → Target

| Аспект | Текущее (2.12) | Целевое (будущее) |
|---|---|---|
| Создание | Finance-команда `POST /finance/payments` (finance.payment.write); деньги server-copied из frozen Order | Buyer/self-service surface — 2.12B |
| Lifecycle | PENDING → CAPTURED \| FAILED \| CANCELLED (CAS, from-guard) | AUTHORIZED/REFUNDED — reserved (2.12B authorize / 2.13 refund) |
| Provider-neutral execution | Manual подтверждение Finance; providerRef — opaque unused | PSP-адаптеры — 2.12A/2.12B |
| PSP | 0 кода (repo-wide 0 webhook/Stripe-путей) | 2.12A (provider abstraction), 2.12B (authorize/capture) |
| Authorization | — (нет метода; AUTHORIZED в enum reserved) | 2.12B (authorizedAt) |
| Capture | PENDING → CAPTURED = подтверждение получения денег (paidAt) | PSP capture milestone (capturedAt) — 2.12B |
| Milestones | paidAt/failedAt/cancelledAt (first-only, server-owned UTC) | authorizedAt/capturedAt — 2.12B (defer подтверждён) |
| Partial payments | 1 активный Payment на Order (overpayment protection) | 2.12F переработает partial unique (документировано) |
| Refund | REFUNDED reserved, 0 writer-ов/путей | 2.13 Refund Flow |
| Commission | 0 (нет CommissionAccrual) | 2.12C/E |
| Ledger posting | 0 (Payment не создаёт LedgerTransaction) | 2.12D |
| Order projection | Order-owned subscriber на PaymentCaptured (paymentStatus=PAID, paidAmount) | переоценка при 2.12F partial |
| Booking coupling | 0 (не тронуты) | 0 навсегда (boundary) |

Reserved enum-значения AUTHORIZED/REFUNDED не участвуют в активном runtime (0 переходов, 0 writer-ов — §10/§33).

## 5. Payment ownership — HARD GATE — PASS

Перечислены все Payment writer-ы repo-wide (`payment.create/update/updateMany/upsert/delete` + `isActivePayment/milestone` assignment):
- `payment.service.ts` — `createPayment` (create) и `transition` (updateMany CAS). ЕДИНСТВЕННЫЙ writer в prod.
- Тесты — только cleanup (`payment-flow.e2e-spec.ts` afterAll deleteMany) и чтения.
- 0 raw SQL, 0 скрытых PSP-писателей, 0 сидов (`prisma.payment` в prisma/ — 0 вхождений), generated Prisma client — только типы/доки.
- Order/Booking/Sales НЕ пишут `finance.Payment` (cross-domain write отсутствует).

## 6. Payable source — CRITICAL — PASS

- `createPayment` читает `order.amount` + `order.currency` — frozen snapshot, созданный в `createOrderFromRequested` из OrderRequested payload verbatim (`amount = new Prisma.Decimal(payload.total)`, `currency = payload.currency`), без какого-либо чтения mutable Catalog/Tax/FX.
- `validateFrozenMoneyFact(order.amount, order.currency, ...)` — платформенный контракт sales.money (2.11 authority).
- Клиент не может передать деньги: `PAYMENT_CREATE_FORBIDDEN_KEYS` включает amount/currency (T4 → 422).
- T2: изменение цены тарифа ПОСЛЕ создания Order → Payment держит frozen amount (не 999). Reprice-proof доказан e2e.

## 7. Cardinality — CRITICAL — PASS

- `isActivePayment` (managed boolean) + partial unique `Payment_one_active_per_order` (DB-level, паттерн ModerationSubmission.isActiveSubmission).
- Attempt 2 после FAILED/CANCELLED: isActivePayment=false → строка вне индекса → новый Payment создаётся (T5/T10 — 2 Payment на Order: 1 CANCELLED + 1 PENDING).
- После CAPTURED: isActivePayment=true → второй Payment невозможен (overpayment protection; create → no-op возвращает существующий, DB — backstop; T8).
- Concurrent duplicate create: оба прошли findFirst → один проиграл P2002 → controlled 409 (T7, [201,409]).
- 2.12F переработает индекс в своей аддитивной миграции — будущие partial/installment semantics не блокируются (документировано в schema/migration/payment-flow.md).

## 8. isActivePayment consistency — PASS

- Инвариант: `isActivePayment == status NOT IN (FAILED, CANCELLED)`.
- Устанавливается атомарно в том же CAS-updateMany, что и переход статуса (`isActivePayment: !REINITIABLE.includes(to)`): true для CAPTURED, false для FAILED/CANCELLED; create всегда true (PENDING).
- Единственный writer — PaymentService; дрейф status↔flag невозможен (одна атомарная запись, unit-тесты assert data.isActivePayment по каждому переходу).

## 9. Status vocabulary — PASS

- Prisma enum `PaymentStatus`: PENDING/AUTHORIZED/CAPTURED/FAILED/CANCELLED/REFUNDED.
- Резерв: AUTHORIZED (2.12B PSP authorize), REFUNDED (2.13). Ни один не reachable: в `transition` только CAPTURED/FAILED/CANCELLED с from-guard PENDING; 0 методов/эндпоинтов на AUTHORIZED/REFUNDED; repo-wide 0 переходов на них.
- Screen Design не задаёт payment-статусы (vocabulary — из milestone-деферов 2.10C); Roadmap/арх-док/events.md согласованы.

## 10. Single state machine authority — PASS

- Единственный переход — `PaymentService.transition` (private): CAS `where {id, status: PENDING, version}` + from-guard (status !== PENDING → ConflictError; уже в целевом → ConflictError).
- 0 других Payment.status writer-ов (repo-wide audit §5).
- Один winner на конкурентный переход (updateMany count===1); проигравший — controlled 409, без duplicate history/event (unit «CAS-проигрыш» assert).

## 11. PAID = CAPTURED — CRITICAL — PASS

- Order projection срабатывает ТОЛЬКО на `PaymentCaptured` (PENDING → CAPTURED): paymentStatus=PAID, paidAmount=frozen.
- Никакой источник не определяет PAID иначе (api.md §2.12: «Payment CAPTURED ⟺ деньги получены (подтверждено Finance)»; арх-док §PAID semantics; T3 e2e).
- PaymentFailed/PaymentCancelled НЕ проецируются (обязательство остаётся UNPAID — T5 assert).

## 12. Temporal contract — HARD GATE — PASS

- paidAt на CAPTURED, failedAt на FAILED, cancelledAt на CANCELLED — атомарны с CAS-переходом (один timestamp, в том же updateMany), first-only (повторный переход невозможен lifecycle-ом → 409), server-owned UTC, nullable до наступления.
- authorizedAt/capturedAt НЕ добавлены (миграция добавляет только paidAt/failedAt/cancelledAt) — defer 2.12B подтверждён.
- Future conflict paidAt vs capturedAt (2.12B): в 2.12 paidAt = момент подтверждения получения денег; 2.12B введёт capturedAt (PSP capture). Возможный дуализм оплачен (PASS с анализом): семантика разводится по признаку «manual/provider-neutral подтверждение» (paidAt) vs «PSP capture fact» (capturedAt); при 2.12B потребуется ADR о том, какой из них становится Order-projection trigger — зафиксировано в §49 как осознанная future-risk, НЕ блокер 2.12 (в 2.12 существует только paidAt).

## 13. Migration review — PASS

- `20260814120000_add_payment_runtime`: ТОЛЬКО аддитивные изменения — 3 nullable milestone-колонки, managed `isActivePayment BOOLEAN NOT NULL DEFAULT true`, partial unique index, таблица PaymentHistory + FK (Cascade, внутри finance.*), индекс по paymentId.
- Без backfill, без перезаписи существующих данных, без db push.
- Harness: drop+recreate тестовой БД + `prisma migrate deploy` (e2e.global-setup) — fresh replay всех 52 миграций доказан каждым e2e-инвокейшеном; drift 0 (§47).

## 14. IDs — PASS

- `PAY-*` — `IdsService.nextCode(tx, "PAY")` внутри той же транзакции, что и create (атомарно).
- `code @unique` на уровне БД; коллизия кода НЕ трактуется как idempotency (в P2002-catch ловится только `Payment_one_active_per_order`; code collision → не глотается).

## 15. Money — PASS

- Decimal (decimal.js через Prisma), DECIMAL(12,2) контракт; 0 `Number()`/`parseFloat` authority в Payment-пути (repo-wide audit 2.12: единственные money-helper-ы — sales.money/finance.validation, оба Decimal).
- amount/currency frozen из Order; мутация после create невозможна (нет update-эндпоинтов; DTO whitelist).
- Единственный rounding authority — sales.money ROUND_HALF_UP (2.11); Payment ничего не пересчитывает.

## 16. PaymentTerms — PASS

- Payment НЕ ре-резолвит mutable Finance PaymentTerms: frozen Sales/Order terms (paymentScheme/prepaymentType/... в OrderRequested snapshot) — authority; Payment читает только Order.amount/currency.
- PaymentTerms в Payment-пути не участвуют вообще (обязательство = полная сумма Order).

## 17. Creation idempotency — PASS

- Identical create → существующий активный Payment (no-op, один факт) — T6.
- После FAILED → новый Payment (attempt 2) — T5; после CANCELLED → новый Payment — T10.
- После CAPTURED → no-op (существующий факт) — T8; DB-level backstop.
- Concurrent initial create → ровно один факт + controlled 409 — T7.
- Divergent business input: деньги клиентом не передаются (§6) — расхождение amount/currency структурно невозможно; единственный клиентский input paymentMethod — descriptive (не authority).

## 18. Overpayment / second attempt — CRITICAL — PASS (design documented)

- Второй успешный платёж после CAPTURED: `findFirst(isActivePayment:true)` → существующий Payment (201 no-op). НЕ создаётся вторая строка — overpayment физически невозможен (partial unique index как DB-backstop, P2002 → 409 при гонке).
- §18 промпта («не молча treat as harmless retry, unless identity proves same attempt»): attempt-identity у клиента отсутствует (create payload = orderId + paymentMethod; idempotency order-scoped). Это сознательная конвенция «identical retry = same effect» (как Ledger 2.10A replay и как задокументировано в T8): повторный create — операция «убедиться, что Payment для заказа существует», а не «начать второй платёж». Второй РЕАЛЬНЫЙ платёж (новая бизнес-инициация) блокируется на уровне данных. При 2.12F (partial) контракт idempotency пересматривается аддитивно.
- Зафиксировано как observation (не дефект): семантика согласована с существующей конвенцией и DB-invariant-ом.

## 19. Divergent replay — PASS

- Same identity (orderId) + divergent money: невозможно — amount/currency server-authoritative из Order (клиент не передаёт, T4 422).
- providerRef/attempt: клиент не передаёт; providerRef всегда null (2.12); попытки различаются строками Payment (attempt 2 = новая строка PAY-*).
- paymentMethod divergence при no-op: descriptive, не влияет на money факт; повторный create возвращает существующий Payment с первым method — задокументировано.

## 20. P2002 — PASS

- `Payment_one_active_per_order` → controlled ConflictError 409 (единственный catch по имени constraints; unit + T7).
- `code` unique — НЕ idempotency (не ловится; коллизия — честная ошибка, как и везде в проекте).
- Unknown P2002 — не глотается (rethrown).

## 21. Concurrency — PASS

- Concurrent identical create — T7: [201, 409], один факт, без raw 500.
- CAPTURED vs FAILED/CANCELLED (success-vs-failure race): CAS детерминизм — ровно один winner пишет milestone+history+event; проигравший 409 (unit CAS-loss: history НЕ создан).
- Terminal retry — 409 (T8).
- Concurrent attempt-2 после FAILED: оба findFirst(active)=null → один проиграл partial unique → 409 (тот же механизм, что T7).
- 0 raw 500 во всех сценариях.

## 22. Creation authority — PASS

- Единственный путь создания — `POST /api/v1/finance/payments` с `finance.payment.write` (FINANCE/ADMIN). Скрытых Buyer/public-маршрутов нет (repo-wide 0 других Payment create).
- Buyer surface (account.payment.read_own существует в каталоге прав, но read-model Buyer Cabinet НЕ реализован в 2.12) — defer 2.12B, задокументировано.

## 23. RBAC — PASS (doc fix)

Фактическая матрица из `ROLE_PERMISSIONS`:
- read (`finance.payment.read`): ADMIN, FINANCE, DIRECTOR, ANALYST, SALES_MANAGER.
- write (`finance.payment.write`): ADMIN, FINANCE.
- БЕЗ доступа: OPERATOR, PARTNER, BUYER, MARKETER, MODERATOR (403 на все finance.payment-эндпоинты).
- E2E T9: 401 аноним, 403 SALES_MANAGER/DIRECTOR на write (read — 200), FINANCE write OK, 404 unknown.
- **REVIEW FIX (LOW, docs):** Roadmap 2.12 entry, арх-док §21 и имплементационный отчёт §32 утверждали «DIRECTOR/ANALYST/OPERATOR read» — фактически OPERATOR НЕ имеет finance.payment.* (read-множество — FINANCE/DIRECTOR/ANALYST/SALES_MANAGER/ADMIN). Исправлено во всех трёх документах.

## 24. Mass assignment — PASS

- `PAYMENT_CREATE_FORBIDDEN_KEYS` (raw req.body, loud 422): id/code/status/amount/currency/customerId/partnerId/providerRef/version/createdAt/updatedAt/paidAt/failedAt/cancelledAt/isActivePayment.
- T4: forged amount/currency/status/paidAt/version/isActivePayment/providerRef → 422; 0 Payment-строк создано.

## 25. IDOR — PASS

- Unknown payment code → 404 (T9, unit). Списки — только по whitelist-query DTO. Payment read доступен ролям с finance.payment.read (внутренний контракт); own-scope Buyer — отдельный read-model (2.12B).

## 26. Events — HARD GATE — PASS

- PaymentCreated (createPayment), PaymentCaptured (confirm), PaymentFailed (fail), PaymentCancelled (cancel) — outbox, атомарно с транзакцией факта (emit внутри tx; publishPending после).
- Payload (PaymentEventPayload): paymentId/code/orderId/customerId|null/amount (Decimal string)/currency/method|null — refs + frozen money, БЕЗ PII/PCI/provider-payload.
- Одно событие на реальный переход; НОЛЬ событий на no-op (create с существующим Payment — ранний return, T6) и на stale/retry (CAS-loss → ConflictError до emit; unit assert).
- PaymentCreated consumer-а нет — canonical fact для ленты/аналитики (как OrderReadyForBooking/BookingCompleted — прецедент проекта); не speculative (событие — часть агрегатного факта инициации).
- correlation/causation/actor: HTTP-команда → server UUID correlation, causation null, USER actor (ADR-0009/0010; T3/T5 assert correlationId не null).

## 27. Order payment projection — CRITICAL — PASS

- Finance НЕ пишет order.*: projection — Order-owned subscriber `order-payment-consumer` на PaymentCaptured (OrderSubscribers.onPaymentCaptured).
- Inbox dedup (`inboxEvent` + isProcessed) — повторная доставка не double-apply (T3 publishPending идемпотентен).
- own-domain CAS: `updateMany where {id, version}` + count===1 → история; unrelated fields не перезаписываются (запись только paymentStatus/paidAmount/version).
- paymentStatus=PAID, paidAmount=frozen amount из payload (Decimal string, self-sufficient, defensive валидация: parse + non-negative; malformed → fail-loud, откат — честная обработка дефекта ленты).
- Уже PAID → no-op (inbox отметка).
- No lifecycle mutation (status/version инкремент — технический; lifecycle-поля не трогаются).
- Partial-совместимость (2.12F): проекция пересматривается аддитивно (paidAmount станет суммой частичных оплат) — зафиксировано.

## 28. Order projection races — PASS (pattern documented)

- Duplicate/stale PaymentCaptured: inbox dedup → no-op; второй PaymentCaptured для того же заказа невозможен (1 активный Payment на Order).
- Concurrent Order lifecycle transition (cancel/complete): CAS по version — конкурентное обновление не перезаписывается молча; unrelated fields не тронуты.
- CAS-loss (projection проиграл гонку): inbox помечается обработанным, PAID не записывается — канонический факт остаётся в Payment aggregate (Finance), Order projection — read-model. Тот же approved-паттерн, что reconcileOrder/BookingRejected (комментарии в коде: «факт уже зафиксирован победителем»). Узкое окно (миллисекунды между чтением и CAS); reconciliation-джоба отсутствует — зафиксировано как observation (консистентно с конвенцией проекта).

## 29. Booking isolation — PASS

- 0 Booking writes/status/money/milestones в Payment-пути (repo-wide); 0 Availability-эффектов.
- T11: bookings count без изменений; 0 Ledger/ProviderFee/Settlement/Payout/Refund/Invoice/Commission/CommissionAccrual.

## 30. Ledger boundary — PASS

- Payment 2.12 НЕ создаёт LedgerTransaction (T11 ledger count без изменений). Posting — 2.12D (defer, задокументировано).

## 31. ProviderFee boundary — PASS

- 0 ProviderFee creation/расчётов (T11 fees без изменений). ProviderFee — 2.10B immutable факты; создание — только SettlementService.

## 32. Commission boundary — PASS

- 0 Commission/CommissionAccrual/netting (T11). 2.12C/E — defer.

## 33. Refund boundary — PASS

- REFUNDED reserved и unreachable (0 переходов, 0 методов, 0 эндпоинтов, 0 refundedAt). Refund-модель schema-only (2.10 foundation); writer-ов 0. 2.13 — Refund Flow.

## 34. PSP / webhook boundary — PASS

- Repo-wide (backend/src): 0 активных Stripe/provider webhook/callback/signature-путей. Единственные вхождения — комментарии «PSP — 2.12A/2.12B» и строка `provider: "STRIPE"` в settlement-тестах (2.10B fixture — имя провайдера факта, не интеграция). providerRef — неиспользуемый opaque (null в 2.12).

## 35. PII / PCI — PASS

- Payment DTO: id/code/orderId/customerId/partnerId/amount/currency/status/paymentMethod/providerRef/milestones/version/createdAt — 0 PAN/CVV/card/секретов (T12 assert).
- События: refs + frozen money; customerId — UUID-ref (не PII-атрибут); traveler PII не передаётся (OrderRequested PII-minimization прецедент).
- PaymentHistory: только переход + фиксированный comment (без payload dump); AuditLog: details {code, orderId, amount, currency} — без PII.
- Observation (не дефект): paymentMethod — свободная строка ≤64 от клиента (descriptive, не authority), сохраняется в Payment и попадает в DTO/события; рекомендация — known-value validation при PSP (2.12B), как и заявлено в контракте.

## 36. PaymentHistory — PASS

- Одна строка на реальный переход (create/transition внутри tx, после успешного CAS); НОЛЬ строк на no-op (existing return до history), на stale/failed request (CAS-loss → ConflictError → rollback; unit assert history НЕ создан).
- action: created/captured/failed/cancelled; from/to корректны; без sensitive payload.

## 37. AuditLog — PASS

- `finance.payment.created` / `finance.payment.captured` / `.failed` / `.cancelled` — корректный naming (snake_case, конвенция finance.*, прецедент 2.10B fix), правильный actor (userId/username), минимальный details, НЕТ дублирования на no-op (audit внутри tx после create/CAS-победы; P2002/CAS-loss → rollback).

## 38. Correlation / causation / actor — PASS

- HTTP-команды (create/confirm/fail/cancel): correlation = server UUID (request context), causation = null, actor = USER (T3/T5 assert correlationId не null; конвенция ADR-0009/0010, как orderAction).
- Order projection consumer: не эмитит result-event (проекция Order-owned, потребителей нет) — causation/корреляция наследуются контекстом доставки (inbox). Задокументировано в onPaymentCaptured.

## 39. Legacy — PASS

- До 2.12 Payment-таблица была ПУСТА: 0 writer-ов (repo-wide audit — единственный create — PaymentService.createPayment, добавлен в 2.12), 0 сидов, write-эндпоинты 404 (foundation-тест 7 эволюционирован — теперь 201, runtime активирован).
- Миграция `DEFAULT true` для isActivePayment на существующих строках — moot (строк не было); schema-only строки читаются без fabricated milestones/history (nullable, DTO null).
- Observation: гипотетическая legacy-строка FAILED получила бы isActivePayment=true — невозможно исторически (нет writer-ов); при необходимости 2.12F/аддитивная миграция поправит на пустой таблице.

## 40. Write-path audit — PASS

Все prod-писатели 2.12:
- `PaymentService.createPayment` — payment.create (+ history/audit/event).
- `PaymentService.transition` — payment.updateMany (CAS) (+ milestone/history/audit/event).
- `OrderSubscribers.onPaymentCaptured` — order.updateMany (paymentStatus/paidAmount, CAS) (+ history).
- `OrderService.createOrderFromRequested` — order.create c paymentStatus="UNPAID"/paidAmount=0 (инициализация).
- isActivePayment writer: только transition. Milestone writers: только transition. Order.paymentStatus/paidAmount writers: только projection + инициализация.
- Unsafe writers = 0.

## 41. Reprice audit — PASS

- Payment-путь читает: Order (amount/currency — frozen), ничего из Catalog/Tariff/Tax/FX/ExchangeRate.
- Mutable данные не могут изменить payable amount (T2 — цена изменена после freeze, Payment держит frozen). Payment НЕ pricing authority.

## 42. Negative coverage — PASS

E2E T1–T13 + unit: 401 (T9), 403 (T9), 404 (T9/T10/unit), forged fields → 422 (T4), malformed money — не forgeable (server-copied; T4 422 на любой forged), unsupported currency — не принимается клиентом, no repricing (T2), duplicate create → no-op (T6), concurrent duplicate → один факт + 409 (T7), divergent replay — структурно невозможен (no client money), unknown P2002 — unit (не глотается), invalid transition → 409 (T8/unit), terminal retry → 409 (T8), transition races — CAS (unit), second attempt rules (T5/T10), no direct Order write (T3 — через событие), no Booking (T11), no Ledger (T11), no ProviderFee/Settlement/Payout (T11), no Refund (T11), no Commission (T11), no webhook (repo-wide 0 путей), no PCI/PII (T12), no raw 500 (T7).

## 43. Positive coverage — PASS

Payment create/code PAY-*/PENDING (T1), frozen money verbatim (T1/T2/T13), CAPTURED+paidAt (T3), FAILED+failedAt (T5), CANCELLED+cancelledAt (T10), first-only milestones (T3/T5/T8), 4 события (T3/T5), replay (T6), concurrency (T7), second attempt после FAILED/CANCELLED (T5/T10), Order projection (T3), Direct acquisition (T1), BUYER_REQUEST (T13), legacy — N/A (таблица пуста, читаемость подтверждена), fresh migration replay (harness, каждый e2e-прогон).

## 44. Test quality — PASS

- Проверялись тесты, не счётчики: T7 assert loser (statuses [201,409], count===1, без 500); T3/T5 assert события + correlation; unit assert updateMany where/data (CAS guards, isActivePayment, milestones) и отсутствие history при CAS-loss; afterAll cleanup полный (payment events + inbox + history + rows + PaymentCaptured payload orderId — изоляция глобальных счётчиков order-temporal #9; фикс флейка из implementation-фазы подтверждён — serial run чист).
- Замечание по harness (не дефект кода): частичные jest-прогоны без `--runInBand` запускают suites параллельно и дают гонку `SecurityService.onModuleInit` против общей тестовой БД → ложные фейлы; официальный `npm run test:e2e` использует `--runInBand` (проверено package.json). Частичные прогоны повторены с `--runInBand` — чисто.

## 45. Backend regression — PASS

- `tsc --noEmit` ✓; `npm run build` ✓.
- Unit: **520/520** (43 suites) — совпадает с baseline.
- Targeted e2e (`--runInBand`, 9 затронутых suite-ов): **143/143**.
- Full serial e2e: **1080/1080 (61 suites)** — совпадает с baseline.

## 46. Frontend regression — PASS

- `tsc --noEmit` ✓; Vitest **135/135**; production build ✓ («Compiled successfully»). Совпадает с baseline. Frontend не изменялся в 2.12 (runtime API — backend; Screen Design finance-экраны следуют отдельным шагам).

## 47. DB regression — PASS

- `prisma migrate status`: 52/52 applied, «Database schema is up to date!».
- Fresh replay: каждый e2e-инвокейшен — drop+recreate + `prisma migrate deploy` (harness; db push не используется) — все 52 миграции применяются с нуля.
- Drift: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` → «No difference detected» (drift 0).

## 48. Review fixes

1. **LOW (docs, §23/§48)** — RBAC-claim «DIRECTOR/ANALYST/OPERATOR read» в Roadmap 2.12 entry, арх-док §21, имплементационный отчёт §32. Фактически (ROLE_PERMISSIONS): read — FINANCE/DIRECTOR/ANALYST/SALES_MANAGER/ADMIN; OPERATOR НЕ имеет finance.payment.*. Исправлено во всех трёх документах с пометкой STRICT REVIEW FIX.

## 49. Architecture decision status

Stop-conditions §49 — все отрицательны, блокеров НЕТ:
1. payable source — однозначен (frozen Order snapshot) ✓
2. active-payment uniqueness — не блокирует текущие semantics (overpayment protection, attempt 2 после FAILED/CANCELLED) ✓
3. CAPTURED vs PAID — конфликта нет (PAID = CAPTURED) ✓
4. paidAt vs future capturedAt — в 2.12 существует только paidAt; 2.12B потребует ADR о trigger Order-projection (зафиксировано, не блокер) ✓
5. Order projection authority — Order-owned, не конфликтует ✓
6. second-attempt identity/cardinality — определены (isActivePayment; no-op после CAPTURED — конвенция, задокументировано) ✓
7. partial payment — не требуется сейчас (2.12F defer; индекс эволюционируем) ✓
8. provider/Buyer flow — deferred (2.12A/B), не требуется сейчас ✓
9. ledger posting — deferred (2.12D) ✓
10. ProviderFee/Commission/Refund/Settlement/Payout — не требуются сейчас ✓
11. cross-domain write — не требуется (проекция через событие) ✓
12. active legacy PSP writer — отсутствует (0) ✓
13. event semantics — не speculative (canonical факты; PaymentCreated без consumer — прецедент OrderReadyForBooking/BookingCompleted) ✓
14. migration — без fabricated history ✓

## 50. Documentation status

- `docs/architecture/payment-flow.md` (253 строки, 27 секций): разделяет текущий provider-neutral 2.12 от PSP 2.12A/B, partial 2.12F, commission 2.12C/E, ledger 2.12D; §21 RBAC исправлен.
- `docs/contracts/api.md`: §2.12 Payment-контракт (endpoints, payload, PAID semantics, no-op/409 semantics, события).
- `docs/contracts/events.md`: 4 Payment-события с producer/payload/consumer.
- Roadmap: 2.12 → ✅ APPROVED WITH REVIEW FIXES; NEXT = STEP 2.13 (после обновления).
- Имплементационный отчёт: §32 RBAC исправлен.

## 51. Roadmap update

- Step 2.12 → `✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES` (обновлено с summary review).
- NEXT из фактического Roadmap: **STEP 2.13 — REFUND FLOW** (2.13A — Chargeback/Dispute, 2.14 — Invoice/Commission следуют). НЕ начинается в этом проходе.

## 52. Deferred / out-of-scope

- 2.12A — provider abstraction / adapter contract; 2.12B — PSP authorize/capture (authorizedAt/capturedAt, Buyer surface, webhook); 2.12C — commission accrual; 2.12D — ledger posting; 2.12E — commission settlement; 2.12F — partial/installments (переработка partial unique); 2.12G — fee granularity; 2.13 — Refund Flow; 2.14 — Invoice/Commission.

## 53. Exact files changed (review)

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` — 2.12 → APPROVED WITH REVIEW FIXES + RBAC fix + NEXT = 2.13.
- `docs/architecture/payment-flow.md` — §21 RBAC fix (OPERATOR убран из read).
- `docs/prompts/PHASE_2_STEP_2.12_PAYMENT_FLOW_IMPLEMENTATION_REPORT.md` — §32 RBAC fix.
- `docs/prompts/PHASE_2_STEP_2.12_PAYMENT_FLOW_STRICT_REVIEW_REPORT.md` — этот отчёт (новый).

## 54. Exact NEXT item

`PHASE 2 — STEP 2.13 — REFUND FLOW` (по фактическому Roadmap v3). Не начинается в этом проходе (HARD STOP).

## 55. Final certification

`PHASE 2 STEP 2.12 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

- 1 review fix: LOW (docs) — RBAC-claim OPERATOR в трёх документах; код 2.12 не изменялся.
- 0 архитектурных блокеров; observations задокументированы (§18 no-op после CAPTURED, §28 CAS-loss проекции, §39 legacy DEFAULT, §35 paymentMethod free-form).
- Регрессия подтверждена реальными прогонами: unit 520/520 · serial e2e 1080/1080 (61 suites) · frontend 135/135 + build ✓ · migrate 52/52 drift 0.
