# PHASE 3 — UI-C6 — REQUEST SERVER-AUTHORITY REMEDIATION
# AUDIT-FIRST / TARGETED SECURITY MAPPING PROMPT

## 0. РЕЖИМ

Ты работаешь над TravelHub.

Это **AUDIT-FIRST ONLY**.

На этом этапе запрещено:
- изменять production code;
- изменять schema / migrations;
- изменять DTO/API contracts;
- изменять frontend;
- изменять permissions/RBAC;
- изменять tests;
- закрывать SEC-UI-01;
- объявлять UI-C6 реализованным;
- начинать UI-C7;
- изменять Debt Register;
- изменять roadmap;
- менять исторические отчёты или prompts.

Единственная допустимая запись в repository — итоговый audit report:

`docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_AUDIT_FIRST_MAPPING_REPORT.md`

После создания report немедленно STOP.

---

# 1. BASELINE LOCK

Работай строго от baseline:

`5785b87a854fdb9fd8de27bd970de880e3cc21f7`

В самом начале выполни и зафиксируй:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
```

Если HEAD != baseline — STOP.

Если repository имеет pre-existing changes:
- не удалять;
- не форматировать;
- не коммитить;
- отдельно зафиксировать их как pre-existing;
- не считать их результатом данного аудита.

После аудита повторно проверить:

```bash
git rev-parse HEAD
git status --porcelain=v1
git diff --check
```

Никаких source changes быть не должно.

---

# 2. ЦЕЛЬ AUDIT

Не делать полный аудит Request domain.

Цель строго ограничена:

> установить фактическую server authority для Request Detail и реальных mutating Request actions, определить `availableActions` GAP и доказать минимальный scope будущего UI-C6.

Главные вопросы:

1. Где находится authority Request Detail?
2. Существует ли backend `availableActions`?
3. Если существует — действительно ли он security-relevant?
4. Если отсутствует — где frontend сегодня выводит availability?
5. Какие реальные Request mutations существуют?
6. Где и как backend запрещает недопустимое выполнение?
7. Может ли direct API call выполнить действие, которое frontend скрывает?
8. Какие tenant/workspace gates существуют реально?
9. Какие D5/D6 server-authority patterns применимы?
10. Каков **минимальный доказанный scope UI-C6**?

Не расширяй mapping на весь Request domain, если это не требуется для ответа на эти вопросы.

---

# 3. AUTHORITY ORDER

Используй строго следующий порядок:

1. фактический source tree текущего baseline;
2. controller/service/DTO и security implementation;
3. schema;
4. существующие tests;
5. D5/D6 implementation patterns;
6. accepted qualification reports;
7. Debt Register;
8. implementation prompts;
9. исторические документы.

Если документ противоречит source tree — source tree имеет приоритет.

Не выводи action, permission или transition только из отчёта.

---

# 4. FACT / INFERENCE / UNKNOWN

Каждое существенное утверждение классифицировать:

### FACT
Есть прямое source/test/schema evidence.

### INFERENCE
Вывод следует из нескольких FACT, но прямо не записан в source.

### UNKNOWN
Evidence недостаточно.

Не превращать INFERENCE в FACT.

Не заполнять UNKNOWN предположением.

---

# 5. ACTION DISCOVERY — ОБЯЗАТЕЛЬНО

Запрещено искать actions только по слову `action`.

Ищи реальные executable operations через:

- UI buttons;
- button handlers;
- mutation hooks;
- fetch/API calls;
- POST/PATCH/PUT/DELETE endpoints;
- controller methods;
- service methods;
- status transitions;
- transition maps;
- business handlers;
- permission checks;
- guards;
- tests;
- audit/history writes;
- CAS/idempotency logic.

Составь полный список **только реально существующих** Request mutations.

Для каждого action установить:

| Field | Required |
|---|---|
| Action ID/name | yes |
| UI trigger | yes |
| HTTP method/path | yes |
| Controller handler | yes |
| Service method | yes |
| Required permission | yes |
| Allowed source statuses | yes |
| Target status/effect | yes |
| Business gates | yes |
| Tenant/workspace gate | yes |
| CAS/idempotency | yes |
| Audit/history | yes |
| Negative tests | yes |
| Direct API bypass possible? | yes |

Если какое-либо поле не доказано — `UNKNOWN`.

---

# 6. REQUEST DETAIL AUTHORITY

Найди фактический:

```text
GET /requests/:id
```

и установи:

```text
route
→ controller
→ service
→ DTO / response mapper
→ related entity enrichment
→ permission gate
→ tenant/workspace gate
```

Отдельно проверить:

- authentication;
- page/detail permission;
- object-level authorization;
- tenant isolation;
- workspace isolation;
- Marketplace vs Partner Storefront semantics;
- 404 vs 403;
- enumeration protection.

Не считать наличие `@UseGuards()` само по себе доказательством object-level authorization.

Нужен конкретный source evidence.

---

# 7. AVAILABLEACTIONS GAP

Проверить буквально:

- есть ли `availableActions` в Request DTO;
- есть ли оно в service response;
- есть ли отдельный computation function;
- используется ли permission-aware computation;
- учитывает ли status;
- учитывает ли business gates;
- учитывает ли tenant/workspace;
- используется ли frontend;
- может ли frontend самостоятельно вычислить availability.

Важно:

> Наличие поля с названием `availableActions` не означает наличие server authority.

Если поле:
- статическое;
- informational;
- frontend-derived;
- неполное;
- не связано с authorization;
- не покрывает executable mutations,

оно НЕ считается закрытием security GAP.

---

# 8. FRONTEND AVAILABILITY

Найди Request detail frontend.

Зафиксируй все конструкции вида:

```text
canEdit
status === ...
status.includes(...)
show...
disabled...
hidden...
isAllowed...
```

Но не ограничивай поиск этими словами.

Найди фактические button handlers и mutation calls.

Составь таблицу:

| UI action | Visibility source | Permission source | Status source | Server authority |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

Критическое правило:

> hidden button ≠ authorization.

Если frontend скрывает кнопку, но endpoint доступен при прямом вызове — это security-relevant GAP.

---

# 9. SERVER ENFORCEMENT MATRIX

Для каждого реального mutation endpoint определить:

```text
Authentication
Permission
Tenant
Workspace
Object existence
Current status
Business invariants
Concurrency/idempotency
Audit
```

Матрица:

| Mutation | Auth | Permission | Tenant | Workspace | Status gate | Business gate | CAS/idempotency | Audit |
|---|---|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

Особенно проверить случаи:

```text
frontend-hidden + direct API
wrong status + direct API
wrong tenant + direct API
wrong workspace + direct API
missing permission + direct API
repeated/concurrent call
nonexistent Request
```

---

# 10. ОСОБО ПРОВЕРИТЬ CUSTOMER DECLINE

Не принимать заранее, что это defect.

Проверить source.

Если существует endpoint/service:

```text
customer decline
```

установить:

- required permission;
- allowed source status;
- actual status update;
- business conditions;
- CAS;
- idempotency;
- audit;
- negative tests.

Если status gate отсутствует, зафиксировать:

```text
FACT: status gate отсутствует
```

а затем отдельно:

```text
INFERENCE: это позволяет ...
```

Не менять код.

---

# 11. ВСЕ РЕАЛЬНЫЕ REQUEST MUTATIONS

Не ограничиваться customer decline.

Проверить все фактически существующие mutations, включая, если они существуют:

- confirm price;
- propose price;
- reject;
- unavailable;
- customer accept;
- customer decline;
- convert;
- любые другие найденные executable commands.

Не считать список выше каноническим заранее.

Source tree является authority.

---

# 12. REQUEST STATUS STATE MACHINE

Найди фактические Request statuses.

Установи:

```text
all statuses
actual transitions
terminal statuses
reversible transitions
guards
```

Построй:

```text
CURRENT STATUS
      ↓
ALLOWED MUTATIONS
      ↓
TARGET EFFECT
```

Не использовать порядок enum как доказательство lifecycle.

Если transition существует только во frontend — отметить как frontend-only.

Если backend принимает его независимо от status — отметить GAP.

---

# 13. PERMISSION MAPPING

Найти реальные permission constants/checks.

Для каждой mutation:

```text
endpoint
→ guard/decorator
→ permission
→ service-level authorization
```

Отдельно проверить:

- permission одинаковый для всех actions или granular;
- service доверяет controller;
- можно ли вызвать service через другой путь;
- есть ли внутренние trusted callers;
- есть ли cross-context bypass.

Не изобретать новые permissions.

---

# 14. TENANT / WORKSPACE

Определить фактическую модель Request ownership.

Проверить schema:

- tenantId;
- partnerId;
- workspace identifier;
- acquisition source;
- seller/partner scope;
- связи с owner entities.

Затем проверить реальные query predicates и guards.

Нужна доказательная цепочка:

```text
authenticated actor
→ workspace/context
→ tenant/partner scope
→ Request object
→ authorization
```

Если какого-либо звена нет — `UNKNOWN` или `GAP`, в зависимости от evidence.

---

# 15. D5 / D6 COMPARISON

Найди accepted D5/D6 implementation pattern.

Главный reference — server-authoritative Order actions.

Проверить:

```text
TRANSITIONS
ACTION_PERMISSIONS
computeAvailable...
controller actor/permissions
service execution
business gates
```

Сравнение делать аналитически:

| Concern | D5/D6 Order | Request today | Required for UI-C6? |
|---|---|---|---|
| Transition map | ... | ... | ... |
| Permission map | ... | ... | ... |
| availableActions | ... | ... | ... |
| Business gates | ... | ... | ... |
| Tenant scope | ... | ... | ... |
| Frontend derivation | ... | ... | ... |
| Direct execution protection | ... | ... | ... |

Важно:

> D5/D6 pattern = reference, не permission to copy blindly.

---

# 16. SECURITY TEST INVENTORY

Найти существующие Request tests.

Классифицировать:

```text
positive
negative
RBAC
tenant
workspace
status transition
direct API
concurrency
idempotency
404/403
```

Особенно искать тесты, которые доказывают:

- hidden UI action cannot be executed directly;
- wrong status rejected;
- wrong tenant rejected;
- wrong workspace rejected;
- missing permission rejected.

Если такого теста нет:

```text
FACT: test not found
```

Не писать:

```text
security bug
```

пока source behavior не проверен.

---

# 17. REQUIRED SECURITY PROBES

Если инфраструктура baseline позволяет выполнить read-only/runtime probes без изменения repository, допускаются только проверки:

- GET Request detail authorized;
- GET wrong tenant;
- GET wrong workspace;
- mutation with missing permission;
- mutation from invalid status;
- direct mutation of frontend-hidden action.

Запрещено создавать фикстуры, менять seed/schema/source.

Если runtime probe невозможно выполнить без изменения repository — `UNKNOWN`, а не invented evidence.

---

# 18. AVAILABLEACTIONS GAP — FINAL TABLE

Обязательно вывести:

| Layer | Current authority | Evidence | GAP |
|---|---|---|---|
| Request status | ... | ... | ... |
| Action definition | ... | ... | ... |
| Permission | ... | ... | ... |
| Business gates | ... | ... | ... |
| Tenant/workspace | ... | ... | ... |
| Backend availability projection | ... | ... | ... |
| Request DTO | ... | ... | ... |
| Frontend visibility | ... | ... | ... |
| Mutation execution | ... | ... | ... |
| Negative enforcement | ... | ... | ... |

---

# 19. MINIMAL UI-C6 SCOPE

После mapping определить минимальный scope.

Он должен быть основан только на доказанных FACT.

Минимальный scope может включать, например:

```text
1. Request server-authoritative action projection
2. Request availableActions DTO
3. canonical action/transition mapping
4. server-side enforcement alignment
5. frontend consumption of availableActions
6. required negative tests
```

Но это только пример.

Не включать пункт, если source evidence его не требует.

Не включать:
- полный Request refactor;
- новые domain concepts;
- новые permissions без доказанной необходимости;
- schema migration без evidence;
- UI-C7;
- unrelated cleanup.

---

# 20. STOP CONDITIONS

Немедленно STOP и вынести `AUDIT BLOCKED`, если:

- Request lifecycle не удаётся однозначно восстановить;
- неизвестно, какой service является authority;
- tenant/workspace ownership противоречив;
- несколько conflicting mutation engines;
- D5/D6 pattern нельзя безопасно сопоставить;
- security behavior нельзя доказать;
- minimal scope требует архитектурного решения, которого нет;
- найден потенциальный security bypass, но его nature невозможно доказать;
- для продолжения необходимы production changes.

Не угадывать.

---

# 21. REPORT

Создать только:

`docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_AUDIT_FIRST_MAPPING_REPORT.md`

Структура:

```text
# PHASE 3 — UI-C6 — Request Server-Authority Audit-First Mapping

## 1. Audit Metadata
## 2. Baseline Lock
## 3. Scope
## 4. Authority Hierarchy
## 5. Request Detail Authority
## 6. Request Status State Machine
## 7. Real Request Mutations
## 8. Permission Mapping
## 9. Tenant / Workspace Authority
## 10. Frontend Availability Derivation
## 11. availableActions GAP
## 12. Server Enforcement Matrix
## 13. Direct API / Bypass Analysis
## 14. Customer Decline Deep Check
## 15. D5/D6 Comparison
## 16. Existing Security Tests
## 17. Security Evidence Matrix
## 18. Minimal Proven UI-C6 Scope
## 19. Explicit Non-Scope
## 20. FACT / INFERENCE / UNKNOWN Register
## 21. Risks / Open Questions
## 22. Final Audit Verdict
```

---

# 22. FINAL VERDICT

Допустимы только два verdict:

### AUDIT READY

Использовать только если:

- authority установлен;
- Request actions полностью mapped;
- server execution behavior понятен;
- `availableActions` GAP доказан;
- tenant/workspace behavior установлен;
- D5/D6 comparison завершён;
- security tests/evidence inventory завершён;
- минимальный UI-C6 scope доказан source evidence;
- нет архитектурной неопределённости, блокирующей implementation.

В конце:

```text
AUDIT READY

UI-C6 implementation may be planned from the proven minimal scope.

SEC-UI-01 = OPEN
UI-C6 = NOT IMPLEMENTED
UI-C7 = NOT STARTED
```

### AUDIT BLOCKED

Если хотя бы один критический authority/security вопрос остаётся unresolved.

В конце:

```text
AUDIT BLOCKED

Blocking question:
<один точный нерешённый вопрос>

SEC-UI-01 = OPEN
UI-C6 = NOT IMPLEMENTED
UI-C7 = NOT STARTED
```

---

# 23. GIT CLOSURE

Этот audit НЕ должен менять production source.

После создания report выполнить:

```bash
git status --porcelain=v1
git diff --check
git diff --stat
git diff -- docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_AUDIT_FIRST_MAPPING_REPORT.md
```

Не коммитить source changes.

Если разрешён commit report в рамках audit workflow, commit должен содержать **только этот report**.

После commit проверить:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
```

Если push выполняется workflow — push только report commit.

После этого STOP.

---

# 24. ABSOLUTE RULES

Не делать:

- implementation;
- refactor;
- schema migration;
- permission redesign;
- UI redesign;
- UI-C7;
- SEC-UI-01 closure;
- Debt Register update;
- roadmap update;
- invented actions;
- invented permissions;
- invented statuses;
- invented tenant rules;
- silent correction of source behavior.

Не считать:

```text
hidden button = authorization
availableActions field = security authority
frontend status mapping = server enforcement
permission guard = object authorization
documentation = source truth
```

Ключевой принцип:

> UI-C6 должен исправлять доказанный authority gap, а не предположенный.

Сначала установить фактический execution authority.

Потом доказать GAP.

Потом заморозить минимальный scope.

И только после отдельного approval переходить к implementation.

**END — STOP AFTER AUDIT REPORT**
