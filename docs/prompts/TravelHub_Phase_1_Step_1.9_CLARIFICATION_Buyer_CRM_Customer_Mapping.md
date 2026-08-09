# PHASE 1 — STEP 1.9 CLARIFICATION: BUYER ↔ CRM CUSTOMER RUNTIME MAPPING

## Архитектурное решение

`User.customerId` уже является канонической связью внешнего пользователя BUYER с CRM Customer.

Для нового BUYER runtime mapping обязателен.

Целевая модель:

```text
security.User
  role = BUYER
  customerId
      │
      ▼
crm.Customer
```

Один BUYER identity должен быть связан с одним CRM Customer согласно текущей single-customer identity model.

Не создавать параллельную BuyerProfile/Customer сущность.

## 1. Когда создаётся Customer

При успешной публичной регистрации BUYER система должна обеспечить создание или безопасное связывание CRM Customer.

Цепочка:

```text
Register BUYER
   ↓
create security.User
   ↓
CRM application command/service
   ↓
create-or-link Customer
   ↓
set User.customerId
   ↓
registration completed
```

Frontend не создаёт Customer отдельным запросом.

## 2. Domain boundary

Users/Auth не должен напрямую выполнять Prisma write в `crm.Customer`.

Использовать контролируемый CRM application service/command, например:

```text
CrmService.ensureCustomerForBuyer(...)
```

или эквивалент существующего проекта.

Не создавать direct cross-domain table writes из AuthController/AuthService.

Если архитектура проекта использует domain events/outbox для этой операции, допустим event-driven flow при условии, что consistency contract явно определён.

## 3. Consistency для регистрации

Для текущего Step 1.9 предпочтителен синхронный application orchestration contract:

```text
register()
  → create User
  → ensure CRM Customer
  → link customerId
  → issue auth/session
```

Пользователь не должен получить полностью завершённую BUYER-сессию в состоянии, где обязательный `customerId` неизвестен, если операция Customer creation завершилась ошибкой.

Если PostgreSQL schemas находятся в одной БД и существующая архитектура позволяет orchestration transaction без нарушения ownership — использовать короткую transaction/application orchestration.

Если CRM интеграция физически отделена и атомарность невозможна — использовать Saga/outbox + explicit `PENDING_CUSTOMER_LINK` registration state. Не оставлять молча ACTIVE BUYER с вечным `customerId=null`.

## 4. Idempotency / duplicate prevention

Повтор регистрации/retry не должен создавать два Customer.

Нужна идемпотентность.

Использовать канонический identity key из существующей модели, например normalized verified email/userId linkage.

Не выполнять опасное автоматическое merge двух существующих CRM Customers только по совпадению имени/телефона.

Если найден уже однозначно связанный Customer — reuse.

Если существует неоднозначный legacy duplicate:

```text
ARCHITECTURE DECISION REQUIRED
```

или controlled manual reconciliation, но не guessing.

## 5. Ownership

CRM остаётся владельцем Customer.

Security/Users владеет User и хранит только reference:

```text
User.customerId
```

Customer не становится security entity.

User role/status не переносить в CRM Customer как второй SSOT.

## 6. Profile update

BUYER profile и CRM Customer должны иметь явно разделённые поля.

Identity/security fields:
```text
email/login
password/auth
role
status
permissions
```
→ Security/Users.

Customer/business profile fields:
```text
firstName
lastName
phone
locale/contact preferences
other CRM customer data where modeled
```
→ обновлять через CRM-owned contract.

Не хранить конкурирующие копии одного business field без sync policy.

Если User уже содержит некоторые display fields, определить их как auth/profile projection или синхронизировать через один application command — не делать два независимых SSOT.

## 7. Existing BUYER users

Для существующих BUYER с `customerId = null`:

- не создавать Customer наугад при обычном read;
- подготовить детерминированный backfill/reconciliation;
- если customer может быть однозначно найден по существующей связи/идентификатору — link;
- иначе создать новый Customer только если доказано, что соответствующего CRM Customer нет;
- ambiguous matches → manual/reconciliation path.

Не менять internal users/PARTNER.

## 8. Deletion/deactivation

Deactivation User не должна физически удалять Customer.

Customer history должна сохраняться.

Удаление/анонимизация — отдельная privacy/data-retention policy, не Step 1.9.

## 9. API contract

После успешной регистрации:

```text
/auth/me
```

для BUYER должен иметь корректно связанный `customerId` (если этот reference разрешён текущим own-account contract) либо backend должен уметь резолвить Customer без раскрытия internal fields.

Frontend не должен отправлять `customerId` при регистрации.

## 10. Tests

Обязательно доказать:

1. register BUYER → создаётся User;
2. register BUYER → создаётся CRM Customer;
3. `User.customerId == Customer.id`;
4. frontend/body не может передать произвольный customerId;
5. retry/idempotent registration orchestration не создаёт duplicate Customer;
6. CRM failure не оставляет молча полноценного ACTIVE BUYER с незавершённым обязательным mapping;
7. existing deterministic Customer link reuse работает;
8. ambiguous legacy match не merge'ится автоматически;
9. BUYER не может связать себя с чужим Customer;
10. profile own-scope использует связанный Customer;
11. deactivation User не удаляет Customer;
12. PARTNER/internal registration не создаёт Buyer Customer автоматически;
13. backend regression остаётся зелёным.

## 11. Не делать

Не реализовывать:
- full CRM Center;
- Customer merge UI;
- loyalty;
- Buyer Orders/Bookings;
- checkout;
- payments.

## 12. Итоговый invariant

```text
ACTIVE BUYER
   ⇒
valid User.customerId
   ⇒
existing CRM Customer
```

Для новых self-registered BUYER этот invariant обязателен.

Если текущий код/ADR прямо запрещает синхронное application orchestration между Users и CRM:

```text
ARCHITECTURE DECISION REQUIRED
```

и нужно показать существующее правило до выбора event-driven альтернативы.
