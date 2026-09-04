# PHASE 3 — COMMERCE CENTER UI CONSISTENCY — UI-C1 SHARED SHELL / HEADER / STATUS FOUNDATIONS — IMPLEMENTATION

## ROLE — MANDATORY

Ты работаешь как **Staff/Principal Frontend Engineer + Enterprise SaaS UX Architect + Staff Full-Stack Reviewer + Security/RBAC Reviewer + QA/Release Engineer**.

Это первый production implementation stage принятого Commerce Center UI Consistency contract.

Работай узко. Не перепрыгивай в UI-C2+.

---

# 1. CANONICAL BASELINE — DO NOT REOPEN

Зафиксировать перед началом:

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

COMMERCE UI DESIGN CONTRACT — ACCEPTED
HELP / BUSINESS DICTIONARY CONTRACT — ACCEPTED
DEBT REGISTER — QUALIFIED AND ACCEPTED

BASELINE FINAL SHA:
0cec25a248e13f932c669f129bee3fe8c2140d50

UI-C1 — STARTING
UI-C2+ — NOT STARTED
D8 — NOT STARTED
```

Принятые authority contracts:

```text
Order actions       → backend D5 authority
Booking actions     → backend D6 authority
Financial values    → backend D7 authority
RBAC                → backend
workspace isolation → backend
audit               → immutable/server-generated
```

Не переоткрывать их без доказанной regression.

---

# 2. UI-C1 OBJECTIVE

Реализовать только foundations:

```text
Shared Commerce Entity Detail Shell
Unified Header
Unified Breadcrumb / Back Navigation
Unified Lifecycle / Payment / Refund Status Visual Language
Shared Section/Card primitives required by shell
Responsive shell foundation
Shared loading/error/not-found presentation primitives where directly required
```

Цель:

```text
Request
Order
Booking

→ один structural/visual foundation
→ без потери entity-specific content
→ без изменения business semantics
```

Canonical principle:

```text
UNIFIED STRUCTURE
≠
IDENTICAL BUSINESS CONTENT
```

---

# 3. STARTING GIT EVIDENCE

До изменений:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Required baseline:

```text
HEAD == origin/master
expected baseline lineage includes:
0cec25a248e13f932c669f129bee3fe8c2140d50
```

Если есть unrelated local changes — STOP и report, не перетирать их.

---

# 4. RE-INSPECT ACTUAL CURRENT IMPLEMENTATION

Перед кодом подтвердить фактические файлы/routes/components для:

```text
Request detail
Order detail
Booking detail
PageHeader
StatusBadge
OrderActionBar
Booking actions
existing card primitives
loading/error/not-found states
```

Report exact paths.

Не опираться только на старый design report, если repo уже изменился.

---

# 5. CANONICAL SHARED DETAIL SHELL

Реализовать reusable shell, архитектурно эквивалентный:

```text
<EntityDetailShell>
    <header slot />

    <relation slot reserved for UI-C2 />

    <main>
        <main-content slot />
        <right-rail slot reserved for future timeline />
    </main>

    <notes slot reserved />
    <audit slot reserved />
</EntityDetailShell>
```

Важно:

- UI-C1 не обязан внедрять Commerce Relation Chain.
- UI-C1 не обязан внедрять unified Timeline/Audit.
- Не создавать fake placeholders в production UI.
- Slots/API могут существовать, но пустые будущие секции не должны визуально отображаться.

---

# 6. TARGET SHELL BEHAVIOR

Desktop:

```text
full-height page
header
scrollable content
main content area
right rail capability
consistent page padding
consistent section gaps
```

Tablet/mobile:

```text
stacked content
no horizontal overflow
actions can wrap
badges can wrap
breadcrumbs remain usable
```

Не делать visual redesign за пределами принятого contract.

---

# 7. UNIFIED HEADER

Создать/реализовать shared header contract.

Предпочтительно:

```text
<EntityDetailHeader />
```

или repo-compatible equivalent.

Canonical inputs:

```text
breadcrumbs
reference
number?
lifecycleStatus
paymentStatus?
refundIndicator?
actions
busyAction?
backHref
```

Если existing `PageHeader` уже покрывает часть ответственности — reuse/composition предпочтительнее дублирования.

Не создавать два параллельных header systems без необходимости.

---

# 8. BREADCRUMBS

Для Request / Order / Booking:

```text
TravelHub / <Registry> / <Reference>
```

Canonical navigation:

```text
backHref → registry route
```

Rules:

```text
use Link
do NOT use router.back() as canonical navigation
hard refresh must remain valid
deep-link must remain valid
```

Request должен перестать быть outlier с raw `<h1>` + custom back button.

---

# 9. STATUS VISUAL LANGUAGE

Сохранить три независимых домена:

```text
Lifecycle
Payment
Refund
```

Never:

```text
Lifecycle == Payment
Payment == Refund
```

Canonical display order:

```text
Lifecycle → Payment → Refund
```

Где domain неприменим — badge отсутствует.

---

# 10. STATUSBADGE REUSE

Использовать один shared status visual primitive, если существующий `<StatusBadge>` подходит.

Request custom:

```text
statusColor()
hardcoded Tailwind mapping
```

должен быть устранён в пользу canonical component/mapping.

Не менять business status values.

Не придумывать новые statuses.

Не переименовывать backend enum ради UI.

---

# 11. REFUND INDICATOR

UI-C1 определяет только visual foundation.

Не создавать новую refund state machine.

Если backend/API уже даёт canonical refund information — можно визуализировать согласно принятому contract.

Если данных нет:

```text
do not infer
do not compute
do not fake
```

---

# 12. ACTIONS — CRITICAL SCOPE BOUNDARY

## Order

Сохранить существующий D5:

```text
<OrderActionBar />
server-authoritative available actions
```

UI-C1 может переместить его в unified header placement, но не менять authority.

## Booking

Сохранить D6 server-authoritative actions.

Можно унифицировать placement/presentation только если action semantics и authority не меняются.

## Request

Known debt:

```text
SEC-UI-01
Request actions currently frontend-gated
```

UI-C1 НЕ закрывает SEC-UI-01.

Therefore:

```text
do NOT pretend Request actions are server-authoritative
do NOT wrap frontend-derived Request actions into a component that implies authority
do NOT broaden Request action behavior
```

Request server-authority remediation происходит в UI-C6 согласно accepted phasing.

В UI-C1 разрешено только безопасно сохранить существующее поведение/placement, явно отмечая remaining debt.

---

# 13. ENTITY-SPECIFIC CONTENT MUST SURVIVE

Не удалять и не смешивать entity-specific content.

Request keeps its applicable data.

Order keeps:

```text
D7 finance
client/partner
items
travelers
notes
financial history
lifecycle/audit content
related entity data until UI-C2 replaces presentation
```

Booking keeps:

```text
linked Order financialSummary
service/order data
notes
existing timeline
existing audit/history
details
```

UI-C1 = shell/header/status migration, не content rewrite.

---

# 14. FINANCIAL AUTHORITY — HARD PRESERVATION

D7 remains:

```text
dueAmount
= max(0, totalAmount - paidAmount)

refundableAmount
= max(0, paidAmount - refundedAmount)
```

Backend calculation only.

Frontend:

```text
transport
format
display
```

No:

```text
Math.max financial derivation
Number-based financial recomputation
toFixed-based business calculation
new client-side totals
```

UI-C1 не должен менять financial semantics.

---

# 15. CARD / SECTION FOUNDATION

Разрешено создать/reuse minimal shared primitives:

```text
<EntitySectionCard />
<EntityEmptyState />
```

если они непосредственно нужны shell migration.

Canonical style baseline from accepted design:

```text
section card:
rounded-lg border border-slate-200 bg-white p-4

summary card:
rounded-lg bg-slate-50 px-4 py-3

section heading:
text-xs font-semibold uppercase text-slate-500

label:
text-slate-400

value:
font-medium text-slate-700

grid gap:
gap-3

section gap:
space-y-4
```

Но полный visual polish остаётся UI-C15.

Не проводить массовый CSS rewrite.

---

# 16. LOADING / ERROR / NOT FOUND

UI-C1 может унифицировать presentation primitives, если это требуется для shell.

Security distinction must remain:

```text
wrong tenant
wrong workspace
wrong business context
cross-context direct ID

→ 404-like not found
→ no existence leakage
```

403 допустим только там, где существование ресурса разрешено раскрывать.

Frontend не должен превращать backend 404 isolation в “Access denied”.

---

# 17. RESPONSIVE FOUNDATION

Minimum browser widths to qualify:

```text
desktop ≥ 1280
tablet 768–1279
mobile < 768
```

Verify:

```text
no horizontal overflow
header usable
breadcrumbs usable
badges wrap safely
actions wrap safely
content remains readable
```

Full polish later.

---

# 18. ACCESSIBILITY BASELINE

For touched UI:

```text
semantic headings
buttons remain buttons
links remain links
keyboard-accessible actions
visible focus behavior
status not conveyed by color alone where practical
aria-label for icon-only controls
```

Do not perform unrelated accessibility rewrite.

---

# 19. I18N

Do not introduce raw untranslated keys.

Touched/new visible text must use existing localization architecture.

At minimum qualify:

```text
RU
AZ
EN
```

Do not use localized labels as stable business/status identifiers.

Full Help localization remains later UI-C14, but UI-C1 touched strings must not regress.

---

# 20. NO UI-C2+ IMPLEMENTATION

Explicitly forbidden in this stage:

```text
Commerce Relation Chain implementation
new Business Timeline extraction
Audit History unification
Request server-authority remediation
Request full content migration beyond shell/header/status
Orders KPI changes
Bookings KPI changes
Typed Metric/Help Registry
formula drift gate
/app/help
left-menu Help
D8
```

If a small interface/slot is needed for future compatibility, it must not become production feature implementation.

---

# 21. SECURITY REGRESSION CHECKS

At minimum prove:

```text
Order direct-ID isolation preserved
Booking direct-ID isolation preserved
Request existing isolation not weakened
Order action availability unchanged
Booking action availability unchanged
cross-context remains 404-like
no client-side privilege expansion
```

Reuse existing D5/D6 tests where possible.

---

# 22. TARGETED TESTS

Add/update focused frontend tests for shared components.

Minimum concepts:

```text
EntityDetailShell renders required slots
EntityDetailHeader renders breadcrumbs/reference
Lifecycle badge renders
Payment badge optional
Refund indicator optional
Back link points to canonical registry
actions render in canonical location
mobile/wrapping class contract where testable
Request uses shared status primitive
Order keeps D5 action component/authority
Booking keeps D6 action authority
```

Avoid brittle pixel/snapshot-only qualification.

---

# 23. BUILD / REGRESSION GATES

Run applicable repo commands.

At minimum:

```text
frontend typecheck
frontend build
targeted UI-C1 tests
existing relevant frontend tests
D5 relevant regression
D6 relevant regression
D7 relevant regression if touched shared finance presentation
```

If repo scripts differ, use actual scripts and report exact commands.

Do not hide unrelated pre-existing failure:
- identify it;
- prove it is pre-existing;
- do not call a new regression PASS without evidence.

---

# 24. BROWSER QUALIFICATION — REQUIRED

Use actual browser/manual browser automation available in environment.

Qualify all three canonical detail pages:

```text
Request
Order
Booking
```

At minimum verify:

### A. Request
```text
shared shell visible
breadcrumbs visible
canonical back link
shared status presentation
existing content preserved
actions still behave as before
```

### B. Order
```text
shared shell/header
lifecycle/payment status preserved
D7 financial section preserved
D5 actions preserved
content/history/travelers preserved
```

### C. Booking
```text
shared shell/header
status preserved
linked Order finance preserved
D6 actions preserved
existing timeline/audit preserved
```

### D. Responsive
At least one representative page at:

```text
desktop
tablet
mobile
```

### E. Cross-context
Where existing fixtures support it:

```text
wrong context direct URL
→ no data leakage
```

Screenshots/evidence should be included in report or referenced by path.

---

# 25. CURRENT → TARGET EVIDENCE

Report table:

| Area | Request Before | Request After | Order Before | Order After | Booking Before | Booking After |
|---|---|---|---|---|---|---|
| Shell | | | | | | |
| Header | | | | | | |
| Breadcrumbs | | | | | | |
| Back nav | | | | | | |
| Lifecycle badge | | | | | | |
| Payment badge | N/A | N/A | | | | |
| Refund indicator | N/A | N/A | | | | |
| Actions authority | | | | | | |
| Content preserved | | | | | | |

---

# 26. FILE CHANGE INVENTORY

Report every changed production file:

| File | Why changed | UI-C1 requirement | Security/business effect |
|---|---|---|---|

Any file outside UI-C1 must be justified.

No opportunistic refactor.

---

# 27. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_COMMERCE_CENTER_UI_C1_SHARED_SHELL_HEADER_STATUS_IMPLEMENTATION_REPORT.md
```

Predominantly Russian.

Required sections:

1. Executive Summary
2. Canonical Baseline
3. Starting Git State
4. Current Implementation Re-inspection
5. File Change Inventory
6. Shared Shell Implementation
7. Unified Header Implementation
8. Breadcrumb / Back Navigation
9. Status Visual Language
10. Request Migration Scope
11. Order Preservation
12. Booking Preservation
13. Financial Authority Preservation
14. Security Preservation
15. Responsive / Accessibility
16. i18n Qualification
17. Targeted Tests
18. Regression / Build Results
19. Browser Qualification
20. Current→Target Matrix
21. Remaining Debt / Explicit Non-Scope
22. Acceptance Matrix
23. Git Hard Closure
24. Findings
25. Final Verdict
26. TRUE NEXT

---

# 28. UI-C1 ACCEPTANCE MATRIX

Do not shorten:

| Gate | Result | Exact Evidence |
|---|---|---|
| Starting baseline reconciled | | |
| HEAD/origin clean before changes | | |
| D5 baseline preserved | | |
| D6 baseline preserved | | |
| D7 baseline preserved | | |
| Commerce UI Design Contract preserved | | |
| Help/Dictionary contract preserved | | |
| Debt Register preserved | | |
| Actual Request implementation re-inspected | | |
| Actual Order implementation re-inspected | | |
| Actual Booking implementation re-inspected | | |
| Shared Entity Detail Shell implemented | | |
| Shell reused by Request | | |
| Shell reused by Order | | |
| Shell reused by Booking | | |
| Unified header implemented | | |
| Request raw header outlier removed | | |
| 3-level breadcrumbs on Request | | |
| 3-level breadcrumbs on Order | | |
| 3-level breadcrumbs on Booking | | |
| Canonical Link-based back navigation | | |
| No router.back canonical dependency | | |
| Shared StatusBadge used by Request | | |
| Shared StatusBadge preserved by Order | | |
| Shared StatusBadge preserved by Booking | | |
| Lifecycle/payment/refund domains remain separate | | |
| No invented statuses | | |
| Order D5 action authority preserved | | |
| Booking D6 action authority preserved | | |
| Request SEC-UI-01 not falsely marked closed | | |
| Request actions not broadened | | |
| Entity-specific Request content preserved | | |
| Entity-specific Order content preserved | | |
| Entity-specific Booking content preserved | | |
| D7 finance values unchanged | | |
| No frontend financial recomputation introduced | | |
| Existing Order finance browser-qualified | | |
| Existing Booking linked finance browser-qualified | | |
| Cross-context 404 semantics preserved | | |
| No existence leakage introduced | | |
| No privilege expansion introduced | | |
| Shared card/section foundation limited to scope | | |
| Desktop layout qualified | | |
| Tablet layout qualified | | |
| Mobile layout qualified | | |
| No horizontal overflow | | |
| Accessibility baseline qualified | | |
| RU touched strings qualified | | |
| AZ touched strings qualified | | |
| EN touched strings qualified | | |
| Targeted UI-C1 tests pass | | |
| Frontend typecheck passes | | |
| Frontend build passes | | |
| Relevant frontend regression passes | | |
| D5 relevant regression passes | | |
| D6 relevant regression passes | | |
| D7 relevant regression passes if applicable | | |
| Browser Request PASS | | |
| Browser Order PASS | | |
| Browser Booking PASS | | |
| Current→Target matrix complete | | |
| Changed-file inventory complete | | |
| UI-C2 not started | | |
| KPI implementation not started | | |
| Help implementation not started | | |
| D8 not started | | |
| Final porcelain empty | | |
| HEAD == origin/master | | |
| One canonical 40-char Final SHA | | |

Any unproven critical gate → VERDICT B.

---

# 29. GIT HARD CLOSURE

Before final verdict:

```bash
git status --short
git status --porcelain=v1
git diff --stat
git diff --check
```

Commit only UI-C1 scope + report.

Push.

Then:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Required:

```text
porcelain EMPTY
HEAD == origin/master
one canonical 40-char SHA
```

---

# 30. VERDICT A

Only if every critical UI-C1 gate passes:

```text
VERDICT A — PHASE 3 COMMERCE CENTER UI CONSISTENCY — UI-C1 SHARED SHELL / HEADER / STATUS FOUNDATIONS PASSED

UI-C1 — ACCEPTED

FINAL SHA:
<one canonical 40-char SHA>

TRUE NEXT:
UI-C2 — COMMERCE RELATION CHAIN

UI-C3+ — NOT STARTED
D8 — NOT STARTED
```

Then STOP.

---

# 31. VERDICT B

If any critical gate fails:

```text
VERDICT B — PHASE 3 COMMERCE CENTER UI CONSISTENCY — UI-C1 FAILED

UI-C1 — NOT ACCEPTED

TRUE NEXT:
UI-C1 REMEDIATION

UI-C2+ — NOT STARTED
D8 — NOT STARTED
```

List exact blockers and STOP.

---

# 32. HARD STOP

After UI-C1 report + Git closure:

```text
STOP
```

Do not start UI-C2 in the same run.
