# TravelHub / Navitravel — проект и технический аудит

Дата: 2026-10-25. Ревизия: `master` @ `fbe719b` + незакоммиченные изменения
(они сохранены и доведены, см. `REFACTORING.md`).
Аудит — статический (чтение кода, схемы, миграций) + исполняемый: typecheck,
unit-тесты, production build, `prisma validate` / `migrate status`,
`EXPLAIN ANALYZE` на dev-БД.

Итог одной строкой: архитектура модульного монолита состоятельна, критических
дефектов (P0) не найдено; исправлены 5 P1 (цены Voyager, RBAC supplier API,
утечка внутренних ошибок, видимость публичного каталога, красный baseline
тестов) и 6 P2; оставшиеся задачи — `REMAINING_WORK.md`.

---

## 1. Стек и окружение

| Слой | Факт |
|---|---|
| Backend | NestJS 11, TypeScript 5.7, Prisma 7.9.1 (`multiSchema`), PostgreSQL |
| Frontend | Next.js 16.2.12 (App Router), React 19.2.4, Tailwind CSS 4, phosphor-icons |
| Тесты | backend — Jest + ts-jest (unit) и 114 e2e-спецификаций; frontend — Vitest + Testing Library |
| Хранилище | S3-совместимое (MinIO локально), приватный bucket |
| Деньги | `Prisma.Decimal` / decimal.js, `toMoney2` (half-up, DECIMAL(12,2)) |
| Auth | JWT + HttpOnly cookie `travelhub.auth`, granular RBAC из БД, `User.tokenVersion` |
| Внешние системы | KOMPAS, SUMMERTOUR, KAZUNION, VOYAGER, ANEX, FSTRAVEL, AZAL/AVIASALES (флайты), WhatsApp (Baileys) |

Запуск: backend `npm run dev` (порт 4000, MinIO через `scripts/dev-minio.js`),
frontend `next dev` (3000). Корень репозитория — не npm-пакет.

## 2. Карта репозитория

```
backend/   NestJS монолит + Prisma (единственный backend)
frontend/  Next.js App Router, RU/AZ/EN
docs/      ADR, архитектура, контракты, roadmap, отчёты аудитов
legacy/    предыдущая версия (SQLite) — не runtime, в CI не участвует
reports/   артефакты текущего аудита (логи, EXPLAIN, скрипты проверок)
```

Backend: 23 доменных модуля + `security`, `eventbus`, `integrations`,
`prisma`, `shared`. Домены: `catalog`, `crm`, `sales`, `reverse`, `order`,
`booking`, `communication`, `finance`, `checkout`, `pricing`, `supplier`,
`geo`, `hotel-directory`, `analytics`, `dashboard`, `workspace`,
`constructor`, `marketing`, `support`, `documents`, `operational-notes`,
`crm-activity`.

Frontend: 16 групп маршрутов (`app/`), включая 23 административных раздела
`/app/*` (dashboard, command-center, requests, orders, bookings, payments,
finance, crm, partners, catalog, pricing, marketing, support, documents,
whatsapp, users, geography, hotel-directory, page-builder, seller-profiles,
settings, analytics, help). 85 файлов `page/layout/route`, 146 компонентов.

## 3. Данные

PostgreSQL, 17 схем: `catalog, crm, sales, reverse, order, booking,
communication, finance, security, events, geo, decision, documents,
constructor, marketing, support, whatsapp`. 137 миграций, схема и БД
синхронны (`prisma migrate status`: «Database schema is up to date»,
`prisma validate`: OK).

Ключевые инварианты (проверены тестами `commerce-chain.invariants`):
- сквозная нумерация `referenceNumber` (`MKT-ORD-…`, `MKT-BKG-…`, `MKT-PAY-…`);
- `Request → Order` делят `commerceSequence`; temporal-порядок соблюдён;
- Payment ordinal уникален в рамках Order; refund ≤ payment и та же валюта;
- Tenant isolation: `CRM-*`, `PAR-*`, `PRN-*` коды неизменны;
- Customer 360 исключает `PARTNER_STOREFRONT`-заказы.

Продукты: 17 589 PUBLISHED в dev-БД (туры+отели+сервисы). Каноническая
идентичность гостиницы — `catalog.Hotel` + `HotelSupplierRef`
`(supplierCode, externalKey)`, фото и имя карточки берутся из реестра.

## 4. Потоки запросов

- **Публичный витринный контур**: Next App Router → `/api/v1/public/*`
  (`PublicCatalogController`, `PublicSuggestController`,
  `PublicSupplierController`) → Prisma. Только PUBLISHED + `publishedAt` +
  канал публикации; DTO без internal-полей; медиа — signed redirect.
- **Staff/партнёрский контур**: cookie/JWT → глобальные `JwtAuthGuard` +
  `PermissionsGuard` (fail-closed) → контроллер → сервис. Объектный scope
  PARTNER проверяется в сервисах (`CatalogAccessPolicy` и аналоги).
- **Синхронизации поставщиков**: `SupplierController` (HTTP, staff),
  `PublicSupplierController` (поиск/refresh/календарь, anonymous), CLI-скрипты
  `backend/scripts/*`, фоновые outbox-воркеры.
- **Коммерческая цепочка**: Sales (Lead→Opportunity→Quote→CheckoutIntent→Sale)
  → `OrderRequested` (outbox) → Order → Booking → Finance (ledger, payment,
  refund). Деньги фиксируются в `commercialSnapshot` (immutable facts).

## 5. Безопасность — фактическое состояние

Реализовано и проверено чтением кода:
- глобальные guard'ы (`APP_GUARD`) — нет «забытых» контроллеров без auth;
  `@Public()` только на явно публичных маршрутах;
- `ValidationPipe` с whitelist/forbidNonWhitelisted; DTO-валидация;
- единый `AppExceptionFilter`: 500 без деталей и stack, `X-Request-Id`;
- CORS allowlist (fail-closed в production), cookie HttpOnly/SameSite=Lax/
  Secure в prod, logout через `tokenVersion`;
- RBAC fail-closed: отсутствующее право = 403; аудит действий в
  `security.AuditLog`;
- Hybrid RBAC: primary role (`User.roleId`) + дополнительные
  `UserRoleAssignment` (срок/причина/автор); effective permissions = union
  действующих ролей, читаются из БД на каждый запрос; редактор прав ролей и
  карточка ролей пользователя — см. `HYBRID_RBAC.md`;
- Storefront site builder: tenant-scoped `ConstructorPage` (`context=storefront`,
  `tenantId=partnerId`) на общем version/publish/audit-движке marketplace;
  блоки Storefront, предпросмотр, публичный renderer с legacy fallback —
  см. `STOREFRONT_BUILDER.md`; структура/настройки блоков вынесены в общий
  `BuilderWorkspace`, платформа использует его для `/app/page-builder`;
- throttle `/auth/login` и `/checkout/guest` (per-IP), WhatsApp rate limits;
- секреты — только в `.env` (в git не попадают), `.env.example` без секретов.

Найдено и исправлено: undeclared-права supplier API (403 для всех ролей),
утечка сырого текста ошибки поставщика в 500 (public), выдача товаров без
канала публикации в `/public/suggest`, недостающая проверка видимости в
`/public/hotels/:id/offers` и `/public/tours/:id/comparable`, лишний грант
`supplier.search.read` у роли PARTNER.

Осталось: rate limiting публичного supplier API (внешние вызовы), in-memory
throttle при горизонтальном масштабировании (известное ограничение README).

## 6. Производительность

Измерено на dev-БД (17.6k PUBLISHED продуктов), `EXPLAIN ANALYZE`
(`reports/explain-public-queries.cjs`):

| Запрос | До | После | Изменение |
|---|---|---|---|
| Публичная выдача (status+publishedAt+channel, ORDER BY publishedAt DESC LIMIT 24) | Seq Scan + Sort ≈ **190.3 ms** | Index Scan + Nested Loop ≈ **2.25 ms** | ~85× |
| COUNT публичной выдачи | 62 ms | 56.6 ms | без изменений (нужен seq scan; кандидат на кэш) |

Добавлены индексы `Product(status, publishedAt)` и
`ProductPublicationChannel(channel, productId)` (миграция
`20261025151000_public_listing_indexes`).

Прочие наблюдения: N+1 в синках (запрос на продукт в цикле) — терпимо для
offline-джобов, но является кандидатом на batch-upsert; фронтенд-бандл
проверен production-сборкой (успешна).

## 7. Тесты и сборки

Актуальные цифры — в `TEST_REPORT.md`. Кратко: backend 177 suites / 2824
тестов — зелёные; frontend 76 files / 1118 тестов — зелёные; `tsc --noEmit` и
production build обоих пакетов — успешны; Playwright-прогон 30 состояний без
HTTP/console/page errors и overflow. Финансовый E2E и полный serial e2e —
**114 suites / 1719 tests PASS** (`reports/e2e-hybrid-final2.log`).

## 8. Документация: расхождения

| Документ | Утверждение | Факт |
|---|---|---|
| `README.md` | «10 схем» | 17 схем в `schema.prisma` |
| `README.md` | `npm run lint` | eslint не установлен и конфига нет — скрипт падает |
| `README.md` | «CI на текущий момент нерабочий» | workflow существует; локально не проверялся |

README исправлен по схемам и дополнен переменной
`NEXT_PUBLIC_DEFAULT_LOCALE`; статус lint зафиксирован в `REMAINING_WORK.md`.

## 9. Границы аудита

- Визуальный прогон выполнен 2026-10-25 через Playwright (Chromium, backend
  `:4000` + Next dev `:3000`): 30 состояний публичных и административных
  страниц на 1440/768/375 px + заполненные finance-состояния (обязательство,
  платёж, карточка платежа, debt-as-of, payment-terms), 0 HTTP/console/page
  errors и 0 overflow. Подробно — `UI_UX_AUDIT.md`, baseline — в
  `docs/audit/ui-baseline/`.
- E2E: выполнен полный serial-прогон на изолированной `*_test` —
  **114 suites / 1719 tests PASS**, 0 failed (`reports/e2e-hybrid-final2.log`),
  включая финансовый сценарий, RBAC и DB-isolation suites.
- Миграции применялись только к локальной dev-БД и изолированной `*_test`;
  production не затрагивался.
- Исторические данные (каталог, заказы) не изменялись, кроме аддитивных
  индексов, колонок и строк RBAC; тестовые finance-фикстуры удалены после
  проверки.

## 10. Финансы и платежи поставщикам (2026-10-25)

Фактическое состояние после доработки:

| Слой | Реализация |
|---|---|
| Обязательство | `finance.SupplierObligation` создаётся идемпотентно на `BookingConfirmed` из frozen `commercialSnapshot`; поля `sourceAmount/sourceCurrency`, `aznAmount/fxRate` — снапшот (курс не переписывается); добавлены `invoiceNumber`, `dueDate`, `version` |
| Статусы | `OPEN → PARTIALLY_PAID → CLOSED`, `CANCELLED`, `ADJUSTED`; `OVERDUE` — derived (dueDate < сегодня, remaining > 0), не хранится |
| Платёж | `finance.SupplierPayout` — заголовок платежа: `PENDING → CONFIRMED → CANCELLED`, supplier/partner, amount/currency, AZN-эквивалент и FX-снапшот, method, bank ref (unique, идемпотентность), purpose/comment, occurredAt, confirm/cancel, version |
| Распределения | `finance.SupplierPayoutAllocation` — платёж ↔ обязательство, `amount` в валюте платежа + `aznAmount`, `reversedAt`; unique(payout, obligation); нераспределённый остаток = `aznAmount − Σ active allocations` |
| Применение | Только `CONFIRMED` уменьшает `paidAmount`/`remainingAmount`; guarded `UPDATE … WHERE remaining >= allocation` защищает от гонок; подтверждение — CAS `PENDING→CONFIRMED` |
| Отмена | `PENDING` — без влияния; `CONFIRMED` — CAS-отмена, сторно распределений и компенсирующая проводка `SUPPLIER_PAYOUT_REVERSAL` в той же транзакции; исходные payout и `SUPPLIER_PAYOUT` не удаляются |
| Идемпотентность | POST `/finance/supplier-payments` защищён существующим `@Idempotent("supplier_payment.create")` + `SupplierPayout.idempotencySlotKey` (unique). Same key+payload → replay 201 без новых payout/allocation/ledger; divergent payload → 409; concurrent duplicate → один факт; missing key → 400; scope — authenticated user + operation, чужой ключ в другом scope не конфликтует |
| Документы | `finance.SupplierPaymentEvidence`: приватный S3 + signed URL 300 s, PDF/JPEG/PNG/WebP ≤10 MB с проверкой MIME и сигнатуры файла, аудит upload/delete, soft delete только PENDING; ключ storage наружу не отдаётся |
| История | Append-only `finance.SupplierObligationEvent` (CREATED/ADJUSTED/CANCELLED, occurredAt) — основа отчёта на дату; backfill из AuditLog |
| Сроки | `finance.SupplierPaymentTerms` (`IMMEDIATE` / `NET_DAYS 0–365`); при создании обязательства фиксируются правило, дни и рассчитанный `dueDate`; изменение правила не переписывает прошлое |
| FX | Платёж: `aznAmount` по `SupplierFxRate` (курс на дату платежа); распределение: frozen `obligation.fxRate` при совпадении валюты, иначе явный `aznAmount`; расхождение курсов остаётся видимым нераспределённым остатком (FX variance), не переписывает снапшот |
| API | `GET/POST /finance/supplier-payments` (POST requires `Idempotency-Key`), `GET /:code`, `/history`, `POST /:code/confirm|allocations|cancel`, `/documents` (upload/list/download/delete), `GET /supplier-payments/export?format=csv|xlsx&unallocated=true`; `PATCH /finance/obligations/:code`, `/history`, `/obligations/export`; `GET/PUT /finance/supplier-payment-terms`; `GET /finance/reports/supplier-debt?asOf=…` + `/export`; `GET /finance/obligations?overdue=true&search=` |
| Права | read — `finance.supplier_payout.read` + `finance.obligation.read`; регистрация/распределение/отмена/документы — `finance.supplier_payout.manage`; подтверждение — `finance.supplier_payment.confirm`; условия оплаты — `finance.obligation.manage` (ADMIN+FINANCE) |
| UI | `/app/finance/supplier-payments` — KPI, фильтры, реестр, режим нераспределённых, регистрация, карточка с распределениями/документами, confirm/cancel; `/app/finance/obligations`; `/app/finance/reports/debt-as-of`; `/app/finance/payment-terms`; `/app/finance/overview` |
| Отчёты | KPI overview; реестры; отчёт «задолженность на дату» с исторической реконструкцией, итогами по валютам и CSV/XLSX; экспорт реестров; AuditLog, включая аудит экспорта отчёта. Банковские выписки/сверка не реализованы (см. REMAINING_WORK) |

Проверено E2E (`test/finance-supplier-payments.e2e-spec.ts`): booking→obligation
→ PENDING (долг не меняется) → документ upload/list/download → CONFIRMED
(paid 680, remaining 1020, ровно один `SUPPLIER_PAYOUT`) → повторный confirm
без дубля → cancel (paid 0, remaining 1700, `SUPPLIER_PAYOUT_REVERSAL`) →
повторный cancel без второго сторно → as-of report до/после → CSV-экспорт и
аудит. Плюс HTTP-smoke и 8 finance-related suites / 89 tests PASS.
Реальный MinIO (`reports/evidence-smoke.cjs`): upload PDF → signed URL 300 s →
скачивание `%PDF-`; anonymous 401; подмена содержимого 422; удаление и cleanup.
