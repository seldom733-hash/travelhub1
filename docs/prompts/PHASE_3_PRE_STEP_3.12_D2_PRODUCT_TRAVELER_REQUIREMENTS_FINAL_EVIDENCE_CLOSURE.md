# PHASE 3 — PRE-STEP 3.12 — D2 — PRODUCT TRAVELER REQUIREMENTS — FINAL EVIDENCE CLOSURE

## ROLE — MANDATORY

Ты работаешь как **Independent Senior Software Architect + Principal Code Reviewer + Security Reviewer + QA/Runtime Verification Engineer** проекта TravelHub.

Это **Final Evidence Closure**, а не повторная реализация D2.

Текущая ситуация:

```text
D2 Implementation                    ✅ выполнен
D2 Strict Review — core verification ✅ выполнен
D2 Final Acceptance                  ❌ ещё не разрешён
```

Причина: предыдущий Strict Review подтвердил core implementation, но не предоставил полный evidence по security/tenant isolation, browser runtime, ProductType-change semantics, legacy compatibility, canonical justification defaults, Git closure и roadmap closure.

Твоя задача:

```text
VERIFY MISSING HARD GATES
→ REMEDIATE ONLY IF A REAL DEFECT IS FOUND
→ RE-VERIFY
→ CLOSE D2 OR RETURN VERDICT B
```

Existing code и предыдущий report являются evidence, но **не canonical business truth**.

Не начинай D3.

---

## LANGUAGE REQUIREMENT — MANDATORY

Итоговый **Final Evidence Closure Report должен быть преимущественно на русском языке**.

На русском:

- Executive Summary;
- findings;
- root cause;
- architecture justification;
- security findings;
- runtime observations;
- remediation descriptions;
- conclusions;
- verdict explanation;
- residual risks.

Английский допускается для:

- code identifiers;
- paths;
- DTO/model/class/method names;
- API endpoints;
- HTTP methods/statuses;
- enum values;
- permission identifiers;
- CLI/Git commands;
- commit messages;
- code snippets;
- standardized `VERDICT` strings.

Если итоговый report преимущественно английский:

```text
D2 FINAL EVIDENCE CLOSURE = INCOMPLETE
```

Plaintext passwords, tokens, secrets и credentials запрещены.

---

# 1. SCOPE

Не повторять весь D2 audit.

Закрыть только недоказанные hard gates:

```text
A. Canonical justification ProductType defaults
B. firstName/lastName invariant
C. Read authorization
D. Write authorization / tenant isolation
E. Platform permissions
F. omitted vs null PATCH semantics
G. ProductType-change semantics
H. default-vs-override frontend behavior
I. browser save → refresh persistence
J. legacy Product runtime
K. focused integration/e2e evidence
L. Git closure
M. Roadmap closure
```

Если при этих проверках найден реальный дефект — выполнить минимальную remediation и повторить affected verification.

---

# 2. STARTING GIT STATE

Выполнить:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git log -n 8 --oneline
```

Зафиксировать:

```text
Starting SHA
origin/master SHA
branch
working tree state
```

Не копировать SHA из предыдущего report без проверки.

---

# 3. PRODUCTTYPE DEFAULTS — CANONICAL JUSTIFICATION

Предыдущий review сообщил:

```text
9 ProductType defaults match spec exactly
```

Этого недостаточно.

Нужно определить, **что является источником этого spec**.

Для каждого actual ProductType составить:

| ProductType | Effective Default Profile | Canonical Source / Decision | Status |
|---|---|---|---|
| | | | |

Проверить:

```text
TOUR
HOTEL
FLIGHT
TRAIN
EXCURSION
TRANSFER
SANATORIUM
GUIDE
PHOTOGRAPHER
```

только если это действительно полный current enum.

Не утверждать отраслевую необходимость без project source.

Если точные defaults ранее не были зафиксированы canonical architecture, это не обязательно блокирует D2, но тогда:

1. признать их **TravelHub V1 default policy**, а не внешнюю универсальную истину;
2. явно документировать эту policy в canonical architecture;
3. seller override сохраняется;
4. future policy changes не должны мутировать уже pinned checkout snapshots.

Hard:

```text
implementation-defined defaults
≠ automatically canonical defaults
```

---

# 4. FIRSTNAME / LASTNAME INVARIANT

Предыдущая реализация сделала:

```text
firstName = REQUIRED
lastName  = REQUIRED
```

для всех ProductType.

Дай явный архитектурный ответ:

```text
Are firstName and lastName required for every Traveler in TravelHub V1?
YES / NO / CONTEXT-DEPENDENT
```

Обосновать через существующий domain:

```text
Traveler
Passenger
OrderTraveler future contract
Booking fulfillment
Voucher
```

Если это V1 invariant — зафиксировать canonical documentation.

Если нет — исправить defaults.

---

# 5. READ AUTHORIZATION — MANDATORY RUNTIME

Проверить actual endpoint:

```text
GET /products/:id/traveler-requirements
```

Runtime matrix:

| Actor | Product | Expected | Actual |
|---|---|---|---|
| Partner A | own Product | according to permissions | |
| Partner A | Partner B Product | according to Product visibility contract | |
| unauthenticated | Product | according to public/private contract | |
| Platform authorized role | Product | according to Catalog permissions | |

Важно:

```text
READ visibility
≠ WRITE ownership
```

Если Product является Marketplace-public entity, cross-partner read может быть допустим — но это должно следовать из canonical Product visibility model, а не случайно из отсутствия guard.

---

# 6. WRITE AUTHORIZATION / TENANT ISOLATION — HARD SECURITY GATE

Actual API runtime:

```text
Partner A
→ PATCH Product A travelerRequirements
→ success

Partner A
→ PATCH Product B travelerRequirements
→ MUST BE DENIED
```

Проверить server-side.

Не принимать:

```text
button hidden
route inaccessible from UI
```

как security evidence.

Hard invariant:

```text
Partner A cannot mutate Partner B Product configuration
```

Если нарушение обнаружено:

```text
P0/P1
→ remediate immediately
→ add regression test
→ runtime re-test
```

---

# 7. PLATFORM PERMISSIONS

Проверить существующий Catalog permission contract.

Определить actual internal role(s), которые:

```text
may read Product requirements
may edit Product requirements
```

Не создавать новый permission identifier без необходимости.

Проверить минимум одного разрешённого и, если существует соответствующая роль, одного запрещённого Platform actor.

---

# 8. PATCH — OMITTED VS NULL

Проверить отдельно:

### Case A

```json
{
  "title": "Updated title"
}
```

Expected:

```text
travelerRequirements unchanged
```

### Case B

```json
{
  "travelerRequirements": null
}
```

Expected:

```text
explicit override cleared
effective requirements return to ProductType defaults
```

Hard:

```text
omitted !== null
```

Показать API + DB evidence.

---

# 9. PRODUCTTYPE CHANGE SEMANTICS

Проверить реальный behavior.

Scenario 1:

```text
ProductType = TOUR
partial override:
passportNumber = REQUIRED

change:
TOUR → FLIGHT
```

Определить expected contract и actual result.

Preferred current merge model, если он соответствует implementation:

```text
new ProductType defaults
+
same explicit Product overrides
=
new effective requirements
```

Но это должно быть явно зафиксировано.

Scenario 2:

```text
FLIGHT → TRANSFER
```

Проверить, что не возникает unintended stale effective requirement.

Если explicit override продолжает действовать — UI должен показывать, что это именно override.

---

# 10. DEFAULT VS OVERRIDE UX — CRITICAL

Проверить frontend save behavior.

Главный риск:

```text
Product has travelerRequirements = NULL
        ↓
UI loads effective defaults
        ↓
seller changes nothing
        ↓
Save
        ↓
frontend accidentally sends all 7 effective values
        ↓
Product now has full explicit override
```

Это может silently freeze ProductType defaults.

Проверить:

```text
Does unchanged form preserve NULL/inheritance?
Does changing one field send/store only intended override?
Does reset restore inheritance?
```

Expected architecture:

```text
DEFAULT POLICY
+
EXPLICIT OVERRIDE
=
EFFECTIVE REQUIREMENTS
```

Не должно случайно превращаться в:

```text
EFFECTIVE REQUIREMENTS
→ FULL OVERRIDE ON EVERY SAVE
```

Если current implementation intentionally stores full snapshots at Product level, это должно быть явно justified; иначе remediate.

---

# 11. BROWSER SAVE → REFRESH — MANDATORY

Authenticated Partner browser runtime:

```text
1. Open own Product edit
2. Locate "Данные туристов"
3. Observe current state
4. Change one requirement
5. Save
6. Confirm success
7. Refresh page
8. Reopen/edit if necessary
9. Confirm changed value persisted
```

Затем:

```text
10. Reset override/inheritance if UI supports it
11. Save
12. Refresh
13. Confirm ProductType defaults restored
```

Report actual observed values.

Не заменять browser runtime unit test'ом.

---

# 12. PRODUCTTYPE CHANGE — BROWSER/API RUNTIME

В runtime:

```text
Product type A
→ observe effective requirements
→ set partial override
→ change ProductType
→ save
→ refresh
→ verify new defaults + override semantics
```

Report before/after matrix.

---

# 13. LEGACY PRODUCT RUNTIME

Найти Product с:

```text
travelerRequirements IS NULL
```

или безопасно создать equivalent fixture без DB reset.

Проверить:

```text
GET Product works
GET effective requirements works
edit UI loads
defaults render
unrelated Product update does not populate/corrupt travelerRequirements
```

Hard:

```text
existing Products remain backward compatible
```

---

# 14. FOCUSED INTEGRATION / E2E TESTS

41 unit tests уже существуют; не надо дублировать их.

Добавить/подтвердить focused API/integration/e2e coverage минимум для:

```text
POST with partial override
PATCH with partial override
PATCH omitted travelerRequirements
PATCH travelerRequirements=null
GET effective
invalid field/state
Partner A → Partner B PATCH denied
legacy NULL Product
ProductType change
```

Если существующая e2e architecture позволяет объединить сценарии — допустимо.

Evidence должен показывать actual pass count.

---

# 15. DB EVIDENCE

Показать безопасно:

```text
legacy/inherited Product
travelerRequirements = NULL

partial override Product
travelerRequirements = {...}
```

И reconciliation:

```text
DB stored override
+
ProductType defaults
=
API effective requirements
```

No sensitive traveler/customer data.

---

# 16. D3 PINNING COMPATIBILITY — FINAL CONFIRMATION

Не реализовывать D3.

Подтвердить контракт:

```text
At termsAcceptedAt:

effectiveRequirements =
getEffectiveTravelerRequirements(Product)

D3 will copy/pin effectiveRequirements
into checkout/order traveler snapshot

After pin:
Product requirements may change
without mutating accepted checkout snapshot
```

Если D2 service/API делает это возможным — PASS.

Если D3 пришлось бы повторно вычислять mutable Product requirements после acceptance — FAIL.

---

# 17. NO D3 IMPLEMENTATION

Не создавать сейчас:

```text
traveler checkout form
OrderTraveler population
Passenger population
Booking traveler snapshot
Voucher
representative commerce chains
```

D3/D4/D13 остаются отдельными стадиями.

---

# 18. NO KPI / CRM REMEDIATION HERE

Не исправлять в D2:

```text
Analytics Active Customers = 51
CRM Customers = 92
Booking KPI 361 / 0 / 361 / 0
Order KPI reconciliation
```

Это отдельные project-wide debts D11/D12.

Preserve finding conceptually:

```text
Analytics Active Customers
→ drill-down
→ CRM filtered Active Customers

must reconcile under same:
scope + period + business definition
```

Но код KPI/CRM в D2 не менять.

---

# 19. REGRESSION

Запустить relevant suites:

```text
traveler-requirements unit
catalog integration/e2e
partner product ownership/security
backend typecheck
frontend typecheck
frontend relevant tests
```

Если есть broader known failures:

```text
NEW
PRE-EXISTING
UNRELATED
```

с evidence.

---

# 20. FINDINGS MATRIX

Обязательная таблица:

| Finding | Severity | Evidence | Root Cause | Action | Result |
|---|---|---|---|---|---|
| | | | | | |

No unresolved:

```text
P0
P1
blocking P2
```

for VERDICT A.

---

# 21. FINAL ACCEPTANCE MATRIX

| Gate | Result | Evidence |
|---|---|---|
| ProductType defaults canonicalized | | |
| firstName/lastName invariant resolved | | |
| Read authorization | | |
| Write authorization | | |
| Partner tenant isolation | | |
| Platform permissions | | |
| PATCH omitted semantics | | |
| PATCH null semantics | | |
| ProductType change | | |
| Default vs override UX | | |
| Browser save-refresh | | |
| Browser reset/inheritance | | |
| Legacy Product runtime | | |
| Focused integration/e2e | | |
| DB reconciliation | | |
| D3 pinning compatibility | | |
| Regression | | |
| Russian report | | |
| Roadmap closure | | |
| Git closure | | |

Every row must contain concrete evidence.

---

# 22. ROADMAP CLOSURE

Only if all gates pass, update canonical roadmap additively:

```text
D2 — Product Traveler Requirements
STATUS: ACCEPTED
Strict Review: VERDICT A
Final Evidence Closure: VERDICT A
```

Then:

```text
TRUE NEXT:
D3 — Traveler Collection + Order/Booking Population
```

Preserve:

```text
D4 — Traveler Security
     + Representative End-to-End Commerce Chain Coverage

D11 — Project-Wide KPI / Status Semantics
      + Total Reconciliation

D12 — CRM / KPI Drill-down Routing Requalification
```

Do not silently renumber.

---

# 23. GIT CLOSURE — MANDATORY

After any remediation/docs/tests/roadmap changes:

```bash
git diff --check
git status
git diff
git commit
git push origin master
git rev-parse HEAD
git rev-parse origin/master
git status
```

Report exact:

```text
Starting SHA:
Final SHA:
origin/master:
HEAD == origin/master: YES/NO
Working tree: clean/dirty
```

No:

```text
pending
TBD
will push later
```

for VERDICT A.

---

# 24. REQUIRED FINAL REPORT

Create:

```text
PHASE 3 — PRE-STEP 3.12 — D2
PRODUCT TRAVELER REQUIREMENTS
FINAL EVIDENCE CLOSURE REPORT
```

Predominantly Russian.

Required sections:

1. Executive Summary
2. Starting Git State
3. Scope of Final Closure
4. ProductType Defaults Canonicalization
5. firstName/lastName V1 Invariant
6. Read Authorization
7. Write Authorization & Tenant Isolation
8. Platform Permissions
9. PATCH omitted vs null
10. ProductType Change Semantics
11. Default vs Override UX
12. Browser Runtime Evidence
13. Legacy Product Runtime
14. Integration/E2E Evidence
15. DB Evidence
16. D3 Pinning Compatibility
17. Regression
18. Findings Matrix
19. Acceptance Matrix
20. Remediation Performed
21. Files Changed
22. Roadmap Closure
23. Git Closure
24. Residual Risks
25. Final Verdict
26. TRUE NEXT

---

# 25. VERDICT RULES

## VERDICT A

Only if every hard gate passes:

```text
VERDICT A — D2 PRODUCT TRAVELER REQUIREMENTS
FINAL EVIDENCE CLOSURE COMPLETED — D2 ACCEPTED
```

## VERDICT B

If any required evidence is missing or any blocking defect remains:

```text
VERDICT B — D2 PRODUCT TRAVELER REQUIREMENTS
FINAL EVIDENCE CLOSURE INCOMPLETE
```

Do not soften B into A with phrases such as:

```text
mostly complete
ready enough
can be handled in D3
```

if the defect belongs to D2.

---

# 26. HARD ACCEPTANCE CHECKLIST

`VERDICT A` forbidden unless:

```text
[ ] ProductType defaults have canonical source/policy
[ ] firstName/lastName invariant explicitly resolved
[ ] Partner read behavior verified
[ ] Partner A cannot PATCH Partner B Product
[ ] Platform permission behavior verified
[ ] omitted PATCH preserves requirements
[ ] null PATCH clears override
[ ] ProductType-change semantics verified
[ ] unchanged UI does not accidentally freeze defaults OR behavior explicitly justified
[ ] one-field override behavior verified
[ ] browser save → refresh passes
[ ] browser inheritance/reset passes
[ ] legacy NULL Product runtime passes
[ ] focused integration/e2e passes
[ ] DB/API effective requirements reconcile
[ ] D3 pinning compatibility confirmed
[ ] no D3 implementation started
[ ] no KPI/CRM unrelated remediation performed
[ ] no unresolved P0/P1/blocking P2
[ ] report predominantly Russian
[ ] roadmap marks D2 ACCEPTED
[ ] TRUE NEXT = D3
[ ] Final SHA real
[ ] push succeeded
[ ] HEAD == origin/master
[ ] working tree clean
```

---

# 27. STOP RULE

After Final Evidence Closure:

```text
STOP.
```

Do not start D3 automatically.

Final line of successful report:

```text
TRUE NEXT:
D3 — TRAVELER COLLECTION + ORDER/BOOKING POPULATION

NOT STARTED.
```
