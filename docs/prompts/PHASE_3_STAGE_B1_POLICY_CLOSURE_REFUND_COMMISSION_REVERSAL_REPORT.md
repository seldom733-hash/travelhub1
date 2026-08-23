# PHASE 3 — STAGE B.1 POLICY CLOSURE REPORT
## Marketplace Refund → Commission Reversal Authority

**Status:** VERDICT A — B.1 POLICY CLOSURE COMPLETE

**Date:** 2026-08-23

**Scope:** Final business-policy closure for Stage B.1. Authoritative commission reversal policy + ADR/roadmap update.

---

## DELIVERABLE A — POLICY CONFIRMATION

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

### Canonical Rules

```text
1. Commission Reversal = Qualifying Refunded Commission Base × Applicable Commission Rate

2. Net Expected Marketplace Commission
   = Gross Expected Commission − Commission Reversal

3. For uniform-rate orders:
   Net Expected Commission
   = (Qualifying Commission Base − Qualifying Refunded Base) × Rate

4. For multi-rate/multi-service orders:
   Reversal must be computed against the applicable refunded commission basis,
   NOT simply (Order.amount − totalRefunds) × rate.

5. Commission reversal cannot exceed the commission attributable to the refunded basis.

6. Commission reversal must be idempotent (same refund event → one reversal).

7. Commission reversal must be auditable (historical facts preserved).

8. Storefront SaaS subscription refunds are governed by separate billing policy (Stage I).

9. Explicit non-refundable TravelHub fees are separate revenue streams.
```

---

## DELIVERABLE B — CURRENT IMPLEMENTATION AUDIT

| Area | Current Behavior | Matches Policy? | Gap | Implementation Owner |
|---|---|---|---|---|
| **Commission creation** | `CommissionService.createAccrualForOrder` — creates Commission + CommissionAccrual at Order creation from frozen `commissionSnapshot`. `PARTNER_COLLECT` model. Amount = `round_half_up(base × rate)`. | ✅ YES (creation is correct) | None for creation | N/A (complete) |
| **Partial payment** | `Order.paymentStatus = PARTIALLY_PAID` exists. `Order.paidAmount` tracks collected amount. Commission is created at full order value regardless of payment status. | ✅ YES (per PARTNER_COLLECT design) | None — commission is recognized at order creation, independent of payment status | N/A |
| **Full refund** | `RefundService.createRefund` creates Refund for CAPTURED Payment. **No commission reversal.** RefundService explicitly documents: "Refund ≠ Commission reversal". | ❌ **NO** | **Commission is NOT reversed on refund.** The approved policy requires full applicable commission reversal on full qualifying refund. | **Stage 2.14** (commission reversal pipeline) |
| **Partial refund** | Same as full refund — RefundService creates partial refund with over-refund protection. **No commission reversal.** | ❌ **NO** | **Commission is NOT reversed proportionally.** The approved policy requires proportional commission reversal on partial qualifying refund. | **Stage 2.14** |
| **Commission reversal** | **Not implemented.** No `CommissionReversal` model, no reversal status on Commission, no event handler for refund→commission interaction. | ❌ **NO** | Complete absence of reversal mechanism | **Stage 2.14** |
| **Duplicate refund protection** | `Refund.isActiveRefund` boolean + partial unique index on `(paymentId, amount)` — ≤1 active refund per payment+amount. Advisory xact lock prevents concurrent over-refund. | ✅ YES (refund-level) | Reversal must also be idempotent (not yet implementable) | Stage 2.14 |
| **Audit trail** | `RefundHistory` + `Commission.history` (if extended) + `RefundProcessed` event | ✅ PARTIAL (refund audit exists; commission audit would need extension) | Commission reversal audit trail needed | Stage 2.14 |
| **Payout/settlement interaction** | `SettlementService` exists but has no commission-specific logic. Settlement records gross/refunds/provider fees without commission breakdown. | ❌ NO | Settlement must represent commission reversal as a financial event | Stage 2.14+ |

### Summary Gap

```text
Current commission creation behavior:
  Commission + CommissionAccrual created at Order creation from frozen
  commissionSnapshot. PARTNER_COLLECT model. Amount = base × rate.
  Status = ACCRUED. No live policy lookup.

Current refund behavior:
  RefundService creates Refund for CAPTURED Payment with idempotent
  lifecycle (REQUESTED → APPROVED → PROCESSED | FAILED). Over-refund
  protection via advisory lock. 0 side effects on Commission/CommissionAccrual.

Current reversal behavior:
  NONE. Commission is never modified after creation.

Current persistence capability:
  Commission + CommissionAccrual exist with ACCRUED status.
  No REVERSED/REVERSED_PARTIALLY status.
  No CommissionReversal model.

Current audit capability:
  Refund audit exists (RefundHistory + events).
  Commission audit exists (Commission.history if extended).
  No cross-domain refund→commission audit trail.

Gap to approved policy:
  COMPLETE GAP. Commission reversal on refund is not implemented.
  Policy requires:
    1. CommissionReversal model or Commission status extension
    2. Refund→Commission attribution logic
    3. Proportional reversal computation
    4. Idempotent reversal execution
    5. Audit trail for reversal events
    6. Settlement/ledger integration
```

---

## DELIVERABLE C — EXAMPLES

### Example 1 — Full Refund

```text
Order value:                    ₼1,000
Commission rate:                  10%
Gross Expected Commission:       ₼100.00

Customer refund (full):          ₼1,000.00

Commission reversal:             ₼100.00
Net Expected Commission:           ₼0.00
```

### Example 2 — Partial Refund

```text
Order value:                    ₼1,000
Commission rate:                  10%
Gross Expected Commission:       ₼100.00

Customer refund (partial):         ₼300.00

Commission reversal:              ₼30.00
Remaining qualifying value:       ₼700.00
Net Expected Commission:          ₼70.00
```

### Example 3 — Partial Customer Payment + Partial Refund

```text
Order value:                    ₼1,000
Customer paid:                    ₼600
Customer outstanding:             ₼400
Customer refund:                  ₼200
Commission rate:                  10%

BOOKED GMV:                     ₼1,000.00
COLLECTED GMV:                    ₼600.00
OUTSTANDING GMV:                  ₼400.00
NET COLLECTED (after refund):     ₼400.00

Gross Expected Commission:       ₼100.00
Commission reversal (proportional):
  Refunded base:                  ₼200.00
  Reversal:             ₼200 × 10% = ₼20.00

Net Expected Commission:          ₼80.00
Collected Commission status:      NOT PROVABLE (Stage 2.14)
Outstanding Commission:           ≥ ₼80.00
```

---

## DELIVERABLE D — ADR/ROADMAP EVIDENCE

### Files Updated

1. **`docs/architecture/ADR-PLATFORM-BUSINESS-PERSPECTIVE-SEPARATION.md`** — Added §17: Marketplace Refund Commission Policy
2. **`docs/prompts/PHASE_3_STAGE_B1_POLICY_CLOSURE_REFUND_COMMISSION_REVERSAL_REPORT.md`** — This file

### Confirmation

```text
ADR updated: YES ✅
Roadmap updated: YES ✅ (via ADR implementation stages)
Policy marked ACCEPTED/MANDATORY: YES ✅
B.1 unresolved business-policy blocker removed: YES ✅
Downstream implementation stage assigned: YES ✅ (Stage 2.14)
```

---

## DELIVERABLE E — OPEN FINANCIAL POLICY QUESTIONS

```text
Remaining B.1 financial policy blockers: NONE
```

### Future-Stage Decisions (Not B.1 Blockers)

| Question | Appropriate Stage | Current Status |
|---|---|---|
| Storefront SaaS subscription refund/credit policy | Stage I (billing engine) | Deferred — no billing engine exists |
| Commission reversal timing: at refund REQUESTED or PROCESSED? | Stage 2.14 | Business decision pending (recommendation: PROCESSED) |
| Reversed commission: write-off or create negative CommissionAccrual? | Stage 2.14 | Ledger architecture decision |
| Non-refundable fee types and policies | Future (additive) | Not authorized yet |

---

## VERDICT

## VERDICT A — B.1 POLICY CLOSURE COMPLETE

All criteria met:

- ✅ Proportional Marketplace Commission reversal is recorded as canonical authority
- ✅ Full and partial refund behavior are unambiguous
- ✅ Non-refundable future TravelHub fees are explicitly separated
- ✅ Storefront SaaS is explicitly excluded from this policy
- ✅ Current implementation gap is audited (complete gap — no reversal exists)
- ✅ ADR is updated with §17: Marketplace Refund Commission Policy
- ✅ Roadmap is updated (Stage 2.14 owns implementation)
- ✅ Downstream implementation ownership is explicit (Stage 2.14)
- ✅ No unresolved B.1 financial-policy blocker remains

---

## DOWNSTREAM IMPLEMENTATION REQUIREMENTS (Stage 2.14)

```text
Commission Reversal Invariants:

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

```text
Idempotency Requirements:
- Same refund event → one applicable commission reversal
- Repeated webhook/event/job execution must not create repeated reversals
- Use canonical event identity / unique constraints / transactional protection
```

```text
Implementation Scope:
- CommissionReversal model or Commission status extension (REVERSED)
- Refund→Commission attribution logic (orderId → Commission → amount)
- Proportional reversal computation (refund amount / payment amount × commission)
- Idempotent reversal execution (within RefundService.processRefund or separate consumer)
- Audit trail for reversal events (CommissionReversalHistory or extended CommissionHistory)
- Settlement/ledger integration (reversal as financial event)
```

---

**STOP.** Do not proceed to Stage C, H, I, or any other stage automatically. B.1 is now fully closed.
