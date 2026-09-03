# PHASE 3 — PRE-STEP 3.12 — D1A — PLATFORM CRM MARKETPLACE / STOREFRONT SCOPE ISOLATION AUDIT + REMEDIATION

## ROLE — MANDATORY

Ты работаешь как **Senior/Staff Software Engineer + Multi-tenant SaaS Architect + Security Engineer + QA/Verification Engineer** проекта TravelHub.

В рамках D1A ты обязан действовать одновременно как:

- Senior Backend Engineer — NestJS / Prisma / PostgreSQL;
- Senior Frontend Engineer — Next.js / React / TypeScript;
- Multi-tenant SaaS Architect — Platform / Partner / Marketplace / Storefront boundaries;
- Security Engineer — server-side scope enforcement, tenant isolation, IDOR prevention;
- Data Integrity Engineer — provenance/ownership/classification of CRM entities;
- QA / Runtime Verification Engineer — DB → API → UI → Export evidence.

Твоя задача — не просто визуально скрыть `SFC-*` строки.

Ты обязан найти **root cause**, определить корректный business scope и исправить его на authoritative server-side/query layer так, чтобы Storefront customer commerce не протекал в Platform Marketplace CRM.

Hard rule:

```text
UI filtering
≠ authorization
≠ business-scope enforcement
```

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**:

- Audit/Remediation Report;
- findings;
- root cause analysis;
- scope matrix;
- security findings;
- runtime evidence;
- conclusions;
- verdict explanations.

Английский допустим только для technical identifiers, file paths, class/method/DTO/model names, endpoints, HTTP statuses, commands, enums, permissions, commit messages, code snippets и standardized `VERDICT` strings.

Если итоговый отчёт преимущественно английский — задача не завершена.

Plaintext passwords, tokens, secrets и credentials запрещены.

---

# 1. PURPOSE

После clean reseed/runtime обнаружен regression:

```text
Platform Workspace
→ CRM
→ Клиенты

contains Storefront customers
including visible SFC-* records
```

Canonical invariant:

```text
Platform Marketplace CRM Customers
= Marketplace customers

Storefront-only end-customers
≠ Platform Marketplace CRM Customers
```

Storefront customers должны **оставаться в БД** и быть доступны в правильном Partner/Storefront scope.

D1A должен:

```text
AUDIT
→ CLASSIFY
→ FIND ROOT CAUSE
→ REMEDIATE
→ TEST
→ VERIFY RUNTIME
→ VERIFY SECURITY
→ VERIFY EXPORT
→ STRICT EVIDENCE
```

---

# 2. STARTING BASELINE

Зафиксировать реальные:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Accepted D1 report evidence indicated D1 closure on repository state after D0. Не доверять SHA из сообщения пользователя без Git verification — использовать фактический repository HEAD.

Указать:

```text
Starting SHA
Starting origin/master SHA
branch
working tree state
```

Не откатывать более новые legitimate commits.

---

# 3. REQUIRED SOURCES

Перед изменениями изучить:

```text
docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md
docs/architecture/COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
D0 report
D1 report
CRM architecture/docs
Platform/Partner workspace architecture
Prisma schema
Customer models
Partner models
Storefront models
CRM backend controllers/services/repositories
CRM frontend pages/hooks/API clients
CRM analytics queries
CRM export endpoints
seed/reseed logic relevant to Customers/Partners
```

Не начинать remediation до root-cause analysis.

---

# 4. HARD BUSINESS BOUNDARY

Preserve:

```text
MARKETPLACE
→ TravelHub operational + commercial business
→ Platform Workspace

STOREFRONT CUSTOMER COMMERCE
→ Partner's own customer business
→ Partner / Storefront Workspace
→ NOT Platform Marketplace commerce

STOREFRONT → TRAVELHUB
→ subscription/direct SaaS relationship
→ Platform SaaS economics
```

Hard invariant:

```text
Storefront Commerce Volume
≠ Marketplace GMV
≠ TravelHub Revenue
```

D1A касается CRM scope, но remediation не должна разрушить эту более широкую boundary.

---

# 5. DO NOT DELETE STOREFRONT DATA

Запрещено исправлять дефект посредством:

```text
DELETE Storefront customers
remove SFC seed data
stop representative Storefront seed
rename SFC-* to CRM-*
hide rows only in frontend
```

Correct model:

```text
DATABASE
├── Marketplace Customers
└── Storefront Customers

Platform Marketplace CRM
└── Marketplace Customers only

Partner / Storefront Workspace
└── Storefront Customers for authorized Partner
```

---

# 6. PREFIX IS EVIDENCE, NOT AUTHORIZATION

Visible `SFC-*` является сильным runtime symptom.

Но запрещено делать canonical filtering:

```sql
WHERE code NOT LIKE 'SFC-%'
```

как основную business/security boundary.

Определить real authoritative scope через существующие fields/relations, например:

```text
acquisition/source/provenance
workspace ownership
partner/storefront ownership
seller/customer relations
Storefront association
Marketplace commerce relationship
```

Использовать фактическую schema.

Если текущая schema не позволяет безопасно определить scope — документировать architecture/data-model gap и сделать минимально корректную remediation согласно existing canonical model. Не изобретать строковый security contract.

---

# 7. CUSTOMER CLASSIFICATION AUDIT

На уровне БД построить реальную классификацию Customers.

Минимум:

```text
Marketplace-only Customer
Storefront-only Customer
Customer with both Marketplace + Storefront relationships, if possible
orphan/unclassified Customer
```

Для каждой категории определить:

```text
count
authoritative classification rule
sample IDs/codes
related Orders/Bookings/Storefront/Partner
expected Platform CRM visibility
expected Partner CRM visibility
```

Required matrix:

| Customer Type | Exists in DB | Platform Marketplace CRM | Storefront/Partner CRM |
|---|---:|---:|---:|
| Marketplace-only | YES | YES | only if legitimately related |
| Storefront-only | YES | NO | YES for owning Partner |
| Hybrid | if supported | define explicitly | define explicitly |
| Unclassified | audit | do not silently expose | audit |

---

# 8. PLATFORM CRM → CUSTOMERS — SERVER-SIDE SCOPE

Audit all backend entry points serving Platform CRM Customers.

Минимум:

```text
list
search
filters
pagination
count
KPI/summary
detail
export CSV
export XLSX
analytics sources if reused
```

Server-side query must enforce canonical Marketplace scope.

Hard:

```text
Platform CRM customer list
Storefront-only count = 0
```

and:

```text
Platform CRM search by Storefront-only customer
→ no record
```

---

# 9. CUSTOMER DETAIL / DIRECT URL SECURITY

Очень важно проверить не только list.

Если Storefront-only Customer известен по UUID/code, Platform user не должен получить его как Marketplace CRM customer через:

```text
GET /crm/customers/{id}
direct frontend URL
search endpoint
export endpoint
```

Expected result согласно API conventions:

```text
404 or 403
```

Выбрать существующий project security convention и применять consistently.

Hard:

```text
hidden from list
but accessible by direct ID
= FAIL
```

---

# 10. PLATFORM CRM CUSTOMER TOTALS / KPIs

Проверить все totals/cards:

```text
Всего клиентов
Новые
Активные
VIP
Средний чек
LTV
or actual current KPIs
```

Каждый customer-based KPI должен использовать тот же Marketplace scope.

Hard:

```text
list population
summary population
analytics population
export population
```

не должны расходиться из-за Storefront leakage.

---

# 11. SEARCH / FILTERS / PAGINATION

Проверить комбинации:

```text
default list
page 1
later pages
search by Marketplace customer
search by Storefront-only name
search by SFC code
filters
sorting
pagination
```

Storefront-only Customer не должен появляться на другой странице после правильной первой страницы.

Filtering must happen **before pagination/count**, server-side.

Wrong:

```text
fetch mixed page
→ frontend removes SFC rows
```

Correct:

```text
server scopes population
→ count
→ filter/search/sort
→ pagination
→ response
```

в соответствии с существующим query architecture.

---

# 12. CSV / XLSX EXPORT

Проверить CRM Customer exports.

Hard:

```text
same filters
same business scope
same total population
```

Required:

```text
Storefront-only rows in Platform CRM CSV = 0
Storefront-only rows in Platform CRM XLSX = 0
```

Если export framework D9 всё ещё требует project-wide requalification, D1A закрывает **только CRM scope correctness**, не весь D9.

Не включать sensitive Storefront customer data.

---

# 13. CRM ANALYTICS SOURCES

Проверить, какие analytics/customer metrics используют CRM Customer population.

Особенно убедиться, что Platform Marketplace customer analytics не получают Storefront-only end-customers через shared Customer table.

Не переделывать весь Analytics Center.

Если обнаружена отдельная analytics leakage вне narrow CRM scope:

```text
fix if same root query/scope primitive
OR
register explicit debt if separate subsystem
```

Не скрывать.

---

# 14. CRM → PARTNERS — FIRST AUDIT SEMANTICS

Нельзя механически применить Customer rule к Partners.

Сначала определить фактическую business semantics вкладки:

```text
Platform → CRM → Партнёры
```

Ответить:

```text
Это Marketplace Partner CRM?
или broader Platform Partner relationship CRM?
```

Проверить canonical architecture, navigation, Partner model, SaaS subscription model и UI labels.

---

# 15. PARTNER CLASSIFICATION MATRIX

На уровне БД определить минимум:

```text
Marketplace-only Partner
Storefront-only Partner
Hybrid Partner:
  Marketplace + Storefront
```

Для каждого:

```text
count
sample Partner codes
Storefront relation
Marketplace Products/Orders/Bookings relation
subscription relation
expected CRM visibility
```

---

# 16. PARTNER VISIBILITY DECISION

## Case A — вкладка = Marketplace Partner CRM

Тогда canonical:

```text
Marketplace-only → YES
Hybrid → YES
Storefront-only → NO
```

Storefront-only company может существовать в Platform SaaS/subscription context, но не как Marketplace Partner.

## Case B — вкладка = broader Platform Partner CRM

Тогда возможно:

```text
Marketplace-only → YES
Hybrid → YES
Storefront-only → YES as SaaS/Storefront partner
```

но UI/API должны явно различать relationship type.

Storefront partner не должен попадать туда **из-за Storefront end-customer commerce**.

D1A обязан выбрать вариант на основании existing canonical architecture, а не догадки.

Если semantics действительно не определена canonical docs — documentation-only clarification разрешена, но нельзя silently invent major architecture.

---

# 17. PARTNER LIST / DETAIL / SEARCH / EXPORT

После semantic decision проверить:

```text
Partner list
Partner totals
search
filters
pagination
Partner detail
direct URL
CSV/XLSX
related CRM analytics
```

Если Storefront-only Partner не должен быть видим — direct-ID access также должен быть denied.

Если должен быть видим как SaaS partner — UI должна показывать корректный relationship classification, а не Marketplace commerce metrics от его Storefront customers.

---

# 18. HYBRID PARTNERS

Не сломать Hybrid.

Partner может потенциально одновременно:

```text
sell through Marketplace
+
use Storefront Pro
```

Storefront capability не должна исключать его Marketplace identity.

Hard:

```text
has Storefront
≠ automatically non-Marketplace
```

Classification должна опираться на реальную Marketplace relationship.

---

# 19. PARTNER WORKSPACE TENANT ISOLATION

Проверить обратную сторону:

```text
Storefront Partner A
→ only A's Storefront customers

Storefront Partner B
→ only B's Storefront customers
```

Если D1A затрагивает shared query/scope primitive, обязательно regression-test Partner isolation.

Hard:

```text
fix Platform leakage
must not create Partner-to-Partner leakage
```

---

# 20. PLATFORM ADMIN DOES NOT MEAN ALL CUSTOMER COMMERCE

Даже Platform ADMIN не должен автоматически видеть Storefront-only end-customers внутри **Marketplace CRM Customers**, если canonical product semantics исключает их.

Role authorization и business scope — разные dimensions:

```text
Permission
+
Business scope
=
Access
```

---

# 21. ROOT CAUSE REPORT — MANDATORY

До remediation зафиксировать root cause.

Например, проверить:

```text
reseed classification
shared Customer query missing scope
wrong acquisitionSource semantics
Storefront customer inserted as Marketplace Customer
incorrect relation
CRM service uses global customer table
scope lost in count/export/detail
```

Не писать предположение как факт.

Required:

```text
Observed symptom
→ data classification
→ query path
→ exact root cause
→ affected surfaces
→ remediation strategy
```

---

# 22. REMEDIATION DESIGN

Prefer one reusable authoritative scope primitive instead of duplicated filters.

Например conceptually:

```text
PlatformMarketplaceCustomerScope
```

или existing project equivalent.

Но не создавать abstraction ради abstraction.

Требования:

```text
list
count
search
detail
export
analytics
```

должны использовать consistent scope semantics.

---

# 23. API CONTRACT

Проверить реальные endpoints.

Для Platform CRM Customers API evidence показать:

```text
total
sample Marketplace customer
Storefront-only sample absent
search Storefront-only absent
direct ID denied
```

Для Partners — evidence согласно выбранной semantic matrix.

Не invent endpoints в отчёте.

---

# 24. FRONTEND RUNTIME — MANDATORY

Authenticated browser verification обязательна.

Минимум:

### CRM → Клиенты

Проверить:

```text
open page
visible total
multiple pages if applicable
search Marketplace customer
search known Storefront-only customer
filters
customer detail
refresh/direct URL
```

Hard runtime evidence:

```text
visible SFC-* Storefront-only customers = 0
```

Но дополнительно доказать, что это не prefix-only fix.

### CRM → Партнёры

Проверить:

```text
Marketplace-only sample
Storefront-only sample
Hybrid sample if available
detail/direct URL
```

в соответствии с принятой semantics.

---

# 25. DATABASE EVIDENCE — MANDATORY

После remediation Storefront data должны по-прежнему существовать.

Показать counts:

```text
Storefront customers in DB > 0
Marketplace customers in DB > 0
```

если representative dataset их содержит.

И одновременно:

```text
Storefront-only customers returned by Platform CRM scope query = 0
```

Это ключевое доказательство:

```text
scope isolation
≠ data deletion
```

---

# 26. REPRESENTATIVE FIXTURE / TEST DATA

Использовать существующий clean-reseed dataset.

Не делать full reset.

Если для automated tests нужны targeted fixtures:

```text
Marketplace-only Customer
Storefront-only Customer
Hybrid Customer if supported
Marketplace-only Partner
Storefront-only Partner
Hybrid Partner
```

создать минимально и deterministic.

Не ломать representative seed.

---

# 27. AUTOMATED TESTS — CUSTOMER SCOPE

Добавить/обновить targeted tests минимум:

```text
Platform list excludes Storefront-only Customer
Platform total excludes Storefront-only Customer
Platform search excludes Storefront-only Customer
Platform direct-ID denies Storefront-only Customer
Platform export excludes Storefront-only Customer
Marketplace Customer remains visible
```

Проверить pagination semantics.

---

# 28. AUTOMATED TESTS — PARTNER SCOPE

После semantic decision:

```text
Marketplace-only expected visibility
Storefront-only expected visibility
Hybrid expected visibility
direct-ID behavior
search
count
export
```

Tests должны отражать canonical Partner CRM semantics, а не prefix.

---

# 29. TENANT SECURITY TESTS

Минимум:

```text
Partner A cannot read Partner B Storefront customer
Platform Marketplace CRM cannot read Storefront-only customer
unauthorized role cannot bypass scope through direct endpoint
```

Если соответствующие auth fixtures существуют — использовать их.

---

# 30. REGRESSION

Запустить targeted suites и релевантный broader regression.

Обязательно сообщить:

```text
command
passed
failed
skipped
```

Не объявлять общий regression green, если есть failures.

Pre-existing failures можно классифицировать отдельно, но D1A targeted gates должны быть green.

---

# 31. DO NOT CLOSE D9

Даже если CRM CSV/XLSX проходят:

```text
D9 — Export Framework Requalification
```

остаётся отдельным debt до project-wide requalification.

D1A доказывает только:

```text
CRM export scope isolation
```

---

# 32. DO NOT CLOSE D12

Даже если Customer/Partner Detail routing работает:

```text
D12 — CRM / KPI Drill-down Routing Requalification
```

не закрывать автоматически.

Можно записать evidence, которое позже будет использовано D12.

---

# 33. ROADMAP UPDATE

Обновить roadmap additively.

После успешного D1A:

```text
D1A → ACCEPTED
TRUE NEXT → D2 — Product Traveler Requirements
```

Не запускать D2.

Добавить краткое описание root cause и scope invariant.

---

# 34. REQUIRED D1A REPORT

Создать:

```text
PHASE 3 — PRE-STEP 3.12 — D1A
PLATFORM CRM MARKETPLACE / STOREFRONT
SCOPE ISOLATION AUDIT + REMEDIATION — FINAL REPORT
```

Преимущественно на русском.

Структура минимум:

1. Executive Summary
2. Starting Git State
3. Sources Audited
4. Runtime Symptom
5. Customer Data Classification
6. Customer Scope Root Cause
7. Customer Remediation
8. Customer API Evidence
9. Customer Browser Evidence
10. Customer Export Evidence
11. Partner CRM Semantic Audit
12. Partner Classification Matrix
13. Partner Canonical Visibility Decision
14. Partner Remediation if required
15. Partner API/Browser Evidence
16. Hybrid Partner Evidence
17. Partner Workspace Tenant Isolation
18. CRM Analytics/KPI Scope
19. Automated Tests
20. Regression
21. Security Verification
22. DB Evidence / No Data Deletion
23. Files Changed
24. Roadmap Update
25. Git Closure
26. Residual Risks
27. Final Verdict
28. TRUE NEXT

---

# 35. REQUIRED SCOPE MATRIX

Final report должен содержать фактическую matrix:

| Entity Type | DB Count | Platform CRM Expected | Platform CRM Actual After Fix | Partner Scope |
|---|---:|---|---|---|
| Marketplace-only Customer | | YES | | |
| Storefront-only Customer | | NO | 0 returned | owning Partner |
| Hybrid Customer | | canonical decision | | |
| Marketplace-only Partner | | | | |
| Storefront-only Partner | | canonical decision | | |
| Hybrid Partner | | | | |

Не подставлять invented counts.

---

# 36. HARD ACCEPTANCE GATES — CUSTOMERS

```text
[ ] Storefront customers still exist in DB
[ ] Marketplace customers still exist in DB
[ ] Platform CRM list returns 0 Storefront-only customers
[ ] Platform CRM total excludes Storefront-only customers
[ ] Search cannot surface Storefront-only customer
[ ] Filters cannot surface Storefront-only customer
[ ] Pagination cannot surface Storefront-only customer
[ ] Direct-ID endpoint denies Storefront-only customer
[ ] Customer Detail cannot bypass scope
[ ] CSV contains 0 Storefront-only customers
[ ] XLSX contains 0 Storefront-only customers
[ ] Marketplace customers remain visible
[ ] Scope enforced server-side
[ ] Fix is not based solely on SFC-* prefix
```

---

# 37. HARD ACCEPTANCE GATES — PARTNERS

```text
[ ] CRM → Партнёры semantics explicitly determined
[ ] Marketplace-only Partner classified
[ ] Storefront-only Partner classified
[ ] Hybrid Partner classified
[ ] list/count/search/detail/export follow same semantics
[ ] direct-ID cannot bypass scope
[ ] Storefront capability does not incorrectly hide Hybrid Marketplace Partner
[ ] Storefront end-customer commerce does not become Marketplace partner commerce
```

---

# 38. HARD ACCEPTANCE GATES — SECURITY / RUNTIME

```text
[ ] Partner A cannot access Partner B Storefront customer
[ ] Platform Marketplace CRM cannot access Storefront-only end-customer
[ ] Browser runtime shows 0 Storefront-only customers in Platform CRM
[ ] Known Marketplace customer is visible
[ ] Known Storefront-only customer remains available in correct Partner scope
[ ] API evidence matches UI
[ ] DB evidence proves data was not deleted
[ ] targeted tests green
[ ] relevant regression reported truthfully
```

---

# 39. GIT CLOSURE

После successful remediation:

```bash
git diff --check
git status
git diff
git commit
git push
git rev-parse HEAD
git rev-parse origin/master
```

Final report:

```text
Starting SHA
Implementation/Remediation SHA
Final SHA
origin/master SHA
HEAD == origin: YES
Working tree state
```

Никаких pending/TBD.

---

# 40. FINAL VERDICT

`VERDICT A` только если **все** hard gates выполнены.

Success:

```text
VERDICT A — D1A PLATFORM CRM MARKETPLACE / STOREFRONT
SCOPE ISOLATION AUDIT + REMEDIATION — COMPLETED
```

Если Customers визуально исчезли, но API direct-ID/export всё ещё leak:

```text
VERDICT B
```

Если Storefront data были удалены из DB вместо scope fix:

```text
VERDICT B
```

Если Partner semantics не определена:

```text
VERDICT B
```

---

# 41. TRUE NEXT

Только после `VERDICT A`:

```text
TRUE NEXT:
D2 — PRODUCT TRAVELER REQUIREMENTS

NOT STARTED.
```

---

# 42. STOP RULE

После D1A:

```text
STOP.
```

Не начинать D2 автоматически.
