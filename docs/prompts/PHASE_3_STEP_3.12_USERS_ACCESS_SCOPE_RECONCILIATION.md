# PHASE 3 — STEP 3.12 — USERS & ACCESS COMPLETION — SCOPE RECONCILIATION

## TASK TYPE
**ARCHITECTURE / SCOPE RECONCILIATION BEFORE IMPLEMENTATION**

Это не Implementation Step. Цель — проверить фактическое состояние repository + canonical roadmap и зафиксировать frozen implementation scope Step 3.12. **DO NOT AUTO-START IMPLEMENTATION.**

## LANGUAGE REQUIREMENT — MANDATORY
Все создаваемые/обновляемые reports и prose documentation должны быть преимущественно **на русском языке**: Scope Reconciliation Report, Gap Audit, findings, root cause analysis, architecture/security decisions, evidence, conclusions, recommendations и verdict explanations.

English разрешён только для technical identifiers: file paths, class/method/DTO/model/table names, API endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, permission identifiers, code snippets и standardized VERDICT strings.

**Hard acceptance:** преимущественно English report = task incomplete.

## 1. CANONICAL STARTING POINT
```text
STEP 3.11 — SUPPORT CENTER UI — CLOSED
Final runtime/browser SHA: 0d68144
Migration: 72/72 applied
R5/R10/R11/R12/R13/R14: CLOSED
R4: CANONICALLY DEFERRED — no eligible-assignee API
Final VERDICT: VERDICT A — STEP 3.11 CLOSED
Canonical NEXT: Step 3.12 — Users & Access Completion
DO NOT AUTO-START
```

## 2. PRE-FLIGHT
Run:
```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -30 --oneline
```
Expected baseline: `0d68144`. Repository state is authority. Do not alter unrelated changes.

## 3. SOURCES TO INSPECT
Read `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`, existing Step 3.12 materials, Prisma schema and actual code for Users/Auth/RBAC/Roles/Permissions/RolePermission/user-specific overrides/workspace scope/audit/user lifecycle/Partner access/future Workforce.

Roadmap prose is not proof of runtime implementation.

## 4. PRIMARY QUESTION
Determine:
```text
What must Step 3.12 complete?
What already exists?
What is partial/missing?
What is technical debt?
What belongs to later stages?
What must not be duplicated?
What minimum architecture makes Users & Access production-safe?
```
Produce a frozen scope for a separate Implementation Prompt.

## 5. CONFIRMED TARGET ACCESS MODEL
Reconcile actual architecture against:
```text
USER
 ↓
PREDEFINED ROLE
 ↓
ROLE DEFAULT PERMISSIONS
 +
EXPLICIT USER PERMISSION GRANTS
 ↓
EFFECTIVE PERMISSIONS
 ↓
SERVER-SIDE AUTHORIZATION
```
Role = baseline profile. Permission = concrete authority. User Grant = additional authority for one user.

## 6. PREDEFINED ROLES
Verify actual canonical role catalog from schema/seed/auth code/tests/runtime/roadmap. Known candidates include:
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
Do not blindly assume this list.

**Do not introduce** `HEAD_OF_SUPPORT`, `HEAD_OF_SALES`, `HEAD_OF_FINANCE`, `HEAD_OF_MARKETING`, `HEAD_OF_MODERATION`.

Do not implement arbitrary custom-role builder unless existing canonical architecture explicitly requires it.

## 7. MANAGEMENT GROUPS / DEPARTMENTS — OUT OF CURRENT SCOPE
Do **not** implement now:
```text
Department
Team
Management Group
Manager
Members
Group 1 / Group 2 / Group 3
department heads
organizational hierarchy
```
Reason: authorization need is solved by role defaults + explicit user grants. Organizational structure is a separate Workforce concern.

Example:
```text
OPERATOR
+ support.case.assign
→ may distribute Support Cases
without a separate manager/head role
```
Future Workforce may own departments, teams, hierarchy, workload and employee performance.

## 8. ROLE ≠ PERMISSION
Avoid role-hardcoded authorization where permission is the real authority:
```text
BAD:  role === DIRECTOR
GOOD: support.case.assign
```
Role supplies defaults; server checks effective permission.

## 9. USER-SPECIFIC ADDITIONAL PERMISSIONS
Audit whether `UserPermission`, `PermissionGrant`, `PermissionOverride` or equivalent exists. If it exists, inspect schema, uniqueness, scope, audit, calculation, session propagation and revoke semantics.

If absent, frozen Step 3.12 scope should include the minimal safe mechanism.

Expected behavior:
```text
OPERATOR + support.case.assign
→ effective permissions include support.case.assign

revoke explicit grant
→ permission disappears unless baseline role provides it
```

## 10. DO NOT OVERENGINEER DENY
If explicit DENY does not already exist, do not add it automatically. Preferred minimal model:
```text
Effective Permissions = Role Default Permissions + Explicit User Grants
```
No complex precedence/policy engine without demonstrated need.

## 11. ROLE DEFAULT PERMISSION MATRIX
Audit every current Role → Permission mapping. Identify over-grants, missing grants, stale permissions, permissions without server enforcement, and new Phase 3 domain permissions (CRM, Communication, Marketing, Support, Users & Access, Finance, Analytics, Command Center).

## 12. SINGLE EFFECTIVE-PERMISSION AUTHORITY
Trace:
```text
login/session/JWT/current-user
→ guards/decorators
→ frontend session
→ sidebar/routes/actions
```
Backend/session/frontend must not calculate incompatible permission sets. Divergence is a finding.

## 13. SERVER AUTHORITY
Frontend hiding is UX, not security. Sensitive actions require API authorization. Verify manual URL/direct fetch/modified frontend cannot bypass permissions.

## 14. ADMIN ACCESS MANAGEMENT
Audit current Settings/Users UI and freeze exact Step 3.12 UI scope. It should ultimately allow authorized administration to:
```text
view users
assign/change base role
view role defaults
grant additional user permission
revoke additional grant
view effective permissions
view/audit access changes
```
Do not build UI in this reconciliation.

## 15. WHO MAY MANAGE ACCESS?
Find canonical permission identifiers such as `users.manage`, `roles.manage`, `permissions.manage`, `access.manage` or equivalents. Sensitive endpoints must use permission authority, not merely frontend visibility. Freeze privilege-management authority.

## 16. PRIVILEGE ESCALATION
Explicitly resolve:
```text
Can an access manager grant a permission they do not possess?
Can a user modify own permissions/role?
Can Partner acquire Platform permission?
Can the last ADMIN be removed/deactivated?
Can self-deactivation lock Platform administration?
What restrictions apply to security-critical permissions?
```
Prefer simple enforceable invariants over unnecessary hierarchy.

## 17. AUDITABILITY
Reuse canonical audit infrastructure. Do not create a duplicate framework. Access events must be recoverable:
```text
role assigned/changed
permission granted/revoked
user activated/suspended/deactivated
```
Record actor, target, action, timestamp and old/new value where applicable. Never log secrets/session material.

## 18. USER LIFECYCLE
Audit actual implementation of:
```text
ACTIVE
SUSPENDED
DEACTIVATED
```
Check schema, login enforcement, active sessions, guards, UI, reason/comment and history. Deactivation ≠ deletion; preserve business history.

## 19. PLATFORM VS PARTNER — HARD BOUNDARY
Platform internal authority ≠ Partner authority. A Partner admin/user must never acquire Platform Support/Finance/Marketing/Moderation/Users & Access permissions, even by crafted API request.

## 20. ENTITLEMENT ≠ BUSINESS CAPABILITY ≠ PERMISSION
Preserve:
```text
IDENTITY
→ WORKSPACE CONTEXT
→ TENANT/PARTNER SCOPE
→ PLAN/ENTITLEMENT
→ BUSINESS CAPABILITIES
→ ROLE/PERMISSIONS
→ AVAILABLE ACTION/DATA/UI
```
Do not collapse these concepts.

## 21. PARTNER/STOREFRONT FUTURE COMPATIBILITY
Do not implement full Partner Workforce unless canonical Step 3.12 requires it. Ensure Platform access design does not block future Storefront Pro Employees/Roles & Permissions. Shared mechanics may be reusable; authority must remain tenant/workspace scoped. Partner ADMIN ≠ Platform ADMIN.

## 22. SUPPORT STEP 3.11 R4 BRIDGE
R4 remains deferred because there is no eligible-assignee API. Do not fake-close it.

Determine whether Step 3.12 can establish reusable authority for later eligible-assignee implementation. Audit candidate criteria such as active Platform user + appropriate effective Support permissions. Do not use all Users as assignees and do not introduce Departments/Groups just for R4.

## 23. MENU / ROUTE PROJECTION
Audit Workspace Shell/sidebar/Settings/direct routes/actions. Permission is authority; menu visibility is only projection. Additional user grants must eventually project correctly after the canonical session refresh mechanism.

## 24. SESSION / PERMISSION REFRESH
Determine exactly when access changes take effect: immediately, token refresh, new session, logout/login, etc. Avoid indefinite stale permissions. Freeze expected runtime behavior.

## 25. DATABASE / MIGRATION AUTHORITY
If later implementation needs schema changes, acceptance must include migration creation/deploy, compatibility, preservation of existing RolePermission data, and **actual DB verification**. Migration file existence alone is insufficient.

## 26. TEST GAP AUDIT
Freeze required tests.

Backend minimum:
```text
role defaults
user grant/revoke
effective union
unauthorized denial
privilege-escalation denial
Platform/Partner isolation
user lifecycle
audit
invalid permission identifiers
```

Frontend minimum:
```text
Users & Access visibility
role display/change
additional grants
effective permissions
permission-aware controls/routes
session refresh behavior
```

Require separate runtime/browser acceptance after implementation/review. Unit tests alone cannot close Step 3.12.

## 27. CURRENT OUT OF SCOPE
Unless canonical evidence requires otherwise:
```text
Department management
Team management
Management Groups
Group 1/2/3
department heads
organizational hierarchy
manager/subordinate tree
employee workload/performance
HR/payroll/shifts/attendance
full Partner Workforce
arbitrary custom-role builder
complex explicit-DENY policy engine
```

## 28. REQUIRED GAP MATRIX
Create at minimum:

| Area | Current State | Canonical Requirement | Gap | Severity | Step 3.12? | Evidence |
|---|---|---|---|---|---|---|
| Role catalog | | | | | | |
| RolePermission | | | | | | |
| User grants | | | | | | |
| Effective permissions | | | | | | |
| Admin UI | | | | | | |
| Server authority | | | | | | |
| Audit | | | | | | |
| User lifecycle | | | | | | |
| Session propagation | | | | | | |
| Platform/Partner isolation | | | | | | |
| Support R4 bridge | | | | | | |
| Tests | | | | | | |

Every conclusion must point to concrete repository evidence.

## 29. REQUIRED ARCHITECTURE DECISIONS
Resolve explicitly:
```text
AD-1  Canonical predefined role catalog
AD-2  Role → default permission authority
AD-3  Whether role defaults are system-fixed or ADMIN-editable
AD-4  User-specific grant storage
AD-5  Effective permission calculation
AD-6  Grant/revoke authority
AD-7  Privilege escalation rules
AD-8  Audit mechanism
AD-9  User lifecycle authority
AD-10 Session/permission refresh
AD-11 Platform vs Partner scoping
AD-12 Step 3.11 R4 dependency/bridge
AD-13 Boundary with future Workforce/Employees
```
Material unresolved decisions block VERDICT A.

## 30. FROZEN IMPLEMENTATION SCOPE
End report with:
```text
STEP 3.12 IMPLEMENTATION — IN SCOPE
1. ...
2. ...

STEP 3.12 — OUT OF SCOPE
1. ...
2. ...

DEFERRED
1. ...
2. ...
```
This becomes authority for the later Implementation Prompt.

## 31. ROADMAP HANDLING
Roadmap may be updated only to record clarified architecture/scope:
```text
additive only
preserve history
no silent renumbering
real commit SHA only
do not mark Step 3.12 implemented/closed
```
Canonical NEXT remains Step 3.12 until separate implementation + review closes it.

## 32. VALIDATION
Run relevant existing tests/type checks sufficient to verify audit assumptions. Do not perform unrelated remediation. Report commands/results/pre-existing failures/new failures.

## 33. REPORT
Create a predominantly Russian report, e.g.:
```text
docs/reports/PHASE_3_STEP_3.12_USERS_ACCESS_SCOPE_RECONCILIATION.md
```
Include:
1. Starting/Final SHA
2. Files/canonical sources inspected
3. Current architecture
4. Role/permission/user-grant findings
5. Effective-permission findings
6. Admin UI findings
7. Security/privilege-escalation findings
8. Audit and lifecycle findings
9. Platform/Partner isolation
10. Support R4 dependency
11. Workforce boundary
12. Gap matrix
13. AD-1..AD-13
14. Frozen implementation scope
15. Deferred scope
16. Validation evidence
17. Roadmap changes
18. Final verdict

## 34. GIT REQUIREMENTS
If docs/roadmap change:
```bash
git status --short
git diff --check
git diff
```
Commit clearly, push `origin/master`, and verify remote SHA. Report Starting SHA, Reconciliation SHA, Final HEAD, origin/master.

## 35. ACCEPTANCE CRITERIA
```text
[ ] repository architecture inspected
[ ] roadmap inspected
[ ] predefined role catalog verified
[ ] no HEAD_OF_* introduced
[ ] no Management Groups/Departments pulled forward
[ ] Role ≠ Permission preserved
[ ] user-specific grants reconciled
[ ] effective-permission authority frozen
[ ] privilege-escalation rules frozen
[ ] audit authority frozen
[ ] lifecycle audited
[ ] Platform/Partner boundary verified
[ ] Support R4 dependency addressed
[ ] future Workforce boundary explicit
[ ] frozen Step 3.12 scope produced
[ ] report predominantly Russian
[ ] Step 3.12 implementation NOT auto-started
```

## 36. VERDICT
Allowed:
```text
VERDICT A — STEP 3.12 SCOPE RECONCILIATION APPROVED — READY FOR IMPLEMENTATION PROMPT
```
or:
```text
VERDICT B — STEP 3.12 SCOPE RECONCILIATION BLOCKED
```
For B list exact blockers. Do not issue A with unresolved material architecture questions.

## 37. STOP CONDITION
After report + permitted documentation commit/push + verdict, **STOP**.

Do not implement Step 3.12, create implementation migrations/UI, change authorization behavior, implement Support R4, or start Step 3.13. Wait for a separate explicit Implementation Prompt.
