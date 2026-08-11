# SERVICE TEMPLATES — IMPLEMENTATION-TIME DECISION GATES — RESOLUTION

**Project:** TravelHub
**Status:** DECIDED (2026-08-11) — resolution of DD-024…DD-029
**Mode:** Architecture / Roadmap decision gate — DOCUMENTATION ONLY (no schema/migration/code/API/UI)
**Predecessor:** `PHASE 2 STEP 2.2F STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
**Purpose:** make Steps 1.8A–1.8D implementable without reopening fundamental semantics.
**Sources:** `TRAVELHUB_DEFERRED_DECISIONS_MAP.md`; `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (Steps 1.8A–1.8D, Catalog Commercial Modeling, Execution Sequence); `CANONICAL_ROADMAP_UNIVERSAL_PRICING_MODEL_AMENDMENT.md`; `TRAVELHUB_ROADMAP_SERVICE_TEMPLATES_PERIOD_PRICING_AVAILABILITY_AMENDMENT.md`; `schema.prisma` (Category/CategorySchema/Product/Tariff/Availability/AvailabilityReservation/Quote/QuoteItem/Order/OrderItem); Step 2.4 `CatalogService.reserveAvailability`; Step 2.5 `OrderRequested` contract; ADR-0001/0005/0012.

Repository truth wins over previous prose.

---

## 0. Global invariants preserved

1. `Template defines structure; Seller provides values`.
2. Seller-defined commercial names preserved verbatim.
3. TravelHub standardizes attributes, not seller naming.
4. Physical/service unit ≠ commercial Rate Plan.
5. Pricing ≠ Availability ≠ Reservation/Hold.
6. Catalog owns product/service commercial inventory (incl. new unit entity).
7. Sales/Order/Booking never become inventory owners.
8. Step 2.4 hold engine remains the ONLY reservation/hold engine.
9. Binding commercial facts freeze at canonical Quote/Checkout/Sale boundaries.
10. Later Catalog price changes never mutate frozen downstream commercial facts.
11. Seller capability ≠ live inventory (ADR-0012).
12. No fabricated future price; no mandatory long-range forecast.
13. Server authoritative for price and availability resolution; frontend-only pricing forbidden.
14. No second pricing/availability authority; no parallel commercial pipeline.

None of the resolutions below breaks an invariant → no `ARCHITECTURE DECISION REQUIRED`.

---

## 1. DD-025 — Seller commercial unit identity / CategorySchema nesting → **B: new Catalog-owned Seller Commercial Unit required**

**Repository evidence:** `CategorySchema.attributes` is a flat JSON array of attribute definitions
`[{key,label,type,required,searchable,filterable,options?,min?,max?,pattern?}]` validated per-Product
(`validateAttributes`); config blocks (`availability`/`tariffRules`/`mediaRequirements`/`pdpSections`) are
single JSON documents with no repeatable unit structure, no unit-level identity/lifecycle/code/own-attributes.
`Availability` is keyed `(productId, tariffId, date)` — no room/unit dimension exists. Repeatable JSON inside
`attributes` cannot provide stable identity, lifecycle, audit, or availability relation per unit.

**Decision:** 1.8A introduces a **first-class Catalog-owned entity** (working name `ServiceUnit` /
`SellerCommercialUnit`, catalog.*):
- anchors to `CategorySchema` template + `Product`;
- stable identity (`id`) + canonical code prefix **registered at 1.8A implementation** (distinct business
  entity ⇒ distinct ID domain is required; prefix deferred to implementation naming, NOT frozen here);
- lifecycle (DRAFT → PUBLISHED → …; moderation/publication reuse per Step 1.4 conventions);
- seller-defined unit name preserved verbatim; normalized unit attributes (occupancy, bed type, view, room
  class, size, amenities) from CategorySchema — without replacing the seller name (invariant 2/3);
- `source + externalKey` (stable source/external ID) for import reconciliation — repeated imports reconcile,
  never duplicate units (DD-025 evidence);
- relation to Rate Plan/Tariff (1..N) and to `Availability` (inventory keyed per unit where category requires);
- CategorySchema remains the template/definition owner; the unit is the *instance* — template ≠ unit.

**Bounded-context:** new entity stays inside catalog.* (same bounded context as Product/Tariff). It does NOT
change bounded-context ownership → **no new ADR required**; ADR-0001 (Catalog owner-service contract) covers it.
A formal ADR is required only if 1.8A implementation proves the unit cannot live in catalog.*.

---

## 2. DD-024 — Tariff vs Rate Plan → **A: Tariff IS the canonical Rate Plan foundation, to be extended**

**Repository evidence:** `Tariff` = `id` + canonical `TRF-*` (unique), `productId` (Cascade), `name`, `price
Decimal(12,2)`, `currency`, `validFrom`/`validTo` (sales/booking price validity window — `resolveEligibleTariff`:
`validFrom>now` → not active, `validTo<now` → expired; NOT service/stay period), `version`. Tariff is already the
availability key (`Availability @@unique(productId, tariffId, date)`, `AvailabilityReservation` per
`(productId, tariffId, date, quantity)`) and the QuoteItem price snapshot source. Missing: meal plan,
refundability, cancellation-policy ref, included services, restrictions, price basis, occupancy/PAX.

**Decision:** **No parallel RatePlan entity.** 1.8B **extends `Tariff`** into the canonical commercial
variant/Rate Plan concept:
- add: seller-defined variant name (exists), meal plan, refundability, `cancellationPolicyId` ref (policy has
  separate ownership — not buried in price rows), included services, restrictions, `priceBasis`, occupancy/PAX
  applicability;
- keep canonical: identity/`TRF-*`, price/currency, validity window, availability-key role, version/CAS;
- overlap of Tariff + RatePlan authorities is FORBIDDEN (never two equal authorities).

Examples (one room): Room Only — Refundable; Breakfast Included — Refundable; Breakfast Included —
Non-refundable. Non-hotel: Tour Standard/Private/Premium; Transfer Sedan/Minivan + cancellation variants.

---

## 3. DD-026 — Pricing model: period semantics, price basis, occupancy, overlap/precedence → DECIDED

**3.1 Period entity (1.8C).** New Catalog-owned `CommercialPeriod` (period price row) keyed by
`(tariffId, validFrom, validTo, price, currency [, basis, occupancy/PAX dims])`; date-only inclusive
`[validFrom, validTo]` (UTC date-only, midnight — same model as `Availability.date`); service timezone defers to
Step 2.8A. Sales validity period ≠ service/stay period ≠ booking window — separate concepts, never silently
pipelined (evidence: `Tariff.validFrom/validTo` = price/booking validity window, NOT stay period).

**3.2 Price source vs price rule (universal pricing).** Model MUST distinguish:
- `source` — WHERE the price came from: `MANUAL` (base/period/override), `IMPORT`, `API_SUPPLIER`,
  `CHANNEL_MANAGER`, future `DYNAMIC_RULE` (illustrative names; final enums at implementation);
- `rule/method` — HOW price is structured: `FIXED`, `PERIOD` (seasonal/annual), `DATE_OVERRIDE`,
  `DAY_OF_WEEK`, `OCCUPANCY`, `PAX/AGE_BAND`, `DURATION`, `ROUTE`, `PACKAGE`, `PRICE_ON_REQUEST`.
CSV/XLS import is an input method, never a separate pricing authority (populates canonical manual periods).

**3.3 Price basis.** Generic concept attached at **Tariff (Rate Plan) level** (prevents contradictory prices
within a plan; period rows inherit it): `PER_UNIT`, `PER_ROOM`, `PER_PERSON`, `PER_NIGHT`, `PER_DAY`,
`PER_HOUR`, `PER_TRIP`, `PACKAGE_TOTAL`. CategorySchema declares allowed/required bases per category; not every
category uses every basis.

**3.4 Occupancy / PAX / age / duration / route.** These are **price-identity dimensions**, not just filters:
- occupancy (1/2/3…) — accommodation-specific, distinct from generic PAX;
- Adult/Child/Infant age bands — configurable per category, NOT globally hardcoded;
- PAX/group tiers (price ≠ persons × base where tiers apply);
- duration tiers (rentals/long stays);
- route/zone (transfer-like).
Generic dimensions + category-configurable extension mechanism; no frozen global matrices.

**3.5 Temporal semantics.** Period = date-only inclusive `[validFrom, validTo]`. 1.8C is **date-based only**;
exact time-slot/departure/timezone-aware semantics remain gated by **Step 2.8A** (approved execution rule,
unchanged).

**3.6 Overlap & precedence (deterministic, server-side).** One authoritative resolved price per requested
commercial context. Conceptual precedence, validated and made exact at 1.8C implementation with typed
server-side validation:

```
exact DATE_OVERRIDE (single date / explicit date-range) > explicit PERIOD (narrower range wins) >
DAY_OF_WEEK rule > broader seasonal/base PERIOD > FIXED/BASE
```

- overlapping periods of the same priority: **FORBIDDEN** — write-time validation (422, no "first row wins");
- tie impossible by construction; source priority (manual vs supplier/imported) resolved as documented
  extension point (see §9);
- no frontend precedence authority; resolution is server-side only.

**3.7 Missing-price semantics.** No fabrication, no silent use of a stale period: if no valid price exists for
the requested date/conditions → **not available for instant binding price**, or `PRICE_ON_REQUEST` only where the
product/business flow explicitly supports non-binding inquiry. `PRICE_ON_REQUEST` is a typed commercial state,
NOT a fabricated zero/marketing number and must never enter binding Checkout as a numeric price. Marketplace
"from N" uses only authoritative currently-valid commercial periods per a server-side rule.

---

## 4. DD-027 — Availability granularity & multi-date atomic holds → **A: extend/reuse existing model**

**Repository evidence:** `Availability(productId, tariffId, date)` unique + `slotsTotal/Booked/Reserved`;
`AvailabilityReservation` (`RSR-*`, per `(productId, tariffId, date, quantity)`, HELD/RELEASED) created
atomically via `CatalogService.reserveAvailability(tx, …)` — conditional UPDATE (`available >= requested` →
decrement) + reservation row in ONE PostgreSQL tx (Step 2.4, atomic last-slot, capacity never negative).

**Decision:**
- **Multi-date stays:** one commercial item (hotel/apartment) spanning N nights creates **N reservation rows
  (one per date) inside the same atomic tx** — the existing conditional-UPDATE engine supports this directly
  (any failure → full rollback, no partial holds). No second hold engine. **A**.
- **Contract impact (documented, NOT a Step 2.5 defect):** current `OrderRequested.reservationIds.length ===
  items.length` (one hold per item, APPROVED Step 2.5) is revised at 1.8C: cardinality = **all allocated
  units/dates**, not "number of items". `Order.reservationIds` (Json) already stores all holds; consumer
  validation change is a Step 1.8C implementation detail.
- **Granularity:** category-dependent — `DATE_ONLY` (safe for 1.8C), `DATE_RANGE`/`DEPARTURE`/`TIME_SLOT`/
  `OPEN_DATE` reconciled with existing concepts; time-slot/departure semantics gated by Step 2.8A.
- **Inventory unit:** `slotsTotal` semantics per category/service unit (rooms, tour seats, vehicle capacity/
  booking units, excursion seats, rental units) — CategorySchema template rules define inventory semantics; NOT
  always "people".
- **Price ≠ availability:** a date may have price with zero availability, availability without bindable price,
  both, or neither — independent states. **Stop-sell** = availability/commercial-saleability behavior, never
  price deletion.

---

## 5. DD-028 — Taxonomy ownership → **Catalog owns normalized dictionaries**

**Repository evidence:** `CategorySchema` (catalog.*) already owns category-specific attribute definitions
(options/enums/validation). ADR-0005: Catalog owns public seller projection. Step 2.2A (Reverse Marketplace)
*consumes* extensible service taxonomy for matching — consumption, not ownership (no write rights to foreign
dictionaries).

**Decision:** normalized commercial dictionaries (meal plan, bed type, view, amenities, service class, vehicle
class, room class) are **Catalog-owned**, defined by CategorySchema/template and platform-maintained vocabularies.
Reverse Marketplace READS normalized attributes/capabilities for matching; it does not own them. No duplicated
taxonomy per UI surface; no controlled global enums for marketing terms; `source/original value + normalized
value` preserved; taxonomy extensible.

---

## 6. DD-029 — Currency authority → **single currency per Rate Plan; display conversion deferred**

**Repository evidence:** Quote enforces one currency per quote (mixed currency → 422); binding price is in
Tariff currency; no FX domain exists (DD-029 evidence: cannot numerically compare `100 USD` vs `90 EUR` without
an FX/display rule).

**Decision:**
- Seller-entered price currency: explicit on each period price row; **must be consistent within a Rate
  Plan/Tariff** (single currency per plan).
- Binding authority unchanged: Quote/Checkout/Sale bind in the tariff/period currency.
- Marketplace display: **same-currency "from N" rule** — minimum within the buyer/display currency only when a
  price exists in that currency; **no cross-currency comparison** until a canonical FX architecture exists.
- Any future display conversion is display-only and NEVER mutates binding price (`display conversion ≠ binding
  commercial price mutation`).
- **FX engine NOT implemented** (deferred); Step 1.8B/1.8C proceed with single-currency-per-RatePlan while
  display conversion remains deferred and documented.

---

## 7. Cross-category validation

- **Hotel/apartment:** unit (room) + multiple Tariff/Rate Plans + seasonal yearly periods + holiday override +
  nightly inventory (multi-date holds) — supported (DD-025 unit, DD-024 Tariff extension, DD-026 periods +
  `PER_NIGHT` + occupancy, DD-027 per-date holds).
- **Tour:** package/service variant + departure/date price + PAX/age bands + seat inventory — supported
  (`PER_PERSON`, `AGE_BAND`, `DATE/DEPARTURE`, seat inventory unit).
- **Transfer:** vehicle/service variant + per-trip/per-vehicle price + date/period + capacity — supported
  (`PER_VEHICLE`, `PER_TRIP`, `ROUTE`, variant).
- **Excursion/activity:** ticket/service variant + per-person/category price + departure/time-slot (2.8A-gated)
  + seats — supported.
- **Car rental:** vehicle class/unit + per-day price + seasonal periods + vehicle inventory — supported
  (`PER_DAY`, `DURATION_TIER`, variant).
A model that only works for hotels fails review — the generic dimensions + category compatibility mechanism above
cover all five.

---

## 8. Category compatibility & composability (future)

Server-authoritative compatibility definition per category/template: allowed / required / forbidden /
mutually-exclusive / composable dimensions. Frontend must not invent compatibility. Initial MVP focuses on
manual entry (fixed + annual/seasonal periods + date overrides + price basis + occupancy/PAX + day-of-week as
supported per category); the architecture must not block later extensions.

---

## 9. Deferred extension points (documented, not required in 1.8A–1.8D MVP)

- `API_SUPPLIER` / `CHANNEL_MANAGER` price sources; `IMPORT` (CSV/XLS) as input convenience;
- dynamic/revenue-management pricing rules; AI/competitor pricing;
- source-priority resolution across mixed manual/imported/supplier rows;
- FX engine and display conversion (see §6);
- add-ons/surcharges as typed priced components (reconcile with DD-023 canonical options when that model lands);
- every occupancy matrix / time-slot model beyond MVP;
- cancellation/refundability **policy** model (Rate Plan references policy ID; policy ownership stays separate).
No second pricing authority, no second hold engine, no free-form formula language as sole authority.

---

## 10. Implied Step shapes (Roadmap sync)

- **1.8A — Service Template / Seller Commercial Structure Foundation:** CategorySchema template + `ServiceUnit`
  entity (identity/lifecycle/attributes/names verbatim/source+externalKey/availability relation).
- **1.8B — Tariff / Commercial Variant (Rate Plan) Foundation:** extend Tariff (meal plan, refundability,
  cancellation ref, restrictions, price basis, occupancy/PAX); single currency per plan; Price on Request;
  category compatibility matrix MVP.
- **1.8C — Commercial Calendar — Period Pricing, Overrides & Availability:** `CommercialPeriod` rows, annual/
  seasonal calendar backend, date overrides, day-of-week, overlap validation, stop-sell, availability separately,
  multi-date atomic holds + `OrderRequested.reservationIds` contract revision; date-based scope (2.8A gate).
- **1.8D — Server-side Price Resolution & Commercial Validation:** deterministic resolver (precedence §3.6),
  gap/conflict behavior, authoritative resolved price, Marketplace "from N" consumption, Quote binding handoff,
  no frontend binding authority, no post-freeze reprice.

**Execution order after this gate:** `1.8A → STRICT REVIEW → 1.8B → STRICT REVIEW → 1.8C → STRICT REVIEW → 1.8D →
STRICT REVIEW`. No prerequisite ADR was identified by this resolution (all decisions stay inside catalog.* and
preserve the Step 2.4/2.5/2.5B contracts or document their revision in 1.8C).
