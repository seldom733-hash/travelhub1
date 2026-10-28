# Supplier Catalog Update — implementation status

Date: 2026-10-27.

## Scope

Admin-only, additive implementation of supplier catalog preview/apply for
ANEX (tours), Voyager (tours/hotels), KOMPAS (tours/hotels), KazUnion
(tours/hotels), SummerTour (tours) and FSTravel (tours). AZAL/Aviasales remain
live-search only and are not catalog-sync capabilities.

## Implemented

- additive migration `20261028100000_supplier_catalog_runs`:
  - `catalog.SupplierCatalogIdentity`;
  - `catalog.SupplierCatalogRun`;
  - `catalog.SupplierCatalogRunItem`.
- `GET /supplier/catalog/capabilities`.
- `POST /supplier/catalog/runs/preview`:
  - writes run/items only;
  - no Product/Tariff changes.
- `POST /supplier/catalog/runs/:id/confirm`.
- `GET /supplier/catalog/runs`, `GET /supplier/catalog/runs/:id`.
- `POST /supplier/catalog/runs/:id/cancel`.
- `POST /supplier/catalog/runs/:id/items/:itemId/restore` for explicit legacy
  archive approval.
- `supplier.search.manage` permission required for mutations;
  `supplier.search.read` for reads.
- idempotency guard via unique `activeKey`; one active preview/apply scope.
- `ProductHistory` on create/update/restore/archive.
- zero-price guard: records without positive price are not published.
- manual review for legacy archived cards; auto-restore only for cards archived
  by this mechanism (`SupplierCatalogIdentity.archivedByRunId`).
- all-services mode (`serviceType: "all"`) for selected supplier + country.
- Tour and hotel country dictionaries are separate per supplier:
  KOMPAS tours 23 / hotels 53; KazUnion tours 8 / hotels 22. The admin
  country selector therefore never merges tour-only and hotel-only countries.
- Discovered countries are persisted in `catalog.SupplierCatalogCountry`.
  KOMPAS/KazUnion/Voyager discovery runs after a successful preview and via
  `POST /supplier/catalog/countries/discover`; only names resolving to a
  Master Geography ISO-2 code are added, unknown names are skipped.
- Admin UI: `/app/supplier-updates`, left menu **Обновление услуг → Поставщики**.
- Country display uses ISO/CRM codes, not full names or ANEX numeric state ids
  (`AT`, `TR`). ANEX maps `stateISO` to the catalog key; reports show
  `countryCode`.
- Cascading form filters: a chosen destination limits the supplier picker to
  suppliers serving that ISO country; chosen supplier(s) limit the country
  picker to their countries. The hotel picker (`/geo/supplier-hotels`) is scoped
  by `service=hotels|tours`, selected supplier codes, PUBLISHED status and
  country/city/resort, so archived cards and tour hotels do not leak into the
  hotel-search directory.
- Hotel category filter is canonical: `STAR` keeps only 4*/5*;
  `PROPERTY_TYPE` keeps Boutique, Guest House, Deluxe, Apart. Supplier tags such
  as Adults only/Family/HALAL/Kids Go Free/Recommend and 1*-3* are not exposed.
  Classification lives in `catalog/hotel/hotel-category.ts` and is applied both
  to `/geo/supplier-stars` and to native `starKeys` resolution; SAMO discovery
  also stores only canonical category labels for new links.
- Price basis for cards: 2 adults, nearest future departure date, minimum
  available nights on that date. The product stores `priceDate/priceNights`,
  the Base tariff gets `validFrom`, and public lists sort by `price_asc`.
  Products created before this change need a fresh apply; daily advance/repricing
  is a separate scheduled job and is not implemented yet.
- One full country sync per supplier/service per Asia/Baku day. A
  `COMPLETED` + `COMPLETE` run finished today blocks a repeat country preview
  with a user-facing message; an ALL run that covered the country also counts.
- After apply the backend rebuilds `HotelSupplierRef` rows and starts a
  background photo backfill for that supplier. For ANEX the exact hotel's
  Anextour page gallery (`i.travelapi.com` or `files.anextour.com/.../galleries`,
  keyed by `hotelKey`) is the primary source and is recorded as
  `photoSource=anextour`; Tripadvisor CDN is only a fallback. Other suppliers use the Tripadvisor CDN search. The report has a
  Фото column (`Да`/`Нет`) based on the actual file under
  `frontend/public/hotels`.
- KOMPAS has a separate hotel-country discovery against `/search_hotel`
  STATEINC (wider than the tour dictionary).
- Country selector starts with **«Все страны»**. A countryKey=`ALL` preview
  sweeps every country of the selected category; archive is intentionally
  disabled for such a run. Before constructing the ALL scope the service calls
  supplier discovery separately for tours and hotels, persists newly resolved
  countries and then re-reads capabilities, so newly discovered countries are
  included in the first ALL run and appear in the picker afterwards.
- report with create/update/restore/archive/legacy/ambiguous/error counts,
  coverage and per-card items.

## Critical limitation

The catalog source now has an explicit coverage contract:

```ts
{
  offers,
  coverage: {
    pagesFetched,
    pageCount,
    hasMore,
    truncated,
    programsComplete,
    windowsComplete,
    errors
  }
}
```

Coverage metadata is wired through the supported catalog adapters:

- ANEX tours — one 7-day week every 5 weeks (11 sampled weeks up to 365 days),
  nights 2/3/4/5/6/7 (77 dates × 6 exact-night requests), PRICEPAGE
  `result.pageCount`, `ANEX_MAX_PAGES` truncation;
- Voyager tours/hotels — PRICEPAGE pager plus date-window loop;
- KOMPAS tours/hotels — pager pages, hotel PRICEPAGE pages, night fan-out;
- KazUnion tours/hotels — PRICEPAGE pager on both tour and hotel endpoints;
- SummerTour — PRICEPAGE loop; town-discovery mode is explicitly incomplete;
- FSTravel — PRICEPAGE loop per window/night, captcha/IP aborts marked
  incomplete.

The engine accepts `COMPLETE` only when records exist, pages were fetched, no
truncation occurred, all windows/programs completed and no source error was
recorded. A zero-row answer is never `COMPLETE` (it cannot be used to archive a
whole scope).

Archive scope now requires an **exact** `attributes.countryCode` match. A
missing/legacy country field is never treated as a match; this prevents a
complete Austria preview from producing archive candidates for Turkey/Thailand
cards.

This is deliberate: activating archive from an unverified page sweep would
violate the approved safety rules.

## Live checks

- ANEX tours preview → `PREVIEW_READY`, coverage `COMPLETE`, 4 create /
  46 update / 7 legacy, **0 archive candidates** after the country-scope
  guard; no catalog changes.
- ANEX Georgia preview → honest empty (`0` records, `PARTIAL` because a
  zero-row answer is never complete); no catalog changes.
- Voyager Thailand preview → `PREVIEW_READY`, coverage `COMPLETE`, 345 items,
  23 archive candidates.
- KOMPAS TR preview → `PREVIEW_READY`, coverage `COMPLETE`, 89 items
  (6 create / 83 update), no archive.
- SummerTour TR preview → `PREVIEW_READY`, coverage `COMPLETE`, 242 items
  (50 create / 98 update / 94 archive candidates) from 4 programs; no confirm.
- FSTravel TR preview → rejected with HTTP 400: partner `FSTravel` is
  `INACTIVE`; catalog capabilities hide the supplier and require an ACTIVE
  CRM partner before any source call.
- **Dev-only disclosure:** one KazUnion TR run was confirmed on dev:
  675 items, 624 applied (78 creates, 546 updates, 0 archive). Production was
  not touched; no further live confirm is allowed without an explicit pilot
  plan.
- No production confirm/archive/restore was run.
- Migration applied to isolated test DB and local dev DB; production untouched.
- Backend/frontend builds pass.
- Catalog unit tests: 13/13 pass.
- Catalog coverage tests: 2/2 pass.
- Catalog apply E2E on isolated test DB: 4/4 pass (preview no-write,
  create/update same ID, partial archive block, complete archive/restore same
  ID, legacy manual, source error).

## Card supplier marker

Tour and hotel cards show only the CRM `Partner.code` (for example
`PRN-00000006`) under the label «Код поставщика». The code is read from
`Product.partnerId` → `Partner.code`, independently of `PublicSellerProfile`;
the seller display name/brand is not rendered. This covers supplier-synced
cards that have no approved seller profile.

## Next required step

Run a live preview for each supplier/country and verify `coverage=COMPLETE`
before enabling archive in the pilot. Add supplier-specific integration tests
for page/program/window failure modes, then run a pilot preview/confirm on one
supplier/country and request production approval.
