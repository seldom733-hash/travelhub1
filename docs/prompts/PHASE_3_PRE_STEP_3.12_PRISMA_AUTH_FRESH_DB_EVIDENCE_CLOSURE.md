# PHASE 3 — PRE-STEP 3.12 — PRISMA / AUTH FRESH-DB EVIDENCE CLOSURE

## STATUS

**Task type:** Narrow infrastructure evidence closure  
**Starting point:** Auth runtime restored and normal browser login works  
**Auth/runtime restoration SHA:** `17b2bed`  
**Currency Contract:** `VERDICT A — CLOSED`

This task closes only the remaining infrastructure evidence gaps from the previous Prisma/Auth remediation.

Do **not** reopen Currency work and do **not** start unrelated product stages.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и текстовая документация должны быть преимущественно **на русском языке**.

Это относится к:

- Evidence Report;
- Strict Closure Report;
- findings explanations;
- root cause analysis;
- migration analysis;
- security findings;
- runtime evidence descriptions;
- conclusions;
- acceptance matrix explanations;
- verdict explanations.

English допускается только для technical identifiers: file paths, class/method names, API endpoints, HTTP methods/status codes, CLI/Git commands, enums, SQL/code snippets, commit messages и standardized `VERDICT`.

**Hard acceptance criterion:** преимущественно англоязычный отчёт считается незавершённым.

---

# 1. PURPOSE

Previous remediation restored login, but three infrastructure points remained incompletely qualified:

1. fresh isolated DB was described as compatible, but not actually reproduced end-to-end;
2. migration/password behavior for existing admin must be proven safe;
3. disabled/inactive-user authentication behavior must be qualified if part of the current auth model.

This is a **narrow closure task**.

---

# 2. FRESH ISOLATED DATABASE — HARD GATE

Create a genuinely new isolated PostgreSQL database.

Use repository-authoritative setup only:

```text
empty isolated DB
→ repository migrations
→ required seed/bootstrap
→ Prisma validation/generation as applicable
→ backend startup
→ auth API
→ normal browser login if practical
```

Do not use an already migrated database.

Record:

```text
database name:
starting state:
migration count applied:
seed/bootstrap command:
application startup result:
auth result:
cleanup result:
```

The isolated DB must be dropped after evidence is captured unless project test workflow intentionally preserves it.

---

# 3. NO MANUAL SCHEMA PATCHING

For the fresh DB qualification, do not manually add missing columns/tables.

Forbidden as qualification shortcut:

```sql
ALTER TABLE ...
CREATE TABLE ...
UPDATE migration history manually ...
```

unless those statements are part of committed repository migrations.

The goal is to prove:

```text
repository alone
→ reproducible database
```

---

# 4. MIGRATION CHAIN VERIFICATION

Run the actual repository migration chain from empty DB.

Prove:

- migrations apply in order;
- no migration fails;
- no migration depends on local pre-existing state;
- no hidden manual prerequisite exists;
- resulting schema is compatible with current Prisma schema.

Where applicable run:

```text
prisma migrate status
prisma validate
prisma generate
```

or exact project equivalents.

---

# 5. FRESH DB SCHEMA EVIDENCE

After migration, verify at minimum:

```text
security.User
security.Role
security.Permission
security.AuditLog
username column
unique username constraint
_prisma_migrations
```

Also verify any other auth-critical tables/relations required for login.

Report actual counts after bootstrap.

---

# 6. FRESH DB AUTH BOOTSTRAP

Using the canonical seed/bootstrap flow, prove there is a legitimate account that can authenticate.

Do not manually inject an ad hoc user directly into DB solely for evidence unless that direct insert is itself the canonical bootstrap mechanism.

Prove:

```text
valid credentials → 200/session
invalid password → 401
unknown user → 401
```

Do not expose plaintext secrets in the report.

---

# 7. EXISTING ADMIN PASSWORD SAFETY — HARD GATE

Audit the migration introduced during the previous remediation and any related seed/bootstrap logic.

Hard question:

```text
Does applying migrations/bootstrap to an existing populated DB
unconditionally reset the passwordHash of an existing admin?
```

Expected:

```text
NO
```

Prove this with an automated or reproducible test.

Suggested safe test:

```text
1. Create isolated DB with existing admin and known custom password hash.
2. Apply migration/bootstrap path.
3. Verify admin passwordHash is unchanged.
4. Verify existing admin can still authenticate with original password.
5. Verify bootstrap does not overwrite credentials merely because username=admin.
```

If current migration/bootstrap **does** reset an existing admin password, classify as security defect and fix narrowly.

Acceptable patterns may include:

```text
create admin only if absent
seed idempotently without overwriting password
explicit dev-only reset command outside migration path
```

Unacceptable:

```text
every migration/deploy resets admin password to a known default
```

---

# 8. PASSWORD RESET SEPARATION

If a development/demo admin password reset is needed, ensure it is clearly separated from schema migrations.

Preferred conceptual separation:

```text
Schema migration
≠
Credential reset
```

A credential reset should be an explicit administrative/dev action, not an implicit production schema side effect.

Document actual implementation.

---

# 9. DISABLED / INACTIVE USER AUTH

Audit the actual User status model.

Determine whether there are statuses such as:

```text
ACTIVE
DISABLED
INACTIVE
BLOCKED
SUSPENDED
```

or equivalent.

If current auth contract supports disabled/inactive users, prove:

```text
disabled/inactive user
→ valid password
→ authentication denied
```

Do not change role/tenant semantics.

If no such status exists in the current canonical model, report:

```text
N/A — no disabled/inactive auth state in current model
```

with repository evidence.

Do not mark `PASS` without either test or justified N/A.

---

# 10. EXISTING REPRESENTATIVE DB — NON-DESTRUCTIVE CHECK

Do not rebuild the current representative runtime DB.

Perform only a non-destructive verification that:

- current login still works;
- current user count is preserved;
- existing UUIDs remain;
- roles remain;
- Currency Contract remains intact;
- Marketplace/Storefront representative data remain intact.

This task must not reseed or normalize existing business data.

---

# 11. TEST AUTOMATION

Add/retain regression coverage where appropriate.

Minimum desired automated coverage:

### Migration reproduction
```text
fresh empty DB → migrations succeed
```

### Admin preservation
```text
existing admin custom passwordHash → migration/bootstrap → unchanged
```

### Auth
```text
valid login → success
invalid password → denied
unknown user → denied
disabled/inactive user → denied
```

if disabled-state is applicable.

Tests should exercise the actual production migration/bootstrap path where feasible.

---

# 12. SECURITY CHECK

Verify this closure introduces no:

- default-password overwrite on existing admin;
- hardcoded credential reset in schema migration;
- plaintext password/hash exposure in logs;
- auth bypass;
- unknown-user acceptance;
- disabled-user bypass;
- role escalation;
- tenant/workspace escalation.

---

# 13. BUILD / TYPECHECK / TEST STATUS

Run relevant commands and report actual results.

At minimum:

```text
backend typecheck
backend build
backend relevant tests
Prisma validate
Prisma generate
fresh-DB migration test
auth regression tests
frontend typecheck
```

If frontend typecheck still fails due the known unrelated `storefrontSessions` issue, report:

```text
Global frontend typecheck: FAIL
Infrastructure closure scope: PASS/FAIL
Known unrelated blocker: storefrontSessions ...
```

Do not convert the global command into PASS.

---

# 14. ROADMAP

Update the canonical roadmap additively.

Record:

```text
Prisma/Auth Fresh-DB Evidence Closure
```

with:

- fresh DB reproduction result;
- admin password preservation result;
- disabled-user auth qualification;
- real final SHA.

Do not change Currency Contract status; it remains closed.

---

# 15. GIT / SHA EVIDENCE

Report:

```text
Starting SHA:
Closure implementation/evidence SHA:
Final HEAD:
origin/master:
HEAD == origin:
Working tree clean:
```

If no source fix was needed and only evidence/report changed, state that explicitly.

Commit/push any intended repository changes.

---

# 16. ACCEPTANCE MATRIX

| Gate | Result |
|---|---|
| Fresh isolated DB created from empty state | PASS/FAIL |
| Full migration chain applied | PASS/FAIL |
| Fresh DB schema matches Prisma | PASS/FAIL |
| Prisma validate | PASS/FAIL |
| Prisma generate | PASS/FAIL |
| Seed/bootstrap succeeds | PASS/FAIL |
| Backend starts on fresh DB | PASS/FAIL |
| Valid auth succeeds on fresh DB | PASS/FAIL |
| Invalid password denied | PASS/FAIL |
| Unknown user denied | PASS/FAIL |
| Existing admin password preserved by migration/bootstrap | PASS/FAIL |
| No unconditional admin password reset | PASS/FAIL |
| Disabled/inactive auth behavior qualified | PASS/FAIL/N/A |
| Existing representative DB remains intact | PASS/FAIL |
| Existing runtime login still works | PASS/FAIL |
| Currency Contract preserved | PASS/FAIL |
| Marketplace/Storefront data preserved | PASS/FAIL |
| Backend typecheck/build/tests | PASS/FAIL |
| Frontend typecheck actual status reported | PASS/FAIL |
| Roadmap updated | PASS/FAIL |
| Git synchronized | PASS/FAIL |

---

# 17. REQUIRED FINAL REPORT STRUCTURE

Отчёт преимущественно на русском:

```text
1. Executive Summary
2. Starting Repository State
3. Fresh Isolated DB Creation
4. Migration Chain Evidence
5. Fresh DB Schema Evidence
6. Seed / Bootstrap Evidence
7. Fresh DB Auth Evidence
8. Existing Admin Password Preservation Audit
9. Credential Reset Separation
10. Disabled / Inactive User Auth Qualification
11. Existing Runtime DB Non-Destructive Verification
12. Security Regression
13. Tests / Build / Typecheck
14. Canonical Roadmap Update
15. Git / SHA Evidence
16. Residual Gaps
17. Acceptance Matrix
18. Final Verdict
```

---

# 18. VERDICT RULES

## VERDICT A — INFRASTRUCTURE CLOSURE COMPLETE

Allowed only when:

```text
empty DB
→ migrations
→ bootstrap
→ backend
→ auth
```

is actually reproduced;

existing admin credentials are not silently overwritten by migration/bootstrap;

disabled/inactive auth is tested or truthfully proven N/A;

existing representative runtime remains intact;

Git is synchronized.

## VERDICT B — CLOSURE INCOMPLETE

Required if any hard gate remains unverified.

Do not use:

```text
VERDICT A — с оговорками
```

for an unresolved hard gate.

---

# 19. STOP CONDITION

After this closure:

**STOP.**

Do not automatically start:

- Reference Number Strict Review;
- GMV / Financial KPI Drill-down;
- Cross-Entity Business Reference & Traceability;
- Booking KPI Semantics Audit;
- Finance Center;
- Final PRE-STEP 3.12 Re-Qualification;
- Step 3.12.

Return the report for independent review.
