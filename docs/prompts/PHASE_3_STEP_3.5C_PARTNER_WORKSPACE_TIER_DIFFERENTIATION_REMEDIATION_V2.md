# PHASE 3 — STEP 3.5C — PARTNER WORKSPACE TIER DIFFERENTIATION REMEDIATION V2
## MARKETPLACE BASIC vs STOREFRONT PRO
## NAVIGATION / CRM ENTRY POINTS / CAPABILITY UX / RUNTIME EVIDENCE

# 1. CONTEXT

Step 3.5C reported three CRM contexts:

```text
PLATFORM CRM
MARKETPLACE BASIC
STOREFRONT PRO
```

Reported tier detection:

```text
PartnerStorefront.status = 'ACTIVE'
AND PartnerStorefront.entitlementStatus = 'ACTIVE'
→ STOREFRONT PRO
else
→ MARKETPLACE BASIC
```

Reported difference:

| Capability | MARKETPLACE BASIC | STOREFRONT PRO |
|---|---|---|
| Customer list | Own marketplace-order customers | PartnerCustomerRelation |
| Customer detail | Identity + own orders | Full Customer 360 + relation fields |
| Direct intake | DENY | ALLOW |
| Lifecycle / Tags / Notes | DENY | ALLOW |
| AssignedTo | DENY | ALLOW |

Browser evidence, however, shows both partner tiers currently use the same Partner Cabinet navigation:

```text
Обзор
Мои услуги
Новая услуга
Идентичность
Витрина
```

Routes observed:

```text
/partner
/partner/products
/partner/products/new
/partner/seller-profile
/partner/storefront
```

There is no visible customer-management / CRM entry point.

Therefore:

```text
BACKEND / SECURITY DIFFERENTIATION → REPORTED IMPLEMENTED
PARTNER WORKSPACE UX INTEGRATION   → INCOMPLETE / NOT PROVEN
```

# 2. GOAL

Complete Step 3.5C at product/runtime level:

```text
MARKETPLACE BASIC
→ visibly simple customer management

STOREFRONT PRO
→ visibly extended/full CRM
```

Difference must exist in:

```text
SERVER AUTHORITY
+ NAVIGATION / ROUTING
+ PAGE / ACTION UX
```

# 3. ROLE MODEL

Do NOT create two partner roles.

```text
ROLE = PARTNER

PARTNER
├── MARKETPLACE BASIC
└── STOREFRONT PRO
```

Tier differences come from workspace/scope/entitlements/capabilities.

# 4. AUTHORIZATION HIERARCHY

Preserve:

```text
IDENTITY
→ WORKSPACE CONTEXT
→ TENANT / PARTNER SCOPE
→ PLAN / ENTITLEMENTS
→ BUSINESS CAPABILITIES
→ ROLE / PERMISSIONS
→ PAGE / ACTION AVAILABILITY
```

Frontend navigation is a consumer, not authority.

# 5. DISCOVERY BEFORE CODE

Inventory exact current:

```text
partner shell/layout
partner navigation component
partner routes
CRM/customer frontend routes
CRM APIs
tier resolver
capability/entitlement resolver
Storefront state source
Customer list/detail components
Customer 360 components
```

Determine whether Step 3.5C CRM pages already exist but are unreachable from navigation.

# 6. VERIFY CRM ROUTES

Find actual routes for:

```text
Basic customer list
Basic customer detail
Pro CRM/customer list
Pro Customer 360
Pro direct intake
```

Do not assume `/app/crm`.

If routes exist → integrate them into Partner Workspace.
If missing → implement the minimum required partner-facing routes using existing CRM components/domain authority.

# 7. MARKETPLACE BASIC TARGET

Marketplace Basic must remain simple.

Its workspace must expose a clear customer entry point, preferably:

```text
Клиенты
```

Do not label Basic as a full enterprise CRM if it does not have those capabilities.

Basic customer scope:

```text
customers related to own marketplace business
own marketplace orders
own marketplace bookings where canonical
own customer-payment context where canonical
```

Required:

```text
server-side partner scope
search
pageSize = 20
filtered total
pagination >20
```

# 8. BASIC DETAIL

Basic customer detail must be intentionally limited.

Conceptually:

```text
Identity/contact required for service
Own marketplace orders
Own marketplace bookings if available
Own payment context if available
```

No unrelated global customer history.

# 9. BASIC PRO-ONLY UX

Basic must NOT show active controls for:

```text
Direct intake / Добавить клиента
Lifecycle management
Editable Lead Source
Tags management
CRM Notes management
AssignedTo
Advanced CRM automation
Marketing CRM
Omnichannel
```

Do not render a Pro CRM and rely on 403 after clicking.

Manual Pro route/API access must still be server-denied.

# 10. STOREFRONT PRO TARGET

Storefront Pro must visibly expose the extended CRM already claimed as implemented.

Provide a clear navigation entry such as:

```text
CRM
```

or a richer `Клиенты` entry according to canonical product terminology.

Expected runtime capabilities to VERIFY:

```text
Customer list
Customer 360
Direct intake
Lifecycle
Tags
Notes
AssignedTo
```

Do not mark a capability PASS merely because backend code exists.

# 11. PRO CUSTOMER 360

Use actual existing contract. Candidate sections only where supported:

```text
Overview
Orders
Bookings
Payments
Relations
```

Do not fabricate empty tabs.

# 12. PRO DIRECT INTAKE

A visible UI path must exist:

```text
Добавить клиента
```

Verify:

```text
form opens
validation works
save works
relation/customer persists after refresh
Basic cannot use same action
```

# 13. BASIC vs PRO NAVIGATION

Hard requirement:

```text
Marketplace Basic UX
≠
Storefront Pro UX
```

The difference must be meaningful, not only a BASIC/PRO badge.

# 14. CURRENT "ВИТРИНА" ITEM

Both current partner pages show:

```text
Витрина
```

Reconcile what this means for Basic.

Determine from repository authority whether Basic:

```text
A. sees Storefront upgrade/onboarding entry;
B. may configure Storefront before activation;
C. should not see the item;
D. has another canonical behavior.
```

Do NOT guess.

If it is an upgrade/onboarding entry, Basic UI must not imply that Storefront Pro is already active.

# 15. TIER AUTHORITY

Reuse current server-authoritative resolver:

```text
PartnerStorefront.status = ACTIVE
AND entitlementStatus = ACTIVE
→ PRO
else BASIC
```

Do NOT create a second frontend tier algorithm.

Expose safe resolved capabilities/tier to frontend if necessary.

Full entitlement architecture remains Step 3.5D.

# 16. CAPABILITY-DRIVEN NAVIGATION

Prefer:

```text
canViewBasicCustomers
canUseFullCrm
canDirectIntake
canManageCrmRelation
```

or actual canonical equivalents.

Avoid scattered frontend checks of plan names/status fields.

# 17. ONE SHARED PARTNER WORKSPACE

Do not fork into separate applications/routes merely for tier:

```text
/marketplace-partner/*
/storefront-pro-partner/*
```

unless existing architecture already mandates it.

Preferred:

```text
shared Partner Workspace shell
+ capability-aware navigation
+ capability-aware pages/actions
+ server authorization
```

# 18. CUSTOMER AUTHORITY

Preserve:

```text
Customer identity
≠
PartnerCustomerRelation
```

Do not create BasicCustomer and ProCustomer duplicate identity models.

# 19. CRITICAL — BASIC vs PRO CUSTOMER SOURCE

Previous report states:

```text
BASIC → customers through own marketplace orders
PRO   → PartnerCustomerRelation
```

This creates an important upgrade-risk.

Investigate what happens when a Marketplace partner with existing marketplace customers becomes Storefront Pro.

Hard invariant:

```text
BASIC → PRO upgrade
MUST NOT make legitimate existing marketplace customers disappear
merely because list authority switches to PartnerCustomerRelation.
```

If this can happen, treat it as a high-severity architecture/runtime defect.

Resolve safely or return VERDICT B.

# 20. PRO WITH MARKETPLACE ACTIVITY

A Pro partner may still have Marketplace activity.

Pro entitlement extends capability; it must not arbitrarily erase legitimate Marketplace customer/order/booking context.

Document exact union/scope behavior.

# 21. DOWNGRADE / ENTITLEMENT LOSS

When Pro becomes non-Pro:

```text
Pro-only actions disappear
backend denies Pro-only mutations
CRM data/history is NOT destroyed
Basic-allowed marketplace context remains
```

Do not delete relations/notes/tags merely due to downgrade.

# 22. CROSS-PARTNER ISOLATION

Preserve server scope based on authenticated partner identity.

```text
Partner A
MUST NOT
read/search/update/enumerate Partner B CRM data.
```

Do not trust arbitrary `partnerId` from URL/query/body.

# 23. SEARCH / ANTI-ENUMERATION

Search must scope before results.

Exact email/phone searches must not leak other-partner/global customer information beyond authorized behavior.

# 24. OVERVIEW

Current Partner Overview is service-centric:

```text
Всего
Черновики
На модерации
Нужны правки
Опубликовано
Архив
```

Do not redesign it in this remediation.

Optionally add a tier-appropriate customer/CRM entry only if consistent with current design.

# 25. NAVIGATION DENSITY

Current horizontal navigation already contains:

```text
Обзор
Мои услуги
Новая услуга
Идентичность
Витрина
```

Do not blindly append every future Pro module.

Make the smallest architecture-consistent navigation change.

If current horizontal navigation cannot scale, report that separately; do not launch a full workspace redesign without approval.

# 26. OUT OF SCOPE

Do NOT start:

```text
Platform CRM Partners / Partner 360 remediation
Step 3.5D full entitlement model
Customer Refund UI
Customer History UI
Employees
Marketing
Omnichannel
Advanced Finance
Supplier Settlement / Balance / Payout
F.1–F.13
S.1–S.19
```


# 26A. PARTNER WORKSPACE TITLE — FALSE CLICK AFFORDANCE REMEDIATION

Current browser observation:

```text
Кабинет партнёра
🏠 Обзор
🧳 Мои услуги
➕ Новая услуга
🛡 Идентичность
🏪 Витрина
```

`Кабинет партнёра` visually appears to behave like an interactive/navigation element, but clicking it produces no navigation/action.

This is a UX defect.

Canonical behavior for this remediation:

```text
Кабинет партнёра
→ workspace title / label
→ NOT a navigation item
→ NOT a home-link duplicate
```

Home navigation authority remains:

```text
🏠 Обзор
→ /partner
```

Do NOT create two equivalent home links:

```text
Кабинет партнёра → /partner
Обзор             → /partner
```

unless the existing global design system explicitly requires a clickable workspace title/logo pattern.

Preferred behavior is a static workspace title.

## Required static-title semantics

If `Кабинет партнёра` is a static title:

```text
no <a> semantics
no button semantics
no role="link"
no role="button"
no click handler
no pointer cursor
no navigation hover treatment
no keyboard focus as an action
no misleading active-state styling
```

It may remain visually prominent as the workspace identifier.

## Accessibility

A static workspace title must not be announced as an actionable control.

If implemented as a heading/label, use appropriate semantic markup consistent with the current shell.

## Basic / Pro consistency

This shell rule applies to both:

```text
MARKETPLACE BASIC
STOREFRONT PRO
```

Tier differentiation happens in entitled navigation/actions, not by making the workspace title behave differently.

## Browser evidence

For both `step18_partner` and `pro_partner`, verify:

```text
Кабинет партнёра:
- visually identifiable as workspace title
- not clickable
- no pointer cursor
- no action hover affordance
- not keyboard-focusable as navigation
- does not change URL

Обзор:
- visibly actionable
- click → /partner
- keyboard navigation works according to existing design system
```

## Regression

Do not alter the global TravelHub brand/logo behavior if it has its own canonical home navigation.

This remediation concerns only the `Кабинет партнёра` workspace-title affordance.

# 27. I18N

All changed UI:

```text
RU
AZ
EN
```

Raw keys = 0.

# 28. PAGINATION

All operational customer tables preserve:

```text
default pageSize = 20
server-side pagination
filtered total
multi-page navigation >20
```

# 29. REQUIRED RUNTIME ACCOUNTS

Use actual runtime accounts already identified:

```text
step18_partner
→ expected MARKETPLACE BASIC

pro_partner
→ expected STOREFRONT PRO
```

No passwords/secrets in report.

# 30. BASIC BROWSER EVIDENCE

For `step18_partner` report:

```text
partnerId
resolved tier
resolved capabilities
navigation
customer entry route
customer total
customer detail
visible actions
Pro-only actions absent
manual Pro route behavior
```

# 31. PRO BROWSER EVIDENCE

For `pro_partner` report:

```text
partnerId
storefront status
entitlementStatus
resolved tier
resolved capabilities
navigation
CRM route
customer total
Customer 360
direct intake
lifecycle
tags
notes
assignedTo
```

Exercise features in browser before PASS.

# 32. SIDE-BY-SIDE MATRIX

Required:

| Surface | Marketplace Basic | Storefront Pro | Expected difference | PASS |
|---|---|---|---|---|
| Navigation | | | | |
| Customer entry | | | | |
| Customer list | | | | |
| Customer detail | | | | |
| Direct intake | | | | |
| Lifecycle | | | | |
| Tags | | | | |
| Notes | | | | |
| AssignedTo | | | | |

# 33. SECURITY TESTS

Required:

```text
Basic own customer context → PASS
Pro own CRM → PASS

Basic direct intake → DENY
Basic lifecycle mutation → DENY
Basic tags mutation → DENY
Basic notes mutation → DENY
Basic assignedTo mutation → DENY
Basic manual Pro route/API → safe DENY/redirect as appropriate

Partner A → Partner B CRM data → DENY
arbitrary partnerId override → DENY/ignored
```

# 34. UPGRADE / DOWNGRADE TESTS

Focused tests:

```text
BASIC → PRO
capabilities expand
existing legitimate marketplace customer context preserved

PRO → BASIC
Pro actions removed/denied
stored CRM data not destroyed
Basic legitimate marketplace context preserved
```

# 35. REGRESSION

Must not regress:

```text
Platform CRM
Partner Overview
Partner products
New product
Identity
Storefront onboarding/configuration according to canonical Basic behavior
```

# 36. TEST / BUILD GATES

Run and report exact results:

```text
Backend relevant tests
Frontend relevant tests
Backend TSC
Frontend TSC
Backend build
Frontend build
```

# 37. REQUIRED REPORT FILE

Create:

```text
docs/prompts/PHASE_3_STEP_3.5C_PARTNER_WORKSPACE_TIER_DIFFERENTIATION_REMEDIATION_REPORT.md
```

# 38. REQUIRED ROOT CAUSE

Explicitly answer:

```text
Why were Basic and Pro visually identical?

- CRM routes existed but were unreachable?
- navigation was not capability-aware?
- partner CRM routes were missing?
- frontend lacked resolved tier/capabilities?
- wrong layout was used?
- another root cause?
```

Provide exact files/routes.

# 39. REQUIRED ROUTE INVENTORY

| Context | Surface | Route | Backend authority | Navigation entry | PASS |
|---|---|---|---|---|---|
| BASIC | Customers | | | | |
| BASIC | Customer detail | | | | |
| PRO | CRM/Customers | | | | |
| PRO | Customer 360 | | | | |
| PRO | Direct intake | | | | |

# 40. REQUIRED NAVIGATION BEFORE / AFTER

Report actual:

```text
BEFORE

BASIC:
Обзор | Мои услуги | Новая услуга | Идентичность | Витрина

PRO:
Обзор | Мои услуги | Новая услуга | Идентичность | Витрина
```

Then actual AFTER navigation for both tiers.

# 41. REQUIRED CUSTOMER-SOURCE EVIDENCE

Report:

```text
Basic customer authority:
Pro customer authority:
Pro + marketplace combined behavior:
Upgrade continuity:
Downgrade behavior:
```

# 42. HARD ACCEPTANCE CRITERIA

VERDICT A only if:

1. Root cause of identical Basic/Pro UX identified.
2. Actual partner CRM routes inventoried.
3. Basic has a visible simple customer-management entry.
4. Pro has a visible extended CRM entry.
5. Basic and Pro differ meaningfully in navigation/CRM UX.
6. Difference uses server-authoritative tier/capabilities.
7. Frontend does not independently become entitlement authority.
8. Role remains PARTNER; no unnecessary duplicate roles.
9. Basic list is partner/marketplace scoped.
10. Basic detail is intentionally limited.
11. Basic does not render active Pro-only controls.
12. Basic direct intake is server-denied.
13. Basic lifecycle/tags/notes/assignedTo mutations are server-denied.
14. Pro CRM list works.
15. Pro Customer 360 works according to actual contract.
16. Pro direct intake has usable UI and works.
17. Pro lifecycle/tags/notes/assignedTo UI works if claimed.
18. Cross-partner isolation remains enforced.
19. Search remains tenant-safe.
20. Manual Basic access to Pro route is safe.
21. Basic `Витрина` semantics are explicitly reconciled.
22. Pro retains legitimate marketplace context where applicable.
23. BASIC → PRO does not make legitimate marketplace customers disappear.
24. PRO → BASIC does not destroy CRM data.
25. Downgraded Basic cannot perform Pro-only mutations.
26. Navigation resolves correctly after reload.
27. Existing partner routes do not regress.
28. Customer identity model is not duplicated.
29. Pagination default 20 preserved.
30. `Кабинет партнёра` is semantically/static visually a workspace title, not a false clickable control.
31. `Кабинет партнёра` has no pointer/link/button/keyboard-action affordance when static.
32. `Обзор` remains the canonical Partner Workspace home action and navigates to `/partner`.
33. Workspace-title behavior is consistent for Basic and Pro.
34. RU/AZ/EN PASS.
35. Raw i18n keys = 0.
36. Platform CRM does not regress.
37. Supplier Settlement/Balance/Payout not implemented.
38. F.1–F.13 remain NOT STARTED.
39. S.1–S.19 remain NOT STARTED.
40. Future Employees/Marketing/Omnichannel not pulled into scope.
41. Backend tests PASS.
42. Frontend tests PASS.
43. Backend TSC PASS.
44. Frontend TSC PASS.
45. Backend build PASS.
46. Frontend build PASS.
47. Browser Basic flow PASS using `step18_partner`.
48. Browser Pro flow PASS using `pro_partner`.
49. Side-by-side evidence provided.
50. Unrelated files committed = 0.
51. Push complete.
52. HEAD == origin/master.

# 43. VERDICT

Success:

```text
VERDICT A — PHASE 3 STEP 3.5C PARTNER WORKSPACE TIER DIFFERENTIATION /
MARKETPLACE BASIC CUSTOMER MANAGEMENT + STOREFRONT PRO CRM
NAVIGATION AND RUNTIME UX FULLY RECONCILED
```

Otherwise:

```text
VERDICT B — STEP 3.5C PARTNER WORKSPACE UX INCOMPLETE /
BASIC-PRO CAPABILITY DIFFERENCE NOT FULLY EXPOSED OR PROVEN
```

# 44. FINAL RESPONSE FORMAT

```text
VERDICT:

Root cause:
Files/routes discovered:

Tier authority:
Capability authority:

BASIC account:
Resolved tier:
Navigation before:
Navigation after:
Customer route:
Customer total:
Customer detail:
Visible actions:
Pro-only denial:

PRO account:
Resolved tier:
Navigation before:
Navigation after:
CRM route:
Customer total:
Customer 360:
Direct intake:
Lifecycle:
Tags:
Notes:
AssignedTo:

Workspace title behavior:
Overview home navigation:

Basic Storefront menu semantics:

Basic customer source:
Pro customer source:
Pro + marketplace behavior:
Upgrade continuity:
Downgrade behavior:

Cross-partner isolation:
Cross-tier isolation:
Anti-enumeration:

Pagination:
i18n:

Platform CRM regression:
Partner products regression:
Storefront regression:

Backend tests:
Frontend tests:
Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Browser Basic:
Browser Pro:

Production code changed:
DB/schema changed:
Migration:
Files changed:

3.5C status:
3.5D status:
F.1–F.13:
S.1–S.19:

Commit:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining findings:
Next canonical stage:
```

# 45. STOP

After report:

```text
STOP
```

Do NOT automatically start:

```text
Platform CRM Partners / Partner 360 remediation
Step 3.5D
Refund UI
History UI
F.1–F.13
S.1–S.19
```

Review actual Basic vs Pro browser result first.
