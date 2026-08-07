# ADR-0002: Аутентификация и RBAC (Phase 2)

- **Дата:** 2026-08-07
- **Статус:** Accepted
- **Домен:** security.* (Auth + RBAC)

## Контекст

Phase 1 не имела аутентификации: все эндпоинты `/api/v1/*` были открыты.
RBAC Matrix Baseline 1.3 требует канонический набор ролей
(ADMIN, DIRECTOR, FINANCE, MARKETER, ANALYST, MODERATOR, SALES_MANAGER,
OPERATOR, PARTNER, BUYER) и granular permissions — «не заменять всё одним
domain:write». Bootstrap Order (Phase 1) по Phase 2 §4 должен быть убран из
обычного UI и остаться только ADMIN/import exception с аудитом.

## Решение

1. **Новая схема БД `security.*`** (владелец — SecurityModule):

   - `User` — персонал/партнёр/покупатель, код `USR-*` (канонический, через
     `events.BusinessSequence`), одна роль, опциональный object scope
     (`partnerId`, `customerId`).
   - `Role` — канонические роли (RoleCode enum, новые — только через ADR).
   - `Permission` — granular permissions (`order.accept`, `booking.confirm`,
     `catalog.product.publish`, …).
   - `RolePermission` — связь роль→права (матрица §2 зашита в
     `permissions.constants.ts`, seed идемпотентный на старте).
   - `AuditLog` — журнал безопасности (вход/выход, смена роли, команды).

2. **Аутентификация**: JWT (Bearer, `@nestjs/jwt`), пароли — bcrypt.
   - `POST /auth/register` — самозапись (роль BUYER по умолчанию);
   - `POST /auth/login` → `{ accessToken, user }`;
   - `GET /auth/me` — пользователь + **актуальные** права из БД
     (смена роли применяется немедленно, без ожидания expiry токена);
   - `POST /auth/logout` — аудит.

3. **RBAC enforcement**:

   - `JwtAuthGuard` — **глобальный** APP_GUARD (защита по умолчанию;
     `@Public()` открывает эндпоинт: только `/auth/register`, `/auth/login`);
   - `PermissionsGuard` — глобальный APP_GUARD, читает `@RequirePermissions(...)`
     с каждого хендлера; поддерживает resolver-функцию для проверки прав по
     телу запроса (например, `PATCH /orders/:id` требует право, зависящее от
     `action`);
   - Права пользователя загружаются из БД на каждый запрос (no stale role).

4. **Применение к доменам** (матрица §2):

   - Catalog: чтение `catalog.product.read`; запись `catalog.product.write`;
     публикация `catalog.product.publish`; категории `catalog.category.write`;
   - CRM: чтение `crm.customer.read`; запись `crm.customer.write` / контакты /
     компании / партнёры / поставщики;
   - Order: `order.read`; команды по action (accept / edit_noncritical /
     request_booking / suspend / cancel / close); bootstrap — `order.import`
     (ADMIN-only exception);
   - Booking: `booking.read`; команды по action (send_supplier / confirm / cancel).

5. **Seed** (OnModuleInit, идемпотентно): все 10 ролей, каталог прав,
   связки роль→права и администратор `admin` (пароль из `ADMIN_PASSWORD`,
   по умолчанию `admin123`, менять в проде).

## Альтернативы

- **PassportJS + стратегии** — не вводили: JWT-guard достаточно для REST-монолита,
  меньше зависимостей.
- **Права в JWT-payload** — отклонено: смена роли должна применяться сразу,
  а не после перелогина.
- **Схема в `public`** — отклонено: соблюдаем правило «домен = схема».

## Последствия

- Все эндпоинты (кроме register/login) теперь требуют Bearer-токен.
- Роли можно менять только через `PATCH /users/:id/role` (ADMIN), изменение
  аудируется.
- Object scope PARTNER/BUYER (`partnerId`/`customerId`) заложен в схему;
  полноценная фильтрация по объектам — в Phase 2.2 (маркетплейс-сценарии).
- Bootstrap-эндпоинт сохранён как ADMIN exception, аудируется в orderHistory.
