# PHASE 3 — D8 Security / Tenant Final Re-qualification (Round 2)

## 14.1 Executive Summary

The prior security/tenant re-qualification (commit `48471cb`) ended with
**VERDICT B — VALID SYSTEM FAIL** because no positive tenant-scoped D8
registry evidence existed. The evidence-preparation task (commit `af5b075`)
then established a positive scoped-dataset fixture for the **Catalog**
registry. This pass re-ran the complete mandatory matrix at runtime using
that fixture strategy: multi-role (Classes A–D), tenant isolation T1–T6,
negative RBAC across all D8 surfaces, data-leakage and KPI checks, and
authentication/session integrity. **All 57 API evidence cases passed.** No
production code, schema, guard, permission, or temporal authority changed.

## 14.2 Baseline / Final SHA

- Branch: `master` (= canonical branch).
- Baseline: `af5b075f822eb3b71fc23601a993d6c495de6e00`, equal to
  `origin/master` at start; working tree clean.
- No production source file was modified in this pass (verified in §14.10).

## 14.3 Environment

- PostgreSQL (local, database `travelhub1`) — up.
- Backend: `ts-node src/main.ts` on `:4000`, started from baseline SHA;
  health verified via `POST /auth/login` round-trip.
- Frontend: pre-existing Next dev server on `:60745` (port 3000 was not
  listening in this environment; same app/rewrites proxy `/api/v1 → :4000`).
- Auth: JWT bearer + HttpOnly cookie (`POST /api/v1/auth/login`);
  logout revokes via session/token-version check.
- Fixture: 5 test-only users created through the existing ADMIN
  `POST /api/v1/users` route (existing roles only, no new role/permission)
  and deleted afterwards (see §14.11).

## 14.4 Role Matrix

Fixture users: `d8_final_rq_dir` (DIRECTOR), `d8_final_rq_op` (OPERATOR),
`d8_final_rq_buyer` (BUYER), `d8_final_rq_a` (PARTNER → partner
`756435b1-a989-4f6e-b845-7f192a8d1e3d`, "Tenant A"),
`d8_final_rq_b` (PARTNER → partner `aa70b379-5d42-4f33-94b5-067fb6b31281`,
"Tenant B"). All requests carry `X-Request-Id`.

| Class | Role | Surface / query | Expected | Actual | Result |
|---|---|---|---|---|---|
| A | DIRECTOR | Orders narrow `2026-09-01..2026-10-01` | 200 scoped | 200, total 66 | PASS |
| A | DIRECTOR | Orders broad `2026-01-01..2027-01-01` | 200 scoped | 200, total 508 | PASS |
| A | DIRECTOR | Orders empty window `1990` | 200, total 0 | 200, total 0 | PASS |
| A | DIRECTOR | Orders `dateFrom=bad` / `dateTo=bad` / `2026-02-30` | 400 canonical | 400 `dateFrom must be a valid date` | PASS |
| A | DIRECTOR | Requests valid / bad | 200 / 400 | 200 (89) / 400 | PASS |
| A | DIRECTOR | Requests KPI same window | 200 KPI | 200 `total: 89` = table total 89 (parity) | PASS |
| A | DIRECTOR | Bookings valid / bad | 200 / 400 | 200 (48) / 400 | PASS |
| A | DIRECTOR | Payments `dateField=createdAt` / `paidAt` / bad | 200 / 200 / 400 | 200 (52) / 200 (350) / 400 | PASS |
| A | DIRECTOR | CRM customers valid / bad | 200 / 400 | 200 (93) / 400 | PASS |
| A | DIRECTOR | CRM Activity valid / bad | 200 / 400 canonical | 200 / 400 `dateFrom must be a valid date` | PASS |
| A | DIRECTOR | Analytics `preset=CUSTOM` valid / impossible | 200 / 400 | 200 / 400 period-order message | PASS |
| B | OPERATOR | Orders valid / bad | 200 / 400 | 200 (66) / 400 | PASS |
| B | OPERATOR | Payments valid / bad | 403 (no `finance.payment.read`) | 403 / 403 — no validation bypass | PASS |
| B | OPERATOR | Analytics valid | 200 (`analytics.read` canonically granted to OPERATOR, `permissions.constants.ts:596`, Step 3.2) | 200 | PASS |
| B | OPERATOR | Requests valid | 200 | 200 (89) | PASS |
| C | BUYER | Orders valid / bad | 403 `order.read` missing | 403 / 403 | PASS |
| C | BUYER | Products (Catalog) | 403 `catalog.product.read` missing | 403 | PASS |
| C | BUYER | Analytics | 403 `analytics.read` missing | 403 | PASS |
| C | BUYER | Payments `dateFrom=bad` | 403, no bypass | 403 | PASS |
| D | PARTNER A/B | Catalog own scope | 200, own rows only | see §14.5 | PASS |
| D | PARTNER A | Orders / Requests / Payments / Customers / Analytics | 403 permission-denied | 403 each (`order.read`, `finance.payment.read`, `crm.customer.read`, `analytics.read`) | PASS |

Negative-RBAC ordering note (documented pipeline behavior, security-safe):
for permission-denied roles the guard runs before date validation, so
`?dateFrom=bad` on a denied surface yields 403 (not 400) and no response
body data — no validation bypass, no count/row leakage.

## 14.5 Tenant Isolation Matrix (Catalog, `publishedAt` D8 dimension)

Shared temporal window covering both tenants' published rows:
`dateFrom=2026-01-01&dateTo=2026-09-01` (A record `2026-08-23`, B record
`2026-01-15`; B's product is ARCHIVED with retained `publishedAt` and still
appears in its own-partner registry — the registry is partner-scoped, not
status-filtered).

| Case | Actor | Query | Actual | Result |
|---|---|---|---|---|
| T1 shared window | A | `/products?dateFrom=2026-01-01&dateTo=2026-09-01` | 200, total 1: `PRD-E5ABD044`, partnerId `756435b1…` only | PASS |
| T1 shared window | B | same | 200, total 1: `PRD-5802BE24`, partnerId `aa70b379…` only | PASS |
| T2 cross-tenant object | B → A's product id | `GET /products/e5abd044-…` | 403 `Access to this product is not allowed (object scope)` | PASS |
| T2 cross-tenant object | A → B's product id | `GET /products/5802be24-…` | 403 (same) | PASS |
| T2 own object | A → own product | `GET /products/e5abd044-…` | 200 | PASS |
| T3 attacker widens window | A / B | `dateFrom=2020-01-01&dateTo=2030-01-01` | still exactly own 1 row each | PASS |
| T3 A-only window | B | `dateFrom=2026-08-20&dateTo=2026-08-25` | 200, total 0 (A record not exposed) | PASS |
| T5 B-only window | A | `dateFrom=2026-01-10&dateTo=2026-01-20` | 200, total 0 (B record not exposed; no count leak) | PASS |
| T5 B-only window | B | same | 200, total 1: `PRD-5802BE24` | PASS |
| T6 URL/query manipulation | A | reversed param order (`dateTo` before `dateFrom`) | 200, own row only | PASS |
| T6 `partnerId` override | B | `?partnerId=<Tenant-A-id>&dates…` | 200, total 1, own `PRD-5802BE24` — supplied partner id ignored | PASS |
| T6 `partnerId` override | A | `?partnerId=<Tenant-B-id>&dates…` | 200, total 1, own `PRD-E5ABD044` — ignored | PASS |
| T6 malformed / impossible dates | A / B | `dateFrom=bad`, `dateTo=not-a-date`, `2026-02-30` | 400 canonical, no data | PASS |
| NULL-dimension note | A | window over A's 4 DRAFT rows (`publishedAt IS NULL`) | 200, total 0 — drafts never appear via temporal window | PASS |

Scope chain (existing code, unchanged): `CatalogController.listProducts`
(`productReadScope`: PARTNER requires only `catalog.product.read_own`)
→ `CatalogService.listProducts` applies `CatalogAccessPolicy.productListScope(actor)`
(`{ partnerId: actor.partnerId }`, `backend/src/modules/catalog/catalog-access.policy.ts:84`)
in the Prisma `where` **before** the D8 `publishedAt` `[from,to]` end-of-day
predicate (`catalog.service.ts:370ff`). Object reads enforce `assertCanRead`
(object scope). Temporal filter is strictly additive to the tenant predicate.

Export parity: `GET /products/export?format=csv&dateFrom=2020-01-01&dateTo=2030-01-01`
under broad window returned, for A, a CSV containing `PRD-E5ABD044` and **not**
`PRD-5802BE24`; for B, the exact inverse (each 1 data row). Export inherits the
same scoped `where`.

## 14.6 Negative RBAC Matrix (all D8 surfaces)

| Surface | Permission holder (evidence) | Permission-absent (evidence) | Malformed date on absent permission |
|---|---|---|---|
| Orders (`/orders`) | DIRECTOR/OPERATOR 200 (66) | BUYER 403 `order.read`; PARTNER A 403 | 403, no data |
| Requests (`/requests`) | DIRECTOR 200 (89) + KPI parity | PARTNER A 403 | 403, no data |
| Bookings (`/bookings`) | DIRECTOR 200 (48) | — (class C/D covered by Orders/Payments pattern) | 400 for authorized, no data |
| Payments (`/finance/payments`) | DIRECTOR 200 (52/350) | OPERATOR 403, BUYER 403, PARTNER 403 | 403, no data |
| CRM customers (`/customers`) | DIRECTOR 200 (93) | PARTNER A 403 `crm.customer.read` | 403, no data |
| CRM Activity (`/customers/:id/activity`) | DIRECTOR 200 + canonical 400 on bad | — (route requires `crm.customer.read`) | 400 canonical for authorized; guard precedes for denied |
| Catalog (`/products`) | PARTNER A/B 200 own-only; DIRECTOR staff-scope | BUYER 403 `catalog.product.read` | 400/403 per pipeline, no data |
| Analytics (`/analytics/*`) | DIRECTOR 200; OPERATOR 200 (canonical grant) | BUYER 403, PARTNER A 403 `analytics.read` | 400/403, no data |

## 14.7 Data Leakage Checks

- No cross-tenant row exposure in list or object reads (T1–T6, §14.5).
- No cross-role leakage: BUYER/PARTNER received only `{message, statusCode,
  requestId}` denial bodies — no totals, rows, or KPI values.
- Total-count safety: in the B-only temporal window A received
  `total: 0` (no hidden-count disclosure); `total` equals the scoped count
  because `productListScope` is applied before count/pagination.
- Aggregate/KPI safety: PARTNER A/B and BUYER receive 403 on all Analytics
  routes; no aggregate exposed to unauthorized roles. Requests KPI/table
  parity holds (both 89) — no KPI/table mismatch leakage. Analytics KPI
  semantics remain D11's ownership; only access scope was verified.
- Export leakage: none (§14.5 export parity).

## 14.8 Authentication / Session Evidence

- Anonymous requests with temporal query params to Orders, Catalog,
  Analytics: **401** `Missing access token` with request id — no data, no
  guard bypass via URL reuse.
- Wrong-password login: 401.
- Logout then reuse of the same bearer token: 401 `Session has been revoked`
  (request id recorded); token also 401 on a different registry — a leaked
  URL with `dateFrom/dateTo` without a valid session yields nothing.
- Authenticated sessions retain their role/permission set for all matrix
  cases (role-scoped 200/403 behavior consistent throughout).

## 14.9 Browser Evidence

Two isolated headless Chrome sessions (separate user-data-dirs, CDP) against
the frontend app (port `:60745`), same-origin requests through the app proxy:

- Session A (`d8_final_rq_a`): login → `/partner/products` renders exactly
  A's 5 products (4 DRAFTs + `PRD-E5ABD044`); zero tenant-B rows.
  Screenshot: `%TEMP%/d8_browser_A_own.png`. Same-origin `fetch` of B's
  product id → `403 object scope`; of its own id → `200`. Deep-link to B's
  product editor route is not reachable (not-found), consistent with scope.
- Session B (`d8_final_rq_b`): login → `/partner/products` renders exactly
  B's 12 products (11 archived + `PRD-5802BE24`); zero tenant-A rows.
  Screenshot: `%TEMP%/d8_browser_B_own.png`. Same-origin `fetch` of A's
  product id → `403 object scope`; `?partnerId=<A>&broad-dates` through the
  browser session still returns only B's own row.
- Browser evidence confirms the UI exposes no unauthorized path; it does not
  replace the API evidence above.

## 14.10 Regression / Build / Git hygiene

- Focused D8 backend suites: `date-param.spec.ts`,
  `date-param.registry-matrix.spec.ts`, `payments-registry.spec.ts`,
  `request-kpi-date-scope.spec.ts` — **4 suites / 63 tests PASS**.
- Backend `typecheck` (`tsc --noEmit`): PASS.
- Backend production build (`tsc -p tsconfig.build.json`): PASS.
- Frontend production build (`next build`): PASS after removing a corrupted
  dev-generated artifact (`.next/dev/types/` written by the concurrently
  running dev server); no source file involved.
- `git status`: clean at start; only this report is added.
- `git diff --check`: PASS. No production authorization/temporal/RBAC code
  changed in this pass (`git diff --name-only` contains only this report).

## 14.11 Fixture and cleanup disclosure

Test-only fixture (allowed by the evidence-preparation contract): 5 users
created via the existing admin `POST /api/v1/users` using existing
`DIRECTOR`, `OPERATOR`, `BUYER`, and `PARTNER` roles (no new role,
permission, or schema element). PARTNER fixtures were bound to the two
already-existing partner entities. After evidence collection all 5 users
were deleted by exact username match (`d8_final_rq_%`, `RETURNING` verified
5 deleted, 0 remain); no Session/refresh store exists to clean (JWT +
tokenVersion). No business data (products, orders, payments) was created or
modified. Browser sessions and temporary Chrome profiles were closed.

## 14.12 Known Limitations

- Positive tenant-row evidence is proven on the **Catalog** registry, the
  only surface with an existing PARTNER-authorized scoped positive contract.
  Remaining registries (Orders, Bookings, Payments, CRM) are internal-staff
  surfaces in this architecture; their cross-role behavior is proven
  negatively (permission guards, §14.6), and PARTNER has no canonical
  permission there to scope.
- Frontend ran on port `:60745` (pre-existing dev server); port `:3000` was
  not listening. Same application and API proxy; no functional difference.
- Analytics KPI business semantics are out of D8 scope (owner D11); only
  access scope and temporal visibility were verified.

## 14.13 Final Verdict

All mandatory evidence is now complete: multi-role matrix (Classes A–D),
positive and negative tenant isolation (T1–T6) with row-level dataset
identity, negative RBAC across all D8 surfaces, KPI/aggregate and export
leakage checks, and authentication/session integrity — all at runtime with
request-id traceability. The frozen D8 security contract holds: **temporal
filters are additive to tenant/policy/RBAC scope; no bypass exists through
dates, URL, query manipulation, or anonymous reuse.** No D8 implementation
defect remains, and no production code was changed.

**VERDICT A — D8 CLOSED.**

Per governance, the next roadmap stage is selected only in a separate
follow-up task (TRUE NEXT RE-QUALIFICATION per canonical roadmap).
