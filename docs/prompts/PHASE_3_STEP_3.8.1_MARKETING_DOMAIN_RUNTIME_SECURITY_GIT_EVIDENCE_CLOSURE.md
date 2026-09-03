# PHASE 3 — STEP 3.8.1 — MARKETING DOMAIN RUNTIME / SECURITY / GIT EVIDENCE CLOSURE

## MODE

**EVIDENCE CLOSURE / SECURITY VERIFICATION ONLY.**

This is not a new Marketing implementation step and not the Strict Review.

Current classification:

```text
VERDICT B — STEP 3.8 IMPLEMENTATION EVIDENCE INCOMPLETE
SYSTEM DEFECT: NOT YET ESTABLISHED
IMPLEMENTATION: PRESENT
READY FOR STRICT REVIEW: NOT YET PROVEN
```

Purpose: close the missing runtime, security and Git evidence for Step 3.8.

## 1. HARD SCOPE FREEZE

Do not expand Step 3.8. Do not implement EMAIL/SMS/PUSH transports, consent/preferences, automation/journeys, ad integrations, Marketing UI, Campaign Analytics, or User/Buyer/Partner suspension/deactivation lifecycle.

The future lifecycle `ACTIVE / SUSPENDED / DEACTIVATED + statusReason + statusComment + statusChangedAt + statusChangedBy + StatusHistory` is explicitly OUT OF SCOPE here.

No roadmap amendment in this task.

## 2. PRODUCTION-CODE FREEZE

Start as evidence-only. Do not change production code, Prisma schema/migration, RBAC, API behavior, tests or frontend.

If runtime verification establishes an actual Step 3.8 defect: **STOP. Do not silently repair it.** Return:

```text
VERDICT B — STEP 3.8.1 EVIDENCE CLOSURE FAILED
SYSTEM DEFECT ESTABLISHED
```

with exact reproduction and smallest remediation boundary.

## 3. AUTHORITATIVE BASELINE

Verify repository truth for the Step 3.8 implementation, including:

```text
backend/prisma/schema.prisma
backend/prisma/migrations/20260829112243_marketing_step3_8/migration.sql
backend/src/modules/marketing/marketing.module.ts
backend/src/modules/marketing/marketing.service.ts
backend/src/modules/marketing/marketing.controller.ts
backend/src/modules/marketing/marketing.service.spec.ts
backend/src/app.module.ts
```

Expected domain: `marketing.Campaign`, `marketing.CampaignAudience`, `marketing.CampaignAttribution`.

Do not trust the implementation report blindly.

## 4. GIT PREFLIGHT

Run:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -15 --oneline
```

The original report recorded starting baseline `c9374f8` but omitted the final implementation SHA. Resolve the actual Step 3.8 implementation commit from Git history.

Record:

```text
Step 3.8 starting baseline:
Step 3.8 implementation SHA:
Current HEAD:
origin/master:
HEAD == origin/master:
unrelated dirty state:
```

Do not reset/stash/clean unrelated state.

## 5. REPOSITORY SECURITY AUDIT

Inspect controller/service/DTO validation/permission guards/workspace context/Partner scope/CRM ownership/Order ownership/Booking ownership/Audience criteria/Attribution entity validation.

Build a matrix for Campaign ownership, Audience ownership, Attribution ownership, CUSTOMER/LEAD/ORDER/BOOKING attribution, Audience criteria validation, Platform access, Partner isolation and unauthorized staff.

## 6. CAMPAIGN RUNTIME

Using real authenticated HTTP requests prove Platform create/read/list/update and valid+invalid lifecycle transitions.

For Partner A prove own create/read/list. Create Partner B Campaign and prove Partner A cannot detail/update/transition/delete it. Rejected operations must not mutate foreign state.

## 7. FORGED CAMPAIGN OWNERSHIP

As Partner A attempt to submit any ownership-like accepted fields such as `partnerId`, `ownerId`, `tenantId`, `storefrontId` targeting Partner B.

Persisted ownership must remain server-derived. If forgeable: STOP — SYSTEM DEFECT.

## 8. AUDIENCE RUNTIME — MANDATORY

Create Partner A Audience via `POST /marketing/audiences`; prove 201, MKA-* code, correct Campaign/Partner scope and criteria persistence. Read via campaign audience list and direct audience detail.

## 9. AUDIENCE CROSS-TENANT ISOLATION

Attempt Partner A → create Audience on Partner B Campaign, list Partner B audiences, read Partner B Audience directly. Require controlled denial, no foreign data, no foreign persistence. Runtime + DB/read-back evidence required.

## 10. AUDIENCE CRITERIA SECURITY CONTRACT

Determine actual accepted JSONB criteria contract. Test legitimate criteria and unsupported/arbitrary structures including contact fields, foreign partner IDs and unknown/nested keys.

Establish whether criteria is a controlled validated segmentation contract or unrestricted inert JSON. If arbitrary JSON creates actual query/tenant/disclosure risk: STOP — SYSTEM DEFECT. Otherwise classify precisely; do not invent a defect.

## 11. ATTRIBUTION RUNTIME — MANDATORY

Use real canonical CUSTOMER, ORDER, BOOKING fixtures and LEAD only if a distinct canonical supported entity/path actually exists. For each supported type create attribution and prove correct campaign/entity/Partner scope and exactly-one persistence. Read through campaign attribution list and entity lookup as applicable.

## 12. ATTRIBUTION ENTITY EXISTENCE

Attempt CUSTOMER/ORDER/BOOKING attribution to nonexistent IDs. Require controlled validation/not-found and persistence=0. If arbitrary nonexistent references persist, classify against the actual Step 3.8 contract; do not silently fix.

## 13. ATTRIBUTION CROSS-TENANT SECURITY — HARD GATE

Create Partner A/B, Campaign A/B and canonical Customer/Order/Booking fixtures owned by each side.

As Partner A attempt:

```text
Campaign A → Customer B
Campaign A → Order B
Campaign A → Booking B
```

and LEAD B only if supported canonically.

Require controlled denial, no foreign disclosure, persistence=0. Campaign ownership alone is not sufficient. If any foreign attribution persists: STOP — SYSTEM DEFECT.

## 14. ATTRIBUTION TYPE CONFUSION

Test real IDs with wrong entity types: ORDER+Booking ID, BOOKING+Order ID, CUSTOMER+Order ID. Require controlled denial/validation and persistence=0.

## 15. DUPLICATE ATTRIBUTION

Prove uniqueness `(campaignId, entityType, entityId)` at runtime. First create succeeds; duplicate must produce controlled behavior (409/422/idempotent canonical response per actual contract), never raw 500.

## 16. PLATFORM AUTHORITY RUNTIME

With a real authorized Platform identity prove access to Platform, Partner A and Partner B Campaigns. Inspect authority path. Global access must be permission/workspace-authorized, not accidental `partnerId == null ⇒ omnipotent` behavior. If null scope accidentally grants global access to unauthorized internal identity: STOP — SYSTEM DEFECT.

## 17. UNAUTHORIZED STAFF — HARD GATE

Find an actual internal role without Marketing permission from RolePermission truth. Authenticate and attempt GET/POST Campaign plus an Audience/Attribution endpoint where appropriate. Require repository-standard 403/controlled denial. Code/unit evidence is insufficient.

## 18. PARTNER ENTITLEMENT AUTHORITY

Determine actual Marketplace Basic and Storefront Pro Marketing access from repository truth. Do not invent a Pro gate. Report:

```text
Marketplace Basic access:
Storefront Pro access:
authority used:
```

If behavior contradicts canonical entitlement architecture, classify it without changing it.

## 19. CONTACT DISCLOSURE REGRESSION

With a Marketplace Basic partner and contact-bearing CRM/customer data, verify Marketing responses do not expose email, phone, URL, social handles or raw CRM contact objects through Campaign, Audience, Attribution or entity-attribution lookup responses.

## 20. LIFECYCLE REGRESSION

Prove the actual transition graph, including valid and invalid transitions. At minimum cover DRAFT→SCHEDULED, invalid DRAFT→ACTIVE if contract forbids it, SCHEDULED→ACTIVE, ACTIVE→PAUSED, PAUSED→ACTIVE where allowed, ACTIVE→COMPLETED, COMPLETED→ACTIVE denied, CANCELLED→ACTIVE denied. No rejected transition may mutate status.

## 21. MIGRATION / SCHEMA EVIDENCE

Verify migration applied, marketing schema/tables/constraints/indexes exist, and run established schema drift verification. Do not edit migration/schema.

## 22. REGRESSION TESTS

Run Marketing tests, Communication tests, Backend TSC, and directly relevant existing CRM/security ownership/permission suites discovered during audit. Record exact commands/counts. Do not write new tests in this evidence-only task.

## 23. CLEANUP

Track all Step 3.8.1 runtime fixtures and delete only task-owned data. Prove remaining task-owned Campaigns/Audiences/Attributions and disposable dependent fixtures = 0. If identities cannot safely be deleted, document exactly what remains and why.

## 24. FINDINGS CLASSIFICATION

Use P0/P1/P2/P3/EVIDENCE GAP. Do not turn evidence gaps into PASS or real defects into future improvements.

## 25. REPORT

Update the existing Step 3.8 report or create the repository-standard Step 3.8.1 evidence report. Preserve history and distinguish original implementation evidence from new runtime evidence/findings/cleanup/Git closure.

## 26. GIT CLOSURE

After evidence:

```bash
git status --short
git diff --name-only
git diff
```

Production/test/schema/migration changes are forbidden in this task. Only the evidence report may be task-owned Git change.

Stage only the report, verify cached diff, commit, record real:

```text
Step 3.8 implementation SHA:
Step 3.8.1 evidence closure SHA:
```

Push and prove `HEAD == origin/master`. No placeholders.

## 27. REQUIRED EVIDENCE TABLE

Final report must include runtime/result/persistence/PASS-FAIL rows for:

```text
Platform Campaign create/read
Partner A own Campaign
Partner A → Partner B Campaign
Forged Campaign ownership
Partner A Audience create/read
Partner A → Partner B Audience
Audience criteria validation
CUSTOMER attribution own
ORDER attribution own
BOOKING attribution own
Attribution nonexistent entity
Attribution foreign Customer
Attribution foreign Order
Attribution foreign Booking
Attribution type confusion
Duplicate attribution
Platform global authorized read
Unauthorized staff
Basic contact disclosure regression
Campaign lifecycle transitions
Migration/schema verification
Cleanup
Git closure
```

A code-reviewed-only row cannot be PASS.

## 28. PASS CONDITIONS

PASS requires Campaign/Audience/Attribution runtime authority; cross-tenant isolation; entity existence/type validation; forged ownership protection; unauthorized staff denial; Platform authority; contact-policy regression; lifecycle contract; migration/schema; tests/TSC; cleanup; no unresolved P0/P1/P2; no production/test/schema/migration changes during 3.8.1; real implementation SHA; real evidence SHA pushed; `HEAD == origin/master`.

## 29. PASS VERDICT

Only if every mandatory gate passes:

```text
VERDICT A — STEP 3.8.1 MARKETING DOMAIN RUNTIME / SECURITY / GIT EVIDENCE CLOSURE — PASS
STEP 3.8 READY FOR STRICT REVIEW
```

This does not close Step 3.8. A separate Strict Review is required.

## 30. FAIL VERDICTS

Evidence incomplete:

```text
VERDICT B — STEP 3.8.1 EVIDENCE CLOSURE INCOMPLETE
STEP 3.8 NOT READY FOR STRICT REVIEW
```

Actual defect:

```text
VERDICT B — STEP 3.8.1 EVIDENCE CLOSURE FAILED
SYSTEM DEFECT ESTABLISHED
STEP 3.8 NOT READY FOR STRICT REVIEW
```

Provide exact request, actor, fixture, HTTP result, response, DB persistence/read-back, authority path, severity and minimal remediation boundary. Do not repair it here.

## 31. STOP CONDITION

After PASS: STOP.

Do not execute Strict Review, update roadmap, start Step 3.9, or implement the User/Buyer/Partner suspension/deactivation lifecycle amendment. Next task after PASS is a separate Step 3.8 Strict Review.
