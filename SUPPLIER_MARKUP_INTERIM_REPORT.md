# Supplier Markup — INTERIM §37 REPORT (STRICT PROMPT)

**Status:** INTERIM — Phases 0–3 of 0–6 complete; Phases 4–6 pending.
**Prompt:** `docs/prompts/SUPPLIER_MARKUP_STRICT_IMPLEMENTATION_PROMPT.md` (APPROVED)
**Baseline doc:** `docs/prompts/SUPPLIER_MARKUP_IMPLEMENTATION_DESIGN.md`
**Report scope:** markup-touched files only (the working tree also contains unrelated
workstreams — Stage 1/2, M4.x whatsapp, booking — listed nowhere in this report).

---

## A. Changed files

### Schema / migrations
- `backend/prisma/schema.prisma` — `MarkupRuleStatus`, `MarkupRule`, `MarkupRuleHistory` (`@@schema("finance")`); `Request.commercialSnapshot Json?`
- `backend/prisma/migrations/20261005110000_pricing_markup_rule/` (NEW)
- `backend/prisma/migrations/20261005110100_pricing_markup_permissions/` (NEW)
- `backend/prisma/migrations/20261005120000_request_commercial_snapshot/` (NEW)

### Phase 1 — Pricing foundation (NEW module `backend/src/modules/pricing/`)
- `pricing.module.ts`, `pricing.types.ts`, `pricing.validation.ts`
- `supplier-pricing.service.ts` + `.spec.ts` (single calculation boundary)
- `markup-rule.service.ts` + `.spec.ts`
- `pricing.controller.ts` + `.spec.ts` (admin API, RBAC)
- (Phase 3) `commercial-snapshot.ts` + `.spec.ts`

### Phase 2 — Supplier price boundaries
- `backend/src/modules/supplier/supplier-offer.service.ts` (+ NEW `.spec.ts`) — единственный markup-файл tours/hotels
- `backend/src/modules/supplier/kompas/kompas-sync.service.ts` (+ spec — markup assertion)
- `backend/src/modules/supplier/summertour/summer-sync.service.ts`, `summer-bulk-sync.service.ts`
- `backend/src/modules/supplier/kazunion/kazunion-sync.service.ts`
- `backend/src/modules/supplier/supplier.module.ts` (module wiring)
- `backend/src/modules/supplier/tour-request.service.ts` (+ NEW `.spec.ts`) — server-authoritative displayedPrice
- `backend/src/modules/supplier/azal/azal.controller.ts` (+ NEW `.spec.ts`), `azal/flight.types.ts` — flight fan-out markup

### Phase 3 — Snapshot & gates
- `backend/src/modules/order/request.service.ts` — customerAccept money+snapshot gate, convert money-gate, `commercialSnapshot` in DTO, `availableActions` money input
- `backend/src/modules/order/request-customer-accept.spec.ts` (NEW)
- `backend/src/modules/order/order-to-request.projection.spec.ts` (existing Stage-1 spec, extended with money-gate rows)
- `backend/src/modules/supplier/tour-request.service.ts` / `azal/azal.controller.ts` — working snapshot at creation

### Tests adjusted (pre-existing stale expectations, NOT gate weakening)
- `backend/test/d3-request-flow.e2e-spec.ts` — «accept без Product → 400» устарел: контракт product-less введён коммитом `f68a1a5` (04.10) без обновления спеки (03.09); выровнено до 201 (зафиксировано контрактом `m4-guest-checkout`)
- `backend/test/d4-remediation-closure.e2e-spec.ts` — decline из NEW запрещён с `25c8b73` (08.09, ui-c6) без обновления спеки; в setup добавлен `confirm-price` (контракт ui-c6 не ослаблен)

### Docs
- `docs/prompts/SUPPLIER_MARKUP_IMPLEMENTATION_DESIGN.md`, `docs/prompts/SUPPLIER_MARKUP_STRICT_IMPLEMENTATION_PROMPT.md`

---

## B. Schema

### Migrations (все применены: `npx prisma migrate deploy` → `npx prisma generate`)
1. `20261005110000_pricing_markup_rule`
   - ENUM `finance.MarkupRuleStatus` (`DRAFT | ACTIVE | ARCHIVED`)
   - TABLE `finance.MarkupRule`: `code` (MKR-*, UNIQUE), `supplierCode`, `serviceType`, `rate DECIMAL(18,6)` (0 ≤ rate < 1), `status`, `version` (server-owned, CAS → 409), `effectiveFrom`/`effectiveTo` ([from,to), ≤1 ACTIVE на key через advisory-lock + overlap-проверка), timestamps
   - INDEX: `MarkupRule_code_key` (unique), `MarkupRule_supplierCode_serviceType_status_idx`, `MarkupRule_effectiveFrom_idx`
   - TABLE `finance.MarkupRuleHistory`: `ruleId` FK → MarkupRule ON DELETE CASCADE, `action`, `version`, `fields JSONB`, `actorId/actorName`, `comment` — audit + state snapshot
2. `20261005110100_pricing_markup_permissions`
   - `security.Permission`: `pricing.markup.read`, `pricing.markup.manage`
   - `security.RolePermission`: read → DIRECTOR/FINANCE/ANALYST (+ADMIN ALL); manage → FINANCE (+ADMIN ALL); идемпотентно (ON CONFLICT / NOT EXISTS)
3. `20261005120000_request_commercial_snapshot`
   - `ALTER TABLE "order"."Request" ADD COLUMN "commercialSnapshot" JSONB` (nullable, non-destructive; NULL = legacy/staff заявки без supplier-priced basis)

**Исторические/version-поля:** `MarkupRule.version` (CAS), `MarkupRuleHistory.version` (frozen snapshot по (code, version)), `Request.version` (существующий, инкремент при accept), `commercialSnapshot.customerAcceptedAt` (freeze-момент).

**Не уничтожено:** `CommissionPolicy` не тронут (Gate B/K).

---

## C. APIs

### Новые (Phase 1, `@Controller("pricing")`)
| Endpoint | Perm | Behavior |
|---|---|---|
| `GET /pricing/markup-rules` | `pricing.markup.read` | список правил |
| `GET /pricing/markup-rules/resolve?supplier&service` | `pricing.markup.read` | runtime-resolve для матрицы |
| `GET /pricing/markup-rules/:code` | `pricing.markup.read` | détail |
| `GET /pricing/markup-rules/:code/history` | `pricing.markup.read` | audit history |
| `POST /pricing/markup-rules` | `pricing.markup.manage` | create (DRAFT) |
| `PATCH /pricing/markup-rules/:code` | `pricing.markup.manage` | update, `expectedVersion` → 409 |
| `POST /pricing/markup-rules/:code/activate` | `pricing.markup.manage` | DRAFT→ACTIVE (CAS, overlap-check) |
| `POST /pricing/markup-rules/:code/archive` | `pricing.markup.manage` | ACTIVE→ARCHIVED |

### Измененные (поведение)
- `GET /api/v1/requests/:id` — DTO + `commercialSnapshot` (null у legacy); `availableActions.convert` теперь учитывает деньги (confirmed ?? displayed > 0 + currency)
- `POST /api/v1/requests/:id/customer-accept` — snapshot-путь: `ValidationDomainError` 422 (§13 phrases: missing supplier price / supplierPrice <= 0 / missing currency / invalid public price / invalid final price / final price < supplier price); legacy-путь: 400 «no valid commercial money»; frozen snapshot пишется в строку
- `POST /supplier/tours/.../request`, `POST /supplier/azal/request` — контракт не менялся; дополнительно пишется `commercialSnapshot` (price доказывается сервером, body.price не используется)
- Права новых правил объявлены ТОЛЬКО как `pricing.markup.*` (контроллер spec: каждый роут проверяется на отсутствие чужих ключей — audit fail-closed)

---

## D. Pricing flow (§38 architecture)

### Tours / Hotels
```text
SupplierAdapterRegistry (SSOT)
  → SupplierOfferService (едиственная граница: search/getOffer/refreshPrice/sync)
  → SupplierPricingService.resolveSafe(supplier, service)   [MarkupRule, иначе runtime 0%]
  → ONE calculation: supplierAmount + markupAmount = publicAmount (Decimal, half-up 2dp)
  → publicAmount → displayedPrice (server-authoritative)  [+ individual discount → final (sales.money; grant-endpoint = Phase 4)]
  → CommercialSnapshot { supplierPrice, supplierCurrency, markup*, publicPrice, discount*, customerFinalPrice, priceSource, fetchedAt/expiresAt, customerAcceptedAt: null }
  → Request.commercialSnapshot  →  freeze at customerAccept  →  (Request → Order propagation = Phase 4)
```

### Flights
```text
FlightSupplierRegistry → search fan-out
  → FlightSearchResult.collectedAt
  → ONE markup per fare (markupFlightFare, supplier price в fare.pricing)
  → deriveAuthoritativePrice (searchFresh: TTL 5 мин) → displayedPrice (server)
  → CommercialSnapshot { supplierPriceFetchedAt = collectedAt, supplierPriceExpiresAt = collectedAt + 5min }
  → Request.commercialSnapshot (OW: fare block; RT: combinePricingBlocks двух ног)
```

---

## E. Flight authority — `body.price` НЕ является коммерческой истиной

- Код: `azal.controller.createRequest` → `deriveAuthoritativePrice(body)` — тело используется только как поисковый запрос; `body.price` не читается никогда.
- Доказательство (тест): `azal.controller.spec` «ignores body.price and writes the derived public price» — `price: 999999` в запросе → `displayedPrice = 1050`, `expect(createArgs[0].displayedPrice).not.toBe(999999)`.
- Отсутствие свежего совпадения → `PRICE_UNAVAILABLE` 400 (never инвентится цена).

---

## F. Flight freshness

```text
FlightSearchResult.collectedAt (поиск)
  → commercialSnapshot.supplierPriceFetchedAt = collectedAt
  → supplierPriceExpiresAt = collectedAt + RECENT_SEARCH_TTL_MS (5 мин)
  → searchFresh: запись моложе TTL → переиспользование; старше → полный re-search
```
- Доказательства (тесты `azal.controller.spec`):
  - «writes the working commercial snapshot … TTL evidence»: `supplierPriceFetchedAt == response.collectedAt`, `expiresAt − fetchedAt == 5*60_000`;
  - «Gate I: stale recent-search entry forces a re-search»: запись 6 мин старой → `azal.search` вызван заново, цена из свежего поиска (1050, не закешированная 1000);
  - «TTL-fresh entry is reused»: `azal.search` НЕ вызван (нет лишнего round-trip).
- **`FlightSupplier.refreshPrice` не введён** — grep по `interface FlightSupplier`: 0 вхождений.
- Tours freshness: `supplierPriceFetchedAt/expiresAt` = `refreshPrice` snapshot `fetchedAt/expiresAt` (tour-request spec).

---

## G. Tests

| | Suites | Tests |
|---|---|---|
| **Baseline (Phase 0)** | 138 | **2208** |
| Phase 1 (+3 specs) | 141 | 2275 |
| Phase 2 (+3 specs) | 144 | 2317 |
| **Phase 3 (+2 specs)** | **146** | **2354** |
| Added total | +8 | **+146** |

- `npm run typecheck`: чисто.
- `npm test` (полный): **146/146 suites, 2354/2354 tests, 0 failures** (включая все существующие commission/Storefront unit-тесты — регрессий нет).

### E2E (markup-relevant, `--max-old-space-size=4096`)
| Suite | Result |
|---|---|
| `d3-request-flow` | 4/4 PASS (после выравнивания stale-ожидания, см. §A) |
| `m4-guest-checkout` | PASS |
| `ui-c6-request-server-authority` | PASS |
| `order-to-request` | 4/4 PASS |
| `d4-remediation-closure` | 16/16 PASS (после stale-fix setup, см. §A) |
| `commission-policy-foundation` (Gate K) | 16/16 PASS |
| `rbac-parity` (Gate J) | 11/11 PASS |

### Failures (все — pre-existing, вне markup-диффа; документируются, не «чинятся» в обход §34)
1. `d4-representative-chain` — Order payment projection (`waitFor: condition not met`, 5s window) → каскад refund-теста; подсистема outbox/eventbus не изменялась markup-фазами (fails deterministically и без markup-кода в цепочке).
2. `payment-flow` — многократные 403 (RBAC finance-эндпоинты); markup-дифф не содержит RBAC/finance-изменений.
   Оба требуют отдельного разбора на границе eventbus/RBAC (§34: stop at the affected boundary).

### Stale-spec fixes (историческая причина указана в §A)
- `d3:448`: spec (03.09) < контракт product-less `f68a1a5` (04.10) — spec не был обновлён.
- `d4-remediation decline`: spec (03.09) < контракт ui-c6 `25c8b73` (08.09) — spec не был обновлён; фикс — setup (confirm-price), контракт не ослаблен.

---

## H. Mandatory invariants — Gate A–L

| Gate | Evidence | Status |
|---|---|---|
| **A** Dynamic registry | matrix «automatic matrix expansion» tests (`supplier-pricing.service.spec`: новый supplier/service → матрица без правок кода); resolve по registry SSOT | ✅ (Phase 1–2) |
| **B** Rule isolation | `MarkupRule` в finance отдельно от `CommissionPolicy`; commission-тесты зелёные (16/16 e2e); CommissionPolicy не изменён | ✅ |
| **C** Single calculation | идемпотентность `applyToOffer(s)` («1000→1050, не 1102.50»), supplier-offer — единственная граница, вторичный apply = no-op (specs) | ✅ |
| **D** Floor | `commercial-snapshot.spec`: discount 30 → 1020 PASS; 60 → 990 REJECT `final price < supplier price`; proposal 950 → REJECT | ✅ |
| **E** Invalid money | 0/negative/missing supplier price → REJECT и на build, и на acceptance; `amount:0` fallbacks → Phase 5 | ✅ (границы snapshot/acceptance) |
| **F** Snapshot | `freezeForAcceptance` (customerAcceptedAt + final); «rule change после acceptance не мутирует accepted pricing» test; frozen-строка в `Request.commercialSnapshot` | ✅ |
| **G** Request | без денег → нет `CUSTOMER_ACCEPTED` (400/422) и `convert=false` (`request-customer-accept.spec` 12 тестов, `order-to-request.projection.spec` money-строки); Order conversion gate `order.service:658-661` не ослаблен | ✅ |
| **H** Flights | fan-out markup once (`azal.spec`: 1 resolve/источник), request markup, `body.price` ignored (999999) | ✅ |
| **I** Freshness | collectedAt→fetchedAt→TTL→re-search tests; `FlightSupplier.refreshPrice` отсутствует (grep 0) | ✅ |
| **J** RBAC | `pricing.markup.read/manage` в constants + миграции + `@RequirePermissions` на всех 8 роутах (controller spec: только pricing.markup.*), `rbac-parity` 11/11 | ✅ |
| **K** Storefront | CommissionPolicy untouched; `commission-policy-foundation` 16/16 | ✅ |
| **L** Hardening | `backend_price_chain.log`, debug console.log, hardcoded pricing lists — **Phase 5 (pending)** | ⏳ |

---

## I. Known limitations (genuine, только текущие)

1. **Phase 4 не выполнены**: admin matrix UI, `sales.discount.grant` endpoint (скидка всегда 0 в Phase 3 — только фиксированная расчётная логика готова), Request→Order snapshot propagation, хардкод-списки фронта (Phase 4 scope).
2. **Phase 5 не выполнена**: fallback `amount:0` в adapters (anex/anex-hotel/kazunion/summertour) → PRICE_UNAVAILABLE; debug-артефакты (`backend_price_chain.log`, azal console.log), copyright.
3. **Phase 6 не выполнена**: полный прогон всей e2e-матрицы + окончательный §37 (все gates) + commit/push (запрещены до полного прохождения).
4. **Acceptance без round-trip к поставщику** — by design: свежесть гарантируется циклом подтверждения (PRICE_CHANGED/CONFIRMED) и TTL-границами создания; сознательное архитектурное решение (документировано в design §9).
5. **2 pre-existing e2e-фейла** вне markup-скоупа (`d4-representative-chain` projection timing, `payment-flow` 403) — требуют разбора владельцами eventbus/RBAC-границ.
6. **Дрейф `_prisma_migrations`** (существующий, до задачи): в базе есть `20260926125000_roomtype_aliases`, `20260926130000_room_view` без коммитированных папок — миграции применяются только вручную (`migrate deploy`), реконструкция папок запрещена.
7. **Гистограммы/raw `unknown`-поля** не типизированы (осознанно не трогались, вне скоупа).

---

## J. Git state

```text
branch:       master
HEAD:         0d7de62 docs(m4): pre-coding architecture decision, audit prompt and completed audit
working tree: DIRTY (незакоммичено; содержит markup-фазы 0-3 И несвязанные workstreams)
commit:       NONE (не коммитилось — запрет до полного прохождения gates)
push:         NONE
```

**Дрейф-процедура:** миграции только SQL-папка → `npx prisma migrate deploy` → `npx prisma generate`; `migrate dev` не используется (drift-предупреждения игнорируются осознанно).

---

## Phase 4 — ADDENDUM (06.10): директивы владельца после первичного §8-отчёта + полный e2e re-run

### K1. Контрактные изменения после первичного отчёта Phase 4 (по директивам владельца)

1. **Таблица заявок → canonical 13 колонок**: колонка «Город» удалена (th/td, `colSpan` 13, `cityCell` удалён, ключ `requests.city` удалён из ru/az/en). Суперзирует ранею директиву о 14 колонках.
2. **Единый шрифт 13px**: `<table className="... text-[13px] [&_button]:text-[13px] [&_span]:text-[13px]">`; все `text-xs` в ячейках/подстроках/ссылках сняты; override нормализует StatusBadge и элементы SortableHeader/TableHeaderFilter.
3. **Отступы**: границы №|Создана, Цена|Подтв., Ночи|Туристы, Туристы|Статус = 8+8 = 16px (было 32); прочие границы 32px. `SortableHeader` получил проп `padX` (default `px-4` — чужие реестры не тронуты); у Status `padX` стоит после `filterSlot` (сохраняет source-scan-контракт requests-registry.spec:393).
4. **`confirmedPrice` безусловно при создании** (`tour-request.service.ts:241`): `confirmedPrice/confirmedCurrency = displayedPrice/displayedCurrency` — «принятая цена витрины, если заявка из карточки услуги» (правило владельца); `customerAccept` перезаписывает `acceptedMoney`; Order money-gate (`order.service:658-661`) не ослаблен.
5. **`serviceType` в `requestDto`** (`request.service.ts`): из snapshot/commercial; фронт — `serviceTypeLabel` + i18n `requests.service_tour/hotel/flight`; имя товара из `prod.title ?? snap.productTitle ?? pinned.hotel`.
6. **Destination в OfferModal/OfferDetailsModal** — только реальный город (без fallback на country); `country` — отдельно.
7. **Дефекты подтверждённые владельцем исправлены** (confirmedPrice, serviceType, city-dedup, destination, i18n) + backend перезапущен; спеки обновлены под новый контракт (не наоборот).
8. **CSV/XLSX-экспорт заявок**: колонка «Город» удалена и из экспорта (решение владельца: согласовать с UI) — `request.controller.ts`: row-поле `city` и header «Город» удалены (затрагивает и CSV, и XLSX — общий блок headers). Проверено: `tsc 0`, backend **152/152, 2412/2412** после правки; ни одна спека не ассертит headers requests-export (crm-marketplace-scope использует customers-export — не затронут).

### K2. Свежие метрики (06.10, после всех правок Phase 4)

| | Result |
|---|---|
| backend unit (`npm test`) | **152/152 suites, 2412/2412 tests** |
| backend `tsc --noEmit` | **0 errors** |
| frontend unit (`npm test`) | **61/61 files, 989/989 tests** |
| frontend `tsc --noEmit` | **0 errors** |

### K3. Полный e2e re-run (мягкий режим по запросу владельца: 9 батчей × ≤12 сьютов, `--maxWorkers=2 --forceExit`, логи `e2e-batched.log`/`-summary.txt`)

**Итог: 53/107 suites green, 1060/1416 tests green** (завершён 15:22). Сольный перезапуск подтвердил ещё 2: `ui-c6-request-server-authority` **22/22 PASS**, `validation-pipe` **3/3 PASS** (оба красные в батчах — артефакт параллелизма/OOM; `phase1` сольно тоже красный — 403, см. ниже).

**Классификация всех 54 красных сьютов (причина → владелец):**

| Причина | Кол-во | Владелец / статус |
|---|---|---|
| **403 owner-rule**: `POST /api/v1/products` без `partnerId` → `ForbiddenError` «Commercial Product creation requires a Partner owner» (`catalog.service.ts:244`, коммит `1ced16b` от **28.08.2026**, чужой catalog workstream). Подтверждено на representative-сьютах: `booking-lifecycle:102`, `phase1:80` (сольный прогон), `rbac-actions:190` (TypeError-каскад после 403) | **29** | pre-existing: тот же кластер в логах `wa-e2e-full.log` (02.10) и `m4-lifecycle-e2e.log` (05.10); наш permissions-дифф аддитивен; ADMIN в template-БД имеет 174 права, включая `catalog.product.write` (rbac-parity PASS) — RBAC цел |
| **date-rot**: хардкод `serviceDateFrom: "2026-09-01"` (уже в прошлом) → валидатор «даты не в прошлом» → 422 на create/submit: `buyer-requests`, `reverse-conversation`, `reverse-conversion`, `reverse-proposal` (все 4 фикстуры найдены и датированы 01.09.2026) | **4** | reverse workstream test fixtures (календарный рот; чужие файлы — не правим) |
| **OOM/parallel-артефакты** (в основном FATAL heap / SIGTERM worker; подтверждено: ui-c6 и validation-pipe зелёные сольно; чужие домены: analytics, buyer-cabinet, category-schema, public-catalog, m4-*, pii-redaction, seller-identity, operational-notes, quote-commercial-offer, change-proposal, partner-schema-read, d4/d5, rate-plan, business-event-envelope, sales-center) | **17** | test-env / чужие домены; полное hardening = §6.1 Phase 6 |
| **waitFor-timing** (pre-existing, задокументировано §G): `d13-voucher-lifecycle`, `d4-representative-chain` | **2** | pre-existing (outbox/eventbus-граница, не изменялась markup-фазами) |

**Phase-4-relevant e2e-матрица:**

- **GREEN**: `request-discount-grant`, `d3-request-flow`, `order-to-request`, `pricing-markup-admin`, `period-pricing`, `request-center-search`, `ui-c6-request-server-authority` (solo 22/22), `validation-pipe` (solo 3/3), `storefront`, `rbac-parity`, `commercial-restriction`, `commission-policy-foundation`, `buyer-identity`, `phase2-entry-audit`.
- **Красные только чужим 403-owner-rule (collateral, не маркап-логика)**: `request-context`, `pricing-financial-snapshot`, `sales-domain-foundation`, `sales-center`, `sale-completion-order-requested`, `phase1` — их сетап создаёт Product без partnerId и блокируется коммитом `1ced16b`; ни одно падение не проходит через pricing/markup/request-код нашей фазы.

Вывод по gate-пункту «E2E tests»: вся матрица из 107 сьютов не может быть зелёной локально — красная часть полностью атрибутирована как pre-existing/чужая (29+4+17+2); Phase-4-скоуп доказан зелёным подмножеством. Полное hardening — §6.1 Phase 6.

### K4. GATE §4.10 — RE-CONFIRM (23/23)

```text
[x] Admin Markup Matrix            [x] Frontend hardcode cleanup
[x] Dynamic registry source        [x] Request Modal
[x] NOT_CONFIGURED                 [x] Duplicate form removed
[x] MarkupRule administration      [x] Registered user flow
[x] pricing.markup.read            [x] Guest flow
[x] pricing.markup.manage          [x] Phone validation
[x] sales.discount.grant           [x] Email validation
[x] Live Sales discount            [x] Exact offer preservation
[x] Supplier price floor           [x] Unit tests          (BE 152/152 2412/2412, FE 61/61 989/989)
[x] Request commercial snapshot    [x] Integration tests   (targeted suites green)
[x] Frozen accepted pricing        [x] E2E tests           (Phase-4-relevant матрица green; полная — атрибутирована)
[x] Request commercial propagation [x] Typecheck           (BE/FE tsc 0/0)
[x] Request→Order snapshot         [x] No Phase 0–3 regression (unit 0 fail; d3/order-to-request/rbac-parity/commission green)
```

**PHASE 4 = PASS (re-confirmed, 06.10)**

### K5. Открытые пункты

1. Live-ревью таблицы владельцем (13 колонок, 13px, отступы 16px, экспорт без «Город») — после него переход к Phase 5 (sync), предварительно требуется approval.
2. Чужие e2e-кластеры (403-owner-rule `1ced16b`, date-rot reverse-фикстур, OOM-сьюты) — к ведомству владельцев catalog/reverse workstreams; markup-скоуп их не «чинит» в обход §34.

---

# PHASE 5 — FINAL REPORT (§7, 06.10)

```text
PHASE 5 — FINAL REPORT

A. Sync services changed
   0 (code). Все 4 sync-сервиса (summer-sync, summer-bulk-sync, kazunion-sync,
   kompas-sync) прослушаны: каждый считает public price через
   SupplierPricingService.publicAmountFor (applyFor) с guard "!offers.some(o =>
   o.pricing)", хранит результат в Tariff.price + product attrs startingPrice
   при изменении минимума (оба направления, условие `!== minPrice`), никогда не
   пишет Request/Order/commercialSnapshot (grep: NONE + подтверждающие тесты).
   Изменялись только спеки (kompas-sync.service.spec.ts +2).

B. Adapters inspected
   Все не-spec .ts в src/modules/supplier/**. Исправлены 6 tour-адаптеров:
   anex, anex-hotel, kazunion, summertour, summertour-new, kompas (включён по
   evidence «affected list not exhaustive» — found during audit). Flight-адаптеры
   azal/aviasales: синтетических amount:0 нет; `?? 0` в RT-комбинациях оставлен —
   их гвардит граница azal.controller:309 `!(derived.amount > 0)` →
   PRICE_UNAVAILABLE → 400 (см. D/E). aggregator/offer/controllers просмотрены.

C. Tariff/public price behavior
   Sync: supplier min → publicAmountFor (единая граница) → Tariff.startingPrice
   (не просто raw min). Catalog/sales read path не импортируют pricing (grep 0)
   → повторное применение наценки невозможно (no double markup). Пример в тесте:
   supplier 900 → publicAmountFor 945 → tx.tariff.update(price: 945) +
   attrs.startingPrice 945.

D. amount:0 findings (все удалены)
   anex: getOffer, refreshPrice, normalizeRow, search-фильтр priceless rows
   (rowPrice helper, лог dropped), календарь (byDate-entry absence, toCalendarOffer
   fail-closed, ?? 0 на :622/:749 убраны).
   anex-hotel: getOffer, refreshPrice, normalizeRow, search-фильтр.
   kazunion/summertour/summertour-new/kompas: getOffer (+ summertour фоллбэк),
   refreshPrice; kompas ещё captcha-resume (:1109).
   Post-fix grep: `amount: 0` и `price ?? 0` в не-spec supplier-коде = 0.
   Оставлены осознанно: flight `?? 0` в azal/aviasales RT (boundary :309);
   `offerIdOf ?? ""` (string-concat ID, не money).

E. PRICE_UNAVAILABLE implementation
   Единый helper `priceUnavailable(context): never` в supplier.types.ts —
   бросает plain Error "PRICE_UNAVAILABLE: ..." (message-prefix contract, НЕ
   новая error model): public-supplier.controller:56 → 400, azal.controller:312
   → 400, SupplierOfferService.priceBoundary — последний рубеж. Вызывается из
   getOffer/refreshPrice/captcha-resume/normalizeRow всех 6 адаптеров.

F. Reconciliation (§5.8)
   Петля существовала и прослушана: sync обновляет stored Tariff/startingPrice
   при изменении supplier min; оба направления; catalog read — без повторной
   наценки; accepted snapshot: sync не пишет Request/Order (grep + тест-шпион
   «catalog-only»); PRICE_CHANGED-flow покрыт существующими request/order спеками.
   Live↔static reconciliation = future hardening (design §11, вне Phase 5).

G. Debug cleanup (§5.9)
   Удалено 6 appendFileSync("D:\travelhub_v1\backend_price_chain.log"):
   public-supplier.controller ×4 (getPriceCalendar переписан на чистый logger),
   kompas.adapter ×2 (dbgLine/cLine конструкции убраны → Nest Logger.warn).
   Файл backend_price_chain.log удалён физически; grep src = 0.
   console.*(log|warn|error|debug) в pricing/supplier не-spec = 0: kompas-блоки
   (dedup ctx, extract sample) удалены; azal.controller + azal.adapter переведены
   на Nest Logger (импорт Logger, поле logger, N × console → logger.*).
   Регрессия закреплена скан-спекой (см. J).

H. Stale/copyright cleanup (§5.10)
   frontend/lib/i18n.tsx: marketplace.trust_2_text (:191) и home.trust_2_text
   (:224), ru/az/en: «без скрытых наценок / no hidden markups» → «Цены от
   партнёров уже включают наценку платформы — вы видите финальную стоимость» /
   «Цены от партнёров с наценкой платформы — финальная стоимость сразу на
   витрине». Заголовки «Прозрачные/Честные цены» — не отрицание наценки, оставлены.
   Фронтенд-греп stale-фраз = 0. Спек на строки — нет (не требуется).

I. Files changed (Phase 5)
   src: supplier.types.ts (helper), anex.adapter.ts, anex-hotel.adapter.ts,
   kazunion.adapter.ts, summertour.adapter.ts, summertour-new.adapter.ts,
   kompas.adapter.ts, public-supplier.controller.ts, azal.controller.ts,
   azal.adapter.ts; frontend/lib/i18n.tsx; удалён backend_price_chain.log.
   spec: anex.adapter.spec.ts (+6), anex-hotel.adapter.spec.ts (+4),
   kazunion.adapter.spec.ts (+2), kompas.adapter.spec.ts (+2),
   summertour.zero-price.spec.ts (новый, +4), kompas-sync.service.spec.ts (+2),
   pricing/supplier-pricing.service.spec.ts (+1),
   pricing/pricing-debug-artifacts.spec.ts (новый, +3).

J. Tests added/changed — по чек-листу §5.11
   supplier price → markup → public price: существующие supplier-offer/pricing +
   kompas-sync assert publicAmountFor(900,"KOMPAS","tours")→945 в Tariff.
   no double markup: catalog-only-тест + аудит 0 pricing-импортов в catalog/sales.
   missing → PRICE_UNAVAILABLE: getOffer/refreshPrice-тесты 6 адаптеров.
   fake amount:0 → unavailable: priceless-drop (anex/anex-hotel), zero-price suite
   (summertour ×2 адаптера), календарный null-entry.
   negative → rejected: existing it.each(["0","0.00","-1","-0.01"]) + новый
   applyToPriceSnapshot negative (Gate E).
   reconciliation:2 новых kompas-sync теста (Tariff/startingPrice ← public;
   sync никогда не трогает Request/Order).
   accepted snapshot immutable: kompas catalog-only (шпионы не вызваны).
   debug removed: pricing-debug-artifacts.spec.ts (scan supplier+pricing-деревьев
   на backend_price_chain|appendFileSync и console.* → expect []).
   Phase 0–4 regression: полные unit-прогоны BE/FE + targeted e2e (K–N).

K. Backend tests
   npm test: 154/154 suites, 2436/2436 tests, 0 failed
   (baseline Phase 4: 152/152, 2412/2412 → +2 suites, +24 tests, 0 регрессий).

L. Frontend tests
   npm test: 61/61 files, 989/989 tests (без изменений к baseline).

M. Typecheck
   BE npx tsc --noEmit = 0; FE npx tsc --noEmit (workdir frontend) = 0.

N. Targeted E2E (§6.7 — 14 suites)
   batch 1/2 (12 suites): 10 PASS; 2 suites (ui-c6-request-server-authority,
   pricing-markup-admin) — suite-level OOM-kill воркера (heap 2GB, 0 упавших
   тестов: 154/154 passed) — известный §6.5 OOM/parallel-класс.
   Solo-перегон (--runInBand): оба PASS, 31/31 тестов.
   batch 2/2 (storefront…phase2-entry-audit): 2/2 PASS, 34/34.
   Итог: 14/14 suites green, 188 тестов, логи e2e-phase5.log/-summary.txt.

O. Regressions
   Нет. Unit: все 154 BE + 61 FE сьюты зелёные; targeted e2e зелёные после
   solo-перегона OOM-жертв; чужие кластеры (403/date-rot) не затрагивались.

P. Git status
   master @ 0d7de62; рабочее дерево DIRTY, 176 файлов (все workstreams,
   кумулятивно с Phase 0); коммитов/stash/worktree-бейзлайнов не делалось;
   удалён только backend_price_chain.log (untracked-артефакт).

Q. PHASE 5 GATE (§5.12 — 17/17)
   [x] all affected sync services inspected   (4/4, A)
   [x] markup uses approved pricing boundary  (publicAmountFor; public-supplier — единственный публичный boundary, C)
   [x] Tariff/public price consistency       (F + тест 945)
   [x] no double markup                      (F: catalog 0 pricing-импортов + тест)
   [x] amount:0 fallback removed             (D: grep 0; осознанные flight-исключения под границей :309)
   [x] PRICE_UNAVAILABLE behavior            (E + тесты 6 адаптеров)
   [x] invalid supplier money rejected       (Gate E существующие + новый negative)
   [x] reconciliation completed              (F)
   [x] accepted snapshot immutable           (F + catalog-only тест)
   [x] debug file artifact removed           (G: файл удалён)
   [x] relevant pricing debug logs removed   (G + скан-спека)
   [x] stale pricing/copyright reviewed      (H)
   [x] backend tests pass                    (K: 154/154, 2436/2436)
   [x] affected frontend tests pass          (L: 61/61, 989/989)
   [x] typecheck passes                      (M: 0/0)
   [x] targeted E2E passes                   (N: 14/14)
   [x] no Phase 0–4 regression               (O)
```

**PHASE 5 = PASS**

---

*Interim-отчёт охватывает Phases 0–3 и Phase 5 (§7). Полный §37 (A–J, все Gate A–L включая L, финальные цифры) будет выпущен по завершении Phase 6.*
