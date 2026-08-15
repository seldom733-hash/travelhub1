# TRAVELHUB — ROADMAP STRUCTURAL-DEBT OWNERSHIP RECONCILIATION — REPORT
## Step 2.17C — Sales Domain Structural Decomposition + Step 2.9 Status Repair

## Verdict

`TRAVELHUB SALES STRUCTURAL-DEBT OWNERSHIP & STEP 2.9 STATUS RECONCILIATION COMPLETED`

Both gaps independently verified and repaired (documentation-only). Step 2.17C
added as the explicit structural-debt owner; Step 2.9 header status synchronized
with persisted canonical evidence. Canonical NEXT remains **Step 2.17 — Phase 2
Hardening**; no implementation started.

## 1. Repository baseline

- branch: `master`; HEAD == upstream == `2ece45a` (prior footer commit).
- Roadmap artifact checker: PASS=111, WARN=0, FAIL=0 (pre-change); checker
  regression 13/13.
- migrations: 57/57 up to date.

## 2. Actual Sales service path and line count (current repository, not hardcoded)

- Path: `backend/src/modules/sales/sales.service.ts`
- Size: **2522 lines**
- Async methods: **74** `async ` occurrences; **52** declared methods
  (grep `^(async |private async |public async )`).

## 3. Responsibility evidence (what the service actually combines)

Method-name audit of the current file shows materially distinct responsibilities
co-located in one class:

- lifecycle transitions + guards: `assertLeadTransition`, `assertOpportunityTransition`,
  `assertQuoteTransition`, `assertCheckoutMutable`, `assertCheckoutNotCompleted`;
- checkout/quote composition: `checkoutQuoteItems`, `checkoutQuoteMeta`, `getQuoteDetail`,
  `getCheckoutIntentDetail`, `assertQuoteComposable`, `assertFixedDiscountWithinSubtotal`;
- pricing/freeze validation: `discountAmountOf`, `baseRestrictionFacts`,
  `aggregateAvailabilityLevel`, `classifyAvailability`, `availabilityFor`;
- idempotency/validation: `assertOptionalCustomer/Product/User`, `assertTravelersValid`;
- query/read builders: `buildCheckoutListWhere`, `buildLeadListWhere`,
  `buildOpportunityListWhere`, `buildQuoteListWhere`, `buildSaleListWhere`;
- persistence: `findUniqueOrThrow`, `findFirst`, `findMany`, `add`, `count`,
  `entityHistory`, `createdAtRange`, `delete`, `deleteMany`.

Multiple responsibilities (quote/checkout/sale lifecycles, commercial freeze
semantics, validation, idempotency, queries, persistence transactions, event
production per sales.* contracts) genuinely co-reside in one 2500+ line class →
structural maintainability/refactoring debt confirmed.

## 4. Roadmap ownership search

Full canonical Roadmap searched for: `sales.service`, `god service`,
`structural decomposition`, `maintainability refactor`, `domain decomposition`,
`service refactor`. Result: the ONLY hit is the prior NEXT-reconciliation note
(line 758) that itself records the gap ("sales.service decomposition НЕ owned —
рекомендуется отдельный reconciliation"). No step owns the debt.
`2.17C` did not exist prior to this pass.

## 5. Ownership classification

**NOT OWNED.** No other step claims Sales structural decomposition. Per prompt
§4, a dedicated step is justified; Step 2.17C is added.

## 6. Rationale for separate 2.17C (not folded into 2.17)

- Step 2.17 is already a high-risk platform-hardening gate (CI repair, durable
  retry, outbox claiming, schemaVersion decision, legacy isolation, auth/SoD/
  security, visibility) — verified scope from Roadmap line 757.
- `sales.service.ts` decomposition can alter domain transaction boundaries and
  event behavior if done carelessly.
- Combining with platform hardening increases regression surface.
- Structural decomposition requires its own repository-first design,
  implementation and strict review.
- Behavior preservation is the hard invariant.

## 7. Exact Step 2.17C Roadmap entry (added after 2.17B, before 2.18)

```
· **Step 2.17C --- Sales Domain Structural Decomposition** ⏳ PLANNED —
  STRUCTURAL DEBT / BEHAVIOR-PRESERVING REFACTOR (2026-08-15 ownership
  reconciliation — report path; реализация НЕ начата; maintainability/
  structural-risk step, НЕ feature step)
```

Entry records: current debt metrics (2522 lines / 74 async / 52 declared),
purpose (cohesive internal decomposition without external behavior change),
**hard invariants** (API behavior, HTTP contracts, RBAC, domain ownership,
schema, transaction atomicity, idempotency, outbox/inbox semantics, event
contracts, causation/correlation, freeze semantics, money, Commission/Payment/
Booking boundaries, error/status, concurrency), mandatory pre-implementation
design pass, line-count-not-success rule (success = explicit owners, dependency
direction, no duplicate authority, no circular graph, no hidden cross-domain
writer, correct transactions, behavior-preservation tests, intact contracts),
future regression requirements, placement (after 2.17; PSP-independent),
separation from 2.17A/2.17B.

## 8. Future invariants (recorded in Roadmap)

Behavior preservation is HARD INVARIANT; any required behavioral change found
during work must be split into a separately approved bugfix/architecture
decision. Decomposition design (repository-first) REQUIRED before
implementation; no preselecting class names; cohesion and explicit ownership,
not arbitrary file splitting.

## 9. Future design requirement (recorded)

Before implementation, Step 2.17C must run a dedicated decomposition/design
pass identifying: public methods, internal call graph, transaction boundaries,
Prisma writes, cross-domain reads/writes, event publication/consumers,
idempotency boundaries, concurrency-sensitive sections, shared validation,
lifecycle state machines, frozen-snapshot creation/propagation, circular
dependencies, test coverage by responsibility.

## 10. Dependency placement

```text
2.17 Platform Hardening
   ↓
2.17C Sales Domain Structural Decomposition
   ↓
later Phase-exit verification
```

Reasoning: platform hardening first stabilizes CI/event-retry/multi-instance/
security guardrails; the large Sales refactor then executes under stronger
automated protections; Phase exit should not leave known high-risk structural
debt unowned. **2.17C does NOT depend on PSP selection** (no Sales code/
dependency evidence requires it). Immediate NEXT stays Step 2.17.

## 11. Relationship to 2.17 / 2.17A / 2.17B

```text
2.17A = Backup & DR Readiness
2.17B = Load & Performance Qualification
2.17C = Sales Domain Structural Decomposition
```

Separation preserved; no concern moved between them.

## 12. Step 2.9 evidence

- Header/primary entry (line 552): `· **Step 2.9 --- Booking Lifecycle
  Completion**` — no status marker.
- Historical dated log (line 4, 2026-08-13): "Step 2.9 ◀ IMPLEMENTATION
  COMPLETED — WAITING FOR STRICT REVIEW (2026-08-13)" — true as of that date.
- Canonical details section (29B, line 1642): `29B. **PHASE 2 — STEP 2.9 —
  BOOKING LIFECYCLE COMPLETION** ✅ STRICT REVIEW COMPLETED — APPROVED WITH
  REVIEW FIXES (2026-08-13; … отчёт — `docs/prompts/PHASE_2_STEP_2.9_BOOKING_
  LIFECYCLE_COMPLETION_STRICT_REVIEW_REPORT.md` (RETROSPECTIVE EVIDENCE
  RECONSTRUCTION … verified commit `1bc19b7`))`.
- Committed SR report exists with verdict `PHASE 2 STEP 2.9 STRICT REVIEW
  COMPLETED — APPROVED WITH REVIEW FIXES`; git history: commit `54fdb03`
  "docs: reconstruct step 2.9 review evidence and close provenance warning".
- Architecture doc: `docs/architecture/booking-lifecycle-completion.md`.
- Artifact checker: Step 2.9 refs PASS.

**Canonical status: STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES.**
Stale presentation confirmed: header lacked the status while persisted
canonical evidence records approval.

## 13. Exact Step 2.9 repair

Smallest possible repair: synchronized the header/primary entry (line 552) with
the persisted canonical evidence — added `✅ STRICT REVIEW COMPLETED — APPROVED
WITH REVIEW FIXES (2026-08-13; …)` with pointer to the 29B section, committed
SR report, reconstruction label and verified commit `1bc19b7`, plus explicit
note that the historical dated log (2026-08-13) is NOT rewritten. No new
verdict; no fabricated dates/test counts; no history rewrite; provenance
distinction preserved.

## 14. Canonical NEXT verification

```text
CANONICAL NEXT = Step 2.17 — Phase 2 Hardening
```

Preserved. Adding 2.17C did NOT replace 2.17 as immediate NEXT; 2.17C is future
work (implementation after 2.17 + strict review, per placement §10). Sequence:
NOW = this reconciliation only; NEXT = 2.17 implementation → 2.17 strict review;
THEN = 2.17C per established order + independent Phase gates.

## 15. Payment-branch negative checks

- 2.12B: unchanged (BLOCKED) · ADR-0015: unchanged (PROPOSED/BLOCKED)
- 2.12I: unchanged (PLANNED—DEFERRED) · 2.12C: unchanged (NOT STARTED)
- No PSP selected; split/payout architecture unchanged.

## 16. Production-code negative checks

- backend/src: **0** · frontend: **0** · schema/migrations: **0**
- CI workflow implementation: **0** · runtime config: **0** · tests: **0**
- Sales production code: **0** (no refactor) · legacy runtime: **0**
- Expected production/runtime diff: **0** (documentation-only).

## 17. Artifact-integrity result

`node scripts/check-roadmap-artifacts.mjs`: PASS=<actual>, WARN=0, FAIL=0
(post-edit); checker regression suite green. The new Step 2.9 header and 2.17C
entry are classified per existing checker rules; no limitation suppressed.

## 18. Persistence / provenance

See REPOSITORY EVIDENCE footer (populated post-commit).

REPOSITORY EVIDENCE
repository: travelhub_v1 (local canonical identity)
branch: master
head: 6420a0c
origin: 6420a0c
worktree_clean: false (unrelated untracked prompts)
migration_count: 57
reviewed_state: COMMIT
reviewed_diff_base: 2ece45a
reviewed_diff_head: 6420a0c
persistence_status: PERSISTED
persistence_sha: 6420a0c
reviewed_base_sha: 2ece45a
roadmap_before_sha: 2ece45a
docs_commit_sha: 6420a0c
provenance_footer_commit_sha: 6420a0c
final_head_sha: 6420a0c
upstream_sha: 6420a0c
push_status: PUSHED
artifact_integrity: PASS=116 WARN=0 FAIL=0
release_status: NOT APPLICABLE

RELEASE: NOT APPLICABLE — DOCUMENTATION / ROADMAP RECONCILIATION
