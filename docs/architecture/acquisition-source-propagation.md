# Acquisition Source Propagation (Phase 2 — Step 2.5B)

## 1. Mission

Зафиксировать acquisition source как first-class immutable transaction context
(ADR-0007 §3): источник коммерческого спроса фиксируется в момент входа в
canonical sales pipeline и НЕ пересчитывается/не выводится задним числом.

```text
Checkout (server-derived) → Sale (frozen) → OrderRequested (frozen payload)
→ Order (frozen snapshot) → Booking (frozen ref, READ-only из Order)
```

## 2. Canonical semantics

Acquisition source = коммерческий канал/происхождение спроса, приведшего к
сделке. НЕ publication channel, НЕ UI surface, НЕ seller country, НЕ destination,
НЕ campaign/referrer, НЕ payment method, НЕ booking provider. Publication channel
остаётся отдельным контрактом (ADR-0007 §3; ProductPublicationChannel).

## 3. Values

`SalesAcquisitionSource` (sales schema, schema-local enum — Prisma multiSchema):

- `MARKETPLACE`
- `PARTNER_STOREFRONT`
- `DIRECT` (MANUAL/DIRECT — internal-assisted entry)
- `BUYER_REQUEST` (Step 2.5B, Roadmap Amendment — аддитивно; Step 2.2F
  реализует request-led коммерческий путь через Reverse Marketplace
  конверсию → canonical Sales pipeline)

`PARTNER_CUSTOM_DOMAIN` / `API` — «позднее» по Roadmap 2.5B, НЕ добавляются.
Никаких duplicate synonyms. Отдельная behavioral-analytics константа
`AcquisitionSource` (catalog, TS-union MARKETPLACE/PARTNER_STOREFRONT/DIRECT) —
server-authoritative контекст просмотров/кликов, НЕ коммерческий источник сделки;
значения совпадают, семантика разная (события телеметрии не участвуют в
transaction lineage).

## 4. Authority / derivation

- Source — server-authoritative. Клиент не может forge: поля нет ни в одном DTO
  (bootstrap/checkout/sale), whitelist-стрип подтверждён e2e.
- Checkout (Step 2.2F, DD-030 gap fix): source выводится server-side из Quote —
  `quote.acquisitionSource ?? DIRECT`. Request-led путь (Quote из конвертированной
  Opportunity) → `BUYER_REQUEST`; direct/staff flow (Quote без source) → `DIRECT`
  (legacy поведение сохранено, e2e reverse-conversion #14/#15).
- Opportunity.acquisitionSource (Step 2.2F): server-derived; Reverse-конверсия →
  `BUYER_REQUEST`; staff-созданные Opportunity → NULL (честно, без угадывания).
- Quote.acquisitionSource (Step 2.2F): наследуется из Opportunity при создании
  Quote по opportunityId; без opportunityId → NULL (Checkout резолвит DIRECT).
- Bootstrap Order: server-derived `DIRECT` (та же internal-assisted семантика;
  Step 2.5B) — НЕ fabricated: staff-создание заказа = MANUAL/DIRECT канал.
- После freeze (Checkout → Sale) source immutable: completion не пересчитывает,
  lifecycle/temporal-переходы не меняют, retry/duplicate не меняют.

## 5. Propagation chain (verified)

| Слой | Механизм |
|---|---|
| Opportunity.acquisitionSource | server-derived (конверсия → BUYER_REQUEST; staff → NULL) |
| Quote.acquisitionSource | наследуется из Opportunity (без opportunityId → NULL) |
| CheckoutIntent.acquisitionSource | server-derived из Quote (`quote.acquisitionSource ?? DIRECT`) |
| Sale.acquisitionSource | копия из checkout при создании Sale (frozen) |
| OrderRequestedPayload.acquisitionSource | frozen snapshot Sale при complete |
| Order.acquisitionSource (String?) | consumer персистит payload source точно; валидатор whitelist Object.values(SalesAcquisitionSource) — BUYER_REQUEST принят автоматически |
| Booking.acquisitionSource (String?) | consumer BookingRequested копирует из Order (READ-only, ADR-0001) |

Cross-schema refs — String без FK (Prisma multiSchema / ADR-0001), как
discountType/paymentScheme на Order.

## 6. Immutability

Freeze после Checkout→Sale. Ordinary mutations/lifecycle/retry/reprice не меняют.
Duplicate OrderRequested delivery — inbox dedup + Order.saleId @unique, source не
перезаписывается (e2e #5). Failure: невалидный source → событие FAILED, никакого
Order (e2e #6).

## 7. Legacy / null

NULL — честная семантика строк до 2.5B (legacy Order/Booking без backfill, e2e #9).
Bootstrap до 2.5B имел NULL; новые bootstrap-заказы — DIRECT.

## 8. Events / PII

acquisitionSource добавлен только туда, где каноничен (OrderRequested — уже был,
Booking — row-level ref). BookingCreated/OrderCreated payload — минимальные refs
без расширения. Никакого PII в attribution (e2e #10).

## 9. Booking boundary (Roadmap lineage)

Roadmap 2.5B/2.2F: `BuyerRequest → Proposal → Opportunity → Quote → Checkout →
Sale → OrderRequested → Order → Booking → Payment → Settlement → Analytics`.
Step 2.2F реализовал request-led начало цепочки (Opportunity/Quote/Checkout
carry BUYER_REQUEST server-side, e2e reverse-conversion #14); 2.5B реализовал
минимальный immutable snapshot на Booking (frozen ref из Order).
Payment/Settlement/Analytics — будущие owner-steps, НЕ реализованы (никаких
Payment-сущностей/financial events/analytics).

## 10. Migration

`add_acquisition_source_propagation` — аддитивно: `ALTER TYPE ... ADD VALUE
'BUYER_REQUEST'` + `Booking.acquisitionSource TEXT` (nullable, без default/
backfill). Чистый replay, drift 0.

## 11. Tests

`test/acquisition-source-propagation.e2e-spec.ts` (10): DIRECT flow end-to-end;
forge rejection; bootstrap DIRECT; lifecycle/temporal preserve; duplicate delivery;
unknown → FAILED; BUYER_REQUEST contract propagation (без Reverse Marketplace —
reverse-схемы нет); Booking propagation; legacy NULL; no side effects/PII.
`test/reverse-conversion.e2e-spec.ts` (15, Step 2.2F): request-led цепочка
Opportunity → Quote → Checkout = BUYER_REQUEST (#14); direct flow Quote без
Opportunity → Checkout = DIRECT (#15); source не forgeable (#2); конверсия
создаёт ровно одну Opportunity с BUYER_REQUEST (#5).

## 12. Migration (Step 2.2F)

`20260811120000_add_proposal_to_opportunity_conversion` — аддитивно: reverse.
`BuyerRequest.selectedProposalId` (TEXT, @unique), reverse.`SellerProposal`.
`selectedAt`/`convertedOpportunityId` (@unique)/`convertedAt`, sales.`Opportunity`.
`buyerRequestId`/`proposalId` (@unique)/`sellerId`/`acquisitionSource`,
sales.`Quote`.`acquisitionSource` (enum `SalesAcquisitionSource`). Без backfill,
без cross-schema FK (ADR-0001), nullable legacy-safe; чистое replay (globalSetup
e2e пересоздаёт тестовую БД), drift 0.
