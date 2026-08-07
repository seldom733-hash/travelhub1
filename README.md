# TravelHub — Phase 1

Реализация по промпту `docs/prompts/TravelHub_Implementation_Prompt.md`:
сквозной процесс **Product → Order → Booking** на модульном монолите с
отдельными схемами PostgreSQL на домен (DDD, event-driven, transactional outbox).

## Структура

```
├── backend/    NestJS модульный монолит + REST /api/v1/{domain}/...
├── frontend/   Next.js — 4 рабочих центра (Catalog, Order, Booking, CRM mini)
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

Между схемами **нет foreign keys** — только ссылки по ID. Домен пишет только в
свою схему; интеграция — только через события (см. `docs/contracts/events.md`).

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
npm run dev            # http://localhost:3000

# 4. E2E-тест полного сценария Phase 1
cd backend && npm run test:e2e
```

## Проверка Phase 1 (e2e-сценарий)

`backend/test/phase1.e2e-spec.ts` (Jest + Supertest) прогоняет DoD:

```
Product → Customer → bootstrap Order (ORD-*, TH-*) → traveler validation →
Ready for Booking (OrderApproved) → BookingRequested → Booking (BKG-*) + Passenger →
BookingConfirmed → Order aggregate: PARTIALLY_FULFILLED → FULFILLED → CLOSED
```

Плюс: идемпотентность consumer-ов, correlation/causation трассировка, аудит.

## Документация

- `docs/adr/ADR-0001-modular-monolith.md` — архитектурное решение
- `docs/contracts/events.md` — Event Catalog и контракты payload
- `docs/contracts/api.md` — REST API и ownership
- `docs/contracts/ids.md` — каноническая ID Policy
- `docs/phase1-dod.md` — Definition of Done (всё выполнено)
