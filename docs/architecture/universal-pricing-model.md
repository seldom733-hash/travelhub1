# UNIVERSAL PRICING MODEL — ARCHITECTURE (Roadmap Amendment)

**Project:** TravelHub
**Mode:** ARCHITECTURE / ROADMAP AMENDMENT — DOCUMENTATION ONLY (код НЕ реализуется)
**Status:** INTEGRATED (2026-08-11) — waiting for separate STRICT REVIEW
**Previous item:** `PHASE 1 STEP 1.8A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
**Canonical NEXT:** `Universal Pricing Model Amendment STRICT REVIEW` → затем Step 1.8B
**Canonical sources:** DD-024…DD-029 (DECIDED, Service Templates decision gates), `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`, ADR-0001 (owner-service), `service-templates-decision-gates.md`.

> **Каноническая сепарация:** Service Template определяет **ЧТО** продаётся; Pricing Model определяет **КАК** это ценится; Availability определяет **МОЖНО ЛИ** продавать; Reservation/Hold — временное обязательство capacity.
>
> **Period Pricing — универсальный pricing-размер применимых сервисных категорий, НЕ Hotel-specific фича.**

---

## 1. Commercial graph (frozen)

```
Product
  └── ServiceUnit                        (catalog.*, 1.8A — Seller commercial/service unit, name verbatim)
        └── Tariff / Rate Plan           (catalog.*, 1.8B — canonical commercial offer/rules)
              └── CommercialPeriod / Pricing Rule   (catalog.*, 1.8C — date/condition-sensitive price facts)
                    └── resolved authoritative price (server resolver)
```

- **Product** — НЕ финальный universal price authority, как только существуют ServiceUnits.
- **ServiceUnit** — НЕ price row (структура/identity/lifecycle; price/availability полей нет — 1.8A).
- **Tariff/Rate Plan** — коммерческий offer/правила (basis, currency, refundability, inclusions, restrictions).
- **CommercialPeriod/rule** — date/condition-sensitive price facts (1.8C).
- Привязка `Tariff → ServiceUnit` устанавливается в **Step 1.8B** (делегировано, НЕ в 1.8A; подтверждено 1.8A architecture).

## 2. Universal pricing invariants (frozen)

1. Pricing — Catalog-owned (owner-service contract ADR-0001; ни один другой domain не пишет price facts).
2. **Pricing ≠ Availability** (независимые факты/state: price exists ± availability exists ± sold out; resolver может комбинировать для offerability, но владение раздельно).
3. **Pricing ≠ Reservation/Hold** — Step 2.4 остаётся единственным availability/hold engine.
4. Quote/Checkout/Sale freeze authoritative commercial facts; **Order никогда не репрайсится** из текущего Catalog.
5. Frontend НЕ authoritative для цены (серверный resolver — единственный).
6. **No fabricated future price** (нет экстраполяции, stale-price fallback, fake zero, «авто-текущая цена»).
7. Capability ≠ live inventory (Reverse 2.2A остаётся несвязанным).
8. Seller-defined names verbatim (1.8A invariant) — цены не заменяют имена, имена не заменяют цены.
9. Universal — НЕ Hotel-specific: room/night/adult-child/vehicle — category rules через CategorySchema, не глобальные mandatory поля.
10. Одна canonical валюта на Rate Plan (DD-029); display-конверсия ≠ binding price.

## 3. Pricing input modes (Seller workflows — first-class)

Seller НЕ загоняется в один стиль ввода. Минимум замороженных семантических режимов:

| Mode | Пример | Примечание |
|---|---|---|
| **Fixed** (§5.1) | `Airport Transfer / Sedan → 35 AZN per trip` | авторитетна в пределах объявленного validity/rule scope |
| **Annual/seasonal calendar** (§6) | сезоны: `01 Jan–31 Mar=100, 01 Apr–31 May=130, 01 Jun–31 Aug=180, …`, New Year overlap `31 Dec–02 Jan=250` | **first-class REQUIRED workflow** — commercial periods, НЕ 365 дат вручную; New Year overlap — через канонический precedence/validation (не undefined behavior) |
| **Date/date-range override** (§7) | `Formula 1 weekend = 300` поверх base summer 180 | не требует удаления/правки base-сезона; holidays/festivals/events/New Year/local peaks |
| **Day-of-week** (§8) | `Mon–Thu=100, Fri–Sun=130` | может комбинироваться с периодами; precedence — серверный |
| **Occupancy/PAX** (§9) | Hotel: single/double/extra guest; Tour: Adult/Child/Infant/private group; Transfer: passenger bands; Excursion: Adult/Child ticket | category-dependent через CategorySchema; НЕ один universal Adult/Child schema |
| **Duration** (§10) | Car Rental `1–3 days=60/day, 4–7 days=52/day`; Guide `2h=80, 4h=140` | per night/day/hour/trip/service/package-total |
| **Tier/volume** (§11) | `1–3 persons=100 total, 4–7=160 total`; `1–5 tickets=20/person, 6–10=18/person` | избегать ambiguous mixing total vs per-person basis |
| **Advance-purchase / last-minute** (§12) | 30+ days ahead discount; ≤48h last-minute | **extension point**, НЕ в initial 1.8B/1.8C; не превращать manual period pricing в revenue-management engine |
| **Package/inclusion** (§14) | Hotel: Room Only / Breakfast Refundable / Breakfast Non-refundable; Tour: Standard/Premium/Private | каждый Rate Plan — свои periods/rules |

## 4. Source ≠ Method (frozen distinction)

- **Price source** — ОТКУДА факт цены: `MANUAL / IMPORT / API_SUPPLIER / CHANNEL_MANAGER / future trusted external`.
- **Pricing method/rule** — КАК устроена цена: `FIXED / PERIOD / DATE_OVERRIDE / DAY_OF_WEEK / OCCUPANCY/PAX / DURATION_TIER / future LEAD_TIME_RULE / future DYNAMIC_RULE`.
- Точные enum-имена финализируются при реализации (1.8B/1.8C review) — заморожена **дистинкция**, не слова.
- **CSV/XLS — input method, НЕ pricing authority** (§16): импорт валидируется и раскладывается в canonical Rate Plans + CommercialPeriods + overrides/rules; после импорта фактами являются canonical Catalog records (с source provenance). Импорт не строится сейчас.

## 5. Price basis (frozen concept)

Generic basis, способный выразить: `PER_UNIT / PER_ROOM / PER_PERSON / PER_NIGHT / PER_DAY / PER_HOUR / PER_TRIP / PER_SERVICE / PACKAGE_TOTAL`. Точные enum-имена — 1.8B.

- **Basis — Rate Plan-level commercial semantic** (предпочтительно); период переопределяет basis только если category-specific rule докажет необходимость.
- **Basis — одиночный семантический тег, НЕ compound-строка** (STRICT REVIEW §22): комбинации вида `PER_ROOM + PER_NIGHT` выражаются через **одиночный basis + отдельные quantity/duration dimensions** (например, basis=`PER_NIGHT`, dimension room-quantity=1, duration=3 nights), НЕ через перечисление базисов в одном поле — иначе неоднозначно «какой базис домножать». Точное физическое представление (единый basis с dimensions) финализируется при 1.8B implementation design.
- **Quantity/basis arithmetic contract** (§18): resolver обязан явно возвращать unit amount, basis, quantity, duration/count где релевантно, total — **без implicit arithmetic** (`100 PER_ROOM PER_NIGHT × 3 nights × 1 room ≠ 100 PACKAGE_TOTAL`; результат: unit price=100, quantity=1 room, duration=3 nights, total=300, basis=PER_NIGHT).

## 6. Temporal semantics (frozen)

- 1.8C начальная граница — **date-based**: `validFrom`/`validTo` — **date-only, inclusive** (`2026-06-01`–`2026-08-31` включает обе даты; UTC date-only midnight — та же модель, что `Availability.date`; согласовано с decision-gates §3.1). Timestamp-и с date-only seasonal prices не смешиваются молча.
- **Timezone — авторитет НЕ существует до 2.8A** (STRICT REVIEW §28): у Product/ServiceUnit НЕТ канонического commercial timezone поля; НЕ выдумывается (не фикциональное поле). 1.8C оперирует **UTC date-only** (как существующие Availability/Reservation); точная timezone-aware дата услуги — **гейт Step 2.8A** (IANA timezone, там же решается authority). Timezone не блокирует 1.8B (Rate Plan foundation не temporal).
- **Гейт Step 2.8A сохраняется:** date-based period pricing может идти ДО 2.8A; exact time-slot/departure/timezone-aware inventory — ПОСЛЕ 2.8A (время-зависимая granularity).

## 7. Overlap / precedence (deterministic — HARD REQUIREMENT)

Серверная резолюция для любого запрошенного commercial context — детерминирована. **Единая механика — специфичность условия** (narrower date range, exact condition), а не набор глобальных слоёв. Иерархия (STRICT REVIEW §17/§31 — согласована с DD-026 §3.6 без двух интерпретаций):

1. **exact/специфичный date override** (DATE_OVERRIDE; конкретная дата специфичнее диапазона);
2. **более специфичное условное override** (например, occupancy=2 специфичнее occupancy=ANY);
3. **применимый seasonal/period price** (явный PERIOD — narrower range wins);
4. **day-of-week rule** — **условие ВНУТРИ периода** (период с DAY_OF_WEEK-условием специфичнее «голого» сезонного периода того же диапазона); результат эквивалентен порядку DD-026 (weekend-правило специфичнее base-сезона), но **не является отдельным глобальным слоем** — разрешается тем же механизмом специфичности; период БЕЗ day-of-week условия и период С ним при идентичной специфичности — invalid overlap (422);
5. **base/fixed price** (FIXED/BASE).

- **Same-priority overlap** (§22): два правила с ОДИНАКОВОЙ специфичностью, оба матчат один context → **422 на write/publish** (никаких row-order/createdAt/last-write/frontend-order). Явно различаются: (a) invalid ambiguous overlap (одинаковая специфичность) → 422; (b) valid overlap, разрешаемый механической специфичностью (narrower range / exact condition) → разрешён (STRICT REVIEW §30 — «Summer+ANY» и «Summer+occupancy2» НЕ reject: второй специфичнее).
- **Specificity** — механическая, server-testable: exact date > range; точное условие (occupancy=2/PAX-tier/duration-tier/weekday) > ANY; narrower period range > broader; Rate Plan-scoped rule > base fallback. Равная специфичность + overlap → 422. Точная нормализация — 1.8C implementation с typed server-side validation.

## 8. Server resolver (frozen requirement)

Единый server-authoritative path, концептуально:

```
resolvePrice(serviceUnit, ratePlan, serviceDate/dateRange, occupancy/PAX, quantity, duration, currency context)
```

Возвращает explainable результат: matched Rate Plan; matched pricing rule/period; price basis; currency; unit price; quantity/duration; resolved total; provenance/source; rule/period identity. Explainability — для support/disputes/Quote snapshots/audit/Seller debugging; Buyer UI не обязан видеть внутреннюю логику. Точный API — реализация.

## 9. Missing / unknown future price (HARD GATE)

- **No fabricated future price:** нет авторитетной цены на запрошенные даты → нет молчаливой экстраполяции/stale-fallback/fake zero/«текущая цена». Результат — not instant-bindable at a price (если нет иного explicit commercial flow).
- **PRICE_ON_REQUEST vs misconfiguration:** различать «цена отсутствует — Seller забыл/ошибся» и «намеренно inquiry-based offer». НЕ каждая missing price = PRICE_ON_REQUEST (STRICT REVIEW §35):
  - **Rate Plan-level PRICE_ON_REQUEST** — типизированное состояние плана «inquiry-only» — foundation за 1.8B;
  - **period-level inquiry-only** (отдельные периоды плана) — решается при 1.8C, НЕ блокирует 1.8B;
  - **gap в нормально-оценённом Rate Plan** (цена не задана на конкретные даты) — это **missing price** (unavailable для instant binding), НЕ PRICE_ON_REQUEST; дистинкция остаётся: inquiry-only — явное состояние, gap — отсутствие факта.

## 10. Currency authority

- Preserve DD-029: canonical binding price сохраняет Seller/commercial currency.
- **Одна canonical currency per Rate Plan**; смена валюты внутри периодов одного Rate Plan — ambiguity → не разрешается casually; multi-currency — через отдельные Rate Plans. Resolution: зафиксировано (single currency per Rate Plan).
- **Display conversion ≠ binding** (§29): Marketplace может позже показывать approximate converted prices; original authoritative amount+currency сохраняются. FX НЕ реализуется в этом amendment.

## 11. Availability separation

- Pricing row/period **НЕ несёт inventory counters** (price и stock — разные факты).
- Возможные состояния: price+availability; price+sold out; availability+no bindable price; neither.
- **Stop-sell ≠ удаление цены** — это commercial availability/saleability control (1.8C/Partner Cabinet), не delete price.
- **Multi-date stays** (§32): price может резолвиться per required night; availability должна атомарно холдить КАЖДУЮ ночь; price resolution и inventory reservation — отдельные операции/контракты. **N ночей → N reservation-строк (по дате) в ОДНОЙ tx через существующий conditional-UPDATE механизм `CatalogService.reserveAvailability`** — это РЕШЕНИЕ DD-027 (A: extend/reuse; НЕ надморозка поверх DD-027); единственный hold engine Step 2.4 сохраняется; контракт `OrderRequested.reservationIds` (cardinality = все allocated units/dates) ревизуется при 1.8C. Multi-date hold не реализуется в amendment.

## 12. Quote / Checkout / Sale freeze boundary

- Catalog pricing определяет authoritative offer **до binding**.
- После freeze: изменения цены НЕ мутируют Quote/Checkout/Sale; правки seasonal-календаря НЕ репрайсят существующие Sale/Order; Order НЕ спрашивает текущий Catalog для реконструкции исторической суммы. Совместимо с существующими контрактами Step 2.3/2.3A/2.4/2.5.
- **Future Quote snapshot requirements** (не схема сейчас, а требование при реализации): serviceUnit ref; Rate Plan ref; pricing rule/period ref где уместно; price basis; authoritative currency; unit price; quantity/duration; total; service date/range; релевантные commercial conditions.

## 13. Marketplace implications

- **«from N»** (§35) — server-side, из authoritative eligible commercial periods/rules по документированной политике; НЕ минимальная историческая цена, НЕ expired/unpublished/unavailable row. Точный search-horizon/policy — Marketplace implementation, authority rule признана.
- **Buyer-selected dates** (§36): серверная резолюция `ServiceUnit → Rate Plan → pricing rule/period → price` + отдельная оценка availability. Никакого frontend-пересчёта из скачанного annual calendar.

## 14. Partner Cabinet workflow contract (frozen)

1. Seller выбирает Product → 2. ServiceUnit → 3. создаёт/выбирает Rate Plan → 4. выбирает pricing method → 5. basis/currency → 6. base/fixed price или commercial periods → 7. seasonal periods → 8. holiday/event/date overrides → 9. опционально day-of-week/PAX/duration/tier conditions → 10. система валидирует overlap/precedence → 11. preview resolved calendar → 12. availability отдельно → 13. publish через canonical Catalog rules.

- **Annual calendar UX (3.29I):** year/month calendar; period selection; bulk price entry; copy period/season/year где безопасно; holiday/date override; weekday/weekend rules; occupancy/PAX matrix где категория позволяет; stop-sell; availability bulk edit; preview resolved price; validation errors до publish.
- **Import UX (3.29I extension):** CSV/XLS/supplier file/API/channel manager → тот же canonical Rate Plan + CommercialPeriod/rule model. Никакого параллельного «Excel pricing engine».

## 15. Future automation extensions

- **External supplier/API pricing** (§40): trusted source обновляет canonical future prices; требования — source provenance, idempotent reconciliation, no client spoofing, conflict policy с manual overrides, immutable downstream Quote/Sale snapshots. Коннекторы НЕ строятся.
- **Dynamic / revenue-management** (§41): future demand/occupancy/lead-time/competitor/AI — но динамика обязана **производить/резолвить authoritative Catalog price** под тем же binding contract. Никакого второго downstream pricing authority.
- **Manual vs automation precedence** (§42): explicit authorized manual override может supersede automated source в определённом scope с provenance/audit; минимум — детерминированная source precedence.

## 16. Cross-category validation

| Категория | ServiceUnit | Rate Plans | Pricing | Availability |
|---|---|---|---|---|
| **Hotel/Apartment** | `Premium Double Ocean Side` | Room Only Refundable; Breakfast Included Non-refundable | winter/spring/summer; New Year override; weekend rule; occupancy dims | nightly inventory, отдельно |
| **Tour** | `Premium Tour Package` | Standard/Premium/Private | seasonal; departure/date; Adult/Child или group bands; package total или per-person | departure slots/date, отдельно |
| **Transfer** | `Minivan` | `Private Transfer` | fixed per trip; seasonal period; event override; passenger/group tier | vehicle slots, отдельно |
| **Excursion/Activity** | ticket/service variant | Adult/Child ticket | per-person; Adult/Child где schema позволяет; seasonal/date; future exact time slot — гейт 2.8A | seats, отдельно |
| **Car Rental** | vehicle-class | per-day | per-day basis; seasonal rates; duration bands; holiday override | vehicle inventory, отдельно |

Никаких room/night assumptions в universal core; `room/night/vehicle/adult-child` — category rules через CategorySchema.

## 17. Future Tariff/CommercialPeriod relationship (not implemented)

- **1.8B** — canonical Rate Plan: Tariff extension (meal plan, refundability, `cancellationPolicyId` ref, included services, restrictions, `priceBasis`, occupancy/PAX applicability, single currency per plan, PRICE_ON_REQUEST как типизированное состояние); привязка `Tariff.serviceUnitId`; Seller-defined Rate Plan name.
- **Legacy `Tariff.price` transition (STRICT REVIEW §50) — заморожено:** существующий `Tariff.price/currency/validFrom/validTo` остаётся **legacy/base price** (совместимость legacy Product/Tariff; Quote продолжает снапшотить с Tariff). 1.8B НЕ удаляет и НЕ переосмысляет эти поля (аддитивное расширение); после ввода CommercialPeriod (1.8C): при наличии релевантных period-фактов authoritative — period price; при отсутствии — legacy `Tariff.price` = base/FIXED fallback. **Legacy price — явно введённый Seller-ом факт (authoritative), а не фабрикация:** fallback НЕ нарушает gate «no fabricated future price» (нет цены — нет fallback; есть legacy price — это реальный price fact, а не экстраполяция/«текущая цена»). Никакой destructive migration; legacy-safe реализация 1.8B не блокируется.
- **1.8C** — CommercialPeriod/date pricing: fixed/base compatibility, annual/seasonal calendar, date overrides, deterministic precedence, category-supported conditions, availability relationship, multi-date atomic hold compat, date-only boundary до 2.8A.
- **1.8D** — restrictions/overrides совместимы с resolved server pricing, Marketplace display, Partner publication/consumption contract.

## 18. Not implemented here (boundary)

Никакого Prisma schema / migrations / backend или frontend code / API / permissions / events / tests. Никакого FX, CSV/XLS import engine, supplier/channel-manager API, dynamic pricing rules, UI. Всё выше — концептуальные/frozen контракты для 1.8B/1.8C/1.8D/3.29I.
