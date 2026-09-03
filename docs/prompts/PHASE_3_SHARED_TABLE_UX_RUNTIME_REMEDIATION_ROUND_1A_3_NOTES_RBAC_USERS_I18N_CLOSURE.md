# PHASE 3 — SHARED TABLE UX RUNTIME REMEDIATION
## ROUND 1A.3 — CRM OPERATIONAL NOTES ACCESS + USERS RESIDUAL I18N CLOSURE

**Targeted closure of the two remaining runtime findings. Final report and final response: Russian.**

## 1. Baseline
After full restart/runtime verification:
- R1 Orders mixed headers — FIXED
- R2 Orders/Bookings Refresh — FIXED
- R3 Orders/Bookings last 3 KPI = 0 — FIXED
- R5 Customer 360 Partners raw/mixed headers — FIXED
- R6 Customer 360 Refunds status filter — FIXED

Still open:
- **A1/A2:** CRM Customers + CRM Partners Operational Notes access denied.
- **B1/B2:** Users cards and table column headers remain not fully localized.

Commits expected in history: `52aa086`, `898a2d6`, `c3dab16`.

## 2. Repository-first
Run:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -80
git diff
git diff --check
```
Do not reset/revert legitimate newer work. Record Repository, Branch, Starting HEAD, origin/master, Worktree.

## 3. Runtime is authority
Source presence, i18n keys, permission constants, tests, or guards are not sufficient. VERDICT A requires actual API + rendered browser proof.

# PART A — OPERATIONAL NOTES RBAC

## 4. Reproduce exact denial
Affected:
- CRM → Customers → Customer 360 → Operational Notes
- CRM → Partners → Partner 360 → Operational Notes

Do not classify 403 as “expected” until canonical role authority is reconstructed.

## 5. Reconstruct canonical authority
Inspect actual repository:
- Operational Notes architecture/reports
- `permissions.constants.ts`
- SecurityService
- RolePermission seeds/migrations
- Operational Notes controller/service
- RBAC E2E
- Platform CRM role matrix

Determine exact roles expected to read/create/update/delete Notes. Do not guess permission codes.

## 6. End-to-end trace
Trace:
```text
authenticated user
→ assigned role(s)
→ Permission rows
→ RolePermission rows
→ effective permission resolver
→ session/auth payload
→ frontend permission set
→ OperationalNotes UI
→ GET/POST/PATCH/DELETE
→ controller/service RBAC
→ parent resolver
→ Customer/Partner parent scope
→ response
```

Classify exact root cause, e.g.:
`MISSING_ROLE_PERMISSION_ASSIGNMENT`, `MIGRATION_NOT_APPLIED`, `STALE_SESSION_PERMISSION_PAYLOAD`, `FRONTEND_PERMISSION_CODE_MISMATCH`, `BACKEND_PERMISSION_CODE_MISMATCH`, `PARENT_SCOPE_DENIAL`, `ROLE_MATRIX_ARCHITECTURE_GAP`, or exact other cause.

## 7. Role matrix
Produce actual matrix:
| Role | CRM Access | Notes Read | Create | Update Own | Delete Own | Admin Override |
|---|---:|---:|---:|---:|---:|---:|
| ADMIN | | | | | | |
| DIRECTOR | | | | | | |
| SALES_MANAGER | | | | | | |
| OPERATOR | | | | | | |
| FINANCE | | | | | | |
| ANALYST | | | | | | |
| MODERATOR | | | | | | |
| MARKETER | | | | | | |
| other actual roles | | | | | | |

## 8. Least privilege
Forbidden fixes:
- grant all Notes permissions to all roles
- remove permission guards
- allow all authenticated users
- frontend-only authorization
- skip parent scope
- universal ADMIN hardcode workaround

Restore intended role matrix only.

## 9. Parent scope
Verify Customer and Partner separately. Authorized Platform CRM role must access in-scope parent. Unauthorized/cross-scope access remains denied. Preserve tenant/workspace isolation.

## 10. Runtime acceptance
For an authorized canonical CRM role:
- Customer 360 Notes GET → 200, notes or valid empty state
- Partner 360 Notes GET → 200, notes or valid empty state
- create works only if role has create permission
- author/timestamp/visibility remain server authoritative

For unauthorized role: GET remains 403 where canonical.

UI states must remain distinct: loading / empty / forbidden / error / data.

## 11. Security regression
Preserve:
- server-authoritative authorUserId/createdAt
- INTERNAL default visibility
- parent-scoped routing
- audit logging
- ownership edit/delete
- ADMIN override where canonical
- pagination
- plain text/XSS safety
- 5000-char limit

## 12. Permission persistence
If persisted Permission/RolePermission data is missing, inspect existing migrations first. Do not edit already-applied migrations if immutable by convention. Add forward migration only if necessary. Report schema and migration changes accurately. If stale session is root cause, fix/document canonical refresh/re-login behavior; no manual browser-storage hacks.

# PART B — USERS RESIDUAL I18N

## 13. Exact scope
User runtime observation after Round 1A.2:
- **cards/top summary area not localized**
- **table column headers not localized**
- Status column values already localized — preserve.

Inspect actual Users page; do not assume card/header inventory.

## 14. Cards
Identify every actual visible card/KPI/summary label and localize:
- RU → Russian
- AZ → Azerbaijani
- EN → English

No hardcoded Russian, mixed locale, raw key, or inappropriate fallback.

## 15. Table headers
Audit every actual sortable and non-sortable header. Localize RU/AZ/EN. Preserve sort behavior and geometry.

Likely concepts may include code, user, status, role, email, last login, registration date, but actual repository is authority.

## 16. Registration date
Preserve:
- data/sort field: `createdAt` if current canonical contract
- RU: `Дата регистрации`
- AZ: correct Azerbaijani translation
- EN: `Registration date`

Do not revert to “Дата создания”.

## 17. Adjacent Users strings
Targeted final audit:
page title/subtitle, cards, search, buttons, status/role filters, All, create, Refresh, headers, role values, status values, registration date, pagination, empty/loading/error, visible tooltips.

Fix only actual gaps. Preserve working StatusBadge localization and existing controls.

## 18. Locale-switch proof
In real browser switch RU → AZ → EN and prove cards + every table header + registration date + status/role values. Raw key or mixed locale = FAIL.

# PART C — REGRESSION

## 19. Preserve user-verified fixes
Smoke only:
- Orders headers
- Orders Refresh
- Bookings Refresh
- Orders KPI
- Bookings KPI
- Customer 360 Partners headers
- Customer 360 Refund filter

Do not redesign them.

## 20. Evidence matrices

### Finding Closure
| ID | Finding | Root Cause | Fix | API Proof | Browser Proof | Status |
|---|---|---|---|---|---|---|
| A1 | Customer 360 Notes denied | | | | | |
| A2 | Partner 360 Notes denied | | | | | |
| B1 | Users cards not localized | | | N/A | | |
| B2 | Users headers not localized | | | N/A | | |

### Notes Authority
| Context | Role | Permission | Parent Scope | HTTP | UI | Expected | Status |
|---|---|---|---|---:|---|---|---|
| Customer | authorized role | | | | | allow | |
| Partner | authorized role | | | | | allow | |
| Customer | unauthorized role | | | | | deny | |
| Partner | unauthorized role | | | | | deny | |

### Users I18N
| Element | Key/Source | RU | AZ | EN | Raw Key? | Mixed? | Status |
|---|---|---|---|---|---:|---:|---|
| every actual card | | | | | | | |
| every actual column | | | | | | | |
| Registration date | | | | | | | |
| Status sample | | | | | | | |
| Role sample | | | | | | | |

### Runtime
| Surface | Actor/Locale | Expected | Actual | Status |
|---|---|---|---|---|
| Customer 360 Notes | authorized CRM role | accessible | | |
| Partner 360 Notes | authorized CRM role | accessible | | |
| Customer 360 Notes | unauthorized role | denied | | |
| Partner 360 Notes | unauthorized role | denied | | |
| Users cards | RU | localized | | |
| Users cards | AZ | localized | | |
| Users cards | EN | localized | | |
| Users headers | RU | localized | | |
| Users headers | AZ | localized | | |
| Users headers | EN | localized | | |

No blank applicable rows.

## 21. Tests
Use/add focused tests as needed:
- authorized CRM role Customer/Partner Notes read
- unauthorized role denied
- parent scope
- create/update/delete semantics unchanged
- Users cards RU/AZ/EN
- Users headers RU/AZ/EN
- Registration date
- critical raw-key absence

Existing tests do not replace browser proof.

## 22. Regression gates
Run:
- Backend TSC
- Backend build
- relevant Notes unit tests
- Notes RBAC E2E
- Frontend TSC
- Frontend build
- Frontend tests

Historical baselines: Frontend 243/243; Operational Notes 99/99. If counts legitimately change, report exact count/reason.

## 23. Out of scope
Do NOT begin:
- STEP 3.5.3 Round 2C
- Manual Sales
- manual Order
- Booking-from-Order
- Payment Methods
- CRM History → Last Activity
- other roadmap stages

## 24. Required report
Create:
`docs/prompts/PHASE_3_SHARED_TABLE_UX_RUNTIME_REMEDIATION_ROUND_1A_3_NOTES_RBAC_USERS_I18N_CLOSURE_REPORT.md`

Report language: Russian.

## 25. Git discipline
Before staging:
```bash
git diff --check
git status --short
git diff
```
Stage exact files only. Never `git add .` / `git add -A`. Commit normally, push normally, never force-push. Verify HEAD == upstream.

## 26. Acceptance criteria
VERDICT A only if:
1. actual current CRM role identified;
2. canonical Notes role matrix reconstructed;
3. exact denial layer proven;
4. authorized Customer Notes works;
5. authorized Partner Notes works;
6. Customer/Partner parent scope preserved;
7. unauthorized role remains denied;
8. read/create/update/delete semantics remain canonical;
9. no guard/bypass weakening;
10. API + browser proof for both Customer and Partner;
11. Users actual cards identified and all localized RU/AZ/EN;
12. every Users table header localized RU/AZ/EN;
13. no raw/mixed locale on audited Users elements;
14. Status values remain localized;
15. roles remain localized where applicable;
16. Registration date remains correct RU/AZ/EN and sorting correct;
17. Users controls not regressed;
18. RU→AZ→EN runtime switch verified;
19. all evidence matrices complete;
20. seven previously user-verified fixes smoke PASS;
21. Backend TSC/build PASS;
22. Notes tests/E2E PASS;
23. Frontend TSC/build/tests PASS;
24. no security regression;
25. no unrelated feature implemented;
26. report in Russian;
27. git diff check clean;
28. committed + pushed;
29. HEAD == origin/master;
30. no unresolved A1/A2/B1/B2 or P0/P1.

## 27. Final response — strictly Russian
Report:
- VERDICT
- Repository / branch / starting & final HEAD / upstream
- user-verified baseline smoke
- Notes root cause and exact denial layer
- role authority matrix
- Notes fix + API/browser proof
- Users i18n root cause/fix
- Users evidence matrix
- runtime matrix
- security regression
- test/build gates
- files changed
- schema/migration/backend/frontend change classification
- report path + commit
- remaining P0/P1/P2
- NEXT

## 28. Verdict rule
Success only:

```text
VERDICT A — PHASE 3 /
SHARED TABLE UX RUNTIME REMEDIATION ROUND 1A.3 /
CRM OPERATIONAL NOTES RBAC + PARENT SCOPE ACCESS +
USERS RESIDUAL RU/AZ/EN I18N /
FULLY CLOSED AND RUNTIME-VERIFIED
```

Otherwise:

```text
VERDICT B — PHASE 3 /
SHARED TABLE UX RUNTIME REMEDIATION ROUND 1A.3 /
NOTES ACCESS OR USERS I18N CLOSURE INCOMPLETE
```

No conditional VERDICT A.

## 29. STOP
After implementation, tests, API proof, browser proof, report, commit and push: **STOP**. Do not start STEP 3.5.3 Round 2C.
