# PHASE 3 — STEP 3.7A — MARKETPLACE CONTACT POLICY AUTHORITY — IMPLEMENTATION REPORT

## A. Verdict

```
VERDICT A — PHASE 3 — STEP 3.7A — MARKETPLACE CONTACT POLICY AUTHORITY — FULLY CLOSED
```

## B. Pre-Implementation Exposure Matrix

| Surface | Endpoint | Basic contact exposed? | Pro contact exposed? | Required change |
|---|---|---|---|---|
| Partner CRM list | `GET /partner/customers` | ✅ email + phone (full Customer.findMany, no select) | ✅ email + phone (explicit select) | Add select to exclude email/phone for Basic |
| Partner CRM detail | `GET /partner/customers/:id` | ✅ email + phone (explicit select with both) | ✅ email + phone | Conditional select by tier |
| Partner Orders | No dedicated Partner order endpoint | N/A | N/A | No change needed |
| Partner Bookings | No dedicated Partner booking endpoint | N/A | N/A | No change needed |
| Partner Payments | No dedicated Partner payment endpoint | N/A | N/A | No change needed |
| Exports | None exist in Partner workspace | N/A | N/A | No bypass |
| Notifications | No notification controller exists | N/A | N/A | No bypass |
| Legacy endpoints | No alternate Partner customer endpoints | N/A | N/A | No bypass |

## C. Architecture Decision

```
tier authority:     getCrmTier() — existing, server-side, PartnerStorefront status+entitlementStatus
policy authority:   Inline in CRM service — conditional Prisma select by tier
DTO/serialization:  Prisma select clause (not post-processing)
why this seam:      Smallest existing architectural seam — getCrmTier already resolves per-request;
                    conditional select eliminates contact fields at DB query level, not response layer
```

## D. Basic Policy

**Fields hidden for Marketplace Basic:**
- `Customer.email` — omitted from select in list + detail
- `Customer.phone` — omitted from select in list + detail

**Affected endpoints:**
- `GET /partner/customers` — list query now uses explicit select excluding email/phone
- `GET /partner/customers/:id` — detail query conditionally excludes email/phone for BASIC tier

**Behavior:**
- Basic customer list: shows code, name, type, status — no email column
- Basic customer detail: shows code, name, type, status — no email/phone cards
- Search still works (email used in WHERE clause for filtering, not returned in response)

## E. Pro Policy

**Preserved for Storefront Pro:**
- `Customer.email` — included in select for list + detail
- `Customer.phone` — included in select for list + detail
- All relation fields (lifecycle, leadSource, tags, notes, assignedTo) — unchanged
- Manual intake — unchanged
- Relation editing — unchanged

## F. Platform Policy

Platform CRM uses separate endpoints (`/app/crm/*`) with different service methods.
No accidental redaction — Platform `getCustomerDetail()` returns full Customer fields.

## G. Order / Booking Policy

No dedicated Partner Order/Booking endpoints exist.
Partner workspace has no Order/Booking/Payment pages.
Order/Booking data is accessible only through CRM customer detail (scoped to partner's orders).

## H. Alternate Paths

| Path | Status | Contact bypass? |
|---|---|---|
| Exports | Not implemented | No bypass |
| Search/autocomplete | Server-side search uses email in WHERE, not returned | No bypass |
| Notifications | No notification controller exists | No bypass |
| Legacy endpoints | No alternate Partner customer endpoints | No bypass |

## I. Tenant isolation

Partner A cannot access Partner B customer data — enforced by `assertPartnerActor()` + partnerId scope in all CRM service methods.

## J. Communication regression

Pre-sale chat anti-disintermediation remains intact — no changes to communication module.

## K. RU/AZ/EN

No new UI labels introduced — email/phone fields are simply hidden for Basic.
Layout remains correct in all locales (email column removed from table, email/phone cards removed from detail).

## L. Tests

```
CRM:         106/106 PASS
Analytics:    65/65 PASS
Frontend:    243/243 PASS
Backend TSC:  PASS
Frontend TSC: PASS
```

## M. Changed files

| Path | Purpose | Status |
|---|---|---|
| `backend/src/modules/crm/crm.service.ts` | Server-side contact policy — conditional select for Basic | CHANGED |
| `frontend/app/partner/customers/page.tsx` | Hide email column/cards for Basic | CHANGED |

## N. Database/schema

```
schema changes: 0
migration changes: 0
historical Customer records changed: 0
historical Order records changed: 0
historical Booking records changed: 0
```

## O. Git evidence

```
Starting HEAD:          235d39d
Final HEAD:             271fbe3
origin/master:          271fbe3
HEAD == origin/master:  YES ✅
Step 3.7A files committed: YES
Step 3.7A files pushed: YES
unrelated pre-existing changes:
  D backend/src/reconcile-2c2.ts
  D docs/prompts/PHASE_3_STEP_3.5E_PARTNER_CRM_ANALYTICS_READ_MODEL_IMPLEMENTATION_REPORT.md
  multiple untracked prompt files
```
