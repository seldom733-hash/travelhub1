# PHASE 3 — PRE-STEP 3.12 — D3 — FINAL GIT CLOSURE RECHECK

## ROLE — MANDATORY

Ты работаешь как **Independent Senior Software Architect + Principal Code Reviewer + Git/CI Release Reviewer + QA Engineer** проекта TravelHub.

Это НЕ implementation stage и НЕ разрешение на разработку D4. Твоя задача — независимо проверить и окончательно закрыть только формальное Git/evidence-состояние D3 после D3 Implementation → Strict Review → Request Flow Integration / Final Evidence Closure.

Existing reports являются evidence, но не заменяют фактическую проверку repository state. Не доверяй заявлению `working tree clean`, пока оно не подтверждено Git-командами. Не начинай D4.

## LANGUAGE REQUIREMENT — MANDATORY

Весь report, findings, explanations, conclusions и verdict explanation — преимущественно **на русском языке**. English допустим для Git/CLI commands, paths, SHA, code identifiers и standardized VERDICT strings. Plaintext secrets/passwords/tokens запрещены.

## 1. CONTEXT

Последний D3 Request Flow Integration report заявил `VERDICT A`, и функциональные gates (Request integration, pin at acceptance, traveler count, idempotency, traveler collection, Booking gate, Passenger, security, browser runtime, permanent visual cases) подтверждены.

Но Git closure содержит противоречие: одновременно заявлены `working tree clean` и оставшиеся `pre-existing untracked files`.

Hard contract:

```text
git status --short
→ MUST BE EMPTY
```

Поэтому:

```text
FUNCTIONALLY CLOSED
FORMAL GIT ACCEPTANCE — RECHECK REQUIRED
```

## 2. SCOPE — STRICT

Разрешено: проверить Git state; классифицировать tracked/untracked artifacts; безопасно закрыть disposable artifacts; сохранить meaningful evidence; при необходимости корректно обновить `.gitignore`; commit/push только cleanup/evidence changes; синхронизировать final report/roadmap только для точного closure.

Запрещено: менять D3 business logic; менять Request/Order/Booking lifecycle; начинать D4; исправлять unrelated tests/KPI/CRM/UI; DB reset; удалять meaningful evidence ради пустого status.

## 3. STARTING GIT EVIDENCE — MANDATORY

Сохрани exact output:

```bash
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
git status --short
git status --porcelain=v1
git log -10 --oneline --decorate
git diff --stat
git diff
git diff --cached --stat
git diff --cached
```

## 4. CLASSIFY EVERY DIRTY ENTRY

Если status не пустой, классифицируй **каждую** запись:

```text
TRACKED INTENTIONAL
TRACKED ACCIDENTAL
UNTRACKED MEANINGFUL EVIDENCE
UNTRACKED DISPOSABLE TEMP
UNTRACKED LOCAL-ONLY TOOLING
GENERATED CACHE/BUILD
UNKNOWN — INVESTIGATION REQUIRED
```

Для каждой: `path / origin / phase / needed? / action / reason`.

Нельзя ограничиться формулировкой `pre-existing artifacts`.

## 5. SAFE CLEANUP

Meaningful evidence (`docs/evidence/**`, `docs/reports/**`, canonical architecture/roadmap) не удалять ради clean tree. Если должно храниться — normalize/move/commit.

Disposable `tmp_*`, one-off browser scripts/state/debug dumps/local screenshots, не используемые как evidence, удалить после проверки.

Generated/local-only artifacts можно добавить в `.gitignore` только если правило оправдано и не скрывает meaningful project files.

UNKNOWN не удалять без investigation.

## 6. D3 EVIDENCE PRESERVATION — HARD

Проверить сохранность минимум:

```text
docs/evidence/d3/
docs/evidence/d3rf/
docs/evidence/d3rf/MANIFEST.md
docs/reports/*D3*
COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md
TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Disposable execution scripts сохранять не требуется.

## 7. PERMANENT VISUAL CASES MUST SURVIVE

Git cleanup не должен удалить dev DB cases:

```text
CASE A
Request: MKT-REQ-09000547
Order:   MKT-ORD-09000547
2 OrderTraveler
editable

CASE B
Request: MKT-REQ-09000548
Order:   MKT-ORD-09000548
2 OrderTraveler
Booking: MKT-BKG-00000084
completed/locked
```

После cleanup проверить existence и минимальный API/direct-page smoke. CASE A должен позволять увидеть две traveler cards.

## 8. DO NOT REOPEN D3 FUNCTIONAL WORK

Не переписывай D3 implementation. Только smoke, что cleanup ничего не сломал. Если runtime code не затронут, полный regression повторять не требуется.

## 9. FINAL REPORT SHA CONSISTENCY

Последний report содержит неполный docs commit placeholder:

```text
33cec2f — implementation
…       — docs commit
```

Проверь фактическую Git history. Final report не должен содержать `…`, `TBD`, `pending`, `will be committed` вместо фактического state.

Не создавай self-referential SHA loop. Допустимо документировать implementation SHA, evidence/docs SHA и final repository HEAD через closure addendum/final state корректным способом.

## 10. ROADMAP STATE

После успешного closure roadmap должен недвусмысленно фиксировать:

```text
D3 — ACCEPTED

TRUE NEXT:
D4 — Traveler Security + Representative Data
     + Representative End-to-End Commerce Chain Coverage
```

Не начинай D4.

Preserve:

```text
D5 Orders Full-Page Detail
D6 Bookings Full-Page Detail
D7 Payment/Refund Semantics + Financial Presentation
D8 Global Temporal Visibility
D9 Export Framework Requalification
D10 Partner Performance Attribution
D11 PROJECT-WIDE KPI / STATUS SEMANTICS
    + TOTAL RECONCILIATION AUDIT & REMEDIATION
    + Help / Business Dictionary semantic synchronization
D12 CRM / KPI Drill-down Routing Requalification
D13 Voucher
D14 PRE-STEP 3.12 Final Requalification
STEP 3.12
```

## 11. PRESERVE RECENT UX FINDINGS

Не исправлять сейчас, но сохранить для D5/D6:

```text
ORDER NAVIGATION CONSISTENCY

Current:
Orders registry → MKT-ORD-* → right drawer
Request linked Order → /app/orders/{id}

Canonical D5:
ANY MKT-ORD-* navigation
→ /app/orders/{id}
→ canonical full-page Order Detail
```

```text
BOOKING NAVIGATION CONSISTENCY

Current:
Bookings registry → MKT-BKG-* → right drawer

Canonical D6:
ANY MKT-BKG-* navigation
→ /app/bookings/{id}
→ canonical full-page Booking Detail
```

Drawer допустим только как сознательно отдельный Quick Preview, но обычный click по business identifier должен иметь единый navigation contract.

## 12. PRESERVE BOOKING FILTER FIX

Проверить, что fix `GET /bookings?orderId=X` (explicit orderId AND channel scope, а не overwrite) находится в committed/pushed history и regression test сохранён. Не переоткрывать implementation без evidence.

## 13. FINAL GIT COMMANDS — HARD

После cleanup/commit:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
```

Hard acceptance:

```text
git status --short = EXACTLY EMPTY
git status --porcelain=v1 = EXACTLY EMPTY
HEAD = origin/master
```

Недопустимо: `clean except...`, `only pre-existing...`, `PARTIAL`.

## 14. PUSH — HARD

Если были изменения:

```bash
git push origin master
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

Push должен быть успешен.

## 15. REQUIRED REPORT

Создай:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D3_FINAL_GIT_CLOSURE_RECHECK_REPORT.md
```

Структура:

1. Executive Summary
2. Starting Git State
3. Dirty Entries Inventory
4. Artifact Classification
5. Cleanup Decisions
6. D3 Evidence Preservation
7. Permanent Visual Case Smoke
8. Booking Filter Fix Preservation
9. Report SHA Consistency
10. Roadmap State
11. Recent UX Findings Preservation
12. Files Changed
13. Final Git State
14. Acceptance Matrix
15. Final Verdict
16. TRUE NEXT

## 16. ACCEPTANCE MATRIX

| Gate | Result | Evidence |
|---|---|---|
| Starting Git state captured | | |
| Every dirty entry enumerated/classified | | |
| No meaningful evidence deleted | | |
| Disposable temp safely removed | | |
| `.gitignore` changes justified if any | | |
| D3 Strict Review evidence preserved | | |
| D3RF evidence + manifest preserved | | |
| CASE A still exists | | |
| CASE B still exists | | |
| Traveler UI smoke accessible | | |
| Booking orderId filter fix committed | | |
| Regression test for filter preserved | | |
| Final report has no fake/TBD SHA | | |
| Roadmap says D3 ACCEPTED | | |
| D5 Order navigation finding preserved | | |
| D6 Booking navigation finding preserved | | |
| `git status --short` exactly empty | | |
| `git status --porcelain=v1` exactly empty | | |
| HEAD == origin/master | | |
| Push successful if needed | | |
| Report predominantly Russian | | |

Все PASS требуют concrete evidence.

## 17. VERDICT

Только если все hard gates PASS:

```text
VERDICT A — D3 FINAL GIT CLOSURE RECHECK PASSED
D3 — ACCEPTED
```

Иначе:

```text
VERDICT B — D3 FINAL GIT CLOSURE RECHECK FAILED
D3 REMAINS OPEN
```

Запрещено `PASS except...`, `PARTIAL but accepted`, `functionally enough`.

## 18. TRUE NEXT

Только при VERDICT A:

```text
D3 — ACCEPTED

TRUE NEXT:
D4 — TRAVELER SECURITY + REPRESENTATIVE DATA
     + REPRESENTATIVE END-TO-END COMMERCE CHAIN COVERAGE

D4 NOT STARTED.
```

При VERDICT B:

```text
TRUE NEXT:
D3 GIT/EVIDENCE TARGETED REMEDIATION

D4 NOT STARTED.
```

## 19. STOP RULE

После report + commit/push + final verification:

```text
STOP.
```

Не начинай D4 автоматически.
