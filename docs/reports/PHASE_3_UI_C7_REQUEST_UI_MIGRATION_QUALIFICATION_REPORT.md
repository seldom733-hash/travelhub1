# PHASE 3 — UI-C7 — REQUEST UI MIGRATION
## QUALIFICATION REPORT

**Stage:** UI-C7 — Request UI Migration (Implementation → Qualification → Report → Git Closure)
**Language:** Russian
**Дата:** 2026-09-08
**Audit baseline:** `76c69e94491bc96c3f6366c9178ceca34db435b1`
**Governing audit:** `docs/reports/PHASE_3_UI_C7_REQUEST_UI_MIGRATION_AUDIT_FIRST_MAPPING_REPORT.md` (VERDICT A — AUDIT READY)

---

# 1. Executive Summary

UI-C7 выполнен строго в объёме audit-approved scope: 4 MUST + 3 SHOULD, ноль backend изменений, ноль нарушений MUST NOT.

Request Detail мигрирован на canonical action placement (header `actions`-слот через новый `RequestActionBar`), локальные UI-примитивы (`btn`/`TONES`/`InfoRow`) и мёртвый client-permission код удалены, loading/error/not-found выровнены с Order/Booking паттерном, propose-price input получил accessible name.

Вся server-authority (UI-C6 contract), бизнес-семантика, API/DTO, permissions, lifecycle — неизменны и подтверждены тестами + runtime.

```text
VERDICT A — ACCEPTED
```

# 2. Baseline

```text
git rev-parse HEAD          → 76c69e94491bc96c3f6366c9178ceca34db435b1
git rev-parse origin/master → 76c69e94491bc96c3f6366c9178ceca34db435b1
tracked working tree        → CLEAN (до implementation)
git diff --check            → PASS
```

# 3. Implementation Scope

Реализовано ровно по audit §15:

**MUST:** (1) actions → header slot через `RequestActionBar`; (2) удалены `btn()`+`TONES`; (3) удалён `InfoRow` alias → прямой `EntityField` (26 замен); (4) удалён мёртвый `canEdit`/`useCan`.

**SHOULD:** (5) loading/error/not-found → centered pattern + `crm.back_to_list`; (6) breadcrumbs literal `|| "Заявки"` удалён; (7) propose-input `aria-label`.

**Decisions (audit §22, подтверждены промптом §8–9):** destructive confirm НЕ добавлен (семантика Request-flow сохранена); propose-price остался inline toggle (без modal/drawer).

# 4. Files Changed

```text
frontend/app/app/requests/[id]/page.tsx        (modified) — header actions slot; удалены
                                                            btn/TONES/InfoRow/canEdit; centered
                                                            states; breadcrumb cleanup; runPost
                                                            теперь возвращает boolean (propose UX)
frontend/components/request/RequestActionBar.tsx (new)      — canonical header action bar
frontend/lib/commerce-detail-system.spec.tsx   (modified) — C6-guard literal обновлён на typed
                                                            contract + 8 новых C7 тестов
docs/reports/PHASE_3_UI_C7_REQUEST_UI_MIGRATION_QUALIFICATION_REPORT.md (new) — этот отчёт
```

Backend: **NO CHANGES**. Order/Booking: не тронуты. Debt Register/roadmap/prompts/`.gitignore`: не тронуты.

# 5. Canonical UI Migration

- Shell unchanged: `EntityDetailShell` → `EntityDetailHeader` → `EntityDetailLayout` (Main/Aside/Wide);
- Actions relocated: legacy inline MAIN `EntitySectionCard «ДЕЙСТВИЯ»` (бывш. L286–401) удалён; рендер теперь в `EntityDetailHeader actions={user ? <RequestActionBar …/> : null}` — DOM-позиция подтверждена runtime (см. §16);
- Shared primitives: `CommerceRelationChain`, `EntityTimeline`, `OperationalNotes`, `EntityAuditHistory` — не тронуты; Wide-слоты в прежнем порядке relations → notes → audit;
- Request-specific content сохранён полностью: Overview/Supplier/Customer/Rejection cards, `ProgressBadge`, converted payments/refunds, D5 conversion context, timeline, «Связанного заказа нет» empty state (runtime snapshot подтверждает все секции).

# 6. Request Action Bar

`frontend/components/request/RequestActionBar.tsx` (new):

- Принимает typed `RequestAvailableActions`; visibility определяется **только** булевыми полями проекции — статус/permissions не инспектируются (spec-assertions: no `RequestStatus`, no `r.status`, no `useCan`, no `granted` в исходнике компонента);
- Все 7 действий: `confirm-price`, propose (inline toggle+input), `reject`, `unavailable`, `customer-accept`, `customer-decline`, `convert` — ни одно не исключено из контракта;
- Busy-семантика сохранена (`busyAction !== null` блокирует параллельный запуск; label `reqflow.busy` во время выполнения);
- Локализация: существующие ключи `reqflow.*`/`requests.*` — словари НЕ изменялись;
- Propose UX: inline toggle сохранён; валидация (`requests.price_invalid`) и закрытие после успешного post — поведение идентично до-миграционному; input получил `aria-label`;
- Empty-area omission: без actionable actions компонент рендерит `null` (каноническое правило R2);
- Групповые метки: `reqflow.supplier_actions` / `reqflow.customer_actions` / `reqflow.converted_hint` (компактная 10px uppercase-версия той же канонической семантики).

# 7. API / Server Authority Preservation

- `GET /api/v1/requests/:id` — без изменений; фронт потребляет `r.availableActions ?? {all:false}` (typed `RequestAvailableActions`, safe-default literal сохранён — C6 regression guard обновлён соответственно: `const actions: RequestAvailableActions = r.availableActions ?? {`);
- Paths/bodies unchanged: каждое действие → `runPost(`/requests/${id}/${action}`)` → `api.post(path, body ?? {})` (spec-assertions сохранены и проходят);
- `computeRequestAvailableActions`, endpoints, permission guards (`order.read` / `order.edit_noncritical`) — backend не изменялся;
- UI-C6 e2e: **22/22 PASS** (`backend/test/ui-c6-request-server-authority.e2e-spec.ts`).

# 8. Security / RBAC

Runtime-проверка (см. §16):

| Gate | Result |
|---|---|
| `order.read` server-authoritative | PASS (unchanged; detail/history/notes 200 authorized, контент не рендерится при отказе) |
| `order.edit_noncritical` server-authoritative | PASS (projection вычисляет на сервере; фронт не вычисляет) |
| Нет client-side permission calculation | PASS (`useCan`/`canEdit` удалены; spec-assertion) |
| Direct URL protected | PASS (direct navigation работает только в authorized-сессии; страница рендерится, но действия определяются сервером) |
| Read-only actor: no executable actions | PASS (SALES_MANAGER без `order.edit_noncritical`: availableActions все false — реальный in-browser fetch; action UI отсутствует в DOM: 0 кнопок, 0 групп) |
| Request access ≠ Order/Booking access | PASS (server-side endpoint guards `order.read` на Order/Booking; relation links не изменялись с UI-C2; empty state «Связанного заказа нет» подтверждён) |
| Новых permissions нет | PASS |

# 9. Relation Chain

`CommerceRelationChain current="request"` — не изменён. Runtime: «СВЯЗАННЫЕ СУЩНОСТИ» → «Связанного заказа нет» (для request без конверсии). UI-C2 spec-assertions PASS.

# 10. Timeline / Notes / Audit

Разделение сохранено: `EntityTimeline` (Aside, из `dto.timeline`) ≠ `OperationalNotes entityType="Request"` (Wide) ≠ `EntityAuditHistory` (`/requests/:id/history`, Wide, `requestActionLabel`). Runtime-снимок подтверждает все три секции: «ХРОНОЛОГИЯ» (6 milestone-записей), «Примечания» (composer), «ИСТОРИЯ ИЗМЕНЕНИЙ» (empty state). Компоненты не изменялись.

# 11. Loading / Error / Not-found

```text
loading:   flex h-full items-center justify-center + crm.loading      (канонический центр)
error:     centered + red text + ← crm.back_to_list (/app/requests)
not-found: crm.not_found + ← crm.back_to_list                          (единая ветка error||!request)
```

Spec-assertions добавлены (§15). Поведение локализации сохранено; новых строк нет.

# 12. i18n

RU/AZ/EN: **ни одного нового ключа, ни одного изменённого значения словарей.** Все видимые строки переиспользуют `reqflow.*`, `requests.*`, `crm.*`, `detail.sections.*`. Hardcoded fallback `|| "Заявки"` удалён (ключ `requests.title` каноничен). Existing i18n parity specs PASS (`Request detail labels are localized through i18n (RU/AZ/EN parity)`).

# 13. Accessibility

- Propose-price input: `aria-label` = локализованный placeholder (accessible name — spec + runtime jsdom role `textbox` with name);
- Все action buttons — нативные `<button>` (keyboard-accessible), `type="button"`, disabled во время busy;
- Empty-area omission — no placeholder noise (паритет Booking);
- Focus/focus-ring на input (`focus:border-blue-500 focus:ring-1`);
- No hover-only controls; group labels текстовые (не цвет-only).

# 14. Responsive

Runtime-измерение header action bar при ограничении ширины (см. §16):

| Width | Bar width | Wrapped | Overflow |
|---|---|---|---|
| 375 | 241px | YES (кнопки переносятся) | NO |
| 768 | 290px | NO | NO |
| 1024 | 290px | NO | NO |
| 1280 | 290px | NO | NO |

`document.documentElement.scrollWidth <= innerWidth` — PASS. `flex-wrap` грамматика `EntityDetailHeader` наследуется.

# 15. Tests

```text
frontend/lib/commerce-detail-system.spec.tsx   52/52 PASS
  — C6 guard обновлён: typed literal 'const actions: RequestAvailableActions = r.availableActions ?? {'
    (безопасный дефолт и запрет status-array сохранены)
  — 8 новых C7 тестов: header-slot migration (вкл. удаление btn/TONES/InfoRow/useCan);
    availableActions-only authority; 7 actions + paths + busy + labels; propose a11y/no-modal;
    centered loading/error + breadcrumb cleanup; empty-omission (jsdom render);
    projected-actions render + click wiring (PRICE_CHANGED projection);
    propose toggle: validation path + successful post closes input (jsdom, waitFor)

frontend/lib/request-center.spec.ts             22/22 PASS (регрессия)
frontend/lib/requests-registry.spec.tsx        108/108 PASS (регрессия)
FULL frontend vitest:                          778/779 PASS
  единственный failure — pre-existing baseline: lib/i18n.spec.ts › formatPrice NBSP
  (известный нерелевантный baseline failure, фиксируется с UI-C1.2H и ранее; C7 не трогает
   formatPrice/словари — файл i18n.tsx не изменялся)

backend e2e:
  ui-c6-request-server-authority               22/22 PASS
  d3-request-flow                               4/4 PASS

TSC (--noEmit):                                 PASS
next build:                                     PASS (маршрут app/app/requests/[id] в output)
```

Тесты не ослаблялись и не удалялись; единственное изменение существующего assertion — C6-guard literal, обновлённый на typed contract (семантика guard'а сохранена: safe-default + запрет status-array + round-trip).

# 16. Browser Runtime Verification

```text
Дата/время:   2026-09-08 (сессия ~23:00–23:15 локального времени)
SHA tested:   рабочее дерево на базе 76c69e9 + C7 changes (до commit; код = финальный закоммиченный)
Runtime:      backend NestJS :4000 (существующий процесс, БД travelhub1);
              frontend Next.js dev :3000 (PID 9732, Turbopack HMR — код C7 подхвачен HMR,
              подтверждено chunk'ом app_app_requests_%5Bid%5D_page_tsx → 200);
              browser automation через thread preview (Chromium)
Request:      1c218133-4b40-49d2-88e4-a5ecb2ebbd4d = MKT-REQ-00000194,
              status PRICE_CHANGED, customerActionDeadline 2026-09-23 (окно валидно)
```

**Authorized actor (ADMIN, order.edit_noncritical):**

```text
API:      GET /api/v1/requests/1c218133… → status PRICE_CHANGED
          availableActions = {confirmPrice:false, proposePrice:false, reject:false,
          unavailable:false, customerAccept:true, customerDecline:true, convert:false}
          (захвачено и curl'ом, и in-browser fetch)

DOM:      header actions slot содержит action bar (проверено: bar находится внутри
          первого блока EntityDetailHeader, рядом с h1/back-link):
            группа «КЛИЕНТ — РЕШЕНИЕ»:
              [Клиент принял условия] enabled
              [Клиент отказался]   enabled
          Convert: отсутствует; supplier-кнопки: отсутствуют;
          legacy inline «ДЕЙСТВИЯ» card в MAIN: отсутствует (legacyActionsCard=false).
          server projection → rendered UI: 1:1 match.

Direct URL: /app/requests/1c218133… прямой навигацией — PASS
Refresh:    in-page location.reload() — PASS (sessionStorage probe пережил reload;
            URL, h1, кнопки сохранены; landing tool-reload'а на /dashboard — артефакт
            harness'а, не поведение страницы, задокументировано честно)
Console:    только [info] React DevTools, [log] HMR connected, [log] Fast Refresh;
            0 ошибок, 0 предупреждений → new C7 console errors: NONE
Network:    session/detail/history/operational-notes — все 200
Screenshot: сделан в сессии (header grammar: breadcrumbs → h1 → action group → back-link;
            status badge + secondary ref ниже) — скриншоты не коммитятся (evidence policy);
            durable evidence = DOM/API/console/network записи выше
```

**Read-only actor (SALES_MANAGER `sm_c6gate_1788882736`, order.read БЕЗ order.edit_noncritical):**

```text
Сессия осталась от UI-C6 browser-прогона — проверка выполнена органически до login-switch:
  in-browser fetch /api/v1/requests/1c218133… → availableActions: все 7 = false
  DOM: 0 action-кнопок, 0 action-групп (весь UI действий отсутствует);
       страницы контент (обзор/поставщик/клиент/отклонение/хронология/детали/
       связанные сущности/примечания/история) рендерится полностью
  → §13 read-only gate: PASS (no mutations performed)
```

**Responsive:** header action bar измерен при 375/768/1024/1280 (см. §14) — wrap на 375, overflow нет.

# 17. Regression

| Suite | Result |
|---|---|
| commerce-detail-system (incl. all-3-details parity, UI-C2/C4/C5/C6 contracts) | 52/52 PASS |
| request-center + requests-registry | 130/130 PASS |
| Full frontend vitest | 778/779 (1 pre-existing baseline failure) |
| UI-C6 backend e2e | 22/22 PASS |
| D3 request-flow backend e2e | 4/4 PASS |
| TSC / next build | PASS / PASS |
| Order/Booking pages | не изменялись (git: только 3 frontend-файла C7) |

# 18. Qualification Matrix

| Gate | Expected | Result | Evidence |
|---|---|---|---|
| Canonical shell | preserved | **PASS** | §5 + spec imports/composition assertions |
| Header actions | RequestActionBar | **PASS** | runtime DOM (bar in header) + spec |
| 7 actions | all contract fields | **PASS** | component source + spec seven-actions test |
| Server authority | availableActions only | **PASS** | spec no-status/no-permission + runtime API↔DOM match |
| No local status matrix | absent | **PASS** | spec `not.toContain` status-array + `not.toContain r.status` in bar |
| API paths/bodies | unchanged | **PASS** | spec runPost/api.post assertions; UI-C6 e2e 22/22 |
| Relation chain | unchanged | **PASS** | runtime «Связанного заказа нет»; spec UI-C2 assertions |
| Timeline | unchanged | **PASS** | runtime «ХРОНОЛОГИЯ» 6 milestones |
| Notes | unchanged | **PASS** | runtime «Примечания» composer |
| Audit | unchanged | **PASS** | runtime «ИСТОРИЯ ИЗМЕНЕНИЙ» |
| Request-specific cards | preserved | **PASS** | runtime snapshot: Обзор/Поставщик/Клиент/Отклонение/Д5 |
| Loading/error | canonical | **PASS** | §11 + spec centered/back-to-list assertions |
| Accessibility | input/actions | **PASS** | aria-label spec + jsdom role test; native buttons |
| RU/AZ/EN | PASS | **PASS** | dictionaries untouched; parity specs PASS |
| Responsive | 375/768/1024/1280 | **PASS** | §14 measurements, wrap@375, no overflow |
| RBAC read-only actor | all-false + no UI | **PASS** | §16 SALES_MANAGER runtime |
| Direct URL | protected | **PASS** | §16 direct navigation both actors |
| Browser console | no new C7 errors | **PASS** | §16 console capture |
| UI-C6 regression | PASS | **PASS** | e2e 22/22 + updated guard test |
| TSC | PASS | **PASS** | §15 |
| Build | PASS | **PASS** | §15 |
| Full regression | PASS / documented baseline | **PASS** | 778/779 (baseline NBSP failure documented) |
| Git | synchronized | **PASS** | §20 |

# 19. Known Pre-existing Failures

```text
frontend/lib/i18n.spec.ts › formatPrice NBSP — 1 pre-existing failure
(зафиксирован во всех prior stages: «346/347», «677/678», «717/718», теперь «778/779»).
Причина — Intl/NBSP-форматирование в lib/i18n.tsx formatPrice; C7 этот файл не изменял.
```

# 20. Git State

```text
BASELINE SHA:                    76c69e94491bc96c3f6366c9178ceca34db435b1
IMPLEMENTATION SHA:              3e705af  (ui-c7: migrate Request detail actions to
                                          canonical header bar; 3 файла, +483/−155)
REPORT/DOCS SHA:                 b7fa96e  (docs(ui-c7): qualification report VERDICT A)
FINAL SYNC SHA:                  фиксируется commit'ом настоящей аннотации (HEAD после push)
Historical untracked docs/prompts/PHASE_3_*: не тронуты, не закоммичены
git diff --check: PASS
```

Проверка closure (после push): HEAD == origin/master; tracked working tree clean;
untracked — только исторические/процессные PHASE_3 prompt-артефакты, сознательно
исключённые из implementation closure.

# 21. Scope Compliance

- MUST NOT violations: **НЕТ** — backend/schema/API/DTO/permissions/lifecycle/status enum/reject-unavailable reason behavior/Order/Booking/Finance/Payments/PROD-01/D8/Debt Register/roadmap/prompts/`.gitignore` — не изменены;
- Server authority, 7-action contract, safe-default literal — сохранены;
- Timeline ≠ Notes ≠ Audit — не объединялись;
- Audit scope (VERDICT A §15) — реализован 1:1, без расширений; противоречий с audit не обнаружено (STOP rule не активировался);
- Untracked prompt artifacts — сохранены локально.

# 22. Final Verdict

```text
UI-C7 = ACCEPTED
Request UI Migration = COMPLETE
Backend changes = NONE
Security regression = NONE
UI-C6 contract = PRESERVED
```

VERDICT A — ACCEPTED. Следующие этапы (UI-C8/D8/Finance Center/PROD-01) НЕ начинаются.
