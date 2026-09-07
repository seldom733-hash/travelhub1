# PHASE 3 — UI-C4 — AUDIT HISTORY UNIFICATION — AUDIT REPORT

## 1. Executive Summary

Проведён read-only audit состояния Audit History на трёх canonical Commerce detail pages
(Request / Order / Booking). **Ключевой результат: backend-аудита Request СУЩЕСТВУЕТ
(Case A)** — gap чисто presentation-уровня.

| Сущность | Backend history | Endpoint | Frontend section |
|---|---|---|---|
| Request | ✅ `order.RequestHistory` + записи | ✅ `GET /api/v1/requests/:id/history` | ❌ **отсутствует** |
| Order | ✅ `order.OrderHistory` (D5) | ✅ `GET /api/v1/orders/:id/history` (paginated) | ✅ inline (страница) |
| Booking | ✅ `booking.BookingHistory` (D6) | ✅ `GET /api/v1/bookings/:id/history` | ✅ inline (страница) |

Order и Booking имеют **реальный immutable audit** (per-entity таблицы, транзакционно-связанные
с бизнес-мутацией, actor + timestamp + action + from→to, PII-safe redaction для Order),
а не «timeline под именем audit». Рендеринг при этом **дублирован inline** в двух страницах
с разной грамматикой (Order богаче: fields-diff, redaction, pagination; Booking беднее:
без fields, без пагинации, без empty/loading/error состояний).

Request history endpoint закрыт тем же permission (`order.read`), что и Order history;
нового permission/schema/RBAC не требуется. Единственное semantic-отклонение: Request
history endpoint не выполняет existence-guard (несуществующий id → 200 `[]`, у Order/Booking →
404). Это не блокирует UI (detail page 404-ится раньше), но фиксируется как опциональное
решение для approval.

**Вердикт: VERDICT A — READY FOR IMPLEMENTATION (OPTION A — UI-ONLY).**

## 2. Baseline

```bash
git rev-parse HEAD          → 586ffe739855b4e29514126abfe5e95e74b398a3
git rev-parse origin/master → 586ffe739855b4e29514126abfe5e95e74b398a3
git status --porcelain=v1   → только untracked audit docs (3 файла)
git diff --check            → PASS
WORKTREE                    → CLEAN (кроме untracked prompt/report docs)
```

## 3. Current Audit Architecture

### 3.1 Storage — per-entity immutable history (canonical authority)

`backend/prisma/schema.prisma`:

| Модель | Схема | Поля | Notes |
|---|---|---|---|
| `OrderHistory` | `order.*` | id, orderId(FK), action, from?, to?, **source?** (D5-R1), **fields Json?**, actorId?, actorName?, comment?, createdAt | D5 интегрирован |
| `RequestHistory` | `order.*` | id, requestId(FK), action, from?, to?, actorId?, actorName?, comment?, createdAt | **нет fields, нет source** |
| `BookingHistory` | `booking.*` | id, bookingId(FK), action, from?, to?, **fields Json?**, actorId?, actorName?, comment?, createdAt | **fields колонка есть, но не заполняется** (lifecycle-only) |

Плюс generic `security.AuditLog` (userId/username/action/resource/resourceId/details/ip/createdAt) —
**это security-журнал**, не entity change history; для entity-истории НЕ используется.
Общий core — `backend/src/shared/audit.ts` (event types, sources, `serializeAuditValue`,
`redactAuditValue` — PII-safe; SENSITIVE_AUDIT_FIELDS: passportNumber/birthDate/phone/email).

### 3.2 Endpoints (server-authoritative)

| Endpoint | Permission | Ответ | Guards |
|---|---|---|---|
| `GET /requests/:id/history` | `order.read` | `requestHistory[]` (raw array, createdAt desc) | нет existence/scope guard |
| `GET /orders/:id/history?page&pageSize` | `order.read` | `{ items, total, page, pageSize }` (pageSize≤100, stable sort createdAt desc + id desc) | 404 для missing; **404 для storefront** (`PLATFORM_SCOPE_DENIED_SOURCE`) |
| `GET /bookings/:id/history` | `booking.read` | `{ items, total, page:1, pageSize:100 }` (take 100) | 404 через `getBooking(id, viewer)` (viewer-scope) |

Источники: `request.controller.ts` L157-161 / `request.service.ts` L825; `order.controller.ts`
L247-255 / `order.service.ts` L1163; `booking.controller.ts` L202-209 / `booking.service.ts` L435.

### 3.3 Writes (append-only, tx-coupled)

- **Request** (`request.service.ts`): actions = `created`, `supplier_confirmed`, `supplier_rejected`,
  `supplier_unavailable` (через `supplierAction`), `supplier_proposed_price`, `customer_accepted`,
  `customer_declined`, `converted`. Комментарии — RU-строки на бэкенде.
- **Order** (`order.service.ts` + `order.subscribers.ts`): lifecycle actions + `update_traveler_d3`/
  `update_travelers`/`update_order_fields` с **fields-diff** (allowlist, redaction); `source` D5-R1.
- **Booking** (`booking.service.ts` + `booking.subscribers.ts`): lifecycle actions
  (`created`/`created_cancelled` системой, `send`/`confirm`/… оператором), from/to/comment;
  fields **не пишутся**.

### 3.4 Architecture docs

- `docs/architecture/ENTITY_CHANGE_AUDIT_FRAMEWORK.md` — canonical framework (D5): immutability,
  transactionality, PII-safety, actor model, source, server authority, pagination contract.
  §17 «Request future/requalification» **устарел** — Request history фактически интегрирована
  (таблица + записи + endpoint существуют).

## 4. Request Audit Gap

**Case A — backend exists.** Вопреки baseline-предположению «Request → Audit отсутствует»,
backend-источник ЕСТЬ:

```text
Модель:      order.RequestHistory (immutable, append-only)
Записи:      создаются во всех мутациях request.service.ts
Endpoint:    GET /api/v1/requests/:id/history (@RequirePermissions("order.read"))
DTO:         raw array RequestHistoryRow[] (action/from/to/actorId/actorName/comment/createdAt)
Scope:       platform-only (нет acquisitionSource у Request — storefront-ось не применяется)
```

Frontend-разрыв подтверждён: `frontend/app/app/requests/[id]/page.tsx` содержит Header,
MAIN (Overview/Actions/Supplier/Customer/Rejection), ASIDE (Timeline + Details), WIDE
(CommerceRelationChain) — **секция «История изменений» отсутствует**. Endpoint нигде
не потребляется frontend-ом (grep `requests/${id}/history` в frontend: 0 совпадений).

→ Проблема — **presentation-only**. Новый backend не нужен.

## 5. Order Audit

**Реальный audit** (не timeline): источник `order.OrderHistory`, authority — D5 framework +
server guards.

- Source/endpoint/DTO: см. §3.2; fields-diff присутствует (traveler edits, order field edits).
- Frontend: `frontend/app/app/orders/[id]/page.tsx` — WIDE slot, inline `EntitySectionCard
  title={t("bookings.change_history")}`:
  - строка: `orderActionLabel(action)` + timestamp; from→to через `StatusBadge`; comment;
    `fields[]` old→new с `renderFieldValue` + `fieldLabel` (d3.field.*), redacted-маркер;
    автор через `ti("order.history.author")`;
  - пагинация: `loadHistory(page)` append + «Показать ещё» (`order.history.show_more`);
  - empty state: `bookings.history_disclaimer`; loading — non-blocking; ошибка — silent catch.
- Permission: `order.read`; tenant: storefront → 404 (D4 isolation сохранён, e2e-доказано).
- Сортировка: createdAt desc + id desc (стабильная, e2e-доказано).

Вывод: семантика = аудит (immutable, кто/что/когда). Рендеринг — page-local duplication.

## 6. Booking Audit

**Реальный audit** (D6): источник `booking.BookingHistory`, authority — D6 + server guards.

- Source/endpoint/DTO: см. §3.2; только lifecycle-события (fields не пишутся).
- Frontend: `frontend/app/app/bookings/[id]/page.tsx` — WIDE секция, рендерится **только при
  `history.length > 0`**:
  - строка: `bookingActionLabel(action)`, from→to через `StatusBadge` (только если оба),
    comment, `fmtTs(createdAt) · actorName ?? "—"`;
  - НЕТ fields-рендеринга, НЕТ пагинации (backend cap 100), НЕТ empty/loading/error состояний.
- Permission: `booking.read`; tenant: viewer-scoped 404 через `getBooking`.

Вывод: семантика = аудит. Рендеринг — minimal inline duplication, states неполные.

## 7. Shared Component Analysis

Design contract (`docs/reports/PHASE_3_COMMERCE_CENTER_UI_CONSISTENCY_DESIGN_ARCHITECTURE_RECONCILIATION_REPORT.md`
§Audit History Contract + Reusable Component Inventory): `<EntityAuditHistory />` —
«What changed, who changed it, when?», append-only, Actor + timestamp + from→to, PII-safe,
отдельно от Business Timeline; Request ❌ missing, Order ✅, Booking ✅ (inline).

Общие semantics (все три сущности): immutable, actor, timestamp, action/event, from→to,
server authority, PII-safe. Различия:

| Аспект | Order | Booking | Request |
|---|---|---|---|
| fields[] diff | ✅ | — (колонка пуста) | — (колонки нет) |
| Pagination | ✅ (page≤100) | cap 100 (одна страница) | full array |
| Action labels | `order.action.*` | `booking.action.*` | **нет ключей** |
| States | loading/empty/error (неполные) | нет | нет секции |

→ Вывод: допустим **shared shell + entity-адаптер** (нормализация ответа: raw array vs
`{items}`; mapper action-лейблов; опциональный fields/pagination-рендер), НЕ форсировать
объединение несовместимой бизнес-грамматики. Это соответствует промпту §12.

## 8. Data Contract Matrix

| Area | Request | Order | Booking | Canonical source | Gap | Action |
|---|---|---|---|---|---|---|
| Audit source | ✅ RequestHistory | ✅ OrderHistory | ✅ BookingHistory | per-entity immutable tables | — | reuse |
| Endpoint | ✅ `GET /requests/:id/history` | ✅ `GET /orders/:id/history` | ✅ `GET /bookings/:id/history` | controllers | — | reuse |
| Permission | `order.read` | `order.read` | `booking.read` | @RequirePermissions | — | reuse |
| Tenant scope | platform-only | storefront→404 | viewer→404 | D4/D5/D6 | Request: нет existence-guard на history (detail 404-ится) | keep canonical; опционально harden |
| Component | ❌ нет | ✅ inline (dup) | ✅ inline (dup) | design contract `<EntityAuditHistory/>` | dupl + missing | shared component |
| Timestamp | ✅ createdAt | ✅ createdAt | ✅ createdAt | createdAt | — | render |
| Actor | ✅ actorId/actorName | ✅ actorId/actorName | ✅ actorId/actorName | actor model | — | render |
| Action | ✅ 8 actions | ✅ action | ✅ action | action string | **i18n request.action.\*** | new keys RU/AZ/EN |
| Old/New | ✅ from/to | ✅ from/to + fields[] | ✅ from/to | lifecycle + field-diff | fields only Order | optional fields render |
| Loading | — | non-blocking | — | — | Booking/Request | shared loading |
| Empty | — | disclaimer | скрыта секция | — | Booking/Request | shared empty state |
| Error | — | silent | silent | — | — | shared error (non-blocking) |
| i18n | ❌ нет action-ключей | ✅ order.action.\* | ✅ booking.action.\* | i18n.tsx | request.action.* | new keys |
| A11y | — | h3 + строки | h3 + строки | EntitySectionCard/Row | — | keep grammar |
| Sorting | createdAt desc | createdAt desc,id desc | createdAt desc | backend | — | reuse |

## 9. Security / RBAC / Tenant Analysis

- **Server authority**: все history endpoint'ы закрыты guard'ами `@RequirePermissions`
  (`order.read` / `booking.read`) — та же authority, что у detail endpoint'ов. UI-hiding не
  является authorization; backend остаётся источником истины.
- **Tenant/workspace**: Order history — 404 для storefront (D4 isolation, e2e
  `d5-storefront-scope-isolation`, `d5-order-fullpage-audit` T8); Booking history — viewer-scoped
  404 через `getBooking` (`d6-booking-remediation` SF-кейсы); Request — platform-сущность без
  storefront-оси.
- **IDOR**: для Order/Booking — защита через 404-поведение недоступной сущности; сохраняется.
  Request: несуществующий id на `/requests/:id/history` → 200 `[]` (отличие от Order/Booking).
  Влияние на UI-C4: страница сначала грузит `GET /requests/:id` (404), поэтому утечки нет.
  Опционально: existence-guard на history endpoint (минимальный backend-енричмент) — требует
  отдельного approval, НЕ обязателен для UI.
- **RBAC**: новый permission НЕ требуется; `audit.read` — для security AuditLog (общего
  endpoint-а чтения нет), entity-история использует domain read-права. `audit.read` остаётся
  untouched.
- **PII**: Order fields-diff redacted на сервере (`shared/audit.ts`) до записи; Booking/Request
  fields не пишутся — утечки PII через history нет.

## 10. i18n / Accessibility / Responsive Analysis

### i18n (frontend/lib/i18n.tsx)

| Ключ | Статус |
|---|---|
| `bookings.change_history` (заголовок секции, общий) | ✅ RU/AZ/EN |
| `bookings.history_disclaimer` (empty-state) | ✅ RU/AZ/EN |
| `order.action.*` (14 ключей) | ✅ |
| `booking.action.*` (13) + `booking.action_short.*` | ✅ |
| `order.history.author` / `.show_more` / `.redacted` | ✅ |
| `d3.field.*` (field labels, traveler) | ✅ |
| **`request.action.*`** (created/supplier_confirmed/supplier_rejected/supplier_unavailable/supplier_proposed_price/customer_accepted/customer_declined/converted) | ❌ **отсутствуют — новые ключи RU/AZ/EN** |

Hardcoded RU: комментарии в RequestHistory/BookingHistory пишутся backend-ом на RU, но UI
рендерит локализованный `action`-лейбл (Order/Booking) — для Request нужен такой же mapper.
Pre-existing вне scope: **Request Timeline labels захардкожены RU на backend**
(`request.service.ts` `dto.timeline`) — UI-C4 НЕ трогает Timeline (см. §11).

### Accessibility

- Секция: `EntitySectionCard` даёт семантический `<h3>` (заголовок секции) — сохранить.
- Записи читаются последовательно; каждый entry — отдельный блок (div) без интерактива;
  show-more — кнопка (keyboard-accessible, `disabled` при загрузке); переходы — `StatusBadge`.
- Никаких expandable-элементов в текущей грамматике — новых aria-контрактов не требуется.

### Responsive

- Грамматика `EntityRow`/flex-wrap уже адаптивна (375/768/1024/1280): строки переносятся,
  timestamp и action не обрезаются; `shrink-0` у timestamp в Order не даёт горизонтального
  overflow; fields-diff использует flex-wrap. Shared-компонент обязан сохранить эту грамматику.

## 11. Timeline vs Audit Separation

- `EntityTimeline` (business milestones) живёт в **ASIDE** (Request/Order/Booking);
  история изменений — в **WIDE** (Order/Booking; Request — добавить). Разделение UI-C1.1 R2
  §14 сохранено.
- Семантика: Timeline = milestones/current stage; Audit = immutable who/what/when. Не сливать.
- Backend: Request `dto.timeline` (milestones из полей сущности) отделён от `RequestHistory`.
- UI-C4: **не переносить** audit-события в Timeline и не переносить milestone'ы в Audit.

## 12. D7 Regression Boundary

- Order `financial-history` (payments/refunds, due/refundable/net) — отдельная WIDE-секция
  (`finance.history`), источник — `getPaymentHistoryForOrder`/`getRefundHistoryForOrder`;
  формулы `max(0,total-paid)` / `max(0,paid-refunded)` — server-derived. UI-C4 НЕ касается.
- Финансовая секция Order использует те же общие примитивы (`EntitySectionCard`,
  `EntityFinanceCell`, `formatPrice`) — не менять их.
- Заголовок `bookings.change_history` переиспользуется Order для audit-секции — остаётся
  общим для трёх страниц (это audit-секция, не финансовая).

## 13. Existing Test Coverage

### Backend e2e (backend/test)

| Suite | Покрытие |
|---|---|
| `d5-order-fullpage-audit.e2e-spec.ts` | Order history: pagination, stable ordering, server authorization, storefront→404, no update/delete paths |
| `d5-storefront-scope-isolation.e2e-spec.ts` | storefront history → 404 |
| `d6-booking-remediation.e2e-spec.ts` / `d6-booking-fullpage.e2e-spec.ts` | BookingHistory записи по lifecycle-переходам; endpoint; storefront 404 |
| `d6-audit-failure-rollback.e2e-spec.ts` | audit-запись атомарна с мутацией (trigger-injection rollback) |
| `d3-request-flow.e2e-spec.ts` | RequestHistory строки (created/converted) + temporal invariants; **НЕ проверяет GET endpoint-ответ** |
| `order-lifecycle-completion.e2e-spec.ts` | каждая мутация → ровно одна OrderHistory-строка; atomicity |
| `d7-financial-qualification.e2e-spec.ts` | financial-history endpoint |
| `rbac-*.e2e-spec.ts`, `pii-redaction.e2e-spec.ts` | permissions, redaction |

### Frontend (vitest, source-contract + render)

- `commerce-detail-system.spec.tsx` — asserts общих примитивов на 3 detail pages
  (в т.ч. Order audit-ключи, Booking history в WIDE slot, Timeline в ASIDE).
- `commerce-relation-chain.spec.tsx` — паттерн render-тестов shared-компонента
  (глубокие ссылки, aria-current, отсутствующие узлы, RU/AZ/EN).
- **Отсутствует**: render-тесты для audit-секции; source-contract assertions для
  `<EntityAuditHistory/>` на всех 3 страницах.

## 14. Gaps

| # | Gap | Severity | Fix owner |
|---|---|---|---|
| G1 | Request detail не имеет секции «История изменений» (endpoint есть) | **Core UI-C4** | UI |
| G2 | Order/Booking рендерят audit inline дублированием, разные грамматики | Core UI-C4 | UI |
| G3 | Booking audit: нет empty/loading/error; секция скрыта при пустой истории | Core UI-C4 | UI |
| G4 | Нет i18n-ключей `request.action.*` (8 действий) RU/AZ/EN | Core UI-C4 | UI |
| G5 | Request history endpoint: отсутствует existence-guard (200 [] для missing id; Order/Booking → 404) | Minor (не блокирует UI) | **опционально** backend — требует approval |
| G6 | Frontend-тестов на audit-секцию нет | Core UI-C4 | UI |
| G7 | Pre-existing: Request Timeline labels — hardcoded RU на backend | Known baseline | НЕ в scope UI-C4 |

## 15. Proposed Implementation Scope

### OPTION A — UI-ONLY (рекомендуется)

1. **Новый shared-компонент** `frontend/components/commerce/EntityAuditHistory.tsx`
   (по дизайн-контракту; shared shell + entity-адаптер):
   - вход: нормализованные `items` (action/from/to/actorName/comment/createdAt/fields?),
     `actionLabel(action)`, опциональные `total/page/pageSize` + `onLoadMore`, опциональный
     `fieldLabel`/`renderFieldValue` для fields-diff;
   - грамматика: EntitySectionCard (h3) + EntityRow строки, StatusBadge для from→to,
     timestamp locale-aware, автор, redacted-маркер, empty/loading/error states,
     show-more (a11y: кнопка, disabled).
2. **Request detail**: добавить WIDE-секцию `<EntityAuditHistory/>`, consume
   `GET /requests/:id/history` (raw array → items); non-blocking загрузка; empty-state.
3. **Order detail**: заменить inline-блок на shared-компонент (paginated, fields-diff,
   redaction — сохранить существующую грамматику/ключи).
4. **Booking detail**: заменить inline-блок на shared-компонент (cap 100, без fields).
5. **i18n**: новые ключи `request.action.*` (RU/AZ/EN) для 8 действий; общий empty-state
   ключ (или reuse `bookings.history_disclaimer`); reuse `bookings.change_history`.
6. **Tests**: frontend source-contract assertions (3 страницы используют общий компонент,
   Timeline остаётся в ASIDE, D7 не тронут) + render-тесты `EntityAuditHistory.spec.tsx`
   (RU/AZ/EN лейблы, from→to, actor, empty, redacted, show-more) по паттерну
   `commerce-relation-chain.spec.tsx`.
7. **НЕ менять**: backend, schema, RBAC, EntityTimeline, D7 financial section,
   CommerceRelationChain, OperationalNotes (UI-C5), Request Timeline labels (G7).

### OPTION B (не требуется; только если пользователь решит закрыть G5)

- Добавить existence-guard в `GET /requests/:id/history` (404 для missing request) —
  минимальный backend-енричмент для семантического паритета с Order/Booking.
  Прямых предпосылок нет; страница уже 404-ится через detail.

## 16. STOP Conditions

| Условие | Статус |
|---|---|
| Baseline mismatch | ✅ нет — HEAD == origin/master == `586ffe7` |
| Unexpected production modifications | ✅ нет — worktree чист (кроме untracked docs) |
| Missing canonical audit authority | ✅ нет — per-entity таблицы + endpoints |
| Request audit backend отсутствует | ✅ нет — **Case A: существует** |
| New schema required | ✅ нет |
| New permission required | ✅ нет |
| Tenant/RBAC ambiguity | ✅ нет — scope-гварды доказаны |
| Timeline/Audit semantics conflict | ✅ нет — разделены (ASIDE/WIDE) |
| Order/Booking history is not actually audit | ✅ нет — real immutable audit (D5/D6) |
| Canonical architecture contradiction | ✅ нет (framework doc §17 устарел в части «Request future» — фактическая интеграция существует) |

## 17. Recommendation

**Начать IMPLEMENTATION по OPTION A (UI-ONLY)** после approval. Scope — §15.
Опциональное решение по G5 (existence-guard на Request history endpoint) вынести
отдельным вопросом — по умолчанию НЕ выполняется (canonical behavior: detail-first 404).

## 18. Git Evidence

```text
BASELINE:      586ffe739855b4e29514126abfe5e95e74b398a3
HEAD:          586ffe739855b4e29514126abfe5e95e74b398a3
origin/master: 586ffe739855b4e29514126abfe5e95e74b398a3
WORKTREE:      CLEAN (untracked: 3 audit docs — prompts + roadmap report)
Изменения:     NO production code / tests / schema / API / UI / commits (этот audit)
```

## 19. Audit Verdict

```text
VERDICT A — READY FOR IMPLEMENTATION

CANONICAL AUDIT AUTHORITY:   proven (Request/Order/Booking per-entity immutable history + endpoints)
SCOPE:                       fully defined (OPTION A — UI-ONLY, §15)
DEPENDENCIES:                satisfied (UI-C1..C3 semantics accepted; backend endpoints exist)
SECURITY SEMANTICS:          proven (server authority, order.read/booking.read, scope guards, PII-safe)
ARCHITECTURE BLOCKER:        none

REQUEST GAP:                 presentation-only (Case A — backend exists)
OPTIONAL DECISION (G5):      existence-guard на /requests/:id/history — по отдельному approval

STOP — ждём approval пользователя на implementation scope (OPTION A).
```