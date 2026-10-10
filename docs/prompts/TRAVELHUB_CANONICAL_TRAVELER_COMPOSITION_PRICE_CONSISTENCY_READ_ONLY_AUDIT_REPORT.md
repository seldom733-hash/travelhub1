# TRAVELHUB — CANONICAL TRAVELER COMPOSITION & PRICE CONSISTENCY
# READ-ONLY DESIGN / ARCHITECTURE AUDIT — FINAL REPORT (§22)

**Mode:** READ-ONLY / DESIGN ONLY — **NO CODE / NO SCHEMA / NO DB / NO PRICE / NO LIFECYCLE / NO COMMIT / NO PUSH**

| Поле | Значение |
|---|---|
| HEAD | `75c6bea` (`fix(request): keep convert action for product-less requests (Hotel Identity Fix B)`) |
| Branch | `master` |
| git status | 154 entries: 153 pre-existing (не тронуты) + предыдущий отчёт composition-аудита; настоящий отчёт — единственный новый файл |
| Дата | 08.10.2026 |
| Промпт | `docs/prompts/TRAVELHUB_CANONICAL_TRAVELER_COMPOSITION_PRICE_CONSISTENCY_READ_ONLY_AUDIT_PROMPT.md` |
| Предыдущий audit | `TRAVELHUB_TRAVELER_COMPOSITION_READ_ONLY_AUDIT_REPORT.md` — VERDICT C |

Метки достоверности используются по §24: **`CONFIRMED BY CODE`** / **`REASONABLE DESIGN RECOMMENDATION`** / **`OWNER DECISION REQUIRED`**.

---

## A. VERDICT

```text
DESIGN BLOCKED — OWNER DECISIONS REQUIRED
```

Обоснование: целевая схема (D, F, G, J, N) может быть полностью спроектирована по коду, но 5 из 8 ключевых решений (§O) принципиально не выводятся из repository: в коде **нет ни одного age-порога** для supplier-цепочки, **нет as-of date семантики**, **нет privacy-политики по DOB**, **нет authority-правила при mismatch** и **нет обработки Path B без offer snapshot**. Без этих решений implementation design будет содержать домысливание, что запрещено §24. `ARCHITECTURE RISK` не выбран: существующая транспортная архитектура (SupplierSearchQuery → adapters → price) пригодна для расширения без новой абстракции-ради-абстракции (§4).

---

## B. EXECUTIVE SUMMARY

1. **`CONFIRMED BY CODE`** — canonical composition в системе отсутствует; есть только три слоя-кандидата: фактические данные (`RequestTraveler{FIO,birthDate,position}`), транспорт (`SupplierSearchQuery{adults,children?,childAges?}` + `FlightSearchQuery.passengers{adults,children,infants}`) и заморозка (`productSnapshot.offer{adults,children,childAges}` + `travelerCount`). Слои нигде не связаны между собой.
2. **`CONFIRMED BY CODE`** — DOB→composition не существует (0 функций; `supplier/**` не содержит `birthDate`; единственный DOB-hint — `azal.http.service.ts:208 childrenDatesOfBirth: null`). Возрастные правила принадлежат поставщикам и выражены только транспортом (`AGES`/`AGE1..4`/counts).
3. **`CONFIRMED BY CODE`** — composition уже является частью cache/price identity: `deriveSearchKey` хэширует весь query (`supplier-cache.service.ts:157`), `derivePriceKey` включает `adults/children/childAges` (`:164`, вызов `supplier-offer.service.ts:204`), frontend-календарь — `MonthlyCalendar.tsx:43-45`. TTL 5 мин.
4. **`CONFIRMED BY CODE`** — механизм reprice-предложения уже существует: `POST :id/propose-price` → статус `PRICE_CHANGED` + `supplierPriceProposal` (`request.controller.ts:274`, `request.service.ts:912-915`), accept использует precedence `proposal ?? snapshot.customerFinalPrice ?? displayedPrice` (`:1125-1126`). Это готовый носитель для composition-driven REPRICE — без новых статусов.
5. **`CONFIRMED BY CODE`** — mismatch-гейты существуют только для **количества**: readiness (`request-travelers.ts:106-119`), convert (`assertRequestTravelersMatchCount`, `:122-136`, вызов `order.service.ts:766`), finalConfirm (`order.service.ts:2184-2188`). **Возрастная категория/состав не сверяется нигде** — «silent mismatch» из §23 возможен в текущем виде.
6. **`CONFIRMED BY CODE`** — три(четыре) пути создания Request с разной полнотой: Path A (offer → composition snapshot + recheck), Path B (buyers → composition отсутствует, только `travelerCount`), **Path C (flights, `azal.controller.ts:147-186`)**: `travelerCount = passengers.adults ?? 1` (children/infants **не считаются**), composition живёт лишь внутри `pinnedRequirements: {...body}` (`:181`) — отдельный, отличный от A/B, кейс.
7. **`CONFIRMED BY CODE`** — в Request→Order composition **теряется**: `OrderItem` хранит только деньги/dates (`schema.prisma:2276-2292`), `Order.travelerCount` — счётчик (`:2258-2260`), `OrderTraveler` — FIO+DOB+docs (`:2294-2318`). Состав offers snapshot'а в Order не переносится.
8. **`OWNER DECISION REQUIRED`** — universal age bands, as-of date, точный DOB vs age поставщикам, authority при mismatch, состояние commercialSnapshot, Path B без offer (§O).
9. **`REASONABLE DESIGN RECOMMENDATION`** — целевая схема: `RequestTraveler[] → Traveler Composition Resolver → Canonical Traveler Composition → (Offer Comparison → Price Consistency Decision) + (Supplier Mapping → SupplierSearchQuery)`, состояния `MATCH/MISMATCH/UNKNOWN/NOT_APPLICABLE`, сверка в `assertTravelersReadyForCommercialStep` и `convertRequestToOrder`, flights — **SEPARATE FLIGHT MODEL** (§F, §G, §15).

---

## C. CURRENT ARCHITECTURE

```text
UI Search (TourSearch.tsx:56-58, CompactSearch.tsx:83-86, TourDetail.tsx:52-54,
           FlightSearch.tsx:30-31)
    │ composition введена пользователем; НИКАКОЙ расчёт из DOB
    ▼
SupplierSearchQuery {adults, children?, childAges?}        [supplier.types.ts:11,36-38]
FlightSearchQuery.passengers {adults,children,infants}      [azal/flight.types.ts:11-30]
    │ supplier.controller.ts:102-119 | public-supplier.controller.ts:129-178
    │ stateless; входит в search-cache key (deriveSearchKey, supplier-cache.service.ts:157)
    ▼
Supplier Offer (нормализованные офферы несут adults/children/childAges
    │           — summertour-new.adapter.ts:416,711,793; calendar entries)
    ▼
Offer selection (OfferModal.tsx:320-344 → adults/children/childAges из offer-строки)
    ▼
Request ─ Path A: tour-request.service.ts:40-66
    │   searchContext(:115-123) → refreshPrice(:135-145) → displayedPrice(:145)
    │   productSnapshot.offer{adults,children,childAges}(:231-248,267-275)  ← СОХРАНЯЕТСЯ
    │   travelerCount=adults+children(:261)                                 ← СОХРАНЯЕТСЯ
    │   commercialSnapshot{money only}(:204-213)
    │   RequestTraveler[] в момент создания НЕ создаётся
    │
    ├─ Path B: request.service.ts:248+ (POST /buyer/requests)
    │   composition = только travelerCount из travelers[] (:264-270); offer-snapshot НЕТ;
    │   commercialSnapshot НЕТ; supplier price НЕ запрашивается (refreshPrice в файле отсутствует)
    │
    └─ Path C (flights): azal.controller.ts:147-186
        travelerCount = passengers.adults ?? 1 (:176) — children/infants не считаются
        productSnapshot = {type:"FLIGHT",from,to,fareFamily} (:177) — composition НЕТ
        pinnedRequirements = {...body, supplierCode} (:181) — passengers лежат ЗДЕСЬ (неканонично)
        displayedPrice = server-authoritative re-derive (:150-152); commercialSnapshot(:161-172)
        RequestTraveler[] НЕ создаётся
    ▼
Customer Accept (request.service.ts:1074+)
    │ readiness: count + FIO+DOB (:689-706, вызов :1087)         ← КОЛИЧЕСТВО, НЕ СОСТАВ
    │ money: proposal ?? snapshot.customerFinalPrice ?? displayed (:1125-1126)
    │ freezeForAcceptance → customerAcceptedAt (commercial-snapshot.ts)  ← ДЕНЬГИ
    │ composition НЕ пересчитывается, НЕ сверяется, НЕ инвалидируется    [CONFIRMED]
    ▼
Order (order.service.ts convert, вызов из request.service:1271)
    │ assertRequestTravelersMatchCount(:766) — только количество
    │ OrderItem: productId/code/title/type/quantity/price/currency/amount/serviceDate
    │            (schema.prisma:2276-2292) — composition НЕ переносится  ← ТЕРЯЕТСЯ
    │ Order.travelerCount = r.travelerCount (:712,:806; schema :2258-2260) — счётчик
    │ OrderTraveler: FIO+birthDate+docs+dataCompleteness (schema :2294-2318)
    ▼
Final Confirm (order.service.ts:2160-2215): terms/pinned/count/completeness/passportExpiry
    │ — состав не проверяется
    ▼
Order → Booking (booking.subscribers.ts:125-139 readiness-фильтр; :248-254 birthDate → outbox)
        — состав не проверяется
```

Точки сохранения composition: `SupplierSearchQuery` (in-flight/cache), оффер-строки (in-flight), `productSnapshot.offer` (Path A), `pinnedRequirements` (Path C, неканонично), `travelerCount` (все пути). Точки потери: Path B (не было), Request→Order (не переносится), Path C (дети/младенцы не посчитаны, состав вне canonical полей).

---

## D. CANONICAL COMPOSITION PROPOSAL

**`REASONABLE DESIGN RECOMMENDATION`** (структурные вопросы §4 — тип существует в DTO-виде, но не как canonical сущность; существующую `SupplierSearchQuery` расширять **нельзя** — это транспорт и cache-key, см. §12 запрет на supplier-specific поля).

```ts
// Proposed: backend/src/modules/order/traveler-composition.ts (см. §N)
export interface TravelerComposition {
  // §4.3 — обязательное ядро
  adults: number;
  children: number;
  childAges: number[];   // годы, индекс = порядок children; tours/hotels
  infants: number;       // flights; 0 в tours

  // §4.4 — дополнительные (обоснование)
  travelersCount: number;      // = adults+children+infants; денорм. сверка с Request.travelerCount
  source: CompositionSource;   // "SEARCH_UI" | "OFFER" | "REQUEST_TRAVELERS" | "SUPPLIER" | "PARTNER_QUOTE"
  provenance?: string;         // offer id / request id — для аудита price identity
  asOfDate?: string;           // ISO date — ВКЛЮЧАТЬ ТОЛЬКО после решения §O-2 (NOT CONFIRMED, §E)
  compositionVersion?: 1;      // для будущей миграции semantics
}
```

§4.5 — **да, различать три слоя** (это уже фактическая архитектура, §C):

```text
FACTUAL TRAVELER DATA      → RequestTraveler[] (factual, editable until CONVERTED/REJECTED)
DERIVED COMMERCIAL LAYER   → TravelerComposition (canonical; сверка с offer; money-решения)
SUPPLIER TRANSPORT LAYER   → AGE1..AGE4 / AGES CSV / ADULT-CHILD / passengers counts
```

Правила размещения: canonical-тип живёт в домене Request (рядом с `request-travelers.ts`), импортируется адаптерами только как тип; `SupplierSearchQuery` остаётся транспортом и **не расширяется** composition-полями. `NOT CONFIRMED`: точное имя файла/модуля — утвердить на implementation-фазе.

---

## E. DOB → COMPOSITION

### §5 — Инвентарь правил и классификация

| Правило | Где | Класс |
|---|---|---|
| **Universal TravelHUB age-правило (bands)** | **отсутствует** — grep `getAge|calculateAge|ageFrom|ageAt|computeAge` = 0 hits (backend+frontend) | **A: НЕТ** → `OWNER DECISION REQUIRED` |
| Транспорт возрастов: `AGES = childAges[0]` | `anex.adapter.ts:272` | B (supplier-specific) |
| `AGES = CSV всех детей` | `anex-hotel.adapter.ts:279-295` (комментарий `:60`) | B |
| `AGE1..AGE3` в форме SAMO | `kompas.adapter.ts:390-393,1332-1335` | B |
| `AGE1..AGE4` в URL | `kazunion-http.service.ts:617-619` | B |
| Summer: AGE1-3 строятся, **XHR не отправляет** | `summertour.request-builder.ts:107-112` vs `:126-167` | B (+ defect-gap предыдущего аудита) |
| `adult_count/child_count/infant_count`, `childrenDatesOfBirth: null` | `azal.http.service.ts:276-278,208` | B |
| Aviasales: `passengers{adults,children,infants}` | `aviasales.http.service.ts:249-252` | B |
| UI: `AGE_OPTIONS 0-17`, метки `<1 / года / лет` | `frontend/components/marketplace/search/ChildAges.tsx:13` | **C (UI-only)** |
| UI: дефолтный возраст ребёнка `5` | `TourDetail.tsx:150-152` | **C (UI-only)** |
| UI: дефолты `adults=2, children=0` | `supplier.controller.ts:117-118`, `search/page.tsx:267-268` | **C (UI-only)** |
| Partner quote: `infants age<2`, `kids 2-11`, `childPct 75/infantPct 10` | `tour-builder.service.ts:915-919` | **D (partner/tour-builder)** |
| Partner quote: insurance `child<12`, `coeff 0.6` | `tour-builder.service.ts:953-954` | **D** |

**Вывод §5:** класс A пуст — обобщённого правила, пригодного для canonical composition, в коде нет. Класс B (правила поставщиков) в репозитории представлен только *транспортом*, сами пороги у поставщиков — недоступны для аудита. Класс D не должен становиться общим pricing-правилом (§5 требование). **`OWNER DECISION REQUIRED` (§O-1).**

### §6 — AS-OF DATE

Рекомендация: **`NOT CONFIRMED`**.

- В адаптерах/DTO **нет комментариев и полей**, связывающих возраст с датой (`grep 'age at|as of departure|возраст на|даты вылета'` по `supplier/**` — 0 релевантных hits; по `docs/**` — только упоминания «child age bands» в roadmap-документах `TRAVELHUB_DEFERRED_DECISIONS_MAP.md:577`, `TRAVELHUB_ROADMAP_SERVICE_TEMPLATES_...:437` — это планы, не контракты).
- Кандидаты-даты, существующие в данных: `departureDateFrom/To` (search), `requestedServiceDate` (Request), offer `departureDate`, `checkIn` календаря — но код нигде их не связывает с возрастом.
- Supplier contracts (§6 «проверить существующие supplier contracts and search DTO») age-семантики не задают: параметры — безымянные числа (`AGE1`, `AGES`, `child_count`).
- `REASONABLE DESIGN RECOMMENDATION` (подлежит подтверждению поставщиками): фиксировать возраст **на дату вылета/check-in выбранного offer** — потому что именно она заморожена в `productSnapshot.offer.departureDate` и `requestedServiceDate`. Пока не подтверждено → не включать `asOfDate` в DTO (§D).

---

## F. OFFER CONSISTENCY

**Состояния (§9):**

| Состояние | Определение (REASONABLE DESIGN RECOMMENDATION) |
|---|---|
| `MATCH` | derived composition (из `RequestTraveler[]` + правило) **равен** frozen `productSnapshot.offer{adults,children,childAges}` **и** `travelersCount == Request.travelerCount` |
| `MISMATCH` | любое price-relevant расхождение: количество, возрастная категория ребёнка, отсутствие/наличие младенца |
| `UNKNOWN` | данных недостаточно: travelers отсутствуют/неполны, offer-snapshot отсутствует (Path B), состав лежит вне canonical полей (Path C `pinnedRequirements`), правило as-of/банды не определены |
| `NOT_APPLICABLE` | к commercial-условиям composition не привязана: legacy Request без snapshot/price (`commercialSnapshot = null`), supplier-измерение не поддерживается активным транспортом (childAges для Summer — до починки XHR) |

**Алгоритм сверки** (`REASONABLE DESIGN RECOMMENDATION`):

```text
1) factual  = RequestTraveler[] (authoritative для count: assertRequestTravelersMatchCount — CONFIRMED, request-travelers.ts:122-136)
2) derived  = Resolver(factual, asOfDate?, правило-из-решений)
3) frozen   = request.productSnapshot.offer  (Path A) | pinnedRequirements.passengers (Path C) | отсутствует (Path B)
4) state    = compare(derived, frozen) → MATCH | MISMATCH | UNKNOWN | NOT_APPLICABLE
5) decision = policy(state, lifecyclePoint)  → §G
```

**Где вызывать** (`REASONABLE DESIGN RECOMMENDATION`): в `assertTravelersReadyForCommercialStep` (`request.service.ts:689`, вызовы `:1087,:1324`) — единственная коммерческая граница accept/convert; в `convertRequestToOrder` рядом с `order.service.ts:766` (уже есть count-гейт); факультативно в `getPinnedRequirements`-проекции для UI-индикации (без изменения поведения).

**Authority при mismatch — `OWNER DECISION REQUIRED` (§O-4)**: код содержит обе «кандидатуры», но не выбирает: factual-authority (readiness/count-гейты опираются на travelers) vs frozen-authority (деньги приняты против snapshot'а: `freezeForAcceptance`, `convertMoney = confirmedPrice ?? displayedPrice`, `request.service.ts:82-87`).

---

## G. REPRICE POLICY

**`REASONABLE DESIGN RECOMMENDATION`** (политика не реализуется; §10 требует матрицу). Легенда: **B**=BLOCK, **R**=REPRICE, **W**=WARNING, **N**=NO ACTION.

| Сценарий | Request creation | customerAccept | Request→Order | Order final confirm | Order→Booking |
|---|---|---|---|---|---|
| count mismatch (travelers ≠ travelerCount) | N (счётчик задаётся в момент создания) | **B** — уже реализовано (`:689-706` throw) | **B** — уже реализовано (`assertRequestTravelersMatchCount`) | **B** — уже реализовано (`order.service.ts:2184-2188`) | **W** (сейчас: фильтр по `dataCompleteness`, `booking.subscribers.ts:125-139`) |
| age-band mismatch (derived ≠ offer) | N (Path A: состав = offer; фиксировать frozen) | **R** через существующий механизм `propose-price → PRICE_CHANGED → supplierPriceProposal` (`request.controller.ts:274`, `request.service.ts:912-915,1125-1126`); до proposal — **B** (не давать accept «вслепую») | **B** (не давать convert при несвёренном MISMATCH) | **W** (деньги Order заморожены; состав уже вне price-цепи) | **W** |
| DOB изменился после выбора offer | — | **R**/«W по TTL»: если supplier-price ещё валиден (`supplierPriceExpiresAt`) — повторный recheck в той же точке; если протух — **R** обязательно | **B** пока MISMATCH не снят | N | N |
| UNKNOWN (нет данных для сверки) | фиксировать source | **W** (продолжать можно, но состояние должно быть видимым — §23 «никакого silent mismatch») | **W** | N | N |
| NOT_APPLICABLE (нет commercial-привязки) | N | N | N | N | N |

Принцип: **никогда не пересчитывать цену молча** — любое движение цены проходит через уже существующие propose/confirm/reject-статусы (`request.controller.ts:264,274,284`), новые статусы не вводятся (§24).

---

## H. SUPPLIER MATRIX (§12)

| Supplier | Service | adults | children | childAges | infants | DOB | Notes |
|---|---|---:|---:|---:|---:|---:|---|
| SUMMERTOUR | tours | ✅ `ADULT` (`summertour.request-builder.ts:138`) | ✅ `CHILD` (`:139`) | ⚠️ строится (`:110-112`), **XHR не шлёт** (`:126-167`) | — | ❌ | active adapter `SummertourNewAdapter` (`supplier.module.ts:80,89`); AGE-гэп не чинить в этом аудите (§13) |
| KOMPAS | tours | ✅ (`kompas.adapter.ts:386`) | ✅ (`:388`) | ✅ `AGE1-3` (`:390-393`) | — | ❌ | до 3 детей; правила на стороне KOMPAS |
| ANEX | tours | ✅ (`anex.adapter.ts:270`) | ✅ (`:271`) | ⚠️ только первый (`:272`) | — | ❌ | 2-й/3-й ребёнок не влияет на price (§14) |
| ANEX | hotels | ✅ (`anex-hotel.adapter.ts:293`) | ✅ (`:294`) | ✅ CSV всех (`:279-295`) | — | ❌ | отдельный адаптер (`supplier.module.ts:190`) |
| KAZUNION | tours | ✅ (`kazunion-http.service.ts:584`) | ✅ (`:585`) | ✅ `AGE1-4` (`:617-619`) | — | ❌ | макс. 4 ребёнка |
| AZAL | flights | ✅ (`azal.http.service.ts:276`) | ✅ (`:277`) | ❌ нет поля | ✅ (`:278`) | ❌ `childrenDatesOfBirth: null` (`:208`) | `FlightSearchQuery.passengers` (`flight.types.ts:11-30`) |
| AVIASALES | flights | ✅ (`aviasales.http.service.ts:250`) | ✅ (`:251`) | ❌ нет поля | ✅ (`:252`) | ❌ | тот же flight-модель |

**Canonical → transport mapping (§12 диаграмма):**

```text
TravelerComposition {adults, children, childAges[], infants, ...}   ← БЕЗ AGE1/AGE2/AGE3/AGE4
        │
        ▼  adapter-owned mapping (существующие места трансформации)
Summer:  ADULT/CHILD            [summertour.request-builder.ts:138-139]   (AGE* — gap)
Kompas:  ADULT/CHILD + AGE1..3  [kompas.adapter.ts:386-393]
Anex T.: ADULT/CHILD + AGES(1st)[anex.adapter.ts:270-272]
Anex H.: ADULT/CHILD + AGES(csv)[anex-hotel.adapter.ts:293-295]
Kazunion:ADULT/CHILD + AGE1..4  [kazunion-http.service.ts:584-585,617-619]
AZAL:    adult/child/infant_count + passengersAmount  [azal.http.service.ts:276-278,200-204]
Avias.:  passengers{a,c,i}      [aviasales.http.service.ts:249-252]
```

---

## I. PATH A / PATH B (§11) (+ Path C — flights)

**PATH A — supplier offer → create request:**

| Признак | Наличие | Где |
|---|---|---|
| offer composition | ✅ frozen | `tour-request.service.ts:231-248` → `productSnapshot.offer` (`:267-275`); подтверждено БД (MKT-REQ-00000401: `adults:2, children:0, childAges:[]`) |
| supplier price | ✅ recheck при создании | `:135-145` (`displayedPrice = recheck.amount`) |
| productSnapshot | ✅ | `:267-275` |
| commercialSnapshot | ✅ (money-only) | `:204-213` |
| RequestTraveler[] | ❌ не создаётся при создании (добавляется позже через UI) | — |

Сравнение безопасно: **да** — обе стороны (frozen offer + derived from travelers) существуют после заполнения travelers.

**PATH B — buyer-created request:**

| Признак | Наличие | Где |
|---|---|---|
| offer | ❌ | `productSnapshot` без `offer` (БД: MKT-REQ-00000601/602) |
| supplier price | ❌ | `refreshPrice` в `request.service.ts` отсутствует; `displayedPrice` из dto (`:312`) |
| composition | ⚠️ только количество | `travelerCount = travelers.length` (`:264-270`) — `childAges/children` не существуют |
| commercialSnapshot | ❌ | БД: null |
| сравнение | **нельзя** (offer-side отсутствует) → состояние `UNKNOWN`/`NOT_APPLICABLE` | §F |

Нельзя молча применять Path A assumptions — **подтверждено**: здесь нет ни frozen-состава, ни supplier-цены.

**PATH C — flights (`azal.controller.ts:147-186`) — отдельный случай (§15):**

- `travelerCount = body.passengers?.adults ?? 1` (`:176`) — **дети и младенцы не входят в счётчик** (расхождение с фактическим составом уже при создании);
- composition сохранено **неканонично**: `pinnedRequirements: { ...body, supplierCode }` (`:181`) — внутри JSON requirements лежат `passengers`, `price`, `segments` (не только requirements-матрица);
- price — server-authoritative re-derive (`:150-152`), commercialSnapshot — есть (`:161-172`); `RequestTraveler[]` не создаётся → readiness/convert-гейты для Path C фактически неприменимы (convert упрётся в `assertRequestTravelersMatchCount` при travelerCount>0 и 0 travelers — `NOT CONFIRMED`, не исследовался в этом аудите глубже).

**Flights (§15) — Recommendation: `SEPARATE FLIGHT MODEL`.** Основания `CONFIRMED BY CODE`: собственные типы (`flight.types.ts:11-30`), поле `infants` отсутствует в тур-модели, `childAges` отсутствует во флейт-модели, DOB не используется, отдельные адаптеры/эндпоинты/запросы. Общая superset-модель потребовала бы полей без единого потребителя — абстракция ради абстракции (§4). Mapping boundary — на уровне `SupplierAdapter`/`FlightSupplierAdapter` (см. H).

---

## J. COMMERCIAL SNAPSHOT (§16)

**Должна ли canonical composition попадать в immutable snapshot? — `REASONABLE DESIGN RECOMMENDATION`: ДА, отдельным полем `travelerComposition`.**

- Зачем snapshot: он — источник денег для accept/convert (`request.service.ts:1124-1142`, `freezeForAcceptance` добавляет `customerAcceptedAt`), Gate F/Gate I evidence. Для расследования «почему эта цена была принята» must знать, **какой состав** её породил — сейчас этого нет (`interface CommercialSnapshot` — только supplierPrice/markup/publicPrice/discount/customerFinalPrice/priceSource/таймстемпы, `commercial-snapshot.ts`).
- Минимальное расширение (JSON, **не требует Prisma-миграции** — поле `commercialSnapshot Json?`, содержимое свободное):

```text
commercialSnapshot.travelerComposition = {
  adults, children, childAges, infants, source, frozenAt   // immutable, как и деньги
}
```

- Что immutable: composition **в момент принятия денег** (creation/accept freeze) — снимок для сверок и аудита.
- Что остаётся live в `RequestTraveler`: factual-данные (FIO/DOB) — редактируемы до `CONVERTED/REJECTED` (`assertTravelersEditable`, `request.service.ts` — throw по `CONVERTED`/`REJECTED`), потому что документы и правки живут именно там; composition **выводится** из них, но сверяется против заморозки.
- Решение о включении поля — `OWNER DECISION REQUIRED` (§O-6); реализация — §N.

---

## K. CACHE / FRESHNESS (§17)

**`CONFIRMED BY CODE`:**

| Слой | Ключ/идентичность | Composition в identity? |
|---|---|---|
| Supplier search cache | `deriveSearchKey(supplierCode, query, page)` — хэширует **весь** query (`supplier-cache.service.ts:157`, вызов `supplier-offer.service.ts:64`; тест `supplier-cache.service.spec.ts:70-83` доказывает различие по `adults`) | ✅ да |
| Supplier price cache | `derivePriceKey(code, externalOfferId, adults, children, childAges)` (`:164`, вызов `supplier-offer.service.ts:204-210`) | ✅ явно |
| Frontend calendar | `buildCacheKey` → `adults/children/childAges` + hotel/dates (`MonthlyCalendar.tsx:30-46`) | ✅ явно |
| TTL | `priceCacheTtlMs = 5min`, `searchCacheTtlMs = 5min` (`supplier.module.ts:107-108`); offer `expiresAt` 5min; AZAL recent-search TTL (`azal.controller.ts:168-170`) | — |

**Риски по §17:**
- `same hotel + same dates, different composition` → разные ключи → корректно: **разные цены**, отдельные обращения к поставщику (captcha/latency-нагрузка — существующий риск, не новый).
- `same composition, different dates` → тоже разные ключи (departureDate в query) → корректно.
- Инверсный риск: **mismatch composition при том же ключе невозможен** — цена в кэше уже привязана к composition; опасность только в том, что recheck идёт по замороженному `searchContext`, а не по текущим travelers (`supplier-offer.service.ts:196-224`) — т.е. stale-Composition уходит в price identity через snapshot, не через кэш.

**Рекомендация:** canonical composition должна оставаться частью future price identity (уже фактически есть); кэш в рамках аудита не менять (§17).

---

## L. PRIVACY (§18)

**`CONFIRMED BY CODE`:**
- Exact DOB хранится: `order.RequestTraveler.birthDate` (NOT NULL), `order.OrderTraveler.birthDate` (nullable), `CheckoutIntentTraveler.birthDate`;
- DOB **не передаётся поставщикам**: 0 hits в `supplier/**`; единственное DOB-подобное поле `childrenDatesOfBirth: null` (`azal.http.service.ts:208`);
- DOB маскируется в API (PII-gate/redaction: `order.service.ts:1854,1944-2007`, `canViewTravelerPii`), печатается в voucher (`documents/voucher.consumer.ts:173`), копируется в booking-outbox (`booking.subscribers.ts:254`);
- supplier-транспорт age-параметров принимает **только числа** (0-17 в UI, `AGE*` строки) → с точки зрения контрактов достаточно **derived age**, exact DOB технически не нужен.

**`OWNER DECISION REQUIRED` (§18):** policy «DOB vs derived age vs ничего — поставщикам» в repository отсутствует. Рекомендовать владельцу решение, не самостоятельно (§18). Где хранить exact DOB — уже определено кодом (RequestTraveler/OrderTraveler); где достаточно age — canonical `childAges` (derived).

---

## M. EDGE CASE MATRIX (§20)

| # | Сценарий | Current behavior (`CONFIRMED BY CODE`) | Risk | Recommended behavior (`REASONABLE DESIGN RECOMMENDATION`) | Authority |
|---|---|---|---|---|---|
| 1 | 2 взрослых, 0 детей | Стандарт Path A: `adults=2, children=0, childAges=[]` (`OfferModal.tsx:327-329`), snapshot+recheck | — | `MATCH` trivial; ничего не менять | composition = offer (frozen) |
| 2 | 2 взрослых, 1 ребёнок | `childAges=[n]` уходит в Kompas/Anex/Kazunion; Summer — теряет | цена Summer без возраста | сверка derived vs frozen; Summer-gap — отдельным решением | §O-1/§O-5 |
| 3 | 2 ребёнка разных возрастов | Anex Tours шлёт только первый (`anex.adapter.ts:272`) | price-риск скрыт (2-й ребёнок не учитывается) | state=MISMATCH не детектируется транспортом → пометить Anex Tours как «transport-limited»; не чинить в аудите | owner (§O-5) |
| 4 | Ребёнок перешёл в новый age band между поиском и поездкой | Нет механизма (нет as-of, нет пересчёта) | цена/доступность могли измениться; система молчит | фиксировать band на frozen `departureDate` (если §O-2 подтверждено) + TTL recheck при accept | §O-2 |
| 5 | travelerCount mismatch | readiness throw (`request.service.ts:699-706`), convert throw (`request-travelers.ts:122-136`), finalConfirm throw (`order.service.ts:2184-2188`) | — (уже закрыто) | оставить как есть | count authority = `travelerCount` (CONFIRMED) |
| 6 | RequestTraveler missing | readiness=false → accept/convert блокируются; Path A до заполнения travelers — «не готов» | buyer думает, что всё ок | state=`UNKNOWN` до заполнения; блок accept до `MATCH/NOT_APPLICABLE` | §O-5 |
| 7 | Duplicate position | `@@unique([requestId,position])` + P2002→409 (`request.service.ts:600-602,653-654`) | — | оставить | DB constraint |
| 8 | Missing birthDate | нормализация требует YYYY-MM-DD (`request-travelers.ts:59-81`), readiness=false | partial data в UI | блок до заполнения (уже) + `UNKNOWN` для сверки | `traveler-requirements.ts` (birthDate REQUIRED TOUR) |
| 9 | Selected offer без childAges | `childAges: length>0 ? ... : undefined` (`OfferModal.tsx:329`) → snapshot `[]` | `[]` vs «неизвестно» не различимы | ввести source/provenance (§D) чтобы отличать «0 детей» от «нет данных» | §D |
| 10 | Supplier не поддерживает возрастов (Summer active/AZAL) | childAges молча игнорируются (не сериализуются) | сверка избыточна в этом измерении | state по dimension `childAges` = `NOT_APPLICABLE` для такого supplier'а | supplier contract (§O-2) |
| 11 | Supplier только первый возраст (Anex Tours) | `AGES=childAges[0]` (`anex.adapter.ts:272`) | цена может не отражать 2-го ребёнка | пометить transport-limited; сверку вести по количеству, по age — warning | §O-5 |
| 12 | Supplier макс. 3/4 возраста (Kompas/Kazunion) | `AGE1-3` / `AGE1-4` | children>3 (Kompas) молча не помещаются | валидация на входе (search/create) — отдельная задача; в сверке — warning | §O-5 |
| 13 | Flight infants | `infants` в `passengers`; Path C `travelerCount` **без** infants/children (`azal.controller.ts:176`) | счётчик занижен → convert/finalConfirm гейты врут | отдельная flight-модель (§15): `travelerCount = adults+children+infants` либо явный flight-override | §O-7/flight |
| 14 | Path B без offer snapshot | сравнение невозможно (нет frozen-стороны) | молчаливое «всё ок» | state=`NOT_APPLICABLE` до появления supplier-предложения; либо обязательный recheck перед accept | §O-8 |
| 15 | Price snapshot expired | TTL 5min; accept — money-gate только (`:1143-1148`); есть `PRICE_CHANGED` flow (`:912-915`) | accept по протухшей цене при живом snapshot (деньги заморожены верно, но supplier может дать иную) | accept при истёкшем `supplierPriceExpiresAt` → REPRICE через propose-price | §O-5 |
| 16 | DOB изменён после выбора offer | edit разрешён до CONVERTED/REJECTED (`assertTravelersEditable`); сверки нет | silent mismatch (§23 запрет) | при сохранении travelers → recompute state; `MISMATCH` → REPRICE/W по §G | §O-4/§O-5 |
| 17 | Traveler добавлен/удалён после выбора цены | add ограничен `travelerCount` (`:579-583`), delete — только кол-во теряется (нет сверки состава) | состав offer'а и travelers расходятся | count-гейты уже ловят добавление сверх лимита; удаление до минимума → readiness падает; age-состав — по §G | §O-5 |

---

## N. IMPLEMENTATION BOUNDARIES (§19)

Схема §19 признана приемлемой; уточнение: сверка — не отдельный «шаг вперёд», а **встраивание в существующие гейты** (надёжнее, чем новая точка).

| Модуль/файл (будущие правки, НЕ выполняются сейчас) | Что |
|---|---|
| **NEW** `backend/src/modules/order/traveler-composition.ts` (рядом с `request-travelers.ts`) | `TravelerComposition` DTO (§D), Resolver (`RequestTraveler[] → composition`), `compareStates()` (`MATCH/MISMATCH/UNKNOWN/NOT_APPLICABLE`) |
| `backend/src/modules/order/request.service.ts` | вызов resolver+compare в `assertTravelersReadyForCommercialStep` (`:689`) → кидать BLOCK/W по §G; передать state в accept (`:1074`) |
| `backend/src/modules/order/order.service.ts` | рядом с `assertRequestTravelersMatchCount` (`:766`) — age-consistency на convert; (опц.) в `finalConfirm` (`:2160`) — WARNING |
| `backend/src/modules/supplier/tour-request.service.ts` | фиксация canonical composition рядом с `productSnapshot.offer` (`:231-248`); опц. запись в `commercialSnapshot.travelerComposition` (JSON — без миграции) |
| `backend/src/modules/pricing/commercial-snapshot.ts` | тип/валидация нового JSON-ключа `travelerComposition` (JSON-only, **без Prisma-миграции**) |
| `backend/src/modules/supplier/azal/azal.controller.ts` | Path C: пересмотреть `travelerCount` (`:176`) и содержимое `pinnedRequirements` (`:181`) — composition в canonical место |
| `backend/src/modules/supplier/*` adapters | **только** mapping layer canonical→transport (существующие точки: §H); НЕ трогать Summer AGE-gap без отдельного решения |
| `backend/src/modules/order/request-travelers.ts` | расширить readiness PROJECTION (индикация состояния, без изменения count-семантики) |
| Prisma schema | **не требуется** для composition (JSON), требуется только если owner решит новую колонку — избегать |
| Frontend Request/Order UI | отображение состояния consistency (отдельная фаза; сейчас запрещено) |

Что НЕ меняется: D3-gates семантика (расширяется, не ослабляется), lifecycle статусы (используются существующие `PRICE_CHANGED/confirm/reject`), pricing formulas, passport logic, supplier booking APIs (§3 запреты).

---

## O. OWNER DECISIONS (§21 — только то, что код не решает)

1. **Universal age bands для TravelHUB или supplier-specific only?** — в коде нет ни того, ни другого (§E класс A пуст; класс B — только транспорт). *Без решения resolver невозможен.*
2. **Age as-of date** — `NOT CONFIRMED` (§6): контракты/код семантики не задают. Кандидат: дата вылета/check-in frozen offer. *Требуется подтверждение поставщиками или решение владельца.*
3. **Exact DOB vs derived age vs ничего — поставщикам** — privacy-политики в репозитории нет (§L). Транспорт достаточно age; отправка DOB сейчас нулевая.
4. **Что authoritative при mismatch: `RequestTraveler[]` (factual) или frozen offer composition?** — код поддерживает оба в разных местах (§F).
5. **Mismatch → BLOCK / REPRICE / WARNING по точкам lifecycle** — предложена матрица (§G), финал — за владельцем; механизм REPRICE (propose-price/PRICE_CHANGED) уже существует (`CONFIRMED BY CODE`).
6. **Включать ли `travelerComposition` в commercialSnapshot?** — рекомендация «да, JSON-only» (§J); решение за владельцем.
7. **Path B без supplier offer** — как считать consistency: `NOT_APPLICABLE` до supplier-предложения или обязательный recheck перед accept? (§I, edge #14).
8. **Flight Path C (`travelerCount` без детей/infants; composition в `pinnedRequirements`)** — исправлять ли canonical-принадлежность при реализации (§I, edge #13).

Не задаются (ответы уже в коде): существует ли composition-транспорт (да, §C); входит ли composition в cache identity (да, §K); нужна ли сверка количества (уже реализована, §M-5); можно ли хранить DOB у поставщиков сейчас (не передаётся, §L); отдельна ли flight-модель (да, §15 → `SEPARATE FLIGHT MODEL`).

---

## P. TEST PLAN (для следующей implementation-фазы)

**Unit (новые):**
1. Resolver: DOB[] + as-of + bands → `TravelerComposition` (каждый класс из §5, включая отсутствие правил → ошибка «правило не сконфигурировано», а не дефолт).
2. `compareStates()`: все 4 состояния × Path A/B/C входы.
3. Гейты: accept при `MISMATCH` → BLOCK/REPRICE-событие; convert при `MISMATCH` → throw (параллельно существующему `assertRequestTravelersMatchCount`); count-регресс — не ослабить текущие 17 кейсов §M.
4. Snapshot: `commercialSnapshot.travelerComposition` замораживается и не меняется при edits travelers.
5. Cache: ключ price/search меняется при изменении canonical composition (регресс `supplier-cache.service.spec.ts:70-83`).

**Integration (существующие сьюты + новые):**
- `request-travelers.spec.ts`, `supplier-offer.service.spec.ts`, `supplier-cache.service.spec.ts`, `summertour.request-builder.spec.ts`, `price-calendar.spec.ts`, `anex*.spec.ts`, `kompas.adapter.spec.ts`, `kazunion.adapter.spec.ts` — регресс без изменений.
- E2E: Path A (MKT-REQ-00000401-подобный) — добавить traveler с «чужим» DOB → увидеть BLOCK/propose; Path B — accept без offer → `NOT_APPLICABLE`; flight Path C — travelerCount-семантика; конвертация → Order с composition-snapshot.
- Кросс-проверка БД: `productSnapshot.offer` ↔ `commercialSnapshot.travelerComposition` ↔ `Order.travelerCount` консистентны.

**Фазовые ворота:** §O-1..§O-8 закрыты → implementation prompt → strict review (по шаблону предыдущих фаз).

---

## Q. GIT / SAFETY

```text
no code changes     : подтверждаю — рабочее дерево содержит только pre-existing правки
                      предыдущего workstream (153 entries) + отчёты аудитов;
                      ни один .ts/.tsx/.prisma файл не изменялся в рамках этого аудита
no schema changes   : подтверждаю — backend/prisma/schema.prisma не трогался
no DB mutations     : подтверждаю — выполнялись только SELECT/information_schema
                      (db travelhub1; предыдущий аудит §32); INSERT/UPDATE/DELETE нет
no price changes    : подтверждаю — pricing/markup/commercialSnapshot не изменялись
no lifecycle changes: подтверждаю — статусы/gates не изменялись
no commit           : подтверждаю
no push             : подтверждаю
HEAD                : 75c6bea (unchanged)
tests executed      : npx jest supplier-cache.service supplier-offer.service --runInBand
                      → 2 suites / 23 tests PASS (08.10.2026, доказательство того,
                      что существующая cache/price-логика не затронута);
                      ранее тем же днём: 3 suites / 37 tests PASS
                      (summertour.request-builder, supplier-offer, request-travelers)
tests reviewed      : supplier-cache.service.spec.ts, supplier-offer.service.spec.ts,
                      request-travelers.spec.ts, summertour.request-builder.spec.ts,
                      price-calendar.spec.ts, anex.adapter.spec.ts, anex-hotel.adapter.spec.ts,
                      kompas.adapter.spec.ts, kazunion.adapter.spec.ts, tour-builder.service.spec.ts
files inspected     : §C/§N/§H (все перечисленные файлы; полный перечень — в §C и §N)
DB reads            : SELECT (order.Request/RequestTraveler, information_schema) в предыдущем аудите;
                      в этом аудите дополнительных обращений к БД не потребовалось
new files           : только настоящий отчёт
```

---

**Аудит завершён. IMPLEMENTATION не начинался (§3, §24). Следующий шаг — рассмотреть §O и вернуть решения владельца.**
