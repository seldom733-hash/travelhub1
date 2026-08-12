# PERIOD PRICING & PERIOD AVAILABILITY FOUNDATION — CommercialPeriod (Step 1.8C)

**Project:** TravelHub
**Phase:** 1
**Step:** 1.8C — PERIOD PRICING & PERIOD AVAILABILITY FOUNDATION
**Mode:** IMPLEMENTATION + STRICT REVIEW FIXES
**Status:** STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12)
**Previous gate:** `PHASE 1 STEP 1.8B STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
**Canonical NEXT:** `PHASE 1 STEP 1.8C STRICT REVIEW` (done) → 1.8D
**Canonical sources:** DD-026/DD-027 (DECIDED), `docs/architecture/universal-pricing-model.md`, `docs/architecture/service-templates-decision-gates.md`, `docs/architecture/rate-plan-foundation.md` (1.8B), `docs/architecture/service-unit-foundation.md` (1.8A), Roadmap v3 Step 1.8C.

---

## 1. Verdict

`PHASE 1 STEP 1.8C STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

`catalog.CommercialPeriod` реализован как authoritative date-based period price/sellability факт (эквивалент `MANUAL_PERIOD`, DD-026). Детерминированный резолвер специфичности (DATE_OVERRIDE > narrower PERIOD > DAY_OF_WEEK-условие > base), period-цена резолвится при составлении Quote и замораживается, public `priceFrom` period-aware. STRICT REVIEW нашёл 1 критический дефект (freeze semantics — см. §6 FIX 1), 1 timezone-дефект (priceFrom SQL, §7 FIX 2), 1 provenance-дефект (QuoteItem.serviceDate, §6 FIX 3) и исправил документацию (FIX 4). Time-slot/timezone-aware часть явно deferred до Step 2.8A (стоп-условие Roadmap соблюдено).

---

## 2. Canonical commercial graph (1.8C слой)

```
Product
  └── ServiceUnit                        (1.8A — structure/identity)
        └── Tariff / Rate Plan           (1.8B — commercial offer/rules, TRF-*)
              └── CommercialPeriod       (1.8C — THIS: date-based price/sellability факт, CPR-*)
                    └── resolved price   (1.8C — deterministic resolver, THIS)
```

- **CommercialPeriod IS Rate-Plan-scoped**: каждый период привязан к одному Rate Plan (`tariffId`), план проверяется на status ACTIVE и pricingMode FIXED (POR → 422, §35 Universal).
- **Период ≠ Rate Plan**: план — plan-level факты; период — date-interval факт с ценой/availability поверх плана.
- **Period price является authoritative source** при разрешении (выше legacy `Tariff.price` fallback) для дат, покрытых периодом; период НЕ bypass Tariff (hierarchy gate).
- **Владелец — Catalog** (`catalog.*`); Sales/Reverse/Booking-владельцев периодной цены нет; direct cross-domain writers отсутствуют (ADR-0001).

---

## 3. Schema / persistence (FIX 4 — фактическая модель)

`catalog.CommercialPeriod` (schema `catalog.*`) — только то, что есть в коде:

- `code` `CPR-*` unique, атомарная генерация `IdsService.nextCode(tx, "CPR")` внутри tx создания; client-forge → 422 (forbidden key).
- `tariffId` (FK → catalog.Tariff, ON DELETE CASCADE) — единственная привязка к Rate Plan. **НЕТ** отдельного `productId`/`currency`/`basis`-колонок: product ownership наследуется через Tariff, валюта наследуется из Tariff при разрешении (одна canonical валюта на Rate Plan, DD-029 — дублирование исключено, drift невозможен, §27 PASS).
- `kind` enum: `PERIOD` / `DATE_OVERRIDE`.
- `startDate` / `endDate` — date-only UTC midnight (parse `YYYY-MM-DDT00:00:00.000Z`, serialize `toISOString().slice(0,10)`, weekday по `getUTCDay()` — date не сдвигается от timezone; DB тип TIMESTAMP(3) — app-enforced date-only, §8/§10 PASS).
- `dayOfWeek Int[]` — условие ВНУТРИ периода (0=Sun..6=Sat, getUTCDay-совместимо; dedup; пустой = bare период; DATE_OVERRIDE + dayOfWeek → 422). **НЕТ** minNights/maxNights/occupancy/PAX/duration/tier — это 1.8D-условия (см. §9).
- `price Decimal(12,2)` (наследует валюту Tariff), `sellable Boolean` (period stop-sell: price ≠ availability; stop-sell ≠ удаление цены).
- `status` enum: `ACTIVE` / `ARCHIVED` (soft lifecycle).
- `version Int` (CAS), `createdAt`, `updatedAt`.

`catalog.CommercialPeriodHistory` — журнал (created/updated/archived/activated, actor, version, fields). **История СУЩЕСТВУЕТ с 1.8C** (не 1.8D); `periodId` FK ON DELETE RESTRICT — физическое удаление периода с историей запрещено (коммерческая история не стирается; CASCADE с Tariff блокируется RESTRICT-цепочкой, §7 PASS). Security audit — actor/action/target без PII/dump.

Индексы: `[tariffId, status]` (resolver hot path), code unique, `[periodId]` (history). Миграции: `20260812085430_add_period_pricing_availability` (аддитивная) + `20260812100520_add_quote_item_service_date` (аддитивная). Fresh deploy safe, без backfill, replay/status green.

---

## 4. Deterministic resolver (DD-026 precedence)

`resolveApplicablePeriod(periods, serviceDate)` — чистый helper (`src/modules/catalog/period-resolution.ts`), без writes; вход — ACTIVE периоды одного Tariff (сервер фильтрует), выход — winner или null (→ base fallback).

Deterministic specificity key (ascending = more specific):
1. `kind`: DATE_OVERRIDE (0) < PERIOD (1) — точная дата специфичнее диапазона;
2. `dayCount` (endDate-startDate+1): **narrower range wins** — multi-day holiday/event реализуется как narrow PERIOD поверх broad season (механизм DD-026 «narrower range wins», §14/§18 PASS);
3. `hasDayOfWeek`: период с dayOfWeek-условием специфичнее bare периода того же диапазона (Universal STRICT REVIEW §31 — единый механизм, без отдельного глобального слоя);
4. defensive tie-break createdAt/id (недостижим: same-priority overlap блокируется на write — 422).

- Покрытие: `startDate <= d <= endDate` (inclusive) + dayOfWeek `includes(getUTCDay())` если не пуст.
- Same-priority overlap (`samePriorityOverlap`: kind + dayCount + hasDow) → 422 на create/update/bulk/activate; runtime ambiguity → 422 (не guess, не createdAt-winner).
- Без периода → base/FIXED `Tariff.price` fallback (§50 Universal); gap = missing price → 422 на числовом quote.
- Чистота: helper не делает запросов/записей; специфичность mechanical & server-testable.

---

## 5. Partner management API (own-scope)

- `POST tariffs/:tariffId/commercial-periods` — create single; `POST .../bulk` — annual calendar (366 rows max, atomic, one tx + advisory lock); `GET .../commercial-periods` — list (pagination, status filter); `GET commercial-periods/:id` + `/history`; `PATCH commercial-periods/:id` — update (version-CAS → 409); `POST .../archive` / `.../activate` — soft lifecycle (idempotent; activate re-validates overlap).

Ownership: `actor.partnerId` — единственный security source; PARTNER — только СВОИ (DRAFT Product, как 1.8B); staff/ADMIN — `catalog.product.write`; archive/activate — `catalog.rate_plan.publish` (staff); MODERATOR/BUYER → 403 (e2e #40). Forged keys (id/code/tariffId/productId/partnerId/currency/status/version/timestamps/timeSlot/timezone/Quote/Sale/hold/1.8D-facts) → 422 (loud reject, не silent strip).

Concurrency: advisory lock `pg_advisory_xact_lock(hashtext('catalog:period:'+tariffId))` на create/bulk/update/archive/activate (все conflict-пути) + DB overlap-check внутри tx + version-CAS. Concurrent duplicate create → ровно один успех (e2e #33). No raw 500.

---

## 6. Quote / Checkout integration (STRICT REVIEW FIXES 1 & 3)

**Freeze contract (canonical, Roadmap 1226-1227 + Universal §12 + 1.8C §39):** Catalog pricing authoritative **до binding**; binding stage = **Quote ISSUE** (commercial snapshot immutable). После ISSUE: никакого reprice из текущего Catalog; later Seller price/calendar правки НЕ мутируют frozen commercial facts.

- `addQuoteItem` (DRAFT, pre-binding): принимает опциональный `serviceDate` → периодная цена резолвится server-side на дату → **замораживается** в `QuoteItem.unitPrice` (client не передаёт цену). `resolveEligibleTariff` gate сохранён: ARCHIVED план / PRICE_ON_REQUEST / stop-sell период → 422.
- **FIX 3 (provenance, §41):** `QuoteItem.serviceDate` (date-only UTC midnight) — snapshot сервисной даты, на которую резолвлена цена; экспонируется в DTO. Минимальные facts для спора: amount/currency/serviceDate/tariff ref. Migration `20260812100520_add_quote_item_service_date`.
- **FIX 1 (§42/§44/§45 — критический дефект):** убран `verifyCheckoutPeriodPrices` из `setCheckoutServiceDate` и `completeSale`. Ранее completeSale пере-резолвил ТЕКУЩУЮ периодную цену на дату и 422-ил при несовпадении с frozen — это позволяло Seller-edit (правка периода после ISSUE) инвалидировать уже выпущенную binding Quote. Канонически: после ISSUE frozen QuoteItem amount binding; checkout/sale используют frozen суммы; availability гейтится отдельно (checked-not-reserved + reserveAvailability, Step 2.4). Никакого silent reprice (frozen никогда не перезаписывается), никакого reprice из правок календаря. E2E #20-22 переписан: после period edit (190→250) POST-ISSUE checkout service-date → **200**, frozen 190 сохраняется; serviceDate snapshot неизменен.
- Legacy Quote без serviceDate → base snapshot, без period-требований (e2e #23; §46 PASS).

---

## 7. Public `priceFrom` (Marketplace, STRICT REVIEW FIX 2)

- Семантика (Universal §35 «НЕ минимальная историческая цена»): min по `{base FIXED Tariff.price} ∪ {ACTIVE + sellable периодные цены с endDate >= сегодня}`. Stop-sold периоды НЕ снижают; POR/ARCHIVED исключены; прошлые периоды не снижают; search-horizon — Marketplace (позже), искусственный ceiling не вводится.
- List/sort path (raw SQL UNION ALL min) и detail path (`minTariff` JS) — одна и та же семантика (база + будущие sellable периоды), sort key = displayed value (§50 PASS).
- **FIX 2 (§8/§10/§50 — timezone-дефект):** raw SQL использовал `CURRENT_DATE` (session TZ = **Asia/Baku**), а JS-путь — `todayStartUtc()` (UTC). На границе суток Baku уже «завтра», а UTC ещё «сегодня» → sort и display могли разойтись. Исправлено: `cp."endDate" >= date_trunc('day', now() AT TIME ZONE 'UTC')` — обе ветки строго UTC.
- `PRICE_ON_REQUEST` → price:null (inquiry-only), исключён из priceFrom/sort (не over-hiding, 1.8B §22 сохранён).

---

## 8. RBAC

- PARTNER: own-scope create/update (DRAFT Product) — `catalog.product.update_own_draft` / `catalog.product.read_own`; НЕ архивирует (403, `catalog.rate_plan.publish` только staff).
- staff/ADMIN: `catalog.product.read/write` (create/update), `catalog.rate_plan.publish` (archive/activate) — консистентно с 1.8B (staff управляет published; PARTNER — draft).
- MODERATOR → 403 (периоды — не moderation-объекты). BUYER → 403.
- 1.8B staff/ADMIN RatePlan management не ослаблен (§54 PASS — задокументировано в контроллере).

---

## 9. Boundaries / out-of-scope (Roadmap стоп-условие; FIX 4 — корректная формулировка)

- Time-slot / exact-departure / timezone-aware availability — **deferred до Step 2.8A** (не реализованы; поля `timeSlot`/`timezone`/`departureTime` в forbidden keys → 422 — «протащить» нельзя).
- **Occupancy/PAX/duration/tier условия — 1.8D** (DD-026 §3.4 price-identity dimensions; CategorySchema-gated; в 1.8C НЕ реализованы — Roadmap GATE RESOLVED precedence перечисляет только DATE_OVERRIDE/PERIOD/DAY_OF_WEEK; minNights/maxNights/occupancy полей НЕТ — документация исправлена FIX 4, ранее ошибочно заявляла их наличие).
- Multi-date hold, dynamic rules, API_SUPPLIER/CHANNEL_MANAGER/DYNAMIC_RULE source — extension points только в документации.
- Events/outbox: **не вводились** (consumer отсутствует; ноль speculative events — проверено).
- Frontend не изменён (backend-only pass).

---

## 10. Regression evidence (STRICT REVIEW pass)

- Unit: **430/430** green (period-resolution 15: precedence, overlap-422, weekdays, date boundaries; + полный backend unit).
- E2E: period-pricing **31/31** (в т.ч. переписанный #20-22 — freeze FIX 1, serviceDate provenance FIX 3); rate-plan **38/38** (1.8B assertions эволюционированы — легитимно: модель CommercialPeriod появилась в 1.8C, а не «ослаблены»); quote **18/18**; checkout **16/16**; + 2.2A/2.2B/2.5B suites.
- Full serial e2e: **838/838 green** (fresh DB из миграций — replay/drift 0).
- Frontend: `tsc --noEmit` clean, vitest **135/135**, production build OK.
- `prisma migrate status`: up-to-date (40 migrations), drift 0.

---

## 11. Issues found & fixed (STRICT REVIEW)

| # | Severity | Area | Fix |
|---|---|---|---|
| FIX 1 | CRITICAL | Freeze semantics §42/§44/§45 | completeSale/setCheckoutServiceDate пере-резолвили текущий календарь → Seller-edit инвалидировал binding Quote; убран (frozen binding, e2e #20-22) |
| FIX 2 | HIGH | priceFrom timezone §8/§10/§50 | SQL `CURRENT_DATE` (Asia/Baku) → UTC day boundary; sort=display |
| FIX 3 | MEDIUM | Quote provenance §41 | `QuoteItem.serviceDate` snapshot (миграция + DTO) |
| FIX 4 | MEDIUM | Документация | arch note/Roadmap заявляли несуществующие minNights/maxNights/productId/currency/Decimal(14,2)/isAvailable/«истории нет» — приведены к фактической модели (dayOfWeek/sellable/Decimal(12,2)/history EXISTS/currency наследуется) |
