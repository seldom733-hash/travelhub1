# PHASE 3 — COMMAND CENTER / PLATFORM BUSINESS ARCHITECTURE
## STAGE B.1 — POLICY CLOSURE
## MARKETPLACE REFUND → COMMISSION REVERSAL AUTHORITY

### STATUS
**Final business-policy closure for Stage B.1.**

Stage B.1 Remediation returned:

```text
VERDICT A — B.1 REMEDIATION COMPLETE
```

with one explicit unresolved business-policy question:

> When a customer payment is refunded, should TravelHub reverse the corresponding Marketplace commission?

The business decision is now **APPROVED / MANDATORY**.

---

# 1. AUTHORITATIVE DECISION

For ordinary Marketplace Commission:

```text
CUSTOMER REFUND
→ PROPORTIONAL MARKETPLACE COMMISSION REVERSAL
```

Required rules:

```text
Full qualifying refund
→ full applicable Marketplace Commission reversal

Partial qualifying refund
→ proportional applicable Marketplace Commission reversal

No qualifying refund
→ no refund-driven commission reversal
```

TravelHub must not retain ordinary Marketplace Commission on the portion of the underlying qualifying transaction that has been refunded to the customer.

This decision becomes canonical financial authority.

---

# 2. BASE EXAMPLE

```text
Order value                     ₼1,000
Marketplace commission rate        10%
Gross Expected Commission          ₼100
```

## Full refund

```text
Qualifying refund              ₼1,000
Commission reversal              ₼100
Net Expected Commission             ₼0
```

## Partial refund

```text
Qualifying refund                ₼300
Commission reversal               ₼30
Remaining qualifying value       ₼700
Net Expected Commission           ₼70
```

The example illustrates the policy only. Implementation must use canonical repository commission/refund records and actual commission rules rather than blindly reproducing arithmetic at presentation level.

---

# 3. CANONICAL CONCEPTUAL FORMULA

For a simple percentage-based commission where the entire refunded amount belongs to the same commission basis:

```text
Gross Expected Commission
=
Qualifying Commission Base × Commission Rate
```

and:

```text
Commission Reversal
=
Qualifying Refunded Commission Base × Applicable Commission Rate
```

therefore:

```text
Net Expected Marketplace Commission
=
Gross Expected Commission
− Commission Reversal
```

Equivalent simplified formula:

```text
Net Expected Commission
=
(Qualifying Commission Base − Qualifying Refunded Base)
× Commission Rate
```

may only be used when commission rate/basis is uniform and the domain model proves that simplification is valid.

---

# 4. DO NOT ASSUME ALL REFUNDS SHARE ONE COMMISSION BASIS

Future or existing orders may contain:

```text
multiple services
different commission rates
different partners
different fee rules
partially refundable components
non-refundable components
```

Therefore the implementation architecture must support commission reversal against the **applicable refunded commission basis**, not simply:

```text
Order.amount - totalRefunds
```

without domain attribution.

Audit actual repository structure before implementation.

---

# 5. PARTIAL CUSTOMER PAYMENTS REMAIN A SEPARATE DIMENSION

Refund state and collection/payment state must not be collapsed.

Example:

```text
Order value                    ₼1,000
Customer paid                    ₼600
Customer outstanding             ₼400
Customer refund                  ₼200
Commission rate                    10%
```

The system must distinguish at least conceptually:

```text
ORDER / GMV STATE
Booked value

PAYMENT STATE
Collected amount
Outstanding amount

REFUND STATE
Refunded amount
Net collected customer amount

TRAVELHUB REVENUE STATE
Gross Expected Commission
Commission Reversal
Net Expected Commission
Collected Commission — if/when provable
Outstanding Commission — according to approved collection policy
```

Do not infer one state from another without canonical business rules.

---

# 6. EXPECTED COMMISSION AFTER REFUND

The approved policy affects Expected Marketplace Revenue.

Conceptually:

```text
Gross Expected Marketplace Revenue
− applicable commission reversals
=
Net Expected Marketplace Revenue
```

A refund must therefore be visible in future revenue semantics.

Do not continue showing the pre-refund commission entitlement as current expected revenue after a qualifying refund.

---

# 7. COLLECTED COMMISSION

Stage B.1 established that current Marketplace **Collected Revenue** is not fully provable under the present model.

This policy does NOT fabricate collected-revenue capability.

If a commission was already financially collected before a later customer refund, future financial implementation must represent the resulting:

```text
commission reversal
credit
negative adjustment
settlement adjustment
or equivalent canonical financial event
```

according to the future ledger/payment architecture.

Do not silently rewrite historical payment facts.

---

# 8. NON-REFUNDABLE TRAVELHUB FEES — SEPARATE REVENUE STREAM

Future TravelHub business rules may introduce fees such as:

```text
cancellation fee
service fee
administrative fee
other explicitly non-refundable TravelHub-owned fee
```

Such fees must NOT be hidden inside ordinary Marketplace Commission.

Required principle:

```text
Marketplace Commission
→ subject to the approved proportional refund reversal policy

Explicit Non-refundable TravelHub Fee
→ separate revenue stream / fee type
→ governed by its own contract and refund policy
```

This stage does not authorize or implement any new fee.

It only preserves the architectural ability to support such fees later.

---

# 9. STOREFRONT SaaS IS NOT GOVERNED BY THIS POLICY

This decision applies to:

```text
Marketplace Commission
```

It does NOT automatically define Storefront SaaS subscription refund behavior.

Storefront SaaS remains a separate business model:

```text
Marketplace Business
≠ Storefront SaaS
≠ Storefront Commerce
```

Subscription credits/refunds/cancellations must be governed by Storefront billing policy in Stage I or the appropriate later billing stage.

---

# 10. GMV SEMANTICS REMAIN AUTHORITATIVE

Preserve the B.1 Remediation distinction:

```text
Booked / Contracted GMV
≠
Collected / Paid GMV
≠
Outstanding amount
```

A refund adds another distinct dimension.

Do not label multiple different bases simply as `GMV` on different management surfaces without explicit semantics.

In particular, audit/retain the current intended distinction:

```text
Executive
→ Booked GMV / qualifying sold value

Channel Health
→ Collected GMV / paid value
```

If both remain visible, UI labels/tooltips/contracts must make the difference unmistakable.

---

# 11. AZN AUTHORITY REMAINS MANDATORY

Preserve:

```text
Platform Reporting Currency = AZN
Storefront Billing Currency = AZN
Premium Storefront current List Price = ₼199/month
```

All PLATFORM aggregated monetary outputs related to this policy must use canonical AZN reporting semantics.

Do not reintroduce USD authority.

---

# 12. PROFIT REMAINS NOT PROVABLE

Commission after reversal is still Revenue semantics, not Profit.

Required:

```text
Revenue ≠ Profit
Net Revenue ≠ automatically Profit
```

Without a complete cost model:

```text
Actual Profit = NOT PROVABLE
Expected Profit = NOT PROVABLE
```

Do not create profit KPIs from commission values.

---

# 13. UPDATE THE AUTHORITATIVE ADR — REQUIRED

Update:

```text
docs/architecture/ADR-PLATFORM-BUSINESS-PERSPECTIVE-SEPARATION.md
```

Add an explicit authoritative decision:

```text
Marketplace Refund Commission Policy
Status: ACCEPTED / MANDATORY

Ordinary Marketplace Commission is reversed proportionally
to the qualifying refunded commission basis.

Full qualifying refund → full applicable commission reversal.
Partial qualifying refund → proportional applicable commission reversal.

Explicit future non-refundable TravelHub fees are separate
revenue streams and are not ordinary Marketplace Commission.
```

Also confirm the ADR continues to contain:

```text
Platform Reporting Currency = AZN
Premium Storefront List Price = ₼199/month
partial payment semantics
Expected ≠ Collected ≠ Outstanding Revenue
Revenue ≠ Profit
Marketplace Business ≠ Storefront SaaS ≠ Storefront Commerce
```

---

# 14. UPDATE CANONICAL ROADMAP — REQUIRED

Record this policy closure as the final B.1 business-policy closure.

Do not renumber historical stages destructively.

Target history should clearly show:

```text
Stage B.1 — Business Model & Financial Metrics Authority Reconciliation
→ VERDICT B

Stage B.1 Remediation
→ VERDICT A

Stage B.1 Policy Closure — Refund Commission Reversal
→ current closure
```

Record downstream implementation ownership.

At minimum identify where the following will be implemented/tested:

```text
commission reversal persistence/calculation
refund attribution to commission basis
Executive revenue semantics
Booked vs Collected GMV labels
Storefront billing
Revenue Mix
financial regression tests
```

Use the actual current roadmap stage ownership rather than inventing a duplicate roadmap.

---

# 15. AUDIT CURRENT REFUND / COMMISSION IMPLEMENTATION

Before changing code, inspect current HEAD for:

```text
Commission model
Refund model / payment refund fields
Order refund state
Booking cancellation/refund state
Payment events
Payout logic
PARTNER_COLLECT behavior
commission creation
commission settlement
existing reversal/adjustment logic
```

Return:

```text
Current commission creation behavior:
Current refund behavior:
Current reversal behavior:
Current persistence capability:
Current audit capability:
Gap to approved policy:
```

Do not assume the policy is already implemented just because refund fields exist.

---

# 16. IMPLEMENTATION SCOPE OF THIS CLOSURE

The primary purpose is to close financial authority and update durable architecture/roadmap.

If current code already has a safe, isolated commission-reversal mechanism, verify whether it matches the approved policy.

Do NOT build a major financial ledger in this closure.

If correct implementation requires broader settlement/ledger work, assign it to the appropriate roadmap implementation stage with exact acceptance criteria.

Small semantic/documentation/test corrections may be made where safe.

---

# 17. REQUIRED FUTURE IMPLEMENTATION INVARIANTS

Record these as mandatory acceptance criteria for the implementation stage:

```text
1. Full qualifying refund cannot leave ordinary commission
   on the refunded commission basis.

2. Partial qualifying refund reverses only the applicable
   commission portion.

3. Commission reversal cannot exceed the commission attributable
   to the refunded basis.

4. Duplicate refund processing must not duplicate reversal.

5. Refund/reversal operations must be auditable.

6. Reversal must preserve historical financial facts rather than
   silently deleting prior commission events where ledger semantics apply.

7. Refund attribution must respect service/partner/commission-rate scope.

8. Storefront SaaS subscription refunds must not accidentally use
   Marketplace Commission rules.

9. PLATFORM monetary reporting remains AZN.

10. Revenue after reversal must not be labeled Profit.
```

---

# 18. IDEMPOTENCY / CONCURRENCY REQUIREMENT

Future refund-driven commission reversal must be idempotent.

Conceptually:

```text
same refund event
→ one applicable commission reversal
```

Repeated webhook/event/job execution must not create repeated reversals.

Where implementation is event-driven, use canonical event identity / unique constraints / transactional protection according to repository conventions.

Do not implement a weak find-then-insert-only pattern where concurrent duplicate processing is possible.

---

# 19. REFUND REVERSAL EVIDENCE FOR DECISION INTELLIGENCE

Stage B Decision Signal Foundation already exists.

This closure does NOT create new Decision Signals.

However, future Decision Intelligence may use factual evidence such as:

```text
refundedAmount
commissionReversed
netExpectedRevenue
affectedOrder
affectedPartner
```

These values must come from authoritative financial/domain calculations, not AI inference.

Do not implement WHY / IMPACT / ACTION here.

---

# 20. REQUIRED DELIVERABLE A — POLICY CONFIRMATION

Return exactly:

```text
Marketplace ordinary commission refund policy:
PROPORTIONAL REVERSAL

Full qualifying refund:
FULL APPLICABLE COMMISSION REVERSAL

Partial qualifying refund:
PROPORTIONAL APPLICABLE COMMISSION REVERSAL

Future explicit non-refundable TravelHub fees:
SEPARATE REVENUE STREAM / SEPARATE POLICY

Storefront SaaS governed by this policy:
NO
```

---

# 21. REQUIRED DELIVERABLE B — CURRENT IMPLEMENTATION AUDIT

Return:

| Area | Current behavior | Matches policy? | Gap | Implementation owner |
|---|---|---:|---|---|

Include:

```text
commission creation
partial payment
full refund
partial refund
commission reversal
duplicate refund protection
audit trail
payout/settlement interaction
```

---

# 22. REQUIRED DELIVERABLE C — EXAMPLES

Provide at least:

### Example 1 — Full refund
```text
Order value
Commission rate
Gross commission
Refund
Reversal
Net commission
```

### Example 2 — Partial refund
Same fields.

### Example 3 — Partial customer payment + partial refund
Show separately:

```text
Booked value
Paid
Outstanding
Refunded
Net customer collection
Gross expected commission
Commission reversal
Net expected commission
Collected commission status/provability
```

Use AZN.

---

# 23. REQUIRED DELIVERABLE D — ADR / ROADMAP EVIDENCE

Return exact changed files and confirm:

```text
ADR updated: YES/NO
Roadmap updated: YES/NO
Policy marked ACCEPTED/MANDATORY: YES/NO
B.1 unresolved business-policy blocker removed: YES/NO
Downstream implementation stage assigned: YES/NO
```

---

# 24. REQUIRED DELIVERABLE E — OPEN FINANCIAL POLICY QUESTIONS

List any remaining unresolved financial business-policy questions discovered during the audit.

Do not invent blockers.

If none remain within current B.1 scope, return:

```text
Remaining B.1 financial policy blockers: NONE
```

Questions that legitimately belong to future Storefront billing or accounting implementation should be listed separately as future-stage decisions, not used to keep B.1 artificially open.

---

# 25. VERDICT

Return exactly one:

## VERDICT A — B.1 POLICY CLOSURE COMPLETE

Only if:

- proportional Marketplace Commission reversal is recorded as canonical authority;
- full and partial refund behavior are unambiguous;
- non-refundable future TravelHub fees are explicitly separated;
- Storefront SaaS is explicitly excluded from this policy;
- current implementation gap is audited;
- ADR is updated;
- roadmap is updated;
- downstream implementation ownership is explicit;
- no unresolved B.1 financial-policy blocker remains.

## VERDICT B — POLICY CLOSURE REMEDIATION REQUIRED

Use if the decision is documented incompletely or contradictory authority remains.

## VERDICT C — BLOCKED

Use only if repository evidence reveals another policy decision that must be resolved before this closure can be made coherent.

State the exact blocker.

---

# 26. STOP

After completing this policy closure:

**STOP.**

Do not proceed automatically to Stage C, H, I, billing implementation, Decision Queue, WHY, IMPACT or ACTION.

Return the policy-closure report and wait for review.
