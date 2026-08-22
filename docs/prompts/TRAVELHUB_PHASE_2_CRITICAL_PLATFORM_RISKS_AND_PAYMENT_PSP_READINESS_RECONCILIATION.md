# TRAVELHUB — PHASE 2 CRITICAL PLATFORM RISKS & PAYMENT/PSP READINESS RECONCILIATION

## 0. MODE

**REPOSITORY-FIRST · ROADMAP RECONCILIATION · ARCHITECTURE/OPERATIONS AUDIT · DOCS-ONLY**

This pass must not implement production functionality.

The purpose is to determine, from the **actual canonical repository and Roadmap**, ownership, dependency order, blocking status, and required hard gates for six critical platform risks before continuing the Payment/PSP chain:

1. PostgreSQL Row-Level Security (RLS) / partner isolation;
2. event schema versioning (`schemaVersion`);
3. multi-instance safety;
4. external HTTP `Idempotency-Key`;
5. backup / disaster recovery;
6. load / stress / performance testing.

The current expected functional NEXT is:

`PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION`

But **do not start 2.12A in this pass**.

This reconciliation must decide whether 2.12A may remain NEXT, whether one or more prerequisites must be inserted before it, and which concerns belong to 2.12A/2.12B, Step 2.17, or a new explicit pre-Phase-2-exit gate.

---

# 1. CORE PRINCIPLE

Do not trust:

- implementation reports;
- Roadmap status text;
- architecture claims;
- comments;
- previous chat summaries;

without checking repository evidence.

For every material conclusion classify evidence as one of:

- `DIRECTLY VERIFIED IN CODE`
- `DIRECTLY VERIFIED IN SCHEMA/MIGRATION`
- `DIRECTLY VERIFIED IN TEST`
- `DIRECTLY VERIFIED IN CI/OPS CONFIG`
- `DIRECTLY VERIFIED IN DOCS`
- `ROADMAP CLAIM ONLY`
- `PARTIALLY IMPLEMENTED`
- `NOT IMPLEMENTED`
- `NOT PROVEN`
- `CONTRADICTED`

Do not convert `planned` into `implemented`.

---

# 2. CURRENT PROCESS CONTEXT TO VERIFY

Repository history is expected to include:

- automated Roadmap artifact-integrity checker;
- `REPOSITORY EVIDENCE` convention;
- provenance remediation for Steps 2.7 and 2.9;
- final artifact-integrity baseline reported as `0 WARN / 0 FAIL`;
- Step 2.12E approved;
- Step 2.14E approved;
- Step 2.12A not started;
- Step 2.17 not started.

Verify actual current repository state.

Do not rely on the SHAs from prior reports.

---

# 3. REPOSITORY BASELINE

Before analysis run:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -20
```

Record:

- repository identity/path;
- branch;
- HEAD;
- upstream SHA;
- HEAD/upstream equality;
- dirty/untracked state.

Do not touch unrelated untracked prompt files.

---

# 4. CANONICAL SOURCES TO INSPECT

At minimum inspect actual:

- canonical Roadmap v3;
- ADRs;
- `docs/architecture/**`;
- `docs/prompts/**` relevant to 2.12/2.12A–G/2.13/2.14/2.17;
- backend Prisma schema;
- migrations;
- Payment/Refund/Dispute/Commission/Ledger/Settlement code;
- EventBus/outbox/inbox implementation;
- authentication/authorization guards;
- controllers/DTOs/interceptors/middleware;
- partner/tenant scoping;
- test harness;
- e2e tests;
- CI workflows;
- Docker/compose/runtime deployment files;
- PostgreSQL configuration if present;
- backup/restore scripts/config/docs;
- load/performance test tooling;
- README operational claims.

Use repo-wide searches rather than sampling one module.

---

# 5. DO NOT TURN STEP 2.17 INTO A CATCH-ALL

A major goal is to prevent Step 2.17 from becoming an unreviewable mega-step.

For each risk determine whether it is:

### A. LOCAL PAYMENT/PSP PREREQUISITE
Must be solved before or inside 2.12A/2.12B because later implementation would otherwise bake in the wrong external contract.

### B. SYSTEM-WIDE HARDENING
May be validated or generalized in 2.17, but local Payment/PSP guarantees may still be required earlier.

### C. INDEPENDENT OPERATIONAL GATE
Needs a dedicated step before Phase 2 Exit rather than being buried inside 2.17.

### D. NON-BLOCKING / DEFERRED
Can safely remain deferred with an explicit owner and rationale.

No risk may remain ownerless.

---

# 6. RISK 1 — POSTGRESQL RLS / PARTNER ISOLATION

## 6.1 Determine actual tenancy model

Find how partner/user isolation currently works.

Inspect:

- partner identifiers on domain models;
- query filters;
- service guards;
- RBAC;
- ownership checks;
- repository/data-access abstractions;
- admin bypass semantics;
- background consumers;
- raw SQL;
- reporting/analytics paths;
- Finance read APIs.

Determine whether TravelHub is:

- tenant-isolated by partner;
- row-owner scoped;
- mixed shared-data architecture;
- or another model.

Do not assume "multi-tenant SaaS" automatically means every table should have RLS.

## 6.2 Search actual DB RLS

Search migrations/schema/SQL for:

```text
ENABLE ROW LEVEL SECURITY
CREATE POLICY
ALTER POLICY
FORCE ROW LEVEL SECURITY
current_setting
SET LOCAL
app.current_tenant
tenant_id
partner_id
```

Determine:

- whether any RLS exists;
- which tables;
- whether application DB role can bypass it;
- whether connection pooling/session context is compatible;
- whether background jobs/consumers have safe context.

## 6.3 Threat model

Identify concrete bypass classes application-only filtering cannot protect against:

- forgotten partner predicate;
- new endpoint;
- raw query;
- analytics query;
- background consumer;
- compromised service path.

Also identify RLS costs/risks:

- pooled connection context leakage;
- migration/admin access;
- global/shared tables;
- cross-partner Finance/Admin workflows;
- test complexity.

## 6.4 Decision required

Choose one:

- `RLS REQUIRED BEFORE PHASE 2 EXIT`
- `RLS REQUIRED BEFORE PAYMENT/PSP`
- `APPLICATION ISOLATION IS CANONICAL — RLS DEFERRED WITH ADR`
- `ARCHITECTURE DECISION REQUIRED`

If RLS is required, define a dedicated owner step. Do not casually bury a cross-repository RLS rollout inside 2.17.

---

# 7. RISK 2 — EVENT SCHEMA VERSIONING

## 7.1 Inspect actual event envelope

Find canonical event types/interfaces and persisted outbox schema.

Determine actual fields, e.g.:

- id;
- event type;
- aggregate/entity identity;
- payload;
- occurredAt/createdAt;
- correlationId;
- causationId;
- actor/provenance;
- attempts/status.

Verify whether `schemaVersion` already exists anywhere.

## 7.2 Inspect consumers

Search all event producers/consumers.

Determine:

- whether consumers deserialize by event type only;
- whether payload contracts are implicit TypeScript shapes;
- whether old persisted outbox rows may survive deployments;
- whether external/webhook/integration consumers are imminent;
- whether unknown fields are tolerated;
- whether incompatible payload evolution has a strategy.

## 7.3 Cost-of-delay analysis

Specifically assess 2.12B webhook/provider events.

Answer:

- Is adding `schemaVersion` before PSP/webhook integration materially cheaper?
- Should version live in envelope or payload?
- Default/version-1 compatibility for legacy persisted events?
- Must consumers reject unsupported major versions?
- Is event-name versioning used instead?

## 7.4 Decision required

Choose:

- `HARD PREREQUISITE BEFORE 2.12B`
- `MUST BE INCLUDED IN 2.12A`
- `SAFE FOR 2.17`
- `NOT REQUIRED — EXISTING VERSIONING CONTRACT SUFFICIENT`

Any "not required" verdict needs concrete repository evidence.

Prefer a small explicit contract step over retrofitting dozens of events later if no versioning exists.

---

# 8. RISK 3 — MULTI-INSTANCE SAFETY

Do not accept "CAS exists" as proof of system-wide multi-instance safety.

## 8.1 Audit concurrency mechanisms

Inventory actual mechanisms:

- DB unique constraints;
- partial unique indexes;
- optimistic `version`;
- CAS updates;
- advisory locks;
- transactions;
- inbox dedup;
- outbox claiming;
- worker ownership/leases;
- `SKIP LOCKED`;
- process-local mutexes;
- cron/schedulers;
- retry workers.

## 8.2 Outbox/event delivery

Determine whether multiple backend instances can concurrently execute event publishing.

Check:

- how PENDING events are selected;
- whether selection claims rows atomically;
- whether two instances can deliver the same event concurrently;
- whether consumers are sufficiently idempotent;
- whether `attempts` updates are safe;
- whether retry behavior is process-local or durable.

Distinguish:

`duplicate-safe consumer`

from:

`single-delivery publisher`.

They are not the same property.

## 8.3 PSP-specific races

Model at minimum:

- duplicate webhook to two instances;
- create-payment API races;
- API response timeout + retry;
- webhook arrives before API response;
- webhook arrives during state transition;
- provider callback reorder;
- refund/payment concurrent operations;
- two workers process same provider event;
- two instances run retry/publish loop.

## 8.4 Decision required

Split ownership if necessary:

- Payment/PSP local guarantees → 2.12A/2.12B;
- system-wide outbox/worker hardening → 2.17;
- multi-instance deployment proof → separate test/gate.

Do not defer a PSP correctness prerequisite solely because 2.17 mentions concurrency.

---

# 9. RISK 4 — EXTERNAL HTTP IDEMPOTENCY-KEY

This is distinct from:

- DB uniqueness;
- command idempotency;
- inbox deduplication;
- outbox deduplication;
- provider idempotency.

## 9.1 Audit existing API boundary

Search for:

```text
Idempotency-Key
idempotencyKey
idempotent
request fingerprint
replay response
```

Inspect middleware/interceptors/controllers/services.

Determine whether any external POST endpoint supports a real client-supplied idempotency key.

## 9.2 Money-changing endpoint inventory

Identify current/future endpoints that may need external idempotency, at minimum:

- checkout intent creation;
- payment creation/initiation;
- payment provider execution;
- refund creation/initiation;
- dispute creation if applicable;
- invoice issuance if command-based;
- payout/settlement execution when externalized.

Do not automatically apply one policy to all POST endpoints.

## 9.3 Required contract decisions

If absent, define architecture requirements:

- header name: `Idempotency-Key`;
- key format/length;
- principal/tenant scope;
- route/operation scope;
- request fingerprint;
- storage authority;
- response snapshot/replay semantics;
- retention/TTL;
- identical replay;
- divergent payload;
- concurrent same-key request;
- failed/in-progress request;
- 4xx/5xx persistence semantics;
- transaction boundary;
- provider idempotency-key mapping;
- PII/security constraints.

Explicitly decide:

`same key + same operation + same principal + same payload`

versus divergent replay.

## 9.4 Decision required

Choose owner:

- prerequisite before 2.12A;
- part of 2.12A;
- hard prerequisite before 2.12B;
- separate 2.12X foundation step.

Do not leave this solely to 2.17 if real external money execution will exist before 2.17.

---

# 10. RISK 5 — BACKUP / DISASTER RECOVERY

## 10.1 Repository evidence

Search for:

- PostgreSQL backup scripts;
- `pg_dump`;
- `pg_basebackup`;
- WAL/PITR;
- managed database backup config;
- MinIO/S3 backup/versioning;
- restore scripts;
- restore runbooks;
- RPO;
- RTO;
- disaster recovery;
- secret/config recovery;
- migration rollback/recovery;
- restore tests.

README claims are not proof of actual restore capability.

## 10.2 Define assets

Inventory what must be recoverable:

- PostgreSQL;
- object/media storage;
- secrets/configuration;
- deployment definitions;
- provider credentials/config;
- migration state;
- audit/outbox/inbox/finance records.

## 10.3 Required strategy

Determine whether repository/project maturity requires:

- logical backups;
- PITR/WAL;
- managed snapshots;
- object-store versioning/replication;
- offsite retention;
- encryption;
- restore drill;
- integrity verification.

Do not invent infrastructure provider details not present in repo.

## 10.4 Decision required

Choose:

- dedicated `Backup & Disaster Recovery` step before Phase 2 Exit;
- 2.17 sub-gate only if scope is genuinely small;
- infrastructure/deployment phase owner already exists;
- architecture decision required.

A backup strategy without a tested restore is not considered a completed DR capability.

---

# 11. RISK 6 — LOAD / STRESS / PERFORMANCE TESTING

## 11.1 Search actual tooling

Search for:

- k6;
- Artillery;
- autocannon;
- Gatling;
- JMeter;
- Locust;
- custom load scripts;
- benchmark suites;
- latency thresholds;
- throughput targets;
- DB pool metrics;
- event backlog tests.

E2E concurrency tests are not automatically load tests.

## 11.2 Critical scenarios

Assess need for:

- auth/API baseline;
- catalog/search;
- checkout;
- payment initiation;
- PSP webhook burst;
- duplicate webhook storm;
- refund concurrency;
- outbox backlog/drain;
- inbox contention;
- advisory-lock hot keys;
- DB connection pool saturation;
- Finance reads;
- file/media path if relevant.

## 11.3 Acceptance metrics

Do not fabricate production SLOs.

Determine whether SLO/SLI targets already exist.

If not, define the **decision that is missing**, e.g.:

- target concurrency;
- p95/p99 latency;
- max error rate;
- sustained throughput;
- webhook burst size;
- backlog recovery time.

## 11.4 Decision required

Choose:

- dedicated performance/load gate before Phase 2 Exit;
- subset inside 2.12B for PSP webhook robustness plus system-wide gate later;
- 2.17 only if Roadmap explicitly defines measurable performance acceptance.

---

# 12. PAYMENT/PSP READINESS AUDIT

Now inspect the planned/actual chain:

`2.12 → 2.12A → 2.12B → 2.12C ...`

Determine actual scope of:

- 2.12A Payment Provider Abstraction;
- 2.12B provider/webhook integration;
- 2.12C SPLIT_AT_PAYMENT;
- Refund/Dispute dependencies;
- provider fee/settlement dependencies.

For each of the six risks answer:

- Does 2.12A need it?
- Does 2.12B need it?
- Does 2.12C need it?
- Can it wait until 2.17?
- Must it exist before Phase 2 Exit?

---

# 13. STEP 2.17 CAPACITY AUDIT

Read the actual Step 2.17 Roadmap entry and any prepared 2.17 implementation prompt available in the canonical repository/worktree.

Inventory debts already assigned there, including where actually evidenced:

- CI/CD repair;
- legacy isolation;
- `sales.service.ts` structural debt;
- durable retry;
- fail-open authorization concerns;
- logout/revocation;
- idempotency/outbox/retries;
- duplicate events;
- concurrency;
- compensation;
- security;
- audit;
- performance.

Then classify Step 2.17:

- manageable;
- oversized;
- structurally unsafe mega-step.

If oversized, propose decomposition.

Do not silently rewrite 2.17 implementation scope without documenting dependency consequences.

---

# 14. REQUIRED DEPENDENCY MATRIX

Produce a matrix:

| Risk | Current state | Evidence | 2.12A blocker? | 2.12B blocker? | 2.12C blocker? | 2.17 owner? | Pre-exit gate? | Recommended owner |
|---|---|---|---:|---:|---:|---:|---:|---|

Every cell must be resolved.

No `TBD` unless accompanied by `ARCHITECTURE DECISION REQUIRED`.

---

# 15. REQUIRED RISK MATRIX

For each risk assign:

- Severity: `P0 / P1 / P2`;
- Likelihood;
- Blast radius;
- Cost of delay;
- Reversibility;
- Earliest safe implementation point;
- Latest acceptable implementation point.

Explain the classification from repository architecture, not generic best practice.

---

# 16. DECIDE WHETHER 2.12A IS CURRENTLY BLOCKED

Final reconciliation must choose exactly one:

### VERDICT A
`2.12A MAY PROCEED AS CURRENT NEXT`

Only if no unresolved prerequisite must precede its abstraction design.

### VERDICT B
`2.12A MAY PROCEED WITH MANDATORY EMBEDDED HARD GATES`

List exact additions to 2.12A prompt.

### VERDICT C
`2.12A BLOCKED BY PRE-REQUISITE FOUNDATION STEP(S)`

Define exact new step(s) before 2.12A.

Do not choose based on schedule convenience.

---

# 17. POSSIBLE NEW STEPS — NAMES ARE NOT PREDECIDED

If evidence supports them, propose explicit Roadmap entries such as:

- `External API Idempotency Contract Foundation`;
- `Event Schema Versioning Foundation`;
- `Payment/PSP Multi-Instance Safety Gate`;
- `Database Tenant Isolation / RLS Decision & Hardening`;
- `Backup & Disaster Recovery Readiness`;
- `Load & Performance Qualification`.

These names are examples only.

Do not create unnecessary steps if an existing canonical owner is adequate.

---

# 18. ROADMAP CHANGES ALLOWED

This is a reconciliation pass, so documentation-only Roadmap changes are allowed if justified.

Allowed:

- explicit prerequisites;
- dependency edges;
- new planned hardening/ops steps;
- decomposition of an oversized future Step 2.17;
- clarified NEXT;
- hard-gate notes.

Forbidden:

- marking implementation complete;
- marking Strict Review approved;
- claiming tests not run;
- changing completed historical verdicts without evidence;
- production implementation.

---

# 19. ADR DECISIONS

If a risk cannot be resolved from current architecture, identify the minimal ADR required.

Possible ADR topics:

- database tenant isolation/RLS;
- event compatibility/versioning;
- external API idempotency;
- multi-instance event delivery;
- DR objectives.

For each proposed ADR list the exact unanswered structural questions.

Do not invent business values such as RPO/RTO or SLO numbers if no authority exists.

---

# 20. CI/CD RELATION

Verify whether the current broken/legacy CI issue has an explicit owner after prior Roadmap work.

Determine whether the new artifact-integrity checker is:

- already run in CI;
- planned for 2.17;
- still manual.

Do not implement CI in this pass.

But ensure no new operational gate depends on nonexistent automation without recording that dependency.

---

# 21. LEGACY RELATION

Determine whether `legacy/` can:

- contaminate dependency resolution;
- contaminate CI discovery;
- expose stale configuration;
- create false architecture evidence;
- be accidentally deployed.

Record whether isolation/removal remains an explicit Roadmap owner.

Do not delete `legacy/` here.

---

# 22. SALES.SERVICE.TS RELATION

Do not refactor it.

Only determine whether its current size/role creates concrete risk for:

- Payment/PSP abstraction;
- transaction boundaries;
- event publishing;
- partner scoping;
- idempotency;
- multi-instance behavior.

If yes, establish dependency order.

If no, leave structural decomposition with its existing owner.

---

# 23. REQUIRED NEGATIVE CHECKS

At the end prove this pass created:

- 0 backend production-code changes;
- 0 frontend production-code changes;
- 0 Prisma schema changes;
- 0 migrations;
- 0 runtime config changes;
- 0 CI workflow changes;
- 0 event schema implementation;
- 0 RLS implementation;
- 0 idempotency implementation;
- 0 backup implementation;
- 0 load-test implementation;
- 0 Step 2.12A implementation;
- 0 Step 2.17 implementation.

---

# 24. REQUIRED REPORT

Create:

`docs/prompts/TRAVELHUB_PHASE_2_CRITICAL_PLATFORM_RISKS_AND_PAYMENT_PSP_READINESS_RECONCILIATION_REPORT.md`

Minimum sections:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current Payment/PSP dependency graph
5. RLS audit
6. Event schema-version audit
7. Multi-instance safety audit
8. External Idempotency-Key audit
9. Backup/DR audit
10. Load/performance audit
11. Payment/PSP readiness
12. Step 2.17 capacity audit
13. CI/CD relation
14. Legacy relation
15. SalesService relation
16. Dependency matrix
17. Risk matrix
18. 2.12A blocking decision
19. Required Roadmap changes
20. Required ADRs
21. New steps, if any
22. Negative checks
23. Exact files changed
24. Repository Evidence
25. Exact NEXT
26. Final statement

---

# 25. ROADMAP UPDATE

If the audit establishes missing owners or wrong dependency order, update the canonical Roadmap documentation in the same pass.

Rules:

- all new steps start as `⏳ PLANNED` / equivalent canonical not-started status;
- preserve completed statuses;
- explicitly state prerequisites;
- explicitly state whether 2.12A remains NEXT;
- do not start any new step.

If no Roadmap change is needed, document why every risk already has an adequate canonical owner.

---

# 26. ARTIFACT-INTEGRITY CHECK

After documentation changes run:

- checker regression suite;
- real Roadmap artifact-integrity checker.

Hard requirement:

`FAIL = 0`

Do not introduce new broken references.

Prefer:

`WARN = 0`

If a legitimate WARN appears due to a newly planned step, classify it and determine whether checker semantics need no change.

Do not weaken checker.

---

# 27. GIT PERSISTENCE — REQUIRED

This reconciliation is not complete until persisted.

Before staging:

```bash
git status --short
git diff --stat
git diff
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
```

Never use:

```bash
git add .
git add -A
```

Explicitly stage only:

- reconciliation report;
- canonical Roadmap if changed;
- ADR/docs only if this reconciliation legitimately creates them.

Verify:

```bash
git diff --cached --stat
git diff --cached
git status --short
```

Suggested commit:

```bash
git commit -m "docs: reconcile phase 2 platform risks and payment PSP readiness"
```

Then push:

```bash
git push
```

or, if no upstream:

```bash
git push -u origin <verified-current-branch>
```

Never force-push.

Verify:

```bash
git rev-parse HEAD
git rev-parse --verify @{u}
```

`HEAD == @{u}` is required before claiming `PUSHED`.

---

# 28. REPOSITORY EVIDENCE

Use the canonical:

`docs/prompts/REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md`

The final report must contain actual:

- repository;
- branch;
- HEAD;
- origin/upstream;
- worktree cleanliness;
- reviewed diff base/head;
- persistence status;
- persistence SHA;
- push status.

Use the repository's established second-footer-commit convention if necessary to avoid self-referential SHA fabrication.

---

# 29. RELEASE

No release.

Record:

`RELEASE: NOT APPLICABLE — ARCHITECTURE/ROADMAP RECONCILIATION`

Do not deploy or migrate production.

---

# 30. FINAL RESPONSE

The final response must include:

```text
TRAVELHUB PHASE 2 CRITICAL PLATFORM RISKS & PAYMENT/PSP READINESS RECONCILIATION COMPLETED

2.12A decision:
- <MAY PROCEED / MAY PROCEED WITH EMBEDDED GATES / BLOCKED BY PREREQUISITES>

Critical risks:
- RLS: <owner/status>
- Event schemaVersion: <owner/status>
- Multi-instance safety: <owner/status>
- External Idempotency-Key: <owner/status>
- Backup/DR: <owner/status>
- Load/performance: <owner/status>

Step 2.17:
- <remains coherent / decomposition required>

Roadmap:
- <exact changes>

Artifact integrity:
- PASS: <N>
- WARN: <N>
- FAIL: 0

Persistence:
- branch: <branch>
- reconciliation commit: <sha>
- provenance/footer commit: <sha or N/A>
- final HEAD: <sha>
- upstream: <sha>
- push_status: PUSHED
- worktree_clean: true|false

RELEASE: NOT APPLICABLE

NEXT: <exact canonical next step>
```

---

# 31. HARD STOP

After:

- repository-first audit;
- six risk decisions;
- Payment/PSP readiness decision;
- Step 2.17 capacity decision;
- dependency/risk matrices;
- Roadmap documentation update;
- artifact-integrity check;
- report;
- explicit staging;
- commit;
- push;
- upstream verification;

**STOP.**

Do not implement:

- 2.12A;
- 2.12B;
- RLS;
- event schema versioning;
- Idempotency-Key;
- worker changes;
- backups;
- load tests;
- Step 2.17.

The next implementation prompt must be chosen only from the reconciliation verdict.
