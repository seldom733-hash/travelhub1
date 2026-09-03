# PHASE 3 — STEP 3.7A.2 — MARKETPLACE CONTACT POLICY — FINAL RUNTIME EVIDENCE CLOSURE

## MODE

**FINAL EVIDENCE CLOSURE ONLY.**

This is not a new implementation stage.

Do not redesign Step 3.7A.

Do not rewrite the accepted Marketplace contact-policy implementation unless runtime proves an actual defect.

Do not silently fix newly discovered Communication/chat gaps.

The purpose is to close only the remaining unresolved evidence gates from Step 3.7A / 3.7A.1.

---

# 1. Current accepted baseline

Accepted implementation:

```text
PHASE 3 — STEP 3.7A
Implementation HEAD: 271fbe3
```

Latest reported evidence HEAD:

```text
2c5b202
```

Verify actual repository state:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log --oneline -15
```

Do not reset valid later commits.

---

# 2. Already accepted — do not repeat unnecessarily

The following evidence is already accepted unless new work affects it:

```text
Storefront Pro tier = PRO
Pro CRM list preserves email/phone
Pro CRM detail preserves email/phone
Platform CRM preserves full Customer identity
cross-partner Customer access → 404
CRM tests 106/106
Analytics tests 65/65
Frontend tests 243/243
Backend TSC PASS
Frontend TSC PASS
Git synchronization
schema/data integrity
```

Do not spend this step reproducing a large generic report.

---

# 3. Remaining closure gates only

This step must resolve exactly these areas:

```text
A. BASIC non-empty list payload
B. BASIC own Customer detail → 200 payload
C. inactive/expired entitlement fallback → BASIC + restricted payload
D. actual Communication send-message contact-policy behavior
E. contradiction between prior audit and later report regarding chat anti-disintermediation
```

Everything else is secondary.

---

# 4. Mandatory isolated BASIC fixture

The current runtime BASIC Partner has no marketplace customers/orders.

Create or use **isolated test data** sufficient to establish a legitimate Marketplace Basic Partner ↔ Customer relationship.

Use the smallest canonical business path supported by the repository.

Prefer:

```text
Customer
+
Marketplace Basic Partner
+
legitimate marketplace Order / relationship
```

if that is what makes the Customer visible in `/partner/customers`.

Do not insert arbitrary broken DB rows merely to satisfy the endpoint.

Use:

```text
seed/test fixture
isolated test DB
canonical service/API
transactional fixture
```

according to repository conventions.

---

# 5. Fixture requirements

The fixture Customer must have populated test-only values for:

```text
email
phone
```

so absence can actually be proven.

Use obviously synthetic data, for example repository-safe test values.

Do not use real PII.

---

# 6. BASIC tier proof

For the isolated Basic Partner:

```text
GET /partner/crm-tier
```

Required:

```text
HTTP 200
tier = BASIC
```

Include exact sanitized response.

---

# 7. BASIC non-empty list proof — HARD GATE

Call:

```text
GET /partner/customers
```

Required:

```text
HTTP 200
total >= 1
items.length >= 1
fixture Customer is present
email key absent
phone key absent
```

An empty list is **not acceptable evidence**.

Source-code inspection is **not a substitute**.

Include representative sanitized payload keys.

Example format:

```text
item keys:
id
code
type
firstName
lastName
status
createdAt
...

email: ABSENT
phone: ABSENT
```

---

# 8. BASIC own detail proof — HARD GATE

Call:

```text
GET /partner/customers/:fixtureCustomerId
```

with the same Basic Partner.

Required:

```text
HTTP 200
correct Customer returned
email key absent
phone key absent
legitimate related business context still available
```

A cross-partner `404` does not satisfy this gate.

---

# 9. BASIC browser proof

Open the fixture Customer through:

```text
/partner/customers
```

Required:

```text
non-empty Customer list
fixture Customer visible
detail opens
email not displayed
phone not displayed
no undefined
no broken cards
no raw i18n keys
```

One locale is sufficient for this specific fixture proof if RU/AZ/EN were already verified and no UI code changes occur in 3.7A.2.

---

# 10. Fixture cleanup

After evidence:

```text
remove isolated test records
or
drop isolated test DB
or
rollback fixture transaction
```

according to the test strategy.

Prove cleanup.

Do not leave fake marketplace Orders/Customers in normal runtime DB unless repository convention explicitly treats them as persistent seed data.

---

# 11. Entitlement fallback fixture — HARD GATE

Create/use an isolated Partner state where:

```text
PartnerStorefront exists
storefront status is compatible with the scenario
entitlementStatus != ACTIVE
```

Examples may include actual repository enum values such as:

```text
INACTIVE
EXPIRED
```

Use only values that really exist.

Do not invent enum values.

---

# 12. Entitlement fallback tier proof

For that actor:

```text
GET /partner/crm-tier
```

Required:

```text
HTTP 200
tier = BASIC
```

This must prove:

```text
Storefront exists
BUT entitlement is not active
→ BASIC
```

"No storefront exists" is not sufficient.

---

# 13. Entitlement fallback payload proof

The same fallback actor must have access to a legitimate synthetic Customer with populated test email/phone.

Call:

```text
GET /partner/customers
GET /partner/customers/:id
```

Required:

```text
HTTP 200
Customer returned
email absent
phone absent
```

This proves the fallback changes actual disclosure behavior, not only the tier label.

---

# 14. Restore entitlement state

If an existing Pro fixture/account is temporarily modified:

```text
record original state
change safely
execute evidence
restore original state
verify restored state
```

If a disposable fixture is used, destroy it.

No contamination is allowed.

---

# 15. Tier spoofing

Do not repeat broad spoof testing if already proven that no client tier input exists.

Simply reconfirm that the new fixture does not use a client-supplied tier override.

Record:

```text
tier source = server-side getCrmTier()
```

---

# 16. Communication contradiction — mandatory repository trace

There is a contradiction that must be resolved.

Earlier Step 3.7 audit claimed:

```text
POST /communications/reverse/conversations/:id/messages
→ anti-disintermediation check on body/subject
→ email/phone/URL rejected
```

Later Step 3.7A.1 evidence stated:

```text
anti-disintermediation service found in catalog/
→ product/seller/moderation content
→ not chat-level
```

Both cannot be accepted without reconciliation.

Trace the **actual current send-message path** from:

```text
POST /communications/reverse/conversations/:id/messages
```

through:

```text
controller
service
validators
shared helpers
imports
middleware/guards
persistence
```

Return exact file paths and relevant method names.

---

# 17. Do not rely on search-term similarity

Do not conclude that chat filtering exists merely because a file named:

```text
anti-disintermediation
```

exists somewhere in the repository.

Prove whether the send-message execution path actually invokes it.

---

# 18. Normal message runtime — HARD GATE

Use an isolated valid communication thread.

Send a normal harmless message.

Required:

```text
POST /communications/reverse/conversations/:id/messages
→ HTTP 200/201 according to actual contract
→ message created
```

Report exact HTTP status.

---

# 19. Email runtime test — HARD GATE

Send a synthetic message containing a test email.

Example:

```text
contact-test@example.invalid
```

Record actual result:

```text
HTTP status
response
message persisted? YES/NO
```

Do not assume expected behavior.

---

# 20. Phone runtime test — HARD GATE

Send a synthetic phone-like value.

Use test-only data.

Record:

```text
HTTP status
response
persisted? YES/NO
```

---

# 21. URL runtime test — HARD GATE

Send a synthetic URL, e.g.:

```text
https://example.invalid/contact-test
```

Record:

```text
HTTP status
response
persisted? YES/NO
```

---

# 22. Interpret chat results honestly

There are two acceptable evidence outcomes.

## Outcome A — blocking exists

If actual runtime proves:

```text
normal message → succeeds
email → rejected
phone → rejected
URL → rejected
```

then identify the exact code path responsible.

The previous audit's claim is reconciled.

---

# 23. Outcome B — blocking does NOT exist

If runtime proves contact-bearing messages are accepted:

```text
normal → success
email → success
phone → success
URL → success
```

or partially accepted, then:

```text
DO NOT FIX IT IN 3.7A.2
```

Record:

```text
NEW CONFIRMED COMMUNICATION GAP
Marketplace pre-sale chat contact blocking absent/incomplete
```

Classify severity based on actual business policy.

Likely:

```text
P1 — Marketplace anti-disintermediation bypass
```

but use evidence.

---

# 24. No silent remediation

If chat filtering is absent, forbidden in this evidence step:

```text
adding regex
adding moderation service
changing send-message validation
adding middleware
adding BLOCK/REDACT logic
```

Evidence closure must not hide a new implementation delta.

A separate implementation prompt will be created after review.

---

# 25. Partial blocking

If runtime gives mixed behavior such as:

```text
email blocked
phone blocked
URL allowed
```

report exact matrix.

Do not summarize it as "anti-disintermediation works."

Record the uncovered vector as a gap.

---

# 26. Subject vs body

If the message API supports both:

```text
subject
body
```

trace and test which fields are actually validated.

Do not claim both if only one is checked.

---

# 27. Persistence proof

For rejected messages, verify they are not persisted.

For accepted normal message, verify it is persisted/readable.

This distinguishes controller rejection from post-write behavior.

---

# 28. Sender/membership regression

While using the communication fixture, reconfirm:

```text
sender derived from authenticated actor
thread membership enforced
```

No need for broad security retesting unless code changed.

---

# 29. Communication fixture cleanup

Remove/drop/rollback synthetic test messages/thread/request according to repository test conventions.

Report cleanup.

---

# 30. No production code changes expected

Expected:

```text
production code changes: NONE
```

If runtime reveals the existing Step 3.7A contact policy itself is broken, stop and return `VERDICT B`.

Do not fix it automatically.

Targeted test fixture/report code may be added only if repository conventions require it.

---

# 31. Test rerun policy

If **no production code changes** occur, do not waste time rerunning every unrelated suite solely to reproduce previous numbers.

At minimum run the targeted suites covering:

```text
CRM contact policy
entitlement tier
communication reverse conversation
```

If project closure convention requires full regression, run:

```text
CRM
Analytics
Frontend
Backend TSC
Frontend TSC
```

Report actual counts, never copied counts.

---

# 32. Git discipline

Verify:

```text
Starting HEAD
origin/master
working tree
```

Expected latest evidence baseline from prior report:

```text
2c5b202
```

but actual repository state is authoritative.

Do not create an empty commit.

If only a report is committed, state:

```text
production changes: NONE
evidence/report commit only
```

---

# 33. Pre-existing unrelated changes

Previous reports mentioned unrelated:

```text
D backend/src/reconcile-2c2.ts
D docs/prompts/PHASE_3_STEP_3.5E_PARTNER_CRM_ANALYTICS_READ_MODEL_IMPLEMENTATION_REPORT.md
multiple untracked prompt files
```

Verify actual state.

Do not stage/restore/delete them as part of 3.7A.2.

Never call the working tree clean if they remain.

---

# 34. Required final report

## A. Verdict

Use one of the following.

### If all contact-policy evidence closes and chat blocking is proven:

```text
VERDICT A — PHASE 3 — STEP 3.7A.2 — FINAL RUNTIME EVIDENCE CLOSURE — FULLY CLOSED
```

### If Step 3.7A contact policy is proven but chat blocking is absent:

```text
VERDICT A — STEP 3.7A CONTACT POLICY FULLY PROVEN
COMMUNICATION ANTI-DISINTERMEDIATION GAP CONFIRMED — SEPARATE REMEDIATION REQUIRED
```

This is acceptable because chat moderation/blocking was not implemented by Step 3.7A itself.

### If BASIC/fallback contact policy cannot be proven:

```text
VERDICT B — PHASE 3 — STEP 3.7A.2 — CONTACT POLICY EVIDENCE NOT CLOSED
```

---

# 35. Report section — BASIC fixture

Include:

```text
fixture strategy
Partner
tier
Customer relationship
cleanup strategy
```

No real PII.

---

# 36. Report section — BASIC payload evidence

Use:

| Test | HTTP | Customer returned? | Email | Phone | Result |
|---|---:|---:|---|---|---|

Mandatory rows:

```text
BASIC list
BASIC own detail
```

---

# 37. Report section — entitlement fallback

Use:

| Storefront exists? | Storefront status | Entitlement status | Resolved tier | Email | Phone | Result |
|---:|---|---|---|---|---|---|

Must contain a real non-active entitlement case.

---

# 38. Report section — Communication path trace

Return:

```text
route
controller method
service method
validation/helper calls
persistence method
actual anti-disintermediation call if any
```

Exact paths.

---

# 39. Report section — Communication runtime matrix

Use:

| Message | HTTP | Persisted? | Blocking reason | Result |
|---|---:|---:|---|---|

Rows:

```text
normal
email
phone
URL
```

---

# 40. Report section — contradiction resolution

State exactly one:

```text
PRIOR AUDIT CORRECT:
chat anti-disintermediation exists and runtime proves it
```

or:

```text
PRIOR AUDIT INCORRECT:
catalog anti-disintermediation was incorrectly attributed to chat
```

or:

```text
PARTIAL:
some chat vectors are blocked, others are not
```

No ambiguous wording.

---

# 41. Report section — discovered gap

If applicable:

```text
Gap:
Severity:
Affected endpoint:
Affected actors:
Actual runtime:
Business impact:
Production remediation performed: NO
Recommended next action:
```

---

# 42. Report section — cleanup

Prove:

```text
BASIC fixture cleaned
entitlement fixture restored/cleaned
communication fixture cleaned
normal runtime data unchanged
```

---

# 43. Report section — Git

Return:

```text
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
production changes:
test/evidence changes:
report commit:
git status:
pre-existing unrelated changes:
```

No placeholders.

---

# 44. Hard closure gates

Step 3.7A contact-policy closure is forbidden unless:

```text
[ ] isolated BASIC fixture created through legitimate canonical relationship
[ ] fixture Customer has synthetic email
[ ] fixture Customer has synthetic phone
[ ] BASIC tier = BASIC
[ ] BASIC list is NON-EMPTY
[ ] BASIC list contains fixture Customer
[ ] BASIC list does not expose email
[ ] BASIC list does not expose phone
[ ] BASIC own detail returns 200
[ ] BASIC own detail does not expose email
[ ] BASIC own detail does not expose phone
[ ] BASIC browser list/detail works
[ ] storefront-present + non-active entitlement case exists
[ ] fallback tier resolves BASIC
[ ] fallback Customer payload is non-empty
[ ] fallback payload hides email
[ ] fallback payload hides phone
[ ] entitlement fixture restored/cleaned
[ ] actual send-message path traced end-to-end
[ ] normal chat message runtime executed
[ ] email chat runtime executed
[ ] phone chat runtime executed
[ ] URL chat runtime executed
[ ] persistence behavior recorded
[ ] prior anti-disintermediation contradiction explicitly resolved
[ ] no chat gap silently fixed
[ ] fixtures cleaned
[ ] exact Git evidence supplied
```

---

# 45. Important closure rule

A confirmed missing chat anti-disintermediation layer **does not invalidate the already implemented Step 3.7A CRM contact-disclosure policy** if all Step 3.7A BASIC/PRO/fallback gates pass.

Instead close Step 3.7A with a separately registered communication gap.

Do not conflate:

```text
Partner CRM contact disclosure
```

with:

```text
message-content anti-disintermediation
```

They are related business policies but different enforcement surfaces.

---

# 46. Non-goals

Do not implement:

```text
full automated moderation
chat regex remediation
obfuscation detection
ALLOW/REDACT/BLOCK/REVIEW
attachments
realtime
email integration
external contact history
MESSAGE → CrmActivity
Support chat
Partner Analytics
Operational Notes access
new Partner Order/Booking APIs
```

---

# 47. Stop condition

After this evidence run:

1. return the complete narrow report;
2. state whether Step 3.7A contact policy is finally proven;
3. state whether chat anti-disintermediation exists, is absent, or is partial;
4. return exact Git evidence;
5. do not remediate any newly discovered chat gap;
6. wait for review.
