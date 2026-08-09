# ADR-0003: BUYER ↔ CRM Customer runtime mapping (Step 1.9 Clarification)

**Статус:** Принят · **Дата:** 2026-08-08
**Домен:** security.* (Auth/Users) ↔ crm.* (Customer)
**Промпт:** `TravelHub_Phase_1_Step_1.9_CLARIFICATION_Buyer_CRM_Customer_Mapping.md` (приоритет над §11 основного Step 1.9)

## Контекст

Публичная self-registration BUYER должна гарантировать инвариант:

```text
ACTIVE BUYER ⇒ valid User.customerId ⇒ existing CRM Customer
```

`User.customerId` — каноническая связь BUYER ↔ CRM Customer (security хранит
только reference; владелец Customer — CRM). При регистрации:

```text
Register BUYER → create security.User → CRM-owned command (create-or-link
Customer) → set User.customerId → registration/session completed
```

## Существующие правила (ADR-0001, ADR-0002)

- **ADR-0001:** «Интеграция доменов: только события (издатель/подписчик) и
  чтение по ID. Домен **пишет** только в свою схему; чтение чужих таблиц —
  только READ». Междоменные FK запрещены; все схемы — в одной PostgreSQL БД.
- **ADR-0002:** `security.*` — владелец User/Role/Permission/AuditLog;
  `POST /auth/register` — самозапись (роль BUYER по умолчанию).

## Статус решения относительно ADR-0001 (важно)

Настоящий ADR **явно изменяет** (делает узкое исключение из) правило
ADR-0001 «интеграция доменов — только события + чтение по ID» для **одного
scenario**: публичная регистрация BUYER использует синхронную application
orchestration. Это НЕ «неизменение» ADR-0001 и НЕ общее расширение его
смысла — это задокументированное, узкое, разрешённое исключение со
следующими границами:

1. **Разрешено только для Buyer registration orchestration.** Синхронная
   orchestration допустима, потому что:
   - обе схемы (`security.*`, `crm.*`) находятся в ОДНОЙ PostgreSQL БД —
     короткая транзакция возможна без distributed transaction;
   - требуется строгий инвариант `ACTIVE BUYER → valid customerId →
     existing CRM Customer` в момент выдачи сессии (eventual consistency
     недопустима для этого сценария — пользователь не должен получить
     полностью завершённую BUYER-сессию без обязательного mapping);
   - владельцы не нарушаются (см. п. 2–4).
2. **Каждый домен по-прежнему пишет только в свою owned schema.**
   `security` пишет `security.User`; `crm` пишет `crm.Customer`.
3. **Auth/Security НЕ выполняет прямых Prisma write в `crm.Customer`.**
   Запись в `crm.*` выполняется ТОЛЬКО CRM-owned application service
   (`CrmService.ensureCustomerForBuyer(tx, …)`) — CRM остаётся единственным
   владельцем Customer (никаких `tx.customer.*` из Auth/Account).
4. **Event-контракт сохраняется:** `CustomerCreated` пишется в outbox в той
   же транзакции и публикуется штатным `publishPending()` — подписчики
   событий работают как раньше. Синхронная orchestration дополняет, а не
   заменяет событийный контракт для этого создания.
5. **Приоритет:** этот ADR имеет приоритет над соответствующим ограничением
   ADR-0001 (механизм междоменной интеграции) **только для сценария Buyer
   registration**. Все прочие cross-domain flows исключение автоматически
   НЕ наследуют: для них действует правило ADR-0001 «события + чтение по
   ID» в полном объёме (Order↔Booking продолжают работать через event bus).
   Новый синхронный cross-domain orchestration вне этого сценария требует
   отдельного ADR.

## Решение

Синхронная application orchestration в ОДНОЙ короткой транзакции
(обе схемы в одной БД, ownership сохранён):

```text
AuthService.register()
  → tx: create security.User (ACTIVE, BUYER)
  → tx: CrmService.ensureCustomerForBuyer(tx, { email, firstName, lastName })
         (CRM-owned: deterministic reuse по нормализованному email,
          иначе create ровно одного Customer; CustomerCreated → outbox)
  → tx: set User.customerId
  → tx: audit auth.register
  → commit → login/session
```

Ключевые гарантии:

1. **Атомарность:** провал CRM-шага откатывает ВСЮ регистрацию — не остаётся
   ACTIVE BUYER с `customerId=null` (Clarification §3).
2. **Идемпотентность/retry:** канонический ключ — нормализованный email
   (`Customer.email` UNIQUE). Повтор регистрации → 409 (User.email/username
   UNIQUE) и duplicate Customer физически невозможен (Clarification §4).
3. **Deterministic reuse:** link существующего Customer ТОЛЬКО по email
   (однозначный матч). Имя/телефон — НЕ ключ связи; ambiguous legacy
   НЕ merge'ится автоматически (manual reconciliation path).
4. **Frontend не передаёт `customerId`:** `REGISTER_FORBIDDEN_KEYS` → 422
   (role/partnerId/customerId/permissions/status/…); DTO whitelist — второй
   барьер. Привязать BUYER к чужому Customer нельзя.
5. **Deactivation:** смена User.status не удаляет Customer (история CRM
   сохраняется). Удаление/анонимизация — отдельная privacy/data-retention
   политика, не Step 1.9.
6. **Legacy BUYER** с `customerId=null` — НЕ backfill на runtime-старте.
   Repair выполняется ТОЛЬКО явной idempotent repair command
   `POST /api/v1/users/reconcile-buyer-customers` (dry-run/report, audit)
   — см. ниже.

## Legacy repair (отдельная one-time migration/repair command)

`SecurityService.repairBuyerCustomers(dryRun)` — НЕ часть runtime lifecycle
(в `onModuleInit` backfill НЕ выполняется). Это явная идемпотентная
migration/repair command, доступная ADMIN через
`POST /api/v1/users/reconcile-buyer-customers` с опциональным `{ dryRun }`:

- **dry-run/report:** `{ scanned, linked, created, skippedNoEmail,
  brokenRefs, dryRun }` — сначала оператор получает отчёт БЕЗ изменений;
- **deterministic matching:** link только по нормализованному email
  (однозначный `Customer.email` UNIQUE);
- **no guessing:** BUYER без email — `skippedNoEmail` (нет канонического
  ключа), НЕ создаём наугад;
- **ambiguous match → no auto-merge:** имя/телефон не являются ключом;
- **broken reference:** `customerId` на несуществующий Customer (мёртвая
  ссылка, однозначно) — очищается и ремонтируется по email в том же прогоне;
- **transaction safety:** create + link выполняются одной транзакцией на
  пользователя (нет окна «Customer создан, User не связан»);
- **audit/result report:** каждый прогон (dry-run и реальный) аудируется в
  `AuditLog` с полным результатом.

После успешного legacy repair новые BUYER всегда получают Customer внутри
registration orchestration, поэтому runtime startup reconciliation не нужен.

## Обоснование выбора синхронной orchestration вместо event-driven

ADR-0001 описывает события как **дефолтный** механизм междоменной интеграции
(Order↔Booking так и работают). Clarification Step 1.9 (приоритетный
документ) явно предписывает: «Если PostgreSQL schemas находятся в одной БД и
существующая архитектура позволяет orchestration transaction без нарушения
ownership — использовать короткую transaction/application orchestration» и
«Пользователь не должен получить полностью завершённую BUYER-сессию … если
операция Customer creation завершилась ошибкой».

Event-driven (Saga/outbox + `PENDING_CUSTOMER_LINK`) потребовал бы
промежуточного состояния регистрации и eventual-consistency окна, в котором
ACTIVE BUYER существует без Customer — прямо противоречит целевому инварианту
clarification. Синхронная orchestration через CRM-owned command удовлетворяет
инварианту атомарно, не нарушая ownership. Приоритет данного ADR ограничен
только этим сценарием (см. «Статус решения относительно ADR-0001»).

## Последствия

- SecurityModule импортирует CrmModule и вызывает `CrmService` как application
  service — ЕДИНСТВЕННОЕ cross-domain synchronous orchestration в системе
  (Order↔Booking остаются на event bus);
- `AuthService.register` / `AccountService.updateProfile` — единственные
  оркестраторы; прямых Prisma-write в `crm.*` из security нет;
- `repairBuyerCustomers` — явная ADMIN-команда (не startup backfill);
- тесты: `backend/test/buyer-identity.e2e-spec.ts` (23 e2e) покрывают все 10
  пунктов Clarification §10 + §18 основного Step 1.9 + repair dry-run/real;
- при выносе CRM в отдельный сервис (future) contract остаётся прежним:
  заменить синхронный вызов на saga/outbox по существующему интерфейсу.

## Альтернативы

- **Только события (CustomerCreated + async link)** — отклонено: окно
  неконсистентности (ACTIVE BUYER без customerId) противоречит инварианту;
  усложняет retry/идентичность сессии.
- **Security пишет crm.Customer напрямую (Prisma)** — отклонено: нарушает
  ADR-0001 ownership (и границы п. 2–3 выше).
- **Frontend создаёт Customer отдельным запросом / передаёт customerId** —
  отклонено: нарушает §1/§9 clarification (единый registration flow, forged
  customerId → 422).
- **Startup backfill legacy BUYER при каждом старте** — отклонено (review):
  repair выполняется явной idempotent command, не в runtime lifecycle.
