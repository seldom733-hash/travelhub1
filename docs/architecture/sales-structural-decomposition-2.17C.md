# SALES DOMAIN — STRUCTURAL DECOMPOSITION DESIGN (STEP 2.17C)

**Project:** TravelHub
**Step:** 2.17C — Sales Domain Structural Decomposition
**Pass:** DESIGN / DECOMPOSITION ONLY (repository-first, behavior-preserving)
**Repository baseline:** HEAD `f688f57` (2026-08-18)
**Production implementation:** NOT STARTED (forbidden in this pass)

---

## 1. PURPOSE

`backend/src/modules/sales/sales.service.ts` (2,527 lines, 41 public async
methods, 25 private methods) is the largest single service in the Sales
bounded context. This document is the canonical implementation design for a
behavior-preserving structural decomposition. It is derived exclusively from
repository evidence (code is authority) — not from prior summaries.

The objective is **not** to reduce the line count. The objective is to give
every existing responsibility an explicit owner, every method a destination,
and to make future implementation reviewable in small reversible waves while
preserving every TravelHub behavior and authority.

---

## 2. CURRENT-STATE ARCHITECTURE

### 2.1 Module wiring

```
SalesModule (backend/src/modules/sales/sales.module.ts)
├── imports: [CatalogModule, FinanceModule]
├── controllers: SalesController (/api/v1/sales), SalesCenterController (/api/v1/sales/center), CheckoutController (/api/v1/sales/checkouts)
├── providers: [SalesService]
└── exports: [SalesService]   ← consumed by ReverseModule (proposals.service)
```

- `SalesService` is exported for **Reverse owner orchestration**:
  `reverse/proposals.service.ts` calls
  `sales.createOpportunityFromBuyerRequestSelection(tx, input, actor)` inside a
  single transaction shared with Reverse's `SellerProposal` selection workflow.
- `SalesModule` imports `CatalogModule` (owner boundary `CatalogService.reserveAvailability`)
  and `FinanceModule` (read-only `CommissionPolicyService.resolve` at Quote ISSUE).
- No circular module dependency exists (ReverseModule → SalesModule → Catalog/Finance).

### 2.2 Controllers

| Controller | Base path | Routes | Guard |
|---|---|---|---|
| `SalesController` | `/api/v1/sales` | 30 | JwtAuthGuard + PermissionsGuard, per-route `sales.*` permission |
| `SalesCenterController` | `/api/v1/sales/center` | 2 | same |
| `CheckoutController` | `/api/v1/sales/checkouts` | 9 | same |

All controller routes are thin: DTO validation (class-validator) +
`assertNoForbiddenKeys` (server-owned field whitelist inversion) + direct
delegation to a `SalesService` method with an `Actor` derived from
`@CurrentUser()`. No business logic lives in controllers.

### 2.3 Already-extracted pure modules

The domain has already separated pure behavior into unit-tested modules:

| Module | Responsibility |
|---|---|
| `sales.money.ts` | Decimal money math (line/subtotal/discount/total), frozen-snapshot consistency gate |
| `sales.filters.ts` | list where-builders, sort, search, KPI range, queue registry |
| `sales.validation.ts` | status-transition assertions, forbidden-key whitelists |
| `sales.checkout.ts` | service-date parsing, availability classification, quote expiry |
| `sales.payment-terms.ts` | payment scheme → initial/remaining amount derivation |
| `sales.contracts.ts` | read-contract DTO types |

The residual structural debt is the **service orchestration layer** itself:
persistence + transaction boundaries + cross-domain calls + projections are all
concentrated in one class.

---

## 3. BASELINE METRICS (measured from HEAD `f688f57`)

| Metric | Value |
|---|---|
| File | `backend/src/modules/sales/sales.service.ts` |
| Total lines | 2,527 |
| Public methods | 41 (all async) |
| Private methods | 25 (11 async, 14 sync) |
| Total declared methods | 66 |
| Constructor dependencies | 6 (`prisma`, `ids`, `security`, `eventBus`, `catalog`, `commissionPolicies`) |
| Transaction roots (`this.prisma.$transaction`) | 22 |
| Cross-module in-tx method (`tx` param) | 1 (`createOpportunityFromBuyerRequestSelection`) |
| Top-level Prisma entity calls | 79 (`this.prisma.*`) |
| `this.security.audit` calls | 23 |
| `this.ids.nextCode` (BusinessSequence) | 6 |
| `this.eventBus` calls | 2 (`emit` in tx + `publishEvent` post-commit, both in `completeSale`) |
| `this.catalog` calls | 1 (`reserveAvailability`, in `completeSale` tx) |
| `this.commissionPolicies` calls | 1 (`resolve`, in `issueQuote` tx) |
| Raw SQL (`$queryRaw`/`$executeRaw`) | 0 |
| Decimal/money operations (`Prisma.Decimal`) | 43 |
| Event types emitted | 1 (`DomainEvents.OrderRequested`) |
| Export-only module functions | 1 (`mapCommissionChannelFromAcquisition`) |

Entity spread of `this.prisma.*` reads/writes: `quote` 21, `opportunity` 14,
`lead` 12, `sale` 11, `checkoutIntent` 11, `product` 3, plus one each of
`user`, `tariff`, `quoteItem`, `customer`, `commercialRestriction`,
`commercialPeriod`, `availability` (cross-domain read-by-ID per ADR-0001).

---

## 4. METHOD INVENTORY (complete — 41 public + 25 private)

### 4.1 Public methods (41, grouped by entity cluster)

**Lead (6):** `createLead`, `listLeads`, `getLeadByCode`, `transitionLead`,
`assignLead`, `leadHistory`

**Opportunity (7):** `createOpportunity`,
`createOpportunityFromBuyerRequestSelection` (in-tx, Reverse caller),
`listOpportunities`, `getOpportunityByCode`, `transitionOpportunity`,
`assignOpportunity`, `opportunityHistory`

**Quote (12):** `createQuote`, `listQuotes`, `getQuoteByCode`,
`getQuoteDetail`, `issueQuote`, `addQuoteItem`, `updateQuoteItem`,
`removeQuoteItem`, `setQuoteCustomer`, `setQuoteTravelers`,
`setQuoteCommercial`, `quoteHistory`

**Sale (5):** `createSale`, `listSales`, `getSaleByCode`, `completeSale`,
`saleHistory`

**CheckoutIntent (9):** `createCheckoutIntent`, `listCheckoutIntents`,
`getCheckoutIntentByCode`, `checkoutIntentHistory`, `setCheckoutTravelers`,
`setCheckoutServiceDate`, `revalidateCheckoutIntent`,
`cancelCheckoutIntent`, `setCheckoutPaymentTerms`

**Sales Center (2):** `centerKpi`, `centerQueue`

### 4.2 Private methods (25)

**Cross-domain existence guards (3):** `assertOptionalCustomer`,
`assertOptionalUser` (staff-only), `assertOptionalProduct`

**Shared read helpers (2):** `entityHistory`, `checkoutQuoteItems`

**Shared write helper (1):** `writeHistory` (in-tx, all 5 history tables)

**Projections / DTO mappers (8):** `toLeadDto`, `toOpportunityDto`,
`toQuoteDto`, `toQuoteDetailDto`, `toCheckoutIntentDto`,
`toCheckoutIntentDetailDto`, `toPaymentTermsDto`, `toSaleDto`

**Money guards (2):** `assertFixedDiscountWithinSubtotal`, `quoteTotals`

**Catalog pricing resolver (2):** `resolveEligibleTariff`,
`baseRestrictionFacts`

**Checkout guards (3):** `assertCheckoutMutable`, `assertCheckoutNotCompleted`,
`assertTravelersValid`

**Checkout read/model helpers (4):** `checkoutQuoteMeta`, `availabilityFor`,
`getCheckoutIntentDetail`, `pagination`

Plus 1 private field: `logger`.

Module-level (non-class): `mapCommissionChannelFromAcquisition` (exported),
`CHECKOUT_AVAILABILITY_SEMANTICS`, `aggregateAvailabilityLevel`,
`toStatusMap`.

**No method may disappear from this inventory during implementation.**

---

## 5. CALL GRAPH

```
SalesController / SalesCenterController / CheckoutController (30+9+2 routes)
        │  thin delegation (permission gates at controller layer)
        ▼
SalesService (facade / orchestrator — 41 public operations)
        │
        ├── internal helpers (pagination, history, projections, guards)
        ├── pure modules (money / filters / validation / checkout / payment-terms)
        ▼
PrismaService (Sales-owned tables: lead, opportunity, quote, quoteItem,
              quoteTraveler, sale, checkoutIntent, checkoutIntentTraveler,
              *History; cross-domain reads: customer, user, product, tariff,
              commercialPeriod, commercialRestriction, availability)
        │
        ├── IdsService.nextCode(tx)  — BusinessSequence codes LED/OPP/QTE/SAL/CKT
        ├── SecurityService.audit(tx) — AuditLog (23 sites)
        ├── CatalogService.reserveAvailability(tx) — owner boundary (completeSale)
        ├── CommissionPolicyService.resolve — read-only freeze (issueQuote)
        └── EventBusService.emit(tx) + publishEvent — outbox OrderRequested (completeSale)

Reverse (reverse/proposals.service.ts)
        │  selectBuyerRequestProposal: same tx
        ▼
SalesService.createOpportunityFromBuyerRequestSelection(tx, input, actor)
```

### 5.1 Structure findings

- **Orchestration roots:** 41 (each public method is an entry point; no internal
  public method is called by another public method except the shared
  `getQuoteDetail`/`getCheckoutIntentDetail` re-reads after writes).
- **Shared helpers:** `pagination`, `entityHistory`, `writeHistory`, the 8 DTO
  mappers, `assertOptional*` guards.
- **Cycles:** none. Dependency direction is acyclic.
- **Fan-in:** `completeSale` is the widest (Prisma + Catalog + EventBus +
  Security + Ids). `getQuoteDetail`/`getCheckoutIntentDetail` are re-entrant
  post-write reads (facade-level convenience, not a cycle).
- **Cross-domain calls:** `assertOptional*` (reads), `resolveEligibleTariff`
  (catalog reads), `availabilityFor` (catalog read), `reserveAvailability`
  (catalog write via owner service), `commissionPolicies.resolve` (finance
  read), `security.audit` (audit write), `ids.nextCode` (sequence).
- **Accidental utility responsibilities:** `pagination` (used by all list
  methods) and the DTO mappers — pure, no I/O, extractable to modules.

---

## 6. DATA-WRITER MATRIX

| Model / table | Sales reads | Sales writes | Other writers | Canonical authority | Risk |
|---|---|---|---|---|---|
| `sales.Lead` | yes | create, update (status/assign/version) | none | SalesService (sole writer) | — |
| `sales.LeadHistory` | yes | create | none | SalesService (sole writer) | — |
| `sales.Opportunity` | yes | create, update | none | SalesService (sole writer; Reverse calls Sales owner method in-tx) | — |
| `sales.OpportunityHistory` | yes | create | none | SalesService (sole writer) | — |
| `sales.Quote` | yes | create, update (status/items/travelers/commercial/version) | none | SalesService (sole writer) | — |
| `sales.QuoteItem` | yes | create, update (qty/amount), delete | none | SalesService (sole writer) | — |
| `sales.QuoteTraveler` | yes | delete-many + create (replace-all) | none | SalesService (sole writer) | — |
| `sales.QuoteHistory` | yes | create | none | SalesService (sole writer) | — |
| `sales.Sale` | yes | create, update (completion snapshot) | none | SalesService (sole writer) | — |
| `sales.SaleHistory` | yes | create | none | SalesService (sole writer) | — |
| `sales.CheckoutIntent` | yes | create, update (travelers/service-date/terms/cancel) | none | SalesService (sole writer) | — |
| `sales.CheckoutIntentTraveler` | yes | delete-many + create | none | SalesService (sole writer) | — |
| `sales.CheckoutIntentHistory` | yes | create | none | SalesService (sole writer) | — |
| `crm.Customer` | read-by-ID | no | CRM domain | CRM (cross-domain ref, ADR-0001) | read only |
| `security.User` | read-by-ID | no | Security | Security | read only |
| `catalog.Product` | read | no | Catalog | Catalog | read only |
| `catalog.Tariff` | read | no | Catalog | Catalog | read only |
| `catalog.CommercialPeriod` | read | no | Catalog | Catalog | read only |
| `catalog.CommercialRestriction` | read | no | Catalog | Catalog | read only |
| `catalog.Availability` | read | no | Catalog | Catalog | read only |
| `catalog.AvailabilityReservation` | no | **yes** (via `CatalogService.reserveAvailability` owner command) | Catalog/Order | **Catalog owner** (ADR-0001) | write happens through owner boundary, never direct |
| `security.AuditLog` | no | yes (via `SecurityService.audit`) | Security | Security | write via service boundary |
| `eventbus.OutboxEvent` | no | yes (via `EventBusService.emit`) | all domains | EventBus | write via service boundary |
| `BusinessSequence` (shared) | no | yes (via `IdsService.nextCode`) | all domains | Shared | atomic counter |

**Finding (OBSERVATION, not defect):** `SalesService` is the sole direct
writer of every `sales.*` table. The only cross-schema writes are via owner
service boundaries (Catalog reservation, Security audit, EventBus outbox),
which is exactly the sanctioned ADR-0001 pattern. **No duplicate/ambiguous
writer exists.** Decomposition must preserve this: a new collaborator writing
`sales.*` directly is allowed, but the "sole writer" invariant per table must
remain (one collaborator owns each write path).

---

## 7. TRANSACTION BOUNDARY MAP (22 roots)

| Operation | Transaction boundary | Atomic invariants | Post-commit work | Refactor constraint |
|---|---|---|---|---|
| `createLead` | one tx | code alloc + lead row + history + audit | logger only | must stay single tx |
| `transitionLead` | one tx (CAS) | status CAS + version inc + history + audit | none | CAS must not split |
| `createOpportunity` | one tx | code + row + history + audit | none | — |
| `createOpportunityFromBuyerRequestSelection` | **external tx** (Reverse's) | customer check + code + row + history + audit in caller tx | none | must keep `tx` param signature (Reverse owner boundary) |
| `transitionOpportunity` | one tx (CAS) | CAS + version + history + audit | none | — |
| `createQuote` | one tx | code + row + history + audit | none | acquisition-source read happens **before** tx (read-only) |
| `issueQuote` | one tx (CAS) | re-read + transition assert + items validate + totals (Decimal) + commission freeze + CAS update + history + audit | none (returns `getQuoteDetail` re-read) | **money freeze + commission resolution must stay atomic with CAS** |
| `addQuoteItem` | one tx (CAS) | version CAS + currency check + item create + history + audit | `getQuoteDetail` re-read | tariff resolution happens **before** tx (read-only) |
| `updateQuoteItem` | one tx (CAS) | CAS + item find + FIXED guard + update + history + audit | re-read | — |
| `removeQuoteItem` | one tx (CAS) | CAS + item find + FIXED guard + delete + history + audit | re-read | — |
| `setQuoteCustomer` | one tx (CAS) | CAS + update + history + audit | re-read | — |
| `setQuoteTravelers` | one tx (CAS) | CAS + delete-many + create-many + history + audit | re-read | — |
| `setQuoteCommercial` | one tx (CAS) | FIXED guard **pre-tx** + CAS + update + history + audit | re-read | guard is pre-tx on `this.prisma` |
| `createSale` | one tx | code + row + P2002→409 handling + history + audit | none | unique (checkoutIntentId/quoteId) conflict mapping must stay |
| `completeSale` | one tx | sale CAS + checkout checks (pre-tx reads) + **catalog reserve (in-tx)** + **outbox emit (in-tx)** + sale snapshot update + history + audit | **`eventBus.publishEvent` (delivery after commit, NOT rolled back)** | **must remain one atomic tx; reservation + outbox + snapshot are inseparable** |
| `createCheckoutIntent` | one tx | code + row + travelers + history + audit | `getCheckoutIntentDetail` re-read | snapshot validation (`validateFrozenSnapshot`) happens **pre-tx** |
| `setCheckoutTravelers` | one tx (CAS) | CAS + delete/create travelers + history + audit | re-read | — |
| `setCheckoutServiceDate` | one tx (CAS) | parse + temporal checks (pre-tx) + CAS + history + audit | re-read | — |
| `revalidateCheckoutIntent` | one tx (CAS, no version inc) | CAS-with-empty-data (row lock) + history + audit | re-read | read-like CAS semantics must be preserved exactly |
| `cancelCheckoutIntent` | one tx (CAS) | status guard + CAS + history + audit | re-read | — |
| `setCheckoutPaymentTerms` | one tx (CAS) | compute (pre-tx, pure) + CAS + history + audit | re-read | — |
| `assignLead` | one tx (CAS) | user check (pre-tx) + CAS + history + audit | none | — |
| `assignOpportunity` | one tx (CAS) | user check (pre-tx) + CAS + history + audit | none | — |

**Critical constraint:** `completeSale` is the only operation that combines a
Sales write + cross-domain write (`catalog.reserveAvailability`) + outbox
event in **one** PostgreSQL transaction, then performs delivery **after**
commit. The decomposition must never split this sequence — the reservation and
the outbox row must commit atomically with the Sale snapshot (G4 invariant).

---

## 8. EVENT / OUTBOX MAP

| Event | Producer | Payload/version | Correlation | Tx relationship | Consumers | Retry/idempotency | Sales role |
|---|---|---|---|---|---|---|---|
| `OrderRequested` | `SalesService.completeSale` | `OrderRequestedPayload` v1 (saleId, saleCode, checkoutId/code, quoteId, customerId, reservationId(s), items[] with frozen productType, frozen commercial snapshot, service temporal facts, sellerPartnerId) | inherited from request context (correlationId/causationId) | written to outbox **inside** the completion tx (`eventBus.emit(tx, { retryable: true })`); delivered after commit via `eventBus.publishEvent(eventId)` | Order domain (`order-creation-consumer`) | at-least-once; durable retry (`retryable: true`); Inbox dedup authoritative | **authoritative producer** |

- Only **one** event type is emitted from the entire Sales domain.
- The payload is self-sufficient (frozen snapshots + productType), so consumers
  do not re-read mutable Catalog state (STRICT REVIEW 2.5 fix).
- **Decomposition default = same event topology.** No new events, no payload
  changes, no producer changes, no publication-site changes.

---

## 9. MONEY AUTHORITY MAP

| Money fact | Where computed | Frozen at | Authority |
|---|---|---|---|
| Quote line amount (unitPrice × qty) | `sales.money.lineAmount` (pure) | item create (`addQuoteItem`) | Sales commercial calculation |
| Quote subtotal / discountAmount / total | `sales.money` + `quoteTotals` (pure) | Quote ISSUE (`issueQuote`) | Sales commercial calculation |
| Quote discount validation (PERCENTAGE/FIXED bounds) | `sales.money.validateDiscountValue` | write-time + ISSUE | Sales commercial calculation |
| FIXED ≤ subtotal guard | `assertFixedDiscountWithinSubtotal` (service) + `discountAmountOf` (pure) | pre-write (422) + ISSUE | Sales commercial calculation |
| Frozen snapshot consistency | `sales.money.validateFrozenSnapshot` (pure) | `createCheckoutIntent` (binding gate) | Sales commercial calculation |
| Payment terms (initial/remaining) | `sales.payment-terms.computePaymentTerms` (pure, from frozen Checkout total) | `setCheckoutPaymentTerms` | Sales commercial calculation |
| Commission snapshot (policyCode/rate/baseAmount/channel/sellerPartnerId) | `issueQuote` via `commissionPolicies.resolve` (READ-only cross-domain) + `mapCommissionChannelFromAcquisition` | Quote ISSUE; verbatim Checkout → Sale → Order | **Commission authority = Finance** (Sales only freezes the selection) |
| Sale commercial snapshot | `completeSale` (verbatim from Checkout) | Sale completion | Sales commercial calculation (frozen facts) |
| Payment amounts / PSP | — | — | **Payment authority = PaymentService** (not touched by Sales) |
| Ledger/accounting | — | — | Finance (not touched by Sales) |
| ProviderFee | — | — | Future PSP boundary (not in Sales) |

**Constraint:** no proposed Sales collaborator may become a second money
authority. `sales.money.ts` remains the single calculation authority; frozen
snapshots remain immutable; Commission/Payment/Ledger authorities stay
external.

---

## 10. STATUS / STATE-MACHINE MAP

| Entity | Transitions (validated in `sales.validation.ts`) | Initiating op | Guard | Writer | Event |
|---|---|---|---|---|---|
| Lead | NEW → QUALIFIED \| DISQUALIFIED (terminals) | `transitionLead` | `assertLeadTransition` | Sales | none |
| Opportunity | NEW → OPEN → WON \| LOST (terminals) | `transitionOpportunity` | `assertOpportunityTransition` | Sales | none |
| Quote | DRAFT → ISSUED (terminal) | `issueQuote` | `assertQuoteTransition` + composable guard | Sales | none (commission snapshot frozen here) |
| Quote composition | only DRAFT mutable | `addQuoteItem`/`updateQuoteItem`/`removeQuoteItem`/`setQuoteCustomer`/`setQuoteTravelers`/`setQuoteCommercial` | `assertQuoteComposable` | Sales | none |
| Sale | OPEN → CLOSED (via `completeSale` CAS only; no generic PATCH) | `completeSale` | status OPEN + expectedVersion CAS + checkout prerequisites | Sales | OrderRequested |
| CheckoutIntent | ACTIVE → CANCELLED (terminal); ACTIVE-only mutations; immutable after Sale completion | `cancelCheckoutIntent` / mutations | `assertCheckoutMutable` + `assertCheckoutNotCompleted` | Sales | none |

**No status redesign in this pass.** Decomposition preserves transition
assertions verbatim (they already live in the pure `sales.validation.ts`
module).

---

## 11. AUTHORIZATION / OWNERSHIP MAP

- **Layer 1 (controller):** `JwtAuthGuard` + `PermissionsGuard` + per-route
  `@RequirePermissions("sales.*")` (e.g. `sales.lead.read`, `sales.sale.complete`).
  Aggregate-only roles (ANALYST/MARKETER with `sales.kpi.read`) get KPI but not
  raw queues (permission resolved by queue key in `SalesCenterController`).
- **Layer 2 (service):** no per-row ownership predicate exists — Sales is an
  internal staff context; authorization is permission-gated at the controller
  and the `Actor` is passed as a plain `{ id, username }` (used for
  `createdById`, history actor, audit). `assertOptionalUser` additionally
  rejects BUYER/PARTNER as assignees (internal staff only) — an ownership-
  adjacent guard that must not move after a write.
- **Layered contract to preserve:** controller decides *who may call*;
  service records *who acted* and validates *business references*
  (customer/user/product existence by ID, ADR-0001). Decomposition must not
  move any check after a write or weaken ordering.

---

## 12. IDEMPOTENCY / CONCURRENCY MAP

| Mechanism | Where | Preserve |
|---|---|---|
| Optimistic CAS (`updateMany where { id, version }`, `version { increment: 1 }`) | all 22 write roots | exact — concurrent duplicate transition/write → 409, never double-apply |
| `expectedVersion` param (Checkout commands) | checkout mutations + `completeSale` | exact client contract |
| Unique constraints (Sale.checkoutIntentId, Sale.quoteId, Opportunity.proposalId) | `createSale` P2002→409 mapping; Reverse proposal conversion | controlled 409, never raw 500 |
| Read-like CAS (`updateMany` empty data) | `revalidateCheckoutIntent` | row-lock without version increment — must be preserved exactly |
| Sequence allocation | `ids.nextCode(tx)` BusinessSequence (Hi/Lo block allocation, Step 2.17B remediation) | atomic in-tx code alloc |
| Event idempotency | outbox `retryable` + Inbox dedup (consumer side) | at-least-once; no delivery semantics change |
| External API idempotency (`Idempotency-Key`) | Payment domain (not Sales) | Sales does not introduce new touchpoints; completeSale stays CAS-based |

**Constraint:** do not introduce "cleaner" semantics without evidence. The CAS
pattern is uniform and proven by e2e; it moves with the write path verbatim.

---

## 13. FREEZE / SNAPSHOT / CAUSATION MAP

| Frozen fact | When | By whom | Mutable source no longer consulted after freeze |
|---|---|---|---|
| QuoteItem commercial snapshot (product/tariff code/title, unitPrice, currency, amount, serviceDate, restrictionSnapshot) | `addQuoteItem` | Sales | Catalog tariff/period/restriction pricing (no reprice after ISSUE) |
| Quote ISSUE totals (subtotal/discountAmount/total/issuedAt/validUntil/commissionSnapshot) | `issueQuote` | Sales | live Commission policy resolution (snapshot only, D6/D7) |
| CheckoutIntent frozen commercial snapshot (currency/subtotal/discount/total/commissionSnapshot) + serviceTimeZone | `createCheckoutIntent` | Sales | Catalog price + IANA zone (verbatim copy; no re-resolution) |
| Sale commercial snapshot + temporal facts + commission | `completeSale` | Sales | CheckoutIntent (verbatim; immutable after completion) |
| OrderRequested payload | `completeSale` (in-tx) | Sales | all frozen facts above; consumers read payload, not mutable state |
| Availability state | `revalidateCheckoutIntent`/detail (read-only "checked, not reserved") | Sales | never authoritative capacity; reservation is the write path |

**Causation:** OrderRequested carries correlationId (inherited request
context) and causationId (source event when consumed); the payload is
self-sufficient. No freeze semantics change in decomposition.

---

## 14. ERROR CONTRACT MAP

| Error | Origin | Propagation | Constraint |
|---|---|---|---|
| 400 | DTO validation (class-validator, controllers) | controller layer | unchanged |
| 422 | `ValidationDomainError` (service guards, money, status, temporal, composition) | thrown by service; mapped by global exception filter | extracted collaborator must keep throwing the same domain error type |
| 401 | JwtAuthGuard | controller | unchanged |
| 403 | PermissionsGuard | controller | unchanged |
| 404 | `NotFoundError` (code/id lookups) | service | unchanged |
| 409 | `ConflictError` (CAS stale, P2002 unique, already-completed) | service | unchanged |
| 500 | unexpected (no raw SQL, no unguarded Prisma error paths) | global filter | decomposition must not convert controlled errors to 500s |

All service errors use the shared `ValidationDomainError` / `NotFoundError` /
`ConflictError` types from `src/shared/errors.ts`; `uniqueConstraintNames`
maps Prisma P2002. **An extracted collaborator keeps the exact same error
types and message texts.**

---

## 15. DEPENDENCY CLASSIFICATION (constructor)

| Dependency | Class | Should orchestration retain? | Should a collaborator own it? | Circular risk | Authority duplication risk |
|---|---|---|---|---|---|
| `PrismaService` | Sales-owned persistence | yes (facade keeps delegation) | yes — each collaborator needs persistence for its write paths | none (leaf) | none — per-table writers stay unique |
| `IdsService` | infrastructure (sequence) | retained by facade OR collaborators; single shared service | either, but must remain a single injected instance | none | none |
| `SecurityService` | cross-domain audit boundary | retained (audit in every write path) | shared via facade injection | none | none (write via service boundary) |
| `EventBusService` | eventing | retained | only `completeSale` path (SalesCompletion) | none | none |
| `CatalogService` | cross-domain authority (reservation) | retained | only `completeSale` path | none | none (owner boundary) |
| `CommissionPolicyService` | policy/read dependency (freeze) | retained | only `issueQuote` path (Quote lifecycle) | none | none (read-only) |

**No circular dependency is created by any proposed split.** All collaborators
depend on Prisma + shared services (leaf dependencies), never on each other.

---

## 16. DECOMPOSITION PRINCIPLES (applied)

1. **Thin orchestration, not thin semantics** — the facade keeps orchestration;
   collaborators hold real behavior; pure modules hold math/validation.
2. **One explicit owner per responsibility** — per §17 ownership matrix.
3. **No circular dependency graph** — verified in §15.
4. **No duplicate writers** — per-table writer stays unique (§6).
5. **Cross-domain authorities remain external** — Catalog/Finance/Security/
   EventBus accessed only through their owner services.
6. **Transactions remain explicit** — every tx root preserved verbatim (§7).
7. **Domain event topology stable** — same event, same payload, same site (§8).
8. **Helpers not extracted merely for line count** — every proposed module has
   a real single responsibility (projection, history, pricing resolution).
9. **Read/query vs write/orchestration separation** — reads move first (Wave 1/2).
10. **Naming describes responsibility** — `SalesQueryService`, `SalesQuoteService`,
    etc.
11. **Future unit-test seams improve** — pure modules are already unit-tested;
    collaborators enable service-level unit tests without e2e behavior change.
12. **Final facade retained** — Option A (see §19), minimizes API/caller churn
    and preserves the Reverse in-tx contract.

---

## 17. CANDIDATE ARCHITECTURE — ACCEPTED / REJECTED

### Accepted collaborators

| Candidate | Responsibility (from evidence) | Methods | Why accepted |
|---|---|---|---|
| **`SalesQueryService`** | all read-only projections, lists, details, history reads, center read models | `listLeads/Opportunities/Quotes/Sales/CheckoutIntents`, `getLeadByCode`, `getOpportunityByCode`, `getQuoteByCode`, `getQuoteDetail`, `getSaleByCode`, `getCheckoutIntentByCode`, `*History` (5), `centerKpi`, `centerQueue` + `pagination`, `entityHistory` | pure reads; no transaction roots; zero behavior risk; provides the unit-test seam |
| **`SalesLifecycleService`** | Lead/Opportunity/Quote/Sale foundation create + transitions + assign | `createLead`, `transitionLead`, `assignLead`, `createOpportunity`, `transitionOpportunity`, `assignOpportunity`, `createQuote`, `createSale`, `createOpportunityFromBuyerRequestSelection` (in-tx, Reverse boundary) | non-money writes; uniform CAS+history+audit pattern; the in-tx Reverse method must keep its exact signature |
| **`SalesQuoteService`** | Quote composition + ISSUE (money-sensitive) | `issueQuote`, `addQuoteItem`, `updateQuoteItem`, `removeQuoteItem`, `setQuoteCustomer`, `setQuoteTravelers`, `setQuoteCommercial` + `quoteTotals`, `assertFixedDiscountWithinSubtotal`, `resolveEligibleTariff`, `baseRestrictionFacts` | highest money/freeze concentration; single owner of Quote commercial state |
| **`SalesCheckoutService`** | CheckoutIntent lifecycle + availability + payment terms | `createCheckoutIntent`, `setCheckoutTravelers`, `setCheckoutServiceDate`, `revalidateCheckoutIntent`, `cancelCheckoutIntent`, `setCheckoutPaymentTerms`, `getCheckoutIntentDetail` + `assertCheckoutMutable`, `assertCheckoutNotCompleted`, `assertTravelersValid`, `checkoutQuoteMeta`, `checkoutQuoteItems`, `availabilityFor` | distinct frozen-snapshot state machine (ACTIVE/CANCELLED) with CAS-by-`expectedVersion`; separate from Quote |
| **`SalesCompletionService`** | `completeSale` (single most complex operation) | `completeSale` + `toSaleDto` projection usage | the only operation combining Sales write + Catalog reservation + outbox emit in one tx + post-commit delivery; a dedicated bounded home preserves the G4 atomic boundary |

### Accepted pure modules (new, module-level — not classes)

| Module | Methods moved from service | Why |
|---|---|---|
| **`sales.projection.ts`** | `toLeadDto`, `toOpportunityDto`, `toQuoteDto`, `toQuoteDetailDto`, `toCheckoutIntentDto`, `toCheckoutIntentDetailDto`, `toPaymentTermsDto`, `toSaleDto`, `checkoutQuoteMeta` | 8 large pure mappers (~500 lines incl. inline row types); pure functions of rows + meta; trivially unit-testable; used by every collaborator |
| **`sales.history.ts`** | `writeHistory`, `entityHistory` | single writer/reader of all 5 `*History` tables; uniform in-tx helper; used by every write path |

### Rejected / merged / deferred

| Candidate | Disposition | Why |
|---|---|---|
| `SalesPricingSnapshotService` | **REJECTED** | snapshot semantics already live in pure `sales.money.ts` (`validateFrozenSnapshot`); a service adds indirection, not ownership |
| `SalesOwnershipService` | **REJECTED** | no per-row ownership predicates exist in the service; authorization is controller-permission-based (documented §11). Extracting a service would invent behavior |
| `SalesSequenceService` | **REJECTED** | `IdsService` is shared platform infrastructure, not Sales-owned debt; wrapping it duplicates authority |
| `SalesEventService` | **REJECTED** | only one event in the domain, produced at one site (`completeSale`); a wrapper service adds a layer without splitting responsibility. Eventing stays inside `SalesCompletionService` |
| `SalesHistoryService` | **MERGED** | history is a thin uniform helper; module-level `sales.history.ts` (like `sales.filters.ts`) is the right granularity — a service class would be micro-explosion |
| `SalesCommissionService` | **DEFERRED** | commission selection/freeze is already contained (`issueQuote` + pure `mapCommissionChannelFromAcquisition`); extracting it is possible later but not needed for this decomposition and would touch ADR-0013 freeze semantics unnecessarily |

**Micro-service-class explosion avoided:** 4 collaborator services + 2 pure
modules, from 66 methods with clear single-owner clusters.

---

## 18. FACADE DECISION — OPTION A (STABLE FACADE) — ACCEPTED

`SalesService` **remains** as the stable facade that controllers and the
Reverse module already depend on. Internals delegate to the four collaborators.

Evidence:
1. **Reverse contract:** `reverse/proposals.service.ts` calls
   `sales.createOpportunityFromBuyerRequestSelection(tx, ...)` inside a shared
   transaction; `SalesService` is exported from `SalesModule`. Option A keeps
   this boundary byte-identical.
2. **Controller churn:** all 41 routes + 3 controllers delegate to
   `SalesService`; Option A means zero controller/DTO/route changes.
3. **Risk minimization:** Option B (direct collaborator injection) rewires 41
   call sites and the module graph for no behavioral gain; the prompt prefers
   the option that minimizes behavioral/API risk.

Facade form: thin delegation with exact same signatures; facade may retain the
small number of shared helpers it needs (or delegate to `sales.projection.ts` /
`sales.history.ts` modules). `@Injectable()` stays; `exports: [SalesService]`
stays.

---

## 19. DEPENDENCY-DIRECTION DIAGRAM

```
SalesController / SalesCenterController / CheckoutController
        │  (permission gates, DTO validation — unchanged)
        ▼
SalesService (facade — Option A; delegates; keeps exported in-tx Reverse method)
   /      |        |        \
  v       v        v         v
Query   Lifecycle Quote    Checkout
  |        |        |         |
  |        +── in-tx Reverse ─┘
  |        |
  v        v
SalesCompletionService
  |        |
  v        v
Prisma / CatalogService / EventBusService / SecurityService / IdsService /
CommissionPolicyService (read-only at Quote ISSUE)
  ▲
  │ (pure modules, leaf)
sales.money / sales.filters / sales.validation / sales.checkout /
sales.payment-terms / sales.projection (new) / sales.history (new)
```

- Direction is strictly top-down; no cycle.
- All collaborators depend only on: `PrismaService`, shared services
  (`IdsService`, `SecurityService`, `EventBusService`, `CatalogService`,
  `CommissionPolicyService` as needed per cluster), and pure modules.
- Collaborators do **not** depend on each other (the facade owns
  orchestration); `SalesCompletionService` is only reachable via the facade
  from the controllers (and never from other collaborators).

---

## 20. PROPOSED OWNERSHIP MATRIX

| Responsibility | Current owner | Proposed owner | Authority change? | Transaction impact | Risk |
|---|---|---|---|---|---|
| Lead create/transition/assign/list/get/history | SalesService | Lifecycle (writes) / Query (reads) | NO | none | LOW |
| Opportunity CRUD + in-tx Reverse conversion | SalesService | Lifecycle | NO | none (tx param preserved) | LOW |
| Quote foundation create | SalesService | Lifecycle | NO | none | LOW |
| Quote composition (items/travelers/customer/commercial) | SalesService | Quote | NO | none (CAS kept) | MEDIUM |
| Quote ISSUE (totals freeze + commission) | SalesService | Quote | NO | none (money freeze kept atomic) | HIGH |
| Quote pricing resolution (tariff/period/restriction) | SalesService | Quote (private) | NO | read-only, pre-tx | MEDIUM |
| Sale create | SalesService | Lifecycle | NO | none (P2002→409 kept) | LOW |
| Sale completion (snapshot + reservation + outbox) | SalesService | Completion | NO | none (single tx + post-commit delivery kept) | HIGH |
| CheckoutIntent create/mutate/revalidate/cancel/terms | SalesService | Checkout | NO | none (CAS by expectedVersion kept) | MEDIUM |
| Availability read model | SalesService | Checkout | NO | read-only | LOW |
| Lists/get/details/history reads | SalesService | Query | NO | none (read-only) | LOW |
| KPI / queues | SalesService | Query | NO | none | LOW |
| History write/read | SalesService | `sales.history.ts` | NO | none (in-tx helper) | LOW |
| DTO projections | SalesService | `sales.projection.ts` | NO | none | LOW |
| Money math / snapshot gate | `sales.money.ts` | unchanged | NO | none | — |
| Status transitions | `sales.validation.ts` | unchanged | NO | none | — |
| Sequence codes | IdsService | unchanged | NO | none | — |
| Audit | SecurityService | unchanged | NO | none | — |
| Catalog reservation | CatalogService | unchanged | NO | none | — |
| Commission freeze | Finance (read) | unchanged | NO | none | — |
| OrderRequested event | EventBus | unchanged | NO | none | — |

**Every responsibility identified in the baseline appears. `Authority changes?`
= NO for all rows.** No proposed authority change blocks implementation.

---

## 21. METHOD-MOVE PLAN (complete, deterministic)

| Method | Proposed destination | Keep signature? | Caller changes? | Transaction sensitivity | Test coverage |
|---|---|---|---|---|---|
| `createLead` | Lifecycle | YES | NO | tx root | e2e sales-domain-foundation |
| `listLeads` | Query | YES | NO | none (read) | e2e sales-center/foundation |
| `getLeadByCode` | Query | YES | NO | none | e2e |
| `transitionLead` | Lifecycle | YES | NO | tx + CAS | e2e |
| `assignLead` | Lifecycle | YES | NO | tx + CAS | e2e |
| `leadHistory` | Query | YES | NO | none | e2e |
| `createOpportunity` | Lifecycle | YES | NO | tx | e2e |
| `createOpportunityFromBuyerRequestSelection` | Lifecycle | **YES (tx param)** | NO (Reverse unchanged) | external tx | e2e reverse-conversion |
| `listOpportunities` | Query | YES | NO | none | e2e |
| `getOpportunityByCode` | Query | YES | NO | none | e2e |
| `transitionOpportunity` | Lifecycle | YES | NO | tx + CAS | e2e |
| `assignOpportunity` | Lifecycle | YES | NO | tx + CAS | e2e |
| `opportunityHistory` | Query | YES | NO | none | e2e |
| `createQuote` | Lifecycle | YES | NO | tx | e2e |
| `listQuotes` | Query | YES | NO | none | e2e |
| `getQuoteByCode` | Query | YES | NO | none | e2e |
| `getQuoteDetail` | Query | YES | NO | none (re-read) | e2e quote-commercial-offer |
| `issueQuote` | Quote | YES | NO | tx + money freeze | e2e quote/pricing-snapshot |
| `addQuoteItem` | Quote | YES | NO | tx + CAS | e2e quote/period-pricing/restriction |
| `updateQuoteItem` | Quote | YES | NO | tx + CAS | e2e |
| `removeQuoteItem` | Quote | YES | NO | tx + CAS | e2e |
| `setQuoteCustomer` | Quote | YES | NO | tx + CAS | e2e |
| `setQuoteTravelers` | Quote | YES | NO | tx + CAS | e2e |
| `setQuoteCommercial` | Quote | YES | NO | tx + CAS | e2e |
| `quoteHistory` | Query | YES | NO | none | e2e |
| `createSale` | Lifecycle | YES | NO | tx + P2002→409 | e2e |
| `listSales` | Query | YES | NO | none | e2e |
| `getSaleByCode` | Query | YES | NO | none | e2e |
| `completeSale` | Completion | YES | NO | **tx + reservation + outbox + post-commit delivery** | e2e sale-completion/order/booking |
| `saleHistory` | Query | YES | NO | none | e2e |
| `createCheckoutIntent` | Checkout | YES | NO | tx + snapshot gate | e2e checkout-commercial-intent |
| `listCheckoutIntents` | Query | YES | NO | none | e2e |
| `getCheckoutIntentByCode` | Query (delegates to Checkout `getCheckoutIntentDetail`) | YES | NO | none | e2e |
| `checkoutIntentHistory` | Query | YES | NO | none | e2e |
| `setCheckoutTravelers` | Checkout | YES | NO | tx + CAS | e2e |
| `setCheckoutServiceDate` | Checkout | YES | NO | tx + CAS | e2e |
| `revalidateCheckoutIntent` | Checkout | YES | NO | tx + read-like CAS | e2e |
| `cancelCheckoutIntent` | Checkout | YES | NO | tx + CAS | e2e |
| `setCheckoutPaymentTerms` | Checkout | YES | NO | tx + CAS | e2e payment-terms |
| `centerKpi` | Query | YES | NO | none | e2e sales-center |
| `centerQueue` | Query | YES | NO | none | e2e sales-center |
| `pagination` | Query (module fn or private) | YES | internal | none | unit (indirect) |
| `entityHistory` | `sales.history.ts` | YES | internal | none | e2e |
| `writeHistory` | `sales.history.ts` | YES | internal | in-tx | e2e |
| `toLeadDto` … `toSaleDto` (8) | `sales.projection.ts` | YES | internal | none | unit (new) |
| `assertFixedDiscountWithinSubtotal` | Quote | YES | internal | pre-write guard | e2e + money unit |
| `quoteTotals` | Quote (or money module) | YES | internal | none (pure) | unit |
| `resolveEligibleTariff` / `baseRestrictionFacts` | Quote | YES | internal | read-only pre-tx | e2e period-pricing/restriction |
| `assertOptionalCustomer/User/Product` | shared (facade or small `sales.refs.ts`) | YES | internal | none | e2e |
| `assertCheckoutMutable/NotCompleted` | Checkout | YES | internal | none | e2e |
| `assertTravelersValid` | Checkout | YES | internal | none | e2e |
| `checkoutQuoteMeta` | `sales.projection.ts` | YES | internal | none | e2e |
| `checkoutQuoteItems` / `availabilityFor` / `getCheckoutIntentDetail` | Checkout | YES | internal | none | e2e |

**Every method has a destination: remain in facade (delegation), move to a
collaborator, or move to a pure module.** No method is deleted; no method is
merged into another behavior. (No dead code exists to delete — all 41 public
methods are reachable from controllers or Reverse.)

---

## 22. IMPLEMENTATION WAVES (each independently buildable/testable/revertible)

### Wave 0 — characterization (before any move)
- Add focused unit tests for the 8 DTO projections (`sales.projection.spec.ts`)
  with golden fixtures from current e2e-verified contracts (byte-identical
  output assertions) — pins mappers before extraction.
- Add service-level characterization tests for the two transaction-sensitive
  paths where unit coverage is absent: `issueQuote` (freeze/commission) and
  `completeSale` (CAS + reservation + outbox + post-commit delivery), using a
  mocked Prisma/Catalog/EventBus seam. These become the regression anchor for
  Waves 4–5.
- **Result:** behavior is pinned by tests, not by re-reading code.

### Wave 1 — pure module extraction (zero-risk)
- Extract `sales.projection.ts` (8 mappers + `checkoutQuoteMeta`) and
  `sales.history.ts` (`writeHistory` + `entityHistory`) as module functions.
- Service imports them; no behavior change; full regression (unit + e2e).

### Wave 2 — `SalesQueryService` (read-only extraction)
- New injectable service with `prisma` (+ shared modules); move all list/get/
  detail/history/center read methods + `pagination`.
- Facade delegates read methods to it. No transaction touched. Full regression.

### Wave 3 — non-transactional orchestration extraction
- `SalesLifecycleService`: `createLead`, `createOpportunity`, `createQuote`,
  `createSale` (foundation creates) and transitions/assigns.
- **Keep `createOpportunityFromBuyerRequestSelection(tx, ...)` on the facade
  (or delegate to Lifecycle with the exact tx param)** — Reverse callers
  unchanged; the external-tx boundary is the highest-risk signature.
- Facade delegates. Full regression.

### Wave 4 — transaction-sensitive write paths (one responsibility at a time)
- `SalesQuoteService`: composition commands (items/travelers/customer/
  commercial), then `issueQuote` last (money freeze + commission).
- `SalesCheckoutService`: checkout mutations, then `createCheckoutIntent`
  (frozen snapshot gate), then `revalidateCheckoutIntent` (read-like CAS).
- Each sub-wave: move method + its private helpers + delegation; full
  regression; revert = restore delegation line.

### Wave 5 — `SalesCompletionService` (event/idempotency-sensitive)
- `completeSale` moves last, after Wave 0 characterization evidence is green.
- Preserve: single tx ordering (CAS → checks → snapshot → reserve → emit →
  history/audit) and post-commit `publishEvent` (delivery failure must NOT
  roll back the commit).
- Full regression + targeted `sale-completion-order-requested` e2e.

### Wave 6 — cleanup
- Facade becomes pure delegation (all 41 methods delegate; shared refs
  (`assertOptional*`) live in a small shared helper or each collaborator).
- Remove facade-only helpers only after full-repo search confirms no other
  caller; `git diff --check` clean.

---

## 23. CHARACTERIZATION TEST GAP ANALYSIS

| Operation | Unit | E2E | RBAC | Tx rollback | Concurrency | Events | Money/freeze | Gap |
|---|---|---|---|---|---|---|---|---|
| Lead create/transition/assign | ✗ | ✓ (sales-domain-foundation, rbac) | ✓ (rbac-actions) | ✓ (validation-fail e2e) | ✓ (CAS 409 e2e) | n/a | n/a | unit-level none |
| Opportunity create/transition | ✗ | ✓ (foundation, reverse-conversion) | ✓ | ✓ | ✓ (CAS) | n/a | n/a | unit-level none |
| Quote create/list/get | ✗ | ✓ (quote-commercial-offer) | ✓ | ✓ | — | n/a | ✓ (quote DTO) | unit-level none |
| Quote composition (items/travelers/customer/commercial) | ✗ | ✓ (quote 18 tests, period-pricing 31, restriction 21, rate-plan 36) | ✓ | ✓ (FIXED guard 422) | ✓ (CAS) | n/a | ✓ (money spec) | **FIXED-guard pre-tx ordering not unit-pinned** |
| `issueQuote` | ✗ | ✓ (quote 18, pricing-snapshot 8, acquisition-source 13) | ✓ | ✓ (mixed currency/empty 422) | ✓ (repeat ISSUE 422) | ✓ (commission snapshot e2e) | ✓ (money spec + snapshot gate) | **commission freeze + Decimal totals unit-pinned: GAP → Wave 0** |
| `completeSale` | ✗ | ✓ (sale-completion-order-requested 32, order/booking consumers) | ✓ | ✓ (prereq 422) | ✓ (CAS 409, double-complete) | ✓ (OrderRequested outbox + retry e2e) | ✓ (snapshot e2e) | **single-tx atomicity + post-commit delivery unit-pinned: GAP → Wave 0** |
| CheckoutIntent lifecycle | ✗ | ✓ (checkout 16, payment-terms 20, booking-temporal) | ✓ | ✓ | ✓ (expectedVersion CAS) | n/a | ✓ (payment-terms spec) | unit-level none |
| Center KPI/queues | ✗ | ✓ (sales-center 12) | ✓ (queue-key permission) | n/a | — | n/a | n/a | unit-level none |

**Verdict:** critical behavior is **strongly pinned at the API/e2e level**
(1194 serial e2e green at baseline, incl. 10 sales-focused specs and ~25
specs exercising sales endpoints: acquisition-source, booking-lifecycle,
checkout, commercial-restriction, external-idempotency, order-creation,
order-lifecycle, payment-terms, period-pricing, pricing-financial-snapshot,
quote-commercial-offer, rate-plan, reverse-conversion, sale-completion).
The only meaningful gaps are **unit-level** characterization of the two
transaction-sensitive paths (`issueQuote`, `completeSale`) and the DTO
projections — addressed by Wave 0 **before** any extraction. No gap blocks the
design; implementation starts with characterization tests.

---

## 24. REGRESSION CONTRACT (per implementation wave)

After **every** wave, run (actual repository commands):

```bash
cd backend
npm run typecheck            # backend tsc
npm run build                # backend build
npm test                     # unit (incl. new sales.projection/history specs)
npm run test:e2e             # full serial backend e2e (1194 tests, 69 suites)
npx prisma migrate status    # 58/58 up to date
npx prisma migrate diff --from-config-datasource --to-schema   # drift = 0
cd ../frontend && npx tsc --noEmit && npm run build            # if public contracts touched (they are not)
cd .. && node scripts/check-roadmap-artifacts.mjs              # artifact integrity
git diff --check
```

Schema/migrations are untouched by design — drift must remain 0 in every wave.
Public API surface is untouched by design — frontend is unaffected (no
frontend consumer of `/api/v1/sales*` exists).

---

## 25. PERFORMANCE CONTRACT

- Step 2.17C is **not** a performance remediation step; no tuning, no query
  changes, no index changes, no frozen Step 2.17B target changes.
- Hot paths affected by decomposition: `completeSale` (reservation + outbox
  write) and `issueQuote` (commission resolution + freeze). Query counts and
  transaction shapes are preserved verbatim per method-move plan; only the
  class boundary moves.
- No performance improvement is claimed; no measurement is required for this
  design pass.
- Step 2.17B remains **BLOCKED — FINAL QUALIFICATION ENVIRONMENT REQUIRED —
  NOT APPROVED** and is not reopened here.

---

## 26. PAYMENT / PSP BOUNDARY

Verified: Sales decomposition requires **no** provider selection, PSP adapter,
card data handling, webhook implementation, ProviderFee implementation, native
split, or payout orchestration. `completeSale` emits `OrderRequested` to the
Order domain; payments are downstream. Hidden PSP dependency discovered: **none**.
Preserved: PaymentService lifecycle authority, ProviderFee ≠ TravelHub
Commission, 2.12B BLOCKED, ADR-0015 PROPOSED — BLOCKED, 2.12I DEFERRED.

---

## 27. RLS BOUNDARY

No RLS implementation. ADR-0014 (ACCEPTED) and Step 2.18 verification
ownership preserved. Current Sales isolation is application-level
(permission gates at controllers + internal staff actor context); documented
here as current behavior; the decomposition does not weaken it (checks stay
controller-layer; `assertOptionalUser` staff-only guard stays pre-write).

---

## 28. STEP 2.17B BOUNDARY

Preserved verbatim:
`Step 2.17B — BLOCKED — FINAL QUALIFICATION ENVIRONMENT REQUIRED — NOT APPROVED`
No frozen targets modified, no qualification claimed. Step 2.17C proceeds
independently (repository dependencies confirm it: Sales decomposition touches
no harness, no targets, no SLOs). Phase 2 exit remains blocked until 2.17B is
closed.

---

## 29. BOUNDARIES / NON-GOALS

- No production code changes in this pass (design only).
- No schema/migration changes; no new indexes.
- No public API, DTO, RBAC, status, money, event, idempotency, or transaction
  semantic changes.
- No performance tuning; no Step 2.17B/PSP/RLS/2.18 work.
- No new events; same event topology.
- The facade stays (Option A); no controller rewiring.
- Every method has a destination; nothing is deleted unless a full-repo search
  proves it unreachable (none currently).

---

## 30. ROLLBACK STRATEGY

Each wave is independently revertible:
- Waves 1–2 (pure modules + Query extraction): revert = restore imports and
  facade delegation lines (mechanical, zero schema impact).
- Waves 3–5 (collaborator extractions): each is a pure class-boundary move;
  revert = facade calls the original private method body again. Because the
  facade keeps exact signatures and the module graph is unchanged (all
  collaborators registered in `SalesModule.providers` alongside `SalesService`),
  any wave can be reverted with a small diff and full regression re-run.
- Wave 0 characterization tests are additive and retained regardless.

---

## 31. RISKS

| Risk | Level | Mitigation |
|---|---|---|
| Splitting `completeSale` single-tx atomicity (reservation + outbox + snapshot) | HIGH | dedicated `SalesCompletionService`; Wave 0 characterization; Wave 5 last; post-commit delivery explicitly outside tx |
| `issueQuote` money freeze / commission selection drift | HIGH | move last in Quote sub-wave; pure money + snapshot gate already unit-tested; golden projection tests |
| `createOpportunityFromBuyerRequestSelection` external-tx signature broken (Reverse) | HIGH | facade keeps exact tx signature; Reverse caller unchanged; e2e reverse-conversion regression |
| Read-like CAS (`revalidateCheckoutIntent` empty-data updateMany) mis-preserved | MEDIUM | exact method-move plan; e2e checkout suite |
| P2002→409 unique-conflict mapping (Sale) regressed | MEDIUM | stays in Lifecycle verbatim; e2e duplicate-sale coverage |
| Projection drift during mapper extraction | LOW | Wave 0 golden tests on all 8 mappers |
| Facade becomes a pass-through and is later "simplified" wrongly | LOW | Option A documented with rationale; cleanup wave gated on full-repo search |

---

## 32. DESIGN VERDICT

## VERDICT A — DESIGN READY FOR IMPLEMENTATION

- Complete method/responsibility inventory: **YES** (66/66 methods, §4)
- Proposed ownership explicit: **YES** (§20)
- No authority change required: **YES** (all rows `NO`)
- Transaction/event/idempotency boundaries preservable: **YES** (§7/§8/§12)
- Dependency graph acyclic: **YES** (§15/§19)
- Implementation waves defined: **YES** (§22, 7 waves)
- Characterization gaps identified: **YES** (§23 — Wave 0 pins `issueQuote` /
  `completeSale` / projections before extraction)
- Unresolved CRITICAL/HIGH design blocker: **NONE**

NEXT: `STEP 2.17C — BEHAVIOR-PRESERVING IMPLEMENTATION`
