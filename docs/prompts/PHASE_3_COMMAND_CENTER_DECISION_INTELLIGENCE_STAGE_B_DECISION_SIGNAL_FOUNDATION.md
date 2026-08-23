# PHASE 3 — COMMAND CENTER DECISION INTELLIGENCE
## STAGE B — DECISION SIGNAL FOUNDATION

### STATUS
**Implementation stage.** Stage A — Granular RBAC Remediation is complete with **VERDICT A**.

# 1. OBJECTIVE
Build the reusable Decision Signal foundation required before Needs Attention Decision Queue, deterministic WHY, Impact Scoring, Action Routing, AI reconciliation, and section enrichment.

Target:
```text
Authoritative Business State
→ deterministic detection
→ Decision Signal
→ Evidence
→ persisted lifecycle
→ later WHY / IMPACT / ACTION
```

A Decision Signal is a detected business condition important enough to track, surface, acknowledge, resolve, enrich, or act upon. It is NOT a generic KPI, Analytics report, copy of domain data, AI opinion, notification, or business action.

# 2. HYBRID MODEL — REQUIRED
Prefer a hybrid architecture unless repository evidence proves otherwise:
```text
Orders / Booking / Finance / Catalog / CRM / canonical Analytics
                    ↓
            deterministic detector
                    ↓
             Decision Signal
              ↙           ↘
     dynamic facts       persisted state
       /evidence          /lifecycle
```
Do not duplicate authoritative Order, Booking, Payment, Product, Partner, GMV, Revenue, etc. Persist only what is necessary for stable identity, lifecycle, acknowledgement, deduplication, auditability, recurrence and evidence provenance.

# 3. AUDIT BEFORE MODIFYING
Inspect current HEAD. Locate Dashboard/Command Center modules, V3 types, Needs Attention, AI Decision Feed, outbox/event infrastructure, audit/history patterns, business-ID generator, RBAC resolver, Prisma bounded contexts, lifecycle conventions, idempotency/dedup patterns and entity-reference patterns.

Before implementation report:
```text
Existing reusable concepts:
Missing foundation:
Chosen owner:
Chosen persistence location:
Reason:
```
Do not create duplicate Alert/Insight/Incident/Signal concepts if an equivalent canonical model exists.

# 4. OWNERSHIP
Decision Signal belongs conceptually to Command Center / Decision Intelligence, not Analytics, Booking, Order, Finance, Catalog or CRM. Do not create a new microservice. Respect the project's multi-schema/bounded-context rules and prohibition on inappropriate cross-schema foreign keys.

# 5. NORMALIZED CONTRACT
Define a repository-native normalized contract, conceptually:
```ts
DecisionSignal {
  id
  code
  type
  category
  status
  source
  detectorKey
  fingerprint
  affectedEntities[]
  evidence[]
  firstDetectedAt
  lastDetectedAt
  acknowledgedAt?
  acknowledgedBy?
  resolvedAt?
  resolvedBy?
  createdAt
  updatedAt
}
```
Do not copy blindly. Avoid speculative fields. Leave clean extension points for WHY, IMPACT, SEVERITY, ACTION and AI wording, but do not implement those engines now.

# 6. TYPE AND CATEGORY
If justified, distinguish stable category from detector/type, e.g. OPERATIONAL / FINANCIAL / CATALOG / CHANNEL and BOOKING_CONFIRMATION_DELAY etc. Do not create dozens of speculative DB enums. Prefer extensibility when future signal types should not require destructive migrations.

# 7. STABLE IDENTITY / FINGERPRINT
Dashboard refresh must not create a new signal. Define deterministic identity from:
```text
detectorKey + business scope + affected/group identity = fingerprint
```
Do not include mutable presentation text, random timestamps, PII or secrets. Fingerprint generation must be deterministic and unit-tested.

# 8. DEDUPLICATION / CONCURRENCY
Repeated detector execution must be idempotent:
```text
first observation → create
same active condition → reobserve/update same signal
condition disappears → no duplicate
legitimate recurrence → explicit recurrence policy
```
Choose and document reopen-vs-new-occurrence semantics. Use DB-backed uniqueness/transactions as a concurrency-safe backstop; do not rely on find-then-insert alone.

# 9. LIFECYCLE
Evaluate states such as OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, DISMISSED, EXPIRED, but implement only justified minimum states. Define for each:
```text
meaning
allowed transitions
actor/system authority
timestamps
re-detection behavior
```
Reject invalid transitions server-side.

# 10. ACKNOWLEDGEMENT / RESOLUTION
Acknowledgement means an authorized user has accepted awareness/ownership of the signal; it must not mutate the authoritative business object. Persist actor/time or use canonical audit history.

Distinguish manual resolution from condition disappearance where appropriate. Design for future detector-driven auto-resolution, but only prove the mechanism on representative cases in Stage B.

Critical invariant:
```text
detector failed ≠ condition disappeared
```
Detector failure must never silently resolve a signal.

# 11. AUDITABILITY
Lifecycle mutations must be auditable: acknowledge, state transition, resolve, dismiss if supported. Reuse existing TravelHub audit infrastructure rather than creating a parallel audit subsystem.

# 12. AFFECTED ENTITIES
Support typed references without copying domain records, conceptually:
```ts
{ entityType: "BOOKING", entityId: "..." }
```
Use only needed types now (ORDER/BOOKING/PAYMENT/PARTNER/PRODUCT/etc.). Respect canonical IDs and bounded-context FK rules.

# 13. EVIDENCE FOUNDATION
Every signal must contain machine-readable factual evidence sufficient to answer “why does this signal exist?” without yet implementing causal WHY attribution.

Conceptual:
```ts
SignalEvidence {
  key
  value
  unit?
  source
  observedAt
  entityRef?
  period?
}
```
Examples:
```text
pendingConfirmationCount = 18
oldestPendingMinutes = 222
affectedGmv = 24800 AZN
```
Only include facts canonically calculable from authoritative data. Do not persist raw SQL, secrets, unnecessary PII, or prose as the sole evidence.

# 14. PROVENANCE
Evidence must identify its origin sufficiently for later WHY/IMPACT/AI layers: detector/read-model/canonical metric/domain query and relevant period/entity scope. AI must later be able to reference evidence rather than invent facts.

# 15. PRESENTATION / I18N
Structured signal + structured evidence are truth. Do not make hardcoded English/Russian sentences business authority. Follow existing RU/AZ/EN architecture. Do not build AI text generation in Stage B.

# 16. RBAC INTEGRATION
Stage A granular RBAC remains authoritative. Signal list/get/mutations must enforce server-side permissions. Knowing a signal ID must not bypass authorization. Do not hardcode role enums; use effective permissions/admin overrides.

Define signal ownership/projection to surfaces such as operational, financial, attention, insights. Prefer one canonical signal projected to multiple authorized surfaces rather than duplicate DB signals.

# 17. API FOUNDATION
Implement only minimal repository-consistent contracts needed to prove:
```text
list active signals
get signal
acknowledge signal
resolve signal
```
with server-side RBAC, normal pagination and minimal filtering (status/type/category/surface as justified). Do not build the final Decision Queue UI.

# 18. DETECTOR CONTRACT
Create a reusable deterministic detector contract. Conceptually:
```ts
DecisionSignalDetector {
  key
  detect(context): DetectedCondition[]
}
```
Central orchestration/persistence must own fingerprinting, dedup/upsert, re-observation, lifecycle reconciliation and evidence persistence. Individual detectors must not reinvent persistence.

# 19. REPRESENTATIVE END-TO-END DETECTOR
Implement only the minimum detector(s) needed to prove the foundation. Prefer an existing reliable Needs Attention condition such as pending booking confirmations.

Do NOT migrate all Needs Attention counters.

Prove:
```text
authoritative condition
→ detector
→ stable fingerprint
→ one signal
→ evidence
→ RBAC
→ acknowledge
→ reobserve without duplicate
→ resolve according to defined semantics
```

# 20. STRICT SCOPE BOUNDARIES
Do NOT implement:
```text
WHY causal attribution
Impact Score
LOW/MEDIUM/HIGH/CRITICAL scoring
business action routing
AI Decision Feed reconciliation
full Needs Attention migration
Storefront billing/revenue remediation
Command Center redesign
```
Factual evidence may include affected counts/amounts if directly calculable, but must not be converted into arbitrary severity or impact scores.

Signal lifecycle operations (acknowledge/resolve) are allowed; domain actions such as Contact Partner, Retry Payment, Assign Operator, Escalate Booking belong to Stage F.

Do not use arbitrary rules such as `count > 5 => high`.

# 21. DATABASE SAFETY
If persistence is required:
- explicit migration;
- preserve multi-schema rules;
- no inappropriate cross-domain FKs;
- indexes based on actual query patterns;
- DB uniqueness for dedup where appropriate;
- no unrelated table changes;
- resolved history retained by default.

Consider fingerprint/status/type/lastDetectedAt indexes based on real access patterns.

# 22. EXECUTION MODEL / PERFORMANCE
Determine target detector execution model: request-time, event-driven, scheduled or hybrid. Inspect existing outbox/event infrastructure first. Do not create unnecessary workers. Stage B may use the simplest safe mechanism for representative proof, but must document the target model and avoid making every Command Center request synchronously execute every future detector.

# 23. FAILURE ISOLATION
A failing detector must not corrupt or resolve unrelated signals. Define error handling and test the critical failure invariant where practical.

# 24. REQUIRED TESTS — MODEL
Test at minimum:
```text
creation
fingerprint determinism
duplicate detection
re-observation
allowed transitions
invalid transitions
acknowledgement
resolution
audit fields/history
affected entity references
structured evidence
```

# 25. REQUIRED TESTS — SECURITY
Prove:
```text
authorized list/get/acknowledge/resolve
unauthorized list/get/acknowledge/resolve denied
known signal ID cannot bypass RBAC
Stage A section authority remains intact
admin-granted permissions remain effective
```

# 26. REQUIRED TESTS — IDEMPOTENCY
Prove:
```text
same detector + same business scope → one active signal
```
Repeated and, where practical, concurrent executions must not duplicate signals.

# 27. REQUIRED END-TO-END FLOW
Demonstrate:
```text
1 authoritative condition exists
2 detector observes it
3 exactly one signal created
4 evidence attached
5 authorized user reads it
6 unauthorized user cannot
7 authorized user acknowledges
8 state persists
9 detector reobserves without duplication
10 signal resolves according to defined semantics
```

# 28. REGRESSION GATES
Run repository-appropriate:
```text
Decision Signal unit tests
lifecycle/dedup tests
Dashboard/Command Center tests
RBAC tests
Command Center E2E
representative domain E2E
Backend TSC
Backend build
Frontend tests/TSC/build if frontend touched
```
Stage A tests must remain green. Do not claim PASS without actual evidence.

# 29. DELIVERABLE A — ARCHITECTURE DECISION
Return:
```text
Owner:
Persistence model:
Dynamic vs persisted responsibilities:
Detector execution model:
Fingerprint strategy:
Dedup strategy:
Recurrence strategy:
Lifecycle:
Audit strategy:
RBAC strategy:
Evidence strategy:
Failure semantics:
```

# 30. DELIVERABLE B — IMPLEMENTED MODEL
Show actual repository-native DecisionSignal, evidence, affected-entity reference, lifecycle/status and detector contract. If JSON vs normalized tables are used, explain why.

# 31. DELIVERABLE C — STATE MACHINE
Return:
| From | To | Allowed | Actor/System | Notes |
|---|---|---:|---|---|
Include re-detection and detector-failure behavior.

# 32. DELIVERABLE D — REPRESENTATIVE FLOW
Return actual:
```text
Business condition:
Authoritative source:
Detector:
Fingerprint:
Signal:
Evidence:
Required permission:
Acknowledgement:
Resolution:
Re-detection:
```

# 33. DELIVERABLE E — FILES / MIGRATION
List exact files, changes and reasons. For migration include name, models/tables, indexes and constraints.

# 34. DELIVERABLE F — TEST EVIDENCE
Return actual counts/results:
```text
Decision Signal unit:
Lifecycle:
Dedup/idempotency:
RBAC:
Command Center:
Representative domain E2E:
Backend TSC:
Backend build:
Frontend tests/TSC/build if applicable:
```

# 35. DELIVERABLE G — SECURITY CONFIRMATION
Explicitly confirm/deny:
```text
Signal ID cannot bypass RBAC.
Signal mutations are server-authorized.
Admin-granted permissions remain effective.
One canonical signal may project to multiple surfaces without duplicating authority.
Stage A granular RBAC remains intact.
```

# 36. DELIVERABLE H — SCOPE CONFIRMATION
Explicitly return:
```text
WHY engine implemented: NO
Impact scoring implemented: NO
Business action routing implemented: NO
AI Decision Feed reconciliation implemented: NO
Full Needs Attention migration implemented: NO
```
Any YES requires strict justification.

# 37. VERDICT
Return exactly one:

## VERDICT A — STAGE B COMPLETE
Only if normalized foundation exists; stable fingerprint and concurrency-safe dedup exist; lifecycle is explicit; acknowledgement/resolution is auditable; structured evidence and affected references exist; RBAC is server-enforced; representative detector proves the full flow; tests pass; later-stage logic was not prematurely implemented.

## VERDICT B — REMEDIATION REQUIRED
Foundation exists but one or more Stage B requirements remain incomplete.

## VERDICT C — BLOCKED
A foundational architectural constraint prevents correct implementation; state the exact blocker.

# 38. STOP
After Stage B:

**STOP.**

Do not proceed automatically to Stage C. Do not migrate all Needs Attention counters and do not implement WHY, Impact Scoring, business Action Routing or AI reconciliation. Return the Stage B report and wait for review.
