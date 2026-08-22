# TRAVELHUB — PHASE 3 — STEP 3.1 — DASHBOARD / COMMAND CENTER BACKEND — DESIGN & CONTRACT

> **ОБЯЗАТЕЛЬНЫЙ ЯЗЫК ОТВЕТОВ**
>
> Все ответы разработчика пользователю, промежуточные статусы, пояснения, выводы и итоговый summary должны быть **на русском языке**.
>
> Английский допускается только для кода, команд, путей, API routes, DTO/enum/permission names, идентификаторов и канонических технических статусов.

---

# 1. ЦЕЛЬ

Выполнить repository-first **Design & Contract pass** для:

`PHASE 3 — STEP 3.1 — DASHBOARD / COMMAND CENTER BACKEND`

после полного утверждения:

`PHASE 3 — STEP 3.3 — ANALYTICS FOUNDATION — APPROVED`

Sequencing уже определил Step 3.1 как canonical NEXT.

Этот проход должен определить backend-архитектуру Command Center **до начала production implementation**.

---

# 2. ТЕКУЩИЙ BASELINE

Repository-first проверить:

- Step 3.3: APPROVED;
- Step 3.3 closure: COMPLETE;
- Final Strict Re-Review: VERDICT A;
- Step 3.3 final evidence:
  - backend tsc/build PASS;
  - full serial e2e: 70 suites / 1213 tests PASS;
  - frontend tsc/Vitest: 135 PASS;
  - frontend production build PASS;
  - DB drift 0;
  - artifact checker PASS=166 WARN=0 FAIL=0;
- post-3.3 sequencing commit: `59b7a39` — проверить фактически;
- Step 2.17B: `BLOCKED — EXTERNAL QUALIFICATION ENVIRONMENT`;
- Phase 2 formal exit: blocked / unchanged.

Не принимать SHA/status только из summary — проверить repository.

---

# 3. HARD SCOPE

В этом pass:

- анализируем существующий Dashboard/Command Center backend;
- определяем backend use cases;
- определяем карточки/KPI contract;
- определяем period/comparison behavior;
- определяем charts/time-series contract;
- определяем role-aware visibility;
- определяем drill-down/navigation metadata, если backend должен её отдавать;
- определяем error/empty/loading-relevant response semantics;
- определяем caching/read-model strategy;
- определяем tests и implementation waves.

**Production implementation Step 3.1 НЕ начинать.**

---

# 4. CANONICAL ROADMAP

Сначала прочитать точное определение Step 3.1 в Roadmap.

Зафиксировать:

- canonical title;
- scope;
- prerequisites;
- exit criteria;
- consumers;
- relation to Step 3.2;
- relation to Step 3.3;
- relation to later Analytics steps.

Если текущий prompt конфликтует с Roadmap — Roadmap имеет приоритет, а конфликт документируется.

---

# 5. REPOSITORY INVENTORY

Провести inventory существующего backend/frontend, связанного с Dashboard.

Найти:

- dashboard module/service/controller;
- existing dashboard endpoints;
- analytics endpoints;
- legacy KPI endpoints;
- duplicated aggregation logic;
- permissions;
- DTOs;
- frontend API consumers;
- existing Command Center page;
- mock/static cards;
- charts;
- filters;
- period selectors;
- role-specific behavior.

Создать таблицу:

| Existing component | Location | Current responsibility | Reusable? | Replace? | Notes |
|---|---|---|---:|---:|---|

Не удалять и не менять код в design pass.

---

# 6. ОСНОВНОЙ АРХИТЕКТУРНЫЙ ПРИНЦИП

Step 3.1 является **consumer/orchestrator** Step 3.3.

Он НЕ должен создавать второй Analytics Foundation.

Запрещено дублировать:

- period resolver;
- CUSTOM date semantics;
- comparison resolver;
- granularity resolver;
- monetary aggregation authority;
- currency semantics;
- actor attribution;
- Partner Performance calculation;
- Conversion Funnel calculation;
- Financial Reconciliation calculation.

Где возможно, Command Center должен использовать canonical Step 3.3 services/read models.

---

# 7. COMMAND CENTER PURPOSE

Design должен определить Command Center как страницу руководителя/операционного управления, отвечающую прежде всего на вопросы:

- что происходит в бизнесе сейчас;
- что изменилось относительно предыдущего периода;
- где есть отклонение;
- где требуется внимание;
- какие коммерческие/операционные процессы ухудшаются;
- куда руководитель должен перейти для детализации.

Command Center НЕ должен превращаться в полную страницу Analytics.

---

# 8. KPI CARD CONTRACT

Repository-first определить канонический набор карточек для Step 3.1.

Не придумывать показатели без source-of-truth.

Для каждой proposed card создать:

| KPI | Business meaning | Source/read model | Timestamp | Period | Comparison | Currency | Permission | Drill-down |
|---|---|---|---|---|---|---|---|---|

Проверить минимум релевантность:

- GMV;
- Revenue;
- Commission;
- Orders;
- Bookings;
- Paid/Payment;
- Conversion;
- AOV;
- active products/partners;
- operational SLA;
- cancellation/completion;
- другие KPI только если они канонически существуют.

---

# 9. CARD RESPONSE SEMANTICS

Для KPI card определить единый response contract.

Conceptually карточке могут требоваться:

- metric identifier;
- display value;
- previous/comparison value;
- absolute delta;
- percentage delta;
- trend direction;
- currency/unit;
- period;
- comparison period;
- status/attention metadata;
- drill-down target.

Но **не копировать этот shape механически**.

Использовать conventions проекта.

---

# 10. COMPARISON SEMANTICS

Обязательно переиспользовать Step 3.3.

Поддержать:

- TODAY;
- LAST_3_DAYS;
- LAST_7_DAYS;
- MONTH;
- LAST_6_MONTHS;
- YEAR;
- CUSTOM.

CUSTOM:

`startDate + endDate`

Comparison:

- calendar presets → previous corresponding calendar period;
- CUSTOM → immediately preceding equivalent-duration interval.

Не реализовывать отдельную dashboard comparison logic.

---

# 11. TIMEZONE

Command Center должен использовать Step 3.3 timezone contract.

Сохранить текущий authority gap:

- company/tenant timezone отсутствует;
- API может использовать canonical optional IANA timezone;
- fallback = UTC, если это всё ещё действующий Step 3.3 contract.

Не изобретать company timezone в Step 3.1.

---

# 12. HALF-OPEN BOUNDARIES

Все time-filtered metrics:

`[startInstant, endExclusiveInstant)`

Не создавать dashboard-specific inclusive end-date semantics.

---

# 13. MULTI-CURRENCY

Command Center не должен создавать ложный общий денежный total из разных валют.

Repository-first определить UX/backend contract для multi-currency cards.

Допустимые варианты должны следовать Step 3.3, например:

- per-currency values;
- currency groups;
- explicit primary display только при наличии canonical authority.

Без FX authority запрещено:

`USD + EUR + AZN = one total`

---

# 14. MONEY

Command Center не пересчитывает финансовую authority самостоятельно.

Использовать Step 3.3 read models/exact semantics.

Никаких новых:

- float-based financial aggregation;
- FX;
- mutable financial reconstruction;
- ledger regeneration.

---

# 15. DASHBOARD SECTIONS

Design должен определить логические backend sections Command Center.

Repository-first проверить необходимость таких групп:

### Executive / Commercial
- GMV;
- Revenue;
- Orders;
- Bookings;
- Conversion;
- AOV.

### Operational
- pending/confirmed/paid/completed/cancelled;
- SLA/timing;
- operational exceptions.

### Sales
- opportunities;
- quotes;
- checkout;
- sales conversion.

### Marketplace
- activity;
- products;
- partners;
- funnel.

### Financial
- payments;
- commission;
- reconciliation indicators.

Не включать группу только потому, что она перечислена здесь — подтвердить источником и Roadmap.

---

# 16. ATTENTION / ALERT CARDS

Command Center может нуждаться в блоке:

`Requires Attention`

Но Step 3.1 не должен изобретать автоматическую бизнес-политику.

Repository-first определить, существуют ли canonical conditions:

- overdue;
- failed;
- pending too long;
- reconciliation mismatch;
- SLA breach;
- moderation backlog;
- payment anomaly.

Для каждого alert:

| Alert | Canonical source | Threshold authority | Permission | Drill-down |
|---|---|---|---|---|

Если threshold authority отсутствует — документировать gap, не придумывать число.

---

# 17. TREND / TIME SERIES

Определить backend contract для графиков Command Center.

Переиспользовать:

- Step 3.3 Time Series;
- canonical granularity;
- period;
- comparison.

Не делать отдельный dashboard bucket generator.

Определить, какие series нужны на первом экране, а какие должны оставаться Analytics drill-down.

---

# 18. DRILL-DOWN

Каждая карточка/alert/chart должна по возможности иметь понятный путь детализации.

Backend design должен определить, требуется ли возвращать:

- route key;
- filter metadata;
- entity/status context;
- analytics query parameters.

Не hardcode frontend URLs в backend без существующей convention.

---

# 19. ROLE-AWARE COMMAND CENTER

Repository-first определить роли и permissions.

Минимально проверить:

- ADMIN;
- DIRECTOR;
- FINANCE;
- ANALYST;
- SALES_MANAGER;
- OPERATOR;
- MODERATOR;
- MARKETER;
- PARTNER;
- BUYER.

Не предполагать, что все роли должны видеть Command Center.

Создать matrix:

| Section/KPI | Permission | Internal role | Partner scope | Buyer |
|---|---|---|---|---|

Использовать permissions, а не hardcoded role checks, если такова canonical security architecture.

---

# 20. PARTNER SCOPE

Если Dashboard доступен PARTNER:

- partner scope должен быть серверным;
- нельзя принимать произвольный `partnerId` без authorization;
- Partner A не видит Partner B;
- internal roles следуют canonical permissions.

Переиспользовать proven Step 3.3 isolation pattern.

---

# 21. EMPLOYEE ANALYTICS — НЕ СМЕШИВАТЬ

Step 3.1 не является Employee Analytics.

Не добавлять сюда:

- idle-time employee ranking;
- employee efficiency scoring;
- employee surveillance;
- персональные productivity tables.

Допустимы только aggregate operational/business indicators, если они входят в canonical Command Center.

Детальная Employee Analytics остаётся отдельным последующим design.

---

# 22. ACTOR ATTRIBUTION

Если Command Center использует actor-based metric, сохранить:

`ACTION ≠ OWNERSHIP ≠ OUTCOME`

Не кредитовать результат сотруднику только потому, что он последний изменил объект.

---

# 23. API SURFACE

Design должен предложить минимальный API surface.

Repository-first сравнить варианты:

### Option A
один aggregated endpoint Command Center.

### Option B
несколько section endpoints.

### Option C
hybrid: summary + lazy-loaded sections.

Для каждого оценить:

- latency;
- payload;
- authorization;
- caching;
- frontend complexity;
- failure isolation;
- reuse of Step 3.3;
- testability.

Выбрать один вариант с rationale.

---

# 24. PERFORMANCE / QUERY BUDGET

Step 3.1 не должен создавать N+1 aggregation storm.

Design должен определить:

- число downstream read-model calls;
- parallelization;
- DB query count;
- expensive aggregations;
- lazy loading;
- cache candidates;
- bounded payload.

Не менять performance targets Step 2.17B.

Не проводить final performance qualification.

---

# 25. CACHE

Определить, нужен ли cache для Command Center.

Если да:

- что cacheable;
- key dimensions;
- period;
- timezone;
- role/scope;
- currency;
- TTL authority;
- invalidation.

Не придумывать TTL без основания.

Если cache не нужен на первом implementation — так и зафиксировать.

---

# 26. CONSISTENCY MODEL

Определить ожидаемую консистентность Dashboard:

- transactional real-time;
- near-real-time;
- eventual read model.

Не обещать stronger consistency, чем дают Step 3.3 sources.

---

# 27. EMPTY / PARTIAL DATA

Backend contract должен однозначно различать:

- valid zero;
- no data;
- unavailable section;
- forbidden section;
- partial failure.

Не возвращать `0` там, где источник недоступен.

---

# 28. ERROR CONTRACT

Проверить canonical error handling.

Определить:

- invalid period;
- invalid timezone;
- invalid custom range;
- unauthorized;
- forbidden scope;
- unavailable downstream read model.

Не создавать dashboard-specific incompatible error format.

---

# 29. OBSERVABILITY

Design должен определить минимум:

- request latency;
- section/read-model latency;
- error count;
- slow query visibility;
- correlation/request ID reuse.

Не добавлять invasive telemetry без необходимости.

---

# 30. DTO / VERSIONING

Определить:

- response DTO;
- enum reuse;
- backward compatibility;
- nullable/optional fields;
- future extensibility.

Не создавать over-generalized schema ради гипотетических функций.

---

# 31. EXISTING FRONTEND CONTRACT

Хотя Step 3.1 backend-only, проверить существующий frontend consumer.

Нужно знать:

- какие данные UI уже ожидает;
- где mocks;
- какие names/types используются;
- что Step 3.2 сможет переиспользовать.

Frontend production code в этом pass не менять.

---

# 32. CHARACTERIZATION GAPS

Перед будущей implementation определить, какие tests нужны для фиксации текущего поведения.

Создать gap matrix:

| Contract | Existing test | Gap | Required before implementation? |
|---|---|---|---:|

---

# 33. IMPLEMENTATION WAVES

Подготовить безопасный план реализации.

Примерная структура, которую нужно адаптировать repository-first:

- Wave 0 — characterization/contracts;
- Wave 1 — DTO/query contract;
- Wave 2 — Command Center orchestration service;
- Wave 3 — controller/RBAC;
- Wave 4 — trends/attention sections;
- Wave 5 — e2e/security;
- Wave 6 — regression/docs/cleanup.

Не начинать waves в design pass.

---

# 34. TEST CONTRACT ДЛЯ БУДУЩЕЙ IMPLEMENTATION

Design должен определить обязательные tests:

### Unit
- orchestration;
- period forwarding;
- comparison forwarding;
- multi-currency;
- zero/no-data;
- partial sections.

### E2E
- authorization;
- role visibility;
- partner isolation;
- period presets;
- CUSTOM;
- timezone;
- half-open boundaries;
- multi-currency;
- drill-down metadata;
- invalid inputs.

### Regression
- full backend unit;
- full serial e2e;
- frontend tsc/Vitest/build;
- DB drift;
- artifact integrity.

---

# 35. SECURITY HARD GATES

Будущая implementation обязана сохранить:

- authentication;
- permissions;
- IDOR protection;
- partner isolation;
- read-only analytics;
- no duplicate authority;
- no raw bypass of tenant/partner scope.

---

# 36. NO SCHEMA BY DEFAULT

Design должен стремиться использовать существующие facts/read models.

Если новая schema/migration кажется необходимой:

- доказать почему Step 3.3 недостаточен;
- классифицировать как design decision;
- не создавать migration в этом pass.

---

# 37. RELATION TO STEP 3.2

Явно определить backend contract, который Step 3.2 Dashboard UI сможет потреблять без повторного redesign.

Но не проектировать пиксельный UI в Step 3.1.

Зафиксировать только frontend-facing data contract и section hierarchy.

---

# 38. RELATION TO LATER ANALYTICS

Command Center должен быть summary/decision surface.

Detailed Analytics остаётся downstream.

Не переносить в Dashboard все 30+ metrics Step 3.3.

Для каждого KPI решить:

- show on Command Center;
- drill down to Analytics;
- not needed.

---

# 39. KPI SELECTION MATRIX

Создать:

| KPI | Command Center? | Why | Source | Drill-down destination |
|---|---:|---|---|---|

Цель — избежать перегруженного Dashboard.

---

# 40. DESIGN DOCUMENT

Создать canonical design document, например:

`docs/architecture/dashboard-command-center-backend-3.1.md`

или repository-equivalent.

Обязательные разделы:

1. Purpose
2. Current State
3. Dependencies
4. Step 3.3 Reuse Contract
5. Users / Permissions
6. Command Center Sections
7. KPI Catalog
8. Period / Comparison
9. Currency / Money
10. Trends
11. Attention / Alerts
12. Drill-Down
13. API Options
14. Selected API Architecture
15. DTO Contract
16. Authorization / Scope
17. Consistency
18. Performance / Query Budget
19. Cache Strategy
20. Empty / Partial / Error Semantics
21. Observability
22. Frontend Consumer Contract
23. Characterization Gaps
24. Test Strategy
25. Implementation Waves
26. Risks / Authority Gaps
27. Non-Goals
28. Acceptance Criteria

---

# 41. DESIGN REPORT

Создать:

`docs/prompts/PHASE_3_STEP_3.1_DASHBOARD_COMMAND_CENTER_BACKEND_DESIGN_REPORT.md`

или canonical equivalent.

Report должен содержать:

- repository state;
- Roadmap contract;
- existing implementation inventory;
- selected architecture;
- KPI selection;
- permissions matrix;
- Step 3.3 reuse matrix;
- API decision;
- query/performance considerations;
- test gaps;
- implementation waves;
- negative checks;
- verdict;
- persistence;
- NEXT.

---

# 42. AUTHORITY GAPS

Все отсутствующие policy decisions явно перечислить.

Примеры:

- company timezone;
- reporting/base currency;
- alert thresholds;
- KPI target values;
- SLA target authority.

Не придумывать значения.

Разделить:

- blocker;
- non-blocking deferred authority.

---

# 43. STEP 2.17B BOUNDARY

Сохранить:

`STEP 2.17B — BLOCKED — EXTERNAL QUALIFICATION ENVIRONMENT`

В Step 3.1 design:

- performance qualification = 0;
- frozen target changes = 0;
- Phase 2 exit claim = 0.

---

# 44. NEGATIVE CHECKS

Финальный report должен явно указать:

- production backend implementation: 0
- frontend implementation: 0
- schema changes: 0
- migrations: 0
- permission changes: 0
- Step 3.3 behavior changes: 0
- new analytics foundation: 0
- money authority changes: 0
- FX implementation: 0
- company timezone invented: 0
- Employee Analytics implementation: 0
- employee scoring: 0
- Step 2.17B changes: 0
- frozen targets changed: 0
- Phase 2 exit claimed: 0
- Step 3.2 implementation: 0
- release: 0

---

# 45. VERDICT A

Если design достаточно определён:

`PHASE 3 STEP 3.1 DASHBOARD / COMMAND CENTER BACKEND DESIGN COMPLETED — READY FOR IMPLEMENTATION`

Условия:

- Roadmap scope verified;
- existing implementation inventoried;
- Step 3.3 reuse explicit;
- KPI set bounded;
- period/comparison contract fixed;
- multi-currency contract fixed;
- RBAC/scope fixed;
- API architecture selected;
- performance/query risks documented;
- test gaps known;
- implementation waves defined;
- no unresolved blocking authority gap.

---

# 46. VERDICT B

Если design почти готов, но есть bounded unresolved issue:

`PHASE 3 STEP 3.1 DASHBOARD / COMMAND CENTER BACKEND DESIGN — REMEDIATION/CLARIFICATION REQUIRED`

Не начинать implementation.

---

# 47. VERDICT C

Если отсутствует необходимая business/architecture authority:

`PHASE 3 STEP 3.1 DASHBOARD / COMMAND CENTER BACKEND DESIGN — AUTHORITY DECISION REQUIRED`

Не придумывать policy.

---

# 48. PERSISTENCE

После design:

- intentional diff;
- `git diff --check`;
- artifact checker;
- checker regression;
- unrelated untracked untouched;
- commit design/report/Roadmap;
- provenance/footer по convention;
- push;
- verify HEAD == upstream;
- tracked worktree clean;
- сообщить реальные SHA.

---

# 49. ROADMAP STATUS

При VERDICT A:

Step 3.1 должен получить статус, семантически эквивалентный:

`DESIGN COMPLETED — READY FOR IMPLEMENTATION`

Но НЕ `APPROVED`, если canonical process требует implementation + Strict Review.

Не начинать implementation автоматически.

---

# 50. NEXT

При VERDICT A:

`NEXT: PHASE 3 — STEP 3.1 — DASHBOARD / COMMAND CENTER BACKEND — IMPLEMENTATION`

Но только как следующий отдельный prompt/pass.

При B/C — NEXT должен соответствовать найденному blocker.

---

# 51. ФОРМАТ ОТВЕТА РАЗРАБОТЧИКА

Все объяснения пользователю — **на русском языке**.

Финальный ответ должен содержать:

- Verdict;
- Step 3.1 status;
- canonical Roadmap scope;
- existing Dashboard inventory;
- selected API architecture;
- Command Center sections;
- selected KPI cards;
- Step 3.3 reuse;
- periods/CUSTOM/comparison;
- multi-currency;
- permissions/partner isolation;
- trends;
- attention/alerts;
- performance/query strategy;
- cache decision;
- characterization gaps;
- implementation waves;
- authority gaps;
- artifact integrity;
- commits/push;
- NEXT.

---

# 52. КЛЮЧЕВОЙ ПРИНЦИП

Step 3.1 не строит аналитику заново.

Архитектура должна быть:

`CANONICAL DOMAIN FACTS`
→
`STEP 3.3 ANALYTICS FOUNDATION`
→
`STEP 3.1 COMMAND CENTER ORCHESTRATION`
→
`STEP 3.2 DASHBOARD UI`

Command Center отвечает на вопрос:

**«Что происходит и где руководителю требуется внимание?»**

Detailed Analytics отвечает на вопрос:

**«Почему это произошло и как показатель ведёт себя в деталях?»**

Эти два уровня не смешивать.
