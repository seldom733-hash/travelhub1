# PHASE 3 --- STEP 3.5.3 --- PLATFORM CRM

## ROUND 2E.1 --- FINAL TEST FIXTURE + LIVE PROJECTION EVIDENCE CLOSURE

### SOURCE ADAPTER TEST BASELINE ELIMINATION + DETERMINISTIC LIVE RUNTIME PROOF + FINAL STEP 3.5.3 ACCEPTANCE

**Все ответы разработчика, отчёт и roadmap updates --- строго на
русском.**

## 1. CONTEXT

Round 2E прошёл runtime/security/rebuild qualification, но оставил два
backend failures непосредственно в Activity Source Adapters и
недостаточно детерминированный live-projection runtime proof. В отчёте
зафиксировано `1234 PASS / 2 failed`; failures --- OrderAdapter и
BookingAdapter с expected `partner-1`, received `null`. Они
классифицированы как stale fixtures без canonical `sellerPartnerId`.

Round 2E.1 --- узкий evidence/test closure. Это не новый feature round.

## 2. OBJECTIVE

Закрыть только:

``` text
A. Re-verify and fix 2 stale Source Adapter fixtures
B. Obtain backend full suite: 0 FAIL
C. Prove deterministic live Activity projection WITHOUT rebuild
D. Run focused regressions
E. Correct Round 2E evidence wording
F. Finalize Round 2E + Step 3.5.3
G. Commit/push, HEAD == origin/master
H. STOP
```

## 3. REPOSITORY-FIRST

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -40
git diff
git diff --check
```

Record Starting HEAD/origin/worktree and verify `990e599`, `2ac80b6`
reachable. Inspect actual Round 2E report and failing tests before
editing.

## 4. FAILURE 1 --- ORDER ADAPTER

Known failure:

``` text
OrderAdapter — projects an Order with customerId and partner binding via items
Expected partner-1
Received null
```

Re-verify fixture, adapter, schema and canonical Partner authority.

Canonical authority must remain:

``` text
Order.sellerPartnerId
```

Do NOT restore obsolete inference through items/product/first
item/nonexistent Prisma relation/arbitrary fallback.

If fixture lacks `sellerPartnerId`, update fixture to represent the
actual canonical model while preserving assertion:

``` text
projected partnerId == partner-1
```

Do not weaken/remove/skip assertion.

## 5. FAILURE 2 --- BOOKING ADAPTER

Known failure:

``` text
BookingAdapter — projects a Booking with indirect customer/partner binding
Expected partner-1
Received null
```

Re-verify actual adapter contract.

If Partner attribution derives through canonical Order context, fixture
must provide the actual Order data including:

``` text
Order.sellerPartnerId
```

Preserve:

``` text
projected partnerId == partner-1
```

Do not introduce invalid Prisma relations or N+1 merely to satisfy test.

## 6. FIX TESTS, NOT PRODUCTION CODE

Expected:

``` text
production code delta = 0
```

If repository audit disproves the Round 2E diagnosis and production
adapter is wrong, document exact defect and make only the minimum Step
3.5.3 fix with regression coverage.

Forbidden test "fixes":

``` text
expect null
remove partner assertion
test.skip / xit
weaken assertion
mock final adapter output
hardcode projected result
restore obsolete authority logic
```

## 7. SOURCE ADAPTER TESTS

Run exact Source Adapter suite.

Required:

``` text
OrderAdapter: PASS
BookingAdapter: PASS
all Source Adapter tests: PASS
failed = 0
new skipped = 0
```

Report exact files/tests/pass/fail/skip.

## 8. FULL BACKEND TESTS

Run the same full backend command used in Round 2E.

Previous:

``` text
1234 PASS / 2 FAIL
```

Expected if discovery unchanged:

``` text
1236 PASS / 0 FAIL
```

Acceptance is not hardcoded count; it is:

``` text
all discovered backend tests PASS
failed = 0
new skipped = 0
```

No more "2 pre-existing" after fixtures are reconciled.

## 9. FRONTEND + BUILD/TSC

Run:

``` text
Backend TSC
Backend build
Frontend TSC
Frontend build
Frontend full tests
```

Previous frontend baseline:

``` text
243/243 PASS
```

Required: 0 failures, 0 new skipped.

## 10. DETERMINISTIC LIVE PROJECTION PROOF

Prove a newly created source event appears in Activity **without
rebuild/backfill between creation and verification**.

Required sequence:

``` text
T0 record Activity state
T1 create controlled source event through legitimate existing runtime/API flow
T2 DO NOT run rebuild/backfill
T3 query Activity API
T4 verify new event appears
T5 verify browser UI where applicable
```

Code inspection alone is not sufficient.

## 11. PREFERRED LIVE EVENT --- OPERATIONAL NOTE

Prefer existing audited Operational Note flow.

Record:

``` text
subjectType
subjectId
noteId/sourceId
createdAt
Activity count before
Activity count after
Activity sourceType
Activity eventType
Activity sourceId
Activity occurredAt
rebuild between T1/T3 = NO
```

Required:

``` text
new Note → new Activity
correct subject
exact sourceId
duplicate = 0
manual rebuild = NO
```

Do not violate append-only/audit rules to clean up the test.

## 12. OPTIONAL COMMERCIAL LIVE PROOF

If a safe canonical commercial creation flow is readily available,
additionally prove ORDER/BOOKING/PAYMENT/REFUND live projection.

Do not invent/bypass commercial workflows only for evidence.

If unsafe or broad side effects would result, Operational Note live
runtime proof is sufficient for this specific evidence gap; commercial
paths remain covered by adapter tests and existing runtime data.
Document decision.

## 13. LIVE SUBJECT AUTHORITY

For new event verify:

``` text
correct subject receives event
wrong subject does not
cross-subject leakage = 0
exact sourceId
duplicate rows = 0
```

If source legitimately has both Customer and Partner axes, verify
independently.

## 14. NO BACKFILL-ASSISTED PROOF

Evidence must show no:

``` text
POST /crm-activity/backfill
```

or equivalent rebuild between source creation and Activity query.

Required:

``` text
source created → live projector → Activity appears
```

Not:

``` text
source created → rebuild → Activity appears
```

## 15. CUSTOMER PAYMENT REGRESSION

Focused regression only.

If dataset unchanged:

``` text
CRM-00000089
Payments = 4
Activity PAYMENT = 4
wrong customer = 0
duplicates = 0
```

If dataset changed legitimately, recalculate expected counts.

Preserve canonical Payment ownership from `990e599`.

## 16. PARTNER ACTIVITY REGRESSION

Representative:

``` text
Baku Tours Pro
```

Verify Activity endpoint, subject, cursor and cross-partner leakage=0.

Do not hardcode 1964 if live proof legitimately changes total; explain
delta.

## 17. RBAC REGRESSION

  Path                Authorized   Unauthorized   Anonymous
  ------------------- ------------ -------------- -----------
  Customer Activity   200          403            401
  Partner Activity    200          403            401

If no production security code changes, focused regression is
sufficient.

## 18. REBUILD REGRESSION

Do not run rebuild before deterministic live proof completes.

If no production Activity/rebuild code changes, reference accepted Round
2E runtime evidence and run focused tests for
concurrency/idempotency/dedupe as available. If production code changes,
repeat affected Round 2E gates.

## 19. I18N/HISTORY

If frontend production code unchanged, frontend full tests + live UI
proof are sufficient.

Do not reintroduce History. If frontend production code changes, verify
RU/AZ/EN, mixed locale=0, raw enums/keys=0.

## 20. BEFORE/AFTER FAILURE MATRIX

  Test                             Before   Root Cause   Fix   After
  -------------------------------- -------- ------------ ----- -------
  OrderAdapter partner binding     FAIL                        PASS
  BookingAdapter partner binding   FAIL                        PASS

No blank Root Cause/Fix.

## 21. LIVE PROJECTION MATRIX

  Field                          Evidence
  ------------------------------ ----------
  Subject type                   
  Subject ID                     
  Source type                    
  Source ID                      
  Event type                     
  Source created at              
  Activity before                
  Activity after                 
  Activity occurredAt            
  Correct subject                
  Wrong-subject leakage          
  Duplicate rows                 
  Rebuild between create/query   NO
  API proof                      
  Browser proof                  

No blank rows.

## 22. FINAL TEST MATRIX

  Gate                              Previous             Final
  --------------------------------- -------------------- -------
  Backend full                      1234 PASS / 2 FAIL   
  Source Adapter failures           2                    
  Backend TSC                       PASS                 
  Backend build                     PASS                 
  Frontend full                     243/243 PASS         
  Frontend TSC                      PASS                 
  Frontend build                    PASS                 
  Customer Payment regression       PASS                 
  Partner Activity regression       PASS                 
  Live projection without rebuild   evidence gap         

## 23. ROUND 2E REPORT CORRECTION

Current report says the two Source Adapter failures are:

``` text
Relation to Step 3.5.3: Unrelated
```

Correct this.

They are direct Step 3.5.3 test coverage, but expected to be stale
fixtures rather than production defects.

Use equivalent wording:

``` text
Relation to Step 3.5.3:
Direct test coverage of Activity source adapters.
Failure caused by stale fixture not matching canonical sellerPartnerId authority.
Production defect: NO, after repository verification.
```

Preserve historical fact:

``` text
Round 2E initial qualification found 2 stale fixture failures.
Round 2E.1 reconciled them.
```

Do not rewrite history as if Round 2E originally had 0 failures.

## 24. ROADMAP

Round 2E.1 is an acceptance/evidence closure attached to Round 2E, not a
new feature branch.

After PASS additively record:

``` text
Round 2E — Runtime + Security + Backfill/Rebuild Closure
FULLY CLOSED
Final evidence/test closure: <ROUND_2E_1_SHA>

STEP 3.5.3 — CRM COMMUNICATIONS + ACTIVITY TIMELINE
FULLY CLOSED
```

Preserve `990e599` and `2ac80b6`.

## 25. EXACT NEXT

Round 2E report identifies:

``` text
PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION
```

Re-verify against current:

``` text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

If unchanged, report it exactly. Do NOT start Step 3.5A.

## 26. REPORT

Create:

``` text
docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2E_1_FINAL_TEST_FIXTURE_LIVE_PROJECTION_EVIDENCE_CLOSURE_REPORT.md
```

Strictly Russian.

## 27. CHANGE BOUNDARY

Expected changes:

``` text
minimum Source Adapter test/fixture files
Round 2E report correction
Round 2E.1 report
canonical roadmap status/provenance
```

Expected:

``` text
production code = 0
schema = 0
migration = 0
```

Forbidden: new CRM features, Step 3.5A implementation, Partner Workspace
CRM, schema/RBAC/Activity redesign, unrelated cleanup/dependency
upgrades.

## 28. GIT DISCIPLINE

Before staging:

``` bash
git diff --check
git status --short
git diff
```

Stage exact files only. No `git add .` / `git add -A`.

After commit/push:

``` bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Required:

``` text
HEAD == origin/master
```

No force push.

## 29. ACCEPTANCE CRITERIA

VERDICT A only if:

1.  Both original failures verified.
2.  Root cause of each verified.
3.  `Order.sellerPartnerId` authority preserved.
4.  Booking canonical Order Partner authority preserved.
5.  No obsolete items/product inference restored.
6.  No invalid Prisma relation/N+1 workaround.
7.  Both adapter tests PASS.
8.  Assertions not weakened.
9.  No tests skipped to get green.
10. Source Adapter suite 100% PASS.
11. Backend full discovered suite: 0 FAIL.
12. Backend new skipped = 0.
13. Backend TSC/build PASS.
14. Frontend full: 0 FAIL.
15. Frontend TSC/build PASS.
16. Deterministic live event created.
17. No rebuild between create/query.
18. New Activity appears via live projection.
19. Exact sourceId matches.
20. Correct subject matches.
21. Wrong-subject leakage=0.
22. Live duplicate=0.
23. Customer Payment regression PASS.
24. Partner Activity regression PASS.
25. Customer/Partner RBAC regression PASS.
26. History remains removed.
27. Round 2E report wording corrected.
28. Round 2E.1 report created.
29. Roadmap updated additively.
30. Step 3.5.3 FULLY CLOSED only after gates.
31. Exact NEXT reverified.
32. P0=0, P1=0.
33. No unresolved Step 3.5.3 P2 test failures.
34. `git diff --check` clean.
35. Exact staging/commit/push complete.
36. HEAD == origin/master.
37. Step 3.5A not started.

## 30. VERDICT RULE

Success only:

``` text
VERDICT A — PHASE 3 STEP 3.5.3 /
CRM COMMUNICATIONS + ACTIVITY TIMELINE /
ROUND 2E.1 — FINAL TEST FIXTURE + LIVE PROJECTION EVIDENCE CLOSURE /
SOURCE ADAPTER TEST BASELINE ELIMINATION +
DETERMINISTIC LIVE RUNTIME PROOF /
FULLY CLOSED

ROUND 2E — FULLY CLOSED
STEP 3.5.3 — FULLY CLOSED
```

Otherwise:

``` text
VERDICT B — PHASE 3 STEP 3.5.3 /
ROUND 2E.1 — FINAL TEST FIXTURE + LIVE PROJECTION EVIDENCE CLOSURE /
INCOMPLETE
```

No conditional VERDICT A.

## 31. REQUIRED FINAL RESPONSE FORMAT

``` text
VERDICT:

REPOSITORY
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
Worktree:

FAILURE 1 — ORDER ADAPTER
Original failure:
Root cause:
Canonical authority:
Files changed:
Assertion preserved:
Final result:

FAILURE 2 — BOOKING ADAPTER
Original failure:
Root cause:
Canonical authority:
Files changed:
Assertion preserved:
Final result:

SOURCE ADAPTER SUITE
Tests:
Passed:
Failed:
Skipped:

BACKEND FULL
Discovered:
Passed:
Failed:
Skipped:
Previous baseline failures remaining:

LIVE PROJECTION
Subject type:
Subject ID:
Source type:
Source ID:
Event type:
Created at:
Activity before:
Activity after:
Activity occurredAt:
Correct subject:
Wrong-subject leakage:
Duplicates:
Rebuild between create/query:
API proof:
Browser proof:

CUSTOMER PAYMENT REGRESSION:
PARTNER ACTIVITY REGRESSION:
RBAC REGRESSION:

TESTS / BUILDS
Backend TSC:
Backend build:
Frontend TSC:
Frontend build:
Frontend full:

PRODUCTION CODE
Changed:
Why:
Schema:
Migration:

REPORT CORRECTION:
ROUND 2E.1 REPORT:

ROADMAP
Round 2E:
Step 3.5.3:
Exact canonical NEXT:

P0:
P1:
P2:

FILES CHANGED:
COMMIT:
PUSH:
HEAD == origin/master:

NEXT:
```

## 32. STOP

После successful Round 2E.1:

``` text
Round 2E   FULLY CLOSED
Step 3.5.3 FULLY CLOSED
```

**STOP.**

Не начинать `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` без
отдельного задания.
