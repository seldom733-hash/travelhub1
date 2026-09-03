# PHASE 3 — PLATFORM WORKSPACE ACTION AUTHORITY AUDIT

## MODE

**AUDIT ONLY — NO PRODUCTION CHANGES.**

Do not remove buttons, change routes, rewrite permissions, migrate data, alter schemas, or refactor business flows during this stage.

This audit follows the closure of:

```text
PHASE 3 — STEP 3.6A
Partner CRM Source / Entitlement

PHASE 3 — STEP 3.6B
Platform Service Ownership / Action Authority
```

Step 3.6B established the architectural boundary:

```text
PLATFORM WORKSPACE
= Marketplace Operator / Governance Authority

PARTNER WORKSPACE
= Commercial Seller / Business Owner
```

Now audit the remaining Platform Workspace actions so that seller/business-owner operations are not accidentally exposed to Platform staff.

---

# 1. Objective

Perform a complete action-authority audit of Platform Workspace.

The goal is to identify every user-facing and API-accessible action where Platform can currently:

```text
CREATE
EDIT
DELETE
CANCEL
CONFIRM
COMPLETE
PAY
REFUND
ASSIGN
FULFILL
```

or otherwise mutate a commercial/business object.

For every action determine:

```text
Is Platform acting as:
A. marketplace operator/governance authority
B. support/admin authority
C. financial/control authority
D. seller/business owner
E. ambiguous/legacy authority
```

Seller/business-owner authority must not exist in Platform merely because the actor is ADMIN.

---

# 2. Canonical principle

Use this rule throughout the audit:

```text
Object ownership
        ↓
determines business mutation authority
```

Platform may govern an object without owning the underlying business operation.

Examples:

```text
Partner creates Product
Platform moderates Product
```

```text
Customer creates/initiates Order
Partner fulfills Order
Platform observes/supports/disputes Order
```

```text
Partner handles Booking operationally
Platform monitors/supports/moderates Booking
```

Do not assume these examples are the exact current implementation. Verify repository and runtime behavior.

---

# 3. Audit scope

Audit at minimum:

```text
Catalog / Products / Services
Orders
Bookings
Payments
Refunds
Payouts
Customers
Partners
CRM
Reviews
Messages
Finance
Sales Center
Booking Center
Command Center quick actions
Dashboard actions
```

Also discover any additional Platform operational center containing mutations.

Do not limit discovery to left-sidebar pages.

---

# 4. Previously decided actions

Treat these as regression baselines.

## Platform Create Customer

Target/current approved result:

```text
Platform CRM → Create Customer = ABSENT
```

Backend endpoint may remain for justified system/admin dependencies, but Platform UI must not behave as a sales CRM.

Verify no regression.

## Platform Create Product

Target/current approved result:

```text
Platform Catalog → Create Product = ABSENT

Platform production API
→ ownerless commercial Product creation = DENIED
```

Verify no regression.

Do not reopen Step 3.6A/3.6B unless an actual regression is found.

---

# 5. Platform UI action inventory

For every Platform page, enumerate visible mutation actions.

Required table:

| Center/Page | Action | UI location | Object | Current permission | Expected authority class |
|---|---|---|---|---|---|

Include:

```text
primary buttons
row actions
detail-page actions
context menus
bulk actions
empty-state CTA
quick actions
dashboard cards
dropdown actions
responsive/mobile menus
keyboard shortcuts
direct create/edit routes
modal deep links
```

Do not assume absence from the main toolbar means the capability is absent.

---

# 6. Orders — priority audit

Determine exactly whether Platform currently has actions such as:

```text
Create Order
Edit Order
Confirm Order
Cancel Order
Complete Order
Assign Order
Change status
Change seller
Change customer
Add/remove Order items
Change amount
Apply discount
Mark paid
Refund
Delete
```

Trace each mutation:

```text
Platform UI
   ↓
API client
   ↓
endpoint
   ↓
permission
   ↓
service/domain method
   ↓
DB mutation
```

For each classify:

```text
SELLER OPERATION
PLATFORM SUPPORT
PLATFORM GOVERNANCE
FINANCIAL CONTROL
SYSTEM OPERATION
AMBIGUOUS
```

### Critical question

Can Platform manually create a normal commercial Order?

If YES, determine:

```text
customerId authority
sellerPartnerId authority
Product ownership authority
price authority
commission authority
payment authority
CRM attribution consequences
```

Do not remediate yet.

---

# 7. Order ownership

Establish canonical Order ownership semantics.

Inspect actual fields such as:

```text
customerId
sellerPartnerId
createdBy
source
channel
status
paymentStatus
```

Determine:

```text
Who initiates Order?
Who owns commercial fulfillment?
Who may change lifecycle state?
Who may cancel?
Who may administratively intervene?
```

Separate:

```text
business lifecycle mutation
```

from:

```text
support/admin override
```

If Platform requires override authority, it must be explicit and audited rather than equivalent to ordinary seller authority.

---

# 8. Bookings — priority audit

Audit Platform Booking Center for:

```text
Create Booking
Edit Booking
Confirm
Reject
Cancel
Complete
Reassign
Change dates
Change guests/passengers
Change Product/Service
Change Partner
Change price
Delete
```

Trace UI → API → permission → service → DB.

### Critical question

Can Platform create a normal commercial Booking on behalf of a Partner?

If YES, establish whether this is:

```text
legitimate support/admin operation
or
incorrect seller authority
```

Do not infer from button labels alone.

---

# 9. Booking ownership and Order relationship

Determine canonical topology:

```text
Order
  ↓
Booking
```

or whatever the repository actually implements.

Establish:

```text
Booking.partner/seller ownership
Booking.customer ownership
Order linkage
Product linkage
```

Determine whether Platform-created Booking can bypass:

```text
Order
sellerPartnerId
Product ownership
commission
payment
CRM attribution
```

Flag any bypass as P0/P1 according to impact.

---

# 10. Payments

Audit Platform payment actions:

```text
Create Payment
Mark Paid
Capture
Authorize
Void
Cancel
Retry
Edit amount
Change method
Delete
```

Classify each as:

```text
financial control
support
system/provider callback
seller operation
unsafe manual mutation
```

Critical questions:

```text
Can Platform fabricate a successful Payment?
Can Platform change paid amount manually?
Can Platform attach Payment to another Order?
Can Platform mark an unpaid Order paid without canonical provider/cash flow?
```

Do not assume manual payment actions are wrong: cash/offline payment workflows may legitimately require staff actions. Identify the actual business authority.

---

# 11. Refunds

Audit:

```text
Create Refund
Approve Refund
Reject Refund
Process Refund
Cancel Refund
Edit amount
Delete Refund
```

Determine who is financially authorized:

```text
Platform
Partner
payment provider/system
```

Separate:

```text
request refund
approve refund
execute refund
record refund
```

These may have different authorities.

---

# 12. Payouts

Audit Platform Payout actions:

```text
Create
Approve
Schedule
Process
Mark Paid
Cancel
Retry
Edit
Delete
```

Platform may legitimately own marketplace settlement/payout authority.

Do not remove legitimate operator finance controls.

Instead determine whether current permissions and UI correctly represent:

```text
Platform financial authority
```

rather than seller authority.

---

# 13. Partner management

Audit Platform actions over Partner entities:

```text
Create Partner
Invite Partner
Approve
Activate
Suspend
Deactivate
Edit legal/company data
Change entitlement
Delete
Impersonate/switch context if present
```

Unlike Customer/Product creation, **Create Partner may be a legitimate Platform administrative action**.

Do not classify all Platform create actions as invalid.

Determine business justification and current onboarding architecture.

---

# 14. Customer management

Verify Step 3.6A regression:

```text
Platform manual Create Customer UI = absent
```

Then audit remaining actions:

```text
Edit identity
Suspend
Block
Merge
Delete
Verify
Support notes
moderation/security flags
```

Classify them as:

```text
identity administration
support
security
privacy
sales CRM
```

Platform should not regain sales-CRM semantics through another action.

---

# 15. Reviews

Audit:

```text
Create Review
Edit Review
Delete Review
Hide
Moderate
Restore
Flag
```

Expected conceptual distinction:

```text
Customer → creates review
Platform → moderates review
```

If Platform can author normal customer reviews, flag it.

Administrative test/seed capability is not production authoring authority.

---

# 16. Messages

Do not implement chat moderation here.

Only audit current Platform actions:

```text
send message
edit message
delete message
hide message
read conversation
join conversation
moderate
block
```

Determine whether Platform can currently impersonate Customer/Partner communication.

Flag authority concerns.

Detailed automated moderation architecture remains a separate future stage.

---

# 17. Finance / Sales Center

Audit all Platform mutation actions inside:

```text
Sales Center
Finance Center
Analytics-linked actions
Command Center
```

Pay particular attention to actions that can:

```text
create revenue
change GMV
change commission
change payment state
change refund state
change payout state
change seller attribution
```

Any direct financial metric mutation requires explicit business authority.

---

# 18. Dashboard / quick-action audit

Search for Platform shortcuts that bypass normal center-level UI.

Examples:

```text
New Order
New Booking
New Product
New Customer
Add Payment
Create Refund
Create Partner
```

Trace every discovered quick action to its real endpoint.

A removed action from one page is not sufficient if Dashboard still exposes it.

---

# 19. API mutation inventory

Do not audit UI only.

Inventory production mutation endpoints for audited domains.

Required table:

| Domain | Method/route | Platform permission | Partner permission | Owner/scope authority | UI exposed? |
|---|---|---|---|---|---:|

Identify cases where:

```text
Platform UI action absent
but API still grants ordinary seller mutation
```

Distinguish legitimate support/system endpoints from accidental bypasses.

---

# 20. Permission taxonomy

Build a map of current permissions and classify each as:

```text
OWN
PLATFORM_GOVERNANCE
SUPPORT
FINANCE
SYSTEM
AMBIGUOUS
```

Look for conflated permissions similar to the previously discovered:

```text
catalog.product.write
```

which mixed seller mutation and Platform governance.

Examples to investigate:

```text
orders.write
bookings.write
payments.write
refunds.write
*.create
*.update
*.manage
```

Use actual repository names.

Do not rename anything in this audit.

---

# 21. Authority model

For each domain, derive:

```text
OWNER
OPERATOR
CUSTOMER
SYSTEM
```

Example conceptual matrix:

| Domain | Customer | Partner | Platform | System |
|---|---|---|---|---|
| Product | consume | seller/owner | moderate | automation |
| Order | initiate | fulfill | support/govern | workflow |
| Booking | participant | fulfill | support/govern | workflow |
| Payment | payer | beneficiary | financial oversight | provider |
| Refund | requester | commercial participant | financial governance | provider |
| Payout | — | recipient | settlement authority | provider |
| Review | author | subject/respondent | moderate | anti-abuse |
| Message | participant | participant | moderation/support | moderation engine |

This table is conceptual only.

Replace it with repository-supported conclusions.

---

# 22. Admin override semantics

Do not automatically eliminate Platform administrative overrides.

If Platform genuinely needs an emergency/support action, distinguish:

```text
normal business mutation
```

from:

```text
explicit administrative override
```

A proper override should ideally have:

```text
separate permission
reason
actor
timestamp
audit event
before/after state
```

Audit whether such controls exist.

If not, classify the gap.

Do not implement them yet.

---

# 23. Data integrity risks

For each questionable Platform action determine possible consequences for:

```text
sellerPartnerId
customerId
commission
GMV
revenue
net revenue
booking state
payment state
refund state
payout
CRM attribution
Analytics
audit trail
```

Prioritize actions that can create financially inconsistent records.

---

# 24. Runtime verification

Where application runtime is available, verify actual Platform UI and permissions.

At minimum inspect:

```text
Catalog
Orders
Bookings
Customers
Partners
Payments
Refunds
Payouts / Finance
Reviews
Messages
```

For each questionable action:

```text
visible?
enabled?
route works?
API permits?
server denies?
```

Runtime/browser evidence outranks assumptions from source code.

Do not mutate important shared/prod-like data merely for audit.

Use safe/test records where necessary.

---

# 25. Regression verification

Confirm:

```text
Platform Create Customer remains absent
Platform Create Product remains absent
Platform ownerless POST /products remains denied
Partner Product creation remains functional
```

If any regression exists, mark it P0.

---

# 26. GAP priorities

Classify every finding:

## P0

Security, ownership, financial or data-integrity violation.

Examples:

```text
Platform can create seller-owned transaction without seller
sellerPartnerId can become invalid/null
payment can be fabricated improperly
cross-partner mutation
```

## P1

Wrong business authority or permission conflation.

Examples:

```text
Platform normal seller action exposed
support override indistinguishable from business action
```

## P2

UX/action exposure or naming mismatch without current integrity impact.

## DEFERRED

Valid future architecture work not required for current boundary.

---

# 27. Do not overcorrect

Important:

```text
Platform ≠ read-only
```

Platform legitimately owns many marketplace operations:

```text
partner onboarding
moderation
security
support
disputes
settlement
payout governance
compliance
policy enforcement
```

The goal is not to remove all Platform mutation.

The goal is:

> Remove or isolate mutations where Platform incorrectly acts as the commercial seller/business owner.

---

# 28. Required final matrix

Return one consolidated matrix:

| Domain | Action | Current Platform authority | Correct? | Target authority | Priority |
|---|---|---:|---:|---|---|
| Product | Create | ... | ... | Partner | ... |
| Order | Create | ... | ... | ... | ... |
| Booking | Create | ... | ... | ... | ... |
| Payment | ... | ... | ... | ... | ... |

Include every meaningful mutation discovered.

---

# 29. Required final report

## A. Verdict

Use:

```text
VERDICT A — PLATFORM ACTION AUTHORITY MATCHES TARGET
```

or:

```text
VERDICT B — REMEDIATION REQUIRED
```

Do not implement remediation automatically.

---

## B. Platform UI inventory

All mutation actions by center/page.

---

## C. API mutation inventory

All relevant production endpoints + permissions.

---

## D. Orders findings

Exact ownership/lifecycle authority.

---

## E. Bookings findings

Exact ownership/lifecycle authority.

---

## F. Payments / Refunds / Payouts findings

Exact financial authority.

---

## G. Customer / Partner findings

Administrative vs business authority.

---

## H. Reviews / Messages findings

Author vs moderation authority.

---

## I. Permission conflation

Exact permissions requiring separation, if any.

---

## J. Data-integrity risks

Exact downstream consequences.

---

## K. Runtime evidence

What was actually visible/allowed/denied.

---

## L. GAP list

```text
P0
P1
P2
DEFERRED
```

---

## M. Recommended remediation

Minimal exact changes.

Do not perform them yet.

---

## N. Git evidence

Audit only:

```text
Starting HEAD
Final HEAD
origin/master
git status
Production changes: NONE
```

Expected starting baseline from Step 3.6B report:

```text
1ced16b
```

Verify rather than assume.

---

# 30. Closure questions

The audit is complete only when all can be answered with evidence:

```text
1. Can Platform create Orders?
2. Can Platform create Bookings?
3. Can Platform fabricate/change Payment state?
4. Who controls Refund lifecycle?
5. Who controls Payout lifecycle?
6. Which Platform create actions are legitimate administration?
7. Which Platform actions incorrectly act as seller?
8. Are seller and governance permissions conflated?
9. Can Platform bypass hidden UI through API?
10. Can any action produce missing/incorrect sellerPartnerId?
11. Can any action corrupt commission/CRM/Analytics attribution?
12. What exact remediation is required?
```

---

# 31. Explicit non-goals

Do not implement:

```text
Chat automated moderation
Marketplace communication redesign
new entitlement tiers
first-party TravelHub sales
broad UI redesign
schema migrations
financial data rewrites
CRM redesign
Workforce / Employee Performance Management
```

---

# 32. Expected architecture direction

The audit should validate or refine this boundary:

```text
                         TRAVELHUB
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ↓                             ↓
       PLATFORM                       PARTNER
 Marketplace Operator             Business/Seller
             │                             │
             ├ Governance                  ├ Products
             ├ Moderation                  ├ Fulfillment
             ├ Support                     ├ Commercial CRM
             ├ Security                    └ Own operations
             ├ Settlement
             └ Compliance
```

Platform may intervene where operator authority requires it.

Platform must not silently become the seller.

Return the audit report and wait for approval before remediation.
