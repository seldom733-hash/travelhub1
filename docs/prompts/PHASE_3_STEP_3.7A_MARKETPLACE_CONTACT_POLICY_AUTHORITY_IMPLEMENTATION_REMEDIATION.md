# PHASE 3 — STEP 3.7A — MARKETPLACE CONTACT POLICY AUTHORITY — IMPLEMENTATION / REMEDIATION PROMPT

## MODE

**IMPLEMENTATION / REMEDIATION.**

This is the first implementation slice after the completed Step 3.7 Communication Integration architecture/repository audit.

Do not redesign the entire communication subsystem.

Do not implement full automated moderation.

Do not add WebSocket/SSE merely because realtime is absent.

Do not create a second CRM, second communication store, or second contact-policy system.

The objective is narrow and critical:

```text
Marketplace Basic
→ must not receive unrestricted Customer direct-contact data
  through CRM / Order / Booking / related APIs or UI

Storefront Pro
→ may retain direct-contact visibility according to entitlement/business model
```

The enforcement must be **server-side**, reusable, and consistent across all affected surfaces.

---

# 1. Canonical audit baseline

Step 3.7 audit completed with:

```text
VERDICT A — STEP 3.7 AUDIT COMPLETE — READY FOR IMPLEMENTATION PLANNING
```

Expected latest canonical roadmap baseline:

```text
36ce652
```

Verify actual repository state before implementation:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log --oneline -20
```

Do not reset valid later work.

---

# 2. Audit findings that define this step

The communication audit established:

```text
Pre-sale Buyer ↔ Marketplace Partner chat
→ implemented

chat body/subject anti-disintermediation
→ email/phone/URL/social detection
→ 422 rejection

tenant isolation
→ server-side membership enforced
→ no demonstrated cross-tenant IDOR

BUT:

Marketplace Basic CRM
→ exposes Customer email/phone

Marketplace Basic Order detail
→ exposes Customer direct-contact data

Booking
→ may expose through Order linkage
```

Therefore chat filtering alone is insufficient.

This is a **Marketplace contact-policy bypass**, not a demonstrated cross-tenant leak.

---

# 3. Canonical business policy

## Marketplace Basic

TravelHub is the intermediary.

Marketplace Basic Partner may receive only the Customer information required to fulfill legitimate marketplace operations.

Marketplace Basic must not automatically receive unrestricted direct-contact data enabling off-platform disintermediation.

Conceptually restricted fields include, subject to exact repository evidence:

```text
email
phone
personal messaging handles
social handles
direct personal contact links
other direct-contact fields
```

Do not over-redact operationally necessary non-contact information.

---

# 4. Storefront Pro

Storefront Pro has a direct business relationship model.

For Pro:

```text
direct Customer contact information
→ may remain available
```

according to existing entitlement/business behavior.

Do not accidentally apply Marketplace Basic restrictions to Pro.

---

# 5. Customer / PCR distinction

Preserve:

```text
Customer
= global identity

PartnerCustomerRelation
= Partner-scoped business relationship
```

Do not mutate global Customer records to hide data.

Do not null Customer.email or Customer.phone in DB.

Policy enforcement must occur at the authorized read/serialization/access layer.

---

# 6. Core architectural requirement

Create or reuse one canonical server-side policy authority for Partner-facing Customer contact exposure.

Conceptual contract:

```text
Partner Contact Policy Resolver
    ↓
actor / partnerId
    ↓
workspace
    ↓
entitlement tier
    ↓
business context
    ↓
allowed customer fields
```

Do not implement independent ad-hoc field stripping in every controller if a reusable service/serializer/policy can safely cover them.

Actual naming must follow repository conventions.

Do not invent a new framework if an existing policy/serializer/capability layer already exists.

---

# 7. Mandatory repository discovery before coding

Search for existing:

```text
entitlement resolver
Partner CRM tier resolver
capability service
policy service
serializer
presenter
DTO mapper
response mapper
field mask
PII policy
redaction
projection mapper
PartnerCustomer DTO
Order detail DTO
Booking detail DTO
```

Use the smallest existing architectural seam.

Document what is reused vs new.

---

# 8. Tier authority

Use the existing canonical Partner tier authority.

Do not infer Pro from frontend state.

Do not trust request payload.

Canonical existing model should remain based on actual Partner storefront/entitlement logic.

Verify exact service.

Expected conceptual result:

```text
Marketplace Basic
→ BASIC

active storefront + active entitlement
→ PRO
```

Use repository truth.

---

# 9. Server-side enforcement — mandatory

Frontend hiding is not sufficient.

The direct APIs consumed by Marketplace Basic must return policy-safe data.

At minimum inspect and remediate:

```text
GET /partner/customers
GET /partner/customers/:id
Order list/detail APIs visible to Partner
Booking list/detail APIs visible to Partner
any Partner-facing Sales/CRM APIs returning Customer identity
```

Also inspect:

```text
exports
search results
quick previews
dashboard drilldowns
notifications
API aggregates containing contact strings
```

Do not assume only the audited CRM detail endpoint is affected.

---

# 10. Surface inventory

Before changes, produce exact matrix:

| Surface | Endpoint | Basic contact exposed? | Pro contact exposed? | Required change |
|---|---|---:|---:|---|

Include at minimum:

```text
Partner CRM list
Partner CRM detail
Partner Orders list
Partner Order detail
Partner Bookings list
Partner Booking detail
Sales Center Partner views if any
exports if any
notifications if contact-bearing
```

Do not implement until this inventory is complete.

---

# 11. Field inventory

Identify every direct-contact field actually present.

Do not assume only:

```text
email
phone
```

Search Customer/User/Order/Booking DTOs for:

```text
email
phone
mobile
whatsapp
telegram
social
contact
contactEmail
contactPhone
messenger
website
```

Classify each:

```text
DIRECT CONTACT
OPERATIONAL LOCATION
COMPANY CONTACT
SYSTEM IDENTIFIER
NOT CONTACT
AMBIGUOUS
```

Do not hide business-critical service addresses just because they contain address-like data.

---

# 12. Basic response behavior

For Marketplace Basic, choose one canonical response strategy based on repository conventions:

```text
omit restricted fields
or
return null
or
return masked value
```

Do not mix arbitrary strategies across endpoints.

Preferred behavior should minimize accidental leakage and frontend ambiguity.

If current API contracts rely on nullable fields, null may be appropriate.

If serializer omission is canonical, use omission.

Document the decision.

---

# 13. Do not fake masking

Avoid weak masking such as:

```text
n***@gmail.com
+994 ** *** ** **
```

if the masked value still enables off-platform identification or if policy requires no disclosure.

Use masking only if there is an established business requirement.

Otherwise omit/null.

---

# 14. Pro behavior

For Storefront Pro, preserve full legitimate contact display where currently allowed.

Pro API responses must continue to contain the expected Customer contact fields.

Test this explicitly.

---

# 15. Platform behavior

Platform CRM/support/admin views must remain unaffected unless current architecture explicitly reuses Partner-safe DTOs.

Do not accidentally redact Platform Customer CRM.

Platform requires identity/support/security visibility according to existing permissions.

---

# 16. Customer self-view behavior

Customer-facing own profile/order/booking surfaces must not be affected by Partner contact policy.

This is a Partner-facing disclosure policy.

Do not globally sanitize Customer DTOs.

---

# 17. Order authority

Audit exact Order response mapping.

Marketplace Basic likely requires operational customer identity such as:

```text
customer code
display name
order code
booking/service details
```

but direct email/phone should follow Marketplace policy.

Do not break fulfillment fields needed for service execution.

If the business currently genuinely requires phone at a specific fulfillment stage, do not guess.

Instead classify:

```text
always hidden
stage-dependent
operational exception
```

based on canonical evidence.

Do not invent an exception.

---

# 18. Booking authority

Apply the same analysis to Booking.

If Booking inherits Customer contact indirectly from Order, fix the shared source rather than only the frontend.

Ensure:

```text
Basic direct API
→ no accidental contact leakage

Pro
→ legitimate full contact
```

---

# 19. Partner CRM Basic

Expected after remediation:

```text
Marketplace Basic
→ Customer list/detail allowed
→ customer identity context allowed
→ direct contact restricted
→ no manual intake
→ no PCR full CRM editing
```

Do not remove the entire customer detail just to solve contact exposure.

---

# 20. Partner CRM Pro

Expected:

```text
Storefront Pro
→ full CRM relation
→ direct Customer contact allowed
→ manual intake
→ lifecycle/source/tags
```

No regression.

---

# 21. Pre-sale chat policy

Do not remove the existing anti-disintermediation check.

Keep:

```text
email/phone/URL/social
→ rejected in pre-sale Marketplace chat
```

Do not implement advanced obfuscation detection in 3.7A unless required to fix a regression caused by this step.

Full moderation remains deferred.

---

# 22. Communication channel consistency

After remediation, policy should be coherent:

```text
Marketplace Basic chat
→ direct contact blocked

Marketplace Basic CRM
→ direct contact restricted

Marketplace Basic Order
→ direct contact restricted

Marketplace Basic Booking
→ direct contact restricted
```

while:

```text
Storefront Pro
→ direct-contact-capable according to entitlement
```

This consistency is the core closure invariant.

---

# 23. Direct API bypass tests

P0/P1 mandatory negative tests.

For a real Basic Partner, call direct APIs and prove contact fields are not exposed.

At minimum:

```text
GET /partner/customers
GET /partner/customers/:id
Partner Order detail
Partner Booking detail
```

Use current real routes.

Do not substitute UI screenshots.

---

# 24. Pro direct API proof

For a real Pro Partner, call equivalent APIs and prove legitimate contact fields remain available.

No accidental over-redaction.

---

# 25. Cross-partner isolation regression

Even though the audit found no P0 tenant leak, rerun enough isolation tests to prove this policy layer does not weaken tenant scoping.

At minimum:

```text
Partner A cannot read Partner B customer
Partner A cannot read Partner B Order/Booking
```

Expected canonical 403/404 behavior.

---

# 26. Serialization order

Be careful with architecture order:

```text
authorization/scope
→ entity fetch
→ entitlement resolution
→ response policy/redaction
```

Do not perform redaction as a substitute for authorization.

A Basic Partner must not be able to query arbitrary Customers and merely receive redacted data.

Tenant/business relationship authorization remains mandatory first.

---

# 27. Cache risk

If responses are cached, inspect whether cache keys include:

```text
partnerId
tier/entitlement
workspace
```

A shared cached Pro response must never be served to Basic.

If no cache exists, state N/A.

Do not add caching.

---

# 28. Logging risk

Inspect whether restricted contact fields are written into:

```text
application logs
audit logs
debug logs
frontend console
analytics events
```

3.7A does not require broad log redaction unless Partner-visible or security-critical leakage exists.

Report any discovered high-risk leak.

---

# 29. Frontend Basic behavior

Update UI only as needed to match safe API response.

For Basic:

```text
no email/phone values
no empty broken labels if fields omitted
no misleading "undefined"
```

If contact fields are hidden, use clean UX:

```text
field absent
or
policy-aware placeholder
```

according to existing design.

Do not add a large explanatory banner unless product design already supports it.

---

# 30. Frontend Pro behavior

Pro must still render contact fields correctly.

Verify RU/AZ/EN.

No raw keys.

---

# 31. i18n

If new policy labels/messages are introduced, add:

```text
RU
AZ
EN
```

Examples only if needed:

```text
Contact available in Storefront Pro
Direct contact hidden for Marketplace transactions
```

Do not add text unless UI requires it.

Prefer simple omission where sufficient.

---

# 32. Server response contract tests

Add/extend tests for:

```text
Basic list response
Basic detail response
Pro list response
Pro detail response
Basic Order response
Pro Order response
Basic Booking response
Pro Booking response
```

Assert exact field presence/absence/null behavior.

Do not only snapshot broad objects.

---

# 33. Entitlement regression tests

At minimum:

```text
Basic
→ restricted contact

Pro
→ contact available

tier spoofing from request
→ impossible

inactive/expired storefront entitlement
→ BASIC behavior
```

Use current entitlement semantics.

---

# 34. Role/permission separation

Do not confuse:

```text
permission to read customer/order
```

with:

```text
entitlement to receive direct-contact fields
```

A Basic Partner may have:

```text
crm.customer.read_own
```

and still receive a restricted representation.

This is intentional.

---

# 35. Platform role regression

Verify internal Platform roles with legitimate CRM/Order access still receive the expected full data.

At least one Platform role runtime/API proof.

---

# 36. Customer data ownership

Do not create duplicated Basic-safe Customer records.

No:

```text
BasicCustomer
MaskedCustomer
MarketplaceCustomerCopy
```

Use response policy over canonical Customer data.

---

# 37. Historical data

Do not rewrite existing Customer/Order/Booking records.

This step changes access/disclosure behavior, not historical ownership.

---

# 38. Exports

If Partner export endpoints exist and contain Customer contact data:

```text
Basic export
→ must follow same restriction

Pro export
→ may preserve legitimate contact
```

If no exports exist, state N/A.

This is mandatory to inspect because export is a common bypass.

---

# 39. Notifications

If Partner notifications include Customer contact in payload/text, inspect.

Do not leave a bypass where CRM is safe but notification exposes email/phone.

If no such payload exists, state N/A.

---

# 40. Search/autocomplete

Inspect Partner search/autocomplete endpoints for Customer data.

Basic search must not leak direct contact fields.

---

# 41. Error responses

Do not leak restricted contact data in validation/error payloads.

If error serializers include entity snapshots, fix.

---

# 42. Graph/API alternate paths

Search for duplicate/legacy Partner endpoints that expose the same Customer/Order/Booking data.

Do not secure only one canonical UI path while leaving an old API bypass.

Report all discovered routes.

---

# 43. Storefront structured contacts

Do not confuse:

```text
Storefront business contact information
```

with:

```text
Customer personal direct contact
```

Storefront business contacts are expected to be visible in Pro storefront context.

Do not redact Partner's own public business contact data.

---

# 44. Customer-facing Partner contact

This step is primarily Customer-data exposure to Marketplace Partner.

However, audit the reverse direction enough to ensure no accidental regression.

Do not broaden scope into full Customer-facing contact-policy redesign unless an obvious same-root bypass exists.

Report it separately if found.

---

# 45. No full moderation implementation

Out of scope:

```text
ALLOW / REDACT / BLOCK / REVIEW engine
zero-width normalization
homoglyph normalization
semantic circumvention
attachment scanning
moderation review queue
moderation versioning
```

Do not implement these in 3.7A.

---

# 46. No Communication schema redesign

Do not change:

```text
Communication
CommunicationThread
```

unless this field-access policy truly requires it, which is not expected.

No new communication DB model should be necessary.

---

# 47. No realtime work

Do not implement:

```text
WebSocket
Socket.IO
SSE
polling framework
```

in this step.

---

# 48. No email integration

Do not implement SMTP/provider/email history here.

That remains a later Step 3.7 slice if canonical roadmap confirms it.

---

# 49. No CRM Activity projection

Do not implement MESSAGE → CrmActivity in 3.7A.

That belongs to a later communication-history slice.

---

# 50. Mandatory browser/runtime scenarios

## Scenario A — Marketplace Basic CRM

Verify:

```text
/partner/customers
customer detail
```

Expected:

```text
Customer business context visible
direct contact absent/restricted
no broken UI
```

---

# 51. Scenario B — Marketplace Basic Order

Open a real Basic Partner Order.

Expected:

```text
order details visible
customer operational identity visible
restricted direct-contact fields absent
```

---

# 52. Scenario C — Marketplace Basic Booking

Open a real Basic Partner Booking.

Expected same policy.

---

# 53. Scenario D — Storefront Pro CRM

Expected:

```text
full legitimate Customer direct-contact data still visible
```

---

# 54. Scenario E — Storefront Pro Order/Booking

If Pro uses these same surfaces, verify no accidental redaction.

---

# 55. Scenario F — Platform CRM

Expected:

```text
full internal Customer identity still visible
```

according to current permissions.

---

# 56. Scenario G — chat regression

Use Marketplace pre-sale chat.

Verify:

```text
normal message
→ allowed

email/phone/URL contact attempt
→ rejected
```

No regression.

---

# 57. RU/AZ/EN

Runtime verify affected UI in:

```text
RU
AZ
EN
```

No raw keys.

If Basic simply omits fields with no new labels, verify layout remains correct in all locales.

---

# 58. Security test matrix

At minimum include:

```text
1. Basic CRM list does not expose email
2. Basic CRM list does not expose phone
3. Basic CRM detail does not expose email
4. Basic CRM detail does not expose phone
5. Basic Order detail does not expose restricted contact
6. Basic Booking detail does not expose restricted contact
7. Pro CRM still exposes legitimate email/phone
8. Pro Order/Booking behavior preserved
9. Platform behavior preserved
10. Partner A cannot access Partner B customer
11. Partner A cannot access Partner B Order
12. Partner A cannot access Partner B Booking
13. request tier spoofing ineffective
14. expired/inactive Pro entitlement resolves to Basic policy
15. chat contact regex still rejects
16. normal chat message still succeeds
17. legacy/alternate Partner endpoint does not bypass policy
18. export/search/notification alternate path checked
```

Use actual available surfaces.

---

# 59. Test suites

Run exact relevant suites and report X/X separately.

At minimum:

```text
Partner CRM
CRM
Orders
Bookings
Communication
Entitlement/capability
Frontend
Backend TSC
Frontend TSC
```

If some suites do not exist, state that and name the exact covering suites.

Do not report only one aggregate total.

---

# 60. Data evidence

No DB migration expected.

Report:

```text
schema changes: 0 expected
migration changes: 0 expected
historical Customer records changed: 0 expected
historical Order records changed: 0 expected
historical Booking records changed: 0 expected
```

If reality differs, explain why.

---

# 61. Performance

Avoid N+1 entitlement lookups per row.

If list endpoints return many customers/orders/bookings, resolve Partner tier once per request/context where possible.

Do not add expensive per-record entitlement queries.

---

# 62. Policy service API

If a new service is necessary, keep it small.

Conceptual examples:

```text
canViewCustomerDirectContact(actorContext)
sanitizePartnerCustomerView(data, policy)
```

Actual API should follow codebase style.

Do not build a generic enterprise policy DSL.

---

# 63. DTO authority

Prefer explicit Partner-facing DTO/mapper boundaries over mutating Prisma entities.

Do not leak full entity and rely on frontend to ignore fields.

---

# 64. Tests must assert server response

Frontend tests alone cannot close this step.

Direct API payload inspection is mandatory.

---

# 65. Closure invariant

After Step 3.7A:

```text
Marketplace Basic
cannot obtain Customer direct-contact data
through known Partner-facing CRM / Order / Booking paths

Storefront Pro
retains allowed direct-contact visibility

Platform
retains internal visibility

tenant isolation
remains intact

chat anti-disintermediation
remains intact
```

---

# 66. If a legitimate Basic operational exception exists

Do not invent or silently preserve it.

If repository/business flow proves Basic requires a specific direct contact at a specific lifecycle point, return:

```text
POLICY EXCEPTION REQUIRED
```

with:

```text
field
business reason
stage/status
endpoint
roles
security impact
recommended narrow rule
```

Do not implement broad unrestricted exposure.

---

# 67. If phone/email is required by supplier fulfillment

Distinguish:

```text
Marketplace Partner
```

from:

```text
external supplier
service operator
Storefront Partner
```

Do not use one actor's operational need to grant all Basic Partners permanent access.

---

# 68. Security severity correction

Do not label legitimate Partner access to its own Customer relationship as cross-tenant exposure unless Partner can access another Partner's data.

Classify current bypass as:

```text
P1 — Marketplace anti-disintermediation/contact-policy bypass
```

unless implementation discovers a real cross-tenant path.

Any real cross-tenant leak discovered during implementation becomes:

```text
P0
```

and blocks closure.

---

# 69. Git discipline

Expected starting baseline:

```text
36ce652
```

Verify actual.

Before changes:

```text
git status
git rev-parse HEAD
git rev-parse origin/master
```

Commit only Step 3.7A files.

Do not include unrelated pre-existing deletions/untracked prompts.

Push only after closure gates pass.

---

# 70. Roadmap update

After implementation and evidence closure, update canonical roadmap only according to existing project workflow.

Do not automatically start 3.7B.

Do not invent future canonical numbering beyond what is approved.

If Step 3.7A numbering is being introduced for the first time, clearly record it as the approved decomposition of Step 3.7 rather than silently rewriting roadmap history.

---

# 71. Required final report

## A. Verdict

Only:

```text
VERDICT A — PHASE 3 — STEP 3.7A — MARKETPLACE CONTACT POLICY AUTHORITY — FULLY CLOSED
```

or:

```text
VERDICT B — PHASE 3 — STEP 3.7A — NOT CLOSED
```

---

## B. Pre-implementation exposure matrix

Exact surfaces/fields before remediation.

---

## C. Architecture decision

Show:

```text
tier authority
policy authority
DTO/serialization point
why this seam was chosen
```

---

## D. Basic policy

Exact fields hidden/restricted and exact affected endpoints.

---

## E. Pro policy

Exact preserved contact behavior.

---

## F. Platform policy

Regression evidence.

---

## G. Order / Booking policy

Exact before/after behavior.

---

## H. Alternate paths

Exports/search/notifications/legacy endpoints.

---

## I. Tenant isolation

Direct API proof.

---

## J. Communication regression

Pre-sale chat contact blocking remains.

---

## K. RU/AZ/EN

Runtime proof.

---

## L. Tests

Exact suites and X/X.

---

## M. Changed files

For each:

```text
path
purpose
REUSED / CHANGED / NEW
```

---

## N. Database/schema

Confirm no unintended data/schema changes.

---

## O. Git evidence

```text
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
Step 3.7A files committed:
Step 3.7A files pushed:
git status:
unrelated pre-existing changes:
```

No placeholders.

---

# 72. Hard closure gates

`VERDICT A` is forbidden unless:

```text
[ ] exposure inventory completed before implementation
[ ] all Partner-facing Customer contact fields inventoried
[ ] existing entitlement authority reused/verified
[ ] server-side policy authority implemented/reused
[ ] Basic CRM list safe
[ ] Basic CRM detail safe
[ ] Basic Order list/detail safe where contact exists
[ ] Basic Booking list/detail safe where contact exists
[ ] Pro CRM contact preserved
[ ] Pro Order/Booking behavior preserved
[ ] Platform internal contact visibility preserved
[ ] Customer own-view behavior preserved
[ ] no global Customer data mutation
[ ] no frontend-only security fix
[ ] alternate/legacy APIs checked
[ ] export bypass checked
[ ] search/autocomplete bypass checked
[ ] notification bypass checked
[ ] tenant isolation still passes
[ ] no real cross-tenant leak
[ ] chat anti-disintermediation still passes
[ ] normal chat still works
[ ] inactive/expired Pro entitlement resolves safely
[ ] RU runtime verified
[ ] AZ runtime verified
[ ] EN runtime verified
[ ] exact backend test counts reported
[ ] exact frontend test counts reported
[ ] backend TSC passes
[ ] frontend TSC passes
[ ] no unrelated schema/migration changes
[ ] final Git SHA real
[ ] push/origin evidence complete
[ ] unrelated working-tree changes accurately reported
```

Any failed mandatory gate:

```text
VERDICT B — NOT CLOSED
```

---

# 73. Non-goals

Explicitly out of scope:

```text
full automated message moderation
ALLOW/REDACT/BLOCK/REVIEW
obfuscation detection
attachment moderation
realtime transport
email provider integration
external contact history
CRM Activity MESSAGE projection
Support chat architecture
general Customer↔Partner chat redesign
Partner Analytics
Partner Operational Notes
Workforce
Supplier/Procurement
Payout UI
first-party TravelHub seller
Product.partnerId NOT NULL
```

---

# 74. Stop condition

After implementation:

1. return complete evidence report;
2. return exact final SHA;
3. do not start the next communication slice;
4. wait for review and approval.
