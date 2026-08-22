# TRAVELHUB — PHASE 3 — REPOSITORY-FIRST SEQUENCING AFTER GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION APPROVAL

> **ОБЯЗАТЕЛЬНЫЙ ЯЗЫК**
>
> Все ответы разработчика пользователю, промежуточные статусы, пояснения, findings и итоговый summary должны быть **на русском языке**.
>
> Английский допускается только для кода, команд, путей, API routes, identifiers и канонических технических статусов.

---

# 1. ЦЕЛЬ

Выполнить короткий repository-first sequencing после официального:

`PHASE 3 GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION STRICT REVIEW COMPLETED — APPROVED`

и определить **следующий канонический исполнимый шаг Phase 3**.

Ожидаемый кандидат:

`PHASE 3 — STEP 3.2 — DASHBOARD / COMMAND CENTER UI`

Но **не принимать это предположение без проверки Roadmap и repository state**.

Этот проход — только sequencing/reconciliation.

**Никакую production implementation автоматически не начинать.**

---

# 2. ТЕКУЩИЙ ПОДТВЕРЖДЁННЫЙ BASELINE

Зафиксировать repository-first текущий статус минимум следующих элементов:

- Step 3.1 — Dashboard / Command Center Backend: `APPROVED`;
- Step 3.3 — Analytics Foundation: `APPROVED`;
- Global Workspace Constructor Architecture Addendum: completed;
- Global Workspace Constructor Foundation: `APPROVED`;
- Step 2.17B: `BLOCKED — EXTERNAL QUALIFICATION ENVIRONMENT`;
- Phase 2 formal exit: blocked only согласно актуальному Roadmap/evidence;
- independent Phase 3 work: разрешена согласно canonical sequencing.

Проверить actual HEAD/upstream/worktree и последние relevant commits.

Известные commits для reconciliation:

- `c71dec1` — Workspace Constructor implementation;
- `357923f` — Workspace Constructor Strict Review APPROVED;
- `f42c3a5` — Roadmap/status update.

Не полагаться только на эти SHA — проверить фактический repository state.

---

# 3. WIDGET BASELINE

Зафиксировать исправленный фактический baseline:

```text
Widget Registry = 30 widgets
```

а не 29.

Strict Review reconciliation:

```text
18 Command Center widgets
+ 12 stubs / future workspace widgets
= 30 total
```

Все будущие prompts/docs должны использовать repository-confirmed число.

Не исправлять production code в этом sequencing pass.

---

# 4. MEDIUM / LOW FINDINGS

Проверить disposition неблокирующих findings Strict Review:

- MEDIUM: report ранее указывал 29 вместо фактических 30 widgets;
- MEDIUM: misleading controller comment;
- LOW: required-widget restoration efficiency.

Определить:

- требуют ли они отдельной remediation до Step 3.2;
- могут ли быть safely deferred;
- куда они должны быть записаны как technical debt/follow-up.

**Не создавать remediation автоматически**, если findings действительно non-blocking.

---

# 5. ROADMAP-FIRST NEXT STEP

Прочитать актуальный canonical Roadmap и определить:

1. какой Phase 3 step следует после текущего approved foundation;
2. есть ли обязательный промежуточный step/substep;
3. есть ли dependency, блокирующая Step 3.2;
4. требует ли Step 3.2 сначала отдельного Design/UI Contract;
5. влияет ли новый Workspace Constructor Foundation на canonical Step 3.2 scope.

---

# 6. STEP 3.2 DEPENDENCY CHECK

Если Roadmap указывает Step 3.2 как следующий кандидат, проверить prerequisites:

| Dependency | Expected |
|---|---|
| Step 3.1 Dashboard Backend | APPROVED |
| Step 3.3 Analytics Foundation | APPROVED |
| Workspace Constructor Architecture | READY |
| Workspace Constructor Foundation | APPROVED |
| Period/CUSTOM contract | READY |
| RBAC `analytics.read` | READY |
| Multi-currency semantics | READY |
| Partner isolation | READY |
| Command Center API | READY |
| Trends API | READY |

Выдать фактический PASS/BLOCKED для каждого.

---

# 7. STEP 2.17B BOUNDARY

Не позволять Step 2.17B искусственно блокировать независимый UI scope, если Roadmap этого не требует.

Одновременно:

- не объявлять Phase 2 formally exited;
- не менять Step 2.17B status;
- не проводить performance qualification;
- не менять frozen targets.

---

# 8. STEP 3.2 EXPECTED ROLE

Если dependencies подтверждены, Step 3.2 должен стать:

**первым визуальным consumer**:

- Step 3.1 Dashboard backend;
- Step 3.3 Analytics Foundation;
- Global Workspace Constructor Foundation.

То есть Step 3.2 не должен создавать новые backend business authorities.

---

# 9. НЕ ПУТАТЬ STEP 3.2 С КОНСТРУКТОРОМ ЦЕЛИКОМ

Workspace Constructor Foundation уже global.

Step 3.2 должен **использовать** его для Command Center.

Не создавать:

`Dashboard-specific constructor`.

---

# 10. STEP 3.2 DESIGN BEFORE IMPLEMENTATION

Repository-first определить, требуется ли перед implementation отдельный:

`STEP 3.2 — DASHBOARD / COMMAND CENTER UI — DESIGN & UX CONTRACT`

Если Roadmap допускает/предполагает design-first, выбрать именно этот путь.

Предпочтительная последовательность:

```text
Step 3.2 Design / UX Contract
→ Step 3.2 Implementation
→ Step 3.2 Strict Review
```

Но sequencing должен подтвердить это по repository authority.

---

# 11. DEFAULT COMMAND CENTER LAYOUT

Зафиксировать как обязательный вопрос будущего Step 3.2 Design:

**не выводить механически все доступные widgets на один экран.**

Нужно определить curated default layout.

Design должен разделить:

- default-visible;
- optional;
- required;
- hidden-by-default.

---

# 12. 18 COMMAND CENTER WIDGETS

Repository-first подтвердить фактические 18 Command Center widgets из общего registry 30.

В sequencing report перечислить их IDs либо сослаться на точный registry evidence.

Не считать 12 future stubs частью default Command Center.

---

# 13. 21 BACKEND KPI VS 18 WIDGETS

Зафиксировать для Step 3.2 Design:

```text
21 Step 3.1 backend KPI
≠ 21 cards
≠ 18 widgets necessarily visible simultaneously
```

Нужно определить presentation mapping:

```text
backend metric
→ widget
→ section
→ visualization
→ default/optional
```

---

# 14. COMMAND CENTER USER

Будущий Step 3.2 Design должен repository-first определить primary personas.

Минимально проверить:

- DIRECTOR;
- ADMIN;
- FINANCE;
- ANALYST;
- PARTNER, если Command Center доступен partner scope.

Не придумывать доступ без RBAC evidence.

---

# 15. DIRECTOR DEFAULT LAYOUT

Если DIRECTOR — canonical consumer, будущий Design должен отдельно определить его default layout.

Не создавать сейчас окончательный UX.

Но sequencing report должен отметить это как mandatory design deliverable.

---

# 16. INFORMATION HIERARCHY

Будущий Step 3.2 Design должен решить, какие данные отображаются как:

- KPI cards;
- trend charts;
- financial status;
- funnel;
- alerts/attention;
- tables/lists;
- secondary details.

Не превращать Dashboard в «стену карточек».

---

# 17. PERIOD SELECTOR

Step 3.2 должен визуально использовать Step 3.3 period contract:

- TODAY;
- LAST_3_DAYS;
- LAST_7_DAYS;
- MONTH;
- LAST_6_MONTHS;
- YEAR;
- CUSTOM.

CUSTOM обязательно должен иметь:

- start date;
- end date.

---

# 18. COMPARISON

Будущий UI должен отображать comparison корректно и не изобретать собственную period/comparison semantics.

---

# 19. TIMEZONE

UI должен использовать backend/analytics timezone contract.

Не создавать новую timezone authority во frontend.

---

# 20. MULTI-CURRENCY

Будущий Command Center не должен показывать fake aggregate:

```text
USD + EUR + AZN
```

Финансовые widgets должны соблюдать Step 3.3 currency-separated semantics.

---

# 21. CUSTOMIZE MODE

Step 3.2 должен стать первым реальным consumer:

- `useWorkspaceLayout`;
- `useWorkspaceCustomize`;
- effective layout API;
- Widget Registry;
- Page Registry.

Design должен определить UX:

```text
View Mode
↔
Customize Mode
```

---

# 22. CONSTRUCTOR ENABLE/DISABLE

Для Command Center текущий canonical state:

`constructorEnabled = true`

— подтвердить repository-first.

UI должен скрывать customize controls, если backend policy когда-либо вернёт disabled.

---

# 23. DRAG/DROP

Design baseline:

- desktop: allowed;
- tablet/mobile: not required / disabled согласно architecture;
- keyboard accessibility должна быть предусмотрена.

Не выбирать библиотеку без package/repository review.

---

# 24. RESIZE

Будущий Design должен учитывать registry constraints:

- min size;
- max size;
- resizable;
- required;
- movable.

---

# 25. RESPONSIVE

Baseline:

```text
Desktop = 12 columns
Tablet = 8 columns
Mobile = 4 columns
```

Step 3.2 Design должен определить реальное поведение карточек/графиков/таблиц на breakpoints.

---

# 26. PAGE-LEVEL DATA AGGREGATION

Hard requirement для Step 3.2:

не создавать per-widget API fan-out.

Переиспользовать:

```text
GET /api/v1/dashboard/command-center
GET /api/v1/dashboard/command-center/trends
```

и Workspace APIs.

---

# 27. REQUIRED WIDGET

Будущий UI обязан корректно представить required widget semantics.

Required widget:

- не удаляется;
- может иметь ограничения move/resize;
- не обходится RBAC.

---

# 28. RBAC

Step 3.2 не может использовать frontend visibility как security boundary.

Backend authority остаётся canonical.

---

# 29. PARTNER ISOLATION

Если PARTNER получает Command Center variant, UI должен работать только с canonical partner-scoped backend response.

Никакого client-side trust к `partnerId`.

---

# 30. EMPTY / LOADING / ERROR

Будущий Step 3.2 Design обязан определить:

- loading;
- empty;
- partial;
- error;
- forbidden;
- no-data;
- widget unavailable.

---

# 31. ACCESSIBILITY

Будущий Design должен включать:

- keyboard navigation;
- focus states;
- screen-reader labels;
- non-drag alternative для reordering;
- accessible period/custom date controls.

---

# 32. VISUAL CHANGE EXPECTATION

Если Step 3.2 подтверждён как NEXT, sequencing report должен явно сказать:

**именно Step 3.2 Implementation станет этапом, где пользователь увидит существенные визуальные изменения на сайте.**

---

# 33. EMPLOYEE ANALYTICS

Не включать Employee Analytics в Step 3.2.

Но Workspace Constructor должен оставаться future-compatible с будущими employee/team widgets.

---

# 34. OMNICHANNEL / SOCIAL

Не включать в Step 3.2:

- Instagram;
- Facebook;
- TikTok;
- Omnichannel Inbox;
- External Contact;
- Social Identity.

Это отдельный будущий CRM/Communications scope.

---

# 35. MARKETPLACE / SELLER STOREFRONT

Не менять в Step 3.2 commercial/channel architecture:

- TravelHub Marketplace;
- Seller Storefront;
- commission model;
- subscription model.

---

# 36. SEQUENCING REPORT

Создать:

`docs/prompts/PHASE_3_POST_WORKSPACE_CONSTRUCTOR_FOUNDATION_SEQUENCING_REPORT.md`

Обязательные разделы:

1. Executive Summary
2. Repository Baseline
3. Current Phase 3 State
4. Workspace Constructor Approval
5. Widget Count Reconciliation
6. Non-blocking Findings Disposition
7. Roadmap NEXT Analysis
8. Step 3.2 Dependency Matrix
9. Step 2.17B Boundary
10. Step 3.2 Expected Scope
11. Step 3.1 Reuse
12. Step 3.3 Reuse
13. Workspace Constructor Reuse
14. Command Center Widget Baseline
15. 21 KPI vs 18 Widget Distinction
16. Required Step 3.2 Design Decisions
17. Visual Implementation Boundary
18. Deferred Scope
19. Negative Checks
20. Artifact Integrity
21. Persistence
22. Verdict
23. NEXT
24. Repository Evidence

---

# 37. NEGATIVE CHECKS

В sequencing pass:

- production backend changes: 0
- production frontend changes: 0
- schema changes: 0
- migrations: 0
- new permissions: 0
- new widgets: 0
- widget behavior changes: 0
- Step 3.1 changes: 0
- Step 3.3 changes: 0
- Step 3.2 implementation: 0
- Employee Analytics: 0
- Omnichannel: 0
- Step 2.17B changes: 0
- release: 0

---

# 38. ARTIFACT INTEGRITY

Выполнить:

- artifact checker;
- checker regression;
- `git diff --check`.

Сообщить реальные результаты.

---

# 39. VERDICT A — STEP 3.2 CONFIRMED

Если Roadmap и dependencies подтверждают:

`PHASE 3 POST-WORKSPACE-CONSTRUCTOR SEQUENCING COMPLETED — STEP 3.2 CONFIRMED`

И:

`NEXT: PHASE 3 — STEP 3.2 — DASHBOARD / COMMAND CENTER UI — DESIGN & UX CONTRACT`

Условия:

- Step 3.1 APPROVED;
- Step 3.3 APPROVED;
- Workspace Constructor APPROVED;
- Step 3.2 не зависит от blocked 2.17B;
- mandatory prerequisites satisfied;
- no higher-priority canonical step;
- no blocking constructor finding.

---

# 40. VERDICT B — OTHER NEXT STEP

Если Roadmap указывает другой обязательный step:

`PHASE 3 SEQUENCING COMPLETED — DIFFERENT CANONICAL NEXT IDENTIFIED`

Указать точный step и evidence.

Не форсировать Step 3.2.

---

# 41. VERDICT C — BLOCKED

Если Step 3.2 имеет реальный unresolved prerequisite:

`PHASE 3 STEP 3.2 — BLOCKED BY CANONICAL PREREQUISITE`

Указать exact blocker.

---

# 42. ROADMAP UPDATE

Минимально обновить Roadmap только если sequencing result требует status/NEXT reconciliation.

Не менять business scope.

---

# 43. PERSISTENCE

После sequencing:

- сохранить report;
- минимальный Roadmap/provenance update;
- `git diff --check`;
- commit;
- push;
- verify HEAD == upstream;
- tracked worktree clean;
- unrelated untracked untouched;
- сообщить SHA.

---

# 44. НЕ НАЧИНАТЬ STEP 3.2 АВТОМАТИЧЕСКИ

Даже при VERDICT A остановиться после sequencing.

Не создавать UI production code.

Следующий отдельный prompt:

`PHASE 3 — STEP 3.2 — DASHBOARD / COMMAND CENTER UI — DESIGN & UX CONTRACT`

---

# 45. ФОРМАТ ФИНАЛЬНОГО ОТВЕТА

Ответ разработчика полностью **на русском языке**.

Обязательно сообщить:

- Verdict;
- canonical NEXT;
- Step 3.1 status;
- Step 3.3 status;
- Workspace Constructor status;
- фактические 30 widgets;
- 18 Command Center + 12 stubs reconciliation;
- disposition 2 MEDIUM + 1 LOW;
- Step 3.2 dependency matrix;
- Step 2.17B impact;
- нужен ли Step 3.2 Design first;
- какие обязательные UI decisions должны быть приняты;
- artifact integrity;
- commits/push;
- NEXT.

---

# КЛЮЧЕВОЙ ВОПРОС

Этот проход должен дать однозначный repository-backed ответ:

```text
МОЖЕМ ЛИ МЫ ТЕПЕРЬ ПЕРЕЙТИ
К ПРОЕКТИРОВАНИЮ ВИЗУАЛЬНОГО
DASHBOARD / COMMAND CENTER?
```

Если ответ `YES`, следующий шаг:

```text
PHASE 3 — STEP 3.2
DASHBOARD / COMMAND CENTER UI
DESIGN & UX CONTRACT
```

а последующая Step 3.2 Implementation станет первым этапом, где новый Command Center будет **непосредственно виден на сайте**.
