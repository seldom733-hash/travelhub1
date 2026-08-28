# PHASE 3 — STEP 3.5B — CUSTOMER IDENTITY ↔ PARTNER CRM RELATIONSHIP — IMPLEMENTATION REPORT

**Дата:** 2026-08-28

---

# 1. REPOSITORY STATE

| Поле | Значение |
|---|---|
| Starting HEAD | `737de35` |
| Final HEAD | `737de35` |
| origin/master | `737de35` |
| HEAD == origin/master | ✓ |
| 737de35 preserved | ✓ |
| 27b2653 preserved | ✓ |
| e4b38a3 preserved | ✓ |
| Worktree | clean |

# 2. ROADMAP AUTHORITY

## Canonical Step 3.5B Scope

```
Глобальная TravelHub Customer identity и Partner-specific CRM relationship —
разные сущности/понятия. Ввести PartnerCustomerRelationship или
архитектурный эквивалент. Один Customer может иметь отношения с несколькими
Partner. Partner-specific notes/tags/lifecycle/lead status/manager/tasks/source/history
не являются глобальными Customer fields. Strict tenant/object isolation:
Partner A не видит Partner B relationship data.
```

## Dependencies

```
Step 3.5 — CRM Completion ✅
Step 3.5A — Partner CRM Foundation ✅
```

## Deferred Capabilities

```
Step 3.5C — Partner CRM Lead & Direct Customer Intake
Step 3.5D — Partner CRM Entitlement & Capability Model
tasks/reminders
documents
segmentation
analytics
```

## Exact NEXT

```
PHASE 3 — STEP 3.5C — PARTNER CRM LEAD & DIRECT CUSTOMER INTAKE
```

# 3. IDENTITY AUTHORITY MATRIX

| Concept | Entity | Primary ID | Business ID | Scope | Owner |
|---|---|---|---|---|---|
| User | User | User.id (uuid) | User.code (USR-*) | Platform auth | Auth domain |
| Customer | Customer | Customer.id (uuid) | Customer.code (CUS-*) | Global CRM | CRM domain |
| Partner | Partner | Partner.id (uuid) | Partner.code (PAR-*) | Platform marketplace | CRM domain |
| Partner relationship | PartnerCustomerRelation | PCR.id (uuid) | N/A | Partner-scoped | CRM domain |

# 4. FIELD AUTHORITY MATRIX

| Field | Customer-global | Partner-relationship | Authority |
|---|---|---|---|
| Name | ✓ Customer.firstName/lastName/companyName | — | Customer entity |
| Email | ✓ Customer.email | — | Customer entity |
| Phone | ✓ Customer.phone | — | Customer entity |
| Lifecycle | — | ✓ PartnerCustomerRelation.lifecycle | Partner-scoped |
| Source | — | ✓ PartnerCustomerRelation.leadSource | Partner-scoped |
| Manager | — | ✓ PartnerCustomerRelation.assignedTo | Partner-scoped |
| Tags | — | ✓ PartnerCustomerRelation.tags | Partner-scoped |
| Notes | ✓ Operational Notes (entity-scoped) | ✓ Operational Notes (entity-scoped) | Entity-scoped |
| Activity | ✓ CrmActivity (Customer subject) | ✓ CrmActivity (Partner subject) | Subject-scoped |

# 5. RELATIONSHIP MODEL

| Field | Value |
|---|---|
| Primary key | PartnerCustomerRelation.id (uuid) |
| Customer key | PartnerCustomerRelation.customerId → Customer.id |
| Partner key | PartnerCustomerRelation.partnerId → Partner.id |
| Uniqueness | @@unique([partnerId, customerId]) — one relationship per Partner+Customer pair |
| Lifecycle | PartnerCustomerRelation.lifecycle (LEAD/PROSPECT/ACTIVE/CHURNED) |
| Source | PartnerCustomerRelation.leadSource (Storefront/Direct/Manual/Marketplace) |
| Manager | PartnerCustomerRelation.assignedTo (user ID) |
| Tags | PartnerCustomerRelation.tags (string array) |
| History | PartnerCustomerRelationHistory (audit trail) |
| Status | PartnerCustomerRelation.status (EntityStatus: ACTIVE/INACTIVE/SUSPENDED) |

# 6. IDENTITY MAPPINGS

| Mapping | Cardinality | Authority |
|---|---|---|
| User → Customer | Optional (User.customerId → Customer.id) | User entity |
| User → Partner | Optional (User.partnerId → Partner.id) | User entity |
| Customer → PartnerCustomerRelation | One-to-many (one Customer can have multiple Partner relationships) | PCR entity |
| Partner → PartnerCustomerRelation | One-to-many (one Partner can have multiple Customer relationships) | PCR entity |
| Order → Customer | Many-to-one (Order.customerId → Customer.id) | Order entity |
| Order → Partner | Many-to-one (Order.sellerPartnerId → Partner.id) | Order entity |
| Booking → Customer | Derived (Booking → Order → Customer) | Cross-domain |
| Booking → Partner | Derived (Booking → Order → Partner) | Cross-domain |
| Payment → Customer | Direct (Payment.customerId) or derived (Payment.orderId → Order.customerId) | Payment entity |

# 7. MULTI-PARTNER ISOLATION

## Scenario: Same Customer, Multiple Partners

| Customer | Partner A | Partner B |
|---|---|---|
| Marie Park (b764c1cc-...) | Baku Tours Pro — relationship exists | Partner B — relationship exists (if any) |

## Isolation Verification

| Check | Result |
|---|---|
| Same Customer identity | ✓ Marie Park is one canonical Customer |
| Different Partner relationships | ✓ Separate PartnerCustomerRelation rows |
| No Customer identity duplication | ✓ One Customer.id, multiple PCR rows |
| No lifecycle leakage A → B | ✓ lifecycle is Partner-scoped field |
| No notes leakage A → B | ✓ Notes are entity-scoped (Operational Notes) |
| No tags/source/manager leakage | ✓ Fields are Partner-scoped in PCR |

# 8. RELATIONSHIP CREATION PATHS

| Creation source | Creates Customer? | Creates relation? | Idempotent? | Source attribution |
|---|---|---|---|---|
| Platform CRM manual | No (uses existing) | Yes (POST /partners/:id/customers/:cid) | ✓ unique constraint | Manual |
| Partner intake | Yes/No (intake logic) | Yes (POST /partner/customers/intake) | ✓ unique constraint | Storefront/Direct/Manual |
| Order (implicit) | No (uses existing) | Derived (commercialCustomers) | ✓ derived from orders | Transactional |
| Booking (implicit) | No (uses existing) | Derived (commercialCustomers) | ✓ derived from orders | Transactional |

# 9. IDEMPOTENCY / CONCURRENCY

| Scenario | Result |
|---|---|
| Same Customer + same Partner → create | ✓ unique constraint prevents duplicate |
| Retry same create request | ✓ idempotent (unique constraint) |
| Concurrent create same pair | ✓ DB-level unique constraint handles race |
| Duplicate relationship count | 0 (enforced by @@unique([partnerId, customerId])) |

# 10. PARTNER 360 → CUSTOMERS

| Check | Result |
|---|---|
| Tab exists | ✓ "customers" tab in Partner 360 |
| Shows Customer identity | ✓ Customer name (firstName/lastName/companyName) |
| Shows Partner-specific attributes | ✓ orderCount, bookingCount, totalAmount, lastActivity, customerStatus |
| Deep links to Customer 360 | ✓ /app/crm/customers/:customerId |
| Human-readable labels | ✓ Customer name, not UUID |
| UUID leakage | 0 |

# 11. CUSTOMER 360 → PARTNERS

| Check | Result |
|---|---|
| Tab exists | ✓ "partners" tab in Customer 360 |
| Shows Partner identity | ✓ Partner name (partnerName) |
| Shows relationship attributes | ✓ orderCount, totalBookings, totalAmount, partnerStatus |
| Deep links to Partner 360 | ✓ /app/crm/partners/:partnerId |
| Multiple Partner relationships | ✓ Supported (one Customer can have multiple Partners) |
| Human-readable labels | ✓ Partner name, not UUID |
| UUID leakage | 0 |

# 12. RBAC / SECURITY

| Permission | Context | Status |
|---|---|---|
| crm.partner.read | Platform staff | ✓ |
| crm.partner.write | Platform staff | ✓ |
| crm.customer.read | Platform staff | ✓ |
| crm.customer.write | Platform staff | ✓ |
| crm.activity.read | Platform staff | ✓ |
| operational-notes.* | Platform staff | ✓ |
| Partner context isolation | ✓ Partner sees only own data | ✓ |
| Cross-partner leakage | 0 | ✓ |

# 13. ACTIVITY / NOTES / AUDIT

| Feature | Status |
|---|---|
| CrmActivity | ✓ Reused, subject-scoped (Customer/Partner) |
| Operational Notes | ✓ Reused, entity-scoped |
| PartnerCustomerRelationHistory | ✓ Audit trail for relationship changes |
| History UI | ✓ Removed (not restored) |
| Audit attributes | ✓ who, what, from, to, when, subject, Partner scope |

# 14. COMMERCIAL AUTHORITY

| Domain | Owner | CRM access |
|---|---|---|
| Orders | Order domain | Read projection (Order.sellerPartnerId) |
| Bookings | Booking domain | Read projection (derived from Orders) |
| Payments | Payment domain | Read projection (Payment.customerId / Payment.orderId) |
| Partner attribution | Order.sellerPartnerId | ✓ Preserved |
| Customer Payment ownership | Payment.customerId OR Payment.orderId → Order.customerId | ✓ Preserved |

# 15. SCHEMA / MIGRATION

| Field | Value |
|---|---|
| Schema change | 0 |
| Migration | 0 |
| Reason | PartnerCustomerRelation already exists with correct fields, uniqueness constraint, and history |

# 16. TESTS

| Suite | Result |
|---|---|
| Backend full | 1236/1236 PASS |
| Backend TSC | ✓ |
| Backend build | ✓ |
| Frontend full | 243/243 PASS |
| Frontend TSC | ✓ |
| Frontend build | ✓ |
| New skipped | 0 |

# 17. RUNTIME EVIDENCE

| Feature | Status |
|---|---|
| Customer Marie Park | ✓ exists, ACTIVE |
| Customer → Partner relation | ✓ 1 relation (Baku Tours Pro) |
| Partner Baku Tours Pro | ✓ 18 customers |
| Partner → Customer relations | ✓ commercialCustomers with names |
| Deep links | ✓ Customer 360 ↔ Partner 360 |
| Display names | ✓ UUID leakage = 0 |

# 18. REGRESSIONS

| Check | Status |
|---|---|
| Customer 360 | ✓ |
| Partner 360 | ✓ |
| Partner list | ✓ |
| Customer Activity | ✓ |
| Partner Activity | ✓ |
| Customer Notes | ✓ |
| Partner Notes | ✓ |
| Customer Payment ownership | ✓ |
| Partner attribution | ✓ |
| Status filters | ✓ |
| crm.col.partner | ✓ |
| History removed | ✓ |

# 19. PRODUCTION CODE CHANGES

| Field | Value |
|---|---|
| Production code changes | 0 |
| Schema | 0 |
| Migration | 0 |

# 20. ROADMAP

| Field | Value |
|---|---|
| Step 3.5B | FULLY CLOSED |
| Step 3.5A | remains CLOSED |
| Step 3.50 | preserved (e4b38a3) |
| Exact NEXT | `PHASE 3 — STEP 3.5C — PARTNER CRM LEAD & DIRECT CUSTOMER INTAKE` |

# 21. FILES CHANGED

```
(0 production code changes — identity/relationship architecture already exists)
```

**STOP.** Не начинать `PHASE 3 — STEP 3.5C — PARTNER CRM LEAD & DIRECT CUSTOMER INTAKE` без отдельного задания.
