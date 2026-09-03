# PHASE 3 — PRE-STEP 3.12 — D3 — REQUEST FLOW INTEGRATION — FINAL REMEDIATION & EVIDENCE CLOSURE

## ROLE — MANDATORY

Ты работаешь как **Senior/Staff Software Engineer + Software Architect + Backend Engineer + Frontend Engineer + Database Engineer + Security Engineer + QA Engineer** проекта TravelHub.

Это **узкий финальный remediation/evidence-closure D3**, а НЕ новая implementation stage. D3 Strict Review завершён с `VERDICT B` из-за одного blocking finding: **F6 — Request flow не интегрирован с D3**. Existing code/reports/tests — evidence, не canonical business truth.

Работай: `CANONICAL ARCHITECTURE CHECK → ROADMAP POSITION CHECK → REQUEST FLOW AUDIT → ROOT CAUSE → MINIMAL REMEDIATION → DB → API → UI → RUNTIME → EVENT FLOW → EVIDENCE → GIT → ROADMAP CLOSURE`.

Не начинай D4.

## LANGUAGE REQUIREMENT — MANDATORY

Все reports/findings/root cause/architecture/security/runtime evidence/conclusions — преимущественно **на русском**. English допустим для identifiers, paths, endpoints, enums, permissions, commands, code snippets и standardized VERDICT strings. Преимущественно английский report = TASK INCOMPLETE. Plaintext secrets/passwords/tokens запрещены.

## 1. FROZEN BASELINE

```text
D0 ACCEPTED
D1 ACCEPTED
D1A ACCEPTED
D2 ACCEPTED

D3 Implementation       DONE
D3 Strict Review        DONE
D3 Strict Review        VERDICT B
D3 ACCEPTED             NO
```

Strict Review уже исправил/реконсилировал F1–F5: Order durable commerce root (Option B), real `termsAcceptedAt`, pin-at-acceptance, Booking gate on `finalConfirmedAt`, deterministic `OrderTraveler.position`. Не переоткрывать без contradictory evidence.

Единственный blocking finding:

```text
F6 — Request flow integration NOT IMPLEMENTED
```

## 2. ACCEPTED D3 LIFECYCLE

```text
accepted commercial case
→ durable Order commerce root
→ pinned requirements + frozen travelerCount
→ traveler collection
→ travelerDataCompletedAt
→ final confirmation
→ finalConfirmedAt
→ READY_FOR_BOOKING
→ BookingRequested
→ Booking
```

Hard: `Order existence ≠ Booking eligibility`; traveler-bearing Order cannot reach Booking before `finalConfirmedAt`.

## 3. CURRENT REQUEST GAP

Strict Review established:

```text
Request.customerAccept
→ CUSTOMER_ACCEPTED
→ customerAcceptedAt

Request.convertToOrder(requestId, orderId) exists
BUT has no application caller.
```

Close real chain:

```text
Request
→ supplier response/current terms
→ customer acceptance
→ acceptance snapshot
→ pinned traveler requirements
→ frozen traveler count
→ canonical Order root/link
→ D3 traveler collection
→ final confirmation
→ convertedAt/convertedOrderId semantics
→ Booking eligibility
→ Booking
```

No-Request sales flow must remain intact.

## 4. AUDIT ACTUAL REQUEST DOMAIN FIRST

Inspect actual `Request` model/status/service/controller, supplier actions, `customer-accept`, `convertToOrder`, Request history/events, Product/Customer links, traveler count representation, accepted price/currency/terms, Sales/Checkout/OrderRequested pipeline, commerceSequence allocation and idempotency.

Report explicitly:
1. meaning of `CUSTOMER_ACCEPTED`;
2. frozen commercial terms at acceptance;
3. accepted price/currency source;
4. Product relation;
5. traveler count source;
6. pre-Order party representation;
7. reusable D3 primitives;
8. whether CheckoutIntent/Sale or another carrier is needed;
9. how duplicate Order-creation architecture is avoided.

## 5. ONE CANONICAL CONVERSION PATH

Do not create incompatible Request and Sales commerce engines. Reuse canonical primitives where possible:

```text
acceptedAt
pinnedRequirements
travelerCount
OrderRequested / canonical Order creation
OrderTraveler
traveler validation
final-confirm
Booking gates
Passenger population
```

A minimal adapter/orchestration layer is acceptable if documented.

## 6. REQUEST ACCEPTANCE TIMESTAMP — HARD

For Request:

```text
Order.termsAcceptedAt = actual Request customer acceptance instant
```

Use canonical `customerAcceptedAt` unless audit proves another real acceptance timestamp. Never use downstream `new Date()`, `Order.createdAt`, or `updatedAt` as substitute.

Evidence:

```text
Request.customerAcceptedAt
= accepted snapshot timestamp
= Order.termsAcceptedAt
```

## 7. PIN AT REQUEST ACCEPTANCE — HARD

```text
Product policy A
→ Request accepted
→ PIN A at acceptance boundary
→ Product changes to B
→ Request-derived Order still uses A
→ new acceptance uses B
```

Do not reread mutable Product later to reconstruct accepted requirements.

## 8. FREEZE TRAVELER COUNT

Determine canonical Request traveler-count source. Do not hardcode 1, infer from Passenger, or silently default over explicit party composition. Freeze count with accepted commercial state. If current Request lacks sufficient representation, implement minimal canonical/backward-compatible representation and document it.

## 9. REQUEST → ORDER / CONVERTED SEMANTICS

Under accepted Option B, Order may be durable commerce root before final confirmation. Define precisely when Request links to it.

Audit canonical docs and decide/document exact semantics of:

```text
convertedOrderId
convertedAt
```

If canonical remains `convertedAt ≈ Order.createdAt`, preserve it. If semantic amendment is necessary, update canonical architecture explicitly before VERDICT A. No silent drift.

Relations must use FK/UUID, never derive from `REQ-*` / `ORD-*` strings.

## 10. REQUEST STATE MACHINE

Verify server-side:
- cannot accept before valid supplier/current terms;
- rejected/unavailable/expired Request cannot convert;
- accepted terms cannot mutate inconsistently;
- cannot convert twice;
- conversion/link is idempotent.

## 11. CONCURRENCY / IDEMPOTENCY — HARD

Test double customer acceptance, double conversion trigger, event retry, consumer retry and concurrent conversion.

Expected:

```text
one commerceSequence
one Order
one convertedOrderId
one logical conversion/history
one traveler set
no duplicate BookingRequested/Booking
```

## 12. REQUEST TRAVELER COLLECTION

After acceptance, use the same D3 contract:

```text
pinned requirements
→ Traveler 1..N
→ REQUIRED / OPTIONAL / NOT_REQUESTED
→ save
→ refresh/resume
→ completion
→ final confirmation
```

Do not create a second incompatible traveler form.

## 13. REQUEST UI CONTINUATION

Audit Request detail. After `CUSTOMER_ACCEPTED`, user must have an obvious continuation to linked Order/traveler collection, e.g. `Продолжить оформление` or clickable linked Order according to existing UX.

Hard:
- no manual searching for Order;
- Request shows linked Order;
- identifier clickable;
- direct URL/refresh works;
- relation understandable.

Do not perform D5 full Order Detail redesign.

## 14. REQUEST VISUAL RELATION

Request detail should minimally expose linked Order and derived progress, without inventing new domain enum. Example presentation:

```text
Связанный заказ: MKT-ORD-0000xxxx
Ожидаются данные туристов / Данные заполнены / Финально подтверждено
```

Use actual design system + RU/AZ/EN i18n.

## 15. BOOKING GATE FOR REQUEST-DERIVED ORDER

Before `finalConfirmedAt`:

```text
confirm/send → denied
Booking count = 0
```

After final confirmation:

```text
confirm → READY_FOR_BOOKING
send → BookingRequested
→ exactly 1 Booking
```

V1: `1 Order = 1 Booking`.

## 16. PASSENGER POPULATION

For successful Request case:

```text
frozen travelerCount
= OrderTraveler count
= Passenger count
```

Passenger derives from final confirmed `OrderTraveler`, not Customer/mutable Product.

## 17. CUSTOMER ≠ PAYER ≠ TRAVELER

Preserve hard domain distinction. Request Customer must not silently satisfy Traveler requirements.

## 18. SECURITY / OBJECT SCOPE

Verify actual actors:
- authorized Request actor gets only intended actions;
- foreign Partner cannot access/mutate another tenant's Request/Order/Traveler;
- Platform roles follow existing permission contract;
- unauthorized Platform role denied;
- traveler PII uses existing D3 redaction/access contract.

`acquisitionSource` is provenance, not authorization.

## 19. NO-REQUEST REGRESSION — HARD

Existing authoritative flow remains:

```text
Checkout/Sale → acceptance → pin → Order → travelers → final confirm → Booking
```

Request must NOT become mandatory and no fake Request may be created.

## 20. PERMANENT D3 VISUAL VERIFICATION CASE — MANDATORY

After remediation leave in representative dev DB **at least one deterministic D3 Request-flow visual case** that survives all tests/teardown and can be manually opened later.

Use demo-only, non-real PII. Prefer 2 Travelers.

Recommended editable state:

```text
Request accepted
Order linked
travelerCount = 2
OrderTraveler = 2
finalConfirmedAt = NULL
Booking = NONE
```

so user can visually see/edit Traveler cards.

If completed E2E case must be finalized, keep a second small case:

```text
CASE A — editable visual case
CASE B — final-confirmed + Booking evidence case
```

Do not inflate dataset unnecessarily.

## 21. VISUAL VERIFICATION MANIFEST — MANDATORY

Create:

```text
docs/evidence/d3/D3_VISUAL_VERIFICATION_CASE.md
```

with REAL runtime values, no placeholders:

```text
Request Code:
Request UUID:
Request URL:

Order Code:
Order UUID:
Order URL:

Booking Code/UUID: ... or NONE for editable case

Expected Traveler Count: 2
Expected UI:
- Traveler 1 visible
- Traveler 2 visible
- exact required/optional/hidden fields
- save works
- refresh preserves data
- final confirmation state
- Booking state
```

Use actual host/port/routes.

Hard:

```text
after all automated tests
→ restart/reload dev app
→ case still exists
→ direct URL opens
→ Traveler cards visible
```

A Playwright-only fixture deleted in teardown FAILS this gate.

## 22. BROWSER RUNTIME — REAL REQUEST FLOW

A. Eligible Request → supplier/current terms → customer acceptance → `CUSTOMER_ACCEPTED` → linked Order visible.

B. Continue/click linked Order → exactly 2 Traveler cards.

C. Missing REQUIRED → final confirmation denied.

D. Save → refresh/direct reopen → values persist.

E. Before final confirm → Booking transition denied, Booking NONE.

F. Separate completed case if necessary → complete travelers → final confirm → READY_FOR_BOOKING → send → Booking → Passenger x2.

## 23. AUTOMATED REAL REQUEST E2E — MANDATORY

Focused backend integration/e2e:

```text
Product
→ Request
→ supplier response
→ customer acceptance under policy A
→ pinned A
→ Product mutation to B
→ Request-derived Order still A
→ travelerCount=2
→ missing REQUIRED blocks final-confirm
→ complete travelers
→ final-confirm
→ confirm
→ send
→ exactly 1 Booking
→ exactly 2 Passenger
```

Verify `customerAcceptedAt`, `convertedAt`, `convertedOrderId` and chronology.

## 24. TEMPORAL INVARIANTS

Prove applicable chronology:

```text
Request.createdAt
≤ supplier response/current terms event
≤ customerAcceptedAt
= Order.termsAcceptedAt
≤ Order.createdAt (subject to actual event/storage ordering)
≤ travelerDataCompletedAt
< finalConfirmedAt
≤ BookingRequested
≤ Booking.createdAt
```

If `convertedAt` means Order root creation/linking, verify `convertedAt ≈ Order.createdAt`. Never substitute `updatedAt`.

## 25. DB → API → UI → EVENT RECONCILIATION

For permanent visual and completed case prove:

```text
Request.customerAcceptedAt = Order.termsAcceptedAt
Request.convertedOrderId = Order.id
pinned@acceptance = Order.pinnedRequirements = API = UI fields
travelerCount = OrderTraveler count = UI cards
```

Completed case:

```text
OrderTraveler count = Passenger count = 2
Booking.orderId = Order.id
```

## 26. REFERENCES / COMMERCE ROOT

Preserve existing canonical reference architecture (`MKT-REQ-*`, `MKT-ORD-*`, `MKT-BKG-*`) and shared root where applicable. No `MAX()+1`; no relationship inference from strings; FK/UUID authoritative.

## 27. REPRESENTATIVE DATA SAFETY

NO full DB reset. Compare before/after counts for Partners, Customers, Products, Requests, Orders, Bookings, Payments, Refunds. Explain deterministic deltas from permanent visual case(s).

Do not implement D4 representative matrix yet.

```text
REPRESENTATIVE CHAIN COVERAGE ≠ STATUS COVERAGE
```

## 28. CLEAN WORKTREE — MANDATORY

Previous Strict Review had `Working tree clean = PARTIAL` due old untracked artifacts.

Final D3 closure requires:

```text
git status --short
→ EMPTY
```

Review safely: meaningful evidence → canonical evidence dir/commit; disposable temp → delete; generated files → ignore only if justified. Do not blindly delete meaningful evidence.

Final:

```text
push SUCCESS
HEAD == origin/master
working tree clean
```

## 29. REGRESSION

Run focused D3 + relevant Request/Sales/Order/Booking tests. Independently distinguish new failures from proven baseline failures. No new regression. Never claim full suite PASS if false.

## 30. DO NOT FIX UNRELATED ISSUES

Do not remediate here:

```text
Orders KPI 500 / 183 / 0 / 241
READY_FOR_BOOKING KPI semantics
Analytics Active Customers = 51
CRM date-filter drill-down = 92
CRM total customers = 183
raw i18n key crm.filter.clear_dates
Export Framework
Partner attribution
D5/D6 full details
D7 finance
Voucher
```

Preserve these findings for D11/D12/etc.

## 31. HELP / BUSINESS DICTIONARY REQUIREMENT — PRESERVE

Do not implement Help in D3. Preserve roadmap requirement:

```text
СЕРВИС
├ Поддержка
└ Помощь
```

`/app/help` = TravelHub Business Dictionary. In D11 each KPI/status must define:

```text
SOURCE
SCOPE
BUSINESS DEFINITION
FORMULA
PERIOD
STATUS MAPPING
INCLUSIONS
EXCLUSIONS
OVERLAP RULE
RECONCILIATION RULE
DRILL-DOWN
HELP DESCRIPTION
```

Later KPI cards should expose `ⓘ` → short definition → `/app/help`. Do not invent formulas before D11 audit.

## 32. REQUIRED FINAL REPORT

Create:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D3_REQUEST_FLOW_INTEGRATION_FINAL_EVIDENCE_CLOSURE_REPORT.md
```

Predominantly Russian.

Sections:
1. Executive Summary
2. Starting Git State
3. Strict Review F6 Baseline
4. Request Domain Audit
5. Root Cause
6. Canonical Conversion Design
7. Request Acceptance Semantics
8. Requirements Pinning
9. Traveler Count Freeze
10. Request→Order Linking
11. convertedAt / convertedOrderId Semantics
12. Request State Machine
13. Idempotency / Concurrency
14. Traveler Collection Integration
15. Request UI Continuation
16. Booking Gate
17. Passenger Population
18. Security / Tenant Isolation
19. No-Request Regression
20. Permanent Visual Verification Case
21. Browser Runtime
22. Automated Request E2E
23. Temporal Evidence
24. DB/API/UI/Event Reconciliation
25. Representative Data Safety
26. Regression
27. Findings Matrix
28. Files Changed
29. Canonical Architecture Sync
30. Roadmap Closure
31. Git Closure
32. Residual Risks
33. Acceptance Matrix
34. Final Verdict
35. TRUE NEXT

## 33. FINDINGS MATRIX

| ID | Severity | Finding | Root Cause | Remediation | Evidence | Result |
|---|---|---|---|---|---|---|

F6 must become `DONE`. Any new P0/P1 must also be closed for VERDICT A.

## 34. ACCEPTANCE MATRIX — HARD

| Gate | Result | Evidence |
|---|---|---|
| Request domain audited | | |
| One canonical conversion architecture | | |
| Real Request customer acceptance event | | |
| termsAcceptedAt uses Request acceptance | | |
| Requirements pinned at Request acceptance | | |
| Acceptance→pin race impossible | | |
| Product mutation after acceptance preserves snapshot | | |
| Traveler count frozen | | |
| Request→Order relation by FK/UUID | | |
| convertedOrderId correct | | |
| convertedAt semantics canonical | | |
| Invalid Request states cannot convert | | |
| Double conversion idempotent | | |
| Concurrent conversion safe | | |
| Request uses shared D3 traveler contract | | |
| Exactly 2 travelers representative case | | |
| REQUIRED validation server-side | | |
| Save→refresh→resume | | |
| Final confirmation required | | |
| Booking impossible before finalConfirmedAt | | |
| Exactly 1 Booking after send | | |
| Exactly 2 Passenger | | |
| Customer ≠ Payer ≠ Traveler | | |
| Foreign tenant denied | | |
| PII contract preserved | | |
| No-Request flow still works | | |
| Real Request E2E automated | | |
| Browser Request acceptance | | |
| Browser continuation to travelers | | |
| Browser validation failure | | |
| Browser save/resume | | |
| Browser pre-confirm Booking denial | | |
| Browser successful E2E | | |
| Permanent visual case survives tests | | |
| Exact Request code/UUID/URL documented | | |
| Exact Order code/UUID/URL documented | | |
| Booking code/UUID documented or NONE | | |
| DB/API/UI/Event reconciliation | | |
| Temporal chronology correct | | |
| Representative DB preserved | | |
| No new regression | | |
| Canonical docs synced if needed | | |
| Roadmap synced | | |
| `git status --short` empty | | |
| HEAD == origin/master | | |
| Push SUCCESS | | |
| Russian report | | |

Every PASS requires concrete evidence.

## 35. ROADMAP CLOSURE

Only after every blocking gate PASS:

```text
D3 — ACCEPTED
```

Preserve sequence:

```text
D4  Traveler Security + Representative Data
    + Representative End-to-End Commerce Chain Coverage
D5  Orders Full-Page Detail
D6  Bookings Full-Page Detail
D7  Payment/Refund Semantics + Financial Presentation
D8  Global Temporal Visibility
D9  Export Framework Requalification
D10 Partner Performance Attribution
D11 PROJECT-WIDE KPI / STATUS SEMANTICS
    + TOTAL RECONCILIATION AUDIT & REMEDIATION
    + Business Dictionary / Help KPI semantics
D12 CRM / KPI Drill-down Routing Requalification
    + Active Customers 51 → CRM filtered 51
    + investigate 183 / 92 / 51 populations
    + raw i18n crm.filter.clear_dates
D13 Voucher
D14 PRE-STEP 3.12 Final Requalification
STEP 3.12
```

No silent renumbering.

## 36. GIT REQUIREMENTS

Start:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
```

End after all runtime evidence/report/roadmap updates:

```bash
git diff --check
git status --short
git add ...
git commit -m "..."
git push origin master
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

Report exact Starting SHA, Final SHA, origin/master, HEAD==origin/master, working tree state.

## 37. VERDICT

Success only if F6 and all hard gates close:

```text
VERDICT A — D3 REQUEST FLOW INTEGRATION
FINAL EVIDENCE CLOSURE PASSED — D3 ACCEPTED
```

Failure:

```text
VERDICT B — D3 REQUEST FLOW INTEGRATION
FINAL EVIDENCE CLOSURE FAILED — D3 REMAINS OPEN
```

VERDICT A forbidden if Request remains unwired, Request E2E absent, pin occurs late, Product mutation changes accepted snapshot, count not frozen, conversion relation inferred from codes, Booking can start before final confirmation, duplicate conversion exists, permanent visual case is missing/disappears after tests, exact URLs/IDs are absent, Git dirty, HEAD != origin/master, or report predominantly English.

## 38. TRUE NEXT

Only after VERDICT A:

```text
D3 — ACCEPTED

TRUE NEXT:
D4 — TRAVELER SECURITY + REPRESENTATIVE DATA
     + REPRESENTATIVE END-TO-END COMMERCE CHAIN COVERAGE

NOT STARTED.
```

If VERDICT B:

```text
D3 REMAINS OPEN
TRUE NEXT: D3 TARGETED REMEDIATION
D4 NOT STARTED.
```

## 39. STOP RULE

After Final Evidence Closure report:

```text
STOP.
```

Do not start D4 automatically.
