# TRAVELHUB — PHASE 3 — POST-STEP 3.3 REPOSITORY-FIRST SEQUENCING

> **ЯЗЫК:** все ответы разработчика пользователю, промежуточные статусы и итоговый отчёт — **на русском языке**. Английский допустим для кода, команд, путей, API и канонических статусов.

## 1. Цель

После `PHASE 3 — STEP 3.3 — ANALYTICS FOUNDATION — APPROVED` выполнить **repository-first sequencing pass** и определить один следующий канонический исполнимый шаг Phase 3.

Это `ANALYSIS / RECONCILIATION / SEQUENCING ONLY`. Следующую реализацию автоматически НЕ начинать.

## 2. Baseline — проверить, не принимать на веру

Заявлено:
- Step 3.3: APPROVED;
- Final Strict Re-Review commit: `284ff32`, pushed, HEAD == upstream;
- Step 2.17B: `BLOCKED — EXTERNAL QUALIFICATION ENVIRONMENT`;
- Phase 2 formal exit остаётся blocked.

Final review summary заявляет backend tsc/build, unit 61/802, analytics unit 4/58, analytics e2e 19, full serial e2e 70/1213, frontend tsc/Vitest 135, DB 58/drift 0.

Отдельно проверить persisted evidence для двух hard gates, не указанных явно в кратком summary:
1. **frontend production build**;
2. **artifact integrity + checker regression**.

Если они PASS в final report/evidence — подтвердить полное closure. Если evidence отсутствует — точно зафиксировать gap и определить, нужен ли bounded closure check. Не выдумывать новый статус.

## 3. Repository-first sources

Прочитать фактические:
1. canonical Roadmap v3;
2. Step 3.3 design/addendum;
3. Final Strict Re-Review report;
4. текущие Phase 3 statuses;
5. dependency/sequence notes;
6. Dashboard/Command Center/Analytics backend и frontend;
7. релевантные architecture docs;
8. artifact/provenance state.

Не выбирать NEXT только по номеру шага.

## 4. Не предполагать автоматически Step 3.1

Определить NEXT по:
- dependencies;
- Roadmap;
- уже выполненным шагам;
- блокерам;
- существующему коду;
- потребителям Analytics Foundation;
- business value.

## 5. Phase 3 status matrix

Создать:

| Step | Canonical title | Status | Dependencies | Blocked by 2.17B? | Executable now? | Notes |
|---|---|---|---|---:|---:|---|

Включить фактически существующие ближайшие steps, особенно 3.0–3.3 и следующие Dashboard/Command Center/Analytics/CRM/Employee-or-Staff Analytics/page-navigation steps. Не изобретать номера и названия.

## 6. Dependency graph

Для ближайших candidates определить:

`PREREQUISITES → STEP → CONSUMERS`

Ответить:
- какой step первым потребляет Step 3.3;
- нужен ли Dashboard Backend до UI;
- нужен ли дополнительный analytics API/read-model step;
- существует ли отдельный Command Center step;
- где канонически находится Employee/Staff Analytics;
- где находится page/navigation architecture.

## 7. Dashboard / Command Center readiness

Repository-first определить без реализации:
- какие backend endpoints уже есть;
- какая frontend page уже есть;
- KPI cards;
- period selector;
- comparison;
- charts;
- role-aware data;
- navigation;
- loading/empty/error states;
- placeholders/missing pieces;
- какой Roadmap step имеет authority на продолжение.

## 8. Analytics Foundation consumers

Следующий consumer обязан переиспользовать:
- 7 period presets;
- CUSTOM start/end;
- half-open boundaries;
- timezone;
- comparison;
- granularity;
- Company KPI Summary;
- Partner Performance;
- Conversion Funnel;
- Time Series;
- Financial Reconciliation;
- Actor Attribution;
- multi-currency semantics.

Запрещено создавать параллельные period/money/metric contracts.

## 9. Employee Analytics — placement only

Найти каноническое место в Phase 3 для будущей аналитики сотрудников. Сохранить требования:
- platform activity;
- inactivity duration;
- действия за период;
- business outcomes;
- conversion/productivity/SLA по роли;
- `Activity ≠ Effectiveness`;
- низкая platform activity при высоких результатах не является автоматически плохим сигналом;
- внешняя работа (например телефонные контакты) может объяснять низкую platform activity;
- никаких автоматических дисциплинарных выводов по idle time;
- `Action Attribution ≠ Ownership Attribution ≠ Outcome Attribution`.

Периоды:
- TODAY;
- LAST_3_DAYS;
- LAST_7_DAYS;
- MONTH;
- LAST_6_MONTHS;
- YEAR;
- CUSTOM (`startDate` + `endDate`).

Step 3.3 должен быть foundation. **Employee Analytics сейчас не реализовывать**, если она не является каноническим NEXT.

## 10. Левое меню / страницы — placement only

Найти Roadmap authority для page architecture/design:
- Dashboard/Command Center;
- Analytics;
- Sales;
- Booking;
- Orders;
- Finance;
- CRM;
- Support;
- Marketing;
- Documents;
- Reports;
- Employee/Team analytics;
- Settings/Admin.

Redesign сейчас не выполнять.

## 11. Candidate comparison

Для реально executable candidates:

| Candidate | Dependency readiness | Business value | Foundation value | UI dependency | Risk | Recommendation |
|---|---|---|---|---|---|---|

Canonical dependency имеет приоритет над субъективным business value.

## 12. Executable vs deferred

Явно разделить:
- `EXECUTABLE NOW`;
- `DEFERRED / BLOCKED BY 2.17B`;
- другие blocked steps.

Сохранить `STEP 2.17B — BLOCKED — EXTERNAL QUALIFICATION ENVIRONMENT`. Frozen targets не менять.

## 13. Step 3.3 closure verification

Проверить:
- final report;
- Roadmap status APPROVED;
- backend full regression;
- full serial e2e;
- frontend tsc/Vitest;
- **frontend production build**;
- DB drift 0;
- **artifact checker + checker regression**;
- final commit/push/provenance.

Если всё есть: `STEP 3.3 CLOSURE: COMPLETE`.

Если evidence отсутствует — не скрывать gap.

## 14. Никакой implementation

Запрещено:
- Dashboard code;
- Analytics code;
- Employee Analytics code;
- frontend production changes;
- backend production behavior changes;
- schema/migrations;
- permissions;
- money semantics;
- Step 2.17B changes;
- автоматический старт следующего implementation.

Допустимы только analysis, reconciliation, sequencing report и минимальный Roadmap/provenance sync.

## 15. Выбрать ОДИН canonical NEXT

Формат:

`NEXT: PHASE 3 — STEP X.Y — <CANONICAL TITLE>`

Можно указать `AFTER NEXT`, но не запускать его.

Если перед implementation требуется Design/Readiness — NEXT должен быть именно Design/Readiness.

Если Roadmap противоречив — не угадывать.

## 16. Report

Создать:

`docs/prompts/PHASE_3_POST_STEP_3.3_REPOSITORY_FIRST_SEQUENCING_REPORT.md`

Разделы:
1. Executive Summary
2. Repository State
3. Step 3.3 Closure Verification
4. Phase 3 Current State
5. Phase 3 Status Matrix
6. Dependency Analysis
7. Analytics Foundation Consumers
8. Dashboard / Command Center Readiness
9. Employee Analytics Placement
10. Left-Menu/Page Architecture Placement
11. Executable Candidates
12. Blocked/Deferred Candidates
13. Business-Value Comparison
14. Selected Canonical NEXT
15. Negative Checks
16. Files Changed
17. Persistence
18. Verdict
19. NEXT
20. Repository Evidence

## 17. Negative checks

Явно:
- production backend changes: 0
- frontend changes: 0
- schema changes: 0
- migrations: 0
- permissions changes: 0
- money authority changes: 0
- Analytics Foundation behavior changes: 0
- Employee Analytics implementation: 0
- Dashboard implementation: 0
- left-menu redesign implementation: 0
- Step 2.17B changes: 0
- frozen targets changed: 0
- Phase 2 exit claimed: 0
- next implementation auto-started: 0

## 18. Persistence

Если docs/status изменены:
- intentional diff;
- `git diff --check`;
- unrelated untracked untouched;
- commit;
- push;
- verify HEAD == upstream;
- tracked worktree clean;
- реальные SHA.

Пустые commits не создавать.

## 19. Verdicts

### VERDICT A
`PHASE 3 POST-STEP 3.3 REPOSITORY-FIRST SEQUENCING COMPLETED — NEXT STEP IDENTIFIED`

Указать Step 3.3 closure, canonical NEXT, rationale, prerequisites, blockers, Step 3.3 contracts to reuse и deferred work.

### VERDICT B
`PHASE 3 POST-STEP 3.3 SEQUENCING — PREREQUISITE CLOSURE REQUIRED`

Если есть bounded executable prerequisite.

### VERDICT C
`PHASE 3 POST-STEP 3.3 SEQUENCING — ROADMAP RECONCILIATION REQUIRED`

Если NEXT нельзя определить однозначно.

## 20. Формат ответа разработчика

**Все объяснения — на русском языке.**

Финальный ответ:
- Verdict;
- Step 3.3 closure;
- frontend production build evidence;
- artifact integrity evidence;
- Phase 3 status summary;
- executable candidates;
- blocked candidates;
- Dashboard/Command Center placement;
- Employee Analytics placement;
- left-menu/page architecture placement;
- selected canonical NEXT;
- rationale;
- commits/push;
- NEXT.

## 21. Ключевой принцип

Step 3.3 дал общий аналитический фундамент. Следующие модули не создают собственные правила для:

`PERIOD + CUSTOM RANGE + COMPARISON + GRANULARITY + MONEY + CURRENCY + ATTRIBUTION + AUTHORIZATION`.

Sequencing должен определить **первого правильного потребителя Analytics Foundation по canonical Roadmap**, а не просто наиболее привлекательную функцию.
