# PHASE 1 — STEP 1.15: CORRELATION / REQUEST ID INFRASTRUCTURE — STRICT IMPLEMENTATION PROMPT

## 0. Режим выполнения
Выполни только **PHASE 1 — STEP 1.15 — Correlation / Request ID Infrastructure** проекта TravelHub.
Step 1.14 считать APPROVED после strict review. Не переходить к Step 1.15A или Phase 2.

## 1. Цель
Создать единый технический correlation/request context:
HTTP request → domain/application operation → Outbox event → consumer → child event → diagnostics/audit.
Не смешивать requestId/correlationId/causationId с business entity IDs, behavioral eventId или sessionId.

## 2. Обязательный аудит до изменений
Проверить main.ts, middleware/interceptors/filters, logger, AsyncLocalStorage/request context, SecurityService/AuditLog, EventBusService, OutboxEvent, InboxEvent, domain-events, subscribers, Order/Booking events после 1.14, public behavioral ingestion, frontend API clients, tests и ADR/docs.
Сначала построить Current → Target mapping. Предыдущие отчёты не считать доказательством.

## 3. Семантика ID
- `requestId`: конкретный HTTP request/processing invocation.
- `correlationId`: вся логическая causal chain. Для корневого server-authoritative HTTP flow обычно равен requestId.
- `causationId`: непосредственная причина. Для child event, порождённого event consumer, должен ссылаться на parent eventId.
Не использовать orderId/bookingId/userId/sessionId как correlationId.

## 4. Формат и trust boundary
Использовать единый безопасный формат, предпочтительно UUID по conventions проекта. Ограничить длину и символы. Невалидный входной ID не принимать как authoritative: генерировать server ID либо отклонять согласно явно выбранному контракту.
Не использовать PII/IP/token/user-agent как ID.

## 5. HTTP boundary
Каждый backend HTTP request получает context до controller/service execution. Определить canonical response header (например `X-Request-Id`, если согласуется с проектом).
Не доверять произвольному client `X-Correlation-Id` без documented trusted-upstream contract.
Public anonymous endpoints тоже получают requestId. Behavioral sessionId остаётся отдельным понятием.

## 6. Async propagation
Предпочтительно AsyncLocalStorage или существующий эквивалент. Не протаскивать requestId вручную через десятки signatures и не превращать context в service locator для business state.

## 7. Outbox contract
Проверить schema. Добавить минимальные nullable correlation/causation поля только если отсутствуют и необходимы.
Migration additive, nullable, без fake backfill. Legacy NULL = unknown correlation.
Новые events получают correlation, когда source известен.

## 8. Inbox/consumer
При обработке event установить processing context: новый invocation/requestId, inherited correlationId, а для child event `causationId = consumed eventId`.
Inbox dedup не ломать. Duplicate delivery не создаёт новую logical chain/effect.

## 9. Реальная causal chain
Проверить минимум:
Order command → OrderReadyForBooking → последующая команда send/BookingRequested → Booking consumer → Booking events → Order reconcile.
Не выдумывать causation между независимыми HTTP actions: отдельный `send` request не обязан быть child confirm request без реального causal carrier.

## 10. Audit/log/error
Если AuditLog metadata позволяет — безопасно добавить request/correlation reference, не превращая AuditLog в event store.
Структурированные logs могут включать requestId/correlationId. Не логировать Authorization/cookies/password/tokens/contact values/raw body/traveler PII.
Error response/header должен позволять связать ошибку с server logs без stack/internal leakage.

## 11. Behavioral boundary
StorefrontBehavioralEvent/MarketplaceBehavioralEvent сохраняют свои `eventId`, `sessionId`, `acquisitionSource`.
HTTP requestId ≠ behavioral eventId ≠ sessionId.
Не раздувать behavioral storage correlation-полями без доказанной необходимости.

## 12. Frontend boundary
Frontend не генерирует authoritative backend correlation chain. Не внедрять tracing SDK. Допустимо только поддержать diagnostic request reference, если это необходимо контракту.

## 13. Security abuse cases
Проверить oversized/invalid/control-character headers, duplicate headers, forged correlation, log injection, UUID collision attempt, anonymous/authenticated requests.
Server authority должна быть однозначной.

## 14. Temporal boundary
Correlation IDs — identity, не timestamps. Не менять temporal model 1.13A.

## 15. Debt 1.14
Не исправлять автоматически:
- FAILED Outbox events сейчас не ретраятся автоматически;
- attempts/error используются неполно;
- Booking action CAS debt относится к будущему Booking lifecycle.
Correlation infrastructure ≠ retry infrastructure.

## 16. Step 1.15A boundary
Не выполнять массовую стандартизацию всех event envelopes/payloads. 1.15 создаёт infrastructure + минимальные extension points. Глобальная стандартизация — отдельный Step 1.15A.

## 17. Backward compatibility
Legacy Outbox/Inbox rows с NULL correlation должны обрабатываться. Никакого fake backfill.

## 18. Required tests
Доказать минимум:
1. HTTP request получает requestId.
2. Response возвращает canonical diagnostic ID contract.
3. Независимые requests имеют разные IDs.
4. Invalid/oversized/spoofed header безопасен.
5. Async service видит тот же context.
6. HTTP-triggered Outbox event получает correlation.
7. Child event наследует correlation.
8. Child causation указывает на parent event.
9. Independent chain имеет другой correlation.
10. Consumer retry сохраняет correlation.
11. Duplicate delivery не создаёт новый effect.
12. Legacy NULL event обрабатывается.
13. Anonymous endpoint работает.
14. Authenticated endpoint работает.
15. Behavioral sessionId не подменяется requestId.
16. Logs/errors без secrets/PII.
17. Order canonical events 1.14 не сломаны.
18. BookingRequested flow не сломан.
19. Buyer Cabinet не сломан.
20. Storefront/Marketplace behavioral ingestion не сломан.

## 19. Migration
Если schema меняется: штатная migration, inspect SQL, deploy, status, diff, clean replay, no db push, applied migrations не редактировать.

## 20. Runtime verification
Проверить public request, authenticated request, Order command→Outbox correlation, downstream processing→inherited correlation, child event→causation, второй independent flow→другой correlation, malformed header, отсутствие console/server errors. Smoke data удалить.

## 21. Docs/ADR
Документировать requestId/correlationId/causationId, trust boundary, HTTP headers, async propagation, legacy NULL, отличие от behavioral IDs и business IDs.
При materially новом cross-context contract обновить/создать ADR по conventions проекта.

## 22. Full regression
Backend: typecheck, unit, request-context, eventbus/outbox/inbox, order canonical, booking, buyer, storefront behavioral, marketplace behavioral, auth/RBAC, full serial e2e.
Frontend: typecheck, vitest, production build.
DB: migrate status, drift, clean replay.

## 23. Stop conditions
`ARCHITECTURE DECISION REQUIRED`, если нужно доверять arbitrary client correlation, менять ownership, fundamentally redesign Outbox/Inbox, внедрять tracing vendor, смешивать behavioral identity с correlation, выполнять 1.15A или менять business lifecycle.

## 24. Definition of Done
Единый server-authoritative request context; documented correlation semantics; async propagation; доказанная Outbox/consumer lineage; honest causation; legacy NULL safe; spoofing/log injection закрыты; behavioral identity изолирована; 1.14 regression green; migrations/docs clean; 1.15A/Phase 2 не начаты.

## 25. Финальный отчёт
Вернуть:
1. Current → Target mapping
2. Existing infrastructure
3. Context strategy
4. requestId contract
5. correlationId contract
6. causationId contract
7. HTTP/trust semantics
8. Async propagation
9. Outbox changes
10. Inbox/consumer propagation
11. Child-event lineage
12. AuditLog
13. Logging/errors
14. Behavioral isolation
15. Security/spoofing
16. Legacy compatibility
17. Migration
18. Unit
19. E2E
20. Order 1.14 regression
21. Booking regression
22. Buyer regression
23. Storefront/Marketplace regression
24. Runtime
25. Docs/ADR
26. Issues/fixes
27. Remaining debt
28. Step 1.15A boundary
29. Out-of-scope
30. ARCHITECTURE DECISION REQUIRED — YES/NO

Финальная строка:
`PHASE 1 STEP 1.15 COMPLETED — WAITING FOR REVIEW`

Не переходить к Step 1.15A.
