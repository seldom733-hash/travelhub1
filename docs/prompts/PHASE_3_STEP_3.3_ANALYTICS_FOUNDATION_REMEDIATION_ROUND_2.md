# TRAVELHUB — PHASE 3 — STEP 3.3 ANALYTICS FOUNDATION — REMEDIATION ROUND 2

> **ОБЯЗАТЕЛЬНЫЙ ЯЗЫК ОТВЕТОВ**
>
> Все ответы разработчика пользователю, промежуточные статусы, пояснения, выводы и итоговый summary должны быть **на русском языке**.
>
> Английский допускается только для кода, команд, путей, API routes, enum/permission names, идентификаторов и канонических технических статусов.

---

# 1. ЦЕЛЬ ПРОХОДА

Выполнить **узкий, целевой Remediation Round 2** для:

`PHASE 3 — STEP 3.3 — ANALYTICS FOUNDATION`

после:

`STRICT RE-REVIEW — VERDICT B — REMEDIATION INCOMPLETE — FURTHER REMEDIATION REQUIRED`

Текущее состояние:

- Step 3.3 Design: COMPLETED
- Design Addendum: COMPLETED
- Initial Implementation: COMPLETED
- Initial Strict Review: VERDICT B
- Remediation Round 1: COMPLETED
- Strict Re-Review: VERDICT B
- Step 3.3: **NOT APPROVED**
- Step 2.17B: **BLOCKED — EXTERNAL QUALIFICATION ENVIRONMENT / unchanged**
- Phase 2 exit: BLOCKED / unchanged

Этот pass НЕ является новым расширением Analytics Foundation.

Hard scope:

**ровно 3 подтверждённых remaining findings + repo-wide money/timestamp sweep + полный regression contract.**

Не добавлять новые функции аналитики.

---

# 2. BASELINE — ПРОВЕРИТЬ REPOSITORY-FIRST

Перед изменениями:

1. проверить `git status`;
2. проверить branch;
3. проверить HEAD;
4. проверить upstream;
5. прочитать последний Strict Re-Review report:
   `docs/prompts/PHASE_3_STEP_3.3_ANALYTICS_FOUNDATION_STRICT_RE_REVIEW_REPORT.md`;
6. проверить Roadmap;
7. проверить фактический analytics code;
8. подтвердить каждый из трёх findings в коде до исправления.

Не доверять summary без repository evidence.

---

# 3. REMAINING FINDINGS

Strict Re-Review оставил:

## HIGH-1 / HIGH-NEW-2

Time Series metric `payments` использует:

`Payment.createdAt`

вместо canonical lifecycle timestamp:

`Payment.paidAt`.

## HIGH-2 / HIGH-NEW-1

Partner Performance merge использует:

`parseFloat()`

для accumulation monetary values.

Это оставляет JS floating-point arithmetic в Analytics money path.

## MEDIUM-NEW-1

Financial Reconciliation Summary возвращает/ориентируется только на:

`primaryCurrency`

и поэтому multi-currency reconciliation не полностью соответствует уже принятому currency-separated contract.

В этом Round 2 считать третий finding **обязательным**, а не optional.

---

# 4. FINDING 1 — TIME SERIES PAYMENTS TIMESTAMP

Найти фактическую реализацию Time Series `payments`.

Исправить period filtering:

`createdAt` → `paidAt`

только там, где metric действительно означает canonical paid payments.

Не выполнять слепую глобальную замену.

---

# 5. AUTHORITATIVE TIMESTAMP SWEEP

После точечного исправления выполнить repo-wide sweep Analytics module по lifecycle timestamps.

Проверить как минимум:

- Revenue;
- payment count / paid payments;
- Time Series payments;
- refunds;
- booking confirmation;
- booking completion;
- cancellation;
- commission/accrual;
- GMV;
- orders/sales, где применимо.

Создать таблицу:

| Metric | Source | Timestamp used | Canonical timestamp | Verdict |
|---|---|---|---|---|

Цель — доказать, что аналогичный `createdAt` defect не остался в соседней analytics query.

Не менять timestamps без canonical evidence.

---

# 6. TIMESTAMP ADVERSARIAL TEST — HARD GATE

Добавить/обновить test:

- Payment `createdAt` находится в периоде A;
- тот же Payment `paidAt` находится в периоде B.

Для Time Series `payments`:

- period A → payment НЕ учитывается;
- period B → payment учитывается.

Также проверить:

- `paidAt == startInstant` → INCLUDED;
- `paidAt == endExclusiveInstant` → EXCLUDED.

Если unpaid payment имеет `paidAt = null`, он не должен попадать в paid-payment metric.

---

# 7. FINDING 2 — PARTNER PERFORMANCE FLOAT MONEY

Найти Partner Performance merge/aggregation, где используется:

`parseFloat()`

или repository-equivalent JS float conversion над money.

Удалить floating-point accumulation.

---

# 8. EXACT MONEY CONTRACT

Использовать тот же доказанный exact money approach, который применяется в исправленной Analytics Foundation, например canonical helper:

`sumDecimalString()`

или его repository-equivalent.

Не создавать второй несовместимый money helper без необходимости.

Hard invariant:

`MONETARY AGGREGATION MUST NOT USE JS FLOAT`

---

# 9. MONEY REPO-WIDE SWEEP — HARD GATE

После исправления выполнить repo-wide поиск внутри Analytics Foundation на:

- `parseFloat(`
- `Number(`
- `.toNumber()`
- unary `+`
- `Math.round`
- `Math.floor`
- `Math.ceil`
- numeric `reduce`
- implicit coercion

для monetary values.

Важно:

`Number()` для count/time/index не является автоматически дефектом.

Каждый occurrence классифицировать:

- monetary — forbidden unless proven safe/non-arithmetic;
- non-monetary — acceptable.

В отчёте привести результаты sweep.

---

# 10. INTEGER-CENT / DECIMAL SAFETY

Если текущая реализация использует integer-cent arithmetic, повторно проверить:

- conversion не идёт через float;
- canonical schema scale совместим;
- rounding deterministic;
- integer range безопасен;
- serialization exact.

Не менять рабочий exact approach без причины.

Если обнаружится, что integer-cent implementation сама нарушает canonical Decimal authority — HARD STOP и сообщить finding, а не маскировать его.

---

# 11. MONEY ADVERSARIAL TEST

Обязательно проверить Partner Performance accumulation на значениях, выявляющих float corruption.

Например:

- 0.10
- 0.20
- 0.30
- 10.01

и repository-appropriate larger values.

Доказать exact:

- revenue;
- commission;
- GMV, если входит в merge;
- AOV, если использует тот же aggregation path.

Никаких float artifacts.

---

# 12. FINDING 3 — FINANCIAL RECONCILIATION MULTI-CURRENCY

Текущая Financial Reconciliation Summary не должна ограничивать reconciliation одной `primaryCurrency`, если выбранный период содержит несколько валют.

Исправить read model на **currency-separated reconciliation**.

---

# 13. MULTI-CURRENCY CONTRACT

При отсутствии canonical FX authority:

- USD reconciliation отдельно;
- EUR reconciliation отдельно;
- AZN reconciliation отдельно;
- другие валюты аналогично.

Нельзя:

- складывать разные валюты;
- конвертировать их без FX authority;
- показывать первую валюту как итог всего периода;
- терять остальные валюты.

---

# 14. PRIMARY CURRENCY

Repository-first определить, нужен ли вообще `primaryCurrency` в response contract.

Если canonical authority для company reporting currency отсутствует:

- не объявлять первую найденную валюту canonical primary;
- не использовать её для общего reconciliation verdict/amount;
- не зависеть от nondeterministic query ordering.

Если поле сохраняется ради backward compatibility, его смысл должен быть явно безопасным и не искажать multi-currency данные.

Если безопасного canonical смысла нет — убрать/заменить в рамках существующего API contract с тестами и документацией.

Не изобретать company reporting currency.

---

# 15. FINANCIAL RECONCILIATION RESPONSE

Response должен позволять однозначно увидеть reconciliation по каждой валюте.

Conceptual shape допустим только как ориентир:

```text
currencies:
  - currency: USD
    ...
  - currency: EUR
    ...
```

Не копировать этот shape механически, если repository API conventions требуют другой DTO.

Использовать canonical style проекта.

---

# 16. FINANCIAL RECONCILIATION AUTHORITY

Сохранить Step 2.18A authority.

Analytics reconciliation остаётся:

`READ ONLY`

Никаких:

- Payment writes;
- Ledger writes;
- Commission writes;
- Accrual writes;
- repair;
- replay;
- regeneration frozen monetary facts.

---

# 17. MULTI-CURRENCY ADVERSARIAL TEST

Создать scenario минимум с двумя валютами.

Проверить:

- обе валюты присутствуют;
- reconciliation amounts разделены;
- mismatches разделены;
- totals не смешиваются;
- deterministic ordering;
- period filtering применяется одинаково;
- никакая валюта не исчезает из-за `primaryCurrency`.

---

# 18. SCOPE CONTROL — НЕ РАСШИРЯТЬ

В этом pass НЕ реализовывать:

- Dashboard;
- Employee Analytics;
- новые KPI;
- новые dimensions;
- новые actor models;
- новые financial policies;
- FX;
- company timezone;
- team/department;
- historical roles;
- RLS redesign;
- PSP;
- Step 3.1;
- другие Phase 3 steps.

Если обнаружен новый unrelated defect — документировать отдельно.

Исправлять только если он непосредственно блокирует доказательство трёх findings или regression.

---

# 19. PRESERVE CLOSED FINDINGS

Не допустить регрессии уже закрытых findings:

- canonical `analytics.read`;
- Financial Reconciliation endpoint;
- Partner IDOR;
- Actor Attribution foundation;
- real Partner Performance metrics;
- AOV;
- funnel dedup;
- analytics e2e;
- multi-currency Company/Partner analytics;
- period/comparison/granularity foundation.

---

# 20. RBAC / IDOR SMOKE

Хотя RBAC/IDOR уже закрыты, выполнить focused smoke/regression:

- authorized analytics request → allowed;
- unauthorized → denied;
- Partner A → Partner B → denied/scoped;
- BUYER → denied.

Не перепроектировать RBAC.

---

# 21. ANALYTICS FOCUSED TESTS

Обязательные focused tests Round 2:

1. Time Series payments uses `paidAt`;
2. createdAt/paidAt cross-period;
3. half-open paidAt boundaries;
4. unpaid payment excluded;
5. Partner money merge exact;
6. no float corruption;
7. Financial Reconciliation 2 currencies;
8. no fake combined currency total;
9. deterministic currency response;
10. read-only reconciliation;
11. RBAC smoke;
12. Partner IDOR smoke.

---

# 22. ANALYTICS E2E

Запустить существующую analytics e2e suite полностью.

Если новые Round 2 scenarios требуют e2e — добавить их.

Не заменять e2e service unit tests.

Сообщить:

- suites;
- tests;
- PASS/FAIL;
- skipped.

---

# 23. FULL BACKEND REGRESSION — HARD GATE

Предыдущий Strict Re-Review не предоставил доказательство полного serial e2e.

После Round 2 обязательно выполнить:

1. backend TypeScript check;
2. backend production build;
3. full backend unit suite;
4. **full serial backend e2e suite**.

Сообщить реальные:

- suites;
- tests;
- passed;
- failed;
- skipped;
- duration, если доступно.

Не hardcode исторический test count.

Если full serial e2e не выполнен — VERDICT A запрещён.

---

# 24. FRONTEND FULL REGRESSION — HARD GATE

Выполнить:

- frontend TypeScript check;
- full Vitest;
- production build.

Если production build не выполнен — final PASS не заявлять.

---

# 25. DATABASE

Проверить:

- migrations all applied;
- migration count;
- drift = 0;
- schema changes Round 2 = 0;
- new migration = 0.

Если для трёх fixes внезапно требуется schema change — остановиться и объяснить, почему.

---

# 26. ARTIFACT INTEGRITY — HARD GATE

Выполнить:

- canonical artifact checker;
- checker regression suite;
- `git diff --check`.

Сообщить:

- PASS;
- WARN;
- FAIL;
- checker regression count.

VERDICT A требует artifact integrity PASS без скрытых FAIL.

---

# 27. SECURITY / AUTHORITY NEGATIVE CHECK

Проверить:

- analytics business writes = 0;
- duplicate financial authority = 0;
- cross-partner leakage = 0;
- new permissions = 0, если не требовались;
- FX authority = 0;
- company timezone authority = 0.

---

# 28. STEP 2.17B — НЕ ТРОГАТЬ

Сохранить:

`STEP 2.17B — BLOCKED — EXTERNAL QUALIFICATION ENVIRONMENT`

В Round 2:

- final qualification = 0;
- frozen target changes = 0;
- production performance tuning = 0;
- Phase 2 exit claim = 0.

---

# 29. FINDING CLOSURE MATRIX

Создать обязательную таблицу:

| Finding | Severity | Root cause | Round 2 fix | Focused test | Full regression | Status |
|---|---|---|---|---|---|---|
| Time Series payments timestamp | HIGH | | | | | |
| Partner Performance float merge | HIGH | | | | | |
| Financial Reconciliation multi-currency | MEDIUM | | | | | |

Ожидаемый successful result:

- HIGH remaining = 0;
- MEDIUM remaining = 0.

---

# 30. REPO-WIDE SWEEP REPORT

Отдельно зафиксировать:

## Timestamp sweep

- analytics `createdAt` usages;
- какие legitimate;
- какие lifecycle metrics;
- violations remaining.

## Money sweep

- `parseFloat`;
- monetary `Number`;
- `.toNumber()`;
- JS money reduce;
- violations remaining.

Ожидается:

`monetary JS-float violations remaining = 0`

и

`wrong authoritative timestamp violations remaining = 0`

для Step 3.3 scope.

---

# 31. REMEDIATION ROUND 2 REPORT

Создать:

`docs/prompts/PHASE_3_STEP_3.3_ANALYTICS_FOUNDATION_REMEDIATION_ROUND_2_REPORT.md`

или canonical repository-equivalent.

Разделы:

1. Executive Summary
2. Repository State
3. Baseline
4. Remaining Findings
5. Finding Closure Matrix
6. Time Series Payment Timestamp Fix
7. Authoritative Timestamp Sweep
8. Timestamp Adversarial Tests
9. Partner Performance Money Fix
10. Money Representation
11. Repo-Wide Money Sweep
12. Money Adversarial Tests
13. Financial Reconciliation Multi-Currency Fix
14. Multi-Currency Contract
15. Multi-Currency Adversarial Tests
16. Read-Only Authority
17. RBAC/IDOR Regression
18. Analytics Focused Tests
19. Analytics E2E
20. Full Backend Regression
21. Full Serial E2E
22. Full Frontend Regression
23. DB Migration/Drift
24. Artifact Integrity
25. Negative Checks
26. Files Changed
27. Persistence
28. Final Verdict
29. NEXT
30. Repository Evidence

---

# 32. ROADMAP

После успешного Round 2:

НЕ ставить Step 3.3 `APPROVED`.

Статус должен семантически быть:

`IMPLEMENTATION REMEDIATED ROUND 2 — READY FOR FINAL STRICT RE-REVIEW`

или точный canonical equivalent.

Approval выполняется только отдельным review pass.

---

# 33. GIT / PERSISTENCE

В конце:

- `git status`;
- сохранить unrelated untracked files;
- проверить diff;
- `git diff --check`;
- commit intentional code/tests;
- commit report/Roadmap/provenance согласно repository convention;
- push;
- verify `HEAD == upstream`;
- tracked worktree clean;
- сообщить реальные commit SHA.

Не придумывать SHA.

---

# 34. NEGATIVE CHECKS

Финальный отчёт обязан явно указать:

- new analytics features outside scope: 0
- Step 2.17B changes: 0
- frozen performance target changes: 0
- final performance qualification: 0
- Phase 2 exit claim: 0
- PSP implementation: 0
- RLS redesign: 0
- FX implementation: 0
- invented company timezone: 0
- employee scoring: 0
- employee surveillance scoring: 0
- analytics business writes: 0
- duplicate financial authority: 0
- cross-partner leakage: 0
- monetary JS-float violations remaining: 0
- wrong analytics lifecycle timestamp violations remaining: 0
- mixed-currency fake totals: 0
- skipped/weakened tests: 0
- hidden failures: 0

---

# 35. VERDICT A

Использовать:

`PHASE 3 STEP 3.3 ANALYTICS FOUNDATION REMEDIATION ROUND 2 COMPLETED — READY FOR FINAL STRICT RE-REVIEW`

только если:

- Time Series payments `paidAt` PASS;
- timestamp sweep PASS;
- Partner Performance float merge removed;
- money sweep PASS;
- exact money tests PASS;
- Financial Reconciliation currency-separated PASS;
- fake combined currency total = 0;
- focused tests PASS;
- analytics e2e PASS;
- full backend unit PASS;
- **full serial e2e PASS**;
- frontend tsc/Vitest/build PASS;
- DB drift 0;
- artifact integrity PASS;
- remaining HIGH = 0;
- remaining MEDIUM = 0.

---

# 36. VERDICT B

Если хотя бы один implementation finding остаётся:

`PHASE 3 STEP 3.3 ANALYTICS FOUNDATION REMEDIATION ROUND 2 INCOMPLETE — FURTHER REMEDIATION REQUIRED`

Не переходить к final review.

---

# 37. VERDICT C

Если исправление требует отсутствующей canonical authority:

`PHASE 3 STEP 3.3 ANALYTICS FOUNDATION REMEDIATION ROUND 2 BLOCKED — AUTHORITY/DESIGN DECISION REQUIRED`

Не придумывать authority.

---

# 38. NEXT

При VERDICT A:

`NEXT: PHASE 3 — STEP 3.3 — FINAL STRICT RE-REVIEW`

Не запускать автоматически:

- Step 3.1;
- Dashboard;
- Employee Analytics;
- другой Phase 3 implementation.

---

# 39. ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА РАЗРАБОТЧИКА

Все объяснения пользователю — **на русском языке**.

Итоговый ответ должен содержать:

- Verdict;
- Step 3.3 status;
- 3 findings CLOSED/OPEN;
- timestamp fix;
- timestamp sweep;
- money fix;
- money sweep;
- reconciliation multi-currency;
- focused analytics tests;
- analytics e2e;
- full backend unit;
- **full serial e2e**;
- frontend tsc/Vitest/build;
- DB/drift;
- artifact integrity;
- remaining CRITICAL/HIGH/MEDIUM;
- commits/push;
- NEXT.

---

# 40. КРИТЕРИЙ УСПЕХА

Round 2 не должен снова расширять Step 3.3.

Он должен окончательно закрыть три оставшихся дефекта:

`PAYMENTS BY paidAt`
+
`NO JS FLOAT MONEY`
+
`FULL MULTI-CURRENCY RECONCILIATION`

и доказать отсутствие регрессии через:

`FOCUSED TESTS`
+
`ANALYTICS E2E`
+
`FULL UNIT`
+
`FULL SERIAL E2E`
+
`FRONTEND FULL REGRESSION`
+
`DB DRIFT 0`
+
`ARTIFACT INTEGRITY PASS`.

После этого Step 3.3 передаётся на **Final Strict Re-Review**, а не автоматически получает APPROVED.
