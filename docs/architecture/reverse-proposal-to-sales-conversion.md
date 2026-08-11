# Reverse Marketplace — Proposal → Canonical Sales Conversion (Step 2.2F)

**Status:** IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW (2026-08-11)
**Canonical owners:** Reverse Marketplace (`reverse.*`) + Sales (`sales.*`)
**Decision:** DD-030 RESOLVED — conversion target = **Opportunity (`OPP-*`)** (см.
`docs/prompts/DD-030_PROPOSAL_TO_CANONICAL_SALES_CONVERSION_POINT_ARCHITECTURE_DECISION.md`)

---

## 1. Canonical path (DD-030)

```
BuyerRequest (BRQ-*)
→ Matching/Distribution (reverse.*)
→ SellerProposal (PRP-*, SUBMITTED)
→ Buyer selection (reverse.*)                ← Step 2.2F owner: Reverse
→ Opportunity (OPP-*, sales.*, NEW)          ← Step 2.2F target: Sales owner
→ Quote (QTE-*) → CheckoutIntent → Sale → OrderRequested → Order → Booking → Finance
```

Hard invariants (2.2F prompt §1/§18/§19/§38):

- конверсия создаёт **ровно один canonical Opportunity**; Lead НЕ создаётся
  (`leadId = NULL`; DD-030 rejected Lead — дубликат BuyerRequest-demand);
- Quote НЕ создаётся автоматически (2.2F scope = Opportunity; canonical Quote —
  отдельная Sales-работа после); Proposal money НЕ-binding, не копируется
  (никакого shadow pricing — Opportunity не имеет money-полей);
- никакого BuyerRequestOrder/ProposalOrder/ReverseQuote/ReverseCheckout/
  ReverseSale/ReverseBooking (параллельный pipeline запрещён);
- никакого cross-domain прямого Prisma: Reverse пишет reverse.*, создание
  Opportunity — через Sales owner service в единой tx (ADR-0001).

## 2. Selection ownership (Reverse)

`POST /api/v1/buyer/requests/:requestId/proposals/:proposalId/select`
(`reverse.proposal.select_own`, ТОЛЬКО BUYER-владелец request; PARTNER → 403;
cross-buyer → neutral 404). Client передаёт ТОЛЬКО `expectedVersion` (CAS
BuyerRequest); все остальные поля forged → 422 (`PROPOSAL_SELECT_FORBIDDEN_KEYS`).

Reverse-owned state:

| Поле | Инвариант |
|---|---|
| `BuyerRequest.selectedProposalId` (TEXT, `@unique`) | one selected Proposal per request AND one request per selected Proposal (DB-level one-winner) |
| `SellerProposal.selectedAt` (TIMESTAMP) | момент selection (server-owned) |
| `SellerProposal.convertedOpportunityId` (TEXT, `@unique`) | один Proposal → максимум одна Opportunity (duplicate-conversion guard) |
| `SellerProposal.convertedAt` (TIMESTAMP) | момент конверсии |

`ProposalStatus` enum НЕ расширяется (DRAFT/SUBMITTED/WITHDRAWN остаются;
SELECTED/CONVERTED не вводятся — selection это отдельный факт, не lifecycle).

## 3. Opportunity ownership (Sales)

`SalesService.createOpportunityFromBuyerRequestSelection(tx, input, actor)` —
owner-метод (НЕ generic DTO-based create; trusted server-derived контекст):

- `leadId = null`, `status = NEW` (никакого авто-OPEN/WON; lifecycle управляет Sales);
- `acquisitionSource = BUYER_REQUEST` (server-derived, клиент не передаёт);
- provenance refs без FK (ADR-0001): `buyerRequestId`, `proposalId` (`@unique`),
  `sellerId` (выбранный Seller = crm.Partner; `assignedToId` остаётся internal
  staff-owner, не используется как Seller-измерение);
- title — server-owned seed `BuyerRequest {code} — {categorySlug}` (Proposal
  text не является коммерческим authority; анти-disintermediation/privacy
  boundaries сохранены);
- history (`opportunityHistory` action `created`, source=buyer_request_proposal_selection)
  + audit `sales.opportunity.created_from_buyer_request` — без PII/контента.

## 4. Atomic owner-service orchestration

Одна PostgreSQL-транзакция в `ProposalsService.selectProposal`:

1. `FOR UPDATE` на `reverse.BuyerRequest` — сериализация cancel/selection race;
   повторная проверка `status == SUBMITTED` (CANCELLED → 422);
2. one-winner re-check после lock (другой Proposal → 409);
3. `FOR UPDATE` на `reverse.SellerProposal` — сериализация withdraw/selection
   race; повторная проверка `status == SUBMITTED` (WITHDRAWN → 422);
4. CAS по `expectedVersion` (request) и version (proposal) → stale 409;
5. `SalesService.createOpportunityFromBuyerRequestSelection(tx, ...)` — тот же tx;
6. selection state + `buyerRequestHistory` (`proposal_selected`) +
   `sellerProposalHistory` (`selected`) + audit — тот же tx.

Failure → полный rollback (никакого selected-without-opportunity /
opportunity-without-selected / partial history).

## 5. Concurrency / idempotency (prompt §31–§34)

- **Retry (тот же Proposal):** fast-path `request.selectedProposalId === proposalId`
  → возврат существующего результата (`idempotent: true`), вторая Opportunity НЕ
  создаётся (подкреплено `@unique` на `Opportunity.proposalId` и
  `SellerProposal.convertedOpportunityId`).
- **Concurrent A/B selection:** row-lock сериализация → ровно один победитель
  (201), проигравший — управляемый 409.
- **Cancel race:** cancel закоммичен → select 422; select закоммичен → cancel
  проходит, созданная Opportunity durable (не инвалидируется молча).
- **Withdraw race:** withdraw закоммичен → select 422; select закоммичен →
  withdraw 422 (guard в `withdrawOwn` на `convertedOpportunityId`).
- **Stale CAS:** 409, без partial state.

## 6. Acquisition source propagation (§21–§24, gap fix)

Gap (DD-030): `createCheckoutIntent` хардкодил `DIRECT`. Fix (минимальный,
owner-correct): source течёт server-side по цепочке:

```
Opportunity.acquisitionSource (BUYER_REQUEST | NULL)
  → Quote.acquisitionSource   (наследуется из Opportunity при opportunityId; NULL иначе)
  → CheckoutIntent.acquisitionSource (quote.acquisitionSource ?? DIRECT)
  → Sale.acquisitionSource    (frozen из checkout — существующий код)
  → OrderRequested payload / Order / Booking (2.5B, существующий)
```

- request-led путь: `BUYER_REQUEST` на каждом уровне (e2e reverse-conversion #14);
- direct путь: Quote без opportunity → NULL → Checkout `DIRECT` (legacy сохранён,
  e2e reverse-conversion #15; существующие checkout e2e — зелёные);
- client не может forged source (`PROPOSAL_SELECT_FORBIDDEN_KEYS` + проверка
  checkout body — `acquisitionSource` не принимается).

## 7. Boundaries / isolation

- **Lead:** 0 строк (e2e #5/#13).
- **Quote/Checkout/Sale/Order/Booking/Payment:** 0 строк при конверсии (e2e #5/#13).
- **Catalog:** 0 мутаций (никакого Product/Tariff/Availability hold).
- **Communication:** 0 мутаций (CML-потоки 2.2E не затрагиваются).
- **Contact disclosure:** не меняется (MATCHED ≠ CONVERTED ≠ CONTACT DISCLOSED).
- **Events/outbox:** 0 новых событий (нет consumer; direct orchestration).
- **RBAC:** `reverse.proposal.select_own` — только BUYER; PARTNER/ADMIN
  deliberate (ADMIN не обходит object-scope: сервисный гейт role==BUYER).

## 8. Schema / migration

`20260811120000_add_proposal_to_opportunity_conversion` — аддитивно, без
backfill, без cross-schema FK, nullable legacy-safe:

- `reverse.BuyerRequest.selectedProposalId TEXT @unique`
- `reverse.SellerProposal.selectedAt / convertedOpportunityId @unique / convertedAt`
- `sales.Opportunity.buyerRequestId / proposalId @unique / sellerId / acquisitionSource`
  + индексы `(buyerRequestId)`, `(sellerId)`
- `sales.Quote.acquisitionSource` (enum `SalesAcquisitionSource`)

Чистое replay подтверждается e2e globalSetup (drop + recreate + migrate deploy
на каждый прогон); dev DB: 36/36, drift 0.

## 9. Tests

`test/reverse-conversion.e2e-spec.ts` (15, §47 + §48): gates/mass-assignment,
404 neutrality, eligibility, happy path + provenance, idempotent retry, one-winner
(sequential + concurrent), duplicate conversion, cancel/withdraw races, failure
atomicity, history/audit (без PII), no side effects/events, request-led
BUYER_REQUEST end-to-end, direct DIRECT legacy.

Регрессия (2026-08-11): 743/743 backend e2e, 380 unit, 135 frontend vitest,
backend+frontend build green.

## 10. Out of scope (будущие шаги)

Quote автосоздание из конвертированной Opportunity, Proposal → Quote
переклассификация, contact disclosure, notifications/attachments, Service
Templates / Universal Pricing, второй messaging domain — НЕ реализованы.
