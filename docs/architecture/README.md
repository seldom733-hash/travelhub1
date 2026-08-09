# TravelHub — Архитектура (Phase 1 + Phase 2 Auth/RBAC)

Реализация по `docs/prompts/TravelHub_Implementation_Prompt.md`:
сквозной процесс **Product → Order → Booking** на модульном монолите с
отдельными схемами PostgreSQL на домен. Phase 2 добавляет аутентификацию
(JWT) и RBAC (10 канонических ролей + granular permissions).

## Содержимое

| Документ | Описание |
|---|---|
| `architecture/README.md` | Этот индекс |
| `architecture/temporal-readiness.md` | Temporal & Analytics Readiness (Step 1.13A): taxonomy, source-of-truth matrix, gaps |
| `adr/ADR-0001-modular-monolith.md` | Выбор архитектуры и стека |
| `adr/ADR-0002-auth-rbac.md` | Аутентификация и RBAC (Phase 2) |
| `adr/ADR-0009-correlation-request-context.md` | Correlation / Request ID infrastructure (Step 1.15) |
| `adr/ADR-0010-business-event-envelope.md` | Business Event Envelope (Step 1.15A): actor/entityId/occurredAt, writer + consumer contract |
| `adr/ADR-0011-communication-foundation.md` | Communication Foundation (Step 1.16): canonical cross-domain CML-*, новый bounded context `communication.*` |
| `contracts/events.md` | Event Catalog + контракты payload |
| `contracts/api.md` | REST API, API Ownership и права доступа |
| `contracts/ids.md` | Каноническая ID Policy |
| `phase1-dod.md` | Definition of Done + чек-лист |

## Стек

- **Backend** — NestJS модульный монолит (`backend/`): `CatalogModule`,
  `CrmModule`, `OrderModule`, `BookingModule`, `SecurityModule`, глобальные
  `PrismaModule` и `EventBusModule`. REST `/api/v1/{domain}/...`.
- **БД** — PostgreSQL, схема на домен: `events`, `catalog`, `crm`, `order`,
  `booking`, `security`, `communication`. Без FK между схемами — только ссылки
  по ID. ORM — Prisma 7 (multiSchema), миграции в `backend/prisma/migrations/`.
- **Event Bus** — transactional outbox (`events.OutboxEvent`) + in-process
  диспетчер + inbox идемпотентности (`events.InboxEvent`). Correlation/causation
  наследуются из request context (Step 1.15, ADR-0009).
- **Request context** — AsyncLocalStorage (`backend/src/shared/request-context.ts`)
  + middleware: server-authoritative `X-Request-Id`, correlation=requestId для
  HTTP flow, consumer context (inherited correlation, causation=parent eventId).
- **Auth/RBAC** — JWT (`@nestjs/jwt`) + bcrypt; глобальные
  `JwtAuthGuard`/`PermissionsGuard`; каталог прав и маппинг ролей в
  `backend/src/security/permissions.constants.ts`; аудит в `security.AuditLog`.
- **Frontend** — Next.js 16 (`frontend/`): 4 рабочих центра с единой
  композицией Header / Filters / KPI / Workspace / Side Panel + страница
  `/login` (JWT в localStorage, автоматический выход по 401).
- **Тесты** — Jest + Supertest: `backend/test/phase1.e2e-spec.ts` (сквозной
  процесс) и `backend/test/auth-rbac.e2e-spec.ts` (Phase 2).

## Быстрый старт

```bash
# Backend
cd backend
npm install
npx prisma migrate deploy
npm run dev          # http://localhost:4000/api/v1

# Frontend
cd frontend
npm install
npm run dev          # http://localhost:3000 → /login (admin/admin123)

# E2E-тесты (Phase 1 + Phase 2)
cd backend && npm run test:e2e
```

БД: `travelhub1` (postgres://postgres:postgres@localhost:5432/travelhub1).
