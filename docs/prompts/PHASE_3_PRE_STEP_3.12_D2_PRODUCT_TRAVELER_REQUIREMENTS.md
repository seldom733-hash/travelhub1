# PHASE 3 PRE-STEP 3.12 D2 — Product Traveler Requirements

## Status: IMPLEMENTED (PENDING STRICT REVIEW)

## Summary

Seller-defined traveler data requirements per Product. Partners can configure which traveler fields (firstName, lastName, birthDate, citizenship, gender, passportNumber, passportExpiry) are NOT_REQUESTED, OPTIONAL, or REQUIRED at booking time.

## Starting State

- **Starting SHA:** `98c799fdbd5a8be1ac9fde9110bcc9846c444bcf`
- **Branch:** `master`
- **Working tree:** clean

## Storage Decision

**Chosen:** `travelerRequirements Json?` (JSONB) on `Product` model.

**Rationale:**
- Per-product configuration (not global)
- Finite field catalog (7 fields × 3 states)
- Consistent with existing `attributes Json?` pattern on Product
- NULL = use ProductType defaults (deterministic resolution)
- Simple migration: single ALTER TABLE ADD COLUMN

## Traveler Field Catalog

| Field | Description | States |
|-------|-------------|--------|
| firstName | Traveler first name | NOT_REQUESTED / OPTIONAL / REQUIRED |
| lastName | Traveler last name | NOT_REQUESTED / OPTIONAL / REQUIRED |
| birthDate | Date of birth | NOT_REQUESTED / OPTIONAL / REQUIRED |
| citizenship | Nationality | NOT_REQUESTED / OPTIONAL / REQUIRED |
| gender | Gender | NOT_REQUESTED / OPTIONAL / REQUIRED |
| passportNumber | Passport number | NOT_REQUESTED / OPTIONAL / REQUIRED |
| passportExpiry | Passport expiry date | NOT_REQUESTED / OPTIONAL / REQUIRED |

## ProductType Defaults

| Type | firstName | lastName | birthDate | citizenship | gender | passport | expiry |
|------|-----------|----------|-----------|-------------|--------|----------|--------|
| TOUR | REQ | REQ | OPT | NR | NR | NR | NR |
| HOTEL | REQ | REQ | OPT | OPT | NR | NR | NR |
| FLIGHT | REQ | REQ | REQ | REQ | NR | REQ | REQ |
| TRAIN | REQ | REQ | OPT | NR | NR | NR | NR |
| EXCURSION | REQ | REQ | OPT | NR | NR | NR | NR |
| TRANSFER | REQ | REQ | NR | NR | NR | NR | NR |
| SANATORIUM | REQ | REQ | REQ | OPT | OPT | OPT | OPT |
| GUIDE | REQ | REQ | NR | NR | NR | NR | NR |
| PHOTOGRAPHER | REQ | REQ | NR | NR | NR | NR | NR |

## Files Changed

### Backend

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Added `travelerRequirements Json?` to Product model |
| `backend/prisma/migrations/20260902120000_add_product_traveler_requirements/migration.sql` | ALTER TABLE ADD COLUMN |
| `backend/src/modules/catalog/traveler-requirements.ts` | **NEW** — Validation, defaults, effective resolution, labels |
| `backend/src/modules/catalog/catalog.service.ts` | createProduct/updateProduct handle travelerRequirements; new getEffectiveTravelerRequirements endpoint |
| `backend/src/modules/catalog/catalog.controller.ts` | DTOs updated; GET /products/:id/traveler-requirements endpoint |
| `backend/src/modules/catalog/traveler-requirements.spec.ts` | **NEW** — 41 unit tests |

### Frontend

| File | Change |
|------|--------|
| `frontend/components/partner/TravelerRequirementsEditor.tsx` | **NEW** — Visual 3-state editor per field |
| `frontend/components/partner/ProductEditorForm.tsx` | Traveler Requirements panel added |
| `frontend/app/partner/products/new/page.tsx` | travelerRequirements state + API integration |
| `frontend/app/partner/products/[id]/edit/page.tsx` | travelerRequirements state + API integration |
| `frontend/lib/partner-api.ts` | PartnerProductDetail + createProduct/updateProduct + getEffectiveTravelerRequirements |
| `frontend/lib/partner-i18n.ts` | i18n keys for traveler requirements (ru/az/en) |

## API Contract

### POST /products (create)
```json
{
  "type": "TOUR",
  "title": "Tour to Sheki",
  "travelerRequirements": {
    "passportNumber": "REQUIRED",
    "citizenship": "OPTIONAL"
  }
}
```

### PATCH /products/:id (update)
```json
{
  "travelerRequirements": {
    "passportNumber": "REQUIRED",
    "citizenship": "OPTIONAL"
  }
}
```

### GET /products/:id/traveler-requirements (effective)
```json
{
  "productId": "...",
  "productType": "TOUR",
  "hasOverride": true,
  "requirements": {
    "firstName": "REQUIRED",
    "lastName": "REQUIRED",
    "birthDate": "OPTIONAL",
    "citizenship": "OPTIONAL",
    "gender": "NOT_REQUESTED",
    "passportNumber": "REQUIRED",
    "passportExpiry": "NOT_REQUESTED"
  }
}
```

## Validation Rules

1. `travelerRequirements` must be a flat object (no nesting)
2. Keys must be from the canonical field catalog (7 fields)
3. Values must be one of: NOT_REQUESTED, OPTIONAL, REQUIRED
4. Unknown fields → TravelerRequirementsValidationError
5. NULL = use ProductType defaults
6. Empty object = all fields default

## Tests

- **41/41 unit tests pass** (traveler-requirements.spec.ts)
- Coverage: type guards, validation, defaults, effective resolution, labels, field catalog
- TypeScript: backend (tsc --noEmit clean), frontend (tsc --noEmit clean)

## Design Decisions

1. **JSON on Product** (not normalized table): per-product config, finite catalog, consistent with existing pattern
2. **NULL semantics**: NULL = "use ProductType defaults" (deterministic, documented)
3. **Override model**: Product overrides merged on top of defaults; null clears all overrides
4. **Frozen at checkout**: D3 will read effective requirements at termsAcceptedAt and pin for OrderTraveler snapshot
5. **3-state model**: NOT_REQUESTED / OPTIONAL / REQUIRED (enough granularity for travel industry)

## D3 Integration Point

D3 reads effective traveler requirements at checkout acceptance and pins them for OrderTraveler/Passenger snapshot. The `getEffectiveTravelerRequirements` function handles the merge logic.
