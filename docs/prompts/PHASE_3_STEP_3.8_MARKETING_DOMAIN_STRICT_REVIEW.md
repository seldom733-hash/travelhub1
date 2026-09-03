# PHASE 3 — STEP 3.8 — MARKETING DOMAIN — STRICT REVIEW

## 0. REVIEW MODE

**STRICT REVIEW ONLY.**

Implementation и remediation уже выполнены.

Известная цепочка:

```text
Step 3.8 implementation SHA:     541fe4b
Step 3.8.1 evidence SHA:         8b32e34
Step 3.8.2 remediation SHA:      38d88fd
Final evidence closure SHA:      b8627b7
```

Текущий ожидаемый статус:

```text
STEP 3.8.2 CLOSED
STEP 3.8 READY FOR STRICT REVIEW
```

Цель этой задачи — независимо проверить весь Step 3.8 и только после этого решить, можно ли закрыть Step 3.8 целиком.

Не доверять предыдущим `VERDICT A` автоматически.

---

## 1. LANGUAGE REQUIREMENT — MANDATORY

Весь Strict Review Report и все пояснения должны быть написаны **на русском языке**.

Обязательно на русском:

- обзор;
- findings;
- root cause explanations;
- architecture conclusions;
- security conclusions;
- runtime evidence descriptions;
- test analysis;
- roadmap analysis;
- risk classification;
- final verdict explanation.

Допускается оставлять на английском только:

- имена файлов и путей;
- классы, методы, DTO, модели, таблицы;
- endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enum/permission identifiers;
- технические идентификаторы;
- код;
- стандартизированные строки VERDICT.

Если итоговый report преимущественно на английском — Strict Review считается незавершённым.

---

## 2. HARD REVIEW SCOPE

Проверить весь Step 3.8:

```text
Campaign
Audience
Attribution
Lifecycle
RBAC
Workspace authority
Partner data scope
Partner access denial
Audience criteria contract
PII/contact-policy safety
runtime correctness
tests
migration/schema
Git history
documentation
canonical roadmap compatibility
```

Не реализовывать новые Marketing features.

Не добавлять:

```text
Marketing UI
EMAIL/SMS/PUSH
consent/preferences
automation/journeys
multi-touch attribution
new analytics
Storefront Marketing entitlement
new Partner permission model
new CRM model
```

Если обнаружен дефект — зафиксировать его. Не исправлять скрытно в рамках review.

---

## 3. PREFLIGHT / REPOSITORY TRUTH

Выполнить:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -20 --oneline
```

Ожидается:

```text
HEAD:          b8627b7
origin/master: b8627b7
```

Если отличается — установить причину.

Проверить историю commit chain:

```text
541fe4b
8b32e34
38d88fd
b8627b7
```

Проверить, что remediation действительно находится поверх implementation, а evidence closure не скрывает production changes.

---

## 4. REVIEW SOURCES

Обязательно изучить:

```text
canonical roadmap
Step 3.8 implementation report
Step 3.8.1 evidence report
Step 3.8.2 remediation report
Step 3.8.2 final evidence closure
backend/src/modules/marketing/**
backend/prisma/schema.prisma
Step 3.8 migration
relevant CRM/Order/Booking authorities
permission definitions/guards
workspace/tenant/partner scope logic
relevant tests
```

Не основываться только на отчётах.

---

## 5. ARCHITECTURE REVIEW

Проверить, что Marketing Domain не дублирует существующие bounded contexts.

### Campaign

Должен владеть только Marketing campaign state.

Проверить:

```text
id
code/reference
name
status/lifecycle
partner scope, если есть
createdBy
timestamps
```

Не должен копировать:

```text
Customer
Order
Booking
Communication
Payment
Product
```

### Audience

Проверить, что Audience представляет маркетинговый критерий/сегмент, а не отдельную копию Customer данных.

### Attribution

Проверить, что Attribution остаётся additive relation к canonical entities.

Не допускается mutation:

```text
Order.acquisitionSource
Booking source
CRM source
```

только ради Marketing attribution.

---

## 6. CAMPAIGN LIFECYCLE REVIEW

Проверить фактический state machine.

Ожидаемая логика:

```text
DRAFT
→ SCHEDULED
→ ACTIVE
→ PAUSED / COMPLETED / CANCELLED
```

Проверить:

- допустимые переходы;
- запрещённые переходы;
- отсутствие обхода lifecycle через generic update;
- невозможность resurrect terminal state без явной архитектуры;
- auditability actor/time;
- controlled 4xx на invalid transition.

Повторить минимум один valid и один invalid runtime transition.

---

## 7. RBAC / ACCESS AUTHORITY REVIEW

Проверить фактические `marketing.*` permissions.

Ожидаемая текущая модель:

```text
ADMIN       → marketing.*
DIRECTOR    → marketing.*
MARKETER    → marketing.*
OPERATOR    → marketing.*

PARTNER     → none
FINANCE     → none
BUYER       → none
ANALYST     → none
MODERATOR   → none
SALES_MANAGER → none
```

Не принимать это только из report — проверить code/seed/runtime.

Минимальный runtime:

```text
ADMIN → allowed
MARKETER → allowed
PARTNER → 403
FINANCE → 403
Anonymous → 401
```

---

## 8. PLATFORM-ONLY VS PARTNER-SCOPED DATA

Это отдельный critical review gate.

Проверить и подтвердить:

```text
Partner-scoped Campaign
≠
Partner actor access
```

Текущая заявленная архитектура:

```text
Marketing API = Platform-only
Campaign.partnerId = data scope / future extensibility
```

Проверить, что:

- Platform actor может корректно работать с partner-scoped Campaign;
- Partner actor не получает Marketing access;
- partnerId в Campaign не превращается в entitlement bypass;
- caller не может forged `partnerId`;
- foreign Partner entity нельзя привязать к Partner A Campaign.

---

## 9. ATTRIBUTION REFERENTIAL INTEGRITY

Проверить повторно:

```text
CUSTOMER
LEAD
ORDER
BOOKING
```

Для каждого реально поддерживаемого type.

### Must pass

```text
valid entity → success
nonexistent entity → controlled 404/422
wrong-type UUID → controlled 404/422
foreign tenant entity → controlled reject
duplicate → controlled 409/422/idempotent
```

### Must not happen

```text
raw 500
silent persistence
cross-tenant reference
type confusion
client-controlled ownership
```

Проверить DB persistence после reject.

---

## 10. LEAD SEMANTICS REVIEW

Особо проверить:

```text
entityType = LEAD
```

Установить, существует ли реальная каноническая `Lead` entity/table.

Если `LEAD` действительно отдельный domain entity — подтвердить.

Если CRM архитектура использует lifecycle внутри Customer/PCR, а отдельная `Lead` table была создана/использована без архитектурного основания — это finding.

Не принимать `prisma.lead.findUnique` автоматически как доказательство корректной архитектуры.

---

## 11. AUDIENCE CRITERIA REVIEW

Проверить фактический whitelist:

```text
lifecycle
leadSource
tags
status
customerType
```

Для каждого поля подтвердить:

- существует ли такое каноническое поле/понятие;
- тип;
- семантика;
- отсутствие arbitrary query execution;
- отсутствие tenant override;
- отсутствие contact-policy bypass.

Проверить, что rejected:

```text
email
phone
url
address
socialHandle
partnerId
tenantId
ownerId
createdById
password
auth
token
secret
rawSql
query
$where
$expr
unknown field
nested object
```

Если whitelist содержит поля, которых нет в реальной CRM authority, классифицировать как contract drift.

---

## 12. DUPLICATE ERROR HANDLING REVIEW

Проверить код обработки Prisma `P2002`.

Должно быть:

```text
target unique conflict → controlled 409/422
unrelated DB error → not swallowed
```

Проверить unit test и runtime.

Нельзя использовать:

```text
catch-all → Conflict
```

---

## 13. SECURITY / PII REVIEW

Проверить Marketing response payloads.

Не должно быть:

```text
email
phone
password
auth token
raw contact details
foreign tenant metadata
internal Prisma error
stack trace
```

Особенно проверить Audience и Attribution read/list endpoints.

Проверить, что Marketing не создаёт обход коммуникационной политики Marketplace.

---

## 14. SCHEMA / MIGRATION REVIEW

Проверить Step 3.8 migration.

Подтвердить:

- migration применима с чистой БД;
- таблицы/indices/constraints соответствуют Prisma schema;
- unique constraint attribution существует;
- FK/nullable decisions осознанны;
- нет destructive unrelated changes;
- Step 3.8.2 действительно не требовал новой migration.

Не изменять старую migration в review.

---

## 15. AUTOMATED TEST REVIEW

Не только запустить — оценить качество тестов.

Проверить наличие assertions на:

```text
valid Campaign CRUD/lifecycle
invalid lifecycle
nonexistent attribution
type confusion
duplicate
foreign Partner scope
Audience valid criteria
Audience blocked criteria
PARTNER 403
FINANCE 403
anonymous 401
PII regression
```

Запустить:

```text
Marketing tests
Communication tests
relevant CRM tests
relevant Order/Booking tests
Security/RBAC tests
TypeScript
Build
```

Указать точные counts.

---

## 16. AUTHENTICATED RUNTIME STRICT MATRIX

Минимум:

| Gate | Expected |
|---|---|
| ADMIN campaign create | 201 |
| MARKETER campaign create | 201 |
| PARTNER campaign read | 403 |
| PARTNER campaign create | 403 |
| PARTNER attribution create | 403 |
| FINANCE marketing read | 403 |
| Anonymous marketing read | 401 |
| valid CUSTOMER attribution | 201 |
| nonexistent CUSTOMER | 404/422 |
| valid ORDER attribution | 201 |
| nonexistent ORDER | 404/422 |
| valid BOOKING attribution | 201 |
| nonexistent BOOKING | 404/422 |
| type confusion | reject |
| duplicate attribution | controlled non-500 |
| foreign Partner entity | reject |
| valid Audience criteria | 201 |
| blocked contact criteria | 422 |
| invalid lifecycle | 422 |
| valid lifecycle | success |
| PII disclosure | none |

Для reject gates доказать DB unchanged.

---

## 17. CLEANUP REVIEW

После runtime review:

```text
task-owned Campaigns = 0
task-owned Audiences = 0
task-owned Attributions = 0
task-owned disposable CRM entities = 0
task-owned Orders/Bookings = 0
```

Не удалять pre-existing data.

---

## 18. DOCUMENTATION CONSISTENCY

Проверить, что final Step 3.8.2 report:

- на русском;
- не содержит placeholders;
- не утверждает `Partner → 201`;
- корректно различает data scope и access authority;
- содержит реальные SHAs;
- не говорит `Step 3.8 CLOSED` до Strict Review.

---

## 19. CANONICAL ROADMAP REVIEW

Проверить canonical roadmap.

Нужно подтвердить:

```text
Step 3.8 = Marketing Domain
Campaign
Audience
Channel
Attribution
Lifecycle
```

Проверить, что deferred items не выдаются за completed.

Особенно:

```text
Channel
consent
Marketing UI
Partner Marketing entitlement
automation
analytics
```

Если canonical Step 3.8 прямо требует больше, чем реализовано, это finding.

Если они явно deferred отдельными future stages — зафиксировать соответствие.

---

## 20. FINDING CLASSIFICATION

Использовать:

```text
P0 — catastrophic/security-critical/systemic corruption
P1 — major security/authority/data-integrity defect
P2 — material correctness/contract defect
P3 — minor/documentation/hardening issue
```

Нельзя выдавать `VERDICT A`, если остаётся unresolved P0/P1/P2.

P3 допустим только если:

- не влияет на correctness/security;
- явно documented;
- не противоречит canonical contract.

---

## 21. STRICT REVIEW REPORT

Создать:

```text
docs/prompts/PHASE_3_STEP_3.8_MARKETING_DOMAIN_STRICT_REVIEW_REPORT.md
```

На русском языке.

Структура:

```text
1. Review baseline
2. Commit chain
3. Architecture review
4. Campaign lifecycle
5. RBAC / Workspace authority
6. Platform-only vs Partner scope
7. Attribution integrity
8. LEAD semantics
9. Audience criteria
10. Security / PII
11. Schema / Migration
12. Tests
13. Runtime matrix
14. Cleanup
15. Roadmap compliance
16. Findings
17. Git evidence
18. Verdict
```

---

## 22. GIT POLICY FOR STRICT REVIEW

Если review не требует production changes, допустим только report/docs commit.

Перед commit:

```bash
git status --short
git diff --name-only
git diff
```

Не stage unrelated dirty files.

После report:

```bash
git add docs/prompts/PHASE_3_STEP_3.8_MARKETING_DOMAIN_STRICT_REVIEW_REPORT.md
git commit -m "docs(marketing): strict review Step 3.8"
git push origin master
git rev-parse HEAD
git rev-parse origin/master
```

Записать реальные:

```text
Strict Review SHA:
Final HEAD:
origin/master:
HEAD == origin/master:
```

---

## 23. SUCCESS VERDICT

Только если:

```text
no unresolved P0
no unresolved P1
no unresolved P2
runtime strict matrix passes
RBAC authority proven
Partner access denial proven
cross-tenant attribution blocked
type confusion blocked
duplicate no raw 500
Audience criteria bounded
PII/contact policy safe
schema/migration consistent
tests pass
cleanup complete
roadmap contract satisfied
Git closure complete
```

Тогда:

```text
VERDICT A — PHASE 3 — STEP 3.8 MARKETING DOMAIN — STRICT REVIEW APPROVED

STEP 3.8 CLOSED
```

После этого можно обновлять canonical roadmap и определять следующий implementation step.

---

## 24. FAILURE VERDICT

Если найден хотя бы один unresolved P0/P1/P2:

```text
VERDICT B — PHASE 3 — STEP 3.8 MARKETING DOMAIN — STRICT REVIEW FAILED

STEP 3.8 REMAINS OPEN
NEXT ACTION: TARGETED REMEDIATION REQUIRED
```

Указать:

```text
finding
severity
reproduction
root cause
affected files
minimal remediation scope
```

Не чинить автоматически.

---

## 25. STOP CONDITION

После Strict Review:

```text
STOP
```

Не:

```text
запускать remediation автоматически
обновлять roadmap автоматически при VERDICT B
начинать следующий implementation step
реализовывать Marketing UI
реализовывать Storefront Marketing entitlement
```

Если `VERDICT A` — сначала показать полный Strict Review result и Git closure.

Если `VERDICT B` — остановиться на findings.
