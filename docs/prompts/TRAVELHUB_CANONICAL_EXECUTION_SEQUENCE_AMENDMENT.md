# TRAVELHUB — CANONICAL ROADMAP EXECUTION SEQUENCE AMENDMENT
## CURRENT EXECUTION ORDER / SINGLE SOURCE OF TRUTH

**Project:** TravelHub  
**Task type:** Canonical Roadmap documentation amendment only  
**Target:** `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`  
**Implementation:** FORBIDDEN

# 1. PURPOSE

Update the canonical TravelHub Roadmap so that it contains not only logical Step numbering, but also the **authoritative current implementation sequence**.

From this point forward:

> The next implementation step MUST be determined from the canonical Roadmap execution sequence, not from chat history, memory, numeric step ordering, or an implementation agent's assumption.

Logical numbering and actual execution order are separate concepts.

# 2. ADD CANONICAL SECTION

Add a clearly visible section near the canonical status / dependency section:

# CURRENT CANONICAL EXECUTION SEQUENCE

This section is the authoritative operational sequence for implementation.

It must contain:

- current completed boundary;
- currently running review/step;
- exact next step after approval;
- subsequent planned steps;
- prerequisite gates;
- return points to normal numbered sequence;
- explicit rule for how amendments alter sequence.

# 3. CURRENT STATE

Verify against repository/Roadmap before writing, but expected state is:

Completed and approved:
- Step 2.5 — Order Creation Consumer ✅
- Step 2.5A — Order Temporal Contract ✅
- Service Templates / Period Pricing & Availability Roadmap Amendment ✅ APPROVED WITH REVIEW FIXES

Current:
- Step 2.5B — Acquisition Source Propagation — implementation completed, STRICT REVIEW pending/running.

Do not mark Step 2.5B APPROVED unless its Strict Review actually completed successfully.

# 4. AUTHORITATIVE SEQUENCE AFTER 2.5B APPROVAL

If Step 2.5B Strict Review is APPROVED, the canonical execution order MUST be recorded as:

1. **Reverse Marketplace ADR**
   - formalize `reverse.*` bounded context;
   - ownership of Seller Commercial Capabilities;
   - BuyerRequest;
   - Matching/Distribution;
   - Seller Proposal;
   - relationship with Communication and Sales;
   - no implementation in the ADR step.

2. **Reverse Marketplace ADR — STRICT REVIEW**

3. **Step 2.2A — Seller Commercial Capabilities & Destination Coverage**

4. **Step 2.2A — STRICT REVIEW**

5. **Step 2.2B — Buyer Request / Reverse Marketplace Foundation**

6. **Step 2.2B — STRICT REVIEW**

7. **Step 2.2C — Buyer Request Matching & Distribution**

8. **Step 2.2C — STRICT REVIEW**

9. **Step 2.2D — Seller Proposal Foundation**

10. **Step 2.2D — STRICT REVIEW**

11. **Step 2.2E — Buyer Request / Proposal Communication**

12. **Step 2.2E — STRICT REVIEW**

13. **Step 2.2F — Proposal → Canonical Sales Conversion**

14. **Step 2.2F — STRICT REVIEW**

# 5. SERVICE TEMPLATES RETURN POINT

The Service Templates / Period Pricing & Availability amendment has already been approved as planning.

Record an explicit return point after Reverse Marketplace 2.2A–2.2F:

15. Resolve required implementation-time gates for:
   - DD-025 / Step 1.8A CategorySchema vs first-class Seller commercial units;
   - DD-024 / Step 1.8B Tariff extension;
   - DD-026 / Step 1.8C period-price semantics;
   - DD-027 / Step 1.8C multi-date availability/hold compatibility;
   - DD-028 taxonomy ownership where still deferred;
   - DD-029 multi-currency Marketplace display.

16. **Step 1.8A — Service Template / Seller Commercial Structure Foundation**
17. **Step 1.8A — STRICT REVIEW**
18. **Step 1.8B — Tariff / Commercial Variant Foundation**
19. **Step 1.8B — STRICT REVIEW**
20. **Step 1.8C — Period Pricing & Period Availability Foundation**
21. **Step 1.8C — STRICT REVIEW**
22. **Step 1.8D — Commercial Restrictions / Overrides Foundation**
23. **Step 1.8D — STRICT REVIEW**

However, before freezing this exact return point, verify dependencies against the current Roadmap. If a hard dependency requires one of 1.8A–D earlier, document it explicitly rather than silently reordering.

# 6. STEP 2.8A DEPENDENCY

Preserve the approved Service Templates Strict Review result:

- date-based period pricing/availability does NOT require Step 2.8A;
- time-slot / exact departure / timezone-aware availability DOES depend on the Step 2.8A time model.

If Step 1.8C implementation reaches time-slot functionality before 2.8A is completed, either:
- limit 1.8C scope to date-based semantics; or
- execute the required 2.8A prerequisite first.

This must be visible in the execution sequence as a conditional gate.

# 7. RETURN TO MAIN PHASE 2 SEQUENCE

After the inserted Reverse Marketplace and Commercial Modeling blocks are completed, the Roadmap must name the exact return point to the original main Phase 2 sequence.

Do NOT assume it is Step 2.6 without checking all current dependencies.

Review the current Roadmap and state explicitly:

`RETURN TO ORIGINAL SEQUENCE AT: Step X.Y`

with rationale.

The execution sequence must never leave the return point implicit.

# 8. STRICT REVIEW PAIRING RULE

Add canonical project rule:

> Every implementation Step requires a separate STRICT REVIEW before the next implementation Step may start, unless the Roadmap explicitly marks the Step as documentation-only and defines another approval mechanism.

Sequence is therefore:

`Implementation`
→ `Strict Review`
→ `APPROVED`
→ next item.

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW` is NOT sufficient to advance.

`CHANGES REQUIRED` / `ARCHITECTURE DECISION REQUIRED` blocks progression.

# 9. AMENDMENT RULE

Whenever a future Roadmap Amendment changes dependencies or execution order, it MUST update the `CURRENT CANONICAL EXECUTION SEQUENCE` section in the same amendment.

An amendment is incomplete if it:
- adds new Steps;
- changes prerequisites;
- creates an ADR gate;
- changes the return point;

but does not update execution sequence.

# 10. STATUS RULE

Use explicit operational statuses such as:

- ✅ APPROVED / DONE
- 🔍 STRICT REVIEW IN PROGRESS / PENDING
- ▶ NEXT
- ⏳ PLANNED
- ⛔ BLOCKED BY PREREQUISITE
- ⚠ ARCHITECTURE DECISION REQUIRED

Do not mark a Step DONE merely because implementation finished; DONE requires its required Strict Review approval.

# 11. SINGLE SOURCE OF TRUTH RULE

Add:

> If chat history, an old prompt, agent report, numeric Step ordering, or memory conflicts with `CURRENT CANONICAL EXECUTION SEQUENCE`, the canonical Roadmap wins.

Before generating every future implementation prompt, the agent must read this section.

Before generating every future Strict Review prompt, the agent must verify the target is the current active sequence item.

# 12. COMPLETED STEPS / LOGICAL NUMBERING

Do not renumber existing Steps.

Do not move 2.2A–2.2F numerically.

Do not move 1.8A–1.8D numerically.

The execution sequence section exists specifically so logical architecture placement can differ from implementation chronology.

# 13. REVERSE MARKETPLACE ADR PREREQUISITE

Make explicit:

`Reverse Marketplace ADR APPROVED`
is a hard prerequisite for beginning Step 2.2A.

Not merely before 2.2B.

No `reverse.*` schema/module/entity implementation may begin before ADR approval.

# 14. CURRENT NEXT-STEP RULE

At the moment this amendment is written:

If 2.5B Strict Review is still pending:
- CURRENT = `Step 2.5B STRICT REVIEW`
- NEXT = `Reverse Marketplace ADR`

If 2.5B Strict Review has already been approved by the time this amendment runs:
- CURRENT/NEXT must advance accordingly based on evidence.

Do not fabricate approval status.

# 15. DO NOT IMPLEMENT

This task must not:
- implement Step 2.5B fixes unless documentation-only sequence correction requires noting them;
- create Reverse Marketplace ADR;
- implement reverse.*;
- implement 2.2A–F;
- implement 1.8A–D;
- start Step 2.6;
- modify schema/migrations/backend/frontend/tests.

Only Roadmap/dependency documentation is allowed.

# 16. REQUIRED CONSISTENCY REVIEW

After updating sequence, cross-check against:
- current Step statuses;
- Reverse Marketplace Dependency Analysis;
- Service Templates Dependency Analysis;
- Deferred Decisions DD-024–029;
- Step 2.8A dependency;
- Step 2.6 and later Phase 2 prerequisites;
- all current ADR gates.

No sequence item may violate an explicit prerequisite elsewhere in the Roadmap.

# 17. REQUIRED FINAL REPORT

Return:

# CANONICAL ROADMAP EXECUTION SEQUENCE AMENDMENT — ОТЧЁТ

## 1. Verdict
`CANONICAL ROADMAP EXECUTION SEQUENCE AMENDMENT COMPLETED — WAITING FOR STRICT REVIEW`

## 2. Baseline
## 3. Current approved boundary
## 4. Current active item
## 5. Exact NEXT item
## 6. Full authoritative execution sequence
## 7. Reverse Marketplace ADR gate
## 8. Reverse Marketplace sequence
## 9. Service Templates return point
## 10. Step 2.8A conditional dependency
## 11. Return to original Phase 2 sequence
## 12. Strict Review pairing rule
## 13. Amendment-update rule
## 14. Status semantics
## 15. Contradictions found/fixed
## 16. Deferred/conditional sequence items
## 17. Out-of-scope confirmation
## 18. Exact files changed

# 18. STOP CONDITION

After updating the canonical Roadmap and reporting:

STOP.

Do not create the Reverse Marketplace ADR.
Do not start the next implementation step.
Wait for a separate Strict Review of this execution-sequence amendment.
