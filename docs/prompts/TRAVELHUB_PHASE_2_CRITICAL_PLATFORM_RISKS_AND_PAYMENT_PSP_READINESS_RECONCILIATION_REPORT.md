# TRAVELHUB — PHASE 2 CRITICAL PLATFORM RISKS & PAYMENT/PSP READINESS RECONCILIATION — REPORT

## 1. Verdict

**`TRAVELHUB PHASE 2 CRITICAL PLATFORM RISKS & PAYMENT/PSP READINESS RECONCILIATION COMPLETED`**

- 2.12A decision: **MAY PROCEED WITH MANDATORY EMBEDDED HARD GATES** (VERDICT B).
- 3 new ⏳ PLANNED steps created with explicit owners; 0 ownerless risks remain.
- Artifact integrity: **92 PASS / 0 WARN / 0 FAIL** (before and after changes).

## 2. Repository baseline

- Repository: `D:\travelhub_v1` (origin `seldom733-hash/travelhub1`).
- Branch: `master`; HEAD: `5ba650e`; upstream: `5ba650e` — **HEAD == upstream**.
- Worktree: clean of tracked modifications; 6 unrelated untracked prompt files
  (2.12A impl prompt, 2.17 prompt, duplicate `(1).md`, 2.7/2.9 remediation
  prompts, this pass's prompt).
- Schema: 92 models; migrations: 56.
- Process context verified: checker committed (`24ca50a`), `REPOSITORY EVIDENCE`
  convention active, 2.7/2.9 provenance remediated (`eb4a8ea`/`54fdb03`),
  baseline 0 WARN / 0 FAIL, 2.12E/2.14E approved, 2.12A/2.17 not started.

## 3. Sources inspected

- Roadmap v3 (2.12/2.12A/2.12B/2.12C/2.12D/2.12E/2.14F/2.17/2.18/2.18A entries);
- ADR-0001, ADR-0002, ADR-0009, ADR-0010, ADR-0013 (+ all `docs/adr/`);
- `backend/src/eventbus/**` (envelope, publishPending, retryFailed);
- `backend/src/security/auth/**` (identity, forged-field rejection);
- `backend/src/modules/sales/**` + `finance/**` controllers (POST inventory);
- Prisma schema + all 56 migrations (RLS search);
- `docker-compose.yml`, `.github/workflows/ci.yml`, `release.yml`;
- prepared (untracked) 2.12A and 2.17 implementation prompts;
- README operational claims; `scripts/check-roadmap-artifacts.mjs` + tests.

## 4. Current Payment/PSP dependency graph

`2.12 (Payment Flow ✅) → 2.12A (Provider Abstraction, NEXT) → 2.12B (Buyer Card/Wallet) → 2.12C (SPLIT_AT_PAYMENT) → 2.12D (PLATFORM_COLLECT) → 2.12E (PARTNER_COLLECT ✅) → 2.12F → 2.12G`. 2.12C hard-depends on 2.12A+2.12B+2.14E policy (already recorded in Roadmap).

**This reconciliation inserts `2.12H` between 2.12A and 2.12B** (external Idempotency-Key contract) and adds pre-exit independent gates 2.17A/2.17B.

## 5. RLS audit

- **Evidence:** `ROW LEVEL SECURITY`/`CREATE POLICY` → **0 hits** in schema + migrations; no `current_setting`/`SET LOCAL`/tenant session context.
- Tenancy model: **application-level row-owner isolation** — server-authoritative `actor.partnerId`/`actor.customerId` scoping, RBAC guards, forbidden-key 422 rejection, IDOR e2e suites, single Prisma write layer, SYSTEM-actor consumers with inbox dedup.
- Threat model documented (forgotten predicate, raw/analytics query, compromised path, cross-partner consumer); RLS costs documented (pooled session-context leakage, staff cross-partner workflows, global tables, admin/migration, test complexity).
- **Decision: `APPLICATION ISOLATION IS CANONICAL — RLS DEFERRED WITH ADR`** → **ADR-0014 created**. Deferral verified at Step 2.18; immediate revisit if any application-path violation is ever found. **Not a 2.12A/2.12B blocker. Not owned by 2.17.**

## 6. Event schema-version audit

- Envelope v1 has **NO `version` field** — ADR-0010 explicitly documents `source/version/metadata` as absent in v1 with rationale.
- Exactly **one payload** carries `version: 1` (`OrderRequestedPayload`, added as a 2.5 review fix); **0 consumers validate version** (consumers deserialize by eventType; in-process, deployed atomically with producers).
- 2.12B inbound webhooks are **signature-verified inbound** events, not outbox outbound — schemaVersion is not required for inbound webhook correctness.
- **Decision: `SAFE FOR 2.17`** — explicit 2.17 scope line added (schema versioning decision + additive envelope `version` default v1). Not a 2.12A/2.12B blocker; 2.12A constrained to not introduce new outbound event types before the decision (recorded in 2.12A reconciliation note).

## 7. Multi-instance safety audit

- **Confirmed mechanisms:** DB unique constraints, optimistic `version`/CAS (`updateMany id+status+version`), advisory locks (commission-policy overlap), transactions, inbox dedup, outbox publish-after-commit pattern.
- **Gap (outbox):** `publishPending()` = `findMany({ where: { status: "PENDING" } })` — **no atomic claim, no `SKIP LOCKED`**; two instances can deliver the same PENDING event concurrently. Consumers are **duplicate-safe** (inbox dedup) but there is **no single-delivery publisher**. `retryFailed()` has **no production caller** (dead code without scheduler).
- **Distinction recorded:** `duplicate-safe consumer` ✅ vs `single-delivery publisher` ❌ — different properties.
- **Decision — split ownership:** PSP-local guarantees (webhook dedup via DB unique on provider-event key, create-payment race, webhook-before-API-response, callback reorder, duplicate storm) → designed in **2.12A**, implemented in **2.12B**; system-wide outbox claiming/single-delivery worker + durable retry scheduler → **2.17** (CRITICAL HARD GATE per prepared 2.17 prompt).

## 8. External Idempotency-Key audit

- **Evidence:** `Idempotency-Key`/`idempotencyKey` → **0 hits** in `backend/src` (excluding generated/inbox/outbox/provider refs). No middleware/interceptor supports client-supplied keys.
- Money-changing POSTs today: `POST /checkout` (intent), `POST /checkout/:code/revalidate`, `POST /checkout/:code/cancel`, `POST quotes`, `POST quotes/:code/issue` — rely on **server business codes** (checkoutCode/quoteCode), not external keys.
- 2.12A §14 covers **TravelHub-side provider request identity** (server-generated, business-derived, not client-forgeable) — the internal half; the external client `Idempotency-Key` header contract is **not covered**.
- **Decision: HARD PREREQUISITE BEFORE 2.12B → new Step 2.12H** (External API Idempotency Contract Foundation). Contract decisions enumerated in the Roadmap entry (key format/length, principal/route scope, fingerprint, storage authority, replay semantics, concurrent same-key, TTL, provider mapping, PII). **Not a 2.12A blocker** (2.12A is provider-internal, no client HTTP boundary change).

## 9. Backup/DR audit

- **Evidence:** 0 backup/restore scripts; 0 `pg_dump`/`pg_basebackup`/PITR/WAL references in repo docs/scripts; `docker-compose.yml` provides MinIO only (no Postgres, no backup service); no RPO/RTO anywhere; README contains no restore claims.
- Assets inventory documented (PostgreSQL, object/media storage, secrets/config, deployment defs, provider credentials, migration state, outbox/inbox/audit/finance records).
- **Decision: dedicated independent pre-exit gate → new Step 2.17A (Backup & Disaster Recovery Readiness)**, explicitly NOT part of 2.17 scope. Tested restore drill required; RPO/RTO need authority (not fabricated). Recommended complete before 2.12B real-money go-live. **Not a 2.12A blocker.**

## 10. Load/performance audit

- **Evidence:** 0 load tooling (k6/artillery/autocannon/gatling/jmeter/locust) in backend or frontend package.json; no perf/benchmark docs; no SLO/SLI targets anywhere.
- E2E concurrency/race tests exist and are not load tests (distinction recorded).
- Critical scenarios enumerated (auth baseline, catalog/search, checkout, payment initiation, PSP webhook burst + duplicate storm, refund concurrency, outbox backlog drain, inbox contention, advisory-lock hot keys, DB pool saturation, Finance reads).
- **Decision: dedicated independent pre-exit gate → new Step 2.17B (Load & Performance Qualification)**, explicitly NOT part of 2.17 scope; PSP webhook burst subset mandatory inside 2.12B; SLO numbers require authority (decision-that-is-missing documented, not invented).

## 11. Payment/PSP readiness

| Risk | 2.12A needs? | 2.12B needs? | 2.12C needs? | 2.17 OK? | Pre-exit gate? |
|---|---|---|---|---|---|
| RLS (ADR-0014) | No | No | No | Deferral reviewed at 2.18 | Verify at 2.18 |
| Event schemaVersion | No (don't add new event types) | No (inbound webhooks) | No | Yes — explicit scope | — |
| Multi-instance (PSP-local) | Design now | Implement | Yes (split rails) | Only system-wide outbox worker | — |
| External Idempotency-Key | No | **Yes (HARD)** | Yes | No | — |
| Backup/DR | No | Recommended before go-live | — | No (explicitly) | **2.17A** |
| Load/performance | No | Webhook burst subset | — | No (explicitly) | **2.17B** |

## 12. Step 2.17 capacity audit

- Roadmap 2.17 entry: "Idempotency, Outbox, retries, duplicate events, concurrency, compensation, security, audit, performance."
- Prepared 2.17 prompt (worktree): CI hard gate, durable retry CRITICAL HARD GATE, recovery/concurrency proof, legacy isolation, auth storage/logout/revocation, PermissionsGuard/CORS, ADMIN SoD, README/source of truth, operational visibility.
- **Classification: LARGE BUT DECOMPOSABLE** — with this reconciliation the four operational/contract items (RLS → ADR-0014 + 2.18 verification; external idempotency → 2.12H; backup/DR → 2.17A; load/perf → 2.17B) leave 2.17 with a coherent system-wide hardening scope: CI repair, durable retry worker, outbox single-delivery claiming, event schema versioning decision, legacy isolation, auth hardening, SoD, visibility. Not a structurally unsafe mega-step **after decomposition**; decomposition documented in 2.17 entry.

## 13. CI/CD relation

- `ci.yml` remains broken (root `npm ci`/build with no root package.json; SQLite `file:./dev.db` against PostgreSQL multiSchema) — **verified present, owner = Step 2.17 hard gate** (per prepared prompt).
- Artifact-integrity checker: **not in CI**, planned for 2.17, currently manual — dependency recorded; no new operational gate relies on automation that does not exist without recording the dependency.
- `release.yml` (tag → GitHub Release) is functional and unaffected.

## 14. Legacy relation

- `legacy/` is a parallel app (own package.json, SQLite schema, credentials file) that can contaminate CI discovery / dependency resolution / stale-config evidence — **verified**, owner for isolation/removal = **Step 2.17** (per prepared prompt §8). Not deleted here. No false-architecture-evidence usage observed in this pass's searches.

## 15. SalesService relation

- `sales.service.ts` (~2500 lines, god-service debt) — assessed for concrete risk to Payment/PSP: the PSP abstraction (2.12A) and payment initiation (2.12B) are **Finance-owned**; checkout interactions are via frozen Quote contracts, not sales.service internals. No dependency-order change required. Decomposition stays with its existing owner (2.17 structural debt); 2.12B must not add payment logic into sales.service.

## 16. Dependency matrix

| Risk | Current state | Evidence | 2.12A blocker? | 2.12B blocker? | 2.12C blocker? | 2.17 owner? | Pre-exit gate? | Recommended owner |
|---|---|---|---|---|---|---|---|---|
| RLS / tenant isolation | Application isolation canonical; 0 RLS | DIRECTLY VERIFIED (schema/migrations grep 0) | No | No | No | No | Verify at 2.18 (ADR-0014) | ADR-0014 + 2.18 verification |
| Event schemaVersion | Envelope v1 versionless; 1 payload version | DIRECTLY VERIFIED (domain-events.ts, ADR-0010) | No (no new event types) | No | No | **Yes** (explicit) | — | Step 2.17 |
| Multi-instance (PSP-local) | Designed in 2.12A, impl 2.12B | DIRECTLY VERIFIED (design gap: no claim) | Design | **Yes** (webhook dedup) | Yes | System-wide worker | — | 2.12A/2.12B + 2.17 worker |
| External Idempotency-Key | 0 support | DIRECTLY VERIFIED (grep 0) | No | **Yes (HARD)** | Yes | No | — | **Step 2.12H** |
| Backup/DR | 0 artifacts | DIRECTLY VERIFIED (grep 0) | No | Recommended | — | No (explicitly) | **Yes** | **Step 2.17A** |
| Load/performance | 0 tooling, 0 SLO | DIRECTLY VERIFIED (grep 0) | No | Webhook burst subset | — | No (explicitly) | **Yes** | **Step 2.17B** |

## 17. Risk matrix

| Risk | Severity | Likelihood | Blast radius | Cost of delay | Reversibility | Earliest safe point | Latest acceptable |
|---|---|---|---|---|---|---|---|
| RLS | P2 | Low (IDOR suites green) | Data isolation breach | Low | High (additive later) | 2.18 verify | Phase 2 Exit (verified) |
| Event schemaVersion | P2 | Medium (long-lived outbox rows across deploys) | Consumer breakage on payload evolution | Medium (retrofit dozens of events) | High (additive default v1) | 2.17 | Phase 2 Exit |
| Multi-instance outbox | P1 | Medium (duplicate delivery; consumers dedup) | Duplicate side effects / provider double-charge risk at PSP | High if deferred past 2.12B | Medium | 2.17 (worker); PSP-local in 2.12A/B | Before real-money volume |
| External Idempotency-Key | P1 | High (client retry on money-changing POSTs) | Duplicate payment/refund | High after 2.12B ships | Medium (contract retrofit painful) | 2.12H (before 2.12B) | Before 2.12B |
| Backup/DR | P1 | Medium (no restore capability) | Irrecoverable financial data | High with real money | Low (after data loss) | 2.17A | Before Phase 2 Exit / 2.12B go-live |
| Load/performance | P2 | Medium (webhook burst, pool saturation) | Availability/cost at scale | Medium | High | 2.17B; webhook subset 2.12B | Phase 2 Exit |

## 18. 2.12A blocking decision

**VERDICT B — `2.12A MAY PROCEED WITH MANDATORY EMBEDDED HARD GATES`.**

No risk is a hard prerequisite for the provider-abstraction design (2.12A is NO REAL NETWORK, provider-internal). Exact additions to the 2.12A prompt recorded in the Roadmap entry:
1. External client `Idempotency-Key` explicitly OUT of 2.12A scope (owner 2.12H) — prevent accidental overlap.
2. PSP-local multi-instance race **design** mandatory (webhook dedup key strategy, create-payment race, callback reorder) — implementation in 2.12B.
3. No new outbound event types before the schemaVersion decision (owner 2.17).
4. RLS non-blocker reference (ADR-0014).
5. Existing hard gates (provider authority, lifecycle, error model, NO REAL NETWORK, §14 request identity) remain.

## 19. Required Roadmap changes

- 2.12A entry: reconciliation note (embedded gates + boundaries).
- **New `Step 2.12H --- External API Idempotency Contract Foundation`** 🚧 PLANNED (HARD prerequisite of 2.12B).
- 2.12B entry: HARD prerequisites (2.12A + 2.12H) + PSP-local guarantee list + webhook burst subset.
- 2.17 entry: explicit scope lines (event schemaVersion decision, outbox single-delivery worker, durable retry) + statement that 2.17A/2.17B are NOT part of 2.17.
- **New `Step 2.17A --- Backup & Disaster Recovery Readiness`** 🚧 PLANNED (independent pre-exit gate).
- **New `Step 2.17B --- Load & Performance Qualification`** 🚧 PLANNED (independent pre-exit gate).
- 2.18 entry: verification item for ADR-0014 + 2.17A/2.17B completion.
- NEXT stays **2.12A** (immediate next); dependency chain after it: 2.12A → 2.12H → 2.12B.

## 20. Required ADRs

- **ADR-0014 (created this pass)** — tenant isolation: application isolation canonical, RLS deferred with threat model + costs + revisit condition + unanswered structural questions.
- No other ADR required now: idempotency contract decisions belong to 2.12H (step will produce the contract); event versioning decision belongs to 2.17; DR RPO/RTO and load SLO numbers require authority — explicitly NOT invented here (recorded in step entries).

## 21. New steps, if any

1. **Step 2.12H — External API Idempotency Contract Foundation** (🚧 PLANNED).
2. **Step 2.17A — Backup & Disaster Recovery Readiness** (🚧 PLANNED).
3. **Step 2.17B — Load & Performance Qualification** (🚧 PLANNED).

All start PLANNED, none started, all have explicit owners/rationale/evidence in their entries.

## 22. Negative checks

0 backend production-code changes; 0 frontend production-code changes; 0 Prisma schema changes; 0 migrations; 0 runtime config changes; 0 CI workflow changes; 0 event schema implementation; 0 RLS implementation; 0 idempotency implementation; 0 backup implementation; 0 load-test implementation; 0 Step 2.12A implementation; 0 Step 2.17 implementation. Only documentation files changed.

## 23. Exact files changed

- Created: `docs/adr/ADR-0014-tenant-isolation.md`
- Modified: `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (+13 lines: 2.12A/2.12B/2.17/2.18 notes + new 2.12H/2.17A/2.17B bullets)
- Created: `docs/prompts/TRAVELHUB_PHASE_2_CRITICAL_PLATFORM_RISKS_AND_PAYMENT_PSP_READINESS_RECONCILIATION_REPORT.md` (this file)

## 24. Repository Evidence

```text
REPOSITORY EVIDENCE
repository: D:\travelhub_v1 (origin seldom733-hash/travelhub1)
branch: master
head: <populated after commit>
origin: <populated after commit>
worktree_clean: false (unrelated untracked prompt files remain)
migration_count: 56
reviewed_state: COMMIT
reviewed_diff_base: <populated after commit>
reviewed_diff_head: <populated after commit>
persistence_status: PERSISTED
persistence_sha: <populated after commit>
push_status: <populated after commit>
```

## 25. Exact NEXT

`PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION` (MAY PROCEED with embedded hard gates). Not started in this pass. After 2.12A: 2.12H (external idempotency) → 2.12B.

## 26. Final statement

All six critical platform risks audited from repository evidence (not reports), each assigned an explicit owner and placement: RLS → ADR-0014 + 2.18 verification; event schemaVersion → 2.17; multi-instance → split (PSP-local 2.12A/2.12B, system-wide outbox worker 2.17); external Idempotency-Key → new 2.12H; backup/DR → new 2.17A; load/perf → new 2.17B. 2.12A may proceed with embedded gates; Step 2.17 remains decomposable, not a catch-all; zero production changes; artifact integrity 0 WARN / 0 FAIL.

**`TRAVELHUB PHASE 2 CRITICAL PLATFORM RISKS & PAYMENT/PSP READINESS RECONCILIATION COMPLETED`**
