# PHASE 3 — PRE-STEP 3.12 — SHARED COMMERCE SEQUENCE + REQUEST CENTER — SEED INTEGRITY & FINAL EVIDENCE CLOSURE

## TYPE

**NARROW REMEDIATION + FINAL EVIDENCE CLOSURE**

Это **не повторная реализация Shared Commerce Sequence / Request Center** и не новый широкий Strict Review.

Исходная бизнес-архитектура, canonical references, Request → Order conversion, shared `commerceSequence`, Payment ordinal, Platform/Storefront separation и уже доказанные инварианты **не должны переписываться без фактической необходимости**.

Цель — закрыть только противоречия evidence из последнего Full Strict Review: seed temporal/currency/milestone anomalies, fresh-seed reproduction, Refund chronology, authenticated runtime evidence и identifier contract.

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**: Remediation/Strict Review/Evidence reports, findings, root cause, architecture/security decisions, runtime evidence, conclusions и verdict explanations.

English допустим только для технических идентификаторов: paths, classes/methods/DTO/models/tables, API endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, permissions, code snippets и standardized `VERDICT A/B`.

**Hard acceptance criterion:** преимущественно English report = задача не завершена. Реальные passwords/tokens/API keys/secrets в report запрещены; только redaction/placeholders.

## 1. BASELINE — VERIFY FIRST

Зафиксировать реальные `Starting SHA`, `HEAD`, `origin/master`, `git status`. Из предыдущего report известны SHA `2d8af1f...`, `ce208cb...`, `b36fe4f...`, но не считать их текущими автоматически. Если после них были commits — описать delta.

## 2. DO NOT REOPEN PROVEN ARCHITECTURE

Без нового дефекта не перепроектировать:

```text
Request → optional validation → Order → Booking → Payment → Refund
Request.commerceSequence = Order.commerceSequence
MKT-REQ-* / MKT-ORD-* / MKT-BKG-* / MKT-PAY-*-{ordinal} / MKT-REF-*
Payment.paymentOrdinal >= 1
```

Supplier confirmation не создаёт final Booking. Price change требует explicit customer acceptance. Не менять эти контракты ради seed cleanup.

## 3. SEED GENERATOR — ROOT CAUSE REMEDIATION

Провести field-by-field audit `backend/prisma/seed.ts`, `backend/prisma/seed-requests.ts` и helpers для Orders/Bookings/Payments/Refunds/Requests, timestamps, currencies, statuses.

Representative seed должен создавать реалистичные domain-valid chains. Если fresh seed воспроизводит impossible domain states, их нельзя списывать как historical artifacts.

## 4. TEMPORAL INTEGRITY

Из production logic определить authoritative chronology. Проверить минимум:

```text
Booking.createdAt >= Order.createdAt
Payment.createdAt >= Order.createdAt
Refund.createdAt >= Payment.createdAt
```

Если `paidAt` = successful capture/receipt, проверить `Refund.createdAt >= Payment.paidAt`. Если семантика иная — доказать source + runtime evidence. Нельзя принять `834 seed artifacts` без точного invariant proof.

## 5. BOOKING COMPLETED INTEGRITY

Если canonical contract:

```text
Booking.status = COMPLETED ⇒ Booking.completedAt IS NOT NULL
```

то fresh seed должен иметь **0 violations**, без threshold waiver `<N`. Проверить также relation `serviceDate/completedAt/COMPLETED` согласно production lifecycle. Если semantics иная — доказать state machine/service/UI/docs.

## 6. ORDER ↔ PAYMENT CURRENCY / AMOUNT

Предыдущий root 107 (`136.8 AZN` Order vs `939.16 USD` Payment) признан seed random-currency artifact. Если завершённого FX settlement contract нет, seed не должен создавать такие pairs.

Для обычного flow обеспечить фактический production contract, включая `Payment.currency = Order.currency`, если именно это требует модель. Учесть legitimate partial/multiple payments. **Не начинать FX Architecture Amendment и не фабриковать exchange rates.**

## 7. PAYMENT ↔ REFUND

Сохранить `Refund.currency = Payment.currency`, refund ceiling, добавить chronology. Если multiple/partial refunds допустимы — проверить aggregate ceiling и collision safety `MKT-REF-*`; если только один refund — доказать schema/service constraint.

## 8. REQUEST REGRESSION

После seed remediation проверить:

```text
Request.createdAt <= supplierRespondedAt
Request.createdAt <= customerAcceptedAt
Request.createdAt <= Order.createdAt
Request.commerceSequence = Order.commerceSequence
```

Более строгий порядок применять только если его реально требует production workflow.

## 9. SUPPLIER SLA / CUSTOMER TTL

Не перепроектировать, если implementation корректна. Доказать server-side enforcement: policy/deadline, expiration check, поведение после expiration, отсутствие downstream commerce. Expired customer acceptance не должна создавать Order. Если enforcement фактически отсутствует — это finding.

## 10. PRICE CHANGE ACCEPTANCE

Automated/runtime evidence:

```text
supplier changes price → proposal/current terms updated → no Order → explicit customer acceptance → conversion may proceed
```

Source inspection alone недостаточен.

## 11. SUPPLIER CONFIRMATION ≠ BOOKING

Explicit regression test:

```text
Supplier confirms Request → milestone changes → Order absent until required conversion → Booking absent
```

## 12. FRESH-SEED REPRODUCTION — MANDATORY

Не разрушать рабочую dev DB. Создать isolated disposable DB/schema, применить migrations, выполнить полный representative seed, invariant tests/SQL, сохранить evidence, затем cleanup.

Зафиксировать DB name, migration result, seed result, counts, invariant counts, cleanup.

Минимум:

```text
Booking.createdAt < Order.createdAt = 0
Payment.createdAt < Order.createdAt = 0
invalid Refund chronology = 0
COMPLETED without required completedAt = 0
COMPLETED before allowed lifecycle boundary = 0
invalid Order↔Payment currency relation = 0
Request.createdAt > converted Order.createdAt = 0
supplierRespondedAt < Request.createdAt = 0
customerAcceptedAt < Request.createdAt = 0
shared commerceSequence mismatch = 0
duplicate active payment ordinal = 0
over-refund / refund currency mismatch = 0
```

Если predicate не является domain invariant — доказать почему и заменить точным canonical predicate. Fresh-seed gate нельзя пропускать как “destructive”; использовать isolated DB.

## 13. REPRESENTATIVE DATASET FITNESS

После remediation сохранить разнообразие Marketplace/Storefront Orders, Bookings, Payments, Refunds, Requests, converted/cancelled/time-out Requests, valid multi-currency independent transactions, mixed customers, lifecycle statuses и данные для Analytics/KPI. Не превращать seed в happy-path-only.

## 14. MASTER-DATA IDENTIFIER CONTRACT

Разрешить противоречие report: `CUS-*` vs `CRM-*`, `PAR-*` vs `PRN-*`. Audit DB/schema/service/UI/export/search и определить текущий canonical contract из утверждённой архитектуры/roadmap. Не делать migration только потому, что старый test ожидал иной prefix. Report не может одновременно утверждать разные canonical prefixes.

## 15. REFERENCE WIDTH

Не заменять строгий business format на permissive `\d+` только ради PASS. Если canonical требует 8 digits — исправить allocator/seed/presentation. Если variable width утверждён — привести точное evidence. Frontend-only padding запрещён. DB=API=UI=export=search.

## 16. AUTHENTICATED RUNTIME EVIDENCE

`307 → /login` = auth gate, но не authenticated UI semantics. Проверить после auth минимум `/app/orders`, `/app/bookings`, `/app/crm`, `/app/analytics` и Request Center route, если существует: render, canonical refs, navigation/drill-down, scope, runtime errors.

Если browser технически недоступен, поставить `NOT EXECUTED`, выполнить максимально близкий authenticated API/runtime check и честно описать limitation; не превращать redirect в semantic browser PASS.

## 17. REQUEST CENTER ROUTE

Предыдущий report: `Request Center UI route — Not found`. Определить существует ли UI Request Center, canonical route, workspace/permission/navigation/list/detail. Если UI должен быть в completed scope и отсутствует — blocker `VERDICT B`. Если approved scope backend/domain-only — привести roadmap/prompt evidence. Не оставлять неопределённым Informational.

## 18. REGRESSION TEST MATRIX

Сохранить существующие tests и явно покрыть:

```text
canonical refs
shared Request↔Order commerceSequence
Request chronology
supplier confirmation does not create Booking
price change explicit acceptance
Supplier SLA enforcement
Customer TTL enforcement
timeout no downstream commerce
payment ordinal + concurrency/idempotency
refund amount/currency + chronology
multiple refund safety if supported
Booking COMPLETED milestone
Order→Booking chronology
Order→Payment chronology
Order↔Payment currency/amount
Platform/Storefront isolation
Customer 360 scope
mixed customers
master-data identifier contract
```

Hard invariants без threshold waivers.

## 19. BROADER SUITES

Запустить релевантные backend targeted tests, backend build/typecheck, frontend tests/typecheck и practically runnable project-standard suites. Report: exact `passed/failed/skipped/total`. Required FAIL нельзя назвать PASS.

## 20. EXPORT REGRESSION

Реально скачать CSV/XLSX для affected Orders, Bookings, Customer 360. Для deterministic выборки проверить:

```text
filtered total = CSV data rows = XLSX data rows
```

Canonical references primary; legacy Code не дублируется как business reference.

## 21. SECURITY / TENANT ISOLATION

Проверить Platform Marketplace scope, Storefront Partner A only A, Partner B only B. `acquisitionSource` = provenance/business classification, не authorization boundary. Если isolation держится только на acquisitionSource — security finding и `VERDICT B`.

## 22. DO NOT START UNRELATED WORK

Не начинать Product Freshness, Partner 360/Calendar remediation, Finance Center, FX Amendment, Step 3.12, redesign или unrelated Analytics. Не создавать новый Finance Center.

## 23. REQUIRED REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_SHARED_COMMERCE_SEQUENCE_REQUEST_CENTER_SEED_INTEGRITY_FINAL_EVIDENCE_CLOSURE_REPORT.md
```

Минимум: Starting/Final/origin SHA, changed files, contradiction matrix, seed root cause/remediation, fresh isolated DB evidence, temporal/COMPLETED/financial/refund/Request evidence, SLA/TTL, price acceptance, supplier-confirmation test, refs/width/master identifiers, tenant isolation, authenticated runtime, Request Center route decision, CSV/XLSX, exact tests, remaining gaps, roadmap, Final Verdict.

## 24. ROADMAP UPDATE

Additive-only update `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`: preserve history, real SHAs, remediation, fresh-seed result, A/B, remaining gaps, exact NEXT. Не менять numbering молча.

## 25. FINAL VERDICT RULES

`VERDICT A` только если fresh isolated seed выполнен; hard temporal/COMPLETED/Order↔Payment/Refund/Request violations = 0; supplier confirmation/price acceptance/SLA/TTL/timeout proven; commerceSequence/payment ordinal/idempotency/tenant isolation PASS; identifier contradiction и Request Center route conclusively resolved; required tests/exports PASS; runtime evidence truthful; no mandatory gate silently downgraded; report predominantly Russian.

`VERDICT B` обязателен при любом hard violation, отсутствии mandatory evidence, impossible fresh-seed states, недоказанной tenant isolation или новом contradiction evidence vs checklist.

## 26. GIT CLOSURE

После implementation + report + roadmap:

```text
git status
git log -1 --oneline
git rev-parse HEAD
git rev-parse origin/master
```

Commit/push обязательны по repository workflow. Только реальные SHA.

## 27. STOP

После Final Verdict — `STOP`. Не запускать следующий PRE-STEP. При A только назвать canonical NEXT для решения пользователя; при B — точный остаточный remediation scope.

## EXPECTED FINAL RESPONSE

```text
SEED INTEGRITY & FINAL EVIDENCE CLOSURE — COMPLETED

Starting SHA:
Final SHA:
origin/master:
Fresh isolated seed:
Hard invariant violations:
Tests:
Runtime:
Exports:
Request Center route:
Roadmap:

FINAL VERDICT: A | B
Remaining gaps:
NEXT:
STOP
```
