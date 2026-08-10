# CANONICAL ROADMAP EXECUTION SEQUENCE AMENDMENT
## STRICT REVIEW PROMPT

**Project:** TravelHub  
**Artifact under review:** `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`  
**Review target:** `CURRENT CANONICAL EXECUTION SEQUENCE` amendment  
**Mode:** STRICT REVIEW / DOCUMENTATION REVIEW FIXES ONLY

# 1. MISSION

Perform an independent STRICT REVIEW of the newly added canonical execution-sequence amendment.

The purpose is to prove that the Roadmap now acts as a true single source of truth for **what must be executed next**, while preserving the distinction between:

- logical Step numbering;
- architectural dependency order;
- actual implementation chronology.

Do not approve from the amendment report alone. Read the actual current Roadmap and all relevant dependency/status sections.

# 2. PRIMARY APPROVAL QUESTION

Can a new implementation agent, with no chat history and no memory of previous discussions, read only the canonical Roadmap and determine unambiguously:

1. what has been approved;
2. what is active now;
3. what is NEXT;
4. which prerequisite blocks each planned item;
5. when Reverse Marketplace is implemented;
6. when Service Templates / Period Pricing are implemented;
7. when execution returns to the original Phase 2 sequence;
8. that every implementation Step requires separate Strict Review approval?

If any of these cannot be determined uniquely, the amendment is not yet sufficient.

# 3. REVIEW BOUNDARY

Allowed:
- inspect Roadmap and supporting planning/docs;
- correct documentation contradictions;
- correct sequence/status/return-point wording;
- make minimal documentation-only review fixes.

Forbidden:
- backend/frontend/schema/migrations/tests changes;
- Reverse Marketplace ADR creation;
- reverse.* implementation;
- 2.2A–2.2F implementation;
- 1.8A–1.8D implementation;
- Step 2.6 implementation;
- unrelated Roadmap redesign.

# 4. BASELINE VERIFICATION

Report:
- branch and HEAD;
- dirty/untracked state;
- exact Roadmap diff attributable to this amendment;
- existing uncommitted 2.5B changes separately;
- confirm no production code was changed by this amendment.

Do not overwrite user prompt files.

# 5. VERIFY CURRENT APPROVED BOUNDARY

Code/report history is not enough: inspect Roadmap markers.

Verify the Roadmap truthfully represents:

- Step 2.5 — approved/done;
- Step 2.5A — approved/done;
- Step 2.5B — STRICT REVIEW APPROVED WITH REVIEW FIXES;
- Reverse Marketplace implementation — not started;
- Service Templates amendment — planning approved, implementation not started.

Important:
If `DONE` semantics now require Strict Review approval, check every nearby DONE marker for consistency.

Do not silently redefine old statuses in a way that makes existing Roadmap internally false.

# 6. VERIFY EXACT CURRENT / NEXT

At review time, expected operational state is:

- current amendment = under STRICT REVIEW;
- after approval, NEXT = Reverse Marketplace ADR.

Check whether the Roadmap itself makes this clear.

The Roadmap must not simultaneously imply:
- Step 2.6 is NEXT;
- 2.2A can begin before ADR;
- 1.8A is NEXT;
- Reverse Marketplace ADR has already been approved.

# 7. REVERSE MARKETPLACE ADR GATE

Verify an explicit hard gate:

`Reverse Marketplace ADR APPROVED`
→ prerequisite for Step 2.2A.

The ADR must define/reconcile at least:
- `reverse.*` bounded context;
- Seller Commercial Capabilities ownership;
- BuyerRequest ownership;
- Matching/Distribution ownership;
- Seller Proposal ownership;
- Communication relationship;
- Sales convergence relationship;
- no parallel Order/Booking/Checkout/Payment pipeline.

No reverse.* schema/module/entity implementation may begin before ADR approval.

# 8. VERIFY 2.2A–2.2F EXECUTION ORDER

Confirm exact operational sequence:

Reverse Marketplace ADR
→ ADR Strict Review
→ 2.2A
→ 2.2A Strict Review
→ 2.2B
→ review
→ 2.2C
→ review
→ 2.2D
→ review
→ 2.2E
→ review
→ 2.2F
→ review.

Check that logical numbering elsewhere does not contradict this chronology.

# 9. CRITICAL DEPENDENCY REVIEW — SERVICE TEMPLATES

The amendment currently places 1.8A–1.8D after 2.2A–2.2F.

Independently verify this against:
- Reverse Marketplace dependency analysis;
- Service Templates dependency analysis;
- DD-024–DD-029;
- Seller Commercial Capabilities requirements;
- matching requirements.

Critical question:

Can 2.2A–2.2F be implemented correctly without first implementing normalized CategorySchema/service-unit/tariff/period structures?

The planning report previously said capabilities are NOT inventory and matching must not depend on live Product inventory. Verify that this is sufficient.

If 2.2A or matching requires canonical normalized service attributes that do not yet exist, sequence may need a prerequisite or limited-scope rule.

Do not approve merely because earlier amendment text said there was no hard dependency.

# 10. DD-024–DD-029 GATES

Verify each referenced deferred decision actually exists and is described consistently.

Check mapping:

- DD-024 — Tariff vs Rate Plan;
- DD-025 — Seller unit identity / CategorySchema nesting;
- DD-026 — period temporal semantics / price basis / occupancy / overlap / precedence;
- DD-027 — availability granularity / multi-date holds;
- DD-028 — taxonomy ownership;
- DD-029 — multi-currency Marketplace display.

If the actual Deferred Decisions Map differs, correct the Roadmap references.

Do not invent resolved status.

# 11. SERVICE TEMPLATES RETURN POINT

Verify sequence after 2.2F review:

decision gates
→ 1.8A
→ review
→ 1.8B
→ review
→ 1.8C
→ review
→ 1.8D
→ review.

Check whether any decision gate requires a formal ADR rather than an ordinary resolution.

If yes, sequence must name that ADR/review explicitly.

# 12. STEP 2.8A CONDITIONAL DEPENDENCY

Verify the exact approved rule:

- date-only period pricing/availability does not require Step 2.8A;
- time-slot / exact-departure / timezone-aware semantics require the canonical time model from 2.8A.

Check whether this creates a circular or awkward sequence:

1.8C occurs before return to 2.6;
2.8A occurs later in original Phase 2.

The Roadmap must specify one deterministic behavior:
- either 1.8C is explicitly limited to date-based scope at this point;
- or execution jumps to prerequisite 2.8A before the time-aware portion.

Do not leave this as vague agent discretion.

# 13. CRITICAL REVIEW — RETURN TO STEP 2.6

The amendment declares:

`RETURN TO ORIGINAL SEQUENCE AT: Step 2.6`.

Independently verify this is correct.

Inspect current dependencies for:
- 2.6;
- 2.7;
- 2.8;
- 2.8A;
- 2.9 onward;
- Reverse Marketplace conversion;
- Service Templates commercial modeling.

Questions:
- Does 2.6 depend only on 2.5/2.5A/2.5B?
- Could removing bootstrap before some newly inserted flow requires it create a problem?
- Does 2.2F canonical Sales conversion already use Sale→OrderRequested and therefore not require bootstrap?
- Do 1.8A–D require any Order bootstrap path?
- Is 2.6 genuinely the earliest correct return point?

If yes, retain it and explain why.
If not, fix the return point.

# 14. STRICT REVIEW PAIRING RULE

Verify canonical rule is operationally precise:

`Implementation → separate Strict Review → APPROVED → next implementation item`.

Check documentation-only amendments and ADRs:
- ADR creation must have separate ADR Strict Review;
- documentation amendments must have their defined review gate;
- `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW` cannot advance sequence;
- `CHANGES REQUIRED` blocks;
- `ARCHITECTURE DECISION REQUIRED` blocks affected dependency.

# 15. STATUS SEMANTICS

Review status vocabulary.

Required:
- status must distinguish implementation complete from review-approved;
- `DONE` must not ambiguously mean code written but unreviewed;
- active review must be representable;
- NEXT must be unique.

If necessary, define two-dimensional status or wording rather than retroactively making old DONE markers false.

# 16. SINGLE SOURCE OF TRUTH RULE

Verify Roadmap explicitly says that conflicts are resolved in this priority:

`CURRENT CANONICAL EXECUTION SEQUENCE`
over:
- chat history;
- old prompts;
- memory;
- numeric Step order;
- stale implementation reports.

But also ensure this section cannot override architectural invariants silently.

Required nuance:

If execution sequence conflicts with an explicit canonical dependency/invariant elsewhere in the same Roadmap, that is a Roadmap contradiction requiring correction — not permission to ignore the dependency.

Add this if missing.

# 17. FUTURE AMENDMENT RULE

Verify:

Any future amendment that:
- adds Steps;
- changes dependencies;
- adds/removes ADR gates;
- changes chronology;
- changes return point;

MUST update `CURRENT CANONICAL EXECUTION SEQUENCE` in the same amendment.

Also require Strict Review to verify that update.

# 18. PROMPT-GENERATION RULE

Add/verify canonical operational rule:

Before generating or executing any future implementation prompt:
1. read current canonical Roadmap;
2. read `CURRENT CANONICAL EXECUTION SEQUENCE`;
3. verify prerequisite approvals;
4. verify target is the unique NEXT item.

Before generating Strict Review:
- verify it corresponds to the active just-completed implementation/documentation item.

This prevents old prompts from being executed out of order.

# 19. NO PARALLEL EXECUTION AMBIGUITY

Determine whether Roadmap permits multiple independent Steps in parallel.

If not intended, state explicitly:
- only the unique NEXT item may begin.

If parallelism may later be allowed:
- require Roadmap to explicitly mark a set as `PARALLEL-ALLOWED`.

Do not leave this implicit.

For current sequence, Reverse Marketplace ADR must be the sole NEXT item after this amendment approval.

# 20. LOGICAL NUMBERING

Verify:
- 2.2A–2.2F remain logically located after 2.2;
- 1.8A–1.8D remain logically located after 1.8;
- no renumbering;
- chronology section clearly explains why implementation can return to earlier-numbered Steps.

# 21. ROADMAP SELF-CONTAINMENT

A future agent should not need:
- this prompt;
- chat memory;
- implementation reports;
- hidden assumptions

to determine execution order.

All necessary chronology/gates must be present in Roadmap itself.

# 22. REQUIRED REVIEW TEST — MANUAL WALKTHROUGH

Perform a documentation walkthrough as if you were a fresh agent.

Starting only from Roadmap, answer:

1. What is the currently approved boundary?
2. What is the unique NEXT item?
3. What must happen after that?
4. When can 2.2A start?
5. When can 1.8A start?
6. What happens if 1.8C needs time-slot semantics?
7. When does Step 2.6 start?
8. Can an old 2.6 prompt be run now?
9. Can 2.2B begin if 2.2A implementation is done but its review is pending?
10. What must a future amendment update?

All ten answers must be derivable directly and uniquely.

Include answers in the review report.

# 23. DOCUMENTATION REGRESSION

Search Roadmap for stale statements such as:
- 2.5B not implemented;
- Step 2.6 is next;
- Reverse Marketplace ADR only prerequisite before 2.2B;
- 2.2A–F may happen “later” without sequence;
- Service Templates position inconsistent with execution section;
- old return-point language.

Fix contradictions only when supported by current approved planning.

# 24. APPROVAL GATES

Approve only if:

1. current state is truthful;
2. NEXT is unique;
3. Reverse Marketplace ADR is hard prerequisite before 2.2A;
4. 2.2A–F order is explicit;
5. Service Templates placement is dependency-safe;
6. DD gates are correct;
7. 2.8A conditional is deterministic;
8. return to 2.6 is proven;
9. every implementation requires review approval;
10. future amendments must update sequence;
11. internal Roadmap contradictions are resolved;
12. a fresh agent can determine the next action without chat history.

# 25. FINAL REPORT FORMAT

Return exactly:

# CANONICAL ROADMAP EXECUTION SEQUENCE AMENDMENT — STRICT REVIEW — ОТЧЁТ

## 1. Verdict
One of:
`CANONICAL ROADMAP EXECUTION SEQUENCE STRICT REVIEW COMPLETED — APPROVED`
`CANONICAL ROADMAP EXECUTION SEQUENCE STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
`CANONICAL ROADMAP EXECUTION SEQUENCE STRICT REVIEW COMPLETED — CHANGES REQUIRED`
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Current approved boundary
## 5. Current active state
## 6. Unique NEXT item
## 7. Reverse Marketplace ADR gate
## 8. 2.2A–2.2F sequence
## 9. Service Templates dependency review
## 10. DD-024–DD-029 gates
## 11. 1.8A–1.8D sequence
## 12. Step 2.8A conditional gate
## 13. Return-to-2.6 review
## 14. Strict Review pairing rule
## 15. Status semantics
## 16. Single-source-of-truth rule
## 17. Future amendment rule
## 18. Prompt-generation rule
## 19. Parallel execution rule
## 20. Logical numbering integrity
## 21. Roadmap self-containment
## 22. Fresh-agent 10-question walkthrough
## 23. Contradictions found
## 24. Review fixes
## 25. Documentation regression
## 26. Architecture decision status
## 27. Out-of-scope confirmation
## 28. Exact files changed during review

Final line must repeat the verdict.

# 26. STOP CONDITION

After review and permitted documentation-only fixes:

STOP.

Do NOT create Reverse Marketplace ADR in this pass.
Do NOT implement reverse.*.
Do NOT start 2.2A.
Do NOT start 1.8A.
Do NOT start Step 2.6.

Wait for explicit next instruction.

If APPROVED, the next separate artifact to create will be the **Reverse Marketplace ADR prompt**, because the canonical execution sequence will then be authoritative.
