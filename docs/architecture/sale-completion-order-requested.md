# PHASE 2 STEP 2.4 — Sale Completion → OrderRequested + Availability Reservation Gate

## 1. Verdict / scope

Step 2.4 реализует единственную canonical команду завершения продажи:

`Sales commercial intent (CheckoutIntent) → completed Sale → OrderRequested`

с обязательным **atomic availability revalidate/reserve gate** (DD-022 closure) и
**минимальным durable retry contract** для критичного события (G2, Step 1.18 debt).

Order creation (consumer) принадлежит Step 2.5 — здесь Order НЕ создаётся.

## 2. Owner boundaries (ADR-0001)

| Домен | Владеет | Роль в 2.4 |
|---|---|---|
| Sales | Sale/CheckoutIntent/snapshot | `completeSale` (CAS, snapshot, emit) |
| Catalog | Availability/capacity | `CatalogService.reserveAvailability` — **owner command** |
| Order | Order (Step 2.5) | consumer OrderRequested |
| EventBus | Outbox transport | emit (atomic), publishPending, retryFailed |

Sales **НЕ пишет** в `catalog.Availability` / `order.*` — резервация выполняется
через owner-service boundary (`CatalogService.reserveAvailability(tx, ...)`) в той
же PostgreSQL-транзакции (общая транзакция допустима §16; ownership boundary —
owner command).

## 3. Sale lifecycle

- `OPEN → CLOSED` — каноническое успешное завершение продажи (Step 2.1 enum
  сохранён, без переименования). `CLOSED` НЕ означает paid/fulfilled/OrderClosed.
- `completedAt`/`completedById` — реальный lifecycle milestone (не updatedAt).
- Повторный complete уже CLOSED Sale → 409; CAS по version — один победитель.

## 4. Checkout prerequisites (блокирующие 422/409)

1. Sale привязан к CheckoutIntent (`checkoutIntentId`); иначе 422.
2. Checkout `ACTIVE` (не CANCELLED) — иначе 422.
3. **Payment terms выбраны** (`paymentScheme` + derived amounts) — без выбранной
   схемы completion заблокирован. Никакого дефолтного FULL_PREPAYMENT fallback.
4. `serviceDate` задан (резервирование на дату невозможно без неё).
5. Quote содержит >= 1 валидный item (productId/tariffId/quantity).

Quote expiry policy (2.3B): frozen Checkout остаётся price authority; expiry
источника НЕ блокирует terms, а для completion влияние не вводится сверх
frozen snapshot (нет Catalog reprice).

## 5. Commercial snapshot (G3) — immutable, на Sale

При completion на Sale фиксируются (server-copied из frozen Checkout):

- currency/subtotal/discountType/discountValue/discountAmount/total;
- paymentScheme/prepaymentType/prepaymentValue/initialAmount/remainingAmount;
- acquisitionSource; serviceDate; reservationId (первая reservation); orderRequestedEventId.

Order consumer читает ЭТИ факты (плюс payload события) — без повторного чтения
mutable Catalog price. После completion Checkout-мутации НЕ влияют на Sale
(§52-54 e2e: Catalog reprice не меняет snapshot).

## 6. Availability reservation (G1 / DD-022 closure)

**`catalog.AvailabilityReservation`** (owner — Catalog):

- `code` `RSR-*` (IdsService, атомарный счётчик);
- productId/tariffId/date (date-only, UTC midnight)/quantity;
- sourceSaleId (кросс-контекст, без FK); status `HELD|RELEASED`;
- инвариант: один Sale → один hold на (productId, tariffId, date) с quantity.

**Atomic last-slot** — ОДИН conditional raw UPDATE:

```sql
UPDATE "catalog"."Availability"
SET "slotsReserved" = "slotsReserved" + qty
WHERE productId = $1 AND tariffId IS NOT DISTINCT FROM $2 AND date = $3
  AND "slotsTotal" - "slotsBooked" - "slotsReserved" >= qty
```

count=1 → резервация создана; count=0 → 409 (capacity) или 422 (NOT_CONFIGURED).
Два concurrent complete одного последнего слота → ровно один успех (нет TOCTOU).

Rollback транзакции откатывает hold + инкремент. После committed Sale + FAILED
outbox hold НЕ освобождается автоматически (OrderRequested retryable) —
release-on-cancel принадлежит owner-step (2.5+).

## 7. OrderRequested contract

- `eventType: "OrderRequested"`, aggregateType `Sale`, aggregateId sale.id;
- `retryable: true` (durable retry); correlation наследуется из HTTP requestId;
- payload **без PII** (нет имён/email/passport; traveler details — canonical read в 2.5);
- frozen commercial facts + items (product/tariff refs, quantity, unitPrice, amount);
- acquisitionSource — не ре-вычисляется consumer-ом (2.5B).

## 8. Outbox retry (G2, Step 1.18 debt)

Legacy FAILED остаётся терминальным (конвенция Step 1.18 не меняется). Для
`retryable=true` событий (OrderRequested):

- delivery failure → `FAILED` + `attempts+1` + error;
- `EventBusService.retryFailed(limit)` — FAILED retryable с `attempts < 5` и
  `nextAttemptAt <= now` → flip в PENDING (тот же eventId/correlation/causation);
- backoff: экспоненциальный `2^(n-1)` s, cap 60 s (чистый helper);
- max attempts 5 → poison остаётся FAILED (не выбирается);
- Inbox dedup — authoritative защита от duplicate side effect.

## 9. API / RBAC

- `POST /api/v1/sales/sales/:code/complete` — body только `{ expectedVersion }`;
  permission `sales.sale.complete` (SALES_MANAGER/ADMIN; DIRECTOR read-only);
- DTO/mass-assignment: `SALE_COMPLETE_FORBIDDEN_KEYS` (все derived поля → 422);
- `createSale` принимает `checkoutIntentId` (валидация: ACTIVE + совпадение Quote).

## 10. Failure atomicity matrix

| Failure | Sale completed? | Reservation? | Outbox? |
|---|---|---|---|
| validation (terms/cancel/no-date) | no | no | no |
| unavailable | no | no | no |
| stale CAS | no | no | no |
| reservation DB fail | no | no | no |
| Sale update fail | no | no | no |
| outbox insert fail | no | no | no |
| consumer delivery fail after commit | **yes** | **yes (HELD)** | **FAILED retryable** |

## 11. No Payment / No Booking / No Order

- Payment terms — только commercial obligation (не Payment/PSP/ledger);
- Booking/Passenger — не создаются (inventory hold ≠ supplier booking);
- Order — создаётся consumer-ом Step 2.5 (никакого bootstrap).

## 11.5 Checkout post-completion (STRICT REVIEW)

- После Sale completion Checkout де-факто immutable: мутации (payment-terms /
  service-date / travelers / cancel) → 409 через `assertCheckoutNotCompleted`
  (STRICT REVIEW fix). Checkout остаётся `ACTIVE` (нет отдельного COMPLETED-
  статуса) — «иммутабельность» выражена через связь с CLOSED Sale.
- **Known narrow race (не блокирует):** guard — read-then-mutate (findFirst
  CLOSED Sale → затем отдельная транзакция мутации). Конкурентный completeSale
  в узком окне между проверкой и коммитом мутации может быть обойдён; CAS по
  checkout.version не защищает (completion не инкрементирует его). Деньги
  защищены инвариантом: Sale snapshot immutable — расхождение Checkout vs Sale
  после такого окна не меняет завершённую экономику. Закрытие — flip Checkout
  в терминал при completion (Step 2.5, Order consumer) либо CAS с row lock.

## 12. Deferred

- Order consumer (2.5); release/expiry hold (2.5+); time-slot/timezone (2.8A);
- options (DD-023); PMT-* Finance entity (2.10); partner allowed-schemes allowlist.

## 13. DD-022 / Step 1.18 status

- **DD-022 (availability reservation prerequisite): CLOSED** — atomic conditional
  reserve + durable HELD hold + last-slot proof (e2e 21-25).
- **Step 1.18 FAILED retry debt: CLOSED sufficiently for critical chain** —
  минимальный durable retry contract (retryFailed + backoff + maxAttempts),
  legacy-поведение сохранено.
