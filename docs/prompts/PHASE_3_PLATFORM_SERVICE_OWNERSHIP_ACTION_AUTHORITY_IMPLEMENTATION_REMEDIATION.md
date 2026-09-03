# PHASE 3 — PLATFORM SERVICE OWNERSHIP / ACTION AUTHORITY — IMPLEMENTATION & REMEDIATION

## STATUS

**Implementation / remediation prompt.**

This prompt follows the completed audit:

`PHASE 3 — PLATFORM SERVICE OWNERSHIP / ACTION AUTHORITY AUDIT`

Audit verdict:

```text
VERDICT B — REMEDIATION REQUIRED
```

This stage is no longer an audit.

Implement the approved Platform-vs-Partner ownership boundary, prevent future ownerless commercial Products, preserve legitimate Partner creation, classify legacy ownerless data safely, and provide DB/API/runtime/security evidence before closure.

---

# 1. Confirmed audit baseline

The audit established:

```text
Canonical sellable model:
catalog.Product

Ownership:
Product.partnerId String?   // currently nullable

Current DB:
Total Products:            282
With partnerId:            251
Without partnerId:          31

Orders from ownerless Products: 26
sellerPartnerId on those Orders: ALL NULL
```

Current Platform path:

```text
Platform ADMIN
  ↓
Catalog Center
  ↓
"Create Product"
  ↓
POST /api/v1/products
  ↓
CatalogController.createProduct()
  ↓
CatalogService.createProduct()
  ↓
partnerId = NULL
```

Confirmed downstream impact of ownerless commercial Products:

```text
sellerPartnerId = NULL
commission accrual = 0
Partner CRM attribution = absent
Partner Analytics attribution = absent
Partner payout = absent
seller ownership = ambiguous
```

Partner path is already materially safer:

```text
Partner
  ↓
Create Product
  ↓
partnerId derived server-side from actor.partnerId
```

Client-supplied foreign `partnerId` is ignored for Partner actors.

Preserve this authority.

---

# 2. Approved architecture

TravelHub has two distinct commercial authorities:

```text
PLATFORM WORKSPACE
= Marketplace Operator / Governance Authority

PARTNER WORKSPACE
= Commercial Seller / Product Owner
```

Canonical commercial ownership:

```text
Commercial Product
        ↓
must have canonical Partner seller/owner
        ↓
Product.partnerId
```

Platform must not become a seller merely because an ADMIN/staff user creates a Product.

Target:

```text
PLATFORM
├── View Products
├── Search / Filter
├── Moderate
├── Review
├── Publish / Unpublish where canonical
├── Suspend / Restore where canonical
├── Archive where governance semantics justify it
├── Audit / Policy enforcement
└── NO commercial Product creation as Platform
```

```text
PARTNER
├── Create own Product
├── Update own Product according to state/permission
├── Manage own commercial content
└── Product.partnerId = authenticated Partner context
```

---

# 3. TravelHub first-party sales rule

Do not introduce a special:

```text
Platform-as-Seller
```

model.

Do not use:

```text
partnerId = NULL
```

to mean:

```text
seller = TravelHub
```

If TravelHub later sells its own commercial services:

```text
TravelHub
   ↓
TravelHub-owned Partner
   ↓
Partner Workspace
   ↓
normal Product ownership
   ↓
normal Orders / Bookings / Finance / CRM / Analytics
```

The audit confirmed the existing Partner model can represent this without a special Product ownership path.

**Do not create a TravelHub-owned Partner in this remediation merely to absorb legacy records.**

It should be created only when a real first-party seller business requirement exists.

---

# 4. P0 — Remove Platform Create Product UI

Remove the commercial Product creation action from Platform Workspace.

Expected result:

```text
Platform Workspace
→ Catalog / Services / Products
→ "Create Product" / "Создать продукт" / "Создать услугу"
→ ABSENT
```

Audit all Platform entry points:

```text
primary create button
empty-state CTA
quick actions
context menus
responsive/mobile menu
direct create route
query-triggered modal
keyboard shortcut
dashboard action
deep link
```

Do not leave another Platform UI path that provides the same seller creation capability.

Legacy Platform create routes must fail safely or redirect according to current frontend architecture.

Do not break Partner Workspace create routes.

---

# 5. P0 — Server-side future-write authority

Removing the button is not sufficient.

The server must prevent a normal Platform actor from creating an ownerless commercial Product.

Current invalid behavior:

```text
ADMIN
→ POST /products
→ partnerId absent
→ Product.partnerId = NULL
→ SUCCESS
```

Required behavior:

```text
Platform actor
→ normal commercial Product creation
→ DENY
```

unless the call is a clearly identified non-commercial system/test/seed mechanism that is intentionally separated from the user-facing production authority.

Do not keep an ADMIN bypass that allows ownerless commercial Product creation merely because the UI button is hidden.

---

# 6. Product owner authority

For Partner-originated commercial creation:

```text
Authenticated Partner
        ↓
resolve active Partner workspace/context
        ↓
create Product
        ↓
Product.partnerId = actor.partnerId
```

The server is authoritative.

Mandatory invariant:

```text
request.partnerId cannot override authenticated Partner scope
```

Test:

```text
Partner A
→ POST create Product with partnerId = Partner B
→ resulting Product belongs to Partner A
   OR request is rejected according to canonical API behavior
→ NEVER Partner B
```

Preserve existing anti-spoofing behavior.

---

# 7. Commercial Product invariant

The desired domain invariant is:

```text
Every NEW commercial Product must have a valid Partner owner.
```

For new production writes:

```text
new Product.partnerId = NULL
→ forbidden
```

Do not immediately convert the Prisma field to non-null solely because this target exists.

There are 31 legacy ownerless Products and 26 related Orders.

Schema hardening is allowed only after legacy classification/remediation proves it is safe.

---

# 8. P0 — Legacy ownerless Product classification

The existing 31 ownerless Products must **not** be assigned to a Partner arbitrarily.

Do not automatically assign them to:

```text
TravelHub
ADMIN
first Partner
seed Partner
nearest Partner
```

First classify every ownerless Product.

Required categories:

```text
TEST / SEED
LEGACY BUSINESS DATA
SYSTEM / NON-COMMERCIAL
UNKNOWN
```

For each ownerless Product determine, where evidence exists:

```text
Product business code/title
createdAt
createdBy / audit actor if available
Product type
related Orders
related Bookings
related Payments
related commission snapshot
possible seller evidence
seed/test provenance
environment/data provenance
```

Produce an exact classification table or machine-readable report.

---

# 9. The 26 legacy Orders are protected evidence

Do not rewrite historical seller ownership without evidence.

For the 26 Orders derived from ownerless Products:

```text
Order.sellerPartnerId = NULL
```

Do not retroactively set a seller unless there is deterministic evidence of the actual seller.

Changing historical seller attribution can alter:

```text
commission
payout
Partner revenue
CRM attribution
analytics
financial reporting
```

Therefore:

```text
NO GUESSING
NO BULK ASSIGNMENT TO TRAVELHUB
NO SILENT FINANCIAL REWRITE
```

If records are proven test/seed data in a disposable environment, handle them according to existing test/seed cleanup conventions.

If records represent legitimate historical business data but ownership cannot be proven, preserve them and report them as legacy exceptions.

---

# 10. Legacy remediation strategy

After classification, choose the smallest safe action per category.

## TEST / SEED

If conclusively test/seed and safe to clean in the relevant environment:

```text
clean/reseed according to existing project conventions
```

Do not delete shared/prod-like data just to make a metric zero.

## LEGACY BUSINESS DATA with deterministic owner evidence

If exact owner can be proven from canonical evidence:

```text
backfill Product.partnerId
```

and assess whether related:

```text
Order.sellerPartnerId
commission
CRM
analytics
payout
```

require separate reconciliation.

Do not perform financial rewrites without explicit evidence and a defined remediation path.

## UNKNOWN / unresolved

Preserve record.

Mark/report as legacy exception.

Future writes must still be fixed even if legacy records remain.

---

# 11. P1 — Separate seller mutation from Platform governance

Audit found:

```text
catalog.product.write
```

currently conflates:

```text
seller mutation
+
Platform moderation/governance
```

Correct this authority boundary.

Reuse existing permission taxonomy where possible.

Do not invent unnecessary parallel permissions if suitable granular permissions already exist.

Conceptual target:

```text
SELLER AUTHORITY

catalog.product.create_own
catalog.product.update_own_draft
...
```

versus:

```text
PLATFORM GOVERNANCE

catalog.product.moderate
catalog.product.publish
catalog.product.archive
catalog.product.suspend
...
```

Actual names must follow repository conventions.

Critical rule:

```text
Platform governance permission
≠
commercial seller creation permission
```

A Platform moderator should not gain seller authority as a side effect of being able to publish/archive Products.

---

# 12. Existing publish/archive semantics

Before changing permissions, inspect current semantics of:

```text
POST /products/:id/publish
POST /products/:id/archive
PATCH /products/:id
```

Determine whether each is:

```text
Partner seller action
Platform governance action
shared action with different authority
```

Preserve legitimate workflows.

Do not blindly move every Product mutation to Partner.

For shared operations, enforce distinct authorization paths if needed.

---

# 13. Marketplace Basic vs Storefront Pro

The audit established that both current Partner tiers can create Products and no Product-create tier gate currently exists.

Do **not** change this merely because this remediation is touching Product authority.

Current stage assumption:

```text
Marketplace Basic → Product creation allowed according to existing capability/permission
Storefront Pro     → Product creation allowed according to existing capability/permission
```

If canonical roadmap explicitly contradicts this, report it before changing entitlement behavior.

Tier redesign is out of scope.

---

# 14. System / seed creation paths

The audit recommended retaining backend create functionality for possible system/test flows.

Do not use the same unrestricted production ADMIN path as a substitute for a seed/test mechanism.

Discover actual seed/test creation paths.

If tests/seeds need ownerless Products:

1. determine whether they truly need ownerless commercial Products;
2. preferably seed a valid Partner owner;
3. keep test-only bypasses isolated from production runtime authority.

Target:

```text
production API
→ cannot create ownerless commercial Product

test/seed fixture
→ explicit isolated mechanism if genuinely required
```

Do not weaken production authorization for test convenience.

---

# 15. API behavior

Inventory every create-capable endpoint discovered by the audit.

For each ensure final authority is explicit.

Required conceptual matrix:

| Actor/context | Create Product | Owner |
|---|---:|---|
| Platform ADMIN | ❌ seller creation | N/A |
| Platform moderator | ❌ seller creation | N/A |
| Marketplace Basic Partner | ✅ if current capability permits | actor.partnerId |
| Storefront Pro Partner | ✅ if current capability permits | actor.partnerId |
| Anonymous | ❌ | N/A |
| Customer | ❌ | N/A |
| isolated seed/test mechanism | only if explicitly justified | explicit controlled fixture |

No user-facing Platform endpoint/path may create:

```text
partnerId = NULL
```

commercial Products.

---

# 16. Downstream integrity

Verify after remediation that new Partner Products propagate seller ownership correctly:

```text
Product.partnerId
   ↓
quote/cart snapshot
   ↓
Order.sellerPartnerId
   ↓
Commission
   ↓
Partner CRM attribution
   ↓
Partner Analytics
   ↓
Payout
```

Use actual repository path names.

At minimum prove:

```text
new Partner Product has partnerId
new Order from it has sellerPartnerId
Marketplace PCR attribution can resolve Partner
```

Do not modify Step 3.6A CRM attribution unless a genuine regression is found.

---

# 17. Hard future-write gate

Create a deterministic regression test proving:

```text
ownerless commercial Product cannot be created through production runtime authority
```

The exact expected response may be:

```text
403
400
422
```

depending on architecture.

Choose the semantically correct existing exception convention.

Do not return an accidental 500.

---

# 18. Required tests

At minimum cover:

## Platform authority

```text
1. Platform ADMIN attempts normal Product create
   → denied

2. Platform moderator attempts Product create
   → denied

3. Platform governance actions still work according to permission

4. Platform without governance permission
   → governance action denied
```

## Partner ownership

```text
5. Marketplace Basic Partner creates Product
   → Product.partnerId = actor.partnerId

6. Storefront Pro Partner creates Product
   → Product.partnerId = actor.partnerId

7. Partner A submits Partner B partnerId
   → cannot create Product owned by Partner B

8. Partner without create permission
   → denied
```

## Ownership

```text
9. New production Product with null partnerId
   → impossible through normal API authority

10. New Partner Product → Order
    → Order.sellerPartnerId = Product.partnerId
```

## Regression

```text
11. Existing Catalog read works

12. Platform moderation/publish/archive workflows remain valid

13. Partner Product create/edit still works

14. Step 3.6A Marketplace PCR attribution remains green
```

---

# 19. DB integrity evidence

Before remediation capture:

```text
total Products
Products with partnerId
Products without partnerId
Orders linked to ownerless Products
Orders with sellerPartnerId NULL from those Products
```

After remediation capture the same.

Do not claim:

```text
ownerless Products = 0
```

unless legacy records were safely and legitimately resolved.

The mandatory closure invariant is instead:

```text
NEW ownerless commercial Product creation path = 0
```

and:

```text
all unresolved legacy exceptions are classified and documented
```

If safe cleanup resolves all 31, report exact evidence.

---

# 20. Browser/runtime verification

Tests alone are insufficient.

## Platform

Login as Platform role with Catalog access.

Verify:

```text
Catalog loads
Create Product action absent
no empty-state Create CTA
no quick-action Create
direct Platform create route unavailable/safe
existing moderation/governance actions still available according to RBAC
```

## Marketplace Basic

Verify:

```text
Partner Products page loads
Create Product available if canonical current entitlement allows it
Product created
Product.partnerId = authenticated Partner
```

## Storefront Pro

Verify:

```text
Partner Products page loads
Create Product available
Product created
Product.partnerId = authenticated Partner
```

## Ownership spoof attempt

Use API/runtime evidence:

```text
Partner A submits Partner B ID
→ Partner B ownership not created
```

---

# 21. Localization

Removing Platform Create Product must not leave:

```text
raw i18n keys
orphan labels
broken layout
```

Verify Platform Catalog in:

```text
RU
AZ
EN
```

Do not remove Partner-side translations required by Partner Workspace create flows.

---

# 22. Security

Mandatory principle:

```text
hidden UI action ≠ server denial
```

Provide direct API evidence that a Platform actor cannot bypass the UI and create an ownerless Product.

Also prove Partner scope isolation.

Required:

```text
Platform seller create bypass → DENIED
Partner ownership spoof → DENIED/IGNORED safely
Cross-partner mutation → DENIED
```

---

# 23. No automatic TravelHub Partner creation

Do not create:

```text
TravelHub Platform Partner
TravelHub Seller
System Partner
```

as part of this remediation unless a current business requirement explicitly requires first-party sales.

The architecture is merely being made ready for:

```text
future TravelHub-owned Partner
```

through the ordinary Partner model.

No fake owner should be introduced to make integrity statistics look clean.

---

# 24. Schema hardening decision

After legacy classification, explicitly answer:

> Can `Product.partnerId` safely become non-null in a future migration?

Possible outcomes:

```text
READY
```

All legitimate Products have canonical Partner ownership and legacy data can be safely reconciled.

or:

```text
NOT READY
```

Some legacy/system semantics still depend on nullable ownership.

Do not force the migration in this stage unless all evidence supports it and the change is clearly safe.

If NOT READY, server-side future-write enforcement is still mandatory.

---

# 25. Existing history preservation

Do not regress:

```text
Step 3.6A Marketplace PCR auto-attribution
first-source preservation
CRM source contract
STOREFRONT source
Platform Create Customer removal
CRM Analytics reconciliation
Operational Notes
CRM Activity
Customer/Partner 360
related-entity readable labels
RU/AZ/EN
```

Run relevant regression suites.

---

# 26. Git discipline

Before changes:

```text
git status
git rev-parse HEAD
git rev-parse origin/master
```

Expected starting baseline from audit:

```text
cf582c6
```

Verify rather than assume.

After implementation:

```text
git status
git rev-parse HEAD
git rev-parse origin/master
git log --oneline -n 10
```

Do not claim `HEAD == origin/master` unless verified.

---

# 27. Required final report

Return the following.

## A. Verdict

Only:

```text
VERDICT A — FULLY CLOSED
```

or:

```text
VERDICT B — NOT CLOSED
```

No conditional A.

---

## B. Changed files

Exact paths and purpose.

---

## C. Platform Create Product

Show:

```text
UI removed
direct route behavior
API bypass behavior
server-side denial
```

---

## D. Product ownership authority

Show:

```text
Partner create path
owner derivation
anti-spoofing
```

---

## E. Permission separation

Provide final matrix:

```text
permission
actor
action
scope
```

Explain how seller mutation is separated from Platform governance.

---

## F. Legacy classification

Exact counts:

```text
ownerless Products total
TEST/SEED
LEGACY BUSINESS
SYSTEM/NON-COMMERCIAL
UNKNOWN
```

For the 26 Orders:

```text
classified
resolved
preserved unresolved
financial data changed: YES/NO
```

---

## G. DB before/after

Example:

```text
BEFORE
Products total:
with partner:
without partner:
ownerless-linked Orders:

AFTER
Products total:
with partner:
without partner:
ownerless-linked Orders:
```

If legacy exceptions remain, list exact reason.

---

## H. Future-write proof

Demonstrate:

```text
Platform POST /products → denied
new production Product with partnerId NULL → impossible
```

---

## I. Downstream proof

Demonstrate one valid flow:

```text
Partner Product.partnerId = X
Order.sellerPartnerId = X
CRM attribution resolves X
```

---

## J. Tests

Exact commands/results:

```text
Catalog tests:       X/X PASS
CRM tests:           X/X PASS
Analytics tests:     X/X PASS
Frontend tests:      X/X PASS
Backend TSC:         PASS
Frontend TSC:        PASS
```

Do not write only "tests pass."

---

## K. Browser/runtime

Evidence for:

```text
Platform
Marketplace Basic
Storefront Pro
RU
AZ
EN
```

---

## L. Schema hardening recommendation

Exactly one:

```text
Product.partnerId NOT NULL — READY
```

or:

```text
Product.partnerId NOT NULL — NOT READY
```

with evidence.

---

## M. Git

```text
Starting HEAD:
Final HEAD:
origin/master:
git status:
```

---

# 28. Closure gates

`VERDICT A` is allowed only when all are true:

```text
[ ] Platform Create Product UI removed
[ ] all duplicate Platform create entry points removed
[ ] Platform cannot bypass UI via production API
[ ] new ownerless commercial Product creation blocked server-side
[ ] Partner creation still works
[ ] Partner owner derived from authenticated scope
[ ] cross-partner ownership spoof impossible
[ ] Platform governance actions preserved
[ ] seller mutation and Platform governance authority separated
[ ] 31 legacy ownerless Products classified
[ ] 26 affected Orders classified/preserved safely
[ ] no legacy seller assigned by guess
[ ] no fake TravelHub Partner created
[ ] downstream seller propagation verified
[ ] Step 3.6A CRM attribution regression passes
[ ] RU/AZ/EN runtime verified
[ ] test suites pass
[ ] Git evidence complete
```

If any mandatory gate fails:

```text
VERDICT B
```

with the exact blocker.

---

# 29. Explicit non-goals

Do not implement:

```text
Chat moderation
Marketplace communication architecture
first-party TravelHub sales launch
new subscription tiers
Partner entitlement redesign
broad Catalog redesign
financial history rewrite without evidence
automatic ownership guessing
unrelated CRM changes
```

---

# 30. Expected final architecture

```text
                     TRAVELHUB
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ↓                           ↓
 PLATFORM WORKSPACE             PARTNER WORKSPACE
 Marketplace Operator           Commercial Seller
          │                           │
          │                    Create Product
          │                           │
          │                    Product.partnerId
          │                           │
          │                           ↓
          │                       Partner
          │
          ├─ View
          ├─ Moderate
          ├─ Publish / governance
          ├─ Suspend / policy
          └─ NO seller Create Product
```

Future first-party TravelHub sales:

```text
TravelHub-owned Partner
        ↓
Partner Workspace
        ↓
Product.partnerId = TravelHub-owned Partner
```

No special Platform-as-Seller path.

No new ownerless commercial Products.

Do not proceed to the next stage until runtime and server authority prove this boundary.
