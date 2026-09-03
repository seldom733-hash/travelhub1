# PHASE 3 — PRE-STEP 3.12 — PROJECT-WIDE COMMERCIAL REFERENCE PRESENTATION CONSISTENCY — REMEDIATION ROUND 2

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**.

Обязательно на русском: Remediation Report, Runtime Evidence, findings, root cause analysis, architecture/security decisions, reconciliation explanations, conclusions, recommendations и verdict explanations.

Английский разрешён только для технических identifiers: paths, classes/methods/DTO/models/tables, API endpoints, HTTP methods/status codes, Git/CLI commands, commit messages, enums, permissions, code snippets и standardized `VERDICT` strings.

Если итоговый отчёт преимущественно на английском — задача незавершена.

Не включать plaintext passwords, tokens, secrets или credentials.

---

# 1. CONTEXT

Предыдущая Project-Wide Commercial Reference Presentation Consistency remediation заявила:

```text
DB normalized
legacy ORD-* = 0
legacy BKG-* = 0
legacy PAY-* = 0

CRM 360:
Order   → MKT-ORD-* ✅
Booking → MKT-BKG-* ✅
```

Но фактический browser runtime показывает обратное.

Известные open P1 findings:

```text
CRM → Клиенты → Customer 360 → Заказы
→ ORD-*                                  ❌

CRM → Клиенты → Customer 360 → Бронирования
→ BKG-*                                  ❌

Orders Center → открыть Order
→ Связанные бронирования
→ BKG-*                                  ❌
```

Следовательно, предыдущий `VERDICT A` по presentation consistency недействителен.

Эта задача — Round 2 remediation именно по runtime contradiction.

---

# 2. HARD RULE

Runtime/browser evidence имеет приоритет над утверждением:

```text
"код исправлен"
"API возвращает referenceNumber"
"DB нормализована"
```

Если пользователь видит `ORD-*` / `BKG-*`, задача не считается закрытой.

---

# 3. NO FULL STRICT REVIEW YET

Не запускать и не закрывать Full Strict Review этой задачей.

Сначала устранить все известные runtime mismatches.

После успешного `VERDICT A` Round 2 будет отдельный Full Strict Review.

---

# 4. CANONICAL CONTRACT

Marketplace transaction references:

```text
Request → MKT-REQ-xxxxxxxx
Order   → MKT-ORD-xxxxxxxx
Booking → MKT-BKG-xxxxxxxx
Payment → MKT-PAY-xxxxxxxx-n
```

Master data:

```text
Customer → CRM-*   НЕ МЕНЯТЬ
Partner  → PRN-*   НЕ МЕНЯТЬ
```

---

# 5. KNOWN RUNTIME PATHS — MUST REPRODUCE FIRST

До исправлений воспроизвести именно эти три пути в browser/runtime.

## Path A

```text
CRM
→ Клиенты
→ открыть Customer 360
→ Заказы
```

Зафиксировать:

```text
actual displayed value = ORD-*
expected = MKT-ORD-*
```

## Path B

```text
CRM
→ Клиенты
→ открыть Customer 360
→ Бронирования
```

Зафиксировать:

```text
actual displayed value = BKG-*
expected = MKT-BKG-*
```

## Path C

```text
Orders Center
→ открыть конкретный Order
→ Связанные бронирования
```

Зафиксировать:

```text
actual displayed value = BKG-*
expected = MKT-BKG-*
```

Если разработчик не может воспроизвести — нельзя просто объявлять defect absent. Нужно сверить environment/data/route.

---

# 6. TRACE SAME UUID — MANDATORY

Для каждого из трёх runtime paths выбрать конкретную сущность и доказать, что сравнивается один и тот же UUID.

Для Order:

```text
Order UUID
commerceSequence
DB referenceNumber
DB code
API Customer 360 payload
UI source field
rendered value
```

Для Booking:

```text
Booking UUID
Order UUID
commerceSequence
DB referenceNumber
DB code
API payload
UI source field
rendered value
```

Не сравнивать разные записи по похожим номерам.

---

# 7. LEGACY FALLBACK IS NOW FORBIDDEN IN MARKETPLACE BUSINESS PRESENTATION

Предыдущая remediation использовала конструкции вида:

```ts
booking.referenceNumber ?? booking.code
```

или аналогичные.

Для Marketplace transaction entities в business UI это больше не принимается как final solution.

Если canonical DB contract гарантирует:

```text
referenceNumber is populated
```

то presentation/read DTO должен требовать canonical `referenceNumber`.

Не маскировать backend/read-model defect fallback'ом на legacy `.code`.

---

# 8. ACCEPTABLE FALLBACK POLICY

Legacy fallback может остаться только если доказано, что:

- surface обслуживает исторический/внешний non-Marketplace domain;
- canonical `referenceNumber` объективно отсутствует для допустимой записи;
- fallback документирован как compatibility-only;
- он не применяется к нормализованным Marketplace Orders/Bookings/Payments.

Для Marketplace population:

```text
missing referenceNumber
= defect
```

а не повод показать `ORD-*` / `BKG-*`.

---

# 9. REPOSITORY-WIDE SEARCH — SECOND PASS

Выполнить повторный полный поиск по проекту:

```text
.code
order.code
booking.code
payment.code
referenceNumber ??
?? .code
|| .code
ORD-
BKG-
PAY-
orderCode
bookingCode
paymentCode
bookingCodes
relatedBookings
customer 360
order detail
```

Проверить не только frontend, но и:

```text
DTO
mapper
serializer
query service
projection
nested include/select
read model
transform
API response enrichment
```

---

# 10. CRM CUSTOMER 360 — ORDERS

Найти фактический path:

```text
route/page
frontend fetch
API endpoint
backend service/query
DTO
mapping
```

Hard acceptance:

```text
same Order UUID

DB:
MKT-ORD-xxxxxxxx

API:
MKT-ORD-xxxxxxxx

Customer 360:
MKT-ORD-xxxxxxxx
```

Не допускается:

```text
API has referenceNumber
but frontend still binds to code
```

и наоборот.

---

# 11. CRM CUSTOMER 360 — BOOKINGS

То же самое:

```text
same Booking UUID

DB:
MKT-BKG-xxxxxxxx

API:
MKT-BKG-xxxxxxxx

Customer 360:
MKT-BKG-xxxxxxxx
```

Никакого `BKG-*` fallback для нормализованной Marketplace Booking.

---

# 12. ORDER DETAIL — RELATED BOOKINGS

Найти фактический Order detail read path.

Проверить nested/related booking representation.

Hard acceptance:

```text
Order detail
→ Related Bookings
→ MKT-BKG-xxxxxxxx
```

Если nested projection сейчас возвращает:

```text
booking.code
```

заменить на authoritative `booking.referenceNumber`.

Не генерировать reference во frontend.

---

# 13. BOOKING CENTER — RECHECK

Повторно проверить:

```text
/app/bookings
```

- table;
- drawer/sidebar;
- detail page;
- related Order.

Expected:

```text
Booking → MKT-BKG-*
Order   → MKT-ORD-*
```

---

# 14. PAYMENTS — RECHECK

Проверить:

```text
/app/finance/payments
```

и связанные views.

Expected:

```text
Payment → MKT-PAY-*-n
Order   → MKT-ORD-*
Booking → MKT-BKG-* where applicable
```

---

# 15. ANALYTICS / DRILL-DOWN — RECHECK

Проверить существующие:

```text
Analytics → Successful Payments
Partner Performance drill-down
other Orders/Bookings/Payments detail tables
```

Не оставлять legacy `ORD/BKG/PAY` в secondary read models.

---

# 16. ACCOUNT / CUSTOMER-FACING BOOKING VIEWS

Предыдущая remediation меняла account/bookings и account.service.

Обязательно проверить runtime, что там canonical reference действительно отображается.

Не считать изменение source code достаточным.

---

# 17. CSV / XLSX — RECHECK

Для Orders, Bookings, Payments:

```text
CSV
XLSX
```

проверить canonical refs и related refs.

Hard invariant:

```text
same entity UUID
→ same reference in UI and export
```

---

# 18. SEARCH — RECHECK

Проверить поиск по:

```text
MKT-ORD-*
MKT-BKG-*
MKT-PAY-*-n
```

Если legacy `ORD-*` / `BKG-*` всё ещё принимается для compatibility, UI result всё равно должен показывать canonical reference.

---

# 19. API CONTRACT — NO MIXED READ PATHS

Для одной сущности разные endpoints не должны возвращать разные business references.

Недопустимо:

```text
GET /orders
→ MKT-ORD-00000125

GET /crm/customers/:id
→ ORD-00000125
```

или:

```text
GET /bookings
→ MKT-BKG-00000125

GET /orders/:id
nested booking
→ BKG-00000125
```

Это primary target Round 2.

---

# 20. DTO CONTRACT

Если DTO предназначен для Marketplace Order/Booking/Payment business presentation:

```text
referenceNumber
```

должен быть обязательным, если authoritative model гарантирует его наличие.

Не создавать DTO contract, где `.code` остаётся равноправным display source для canonical Marketplace entity.

---

# 21. TYPE CONTRACT

Frontend types для нормализованных Marketplace transaction entities должны отражать canonical contract.

Если `referenceNumber` реально обязательный:

```ts
referenceNumber: string
```

предпочтительнее, чем:

```ts
referenceNumber?: string
```

если optionality только маскирует старый API defect.

Но менять optionality только после проверки всех legitimate records.

---

# 22. NO NEW DB MIGRATION UNLESS NEW EVIDENCE

Предыдущий audit заявил:

```text
legacy persisted ORD/BKG/PAY = 0
```

Round 2 сначала перепроверяет это.

Если DB по-прежнему normalized — не создавать новую migration.

Исправлять actual read/presentation paths.

---

# 23. SAME-ENTITY CROSS-VIEW MATRIX

Для минимум 5 Orders и 5 Bookings:

```text
UUID
DB referenceNumber
Primary API
Center UI
Customer 360
Order Detail related view
CSV
XLSX
```

где applicable.

Все значения должны совпадать.

---

# 24. REQUIRED KNOWN-FINDING EVIDENCE

В final report отдельная таблица:

| Finding | Before runtime | After runtime | Result |
|---|---|---|---|
| Customer 360 Orders | ORD-* | MKT-ORD-* | PASS/FAIL |
| Customer 360 Bookings | BKG-* | MKT-BKG-* | PASS/FAIL |
| Order Detail related Bookings | BKG-* | MKT-BKG-* | PASS/FAIL |

Без этой таблицы `VERDICT A` запрещён.

---

# 25. BROWSER RUNTIME — HARD REQUIREMENT

Browser evidence обязателен именно на реальных страницах.

Не принимать unit test, source screenshot или API curl как замену browser runtime.

Нужно открыть UI и доказать исправление.

---

# 26. DIRECT URL / CLICK / REFRESH

Для Customer 360, Order detail и Booking detail проверить:

```text
direct URL
client navigation
refresh
```

Canonical reference не должен зависеть от способа открытия страницы.

---

# 27. I18N

Reference numbers не локализуются.

Проверить RU/AZ/EN labels/placeholders вокруг canonical refs.

No raw i18n keys.

---

# 28. SECURITY

Reference presentation не меняет authorization.

Сохранить tenant isolation, workspace scope и role/permission checks.

Canonical `MKT-*` не должен использоваться как authorization proof.

---

# 29. AUTOMATED REGRESSION TESTS

Добавить regression tests минимум на известные баги:

```text
Customer 360 Order uses order.referenceNumber, not order.code
Customer 360 Booking uses booking.referenceNumber, not booking.code
Order detail related Booking uses booking.referenceNumber, not booking.code
```

Также, где соответствует архитектуре:

```text
Marketplace DTO does not silently fall back to legacy code
```

---

# 30. TEST REPORTING — TRUTHFUL

Фактический test result писать точно.

Если:

```text
282/283
```

то:

```text
FAIL — 282 passed / 283 total
1 failed
```

если именно это сообщает runner.

Не превращать pre-existing failure в PASS.

---

# 31. REQUIRED REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_PROJECT_WIDE_COMMERCIAL_REFERENCE_PRESENTATION_CONSISTENCY_REMEDIATION_ROUND_2_REPORT.md
```

Обязательные разделы:

1. Starting SHA
2. Current HEAD/origin
3. Reproduced runtime findings
4. DB truth recheck
5. One exact Order trace
6. One exact Booking trace
7. One exact Payment trace
8. Repository-wide second-pass inventory
9. Root cause Round 2
10. Legacy fallback audit
11. CRM Customer 360 Orders fix
12. CRM Customer 360 Bookings fix
13. Order Detail related Bookings fix
14. Booking Center recheck
15. Payments recheck
16. Analytics/drill-down recheck
17. Account/customer-facing views recheck
18. API/DTO contract
19. Search
20. CSV/XLSX
21. Same-entity cross-view matrix
22. Known-finding before/after runtime table
23. Security
24. RU/AZ/EN
25. Automated tests
26. Browser runtime evidence
27. Remaining gaps
28. Implementation SHA
29. Final HEAD
30. origin/master
31. `HEAD == origin/master`
32. Verdict

---

# 32. ACCEPTANCE CRITERIA

`VERDICT A` только если:

```text
[ ] Customer 360 Orders no longer show ORD-*
[ ] Customer 360 Bookings no longer show BKG-*
[ ] Order detail related Bookings no longer show BKG-*
[ ] same UUID = same canonical reference across views
[ ] Marketplace Order = MKT-ORD-* everywhere
[ ] Marketplace Booking = MKT-BKG-* everywhere
[ ] Marketplace Payment = MKT-PAY-*-n everywhere
[ ] Request = MKT-REQ-* everywhere applicable
[ ] no canonical Marketplace business UI fallback to legacy .code
[ ] API read paths consistent
[ ] DTO/read models consistent
[ ] Booking Center rechecked
[ ] Payments rechecked
[ ] Analytics/drill-down rechecked
[ ] Search canonical
[ ] CSV canonical
[ ] XLSX canonical
[ ] CRM-* unchanged
[ ] PRN-* unchanged
[ ] tenant/RBAC isolation preserved
[ ] regression tests added
[ ] browser runtime evidence specifically covers all 3 known findings
[ ] test results truthfully reported
[ ] report predominantly Russian
[ ] real Implementation SHA
[ ] HEAD == origin/master
```

---

# 33. HARD VERDICT B CONDITIONS

`VERDICT B` если хотя бы один known runtime defect остаётся:

```text
Customer 360 Orders → ORD-*
Customer 360 Bookings → BKG-*
Order detail related Bookings → BKG-*
```

Также `VERDICT B`, если:

```text
fix = frontend string prefix reconstruction
Marketplace DTO still depends on legacy .code fallback
same UUID differs across read paths
browser runtime evidence absent
CSV/XLSX/API still inconsistent
```

---

# 34. ROADMAP

Additively обновить:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Не переписывать историю.

Зафиксировать Round 2 как обязательный closure перед Full Strict Review.

---

# 35. STOP CONDITION

После remediation + browser evidence + report + commit:

```text
STOP.
```

Не запускать автоматически:

```text
Full Strict Review
Product Freshness
Step 3.12
```

Следующий этап после успешного `VERDICT A`:

```text
PHASE 3 — PRE-STEP 3.12
SHARED COMMERCE SEQUENCE + REQUEST CENTER
FULL STRICT REVIEW
```
