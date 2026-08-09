# PHASE 1 — STEP 1.15 — STRICT IMPLEMENTATION REVIEW

Проведи строгий review фактически реализованного Step 1.15. Implementation report не считать доказательством. Проверять middleware, AsyncLocalStorage, exception filter, EventBus, Outbox/Inbox, AuditLog, Order/Booking flows, behavioral endpoints, tests, ADR-0009 и runtime.

Не переходить к Step 1.15A / Step 1.16 / Phase 2.

## Критические проверки

1. **RequestId trust model**
   - Клиентский `X-Request-Id` не должен непреднамеренно давать клиенту authority над business correlation.
   - Если root `correlationId = accepted client X-Request-Id`, проверить повтор одного UUID в двух независимых requests.
   - Если это intentional — ADR-0009 должен говорить об этом однозначно.
   - Иначе REVIEW FIX REQUIRED / ARCHITECTURE DECISION REQUIRED.

2. **Repeated client ID**
   - Request A и B с одним valid UUID.
   - Проверить requestId/correlationId/outbox/audit.
   - Независимые operations не должны случайно сливаться в одну causal chain.

3. **Header spoofing/parsing**
   - invalid, oversized, duplicate, comma-joined, whitespace, control chars, case normalization.
   - `X-Correlation-Id` от public client не authoritative.
   - no log/header injection.

4. **Middleware ordering**
   - context доступен в guards/controllers/services/exception handling.
   - requestId присутствует на 200/401/403/404/409/422/500, где middleware coverage позволяет.

5. **ALS isolation**
   - 50+ parallel requests.
   - Promise.all / transactions / event publishing.
   - ни один context не видит ID другого request.
   - nested context после завершения восстанавливает parent.

6. **emit/emitResult override semantics**
   - `undefined` → inherit.
   - `null` → только если contract разрешает intentional null.
   - `""` не должен сохраняться как valid correlation.
   - malformed explicit ID rejected/normalized.
   - valid override проходит validation.

7. **Business-code correlation cleanup**
   Repo-wide найти active production correlationId = order.code / booking.code / submissionId / customerId / partnerId / product code. Любой такой active path — REVIEW FIX.

8. **Outbox / consumer propagation**
   - HTTP-triggered event получает правильный correlation.
   - Consumer invocation имеет новый requestId.
   - inherited correlation сохраняется.
   - child `causationId = parent eventId`.
   - legacy NULL correlation не фабрикуется.

9. **Independent HTTP actions**
   - confirm и отдельный send request не должны автоматически считаться одной technical chain только потому, что работают с одним Order.
   - business relation ≠ correlation chain.

10. **Inbox dedup**
    - duplicate delivery не создаёт новый side effect/child event/new chain.
    - dedup transaction proof.

11. **publishPending concurrency**
    - несколько events параллельно не смешивают ALS context.
    - failed event не загрязняет context следующего.

12. **AuditLog**
    - existing details не перезаписываются.
    - caller не может spoof `details.correlation`.
    - no context → NULL-preserving.
    - no PII/raw headers/tokens.

13. **Exception filter**
    - requestId header == body requestId.
    - existing error contract backward-compatible.
    - validation/domain/auth/500 shapes не сломаны.
    - stack trace не публикуется.

14. **Logging/privacy**
    - request/correlation IDs допустимы.
    - no Authorization/cookies/password/token/raw body/traveler PII.
    - no log injection.

15. **Behavioral isolation**
    - Marketplace/Storefront `sessionId`, `eventId`, acquisitionSource не изменены.
    - correlation fields не добавлены в behavioral storage.
    - public telemetry client не начал отправлять auth/correlation headers.

16. **Frontend boundary**
    - frontend не генерирует authoritative correlation.
    - не reuses response requestId автоматически в следующем independent call.
    - не отправляет `X-Correlation-Id`.

17. **ADR-0009 consistency**
    Однозначно определить authority для requestId/correlationId, external header behavior, causation, legacy NULL и distinction from behavioral IDs/business IDs.

18. **Step 1.15A boundary**
    Не должно быть массового global event-envelope refactor, actor/source/version metadata redesign.

19. **Debt isolation**
    FAILED Outbox retry и attempts/error debt не исправлять как часть 1.15 review; только убедиться, что correlation сохраняется и docs честны.

## Обязательные tests

Минимум:
- requestId на 200/4xx/5xx;
- invalid/oversized/duplicate headers;
- same valid client UUID across two independent requests;
- X-Correlation-Id ignored;
- 50+ parallel ALS isolation;
- nested restore;
- HTTP → Outbox correlation;
- independent requests → distinct causal chains;
- child correlation inheritance;
- child causation = parent eventId;
- legacy NULL;
- duplicate consumer delivery;
- parallel publishPending isolation;
- explicit null/empty/malformed override;
- AuditLog anti-spoofing;
- error header/body match;
- behavioral isolation;
- Order 1.14 regression;
- Booking regression.

## Runtime

Проверить independently:
anonymous request, authenticated request, same reused client X-Request-Id twice, Order command→Outbox, separate send request, BookingRequested→BookingCreated lineage, duplicate delivery, malformed header, concurrent requests, error response requestId, AuditLog correlation, behavioral endpoint.

## Full regression

Backend: typecheck, unit, request-context, eventbus/outbox/inbox, order-canonical, booking, buyer, auth/RBAC, temporal, storefront behavioral, marketplace behavioral, full serial e2e.
Frontend: typecheck, vitest, production build.
DB: migrate status + diff/no drift.

## Outcome

Если всё чисто:
`PHASE 1 STEP 1.15 REVIEW PASSED — WAITING FOR APPROVAL`

Если fixes:
`PHASE 1 STEP 1.15 REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

Если требуется новое trust/ownership решение:
`ARCHITECTURE DECISION REQUIRED`

Не переходить к Step 1.15A.
