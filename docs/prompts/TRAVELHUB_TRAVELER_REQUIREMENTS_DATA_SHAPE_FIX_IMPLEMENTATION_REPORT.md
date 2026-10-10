# TRAVELHUB — TRAVELER REQUIREMENTS DATA-SHAPE FIX
# IMPLEMENTATION REPORT (§22)

Task prompt: `docs/prompts/TRAVELHUB_TRAVELER_REQUIREMENTS_DATA_SHAPE_FIX_STRICT_IMPLEMENTATION_PROMPT.md`
Date: 2026-10-07
Execution: FIX A + §11 hardening + §15/§16 regression tests were present in the dirty worktree
from a previous session; this session VERIFIED them against the prompt (§4–§16 diffs read in
full), executed the §17/§18 soft-E2E matrix serially, classified every failure, and produced
this report. No production code was modified during this session; a temporary diagnostic
probe spec was created, run, and deleted.

---

## 22.1 Executive Verdict

```text
PASS WITH E2E BLOCKED
```

- **Fix itself: PASS.** Every fix-owned evidence item is green: producer unit tests, resolver
  tests, DTO contract tests, TypeScript, and the new §15/§16 end-to-end regression that walks
  the exact previously-blind path (public tour offer → Request → customerAccept → convert →
  Order → GET /orders/:id/travelers → PATCH travelers → validate → final-confirm → confirm →
  send → BookingRequested → Booking → Passengers) — 1/1 PASS with D3 gates asserted intact.
- **E2E qualification:** 2 of the 5 required E2E suites contain **3 pre-existing failures**
  (not caused by this fix, documented baseline — see 22.6): `order-lifecycle-completion`
  (2/32) and `booking-requested-consumer` (1/14). Both die in their own `createProduct`
  fixture on the committed Step 3.6B owner-rule (`catalog.service.ts:241-248`, commit
  `1ced16b`) before any lifecycle assertion runs. Root cause lies in **clean committed code +
  clean committed suites; zero dirty files are in the failing path** — therefore not a
  regression of this fix (§17: not "FAIL — actual regression"), and not infrastructure
  (the suites ran to completion; not "BLOCKED" by infra). The two required §18 rows
  "Order confirm/send" and "Booking consumer" cannot reach 100% green until that unrelated
  fixture conflict is fixed by its owning workstream — hence `PASS WITH E2E BLOCKED`.

---

## 22.2 Root Cause

Producer/data-shape defect (exactly as stated by the source-of-truth audit):

`TourRequestService.createTourRequest` wrote the **OFFER snapshot**
(`supplierCode/externalOfferId/hotel/room/meal/nights/adults/children/childAges/
departureDate/country/destination/departureCity/hotelExternalId`) into
`Request.pinnedRequirements`. Conversion then copied that object verbatim into
`Order.pinnedRequirements`. `TravelerCollectionPanel.fieldsFor` keeps a field only when
`(pinned[field] ?? "NOT_REQUESTED") !== "NOT_REQUESTED"` — an offer-shaped object contains
**zero** traveler-requirement keys, so **every** input field filtered out → empty traveler
form and an unreachable D3 lifecycle for tour-offer-originated Orders
(live case: TH-2026-000101 / MKT-REQ-00000402).

---

## 22.3 Files Changed

Data-shape-fix files (dirty worktree; hunks of this task only — foreign hunks preserved untouched):

| File | Why |
|---|---|
| `backend/src/modules/supplier/tour-request.service.ts` | FIX A producer: `pinnedRequirements = getEffectiveTravelerRequirements("TOUR", product?.travelerRequirements ?? null)` (pin = canonical resolver map, product-less included); offer facts frozen into `productSnapshot.offer` instead of the pin. Product lookup select extended with `travelerRequirements`. |
| `backend/src/modules/catalog/traveler-requirements.ts` | §11 optional hardening: `getPinnedRequirementsShape()` diagnostics (`"traveler_requirements" | "offer_snapshot" | "unknown"`, `OFFER_SNAPSHOT_KEYS`), no behavior change. |
| `backend/src/modules/order/request.service.ts` | §6: acceptance identity-refresh merges existing `productSnapshot` (offer facts not erased) — verified `customerAccept` writes pin **only** from the resolver (`:802-807`) and is a no-op for product-less requests (`:856-873`); §6 registry reads (`Поставщик`/`Услуга`/nights/party/country) read `productSnapshot.offer` with `pinned` legacy-row fallback (`:1271-1330`). **Mixed with foreign hunks** (Stage-1 customerAccept/Decline link removal, re-conversion 409, `Actor.id: string|null`) — preserved as-is. |
| `backend/src/modules/order/order.service.ts` | §11 diagnostics: `getPinnedRequirementsShape` import + warning log when a non-traveler-shaped pin is observed in the Order projection. **Mixed with foreign hunks** (returnToRequest action/TRANSITIONS, SecurityService/Logger wiring) — preserved as-is. |
| `backend/src/modules/supplier/tour-request.service.spec.ts` | §15 producer regression: «data-shape fix» describe — product-less pin = TOUR defaults, product override wins, no offer key leaks (`OFFER_KEYS` negative assertions), offer facts survive in `productSnapshot.offer`. **Also contains foreign §4.8 identity + Hotel Identity Fix A lookup-matrix tests** — preserved. |
| `backend/src/modules/catalog/traveler-requirements.spec.ts` | §11 shape-detector tests (canonical → `traveler_requirements`, legacy offer → `offer_snapshot`, null/empty/unrelated → `unknown`). |
| `backend/src/modules/order/request.service.dto.spec.ts` | §6 contract: canonical pin + `productSnapshot.offer` still renders supplier/service/params cells in the requests registry. |
| `backend/test/tour-offer-traveler-pin.e2e-spec.ts` | **NEW (untracked)** §15/§16 regression: full chain public tour offer → … → Booking/Passengers with D3 gate assertions; hermetic (SupplierOfferService.refreshPrice overridden). |

Not changed (by design): `frontend/components/order/TravelerCollectionPanel.tsx` (§12 — form
logic untouched; its unit suite runs against unchanged code), Prisma schema, migrations,
D3/RBAC semantics. Foreign dirty workstreams (M4 phone-first identity, Stage-1/Stage-2
Order↔Request/Booking, Hotel Identity, WhatsApp/M5, pricing docs) left untouched per §2/§10.

---

## 22.4 Data Flow Before

```text
public tour offer
  → createTourRequest
      pinnedRequirements = { supplierCode, externalOfferId, hotel, room, meal,
                             nights, adults, children, childAges, departureDate,
                             country, destination, departureCity, hotelExternalId }
      productSnapshot    = { productId, productCode, productTitle, type, … }
  → customerAccept (product-less: pin untouched — still offer-shaped)
  → convert → Order.pinnedRequirements = offer-shaped object (verbatim copy)
  → GET /orders/:id/travelers
  → TravelerCollectionPanel.fieldsFor → ZERO fields rendered (all keys unknown → NOT_REQUESTED)
  → D3 lifecycle unreachable (cannot reach COMPLETE → final-confirm → confirm → send)
```

## 22.5 Data Flow After

```text
public tour offer
  → createTourRequest
      pinnedRequirements = getEffectiveTravelerRequirements("TOUR", product.travelerRequirements)
                             = { firstName: REQUIRED, lastName: REQUIRED, birthDate: OPTIONAL,
                                 citizenship/gender/passportNumber/passportExpiry: NOT_REQUESTED }
                             (Product-level travelerRequirements override TOUR defaults;
                              productId = null still gets the canonical TOUR map — §7)
      productSnapshot.offer = { supplierCode, externalOfferId, hotel, room, meal, nights,
                                adults, children, childAges, departureDate, country,
                                destination, departureCity, hotelExternalId }   (§6 — not lost)
  → customerAccept
      product-less → pin/snapshot no-op (creation-frozen pin kept)
      product-backed → pin = resolver(...) ; productSnapshot MERGED (offer facts preserved)
  → convert → Order.pinnedRequirements = canonical TravelerFullRequirements (verbatim)
  → GET /orders/:id/travelers → firstName/lastName(/birthDate if set) rendered
  → PATCH travelers → COMPLETE → final-confirm gate → confirm → send
  → BookingRequested → Booking → Passengers   (existing D3 lifecycle, unchanged)
```

---

## 22.6 Tests

All executions serial (`--runInBand` / single vitest file), no watch/coverage/full-matrix.

### Unit + TypeScript (§17 steps 1–2, §18 rows)

| Suite | Passed | Failed | Skipped | Duration | Result |
|---|---|---|---|---|---|
| frontend `components/order/TravelerCollectionPanel.spec.tsx` (vitest) | 8 | 0 | 0 | 4.50 s | **PASS** |
| backend `tour-request.service.spec.ts` + `traveler-requirements.spec.ts` + `request.service.dto.spec.ts` (targeted) | 81 | 0 | 0 | 15.10 s | **PASS** |
| backend `npm run typecheck` (`tsc --noEmit`) | — | 0 errors | — | — | **PASS** (exit 0) |
| backend **full unit matrix** `npm test` (all 154 suites, runInBand) | 2460 | 0 | 0 | 102.53 s | **PASS** — «unrelated existing tests: no new regressions» satisfied |

### E2E (§17 steps 3–6, serial, isolated per-suite DBs)

| Suite | Passed | Failed | Skipped | Duration | Result |
|---|---|---|---|---|---|
| `tour-offer-traveler-pin.e2e-spec.ts` (**NEW §15/§16**) | 1 | 0 | 0 | 29.27 s | **PASS** — full chain incl. D3 gates, GET travelers fields, PATCH 1/2, final-confirm blocked-until-complete, exactly one Booking/Passengers |
| `d3-traveler-collection.e2e-spec.ts` | 11 | 0 | 0 | 31.78 s | **PASS** (D3 completeness/final-confirm) |
| `d3-request-flow.e2e-spec.ts` | 4 | 0 | 0 | 21.77 s | **PASS** (Request → Order propagation) |
| `order-lifecycle-completion.e2e-spec.ts` | 30 | **2** | 0 | 20.90 s | **Pre-existing fixture failure** (see below) |
| `booking-requested-consumer.e2e-spec.ts` | 13 | **1** | 0 | 10.04 s | **Pre-existing fixture failure** (see below) |
| combined 4-suite serial run (cross-check) | 58 | 3 | 0 | 71.37 s | consistent with per-suite runs |

### Failure classification (§17)

Failing tests (3): `order-lifecycle-completion` test 1 «канонический Order стартует в NEW…»
and test 29 «availability isolation…»; `booking-requested-consumer` test 1 «canonical Order →
send → … Booking» — all three die at the same line: `createProduct` fixture
`POST /api/v1/products` → **403**.

Evidence chain:

1. Response body (captured via temporary probe spec, since deleted):
   `{"statusCode":403,"message":"Commercial Product creation requires a Partner owner.
   Platform actors cannot create ownerless Products."}` — thrown by **committed**
   `catalog.service.ts:241-248` (Step 3.6B).
2. Probe also proved: admin session has **174/174** permissions including
   `catalog.product.write`; `POST /users` with the same token → 201; `GET /auth/me` → 174
   perms. So it is **not** an RBAC/permission failure — it is the domain owner-rule.
3. The rule was introduced by commit **`1ced16b`** ("Step 3.6B — Platform Create Product
   removed + server-side ownerless denial"), **291 commits after** the suites were last
   touched (`1bc19b7`/`95b6172`). Both suites and `catalog.service.ts` are **clean at HEAD**;
   no dirty file participates in the failing path (guard/controller/permissions clean or
   proven working).
4. **Documented baseline**: `SUPPLIER_MARKUP_FINAL_REPORT.md` §category C lists these exact
   suites among 33 pre-existing «403 owner-rule» failures attributed to `1ced16b`
   («neither cause nor alter it»); `M4-LIFECYCLE-VERIFICATION-REPORT.md:312` records the
   identical `order-lifecycle-completion` 2/32 failures with the same root cause.

Classification: **pre-existing at HEAD, unrelated to this fix** — not a regression caused by
the data-shape fix, not an infrastructure block. The fix-owned §18 rows are all PASS:

| §18 area | Result |
|---|---|
| TravelerCollectionPanel unit | PASS (8/8) |
| TOUR requirements resolver | PASS (incl. §11 shape tests) |
| tour-request producer | PASS |
| product-backed TOUR requirements | PASS (override test) |
| product-less TOUR requirements | PASS (defaults test) |
| Request → Order pin propagation | PASS (`tour-offer-traveler-pin` 1/1, `d3-request-flow` 4/4) |
| affected Order repair verification | **NOT EXECUTED — owner approval required** (22.8) |
| D3 completeness | PASS (`d3-traveler-collection` 11/11) |
| final-confirm | PASS (gate asserted in new e2e + d3 suite) |
| Order confirm/send | Lifecycle assertions within the suite PASS (30/32); 2 failures = pre-existing fixture 403 (22.6) |
| Booking consumer | Consumer logic PASS (13/14: re-delivery, dedup, malformed no-op, no-PII, mass-assignment); 1 failure = pre-existing fixture 403 |
| unrelated existing tests | PASS — 2460/2460 full unit matrix; E2E failures = documented baseline only |
| TypeScript | PASS |

---

## 22.7 E2E Resource Safety

```text
workers        : 1 (jest --runInBand; vitest single file)
serial/parallel: strictly serial — suites run one at a time (4-suite run also runInBand)
watch          : NOT used
coverage       : NOT used
full matrix    : NOT run (only the5 required suites + targeted/full UNIT matrix)
infra          : stable — globalSetup created test DB + template via `prisma migrate deploy` only;
                 per-suite DBs cloned from template and dropped at teardown;
                 dev backend (:4000, PID 4728) and frontend (:3000) untouched;
                 no restarts, no instability → §21 stop-conditions NOT triggered
```

---

## 22.8 Data Repair

```text
owner approval      : NO
records repaired    : 0
old values preserved: YES (no UPDATE/DELETE/TRUNCATE executed)
verification        : N/A
```

```text
NOT EXECUTED — owner approval required
```

FIX B (data repair of TH-2026-000101 / MKT-REQ-00000402) was **not** performed. Only
read-only SELECTs against `travelhub1` were run (previous audit session, read-only audit of
the live Order). Per §19 no broad migration, no reseed, no mass rewrite.

---

## 22.9 Invariants

Confirmed unchanged/not weakened:

- **D3 semantics**: untouched — completeness enum, gates, and transitions run through the
  existing code; new e2e asserts final-confirm is **blocked** until all required traveler
  data is COMPLETE, and that no confirm/send/Booking occurs before that.
- **Completeness**: no relaxation — required firstName/lastName still drive COMPLETE.
- **Final-confirm / confirm / send authority**: unchanged (asserted by new e2e + d3 +
  order-lifecycle passing lifecycle tests).
- **Booking consumer**: unchanged — inbox idempotency, one Booking per OrderItem,
  no PII in payload (13/14 consumer tests green; the 1 red is the fixture 403 above).
- **RBAC**: no permission checks weakened; permission catalog changes in worktree are
  foreign/additive (`booking.return_to_order`); probe proved admin permission set complete.
- **Schema**: no new Traveler/requirements model, **no migration added by this task**
  (dirty `schema.prisma` and untracked migrations belong to foreign M4/Stage-2 workstreams).
- **Frontend form logic** (§12): `TravelerCollectionPanel` not modified — no changes needed,
  its existing logic is correct against the corrected data contract.

---

## 22.10 Git Safety

```text
commit : NO  (no git commit executed this session)
push   : NO  (origin untouched; master ahead 15 of origin/master)
HEAD   : 75c6bea (unchanged)
staged : 0 files
remaining dirty work: 128 entries (73 modified + 55 untracked) BEFORE this report file;
                      +1 untracked after writing this report (73 M + 56 ??).
                      Includes all foreign workstreams (M4, Stage-1/2, Hotel Identity,
                      WhatsApp/M5, pricing docs) and this fix's8 files — preserved intact,
                      hunk-split policy honored (no foreign hunk added/removed/reverted).
```
