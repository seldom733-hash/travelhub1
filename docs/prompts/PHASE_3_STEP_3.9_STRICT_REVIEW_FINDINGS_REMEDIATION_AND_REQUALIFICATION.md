# PHASE 3 — STEP 3.9 — MARKETING CENTER UI — STRICT REVIEW FINDINGS REMEDIATION + RE-QUALIFICATION

## 0. EXECUTION MODE

**TARGETED REMEDIATION OF STRICT REVIEW FINDINGS ONLY.**

Не выполнять новый полный implementation Step 3.9 и не начинать следующий roadmap step.

Strict Review завершился:

```text
VERDICT B — PHASE 3 — STEP 3.9 MARKETING CENTER UI — STRICT REVIEW FAILED

STEP 3.9 REMAINS OPEN
NEXT ACTION: TARGETED REMEDIATION REQUIRED
```

Подтверждённая цепочка:

```text
Step 3.9 implementation SHA:  c539e51
Runtime remediation SHA:      e8d54ad
Strict Review SHA:            5cf9066
Expected HEAD/origin:         5cf9066
```

Strict Review подтвердил всю остальную матрицу и обнаружил:

```text
F3 — P2 — Campaign objective accepts arbitrary text → invalid Prisma enum → raw 500
F1 — P3 — raw "SCHEDULED" status label after lifecycle transition
F2 — P3 — Audience criteria displayed as raw JSON
```

Цель этой задачи:

1. закрыть F3 обязательно;
2. закрыть F1 и F2 в том же bounded Step 3.9 remediation;
3. выполнить targeted runtime/browser requalification;
4. выполнить regression gates по ранее прошедшим critical areas;
5. получить отдельный **Strict Review Re-Qualification verdict**;
6. только при PASS закрыть Step 3.9.

---

## 1. LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые reports и prose documentation должны быть преимущественно **на русском языке**.

На русском обязательно:

- Remediation Report;
- findings;
- root cause analysis;
- architecture/security explanation;
- runtime/browser evidence;
- regression evidence;
- conclusions;
- verdict explanations.

Английский допускается только для:

- file paths;
- component/class/function/DTO/model names;
- API endpoints;
- HTTP methods/status codes;
- enum/permission identifiers;
- CLI/Git commands;
- code snippets;
- commit messages;
- standardized VERDICT strings.

Если report преимущественно на английском — задача незавершена.

---

# PART I — PREFLIGHT

## 2. GIT BASELINE

Выполнить:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -15 --oneline
```

Ожидается:

```text
HEAD:          5cf9066
origin/master: 5cf9066
```

Не stage pre-existing unrelated dirty files.

---

## 3. READ THE STRICT REVIEW FINDINGS

Открыть фактический:

```text
docs/prompts/PHASE_3_STEP_3.9_MARKETING_CENTER_UI_STRICT_REVIEW_REPORT.md
```

или фактический report path.

Проверить точные reproduction/evidence для F1/F2/F3.

Не расширять scope за пределы findings и необходимых regression fixes.

---

# PART II — F3 / P2 — CAMPAIGN OBJECTIVE CONTRACT

## 4. ROOT CAUSE

Подтвердить фактическую цепочку:

```text
Campaign create UI
→ free-text objective
→ arbitrary client value
→ backend DTO/service
→ Prisma enum field
→ invalid enum reaches Prisma
→ raw 500
```

Установить фактический canonical enum из repository/schema.

Ожидаемо:

```text
AWARENESS
ENGAGEMENT
CONVERSION
RETENTION
REACTIVATION
```

**Не доверять этому списку вслепую** — сверить с актуальным Prisma/domain contract.

Если actual enum отличается, использовать actual canonical enum и зафиксировать расхождение.

---

## 5. FRONTEND FIX — BOUNDED OBJECTIVE CONTROL

Если objective является enum, заменить arbitrary free-text input на bounded control, предпочтительно существующий project select primitive.

Пример semantics:

```text
Objective
├ AWARENESS
├ ENGAGEMENT
├ CONVERSION
├ RETENTION
└ REACTIVATION
```

Пользователь должен видеть локализованные human-readable labels, а API получать canonical enum value.

Hard rules:

```text
no arbitrary free text
no raw enum as user-facing label where i18n exists
no client-generated unknown values
no default value that is invalid
```

Проверить create/edit flows, если objective редактируется в нескольких местах.

---

## 6. BACKEND FIX — SERVER-AUTHORITATIVE VALIDATION

Frontend select **не является security/correctness authority**.

Backend обязан отклонять invalid objective до Prisma.

Использовать существующий NestJS validation convention проекта.

Например, если соответствует repository style:

```ts
@IsEnum(CampaignObjective)
objective: CampaignObjective;
```

или equivalent canonical DTO validation.

Не дублировать enum строками в нескольких местах без необходимости.

Предпочесть единый canonical type/source, если архитектура проекта это позволяет.

### Required behavior

```text
valid objective   → normal create
invalid objective → controlled 4xx
invalid objective → 0 Campaign rows persisted
invalid objective → no Prisma raw error
invalid objective → no 500
```

Если canonical API convention проекта использует `400`, не менять глобально на `422` только ради prompt.

Главный hard gate:

```text
INVALID CLIENT INPUT MUST NEVER BECOME RAW 500
```

---

## 7. DIRECT API NEGATIVE TESTS

Обязательно проверить backend напрямую, не только через `<select>`.

Минимум:

```text
objective = INVALID
objective = ""
objective = random string
objective = lowercase unsupported value
objective = object/array where DTO parser permits request
```

Ожидаемо controlled validation `4xx`.

После каждого rejected request подтвердить:

```text
Campaign row count unchanged
```

Не допускать partial persistence.

---

# PART III — F1 / P3 — RAW STATUS LABEL

## 8. FIX STATUS LOCALIZATION

Strict Review finding:

```text
SCHEDULED
```

показывается пользователю raw после transition.

Проверить root cause:

```text
missing i18n mapping?
transition response bypasses formatter?
local optimistic state stores enum directly?
StatusBadge receives raw enum?
```

Исправить root cause, а не только конкретную строку `SCHEDULED`.

Проверить все Campaign statuses:

```text
DRAFT
SCHEDULED
ACTIVE
PAUSED
COMPLETED
CANCELLED
```

Все user-facing labels должны использовать существующий Marketing i18n contract.

Проверить:

```text
RU
AZ
EN
```

Hard gate:

```text
no raw Campaign lifecycle enum visible after initial load or transition
```

---

# PART IV — F2 / P3 — AUDIENCE CRITERIA READABILITY

## 9. REMOVE RAW JSON AS PRIMARY USER-FACING VIEW

Finding:

```text
Audience criteria displayed as raw JSON
```

Не показывать пользователю как основной UI:

```text
{"lifecycle":"ACTIVE","tags":["vip"]}
```

если это business-facing Marketing Center.

Использовать bounded, readable presentation на основе canonical whitelist:

```text
lifecycle
leadSource
tags
status
customerType
```

Например conceptually:

```text
Жизненный цикл: Активный
Источник лида: Marketplace
Теги: VIP, Repeat
Тип клиента: ...
```

Фактический UI должен соответствовать существующему design system: badges/rows/definition list/chips и т. п.

Не создавать новый Audience framework.

---

## 10. AUDIENCE SAFETY MUST REMAIN INTACT

Readability fix не должен расширять criteria contract.

Запрещённые поля по-прежнему не должны становиться доступными:

```text
email
phone
url
address
socialHandle
partnerId
tenantId
ownerId
createdById
password
auth
token
secret
rawSql
query
$where
$expr
```

Не добавлять arbitrary JSON editor.

Не раскрывать PII.

---

# PART V — TESTS

## 11. BACKEND REGRESSION TESTS

Добавить meaningful tests минимум на:

```text
valid objective accepted
each canonical objective accepted where practical
invalid objective rejected before Prisma
invalid objective does not persist
invalid objective does not return 500
```

Если global ValidationPipe already unit-tested, всё равно нужен Marketing contract regression test.

---

## 12. FRONTEND REGRESSION TESTS

Добавить/обновить tests минимум на:

```text
objective rendered as bounded select/control
canonical options present
arbitrary objective cannot be entered through normal UI
localized objective labels if applicable
SCHEDULED localized after lifecycle transition
all lifecycle statuses have translation mapping
Audience criteria displayed readably
Audience raw JSON not primary presentation
```

Не писать brittle snapshot-only tests вместо behavioral assertions.

---

## 13. RUN REGRESSION SUITES

Запустить:

```text
Marketing frontend tests
navigation/RBAC frontend tests
full frontend suite if canonical
Marketing backend tests
Communication regression tests
TypeScript
Frontend build
Backend build if canonical pipeline requires it
```

Указать точные counts.

---

# PART VI — AUTHENTICATED BROWSER REQUALIFICATION

## 14. CAMPAIGN CREATE — VALID OBJECTIVE

Под ADMIN или MARKETER:

```text
open /app/marketing
open Campaign create
verify Objective is bounded control
verify localized labels
select valid objective
create Campaign
```

Ожидаемо:

```text
success
new Campaign visible
no console error
no unexpected network error
```

Удалить task-owned test Campaign после evidence, если cleanup policy требует.

---

## 15. INVALID OBJECTIVE — SERVER AUTHORITY

Поскольку UI больше не позволяет arbitrary value, выполнить authenticated direct API negative request.

Например через approved project/runtime tooling.

Проверить:

```text
invalid objective → controlled 4xx
response contains controlled validation error
no raw Prisma internals
no stack trace
no 500
DB unchanged
```

Это обязательный gate.

---

## 16. STATUS LOCALIZATION REQUALIFICATION

В browser выполнить lifecycle transition, который приводит минимум к:

```text
SCHEDULED
```

После transition проверить:

```text
localized label immediately
localized label after refresh
localized label after navigating away/back
```

Проверить также отображение других имеющихся statuses.

Hard gate:

```text
raw "SCHEDULED" occurrences in user-facing UI = 0
```

---

## 17. AUDIENCE CRITERIA REQUALIFICATION

Открыть Campaign/Audience с реальными criteria.

Проверить:

```text
criteria readable
labels localized
tags readable
no raw JSON as primary UI
no PII
no forbidden fields
```

Если есть несколько criteria, проверить composition.

---

# PART VII — REGRESSION GATES FROM PASSED STRICT REVIEW

## 18. DO NOT RE-RUN FULL STRICT REVIEW, BUT RECHECK CRITICAL REGRESSIONS

Strict Review уже независимо подтвердил остальную матрицу.

После remediation повторно проверить минимум:

```text
ADMIN Marketing nav visible
MARKETER Marketing usable
PARTNER Marketing nav hidden
PARTNER direct route denied/no data
FINANCE nav hidden
FINANCE direct route denied/no data
>=2 Campaign rows render
expand/collapse works
React key warning remains 0
lifecycle valid transition works
Audience tab works
Attribution tab works
no fake transports/analytics/consent
```

Это regression requalification, не новый полный Strict Review.

---

## 19. CONSOLE HARD GATE

Перед browser run очистить console.

После полного remediation scenario:

```text
unexpected React warnings = 0
React key warning = 0
hydration errors = 0
uncaught exceptions = 0
raw Prisma errors = 0
```

---

## 20. NETWORK HARD GATE

Positive flows:

```text
0 unexpected 4xx/5xx
```

Negative objective test:

```text
expected controlled 4xx
not 500
```

Проверить отсутствие duplicate requests/request loops.

---

# PART VIII — CLEANUP

## 21. CLEAN TASK-OWNED TEST DATA

Удалить только данные, созданные remediation/requalification.

Подтвердить:

```text
task-owned Campaigns = 0
task-owned Audiences = 0
task-owned Attributions = 0
```

если тестовые данные не должны сохраняться по canonical evidence policy.

Не удалять pre-existing records.

---

# PART IX — REPORTS

## 22. REMEDIATION REPORT

Создать:

```text
docs/prompts/PHASE_3_STEP_3.9_STRICT_REVIEW_FINDINGS_REMEDIATION_REPORT.md
```

Структура:

```text
1. Baseline
2. Strict Review findings
3. F3 root cause
4. F3 frontend fix
5. F3 backend authority fix
6. F1 localization fix
7. F2 Audience readability fix
8. Automated tests
9. Browser requalification
10. Direct API negative evidence
11. Regression gates
12. Console/network evidence
13. Cleanup
14. Files changed
15. Git closure
16. Re-Qualification verdict
```

Отчёт преимущественно на русском языке.

---

# PART X — GIT CLOSURE

## 23. COMMIT POLICY

Перед commit:

```bash
git status --short
git diff --name-only
git diff
```

Не stage unrelated dirty files.

После successful remediation:

```bash
git add <task-owned-files-only>
git commit -m "fix(marketing): close Step 3.9 strict review findings"
git push origin master
git rev-parse HEAD
git rev-parse origin/master
```

Финально вывести реальные:

```text
Step 3.9 implementation SHA:  c539e51
Runtime remediation SHA:      e8d54ad
Strict Review SHA:            5cf9066
Findings remediation SHA:     <real SHA>
Final HEAD:                   <real SHA>
origin/master:                <real SHA>
HEAD == origin/master:        YES/NO
```

Не оставлять placeholders в final execution response.

---

# PART XI — STRICT REVIEW RE-QUALIFICATION

## 24. FINDING CLOSURE TABLE

В report обязательно:

| Finding | Severity | Required closure |
|---|---:|---|
| F3 — arbitrary objective → raw 500 | P2 | CLOSED |
| F1 — raw lifecycle enum | P3 | CLOSED |
| F2 — raw Audience JSON | P3 | CLOSED |

Для каждого привести code + test + runtime evidence.

---

## 25. RE-QUALIFICATION PASS CONDITIONS

PASS только если:

```text
F3 CLOSED
objective UI bounded to canonical enum
backend validates objective before Prisma
invalid objective → controlled 4xx
invalid objective → no 500
invalid objective → no DB mutation

F1 CLOSED
SCHEDULED and other lifecycle statuses localized
localization survives transition + refresh

F2 CLOSED
Audience criteria readable
raw JSON not primary presentation
criteria contract remains bounded
no PII disclosure

frontend tests PASS
backend tests PASS
TypeScript/build PASS
browser requalification PASS
critical RBAC regression PASS
React key defect remains closed
console clean
network clean
cleanup complete
no new P0/P1/P2
Git closure complete
report in Russian
```

---

## 26. SUCCESS VERDICT

Только если все findings закрыты и regression gates PASS:

```text
VERDICT A — PHASE 3 — STEP 3.9 MARKETING CENTER UI — STRICT REVIEW RE-QUALIFICATION APPROVED

F1 CLOSED
F2 CLOSED
F3 CLOSED

STEP 3.9 CLOSED
```

---

## 27. FAILURE VERDICT

Если F3 остаётся открытым или найден новый P0/P1/P2:

```text
VERDICT B — PHASE 3 — STEP 3.9 MARKETING CENTER UI — STRICT REVIEW RE-QUALIFICATION FAILED

STEP 3.9 REMAINS OPEN
```

Указать точный finding и evidence.

Не объявлять Step 3.9 closed при unresolved P2.

---

# PART XII — STOP CONDITION

## 28. STOP

После Re-Qualification:

```text
STOP
```

Не начинать автоматически:

```text
canonical roadmap sync
next implementation step
Marketing Purpose architecture implementation
Marketplace Demand implementation
Platform-funded promotions
Partner-funded/co-funded promotions
Partner/Storefront Marketing
```

Если Re-Qualification получает `VERDICT A`, следующей **отдельной docs-only задачей** будет:

```text
POST-STEP 3.9 CANONICAL ROADMAP SYNCHRONIZATION
+
MARKETING PURPOSE / MARKETPLACE DEMAND / PROMOTIONS & FUNDING ARCHITECTURE AMENDMENT
```

В этом будущем amendment необходимо архитектурно разделить как минимум:

```text
CUSTOMER_ACQUISITION
PARTNER_ACQUISITION
MARKETPLACE_DEMAND
```

и promotion funding:

```text
PARTNER_FUNDED
PLATFORM_FUNDED
CO_FUNDED
```

с отдельной финансовой authority для:

```text
contractual commission
commission waived
platform subsidy
partner-funded discount
customer paid
partner entitlement
marketing budget
approval
```

Но **не реализовывать это в текущей remediation-задаче**.
