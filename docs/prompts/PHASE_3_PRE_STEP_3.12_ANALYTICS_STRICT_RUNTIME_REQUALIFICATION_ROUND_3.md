# PHASE 3 — PRE-STEP 3.12 — ANALYTICS STRICT RUNTIME RE-QUALIFICATION & RESIDUAL REMEDIATION — ROUND 3

## STATUS

**Starting baseline:** `3eeb3ee`

Предыдущий этап:

```text
PHASE 3 — PRE-STEP 3.12
ANALYTICS TARGETED RUNTIME REMEDIATION — ROUND 2 V5
```

Developer report заявил:

```text
Final SHA:     3eeb3ee
origin/master: 3eeb3ee
VERDICT A
```

Однако после этого реальная browser/runtime проверка выявила незакрытые либо недостаточно доказанные проблемы.

**Предыдущий VERDICT A не является основанием считать Analytics PRE-STEP окончательно закрытым.**

В этом Round runtime/browser evidence имеет приоритет над self-reported completion.

**Step 3.12 — Users & Access Completion НЕ НАЧИНАТЬ.**

---

## LANGUAGE REQUIREMENT — MANDATORY

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

Провести строгую runtime re-qualification Analytics от SHA `3eeb3ee`, устранить подтверждённые defects в пределах существующей архитектуры и доказать source → API → browser correctness.

Основные reopened/new findings:

```text
R3-01  Period Selector ↔ Orders Time-Series Range
R3-02  Orders chart visual/bar contract
R3-03  Commission headline/source reconciliation
R3-04  Behavioral telemetry / Activity by stages
R3-05  Partner commission policy inventory
R3-06  Financial Journal semantics: "Записей в журнале: 0"
R3-07  Financial Summary i18n: CURRENCY
R3-08  Partner Performance pagination residual
R3-09  Multi-currency / FX blocking architecture gap
R3-10  V5 regression verification
```

Не ограничиваться визуальным исправлением симптомов.

---

# 2. R3-01 — PERIOD SELECTOR ↔ ORDERS TIME-SERIES RANGE — P1 — REOPENED

## Runtime observation

После V5 period mismatch всё ещё вызывает сомнение.

При выборе:

```text
Год
```

график `Динамика — Заказы` показывает ось приблизительно:

```text
2026-W01 ... 2026-W51
```

Необходимо доказать, что это **точно тот же selected `from/to` range**, а не фиксированный calendar-year series или независимо вычисленный range.

Предыдущего доказательства:

```text
SUM(buckets) = headline Orders
```

недостаточно.

Одинаковая сумма не доказывает одинаковые временные границы.

## Mandatory period matrix

Проверить минимум:

```text
3 дня
Месяц
Год
```

и дополнительно все presets, реально поддерживаемые shared PeriodSelector.

Для каждого периода вывести:

| Preset | UI from | UI to | Request from | Request to | Backend interpreted from | Backend interpreted to | First bucket | Last bucket | Granularity |
|---|---|---|---|---|---|---|---|---|---|

Должно быть доказано:

```text
PeriodSelector
→ request params
→ backend range
→ bucket generation
→ API first/last bucket
→ rendered X-axis
```

## Acceptance

- график не использует независимый/fixed calendar range;
- first/last bucket соответствуют выбранному period;
- timezone semantics едины;
- granularity не изменяет period;
- `SUM(order buckets)` reconciles с headline Orders только если metrics имеют одинаковую semantics;
- browser screenshots показывают фактические first/last labels.

---

# 3. R3-02 — ORDERS BAR CHART VISUAL CONTRACT — P1 — REOPENED

## Runtime observation

V5 заявил:

```text
RT2/RT3 fixed:
height 200px + Y-axis labels + gridlines
```

Но на runtime screenshots `Динамика — Заказы` всё ещё выглядит как почти горизонтальная синяя линия с микроскопическими сегментами у baseline.

**Да — это отдельный reopened finding и его обязательно учитывать.**

Добавление Y-axis/gridlines само по себе не означает, что требуемый bar chart реализован корректно.

## Required

Если canonical visualization = bar chart, должны быть реальные proportional bars:

- каждый bucket визуально представлен bar/column;
- высота пропорциональна bucket value;
- baseline Y=0 для count metric;
- Y-axis читаем;
- X-axis читаем;
- tooltip показывает bucket + exact count;
- non-zero bucket визуально отличим от zero bucket;
- bars не превращаются в 1–2 px horizontal baseline;
- responsive layout;
- long periods используют разумную ширину/spacing;
- labels могут thinning/skip, но data buckets не выбрасываются;
- zero state отличается от populated series.

## Mandatory browser proof

Для `3 дня`, `Месяц`, `Год`:

- screenshot всего chart;
- screenshot/tooltip минимум одного non-zero bucket;
- API bucket value для него;
- визуальная bar height должна соответствовать scale;
- подтвердить, что график не является line/area visualization, замаскированной под bars.

Если используется custom CSS renderer — проверить actual DOM/CSS dimensions bars.

---

# 4. R3-03 — COMMISSION HEADLINE / SOURCE RECONCILIATION — P1 — RT11 REOPENED

## Runtime observation

Для периода `Год` UI показывает:

```text
GMV (выполненные)    99 996,00 AZN
Платежи клиентов     74 737,30 AZN
Чистые платежи       69 147,64 AZN
Комиссия              6 701,92 AZN
```

Derived ratios:

```text
Commission / Payments     ≈ 8.97%
Commission / Net Payments ≈ 9.69%
Commission / GMV          ≈ 6.70%
```

Эти ratios сами по себе не являются defect, если commission policies различаются.

V5 сообщил:

```text
Commission = per-transaction canonical source
```

Но этого недостаточно для доказательства конкретного headline total `6 701,92 AZN`.

## Required reconciliation

Для выбранного периода `Год` доказать:

```text
eligible canonical commission facts
→ Partner
→ Order/Payment/commercial source
→ native currency
→ applied rule/rate
→ commission amount
→ status eligibility
→ period eligibility
→ adjustments/reversals
→ SUM
→ Analytics API
→ headline KPI
```

Отчёт должен показать, является ли:

```text
6 701,92 AZN
```

- полной Platform Commission за выбранный период;
- только AZN native subset;
- converted reporting total;
- другой projection.

Если реальные EUR/USD commissions существуют, а FX architecture отсутствует, AZN-only value нельзя представлять как полный consolidated Platform total.

## Refund/reversal

Повторно подтвердить effect:

- partial refund;
- full refund;
- reversal;
- commission adjustment;
- refund in later period.

Не использовать произвольный fixed percentage.

---

# 5. R3-04 — ACTIVITY BY STAGES / BEHAVIORAL TELEMETRY — P1 — RT12 REOPENED

## Runtime observations

Три browser periods:

| Stage | 3 дня | Месяц | Год |
|---|---:|---:|---:|
| Показ предложения | 126 | 996 | 996 |
| Просмотр предложения | 0 | 9 | 9 |
| Начало оформления | 0 | 0 | 0 |
| Заказ создан | 16 | 214 | 1516 |
| Оплата выполнена | 5 | 137 | 758 |
| Бронирование подтверждено | 2 | 29 | 155 |
| Бронирование завершено | 3 | 73 | 410 |

Headline:

| Metric | 3 дня | Месяц | Год |
|---|---:|---:|---:|
| Orders | 16 | 214 | 1516 |
| Bookings | 6 | 122 | 692 |

## Initial observations

### Order Created

```text
16 = headline Orders
214 = headline Orders
1516 = headline Orders
```

Это хороший reconciliation signal, но всё равно доказать source semantics.

### Product Impression

```text
3 дня  = 126
Месяц  = 996
Год     = 996
```

Если `Месяц = Год`, все зарегистрированные yearly impressions находятся в текущем месяце.

V5 утверждает sparse telemetry / events only Aug 2026. Это нужно доказать source timestamps.

### Product Viewed

```text
0 → 9 → 9
```

Все yearly views также оказываются в текущем месяце.

Дополнительно:

```text
9 / 996 ≈ 0.90%
```

Не объявлять это ошибкой по одному ratio, но проверить emission semantics.

### Checkout Started

```text
0 → 0 → 0
```

при:

```text
Orders = 16 → 214 → 1516
```

Это сильный telemetry-gap signal.

### Booking Completed > Booking Confirmed

```text
3 дня:   3 > 2
Месяц:  73 > 29
Год:    410 > 155
```

Для independent event counters это может быть корректно, если события попадают в period по собственному event timestamp.

Не навязывать funnel invariant `Completed <= Confirmed`, пока блок остаётся `Активность по этапам`.

## Mandatory source evidence

Для каждого event type:

```text
PRODUCT_IMPRESSION
PRODUCT_VIEWED
CHECKOUT_STARTED
ORDER_CREATED
PAYMENT_SUCCEEDED
BOOKING_CONFIRMED
BOOKING_COMPLETED
SESSION / equivalent
```

дать:

| Event | Total source count | MIN timestamp | MAX timestamp | 3D count | Month count | Year count | Source/model | API field |
|---|---:|---|---|---:|---:|---:|---|---|

## Mandatory root-cause classification

Особенно для `CHECKOUT_STARTED = 0`:

```text
EVENT_NOT_EMITTED
EVENT_NOT_PERSISTED
EVENT_NOT_AGGREGATED
PERIOD_FILTER_BUG
WORKSPACE/SCOPE_BUG
EVENT_MAPPING_BUG
TRUE_ZERO
OTHER
```

с evidence.

## Real browser event trace

Для реально поддерживаемых behavioral events:

```text
BEFORE
→ customer-facing action
→ emitted event
→ persisted source
→ Analytics API
→ AFTER
```

Проверить минимум:

- listing/offering impression;
- product/offering open;
- checkout start.

Не создавать synthetic historical events из Orders.

Если checkout telemetry архитектурно отсутствует — оформить подтверждённый Telemetry Architecture Gap, а не fake fix.

---

# 6. R3-05 — ALL PARTNERS COMMISSION POLICY INVENTORY — P1

До добавления commission-rate column в Partner tables необходимо доказать фактическую текущую модель.

## Required repository/domain audit

Определить, где хранится commission policy:

```text
Partner?
PartnerStorefront?
CommercialAgreement?
CommissionPolicy?
CommissionAccrual?
Order snapshot?
Payment snapshot?
другая model?
```

Проверить:

- global/default Platform rate;
- Partner override;
- service/capability-specific rate;
- category-specific rate;
- agreement-specific rate;
- effective date;
- history;
- transaction-level snapshot.

## Mandatory ALL-partner inventory

Не representative sample. Вывести **всех существующих Partner** в runtime DB.

| Partner | Commission source | Default rate | Override | Service-specific | Effective rate/policy | Valid from | History? | Transaction snapshot? |
|---|---|---:|---:|---|---|---|---|---|

Ответить явно:

```text
У всех Partner одна ставка? YES/NO
Есть индивидуальные ставки? YES/NO
Есть service-specific ставки? YES/NO
Есть Platform default? YES/NO
Есть history/effective dating? YES/NO
Исторические transactions сохраняют applied rate/policy snapshot? YES/NO
```

## UI architecture decision

После inventory дать recommendation для будущих Partner tables:

Если одна effective rate:

```text
Комиссия | 10%
```

Если complex policy:

```text
Комиссия | Индивидуальная
```

или другой точный representation с details drill-down.

Различать:

```text
commission policy/rate
```

и:

```text
accrued commission amount
```

В Partner Performance эти две вещи нельзя смешивать.

**Не реализовывать широкую Partner-management redesign в этом Round без необходимости.**
Сначала доказать модель и зафиксировать решение.

---

# 7. R3-06 — FINANCIAL JOURNAL SEMANTICS / "ЗАПИСЕЙ В ЖУРНАЛЕ: 0" — P1

## Runtime observation

Под `Финансовая сводка` отображается:

```text
Записей в журнале: 0
```

при ненулевых:

- Payments;
- Refunds;
- Net;
- Commission;
- AZN/EUR/USD financial activity.

## Required

Определить, что означает `журнал`:

- financial ledger?
- audit journal?
- reconciliation journal?
- payment history?
- adjustment journal?
- другое?

Найти canonical source/model/query.

Доказать:

```text
Payment должен создавать journal entry? YES/NO
Refund должен создавать journal entry? YES/NO
Commission должен создавать journal entry? YES/NO
Manual adjustment должен создавать entry? YES/NO
```

И:

```text
source journal count
→ API
→ UI "Записей в журнале"
```

Если `0` корректен, UI label/description должен однозначно объяснять пользователю, что считается.

Если entries должны существовать — найти root cause.

**Не создавать fake journal records ради ненулевого значения.**

---

# 8. R3-07 — FINANCIAL SUMMARY I18N

В русской локали:

```text
CURRENCY
```

должно отображаться как:

```text
Валюта
```

ISO codes:

```text
AZN
EUR
USD
```

не переводить.

Использовать i18n, не hardcode.

Проверить все реально поддерживаемые locales.

---

# 9. R3-08 — PARTNER PERFORMANCE PAGINATION — RESIDUAL

V5 оставил:

```text
RT9 Client-side pagination retained (deferred)
```

Это не соответствует общему full-table contract:

```text
DEFAULT_PAGE_SIZE = 20
records <= 20 → one page
records > 20  → pagination mandatory
```

Для полного registry/data endpoint при `>20` records требуется server-side pagination, если endpoint является full-list dataset.

## Required

Проверить endpoint semantics.

Если это full Partner Performance registry:

```text
filter/search/sort
→ server-side query
→ aggregation
→ pagination
```

Response concept:

```text
data
page
pageSize
total
totalPages
```

Не:

```text
fetch all 27
→ slice in browser
```

Если есть архитектурно обоснованная причина оставить client-side pagination — документировать и доказать, почему таблица является bounded summary dataset, а не full registry.

---

# 10. R3-09 — MULTI-CURRENCY / FX — CONFIRMED BLOCKING GAP

V5 подтвердил:

```text
RT10 FX architecture: CONFIRMED BLOCKING GAP
```

Не закрывать этот finding словом `deferred`, если он влияет на корректность headline monetary KPI.

## Required in this Round

Не внедрять ad-hoc current-rate conversion.

Подготовить точную architecture boundary для отдельного:

```text
MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
```

Минимум определить необходимые решения:

- Platform reporting currency = AZN — подтвердить;
- original/native amount and currency;
- historical FX rate/source;
- effective timestamp;
- snapshot/reproducibility;
- rounding/precision;
- Payment treatment;
- Refund treatment;
- Commission treatment;
- GMV treatment;
- AOV treatment;
- reporting amount;
- native Financial Summary preservation.

## Hard invariant

Запрещено:

```text
current USD/AZN × all historical USD
current EUR/AZN × all historical EUR
```

если это меняет прошлые Analytics totals при изменении текущего курса.

Если FX architecture отсутствует, consolidated multi-currency Analytics **не может считаться полностью re-qualified**.

---

# 11. R3-10 — V5 REGRESSION VERIFICATION

Повторно проверить исправления V5:

```text
RT2/RT3 chart
RT4 duplicate Completed GMV removed
RT7 Commission currency
RT13 Completion formula
RT12 i18n stage labels
RT13 Completion i18n
```

## Completion

Проверить после fix:

```text
completedBookings / totalBookings
```

для concrete Partners, включая минимум:

```text
Rashad Gasimov
Regional Transport AZ
Nigar Hasanova
Elvin Mammadov
Flame Country Excursions
```

Для каждой строки показать:

```text
totalBookings
completedBookings
raw ratio
API value
UI value
```

Особенно подтвердить, что ранее проблемный case:

```text
Bookings = 7
Completion = 50%
```

либо получил математически согласованное значение, либо имеет доказанную другую semantics.

Defensive cap не должен скрывать formula bug.

---

# 12. REQUIRED BROWSER MATRIX

Минимум ADMIN runtime:

| Area | 3 дня | Месяц | Год |
|---|---|---|---|
| Headline KPI | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| Activity stages | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| Orders time-series range | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| Orders bars visually proportional | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| Partner Performance | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| Financial Summary | PASS/FAIL | PASS/FAIL | PASS/FAIL |

Для chart обязательно screenshots + API evidence.

Для telemetry — source timestamps/counts.

Для commission — source reconciliation.

---

# 13. TESTS

Запустить релевантные:

```text
Frontend tests
Frontend TSC
Frontend build
Backend Analytics tests
Backend TSC
```

Плюс targeted deterministic tests для изменённых defects.

Не использовать passing tests как замену runtime evidence.

---

# 14. GAP REGISTER — MANDATORY

Итоговый отчёт должен классифицировать каждый remaining issue:

```text
UI GAP
DOMAIN GAP
SECURITY-GOVERNANCE GAP
ARCHITECTURE GAP
ROADMAP GAP
DEFERRED
BLOCKING
```

Минимум отдельно:

```text
FX/reporting currency
behavioral telemetry, если pipeline отсутствует
Partner commission policy/history, если model недостаточна
server-side Partner Performance pagination
financial journal semantics
```

---

# 15. CANONICAL ROADMAP

Canonical roadmap:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Обновлять только additive и только если результаты этого Round требуют architecture/roadmap amendment.

Сохранять историю.

Не использовать fake SHA.

Не менять NEXT на Step 3.12, пока blocking Analytics dependencies не классифицированы и не определён точный следующий architecture/remediation stage.

---

# 16. REQUIRED REPORT

Создать отчёт преимущественно на русском языке.

Структура:

1. Executive Summary
2. Starting SHA / Final SHA / origin
3. R3-01 Period Reconciliation
4. R3-02 Orders Bar Chart Evidence
5. R3-03 Commission Reconciliation
6. R3-04 Behavioral Telemetry Evidence
7. R3-05 All Partners Commission Policy Inventory
8. R3-06 Financial Journal Semantics
9. R3-07 i18n
10. R3-08 Pagination
11. R3-09 FX Architecture Boundary
12. R3-10 V5 Regression Verification
13. Source → API → UI Evidence
14. Browser Matrix
15. Tests
16. Gap Register
17. Canonical Roadmap Impact
18. Final Verdict
19. Exact NEXT

---

# 17. VERDICT RULES

## VERDICT A допустим для этого Round только если

Все defects, которые могут быть исправлены в пределах существующей архитектуры, реально исправлены и доказаны.

При этом нельзя формулировать:

```text
ANALYTICS PRE-STEP FULLY CLOSED
```

если остаётся подтверждённый blocking FX architecture gap, влияющий на monetary totals.

## VERDICT B

Обязателен, если:

- period selector и rendered time-series range расходятся;
- bar chart остаётся визуально baseline/line вместо proportional bars;
- Commission headline нельзя reconciliate;
- behavioral counters не имеют доказуемой semantics/source;
- `Checkout Started = 0` объяснён только предположением;
- Completion снова не reconciles;
- journal count semantics остаётся неизвестной;
- runtime evidence противоречит отчёту;
- blocking dependency скрыта под `deferred`.

---

# 18. HARD STOP

После этого Round:

```text
DO NOT AUTO-START STEP 3.12
```

Сначала представить отчёт и verdict.

Если FX architecture остаётся blocking gap, предложить точный следующий:

```text
MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
```

либо consolidated remediation, если одновременно останутся другие P1 defects.

---

# FINAL ACCEPTANCE CHECKLIST

- [ ] selected period = actual Orders chart range
- [ ] first/last time-series buckets доказаны
- [ ] Orders chart — реальные proportional bars
- [ ] Y-axis начинается с 0 для count metric
- [ ] non-zero bars визуально различимы
- [ ] tooltip reconciles с API bucket
- [ ] Commission `6 701,92 AZN` либо актуальное runtime значение reconciled до source
- [ ] доказано, является ли Commission consolidated или AZN-only
- [ ] все Partner commission policies/rates inventoried
- [ ] default/override/service-specific commission определены
- [ ] commission history/snapshot capability проверена
- [ ] Product Impression counts reconciled
- [ ] Product Viewed counts reconciled
- [ ] Checkout Started zero root cause доказан
- [ ] Sessions semantics/source доказаны
- [ ] telemetry MIN/MAX timestamps представлены
- [ ] browser event trace выполнен
- [ ] Order Created reconciles с Orders KPI
- [ ] Payment Succeeded source semantics доказана
- [ ] Booking Confirmed/Completed event semantics доказана
- [ ] Completion formula runtime-reconciled
- [ ] `CURRENCY` → `Валюта`
- [ ] `Записей в журнале: 0` semantics доказана
- [ ] Partner Performance pagination классифицирована/исправлена
- [ ] FX gap оформлен как blocking architecture dependency, если остаётся
- [ ] никакой ad-hoc historical FX conversion
- [ ] tests PASS
- [ ] browser matrix PASS для реально закрываемых findings
- [ ] отчёт преимущественно на русском
- [ ] Step 3.12 не запущен автоматически
