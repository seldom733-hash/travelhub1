# PHASE 3 — UI-C6 — FINAL RUNTIME REQUALIFICATION & GIT HARD CLOSURE PROMPT

## РОЛЬ

Выполни **финальную runtime requalification UI-C6** после завершённой server-authority remediation.

Текущий статус:

- `UI-C6 = PENDING`
- `SEC-UI-01 = OPEN`
- `UI-C7 = NOT STARTED`
- `D8 = NOT STARTED`

Предыдущая remediation уже реализовала:
- typed `availableActions` для Request;
- frontend Request Detail использует только server projection;
- deterministic current-status validation для `customerDecline`;
- учёт существующего `customerActionDeadline` для `customerAccept`;
- учёт существующих D3 acceptance snapshot prerequisites для `convert`;
- UI-C6 e2e `22/22 PASS`;
- TypeScript/typecheck/build PASS.

**Сейчас НЕ перепроектируй UI-C6 и НЕ добавляй новые бизнес-правила без доказательства. Цель — финальная runtime-проверка и Git hard closure.**

---

## 1. AUTHORITY ORDER

При расхождениях использовать:

1. фактический source code текущего HEAD;
2. фактический runtime/API behavior;
3. automated tests;
4. schema/Prisma;
5. принятые D5/D6/D7 patterns;
6. qualification reports;
7. Debt Register;
8. prompts/history.

Не выводить бизнес-правила только из отчёта.

---

## 2. КРИТИЧЕСКАЯ ПРОВЕРКА BUSINESS GATES

Перед runtime qualification прочитай фактические execution paths:

```text
computeRequestAvailableActions()
customerAccept()
customerDecline()
convert()
```

Особенно `customerDecline`.

### customerDecline

Установи по фактическому коду:

- разрешённые source statuses;
- проверяется ли `customerActionDeadline`;
- существуют ли другие business gates.

**Не добавляй deadline в `customerDecline` только потому, что он есть у `customerAccept`.**

Projection должна соответствовать существующему execution contract, а не расширять его.

### customerAccept

Подтвердить соответствие projection фактическому execution path:

- status;
- permission;
- `convertedOrderId`;
- `customerActionDeadline`;
- существующие D3 prerequisites, если они реально проверяются execution path.

### convert

Подтвердить соответствие:

- `customerAcceptedAt`;
- `pinnedRequirements`;
- `travelerCount`;
- `productSnapshot`;
- `convertedOrderId`;
- существующим transactional/current-state checks.

Не создавать новых бизнес-правил.

---

## 3. LIVE RUNTIME MATRIX

На актуальном работающем instance выполнить реальные проверки и для каждого кейса зафиксировать:

```text
Request status
Relevant fields
Actor / permission
GET /requests/:id
availableActions
Expected
Actual
PASS/FAIL
```

Проверить отдельно:

### NEW

```text
confirmPrice=true
proposePrice=true
reject=true
unavailable=true
customerAccept=false
customerDecline=false
convert=false
```

### CHECKING

Отдельный runtime case:

```text
confirmPrice=true
proposePrice=true
reject=true
unavailable=true
customerAccept=false
customerDecline=false
convert=false
```

### PRICE_CHANGED — valid window

```text
customerAccept=true
customerDecline=true
остальные=false
```

### CONFIRMED — valid window

```text
customerAccept=true
customerDecline=true
остальные=false
```

### Expired customerActionDeadline

Проверить фактический execution contract и projection.

Особенно отдельно проверить `customerAccept` и `customerDecline`.

**Если deadline является gate только для customerAccept, не делать customerDecline=false автоматически.**

### CUSTOMER_ACCEPTED + полный D3 snapshot

```text
convert=true
остальные=false
```

при всех реально необходимых execution prerequisites.

### CUSTOMER_ACCEPTED без D3 snapshot

```text
convert=false
```

и отсутствие других actionable actions.

### CONVERTED

```text
all=false
```

### Terminal statuses

Каждый отдельно:

```text
REJECTED
UNAVAILABLE
SUPPLIER_TIMEOUT
EXPIRED
CUSTOMER_PAYMENT_TIMEOUT
CANCELLED_BY_CUSTOMER
```

Проверить `all=false`, если это соответствует execution contract.

---

## 4. RBAC RUNTIME

Проверить:

### Authorized actor

Actor с:

```text
order.edit_noncritical
```

получает соответствующие actionable actions.

### Actor without permission

Проверить существующий contract для `SALES_MANAGER`/actor без `order.edit_noncritical`:

```text
availableActions = all false
```

### Unauthenticated

```text
GET detail → 401
POST customer-decline → 401
```

Не менять RBAC model.

---

## 5. DIRECT API AUTHORITY

`availableActions` — projection, не единственный security gate.

Проверить:

### Invalid customerDecline

```text
→ deterministic 4xx
→ state unchanged
→ history unchanged
```

### Stale action

```text
GET Request
→ availableActions.customerDecline=true
→ другой actor меняет state
→ первый actor POST customer-decline
```

Ожидание:

```text
server revalidates current state
→ reject
→ no invalid mutation
```

---

## 6. FRONTEND RUNTIME

Проверить Request Detail:

- кнопки появляются только согласно `availableActions`;
- frontend не содержит собственного lifecycle/status matrix;
- invalid/stale state не создаёт ложную UI authority;
- detail shell, status, relation chain, notes, audit и valid actions не сломаны;
- нет новых raw i18n keys;
- нет новых UI-C6 console errors.

**UI-C6 не является визуальным redesign.**

---

## 7. DIRECT URL / REFRESH

Открыть canonical Request Detail напрямую.

Проверить:

- detail загружается;
- `availableActions` приходит с сервера;
- permissions соблюдаются;
- actions соответствуют projection;
- refresh не восстанавливает старую frontend-derived authority.

---

## 8. AUTOMATED REGRESSION

После runtime:

### Backend

```text
npm run typecheck
npm run build
test/ui-c6-request-server-authority.e2e-spec.ts
test/d3-request-flow.e2e-spec.ts
test/request-center-search.e2e-spec.ts
```

UI-C6 suite:

```text
22/22 PASS
```

### Frontend

```text
npm run build
npm test
```

Известные pre-existing failures не маскировать. Если они остаются — явно отделить от UI-C6.

---

## 9. SCOPE FREEZE

Не изменять:

- Order `availableActions`;
- Booking `availableActions`;
- permissions model;
- tenant/workspace model;
- Prisma schema;
- Finance Center;
- Payments architecture;
- PROD-01;
- UI-C7;
- D8;
- unrelated refactors;
- Request lifecycle;
- Request status enum.

Не создавать новые permissions или Request actions.

Канонический набор ровно:

```text
confirmPrice
proposePrice
reject
unavailable
customerAccept
customerDecline
convert
```

---

## 10. ЕСЛИ НАЙДЕНО РАСХОЖДЕНИЕ

Разделять:

### A. Real defect

Например:

```text
execution rejects action
BUT
availableActions=true
```

Исправление допустимо только в пределах UI-C6 и существующего execution contract.

### B. Qualification error

Если expectation не подтверждается source — исправить expectation/report, а не бизнес-логику.

### C. Unrelated debt

Не исправлять в UI-C6.

---

## 11. REPORT

Обновить:

```text
docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_QUALIFICATION_REPORT.md
```

Чётко разделить:

```text
SOURCE-LEVEL EVIDENCE
AUTOMATED E2E EVIDENCE
LIVE RUNTIME EVIDENCE
```

Для каждого live case:

```text
CASE
EXPECTED
ACTUAL
EVIDENCE
VERDICT
```

Не писать `runtime PASS`, если live check фактически не выполнялся.

---

## 12. SEC-UI-01 CLOSURE CONDITION

Закрыть:

```text
SEC-UI-01 = CLOSED
```

можно только если одновременно выполнены:

1. server-authoritative projection реализован;
2. frontend использует projection;
3. execution endpoints сохраняют независимую server authority;
4. projection соответствует execution business gates;
5. `customerDecline` имеет deterministic current-state validation;
6. UI-C6 e2e = 22/22 PASS;
7. полная runtime matrix пройдена;
8. RBAC runtime подтверждён;
9. stale action runtime подтверждён;
10. frontend runtime подтверждён;
11. TSC/typecheck/build PASS;
12. regression PASS с честным учётом pre-existing failures;
13. report обновлён;
14. Debt Register обновлён;
15. Git hard closure выполнен.

Если хотя бы один пункт отсутствует:

```text
UI-C6 = PENDING
SEC-UI-01 = OPEN
```

---

## 13. DEBT REGISTER

Только при полном выполнении acceptance conditions:

```text
SEC-UI-01
Status: OPEN → CLOSED
Closure SHA: <final SHA>
```

Не закрывать другие debts.

Не менять PROD-01.

---

## 14. GIT HARD CLOSURE

Перед финальным verdict:

```bash
git status --short
git diff
git diff --cached
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
```

Обеспечить:

```text
HEAD == origin/master
working tree clean
```

Сейчас известны локальные modified/untracked prompt/report artifacts.

**Не удалять пользовательские материалы вслепую.**

Разделить:

```text
A. необходимые UI-C6 artifacts
B. unrelated prompt/report artifacts
C. temporary/debug artifacts
```

Temporary/debug artifacts можно удалить только если они явно относятся к текущей execution session.

Не включать unrelated artifacts в UI-C6 closure commit.

---

## 15. FINAL VERDICT

Разрешены только два варианта.

### VERDICT A

```text
UI-C6 — ACCEPTED
SEC-UI-01 — CLOSED
```

Только при полном выполнении всех acceptance conditions.

Указать:

```text
Baseline SHA
Implementation SHA
Final SHA
HEAD
origin/master
Git clean
Runtime evidence
Automated evidence
TSC
Build
Regression
SEC-UI-01 closure SHA
```

### VERDICT B

```text
UI-C6 — PENDING
SEC-UI-01 — OPEN
```

если отсутствует хотя бы одно обязательное доказательство.

В этом случае:

- не закрывать SEC-UI-01;
- не переходить к UI-C7;
- не переходить к D8;
- перечислить только конкретные outstanding gates.

---

## 16. STOP CONDITION

После финального verdict:

**STOP.**

Не начинать:

- UI-C7;
- D8;
- Finance Center;
- PROD-01;
- новые UI improvements.

Следующий этап только после отдельного решения пользователя.

---

# КЛЮЧЕВОЙ ПРИНЦИП

```text
Frontend does not decide what the actor may do.
Server projects what is currently executable.
Server independently enforces execution.
Runtime evidence proves both.
```

Не путать:

```text
availableActions = projection
mutation endpoint = authority
```

И не закрывать `SEC-UI-01` только на основании зелёного e2e.
