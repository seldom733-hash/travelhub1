# PHASE 3 — STEP 3.6A — PARTNER CRM SOURCE / ENTITLEMENT IMPLEMENTATION & REMEDIATION

## STATUS

**Implementation prompt — architecture decisions approved.**

This prompt follows the completed audit:

`PHASE 3 — STEP 3.6A — PARTNER CRM SOURCE / ENTITLEMENT ARCHITECTURE AUDIT`

Audit verdict:

```text
VERDICT: B
MODEL IS SOUND, IMPLEMENTATION GATES IDENTIFIED
```

This stage is no longer an audit.  
Implement the approved business model, close the identified gaps, preserve existing working CRM behavior, and provide runtime + DB + API + UI evidence before declaring closure.

---

# 1. Objective

Bring Customer acquisition source and Partner CRM entitlement behavior into one canonical model across:

```text
PLATFORM
MARKETPLACE BASIC
STOREFRONT PRO
```

The implementation must satisfy all of the following:

1. Marketplace-originated customer relationships are created automatically and idempotently.
2. Marketplace Basic cannot manually create CRM customers.
3. Storefront Pro retains full manual CRM intake.
4. Storefront Pro supports the canonical manual acquisition sources.
5. Own Storefront acquisition is distinguishable from TravelHub Marketplace acquisition.
6. Existing source is never silently overwritten by later interactions.
7. Platform CRM is administrative/customer-identity oriented, not a sales CRM.
8. Platform manual `Create Customer` UI is removed after dependency verification.
9. Existing APIs/endpoints are not deleted blindly.
10. CRM Analytics source data remains reconciled DB → Service → API → UI.

---

# 2. Approved Business Model

## 2.1 Platform Customer model

Platform CRM manages the global `Customer` identity for administration, support, security, disputes, moderation, transaction history, bookings, orders, payments, refunds, activities and partner relationships.

Platform employees are **not** intended to operate a manual sales CRM for TravelHub customers.

Target UI:

```text
Platform CRM
└── Customers
    ├── Search
    ├── Filters
    ├── Customer 360
    ├── Orders
    ├── Bookings
    ├── Payments / Refunds
    ├── Activity
    ├── Partner relationships
    ├── Notes
    └── Support / moderation / administration

NO manual "Create Customer" action in Platform CRM UI.
```

### Important

Do **not** blindly remove `POST /customers`.

Before any backend deletion/deprecation:

- search all backend call sites;
- search frontend usages;
- search tests;
- search seeds;
- search internal/admin flows;
- search any system-created customer flow.

For Step 3.6A, the required UI result is:

```text
Platform CRM → Create Customer button/action removed
```

The backend endpoint may remain if dependencies or system use justify it.

If no valid dependency exists, report that fact and propose deprecation separately. Do not silently delete it in this stage unless removal is clearly safe and fully evidenced.

---

# 3. Marketplace Basic Model

Marketplace Basic does **not** represent a normal direct-contact CRM.

Customer relationship topology:

```text
Customer
   ↓
TravelHub Marketplace / Platform
   ↓
Marketplace Partner
```

The Marketplace Partner does not manually acquire a TravelHub customer by phone, office, email, direct contact, etc. for this entitlement context.

Therefore:

```text
Marketplace Basic

Manual Create Customer       = DENY
Manual CRM Intake            = DENY
Manual Source Selector        = NOT AVAILABLE
Lifecycle editing             = DENY
Manager assignment            = DENY
Relation editing              = DENY

Marketplace customer visibility = ALLOW
Platform-generated PCR          = ALLOW
Source                           = MARKETPLACE
```

Existing server-side PRO gating for manual intake must remain intact.

Do not weaken existing entitlement enforcement.

---

# 4. Storefront Pro Model

Storefront Pro is the full business CRM context.

The partner may acquire/manage customers through its own commercial channels.

Approved source model:

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

Definitions:

| Source | Meaning |
|---|---|
| `MARKETPLACE` | Customer first acquired for this Partner via TravelHub Marketplace |
| `STOREFRONT` | Customer first acquired via the Partner's own TravelHub Storefront |
| `DIRECT` | Direct/manual acquisition not better represented by a specific channel |
| `PHONE` | First acquisition by phone |
| `OFFICE` | First acquisition in office / offline point of sale |
| `EMAIL` | First acquisition via email |
| `REFERRAL` | First acquisition by recommendation/referral |
| `OTHER` | Other explicit manual acquisition source |

`leadSource` remains the **first acquisition source for this PartnerCustomerRelation**, not the source of every later interaction.

---

# 5. Canonical Ownership

Keep the existing ownership model:

```text
Customer
  = global customer identity

PartnerCustomerRelation
  = partner-scoped customer relationship

PartnerCustomerRelation.leadSource
  = first acquisition source for that specific Partner
```

A single global Customer may have different independent PCRs for different Partners:

```text
Customer A
 ├── PCR with Partner X → MARKETPLACE
 └── PCR with Partner Y → PHONE
```

Do not move `leadSource` to global `Customer`.

Do not duplicate the field into unrelated models.

---

# 6. P0 — Marketplace Auto-Attribution

## 6.1 Canonical event authority

The primary canonical event for automatic Marketplace relationship creation is:

```text
Order creation
```

Reason:

At that point the system has both:

```text
customerId
sellerPartnerId
```

and a real identified commercial interaction exists.

Page views must not create PCR.

Anonymous browsing must not create PCR.

Payment is too late to be the primary event.

Booking may be a fallback/reconciliation path only if business flow can create a Booking without the corresponding Order-based attribution being executed.

---

## 6.2 Required algorithm

Implement idempotent automatic attribution:

```text
Marketplace Order created
        ↓
resolve customerId
        ↓
resolve sellerPartnerId
        ↓
find PCR(partnerId, customerId)
        │
        ├── NOT EXISTS
        │      → create PCR
        │      → leadSource = MARKETPLACE
        │      → lifecycle initial value according to current canonical PCR rules
        │
        └── EXISTS
               → preserve relation
               → preserve original leadSource
               → DO NOT overwrite
```

This must be transaction-safe enough for concurrent duplicate events.

Existing uniqueness:

```text
@@unique([partnerId, customerId])
```

must remain the final DB authority against duplicate PCR rows.

Handle race conditions cleanly.

Acceptable behavior:

```text
two simultaneous qualifying events
→ one PCR
→ no duplicate rows
→ no unhandled 500 due expected uniqueness race
```

---

## 6.3 First-source preservation

Mandatory invariant:

```text
Existing PCR source MUST NOT be overwritten.
```

Examples:

```text
PCR = PHONE
later Marketplace order
→ remains PHONE
```

```text
PCR = STOREFRONT
later Marketplace booking
→ remains STOREFRONT
```

```text
PCR = MARKETPLACE
later manual CRM edit
→ must not silently become DIRECT
```

If an explicit administrative source-correction feature exists, it must be treated separately from normal acquisition flow.

Do not introduce one implicitly in this stage.

---

# 7. Basic Customers Must Have PCR

The previous audit identified a structural inconsistency:

```text
Marketplace Basic customer visible from Orders
but
no PCR
→ no leadSource
→ incomplete CRM Analytics population
```

This is no longer an open design question.

Approved decision:

```text
Marketplace Basic customers generated by canonical Marketplace interaction
MUST receive a platform-generated PartnerCustomerRelation.
```

This PCR does **not** imply that Basic gains Full CRM capabilities.

Separate the concepts:

```text
PCR existence ≠ Full CRM entitlement
```

Marketplace Basic may have a PCR for:

- identity relationship;
- acquisition provenance;
- analytics;
- relationship continuity;
- auditability.

But Basic still must not gain:

- manual intake;
- lifecycle mutation;
- manager assignment;
- arbitrary tags/notes mutation;
- full CRM relation editing;
- direct-contact source selection.

Server-side entitlement remains authoritative.

---

# 8. P1 — Storefront Pro Source Selector

Current source UI must be reconciled with the canonical model.

For **Storefront Pro manual intake**, expose the relevant manual acquisition options:

```text
DIRECT
PHONE
OFFICE
EMAIL
REFERRAL
OTHER
```

`STOREFRONT` may be shown only where a human is legitimately creating a relation representing an own-storefront acquisition and the architecture allows manual correction/intake for that case.

`MARKETPLACE` should primarily be assigned automatically by Marketplace system attribution.

Do not encourage manual selection of `MARKETPLACE` where the system already knows the Marketplace origin.

If the current Platform admin Partner Intake intentionally allows source override for migration/support purposes, preserve that capability only if justified and document it explicitly.

---

# 9. P1 — Add Canonical STOREFRONT Source

Add:

```text
STOREFRONT
```

as a canonical acquisition source representing:

```text
Customer → Partner's own Storefront
```

This must be semantically distinct from:

```text
MARKETPLACE
= TravelHub Marketplace discovery/acquisition
```

Required consistency:

```text
DB stored value
Service
API
DTO validation / allowed values
Frontend
i18n RU
i18n AZ
i18n EN
CRM Analytics breakdown
Tests
```

Because `leadSource` is currently convention-based `String?`, do not add a Prisma enum/migration unless repository architecture clearly requires one.

Prefer the smallest consistent change.

If the project already has a shared constant/type for lead sources, extend that canonical authority instead of creating another duplicate list.

---

# 10. Source Authority — No Scattered Magic Strings

During implementation, discover whether lead-source values are currently duplicated across:

- DTOs;
- frontend arrays;
- i18n;
- analytics;
- tests;
- seeds;
- services.

If multiple ad-hoc source lists exist, establish or reuse one canonical source definition per relevant layer without performing a broad unrelated refactor.

Target conceptual contract:

```ts
MARKETPLACE
STOREFRONT
DIRECT
PHONE
OFFICE
EMAIL
REFERRAL
OTHER
```

Backend must reject arbitrary invalid source values if the current DTO/API is intended to enforce the canonical source contract.

The previous state accepted arbitrary strings because the DB column is `String?`.

Do not rely on database type permissiveness as business validation.

If changing DTO validation would break a legitimate existing flow, report the dependency and handle it explicitly.

---

# 11. Platform "Create Customer" UI Remediation

After dependency discovery, remove the manual Platform CRM customer creation affordance.

Required result:

```text
PLATFORM WORKSPACE
CRM → Customers

"Create Customer" button/action = absent
```

Also check:

- keyboard shortcuts;
- empty-state CTA;
- context menus;
- mobile/responsive action menus;
- deep links;
- query-state opening create modal;
- any duplicated create customer action in Platform CRM Center.

Do not leave an alternative UI path that bypasses the decision.

Legacy direct navigation to a create form must fail safely or redirect to Customers, depending on current routing architecture.

Do not break Storefront Pro Create Customer.

---

# 12. Entitlement Matrix — Required Runtime Result

Final behavior must satisfy:

| Capability | Platform CRM | Marketplace Basic | Storefront Pro |
|---|---:|---:|---:|
| View global/admin Customer data | ✅ according to Platform RBAC | N/A | N/A |
| Manual Platform Create Customer UI | ❌ | N/A | N/A |
| View own Partner customers | N/A | ✅ | ✅ |
| Platform-generated PCR | N/A | ✅ | ✅ |
| Automatic MARKETPLACE source | N/A | ✅ | ✅ |
| Manual Create Customer | N/A | ❌ | ✅ |
| Manual source selector | N/A | ❌ | ✅ |
| Lifecycle editing | N/A | ❌ | ✅ |
| Manager assignment | N/A | ❌ | ✅ |
| Full relation editing | N/A | ❌ | ✅ |
| Own Storefront acquisition | N/A | N/A / unavailable | ✅ |
| `STOREFRONT` source | N/A | ❌ | ✅ |

Do not implement entitlement only in frontend.

Both UI and server-side behavior must agree.

---

# 13. Marketplace vs Storefront Acquisition

These two flows must be distinguishable:

## 13.1 TravelHub Marketplace

```text
Customer
  ↓
TravelHub Marketplace
  ↓
Order with sellerPartnerId
  ↓
PCR auto-created if absent
  ↓
leadSource = MARKETPLACE
```

## 13.2 Partner own Storefront

Discover the canonical event/route that represents creation/order/lead through the Partner's own storefront.

Expected semantic result:

```text
Customer
  ↓
Partner Storefront
  ↓
identified qualifying business interaction
  ↓
PCR auto-created if absent
  ↓
leadSource = STOREFRONT
```

Do not guess the event path.

Use the repository to identify the real Storefront order/customer flow.

If no distinct runtime event currently exists, implement only the canonical source contract + UI/analytics support and report Storefront automatic attribution as a clearly scoped follow-up GAP.

Do not fabricate a fake event source.

---

# 14. CRM Analytics Reconciliation

`sourceBreakdown` must continue to come from PartnerCustomerRelation source data.

After auto-attribution is implemented, verify that qualifying Marketplace customers are reflected.

Required reconciliation:

```text
DB GROUP BY leadSource
=
AnalyticsService result
=
GET /analytics/crm
=
CRM Analytics UI
```

For every returned source:

```text
count DB == count service == count API == displayed count
```

Also verify:

```text
sum(sourceBreakdown counts)
```

against the defined PCR population for the same scope.

If source is nullable for legacy PCR rows, handle the null bucket according to the existing analytics contract.

Do not silently drop data unless that is already canonical behavior.

---

# 15. Backfill / Existing Data

Audit existing production/dev/test data before deciding closure.

The new runtime attribution fixes future writes, but existing qualifying Marketplace customers may already lack PCR.

Therefore determine:

```text
How many historical Marketplace Order customer/partner pairs exist?
How many already have PCR?
How many are missing PCR?
```

If missing historical relationships exist, provide a safe idempotent backfill strategy.

Requirements:

```text
existing PCR → preserve
missing PCR → create MARKETPLACE
duplicate order pairs → one PCR
existing non-MARKETPLACE source → preserve
```

Do not use destructive rebuild.

Do not delete/recreate PCR.

Do not overwrite a first source.

If the repository already has migration/backfill infrastructure, use it.

If data remediation is required but should not execute automatically in production, create the appropriate safe command/script/migration according to existing project conventions and document how it is invoked.

---

# 16. Communication / Moderation — OUT OF SCOPE

Do **not** implement chat moderation in Step 3.6A.

The following is a separate future architecture stage:

```text
Customer
   ↓
TravelHub Chat
   ↓
Automatic Moderation
   ↓
Marketplace Partner
```

including:

- contact detection;
- phone/email/link detection;
- obfuscation resistance;
- ALLOW / REDACT / BLOCK / REVIEW;
- moderation audit;
- two-way message policy;
- Marketplace vs Storefront communication rules.

Step 3.6A may not redesign the messaging subsystem.

---

# 17. No Broad CRM Redesign

Existing working surfaces must be preserved.

Regression-only for:

- CRM Center;
- Customers;
- Partners;
- Customer 360;
- Partner 360;
- Activity;
- Notes;
- Payments;
- Refunds;
- Orders;
- Bookings;
- related-entity human-readable labels;
- current RU/AZ/EN localization;
- current RBAC.

Do not rebuild these screens.

Do not create a second CRM or Analytics system.

Do not move existing Analytics topology in this stage.

---

# 18. Required Tests

At minimum add/extend tests covering:

## Marketplace auto-attribution

```text
1. New Customer + new Partner + Marketplace Order
   → PCR created
   → source MARKETPLACE

2. Existing Customer + new Partner
   → PCR created for this partner only
   → source MARKETPLACE

3. Existing PCR MARKETPLACE
   → second order
   → no duplicate PCR

4. Existing PCR PHONE
   → Marketplace Order
   → source remains PHONE

5. Existing PCR STOREFRONT
   → Marketplace Order
   → source remains STOREFRONT

6. Concurrent qualifying writes
   → one PCR
   → no unhandled uniqueness failure
```

## Entitlement

```text
7. Marketplace Basic manual intake
   → 403

8. Storefront Pro manual intake
   → allowed with permission

9. Storefront Pro PHONE
   → persisted PHONE

10. Storefront Pro OFFICE
    → persisted OFFICE

11. Storefront Pro EMAIL
    → persisted EMAIL

12. Invalid source
    → rejected if canonical DTO validation is implemented
```

## UI

```text
13. Platform CRM
    → Create Customer action absent

14. Marketplace Basic
    → Create Customer absent

15. Marketplace Basic
    → source selector absent

16. Storefront Pro
    → Create Customer visible

17. Storefront Pro
    → complete approved manual source options visible
```

## Analytics

```text
18. MARKETPLACE auto-created PCR appears in sourceBreakdown

19. STOREFRONT appears correctly when present

20. DB/API/UI source counts reconcile
```

---

# 19. Runtime Verification

Do not close based only on unit tests.

Verify in a running application.

Required runtime scenarios:

## Scenario A — Marketplace Basic

1. Login as Marketplace Basic partner.
2. Open Partner CRM Customers.
3. Verify no Create Customer action.
4. Verify no source selector/manual intake.
5. Create/trigger a real Marketplace order using a customer.
6. Verify PCR created in DB.
7. Verify `leadSource = MARKETPLACE`.
8. Verify customer remains visible in Partner CRM.
9. Verify CRM Analytics includes the relationship where applicable.

## Scenario B — Existing source preservation

1. Prepare Storefront Pro PCR with `PHONE`.
2. Trigger a Marketplace order for same customer + partner.
3. Verify source remains `PHONE`.
4. Verify no duplicate PCR.

## Scenario C — Storefront Pro

1. Login as Storefront Pro.
2. Verify Create Customer visible.
3. Verify source selector contains approved manual channels.
4. Create PHONE lead.
5. Verify DB/API/UI all show PHONE.
6. Create OFFICE lead.
7. Verify DB/API/UI all show OFFICE.
8. Verify STORE­FRONT source support according to actual implemented Storefront path.

## Scenario D — Platform CRM

1. Login as authorized Platform role.
2. Open CRM → Customers.
3. Verify Create Customer button/action absent.
4. Verify Customer list/360 still works.
5. Verify existing Customer detail tabs remain functional.

---

# 20. Localization

All user-visible source labels must exist in:

```text
RU
AZ
EN
```

Required source labels:

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

No raw i18n keys.

No English fallback inside RU/AZ unless intentionally canonical product naming.

Also verify Platform Customers after Create action removal in RU/AZ/EN.

---

# 21. Security / Server Authority

Mandatory:

```text
Frontend-hidden ≠ server denial
```

Verify that Marketplace Basic still gets server-side denial on manual intake and relation mutation.

Do not rely on `isPro` alone.

Storefront Pro must still require the relevant permission in addition to entitlement.

Effective access remains:

```text
Workspace
  ↓
Entitlement
  ↓
Capability
  ↓
Permission
  ↓
Access
```

`PARTNER role` alone is not sufficient for Storefront Pro CRM mutation.

---

# 22. DB Integrity Checks

Provide exact counts/evidence for:

```text
duplicate PCR by (partnerId, customerId) = 0
```

```text
auto-created MARKETPLACE PCR missing source = 0
```

```text
existing non-MARKETPLACE source overwritten by Marketplace interaction = 0
```

```text
historical qualifying marketplace pairs without PCR
→ 0 after approved backfill, if backfill is part of this stage
```

If legacy exceptions intentionally remain, enumerate them exactly.

---

# 23. Git / Evidence Discipline

Before changes capture:

```text
git status
git rev-parse HEAD
git rev-parse origin/master
```

After implementation:

```text
git status
git rev-parse HEAD
git rev-parse origin/master
git log --oneline -n 10
```

Do not claim:

```text
HEAD = origin/master
```

unless actually pushed and verified.

Preserve prior Step 3.6 history.

Do not squash away existing architectural/evidence commits unless explicitly required.

---

# 24. Required Final Report

Return a structured report with the following sections.

## A. Verdict

Only one:

```text
VERDICT A — FULLY CLOSED
```

or

```text
VERDICT B — NOT CLOSED
```

No conditional A.

---

## B. Changed files

Exact paths + purpose.

---

## C. Marketplace auto-attribution

Show:

```text
event authority
service/path
idempotency behavior
race handling
existing-source preservation
```

---

## D. Entitlement proof

Evidence for:

```text
Basic manual intake → denied
Pro manual intake → allowed when permitted
```

---

## E. Platform Create Customer

State:

```text
UI action removed: YES/NO
POST /customers dependency audit: result
endpoint removed/retained: reason
```

---

## F. Source contract

Final supported source list.

Explicitly explain:

```text
MARKETPLACE
vs
STOREFRONT
```

---

## G. Historical backfill

Report exact numbers:

```text
qualifying Marketplace customer/partner pairs
existing PCR
missing before
created
preserved existing source
missing after
duplicates
```

---

## H. Analytics reconciliation

Provide actual sample:

```text
DB:
MARKETPLACE = X
STOREFRONT = Y
PHONE = Z
...

Service:
...

API:
...

UI:
...
```

All counts must reconcile for the same scope and period.

---

## I. Test results

Exact commands and results.

Do not write only "tests pass".

Example:

```text
Backend CRM tests:  XX/XX PASS
Analytics tests:    XX/XX PASS
Frontend tests:     XX/XX PASS
TypeScript:         PASS
```

---

## J. Browser/runtime evidence

Show actual verified scenarios for:

```text
Platform
Marketplace Basic
Storefront Pro
RU
AZ
EN
```

---

## K. Git evidence

```text
Starting HEAD:
Final HEAD:
origin/master:
git status:
```

---

# 25. Closure Gates

Step 3.6A may be declared **VERDICT A** only if all are true:

```text
[ ] Marketplace Order automatically creates missing PCR
[ ] created Marketplace PCR source = MARKETPLACE
[ ] auto-attribution idempotent
[ ] concurrent/duplicate event safe
[ ] existing leadSource never overwritten
[ ] Marketplace Basic still cannot manual-intake
[ ] Marketplace Basic receives platform-generated PCR
[ ] Storefront Pro manual intake still works
[ ] Storefront Pro source options corrected
[ ] STOREFRONT canonical source added consistently
[ ] Platform Create Customer UI removed
[ ] POST /customers dependency audited
[ ] existing CRM surfaces preserved
[ ] DB → Service → API → UI source reconciliation passes
[ ] historical missing PCR handled or explicitly proven absent
[ ] RU/AZ/EN verified
[ ] server-side entitlement verified
[ ] no duplicate PCR
[ ] full regression suite passes
[ ] browser runtime verified
[ ] Git evidence complete
```

If any gate fails:

```text
VERDICT B
```

with the exact blocker.

---

# 26. Explicit Non-Goals

Do not implement in this stage:

```text
- Chat moderation
- Marketplace communication architecture
- Employee Performance Management
- broad CRM redesign
- new Analytics Center
- new Partner role system
- direct Customer ↔ Marketplace Partner contact channel
- schema redesign without evidence
```

---

# 27. Expected Result

After completion, the model must behave as:

```text
PLATFORM
Customer identity/admin/support context
Manual Create Customer UI = removed

MARKETPLACE BASIC
Customer originates through TravelHub Marketplace
PCR generated automatically
leadSource = MARKETPLACE
No manual CRM intake

STOREFRONT PRO
Full CRM
Manual intake allowed
Own channels allowed
MARKETPLACE and STOREFRONT are distinct acquisition sources
First source preserved
```

Only after this is proven in runtime may Step 3.6A be closed and the project proceed to the next CRM/communication architecture stage.
