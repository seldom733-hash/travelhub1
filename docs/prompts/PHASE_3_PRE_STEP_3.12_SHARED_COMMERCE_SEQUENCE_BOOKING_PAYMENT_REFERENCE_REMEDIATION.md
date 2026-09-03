# PHASE 3 — PRE-STEP 3.12 — SHARED COMMERCE SEQUENCE — BOOKING & PAYMENT REFERENCE REMEDIATION

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**.

Обязательно на русском: Remediation/Implementation/Strict Review/Runtime Evidence reports, findings, root cause analysis, architecture/security decisions, conclusions и verdict explanations.

Английский разрешён для технических identifiers, paths, classes/methods/DTO/models/tables, API endpoints, HTTP statuses, Git/CLI, enums, permissions, code snippets и standardized VERDICT strings.

Если итоговый отчёт преимущественно на английском — задача незавершена.

Не включать plaintext passwords, tokens, secrets или credentials.

---

## 1. CONTEXT

Исходная реализация:

```text
Shared Commerce Sequence
+ Request Center
+ Supplier Response SLA
+ Customer Payment TTL
+ Historical Request Data

Starting SHA:       c5d1cba
Implementation SHA: f5468d6
Final HEAD:         f5468d6
origin/master:      f5468d6
```

Несмотря на заявленный backfill `commerceSequence`, runtime показывает, что Booking и Payment всё ещё используют legacy human-readable references вида:

```text
BKG-...
PAY-...
```

Следовательно, предыдущий `VERDICT A` не считается окончательно подтверждённым.

Цель этой задачи — узко закрыть Booking/Payment reference contract. После неё требуется отдельный Full Strict Review всей Shared Commerce Sequence + Request Center реализации.

---

## 2. CANONICAL COMMERCIAL REFERENCE CONTRACT

Marketplace transaction chain:

```text
MKT-REQ-00000001
MKT-ORD-00000001
MKT-BKG-00000001
MKT-PAY-00000001-1
MKT-PAY-00000001-2
```

Все сущности одной commercial chain используют один:

```text
commerceSequence = 00000001
```

V1:

```text
1 Order = 1 Booking
1 Order = 1..N logical Payments
```

Booking не получает независимый root.

Payment не получает независимый root.

---

## 3. HARD NON-REGRESSION — CRM / PARTNER CODES

Существующие master-data identifiers НЕ МЕНЯТЬ:

```text
Partner  → PRN-*
Customer → CRM-*
```

Запрещено превращать их в:

```text
MKT-PRN-*
MKT-CRM-*
```

`PRN-*` / `CRM-*` — persistent entity identity.

`MKT-REQ/ORD/BKG/PAY-*` — Marketplace commercial transaction identity.

---

## 4. AUDIT FIRST — NO BLIND PATCH

До изменений определить root cause отдельно для Booking и Payment.

Проверить:

- Prisma/schema и migrations;
- persisted `referenceNumber`/эквивалент;
- `commerceSequence`;
- Booking creation path;
- Payment creation path;
- generators;
- serializers/DTO;
- API selects/mappers;
- historical backfill;
- registry/detail UI;
- search;
- CSV/XLSX;
- drill-down;
- related entity columns;
- payment gateway attempts;
- tests.

Ответить evidence-based:

1. Где реально хранится `BKG-*`?
2. Где реально хранится `PAY-*`?
3. Почему backfill `commerceSequence` не привёл к canonical reference?
4. Legacy code хранится в DB или генерируется выше?
5. Как Booking связан с Order?
6. Как Payment связан с Order?
7. Как сейчас определяется Payment ordinal?
8. Есть ли orphan/inconsistent rows?
9. Есть ли collision risk?

Записать root cause в отчёт.

---

## 5. BOOKING CONTRACT

Authoritative chain:

```text
Booking
→ Order
→ Order.commerceSequence
```

Если:

```text
Order = MKT-ORD-00001452
```

то Booking:

```text
MKT-BKG-00001452
```

Historical Booking root должен выводиться через реальную FK relation `Booking → Order`, а не через legacy suffix.

Запрещено использовать как источник истины:

```text
replace("BKG-", ...)
COUNT()+1
MAX()+1
row order
legacy suffix parsing
```

при наличии authoritative Order relation.

Если есть Booking без валидного Order — перечислить их и обработать отдельно без выдумывания связи.

---

## 6. PAYMENT CONTRACT

Authoritative chain:

```text
Payment
→ Order
→ Order.commerceSequence
```

Canonical:

```text
MKT-PAY-{8-digit commerceSequence}-{logicalPaymentOrdinal}
```

Например:

```text
MKT-ORD-00001452
MKT-BKG-00001452
MKT-PAY-00001452-1
MKT-PAY-00001452-2
```

---

## 7. PAYMENT ORDINAL — CRITICAL SEMANTICS

Suffix `-1/-2/-3` означает **logical/business payment ordinal**, НЕ gateway retry.

Пример:

```text
Logical Payment #1
→ gateway attempt failed
→ retry failed
→ retry succeeded

Reference остаётся:
MKT-PAY-00001452-1
```

Новый отдельный partial/additional payment:

```text
MKT-PAY-00001452-2
```

Перед migration проверить actual Payment/gateway attempt model.

Для historical ordinal допустим deterministic ordering (`createdAt ASC`, затем `id ASC`) только если он соответствует реальной модели. Не превращать provider retries в отдельные business Payments.

---

## 8. CONCURRENCY + IDEMPOTENCY

Нельзя использовать naive:

```text
MAX()+1
COUNT()+1
```

без transactional/concurrency protection.

Проверить:

- Commerce Sequence allocator;
- concurrent Payment creation;
- unique constraints;
- Booking creation retry;
- Payment creation retry;
- provider callback/webhook replay.

Retry одной logical operation не должен менять canonical reference.

---

## 9. AUTHORITATIVE STORAGE

Нельзя закрыть задачу косметически:

```text
DB = BKG-123
API/UI = MKT-BKG-00000123
```

только за счёт formatter/string replacement.

Определить authoritative persisted reference contract.

Hard prohibition как решение:

```text
replace("BKG-", "MKT-BKG-")
replace("PAY-", "MKT-PAY-")
"MKT-" + legacyReference
```

Canonical identifier должен происходить из реального commercial root.

---

## 10. API / UI / RELATED REFERENCES

Booking API/UI:

```text
referenceNumber = MKT-BKG-xxxxxxxx
related Order   = MKT-ORD-xxxxxxxx
```

Payment API/UI:

```text
referenceNumber = MKT-PAY-xxxxxxxx-n
related Order   = MKT-ORD-xxxxxxxx
related Booking = MKT-BKG-xxxxxxxx
```

UUID остаётся internal relational ID, но не должен подменять business reference в предназначенных пользователю related-reference columns.

Проверить минимум:

```text
/app/requests
/app/orders
/app/bookings
/app/finance/payments
Analytics → Successful Payments
```

---

## 11. SEARCH

Search должен находить canonical references:

```text
MKT-REQ-00001452
MKT-ORD-00001452
MKT-BKG-00001452
MKT-PAY-00001452-1
```

Сохранить существующий partial search, если он является частью текущего contract.

---

## 12. CSV / XLSX

Hard invariant:

```text
DB
= API
= UI
= Search
= CSV
= XLSX
= Drill-down
```

Booking/Payment export должен содержать canonical references.

Business-facing related Order/Booking columns должны использовать human reference, а не UUID. Если технический ID также нужен, хранить отдельными колонками, например:

```text
orderId
orderReferenceNumber
```

---

## 13. HISTORICAL BACKFILL

Не менять historical commercial dates.

Booking:

```text
Booking → Order → commerceSequence
```

Payment:

```text
Payment → Order → commerceSequence
```

Не переаллочировать уже корректный Order root.

После backfill посчитать:

```text
Marketplace Orders total
Orders with commerceSequence
canonical MKT-ORD count

Marketplace Bookings total
Bookings with commercial root
canonical MKT-BKG count
legacy BKG count

Marketplace Payments total
Payments with commercial root
canonical MKT-PAY count
legacy PAY count
```

Acceptance target для Marketplace transaction population:

```text
legacy BKG-* = 0
legacy PAY-* = 0
```

Если существуют записи другого business domain — каждое исключение доказать и перечислить.

---

## 14. COLLISION AUDIT

Проверить:

```text
duplicate MKT-BKG references = 0
duplicate MKT-PAY references = 0
duplicate logical payment ordinal within same commercial root = 0
```

---

## 15. FULL-CHAIN RECONCILIATION

Дать минимум 5 representative chains:

1. Request → Order → Booking → one Payment;
2. legitimate Order → Booking → Payment без Request, если такой flow существует;
3. Order с несколькими logical Payments;
4. historical converted Request;
5. новая transaction после remediation.

Evidence table:

```text
commerceSequence
Request reference
Order reference
Booking reference
Payment reference(s)
Request UUID
Order UUID
Booking UUID
Payment UUID(s)
```

Expected:

```text
commerceSequence: 00001452

Request: MKT-REQ-00001452
Order:   MKT-ORD-00001452
Booking: MKT-BKG-00001452
Payment: MKT-PAY-00001452-1
```

---

## 16. CRM / PARTNER NON-REGRESSION

После migration доказать:

```text
Customer → CRM-* unchanged
Partner  → PRN-* unchanged
```

Проверить DB/API/runtime samples.

Не выполнять массовую CRM/Partner reference migration.

---

## 17. SECURITY

Reference number — traceability, не authorization.

Знание `MKT-BKG-*` или `MKT-PAY-*` не должно позволять читать чужую сущность.

Сохранить server-side workspace/tenant/permission checks.

Добавить/сохранить cross-tenant denial tests.

---

## 18. AUTOMATED TESTS

Минимум:

### Booking

- inherits Order `commerceSequence`;
- canonical `MKT-BKG-*`;
- historical backfill;
- idempotency;
- no independent root.

### Payment

- inherits Order root;
- canonical `MKT-PAY-*-n`;
- multiple logical Payments;
- retry does not increment logical ordinal;
- deterministic historical backfill;
- idempotency/concurrency.

### End-to-end contract

- API canonical reference;
- search;
- CSV;
- XLSX;
- related Order human reference;
- Analytics payment drill-down;
- `CRM-*` unchanged;
- `PRN-*` unchanged;
- cross-tenant denial.

---

## 19. TEST REPORTING — TRUTHFULNESS

Не называть suite `PASS`, если он не полностью зелёный.

Например:

```text
1375/1400
→ FAIL — 1375/1400
→ 25 failures classified as pre-existing
```

```text
282/283
→ FAIL — 282/283
→ 1 failure classified as pre-existing
```

Classification указывать отдельно от фактического результата suite.

---

## 20. BROWSER RUNTIME EVIDENCE — MANDATORY

Source/tests недостаточно.

В реальном browser/runtime проверить:

```text
Request Center
Orders Center
Booking Center
Payments
Analytics → Successful Payments drill-down
```

Показать representative full chain:

```text
MKT-REQ-xxxxxxxx
MKT-ORD-xxxxxxxx
MKT-BKG-xxxxxxxx
MKT-PAY-xxxxxxxx-1
```

Проверить direct URL/client navigation/refresh там, где применимо.

---

## 21. EXPORT RUNTIME EVIDENCE

Для Booking и Payment:

1. применить фильтр;
2. CSV export;
3. XLSX export;
4. сравнить canonical references;
5. доказать отсутствие legacy `BKG-*` / `PAY-*` в Marketplace export population.

---

## 22. REQUIRED REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_SHARED_COMMERCE_SEQUENCE_BOOKING_PAYMENT_REFERENCE_REMEDIATION_REPORT.md
```

Обязательные разделы:

1. Starting SHA
2. Finding
3. Booking root cause
4. Payment root cause
5. authoritative storage contract
6. migration/backfill
7. Booking implementation
8. Payment implementation
9. Payment ordinal semantics
10. API reconciliation
11. UI reconciliation
12. Search
13. CSV/XLSX
14. Drill-down
15. 5 representative chains
16. DB population counts
17. Collision audit
18. CRM/Partner non-regression
19. Security
20. Automated tests
21. Browser runtime evidence
22. Known remaining failures
23. Implementation SHA
24. Final HEAD
25. origin/master
26. `HEAD == origin/master`
27. Verdict

---

## 23. ROADMAP

Additively обновить:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Не переписывать историю.

Зафиксировать remediation как обязательное closure условие исходного Shared Commerce Sequence / Request Center этапа.

Не начинать Product Freshness.

Не начинать Step 3.12.

---

## 24. ACCEPTANCE CRITERIA

`VERDICT A` только если:

```text
[ ] Booking = MKT-BKG-{8-digit Order root}
[ ] Payment = MKT-PAY-{8-digit Order root}-{logical ordinal}
[ ] Booking root наследуется от Order
[ ] Payment root наследуется от Order
[ ] Payment ordinal semantics доказаны
[ ] gateway retry не создаёт новый logical ordinal
[ ] Marketplace legacy BKG-* = 0 или каждое исключение доказано
[ ] Marketplace legacy PAY-* = 0 или каждое исключение доказано
[ ] duplicate canonical Booking refs = 0
[ ] duplicate canonical Payment refs = 0
[ ] DB = API = UI = Search = CSV = XLSX = Drill-down
[ ] related Order отображается как MKT-ORD-* в business UI
[ ] Analytics payment drill-down canonical
[ ] минимум 5 full-chain reconciliations
[ ] CRM-* unchanged
[ ] PRN-* unchanged
[ ] tenant/security checks preserved
[ ] tests truthfully reported
[ ] browser runtime evidence
[ ] export runtime evidence
[ ] report predominantly Russian
[ ] real Implementation SHA
[ ] HEAD == origin/master
```

Если исправлен только frontend:

```text
VERDICT B
```

Если Booking получает independent root:

```text
VERDICT B
```

Если Payment suffix является gateway retry:

```text
VERDICT B
```

Если `CRM-*` или `PRN-*` переименованы:

```text
VERDICT B
```

---

## 25. NEXT STEP

После успешного `VERDICT A` этой remediation:

```text
НЕ запускать Product Freshness.
НЕ запускать Step 3.12.
```

Следующим отдельным этапом выполнить:

```text
FULL STRICT REVIEW

Shared Commerce Sequence
+ Request Center
+ Supplier Response SLA
+ Customer Payment TTL
+ Historical Request Data
+ Booking/Payment Reference Remediation
```

Только после успешного Full Strict Review переходить к следующему implementation stage.
