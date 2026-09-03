# PHASE 3 — PRE-STEP 3.12 — D5 — FINAL REMEDIATION CONTINUATION

## ROLE — MANDATORY

Ты работаешь как **Senior/Staff Software Engineer + Software Architect + Backend/Frontend/Database/Security/QA Engineer**.

Твоя задача — выполнить **ТОЛЬКО D5 Final Remediation Continuation** после неуспешной независимой re-qualification предыдущего `D5 Final Remediation & Evidence Closure Report`.

**Не начинать D6.**

Предыдущий D5 Final Remediation Report выдал `VERDICT A`, но acceptance contract не выполнен полностью. Нельзя повторно объявлять `D5 — ACCEPTED`, пока каждый hard gate ниже не будет закрыт реальным code/runtime/test/DB/browser/Git evidence.

Главная цель:

```text
D5 FINAL REMEDIATION REPORT
        ↓
INDEPENDENT RE-QUALIFICATION = FAILED
        ↓
D5 FINAL REMEDIATION CONTINUATION
        ↓
закрытие только оставшихся acceptance blockers
        ↓
FINAL RE-QUALIFICATION
        ↓
только при полном PASS:
D5 — ACCEPTED
```

---

# 1. SCOPE — STRICT

Не переписывать и не переделывать заново то, что уже доказано и не связано с оставшимися blockers.

Уже считается в основном реализованным и не требует redesign без обнаружения фактического дефекта:

```text
Order full-page canonical navigation
server-authoritative availableActions
Order lifecycle state-machine integration
Order audit persistence for new structured source
source spoofing protection for SYSTEM / INTEGRATION
PII-safe Order audit diff
frozen commercial snapshot protection
stable Order history pagination
pre-D5 full-page factual correction
```

Текущий scope ограничен следующими незакрытыми hard gates:

```text
C1 — OperationalNote immutable audit/accountability
C2 — real D4 concurrency / TOCTOU regression
C3 — missing D3/D4/frontend regression evidence
C4 — missing real browser mutation evidence
C5 — legacy OrderHistory source semantics
C6 — final Git hard closure
```

Если при remediation обнаружится новый P0/P1 или acceptance-blocking P2 — зафиксировать, исправить и доказать.

---

# 2. CURRENT FINAL STATUS

До начала работы считать canonical status:

```text
D5 — NOT ACCEPTED
D6 — NOT STARTED

TRUE NEXT:
D5 FINAL REMEDIATION CONTINUATION
```

Предыдущий `VERDICT A` не является canonical acceptance.

---

# 3. STARTING GIT GATE

Перед любыми изменениями выполнить:

```bash
git branch --show-current
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -10 --oneline
```

Зафиксировать:

```text
branch
starting HEAD
origin/master
HEAD == origin?
working tree state
all modified/untracked artifacts
```

Каждый pre-existing modified/untracked artifact классифицировать.

Не удалять meaningful evidence.

---

# 4. ROOT-CAUSE MATRIX — REQUIRED

До remediation создать:

| Blocker | Actual root cause | Architecture impact | Code change required? | Evidence-only? |
|---|---|---|---|---|
| C1 OperationalNote | | | | |
| C2 D4 concurrency | | | | |
| C3 regressions | | | | |
| C4 browser evidence | | | | |
| C5 legacy source | | | | |
| C6 Git closure | | | | |

Запрещено закрывать finding формулировками:

```text
deferred
out of scope
future framework
documented only
covered conceptually
equivalent evidence
```

если hard gate требует implementation/runtime evidence.

---

# 5. C1 — OPERATIONALNOTE IMMUTABLE AUDIT / ACCOUNTABILITY

## 5.1 Problem

`OperationalNote` является mutable business entity и поддерживает:

```text
CREATE
UPDATE
DELETE
```

`createdAt / updatedAt / editedAt` не являются immutable field-change history.

Предыдущая попытка объявить этот finding `deferred` недействительна.

## 5.2 Canonical requirement

Для business-relevant OperationalNote необходимо сохранить accountability:

```text
CREATE
→ immutable creation evidence

UPDATE
→ immutable previous/current change evidence

DELETE
→ immutable deletion/tombstone evidence
```

Минимум:

```text
noteId
parent entity type
parent entity id
eventType
actorId
actorName where allowed
changedAt
source/context
safe changed fields
safe previous representation
safe new representation
reason/comment where applicable
```

## 5.3 Security / data minimization

OperationalNote text может содержать arbitrary free text и потенциальный PII/secrets.

До выбора storage policy сделать short security analysis.

Допустимые модели:

```text
A. immutable note revisions
B. append-only audit events with redacted/truncated safe snapshots
C. hybrid: note revision metadata + safe audit event
```

Не хранить full sensitive plaintext без обоснованной policy.

Не создавать второй семантически несовместимый audit framework.

## 5.4 DELETE semantics

Проверить реальный текущий DELETE.

Если hard delete уничтожает единственное доказательство существования/содержания note — исправить минимально необходимым способом:

```text
soft delete
or
immutable revision before delete
or
tombstone audit event + preserved safe prior representation
```

После DELETE accountability должна сохраняться.

## 5.5 Transactionality

Hard requirement:

```text
note mutation
+
note audit/revision
=
atomic
```

Проверить:

```text
successful CREATE → history exists
successful UPDATE → previous version/history exists
successful DELETE → tombstone/history exists
failed mutation → no false successful audit
```

## 5.6 Authorization and isolation

Сохранить existing RBAC:

```text
operational-notes.read
operational-notes.create
operational-notes.update
operational-notes.delete
```

History/revision visibility должна наследовать parent entity scope.

Проверить tenant/workspace isolation и отсутствие existence leakage.

## 5.7 Required automated tests

Минимум:

```text
OperationalNote CREATE audit/revision
OperationalNote UPDATE previous value/history
OperationalNote DELETE accountability
OperationalNote mutation + audit atomicity
OperationalNote failed mutation → no successful audit
OperationalNote authorization
OperationalNote tenant/workspace isolation
OperationalNote sensitive text policy/redaction
```

---

# 6. C2 — REAL D4 CONCURRENCY / TOCTOU REGRESSION

Предыдущие tests:

```text
final-confirm → traveler edit → 409
double final-confirm → 409
```

полезны, но являются sequential lock/idempotency tests.

Они **не заменяют реальный concurrency/TOCTOU scenario**.

## 6.1 Mandatory race scenario

Нужен реальный controlled interleaving:

```text
T1 starts traveler mutation
T2 final-confirms the same Order
race / interleaving occurs
→ invalid post-final traveler mutation must not commit
```

Или эквивалентный test, который реально создаёт competing transactions и доказывает защиту от race condition.

Простая последовательность вызовов не принимается.

## 6.2 Evidence

Report обязан содержать:

```text
exact test file
exact test name
how interleaving was forced/controlled
command
result
relevant assertion
DB final state
audit final state
```

Проверить:

```text
finalConfirmedAt/state correct
traveler data not illegally changed
no false successful FIELD_CHANGE
transaction locks behave as intended
```

---

# 7. C3 — COMPLETE REQUIRED REGRESSION EVIDENCE

Реально выполнить минимум:

```text
d3-request-flow
d3-traveler-collection
d4-traveler-security
d4-representative-chain
d4-remediation-closure
d5-order-fullpage-audit
```

Если filenames отличаются — найти exact actual suites и указать их.

Также обязательно:

```text
backend tsc
frontend tsc
frontend vitest
backend build
frontend build
```

Для каждого:

| Suite / Gate | Exact command | Tests | Result |
|---|---|---:|---|

Если что-то не запускалось:

```text
NOT RUN
```

а не PASS.

Если `formatPrice` AZN locale mismatch остаётся pre-existing:

```text
346 PASS / 1 known pre-existing FAIL
```

или фактический результат.

Не объявлять весь frontend test suite green, если есть fail.

---

# 8. C4 — REAL BROWSER MUTATION EVIDENCE

API calls сами по себе не являются browser evidence.

Нужно проверить UI runtime через реальный browser flow на актуальном frontend/backend.

## 8.1 Lifecycle mutation

На isolated safe Order:

```text
Orders registry
→ open canonical full-page
→ click "Принять в работу"
→ NEW → IN_PROCESSING
```

Доказать:

```text
UI status changed
API status changed
DB status changed
history event appeared
actor correct
action correct
source correct
hard refresh preserves result
availableActions updated
```

## 8.2 Traveler edit

На pre-final D3 Order:

```text
edit allowed traveler field
→ save
```

Доказать:

```text
UI value
API value
DB value
history field diff
PII masking/redaction
source/context
history refresh after successful save
```

## 8.3 Post-final lock

На final-confirmed Order:

```text
attempt traveler edit
```

Expected:

```text
UI blocks OR controlled server denial
DB unchanged
no successful FIELD_CHANGE
```

## 8.4 Representative C1 / C6

Проверить existing representative cases:

```text
C1 — READY_FOR_BOOKING
C6 — CANCELLED / financial chain
```

Доказать action availability/state-machine consistency.

Не разрушать permanent representative evidence cases.

## 8.5 Storefront isolation

Проверить прямой Platform access к Storefront Order:

```text
/app/orders/{storefrontUuid}
```

Expected:

```text
404 / no existence leakage
```

Также history endpoint должен быть denied/404.

Query `total=0` сам по себе не заменяет direct-ID isolation test.

## 8.6 OperationalNote browser flow

После C1 remediation выполнить:

```text
create note
edit note
delete/soft-delete note
```

Доказать выбранную history/revision policy.

Не должно быть silent loss предыдущей версии.

---

# 9. C5 — LEGACY ORDERHISTORY SOURCE SEMANTICS

## 9.1 Problem

Текущая migration использует:

```sql
source TEXT DEFAULT 'API'
```

и previous report утверждает, что legacy rows получают `API`.

Это может создавать fictional provenance.

Если историческая запись была создана до появления structured source и её реальный source неизвестен, нельзя автоматически утверждать `API`, если это не доказуемо.

## 9.2 Required decision

Провести schema/runtime analysis и выбрать честную backward-compatible модель.

Допустимые варианты:

```text
NULL
LEGACY
UNKNOWN
```

или deterministic derived source **только если источник действительно можно доказать**.

Нельзя использовать fictional backfill ради удобства.

## 9.3 New events

Для новых событий сохранить:

```text
SYSTEM / INTEGRATION → server-derived only
API → server fallback
ORDER_FULL_PAGE / ORDER_QUICK_PREVIEW → validated client provenance only
```

Client не может spoof:

```text
SYSTEM
INTEGRATION
```

## 9.4 Legacy compatibility tests

Обязательно:

```text
old history row remains readable
legacy source represented honestly
no crash
no data loss
API response handles legacy source
UI handles legacy source
pagination remains stable
```

Если schema migration уже применена на dev DB и записала `API` старым rows, разработать безопасную corrective migration only where semantics are provably wrong.

Не делать DB reset.

---

# 10. CROSS-CUTTING ENTITY CHANGE AUDIT FRAMEWORK RE-QUALIFICATION

После C1 и C5 обновить framework так, чтобы semantic contract был единым:

```text
Request future
Order
Booking future
OperationalNote
other auditable mutable business children
        ↓
ENTITY CHANGE AUDIT FRAMEWORK
```

Compatibility matrix:

| Contract | Order | OperationalNote | Booking future | Request future |
|---|---|---|---|---|
| Event type | | | | |
| Actor | | | | |
| Source/context | | | | |
| Safe diff/revision | | | | |
| Transactionality | | | | |
| Immutability | | | | |
| Authorization/scope | | | | |

Нельзя оставлять:

```text
OperationalNote source/context = N/A
OperationalNote immutability = deferred
```

при финальном `VERDICT A`.

---

# 11. DB → API → UI → AUDIT RECONCILIATION

Обязательные reconciliations:

## Lifecycle

```text
DB status
=
API status
=
UI status
=
audit transition
```

## Traveler edit

```text
DB traveler
=
API traveler
=
UI traveler
=
safe audit diff
```

## OperationalNote

```text
current note state
+
immutable previous revision/audit
=
consistent UI/API/DB/history
```

---

# 12. SECURITY RE-QUALIFICATION

После remediation проверить:

```text
tenant/workspace isolation
Storefront→Platform denial
history authorization
source spoofing
legacy source honesty
audit PII
OperationalNote arbitrary text risk
mass assignment
post-final traveler lock
failed mutation false-audit prevention
```

Все negative tests перечислить отдельно.

---

# 13. ARCHITECTURE / ROADMAP SYNC

Проверить и при необходимости additive update:

```text
docs/architecture/ENTITY_CHANGE_AUDIT_FRAMEWORK.md
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Framework doc должен явно определять:

```text
structured source/context
trusted source authority
legacy source behavior
OperationalNote audit/revision policy
DELETE accountability semantics
transactionality
PII/data minimization
authorization/scope inheritance
entity-specific physical storage allowed
```

Roadmap запрещено маркировать:

```text
D5 — ACCEPTED
D6 — NEXT
```

до полного прохождения hard gates и Git closure.

---

# 14. FINAL GIT HARD CLOSURE

После implementation + migrations + tests + browser evidence + reports:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Hard requirements:

```text
working tree EXACTLY EMPTY
HEAD == origin/master
all meaningful code/docs/report/prompt/evidence committed
all commits pushed
final SHA explicitly recorded
```

Фраза:

```text
"will be committed and pushed"
```

не принимается.

Git closure должен быть уже выполнен до final verdict.

---

# 15. REQUIRED REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D5_FINAL_REMEDIATION_CONTINUATION_REPORT.md
```

Report predominantly Russian.

Не хранить secrets, tokens, plaintext passwords или unnecessary sensitive PII.

---

# 16. REPORT STRUCTURE

Минимум:

1. Executive Summary
2. Starting Git State
3. Root Cause Matrix
4. C1 OperationalNote Audit Remediation
5. OperationalNote Security / Data Minimization
6. OperationalNote Transactionality / Delete Semantics
7. C2 Real Concurrency / TOCTOU Evidence
8. C3 Complete Regression Evidence
9. C4 Browser Mutation Evidence
10. C5 Legacy Source Semantics
11. Cross-Cutting Audit Framework Re-qualification
12. DB→API→UI→Audit Reconciliation
13. Security Re-qualification
14. Architecture / Roadmap Sync
15. Findings Closure Matrix
16. Final Acceptance Matrix
17. Git Closure
18. Final Verdict
19. TRUE NEXT

---

# 17. FINDINGS CLOSURE MATRIX

| Blocker | Previous status | Remediation | Evidence | Final status |
|---|---|---|---|---|
| C1 OperationalNote immutable audit | OPEN | | | |
| C2 real concurrency / TOCTOU | OPEN | | | |
| C3 missing regressions | OPEN | | | |
| C4 browser mutation evidence | OPEN | | | |
| C5 legacy source semantics | OPEN | | | |
| C6 Git hard closure | OPEN | | | |

Нельзя ставить PASS без exact evidence.

---

# 18. FINAL ACCEPTANCE MATRIX — HARD GATES

| Gate | Result | Evidence |
|---|---|---|
| Starting Git state classified | | |
| OperationalNote canonical audit policy implemented | | |
| Note CREATE immutable history preserved | | |
| Note UPDATE previous value/history preserved | | |
| Note DELETE does not erase accountability | | |
| Note mutation + audit/revision atomic | | |
| Note failed mutation creates no false success audit | | |
| Note authorization preserved | | |
| Note tenant/workspace isolation preserved | | |
| Note sensitive-text policy verified | | |
| Real D4 concurrency/TOCTOU test PASS | | |
| Concurrency DB final state verified | | |
| Concurrency audit final state verified | | |
| D3 request-flow regression PASS | | |
| D3 traveler collection regression PASS | | |
| D4 traveler security PASS | | |
| D4 representative chain PASS | | |
| D4 remediation closure PASS | | |
| D5 order full-page audit regression PASS | | |
| Backend TSC PASS | | |
| Frontend TSC PASS | | |
| Backend build PASS | | |
| Frontend build PASS | | |
| Frontend vitest honestly classified | | |
| Browser lifecycle mutation PASS | | |
| Browser traveler edit PASS | | |
| Browser post-final lock PASS | | |
| Browser C1/C6 PASS | | |
| Browser Storefront direct-ID isolation PASS | | |
| Browser OperationalNote revision/audit PASS | | |
| DB==API==UI==Audit lifecycle | | |
| DB==API==UI==Audit traveler | | |
| OperationalNote current+history reconcile | | |
| Legacy source semantics honest | | |
| Legacy history preserved/readable | | |
| New structured source persisted | | |
| Source spoofing protected | | |
| Audit pagination stable | | |
| Cross-cutting audit framework unified | | |
| PII/secrets safe | | |
| Architecture doc synchronized | | |
| Roadmap synchronized | | |
| D6 NOT STARTED | | |
| No unresolved P0/P1 | | |
| No unresolved acceptance-blocking P2 | | |
| Report predominantly Russian | | |
| Final worktree EXACTLY EMPTY | | |
| HEAD == origin/master | | |
| Final SHA recorded | | |

---

# 19. VERDICT RULE

## VERDICT A

Допустим **ТОЛЬКО** если каждый hard gate выше имеет `PASS` и exact evidence.

Output:

```text
VERDICT A — D5 FINAL REMEDIATION CONTINUATION PASSED

D5 — ACCEPTED

TRUE NEXT:
D6 — BOOKING FULL-PAGE DETAIL
     + NAVIGATION CONSISTENCY
     + ACTION / STATE-MACHINE CONSISTENCY
     + EDITING / MUTABILITY CONTRACT
     + IMMUTABLE CHANGE HISTORY
     + ENTITY CHANGE AUDIT FRAMEWORK INTEGRATION

D6 IMPLEMENTATION — NOT STARTED
```

---

# 20. VERDICT B

Если хотя бы один acceptance blocker остаётся:

```text
VERDICT B — D5 FINAL REMEDIATION CONTINUATION FAILED

D5 — NOT ACCEPTED
D6 — NOT STARTED

TRUE NEXT:
D5 REMEDIATION CONTINUATION
```

Перечислить exact blockers и evidence.

Нельзя понижать hard gate до:

```text
INFO
DEFERRED
FUTURE
NON-BLOCKING
```

только для получения `VERDICT A`.

---

# 21. NO D6 CODE — HARD STOP

Запрещено:

```text
Booking full-page implementation
Booking audit implementation
D6 UI changes
D6 state-machine changes
```

Допустимы только genuinely shared framework changes, объективно необходимые для закрытия D5 blockers.

---

# 22. STOP RULE

После:

```text
root cause
→ targeted remediation
→ OperationalNote immutable accountability
→ real concurrency
→ complete regressions
→ real browser mutation evidence
→ legacy source correction
→ cross-cutting framework re-qualification
→ DB/API/UI/Audit reconciliation
→ security re-qualification
→ architecture/roadmap sync
→ Git hard closure
→ final verdict
```

**STOP.**

Не начинать D6 даже при `VERDICT A`.

D6 начинается только отдельным prompt.
