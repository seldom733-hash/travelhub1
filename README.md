# TravelHub

Платформа организации путешествий и туристических услуг: каталог продуктов и
услуг, marketplace с публичными витринами партнёров, обратный маркетплейс
(Buyer Request → Matching → Proposal → Sale), сквозной коммерческий процесс
**Sales → Order → Booking** и финансовый домен. Модульный монолит, DDD,
event-driven интеграция с transactional outbox.

## Обзор

- **Backend** — NestJS модульный монолит, REST `http://localhost:4000/api/v1/...`;
  durable event delivery — фоновый outbox-воркер (advisory-lock serialized,
  Step 2.17): PENDING публикуются, retryable FAILED ретраятся автоматически.
- **Frontend** — Next.js (App Router), RU/AZ/EN: каталог, search, витрины
  `/store/:slug`, Partner Cabinet, Buyer Cabinet `/account/*`, internal staff UI
  `/app/*`.
- **Данные** — PostgreSQL, домен владеет своей схемой (10 схем), между схемами
  нет foreign keys — только ссылки по ID.
- **Интеграция** — только через события (transactional outbox + inbox
  deduplication), correlation/causation сквозь цепочку (ADR-0009/0010).
- **Безопасность** — JWT auth + granular RBAC (10 канонических ролей), права
  перечитываются из БД на каждый запрос, аудит в `security.AuditLog`. Сессия —
  серверная HttpOnly cookie (`travelhub.auth`, Secure в prod, SameSite=Lax);
  logout реально инвалидирует токены через `User.tokenVersion` (Step 2.17).

## Архитектура в двух словах

Каждый бизнес-домен — отдельный NestJS-модуль и отдельная PostgreSQL-схема.
Домен пишет только в свою схему; кросс-доменное взаимодействие — по ID и через
доменные события, а не прямыми записями. Детали — в
[ADR-0001](docs/adr/ADR-0001-modular-monolith.md) и
[architecture docs](docs/architecture/README.md).

## Структура репозитория

```
├── backend/    NestJS модульный монолит + Prisma + миграции (единственный backend)
├── frontend/   Next.js (App Router), RU/AZ/EN
├── docs/       Roadmap, ADR, архитектура, контракты API/событий/ID, screen design
├── legacy/     Предыдущая версия проекта (Next.js + SQLite) — НЕ текущий runtime
├── .github/    CI workflow (см. «CI/CD» ниже — на текущий момент нерабочий)
├── docker-compose.yml  Локальный MinIO (S3-совместимое хранилище для ProductMedia)
└── scripts/    Вспомогательные скрипты
```

**Корень репозитория НЕ является npm-пакетом** (нет `package.json` /
`package-lock.json`). Все npm-команды выполняются из каталогов пакетов —
`backend/` или `frontend/`.

## Технологический стек

| Слой | Стек |
|---|---|
| Backend | NestJS, Prisma (PostgreSQL multiSchema), JWT, bcrypt, Jest (unit + e2e) |
| Деньги | `Prisma.Decimal` / decimal.js — никогда float в финансовых расчётах |
| Storage | S3-совместимый object storage (MinIO локально) для ProductMedia |
| Frontend | Next.js, React, TypeScript, Vitest, ESLint |
| Инфраструктура | PostgreSQL 15+, Docker Compose (MinIO) |

Актуальные версии — в `backend/package.json` и `frontend/package.json`.

## Бизнес-домены

| Домен | Схема | Ответственность |
|---|---|---|
| Catalog | `catalog` | Product/ProductDraft, Tariff, Availability, ProductMedia, PublicSellerProfile, PartnerStorefront, модерация, change proposals, коммерческие ограничения |
| CRM | `crm` | Customer, Partner, Company, Contact, Supplier; Buyer↔Customer mapping (`User.customerId`) |
| Sales | `sales` | Lead → Opportunity → Quote → CheckoutIntent → Sale → `OrderRequested` |
| Reverse | `reverse` | Buyer Request, Seller Capabilities, Matching, Proposal, pre-sale conversations, конверсия в Sale |
| Order | `order` | Order aggregate, lifecycle, temporal contract, `OrderRequested` consumer |
| Booking | `booking` | Booking lifecycle, temporal milestones, service time model |
| Communication | `communication` | Conversations/messages (foundation) |
| Finance | `finance` | Master data (Currency/ExchangeRate/Tax/TaxRule), immutable факты (LedgerTransaction, ProviderFee/Settlement/Payout); Payment/Refund/Invoice/Commission — schema-only, runtime deferred |
| Security | `security` | User, Role, Permission, RBAC, JWT auth, AuditLog |
| EventBus (инфраструктура) | `events` | Transactional outbox, inbox dedup, доменные события, счётчики ID |

Не все домены имеют полный production UI: финансовый UI минимален, часть
коммерческих процессов реализована на уровне backend-фундамента.

## Быстрый старт

Требования: **Node 20+**, **PostgreSQL** (локально), `psql` в PATH (нужен для
e2e), Docker (для MinIO).

```bash
# 1. Клонировать репозиторий и настроить окружение
cp backend/.env.example backend/.env    # и отредактировать под себя

# 2. Поднять локальную инфраструктуру (только ProductMedia)
docker compose up -d minio

# 3. Backend (порт 4000)
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev

# 4. Frontend (порт 3000)
cd frontend
npm install
npm run dev
```

Демо-вход: `admin` / `admin123` (задаётся через `ADMIN_USERNAME` /
`ADMIN_PASSWORD` в `backend/.env`; в проде обязательно сменить `JWT_SECRET`).

## Переменные окружения

Шаблон — `backend/.env.example` (без секретов). Категории:

- `DATABASE_URL` — основная PostgreSQL-БД;
- `TEST_DATABASE_URL` — изолированная e2e-БД (имя **обязано** оканчиваться на
  `test`, иначе e2e откажется запускаться);
- `PORT`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`;
- `S3_*` — S3-совместимое хранилище (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
  `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE`).

## База данных и миграции

- PostgreSQL **multiSchema**: 10 доменных схем (см. выше), модели — в
  `backend/prisma/schema.prisma`; миграции — в `backend/prisma/migrations/`.
- Канонический workflow: `prisma migrate dev --create-only` (просмотр SQL) →
  `prisma migrate deploy` (применение). **`prisma db push` для канонических
  изменений запрещён.**
- Статус: `cd backend && npx prisma migrate status`.
- e2e-global-setup создаёт изолированную тестовую БД `*_test` (drop+recreate) и
  применяет **реальные** миграции — свежий checkout воспроизводится штатно.

## Локальный запуск и тесты

### Backend (`cd backend`)

```bash
npm run typecheck   # tsc --noEmit
npm test            # unit (jest --runInBand)
npm run test:e2e    # полный serial e2e (jest --config test/jest-e2e.json --runInBand)
npm run build       # tsc -p tsconfig.build.json
```

e2e требует: PostgreSQL + `psql` в PATH, `TEST_DATABASE_URL` (имя с суффиксом
`test`), сетевой доступ для автоскачивания изолированного MinIO-бинаря
(порт 19000, bucket `travelhub-media-test` — dev/prod storage не затрагивается).
Одновременно допускается только один e2e-прогон на одну тестовую БД.

### Frontend (`cd frontend`)

```bash
npx tsc --noEmit     # typecheck
npm test             # vitest run
npm run lint         # eslint
npm run build        # next build
```

## CI/CD

Workflow `.github/workflows/ci.yml` (Step 2.17):

- работает из **корней пакетов** (`backend/`, `frontend/`), а не из корня репо;
- backend: `npm ci` → `tsc --noEmit` → unit → `prisma migrate deploy` на
  PostgreSQL service (multiSchema, реальные миграции) → полный serial e2e;
- frontend: `npm ci` → `tsc --noEmit` → vitest → production build;
- `legacy/` в CI не участвует (отдельный исторический проект, см. ниже);
- SQLite-конфигурация legacy-версии в CI не используется.

## Документация

- **Roadmap** (канонический план + текущий NEXT): `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- **Архитектура**: `docs/architecture/README.md` (+ отдельные артефакты по шагам)
- **ADR**: `docs/adr/` (ADR-0001 … ADR-0013)
- **Контракт API**: `docs/contracts/api.md`
- **Контракт событий**: `docs/contracts/events.md`
- **ID-политика**: `docs/contracts/ids.md`
- **Screen Design**: `docs/prompts/TravelHub_Screen_Design_Brief_Baseline_1.6_PAYMENTS_FINAL.md`
- **Отчёты шагов / strict-review**: `docs/prompts/` и `docs/architecture/`

## Директория `legacy/`

`legacy/` — **предыдущая версия проекта** (отдельное Next.js-приложение на
SQLite со своим `package.json`, `prisma/schema.prisma`, `dev.db`). Это **не**
текущий backend/frontend:

- CI/build/deploy не должны его использовать;
- его SQLite/package-конфигурация не является текущей конфигурацией приложения;
- команды и настройки оттуда копировать нельзя;
- директория оставлена для истории и не удаляется в рамках текущих проходов.

## Текущий статус разработки

Каноническая последовательность шагов, статусы и текущий NEXT поддерживаются в
[`docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`](docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md)
— смотрите его как источник истины, а не фиксированные числа в README.

## Известные ограничения

- **PSP-интеграция не реализована**: Finance — фундамент (master data +
  immutable факты); Payment/Refund/Invoice/Commission runtime, settlement engine,
  partner payout rail — deferred (шаги 2.12–2.14).
- **Финансовый UI** минимален (нет полноценного Finance Center во frontend).
- **Login rate limiter** — in-memory per-instance (single-instance deployment;
  при горизонтальном масштабировании требуется external store — известно и
  документировано в Step 2.17).
- Часть бухгалтерских/коммерческих процессов (commission collection,
  settlement lifecycle, reconciliation) — deferred.
