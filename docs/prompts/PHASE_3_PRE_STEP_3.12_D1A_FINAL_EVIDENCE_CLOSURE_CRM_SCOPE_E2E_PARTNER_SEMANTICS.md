# PHASE 3 — PRE-STEP 3.12 — D1A FINAL EVIDENCE CLOSURE

## CRM SCOPE CLASSIFICATION + E2E + PARTNER SEMANTICS + DEBT REGISTER

## ROLE — MANDATORY

Ты работаешь как **Independent Senior/Staff Software Engineer + Multi-tenant SaaS Architect + Security Reviewer + QA/Verification Engineer** проекта TravelHub.

Это Final Evidence Closure, а не повторная реализация D1A. Независимо перепроверь remediation, semantic correctness Customer classification, Partner CRM semantics, targeted E2E, DB → API → UI → Export consistency. Исправляй код только если evidence выявляет реальный D1A defect.

```text
VISIBLE FIX ≠ VERIFIED BUSINESS-SCOPE FIX
```

## LANGUAGE REQUIREMENT — MANDATORY

Все отчёты, findings, root-cause explanations, evidence descriptions, conclusions и verdict explanations — преимущественно на русском. Английский допустим для technical identifiers, paths, endpoints, commands, enums, commit messages, code snippets и standardized VERDICT strings. Plaintext passwords/tokens/secrets запрещены.

## 1. PURPOSE

Предыдущий D1A исправил runtime leakage Platform CRM Customers: 262 → 183; видимые Storefront-only `SFC-*`: 62 → 0; SFC records сохранены в DB. Но Final Report оставил три acceptance gaps:

1. targeted CRM E2E = 4/12;
2. в DB есть 200 `CRM-*`, но Platform CRM показывает 183 — необходимо классифицировать 17 исключённых;
3. `CRM → Партнёры` объявлен broader Platform Partner CRM без достаточного Marketplace-only / Storefront-only / Hybrid evidence.

Цель:

```text
VERIFY → CLASSIFY → COMPLETE E2E → VERIFY PARTNERS
→ RUNTIME/EXPORT/SECURITY → UPDATE DEBTS → GIT CLOSURE → STOP
```

## 2. STARTING GIT STATE

Выполнить:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log -n 5 --oneline
```

Предыдущий Final Report зафиксировал `87ef058`, но использовать фактический repository HEAD.

## 3. HARD SCOPE

Разрешено: D1A verification, targeted CRM fixes при доказанном defect, deterministic test fixtures, Customer/Partner classification, CRM tests/runtime/export/security, roadmap/debt-register update, Git closure.

Запрещено: D2, global reseed/reset, Order/Booking/project-wide KPI implementation, project-wide Export remediation, Voucher, Finance Center, Product Freshness, Step 3.12, unrelated refactoring.

## 4. NO DATA DELETION / PREFIX SECURITY

Запрещено исправлять через:

```text
DELETE SFC customers
remove Storefront seed
rename SFC-* → CRM-*
WHERE code NOT LIKE 'SFC-%' as canonical boundary
```

Prefix — diagnostic evidence, не authorization/business scope.

## 5. RE-VERIFY ROOT CAUSE

Проверить current code и подтвердить/опровергнуть прежнее утверждение: `crm.Customer` не имеет `acquisitionSource`, а `getMarketplaceCustomerIds()` определяет scope через `Order.acquisitionSource='MARKETPLACE'`. Не копировать старый вывод без inspection.

## 6. CRITICAL SEMANTIC GATE — WHAT IS A MARKETPLACE CUSTOMER?

Текущий fix фактически предполагает:

```text
Platform Marketplace CRM Customer
IFF
Customer has ≥1 MARKETPLACE Order
```

Проверить canonical correctness через Customer creation/registration, checkout, Request, abandoned/incomplete commerce, CRM creation, Marketplace/Storefront relations, seed и architecture.

Ответить:

```text
Может ли legitimate Marketplace Customer существовать до первого Marketplace Order?
```

Если YES, `has Marketplace Order` слишком узкий classifier и remediation должна быть скорректирована.

## 7. CLASSIFY THE 17 EXCLUDED CRM-* CUSTOMERS

Для разницы `200 CRM-* - 183 visible = 17` построить evidence table:

| Customer ID/Code | MP Orders | SF Orders | Requests | MP provenance | SF relation | Classification | Expected Platform CRM |
|---|---:|---:|---:|---|---|---|---|

Classification:

```text
LEGITIMATE_MARKETPLACE_CUSTOMER
STOREFRONT_ONLY
HYBRID
SEED_INCONSISTENCY
UNCLASSIFIED
```

Hard gate:

```text
UNCLASSIFIED = 0
```

Не публиковать лишние персональные данные.

## 8. DETERMINE CANONICAL CUSTOMER SCOPE

Зафиксировать authoritative rule по relations/provenance, а не prefix. Если legitimate Marketplace Customer может существовать до Order — исправить order-only filter минимально корректным способом.

Если schema объективно не хранит достаточный provenance — документировать data-model gap; не выдумывать классификацию; при невозможности гарантировать scope → VERDICT B.

## 9. DETERMINISTIC CUSTOMER FIXTURES

Старый `4/12` из-за пустой test DB недопустим. Создать targeted fixtures внутри tests, без global reseed:

```text
Marketplace-only Customer
Storefront-only Customer
Hybrid Customer if supported
Marketplace Customer with Order
Marketplace Customer without Order if canonical
relevant edge case
```

Fixtures должны создавать необходимые Partner/Storefront/Customer/Order/relations и работать с существующей test isolation.

## 10. CUSTOMER E2E — FULL GREEN

Минимум:

1. Platform list includes Marketplace customer.
2. List excludes Storefront-only.
3. Total excludes Storefront-only.
4. Search finds Marketplace.
5. Search does not find Storefront-only.
6. Filters cannot surface Storefront-only.
7. Pagination cannot surface Storefront-only.
8. Direct-ID denies Storefront-only.
9. Customer 360/detail denies Storefront-only.
10. CSV excludes Storefront-only.
11. XLSX excludes Storefront-only.
12. Storefront-only record still exists in DB.

Hard:

```text
12/12 executed
12/12 PASS
0 skipped because fixtures are missing
```

## 11. PARTNER CRM SEMANTICS — PROVE, DON'T ASSUME

Перепроверить утверждение:

```text
Platform CRM → Партнёры
= broader Platform Partner relationship view
= Marketplace + Storefront SaaS relationships
```

Ground in canonical architecture, Partner/Storefront/subscription models, navigation и CRM purpose.

## 12. PARTNER CLASSIFICATION

Найти/создать representative cases:

```text
Marketplace-only Partner
Storefront-only Partner
Hybrid Partner
```

| Partner Type | Marketplace Relation | Storefront Relation | SaaS Relation | Expected Platform CRM |
|---|---|---|---|---|
| Marketplace-only | YES | NO | actual | |
| Storefront-only | NO | YES | actual | |
| Hybrid | YES | YES | actual | |

Если broader Platform Partner CRM подтверждён, Storefront-only может быть виден как SaaS/Storefront partner, но его Storefront customer commerce не должно становиться Marketplace commerce. Hybrid Marketplace metrics должны включать только Marketplace commerce.

## 13. PARTNER TESTS

Проверить Marketplace-only / Storefront-only / Hybrid expected visibility, search, count, detail/direct URL и CSV/XLSX если export существует. Tests должны проверять relationship semantics, а не prefix.

## 14. TENANT ISOLATION

Regression-test:

```text
Storefront Partner A cannot read Partner B end-customers
Platform Marketplace CRM cannot read Storefront-only end-customer
```

Fix Platform leakage не должен ослабить Partner tenant isolation.

## 15. API + BROWSER RUNTIME

API evidence: Platform total, Marketplace sample visible, Storefront-only absent, SFC search 0, direct-ID denied; Partner representative types according to semantics.

Authenticated browser:

```text
/app/crm → Клиенты
```

Проверить total, `Storefront-only visible = 0`, known SFC search = 0, Marketplace sample, pagination, и legitimate Marketplace no-Order sample если canonical.

Для `/app/crm → Партнёры` показать representative Partner types.

## 16. CSV / XLSX + DB EVIDENCE

Customer CSV/XLSX:

```text
Storefront-only rows = 0
expected Marketplace population preserved
```

DB после closure:

```text
Storefront-only customers > 0
Marketplace customers > 0
Storefront-only returned by Platform CRM = 0
```

D9 project-wide Export Framework НЕ закрывать.

## 17. CRM KPI/TOTAL NARROW CHECK

В CRM:

```text
Customer total = scoped Customer population
```

Все CRM customer KPI/cards должны использовать тот же business scope. Не выполнять project-wide KPI remediation.

## 18. REGISTER PROJECT-WIDE KPI/STATUS DEBT

Runtime выявил Order Center:

```text
Total 500
Active 183
Ready for booking 0
Closed/Cancelled 241
```

Видимые группы объясняют 424, оставляя 76 необъяснёнными, если воспринимать карточки как lifecycle breakdown.

Booking Center representative data:

```text
Total 361
Waiting supplier 0
Confirmed 361
Cancelled/Rejected 0
```

Это не доказывает ошибку KPI, но показывает необходимость project-wide semantics + representative coverage.

Обновить D11 на:

```text
D11 — PROJECT-WIDE KPI / STATUS SEMANTICS
      + TOTAL RECONCILIATION AUDIT & REMEDIATION
```

D11 future scope: Command Center, Analytics, Requests, Orders, Bookings, CRM, Catalog, Partners, Sellers, Support, Partner Workspace, Storefront Pro и другие KPI/status surfaces.

Для каждого KPI будущий contract:

```text
SOURCE
SCOPE
SEMANTICS
PERIOD
STATUS MAPPING
OVERLAP RULE
DRILL-DOWN
RECONCILIATION RULE
```

Различать:

```text
LIFECYCLE BREAKDOWN
→ TOTAL = sum mutually exclusive groups
→ UNMAPPED = 0
→ DOUBLE_COUNTED = 0

INDEPENDENT/OVERLAPPING KPI
→ sum not required
→ overlap explicitly documented
```

D11 implementation сейчас НЕ выполнять.

## 19. REPRESENTATIVE END-TO-END COMMERCE CHAIN COVERAGE

Добавить в Master Debt Register hard requirement:

```text
REPRESENTATIVE CHAIN COVERAGE
≠ STATUS COVERAGE
```

Не добавлять случайные records только ради ненулевого KPI. Каждый важный status должен возникать из валидной E2E chain.

Primary closure dependency: D4 representative data; verification: D11.

Future scenarios минимум:

```text
Request waiting supplier
Supplier confirmed/customer pending
Price changed accepted/rejected
Unavailable/rejected/supplier timeout
Customer TTL expired
Order created
Booking waiting supplier
Booking confirmed unpaid/partial/full paid
Booking completed
Cancellation before payment
Cancellation after payment
Partial/full refund
Authoritative real-time flow without Request
Marketplace flow
Storefront Partner flow
```

Chain должна сохранять references, FKs, scope, currency, amounts, transitions, chronology, payments/refunds, travelers и voucher where applicable.

Не создавать эти данные в D1A closure.

## 20. ROADMAP / MASTER DEBT REGISTER

Additive only; не renumber D0-D14.

Зафиксировать:

```text
D1A Final Evidence Closure → current
D4 → Representative End-to-End Commerce Chain Coverage
D11 → PROJECT-WIDE KPI / STATUS SEMANTICS + TOTAL RECONCILIATION
D9 → remains open
D12 → remains open
```

После success:

```text
TRUE NEXT = D2 — Product Traveler Requirements
```

## 21. TEST REPORTING

Final report должен дать exact results:

```text
Targeted CRM Customer tests: X/X
Targeted CRM Partner tests: X/X
Tenant isolation tests: X/X
Relevant regression: passed/failed/skipped
```

Фраза `key tests pass` без exact result недопустима.

Если запускается broader backend regression, предыдущий baseline `1395/1420` перепроверить и failures классифицировать.

## 22. REQUIRED FINAL STATUS MATRIX

| Area | Status | Evidence |
|---|---|---|
| Customer list scope | | |
| Customer total scope | | |
| Customer search | | |
| Customer direct-ID | | |
| Customer 360 | | |
| Customer CSV | | |
| Customer XLSX | | |
| 17 CRM-* classification | | |
| Partner semantics | | |
| Marketplace-only Partner | | |
| Storefront-only Partner | | |
| Hybrid Partner | | |
| Partner tenant isolation | | |
| CRM targeted E2E | | |
| D11 debt update | | |
| Representative chain debt update | | |

## 23. FINAL REPORT

Создать/обновить `PHASE 3 — PRE-STEP 3.12 — D1A FINAL EVIDENCE CLOSURE REPORT` преимущественно на русском.

Минимум: Executive Summary; Starting Git State; Root Cause Re-verification; Canonical Marketplace Customer Definition; 17 CRM-* Classification; Customer Scope/E2E/API/Browser/Export; Partner Semantics/Classification/Tests; Tenant Isolation; DB Evidence; Regression; D11 Expansion; Representative Chain Debt; Roadmap; Files Changed; Git Closure; Residual Risks; Verdict; TRUE NEXT.

## 24. GIT CLOSURE

```bash
git diff --check
git status
git diff
git commit
git push origin master
git rev-parse HEAD
git rev-parse origin/master
```

Hard:

```text
HEAD == origin/master
```

Report must contain real Starting SHA, Closure SHA, Final SHA, origin SHA, working tree state. No pending/TBD.

## 25. HARD ACCEPTANCE GATES

`VERDICT A` only if:

```text
[ ] Root cause independently reverified
[ ] Canonical Marketplace Customer definition established
[ ] All 17 excluded CRM-* classified
[ ] UNCLASSIFIED = 0
[ ] No legitimate Marketplace customer lost
[ ] Storefront-only customers remain in DB
[ ] Platform CRM returns 0 Storefront-only customers
[ ] list/total/search/filter/pagination/direct-ID/360 correct
[ ] CSV and XLSX correct
[ ] Customer targeted E2E fully executes and all green
[ ] 0 tests skipped due missing fixtures
[ ] Partner semantics proven
[ ] Marketplace-only Partner verified
[ ] Storefront-only Partner verified
[ ] Hybrid Partner verified or explicitly proven absent/not supported
[ ] Partner tenant isolation verified
[ ] Browser runtime verified
[ ] DB → API → UI → Export consistent
[ ] D11 expanded project-wide
[ ] Representative E2E Chain Coverage registered
[ ] D9 remains open
[ ] D12 remains open
[ ] TRUE NEXT = D2
[ ] Real Final SHA
[ ] Push succeeded
[ ] HEAD == origin
```

Failure examples:

```text
4/12 tests
missing fixtures
17 CRM-* unclassified
prefix-only classification
legitimate Marketplace customers lost
direct-ID leakage
Partner semantics asserted without evidence
tenant leakage
CSV/XLSX leakage
pending SHA
```

→ `VERDICT B — D1A FINAL EVIDENCE CLOSURE INCOMPLETE`

Success:

```text
VERDICT A — D1A PLATFORM CRM MARKETPLACE / STOREFRONT
SCOPE ISOLATION — FINAL EVIDENCE CLOSURE COMPLETED
```

## 26. STOP RULE

После success:

```text
TRUE NEXT:
D2 — PRODUCT TRAVELER REQUIREMENTS

NOT STARTED.

STOP.
```

Не начинать D2 автоматически.
