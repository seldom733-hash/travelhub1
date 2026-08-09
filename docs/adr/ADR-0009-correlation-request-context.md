# ADR-0009: Correlation / Request ID infrastructure

**Статус:** Принят · **Дата:** 2026-08-09

## Контекст

Phase 1 Step 1.15 требует единый технический correlation/request context:

```
HTTP request → domain/application operation → Outbox event → consumer → child event → diagnostics/audit
```

Без единого контекста невозможно связать ошибку/аудит/событие с конкретным
запросом, невозможно честно трассировать causal chain между событиями, а
correlationId в Outbox деградировал в business entity ID (`Order.code`), что
смешивает техническую цепочку с бизнес-ключом и ломает трассировку при
репликации заказа/новой логической операции.

## Решение

### Семантика ID

- `requestId` — конкретный HTTP request / processing invocation.
- `correlationId` — вся логическая causal chain; для корневого
  server-authoritative HTTP flow равен requestId.
- `causationId` — непосредственная причина; для child event, порождённого
  event consumer, ссылается на eventId родителя.

**Запрещено** использовать orderId/bookingId/userId/sessionId/business codes как
correlationId. Correlation — техническая identity, не business key.

### HTTP boundary

- Middleware `RequestContextMiddleware` (зарегистрирован в `AppModule.configure`,
  `forRoutes("*")` — единая регистрация для prod и e2e):
  - **requestId authority**: сервер принимает client `X-Request-Id` ТОЛЬКО если
    это валидный UUID v4 (ограничение длины/символов, защита от log injection).
    Валидный client UUID — **documented diagnostic contract**: он ЭХО-отражается
    как requestId запроса и в response header `X-Request-Id` (клиент связывает
    свои логи с серверными). При отсутствии/невалидности/дубликате сервер
    генерирует свой UUID;
  - **correlationId authority (важно)**: для корневого HTTP flow correlationId
    ВСЕГДА server-authoritative UUID и НИКОГДА не равен client-supplied
    `X-Request-Id`. Следствие: повтор одного client UUID в двух независимых
    requests даёт ОДИНАКОВЫЙ requestId (echo), но РАЗНЫЕ correlationId —
    независимые операции НЕ сливаются в одну causal chain (§2 ревью). Только
    если client `X-Request-Id` отсутствует, correlationId == requestId (один
    server UUID);
  - response header `X-Request-Id` на каждый ответ.
- Client `X-Correlation-Id` НЕ принимается без trusted-upstream контракта:
  сервер сам назначает correlation (server authority однозначна). Correlation —
  техническая tracing identity без authorization-семантики; повторная
  доставка/дубликат UUID не создаёт эффектов (inbox dedup).
- Public anonymous endpoints тоже получают requestId.
- `normalizeCorrelationId` (emit/emitResult): explicit `""`/whitespace не
  сохраняется как correlation (→ null); `undefined` — наследие из контекста;
  `null` — intentional legacy NULL.

### Операционный join point

Error response несёт диагностический `requestId` (client echo или server ID),
а outbox-линейка строится по `correlationId` (всегда server-generated). Если
клиент переиспользует один `X-Request-Id`, ответы разных запросов имеют
одинаковый `requestId` — join error → outbox выполняется через
`AuditLog.details.correlation = { requestId, correlationId }`, где хранятся оба
ID.

### Async propagation

- `AsyncLocalStorage` (`backend/src/shared/request-context.ts`) — контекст
  прокидывается без протаскивания через сигнатуры. Это НЕ service locator для
  business state.

### Outbox / Inbox / Consumer

- `OutboxEvent.correlationId/causationId` (nullable) уже существовали — migration
  не требуется. Новые события наследуют correlation/causation из активного
  request context (emit/emitResult), явный параметр имеет приоритет.
- `publishPending` устанавливает для каждого consumer-а НОВЫЙ invocation context:
  `requestId` новый, `correlationId` наследуется из события, `causationId =
  eventId`. Inbox dedup не меняется; duplicate delivery не создаёт новую chain.
- Legacy NULL correlation обрабатывается штатно (NULL = unknown, без fake
  backfill).

### Audit / logs / errors

- `AuditLog.details.correlation = { requestId, correlationId }` — безопасный
  reference (AuditLog остаётся журналом, не event store).
- `AppExceptionFilter`: `X-Request-Id` header + `requestId` в теле ошибки; логи
  без PII/tokens/Authorization/raw body.

### Behavioral boundary

`StorefrontBehavioralEvent`/`MarketplaceBehavioralEvent` сохраняют собственные
`eventId`/`sessionId`/`acquisitionSource`. HTTP requestId ≠ behavioral eventId ≠
sessionId. Behavioral storage correlation-полями не раздувается.

### Frontend

Frontend НЕ генерирует authoritative backend correlation chain, tracing SDK не
внедряется. `X-Request-Id` — server контракт для диагностики.

## Последствия

- Каждая ошибка/событие/аудит связываются с запросом через один ID.
- Causal chain Order command → BookingRequested → BookingCreated → Order
  reconcile собирается по correlationId + causationId, независимо от business
  keys.
- Небольшой оверхед: middleware + ALS (один объект контекста на запрос).
- Step 1.15A (массовая стандартизация всех envelope/payloads) НЕ выполняется
  этим шагом — инфраструктура готова, стандартизация — отдельный шаг.

## Альтернативы

- Прокидывать requestId через сигнатуры — отклонено (десятки параметров).
- Доверять client `X-Correlation-Id` — отклонено (spoofing, log injection).
- Correlation = business key (status quo) — отклонено (Step 1.15 §3).
