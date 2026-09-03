# PHASE 3 — STEP 3.9 — MARKETING CENTER UI — STRICT REVIEW

## 0. REVIEW MODE

**STRICT REVIEW ONLY.**

Не выполнять новую implementation и не исправлять обнаруженные дефекты скрытно в рамках review.

Подтверждённая цепочка:

```text
Post-Step 3.8 roadmap/lifecycle amendment: 0f950c8
Step 3.9 implementation SHA:              c539e51
Step 3.9 runtime remediation SHA:         e8d54ad
Expected HEAD/origin:                     e8d54ad
```

Текущий статус:

```text
STEP 3.9 IMPLEMENTATION COMPLETE
RUNTIME DEFECT CLOSED
STEP 3.9 READY FOR SEPARATE STRICT REVIEW
```

Цель — независимо проверить весь Platform Marketing Center UI и решить, можно ли закрыть Step 3.9.

## 1. LANGUAGE REQUIREMENT — MANDATORY

Все reports, findings, root cause analysis, architecture/UI conclusions, security/RBAC findings, browser/runtime evidence, test analysis и verdict explanations — преимущественно **на русском языке**.

Английский допускается только для technical identifiers, paths, code, API endpoints, HTTP statuses, CLI/Git commands, enum/permission names, commit messages и standardized VERDICT strings.

Если report преимущественно на английском — review незавершён.

## 2. GIT PREFLIGHT

Выполнить:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -20 --oneline
```

Ожидается `HEAD == origin/master == e8d54ad`.

Проверить ancestry `0f950c8 → c539e51 → e8d54ad` и что remediation не содержит unrelated production changes. Pre-existing unrelated dirty files не stage.

## 3. CANONICAL SCOPE

Открыть фактический canonical roadmap и зафиксировать exact Step 3.9 scope, dependencies, deferrals, acceptance criteria и current recorded status.

Если implementation расходится с roadmap — finding.

Проверять actual code/runtime, а не только Implementation Report.

## 4. PLATFORM-ONLY AUTHORITY

Подтвердить:

```text
Allowed: ADMIN, DIRECTOR, MARKETER, OPERATOR
Denied:  PARTNER, FINANCE, BUYER, ANALYST, MODERATOR, SALES_MANAGER
```

Hard invariant:

```text
Partner-scoped Campaign ≠ Partner actor Marketing access
```

Не должно быть Partner/Storefront Marketing Center, Partner nav item или frontend entitlement bypass.

## 5. WORKSPACE / DESIGN SYSTEM

Подтвердить reuse существующих Platform Workspace primitives:

```text
Shell
navigation
PageHeader
breadcrumbs
KPI
StatusBadge
PanelFrame
Pagination
table/form/button patterns
loading/empty/error states
responsive conventions
```

Не принимать необоснованный второй UI framework.

## 6. SIDEBAR + DIRECT ROUTE MATRIX

Проверить code и authenticated browser.

| Actor | Nav | `/app/marketing` |
|---|---|---|
| ADMIN | visible | usable |
| DIRECTOR | visible | usable |
| MARKETER | visible | usable |
| OPERATOR | visible | usable |
| PARTNER | hidden | denied/no data |
| FINANCE | hidden | denied/no data |
| BUYER | hidden | denied |
| ANALYST | hidden | denied |
| MODERATOR | hidden | denied |
| SALES_MANAGER | hidden | denied |
| Anonymous | — | auth denied/redirect |

Browser минимум: ADMIN, MARKETER, PARTNER, FINANCE, Anonymous.

Скрытый nav не считается security. Проверить backend denial и отсутствие data leak.

## 7. CAMPAIGN TABLE

Проверить с минимум 2 Campaign records:

```text
all rows render
Code
Name
Status
Scope
Created date
actions
pagination where applicable
expand/collapse
```

Не должно быть raw UUID вместо ожидаемого human label, duplicate/missing/unstable rows.

## 8. RE-VERIFY REACT KEY REMEDIATION

Проверить actual code: stable `key` должен быть на top-level child, возвращаемом `.map()`.

Browser sequence:

```text
clear console
load /app/marketing
render >=2 Campaigns
expand Campaign A
collapse Campaign A
expand Campaign B
perform lifecycle interaction
```

Hard gate:

```text
"Each child in a list should have a unique key prop" = 0
new React warnings/errors = 0
hydration errors = 0
uncaught exceptions = 0
```

## 9. CAMPAIGN CREATE

Проверить real API flow:

```text
create UI opens
fields localized
valid create succeeds
validation reject safe
new record appears
no duplicate optimistic row
```

Не принимать UI-only invented fields, которых нет в canonical API contract.

## 10. LIFECYCLE

Проверить backend-authoritative state machine:

```text
DRAFT → SCHEDULED → ACTIVE → PAUSED / COMPLETED / CANCELLED
```

Проверить allowed transitions фактически.

UI должен локализовать status, показывать contextually valid actions, обрабатывать backend `422`, refresh после success и не resurrect terminal state.

Runtime минимум: 1 valid transition + 1 invalid/rejected transition.

## 11. AUDIENCE TAB — FUNCTIONAL GATE

Наличие tab не считается implementation.

Проверить:

```text
real API data
loading
empty
success
controlled error
create/manage flow if canonical Step 3.9 requires it
```

Placeholder без roadmap-approved deferral = finding.

## 12. AUDIENCE CRITERIA SAFETY

Подтверждённый whitelist:

```text
lifecycle
leadSource
tags
status
customerType
```

UI не должен предоставлять arbitrary query/JSON bypass.

Не должны предлагаться:

```text
email phone url address socialHandle
partnerId tenantId ownerId createdById
password auth token secret
rawSql query $where $expr
```

Invalid criteria → controlled `422`, без raw Prisma/server error.

Audience не должен превращаться в contact/email/phone export или обход Marketplace Communication policy.

## 13. ATTRIBUTION TAB — FUNCTIONAL GATE

Проверить real data и canonical types:

```text
CUSTOMER
LEAD
ORDER
BOOKING
```

`LEAD` остаётся canonical Sales entity.

Проверить loading/empty/error states и create/manage action, если он требуется Step 3.9.

Error behavior:

```text
nonexistent → 404/controlled
wrong type → 404/422
duplicate → 409
foreign tenant → reject
```

UI не должен crash, показывать raw Prisma error или silently claim success.

Attribution остаётся additive и не мутирует `Order.acquisitionSource`, Booking/CRM source.

## 14. KPI TRUTH

Проверить KPI `Всего кампаний`.

Он должен использовать canonical total semantics, а не count текущей page, если UI заявляет общий total.

Не должно быть fake conversion/ROAS/revenue/channel metrics.

## 15. DEFERRED CAPABILITIES

Проверить отсутствие fake functional UI для:

```text
EMAIL/SMS/PUSH/WhatsApp transports
consent/preferences
automation/journeys
multi-touch attribution
Partner Marketing entitlement
full Marketing Analytics
```

## 16. I18N RU/AZ/EN

Проверить для каждого locale:

```text
nav
page title
tabs
statuses
columns
forms
actions
empty/error states
```

Hard gate: no raw i18n keys / fallback-to-key / missing Step 3.9 translation.

## 17. LOADING / EMPTY / ERROR STATES

Проверить major views:

```text
loading
success
empty
403
404 where applicable
409
422
generic controlled error
```

Blank page при API failure = finding.

## 18. NETWORK / CONSOLE

Positive flows: никаких неожиданных `4xx/5xx`, request loops, duplicate create requests или failed hidden background requests.

Expected negative-test responses допустимы и должны быть объяснены.

Console: 0 unexpected warnings/errors.

## 19. RESPONSIVE / ACCESSIBILITY

Проверить desktop + narrow desktop/tablet; mobile — если Platform Workspace officially supports it.

Проверить sidebar/header/tabs/KPI/table/create panel/expanded detail/actions/pagination.

Accessibility минимум:

```text
accessible button names
form labels
keyboard major actions
focus behavior
status not color-only
Campaign Code keyboard usable
```

## 20. AUTOMATED TEST REVIEW

Не доверять только reported counts:

```text
Frontend: 243/243
Backend: 89/89
Build: PASS
```

Проверить meaningful assertions минимум на:

```text
allowed nav
PARTNER hidden nav
route protection
multiple Campaign rows
create
lifecycle
Audience bounded criteria
Attribution
403
409/422 where applicable
i18n
React key regression
```

Запустить relevant Marketing/navigation/RBAC frontend tests, frontend suite, Marketing backend, Communication regression, TypeScript и Build. Указать точные counts.

## 21. SECURITY / DATA LEAKAGE

Для PARTNER и FINANCE проверить:

```text
nav absent
direct route unusable
Marketing API denied
no Campaign data in unauthorized HTML/RSC/client payload
no pre-redirect data leak
```

Frontend hiding alone не PASS.

## 22. FINDING SEVERITY

```text
P0 — catastrophic/security-critical/systemic corruption
P1 — major security/authority/data-integrity defect
P2 — material runtime/correctness/contract/UI-functional defect
P3 — minor non-blocking/documentation/hardening issue
```

`VERDICT A` запрещён при unresolved P0/P1/P2.

## 23. REQUIRED BROWSER MATRIX

| Actor / Flow | Required |
|---|---|
| ADMIN `/app/marketing` | PASS |
| MARKETER `/app/marketing` | PASS |
| PARTNER nav | hidden |
| PARTNER direct route | denied/no data |
| FINANCE nav | hidden |
| FINANCE direct route | denied/no data |
| Anonymous direct route | denied/redirect |
| >=2 Campaign rows | render |
| Campaign expand/collapse | PASS |
| Campaign create | PASS |
| valid lifecycle | PASS |
| invalid lifecycle | controlled |
| Audience tab | functional |
| Audience invalid criteria | controlled |
| Attribution tab | functional |
| attribution negative cases where UI-supported | controlled |
| console | 0 unexpected |
| network | 0 unexpected |

Screenshots/evidence paths перечислить в report.

## 24. STRICT REVIEW REPORT

Создать:

```text
docs/prompts/PHASE_3_STEP_3.9_MARKETING_CENTER_UI_STRICT_REVIEW_REPORT.md
```

Структура:

```text
1. Baseline
2. Canonical scope
3. Commit chain
4. Architecture/UI integration
5. Navigation/RBAC
6. Direct-route authority
7. Campaigns
8. Runtime remediation re-verification
9. Lifecycle
10. Audiences
11. Attributions
12. KPI truth
13. Deferred capability boundary
14. i18n
15. Loading/empty/error states
16. Responsive/accessibility
17. Automated tests
18. Browser/runtime evidence
19. Network/console evidence
20. Security/data leakage
21. Findings
22. Git evidence
23. Verdict
```

## 25. GIT POLICY

Strict Review не должен содержать production fixes.

Если defect найден — документировать, не чинить скрытно; blocking finding → `VERDICT B`.

Если PASS — допустим docs/evidence-only commit.

```bash
git status --short
git diff --name-only
git diff

git add docs/prompts/PHASE_3_STEP_3.9_MARKETING_CENTER_UI_STRICT_REVIEW_REPORT.md
git commit -m "docs(marketing): strict review Step 3.9 UI"
git push origin master
git rev-parse HEAD
git rev-parse origin/master
```

Финально:

```text
Step 3.9 implementation SHA: c539e51
Runtime remediation SHA:     e8d54ad
Strict Review SHA:           <real SHA>
Final HEAD:                  <real SHA>
origin/master:               <real SHA>
HEAD == origin/master:       YES/NO
```

Не создавать бесконечную commit chain ради записи SHA самого commit внутрь него; final SHA допустимо дать в execution response.

## 26. SUCCESS VERDICT

PASS только если:

```text
canonical Step 3.9 scope satisfied
Platform design system reused
Marketing remains Platform-only
allowed roles work
PARTNER/FINANCE denied
direct-route security proven
Campaigns functional
React key defect remains closed
lifecycle functional
Audience genuinely functional and bounded/PII-safe
Attribution genuinely functional and additive
KPI truthful
no fake deferred capabilities
RU/AZ/EN valid
states valid
responsive/accessibility acceptable
tests pass
browser matrix passes
console/network clean
no unresolved P0/P1/P2
Git closure complete
report in Russian
```

Тогда:

```text
VERDICT A — PHASE 3 — STEP 3.9 MARKETING CENTER UI — STRICT REVIEW APPROVED

STEP 3.9 CLOSED
```

## 27. FAILURE VERDICT

При unresolved P0/P1/P2:

```text
VERDICT B — PHASE 3 — STEP 3.9 MARKETING CENTER UI — STRICT REVIEW FAILED

STEP 3.9 REMAINS OPEN
NEXT ACTION: TARGETED REMEDIATION REQUIRED
```

Для каждого finding:

```text
severity
reproduction
expected
actual
root cause
affected files
minimal remediation scope
```

Не исправлять автоматически.

## 28. STOP CONDITION

После Strict Review:

```text
STOP
```

Не начинать remediation, roadmap sync, следующий implementation, Marketing Purpose amendment, Platform-funded promotions или Partner/Storefront Marketing автоматически.

После отдельного подтверждения `STEP 3.9 CLOSED` следующая docs-only задача:

```text
POST-STEP 3.9 CANONICAL ROADMAP SYNCHRONIZATION
+
MARKETING PURPOSE / MARKETPLACE DEMAND / PROMOTIONS & FUNDING ARCHITECTURE AMENDMENT
```
