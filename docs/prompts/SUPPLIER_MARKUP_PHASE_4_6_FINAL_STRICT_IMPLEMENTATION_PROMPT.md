# SUPPLIER MARKUP — PHASE 4–6 FINAL STRICT IMPLEMENTATION PROMPT
## Unified execution prompt: original Phase 4–6 scope + approved Request Modal UX

**Project:** TravelHUB  
**Baseline:** `SUPPLIER_MARKUP_STRICT_IMPLEMENTATION_PROMPT.md`  
**Current status:** Phases 0–3 completed; Phases 4–6 pending  
**Execution mode:** STRICT / sequential / gate-driven  
**Rule:** Do not declare the Supplier Markup workstream complete until Phase 4, Phase 5, and Phase 6 are all completed and their gates pass.

---

# 0. PURPOSE OF THIS PROMPT

This document is a **continuation and clarification of the already-approved strict Supplier Markup implementation prompt**.

It does **not replace or reduce** the original Phase 4–6 scope.

The developer must execute:

```text
PHASE 4 — original Phase 4 scope
       +
PHASE 4 UX — approved Request Modal UX
       ↓
PHASE 4 GATE
       ↓
PHASE 5 — original Phase 5 scope
       ↓
PHASE 5 GATE
       ↓
PHASE 6 — original Phase 6 scope
       ↓
FINAL §37 / ALL GATES
       ↓
ONLY THEN: commit + push
```

The Request Modal UX is an **additional Phase 4 requirement**, not a replacement for:

- Admin Markup Matrix;
- Live Sales discount;
- Request → Order commercial snapshot propagation;
- frontend hardcode cleanup.

---

# 1. CURRENT BASELINE — DO NOT REIMPLEMENT PHASES 0–3

According to the current interim report:

- Phases 0–3 are complete;
- `MarkupRule` / `MarkupRuleHistory` exist;
- `Request.commercialSnapshot` exists;
- centralized Supplier Pricing exists;
- tour/hotel markup boundary exists;
- flight markup/freshness path exists;
- Request money/snapshot gates exist;
- RBAC `pricing.markup.read/manage` exists;
- Storefront `CommissionPolicy` remains separate;
- Phase 4, 5, 6 are still pending.

Do not undo or duplicate completed work.

Existing Phase 0–3 invariants remain mandatory.

---

# 2. ABSOLUTE EXECUTION RULES

## 2.1 Sequential execution

Execute strictly in this order:

```text
Phase 4
→ Phase 4 Gate
→ Phase 5
→ Phase 5 Gate
→ Phase 6
→ Final Gate
```

Do not jump ahead.

Do not silently skip an incomplete Phase 4 item.

Do not report Phase 4 complete merely because the Request Modal UX is complete.

---

## 2.2 No scope substitution

The following are all mandatory Phase 4 deliverables:

1. Admin Markup Matrix UI;
2. Live Sales individual discount;
3. `sales.discount.grant`;
4. Request → Order commercial snapshot propagation;
5. frontend hardcoded supplier/flight pricing-option cleanup;
6. Request Modal UX described in Section 8.

All six must pass before Phase 4 can be marked complete.

---

## 2.3 No architecture regression

Do NOT:

- modify `CommissionPolicy` to implement TravelHUB markup;
- introduce `isTestSupplier`;
- introduce a second markup engine;
- apply markup twice;
- trust client commercial prices;
- introduce `FlightSupplier.refreshPrice`;
- weaken Request money gates;
- weaken Order conversion gates;
- implement Booking → Order;
- invent FX conversion;
- move individual discounts into Storefront/public pricing;
- create channel-specific pricing logic.

---

# 3. PHASE 4 — ADMIN MARKUP MATRIX

## 3.1 Dynamic source of truth

The matrix must be generated from the actual supplier registries.

Use the approved dynamic source:

```text
SupplierAdapterRegistry.getEntries()
    UNION
FlightSupplierRegistry.list()
```

Service types:

```text
tours
hotels
flights
```

Do not introduce a new static supplier list.

A newly registered supplier/service combination must automatically appear in the matrix without editing a hardcoded frontend list.

---

## 3.2 Matrix states

Each supplier × service cell must correctly represent:

```text
NOT_CONFIGURED
0%
N%
```

Use the existing MarkupRule runtime semantics.

`NOT_CONFIGURED` means runtime markup = 0%.

Do not silently create a fake active rule merely to populate the UI.

---

## 3.3 Permissions

Admin pricing UI/API must use only:

```text
pricing.markup.read
pricing.markup.manage
```

Do not reuse undeclared supplier-search permissions.

Read operations require:

```text
pricing.markup.read
```

Mutating operations require:

```text
pricing.markup.manage
```

---

## 3.4 Rule editing

The UI must support the approved MarkupRule lifecycle:

```text
DRAFT
→ ACTIVE
→ ARCHIVED
```

Respect:

- version/CAS;
- effective dates;
- overlap protection;
- audit history;
- actor;
- state transition rules.

Do not bypass the existing backend authority.

---

## 3.5 Matrix acceptance tests

At minimum:

- existing supplier appears;
- existing service appears;
- new registry supplier appears automatically;
- new supplier/service combination appears without frontend code change;
- NOT_CONFIGURED renders correctly;
- active percentage renders correctly;
- unauthorized user is rejected;
- stale version produces the expected conflict;
- activation/archive lifecycle is enforced.

---

# 4. PHASE 4 — LIVE SALES INDIVIDUAL DISCOUNT

## 4.1 Business meaning

The TravelHUB markup is the platform pricing rule.

An individual discount is a separate Live Sales commercial adjustment negotiated with a specific customer.

Example:

```text
Supplier Live Price = 1000
Markup = 5%
Public Price = 1050
Individual Discount = 30
Customer Final Price = 1020
```

The discount must NOT modify the global MarkupRule.

---

## 4.2 Supplier price remains the floor

Mandatory invariant:

```text
customerFinalPrice >= supplierLivePrice
```

Example:

```text
Supplier = 1000
Public = 1050
Discount = 60

Final = 990

→ REJECT
```

The server must reject the operation.

---

## 4.3 `sales.discount.grant`

Implement the approved dedicated permission:

```text
sales.discount.grant
```

The exact role assignment must follow the project's existing RBAC conventions and approved architecture.

The permission must be checked server-side.

Do not rely on frontend visibility.

---

## 4.4 Discount authority

Client may provide the requested discount value/type.

Server derives:

```text
discountAmount
customerFinalPrice
```

Server validates:

```text
supplierPrice
publicPrice
discount
finalPrice
currency
```

Do not trust client-provided final totals.

---

## 4.5 Discount scope

Individual discount belongs to:

```text
Request
→ commercial snapshot
→ Order
```

It does NOT belong to:

```text
MarkupRule
Tariff
Supplier catalog
Public storefront price
Storefront seller commission
```

---

# 5. PHASE 4 — REQUEST → ORDER SNAPSHOT PROPAGATION

When:

```text
Request → Order
```

the accepted commercial snapshot must be preserved.

At minimum preserve the approved fields:

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

Also preserve supplier/offer/date/traveler context where already represented by the commercial snapshot.

The resulting Order must not silently recalculate an already accepted commercial fact using a newer MarkupRule.

Rule changes after acceptance must NOT mutate historical accepted pricing.

---

## 5.1 Propagation tests

Test:

```text
Request snapshot
    ↓
customer acceptance
    ↓
Request → Order
    ↓
Order contains same accepted commercial facts
```

Also test:

```text
MarkupRule changes after acceptance
    ↓
existing Request/Order remains frozen
```

---

# 6. PHASE 4 — FRONTEND HARDCODE CLEANUP

Remove relevant hardcoded supplier maps/options that contradict the registry SSOT.

Examples include:

```text
SUPPLIER_LABELS
hardcoded supplier tabs
hardcoded flight supplier options
hardcoded pricing matrix supplier lists
```

Replace them with registry/API-driven data.

Do not perform unrelated frontend cleanup.

Public storefront must continue receiving authoritative prices from the server.

---

# 7. PHASE 4 — APPROVED REQUEST MODAL UX

This section is an **additional mandatory Phase 4 requirement**.

It exists because the current UX duplicates the request flow.

The target is:

```text
Calendar
   ↓
click on price
   ↓
ONE REQUEST MODAL
   ↓
selected tour
+
offers for this exact tour/date
+
customer data
   ↓
offer-specific "Подать заявку"
   ↓
Request
```

---

## 7.1 Remove duplicate standalone form

The standalone customer form below the calendar must no longer be the primary request-entry path.

Do not leave two competing flows:

```text
Calendar → form → Send Request
Calendar → price → modal → Request
```

The canonical flow is:

```text
Calendar
→ click price
→ modal
→ customer data
→ offer-specific "Подать заявку"
→ Request
```

---

## 7.2 Selected tour

The modal represents the exact tour/card selected from the calendar.

Show the selected context, such as:

```text
Tour
Destination
Date
Nights
Travelers
```

Do not display unrelated tours.

---

## 7.3 Offers are variants of the same tour

Multiple offers inside the modal are variants of the selected tour.

They may differ by:

- room;
- room category;
- view;
- meal plan;
- tariff;
- supplier offer conditions.

They are NOT different tours.

---

## 7.4 Every offer has its own button

Every offer must have:

```text
[ Подать заявку ]
```

There must be no single global submit button.

Example:

```text
Superior Room
Breakfast
3 449 USD
[ Подать заявку ]

Deluxe Room
Breakfast
3 505 USD
[ Подать заявку ]

Family Room
Ultra All Inclusive
3 780 USD
[ Подать заявку ]
```

The clicked button determines the exact selected offer.

---

## 7.5 Registered user

If authenticated customer data is available:

- automatically populate customer fields;
- show a confirmation message;
- do not force re-entry;
- activate offer buttons immediately if data is valid.

Suggested message:

> **Используем данные вашего аккаунта. Проверьте, пожалуйста, их корректность.**

Optional explicit confirmation:

```text
[ Данные верны ]
```

Do not create a second registration flow.

---

## 7.6 Guest user

Guest fields begin empty.

Required/optional status must follow the existing customer contract.

Typical fields:

```text
Имя и фамилия
Телефон
Email
```

For incomplete/invalid data:

```text
[ Подать заявку ] = disabled
```

for every offer.

After valid data is entered:

```text
all offer buttons = enabled
```

---

## 7.7 Phone

Use the existing phone-first architecture.

Do not invent another normalization mechanism.

Server must normalize to E.164.

Invalid phone:

> **Введите корректный номер телефона.**

Validation is required on both frontend and backend.

---

## 7.8 Email

If Email is optional:

```text
empty = allowed
invalid non-empty = rejected
```

Invalid message:

> **Введите корректный адрес электронной почты.**

Frontend validation is UX only.

Backend validation remains mandatory.

---

## 7.9 No user-facing "Проверить цену"

Do not add:

```text
Проверить цену
```

The user should simply select the offer and press:

```text
Подать заявку
```

Price freshness and authority remain server-side.

---

## 7.10 Calendar hint

Make the interaction obvious.

Use:

> **Нажмите на цену, чтобы посмотреть варианты и подать заявку.**

or an equivalent concise text.

---

## 7.11 Exact Request preservation

The created Request must preserve the exact selected offer:

```text
tour
date
travelers
room
meal
supplier
supplier offer identifier
supplier price
supplier currency
TravelHUB markup
public price
individual discount
customer final price
```

Do not create a generic tour-level Request while losing room/meal/offer identity.

---

## 7.12 Rich modal

The modal should look like a real travel-booking component rather than a technical form.

Recommended structure:

```text
┌───────────────────────────────────────────────────┐
│ Оформление заявки                              X │
│                                                   │
│ Selected tour                                     │
│ date • nights • travelers                         │
│                                                   │
│ Варианты размещения и питания                    │
│                                                   │
│ ┌─────────────────────────────────────────────┐   │
│ │ Superior Room                              │   │
│ │ Double • Breakfast                         │   │
│ │                             3 449 USD       │   │
│ │                        [Подать заявку]      │   │
│ └─────────────────────────────────────────────┘   │
│                                                   │
│ ┌─────────────────────────────────────────────┐   │
│ │ Deluxe Room                                │   │
│ │ Double • Breakfast                         │   │
│ │                             3 505 USD       │   │
│ │                        [Подать заявку]      │   │
│ └─────────────────────────────────────────────┘   │
│                                                   │
│ Данные заказчика                                 │
│ ...                                               │
└───────────────────────────────────────────────────┘
```

Use the existing TravelHUB design system.

Do not redesign unrelated screens.

---

# 8. PHASE 4 — TEST REQUIREMENTS

## Backend

Add/adjust tests for:

- `sales.discount.grant`;
- valid discount;
- discount floor violation;
- unauthorized discount;
- Request snapshot propagation;
- frozen accepted pricing;
- selected offer integrity;
- phone validation;
- E.164 normalization;
- email validation;
- guest customer resolution;
- server-authoritative pricing.

## Frontend

Test:

- dynamic matrix;
- NOT_CONFIGURED;
- active markup;
- registered-user modal;
- guest modal;
- disabled offer buttons;
- enabled offer buttons after valid data;
- invalid phone;
- invalid email;
- each offer's own submission;
- correct selected tour/date;
- duplicate standalone form removed.

## E2E

At minimum:

1. Admin Markup Matrix;
2. Markup rule lifecycle;
3. Live Sales discount;
4. Request → Order snapshot;
5. registered-user Request Modal;
6. guest Request Modal;
7. selected-offer correctness;
8. invalid customer data;
9. dynamic supplier matrix.

---

# 9. PHASE 4 GATE

Phase 4 is PASS only if ALL are true:

```text
[ ] Admin Matrix implemented
[ ] Dynamic registry source
[ ] NOT_CONFIGURED behavior
[ ] pricing.markup.read/manage RBAC
[ ] MarkupRule lifecycle
[ ] sales.discount.grant implemented
[ ] supplier-price floor enforced
[ ] Request discount persisted
[ ] Request → Order snapshot propagated
[ ] frozen accepted pricing preserved
[ ] frontend hardcodes cleaned
[ ] Request Modal implemented
[ ] duplicate form removed
[ ] registered-user flow works
[ ] guest flow works
[ ] phone validation works
[ ] email validation works
[ ] exact offer preserved
[ ] tests pass
[ ] typecheck passes
[ ] no Phase 0–3 regression
```

If any mandatory item is incomplete:

```text
PHASE 4 = FAIL
```

Do not continue to Phase 5 until fixed.

---

# 10. PHASE 5 — SYNC & RECONCILIATION

Only start after Phase 4 PASS.

Execute the original Phase 5 scope.

---

## 10.1 Sync pricing

Apply the approved pricing architecture consistently in supplier synchronization.

For synchronized tariffs:

```text
Supplier price
→ TravelHUB Markup
→ public/storefront price
```

Do not apply markup twice.

Do not use a different pricing formula in sync.

---

## 10.2 `amount:0` fallback elimination

Audit the affected adapters, including the known:

```text
anex
anex-hotel
kazunion
summertour
```

If an adapter cannot produce a valid price:

```text
do NOT emit amount = 0
```

Instead produce the project's explicit unavailable/invalid-price state, e.g.:

```text
PRICE_UNAVAILABLE
```

Do not convert an unknown price into a valid zero-price commercial fact.

---

## 10.3 Reconciliation

Implement the approved reconciliation path between:

```text
stored/public price
↔ supplier price
```

Respect the existing freshness/confirmation architecture.

Do not invent a second pricing engine.

Do not mutate accepted historical snapshots.

---

## 10.4 Debug cleanup

Remove production/debug artifacts identified by the audit/interim report, including:

```text
D:	ravelhub_v1ackend_price_chain.log
```

and relevant debug `console.log` traces introduced/identified by the pricing workstream.

Do not remove legitimate structured application logging.

---

## 10.5 Copyright / stale hardcoded artifacts

Remove the relevant stale copyright/hardcoded artifacts identified by the original Phase 5 scope.

Do not perform unrelated repository cleanup.

---

# 11. PHASE 5 TESTS

At minimum:

- every affected adapter rejects missing/invalid price;
- no `amount:0` fallback remains in scoped paths;
- sync uses the same markup calculation;
- no double markup;
- reconciliation preserves supplier floor;
- accepted commercial snapshot is not rewritten;
- debug artifacts are absent;
- full pricing unit suite remains green.

---

# 12. PHASE 5 GATE

Phase 5 PASS requires:

```text
[ ] Sync pricing complete
[ ] Reconciliation complete
[ ] amount:0 fallbacks eliminated
[ ] PRICE_UNAVAILABLE behavior verified
[ ] debug artifacts cleaned
[ ] relevant copyright/stale artifacts cleaned
[ ] no double markup
[ ] no accepted-snapshot mutation
[ ] tests pass
[ ] typecheck passes
[ ] no Phase 0–4 regression
```

If any item fails:

```text
PHASE 5 = FAIL
```

Stop at the affected boundary and fix it before Phase 6.

---

# 13. PHASE 6 — HARDENING

Only start after Phase 5 PASS.

Execute the original Phase 6 scope.

---

## 13.1 Full E2E matrix

Run the complete relevant E2E matrix.

Include at minimum:

- pricing;
- RBAC;
- Request;
- Order;
- Storefront;
- supplier flows;
- guest checkout;
- registered customer;
- Live Sales discount;
- Admin Matrix;
- Request Modal;
- Request → Order;
- existing lifecycle regressions.

Do not report only markup-specific unit tests as final proof.

---

## 13.2 RBAC hardening

Verify:

```text
pricing.markup.read
pricing.markup.manage
sales.discount.grant
```

against actual role behavior.

Test both:

```text
authorized
unauthorized
```

Do not accept frontend-only hiding as authorization.

---

## 13.3 Idempotency

Verify repeated operations cannot produce:

- duplicate markup;
- duplicate discount;
- duplicate Request;
- duplicate Order commercial facts;
- inconsistent snapshots.

Where the existing command semantics require conflict responses, preserve them.

---

## 13.4 Concurrent activation

Test concurrent MarkupRule activation.

Preserve:

- CAS;
- overlap protection;
- one ACTIVE rule per supplier/service/time key;
- audit history.

---

## 13.5 Performance / resolve mutex

Where applicable, test pricing rule resolution under concurrency.

Do not introduce a race that can produce inconsistent active rules.

---

## 13.6 Documentation

Update the relevant architecture documentation under:

```text
docs/architecture/
```

Document:

- MarkupRule;
- supplier/service matrix;
- pricing calculation;
- individual discount;
- commercial snapshot;
- Request → Order propagation;
- price authority;
- flight freshness;
- permissions;
- lifecycle;
- reconciliation.

Do not create contradictory duplicate architecture definitions.

---

# 14. PHASE 6 — FULL REGRESSION

Run:

```text
npm run typecheck
npm test
```

and the complete applicable E2E suite.

Record:

```text
suite count
test count
pass count
fail count
known pre-existing failures
```

Do not hide failures.

Do not weaken tests to obtain green status.

Do not label a failure "pre-existing" without evidence.

---

# 15. FINAL §37 GATE

The final Supplier Markup implementation is PASS only when all mandatory gates are satisfied.

Required final evidence includes:

```text
Gate A — Dynamic registry
Gate B — Rule isolation
Gate C — Single calculation
Gate D — Supplier floor
Gate E — Invalid money rejection
Gate F — Snapshot freeze
Gate G — Request/Order gates
Gate H — Flights
Gate I — Freshness
Gate J — RBAC
Gate K — Storefront isolation
Gate L — Hardening
```

Additionally verify the Phase 4 UX gates:

```text
Request Modal
registered user
guest
offer selection
phone
email
no duplicate form
```

---

# 16. PRE-EXISTING FAILURES

If known pre-existing failures remain, do NOT automatically declare them harmless.

For each failure:

1. reproduce it;
2. establish whether the current workstream touches the affected boundary;
3. determine whether it is genuinely pre-existing;
4. document exact evidence;
5. stop if the failure is caused or affected by this implementation.

Do not weaken gates or tests to make the suite green.

---

# 17. GIT RULE

No commit or push before:

```text
Phase 4 PASS
→ Phase 5 PASS
→ Phase 6 PASS
→ Final §37 PASS
```

Only after the final gate:

1. review `git diff`;
2. review `git status`;
3. ensure unrelated work is not accidentally included;
4. commit the Supplier Markup work;
5. push only if explicitly authorized by the current workflow.

If unrelated dirty work exists, do not overwrite, reset, or include it.

---

# 18. MANDATORY REPORT AFTER EACH PHASE

## Phase 4 report

Must include:

```text
Phase 4 status
Changed files
Admin Matrix
Live Sales discount
sales.discount.grant
Request → Order snapshot
frontend hardcode cleanup
Request Modal UX
Tests
Typecheck
E2E
Known failures
Git status
```

## Phase 5 report

Must include:

```text
Phase 5 status
Sync changes
Reconciliation
amount:0 audit
PRICE_UNAVAILABLE behavior
debug cleanup
copyright cleanup
Tests
Typecheck
E2E
Known failures
Git status
```

## Phase 6 / final report

Must include:

```text
Phase 6 status
Full E2E matrix
All Gate A–L results
Security/RBAC
Idempotency
Concurrency
Performance evidence
Documentation
Full test counts
Known failures
Final git diff
Final git status
Commit/push evidence
```

---

# 19. HARD STOP CONDITIONS

Stop immediately and report if:

- a mandatory Phase 4 item cannot be implemented without architectural change;
- supplier price authority is ambiguous;
- a test requires weakening an approved invariant;
- a client-supplied price becomes authoritative;
- a second markup boundary appears;
- `CommissionPolicy` must be changed to make the implementation work;
- `FlightSupplier.refreshPrice` is proposed;
- accepted historical pricing would be mutated;
- a Phase 0–3 invariant regresses;
- an unrelated workstream is at risk;
- an E2E failure appears caused by the current changes.

Do not improvise an architecture decision.

---

# 20. FINAL NON-NEGOTIABLE CONTRACT

The developer must understand the following distinction:

### ORIGINAL PHASE 4

```text
Admin Markup Matrix
+
Live Sales discount
+
sales.discount.grant
+
Request → Order snapshot propagation
+
frontend hardcode cleanup
```

### ADDITIONAL PHASE 4 UX

```text
Calendar
→ click price
→ one rich Request Modal
→ selected tour
→ offer variants
→ customer data
→ offer-specific "Подать заявку"
→ exact Request
```

### PHASE 5

```text
Sync
+
Reconciliation
+
remove amount:0 fallbacks
+
debug/copyright cleanup
```

### PHASE 6

```text
Full hardening
+
full E2E
+
RBAC/idempotency/concurrency
+
documentation
+
final §37
```

Therefore:

> **Completing the Request Modal does NOT complete Phase 4.**

> **Completing Phase 4 does NOT complete the Supplier Markup workstream.**

> **The workstream is complete only after Phase 4 + Phase 5 + Phase 6 + final §37 gates pass.**

**Execute strictly in order. Do not skip. Do not substitute one phase for another.**
