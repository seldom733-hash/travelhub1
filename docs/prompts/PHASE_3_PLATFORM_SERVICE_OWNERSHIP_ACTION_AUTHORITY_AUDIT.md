# PHASE 3 — PLATFORM SERVICE OWNERSHIP / ACTION AUTHORITY AUDIT

## MODE

**AUDIT ONLY — NO PRODUCTION CHANGES.**

Do not remove buttons, change routes, modify RBAC, change schema, migrate data, or refactor service creation in this stage.

The purpose of this audit is to establish the actual current ownership and action authority for commercial Services in TravelHub before remediation.

---

# 1. Business decision to validate against implementation

The intended architecture is:

```text
PLATFORM WORKSPACE
= TravelHub Marketplace Operator

PARTNER WORKSPACE
= Commercial Seller / Service Owner
```

Canonical target rule:

```text
Commercial Service
        ↓
must belong to a Partner / seller
```

Platform should manage marketplace governance:

```text
view
search/filter
moderate
approve/reject
publish/unpublish where authorized
suspend/restore where authorized
audit
policy enforcement
```

Platform should **not** create a commercial Service as a seller merely because the actor is a Platform employee.

If TravelHub itself wants to sell commercial services, the intended model is:

```text
TravelHub Platform
      ↓
creates/registers a TravelHub-owned Partner entity
      ↓
TravelHub-owned Partner
      ↓
Partner Workspace
      ↓
creates and sells Services under normal Partner ownership
```

Do not introduce a special:

```text
Platform-as-Seller
sellerPartnerId = null
sellerType = PLATFORM
```

model unless the repository/canonical architecture already explicitly requires it. If such a model currently exists, report it as evidence rather than silently changing it.

---

# 2. Primary question

Determine exactly what the current Platform UI action:

```text
"Create Service" / "Создать услугу"
```

does.

Trace the complete path:

```text
Platform button
   ↓
frontend route/modal/form
   ↓
API client
   ↓
backend endpoint
   ↓
controller
   ↓
service/domain method
   ↓
database write
   ↓
owner / seller / partner attribution
```

Answer:

> Can a Platform user currently create a commercial Service without a canonical Partner owner?

Do not infer. Prove from code and, where safe, runtime/API evidence.

---

# 3. Repository discovery

Locate all relevant Service/Product/Catalog models and terminology.

Search for concepts such as:

```text
Service
Product
Catalog
Listing
Tour
Accommodation
Activity
Transfer
sellerPartnerId
partnerId
ownerId
providerId
supplierId
createdBy
workspace
```

Report which entity is the canonical sellable object.

Do not assume the UI term "Service" maps to a backend entity named `Service`.

Build an evidence table:

| Concept | Actual model/file | Ownership field | Required? | Notes |
|---|---|---|---:|---|

---

# 4. Data ownership audit

For the canonical commercial sellable entity, establish:

1. What field identifies the seller/owner?
2. Is that field required or nullable?
3. Is it a real FK/relation or only a scalar ID?
4. Can rows exist without a Partner?
5. Do rows currently exist without a Partner?
6. Are there legacy ownership models?
7. Does Platform itself have a Partner record?
8. Is there already any TravelHub-owned Partner concept?

Run DB evidence where possible.

Required counts:

```text
total commercial services
services with partner/seller owner
services without partner/seller owner
services with invalid/nonexistent partner owner
```

If multiple service types/tables exist, report each separately.

---

# 5. Platform Create Service UI audit

Find every Platform-side creation entry point, not only the obvious button.

Check:

```text
primary Create Service button
empty-state CTA
context menus
bulk/action menus
keyboard shortcuts
direct create route
modal query state
deep links
dashboard quick actions
Catalog page
Service detail page
other Platform operational centers
responsive/mobile menus
```

For each, report:

| Platform entry point | File | Visible to roles | Target action/API | Current owner semantics |
|---|---|---|---|---|

Do not remove anything during this audit.

---

# 6. Partner Create Service audit

Trace the Partner Workspace creation flow separately.

Determine:

```text
Marketplace Basic → can create Service?
Storefront Pro     → can create Service?
```

and identify the entitlement/capability/permission rules.

For Partner creation prove:

```text
authenticated Partner
   ↓
active partner/workspace context
   ↓
Create Service
   ↓
seller/owner derived server-side
   ↓
Service.partnerId / sellerPartnerId
```

Critical security question:

> Can a Partner client submit another Partner's ID and create a Service for that Partner?

Owner authority should preferably be derived from authenticated workspace/context rather than trusted from arbitrary request payload.

Report actual behavior.

---

# 7. Backend endpoint authority

Inventory every endpoint capable of creating a commercial Service/Product/Listing.

For each endpoint report:

```text
method + route
controller
permission
workspace restriction
entitlement restriction
accepted owner fields
server-derived owner fields
who can call it
```

Example table:

| Endpoint | Platform | Basic | Pro | Owner supplied by client? | Owner server-derived? |
|---|---:|---:|---:|---:|---:|

Identify any bypass where:

```text
Platform UI button removed
BUT
Platform user can still call generic create endpoint
```

or:

```text
Partner can forge sellerPartnerId
```

Do not fix in this audit. Record exact remediation requirement.

---

# 8. RBAC / permission audit

Identify permissions involved in:

```text
service.read
service.create
service.update
service.delete
service.moderate
service.approve
service.publish
service.suspend
```

Use actual repository names.

Determine whether the current permission model incorrectly conflates:

```text
seller mutation
```

with:

```text
platform moderation/governance
```

For example, identify whether one generic permission currently lets Platform staff both moderate and create.

Target conceptual separation is:

```text
SELLER AUTHORITY
create/update own commercial offering

PLATFORM AUTHORITY
review/moderate/govern marketplace offering
```

Do not rename permissions in this audit; report the gap.

---

# 9. Platform operational authority

Determine what actions Platform legitimately needs over Partner Services.

Audit current implementation for:

```text
view
edit
moderate
approve
reject
publish
unpublish
suspend
restore
archive
delete
feature/promote
policy flags
audit/history
```

For each action classify:

```text
SELLER action
PLATFORM GOVERNANCE action
SHARED but semantically different
UNRESOLVED
```

Be careful with `edit`.

Platform may need moderation/correction authority, but that is not automatically equivalent to seller-owned content editing.

Report current behavior and recommended authority boundary.

---

# 10. Downstream ownership dependencies

Trace how Service ownership is used by:

```text
Orders
Bookings
Payments
Refunds
Payouts
Commissions
Partner CRM
CRM Activity
Analytics
Finance
Marketplace
Storefront
Reviews
Messages
```

Determine whether any downstream logic assumes:

```text
Service always has Partner owner
```

or supports:

```text
Service without Partner
```

Identify exact risks of allowing Platform-created ownerless Services.

Examples:

```text
Who receives payout?
Who owns order?
Which Partner sees booking?
Which CRM relationship is created?
Which analytics scope receives revenue?
Which Partner receives customer relationship?
```

Do not modify downstream systems.

---

# 11. Order ownership reconciliation

Because Step 3.6A established Marketplace PCR attribution from:

```text
Order.customerId
+
Order.sellerPartnerId
```

verify how a Service ultimately contributes to:

```text
Order.sellerPartnerId
```

Trace:

```text
Service owner
   ↓
cart/order item
   ↓
Order.sellerPartnerId
   ↓
Partner CRM attribution
```

Answer:

> Could a Platform-created Service produce an Order without a valid `sellerPartnerId`, or with ambiguous seller attribution?

This is a critical gate.

---

# 12. TravelHub selling its own services

Search repository/data for any existing mechanism representing TravelHub as a commercial seller.

Check for:

```text
system partner
platform partner
internal partner
TravelHub partner
first-party seller
owned partner
merchant account
```

If none exists, report:

```text
NO CURRENT FIRST-PARTY SELLER MODEL
```

Do not create one.

Evaluate whether the existing Partner model is technically capable of representing:

```text
Partner
  ownership = TravelHub/company-controlled
```

without special Service ownership rules.

The preferred future architecture is:

```text
TravelHub wants to sell
        ↓
normal Partner entity
        ↓
normal Partner Workspace
        ↓
normal Service ownership
        ↓
normal Orders/Bookings/Finance
```

Report any blockers.

---

# 13. Current data evidence

Provide representative records for:

```text
Service → Partner
Service → Order
Order → sellerPartnerId
Partner → Service count
```

Use business-readable identifiers where available.

Do not expose secrets or sensitive personal data.

If ownerless Services exist, classify why:

```text
seed/test
legacy
production-like
system object
unknown
```

---

# 14. Runtime/browser audit

If the application is available, verify actual behavior in runtime.

## Platform

```text
login Platform role
→ open Catalog/Services
→ confirm Create Service action exists or not
→ inspect route/form
→ determine required owner fields
```

If safe in isolated/test data, create a temporary Service and inspect resulting ownership.

Do not pollute shared/prod-like data unnecessarily.

## Marketplace Basic

```text
login Basic Partner
→ determine whether Create Service is available
→ verify entitlement/permission
```

## Storefront Pro

```text
login Pro Partner
→ determine whether Create Service is available
→ verify resulting owner
```

Runtime evidence outranks assumptions from UI source code.

---

# 15. Architecture decision matrix

Produce a final matrix based on evidence:

| Action | Platform | Marketplace Basic | Storefront Pro | Authority |
|---|---:|---:|---:|---|
| View marketplace Services | ? | ? | ? | |
| Create commercial Service | target ❌ | ? | ? | Seller |
| Edit own Service | N/A | ? | ? | Seller |
| Moderate Service | target ✅ | ❌ | ❌ | Platform |
| Approve/reject | target ✅ if workflow exists | ❌ | ❌ | Platform |
| Suspend for policy | target ✅ if workflow exists | ❌ | ❌ | Platform |
| Delete seller Service | investigate | ? | ? | |
| Publish own Service | N/A | ? | ? | Seller |

Use actual entitlement architecture when filling Basic vs Pro.

Do not invent capabilities that do not exist.

---

# 16. Required GAP classification

Classify findings:

```text
P0 — ownership/security/data-integrity blocker
P1 — wrong Platform/Partner action authority
P2 — UX/RBAC cleanup
DEFERRED — valid future architecture item
```

At minimum explicitly assess:

```text
Platform Create Service UI
Platform create API authority
ownerless Service possibility
Partner owner spoofing
seller/moderator permission conflation
TravelHub-owned Partner support
```

---

# 17. Expected remediation direction

Do not implement it yet, but state whether evidence supports the following remediation:

```text
Platform Workspace
→ remove Create Service seller action
→ preserve governance/moderation actions

Partner Workspace
→ preserve Create Service according to entitlement/permission
→ owner derived from Partner context

TravelHub first-party sales
→ use TravelHub-owned Partner
→ no special Platform-as-Seller Service path
```

If repository evidence contradicts any part, explain exactly why.

---

# 18. No premature changes

During this audit:

```text
NO UI removal
NO API removal
NO schema migration
NO data migration
NO permission rewrite
NO route rewrite
NO service ownership rewrite
NO roadmap renumbering
```

Only evidence gathering and architecture recommendation.

---

# 19. Required final report

Return:

## A. Verdict

Use:

```text
VERDICT A — CURRENT IMPLEMENTATION ALREADY MATCHES TARGET
```

or:

```text
VERDICT B — REMEDIATION REQUIRED
```

A `VERDICT B` is expected if Platform currently has seller creation authority inconsistent with the approved operator model.

## B. Canonical sellable entity

Exact model/table and ownership fields.

## C. Platform Create Service trace

```text
UI → API → backend → DB
```

## D. Partner Create Service trace

Basic and Pro separately.

## E. Ownership integrity

Exact DB counts.

## F. API/RBAC authority

Exact endpoints + permissions + workspace/entitlement gates.

## G. Downstream impact

Orders, Bookings, Finance, CRM, Analytics.

## H. TravelHub-owned Partner feasibility

Can existing Partner architecture represent TravelHub as seller without Platform-as-Seller?

## I. Runtime evidence

Platform / Basic / Pro.

## J. GAP list

P0/P1/P2/DEFERRED.

## K. Recommended remediation

Exact minimal changes only.

## L. Git evidence

Because this is audit-only:

```text
Starting HEAD
Final HEAD
origin/master
git status
Production changes: NONE
```

---

# 20. Closure rule

This audit is complete only when we can answer with evidence:

```text
1. Who owns every commercial Service?
2. Can Platform create one?
3. Can Service exist without Partner?
4. Can Partner spoof ownership?
5. What server endpoint authorizes creation?
6. What permissions distinguish seller actions from moderation?
7. How does Service ownership reach Order.sellerPartnerId?
8. Can TravelHub sell through an ordinary TravelHub-owned Partner?
9. Exactly what must be changed next?
```

Do **not** start remediation automatically after the audit.

Return the report and wait for approval.
