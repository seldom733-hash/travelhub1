# PHASE 2 — STEP 2.12E — PARTNER_COLLECT / COMMISSION ACCRUAL FOUNDATION — IMPLEMENTATION REPORT

Дата: 2026-08-15. Промпт: `PHASE_2_STEP_2.12E_PARTNER_COLLECT_COMMISSION_ACCRUAL_FOUNDATION_IMPLEMENTATION.md`. Канонический ADR: ADR-0013 (Commission Policy Contract).

## 1. VERDICT

**IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW.** Finance-owned признание
TravelHub Commission (CMS-*) + receivable CommissionAccrual (CAA-*) на **Order
creation** из **frozen commissionSnapshot** (Quote ISSUE freeze, ADR-0013
D6/D7/D9/D10/D14/D19). 0 hardcoded ставок, 0 live policy lookup, fail-closed
(NO_POLICY/AMBIGUOUS/multi-seller → 0 фактов, НЕ «0%»), 0 side-effects
(Ledger/PSP/Settlement/Payout/Invoice/Refund/Dispute). Полная регрессия зелёная
(unit 596/596, serial e2e 1129/1129, migrate 56/56 drift 0).

## 2. REPOSITORY BASELINE

- Ветка `master`, HEAD `124cceb` (bump 0.18.0, релиз 2.14E).
- Рабочее дерево на старте: 2.14E APPROVED (реализация + strict review + docs),
  Step 2.14 ⛔ BLOCKED, 2.12C/2.12E ⏳ NOT STARTED, 2.14F 🚧 PLANNED (UI-реконсиляция).

## 3. SOURCES INSPECTED

- ADR-0013 (`docs/adr/ADR-0013-commission-policy-contract.md`) — D1–D23, §28 инварианты.
- `backend/prisma/schema.prisma` — Order/Quote/CheckoutIntent/Sale/Commission/CommissionAccrual/CommissionPolicy.
- `backend/src/modules/sales/sales.service.ts` — issueQuote/createCheckoutIntent/completeSale.
- `backend/src/modules/order/order-requested.consumer.ts`, `order.service.ts` — OrderCreated.
- `backend/src/eventbus/eventbus.service.ts`, `domain-events.ts` — outbox/inbox/result-events.
- `backend/src/modules/finance/commission-policy.service.ts` — resolver.
- `backend/src/modules/finance/payment.service.ts`, `booking.service.ts` — паттерн emit+publishPending.
- Существующие e2e harness-ы (order-creation-consumer, acquisition-source-propagation, commission-policy-foundation).

## 4. ADR-0013 RECONCILIATION

- **D9** (earned-факт на Order creation) — реализовано: Commission + CommissionAccrual на OrderCreated.
- **D10** (PARTNER_COLLECT recognition = Order creation; НЕ Payment CAPTURED/PSP) — реализовано: trigger OrderCreated.
- **D14** (frozen seller attribution, one-seller, multi-seller → 0 фактов) — реализовано: `Order.sellerPartnerId` snapshot-at-event.
- **D7** (commissionSnapshot verbatim) — реализовано: Quote ISSUE → Checkout → Sale → Order.
- **D4/D5** (base = frozen Order.total; Decimal round_half_up) — реализовано.
- **D19** (CommissionAccrued) — реализовано (PUBLISHED result-event, PII-free).
- **D15** (channel MARKETPLACE only) — через `mapCommissionChannelFromAcquisition`.

## 5. STEP 2.14E DEPENDENCY

- Resolver `CommissionPolicyService.resolve(channel, instant)` (2.14E) — использован на freeze без изменений.
- Policy master data (CMP-*) — источник rate; 0 ставок захардкожено.
- Отношение 2.14E→2.12E→2.12C по dependency graph подтверждено; 2.12C (SPLIT_AT_PAYMENT) НЕ начат.

## 6. PARTNER_COLLECT SEMANTICS

- Partner собирает деньги покупателя вне platform rail → TravelHub признаёт **receivable**
  (долг Partner перед TravelHub) на Order creation; settlement/invoice/collection — будущие шаги (2.14).
- ОДНА policy/rate/base для обеих collection-моделей (invariant 11); V1 — PARTNER_COLLECT (enum).

## 7. TRIGGER AUTHORITY

- Canonical trigger = **Order creation** (ADR-0013 D10, промпт §5): producer потребляет
  canonical Order-created факт (OrderCreated). НЕ Payment CAPTURED, НЕ PSP, НЕ UI-state.
- OrderCreated доставлен подписчикам (см. §20): emit PENDING + consumer-ная доставка.

## 8. SELLER/PARTNER SNAPSHOT

- `Order.sellerPartnerId` frozen на Quote ISSUE (один уникальный non-null Product.partnerId по items;
  snapshot-at-event, НЕ live Catalog lookup позже). Multi-seller/без seller → NULL → 0 фактов.
- Валидация на OrderCreated: snapshot.sellerPartnerId == Order.sellerPartnerId (mismatch → FAILED).

## 9. POLICY SOURCE

- Единственный authority — `finance.CommissionPolicy` (2.14E). Freeze использует детерминированный
  resolver; 0 live lookup при признании; 0 вторых rate-authority (repo-wide аудит §42).

## 10. SELECTION/FREEZE BOUNDARY

- **Quote ISSUE** (2.11 freeze boundary): `mapCommissionChannelFromAcquisition(MARKETPLACE)` +
  `resolve(channel, now)` → frozen `commissionSnapshot` verbatim → Checkout → Sale → Order.
- NO_POLICY/AMBIGUOUS → NULL snapshot (0 accrual; НЕ «0%»).

## 11. FROZEN COMMISSION SNAPSHOT

`{ policyCode, policyVersion, rateType, rate, baseAmount, baseCurrency, channel,
sellerPartnerId, selectedAt, roundingContractVersion: "v1" }` — переносится verbatim;
глубокая валидация формы при признании (validateCommissionSnapshot; коррупция → FAILED).

## 12. CALCULATION BASE

- base = frozen `Order.total` (D4: tax-exclusive by construction, до refund).
- Расхождение snapshot.baseAmount vs Order.amount → ValidationDomainError (producer-дефект).

## 13. DECIMAL/RATE/ROUNDING

- `amount = toMoney2(base × rate)` — `finance.money` Decimal authority, ROUND_HALF_UP, 2 знака
  (DECIMAL(12,2) money-контракт); 0 JS float. Zero-amount → ValidationDomainError.
- e2e T2: 123.45 × 0.15 = 18.5175 → **18.52**.

## 14. COMMISSION VS COMMISSIONACCRUAL

- `Commission` (CMS-*) — earned-факт TravelHub (что заработано).
- `CommissionAccrual` (CAA-*) — receivable Partner → TravelHub (PARTNER_COLLECT).
- Связь: `CommissionAccrual.sourceCommissionId` (unique — один receivable на факт).

## 15. SOURCE IDENTITY/CARDINALITY

- Источник-факт: Order (orderId). Один Commission на Order (`@@unique([orderId])`);
  один CommissionAccrual на Commission (`@@unique([sourceCommissionId])`) — DB backstop.

## 16. IDS

- `CMS-` / `CAA-` через `IdsService.nextCode(tx, ...)` (атомарный счётчик events.BusinessSequence);
  зарегистрированы в `docs/contracts/ids.md` (уже были — строки 42/44).

## 17. IMMUTABILITY

- Финансовые поля (orderId/partnerId/amount/currency/collectionModel) immutable после create;
  update/delete путей нет; статус ACCRUED фиксирован в 2.12E (эволюция — будущие шаги).

## 18. TEMPORAL CONTRACT

- `CommissionAccrual.accruedAt` — server-owned время признания (Order creation, UTC),
  first-only, без backfill (2.10C DEFER → 2.12E). Компенсирующие факты — future шаги.

## 19. EVENT CONTRACT

- `CommissionAccrued` (PUBLISHED result-event, атомарно, PII-free): refs + frozen
  money/policy provenance (amount, currency, channel, collectionModel, policyCode/version,
  baseAmount/baseCurrency, selectedAt). Потребителей 0 (лента/аналитика).
- correlation/causation: chain OrderRequested → OrderCreated → CommissionAccrued.

## 20. OUTBOX/INBOX

- **OrderCreated** теперь доставляется подписчикам: эмитится `emit` (PENDING) атомарно с Order;
  order-requested consumer после успешного коммита помечает источник OrderRequested PUBLISHED
  (иначе вложенный publishPending задвоил бы доставку) и вызывает `publishPending()` —
  паттерн payment.service/booking.service. Downstream failure → OrderCreated FAILED
  (не перебрасывается; OrderRequested остаётся PUBLISHED).
- CommissionAccrualConsumer: inbox `consumerId+eventId` dedup + DB unique backstop + P2002
  констрейнт-специфично (orderId/sourceCommissionId/consumerId+eventId — no-op; прочие — FAILED).

## 21. IDEMPOTENCY

- Тройная защита: inbox; `Commission_orderId_key`; `CommissionAccrual_sourceCommissionId_key`.
- Повторный publishPending / duplicate delivery → ровно один факт (e2e T6).

## 22. DIVERGENT REPLAY

- Existing факт + identical payload → no-op существующий (samePayload-сравнение);
  divergent → `ConflictError` (НЕ молчаливый success; класс Finance divergent-replay defect).

## 23. CONCURRENCY

- Признание — внутри транзакции consumer-а (атомарно с inbox); DB unique — backstop
  конкурентных дублей (второй получает P2002 → констрейнт-специфичный no-op).
- Специальный pg_advisory_xact_lock НЕ требуется (producer один, consumer-ная сериализация).

## 24. RBAC

- Read API: `finance.commission.read` — фактический ROLE_PERMISSIONS: FINANCE/DIRECTOR/ANALYST
  (SALES_MANAGER/OPERATOR/BUYER/PARTNER → 403; anonymous → 401). e2e T3.
- Write-эндпоинтов нет (0 write-surface).

## 25. READ API

- `GET /finance/commissions` (+`/finance/commissions/:code`), `GET /finance/commission-accruals`
  (+`/finance/commission-accruals/:code`) — whitelist-фильтры, пагинация ≤ 100, 404 unknown,
  DTO без PII. Mass-assignment-риска нет (GET-only).

## 26. MASS ASSIGNMENT

- GET-only read surface; forged-поля не применимы. OrderRequested payload-валидация
  (commissionSnapshot/sellerPartnerId) — серверная (forged → событие FAILED, Order не создаётся).

## 27. PAYMENT BOUNDARY

- 0 Payment/PSP/webhook зависимостей и созданий (2.12A/B/C deferred); признание НЕ ждёт
  Payment CAPTURED (D10).

## 28. REFUND BOUNDARY

- 0 Refund созданий; adjustment при refund (пропорциональный компенсирующий факт) —
  deferred (ADR-0013 D11).

## 29. DISPUTE BOUNDARY

- 0 Dispute созданий; liability-outcome adjustments — deferred (ADR-0013 D12).

## 30. LEDGER BOUNDARY

- 0 LedgerTransaction созданий (2.12D — отдельный producer-шаг; документировано).

## 31. PROVIDERFEE BOUNDARY

- 0 ProviderFee созданий (2.10B — фактические комиссии PSP/bank; НЕ TravelHub Commission).

## 32. SETTLEMENT/PAYOUT BOUNDARY

- 0 Settlement/Payout созданий (2.14A/B deferred).

## 33. INVOICE BOUNDARY

- 0 Invoice созданий (2.14 deferred; два invoice-концепта ADR-0013 D13 не мержатся).

## 34. MULTI-SELLER BEHAVIOR

- Freeze: 2+ уникальных non-null Product.partnerId по items → sellerPartnerId NULL →
  snapshot c sellerPartnerId NULL → 0 фактов (fail-closed; НЕ первый попавшийся seller).

## 35. CHANNEL BEHAVIOR

- Только MARKETPLACE несёт commission-контекст (mapCommissionChannelFromAcquisition);
  PARTNER_STOREFRONT/DIRECT/BUYER_REQUEST → NULL channel → 0 фактов.

## 36. POLICY ABSENCE/AMBIGUITY

- NO_POLICY/AMBIGUOUS → snapshot NULL → 0 фактов (НЕ «0%»; resolver fail-closed).
- e2e T5: заархивированная/истёкшая политика → resolve NO_POLICY → 0 Commission/Accrual.

## 37. MIGRATION

- `20260814190000_add_partner_collect_commission_accrual` — аддитивная: enum
  CommissionCollectionModel{PARTNER_COLLECT}; nullable commissionSnapshot Json?
  (Quote/CheckoutIntent/Sale/Order); Order.sellerPartnerId + index; Commission.collectionModel +
  Commission_orderId_key; CommissionAccrual.sourceCommissionId + accruedAt + unique.
  0 backfill, 0 destructive ALTER, 0 фактов в миграции (schema-only). 56/56, drift 0.

## 38. LEGACY COMPATIBILITY

- Legacy Orders: commissionSnapshot/sellerPartnerId NULL → no-op (0 фактов; без backfill).
- NULL acquisition (legacy Quote без source) → no commission (D15 PURE).

## 39. NEGATIVE COVERAGE

- e2e T3 (RBAC 403/401/404), T4 (без seller → 0 фактов), T5 (NO_POLICY → 0 фактов),
  T7 (0 side-effects по 8 финансовым моделям), T8 (коррумпированный snapshot →
  OrderCreated FAILED, 0 фактов, не молчаливый 0).
- Unit: divergent replay → ConflictError; zero-amount → ValidationDomainError; mismatch
  seller/currency/baseAmount → ValidationDomainError; validateCommissionSnapshot форма.

## 40. POSITIVE COVERAGE

- e2e T1 (canonical chain: freeze → Order → Commission+Accrual+CommissionAccrued; 15.00),
  T2 (half-up 18.52), T3 (read API), T6 (idempotency), T7 (линейность/без side-effects).
- Unit CommissionService 13/13 (create/no-op/divergent/fail-closed/read).

## 41. MULTI-PATH REGRESSION

- OrderCreated доставка — паттерн emit+publishPending: целевые e2e
  (order-creation-consumer, acquisition-source-propagation, business-event-envelope,
  order-canonical-events, sale-completion-order-requested, checkout-commercial-intent) — все PASS
  после фикса consumer-а (§47); полный serial e2e 1129/1129.

## 42. WRITE-PATH AUDIT

- Commission/CommissionAccrual: единственный writer — `CommissionService.createAccrualForOrder`
  (repo-wide grep: 0 других create/update). commissionSnapshot пишут только sales.service (freeze)
  и order.service (персист verbatim). sellerPartnerId — через payload → order.service. 0 raw SQL.

## 43. CROSS-DOMAIN OWNERSHIP

- Finance НЕ пишет order.* напрямую: CommissionAccrualConsumer — READ-only cross-context чтение
  Order (ADR-0001); snapshot приходит через canonical payload/frozen creation contract;
  Order владеет своими persisted полями.

## 44. EVENT LINEAGE

- CommissionAccrued.causationId = OrderCreated.id; correlation наследуется из OrderCreated
  (chain OrderRequested → OrderCreated → CommissionAccrued). e2e T1 проверяет линейность.
  Actor — SYSTEM (consumer-ная обработка, Step 1.15A).

## 45. SECURITY/PII

- CommissionAccrued/read DTO: refs + frozen money/policy provenance; НИКАКИХ passport/
  email/phone/card/банковских данных (e2e T1/T3 asserts). Payload-валидация OrderRequested
  не даёт forge снапшот/атрибуцию.

## 46. ISSUES FOUND (в ходе реализации)

1. **OrderCreated — result-event (PUBLISHED) не доставлялся подписчикам**: изначально
   CommissionAccrualConsumer подписался на OrderCreated, который по конвенции eventbus
   «пишется сразу PUBLISHED и не рассылается» → producer никогда бы не сработал.
2. **Nested publishPending из finally consumer-а задваивал доставку OrderRequested**:
   вложенный publishPending подхватывал всё ещё PENDING OrderRequested → повторная доставка
   всем handler-ам (attempts=2, deliveries=2 на первом failure) — сломало
   sale-completion-order-requested e2e 29-30.
3. **getCommissionByCode/getAccrualByCode бросали ConflictError (409) вместо NotFoundError (404)**
   для unknown code — несоответствие конвенции finance-сервисов.
4. (Тестовая инфраструктура) overlap-инвариант policy windows между тестами e2e — требовал
   архивирования политик; delta-подсчёты фактов для shared-DB.

## 47. FIXES APPLIED

1. OrderCreated эмитится `emit` (PENDING) атомарно с Order (order.service.createOrderFromRequested);
   eventbus-докстринг обновлён (result-events без потребителей — PUBLISHED; с потребителями — PENDING+доставка).
2. order-requested consumer: после УСПЕШНОГО коммита помечает источник OrderRequested PUBLISHED
   (updateMany where status=PENDING) и вызывает publishPending() — OrderCreated доставляется,
   OrderRequested не задваивается; failure consumer-а → без publishPending (attempts=1).
3. NotFoundError (404) для unknown Commission/Accrual codes.
4. e2e: архив политик между тестами, delta-counts, T5/T4/T8 assertion-ы по фактическому
   fail-closed поведению (NO_POLICY → ни snapshot, ни sellerPartnerId).

## 48. BACKEND REGRESSION

- `tsc --noEmit` ✓ · build ✓ · unit **596/596** (47 suites; +13 commission.service) ·
  serial e2e **1129/1129 (65 suites; +8 partner-collect T1–T8)** (--runInBand).

## 49. FRONTEND REGRESSION

- frontend `tsc --noEmit` ✓ (0 изменений frontend в этом шаге; read API — backend-only).

## 50. DB REGRESSION

- migrate **56/56** applied (dev + e2e fresh replay via harness `migrate deploy`), drift 0.
- Миграция аддитивная; e2e harness реплеит из миграций на свежей БД (fresh replay proof).

## 51. FILES CHANGED

- `backend/prisma/schema.prisma` (+commissionSnapshot на Quote/CheckoutIntent/Sale/Order,
  Order.sellerPartnerId, Commission.collectionModel+unique, CommissionAccrual.sourceCommissionId+
  accruedAt+unique, enum CommissionCollectionModel)
- `backend/prisma/migrations/20260814190000_add_partner_collect_commission_accrual/migration.sql` (new)
- `backend/src/eventbus/domain-events.ts` (CommissionAccrued payload + OrderRequested payload
  commissionSnapshot/sellerPartnerId)
- `backend/src/eventbus/eventbus.service.ts` (docstring: result vs dispatched events)
- `backend/src/modules/finance/commission.service.ts` (new — producer core + read)
- `backend/src/modules/finance/commission-accrual.consumer.ts` (new — OrderCreated consumer)
- `backend/src/modules/finance/commission.service.spec.ts` (new — unit 13)
- `backend/src/modules/finance/finance.controller.ts` (+4 read endpoints)
- `backend/src/modules/finance/finance.validation.ts` (validateCommissionSnapshot + list DTOs)
- `backend/src/modules/finance/finance.module.ts` / `backend/src/modules/sales/sales.module.ts`
  (CommissionService export/import)
- `backend/src/modules/sales/sales.contracts.ts` / `sales.service.ts` (freeze-цепочка)
- `backend/src/modules/order/order.service.ts` (персист snapshot/sellerPartnerId; emit PENDING)
- `backend/src/modules/order/order-requested.consumer.ts` (доставка OrderCreated)
- `backend/test/partner-collect-commission-accrual.e2e-spec.ts` (new — T1–T8)
- Docs: `docs/architecture/partner-collect-commission-accrual.md` (new), `docs/contracts/api.md`,
  `docs/contracts/events.md`, `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`.

## 52. DEFERRED SCOPE

- SPLIT_AT_PAYMENT (2.12C); Ledger posting (2.12D); Settlement/Payout (2.14A/B); Invoice (2.14);
  status-эволюция INVOICED/PAID/COLLECTED; периодизация accrual; refund/dispute adjustments
  (D11/D12); CommissionAccrued потребители (лента/аналитика); Policy history read endpoint (2.14F).

## 53. ARCHITECTURE DECISION STATUS

- ADR-0013 D9/D10/D14/D19 — реализованы без отклонений. Новых ADR не требуется.
- Step 2.14 ⛔ BLOCKED — сохраняется. 2.12C ⏳ NOT STARTED — сохраняется.

## 54. ROADMAP UPDATE

- Roadmap v3: **Step 2.12E → 🚧 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW**
  (строка 609, полный статус-блок). NEXT = STRICT REVIEW (отдельный промпт).

## 55. EXACT NEXT

**`PHASE 2 — STEP 2.12E — STRICT REVIEW`** (adversarial-аудит по образцу 2.14E:
имплементационный отчёт НЕ принимается на веру; проверка фактического кода, миграции,
RBAC, событий, docs, полная регрессия). НЕ начинается в этом проходе. 2.12C — после 2.12E.

## 56. FINAL CANONICAL STATEMENT

PARTNER_COLLECT commission: Quote ISSUE (MARKETPLACE channel) → детерминированный resolver
(2.14E policy) → frozen `commissionSnapshot` + `Order.sellerPartnerId` (verbatim
Checkout → Sale → Order) → на OrderCreated CommissionAccrualConsumer признаёт ровно один
`Commission` (CMS-*, PARTNER_COLLECT, ACCRUED) + ровно один `CommissionAccrual` (CAA-*,
ACCRUED, accruedAt) с amount = round_half_up(frozen Order.total × frozen rate) и публикует
`CommissionAccrued` (PII-free, causation chain). Fail-closed: нет commission-контекста /
нет seller / NO_POLICY / AMBIGUOUS / multi-seller → 0 фактов (НЕ «0%»). 0 live lookup,
0 side-effects, immutable факты, идемпотентность тройная (inbox + DB unique + P2002
констрейнт-специфично). Единственный writer — CommissionService. Финансовые факты — только
из frozen данных (ничего из mutable Catalog/PSP/UI).

---

# ADDENDUM — STRICT REVIEW (2026-08-15) — APPROVED WITH REVIEW FIXES

Отчёт strict review: `docs/prompts/PHASE_2_STEP_2.12E_PARTNER_COLLECT_COMMISSION_ACCRUAL_FOUNDATION_STRICT_REVIEW_REPORT.md`.

Review fixes (4):

1. **MEDIUM (validation)** — `validateCommissionSnapshot` принимал malformed `selectedAt`
   (не ISO) → битый provenance мог попасть в CommissionAccrued. Фикс: ISO 8601 проверка
   (fail-loud). Proving: unit `validateCommissionSnapshot({...snap, selectedAt: "not-a-date"})` throws.
2. **MEDIUM (raw 500)** — read API list: invalid `status`-фильтр кастовался в enum → Prisma
   enum validation error → 500. Фикс: `@IsEnum(CommissionStatus)` / `@IsEnum(CommissionAccrualStatus)`
   на list DTO → контролируемый 400. Proving: e2e T13 (`status=NOT_A_STATUS` → 400; `ACCRUED` → 200).
   Латентный тот же паттерн у Payment/Refund list DTO (pre-existing, вне scope 2.12E) — задокументирован.
3. **HIGH (e2e-infra, вскрыл реальную коллизию)** — fixture Order number в T8/T12 выводился из
   ORD-счётчика вместо TH-2026 sequence → коллизия уникальности `Order.number` при последующем
   каноническом создании (OrderRequested FAILED — вскрылось как «Order not found» в T9). Фикс:
   fixture-ы используют канонический `IdsService.nextCode/nextOrderNumber` (в транзакции).
4. **LOW (drift)** — `Order.sellerPartnerId` не имел `@@index` в schema.prisma при наличии
   `Order_sellerPartnerId_idx` в миграции → live→schema drift. Фикс: `@@index([sellerPartnerId])`.
   Proving: `prisma migrate diff` → No difference detected.

Review-тесты добавлены: e2e T9 (policy-after-freeze → frozen A), T10 (catalog-after-freeze →
frozen seller), T11 (multi-seller → 0 фактов), T12 (concurrent duplicate → 1 факт, 0 raw 500),
T13 (pagination/enum validation); T3 RBAC-матрица расширена (DIRECTOR/ANALYST read; PARTNER/
MODERATOR/MARKETER 403); T7 + Booking/Availability delta 0; unit +3 (half-cent 1.00×0.015=0.02,
zero-amount fail-loud, snapshot-матрица rate ≥1/0/7dp/negative-base/malformed-selectedAt/
policyVersion-0/empty-seller).

Регрессия после фиксов (факт): unit **598/598** · targeted EventBus e2e **122/122** (10 suites) ·
serial e2e **1134/1134 (65 suites)** · frontend tsc + vitest **135/135** + build · backend build ·
migrate **56/56** up-to-date · live→schema **drift 0**.
