# SUPPLIER MARKUP — PHASES 4–6
## COMPLETE STRICT IMPLEMENTATION PROMPT
### Original Phase 4–6 scope + approved Request Modal UX

**Project:** TravelHUB  
**Workstream:** Supplier Markup  
**Baseline:** `SUPPLIER_MARKUP_STRICT_IMPLEMENTATION_PROMPT.md`  
**Current state:** Phases 0–3 complete; Phases 4–6 pending  
**Execution mode:** STRICT / sequential / gate-driven

---

# 0. IMPORTANT — WHAT THIS PROMPT IS

This document gives the developer the **complete description of Phases 4, 5 and 6**.

It is a continuation of the already-approved Supplier Markup implementation.

The original Phase 4 scope MUST remain intact.

The approved Request Modal UX is an **additional part of Phase 4**.

It does NOT replace:

- Admin Markup Matrix;
- Live Sales discount;
- `sales.discount.grant`;
- Request → Order snapshot propagation;
- frontend hardcode cleanup.

The execution order is mandatory:

```text
PHASE 4
  ↓
PHASE 4 GATE
  ↓
PHASE 5
  ↓
PHASE 5 GATE
  ↓
PHASE 6
  ↓
FINAL §37 / ALL GATES
```

Do not skip a phase.

Do not start the next phase while the current phase has a mandatory failure.

---

# PHASE 4 — ADMIN UI + LIVE SALES DISCOUNT + REQUEST UX

## 4.1 Phase 4 objective

Complete the commercial layer above the Phase 0–3 pricing foundation.

Phase 4 consists of **six mandatory blocks**:

```text
4.1 Admin Markup Matrix
4.2 MarkupRule administration UX
4.3 Live Sales individual discount
4.4 Request → Order commercial snapshot propagation
4.5 Frontend hardcode cleanup
4.6 Request Modal / Offer Selection UX
```

All six are required for:

```text
PHASE 4 = PASS
```

---

# 4.2 ADMIN MARKUP MATRIX

## 4.2.1 Dynamic matrix source

The Admin Markup Matrix must be generated dynamically from the approved supplier registries.

Use:

```text
SupplierAdapterRegistry.getEntries()
UNION
FlightSupplierRegistry.list()
```

Canonical service types:

```text
tours
hotels
flights
```

Do NOT introduce a separate hardcoded supplier list.

Do NOT make the frontend the source of truth.

---

## 4.2.2 Matrix structure

The UI must represent:

```text
Supplier × Service
```

Example:

```text
                 tours      hotels      flights
------------------------------------------------
SUMMERTOUR         5%          —            —
KOMPAS             5%          —            —
ANEX               5%          5%           —
KAZUNION           5%          —            —
AZAL                —           —           3%
AVIASALES           —           —           3%
```

The exact current matrix must come from the registries, not from this example.

---

## 4.2.3 Matrix states

A cell must distinguish:

```text
NOT_CONFIGURED
ACTIVE RULE
```

`NOT_CONFIGURED` means:

```text
runtime markup = 0%
```

Do not invent an active zero-percent rule merely to make the UI look configured.

---

## 4.2.4 Matrix API

Use the existing pricing API architecture.

Relevant approved endpoints include:

```text
GET /pricing/markup-rules
GET /pricing/markup-rules/resolve?supplier&service
GET /pricing/markup-rules/:code
GET /pricing/markup-rules/:code/history

POST /pricing/markup-rules
PATCH /pricing/markup-rules/:code

POST /pricing/markup-rules/:code/activate
POST /pricing/markup-rules/:code/archive
```

Do not change public supplier pricing contracts unnecessarily.

---

# 4.3 MARKUP RULE ADMINISTRATION

## 4.3.1 Rule lifecycle

The UI must respect:

```text
DRAFT
  ↓
ACTIVE
  ↓
ARCHIVED
```

The backend remains authoritative.

---

## 4.3.2 Version/CAS

Rule updates must respect:

```text
version
expectedVersion
```

A stale update must produce the existing conflict behavior.

Do not silently overwrite another administrator's change.

---

## 4.3.3 Effective dates

Respect:

```text
effectiveFrom
effectiveTo
```

and the existing overlap protection.

There must not be two conflicting ACTIVE rules for the same pricing key/time interval.

---

## 4.3.4 Audit history

Rule mutations must retain:

```text
actor
timestamp
action
version
changed fields
comment
```

Use the existing `MarkupRuleHistory` architecture.

---

# 4.4 PERMISSIONS FOR ADMIN MARKUP

Use only:

```text
pricing.markup.read
pricing.markup.manage
```

Read operations:

```text
pricing.markup.read
```

Mutation operations:

```text
pricing.markup.manage
```

Do NOT use undeclared supplier-search permissions for pricing administration.

Do NOT weaken RBAC to make the UI work.

---

# 4.5 LIVE SALES INDIVIDUAL DISCOUNT

## 4.5.1 Business rule

The platform markup is global/configurable:

```text
Supplier price
→ TravelHUB markup
→ public price
```

An individual customer discount is a separate Live Sales adjustment:

```text
public price
→ individual discount
→ customer final price
```

The discount is negotiated with a specific customer.

It is NOT a public Storefront discount.

It does NOT modify the global MarkupRule.

---

## 4.5.2 Example

```text
Supplier price = 1000
Markup = 5%
Markup amount = 50
Public price = 1050

Individual discount = 30

Customer final price = 1020
```

The realized commercial difference is therefore:

```text
1020 - 1000 = 20
```

The original 5% MarkupRule remains unchanged.

---

## 4.5.3 Dedicated permission

Implement/use:

```text
sales.discount.grant
```

This permission controls the ability to grant the individual discount.

The server must enforce it.

Frontend hiding is NOT authorization.

---

## 4.5.4 Discount calculation

The server must derive/validate:

```text
discount amount
customer final price
```

The client must not become the commercial authority.

Client may request a discount.

Server validates the complete commercial chain.

---

## 4.5.5 Supplier-price floor

Mandatory invariant:

```text
customerFinalPrice >= supplierPrice
```

Example:

```text
Supplier = 1000
Public = 1050
Discount = 60
Final = 990

→ REJECT
```

Expected domain validation behavior must be preserved.

Do not allow a discount to create a final price below the supplier price.

---

## 4.5.6 Discount storage

The individual discount belongs to the commercial transaction:

```text
Request
→ commercialSnapshot
→ Order
```

It must NOT be written into:

```text
MarkupRule
Tariff
supplier catalog
public Storefront price
CommissionPolicy
```

---

# 4.6 REQUEST → ORDER COMMERCIAL SNAPSHOT PROPAGATION

Phase 3 creates/freezes the commercial snapshot on Request.

Phase 4 must ensure that conversion:

```text
Request
→ Order
```

preserves the accepted commercial facts.

---

## 4.6.1 Snapshot fields

Preserve the approved commercial information, including:

```text
supplierPrice
supplierCurrency
platformMarkupPercent
platformMarkupAmount
publicDisplayPrice
individualDiscount
customerFinalPrice
customerCurrency
priceSource
acceptedAt
```

Also preserve the relevant supplier/offer/date/traveler context already represented by the commercial snapshot.

---

## 4.6.2 Historical immutability

After customer acceptance:

```text
accepted pricing = frozen commercial fact
```

A later MarkupRule change must NOT recalculate or mutate the accepted Request/Order commercial fact.

Example:

```text
Day 1:
Supplier = 1000
Markup = 5%
Accepted final = 1020

Day 2:
Markup changed to 8%

Existing accepted Request/Order
MUST remain based on Day 1 accepted pricing.
```

---

## 4.6.3 Conversion gate

Do not weaken the existing Order conversion gate.

Request conversion must still require valid commercial money.

No:

```text
missing price
missing currency
zero price
negative price
invalid final price
```

may silently produce an economically valid Order.

---

# 4.7 FRONTEND HARDCODE CLEANUP

Remove relevant hardcoded supplier/pricing lists that contradict the registry SSOT.

Examples identified by the architecture work:

```text
SUPPLIER_LABELS
hardcoded supplier tabs
hardcoded flight supplier options
hardcoded pricing matrix supplier lists
```

Replace them with registry/API-driven data where applicable.

---

## 4.7.1 Important limitation

Do not perform unrelated frontend cleanup.

Do not redesign unrelated screens.

Do not change public Storefront pricing semantics.

---

# 4.8 REQUEST MODAL UX

This is the approved additional Phase 4 UX requirement.

The current duplicated flow must be replaced with one canonical request path.

---

## 4.8.1 Target flow

```text
Calendar
   ↓
user clicks price
   ↓
one rich modal
   ↓
selected tour
+
selected date
+
traveler context
+
offer variants
+
customer data
   ↓
user clicks "Подать заявку"
on the desired offer
   ↓
Request
```

---

## 4.8.2 Remove standalone request form

Do not maintain:

```text
Calendar
→ standalone customer form
→ Send Request
```

as a second primary request flow.

The calendar must lead into the modal.

---

## 4.8.3 Selected tour

The modal represents the exact selected tour/card.

Show relevant context such as:

```text
tour
destination
date
nights
travelers
```

Do not show unrelated tours.

---

## 4.8.4 Offers are variants of the same tour

Multiple offers in the modal are NOT different tours.

They are variants such as:

```text
room
room category
view
meal plan
tariff
supplier conditions
```

Example:

```text
Superior Room
Double / Room Only
3 449 USD

Superior Room
Double / Breakfast
3 511 USD

Deluxe Room
Double / Breakfast
3 505 USD
```

---

## 4.8.5 Each offer has its own button

Every offer must contain:

```text
[ Подать заявку ]
```

There is no single global submit button.

The clicked offer determines the exact Request commercial context.

---

## 4.8.6 Registered user

For an authenticated registered customer:

- automatically populate customer data;
- use the existing Customer/User identity architecture;
- do not force re-entry of valid data;
- activate offer buttons immediately when the data is valid.

Show:

> **Используем данные вашего аккаунта. Проверьте, пожалуйста, их корректность.**

An explicit:

```text
[ Данные верны ]
```

may be used if appropriate to the existing UI.

---

## 4.8.7 Guest

For guest users:

```text
customer fields = empty
```

The fields follow the existing customer contract.

Typical:

```text
Имя и фамилия
Телефон
Email
```

Until required data is valid:

```text
[ Подать заявку ] = disabled
```

for all offers.

After valid data:

```text
all offer buttons = enabled
```

The user then chooses the desired offer.

---

## 4.8.8 Phone validation

Use the existing phone-first architecture.

Do not invent another phone identity system.

Server normalization:

```text
E.164
```

Invalid phone:

> **Введите корректный номер телефона.**

Validation must exist on:

```text
frontend
backend
```

Frontend validation is not a security boundary.

---

## 4.8.9 Email validation

If Email is optional:

```text
empty = valid
```

If non-empty:

```text
must be valid
```

Invalid message:

> **Введите корректный адрес электронной почты.**

Backend must repeat validation.

---

## 4.8.10 No "Проверить цену" button

Do not introduce a user-facing:

```text
Проверить цену
```

The user action is:

```text
Подать заявку
```

Price validation/revalidation remains server-side.

---

## 4.8.11 Calendar hint

Near the calendar/prices show an instruction such as:

> **Нажмите на цену, чтобы посмотреть варианты и подать заявку.**

or:

> **Нажмите на цену для оформления заявки.**

---

## 4.8.12 Exact offer preservation

The created Request must preserve the exact offer selected by the user:

```text
tour
date
traveler count
room
meal
supplier
supplier offer ID
supplier price
supplier currency
TravelHUB markup
public price
individual discount
customer final price
```

Do not collapse a room/meal variant into a generic tour Request.

---

## 4.8.13 Rich modal

The modal should be a proper travel-booking component.

Conceptual structure:

```text
┌─────────────────────────────────────────────────┐
│ Оформление заявки                            X │
│                                                 │
│ Selected tour                                   │
│ Date • Nights • Travelers                       │
│                                                 │
│ Варианты размещения и питания                  │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Superior Room                              │ │
│ │ Double • Breakfast                         │ │
│ │                            3 449 USD       │ │
│ │                       [Подать заявку]       │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Deluxe Room                                │ │
│ │ Double • Breakfast                         │ │
│ │                            3 505 USD       │ │
│ │                       [Подать заявку]       │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Данные заказчика                               │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

Use the existing TravelHUB design system.

---

# 4.9 PHASE 4 TESTS

## 4.9.1 Admin Matrix

Test:

- dynamic supplier source;
- dynamic service source;
- new supplier/service appears without hardcoded UI change;
- NOT_CONFIGURED;
- active markup;
- unauthorized access;
- stale-version conflict;
- lifecycle transitions;
- audit history.

---

## 4.9.2 Discount

Test:

- authorized discount;
- unauthorized discount;
- valid discount;
- zero discount;
- excessive discount;
- supplier-floor rejection;
- snapshot contains discount;
- Order contains accepted discount.

---

## 4.9.3 Request → Order

Test:

- snapshot exists;
- accepted snapshot freezes;
- conversion propagates snapshot;
- later MarkupRule changes do not mutate accepted facts;
- invalid money remains blocked.

---

## 4.9.4 Request Modal

Test:

- calendar price opens modal;
- correct tour/date;
- registered user auto-fill;
- guest empty state;
- invalid phone;
- invalid email;
- disabled guest buttons;
- valid guest data enables all offer buttons;
- offer #1 creates/selects offer #1;
- offer #N creates/selects offer #N;
- duplicate standalone form removed.

---

# 4.10 PHASE 4 GATE

Phase 4 PASS requires ALL:

```text
[ ] Admin Markup Matrix
[ ] Dynamic registry source
[ ] NOT_CONFIGURED
[ ] MarkupRule administration
[ ] pricing.markup.read
[ ] pricing.markup.manage
[ ] sales.discount.grant
[ ] Live Sales discount
[ ] Supplier price floor
[ ] Request commercial snapshot propagation
[ ] Frozen accepted pricing
[ ] Frontend hardcode cleanup
[ ] Request Modal
[ ] Duplicate form removed
[ ] Registered user flow
[ ] Guest flow
[ ] Phone validation
[ ] Email validation
[ ] Exact offer preservation
[ ] Unit tests
[ ] Integration tests
[ ] E2E tests
[ ] Typecheck
[ ] No Phase 0–3 regression
```

If any mandatory item fails:

```text
PHASE 4 = FAIL
```

Do NOT proceed to Phase 5.

---

# PHASE 5 — SYNC & RECONCILIATION

Phase 5 begins only after Phase 4 PASS.

Original Phase 5 scope:

```text
5.1 Apply markup in synchronization services
5.2 Tariff/public price consistency
5.3 Eliminate amount:0 fallbacks
5.4 Reconciliation between stored/public price and supplier
5.5 Remove pricing debug artifacts
5.6 Cleanup relevant copyright/stale pricing text
```

---

# 5.1 APPLY MARKUP IN SYNC SERVICES

Supplier synchronization must use the same approved pricing architecture.

Known supplier sync paths include:

```text
Kompas
SummerTour
KazUnion
```

and other scoped synchronization paths discovered during implementation.

The rule is:

```text
supplier price
→ SupplierPricingService
→ TravelHUB markup
→ public price
```

Do not create a second calculation.

Do not duplicate markup.

---

# 5.2 TARIFF = PUBLIC PRICE

Where the architecture defines synchronized `Tariff` as the public/storefront price:

```text
Tariff = supplier price + TravelHUB markup
```

Do not leave one path with supplier raw price while another has marked-up public price.

Preserve the approved architecture for static catalog pricing.

---

# 5.3 NO DOUBLE MARKUP

Example:

```text
Supplier = 1000
Markup = 5%

First application = 1050
Second application MUST NOT become 1102.50
```

Markup application must be idempotent at the approved boundary.

---

# 5.4 AMOUNT:0 FALLBACK ELIMINATION

The interim report identifies fallback `amount:0` paths in affected adapters including:

```text
anex
anex-hotel
kazunion
summertour
```

Audit these paths.

If a valid supplier price cannot be obtained:

```text
DO NOT emit amount = 0 as a valid commercial price.
```

Use the project's explicit unavailable/invalid-price behavior, e.g.:

```text
PRICE_UNAVAILABLE
```

The system must distinguish:

```text
real zero price
```

from:

```text
price unavailable / parsing failure / missing price
```

Do not allow an invalid fallback to pass commercial validation.

---

# 5.5 RECONCILIATION

Implement/complete the approved reconciliation loop:

```text
stored/public price
        ↕
supplier price
```

The reconciliation path must respect:

- supplier price authority;
- freshness;
- existing confirmation logic;
- accepted snapshot immutability.

Do not rewrite historical accepted commercial facts.

Do not invent a second pricing engine.

---

# 5.6 DEBUG CLEANUP

Remove the scoped pricing debug artifacts identified by the audit/interim report.

Known examples include:

```text
D:\travelhub_v1\backend_price_chain.log
```

and relevant pricing debug `console.log` traces.

Remove debug-only behavior without removing legitimate structured application logging.

---

# 5.7 COPYRIGHT / STALE PRICING TEXT

Clean the relevant stale pricing/copyright strings identified during the markup implementation.

In particular, review marketing copy that incorrectly suggests prices have no markup where the new architecture applies markup.

Do not modify unrelated copy.

---

# 5.8 PHASE 5 TESTS

Required tests include:

```text
[ ] sync markup calculation
[ ] no double markup
[ ] valid Tariff/public price
[ ] missing supplier price
[ ] zero/negative supplier price
[ ] PRICE_UNAVAILABLE
[ ] amount:0 fallback eliminated
[ ] reconciliation
[ ] accepted snapshot not rewritten
[ ] debug artifacts removed
[ ] pricing copy corrected where required
```

Run unit/integration tests for all affected adapters.

---

# 5.9 PHASE 5 GATE

Phase 5 PASS requires:

```text
[ ] Sync paths completed
[ ] Tariff/public price consistency
[ ] No double markup
[ ] amount:0 fallback removed
[ ] PRICE_UNAVAILABLE behavior
[ ] Reconciliation completed
[ ] Debug cleanup
[ ] Relevant stale/copyright cleanup
[ ] Tests pass
[ ] Typecheck pass
[ ] No Phase 0–4 regression
```

If any mandatory item fails:

```text
PHASE 5 = FAIL
```

Do NOT proceed to Phase 6.

---

# PHASE 6 — HARDENING

Phase 6 begins only after Phase 5 PASS.

Original Phase 6 scope:

```text
6.1 Full E2E hardening
6.2 RBAC hardening
6.3 Idempotency
6.4 Concurrent MarkupRule activation
6.5 Pricing resolution concurrency/load
6.6 Architecture documentation
6.7 Final §37 verification
```

---

# 6.1 FULL E2E HARDENING

Run the complete relevant E2E matrix.

At minimum include:

```text
Supplier pricing
MarkupRule
Admin Matrix
RBAC
Request
Customer Accept
Guest Checkout
Request Modal
Live Sales discount
Request → Order
Storefront
Flights
Tours
Hotels
Sync
```

Do not limit final validation to newly written unit tests.

---

# 6.2 RBAC HARDENING

Verify the actual server-side behavior of:

```text
pricing.markup.read
pricing.markup.manage
sales.discount.grant
```

For each permission test:

```text
authorized → allowed
unauthorized → rejected
```

Also verify that unrelated permissions do not accidentally grant access.

Do not solve RBAC failures by weakening authorization.

---

# 6.3 IDEMPOTENCY

Verify repeated execution does not cause:

```text
double markup
duplicate discount
duplicate snapshot mutation
duplicate commercial records
```

Examples:

```text
apply markup twice
→ second application is no-op / does not compound

repeat discount command
→ does not create an inconsistent commercial state

repeat Request operation
→ follows existing idempotency/conflict contract
```

Use existing project semantics rather than inventing incompatible behavior.

---

# 6.4 CONCURRENT MARKUP RULE ACTIVATION

Test concurrent attempts to activate rules for the same pricing key.

Mandatory invariant:

```text
at most one valid ACTIVE rule
for a conflicting supplier/service/time interval
```

Preserve:

```text
CAS
overlap checks
advisory-lock / concurrency protection
versioning
audit history
```

A race condition must not create conflicting active rules.

---

# 6.5 PRICING RESOLUTION CONCURRENCY / LOAD

The architecture identifies the pricing resolver/cache as an area requiring hardening.

Test concurrent resolution.

Verify:

```text
same active rule
consistent result
no duplicate conflicting state
no race-created pricing result
```

Where the implementation uses a mutex/lock/cache, verify it under concurrent access.

Do not introduce an unnecessary global bottleneck.

---

# 6.6 DOCUMENTATION

Update the appropriate architecture documentation under:

```text
docs/architecture/
```

Document at minimum:

### Pricing model

```text
supplier price
→ markup
→ public price
→ individual discount
→ customer final
```

### MarkupRule

- scope;
- lifecycle;
- version;
- effective dates;
- audit;
- NOT_CONFIGURED.

### Supplier matrix

- registry source;
- supplier/service keys;
- dynamic expansion.

### Commercial snapshot

- fields;
- freeze;
- Request;
- Order propagation.

### Live Sales discount

- permission;
- validation;
- supplier floor;
- channel independence.

### Flights

- search result;
- `collectedAt`;
- freshness TTL;
- re-search;
- no `FlightSupplier.refreshPrice`.

### Storefront

- distinction from `CommissionPolicy`.

### Request UX

- calendar;
- modal;
- offer variants;
- registered user;
- guest;
- customer validation.

### Sync/reconciliation

- Tariff/public price;
- invalid-price handling;
- no double markup.

---

# 6.7 FINAL §37 VERIFICATION

The final report must verify the mandatory gates:

```text
Gate A — Dynamic registry
Gate B — Rule isolation
Gate C — Single calculation
Gate D — Supplier-price floor
Gate E — Invalid money rejection
Gate F — Snapshot freeze
Gate G — Request / Order gates
Gate H — Flights
Gate I — Freshness
Gate J — RBAC
Gate K — Storefront isolation
Gate L — Hardening
```

---

# 6.8 GATE A — DYNAMIC REGISTRY

Evidence must show:

```text
new supplier/service
→ appears without hardcoded frontend change
```

Registry remains SSOT.

---

# 6.9 GATE B — RULE ISOLATION

Evidence:

```text
MarkupRule exists independently
CommissionPolicy unchanged
Storefront commission tests pass
```

---

# 6.10 GATE C — SINGLE CALCULATION

Evidence:

```text
1000 + 5% = 1050
```

and:

```text
second markup application
≠ 1102.50
```

---

# 6.11 GATE D — FLOOR

Evidence:

```text
supplier = 1000
final = 1020
→ PASS

supplier = 1000
final = 990
→ REJECT
```

---

# 6.12 GATE E — INVALID MONEY

Reject:

```text
missing supplier price
zero supplier price
negative supplier price
missing currency
invalid public price
invalid final price
```

No invalid commercial fact may pass acceptance.

---

# 6.13 GATE F — SNAPSHOT

Evidence:

```text
customer accepts
→ snapshot freezes
```

Changing the MarkupRule later must not mutate the accepted snapshot.

---

# 6.14 GATE G — REQUEST / ORDER

Evidence:

```text
invalid money
→ customer acceptance blocked
→ conversion blocked
```

and:

```text
valid accepted snapshot
→ Request → Order
→ commercial snapshot preserved
```

Do not weaken the existing Order conversion gate.

---

# 6.15 GATE H — FLIGHTS

Verify:

```text
FlightSupplierRegistry
→ search fan-out
→ one markup per fare
→ authoritative displayed price
```

Client `body.price` must NOT be commercial authority.

Do not introduce:

```text
FlightSupplier.refreshPrice
```

---

# 6.16 GATE I — FRESHNESS

For flights use:

```text
FlightSearchResult.collectedAt
```

and the approved recent-search TTL.

Current implemented architecture uses a 5-minute freshness window.

Expected behavior:

```text
fresh search
→ may reuse

stale search
→ full re-search
```

Do not invent a flight `refreshPrice` interface.

---

# 6.17 GATE J — RBAC

Verify:

```text
pricing.markup.read
pricing.markup.manage
sales.discount.grant
```

with positive and negative authorization tests.

---

# 6.18 GATE K — STOREFRONT

Verify:

```text
CommissionPolicy remains untouched
```

and:

```text
supplier markup ≠ seller commission
```

Existing Storefront commission tests must remain green.

---

# 6.19 GATE L — HARDENING

Evidence must include:

```text
full E2E
RBAC
idempotency
concurrency
resolution/load
documentation
cleanup
```

No unresolved Phase 6 defect may be silently ignored.

---

# 6.20 FULL REGRESSION

Run:

```text
npm run typecheck
npm test
```

plus the complete applicable E2E suite.

Record:

```text
suite count
test count
passed
failed
skipped
known pre-existing failures
```

Do not weaken tests.

Do not delete failing tests merely to obtain green status.

---

# 6.21 PRE-EXISTING FAILURES

Known current interim failures include:

```text
d4-representative-chain
payment-flow
```

These were documented as pre-existing and outside the markup diff in the interim report.

However, during Phase 6 the developer must verify whether they remain genuinely unrelated.

For each failure:

1. reproduce;
2. identify affected subsystem;
3. compare against pre-markup behavior;
4. establish whether current work touches it;
5. document evidence.

If current markup work causes or changes the failure:

```text
STOP
```

Do not label it pre-existing.

---

# 6.22 MIGRATION / REPOSITORY SAFETY

Do not reconstruct unrelated historical migrations.

Do not overwrite unrelated dirty work.

Known repository state contains unrelated workstreams.

Before final commit:

```text
git status
git diff
```

must be reviewed.

Only Supplier Markup changes belonging to this workstream may be included.

---

# 7. FINAL STOP / COMPLETION GATE

The developer must NOT say:

```text
Supplier Markup complete
```

until:

```text
Phase 4 PASS
AND
Phase 5 PASS
AND
Phase 6 PASS
AND
Gates A–L PASS
AND
final regression reviewed
```

Only then may the final implementation be considered complete.

---

# 8. REQUIRED PHASE REPORTS

## After Phase 4

Provide:

```text
PHASE 4 — FINAL IMPLEMENTATION REPORT

1. Admin Matrix
2. MarkupRule UI
3. Live Sales discount
4. sales.discount.grant
5. Request → Order snapshot
6. frontend hardcode cleanup
7. Request Modal UX
8. changed files
9. migrations
10. tests
11. typecheck
12. E2E
13. failures
14. Git status
15. Phase 4 Gate result
```

If Phase 4 is PASS, explicitly state:

```text
PHASE 4 = PASS
```

Otherwise:

```text
PHASE 4 = FAIL
```

and STOP.

---

## After Phase 5

Provide:

```text
PHASE 5 — FINAL IMPLEMENTATION REPORT

1. Sync changes
2. Tariff/public pricing
3. amount:0 audit
4. PRICE_UNAVAILABLE
5. reconciliation
6. debug cleanup
7. stale/copyright cleanup
8. changed files
9. tests
10. typecheck
11. E2E
12. failures
13. Git status
14. Phase 5 Gate result
```

If Phase 5 is PASS:

```text
PHASE 5 = PASS
```

Otherwise:

```text
PHASE 5 = FAIL
```

and STOP.

---

## After Phase 6

Provide:

```text
PHASE 6 — FINAL §37 REPORT

1. Full implementation summary
2. All changed files
3. All migrations
4. Full test matrix
5. Full E2E matrix
6. Gates A–L
7. RBAC evidence
8. Idempotency evidence
9. Concurrency evidence
10. Performance/load evidence
11. Documentation
12. Known failures
13. Pre-existing failure analysis
14. Git diff
15. Git status
16. Commit status
17. Push status
18. Final verdict
```

---

# 9. COMMIT / PUSH RULE

Do not commit or push merely because a phase passes.

Before any final commit:

```text
Phase 4 PASS
Phase 5 PASS
Phase 6 PASS
Gates A–L PASS
full regression reviewed
git diff reviewed
unrelated changes excluded
```

Only then follow the project's approved commit/push workflow.

---

# 10. NON-NEGOTIABLE FINAL CONTRACT

The developer must preserve this exact distinction:

### PHASE 4

```text
Admin Markup Matrix
+
MarkupRule administration
+
Live Sales individual discount
+
sales.discount.grant
+
Request → Order snapshot propagation
+
frontend hardcode cleanup
+
Request Modal UX
```

### PHASE 5

```text
Sync pricing
+
Tariff/public price consistency
+
amount:0 elimination
+
PRICE_UNAVAILABLE
+
reconciliation
+
debug cleanup
+
relevant stale/copyright cleanup
```

### PHASE 6

```text
Full E2E hardening
+
RBAC
+
idempotency
+
concurrent activation
+
pricing resolution/load
+
architecture documentation
+
final §37
+
Gates A–L
```

Therefore:

> **The Request Modal is only one part of Phase 4.**

> **Admin Matrix, Live Sales discount, snapshot propagation and hardcode cleanup are equally mandatory Phase 4 work.**

> **Phase 5 is mandatory and cannot be skipped.**

> **Phase 6 is mandatory and cannot be skipped.**

> **The Supplier Markup workstream is complete only after Phase 4 + Phase 5 + Phase 6 + final §37 gates pass.**

**Execute strictly in order. Do not substitute, omit, or merge phases in a way that loses mandatory work.**
