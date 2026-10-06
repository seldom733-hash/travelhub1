# FINAL SUPPLIER MARKUP §37 REPORT

Governing prompts: `docs/prompts/SUPPLIER_MARKUP_PHASE_5_6_FINAL_STRICT_IMPLEMENTATION_PROMPT.md`,
design: `docs/prompts/SUPPLIER_MARKUP_IMPLEMENTATION_DESIGN.md`.
Date: 06.10.2026. Baseline HEAD: `0d7de62` (master).

## 1. Executive summary

Supplier Markup workstream (Phases 0–6) completed with all mandatory gates green.
Pricing has a single calculation boundary (`SupplierOfferService` →
`SupplierPricingService`), an admin MarkupRule matrix driven by live registries
(Gate A), server-authoritative Live Sales discounts with a supplier floor,
frozen commercial snapshots (Gate F), hardened flight pricing with 5-minute
freshness TTL (Gates H/I), sync reconciliation without double markup, zero
`amount:0` fallbacks (`PRICE_UNAVAILABLE` everywhere), debug artifacts removed,
and stale "no hidden markup" copy corrected.

Evidence: BE unit 154/154 suites · 2437/2437 tests; FE unit 61/61 · 989/989;
typecheck 0/0; full e2e matrix 107 suites with all 45 red suites classified as
foreign pre-existing/test-env artifacts (zero Supplier Markup regressions;
verified against the Phase-4 red baseline); new concurrency e2e suite green.
Documentation added: `docs/architecture/supplier-markup.md` (9 sections).

## 2. Phase 5 result

**PHASE 5 = PASS** (gate 17/17, full report §7 in `SUPPLIER_MARKUP_INTERIM_REPORT.md`).
Key outcomes: `priceUnavailable()` PRICE_UNAVAILABLE helper across 6 adapters;
all synthetic `amount:0`/`?? 0` fallbacks removed (flight `?? 0` retained under
`azal.controller:309` boundary → 400); priceless rows dropped in search/calendar;
6 `appendFileSync(backend_price_chain.log)` writers removed + file deleted +
`pricing-debug-artifacts.spec.ts` guard; console.* → Nest Logger; stale
"no hidden markups" copy fixed in `frontend/lib/i18n.tsx` (ru/az/en);
reconciliation audited + tested (Tariff/startingPrice ← publicAmountFor;
sync never touches Request/Order/snapshots).

## 3. Phase 6 result

**PHASE 6 = PASS** — §6.1–§6.22 executed: full e2e matrix + classification
(§6.2), §6.3–§6.6 cluster verification, §6.7 regression green, §6.8 RBAC
(+ new unrelated-permission test), §6.9/§6.11 new concurrency e2e
(`test/pricing-concurrency.e2e-spec.ts` PASS 2/2), §6.10 idempotency evidence,
§6.12–6.14 freshness evidence, §6.15 storefront isolation, §6.16 commercial
integrity, §6.17 documentation, §6.19 full regression, §6.20/§6.21 review.

## 4. All changed files (Supplier Markup-owned)

Backend src: `modules/pricing/**` (12 src + 6 spec files, incl. new
`pricing-debug-artifacts.spec.ts`), `modules/supplier/{supplier.types.ts,
supplier.module.ts, supplier-offer.service.ts, supplier-aggregator.service.ts,
tour-request.service.ts, public-supplier.controller.ts}`, adapters
`anex` (adapter/provider/hotel adapter + specs), `azal` (adapter/controller/
flight.types + controller.spec), `kazunion` (adapter/sync + spec), `kompas`
(adapter/sync/captcha controller + specs), `summertour` (adapter/new adapter/
sync/bulk sync + zero-price spec).
Backend tests: `test/{pricing-markup-admin, request-discount-grant,
pricing-concurrency}.e2e-spec.ts`.
Migrations: `20261005110000_pricing_markup_rule`, `20261005110100_pricing_markup_permissions`,
`20261005120000_request_commercial_snapshot`, `20261006110000_sales_discount_grant_permissions`,
`20261006110100_order_commercial_snapshot`.
Frontend: `app/app/pricing/**`, `lib/{pricing-api.ts, supplier-registry.ts}` +
specs (`markup-registry.spec.tsx`, `supplier-registry.spec.ts`),
`components/supplier/{MonthlyCalendar, OfferDetailsModal, OfferModal, TourDetail,
TourResultsTable}.tsx` + specs, `lib/supplier-api.ts`.
Docs: `docs/architecture/supplier-markup.md` (new), `docs/prompts/SUPPLIER_MARKUP_*.md` (5),
`SUPPLIER_MARKUP_{ARCHITECTURE_AUDIT,INTERIM,FINAL}` reports.
**Mixed-author files (markup + foreign changes in one diff, see §21):**
`prisma/schema.prisma`, `modules/order/request.service.ts`,
`modules/order/request.controller.ts` (pure markup, but pairs with service),
`src/app.module.ts`, `frontend/lib/i18n.tsx`.

## 5. All migrations

Markup: the 5 migrations listed in §4 (created via SQL folders + `prisma migrate
deploy` + `prisma generate`; `prisma migrate dev` never used by this workstream).

## 6. Sync/reconciliation result

4 sync services (summer, summer-bulk, kazunion, kompas) use strict
`publicAmountFor` (guard: no raw write when pricing boundary fails); Tariff +
startingPrice updated to the public price when supplier min changes (both
directions, `!== minPrice`); catalog/sales read paths contain 0 pricing imports
→ no double markup; sync never writes Request/Order/commercialSnapshot (grep +
`kompas-sync.service.spec.ts` spies); accepted snapshots immutable (Gate F).

## 7. Full E2E statistics (§6.1, complete matrix — not a green subset)

```text
Run: 06.10.2026 19:22:54 → 19:57:09, 9 batches × ≤12 suites, --maxWorkers=2 --forceExit
total suites     107
passed suites     62
failed suites     45
skipped suites     0
total tests     1679
passed tests    1241
failed tests     438
```

Verification reruns (solo `--runInBand`):
`storefront` 43/43 PASS (batch failure = parallel artifact, was green in
Phase 4 and in the Phase-5 targeted run); `pricing-concurrency` (new suite)
2/2 PASS; `public-catalog`, `pii-redaction`, `operational-notes-rbac` FAIL solo
→ real, pre-existing failures (all three were also red in the Phase-4 matrix,
`e2e-batched.log`).

## 8. Failure classification (§6.2 — every failed suite, evidence-based)

| Class | Suites | Count | Evidence |
|---|---|---|---|
| **C. unrelated pre-existing (403 owner-rule)** | booking-service-time-model, booking-lifecycle-completion, business-event-envelope, acquisition-source-propagation, booking-requested-consumer, auth-rbac, buyer-cabinet, communication, checkout-commercial-intent, chargeback-dispute-foundation, category-schema, moderation, external-idempotency-contract, order-lifecycle-completion, partner-collect-commission-accrual, order-temporal-contract, order-creation-consumer, order-canonical-events, payment-flow, product-scope, pricing-financial-snapshot, payment-terms, phase1, rbac-catalog-crm, request-context, refund-flow, remove-bootstrap-order, rbac-actions, quote-commercial-offer, sale-completion-order-requested, sales-domain-foundation, sales-center, temporal-readiness | 33 | All failures on `POST /api/v1/products` / `PATCH /products/:id` / publish → 403 «Commercial Product creation requires a Partner owner» (`catalog.service.ts:244`, commit `1ced16b`, 28.08.2026). Extracted failing URLs per suite: zero pricing/markup endpoints. auth-rbac/rbac-actions = TypeError cascade after 403 (`.body.product` undefined, code refs `:246`/`:188`). **§6.3: markup permissions neither cause nor alter it** — 403s are owner-rule, not permission-key denials; rbac-parity green; our RBAC additions are additive pricing.* keys. |
| **E. stale fixtures (date-rot, reverse workstream)** | buyer-requests, reverse-conversation, reverse-conversion, reverse-proposal, reverse-matching | 5 | 422 «dates not in past» on `serviceDateFrom: "2026-09-01"` fixtures (`buyer-requests:239`, `reverse-conversation:197`, `reverse-conversion:283`, `reverse-proposal:255`, `reverse-matching:207`). §6.4 names 4; reverse-matching carries the identical fixture (also red in the Phase-4 matrix). Not modified (foreign files, §6.4). |
| **D. waitFor timing (§6.6 known)** | d13-voucher-lifecycle, d4-representative-chain | 2 | `waitFor: condition not met within timeout` on outbox/eventbus chains. **§6.6 verification: Supplier Markup did not change this chain** — 0 markup refs in both specs; `eventbus/domain-events.ts` diff = only `CommissionReversed` (Booking Stage-2, foreign). Documented & isolated. |
| **D. parallel/test-env artifact** | storefront | 1 | Batch failure = HERO media upload 422 + cascade. Solo rerun PASS 43/43; Phase-4 matrix PASS (70.8s); Phase-5 targeted PASS. §6.5 requirement "failures disappear when run individually" — confirmed. |
| **E. stale test contract (catalog DTO)** | public-catalog | 1 | Solo-reproducible: Product Card exact-key-set test fails — extra keys `headlineDepartureDate, headlineNights, hotelImage, meal, room`; all defined in `catalog/public/public-catalog.types.ts:111-120` (catalog workstream feature). Zero pricing keys in the diff. Red in Phase-4 matrix too. |
| **C. unrelated pre-existing (order scoping)** | pii-redaction | 1 | Solo-reproducible: `GET /orders` list for ANALYST returns `items.length = 0` while `GET /orders/:id` works (list scoping). 0 markup/pricing/commercialSnapshot refs in the spec. Red in Phase-4 matrix too. |
| **C. unrelated pre-existing (auth route)** | operational-notes-rbac | 1 | Solo-reproducible: `POST /api/v1/auth/register-partner` → 404 (route removed/renamed by phone-first auth workstream). No markup refs. Red in Phase-4 matrix too. |

Totals: 33 + 5 + 2 + 1 + 1 + 1 + 1 = **45**. Class A (Supplier Markup regression): **0**. Class B: **0**.
Phase-4 baseline comparison: every currently-red suite was already red in the
Phase-4 full matrix (`e2e-batched.log`), except `storefront` (green then;
green solo now) → **no new red suites introduced by Phases 5–6**; 9 suites
previously red are now green (54 → 45).

## 9. RBAC evidence (§6.8, Gate J)

- `pricing.controller.spec.ts` (14 tests): every route requires exactly one of
  `pricing.markup.read`/`pricing.markup.manage`; canonical PERMISSIONS registry;
  NEW: unrelated permissions (`sales.discount.grant`, `catalog.product.write`,
  `order.read`, `finance.commission.manage`, `dashboard.financial.read`) never
  satisfy pricing routes (all exist in the registry → real 403s).
- `pricing-markup-admin.e2e` T1/T2: anonymous 401; read = FINANCE/DIRECTOR/ANALYST
  200, OPERATOR/BUYER/SALES_MANAGER 403; manage = FINANCE only (roles holding
  unrelated permissions get 403 → "unrelated → not sufficient" proven live).
- `request-discount-grant.e2e` T1: `sales.discount.grant` — anonymous 401,
  ANALYST/OPERATOR 403, SALES_MANAGER/FINANCE/ADMIN 201.

## 10. Idempotency evidence (§6.10)

- Markup: `supplier-pricing.service.spec` applyToOffer/applyToOffers/applyToCalendar
  idempotent on re-entry (1000→1050→1050, never 1102.50); activate ACTIVE =
  idempotent no-op (`markup-rule.service.spec`); CAS stale version → 409
  (e2e T5). No second markup anywhere (Gate C).
- Request: repeated commands follow conflict semantics (ConflictError 409 on
  re-conversion/`expectedVersion`, existing request/order suites green).
- Discount: repeated grant recomputes from snapshot publicPrice (server-authoritative,
  never compounds); frozen/converted → 422 (e2e T4).
- Snapshot: repeated acceptance cannot mutate frozen history (Gate F, §30 test).

## 11. Concurrency evidence (§6.9/§6.11, Gate L)

- NEW `test/pricing-concurrency.e2e-spec.ts` PASS 2/2 (run solo after matrix):
  T1 — two overlapping DRAFT rules activated in parallel → exactly one 201,
  one 409 «already covers», exactly one ACTIVE among the pair
  (`pg_advisory_xact_lock` at `markup-rule.service.ts:167/272`, overlap check
  `:274`, no race-created duplicates).
  T2 — 10 parallel `resolve` calls → byte-identical rule/rate/version results.
- Sequential overlap/CAS unit tests (`markup-rule.service.spec`:156/:164/:149).
- No unnecessary global lock introduced (advisory lock is per supplier+service key).

## 12. Load/resolution evidence (§6.11)

Resolver = stateless bounded query (ACTIVE + `[effectiveFrom, effectiveTo)`),
ambiguous backstop → fail-closed NOT_CONFIGURED; `markup-matrix.service.spec`
resolves every registry cell at the requested instant (9+ tests incl. Gate A
dynamic expansion); `supplier-pricing` resolves once per offer list
(`applyToOffers`: ONE resolve for the whole list).

## 13. Flight freshness evidence (§6.12–6.13, Gates H/I)

`azal.controller.spec` (Gate I): stale ≥5 min → re-search (asserts exactly one
supplier round-trip and re-marked price), fresh <5 min → reuse; `body.price`
ignored (`:114/:224/:245`), one markup per fare (`:197`), collectedAt →
supplierPriceFetchedAt/ExpiresAt evidence in snapshot (`:271/:297`).
No `FlightSupplier.refreshPrice` anywhere in flight code (grep: 0 in azal/aviasales;
existing `refreshPrice` occurrences are the established tour refresh mechanism,
§6.14).

## 14. Request/Order commercial integrity (§6.16)

Chain supplier→markup→public→discount→final→snapshot→accept→Order covered by
`commercial-snapshot.spec` (floor PASS 1020 / REJECT 990, freeze, §30),
`request-discount-grant.e2e` T2/T4/T6/T7 (floor 422; guards; discount→frozen
accept→convert→`Order.commercialSnapshot` verbatim; later MarkupRule change does
not mutate; invalid money blocks conversion), `tour-request.service.spec`
(priceChanged flow). `customerFinalPrice >= supplierPrice` enforced at accept
(hunk: freeze validation) and grant (validateForAcceptance). Green e2e:
`d3-request-flow`, `order-to-request`, `buyer-identity`, `phase2-entry-audit`.

## 15. Storefront isolation (§6.15, Gates B/K)

`CommissionPolicy` separate: pricing module contains only comment-level mentions
of CommissionPolicy (3, verified); no imports. Commission/storefront suites green
in the Phase-6 matrix: `storefront` (solo 43/43), `commission-policy-foundation`,
`commercial-restriction`. Storefront commission behavior unchanged.

## 16. Gates A–L

```text
Gate A — Dynamic Registry:        PASS  (markup-matrix Gate A tests: new supplier
                                          appears without matrix code change; supported-pairs only)
Gate B — Rule Isolation:          PASS  (0 CommissionPolicy imports; storefront/commission green)
Gate C — Single Calculation:      PASS  (1000×5%=1050; re-apply stays 1050 — unit idempotency ×3)
Gate D — Supplier Floor:          PASS  (1000/1020 PASS, 1000/990 REJECT; e2e floor 422)
Gate E — Invalid Money:           PASS  (missing/zero/negative/currency/invalid-public/
                                         invalid-final/below-floor all rejected — unit+e2e;
                                         adapters → PRICE_UNAVAILABLE, no amount:0)
Gate F — Snapshot:                PASS  (freeze at acceptance; rule change no-mutation §30;
                                         sync never rewrites; Gate F unit + e2e T6)
Gate G — Request/Order:           PASS  (invalid money → accept/conversion blocked 422/409;
                                         valid snapshot → Request → Order verbatim; §14)
Gate H — Flights:                 PASS  (registry fan-out, one markup per fare, displayedPrice
                                         server-derived, body.price → 400)
Gate I — Freshness:               PASS  (fresh reuse / stale re-search at 5-min TTL; tour
                                         supplierPriceExpiresAt preserved)
Gate J — RBAC:                    PASS  (§9: read/manage/grant positive+negative+unrelated)
Gate K — Storefront:              PASS  (CommissionPolicy untouched; commission tests green)
Gate L — Hardening:               PASS  (full E2E §7-8; RBAC §9; idempotency §10;
                                         concurrency §11; resolution §12; sync/reconciliation §6;
                                         debug cleanup §2/scan spec; documentation §17;
                                         final regression §19)
```

## 17. Documentation

NEW `docs/architecture/supplier-markup.md`: Pricing chain, Live Sales, supplier
floor, MarkupRule lifecycle (DRAFT/ACTIVE/ARCHIVED, version, effective window,
audit, NOT_CONFIGURED), Registry SSOT, Commercial snapshot, Flights (TTL,
body.price, no refreshPrice), Storefront isolation, Sync (Tariff/public,
amount:0 removal, PRICE_UNAVAILABLE, reconciliation).

## 18. Typecheck

Backend `npm run typecheck` (tsc --noEmit) = **0 errors**; frontend
`npx tsc --noEmit` = **0 errors** (both re-run after all Phase-6 edits).

## 19. Full regression (§6.19, exact numbers)

```text
backend  npm test:            154/154 suites, 2437/2437 tests, 0 failed
backend  npm run typecheck:   0 errors
frontend npm test (vitest):   61/61 files,  989/989 tests, 0 failed
frontend tsc --noEmit:        0 errors
e2e      full matrix:         107 suites (62 pass / 45 fail / 0 skip),
                              1679 tests (1241 pass / 438 fail) — all failures
                              classified foreign/artifact (§8), 0 markup regressions
e2e      new suite:           pricing-concurrency 2/2 PASS (solo)
e2e      §6.7 regression set: 14/14 suites green (storefront via solo rerun)
```

## 20. Migration state (§6.20)

Markup migrations = 5 folders (§5), applied via `prisma migrate deploy` +
`prisma generate` (never `migrate dev`). Documented unrelated drift
`20260926125000_roomtype_aliases`, `20260926130000_room_view`: folders absent
and **zero references in current `schema.prisma`** — NOT reconstructed by this
workstream (rule §10.14).

## 21. Git diff review (§6.21)

- Markup-path diffs reviewed (`git diff --stat` + marker scan per file):
  supplier/pricing/FE-supplier/docs sets are markup-pure (0 foreign markers:
  M4/WhatsApp/Stage/booking scans clean; `azal.controller`, `request.controller`,
  captcha/provider/flight.types, all `frontend/components/supplier/*` verified).
- **Mixed-author files identified (markup hunks + foreign hunks in one diff):**
  `prisma/schema.prisma` (MarkupRule/Request-snapshot vs M4/Stage fields),
  `modules/order/request.service.ts` (markup Phase 3/4 hunks vs Stage-1/M4.5 hunks,
  one interleaved hunk), `src/app.module.ts` (PricingModule vs CheckoutModule),
  `frontend/lib/i18n.tsx` (trust/tour/offer keys vs M4 phone/checkout keys).
  Per rule §10.15 these must NOT be committed wholesale; hunk-level splitting
  or owner coordination is required (see §23).
- No secrets/keys in markup diffs; no unrelated migrations staged.

## 22. Git status

`master @ 0d7de62`, working tree dirty: **176 changed files across all
workstreams** (markup + booking Stage-1/2 + M4 WhatsApp + catalog + reverse +
finance). Nothing committed by this workstream yet; `backend_price_chain.log`
deleted (untracked artifact).

## 23. Commit

**Not yet executed — pending owner decision on mixed-file policy.**
Pure-markup file set is ready to stage; the 4 mixed files (§21) cannot be
committed wholesale (would commit foreign Stage-1/M4/booking changes —
violates §6.21/§10.15) and cannot be safely excluded in full (markup code
depends on `schema.prisma` MarkupRule/snapshot fields; committed-tree
compilability). Options: (a) hunk-level split of the 4 files → full markup-only
commit; (b) wholesale commit incl. foreign hunks inside those 4 files (violates
§6.21); (c) no commit, leave tree for owner coordination. NO COMMIT / NO PUSH
was performed (§6.22 conditions on "unrelated changes excluded" are not yet
satisfiable without choosing an option).

## 24. Push

Not performed (follows §23).

## 25. Final verdict

```text
PHASE 5 = PASS
PHASE 6 = PASS
Gate A = PASS   Gate B = PASS   Gate C = PASS   Gate D = PASS
Gate E = PASS   Gate F = PASS   Gate G = PASS   Gate H = PASS
Gate I = PASS   Gate J = PASS   Gate K = PASS   Gate L = PASS
```

All technical conditions of §9 (FINAL VERDICT RULE) are satisfied:
Phase 5 PASS, Phase 6 PASS, Gates A–L PASS →
**SUPPLIER MARKUP = COMPLETE** (git commit/push gated per §21–23 owner decision).
