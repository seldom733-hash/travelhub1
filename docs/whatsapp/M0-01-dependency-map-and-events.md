# M0-01. Dependency map и реальный список событий

Репозиторий `D:\travelhub_v1`, ветка `master`, HEAD `28c4dcd`. Аудит 2026-10-02.
Все пути даны от корня репо; каждое утверждение проверено по коду (R1).

## 1. Состав приложения

`backend/src/app.module.ts:41` — imports: `PrismaModule`, `EventBusModule`, `SecurityModule`
и 24 доменных модуля (`CatalogModule … HotelDirectoryModule, IdempotencyModule,
OperationalNotesModule, MarketingModule, SupportModule, DocumentsModule`).
Глобально: `APP_GUARD → JwtAuthGuard + PermissionsGuard`, `APP_INTERCEPTOR → IdempotencyInterceptor`
(`app.module.ts:2,28,31`). `backend/src/modules/` — 26 каталогов (в т.ч. `communication`, `crm`,
`booking`, `order`, `finance`, `security` отдельным каталогом `src/security/`).
Каталога `integrations/` **нет** → WhatsApp по §4.2 создаётся как `backend/src/integrations/whatsapp/`.

## 2. Инфраструктура, на которую опирается интеграция

| Слой | Где | Факт (проверено) |
|---|---|---|
| EventBus/outbox | `backend/src/eventbus/eventbus.service.ts` | `emit(tx,write)` → `OutboxEvent.status=PENDING` (`:171,191`); `emitResult(tx,write)` → сразу `PUBLISHED` (`:204,219`); `publishPending()` доставляет **только PENDING** (`:241-244`) in-process подписчикам `on(eventType,cb)`; `retryFailed()` (`:344`) — FAILED→PENDING с backoff |
| Outbox worker | `eventbus/outbox-worker.service.ts` | дренирование воркером (advisory-lock `:119-126`); **единственный** `OnApplicationShutdown` в проекте (`:30,93`) |
| Реестр событий | `eventbus/domain-events.ts:35-99` | закрытый: `assertValidBusinessEventWrite` отклоняет тип вне `DomainEvents` (`:161-163`); envelope `:123-138` (ADR-0010) |
| Inbox dedup | `events.InboxEvent` | уже применяется подписчиками (`booking.subscribers.ts`, `order.subscribers.ts`: `inboxEvent.create` + unique-violation → return) |
| Communication | `backend/prisma/schema.prisma:2722-2777` | `channel` (default `PLATFORM`), `status` (default `ACTIVE`), `direction`, `body` 1..4000 plain text, `contextType/contextId`, `threadId`, `correlationId`, индексы `[contextType,contextId]`, `[occurredAt]`, `[direction,status]` |
| Communication enums | `schema.prisma:2661-2689` | `CommunicationChannel = {PLATFORM}` (комментарий `:2659-2660`: WHATSAPP добавляется только когда реально отправляем); `CommunicationStatus = {ACTIVE, ARCHIVED}`; `CommunicationDirection = {INBOUND, OUTBOUND, INTERNAL}`; `CommunicationContextType = {CUSTOMER, PARTNER, ORDER, BOOKING, BUYER_REQUEST}` |
| CommunicationThread | `schema.prisma:2804-2834` | жёстко `buyerRequestId+sellerPartnerId` (reverse pre-sale, `@@unique`) → **не использовать** для WhatsApp (D5 предупреждение подтверждено) |
| Communication API | `modules/communication/communication.controller.ts` | `POST /` `communication.create` (`:130`), `GET /` `communication.read` (`:151`), `GET /own` (`:164`), `GET /context/:type/:id` (`:171`), `GET /:code` (`:191`) — фильтрация/пагинация/контекстные выборки готовы (§6.1) |
| RBAC | `backend/src/security/permissions.constants.ts` | реестр dotted-ключей `"domain.action"` (напр. `crm.customer.read:64`); `@RequirePermissions` в `security/auth/decorators.ts`, guards глобальны |
| Audit | `security/security.service.ts:329-360` | `audit(tx\|undefined, {action, resource?, resourceId?, details?, …})` → `AuditLog` + авто-correlation из RequestContext |
| Idempotency-Key | `backend/src/shared/idempotency/` | заголовок `idempotency-key`, ≤128, regex `^[A-Za-z0-9._~-]+$` (`constants.ts:12-21`); глобальный интерцептор (`interceptor.ts:45-82`, scope=`request.user`); replay при совпадении fingerprint, **409** при другом payload (`service.ts:101-107`); `IDEMPOTENT_OPERATIONS = {"payment.create"}` (`constants.ts:21`) |
| RequestContext | `shared/request-context.middleware.ts` (глобально) | `requestId/correlationId` уже уходят в `Communication.correlationId` и audit |
| Конфигурация | `main.ts:2` `dotenv/config` + `process.env` | `@nestjs/config` отсутствует; fail-closed-образец — `shared/cors.ts` `parseCorsOrigins` (`main.ts:36-40`); `.env.example` есть (`backend/.env.example`) |
| Media storage | `backend/package.json`, `backend/.env.example`, `docker-compose.yml` | **есть**: S3/MinIO (`@aws-sdk/client-s3`, `S3_*`, e2e `test/e2e.minio.ts`) → media (M5) в существующий storage |
| Frontend | `frontend/` Next 16.2.12 / React 19.2.4 | внутренние разделы `/app/*` (`lib/routes.ts:13-30`), навигация с permission-тегами `components/OperationsCenterShell.tsx`, API-клиенты `lib/*-api.ts`, права через `lib/use-can.ts` (`useCan`), i18n только frontend — `lib/i18n.tsx` словарь `{ru,az,en}`, locale в `localStorage["travelhub.locale"]`, default `ru` |
| Тесты/CI | `.github/workflows/ci.yml` | Node 22, `npm ci`, `prisma generate`, `migrate deploy`, `tsc`, `build`, `jest --runInBand`, e2e (PG `*test` + MinIO), frontend `tsc`+`vitest run`+`build`; шага lint нет (ESLint не установлен) |
| Версии/БД | `backend/package.json`, `prisma/schema.prisma:24-26` | Node локально v24.18.0 / CI 22; npm 11.16.0; TS ^5.7.0; Prisma **^7.9.1**; lockfileVersion 3; multiSchema: 16 схем (`events, catalog, crm, order, booking, security, communication, sales, reverse, finance, decision, marketing, support, documents, constructor, geo`) → для `whatsapp.*` схему добавить в `datasource db.schemas` |

### 2.1. Чего НЕТ (проверено grep-ом, не предположено)

| Слой | Команда/факт | Результат |
|---|---|---|
| Notification-слой | grep `Notification\|notification` по `backend/src/**` | **0 совпадений** → §10 п.1: слоя нет, создать минимальный рядом с Communication (§4.1) |
| Backend i18n | i18n-пакетов в `backend/package.json` нет | только frontend `lib/i18n.tsx` |
| Нормализация телефона | grep `libphonenumber\|parsePhoneNumber\|normalizePhone` | **0 совпадений** → D4 = новая shared-утилита |
| Health endpoint | grep `health\|readiness\|liveness` | только нерелевантные (seed/perf/storefront) → §6.6 новая точка |
| SSE/WebSocket | grep `text/event-stream\|socket.io\|WebSocket` | **0** → QR: polling |
| Settings UI | все `frontend/app/**/page.tsx` | `app/settings/*` **нет** → §6.5 = новый раздел |
| Dockerfile | `Get-ChildItem -Filter Dockerfile*` | **нет** (только артефакт `unneeded/backend/.freebuff-dbg/Dockerfile.r3`); `docker-compose.yml` поднимает только MinIO → §6.7 потребует создания |
| `Customer.language` | `schema.prisma:1880-1900` | поля нет (см. §3.2) |
| Graceful shutdown | grep `OnApplicationShutdown\|SIGTERM` | только `outbox-worker.service.ts` → образец для Baileys shutdown |

## 3. Реально существующие события (32, `domain-events.ts:35-99`)

Семантика записи: `emit` → `PENDING` → `publishPending()` → подписчики вызываются;
`emitResult` → `PUBLISHED` → подписчики **никогда не вызываются**.

| # | Событие | Эмитер (file:line) | write | Существующие подписчики |
|---|---|---|---|---|
| 1 | ProductCreated | `catalog/catalog.service.ts:315` | emit | — |
| 2 | ProductPublished | `catalog.service.ts:977`, `:1208` | emit | — |
| 3 | ProductArchived | `catalog.service.ts:1361` | emit | — |
| 4 | CustomerCreated | `crm/crm.service.ts:125`, `:374`, `:1549`, `:1735` | emit | — |
| 5 | CustomerUpdated | `crm.service.ts:303` | emit | — |
| 6 | PartnerCreated | `crm.service.ts:463` | emit | `catalog.service.ts:186` |
| 7 | OrderRequested | `sales/sales-completion.service.ts:207` | emit | `order/order-requested.consumer.ts:55` |
| 8 | OrderCreated | `order/order.service.ts:548`, `:770` | emit | `finance/commission-accrual.consumer.ts:40`, `crm/marketplace-pcr-attribution.consumer.ts:35` |
| 9 | OrderReadyForBooking | `order.service.ts:1487` | emit | — |
| 10 | OrderFulfilled | `order.service.ts:1496` | emit | — (+ `emitResult` `order.subscribers.ts:201`, недоставляемо) |
| 11 | OrderClosed | `order.service.ts:1505` | emit | — |
| 12 | OrderCancelled | `order.service.ts:1532` | emit | `booking/booking.subscribers.ts:62` (compensation) |
| 13 | OrderStatusChanged | `order.service.ts:1541` | emit | — (+ `emitResult` `order.subscribers.ts:122`, недоставляемо) |
| 14 | BookingRequested | `order.service.ts:1523` | emit | `booking.subscribers.ts:61` |
| 15 | BookingCreated | `booking/booking.subscribers.ts:233` | **emitResult** | доставки подписчикам нет |
| 16 | BookingConfirmed | `booking/booking.service.ts:536` | emit | `documents/voucher.consumer.ts:37`, `order/order.subscribers.ts:36` |
| 17 | BookingRejected | `booking.service.ts:550` | emit | `documents/invalidation.consumer.ts:32`, `order.subscribers.ts:37` |
| 18 | BookingCancelled | `booking.service.ts:565` | emit | `documents/invalidation.consumer.ts:31` (+ `emitResult` `booking.subscribers.ts:310`, недоставляемо) |
| 19 | BookingCompleted | `booking.service.ts:584` | emit | — |
| 20 | BookingStatusChanged | `booking.service.ts:595`, `:611` | emit | `order.subscribers.ts:38` |
| 21 | PaymentCreated | `finance/payment.service.ts:174` | emit | — |
| 22 | PaymentCaptured | `payment.service.ts:244` → transition-хелпер (`:271`,`:319`) | emit | `documents/voucher.consumer.ts:38`, `order.subscribers.ts:41` |
| 23 | PaymentFailed | `payment.service.ts:249` | emit | — |
| 24 | PaymentCancelled | `payment.service.ts:254` | emit | — |
| 25 | RefundCreated | `finance/refund.service.ts:177` | emit | — |
| 26 | RefundApproved | `refund.service.ts:239` | emit | — |
| 27 | RefundProcessed | `refund.service.ts:244` | emit | `documents/refund-document.consumer.ts:31`, `order.subscribers.ts:44` |
| 28 | RefundFailed | `refund.service.ts:249` | emit | — |
| 29 | DisputeOpened | `finance/dispute.service.ts:167` | emit | — |
| 30 | DisputeResolved | `dispute.service.ts:191` | emit | — |
| 31 | DisputeCancelled | `dispute.service.ts:196` | emit | — |
| 32 | CommissionAccrued | `finance/commission.service.ts:162` | **emitResult** | доставки подписчикам нет |

**Недоставляемые через `emitResult` (5 записей):** `booking.subscribers.ts:233`,
`booking.subscribers.ts:310`, `order.subscribers.ts:122`, `order.subscribers.ts:201`,
`commission.service.ts:162`. Для M4 это важно: подписчик notification-слоя получает событие
только если эмитер использовал `emit` (PENDING).

### 3.1. Матчинг D11-шаблонов на реальные события

Все 8 шаблонов из D11 существуют в коде и эмитятся через `emit` (доставимы):
`booking.confirmed`→#16, `booking.rejected`→#17, `booking.cancelled`→#18,
`booking.completed`→#19, `payment.captured`→#22, `payment.failed`→#23,
`payment.cancelled`→#24, `refund.processed`→#27.
События #19/#23/#24 подписчиков пока не имеют — notification-consumer будет первым.

### 3.2. Что касается Customer.phone (D4/§10 п.3)

`schema.prisma:1880-1900`: `Customer.email String @unique`, **`phone String?` — сырой,
nullable, без индекса и без unique**; дубли номеров допустимы. Поля языка нет.
`Contact.phone String?` (`:1909`) — вспомогательный, без нормализации.

## 4. Сводная схема (текст)

```
business domain (catalog/crm/sales/order/booking/finance)
        │ emit(tx)  → events.OutboxEvent (PENDING)
        ▼
OutboxWorker (advisory-lock) → publishPending() → in-process on(...) подписчики
        │
        ├── существующие consumers: order.*, booking.*, documents.*, crm.*, finance.*
        └── [M4] notification-слой (СОЗДАТЬ, channel-agnostic, рядом с communication/)
                    │  policy + шаблон ru/az/en + rendered snapshot
                    ▼
              communication.Communication (channel=WHATSAPP, body=snapshot)
                    │
                    ▼
              generic ChannelTransport ──► integrations/whatsapp/ (M2-M3)
                                                  │  lease + Baileys (единственный import)
                                                  ▼
                                          WhatsAppProvider (baileys | mock)
```
