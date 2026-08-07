# ADR-0001: Модульный монолит с отдельными схемами PostgreSQL

**Статус:** Принят · **Дата:** 2026-08-07

## Контекст

`TravelHub_Implementation_Prompt.md` (Phase 1) требует:

- backend как модульный монолит с чёткими границами доменов
  (`/modules/catalog`, `/modules/order`, `/modules/booking`, `/modules/crm`);
- PostgreSQL с **отдельной схемой на домен** (`catalog.*`, `order.*`,
  `booking.*`, `crm.*`), без FK между схемами разных доменов;
- event bus: transactional outbox + in-process шина, заменимая на
  RabbitMQ/Kafka без изменения бизнес-кода;
- REST `/api/v1/{domain}/...`, каждый эндпоинт принадлежит одному домену.

## Решение

- **Backend:** NestJS. Домен = NestJS-модуль (`CatalogModule`, `CrmModule`,
  `OrderModule`, `BookingModule`). Инфраструктура — глобальные
  `PrismaModule`, `EventBusModule`, `IdsService`, `AppExceptionFilter`.
- **БД:** PostgreSQL. 5 схем: `events` (outbox/inbox/счётчики), `catalog`,
  `crm`, `order`, `booking`. ORM — Prisma 7 multiSchema. Канонические ID
  генерируются атомарно через `events.BusinessSequence`.
- **Интеграция доменов:** только события (издатель/подписчик) и чтение
  по ID. Домен **пишет** только в свою схему; чтение чужих таблиц — только
  READ (в коде это явно ограничено комментариями и read-only сервисами,
  например `BookingQueryService`).
- **Frontend:** Next.js, единый UI-shell, 4 экрана центров.
- **Тесты:** Jest + Supertest, e2e-сценарий Phase 1 (Product → Customer →
  Order → Booking → статусы синхронизированы).

## Последствия

- Высокая связность внутри домена, низкая между доменами; любой модуль
  можно вынести в отдельный сервис (события уже развязаны).
- Вычислительные ограничения Prisma multiSchema (нет FK между схемами) —
  совпадают с требованием промпта.
- In-process шина: при переходе на очередь достаточно реализовать тот же
  интерфейс `EventBusService` (on/emit/publishPending).

## Альтернативы

- TypeORM c DataSource на домен — отклонено (сложнее миграции).
- Единая схема БД — отклонено (нарушает bounded context).
- Kafka/RabbitMQ сразу — отклонено для Phase 1 (требование допускает
  in-process шину; outbox уже гарантирует доставку).
