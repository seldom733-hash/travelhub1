# TRAVELHUB — PHASE 3 — STEP 3.1 — DASHBOARD / COMMAND CENTER BACKEND — IMPLEMENTATION

> **ОБЯЗАТЕЛЬНЫЙ ЯЗЫК ОТВЕТОВ**
>
> Все ответы разработчика пользователю, промежуточные статусы, пояснения, выводы и итоговый summary должны быть **на русском языке**.
>
> Английский допускается только для кода, команд, путей, API routes, DTO/enum/permission names, идентификаторов и канонических технических статусов.

---

# 1. ЦЕЛЬ

Выполнить behavior-preserving / contract-driven implementation:

`PHASE 3 — STEP 3.1 — DASHBOARD / COMMAND CENTER BACKEND`

на основании утверждённого Design & Contract pass.

Текущий статус:

`STEP 3.1 — DESIGN COMPLETED — READY FOR IMPLEMENTATION`

После успешного выполнения этого prompt статус должен быть:

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

**НЕ ставить Step 3.1 APPROVED в этом проходе.**

---

# 2. REPOSITORY-FIRST BASELINE

Перед изменениями проверить:

- branch;
- HEAD;
- upstream;
- worktree;
- canonical Roadmap;
- Step 3.1 design document;
- Step 3.1 design report;
- Step 3.3 approved implementation;
- Step 3.3 API/service contracts;
- existing dashboard/frontend consumers;
- permissions;
- existing test conventions.

Проверить design commit:

`eba07c4`

Не доверять summary без repository evidence.

---

# 3. УТВЕРЖДЁННАЯ АРХИТЕКТУРА

Реализовать выбранный Design Option C:

```text
GET /api/v1/dashboard/command-center
    → Summary / cards / sections

GET /api/v1/dashboard/command-center/trends
    → Lazy-loaded time series
```

Не менять архитектуру без доказанного blocker.

Если design невозможно реализовать без существенного изменения контракта — HARD STOP и документировать причину.

---

# 4. ОСНОВНОЙ ИНВАРИАНТ

Step 3.1 — **orchestration/consumer layer** над Step 3.3.

Архитектура:

```text
CANONICAL DOMAIN FACTS
        ↓
STEP 3.3 ANALYTICS FOUNDATION
        ↓
STEP 3.1 COMMAND CENTER BACKEND
        ↓
STEP 3.2 DASHBOARD UI
```

Step 3.1 НЕ создаёт параллельный Analytics Foundation.

---

# 5. ЗАПРЕТ НА DUPLICATE ANALYTICS LOGIC

Не дублировать внутри Dashboard:

- period resolution;
- CUSTOM range resolution;
- comparison period calculation;
- timezone resolution;
- granularity/bucket generation;
- monetary aggregation authority;
- currency aggregation;
- Partner Performance calculation;
- Conversion Funnel calculation;
- Financial Reconciliation calculation;
- Actor Attribution semantics.

Переиспользовать canonical Step 3.3 services/read models/helpers согласно утверждённому design.

---

# 6. 18 KPI CARDS — IMPLEMENT EXACT DESIGN MAPPING

Реализовать утверждённые 18 KPI cards в 4 секциях.

## Executive Summary

- GMV
- Revenue
- Net Revenue
- Orders
- Bookings
- AOV
- Conversion

## Operational

- Fulfilled
- Confirmed
- Completed
- Payments
- Refunds
- Funnel

## Financial

- Commission
- Reconciliation
- Payments
- Net Payments

## Marketplace

- Sessions
- Partners
- Customers

Перед кодированием каждой карточки проверить её фактический source mapping из design/repository.

---

# 7. KPI SOURCE MATRIX — HARD GATE

Создать/поддержать в implementation report таблицу:

| KPI | Canonical source | Existing Step 3.3 read model/metric | Timestamp | Currency semantics | Implemented as |
|---|---|---|---|---|---|

**Нельзя реализовывать карточку по названию, не определив её canonical semantics.**

Особенно проверить:

- Net Revenue;
- Net Payments;
- Fulfilled;
- Customers;
- Funnel.

Если design уже определил семантику — реализовать её verbatim.

Если design НЕ определил её достаточно точно и repository authority отсутствует — не придумывать формулу. Зафиксировать blocker.

---

# 8. NET REVENUE — NO INVENTED FORMULA

Не считать автоматически:

`Revenue - Commission`

или любую другую формулу, если это не подтверждено design/canonical financial semantics.

Проверить repository authority.

Если canonical Net Revenue уже определён — использовать его.

---

# 9. NET PAYMENTS — NO INVENTED FORMULA

Не считать автоматически:

`Payments - Refunds`

без подтверждённой canonical semantics.

Проверить Step 3.3 / Step 2.18A / financial model.

Не смешивать:

- payment amount;
- refunded amount;
- provider fee;
- commission;
- ledger balance.

---

# 10. FULFILLED / COMPLETED

Проверить, относятся ли:

- `Fulfilled`
- `Completed`

к разным canonical объектам/состояниям.

Не объединять и не переименовывать lifecycle statuses ради UI convenience.

---

# 11. CUSTOMERS

Определить по design точную семантику:

- registered customers?
- active customers?
- buyers with transactions?
- unique customers in period?

Не угадывать.

Использовать только утверждённый source.

---

# 12. FUNNEL

Dashboard Funnel должен быть summary consumer canonical Step 3.3 Conversion Funnel.

Не создавать отдельную funnel event taxonomy.

Сохранить dedup/replay-safe semantics Step 3.3.

---

# 13. PERIOD CONTRACT

Оба endpoints должны переиспользовать Step 3.3 period semantics.

Поддержать canonical presets:

- TODAY
- LAST_3_DAYS
- LAST_7_DAYS
- MONTH
- LAST_6_MONTHS
- YEAR
- CUSTOM

CUSTOM:

`startDate + endDate`

Не создавать dashboard-specific period resolver.

---

# 14. HALF-OPEN BOUNDARIES

Все period metrics:

`[startInstant, endExclusiveInstant)`

Не вводить inclusive-end logic.

---

# 15. COMPARISON

Summary cards должны использовать canonical Step 3.3 comparison semantics.

Для каждой comparable KPI обеспечить согласованный current/comparison contract.

Не пересчитывать previous period вручную в Dashboard.

---

# 16. TIMEZONE

Переиспользовать Step 3.3 timezone semantics.

Не изобретать tenant/company timezone.

Если canonical fallback остаётся UTC — сохранить его.

---

# 17. TRENDS ENDPOINT

Реализовать lazy trends endpoint отдельно от summary.

Он должен использовать canonical Step 3.3:

- Time Series;
- granularity;
- period;
- timezone;
- currency semantics.

Не создавать новый bucket generator.

---

# 18. TRENDS PAYLOAD

Возвращать только утверждённые design series.

Не выгружать автоматически все 30+ Analytics Foundation metrics.

Payload должен быть bounded.

---

# 19. MULTI-CURRENCY — HARD GATE

Все monetary cards и trends должны сохранять currency-separated semantics.

Запрещено:

```text
USD + EUR + AZN = one total
```

без canonical FX authority.

Не создавать fake global totals.

---

# 20. MONEY AUTHORITY

Dashboard не должен выполнять новую финансовую бизнес-логику.

Переиспользовать exact values/read models Step 3.3.

Не создавать:

- float money aggregation;
- FX conversion;
- mutable financial reconstruction;
- ledger regeneration;
- commission regeneration.

---

# 21. RBAC

Использовать утверждённый existing permission:

`analytics.read`

Не создавать новый permission без design authority.

Проверить canonical guards/decorators.

---

# 22. PARTNER ISOLATION — HARD SECURITY GATE

Переиспользовать proven Step 3.3 partner scoping pattern:

`resolvePartnerScope()`

или фактический repository equivalent.

Обязательные invariants:

- Partner A видит только собственный scope;
- Partner A не может query Partner B;
- BUYER denied, если так определено design;
- internal roles следуют canonical permissions.

Не доверять произвольному `partnerId` из query.

---

# 23. ROLE-AWARE VISIBILITY

Реализовать ровно design permission/visibility matrix.

Не hardcode role names там, где canonical architecture использует permissions.

Если отдельные sections скрываются по permissions — обеспечить deterministic contract.

---

# 24. ACTION / OWNERSHIP / OUTCOME

Если карточка использует actor attribution, сохранить:

`ACTION ≠ OWNERSHIP ≠ OUTCOME`

Не засчитывать бизнес-результат последнему actor без canonical attribution.

---

# 25. EMPLOYEE ANALYTICS — OUT OF SCOPE

Не реализовывать:

- employee idle time;
- employee activity table;
- employee productivity scoring;
- employee effectiveness scoring;
- surveillance metrics;
- employee ranking.

Это отдельный последующий Phase 3 scope.

---

# 26. ATTENTION / ALERTS

Если design включил attention indicators, реализовать только те, у которых есть canonical threshold/status authority.

Не придумывать:

- SLA threshold;
- warning percentage;
- anomaly threshold;
- KPI target.

Если authority gap сохранён — оставить соответствующую функцию deferred.

---

# 27. DRILL-DOWN METADATA

Реализовать только design-approved drill-down metadata.

Не hardcode frontend URL, если repository convention использует route/filter identifiers.

Step 3.2 должен получить стабильный backend-facing navigation context.

---

# 28. EMPTY STATE SEMANTICS

Различать:

- valid zero;
- no data;
- forbidden;
- unavailable;
- partial section failure.

Не превращать unavailable в `0`.

---

# 29. PARTIAL FAILURE

Summary агрегирует несколько read models.

Реализовать design-approved failure model.

Не скрывать ошибку одной critical section как нулевые данные.

Если design разрешает partial response — он должен быть явно маркирован.

---

# 30. ERROR CONTRACT

Сохранить canonical API errors для:

- invalid preset;
- invalid CUSTOM range;
- invalid timezone;
- invalid granularity;
- unauthorized;
- forbidden partner scope.

Не создавать несовместимый dashboard error envelope.

---

# 31. API DTOs

Реализовать bounded DTO contract из design.

Не возвращать Prisma/domain entities напрямую.

Не over-generalize DTO ради будущих гипотетических cards.

---

# 32. MODULE STRUCTURE

Следовать design/repository conventions.

Ожидаемый logical shape может включать:

- dashboard/command-center controller;
- orchestration service;
- DTO/query types;
- module registration;
- tests.

Но фактические пути и naming должны соответствовать repository.

---

# 33. QUERY / ORCHESTRATION STRATEGY

Не допускать N+1 aggregation storm.

Переиспользуемые независимые Step 3.3 reads могут выполняться параллельно, если это безопасно и design это допускает.

Проверить:

- bounded downstream calls;
- no per-card DB query explosion;
- no per-row analytics query;
- no duplicate same-period reads.

---

# 34. NO PREMATURE CACHE

Реализовать cache только если design явно выбрал cache strategy.

Если design решил cache deferred/none — не добавлять Redis/in-memory cache самостоятельно.

---

# 35. OBSERVABILITY

Если repository уже имеет canonical observability primitives — интегрировать минимально согласно design.

Не добавлять новый telemetry framework.

---

# 36. WAVE 0 — MODULE SKELETON / DTOs

Выполнить утверждённую Wave 0:

- module/controller/service skeleton согласно design;
- DTOs/query validation;
- module wiring;
- characterization tests, если design требует до behavior.

Gate перед Wave 1:

- tsc PASS;
- focused tests PASS.

---

# 37. WAVE 1 — QUERY CONTRACT

Реализовать:

- period query;
- CUSTOM;
- timezone;
- trends query;
- canonical validation;
- forwarding в Step 3.3.

Не копировать resolver logic.

Gate:

- focused unit PASS;
- invalid input tests PASS.

---

# 38. WAVE 2 — ORCHESTRATION SERVICE

Реализовать Summary orchestration:

- 4 sections;
- 18 cards;
- comparison metadata;
- currency-separated values;
- source reuse;
- no duplicate authority.

Перед завершением Wave 2 заполнить KPI Source Matrix.

Gate:

- orchestration unit tests PASS;
- money/currency tests PASS;
- no invented KPI formula.

---

# 39. WAVE 3 — CONTROLLER / RBAC

Реализовать:

```text
GET /api/v1/dashboard/command-center
GET /api/v1/dashboard/command-center/trends
```

с canonical:

- auth;
- `analytics.read`;
- partner isolation;
- query validation;
- DTO serialization.

Gate:

- controller/security focused tests PASS.

---

# 40. WAVE 4 — E2E / SECURITY

Добавить полноценные e2e.

Минимум:

### Authentication/RBAC
- unauthenticated → denied;
- permission missing → denied;
- authorized internal role → allowed.

### Partner isolation
- Partner A own → allowed;
- Partner A requests Partner B → denied/scoped;
- BUYER → expected deny.

### Period
- TODAY;
- LAST_3_DAYS;
- LAST_7_DAYS;
- MONTH;
- LAST_6_MONTHS;
- YEAR;
- CUSTOM.

### Boundaries
- start included;
- endExclusive excluded.

### Timezone
- valid IANA;
- invalid timezone;
- DST-sensitive scenario if relevant.

### Currency
- 2+ currencies;
- no mixed fake total.

### Summary
- 4 sections;
- expected cards;
- zero/no-data semantics.

### Trends
- lazy endpoint;
- canonical granularity;
- bounded series.

---

# 41. WAVE 5 — FULL REGRESSION / DOCS

После implementation выполнить полный regression contract.

Не считать focused tests достаточными.

---

# 42. UNIT TEST CONTRACT

Добавить tests минимум для:

- orchestration mapping;
- exact 18 KPI inventory;
- source mapping;
- comparison forwarding;
- period forwarding;
- timezone forwarding;
- currency separation;
- zero/no-data;
- partial/unavailable behavior;
- trends forwarding;
- permission/scope helpers, если применимо.

---

# 43. KPI SEMANTIC TESTS

Для спорных KPI создать явные tests, чтобы формула не менялась незаметно:

- Net Revenue;
- Net Payments;
- Fulfilled;
- Completed;
- Customers;
- Funnel.

Тест должен отражать canonical design semantics, а не implementation accident.

---

# 44. STEP 3.3 REUSE TEST / REVIEW

Проверить отсутствие duplicated analytics logic.

Repo-wide inspect нового Dashboard code на:

- duplicate period math;
- duplicate comparison math;
- duplicate bucket math;
- raw financial aggregation;
- new funnel aggregation;
- new reconciliation aggregation.

Если обнаружено — remediation до завершения implementation.

---

# 45. READ-ONLY GATE

Command Center должен быть read-only.

Ожидается:

`dashboard business writes = 0`

Проверить отсутствие:

- create/update/delete;
- status transitions;
- EventBus/outbox business emit;
- ledger/payment/commission mutation.

---

# 46. BACKEND REGRESSION — HARD GATE

После Wave 5 выполнить:

1. backend TypeScript;
2. backend production build;
3. full backend unit;
4. **full canonical serial e2e**.

Сообщить реальные:

- suites;
- tests;
- passed;
- failed;
- skipped.

Не hardcode historical counts.

---

# 47. FRONTEND REGRESSION — HARD GATE

Хотя Step 3.1 backend-only, выполнить:

- frontend TypeScript;
- full Vitest;
- frontend production build.

Step 3.1 не должен ломать shared API/types/build.

---

# 48. DATABASE — HARD GATE

Проверить:

- all migrations applied;
- migration count;
- drift = 0;
- new schema changes = 0;
- new migration = 0, если design не требовал.

Если implementation неожиданно требует schema migration — HARD STOP и design reconciliation.

---

# 49. ARTIFACT INTEGRITY — HARD GATE

Выполнить:

- canonical artifact checker;
- checker regression;
- `git diff --check`.

Сообщить точные PASS/WARN/FAIL.

---

# 50. SECURITY NEGATIVE CHECKS

Подтвердить:

- new permissions: 0;
- auth bypass: 0;
- partner IDOR: 0;
- raw scope bypass: 0;
- cross-partner leakage: 0;
- business writes: 0.

---

# 51. MONEY/CURRENCY NEGATIVE CHECKS

Подтвердить:

- new money authority: 0;
- JS-float financial aggregation introduced: 0;
- FX introduced: 0;
- mixed-currency fake totals: 0;
- financial reconstruction: 0.

---

# 52. PERFORMANCE BOUNDARY

Не выполнять Step 2.17B final qualification.

Не менять frozen performance targets.

Можно выполнить bounded local query/profiling sanity, если это нужно для доказательства отсутствия N+1, но не выдавать это за performance qualification.

---

# 53. STEP 2.17B

Сохранить:

`STEP 2.17B — BLOCKED — EXTERNAL QUALIFICATION ENVIRONMENT`

Без изменений.

---

# 54. IMPLEMENTATION REPORT

Создать:

`docs/prompts/PHASE_3_STEP_3.1_DASHBOARD_COMMAND_CENTER_BACKEND_IMPLEMENTATION_REPORT.md`

или canonical repository-equivalent.

Разделы:

1. Executive Summary
2. Repository Baseline
3. Design Contract
4. Files Changed
5. Module/API Architecture
6. KPI Source Matrix
7. Executive Summary Section
8. Operational Section
9. Financial Section
10. Marketplace Section
11. Period/CUSTOM
12. Comparison
13. Timezone
14. Trends
15. Multi-Currency
16. Money Authority
17. RBAC
18. Partner Isolation
19. Empty/Partial/Error Semantics
20. Drill-Down
21. Query/Performance Sanity
22. Step 3.3 Reuse Audit
23. Unit Tests
24. E2E/Security Tests
25. Backend Full Regression
26. Frontend Regression
27. DB Migration/Drift
28. Artifact Integrity
29. Negative Checks
30. Authority Gaps / Deferred
31. Persistence
32. Final Verdict
33. NEXT
34. Repository Evidence

---

# 55. ROADMAP STATUS

При успешной implementation:

Step 3.1:

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Не ставить:

`APPROVED`

до отдельного Strict Review.

---

# 56. PERSISTENCE

После полного PASS:

- intentional diff;
- `git diff --check`;
- сохранить unrelated untracked files;
- commit implementation/tests;
- commit docs/Roadmap/provenance согласно convention;
- push;
- verify HEAD == upstream;
- tracked worktree clean;
- сообщить реальные SHA.

Не придумывать commit IDs.

---

# 57. VERDICT A

Использовать:

`PHASE 3 STEP 3.1 DASHBOARD / COMMAND CENTER BACKEND IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

только если:

- Option C implemented;
- both endpoints implemented;
- 18 KPI source mappings proven;
- no invented KPI formulas;
- Step 3.3 reuse PASS;
- period/CUSTOM PASS;
- comparison PASS;
- timezone PASS;
- multi-currency PASS;
- RBAC PASS;
- partner isolation PASS;
- read-only PASS;
- focused unit PASS;
- dashboard e2e PASS;
- backend tsc/build PASS;
- full backend unit PASS;
- full serial e2e PASS;
- frontend tsc/Vitest/build PASS;
- DB drift 0;
- artifact integrity PASS;
- CRITICAL/HIGH implementation blockers = 0.

---

# 58. VERDICT B

Если implementation defect остаётся:

`PHASE 3 STEP 3.1 DASHBOARD / COMMAND CENTER BACKEND IMPLEMENTATION INCOMPLETE — REMEDIATION REQUIRED`

Не переходить к Strict Review как будто implementation завершена.

---

# 59. VERDICT C

Если обнаружена отсутствующая canonical authority для обязательного KPI/contract:

`PHASE 3 STEP 3.1 DASHBOARD / COMMAND CENTER BACKEND IMPLEMENTATION BLOCKED — AUTHORITY/DESIGN DECISION REQUIRED`

Не придумывать формулу или policy.

---

# 60. NEXT

При VERDICT A:

`NEXT: PHASE 3 — STEP 3.1 — DASHBOARD / COMMAND CENTER BACKEND — STRICT REVIEW`

Не запускать автоматически:

- Step 3.2;
- Dashboard UI;
- Employee Analytics;
- Analytics extensions.

---

# 61. ФОРМАТ ФИНАЛЬНОГО ОТВЕТА РАЗРАБОТЧИКА

**Все объяснения — на русском языке.**

Финальный ответ должен содержать:

- Verdict;
- Step 3.1 status;
- endpoints;
- 4 sections / 18 KPI;
- спорные KPI semantics;
- Step 3.3 reuse;
- periods/CUSTOM/comparison;
- trends;
- multi-currency;
- RBAC;
- partner isolation;
- read-only status;
- focused tests;
- dashboard e2e;
- backend tsc/build;
- full unit;
- full serial e2e;
- frontend tsc/Vitest/build;
- DB/drift;
- artifact integrity;
- authority gaps;
- files changed;
- commits/push;
- NEXT.

---

# 62. КРИТЕРИЙ УСПЕХА

Implementation Step 3.1 должна доказать:

```text
COMMAND CENTER = ORCHESTRATION
NOT A SECOND ANALYTICS ENGINE
```

и:

```text
18 KPI
+ CANONICAL SOURCES
+ PERIOD/COMPARISON REUSE
+ MULTI-CURRENCY SAFETY
+ RBAC/IDOR
+ LAZY TRENDS
+ FULL REGRESSION
```

После этого Step 3.1 только:

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

и передаётся в отдельный независимый Strict Review.
