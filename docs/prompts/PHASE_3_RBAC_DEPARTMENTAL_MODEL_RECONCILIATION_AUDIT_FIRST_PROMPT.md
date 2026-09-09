# PHASE 3 — RBAC DEPARTMENTAL MODEL RECONCILIATION — AUDIT-FIRST

## 1. Назначение

Провести **audit-only / read-only** проверку текущей RBAC-модели TravelHub против исходной архитектурной договорённости о departmental workflow:

- платформа состоит из нескольких бизнес-отделов;
- каждый отдел отвечает за свой участок процесса;
- отдел получает объект/задачу;
- выполняет разрешённые действия;
- передаёт процесс следующему ответственному отделу;
- доступ к рабочему центру/карточке не равен автоматически праву выполнять все мутации.

Критически важно: **не предполагать заранее ни «все роли имеют полный доступ», ни «каждая роль видит только свой раздел»**.

Главный вопрос:

> Какая RBAC-модель фактически предусмотрена архитектурой TravelHub сегодня, соответствует ли она departmental-модели с handoff между отделами, и является ли широкий доступ Operator к Requests / Orders / Bookings / Payments ожидаемым поведением?

---

## 2. Режим

Это **AUDIT-FIRST** этап.

### Разрешено

Читать source code, tests/e2e, permission constants, guards, seeds, DTO/API contracts, `availableActions`, frontend navigation/auth logic, schema, accepted architecture/ADR, qualification reports, Debt Register, roadmap и исторические материалы.

Можно запускать безопасные read-only проверки и существующие тесты.

### Запрещено

До отдельного approval запрещено:

- менять backend/frontend;
- менять роли или permissions;
- менять guards/seeds/schema/DTO/API;
- менять `availableActions`;
- менять navigation;
- менять Department/workspace/tenant model;
- менять Debt Register/roadmap/prompts;
- исправлять найденные дефекты.

Единственный разрешённый artifact:

`docs/reports/PHASE_3_RBAC_DEPARTMENTAL_MODEL_RECONCILIATION_AUDIT_REPORT.md`

---

## 3. Authority order

Использовать:

1. Current source code
2. Current tests / e2e / security tests
3. Permission constants / guards / seeds
4. Current API contracts / `availableActions`
5. Frontend authorization/navigation
6. Schema
7. Accepted architecture / ADR / design documents
8. Accepted qualification reports
9. Debt Register
10. Roadmap / prompts / historical discussion

При конфликте источников явно зафиксировать конфликт и выбрать authoritative source с обоснованием.

---

## 4. Восстановить departmental model

Найти фактические подтверждения структуры и ответственности отделов.

Проверить, существуют ли и как реализованы:

- Product / Catalog
- Sales
- Operations
- Finance
- Customer Care / Support

Для каждого определить:

| Department | Responsibility | Primary objects | Workspace/center | Handoff |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

Не выдумывать отсутствующие Department-поля или центры.

Сохранить существующее архитектурное различие:

- **Payments = current capability + Finance ownership + Operations Center tab**
- **Finance Center = NOT STARTED**

---

## 5. Current roles

Найти **все current roles** в source/seed/config/tests.

Не ограничиваться:

`ADMIN`, `DIRECTOR`, `OPERATOR`, `SALES_MANAGER`, `ANALYST`, `MARKETER`.

Для каждой роли установить:

| Role | Department | Workspace | Intended responsibility | Permission source |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

Если Department не хранится явно — не изобретать его.

Разделить понятия:

`Role ≠ Department ≠ Workspace ≠ Permissions`

и показать их фактическую связь.

---

## 6. Full permission inventory

Извлечь полный current permission inventory, включая:

- Requests
- Orders
- Bookings
- Payments
- Products
- CRM / Customers
- Partners
- Analytics
- Administration / RBAC
- Audit
- Help
- другие существующие домены.

Для каждой permission:

| Permission | Domain | Read/Mutation/Admin | Guarded endpoint(s) | Intended actor(s) |
|---|---|---|---|---|

Особенно проверить все существующие Request/Order/Booking/Payment permissions, а не только известные примеры.

---

## 7. Role × Permission matrix

Построить:

`ALL CURRENT ROLES × ALL CURRENT PERMISSIONS`

Для каждой пары:

- GRANT / DENY
- источник: role definition / seed / constants / resolver / guard / test.

Не считать permission разрешённым только потому, что UI показывает страницу.

---

## 8. Expected departmental matrix

Отдельно вывести **EXPECTED BUSINESS MATRIX** только из доказанной архитектуры:

`Department → Business object → Business stage → Allowed action → Handoff`

Для каждого действия определить:

| Department | Role | Object | Action | Resulting state | Next department | Evidence |
|---|---|---|---|---|---|---|

Не принимать заранее заданную последовательность Sales → Operations → Finance без evidence.

---

## 9. Navigation vs authorization

Для каждой роли разделить:

1. Navigation visibility
2. List read
3. Detail read
4. Mutation authority
5. Data scope

Таблица:

| Role | Navigation | List read | Detail read | Mutation | Data scope |
|---|---|---|---|---|---|

Особенно ответить:

> Почему Operator видит Requests / Orders / Bookings / Payments?

Классификация только при наличии evidence:

- A — expected by architecture
- B — expected because Operator is cross-operational
- C — UI broader than server authorization
- D — server permissions broader than intended
- E — architecture ambiguous

---

## 10. Operator deep-dive

Обязательно проверить Operator:

### Navigation
Какие tabs видит.

### Read
Какие list/detail endpoints доступны.

### Mutation
Какие actions доступны.

### Data scope
Какие tenant/workspace predicates применяются.

### Responsibility
Какую роль Operator выполняет в departmental model.

### Handoff
Что Operator получает, обрабатывает и передаёт дальше.

Создать:

| Capability | Expected | Actual | Delta | Classification |
|---|---|---|---|---|
| Requests list | ? | ? | ? | ? |
| Requests detail | ? | ? | ? | ? |
| Request mutations | ? | ? | ? | ? |
| Orders list | ? | ? | ? | ? |
| Orders detail | ? | ? | ? | ? |
| Order mutations | ? | ? | ? | ? |
| Bookings list | ? | ? | ? | ? |
| Bookings detail | ? | ? | ? | ? |
| Booking mutations | ? | ? | ? | ? |
| Payments list | ? | ? | ? | ? |
| Payments detail | ? | ? | ? | ? |
| Payment mutations | ? | ? | ? | ? |

---

## 11. Admin and other roles

Отдельно проверить:

- ADMIN
- DIRECTOR
- SALES_MANAGER
- ANALYST
- MARKETER
- остальные current roles.

Не считать ADMIN автоматически unrestricted без evidence.

Для известных read-only cases проверить фактические API и `availableActions`.

---

## 12. Server authority

Для каждого домена/action установить цепочку:

`Role → Effective permissions → Guard → Controller → Service authorization → Business transition → availableActions → UI`

Особенно Requests, Orders, все 13 canonical Booking actions и Payments.

Booking actions:

`prepare`, `send`, `requestClarification`, `resume`, `confirm`, `reject`, `service`, `requestChange`, `resolveChange`, `requestCancellation`, `complete`, `cancel`, `problem`.

---

## 13. Handoff model

Найти реальные business handoff transitions.

Для каждого:

`Source department → Actor → Object → Action → Result → Receiving department → Receiving role`

Цель — определить, является ли широкий read access частью intentional cross-department workflow.

---

## 14. Tenant / workspace isolation

Проверить:

- same tenant / same workspace
- same tenant / wrong workspace
- wrong tenant
- Storefront → Platform
- unauthenticated

Для list/detail/mutation/history/`availableActions`.

---

## 15. UI projection

Проверить:

`server authorization = availableActions = visible mutation UI`

Отдельно анализировать navigation.

Для Request / Order / Booking / Payment зафиксировать source of truth и direct API enforcement.

---

## 16. Историческая договорённость

Обязательно исследовать repository docs/reports/history на темы:

- несколько отделов платформы;
- каждый отдел отвечает за свой участок;
- передача действия другому отделу;
- cross-department workflow;
- широкая или ограниченная navigation;
- default permissions;
- “full access by default”;
- department-specific access.

Искать:

`full access`, `default access`, `all permissions`, `all roles`, `department`, `departments`, `handoff`, `ownership`, `responsibility`, `cross-department`, `workflow`, `role`, `permission`.

Если historical intent конфликтует с current canonical implementation:

**не исправлять.**

Зафиксировать:

`Historical intent → Current canonical model → Conflict → Required governance decision`

---

## 17. Две проверяемые модели

Не предполагать заранее одну из них.

### Model A — Strict departmental access

```text
Sales → Sales
Operations → Operations
Finance → Finance
```

### Model B — Cross-operational visibility + scoped mutation

```text
Operations
├── Requests
├── Orders
├── Bookings
└── Payments
```

Определить evidence-backed модель.

---

## 18. Full-access-by-default verdict

Дать отдельный ответ:

> Существует ли подтверждённое правило, что все роли получают полный доступ по умолчанию?

Только один результат:

`PROVEN / DISPROVEN / NOT PROVEN / CONTRADICTED`

Если `NOT PROVEN` — не считать это defect и ничего не менять.

---

## 19. Delta classification

Использовать:

- EXPECTED GRANT
- EXPECTED DENY
- EXCESS GRANT
- MISSING GRANT
- AMBIGUOUS / GOVERNANCE REQUIRED
- NOT APPLICABLE

Не использовать `BUG`, если expected behavior не доказан.

---

## 20. Debt / roadmap

Debt Register не менять.

Проверить существующие RBAC/security debts, включая SEC-UI-01 и UI-C17.

Новую debt item не создавать без approval.

---

## 21. Tests

Запустить существующие read-only RBAC/security tests, если возможно.

Проверить positive/negative authorization, `availableActions`, direct API, tenant/workspace isolation и Storefront 404.

Тесты не менять.

---

## 22. Report

Создать:

`docs/reports/PHASE_3_RBAC_DEPARTMENTAL_MODEL_RECONCILIATION_AUDIT_REPORT.md`

Структура:

1. Executive Summary
2. Audit Scope
3. Authority Order
4. Recovered Departmental Model
5. Current Role Inventory
6. Current Permission Inventory
7. Role × Permission Matrix
8. Expected Departmental Matrix
9. Navigation vs Read vs Mutation
10. Business Handoff Model
11. Operator Deep-Dive
12. Admin Deep-Dive
13. Sales Manager / Analyst / Marketer
14. Server Authority Chain
15. availableActions Projection
16. Tenant / Workspace Isolation
17. Historical Intent vs Current Canonical Model
18. Full Access by Default — Evidence Verdict
19. Expected vs Actual Delta Matrix
20. Existing Debt / Roadmap Impact
21. Test Evidence
22. Findings
23. Governance Decisions Required
24. Recommendation
25. Git Evidence
26. Final Verdict

---

## 23. Final verdict

Использовать ровно один:

### VERDICT A — DEPARTMENTAL RBAC MODEL PROVEN

Если departmental model доказана, текущая RBAC ей соответствует, Operator объяснён архитектурой, material unexplained delta нет.

### VERDICT B — RBAC MODEL REQUIRES GOVERNANCE DECISION

Если источники конфликтуют или expected access нельзя доказать.

### VERDICT C — MATERIAL RBAC MISMATCH FOUND

Только если expected permission явно доказан и actual permission явно отличается.

**Не выдавать C только потому, что Operator видит все вкладки.**

---

## 24. STOP conditions

STOP и report, если:

- нужен schema migration;
- отсутствует Department model и её пришлось бы изобретать;
- нужны permission changes;
- конфликтуют accepted contracts;
- неясна tenant/workspace boundary;
- source противоречит accepted security contract;
- потребуется менять C6/C7/C8/C9.

Ничего не исправлять.

---

## 25. Git

Audit-only.

Ожидается:

- no production source changes;
- no backend changes;
- no frontend changes;
- no schema changes;
- no RBAC changes.

Проверить:

```text
git status --short
git diff --check
git diff --stat
git rev-parse HEAD
git rev-parse origin/master
```

Разделить:

- tracked production changes;
- historical untracked artifacts;
- audit report.

Не reset/stash/discard существующую работу.

---

## 26. Required output

В конце отчёта дать:

1. report path;
2. baseline SHA;
3. final SHA, если изменился;
4. exact Git state;
5. departmental model conclusion;
6. Operator conclusion;
7. full-access-by-default evidence verdict;
8. recommendation for UI-C17: unchanged / re-scoped / governance decision;
9. **STOP**.

Do not implement RBAC changes in this stage.
