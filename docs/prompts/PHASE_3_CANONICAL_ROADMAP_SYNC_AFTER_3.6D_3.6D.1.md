# PHASE 3 — CANONICAL ROADMAP SYNCHRONIZATION AFTER STEPS 3.6D / 3.6D.1

## MODE

**DOCUMENTATION / CANONICAL ROADMAP SYNCHRONIZATION ONLY.**

Do not implement new product functionality.

Do not grant new PARTNER permissions.

Do not automatically create a new stage number for discovered gaps.

The purpose of this stage is to:

1. record the completed Step 3.6D / 3.6D.1 state;
2. record the final implementation SHA;
3. register the follow-up gaps discovered during runtime closure;
4. reconcile those gaps with the existing canonical roadmap;
5. determine exactly one canonical `NEXT` from roadmap ordering and dependencies.

Canonical roadmap:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

---

# 1. Repository baseline

Expected latest implementation commit:

```text
2175e0f
```

Verify rather than assume:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log --oneline -20
```

Known evidence from Step 3.6D.1:

```text
Starting HEAD before 3.6D: e1bfb98
3.6D implementation HEAD: 2175e0f
3.6D.1 production changes: NONE
origin/master: 2175e0f
HEAD == origin/master: YES
```

If current HEAD has valid later work, do not reset it.

---

# 2. Working-tree evidence discipline

Previous closure explicitly reported unrelated working-tree changes:

```text
D backend/src/reconcile-2c2.ts
D docs/prompts/PHASE_3_STEP_3.5E_PARTNER_CRM_ANALYTICS_READ_MODEL_IMPLEMENTATION_REPORT.md
multiple untracked prompt files
```

Verify their current state.

Do not call the working tree `clean` if Git still reports them.

Do not include unrelated changes in the roadmap synchronization commit.

Use exact wording such as:

```text
roadmap synchronization files committed/pushed
working tree contains pre-existing unrelated changes
```

when applicable.

---

# 3. Record Step 3.6D as completed

Canonical title:

```text
PHASE 3 — STEP 3.6D — PARTNER CRM UI
```

Final implementation SHA:

```text
2175e0f
```

Record it as completed only after verifying Git.

Canonical implementation outcome:

```text
Partner CRM UI
→ existing /partner/customers reused
→ no duplicate CRM root
→ gap-first implementation
```

Do not describe Step 3.6D as a brand-new CRM architecture.

---

# 4. Step 3.6D pre-existing architecture discovered

The implementation inventory established that these surfaces already existed before the Step 3.6D delta:

```text
/partner/customers
Partner customer list
Partner customer detail
CRM tier badge
Storefront Pro intake
Storefront Pro PCR relation editing
Partner tier-aware navigation
Partner CRM API client methods
backend Partner CRM endpoints
```

The actual Step 3.6D production delta was primarily:

```text
Partner CRM RU/AZ/EN i18n completion
lifecycle select
leadSource column
localized leadSource detail
```

Preserve this distinction in roadmap history.

---

# 5. Final Partner CRM route

Canonical Partner CRM/customer route:

```text
/partner/customers
```

Do not introduce a duplicate:

```text
/partner/crm
```

unless a later explicitly approved information-architecture stage changes it.

Current canonical result:

```text
one Partner CRM/customer surface
→ /partner/customers
```

---

# 6. Marketplace Basic CRM capability

Record the verified runtime contract.

Marketplace Basic:

```text
GET /partner/customers
→ allowed

GET /partner/customers/:id
→ allowed for legitimate Partner business/customer context

POST /partner/customers/intake
→ denied

PATCH /partner/relations/:id
→ denied
```

UI:

```text
customer list
customer detail
orders/bookings/payments context
no Add Customer
no lifecycle editor
no leadSource editor
```

Do not describe Basic as full CRM.

---

# 7. Storefront Pro CRM capability

Record the verified runtime contract.

Storefront Pro:

```text
customer list
customer detail
manual intake
PCR relation edit
leadSource
lifecycle
tags
PCR notes field
```

Verified lifecycle:

```text
LEAD
PROSPECT
ACTIVE
CHURNED
```

Verified canonical sources:

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

Do not imply Activity or Analytics is already part of the Partner UI.

---

# 8. Customer / PCR authority

Preserve the established canonical distinction:

```text
Customer
= global identity

PartnerCustomerRelation
= Partner-scoped business relationship
```

Partner UI may display legitimate global identity context but Partner business fields remain PCR-scoped.

Do not state that a Partner owns the global Customer identity.

---

# 9. Tenant isolation closure

Record Step 3.6D.1 runtime evidence as completed architecture proof:

```text
Partner A customer scope
≠
Partner B customer scope
```

Cross-Partner PCR mutation is denied server-side.

Partner CRM is server-scoped, not merely frontend-filtered.

This is a P0 invariant.

---

# 10. Platform CRM isolation closure

Record:

```text
Partner → /app/crm
→ redirected/denied by workspace guard

Partner → Platform customer API
→ denied
```

Canonical boundary remains:

```text
/app/*
→ Platform internal workspace

/partner/*
→ Partner workspace
```

Do not merge these CRM surfaces.

---

# 11. Anonymous isolation closure

Record that Partner CRM requires authentication.

Canonical evidence:

```text
anonymous → /partner/customers
→ login/auth guard

anonymous → Partner CRM API
→ 401
```

---

# 12. i18n closure

Record Partner CRM UI as runtime-verified for:

```text
RU
AZ
EN
```

including:

```text
navigation/title
table headers
empty states
detail labels
lead source
lifecycle
Storefront Pro intake form
```

No raw i18n keys were observed in the closure evidence.

---

# 13. Preserve Step 3.6A source architecture

Roadmap synchronization must not weaken:

```text
leadSource = first acquisition source
```

Canonical sources remain the eight-value contract.

Marketplace system attribution remains:

```text
OrderCreated
→ sellerPartnerId
→ PCR
→ MARKETPLACE when relation absent
```

Storefront direct acquisition may use canonical:

```text
STOREFRONT
```

Existing first source must not be overwritten by later interactions.

---

# 14. Preserve Step 3.6B ownership architecture

Keep:

```text
Platform ≠ commercial seller
Partner = commercial seller/business owner
```

Platform Product create remains denied.

Partner Product ownership remains server-derived.

Legacy state remains historically preserved unless later explicitly remediated:

```text
31 ownerless Products
30 TEST/SEED
1 UNKNOWN

26 historical Orders linked to ownerless Products
```

Do not rewrite this history during roadmap sync.

---

# 15. Preserve Step 3.6C / 3.6C.1 authority architecture

Keep:

```text
Payment:
finance.payment.create
≠
finance.payment.manage
mandatory Platform manual reason
server-derived amount
PaymentHistory audit

Refund:
create / approve / execute separated
SAME-ACTOR ALLOWED under current business model

Product:
Partner own edit
≠
Platform moderation/governance

Platform Order/Booking:
support/admin authority
not commercial creation
manual intervention audited/reasoned
```

Do not reopen these domains.

---

# 16. Register discovered follow-up gap — Partner CRM Activity

The Step 3.6D/3.6D.1 inventory discovered:

```text
crm.activity.read
→ not granted to PARTNER
```

Current UI:

```text
Partner CRM Activity tab
→ unavailable
```

Important:

Do not automatically conclude:

```text
grant crm.activity.read to every PARTNER
```

The roadmap must register this as an unresolved capability/entitlement/RBAC decision.

Future stage must determine at minimum:

```text
Marketplace Basic Activity depth?
Storefront Pro Activity depth?
Partner-scoped filtering?
which event types?
server-side tenant isolation?
permission vs entitlement interaction?
```

Do not implement in this synchronization stage.

---

# 17. Register discovered follow-up gap — Partner Operational Notes

Current state:

```text
operational-notes.read
→ not granted to PARTNER
```

Partner currently has PCR relation notes capability, but that is not automatically equivalent to Platform Operational Notes.

Roadmap must preserve the distinction:

```text
PCR notes
≠
Operational Notes domain
```

Future architecture must decide whether Partner actually needs Operational Notes.

Do not automatically grant the permission.

This may legitimately remain deferred or be rejected as unnecessary.

---

# 18. Register discovered follow-up gap — Partner Analytics

Current state:

```text
analytics.read
→ not granted to PARTNER
```

Current Partner CRM UI:

```text
no Partner CRM Analytics view
```

This is architecturally significant because Partner Analytics has already been defined conceptually as entitlement-aware.

Do not solve it by exposing Platform Analytics.

Do not route Partner to:

```text
/app/*
```

analytics surfaces.

Future implementation must remain:

```text
Partner Workspace
+
Partner scope
+
entitlement-aware analytics
```

and reuse the canonical Analytics Engine where appropriate.

---

# 19. Partner Analytics architecture reminder

Preserve:

```text
ONE Analytics Engine
```

Different workspace/scope/capability views may consume shared metric logic.

Conceptual boundary:

```text
Platform Analytics
→ marketplace operator perspective

Partner Analytics
→ current Partner business perspective
```

Partner tier distinction:

```text
Marketplace Basic
→ limited/basic analytics

Storefront Pro
→ expanded/full analytics
```

Do not claim these Partner views are implemented unless repository evidence proves it.

---

# 20. Do not automatically make discovered gaps NEXT

The existence of:

```text
Activity gap
Notes gap
Analytics gap
```

does not itself prove the next roadmap stage.

Inspect the canonical roadmap ordering.

Determine whether one of these is already represented by a scheduled future step.

If roadmap has a different dependency-correct next stage, preserve that order.

---

# 21. Search roadmap for related future stages

Before editing, search the entire canonical roadmap for:

```text
Partner CRM
Activity
Operational Notes
Analytics
Partner Analytics
Marketplace Basic
Storefront Pro
Workforce
Supplier
Procurement
Moderation
Communication
Payout
```

Reconcile discovered gaps with existing planned stages rather than duplicating them.

---

# 22. Preserve deferred Marketplace communication moderation

Do not implement or silently promote it unless roadmap ordering makes it canonical NEXT.

Business architecture remains:

```text
Customer ↔ Marketplace Partner
→ mediated through TravelHub
→ moderated communication
→ no unrestricted direct contact exchange
```

Storefront Pro:

```text
direct customer relationship/channels allowed
```

Future automated moderation remains a separate architecture/domain stage.

---

# 23. Preserve Workforce roadmap item

Keep Workforce / Employee Performance Management separate from CRM Activity.

Canonical rule:

```text
Assignment ≠ Action ≠ Outcome
```

Do not merge Workforce metrics into Partner CRM Activity.

Do not implement in this synchronization stage.

---

# 24. Preserve Supplier / Procurement roadmap item

Keep future:

```text
Storefront Pro
→ Supplier & Procurement Management
```

External Supplier:

```text
≠ Marketplace Partner
```

Do not implement.

---

# 25. Preserve first-party TravelHub seller rule

If TravelHub later sells services:

```text
TravelHub-owned ordinary Partner
→ Partner Workspace
```

Do not introduce:

```text
Platform-as-Seller
```

Do not create such a Partner merely for roadmap synchronization.

---

# 26. Preserve schema hardening status

Unless repository evidence has independently changed:

```text
Product.partnerId NOT NULL
→ NOT READY
```

because legacy ownerless records remain.

Do not bundle schema hardening into this stage.

---

# 27. Roadmap history chain

Ensure the roadmap preserves the full completed sequence:

```text
3.6     CRM Center UI
        → 4d58f00

3.6A    Partner CRM Source / Entitlement
        → cf582c6

3.6B    Platform Service Ownership / Action Authority
        → 1ced16b

3.6C    Platform Financial / Governance Action Authority
        → 2c61c83

3.6C.1  Final Remediation / Evidence Closure
        → d737eef

3.6D    Partner CRM UI
        → 2175e0f

3.6D.1  Partner CRM UI Runtime / Security / Git Evidence Closure
        → no production commit if evidence-only
```

For 3.6D.1, do not invent a separate implementation SHA if no production/code commit exists.

Represent it according to the roadmap's evidence-stage convention.

---

# 28. Step 3.6D test evidence

Record verified baseline:

```text
CRM:       106/106 PASS
Analytics:  65/65 PASS
Frontend:  243/243 PASS
Backend TSC: PASS
Frontend TSC: PASS
```

If repository reports have later exact counts, use the latest verified values.

Do not invent counts.

---

# 29. Roadmap editing rules

Update:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Additively.

Do not:

```text
delete historical stages
silently renumber stages
collapse evidence closure into implementation history incorrectly
rewrite previous SHAs
mark deferred capabilities implemented
invent a new architecture
```

Preserve the roadmap's current formatting and status conventions.

---

# 30. Determine canonical NEXT

After synchronization, derive exactly one:

```text
NEXT: <existing or correctly derived canonical stage>
```

Use:

```text
roadmap ordering
dependency graph
completed stages
already-planned future work
discovered gaps
```

Do not choose based only on the most recently discovered gap.

---

# 31. If multiple candidates exist

If the roadmap genuinely contains multiple branches, report:

```text
PRIMARY NEXT:
<one stage>

REGISTERED FOLLOW-UP:
<Activity / Notes / Analytics etc.>
```

There must still be one authoritative `PRIMARY NEXT`.

Do not start it.

---

# 32. No automatic new numbering

Do not invent:

```text
3.6E
3.6F
3.7
```

solely because the previous stage was 3.6D.

Use existing roadmap numbering where present.

If a new stage truly must be inserted because the roadmap has no slot, first document why existing stages cannot contain it.

Prefer preserving roadmap numbering.

---

# 33. Completion status rules

Step 3.6D may be marked completed only with verified:

```text
2175e0f
```

and evidence closure.

Step 3.6D.1 may be marked:

```text
EVIDENCE CLOSED / VERDICT A
```

or equivalent existing roadmap terminology.

Do not pretend it introduced production code if it did not.

---

# 34. Required final report

## A. Verdict

Only:

```text
VERDICT A — CANONICAL ROADMAP SYNCHRONIZED AFTER 3.6D / 3.6D.1
```

or:

```text
VERDICT B — ROADMAP SYNCHRONIZATION NOT CLOSED
```

---

## B. Repository evidence

```text
Starting HEAD:
Roadmap-sync Final HEAD:
origin/master:
HEAD == origin/master:
git status:
```

No placeholders.

---

## C. Roadmap sections changed

List exact sections/headings.

---

## D. Step 3.6D canonical record

Show:

```text
status
SHA
actual production delta
runtime closure
tests
```

---

## E. Step 3.6D.1 canonical record

Explicitly state:

```text
evidence closure
production changes: NONE
```

if that remains true.

---

## F. Partner CRM final capability matrix

Show exact:

```text
Marketplace Basic
Storefront Pro
```

capabilities after 3.6D.

Do not include deferred Activity/Analytics as implemented.

---

## G. Discovered follow-up gaps

Show:

```text
Partner CRM Activity
Partner Operational Notes
Partner Analytics
```

For each:

```text
current state
roadmap destination
status
```

---

## H. Deferred architecture preservation

Confirm status of:

```text
Marketplace communication moderation
Workforce
Supplier/Procurement
Payout UI
first-party TravelHub seller
Product.partnerId NOT NULL
```

---

## I. Canonical NEXT

Return:

```text
NEXT: <stage id + exact title>
```

Then explain briefly:

1. why it is next according to the roadmap;
2. which dependencies are already closed;
3. why discovered follow-up gaps are or are not part of it.

Do not implement NEXT.

---

## J. Git evidence

Final post-commit/push evidence.

Do not report unrelated working-tree changes as clean.

---

# 35. Hard closure gates

`VERDICT A` is forbidden unless:

```text
[ ] canonical roadmap inspected before editing
[ ] Step 3.6D SHA 2175e0f verified
[ ] Step 3.6D recorded as completed
[ ] Step 3.6D.1 evidence closure recorded
[ ] 3.6D.1 not falsely represented as production implementation
[ ] Basic capability accurately recorded
[ ] Pro capability accurately recorded
[ ] Customer/PCR distinction preserved
[ ] tenant isolation preserved
[ ] Platform / Partner CRM isolation preserved
[ ] RU/AZ/EN closure recorded
[ ] Activity gap registered
[ ] Operational Notes gap registered
[ ] Analytics gap registered
[ ] no new PARTNER permissions granted
[ ] no discovered gap falsely marked implemented
[ ] prior 3.6A–3.6C.1 architecture preserved
[ ] deferred architecture preserved
[ ] roadmap searched for existing destination of discovered gaps
[ ] no silent renumbering
[ ] exactly one canonical NEXT identified
[ ] NEXT not automatically implemented
[ ] roadmap sync committed/pushed
[ ] final Git evidence has no placeholders
[ ] unrelated working-tree changes accurately reported
```

Any failed mandatory gate:

```text
VERDICT B — ROADMAP SYNCHRONIZATION NOT CLOSED
```

---

# 36. Expected result

After synchronization, the canonical roadmap must accurately state:

```text
Partner CRM UI
→ implemented and runtime-proven

Marketplace Basic
→ limited marketplace customer context

Storefront Pro
→ supported full Partner CRM surface

Partner Activity
→ unresolved/deferred capability gap

Partner Operational Notes
→ unresolved/deferred decision

Partner Analytics
→ unresolved/deferred implementation gap
```

and identify exactly one dependency-correct canonical next stage.

Do not begin the next stage.

Return the roadmap synchronization report and wait for approval.
