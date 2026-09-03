# PHASE 3 — PRE-STEP 3.12 — D4 — STRICT REVIEW

## ROLE — MANDATORY
Ты работаешь как **Independent Senior Software Architect + Principal Code Reviewer + Application Security Reviewer + Database/Data Integrity Reviewer + QA Engineer**.

Implementation report и existing code — evidence, но не canonical business truth. Независимо проверить Source → DB → Permissions → API → UI → Runtime → Representative Data → Security → Git. Root cause до remediation. Не исправлять product code в Strict Review. Не начинать D5.

## LANGUAGE REQUIREMENT — MANDATORY
Все отчёты/findings/root cause/security conclusions/verdict explanations — преимущественно **на русском**. English только для identifiers/code/paths/endpoints/enums/permissions/commands/SHA/VERDICT. Не помещать plaintext secrets, tokens или full sensitive PII в evidence.

## 1. BASELINE
D4 Implementation заявляет: security 10/10, representative chains 4/4, browser 18/18; implementation `c99ec7c`, final docs sync `65c829b`. Ничему из этого не доверять без независимого воспроизведения.

Стартовый hard gate:
```bash
git branch --show-current
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -10 --oneline
```
Ожидание: master, оба status EXACTLY EMPTY, HEAD == origin/master.

## 2. REVIEW D4 DIFF
Проверить migration новых finance permissions, `permissions.constants.ts`, Order/Booking services/query/controller/validation, D4 security/chain tests, seed builder и `docs/evidence/d4/`. Искать bypass paths, scope creep, false-positive tests, mass-assignment, transactionality и tenant leaks.

## 3. F1 — TRAVELER IMMUTABILITY
Независимо найти **все** mutation paths traveler data: bulk/single PATCH, Order DTO/nested writes, internal commands, Booking/Passenger sync, Request conversion, helpers и application-level Prisma writes.

Hard invariant:
```text
finalConfirmedAt != NULL
→ ordinary API/user flow cannot mutate confirmed traveler data
```
Проверить firstName/lastName/birthDate/citizenship/gender/passportNumber/passportExpiry, travelerCount и pinnedRequirements. UI disabled не является security.

## 4. ANTI-MASS-ASSIGNMENT
Probe минимум: travelerCount, pinnedRequirements, termsAcceptedAt, travelerDataCompletedAt, finalConfirmedAt, version, orderId, partnerId, acquisitionSource, status, commerceSequence. Проверить bulk/single traveler, Order update, lifecycle, Request conversion и Booking commands. Server-owned fields должны быть недоступны client payload.

## 5. PII ROLE/FIELD MATRIX — HARD
Независимо проверить:
```text
ADMIN DIRECTOR OPERATOR SALES_MANAGER FINANCE ANALYST MARKETER MODERATOR + Partner context
```
на `GET /orders/:id`, `/orders/:id/travelers`, `/orders`, `/bookings/:id`, `/bookings`.

Для firstName/lastName/birthDate/citizenship/gender/passportNumber/passportExpiry составить:
| Role | Endpoint | Business Need | Full | Redacted | Denied | Correct? |

Для каждого full sensitive access объяснить business need. ADMIN не получает оправдания только из-за названия роли. Если field access hardcoded по role names вместо capability/permission — отдельный architecture/security finding.

## 6. LIST DATA MINIMIZATION
Проверить raw JSON list/search/pagination Orders/Bookings. Никаких unnecessary full passportNumber/birthDate/passportExpiry.

## 7. F2 — PLATFORM/STOREFRONT ISOLATION
Negative:
- Platform → Storefront Order/Booking/travelers/direct UUID/commands/search = hidden/denied;
- Partner A → Partner B = denied.

Positive:
- legitimate Storefront owner может работать со своей commerce chain через соответствующий Partner contract;
- trusted internal calls работают только при явно доказанном scope enforcement.

Не принять blanket 404, если он сломал Partner Workspace.

## 8. TRUSTED INTERNAL BYPASS AUDIT
Для каждого bypass/viewer-less/internal path документировать caller, callee, reason, user-input reachability, scope/tenant enforcement и тест. External request → trusted bypass без эквивалентной authorization = blocker.

## 9. F3 — FINANCE PERMISSIONS
Проверить catalog → constants/defaults → DB RolePermission → migration → endpoint guards → runtime.

Positive: FINANCE/разрешённые роли.
Negative минимум: OPERATOR, SALES_MANAGER, ANALYST, MARKETER, MODERATOR.

Отдельно проверить create/confirm/fail/cancel Payment и create/approve/process/fail Refund. Не предполагать, что create/approve/execute — одно право.

## 10. RBAC PARITY DRIFT — HARD
Implementation признал `DB RolePermission != ROLE_PERMISSIONS constants` и failing `rbac-parity/rbac-actions`.

Определить source-of-truth и проверить existing DB + isolated fresh DB, включая новые FINANCE permissions и ADMIN behavior.

Решение обязательно:
```text
A. drift доказанно не влияет на D4 authorization guarantees
или
B. drift способен менять runtime/fresh-DB authorization → D4 blocker → VERDICT B
```
"pre-existing" не является waiver.

## 11. FRESH DB
На isolated DB, без reset основной dev DB, доказать migration chain, наличие новых permission keys, intended/unintended role assignment и runtime guard resolution.

## 12. REPRESENTATIVE SEED AUDIT
Проверить `tmp_d4_seed.mjs` и e2e builders. Не должно быть direct final-state cheating (`prisma.update status`, SQL final status, fabricated lifecycle timestamps, direct payment/refund finalization). Setup prerequisites допустимы; конечные lifecycle states должны возникать через реальные domain/API commands.

## 13. C1–C6 MANIFEST
Reconcile `docs/evidence/d4/D4_REPRESENTATIVE_COMMERCE_CASES.md` с DB/API:
C1 READY_FOR_BOOKING; C2 supplier confirmed/customer pending; C3 supplier waiting; C4 unavailable; C5 confirmed unpaid Booking; C6 paid→cancelled→full refund. Manifest без full sensitive PII.

## 14. S12 COMPLETION — STRENGTHEN
Historical COMPLETED недостаточно. В isolated e2e доказать natural chain:
```text
Order → Booking → supplier confirmation → Payment as required → completion command → COMPLETED
```
Если actual completion невозможно доказать — S12 не PASS, создать Finding.

## 15. S17 AUTHORITATIVE NO-REQUEST — STRENGTHEN
Legacy Order без Request сам по себе не доказывает authoritative flow. Установить реальный creation path, accepted/frozen terms, traveler requirements, final-confirm gate и Booking eligibility. Если flow не доказан — `NOT PROVEN`, не PASS.

## 16. S5 / S10
Подтвердить, что S5 TTL/EXPIRED и S10 partial payment действительно не поддерживаются. Не изобретать enum/workflow; сохранить architecture debt.

## 17. FINANCIAL INTEGRITY
Независимо проверить amount>0, currency, Payment→Order, Refund→Payment, sum(refunds)<=paid, over-refund denial, partial/full refund projections и remaining refundable amount. Проверить idempotency/concurrent double execution, если endpoint обязан быть concurrency-safe.

## 18. TEMPORAL INTEGRITY
Проверить реальные timestamps:
```text
Request.createdAt <= customerAcceptedAt <= Order.createdAt
Order.createdAt <= finalConfirmedAt <= Booking creation/request
Payment.paidAt >= commercial creation
Refund.createdAt >= Payment.paidAt
```
Не заменять lifecycle timestamp через updatedAt.

## 19. D3 REGRESSION
Запустить `d3-request-flow.e2e-spec.ts`, `d3-traveler-collection.e2e-spec.ts`; проверить CASE A `MKT-ORD-09000547` и CASE B `MKT-ORD-09000548`.

## 20. TEST QUALITY
Не ограничиваться 10/10 и 4/4. Проверить assertions: реальные разные tenants, правильные authenticated roles, Storefront acquisitionSource, finalConfirmedAt действительно установлен, 404 не от unrelated reason, transition sequence реально доказана.

## 21. INDEPENDENT BROWSER/RUNTIME
Собственный smoke: D3 CASE A, C1, C2/C3/C4, C5, C6, Platform registry excludes Storefront, direct Storefront URL denied; по возможности Partner positive access. Не исправлять D5/D6 drawer/full-page inconsistency.

## 22. DB → API → UI
Для C1–C6 сверить reference/status/relations/traveler state/payment/refund/amount/currency. Любое DB != API или API != UI = Finding.

## 23. LOG/EVIDENCE SAFETY
Проверить repository/evidence на tokens, Authorization headers, passwords, login dumps, raw traveler payload/full passport. В report найденный secret не копировать.

## 24. PRIVACY/RETENTION
Фраза implementation `"жизнь объекта"` — technical behavior, не canonical retention policy. Зафиксировать privacy/architecture debt без выдумывания legal retention period.

## 25. CROSS-CUTTING ENTITY CHANGE AUDIT FRAMEWORK — PRESERVE
Новое принятое cross-cutting требование, **не реализовывать в D4 SR**:
```text
Request / Order / Booking mutation
→ validation
→ permission/scope
→ lifecycle mutability
→ successful mutation
→ immutable audit record
```
Audit: entityType/entityId, field/action, oldValue/newValue, changedAt/changedBy, workspace, source, reason/comment where required; отдельно lifecycle/status transitions. Sensitive PII не дублировать plaintext old/new — redact/mask/hash/fact-of-change.

Сохранить для D5, D6 и Request requalification.

## 26. PRESERVE D5/D6
D5:
```text
ORDER FULL-PAGE DETAIL
+ Navigation Consistency
+ Action/State-Machine Consistency
+ Editing/Mutability Contract
+ Immutable Change History
```
Known defect: один и тот же NEW Order — drawer из Orders имеет `Принять в работу`, full-page из Request не имеет. Future invariant:
```text
SAME ORDER + USER + WORKSPACE + STATUS + PERMISSIONS
= SAME AVAILABLE ACTIONS
```
D6 аналогично для Booking. `MKT-ORD-* → /app/orders/{id}`, `MKT-BKG-* → /app/bookings/{id}`. Drawer только explicit Quick Preview.

## 27. PRESERVE D11/D12
Не чинить KPI/status reconciliation, Active Customers 51→CRM92/global183, `crm.filter.clear_dates`, Help formulas. Это D11/D12.

## 28. REGRESSION
Минимум: D4 security, D4 chains, D3 request, D3 traveler, TypeScript compile + релевантные RBAC/finance suites. "pre-existing" failures независимо подтвердить baseline.

## 29. FINDINGS MATRIX
| ID | Severity | Surface | Finding | Evidence | Root Cause | Blocks D4? | Required Remediation |
Unresolved P0/P1 security/tenant/finance-integrity = automatic VERDICT B.

## 30. CLAIM REQUALIFICATION MATRIX
| Claim | Implementation says | Independent Evidence | Result |
Обязательно: F1/F2/F3/F4, 10/10, 4/4, 18/18, no regression, isolation, finance, temporal, D3 preserved, Git clean.

## 31. REPORT
Создать:
`docs/reports/PHASE_3_PRE_STEP_3.12_D4_TRAVELER_SECURITY_REPRESENTATIVE_COMMERCE_STRICT_REVIEW_REPORT.md`

Разделы: Executive Summary; Starting Git; Diff; Architecture; F1; Anti-mass-assignment; PII matrix; Lists; Isolation; Internal bypass; Finance permissions; RBAC/Fresh DB; Seed/Manifest; S12; S17; S5/S10; Finance; Temporal; D3; Test quality; Browser; Reconciliation; Evidence safety; Retention debt; Entity Audit Framework preservation; D5/D6/D11/D12 preservation; Findings; Claim Matrix; Acceptance; Git; Verdict; TRUE NEXT.

## 32. HARD ACCEPTANCE
PASS требуется для:
- clean starting/final Git, HEAD==origin;
- all traveler mutation paths audited and locked post-final;
- mass-assignment protected;
- all relevant roles PII-reviewed/business-justified;
- list minimization;
- Platform↔Storefront and Partner↔Partner isolation + legitimate positive Partner path;
- trusted bypass safe;
- finance positive + negative RBAC;
- RBAC drift assessed and fresh DB proven;
- seed no final-status cheating;
- C1–C6 reconciled;
- S12 natural completion proven;
- S17 proven or honestly downgraded with blocker decision;
- financial/temporal integrity;
- D3 preserved;
- D4 tests pass and assertions are valid;
- independent browser smoke;
- DB==API==UI;
- no exposed secrets/unnecessary PII;
- retention debt documented;
- Entity Change Audit Framework + D5/D6/D11/D12 findings preserved;
- no unresolved P0/P1;
- no new D4 regression;
- report predominantly Russian.

## 33. VERDICT RULE

Success only if all hard gates:
```text
VERDICT A — D4 STRICT REVIEW PASSED
D4 — ACCEPTED

TRUE NEXT:
D5 — ORDER FULL-PAGE DETAIL
     + NAVIGATION CONSISTENCY
     + ACTION/STATE-MACHINE CONSISTENCY
     + EDITING/MUTABILITY CONTRACT
     + CROSS-CUTTING ENTITY CHANGE AUDIT FRAMEWORK INTEGRATION

D6 remains next after D5.
```

If any blocker:
```text
VERDICT B — D4 STRICT REVIEW FAILED
D4 — NOT ACCEPTED
REMEDIATION REQUIRED
```
TRUE NEXT = targeted D4 remediation, not D5.

## 34. GIT / STOP
Strict Review не делает product remediation. Report/evidence при необходимости commit+push. Final:
```text
git status --short = EXACTLY EMPTY
HEAD == origin/master
```
Только реальные SHA, никаких `…`, `TBD`, `pending`.

После evidence → report → verdict → Git verification:
```text
STOP.
```
