# PHASE 2 — STEP 2.2 — SALES CENTER (BACKEND)

Статус: IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW
Базовая линия: `master @ 047a6b6` (v0.8.0) + Step 2.1 (sales domain foundation).

## 1. Current → Target

**Current (после 2.1):** `sales.*` — Lead/Opportunity/Quote/Sale + history, минимальные CRUD
и lifecycle-команды, RBAC-гейты по `sales.*`, canonical коды LED/OPP/QTE/SAL.
Нет: фильтров/поиска/сортировки/пагинации, истории, назначений, KPI/очередей.

**Target (2.2):** Sales Center read-модели и operational API:
- расширенные списки (filters/search/sort/pagination, total/hasMore);
- history endpoint для каждой сущности;
- assign/reassign/unassign (CAS по `version`);
- `GET /sales/center/kpi` — count-based операционная агрегация;
- `GET /sales/center/queues` — вычислимые статус-очереди (FIFO).

**НЕ реализовано** (owner-шаги позже): Sales Center UI (2.7), Quote pricing/acceptance
(2.3), Checkout Context (2.3A), Sale → OrderRequested (2.4), Order consumer (2.5),
KPI финансовые/экономические (revenue/GMV/payment/order/booking).

## 2. Domain ownership

Sales остаётся единственным владельцем `sales.*`. Sales Center — **read-модели поверх
собственных сущностей**, не новые сущности и не cross-domain writes. Никаких write в
Catalog/CRM/Order/Booking/Security (ADR-0001). Cross-domain refs — read-by-ID без FK.

## 3. RBAC (N2 least-privilege)

| Роль | Entity read | KPI (`sales.kpi.read`) | Queues |
|---|---|---|---|
| SALES_MANAGER | ✅ все | ✅ | ✅ (по entity read ключа очереди) |
| DIRECTOR | ✅ broad read | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ |
| ANALYST | ❌ raw | ✅ агрегат only | ❌ |
| MARKETER | ❌ raw | ✅ агрегат only | ❌ |
| FINANCE | `sale.read` only | ✅ (kpi.read) | ❌ |
| BUYER / PARTNER / MODERATOR / anonymous | ❌ | ❌ | ❌ |

KPI — только count-based operational метрики: `total/byStatus/unassigned` по
Lead/Opportunity/Quote/Sale + период. Никаких денежных/финансовых полей.
Очереди резолвят permission по ключу очереди (`SALES_QUEUES[key].permission`) —
невалидный ключ → 400 через DTO whitelist до доступа к БД.

## 4. API surface

```
GET  /sales/{entity}                 — список: status/assignedToId/customerId/code/search + sort/order/page/pageSize
GET  /sales/{entity}/:code           — деталь
GET  /sales/{entity}/:code/history   — immutable history (created → status_changed → assigned)
POST /sales/{entity}/:code/assign    — assign/reassign/unassign (CAS version → 409)
POST /sales/{entity}/:code/transition— lifecycle-переход (CAS, terminal-guard)
POST /sales/quotes/:code/issue       — Quote DRAFT → ISSUED
GET  /sales/center/kpi               — count-based агрегация (sales.kpi.read)
GET  /sales/center/queues            — статус-очереди (entity read permission)
```

Sort whitelist: `createdAt/code/status` (DTO IsIn); tie-breaker `code asc` (не `id`).
`updatedAt` НЕ в whitelist — temporal contract (не использовать updatedAt как
lifecycle). Search: display label `name`/`title` (trim + cap 80, case-insensitive
contains, parameterized); exact `code` — отдельный фильтр. Period: ISO UTC
inclusive; from > to → 422. Max pageSize 50 (DTO Max(50), сервис дублирует);
page ≥ 1; total/hasMore от полного dataset; детерминированный порядок.

## 5. KPI dictionary

Только операционные counts (никаких финансов):
`leads{total,byStatus,unassigned}`, `opportunities{...}`, `quotes{total,byStatus}`,
`sales{total,byStatus}`, `period{from,to}`. Zero-state без NaN/Infinity.

## 6. Queues

Ключи: `NEW_LEADS, QUALIFIED_LEADS, UNASSIGNED_LEADS, NEW_OPPORTUNITIES,
OPEN_OPPORTUNITIES, UNASSIGNED_OPPORTUNITIES, DRAFT_QUOTES, ISSUED_QUOTES,
OPEN_SALES`. FIFO oldest-first, пагинация. Predicate ↔ KPI согласованы (e2e #7).

## 7. Assign

Только staff-роли (`SALES_ASSIGN_FORBIDDEN_KEYS` guard): BUYER/PARTNER/MODERATOR →
422. Staff validate role (staff-only). CAS `version` → double-assign 409, ровно один
history-milestone + audit. Unassign = assignedToId null.

## 8. Concurrency / idempotency

CAS по `version` (все мутации). Уникальные коды через `events.BusinessSequence`
(атомарный upsert в tx домена). Один переход → один history-milestone.

## 9. Temporal

`createdAt/updatedAt` — entity-time; milestones (status_changed/assigned) — в history
с actor и from/to. UTC. Для будущей аналитики достаточны.

## 10. Isolation proofs

- actions не создают Order/Booking, outbox без OrderRequested (e2e #12);
- response без PII (customer только id-ref; без паспортных/контактных полей);
- аноним → 401; BUYER/PARTNER/MODERATOR → 403; ANALYST raw → 403, kpi → 200.

## 11. Migration

`20260809222028_add_sales_center_indexes` — 6 композитных индекса (status+createdAt,
assignedToId+status) по Lead/Opportunity/Quote/Sale. Аддитивная, без backfill.
Clean replay — через e2e globalSetup (`migrate deploy` на свежей test DB), drift —
`migrate status` up to date.

## 12. Tests

- unit `sales.filters.spec.ts` (16/16): сортировка whitelist, порядок, пагинация,
  search, period, fallback при невалидном поле;
- e2e `sales-center.e2e-spec.ts` (12/12): аноним/KPI zero-state; BUYER/PARTNER/
  MODERATOR 403; SM operational; RBAC N2 (ANALYST/MARKETER/FINANCE/DIRECTOR);
  filters; pagination; queues; KPI mixed-state; history; lifecycle через Center;
  assign CAS/409/422; изоляция (без Order/Booking/OrderRequested, без PII).
- полный serial e2e: 482/482 (32 спека); unit: 246/246; frontend: tsc clean,
  vitest 135/135, next build OK.

## 13. Runtime verification (isolated instance, port 4007)

- anonymous `/sales/center/kpi` → 401;
- SALES_MANAGER: create lead (LED-00000046), kpi 200, queue NEW_LEADS 200,
  filtered list 200;
- ANALYST: kpi 200, raw `/sales/leads` → 403;
- BUYER: kpi → 403;
- все ошибки — канонический envelope с `requestId`;
- невалидный queue key → 400 (whitelist).

## 14. Issues

- Shared-DB flake в Step 1.18 `outbox-failure-injection` (абсолютные счётчики
  `publishPending()` ловят чужие PENDING-строки из предыдущих спеков в serial
  прогоне). Исправлено: beforeAll очищает PENDING/FAILED rows общих outbox
  (предыдущие спеки уже завершены) — регрессия стала детерминированной.

## 15. Capability readiness (dynamic access model)

Backend authority — permission/capability-based (JwtAuthGuard загружает
permissions пользователя из БД; PermissionsGuard проверяет `@RequirePermissions`;
роль → права — только пресет `ROLE_PERMISSIONS`). В Sales Center НЕТ role-name
gating для авторизации: единственная role-проверка — `assertOptionalUser`
(assignee обязан быть internal staff — business-ограничение на целевого
пользователя, не авторизация актора).

Зафиксировано (Roadmap Step 3.12E + DD-021):

> System roles are permission presets, not permanent organizational job
> boundaries. Один internal user архитектурно может иметь capabilities
> нескольких work centers (Customers/Sales/Suppliers/Orders/Bookings/
> Communications/Finance) — особенно для малых организаций. Per-user
> capability assignment поддерживается архитектурно (permissions независимы
> от role names; user→permission маппинг возможен без правки доменного кода).
> Sidebar/navigation — permission-driven; backend permission checks
> authoritative (скрытие меню ≠ security). Admin UI — Step 3.13.

## 16. Out of scope

Sales Center UI, Quote pricing/snapshot/acceptance, Checkout, OrderRequested,
Order/Booking changes, Payment/Finance, аналитика экономическая, экспорт —
не начаты. Frontend не изменён.
