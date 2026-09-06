# PHASE 3 — UI-C1.2F.1B — REMEDIATION R1
## Shared Operations Center Header Period — Global Period Data-Flow Functional Fix

## 0. Цель

Предыдущий `UI-C1.2F.1B` **НЕ ПРИНЯТ**.

Header Period визуально появился, локальные date controls были удалены, однако ручная проверка выявила реальный функциональный дефект:

```text
GLOBAL HEADER PERIOD
→ KPI cards НЕ фильтруются
→ Table НЕ фильтруется
```

Это P0 functional blocker. Нельзя закрывать его только тестами или переписыванием отчёта.

Нужно диагностировать и исправить полный runtime data flow для:

```text
Requests
Orders
Bookings
Payments
```

```text
Header Period
→ URL dateFrom/dateTo
→ active registry
→ KPI request
→ table/list request
→ backend temporal predicate
→ refreshed KPI
→ refreshed table
```

Не начинать `UI-C1.2F.1C`, `UI-C1.2G`, `UI-C2`, `D8`.

---

## 1. Baseline

Accepted before 1B:

```text
UI-C1.2F.1A FINAL SHA:
4f71acc60631e0a90825185a01d4574853412d83
```

Reported but NOT accepted 1B:

```text
41ffc23138180c8006084b9a87a6681cf89be0d5
```

Сначала:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
```

Требуется clean tree, `HEAD == origin/master`, commit `41ffc...` в истории. Иначе STOP.

---

## 2. Root-Cause Audit — обязательно до исправления

Для каждого registry отдельно определить:

1. Где `HeaderPeriodControl` пишет `dateFrom/dateTo`.
2. Меняется ли URL реально.
3. Как page читает `dateFrom/dateTo`.
4. Нет ли stale local state, инициализированного из URL только один раз.
5. Входит ли period в KPI request.
6. Входит ли period в table/list request.
7. Входит ли period в effect/query dependencies.
8. Входит ли period в cache/query key.
9. Вызывает ли URL change refetch.
10. Какие реальные endpoint/query params получает backend.
11. Какое backend date field фильтруется.

Не предполагать одну root cause для всех четырёх реестров.

Особенно проверить anti-pattern:

```ts
const [dateFrom] = useState(searchParams.get("dateFrom"))
```

и fetch/effect/query keys без `dateFrom/dateTo`.

Canonical authority:

```text
URL
```

а не stale component state.

---

## 3. Canonical Scope Contract

```text
HEADER PERIOD
= GLOBAL
= KPI + TABLE

status / paymentStatus / refundStatus / currencyCard
= TABLE-ONLY
= TABLE ONLY
```

```text
KPI QUERY SCOPE
= GLOBAL SCOPE

TABLE QUERY SCOPE
= GLOBAL SCOPE + TABLE-ONLY FILTERS
```

Никакой client-side date filtering и никакого client-side KPI counting.

---

## 4. Requests

Уже принятый backend contract:

```text
list: dateFrom/dateTo → createdAt
KPI:  dateFrom/dateTo → createdAt
boundary: [from,to)
invalid date: HTTP 400
status: TABLE-ONLY
```

Обязательно доказать в Network:

```text
Requests KPI request
→ содержит dateFrom/dateTo

Requests list request
→ содержит те же dateFrom/dateTo
```

Period change обязан refetch'ить оба запроса.

Не добавлять локальные date controls.

---

## 5. Orders

Shared Header Period должен реально попадать в:

```text
Orders KPI
Orders table/list
```

Сохранить:

```text
status/paymentStatus = table-only
period = global
```

При смене периода с выбранной KPI card:

```text
selected KPI сохраняется
все KPI overview counts пересчитываются
table = новый period + выбранный table-only filter
page = 1
```

Не возвращать старые date controls и legacy кнопку `Обновить`.

---

## 6. Bookings

Shared period должен реально попадать в:

```text
Bookings KPI
Bookings table/list
```

Сохранить 13/13 canonical statuses, D6 invariants и `status = table-only`.

---

## 7. Payments

Shared period должен реально попадать в:

```text
Payments aggregates/KPI
Payments table/list
```

Сохранить:

```text
paymentStatus = table-only
refundStatus  = table-only
currencyCard  = table-only
currency      = global/base scope
```

Не ломать существующую `dateField=paidAt` deep-link compatibility, если она поддерживается.

---

## 8. Required Runtime Flow

После fix:

```text
USER CHANGES HEADER PERIOD
          ↓
URL dateFrom/dateTo CHANGES
          ↓
ACTIVE REGISTRY OBSERVES NEW URL
          ↓
page = 1
          ↓
KPI REQUEST includes NEW PERIOD
TABLE REQUEST includes NEW PERIOD
          ↓
BACKEND filters canonical date field
          ↓
KPI response changes
TABLE response changes
          ↓
UI shows same GLOBAL PERIOD
```

---

## 9. Period A → Period B Proof — P0 mandatory

Для каждого registry выбрать два периода с реально различающимися данными.

Нужны фактические числа:

| Registry | Period | KPI/overview total | Table total | Match |
|---|---|---:|---:|---|
| Requests | A | actual | actual | PASS |
| Requests | B | actual | actual | PASS |
| Orders | A | actual | actual | PASS |
| Orders | B | actual | actual | PASS |
| Bookings | A | actual | actual | PASS |
| Bookings | B | actual | actual | PASS |
| Payments | A | actual | actual | PASS |
| Payments | B | actual | actual | PASS |

Для каждого registry A и B должны давать наблюдаемое различие. Один Total в одном периоде доказательством не является.

---

## 10. Network Proof — P0 mandatory

Для каждого registry показать реальные request URLs/query params для Period B:

```text
KPI request:   <actual endpoint>?dateFrom=...&dateTo=...
TABLE request: <actual endpoint>?dateFrom=...&dateTo=...
```

Не использовать pseudo-URLs.

Дополнительно доказать:

```text
UI KPI total   = API overview total
UI table total = API table total
```

---

## 11. Selected KPI Preservation

Проверить:

```text
Period A
→ select non-Total KPI
→ change to Period B
```

Ожидается:

```text
selected KPI remains selected
overview KPI values recompute for B
table uses B + selected table-only filter
page = 1
```

Покрыть dimensions:
- Requests: status
- Orders: lifecycle status + payment status
- Bookings: status
- Payments: paymentStatus + refundStatus + currencyCard

---

## 12. Reset / Clear / Tabs / History

### Registry Reset
Очищает registry-local state, но сохраняет `dateFrom/dateTo`.

### Header Period Clear
Удаляет `dateFrom/dateTo`, `page=1`, сохраняет совместимый selected KPI/table-only filter и реально refetch'ит KPI + table для default/unbounded scope.

### Tab switch
Сохраняет только period:

```text
KEEP: dateFrom/dateTo
RESET: search/status/paymentStatus/refundStatus/currencyCard/page/selected KPI
```

### Back / Forward / Reload
URL-authoritative state обязан полностью восстанавливаться без stale local state.

---

## 13. Active Registry Fetch Only

Смена периода на Requests не должна fetch'ить Orders/Bookings/Payments и аналогично для других вкладок.

Дать Network evidence.

---

## 14. Race Check

Проверить быстрое:

```text
A → B → C
```

Финальный UI:

```text
Header = C
KPI = C
Table = C
```

Не допускается stale response от A/B поверх C.

---

## 15. Partial Range

Проверить:

```text
dateFrom only
dateTo only
dateFrom + dateTo
```

минимум на Requests и одном sibling registry.

---

## 16. No Duplicate Date Controls

После remediation:

```text
Requests — no local dates
Orders   — no local dates
Bookings — no local dates
Payments — no local dates
```

В Orders legacy `Обновить`, связанная со старым date block, должна отсутствовать.

Единственный owner:

```text
Operations Center Header
```

---

## 17. Sorting — NOT THIS STAGE

Обнаруженный реальный gap:

```text
Requests table sorting by column header отсутствует
```

Не исправлять его здесь.

Зафиксировать deferred gap для table-header/sorting stages:

```text
COLUMN LABEL / ARROW → sorting
FILTER CONTROL       → filtering
```

---

## 18. Accessibility / Responsive

Проверить фактически:

```text
1680px
768px
390px
```

Без horizontal page overflow; date inputs/clear usable; keyboard + accessible labels работают.

---

## 19. Payments Regression — обязательно

Предыдущий 1B report не показал Payments registry tests.

Теперь обязательны tests для:

```text
period → aggregates
period → table
selected paymentStatus preservation
selected refundStatus preservation
selected currencyCard preservation
Reset preserves period
```

---

## 20. Security

Запустить существующие релевантные security/RBAC tests, если доступны.

Сохранить:

```text
RBAC
workspace/tenant isolation
PLATFORM/PARTNER authority
permission-aware tabs
active-domain-only fetching
PCI/PII restrictions
```

Не писать `SECURITY PASS` только на основании того, что security code не редактировался.

---

## 21. Automated Tests

Добавить/обновить тесты, которые FAIL на дефектной `41ffc...` и PASS после fix:

```text
Header period URL mutation
Requests KPI receives period
Requests table receives period
Orders KPI/table receive period
Bookings KPI/table receive period
Payments KPI/table receive period
period change triggers refetch
page resets to 1
selected KPI preserved
registry Reset preserves period
Header Clear refetches
tab switch preserves only period
```

Тестировать data-flow/query behavior, а не только rendering.

---

## 22. Build / Regression

Запустить:

```text
frontend TSC
frontend build
frontend vitest relevant/full as repository discipline requires
OperationsCenterShell tests
Requests registry tests
Orders registry tests
Bookings registry tests
Payments registry tests
```

Backend targeted tests/build — если backend затронут.

Любой failure назвать точно. Не маркировать `pre-existing` без baseline evidence.

---

## 23. Required Browser Evidence

Нужны screenshots + Network/API evidence.

Минимум:

```text
1680px:
Period A + data
Period B + visibly different data

768px:
responsive Header Period

390px:
responsive Header Period
```

И отдельный data-flow proof для всех четырёх registries.

---

## 24. Git Hard Closure

Перед commit:

```bash
git status --porcelain=v1
git diff --check
git diff --stat
```

Commit/push только intended remediation files.

После push:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -3 --oneline --decorate
```

Обязательно:

```text
git status = <NO OUTPUT>
HEAD == origin/master
```

И:

```bash
git merge-base --is-ancestor 41ffc23138180c8006084b9a87a6681cf89be0d5 HEAD
```

exit `0`.

---

## 25. Final Report Structure

```text
A. Baseline
B. User-Observed Functional Defect
C. Root Cause by Registry
D. Fix
E. URL Data Flow
F. Requests Period A/B Proof
G. Orders Period A/B Proof
H. Bookings Period A/B Proof
I. Payments Period A/B Proof
J. Network Request Matrix
K. API/UI Reconciliation
L. Selected KPI Preservation
M. Reset
N. Header Clear
O. Tab Switch
P. Reload / Back / Forward
Q. Active-Domain Fetch Only
R. Race/Stale Response Check
S. Partial Range
T. Accessibility / Responsive
U. Security
V. Tests / Build
W. Files Changed
X. Git Hard Closure
Y. Final Verdict
```

---

## 26. Acceptance Criteria

PASS only if ALL true:

```text
1. Header Period changes URL
2. Requests KPI + table receive period
3. Orders KPI + table receive period
4. Bookings KPI + table receive period
5. Payments KPI + table receive period
6. Period A/B produces demonstrably different scoped data in all 4
7. UI/API totals reconcile
8. period change recomputes KPI + table
9. page → 1
10. selected KPI survives same-registry period change
11. Registry Reset preserves period
12. Header Clear refetches correct scope
13. tab switch preserves only period
14. Back/Forward/reload work
15. active registry only fetches
16. no stale-response race
17. no local date controls
18. Orders legacy date `Обновить` absent
19. Payments regression tests pass
20. responsive 1680/768/390 verified
21. accessibility verified
22. security/RBAC regression verified
23. TSC/build/relevant tests pass
24. working tree clean
25. HEAD == origin/master
26. original 1B SHA is ancestor
```

---

## 27. Final Verdict Format

```text
VERDICT A — UI-C1.2F.1B
SHARED OPERATIONS CENTER HEADER PERIOD
— ACCEPTED AFTER REMEDIATION R1

BASELINE ACCEPTED SHA:
4f71acc60631e0a90825185a01d4574853412d83

ORIGINAL UI-C1.2F.1B SHA:
41ffc23138180c8006084b9a87a6681cf89be0d5

FINAL SHA:
<actual>

HEADER PERIOD UI                  — PASS
URL AUTHORITY                     — PASS
REQUESTS PERIOD → KPI/TABLE       — PASS
ORDERS PERIOD → KPI/TABLE         — PASS
BOOKINGS PERIOD → KPI/TABLE       — PASS
PAYMENTS PERIOD → KPI/TABLE       — PASS
PERIOD A/B RUNTIME PROOF          — PASS
NETWORK PARAMETER PROOF           — PASS
API/UI RECONCILIATION             — PASS
SAME-REGISTRY KPI PRESERVATION    — PASS
PAGE RESET                        — PASS
REGISTRY RESET PRESERVES PERIOD   — PASS
HEADER CLEAR                      — PASS
TAB SWITCH PERIOD ONLY            — PASS
BACK/FORWARD/RELOAD               — PASS
ACTIVE-DOMAIN FETCH ONLY          — PASS
STALE RESPONSE PROTECTION         — PASS
NO LOCAL DATE CONTROLS            — PASS
ORDERS LEGACY UPDATE BUTTON       — ABSENT
PAYMENTS REGRESSION               — PASS
ACCESSIBILITY                     — PASS
RESPONSIVE 1680/768/390           — PASS
SECURITY/RBAC                     — PASS
REGRESSION                        — PASS
WORKING TREE CLEAN                — PASS
HEAD == origin/master             — PASS
ORIGINAL 1B SHA ANCESTRY          — PASS
GIT HARD CLOSURE                  — PASS

UI-C1.2F.1B — ACCEPTED

KNOWN DEFERRED GAP:
Requests table sorting — deferred to table-header/sorting work

UI-C1.2F.1C — NOT STARTED
UI-C1.2G — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2F.1C — Shared TableHeaderFilter Component
```

При любом runtime blocker:

```text
VERDICT B — UI-C1.2F.1B
REMEDIATION R1 NOT ACCEPTED

BLOCKERS:
- <exact blocker>

UI-C1.2F.1C — NOT STARTED
```

---

## 28. Stop Rule

Не переходить к `UI-C1.2F.1C`.

Сначала:

```text
working global period data flow
+ real browser/network proof
+ regression qualification
+ clean Git closure
```

После отчёта STOP для независимой проверки.
