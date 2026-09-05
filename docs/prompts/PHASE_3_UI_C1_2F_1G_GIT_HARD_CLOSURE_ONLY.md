# PHASE 3 — UI-C1.2F.1G
## Git Hard Closure Only — Requests Table Sorting + Table-Header Status Filter

## 0. Purpose

Functional implementation for `UI-C1.2F.1G` is already reviewed as functional PASS.

Current blocker is only:

```text
GIT HARD CLOSURE
```

Do not change business logic, UI behavior, sorting/filtering semantics, API contracts, or architecture unless a Git verification reveals a real repository integrity problem.

## 1. Confirmed current state

User-provided repository state:

```text
 M backend/src/modules/order/request.controller.ts
 M backend/src/modules/order/request.service.ts
 M backend/src/shared/sort.ts
 M frontend/app/app/requests/page.tsx
 M frontend/lib/requests-registry.spec.tsx
?? backend/src/modules/order/request-sort.spec.ts
?? backend/src/modules/order/request-sort.ts
?? docs/evidence/c12e/
?? docs/prompts/PHASE_3_UI_C1_2F_1G_REQUESTS_TABLE_SORTING_TABLE_HEADER_STATUS_FILTER_IMPLEMENTATION.md
?? docs/reports/PHASE_3_UI_C1_2F_1G_REQUESTS_TABLE_SORTING_TABLE_HEADER_STATUS_FILTER_REPORT.md
```

```text
HEAD:
8b2415f6160216d7425aaa42feae9c818ea36595

origin/master:
8b2415f6160216d7425aaa42feae9c818ea36595
```

Therefore:

```text
FUNCTIONAL IMPLEMENTATION — PASS
WORKING TREE CLEAN        — FAIL
GIT HARD CLOSURE          — FAIL
```

## 2. Strict scope

Allowed:
- inspect current diff;
- verify no unrelated changes;
- verify no secrets in evidence;
- stage UI-C1.2F.1G files;
- commit;
- push;
- replace report SHA placeholder with actual SHA;
- make final documentation commit if required;
- prove clean/synced repository state.

Forbidden:
- business-logic changes;
- new UI behavior;
- new features;
- unrelated refactors;
- starting another stage.

## 3. Pre-commit integrity

Run:

```bash
git status --short
git diff --check
git diff --stat
git diff -- backend/src/modules/order/request.controller.ts
git diff -- backend/src/modules/order/request.service.ts
git diff -- backend/src/shared/sort.ts
git diff -- frontend/app/app/requests/page.tsx
git diff -- frontend/lib/requests-registry.spec.tsx
```

Inspect untracked:
- `backend/src/modules/order/request-sort.ts`
- `backend/src/modules/order/request-sort.spec.ts`
- `docs/evidence/c12e/`
- implementation prompt
- implementation report

Confirm:
- all belong to UI-C1.2F.1G;
- no unrelated work;
- no tokens/passwords/credentials;
- no sensitive runtime data.

If unrelated changes exist: STOP and report exact files.

## 4. Re-verify relevant qualification

Before commit, rerun repository-native commands for:

```text
Frontend:
- requests-registry
- table-header-filter
- operations-center-shell
- TSC
- build

Backend:
- request-sort.spec
- typecheck
- build
```

If a relevant test newly fails: STOP and report it.

## 5. Stage only stage-owned files

Stage exactly:

```bash
git add backend/src/modules/order/request.controller.ts
git add backend/src/modules/order/request.service.ts
git add backend/src/modules/order/request-sort.ts
git add backend/src/modules/order/request-sort.spec.ts
git add backend/src/shared/sort.ts
git add frontend/app/app/requests/page.tsx
git add frontend/lib/requests-registry.spec.tsx
git add docs/evidence/c12e/
git add docs/prompts/PHASE_3_UI_C1_2F_1G_REQUESTS_TABLE_SORTING_TABLE_HEADER_STATUS_FILTER_IMPLEMENTATION.md
git add docs/reports/PHASE_3_UI_C1_2F_1G_REQUESTS_TABLE_SORTING_TABLE_HEADER_STATUS_FILTER_REPORT.md
```

Then:

```bash
git status --short
git diff --cached --check
git diff --cached --stat
```

No unstaged stage-owned file may remain.

## 6. Implementation commit

Use repository-conventional message, e.g.:

```text
feat(requests): add server-side sorting and header status filter
```

Then:

```bash
git commit -m "<message>"
git rev-parse HEAD
```

Record:

```text
IMPLEMENTATION SHA:
<actual>
```

## 7. Push

```bash
git push origin master
git rev-parse HEAD
git rev-parse origin/master
```

Must match.

## 8. Fix report SHA placeholder

The current report contains:

```text
FINAL SHA: <feat-commit>
```

This placeholder is forbidden in accepted documentation.

Update:

`docs/reports/PHASE_3_UI_C1_2F_1G_REQUESTS_TABLE_SORTING_TABLE_HEADER_STATUS_FILTER_REPORT.md`

Use:

```text
IMPLEMENTATION SHA:
<implementation SHA>

FINAL SHA:
<final repository SHA>
```

If editing the report creates a later documentation commit, the implementation SHA and final SHA will differ. That is valid.

## 9. Documentation closure commit

If report changed:

```bash
git add docs/reports/PHASE_3_UI_C1_2F_1G_REQUESTS_TABLE_SORTING_TABLE_HEADER_STATUS_FILTER_REPORT.md
git diff --cached --check
git commit -m "docs: finalize UI-C1.2F.1G report"
git push origin master
```

## 10. Final literal proof

Mandatory:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
```

Required:

```text
git status --porcelain=v1
→ NO OUTPUT

HEAD
→ <FINAL_SHA>

origin/master
→ <SAME_FINAL_SHA>
```

If implementation and final commits differ:

```bash
git merge-base --is-ancestor <IMPLEMENTATION_SHA> HEAD
```

Expected exit code: `0`.

## 11. Acceptance criteria

PASS only if all are true:

```text
1. all UI-C1.2F.1G files committed
2. no unrelated files committed
3. no sensitive material committed
4. relevant verification passes
5. implementation SHA exists
6. report placeholder removed
7. push succeeds
8. working tree clean
9. HEAD == origin/master
10. implementation SHA is ancestor of final HEAD
```

## 12. Required final response

```text
UI-C1.2F.1G — GIT HARD CLOSURE

IMPLEMENTATION SHA:
<actual>

FINAL SHA:
<actual>

WORKING TREE CLEAN        — PASS
HEAD == origin/master     — PASS
IMPLEMENTATION ANCESTRY   — PASS
REPORT SHA PLACEHOLDER    — REMOVED
PUSH                      — PASS

VERDICT A — UI-C1.2F.1G ACCEPTED
```

If any item fails:

```text
VERDICT B — UI-C1.2F.1G
GIT HARD CLOSURE — FAIL

BLOCKER:
<exact issue>
```

## 13. Stop rule

After Git hard closure: STOP.

Do not start UI-C1.2F.1E, 1F, 1H, 1I, UI-C1.2G, UI-C2, or D8.
