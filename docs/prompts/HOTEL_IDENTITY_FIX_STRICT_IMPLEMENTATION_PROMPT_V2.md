# HOTEL IDENTITY FIX — STRICT IMPLEMENTATION PROMPT V2

## Supplier-Native Identity Mapping + Request Product Resolution + Conversion Projection

---

# 0. PURPOSE

Implement the confirmed Hotel Identity fixes in TravelHUB while explicitly
preserving the architectural boundary between:

1. the **platform transport identifier** used by generic TravelHUB supplier
   contracts; and
2. the **supplier-native identifier** used internally by each supplier adapter
   and catalog.

This task has THREE controlled objectives:

### FIX A
Repair Product lookup for catalog Requests.

### FIX B
Repair Request conversion projection for product-less Requests with a valid
frozen product snapshot.

### ARCHITECTURAL CONTRACT
Explicitly preserve and test the supplier-native identity mapping boundary so
future suppliers can use their own native identifier names without forcing
those names into generic TravelHUB code.

This is NOT a broad supplier-adapter refactor.

---

# 1. SOURCE OF TRUTH

Use the read-only:

`HOTEL_IDENTITY_AUDIT_REPORT.md`

The audit established:

- `hotelExternalId` is a platform transport/DTO identifier.
- `hotelKey` is supplier-native identity for the SAMO family:
  SUMMERTOUR / KOMPAS / KAZUNION.
- ANEX uses `hotelInc`.
- The three SAMO-family suppliers currently normalize their native
  `hotelKey` into platform `hotelExternalId`.
- ANEX normalizes `hotelInc` into platform `hotelExternalId`.
- Product catalog currently stores `hotelKey` for the SAMO family.
- Product catalog contains 3010 relevant tour Products:
  - KAZUNION: 2677
  - SUMMERTOUR: 310
  - KOMPAS: 22
- `Product.attributes.hotelExternalId` exists in zero of those 3010 Products.
- The current Request Product lookup incorrectly searches only
  `attributes.hotelExternalId`.
- This causes catalog Requests to receive `productId = NULL`.
- Existing execution conversion can operate from a frozen product snapshot.
- The Request projection can nevertheless hide conversion because it tries
  to reconstruct the product snapshot from `productId`.

Do not reinterpret these findings.

---

# 2. NON-NEGOTIABLE IDENTITY ARCHITECTURE

The implementation MUST preserve this architecture:

```text
                    TravelHUB
                       │
             platform transport ID
                       │
               hotelExternalId
                       │
             Supplier Adapter Boundary
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   SUMMERTOUR       KOMPAS         KAZUNION
        │              │              │
    hotelKey        hotelKey        hotelKey

                       │
                       ▼
                     ANEX
                       │
                    hotelInc
```

The key rule is:

> **Generic TravelHUB code uses the platform transport concept
> `hotelExternalId`. The supplier adapter owns the mapping from that platform
> concept to the supplier's native identifier.**

Examples:

```text
SUMMERTOUR:
hotelExternalId → hotelKey

KOMPAS:
hotelExternalId → hotelKey

KAZUNION:
hotelExternalId → hotelKey

ANEX:
hotelExternalId → hotelInc

Future Supplier A:
hotelExternalId → hotelId

Future Supplier B:
hotelExternalId → objectId

Future Supplier C:
hotelExternalId → hotelReference
```

The future supplier's native field name MUST NOT require changes to the generic
TravelHUB domain contract merely because the supplier calls its identifier
something different.

---

# 3. IMPORTANT DISTINCTION

Do NOT interpret the architecture as:

```text
hotelExternalId == hotelKey
```

That is NOT the contract.

The correct interpretation is:

```text
hotelExternalId
    =
platform representation of
supplier's external hotel identity

hotelKey / hotelInc / hotelId / objectId / ...
    =
supplier-native representation
```

For current SAMO-family suppliers the values happen to be equal after adapter
normalization.

For ANEX:

```text
hotelExternalId = hotelInc
```

There is no `hotelKey`.

Therefore:

- equality of values is an implementation mapping;
- equality of semantics MUST NOT be assumed;
- supplier-native names MUST remain adapter-owned.

---

# 4. HARD RULES

## 4.1 MUST NOT

Do NOT:

- remove `hotelExternalId`;
- remove `hotelKey`;
- rename `hotelExternalId`;
- rename `hotelKey`;
- introduce `hotelInc` into generic Product identity;
- introduce `hotelId`, `objectId`, etc. into generic Product identity;
- create a universal `supplierExternalId` field as a replacement;
- collapse supplier-native identifiers into one database field;
- migrate the existing 3010 Products;
- backfill `Product.attributes.hotelExternalId` merely to fix lookup;
- change public HTTP query parameter names;
- alter SupplierGeoLink semantics;
- alter supplier-native catalog code/slug/photo conventions;
- alter ANEX semantics;
- make generic services contain supplier-specific `if/else` identifier mappings;
- add supplier-specific identifier switches to shared domain code;
- refactor every adapter in this task;
- modify Prisma schema;
- create migrations;
- modify Supplier Markup;
- modify Storefront CommissionPolicy;
- modify Request ⇄ Order ⇄ Booking lifecycle;
- implement Booking → Order;
- commit or push without explicit owner permission.

---

# 5. PRE-FLIGHT

Before editing:

1. Check branch and HEAD.
2. Check `git status`.
3. Inspect:
   - `backend/src/modules/supplier/tour-request.service.ts`
   - `backend/src/modules/supplier/tour-request.service.spec.ts`
   - `backend/src/modules/order/request.service.ts`
   - relevant supplier adapter interfaces/types
   - SUMMERTOUR adapter
   - KOMPAS adapter
   - KAZUNION adapter
   - ANEX adapter
   - current Request conversion execution path
   - current Request projection logic
   - existing supplier identity tests
4. Determine the exact current representation of `supplierCode`.
5. Determine whether an existing adapter interface already provides an
   appropriate place for native identity mapping.
6. Do not invent a second abstraction if an equivalent existing mechanism
   already exists.

If target files contain unrelated dirty work:

- preserve it;
- edit only required hunks;
- do NOT reset;
- do NOT checkout;
- do NOT clean;
- do NOT stash unrelated work.

---

# 6. ARCHITECTURAL CONTRACT — SUPPLIER-NATIVE ID MAPPING

## 6.1 Current responsibility

The supplier adapter is responsible for translating:

```text
TravelHUB transport identifier
        ↓
supplier-native request parameter
```

and, when normalizing supplier responses:

```text
supplier-native identifier
        ↓
TravelHUB hotelExternalId
```

Examples already confirmed by the audit:

```text
SUMMERTOUR:
raw.hotelKey → SupplierOffer.hotelExternalId

KOMPAS:
raw.hotelKey → SupplierOffer.hotelExternalId

KAZUNION:
raw.hotelKey → SupplierOffer.hotelExternalId

ANEX:
raw.hotelInc → SupplierOffer.hotelExternalId
```

The implementation MUST preserve this direction.

---

## 6.2 Generic code boundary

Generic code MUST NOT need to know whether the supplier calls the identifier:

- hotelKey;
- hotelInc;
- hotelId;
- objectId;
- reference;
- or another supplier-specific name.

Generic code should operate on:

```text
hotelExternalId
```

when communicating through the common supplier contract.

Supplier-specific native fields remain inside:

- adapter;
- supplier HTTP layer;
- supplier parser;
- supplier sync implementation;
- supplier-native catalog identity logic.

---

## 6.3 Do not over-engineer

Do NOT create a new abstraction merely for the sake of abstraction if the
existing adapter contract already expresses this mapping correctly.

The immediate task is:

1. preserve the current adapter boundary;
2. make its semantics explicit through tests/contracts where appropriate;
3. repair the missing mapping at Product lookup;
4. avoid scattering supplier-specific knowledge into generic services.

A broader adapter identity abstraction may be proposed in the final report if
the repository genuinely requires it, but it MUST NOT be implemented as part
of this task unless required to satisfy an existing architecture contract.

---

# 7. FIX A — PRODUCT LOOKUP

## 7.1 Objective

At Request creation:

```text
supplierCode
hotelExternalId
       ↓
Product
```

The Product lookup MUST support:

```text
attributes.hotelExternalId == dto.hotelExternalId
```

OR:

```text
attributes.hotelKey == dto.hotelExternalId
```

AND MUST constrain the lookup using:

```text
attributes.supplierCode == dto.supplierCode
```

---

## 7.2 Required logical condition

Conceptually:

```text
supplierCode == requested supplier
AND
(
    hotelExternalId == requested external ID
    OR
    hotelKey == requested external ID
)
```

The exact implementation MUST follow the repository's existing Prisma JSON
query conventions.

---

## 7.3 Why supplierCode is mandatory

Never resolve a Product by numeric hotel ID alone.

Example:

```text
SUMMERTOUR hotelKey = 1144
KAZUNION  hotelKey = 1144
```

These are not necessarily the same hotel.

The lookup MUST remain supplier-scoped.

---

# 8. FIX B — REQUEST CONVERSION PROJECTION

## 8.1 Objective

A Request with:

```text
productId = NULL
productSnapshot = valid frozen snapshot
CUSTOMER_ACCEPTED
money/commercial gates valid
not already converted
```

must not receive:

```text
convert = false
```

solely because `productId` is NULL.

---

## 8.2 Projection precedence

Use:

1. live Product snapshot when Product exists;
2. otherwise frozen Request.productSnapshot when valid.

Do NOT weaken:

- status gates;
- acceptance gates;
- money/commercial gates;
- permission gates;
- idempotency;
- already-converted guards;
- other existing conversion guards.

Execution remains authoritative.

---

# 9. SUPPLIER-SPECIFIC REGRESSION TESTS

The implementation MUST add/repair tests proving the adapter boundary.

## 9.1 SUMMERTOUR

Verify:

```text
supplier-native:
hotelKey = "1144"

adapter normalization:
hotelExternalId = "1144"
```

and:

```text
hotelExternalId = "1144"
        ↓
supplier request
        ↓
HOTELS=1144
```

---

## 9.2 KOMPAS

Verify:

```text
raw.hotelKey
    ↓
hotelExternalId
```

and reverse supplier request mapping.

---

## 9.3 KAZUNION

Verify:

```text
raw.hotelKey
    ↓
hotelExternalId
```

and reverse supplier request mapping.

---

## 9.4 ANEX

Verify:

```text
raw.hotelInc
    ↓
hotelExternalId
```

and:

```text
hotelExternalId
    ↓
ANEX hotelInc filter/request
```

There MUST be no expectation that ANEX has `hotelKey`.

---

# 10. PRODUCT LOOKUP TEST MATRIX

Required tests:

### A. SUMMERTOUR

```text
supplierCode = SUMMERTOUR
hotelExternalId = "1144"

Product:
{
  supplierCode: "SUMMERTOUR",
  hotelKey: "1144"
}
```

Expected:

```text
productId != NULL
```

### B. KOMPAS

Same structure using KOMPAS fixture.

Expected:

```text
productId != NULL
```

### C. KAZUNION

Same structure using KAZUNION fixture.

Expected:

```text
productId != NULL
```

### D. Same ID / different supplier

Two Products:

```text
A:
supplierCode = SUPPLIER_A
hotelKey = "123"

B:
supplierCode = SUPPLIER_B
hotelKey = "123"
```

Request:

```text
supplierCode = SUPPLIER_A
hotelExternalId = "123"
```

Expected:

```text
A selected
B not selected
```

### E. Legacy/alternative Product key

Product:

```text
supplierCode = SOME_SUPPLIER
hotelExternalId = "123"
```

Expected:

```text
productId != NULL
```

This verifies compatibility with any existing Product records using that key.

### F. ANEX

No ANEX catalog Product.

Expected:

```text
productId = NULL
```

but Request creation remains valid according to existing behavior.

---

# 11. PROJECTION TEST MATRIX

Required:

### Positive

```text
productId = NULL
frozen productSnapshot = valid
CUSTOMER_ACCEPTED
money = valid
not converted
```

Expected:

```text
convert = true
```

### Negative

`convert = false` when:

- frozen snapshot absent/invalid;
- status invalid;
- money invalid;
- already converted;
- existing permission/guard fails.

---

# 12. REALISTIC REQUEST → ORDER REGRESSION

Test:

```text
Catalog Product
    ↓
attributes.hotelKey
    ↓
Offer
    ↓
hotelExternalId
    ↓
Request
    ↓
Product resolved
    ↓
productId != NULL
```

Then test product-less:

```text
Request
productId = NULL
valid frozen productSnapshot
    ↓
CUSTOMER_ACCEPTED
    ↓
projection
    ↓
convert = true
    ↓
existing conversion endpoint
    ↓
Order
```

Do not invent a second conversion path.

---

# 13. TEST QUALITY REQUIREMENT

The existing audit identified a false-confidence test:

the Product mock accepts any `findFirst` where clause and therefore can pass
even though production contains no `hotelExternalId` Product attributes.

Replace such mocks with realistic fixtures.

Tests MUST model actual production catalog shape:

```text
SAMO-family Product:
attributes.hotelKey
attributes.supplierCode
```

not an invented:

```text
attributes.hotelExternalId
```

unless explicitly testing backward compatibility.

---

# 14. DATA SAFETY

The implementation MUST NOT modify catalog data.

Expected:

```text
Product rows changed: 0
```

No:

- UPDATE;
- INSERT;
- DELETE;
- backfill;
- migration;
- Prisma schema modification.

---

# 15. EXPECTED IMPLEMENTATION SCOPE

Expected primary files:

```text
backend/src/modules/supplier/tour-request.service.ts
backend/src/modules/supplier/tour-request.service.spec.ts
backend/src/modules/order/request.service.ts
relevant Request projection tests
relevant supplier adapter tests
relevant integration/E2E tests
```

Supplier adapter source files should normally remain unchanged because the
current mapping is already implemented correctly.

If an adapter source change becomes necessary:

1. prove the defect with a failing test;
2. make the smallest possible change;
3. preserve the platform/native identity boundary;
4. explain it explicitly in the final report.

---

# 16. FORBIDDEN ARCHITECTURAL SHORTCUT

Do NOT solve the issue by changing sync services from:

```text
Product.attributes.hotelKey
```

to:

```text
Product.attributes.hotelKey
Product.attributes.hotelExternalId
```

for all 3010 products.

That creates duplicated identity data and future drift.

The correct solution is a read-side mapping:

```text
Request.hotelExternalId
        ↓
supplierCode
        ↓
supplier-native Product identity
```

---

# 17. FUTURE SUPPLIER REQUIREMENT

The implementation must leave the following future scenario possible:

A new supplier says:

```text
"My hotel identifier is objectId."
```

TravelHUB must be able to implement:

```text
new supplier adapter:
hotelExternalId ↔ objectId
```

without changing:

- generic Request DTO;
- generic Search DTO;
- generic Calendar DTO;
- generic Product domain contract;
- existing suppliers;
- ANEX;
- public HTTP parameter name.

This is an acceptance criterion.

---

# 18. VALIDATION GATES

All gates MUST pass.

### Gate A
Backend typecheck PASS.

### Gate B
Affected backend unit tests PASS.

### Gate C
Supplier adapter mapping tests PASS.

### Gate D
SUMMERTOUR/KOMPAS/KAZUNION Product lookup PASS.

### Gate E
ANEX behavior PASS.

### Gate F
Cross-supplier collision protection PASS.

### Gate G
Product-less Request projection PASS.

### Gate H
Negative projection cases PASS.

### Gate I
Request → Order regression PASS.

### Gate J
Existing lifecycle regression has no new failures.

### Gate K
Supplier Markup regression has no new failures.

### Gate L
No catalog data changed.

### Gate M
No schema/migration changes.

### Gate N
No unrelated dirty work overwritten.

---

# 19. FINAL REPORT

The implementation agent MUST produce a final report containing:

## 19.1 Changed files

Exact file list and purpose.

## 19.2 Identity architecture

Explicitly state:

```text
transport = hotelExternalId
storage   = supplier-native identity
mapping   = supplier adapter / lookup boundary
```

## 19.3 Supplier matrix

Report:

| Supplier | Native ID | Platform ID |
|---|---|---|
| SUMMERTOUR | hotelKey | hotelExternalId |
| KOMPAS | hotelKey | hotelExternalId |
| KAZUNION | hotelKey | hotelExternalId |
| ANEX | hotelInc | hotelExternalId |

If another supplier is discovered during implementation, report it separately;
do not silently change the architecture.

## 19.4 Fix A

Report:

- lookup logic;
- supplierCode guard;
- test results;
- productId resolution.

## 19.5 Fix B

Report:

- projection fallback;
- preserved gates;
- product-less conversion result.

## 19.6 Test results

Report exact:

- suites;
- tests;
- passed;
- failed;
- typecheck;
- E2E/integration.

Classify pre-existing failures separately.

## 19.7 Data safety

Explicitly report:

```text
Product data changed: NO
Migration: NO
Schema changed: NO
```

## 19.8 Git safety

Report:

```text
Commit: NO
Push: NO
```

unless owner explicitly authorized otherwise.

---

# 20. FINAL VERDICT

Use exactly one:

```text
PASS — READY FOR OWNER REVIEW
```

or:

```text
FAIL — IMPLEMENTATION BLOCKED
```

If FAIL, list exact failing gate(s).

---

# 21. STOP CONDITION

After implementation and validation STOP.

Do NOT automatically proceed to:

- broad adapter refactoring;
- new supplier integration;
- Partner/Supplier directory;
- Live Sales Service Builder;
- pricing redesign;
- Booking lifecycle changes;
- commits;
- pushes.

Those are separate owner decisions.
