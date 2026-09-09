# PHASE 3 — UI-C6 — REQUEST SERVER-AUTHORITY REMEDIATION
## AUDIT-FIRST MAPPING PROMPT — READ-ONLY

**Stage:** UI-C6 — Request Server-Authority Remediation  
**Mode:** AUDIT-FIRST ONLY  
**Baseline:** `5785b87a854fdb9fd8de27bd970de880e3cc21f7`  
**Debt:** `SEC-UI-01`  
**Current Debt Register closure stage:** `UI-C6 (Request Server-Authority Remediation)`  
**Current SEC-UI-01 status:** `OPEN`  
**TRUE NEXT requalification:** already completed and Git-closed before this audit.

---

# 1. ЦЕЛЬ

Выполнить **только фактический AUDIT-FIRST MAPPING** для UI-C6.

На этом этапе:

- НЕ изменять production code;
- НЕ изменять schema;
- НЕ изменять DTO;
- НЕ изменять tests;
- НЕ изменять frontend;
- НЕ менять permissions;
- НЕ менять Debt Register;
- НЕ закрывать `SEC-UI-01`;
- НЕ начинать UI-C6 implementation;
- НЕ начинать UI-C7;
- НЕ создавать implementation commit;
- НЕ менять roadmap.

Задача — получить точную карту текущего состояния Request в repository на baseline:

```text
5785b87a854fdb9fd8de27bd970de880e3cc21f7
```

Аудит должен опираться **на фактический source tree**, а не на старые отчёты, предположения или ожидаемую архитектуру.

После завершения mapping **ОСТАНОВИТЬСЯ**.

---

# 2. AUTHORITY ORDER

При конфликте информации использовать следующий порядок:

1. фактический Git/source tree на baseline `5785b87`;
2. актуальные controller/service/DTO/security/frontend/tests;
3. актуальная schema и Prisma model;
4. текущие server-authority patterns D5/D6;
5. актуальные qualification reports;
6. Debt Register;
7. implementation prompts;
8. исторические документы.

Отчёт должен явно отделять:

- **FACT** — подтверждено source code;
- **INFERENCE** — вывод из нескольких фактов;
- **UNKNOWN** — не найдено/не удалось доказать.

Нельзя превращать предполагаемое действие или permission в факт только потому, что оно встречается в документации.

---

# 3. BASELINE LOCK

Перед аудитом выполнить:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
```

Проверить, что анализируемый source tree соответствует:

```text
5785b87a854fdb9fd8de27bd970de880e3cc21f7
```

Если HEAD отличается:

- НЕ делать reset;
- НЕ делать checkout;
- НЕ делать force;
- НЕ исправлять repository;
- зафиксировать фактический HEAD;
- STOP.

Если имеются pre-existing uncommitted docs/prompts изменения — не трогать их и явно отметить как pre-existing.

---

# 4. AUDIT TARGET

Исследовать полный Request flow:

```text
Request list
    ↓
Request detail API
    ↓
Request detail DTO
    ↓
Request detail frontend
    ↓
Action derivation
    ↓
Action presentation
    ↓
Action execution API
    ↓
Backend authorization
    ↓
Domain/state validation
    ↓
Persistence
    ↓
Audit/event side effects
```

Цель — установить, где сегодня находится authority.

---

# 5. REQUEST ACTION INVENTORY

Найти **все реально существующие действия Request**.

Искать не только слово `action`, но и:

- кнопки;
- dropdown/menu actions;
- mutation methods;
- controller endpoints;
- service methods;
- status transitions;
- approve/reject/confirm/cancel/etc.;
- PATCH/POST endpoints;
- command-like methods;
- frontend handlers;
- permission checks;
- tests.

Не предполагать список действий заранее.

Создать таблицу:

| Action ID / name | Source file | Backend method | Endpoint | Frontend usage | Permission | Status prerequisite | Server-enforced? | Evidence |
|---|---|---|---|---|---|---|---|---|

Для каждого action дать точный source evidence:

```text
file
class/function
relevant line/range
```

Если action существует только frontend-side — отметить это отдельно.

Если action существует только backend-side — тоже отметить.

---

# 6. REQUEST STATUS INVENTORY

Найти фактический Request status/state model.

Установить:

- enum/string union;
- Prisma enum/model;
- DTO validation;
- service logic;
- controller;
- frontend constants;
- transition logic;
- tests.

Создать таблицу:

| Status | Defined in | Used by backend | Used by frontend | Actions associated | Transition authority |
|---|---|---|---|---|---|

Особенно проверить:

- полный список статусов;
- нет ли frontend-only statuses;
- нет ли status aliases;
- нет ли legacy status values;
- нет ли hidden states.

Не менять существующую state machine.

---

# 7. REQUEST DETAIL API CONTRACT

Найти canonical Request detail endpoint.

Зафиксировать:

```text
HTTP method
route
controller
service
DTO
response shape
relations
tenant/workspace scoping
permission guard
```

Показать фактический response contract.

Особенно проверить наличие или отсутствие:

```text
availableActions
```

Если поле уже существует:

- где формируется;
- кем вычисляется;
- является ли server-authoritative;
- используется ли frontend;
- соответствует ли execution authorization.

Если отсутствует — зафиксировать:

```text
FACT: availableActions is absent
```

Не создавать его на audit stage.

---

# 8. REQUEST FRONTEND DERIVATION

Найти canonical Request detail frontend.

Проверить:

- где загружается Request;
- где строится action list;
- где определяются visible actions;
- какие status checks используются;
- какие permission checks используются;
- есть ли role checks;
- есть ли hard-coded action matrix;
- есть ли `canX`;
- есть ли `isXAllowed`;
- есть ли conditional rendering;
- есть ли action configuration object.

Создать таблицу:

| Frontend action | Source | Condition | Permission check | Server field used? | Backend equivalent |
|---|---|---|---|---|---|

Отдельно перечислить **все frontend-derived authorization decisions**.

Критически важно отличить:

```text
UI visibility
```

от

```text
server authorization
```

Скрытая кнопка НЕ считается security enforcement.

---

# 9. ACTION EXECUTION ENDPOINTS

Для каждого реально существующего mutation action найти backend execution endpoint.

Таблица:

| Action | Endpoint | Controller guard | Permission check | Tenant check | Workspace check | Status/state check | Domain validation | Audit/event | Result |
|---|---|---|---|---|---|---|---|---|---|

Проверить direct API invocation.

Для каждого endpoint ответить:

```text
Можно ли вызвать endpoint напрямую без frontend?
Что произойдёт при отсутствии permission?
Что произойдёт из другого tenant?
Что произойдёт из другого workspace?
Что произойдёт в недопустимом status?
```

Если security enforcement находится только в frontend — отметить:

```text
SECURITY GAP
```

---

# 10. PERMISSION INVENTORY

Найти все permission constants/strings, относящиеся к Request.

Искать:

```text
request.*
requests.*
*.read
*.create
*.update
*.delete
*.approve
*.reject
*.confirm
*.cancel
```

Но не предполагать naming convention.

Для каждого permission:

| Permission | Definition | Backend usage | Frontend usage | Roles | Guard/decorator | Request action |
|---|---|---|---|---|---|---|

Проверить реальные RBAC patterns.

Особенно сравнить с server-authority реализациями D5/D6.

---

# 11. D5 / D6 SERVER-AUTHORITY PATTERN

Найти фактические implementation patterns, которые уже были приняты в D5/D6.

Исследовать:

- controller guards;
- policy/permission services;
- `availableActions` или аналог;
- action execution validation;
- tenant/workspace gates;
- negative security tests;
- frontend consumption.

Составить comparison:

| Concern | D5/D6 existing pattern | Request current implementation | Gap |
|---|---|---|---|
| Read authorization | | | |
| Action availability | | | |
| Action execution | | | |
| Permission | | | |
| Tenant isolation | | | |
| Workspace isolation | | | |
| State validation | | | |
| Negative tests | | | |
| Frontend consumption | | | |

Не копировать pattern автоматически. Сначала определить его фактическую семантику.

---

# 12. REQUEST TEST INVENTORY

Найти все существующие Request tests:

- unit;
- service;
- controller;
- integration;
- e2e;
- frontend;
- security/RBAC;
- regression.

Таблица:

| Test file | Scope | Scenario | Action | Permission | Tenant | Workspace | State | Expected |
|---|---|---|---|---|---|---|---|---|

Отдельно проверить наличие negative-path тестов:

```text
missing permission
wrong tenant
wrong workspace
invalid state
direct API call
spoofed client action
```

Не добавлять тесты на этом этапе.

---

# 13. REQUEST SECURITY MATRIX — CURRENT STATE

Составить фактическую security matrix.

| Scenario | Read detail | See action | Execute action | Current result | Evidence |
|---|---|---|---|---|---|
| Authorized same tenant/workspace | | | | | |
| Missing permission | | | | | |
| Wrong tenant | | | | | |
| Wrong workspace | | | | | |
| Invalid state | | | | | |
| Direct API invocation | | | | | |
| Client-spoofed action | | | | | |

Важно:

**"кнопка не показалась" ≠ "action защищён".**

Для execution authority нужен server-side enforcement.

---

# 14. AVAILABLEACTIONS GAP ANALYSIS

Отдельно определить:

### A. Current source of truth

Кто сегодня решает:

```text
"какие actions доступны Request"
```

### B. Required UI-C6 authority

Определить, что именно потребуется для:

```text
Request detail API
    → availableActions
```

### C. Execution authority

Определить, где должен находиться server-side enforcement.

### D. Frontend migration surface

Определить конкретные места, которые сейчас самостоятельно вычисляют actions.

Создать:

| Layer | Current authority | Required authority | Change likely needed |
|---|---|---|---|
| Backend DTO | | | |
| Backend service | | | |
| Controller | | | |
| Authorization | | | |
| State validation | | | |
| Frontend API type | | | |
| Frontend action derivation | | | |
| ActionBar | | | |
| Tests | | | |

---

# 15. IMPORTANT: DO NOT INVENT ACTIONS

Нельзя использовать как authoritative source:

- старые prompts;
- screenshots;
- reports;
- roadmap;
- предполагаемый UX;
- общие Request workflows.

Если source code показывает 5 actions — mapping должен содержать 5.

Если source code показывает 0 actions — это и есть результат.

Если действие описано в документации, но не найдено в source:

```text
DOCUMENTED BUT NOT CONFIRMED IN SOURCE
```

---

# 16. IMPORTANT: DO NOT INVENT PERMISSIONS

То же правило для permissions.

Если документация говорит:

```text
request.approve
```

но такого permission нет в source:

```text
NOT CONFIRMED
```

Не создавать permission.

---

# 17. SCHEMA IMPACT CHECK

Проверить, нужен ли UI-C6:

- Prisma schema change;
- migration;
- enum change;
- new table;
- new relation;
- new field.

На audit stage ничего не менять.

Если implementation theoretically требует schema change:

```text
SCHEMA IMPACT = YES
```

и подробно объяснить почему.

Если можно реализовать без schema:

```text
SCHEMA IMPACT = NO
```

с evidence.

---

# 18. API COMPATIBILITY CHECK

Определить:

- какие существующие Request endpoints нельзя ломать;
- какие frontend consumers используют текущий DTO;
- является ли `availableActions` additive field;
- есть ли versioning;
- есть ли shared DTO consumers;
- есть ли tests на exact response shape.

Не менять API.

---

# 19. MINIMAL IMPLEMENTATION SCOPE

После полного audit сформулировать **минимальный возможный implementation scope**.

Формат:

```text
IN SCOPE

1.
2.
3.

OUT OF SCOPE

1.
2.
3.
```

Каждый пункт должен иметь source evidence.

Особенно проверить, можно ли закрыть SEC-UI-01 без:

- новой state machine;
- нового domain model;
- schema migration;
- новых бизнес-статусов;
- новых permissions;
- нового endpoint, если существующий может быть расширен;
- UI-C7;
- Finance;
- Payments redesign;
- PROD-01;
- D8.

Если это невозможно — объяснить почему.

---

# 20. STOP CONDITIONS

Немедленно STOP и отметить `BLOCKED / AMBIGUOUS`, если обнаружено:

1. две разные canonical Request detail APIs;
2. две несовместимые Request state machines;
3. неизвестный источник authorization truth;
4. невозможно определить tenant/workspace authority;
5. action execution существует в нескольких несовместимых реализациях;
6. требуется schema migration, но основание неочевидно;
7. D5/D6 pattern невозможно однозначно применить;
8. Request actions противоречат друг другу в source;
9. source и accepted architecture расходятся настолько, что требуется архитектурное решение;
10. обнаружен незарегистрированный security bypass.

В STOP-сценарии:

- ничего не исправлять;
- ничего не коммитить;
- сформулировать точный вопрос/проблему.

---

# 21. REQUIRED AUDIT REPORT

Создать только один audit report:

```text
docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_AUDIT_FIRST_MAPPING_REPORT.md
```

В report обязательно включить:

## 21.1 Executive Summary

## 21.2 Baseline / Git State

## 21.3 Request Action Inventory

## 21.4 Request Status Inventory

## 21.5 Request Detail API Contract

## 21.6 Request DTO Contract

## 21.7 Frontend Action Derivation

## 21.8 Action Execution Endpoints

## 21.9 Permission Inventory

## 21.10 D5/D6 Server-Authority Comparison

## 21.11 Existing Request Tests

## 21.12 Current Security Matrix

## 21.13 availableActions Gap Analysis

## 21.14 Schema Impact

## 21.15 API Compatibility

## 21.16 Minimal Implementation Scope

## 21.17 Out of Scope

## 21.18 Risks / Ambiguities

## 21.19 Evidence Index

## 21.20 Final Audit Verdict

---

# 22. FINAL AUDIT VERDICT

Допустимы только:

### `AUDIT READY`

Если:

- Request actions полностью mapped;
- API mapped;
- DTO mapped;
- frontend derivation mapped;
- permissions mapped;
- execution endpoints mapped;
- D5/D6 patterns mapped;
- tests mapped;
- security gaps identified;
- implementation scope can be frozen.

или:

### `AUDIT BLOCKED`

Если есть unresolved ambiguity/security/architecture issue.

Не использовать:

```text
SEC-UI-01 CLOSED
UI-C6 ACCEPTED
UI-C6 IMPLEMENTED
TRUE NEXT
```

Эти статусы **не могут быть присвоены этим audit stage**.

---

# 23. GIT RULES

Разрешено изменить только:

```text
docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_AUDIT_FIRST_MAPPING_REPORT.md
```

Не изменять:

- source code;
- schema;
- tests;
- frontend;
- backend;
- Debt Register;
- roadmap;
- prompts;
- unrelated docs.

После создания report:

```bash
git diff --check
git status --short
git diff -- docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_AUDIT_FIRST_MAPPING_REPORT.md
```

Если audit report является единственным новым содержательным изменением, допускается отдельный docs-only commit.

Но **не делать implementation commit**.

---

# 24. FINAL OUTPUT TO USER

После audit вернуть краткое резюме:

```text
UI-C6 AUDIT-FIRST — COMPLETE

Baseline:
5785b87a...

Verdict:
AUDIT READY / AUDIT BLOCKED

Request actions:
N фактических actions

availableActions:
ABSENT / PRESENT / PARTIAL

Server execution authority:
...

Frontend derivation:
...

Security gaps:
...

Schema impact:
YES / NO

Minimal implementation scope:
...

Report:
docs/reports/...
```

После этого **STOP**.

Не начинать implementation.

Не закрывать SEC-UI-01.

Не переходить к UI-C7.
