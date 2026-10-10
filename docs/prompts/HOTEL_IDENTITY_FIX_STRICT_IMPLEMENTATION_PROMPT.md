# HOTEL_IDENTITY_FIX_STRICT_IMPLEMENTATION_PROMPT

## 0. Execution Contract

Implement **only** the two confirmed defects from the read-only
`HOTEL_IDENTITY_AUDIT_REPORT.md`:

1. Product lookup mismatch:
   `Request.hotelExternalId` must resolve catalog `Product.attributes.hotelKey`
   for SAMO-family suppliers, while remaining compatible with a possible
   `Product.attributes.hotelExternalId`.
2. Request conversion projection mismatch:
   a product-less Request with a valid frozen `Request.productSnapshot`
   must not be hidden from the UI solely because `productId = NULL`.

This is an implementation task, not an architecture redesign.

### HARD RULES

- Do NOT remove `hotelExternalId`.
- Do NOT remove or rename `hotelKey`.
- Do NOT introduce a new universal supplier identifier field.
- Do NOT migrate or rewrite the existing 3010 catalog Products.
- Do NOT make sync services write duplicate `hotelExternalId` into Product merely
  to compensate for the lookup defect.
- Do NOT change ANEX identifier semantics.
- Do NOT change supplier adapter contracts unless a regression test proves an
  existing mapping contract is broken.
- Do NOT modify Prisma schema or create a migration.
- Do NOT change public HTTP parameter names.
- Do NOT alter Supplier Markup architecture.
- Do NOT alter Storefront CommissionPolicy.
- Do NOT alter Request ⇄ Order ⇄ Booking lifecycle semantics.
- Do NOT implement Booking → Order in this task.
- Do NOT commit or push without explicit owner permission.

The canonical identity architecture remains:

    transport = hotelExternalId
    storage   = supplier-native hotelKey
    mapping   = adapter / lookup boundary

---

# 1. Source of Truth

The implementation MUST follow the findings of:

`HOTEL_IDENTITY_AUDIT_REPORT.md`

Confirmed facts:

- `hotelExternalId` is the platform transport/DTO contract.
- `hotelKey` is supplier-native catalog identity for
  SUMMERTOUR/KOMPAS/KAZUNION.
- ANEX uses `hotelInc` and has no `hotelKey`.
- SUMMERTOUR/KOMPAS/KAZUNION currently store:
  `Product.attributes.hotelKey`.
- Current catalog reality:
  - KAZUNION: 2677 products with hotelKey
  - SUMMERTOUR: 310 products with hotelKey
  - KOMPAS: 22 products with hotelKey
  - hotelExternalId in Product: 0/3010
- `tour-request.service.ts` currently looks up only
  `Product.attributes.hotelExternalId`, which makes the catalog lookup fail.
- The existing execution conversion path can work with a product-less Request
  using the frozen product snapshot.
- The Request projection can nevertheless return `convert=false` because it
  derives its projection snapshot from a live Product using `productId`.

Do not reinterpret these findings during implementation.

---

# 2. Preflight — READ ONLY

Before editing anything, inspect the current repository state.

Required checks:

- current branch and HEAD;
- git status;
- exact current implementation of:
  - `backend/src/modules/supplier/tour-request.service.ts`
  - `backend/src/modules/supplier/tour-request.service.spec.ts`
  - `backend/src/modules/order/request.service.ts`
- current Request/Product types and relevant DTOs;
- current `computeRequestAvailableActions`;
- current Request conversion execution path;
- current tests around Request → Order;
- current supplierCode representation;
- current Prisma JSON filtering syntax already used in the repository.

Do not overwrite unrelated dirty work.

If any target file contains mixed/unrelated owner work, isolate only the required
hunks. Do not reset, checkout, clean, stash, or otherwise destroy existing work.

---

# 3. FIX A — Product Lookup

## 3.1 Objective

At the Request creation boundary, map:

    dto.supplierCode
    dto.hotelExternalId
            ↓
    Product.attributes

The lookup MUST support:

    attributes.hotelExternalId == dto.hotelExternalId

OR:

    attributes.hotelKey == dto.hotelExternalId

AND it MUST be constrained by:

    attributes.supplierCode == dto.supplierCode

The supplierCode guard is mandatory.

## 3.2 Required behavior

For SUMMERTOUR/KOMPAS/KAZUNION:

    dto.hotelExternalId
          ↓
    attributes.hotelKey
          ↓
    Product

For a future/legacy Product that actually contains:

    attributes.hotelExternalId

that lookup must also continue to work.

For ANEX:

- Do not invent `hotelKey`.
- Do not rewrite ANEX identifiers.
- If no ANEX Product exists in the catalog, the current product-less behavior
  remains valid.
- The request must still be allowed to proceed according to the existing
  ANEX flow.

## 3.3 Collision protection

Never perform an unrestricted lookup by numeric hotel ID alone.

The effective condition must be:

    supplierCode == dto.supplierCode
    AND
    (
      hotelKey == dto.hotelExternalId
      OR
      hotelExternalId == dto.hotelExternalId
    )

This protects against identical supplier-native IDs across suppliers.

## 3.4 No data migration

Do NOT backfill:

    Product.attributes.hotelExternalId

into the existing 3010 Products.

Do NOT modify catalog rows.

The fix is a read-side mapping fix.

---

# 4. FIX B — Request Conversion Projection

## 4.1 Objective

Fix the projection so that a Request with:

- `productId = NULL`
- valid frozen `Request.productSnapshot`
- required acceptance state
- valid commercial/money state
- no converted Order

is not incorrectly reported as:

    convert = false

solely because the live Product cannot be loaded.

## 4.2 Projection rule

The projection should use:

1. live Product snapshot when `productId` resolves successfully;
2. otherwise the frozen `Request.productSnapshot` when it is valid.

Do NOT weaken other conversion gates.

The following must remain authoritative:

- Request lifecycle/status rules;
- acceptance state;
- commercial/money gates;
- existing conversion guards;
- idempotency / already-converted guard;
- permissions;
- any existing D3/frozen-snapshot requirements.

This is a projection correction, not an authorization bypass.

## 4.3 Execution remains authoritative

Do not duplicate or replace the existing Request → Order execution logic.

The UI projection may indicate:

    convert = true

only when the same existing preconditions represented by the projection
are satisfied.

The actual conversion endpoint remains the final authority.

---

# 5. Tests — REQUIRED

Update existing unrealistic mocks so tests represent production data.

## 5.1 tour-request.service.spec.ts

The current mock that pretends Product contains:

    attributes.hotelExternalId

must be corrected.

Add/modify tests for:

### A. SUMMERTOUR

Input:

    supplierCode = SUMMERTOUR
    hotelExternalId = "1144"

Product:

    attributes = {
      supplierCode: "SUMMERTOUR",
      hotelKey: "1144"
    }

Expected:

    productId != NULL

### B. KOMPAS

Use a real-format hotelKey fixture, e.g. the existing repository fixture
corresponding to the KOMPAS domain.

Expected:

    productId != NULL

### C. KAZUNION

Same behavior.

### D. Cross-supplier collision

Create two Products with the same hotelKey but different supplierCode.

Request:

    supplierCode = SUPPLIER_A
    hotelExternalId = "123"

Expected:

- only SUPPLIER_A Product is selected;
- SUPPLIER_B Product is not selected.

### E. Legacy/alternative Product key

Product:

    attributes.hotelExternalId = "123"

Expected:

    productId != NULL

This proves backward compatibility without requiring catalog migration.

### F. ANEX

Where no ANEX catalog Product exists:

    hotelExternalId = hotelInc value

Expected:

- productId remains NULL;
- Request creation does not fail solely because Product is absent;
- existing productSnapshot/request behavior remains intact.

---

# 6. Projection Tests

Add tests for `computeRequestAvailableActions` / the relevant projection path.

## Required case

Request:

    productId = NULL
    productSnapshot = valid frozen snapshot
    status = CUSTOMER_ACCEPTED
    money/commercial gates = valid
    convertedOrderId = NULL

Expected:

    convert = true

## Negative cases

Verify that `convert` remains false when:

- frozen productSnapshot is absent/invalid;
- money/commercial requirements are invalid;
- Request is not in the required lifecycle state;
- Request has already been converted;
- existing permission/guard requirements fail.

Do not weaken unrelated gates.

---

# 7. Integration / E2E Regression

Add or extend a realistic catalog Request flow.

Required scenario:

    real Product
      ↓
    Product.attributes.hotelKey
      ↓
    public/catalog offer
      ↓
    hotelExternalId transport value
      ↓
    create Request
      ↓
    Product resolved
      ↓
    productId != NULL

Then test the product-less case:

    Request
      productId = NULL
      frozen productSnapshot = valid
      ↓
    CUSTOMER_ACCEPTED
      ↓
    convert projection
      ↓
    convert = true
      ↓
    existing conversion execution
      ↓
    Order created successfully

Where the existing test infrastructure makes this possible, use actual seeded
catalog data or realistic fixtures rather than mocks that invent
`attributes.hotelExternalId` as the production catalog shape.

---

# 8. Supplier Mapping Regression

Do not rewrite adapter logic, but preserve explicit contract tests for:

SUMMERTOUR:

    query.hotelExternalId
        →
    supplier-native HOTELS=<hotelKey>

KOMPAS:

    query.hotelExternalId
        →
    supplier-native hotelKey / HOTELS parameter

KAZUNION:

    query.hotelExternalId
        →
    supplier-native hotelKey / HOTELS parameter

ANEX:

    query.hotelExternalId
        →
    hotelInc

These tests exist to make the transport/native mapping explicit.

---

# 9. Forbidden Changes

The implementation MUST NOT:

- rename `hotelKey`;
- rename `hotelExternalId`;
- create `hotelExternalId` inside every Product;
- add a Prisma `hotelExternalId` column;
- create a new generic `supplierExternalId` field;
- replace supplier-native identifiers with a platform-global ID;
- alter SupplierGeoLink semantics;
- alter supplier adapter ownership of native identifiers;
- change catalog code/slug/photo conventions;
- alter ANEX to pretend it is SAMO;
- alter Supplier Markup calculation;
- alter Storefront seller commission;
- alter payment semantics;
- alter Request/Order/Booking lifecycle;
- introduce a new Product identity abstraction.

---

# 10. Scope

Expected primary implementation files:

1. `backend/src/modules/supplier/tour-request.service.ts`
2. `backend/src/modules/supplier/tour-request.service.spec.ts`
3. `backend/src/modules/order/request.service.ts`
4. relevant existing projection/request tests
5. relevant E2E/integration test files if required

Do not modify:

- `schema.prisma`
- migrations
- supplier sync services
- catalog data
- public API parameter names
- unrelated supplier adapters

unless a test demonstrates a directly related defect.

---

# 11. Validation Gates

All gates are mandatory.

### Gate A — TypeScript

Backend typecheck:

    PASS

Frontend typecheck if affected:

    PASS

### Gate B — Unit tests

All directly affected backend suites:

    PASS

### Gate C — Supplier regression

SUMMERTOUR/KOMPAS/KAZUNION/ANEX mapping tests:

    PASS

### Gate D — Product lookup

All required lookup cases:

    PASS

### Gate E — Collision protection

Same ID across different suppliers:

    PASS

### Gate F — Projection

Product-less frozen-snapshot Request:

    convert = true

when all other gates are valid.

### Gate G — Negative projection

Invalid snapshot/status/money/already-converted cases:

    convert = false

### Gate H — Request → Order

Existing conversion flow remains green.

### Gate I — Existing lifecycle regression

Existing Request → Order → Booking and reverse lifecycle tests:

    NO REGRESSION

Do not modify lifecycle semantics.

### Gate J — Data integrity

Verify:

    3010 existing catalog Products remain unchanged

No migration/backfill is permitted.

### Gate K — Git safety

Confirm no unrelated dirty work was overwritten.

### Gate L — Final regression

Run the relevant existing regression set and classify failures.

Do not call unrelated pre-existing failures regressions without evidence.

---

# 12. Acceptance Criteria

Implementation is accepted only if ALL are true:

1. `hotelExternalId` remains the public/platform transport identifier.
2. `hotelKey` remains supplier-native catalog identity.
3. SUMMERTOUR catalog Requests resolve Product through `hotelKey`.
4. KOMPAS catalog Requests resolve Product through `hotelKey`.
5. KAZUNION catalog Requests resolve Product through `hotelKey`.
6. ANEX remains compatible with `hotelInc`.
7. SupplierCode prevents cross-supplier ID collisions.
8. No Product migration is performed.
9. No duplicate identity field is introduced.
10. Product-less Requests with valid frozen snapshots are not hidden from
    conversion solely because `productId` is NULL.
11. Existing money/status/permission/conversion guards remain intact.
12. Request → Order behavior remains intact.
13. Existing supplier mapping behavior remains intact.
14. Tests reflect real production catalog shape.
15. Typecheck and relevant tests are green.
16. No unrelated dirty work is overwritten.
17. No commit/push occurs without explicit owner approval.

---

# 13. Required Final Report

At completion, produce:

## 13.1 Implementation Summary

List every changed file and exact purpose.

## 13.2 Identity Architecture Confirmation

Explicitly confirm:

    transport = hotelExternalId
    storage   = hotelKey
    mapping   = adapter / lookup boundary

## 13.3 Fix A Result

Show:

- lookup behavior;
- supplierCode guard;
- SUMMERTOUR result;
- KOMPAS result;
- KAZUNION result;
- ANEX result;
- legacy hotelExternalId compatibility.

## 13.4 Fix B Result

Show:

- projection behavior with productId;
- projection fallback to frozen productSnapshot;
- preserved conversion gates.

## 13.5 Tests

Report exact:

- suites;
- tests;
- pass/fail;
- typecheck;
- E2E/integration results;
- any unrelated pre-existing failures.

## 13.6 Data Safety

Explicitly report:

    Product rows changed: 0
    Migration: none
    Prisma schema changed: no

## 13.7 Git Safety

Report:

- HEAD before/after;
- modified files;
- unrelated dirty files preserved;
- commit: NO
- push: NO

unless the owner explicitly authorized otherwise.

## 13.8 Final Verdict

Use exactly one:

    PASS — READY FOR OWNER REVIEW

or

    FAIL — IMPLEMENTATION BLOCKED

If FAIL, list the exact blocking gate(s).

---

# 14. Owner Decision Boundary

After implementation and validation, STOP.

Do not:

- commit;
- push;
- start another architecture refactor;
- modify supplier identity architecture;
- start Live Sales Service Builder work;
- change pricing;
- change Booking lifecycle.

Wait for explicit owner instruction for the next phase.
