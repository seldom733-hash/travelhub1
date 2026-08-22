# TRAVELHUB — ROADMAP STRUCTURAL-DEBT OWNERSHIP RECONCILIATION
## Step 2.17C — Sales Domain Structural Decomposition + Step 2.9 Status Repair

**Mode:** repository-first / documentation-only  
**Purpose:** close two Roadmap integrity gaps discovered by the Phase 2 NEXT executable-step reconciliation before starting Step 2.17.  
**Production implementation:** FORBIDDEN.  
**Canonical NEXT after this pass:** Step 2.17 remains NEXT unless repository evidence proves otherwise.

---

# 1. Objective

Perform a narrow documentation-only reconciliation for two independently discovered Roadmap gaps:

1. `sales.service.ts` structural/god-service debt currently has no explicit Roadmap owner.
2. Step 2.9 has a stale/inconsistent status presentation in the Roadmap header/primary entry despite committed approval evidence elsewhere.

The intended structural-debt owner to evaluate and, if repository evidence supports the gap, add is:

> **Step 2.17C — Sales Domain Structural Decomposition**

This pass MUST NOT refactor `sales.service.ts`.

This pass MUST NOT start Step 2.17.

---

# 2. Repository-first rule

Do not trust this prompt blindly.

Inspect actual repository state at current `HEAD`, including at minimum:

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- `backend/src/**/sales.service.ts` or actual canonical Sales service path;
- Sales module/service/controller structure;
- relevant Sales architecture docs;
- Step 2.9 implementation/strict-review reports;
- Step 2.9 Roadmap entries/status references;
- `PHASE_2_NEXT_EXECUTABLE_STEP_RECONCILIATION_REPORT.md`;
- existing Step 2.17 / 2.17A / 2.17B scope;
- artifact-integrity checker;
- git history where needed to verify persisted status/evidence.

If the repository disproves either reported gap, do not force the proposed change. Report the actual state instead.

---

# 3. Verify the Sales structural-debt finding

Determine the actual current Sales service file size and responsibilities.

Do NOT hardcode the previously observed line count.

Record the actual value from the current repository.

Inspect whether the service combines multiple distinct responsibilities such as, where actually present:

- quote lifecycle;
- checkout lifecycle;
- sale lifecycle;
- order orchestration;
- pricing/freeze behavior;
- idempotency;
- event production/consumption;
- validation;
- cross-domain coordination;
- persistence transactions;
- lifecycle transitions;
- read/query behavior;
- other materially distinct responsibilities.

The purpose is NOT to design the final decomposition now.

The purpose is to establish whether a structural maintainability/refactoring debt genuinely exists and whether it currently lacks Roadmap ownership.

---

# 4. Ownership classification

Search the full canonical Roadmap for explicit ownership of:

```text
sales.service.ts
Sales service decomposition
Sales domain decomposition
god service
structural decomposition
service refactoring
maintainability refactor
```

Classify the debt as exactly one of:

```text
EXPLICITLY OWNED
PARTIALLY OWNED
NOT OWNED
SUPERSEDED
```

If `EXPLICITLY OWNED` by another step, do not create 2.17C.

If `PARTIALLY OWNED`, explain whether a dedicated step is still justified.

If `NOT OWNED`, add Step 2.17C as specified below.

---

# 5. Why this must NOT be folded into Step 2.17

If Step 2.17 is currently a platform-hardening gate covering concerns such as CI, durable retry, outbox claiming, schema-version decision, legacy isolation, auth/SoD/security and visibility, preserve that scope.

Do NOT silently expand Step 2.17 into a major Sales-domain refactor.

The reason must be documented:

- Step 2.17 is already a high-risk platform-hardening gate;
- `sales.service.ts` decomposition can alter domain transaction boundaries and event behavior if done carelessly;
- combining it with platform hardening increases regression surface;
- structural decomposition requires its own repository-first design, implementation and strict review;
- behavior preservation must be the hard invariant.

---

# 6. Add Step 2.17C if and only if gap is confirmed

Suggested canonical entry:

## Step 2.17C — Sales Domain Structural Decomposition

**Status:**

`⏳ PLANNED — STRUCTURAL DEBT / BEHAVIOR-PRESERVING REFACTOR`

**Purpose:**

Decompose the oversized Sales domain service into cohesive internal components/services without changing externally observable business behavior, domain ownership, transaction semantics, idempotency guarantees, event contracts, frozen commercial snapshots, RBAC, API contracts or persisted data semantics.

This is a maintainability and structural-risk step, NOT a feature step.

---

# 7. Step 2.17C hard invariants

The future implementation MUST preserve:

```text
API behavior
HTTP contracts
RBAC
domain ownership
database schema unless separately justified
transaction atomicity
idempotency
outbox/inbox semantics
event names/payload contracts
causation/correlation behavior
Quote/Checkout/Sale/Order freeze semantics
money calculations
Commission boundaries
Payment boundaries
Booking boundaries
error/status semantics
concurrency behavior
```

A refactor that changes business behavior is NOT acceptable as an incidental consequence of decomposition.

Any required behavioral change discovered during the work must be split into a separately approved bugfix/architecture decision.

---

# 8. Step 2.17C future design pass

Before implementation, Step 2.17C MUST begin with a dedicated repository-first decomposition/design pass.

That pass should identify:

- current public methods;
- internal call graph;
- transaction boundaries;
- Prisma writes;
- cross-domain reads/writes;
- event publication;
- event consumers;
- idempotency boundaries;
- concurrency-sensitive sections;
- shared validation;
- lifecycle state machines;
- frozen snapshot creation/propagation;
- circular dependencies;
- test coverage by responsibility.

Only then may it propose component boundaries.

Do not preselect class names merely to satisfy this prompt.

---

# 9. Candidate decomposition principle

The future design MAY discover cohesive units around concepts such as:

```text
Quote
Checkout
Sale
Order orchestration
commercial freeze/snapshot
lifecycle transitions
read/query operations
event orchestration
```

These are examples only.

Do NOT write them into the Roadmap as mandatory classes unless the actual code analysis supports them.

The target is cohesion and explicit ownership, not arbitrary file splitting.

---

# 10. No line-count-only success criterion

The future step must NOT be considered complete merely because `sales.service.ts` becomes shorter.

Success criteria must include:

- responsibilities have explicit owners;
- dependency direction is understandable;
- no duplicate domain authority;
- no circular service graph;
- no hidden cross-domain writer;
- transactions remain correct;
- tests prove behavior preservation;
- event/idempotency/concurrency contracts remain intact.

Line count may be reported as a metric, not as the acceptance criterion.

---

# 11. Regression requirements for future Step 2.17C

Record that the implementation and strict review will require, at minimum:

- Sales unit tests;
- relevant Quote/Checkout/Sale/Order e2e;
- event/outbox/inbox regressions;
- idempotency regressions;
- concurrency-sensitive regressions;
- Booking/Payment/Commission boundary regressions where affected;
- full serial backend e2e;
- frontend regression if public API behavior is touched;
- migration/drift verification even when no migration is expected.

Use actual repository test commands when the future prompt is created.

Do not invent current test counts.

---

# 12. Placement/dependency of Step 2.17C

Do not assume numeric order alone.

Determine the safest dependency relationship from repository evidence.

Default intended relationship to evaluate:

```text
2.17 Platform Hardening
   ↓
2.17C Sales Domain Structural Decomposition
   ↓
later Phase-exit verification
```

Reasoning to test:

- platform hardening should first stabilize CI/event retry/multi-instance/security guardrails;
- then the large Sales refactor can execute under stronger automated protections;
- Phase exit should not leave known high-risk structural debt unowned.

However, if the actual Roadmap makes another ordering more correct, document that instead.

Do NOT make 2.17C depend on PSP selection unless actual Sales code/dependency evidence requires it.

---

# 13. Relationship with 2.17A / 2.17B

Preserve separation:

```text
2.17A = Backup & DR Readiness
2.17B = Load & Performance Qualification
2.17C = Sales Domain Structural Decomposition
```

Do not move Backup/DR or performance concerns into 2.17C.

Do not move Sales decomposition into 2.17A/2.17B.

---

# 14. Step 2.9 stale-status verification

Independently verify the reported Step 2.9 inconsistency.

Inspect:

- primary/header Step 2.9 entry;
- phase-status tables/summary;
- historical Roadmap log entries;
- implementation report;
- strict-review report;
- retrospective evidence reconstruction if applicable;
- commits containing the approval evidence.

Determine the actual canonical status.

Do NOT infer approval merely from the current user's summary.

---

# 15. Step 2.9 repair rule

If repository evidence proves that Step 2.9 is approved but one primary/header Roadmap location is stale/missing the status, make the smallest possible repair.

The repair must:

- synchronize the stale status with already-persisted canonical evidence;
- not create a new verdict;
- not rewrite history;
- not fabricate dates/test counts;
- preserve retrospective-report labels where applicable;
- preserve provenance distinctions.

If the inconsistency is more complex than a stale presentation line, STOP and report it instead of rewriting.

---

# 16. Canonical NEXT must remain Step 2.17

This pass exists before Step 2.17 implementation.

Unless repository evidence reveals a new HARD blocker, preserve:

```text
CANONICAL NEXT = Step 2.17 — Phase 2 Hardening
```

Adding Step 2.17C MUST NOT accidentally replace Step 2.17 as immediate NEXT.

Expected high-level sequence:

```text
NOW:
Roadmap reconciliation only

NEXT:
2.17 implementation
→ 2.17 strict review

THEN:
2.17C according to the dependency/order established by this reconciliation
and other independent Phase gates as Roadmap requires
```

Do not start any implementation during this pass.

---

# 17. Payment branch remains untouched

Do not alter:

```text
2.12B BLOCKED
ADR-0015 BLOCKED
2.12I DEFERRED
2.12C NOT STARTED
```

unless repository evidence shows the statuses have legitimately changed since the prior reconciliation.

Do not select a PSP.

Do not change split/payout architecture.

---

# 18. Production-code HARD STOP

Forbidden changes:

```text
backend/src
frontend
Prisma schema
migrations
CI workflow implementation
runtime configuration
tests
package dependencies
legacy runtime
Sales service code
```

This is documentation-only.

Expected production/runtime diff:

```text
0
```

---

# 19. Required Roadmap edits

If both findings are confirmed, make only the minimal necessary changes:

1. add Step 2.17C with explicit structural-debt ownership and future acceptance boundaries;
2. repair the stale Step 2.9 status presentation;
3. add minimal dependency/NEXT metadata needed to show that Step 2.17 remains immediate NEXT and 2.17C is future work.

Do not mass-reformat the Roadmap.

Do not renumber existing steps.

---

# 20. Required report

Create:

```text
docs/prompts/TRAVELHUB_STEP_2.17C_SALES_STRUCTURAL_DEBT_OWNERSHIP_AND_STEP_2.9_STATUS_RECONCILIATION_REPORT.md
```

The report must contain at least:

1. repository baseline;
2. actual Sales service path and current line count;
3. responsibility evidence;
4. Roadmap ownership search;
5. ownership classification;
6. rationale for separate 2.17C;
7. exact Step 2.17C Roadmap entry;
8. future invariants;
9. future design requirement;
10. dependency placement;
11. relationship to 2.17/2.17A/2.17B;
12. Step 2.9 evidence;
13. exact Step 2.9 repair;
14. canonical NEXT verification;
15. payment-branch negative checks;
16. production-code negative checks;
17. artifact-integrity result;
18. repository evidence footer.

---

# 21. Artifact-integrity checker

Run the repository's Roadmap artifact-integrity checker and checker regression suite.

Expected final condition:

```text
WARN = 0
FAIL = 0
```

Report actual PASS count.

If adding 2.17C exposes a checker limitation or genuine baseline issue, do not suppress it.

---

# 22. Git discipline

Before editing:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse @{upstream}
```

Preserve unrelated untracked prompts/files.

Never use:

```bash
git add .
git add -A
```

Stage only the explicit files from this pass.

Expected staged scope if both findings are confirmed:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
docs/prompts/TRAVELHUB_STEP_2.17C_SALES_STRUCTURAL_DEBT_OWNERSHIP_AND_STEP_2.9_STATUS_RECONCILIATION_REPORT.md
```

If another documentation artifact genuinely requires amendment, justify it in the report before staging.

Review:

```bash
git diff --check
git diff --cached --stat
git diff --cached
```

---

# 23. Commit and push

After all checks pass:

```bash
git commit -m "docs: assign Sales structural debt and reconcile Step 2.9 status"
git push
```

If the repository uses the established two-commit provenance/footer pattern, follow that actual convention.

After push:

```bash
git rev-parse HEAD
git rev-parse @{upstream}
git status --short
```

Do not claim `PUSHED` unless upstream SHA proves it.

---

# 24. Repository evidence footer

The report MUST include the established provenance footer, at minimum:

```text
REPOSITORY EVIDENCE

branch:
reviewed_base_sha:
roadmap_before_sha:
docs_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
artifact_integrity:
persistence_status:
release_status:
```

If worktree remains dirty solely because of unrelated pre-existing untracked prompts, state that explicitly.

---

# 25. Release

Expected:

```text
RELEASE: NOT APPLICABLE — DOCUMENTATION / ROADMAP RECONCILIATION
```

No tag, deployment or production release.

---

# 26. Required final verdict

If both gaps are confirmed and repaired, use a verdict equivalent to:

```text
TRAVELHUB SALES STRUCTURAL-DEBT OWNERSHIP & STEP 2.9 STATUS RECONCILIATION COMPLETED

Sales structural debt:
- service path: <actual>
- current size: <actual lines>
- ownership before reconciliation: NOT OWNED
- Step 2.17C added: YES
- status: PLANNED — STRUCTURAL DEBT / BEHAVIOR-PRESERVING REFACTOR
- implementation: NOT STARTED
- folded into Step 2.17: NO

Step 2.17C:
- behavior preservation: HARD INVARIANT
- decomposition design: REQUIRED BEFORE IMPLEMENTATION
- line-count-only completion: FORBIDDEN
- PSP dependency: <actual>
- placement/dependency: <actual>

Step 2.9:
- canonical evidence status: <actual>
- stale Roadmap presentation confirmed: YES/NO
- repair: <actual>
- historical verdict changed: NO

Canonical sequencing:
- immediate NEXT: Step 2.17 — Phase 2 Hardening
- Step 2.17 started: NO
- Step 2.17C started: NO

Payment branch:
- 2.12B: unchanged
- ADR-0015: unchanged
- 2.12I: unchanged
- 2.12C: unchanged

Negative checks:
- backend/src: 0
- frontend: 0
- schema/migrations: 0
- CI/runtime: 0
- Sales production code: 0
- tests: 0

Artifact integrity:
- PASS: <actual>
- WARN: 0
- FAIL: 0

Persistence:
- branch: <actual>
- docs commit: <sha>
- final HEAD: <sha>
- upstream: <sha>
- push_status: PUSHED

RELEASE: NOT APPLICABLE

NEXT:
PHASE 2 — STEP 2.17 — PLATFORM HARDENING — IMPLEMENTATION
through its existing dedicated implementation prompt.
```

If either gap is not confirmed, adapt the verdict to repository truth and do not fabricate the corresponding repair.

---

# 27. HARD STOP

After documentation reconciliation, checks, commit and push:

**STOP.**

Do NOT:

- refactor `sales.service.ts`;
- create decomposition services/classes;
- modify Sales runtime;
- start Step 2.17;
- start Step 2.17C;
- start Step 2.17A/2.17B;
- start Step 2.18;
- start blocked payment work.

The next implementation pass remains a separate prompt.
