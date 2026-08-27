# PHASE 3 — STEP 3.5 — PLATFORM CRM
## ROUND 5B.1 — PAYMENT / REFUND BUSINESS DATE AUTHORITY REMEDIATION
## CANONICAL FINANCIAL EVENT TIMESTAMPS / TABLE SEMANTICS / RUNTIME PROOF

---

# 1. STATUS

Round 5B V2 reported:

```text
VERDICT A
Platform CRM Round 5B Tabular UX Consistency — VISUAL CLOSURE COMPLETE
Commit: 82883f4
```

The tabular UX portion is substantially implemented, but the Business Date Authority requirement was not satisfied for Payment and Refund.

Reported implementation:

```text
Payment
UI label: Создан
Source: createdAt
Semantics: creation of Payment record

Refund
UI label: Создан
Source: createdAt
Semantics: creation of Refund request
```

This directly conflicts with the Round 5B V2 contract.

Therefore the previous final visual closure is NOT accepted yet.

Current qualification:

```text
VERDICT B — ROUND 5B V2 BUSINESS DATE AUTHORITY NOT IMPLEMENTED
```

This remediation is intentionally narrow.

Do NOT redo the completed table work.

---

# 2. ACCEPTED PARTS OF ROUND 5B

Preserve the already implemented work unless runtime inspection finds a genuine defect:

```text
Customer 360 Orders → table + created date
Customer 360 Bookings → table + created date
Customer 360 Payments → table
Customer 360 Refunds → table
Customer 360 Partners → "Сумма заказов"

Partner 360 Services → created date
Partner 360 Orders → Customer link + created date
Partner 360 Bookings → created date
Partner 360 Customers → last activity + "Сумма заказов"

RU/AZ/EN table i18n
existing entity deep links
existing loading/error/empty behavior
```

---

# 3. OBJECTIVE

Correct only the financial business-date semantics:

```text
Payment
→ when did the payment actually occur?

Refund
→ when did the refund actually occur?
```

Hard invariant:

```text
record creation time
!=
financial business event time
```

unless the architecture explicitly and provably defines them as the same event.

---

# 4. PAYMENT — REQUIRED UI SEMANTICS

Customer 360 → Payments must expose:

```text
Дата оплаты
```

for a successfully paid/captured/completed Payment.

The source must be the canonical timestamp representing the actual successful payment event.

Potential field names are examples only:

```text
paidAt
capturedAt
completedAt
processedAt
```

Do NOT assume any of these exist.

Audit the actual project first.

---

# 5. PAYMENT — FORBIDDEN SHORTCUT

The following is NOT acceptable:

```text
Label: Создан
Source: createdAt
```

as a substitute for the required payment business date.

Also forbidden:

```text
Label: Дата оплаты
Source: createdAt
```

unless the architecture and write path explicitly prove that Payment creation and successful payment are the same canonical event.

Changing only the label is not a fix.

---

# 6. REFUND — REQUIRED UI SEMANTICS

Customer 360 → Refunds must expose:

```text
Дата возврата
```

for an actually completed/refunded financial operation.

The source must be the canonical timestamp representing the actual refund event.

Potential field names are examples only:

```text
refundedAt
completedAt
processedAt
```

Do NOT assume these exist.

Audit actual schema and lifecycle.

---

# 7. REFUND REQUEST DATE ≠ REFUND DATE

A Refund may have multiple important timestamps:

```text
request created
approved
processing started
money returned
```

These are not interchangeable.

Example:

```text
26.08 — request created
28.08 — approved
30.08 — money actually returned
```

The business field:

```text
Дата возврата
```

must represent `30.08`, not `26.08`.

If useful, the UI may additionally expose:

```text
Дата запроса
```

but this is secondary and must not replace `Дата возврата`.

---

# 8. FIRST GATE — AUDIT ACTUAL DOMAIN MODEL

Before changing code, inspect actual Payment and Refund models.

At minimum inspect:

```text
Prisma schema / entities
migrations
Payment service
Refund service
payment provider/webhook handlers
refund processing handlers
seed/test factories
status enums
existing timestamps
```

Do not infer the model from frontend types alone.

---

# 9. PAYMENT LIFECYCLE AUDIT

Document actual Payment statuses and transitions.

Required matrix:

| Payment status | Meaning | Financial event occurred? | Canonical event timestamp |
|---|---|---:|---|
| | | | |

Determine exactly when the system considers money successfully paid/captured.

Examples such as:

```text
PENDING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
```

are not instructions to invent statuses.

Use actual project values.

---

# 10. REFUND LIFECYCLE AUDIT

Document actual Refund statuses and transitions.

Required matrix:

| Refund status | Meaning | Money actually returned? | Canonical event timestamp |
|---|---|---:|---|
| | | | |

Distinguish at minimum, where actual model supports them:

```text
requested
approved
completed/refunded
failed/rejected
```

---

# 11. FIND EXISTING CANONICAL TIMESTAMP FIRST

Preferred outcome:

```text
existing field already records the event
```

If so:

```text
reuse it
```

Do NOT add another duplicate field.

Example only:

```text
Payment.capturedAt
Refund.refundedAt
```

---

# 12. EVENT / AUDIT SOURCE

If no direct timestamp column exists, inspect whether canonical event time is already stored in:

```text
payment events
provider webhook events
status history
audit/history
refund events
transaction records
```

If an existing canonical source reliably represents the event, evaluate whether the API should derive the business date from it.

Document:

```text
source
uniqueness
ordering
idempotency behavior
timezone
failure/retry behavior
```

---

# 13. DO NOT DERIVE FROM UPDATEDAT

Forbidden unless explicitly proven canonical:

```text
updatedAt
```

A record may be updated after payment/refund for unrelated reasons.

Therefore:

```text
updatedAt
```

must not automatically become:

```text
Дата оплаты
Дата возврата
```

---

# 14. IF CANONICAL PAYMENT DATE DOES NOT EXIST

If the architecture currently does NOT persist the actual payment event timestamp:

```text
do not fake it
```

Implement a proper canonical field only after proving the gap.

Preferred conceptual model:

```text
Payment
├── createdAt
└── paidAt / capturedAt / canonical equivalent
```

Use naming consistent with the existing payment lifecycle.

Do not introduce `paidAt` if the domain's actual event is specifically capture and architecture consistently uses `CAPTURED`.

---

# 15. IF CANONICAL REFUND DATE DOES NOT EXIST

If the architecture currently does NOT persist the actual refund event timestamp:

```text
do not fake it
```

Implement a proper canonical field only after proving the gap.

Preferred conceptual model:

```text
Refund
├── createdAt
├── requested/approved timestamps only if architecture needs them
└── refundedAt / completedAt / canonical equivalent
```

Use naming consistent with actual Refund lifecycle.

---

# 16. SCHEMA CHANGE REQUIREMENTS

If new DB fields are required:

```text
migration required
```

Do NOT rely only on:

```text
prisma db push
synchronize=true
manual local ALTER TABLE
```

Production-compatible schema evolution is required.

Report migration name/file.

---

# 17. WRITE-PATH AUTHORITY — PAYMENT

If a Payment business timestamp field is introduced or already exists, prove where it is written.

It must be set by the canonical successful-payment transition.

Examples of possible authorities:

```text
provider webhook
capture confirmation
payment service transition
```

Use actual architecture.

Hard invariant:

```text
timestamp is written when the financial event becomes true
```

not when the frontend happens to refresh.

---

# 18. PAYMENT IDEMPOTENCY

Payment processing/webhooks may retry.

The business date must not drift on repeated idempotent processing.

Required behavior:

```text
first canonical successful event timestamp
→ remains authoritative
```

unless the domain explicitly models multiple captures.

Do not overwrite it with every repeated webhook.

---

# 19. WRITE-PATH AUTHORITY — REFUND

Prove where the actual Refund business timestamp is written.

It must correspond to the canonical event that means:

```text
money was actually returned
```

not merely:

```text
operator approved refund
refund record created
refund requested
```

---

# 20. REFUND IDEMPOTENCY

Repeated provider callbacks/retries must not arbitrarily move:

```text
Дата возврата
```

Required:

```text
canonical completed refund timestamp remains stable
```

unless the domain explicitly models multiple separate refund transactions.

---

# 21. PARTIAL REFUNDS

Audit whether one Payment/Order can have:

```text
multiple partial Refund records
```

If yes, each Refund row must have its own:

```text
amount
business date
status
reason
source Payment/Order
```

Do not use Order-level refund date for every partial Refund.

---

# 22. PAYMENT TABLE TARGET

Customer 360 → Payments:

| Платёж | Дата оплаты | Что оплачено | Сумма | Способ оплаты | Статус |
|---|---|---|---:|---|---|

Preserve current Round 5/5B context.

Representative runtime record if still present:

```text
PAY-00000959
50.88 AZN
CAPTURED
Order ORD-00000959
TH-2026-000959
```

---

# 23. PAYMENT PENDING/FAILED NULL SEMANTICS

For a Payment whose successful financial event has not occurred:

```text
Дата оплаты = —
```

Examples may include actual project equivalents of:

```text
PENDING
FAILED
CANCELLED
```

Do not fill successful-payment date with `createdAt`.

---

# 24. OPTIONAL PAYMENT CREATION DATE

If operational review shows creation time is also useful, it may be shown separately as:

```text
Создан
```

But:

```text
Дата оплаты
```

remains mandatory.

Avoid excessive columns.

If both cannot fit cleanly, prioritize:

```text
Дата оплаты
```

for Payments.

---

# 25. REFUND TABLE TARGET

Customer 360 → Refunds:

| Возврат | Дата возврата | Что возвращено | Исходный платёж | Сумма | Причина | Статус |
|---|---|---|---|---:|---|---|

Preserve existing Round 5 business context.

Representative runtime record if still present:

```text
RFD-F8DB5871781F
→ source Payment
→ Order ORD-00000959
→ canonical reason
```

---

# 26. REFUND PENDING NULL SEMANTICS

For a Refund whose actual financial return has not occurred:

```text
Дата возврата = —
```

A request date may be displayed separately as:

```text
Дата запроса
```

if useful.

Never substitute request date into refund-date column.

---

# 27. APPROVED REFUND

Audit actual meaning of:

```text
APPROVED
```

If `APPROVED` means only:

```text
refund approved but money not yet returned
```

then:

```text
Дата возврата = —
```

If in the current architecture `APPROVED` is itself the terminal successful refund event, prove that contract from code/model and use its canonical timestamp.

Do not guess.

---

# 28. API CONTRACT

Expose explicit semantic fields to frontend.

Preferred conceptual API:

```text
Payment:
paymentDate / capturedAt / canonical semantic field

Refund:
refundDate / refundedAt / canonical semantic field
```

Avoid forcing frontend to infer business dates from:

```text
status + createdAt
status + updatedAt
```

The backend/domain should own financial semantics.

---

# 29. FRONTEND TYPES

Update frontend types to reflect explicit business-date semantics.

Do not use ambiguous:

```text
date
```

when the field specifically means:

```text
paidAt
refundDate
```

Use naming aligned with actual API contract.

---

# 30. I18N

Required labels:

```text
Дата оплаты
Дата возврата
```

and optional:

```text
Дата запроса
Создан
```

must exist in:

```text
RU
AZ
EN
```

Hard gate:

```text
raw i18n keys = 0
```

---

# 31. TIMEZONE

Use the project's canonical timezone contract.

The timestamp stored by backend and rendered by frontend must have documented timezone handling.

Do not apply arbitrary browser-local transformations that conflict with existing project policy.

---

# 32. DATE FORMAT

Use the same localized format as the rest of Platform CRM.

No raw ISO timestamp.

Example visual form only:

```text
26.08.2026, 14:30
```

Use actual project formatting conventions.

---

# 33. BACKFILL — DO NOT FABRICATE HISTORICAL DATES

If a new business timestamp field is introduced, existing historical records may not have the true event time.

Do NOT blindly backfill:

```text
paidAt = createdAt
refundedAt = createdAt
```

unless this equivalence is provably true for those records.

Preferred safe behavior:

```text
unknown historical business date = NULL
UI = —
```

If a reliable event/audit source can reconstruct historical timestamps, document and use it.

---

# 34. SEED / FIXTURE DATA

Update seeds/fixtures only where necessary to model correct semantics.

Seed records may explicitly set:

```text
createdAt
payment business date
refund business date
```

to different values so regression tests prove they are not conflated.

---

# 35. REQUIRED NEAR-MISS TEST — PAYMENT

Create/identify a Payment where:

```text
createdAt != actual payment date
```

Required:

```text
UI displays actual payment date
UI does NOT display createdAt as payment date
```

This is a mandatory proof.

---

# 36. REQUIRED NEAR-MISS TEST — REFUND

Create/identify a Refund where:

```text
request createdAt != actual refund date
```

Required:

```text
UI displays actual refund date
UI does NOT display request creation date as refund date
```

Mandatory.

---

# 37. REQUIRED PENDING PAYMENT TEST

Create/identify a non-successful Payment.

Required:

```text
createdAt exists
payment business date does not exist
UI: Дата оплаты = —
```

This proves absence is not replaced by creation time.

---

# 38. REQUIRED PENDING REFUND TEST

Create/identify a Refund that has been requested but not financially completed, if the domain supports such a state.

Required:

```text
request createdAt exists
refund business date does not exist
UI: Дата возврата = —
```

---

# 39. EXISTING BUSINESS CONTEXT MUST NOT REGRESS

Payment must still show:

```text
what is being paid
Order reference
business order number
amount
method where canonical
status
```

Refund must still show:

```text
what is being refunded
source Payment
source Order
amount
reason
status
```

---

# 40. ENTITY LINKS MUST NOT REGRESS

Preserve:

```text
Order → exact Order Detail
Booking → exact Booking Detail where shown
Service/Product → exact detail where shown
Partner → Partner 360
Customer → Customer 360
```

Do not add fake Payment/Refund Detail routes.

---

# 41. ERROR / EMPTY / NULL

Distinguish:

```text
no rows
API error
row exists but business date is NULL
```

For a row with no completed financial event:

```text
date cell = —
```

Do NOT hide the whole Payment/Refund row.

---

# 42. SECURITY / AUTHORITY

Do not weaken existing Platform CRM permissions or scoping.

No Partner workspace changes.

---

# 43. NO OPERATIONAL NOTES YET

Do NOT implement the separately discussed Operational Notes / Comments architecture in this round.

Specifically do not add ad hoc:

```text
note TEXT
comment TEXT
operatorNote TEXT
```

to Payment/Refund/Order/Booking as part of this remediation.

Notes will be handled as a separate architecture stage.

---

# 44. NO STOREFRONT PRO CRM

Do NOT start:

```text
Storefront Pro CRM
Marketplace Basic CRM finalization
Partner workspace sidebar implementation
```

---

# 45. REQUIRED PAYMENT BUSINESS DATE MATRIX

| Scenario | Status | createdAt | Canonical payment date | UI `Дата оплаты` | PASS |
|---|---|---|---|---|---|
| Successful Payment | | | | | |
| Pending/non-successful Payment | | | | — | |
| createdAt differs from payment date | | | | payment date | |
| repeated callback/event | | | stable | stable | |

Use actual statuses.

---

# 46. REQUIRED REFUND BUSINESS DATE MATRIX

| Scenario | Status | request createdAt | Canonical refund date | UI `Дата возврата` | PASS |
|---|---|---|---|---|---|
| Requested/pending Refund | | | | — | |
| Approved but not returned, if supported | | | | — | |
| Completed Refund | | | | refund date | |
| request date differs from refund date | | | | refund date | |
| repeated callback/event | | | stable | stable | |

Use actual statuses.

---

# 47. REQUIRED DOMAIN AUTHORITY MATRIX

| Entity | Creation timestamp | Business event | Canonical business-date source | Write authority | Idempotent? |
|---|---|---|---|---|---|
| Payment | | successful payment | | | |
| Refund | | actual financial return | | | |

No unresolved field is permitted for VERDICT A.

---

# 48. BROWSER VERIFICATION — PAYMENT

On the same localhost runtime observed by the user:

```text
Customer 360
→ Платежи
```

prove:

```text
column label = Дата оплаты
successful Payment shows actual payment date
non-successful Payment shows —
createdAt is not masquerading as payment date
business context remains visible
Order link works
```

---

# 49. BROWSER VERIFICATION — REFUND

On the same localhost runtime:

```text
Customer 360
→ Возвраты
```

prove:

```text
column label = Дата возврата
completed Refund shows actual refund date
pending/requested Refund shows —
request creation date is not masquerading as refund date
reason remains visible
source Payment remains visible
Order link works
```

---

# 50. DATABASE EVIDENCE

For representative Payment and Refund records report:

```text
ID
status
createdAt
canonical business date
difference between timestamps
```

At least one near-miss must prove:

```text
createdAt != business date
```

for each entity, where the lifecycle supports it.

---

# 51. TESTS

Add focused tests for:

```text
successful Payment business date
pending Payment null business date
Payment createdAt != payment date
successful Refund business date
pending/requested Refund null business date
Refund createdAt != refund date
business date serialization
frontend table rendering
RU/AZ/EN labels
```

If schema/write paths change, include backend tests.

---

# 52. REGRESSION GATES

Required:

```text
Backend TSC
Frontend TSC
Backend tests
Frontend tests
Backend build
Frontend build
```

If backend truly requires no code change because canonical fields already exist, explain and still run relevant backend verification.

---

# 53. MIGRATION GATE

If schema changes:

```text
migration applies cleanly
migration is committed
Prisma/client regeneration where required
tests use migrated schema
```

No local-only DB mutation.

---

# 54. RUNTIME PARITY

Repeat the Round 5A discipline.

Report:

```text
Repository path
HEAD
origin/master
Frontend PID/CWD
Backend PID/CWD
API target
```

Browser evidence must come from the same localhost runtime observed by the user.

---

# 55. ACCEPTANCE CRITERIA

VERDICT A only if all applicable criteria pass:

1. Actual Payment model audited.
2. Actual Refund model audited.
3. Payment lifecycle documented.
4. Refund lifecycle documented.
5. Payment successful financial event identified.
6. Refund actual financial-return event identified.
7. Canonical Payment business-date source identified.
8. Canonical Refund business-date source identified.
9. `updatedAt` not used as shortcut.
10. Payment `createdAt` not used as payment date unless equivalence is explicitly proven.
11. Refund request `createdAt` not used as refund date.
12. Missing canonical timestamp is implemented correctly if necessary.
13. Schema migration exists if schema changed.
14. Payment write authority proven.
15. Refund write authority proven.
16. Payment timestamp is idempotent.
17. Refund timestamp is idempotent.
18. Historical dates are not fabricated.
19. Payment API exposes explicit business-date semantics.
20. Refund API exposes explicit business-date semantics.
21. Frontend types use explicit semantics.
22. Payment table label = `Дата оплаты` in RU.
23. Refund table label = `Дата возврата` in RU.
24. AZ labels PASS.
25. EN labels PASS.
26. Raw i18n keys = 0.
27. Successful Payment shows actual business date.
28. Pending/non-successful Payment shows `—`.
29. Payment near-miss `createdAt != payment date` PASS.
30. Completed Refund shows actual business date.
31. Requested/pending Refund shows `—`.
32. Refund near-miss `createdAt != refund date` PASS.
33. Approved-vs-completed Refund semantics documented.
34. Partial Refund semantics audited.
35. Payment business context preserved.
36. Refund business context preserved.
37. Payment amount/status preserved.
38. Refund amount/status/reason preserved.
39. Order deep link preserved.
40. No fake Payment Detail route added.
41. No fake Refund Detail route added.
42. Null date does not hide row.
43. Error != empty preserved.
44. Payment Business Date Matrix supplied.
45. Refund Business Date Matrix supplied.
46. Domain Authority Matrix supplied.
47. DB evidence supplied.
48. Browser Payment proof supplied.
49. Browser Refund proof supplied.
50. Runtime parity supplied.
51. Backend TSC PASS.
52. Frontend TSC PASS.
53. Backend tests PASS.
54. Frontend tests PASS.
55. Backend build PASS.
56. Frontend build PASS.
57. Migration PASS if applicable.
58. Operational Notes not implemented in this round.
59. Storefront Pro CRM not started.
60. Unrelated files = 0.
61. Commit pushed.
62. HEAD == origin/master.
63. Manual browser behavior matches final report.

---

# 56. VERDICT

Success:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM ROUND 5B.1 /
PAYMENT BUSINESS DATE AUTHORITY /
REFUND BUSINESS DATE AUTHORITY /
CANONICAL FINANCIAL EVENT TIMESTAMPS /
TABLE SEMANTICS
FULLY IMPLEMENTED AND RUNTIME-VERIFIED
```

Failure:

```text
VERDICT B — PLATFORM CRM ROUND 5B.1 FINANCIAL BUSINESS DATE AUTHORITY INCOMPLETE
```

No conditional VERDICT A.

---

# 57. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_ROUND_5B.1_PAYMENT_REFUND_BUSINESS_DATE_AUTHORITY_REPORT.md
```

---

# 58. FINAL RESPONSE FORMAT

```text
VERDICT:

PREVIOUS ROUND 5B STATUS:
Tabular UX:
Business Date Authority:

ROOT CAUSE:

PAYMENT MODEL:
Statuses:
Creation timestamp:
Successful financial event:
Canonical business-date field/source:
Write authority:
Idempotency:

REFUND MODEL:
Statuses:
Request timestamp:
Approval semantics:
Actual financial-return event:
Canonical business-date field/source:
Write authority:
Idempotency:
Partial refunds:

SCHEMA CHANGE:
Required:
Migration:
Backfill policy:

PAYMENT TABLE:
Columns:
Date label:
Date source:
Successful behavior:
Pending behavior:
Representative Payment:
createdAt:
payment date:

REFUND TABLE:
Columns:
Date label:
Date source:
Requested behavior:
Approved behavior:
Completed behavior:
Representative Refund:
createdAt:
refund date:

PAYMENT BUSINESS DATE MATRIX:
...

REFUND BUSINESS DATE MATRIX:
...

DOMAIN AUTHORITY MATRIX:
...

DATABASE EVIDENCE:
...

BROWSER PAYMENT EVIDENCE:
...

BROWSER REFUND EVIDENCE:
...

I18N:
RU:
AZ:
EN:
Raw keys:

RUNTIME:
Repository:
HEAD:
origin/master:
Frontend PID/CWD:
Backend PID/CWD:
API target:

Backend TSC:
Frontend TSC:
Backend tests:
Frontend tests:
Backend build:
Frontend build:
Migration:

Production files changed:
Unrelated files:
Commit:
HEAD:
origin/master:
HEAD == origin/master:

Report:
Remaining findings:
Next canonical stage:
```

---

# 59. STOP

After the report:

```text
STOP
```

Do not start Operational Notes / Comments implementation.

Do not start Storefront Pro CRM.

Only after this Round receives VERDICT A and manual browser verification confirms the dates may Round 5B be considered fully closed.

The next planned stage after that is:

```text
Operational Notes / Comments Architecture Reconciliation
```
