# TravelHub Phase 1 — Архитектура

Реализация по `docs/prompts/TravelHub_Implementation_Prompt.md` (Phase 1):
сквозной процесс **Product → Order → Booking** на модульном монолите с
отдельными схемами PostgreSQL на домен.

## Содержимое

| Документ | Описание |
|---|---|
| `architecture/README.md` | Этот индекс |
| `adr/ADR-0001-modular-monolith.md` | Выбор архитектуры и стека |
| `contracts/events.md` | Event Catalog + контракты payload |
| `contracts/api.md` | REST API и API Ownership |
| `contracts/ids.md` | Каноническая ID Policy |
| `phase1-dod.md` | Definition of Done + чек-лист |

## Стек

- **Backend** — NestJS модульный монолит (`backend/`): `CatalogModule`,
  `CrmModule`, `OrderModule`, `BookingModule`, глобальные `PrismaModule` и
  `EventBusModule`. REST `/api/v1/{domain}/...`.
- **БД** — PostgreSQL, схема на домен: `events`, `catalog`, `crm`, `order`,
  `booking`. Без FK между схемами — только ссылки по ID. ORM — Prisma 7
  (multiSchema), миграции в `backend/prisma/migrations/`.
- **Event Bus** — transactional outbox (`events.OutboxEvent`) + in-process
  диспетчер + inbox идемпотентности (`events.InboxEvent`).
- **Frontend** — Next.js 16 (`frontend/`): 4 рабочих центра с единой
  композицией Header / Filters / KPI / Workspace / Side Panel.
- **Тесты** — Jest + Supertest, e2e полного сценария: `backend/test/phase1.e2e-spec.ts`.

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
npm run dev          # http://localhost:3000

# E2E-тест Phase 1
cd backend && npm run test:e2e
```

БД: `travelhub1` (postgres://postgres:postgres@localhost:5432/travelhub1).
