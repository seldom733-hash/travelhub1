# PHASE 2 — STEP 2.12E — PARTNER_COLLECT / COMMISSION ACCRUAL FOUNDATION — STRICT REVIEW REPORT

Дата: 2026-08-15. Промпт: `PHASE_2_STEP_2.12E_PARTNER_COLLECT_COMMISSION_ACCRUAL_FOUNDATION_STRICT_REVIEW.md` (39 секций).

## 1. VERDICT

**PHASE 2 STEP 2.12E STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES**

## 2. METHODOLOGY

Repository-first, adversarial. Имплементационный отчёт не принимался на веру: каждый
hard gate проверялся по фактическому production-коду (`CommissionService`,
`CommissionAccrualConsumer`, `sales.service` freeze, `order.service`/
`order-requested.consumer` EventBus-доставка, `finance.validation`, `finance.controller`),
Prisma schema, SQL миграции, RBAC (`ROLE_PERMISSIONS`), unit/e2e — с реальными прогонами
(не скопированы counts). EventBus fix (§18–20) — критический cross-cutting аудит с
регрессией 10 затронутых e2e-сьютов.

## 3. BASELINE

- Branch `master`, HEAD `124cceb` (bump 0.18.0, релиз 2.14E); dirty-дерево = реализация 2.12E (объект ревью).
- Roadmap: 2.12A/B/C/D/F ⏳ NOT STARTED; **2.12E 🚧 IMPLEMENTATION COMPLETED** (до ревью); 2.14E ✅ APPROVED; 2.14 ⛔ BLOCKED; 2.14F 🚧 PLANNED.
- Migration count 56, e2e harness реплеит из миграций (fresh replay).

## 4. SOURCES INSPECTED

- Roadmap v3; ADR-0001 (cross-domain), ADR-0010 (events/actor), ADR-0013 (Commission Policy Contract D1–D23).
- `schema.prisma` (Order/Quote/CheckoutIntent/Sale/Commission/CommissionAccrual/CommissionPolicy); migration `20260814190000_add_partner_collect_commission_accrual`.
- `sales.money.ts`/`finance.money.ts` (toMoney2, ROUND_HALF_UP); `sales.service.ts` (issueQuote freeze, createCheckoutIntent, completeSale).
- `order-requested.consumer.ts`/`order.service.ts` (OrderCreated delivery); `eventbus.service.ts` (emit/emitResult/publishPending); `domain-events.ts`.
- `commission.service.ts`, `commission-accrual.consumer.ts`, `finance.validation.ts`, `finance.controller.ts`, `finance.module.ts`, `sales.module.ts`.
- Фактический `ROLE_PERMISSIONS` (security/permissions.constants.ts); `commission-policy.service.ts` (resolver).
- api.md, events.md, ids.md, арх-док 2.12E; unit-спеки CommissionService/CommissionPolicyService; e2e `partner-collect-commission-accrual`.

## 5. SCOPE RECONCILIATION

2.12E реализует ТОЛЬКО: frozen commission snapshot, frozen seller identity, Commission fact,
CommissionAccrual fact, CommissionAccrued, read API. Отсутствуют (проверено кодом+миграцией):
PSP split (2.12C), Payment→commission producer, Ledger posting (2.12D), Settlement/Payout
(2.14A/B), Invoice (2.14), refund/dispute adjustments (D11/D12), Commission UI. Scope expansion: нет.

## 6. POLICY AUTHORITY

Repo-wide аудит (`grep commission rate/percentage`): единственный mutable authority —
`finance.CommissionPolicy` (2.14E). Production hardcoded TravelHub commission rates = 0
(только schema-комментарии). ProviderFee ≠ TravelHub Commission (2.10B — внешние PSP/bank
факты, отдельная модель). Catalog/Product/Tariff/PSP/frontend/env — не второй rate authority
(freeze использует resolver 2.14E; признание — только frozen snapshot). **PASS.**

## 7. FREEZE CHAIN

`Quote ISSUE → CheckoutIntent → Sale → Order → Commission producer` — commissionSnapshot
{policyCode, policyVersion, rateType, rate, baseAmount, baseCurrency, channel, sellerPartnerId,
selectedAt, roundingContractVersion} verbatim (проверено фактическим кодом sales.service:
issueQuote строит snapshot, createCheckoutIntent/completeSale копируют, order-requested
consumer персистит). После freeze: 0 policy re-resolve, 0 live rate lookup, 0 repricing
(producer читает только frozen факты). **Adversarial proof e2e T9**: policy A (0.15) заморожена
→ A архивирована, B (0.30) активирована → Commission использует frozen A (amount 15, rate 0.15),
НЕ B (30). **PASS.**

## 8. SELLER SNAPSHOT

`Order.sellerPartnerId` — frozen на Quote ISSUE (один уникальный non-null Product.partnerId по
items, snapshot-at-event). Producer читает frozen seller (Order.sellerPartnerId), НЕ live Catalog.
**Adversarial proof e2e T10**: freeze с seller A → product.partnerId мутирован на B (live) →
Order.sellerPartnerId = A, Commission.partnerId = A. **PASS.**

## 9. MULTI/NO-SELLER

- один seller → допустимо (T1);
- missing seller → 0 фактов (T4: unowned product, MARKETPLACE + policy active);
- multi-seller → 0 фактов (T11: 2 items, 2 partners — snapshot sellerPartnerId null → 0);
- «first» никогда не выбирается (код: `partnerIds.size === 1 ? [...][0] : null`).
0 live lookup для «исправления» snapshot. **PASS.**

## 10. MONEY/BASE/ROUNDING

`commissionAmount = round_half_up(baseAmount × rate)` — `toMoney2` (finance.money →
sales.money, Decimal authority, ROUND_HALF_UP, 2 знака DECIMAL(12,2)); 0 JS float, 0
`Number(rate)*Number(base)`, 0 parseFloat. base = frozen `Order.total` (дисконтированный,
tax-exclusive by construction, до refund); base mismatch snapshot↔Order → ValidationDomainError
(producer-дефект). 0 Refund/Dispute/ProviderFee/FX subtraction. **Half-cent adversarial**: unit
`1.00 × 0.015 = 0.015 → 0.02` (ROUND_HALF_UP); e2e T2 `123.45 × 0.15 = 18.5175 → 18.52`.
Zero-amount (0.01 × 0.15 → 0.00) → fail-loud ValidationDomainError (unit). **PASS.**

## 11. CORRUPTED SNAPSHOT

validateCommissionSnapshot (форма): missing material fields, rate (каноническая форма 2.14E:
0<r<1, ≤6 знаков; 1e-7/0/≥1/7dp → throw), base (invalid/negative), channel ≠ MARKETPLACE →
throw, policyVersion (int ≥1), sellerPartnerId (empty → throw), **selectedAt (ISO 8601 —
review fix**, malformed → throw). Консистентность с Order: sellerPartnerId/currency/baseAmount
mismatch → ValidationDomainError. Принцип: corrupted authoritative snapshot → fail loudly
(событие FAILED, e2e T8: seller mismatch → OrderCreated FAILED, 0 фактов), НЕ молчаливый
неверный финансовый факт. Валидация НЕ требует live policy lookup (0 обращений к
CommissionPolicy при признании). **PASS.**

## 12. WRITE-PATH AUDIT

Repo-wide: Commission/CommissionAccrual create/update/upsert/delete/raw SQL — ЕДИНСТВЕННЫЙ
writer `CommissionService.createAccrualForOrder` (grep: 0 других). commissionSnapshot пишут
только sales.service (freeze) и order.service (персист verbatim из payload); Order.sellerPartnerId
— только через OrderRequested payload → order.service. 0 seed/job/consumer-писателей, 0
cross-domain Finance write (consumer — READ-only чтение Order, ADR-0001). **PASS.**

## 13. COMMISSION VS ACCRUAL SEMANTICS

Commission = earned-факт TravelHub; CommissionAccrual = receivable Partner→TravelHub
(PARTNER_COLLECT). НЕ два независимых money authority: создаются атомарно в одной
транзакции (см. §14); amount идентичен (один Decimal из одного расчёта); accrual однозначно
ссылается на source Commission (sourceCommissionId unique); независимого update amount нет
(immutable, 0 update-путей). **PASS.**

## 14. ATOMICITY

Одна `$transaction` (consumer): read Order → create Commission + CommissionAccrual +
CommissionAccrued (emitResult, outbox) → inbox row. Failure injection (e2e T8: corrupt snapshot
→ ValidationDomainError до create) → событие FAILED, 0 фактов, 0 partial graph (нельзя
оставить Commission без Accrual / Accrual без Commission / event для rollback-факта). **PASS.**

## 15. IDEMPOTENCY / DIVERGENT REPLAY

Три уровня: (1) Inbox unique consumerId+eventId; (2) `Commission_orderId_key`; (3)
`CommissionAccrual_sourceCommissionId_key`. Identical replay → no-op существующий факт (unit:
`createAccrualForOrder` повторно → существующий, eventId "", 0 create; e2e T6: повторный
publishPending → 1 факт). Divergent (amount/currency/partnerId/collectionModel) → controlled
`ConflictError` (unit; класс «silent divergent idempotency success» НЕ найден — money-поля
сравниваются). Provenance-only divergence (policyCode/channel при идентичном amount) →
first-write-wins (fact immutable; событие не перезаписывается) — согласовано с Ledger 2.10A
samePayload-конвенцией; base/rate divergence при признании перехватывается ДО сравнения
(baseAmount==Order.amount) → ValidationDomainError (FAILED). Unknown P2002 — констрейнт-
специфично (orderId/sourceCommissionId/consumerId+eventId → no-op; прочее → FAILED, код
consumer-а). **PASS.**

## 16. CONCURRENCY

e2e T12: один PENDING OrderCreated + `Promise.all([publishPending(), publishPending()])` →
ровно 1 Commission + 1 Accrual + 1 CommissionAccrued, 0 raw 500 (inbox + DB unique backstop;
loser P2002 → констрейнт-специфичный no-op). **PASS.**

## 17. EVENTBUS / ORDERCREATED AUDIT

Цепочка: OrderRequested → order-requested consumer tx → OrderCreated (outbox **PENDING**,
emit) → post-commit (consumer помечает источник OrderRequested PUBLISHED + publishPending) →
CommissionAccrualConsumer. Проверено:
- OrderCreated пишется PENDING в той же tx, что Order (emit) — публикация НЕ до commit;
- rollback (consumer error) → publishPending не вызывается → событие НЕ публикуется;
- nested/reentrant publishPending НЕ создаёт duplicate delivery: источник OrderRequested
  помечен PUBLISHED до вложенного publishPending (иначе повторная доставка всем handler-ам —
  именно этот дефект давал attempts=2 и был исправлен в реализации, см. §18);
- recursion loop отсутствует: publishPending → handler → publishPending → handler
  (CommissionAccrualConsumer) → CommissionAccrued (emitResult PUBLISHED, без диспатча) — цепочка
  конечна; ordering сохраняется (вложенный publishPending — после коммита, sequential await);
- изменение — узкое применение уже утверждённого outbox pattern (payment.service/
  booking.service: emit PENDING + publishPending после коммита), НЕ новый глобальный
  delivery/retry redesign; автономного retry worker НЕ введено (остаётся Step 2.17 debt).
**PASS.**

## 18. ORDERREQUESTED REGRESSION

Промежуточная версия давала attempts=2 (nested publishPending в finally задваивал доставку
OrderRequested при failure). Независимо подтверждено исправление: publishPending ТОЛЬКО после
успешного коммита + маркировка источника PUBLISHED до вложенного publishPending.
Существующий e2e `sale-completion-order-requested` 29-30 (delivery failure → FAILED
attempts=1, retryFailed → PENDING → PUBLISHED, deliveries=2, тот же eventId) — PASS в
полной serial e2e (1134/1134). Нормальный flow не получает дополнительную доставку. **PASS.**

## 19. COMMISSIONACCRUED ENVELOPE

Event name `CommissionAccrued`; source aggregate `CommissionAccrual` (aggregateId = accrual.id);
payload: refs (commissionId/commissionCode/accrualId/accrualCode/orderId/orderCode/partnerId) +
frozen money/policy provenance (amount/currency/channel/collectionModel/policyCode/policyVersion/
baseAmount/baseCurrency/selectedAt) — БЕЗ PII (e2e T1 asserts email/phone/passport/card
отсутствуют). causationId = OrderCreated.id (e2e T1 проверяет), correlation наследуется
(chain OrderRequested → OrderCreated → CommissionAccrued); actor — SYSTEM (ADR-0010,
consumer-ная обработка). Один business event на реальный accrual (T1/T6: 1 событие; transport
exactly-once НЕ заявляется — one business effect доказан через inbox/idempotency). **PASS.**

## 20. REFUND/DISPUTE BOUNDARIES

0 mutation original Commission/Accrual/snapshot (write-path audit: единственный writer —
CommissionService; Refund/Dispute сервисы не имеют кода доступа к Commission/Accrual);
0 reversal в 2.12E (D11/D12 deferred). Dispute OPENED НЕ считается liability outcome.
Проверено кодами RefundService/DisputeService + full serial e2e (refund-flow, chargeback-
dispute-foundation — PASS). **PASS.**

## 21. PAYMENT/PSP/LEDGER BOUNDARIES

0 SPLIT_AT_PAYMENT (enum содержит только PARTNER_COLLECT); 0 PSP adapter/split; 0
Payment→Commission producer; 0 PSP-owned rate. 0 LedgerTransaction auto-posting (2.12D —
отдельный producer-шаг, задокументирован). Признание НЕ ждёт Payment CAPTURED (D10).
e2e T7: delta 0 по LedgerTransaction/Payment (и др.). **PASS.**

## 22. SETTLEMENT/PAYOUT/INVOICE BOUNDARIES

0 Settlement/Payout (2.14A/B), 0 Invoice/numbering/invoice events (2.14) — код+миграция+
e2e T7 (delta 0). Invoice-концепты ADR-0013 D13 не мержатся. **PASS.**

## 23. RBAC/READ API

Фактический `ROLE_PERMISSIONS`: `finance.commission.read` — FINANCE/DIRECTOR/ANALYST;
ADMIN = ALL_PERMISSIONS (read+manage). SALES_MANAGER/OPERATOR/MODERATOR/MARKETER/PARTNER/BUYER
— НЕ имеют commission.read. e2e T3 (расширен): FINANCE/DIRECTOR/ANALYST → 200 (list+detail
Commission и Accrual); SALES_MANAGER/OPERATOR/MODERATOR/MARKETER/PARTNER/BUYER → 403;
anonymous → 401 (первый suite-тест T-матрицы). 404 unknown code — e2e T3. **PASS.**

## 24. TEMPORAL/IDS/IMMUTABILITY

selectedAt = freeze instant (Quote ISSUE, ISO — валидируется, review fix); accruedAt =
признание (OrderCreated обработка, server-owned UTC, first-only, без backfill); createdAt =
persistence. IDs CMS-/CAA- через канонический IdsService (атомарный счётчик, e2e T1 asserts
code-паттерны); ids.md содержит префиксы (строки 42/44). Immutability — по-construction:
0 update/delete routes, 0 raw SQL мутаций, единственный writer; DB-trigger immutability НЕ
заявляется (docs честно: «update/delete путей нет»); updatedAt есть (forward-looking для
будущей status-эволюции INVOICED/PAID/COLLECTED), не используется как business time. **PASS.**

## 25. MIGRATION / FRESH REPLAY

SQL `20260814190000_add_partner_collect_commission_accrual` проверен напрямую: additive
(ADD COLUMN / CREATE INDEX / CREATE TYPE / ADD unique — все пустые таблицы), 0 destructive
ALTER, 0 fabricated backfill, корректные индексы/unique (Commission_orderId_key,
CommissionAccrual_sourceCommissionId_key, Order_sellerPartnerId_idx), legacy nullable safety.
Фактически: `migrate status` 56/56 up-to-date; fresh DB `migrate deploy` через e2e harness
(serial e2e 1134/1134 — fresh replay proof); live→schema `prisma migrate diff` → **No
difference detected** (после review fix #4: добавлен `@@index([sellerPartnerId])` в schema —
миграция создавала индекс, schema не имела). `db push` не использовался. **PASS.**

## 26. LEGACY COMPATIBILITY

Pre-2.12E Quote/Checkout/Sale/Order без snapshot остаются валидными: producer no-op при
NULL snapshot (unit) + вся serial e2e (fixture-Orders без snapshot → 0 фактов, inbox no-op).
Запрещено и отсутствует: historical backfill current policy, fabricated sellerPartnerId,
fabricated Commission/Accrual, NULL → 0%. Legacy acquisition NULL → no commission (D15). **PASS.**

## 27. NEGATIVE BOUNDARY MATRIX

После нормального PARTNER_COLLECT flow (e2e T7, delta-подсчёты в shared DB):

| Fact/domain | Expected | Факт |
|---|---|---|
| Commission | 1 | 1 |
| CommissionAccrual | 1 | 1 |
| CommissionAccrued business event | 1 | 1 |
| LedgerTransaction | 0 | 0 |
| ProviderFee | 0 | 0 |
| Settlement | 0 | 0 |
| Payout | 0 | 0 |
| Invoice | 0 | 0 |
| Refund created by accrual | 0 | 0 |
| Dispute created by accrual | 0 | 0 |
| Payment mutation by accrual | 0 | 0 |
| Booking mutation | 0 | 0 |
| Availability mutation | 0 | 0 |

**PASS.**

## 28. REVIEW FIXES

1. **MEDIUM (validation)** — `validateCommissionSnapshot` принимал malformed `selectedAt`
   (не-ISO) → битый provenance в CommissionAccrued. Фикс: ISO 8601 (fail-loud). Files:
   `finance.validation.ts`; proving: unit snapshot-матрица (`selectedAt: "not-a-date"` → throw).
2. **MEDIUM (raw 500)** — read API list: invalid `status`-фильтр → каст в enum → Prisma enum
   error → 500. Фикс: `@IsEnum(CommissionStatus)`/`@IsEnum(CommissionAccrualStatus)` на
   CommissionListQueryDto/CommissionAccrualListQueryDto → контролируемый 400. Files:
   `finance.validation.ts`; proving: e2e T13 (`status=NOT_A_STATUS` → 400; `ACCRUED` → 200).
   Латентный аналогичный паттерн у PaymentListQueryDto/RefundListQueryDto (pre-existing,
   вне scope 2.12E) — задокументирован, НЕ трогался.
3. **HIGH (e2e-infra, вскрыл реальную коллизию)** — fixture Orders T8/T12 брали `number` из
   ORD-счётчика вместо TH-2026 sequence → коллизия `Order.number` при последующем каноническом
   создании (OrderRequested FAILED; вскрылось как «Order not found» в T9). Фикс: канонический
   `IdsService.nextCode/nextOrderNumber` (в tx). Files: `partner-collect-commission-accrual.e2e-spec.ts`;
   proving: T9+ проходят, serial e2e 1134/1134.
4. **LOW (drift)** — `Order.sellerPartnerId` без `@@index` в schema при наличии индекса в
   миграции → live→schema drift. Фикс: `@@index([sellerPartnerId])`. Files: `schema.prisma`;
   proving: `prisma migrate diff` → No difference detected.

0 новых business policy изобретено (все фиксы — контракт-сохраняющие).

## 29. BACKEND/FRONTEND/DB REGRESSION

Фактические прогоны (НЕ скопированы из отчёта):
- Backend: `tsc --noEmit` ✓; production build ✓; unit **598/598** (47 suites; +15 commission
  service + unit-расширения); targeted EventBus e2e **122/122** (10 suites: sale-completion-
  order-requested, order-creation-consumer, acquisition-source-propagation, business-event-
  envelope, outbox-failure-injection, booking-requested-consumer, order-canonical-events,
  payment-flow, refund-flow, chargeback-dispute-foundation); **serial e2e 1134/1134 (65 suites,
  +5 review T9–T13)**.
- Frontend: `tsc --noEmit` ✓; Vitest **135/135**; build ✓ (0 frontend-изменений в 2.12E).
- DB: `migrate status` **56/56** up-to-date; fresh replay (e2e harness `migrate deploy`);
  live→schema diff **drift 0** (после fix #4).

## 30. DOCUMENTATION CONSISTENCY

Roadmap (2.12E → ✅ APPROVED WITH REVIEW FIXES; 2.14 ⛔ BLOCKED; 2.12C ⏳ NOT STARTED),
ADR-0013 (D9/D10/D14/D19 реализованы без отклонений), арх-док 2.12E, api.md (+status enum
400-валидация), events.md (OrderCreated delivery + CommissionAccrued), ids.md (CMS/CAA),
implementation report (+addendum) — сверены. Docs НЕ утверждают завершёнными: 2.12C PSP split,
2.12D ledger posting, refund reversal, dispute adjustment, Invoice, автономный EventBus retry
worker (cross-cutting hardening остаётся Step 2.17 debt — явно зафиксировано). **PASS.**

## 31. FILES CHANGED (review)

- `backend/src/modules/finance/finance.validation.ts` — selectedAt ISO (fix 1); @IsEnum status (fix 2).
- `backend/prisma/schema.prisma` — `@@index([sellerPartnerId])` (fix 4).
- `backend/test/partner-collect-commission-accrual.e2e-spec.ts` — T9–T13 (new), T3 RBAC matrix,
  T7 Booking/Availability delta, T8/T12 fixture IdsService (fix 3).
- `backend/src/modules/finance/commission.service.spec.ts` — +3 unit (half-cent, zero-amount, snapshot matrix).
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` — 2.12E APPROVED WITH REVIEW FIXES.
- `docs/contracts/api.md` — status enum 400 note.
- `docs/prompts/PHASE_2_STEP_2.12E_..._IMPLEMENTATION_REPORT.md` — addendum.
- `docs/prompts/PHASE_2_STEP_2.12E_..._STRICT_REVIEW_REPORT.md` — этот отчёт.

## 32. STOP-CONDITION RESULT

Ни один из 10 stop-conditions (§36 промпта) не сработал: canonical commission base — ADR-0013
(frozen Order.total) ✓; seller source — frozen sellerPartnerId ✓; recognition moment — Order
creation ✓; monetary authority Commission vs Accrual — одна модель расчёта, атомарно ✓;
one-Commission-per-Order — соответствует approved V1 (orderId unique) ✓; freeze boundary —
ADR-0013/2.11 ✓; multi-seller — fail-closed без нового policy ✓; refund/dispute policy не
требуется для корректности текущего факта (adjustments deferred) ✓; EventBus fix — narrow,
без нового global delivery redesign ✓; PSP split semantics не придумывалась ✓.
**Результат: ARCHITECTURE DECISION REQUIRED НЕ возвращается.**

## 33. ROADMAP UPDATE

**Step 2.12E → ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES** (строка 609, полный
статус-блок с review-резюме). Step 2.14 НЕ разблокирован (⛔ BLOCKED сохранён). 2.12C НЕ
считается начатым. Другой step НЕ стартован.

## 34. DEPENDENCY RECONCILIATION

Eligible NEXT по dependency graph (НЕ по номеру), с проверкой prerequisites:
- **2.12A — Payment Provider Abstraction** — ⏳ NOT STARTED; prerequisites: нет (foundation
  PSP-абстракции). **NEXT по графу.**
- 2.12B — webhook/provider lifecycle — ⏳ NOT STARTED; зависит от 2.12A (adapters).
- **2.12C — SPLIT_AT_PAYMENT** — ⏳ NOT STARTED; **HARD-DEPENDS на 2.12A + 2.12B + 2.14E
  policy foundation** (native PSP split требует адаптеров/authorize-capture/webhooks; share
  требует frozen policy/base — 2.14E готов) — зафиксировано явно.
- 2.12D — PLATFORM_COLLECT — ⏳ NOT STARTED; зависит от 2.12C.
- Step 2.14 (resume) — ⛔ BLOCKED; commission-половина ждёт 2.12C/2.12E (2.12E готов).
- Step 2.14F (Commission Policy Management UI) — 🚧 PLANNED; backend 2.14E + 2.12E read API готовы.

NEXT **не начинается** в этом проходе (HARD STOP).

## 35. EXACT NEXT

**`PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION`** (по dependency graph 2.12C → HARD
2.12A+2.12B+2.14E; 2.12A — ближайший неблокированный prerequisite). Не начинается без
отдельного промпта. 2.14F UI — параллельный трек (промпт 2.14F готов к реализации).

## 36. FINAL CANONICAL VERDICT

**PHASE 2 STEP 2.12E STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES**
