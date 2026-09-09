# PHASE 3 — UI-C17 — EVIDENCE / GIT RECONCILIATION REPORT

## 1. Purpose

Reconcile the UI-C17 qualification report, its evidence artifacts and the actual Git lineage before UI-C18 Git Hard Closure. Task type: closure/reconciliation only — **RBAC behavior not touched** (roles, permissions, RolePermission grants, guards, endpoints, UI authorization, tenant/workspace scope, 156-permission universe — all unchanged; `order.import` not promoted, not removed).

## 2. Input UI-C17 Verdict

```text
VERDICT A — UI-C17 ACCEPTED (docs/reports/PHASE_3_UI_C17_FINAL_RBAC_FULL_MATRIX_REQUALIFICATION_REPORT.md)
Claimed: 156 canonical permissions × 10 roles = 1560 cells, 1560/1560 MATCH,
0 MISSING / 0 EXCESS / 0 UNRESOLVED, 33/33 live probes PASS,
Operator/Partner/Buyer models PASS, full-access-by-default DISPROVEN.
```

## 3. Actual Git State (verified)

```text
HEAD:            d416026916af491e0099e3bc399a6a4c67069ca7
origin/master:   d416026916af491e0099e3bc399a6a4c67069ca7
merge-base:      d416026916af491e0099e3bc399a6a4c67069ca7  → HEAD == origin/master TRUE
git status:      tracked working tree clean; 33 untracked historical process artifacts (class B, known/harmless)
git diff --check: PASS
```

## 4. SHA Reconciliation

Both SHAs independently verified (`git cat-file -t`, `git merge-base --is-ancestor`, file-content hash-compare against live worktree):

```text
a72ed19f56e4b6844733b0c60edef605d2611484 — EXISTS, ancestor of HEAD & origin/master.
  UI-C17 baseline (accepted R1/R2 final; R1/R2 lineage e646f7c→a72ed19). Report §2 is correct as a baseline statement.

88d9c01ae858c81bfc3cd9ecb6acfe7cc26ee7be — EXISTS, ancestor of HEAD & origin/master.
  UI-C17 EVIDENCE COMMIT (message: «ui-c17: final RBAC full-matrix re-qualification — VERDICT A»).
  Content of report+CSV in this commit byte-identical to worktree at verification time.
  Parent: a72ed19. Not HEAD → §32 "FINAL SHA = 88d9c01" was imprecise: it named the evidence commit final.

Resolved canonical lineage (now explicit in §32):
  EVIDENCE COMMIT   = 88d9c01 (report + CSV, content-final)
  DOC/CLOSURE COMMITS = 04c515e, d416026 (SHA-annotations, docs-only)
  FINAL VERIFIED HEAD = d416026916af491e0099e3bc399a6a4c67069ca7 == origin/master
```

Not a contradiction but an imprecision: §2 (baseline) vs §32 (final). Now both statements are exact, with EVIDENCE COMMIT / DOC/CLOSURE COMMITS / FINAL VERIFIED HEAD distinguished explicitly per §7 of the reconciliation prompt.

## 5. Evidence File Verification

Both files tracked, present at HEAD (`git ls-files`):

```text
docs/reports/PHASE_3_UI_C17_FINAL_RBAC_FULL_MATRIX_REQUALIFICATION_REPORT.md
docs/reports/evidence/PHASE_3_UI_C17_RBAC_FULL_MATRIX.csv
```

## 6. CSV Recalculation (independent)

Recalculated from the artifact, not from the report:

```text
rows = 1560 data rows + header            VERIFIED
unique(Role,Permission) = 1560            VERIFIED (no duplicates)
MATCH = 1560                              VERIFIED
MISSING GRANT = 0 / EXCESS GRANT = 0 / UNRESOLVED = 0   VERIFIED
roles in CSV = 10 / permissions = 156     VERIFIED
```

## 7. UI-C17 Report Self-Consistency

- §2 vs §32 SHA statements: reconciled (§4). §32 rewritten to the explicit lineage split; FINAL VERIFIED HEAD/ORIGIN fields added.
- §31 "required tests/TSC/build pass" — corrected to reference §27 fixture non-blockers explicitly (Step 12 requirement: accurate wording, no "every suite green" claim; §26/§27 already distinguished PASS suites from environmental stale-fixture failures occurring **before authorization assertions**).
- §19 `marketing.read` wording — verified compliant (Step 13): "155/156 … 1 zero-ref = marketing.read (документированный page-gate/UI-aggregate код — явное §14 exception)". No controller guard claimed.
- Residual claims re-verified against current repo: `order.import` — DB-only (no migration/seed/`ALL_PERMISSIONS` entry), zero executable path, outside canonical 156, not promoted.

## 8. Production Diff Verification

`git diff --name-only a72ed19..88d9c01` — exactly 2 files:

```text
docs/reports/PHASE_3_UI_C17_FINAL_RBAC_FULL_MATRIX_REQUALIFICATION_REPORT.md
docs/reports/evidence/PHASE_3_UI_C17_RBAC_FULL_MATRIX.csv
```

Production changes = **0**. Annotation commits `04c515e`/`d416026` — docs-only (report annotations). Nothing to classify; no STOP triggered.

## 9. UI-C8 Publication Set Verification

```text
frontend/components/order/OrderActionBar.tsx   — modified (pending C8), NOT in any UI-C17 commit
frontend/lib/commerce-detail-system.spec.tsx   — modified (pending C8), NOT in any UI-C17 commit
frontend/lib/i18n.tsx                          — modified (pending C8), NOT in any UI-C17 commit
```

**Not contaminated.** Diff profile vs baseline unchanged (report states +65/−14). All three remain as tracked-uncommitted work.

## 10. Untracked Artifact Classification

33 untracked files, all **class B (historical process artifacts — PHASE_3 prompts/docs)**; zero class C/D. Known and harmless; may remain untracked. Precise wording: **tracked working tree clean** — repository NOT claimed globally clean.

## 11. Test Claim Reconciliation

Wording now enforces the required distinction (correction applied to §31):

```text
RBAC qualification evidence              = PASS (1560/1560 matrix, 33/33 probes)
specific relevant suites                 = PASS (parity 11/11, restart-persistence 5/5, partner-scope 6/6,
                                                  dashboard 23/23, analytics 19/19, d4-security 10/10,
                                                  d5-isolation 8/8, security unit 7/7, commerce-detail 56/56,
                                                  TSC ×2, frontend build)
known unrelated fixture failures         = NON-BLOCKING (auth-rbac 1, rbac-actions 1, buyer-cabinet 5 —
                                                  POST /products Partner-owner business rule, падение ДО authorization-assertions;
                                                  root-caused live в RBAC Departmental Audit; environmental)
```

Test behavior unchanged — documentation correction only.

## 12. marketing.read Terminology Check

Report states the canonical wording accurately (155/156 executable references; `marketing.read` = documented zero-direct-reference page-gate/UI-aggregate exception; no controller guard claimed). No correction needed.

## 13. RBAC Regression Check

After documentation-only corrections:

```text
rbac-parity.e2e — 11/11 PASS (post-correction run)
```

No role/permission behavior changed; no unexpected security behavior change (STOP condition not triggered).

## 14. Corrections Made

1. §32 — rewritten with explicit `BASELINE / EVIDENCE COMMIT / DOC-CLOSURE COMMITS / FINAL VERIFIED HEAD / FINAL VERIFIED ORIGIN/MASTER` lineage; imprecise "FINAL SHA = 88d9c01" removed.
2. §31 — test-pass wording qualified by §27 fixture non-blockers (no claim of fully green suites).

## 15. Corrections Not Made

- No RBAC/production/test changes (§3 hard rule).
- `order.import` untouched (not promoted, not deleted).
- §2 baseline statement kept (correct as baseline).
- §19/§26/§27 wording kept (already compliant).
- UI-C8 publication set untouched.

## 16. Final UI-C17 Closure State

```text
UI-C17 = CLOSED
Security result: VERDICT A stands — 1560/1560 MATCH independently recalculated from CSV;
production diff in evidence lineage = 0; report self-consistent; lineage unambiguous.
```

## 17. UI-C18 Readiness

```text
UI-C18 = READY
UI-C18 = NOT EXECUTED (in this task)
Gate condition met: VERDICT A — UI-C17 EVIDENCE/GIT RECONCILIATION ACCEPTED
```

## 18. Git State

```text
HEAD:            d416026916af491e0099e3bc399a6a4c67069ca7  (pre-closure-commit verification)
origin/master:   d416026916af491e0099e3bc399a6a4c67069ca7
Tracked diff:    UI-C17 report §31/§32 corrections + this reconciliation report (docs-only)
Untracked:       33 historical process artifacts (class B) — repository NOT globally clean
UI-C8 set:       intact, isolated, uncommitted
```

Post-closure: reconciliation commit (docs-only) pushed; final SHA recorded below in §16a.

## 16a. Final SHA

```text
UI-C17 EVIDENCE COMMIT:  88d9c01ae858c81bfc3cd9ecb6acfe7cc26ee7be
RECONCILIATION COMMIT:   <filled at closure>
FINAL VERIFIED HEAD:     <filled at closure>
```

## 19. Final Verdict

```text
VERDICT A — UI-C17 EVIDENCE/GIT RECONCILIATION ACCEPTED

UI-C17 = CLOSED
UI-C18 = READY (NOT EXECUTED)
```
