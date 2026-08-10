# Checkout / Commercial Intent Foundation (Step 2.3A)

**Статус:** реализовано (Step 2.3A), ожидает Strict Review.
**Связанные документы:** `sales-domain-foundation.md`, `sales-center-backend.md`,
`quote-commercial-offer.md`, ADR-0001, TravelHub Canonical Roadmap v3 (2.3A/2.3B/
2.4/2.5B/2.8A/3.31), Deferred Decisions Map DD-022/DD-023.

---

## 1. Ownership

**Владелец checkout/commercial intent — Sales** (`sales.*`, `CheckoutIntent`,
`CKT-*`). Обоснование по каноническим источникам:

- Roadmap Phase 2 — коммерческий поток `Quote → Sale/Checkout → Order`; Step 2.3A
  находится внутри Phase 2 Sales/Commercial flow;
- не создаётся новый bounded context без необходимости (Step 2.3A §6);
- ADR-0001 соблюдён: Sales пишет только в `sales.*`; `catalog.Availability`
  читается READ-only;
- Quote-owned issued snapshot и CheckoutIntent-owned frozen commercial snapshot
  не создают второй competing price authority (см. §3).

## 2. Entity / Context Model

```
CheckoutIntent (sales.*, CKT-*)
 ├── quoteId        → sales.Quote (FK Restrict) — ISSUED Quote обязателен
 ├── customerId     → crm.Customer ref (без FK) — default из Quote, override на create
 ├── status         ACTIVE → CANCELLED (без PAID/COMPLETED/ORDERED/BOOKED/FULFILLED)
 ├── version        CAS (все мутации требуют expectedVersion)
 ├── money snapshot (frozen из Quote): currency / subtotal / discountType /
 │                    discountValue / discountAmount / total  — immutable
 ├── serviceDate    date-only (YYYY-MM-DD → UTC midnight), nullable до установки
 ├── acquisitionSource  server-derived (internal-assisted = DIRECT), immutable
 ├── cancelledAt / createdById / createdAt / updatedAt
 ├── CheckoutIntentTraveler[]  (минимум: firstName/lastName/birthDate)
 └── CheckoutIntentHistory[]   (audit by default, без PII)
```

Traveler/availability НЕ хранятся как raw ORM проекции наружу — только whitelist
DTO (`CheckoutIntentDetailDto`).

## 3. Quote Relation & Binding-Price Semantics

- CheckoutIntent создаётся **только из ISSUED Quote** (DRAFT → 422).
- **Binding price = frozen Quote totals** (subtotal/discountAmount/total/currency),
  копируются server-side при создании и immutable. **Нет reprice от Catalog**:
  изменение `Tariff.price` после ISSUE не меняет intent total (доказано e2e).
- Quote `validUntil` проверяется server-side:
  - create: `validUntil > now` обязательно (expired → 422);
  - существующий intent при истекшем Quote честно флагается
    (`quoteExpired: true`, `priceAuthoritative: false`) — никогда не
    показывается валидным молча (Step 2.3A §46/§68);
  - Quote validity ≠ reservation TTL (резервирования нет, §33).
- Frontend НЕ источник цены: любые money/capacity/source-поля в запросах —
  forbidden keys → 422.

## 4. Monetary Reconciliation Chain (Step 2.3A §10)

| Звено | Authority | Статус |
|---|---|---|
| Catalog Tariff.price | Catalog | текущая (мутабельная) цена |
| Quote ISSUE (subtotal/discount/total) | frozen, Step 2.3 | immutable snapshot |
| CheckoutIntent (frozen copy) | Step 2.3A | immutable, без reprice |
| Sale/Order propagation | Step 2.4/2.5 | НЕ реализовано |
| Payment/Finance reconciliation | 2.10C/2.12 | НЕ реализовано |

Единый контракт денег: DECIMAL(12,2), half-up 2dp (тот же `sales.money.ts`),
единая валюта на intent (mixed currency невозможна — currency из Quote).
`total` intent = коммерческое намерение, **не** paid amount (§49).

## 5. Availability Semantics (read-only, честно)

- **Режим: "checked, not reserved"** — Step 2.3A §14A/§15. Checkout НЕ
  подтверждает доступность и НЕ гарантирует capacity.
- Каждый ответ несёт `availability.state = CHECKED_NOT_RESERVED | NOT_SPECIFIED`
  + `semantics` (явная documented семантика; никакого `available=true` по stale read).
- Per quote item: фактические `catalog.Availability` счётчики
  (`available = total - booked - reserved`), `level = AVAILABLE | UNAVAILABLE |
  NOT_CONFIGURED` (NOT_CONFIGURED — capacity не настроена; честно, не ошибка).
- **Никаких записей в catalog.Availability** (ADR-0001) — capacity не
  резервируется, `slotsReserved/slotsBooked` не меняются (e2e №9).
- Резервирование/locking: **отложено** (DD-022) — владелец и контракт —
  граница Order/Booking (Step 2.4/2.8A); до этого safe read-only семантика
  достаточна для authoritative checkout intent (Step 2.3A §77.4).

## 6. Service Date / Time

- `serviceDate` — date-only (`YYYY-MM-DD` → UTC midnight), не в прошлом
  (по календарной дате UTC). Хранение без day-shift.
- Time-of-day / IANA timezone / DATE_ONLY|TIME_SLOT|DATE_RANGE — **не
  симулируются**: это контракт Step 2.8A (Booking service date/time model).
  Серверная timezone не используется молча (§19).

## 7. Travelers / Options

- **Travelers:** наследуются из QuoteTraveler при создании (editing allowed),
  replace-all командой, минимум полей (firstName/lastName/birthDate date-only),
  max 50, **без passport/document/payment данных** (§20/§42).
- **Options: НЕ введены** (DD-023). Каноническая catalog options entity
  отсутствует; invent arbitrary JSON options запрещено (§21). `options` в
  запросе → явный 422 (forbidden key), не молчаливый ignore. Option pricing
  server-resolved появится вместе с канонической моделью.

## 8. Acquisition / Publication Context

- `acquisitionSource` — **server-derived** (internal-assisted entry = `DIRECT`),
  immutable после создания; клиент не может forged source (§26).
- **Publication ≠ Acquisition** (§25): publication channel (catalog.*
  `ProductPublicationChannel`) не используется как acquisition source.
- Канонические значения из Step 2.5B: MARKETPLACE / PARTNER_STOREFRONT / DIRECT
  (schema-local enum `sales.SalesAcquisitionSource`; расширение — 2.5B).
- Публичный/BUYER checkout (MARKETPLACE/PARTNER_STOREFRONT acquisition) —
  Step 3.31 Marketplace Checkout; в 2.3A только internal-assisted flow.

## 9. Trust Boundary / Customer Scope

- **Internal staff-only** endpoints (`sales.checkout.read/write`). BUYER/PARTNER/
  FINANCE/ANALYST/MARKETER/OPERATOR → 403 (raw checkout содержит PII-adjacent
  travelers + frozen money snapshot; aggregate-only роли — только KPI).
- `customerId` — business reference: default из Quote, override валидируется
  server-side (existence, crm.Customer read-by-ID). Нет `?customerId=` authority
  для BUYER (§62); анонимный checkout не вводится (§30).
- Actor всегда = authenticated staff user (`createdById`, audit) — отдельно от
  customer.

## 10. Lifecycle / Expiry

- `ACTIVE → CANCELLED` (терминал; повторный cancel → 422). Без
  PAID/COMPLETED/ORDERED/BOOKED/FULFILLED (§32).
- Отдельные temporal-поля: `createdAt/updatedAt` (entity time), `serviceDate`
  (услуга), `cancelledAt` (lifecycle). `updatedAt` НЕ используется как milestone.
- Intent expiry отдельно от Quote validity не вводится (нет hold → нет TTL);
  staleness Quote — честный флаг в каждой проекции (§33/§68).

## 11. Version / CAS / Idempotency

- Все мутации (travelers / service-date / revalidate / cancel) требуют
  `expectedVersion`; CAS `updateMany(where: { id, version })` → 409 при stale
  (§34). Revalidate — read-like: CAS без инкремента version.
- Idempotency: глобальные Idempotency-Key — владелец Step 2.10. Резервирования
  нет → дублирование hold невозможно; повторный create создаёт новый intent
  (легковесный, отменяемый) — документировано (§35).

## 12. History / Audit

- `CheckoutIntentHistory` (immutable): created → travelers_changed →
  service_date_changed → availability_checked → cancelled. Без PII (counts/refs/
  state, не имена/тела).
- `security.AuditLog`: sales.checkout.{created,travelers_changed,
  service_date_changed,revalidated,cancelled} — без PII/raw body.

## 13. RBAC / Capabilities

- Новые права: `sales.checkout.read` (detail/list/history),
  `sales.checkout.write` (create/update/revalidate/cancel).
- Матрица: ADMIN (ALL) · DIRECTOR (read) · SALES_MANAGER (read+write) ·
  FINANCE/ANALYST/MARKETER/MODERATOR/OPERATOR/PARTNER/BUYER — нет (403).
- Роли = presets; per-user capabilities — Step 3.12E/DD-021 (не нарушено).

## 14. API Surface

`/api/v1/sales/checkouts` (staff-only):

| Method | Path | Action | Permission |
|---|---|---|---|
| POST | `/checkouts` | create из ISSUED Quote | write |
| GET | `/checkouts` | list (status/quoteId/customerId/code/page) | read |
| GET | `/checkouts/:code` | detail (+ свежий availability) | read |
| GET | `/checkouts/:code/history` | history | read |
| PUT | `/checkouts/:code/travelers` | replace-all travelers | write |
| PUT | `/checkouts/:code/service-date` | service date (date-only) | write |
| POST | `/checkouts/:code/revalidate` | availability re-check (без reprice) | write |
| POST | `/checkouts/:code/cancel` | ACTIVE → CANCELLED | write |

Никакого generic PATCH; никаких price/payment/order actions. Server-owned поля
(money/currency/source/status/options/capacity) — forbidden keys → 422.
Error model канонический (400/401/403/404/409/422/500 + requestId).

## 15. Events / Outbox

Событий нет: availability read-only → нечего публиковать; `OrderRequested` —
Step 2.4 (здесь отсутствует). Никаких спекулятивных events (§52).

## 16. Explicit Non-Goals (Step 2.3B / 2.4+)

- Payment Terms (FULL_PREPAYMENT/PARTIAL/DEPOSIT/PAY_LATER/PAY_AT_SERVICE) —
  Step 2.3B, не введены;
- Sale completion / Sale CLOSED / `OrderRequested` / Order creation — Step 2.4;
- Order snapshot consumer (2.5), Booking (2.8), Payment/PSP/Finance (2.10+),
  Documents (2.15), Marketplace/BUYER Checkout UI (3.31), cart UI, tax/commission.

## 17. Prerequisites Status (Step 2.3A §77)

1. Outbox retry — open до 2.4/2.5 (не зависит: checkout событий не публикует).
2. Booking currency — open до 2.8.
3. Monetary contract — свери́н для Quote+Checkout (frozen chain); Order/Finance
   propagation open.
4. Availability reservation/locking — **explicitly deferred** (DD-022) с safe
   read-only семантикой; НЕ требуется для authoritative intent до 2.4.
5. Order snapshot policy — open до 2.5.
6. bootstrap removal — 2.6.
7. Payment/PSP/ledger — 2.10C/2.12.
8. Supplier lifecycle — 2.8.
9. Checkout/payment idempotency keys — 2.10; локальная retry-безопасность
   reservation не требуется (нет reservation).
