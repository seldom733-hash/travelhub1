# Phase 3 D8 — Tenant Isolation Evidence Preparation

**Scope:** evidence preparation only; this report does not close D8 or replace the
separate final security requalification.

## Baseline and environment

- Canonical baseline: `48471cbefd7a07a660ae365d200b925c53bc6057`
- Branch/remote at start: `master` / `origin/master`, equal to the baseline.
- Runtime exercised: local PostgreSQL, backend on `:4000`, frontend on `:3000`.
- No production source, authorization guard, RBAC role, schema, or model was
  changed.

## Existing positive-scope contract selected

The suitable existing D8 registry is **Catalog** (`GET /api/v1/products`).  It
already has a positive PARTNER path:

- `CatalogController.productReadScope()` requires only
  `catalog.product.read_own` for `PARTNER`.
- `CatalogAccessPolicy.productListScope(actor)` returns
  `{ partnerId: actor.partnerId }`; the `CatalogService` includes that scope in
  the list `where` clause before its D8 `publishedAt` `[from,to)` predicate.
- `getProduct` applies the same object-scope policy.

This is an existing product contract, not a new D8 scope or authorization
mechanism.

## Test fixture and cleanup

Tenant A used the existing active PARTNER account
`partner_role@travelhub.local`, bound to
`756435b1-a989-4f6e-b845-7f192a8d1e3d`.

For the positive tenant-B evidence only, a synthetic active PARTNER user was
created in the local dev database and bound to the already existing tenant B
`aa70b379-5d42-4f33-94b5-067fb6b31281`.  It used the existing `PARTNER` role
and its existing permissions; no role or permission was added.  After the
browser checks the fixture was deleted by its exact id/code/partner-id match
(`USR-D8-EVIDENCE-B`).  No test account remains.

## Authenticated browser-runtime evidence

Two independent authenticated browser sessions issued same-origin requests to
the frontend proxy.  The shared temporal window was
`dateFrom=2026-01-01&dateTo=2026-09-01`, which is a half-open window and
contains both tenants' published records.

| Actor | Shared-window result | Broad-window result (`2020-01-01` to `2030-01-01`) |
| --- | --- | --- |
| Tenant A PARTNER | `200`, total `1`: `PRD-E5ABD044`, partnerId `756435b1-a989-4f6e-b845-7f192a8d1e3d` | `200`, total `1`, the same A record only |
| Tenant B PARTNER | `200`, total `1`: `PRD-5802BE24`, partnerId `aa70b379-5d42-4f33-94b5-067fb6b31281` | `200`, total `1`, the same B record only |

Representative request IDs were recorded for each authenticated request:
`fa8c1346-f602-4a60-8475-73e1f3b769ac` (A shared),
`97dfbb99-0a02-4db0-96d0-280c0e100822` (A broad),
`88b4ff72-3c7d-4e94-b9d4-6764c65fef80` (B shared), and
`babaa256-3112-4976-92ff-c522df097361` (B broad).

Tenant B then attempted two scope-bypass cases:

1. `GET /api/v1/products?partnerId=<tenant-A-id>&dateFrom=2020-01-01&dateTo=2030-01-01`
   returned `200`, total `1`, containing only B's product.  The supplied
   partner id did not override actor scope (request id
   `68673463-e4e3-47e7-ae27-a3f76a46af70`).
2. `GET /api/v1/products/e5abd044-ecb5-4d14-aff4-e0af36cbb5d8` (A's object)
   returned `403` with `Access to this product is not allowed (object scope)`
   (request id `dcae7abb-4a4b-4eb9-93e5-a9e152ffbb53`).

The partner UI was also loaded under tenant B at `/partner/products`; its list
contained only B-owned catalog records.  That partner page has no D8 date
controls, so the temporal assertion above is deliberately recorded as the
authenticated runtime API contract rather than attributed to a nonexistent UI
control.

## Scope boundary

This establishes a reusable positive tenant-scoped D8 registry fixture for
Catalog, including temporal range and bypass attempts.  It does **not**
requalify all D8 registries, perform the final cross-registry RBAC matrix, or
close D8.  A separate final security requalification remains required.

## Result

**EVIDENCE READY**
