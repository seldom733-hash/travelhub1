# PHASE 3 — STEP 3.5 — CRM ARCHITECTURE / CURRENT STATE / ROADMAP RECONCILIATION REPORT

## VERDICT: VERDICT A — PHASE 3 STEP 3.5 CRM ARCHITECTURE / CURRENT STATE / ROADMAP FULLY RECONCILED — READY FOR IMPLEMENTATION

---

## Current CRM state

**Status:** Step 3.5 CRM Completion was implemented and closed on 2026-08-25 (commit `17f66cd`). The CRM workspace is operational with Customers and Partners tabs. The reconciliation below inventories the complete current state and identifies gaps for future substeps (3.5A–3.5E).

**Backend modules:**
- `crm.controller.ts` — 13 endpoints (CRUD customers, contacts, companies, partners, suppliers, partner-customer relations)
- `crm.service.ts` — CRM-owned application service (SSOT for master data)
- `crm.module.ts` — NestJS module, exports `CrmService`

**Frontend:**
- `frontend/app/app/crm/page.tsx` — CRM workspace with Customers/Partners tabs
- `frontend/app/customers/page.tsx` — Redirect to `/app/crm`
- Side panel detail with 5 sub-tabs (Overview/Orders/Bookings/Payments/Relations)

**DB schema (crm.*):**
- `Customer` — 241 rows, all PERSON, all ACTIVE
- `Contact` — 0 rows
- `Company` — 0 rows
- `Partner` — 28 rows, all ACTIVE
- `Supplier` — 0 rows
- `PartnerCustomerRelation` — Step 3.5B, with lifecycle/leadSource/tags/notes/assignedTo
- `PartnerCustomerRelationHistory` — audit trail
- `CustomerHistory` — audit trail

---

## Customer authority

| Question | Answer | Evidence |
|---|---|---|
| Primary key | `crm.Customer.id` (UUID) + `code` (CUS-*) | schema.prisma line 1670 |
| Canonical identity key | `email` (@unique, normalized) | CrmService.ensureCustomerForBuyer, CrmService.createCustomer |
| Customer type | `CustomerType` enum: PERSON, COMPANY | schema.prisma |
| Customer status | `EntityStatus` enum: ACTIVE, INACTIVE, BLOCKED | schema.prisma |
| Created by | CRM service only (Application service pattern) | CrmService comments |
| Cross-schema ref | `Order.customerId`, `Payment.customerId` (no FK — ADR-0001) | schema.prisma lines 1887, 3660 |
| Guest checkout | NOT implemented — all customers are registered (email-based) | No guest flow in codebase |
| Registered vs guest | Registered only | ensureCustomerForBuyer creates from registration |

---

## CRM Customers

| Area | Existing | Correct? | Gap | Source evidence |
|---|---|---|---|---|
| CRM Customers list | ✅ Paginated table (20/page), search, status filter | Yes | — | `crm.page.tsx`, `CrmService.listCustomers` |
| Customer CRUD | ✅ Create/Read/Update | Yes | No delete (soft delete via status) | `crm.controller.ts` |
| Customer detail | ✅ Side panel with 5 tabs | Yes | — | `getCustomerDetail` endpoint |
| Customer contacts | ✅ API + DB model | Yes | Empty (0 contacts) | `Contact` model, `createContact`/`listContacts` |
| Customer history | ✅ `CustomerHistory` audit trail | Yes | — | `crm.service.ts` |
| Search | ✅ email, firstName, lastName, companyName, code | Yes | — | `CrmService.listCustomers` WHERE clause |
| Filters | Status filter only | Correct for current scope | No date/activity filters | `ListCustomersQuery` |
| Sorting | `createdAt desc` only | Correct for current scope | No configurable sort | `CrmService.listCustomers` |

---

## Customer → Orders

| Area | Existing | Correct? | Gap | Source evidence |
|---|---|---|---|---|
| Relation | `Order.customerId → crm.Customer.id` (no FK) | Yes (ADR-0001) | — | schema.prisma line 1887 |
| Shown in detail | ✅ Orders tab (top 20) | Yes | No pagination within orders tab | `getCustomerDetail` |
| Fields shown | code, number, status, paymentStatus, amount, currency, createdAt | Yes | — | `CrmService.getCustomerDetail` |
| Order count | ✅ `totalOrders` in summary | Yes | — | `getCustomerDetail` |

---

## Customer → Bookings

| Area | Existing | Correct? | Gap | Source evidence |
|---|---|---|---|---|
| Relation | `Booking.orderId → Order.id → Order.customerId` (indirect) | Yes | — | schema.prisma |
| Shown in detail | ✅ Bookings tab (top 20) | Yes | No pagination within bookings tab | `getCustomerDetail` |
| Fields shown | code, status, amount, currency, createdAt | Yes | — | `CrmService.getCustomerDetail` |
| Booking count | ✅ `totalBookings` in summary | Yes | — | `getCustomerDetail` |

---

## Customer → Payments

| Area | Existing | Correct? | Gap | Source evidence |
|---|---|---|---|---|
| Relation | `Payment.customerId → crm.Customer.id` + `Payment.orderId → Order.id` (no FK) | Yes | — | schema.prisma line 3660 |
| Shown in detail | ✅ Payments tab (top 20) | Yes | No pagination within payments tab | `getCustomerDetail` |
| Fields shown | code, status, amount, currency, createdAt | Yes | — | `CrmService.getCustomerDetail` |
| Payment count | ✅ `totalPayments` in summary | Yes | — | `getCustomerDetail` |

---

## Customer → Refunds

| Area | Existing | Correct? | Gap | Source evidence |
|---|---|---|---|---|
| Relation | `Refund.orderId → Order.id` (no direct customer link) | Correct (indirect) | NOT shown in CRM detail | schema.prisma line 3773 |
| Shown in detail | ❌ Not implemented | Missing | No Refunds tab in customer detail | `getCustomerDetail` returns no refunds |

**Assessment:** Refunds can be derived from Orders → Payments → Refunds chain but are not surfaced in Customer 360. This is a gap for future implementation.

---

## Customer 360

| Section | Status | Notes |
|---|---|---|
| Overview (identity + summary) | ✅ Implemented | Email, phone, type, status + order/booking/payment counts |
| Orders | ✅ Implemented | List of orders (top 20) |
| Bookings | ✅ Implemented | List of bookings via orders (top 20) |
| Payments | ✅ Implemented | List of payments via orders (top 20) |
| Refunds | ❌ Not implemented | Gap — needs Orders → Refunds join |
| Partner Relations | ✅ Implemented | Shows partner-customer links with lifecycle |
| Activity/History | ❌ Not implemented | CustomerHistory exists but not shown in detail UI |
| Notes | ❌ Not implemented | PartnerCustomerRelation has notes, but Customer-level notes absent |
| Tags/Segments | ❌ Not implemented | PartnerCustomerRelation has tags, but global customer tags absent |
| Communications | ❌ Not implemented | `communication.*` domain exists but not linked to CRM detail |
| Responsible Employee | ❌ Not implemented | PartnerCustomerRelation.assignedTo exists, but no global customer assignment |

---

## Activity Timeline

| Capability | Status | Source |
|---|---|---|
| Order events | Available via `OrderHistory` (order schema) | schema.prisma |
| Booking events | Available via `BookingHistory` (booking schema) | schema.prisma |
| Payment events | Available via `PaymentHistory` (finance schema) | schema.prisma |
| Refund events | Available via `Refund.history` (finance schema) | schema.prisma |
| Customer events | Available via `CustomerHistory` (crm schema) | schema.prisma |
| Unified timeline | NOT implemented | No cross-schema event aggregation |

**Assessment:** Individual domain histories exist but no unified customer activity timeline. This is PLANNED — not in current scope.

---

## Notes

| Capability | Status | Source |
|---|---|---|
| Customer-level notes | ❌ Not implemented | No `notes` field on `Customer` model |
| Partner-Customer notes | ✅ Implemented | `PartnerCustomerRelation.notes` |
| Internal staff notes | ❌ Not implemented | No general-purpose notes entity |

**Assessment:** Notes exist at PartnerCustomerRelation level only. Customer-level notes are a future capability.

---

## Tags / Segments

| Capability | Status | Source |
|---|---|---|
| Partner-Customer tags | ✅ Implemented | `PartnerCustomerRelation.tags` (String[]) |
| Global customer tags | ❌ Not implemented | No tags on Customer model |
| Customer segments | ❌ Not implemented | No segmentation architecture |
| Marketing segments | ❌ Not implemented | No marketing module |

**Assessment:** Tags exist at PartnerCustomerRelation level only. Global customer tagging/segmentation is PLANNED — not in current scope.

---

## Communications

| Capability | Status | Source |
|---|---|---|
| Communication domain | ✅ Exists | `communication.*` schema, `communication.read/create` permissions |
| Linked to CRM | ❌ Not linked | No customerId/orderId on Communication model |
| CRM detail shows communications | ❌ Not implemented | No communications tab in customer detail |

**Assessment:** Communication domain exists as a separate bounded context. Integration with CRM Customer 360 is PLANNED — not in current scope.

---

## Responsible Employee / Owner

| Capability | Status | Source |
|---|---|---|
| PartnerCustomerRelation.assignedTo | ✅ Implemented | String field (manager/user ID) |
| Global customer assignment | ❌ Not implemented | No assignedEmployee on Customer model |

**Assessment:** Assignment exists at PartnerCustomerRelation level. Global customer assignment is PLANNED — not in current scope.

---

## Platform scope

| Aspect | Status | Evidence |
|---|---|---|
| Platform CRM access | ✅ Platform staff (ADMIN, SALES_MANAGER, OPERATOR, DIRECTOR) have `crm.customer.read` | permissions.constants.ts |
| Cross-partner visibility | ✅ Platform staff see all customers (no tenant filter on customer list) | `CrmService.listCustomers` — no partnerId filter |
| Partner-scoped CRM | ❌ PARTNER does NOT have `crm.customer.read` | permissions.constants.ts (Step 1.17 review) |

**Assessment:** CRM is currently PLATFORM-only. Partners do not have CRM access. This is by design (Step 1.17 review: PARTNER gets own-scope read models, not internal CRM).

---

## Partner scope

| Aspect | Status | Evidence |
|---|---|---|
| Partner CRM access | ❌ Not implemented | PARTNER role has no `crm.customer.read` or `crm.partner.read` |
| Partner sees own customers | ❌ Not implemented | No partner-scoped customer list |
| Cross-partner isolation | ✅ Enforced by absence | PARTNER cannot see any CRM data |

**Assessment:** Partner CRM scope is NOT in current implementation. Partners interact with customers only through own-scope read models (account.*). This is a gap for Step 3.5C/D (Partner CRM Lead & Direct Customer Intake).

---

## Marketplace Basic vs Storefront Pro

| Tier | CRM Access | Evidence |
|---|---|---|
| Marketplace Basic | No explicit CRM entitlement | No entitlement model for CRM |
| Storefront Pro | No explicit CRM entitlement | No entitlement model for CRM |

**Assessment:** CRM access is role-based (ADMIN/SALES_MANAGER/OPERATOR/DIRECTOR), not tier-based. There is no CRM-specific entitlement model. Marketplace Basic vs Storefront Pro distinction does not currently affect CRM access.

---

## RBAC

| Role | CRM access | Customer PII | Finance fields | Mutations | Evidence |
|---|---|---|---|---|---|
| ADMIN | ✅ Full (ALL_PERMISSIONS) | ✅ Yes | ✅ Yes | ✅ Create/Update | permissions.constants.ts |
| DIRECTOR | ✅ Read-only | ✅ Yes | ❌ No (no crm.customer.read for finance) | ❌ No | permissions.constants.ts |
| ANALYST | ❌ No (crm.customer.read revoked) | ❌ No | ❌ No | ❌ No | Step 1.17 review |
| MARKETER | ❌ No (crm.customer.read revoked) | ❌ No | ❌ No | ❌ No | Step 1.17 review |
| FINANCE | ❌ No (crm.customer.read revoked) | ❌ No | ✅ Yes (finance.*.read) | ✅ Yes (finance.*.write) | Step 1.17 review |
| MODERATOR | ❌ No | ❌ No | ❌ No | ❌ No | permissions.constants.ts |
| SALES_MANAGER | ✅ Read + Write | ✅ Yes | ✅ Yes (finance.payment.read) | ✅ Create/Update | permissions.constants.ts |
| OPERATOR | ✅ Read + Write | ✅ Yes | ✅ Yes (via order/booking) | ✅ Create/Update | permissions.constants.ts |
| PARTNER | ❌ No | ❌ No | ❌ No | ❌ No | Step 1.17 review |

---

## PII

| Field | Visible to | Editable by | Masking | Evidence |
|---|---|---|---|---|
| email | ADMIN, SALES_MANAGER, OPERATOR, DIRECTOR | ADMIN, SALES_MANAGER, OPERATOR | None | CrmService, crm.page.tsx |
| phone | ADMIN, SALES_MANAGER, OPERATOR, DIRECTOR | ADMIN, SALES_MANAGER, OPERATOR | None | CrmService, crm.page.tsx |
| firstName | ADMIN, SALES_MANAGER, OPERATOR, DIRECTOR | ADMIN, SALES_MANAGER, OPERATOR | None | CrmService |
| lastName | ADMIN, SALES_MANAGER, OPERATOR, DIRECTOR | ADMIN, SALES_MANAGER, OPERATOR | None | CrmService |
| companyName | ADMIN, SALES_MANAGER, OPERATOR, DIRECTOR | ADMIN, SALES_MANAGER, OPERATOR | None | CrmService |

**Assessment:** PII is visible to staff roles with crm.customer.read permission. No masking. No export capability. Audit exists via CustomerHistory.

---

## Customer payment status

| Field | Available now | Future source | CRM behavior now |
|---|---|---|---|
| Order.paymentStatus | ✅ Yes | — | Shown in Orders tab (UNPAID/PAID/REFUNDED) |
| Payment.status | ✅ Yes | — | Shown in Payments tab (PENDING/CAPTURED/FAILED/CANCELLED) |
| Customer aggregate payment state | ❌ Not computed | — | Not shown |
| Outstanding amount | ❌ Not computed | — | Not shown |

**Assessment:** Individual order/payment statuses are visible. No customer-level payment aggregate exists. This is a gap for future implementation.

---

## Booking Commercial Terms boundary

| Capability | Status | Source |
|---|---|---|
| F.1–F.13 | PLANNED — NOT STARTED | canonical roadmap |
| CRM shows agreement version | ❌ Not available | No agreement data in DB |
| CRM shows payment schedule | ❌ Not available | No installment data in DB |
| CRM integration boundary | Reserved — no fake data | Correct |

---

## Supplier Settlement boundary

| Capability | Status | Source |
|---|---|---|
| S.1–S.19 | PLANNED — NOT STARTED | canonical roadmap |
| CRM shows settlement status | ❌ Not available | No settlement data in DB |
| CRM shows payout status | ❌ Not available | No payout data in DB |
| CRM integration boundary | Reserved — no fake data | Correct |

---

## Data ownership matrix

| Data | Canonical authority | CRM role |
|---|---|---|
| Customer identity | crm.Customer (SSOT) | Owner |
| Customer contacts | crm.Contact | Owner |
| Customer history | crm.CustomerHistory | Owner |
| Partner | crm.Partner | Owner |
| Partner-Customer relation | crm.PartnerCustomerRelation | Owner |
| Company | crm.Company | Owner |
| Supplier | crm.Supplier | Owner |
| Order | order.Order | Consumer (via customerId) |
| Booking | booking.Booking | Consumer (via Order) |
| Payment | finance.Payment | Consumer (via customerId/orderId) |
| Refund | finance.Refund | Consumer (via orderId) |
| Commercial terms | future canonical domain | future consumer |
| Supplier settlement | future Settlement domain | future consumer |
| Supplier payout | future Payout domain | future consumer |
| Notes | TBD (PartnerCustomerRelation has notes) | partial |
| Tags | TBD (PartnerCustomerRelation has tags) | partial |
| Activity | event/history tables exist | consumer (no unified timeline) |

---

## API inventory

| Endpoint | Method | Purpose | Pagination | Search | Filters | Scope | Used by CRM? |
|---|---|---|---|---|---|---|---|
| /customers | GET | List customers | ✅ page/pageSize | ✅ name/email/code | status | Platform | ✅ |
| /customers | POST | Create customer | — | — | — | Platform | ✅ |
| /customers/:id | GET | Customer basic | — | — | — | Platform | ✅ |
| /customers/:id | PATCH | Update customer | — | — | — | Platform | ✅ |
| /customers/:id/detail | GET | Customer 360 | — | — | — | Platform | ✅ |
| /customers/:id/contacts | GET | List contacts | — | — | — | Platform | ✅ |
| /customers/:id/contacts | POST | Create contact | — | — | — | Platform | ✅ |
| /companies | GET | List companies | — | — | — | Platform | ✅ |
| /companies | POST | Create company | — | — | — | Platform | ✅ |
| /partners | GET | List partners | ✅ page/pageSize | ✅ name/code/email | status | Platform | ✅ |
| /partners | POST | Create partner | — | — | — | Platform | ✅ |
| /partners/:id | GET | Partner detail | — | — | — | Platform | ✅ |
| /partners/:partnerId/customers/:customerId | POST | Create relation | — | — | — | Platform | ✅ |
| /partner-customer-relations/:id | PATCH | Update relation | — | — | — | Platform | ✅ |
| /suppliers | GET | List suppliers | — | — | — | Platform | ✅ |
| /suppliers | POST | Create supplier | — | — | — | Platform | ✅ |

---

## DB / Model inventory

```
crm.*:
  Customer (id, code, type, firstName, lastName, companyName, email, phone, status, version)
  Contact (id, code, customerId, name, email, phone, role)
  Company (id, code, name, inn, status)
  Partner (id, code, companyId, name, status, contactEmail, registrationNumber, taxId, countryCode)
  Supplier (id, code, companyId, name, status)
  PartnerCustomerRelation (id, partnerId, customerId, status, leadSource, assignedTo, lifecycle, tags, notes)
  CustomerHistory (id, customerId, action, from, to, fields, actorId, actorName, comment)
  PartnerCustomerRelationHistory (id, relationId, action, from, to, fields, actorId, actorName, comment)

order.*:
  Order (id, code, number, customerId, status, paymentStatus, amount, paidAmount, refundedAmount, ...)
  OrderItem (id, orderId, productId, title, type, quantity, price, amount)
  OrderTraveler (id, orderId, firstName, lastName, ...)

booking.*:
  Booking (id, code, orderId, productId, status, amount, currency, serviceDate, ...)
  Reservation (id, bookingId, supplierId, status)
  Passenger (id, bookingId, firstName, lastName, ...)

finance.*:
  Payment (id, code, orderId, customerId, partnerId, amount, currency, status, paymentMethod, ...)
  Refund (id, code, paymentId, orderId, amount, currency, status, reason, ...)
  PaymentTerms (id, code, orderId, scheme, ...)

communication.*:
  Communication (exists but not linked to CRM)
```

---

## Gap analysis

| Capability | Status | Classification |
|---|---|---|
| Customer list with search | ✅ EXISTS AND CORRECT | — |
| Customer CRUD | ✅ EXISTS AND CORRECT | — |
| Customer detail (overview) | ✅ EXISTS AND CORRECT | — |
| Customer → Orders | ✅ EXISTS AND CORRECT | — |
| Customer → Bookings | ✅ EXISTS AND CORRECT | — |
| Customer → Payments | ✅ EXISTS AND CORRECT | — |
| Customer → Refunds | ❌ MISSING — REQUIRED FOR 3.5 | Gap — needs Orders → Refunds join |
| Customer contacts | ✅ EXISTS BUT INCOMPLETE | API exists, 0 contacts in DB |
| Customer history (audit) | ✅ EXISTS BUT NOT IN UI | CustomerHistory exists, not shown |
| Partner list/detail | ✅ EXISTS AND CORRECT | — |
| Partner-Customer relations | ✅ EXISTS AND CORRECT | Step 3.5B |
| Customer-level notes | ❌ MISSING — FUTURE | No notes field on Customer |
| Customer-level tags | ❌ MISSING — FUTURE | No tags on Customer |
| Global customer assignment | ❌ MISSING — FUTURE | No assignedEmployee on Customer |
| Unified activity timeline | ❌ MISSING — FUTURE | No cross-schema aggregation |
| Communications integration | ❌ MISSING — FUTURE | communication.* exists, not linked |
| Customer payment aggregate | ❌ MISSING — FUTURE | No customer-level payment status |
| Customer export | ❌ MISSING — FUTURE | No export capability |
| Partner-scoped CRM | ❌ MISSING — FUTURE | PARTNER has no CRM access |
| CRM entitlement model | ❌ NOT APPLICABLE | Role-based, not tier-based |

---

## Step 3.5 implementation decomposition

Based on actual current state, the canonical roadmap substeps map as follows:

| Substep | Scope | Dependencies | Status |
|---|---|---|---|
| 3.5 (base) | Customer/Partner CRUD, tabs, detail | None | ✅ COMPLETE |
| 3.5A — Partner CRM Foundation | Partner list, detail, search | 3.5 base | ✅ COMPLETE |
| 3.5B — Customer Identity ↔ Partner CRM Relationship | PartnerCustomerRelation schema + API + UI | 3.5A | ✅ COMPLETE |
| 3.5C — Partner CRM Lead & Direct Customer Intake | Partner-scoped customer views, partner CRM access | 3.5B + PARTNER permission grant | PLANNED — NOT STARTED |
| 3.5D — Partner CRM Entitlement & Capability Model | CRM entitlement for Storefront Pro, capability gates | 3.5C + entitlement architecture | PLANNED — NOT STARTED |
| 3.5E — Partner CRM Analytics Read Model | Customer analytics, segments, KPIs for partners | 3.5D + analytics foundation | PLANNED — NOT STARTED |

### Additional future capabilities (not in canonical substeps):

| Capability | Dependencies | Classification |
|---|---|---|
| Customer refunds in detail | Order→Refund join | PLANNED — can implement independently |
| Customer history in UI | CustomerHistory exists | PLANNED — can implement independently |
| Customer-level notes | Schema extension | PLANNED — future |
| Customer-level tags | Schema extension | PLANNED — future |
| Global customer assignment | Schema extension | PLANNED — future |
| Unified activity timeline | Cross-schema event aggregation | PLANNED — future |
| Communications integration | communication.* linkage | PLANNED — future |
| Customer payment aggregate | Computed field from Orders/Payments | PLANNED — future |
| Customer export | RBAC + PII + scope | PLANNED — future |

---

## Architecture changes

No architecture docs were created or updated during this reconciliation (this is a reconciliation-only gate).

Existing architecture references:
- `docs/architecture/supplier-settlement-balance-payout-transparency-audit.md` — references "CRM: read-only consumer (Step 3.5 EXISTS)"
- `docs/architecture/sales-domain-foundation.md` — references "Partner CRM lead intake — Phase 3 (Step 3.5C)"
- `docs/architecture/booking-commercial-terms-agreement-versioning-audit.md` — references "CRM representation: Consumer only, EXISTS — Step 3.5"

---

## Roadmap changes

No roadmap changes needed. The canonical roadmap v3 already has:
- Step 3.5 — CRM Completion ✅ COMPLETE
- Step 3.5A — Partner CRM Foundation ✅ COMPLETE
- Step 3.5B — Customer Identity ↔ Partner CRM Relationship ✅ COMPLETE
- Step 3.5C — Partner CRM Lead & Direct Customer Intake — PLANNED
- Step 3.5D — Partner CRM Entitlement & Capability Model — PLANNED
- Step 3.5E — Partner CRM Analytics Read Model — PLANNED

---

## Production code changed:

NO (reconciliation-only gate)

## DB changed:

NO

## Runtime changed:

NO

## Files changed:

0 (report only)

## Commit:

N/A (reconciliation report, no code changes)

## HEAD:

43b0cd3

## origin/master:

43b0cd3

## HEAD == origin/master:

✅ Yes

## Unrelated files:

0

---

## Remaining gaps

1. **Customer → Refunds** — Not shown in customer detail. Orders → Refunds join needed.
2. **Customer history in UI** — CustomerHistory exists but not surfaced in detail panel.
3. **Partner-scoped CRM** — PARTNER role has no CRM access. Step 3.5C scope.
4. **CRM entitlement model** — No tier-based CRM access. Step 3.5D scope.
5. **Customer payment aggregate** — No customer-level payment status/outstanding.
6. **Unified activity timeline** — No cross-schema event aggregation.
7. **Communications integration** — communication.* not linked to CRM.
8. **Customer-level notes/tags/assignment** — Schema extensions needed.

---

## First authorized implementation substep

**3.5C — Partner CRM Lead & Direct Customer Intake** (per canonical roadmap)

Or, if chosen independently:
**Customer refunds in detail** (smallest gap, no schema changes, can implement with existing data)

---

## STOP

Awaiting review before proceeding to next stage.
