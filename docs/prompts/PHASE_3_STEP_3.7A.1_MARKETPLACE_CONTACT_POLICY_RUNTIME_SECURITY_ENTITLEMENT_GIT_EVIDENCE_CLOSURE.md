# PHASE 3 — STEP 3.7A.1 — MARKETPLACE CONTACT POLICY AUTHORITY — RUNTIME / SECURITY / ENTITLEMENT / GIT EVIDENCE CLOSURE

## MODE

**EVIDENCE CLOSURE ONLY.**

Do not redesign Step 3.7A.

Do not introduce a new policy framework.

Do not add new Partner endpoints.

Do not add new communication features.

Do not implement full moderation.

Do not create new permissions unless a real blocker is discovered and explicitly reported.

The purpose of Step 3.7A.1 is to prove that the already implemented Step 3.7A behavior is correct in real runtime/API conditions.

---

# 1. Accepted implementation baseline

Step 3.7A implementation is currently treated as:

```text
IMPLEMENTATION: PASS
SECURITY DESIGN: PASS
EVIDENCE CLOSURE: NOT YET COMPLETE
```

Expected implementation commit:

```text
271fbe3
```

Verify actual repository state first:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log --oneline -15
```

Do not assume baseline if repository has valid later commits.

---

# 2. Preserve implemented design

Do not rewrite the accepted Step 3.7A design unless runtime proves it incorrect.

Current implementation:

```text
Tier authority:
getCrmTier()

Marketplace Basic:
Customer.email omitted
Customer.phone omitted

Storefront Pro:
Customer.email included
Customer.phone included

Enforcement seam:
server-side conditional Prisma select in CRM service
```

This is acceptable for current repository because the audit found no dedicated Partner Order/Booking APIs exposing separate Customer DTOs.

Do not create a separate policy service solely for abstraction in this evidence step.

---

# 3. Canonical policy invariant

The runtime contract to prove:

```text
Marketplace Basic
→ may access legitimate Partner customer context
→ must NOT receive unrestricted Customer email/phone

Storefront Pro
→ retains legitimate email/phone access

Platform
→ retains existing internal Customer visibility

Customer canonical DB records
→ unchanged
```

---

# 4. Mandatory Basic API evidence — list

Use a real Marketplace Basic Partner account.

Call:

```text
GET /partner/crm-tier
GET /partner/customers
```

Evidence must show:

```text
tier = BASIC
HTTP 200
customer objects returned
email key absent OR canonical safe null behavior
phone key absent OR canonical safe null behavior
```

Do not merely say "code excludes fields."

Include a sanitized representative response fragment.

Do not expose real personal values unnecessarily.

---

# 5. Mandatory Basic API evidence — detail

Call a real accessible:

```text
GET /partner/customers/:id
```

Evidence must show:

```text
HTTP 200
legitimate customer detail returned
email not exposed
phone not exposed
orders/bookings/payments context still works if present
```

This is a hard closure gate.

---

# 6. Mandatory Basic browser evidence

Open:

```text
/partner/customers
```

with real BASIC Partner.

Verify:

```text
page loads
customer list renders
email column absent
customer detail opens
email card absent
phone card absent
no undefined/null/raw object artifacts
```

Capture observed result in report.

---

# 7. Mandatory Pro API evidence — tier

Use a real Storefront Pro Partner.

Call:

```text
GET /partner/crm-tier
```

Expected:

```text
{"tier":"PRO"}
HTTP 200
```

---

# 8. Mandatory Pro API evidence — list

Call:

```text
GET /partner/customers
```

Expected:

```text
HTTP 200
email available for legitimate Customer
phone available where stored
PCR relation fields preserved
```

Use sanitized evidence.

---

# 9. Mandatory Pro API evidence — detail

Call:

```text
GET /partner/customers/:id
```

Expected:

```text
HTTP 200
email available
phone available
lifecycle/source/tags/notes relation fields preserved
```

This proves no over-redaction regression.

---

# 10. Mandatory Pro browser evidence

Open:

```text
/partner/customers
```

Verify:

```text
email column/contact information appears as designed
customer detail shows allowed email/phone
relation fields still work
no broken layout
```

---

# 11. Tier spoofing test

Attempt to influence tier from request input if any plausible vector exists:

```text
query param
body field
header
route param
client-side state
```

Examples only:

```text
?tier=PRO
{"tier":"PRO"}
X-Tier: PRO
```

Do not invent unsupported inputs.

The server must continue resolving tier from canonical entitlement state.

Expected:

```text
Basic actor remains BASIC
contact fields remain restricted
```

If no request-level tier input exists anywhere, state:

```text
NO CLIENT TIER INPUT SURFACE EXISTS
```

with code/runtime evidence.

---

# 12. Inactive / expired Pro entitlement fallback

This is mandatory.

Use a safe test fixture or isolated test data to represent:

```text
PartnerStorefront exists
BUT entitlement inactive/expired
```

Expected:

```text
getCrmTier()
→ BASIC
```

and therefore:

```text
email hidden
phone hidden
```

Do not mutate real production Partner entitlements destructively.

Use test DB/fixture or reversible isolated runtime state.

---

# 13. Re-activation regression if state is modified

If entitlement state is changed for testing:

```text
restore original state
```

and prove:

```text
PRO → contact visible again
```

No test contamination.

---

# 14. Cross-partner Customer isolation

Use:

```text
Partner A
Partner B
```

Attempt:

```text
Partner A → GET /partner/customers/:partnerB_customerId
```

Expected:

```text
403 or 404 according to current architecture
```

Report exact HTTP status and sanitized response.

This proves contact redaction was not substituted for authorization.

---

# 15. Cross-partner relation mutation regression

If Partner relation mutation endpoint is available:

```text
Partner A → PATCH /partner/relations/:partnerB_relationId
```

Expected:

```text
403/404
```

Do not require successful mutation.

This is tenant isolation regression evidence.

---

# 16. Platform API regression

Use a real authorized Platform actor.

Call the canonical Platform Customer CRM detail endpoint.

Expected:

```text
full internal Customer identity remains available
```

including:

```text
email
phone
```

where populated.

Do not expose actual private values in report; show field presence or masked samples.

---

# 17. Platform browser regression

Open canonical Platform CRM customer detail.

Verify:

```text
email still visible
phone still visible
no accidental Partner-safe DTO applied
```

This is mandatory because a shared serializer regression would be severe.

---

# 18. Customer self-view regression

If a Customer self-profile or own order detail exists, verify Step 3.7A did not globally hide Customer's own contact data.

If no such relevant surface exists, report:

```text
N/A — no affected shared DTO path
```

with reason.

---

# 19. Marketplace pre-sale chat normal message

Use safe test actors.

Send a normal message with no contact data.

Expected:

```text
201/200 according to endpoint contract
message persists
```

This proves anti-disintermediation still allows legitimate communication.

---

# 20. Marketplace pre-sale chat contact block

Test at least:

```text
email
phone
URL
```

Expected:

```text
422
```

with current canonical anti-disintermediation error.

No advanced obfuscation testing is required in this step.

---

# 21. No moderation expansion

Do not implement:

```text
zero-width normalization
homoglyph detection
emoji separator detection
ALLOW/REDACT/BLOCK/REVIEW
review queue
attachment scanning
```

Those remain future work.

---

# 22. Search/autocomplete bypass proof

Step 3.7A reported:

```text
email may be used in WHERE
but not returned in response
```

Prove with a Basic Partner:

1. perform a search that can match by email if API supports it;
2. inspect returned object;
3. verify email/phone still absent.

If the search API does not expose this path, state N/A precisely.

---

# 23. Export bypass proof

If Partner exports do not exist, provide repository evidence:

```text
no Partner export route/controller/client surface
```

Do not build one.

If any export exists, Basic export must be checked directly.

---

# 24. Notification bypass proof

If no Partner notification controller/payload path exists, provide repository evidence.

If notifications exist elsewhere, inspect whether Customer contact values are included.

Do not add notifications.

---

# 25. Legacy/alternate endpoint proof

Search for alternate Partner Customer endpoints.

At minimum search:

```text
partner/customers
partner/customer
customers/own
crm/customers
partner/orders
partner/bookings
```

If none return Customer contact independently, record:

```text
NO ALTERNATE BYPASS FOUND
```

with exact paths searched.

---

# 26. Order/Booking claim reconciliation

The Step 3.7A implementation report stated:

```text
No dedicated Partner Order/Booking endpoints exist.
Order/Booking data is accessible only through CRM customer detail.
```

Verify this again from repository.

If true, record clearly:

```text
Order/Booking contact policy currently inherits Partner CRM response boundary.
```

Do not claim Order/Booking dedicated API coverage if those endpoints do not exist.

---

# 27. Future architecture note

Record this rule for future work:

```text
If dedicated Partner Order / Booking / Export / Notification APIs are added later,
they MUST reuse the same canonical Partner contact-disclosure policy.

No endpoint may independently reintroduce Customer email/phone to Marketplace Basic.
```

This is documentation only.

Do not create new architecture now.

---

# 28. Cache check

Inspect whether Partner CRM customer responses are cached.

If no cache:

```text
CACHE: N/A
```

If cache exists, prove Basic and Pro representations cannot cross-contaminate.

Do not add caching.

---

# 29. RU runtime

With Basic and Pro where relevant, verify affected Partner CRM UI in Russian.

Expected:

```text
no raw keys
no broken hidden-field labels
no malformed table/detail layout
```

---

# 30. AZ runtime

Repeat in Azerbaijani.

Expected same.

---

# 31. EN runtime

Repeat in English.

Expected same.

---

# 32. Browser evidence format

Use a compact matrix:

| Actor | Tier | Locale | Route | Expected | Observed | Result |
|---|---|---|---|---|---|---|

At minimum include:

```text
Basic RU
Basic AZ
Basic EN
Pro RU
Pro AZ
Pro EN
Platform one locale minimum
```

---

# 33. API evidence format

Use:

| Actor | Tier | Method | Endpoint | HTTP | Contact fields | Result |
|---|---|---|---|---:|---|---|

At minimum:

```text
Basic list
Basic detail
Pro list
Pro detail
cross-partner detail
Platform detail
normal chat
email chat
phone chat
URL chat
```

---

# 34. Response evidence sanitation

Do not publish real Customer contact data in the report.

Use:

```text
"email": "<present>"
"phone": "<present>"
```

or:

```text
email key absent
phone key absent
```

Do not leak PII.

---

# 35. Test rerun

Rerun actual current suites.

Previous implementation report stated:

```text
CRM:         106/106
Analytics:    65/65
Frontend:    243/243
Backend TSC: PASS
Frontend TSC: PASS
```

Do not copy blindly.

Report actual current counts.

---

# 36. Add targeted evidence tests only if needed

If runtime closure exposes missing automated coverage, add the smallest targeted test.

Do not redesign implementation.

Potential coverage:

```text
Basic list excludes email/phone
Basic detail excludes email/phone
Pro detail includes email/phone
inactive entitlement returns Basic projection
```

If already covered, do not duplicate.

---

# 37. Database integrity

No historical data rewrite is expected.

Report:

```text
Customer records changed by evidence step:
Order records changed:
Booking records changed:
Partner entitlement records changed:
```

If temporary entitlement test data was modified, report restore evidence.

---

# 38. Schema/migration integrity

Expected:

```text
schema changes: 0
migration changes: 0
```

If not zero, Step 3.7A.1 requires explicit justification and likely VERDICT B.

---

# 39. Git discipline

Expected implementation baseline:

```text
271fbe3
```

Check actual HEAD.

Evidence-only work should not create a production commit unless a targeted test/report/roadmap artifact is intentionally committed according to repository convention.

Do not create an empty commit just to generate a SHA.

---

# 40. Working tree

Previous report had unrelated pre-existing changes:

```text
D backend/src/reconcile-2c2.ts
D docs/prompts/PHASE_3_STEP_3.5E_PARTNER_CRM_ANALYTICS_READ_MODEL_IMPLEMENTATION_REPORT.md
multiple untracked prompt files
```

Verify actual current state.

Never report:

```text
git status: clean
```

if these remain.

Do not include them in evidence-step commits.

---

# 41. Required final Git evidence

Return:

```text
Starting HEAD:
Implementation HEAD:
Evidence-step Final HEAD:
origin/master:
HEAD == origin/master:
new production changes in 3.7A.1:
tests/report files committed:
tests/report files pushed:
git status:
pre-existing unrelated changes:
```

No `TBD`.

---

# 42. Roadmap

Do not start 3.7B.

If repository workflow requires recording 3.7A evidence closure, update only the exact roadmap status/history required.

Do not invent a new NEXT.

---

# 43. Required final report

## A. Verdict

Only:

```text
VERDICT A — PHASE 3 — STEP 3.7A.1 — RUNTIME / SECURITY / ENTITLEMENT / GIT EVIDENCE CLOSURE — FULLY CLOSED
```

or:

```text
VERDICT B — PHASE 3 — STEP 3.7A.1 — EVIDENCE CLOSURE NOT COMPLETE
```

---

## B. Basic runtime/API proof

Include:

```text
tier
list
detail
field absence
browser
```

---

## C. Pro runtime/API proof

Include:

```text
tier
list
detail
field presence
browser
```

---

## D. Entitlement fallback proof

Include:

```text
inactive/expired entitlement
resolved tier
contact behavior
restore evidence
```

---

## E. Tier spoofing proof

Exact attempted vector/result or exact proof that no client-controlled tier input exists.

---

## F. Tenant isolation proof

Exact direct API attempt and status.

---

## G. Platform regression proof

API + browser.

---

## H. Customer self-view regression

Proof or justified N/A.

---

## I. Communication regression

Normal message + email/phone/URL block.

---

## J. Alternate bypass checks

Search/autocomplete, exports, notifications, legacy endpoints.

---

## K. Order/Booking architecture reconciliation

Confirm whether dedicated Partner endpoints exist.

---

## L. RU/AZ/EN runtime

Exact matrix.

---

## M. Tests

Exact current X/X.

---

## N. Data/schema integrity

Exact result.

---

## O. Git

No placeholders.

---

## P. Follow-up architecture note

Record only:

```text
Future dedicated Partner Order/Booking/Export/Notification surfaces
must reuse canonical Partner contact-disclosure policy.
```

Do not implement them.

---

# 44. Hard closure gates

`VERDICT A` is forbidden unless:

```text
[ ] actual repo baseline verified
[ ] Basic tier runtime proven
[ ] Basic list payload proven contact-safe
[ ] Basic detail payload proven contact-safe
[ ] Basic browser proven
[ ] Pro tier runtime proven
[ ] Pro list payload proven contact-preserving
[ ] Pro detail payload proven contact-preserving
[ ] Pro browser proven
[ ] inactive/expired entitlement fallback proven
[ ] entitlement test state restored
[ ] tier spoofing proven ineffective or no input surface proven
[ ] Partner A → Partner B Customer direct access denied
[ ] cross-partner relation isolation regression checked where available
[ ] Platform API full contact preserved
[ ] Platform browser full contact preserved
[ ] Customer self-view unaffected or justified N/A
[ ] normal Marketplace chat message succeeds
[ ] email chat attempt rejected
[ ] phone chat attempt rejected
[ ] URL chat attempt rejected
[ ] search/autocomplete bypass checked
[ ] export bypass checked
[ ] notification bypass checked
[ ] alternate/legacy endpoints checked
[ ] Order/Booking endpoint claim verified
[ ] RU browser runtime checked
[ ] AZ browser runtime checked
[ ] EN browser runtime checked
[ ] no raw i18n keys
[ ] actual current tests rerun
[ ] backend TSC PASS
[ ] frontend TSC PASS
[ ] no unintended schema/migration changes
[ ] no historical data corruption
[ ] temporary entitlement state restored
[ ] Git SHA evidence complete
[ ] origin push state exact
[ ] unrelated working-tree changes accurately reported
[ ] no new moderation/realtime/email/activity scope added
```

Any failed mandatory gate:

```text
VERDICT B — EVIDENCE CLOSURE NOT COMPLETE
```

---

# 45. Non-goals

Do not implement:

```text
full moderation
obfuscation detection
attachments
realtime
email
external contact history
MESSAGE → CrmActivity
Customer ↔ Platform Support chat
general Customer ↔ Partner chat
Partner Analytics
Operational Notes access
new Partner Order/Booking APIs
exports
notifications
```

---

# 46. Stop condition

After evidence closure:

1. return the report;
2. return exact Git evidence;
3. do not start another Step 3.7 slice;
4. wait for review.
