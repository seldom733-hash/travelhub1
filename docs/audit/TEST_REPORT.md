# Отчёт о проверках — Supplier Catalog Update

Дата: 2026-10-28. Окружение: Windows, Node v22.23.3, PostgreSQL
`127.0.0.1:5432`, dev DB `travelhub`, isolated test DB `travelhub1_test` /
suite DB from `template_travelhub_test`.

Полные логи: `reports/`.

## 1. Проверки именно реализации каталога

| Проверка | Команда / объект | Результат |
|---|---|---|
| Prisma schema | `npx prisma validate` | PASS |
| Миграции dev | `npx prisma migrate status` | up to date; **139 migrations** |
| Миграции test | `DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate status` | up to date; **139 migrations** |
| Catalog unit tests | `npx jest src/modules/supplier/catalog src/modules/catalog/hotel/hotel-category.spec.ts --runInBand` | **4 suites / 40 tests — PASS** |
| Catalog apply E2E | `npx jest --config test/jest-e2e.json --runInBand test/supplier-catalog.e2e-spec.ts` | **4/4 PASS** on isolated DB |
| Backend typecheck/build | `npm run typecheck`, `npm run build` | PASS (`reports/supplier-catalog-backend-build55.log`) |
| Frontend typecheck/build | `npx tsc --noEmit`, `npm run build` | PASS (`reports/supplier-catalog-frontend-build41.log`) |
| ProductCard tests | `npx vitest run components/public/ProductCard.spec.tsx --pool=threads` | **8/8 PASS** |
| Admin UI smoke | Playwright `/app/supplier-updates` | 0 page errors; country/category split verified |

### Catalog unit tests

- `supplier-catalog.service.spec.ts` — 9 tests:
  - create / update exact `supplierRef`;
  - sync-origin restore;
  - legacy archived requires manual approval;
  - archive only with `COMPLETE`;
  - partial blocks archive;
  - cross-country card is never archived;
  - zero price is skipped;
  - persisted discovered country is merged into capabilities.
- `supplier-catalog.source.spec.ts` — 4 tests:
  - Voyager tour identity;
  - Voyager hotel identity;
  - capabilities;
  - tour/hotel country dictionaries are separate.
- `catalog-coverage.spec.ts` — 2 tests:
  - complete multi-page/window/program sweep;
  - truncation and incomplete markers.

### Catalog apply E2E on isolated DB

1. preview does not change catalog; confirm creates one card; re-run updates
   the same `Product.id` (no duplicate).
2. `PARTIAL` never produces archive; `COMPLETE` archives and auto-restores the
   same `Product.id`.
3. legacy archived card requires explicit
   `POST /runs/:id/items/:itemId/restore`.
4. source error → `FAILED`, catalog untouched.

## 2. Live preview checks (preview only unless noted)

| Supplier / scope | Status | Coverage | Result |
|---|---|---|---|
| ANEX AT, tours | `PREVIEW_READY` | `COMPLETE` | 4 create / 46 update / 7 legacy / 0 archive |
| ANEX GE, tours | `PREVIEW_READY` | `PARTIAL` | 0 records — honest empty |
| Voyager TH, tours | `PREVIEW_READY` | `COMPLETE` | 345 items / 23 archive candidates |
| KOMPAS TR, tours | `PREVIEW_READY` | `COMPLETE` | 89 items (6 create / 83 update) |
| KazUnion TR, tours | `COMPLETED` | `COMPLETE` | 675 items; **624 applied on dev** |
| SummerTour TR, tours | `PREVIEW_READY` | `COMPLETE` | 242 items (50 create / 98 update / 94 archive candidates) |
| SummerTour ALL, tours | `PREVIEW_READY` | `COMPLETE` | `countryCode=ALL`, `countries=["TR"]`, 148 items; archive disabled for ALL |
| FSTravel TR, tours | `BLOCKED` | — | partner `INACTIVE`; HTTP 400, source not called |

**Disclosure:** a `confirm` was executed on the **dev** KazUnion TR run
`d64e6256-3f87-4611-9891-4c9160ee1937` at 13:06 UTC: 624 applied
(78 creates, 546 updates, 0 archive). Production was not touched; no further
live confirm is allowed without an explicit pilot plan.

## 3. Country lists

Tour and hotel country dictionaries are separate per supplier:

| Supplier | Tours | Hotels |
|---|---:|---:|
| KOMPAS | 23 | 53 |
| KazUnion | 8 | 22 |
| Voyager | 10 | 16 |

The admin UI was checked in a browser: switching KOMPAS from Tours to Hotels
changes the country selector from 23 to 53 options.

New countries are persisted in `catalog.SupplierCatalogCountry` after a
country-discovery call or after a successful preview for KOMPAS/KazUnion/
Voyager. `activeCapabilities()` merges them into the selector. Unknown names
that cannot be resolved to a Master Geography ISO-2 code are skipped and
counted, never guessed.

Verified merge: a temporary discovered row `KOMPAS/tours/VN` changed the KOMPAS
tours selector from 23 to 24 and exposed `VN`; the test row was deleted
afterwards.

The country selector now has **«Все страны»** first. A SummerTour
`countryKey=ALL` preview completed with `countries: ["TR"]`, `countryCode:
"ALL"`, `coverage=COMPLETE`, 148 items; archive is intentionally not enabled
for an ALL-country run.

For an ALL preview the service now runs supplier country discovery **before**
building the run scope (tours and hotels separately), persists newly resolved
countries in `SupplierCatalogCountry`, and only then calls
`activeCapabilities()`. The first ALL run therefore includes countries that
were absent from the previous picker; the next capabilities request exposes
them. Discovery failures are logged and do not block the run.

ANEX tour previews sweep **one 7-day week every 5 weeks** (11 sampled weeks over
the 365-day horizon), using nights **2, 3, 4, 5, 6, 7**. This is a sampled
catalog sweep, so the run is intentionally `PARTIAL`: create/update can be
confirmed, archive is blocked. The source timeout is 60 minutes and stale-run
cleanup uses 90 minutes.

Country display is the ISO/CRM code, not the full country name: ANEX uses
`AnexState.stateISO` (e.g. `AT`, not numeric `46`), Voyager/KOMPAS/KazUnion use
their ISO keys. Report rows display `run.countryCode`.

## 4. Supplier code on cards / PDP

Public tour/hotel cards and PDP show only `Partner.code` (for example
`PRN-00000006`), never the seller display name. `partnerCode` is read from
`Product.partnerId → Partner.code`, independently of `PublicSellerProfile`.

Verified API:

```json
{ "partnerCode": "PRN-00000004", "seller": null }
```

Screenshots: `reports/demo/25-card-partner-code.png`,
`reports/demo/26-pdp-partner-code.png`, `reports/demo/28-country-discovery.png`.

## 4. UI fixes

- Report table has a **«Название услуги»** column (item `after.title` /
  `hotelName`, fallback `before`).
- Autocomplete no longer treats an `accommodation` Product as a destination;
  the destination query is limited to the `destination` category.
- Hotel and flight submit buttons are right-aligned like the tours button
  (`PICKER_SUBMIT_RIGHT`); HelpFind is hidden in their universal forms and the
  supplier picker has a bounded width (260px), so it no longer covers or pushes
  the submit button.
- Search results use the same `HeroSearch` component/grid as the home page for
  every enabled service; the results wrapper is `max-w-6xl`, matching the home
  `SearchBlock`.
- From/To pickers are standardized at 278px; supplier pickers at 260px across
  tours/hotels/flights. Flight baggage tariff is 260px.
- Flight form order: row 1 From, To, departure date, adults, children, infants;
  row 2 tariff, round-trip, direct, supplier.
- The flight form no longer has a 293px flex-basis on the tariff row. Measured
  form height is ~196px; From/To 278px; tariff/supplier 260px.
- Hotel results form hydrates destination/date/adults/suppliers from the URL, so
  submitting after a fresh page load no longer silently returns.
- Flight submit uses a hard navigation (`window.location.assign`) because a
  query-only Next push occasionally kept the old results URL.
- One full country sync per supplier/service per Asia/Baku day: a new preview
  is blocked when a `COMPLETED` + `COMPLETE` run for that country finished
  today (an ALL run covering the country also counts). The UI receives
  `ConflictException` with the «уже полностью загружены» message.
- Update report has a **Фото** column: `Да` when the hotel file exists in
  `frontend/public/hotels` or an uploaded primary ProductMedia exists; `Нет`
  otherwise.
- After a successful apply the backend rebuilds hotel refs for the supplier and
  asynchronously runs `scripts/hotel-photo-catalog.ts --supplier=…`. For ANEX
  the **Anextour hotel page is the primary photo source** (exact hotelKey;
  `i.travelapi.com` or `files.anextour.com/.../galleries`; `photoSource=anextour`),
  Tripadvisor CDN is only a fallback. Other suppliers keep the Tripadvisor CDN
  search.
- Current ANEX sample after the latest Austria/Georgia sync:
  - Austria: **85/87** products with a photo; 2 have no usable Anextour image
    (Chalet in Bad Hofgastein — all gallery URLs return 404; Hotel Kaprunerhof —
    Anextour page returns 404).
  - Georgia: **44/44** products with a photo.
- KOMPAS hotels have their own discovery method against the stay-only
  `/search_hotel` STATEINC dictionary; it is separate from the tour dictionary.
- `/destinations` now lists a country when it has **either** a published tour
  or a published hotel (`HAVING tours > 0 OR hotels > 0`). With the current
  tour-only catalog it returns 19 countries; the page subtitle says
  «туры или отели» in RU/AZ/EN.
- TourSearch nights selector and the PDP calendar nights selector now start at
  the supplier minimum **2** (2–28) instead of 3; the PDP initial value prefers
  `priceNights`.
- Manual per-product price refresh is not exposed as a button yet. A country
  Preview/Apply re-runs the supplier and updates the nearest price/min-nights
  basis; a single-card refresh endpoint is still a separate task.
- Existing supplier products created before the price-basis change have no
  saved `priceDate/priceNights`; a fresh apply is required to populate them.
  Daily “move to the next date when the shown date is reached” repricing is a
  separate scheduled offer-calendar job and is not implemented yet.
- Master Geography now contains Kyrgyzstan (`KG`, `Qırğızıstan` / `Кыргызстан`)
  and the 21 existing KG products were linked to it; `/destinations` returns 28
  countries, including KG. Destination detail pages show 48 cards initially and
  load the remaining pages with «Показать ещё»; countries with only hotels
  (KG) open on the Hotels tab automatically.
- Public constructor media and product media are now streamed through the
  backend instead of redirecting to the signed MinIO URL. That URL was
  `http://localhost:9000/...`, so a browser on another LAN machine resolved
  `localhost` to itself and the logo/product image failed. `GET
  /api/v1/public/constructor-media?...` now returns `200 image/png`; verified
  through both `127.0.0.1:3000` and the machine's LAN IP `10.1.10.6:3000`.
- Anextour photo fallback no longer accepts the shared generic gallery asset
  (`20191217_…6a9f…png`). The resolver prefers the hotel-specific
  `files.anextour.ru/.../room/...` image, rejects the shared gallery, and a
  per-hotel URL uniqueness guard prevents one image being stamped onto
  differently named hotels. A targeted Egypt backfill replaced 243/250 shared
  photos; the remaining cards were cleared rather than keeping the generic
  image. Hotel photo counts: 10,894 OK / 308 FAILED / 20 NONE; 0 linked
  photo files are missing from disk. FAILED means the external exact-name
  image search found no trustworthy photo (fail-closed, not a broken URL).
- ANEX has a hotel catalog path now: hotel-state countries are exposed in
  capabilities, the same 11 sampled weeks are fetched date-by-date through
  `AnexHotelAdapter.search` (7-night basis), grouped by `hotelInc`, and written
  as `accommodation` products with AZN prices. Coverage stays `PARTIAL` so
  archive of unobserved hotels is blocked. The hotel calendar is also
  implemented date-by-date instead of returning an empty result.
- The once-per-country-per-day guard has a deliberate temporary bypass:
  `SUPPLIER_CATALOG_ALLOW_RERUN_TODAY=true` in the backend process env. It is
  not persisted and disappears on the next backend restart; it is meant for
  an approved re-sync after a price/currency fix.
- KazUnion tour prices are requested with `CURRENCY=10` (AZN), matching the
  hotel search. The parser keeps `AZN` as the fallback currency; the partner
  FX placeholder is no longer part of tour display. Tours and hotels therefore
  store and show AZN directly.
- Home `Tours` block no longer drops a small catalog: if there are ≤6 tours it
  shows them directly instead of reserving all six for the (possibly disabled)
  Hot Tours block. Card dates use compact `DD.MM.YYYY`.
- ANEX price-calendar now requests every date separately. Multi-day CHECKIN
  windows are answered sparsely by ANEX (a November 7-night request returned
  only Nov 6/10/19/25); single-date requests return the full price calendar,
  including Nov 2. The catalog price sweep also queries sampled dates one by
  one so weekdays are not lost.
- Category label «Accommodation / Проживание» is rendered as
  Hotel / Otel / Отель via `categoryLabel()`; legacy DB title is mapped at
  render time.
- Country selector/report display ISO/CRM codes (`AT`, `TR`), not full names;
  ANEX uses `stateISO` and the report uses `run.countryCode`.
- Cascading search filters:
  - destination chosen → supplier list only suppliers serving that ISO country;
  - supplier(s) chosen → country list only countries served by them;
  - hotel directory is scoped by `service=hotels|tours`, selected catalog
    suppliers and `PUBLISHED` status, so hotel search never mixes tour hotels
    and archived products are absent.
  - API checks: `service=hotels&geoCountry=TR&suppliers=KOMPAS` → only KOMPAS
    hotels; tour-only hotel `A'la Sofia` absent from hotels and present in
    tours.
- Hotel category filter is canonical:
  - `STAR`: only `4*` and `5*`;
  - `PROPERTY_TYPE`: Boutique, Guest House, Deluxe, Apart;
  - 1–3 stars, Adults only, Family, HALAL, Kids Go Free, Recommend, HV-1 and
    other supplier tags are not selectable.
  - `/geo/supplier-stars` returned only `5*`, `4*`, `Apart`, `Boutique`,
    `Guest House`; aggregator resolves the same canonical labels to native
    supplier ids.

## 5. FSTravel / inactive partners

`activeCapabilities()` returns no countries for a supplier whose CRM partner is
not `ACTIVE`; `startPreview()` rejects it with HTTP 400. FSTravel is currently
`INACTIVE`.

## 6. Remaining limitations

- ANEX hotels remain unsupported.
- KOMPAS hotel-country discovery still uses the static hotel dictionary;
  KOMPAS/KazUnion tour discovery is dynamic.
- No production confirm/archive/restore and no production migrations.
- The full repository test suite was not run in this round; only the catalog
  profile, isolated E2E, builds, card tests and UI smoke.
- Production pilot requires a separate plan and approval.
