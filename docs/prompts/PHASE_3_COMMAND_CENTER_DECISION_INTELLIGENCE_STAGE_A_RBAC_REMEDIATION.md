# PHASE 3 — COMMAND CENTER DECISION INTELLIGENCE
## STAGE A — GRANULAR RBAC REMEDIATION AND SERVER-SIDE SECTION AUTHORITY

### STATUS

**Implementation stage.**

This stage is narrowly scoped to restoring and extending granular Command Center RBAC for the current 8-section V3 model.

Do **not** implement Decision Signals, WHY, IMPACT, ACTION, AI changes, Storefront billing, or UI redesign in this stage.

---

# 1. CONTEXT

The architecture reconciliation returned:

```text
VERDICT B — ARCHITECTURE REMEDIATION REQUIRED
```

Confirmed findings:

```text
1. RBAC Regression — CONFIRMED
2. Decision Loop — MISSING
3. Storefront Revenue — NOT PROVABLE
4. AI Decision Feed — HARDCODED
5. Needs Attention — COUNTERS ONLY
```

This stage addresses **only Finding #1**.

The current Command Center has 8 sections:

```text
executive
operational
financial
marketplace
catalog
channels
attention
insights
```

A previous security architecture established the principle:

```text
analytics.read
=
page-level access

dashboard.<section>.read
=
section-level server-side authority
```

Recent V3 work regressed this by mapping all 8 sections to:

```text
analytics.read
```

This effectively allows users with page access to see every section.

Examples observed:

```text
FINANCE can see unrelated sections
MARKETER can see Financial
```

This violates the established server-side section authority model.

---

# 2. OBJECTIVE

Restore granular server-side authorization for all current Command Center sections.

Target conceptual model:

```text
analytics.read
→ permits access to Command Center page/API

dashboard.executive.read
→ Executive Summary

dashboard.operational.read
→ Operational Activity

dashboard.financial.read
→ Financial

dashboard.marketplace.read
→ Marketplace

dashboard.catalog.read
→ Catalog Health

dashboard.channels.read
→ Channel Health

dashboard.attention.read
→ Needs Attention

dashboard.insights.read
→ AI Decision Feed
```

Use repository naming conventions if canonical permission names differ.

The backend must be the authority.

Frontend visibility must reflect backend authorization but must never substitute for it.

---

# 3. NON-NEGOTIABLE SECURITY PRINCIPLE

Preserve:

```text
frontend hidden ≠ authorization
```

Required chain:

```text
Authenticated actor
↓
analytics.read page gate
↓
section-specific permission resolution
↓
backend section filtering / denial
↓
authorizedSections / availableSections
↓
frontend rendering
```

A user must not be able to obtain unauthorized section data by:

- modifying frontend state;
- manually calling API endpoints;
- changing saved layout;
- changing widget IDs;
- requesting trends directly;
- using legacy widget IDs;
- manipulating query parameters.

---

# 4. AUDIT BEFORE MODIFYING

Before changing code, inspect the actual current HEAD.

Locate:

```text
SECTION_PERMISSION_MAP
ALL_SECTIONS
METRIC_SECTION_MAP
page permission gate
workspace/page registry
role defaults
permission seed
admin override model
Command Center API
trend endpoint authorization
frontend authorizedSections logic
saved layout handling
widget registry
```

Report the exact current mappings.

Do not assume the architecture report is sufficient.

---

# 5. RESTORE SECTION PERMISSIONS

The existing 4 granular permissions should be reused if they already exist:

```text
dashboard.executive.read
dashboard.operational.read
dashboard.financial.read
dashboard.marketplace.read
```

Add permissions for the new sections only if they do not already exist:

```text
dashboard.catalog.read
dashboard.channels.read
dashboard.attention.read
dashboard.insights.read
```

Do not create duplicate permission concepts.

If different canonical names already exist, use those and document the mapping.

---

# 6. PAGE GATE

Command Center page/API access must continue to require:

```text
analytics.read
```

or the existing canonical page permission if repository evidence shows otherwise.

But `analytics.read` must NOT automatically grant all sections.

Required semantics:

```text
analytics.read
+
zero section permissions
=
page/API accessible according to existing contract,
but no unauthorized section payload
```

If the existing system instead intentionally denies the entire request when no section permission exists, preserve the canonical contract and document it.

Do not silently redefine behavior.

---

# 7. ROLE DEFAULT MATRIX

Audit and restore safe defaults for these internal roles:

```text
ADMIN
DIRECTOR
ANALYST
MARKETER
FINANCE
MODERATOR
SALES_MANAGER
OPERATOR
```

Do not assume all roles require Command Center access.

Previous architecture established that `analytics.read` should not be universally granted.

Preserve existing authority where valid.

Create an explicit matrix:

| Role | analytics.read | Executive | Operational | Financial | Marketplace | Catalog | Channels | Attention | Insights |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|

Use repository history/current architecture to restore intended defaults.

Do not invent broad access merely to make tests pass.

Important:

```text
ADMIN
```

may have full default access.

Other roles must have differentiated defaults.

Admin-granted permission overrides must continue to work.

---

# 8. ADMIN OVERRIDE / CUSTOM ROLE AUTHORITY

The project previously established:

```text
Admin can grant permissions to roles.
```

Verify that the new section permissions participate in the same persisted role/permission system.

Do not hardcode access purely by role enum.

Correct model:

```text
role defaults
+
persisted permission assignments / admin overrides
→ effective permissions
```

If the current repository has a canonical permission resolver, use it.

---

# 9. BACKEND SECTION FILTERING

Update the canonical section mapping.

Expected conceptual result:

```ts
SECTION_PERMISSION_MAP = {
  executive: "dashboard.executive.read",
  operational: "dashboard.operational.read",
  financial: "dashboard.financial.read",
  marketplace: "dashboard.marketplace.read",
  catalog: "dashboard.catalog.read",
  channels: "dashboard.channels.read",
  attention: "dashboard.attention.read",
  insights: "dashboard.insights.read",
}
```

Do not copy this blindly if repository conventions differ.

Unauthorized sections must not be computed if avoidable.

Especially ensure sensitive/read-heavy section sources are not called for unauthorized users.

Examples:

```text
Financial reconciliation
Channel revenue
AI/insight read models
Needs Attention details
```

No unauthorized data should be calculated and then merely removed at the frontend.

---

# 10. TREND / METRIC AUTHORITY

Audit:

```text
METRIC_SECTION_MAP
```

Metrics must inherit the permission of their owning section.

Examples:

```text
financial metrics
→ dashboard.financial.read

marketplace customer metrics
→ dashboard.marketplace.read
```

If V3 section metrics have trend endpoints, map them correctly.

Unknown metric behavior and unauthorized metric behavior must remain distinct.

Preferred existing semantics if already canonical:

```text
unknown metric → 404
known but unauthorized metric → 403
```

Preserve the current contract.

---

# 11. FRONTEND AUTHORIZED SECTIONS

Frontend must use server-authoritative section availability.

Audit:

```text
authorizedSections
availableSections
hasSection()
sectionPositions
defaultWidgets
saved layouts
legacy widget IDs
```

Requirements:

- unauthorized sections must not render;
- saved layouts must not resurrect unauthorized widgets;
- backward-compat widget mappings must not bypass authorization;
- V3 sections must render when authorized even if they are not represented in legacy WIDGET_MAP;
- legacy `partners` / `customers` mappings must remain compatibility-only and must not widen permissions.

Do not redesign UI.

---

# 12. REQUIRED ROLE BEHAVIOR TESTS

Add/update unit and E2E coverage.

At minimum verify:

## ADMIN

Expected full access by default unless repository authority says otherwise.

## MARKETER

Must NOT receive Financial merely because `analytics.read` exists.

Verify intended Marketplace / Insights / other permissions from canonical role defaults.

## FINANCE

Must NOT receive unrelated Marketing/Catalog/Marketplace sections unless explicitly granted.

Must receive Financial if intended by role defaults.

## ANALYST

Verify intended access from canonical architecture.

## OPERATOR

Verify operational/attention access if intended.

## User with page permission but no section permissions

Must not receive any unauthorized section payload.

## Explicit permission override

A role/user granted a section permission by admin must receive that section.

A revoked permission must remove it.

---

# 13. NEGATIVE SECURITY TESTS

Mandatory tests must prove:

```text
analytics.read alone
≠ all sections
```

Also prove:

```text
frontend widget/layout manipulation
≠ backend authority
```

Where practical, test direct API requests.

Include:

- unauthorized Financial section;
- unauthorized Channel Health;
- unauthorized AI/Insights;
- unauthorized trend metric;
- user with zero section rights;
- admin override grant;
- admin override revoke.

---

# 14. NO DECISION INTELLIGENCE IMPLEMENTATION YET

Do NOT implement during Stage A:

```text
DecisionSignal
WHY attribution
Impact scoring
Severity engine
Action routing
Needs Attention queue
AI Decision Feed redesign
Storefront subscription payment ledger
Storefront revenue semantic changes
```

These belong to later stages.

The only permitted non-RBAC changes are minimal compatibility fixes required to keep the current Command Center functional after authorization is restored.

---

# 15. NO UNRELATED REFACTORING

Do NOT:

- redesign Command Center;
- change KPI formulas;
- change Analytics semantics;
- change period resolver;
- change currency logic;
- change GMV/Revenue definitions;
- change Storefront pricing;
- change seed data;
- rewrite workspace architecture;
- modify Booking/Order/Finance business workflows.

---

# 16. REQUIRED TEST GATES

Run the repository-appropriate gates.

At minimum:

```text
Backend unit tests
Dashboard service tests
RBAC/permission tests
Command Center E2E
Backend TypeScript/build
Frontend tests affected by authorization
Frontend TypeScript/build
```

If the repository has a broader canonical CI suite, run it where feasible.

Do not claim PASS without actual execution evidence.

---

# 17. REQUIRED DELIVERABLE A — BEFORE/AFTER MATRIX

Return:

| Section | Before permission | After permission | Default roles | Server-side enforced |
|---|---|---|---|---|

Also include page gate separately.

---

# 18. REQUIRED DELIVERABLE B — ROLE MATRIX

Return the final effective default role matrix:

| Role | Page | Executive | Operational | Financial | Marketplace | Catalog | Channels | Attention | Insights |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|

Clearly distinguish:

```text
default role permissions
vs
admin-granted overrides
```

---

# 19. REQUIRED DELIVERABLE C — FILES CHANGED

List exact files changed and why.

For each:

```text
file
change
security effect
```

---

# 20. REQUIRED DELIVERABLE D — TEST EVIDENCE

Return actual results:

```text
Backend unit:
Dashboard service:
RBAC:
E2E:
Backend TSC:
Backend build:
Frontend tests:
Frontend TSC:
Frontend build:
```

Include counts where available.

Do not summarize failed tests as PASS.

---

# 21. REQUIRED DELIVERABLE E — SECURITY CONFIRMATION

Explicitly confirm or deny:

```text
analytics.read no longer grants all 8 sections.
Each section has independent server-side authority.
Unauthorized section data is not returned.
Unauthorized trend metrics are denied.
Saved layouts cannot bypass authority.
Legacy widget IDs cannot bypass authority.
Admin-granted permissions still work.
Role defaults remain differentiated.
```

---

# 22. VERDICT

Return exactly one:

## VERDICT A — STAGE A COMPLETE

Only if:

- granular section permissions are restored for all 8 sections;
- server-side enforcement is proven;
- role defaults are differentiated;
- admin override semantics are preserved;
- tests pass;
- no unrelated behavior was changed.

## VERDICT B — REMEDIATION REQUIRED

Use if implementation exists but one or more Stage A requirements remain incomplete.

## VERDICT C — BLOCKED

Use only if a foundational repository constraint prevents correct RBAC implementation.

State the exact blocker.

---

# 23. STOP CONDITION

After Stage A is complete:

**STOP.**

Do not proceed automatically to Stage B.

Do not implement Decision Signal Foundation yet.

Return the Stage A report and wait for review.
