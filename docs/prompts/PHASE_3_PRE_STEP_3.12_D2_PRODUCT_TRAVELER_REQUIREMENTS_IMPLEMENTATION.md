# PHASE 3 — PRE-STEP 3.12 — D2 — PRODUCT TRAVELER REQUIREMENTS IMPLEMENTATION

## ROLE — MANDATORY

Ты работаешь как **Senior/Staff Software Engineer + Domain Architect + Database Engineer + Security Engineer + QA/Verification Engineer** проекта TravelHub (Enterprise SaaS / Travel Marketplace).

В рамках D2 ты обязан действовать одновременно как:

- Senior Backend Engineer — NestJS / Prisma / PostgreSQL;
- Senior Frontend Engineer — Next.js / React / TypeScript;
- Domain Architect — Product/Service → Traveler Requirements contract;
- Database Engineer — schema/migration/data integrity;
- Security Engineer — Partner ownership, permissions, tenant isolation;
- QA / Verification Engineer — DB → API → UI → Runtime → Tests evidence.

Твоя задача — реализовать **seller-defined Traveler Data Requirements на уровне Product/Service**, строго в соответствии с уже принятым Commerce Lifecycle Contract и Traveler Architecture.

Hard rule:

```text
CANONICAL ARCHITECTURE
> existing implementation convenience
```

Не менять lifecycle ради минимизации кода.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**:

- Implementation Report;
- findings;
- root cause analysis;
- schema decisions;
- API decisions;
- UI decisions;
- security findings;
- runtime evidence descriptions;
- conclusions;
- verdict explanations.

Английский допускается только для:

- file paths;
- class/method/DTO/model/table names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enums;
- permission identifiers;
- code snippets;
- standardized `VERDICT` strings.

Если итоговый report преимущественно английский — D2 не завершён.

Plaintext passwords, tokens, secrets и credentials запрещены.

---

# 1. PURPOSE

D2 должен реализовать Product/Service-level Traveler Data Requirements:

```text
Seller / Partner
        ↓
Product / Service
        ↓
Traveler Data Requirements
        ├── NOT_REQUESTED
        ├── OPTIONAL
        └── REQUIRED
```

D2 создаёт canonical configuration source для последующего D3:

```text
D2
→ Seller configures requirements

D3
→ checkout reads pinned requirements
→ customer enters traveler data
→ OrderTraveler populated
→ Booking Passenger populated
```

D2 **не реализует traveler checkout collection**.

---

# 2. ACCEPTED BASELINE

Accepted debt chain:

```text
D0 ✅
D1 ✅
D1A ✅
D2 ← CURRENT
```

D1 canonical lifecycle fixed:

```text
Supplier confirmation
→ Customer accepts current terms
→ requirements pinned
→ Traveler Data Collection
→ Final customer confirmation
→ Order
→ Booking
```

Requirements pin point:

```text
termsAcceptedAt
```

D2 must not contradict this.

---

# 3. STARTING GIT STATE

Выполнить:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log -n 5 --oneline
```

Зафиксировать:

```text
Starting SHA
origin/master SHA
branch
working tree state
```

Не использовать SHA из chat как источник истины без проверки repository.

---

# 4. REQUIRED SOURCES

Перед implementation изучить реальные repository sources:

```text
docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md
docs/architecture/COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md
Traveler architecture docs
D1 report
D1A report
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md

backend/prisma/schema.prisma
Product model(s)
ProductType enum
Partner/Product ownership relations
Product create/update DTOs
Product controllers/services
Catalog permissions
frontend product create/edit pages
frontend product detail pages
existing form framework
existing validation/i18n patterns
existing tests
```

Не создавать duplicate subsystem, если Product configuration framework уже существует.

---

# 5. AUDIT EXISTING PRODUCT MODEL FIRST

До schema change ответить:

```text
Есть ли уже field/config для traveler requirements?
Есть ли generic metadata/config JSON?
Есть ли ProductType-specific settings?
Есть ли service attributes/options architecture?
Есть ли validation rules engine?
Есть ли dynamic form configuration?
```

Если существующая архитектура уже имеет подходящее canonical место — использовать его.

Не добавлять `travelerRequirements Json?` автоматически только потому, что это было предложено старым Traveler Audit.

---

# 6. HARD REQUIREMENT STATES

Canonical states:

```text
NOT_REQUESTED
OPTIONAL
REQUIRED
```

Semantics:

```text
NOT_REQUESTED
→ field not shown
→ field not collected
→ field not validated

OPTIONAL
→ field shown
→ value may be omitted

REQUIRED
→ field shown
→ server-side required
```

Не использовать boolean `required: true/false`, если нужно различать NOT_REQUESTED и OPTIONAL.

---

# 7. FIELD CATALOG — AUDIT BEFORE IMPLEMENTATION

Определить actual supported traveler field catalog.

Минимально проверить existing traveler models:

```text
firstName
lastName
birthDate
citizenship
gender
passportNumber
passportExpiry
customerId
dataCompleteness
```

Также проверить, существуют ли already:

```text
phone
email
documentType
specialAssistance
emergencyContact
insurance fields
visa-related fields
notes
```

Не добавлять десятки новых traveler fields в D2 без реального current requirement.

D2 должен реализовать **requirement configuration framework** для реально поддерживаемого каталога.

---

# 8. FIRST NAME / LAST NAME BASELINE

Определить, должны ли:

```text
firstName
lastName
```

быть:

```text
always REQUIRED
```

или seller-configurable.

Не принимать решение по интуиции.

Проверить:

```text
service types
Voucher requirements
Booking fulfillment
existing QuoteTraveler / CheckoutIntentTraveler
```

Если business architecture требует идентифицируемого Traveler для каждого Booking, зафиксировать fixed baseline.

---

# 9. SERVICE-TYPE DEFAULTS

D2 должен поддержать sensible defaults по `ProductType`, но seller may override when canonical.

Audit actual enum first.

Known examples may include:

```text
TOUR
HOTEL
SANATORIUM
FLIGHT
TRAIN
EXCURSION
GUIDE
TRANSFER
PHOTOGRAPHER
```

Не invent non-existing ProductType.

Для каждого supported type определить default requirement profile.

Пример conceptual only:

```text
TOUR
  firstName REQUIRED
  lastName REQUIRED
  birthDate OPTIONAL
  passport NOT_REQUESTED

TRANSFER
  firstName REQUIRED
  lastName REQUIRED
  phone OPTIONAL

FLIGHT
  firstName REQUIRED
  lastName REQUIRED
  birthDate REQUIRED
  citizenship REQUIRED
  passportNumber REQUIRED
  passportExpiry REQUIRED
```

Но фактические defaults должны быть обоснованы domain requirements проекта.

---

# 10. SELLER OVERRIDE CONTRACT

Seller/Partner должен иметь возможность настроить Product-level override:

```text
Default by ProductType
        ↓
Product override
        ↓
Effective Traveler Requirements
```

Определить semantics:

```text
inherit default
override selected fields
or full explicit snapshot
```

Не создавать ambiguous merge logic.

---

# 11. STORAGE DESIGN

Выбрать storage после audit.

Допустимые направления:

```text
A. JSON on Product
B. normalized requirement table
C. existing generic Product config model
```

Decision criteria:

```text
schema consistency
queryability
versioning
validation
future fields
migration complexity
existing architecture
```

Не over-engineer.

Final report должен объяснить выбранную модель.

---

# 12. ENUM / TYPE CONTRACT

Если создаётся enum, naming должен быть consistent with project conventions.

Conceptual:

```text
TravelerFieldRequirement
NOT_REQUESTED
OPTIONAL
REQUIRED
```

Не создавать enum/table name collision.

Проверить Prisma/TypeScript naming conflicts.

---

# 13. EFFECTIVE REQUIREMENTS API

API должен возвращать **effective requirements**, а не заставлять frontend самостоятельно сливать defaults + overrides.

Recommended contract conceptually:

```json
{
  "requirements": {
    "firstName": "REQUIRED",
    "lastName": "REQUIRED",
    "birthDate": "OPTIONAL",
    "passportNumber": "NOT_REQUESTED"
  }
}
```

Фактический endpoint и DTO должны соответствовать existing Product API conventions.

Не invent endpoint если можно безопасно расширить existing Product create/update/detail.

---

# 14. WRITE API

Seller/Partner with correct permission may update only own Product requirements.

Hard:

```text
Partner A cannot update Product of Partner B
```

Platform internal roles follow existing Catalog permissions.

Не вводить new permission identifiers без необходимости. Audit existing permission model first.

---

# 15. SERVER-SIDE VALIDATION

Backend validation mandatory.

Reject:

```text
unknown field names
unknown requirement states
malformed JSON
invalid Product ownership
unsupported config shapes
```

Не доверять frontend.

---

# 16. PRODUCT CREATE FLOW

Определить behavior при создании Product:

```text
no explicit requirements provided
→ default profile applied/effective

explicit valid overrides
→ overrides stored
```

Не создавать silent null semantics, которые frontend трактует по-разному.

---

# 17. PRODUCT UPDATE FLOW

При редактировании Product:

```text
requirements can change for FUTURE commerce
```

Hard:

```text
changing Product requirements
MUST NOT mutate already pinned/accepted checkout requirements
MUST NOT mutate historical Booking snapshot
```

D2 пока не реализует historical snapshot, но API/storage design не должна этому препятствовать.

---

# 18. D1 PINNING COMPATIBILITY

D1 fixed:

```text
requirements pinned at termsAcceptedAt
```

D2 должен предоставить stable source, который D3 сможет копировать/pin.

Required service/API primitive conceptually:

```text
getEffectiveTravelerRequirements(productId)
```

Не обязательно именно такое имя.

Но должен существовать reusable authoritative source.

---

# 19. FRONTEND — PRODUCT CREATE/EDIT UI

Добавить Traveler Requirements block в Partner Product create/edit UI.

UI должен быть понятен:

```text
Данные туристов
```

Для каждого field:

```text
Не запрашивать
Опционально
Обязательно
```

Избегать raw enum labels.

Использовать i18n project conventions.

---

# 20. UI GROUPING

Если field catalog достаточно большой — группировать:

```text
Основные данные
Документы
Контакты
Дополнительные данные
```

Не перегружать форму.

Но не создавать empty groups или future fields без backend support.

---

# 21. UI DEFAULTS / INHERITANCE

Если ProductType defaults используются:

UI должен ясно показывать:

```text
Default
Override
Effective value
```

или другую понятную существующую UX pattern.

Не допускать, чтобы seller думал, что `NOT_REQUESTED` означает «не задано».

---

# 22. PRODUCT DETAIL READ-ONLY

На Product detail / edit confirmation должно быть видно effective requirements.

Минимум:

```text
Traveler data requirements
field
state
```

Если Product detail для Partner существует.

Не создавать отдельный page только ради D2, если можно встроить в existing Product flow.

---

# 23. PLATFORM VS PARTNER SCOPE

Requirements принадлежат Product.

Visibility:

```text
Partner
→ own Products

Platform authorized catalog/operator roles
→ according to existing permissions
```

Storefront/Marketplace capability не должна ломать Product ownership.

Hybrid Partner support preserve.

---

# 24. SECURITY / TENANT ISOLATION

Tests minimum:

```text
Partner A read own Product requirements
Partner A update own Product requirements
Partner A cannot read/update Partner B private Product configuration where restricted
unauthorized user denied
Platform role behavior follows existing permission model
```

UI hidden state ≠ security.

---

# 25. DATA MIGRATION / BACKFILL

Если schema changes:

- migration must be deterministic;
- existing Products must remain valid;
- effective defaults must be defined;
- no destructive rewrite.

Do not require full dev reset.

Existing representative DB must survive migration.

---

# 26. EXISTING PRODUCT COMPATIBILITY

For all current Products:

```text
effective requirements computable
```

No Product should become unusable because config is null.

Hard:

```text
legacy Products
→ deterministic defaults
```

---

# 27. API BACKWARD COMPATIBILITY

Existing Product API consumers should not break.

If response is extended:

```text
additive preferred
```

If request DTO changes:

```text
new field optional unless intentional breaking migration
```

Document changes.

---

# 28. NO TRAVELER COLLECTION IN D2

D2 must NOT implement:

```text
checkout traveler form
Request traveler entry
OrderTraveler population
Passenger population
Booking snapshot
Voucher
```

These remain D3/D13.

---

# 29. NO REPRESENTATIVE E2E RESEED YET

Do not fix Booking `361-0-361-0` in D2.

Do not add random statuses.

Representative end-to-end chain coverage belongs to D4.

D2 may add minimal test fixtures only for requirements testing.

---

# 30. AUTOMATED TESTS — BACKEND

Minimum:

```text
defaults by ProductType
valid override
invalid enum/state rejected
unknown field rejected
effective requirements computed
legacy Product defaults
Product create with requirements
Product update requirements
Partner ownership enforced
Partner A cannot mutate Partner B Product
Platform permitted role behavior
```

---

# 31. AUTOMATED TESTS — FRONTEND

Minimum:

```text
Traveler Requirements block renders
states shown in localized labels
ProductType defaults shown
seller changes requirement
save persists
reload shows persisted effective values
validation errors visible
unauthorized UI cannot edit
```

Use existing testing stack.

---

# 32. API RUNTIME EVIDENCE

Authenticated runtime evidence minimum:

```text
GET Product → effective requirements
UPDATE own Product requirements → 200
reload → persisted
invalid requirement → 400
Partner A → Partner B update denied
```

Use actual endpoints.

Do not invent evidence.

---

# 33. BROWSER RUNTIME EVIDENCE — MANDATORY

Authenticated browser:

```text
Partner Workspace
→ Product create/edit
→ Traveler Requirements block
```

Demonstrate at least:

```text
one TOUR/EXCURSION-like Product
one ProductType with stricter document requirements if supported
```

Show:

```text
default profile
change OPTIONAL → REQUIRED
save
refresh
value persists
```

No screenshots required in report if tooling does not produce them, but browser steps and observed results must be explicit.

---

# 34. DB EVIDENCE

If storage changed, show representative rows/config shape.

No sensitive data.

Evidence:

```text
existing Products preserved
new config persisted
legacy Product effective defaults resolved
```

---

# 35. I18N

All user-visible labels must use project localization.

At minimum current supported locales.

No raw keys such as:

```text
traveler.requirements.REQUIRED
```

visible in runtime.

---

# 36. ACCESSIBILITY / UX

Requirements controls must have:

```text
label
clear state
keyboard interaction
focus state
validation feedback
```

Do not hide meaning in color only.

---

# 37. ROADMAP UPDATE

Update canonical roadmap additively.

After successful D2 implementation:

```text
D2 → IMPLEMENTED, PENDING STRICT REVIEW
```

Do **not** mark D2 fully ACCEPTED until separate Strict Review passes.

TRUE NEXT after implementation report:

```text
D2 STRICT REVIEW
```

not D3.

---

# 38. STRICT REVIEW PAIRING — HARD RULE

Project process:

```text
D2 Implementation
→ D2 Strict Review
→ ACCEPTED
→ D3
```

Implementation report alone cannot close D2.

---

# 39. REQUIRED IMPLEMENTATION REPORT

Create:

```text
PHASE 3 — PRE-STEP 3.12 — D2
PRODUCT TRAVELER REQUIREMENTS — IMPLEMENTATION REPORT
```

Predominantly Russian.

Minimum sections:

1. Executive Summary
2. Starting Git State
3. Sources Audited
4. Existing Product Configuration Audit
5. Field Catalog
6. Requirement State Contract
7. ProductType Defaults
8. Storage Decision
9. Backend Implementation
10. API Contract
11. Security/Tenant Isolation
12. Frontend Implementation
13. i18n
14. Migration/Compatibility
15. Backend Tests
16. Frontend Tests
17. API Runtime Evidence
18. Browser Runtime Evidence
19. DB Evidence
20. Files Changed
21. Roadmap Update
22. Git Closure
23. Residual Risks
24. Final Implementation Verdict
25. TRUE NEXT

---

# 40. IMPLEMENTATION VERDICT

Allowed implementation success:

```text
VERDICT A — D2 PRODUCT TRAVELER REQUIREMENTS
IMPLEMENTATION COMPLETED — PENDING STRICT REVIEW
```

Do not write:

```text
D2 ACCEPTED
```

before Strict Review.

---

# 41. GIT CLOSURE

After implementation:

```bash
git diff --check
git status
git diff
git commit
git push
git rev-parse HEAD
git rev-parse origin/master
```

Report:

```text
Starting SHA
Implementation SHA
Final SHA
origin/master SHA
HEAD == origin: YES
Working tree state
```

No pending/TBD.

---

# 42. HARD ACCEPTANCE GATES — IMPLEMENTATION

Implementation may get `VERDICT A ... PENDING STRICT REVIEW` only if:

```text
[ ] Existing Product config architecture audited
[ ] No duplicate config subsystem created unnecessarily
[ ] NOT_REQUESTED/OPTIONAL/REQUIRED implemented
[ ] Supported traveler field catalog explicit
[ ] ProductType defaults implemented
[ ] Effective requirements deterministic
[ ] Seller override works
[ ] Backend validates requirement states
[ ] Unknown fields rejected
[ ] Product create compatible
[ ] Product update compatible
[ ] Legacy Products resolve defaults
[ ] Partner ownership enforced server-side
[ ] Cross-tenant mutation denied
[ ] Reusable effective-requirements source exists for D3
[ ] Product UI exposes requirements
[ ] Localized labels render correctly
[ ] Save/reload persists
[ ] API runtime evidence passes
[ ] Browser runtime evidence passes
[ ] DB migration/data integrity verified
[ ] No checkout traveler collection implemented
[ ] No OrderTraveler/Passenger implementation performed
[ ] No random KPI/status seed changes performed
[ ] Roadmap says PENDING STRICT REVIEW
[ ] Real Final SHA
[ ] Push succeeded
[ ] HEAD == origin
```

Any missing hard gate:

```text
VERDICT B — D2 IMPLEMENTATION INCOMPLETE
```

---

# 43. RESIDUAL DEBTS — PRESERVE

Do not lose:

```text
D3 Traveler Collection + Order/Booking Population
D4 Traveler Security + Representative End-to-End Commerce Chains
D5 Orders Full-Page Detail
D6 Bookings Full-Page Detail
D7 Payment/Refund Semantics
D8 Global Temporal Visibility
D9 Export Framework Requalification
D10 Partner Performance Attribution
D11 Project-Wide KPI/Status Semantics + Total Reconciliation
D12 CRM/KPI Drill-down Routing Requalification
D13 Voucher
D14 PRE-STEP 3.12 Final Requalification
```

---

# 44. STOP RULE

After D2 implementation report:

```text
STOP.
```

Do not start D2 Strict Review automatically.

Final report must explicitly state:

```text
TRUE NEXT:
D2 — PRODUCT TRAVELER REQUIREMENTS — STRICT REVIEW

NOT STARTED.
```
