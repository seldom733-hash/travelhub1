# TRAVELHUB — CANONICAL TRAVELER COMPOSITION & PRICE CONSISTENCY
## READ-ONLY DESIGN / ARCHITECTURE AUDIT PROMPT

**Mode:** READ-ONLY / DESIGN ONLY

**Repository:** TravelHUB

**Purpose:** определить безопасную целевую архитектуру связи `RequestTraveler.birthDate` → canonical traveler composition → supplier-specific composition → selected offer / reprice → commercial snapshot, **без внесения изменений в код, БД, миграции, цены или lifecycle**.

---

# 1. КОНТЕКСТ

Предыдущий read-only audit установил:

- `RequestTraveler` уже существует и хранит `firstName`, `lastName`, `birthDate`, `position`.
- В текущей системе нет engine, который превращает DOB путешественников в `adults / children / childAges / infants`.
- Сейчас composition в основном приходит из UI search/calendar и передается в `SupplierSearchQuery`.
- RequestTraveler сейчас используется для readiness/validation/copying в Order, но не участвует в supplier pricing.
- Supplier transport неоднороден:
  - Summer строит AGE-параметры, но active XHR их не отправляет;
  - Kompas передает AGE1–AGE3;
  - Anex Tours передает только первый child age;
  - Anex Hotels передает все child ages CSV;
  - Kazunion передает AGE1–AGE4;
  - AZAL использует отдельную flight passenger model с aggregate counts.
- `commercialSnapshot` сейчас не содержит traveler composition.
- Selected offer хранит composition в offer snapshot.
- `customerAccept` сейчас не пересчитывает composition и не делает DOB-based reprice.
- Для Path B (`/buyer/requests`) полноценного offer composition snapshot может не быть.

Предыдущий audit дал VERDICT C: безопасная точка будущего подключения — boundary построения `SupplierSearchQuery` / readiness, но сначала необходимо спроектировать canonical composition.

---

# 2. ГЛАВНАЯ ЦЕЛЬ АУДИТА

Ответить на вопрос:

> Как TravelHUB должен безопасно получать canonical traveler composition из фактических `RequestTraveler.birthDate`, сопоставлять её с composition выбранного Offer, определять необходимость reprice/revalidation и затем корректно строить supplier-specific запросы, не ломая существующие supplier adapters и pricing lifecycle?

**Ничего не реализовывать.**

---

# 3. ЖЕСТКИЕ ОГРАНИЧЕНИЯ

Во время аудита:

- НЕ менять код;
- НЕ менять Prisma schema;
- НЕ создавать migration;
- НЕ менять БД;
- НЕ менять live Requests/Orders;
- НЕ менять цены/markup;
- НЕ вызывать supplier pricing для изменения данных;
- НЕ менять Request → Order → Booking lifecycle;
- НЕ менять D3 gates;
- НЕ добавлять passport logic;
- НЕ менять Traveler UI;
- НЕ делать commit;
- НЕ делать push.

Разрешено:

- чтение repository;
- чтение Prisma schema;
- чтение существующих tests;
- чтение adapter implementations;
- SELECT-only inspection тестовой/локальной БД, если требуется;
- построение архитектурных схем;
- подготовка рекомендаций и точных implementation boundaries.

Если какая-либо информация не подтверждается кодом, пометить её как `NOT CONFIRMED`.

---

# 4. ОБЯЗАТЕЛЬНО ИССЛЕДОВАТЬ

## 4.1 Canonical composition

Определить:

1. Существует ли уже подходящий canonical DTO/type/interface, который можно расширить.
2. Где лучше всего разместить canonical composition.
3. Какие поля должны быть в canonical composition минимум:
   - adults
   - children
   - childAges
   - infants
4. Нужны ли дополнительные поля:
   - travelersCount
   - ages
   - source
   - asOfDate
   - ageCalculationDate
   - compositionVersion
5. Нужно ли различать:
   - factual traveler data (`RequestTraveler`)
   - commercial composition
   - supplier transport composition.

Не создавать новую абстракцию только ради абстракции, если существующая может быть безопасно переиспользована.

---

# 5. DOB → AGE → COMPOSITION

Исследовать существующие правила возраста в repository.

Найти все места, где есть:

- infant threshold;
- child threshold;
- adult threshold;
- age calculation;
- birthDate calculation;
- child pricing rules;
- supplier-specific age rules.

Отдельно классифицировать:

### A. TravelHUB universal rule

Подтвержденное общее правило, которое можно использовать для canonical composition.

### B. Supplier-specific rule

Правило, которое нельзя переносить в universal engine.

### C. UI-only rule

Правило, которое существует только в frontend и не является надежным backend authority.

### D. Partner/tour-builder rule

Правило, которое не должно автоматически становиться общим pricing rule.

---

# 6. AS-OF DATE

Определить, относительно какой даты должен рассчитываться возраст:

- дата рождения;
- дата начала тура;
- дата вылета;
- дата check-in;
- дата поиска;
- другая дата.

Проверить существующие supplier contracts и search DTO.

Не придумывать универсальное правило, если supplier contract его не подтверждает.

Выдать recommendation:

- `CONFIRMED`
- `PARTIALLY CONFIRMED`
- `NOT CONFIRMED`

---

# 7. OFFER COMPOSITION

Исследовать точную структуру выбранного Offer.

Определить:

- где хранятся adults;
- где children;
- где childAges;
- есть ли infants;
- какие поля попадают в `productSnapshot`;
- какие поля попадают в `commercialSnapshot`;
- какие поля сохраняются в Request.

Показать точный путь:

```text
UI Search
  ↓
SupplierSearchQuery
  ↓
Supplier Offer
  ↓
Offer selection
  ↓
Request
  ↓
Customer Accept
  ↓
Order
```

Для каждого перехода показать, где composition сохраняется, изменяется или теряется.

---

# 8. REQUEST TRAVELERS

Исследовать:

- `RequestTraveler` model;
- create endpoint;
- update endpoint;
- validation;
- readiness;
- customerAccept;
- Request → Order conversion.

Ответить:

1. Может ли RequestTraveler быть authoritative source для factual traveler count?
2. Что делать при mismatch:

```text
Request.travelerCount != RequestTraveler[].length
```

3. Что делать при mismatch между:

```text
Derived composition
        vs
Selected Offer composition
```

4. Что делать, если traveler DOB изменился после выбора Offer?

---

# 9. PRICE CONSISTENCY MODEL

Спроектировать только логически, без реализации.

Целевая модель должна позволять:

```text
RequestTraveler[]
      ↓
Canonical Composition
      ↓
Compare with frozen Offer Composition
      ↓
MATCH ─────────────→ keep commercial terms
      │
      └─ MISMATCH ─→ revalidate / reprice
```

Определить точные состояния:

- `MATCH`
- `MISMATCH`
- `UNKNOWN`
- `NOT_APPLICABLE`

Или обосновать другой набор.

---

# 10. REPRICE POLICY

Определить, когда mismatch должен приводить к:

### A. BLOCK

Нельзя продолжать accept/convert без новой цены.

### B. REPRICE

Нужно повторно получить supplier price.

### C. WARNING

Можно продолжить, но требуется явное подтверждение.

### D. NO ACTION

Mismatch не влияет на коммерческие условия.

Для каждого сценария указать:

- Request creation;
- customerAccept;
- Request → Order;
- Order final confirmation;
- Order → Booking.

Не реализовывать policy.

---

# 11. PATH A / PATH B

Обязательно отдельно исследовать два существующих request creation paths.

## PATH A

Supplier offer → create request.

Проверить наличие:

- offer composition;
- supplier price;
- productSnapshot;
- commercialSnapshot.

## PATH B

Buyer-created request.

Проверить:

- есть ли offer;
- есть ли supplier price;
- есть ли composition;
- можно ли безопасно выполнять comparison.

Нельзя молча применять Path A assumptions к Path B.

---

# 12. SUPPLIER-SPECIFIC MAPPING

Создать матрицу:

| Supplier | Service | adults | children | childAges | infants | DOB | Notes |
|---|---|---:|---:|---:|---:|---:|---|

Минимум:

- SUMMERTOUR / tours
- KOMPAS / tours
- ANEX / tours
- ANEX / hotels
- KAZUNION / tours
- AZAL / flights
- AVIASALES / flights

Показать:

```text
Canonical Composition
        ↓
Supplier Adapter Mapping
        ↓
Supplier-specific request
```

Важно:

**Canonical composition не должен содержать supplier-specific AGE1/AGE2/AGE3/AGE4 поля.**

---

# 13. SUMMERTOUR ОСОБЫЙ СЛУЧАЙ

Отдельно подтвердить текущую ситуацию:

- AGE1–AGE3 строятся или не строятся;
- доходят ли они до active XHR;
- влияет ли childAge фактически на supplier price;
- что делает refreshPrice;
- что происходит при reprice после изменения traveler composition.

Не исправлять Summer в рамках этого аудита.

---

# 14. ANEX TOURS ОСОБЫЙ СЛУЧАЙ

Подтвердить:

- сколько child ages реально передается;
- что происходит с вторым/третьим ребенком;
- влияет ли это на price.

Не исправлять adapter в рамках аудита.

---

# 15. FLIGHTS

Не смешивать tour/hotel composition с flight passenger model.

Исследовать:

```text
FlightSearchQuery.passengers
```

и определить:

- можно ли использовать тот же canonical composition;
- какие поля flight-only;
- как infants должны быть представлены;
- влияет ли DOB на AZAL/Aviasales request;
- где возникает mapping boundary.

Recommendation должна явно сказать:

`SHARED CANONICAL MODEL` или `SEPARATE FLIGHT MODEL`.

---

# 16. COMMERCIAL SNAPSHOT

Определить, должна ли canonical composition попадать в immutable commercial snapshot.

Проверить существующую модель:

```text
supplierPrice
markup
publicDisplayPrice
individualDiscount
customerFinalPrice
priceSource
acceptedAt
```

Предложить минимальное расширение, например:

```text
travelerComposition
```

Но не менять schema.

Объяснить:

- зачем snapshot нужен;
- какие данные должны быть immutable;
- что должно остаться в live RequestTraveler.

---

# 17. CACHE / PRICE FRESHNESS

Исследовать cache keys и TTL.

Подтвердить, входит ли composition в cache identity.

Определить риск:

```text
same hotel + same dates
but different traveler composition
```

и наоборот:

```text
same composition
but different dates
```

Определить, должна ли canonical composition быть частью future price identity.

Не менять cache в рамках аудита.

---

# 18. DATA PRIVACY

Отдельно оценить:

- можно ли передавать DOB supplier;
- нужно ли передавать exact DOB или только derived age;
- где хранить exact DOB;
- где достаточно age.

Не делать privacy policy самостоятельно.

Если policy отсутствует — написать `OWNER DECISION REQUIRED`.

---

# 19. TARGET ARCHITECTURE

Сформировать рекомендуемую целевую схему.

Минимально проверить вариант:

```text
RequestTraveler[]
        │
        ▼
Traveler Composition Resolver
        │
        ▼
Canonical Traveler Composition
        │
        ├───────────────┐
        ▼               ▼
Offer Comparison   Supplier Mapping
        │               │
        ▼               ▼
Price Consistency   SupplierSearchQuery
        │               │
        └───────┬───────┘
                ▼
        Commercial Snapshot
```

Но не считать эту схему утвержденной заранее.

Если repository показывает более безопасную архитектуру — предложить её и объяснить почему.

---

# 20. FAILURE / EDGE CASES

Обязательно разобрать:

1. 2 взрослых, 0 детей.
2. 2 взрослых, 1 ребенок.
3. 2 взрослых, 2 ребенка разных возрастов.
4. ребенок достигает нового age band между поиском и поездкой.
5. travelerCount mismatch.
6. RequestTraveler missing.
7. duplicate position.
8. missing birthDate.
9. selected offer without childAges.
10. supplier does not support child ages.
11. supplier supports only first child age.
12. supplier supports max 3/4 child ages.
13. flight infants.
14. Path B without offer snapshot.
15. price snapshot expired.
16. traveler DOB changed after offer selection.
17. traveler added/removed after price selection.

Для каждого:

```text
Current behavior
Risk
Recommended behavior
Authority
```

---

# 21. НЕОБХОДИМЫЕ OWNER DECISIONS

В конце дать только решения, которые действительно нельзя определить по коду.

Минимально проверить:

1. Universal age bands для TravelHUB или supplier-specific only?
2. Age as-of date?
3. Exact DOB vs derived age to supplier?
4. Что считать authoritative при mismatch?
5. Mismatch → BLOCK / REPRICE / WARNING?
6. Нужен ли composition в commercialSnapshot?
7. Shared canonical model для flights или separate?
8. Как обрабатывать Path B без supplier offer?

Не задавать владельцу вопросы, на которые repository уже дает однозначный ответ.

---

# 22. ФОРМАТ FINAL REPORT

Финальный отчёт должен содержать:

## A. VERDICT

Одно из:

- `READY FOR IMPLEMENTATION DESIGN`
- `DESIGN BLOCKED — OWNER DECISIONS REQUIRED`
- `ARCHITECTURE RISK`

## B. EXECUTIVE SUMMARY

5–10 коротких пунктов.

## C. CURRENT ARCHITECTURE

С точными файлами и строками.

## D. CANONICAL COMPOSITION PROPOSAL

Точная структура DTO/type.

## E. DOB → COMPOSITION

Что подтверждено, что отсутствует.

## F. OFFER CONSISTENCY

Как сравнивать RequestTraveler-derived composition с selected offer.

## G. REPRICE POLICY

Рекомендуемая логика.

## H. SUPPLIER MATRIX

Все supplier/service combinations.

## I. PATH A / PATH B

Отдельно.

## J. COMMERCIAL SNAPSHOT

Рекомендация.

## K. CACHE / FRESHNESS

Рекомендация.

## L. PRIVACY

Что подтверждено / что требует owner decision.

## M. EDGE CASE MATRIX

Полная таблица.

## N. IMPLEMENTATION BOUNDARIES

Точные будущие файлы/modules, которые потребуется менять.

## O. OWNER DECISIONS

Только необходимые.

## P. TEST PLAN

Что должно быть проверено в следующей implementation phase.

## Q. GIT / SAFETY

Подтвердить:

- no code changes;
- no schema changes;
- no DB mutations;
- no price changes;
- no commit;
- no push.

---

# 23. КЛЮЧЕВОЙ ПРИНЦИП

Не пытаться сделать `RequestTraveler.birthDate` прямым supplier parameter.

Целевая архитектура должна разделять:

```text
FACTUAL TRAVELER DATA
RequestTraveler
        ↓
DERIVED COMMERCIAL COMPOSITION
adults / children / childAges / infants
        ↓
SUPPLIER-SPECIFIC TRANSPORT
AGE1 / AGE2 / AGE3 / CSV / passenger model / etc.
```

И отдельно:

```text
SELECTED OFFER COMPOSITION
        ↕
DERIVED REQUEST COMPOSITION
        ↓
PRICE CONSISTENCY DECISION
```

**Никакого silent mismatch.**

Если фактические travelers больше/меньше или их возрастная категория изменилась настолько, что это может влиять на цену/доступность, система должна иметь явно определенное состояние consistency и не должна молча продолжать со старой коммерческой ценой.

---

# 24. ЗАПРЕТ НА ИМПРОВИЗАЦИЮ

Не придумывать:

- новые supplier age rules;
- новые universal child thresholds;
- visa rules;
- passport rules;
- supplier booking APIs;
- новые pricing formulas;
- новые lifecycle transitions;
- новые statuses без доказательства необходимости.

Все выводы должны быть разделены на:

`CONFIRMED BY CODE`

`REASONABLE DESIGN RECOMMENDATION`

`OWNER DECISION REQUIRED`

---

# END
