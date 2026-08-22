# TRAVELHUB — PHASE 2 NEXT EXECUTABLE STEP RECONCILIATION

**Mode:** repository-first / roadmap-first / documentation-only  
**Purpose:** determine the next actually executable Phase 2 step while the PSP-dependent branch is externally blocked.  
**Production implementation in this pass:** FORBIDDEN.

---

# 1. Objective

Determine, from the **current canonical repository state**, which Phase 2 step should be executed next.

Do NOT assume that the numerically next Roadmap step is executable.

The reconciliation must account for:

- completed + strict-reviewed steps;
- BLOCKED steps;
- planned/deferred steps;
- explicit and implicit dependency edges;
- architecture ADR prerequisites;
- external commercial dependencies;
- independent workstreams;
- platform-hardening gates;
- downstream steps that would consume unfinished contracts.

The result must identify **one canonical NEXT executable step**, or conclude that no Phase 2 step is safely executable.

---

# 2. Repository is authority

Do not trust this prompt, prior chat summaries, implementation reports, or Roadmap statuses without repository evidence.

Inspect at minimum:

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `docs/adr/`
- relevant `docs/architecture/`
- relevant strict-review reports under `docs/prompts/`
- current Prisma schema/migrations where dependency verification requires them;
- actual backend/frontend artifacts where a claimed prerequisite must be verified;
- repository artifact-integrity tooling;
- git history/status where persistence matters.

Use the repository state at current `HEAD` as the primary authority.

If Roadmap and repository evidence conflict, STOP that dependency path and report the discrepancy.

---

# 3. Expected payment-branch state to VERIFY, not assume

Verify whether current repository truth is equivalent to:

```text
2.12A — APPROVED
2.12H — APPROVED

2.12B — BLOCKED
reason: PSP / aggregator commercial & technical confirmation

ADR-0015 — PROPOSED / BLOCKED

2.12I — PLANNED / DEFERRED
reason: requires selected PSP/aggregator contract + API/capability evidence

2.12C — NOT STARTED
and must not silently substitute settlement/payout for SPLIT_AT_PAYMENT
```

Also verify the documented dependency relationship among:

```text
2.12B
ADR-0015
2.12I
2.12C
```

If actual state differs, use actual state.

---

# 4. Important rule: a blocked branch does NOT automatically block Phase 2

Determine whether other Phase 2 work can proceed independently.

Do not infer:

```text
2.12B BLOCKED
→ entire Phase 2 BLOCKED
```

unless dependency evidence proves it.

Likewise, do not skip dependencies merely because another step appears independent by title.

---

# 5. Enumerate remaining Phase 2 steps

Build a complete working matrix of every Phase 2 step/substep that is not fully approved/persisted.

For each candidate record:

```text
step
title
roadmap_status
implementation_status
strict_review_status
persistence/evidence status
hard prerequisites
soft prerequisites
external dependency
downstream dependency
can_execute_now
reason
```

Include at least all remaining steps in the relevant range, including 2.12x, 2.13x, 2.14x, 2.15x, 2.16x, 2.17x, 2.18, and any other Phase 2 entries actually present in the Roadmap.

Do not limit the scan to those names if the repository contains more.

---

# 6. Dependency classification

For every unfinished candidate classify dependencies as:

### HARD
Step cannot safely start until dependency is satisfied.

### SOFT
Helpful ordering, but not required for correctness.

### EXTERNAL
Requires provider/business/legal/commercial/human authority outside repository implementation.

### INDEPENDENT
No unresolved predecessor blocks implementation.

### UNKNOWN
Repository evidence is insufficient.

An `UNKNOWN` dependency must not be silently treated as satisfied.

---

# 7. Detect false sequencing

Explicitly test for these failure modes:

1. Numerical Roadmap order mistaken for dependency order.
2. A later step actually required before an earlier-numbered step.
3. A supposedly independent step reads/writes contracts owned by blocked payment work.
4. A hardening step assumes runtime that does not exist yet.
5. A strict-review step is missing after implementation.
6. A step is `APPROVED` in Roadmap but lacks repository evidence.
7. A step is implemented in worktree but not persisted upstream.
8. A step is docs-only planned but mistaken for executable implementation.
9. A deferred ADR decision is silently treated as resolved.
10. A broad Phase gate is used to hide a narrower unresolved prerequisite.

---

# 8. Special review: Step 2.17

Do NOT automatically select Step 2.17 merely because known technical debt exists.

Inspect its actual current Roadmap scope and prerequisites.

Verify whether Step 2.17 currently owns or references the known platform-hardening classes, including where repository evidence supports them:

```text
CI/CD repair / root CI correctness
PostgreSQL multi-schema CI assumptions
durable retry execution
outbox multi-instance claiming / delivery safety
event schemaVersion decision
legacy/ isolation
auth / permission hardening
SoD / security
observability/visibility
repository/process integrity hooks
```

Also verify that previously separated concerns remain assigned to their dedicated steps where applicable, e.g.:

```text
external API idempotency → 2.12H
RLS decision/verification → ADR-0014 / 2.18
Backup & DR → 2.17A
Load & Performance → 2.17B
```

Use actual Roadmap truth.

Then answer:

> Can Step 2.17 be executed now without depending on unfinished PSP runtime or later Phase 2 domain contracts?

If YES, provide evidence.

If NO, identify the exact blocker.

---

# 9. Special review: 2.17A / 2.17B

Inspect whether:

### Step 2.17A — Backup & DR Readiness

can be performed independently of PSP selection.

Determine whether it needs:

- final production infrastructure;
- deployment topology;
- RPO/RTO business authority;
- database/storage inventory;
- restoration test environment.

Do not invent RPO/RTO.

### Step 2.17B — Load & Performance Qualification

determine whether it can run meaningfully now or requires additional runtime such as real PSP/webhook behavior.

Distinguish:

```text
system baseline load testing
vs
PSP/webhook-specific load qualification
```

Do not mark provider-specific performance verified using fake/nonexistent production adapters.

---

# 10. Special review: 2.18

Determine whether Step 2.18 is:

- a Phase exit gate;
- an implementation step;
- a verification/reconciliation step;
- dependent on completion of 2.17/2.17A/2.17B;
- dependent on payment branch closure;
- responsible for ADR-0014/RLS verification.

Do not execute it merely because it appears independent.

---

# 11. Sales service / legacy / CI debt ownership

Verify current Roadmap ownership of previously identified structural debt.

Specifically search for explicit treatment of:

```text
sales.service.ts structural decomposition / god-service debt
legacy/ parallel application or dependency-resolution isolation
broken/root CI pipeline
legacy SQLite assumptions versus canonical PostgreSQL multi-schema
```

For each classify:

```text
EXPLICITLY OWNED
PARTIALLY OWNED
NOT OWNED
SUPERSEDED
```

If an item remains unowned, do NOT silently attach it to a random step.

Report a Roadmap gap and recommend a separate reconciliation.

This pass may amend Roadmap ownership only if the existing Roadmap already clearly intends that ownership and the amendment merely makes it explicit. Otherwise report first; do not invent scope.

---

# 12. Event schema / multi-instance / retry status

Verify repository truth for:

### Event schema versioning

- Is `schemaVersion` canonical?
- Is it present consistently?
- Do consumers enforce it?
- Is the decision still owned by 2.17?

### Multi-instance safety

Inspect enough evidence to determine whether unresolved risks remain around:

- outbox claiming;
- duplicate delivery;
- concurrent workers;
- durable retry;
- failed-event recovery.

Do not confuse request idempotency from 2.12H with system-wide event-delivery safety.

### Durable retry

Verify whether retry code has an actual production caller/scheduler/worker.

If it exists only in tests or dead code, record that fact.

---

# 13. Candidate ranking

After dependency analysis, rank executable candidates using:

1. hard prerequisite satisfaction;
2. independence from PSP decision;
3. risk reduction;
4. amount of downstream work unblocked;
5. likelihood of destructive rework if performed too early;
6. Phase-exit necessity.

Do not use implementation convenience as the primary criterion.

---

# 14. Required decision

Return exactly one of:

### VERDICT A — NEXT EXECUTABLE STEP IDENTIFIED

```text
NEXT = <step>
```

with repository-backed justification.

### VERDICT B — MULTIPLE PARALLEL STEPS ARE SAFE, ONE CANONICAL NEXT SELECTED

List the parallel-safe candidates, but select one canonical NEXT and explain why.

### VERDICT C — NO SAFE PHASE 2 IMPLEMENTATION STEP

Identify blockers and required reconciliation/authority.

Do not start the selected step in this pass.

---

# 15. Roadmap changes

This is primarily an audit/reconciliation pass.

Only change the Roadmap if necessary to record an evidence-backed NEXT/dependency clarification.

Do NOT:

- mark implementation completed;
- mark strict review completed;
- unblock 2.12B;
- accept ADR-0015;
- start 2.12C;
- start 2.12I;
- fabricate a dependency;
- renumber steps;
- rewrite historical statuses.

If no Roadmap modification is necessary, leave it unchanged.

---

# 16. Production-code HARD STOP

Expected:

```text
backend/src changes = 0
frontend changes = 0
Prisma schema changes = 0
migrations = 0
runtime config = 0
CI implementation = 0
tests implementation = 0
```

This pass determines sequencing only.

---

# 17. Required report

Create:

```text
docs/prompts/PHASE_2_NEXT_EXECUTABLE_STEP_RECONCILIATION_REPORT.md
```

The report must contain:

1. baseline repository state;
2. Phase 2 unfinished-step matrix;
3. dependency classification;
4. blocked payment branch;
5. independent branches;
6. Step 2.17 analysis;
7. Step 2.17A analysis;
8. Step 2.17B analysis;
9. Step 2.18 analysis;
10. CI ownership;
11. `legacy/` ownership;
12. `sales.service.ts` structural-debt ownership;
13. event-schema status;
14. multi-instance/outbox status;
15. durable-retry status;
16. candidate ranking;
17. canonical NEXT verdict;
18. negative checks;
19. artifact integrity;
20. repository evidence footer.

Do not fabricate historical test counts.

---

# 18. Artifact-integrity checks

Run the existing Roadmap artifact-integrity checker and its regression tests.

Expected final condition:

```text
WARN = 0
FAIL = 0
```

Use actual PASS counts.

If the audit itself discovers an integrity gap, report it and do not hide it just to preserve a clean baseline.

---

# 19. Git discipline

Before work:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse @{upstream}
```

Do not stage unrelated existing untracked prompts.

Never use:

```bash
git add .
git add -A
```

If only the report is created, stage only that report.

If an evidence-backed Roadmap clarification is necessary, stage only the report + exact Roadmap file.

Review:

```bash
git diff --check
git diff --cached --stat
git diff --cached
```

---

# 20. Commit / push

After successful reconciliation:

```bash
git commit -m "docs: reconcile next executable Phase 2 step"
git push
```

If the repository currently uses a two-commit provenance/footer convention, preserve that convention.

After push verify:

```bash
git rev-parse HEAD
git rev-parse @{upstream}
git status --short
```

Do not claim `PUSHED` unless local HEAD/upstream evidence proves it.

---

# 21. REPOSITORY EVIDENCE footer

Final report must contain:

```text
REPOSITORY EVIDENCE

branch:
reviewed_base_sha:
roadmap_sha_or_state:
report_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
artifact_integrity:
persistence_status:
release_status:
```

Existing unrelated untracked files must be reported but not staged/deleted.

---

# 22. Release

Expected:

```text
RELEASE: NOT APPLICABLE — DOCUMENTATION / SEQUENCING RECONCILIATION
```

No deployment, release or tag.

---

# 23. Required final response format

Use:

```text
TRAVELHUB PHASE 2 NEXT EXECUTABLE STEP RECONCILIATION COMPLETED

Payment branch:
- 2.12A: <actual>
- 2.12H: <actual>
- 2.12B: <actual>
- ADR-0015: <actual>
- 2.12I: <actual>
- 2.12C: <actual>
- payment branch currently executable: YES/NO

Remaining Phase 2:
- unfinished steps inspected: <actual count>
- hard-blocked: <steps>
- external-blocked: <steps>
- executable now: <steps>

Platform risks:
- CI/CD ownership: <actual>
- legacy/ ownership: <actual>
- sales.service.ts debt ownership: <actual>
- event schemaVersion: <actual>
- durable retry: <actual>
- multi-instance outbox safety: <actual>
- Backup/DR: <actual>
- load/performance: <actual>
- RLS verification: <actual>

Decision:
- verdict: A/B/C
- CANONICAL NEXT: <step or NONE>
- reason: <repository-backed concise explanation>

Roadmap:
- modified: YES/NO
- dependency/status changes: <actual>

Negative checks:
- production code: 0
- frontend: 0
- schema/migrations: 0
- runtime/CI implementation: 0

Artifact integrity:
- PASS: <actual>
- WARN: <actual>
- FAIL: <actual>

Persistence:
- branch: <actual>
- report/docs commit: <sha>
- final HEAD: <sha>
- upstream: <sha>
- push_status: <actual>

RELEASE: NOT APPLICABLE

NEXT:
<selected step must be executed only through a separate implementation prompt>
```

---

# 24. HARD STOP

After determining, documenting, committing and pushing the canonical NEXT:

**STOP.**

Do not implement that step.

Do not start:

- 2.12B;
- 2.12C;
- 2.12I;
- 2.17;
- 2.17A;
- 2.17B;
- 2.18;
- or any other candidate

during this pass.

The selected NEXT requires a separate implementation prompt and, where applicable, strict review.
