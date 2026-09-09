# PHASE 3 — UI-C7 — REQUEST UI MIGRATION
## AUDIT-FIRST MAPPING REPORT

**Mode:** Audit-First / No Implementation
**Baseline:** `76c69e94491bc96c3f6366c9178ceca34db435b1`
**Language:** Russian
**Дата:** 2026-09-08

---

# 1. Executive Summary

Request Detail (`frontend/app/app/requests/[id]/page.tsx`, 570 строк) **уже глубоко каноничен**:

- Полный canonical shell: `EntityDetailShell` → `EntityDetailHeader` → `EntityDetailLayout` (Main/Aside/Wide) — идентичная композиция Order/Booking;
- Все три canonical нижних слота заняты canonical-компонентами: `CommerceRelationChain` (UI-C2), `OperationalNotes` (UI-C5), `EntityAuditHistory` (UI-C4);
- Действия полностью server-authoritative (UI-C6): единственный источник — `r.availableActions`; статусных матриц в коде нет (подтверждено spec-тестом `commerce-detail-system.spec.tsx` L285–299 и runtime browser evidence UI-C6).

**Фактический migration scope узкий иpresentation-level:**

1. Действия рендерятся inline-секцией в MAIN-колонке (legacy-паттерн pre-C1.2), тогда как Order/Booking рендерят действия в header `actions`-слоте (`OrderActionBar` / inline-кнопки);
2. Локальные UI-примитивы `btn()` + `TONES` (L112–120) — дублируют canonical tone-систему;
3. `InfoRow` — тривиальный alias над `EntityField` (L106) — косвенный, но лишний слой;
4. Loading/error/empty-состояния — простые div'ы, не matching canonical centering-паттерн Order/Booking;
5. Деструктивные действия (`reject`, `unavailable`, `customerDecline`) без confirmation — расхождение с Order (`OrderActionBar.confirm` для `close`/`cancel`) — **решение требуется** (semantics vs parity);
6. Мёртвый код: `canEdit` вычисляется и не используется (L159) — вмертвый артефакт pre-UI-C6 client-side permission check;
7. `propose-price` input без accessible label (L353–359).

Backend enrichment **НЕ требуется** (§11): DTO уже несёт всё необходимое. Ни один из обязательных критериев не блокирует VERDICT A.

---

# 2. Current Canonical State

```text
BASELINE:      76c69e94491bc96c3f6366c9178ceca34db435b1 (HEAD == origin/master)
UI-C6          = ACCEPTED / CLOSED (browser gate: PASS, evidence artifact exists)
SEC-UI-01      = CLOSED
UI-C7          = TRUE NEXT / NOT STARTED (TRUE NEXT report: docs/reports/
               PHASE_3_TRUE_NEXT_REQUALIFICATION_AFTER_UI_C6_REPORT.md, VERDICT A)
D8             = NOT STARTED
Finance Center = NOT STARTED / DEFERRED
PROD-01        = OPEN / DEFERRED
```

Git evidence (§20): tracked tree clean, `git diff --check` CLEAN, 16 untracked
`docs/prompts/PHASE_3_*` + 1 untracked TRUE NEXT report — не тронуты.

---

# 3. Request Detail Current-State Mapping

Источник: `frontend/app/app/requests/[id]/page.tsx` (570 строк, полностью прочитан).

| Surface | Location (L) | Classification | Evidence |
|---|---|---|---|
| Shell | L265–267: `<EntityDetailShell header={<EntityDetailHeader …>}>` | **CANONICAL** | тот же shell, что Order L100–101 / Booking L96–97 |
| Breadcrumbs | L267: `["TravelHub", t("requests.title"), r.referenceNumber]` | **CANONICAL** | идентичная грамматика Order L102 / Booking L98 |
| Entity identity | L268–270: reference=`r.referenceNumber`, secondary=`r.code` | **CANONICAL** | h1-once грамматика `EntityDetailHeader` (L1–13 компонента) |
| Lifecycle status | L271: `lifecycleStatus={<StatusBadge status={r.status}/>}` | **CANONICAL** | как Order L105 |
| Payment badge | — | **MISSING** | Request не имеет paymentStatus — семантически корректно (см. §8); не является gap |
| Primary/secondary actions | L286–401: inline `EntitySectionCard` «ДЕЙСТВИЯ» в MAIN | **PARTIALLY CANONICAL / LEGACY** | серверная authority канонична; render-location legacy (Order/Booking — в header `actions`-слоте) |
| Request/customer/partner/product info | L286–345: Overview card, EntityFieldGrid | **CANONICAL** | `EntitySectionCard` + `EntityFieldGrid` + `EntityField` |
| Pricing info | L321–329 (displayed/confirmed price), L393–401 (supplier proposal) | **CANONICAL** | Request-специфичный контент, сохраняется as-is |
| Payment-related content | L484–500: convertedPayments EntityRow list | **CANONICAL** | `EntityRow` grammar; payments отображаются как relation-context, не Finance Center content |
| Relations | L505–548: `CommerceRelationChain current="request"` + D5 conversion context | **CANONICAL** | UI-C2 pattern, как Order L292–296 / Booking L283–289 |
| Timeline | L456–464: `EntityTimeline` в Aside (если `r.timeline` непуст) | **CANONICAL** | backend L523–524 (`dto.timeline`), separation preserved |
| Operational notes | L553–561: `OperationalNotes entityType="Request"` | **CANONICAL** | UI-C5 |
| Audit history | L563–568: `EntityAuditHistory items={history} actionLabel={requestActionLabel}` | **CANONICAL** | UI-C4, endpoint `/requests/:id/history` (controller L160–163) |
| Loading state | L218–224: `<div className="p-6"><div className="text-gray-500">` | **LEGACY** | Order L146 / Booking L151: `flex h-full items-center justify-center` |
| Error state | L226–232: красный div | **LEGACY** | Order L147–155 / Booking L152–160: центрированный блок + back-link `crm.back_to_list` |
| Empty/not-found | L234–238: `t("crm.not_found")` без back-link | **LEGACY** | см. выше |
| Responsive | наследуется от `EntityDetailLayout` (`grid-cols-1 → lg:grid-cols-3`, 2:1) | **CANONICAL** | `EntityDetailLayout.tsx` L21/32/46/60 |
| i18n | все строки через `t()`; единственный hardcoded RU — breadcrumbs fallback L268 | **PARTIALLY CANONICAL** | `t("requests.title", locale) \|\| "Заявки"` — fallback dead (ключ существует, DICT grep=1), но literal присутствует |
| a11y | 0 `aria-*` атрибутов на странице; propose-input без label | **PARTIALLY CANONICAL** | Order/Booking тоже 0 aria-* (parity сохранена); input gap — request-specific |

---

# 4. Canonical Commerce Shell Reconciliation

Сравнение с canonical структурой из промпта §3:

```text
Header/Breadcrumbs/ID/Title/Status   ✅ canonical (EntityDetailHeader)
Primary actions                      ⚠️ inline section в MAIN (Order/Booking — header slot)
MAIN ENTITY CONTENT                  ✅ EntitySectionCard grammar
Entity-specific cards                ✅ Overview / Supplier / Customer / Rejection / Details
Finance (where applicable)           ✅ Request не имеет finance card — семантически
                                     корректно (цены — request-атрибуты в Overview,
                                     не D7 finance). Payment badge в header — N/A
                                     (Request не имеет paymentStatus в DTO).
COMMERCE RELATION CHAIN              ✅ UI-C2 (Wide slot)
NOTES / COMMENTS                     ✅ UI-C5 (Wide slot)
AUDIT HISTORY                        ✅ UI-C4 (Wide slot)
```

**Preserved separation (verified):**

- `EntityTimeline` — business milestones из `dto.timeline` (backend request.service L523–524) — Timeline;
- `OperationalNotes` — отдельный компонент с собственными permissions;
- `EntityAuditHistory` — immutable `/requests/:id/history` — Audit.

Три сущности физически раздельны (L456–464, L553–561, L563–568). Merge не обнаружен.

**Ключевой вывод:** migration НЕ заменяет working canonical components — только переносит action surface и заменяет локальные примитивы.

---

# 5. Request Action Surface Audit

Все 7 действий серверного контракта (typed `availableActions`, UI-C6):

| Action | Render location | availableActions consumed | Local matrix? | Primitive | Localization | Destructive confirm | Loading/error |
|---|---|---|---|---|---|---|---|
| confirmPrice | L310–313, MAIN actions card | ✅ `actions.confirmPrice` | нет | `btn(TONES.success)` | `reqflow.confirm_price` | нет | `busy` + `actionMsg` |
| proposePrice | L314–333 (inline input toggle) | ✅ `actions.proposePrice` | нет | `btn(TONES.primary)` + raw `<input>` | `reqflow.propose_price`; placeholder `requests.price_proposal_placeholder`; **input без accessible label** | нет | busy + `requests.price_invalid` |
| reject | L334–336 | ✅ `actions.reject` | нет | `btn(TONES.danger)` | `reqflow.reject` | **нет** | busy + actionMsg |
| unavailable | L337–339 | ✅ `actions.unavailable` | нет | `btn(TONES.neutral)` | `reqflow.unavailable` | **нет** | busy + actionMsg |
| customerAccept | L375–378 | ✅ `actions.customerAccept` | нет | `btn(TONES.success)` | `reqflow.customer_accept` | нет | busy + actionMsg |
| customerDecline | L379–382 | ✅ `actions.customerDecline` | нет | `btn(TONES.danger)` | `reqflow.customer_decline` | **нет** | busy + actionMsg |
| convert | L385–390 | ✅ `actions.convert` | нет | `btn(TONES.primary)` | `reqflow.convert_action`; hint `reqflow.converted_hint` | нет | busy + actionMsg |

**Выводы:**

- Все 7 действий потребляют `availableActions` — client-side lifecycle matrix **отсутствует** (spec `commerce-detail-system.spec.tsx` L285–299: legacy status-array patterns `expect(req).not.toContain(...)` — PASS);
- Каждое действие round-trip к серверу через `runPost` → `api.post(path, body ?? {})` — server authority сохранена;
- **Reject hardcoded reason:** L335 `runPost(\`/requests/${id}/reject\`, { reason: "rejected" })` — фиксированная причина без ввода пользователем; аналогично `unavailable` L338. Существующая семантика; изменение = business-behavior change → MUST NOT без отдельного approval;
- **Convert** корректно представляет transition: `actions.convert && runPost(/convert)`, при этом `convert=true` только при D3 accept-snapshot (backend L62–71: `hasD3AcceptSnapshot`), т.е. «Convert» = переход к Order после принятия клиентом. Представление корректно; после конвертации `convertedOrderId != null` → `convert=false` (server);
- **No destructive confirmation** на reject/unavailable/customerDecline — расхождение с OrderActionBar (`close`/`cancel` имеют `confirm:` текст). Question for approval (§15 Risk): parify confirm или сохранить семантику Request-flow (быстрые действия в окне deadline). Audit не решает — фиксирует decision point;
- Permission: `useCan("order.edit_noncritical")` (L159) вычисляется, но **не используется** — мёртвый код (до-UI-C6 артефакт: client permission gate). Действия теперь скрываются только server projection — корректно по UI-C6.

**Render location decision:** Order использует `OrderActionBar` в header `actions`-слоте (order/[id] L106–113); Booking — inline header div (L101–116). Request — inline MAIN-секция. Canonical target: header `actions`-слот через request-специфичный adapter. Прямое переиспользование `OrderActionBar` невозможно (другой action-контракт: string[] vs typed object, разные labels, propose-price input) — требуется `RequestActionBar` (shared grammar: `EntityDetailHeader actions` slot + busy + optional confirm).

---

# 6. Commerce Relation Chain Audit

`CommerceRelationChain current="request"` (L512–516):

- current-node semantics: ✅ canonical (identical Order L294 / Booking L286);
- linked Order/Booking: ✅ `r.convertedOrder` / `r.convertedBooking` из DTO (L115–139) — server-provided, не client-resolved;
- NOT_CREATED/future: ✅ empty-state `t("reqflow.no_linked_order")` (L546);
- navigation: `router.push(/app/orders/${id})` (L470) + `CommerceRelationChain` internal links (UI-C2 canonical);
- authorization of destinations: Order/Booking endpoints guard `order.read` (server-side) — Request access не грантит Order/Booking автоматически; 404 для cross-tenant — проверено в UI-C2/D4 evidence;
- UI-C2 contract preserved: relation identity/status рендерится только в chain (spec L122–143: local StatusBadge для payments/decisions — вне chain — допустимо).

**Новых relation resolution не требуется.**

---

# 7. Timeline / Notes / Audit Audit

| Component | Placement | Contract | Status |
|---|---|---|---|
| `EntityTimeline` | Aside (L456–464), внутри `EntitySectionCard` | `items` из `dto.timeline` (server) | ✅ CANONICAL; guard `timeline.length > 0` — Request-специфика (Order/Booking рендерят always) |
| `OperationalNotes` | Wide (L553–561), после relations, перед audit | `entityType="Request"`, permissions/currentUserId/currentRole от `useCurrentUser` | ✅ CANONICAL (UI-C5) |
| `EntityAuditHistory` | Wide (L563–568), последний слот | `items`, `loading`, `error`, `actionLabel=requestActionLabel` | ✅ CANONICAL (UI-C4); без pagination (endpoint не пагинирован — `/requests/:id/history` возвращает массив) |

**Separation preserved:** три различных data source (`dto.timeline`, operational-notes API, `/requests/:id/history`), три компонента, никакой конверсии milestone→audit event.

**Мелкое расхождение:** Order `EntityAuditHistory` получает `total`/`onLoadMore` (pagination), Booking/Request — нет. Не блокер; унификация пагинации = отдельный backend change (не в C7 scope без approval).

---

# 8. Header / Status / Finance Audit

- Title/ID: ✅ `referenceNumber` (h1) + `code` (secondary mono) — canonical grammar, primary рендерится ровно один раз;
- Status: ✅ `StatusBadge status={r.status}` в `lifecycleStatus`;
- Payment badge: **N/A** — Request DTO не имеет `paymentStatus` (interface L115–139 подтверждает); Request — pre-contract сущность. **Не gap, а корректная семантика.** Инвентировать payment semantics запрещено (промпт §7);
- Badges entity type: entity type не отображается отдельным badge (в отличие от booking service badge) — parity с Order (тоже нет). Consistent;
- Breadcrumbs: ✅ canonical, fallback `"Заявки"` — dead literal (ключ существует);
- Finance: **Request не имеет finance card** — корректно: D7 finance authority принадлежит Order (`financial-history` endpoint); Request pricing (displayed/confirmed/proposal) — request-атрибуты, отображаются в Overview/Supplier cards как EntityField, не как EntityFinanceCell. Payments tab ≠ Finance Center — distinction preserved.

---

# 9. Legacy UI Inventory

Только evidence-based находки:

| Legacy surface | Location | Canonical replacement | Required? | Risk |
|---|---|---|---|---|
| `btn()` helper | page.tsx L112–114 | tailwind-классы canonical кнопок (как Booking L103–105) | YES | низкий — pure presentational |
| `TONES` map | page.tsx L116–121 | tailwind-классы (Booking `ACTION_CSS` pattern) / RequestActionBar tones | YES | низкий |
| `InfoRow` alias | page.tsx L106–108 | прямой `EntityField` (как Order/Booking) | YES | низкий — mechanical rename |
| Inline actions section в MAIN | L286–401 | `EntityDetailHeader actions` slot + `RequestActionBar` | YES | средний — DOM relocation, spec/test updates |
| Loading state `p-6/text-gray-500` | L218–224 | centered `flex h-full items-center justify-center` + `crm.loading` | SHOULD | низкий |
| Error/not-found state | L226–238 | centered + `crm.back_to_list` link (Order/Booking pattern) | SHOULD | низкий |
| Breadcrumbs RU fallback `|| "Заявки"` | L268 | удалить literal (ключ каноничен) | SHOULD | низкий |
| Dead `canEdit` + `useCan` import | L159 (+import) | удалить | YES | нет |
| Propose-price input без accessible label | L353–359 | aria-label/`htmlFor` association | SHOULD | низкий |
| Propose-price inline toggle state | L314–333 | RequestActionBar internal state (подробнее §17) | YES (в составе actions migration) | средний |

**Не legacy (explicitly verified, не трогать):**

- `ProgressBadge` (L96–110) — request-специфичный D5 progress indicator, локализован (`reqflow.progress.*`);
- Converted payments/refunds EntityRow lists (L484–500) — canonical EntityRow grammar;
- Supplier/Customer/Rejection cards — canonical EntitySectionCard+FieldGrid;
- `StatusBadge` для decisions/payments — canonical (spec L122–143 разрешает вне chain).

**Local lifecycle action matrix:** отсутствует (проверено grep + spec L292–295). Единственный псевдо-фоллбэк: `r.availableActions ?? {all:false}` (L251–260) — safe-default при отсутствии поля, не matrix; UI-C6 spec требует сохранить literal `const actions = r.availableActions ?? {`.

---

# 10. Cross-Detail Consistency

| Aspect | Request | Order | Booking | Verdict |
|---|---|---|---|---|
| Shell/Header/Header component | ✅ | ✅ | ✅ | UNIFIED |
| Layout Main/Aside/Wide | ✅ | ✅ | ✅ | UNIFIED |
| Actions placement | MAIN inline card | header slot (`OrderActionBar`) | header slot (inline map) | **DIVERGENT** → C7 target: header slot |
| Action busy pattern | `busy===path` | `busyAction===action` | `executing===action` | divergent naming, same semantics — унифицируется в RequestActionBar |
| Timeline | Aside ✅ | Aside ✅ | Aside ✅ | UNIFIED |
| Details aside card | ✅ (code/sequence/created/updated) | ✅ (+number) | ✅ (+sequence) | UNIFIED grammar |
| Relations | Wide ✅ | Wide ✅ | Wide ✅ | UNIFIED |
| Notes | Wide ✅ | Wide ✅ | Wide ✅ | UNIFIED |
| Audit | Wide ✅ (no pagination) | Wide ✅ (pagination) | Wide ✅ (no pagination) | UNIFIED component; pagination divergence (not C7) |
| Finance card | нет (N/A) | ✅ D7 cells | ✅ D7 linked summary | SEMANTIC (correct per §8) |
| Loading/error/empty | legacy div | centered + back-link | centered + back-link | **DIVERGENT** → C7 SHOULD |
| aria-* count | 0 | 0 | 0 | parity (population-wide pattern; C7 не обязан менять все 3 — только не регрессировать) |

`UNIFIED STRUCTURE ≠ IDENTICAL BUSINESS CONTENT` — соблюдено: request-специфичные cards (Supplier proposal, Customer decision, Rejection, D5 conversion context, ProgressBadge) не имеют Order/Booking аналогов и сохраняются.

---

# 11. API / DTO Compatibility

Endpoint: `GET /api/v1/requests/:id` (`request.controller.ts` L152–158, `@RequirePermissions("order.read")`).

DTO уже предоставляет (evidence: frontend interface L57–139 + backend request.service):

| Требование C7 | Поле DTO | Статус |
|---|---|---|
| availableActions (7 полей) | `availableActions` (typed, server L40–75 projection, dto L430) | ✅ есть |
| status | `status` | ✅ |
| relation data | `convertedOrder`/`convertedBooking`/`convertedPayments` (+`convertedRefund` any-cast) | ✅ |
| timeline | `timeline` (backend L523–524) | ✅ |
| notes | отдельный operational-notes API (UI-C5) | ✅ |
| audit | `GET /requests/:id/history` (controller L160–163, `order.read`) | ✅ |
| permissions/security | server projection принимает `granted` (L153–157: `detail()` передаёт `user.permissions` в `getRequest(id, granted)`) | ✅ |

**Backend enrichment НЕ требуется.** Ни один критерий UI-C7 (§18 промпта) не требует нового поля DTO. `RequestHistoryRow` без `fields` (old/new) — canonical source не содержит old/new для Request history → не инвентировать (промпт §14).

**Backend change required: НЕТ.**

---

# 12. Security / RBAC Audit

- Read permission: `order.read` на detail+history (controller L152, L160) — server-side ✅;
- Action permission: `order.edit_noncritical` на всех 6 mutation endpoints (controller L168–227) + внутри projection `computeRequestAvailableActions` (`granted.includes(REQUEST_EDIT_PERMISSION)`, service L52) ✅;
- Server authority: UI-C6 contract — frontend рендерит только `availableActions`; local recompute отсутствует (spec L285–299 enforced); browser gate UI-C6: PASS (evidence artifact `PHASE_3_UI_C6_LIVE_BROWSER_VERIFICATION_EVIDENCE.md`: SALES_MANAGER без permission → все 7 false, actions-секция отсутствует в DOM);
- Direct URL: работает; unauthorized actor видит detail без actions (тот же evidence);
- Tenant/workspace scope: существующий server-side isolation (проверен в D4/D5/UI-C2 evidence) — не изменяется;
- Client-only security assumptions: **мёртвый `canEdit` (L159) — единственный остаток client-side permission мышления; его удаление — часть C7 cleanup** (не несёт security risk: он не используется).

Новых permissions не требуется. **RBAC/tenant model не меняется.**

---

# 13. Test Inventory

Существующее покрытие (Request-related):

| Тест | Что покрывает | C7 relevance |
|---|---|---|
| `frontend/lib/commerce-detail-system.spec.tsx` (28 it) | shared primitives import (L21–47), EntityRow grammar, timeline locale-aware, request label localization (L84), action server-authority после UI-C6 (L285–299, source-level assertions на `const actions = r.availableActions ?? {` + запрет legacy status-array) | **основной regression guard C7** — потребует update при переносе actions в header (assertions на runPost/api.post сохранятся, DOM-location не проверяется) |
| `frontend/lib/request-center.spec.ts` (22 it) | sidebar rename, KPI/status i18n keys, routes, conversion date, timeline labels | регрессия — не должна сломаться (page-level keys не меняются) |
| `frontend/lib/requests-registry.spec.tsx` (52 it) | registry page (не detail) | косвенно |
| `backend/test/ui-c6-request-server-authority.e2e-spec.ts` | API contract: availableActions 7-key object, permission-driven projection | не затрагивается (API не меняется) |
| `backend/test/d3-request-flow.e2e-spec.ts` | полный request lifecycle через API | не затрагивается |

**Missing C7 acceptance coverage (зафиксировать на implementation phase):** header action-slot rendering для Request; отсутствие действий для unauthorized actor в DOM; loading/error parity; propose-input a11y; i18n RU/AZ/EN для новых label-ключей (если появятся); responsive action-bar behavior.

Писать тесты на этапе audit запрещено (промпт §12).

---

# 14. Debt / Roadmap Compatibility

Debt Register: не читался как authority для изменения (read-only). Проверка конфликтов:

- SEC-UI-01 = CLOSED — **не reopened**; UI-C7 не включает security remediation (это было UI-C6);
- PROD-01 = OPEN/DEFERRED — не блокирует C7 (C7 не трогает Product Model; Request product info отображает snapshot-поля DTO as-is);
- Finance Center = NOT STARTED/DEFERRED — C7 не создаёт finance content; payments rows — relation context (см. §8);
- D8 = NOT STARTED — C7 не зависит от D8, D8 не зависит от C7;
- UI-C7 = TRUE NEXT (`PHASE_3_TRUE_NEXT_REQUALIFICATION_AFTER_UI_C6_REPORT.md`: VERDICT A, prerequisites SATISFIED).

Documentation drift (зафиксирован в TRUE NEXT report §7, не блокер, не исправляется здесь): часть UI-дебтов помечена OPEN при фактически покрытом accepted-этапами scope.

**Blocking debt: НЕТ.**

---

# 15. Minimal Implementation Scope

## MUST CHANGE (минимально необходимое для UI-C7)

1. **Actions → header slot.** Current: inline `EntitySectionCard «ДЕЙСТВИЯ»` в MAIN (L286–401). Target: `EntityDetailHeader actions={...}` с новым `RequestActionBar` (frontend/components/request/RequestActionBar.tsx) — canonical action placement, паритет Order/Booking. Reason: canonical consistency. Evidence: §5, §10. Risk: средний (DOM relocation; commerce-detail-system spec updates; propose-price inline toggle state переносится в компонент).
2. **Удалить `btn()` + `TONES`.** Current: L112–121 local primitives. Target: tailwind-классы в RequestActionBar. Reason: no local UI-primitive duplication. Risk: низкий.
3. **Удалить `InfoRow` alias.** Current: L106–108 wrapper. Target: прямой `EntityField`. Reason: shared primitive grammar. Risk: низкий (mechanical).
4. **Удалить мёртвый `canEdit`/`useCan`** (L159 + import). Reason: dead client-permission артефакт pre-UI-C6. Risk: нулевой.

## SHOULD CHANGE (canonical consistency, в scope)

5. Loading/error/not-found → centered pattern + `crm.back_to_list` (паритет Order L146–155/Booking L151–160). Reason: cross-detail parity. Risk: низкий.
6. Breadcrumbs: убрать `|| "Заявки"` literal (L268). Risk: нулевой.
7. Propose-price input: accessible label (`aria-label` или label-ассоциация). Reason: a11y. Risk: низкий.

## MUST NOT CHANGE

- `availableActions` contract/7-field object, `computeRequestAvailableActions`, execution endpoints, hard-coded reject/unavailable reasons, action semantics и ordering;
- `const actions = r.availableActions ?? {all:false}` safe-default literal (требование commerce-detail-system.spec L287);
- Business/lifecycle/status enum; permissions (`order.read`, `order.edit_noncritical`); schema/API/DTO;
- `CommerceRelationChain`, `OperationalNotes`, `EntityAuditHistory` integration и их placement;
- EntityTimeline + guard; ProgressBadge; supplier/customer/rejection cards; converted payments/refunds lists;
- Order/Booking pages и контракты; Finance Center/PROD-01/D8; Debt Register/roadmap/prompts.

---

# 16. Implementation Risk Analysis

| Risk | Вероятность | Митigation |
|---|---|---|
| Случайное изменение lifecycle/permission | низкая | действия — pure relocation; `runPost` paths/body unchanged; spec L285–299 guard |
| Дублирование authority (client recompute) | низкая | RequestActionBar принимает только `availableActions` object; запрет status-based логики — spec-assertion сохранить |
| Relation leakage | нулевая | relation data уже в DTO; navigation authority server-side |
| Визуальный/регресс | средняя | commerce-detail-system (28) + request-center (22) + requests-registry (52) suite; при необходимости точечные update'ы source-assertions |
| Потеря request-специфичного контента | низкая | §15 MUST NOT; при relocation сections остаются в MAIN |
| Timeline/Notes/Audit поломка | низкая | не трогаются; Wide-слоты unchanged |
| i18n регресс | низкая | все ключи существуют; новые label-ключи не планируются (labels из reqflow.* переиспользуются) |
| a11y регресс | низкая | propose input label — improvement; parity 0-aria сохраняется |
| Responsive поломка | низкая | header actions slot — flex-wrap (EntityDetailHeader), проверяем 375/768/1024/1280 |

**Timeline ≠ Audit ≠ Notes separation: риск нулевой (компоненты не трогаются).**

---

# 17. UI-C7 Implementation Matrix

| Surface | Current state | Canonical target | Change required | Shared component | Backend change | Test required |
|---|---|---|---|---|---|---|
| Shell/Header/Breadcrumbs | canonical | — | NO | EntityDetailShell/Header | нет | регрессия |
| Lifecycle status badge | canonical | — | NO | StatusBadge | нет | нет |
| Actions placement | inline MAIN card | header actions slot | **YES (MUST)** | **RequestActionBar (new)** | нет | YES: spec update + new render test |
| Action primitives btn/TONES | local | tailwind in RequestActionBar | **YES (MUST)** | RequestActionBar | нет | covered above |
| Propose-price inline input+toggle | page state | RequestActionBar internal state | **YES (MUST)** | RequestActionBar | нет | YES |
| InfoRow alias | wrapper | EntityField direct | **YES (MUST)** | EntityField | нет | source spec only |
| Dead canEdit | dead code | removed | **YES (MUST)** | — | нет | нет |
| Loading/error/empty | legacy div | centered + back-link | SHOULD | — | нет | YES (render) |
| Breadcrumbs RU fallback | dead literal | removed | SHOULD | — | нет | source spec |
| Propose input a11y | no label | aria-label | SHOULD | RequestActionBar | нет | YES |
| Relations chain | canonical | — | NO | CommerceRelationChain | нет | регрессия |
| Timeline | canonical | — | NO | EntityTimeline | нет | регрессия |
| Notes | canonical | — | NO | OperationalNotes | нет | регрессия |
| Audit history | canonical | — | NO | EntityAuditHistory | нет | регрессия |
| Payment badge in header | N/A (нет paymentStatus) | N/A | NO | — | нет | нет |
| Finance card | N/A (request pricing = attributes) | N/A | NO | — | нет | нет |

---

# 18. File-Level Change Map

| File | Current responsibility | Expected C7 change | Why | Risk |
|---|---|---|---|---|
| `frontend/app/app/requests/[id]/page.tsx` | Request detail page | remove btn/TONES/InfoRow/canEdit; move actions render to header slot via RequestActionBar; centered loading/error; breadcrumbs literal cleanup; propose-input a11y (внутри Action Bar) | C7 core | средний |
| `frontend/components/request/RequestActionBar.tsx` | — (новый) | new: header action bar для Request; input: `availableActions`, `onRun`, `busyAction`; internal propose-toggle state; labels reqflow.*; confirm опционально (по решению §5) | canonical action placement | низкий (new file) |
| `frontend/lib/commerce-detail-system.spec.tsx` | detail parity specs | update request assertions (header slot; сохранить availableActions/`runPost`/status-array asserts) | reflect new DOM/structure | низкий |
| `frontend/lib/request-center.spec.ts` / `requests-registry.spec.tsx` | регрессия | только при затрагивании i18n-ключей (не ожидается) | regression | нулевой |
| `backend/**` | — | **NO CHANGES** | DTO/API достаточны (§11) | — |
| `docs/reports/PHASE_3_UI_C7_REQUEST_UI_MIGRATION_QUALIFICATION_REPORT.md` | — | new (implementation phase) | report | — |

Speculative files: нет. Возможные дополнения — только если runtime qualification выявит реальную необходимость (зафиксировать тогда).

---

# 19. Future Acceptance Contract

1. Canonical shell сохранён: EntityDetailShell/Header/Layout imports и композиция unchanged;
2. Request-специфичный контент сохранён полностью: supplier/customer/rejection cards, ProgressBadge, converted payments/refunds, D5 conversion context, timeline, notes, audit;
3. Actions рендерятся в header `actions`-слоте через RequestActionBar; MAIN inline actions card удалена;
4. Все 7 действий рендерятся строго по `availableActions` (typed object); `const actions = r.availableActions ?? {...}` literal сохранён;
5. Отсутствие client-side lifecycle/permission вычислений: no `r.status === "..."` action gates; `canEdit`/`useCan` удалены;
6. Каждый action round-trip к серверу (`runPost` → `api.post`), paths/body unchanged;
7. Server-side read (`order.read`) и action (`order.edit_noncritical`) authorization unchanged; direct URL + relation links не обходят authorization (server 404/403);
8. Новых permissions/статусов/полей DTO нет;
9. RU/AZ/EN: все видимые строки через i18n; no new hardcoded strings;
10. a11y: propose input has accessible name; header actions keyboard-accessible (buttons); no hover-only;
11. Responsive 375/768/1024/1280: no horizontal overflow; actions wrap;
12. Order/Booking detail pages untouched (file-level + runtime);
13. API contract unchanged: `GET /requests/:id` DTO fields identical; UI-C6 e2e (`ui-c6-request-server-authority.e2e-spec.ts`) PASS;
14. vitest: commerce-detail-system (updated) + request-center + requests-registry PASS; full suite no new failures (baseline failure `i18n.spec formatPrice NBSP` не приписывать C7);
15. TSC PASS; next build PASS;
16. Runtime: browser Request Detail — actions in header per availableActions; unauthorized actor — no actions; console clean;
17. Final Git synchronization: `git status --porcelain=v1` (кроме documented untracked prompts), HEAD == origin/master.

---

# 20. Git State

```text
git rev-parse HEAD             → 76c69e94491bc96c3f6366c9178ceca34db435b1
git rev-parse origin/master    → 76c69e94491bc96c3f6366c9178ceca34db435b1
git diff HEAD origin/master    → EMPTY
git status --porcelain=v1      → tracked modifications: НЕТ
                                 untracked: 16 docs/prompts/PHASE_3_* артефактов +
                                 1 docs/reports/PHASE_3_TRUE_NEXT_REQUALIFICATION_AFTER_UI_C6_REPORT.md
                                 (исторические/процессные; не тронуты, не коммитятся)
git diff --check               → CLEAN
```

Единственный созданный этим аудитом файл — настоящий отчёт (разрешён промптом §19).

---

# 21. Scope Compliance

- Production code/tests/schema/API/RBAC: НЕ изменены;
- Debt Register/roadmap/prompts: НЕ изменены;
- Implementation prompt: НЕ создан;
- D8/Finance Center/PROD-01: НЕ начаты;
- UI-C6/SEC-UI-01: НЕ переоткрыты (closure подтверждена: qualification report VERDICT A §14.5 corrected + browser evidence artifact);
- Request lifecycle/statuses/permissions: не затронуты;
- Order/Booking contracts: не затронуты;
- Untracked prompt artifacts: не удалены, не закоммичены; `.gitignore` не изменён;
- Унифицированная терминология сохранена (Commerce Relation Chain / EntityTimeline / OperationalNotes / EntityAuditHistory; Payments ≠ Finance Center).

---

# 22. Final Verdict

### VERDICT A — AUDIT READY

```text
UI-C7 = AUDIT READY
Implementation scope = DEFINED (4 MUST + 3 SHOULD; MUST NOT перечислен)
Blocking ambiguity = NONE
```

**Open decision points для approval (не блокируют planning, требуют решения на implementation phase):**

1. **Destructive confirmation:** добавить ли confirm на `reject`/`unavailable`/`customerDecline` (parity с OrderActionBar) или сохранить текущую no-confirm семантику Request-flow? Audit-рекомендация: сохранить текущую семантику (actions уже server-gated в узком deadline-окне; confirmation = UX change, не UI-migration change), если отдельно не утверждено обратное.
2. **Propose-price input relocation:** перенос в RequestActionBar сохраняет текущую inline-toggle UX (рекомендация) — не превращать в modal/drawer (новый pattern, вне migration scope).

Migration затрагивает ровно один production page + один новый shared компонент + один spec. Backend: 0 изменений. Бизнес-логика, security, API, lifecycle: неизменны.

---

**STOP — UI-C7 не реализуется. Implementation prompt не создаётся.**
