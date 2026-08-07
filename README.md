# TravelHub — Phase 1 + Phase 2 (Auth/RBAC)

Реализация по промпту `docs/prompts/TravelHub_Implementation_Prompt.md`:
сквозной процесс **Product → Order → Booking** на модульном монолите с
отдельными схемами PostgreSQL на домен (DDD, event-driven, transactional outbox).
Phase 2 добавляет **аутентификацию (JWT) и RBAC** с каноническими ролями.

## Структура

```
├── backend/    NestJS модульный монолит + REST /api/v1/{domain}/...
├── frontend/   Next.js — 4 рабочих центра (Catalog, Order, Booking, CRM mini) + логин
├── docs/       ADR, контракты событий/API/ID, DoD-чек-лист
└── legacy/     Предыдущая версия проекта (v0.6.0, справочный материал)
```

## Домены и схемы БД

| Домен | Схема | Сущности |
|---|---|---|
| EventBus (инфраструктура) | `events` | outbox, inbox, счётчики ID |
| Catalog Center | `catalog` | Product, Category, Tariff, Availability |
| CRM mini | `crm` | Customer, Contact, Company, Partner, Supplier |
| Order Center | `order` | Order, OrderItem, OrderTraveler, Fulfillment |
| Booking Center | `booking` | Booking, Reservation, SupplierConfirmation, Passenger |
| **Auth + RBAC (Phase 2)** | `security` | **User, Role, Permission, RolePermission, AuditLog** |

Между схемами **нет foreign keys** — только ссылки по ID. Домен пишет только в
свою схему; интеграция — только через события (см. `docs/contracts/events.md`).

## Аутентификация и RBAC (Phase 2)

- **JWT** (Bearer) + bcrypt; глобальный `JwtAuthGuard` + `PermissionsGuard`
  (`@Public()` открывает только `register`/`login`).
- **10 канонических ролей** по RBAC Matrix: ADMIN, DIRECTOR, FINANCE, MARKETER,
  ANALYST, MODERATOR, SALES_MANAGER, OPERATOR, PARTNER, BUYER.
- **Granular permissions** (не `domain:write`): `order.accept`, `booking.confirm`,
  `catalog.product.publish` и т.д. — `backend/src/security/permissions.constants.ts`.
- Права читаются из БД на каждый запрос — смена роли применяется сразу.
- **Аудит** безопасности: вход/выход, смена роли, статус — `security.AuditLog`.

### Демо-доступ

| Роль | Логин | Пароль |
|---|---|---|
| ADMIN | `admin` | `admin123` |

> В проде обязательно задайте `JWT_SECRET` и `ADMIN_PASSWORD` в `backend/.env`.
> Регистрация (`POST /auth/register`) создаёт только роль BUYER; персонал
> заводит ADMIN через `POST /api/v1/users` (право `settings.write`).

## Быстрый старт

Требования: Node 20+, PostgreSQL (локально, `postgres/postgres@localhost:5432`).

```bash
# 1. База данных (один раз)
psql -U postgres -h localhost -c "CREATE DATABASE travelhub1;"

# 2. Backend (порт 4000)
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
npm run build
npm run dev            # http://localhost:4000/api/v1

# 3. Frontend (порт 3000)
cd frontend
npm install
npm run dev            # http://localhost:3000 → /login (admin/admin123)

# 4. E2E-тесты (Phase 1 + Phase 2)
cd backend && npm run test:e2e
```

## Проверка (e2e)

- `backend/test/phase1.e2e-spec.ts` — сквозной процесс Phase 1:
  Product → Customer → Order → Booking → синхронизация статусов;
- `backend/test/auth-rbac.e2e-spec.ts` — Phase 2: seed ролей, login/me,
  401 без токена, BUYER read-only, ANALYST без команд, смена роли,
  OPERATOR выполняет Order/Booking lifecycle, аудит.

## Документация

- `docs/adr/ADR-0001-modular-monolith.md` — архитектурное решение
- `docs/adr/ADR-0002-auth-rbac.md` — аутентификация и RBAC
- `docs/contracts/events.md` — Event Catalog и контракты payload
- `docs/contracts/api.md` — REST API, ownership и права
- `docs/contracts/ids.md` — каноническая ID Policy
- `docs/phase1-dod.md` — Definition of Done (всё выполнено)
