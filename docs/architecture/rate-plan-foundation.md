# RATE PLAN FOUNDATION — Tariff → Canonical Rate Plan (Step 1.8B)

**Project:** TravelHub
**Phase:** 1
**Step:** 1.8B — TARIFF → CANONICAL RATE PLAN FOUNDATION
**Mode:** IMPLEMENTATION
**Status:** IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW (2026-08-12)
**Previous gate:** `UNIVERSAL PRICING MODEL AMENDMENT STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
**Canonical NEXT:** `PHASE 1 STEP 1.8B STRICT REVIEW`
**Canonical sources:** DD-024/DD-025 B/DD-026/DD-027/DD-029 (DECIDED), `docs/architecture/universal-pricing-model.md`, `docs/architecture/service-templates-decision-gates.md`, `docs/architecture/service-unit-foundation.md` (1.8A), ADR-0001 (owner-service), Roadmap v3 Step 1.8B.

---

## 1. Verdict

`PHASE 1 STEP 1.8B IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Tariff успешно расширен в **единственный canonical Rate Plan foundation** (DD-024: extend, не replace). Параллельный `RatePlan`-концепт НЕ создан. Никакого CommercialPeriod/calendar/resolver/availability (1.8C/1.8D). Полная регрессия зелёная.

---

## 2. Canonical commercial graph (1.8B слой)

```
Product
  └── ServiceUnit                        (1.8A — structure/identity, name verbatim)
        └── Tariff / Rate Plan           (1.8B — THIS: commercial offer/rules)
              └── CommercialPeriod       (1.8C — НЕ реализован)
                    └── resolved price   (1.8C — resolver НЕ реализован)
```

- **Tariff IS Rate Plan** — extend существующей модели, без второго концепта (DD-024 A).
- **ServiceUnit ≠ Rate Plan**: юнит — структура/identity (1.8A, без price/availability полей); Rate Plan — коммерческий offer (basis, currency, refundability, inclusions, restrictions, pricing mode).
- **Rate Plan ≠ CommercialPeriod**: Rate Plan — plan-level факты; периоды/правила (даты/сезоны/оверрайды) — 1.8C.
- **Product ≠ final price authority** при наличии ServiceUnits/Rate Plans (Universal §1).

---

## 3. Catalog ownership (hard gate)

Rate Plan остаётся в **`catalog.*`** (ADR-0001 owner-service). Существующий `Tariff` — owner-объект. Нет `sales.RatePlan` / `reverse.RatePlan` / `booking.RatePlan` / `order.RatePlan` / второго Catalog-агрегата. Никаких cross-domain writes. `ARCHITECTURE DECISION REQUIRED` НЕ возник (расширение безопасно, additive).

---

## 4. Schema extension (additive, legacy-safe)

| Поле | Тип | Семантика |
|---|---|---|
| `serviceUnitId` | `String?` (FK→ServiceUnit, onDelete: SetNull) | каноническая привязка к ServiceUnit (§6); NULL = legacy Product-only |
| `priceBasis` | `PriceBasis?` (enum) | одиночный семантический тег (§11); NULL = legacy |
| `refundability` | `Refundability?` (enum) | REFUNDABLE / NON_REFUNDABLE (§13); NULL = не заявлено |
| `pricingMode` | `RatePlanPricingMode @default(FIXED)` | FIXED / PRICE_ON_REQUEST — явное inquiry-only состояние (§17) |
| `status` | `RatePlanStatus @default(ACTIVE)` | ACTIVE / ARCHIVED — soft commercial state (§24) |
| `inclusions` | `Json?` | category-driven inclusions foundation (mealPlan/includedServices/...) (§15) |
| `restrictions` | `Json?` | restrictions metadata foundation (minStay/advanceBooking/...) (§16, enforcement 1.8D) |
| `updatedAt` | `DateTime @updatedAt @default(now())` | entity time (default — additive backfill legacy-строк) |
| `TariffHistory` | новая модель | audit by default (action/version/from/to/fields/actor) |

Легаси-поля **сохранены без переосмысления**: `price`/`currency`/`validFrom`/`validTo` остаются legacy/base price и booking/commercial validity window (Universal §17 STRICT REVIEW §50; §32 — НЕ stay-period, не переинтерпретировать).

---

## 5. ServiceUnit relation (Step 1.8B owns it)

- аддитивная, nullable (legacy Product-only тарифы остаются валидными — §23);
- **server-authoritative**: client ID не доверяется. Валидация на create/update:
  1. unit существует;
  2. `unit.productId == tariff.productId` (не cross-Product — §22);
  3. `unit.partnerId == product.partnerId` (один Seller/ownership scope — foreign unit → 422);
  4. unit НЕ ARCHIVED (ineligible attachment → 422);
- detach: явный `serviceUnitId: null` на update (legacy-safe, §8);
- не требуется destructive backfill; legacy тарифы не привязываются к юнитам «наугад».

---

## 6. Legacy Tariff compatibility

- `Tariff.price` остаётся **truthful base/FIXED price** (явно введённый Seller-факт, НЕ фабрикация — Universal §17);
- после 1.8C: при наличии применимых CommercialPeriod фактов authoritative — period price; иначе legacy price = base/FIXED fallback;
- никакой destructive migration, никакого переосмысления `validFrom/validTo`;
- legacy Product-only тарифы (без basis/unit/refundability) — валидны, читаемы, участвуют в Quote.

---

## 7. Seller-defined Rate Plan name

Verbatim (только trim; case/порядок слов/пунктуация НЕ нормализуются, не переводятся — §8). Максимум 200 символов; control-символы → 422. Примеры: `Room Only — Refundable`, `Breakfast Included — Non-refundable`, `Private Transfer`, `Premium Tour`, `Daily Flexible Rate`.

---

## 8. ID strategy

Существующий `TRF-*` — канонический бизнес-код Tariff/Rate Plan. **Второй RatePlan-префикс НЕ создан** (§9). ID authority — `IdsService.nextCode` (атомарный счётчик `events.BusinessSequence`), server-only. `docs/contracts/ids.md` — TRF-* уже зарегистрирован (без изменений).

---

## 9. Currency authority (DD-029)

- **одна canonical коммерческая валюта на Rate Plan** (hard invariant);
- ISO 4217 (3 заглавные буквы; trim+upper нормализация — как name trim);
- **immutable после создания** (смена валюты = новый Rate Plan): на PATCH `currency` — forbidden key → 422 (loud, не silent);
- CommercialPeriods (1.8C) наследуют валюту плана; display FX ≠ binding (не реализуется).

---

## 10. Price basis foundation

- **одиночный семантический тег** (`PriceBasis` enum), НЕ compound-строка (STRICT REVIEW §22): `PER_ROOM_PER_NIGHT` → basis=`PER_NIGHT` + quantity/duration dimensions (1.8C);
- category allowlist: `CategorySchema.tariffRules.allowedBases` (ACTIVE схема категории Product, §12). Правило:
  - basis НЕ обязателен (legacy-safe — §7/§8: legacy планы без basis валидны);
  - ЕСЛИ клиент задал basis И allowlist непустой → basis обязан быть member (category-incompatible → 422);
- `validateSchemaConfig` валидирует `allowedBases` (непустой массив валидных тегов) — CategorySchema владеет коммерческими правилами категории.

---

## 11. Refundability / Cancellation / Inclusions / Restrictions

- **Refundability** (§13): минимальная явная семантика `REFUNDABLE | NON_REFUNDABLE` (nullable); engine/политики — 1.8D; free-text НЕ определяет binding refundability.
- **Cancellation policy foundation** (§14): явный reference/engine НЕ создан (defer 1.8D); restrictions metadata — foundation.
- **Inclusions / meal plan** (§15): структурированные whitelist-ключи (`mealPlan`, `includedServices`, `includedMeals`, `amenities`, `notes`) — category-driven, НЕ hotel-only global; Seller display name остаётся в `name`.
- **Restrictions foundation** (§16): whitelist-ключи (`minStay`, `maxStay`, `advanceBookingDays`, `closedToArrival`, `closedToDeparture`, `occupancyRestriction`, `notes`); **enforcement — 1.8D**; НЕ в Availability counters; НЕ rules engine.

---

## 12. PRICE_ON_REQUEST foundation (§17 / Universal §9)

- `pricingMode = FIXED` (default) | `PRICE_ON_REQUEST` (явное inquiry-only состояние);
- **missing price ≠ PRICE_ON_REQUEST**: `price` NOT NULL (legacy-compatible); POR — типизированный режим, не inferred from null/zero;
- в POR-режиме `price` сохраняется как legacy/base (индикативный) — bindable-семантика определяется режимом, НЕ наличием цены;
- zero price = легитимная бесплатная услуга (различима от POR/missing);
- period-level inquiry-only (отдельные периоды) — 1.8C, НЕ блокирует 1.8B.

---

## 13. Base/FIXED price foundation (§18)

Простой Seller без периодов: один fixed price (legacy `Tariff.price`). `Sedan Transfer — 35 AZN per trip` НЕ требует CommercialPeriod. Fixed pricing НЕ конвертируется в искусственные daily periods.

---

## 14. Lifecycle & publication eligibility (§24/§25)

- **status**: ACTIVE/ARCHIVED (soft commercial state; НЕ moderation engine);
- **публикация НЕ отдельный lifecycle** — eligibility наследуется из родительской цепочки: Product PUBLISHED + ServiceUnit PUBLISHED (если attached). Документировано и переиспользовано (§24 — reuse parent publication constraints);
- **публично только ACTIVE планы**: public catalog (PDP/list/priceFrom SQL) фильтрует `status = 'ACTIVE'` — ARCHIVED скрыт;
- **eligibility unit (§42)**: план на ServiceUnit публичен только при unit `PUBLISHED` (DRAFT/ARCHIVED unit → план скрыт; единый publication engine 1.8A §15 — без второго lifecycle); unit-less legacy план публичен;
- **POR visibility (§22)**: PRICE_ON_REQUEST план ВИДИМ в PDP как inquiry-only offer (price:null, pricingMode в DTO) — visibility отделена от цены/bindability; НЕ входит в priceFrom/price-sort (priceFrom = min по ACTIVE+FIXED; только-POR продукт → priceFrom null, не 0, без fallback на POR-цену);
- archive/activate — `catalog.rate_plan.publish` (staff/ADMIN); idempotent no-op при том же состоянии; данные не удаляются (история/Quote-совместимость).

---

## 15. Mutability (§26)

Immutable: partner/product ownership, business code, currency, historical provenance.
Controlled mutable: name, price, serviceUnitId (attach/detach), priceBasis, refundability, pricingMode, inclusions, restrictions, validFrom/validTo.
Гейт: ARCHIVED immutable (409); PARTNER — только под СВОЙ DRAFT Product (коммерческие правки опубликованного контента — change proposal/модерация, конвенция «PARTNER правит draft»); staff/ADMIN — любые не-ARCHIVED. Downstream frozen Quote/Sale факты не мутируются (2.3/2.3A/2.4 freeze).

**Concurrency (STRICT REVIEW §39):** update использует атомарный conditional update по
`status` + **version-CAS** (`updateMany where { id, status≠ARCHIVED, version }` + count-check):
два параллельных PATCH с разными полями → ровно один успех, второй 409 (никакого
last-write-wins/lost-update). Sequential PATCH проходят (каждый перечитывает свежую
версию внутри tx). archive/activate — status-conditional + idempotent (без version-CAS,
переходы статуса и так атомарны).

**Delete-safety (STRICT REVIEW §52):** Rate Plan с аудит-историей (TariffHistory) не
удаляется физически — `TariffHistory.tariff` FK `ON DELETE RESTRICT` (DB-level) + явный
гейт `assertNoAuditedRatePlans` в legacy tariffs-replacement (Product PATCH `tariffs`,
publish change-proposal) → 409. Управление такими планами — Rate Plan API
(archive/activate/update). Legacy tariffs-replacement планов БЕЗ истории по-прежнему
может физически заменить Tariff: FK-less `QuoteItem.tariffId` (ADR-0001) остаётся
orphan-ссылкой — это **документированное pre-existing поведение** snapshot-дизайна Quote
(реквизиты КП заморожены в QuoteItem, Step 2.3), не регрессия 1.8B.

---

## 16. API surface (§27)

Минимум: create / list / get / update / history / archive / activate (см. `docs/contracts/api.md`). НЕТ pricing calendar / period pricing / public resolver endpoints (1.8C/1.8D).

---

## 17. RBAC (§28)

- PARTNER: create/list/get/update СВОИХ Rate Plans — reuse `catalog.product.*` own-scope (create_own / read_own / update_own_draft);
- staff/ADMIN: `catalog.product.write` / `catalog.product.read`; archive/activate — **новое** `catalog.rate_plan.publish` (документировано в `permissions.constants.ts`; отдельная commercial-state authority, как `catalog.service_unit.publish`);
- MODERATOR/BUYER — 403 (не moderation-объекты 1.8B).

---

## 18. Mass assignment (§29)

Forbidden keys (create/update, 422 loud — raw-body check, не срезанный ValidationPipe):
`id/code/productId/partnerId/sellerId/ownerId/status/version/createdAt/updatedAt/createdBy/updatedBy/actorId/actorName/schemaVersion/acquisitionSource/source/commercialPeriod(s)/periods/calendar/overrides/rules/resolver/availability/availabilitySlots/reservation/reservationIds/quoteId/saleId/checkoutId/orderId/bookingId/correlationId/causationId`; update дополнительно: `currency` (immutable).

---

## 19. Validation & money (§30/§31)

- name verbatim ≤200, no control-символы; currency ISO 4217; basis/refundability/pricingMode enums; price Decimal(12,2) неотрицательный ≤2 знака (0 — free); inclusions/restrictions whitelist; validFrom ≤ validTo (ISO);
- ServiceUnit consistency (product + ownership + not ARCHIVED); basis allowlist;
- **no JS float as canonical money**: `Prisma.Decimal`, сериализация `toFixed(2)` в API;
- 0 ≠ missing ≠ POR.

---

## 20. History / audit (§33)

`TariffHistory` (created/updated/archived/activated) + `SecurityService.audit` (`rate_plan.*`) без PII и без dump inclusions/restrictions (как 1.8A). Нет failed-action/duplicate no-op истории (idempotent archive/activate не пишут duplicate facts).

---

## 21. Events (§34)

**Событий нет** — нет consumer-ов (ProductCreated/Published/Archived — существующие Catalog events не расширялись). Никаких спекулятивных RatePlan событий.

---

## 22. Quote / Checkout / Sale / Reverse compatibility (§35-37)

- **Quote**: legacy flow зелёный (e2e #26) — Quote снапшотит tariff price как раньше; новые поля не ломают snapshot; Quote НЕ зависит от CommercialPeriod; binding semantics не менялись;
- **Checkout/Sale/OrderRequested**: не затронуты (никакого репрайса; freeze 2.3/2.3A/2.4);
- **Reverse**: SellerProposal остаётся non-binding; никаких Reverse writes в Rate Plans; capability ≠ Product/Unit/Tariff.

---

## 23. Migration & indexes (§39/§40)

- additive: новые колонки + enums + `TariffHistory` + FK `serviceUnitId` (SetNull) + indexes;
- `updatedAt` additive backfill (DEFAULT CURRENT_TIMESTAMP в миграции; @updatedAt поддерживает фактические обновления);
- legacy строки не переписываются; drift 0; clean replay;
- indexes: `[productId]` (legacy), `[serviceUnitId]`, `[status]`; `TariffHistory[tariffId]`. Без спекулятивных analytics-индексов.

---

## 24. Concurrency (§41)

Атомарные conditional updates по status (конвенция 1.8A §34/§35): update/archive/activate — `updateMany WHERE status != 'ARCHIVED'` (или == для activate) в одной tx; параллельный PATCH на ARCHIVED → 409; параллельные archive → ровно один реальный переход, один idempotent no-op; внутренние re-reads внутри tx (authoritative product status/ownership). Цена/режим конфликтов → последний применённый wins в пределах ACTIVE (без CAS-механизма, конвенция Catalog).

---

## 25. Cross-category validation (§38)

- **Hotel**: `Premium Double Ocean Side` + `Room Only — Refundable` / `Breakfast Included — Non-refundable` (PER_NIGHT, mealPlan inclusions);
- **Tour**: `Premium Tour Package` + Standard/Premium/Private (PER_PERSON / PACKAGE_TOTAL);
- **Transfer**: `Minivan` + `Private Transfer` (PER_TRIP);
- **Car Rental**: vehicle-class + per-day (PER_DAY);
- никаких hotel-only global полей; allowlist — category-driven через CategorySchema.

---

## 26. Out of scope (подтверждение §49)

1.8B STRICT REVIEW; 1.8C (CommercialPeriod/annual calendar/date overrides/DAW/occupancy rows/duration tiers/resolver); 1.8D (restrictions engine); multi-date holds; 2.8A; Partner Cabinet UI; import engine; supplier/API; dynamic pricing; FX; 2.6.

---

## 27. Tests

- unit: `rate-plan.validation.spec.ts` (name/currency/basis/refundability/pricingMode/Decimal/inclusions/restrictions/validity/forbidden keys) + `category-schema.validation.spec.ts` (allowedBases);
- e2e: `rate-plan.e2e-spec.ts` — 35 тестов, покрывающие §43 сценарии 1-34 (включая: verbatim name, server identity, foreign Product/ServiceUnit, legacy compat, fixed price без CommercialPeriod, POR явный, zero price, currency immutable, basis allowlist, refundability, inclusions, restrictions, no CommercialPeriod/calendar/availability/reservation/reverse/sales side effects, legacy Quote green, cross-category Hotel/Tour/Transfer/Car Rental, публичность ACTIVE + POR-видимость (§22), unit-eligibility (§42), legacy delete-safety (§52), lost-update CAS (§39), update-vs-archive concurrency + activate, детерминированная пагинация, additive миграция legacy-строк, RBAC);
- полная регрессия: 415 unit + 806 e2e + 135 frontend (vitest) + frontend tsc + build + migrate drift 0.

---

## 28. Exact files changed (Step 1.8B)

- `backend/prisma/schema.prisma` (enums + Tariff extension + TariffHistory + ServiceUnit.tariffs)
- `backend/prisma/migrations/<ts>_add_rate_plan_foundation/migration.sql`
- `backend/src/modules/catalog/rate-plan.validation.ts` (NEW)
- `backend/src/modules/catalog/rate-plan.validation.spec.ts` (NEW)
- `backend/src/modules/catalog/rate-plan.service.ts` (NEW)
- `backend/src/modules/catalog/rate-plans.controller.ts` (NEW)
- `backend/src/modules/catalog/catalog.module.ts`
- `backend/src/security/permissions.constants.ts` (`catalog.rate_plan.publish`)
- `backend/src/modules/catalog/category-schema.validation.ts` (allowedBases)
- `backend/src/modules/catalog/public/public-catalog.service.ts` (ACTIVE + FIXED-priceFrom + unit-eligibility + POR visibility)
- `backend/src/modules/catalog/catalog.service.ts` (priceFrom FIXED filter + §52 delete-gate)
- `backend/test/rate-plan.e2e-spec.ts` (NEW)
- `docs/architecture/rate-plan-foundation.md` (NEW — этот документ)
- `docs/contracts/api.md` (Rate Plan секция)

---

## 29. Roadmap

`Step 1.8B IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`; active item — `Step 1.8B STRICT REVIEW`. 1.8C НЕ начат.
