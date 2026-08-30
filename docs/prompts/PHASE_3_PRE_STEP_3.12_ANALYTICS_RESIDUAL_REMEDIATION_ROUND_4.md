# PHASE 3 — PRE-STEP 3.12 — ANALYTICS RESIDUAL REMEDIATION — ROUND 4

## STATUS

**Starting baseline:** `8bc2282`

Предыдущий этап:

```text
PHASE 3 — PRE-STEP 3.12
ANALYTICS STRICT RUNTIME RE-QUALIFICATION — ROUND 3
```

Round 3 завершён:

```text
Starting SHA:  3eeb3ee
Final SHA:     8bc2282
origin/master: 8bc2282

VERDICT A — ANALYTICS STRICT RUNTIME RE-QUALIFICATION ROUND 3 APPROVED
```

При этом сам Round 3 подтвердил:

```text
RG2 FX/reporting currency — BLOCKING
RG4 Behavioral telemetry — BLOCKING
```

и Analytics PRE-STEP не считается полностью закрытым.

После завершения Round 3 в runtime выявлены дополнительные residual defects / requirements, которые в него не входили.

**Step 3.12 — Users & Access Completion НЕ НАЧИНАТЬ.**

---

# LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose documentation должны быть преимущественно **на русском языке**:

- Implementation Report;
- Remediation Report;
- Strict Review Report;
- Evidence / Runtime Report;
- Gap Audit;
- findings explanations;
- root cause analysis;
- architecture decisions;
- security findings;
- runtime evidence descriptions;
- conclusions/recommendations;
- verdict explanations.

English разрешён только для технических идентификаторов:

- file paths;
- class/method/DTO/model/table names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enums;
- permission identifiers;
- code snippets;
- standardized VERDICT strings.

Если итоговый отчёт преимущественно на английском языке — задача считается незавершённой до исправления отчёта.

---

# 1. OBJECTIVE

Закрыть residual runtime defects после SHA `8bc2282`:

```text
R4-01 Shared CUSTOM Period lifecycle / validation
R4-02 KPI Drill-down / Source Traceability
R4-03 Partner Commission Policy visibility
R4-04 Period-chain control verification
```

Дополнительно подтвердить, что исправления не ломают:

- Analytics;
- Command Center;
- shared PeriodSelector;
- Partner management;
- RBAC / workspace isolation;
- existing period semantics.

Не внедрять FX conversion и behavioral telemetry subsystem в этом Round.

---

# 2. R4-01 — SHARED CUSTOM PERIOD / DATE RANGE LIFECYCLE — P1

## Runtime evidence

### Analytics

После выбора:

```text
Период
```

до заполнения обеих дат UI показывает:

```text
Ошибка загрузки

Invalid startDate format: undefined (expected YYYY-MM-DD)
```

Это означает, что request/refresh запускается до завершения пользовательского ввода.

### Command Center

После выбора:

```text
Период
```

до заполнения обеих дат UI показывает:

```text
Start and end dates are required for CUSTOM period
```

и дополнительно второй banner:

```text
Ошибка обновления: Start and end dates are required for CUSTOM period
```

После заполнения обеих дат ошибки исчезают.

Это подтверждает shared lifecycle defect.

## Canonical behavior

При выборе CUSTOM:

```text
user selects CUSTOM
        ↓
show start/end inputs
        ↓
while range incomplete
        ↓
NO API request
NO refresh
NO loading error
NO duplicate error
preserve current valid data
        ↓
when both dates valid
        ↓
validate
        ↓
request
        ↓
refresh data
```

## Mandatory scenarios

Проверить минимум:

```text
CUSTOM selected, both dates empty
only startDate
only endDate
startDate > endDate
startDate = endDate
clear startDate after valid range
clear endDate after valid range
CUSTOM → preset
preset → CUSTOM
page refresh with preset=CUSTOM but no dates
URL/query hydration
browser back/forward
comparison=true
comparison=false
```

## Validation rules

Frontend должен:

- не отправлять `undefined`;
- не сериализовать invalid date;
- не создавать request до валидного диапазона;
- валидировать `startDate <= endDate`;
- использовать canonical `YYYY-MM-DD` API format;
- сохранять shared timezone semantics.

Backend validation оставить строгой.

Не ослаблять backend contract только ради suppressing frontend bug.

## Error UX

Не показывать backend validation error как loading failure, если пользователь ещё просто не закончил ввод.

Не показывать два banner для одной и той же ошибки.

Если пользователь ввёл логически неверный диапазон:

```text
startDate > endDate
```

показать одно понятное localized validation message.

## Shared component requirement

Если Analytics и Command Center используют один `PeriodSelector` / shared date-range contract, исправление должно быть общим.

Не делать два независимых workaround.

Проверить все другие места проекта, которые импортируют тот же shared component.

---

# 3. R4-02 — KPI DRILL-DOWN / SOURCE TRACEABILITY — P1

## Purpose

Analytics KPI должны быть не только summary cards, но и проверяемыми entry points к authoritative source data.

Canonical principle:

```text
KPI
 ↓ click
authoritative source / domain center / dedicated drill-down
 ↓
same period
same workspace
same metric semantics
same relevant filters/status
 ↓
visible records / formula
 ↓
reconciliation with KPI
```

## Required KPI map

Провести repository/domain audit и определить destination для минимум:

```text
Orders
Bookings
Customer Payments
Refunds
Commission
Customers
Partners
GMV
AOV
Qualified GMV
Collected GMV
Open GMV
Sessions
```

Не придумывать destination, если authoritative UI отсутствует.

## Preferred routing

### Existing authoritative domain page

Если источник уже имеет полноценный registry:

```text
Orders → Orders Center
Bookings → Booking Center
Customers → CRM Customers
Partners → Partners
Payments → Finance / Payments
Refunds → Finance / Refunds
```

Клик должен переносить relevant filter state:

```text
from
to
workspace
metric scope
status scope
currency/reportingCurrency
partner/customer/service filters
```

Пример concept:

```text
/app/orders?from=...&to=...&analyticsMetric=orders
```

Точные route/query names определить из существующей routing architecture.

### No authoritative destination yet

Если canonical source UI ещё не существует, использовать dedicated Analytics drill-down:

```text
Analytics KPI
→ detail page/drawer
→ formula
→ source records
→ total
```

Не вести на нерелевантную страницу только ради кликабельности.

## Reconciliation requirement

Для drill-down metric должно быть возможно доказать:

```text
visible source total
=
headline KPI
```

если source UI и KPI используют одинаковую semantics.

Если metric derived:

```text
AOV
GMV variants
Commission
```

drill-down должен показывать:

- formula;
- numerator;
- denominator;
- included records;
- excluded statuses;
- currency semantics.

## Security

Drill-down не должен расширять доступ.

Server-side authorization обязателен:

```text
workspace
tenant/partner scope
role
permission
entitlement
```

Frontend-hidden != server-side denied.

Клик не должен позволять ADMIN/Partner/User выйти за scope через query params.

## UX

KPI card должна явно выглядеть интерактивной:

- pointer/focus state;
- keyboard accessible;
- Enter/Space;
- visible hover/focus affordance;
- accessible label;
- no nested invalid interactive controls.

Не превращать все cards в ссылки, если destination отсутствует.

---

# 4. R4-03 — PARTNER COMMISSION POLICY VISIBILITY — P1

## Evidence from Round 3

Round 3 подтвердил:

```text
18 partners
commission rates 5%–15%
per-partner from seed
```

Следовательно, commission policy действительно различается между Partner.

Требование больше не является speculative.

## Objective

В Platform Partner management пользователь должен видеть текущую commission policy/rate Partner.

Не смешивать:

```text
commission policy/rate
```

с:

```text
accrued commission amount
```

## Required repository verification

Перед UI change подтвердить:

- точный canonical field/source;
- default rate;
- per-partner override;
- service-specific rule;
- effective date;
- history;
- transaction snapshot;
- null/default behavior.

## Table behavior

Если у Partner одна effective rate:

```text
Комиссия
10%
```

Если policy complex/service-specific:

```text
Комиссия
Индивидуальная
```

или другой точный UI representation с drill-down/details.

Не выводить фиктивный single percent, если у Partner несколько rates.

## Where to show

Минимум определить и реализовать там, где существует основной Platform registry Partner.

Если есть Partner detail page/card — показать commission policy и там.

Не дублировать одну и ту же бизнес-настройку в несогласованных местах.

## History / edit safety

Если rate editable:

- не переписывать исторические transactions;
- old orders/payments/commission facts должны сохранять applied rate/policy snapshot либо canonical equivalent;
- изменение current policy действует только по defined effective-date semantics.

Если history/snapshot architecture недостаточна — оформить Architecture Gap и не делать опасный editable UI.

## Access control

Просмотр/изменение commercial terms должен быть server-authoritative и permission-gated.

Если edit permission ещё не определён, в этом Round допустим read-only display.

Не расширять scope Step 3.12.

---

# 5. R4-04 — PERIOD-CHAIN CONTROL VERIFICATION — P1 CONTROL

Round 3 сообщил:

```text
R3-01 Period chain correct
6 presets: SUM(buckets) = headline Orders
```

Но `SUM(buckets) = Orders` недостаточно для доказательства actual time-range boundaries.

В этом Round нужен короткий control proof.

## Mandatory evidence

Для минимум:

```text
3 дня
Месяц
Год
CUSTOM valid range
```

вывести:

| Preset | Request from | Request to | Backend from | Backend to | First bucket | Last bucket | Granularity |
|---|---|---|---|---|---|---|---|

Доказать:

```text
PeriodSelector
→ request
→ backend interpreted range
→ generated buckets
→ first/last bucket
→ rendered X-axis
```

Granularity:

```text
HOUR / DAY / WEEK / MONTH
```

не должна изменять выбранный range.

Это control verification, а не повод переписывать working period engine без finding.

---

# 6. OUT OF SCOPE

В этом Round не реализовывать:

```text
RG2 Multi-Currency / FX Architecture
RG4 Behavioral Telemetry / Customer Journey Architecture
Step 3.12 Users & Access
new Finance Ledger subsystem
large Partner commercial-contract redesign
```

Но не скрывать подтверждённые gaps.

---

# 7. TESTS — MANDATORY

Запустить:

```text
Frontend tests
Frontend TSC
Frontend build
Backend relevant tests
Backend TSC
```

Добавить targeted tests минимум для:

### CUSTOM Period

```text
CUSTOM empty → no request
start only → no request
end only → no request
valid both → one request
start > end → localized validation
clear date → no invalid request
CUSTOM → preset → valid preset request
```

### KPI drill-down

```text
route/filter preservation
period preservation
permission/scope enforcement
keyboard interaction
```

### Partner Commission

```text
single rate display
complex/default/null behavior
permission-safe rendering
```

Passing tests не заменяют browser evidence.

---

# 8. BROWSER MATRIX — MANDATORY

## Analytics

- CUSTOM selected / no dates;
- start only;
- end only;
- valid range;
- invalid reversed range;
- switch back to preset;
- click Orders KPI;
- click Bookings KPI;
- click Customers/Partners KPI;
- click Payments/Refunds/Commission if destination exists;
- verify drill-down period/filter preservation.

## Command Center

Повторить CUSTOM lifecycle scenarios.

Убедиться:

```text
0 duplicate error banners
0 request with undefined dates
```

## Partners

Проверить commission policy/rate visibility минимум для нескольких Partner с разными rates.

Показать минимум:

```text
Partner A = 5%
Partner B != Partner A
Partner C != Partner B
```

если такие фактически существуют.

---

# 9. API / NETWORK EVIDENCE

Для CUSTOM:

Browser network log должен доказать:

```text
CUSTOM incomplete:
NO analytics request with startDate=undefined
NO command-center request with missing custom dates

CUSTOM valid:
exactly expected request
valid YYYY-MM-DD params
```

Для KPI drill-down:

показать destination route/query/filter state.

Для Partner commission:

показать canonical API/source field.

---

# 10. REQUIRED REPORT

Создать отчёт преимущественно на русском языке.

Структура:

1. Executive Summary
2. Starting SHA
3. Final SHA
4. R4-01 Shared CUSTOM Period
5. R4-02 KPI Drill-down / Source Traceability
6. R4-03 Partner Commission Policy Visibility
7. R4-04 Period Chain Control
8. Security / Scope Verification
9. Tests
10. Browser Matrix
11. Network Evidence
12. Residual Gaps
13. Canonical Roadmap Impact
14. Final Verdict
15. Exact NEXT

---

# 11. VERDICT RULES

## VERDICT A

Допустим только если:

- Analytics CUSTOM больше не вызывает request/error до заполнения обеих дат;
- Command Center CUSTOM ведёт себя так же;
- duplicate error banners отсутствуют;
- valid CUSTOM range работает;
- invalid reversed range валидируется корректно;
- KPI drill-down реализован только к authoritative destinations;
- period/filter/scope сохраняются;
- Partner commission policy отображается из canonical source;
- period-chain control доказан;
- browser/network evidence приложены;
- tests PASS.

## VERDICT B

Обязателен, если:

- хоть один shared PeriodSelector consumer продолжает отправлять invalid request;
- UI по-прежнему показывает backend error при незаполненном CUSTOM;
- KPI click ведёт на нерелевантный/нефильтрованный source;
- drill-down ломает RBAC/workspace scope;
- Partner commission отображается не из canonical source;
- single rate показывается там, где policy complex;
- historical commission semantics могут быть переписаны current rate;
- period boundaries не доказаны;
- runtime contradicts report.

---

# 12. CANONICAL NEXT

Если Round 4 закрыт:

```text
Canonical NEXT:
MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
```

Не начинать автоматически.

После FX Architecture Amendment отдельно вернуться к:

```text
Behavioral Telemetry / Customer Journey Architecture Amendment
```

если canonical roadmap не определит другой dependency order.

---

# 13. HARD STOP

```text
DO NOT AUTO-START STEP 3.12
DO NOT AUTO-START FX IMPLEMENTATION
```

Сначала предоставить Round 4 report и verdict.

---

# FINAL ACCEPTANCE CHECKLIST

- [ ] Analytics CUSTOM empty → no request/no error
- [ ] Command Center CUSTOM empty → no request/no error
- [ ] only startDate → no invalid request
- [ ] only endDate → no invalid request
- [ ] startDate > endDate → one localized validation
- [ ] same date supported or explicitly rejected by canonical contract
- [ ] valid CUSTOM → correct request
- [ ] clear date → no malformed request
- [ ] switch CUSTOM → preset works
- [ ] no duplicate error banners
- [ ] no `undefined` date reaches backend
- [ ] KPI Orders clickable with same period/scope
- [ ] KPI Bookings clickable with same period/scope
- [ ] Customers/Partners drill-down mapped correctly
- [ ] Payments/Refunds/Commission drill-down mapped if authoritative UI exists
- [ ] derived KPI drill-down explains formula
- [ ] drill-down server-side authorization verified
- [ ] keyboard accessibility verified
- [ ] all 18 Partner commission policies sourced from canonical data
- [ ] Partner registry shows current commission policy/rate
- [ ] complex policy not flattened falsely
- [ ] history/snapshot safety checked
- [ ] 3D first/last bucket proven
- [ ] Month first/last bucket proven
- [ ] Year first/last bucket proven
- [ ] CUSTOM first/last bucket proven
- [ ] tests PASS
- [ ] browser matrix PASS
- [ ] network evidence proves no malformed CUSTOM request
- [ ] report predominantly Russian
- [ ] RG2 and RG4 remain explicitly classified
- [ ] Step 3.12 not started
