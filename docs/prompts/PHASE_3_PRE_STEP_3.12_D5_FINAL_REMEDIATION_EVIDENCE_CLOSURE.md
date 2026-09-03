# PHASE 3 — PRE-STEP 3.12 — D5 — FINAL REMEDIATION & EVIDENCE CLOSURE

## ROLE — MANDATORY

Ты работаешь как **Senior/Staff Software Engineer + Software Architect + Backend/Frontend/Database/Security/QA Engineer**.

Твоя задача — выполнить **ТОЛЬКО D5 Final Remediation & Evidence Closure** после D5 Strict Review.

Не начинай D6.

Existing code, D5 Implementation Report и D5 Strict Review Report являются evidence, но не canonical business truth. Перед изменениями установить root cause каждого finding и проверить реальное состояние Code → DB → API → UI → Runtime → Audit → Git.

Главная цель:

```text
D5 IMPLEMENTATION
        +
D5 STRICT REVIEW
        ↓
закрытие оставшихся architecture/evidence gaps
        ↓
D5 FINAL REQUALIFICATION
        ↓
только при полном PASS:
D5 — ACCEPTED
```

Запрещено выдавать `VERDICT A`, если хотя бы один hard gate не доказан runtime/test/DB evidence.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose documentation должны быть преимущественно **на русском языке**:

- Remediation Report;
- Evidence / Runtime Report;
- findings;
- root cause analysis;
- architecture decisions;
- security conclusions;
- test descriptions;
- verdict explanations;
- recommendations.

English допустим только для technical identifiers: paths, class/method/DTO/model/table names, API endpoints, HTTP methods/status codes, CLI/Git commands, enums, permission identifiers, code snippets и standardized VERDICT strings.

Если итоговый report преимущественно английский — task incomplete.

Не сохранять plaintext passwords, tokens, secrets или full sensitive PII в reports/evidence.

---

# 1. CONTEXT

D5 должен закрыть:

```text
ORDER FULL-PAGE DETAIL
+ NAVIGATION CONSISTENCY
+ ACTION / STATE-MACHINE CONSISTENCY
+ EDITING / MUTABILITY CONTRACT
+ IMMUTABLE CHANGE HISTORY
+ CROSS-CUTTING ENTITY CHANGE AUDIT FRAMEWORK
```

D5 Strict Review подтвердил большую часть implementation, но final acceptance пока блокируется архитектурными/evidence gaps.

Strict Review также установил factual correction:

```text
pre-D5 /app/orders/{id} EXISTED
```

D5 не создал full-page с нуля — он расширил существовавшую страницу и сделал её canonical operational detail.

---

# 2. CURRENT FINDINGS TO CLOSE

Обязательно закрыть следующие вопросы.

## D5-R1 — STRUCTURED AUDIT SOURCE / CONTEXT

Текущее состояние:

```text
AUDIT_SOURCES constants exist
OrderHistory.source does not exist
source inferred from action/comment
ORDER_FULL_PAGE vs ORDER_QUICK_PREVIEW cannot be deterministically distinguished
```

Strict Review одновременно признал claim `source/context captured` только PARTIALLY CONFIRMED.

Это несовместимо с canonical audit contract.

## D5-R2 — OPERATIONAL NOTE CHANGE HISTORY

`OperationalNote` — отдельная mutable entity с CREATE / UPDATE / DELETE.

Текущие:

```text
createdAt
updatedAt
editedAt
```

не являются immutable field-change history.

Нужно определить и реализовать canonical audit policy для изменения/удаления operational notes либо доказать и документировать иной canonical contract, не противоречащий правилу Entity Change Audit Framework.

## D5-R3 — D4 CONCURRENCY EVIDENCE GAP

Strict Review acceptance matrix указал D4 concurrency PASS, но evidence ссылался на Storefront isolation test.

Это не concurrency test.

Нужно выполнить реальный D4 TOCTOU/concurrency regression.

## D5-R4 — D3/D4 REGRESSION EVIDENCE GAP

Нужно реально выполнить required D3/D4 suites, а не выводить общий PASS из части D5 tests.

## D5-R5 — INCOMPLETE BROWSER MUTATION EVIDENCE

Нужно выполнить обязательный runtime/browser mutation flow, а не только page rendering/navigation.

## D5-R6 — PRE-D5 FULL-PAGE FACTUAL CORRECTION

Исправить implementation/report documentation:

```text
FALSE:
full-page Order detail did not exist before D5

TRUE:
full-page existed before D5 and was expanded/requalified by D5
```

---

# 3. STARTING GIT GATE

Перед изменениями:

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
starting HEAD
origin/master
working tree
```

Если worktree содержит artifacts от Strict Review — классифицировать каждый.

Не удалять meaningful project evidence.

---

# 4. ROOT-CAUSE FIRST

До remediation создать root-cause table:

| Finding | Actual root cause | Architecture impact | Code change required? | Evidence-only? |
|---|---|---|---|---|

Не исправлять symptoms без понимания причины.

---

# 5. CANONICAL ENTITY CHANGE AUDIT CONTRACT

Зафиксировать единый cross-cutting contract:

```text
Request
Order
Booking
Operational child entities where mutable business state matters
        ↓
ENTITY CHANGE AUDIT FRAMEWORK
```

Каждое successful auditable изменение должно иметь минимум:

```text
entityType
entityId
eventType
actor
changedAt
source/context
field(s) where applicable
oldValue where safe
newValue where safe
reason/comment where applicable
```

Для lifecycle event:

```text
previousState
newState
businessAction
```

Для sensitive values:

```text
masked/redacted representation
```

Никакого full sensitive plaintext в audit.

---

# 6. D5-R1 — STRUCTURED SOURCE/CONTEXT REMEDIATION

## 6.1 Canonical requirement

`source/context` должен быть:

```text
STRUCTURED
PERSISTED
DETERMINISTIC
QUERYABLE
```

Нельзя считать source captured только потому, что его можно предположить из human-readable comment.

---

# 7. AUDIT SOURCE MODEL

Провести schema/code audit и выбрать минимальную additive implementation.

Предпочтительный canonical model:

```text
source: AuditSource
```

где минимум:

```text
ORDER_FULL_PAGE
ORDER_QUICK_PREVIEW
API
SYSTEM
INTEGRATION
```

Если нужен более универсальный cross-cutting naming contract — можно нормализовать enum, но не создавать Order-only semantics.

---

# 8. SOURCE MUST REPRESENT REAL KNOWLEDGE

Не записывать fictional precision.

Если backend endpoint не может доказать, что request пришёл из full-page или Quick Preview, нельзя автоматически писать `ORDER_FULL_PAGE`.

В таком случае:

```text
API
```

является корректным source.

Если UI source действительно нужен:

передавать его через explicit validated context/metadata contract, а не доверять произвольному free-form body.

Проверить security implications spoofing.

---

# 9. SOURCE AUTHORITY

Определить trusted/untrusted boundary.

Например:

```text
SYSTEM / INTEGRATION
→ server-derived only

API
→ server-derived fallback

ORDER_FULL_PAGE / ORDER_QUICK_PREVIEW
→ validated client context only if canonical contract explicitly allows it
```

Клиент не должен иметь возможность подделать:

```text
SYSTEM
INTEGRATION
```

---

# 10. ORDER HISTORY MIGRATION

Если schema change нужен:

- additive migration;
- existing rows preserved;
- legacy source может быть `NULL`, `LEGACY`, `UNKNOWN` или безопасно derived только если deterministic;
- не backfill fictional values;
- no DB reset.

Проверить migration на текущей dev DB.

---

# 11. SOURCE API/UI

History API должен возвращать structured source.

UI history:

- может показывать human-readable source;
- raw enum не должен быть единственным UX;
- отсутствие source у legacy row отображать честно (`—` / legacy).

---

# 12. SOURCE TESTS

Обязательные tests:

```text
1. system-created audit → SYSTEM/INTEGRATION according to actual path
2. direct API action → API
3. full-page action → ORDER_FULL_PAGE if explicit trusted contract implemented
4. Quick Preview action → ORDER_QUICK_PREVIEW if explicit trusted contract implemented
5. forged SYSTEM source from client → denied/ignored
6. legacy row without source → readable
```

Не искусственно создавать различие full-page/drawer, если architecture выбрала API-only attribution.

Но тогда docs/constants/UI должны соответствовать этому решению.

---

# 13. D5-R2 — OPERATIONAL NOTE AUDIT REQUALIFICATION

OperationalNote является mutable business entity.

Проверить actual usage:

```text
Order
Request
Booking
CRM Customer
CRM Partner
other entities
```

Определить scope impact.

---

# 14. NOTE AUDIT POLICY

Не путать:

```text
OperationalNote
```

с:

```text
Audit Event
```

Operational note — mutable user content.

Audit history — immutable evidence изменения.

Canonical rule:

```text
CREATE note
→ auditable creation event

UPDATE note
→ auditable field change

DELETE note
→ auditable deletion event
```

если note относится к business entity, для которой change accountability требуется.

---

# 15. NOTE UPDATE HISTORY

При update необходимо сохранять минимум:

```text
noteId
actor
changedAt
source
field
oldValue
newValue
```

Для note text решить safe audit representation.

Не хранить secrets/PII blindly.

Если notes могут содержать arbitrary sensitive free text, провести security/data-minimization analysis.

Допустимые варианты:

```text
A. safe old/new text under defined policy
B. redacted/truncated old/new
C. immutable revisions in dedicated note revision storage
```

Выбор обосновать.

---

# 16. NOTE DELETE SEMANTICS

Hard question:

```text
Что означает DELETE OperationalNote?
```

Проверить actual DB behavior.

Если hard delete уничтожает единственный текст и его историю:

это конфликтует с accountability requirement.

Рассмотреть:

```text
soft delete
immutable revision history
tombstone audit event
```

Не вводить overengineering; выбрать минимальную модель, которая сохраняет требуемую историю.

---

# 17. OPERATIONAL NOTE + CROSS-CUTTING FRAMEWORK

Не создавать второй несовместимый audit mechanism.

Если OperationalNote использует отдельную physical history table — это допустимо, если semantic contract тот же:

```text
actor
timestamp
event type
source
safe diff
immutability
transactionality
scope
```

---

# 18. NOTE TRANSACTIONALITY

Hard:

```text
note mutation
+
note audit/revision
=
atomic
```

Проверить:

```text
successful CREATE → audit/revision
successful UPDATE → audit/revision
successful DELETE → audit/tombstone
failed mutation → no successful audit
```

---

# 19. NOTE AUTHORIZATION

Сохранить existing RBAC:

```text
operational-notes.read
operational-notes.create
operational-notes.update
operational-notes.delete
```

Audit/history visibility должна соответствовать parent entity scope и не давать tenant leakage.

---

# 20. NOTE UI

Не обязательно превращать Order history в гигантский combined event stream, если canonical architecture разделяет:

```text
Operational Notes
Change History
```

Но пользователь должен иметь возможность понять историю редактирования note, если note mutable.

Выбрать и документировать UX:

```text
note revision/history control
или
entity history events
```

---

# 21. D5-R3 — REAL D4 CONCURRENCY REGRESSION

Найти exact D4 concurrency/TOCTOU regression test, который защищает traveler post-final lock.

Запустить его реально.

Hard scenario:

```text
T1 starts traveler mutation
T2 final-confirms Order
race/interleaving
→ system must not commit invalid post-final traveler mutation
```

Проверить actual DB state после race.

`SELECT FOR UPDATE` code inspection недостаточно.

---

# 22. D4 CONCURRENCY EVIDENCE

Report должен содержать:

```text
exact test file
exact test name
command
result
runtime
relevant assertion
DB final state
```

Storefront isolation не использовать как substitute.

---

# 23. D5-R4 — REQUIRED D3/D4 REGRESSION

Запустить реально минимум:

```text
d3-request-flow
d3-traveler-collection
d4-traveler-security
d4-representative-chain
d4-remediation-closure
d5-order-fullpage-audit
```

Если exact filenames отличаются — найти реальные suites и перечислить.

Также:

```text
backend tsc
frontend tsc
frontend vitest
```

---

# 24. NO FALSE "REGRESSION GREEN"

Для каждого suite:

| Suite | Command | Tests | Result |
|---|---|---:|---|

Если suite не запускался:

```text
NOT RUN
```

а не PASS.

---

# 25. FRONTEND BASELINE FAILURE

Если остаётся известный `formatPrice` AZN locale mismatch:

- подтвердить, что он pre-existing;
- не исправлять в D5, если не затронут remediation;
- не считать весь frontend suite PASS.

Писать честно:

```text
346 PASS / 1 known pre-existing FAIL
```

или actual result.

---

# 26. D5-R5 — BROWSER MUTATION EVIDENCE

Browser/runtime verification обязателен.

Не ограничиваться rendering.

---

# 27. BROWSER FLOW A — CANONICAL NAVIGATION

```text
Orders registry
→ click MKT-ORD-*
→ /app/orders/{id}
→ Quick Preview only explicit control
```

Проверить same Order action parity.

---

# 28. BROWSER FLOW B — LIFECYCLE MUTATION

На isolated safe Order:

```text
NEW
→ click Принять в работу
→ IN_PROCESSING
```

Проверить:

```text
UI status changed
API status changed
DB status changed
history event appeared
actor/date/action/source correct
hard refresh preserves result
```

---

# 29. BROWSER FLOW C — TRAVELER EDIT

На pre-final D3 Order:

```text
edit allowed traveler field
→ save
```

Проверить:

```text
UI value
API value
DB value
history field diff
PII masking
source
```

И обязательно проверить:

```text
history refreshes after successful save
```

без полного page reload, если D5 UI contract это обещает.

---

# 30. BROWSER FLOW D — POST-FINAL LOCK

На final-confirmed Order:

```text
attempt traveler edit
```

Expected:

```text
UI blocks or server returns controlled denial
DB unchanged
no successful FIELD_CHANGE
```

---

# 31. BROWSER FLOW E — REPRESENTATIVE C1/C6

Проверить existing representative cases:

```text
C1 — READY_FOR_BOOKING
C6 — CANCELLED / financial chain
```

Проверить action availability соответствует state machine.

Не мутировать permanent evidence cases, если это разрушит representative coverage.

---

# 32. BROWSER FLOW F — STOREFRONT ISOLATION

Platform actor direct access to Storefront Order:

```text
/app/orders/{storefrontUuid}
```

Expected:

```text
404 / no existence leakage
```

History endpoint также denied/404.

---

# 33. BROWSER FLOW G — OPERATIONAL NOTE

Если note audit remediation реализована:

```text
create note
edit note
delete/soft-delete note
```

Проверить выбранный canonical history/revision behavior.

Никакого silent loss of previous version.

---

# 34. DB → API → UI → AUDIT RECONCILIATION

Для lifecycle action:

```text
DB status
=
API status
=
UI status
=
audit transition
```

Для traveler edit:

```text
DB
=
API
=
UI
=
audit safe diff
```

Для OperationalNote:

```text
current note state
+
immutable previous revision/audit
```

должны согласовываться.

---

# 35. D5-R6 — DOCUMENTATION CORRECTION

Исправить factual statement в D5 Implementation Report.

Canonical wording:

```text
До D5 маршрут /app/orders/{id} уже существовал.

D5 не создавал Order full-page с нуля.
D5 requalified/expanded existing full-page into canonical Order detail:
- server-authoritative actions;
- navigation consistency;
- milestones;
- relations;
- audit/history;
- mutability/security integration.
```

Не переписывать историю Git.

---

# 36. STRICT REVIEW REPORT STATUS

Не удалять исходный Strict Review Report.

Добавить final remediation/evidence closure report.

При необходимости добавить короткую correction/addendum в Strict Review Report, но сохранить original findings history.

---

# 37. ARCHITECTURE SYNC

Проверить и при необходимости additive update:

```text
docs/architecture/ENTITY_CHANGE_AUDIT_FRAMEWORK.md
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Framework doc должен после remediation явно определять:

```text
structured source/context
trusted source authority
legacy source behavior
OperationalNote audit/revision policy
transactionality
PII/data minimization
entity-specific physical storage allowed
```

---

# 38. ROADMAP SYNC

До final verdict roadmap должен честно показывать:

```text
D5 remediation/evidence closure
```

И только после всех gates:

```text
D5 — ACCEPTED
D6 — NEXT / NOT STARTED
```

Не отмечать D6 started.

---

# 39. SECURITY REQUALIFICATION

Проверить после schema/API changes:

```text
tenant/workspace isolation
Storefront→Platform denial
source spoofing
audit PII
note arbitrary text risk
history authorization
mass assignment
post-final traveler lock
```

---

# 40. AUDIT SOURCE SPOOFING NEGATIVE TEST

Если client может передать source context:

попытаться:

```text
source=SYSTEM
source=INTEGRATION
unknown source
malformed source
```

Expected согласно design:

```text
ignored / rejected / normalized
```

Нельзя позволить обычному client action выглядеть как SYSTEM event.

---

# 41. LEGACY HISTORY

После migration проверить старые OrderHistory rows.

Hard:

```text
existing history remains readable
no fictional source backfill
no crash
no data loss
```

---

# 42. AUDIT PAGINATION REGRESSION

После schema/model changes повторить:

```text
createdAt DESC
id DESC
page/pageSize
no duplicates
no missing rows
```

---

# 43. ORDER ACTION REGRESSION

Повторить:

```text
NEW
IN_PROCESSING
WAITING_FOR_DATA
READY_FOR_BOOKING
SENT_TO_BOOKING
FULFILLED
CLOSED
CANCELLED
```

availableActions должны оставаться server-authoritative.

---

# 44. DRAWER/FULL-PAGE PARITY REGRESSION

Same:

```text
Order
User
Workspace
Status
Permissions
```

must yield same available business actions.

Source attribution может различаться только как provenance metadata, но authorization/state semantics — нет.

---

# 45. REQUEST / BOOKING FRAMEWORK FUTURE COMPATIBILITY

D6 и Request implementation НЕ выполнять.

Но после source/note remediation убедиться, что framework можно использовать для Booking/Request без semantic fork.

Обновить compatibility matrix:

| Contract | Order | OperationalNote | Booking future | Request future |
|---|---|---|---|---|

---

# 46. NO D6 CODE

Hard check:

```text
No D6 Booking full-page implementation changes
No D6 Booking audit integration
```

Допустимы только shared framework changes, которые объективно нужны для D5 и reusable.

---

# 47. REQUIRED AUTOMATED TEST MATRIX

Минимум:

```text
D5 audit source persistence
D5 source spoofing
D5 lifecycle audit
D5 failed action no audit
D5 traveler audit
D5 post-final denial
D5 history pagination
D5 Storefront isolation
OperationalNote create audit/revision
OperationalNote update audit/revision
OperationalNote delete/tombstone audit
OperationalNote authorization
D4 real concurrency/TOCTOU
D3 request flow
D3 traveler collection
D4 traveler security
D4 representative chain
D4 remediation closure
```

---

# 48. REQUIRED REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D5_FINAL_REMEDIATION_EVIDENCE_CLOSURE_REPORT.md
```

---

# 49. REPORT STRUCTURE

Минимум:

1. Executive Summary
2. Starting Git State
3. Root Cause Matrix
4. D5-R1 Structured Audit Source
5. Source Authority / Spoofing Protection
6. DB Migration / Legacy Compatibility
7. D5-R2 OperationalNote Audit Policy
8. OperationalNote Transactionality
9. Cross-cutting Framework Requalification
10. D5-R3 D4 Concurrency Evidence
11. D5-R4 D3/D4 Regression Evidence
12. D5-R5 Browser Mutation Evidence
13. D5-R6 Documentation Correction
14. DB→API→UI→Audit Reconciliation
15. Security Requalification
16. Automated Test Matrix
17. Browser Evidence Matrix
18. Findings Closure Matrix
19. Architecture/Roadmap Sync
20. Git Closure
21. Final Acceptance Matrix
22. Final Verdict
23. TRUE NEXT

---

# 50. FINDINGS CLOSURE MATRIX

| Finding | Previous status | Remediation | Evidence | Final status |
|---|---|---|---|---|

Минимум:

```text
D5-R1 source/context
D5-R2 OperationalNote history
D5-R3 concurrency evidence
D5-R4 regression evidence
D5-R5 browser evidence
D5-R6 factual correction
```

---

# 51. FINAL ACCEPTANCE MATRIX

Hard gates:

| Gate | Result | Evidence |
|---|---|---|
| Starting Git state classified | | |
| Structured audit source persisted | | |
| Source deterministic | | |
| Source spoofing protected | | |
| Legacy history preserved | | |
| OperationalNote audit policy canonical | | |
| Note CREATE history preserved | | |
| Note UPDATE previous value/history preserved | | |
| Note DELETE does not erase accountability | | |
| Note mutation + audit atomic | | |
| Cross-cutting framework remains unified | | |
| D4 real concurrency test PASS | | |
| D3 request-flow regression PASS | | |
| D3 traveler regression PASS | | |
| D4 traveler security PASS | | |
| D4 representative chain PASS | | |
| D4 remediation closure PASS | | |
| D5 regression PASS | | |
| Browser lifecycle mutation PASS | | |
| Browser traveler edit PASS | | |
| Browser post-final lock PASS | | |
| Browser C1/C6 PASS | | |
| Browser Storefront isolation PASS | | |
| Browser note revision/audit PASS | | |
| DB==API==UI==Audit lifecycle | | |
| DB==API==UI==Audit traveler | | |
| OperationalNote current+history reconcile | | |
| PII/secrets safe | | |
| Audit pagination stable | | |
| Drawer/full-page action parity preserved | | |
| Pre-D5 factual report corrected | | |
| Architecture doc synchronized | | |
| Roadmap synchronized | | |
| D6 NOT STARTED | | |
| No unresolved P0/P1 | | |
| No unresolved acceptance-blocking P2 | | |
| Report predominantly Russian | | |
| Final worktree EXACTLY EMPTY | | |
| HEAD == origin/master | | |

---

# 52. VERDICT RULE

## VERDICT A

Допустим ТОЛЬКО если все hard gates PASS.

Output:

```text
VERDICT A — D5 FINAL REMEDIATION & EVIDENCE CLOSURE PASSED

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

# 53. VERDICT B

Если хотя бы один acceptance blocker остаётся:

```text
VERDICT B — D5 FINAL REMEDIATION & EVIDENCE CLOSURE FAILED

D5 — NOT ACCEPTED
D6 — NOT STARTED

TRUE NEXT:
D5 REMEDIATION CONTINUATION
```

Перечислить exact blockers и evidence.

---

# 54. GIT HARD CLOSURE

После implementation + tests + reports:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Требование:

```text
working tree EXACTLY EMPTY
HEAD == origin/master
```

Все meaningful remediation/report/docs должны быть committed и pushed.

Не оставлять untracked prompt/report/evidence artifacts.

Указать final SHA.

---

# 55. STOP RULE

После:

```text
root cause
→ remediation
→ migration
→ automated regression
→ real concurrency
→ browser mutation evidence
→ DB/API/UI/Audit reconciliation
→ architecture/roadmap sync
→ Git closure
→ final verdict
```

**STOP.**

Не начинать D6 даже при `VERDICT A`.

D6 начинается только отдельным implementation prompt.
