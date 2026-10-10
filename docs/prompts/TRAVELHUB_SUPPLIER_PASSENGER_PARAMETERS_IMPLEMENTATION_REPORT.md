# TRAVELHUB — Supplier Passenger Parameters: Implementation Report

Prompt: `TRAVELHUB_SUPPLIER_PASSENGER_PARAMETERS_CONFIRMED_IMPLEMENTATION_PROMPT.md` (§15 final report).
Mode: implementation of confirmed mappings only. No price logic, no lifecycle, no payment, no DB repair, no commit/push.

## A. Implementation status

```text
Summer:    PASS
Anex:      PASS
Kompas:    PASS
KazUnion:  PASS
Flights:   PASS
```

Changed files (13):

```text
backend/src/modules/supplier/summertour/summertour.request-builder.ts      (AGES replaces AGE1-3; XHR now serializes it)
backend/src/modules/supplier/summertour/summertour.request-builder.spec.ts (+6 tests)
backend/src/modules/supplier/anex/anex.adapter.ts                          (AGES = CSV of all children)
backend/src/modules/supplier/anex/anex.adapter.spec.ts                     (+4 tests; pre-existing dirty hunks untouched)
backend/src/modules/supplier/supplier-aggregator.service.ts                (ANEX children max 1 removed — multi-child now reachable)
backend/src/modules/supplier/kompas/kompas.adapter.ts                      (applyKompasAgesParam + both PRICES interceptors)
backend/src/modules/supplier/kompas/kompas.adapter.spec.ts                 (+4 tests; pre-existing dirty hunks untouched)
backend/src/modules/supplier/kazunion/kazunion-http.service.ts             (AGES CSV, AGE1..AGE4 split removed)
backend/src/modules/supplier/kazunion/kazunion-http.service.spec.ts        (+4 tests)
backend/src/modules/supplier/azal/flight.types.ts                          (F1: passengers.childAges transport field)
backend/src/modules/supplier/azal/azal.controller.spec.ts                  (+1 F1 test)
frontend/lib/flight-api.ts                                                 (passengers.childAges type)
frontend/app/search/page.tsx                                               (childAges → passengers + dedup key)
```

## B. Exact mapping (childAges[] → AGES=a,b,c)

```text
SUMMERTOUR  [2, 6, 12] → req.AGES="2,6,12" → active XHR:  ...&ADULT=2&CHILD=3&AGES=2,6,12&...
            (summertour.request-builder.ts — build sets AGES; buildSummerXhrUrl serializes it;
             covers search :150-175, refreshPrice, rebuildCaptchaAction :1309-1325;
             AGE1/AGE2/AGE3 are NOT emitted anywhere)

ANEX        [1, 6, 13] → AGES="1,6,13" on /search (anex.adapter.ts fetchPriceRowsExact);
            CSV length follows CHILD count (children=3, ages=[1] → "1,0,0" — parity with the
            existing Anex Hotels AGES contract); children=0 → AGES=""

KOMPAS      [1, 6, 7] → supplier-facing PRICES URL: ...&AGES=1,6,7
            (applyKompasAgesParam — network-layer rewrite in BOTH interceptors:
             search() and searchReusePage(); replaces a stale native AGES, appends when absent;
             form AGE1..AGE3 selects remain internal representation only)

KAZUNION    [4, 6, 8] → AGES=4,6,8 (URL-encoded 4%2C6%2C8) in buildPricesUrl;
            no AGE1..AGE4 split, no 4-age ceiling (6 ages serialize fully)

FLIGHTS     passengers.childAges [2, 6, 12] carried: frontend URL → search body →
            fresh re-search → pinnedRequirements (data only; NOT sent to AZAL/Aviasales —
            childrenDatesOfBirth stays null; no price derived from ages)
```

All mappers preserve canonical ordering (composition order, never sorted). A shared
supplier-generic URL builder was NOT introduced (§3); only KOMPAS got a local helper.

## C. Tests

```text
Targeted new/updated suites:
  summertour.request-builder | anex.adapter | kompas.adapter |
  kazunion-http | azal.controller | supplier-aggregator
    → 6 suites, 121 passed, 0 failed   (19 new tests: Summer 6, Anex 4, Kompas 4, KazUnion 4, AZAL 1)

Regression run 1:  src/modules/supplier + src/modules/pricing
    → 28 suites, 433 passed, 0 failed
Regression run 2:  request-travelers | tour-request
    → 2 suites, 41 passed, 0 failed  (tour-request.service.spec overlaps with run 1)

typecheck:  backend  `tsc --noEmit` → EXIT 0
            frontend `tsc --noEmit` → EXIT 0

E2E: NOT RUN (skipped deliberately — heavy full-suite runs avoided per owner instruction
     «не перегружая ноутбук»; unit/regression/typecheck cover the changed contracts).
```

All claims above are actual executions — nothing reported as run that was not run.

## D. Scope safety

```text
No price calculation added            ✓ (only wire serialization changed; no amount math anywhere)
No double markup                      ✓ (pricing boundary untouched — supplier/pricing modules unmodified
                                        except none; markup tests still green in run 1)
No lifecycle changes                  ✓ (Request/Order/Booking code untouched)
No payment changes                    ✓ (no payment/recheck code touched)
No live DB repair                     ✓ (no INSERT/UPDATE/DELETE; no migrations; pinnedRequirements
                                        NOT rewritten — new rows simply carry the new field)
No unrelated files intentionally modified
                                       ✓ (84 pre-existing dirty files left exactly as found;
                                          the only 13 modified files are the ones listed in §A;
                                          pre-existing dirty hunks in anex/kompas specs preserved)
No D3 gates weakened                  ✓ (no gate assertions touched)
```

Excluded scope (§14) confirmed untouched: payment deadlines, payment-time recheck,
price-change proposal, MarkupRule/discount redesign, Request→Order→Booking, Booking
fulfillment, passport UI, identity, WhatsApp, supplier catalog, schema (schema.prisma
untouched by this task).

## E. Git

```text
HEAD:      75c6bea  fix(request): keep convert action for product-less requests (Hotel Identity Fix B)
branch:    master
working tree: 97 modified files (84 pre-existing + 13 from this task) + pre-existing untracked docs/specs
staged files: none
commit:    NO
push:      NO
```

## Notes / limits

- KOMPAS supplier-facing proof is unit-level (`applyKompasAgesParam`); the live PRICES URL
  shape was not re-captured (no live supplier calls in this task).
- ANEX multi-child now passes `supports()` (capability cap removed because the owner-supplied
  request CHILD=3 disproved the old «single child age» assumption).
- Flights: childAges is transport-only end to end; AZAL DOB mapping remains NOT confirmed
  and was not implemented; the AZAL age-category rule was not generalized.
