# PHASE 2 — EXIT AUDIT — DESIGN / READINESS

**Date:** 2026-08-18
**Branch:** master @ `f1d4a59`
**Step:** 2.18 — Phase 2 Exit Audit
**Pass:** DESIGN / READINESS

---

## 1. PURPOSE

Design the final Step 2.18 Phase 2 Exit Audit contract from repository truth.

This document defines:
- what Step 2.18 audits
- all Phase 2 exit gates
- evidence classification (reusable vs fresh)
- audit structure and execution order
- PASS/BLOCKED/FAIL semantics
- gap model
- hard stops

This is NOT the final audit. Step 2.18 is NOT APPROVED.

---

## 2. SCOPE

Step 2.18 audits the **completeness and correctness** of Phase 2 against its Definition of Done.

Phase 2 = "Core Commercial Flow" — Marketplace/Storefront → Sales → Order → Booking → Finance → Documents.

Exit criteria: all mandatory gates satisfied, all critical invariants verified, no unresolved blockers.

---

## 3. NON-SCOPE

- Phase 3 (Dashboard, Analytics, CRM UI)
- Production deployment
- PSP/ADR-0015 runtime (explicitly deferred)
- Performance qualification (owned by 2.17B)
- RLS implementation (deferred by ADR-0014)
- Visual/UI requirements beyond API contracts

---

## 4. DEPENDENCY GRAPH

```
Phase 2 Exit = ALL mandatory gates PASS

Mandatory gates:
├── 2.17 Phase 2 Hardening → ✅ APPROVED
├── 2.17A Backup/DR → ✅ APPROVED
├── 2.17B Load/Performance → ⏸ BLOCKED (environment) ← EXIT BLOCKER
├── 2.18 Exit Audit → NOT STARTED
└── 2.18A Financial Integrity → NOT STARTED

External (deferred, NOT exit gates):
├── 2.12B PSP selection → BLOCKED
├── 2.12C SPLIT_AT_PAYMENT → depends on 2.12B
├── 2.12I PSP contract → DEFERRED
├── 2.14 Invoice/Commission → BLOCKED
└── 2.14F Commission UI → PLANNED (independent)
```

---

## 5. STEP 2.18 CANONICAL CONTRACT

From Roadmap:
- **Title:** Phase 2 Exit Audit
- **Purpose:** Сверка с Master/Baseline и DoD
- **Scope:** application-isolation / RLS-deferral (ADR-0014), completeness of gates 2.17A/2.17B
- **Type:** Audit/verification (NOT implementation)
- **Completion requires:** All mandatory exit gates APPROVED

---

## 6. STEP 2.18A CANONICAL CONTRACT

From Roadmap:
- **Title:** Financial Integrity Exit Gate
- **Purpose:** Monetary precision, webhook replay, duplicate capture/refund, ledger balance, settlement reconciliation, temporal integrity
- **Type:** Verification gate
- **Dependencies:** 2.18 (exit audit context), Finance foundation (2.10-2.10C APPROVED), Commission (2.12E APPROVED), Payment abstraction (2.12A APPROVED)
- **PSP dependency:** NONE (internal financial integrity, not PSP integration)

Step 2.18A is a sub-gate of 2.18 — it verifies financial correctness independent of PSP runtime.

---

## 7. EXIT GATE INVENTORY

| # | Gate | Owner/Step | State | Evidence | Fresh? | Blocked? | Exit? |
|---|---|---|---|---|---|---:|---:|
| G1 | Platform hardening (CI, auth, EventBus, security) | 2.17 | APPROVED | Strict review report | Reusable | NO | YES |
| G2 | Backup/DR readiness | 2.17A | APPROVED | Strict review + authority decision | Reusable | NO | YES |
| G3 | Load/performance qualification | 2.17B | BLOCKED | Round 2/3 evidence (partial) | BLOCKED | **YES** | YES |
| G4 | Sales structural decomposition | 2.17C | APPROVED | Strict review report | Reusable | NO | YES (internal) |
| G5 | Phase 2 exit audit completeness | 2.18 | NOT STARTED | This design | N/A | NO | YES |
| G6 | Financial integrity | 2.18A | NOT STARTED | N/A | N/A | NO | YES |
| G7 | ADR-0014 tenant isolation verification | 2.18 | ACCEPTED | ADR document | Reusable | NO | YES |
| G8 | Schema/migrations/drift | All | PASS | Fresh per regression | Fresh | NO | YES |
| G9 | CI/CD | 2.17 | APPROVED | Workflow source + regression | Fresh | NO | YES |
| G10 | Frontend regression | All | PASS | tsc/vitest/build | Fresh | NO | YES |
| G11 | Artifact integrity | All | PASS | Checker + regression | Fresh | NO | YES |
| G12 | Documentation/runbooks | All | PASS | Repository docs | Reusable | NO | YES |

---

## 8. EVIDENCE CLASSIFICATION

### A — APPROVED PERSISTED, REUSABLE
- ADR-0014 (ACCEPTED)
- ADR-0013 (commission policy contract)
- Step 2.17 strict review (platform hardening)
- Step 2.17A strict review + authority decision (backup/DR)
- Step 2.17C strict review (Sales decomposition)
- Architecture docs (47 files)
- Step 2.0-2.14E approved implementation/review reports

### B — APPROVED BUT FRESH RECHECK REQUIRED
- Schema/migrations/drift (must verify at final HEAD)
- Artifact integrity (must run checker at final HEAD)
- CI/CD workflow (must verify source matches 2.17 fixes)
- Frontend tsc/vitest/build (must run at final HEAD)
- Backend tsc/build/unit (must run at final HEAD)

### C — IMPLEMENTED BUT NOT YET APPROVED
- Step 2.18A financial integrity (not started)
- Full serial e2e regression (must run at final HEAD)

### D — BLOCKED BY EXTERNAL ENVIRONMENT/AUTHORITY
- Step 2.17B performance qualification (environment blocked)

### E — NOT STARTED / MISSING
- Step 2.18 final audit execution
- Step 2.18A financial integrity gate

### F — DEFERRED OUTSIDE CURRENT SCOPE
- PSP/ADR-0015 (deferred)
- 2.12B/2.12C/2.12I (deferred)
- 2.14 (blocked on architecture)
- RLS implementation (deferred by ADR-0014)
- 2.14F Commission UI (independent, non-exit)

### N/A — NOT APPLICABLE
- Phase 3 gates
- Production deployment

---

## 9. EVIDENCE FRESHNESS POLICY

| Evidence type | Reuse policy |
|---|---|
| ADR status/decisions | Reuse persisted evidence |
| Architecture docs | Reuse, verify at final HEAD if code changed |
| Strict review reports | Reuse if no code changes since review |
| Unit/e2e/build | Fresh at final HEAD |
| DB drift | Fresh at final HEAD |
| Artifact integrity | Fresh at final HEAD |
| Performance qualification | Approved 2.17B result only (not duplicated) |
| DR authority targets | Reuse approved decision |
| DR script correctness | Source + targeted fresh tests |

---

## 10. ADR-0014 / RLS AUDIT DESIGN

ADR-0014 says: "Application isolation is canonical; PostgreSQL RLS deferred."

2.18 must VERIFY:
1. Application-level tenant isolation is correctly implemented
2. No cross-tenant data leakage at application layer
3. RLS deferral is documented and justified
4. Current isolation model is adequate for Phase 2

2.18 does NOT:
- Implement RLS
- Change tenant model
- Add SQL policies

RLS/tenant-isolation matrix:

| Concern | Authority | Enforcement | 2.18 evidence |
|---|---|---|---|
| Partner ownership | `actor.partnerId` in service guards | Application RBAC | e2e rbac-partner-scope |
| Buyer ownership | `actor.customerId` in service guards | Application RBAC | e2e rbac-buyer-scope |
| Staff roles | `PermissionsGuard` + ROLE_PERMISSIONS | Application RBAC | e2e rbac-* |
| ADMIN behavior | ALL_PERMISSIONS (assessment in 2.17) | Application RBAC | Source inspection |
| Worker/Background | SYSTEM actor + inbox dedup | Application-level | EventBus e2e |
| Cross-tenant IDOR | Dedicated e2e suites | Application guards | e2e IDOR tests |
| Raw SQL bypass | 0 raw SQL outside Prisma | Prisma-only access | Source grep |
| Connection pooling | No session-context leakage | Prisma connection model | Source inspection |

---

## 11. SECURITY / AUTH / RBAC / OWNERSHIP AUDIT

From Step 2.17 approved evidence:

| Concern | Evidence source | Freshness |
|---|---|---|
| HttpOnly auth cookie | 2.17 strict review | Reusable |
| No app localStorage token | 2.17 strict review | Reusable |
| Logout tokenVersion revocation | 2.17 strict review | Reusable |
| /auth/session endpoint | 2.17 strict review | Reusable |
| Login throttling | 2.17 strict review | Reusable |
| PermissionsGuard fail-closed | 2.17 strict review | Reusable |
| CORS production fail-closed | 2.17 strict review | Reusable |
| ADMIN SoD assessment | 2.17 strict review | Reusable |
| Legacy isolation | 2.17 strict review | Reusable |
| Audit logging | 2.17 strict review | Reusable |

Fresh checks required:
- Source inspection at final HEAD for any auth-related changes
- Backend unit/e2e regression at final HEAD

---

## 12. EVENTBUS / OUTBOX / INBOX AUDIT

| Concern | Evidence | Freshness |
|---|---|---|
| at-least-once semantics | 2.17 strict review | Reusable |
| Inbox consumer idempotency | 2.17 + 2.17B evidence | Reusable |
| PENDING durable publication | 2.17 strict review | Reusable |
| FAILED durable retry | 2.17 strict review | Reusable |
| Poison isolation | 2.17 strict review | Reusable |
| Multi-instance safety | 2.17 strict review | Reusable |
| publishEvent targeted delivery | 2.17 strict review | Reusable |
| No exactly-once claim | 2.17 strict review | Reusable |
| Event schemaVersion | 2.17 strict review (additive v1) | Reusable |
| Causation/correlation | ADR-0009 + 2.17 | Reusable |
| Crash window | 2.17 adversarial e2e | Reusable |
| Nested consumer chains | 2.17 adversarial e2e | Reusable |

Performance throughput/backlog gates → 2.17B (NOT 2.18).

---

## 13. IDEMPOTENCY / CONCURRENCY AUDIT

| Operation | Idempotency mechanism | Concurrency mechanism | Evidence |
|---|---|---|---|
| Payment.create | External Idempotency-Key (2.12H) | CAS + unique constraints | 2.12A/2.12H |
| Booking creation | Inbox dedup | CAS version | 2.9 strict review |
| Order creation | Inbox dedup + unique Order code | CAS version | 2.5 strict review |
| Sale completion | CAS version | CAS + optimistic lock | 2.17C strict review |
| Quote operations | CAS version | CAS version | 2.17C strict review |
| Commission accrual | Inbox + unique constraints | pg advisory lock | 2.12E strict review |
| Login throttle | In-memory per-instance | Bounded cleanup | 2.17 strict review |
| Outbox publish | pg advisory lock multi-instance | Worker config | 2.17 strict review |

Required fresh checks:
- Backend unit/e2e regression at final HEAD
- Verify 0 duplicate authoritative facts in regression

---

## 14. MONEY / FINANCE AUDIT

| Concern | Authority | Evidence |
|---|---|---|
| Decimal exactness | Prisma.Decimal + ROUND_HALF_UP | 2.11 strict review |
| Currency consistency | Money authority modules | 2.11 strict review |
| Frozen monetary facts | Quote ISSUE freeze | 2.11/2.17C |
| Commission snapshots | ADR-0013 + 2.12E | 2.12E strict review |
| Finance ledger authority | 2.10/2.10A | Approved |
| Payment authority | 2.12A | Approved |
| No mutable-policy regeneration | ADR-0013 | 2.12E strict review |
| ProviderFee boundary | DEFERRED (2.12B) | N/A for Phase 2 |
| PSP fee boundary | DEFERRED (ADR-0015) | N/A for Phase 2 |

Hard invariant: ProviderFee ≠ TravelHub Commission.

---

## 15. BOOKING / ORDER / SALES / FINANCE AUDIT

Cross-domain consistency from approved evidence:

| Contract | Evidence | Freshness |
|---|---|---|
| Booking state transitions | 2.9 strict review | Reusable |
| Order creation/convergence | 2.5 strict review | Reusable |
| Sales completion (2.17C) | 2.17C strict review | Reusable |
| OrderRequested event | 2.4 strict review | Reusable |
| 1:1 convergence | 2.9 strict review | Reusable |
| No duplicate Order | 2.5 strict review | Reusable |
| No duplicate Sale completion | 2.17C strict review | Reusable |
| Transaction boundaries | 2.17C (22 roots) | Reusable |
| Freeze/snapshot | 2.11 strict review | Reusable |
| Ownership | All domain reviews | Reusable |
| Idempotency | All domain reviews | Reusable |
| Error contracts | All domain reviews | Reusable |

Fresh: backend serial e2e at final HEAD.

---

## 16. COMMISSION AUDIT

| Concern | State | Evidence |
|---|---|---|
| Commission authority | Finance-owned (ADR-0013) | 2.14E/2.12E |
| Accrual trigger | Order creation (frozen snapshot) | 2.12E |
| Snapshot/freeze | frozen at Quote ISSUE | 2.12E |
| Duplicate prevention | Inbox + unique constraints | 2.12E |
| Sales/Order/Finance relationship | Cross-domain via payload | 2.12E |
| 2.14F Commission UI | PLANNED, non-exit | N/A |

2.14F is NOT a Phase 2 exit gate. It can proceed independently.

---

## 17. BACKUP / DR AUDIT

From 2.17A approved evidence:

| Target | Authority | Capability | Evidence |
|---|---|---|---|
| PostgreSQL RPO ≤1h | APPROVED TARGET | NOT VERIFIED (dump-only) | 2.17A authority decision |
| PostgreSQL RTO ≤4h | APPROVED TARGET | LOCAL DRILL ~4-6s | 2.17A authority decision |
| Media RPO ≤24h | APPROVED TARGET | DB-ONLY (media not backed up) | 2.17A authority decision |
| Media RTO ≤8h | APPROVED TARGET | NOT VERIFIED | 2.17A authority decision |
| Daily retention 30d | APPROVED TARGET | Script supports | 2.17A |
| Monthly retention 12mo | APPROVED TARGET | Script supports | 2.17A |
| PITR | NOT VERIFIED | Provider-dependent | 2.17A |
| Runbook | EXISTS | Tested | 2.17A strict review |

Gaps: media backup, PITR, immutability — these are provider-dependent capability gaps, NOT Phase 2 exit blockers per 2.17A contract.

---

## 18. STEP 2.17B PERFORMANCE BOUNDARY

2.18 CANNOT:
- Close the 2.17B gate by inference
- Rerun performance qualification
- Change frozen targets
- Claim system PASS/FAIL from invalid environments

2.18 MUST:
- Treat unresolved 2.17B as BLOCKED
- Record 2.17B as a mandatory exit gate
- Note that performance qualification evidence exists (partial) but is not final

2.17B evidence may be referenced but NOT used to close the gate.

---

## 19. PSP / ADR-0015 BOUNDARY

2.18 MUST verify:
- 2.12B is BLOCKED (no provider selected)
- ADR-0015 is PROPOSED — BLOCKED
- No PSP runtime exists
- No card-data storage
- No provider fee reconciliation
- No payout capability
- No split-at-payment

Raw PAN/CVV persistence remains forbidden.

PSP is explicitly deferred — NOT a Phase 2 exit gate.

---

## 20. DATABASE / MIGRATIONS EXIT AUDIT

Mandatory fresh checks:
- All 58 canonical migrations apply
- Migration count = 58
- Live DB vs schema drift = 0
- No unapplied migrations
- Multi-schema coverage (10 schemas)
- Constraints/indexes present

Fresh isolated DB provisioning: optional (test DB drift check is sufficient).

---

## 21. CI/CD EXIT AUDIT

From 2.17 approved evidence:
- Backend/frontend roots correct
- PostgreSQL 15 service
- prisma migrate deploy
- Serial e2e
- No root npm ci
- No legacy SQLite DATABASE_URL
- Legacy isolation

Fresh: workflow source inspection at final HEAD.

---

## 22. FRONTEND EXIT AUDIT

Mandatory fresh checks:
- tsc 0 errors
- vitest 135/135 PASS
- Production build PASS
- No localStorage auth token
- Route/API contract compatibility

---

## 23. FULL REGRESSION CONTRACT

### Backend
```
tsc --noEmit
npm run build
npx jest --runInBand (unit)
npx jest --config test/jest-e2e.json --runInBand (serial e2e)
```

### Frontend
```
npx tsc --noEmit
npx vitest run
npm run build
```

### DB
```
npx prisma migrate status
npx prisma db push --accept-data-drift (drift check)
```

### Artifacts
```
node scripts/check-roadmap-artifacts.mjs
node scripts/check-roadmap-artifacts.test.mjs
```

Performance: DO NOT rerun inside 2.18.

---

## 24. AUDIT EXECUTION ORDER

1. Provenance / repository baseline
2. Schema/migrations/drift (fresh)
3. Backend regression: tsc → build → unit → e2e
4. Frontend regression: tsc → vitest → build
5. Artifact integrity (fresh)
6. ADR-0014 tenant isolation verification
7. Security/auth/RBAC source inspection
8. EventBus/outbox/inbox correctness verification
9. Money/finance/commission verification
10. Booking/Order/Sales cross-domain verification
11. Backup/DR evidence review
12. 2.17B boundary documentation
13. PSP boundary documentation
14. Gap inventory
15. Verdict
16. Report + Roadmap + commit + push

---

## 25. VERDICT MODEL

### PASS
All mandatory exit gates satisfied, fresh verification green.

### BLOCKED
No system defect, but mandatory external prerequisite prevents completion.

### FAIL
Valid mandatory gate fails in attributable environment.

### NOT APPLICABLE / DEFERRED
Only when canonical scope permits exclusion.

Hard rule: BLOCKED must never be rewritten as PASS or FAIL.

---

## 26. GAP MODEL

| Code | Meaning |
|---|---|
| G1 | Documentation/state mismatch |
| G2 | Missing audit evidence |
| G3 | Missing test coverage |
| G4 | Implementation defect |
| G5 | Unresolved authority |
| G6 | External environment blocker |
| G7 | Deferred external provider |
| G8 | Phase 2 exit dependency |

---

## 27. HARD STOPS

The final audit MUST NOT:
- Approve Step 2.18
- Approve Phase 2
- Close Step 2.17B
- Implement RLS
- Create migrations
- Change production code
- Implement PSP
- Release/deploy

---

## 28. PHASE 2 EXIT RULE

```
Phase 2 exit = ALL mandatory gates APPROVED

Mandatory gates:
- 2.17 Platform Hardening: ✅
- 2.17A Backup/DR: ✅
- 2.17B Load/Performance: ⏸ BLOCKED ← EXIT BLOCKER
- 2.18 Exit Audit: NOT STARTED
- 2.18A Financial Integrity: NOT STARTED

Phase 2 exit = FORBIDDEN while any gate is NOT APPROVED.
```
