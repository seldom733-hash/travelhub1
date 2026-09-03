# PHASE 3 — PRE-STEP 3.12 — PLATFORM vs STOREFRONT SCOPE RE-QUALIFICATION + COMMAND CENTER BUSINESS SEPARATION — ROUND 2

## ТИП ЗАДАЧИ

**STRICT RE-QUALIFICATION + TARGETED REMEDIATION + RUNTIME/API EVIDENCE**

```text
Starting SHA: f38358a
```

Round 1 исправил базовый operational scope:

```text
Platform Orders   → MARKETPLACE only
Platform Bookings → MARKETPLACE only
Platform Payments → MARKETPLACE only
```

Storefront test/demo data сохранены для Partner / Storefront Workspace.

Однако `VERDICT A` Round 1 нельзя считать полной cross-surface квалификацией: часть обязательных evidence не представлена, а Platform Command Center всё ещё визуально/семантически смешивает Marketplace business и Storefront SaaS business в одной секции `Маркетплейс`.

Цель Round 2:

1. перепроверить Platform data scope по всем затронутым поверхностям;
2. доказать server-side isolation и отсутствие Storefront commerce в Platform Marketplace metrics;
3. разделить Command Center на **Marketplace** и **Storefront SaaS**;
4. проверить семантику каждой Storefront-карточки до её сохранения;
5. подтвердить сохранность Storefront dataset и tenant isolation;
6. синхронизировать canonical roadmap/documentation;
7. только после полного evidence дать финальный verdict.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose documentation должны быть преимущественно **на русском языке**:

- Implementation Report;
- Remediation Report;
- Strict Review Report;
- Evidence / Runtime Report;
- Gap Audit;
- findings explanations;
- root cause analysis;
- architecture decisions;
- security findings;
- runtime evidence descriptions;
- conclusions/recommendations;
- verdict explanations.

Английский допустим только для technical identifiers: file paths, class/method/DTO/model/table names, endpoints, HTTP methods/status codes, CLI/Git commands, SQL, enums, permission identifiers, code snippets, commit messages и standardized `VERDICT` strings.

Если отчёт преимущественно английский — задача не завершена и `VERDICT A` запрещён.

---

# 1. CANONICAL BUSINESS CONTRACT — DO NOT CHANGE

```text
MARKETPLACE
→ operational + commercial Marketplace business of TravelHub
→ Platform Workspace

STOREFRONT COMMERCE
→ Storefront partner's own customer business
→ Partner / Storefront Workspace
→ NOT Platform Marketplace commerce

STOREFRONT → TRAVELHUB
→ subscription / direct SaaS charges
→ Platform SaaS economics
```

Hard invariants:

```text
Storefront Commerce Volume ≠ Marketplace GMV ≠ TravelHub Revenue
```

```text
Platform Orders   = Marketplace operational Orders
Platform Requests = Marketplace operational Requests
Platform Bookings = Marketplace operational Bookings
```

Storefront operational records **НЕ удалять и НЕ reassigned**.

---

# 2. ROUND 1 RESULT TO RE-QUALIFY

Round 1 reported:

```text
Orders:
ALL          1516
MARKETPLACE  1085
STOREFRONT    431
Platform UI/API after remediation → 1085

Bookings:
ALL          692
MARKETPLACE  405
STOREFRONT   287
Platform UI/API after remediation → 405

Payments:
ALL          816
MARKETPLACE  484
STOREFRONT   332
Platform UI/API after remediation → 484
```

Storefront preserved:

```text
Orders   431
Bookings 287
Payments 332
Deleted  0
Reassigned 0
```

Эти значения являются **reference evidence**, а не hardcoded product truth. Получить фактические runtime/DB counts заново.

---

# 3. COMMAND CENTER — REQUIRED BUSINESS SEPARATION

Текущее runtime-состояние показывает одну секцию `Маркетплейс`, внутри которой одновременно присутствуют Marketplace и Storefront показатели, например:

```text
СЕАНСЫ MARKETPLACE
СЕАНСЫ STOREFRONT
ПАРТНЁРЫ MARKETPLACE
ПАРТНЁРЫ STOREFRONT
ПОКУПАТЕЛИ MARKETPLACE
ПОКУПАТЕЛИ STOREFRONT
MRR STOREFRONT
ARR STOREFRONT
ПОЛУЧЕНО
К ОПЛАТЕ
```

Это необходимо исправить.

Target IA:

```text
Platform Command Center
│
├── Marketplace
│   ├── Marketplace partners
│   ├── Marketplace customers
│   ├── Marketplace activity/session metric — только если semantics доказана
│   └── другие Marketplace-specific KPI
│
└── Storefront SaaS
    ├── Storefront partners
    ├── Active subscriptions — если authoritative source существует
    ├── MRR — если authoritative source существует
    ├── ARR — если authoritative source существует
    ├── Subscription revenue / Получено — если semantics доказана
    ├── Amount due / К оплате — если semantics доказана
    └── другие direct TravelHub↔Storefront SaaS KPI
```

Marketplace и Storefront SaaS должны быть визуально отдельными секциями с отдельными заголовками.

Не создавать отдельный второй Command Center.

---

# 4. DO NOT BLINDLY MOVE EXISTING STOREFRONT CARDS

Перед переносом каждой Storefront-карточки доказать её business semantics и authoritative source.

Обязательная таблица:

| Current card | Exact formula/source | Business meaning | Keep in Platform? | Target section |
|---|---|---|---:|---|
| Сеансы Storefront | ... | ... | YES/NO | ... |
| Партнёры Storefront | ... | ... | YES/NO | Storefront SaaS |
| Покупатели Storefront | ... | ... | YES/NO | ... |
| MRR Storefront | ... | ... | YES/NO | Storefront SaaS |
| ARR Storefront | ... | ... | YES/NO | Storefront SaaS |
| Получено | ... | ... | YES/NO | ... |
| К оплате | ... | ... | YES/NO | ... |

Если authoritative source отсутствует или semantics не соответствует Platform business scope — карточку не сохранять только ради текущего UI.

---

# 5. `ПОКУПАТЕЛИ STOREFRONT` — SPECIAL CHECK

Canonical rule:

```text
Storefront end-customers
→ Storefront partner's customers
→ Partner / Storefront CRM & Analytics
```

Они не должны автоматически становиться Platform Marketplace customers.

Проверить текущую карточку `ПОКУПАТЕЛИ STOREFRONT`.

Если это количество end-customers Storefront commerce:

```text
REMOVE from Platform Command Center
```

Данные сохранить для Storefront Partner Workspace.

Если метрика означает не end-customers, а другой Platform-relevant concept — доказать это source/formula evidence и переименовать однозначно.

---

# 6. `СЕАНСЫ STOREFRONT` — SPECIAL CHECK

Выяснить точную semantics.

Если это:

```text
Storefront partner/admin SaaS sessions in TravelHub
```

метрика потенциально допустима в `Storefront SaaS`.

Если это:

```text
Storefront website visitor/customer sessions
```

это Partner-owned web analytics и не должно быть Platform Marketplace KPI.

Не принимать решение по названию. Доказать source/query/formula.

---

# 7. `MRR / ARR / ПОЛУЧЕНО / К ОПЛАТЕ` — SOURCE PROOF

Для каждой карточки доказать:

```text
source table/model
query/formula
status scope
period semantics
currency semantics
whether payment is Storefront→TravelHub
```

MRR/ARR должны отражать SaaS subscription economics, а не Storefront customer sales.

`Получено` должно быть однозначно определено. Если это subscription payments received by TravelHub — допустимо в Storefront SaaS.

`К оплате` аналогично должно отражать direct Storefront→TravelHub receivable/subscription obligation, а не Storefront customer receivable.

Если текущая модель не позволяет это доказать — зафиксировать gap. Не подменять Storefront commerce SaaS revenue.

---

# 8. PLATFORM ORDERS — RE-QUALIFICATION

Повторно доказать:

```text
DB MARKETPLACE population = X
Platform Orders API total = X
Platform Orders UI total = X
Storefront IDs returned = 0
```

Выбрать известный Storefront Order ID и проверить direct Platform API/detail access.

Expected:

```text
Platform operational context → unavailable/excluded
Storefront record in DB → preserved
```

---

# 9. PLATFORM REQUESTS — RE-QUALIFICATION

Найти фактический canonical domain для `Заявки / Requests`.

Если реализован:

```text
Platform Requests → Marketplace only
```

Доказать DB/API/UI counts и Storefront exclusion.

Если отдельного capability нет:

```text
NOT IMPLEMENTED
```

Не создавать новую domain entity в Round 2.

---

# 10. PLATFORM BOOKINGS — RE-QUALIFICATION

Доказать:

```text
DB MARKETPLACE population = X
Platform Booking API total = X
Platform Booking UI total = X
Storefront IDs returned = 0
```

Known Storefront Booking ID:

```text
Platform detail/API → excluded
DB → preserved
correct Storefront tenant → accessible where capability exists
```

Не менять Booking KPI semantics в этой задаче, кроме удаления Storefront population из Platform calculations.

---

# 11. PLATFORM PAYMENTS — BUSINESS RE-QUALIFICATION

Не считать простой `MARKETPLACE/STOREFRONT` filter достаточным.

Обязательно различить:

```text
A. Marketplace customer payment
→ Platform Marketplace finance

B. Storefront customer commerce payment
→ Storefront Partner finance
→ NOT Platform Marketplace finance

C. Storefront subscription/direct payment to TravelHub
→ Platform SaaS finance
```

Проверить, позволяет ли текущая Payment model различать B и C.

Если discriminator/payment-purpose отсутствует — зафиксировать architecture gap. Не создавать новый finance engine в Round 2.

Для текущего Platform Marketplace Payments доказать:

```text
Storefront customer commerce payments excluded
Marketplace population exact
```

---

# 12. PLATFORM GMV / REVENUE / COMMISSION / REFUNDS

Перепроверить все соответствующие Platform KPI/API calculations.

Обязательные questions:

```text
Does Marketplace GMV contain any Storefront commerce? → must be NO
Does Marketplace Commission contain any Storefront commerce? → must be NO
Does Marketplace Revenue use Storefront own sales? → must be NO
Do Marketplace Refunds contain Storefront commerce refunds? → must be NO
```

Для каждой существующей metric дать:

```text
formula
source
scope
DB/reference result
API result
UI result
```

Если metric не существует — `NOT IMPLEMENTED`.

---

# 13. PLATFORM CRM CUSTOMERS

Проверить Platform Marketplace customer population.

```text
Marketplace customers
→ customers with relevant Marketplace business activity
```

Storefront end-customers:

```text
→ NOT Marketplace customer population merely because they exist in shared DB
```

Доказать counts/source and exclusion.

Storefront customer data не удалять.

---

# 14. PARTNER PERFORMANCE

Проверить, не используются ли Storefront own sales/orders/bookings/customer payments как Marketplace Partner Performance.

Разделить:

```text
Marketplace partner performance
```

от:

```text
Storefront partner's own commerce
```

и:

```text
Storefront SaaS relationship with TravelHub
```

Не менять unrelated Partner 360 functionality.

---

# 15. ANALYTICS + COMMAND CENTER CROSS-CHECK

Для одинаковых Marketplace metrics одна и та же population должна давать согласованные значения в:

```text
Command Center
Analytics
source registry/detail
```

Пример contract:

```text
Marketplace Orders KPI
→ drill-down/source population
→ exact same scope
```

Проверить, что после удаления Storefront commerce из Platform metrics drill-down не возвращает Storefront records.

---

# 16. STOREFRONT DATA PRESERVATION

Storefront test/demo data необходимы для functional readiness.

Повторно показать counts:

```text
Storefront Orders
Storefront Requests (если domain существует)
Storefront Bookings
Storefront Payments
Storefront Customers
```

Обязательно:

```text
Deleted = 0
Reassigned = 0
```

если нет отдельно доказанной corrupted record remediation.

---

# 17. PARTNER / STOREFRONT WORKSPACE FUNCTIONAL DATA

Не требуется в Round 2 реализовывать отсутствующие Partner UI Centers.

Но для уже существующих capabilities доказать, что Storefront test data не потеряны и доступны в правильном tenant context.

Conceptual contract:

```text
Storefront Partner A
→ own Orders/Bookings/Customers/Payments only

Storefront Partner B
→ own data only
```

---

# 18. TENANT ISOLATION — REQUIRED EVIDENCE

Минимум для существующих Storefront capabilities:

```text
Partner A cannot read Partner B Order
Partner A cannot read Partner B Booking
Partner A cannot read Partner B Payment
```

Если конкретный endpoint/capability отсутствует — явно указать.

`acquisitionSource=STOREFRONT` не является tenant isolation.

---

# 19. DIRECT API BYPASS — REQUIRED

Для Platform internal user попытаться вручную запросить known Storefront records через:

```text
query parameter
filter manipulation
detail endpoint
known ID
```

Frontend hiding не считается security/business-scope proof.

Expected:

```text
Platform operational endpoint
→ cannot expose Storefront commerce record
```

---

# 20. REQUIRED APPLICABILITY MATRIX

В финальном отчёте:

| Surface / Metric | Marketplace commerce | Storefront commerce | Storefront→TravelHub SaaS |
|---|---:|---:|---:|
| Platform Orders | ✅ | ❌ | N/A |
| Platform Requests | ✅ | ❌ | N/A |
| Platform Bookings | ✅ | ❌ | N/A |
| Platform Marketplace GMV | ✅ | ❌ | N/A |
| Platform Marketplace customer payments | ✅ | ❌ | ❌ |
| Platform Marketplace commission | ✅ | ❌ | ❌ |
| Platform Marketplace refunds | ✅ | ❌ | ❌ |
| Platform CRM customers | ✅ | ❌ | N/A |
| Command Center Marketplace | ✅ | ❌ | ❌ |
| Command Center Storefront SaaS | ❌ | ❌ | ✅ |
| Storefront Partner Orders | ❌ | ✅ own tenant | N/A |
| Storefront Partner Bookings | ❌ | ✅ own tenant | N/A |
| Storefront Partner customer payments | ❌ | ✅ own tenant | ❌ |
| Storefront subscription billing | ❌ | N/A | ✅ |

Для отсутствующих capabilities использовать `NOT IMPLEMENTED`.

---

# 21. COMMAND CENTER UI ACCEPTANCE

После remediation Platform Command Center должен визуально показывать разные business domains.

Пример:

```text
🛍 Marketplace
[Marketplace partners]
[Marketplace customers]
[Marketplace activity ...]

🏪 Storefront SaaS
[Storefront partners]
[Active subscriptions]
[MRR]
[ARR]
[Subscription revenue]
[Amount due]
```

Точные карточки определяются только после semantic/source audit.

Не показывать `Покупатели Storefront` в Platform только ради симметрии с Marketplace.

Не показывать fake/placeholder SaaS metrics.

---

# 22. I18N

Новые/изменённые labels должны иметь RU/AZ/EN localization согласно существующему i18n contract.

Не оставлять raw keys.

Русский runtime должен быть полностью локализован.

---

# 23. AUTOMATED TESTS

Добавить/обновить targeted tests минимум для существующих capabilities:

```text
Platform Orders excludes Storefront
Platform Bookings excludes Storefront
Platform Payments Marketplace scope excludes Storefront commerce
Platform Marketplace GMV excludes Storefront commerce
Platform Marketplace Commission excludes Storefront commerce
Platform Marketplace Refund metrics exclude Storefront commerce
Platform CRM Marketplace customers exclude Storefront end-customers
Command Center Marketplace metrics exclude Storefront commerce
Command Center Storefront SaaS cards use SaaS-authoritative sources
Storefront dataset remains preserved
Direct Platform API cannot bypass scope
Partner tenant isolation holds
```

Для отсутствующей functionality — documented gap, не fake test.

---

# 24. REQUIRED TEST / RUNTIME GATES

Запустить и предоставить evidence:

```text
Frontend typecheck
Frontend tests
Frontend build
Backend build/typecheck
Backend targeted tests
Relevant integration/API tests
Relevant E2E
```

А также runtime/browser evidence для изменённого Command Center и operational centers.

Если полный E2E невозможно выполнить — объяснить конкретную причину и не выдавать недоказанный gate за PASS.

---

# 25. CANONICAL DOCUMENTATION / ROADMAP — REQUIRED

Проверить и additively обновить canonical roadmap:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Зафиксировать минимум:

```text
Storefront Commerce Volume ≠ Marketplace GMV ≠ TravelHub Revenue
```

```text
Platform Orders / Requests / Bookings = Marketplace operational scope only
```

```text
Storefront test/demo commerce data is preserved for Partner Workspace functional verification
```

```text
Platform Storefront economics = direct Storefront→TravelHub SaaS relationship,
not Storefront customer commerce
```

и Command Center IA:

```text
Marketplace section
≠
Storefront SaaS section
```

Историю предыдущих stages/SHAs не переписывать и не удалять.

---

# 26. OUT OF SCOPE — HARD STOP

Не выполнять в Round 2:

```text
Global Currency Presentation remediation
FX
Treasury
Partner Settlement
new Finance Center
Booking KPI Semantics redesign
public marketplace redesign
full Partner Analytics redesign
Step 3.12
unrelated refactoring
```

---

# 27. HARD ACCEPTANCE GATES

Финальный `VERDICT A` разрешён только если доказано:

```text
A. Platform Orders = Marketplace-only server-side + UI
B. Platform Requests = Marketplace-only или честно NOT IMPLEMENTED
C. Platform Bookings = Marketplace-only server-side + UI
D. Platform Marketplace Payments exclude Storefront customer commerce
E. Marketplace GMV excludes Storefront commerce
F. Marketplace Commission/Revenue excludes Storefront commerce
G. Marketplace Refund metrics exclude Storefront commerce where implemented
H. Platform CRM Marketplace customer population excludes Storefront end-customers
I. Partner Performance does not misclassify Storefront commerce as Marketplace performance
J. Command Center Marketplace and Storefront SaaS are separate sections
K. Every retained Storefront SaaS card has proven semantics/source
L. `Покупатели Storefront` is removed if it is Storefront end-customer count
M. `Сеансы Storefront` semantics are proven before retention
N. Storefront customer payments ≠ Storefront subscription payments in documented semantics
O. Storefront dataset preserved: no unintended deletion/reassignment
P. direct Platform API bypass cannot expose Storefront commerce records
Q. tenant isolation evidence provided for existing Partner capabilities
R. ID-level negative evidence provided
S. runtime/browser evidence provided
T. tests/build/typecheck/relevant integration/E2E evidence provided
U. canonical roadmap/documentation updated additively
V. real Git SHAs provided
W. no out-of-scope next stage started
```

Любой обязательный недоказанный gate:

```text
VERDICT B
```

`source code looks correct` или `unit tests PASS` без runtime/API evidence недостаточно.

---

# 28. REQUIRED FINAL REPORT FORMAT

```text
# PLATFORM vs STOREFRONT SCOPE RE-QUALIFICATION + COMMAND CENTER BUSINESS SEPARATION — ROUND 2

Starting SHA:
Implementation SHA:
Final HEAD:
origin/master:
HEAD == origin:

## 1. Canonical Business Rule

## 2. Round 1 Re-Qualification
Orders:
Bookings:
Payments:
Storefront preserved:

## 3. Cross-Surface Applicability Matrix

## 4. Command Center Before/After
Marketplace section:
Storefront SaaS section:

## 5. Storefront Card Semantic Audit
Сеансы Storefront:
Партнёры Storefront:
Покупатели Storefront:
MRR:
ARR:
Получено:
К оплате:

## 6. Platform Orders Evidence
DB:
API:
UI:
Known Storefront ID negative test:

## 7. Platform Requests Evidence

## 8. Platform Bookings Evidence
DB:
API:
UI:
Known Storefront ID negative test:

## 9. Payments Business Semantics
Marketplace customer payment:
Storefront customer commerce payment:
Storefront→TravelHub payment:
Payment model discriminator/gap:

## 10. GMV / Revenue / Commission / Refunds

## 11. CRM Customer Scope

## 12. Partner Performance

## 13. Analytics / Drill-down Reconciliation

## 14. Storefront Dataset Preservation
Orders:
Requests:
Bookings:
Payments:
Customers:
Deleted:
Reassigned:

## 15. Tenant Isolation

## 16. Direct API Bypass Evidence

## 17. Runtime / Browser Evidence

## 18. Tests / Build / E2E

## 19. Documentation / Roadmap Update

## 20. Residual Gaps

## VERDICT
VERDICT A / VERDICT B
```

---

# 29. GIT COMPLETION

После implementation/review:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Указать реальные:

```text
Starting SHA
Implementation SHA
Final HEAD
origin/master
HEAD == origin
```

Не начинать следующий этап автоматически.

**STOP после отчёта.**
