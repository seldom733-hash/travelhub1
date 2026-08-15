# TRAVELHUB — PHASE 2 NEXT EXECUTABLE STEP RECONCILIATION — REPORT

## Verdict

`TRAVELHUB PHASE 2 NEXT EXECUTABLE STEP RECONCILIATION COMPLETED`

**VERDICT A — NEXT EXECUTABLE STEP IDENTIFIED: Step 2.17 — Phase 2 Hardening.**

The payment branch (2.12B / ADR-0015 / 2.12I / 2.12C) is externally blocked on
PSP/aggregator commercial confirmation; this pass determines the canonical next
step from repository truth only. No implementation performed.

## 1. Baseline repository state

- branch: `master`; HEAD == upstream == `8ddc589` (prior footer commit).
- Roadmap artifact checker: PASS=109, WARN=0, FAIL=0 (pre-change); checker
  regression 13/13.
- migrations: 57/57 up to date.
- Payment branch: 2.12A ✅ APPROVED; 2.12H ✅ APPROVED; 2.12B ⛔ BLOCKED
  (COMMERCIAL CONFIRMATION REQUIRED); ADR-0015 PROPOSED/BLOCKED; 2.12I
  ⏳ PLANNED — DEFERRED; 2.12C NOT STARTED. Verified repository-first, matches
  prompt §3 expectation; no discrepancy.

## 2. Payment-branch dependency relationship (verified)

```text
2.12B BLOCKED (external: PSP commercial/technical confirmation)
   └─ ADR-0015 PROPOSED—BLOCKED (evidence: global PSPs no AZN settlement;
      local CBA-licensed AZ acquiring requires commercial confirmation)
   └─ 2.12I PLANNED—DEFERRED (requires selected PSP contract/API evidence)
   └─ 2.12C NOT STARTED (native SPLIT_AT_PAYMENT; payout API ≠ native split;
      silent settlement/payout substitution forbidden)
```

A blocked payment branch does NOT block the rest of Phase 2 (prompt §4): the
blocked steps are PSP-specific; independent platform work is unaffected.

## 3. Phase 2 unfinished-step matrix

Status key: ✅ approved+persisted · ⛔ blocked · ⏳/🚧 planned/not started.

| step | title | status | can_execute_now | reason |
|---|---|---|---|---|
| 2.12B | Buyer Card / Wallet Payment | ⛔ BLOCKED | NO | EXTERNAL: PSP/commercial confirmation |
| 2.12C | SPLIT_AT_PAYMENT | ⏳ NOT STARTED | NO | HARD: 2.12A+2.12B+policy; native split evidence |
| 2.12D | PLATFORM_COLLECT Mode | ⏳ NOT STARTED | NO | PSP rail + settlement/payout chain |
| 2.12F | Partial Payments / Installments | ⏳ NOT STARTED | NO | Payment runtime present (2.12) but real money capture = PSP |
| 2.12G | PSP / Provider Fees | ⏳ NOT STARTED | NO | Provider fee evidence = 2.12I gate |
| 2.12I | PSP Contract & Money-Flow Reconciliation | ⏳ DEFERRED | NO | EXTERNAL: PSP agreement |
| 2.14 | Invoice / Commission Flow | ⛔ BLOCKED | NO | ARCHITECTURE DECISION REQUIRED (policy authority now partially resolved by 2.12E/2.14E but step remains BLOCKED; invoice part deferred with whole step) |
| 2.14A | Settlement Engine | ⏳ NOT STARTED | NO | requires ProviderFee/Commission/payout chain |
| 2.14B | Partner Payout Foundation | ⏳ NOT STARTED | NO | payout rail (PSP/bank) + settlement |
| 2.14C | Partner Payout Account Foundation | ⏳ NOT STARTED | NO | payout destination depends on 2.14B rail decision |
| 2.14D | Payment/Settlement/Payout Reconciliation | ⏳ NOT STARTED | NO | requires settlement/payout runtime |
| 2.14F | Commission Policy Management UI | 🚧 PLANNED | YES* | backend 2.14E APPROVED (CommissionPolicy CRUD exists); UI step PSP-independent (*parallel candidate) |
| 2.15 | Documents Commercial Flow | ⏳ NOT STARTED | NO | invoice part depends on 2.14 (BLOCKED) |
| 2.16 | Commercial Flow E2E | ⏳ NOT STARTED | NO | depends on Documents (2.15) + full commercial chain |
| 2.16A | Buyer Purchase Timeline | ⏳ NOT STARTED | PARTIAL | real events exist; canonical timeline deferred to 2.16A with 2.16 wrapper |
| 2.16B | Partner Sales Read Model | ⏳ NOT STARTED | PARTIAL | read-only from existing order/booking data; deferred until commercial chain stable |
| 2.16C | Partner Finance Read Model | ⏳ NOT STARTED | NO | needs commission/settlement/payout facts |
| 2.17 | Phase 2 Hardening | ⏳ NOT STARTED | **YES — CANONICAL NEXT** | PSP-independent; all prerequisites platform-level; highest risk reduction; Phase-exit necessity |
| 2.17A | Backup & DR Readiness | 🚧 PLANNED | PARTIAL | independent of PSP; EXTERNAL: RPO/RTO authority + restore env needed |
| 2.17B | Load & Performance Qualification | 🚧 PLANNED | PARTIAL | system baseline possible; PSP webhook burst subset requires 2.12B (PSP) + SLO authority |
| 2.18 | Phase 2 Exit Audit | ⏳ NOT STARTED | NO | depends on 2.17/2.17A/2.17B + payment branch closure |
| 2.18A | Financial Integrity Exit Gate | ⏳ NOT STARTED | NO | depends on settlement reconciliation + payment closure |

Unfinished steps inspected: **23**. Hard-blocked: 2.12C/D/F/G, 2.14, 2.14A–D,
2.15, 2.16, 2.16C, 2.18, 2.18A (PSP/domain-chain/authority). External-blocked:
2.12B, 2.12I, 2.17A (RPO/RTO), 2.17B (SLO + PSP subset). Executable now:
**2.17** (canonical); parallel-safe but secondary: 2.14F (UI, 2.14E approved).

## 4. Step 2.17 analysis (prompt §8)

Roadmap line 757 (RECONCILIATION 2026-08-15) explicitly assigns to 2.17:

- event schema versioning decision + envelope `version` (additive default v1) →
  HERE;
- outbox publisher atomic claim / single-delivery worker (publishPending =
  findMany PENDING без SKIP LOCKED/claim; duplicate-safe consumers exist,
  single-delivery publisher does NOT) → HERE;
- **durable retry scheduler (retryFailed БЕЗ production caller) → HERE CRITICAL HARD GATE**;
- CI repair / legacy isolation / auth hardening / ADMIN SoD / operational
  visibility → HERE (per prepared 2.17 prompt).

Backup/DR and Load/Performance are explicitly NOT in 2.17 (separate pre-exit
gates 2.17A/2.17B). Verified separated concerns: external API idempotency →
2.12H ✅ (done); RLS decision/verification → ADR-0014 / 2.18.

Code verification (independent, not from reports):
- `retryFailed()` defined (eventbus.service.ts:281) with **0 production
  callers** — dead durable retry; `OUTBOX_MAX_ATTEMPTS=5` described but never
  driven by a scheduler.
- `publishPending()` called inline post-commit by HTTP command paths; **no
  SKIP LOCKED / advisory lock / claim** in eventbus.
- `.github/workflows/ci.yml` runs `npm ci`/build from repository root (no root
  package.json) and sets `DATABASE_URL: file:./dev.db` (legacy SQLite) — root CI
  is broken for the canonical PostgreSQL multiSchema backend.
- `sales.service.ts` = 2522 lines, 74 async methods (Lead/Opportunity/Quote/
  CheckoutIntent/Sale) — structural debt.
- Event envelope: no `schemaVersion`; only `OrderRequestedPayload.version=1`;
  consumers do not enforce version.

**Can Step 2.17 execute now without unfinished PSP runtime or later Phase 2
domain contracts? YES.** Every 2.17-scope item is platform-level (EventBus,
CI, auth, repository) and depends only on already-approved Phase 1/2
infrastructure. No 2.12B/2.12C/2.14A/2.14D contract is read or written.
Evidence: reconciliation text (line 757) + code verification above. The
prepared implementation prompt exists on disk:
`docs/prompts/PHASE_2_STEP_2.17_PLATFORM_HARDENING_GATE_IMPLEMENTATION_WITH_PROVENANCE.md`.

## 5. Step 2.17A analysis (prompt §9)

Backup & DR Readiness is independent of PSP selection (reconciliation line:
"Рекомендовано завершить ДО 2.12B real-money go-live"). Requires: final
production infrastructure, deployment topology, RPO/RTO business authority,
database/storage inventory, restoration-test environment. RPO/RTO are NOT
invented — they require authority. Classification: **PARTIAL** — runbook/drill
engineering can proceed, but the step's authority inputs are EXTERNAL. Not
selected as canonical NEXT because it lacks hard-prerequisite closure and is
operational rather than the highest-risk engineering debt.

## 6. Step 2.17B analysis (prompt §9)

Load & Performance Qualification splits into:
- system baseline load testing (auth/API baseline, catalog/search, checkout,
  payment initiation, refund concurrency, outbox backlog, DB pool) — possible
  now;
- PSP/webhook-specific load qualification (webhook burst + duplicate storm) —
  requires real PSP behavior (2.12B) per the reconciliation; fake/nonexistent
  adapters must NOT be used to mark provider-specific performance verified.

Classification: **PARTIAL** — baseline executable, provider-specific subset
PSP-blocked + SLO/SLI authority required. Not canonical NEXT.

## 7. Step 2.18 / 2.18A analysis (prompt §10)

- 2.18 = Phase exit audit/reconciliation gate (not implementation). Depends on
  completion of 2.17 + independent gates 2.17A/2.17B (reconciliation line 765)
  and payment-branch closure; includes ADR-0014/RLS-deferral verification. NOT
  executable now.
- 2.18A = Financial Integrity Exit Gate: monetary precision, webhook replay,
  duplicate capture/refund, ledger balance, settlement reconciliation, temporal
  integrity — depends on settlement reconciliation (2.14D) and payment branch.
  NOT executable now.

## 8. CI ownership (prompt §11)

Root CI correctness / CI repair: **EXPLICITLY OWNED** by Step 2.17 (line 757
"CI repair … → ЗДЕСЬ (per prepared 2.17 prompt)"). Legacy SQLite assumption in
CI is part of the same repair. Verified broken (see §4).

## 9. legacy/ ownership

Legacy isolation / dependency-resolution: **EXPLICITLY OWNED** by Step 2.17
(line 757 "legacy isolation"). Scope of isolation (parallel app vs reference
material) must be defined inside 2.17's prepared prompt; not re-attributed.

## 10. sales.service.ts structural-debt ownership

**NOT OWNED.** Roadmap contains 0 references to sales.service decomposition /
god-service debt (verified grep). This is a Roadmap gap. Per prompt §11 it must
NOT be silently attached to a random step. **Recommended: separate
reconciliation** proposing explicit ownership (candidate: dedicated
decomposition step or a 2.17-authorized refactor with preservation gates) —
recorded here, not decided in this pass.

## 11. Event schema / multi-instance / retry status (prompt §12)

- Event schema versioning: `schemaVersion` NOT canonical; envelope v1 without
  `version`; only `OrderRequestedPayload.version=1`; consumers without
  version-check. Decision OWNED by 2.17 (line 757). Status: OPEN → 2.17.
- Multi-instance safety: outbox claiming absent (publishPending findMany PENDING,
  no SKIP LOCKED/claim); duplicate-safe consumers exist; single-delivery
  publisher does NOT. OWNED by 2.17. Status: OPEN → 2.17. (2.12H request
  idempotency ≠ system-wide event-delivery safety — not confused.)
- Durable retry: `retryFailed()` has NO production caller/scheduler/worker —
  exists in code and tests only. OWNED by 2.17 CRITICAL HARD GATE. Status:
  OPEN → 2.17.

## 12. Candidate ranking (prompt §13)

| criterion | 2.17 | 2.14F | 2.17A | 2.16B |
|---|---|---|---|---|
| hard prerequisite satisfaction | ✅ all platform-level | ✅ (2.14E approved) | ⚠️ RPO/RTO authority | ⚠️ deferred-until-stable |
| PSP independence | ✅ full | ✅ | ✅ | ✅ |
| risk reduction | **HIGH** (CI broken, retry dead, outbox unsafe, auth, legacy) | low (UI) | medium (ops) | low (read model) |
| downstream unblocked | 2.18 exit + whole platform | commission UI only | pre-2.12B ops | none material |
| destructive-rework risk if early | low | low | low | medium (read models may reshape) |
| Phase-exit necessity | ✅ (2.18 depends on it) | no | ✅ (pre-exit gate) | no |

**2.17 wins on risk reduction, prerequisite closure and Phase-exit necessity.**

## 13. Canonical NEXT verdict

```text
VERDICT A — NEXT EXECUTABLE STEP IDENTIFIED

NEXT = Step 2.17 — Phase 2 Hardening

Reason (repository-backed):
- Roadmap 2.17 owns all verified platform-hardening classes (event
  schemaVersion, outbox claiming/single-delivery, durable retry CRITICAL
  HARD GATE, CI repair, legacy isolation, auth hardening, ADMIN SoD,
  operational visibility) — all PSP-independent.
- Verified code debt: CI broken (root npm ci + legacy SQLite), retryFailed
  has no production caller, publishPending has no claim/SKIP LOCKED,
  sales.service god-service, event envelope unversioned.
- Hard prerequisites all satisfied by approved Phase 1/2 infrastructure;
  no dependency on unfinished PSP runtime or later Phase 2 domain contracts.
- Prepared implementation prompt exists on disk.
- Parallel-safe but secondary: 2.14F (Commission Policy UI), 2.17A (Backup/DR)
  — may proceed as separate workstreams, but 2.17 is the canonical NEXT.
```

The selected step is NOT implemented in this pass (prompt §14/§24 HARD STOP).

## 14. Roadmap changes

Minimal, evidence-backed NEXT/dependency clarification only (prompt §15):
- Step 2.17 entry: appended dated reconciliation note recording that 2.17 is
  the confirmed NEXT executable step (PSP-independent, prerequisites
  satisfied) — no status rewrite, no renumbering, no unblocking of 2.12B/2.14,
  no ADR-0015 acceptance, no 2.12C/2.12I start.
- Reported gaps (NOT fixed here): (a) sales.service decomposition unowned —
  separate reconciliation recommended; (b) 2.9 Roadmap header status stale —
  line 552 header lacks status while line 1641 + committed strict-review
  reports record APPROVED WITH REVIEW FIXES (checker PASSes 2.9); recommend a
  status-sync pass.

## 15. Negative checks (prompt §16)

- backend/src changes: **0**
- frontend changes: **0**
- Prisma schema changes: **0**
- migrations: **0**
- runtime config: **0**
- CI implementation: **0**
- tests implementation: **0**

Non-doc diff: **0** (this report + Roadmap clarification note only).

## 16. Artifact integrity

`node scripts/check-roadmap-artifacts.mjs`: see the provenance footer below for
actual PASS count; WARN=0; FAIL=0. Checker regression green. Integrity gaps
found by this audit are reported in §14 (sales.service ownership, 2.9 status
staleness) — not hidden.

## 17. Persistence / provenance

See the provenance footer below (populated post-commit).

REPOSITORY EVIDENCE
repository: travelhub_v1 (local canonical identity)
branch: master
head: WORKTREE
origin: 8ddc589
worktree_clean: false (unrelated untracked prompts)
migration_count: 57
reviewed_state: WORKTREE
reviewed_diff_base: 8ddc589
reviewed_diff_head: WORKTREE
persistence_status: NOT_PERSISTED
persistence_sha: N/A
reviewed_base_sha: 8ddc589
roadmap_sha_or_state: WORKTREE (8ddc589 + clarification note)
report_commit_sha: N/A
provenance_footer_commit_sha: N/A
final_head_sha: N/A
upstream_sha: 8ddc589
push_status: NOT_PUSHED
artifact_integrity: PASS=109 (pre-change baseline) WARN=0 FAIL=0
release_status: NOT APPLICABLE

RELEASE: NOT APPLICABLE — DOCUMENTATION / SEQUENCING RECONCILIATION
