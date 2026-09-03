# PHASE 3 — PRE-STEP 3.12 — MARKETPLACE BOOKINGS / PAYMENTS REFERENCE NUMBER CONTRACT — AUDIT & REMEDIATION

## LANGUAGE REQUIREMENT — MANDATORY

Все отчёты, findings, root cause analysis, runtime evidence, архитектурные решения, выводы и verdict explanations по этой задаче должны быть преимущественно **на русском языке**.

Английский допускается только для технических identifiers, paths, API endpoints, model/DTO/class/method names, enums, CLI/Git commands, code snippets и standardized VERDICT strings.

**Hard acceptance criterion:** если итоговый отчёт преимущественно на английском языке, задача считается незавершённой.

Не включать plaintext secrets/passwords/tokens. Использовать redaction/placeholders.

---

## 1. STATUS

Это отдельная audit/remediation задача по Reference Number Contract.

Перед началом зафиксировать фактический:

```text
Starting SHA = git rev-parse HEAD
```

Не использовать старый SHA автоматически.

Не начинать следующий roadmap stage после этой задачи.

---

## 2. CONFIRMED RUNTIME FINDING

Фактический runtime сейчас:

```text
Orders    → MKT-ORD-*   ✅
Bookings  → BKG-*       ⚠️
Payments  → PAY-*       ⚠️
```

При ранее принятом canonical Marketplace contract ожидалось:

```text
Marketplace Order    → MKT-ORD-*
Marketplace Booking  → MKT-BKG-*
Marketplace Payment  → MKT-PAY-*
```

Storefront commerce:

```text
SF001-ORD-*
SF001-BKG-*
SF001-PAY-*
```

Storefront SaaS direct billing:

```text
SAAS-SF001-*
```

Следовательно, нужно проверить, является ли текущая ситуация:
- presentation bug;
- API mapping bug;
- legacy DB data;
- generator defect;
- partial implementation of Reference Number Contract;
- missing migration/backfill;
- mixed historical/new behavior;
- иной доказанный root cause.

---

## 3. GOAL

Проверить и при необходимости исправить **оба Marketplace entity types**:

```text
Bookings
Payments
```

Не ограничиваться только Payments.

Нужно доказать:

```text
Booking.referenceNumber
Payment.referenceNumber
```

на уровнях:

```text
DB
→ generator / creation flow
→ API
→ frontend
→ export
→ drill-down / related entity presentation
```

---

## 4. HARD RULE — NO PRESENTATION-ONLY PREFIX

Запрещено исправление вида:

```ts
`MKT-${booking.referenceNumber}`
`MKT-${payment.referenceNumber}`
```

если DB/API canonical value остаётся `BKG-*` / `PAY-*`.

Сначала доказать authoritative source.

Нельзя маскировать частичную реализацию Reference Number Contract frontend formatting-ом.

---

## 5. BOOKING AUDIT — MANDATORY

Для Marketplace Booking проверить:

### Existing historical records

Выбрать минимум несколько реальных записей из Booking Center и зафиксировать:

```text
Booking.id
Booking.referenceNumber
Booking.acquisitionSource
Booking.createdAt
related Order.id
related Order.referenceNumber
```

Показать:

```text
DB value
API value
UI value
Export value
```

### Newly created Booking

Обязательно проверить creation flow для новой Marketplace booking.

Создать/получить новую representative Booking через нормальный application flow и доказать:

```text
new Booking.referenceNumber = ?
```

Критический вопрос:

```text
новая Booking → BKG-* ?
или
новая Booking → MKT-BKG-* ?
```

Если новая запись получает `BKG-*`, значит текущий generator не соответствует canonical contract.

Если новая получает `MKT-BKG-*`, а старые остаются `BKG-*`, значит finding относится к historical normalization/backfill.

---

## 6. PAYMENT AUDIT — MANDATORY

Аналогично для Marketplace Payment.

Проверить historical records:

```text
Payment.id
Payment.referenceNumber
Payment.acquisitionSource
Payment.createdAt
Payment.paidAt
related Order.id
related Order.referenceNumber
```

DB → API → UI → Export.

### Newly created Payment

Обязательно проверить новый Marketplace payment через нормальный supported flow.

Критический вопрос:

```text
новый Payment → PAY-* ?
или
новый Payment → MKT-PAY-* ?
```

Если `PAY-*` продолжает генерироваться для новых Marketplace payments, Reference Number Contract реализован частично.

---

## 7. ORDER CONTROL GROUP

Orders сейчас визуально соответствуют:

```text
MKT-ORD-*
```

Использовать Orders как control group.

Проверить:

```text
existing Order.referenceNumber
new Order.referenceNumber
generator implementation
DB/API/UI/export
```

Цель — понять, почему Orders используют Marketplace namespace, а Bookings/Payments возможно нет.

Сравнить creation/generator code paths:

```text
Order generator
Booking generator
Payment generator
```

И установить exact divergence.

---

## 8. GENERATOR / SERVICE AUDIT

Найти все места генерации reference numbers для:

```text
Order
Booking
Payment
Request, если связан shared helper
Storefront equivalents
```

Проверить:
- shared helper / utility;
- hardcoded prefixes;
- default prefixes;
- channel/acquisitionSource branching;
- Marketplace vs Storefront branching;
- transaction/concurrency safety;
- retry uniqueness behavior;
- seed/test factories;
- migrations/backfills.

Составить matrix:

| Entity | Marketplace generator | Storefront generator | Current DB historical | New record result |
|---|---|---|---|---|
| Order | ? | ? | MKT-ORD-* | ? |
| Booking | ? | ? | BKG-* / ? | ? |
| Payment | ? | ? | PAY-* / ? | ? |

---

## 9. MIGRATION / BACKFILL AUDIT

Проверить, существовала ли ранее migration/normalization для:

```text
ORD-* → MKT-ORD-*
BKG-* → MKT-BKG-*
PAY-* → MKT-PAY-*
```

или equivalent.

Если Orders были migrated/backfilled, а Bookings/Payments нет — это нужно доказать.

Не выполнять массовый rewrite исторических IDs без анализа:
- uniqueness;
- external references;
- logs;
- tests;
- exports;
- URLs;
- related foreign relationships;
- audit/history;
- support references;
- idempotency.

Если safe migration необходима — описать и реализовать её transactionally/idempotently.

---

## 10. BOOKING CENTER PRESENTATION

После remediation Marketplace Booking Center должен показывать canonical business code:

```text
MKT-BKG-*
```

если это соответствует authoritative DB contract.

Не должно быть:

```text
BKG-*
```

для новых Marketplace bookings после fix.

Проверить:
- table;
- detail/360 if exists;
- filters/search;
- export CSV/XLSX;
- related Order reference;
- RU/AZ/EN.

---

## 11. PAYMENTS PRESENTATION

Marketplace Payments registry должен показывать:

```text
MKT-PAY-*
```

и related Order:

```text
MKT-ORD-*
```

а не UUID как основной business identifier.

Особенно проверить официальный drill-down:

```text
Аналитика
→ Финансовая сводка
→ Успешные платежи
→ Payments registry
```

---

## 12. SOURCE TRACEABILITY

Для Booking:

```text
Booking.referenceNumber
→ related Order.referenceNumber
→ related Payment referenceNumbers where applicable
```

Для Payment:

```text
Payment.referenceNumber
→ related Order.referenceNumber
→ related Booking referenceNumbers where applicable
```

Relations получать только по actual DB relation.

Не выводить related reference через guessed sequence.

---

## 13. EXPORT CONTRACT

Shared Table Export Framework должен показывать те же canonical references, что UI/API.

Проверить:

```text
Booking UI ref = Booking export ref = API/DB canonical ref
Payment UI ref = Payment export ref = API/DB canonical ref
```

Если export использует отдельный formatter, который маскирует DB mismatch — это failure.

---

## 14. SEARCH / FILTER COMPATIBILITY

Если users могут искать по referenceNumber, после remediation проверить:

```text
MKT-BKG-*
MKT-PAY-*
MKT-ORD-*
```

Search должен использовать canonical source.

Если historical aliases остаются поддерживаемыми временно, это должно быть явно задокументировано, а не возникать случайно.

---

## 15. MARKETPLACE / STOREFRONT ISOLATION

Hard invariant:

```text
Marketplace Booking → MKT-BKG-*
Storefront Booking  → SFxxx-BKG-*

Marketplace Payment → MKT-PAY-*
Storefront Payment  → SFxxx-PAY-*
```

Не определять authorization по prefix.

Prefix — presentation/business namespace.

Access остаётся server-authoritative по workspace/tenant/permissions/relations.

---

## 16. REFERENCE NUMBER IMMUTABILITY

Проверить canonical decision:

```text
referenceNumber — immutable business identifier
```

Если migration меняет historical values, описать это как controlled normalization и доказать, что:
- duplicates не создаются;
- relations не ломаются;
- external references risk оценён;
- change audit понятен.

Если исторические values нельзя безопасно менять, не скрывать это. Предложить documented legacy compatibility strategy.

---

## 17. RUNTIME VERIFICATION

Обязательная browser/runtime matrix:

### Orders — control

```text
existing Marketplace Order → MKT-ORD-*
new Marketplace Order      → MKT-ORD-*
```

### Bookings

```text
existing Marketplace Booking → ?
new Marketplace Booking      → ?
UI                            → ?
CSV                           → ?
XLSX                          → ?
```

После корректного remediation:

```text
new Marketplace Booking → MKT-BKG-*
```

### Payments

```text
existing Marketplace Payment → ?
new Marketplace Payment      → ?
UI                            → ?
CSV                           → ?
XLSX                          → ?
```

После корректного remediation:

```text
new Marketplace Payment → MKT-PAY-*
```

---

## 18. HISTORICAL DATA MATRIX

В отчёте показать counts:

```text
Marketplace Orders:
MKT-ORD-* = ?
ORD-*     = ?
other     = ?

Marketplace Bookings:
MKT-BKG-* = ?
BKG-*     = ?
other     = ?

Marketplace Payments:
MKT-PAY-* = ?
PAY-*     = ?
other     = ?
```

Отдельно Storefront populations.

Не смешивать Marketplace и Storefront.

---

## 19. CREATION FLOW TESTS

Добавить automated tests минимум:

### Order control

```text
Marketplace Order → MKT-ORD-*
```

### Booking

```text
Marketplace Booking → MKT-BKG-*
Storefront Booking  → SFxxx-BKG-*
```

### Payment

```text
Marketplace Payment → MKT-PAY-*
Storefront Payment  → SFxxx-PAY-*
```

Если SaaS payment flow реализован:

```text
Storefront SaaS payment → SAAS-SFxxx-*
```

Не создавать fake SaaS flow, если его нет.

---

## 20. CONCURRENCY / UNIQUENESS

Если генератор был изменён, сохранить concurrency-safe uniqueness.

Проверить:
- parallel creation;
- no duplicate reference numbers;
- retry behavior;
- DB unique constraints;
- tenant/workspace scoping as architecturally defined.

Не ухудшить ранее закрытый Reference Number Contract.

---

## 21. AUTOMATED TESTS

Backend:
- Order/Booking/Payment reference generation;
- Marketplace vs Storefront namespace;
- DB/API canonical exposure;
- relation references;
- export;
- search if applicable;
- uniqueness;
- concurrency where existing test pattern supports it.

Frontend:
- Booking canonical ref;
- Payment canonical ref;
- related Order business ref;
- export values;
- RU/AZ/EN;
- no UUID used as primary business identifier where reference exists.

---

## 22. TEST REPORTING — TRUTHFULNESS

Если:

```text
Frontend Tests = 282/283
```

писать:

```text
Frontend Tests: FAIL — 282/283
1 failing test: ...
classification: pre-existing / introduced
```

Не превращать partial fail в PASS.

---

## 23. REQUIRED REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_MARKETPLACE_BOOKINGS_PAYMENTS_REFERENCE_NUMBER_CONTRACT_REPORT.md
```

Отчёт обязан включать:

1. Starting SHA;
2. Implementation SHA;
3. Final SHA;
4. `HEAD == origin/master`;
5. runtime baseline `MKT-ORD / BKG / PAY`;
6. DB/API/UI/export matrix;
7. new-record creation results;
8. generator code-path comparison;
9. migration/backfill audit;
10. historical population counts by prefix;
11. Marketplace vs Storefront separation;
12. source traceability;
13. runtime screenshots/evidence;
14. tests;
15. security;
16. remaining legacy limitations;
17. final verdict.

---

## 24. ROADMAP

Если finding подтверждает partial implementation, additively обновить:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Зафиксировать:
- что ранее runtime показал `MKT-ORD-*`, но `BKG-*` / `PAY-*`;
- доказанный root cause;
- remediation/migration;
- real SHA;
- remaining legacy limitations.

Не переписывать историю и не объявлять весь PRE-STEP закрытым.

---

## 25. ACCEPTANCE CRITERIA

`VERDICT A` только если:

```text
[ ] DB authoritative values proven
[ ] API values proven
[ ] UI values proven
[ ] export values proven
[ ] new Marketplace Booking generation proven
[ ] new Marketplace Payment generation proven
[ ] Order control proven
[ ] generator divergence root cause proven
[ ] no frontend-only MKT prefix patch
[ ] Marketplace Booking canonical = MKT-BKG-* after fix
[ ] Marketplace Payment canonical = MKT-PAY-* after fix
[ ] Marketplace Order remains MKT-ORD-*
[ ] Storefront namespace remains isolated
[ ] historical migration/backfill decision documented
[ ] no relation corruption
[ ] source traceability uses real relations
[ ] search/export compatibility checked
[ ] uniqueness/concurrency preserved
[ ] security not weakened
[ ] RU/AZ/EN verified
[ ] tests truthfully reported
[ ] report predominantly Russian
[ ] real SHA
[ ] HEAD == origin/master
```

Если новые Marketplace Booking/Payment продолжают получать `BKG-*` / `PAY-*` — `VERDICT B`.

Если UI просто дорисовывает `MKT-` при legacy authoritative source — `VERDICT B`.

Если historical handling не определено — не объявлять full contract closure.

---

## 26. NON-GOALS

Не:
- менять Partner Performance attribution;
- менять Booking KPI semantics;
- менять GMV/Commission formulas;
- создавать новый Finance Center;
- переписывать arbitrary historical identifiers без safety analysis;
- начинать Step 3.12.

---

## 27. EXECUTION ORDER

```text
1. Record actual Starting SHA
2. Reproduce Orders/Bookings/Payments prefixes in runtime
3. Inspect historical DB values
4. Inspect API/UI/export values
5. Create/test new Marketplace Order/Booking/Payment
6. Compare generator code paths
7. Audit migrations/backfills
8. Prove root cause
9. Implement authoritative remediation
10. Handle historical records safely
11. Verify UI/export/source traceability
12. Verify Marketplace vs Storefront namespaces
13. Run tests
14. Runtime matrix
15. Report + roadmap
16. Git sync
17. Verdict
```

## CORE PRINCIPLE

```text
Channel / Workspace Context
        ↓
Canonical Business Namespace
        ↓
Authoritative referenceNumber
        ↓
DB
= API
= UI
= Export
= Drill-down
```

Для Marketplace один и тот же contract должен последовательно работать для Orders, Bookings и Payments.
