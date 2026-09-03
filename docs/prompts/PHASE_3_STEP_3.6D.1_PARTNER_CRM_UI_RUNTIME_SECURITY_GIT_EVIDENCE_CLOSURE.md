# PHASE 3 — STEP 3.6D.1 — PARTNER CRM UI — RUNTIME / SECURITY / GIT EVIDENCE CLOSURE

## MODE

**EVIDENCE CLOSURE ONLY.**

Do not redesign Partner CRM.

Do not grant new Partner permissions for Activity, Operational Notes, or Analytics in this closure.

Do not start a new roadmap stage.

The implementation from Step 3.6D is provisionally accepted at code/test level, but `VERDICT A — FULLY CLOSED` is not allowed until runtime, security, and Git evidence is complete.

---

# 1. Baseline

Canonical Step 3.6D implementation baseline:

```text
Starting HEAD before 3.6D implementation: e1bfb98
```

Current implementation report still contains:

```text
Final HEAD: [to be committed]
origin/master: e1bfb98
```

This must be resolved.

Before any new change:

```text
git status
git rev-parse HEAD
git rev-parse origin/master
```

Record the actual state.

Do not assume the implementation is uncommitted without checking.

---

# 2. Already accepted implementation — DO NOT REWORK

Preserve:

```text
/partner/customers
→ canonical Partner CRM/customer route

Marketplace Basic
→ customer list from marketplace business relationship/orders
→ customer detail
→ no manual intake
→ no source/lifecycle editing

Storefront Pro
→ PCR-backed customer list/detail
→ manual intake
→ 8 canonical sources
→ lifecycle management
→ tags/notes fields already supported by relation edit

Customer = global identity
PCR = Partner-scoped relationship
```

Also preserve:

```text
no duplicate CRM root
no /partner/crm clone unless repository already uses it
no Platform /app/crm leakage
```

---

# 3. Already implemented UI improvements — DO NOT REGRESS

Preserve:

```text
RU/AZ/EN i18n
lifecycle select
lead source column
lead source detail display
shared table/components
existing Partner layout/navigation
```

No broad visual redesign.

---

# 4. Explicitly deferred follow-up gaps

The Step 3.6D implementation discovered:

```text
Partner Activity
→ crm.activity.read not currently granted to PARTNER

Partner Operational Notes
→ operational-notes.read not currently granted to PARTNER

Partner Analytics
→ analytics.read not currently granted to PARTNER
```

These are **NOT TO BE FIXED IN 3.6D.1**.

Do not grant these permissions merely to make the closure report look more complete.

Record them as:

```text
DISCOVERED FOLLOW-UP GAPS
```

for future canonical planning.

---

# 5. Closure objective

Prove that the existing implementation is correct in real runtime.

Required evidence areas:

```text
Marketplace Basic
Storefront Pro
tenant isolation
direct URL security
direct API security
Platform regression
RU/AZ/EN
Git finalization
```

---

# 6. Marketplace Basic runtime proof

Use an actual Marketplace Basic Partner account/context.

Verify in browser/runtime:

```text
/partner/customers loads successfully
```

Confirm:

```text
customer list renders
customer detail opens
marketplace-derived customer relationship is visible
no full CRM-only controls
no manual Add Customer action
no intake form
no relation-edit source/lifecycle controls
```

If Basic has no customers in current runtime data, use a deterministic seeded/test Basic Partner with valid marketplace-linked customer data.

Do not fake UI with frontend mocks.

---

# 7. Basic direct API denial

Prove server-side entitlement enforcement.

At minimum:

```text
POST /partner/customers/intake
as Marketplace Basic
→ 403 (or canonical authorization status)

PATCH /partner/relations/:id
as Marketplace Basic
→ 403 (or canonical authorization status)
```

Use real authenticated requests.

State exact HTTP codes.

Do not rely on hidden buttons as evidence.

---

# 8. Basic direct URL behavior

If Pro-only functionality exists behind a route or deep-linkable state, verify direct navigation.

Required outcome:

```text
Basic cannot reach Pro-only Partner CRM mutation UI through direct URL
```

If no separate Pro-only route exists because Pro features are conditionally rendered inside `/partner/customers`, state that explicitly and prove API denial instead.

Do not invent a route solely for testing.

---

# 9. Storefront Pro runtime proof

Use an actual Storefront Pro Partner.

Verify:

```text
/partner/customers loads
customer list renders
customer detail opens
manual intake is visible
manual intake succeeds
relation edit is visible
lifecycle select works
lead source display works
lead source selection uses canonical values
```

Use real API-backed data.

Do not use mocked-only evidence.

---

# 10. Pro intake proof

Create a safe test customer through the canonical Partner intake flow.

Evidence must include:

```text
request endpoint
HTTP status
created Customer identity
created PCR
partnerId scope
selected leadSource
tier = PRO
```

If intake is idempotent or normalizes email, preserve existing behavior.

Do not create duplicates unnecessarily.

---

# 11. Lead source proof

Verify all canonical values are available where manual intake supports them:

```text
MARKETPLACE
STOREFRONT
DIRECT
PHONE
OFFICE
EMAIL
REFERRAL
OTHER
```

Do not modify canonical source semantics.

Existing first-source preservation must remain intact.

Add/retain a regression test proving that later interaction does not overwrite an existing first source.

---

# 12. Lifecycle proof

Verify the actual current lifecycle contract:

```text
LEAD
PROSPECT
ACTIVE
CHURNED
```

Test one safe Pro PCR lifecycle update.

Evidence:

```text
before lifecycle
requested lifecycle
after lifecycle
partnerId scope
HTTP status
```

Do not invent new states.

---

# 13. Tenant isolation — mandatory P0 proof

Use two distinct Partner scopes if test data permits.

At minimum:

```text
Partner A
Partner B
```

Prove:

```text
Partner A cannot read Partner B PCR/customer business relationship
Partner A cannot mutate Partner B PCR
```

If detail endpoint is based on global Customer ID, verify that Partner A cannot access Partner B-only business context merely by knowing the Customer ID.

Expected result may be:

```text
403
```

or scope-safe:

```text
404
```

according to current architecture.

State exact behavior.

---

# 14. Notes/activity isolation

Do not grant Partner permissions.

But verify current denial for unavailable domains where endpoints are discoverable:

```text
Partner → CRM Activity endpoint
→ denied

Partner → Operational Notes endpoint
→ denied
```

This is evidence that deferred capability is not accidentally exposed.

If no Partner-facing route exists, document that instead.

---

# 15. Partner → Platform CRM security proof

Use a real Partner session.

Directly navigate/request:

```text
/app/crm
```

Expected:

```text
denied / redirected according to canonical workspace auth behavior
```

Also verify Partner cannot call Platform-only CRM APIs if there is a relevant endpoint.

Do not accept sidebar absence as sufficient.

---

# 16. Anonymous security proof

Verify:

```text
anonymous → /partner/customers
```

and relevant Partner CRM APIs.

Expected:

```text
authentication required
```

No accidental anonymous data exposure.

---

# 17. Platform regression

Use an actual Platform-authorized user.

Verify:

```text
/app/crm still loads
Platform CRM remains functional
Platform Create Customer remains absent
Platform CRM Analytics remains unaffected
```

Do not redesign or modify Platform CRM.

---

# 18. Step 3.6A regression

Verify:

```text
Marketplace PCR auto-attribution still works
leadSource first-source preservation remains
STOREFRONT source still exists
Basic manual intake denied
Pro manual intake allowed
```

No CRM source regression is allowed.

---

# 19. Step 3.6B regression

Verify:

```text
Platform Product create remains denied
Partner Product create still works
partnerId remains server-derived
ownership spoofing remains prevented
```

No changes are expected here.

---

# 20. Step 3.6C / 3.6C.1 regression

Verify only enough to prove no authority regression:

```text
Payment create/manage separation still present
Refund write/approve/execute separation still present
Product moderate/publish vs Partner own-edit separation still present
Platform Order/Booking create remains absent
```

Do not reopen these domains.

---

# 21. RU / AZ / EN runtime proof

The implementation added Partner CRM i18n.

Runtime verification is mandatory.

For:

```text
RU
AZ
EN
```

verify at least:

```text
Partner CRM title/navigation
table headers
empty state
detail labels
lead source label
lifecycle control
intake form (Pro)
validation/error text where applicable
```

No raw keys.

No mixed locale unless the value is intentionally user-entered content.

---

# 22. Error/loading/empty states

Verify runtime behavior for:

```text
loading
empty list
filtered/empty state if search exists
API error/retry if safely testable
```

Do not introduce a new design system.

Evidence can be screenshots/logs plus route/API status.

---

# 23. Browser evidence format

For each runtime scenario, report:

```text
Actor/context:
Route:
Tier:
Action:
Expected:
Observed:
Result:
```

At minimum include:

```text
Basic
Pro
Partner A vs Partner B
Partner → /app/crm
Platform regression
RU
AZ
EN
```

---

# 24. API evidence format

For each security/API scenario:

```text
Actor:
Tier:
Method:
Endpoint:
Payload:
HTTP status:
Response class/message:
Result:
```

Do not expose credentials/tokens.

---

# 25. Test evidence

Run the directly relevant tests again after finalization.

Report exact counts for:

```text
CRM
Analytics
Frontend
Partner CRM / entitlement tests if separately available
Backend TSC
Frontend TSC
```

If no dedicated Partner CRM suite exists, state that and name the exact suites covering the behavior.

Previous baseline:

```text
CRM:       106/106
Analytics:  65/65
Frontend:  243/243
```

Verify current actual counts.

Do not copy them blindly.

---

# 26. No silent permission expansion

Hard prohibition in Step 3.6D.1:

```text
DO NOT grant:
crm.activity.read
operational-notes.read
analytics.read
```

to PARTNER merely for closure.

If runtime shows these are already granted unexpectedly, treat that as a security finding and report it.

---

# 27. Follow-up gaps section

Final report must include:

```text
DISCOVERED FOLLOW-UP GAPS
```

with at least:

```text
Partner CRM Activity
Partner Operational Notes
Partner CRM/Partner Analytics
```

For each record:

```text
current permission state
current UI state
dependency
recommended future handling
```

Do not assign a new canonical step number unless roadmap already does so.

---

# 28. Git finalization

If Step 3.6D implementation is still uncommitted:

1. include only Step 3.6D-related files in the commit;
2. do not include pre-existing unrelated deletions/untracked files;
3. commit;
4. push;
5. verify exact final state.

If implementation is already committed, do not create a meaningless empty commit just to satisfy the prompt.

---

# 29. Git status language

Do not write:

```text
git status: clean
```

if Git still reports unrelated changes.

Use exact wording.

Example:

```text
HEAD == origin/master: YES
Step 3.6D files committed/pushed: YES
Working tree contains pre-existing unrelated changes:
- <path>
- <path>
```

The stage can still close if its own changes are fully committed and unrelated changes are proven pre-existing.

---

# 30. Required final Git evidence

Final report must contain:

```text
Starting HEAD:
Implementation HEAD before closure:
Final HEAD:
origin/master:
HEAD == origin/master:
Step 3.6D files committed:
Step 3.6D files pushed:
git status:
unrelated pre-existing changes:
```

No placeholders.

No `[to be committed]`.

No `TBD`.

---

# 31. Roadmap synchronization

Do not automatically select or implement a new roadmap stage.

If the current repository convention requires recording 3.6D completion in:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

then update only the completion status/evidence for 3.6D.

Do not assign the discovered Activity/Notes/Analytics gaps to a new step unless the roadmap already defines their place.

Do not invent NEXT.

---

# 32. Required final report structure

## A. Verdict

Only:

```text
VERDICT A — PHASE 3 — STEP 3.6D.1 — PARTNER CRM UI EVIDENCE CLOSURE — FULLY CLOSED
```

or:

```text
VERDICT B — PHASE 3 — STEP 3.6D.1 — NOT CLOSED
```

---

## B. Basic runtime evidence

Exact browser/API results.

---

## C. Pro runtime evidence

Exact browser/API results.

---

## D. Tenant isolation

Partner A → Partner B proof.

---

## E. Platform CRM isolation

Partner → `/app/crm` proof.

---

## F. Anonymous isolation

Anonymous Partner CRM proof.

---

## G. RU/AZ/EN

Runtime proof.

---

## H. Server entitlement

Exact Basic denial and Pro success cases.

---

## I. Regression

3.6A / 3.6B / 3.6C / 3.6C.1 relevant gates.

---

## J. Tests

Exact commands/suites and X/X.

---

## K. Discovered follow-up gaps

Activity / Notes / Analytics.

---

## L. Changed files

If closure required code changes, list them.

If no production code changes were needed, state:

```text
Production changes during 3.6D.1: NONE
```

---

## M. Git evidence

No placeholders.

---

# 33. Hard closure gates

`VERDICT A` is forbidden unless all applicable gates pass:

```text
[ ] Step 3.6D implementation committed
[ ] Step 3.6D implementation pushed
[ ] final SHA real
[ ] no TBD/to-be-committed placeholders
[ ] Basic /partner/customers runtime verified
[ ] Basic manual intake absent in UI
[ ] Basic manual intake denied server-side
[ ] Basic relation edit denied server-side
[ ] Pro CRM runtime verified
[ ] Pro manual intake succeeds
[ ] Pro lifecycle edit succeeds
[ ] canonical lead sources verified
[ ] tenant isolation proven with direct server request
[ ] Partner A cannot access Partner B CRM data
[ ] Partner cannot use /app/crm
[ ] anonymous cannot access Partner CRM
[ ] RU verified
[ ] AZ verified
[ ] EN verified
[ ] no raw i18n keys
[ ] Platform CRM regression passes
[ ] Step 3.6A regression passes
[ ] Step 3.6B regression passes
[ ] Step 3.6C/3.6C.1 authority regression passes
[ ] exact test counts reported
[ ] deferred Activity/Notes/Analytics permissions NOT silently granted
[ ] follow-up gaps explicitly documented
[ ] unrelated working-tree changes accurately reported
```

If any mandatory gate fails:

```text
VERDICT B — NOT CLOSED
```

---

# 34. Expected closure state

After Step 3.6D.1:

```text
PARTNER CRM UI
→ implementation committed
→ runtime-proven
→ Basic/Pro entitlement-proven
→ tenant-isolation-proven
→ Platform workspace isolation-proven
→ RU/AZ/EN proven
```

while:

```text
Partner Activity
Partner Operational Notes
Partner Analytics
```

remain explicitly deferred follow-up gaps rather than being silently enabled.

Stop after evidence closure.

Return the final report and wait for approval.
