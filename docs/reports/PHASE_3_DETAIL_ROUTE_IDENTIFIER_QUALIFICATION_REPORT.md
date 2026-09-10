# PHASE 3 — Detail Route Identifier Contract Audit & Qualification Report

## 1. Executive Summary

Audit-first pass over the detail-route identifier contract for the four
commerce domains (Requests, Orders, Bookings, Payments). The canonical
contract **exists and is unambiguous** in repository documentation
(ADR-OPS-001), so the task resolved to **VERDICT C** with a targeted
frontend-only normalization: the canonical Payments detail route
`/app/payments/[code]` declared by the contract had never been created —
the payments registry still linked to the legacy
`/app/finance/payments/[id]` page. Requests, Orders, and Bookings already
conformed to the contract (internal-UUID `[id]` routes) and required no
change. Backend lookup contracts were already correct for all four
domains and were not modified.

## 2. Baseline / Final SHA

- Branch: `master` (canonical). Baseline: `272b0fe16ecef3f9d920dc26efbc25326264e327`
  (equal to `origin/master` at start; tree clean except this task's prompt file).

## 3. Canonical Sources and Evidence

| Contract statement | Source | Evidence |
|---|---|---|
| Detail routes: `/app/requests/[id]`, `/app/orders/[id]`, `/app/bookings/[id]` (accepted UI-C1.1), plus canonical `/app/payments/[id]` | ADR-OPS-001 §6, `docs/reports/PHASE_3_COMMERCE_CENTER_UI_C1_2_OPERATIONS_CENTER_ARCHITECTURE_DESIGN_RECONCILIATION_REPORT.md` | §6 "Detail pages: canonical entity routes remain … plus `/app/payments/[id]`" |
| `/app/finance/payments` + `/app/finance/payments/[id]` are **migrated** with redirect kept | ADR-OPS-001 §6 | "The existing `/app/finance/payments` + `/app/finance/payments/[id]` are migrated (redirect kept …)" |
| Dedicated Payments detail is the primary pattern (option D-hybrid) | ADR-OPS-012 §21 | "A (dedicated `/app/payments/[id]`) — canonical record URL … → **primary**" |
| `/app/payments` is the canonical Payments registry; `/app/finance/payments` is a compatibility redirect | ADR-OPS-001; implemented in `app/finance/payments/page.tsx`; pinned by `operations-center-shell.spec.tsx` | Pre-existing implementation + passing spec |
| Relationships/references resolve by UUID; referenceNumber is the display contract | `TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md` L127 ("Relationships: по FK/UUID"); Pre-Step 3.12 reference presentation reports | `referenceNumber` (MKT-*) canonical for display; `code` (ORD/BKG/PAY-*) legacy presentation |
| Payments API detail lookup is by business code | `finance.controller.ts` L313 `@Get("payments/:code")` → `payments.getByCode(code)` → `findUnique({ where: { code } })` | Code audit (unique `Payment.code`) |

No document declares UUID-vs-code as a URL rule in prose; the accepted
route list in ADR-OPS-001 **is** the URL-identifier contract: Requests,
Orders, Bookings = internal UUID; Payments = business code. This matches
each domain's existing backend lookup authority.

## 4. Identifier Taxonomy (audited)

| Entity | Internal DB ID (unique, immutable) | Business Code (unique, immutable) | Reference Number (display, immutable) | URL identifier (canonical) | Display identifier |
|---|---|---|---|---|---|
| Request | `id` UUID | `REQ-*` | `MKT-REQ-*` | UUID (`/app/requests/[id]`) | `referenceNumber` |
| Order | `id` UUID | `ORD-*`; `number` = `TH-*` | `MKT-ORD-*` | UUID (`/app/orders/[id]`) | `referenceNumber` |
| Booking | `id` UUID | `BKG-*` | `MKT-BKG-*` | UUID (`/app/bookings/[id]`) | `referenceNumber` |
| Payment | `id` UUID | `PAY-*` | `MKT-PAY-<seq>-<n>` | **business code** (`/app/payments/[code]`) | `referenceNumber` |

Lookup methods: Request/Order/Booking detail → `findUnique({ where: { id } })`;
Payment detail → `findUnique({ where: { code } })`. List pages never treat
`referenceNumber` as a URL identifier (search/filter only).

## 5. Audit Chain (before normalization)

- Requests: `/app/requests/${r.id}` → `GET /requests/:id` → `getRequest(id)` → `findUnique({ id })`. ✅ conformant.
- Orders: `/app/orders/${o.id}` (list, CRM 360, payment pages, booking detail, request detail) → `GET /orders/:id` → `getOrder(id)` → `findUnique({ id })`. ✅ conformant.
- Bookings: `/app/bookings/${b.id}` (list, CRM partner 360) → `GET /bookings/:id` → `getById(id)` → `findUnique({ id })`. ✅ conformant.
- Payments: registry link → `/app/finance/payments/${p.code}` (legacy path) → legacy detail page → `GET /finance/payments/:code` → `getByCode(code)` → `findUnique({ code })`. ❌ detail route location violated ADR-OPS-001 (canonical `/app/payments/[code]` missing).

All detail backends enforce permission guards (`order.read`,
`booking.read`, `finance.payment.read`), server-authoritative
`availableActions`, and D4 §10/§21 storefront-tenant invisibility
(404-neutralization for `PARTNER_STOREFRONT` sources on direct reads) —
unchanged by this task.

## 6. Required-Change Matrix

| Entity | Current URL | Current backend lookup | Canonical identifier | Required change | Risk | Tests |
|---|---|---|---|---|---|---|
| Request | `/app/requests/[id]` (UUID) | `findUnique({id})` | UUID (ADR-OPS-001) | none | — | existing suites |
| Order | `/app/orders/[id]` (UUID) | `findUnique({id})` | UUID (ADR-OPS-001) | none | — | existing suites |
| Booking | `/app/bookings/[id]` (UUID) | `findUnique({id})` | UUID (ADR-OPS-001) | none | — | existing suites |
| Payment | `/app/finance/payments/[id]` (code) | `findUnique({code})` | business code at `/app/payments/[code]` (ADR-OPS-001) | create canonical page; convert legacy page to redirect; relink registry | low | vitest + runtime |

## 7. Implementation (frontend-only)

Changed files:
- `frontend/app/app/payments/[code]/page.tsx` — **new canonical** Payments detail page (same contract as the legacy page: `GET /finance/payments/:code`; display header = `referenceNumber`; breadcrumbs show `PAY-*`; back link to canonical `/app/payments`).
- `frontend/app/app/finance/payments/[id]/page.tsx` — converted to a compatibility redirect → `/app/payments/[code]` (segment value identical under both paths).
- `frontend/app/app/payments/page.tsx` — registry row link now emits `/app/payments/${p.code}`.

Unchanged (by contract): backend controllers/services/lookups, schema,
RBAC/permissions, Requests/Orders/Bookings routes and links, D8 temporal
work, finance PSP/CRM architecture. Display (`referenceNumber`) and DB
relations (UUID FKs) untouched — URL vs display separation preserved.

## 8. Security Verification

| Scenario | Result |
|---|---|
| valid `PAY-*` + authorized (ADMIN) | 200 page + 200 API |
| unauthenticated API detail | 401 `Missing access token` (request id) |
| non-existent `PAY-99999999` | 404 |
| UUID passed as code (wrong type) | 404 (no polymorphic lookup exists) |
| malformed segment (`%3Cscript%3E`) | 404 |
| cross-tenant / storefront-source payment | pre-existing D4 neutral-404 contract unchanged |

Authorization is identifier-independent (permission guard before lookup);
using business code in the URL does not weaken object-level checks.
Enumeration exposure is unchanged from the pre-existing legacy page
(`PAY-*` codes are sequential; direct-read storefront neutralization and
RBAC boundaries are the operative protections, all pre-existing).

## 9. Tests / Regression

- Frontend vitest: **43/44 suites, 782/783 tests PASS**. The single failure
  is the pre-existing, previously documented `i18n.spec.ts` `formatPrice`
  non-breaking-space runtime discrepancy (unrelated to this task; recorded
  in earlier qualification reports).
- Frontend production build (`next build`): PASS.
- No backend changes → backend tests/typecheck unaffected (last verified
  green at SHA `272b0fe`).
- No competing identifier contract introduced: legacy path kept strictly
  as redirect; no `findByAnyIdentifier` added; backend lookup methods
  unchanged.

## 10. Browser / Runtime Verification (frontend :3000, backend :4000)

- Login (ADMIN) → `GET /app/payments/PAY-00000710` renders canonical detail:
  breadcrumbs `TravelHub/Платежи/PAY-00000710`, header `MKT-PAY-00000710-1`,
  hero `39,60 ₼`, status badge «Зачислен» (CAPTURED), detail rows.
- Legacy `GET /app/finance/payments/PAY-00000710` → client redirect lands on
  `/app/payments/PAY-00000710` (URL observed after navigation).
- `/app/payments` registry rows emit canonical links
  (`/app/payments/PAY-00000084`, `…772`, `…786` observed via DOM query).
- Order detail regression: `/app/orders/d81eb3ef-96c0-4b0b-1161-f8ee795399a3`
  renders normally (UUID route contract intact).
- Requests/Bookings detail routes verified earlier at the same baseline
  (200 with UUID segments) — contract unchanged by design.

## 11. Git

- Baseline SHA: `272b0fe16ecef3f9d920dc26efbc25326264e327`
- Final SHA: recorded in the closure commit of this report.
- origin/master: equal to final SHA after push; working tree clean.

## FINAL VERDICT

**VERDICT: C — IMPLEMENTATION DEFECT (normalized in this pass)**

Canonical identifier policy:
- Request: URL = internal UUID; display = `referenceNumber` (MKT-REQ-*)
- Order: URL = internal UUID; display = `referenceNumber` (MKT-ORD-*)
- Booking: URL = internal UUID; display = `referenceNumber` (MKT-BKG-*)
- Payment: URL = business code `PAY-*`; display = `referenceNumber` (MKT-PAY-*)

Implementation:
- changed: canonical `/app/payments/[code]` page created; legacy `/app/finance/payments/[id]` → redirect; registry links normalized
- unchanged: backend contracts (all four lookups already canonical), Requests/Orders/Bookings routes, RBAC, schema, display contract

Security:
- authorization: permission guards unchanged, identifier-independent
- tenant isolation: D4 storefront neutral-404 unchanged
- IDOR: 404/401 for wrong-type/malformed/non-existent identifiers

Compatibility:
- legacy URLs: `/app/finance/payments/[id]` preserved as redirect (per ADR-OPS-001 "redirect kept")
- migration/redirect: client-side forward of the same code segment; no URL rewrite layer needed

Tests:
- unit/integration: vitest 782/783 (1 pre-existing unrelated failure)
- typecheck/build: `next build` PASS
- e2e: covered by runtime browser verification below (no new e2e infra required by prompt)

Browser verification:
- Request: `/app/requests/[id]` conformant (unchanged, runtime-verified at baseline)
- Order: `/app/orders/[id]` renders (verified live)
- Booking: `/app/bookings/[id]` conformant (unchanged, runtime-verified at baseline)
- Payment: canonical `/app/payments/[code]` renders; legacy redirects; registry links canonical (verified live)

Git:
- baseline SHA: `272b0fe`
- final SHA: see closure commit
- origin/master: synced
- clean tree: yes

Next action:
none required for this contract; any future URL-identifier change for
Requests/Orders/Bookings would require a new ADR (contract is explicit).
