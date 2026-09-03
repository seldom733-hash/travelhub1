# PHASE 3 — PRE-STEP 3.12 — ANALYTICS NAVIGATION / IA REMEDIATION

## TASK TYPE
**TARGETED NAVIGATION / INFORMATION ARCHITECTURE REMEDIATION + RUNTIME VERIFICATION**

Baseline: `301a19a` — Step 3.12 Scope Reconciliation approved. This task is a narrow remediation before Step 3.12 Implementation. **DO NOT AUTO-START STEP 3.12.**

## LANGUAGE REQUIREMENT — MANDATORY
Все reports/prose documentation должны быть преимущественно **на русском языке**: Remediation Report, Runtime/Browser Evidence, findings, root cause, architecture/security decisions, conclusions, recommendations, verdict explanations. English допускается только для technical identifiers, paths, code, commands, enums, permission/route identifiers и standardized VERDICT strings. Преимущественно English report = task incomplete.

## 1. PRE-FLIGHT
Run:
```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -30 --oneline
```
Expected baseline: `301a19a`. Actual repository state is authority. Do not overwrite unrelated changes.

## 2. TARGET IA
Target Platform Workspace:
```text
Рабочий стол
Аналитика
Продажи
Бронирования
CRM
├ Клиенты
└ Партнёры
Маркетинг
Поддержка
Финансы
...
```
Hard invariant:
```text
Analytics = top-level Workspace capability
Analytics ≠ CRM subsection
```

## 3. AUDIT BEFORE CHANGE
Inspect actual repository for:
```text
existing Analytics Center
analytics routes
CRM analytics routes/tabs
Workspace Shell/sidebar manifests
permission gates
analytics APIs/services/components
redirects/aliases
breadcrumbs/PageHeader
active navigation logic
i18n
tests
Partner sidebar if shell is shared
```
Do not assume route names. Repository truth wins.

## 4. DO NOT CREATE SECOND ANALYTICS
Preserve **one Analytics Engine / Center**. Reuse existing Analytics implementation. Do not duplicate API aggregation, KPI definitions, filters, charts, services or query infrastructure merely to move navigation.

If general Analytics is currently physically nested under CRM, perform the minimum safe route/IA remediation needed to make it independent.

## 5. ROUTE AUDIT
Classify every relevant route as canonical, legacy, contextual CRM analytics, or duplicate. Prefer an existing correct canonical `/app/analytics` if present.

If a legacy CRM Analytics URL may be used/bookmarked, prefer a safe redirect to canonical Analytics where appropriate. Do not maintain two independently functioning general Analytics Centers.

## 6. PLATFORM SIDEBAR
Expose Analytics as a **top-level Platform sidebar item** using the existing canonical Workspace Shell/sidebar system. Do not create a second sidebar framework.

Expected placement conceptually:
```text
Рабочий стол
Аналитика
Продажи
Бронирования
CRM
...
```
Analytics visibility must use the existing permission-aware manifest/projection.

## 7. REMOVE GENERAL ANALYTICS FROM CRM OWNERSHIP
Remove the CRM menu/tab/submenu ownership of the **general Analytics Center**.

Do NOT remove legitimate contextual metrics inside Customer 360 / Partner 360 or other entity-specific CRM views. General Analytics and contextual CRM metrics are different responsibilities.

## 8. PERMISSION AUTHORITY
Audit actual permission identifier(s), e.g. `analytics.read`, but use repository truth.

Required:
```text
sidebar visibility → permission-aware
direct Analytics route → permission-aware
Analytics APIs → server-authoritative
```
Do not grant Analytics to additional roles merely to make the menu visible. Preserve canonical role defaults. Do not redesign Users & Access here; Step 3.12 owns that.

## 9. PAGE IDENTITY / ACTIVE STATE
General Analytics must identify itself as an independent top-level workspace:
```text
PageHeader/title/breadcrumbs → Аналитика
active sidebar → Аналитика only
CRM must not be active parent
```
No dual-active state. No `CRM → Analytics` identity for the general Analytics Center.

## 10. DIRECT URL / SECURITY
Runtime test with authorized and unauthorized Platform actors where available.

Authorized:
```text
menu visible
direct URL opens
Analytics top-level item active
```
Unauthorized:
```text
menu absent
direct route denied/redirected by canonical access pattern
API denied server-side
```
Hidden menu is not security evidence.

## 11. LEGACY CRM ANALYTICS ENTRY
Explicitly choose and document one outcome:
```text
A. remove if never canonical/public
B. redirect to canonical Analytics
C. retain only if it is genuinely contextual CRM analytics
```
Forbidden outcome: two general Analytics Centers.

## 12. PARTNER ANALYTICS — REGRESSION AUDIT ONLY
Partner Analytics remains entitlement-aware conceptually:
```text
Marketplace Basic → limited
Storefront Pro → expanded
```
Do not implement/redesign Partner Analytics in this task. If shared shell code changes, verify no Platform Analytics leakage, entitlement bypass, duplicate item or Partner regression. Record incomplete Partner Analytics as deferred, not scope expansion.

## 13. NO NEW ANALYTICS FEATURES
Out of scope:
```text
new KPI/charts/reports/filters
new Analytics domains
Marketing/Support Analytics expansion
Storefront Analytics expansion
new backend calculations
```
Only navigation/IA and regressions caused by it.

## 14. I18N / SHELL
Preserve supported locale mechanism (including AZ/RU/EN if current repo supports them). No raw translation keys and no hardcoded Russian label if shell uses i18n.

Verify desktop sidebar, collapsed/responsive behavior if supported, labels/icons, no overflow and no duplicate Analytics entries. Do not redesign sidebar visuals.

## 15. TESTS
Inspect/add relevant tests where appropriate for:
```text
Platform top-level Analytics presence
CRM no longer owning general Analytics navigation
permission-based visibility
active state
direct route access
legacy redirect if introduced
i18n
Partner regression if shared shell changed
```
Do not weaken assertions to manufacture PASS. Report exact counts.

Run at minimum relevant Frontend tests, Frontend TSC and Frontend Build. If backend permission/API code changes, run relevant backend tests/TSC too; otherwise explicitly state backend was untouched.

## 16. RUNTIME / BROWSER VERIFICATION — MANDATORY
Source/tests alone cannot close this task. Verify in the actual running app:
```text
1. authorized Platform actor sees Analytics top-level
2. Analytics is not nested under CRM
3. CRM remains independently accessible
4. direct Analytics route opens
5. correct active sidebar item
6. correct title/breadcrumbs
7. refresh persistence
8. unauthorized menu behavior
9. unauthorized direct-route behavior
10. server API denial for unauthorized actor
11. no raw i18n keys
12. no duplicate Analytics entry
13. no unexpected Partner regression
```

Normal positive flow:
```text
Console: 0 unexpected errors/warnings
Network: no unexpected 4xx/5xx
No redirect loops
No repeated failed requests
```
Expected deliberate authorization-denial responses may be documented separately.

## 17. EVIDENCE MATRIX
Create:

| Check | Expected | Actual | Evidence | Result |
|---|---|---|---|---|
| Platform top-level Analytics | visible when authorized | | | |
| CRM general Analytics nav | absent | | | |
| Analytics active state | Analytics only | | | |
| Direct route authorized | opens | | | |
| Direct route unauthorized | denied safely | | | |
| API unauthorized | server denial | | | |
| Legacy route | classified | | | |
| i18n | no raw keys | | | |
| Partner regression | none | | | |
| Console | no unexpected errors | | | |
| Network | no anomalies | | | |

## 18. ROADMAP
This is a pre-Step 3.12 remediation. If roadmap needs a record, update **additively**, preserve history, no silent renumbering, real SHA only.

After successful remediation canonical NEXT must remain:
```text
PHASE 3 — STEP 3.12 — USERS & ACCESS COMPLETION
```
Do not mark Step 3.12 implemented/closed.

## 19. REPORT
Create predominantly Russian report, e.g.:
```text
docs/reports/PHASE_3_PRE_STEP_3.12_ANALYTICS_NAVIGATION_IA_REMEDIATION.md
```
Include Starting SHA, Remediation SHA, Final HEAD/origin, route/navigation audit, root cause, changed files, permission behavior, legacy-route decision, Platform/CRM/Partner evidence, i18n, tests, TSC/build, browser evidence, console/network, findings/deferred, verdict and canonical NEXT.

## 20. GIT
Before commit:
```bash
git status --short
git diff --check
git diff
```
Commit clearly, push `origin/master`, verify:
```bash
git rev-parse HEAD
git rev-parse origin/master
```
Do not claim push success without remote SHA verification.

## 21. ACCEPTANCE CRITERIA
```text
[ ] actual route/navigation architecture audited
[ ] existing Analytics Center reused
[ ] no second Analytics Center created
[ ] Platform Analytics is top-level sidebar item
[ ] general Analytics removed from CRM navigation ownership
[ ] contextual CRM metrics preserved
[ ] permission-aware visibility preserved
[ ] direct route authorization verified
[ ] server-side API authority preserved
[ ] active state correct
[ ] legacy route classified
[ ] i18n correct
[ ] no Partner regression
[ ] relevant tests PASS
[ ] Frontend TSC PASS
[ ] Frontend Build PASS
[ ] runtime/browser PASS
[ ] no unexpected console/network anomalies
[ ] report predominantly Russian
[ ] canonical NEXT remains Step 3.12
[ ] Step 3.12 implementation NOT auto-started
```

## 22. VERDICT
Allowed:
```text
VERDICT A — ANALYTICS NAVIGATION / IA REMEDIATION APPROVED — READY TO PROCEED TO STEP 3.12 IMPLEMENTATION
```
or:
```text
VERDICT B — ANALYTICS NAVIGATION / IA REMEDIATION BLOCKED
```
Do not issue VERDICT A from source/tests alone without runtime/browser evidence.

## 23. STOP CONDITION
After remediation + tests + runtime/browser verification + report + commit/push + verdict: **STOP**.

Do not start Step 3.12 implementation, implement `UserPermission`, alter the frozen Step 3.12 scope, implement Support R4, start Step 3.13, expand Partner Analytics, or add new Analytics features.
