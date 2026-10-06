# SUPPLIER MARKUP — ARCHITECTURE (Phase 6 §6.17)

Canonical description of the Supplier Markup workstream boundaries as implemented
(Phases 0–5). Governing prompts:
`docs/prompts/SUPPLIER_MARKUP_PHASE_5_6_FINAL_STRICT_IMPLEMENTATION_PROMPT.md`,
`docs/prompts/SUPPLIER_MARKUP_IMPLEMENTATION_DESIGN.md`.

## Pricing

```
supplier price (adapter/Tariff)
  → TravelHUB markup (MarkupRule, supplier currency, half-up 2dp via sales.money)
  → public price (what the storefront shows)
```

- Single calculation boundary: `SupplierOfferService` →
  `SupplierPricingService.resolveSafe()/apply/applyFor` (backend/src/modules/pricing/supplier-pricing.service.ts).
  NO other module may re-apply markup (catalog/sales read paths do not import
  pricing — "no double markup" invariant, unit-tested).
- Public read endpoints (`public-supplier.controller`) pass supplier prices
  through exactly one `applyTo*` call before serialization.
- Sync path uses the strict `publicAmountFor` (rule failure → rejects; sync must
  never write a raw supplier price as public).

## Live Sales

```
public price → individual request discount (sales.discount.grant) → customer final
```

- Discount never alters `publicPrice`/markup — only `finalPrice`
  (`commercial-snapshot.spec.ts`).
- Grant guards: PRICE_CHANGED proposal pending / frozen snapshot / legacy
  no-snapshot → 422 (`request-discount-grant.e2e-spec.ts`).

## Supplier floor

```
customerFinalPrice >= supplierPrice
```

- Enforced at the acceptance gate (`commercial-snapshot` floor PASS/REJECT
  tests) and at discount grant (fixed/percent cannot push final below supplier
  basis → 422). Accepted money below floor is rejected (tampered snapshot).

## MarkupRule

- Lifecycle: `DRAFT → ACTIVE → ARCHIVED` (terminal). ACTIVE/ARCHIVED immutable —
  a new rate = a new rule; update only in DRAFT with optimistic `expectedVersion`
  (stale → 409).
- `effectiveFrom`/`effectiveTo` window; overlap invariant: at most one ACTIVE
  rule per (supplierCode, serviceType) covering an instant — enforced on
  activate under `pg_advisory_xact_lock('markup-rule:'||key)`
  (concurrent conflicting activate → controlled 409, no duplicates).
- Every mutation writes `MarkupRuleHistory` + `AuditLog`.
- `NOT_CONFIGURED` = no active rule → effective rate 0%, a state distinguishable
  from an explicitly configured 0% rule. Ambiguous (overlapping ACTIVE backstop)
  → fail-closed `NOT_CONFIGURED`.

## Registry SSOT (Gate A)

- `SupplierAdapterRegistry` (tours/hotels adapters) and `FlightSupplierRegistry`
  (flights) are the only supplier/service catalogs. The admin markup matrix and
  the resolver iterate the registries — no hardcoded supplier/service lists; a
  new registered supplier appears without matrix code changes.

## Commercial snapshot

The working/frozen commercial snapshot records: supplier price + currency,
markup rate/rule identity, public price, individual discount, customer final
price, price source, acceptance context (`customerAcceptedAt`) and freshness
context (`supplierPriceFetchedAt`, `supplierPriceExpiresAt`, `collectedAt`).
Once accepted the snapshot is frozen history — reconciliation, later MarkupRule
changes, and sync NEVER mutate it (Gate F).

## Flights

- `FlightSupplierRegistry → search fan-out → FlightSearchResult.collectedAt`.
- 5-minute TTL on the recent search: fresh → reuse (no second supplier
  round-trip); stale → full re-search (Gate I, `azal.controller.spec.ts`).
- Exactly one markup per fare; displayed price is server-derived.
- `body.price` is NOT commercial authority (client number ignored → 400 when the
  derived segment keys/price don't match: `azal.controller:309`).
- No `FlightSupplier.refreshPrice` — flight refresh is re-search, not a price
  mutation method.

## Storefront

`CommissionPolicy` (seller commission) remains a separate concept from Supplier
Markup (platform markup on supplier price): pricing module does not import or
mutate CommissionPolicy; storefront/commission e2e suites stay green
(`storefront`, `commission-policy-foundation`, `commercial-restriction`).

## Sync

- Sync services (`summer-sync`, `summer-bulk-sync`, `kazunion-sync`,
  `kompas-sync`) compute `Tariff.startingPrice` / product
  `attrs.startingPrice` from the PUBLIC price (`publicAmountFor`) and update
  them when the supplier minimum changes — Tariff/public price consistency.
- Catalog read paths never re-apply markup (reconciliation without double
  markup); accepted Request/Order snapshots are never rewritten by sync.
- `amount:0` is never a valid supplier price: adapters drop priceless rows /
  throw `PRICE_UNAVAILABLE` (`priceUnavailable()` helper → mapped to HTTP 400 at
  the public controllers; `SupplierOfferService.priceBoundary` is the last
  resort). Missing/invalid money surfaces as 400, never as a zero price.
- Debug artifacts are forbidden in pricing/supplier sources (guarded by
  `pricing-debug-artifacts.spec.ts`).
