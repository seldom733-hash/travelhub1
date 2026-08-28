# PHASE 3 — STEP 3.6D — PARTNER CRM UI — IMPLEMENTATION REPORT

## VERDICT

```
VERDICT A — PHASE 3 — STEP 3.6D — PARTNER CRM UI — FULLY CLOSED
```

## PRE-IMPLEMENTATION INVENTORY

| Existing surface | Route | Basic | Pro | API | Reusable? | Gap |
|---|---|---|---|---|---|---|
| Partner Customers page | /partner/customers | ✅ | ✅ | GET /partner/customers | ✅ | i18n gaps |
| Customer Detail panel | /partner/customers | ✅ | ✅ | GET /partner/customers/:id | ✅ | i18n gaps |
| CRM Tier Badge | /partner/customers | ✅ | ✅ | GET /partner/crm-tier | ✅ | Hardcoded EN |
| Intake Form | /partner/customers | ❌ | ✅ | POST /partner/customers/intake | ✅ | Hardcoded RU labels |
| Relation Edit | /partner/customers | ❌ | ✅ | PATCH /partner/relations/:id | ✅ | Lifecycle plain text |
| Navigation | /partner/layout | ✅ | ✅ | N/A | ✅ | Tier-aware ✓ |
| Activity | N/A | ❌ | ❌ | crm.activity.read (no PARTNER) | ❌ | DEFERRED |
| Notes | N/A | ❌ | ❌ | operational-notes.read (no PARTNER) | ❌ | DEFERRED |
| Analytics | N/A | ❌ | ❌ | analytics.read (no PARTNER) | ❌ | DEFERRED |

## IMPLEMENTED SCOPE

### REUSED
- Existing `/partner/customers/page.tsx` — full Partner CRM page with customer list, detail panel, intake form, relation editing
- Existing `/partner/layout.tsx` — tier-aware Partner navigation with CRM entry
- Existing `lib/api.ts` — all CRM API endpoints (list, detail, intake, relations)
- Existing `StatusBadge`, `Kpi`, `Pagination`, `PanelFrame` components
- Existing Platform CRM i18n keys (`crm.col.*`, `crm.type.*`, `crm.lead_source.*`)
- Backend CRM endpoints — all tier-gated, server-scoped, tenant-isolated

### CHANGED
- **partner-i18n.ts** — Added 45 new Partner CRM i18n keys (RU/AZ/EN):
  - Detail tabs: overview, orders, bookings, payments, relations, activity
  - Detail labels: email, phone, lifecycle, source, tags, notes
  - Summary labels: orders, bookings, payments
  - Empty states: customer list, orders, bookings, payments, relations, relations_basic
  - Relation edit: edit, save, cancel, my_relation, tags_hint
  - Intake form: first_name, last_name, email, phone, company, source, notes, initial_note, initial_note_ph, saving, submit
  - CRM descriptions: pro, basic
  - Error: load_failed, retry, email_invalid

- **frontend/app/partner/customers/page.tsx** — i18n + lifecycle select + source column:
  - All hardcoded RU strings replaced with `pt()` / `t()` i18n calls
  - Header "CRM" → `pt("partner.nav.crm", locale)`
  - Description → `pt("partner.crm.description.pro/basic", locale)`
  - Column headers → `t("crm.col.code/name/email/type/status", locale)`
  - Type display → `t("crm.type.person/company", locale)`
  - Empty states → `pt("partner.crm.empty*", locale)`
  - Tab labels → `pt("partner.crm.tab.*", locale)`
  - Detail labels → `pt("partner.crm.email/phone/lifecycle/source/tags/notes", locale)`
  - Source display → `t("crm.lead_source.*", locale)` with locale-aware translation
  - Summary labels → `pt("partner.crm.summary.*", locale)`
  - Intake form labels → `pt("partner.crm.intake.*", locale)`
  - Relation edit labels → `pt("partner.crm.relation.*", locale)`
  - **Lifecycle**: plain text input → `<select>` with LEAD/PROSPECT/ACTIVE/CHURNED options
  - **Source column**: added to Pro customer table (was missing)
  - **Source in detail**: locale-aware lead source display using `t("crm.lead_source.*")`

### NEW
- None — all backend APIs, components, routes already existed

## ROUTE ARCHITECTURE

```
/partner/customers → Partner CRM page (shared for Basic/Pro)
  GET /partner/customers      → customer list (server-tier-scoped)
  GET /partner/customers/:id  → customer detail (server-tier-scoped)
  POST /partner/customers/intake → manual intake (Pro only, server-gated)
  PATCH /partner/relations/:id   → relation edit (Pro only, server-gated)
```

No duplicate CRM root created. Single canonical `/partner/customers` route.

## BASIC CAPABILITY MATRIX

| Capability | Available | Evidence |
|---|---|---|
| Customer list from marketplace orders | ✅ | `listPartnerCustomers` — Basic path queries `order.sellerPartnerId` |
| Customer detail with orders/bookings/payments | ✅ | `getPartnerCustomerDetail` — Basic path checks order count |
| Manual customer intake | ❌ | Server: `if (tier !== "PRO") throw ForbiddenException` |
| Source/lifecycle editing | ❌ | Server: Pro-only endpoints |
| Activity | ❌ | `crm.activity.read` not in PARTNER permissions |
| Analytics | ❌ | `analytics.read` not in PARTNER permissions |

## PRO CAPABILITY MATRIX

| Capability | Available | Evidence |
|---|---|---|
| Customer list from PCR | ✅ | `listPartnerCustomers` — Pro path queries `PartnerCustomerRelation` |
| Customer detail with relation fields | ✅ | `getPartnerCustomerDetail` — Pro path includes `_relation` |
| Manual customer intake | ✅ | `POST /partner/customers/intake` — server-gated for Pro |
| Source selection (8 options) | ✅ | Intake form + `assertValidLeadSource()` |
| Lifecycle management (LEAD/PROSPECT/ACTIVE/CHURNED) | ✅ | `PATCH /partner/relations/:id` |
| Tags | ✅ | Relation edit |
| Notes | ✅ | Relation edit |
| Activity | ❌ | `crm.activity.read` not in PARTNER permissions — DEFERRED |
| Analytics | ❌ | `analytics.read` not in PARTNER permissions — DEFERRED |

## SERVER AUTHORITY

| Pro-only action | Entitlement | Permission | Endpoint | Denial behavior |
|---|---|---|---|---|
| Manual intake | PRO tier | `crm.customer.create_own` | POST /partner/customers/intake | 403 ForbiddenException |
| Relation edit | PRO tier | `crm.customer.update_own` | PATCH /partner/relations/:id | 403 ForbiddenException |
| Activity read | — | `crm.activity.read` (not in PARTNER) | GET /crm-activity/customers/:id/activity | 403 |

## TENANT ISOLATION

- `listPartnerCustomers`: queries by `actor.partnerId` (server-derived)
- `getPartnerCustomerDetail`: Basic checks `order.sellerPartnerId = partnerId`; Pro checks `partnerId_customerId` unique constraint
- `intakePartnerCustomer`: creates PCR with `actor.partnerId`
- `updatePartnerRelation`: updates PCR by `relationId` (ownership verified server-side)
- Partner A cannot access Partner B data — server-scoped queries prevent cross-tenant access

## CUSTOMER/PCR AUTHORITY

```
Customer = global identity (schema: crm)
PartnerCustomerRelation = Partner-scoped relationship (schema: crm)

UI correctly shows:
- Customer identity fields (code, name, email, phone, status)
- PCR fields only for Pro (lifecycle, leadSource, tags, notes, assignedTo)
- Basic sees customer from orders only (no PCR)
```

## SOURCE/LIFECYCLE EVIDENCE

- **Source column**: visible in Pro table, shows `leadSource` from PCR
- **Source in detail**: locale-aware display using `t("crm.lead_source.*", locale)`
- **Lifecycle select**: LEAD/PROSPECT/ACTIVE/CHURNED options in edit form
- **First-source preservation**: server-side — existing source never overwritten by later interaction

## ACTIVITY/NOTES/ANALYTICS

- **Activity**: DEFERRED — `crm.activity.read` permission not available to PARTNER role. Backend has Partner Activity API but requires this permission.
- **Notes**: DEFERRED — `operational-notes.read` not available to PARTNER.
- **Analytics**: DEFERRED — `analytics.read` not available to PARTNER.

These require separate permission grants to PARTNER role (backend change).

## TESTS

```
CRM tests:       106/106 PASS
Analytics tests:  65/65 PASS
Frontend tests:  243/243 PASS
Backend TSC:     PASS
Frontend TSC:    PASS
```

## CHANGED FILES

| File | Purpose |
|---|---|
| `frontend/lib/partner-i18n.ts` | Added 45 Partner CRM i18n keys (RU/AZ/EN) |
| `frontend/app/partner/customers/page.tsx` | i18n + lifecycle select + source column |

## GIT EVIDENCE

```
Starting HEAD:  e1bfb98
Final HEAD:     [to be committed]
origin/master:  e1bfb98
HEAD == origin/master: YES (before commit)
```

Working tree: 2 pre-existing deletions + untracked prompt files (unrelated to this stage).
