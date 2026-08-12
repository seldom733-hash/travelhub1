# Commercial Restrictions / Overrides Foundation (Phase 1 — Step 1.8D)

Статус: **IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW** (2026-08-12).
Owner: **Catalog** (`catalog.*`). ID prefix: `CRS-` (см. `docs/contracts/ids.md`).

---

## 1. Owner / domain position

Канонический коммерческий граф:

```
Product → ServiceUnit → Tariff/Rate Plan → CommercialPeriod → CommercialRestriction
```

Ограничения — **Catalog-owned**. Sales/Order/Booking/Reverse/Communication/Finance
никаких mutable commercial facts не пишут. Cross-domain reads — только по
существующим ADR (Quote читает Catalog через `resolveEligibleTariff`, read-only).

## 2. Entity / model choice (authoritative restriction model)

Один authority на каждом уровне (НЕ два конкурирующих engine):

| Уровень | Факт | Хранится в |
|---|---|---|
| BASE | base-ограничения Rate Plan (minStay/maxStay/advanceBookingDays/closedToArrival/closedToDeparture) | `Tariff.restrictions` (1.8B, whitelist-валидированные) |
| PERIOD | override, привязанный к конкретному CommercialPeriod | `catalog.CommercialRestriction` (scope=PERIOD, `commercialPeriodId`) |
| DATE | override на точную сервисную дату | `catalog.CommercialRestriction` (scope=DATE, `startDate==endDate`) |

`CommercialRestriction` (CRS-*): `scope`, `commercialPeriodId?`, `startDate?/endDate?`,
`type`, `value?`, soft `status ACTIVE/ARCHIVED`, `version` (CAS),
`CommercialRestrictionHistory` (ON DELETE RESTRICT — delete-safety).
Indexes: `(tariffId,status)`, `(commercialPeriodId)`, `(type,status)`.

### Reconciliation `Tariff.restrictions`

- **Остаётся authoritative BASE-фактом** (роль: base restriction facts Rate Plan).
- Новый entity — только scoped overrides (PERIOD/DATE). `TARIFF`-scope в entity
  **не существует** (validation → 422) — дублирование authority на уровне невозможно.
- Legacy rows (1.8B) интерпретируются как base-факты (whitelist уже валидирован);
  migration/backfill **не требуется** (additive).
- Unsupported/unknown restriction key: whitelist-валидация 1.8B уже отклоняет
  unknown keys (422); категорийный гейт (DD-028) отклоняет unsupported dimension.
- Дублирование authority предотвращено: один уровень = один источник; same-tier
  duplicate restriction → 422 на write.

## 3. Supported restriction types (минимум, §5)

- `STOP_SELL` — DATE-scope only (периодный stop-sell = `CommercialPeriod.sellable`,
  1.8C authority — не дублируется). Не удаляет Tariff/Period/price/Availability.
- `MIN_STAY` — минимальная длительность (service-days, value 1..365; категория
  проецирует label как «ночи» для accommodation). Base `maxStay` enforcement —
  тоже (base-факт).
- `ADVANCE_BOOKING` — минимальный lead time (date-only UTC, value 0..365;
  `serviceDate >= today + N`, inclusive).
- `CLOSED_TO_ARRIVAL` — запрет заезда/начала (presence; CTA проверяет **start**).
- `CLOSED_TO_DEPARTURE` — запрет выезда/окончания (presence; CTD проверяет
  **end** = `start + durationDays - 1`; требует durationDays — fail-closed).

## 4. Category support (DD-028)

`CategorySchema.tariffRules.allowedRestrictions` (additive, optional):
- необъявленный/пустой allowlist = все типы разрешены (legacy-safe);
- объявленный непустой — только member-типы; unsupported dimension → 422
  (fail loudly) на: create/update `CommercialRestriction`, create/update base
  `Tariff.restrictions` metadata;
- Reverse Marketplace остаётся consumer, не owner.

**Default = all types (STRICT REVIEW §18).** Канонический прецедент — 1.8B
`allowedBases`: «если allowlist задан непустым — member обязателен; если
категория не ограничивает — допустимо» (legacy-safe additive capability
declaration). Обратный дефолт (none) сломал бы существующие категории/данные
и потребовал бы массового backfill. Категории, которые хотят сузить, объявляют
`allowedRestrictions` (e2e: tour/transfer с узким списком — MIN_STAY/CTA/CTD → 422).

## 5. Scope model

Механически тестируемый: `DATE` (одна дата) | `PERIOD` (привязка к периоду).
Специфичность НЕ из `createdAt`/порядка строк/insertion order — tier:
`DATE (1) > PERIOD-attached к resolved period 1.8C (2) > BASE (3)`.
PERIOD-scope специфичность наследуется от периода-победителя 1.8C (своя не
вводится): цена и ограничения не могут разойтись.

## 6. Deterministic precedence & ambiguity

- Tier precedence: DATE > PERIOD > BASE.
- Same-tier contradiction → 422 на write:
  - DATE: две DATE-строки одного типа на одну дату;
  - PERIOD: две PERIOD-строки одного типа на один период;
  - MIN_STAY override > base maxStay → 422 (противоречивый диапазон).
- Меж-tier конфликт — НЕ конфликт (это override по design).
- Runtime ambiguity → fail-closed (см. §8): min-stay/CTD без durationDays → 422.

## 7. Server resolver/evaluator

`src/modules/catalog/restriction-evaluation.ts` — чистая функция
`evaluateRestrictions({serviceDate, durationDays, base, resolvedPeriod, rows})`:
- получает **победителя периода 1.8C** (или null → base pricing);
- ACTIVE rows передаёт caller (архивные фильтрует query);
- возвращает `{sellable, blockedReason, applied[], minStay, maxStay,
  advanceBookingDays, closedToArrival, closedToDeparture}` — explainable
  provenance (applied = winning facts: {type, value, source, code}).

Sales (`resolveEligibleTariff`, pre-binding только) вызывает evaluator;
non-sellable → 422 с reason. **После Quote ISSUE (binding) никакого re-read**
текущего Catalog (1.8C §44 freeze сохранён — post-binding re-verification НЕ
введена).

## 7A. Explicit override / relaxation semantics (STRICT REVIEW §21)

Точная семантика «override» в canonical наборе 1.8D:
- **Numeric факты** (MIN_STAY, ADVANCE_BOOKING): более специфичный tier
  ЗАМЕНЯЕТ значение нижележащего (DATE > PERIOD > BASE) — в обе стороны
  (может ужесточить и ослабить base). Пример: base minStay=1, DATE minStay=5 —
  строже; DATE minStay=1 при base 5 — слабее (явное ослабление выразимо).
- **Presence факты** (CLOSED_TO_ARRIVAL/CLOSED_TO_DEPARTURE/STOP_SELL):
  более специфичный tier может только ДОБАВИТЬ блок; отрицательный
  (negative/unset) override — открыть дату при base-closed — в canonical наборе
  1.8D НЕ выразим (Roadmap/Universal такой семантики не определяют).
  BASE CTA=true блокирует все заезды; scoped CTA может лишь добавить блоки.
  Это зафиксировано как **extension point** (будущий `CLOSED_*_EXCEPT` тип),
  а не скрытое поведение. Модель корректно называется «scoped override» для
  numeric-фактов и «scoped restriction addition» для presence-фактов.
- Периодный stop-sell (`CommercialPeriod.sellable=false`) — authoritative для
  своего диапазона; DATE STOP_SELL может заблокировать даты внутри sellable
  периода, но НЕ может «открыть» stop-sold период (reopen не определён канонически).

## 8. Fail-closed правила

- `serviceDate < today` → `past_date`;
- `minStay > 1` без `durationDays` → `min_stay_requires_duration`;
- CTD активен (base/period/date) без `durationDays` → `closed_to_departure_requires_duration`;
- reason-приоритет (первый reason): `date_stop_sell/period_stop_sell` >
  `advance_booking` > `closed_to_arrival` > `closed_to_departure*` > `min_stay*/max_stay`.

## 9. Stop-sell semantics

`STOP_SELL` (DATE) + `CommercialPeriod.sellable=false` (PERIOD, 1.8C) + availability
как отдельный слой:
- stop-sell НЕ удаляет price; НЕ трогает Availability/Reservation rows;
- restriction CRUD создаёт/освобождает **ноль** AvailabilityReservation holds
  (доказано e2e #15);
- price может существовать при stop-sell (e2e #1/#6), availability может быть 0
  при разрешённых restriction (отдельный слой, Step 2.4);
- **range stop-sell (§42, STRICT REVIEW):** при заданном `durationDays`
  stop-sold ЛЮБАЯ обязательная дата диапазона `[serviceDate .. +duration-1]`
  блокирует новый binding (hotel-like; e2e #14B). Без `durationDays` — только
  start-дата. CTA по-прежнему проверяет только start (interior CTA не блокирует),
  CTD — только end (см. §40-41).

## 10. Pricing composition / Quote freeze

- Restriction evaluation не меняет числовую цену (только sellability).
- Pre-binding: 422 при non-sellable; `QuoteItem.serviceDate` (1.8C) +
  **`QuoteItem.restrictionSnapshot`** (1.8D, frozen {type,value,source,code}) —
  провенанс binding-решения; клиент не может его форджить (forbidden key).
- Post-ISSUE Seller-edit (stop-sell/min-stay/CTA/CTD/price) НЕ инвалидирует и НЕ
  пере-резолвит frozen Quote (e2e #14).
- `durationDays` (1..365) — опциональный вход Quote item (server-валидирован,
  не пересчитывает цену).

## 11. Public Marketplace / priceFrom (§9.1)

Eligible-set `priceFrom` (JS + raw SQL согласованы — FIX 2 1.8C не регрессирован):
1. base FIXED price — всегда candidate (bindable на будущих датах). Граница
   политики (STRICT REVIEW §33): если Seller stop-sold ВСЕ будущие даты, base
   цена технически не bindable, но система не может перечислить бесконечный
   future — поведение задокументировано как «base bindable вне покрытых
   stop-sell дат»; практический способ полностью снять цену — archive Tariff
   или POR;
2. period price π — candidate iff `π.sellable AND π.endDate >= today AND π НЕ
   полностью stop-sold (каждая дата диапазона покрыта ACTIVE DATE STOP_SELL)
   AND π.endDate >= today + effectiveAdvance` (effectiveAdvance =
   PERIOD-attached ADVANCE_BOOKING иначе base advanceBookingDays);
   DATE-scope ADVANCE_BOOKING granularity — вне «from N» (documented).
- Нет bindable цен → `null` (не 0, не POR-fallback).
- Public DTO не содержит restriction/audit/internal полей (e2e #18).

## 12. Concurrency / CAS / idempotency

- `version`-CAS на update (stale → 409); archive/activate idempotent (повтор — no-op);
- advisory lock на Tariff (`catalog:restriction:{tariffId}`, отдельный ключ от
  period-лока) сериализует concurrent create — duplicate race → один 201 / один 422;
- **activate parent-eligibility (STRICT REVIEW §44/§51):** activate пере-читает
  Tariff/Product внутри tx и требует ACTIVE Tariff + не-ARCHIVED Product; для
  PERIOD-scope — ACTIVE период. Отдельные lock namespace не оставляют ACTIVE
  restriction под ineligible parent (e2e #14B: activate под ARCHIVED периодом → 409);
- rollback при любой ошибке — без partial rows/history/audit (e2e #17).

## 13. Audit / history

- `CommercialRestrictionHistory` (created/updated/archived/activated, actor, version);
- `SecurityService.audit`: `rate_plan.restriction.created/updated/archived/activated`
  (без PII/free-form dump);
- delete-safety: history Restrict — физическое удаление запрещено (soft archive).

## 14. API / RBAC / object scope

`/api/v1/tariffs/:tariffId/commercial-restrictions` (create/list),
`/api/v1/commercial-restrictions/:id` (get/history/patch/archive/activate).
- PARTNER: own-scope reuse `catalog.product.*`, коммерческие правки только под
  DRAFT Product; archive/activate — `catalog.rate_plan.publish` (staff/ADMIN);
- MODERATOR/BUYER — 403; forged ownership/system/quote/time-slot fields → 422;
- no time-slot/timezone/departure (гейт 2.8A).

## 15. Migration / IDs

- `20260812104925_add_commercial_restrictions` (additive: 2 таблицы + 3 enum +
  FK/индексы; Tariff/CommercialPeriod relations), `20260812105356_add_quoteitem_restriction_snapshot`
  (additive). `migrate status` up-to-date; clean replay на e2e DB (42/42);
  drift 0. `CRS-` зарегистрирован в `docs/contracts/ids.md` (атомарный
  `IdsService.nextCode(tx,"CRS")`).

## 16. Out of scope (1.8D)

1.8D Strict Review (отдельный pass); Step 2.6; Step 2.8A (time-slot/timezone);
revenue management; dynamic pricing; supplier/API/channel-manager; FX;
calendar UI 3.29I; arbitrary rule DSL; второй pricing/availability/hold engine;
scoped MAX_STAY/occupancy/PAX/age/duration tiers (extension points, DD-026 §3.4);
DATE-scope ADVANCE_BOOKING в priceFrom (granularity ниже «from N»).

## 17. Future extension points

- scoped `MAX_STAY`/occupancy/PAX/age-band/duration-tiers как новые typed types
  (additive enum);
- restriction snapshot versioning (расширение `restrictionSnapshot` при
  необходимости — сейчас frozen documentary факт);
- priceFrom per-date granularity при появлении search-horizon.
