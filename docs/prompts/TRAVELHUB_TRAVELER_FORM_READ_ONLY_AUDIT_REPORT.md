# TRAVELHUB — TRAVELER DATA FORM
# STRICT READ-ONLY AUDIT REPORT

Prompt: `docs/prompts/TRAVELHUB_TRAVELER_FORM_READ_ONLY_AUDIT.md`
Date: 2026-10-07
Scope: repository trace + read-only live inspection. **No code, schema, data, tests or migrations modified. No Traveler records created/altered. No commit/push.**
Companion report: `docs/prompts/ORDER_TO_BOOKING_TRANSITION_READ_ONLY_AUDIT_REPORT.md` (same session).

---

## A. Executive Verdict

**BROKEN** (data-shape contract violation, single root cause) — specifically:

```text
Broken:       Request(tour-request) → Order.pinnedRequirements → TravelerCollectionPanel field rendering
Not broken:   the traveler data model, the PATCH API, the completeness engine, final-confirm, and the Order→Booking gate
```

- The **frontend form logic is correct** (its unit specs pass 8/8, executed live in this audit).
- The **backend API is correct and reachable** (verified live against the running server).
- The **pinned requirements snapshot for tour-offer originated Orders contains the wrong shape**: it is a *tour offer search snapshot* (`hotel/room/meal/adults/...`) instead of the *traveler-field requirements map* (`firstName: "REQUIRED", ...`) that the contract (`traveler-requirements.ts`, type `TravelerFullRequirements`) defines and both frontend and backend consumers expect. With that object, `fieldsFor` resolves to **zero fields** → the user sees traveler cards with the INCOMPLETE badge and «Финальное подтверждение», but **no inputs**. Because no REQUIRED field can ever become non-empty, `complete` can never become true on this path → **final confirmation is unreachable for every tour-offer-created Order**, hence `confirm`/`send`/Booking are unreachable (soft-locked lifecycle).

Why it happened: two different producers write the same column with two different shapes:
1. `TourRequestService.createTourRequest` (`backend/src/modules/supplier/tour-request.service.ts:211–229`) writes the offer snapshot into `Request.pinnedRequirements` **at Request creation** (product-less public supplier inquiry, `productId=null`).
2. `RequestService.customerAccept` (`backend/src/modules/order/request.service.ts:802/868–873`) — which pins the canonical traveler-requirements map at acceptance — **deliberately skips the rewrite for product-less requests** («Product-less: pin/snapshot НЕ трогаем … сохраняем замороженный при создании tour-pin»), so the offer shape survives acceptance and conversion verbatim into `Order.pinnedRequirements` (`createOrderFromRequest`, order.service.ts:717 `pinnedRequirements: r.pinnedRequirements ?? {}`).

Exact break location (frontend): `TravelerCollectionPanel.tsx:105` (`fieldsFor` useMemo) — `fieldsFor = FIELD_ORDER.filter((f) => (pinned[f] ?? "NOT_REQUESTED") !== "NOT_REQUESTED")`; the pinned object has none of the 7 traveler keys → every field maps to `NOT_REQUESTED` → empty list → no inputs rendered. Backend completeness with an offer-shaped pin computes a vacuous REQUIRED-set, but is saved from a false "complete" by the explicit `dataCompleteness` invariant re-check in `validateTravelerCompletion` (order.service.ts:1994–2001 — live: `{complete:false, reason:"2 traveler(s) have incomplete data"}`) plus the final-confirm/CAS gates. Net effect: honest block, no bypass — but also no usable form.

Wiring classification (prompt §5): **conditional-rendering defect caused by an upstream data-shape contract violation** — backend implemented ✔, frontend wiring implemented ✔, form logic implemented ✔; only the data contract between producers of `pinnedRequirements` is broken.

---

## B. Real Order — `TH-2026-000101` (verified live, READ-ONLY)

| Item | Value |
|---|---|
| id | `36e031c0-8a66-498b-9dac-b7ba89122076` |
| Order status | `IN_PROCESSING` (v6), paymentStatus UNPAID, 3232 USD |
| travelerCount | `2` (expected; two OrderTraveler rows exist, positions 1–2) |
| traveler records | both `firstName:""/lastName:""/passportNumber:null/…`, `dataCompleteness: INCOMPLETE` |
| completeness | both INCOMPLETE; `travelerDataCompletedAt: null` |
| finalConfirmedAt | `null` |
| availableActions (admin) | `["markWaitingData","cancel","problem","suspend","returnToRequest"]` — **no `confirm`, no `send`** (D3 gate engaged, correct) |
| termsAcceptedAt | `2026-10-06T19:47:06.780Z` ✅ (D3 scope active: travelerCount>0 && terms accepted) |
| linkedRequest | MKT-REQ-00000402 (CONVERTED) — created by **public tour-offer inquiry** path |
| pinnedRequirements (live verbatim) | `{"meal":"ABF","room":"Deluxe Pool View / Double","hotel":"SUGAR MARINA RESORT NAUTICAL KATA BEACH 3* (Kata)","adults":2,"nights":7,"country":"Таиланд","children":0,"childAges":[],"supplierCode":"KAZUNION","departureCity":"Baku","departureDate":"2026-10-24","externalOfferId":"37844-4105-20261024-529-53","hotelExternalId":"4105"}` |
| contract-expected shape | `{"firstName":"REQUIRED","lastName":"REQUIRED","birthDate":"OPTIONAL","citizenship":"NOT_REQUESTED","gender":"NOT_REQUESTED","passportNumber":"NOT_REQUESTED","passportExpiry":"NOT_REQUESTED"}` (= `DEFAULTS_TOUR`, traveler-requirements.ts) |
| POST /validate-completion (live; read-only outcome by design when incomplete) | `{complete:false, reason:"2 traveler(s) have incomplete data"}` |

Visible traveler controls (panel behavior with this data): section «ДАННЫЕ ТУРИСТОВ» renders; two cards «Турист 1 из 2 / Турист 2 из 2» with amber INCOMPLETE badges; **zero input fields**; per-card Save button present but sends `{}`; «Финальное подтверждение» button present (would fail server-side); no locked banner (not final-confirmed); no permission banner for admin/operator.

---

## C. Frontend Trace

```text
frontend/app/app/orders/[id]/page.tsx
  └─ EntitySectionCard «Данные туристов» → <TravelerCollectionPanel orderId={id}/>
      TravelerCollectionPanel.tsx
        ├─ load(): GET /orders/{orderId}/travelers → view.travelers + view.pinnedRequirements (verbatim)
        ├─ pinned = view?.pinnedRequirements ?? null   → offer-shaped object (not null!)
        ├─ fieldsFor = FIELD_ORDER.filter(f => (pinned[f] ?? "NOT_REQUESTED") !== "NOT_REQUESTED")
        │     FIELD_ORDER = firstName..passportExpiry; pinned keys = meal/room/hotel/...
        │     ⇒ every lookup undefined → "NOT_REQUESTED" → filtered
        │     ⇒ fieldsFor = []                          ← EXACT BREAK
        ├─ traveler card: badge(complete?) + {fieldsFor.map(<input>)} → 0 inputs
        │     inputs would be: <input type=text|date disabled={locked || !canEdit}>
        ├─ Save per traveler: PATCH /orders/{id}/travelers/{tid} with fieldsFor-only body → {} 
        │     then load() refetch (server-supported resume)
        └─ Финальное подтверждение → POST /orders/{id}/validate-completion
              → only on complete:true → POST /orders/{id}/final-confirm
```

Prompt §1 classification: **(B) fields are hidden by condition** — the condition is the `pinnedRequirements` shape; contributing upstream cause (E): required configuration data (a traveler-requirements map) is absent for this Order because the producer stored a different dataset in the same field. NOT (A): the filter/map code is correct given a correct pin; NOT (C): inputs are absent, not disabled (disabling exists for `locked/cantEdit` and works per spec); NOT (D): independent of Order status; NOT (F): wiring exists (§E evidence); NOT (G): no alternate form component exists (`TravelerCollectionPanel` is the only traveler UI; referenced from Order detail page).

Edit-gating conditions (verified, not the cause): `locked = Boolean(view.finalConfirmedAt)` disables inputs/Save/final-confirm + shows `d3.locked`; `useCan("order.edit_noncritical")` false → inputs disabled + amber `d3.need_edit_permission`; `!pinned` → grey `d3.legacy_no_pinned` plate; `travelers.length===0` → `d3.no_travelers` plate.

---

## D. Backend Trace

```text
Traveler MODEL: OrderTraveler (backend/prisma/schema.prisma:2294)
  orderId FK-cascade · customerId String? (provenance only, not a data source) ·
  position Int (1..N, stable ordering) · firstName/lastName String ("" allowed) ·
  birthDate/citizenship/gender/passportNumber/passportExpiry nullable ·
  dataCompleteness INCOMPLETE|COMPLETE · version.
  Cross-entity: per OrderItem *no* traveler link (order-scoped); Booking → Passenger
  rows created from COMPLETE travelers at Booking creation (booking.subscribers.ts).

Read projection:   GET /orders/:id/travelers → getPinnedRequirements (order.service.ts:1719)
  returns pinnedRequirements VERBATIM from order.Order.pinnedRequirements
  (no shape interpretation) + PII redaction per viewer (Step 1.17).

Single save:       PATCH /api/v1/orders/:id/travelers/:travelerId (order.controller.ts)
  DTO TravelerCollectDto: 7 fields @IsOptional @IsString (partial saves fine)
  RBAC @RequirePermissions("order.edit_noncritical")
  assertNoForbiddenKeys(body, ORDER_TRAVELERS_FORBIDDEN_KEYS) → forged server-owned
    keys (id/dataCompleteness/version/pinnedRequirements/…) → 422
  → OrderService.updateTravelerD3 (order.service.ts:1790–1930):
     404 unknown order/traveler; 404 storefront-tenant (PARTNER_STOREFRONT);
     422 before termsAcceptedAt; 409 after finalConfirmedAt;
     pinned null → 422 (D3 collector requires snapshot);
     per field: unknown keys skipped; NOT_REQUESTED stripped; REQUIRED empty-clear→422;
       dates strictly YYYY-MM-DD (isDateOnly) else 422;
     merge(existing,new) → computeTravelerCompleteness(pinned, merged) → save, version++,
       OrderHistory «update_traveler_d3» + field-level PII-safe audit diff.

Bulk save:         PATCH /orders/:id/travelers → updateTravelers (order.service.ts:1309)
  same guards + row-lock; legacy no-pinned fallback completeness = passportNumber.

Completeness engine: private computeTravelerCompleteness (order.service.ts:1293)
  REQUIRED per pinned (or legacy passportNumber rule); called on every save path.

Validation gate: POST /orders/:id/validate-completion (order.read) → validateTravelerCompletion (:1940)
  complete ⇔ termsAcceptedAt + pinned exists + count satisfied + all REQUIRED non-empty
  + all dataCompleteness COMPLETE ⇒ sets travelerDataCompletedAt (server-owned, immutable).

Final gate:        POST /orders/:id/final-confirm (order.edit_noncritical) → finalConfirm (:2026)
  same prerequisites; duplicate/confcurrent → 409; SELECT…FOR UPDATE row-lock + CAS
  (finalConfirmedAt IS NULL); sets finalConfirmedAt; traveler data immutable thereafter.
```

---

## E. Exact Required Fields

Canonical catalog (`traveler-requirements.ts` — code, not travel-practice): exactly 7 fields — `firstName, lastName, birthDate, citizenship, gender, passportNumber, passportExpiry` (`TRAVELER_FIELDS`; models match; no invented fields). Requirement states `REQUIRED | OPTIONAL | NOT_REQUESTED` resolved per ProductType (`PRODUCT_TYPE_DEFAULTS`): TOUR → firstName+lastName REQUIRED, birthDate OPTIONAL, others NOT_REQUESTED; FLIGHT → the strictest set (birthDate, citizenship, passportNumber, passportExpiry REQUIRED); SANATORIUM/HOTEL/TRAIN/EXCURSION/GUIDE/TRANSFER/PHOTOGRAPHER each have deterministic defaults. Product-level `travelerRequirements` JSON overrides on top of defaults (`getEffectiveTravelerRequirements`), validated (`validateTravelerRequirements` — unknown field/state → error).

Layer distinction from code:
- **UI-required**: REQUIRED per pinned (asterisk `d3.field.*` labels; OPTIONAL shown with "(Опционально)"; NOT_REQUESTED never rendered).
- **DTO-required**: none (all `@IsOptional` — enables partial/resume saves).
- **completeness-required**: REQUIRED-per-pinned per traveler — enforced by `updateTravelerD3` (clear-forbidden), `validateTravelerCompletion`, `finalConfirm`, and orderAction `confirm` (any traveler ≠ COMPLETE → 422).
- **supplier-required**: none in code — Passenger creation copies verbatim from COMPLETE travelers (`booking.subscribers.ts`); supplier resolution is a later, manual Booking-lifecycle concern (see companion report §I).

Date fields additionally format-checked (`YYYY-MM-DD`) at save.

---

## F. State/Permission Matrix (actual backend behavior)

| Order Status | Traveler UI Editable | API Update Allowed (PATCH :tid / bulk) | Completeness Can Change |
|---|---|---|---|
| NEW (D3-scope, terms NOT yet accepted) | — | **NO → 422** («traveler submission before acceptance») | NO |
| NEW → IN_PROCESSING → WAITING_FOR_DATA → READY_FOR_BOOKING → SENT_TO_BOOKING → PARTIALLY_FULFILLED → PROBLEM / SUSPENDED (terms accepted, finalConfirmedAt null) | **YES** | **YES** | **YES** |
| ANY, after finalConfirmedAt | NO — inputs disabled + `d3.locked` banner | **NO → 409** (guarded twice: fast-path + row-lock inside tx) | **NO — frozen** |
| ANY, pinnedRequirements = null (legacy) | `d3.legacy_no_pinned` plate, no form | **NO → 422** (single path; bulk legacy rule: passportNumber-completeness fallback only in bulk branch) | D3 path: NO |
| PARTNER_STOREFRONT-tenant Order | (ETF) | **NO → 404** (platform-scope denial) | NO |

Permissions: per-traveler PATCH, bulk PATCH and final-confirm → `order.edit_noncritical` (ADMIN=ALL, OPERATOR ✓ — DB-verified grant; BUYER/PARTNER/SALES_MANAGER/MODERATOR lack it → 403 both API and UI projection); `validate-completion` → `order.read`. UI editability additionally mirrored client-side (`locked`, `canEdit`).

Order status is not changed by traveler edits (traveler mutation touches only `order.*Traveler` + OrderHistory) — the lifecycle coupling is one-directional: `confirm`/`send` remain rejected until final-confirm (D3 hard gate, order.service.ts:1483–1490, projection :189–190).

---

## G. Order → Booking dependency (gates intact — NOT bypassed)

```text
Traveler data saved (PATCH per-traveler, partial OK)
→ REQUIRED fields per pinned non-empty ⇒ dataCompleteness → COMPLETE (server-computed)
→ POST /orders/:id/validate-completion → travelerDataCompletedAt (immutable instant)
→ POST /orders/:id/final-confirm      → finalConfirmedAt (CAS + row-lock; duplicate → 409)
→ PATCH /orders/:id {action:"confirm"} → READY_FOR_BOOKING + OrderReadyForBooking
→ PATCH /orders/:id {action:"send"}    → SENT_TO_BOOKING + BOOKING REQUESTED event (PII-minimal payload)
→ BookingRequested consumer (booking.subscribers.ts) → Booking per free OrderItem
    (status NEW, BKG-*, frozen money/service/acquisition facts)
→ Passenger rows from COMPLETE OrderTravelers (readyTravelers filter; verbatim fields)
```

Data dependency separation (prompt §12):
- required to **save** a traveler: termsAcceptedAt + pinned ≠ null (+ per-field format/NOT_REQUESTED rules). No payment, no supplier, no status condition beyond storefront-scope denial.
- required to **mark COMPLETE**: all REQUIRED-per-pinned values for that traveler (computed server-side on save).
- required for **final confirmation**: completion across all travelers (count satisfied + every traveler COMPLETE via invariant) — no payment requirement.
- required for **Order Confirm**: finalConfirmedAt + all travelers COMPLETE + status from-list `{IN_PROCESSING, WAITING_FOR_DATA}` + `order.edit_noncritical`.
- required to **Send**: status from-list `{READY_FOR_BOOKING, PARTIALLY_FULFILLED}` + `order.request_booking` + ≥1 free OrderItem (no occupying booking; legacy-active-booking → conservative 409). No payment requirement (UNPAID is legal — verified live and in tests).
- required **by supplier**: nothing at Booking creation (internal record; supplier processing is the later manual `prepare/send/confirm` Booking lifecycle; see companion report §I).

Post-final-confirm traveler change → all mutation paths 409 (validate-completion remains readable; final-confirm duplicate → 409). Reversibility: none for final-confirm; Order-level rollback (`returnToRequest`) remains available until bookings/payments exist.

---

## H. Test Evidence

| Suite | Covers | Verdict |
|---|---|---|
| `frontend/components/order/TravelerCollectionPanel.spec.tsx` (8 tests) | REQ/OPT/NOT_REQUESTED rendering, 2-traveler cards + «Турист 1 из 2», PATCH-per-traveler + refetch, final-confirm failure (server complete:false) & success, post-final-confirm locked inputs, legacy plate, RU/AZ/EN labels | **PASS — executed live in this audit** (vitest run: 8/8, ~27 s). Caveat: all fixtures seed a *traveler-shaped* pin → the offer-shape defect is invisible to this suite |
| `backend/test/d3-traveler-collection.e2e-spec.ts` (12 tests) | PIN from checkout; product-policy immutability; NOT_REQUESTED wipe; multi-traveler final-confirm denial→success (ends Booking+Passenger); concurrent final-confirm; role 403s (BUYER/PARTNER/SALES_MANAGER); legacy 422; Booking blocked pre-final-confirm; duplicate final-confirm 409; per-order booking filter | **NOT RUN** (test-DB writes violate audit's read-only rule); coverage assessed adequate from spec content; also uses traveler-shaped pins — blind to the found defect |
| `backend/test/d3-request-flow.e2e-spec.ts` | acceptance pinning + conversion chain incl. traveler snapshots | **NOT RUN** |
| `backend/test/order-lifecycle-completion.e2e-spec.ts` #5–#11 | completeness-gated confirm; send-only-from-READY; BookingRequested→consumer | **NOT RUN** |
| unit spec for `traveler-requirements.ts` alone | defaults/override resolution | **NOT AVAILABLE** (no standalone file found; covered indirectly) |

Explicit answer to prompt's caution: yes — no existing test proves a *human* can fill the UI for a **tour-offer-originated** Order; that path is untested and is exactly where the defect lives.

---

## I. Gap Matrix

| Gap | Severity | Current | Target | Evidence |
|---|---|---|---|---|
| Traveler form | **P0** (lifecycle blocked for the tour-offer Order origin) | zero inputs rendered (fieldsFor empty) for offer-shaped pins | fields render per canonical traveler-requirements map | `TravelerCollectionPanel.tsx` fieldsFor; live pinnedRequirements (§B); panel spec passes only with correct shape |
| Traveler fields | **P0** (same root cause) | `Order.pinnedRequirements` = offer snapshot (hotel/room/meal/adults/…) | `TravelerFullRequirements` map | tour-request.service.ts:211–229 vs traveler-requirements.ts contract; live GET travelers |
| Edit mode | — correct | locked/canEdit/legacy gating works | keep | panel code + vitest PASS |
| Save wiring | — correct (no-op with degenerate pin) | panel → PATCH :tid per traveler + refetch/resume works | keep (post-fix it becomes meaningful) | panel spec PASS; controller/service code |
| API | — correct | PATCH single+bulk, validate-completion, final-confirm all live; anti-tamper 422; row-lock immutability | keep | order.controller/service; live server responses |
| Completeness | P2 | with offer-shaped pin the per-pinned REQUIRED set is vacuous; explicit `dataCompleteness` invariant prevents a false "complete" | pin shape respected at every consumer | order.service.ts:1293 vs 1994–2001 (live output) |
| Final confirmation | — correct mechanics (unreachable only downstream of the P0) | CAS + row-lock + immutability verified | keep | order.service.ts:2026; d3 e2e spec content |
| Order → Booking | — correct | D3 gate + confirm/send gates + consumer intact; Passenger copies COMPLETE travelers | keep | order.service.ts:1483–1526; booking.subscribers.ts |

---

## J. Minimal Safe Implementation Scope (describe only — NOT implemented)

Principle: **keep the existing lifecycle, models, APIs, and the panel; repair the producer of one JSON column.** No parallel traveler system, no Order redesign, no schema migration required (columns already `Json?`).

1. **Single code fix** — `TourRequestService.createTourRequest` (backend/src/modules/supplier/tour-request.service.ts:211–229): stop overloading `Request.pinnedRequirements` with the offer snapshot.
   - Relocate the offer/search facts currently in the pin (`supplierCode, externalOfferId, hotel, hotelExternalId, departureDate, nights, adults, children, childAges, room, meal, destination, departureCity, country`) to an already-JSON location — e.g. merge into `productSnapshot`/`commercialSnapshot` payload, preserving auditability.
   - Write `pinnedRequirements = getEffectiveTravelerRequirements("TOUR", product?.travelerRequirements ?? null)` — i.e. the canonical map, applying the Product override when the offer resolves to a Catalog Product (the existing supplier-scoped product lookup at :154–188 already produces `productId` when it matches; `travelerRequirements` must be added to that select).
2. **Data repair for the broken real Order (owner-approved, after the code fix)** — replace `pinnedRequirements` JSON for `TH-2026-000101` (and its upstream Request MKT-REQ-00000402) with the canonical TOUR map; retain the old JSON in the history record before overwrite. Then the existing flow self-completes with zero new code: fields appear → staff fills Имя/Фамилия (REQUIRED) → Save per traveler → both COMPLETE → validate-completion → «Финальное подтверждение» → «Готов к бронированию» → «Передать в Booking» → Booking + Passengers.
3. **Optional hardening (P2, small)** — detect shape mismatch server-side in `getPinnedRequirements` (and/or client-side `fieldsFor`): if pinned contains domain keys like `externalOfferId`/`hotel` and no traveler keys, return a distinct `pinnedShape:"offer_snapshot"`/render a loud warning instead of a silently empty form; optionally 422 on final-confirm/convert for such Orders. Turns future regressions into visible errors.
4. **Test gap closure** — one new unit/e2e asserting the createTourRequest → accept → convert → GET /orders/:id/travelers pipeline yields a traveler-shaped pin (the currently blind spot).

Explicitly NOT in scope: changing Order/Booking models or events, the D3 gate semantics, `computeAvailableOrderActions`, the panel's edit-gating logic, RBAC grants, or inventing new traveler fields.

---

## K. Regression Plan

After implementing (1)+(2):
1. `npx vitest run components/order/TravelerCollectionPanel.spec.tsx` — currently verified **8/8 PASS** pre-change (this audit); must remain green.
2. New unit test: `getEffectiveTravelerRequirements("TOUR", null)` = DEFAULTS_TOUR map; tour-request pin assertion.
3. Backend e2e (existing, in order): `d3-traveler-collection` → `d3-request-flow` → `order-lifecycle-completion` → `booking-requested-consumer`.
4. New e2e: tour-offer origin end-to-end (createTourRequest → customerAccept → convert → fill travelers → final-confirm → confirm → send → Booking/Passenger created) — closes the UI-path blindness.
5. Read-only re-verification of `TH-2026-000101` after data repair: GET travelers returns map shape; per-traveler PATCH flips completeness; validate-completion `complete:true`; availableActions progressively gains `confirm` → `send`; send produces exactly one Booking with 2 Passengers.

Invariants to preserve (assert in review): 7-field catalog only; NOT_REQUESTED never persisted; REQUIRED-clear → 422; final-confirm irreversible; PII redaction by role on GET travelers; BookingRequested stays PII-minimal; booking consumer is the only Booking creator; `assertNoForbiddenKeys` contract unchanged; CAS/inbox idempotency unchanged.

---

## L. Final Verdict

**WHAT EXISTS** (and works — do not rebuild): OrderTraveler model + PII-redacted projections; per-traveler partial PATCH + bulk PATCH with anti-tamper and row-locked immutability; `computeTravelerCompleteness`; `validate-completion`; `final-confirm` (CAS + row-lock); the canonical 7-field catalog with per-ProductType defaults; TravelerCollectionPanel with correct card/badge/save/final-confirm logic (unit-proven); the D3 gate chain final-confirm → confirm → send → BookingRequested → Booking(+Passenger); server-authoritative availableActions.

**WHAT DOES NOT WORK**: for Orders created from public tour-offer Requests (e.g. `TH-2026-000101`), `pinnedRequirements` holds a tour-offer snapshot instead of a traveler-requirements map → the panel renders **no inputs**; `validate-completion` can never return `complete:true`; final-confirm/confirm/send never become available → Booking unreachable. A full lifecycle block for this Order origin (P0), while all other Paths (catalog-product checkout Orders) work.

**WHY THE USER CANNOT ENTER TRAVELER DATA**: not a missing component, not disabled controls, not a missing API, not a permission failure — `fieldsFor` filters `FIELD_ORDER` against an object whose keys are `meal/room/hotel/adults/...`; every lookup yields `NOT_REQUESTED` → empty field list → nothing rendered. (Live evidence: the verbatim pinned JSON in §B.)

**WHAT MUST CHANGE**: the producer `TourRequestService.createTourRequest` — store the offer snapshot outside `pinnedRequirements` and pin the canonical `getEffectiveTravelerRequirements("TOUR", …)` map; plus a one-row JSON data repair for `TH-2026-000101` (and its Request) with owner approval; optional loud-shape-mismatch guard; one regression test for the tour-offer path.

**WHAT MUST NOT CHANGE**: the 7-field canonical model and models; per-traveler partial PATCH contract (422 anti-tamper, partial save/resume); completeness formula (REQUIRED per pinned + `dataCompleteness` invariant); final-confirm irreversibility (CAS + row-lock); the D3 gate semantics (they are what protects the lifecycle — bypassing them is explicitly forbidden by the prompt); the panel's rendering logic (correct given a correct pin); server-authoritative `availableActions`; Booking consumer as the single creation authority.

---

## Final safety checklist

```text
Production code changed: NO
Frontend changed: NO
Backend changed: NO
Schema changed: NO
Database data changed: NO   (GET/list API calls + SELECT-only SQL; validate-completion POST returned complete:false — mutates nothing by design when incomplete)
Tests changed: NO           (one vitest suite was EXECUTED; no file modified)
Migration created: NO
Traveler data changed: NO   (no PATCH/final-confirm calls issued on any Order)
Commit created: NO
Push performed: NO
```
