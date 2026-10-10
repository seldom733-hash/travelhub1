# TRAVELHUB — Supplier-Authoritative Passenger Parameters & Live Price Contract

**READ-ONLY AUDIT REPORT** (Sections A–R)
Mode: read-only. No `.ts`/`.tsx`/`.prisma`/migration changes; no DB writes; no price/Markup/Request/Order/Booking/adapter modifications; no commits.
Prompt: `TRAVELHUB_SUPPLIER_AUTHORITATIVE_PRICE_CONSISTENCY_READ_ONLY_AUDIT_PROMPT.md` (§0–§29).

---

## A. VERDICT (§28)

**`DESIGN BLOCKED — OWNER DECISIONS REQUIRED`**

The supplier-side passenger-parameter mechanism already exists as a per-adapter **Supplier Passenger Parameters Mapper** (each adapter translates `SupplierSearchQuery {adults, children, childAges}` into its own wire format), and TravelHUB never calculates supplier prices itself — the price chain is intact end-to-end. However, four confirmed code gaps plus five owner-level business decisions (§P) block a final implementation design: the Summer active path silently drops child ages, Anex Tours sends only the first child's age, the flight domain discards child ages/DOB entirely, and no code path derives supplier parameters from `RequestTraveler` DOB (and no recheck exists between acceptance and payment).

## B. EXECUTIVE SUMMARY

1. **CONFIRMED BY CODE** — TravelHUB does **not** calculate supplier prices. Every live price originates in a supplier adapter response and flows through the single pricing boundary (`SupplierPricingService`) into public price; discounts apply only above `supplierPrice` (commercial-snapshot invariants). The chain `Supplier Price → Markup → Public Price → Individual Discount → Customer Final Price` is enforced (`commercial-snapshot.ts` invariants; `NO DOUBLE MARKUP` comment `supplier-offer.service.ts:26-32`).
2. **CONFIRMED BY CODE** — Supplier passenger parameters are produced by **per-adapter mappers**, not by a canonical composition engine:
   - Summer: `AGE1/AGE2/AGE3` built (`summertour.request-builder.ts:110-112`) but **dropped** by the active XHR URL serializer (`buildSummerXhrUrl`, `:138-139` — ADULT/CHILD only, no AGE keys anywhere in `:126-167`).
   - KOMPAS: `AGE1-3` set on the SAMO form (`kompas.adapter.ts:391-393` search, `:1333-1335` calendar) → the site's own PRICES request carries them.
   - KazUnion: `AGE1..AGE4` into the PRICES URL (`kazunion-http.service.ts:617-619`).
   - Anex Tours: `AGES = childAges[0]` — **first child only** (`anex.adapter.ts:272`).
   - Anex Hotels: CSV of all children ages (`anex-hotel.adapter.ts:279-282`).
   - AZAL: counts only — `adult_count/child_count/infant_count` strings (`azal.http.service.ts:276-278`), `childrenDatesOfBirth: null` (`:208`).
   - Aviasales: counts only (`aviasales.http.service.ts:250-252`).
3. **CONFIRMED BY CODE** — No age-calculation code exists anywhere in the backend (0 hits for age derivation); the frontend collects **user-entered child ages 0–17** (`ChildAges.tsx:11`), never DOB, for both tours and flights. `RequestTraveler.birthDate` is stored but **never converted into supplier parameters** — there is no `RequestTraveler → supplier params` flow in the codebase.
4. **CONFIRMED BY CODE** — Supplier price is re-checked **once**, at Request creation (`tour-request.service.ts:135` recheck; AZAL `/request` re-derives server-side `azal.controller.ts:152,280-325`). **No recheck between customer acceptance and payment/conversion was found** (grep for pre-payment price checks: 0 hits).
5. The public endpoint `POST public/supplier/refresh-price` accepts a **client-supplied `searchContext`** (`public-supplier.controller.ts:254-267`) — so a refreshed price for a modified composition is technically possible, but it re-derives from the client's context, not from `RequestTraveler`.

## C. CURRENT PRICE ARCHITECTURE (§11)

```
Supplier adapter (search / refreshPrice)
   │  raw supplier amount (Gate E: amount>0 + currency)
   ▼
SupplierOfferService  ── "NO DOUBLE MARKUP" boundary  (supplier-offer.service.ts:26-32)
   ▼
SupplierPricingService.apply / applyToOffers / applyToPriceSnapshot
   │  → offer.price = PUBLIC, offer.pricing = {supplierAmount, markupAmount, publicAmount, …}
   ▼
┌─ Path A (tours): createTourRequest recheck (tour-request.service.ts:135)
│    displayedPrice = recheck.amount (server-authoritative)
│    commercialSnapshot = buildWorkingSnapshot(...) (:204-211)
│      invariants: publicPrice = supplierPrice + markupAmount;
│                  customerFinalPrice = publicPrice − discountAmount;
│                  customerFinalPrice ≥ supplierPrice   (commercial-snapshot.ts)
├─ Path C (flights): POST supplier/azal/request (azal.controller.ts:147-186)
│    deriveAuthoritativePrice = fresh re-search, body.price NEVER trusted (:150-152, :280-325)
│    commercialSnapshot from matched fare's pricing block (:161-172)
└─ Path B (catalog buyers): Tariff.price = public (summer-sync.service.ts:401-410 publicAmountFor)
   ▼
Request: displayedPrice → [grantDiscount → applyIndividualDiscount] (request.service.ts:968-1020)
   → customerAccept: proposal ?? snapshot.customerFinalPrice ?? displayedPrice (:1125-1130)
   → freezeForAcceptance (:1142)
   ▼
convertRequestToOrder → Order.commercialSnapshot = Request.commercialSnapshot VERBATIM
   (request.service.ts convertRequestToOrder → order.service.ts:716-717)
```

Markup is applied exactly once per boundary; supplier amount survives in the `pricing` block everywhere.

## D. SUPPLIER MATRIX (§21) — LIVE price parameters actually sent

| Supplier | Registry | adults | children | child ages | infants | DOB | Wire format | file:line |
|---|---|---|---|---|---|---|---|---|
| **SUMMERTOUR** (active `SummertourNewAdapter`) | `supplier.module.ts:89` | `ADULT` | `CHILD` | `AGE1-3` **built but NOT serialized in XHR URL** | — | — | built `summertour.request-builder.ts:107-112`; XHR drops AGE `:138-139` (full serializer `:126-167`); calendar no AGE `summertour-new.adapter.ts:847-881`; DOLOAD no AGE `:33,42` | CONFIRMED BY CODE |
| **KOMPAS** | `supplier.module.ts:114` | `ADULT` (form) | `CHILD` (form) | `AGE1-3` via `setSamoSelect` | — | — | `kompas.adapter.ts:386-393` (search), `:1333-1335` (calendar); PRICES issued by supplier site form `:485-547` | CONFIRMED BY CODE |
| **KAZUNION** | `supplier.module.ts:137` | counts | counts | `AGE1..AGE4` (max 4) | — | — | `kazunion-http.service.ts:617-619` in `buildPricesUrl` `:574+` | CONFIRMED BY CODE |
| **ANEX Tours** | `supplier.module.ts:161` | `ADULT` | `CHILD` | `AGES = childAges[0]` **first child only** | — | — | `anex.adapter.ts:270-272` | CONFIRMED BY CODE |
| **ANEX Hotels** | `supplier.module.ts:190` | counts | counts | CSV all children: `Array.from({length:children},(_,i)=>childAges[i]??0).join(",")` | — | — | `anex-hotel.adapter.ts:279-282` | CONFIRMED BY CODE |
| **AZAL** (flight) | `supplier.module.ts:211` | `adult_count` | `child_count` | — | `infant_count` | `childrenDatesOfBirth: null` always | strings `azal.http.service.ts:276-278`, `:200,208`; DOB never populated | CONFIRMED BY CODE |
| **AVIASALES** (flight) | `supplier.module.ts:215` | `passengers.adults` | `passengers.children` | — | `passengers.infants` | — | `aviasales.http.service.ts:250-252`; start body `:234-252` | CONFIRMED BY CODE |

Other params: KOMPAS calendar limit = nights 3–14 only (`kompas.adapter.ts:64,237-245`); no per-supplier children-count limits found in code (NOT CONFIRMED). Legacy `SummertourAdapter` sets `AGE1-3` via DOM (`summertour.adapter.ts:140-146`) but is **not** in the registry; `SummertourHttpService.fetchPrices` (`summertour-http.service.ts:123-126`) sends `AGES=childAges[0]` but the service is only module-registered, never injected by callers (dead path).

**Confidence note (§2):** file:line facts are `CONFIRMED BY CODE`. Whether a supplier *prices differently* per child age is `NOT CONFIRMED BY SUPPLIER CONTRACT` except where `OWNER-PROVIDED BUSINESS RULE` applies (Summer: child <13; AZAL: <2/2-11/12+).

## E. SUMMER DEEP DIVE (§6)

- **`buildSummerSearchRequest`** populates `req.AGE1/AGE2/AGE3` from `query.childAges` (`summertour.request-builder.ts:109-112`) — CONFIRMED BY CODE.
- **`buildSummerXhrUrl`** (active transport for search `:150-175`, refreshPrice `:457-478`, captcha rebuild `:1309` path) serializes `ADULT` (`:138`) and `CHILD` (`:139`) only — **no `AGE1/AGE2/AGE3` keys exist anywhere in `:126-167`** — CONFIRMED BY CODE. ⇒ child ages are **lost in the active path**: Summer receives "2 adults + 2 children" without knowing the children's ages.
- **Calendar** `buildHotelPricesParams` (`summertour-new.adapter.ts:847-881`): `ADULT`/`CHILD` only (`:863-864`), no AGE — CONFIRMED BY CODE.
- **DOLOAD init/per-date URLs** built manually (`:33,42` fragments) — ADULT/CHILD only — CONFIRMED BY CODE.
- **refreshPrice** (`summertour-new.adapter.ts:442-478`) rebuilds the query from `ref.searchContext` (including `childAges`) and re-searches — composition is preserved in TravelHUB but still dropped at URL serialization.
- Offer normalization keeps `childAges` in the offer/searchContext (`:416`, `:714`, `:602-605`) — the mapper input exists; only the wire step fails.
- Owner rule `OWNER-PROVIDED BUSINESS RULE`: Summer child = age <13; the price of a 5-y-o vs 12-y-o is Summer's business (§19 — no TravelHUB price formula).
- **Gap (CONFIRMED BY CODE):** for 2+ children or any child age input, the active Summer path under-specifies the composition. Whether Summer's API accepts `AGE1-3` on `search_tour` XHR (it does on the SAMO form/DOLOAD legacy path) is `NOT CONFIRMED BY SUPPLIER CONTRACT` — requires owner/supplier confirmation before the fix.

## F. AZAL DEEP DIVE (§7)

- Request body built at `azal.http.service.ts:200-278`: `passengersAmount` (`:200`), **`childrenDatesOfBirth: null`** (`:208`), `adult_count/child_count/infant_count` as strings (`:276-278`) — CONFIRMED BY CODE.
- `FlightSearchQuery.passengers = {adults, children, infants}` (`flight.types.ts:11-30`) — no `childAges`, no DOB field in the flight domain — CONFIRMED BY CODE. The frontend **does** collect child ages for flights (`FlightSearch.tsx:30,156,321`) but they are dropped at the backend boundary.
- `AzalAdapter` adds no age/DOB parameters. Owner rule: `<2 infant, 2–11 child, 12+ adult` (`OWNER-PROVIDED`) — but TravelHUB cannot currently apply it because it never receives per-child ages in the flight domain (it only receives counts).
- **Path C (CONFIRMED BY CODE):** `POST supplier/azal/request` (`azal.controller.ts:147-186`):
  - `deriveAuthoritativePrice` re-searches with `body.passengers` verbatim (`:299-308`); `body.price` never trusted (`:150-152`) — server-authoritative re-derive.
  - `travelerCount = body.passengers?.adults ?? 1` (`:176`) — **children/infants not counted** into travelerCount (gap, see §M).
  - `pinnedRequirements = {...body, supplierCode}` (`:181`) — full body frozen, including passengers (so composition *is* persisted, just not counted).
  - RT pricing combines both legs' `pricing` blocks (`:436-448`) — no double markup (each fare priced once in `applyFlightMarkup` `:247-268`).
- Recent-search TTL cache keyed on the full normalized query (`:50-54,327-341`) — a changed passenger composition ⇒ different key ⇒ fresh search (correct behavior).

## G. OTHER SUPPLIERS (§8)

- **KOMPAS** — browser-driven SAMO form: `ADULT/CHILD` selects + `AGE1-3` via `setSamoSelect` before clicking `.load` (`kompas.adapter.ts:386-393`); the site's own JS issues `samo_action=PRICES` with the full form (`:485-547` route intercept preserves the original params, only rewrites HOTELS/TOURINC/TOWNS/STARS/dates/FREIGHT/FILTER/PARTITION_PRICE). Ages reach the supplier through the native form — CONFIRMED BY CODE. Only 3 child-age slots exist in the form (`AGE1-3`); >3 children ⇒ extra ages silently un-set (NOT CONFIRMED whether supplier form supports more).
- **KazUnion** — direct HTTP: `AGE1..AGE4` appended for `min(ages.length, 4)` children (`kazunion-http.service.ts:617-619`); ≥5 children ⇒ ages 5+ dropped (confirmed code behavior; supplier cap NOT CONFIRMED).
- **Anex Tours** — `AGES` param = **only `childAges[0]`** (`anex.adapter.ts:272`): 2+ children ⇒ 2nd..nth child ages never sent — CONFIRMED BY CODE (supplier's expected CSV format NOT CONFIRMED).
- **Anex Hotels** — full CSV `join(",")` (`anex-hotel.adapter.ts:279-282`) — all children ages sent.
- **Aviasales** — counts only (`aviasales.http.service.ts:250-252`); `search_params` carries no ages/DOB; calendar unsupported (`aviasales.adapter.ts:102-113` empty map).
- All five preserve composition in `ref.searchContext` for refresh (see §15).

## H. REQUEST TRAVELER → SUPPLIER PARAMETERS (§9)

**CONFIRMED BY CODE — the flow does not exist.**

- Backend: 0 hits for age calculation (`getAge|calcAge|ageOn|yearsBetween|birthDate` → supplier params) across `backend/src`. `RequestTraveler.birthDate` is written/read only for readiness/validation and OrderTraveler copy (`request.service.ts` `assertTravelersReadyForCommercialStep`).
- Frontend: no age-from-DOB logic (previous audit: `getAge/calculateAge` 0 hits; this audit: only `ChildAges` select 0–17, `ChildAges.tsx:11`).
- Supplier params originate exclusively from the **search form composition** (`adults/children/childAges` → `SupplierSearchQuery`), frozen into `offer.searchContext` / `Request.offerRef.searchContext` / AZAL `pinnedRequirements`.
- ⇒ If a `RequestTraveler.birthDate` differs from the search-time child age, **nothing re-derives or re-checks supplier price** (see §I, §15). Diagram:

```
Search form {adults, children, childAges[]}
   └─► SupplierSearchQuery ─► adapter mapper ─► supplier wire params   (exists)
RequestTraveler {firstName, lastName, birthDate}
   └─► readiness check / OrderTraveler copy                            (exists)
   └─► supplier params                                                  ✗ NOT PRESENT
```

## I. LIVE PRICE / REFRESH / REPRICE (§15)

| Trigger | Mechanism | Composition source | file:line |
|---|---|---|---|
| Offer search | adapter.search | client query | per supplier |
| Offer refresh (anonymous) | `POST public/supplier/refresh-price` — **client sends `searchContext`** | **client body** | `public-supplier.controller.ts:254-267` |
| Offer refresh (auth) | `POST …/supplier/refresh-price` | client body | `supplier.controller.ts:149-152` |
| Request creation recheck | `createTourRequest` → `offerService.refreshPrice` | `searchContext` rebuilt from **create-TourRequest DTO** (`childAges` `:123`) | `tour-request.service.ts:115-145` |
| Flights `/request` | fresh re-search + fare match | `body.passengers` verbatim | `azal.controller.ts:152,280-325` |
| Supplier price changed | `POST :id/propose-price` → `PRICE_CHANGED` + `supplierPriceProposal` → customer accept uses `proposal ?? snapshot.customerFinalPrice ?? displayedPrice` | supplier proposal | `request.controller.ts:274`, `request.service.ts:912-915,1125-1130` |
| **Before payment / booking** | **none found** (0 hits) | — | — |

All five tour adapters implement `refreshPrice(ref)` re-searching with `ref.searchContext` (Summer `summertour-new.adapter.ts:457`, KOMPAS `:1817`, KazUnion `kazunion.adapter.ts:390`, Anex `anex.adapter.ts:423`, Anex Hotels `:451`); cache key includes `adults/children/childAges` (`supplier-cache.service.ts:157,164`) ⇒ changed composition ⇒ cache miss ⇒ genuine re-fetch.

**Answer to §15's core question:** YES — updated parameters **can** be passed today (both refresh endpoints and the creation recheck accept `childAges` in the payload), and a changed composition produces a new authoritative supplier price. But the update must come from the **client/DTO**, not from `RequestTraveler`; and no automatic recheck is wired to DOB changes or to the accept→pay window.

## J. PRICE SOURCE BOUNDARY (§13)

- `SupplierOfferService` is the single supplier-price entry (`supplier-offer.service.ts:196-260` refreshPrice: captcha gate → cache → adapter → Gate E → pricing block → TTL evidence).
- Markup application: `SupplierPricingService.apply/applyToOffers/applyToPriceSnapshot` (`supplier-pricing.service.ts:94,181-186,191,209-220`), resolution via `resolveSafe` (`:143`) — no markup duplication (flight fares skipped when `fare.pricing` already set, `azal.controller.ts:220`).
- Public/anonymous: only `refresh-price` returns a price snapshot; no markup rules exposed; catalog `priceFrom` = min Tariff price (already public) `catalog.service.ts:489`.
- Client-supplied amounts never trusted for displayed price: Path A uses `recheck.amount` (`tour-request.service.ts:145`), Path C re-derives (`azal.controller.ts:150-152`).
- `Gate E` (`isSellableAmount`, `azal.controller.ts:26-27`; `amount>0 && currency` in supplier-offer/summer-sync) — zero/absent prices never enter the commercial chain.

## K. TRAVELHUB COMMERCIAL LAYER (§11)

- `buildWorkingSnapshot` invariants (`commercial-snapshot.ts`): `publicPrice = supplierPrice + markupAmount`; `finalPrice = publicPrice − discountAmount`; `finalPrice ≥ supplierPrice`; `supplierPrice > 0`.
- Discounts: `grantDiscount` → `applyIndividualDiscount` (`request.service.ts:968-1020`), floor at supplierPrice (`:1019-1020`); tests `request-customer-accept.spec.ts` (proposal precedence, zero/negative gates).
- `freezeForAcceptance` (`:1142`) — snapshot frozen; accept precedence `proposal ?? snapshot.customerFinalPrice ?? displayedPrice` (`:1125-1130`).
- Conversion: `convertRequestToOrder` requires `CUSTOMER_ACCEPTED` + `customerAcceptedAt` + `travelerCount`; copies `commercialSnapshot` **verbatim** to Order (`order.service.ts:637,716-717` — immutable, Gate G); `confirmedPrice/displayedPrice/pinnedRequirements/travelerCount` copied (`request.service.ts` convert block). CAS idempotency: re-convert returns existing Order; concurrent claim → 409.
- `travelerCount` sources: tours from Request readiness; flights from `passengers.adults` only (`azal.controller.ts:176`) — inconsistency (§M gap 4).

## L. FUTURE SUPPLIER CATALOG (§17)

- `Tariff` model (`schema.prisma`, catalog schema): `price Decimal(12,2)`, `validFrom/validTo`, `priceBasis`, `pricingMode`, `status` — supplier-catalog price foundation exists.
- `SummerSyncService`/`SummerBulkSyncService` already turn supplier offers into Products/Tariffs: `startingPrice`/`minPrice` = supplier min price pushed through `pricing.publicAmountFor` (`summer-sync.service.ts:395-410`) ⇒ Tariff.price is **public**, supplier amount not persisted per-tariff (audit trail = only via live offers' `pricing` block). Tariff price updated on sync (`:466-476`).
- Passenger parameters for a future supplier catalog: **none** — Tariff has no passenger composition fields; a catalog-priced supplier would price per composition supplied at search time (same mapper pattern applies). Design input: composition must remain an input to the price request, never computed by TravelHUB (§1 business rule).

## M. GAP ANALYSIS (§23)

| # | Gap | Severity | Confidence |
|---|---|---|---|
| 1 | **Summer active XHR path drops `AGE1-3`** (`summertour.request-builder.ts:138-139` vs `:110-112`) — child ages never reach Summer in search/refresh/captcha-rebuild; calendar/DOLOAD also age-less | **High** — wrong supplier price for 2+ age-different children | CONFIRMED BY CODE (price impact: OWNER-PROVIDED rule implies it) |
| 2 | **Anex Tours sends only `childAges[0]`** (`anex.adapter.ts:272`) — 2nd+ child ages lost | **High** (multi-child bookings) | CONFIRMED BY CODE |
| 3 | **Flight domain discards child ages**: frontend collects `childAges` (`FlightSearch.tsx:156`), backend `FlightSearchQuery` has no field, AZAL `childrenDatesOfBirth: null` (`azal.http.service.ts:208`) | **High** for AZAL child/infant fare rules | CONFIRMED BY CODE |
| 4 | `travelerCount = adults` for flights (`azal.controller.ts:176`) — children/infants excluded from readiness/traveler count | Medium | CONFIRMED BY CODE |
| 5 | **No `RequestTraveler.birthDate → supplier params` flow** and no age-derivation code anywhere | High (design) | CONFIRMED BY CODE |
| 6 | **No supplier price recheck between acceptance and payment/conversion** (0 hits) | High (business risk) | CONFIRMED BY CODE (by absence) |
| 7 | KOMPAS `AGE1-3` / KazUnion `AGE1-4` hard caps — >3 / >4 children ages silently dropped | Medium | CONFIRMED BY CODE (supplier caps NOT CONFIRMED) |
| 8 | `SummertourHttpService.fetchPrices` (`AGES=childAges[0]`, `summertour-http.service.ts:123-126`) and legacy `SummertourAdapter` age path are dead code — misleading for future maintainers | Low (hygiene) | CONFIRMED BY CODE |
| 9 | No per-supplier children-count limits enforced in TravelHUB (only nights 3–14 for KOMPAS) | Low | NOT CONFIRMED (absence of rules is owner's call) |

## N. CANONICAL vs MAPPER (§24 analysis)

**Supplier Passenger Parameters Mapper — already exists per adapter.** Every adapter performs the translation `SupplierSearchQuery → wire params` (§D table). Input composition `{adults, children, childAges[], infants}` is a lightweight, already-shared shape (`SupplierSearchQuery`, `FlightSearchQuery.passengers`).

**Canonical Traveler Composition (full DOB-driven engine)** — would require: DOB→age as-of logic (§19 forbids a universal engine; owner rules exist only for Summer/AZAL; KOMPAS/KazUnion/Anex/Aviasales rules **unprovided**), a DOB collection UX (frontend currently has none), and re-derivation/recheck wiring. No code exists; per §19 and the owner-rule list, a universal engine is explicitly out of scope.

**Conclusion:** the mapper suffices as the *transport* mechanism; what's missing is (a) fixing mapper bugs (gaps 1–3, 7), (b) a **single canonical composition record** (adults/children/childAges/infants + as-of date) that is (i) captured once at search, (ii) linked to RequestTraveler rows for audit, and (iii) re-used by refresh/recheck — without TravelHUB ever computing supplier prices. That is a **Hybrid (C)**: minimal canonical composition as data of record + existing per-supplier mappers + targeted fixes.

## O. TARGET ARCHITECTURE RECOMMENDATION (§24/§O)

**Recommended: Option C — Hybrid (minimal).**

1. **Canonical composition record (data only, no pricing logic):** `{adults, children, childAges[], infants, asOf}` stored once (offer.searchContext already holds it; mirror key on Request) — single source for every refresh/recheck. Explicitly NOT a price calculator and NOT a universal age engine (§19).
2. **Supplier Passenger Parameters Mapper stays per-adapter** (existing code), with targeted fixes: Summer XHR must serialize `AGE1-3`; Anex Tours must send all children ages (format per supplier contract); KOMPAS/KazUnion caps documented.
3. **Flight domain:** decide whether `childAges` enters `FlightSearchQuery` (frontend already sends it) so AZAL/Aviasales mappers can populate `childrenDatesOfBirth`/ages — owner decision (§P-2).
4. **Link `RequestTraveler` → composition for audit:** store which traveler maps to which age slot; recheck uses the composition record, not a fresh client guess.
5. **Recheck policy** (accept→pay window, DOB changes) — owner decision (§P-4), implemented via the existing `refreshPrice` boundary.

Rejection of alternatives: **A** would demand a universal age engine (§19 forbids) + DOB UX + supplier rules that owners have not provided; **B** alone leaves no record to re-check after DOB edits and no linkage for audit; **D** is contradicted by gaps 1–3 (active-path bugs) — this is not "sufficient as is".

## P. OWNER DECISIONS REQUIRED (§O/§P)

1. **Summer `AGE1-3` on the active XHR path** — confirm with Summer (or owner) that `search_tour?AGE1-3` is honored; then serialize ages in `buildSummerXhrUrl`. Until confirmed: TravelHUB sends no ages ⇒ supplier prices by count only.
2. **Flight child ages** — should the flight domain carry `childAges` (frontend already collects) and should AZAL receive real DOB (`childrenDatesOfBirth`)? Affects child/infant fare correctness (AZAL rule: <2 / 2–11 / 12+).
3. **Anex Tours `AGES` format** — confirm whether supplier accepts multiple ages (CSV) like Anex Hotels; fix `childAges[0]` truncation accordingly.
4. **Recheck policy** — is a supplier price recheck mandatory (a) after `RequestTraveler` DOB edits, (b) between `CUSTOMER_ACCEPTED` and payment/conversion? Currently neither exists.
5. **Age-slot mapping authority** — when DOB and search-time age disagree, which is authoritative for the *next* supplier request (search composition, traveler DOB, or supplier response)? This report does not choose (§1 business rule: supplier computes price).
6. **Children-count caps** — TravelHUB currently enforces none (supplier caps 3/4 silently truncate): set explicit UI/API limits or document truncation.
7. **travelerCount for flights** — include children/infants or keep adults-only (affects readiness checks and copy to OrderTraveler).
8. **Dead-code cleanup** — archive legacy `SummertourAdapter` age path and unused `SummertourHttpService.fetchPrices` (hygiene decision).

## Q. TESTS & EVIDENCE (§26)

Executed read-only (this session):

| Suite | Result |
|---|---|
| `npx jest summertour.request-builder supplier-offer.service supplier-cache.service --runInBand` | **3 suites / 29 tests PASSED** |
| `npx jest kompas.adapter anex.adapter anex-hotel.adapter kazunion.adapter aviasales --runInBand` | **7 suites / 95 tests PASSED** |
| `npx jest request-travelers tour-request azal --runInBand` | **3 suites / 55 tests PASSED** |
| **Total** | **13 suites / 179 tests PASSED, 0 failed** |

- Key code reads: `summertour.request-builder.ts:107-167`, `summertour-new.adapter.ts:847-881,442-478`, `kompas.adapter.ts:386-393,485-547,1333-1335`, `kazunion-http.service.ts:574-620`, `anex.adapter.ts:270-272,416-433`, `anex-hotel.adapter.ts:279-282`, `azal.http.service.ts:200-278`, `azal.controller.ts:147-341`, `aviasales.http.service.ts:234-252`, `supplier-offer.service.ts:26-32,196-260`, `supplier-pricing.service.ts:94-220`, `tour-request.service.ts:115-275`, `request.service.ts:968-1142,1271+`, `order.service.ts:610-720`, `summer-sync.service.ts:395-476`, `public-supplier.controller.ts:107-167,254-267`, `ChildAges.tsx`, `FlightSearch.tsx`.
- Greps: age-derivation code (backend: 0 hits), pre-payment price recheck (0 hits), `refreshPrice(` call graph (only the paths in §I), `childAges` frontend (search forms only).
- No supplier live calls, no captcha solves, no DB writes. DB SELECTs: not required for this audit's conclusions (code evidence sufficient; no data-state claim is made).
- Not confirmed items are labeled `NOT CONFIRMED BY CODE/SUPPLIER CONTRACT` — no supplier behavior was invented.

## R. GIT / SAFETY (§29)

- **Code/schema/DB/price/lifecycle changes: 0** — audit touched only this report file.
- **DB INSERT/UPDATE/DELETE/TRUNCATE: 0**; **Markups/Requests/Orders/Bookings/Offers: unchanged**.
- **Commit/push: NO** (not performed).
- Git state: branch **`master`**, HEAD **`75c6bea`** (`fix(request): keep convert action for product-less requests (Hotel Identity Fix B)`), dirty entries **156** — all pre-existing from earlier work + previous audit reports (unchanged by this session).
- Backend PID 17368 (:4000), frontend PID 9016 (:3000), MinIO PID 31216 (:19000) — running, untouched.
- Report written: `docs/prompts/TRAVELHUB_SUPPLIER_AUTHORITATIVE_PRICE_CONSISTENCY_READ_ONLY_AUDIT_REPORT.md`.
