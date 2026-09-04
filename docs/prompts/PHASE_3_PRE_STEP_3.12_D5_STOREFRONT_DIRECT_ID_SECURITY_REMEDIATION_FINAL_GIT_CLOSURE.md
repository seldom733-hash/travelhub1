# PHASE 3 — PRE-STEP 3.12 — D5 — STOREFRONT DIRECT-ID SECURITY REMEDIATION & FINAL GIT CLOSURE

## ROLE — MANDATORY

Ты работаешь как **Senior/Staff Backend Engineer + Security Engineer + QA Engineer + Release Engineer**.

Это **ТОЛЬКО точечный remediation D5** после Round 4.

Canonical status:

```text
D5 — NOT ACCEPTED
D6 — NOT STARTED

OPEN BLOCKERS:
1. P2 Storefront direct-ID isolation bypass on Order detail
2. P2 Storefront direct-ID history isolation bypass
3. Final Git hard closure not completed
```

Round 4 уже доказал и **НЕ ТРЕБУЕТ повторной реализации**:

```text
TOCTOU / SELECT ... FOR UPDATE
OperationalNote atomic $transaction
FI-1..FI-4 failure injection
traveler browser edit
post-final traveler browser lock
C1 READY_FOR_BOOKING browser state
C6 CANCELLED browser state
OperationalNote CREATE/UPDATE/DELETE browser flows
Storefront list-level filtering
legacy source semantics
source spoofing protection
required D3/D4/D5 regressions
```

**D6 НЕ НАЧИНАТЬ.**

---

# 1. ACTUAL SECURITY DEFECT — CANONICAL

Round 4 created a real Storefront Order and proved:

```text
Platform list query hides Storefront Order ✅

BUT

Platform actor:
GET /orders/{storefrontOrderId}         → 200 ❌
GET /orders/{storefrontOrderId}/history → 200 ❌
browser /app/orders/{storefrontOrderId} → full Order page ❌
```

Root cause identified:

```text
getOrder/detail path does not enforce acquisitionSource/workspace scope
while list query does.
```

This is a real cross-context direct-object-reference / scope-bypass defect.

It is **acceptance-blocking P2 for D5**.

Do NOT reclassify as:

```text
legacy debt
D4 debt
non-blocking
future security hardening
D7
INFO
```

while the bypass still exists.

---

# 2. STRICT SCOPE

Fix only the direct-ID / ID-based Storefront isolation defect and verify adjacent Order ID-based surfaces for the same bypass pattern.

Required work:

```text
S1 — identify canonical scope authority for Order direct-ID access
S2 — fix Order detail direct-ID isolation
S3 — fix Order history direct-ID isolation
S4 — audit other Order ID-based endpoints/actions for same bypass
S5 — add security regression coverage
S6 — repeat exact real Storefront browser direct-ID verification
S7 — final Git hard closure
```

Avoid unrelated refactors.

---

# 3. SECURITY MODEL — REQUIRED SEMANTICS

Canonical workspace/context rule:

```text
PLATFORM Marketplace Order surface
must not expose STOREFRONT orders
through:
- list
- detail by UUID
- history by UUID
- mutations/actions by UUID
- exports/downloads by UUID
- related nested endpoints by Order UUID
```

Security must be enforced **server-side**.

Frontend hiding is not sufficient.

Expected unauthorized cross-context behavior:

```text
404 / canonical not-found
```

Preferred over a distinguishable response that leaks object existence, if this matches existing TravelHub security conventions.

No response body may leak:

```text
reference
customer/traveler
seller
amounts
status
history
notes
existence metadata
```

---

# 4. S1 — IDENTIFY CANONICAL SCOPE AUTHORITY

Inspect current architecture:

```text
workspace context
tenant/partner scope
acquisitionSource
Order query/list filtering
getOrder
history
Order mutations/actions
shared guards/services/repositories
```

Document:

1. where list-level Storefront exclusion currently happens;
2. why direct-ID path bypassed it;
3. the canonical reusable scope predicate/helper to apply;
4. why the fix cannot rely only on frontend route checks.

Avoid duplicating slightly different scope logic across endpoints if a canonical service/repository filter can be reused safely.

---

# 5. S2 — FIX ORDER DETAIL DIRECT-ID ISOLATION

For Platform Marketplace actor:

```text
GET /orders/{existingStorefrontOrderUuid}
```

must return canonical not-found/denial.

Important:

- Do not fetch full object and then merely hide it in frontend.
- Prefer scoped DB lookup / scoped service lookup so unauthorized object is treated as nonexistent.
- Preserve legitimate access for the correct Storefront/Partner context according to existing architecture.
- Preserve normal Platform access to Marketplace Orders.

Required positive/negative matrix:

| Actor/context | Target Order | Expected |
|---|---|---|
| Platform | Marketplace Order | 200 |
| Platform | Storefront Order | 404/denied |
| Correct Storefront context | own Storefront Order | allowed per canonical contract |
| Wrong partner/tenant | another Storefront Order | 404/denied |

If current repository does not yet expose a correct Storefront detail surface, do not invent one; still prove Platform cannot access Storefront.

---

# 6. S3 — FIX ORDER HISTORY DIRECT-ID ISOLATION

For same existing Storefront Order:

```text
GET /orders/{storefrontOrderUuid}/history
```

as Platform actor must return canonical not-found/denial.

History must not reveal:

```text
event count
actor
status transitions
notes
field changes
timestamps
source/context
```

Required matrix mirrors detail access.

---

# 7. S4 — AUDIT OTHER ORDER ID-BASED ENDPOINTS

Search all backend Order routes/services that accept:

```text
orderId
id
uuid
reference-derived object
```

Examples to inspect if present:

```text
detail
history
availableActions
traveler reads
traveler mutations
lifecycle actions
final-confirm
notes
export
attachments/documents
payments/financial subresources
status transitions
cancel/problem/suspend
booking handoff
```

Goal:

```text
find same class of "list scoped, direct-ID unscoped" defect.
```

For each endpoint classify:

```text
SAFE — scope enforced
FIXED — same defect found and remediated
NOT APPLICABLE
```

Do NOT leave another obvious Order IDOR in D5 surface.

If another acceptance-relevant P2 is found, remediate it in this round and report it.

---

# 8. S5 — AUTOMATED SECURITY REGRESSION

Add focused tests proving server-side isolation.

Minimum:

```text
T1 Platform → Marketplace detail = allowed
T2 Platform → Storefront detail = 404/denied
T3 Platform → Storefront history = 404/denied
T4 wrong tenant/partner → Storefront detail = 404/denied
T5 wrong tenant/partner → Storefront history = 404/denied
```

If direct-ID action endpoints share the defect, add tests for each remediated action.

Test must use a **real existing Storefront Order row**, not random nonexistent UUID.

Also confirm:

```text
list-level isolation still PASS
Marketplace detail/history still work
```

---

# 9. S6 — REAL BROWSER RE-VERIFICATION

After code/test fix, reproduce Round 4 with an **existing Storefront Order**.

Record proof:

```text
Storefront Order UUID
reference
acquisitionSource/workspace proof
```

Using Platform ADMIN browser session:

```text
/app/orders/{realStorefrontOrderUuid}
```

Expected:

```text
404 / canonical not-found page
no Storefront Order fields
no data leakage
```

Then same Order history endpoint:

```text
404 / denied
no history leakage
```

Do NOT use:

```text
random UUID
nonexistent fixture
list search only
E2E-only substitute
```

Browser proof is mandatory.

---

# 10. DB / API / UI SECURITY RECONCILIATION

For the same Storefront fixture prove:

```text
DB: Storefront Order EXISTS
API list as Platform: hidden
API detail as Platform: denied/not-found
API history as Platform: denied/not-found
UI direct route as Platform: not-found
```

This is critical:

```text
object must exist in DB
while remaining invisible to unauthorized Platform direct-ID access
```

That proves real isolation rather than nonexistent-object behavior.

---

# 11. SECURITY RE-QUALIFICATION

Re-check:

```text
cross-workspace IDOR
cross-tenant leakage
detail/history existence leakage
mass assignment unchanged
traveler PII unchanged
audit/history auth unchanged
source spoofing unchanged
post-final immutability unchanged
note authorization unchanged
```

Explicitly state whether any adjacent Order ID-based surface had the same defect.

---

# 12. REGRESSION POLICY

Run at minimum:

```text
new Storefront direct-ID security suite
existing D1A / CRM scope isolation suite if relevant
d5-order-fullpage-audit
backend tsc
backend build
frontend tsc
```

If frontend behavior/code changed:

```text
frontend build
frontend vitest
```

If other Order action endpoints were changed, rerun affected D3/D4/D5 suites.

Report exact command + count + result.

Do not claim global regression PASS without executed evidence.

---

# 13. FIXTURE HANDLING

If Round 4 Storefront fixture still exists and is safe to reuse, use it.

Otherwise create isolated Storefront fixture through canonical test/seed/helper mechanism.

Avoid ad-hoc permanent production-like pollution where possible.

Report:

```text
fixture creation method
UUID
reference
workspace/acquisitionSource
cleanup behavior
```

Cleanup must not invalidate already captured evidence.

---

# 14. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D5_STOREFRONT_DIRECT_ID_SECURITY_REMEDIATION_FINAL_CLOSURE_REPORT.md
```

Predominantly Russian.

Required sections:

1. Executive Summary
2. Starting Git State
3. Canonical P2 Finding
4. Root Cause
5. Scope Authority Design
6. Order Detail Fix
7. Order History Fix
8. Other Order ID-Based Endpoint Audit
9. Automated Security Tests
10. Storefront Fixture Evidence
11. Browser Direct-ID Re-Verification
12. DB→API→UI Security Reconciliation
13. Regression Matrix
14. Security Re-qualification
15. Final D5 Acceptance Matrix
16. Git Hard Closure
17. Findings
18. Final Verdict
19. TRUE NEXT

---

# 15. FINAL D5 ACCEPTANCE MATRIX

Do not shorten.

| Gate | Result | Exact Evidence |
|---|---|---|
| Starting Git state verified | | |
| Canonical Storefront P2 reproduced before fix | | |
| Root cause identified | | |
| Server-side scope authority defined | | |
| Platform → Marketplace detail allowed | | |
| Platform → Storefront detail denied/not-found | | |
| Platform → Storefront history denied/not-found | | |
| Wrong tenant/partner Storefront detail denied | | |
| Wrong tenant/partner Storefront history denied | | |
| Existing Storefront DB row used | | |
| Platform list still hides Storefront | | |
| Platform browser direct-ID returns not-found | | |
| Browser shows no Storefront data | | |
| History leaks no Storefront data | | |
| Other Order ID-based endpoints audited | | |
| Any same-class IDORs remediated | | |
| Storefront security regression tests PASS | | |
| D5 order-fullpage regression PASS | | |
| Relevant scope regression PASS | | |
| Backend TSC PASS | | |
| Backend build PASS | | |
| Frontend TSC PASS | | |
| Frontend build/vitest honestly classified if required | | |
| Traveler PII protection preserved | | |
| Post-final immutability preserved | | |
| Note authorization/atomicity preserved | | |
| Source spoofing preserved | | |
| No unresolved P0/P1 | | |
| No unresolved acceptance-blocking P2 | | |
| D6 NOT STARTED | | |
| Report predominantly Russian | | |
| Final git porcelain literally EMPTY | | |
| Final HEAD == origin/master | | |
| One canonical 40-char Final SHA | | |

Any:

```text
FAIL
NOT RUN
NOT PROVEN
acceptance-blocking PARTIAL
```

→ `VERDICT B`.

---

# 16. FINAL GIT HARD CLOSURE

After all code/tests/browser evidence/report:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Commit and push all meaningful artifacts.

Then execute again:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Report literal:

```text
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
<40-char SHA>

$ git rev-parse origin/master
<same 40-char SHA>
```

Required:

```text
HEAD == origin/master: YES
```

One and only one canonical Final SHA in:

```text
Executive Summary
Acceptance Matrix
Git Closure
Final Verdict
```

No placeholders such as:

```text
<to be filled>
<to be recorded>
after commit
```

---

# 17. VERDICT A

Only if P2 direct-ID/history isolation is actually fixed, browser-reverified on an existing Storefront Order, no adjacent acceptance-blocking IDOR remains, and Git closure is complete:

```text
VERDICT A — D5 STOREFRONT DIRECT-ID SECURITY REMEDIATION & FINAL CLOSURE PASSED

D5 — ACCEPTED

FINAL SHA:
<one canonical 40-char SHA>

TRUE NEXT:
D6 — BOOKING FULL-PAGE DETAIL
     + NAVIGATION CONSISTENCY
     + ACTION / STATE-MACHINE CONSISTENCY
     + EDITING / MUTABILITY CONTRACT
     + IMMUTABLE CHANGE HISTORY
     + ENTITY CHANGE AUDIT FRAMEWORK INTEGRATION

D6 IMPLEMENTATION — NOT STARTED
```

Then **STOP**.

---

# 18. VERDICT B

If Storefront detail/history remains accessible, another same-class acceptance-relevant IDOR is found and not fixed, browser proof is missing, or Git closure is incomplete:

```text
VERDICT B — D5 STOREFRONT DIRECT-ID SECURITY REMEDIATION & FINAL CLOSURE FAILED

D5 — NOT ACCEPTED
D6 — NOT STARTED

TRUE NEXT:
D5 SECURITY REMEDIATION CONTINUATION
```

List exact blocker(s).

---

# 19. HARD STOP — NO D6

This round is only:

```text
fix real Storefront direct-ID P2
+
verify adjacent Order ID-based scope
+
real browser re-test
+
final Git closure
```

No Booking implementation.

After final verdict: **STOP**.
