# PHASE 3 — STEP 3.6C — PLATFORM FINANCIAL / GOVERNANCE ACTION AUTHORITY REMEDIATION

## MODE

**IMPLEMENTATION / REMEDIATION.**

This stage follows the completed Platform Workspace Action Authority Audit.

Audit baseline:

```text
Starting/Final HEAD: 1ced16b
VERDICT B — REMEDIATION REQUIRED
```

Do not broaden this stage into a redesign of Orders, Bookings, Finance, Catalog, CRM, or Partner Workspace.

The objective is to preserve legitimate Platform operator authority while making sensitive Platform mutations explicit, granular, auditable, and incapable of silently acting as seller authority.

---

# 1. Canonical authority boundary

Preserve:

```text
PLATFORM
= Marketplace Operator
= Governance
= Support
= Security
= Financial Control
= Settlement / Compliance

PARTNER
= Commercial Seller
= Business Owner
= Own Product / Fulfillment operations
```

Platform is **not read-only**.

The remediation must not remove legitimate operator actions merely because they mutate state.

The rule is:

> Platform mutation is valid when it represents explicit operator/support/financial/governance authority. It must not silently become ordinary seller authority.

---

# 2. Confirmed regression baselines

These are already closed and must remain closed:

```text
Platform Create Customer UI          → ABSENT
Platform Create Product UI           → ABSENT
Platform ownerless POST /products    → DENIED
Partner Product creation             → PRESERVED
Partner Product owner                → actor.partnerId
Partner ownership spoofing           → PREVENTED
Platform Create Order                → DOES NOT EXIST
Platform Create Booking              → DOES NOT EXIST
```

Do not reopen these designs unless an actual regression is discovered.

---

# 3. Scope

Implement remediation for exactly these areas:

```text
A. Platform Payment initiation
B. Refund authority separation
C. Product governance vs seller-edit authority
D. Platform Order lifecycle auditability
E. Platform Booking lifecycle auditability
F. Permission/RBAC enforcement
G. Runtime/browser/security verification
```

Out of scope:

```text
new Order creation
new Booking creation
Product creation redesign
Customer creation
chat moderation
Payout implementation
new subscription tiers
Partner entitlement redesign
broad UI redesign
financial history rewrite
```

---

# 4. P1 — Platform Payment initiation

The audit established that Platform can call:

```text
POST /payments
permission: finance.payment.write
```

This is not automatically invalid.

The current business justification is legitimate marketplace cash/offline payment handling.

Preserve Platform ability to initiate a Payment for an existing Order **only when the current payment workflow permits it**.

Do not remove `POST /payments` merely because Platform can call it.

---

# 5. Payment invariants

Platform-initiated Payment must satisfy:

```text
existing Order required
amount server-derived
seller attribution inherited from canonical Order
customer/order relationship preserved
no arbitrary seller assignment
no arbitrary amount injection
no ownerless financial flow
```

Client must not be able to override canonical amount if the current domain says amount derives from Order.

Verify this in code and tests.

If the endpoint currently accepts an amount field but ignores it, document/test that behavior.

If it currently trusts arbitrary amount input, treat that as a blocker and remediate within this stage.

---

# 6. Mandatory Payment reason

For Platform-initiated/manual/offline Payment actions, require a meaningful reason.

Target:

```text
Platform initiates Payment
        ↓
reason required
        ↓
actor recorded
        ↓
timestamp recorded
        ↓
Order recorded
        ↓
Payment recorded
```

Do not require a Platform support reason for normal system/provider-generated events unless the action is actually initiated manually by Platform.

Reason validation:

```text
non-empty
trimmed
reasonable minimum meaningful length according to existing validation conventions
bounded maximum length
```

Do not invent arbitrary UX limits if project conventions already exist.

---

# 7. Payment audit event

Record an immutable/auditable event for Platform manual initiation.

Use an existing audit/event infrastructure if available.

Do not create a parallel audit subsystem unnecessarily.

Evidence should include at least:

```text
action/event type
actor user ID
actor role/context
Payment ID
Order ID
reason
timestamp
relevant before/after state where applicable
```

Never log sensitive payment secrets.

Do not log full card data, tokens, CVV, provider secrets, or credentials.

---

# 8. Payment lifecycle permissions

Audit currently conflated:

```text
finance.payment.write
```

for:

```text
create
confirm
fail
cancel
```

Separate authority where the existing permission architecture supports it.

Conceptual target:

```text
payment.create/manual_initiate
payment.lifecycle/manage
```

Do not blindly use these literal names.

Follow current repository naming conventions.

At minimum ensure:

```text
ability to initiate Payment
≠ automatically all Payment lifecycle authority
```

unless an existing role intentionally has both permissions through the role matrix.

---

# 9. Payment runtime behavior

Platform UI/API must make manual initiation explicit.

If a Platform Payment creation form/action exists, ensure the user understands this is a manual/offline financial action.

Do not add unnecessary confirmation dialogs if existing project UX already handles sensitive actions consistently.

Mandatory server authority is more important than UI hiding.

---

# 10. P1 — Refund authority separation

Current audit finding:

```text
finance.refund.write
→ create
→ process
→ fail

finance.refund.approve
→ approve
```

The current model conflates several materially different financial authorities.

Separate:

```text
Refund request/create
Refund approval
Refund execution/process
```

Use actual project permission naming conventions.

Conceptually:

```text
refund.create
refund.approve
refund.execute
```

Do not assume these exact strings if canonical permissions use another pattern.

---

# 11. Refund lifecycle authority

Define and enforce a clear lifecycle authority matrix.

Required final report should show something like:

| Refund action | Required authority | Platform roles |
|---|---|---|
| Create/request | dedicated create permission | evidence |
| Approve/reject | dedicated approval permission | evidence |
| Process/execute | dedicated execution permission | evidence |
| Fail/cancel | appropriate lifecycle permission | evidence |

Do not grant new permissions broadly just to keep tests green.

Use safe defaults.

---

# 12. Refund separation of duties

Do **not** blindly enforce:

```text
creator != approver
```

for every refund.

First inspect:

```text
current roles
current refund workflow
amounts
payment methods
existing approval semantics
existing finance role model
```

Then choose one of these explicit outcomes:

```text
A. SAME-ACTOR APPROVAL ALLOWED
```

because current business model intentionally permits it;

or:

```text
B. FOUR-EYES CONTROL REQUIRED
```

for all refunds;

or:

```text
C. CONDITIONAL FOUR-EYES CONTROL
```

for specific amount/risk/payment-method thresholds.

Do not invent a monetary threshold without canonical business evidence.

If no canonical threshold exists, do not make one up.

Permission separation itself is mandatory even if same-actor approval remains allowed.

---

# 13. Refund audit trail

For Platform financial actions record audit evidence for:

```text
create
approve/reject
process/execute
fail/cancel
```

Use existing audit infrastructure.

Capture:

```text
actor
action
Refund ID
Payment/Order relation
reason where manual operator justification is required
timestamp
before state
after state
```

Preserve append-only/auditable semantics where the project already uses them.

---

# 14. P1 — Product governance vs seller edit

Step 3.6B removed Platform Product creation.

However the audit found:

```text
catalog.product.write
```

still covers Platform actions such as:

```text
edit
archive
```

while publish has:

```text
catalog.product.publish
```

Determine and implement the correct remaining Platform authority.

Canonical direction:

```text
PARTNER
→ edits own commercial Product content

PLATFORM
→ reviews/moderates/governs Product
```

---

# 15. Platform Product content editing

Platform must not retain ordinary seller-style content editing merely through a broad `write` permission.

Determine current Platform Edit Product behavior.

If Platform currently edits normal seller fields such as:

```text
title
description
tariffs
commercial content
```

convert that authority to one of:

```text
DENIED for normal Platform governance
```

or, only if a real administrative need exists:

```text
explicit audited administrative override
```

Do not leave ordinary seller edit authority under a governance permission.

---

# 16. Product governance actions

Preserve legitimate Platform actions according to current Catalog workflow:

```text
review
moderate
publish
unpublish if supported
archive/suspend if governance semantics
policy enforcement
```

Use granular governance permissions.

Conceptual target:

```text
catalog.product.moderate
catalog.product.publish
catalog.product.archive
```

Actual names must follow repository conventions.

Do not unnecessarily multiply permissions when existing granular permissions already solve the boundary.

---

# 17. Product archive semantics

Specifically inspect `archive`.

Determine whether Platform archive means:

```text
governance removal from marketplace
```

or:

```text
seller lifecycle archival
```

If both currently use the same operation, preserve behavior only with explicit authority separation.

Do not silently redefine business semantics.

Document final decision.

---

# 18. P2 — Platform Order lifecycle auditability

Audit confirmed Platform legitimately performs support/admin Order lifecycle actions such as:

```text
accept/process
confirm ready
request booking
complete
close
cancel
suspend
```

Do not remove these actions.

Do not redesign Order state machine.

Add explicit auditability for Platform-originated support/admin lifecycle transitions.

---

# 19. Mandatory Order override/support reason

For Platform manual lifecycle mutation, require a reason where the action represents support/admin intervention.

Target audit payload:

```text
entityType: ORDER
entityId
action
actorId
actor role/context
reason
previousState
newState
timestamp
```

Do not force the same reason requirement onto automated/system state transitions.

Do not force Partner normal fulfillment actions to use Platform support reasons unless existing business rules require it.

---

# 20. Order permission granularity

Current audit found:

```text
order.accept
order.edit_noncritical
order.request_booking
order.close
order.cancel
order.suspend
```

Do not perform broad permission redesign unless needed for correctness.

`order.edit_noncritical` may remain temporarily if:

```text
all covered actions are legitimate Platform support operations
```

and audit trail/reason requirements make interventions accountable.

If it enables materially unrelated or dangerous mutations, split only the necessary authority.

Report exact decision.

---

# 21. P2 — Platform Booking lifecycle auditability

Audit confirmed Platform can perform:

```text
send to supplier
confirm
reject
service started
complete
cancel
problem handling
```

These are accepted as marketplace operator/support authority for the current architecture.

Do not remove them.

Add auditability for Platform-originated manual transitions.

---

# 22. Booking support reason

For Platform manual support/admin Booking transition, record:

```text
entityType: BOOKING
entityId
action
actorId
actor role/context
reason
previousState
newState
timestamp
```

Use existing audit infrastructure.

Do not require the same Platform reason for system-generated transitions.

---

# 23. booking.confirm permission

The audit found one permission may currently cover multiple semantics:

```text
confirm
reject
service started
complete
problem
```

Do not automatically split it into five permissions.

First verify current role matrix and operational model.

Split only where materially different authority is required.

At minimum document the final authority mapping.

If retained, explain why it is safe.

---

# 24. Audit infrastructure reuse

Before adding any new model/table, search for existing:

```text
AuditLog
ActivityLog
EventLog
OperationalNote
domain event history
status history
actor metadata
```

Prefer existing canonical audit infrastructure.

Do not misuse CRM Activity for unrelated immutable financial/security audit if its domain contract does not fit.

Do not misuse Operational Notes as the authoritative financial audit log.

If no suitable audit infrastructure exists, implement the smallest domain-appropriate append-only audit mechanism and document why.

---

# 25. Audit immutability

Sensitive Platform action audit records must not be casually editable/deletable by the same actor.

Target properties:

```text
append-only
actor recorded
timestamp recorded
reason preserved
entity/action linkage
```

If existing infrastructure has stronger guarantees, preserve them.

---

# 26. API bypass protection

UI reason fields are not sufficient.

Server must reject sensitive Platform actions when required audit reason/context is absent.

Test direct API calls.

Examples:

```text
Platform manual Payment without reason
→ 400/422 according to project convention

Platform Order support transition without required reason
→ denied

Platform Booking support transition without required reason
→ denied
```

Do not return accidental 500s.

---

# 27. Partner behavior isolation

The remediation must not accidentally impose Platform-specific support workflow on normal Partner operations.

Verify:

```text
Partner Product editing still works according to own permissions
Partner Product creation still works
Partner Order/Booking operations still follow current contract
Partner does not receive Platform governance permissions
Partner cannot approve/process Platform-only financial operations unless explicitly canonical
```

---

# 28. Role matrix

After permission changes, produce an exact role/permission matrix for affected permissions.

At minimum include relevant:

```text
ADMIN
DIRECTOR
FINANCE
OPERATOR
SALES_MANAGER
PARTNER
```

plus any other roles actually granted affected permissions.

Do not assume all Platform roles should receive new financial/governance permissions.

Preserve least privilege.

---

# 29. Migration / seed safety

If permissions are persisted in DB and require migration/seed changes:

```text
migration must be idempotent/safe
existing roles must receive only intended replacement permissions
obsolete broad permissions must not continue granting bypass authority
```

Check existing RolePermission rows after migration.

Do not rely only on source constants.

Provide DB evidence.

---

# 30. Existing data

Do not rewrite historical Payments, Refunds, Orders, or Bookings merely because new audit requirements are introduced.

Historical records may lack reasons.

That is acceptable if explicitly classified as:

```text
legacy pre-audit record
```

Do not fabricate reasons such as:

```text
"legacy"
"system"
"migration"
```

unless stored as explicit migration metadata rather than false business justification.

---

# 31. Runtime verification — Platform

Use real runtime/browser verification.

## Catalog

Verify:

```text
Create Product absent
normal seller Edit absent/denied if remediation requires it
moderation/governance actions still work
```

## Orders

Verify a safe Platform support transition:

```text
reason required
transition succeeds with valid reason
audit record created
```

## Bookings

Verify:

```text
reason required
transition succeeds with valid reason
audit record created
```

## Payments

Verify:

```text
manual/offline initiation
reason required
amount server-derived
audit record created
```

## Refunds

Verify:

```text
create authority
approve authority
execute/process authority
permissions enforced independently
audit records created
```

---

# 32. Runtime verification — Partner

Verify:

```text
Partner Product create still works
Product.partnerId = actor.partnerId
Partner Product edit still works according to current contract
Partner cannot invoke Platform governance permission
Partner cannot spoof owner
```

Where Order/Booking Partner workflows exist, confirm no regression.

---

# 33. RU / AZ / EN

Any new visible:

```text
reason
audit reason
financial action
governance action
validation error
```

labels/messages must use existing i18n architecture.

Verify:

```text
RU
AZ
EN
```

No raw keys.

Do not translate immutable internal event codes in storage.

Store locale-neutral event/action codes and localize in UI.

---

# 34. Required security tests

At minimum:

```text
1. Platform Product create remains denied

2. Platform ordinary seller Product edit denied
   if final authority decision removes it

3. Platform moderation action allowed with correct governance permission

4. Platform moderation denied without governance permission

5. Platform Payment initiation without required reason denied

6. Platform Payment initiation with valid reason succeeds

7. Payment amount remains server-authoritative

8. Refund create permission does not imply approve

9. Refund approve permission does not imply execute

10. Refund execute permission does not imply create

11. Order Platform transition without required reason denied

12. Order Platform transition with reason succeeds + audit

13. Booking Platform transition without required reason denied

14. Booking Platform transition with reason succeeds + audit

15. Partner cannot obtain Platform governance authority

16. Partner ownership spoof remains impossible
```

Add cases required by actual implementation.

---

# 35. Regression suites

Run affected backend suites plus established CRM/Analytics/frontend regressions.

At minimum report:

```text
Catalog tests
Order tests
Booking tests
Payment tests
Refund tests
CRM tests
Analytics tests
Frontend tests
Backend TSC
Frontend TSC
```

Do not state only "all tests pass."

Give exact X/X counts.

---

# 36. DB evidence

If permissions/audit tables are persisted, provide DB evidence.

Examples:

```text
affected permission rows
role grants
audit event count before action
audit event count after action
actor
entity
action
reason presence
```

Do not expose secrets.

---

# 37. No regression of Step 3.6B legacy handling

Preserve:

```text
31 legacy ownerless Products
30 TEST/SEED
1 UNKNOWN
26 ownerless-linked historical Orders
```

unless a separately evidenced cleanup was explicitly required.

This stage must not assign them a seller.

Do not create a TravelHub-owned Partner to absorb them.

---

# 38. Product.partnerId schema status

This stage does not change the prior decision:

```text
Product.partnerId NOT NULL — NOT READY
```

unless new deterministic evidence resolves every legacy blocker.

Do not bundle schema hardening into this remediation without explicit justification.

Future production ownerless writes must remain impossible.

---

# 39. Payouts

Payout authority was not implemented in Platform UI according to the audit.

Do not implement Payout UI in this stage.

If backend Payout mutation endpoints exist and reveal a critical bypass during regression work, report them, but do not broaden scope without approval.

---

# 40. Chat moderation

Explicitly out of scope.

Do not implement:

```text
ContactDetector
LinkDetector
SocialHandleDetector
AddressDetector
CircumventionDetector
AttachmentScanner
MessageModerationService
```

That remains a separate architecture stage.

---

# 41. Git discipline

Before changes:

```text
git status
git rev-parse HEAD
git rev-parse origin/master
```

Expected starting baseline:

```text
1ced16b
```

Verify it.

After implementation:

```text
git status
git rev-parse HEAD
git rev-parse origin/master
git log --oneline -n 10
```

Commit and push only after all mandatory gates pass.

---

# 42. Required final report

Return a complete implementation report.

## A. Verdict

Only:

```text
VERDICT A — FULLY CLOSED
```

or:

```text
VERDICT B — NOT CLOSED
```

No conditional A.

---

## B. Changed files

Exact paths and purpose.

---

## C. Payment authority

Show:

```text
who can initiate
required permission
reason enforcement
amount authority
audit event
lifecycle permission separation
```

---

## D. Refund authority

Show exact:

```text
create
approve/reject
execute/process
fail/cancel
```

permission mapping.

State the chosen separation-of-duties policy:

```text
SAME-ACTOR ALLOWED
FOUR-EYES REQUIRED
CONDITIONAL FOUR-EYES
```

and evidence/rationale.

---

## E. Product governance

Show:

```text
Partner seller edit authority
Platform moderation authority
Platform publish/archive authority
Platform ordinary seller edit authority
```

with exact permissions.

---

## F. Order support audit

Show one real/test runtime transition:

```text
before state
action
reason
after state
actor
audit record
```

---

## G. Booking support audit

Same evidence.

---

## H. Permission matrix

Exact affected roles × permissions.

---

## I. API security evidence

Direct API results for missing reason, missing permission, cross-scope attempts, and valid actions.

---

## J. DB evidence

Permission rows and audit records where applicable.

---

## K. Tests

Exact commands and X/X results.

---

## L. Browser/runtime evidence

Platform and Partner.

RU/AZ/EN.

---

## M. Regression evidence

Explicitly confirm:

```text
Platform Create Customer absent
Platform Create Product absent
ownerless Product production create denied
Platform Create Order absent
Platform Create Booking absent
Partner Product create works
anti-spoofing works
Step 3.6A CRM attribution passes
```

---

## N. Git evidence

```text
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
git status:
```

---

# 43. Closure gates

`VERDICT A` is allowed only when all mandatory gates pass:

```text
[ ] legitimate Platform Payment initiation preserved
[ ] Payment amount remains server-authoritative
[ ] Platform manual Payment reason enforced server-side
[ ] Platform manual Payment audited
[ ] Payment create/lifecycle authority no longer unintentionally conflated
[ ] Refund create/approve/execute authorities explicitly separated
[ ] Refund SoD policy explicitly decided and enforced as decided
[ ] Refund financial actions audited
[ ] Platform ordinary seller Product edit removed or converted to explicit audited override
[ ] Product governance actions preserved
[ ] Platform Product creation remains denied
[ ] Platform Order creation remains absent
[ ] Platform Booking creation remains absent
[ ] Platform Order support transitions audited with reason where required
[ ] Platform Booking support transitions audited with reason where required
[ ] Partner workflows not regressed
[ ] Partner owner spoofing remains impossible
[ ] least-privilege role matrix verified
[ ] direct API bypass tests pass
[ ] RU/AZ/EN verified
[ ] required backend/frontend tests pass
[ ] Git evidence complete
```

If any mandatory gate fails:

```text
VERDICT B — NOT CLOSED
```

with exact blockers.

---

# 44. Expected final authority model

```text
                         TRAVELHUB
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
          ↓                                   ↓
     PLATFORM                             PARTNER
 Marketplace Operator                 Commercial Seller
          │                                   │
          ├─ Product moderation               ├─ Create own Product
          ├─ Product governance               ├─ Edit own Product
          ├─ Order support                    ├─ Fulfillment
          ├─ Booking support                  └─ Own business operations
          ├─ Manual/offline Payment control
          ├─ Refund financial governance
          ├─ Security / compliance
          └─ Audited administrative actions
```

Sensitive Platform actions must be:

```text
explicit
permission-scoped
server-enforced
audited
reasoned where manual intervention requires justification
```

Platform remains a marketplace operator.

Partner remains the commercial seller.

Do not proceed to the next architecture stage automatically after completion. Return evidence and wait for approval.
