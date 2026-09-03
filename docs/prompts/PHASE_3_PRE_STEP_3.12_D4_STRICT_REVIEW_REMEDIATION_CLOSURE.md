# PHASE 3 — PRE-STEP 3.12 — D4 — STRICT REVIEW REMEDIATION CLOSURE

## ROLE — MANDATORY

Ты работаешь как **Senior/Staff Software Engineer + Software Architect + Application Security Engineer + Database/Data Integrity Engineer + QA Engineer**.

Это **не новый feature stage** и не D5. Задача — закрыть конкретные findings независимого D4 Strict Review, доказать remediation через Code → DB → API → Runtime → Tests → Evidence → Git и только после этого окончательно решить, может ли D4 считаться ACCEPTED.

Existing code и предыдущие reports — evidence, но не canonical business truth.

Обязательные правила:

1. Не доверять предыдущему `VERDICT A` как waiver для найденных defects.
2. Root cause → remediation → regression proof.
3. Не расширять scope за пределы перечисленных findings.
4. Не начинать D5.
5. Не реализовывать Partner Workspace Order/Booking Center.
6. Не реализовывать Entity Change Audit Framework в D4.
7. Не делать полный reset основной dev DB.
8. Runtime/DB/API evidence выше prose claims.
9. Никакого финального `VERDICT A`, если обязательные remediation gates не доказаны.

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые reports, findings, root-cause explanations, evidence descriptions, architecture decisions, conclusions и verdict explanations должны быть преимущественно **на русском языке**.

English разрешён для code identifiers, paths, DTO/class/model/table names, endpoints, enum/status/permission identifiers, Git/CLI commands, code snippets и standardized VERDICT strings.

Если итоговый report преимущественно английский — задача incomplete. Не сохранять plaintext secrets, tokens или full sensitive traveler PII в report/evidence.

# 1. BASELINE

D4 Strict Review обнаружил:

```text
D4SR-F1 P2 — TOCTOU traveler mutation ↔ finalConfirm
D4SR-F2 P2 — explicit acquisitionSource=PARTNER_STOREFRONT list/export bypass
D4SR-F3 P3 — S12 natural COMPLETED chain не доказана isolated e2e
D4SR-F4 P3 — неверная классификация S5
D4SR-F5 P3 — неправильный CASE A Request UUID в manifest
D4SR-F6 P3 — legacy bulk traveler update: passportExpiry/completeness defect
D4SR-F7 INFO — hardcoded demo credentials
D4SR-F8 INFO/P3 — Storefront owning-partner positive commerce path отсутствует
Retention/privacy debt
RBAC parity debt
```

В этом closure:

```text
MUST FIX: F1 F2 F3 F4 F5 F6
PRESERVE / DEFER: F7 F8 Retention/privacy policy pre-existing RBAC parity drift
```

Если code audit покажет, что F1/F2 требуют фундаментального изменения архитектуры, STOP и зафиксировать blocker вместо локального workaround.

# 2. STARTING GIT GATE

До изменений выполнить и сохранить exact output:

```bash
git branch --show-current
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -10 --oneline
```

Ожидание: `master`, worktree EXACTLY EMPTY, `HEAD == origin/master`. Зафиксировать exact starting SHA.

# 3. CANONICAL ARCHITECTURE CHECK

## 3.1 Marketplace / Storefront

```text
Platform Marketplace ≠ Storefront customer commerce
```

Platform Marketplace operational contracts не должны позволять platform actor получить Storefront Orders/Bookings простым переключением query parameter. Storefront data остаётся в DB и не удаляется.

## 3.2 Traveler immutability

```text
finalConfirmedAt == NULL → traveler mutation may be allowed according to permissions/pinned policy
finalConfirmedAt != NULL → ordinary traveler mutation MUST be denied
```

Это должно быть true также при concurrency.

## 3.3 Representative chain

```text
REPRESENTATIVE CHAIN COVERAGE ≠ historical status row
```

Для поддерживаемого lifecycle state нужно natural transition evidence через реальные application/domain commands.

# 4. D4SR-F1 — FIX TOCTOU TRAVELER MUTATION ↔ FINAL CONFIRM

Strict Review обнаружил race:

```text
Traveler PATCH reads finalConfirmedAt = NULL
        │
        ├─────────────── concurrent finalConfirm commits
        │
        └─────────────── traveler PATCH commits after confirmation
```

Pre-check вне общей serialization boundary недостаточен.

Сделать traveler mutation и final confirmation согласованными на DB transaction/concurrency boundary.

Допустимо:

```text
A. SELECT Order ... FOR UPDATE в traveler mutation и finalConfirm
или
B. equivalent transactional CAS/locking design,
   исключающий commit traveler mutation после successful finalConfirm
```

Сначала проверить Prisma/PostgreSQL constraints.

Hard invariant:

```text
If finalConfirm succeeds first → concurrent traveler edit must fail / rollback
If traveler edit owns serialization first → finalConfirm waits/observes committed traveler state
```

Проверить single traveler PATCH, bulk traveler PATCH и finalConfirm. Не закрывать F1 простым повторным `findUnique` без concurrency proof.

# 5. F1 CONCURRENCY TEST — MANDATORY

Добавить isolated DB e2e race tests:

```text
R1 finalConfirm wins → traveler mutation cannot commit after it
R2 traveler mutation wins → finalConfirm observes committed traveler state → no post-confirm mutation
```

После завершения обоих concurrent operations проверить DB, а не только HTTP status:

```text
finalConfirmedAt
traveler field value
dataCompleteness
travelerDataCompletedAt if applicable
```

Покрыть single и bulk mutation paths.

# 6. D4SR-F2 — CLOSE PLATFORM STOREFRONT LIST/EXPORT BYPASS

Strict Review воспроизвёл:

```text
Platform actor
GET /orders?acquisitionSource=PARTNER_STOREFRONT → Storefront Orders
GET /bookings?acquisitionSource=PARTNER_STOREFRONT → Storefront Bookings
```

Hard rule:

```text
client filter ⊆ server-authorized scope
```

Никогда:

```text
client filter → replaces server scope
```

Для Platform Marketplace authorized acquisitionSource = `MARKETPLACE`.

Explicit `PARTNER_STOREFRONT` должен либо возвращать empty result, либо consistent 4xx. Выбрать поведение на основе существующего filtering contract; Orders/Bookings/Exports должны быть согласованы.

# 7. F2 SURFACES — MUST AUDIT ALL

Проверить минимум:

```text
GET /orders
GET /orders/export
GET /bookings
GET /bookings/export
```

и связанные count/totals/search/pagination/drill-down/dashboard/analytics consumers, если они используют тот же query builder.

Искать `acquisitionSource`, `channel`, `scope`, `sellerPartnerId`, `partnerId`, способные заменить authorized scope.

Hard invariant: Platform list/export/filtered totals не содержат Storefront customer commerce.

# 8. F2 NEGATIVE TESTS — MANDATORY

Для Platform actor с реально существующей Storefront fixture:

```text
/orders?acquisitionSource=PARTNER_STOREFRONT
/orders/export?acquisitionSource=PARTNER_STOREFRONT
/bookings?acquisitionSource=PARTNER_STOREFRONT
/bookings/export?acquisitionSource=PARTNER_STOREFRONT
```

Assert: no Storefront refs, UUIDs или rows. Проверить normal positive Marketplace filter.

# 9. DO NOT IMPLEMENT D4SR-F8 HERE

Не делать здесь:

```text
PARTNER order.read
PARTNER booking.read
Partner Order Center
Partner Booking Center
new Partner routes
new Storefront commerce UI
```

Сохранить архитектурный принцип:

```text
Platform Marketplace contract → MARKETPLACE scope
future Partner own-commerce contract → own sellerPartnerId / tenant scope
```

# 10. D4SR-F3 — NATURAL S12 COMPLETION CHAIN

Добавить isolated e2e scenario через реальные commands:

```text
Product / commercial prerequisites
→ Order
→ final confirmation
→ send to Booking
→ Booking supplier confirmation
→ Booking IN_SERVICE
→ Booking COMPLETED
→ Order FULFILLED
→ Order CLOSED
```

Если payment фактически обязателен — использовать реальную payment command; если нет — не выдумывать requirement. Сначала проверить state machine.

Hard: NO direct Prisma/SQL final-state injection для natural-chain evidence.

# 11. S12 TEMPORAL ASSERTIONS

Проверить доступные canonical timestamps:

```text
Booking.createdAt
Booking.confirmedAt
service-start timestamp if modeled
Booking.completedAt
Order completion/closed timestamp if modeled
```

Не подменять отсутствующий timestamp `updatedAt`. Если dedicated timestamp не моделируется — зафиксировать schema limitation, не создавать его ad hoc в D4.

# 12. D4SR-F4 — CORRECT S5 CLASSIFICATION

Исправить D4 evidence/report/manifest terminology:

```text
customer decline → SUPPORTED → POST /requests/:id/customer-decline → CANCELLED_BY_CUSTOMER
EXPIRED enum → EXISTS
customerActionDeadline → EXISTS
automatic transition to EXPIRED → NOT IMPLEMENTED
```

Разделить:

```text
S5A — Customer declined
S5B — Customer action expired
```

# 13. S5 REPRESENTATIVE COVERAGE

Добавить isolated natural test:

```text
customer decline → CANCELLED_BY_CUSTOMER → no Order conversion
```

Permanent dev row не обязателен. Для expiry зафиксировать `auto-EXPIRED = NOT IMPLEMENTED`; scheduler/worker не реализовывать.

# 14. D4SR-F5 — FIX MANIFEST CASE A

Исправить `docs/evidence/d4/D4_REPRESENTATIVE_COMMERCE_CASES.md`.

Для `MKT-REQ-09000547` повторно запросить live DB и исправить Request UUID + direct URL. Не копировать UUID из Strict Review вслепую. Проверить business reference, UUID, linked Order и URL.

# 15. D4SR-F6 — LEGACY BULK TRAVELER UPDATE

Проблема:

```text
bulk DTO accepts passportExpiry
but persistence ignores passportExpiry

dataCompleteness
based only on passportNumber
instead of pinned REQUIRED requirements
```

Сначала определить, используется ли bulk endpoint production UI/runtime.

Если поддерживаемый — persist all supported traveler fields и compute completeness через общую canonical D3 pinned-requirements logic.

Если доказанно legacy/deprecated — explicit deprecation + отсутствие misleading silent discard. Нельзя оставлять DTO обещающим поле, которое silently discarded.

# 16. F6 TESTS

Минимум:

```text
pre-final-confirm bulk update → passportExpiry persisted when permitted
pinned REQUIRED field missing → traveler not COMPLETE
all REQUIRED fields present → COMPLETE
post-final-confirm → 409
```

OPTIONAL/NOT_REQUESTED не должны искусственно становиться REQUIRED.

# 17. PRESERVE PII SECURITY

F1/F6 remediation не должна ослабить:

```text
field-level redaction
list minimization
anti-mass-assignment
cross-tenant denial
post-final-confirm immutability
```

Повторить D4 security suite полностью.

# 18. FINANCE / REPRESENTATIVE CHAINS REGRESSION

Повторить D4 representative chain suite с новым S12/S5 coverage. Не сломать Payment CAPTURED, partial/full refund, cancellation before/after payment.

# 19. D3 REGRESSION — MANDATORY

Повторить:

```text
d3-request-flow.e2e-spec.ts
d3-traveler-collection.e2e-spec.ts
```

Ожидание 15/15 PASS. Проверить permanent D3 CASE A/B.

# 20. MARKETPLACE / STOREFRONT RUNTIME PROOF

После F2 fix на live dev stack:

```text
Platform default Orders/Bookings → Marketplace remains visible
explicit Storefront filter → no Storefront exposure
direct Storefront Order/Booking → still 404 in Platform
```

Доказать одновременно:

```text
DB Storefront count > 0
Platform API Storefront exposure = 0 / denied
```

Не удалять Storefront rows.

# 21. EXPORT REQUALIFICATION LIMITED TO F2

D9 остаётся отдельным полным Export Framework Requalification. Здесь проверить только security/scope для Orders/Bookings export и explicit Storefront filter bypass.

# 22. D4SR-F7 — DEMO CREDENTIALS

Не blocker. Можно перевести локальные D4 scripts на env vars, если это безопасно и узко. Не менять repo-wide 77 suites. Допустимо `DEFERRED / INFO`.

# 23. D4SR-F8 — PARTNER POSITIVE PATH

Зафиксировать:

```text
S19 negative isolation = PROVEN
S19 owning-partner operational access = NOT IMPLEMENTED / DEFERRED
```

Добавить roadmap debt: `Partner Workspace own-scope Order/Booking contract`.

# 24. RETENTION / PRIVACY DEBT

Сохранить:

```text
"жизнь объекта" ≠ formal retention policy
```

Не выдумывать legal periods. Debt: Traveler PII retention + purge/anonymization + legal/business policy.

# 25. RBAC PARITY DEBT

Не исправлять автоматически весь drift. После remediation проверить, что D4 permission keys и FINANCE/ADMIN grants не изменились. Сохранить `RolePermission ↔ ROLE_PERMISSIONS reconciliation` как отдельный debt.

# 26. CROSS-CUTTING ENTITY CHANGE AUDIT FRAMEWORK — PRESERVE

Не реализовывать здесь.

Canonical requirement:

```text
Entity Change Audit Framework
Request
Order
Booking
```

Contract:

```text
mutation
→ server validation
→ permission/scope
→ lifecycle mutability
→ successful mutation
→ immutable audit event
```

Record:

```text
entityType
entityId
field/action
oldValue
newValue
changedAt
changedBy
workspace
source
reason/comment where required
```

Sensitive PII old/new: NO plaintext; redact/mask/hash/fact-of-change.

Integration начинается с D5/D6 + Request requalification.

# 27. D5 / D6 SCOPE — PRESERVE, DO NOT START

После успешного D4 closure:

```text
D5 — ORDER FULL-PAGE DETAIL
     + Navigation Consistency
     + Action / State-Machine Consistency
     + Editing / Mutability Contract
     + Cross-cutting Entity Change Audit Framework Integration
```

После D5 аналогичный D6 Booking scope. Не реализовывать сейчас.

# 28. AUTOMATED TEST GATE

Минимально PASS:

```text
D4 traveler security suite
D4 representative chain suite
new F1 concurrency tests
new F2 Platform/Storefront list/export scope tests
new S12 natural completion test
new S5 customer-decline test
new/updated F6 bulk traveler tests
D3 request-flow
D3 traveler-collection
TypeScript compile
```

Unrelated failures: reproduce on clean baseline + prove pre-existing + exact root cause.

# 29. BROWSER / API RUNTIME GATE

Минимум:

```text
D3 CASE A
C1 READY_FOR_BOOKING
C5 confirmed unpaid Booking
C6 cancelled/refunded chain
Platform Orders default
Platform Bookings default
explicit Storefront Orders filter → no exposure
explicit Storefront Bookings filter → no exposure
direct Storefront Order/Booking → 404
```

D5/D6 UI не реализовывать.

# 30. DB → API → UI RECONCILIATION

Повторно сверить D3 CASE A/B, C1, C5, C6 и security invariant:

```text
Storefront rows exist in DB
Storefront rows unavailable through Platform scope
```

# 31. DOCUMENTATION / ROADMAP SYNC

Обновить D4 report/evidence:

```text
F2 → explicit bypass CLOSED
S5 → decline SUPPORTED; auto-EXPIRED NOT IMPLEMENTED
S12 → natural completion evidence added
S19 → negative isolation PROVEN; positive Partner own-commerce DEFERRED
```

Сохранить debts:

```text
Partner own-scope commerce path
RBAC parity
PII retention/purge
Entity Change Audit Framework
D5/D6
D11/D12
```

Если canonical roadmap ещё не содержит новых confirmed debts/Entity Change Audit Framework — выполнить **additive roadmap sync**, не переписывая историю.

# 32. REQUIRED REMEDIATION REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D4_STRICT_REVIEW_REMEDIATION_CLOSURE_REPORT.md
```

Минимальная структура:

1. Executive Summary
2. Starting Git State
3. Canonical Architecture Check
4. D4SR-F1 Root Cause
5. F1 Concurrency Remediation
6. F1 Race Evidence
7. D4SR-F2 Root Cause
8. Platform/Storefront Scope Remediation
9. List/Export Negative Evidence
10. D4SR-F3 S12 Natural Completion
11. D4SR-F4 S5 Reclassification
12. S5 Decline Coverage
13. D4SR-F5 Manifest Correction
14. D4SR-F6 Bulk Traveler Remediation
15. PII/Security Regression
16. D3 Regression
17. Finance/Chain Regression
18. Runtime/Browser Evidence
19. DB→API→UI Reconciliation
20. Deferred Findings/Debts
21. Entity Change Audit Framework Preservation
22. Roadmap Sync
23. Findings Closure Matrix
24. Acceptance Matrix
25. Git Closure
26. Final Verdict
27. TRUE NEXT

# 33. FINDINGS CLOSURE MATRIX

| Finding | Severity | Before | Remediation | Evidence | Status |
|---|---|---|---|---|---|
| D4SR-F1 | P2 | TOCTOU | | | |
| D4SR-F2 | P2 | Storefront explicit filter bypass | | | |
| D4SR-F3 | P3 | S12 evidence gap | | | |
| D4SR-F4 | P3 | S5 misclassification | | | |
| D4SR-F5 | P3 | CASE A manifest UUID wrong | | | |
| D4SR-F6 | P3 | bulk traveler inconsistency | | | |
| D4SR-F7 | INFO | demo credentials | deferred/optional | | |
| D4SR-F8 | INFO/P3 | Partner positive path absent | deferred | | |

# 34. ACCEPTANCE MATRIX — HARD

| Gate | Result | Evidence |
|---|---|---|
| Starting Git clean | | |
| HEAD == origin/master | | |
| F1 root cause proven | | |
| F1 DB-level concurrency-safe | | |
| Single traveler race tested | | |
| Bulk traveler race tested | | |
| No post-final-confirm mutation possible in tested race | | |
| F2 explicit Order list bypass closed | | |
| F2 explicit Booking list bypass closed | | |
| Orders export bypass closed | | |
| Bookings export bypass closed | | |
| Storefront rows preserved in DB | | |
| Platform Marketplace positive path preserved | | |
| Direct Storefront 404 preserved | | |
| S12 natural completion chain PASS | | |
| S12 no direct final-state injection | | |
| S5 decline correctly classified | | |
| S5 decline natural test PASS | | |
| Auto-EXPIRED honestly remains NOT IMPLEMENTED | | |
| CASE A manifest corrected from live DB | | |
| Bulk passportExpiry behavior corrected/deprecated | | |
| Bulk completeness uses canonical pinned requirements | | |
| Post-final bulk mutation still denied | | |
| D4 security suite PASS | | |
| D4 chain suite PASS | | |
| D3 suites PASS | | |
| Finance/refund regressions absent | | |
| TypeScript compile PASS | | |
| Live runtime smoke PASS | | |
| DB→API→UI reconciliation PASS | | |
| No new PII exposure | | |
| F7 correctly deferred/closed | | |
| F8 explicitly deferred | | |
| Retention debt preserved | | |
| RBAC parity debt preserved | | |
| Entity Change Audit Framework preserved | | |
| D5/D6 scope preserved | | |
| Roadmap additive sync completed if required | | |
| Report predominantly Russian | | |
| Final worktree EXACTLY EMPTY | | |
| Final HEAD == origin/master | | |
| Push successful | | |

# 35. FINAL VERDICT RULE

## Success

Только если F1–F6 закрыты и hard gates PASS:

```text
VERDICT A — D4 STRICT REVIEW REMEDIATION CLOSURE PASSED

D4 — ACCEPTED
D4 REMEDIATION — CLOSED

Deferred non-blocking debts:
- D4SR-F7 if not cleaned
- D4SR-F8 Partner own-commerce positive path
- RBAC parity reconciliation
- Traveler PII retention/purge policy

TRUE NEXT:
CANONICAL ROADMAP / ARCHITECTURE SYNC CHECK
→ then D5
```

После sync:

```text
D5 — ORDER FULL-PAGE DETAIL
     + NAVIGATION CONSISTENCY
     + ACTION/STATE-MACHINE CONSISTENCY
     + EDITING/MUTABILITY CONTRACT
     + CROSS-CUTTING ENTITY CHANGE AUDIT FRAMEWORK INTEGRATION
```

## Failure

Если F1/F2 или иной hard gate остаётся:

```text
VERDICT B — D4 STRICT REVIEW REMEDIATION CLOSURE FAILED
D4 — NOT ACCEPTED
D5 — NOT STARTED
TRUE NEXT: specific D4 remediation
```

Не выдавать `VERDICT A` из-за того, что исходный Strict Review ранее поставил A.

# 36. GIT CLOSURE

После implementation/tests/evidence/report:

```bash
git status --short
git diff --check
git add <only intended files>
git commit -m "fix(d4): close strict review findings"
git push
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

Hard final:

```text
git status --short = EXACTLY EMPTY
HEAD == origin/master
```

Указать реальные SHAs.

# 37. STOP RULE

После remediation → tests → runtime evidence → report → roadmap sync if required → commit → push → final Git verification остановиться.

```text
STOP.
D5 NOT STARTED.
```
