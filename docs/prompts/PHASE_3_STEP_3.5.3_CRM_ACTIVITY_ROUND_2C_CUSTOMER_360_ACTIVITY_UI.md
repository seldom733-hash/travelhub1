# PHASE 3 — STEP 3.5.3 — PLATFORM CRM
## CRM COMMUNICATIONS + ACTIVITY TIMELINE
## ROUND 2C — CUSTOMER 360 ACTIVITY UI

**Финальный отчёт и ответ — на русском.**

## 1. Цель
Реализовать production-ready **Activity Timeline UI для Customer 360** поверх уже закрытых Architecture, Round 2A read-model foundation и Round 2B Activity API/RBAC.

```text
Round 1  — Architecture                         ✅ CLOSED
Round 2A — Read Model + Migration + Adapters    ✅ CLOSED
Round 2B — Activity API + RBAC + Cursor         ✅ CLOSED
Round 2C — Customer 360 Activity UI             ⏭ CURRENT
Round 2D — Partner 360 Activity UI              ⬜ NOT STARTED
Round 2E — Runtime/Security Final Closure       ⬜ NOT STARTED
```

Не начинать Round 2D/2E.

## 2. Repository-first
Перед изменениями:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -100
git diff
git diff --check
```
Исторические milestones `2b0438a` и `227c9e6` должны быть проверены на reachable, но **не считать их текущим HEAD** и не откатывать более новые legitimate commits.

Зафиксировать Repository, Branch, Starting HEAD, origin/master, Worktree.

## 3. Pre-flight Round 2B
До UI подтвердить в actual repository:
- Customer Activity endpoint;
- `crm.activity.read`;
- source-specific item authority;
- cursor contract;
- server-side filters;
- `occurredAt DESC, id DESC`;
- Customer subject authority;
- relevant unit/E2E.

Ожидаются repository equivalents `queryCustomerActivity()`, dual-subject matching, cursor validation 400 и RBAC E2E, но source code является authority.

Если Round 2B реально отсутствует/не завершён — STOP / VERDICT B. Не заменять backend frontend-агрегацией.

## 4. Architecture invariants
Сохранить:
```text
CrmActivity = denormalized read model
Customer History → MIGRATE into Activity
pagination = cursor
ordering = occurredAt DESC, id DESC
RBAC = crm.activity.read + source-specific per-item authority
channels = PLATFORM only
composer = NONE in Activity v1
timestamps = canonical business timestamps
```
Не вводить generic `createdAt` fallback.

## 5. Customer 360 IA
В Customer 360 создать/довести canonical tab:
```text
Activity / Активность / Fəaliyyət
```
Legacy History должен быть reconciled согласно архитектуре. Не оставлять два конкурирующих canonical timeline — History + Activity.

Сначала проверить, есть ли в legacy History уникальные actions/data. Ничего молча не потерять.

## 6. Canonical data flow
Только:
```text
Customer 360
→ Customer Activity API
→ CrmActivity read model
→ backend RBAC filtering
→ cursor page
→ timeline UI
```
Запрещено frontend-собирать timeline отдельными запросами Orders/Bookings/Payments/Refunds/Notes/Messages/Audit/etc.

## 7. Frontend API types
Типизировать actual backend contract: activity item/page/cursor/source/event/filter types. Не использовать `any`, если форма известна. Route Customer ID — единственный subject input; UI не может подменять subjectType/customerId/partnerId.

## 8. Activity UI
Минимум:
- tab title;
- filter bar;
- timeline;
- source/event labels;
- primary description;
- meaningful metadata;
- timestamp;
- Load more/cursor control;
- loading;
- empty;
- forbidden;
- error.

Не рендерить debug JSON/raw enum UI.

## 9. Cursor pagination
Использовать только Round 2B cursor. Не `page=`, offset или client slicing.

При Load more:
```text
existing + next
no duplicates
same Customer
same filters
backend ordering preserved
```
Frontend не пересортировывает результаты.

При изменении filter:
```text
reset cursor
clear accumulated later pages
load first page
```

## 10. Server-side filters
Использовать **только actual supported API filters**. Проверить DTO. Возможные architecture filters: sourceType, eventType, dateFrom/dateTo — но не добавлять неподдерживаемое.

Каждый filter: localized UI → canonical API value → server filtering → cursor reset.

## 11. Sources
Architecture source set сверить с implementation:
```text
OperationalNote
Order
Booking
Payment
Refund
Message
Audit
CustomerHistory
BuyerRequest
PartnerApplication
```
Не выдумывать отсутствующие enum values.

Source filter и source labels локализовать RU/AZ/EN.

## 12. Event semantics
Known event types должны иметь human-readable RU/AZ/EN labels, а не `ORDER_CREATED`, `PAYMENT_CAPTURED` и т.п. Использовать actual bounded event set.

Предпочтительно centralized mapping:
```text
sourceType → i18n key
eventType  → i18n key
```
Unknown event не должен crash UI.

## 13. Source-aware rendering
Для каждого canonical source реализовать renderer/representation:
| Source | Event(s) | Primary text | Metadata | Navigation |
|---|---|---|---|---|
| OperationalNote | | | | |
| Order | | | | |
| Booking | | | | |
| Payment | | | | |
| Refund | | | | |
| Message | | | | |
| Audit | | | | |
| CustomerHistory | | | | |
| BuyerRequest | | | | |
| PartnerApplication | | | | |

Если runtime sample отсутствует: `IMPLEMENTED / NO RUNTIME SAMPLE`, а не fake proof.

## 14. Timestamp authority
Display `occurredAt`, locale-aware. Не `occurredAt ?? createdAt`. Сохранить timezone conventions проекта.

## 15. RBAC
Критично:
```text
crm.activity.read
+
backend source-specific per-item authorization
```
Frontend не реконструирует скрытые items, не показывает hidden-source counts/metadata и не считает наличие page permission правом на все sources.

Без `crm.activity.read` tab скрыть или показать forbidden согласно существующему Customer 360 pattern.

## 16. Filters and leakage
Source filter не должен раскрывать protected data. Если static options используются, выбор denied source не должен раскрывать existence/count/content запрещённых events. Решение описать в report.

## 17. Navigation
Activity item может ссылаться на existing detail route только если:
- route реально существует;
- actor имеет соответствующий доступ;
- link не раскрывает hidden data.
Нет detail surface → no link.

## 18. Notes and communications
OperationalNote в Activity — read-only event. CRUD остаётся в Operational Notes UI.

Не добавлять:
- message composer;
- email/WhatsApp/phone integrations;
- omnichannel claims;
- “Add activity”.

## 19. I18N
Полностью RU/AZ/EN:
- tab;
- filters;
- All;
- source/event labels;
- dates;
- Load more;
- loading/empty/forbidden/error;
- metadata labels.

Запрещены hardcoded RU, raw keys, mixed locale, raw known enums.

## 20. Safety / UX
User-generated text — escaped React text, no `dangerouslySetInnerHTML`.

Проверить long text/codes/names и RU/AZ label lengths. Использовать wrap/truncate/line-clamp по existing design conventions.

## 21. State boundaries
Обязательно:
```text
200 + items → data
200 + []    → empty
403         → forbidden
5xx/network → error
```
Initial loading ≠ empty. Load-more error не должен без необходимости уничтожать уже загруженные items.

## 22. Race / dedupe
Быстрая смена filters/tab не должна позволять stale response перезаписать новый state. Double Load more не должен append duplicate items.

Runtime cursor proof:
```text
page1 IDs
page2 IDs
intersection = empty
```

## 23. Responsive / a11y
Проверить desktop + narrow desktop/tablet-like width. Semantic buttons, labels, keyboard Load more, focus behavior, aria-label для icon-only controls.

## 24. URL state
Следовать существующему Customer 360 tab URL contract. Если tabs уже сохраняются в URL — Activity тоже. Не создавать отдельную несовместимую URL architecture.

## 25. Performance
Expected:
```text
1 Activity API request per timeline page
NO per-item N+1 fetch
```
Если API вынуждает N+1 — finding, не скрывать.

## 26. No business mutation
Просмотр/filter/load Activity не меняет Customer/Order/Booking/Payment/Refund/Note statuses или business dates.

## 27. Frontend tests
Добавить focused coverage:
- Activity tab;
- loading/data/empty/403/error;
- source/event localization;
- filter request mapping;
- cursor append;
- filter cursor reset;
- duplicate prevention;
- RBAC visibility;
- RU/AZ/EN critical labels;
- safe rendering.

## 28. Backend regression
Запустить existing CRM Activity tests/E2E и сохранить:
- Customer happy path;
- 401/403;
- cursor duplicate prevention;
- source/date filters;
- cross-subject isolation;
- limit validation.

## 29. API runtime proof
На actual dataset:
- first page;
- next cursor;
- source filter;
- date filter if supported;
- unauthorized.

Зафиксировать Customer ID, role, query, HTTP, item count, cursor, boundary IDs. Не публиковать token/secrets.

## 30. Browser runtime proof
Actual Customer 360:
- Activity tab;
- legacy History reconciliation;
- rendered items;
- human-readable sources/events;
- correct timestamps;
- filters;
- Load more;
- no duplicates;
- empty/forbidden/error boundaries where testable;
- RU/AZ/EN.

Source inspection ≠ browser proof.

## 31. Runtime source coverage
Перечислить actual PRESENT/ABSENT source types. Не создавать fake business data ради покрытия всех 10, но renderer должен поддерживать canonical types.

## 32. Recent UX smoke regression
Только smoke:
```text
Orders headers                     PASS expected
Orders/Bookings Refresh            PASS expected
Orders/Bookings KPI                PASS expected
Customer Partners headers          PASS expected
Customer Refund filter             PASS expected
Users full i18n                    PASS expected
Users live search / no Find        PASS expected
Operational Notes Customer         PASS expected
Operational Notes Partner          PASS expected
```
Если реально сломано — исправить/report.

## 33. Required matrices

### Acceptance
| Area | Requirement | Evidence | Status |
|---|---|---|---|
| API | canonical Customer endpoint | | |
| Subject | route/server authority | | |
| RBAC | crm.activity.read | | |
| RBAC | source item authority | | |
| Pagination | cursor | | |
| Filters | server-side | | |
| Ordering | occurredAt DESC/id DESC | | |
| History | reconciled | | |
| I18N | RU/AZ/EN | | |
| States | loading/empty/403/error/data | | |
| Security | no source leakage | | |
| UX | responsive/a11y | | |

### API Runtime
| Scenario | Role | Query | HTTP | Items | Cursor | Status |
|---|---|---|---:|---:|---|---|
| First page | | | | | | |
| Next cursor | | | | | | |
| Source filter | | | | | | |
| Date filter | | | | | | |
| Unauthorized | | | | N/A | N/A | |

### Browser
| Scenario | RU | AZ | EN | Status |
|---|---:|---:|---:|---|
| Activity tab | | | | |
| Filters | | | | |
| Source labels | | | | |
| Event labels | | | | |
| Timeline items | | | | |
| Load more | | | | |
| Empty | | | | |
| Forbidden boundary | | | | |

No blank applicable rows.

## 34. Regression gates
Minimum:
```text
Backend TSC
Backend build
crm-activity unit tests
crm-activity RBAC E2E
Frontend TSC
Frontend build
Frontend tests
Operational Notes relevant regression
```
Report actual counts. Failures classify as ROUND_2C_REGRESSION / PRE_EXISTING / ENVIRONMENTAL / FLAKY with evidence.

## 35. Roadmap
После успешного Round 2C, если canonical workflow требует status update:
```text
Round 2C — Customer 360 Activity UI ✅ CLOSED (<SHA>)
Round 2D — Partner 360 Activity UI  ⏭ NEXT
```
Не закрывать весь Step 3.5.3.

## 36. Report
Создать:
```text
docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2C_CUSTOMER_360_ACTIVITY_UI_REPORT.md
```
На русском.

## 37. Git discipline
```bash
git diff --check
git status --short
git diff
```
Stage exact files only. Не `git add .` / `git add -A`. Normal push, never force-push. После push проверить HEAD == upstream.

## 38. Acceptance criteria
VERDICT A только если:
1. Round 2B contract verified.
2. Canonical Customer Activity API used.
3. No frontend multi-source aggregation.
4. Subject route/server authoritative.
5. Activity tab integrated.
6. Legacy History reconciled without duplicate canonical timelines.
7. Page + item RBAC preserved.
8. No hidden-source leakage.
9. Cursor pagination used; no offset/client slicing.
10. Ordering preserved.
11. Append has no duplicates.
12. Filter change resets cursor.
13. Supported filters are server-side.
14. Source/event labels localized RU/AZ/EN.
15. Known enums not raw.
16. `occurredAt` canonical timestamp.
17. Source-aware renderer implemented.
18. Runtime source coverage reported honestly.
19. No N+1.
20. Notes remain read-only in Activity.
21. No composer/unsupported omnichannel.
22. XSS-safe.
23. Long content stable.
24. Loading/empty/403/error/data distinct.
25. 200[]/403/5xx boundaries proven.
26. Responsive/a11y acceptable.
27. Existing URL tab contract preserved.
28. Race/stale responses safe.
29. Frontend focused tests pass.
30. CRM Activity unit/E2E pass.
31. Backend TSC/build pass.
32. Frontend TSC/build/tests pass.
33. Operational Notes regression pass.
34. Recent UX smoke passes.
35. No business-state mutation.
36. No Round 2D/2E implementation.
37. Report/matrices complete.
38. `git diff --check` clean.
39. committed + pushed.
40. HEAD == origin/master.
41. No unresolved P0/P1.
42. Verdict based on actual API + browser runtime evidence.

## 39. Final response — strictly Russian
```text
VERDICT:

РЕПОЗИТОРИЙ
Repository:
Branch:
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
Worktree:

PRE-FLIGHT ROUND 2B
...

CUSTOMER 360 INFORMATION ARCHITECTURE
Previous History:
Activity tab:
Final tab model:

IMPLEMENTATION
API client:
Components:
Filters:
Cursor:
Rendering:
I18N:

RBAC / SECURITY
...

SOURCE RENDERING MATRIX
...

API RUNTIME MATRIX
...

BROWSER RUNTIME MATRIX
...

STATE BOUNDARIES
...

CURSOR PROOF
...

PERFORMANCE
...

REGRESSION
...

FILES CHANGED
...

Schema changed:
Migration changed:
Backend production changed:
Frontend production changed:

ROADMAP
Round 2C:
Next:

Report:
Commit:

ОСТАВШИЕСЯ FINDINGS
P0:
P1:
P2:

NEXT:
```

## 40. Verdict rule
Success only:
```text
VERDICT A — PHASE 3 STEP 3.5.3 PLATFORM CRM /
CRM COMMUNICATIONS + ACTIVITY TIMELINE /
ROUND 2C — CUSTOMER 360 ACTIVITY UI /
CURSOR PAGINATION + SERVER-SIDE FILTERS +
SOURCE-AWARE RENDERING + RBAC + RU/AZ/EN +
RUNTIME UX AUTHORITY /
FULLY IMPLEMENTED AND VERIFIED
```

Otherwise:
```text
VERDICT B — PHASE 3 STEP 3.5.3 PLATFORM CRM /
CRM ACTIVITY ROUND 2C /
CUSTOMER 360 ACTIVITY UI INCOMPLETE
```

## 41. STOP
После implementation + tests + API/browser runtime proof + report + roadmap update if required + commit + push — **STOP**.

Не начинать `ROUND 2D — PARTNER 360 ACTIVITY UI` без отдельного задания.
