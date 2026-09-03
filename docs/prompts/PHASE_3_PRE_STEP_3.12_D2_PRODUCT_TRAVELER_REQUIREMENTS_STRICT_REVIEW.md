# PHASE 3 — PRE-STEP 3.12 — D2 — PRODUCT TRAVELER REQUIREMENTS — STRICT REVIEW

## ROLE — MANDATORY

Ты работаешь как **Independent Senior Software Architect + Principal Code Reviewer + Security Reviewer + QA/Verification Engineer** проекта TravelHub.

Это **независимый Strict Review** уже выполненного D2 implementation.

Ты НЕ должен:

- защищать существующую реализацию только потому, что она уже написана;
- считать unit tests достаточным evidence;
- принимать developer report как доказательство;
- автоматически исправлять всё подряд без root cause;
- начинать D3;
- менять canonical lifecycle ради удобства существующего кода.

Ты обязан:

- проверить code + schema + migration + API + security + UI + runtime;
- проверить business semantics Product Traveler Requirements;
- проверить ProductType defaults;
- проверить tenant isolation;
- проверить persistence;
- проверить совместимость с D3 pinning at `termsAcceptedAt`;
- дать VERDICT A только после прохождения всех hard gates.

Hard rule:

```text
EXISTING CODE = EVIDENCE
NOT CANONICAL BUSINESS TRUTH
```

Verification chain:

```text
CANONICAL CONTRACT
→ DB / MIGRATION
→ DOMAIN SERVICE
→ API
→ AUTHORIZATION
→ FRONTEND
→ BROWSER RUNTIME
→ PERSISTENCE
→ D3 COMPATIBILITY
```

## LANGUAGE REQUIREMENT — MANDATORY

Все review reports, findings, root cause analysis, security findings, runtime evidence, conclusions и verdict explanations должны быть преимущественно **на русском языке**.

Английский допускается только для technical identifiers, paths, endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, permission identifiers, code snippets и standardized `VERDICT` strings.

Если Strict Review Report преимущественно английский — review не завершён. Plaintext passwords/tokens/secrets/credentials запрещены.

## 1. REVIEW TARGET

D2 implementation report claims:

```text
Status: IMPLEMENTED (PENDING STRICT REVIEW)

Product.travelerRequirements Json?
7 traveler fields
3 states:
NOT_REQUESTED
OPTIONAL
REQUIRED

ProductType defaults implemented
effective merge implemented
GET /products/:id/traveler-requirements added
Product create/update integration added
Partner UI editor added
41/41 unit tests pass
```

Review должен независимо подтвердить или опровергнуть каждое существенное утверждение.

## 2. STARTING GIT STATE

Выполнить:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log -n 8 --oneline
```

Зафиксировать Starting SHA, origin/master SHA, branch и working tree state. Не использовать SHA из отчёта как источник истины без repository verification.

## 3. REQUIRED SOURCES

Изучить canonical lifecycle/Traveler docs, D1/D1A/D2 reports, canonical roadmap, Prisma schema/migration, traveler-requirements module, Catalog service/controller/DTOs, Product ownership/security, backend tests, frontend editor/forms/pages/API/i18n/tests.

## 4. DID D2 BUILD THE RIGHT THING?

Canonical states:

```text
NOT_REQUESTED → not shown / not collected / not validated
OPTIONAL      → shown / may be omitted
REQUIRED      → shown / server-side required in D3
```

D2 не собирает traveler data, но его contract должен поддерживать эти semantics без ambiguity.

## 5. STORAGE REVIEW

Current claimed storage:

```text
Product.travelerRequirements Json?
```

Проверить JSONB choice относительно finite catalog, per-product config, existing JSON patterns, future D3 snapshot, validation, migration, null semantics и historical stability. Не отвергать JSON только ради normalization preference.

## 6. MIGRATION REVIEW

Hard checks:

```text
existing Product rows preserved
column null/default semantics correct
migration non-destructive
Prisma schema matches DB migration
no full DB reset
```

## 7. FIELD CATALOG REVIEW

Current claimed fields:

```text
firstName
lastName
birthDate
citizenship
gender
passportNumber
passportExpiry
```

Для каждого классифицировать:

```text
SUPPORTED_BY_CURRENT_DOMAIN
SUPPORTED_BUT_FUTURE_COLLECTION
UNSUPPORTED / INVENTED
```

Hard: `UNSUPPORTED / INVENTED = 0` для A либо remediation.

## 8. FIRSTNAME / LASTNAME INVARIANT

Implementation показывает `firstName`/`lastName` REQUIRED для всех ProductType. Проверить QuoteTraveler, CheckoutIntentTraveler, future OrderTraveler, Passenger, Voucher и fulfillment semantics.

Ответить явно:

```text
Are firstName + lastName always required for every Traveler?
YES / NO / CONTEXT-DEPENDENT
```

## 9. PRODUCTTYPE DEFAULTS — HARD ARCHITECTURE REVIEW

Для каждого actual ProductType построить:

| ProductType | Current Defaults | Source / Rationale | Canonical? | Action |
|---|---|---|---|---|

Developer intuition ≠ canonical business requirement. Если exact defaults в architecture отсутствуют, выбрать safe documented baseline, а не выдавать industry assumption за canonical truth.

## 10. PRODUCTTYPE ENUM COVERAGE

Проверить, что каждый существующий enum value имеет deterministic defaults; stale/missing/fallback silent paths отсутствуют.

## 11. DEFAULT / OVERRIDE MERGE SEMANTICS

Проверить code/tests/runtime для:

```text
NULL → defaults
{} → defaults
partial override → defaults + override
full override
null update → clear override
```

## 12. PRODUCTTYPE CHANGE SEMANTICS

Critical edge case:

```text
TOUR + passportNumber=REQUIRED
→ change ProductType to FLIGHT
```

Проверить, как пересчитываются effective requirements. Также проверить `FLIGHT → TRANSFER`. Не должно оставаться stale hidden semantics без явного contract.

## 13. VALIDATION

Backend должен reject unknown field/state, nested object, arrays, malformed types/payloads. Frontend-only validation = FAIL.

## 14. CREATE / UPDATE API CONTRACT

Проверить POST/PATCH без field, с partial/full override, invalid override и `null` clear. Hard distinction:

```text
omitted field ≠ null
```

если только contract явно не говорит обратное.

## 15. AUTHORITATIVE EFFECTIVE REQUIREMENTS SERVICE

Должна существовать одна authoritative merge implementation, которую D3 сможет использовать. Frontend/API/D3 не должны дублировать defaults merge.

## 16. READ AUTHORIZATION

Review actual:

```text
GET /products/:id/traveler-requirements
```

Проверить own Product, Partner B Product, unauthenticated access, Platform authorized role. Read-only endpoint всё равно обязан следовать canonical Product visibility model.

## 17. WRITE AUTHORIZATION / TENANT ISOLATION

Hard:

```text
Partner A cannot mutate Product B traveler requirements
```

Проверить server-side ownership/permission, включая Hybrid Partner context.

## 18. PLATFORM INTERNAL ACCESS

Определить реальные Catalog permissions и роли, которые могут read/edit. Не invent новые permission identifiers.

## 19. FRONTEND EDITOR / UX

Проверить all supported fields, 3-state clarity, localized labels, current effective value, override behavior, validation, keyboard use, отсутствие raw enums/keys.

## 20. DEFAULT VS OVERRIDE UX — CRITICAL

Проверить, различает ли UI:

```text
ProductType default
explicit Product override
effective result
```

Не допускается silent freeze defaults, когда seller просто открывает/сохраняет форму, а frontend записывает все effective значения как explicit overrides без намерения пользователя.

## 21. SAVE → REFRESH PERSISTENCE — MANDATORY

Browser runtime:

```text
open own Product edit
change one requirement
save
refresh
reopen
verify persisted
clear override if supported
save/refresh
verify default restored
```

## 22. PRODUCTTYPE CHANGE RUNTIME

В browser/API изменить ProductType и доказать корректный effective recalculation + persistence после refresh.

## 23. LEGACY PRODUCT RUNTIME

Product с `travelerRequirements=NULL` должен: GET effective successfully, открываться в editor, показывать defaults, не ломаться при unrelated save.

## 24. I18N

Проверить runtime в поддерживаемых `ru / az / en`. Raw i18n keys запрещены.

## 25. D1 PINNING COMPATIBILITY — CRITICAL

D1 требует:

```text
requirements pinned at termsAcceptedAt
```

D2 должен дать stable authoritative source для D3.

Design proof:

```text
T0 Product requirements = A
T1 termsAcceptedAt → D3 pins A
T2 seller changes Product = B
T3 accepted checkout continues with A
new checkout uses B
```

Если D2 architecture этому мешает → blocker.

## 26. NO PREMATURE D3 / NO STATUS RESEED

Не реализовывать traveler checkout, OrderTraveler, Passenger population, Booking snapshot, Voucher. Не менять Booking `361-0-361-0` и не добавлять random status rows. Representative E2E chains остаются D4.

## 27. TEST REVIEW

Unit 41/41 недостаточно. Нужны integration/e2e для create/update/effective GET/invalid payload/ownership/cross-tenant/legacy Product/ProductType change/clear override. Frontend — editor render/state/save/load/default-vs-override/ProductType/i18n/permission behavior.

## 28. API RUNTIME EVIDENCE — MANDATORY

Записать exact observed results:

```text
GET own Product effective requirements
PATCH own Product → success
GET again → persisted
PATCH invalid state → 400
PATCH unknown field → 400
Partner A PATCH Partner B → denied
legacy Product GET → deterministic defaults
```

## 29. BROWSER RUNTIME EVIDENCE — MANDATORY

Minimum:

```text
1. open Product edit
2. block visible
3. localized labels visible
4. change OPTIONAL → REQUIRED
5. save succeeds
6. refresh
7. persists
8. change ProductType
9. effective requirements follow contract
10. no raw i18n keys
```

## 30. DB EVIDENCE

Show safe representative evidence for Product with NULL, partial override, full override if exists; API effective result must match storage + defaults.

## 31. REGRESSION

Run relevant catalog/partner/auth/frontend/backend tests/typechecks. Broader failures classify as NEW / PRE-EXISTING / UNRELATED with evidence.

## 32. FINDINGS TABLE

| Finding | Severity | Evidence | Root Cause | Required Action |
|---|---|---|---|---|
| | | | | |

Severity P0/P1/P2/P3. VERDICT A forbidden with unresolved P0/P1 and any blocking P2 affecting canonical semantics/security/runtime.

## 33. ACCEPTANCE MATRIX

| Area | Result | Evidence |
|---|---|---|
| Canonical 3-state contract | | |
| Storage model | | |
| Migration | | |
| Field catalog | | |
| firstName/lastName invariant | | |
| ProductType defaults | | |
| Enum coverage | | |
| NULL semantics | | |
| Partial override | | |
| Clear override | | |
| ProductType change | | |
| Validation | | |
| Create API | | |
| Update API | | |
| Effective GET API | | |
| Read authorization | | |
| Write authorization | | |
| Cross-tenant isolation | | |
| Platform permissions | | |
| Frontend editor | | |
| Default/override UX | | |
| i18n | | |
| Save-refresh persistence | | |
| Legacy Product | | |
| D3 pinning compatibility | | |
| Backend tests | | |
| Frontend tests | | |
| API runtime | | |
| Browser runtime | | |
| DB evidence | | |
| Regression | | |
| Roadmap | | |
| Git closure | | |

## 34. REMEDIATION RULE

Если найден defect:

```text
FIND ROOT CAUSE
→ MINIMAL CORRECT REMEDIATION
→ TEST
→ RUNTIME RE-VERIFY
```

Не откладывать блокирующий D2 defect в future debt.

## 35. ROADMAP UPDATE

При success:

```text
D2 — ACCEPTED
Strict Review — VERDICT A
TRUE NEXT = D3 — Traveler Collection + Order/Booking Population
```

Preserve D4 Representative End-to-End Commerce Chains и D11 Project-Wide KPI/Status Semantics + Total Reconciliation.

## 36. GIT CLOSURE

Если есть changes:

```bash
git diff --check
git status
git diff
git commit
git push origin master
git rev-parse HEAD
git rev-parse origin/master
```

Report: Starting SHA, Review/Remediation SHA, Final SHA, origin/master SHA, `HEAD == origin`, working tree state. No pending/TBD.

## 37. REQUIRED STRICT REVIEW REPORT

Создать `PHASE 3 — PRE-STEP 3.12 — D2 PRODUCT TRAVELER REQUIREMENTS — STRICT REVIEW REPORT` преимущественно на русском.

Минимум: Executive Summary; Starting Git State; Sources Reviewed; Canonical Contract Review; Storage/Migration; Field Catalog; firstName/lastName Invariant; ProductType Defaults; Override/ProductType Change Semantics; Backend/API; Authorization/Tenant Isolation; Frontend/UX; i18n; Legacy Compatibility; D3 Pinning Compatibility; Tests; API Runtime; Browser Runtime; DB Evidence; Regression; Findings Matrix; Acceptance Matrix; Remediation; Files Changed; Roadmap; Git Closure; Residual Risks; Final Verdict; TRUE NEXT.

## 38. HARD ACCEPTANCE GATES

`VERDICT A` only if all:

```text
[ ] Existing implementation independently reviewed
[ ] 3-state semantics correct
[ ] Storage and migration acceptable
[ ] Field catalog canonical
[ ] firstName/lastName invariant explicitly resolved
[ ] Every ProductType deterministic
[ ] Defaults justified/canonicalized
[ ] NULL/empty/partial/full/clear semantics verified
[ ] ProductType change verified
[ ] Invalid fields/states rejected
[ ] Create/Update/Effective GET verified
[ ] Read authorization correct
[ ] Partner A cannot mutate Partner B
[ ] Platform permissions correct
[ ] Cross-tenant isolation proven
[ ] Frontend editor works
[ ] Default-vs-override behavior not misleading
[ ] Save → refresh persistence proven
[ ] ProductType-change runtime proven
[ ] Legacy Product works
[ ] ru/az/en labels verified
[ ] D3 pinning compatibility proven
[ ] Integration/e2e coverage adequate
[ ] API runtime complete
[ ] Browser runtime complete
[ ] DB evidence consistent
[ ] No premature D3 implementation
[ ] No random Booking/status reseed
[ ] No unresolved P0/P1/blocking P2
[ ] Roadmap marks D2 ACCEPTED
[ ] TRUE NEXT = D3
[ ] Real Git state recorded
[ ] HEAD == origin/master
```

## 39. FAILURE CONDITIONS

Any of:

```text
unit tests only
no browser runtime
no tenant isolation proof
ProductType defaults based only on developer assumption
incorrect cross-tenant access
stale ProductType-change semantics
frontend silently freezes defaults
legacy Product fails
raw i18n keys
D3 pinning incompatible
pending Git evidence
```

→ `VERDICT B — D2 STRICT REVIEW FAILED / REMEDIATION REQUIRED`

## 40. SUCCESS VERDICT

Only after all gates:

```text
VERDICT A — D2 PRODUCT TRAVELER REQUIREMENTS
STRICT REVIEW COMPLETED — D2 ACCEPTED
```

## 41. TRUE NEXT / STOP

After success:

```text
TRUE NEXT:
D3 — TRAVELER COLLECTION + ORDER/BOOKING POPULATION

NOT STARTED.

STOP.
```

Do not start D3 automatically.
