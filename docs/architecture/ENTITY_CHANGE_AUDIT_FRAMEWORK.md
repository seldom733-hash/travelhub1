# ENTITY CHANGE AUDIT FRAMEWORK

> PHASE 3 · PRE-STEP 3.12 · D5 — canonical architecture: cross-cutting Entity Change Audit framework.
> Статус: FOUNDATION (D5). Интегрирован для Order; Booking/Request — future integration.

## 1. Purpose

Единый, переиспользуемый механизм аудита бизнес-изменений сущностей коммерческого
жизненного цикла (Request → Order → Booking → Payment) с гарантиями:

- **immutability** — audit-события никогда не перезаписываются и не удаляются;
- **transactionality** — бизнес-мутация и её audit-запись коммитятся атомарно
  (одна DB-транзакция): нет бизнес-факта без аудита и нет «orphan»-аудита при
  откате транзакции;
- **PII-safety** — audit не становится «второй неконтролируемой PII базой»:
  чувствительные значения (паспорт, даты рождения, телефон, email) хранятся
  только в redacted/masked форме;
- **actor model** — каждая запись фиксирует actorId/actorName (кто) и
  createdAt/changedAt (когда);
- **source/context** — каждая запись идентифицирует точку входа
  (полная страница / quick preview / API / система / интеграция);
  **Persisted** в отдельной колонке `source` OrderHistory (D5-R1);
  spoofing-protected: клиент НЕ может записать SYSTEM/INTEGRATION;
  legacy rows: DEFAULT 'API' (ADD COLUMN ... DEFAULT 'API').
- **server authority** — чтение истории сервер-авторизовано (permission + scope);
  никакой клиентский контракт не выбирает, что видеть.

## 2. Scope

| Сущность | Статус в D5 | Хранилище audit-событий |
|---|---|---|
| Order (lifecycle + travelers + поля) | **INTEGRATED (D5)** | `order.OrderHistory` |
| Booking | FUTURE (framework готов, интеграция — свой шаг) | `booking.BookingHistory` |
| Request | FUTURE / requalification pending | per-entity history (те же конвенции) |
| Payment/Refund | FUTURE | per-entity history |

D5 вводит **foundation + Order integration**. Booking/Request/Payment используют
тот же shared core (`backend/src/shared/audit.ts`) и те же конвенции таблиц.

## 3. Event types

Shared core (`src/shared/audit.ts`):

```text
FIELD_CHANGE     — изменение значения поля сущности (field / oldValue / newValue);
LIFECYCLE_ACTION — команда жизненного цикла (action + from → to status);
SYSTEM_ACTION    — автоматическое/системное изменение (reconcile, worker, компенсация).
```

На уровне `order.OrderHistory` тип события выражается соглашением записи
(`action` + необязательные `from`/`to`/`fields`), а не отдельной enum-колонкой —
обратная совместимость с существующей историей Order (D2/D3 записи) сохранена.

## 4. Data model

Каждая per-entity audit-таблица следует единому контракту (пример — `OrderHistory`):

```text
id         String   @id @default(uuid())
orderId    String   (FK → Order, onDelete: Cascade)
action     String   // lifecycle action / update_traveler_d3 / update_travelers / ...
from       String?  // from status (для lifecycle)
to         String?  // to status (для lifecycle)
fields     Json?    // структурированный field-diff: [{field, oldValue, newValue, redacted}]
actorId    String?
actorName  String?
comment    String?
createdAt  DateTime @default(now())   // changedAt
```

Индексация: `@@index([orderId])` + стабильный порядок чтения
(`orderBy: [{ createdAt: "desc" }, { id: "desc" }]`).

## 5. Transactionality

Audit-запись пишется **в той же транзакции**, что и бизнес-мутация:

```text
prisma.$transaction(async (tx) => {
  1) бизнес-обновление (update order / traveler / status);
  2) tx.orderHistory.create(...);   // атомарно с бизнес-фактом
});
```

- denied edit → исключение → откат → **никакой успешной audit-записи**;
- failed transaction → откат → **никакого orphan-события**;
- транзакция не используется там, где аудит не требуется (read-only пути).

## 6. Actor model

- `actorId` — id авторизованного пользователя (или null для системы);
- `actorName` — человеко-читаемый идентификатор (username / «Система»);
- `createdAt` — серверное время фиксации события (единственный источник).

Клиент не может подделать автора: значения берутся из authenticated actor
(guard/passport), не из body.

## 7. Source / context (D5-R1: STRUCTURED + PERSISTED)

Shared core определяет источники (D5-R1: persisted в OrderHistory.source):

```text
ORDER_FULL_PAGE     — действие с полной страницы Order Detail;
ORDER_QUICK_PREVIEW — действие из Quick Preview (drawer);
API                 — прямой API-вызов (интеграция/скрипт);
SYSTEM              — системный/автоматический;
INTEGRATION         — внешняя интеграция.
```

**Authority model (D5-R1):**
- SYSTEM / INTEGRATION — server-derived ONLY (OrderRequested consumer, EventBus);
- API — default fallback for direct API/controller calls;
- ORDER_FULL_PAGE / ORDER_QUICK_PREVIEW — validated client context via
  `X-Audit-Source` header (spoofing-protected: клиент НЕ может записать
  SYSTEM/INTEGRATION — validateClientSource() возвращает null → default API).

Legacy rows: `ADD COLUMN source TEXT DEFAULT 'API'` — no NULL, no crash.
Source queryable и deterministic.

## 8. Field diff

- diff выполняется по **allowlist** полей сущности
  (`TRAVELER_AUDIT_FIELDS`, future: OrderFieldEdit allowlist) — никаких
  гигантских raw before/after snapshot-ов;
- фиксируются только реально изменившиеся поля (`oldValue` ≠ `newValue`);
- сериализация scalar-представлений — детерминированная
  (`serializeAuditValue`: string/number/decimal/boolean/date/enum/nullable);
- сложные объекты не сериализуются целиком (запрещено).

## 9. Lifecycle event

Каждая команда жизненного цикла Order пишет lifecycle-запись:

```text
action:  <OrderAction>        // process / confirm / send / cancel / ...
from:    <статус до>           // NEW → ...
to:      <статус после>        // ... → IN_PROCESSING
comment: ACTION_LABELS[action] // человеко-читаемое описание
```

Запись создаётся тем же сервисом, который выполняет переход (та же транзакция),
после успешной CAS-проверки статуса. Существующие записи D2/D3 («created»,
Request conversion, D3 flow) — уже в этой таблице и сохраняются как legacy history.

## 10. PII handling (HARD)

Sensitive-поля:

```text
passportNumber, passportExpiry, birthDate, phone/phoneNumber, email/customerEmail, travelerPhone
```

Правила:

- `passportNumber` — сохраняется только redacted: `••••{last4}`;
- остальные sensitive (birthDate/passportExpiry/phone/email) — полная маска `••••`;
- non-sensitive поля — plaintext old/new (например, citizenship, firstName);
- secrets/credentials **никогда** не аудируются;
- маскировка выполняется shared-ядром (`redactAuditValue`) до записи в БД —
  plaintext не попадает ни в БД, ни в API-ответ.

## 11. Permission / scope

- Чтение истории: `order.read` + server-side scope-проверка
  (Platform-контракт: Storefront-Order через Platform → 404, D4 isolation);
- page-level доступ: history endpoint закрыт теми же permission keys, что и
  Order detail;
- никакой client-side фильтрации PII в истории — redaction выполнена на сервере.

## 12. Pagination

`GET /orders/:id/history?page=N&pageSize=M`:

```text
- page ≥ 1, pageSize ∈ [1..100];
- стабильная сортировка (createdAt desc, id desc) — без дублей/пропусков между страницами;
- ответ: { items, total, page, pageSize }.
```

## 13. Immutability

Audit-таблица — append-only. Обновление/удаление записей не предусмотрено API
и не выполняется кодом приложения (нет ни одного write-пути кроме create в tx).

## 14. Legacy behavior

- История Order существовала до D5 (D2/D3 записи: created, request conversion,
  final_confirm, update_traveler_d3). Формат обратно совместим: те же колонки,
  те же action-строки; UI корректно показывает как старые, так и новые записи.
- Для legacy Order **без** pinned traveler snapshot (pre-D3) bulk-редактирование
  сохраняет исторический контракт (полнота по passportNumber), audit пишется
  по тем же правилам.
- Полевая история **не реконструируется** для изменений, произошедших до
  включения аудита (честная пустая история + notice в UI).

## 15. Order integration (D5)

| Путь | Audit-запись |
|---|---|
| Lifecycle action (`PATCH /orders/:id` с action) | `action=process|cancel|…`, from/to, comment |
| Traveler bulk (`PUT /orders/:id/travelers`) | `action=update_travelers`, fields-diff c `traveler[N].field` |
| Traveler single (`PATCH /orders/:id/travelers/:travelerId`) | `action=update_traveler_d3`, fields-diff |
| Order создание (OrderRequested consumer / Request conversion) | `action=created`, to=NEW |
| Field-edit Order (future) | `action=update_order_fields`, fields-diff |

## 16. Booking future integration

Booking обладает собственной таблицей истории (`booking.BookingHistory`, модель
`BookingHistory`, D5 не меняет её). Framework-конвенции применяются при
следующей интеграции: transactionality в tx Booking-команд, field-diff по
allowlist, redaction sensitive-полей через shared core, pagination + permission
по контракту Booking Center.

## 17. Request future / requalification

Request-requalification (история Request lifecycle) остаётся pending отдельного
шага. Framework предоставляет: event types, sources, serialization/redaction,
конвенции таблиц. Request-сущность добавит свою per-entity history-таблицу по
тем же правилам (или requalification решит иначе — но не в D5).

## 18. Testing invariants

Автоматизированные инварианты (см. `d5-order-fullpage-audit.e2e-spec.ts`):

1. lifecycle action → запись истории с from/to/actor/comment;
2. traveler edit → FIELD_CHANGE-diff (old/new), sensitive masked;
3. denied/forbidden edit → HTTP 403/409 и **нет** audit-записи;
4. failed mutation → нет orphan-записи;
5. история — immutable (API не имеет update/delete);
6. pagination стабильна;
7. Platform→Storefront история → 404;
8. `order.read` без редактирования видит историю, но не может её изменить.

## 19. Non-goals

- НЕ система событийного стриминга (outbox/eventBus остаётся отдельным слоем);
- НЕ замена ledger/финансовых записей (finance — свой immutable слой);
- НЕ raw snapshot-хранилище (никаких giant before/after);
- НЕ клиентский аудит (сервер — единственный источник);
- D5 не добавляет отдельную центральную таблицу «все события всех сущностей»
  (per-entity таблицы с общим core — намеренно, для масштабирования и изоляции
  схем `order`/`booking`).

---

Сопутствующее: `backend/src/shared/audit.ts` (shared core),
`backend/src/modules/order/order.service.ts` (Order integration),
отчёт D5 (разделы 16–24).
