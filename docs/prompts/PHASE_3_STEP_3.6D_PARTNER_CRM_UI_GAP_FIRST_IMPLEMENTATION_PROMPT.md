# PHASE 3 — STEP 3.6D — PARTNER CRM UI — GAP-FIRST IMPLEMENTATION PROMPT

## MODE

**GAP-FIRST IMPLEMENTATION.**

This is the canonical NEXT after roadmap synchronization.

Canonical roadmap baseline:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Expected repository baseline after roadmap synchronization:

```text
e1bfb98
```

Verify actual `HEAD` and `origin/master` before work. Do not reset valid later work.

This stage must **inspect existing Partner CRM/customer UI first and implement only proven gaps**.

Do not build a second CRM system from scratch.

---

# 1. Canonical workspace boundary

Preserve:

```text
PLATFORM WORKSPACE
/app/*
→ TravelHub internal operator workspace

PARTNER WORKSPACE
/partner/*
→ Partner business workspace
```

Platform CRM:

```text
identity
administration
support
security
moderation
disputes
transaction/history context
```

Partner CRM:

```text
Partner's own customer/business relationship management
```

A Partner must never receive the internal Platform `/app/crm` interface merely because it has CRM capability.

---

# 2. Entitlement boundary

Partner CRM is entitlement-aware.

Canonical tiers:

```text
Marketplace Basic
Storefront Pro
```

Keep separate:

```text
Entitlement ≠ Permission
PARTNER role ≠ Storefront Pro
```

Authority chain:

```text
Workspace Context
    ↓
Entitlement
    ↓
Capability
    ↓
Permission
    ↓
Access
```

Server-side authority remains mandatory.

Frontend hiding alone is insufficient.

---

# 3. Marketplace Basic CRM contract

Marketplace Basic is **not full CRM**.

It may receive only the customer context required to operate marketplace business.

Canonical characteristics:

```text
marketplace-generated customer relationships
PCR created/attributed by system
leadSource typically MARKETPLACE
customer context tied to legitimate Partner business relationship
no unrestricted manual customer intake
no full sales CRM
no arbitrary source editing
no Storefront-only CRM administration
```

Do not accidentally upgrade Basic to Storefront Pro through UI exposure.

---

# 4. Storefront Pro CRM contract

Storefront Pro receives the full Partner business CRM capability supported by the current backend.

Expected capability family, subject to repository verification:

```text
customer list
customer detail / Partner 360-style business view
manual customer intake
PartnerCustomerRelation lifecycle
lead source
manager/tags if already supported
notes/activity if already supported
orders/bookings context
analytics entry/view if already supported
```

Do not invent backend features just to fill a UI.

If a desired capability is not implemented server-side, report it as a gap/dependency rather than faking it in frontend state.

---

# 5. Mandatory pre-implementation inventory

Before changing production code, inspect all existing Partner customer/CRM surfaces.

At minimum search:

```text
frontend/app/partner/**
frontend/components/**
partnerApi / API clients
CRM components
customer components
PartnerCustomerRelation UI
Partner 360 UI
analytics CRM UI
sidebar/workspace manifests
entitlement/capability guards
```

Also inspect backend routes actually available to Partner.

Produce an internal inventory:

| Existing surface | Route | Basic | Pro | API | Reusable? | Gap |
|---|---|---:|---:|---|---:|---|

Do not stop after inventory unless a blocker makes implementation unsafe.

This is a gap-first implementation stage, not audit-only.

---

# 6. Reuse before creation

Prefer:

```text
existing components
existing table primitives
existing customer cards
existing StatusBadge
existing pagination
existing live-search
existing filter controls
existing activity UI
existing notes UI
existing API clients
existing i18n keys
```

Do not fork Platform CRM pages wholesale into `/partner/*`.

Shared presentation components may be reused.

Workspace-specific business logic and authority must remain explicit.

---

# 7. Partner CRM route architecture

Discover current Partner route conventions first.

Target should remain under:

```text
/partner/*
```

If no canonical Partner CRM root exists, establish one consistent with the current Partner Workspace.

Conceptually:

```text
/partner/crm
/partner/customers
```

or the repository's existing equivalent.

Do **not** create both merely because both names are possible.

Choose/reuse one canonical information architecture.

Document the decision.

---

# 8. Partner sidebar integration

Use the existing canonical Workspace Shell/sidebar system.

Do not create a second Partner sidebar implementation.

Add CRM navigation only according to capability/entitlement.

Expected behavior:

```text
Marketplace Basic
→ limited customer/customer-context entry if canonical capability allows it

Storefront Pro
→ full CRM entry
```

Do not show future/unimplemented modules.

No dead navigation.

---

# 9. No Platform CRM leakage

Partner must not navigate into:

```text
/app/crm
```

as its business CRM.

Test:

```text
Partner direct navigation to internal Platform CRM
→ denied / redirected according to existing auth architecture
```

Do not rely only on absence from sidebar.

---

# 10. Customer identity vs Partner relationship

Preserve the established model:

```text
Customer
= global identity

PartnerCustomerRelation (PCR)
= Partner-scoped business relationship
```

UI must not imply that Partner owns the global Customer identity.

Partner business fields belong to PCR.

Global identity fields must follow existing authority rules.

Do not merge these concepts in frontend DTOs merely for convenience.

---

# 11. Customer list

Implement or complete the Partner customer list using existing APIs.

Required UX should follow the project's shared table standards:

```text
live search where supported
server-side pagination
stable columns
localized status/lifecycle
human-readable business labels
loading state
empty state
error state
```

Do not add a separate "Find" button if shared UX already uses debounced live search.

---

# 12. Basic customer list

Marketplace Basic list must be scoped to customers with a legitimate relationship to the current Partner.

No cross-Partner leakage.

No global Platform customer directory.

Do not expose customers merely because they exist globally.

Required server scope:

```text
current Partner
→ its PCR/business relationship
→ allowed customer context
```

---

# 13. Pro customer list

Storefront Pro may expose richer CRM fields already supported by backend.

Examples only if present:

```text
lifecycle
leadSource
manager
tags
last activity
orders/bookings summary
```

Do not invent unsupported sorting/filtering.

---

# 14. Customer detail

Reuse existing customer detail/360 components where safe.

Partner detail must represent:

```text
global customer identity context
+
current Partner's PCR
+
current Partner's business interactions
```

It must not expose another Partner's:

```text
PCR
notes
orders
bookings
commercial history
internal metadata
```

Tenant isolation is a P0 requirement.

---

# 15. Detail tabs

Inventory what is already implemented before choosing tabs.

Potential reusable domains include:

```text
Overview
Activity
Notes
Orders
Bookings
```

Only expose tabs backed by current Partner-authorized APIs.

Do not copy every Platform Partner/Customer 360 tab.

Do not restore removed/deprecated History UI if Activity is canonical.

---

# 16. Activity

If Partner customer Activity is already supported:

```text
reuse CrmActivity read model
scope by current Partner
localize eventType in frontend
keep stored event types locale-neutral
```

Do not create another Partner-specific activity database.

Verify no cross-Partner events.

---

# 17. Notes

If Operational Notes/Partner notes are already authorized for Partner customer context, reuse them.

Preserve:

```text
append-only/audited behavior
RBAC
actor
timestamp
```

Do not expose Platform-only notes.

Do not weaken server-side scope to make the UI work.

---

# 18. Manual customer intake

Marketplace Basic:

```text
manual intake → NOT AVAILABLE
```

Storefront Pro:

```text
manual intake → AVAILABLE
```

only if the existing entitlement/backend contract supports it.

Use the existing Partner intake endpoint.

Do not create a new duplicate customer-create API.

---

# 19. Lead source

Canonical source contract:

```text
MARKETPLACE
STOREFRONT
DIRECT
PHONE
OFFICE
EMAIL
REFERRAL
OTHER
```

Preserve first-source semantics:

```text
leadSource
= first acquisition source
```

Existing source must not be overwritten by later interactions.

Basic must not receive unrestricted manual source editing.

Pro manual intake may choose allowed manual sources according to current backend contract.

---

# 20. Marketplace auto-attribution regression

Preserve Step 3.6A:

```text
OrderCreated
→ sellerPartnerId
→ PCR
→ MARKETPLACE when relationship absent
```

Partner CRM UI must display these automatically created relationships correctly.

Do not require manual PCR creation before the customer becomes visible.

---

# 21. STOREFRONT source

Storefront Pro direct acquisition must display canonical:

```text
STOREFRONT
```

where the backend relationship carries that source.

RU/AZ/EN labels must exist.

Do not replace STOREFRONT with DIRECT in the UI.

---

# 22. Lifecycle

If PCR lifecycle is editable in current backend, expose it only to entitled/authorized Partner users.

Canonical known lifecycle:

```text
LEAD
PROSPECT
ACTIVE
CHURNED
```

Verify exact current contract.

Do not invent new lifecycle states.

Marketplace Basic must not receive full lifecycle management unless current capability model explicitly allows it.

---

# 23. CRM Analytics

Step 3.6 already implemented CRM Analytics UI over the existing analytics engine.

Do not create a second analytics engine.

For Partner Workspace:

```text
Basic
→ limited analytics according to entitlement

Pro
→ expanded/full analytics according to entitlement
```

If Partner CRM Analytics UI is not yet supported by an existing API/scope, report the dependency rather than calling Platform `/analytics/crm` with unsafe scope.

No `/app/crm` dependency for Partner.

---

# 24. Platform Analytics regression

Do not move or remove Platform CRM Analytics as part of this stage.

Partner CRM UI and Platform Analytics are separate workspace views over shared canonical logic where appropriate.

---

# 25. Actions and buttons

Inventory every Partner CRM action:

```text
Create/Add Customer
Edit relationship
Change lifecycle
Change source
Assign manager
Tags
Add note
Open order
Open booking
Analytics
```

For each:

```text
Basic visible?
Pro visible?
permission?
entitlement?
server endpoint?
```

No action may exist only as frontend entitlement logic if server-side authority is missing.

---

# 26. Entitlement enforcement tests

Required:

```text
Marketplace Basic:
→ full CRM route/action denied where Pro-only
→ manual intake denied server-side
→ Pro-only mutation API denied

Storefront Pro:
→ full CRM route available
→ supported CRM mutations available with permission

Platform:
→ unaffected

Other Partner:
→ cannot access current Partner's CRM data
```

---

# 27. Direct URL tests

Test direct URLs, not only navigation.

Examples based on actual routes:

```text
Basic → Pro-only CRM route
Partner A → Partner B customer/PCR URL
Partner → /app/crm
anonymous → Partner CRM
```

Expected denial/redirect must follow current app conventions.

No accidental `500`.

---

# 28. Direct API isolation tests

Mandatory P0 tests:

```text
Partner A cannot fetch Partner B PCR
Partner A cannot mutate Partner B PCR
Partner A cannot read Partner B notes/activity
Partner A cannot access global customer directory outside relationship scope
Basic cannot call Pro-only intake endpoint
Basic cannot bypass source/lifecycle entitlement through API
```

Use real server authorization paths.

---

# 29. Shared table UX

Preserve existing project conventions established in prior remediation:

```text
fixed/stable geometry
localized headers
server-side pagination
debounced live search
localized statuses
human-readable labels
consistent amount/date alignment where relevant
```

Do not introduce a visually separate table system for Partner CRM.

---

# 30. Human-readable labels

Never use UUID as the primary visible label where a business label exists.

Examples:

```text
Customer → name
Order → business code
Booking → business code
Product → title
Partner → company name
```

Internal href/identity may continue to use UUID.

---

# 31. Empty states

Differentiate legitimate states.

Examples:

```text
Basic:
"No marketplace customers yet"

Pro:
"No customers yet"
+ Add Customer CTA only when manual intake is entitled

Filtered:
"No customers match the selected filters"
```

Use existing UX/i18n style.

---

# 32. Loading/error states

Do not leave blank tables.

Required:

```text
loading
empty
filtered-empty
error
```

Avoid exposing raw backend errors.

---

# 33. i18n

All new visible UI must support:

```text
RU
AZ
EN
```

No raw keys.

Reuse existing translations where semantically correct.

Do not create duplicate keys for identical shared concepts without reason.

---

# 34. Responsive behavior

Verify the Partner CRM on the responsive widths currently supported by the Partner Workspace.

Do not perform a broad mobile redesign.

Ensure:

```text
sidebar/navigation usable
table/customer list usable
detail actions accessible
modals/forms do not overflow
```

---

# 35. Accessibility baseline

Follow existing component accessibility conventions.

At minimum:

```text
form labels
button accessible names
keyboard reachable actions
proper disabled states
error association
```

Do not create icon-only actions without accessible labels.

---

# 36. Backend changes

Backend changes are allowed only when a proven UI gap reveals that an already-canonical Partner CRM capability cannot be safely consumed.

Do not broaden backend domain scope.

Any backend change must preserve:

```text
tenant isolation
entitlement
permission
PCR first-source semantics
global Customer identity authority
```

If a new endpoint would duplicate an existing one, reuse the existing endpoint instead.

---

# 37. No fake data

Partner CRM UI must use real APIs.

Do not hardcode:

```text
customer counts
lifecycle
lead source
activity
orders
bookings
analytics
```

Mock data is acceptable only in isolated tests/stories if that is existing project practice.

Runtime proof must use real application data.

---

# 38. Browser/runtime verification — Marketplace Basic

Use an actual Basic Partner.

Verify:

```text
Partner Workspace loads
correct CRM/customer navigation
only allowed customer context visible
marketplace-attributed PCR visible
manual Add Customer absent
Pro-only controls absent
direct Pro-only route denied
direct Pro-only API denied
no Platform /app/crm access
RU/AZ/EN
```

Capture exact route/API evidence.

---

# 39. Browser/runtime verification — Storefront Pro

Use an actual Pro Partner.

Verify:

```text
full CRM navigation
customer list
customer detail
manual intake
canonical source selection
lifecycle where supported
notes/activity where supported
orders/bookings context where supported
analytics entry where supported
RU/AZ/EN
```

Use real API/runtime data.

---

# 40. Browser/runtime verification — isolation

Use at least two Partner scopes if test data permits.

Prove:

```text
Partner A
≠
Partner B
```

Attempt direct customer/PCR/resource access across scope.

Server must deny or return scope-safe not-found according to current security convention.

UI filtering alone is not evidence.

---

# 41. Platform regression

Verify:

```text
/app/crm remains Platform-only
Platform CRM still works
Platform CRM Analytics still works
Platform Create Customer remains absent
```

Do not redesign Platform CRM.

---

# 42. Step 3.6A regression

Verify:

```text
MARKETPLACE auto-attribution
STOREFRONT source
first-source preservation
Basic manual intake denied
Pro manual intake allowed
```

---

# 43. Step 3.6B regression

Verify:

```text
Platform Product create denied
Partner Product create works
partnerId server-derived
anti-spoofing works
```

---

# 44. Step 3.6C / 3.6C.1 regression

Verify affected authority boundaries remain green:

```text
Payment granular permissions
Refund granular permissions
Product governance separation
Platform Order/Booking support authority
```

Do not modify these unless required to fix a proven regression.

---

# 45. Test requirements

Run directly affected Partner CRM tests plus established regressions.

Report exact X/X counts.

At minimum:

```text
Partner CRM backend
CRM
Analytics
Entitlement/capability tests
Frontend Partner CRM
Frontend regression
Backend TSC
Frontend TSC
```

If tests are organized differently, report actual suite names.

Do not claim `all tests pass` without counts.

---

# 46. Runtime authority beats source inspection

A correct-looking component is not sufficient.

A correct-looking guard is not sufficient.

Closure requires:

```text
browser
+
real API
+
server-side denial
+
tenant isolation
+
entitlement behavior
```

If runtime contradicts source/tests:

```text
runtime wins
VERDICT B
```

until fixed.

---

# 47. Git discipline

Before work:

```text
git status
git rev-parse HEAD
git rev-parse origin/master
```

Expected baseline:

```text
e1bfb98
```

Verify it.

If unrelated pre-existing changes exist, record them explicitly.

Do not call the tree `clean` if Git reports deletions/untracked files.

Use wording such as:

```text
working tree contains pre-existing unrelated changes
```

when applicable.

Do not include unrelated changes in the stage commit.

---

# 48. Canonical roadmap update

After implementation and evidence closure, update:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

only if the project's established workflow requires completion synchronization in the same stage.

Preserve history.

Record:

```text
Step 3.6D
status
final SHA
actual implemented scope
```

Do not invent the next stage.

If roadmap policy says NEXT is chosen only in a separate synchronization stage, do not modify NEXT prematurely.

Follow the current roadmap convention discovered in repo.

---

# 49. Required final report

## A. Verdict

Only:

```text
VERDICT A — PHASE 3 — STEP 3.6D — PARTNER CRM UI — FULLY CLOSED
```

or:

```text
VERDICT B — PHASE 3 — STEP 3.6D — NOT CLOSED
```

---

## B. Pre-implementation inventory

Show what already existed and what actual gaps were found.

This section is mandatory.

---

## C. Implemented scope

List only what was actually added/changed.

Separate:

```text
REUSED
CHANGED
NEW
```

---

## D. Route architecture

Show final Partner CRM routes and why no duplicate CRM root was created.

---

## E. Basic capability matrix

Exact Marketplace Basic CRM capabilities.

---

## F. Pro capability matrix

Exact Storefront Pro CRM capabilities.

---

## G. Server authority

For each Pro-only action:

```text
entitlement
permission
endpoint
denial behavior
```

---

## H. Tenant isolation

Provide direct API proof for Partner A vs Partner B.

---

## I. Customer/PCR authority

Confirm:

```text
Customer = global identity
PCR = Partner-scoped relationship
```

and show how UI respects the distinction.

---

## J. Source/lifecycle evidence

Show canonical source and lifecycle behavior actually exposed.

---

## K. Activity/Notes

State whether reused, implemented, or deferred and why.

No ambiguity.

---

## L. Analytics

State exactly what Partner CRM analytics surface exists after this stage.

Do not claim full analytics if only API exists.

---

## M. i18n

RU/AZ/EN runtime evidence.

---

## N. Tests

Exact commands and X/X.

---

## O. Browser/runtime evidence

Basic, Pro, Platform regression, isolation.

---

## P. Changed files

Exact paths and purpose.

---

## Q. Git evidence

```text
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
git status:
```

If unrelated changes remain, list them separately.

No false `clean`.

---

# 50. Hard closure gates

`VERDICT A` is forbidden unless all applicable gates pass:

```text
[ ] existing Partner CRM/customer UI inventoried first
[ ] no duplicate CRM implementation created
[ ] Partner CRM lives under Partner Workspace
[ ] Partner cannot use Platform /app/crm
[ ] Customer vs PCR authority preserved
[ ] Marketplace Basic receives only limited CRM capability
[ ] Basic manual intake denied server-side
[ ] Storefront Pro receives supported full CRM capability
[ ] Pro manual intake works if canonical backend supports it
[ ] leadSource first-source semantics preserved
[ ] MARKETPLACE attribution visible
[ ] STOREFRONT source handled correctly
[ ] tenant isolation proven server-side
[ ] Partner A cannot access Partner B CRM data
[ ] direct URL entitlement bypass denied
[ ] direct API entitlement bypass denied
[ ] existing Activity reused rather than duplicated where applicable
[ ] existing Notes authority preserved where applicable
[ ] no duplicate Analytics Engine
[ ] shared table UX preserved
[ ] human-readable labels used
[ ] loading/empty/error states implemented
[ ] RU/AZ/EN verified
[ ] Platform CRM regression passes
[ ] Step 3.6A regression passes
[ ] Step 3.6B regression passes
[ ] Step 3.6C/3.6C.1 authority regression passes
[ ] directly affected tests pass with exact counts
[ ] browser/runtime evidence exists
[ ] final Git evidence is accurate
[ ] unrelated working-tree changes not misreported as clean
```

Any failed mandatory gate:

```text
VERDICT B — NOT CLOSED
```

---

# 51. Non-goals

Do not implement in Step 3.6D:

```text
automated chat moderation
communication topology redesign
Workforce / Employee Performance
Supplier / Procurement
Payout UI
first-party TravelHub seller launch
Product.partnerId NOT NULL migration
new Partner subscription model
new CRM backend architecture
new Analytics Engine
Platform CRM redesign
broad Partner Workspace redesign
```

---

# 52. Expected final architecture

```text
                         TRAVELHUB
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ↓                           ↓
       PLATFORM WORKSPACE           PARTNER WORKSPACE
           /app/*                     /partner/*
              │                           │
              │                           ├─ Marketplace Basic
              │                           │    └─ limited customer context
              │                           │       marketplace relationships
              │                           │
              │                           └─ Storefront Pro
              │                                └─ full supported Partner CRM
              │
              └─ Internal CRM
                 identity/support/
                 security/moderation
```

And within Partner CRM:

```text
Global Customer Identity
          +
PartnerCustomerRelation
          +
Partner-scoped business activity
          ↓
Partner CRM UI
```

No cross-Partner leakage.

No Platform CRM leakage.

No entitlement bypass.

No duplicated CRM architecture.

---

# 53. Stop condition

After implementation:

1. return the complete evidence report;
2. provide exact final SHA;
3. do not automatically start the next roadmap stage;
4. wait for approval.
