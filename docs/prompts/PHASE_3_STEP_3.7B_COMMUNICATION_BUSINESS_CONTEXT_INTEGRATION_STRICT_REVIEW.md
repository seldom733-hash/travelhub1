# PHASE 3 — STEP 3.7B — COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW

## MODE

**INDEPENDENT ADVERSARIAL STRICT REVIEW.**

This is a review step, not an implementation continuation.

Do not assume Step 3.7B is correct because its implementation/evidence reports claim PASS.

The reviewer must independently inspect the repository, committed implementation, tests, runtime behavior, security boundaries, persistence behavior, and Git state.

Do not modify production code unless a defect is found and the review process explicitly requires a separately authorized review-fix. For this pass, findings must be reported first.

---

# 1. Review target

Review the complete effective Step 3.7B implementation chain:

```text
3.7B implementation              576b076
3.7B.2 remediation               716dbd1
3.7B.3 precision                 d1c17d1
3.7B.4 evidence                  062d418
administrative finalization      d909fb3
```

Administrative precondition already reported:

```text
VERDICT A — STEP 3.7B.4 FINAL ADMINISTRATIVE CLOSURE — PASS
STEP 3.7B READY FOR STRICT REVIEW

Final HEAD:            d909fb3
origin/master:         d909fb3
HEAD == origin/master: YES
```

The review must verify repository reality independently.

---

# 2. Canonical scope

Step 3.7B is:

```text
COMMUNICATION BUSINESS-CONTEXT INTEGRATION
```

Canonical intent:

```text
Communication ↔ Order / Booking context links
CRM / Sales integration where justified
Support integration only to the extent an existing canonical Support authority exists
```

Hard rule:

Do not invent or approve functionality merely because it would be desirable.

Review the implementation against the actual canonical roadmap and existing domain ownership.

---

# 3. Architecture invariants

Verify all of the following.

## 3.1 One Communication domain

There must remain one canonical communication authority:

```text
Communication = CML-*
```

Step 3.7B must not introduce:

```text
OrderMessage
BookingMessage
CrmMessage
SupportMessage
PartnerMessage
another parallel chat/message persistence authority
```

unless such a concept demonstrably predates the step and has a different bounded-context responsibility.

Any duplicate messaging truth introduced by 3.7B is a blocking defect.

---

## 3.2 Context link ≠ ownership transfer

Order and Booking may provide authoritative business context.

Communication remains owner of communication facts.

Expected conceptual relationship:

```text
Order / Booking
      ↓ authoritative context
Communication
      ↓
message/history
```

Communication must not become Order/Booking authority.

Order/Booking must not directly become message persistence authority.

---

## 3.3 Server-derived participant authority

For ORDER / BOOKING context communication, participants must be validated or derived from authoritative business context.

Client-supplied participant identifiers must never be sufficient authority.

Review actual create paths.

Attempt authorized-actor spoofing, not merely an unauthorized role test.

Required negative cases include at least:

```text
authorized creator + valid own ORDER + foreign Partner recipient
authorized creator + valid own ORDER + foreign Customer sender/recipient
authorized creator + valid own BOOKING + foreign Partner
authorized creator + valid own BOOKING + foreign Customer
```

Where a particular participant role is structurally impossible for the endpoint, prove that from code and test the nearest meaningful spoof vector.

Expected:

```text
controlled 4xx
no Communication persisted
no partial context/participant record persisted
no raw 500
```

---

# 4. Tenant / object-scope isolation

Independently prove object isolation.

At minimum cover:

```text
Partner A → own Order context
Partner A → foreign Partner B Order context

Partner A → own Booking context
Partner A → foreign Partner B Booking context

Buyer A → own context where endpoint contract permits
Buyer A → Buyer B context

internal authorized staff
internal unauthorized staff role
anonymous
```

Do not accept frontend hiding as evidence.

Server/API behavior is authoritative.

For every denied write, verify persistence count/delta.

---

# 5. Marketplace Basic contact-disclosure policy

This is a critical inherited security prerequisite from Step 3.7A.

Marketplace Basic must not regain customer contact disclosure through Communication business-context integration.

Review recursively, not only top-level fields.

Inspect:

```text
body
sender
recipient
customer
partner
order
booking
context
thread
metadata
nested projections
related entity labels
serialized DTOs
list responses
detail responses
create responses
```

Test a real non-empty Marketplace Basic fixture.

Required principle:

```text
Marketplace Basic
→ no prohibited direct customer contact disclosure

Storefront Pro
→ legitimate Storefront contact policy preserved

Platform authorized scope
→ legitimate operational visibility preserved
```

Do not globally redact data from Pro/Platform merely to make Basic safe.

---

# 6. Stored original vs safe projection

Review the 3.7B.2 remediation behavior.

If contact-bearing content is stored canonically but redacted/projected for Marketplace Basic reads, verify:

```text
canonical stored original remains unchanged
Basic receives safe projection
Pro receives legitimate original
authorized Platform receives legitimate original
```

No destructive mutation of the canonical message body merely for Basic presentation is allowed unless the canonical moderation policy explicitly requires it.

Prove with DB/runtime evidence.

---

# 7. Sanitizer precision

Review the 3.7B.3 precision fix adversarially.

The sanitizer must block/redact prohibited contact disclosure without corrupting legitimate business identifiers.

Explicitly test harmless identifiers resembling numeric contact patterns.

At minimum include:

```text
TH-2026-000001
ORD-* code
Booking human-readable code if one exists
CML-* code
currency/amount text
dates
ordinary numeric references
```

Also test actual prohibited patterns:

```text
email
phone
URL
social/contact handle if detector supports it
```

A harmless TravelHub business identifier must not be falsely redacted as a phone/contact value.

---

# 8. Human-readable business context

Inspect API/frontend projections introduced or affected by 3.7B.

Where humans see a linked Order/Booking context, avoid raw UUID as the primary visible label if a stable human-readable code exists.

Expected principle:

```text
internal FK/UUID → allowed internally
human UI label   → stable business code/label
```

Do not create duplicate business codes.

Reuse canonical Order/Booking identifiers.

---

# 9. ORDER context runtime

Create or identify controlled fixtures and independently prove:

```text
valid own-context creation/read
participant consistency
foreign tenant denial
wrong participant denial
Basic contact-safe projection
Pro legitimate projection
Platform authorized projection
unauthorized staff denial
persistence behavior
```

Capture:

```text
request
HTTP status
relevant response excerpt
DB before/after or exact persisted row evidence
cleanup evidence
```

---

# 10. BOOKING context runtime

Booking evidence is mandatory and must not be inferred from Order behavior.

Independently prove the same applicable matrix for BOOKING:

```text
valid own context
foreign tenant
wrong participant
Basic
Pro
Platform
unauthorized staff
persistence
cleanup
```

If Booking participant resolution traverses Order/OrderItem/Partner/Customer relationships, inspect that chain for IDOR or stale/trust issues.

---

# 11. Reverse Marketplace / pre-sale communication regression

Step 3.7B must not weaken the existing reverse-conversation anti-disintermediation contract.

Execute the real runtime path.

At minimum:

```text
harmless message → accepted/persisted

email → rejected
phone → rejected
URL → rejected
```

For rejected cases prove:

```text
controlled 4xx
not persisted
```

Verify the endpoint actually routes through the canonical/shared contact detector rather than a test-only or duplicate validator.

Inspect the call path.

---

# 12. Context validation timing

Context and participant validation must happen before irreversible persistence.

Inspect transaction boundaries and write ordering.

Reject patterns such as:

```text
create Communication
then validate Order ownership
then delete/compensate on failure
```

Expected:

```text
validate authority/context/participants
→ persist atomically
```

or an equivalent transactionally safe design.

Test failure paths for residue.

---

# 13. Generic Communication create endpoint

Audit generic/staff Communication creation if it can accept:

```text
contextType
contextId
sender
recipient
participant IDs
```

Step 3.7B must not secure a specialized endpoint while leaving a generic endpoint as a bypass.

For ORDER/BOOKING contexts, generic create must enforce the same business-context consistency rules or explicitly prohibit unsupported combinations.

Attempt bypasses.

---

# 14. Context-type confusion

Adversarially test mismatched identifiers:

```text
contextType=ORDER + Booking ID
contextType=BOOKING + Order ID
unknown context ID
deleted/nonexistent context
foreign context ID
malformed ID/code where applicable
```

Expected controlled response.

No accidental cross-domain lookup fallback.

No raw 500.

No persistence.

---

# 15. CRM integration boundary

Audit whether 3.7B changed CRM behavior.

CRM must remain a consumer/view of canonical Communication facts, not a second message authority.

If MESSAGE activity projection was implemented, verify it is justified by roadmap scope and uses canonical facts.

If it remains deferred, confirm no misleading partial implementation exists.

Do not fail the step merely because optional/future CRM activity projection is absent unless the canonical 3.7B contract requires it.

---

# 16. Sales integration boundary

Audit Sales links added or changed by 3.7B.

Verify:

```text
no duplicate Sales communication store
no Sales-owned message truth
no forged Opportunity/Quote/Sale linkage
tenant/participant authority preserved
```

If no additional Sales-specific integration was required after gap analysis, confirm that the implementation/report accurately says so.

---

# 17. Support boundary

Audit Support claims.

If the canonical Support domain is not yet implemented, Step 3.7B must not fabricate one.

Allowed result:

```text
Support integration deferred to canonical future Support steps
```

A fake/minimal Support domain added merely to satisfy the wording “CRM/Sales/Support integration” is a defect.

---

# 18. Entitlement boundary

Communication business-context integration must preserve:

```text
Marketplace Basic
vs
Storefront Pro
```

Do not conflate:

```text
PARTNER role
Storefront entitlement
communication permission
contact disclosure policy
```

Verify effective tier resolution is server-side.

Expired/inactive Storefront entitlement must fall back according to canonical entitlement rules rather than retaining Pro contact visibility.

Where practical, execute an entitlement transition regression:

```text
ACTIVE Pro
→ legitimate Pro projection

EXPIRED/inactive
→ Basic-safe projection

restore ACTIVE
→ Pro projection restored
```

Do not permanently mutate fixtures.

---

# 19. Authorization / permissions

Inventory all Step 3.7B affected endpoints and map:

```text
endpoint
actor
required permission
tenant/object scope
context validation
participant validation
contact projection
```

Test at least one internal role that is authenticated but lacks the required communication permission.

Expected:

```text
403 or canonical denial
```

Do not accept “not shown in UI” as security.

---

# 20. Data leakage

Inspect full serialized payloads for unintended leakage of:

```text
email
phone
website
WhatsApp
social handles
raw CRM customer fields
raw CRM partner fields
internal partnerId where public projection forbids it
internal customerId where public projection forbids it
private metadata
foreign tenant data
```

Pay special attention to nested `include` / Prisma relations and DTO spreading.

---

# 21. Persistence and idempotency/concurrency

Audit whether Step 3.7B introduces any new duplicate-write risk.

Where the same logical create can be retried or raced, inspect existing idempotency/concurrency contract.

Do not invent a new idempotency requirement if the endpoint is intentionally non-idempotent, but ensure concurrent requests cannot violate participant/context integrity or tenant isolation.

At minimum test a meaningful concurrent/race case if the code path contains check-then-write behavior.

---

# 22. Error model

All adversarial cases should resolve through controlled application errors.

Audit for:

```text
400
403
404
409
422
```

as appropriate to canonical conventions.

Blocking issue:

```text
raw Prisma error
raw stack trace
500 caused by expected invalid user input
security-sensitive existence oracle inconsistent with established neutral-IDOR policy
```

---

# 23. Audit/history

If Communication creation already produces audit/history under canonical architecture, ensure 3.7B context writes preserve it.

Rejected spoof/foreign attempts must not create misleading successful business audit facts.

Do not require new audit events that the canonical Communication foundation does not define.

---

# 24. Schema / migration review

Inspect all commits in the Step 3.7B chain.

Report whether schema/migrations were changed.

If changed, review:

```text
necessity
ownership
backward compatibility
nullable/additive behavior
FK behavior
indexes
uniqueness
migration replay
legacy rows
```

If no schema change was needed because existing generic context fields were sufficient, confirm that this was safe and intentional.

---

# 25. Test quality review

Do not only count tests.

Inspect whether tests actually prove the claimed security properties.

Reject false evidence such as:

```text
unauthorized PARTNER gets 403
```

being presented as proof that:

```text
authorized creator cannot spoof participant
```

These are different properties.

Review tests for:

```text
positive own ORDER
positive own BOOKING
foreign ORDER
foreign BOOKING
actual authorized participant spoof
Basic contact leakage
Pro preservation
Platform preservation
unauthorized staff
context-type confusion
reverse chat anti-disintermediation
persistence absence after denial
```

Identify any tautological mocks or tests that bypass real guards/services.

---

# 26. Regression commands

Run the relevant targeted suites first.

At minimum:

```text
Communication-related backend tests
CRM tests affected by Basic/Pro projection
Order/Booking tests affected by context integration
```

Then run backend TypeScript compile/typecheck.

Use the repository's real package scripts rather than inventing commands.

If the project has an established broader regression command that is reasonably runnable for this stage, run it and report the exact result.

Do not claim broader regression PASS if only targeted suites were executed.

---

# 27. Runtime evidence requirements

Runtime evidence must use real application/API behavior against controlled fixtures.

For every critical security case record:

```text
actor/tier
business context
request
status
response summary
persistence result
```

Minimum runtime matrix:

| Case | Required |
|---|---|
| ORDER own valid | YES |
| ORDER foreign tenant | YES |
| ORDER participant spoof | YES |
| BOOKING own valid | YES |
| BOOKING foreign tenant | YES |
| BOOKING participant spoof | YES |
| Basic contact-safe projection | YES |
| Pro legitimate projection | YES |
| Platform authorized projection | YES |
| Unauthorized internal staff | YES |
| Reverse harmless | YES |
| Reverse email | YES |
| Reverse phone | YES |
| Reverse URL | YES |
| Context-type confusion | YES |

A code-only review is insufficient.

---

# 28. Cleanup

All Strict Review synthetic fixtures must be removed.

Prove cleanup for:

```text
synthetic Communications
synthetic reverse conversations/messages
synthetic Buyers/Customers
synthetic Orders/Bookings if created
temporary entitlement mutations restored
other review-only rows
```

Do not delete pre-existing business/test fixtures unless they are proven to belong to this review.

Final review DB must not retain contact-bearing synthetic evidence.

---

# 29. Git integrity

Before review:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
```

Expected review baseline:

```text
d909fb3
```

If repository reality differs, report it.

Do not silently reset unrelated work.

At the end, report:

```text
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
review production changes:
review test changes:
review documentation/report changes:
unrelated dirty state:
```

A pure review may create only the intended Strict Review report.

---

# 30. Required findings format

Every defect must use:

```text
Finding ID:
Severity: P0 | P1 | P2 | P3
Area:
Evidence:
Expected:
Actual:
Security/business impact:
Required remediation:
```

Severity guidance:

```text
P0
cross-tenant data/write compromise or catastrophic authority bypass

P1
contact-policy bypass, participant spoofing, unauthorized business-context access,
security boundary failure, canonical ownership violation

P2
important correctness/evidence/regression gap without demonstrated critical security breach

P3
minor documentation/test-quality/UX consistency issue
```

Do not downgrade a demonstrated security boundary failure because a test happens to pass elsewhere.

---

# 31. Verdict rules

## VERDICT A

Allowed only when:

```text
[ ] canonical Communication ownership preserved
[ ] no duplicate messaging authority
[ ] ORDER context independently verified
[ ] BOOKING context independently verified
[ ] tenant isolation verified
[ ] actual authorized participant spoof attempts rejected
[ ] rejected spoof writes leave zero persistence
[ ] Marketplace Basic contact policy preserved recursively
[ ] Storefront Pro legitimate visibility preserved
[ ] Platform legitimate visibility preserved
[ ] sanitizer precision verified
[ ] harmless business codes preserved
[ ] reverse-chat runtime anti-disintermediation verified
[ ] rejected reverse messages not persisted
[ ] generic create bypass audited
[ ] context-type confusion audited
[ ] CRM/Sales/Support boundaries correct
[ ] entitlement behavior correct
[ ] unauthorized internal role denied
[ ] no nested PII/contact leakage
[ ] error behavior controlled
[ ] relevant tests PASS
[ ] backend TSC/typecheck PASS
[ ] runtime matrix complete
[ ] review fixtures cleaned
[ ] Git state proven
[ ] no unresolved P0/P1/P2 findings
```

Then output exactly:

```text
VERDICT A — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW APPROVED
STEP 3.7B CLOSED
```

## VERDICT B

Required if any mandatory gate is unproven or any P0/P1/P2 remains unresolved.

Output:

```text
VERDICT B — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW FAILED
STEP 3.7B NOT CLOSED
```

List exact blockers.

Do not implement the next roadmap stage.

---

# 32. Review report

Create/update the repository report:

```text
docs/prompts/PHASE_3_STEP_3.7B_COMMUNICATION_BUSINESS_CONTEXT_INTEGRATION_STRICT_REVIEW_REPORT.md
```

It must contain:

```text
1. Verdict
2. Scope and reviewed SHAs
3. Repository architecture findings
4. Endpoint/permission/context matrix
5. ORDER runtime evidence
6. BOOKING runtime evidence
7. Participant spoof evidence
8. Tenant isolation evidence
9. Basic / Pro / Platform contact-policy evidence
10. Sanitizer precision evidence
11. Reverse Marketplace regression evidence
12. Generic-create bypass review
13. Context-type confusion evidence
14. CRM / Sales / Support boundary review
15. Persistence / transaction review
16. Test-quality review
17. Test/typecheck results
18. Cleanup evidence
19. Findings
20. Git evidence
21. Closure decision
```

No placeholders such as:

```text
TBD
TODO
pending
after push
this commit
to be created
```

in the final committed report.

---

# 33. Stop condition

If VERDICT A:

```text
STEP 3.7B CLOSED
```

Then stop.

Do NOT:

```text
start the next implementation step
perform roadmap sync automatically
start Storefront 3.29J
start Storefront visual alignment
start Support implementation
```

The next action after an approved Strict Review is a separate canonical roadmap synchronization / NEXT-stage determination.

If VERDICT B:

Stop after the review report and findings.

Do not silently repair defects inside the same review.
