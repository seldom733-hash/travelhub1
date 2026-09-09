# PHASE 3 — UI-C6 — REQUEST SERVER-AUTHORITY REMEDIATION
## FINAL IMPLEMENTATION + QUALIFICATION PROMPT

**Language:** Russian  
**Repository:** `https://github.com/seldom733-hash/travelhub1`  
**Baseline:** `5785b87a854fdb9fd8de27bd970de880e3cc21f7`  
**Current governance:** `UI-C6 = NOT STARTED`, `SEC-UI-01 = OPEN`  
**Audit state:** `AUDIT READY`  
**Audit report:** `docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_AUDIT_FIRST_MAPPING_REPORT.md`

---

## 1. ROLE AND EXECUTION ORDER

Работай как senior/staff-level engineer + security engineer + QA/qualification engineer.

Выполняй строго:

1. Baseline Verification
2. Audit Findings Verification
3. Minimal Implementation
4. Automated Verification
5. Runtime / Security Qualification
6. Qualification Report
7. Git Hard Closure
8. Только после полного успеха — закрытие `SEC-UI-01`
9. Final Verdict

Не перескакивай этапы.

---

## 2. BASELINE START GATE

Перед изменениями:

```bash
git fetch origin
git status --short
git rev-parse HEAD
git rev-parse origin/master
```

Ожидаемый baseline:

```text
5785b87a854fdb9fd8de27bd970de880e3cc21f7
```

Проверить:

```bash
git diff 5785b87a854fdb9fd8de27bd970de880e3cc21f7 --stat
git status --short
```

Если HEAD отличается от baseline и это не подтверждённое продолжение именно UI-C6 — **STOP**. Не смешивать стадии.

---

## 3. AUDIT-FIRST FINDINGS

Предыдущий UI-C6 audit установил следующие source-backed факты.

### 3.1 Реальные Request mutation endpoints

```text
POST /requests
POST /requests/:id/confirm-price
POST /requests/:id/propose-price
POST /requests/:id/reject
POST /requests/:id/unavailable
POST /requests/:id/customer-accept
POST /requests/:id/customer-decline
POST /requests/:id/convert
```

Не изобретать дополнительные действия.

### 3.2 Canonical Request actions

Использовать только:

```text
confirmPrice
proposePrice
reject
unavailable
customerAccept
customerDecline
convert
```

Не добавлять `cancel`, `approve`, `complete`, `refund`, `reschedule`, `assign`, `reopen` и т.п., если их нет в фактическом Request contract.

### 3.3 Canonical Request statuses

Не менять lifecycle:

```text
NEW
CHECKING
SUPPLIER_TIMEOUT
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED
REJECTED
UNAVAILABLE
EXPIRED
CUSTOMER_PAYMENT_TIMEOUT
CANCELLED_BY_CUSTOMER
```

Не переименовывать, не объединять и не добавлять статусы.

---

## 4. PRIMARY GAP

Request Detail сейчас частично вычисляет доступность действий на frontend:

```ts
const canEdit = useCan("order.edit_noncritical");

const showSupplier =
  canEdit &&
  ["NEW", "CHECKING", "PRICE_CHANGED"].includes(r.status);

const showCustomer =
  canEdit &&
  ["CONFIRMED", "PRICE_CHANGED"].includes(r.status);

const showConvert =
  canEdit &&
  r.status === "CUSTOMER_ACCEPTED" &&
  !r.convertedOrderId;
```

Это не должно оставаться authority.

Целевая модель:

```text
BACKEND = authority
FRONTEND = renderer / consumer
```

---

## 5. SERVER-AUTHORITATIVE `availableActions`

Добавить в существующий Request Detail/read contract server-computed:

```text
availableActions
```

Предпочтительно типизированная форма:

```ts
availableActions: {
  confirmPrice: boolean;
  proposePrice: boolean;
  reject: boolean;
  unavailable: boolean;
  customerAccept: boolean;
  customerDecline: boolean;
  convert: boolean;
}
```

Если в проекте уже есть соответствующий typed pattern — использовать его.

Не копировать D5 механически. D5/D6 — архитектурный reference:

```text
server computes
    ↓
business gates
    ↓
permission gates
    ↓
frontend renders
```

Request должен сохранить собственную domain semantics.

---

## 6. ACTION AVAILABILITY

Server-side availability должна учитывать:

1. текущий Request status;
2. существующие business gates;
3. actor permissions;
4. существующие domain conditions;
5. реальные execution rules endpoint.

Не создавать новую authorization model.

---

## 7. ОБЯЗАТЕЛЬНЫЙ FIX: `customerDecline`

Audit выявил gap: `customerDecline` обновляет Request до `CANCELLED_BY_CUSTOMER`, но не содержит source-status validation, аналогичной другим lifecycle mutations.

Перед реализацией повторно проверить:

- controller;
- request.service;
- RequestStatus enum;
- frontend;
- существующие tests;
- D3/D5/D6 evidence.

Определить valid source states только по фактической evidence.

Требования:

```text
invalid current status
→ deterministic 4xx
→ no state mutation
→ no history mutation
```

Valid source state:

```text
customerDecline
→ success
→ CANCELLED_BY_CUSTOMER
→ expected history/audit
```

Нельзя придумывать новые состояния или silent fallback.

---

## 8. EXECUTION AUTHORITY

`availableActions` — projection/read contract, а не единственный security gate.

Каждый mutation endpoint обязан самостоятельно проверять:

```text
authentication
+
permission
+
business rule
+
current state
+
required entity conditions
```

Прямой HTTP POST должен быть защищён независимо от UI:

- hidden button;
- изменённый frontend;
- прямой URL;
- curl/fetch;
- replay;
- stale UI.

---

## 9. PERMISSIONS

Canonical mutation permission:

```text
order.edit_noncritical
```

Не создавать новые granular permissions без source-backed необходимости.

Проверить:

- actor с permission;
- actor без permission;
- unauthenticated;
- неподходящая роль;
- существующие context/scope cases.

---

## 10. TENANT / WORKSPACE SCOPE

Audit не доказал отдельную Request-specific tenant/workspace authorization model.

Поэтому UI-C6 **не должен** создавать:

- новый `tenantId`;
- новый workspace ownership model;
- новую scope predicate;
- schema migration ради этого;
- новый multi-tenant layer.

Сохранить фактическую platform Request scope.

Если implementation обнаружит source-backed boundary, противоречащий audit mapping — **STOP и report blocker**, не угадывать.

---

## 11. FRONTEND MIGRATION

Request Detail должен потреблять только server-provided `availableActions`.

Убрать status arrays как authority:

```ts
["NEW", "CHECKING", ...].includes(r.status)
```

Допустимо использовать `availableActions` для:

- show/hide;
- disabled state;
- action grouping;
- loading/accessibility.

Недопустимо повторно реализовывать lifecycle matrix на frontend.

---

## 12. DATA CONTRACT

Изменение должно быть минимальным:

```text
existing Request detail response
+
availableActions
```

Не создавать новый endpoint, если существующий detail endpoint может безопасно предоставить поле.

Не делать schema migration, если она не нужна.

Не менять unrelated DTOs/domains.

---

## 13. SCOPE

### IN SCOPE

- server-authoritative `availableActions`;
- server-side action availability;
- `customerDecline` status validation;
- Request Detail frontend migration;
- typed contract;
- targeted backend tests;
- negative security tests;
- frontend tests;
- regression;
- qualification;
- qualification report;
- Debt Register closure после полного успеха.

### OUT OF SCOPE

- UI-C7;
- полный Request redesign;
- новая state machine;
- новые permissions;
- tenant/workspace redesign;
- unnecessary schema migration;
- Finance Center;
- Payments redesign;
- Payment Detail;
- PROD-01;
- D8;
- новые Commerce domains;
- Order/Booking lifecycle redesign;
- unrelated refactors.

---

## 14. TEST MATRIX

Проверить `availableActions` для всех canonical statuses:

```text
NEW
CHECKING
SUPPLIER_TIMEOUT
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED
REJECTED
UNAVAILABLE
EXPIRED
CUSTOMER_PAYMENT_TIMEOUT
CANCELLED_BY_CUSTOMER
```

Каждый status должен иметь доказанную expected action projection.

---

## 15. DIRECT API NEGATIVE TESTS

Обязательно:

### Unauthorized

```text
no auth → reject
```

### Missing permission

```text
authenticated
+
without order.edit_noncritical
→ mutation rejected
```

### Invalid lifecycle state

Для relevant actions:

```text
wrong status
→ deterministic 4xx
→ no state mutation
```

Особенно:

```text
customerDecline
+
invalid current status
→ reject
→ status unchanged
→ no history mutation
```

### Valid customerDecline

Из каждого source-backed valid state:

```text
→ success
→ CANCELLED_BY_CUSTOMER
→ expected history
```

---

## 16. STALE / RACE SAFETY

Проверить:

```text
GET Request
→ availableActions says action=true
→ another actor changes state
→ first actor POSTs action
```

Ожидается:

```text
server revalidates current state
→ stale action rejected
```

`availableActions` не заменяет current-state validation.

---

## 17. FRONTEND TESTS

Проверить:

```text
availableActions=true
→ action rendered

availableActions=false
→ action not rendered / correctly disabled

server projection changes
→ UI follows server projection

frontend does not recreate lifecycle matrix
```

Regression:

- Request Detail opens;
- status displays;
- relation chain remains;
- Notes remain;
- Audit remains;
- valid actions still work;
- Orders/Bookings remain unaffected.

---

## 18. SECURITY MATRIX

Минимум:

| Actor | Read | Mutation | Expected |
|---|---:|---:|---|
| authorized platform actor | 200 | allowed when server says available | PASS |
| authenticated without mutation permission | 200/read | 403 | PASS |
| unauthenticated | denied | denied | PASS |
| stale-state actor | 200/read | 4xx on invalid current state | PASS |

Если текущая security model предусматривает дополнительные cases — проверить их.

---

## 19. API ↔ UI CONSISTENCY

Для каждого action доказать:

```text
Backend availableActions
        ==
UI rendered actions
```

Actions:

```text
confirmPrice
proposePrice
reject
unavailable
customerAccept
customerDecline
convert
```

Не выводить UI availability из status arrays.

---

## 20. RUNTIME QUALIFICATION

В реальном browser/runtime проверить:

- Request list;
- Request Detail;
- разные statuses;
- action visibility;
- valid action;
- invalid/stale action;
- permission denied;
- reload;
- direct URL;
- back/forward;
- loading;
- error;
- empty/null fields;
- responsive;
- keyboard navigation;
- focus;
- accessible labels.

---

## 21. I18N / ACCESSIBILITY

При изменении UI проверить:

```text
RU
AZ
EN
```

Не оставлять raw translation keys.

Проверить buttons, dialogs, errors, loading, statuses/actions, keyboard/focus/labels.

Не менять глобальную i18n architecture.

---

## 22. REGRESSION

Проверить accepted functionality:

### Requests
- list;
- filters;
- detail;
- relation chain;
- notes;
- audit;
- actions.

### Orders
- list;
- detail;
- KPI/header filtering;
- relation chain;
- notes;
- audit.

### Bookings
- list;
- detail;
- relation chain;
- notes;
- audit.

### Payments
- list;
- KPI/header filtering;
- RBAC;
- period.

---

## 23. AUTOMATED GATES

Обязательно:

```text
backend targeted tests
frontend targeted tests
relevant regression suites
TypeScript
build
lint — если это существующий project gate
```

Не маскировать failures.

Если есть pre-existing failure:

1. baseline it;
2. доказать наличие до UI-C6;
3. доказать отсутствие связи с UI-C6;
4. сохранить в report;
5. не называть весь gate green, если он формально red.

---

## 24. CONSOLE / RUNTIME CLEANLINESS

Проверить:

```text
console.error
console.warn
unhandled promise rejection
failed network requests
React warnings
hydration errors
```

Новые UI-C6 warnings/errors = FAIL.

---

## 25. NO SILENT FALLBACK

Запрещено:

```text
availableActions missing
→ frontend guesses from status
```

```text
unknown action
→ silently ignore
```

```text
invalid status
→ execute anyway
```

```text
backend error
→ frontend shows success
```

Любое такое поведение = FAIL.

---

## 26. QUALIFICATION REPORT

Создать:

```text
docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_QUALIFICATION_REPORT.md
```

Обязательные разделы:

1. Executive Summary
2. Baseline
3. Audit Findings
4. Implementation Scope
5. Files Changed
6. Server Authority Design
7. `availableActions` Contract
8. Action Availability Matrix
9. `customerDecline` Fix
10. RBAC / Security
11. Direct API Negative Tests
12. Stale/Race Verification
13. Frontend Migration
14. Runtime Qualification
15. i18n / Accessibility
16. Regression
17. Automated Tests
18. TypeScript / Build
19. Known Pre-existing Failures
20. Debt Register Change
21. Git Closure
22. Final Verdict

Report должен отражать реальные команды, реальные результаты и реальные SHA. Никаких выдуманных PASS.

---

## 27. DEBT REGISTER

До полного qualification:

```text
SEC-UI-01 = OPEN
Closure SHA = —
Planned closure stage = UI-C6 (Request Server-Authority Remediation)
```

Только после полного успешного qualification изменить:

```text
Status → CLOSED
Closure SHA → FINAL PUSHED SHA
```

Не закрывать unrelated debts.

Не закрывать:

- PROD-01;
- PAY-01;
- UI-C7;
- D8;
- Finance Center debts,

если они не относятся к UI-C6.

---

## 28. GIT HARD CLOSURE

Перед verdict:

```bash
git status --short
git diff
git diff --cached
git log -1 --oneline
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
```

Обязательно:

```text
HEAD == origin/master
working tree clean
staged diff empty
unstaged diff empty
```

Проверить:

```bash
git diff BASELINE..HEAD --stat
git diff BASELINE..HEAD
```

Не должно быть:

- debug code;
- temporary files;
- test artifacts;
- secrets;
- unrelated source changes;
- accidental schema changes;
- unrelated refactors.

Если после implementation создаётся report/debt commit — closure SHA является **последним реально pushed commit**, а не implementation SHA.

---

## 29. FINAL VERDICT

### VERDICT A — ACCEPTED / SEC-UI-01 CLOSED

Только если одновременно:

```text
audit findings addressed
AND
server authority implemented
AND
frontend consumes server authority
AND
customerDecline validation implemented
AND
negative API tests PASS
AND
RBAC PASS
AND
stale/race protection PASS
AND
runtime PASS
AND
regression PASS
AND
TSC PASS
AND
build PASS
AND
no new console errors
AND
i18n/a11y PASS where applicable
AND
Debt Register updated
AND
Git clean
AND
HEAD == origin/master
```

Тогда:

```text
UI-C6 = ACCEPTED
SEC-UI-01 = CLOSED
UI-C7 = NOT STARTED
D8 = NOT STARTED
```

### VERDICT B — VALID SYSTEM FAIL

Если implementation есть, но mandatory gate failed:

```text
UI-C6 = NOT ACCEPTED
SEC-UI-01 = OPEN
```

### VERDICT C — BLOCKED

Если baseline/security/architecture/source evidence не позволяет безопасно продолжить:

```text
UI-C6 = BLOCKED
SEC-UI-01 = OPEN
```

Не угадывать и не маскировать failure.

---

## 30. MANDATORY STOP CONDITIONS

Немедленно STOP при:

1. baseline mismatch;
2. неожиданных schema/domain changes;
3. необходимости новой permission model;
4. необходимости нового tenant/workspace model;
5. противоречии canonical Request lifecycle;
6. невозможности доказать valid `customerDecline` states;
7. необходимости unrelated refactor;
8. неподтверждённых untracked source changes;
9. невозможности выполнить security qualification;
10. невозможности установить фактический final Git SHA.

---

## 31. REQUIRED FINAL RESPONSE

После завершения предоставить:

```text
UI-C6 — FINAL QUALIFICATION

Baseline:
Implementation SHA:
Qualification/Report SHA:
Final SHA:
HEAD == origin/master:
Working tree clean:

Server authority:
availableActions:
customerDecline validation:

Security:
RBAC:
Negative API:
Stale/race:

Runtime:
Regression:
TSC:
Build:
Console:

Debt Register:
SEC-UI-01:

Final Verdict:
```

Если хотя бы один mandatory gate не выполнен — **не писать VERDICT A**.

---

# FINAL PRINCIPLE

UI-C6 — не косметический UI change.

До:

```text
Backend execution rules
        +
Frontend duplicated lifecycle logic
        ↓
possible divergence
```

После:

```text
Backend
  ├── authorization
  ├── business rules
  ├── current state validation
  └── availableActions
          ↓
       Frontend
       renders only
```

> **Frontend may render an action, but only the server may authorize and execute it.**

Не расширять scope.  
Не менять архитектуру без evidence.  
Не закрывать `SEC-UI-01` преждевременно.  
Полная qualification и Git Hard Closure обязательны.
