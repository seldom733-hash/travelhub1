# PHASE 3 — PRE-STEP 3.12 — D5 — STRICT REVIEW

## ROLE — MANDATORY

Ты работаешь как **Independent Senior Software Architect + Principal Code Reviewer + QA/Security Reviewer + Backend/Frontend/Database Reviewer**.

Ты НЕ являешься автором D5 implementation. Existing code, implementation report, tests и screenshots — evidence, но не canonical business truth.

Проверить независимо: Code → DB → API → UI → Runtime → Audit → Git. Implementation `VERDICT A` не означает D5 ACCEPTED. Root cause обязателен для каждого finding. Не исправлять production code в Strict Review. Не начинать D6/D7/D11/D12. Runtime evidence выше prose claims.

## LANGUAGE REQUIREMENT — MANDATORY

Strict Review Report, findings, root cause, architecture/security conclusions и verdict explanations — преимущественно **на русском языке**. English допустим только для identifiers, paths, code, endpoints, enums, permissions, commands и standardized VERDICT strings.

Если report преимущественно английский — review incomplete. Не сохранять plaintext secrets/passwords/full sensitive PII.

## 1. BASELINE

D5 implementation заявляет commit:

`0ec425517267aea8354f3b1a4d89019ff431bf45`

Scope:

- canonical `/app/orders/{id}`;
- server-authoritative `availableActions`;
- Quick Preview отдельно;
- Editing/Mutability Contract;
- Entity Change Audit Framework foundation + Order integration;
- transactional lifecycle/field audit;
- PII-safe history;
- D6 NOT STARTED.

Не считать claims доказанными до независимой проверки.

## 2. STARTING GIT GATE

```bash
git branch --show-current
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -10 --oneline
```

Ожидание: `master`, worktree EXACTLY EMPTY, `HEAD == origin/master`. Зафиксировать real SHA.

## 3. FIVE SPECIAL HARD TARGETS

Обязательно закрыть:

```text
SR-D5-H1 — ORDER-LEVEL EDITABILITY
SR-D5-H2 — OPERATIONAL NOTES MUTABILITY
SR-D5-H3 — STRUCTURED AUDIT SOURCE/CONTEXT
SR-D5-H4 — TRUE CROSS-CUTTING AUDIT FRAMEWORK
SR-D5-H5 — BASELINE EVIDENCE INTEGRITY / PRE-D5 FULL-PAGE
```

Ни один нельзя закрыть ссылкой на implementation report.

## 4. H1 — ORDER-LEVEL EDITABILITY

Implementation фактически реализует traveler editing, но утверждает, что Order fields не редактируются. D5 scope содержит `EDITING / MUTABILITY CONTRACT`.

Инвентаризировать actual Order schema/DTO/service/UI минимум:

```text
notes
customer/contact operational corrections
internal operational fields
seller/partner
product/item
amount
currency
travelerCount
accepted terms
pinnedRequirements
acquisitionSource
referenceNumber
milestones
status
linked Request/Booking
other actual Order fields
```

Для каждого определить:

```text
MUTABLE
IMMUTABLE
SERVER-OWNED
LIFECYCLE-ACTION-ONLY
NOT EXPOSED
LEGACY-ONLY
```

Построить независимую matrix:

| Field | Classification | Before final confirm | After final confirm | Permission | API | UI | Audit |
|---|---|---|---|---|---|---|---|

Hard question:

> Существует ли хотя бы одно legitimate Order-level business field, которое пользователь должен иметь возможность редактировать в текущем canonical lifecycle?

Если YES, но edit API/UI отсутствует → acceptance blocker. Если NO — доказать domain/canonical semantics, а не текущей реализацией.

## 5. H2 — OPERATIONAL NOTES

Implementation page содержит `Примечания / Operational Notes`, но notes отсутствуют в mutability matrix.

Проверить schema, DTO, service, old drawer/UI и business semantics. Определить:

```text
read-only
mutable
server-generated
legacy display-only
```

Если notes mutable, требуемый contract:

```text
Edit
→ server authorization
→ validation
→ transaction
→ Order update
→ FIELD_CHANGE audit
→ immediate value/history refresh
```

Если read-only — доказать почему.

Не путать Order notes с `OrderHistory.comment`.

## 6. H3 — STRUCTURED AUDIT SOURCE/CONTEXT

Implementation framework объявляет:

```text
ORDER_FULL_PAGE
ORDER_QUICK_PREVIEW
API
SYSTEM
INTEGRATION
```

но finding F-D5-5 говорит, что `OrderHistory` не имеет отдельного source field; одновременно acceptance matrix утверждает `source/context captured = PASS`.

Проверить DB schema, shared audit core, write path, actual rows, API response и architecture doc.

Ответить:

> Где persisted structured source/context?

Hard requirement:

```text
source/context must be structured and deterministic
```

`comment`, localized action label или догадка по route не равны structured source.

Если source не persisted — finding и reconciliation acceptance claim. Если canonical design допускает derived metadata — привести exact contract и доказать deterministic derivation.

## 7. H4 — TRUE CROSS-CUTTING FRAMEWORK

Проверить:

```text
docs/architecture/ENTITY_CHANGE_AUDIT_FRAMEWORK.md
backend/src/shared/audit.ts
OrderHistory
BookingHistory
Request history/event structures
actor semantics
event semantics
source semantics
PII redaction
transactionality
pagination
immutability
scope
```

Compatibility matrix:

| Contract | Order | Booking current | Request current | Reusable without semantic fork? |
|---|---|---|---|---|

Разные physical tables допустимы. Но semantic framework должен давать:

```text
Request / Order / Booking
→ same event semantics
→ same actor model
→ same source/context model
→ same PII policy
→ same transactionality
→ same immutability
→ same safe diff rules
```

Если D6 потребует несовместимый второй audit design → D5 foundation incomplete.

## 8. H5 — BASELINE EVIDENCE INTEGRITY

Implementation report утверждает, что full-page Order detail до D5 не существовал. Ранее runtime проекта показывал `/app/orders/{id}`, хотя registry открывал drawer и full-page была неполной.

Проверить parent commit:

`8c4fa4d4a8e8cba5bbe11da403afb062ec762173`

через `git show`, tree/history и route files.

Определить:

```text
A. full-page действительно отсутствовал
B. full-page существовал, но был incomplete / не был canonical registry target
```

Если B — implementation report factual evidence error; требуется correction before final acceptance.

## 9. STATE MACHINE / AVAILABLE ACTIONS

Независимо проверить actual `OrderStatus`, `TRANSITIONS`, `ACTION_PERMISSIONS`, D3 gates, terminal states.

Hard invariant:

```text
availableActions
=
state machine
∩ permissions
∩ lifecycle gates
∩ workspace/scope
```

Для representative statuses проверить allowed/forbidden/direct forged actions:

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

До `finalConfirmedAt`, D3-scoped `confirm/send` недоступны. После valid final confirmation — доступны только по state/permission.

## 10. ROLE/PERMISSION REQUALIFICATION

Проверить runtime/DB grants relevant roles:

```text
ADMIN
DIRECTOR
OPERATOR
SALES_MANAGER
FINANCE
ANALYST
MARKETER
MODERATOR
```

Не принимать claims только по constants, учитывая известный RBAC parity debt.

## 11. DRAWER / FULL-PAGE PARITY

На одном Order/actor:

```text
Quick Preview actions
==
Full-page actions
==
API availableActions
```

После transition закрыть/reopen Quick Preview и проверить fresh projection. Polling не требуется.

## 12. NAVIGATION / RELATIONS

Hard:

```text
MKT-ORD-* normal click → /app/orders/{id}
Quick Preview → explicit separate control
```

Проверить доступные entry points: registry, Request relation и иные реальные Order links.

Request relation только FK:

`Request.convertedOrderId → Order.id`

Никакого parsing business references.

Order→Booking:

`Booking.orderId == Order.id`

V1 `1 Order = 1 Booking`; никаких foreign seller bookings.

## 13. FULL-PAGE DATA RECONCILIATION

Для representative Orders сверить DB→API→UI:

```text
reference
status
paymentStatus
customer
seller/partner
items
amounts
travelers
linked Request
linked Booking
milestones
notes
history
```

Сохранить `Customer ≠ Payer ≠ Traveler`. `OrderStatus ≠ PaymentStatus`. Не исправлять D7.

## 14. FROZEN SNAPSHOT / ANTI-MASS-ASSIGNMENT

Forged update минимум:

```text
amount
currency
travelerCount
termsAcceptedAt
finalConfirmedAt
pinnedRequirements
acquisitionSource
referenceNumber
sellerPartnerId
product/item identity
```

Expected: denied/allowlist-safe, DB unchanged, no successful audit mutation event.

## 15. TRAVELER MUTABILITY

До final confirm — только permitted/pinned fields. После:

```text
409
DB unchanged
no successful FIELD_CHANGE
```

Повторить D4 concurrency regression.

## 16. AUDIT TRANSACTIONALITY

Доказать:

```text
successful mutation → audit exists
failed mutation → no successful audit
rollback → no orphan audit
```

Проверить actual DB after tests.

## 17. FIELD DIFF / PII

Проверить old/new/field/redacted для normal, null, date, sensitive, multi-field update. Unchanged fields не должны попадать в diff.

Проверить persisted DB/API/UI минимум для:

```text
passportNumber
birthDate
passportExpiry
phone/email if auditable
```

No full plaintext sensitive old/new.

Проверить shared helper safety boundary: secrets (`password`, `passwordHash`, tokens, Authorization, apiKey, secret, payment credentials) не должны случайно попасть в generic audit.

## 18. AUDIT IMMUTABILITY / AUTH / PAGINATION

Проверить:

- нет normal update/delete history endpoints;
- DB cascade semantics честно документированы;
- authorized Marketplace Order history доступна;
- unauthorized role denied;
- Storefront Order via Platform → 404;
- nonexistent → 404;
- pagination stable `createdAt desc + id desc`, без дублей/пропусков.

## 19. HISTORY LIVE REFRESH — F-D5-2

Независимо воспроизвести:

```text
traveler save
→ audit persisted
→ does history update immediately?
```

Preferred UX:

```text
Save
→ traveler refresh
→ history refresh
```

Если history остаётся stale до page reload — определить severity и необходимость remediation before acceptance. Не исправлять в Strict Review.

## 20. QUICK PREVIEW SNAPSHOT — F-D5-3

Polling не требуется. Но reopened drawer должен перечитать current detail/actions. Если reopened drawer stale — finding.

## 21. LEGACY ORDER

Проверить pre-D3 Order:

```text
page works
no fake pinned requirements
no fabricated historical edits
honest legacy notice
no crash
```

Legacy behavior не должен ослаблять canonical D3/D4 Orders.

## 22. REPRESENTATIVE CASES

Повторно проверить actual DB references:

```text
D3 CASE A: MKT-ORD-09000547
C1: MKT-ORD-09000847
C6: MKT-ORD-09000949
```

Не доверять report UUID/status без DB proof.

## 23. ACTION AUDIT EVENT

Isolated fixture:

```text
NEW → process → IN_PROCESSING
```

Assert exactly one lifecycle event:

```text
from NEW
to IN_PROCESSING
actor correct
timestamp reasonable
```

Повторный invalid process → denied, no second successful event.

## 24. ORDER-LEVEL EDIT AUDIT

Если H1/H2 выявит legitimate mutable Order field:

```text
old → edit → new
DB == API == UI
FIELD_CHANGE audit
old/new correct
actor/date/source correct
```

Если field должен быть mutable, но contract отсутствует → `VERDICT B`.

## 25. SOURCE ATTRIBUTION RUNTIME

Если structured source реализован, mutation через full-page должна persist source. Если Quick Preview позволяет mutation — проверить distinct source, если architecture обещает distinction.

Если endpoint объективно знает только `API`, architecture doc должен честно это определять. Никакой fictional precision.

## 26. BOOKING / REQUEST FUTURE COMPATIBILITY

Не реализовывать D6/Request audit.

Проверить, может ли BookingHistory и Request model принять canonical framework additive без semantic fork. Если нет — finding.

## 27. TEMPORAL / UI / SECURITY BASICS

Проверить modeled milestones; missing → `—`, без `updatedAt` substitution.

Проверить direct routes:

```text
authorized Marketplace → detail
Storefront via Platform → 404
nonexistent → 404
invalid UUID → controlled 4xx/404
unauthorized → correct denial
```

UI states: loading, 404, API error, no Booking, no history, legacy no pinned, no actions. Нет raw i18n keys.

## 28. AUTOMATED REGRESSION

Повторить минимум:

```text
d5-order-fullpage-audit
d3-request-flow
d3-traveler-collection
d4-traveler-security
d4-representative-chain
d4-remediation-closure
relevant Order lifecycle
relevant RBAC
backend tsc
frontend tsc
frontend vitest
```

Implementation claim `346/347, formatPrice pre-existing` воспроизвести независимо. Для pre-existing classification использовать safe parent baseline/worktree, не загрязняя current worktree.

Особенно сохранить D4:

```text
explicit Storefront list/export bypass closed
Storefront direct Order/history 404
post-final traveler lock
TOCTOU concurrency fix
```

## 29. INDEPENDENT BROWSER RUNTIME — MANDATORY

Минимум:

1. Login Platform actor.
2. Orders registry.
3. Business ref → full-page.
4. Quick Preview explicit.
5. Same Order action parity.
6. NEW actions.
7. Execute safe `process` on isolated fixture.
8. Verify status + lifecycle history.
9. Hard refresh.
10. Edit allowed traveler field.
11. Verify audit persisted.
12. Check immediate history refresh.
13. Post-final traveler lock.
14. C1 actions.
15. C6 no invalid actions.
16. linked Request/Booking routes.
17. Storefront Order direct → 404.
18. notes behavior per H2.
19. Order-level edit behavior per H1.

Сохранить independent screenshots/results.

## 30. DB → API → UI → AUDIT

Lifecycle:

```text
DB status = API status = UI status = audit from/to
```

Field edit:

```text
DB value = API value = UI value = audit old/new
```

Sensitive:

```text
business DB may contain synthetic full value
audit DB/API/UI must not expose full value
```

## 31. IMPLEMENTATION CLAIM INTEGRITY MATRIX

Обязательно:

| Claim | Evidence | Result |
|---|---|---|
| Full-page did not exist pre-D5 | | |
| availableActions server-authoritative | | |
| drawer/full-page same source | | |
| Order edit contract complete | | |
| audit cross-cutting | | |
| source/context captured | | |
| mutation+audit transactional | | |
| PII redacted in DB/API/UI | | |
| history immutable | | |
| Storefront history denied | | |
| D3/D4 regressions green | | |
| roadmap synchronized | | |
| Git closure valid | | |

Result: `CONFIRMED / PARTIALLY CONFIRMED / FALSE / NOT REPRODUCIBLE`.

## 32. ROADMAP / ARCHITECTURE

Проверить:

```text
docs/architecture/ENTITY_CHANGE_AUDIT_FRAMEWORK.md
TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Hard:

```text
D5 implementation ≠ D5 accepted
D6 not started
Request requalification pending
```

Если architecture correction нужна — зафиксировать additive remediation/sync, не переписывать историю.

## 33. FINDING SEVERITY

```text
P0 — catastrophic/security/data corruption
P1 — core invariant broken / acceptance blocker
P2 — important correctness/security/architecture defect
P3 — localized defect/evidence gap/UX inconsistency
INFO — non-blocking observation
```

Не снижать severity потому, что code уже committed.

## 34. REQUIRED STRICT REVIEW REPORT

Создать:

`docs/reports/PHASE_3_PRE_STEP_3.12_D5_ORDER_FULL_PAGE_STRICT_REVIEW_REPORT.md`

Структура минимум:

1. Executive Summary
2. Starting Git State
3. Review Method
4. Canonical Architecture Requalification
5. H1 Order-Level Editability
6. Independent Mutability Matrix
7. H2 Operational Notes
8. H3 Structured Audit Source
9. H4 Cross-cutting Framework
10. Framework Compatibility Matrix
11. H5 Baseline Full-Page Evidence
12. State Machine
13. Action Authority/Permissions
14. Drawer/Full-Page Parity
15. Navigation
16. Relations
17. Frozen Snapshot/Traveler Mutability
18. Audit Transactionality
19. Diff/PII
20. Audit Immutability/Auth/Pagination
21. Legacy Compatibility
22. Tests
23. Browser Evidence
24. DB→API→UI→Audit
25. Claim Integrity Matrix
26. Findings
27. Roadmap/Architecture
28. Acceptance Matrix
29. Git State
30. Final Verdict
31. TRUE NEXT

## 35. FINDINGS MATRIX

| ID | Severity | Surface | Finding | Evidence | Root Cause | Required Remediation |
|---|---|---|---|---|---|---|

Не смешивать findings с deferred roadmap debt.

## 36. ACCEPTANCE MATRIX — HARD

| Gate | Result | Evidence |
|---|---|---|
| Starting Git clean / HEAD==origin | | |
| H1 Order-level editability resolved | | |
| Independent mutability matrix complete | | |
| H2 Notes mutability resolved | | |
| H3 structured source contradiction resolved | | |
| H4 framework semantically cross-cutting | | |
| H5 pre-D5 full-page fact verified/corrected | | |
| State machine verified | | |
| availableActions server-authoritative | | |
| Action permissions runtime/DB verified | | |
| Forged forbidden action denied | | |
| Drawer/full-page parity | | |
| Canonical business-ref navigation | | |
| Request→Order FK | | |
| Order→Booking exact relation | | |
| Frozen snapshot protected | | |
| Pre-final traveler edit valid | | |
| Post-final traveler edit denied | | |
| D4 concurrency fix preserved | | |
| Mutation+audit transactional | | |
| Failed mutation → no successful audit | | |
| Diff accurate | | |
| PII redacted persisted | | |
| Secrets cannot enter changed audit scope | | |
| History immutable for ordinary user | | |
| History authorization/scope correct | | |
| Pagination stable | | |
| Legacy Order honest | | |
| Immediate history refresh assessed | | |
| Order-level editable field tested if exists | | |
| Notes edit tested if mutable | | |
| DB==API==UI==Audit lifecycle | | |
| DB==API==UI==Audit field change | | |
| D3/D4/D5 regressions PASS | | |
| Frontend baseline failure classified | | |
| Independent browser PASS | | |
| Architecture doc matches implementation | | |
| Roadmap matches actual stage | | |
| No unresolved P0/P1 | | |
| No acceptance-blocking P2 | | |
| Report predominantly Russian | | |
| D6 not started | | |
| Final review worktree clean | | |

## 37. VERDICT RULE

### Success

Только если all hard gates PASS, H1-H5 conclusively resolved, no unresolved P0/P1 or acceptance-blocking P2:

```text
VERDICT A — D5 STRICT REVIEW PASSED

D5 — ACCEPTED

TRUE NEXT:
D6 — BOOKING FULL-PAGE DETAIL
     + NAVIGATION CONSISTENCY
     + ACTION/STATE-MACHINE CONSISTENCY
     + EDITING/MUTABILITY CONTRACT
     + ENTITY CHANGE AUDIT FRAMEWORK INTEGRATION

D6 IMPLEMENTATION — NOT STARTED
```

### Failure

Если blocker:

```text
VERDICT B — D5 STRICT REVIEW FAILED

D5 — NOT ACCEPTED

TRUE NEXT:
D5 REMEDIATION
```

Перечислить exact blocking findings.

## 38. IMPORTANT DISPOSITION

Нельзя автоматически считать non-blocking:

- legitimate Order field должен редактироваться, но API/UI отсутствует;
- notes должны быть mutable, но contract отсутствует;
- audit source заявлен captured, но не persisted/deterministic;
- framework нельзя reuse для Booking/Request без semantic fork;
- server availableActions расходится с direct API;
- PII plaintext leak;
- mutation/audit не atomic;
- Platform читает Storefront history;
- factual baseline claim искажает pre-D5 architecture.

## 39. STRICT REVIEW MUST NOT REMEDIATE

Production code не исправлять. Findings → exact remediation requirements. Temporary diagnostics удалить до Git closure.

## 40. FINAL GIT STATE

После review artifacts/report по project convention commit/push, затем:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
```

Hard:

```text
worktree EXACTLY EMPTY
HEAD == origin/master
```

Указать final SHA.

## 41. STOP RULE

После independent audit → tests → browser/runtime → framework review → report → evidence → Git closure → verdict остановиться.

Если A:

```text
D5 ACCEPTED
D6 NOT STARTED
```

Если B:

```text
D5 NOT ACCEPTED
D5 REMEDIATION NEXT
D6 NOT STARTED
```

**STOP.**
