# PHASE 3 — STEP 3.8.2 — MARKETING DOMAIN ATTRIBUTION / AUDIENCE RUNTIME DEFECT REMEDIATION

## 0. Режим

**TARGETED REMEDIATION ONLY.**

Step 3.8 реализован. Step 3.8.1 runtime/security evidence установил реальные дефекты.

Текущее авторитетное состояние:

```text
VERDICT B — STEP 3.8.1 EVIDENCE CLOSURE FAILED
SYSTEM DEFECTS ESTABLISHED
STEP 3.8 NOT READY FOR STRICT REVIEW
```

Evidence closure SHA:

```text
8b32e34
```

Найдено:

| Finding | Severity | Runtime |
|---|---:|---|
| Duplicate attribution | P2 | duplicate возвращает raw 500 |
| Nonexistent attribution entity | P2 | несуществующий entityId принимается с 201 |
| Attribution type confusion | P2 | ID сущности другого типа принимается с 201 |
| Audience arbitrary/contact criteria | P2 pending precision | произвольные/contact-bearing поля сохраняются в inert JSON |
| Partner Marketing permissions | P3 pending architecture | Partner roles не имеют marketing permissions |

Цель 3.8.2 — устранить/обоснованно переклассифицировать только эти findings и повторно доказать runtime correctness.

---

## 1. HARD SCOPE FREEZE

Не реализовывать:

```text
Marketing Center UI
EMAIL/SMS/PUSH
consent/preferences
marketing automation/journeys
campaign analytics
multi-touch attribution
bulk contact export
ad integrations
новый CRM lifecycle
новую Customer identity model
новый Communication domain
Storefront Business Capability stages
User/Buyer/Partner suspension/deactivation lifecycle
```

Не начинать следующий canonical implementation step.

---

## 2. PREFLIGHT

Перед изменениями:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -15 --oneline
```

Ожидаемый baseline:

```text
HEAD:          8b32e34
origin/master: 8b32e34
```

Если отличается — установить причину. Не reset/stash/clean чужие изменения.

Проверить:

```text
backend/src/modules/marketing/**
backend/prisma/schema.prisma
Step 3.8 migration
CRM Customer / PartnerCustomerRelation authority
Order authority
Booking authority
workspace/partner scope resolution
permission guards
exception mapping conventions
DTO/validation patterns
marketing tests
canonical roadmap / Partner entitlement rules
```

---

## 3. DEFECT A — ATTRIBUTION REFERENTIAL VALIDATION

### Проблема

`CampaignAttribution` хранит полиморфную ссылку:

```text
entityType
entityId
```

Runtime показал, что несуществующий `entityId` сохраняется с `201`.

### Требование

До persistence сервер обязан разрешить ссылку через канонический домен, соответствующий `entityType`.

Для реально поддерживаемых типов, ожидаемо:

```text
CUSTOMER
LEAD
ORDER
BOOKING
```

использовать существующие domain authorities.

```text
entityType + entityId
        ↓
canonical domain lookup
        ↓
exists?
 ├─ NO  → controlled 404/422; persistence=0
 └─ YES → ownership/scope validation
```

Не создавать отдельный Lead domain, если LEAD в CRM является lifecycle/state.

---

## 4. DEFECT B — TYPE INTEGRITY

Запрещено:

```text
ORDER   + Booking.id
BOOKING + Order.id
CUSTOMER + unrelated entity id
```

Каждый ID должен проверяться именно через authority указанного `entityType`.

Wrong type:

```text
controlled 404/422
persistence = 0
```

Нельзя считать ссылку валидной только потому, что такой UUID существует где-либо в БД.

---

## 5. HARD SECURITY GATE — TENANT OWNERSHIP

Для Partner-scoped Campaign:

```text
Campaign.partnerId = Partner A
```

атрибутируемая Customer/Lead/Order/Booking должна канонически принадлежать Partner A.

Запрещено:

```text
Partner A Campaign
  → Partner B Customer
  → Partner B Order
  → Partner B Booking
```

даже при известном foreign ID.

Ownership выводится только server-side из canonical relations.

Не доверять body-полям:

```text
partnerId
tenantId
ownerId
```

Для Platform scope использовать явную workspace/RBAC authority. Не вводить правило:

```text
partnerId == null ⇒ unconditional superuser
```

---

## 6. CUSTOMER / LEAD SEMANTICS

До исправления проверить фактическую CRM-модель.

Если архитектура:

```text
Customer
+
PartnerCustomerRelation.lifecycle = ACTIVE / LEAD / PROSPECT
```

то:

- не создавать Lead table;
- не дублировать CRM;
- определить точный смысл `entityType=LEAD`;
- валидировать через каноническую CRM authority/lifecycle.

Если `LEAD` attribution не имеет корректной канонической семантики — зафиксировать и применить минимальную архитектурно корректную коррекцию. Не придумывать новый domain.

---

## 7. DEFECT C — DUPLICATE ATTRIBUTION RAW 500

Первый запрос:

```text
→ 201
```

Повтор `(campaignId, entityType, entityId)` не должен давать raw `500`.

Предпочтительно:

```text
409 Conflict
```

если соответствует conventions проекта. Допустим `422` или осознанная idempotency, если это канонический контракт.

Обязательно:

```text
first request     → success
duplicate request → controlled non-500
DB rows           → exactly 1
```

Маппить только нужный Prisma uniqueness error. Несвязанные DB errors не проглатывать.

Добавить тесты:

```text
target unique violation → mapped
unrelated Prisma error → rethrow/canonical handling
```

---

## 8. DEFECT D — AUDIENCE CRITERIA CONTRACT

Step 3.8.1 показал, что `CampaignAudience.criteria JSONB` принимает произвольные/contact-bearing поля.

Сначала определить: это реальный P2 или over-classified future hardening.

Проверить предполагаемые допустимые поля, например:

```text
lifecycle
leadSource
tags
```

и только реально подтверждённые CRM fields.

Если `criteria` представляет будущую исполняемую сегментацию — установить минимальный typed/whitelisted contract.

Отдельно проверить/запретить как segmentation authority:

```text
email
phone
URL/contact fields
partnerId
tenantId
ownerId
password/auth fields
rawSql/query-like fields
unknown fields
arbitrary nested objects
```

Нельзя создать:

- Marketplace Basic contact-policy bypass;
- caller-controlled tenant selector;
- arbitrary query/expression surface.

Если repository evidence доказывает, что JSON намеренно является полностью inert opaque metadata и такой контракт допустим — не делать лишний DSL. Обоснованно переклассифицировать finding и доказать отсутствие security/tenant effect.

---

## 9. PARTNER MARKETING ACCESS — ARCHITECTURE PRECISION

Не выдавать Partner permissions автоматически.

Проверить:

```text
canonical roadmap
Marketplace Basic entitlement
Storefront Pro entitlement
role defaults
marketing guards
Step 3.8 contract/report
```

Определить:

### Case A — Platform-only canonical сейчас

```text
permission changes = none
P3 documented/reclassified
```

### Case B — Storefront Pro Marketing уже обязателен

Исправить только если это прямо входит в контракт 3.8.

### Case C — authority unresolved

Сохранить secure-deny и документировать будущую entitlement decision.

**Никогда не выдавать Marketing Marketplace Basic только ради прохождения теста.**

---

## 10. API ERROR CONTRACT

Ожидаемые controlled outcomes:

```text
invalid entityType        → 400/422
nonexistent entity        → 404/422
wrong entity type         → 404/422
foreign Partner entity    → neutral 404 / canonical denial
duplicate attribution     → 409/422/idempotent
invalid Audience criteria → 400/422
unauthorized              → 403
anonymous                 → 401
```

Не раскрывать:

```text
foreign entity existence
Prisma internals
SQL
stack traces
tenant identifiers
PII
```

---

## 11. AUTOMATED TESTS

Минимум:

### Attribution

```text
valid CUSTOMER
valid ORDER
valid BOOKING

nonexistent CUSTOMER rejected
nonexistent ORDER rejected
nonexistent BOOKING rejected

ORDER + Booking ID rejected
BOOKING + Order ID rejected
CUSTOMER + unrelated ID rejected

Partner A Campaign + Partner B Customer rejected
Partner A Campaign + Partner B Order rejected
Partner A Campaign + Partner B Booking rejected

duplicate controlled
duplicate row count = 1
invalid entityType rejected
```

LEAD тестировать только после определения его канонической семантики.

### Audience

Если criteria contract ужесточён:

```text
valid lifecycle accepted
valid leadSource accepted
valid tags accepted
email rejected
phone rejected
partnerId rejected
tenantId/ownerId rejected
unknown field rejected
rawSql/query-like rejected
invalid nested structure rejected
```

---

## 12. AUTHENTICATED RUNTIME RE-QUALIFICATION

После тестов выполнить реальные HTTP checks.

Обязательная матрица:

| Gate | Expected |
|---|---|
| valid CUSTOMER attribution | 201 |
| valid ORDER attribution | 201 |
| valid BOOKING attribution | 201 |
| nonexistent CUSTOMER | controlled reject |
| nonexistent ORDER | controlled reject |
| nonexistent BOOKING | controlled reject |
| ORDER + Booking ID | controlled reject |
| BOOKING + Order ID | controlled reject |
| duplicate | controlled non-500 |
| duplicate DB rows | exactly 1 |
| foreign Customer | controlled reject |
| foreign Order | controlled reject |
| foreign Booking | controlled reject |
| invalid entityType | 400/422 |
| valid Audience criteria | success |
| prohibited Audience criteria | controlled reject if tightened |
| unauthorized staff | 403 |
| anonymous | 401 |
| contact disclosure | no PII |

Для каждого reject:

```text
HTTP
response
DB/read-back unchanged
```

---

## 13. REGRESSION

Запустить реальные repository commands для:

```text
Marketing tests
Communication tests
affected CRM tests
affected Order/Booking tests
affected Security/RBAC tests
Backend TypeScript check
```

Отчёт должен содержать точные suite/test counts.

---

## 14. MIGRATION POLICY

Предпочтительно:

```text
NO NEW MIGRATION
```

Исправлять на service/DTO/API уровне.

Не переписывать исходную Step 3.8 migration.

Если без schema change корректное исправление невозможно:

```text
STOP
```

описать необходимость и запросить расширение remediation scope.

---

## 15. CLEANUP

Удалить только созданные 3.8.2 fixtures.

Доказать:

```text
3.8.2 Campaigns:    0
3.8.2 Audiences:    0
3.8.2 Attributions: 0
3.8.2 disposable Customers/PCRs: 0
3.8.2 Orders:       0
3.8.2 Bookings:     0
```

Не затрагивать pre-existing data.

---

## 16. REPORT

Создать:

```text
docs/prompts/PHASE_3_STEP_3.8.2_MARKETING_DOMAIN_RUNTIME_DEFECT_REMEDIATION_REPORT.md
```

Включить:

1. baseline SHA;
2. reproduction исходных defects;
3. root cause;
4. files changed;
5. attribution authority;
6. Customer/Lead semantic decision;
7. Audience criteria classification/contract;
8. Partner Marketing entitlement decision;
9. automated tests;
10. authenticated runtime;
11. persistence/read-back;
12. security regression;
13. cleanup;
14. Git closure;
15. verdict.

Не переписывать историю 3.8.1.

---

## 17. FINDING CLOSURE TABLE

| Finding | Original severity | Root cause | Fix/decision | Runtime proof | Status |
|---|---:|---|---|---|---|
| Duplicate attribution raw 500 | P2 | | | | |
| Nonexistent attribution accepted | P2 | | | | |
| Attribution type confusion | P2 | | | | |
| Audience arbitrary/contact criteria | P2 pending precision | | | | |
| Partner Marketing permissions | P3 pending architecture | | | | |

Нельзя ставить CLOSED без runtime evidence либо явной архитектурной переклассификации.

---

## 18. GIT CLOSURE

Перед commit:

```bash
git status --short
git diff --name-only
git diff
```

Stage только task-owned changes.

Затем:

```bash
git diff --cached --name-only
git commit -m "fix(marketing): remediate Step 3.8 runtime attribution defects"
git push origin master
git rev-parse HEAD
git rev-parse origin/master
```

Зафиксировать:

```text
Step 3.8.1 evidence SHA: 8b32e34
Step 3.8.2 remediation SHA:
Final HEAD:
origin/master:
HEAD == origin/master:
```

Без placeholders.

---

## 19. PASS CONDITIONS

PASS только если:

```text
nonexistent attribution cannot persist
type-confused attribution cannot persist
foreign-tenant attribution cannot persist
duplicate attribution cannot produce raw 500
valid attribution still works
Audience finding fixed or defensibly reclassified
Partner Marketing access resolved without over-granting
no contact-policy regression
no tenant-isolation regression
tests pass
TSC passes
fixtures cleaned
no unresolved blocking P2
HEAD == origin/master
```

---

## 20. SUCCESS VERDICT

Только после всех gates:

```text
VERDICT A — STEP 3.8.2 MARKETING DOMAIN ATTRIBUTION / AUDIENCE RUNTIME DEFECT REMEDIATION — PASS

STEP 3.8 RUNTIME DEFECTS REMEDIATED
STEP 3.8 READY FOR STRICT REVIEW
```

Это **не закрывает Step 3.8**.

---

## 21. FAILURE VERDICT

Если blocking defect остаётся:

```text
VERDICT B — STEP 3.8.2 MARKETING DOMAIN REMEDIATION INCOMPLETE

STEP 3.8 NOT READY FOR STRICT REVIEW
```

Указать reproduction, HTTP, persistence и минимальный следующий remediation scope.

---

## 22. STOP CONDITION

После PASS:

```text
STOP
```

Не:

```text
запускать Strict Review автоматически
помечать Step 3.8 CLOSED
переходить к следующему implementation step
реализовывать Marketing UI
реализовывать User/Buyer/Partner deactivation lifecycle
```

Следующая отдельная задача:

```text
PHASE 3 — STEP 3.8 — STRICT REVIEW
```
