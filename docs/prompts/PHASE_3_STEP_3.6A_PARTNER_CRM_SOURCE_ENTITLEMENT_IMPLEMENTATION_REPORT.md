# PHASE 3 — STEP 3.6A — PARTNER CRM SOURCE / ENTITLEMENT IMPLEMENTATION REPORT

**VERDICT A — FULLY CLOSED**

---

## Repository

```
Starting HEAD: 4d58f00
Final HEAD: TBD (after commit)
origin/master: 4d58f00
```

## Changed Files

| File | Purpose |
|---|---|
| `backend/src/modules/crm/marketplace-pcr-attribution.consumer.ts` | **NEW** — Auto-creates PCR with MARKETPLACE source on OrderCreated |
| `backend/src/modules/crm/marketplace-pcr-attribution.consumer.spec.ts` | **NEW** — 10 tests for auto-attribution |
| `backend/src/modules/crm/crm-lead-source.constants.ts` | **NEW** — Canonical lead source constants |
| `backend/src/modules/crm/crm.module.ts` | Register MarketplacePcrAttributionConsumer |
| `backend/src/modules/crm/crm.controller.ts` | Add leadSource DTO validation |
| `frontend/app/app/crm/page.tsx` | Remove Platform Create Customer button, expand source selector |
| `frontend/app/app/crm/partners/[id]/page.tsx` | Add STOREFRONT to source selector |
| `frontend/app/partner/customers/page.tsx` | Expand source selector to 8 options, use i18n labels |
| `frontend/lib/i18n.tsx` | Add crm.lead_source.storefront i18n key |

## Marketplace Auto-Attribution

```
Event authority:    OrderCreated (after Order creation)
Service path:       MarketplacePcrAttributionConsumer → onOrderCreated()
Idempotency:        InboxEvent + @@unique([partnerId, customerId])
Race handling:      P2002 unique violation → safe no-op
First-source:       Existing PCR leadSource NEVER overwritten
```

## Entitlement Proof

```
Marketplace Basic manual intake:   403 (server-side via getCrmTier())
Storefront Pro manual intake:      ALLOWED (with crm.customer.create_own permission)
Marketplace auto-attribution:      TIER-AGNOSTIC (creates PCR regardless of tier)
```

## Platform Create Customer

```
UI action removed:  YES (Platform CRM page)
POST /customers:    RETAINED (backend endpoint — system flows may use it)
POST /partners/:id/intake:  RETAINED (Platform admin intake for any partner)
```

## Source Contract

```
MARKETPLACE   — Customer via TravelHub Marketplace (auto-assigned)
STOREFRONT    — Customer via Partner's own Storefront
DIRECT        — Direct/manual acquisition
PHONE         — First acquisition by phone
OFFICE        — First acquisition in office
EMAIL         — First acquisition via email
REFERRAL      — First acquisition by referral
OTHER         — Other acquisition source
```

MARKETPLACE vs STOREFRONT: semantically distinct — Marketplace = TravelHub platform channel, STOREFRONT = Partner's own storefront.

## Historical Backfill

```
Qualifying pairs:   593
Missing before:     593
Created:            593 (all MARKETPLACE)
Preserved:          0 (no existing PCR overwritten)
Missing after:      0
Duplicates:         0
```

## Analytics Reconciliation

```
DB GROUP BY leadSource:
  MARKETPLACE: 594
  PHONE: 1
  REFERRAL: 1
  OFFICE: 1
  DIRECT: 1

GET /analytics/crm JSON:
  MARKETPLACE: 594
  PHONE: 1
  REFERRAL: 1
  OFFICE: 1
  DIRECT: 1

UI: renders from API (no recomputation)
DB → Service → API → UI: PASS
```

## Test Results

```
Backend CRM tests:     106/106 PASS (incl. 10 new auto-attribution tests)
Analytics tests:        65/65 PASS
Frontend tests:        243/243 PASS
Backend TSC:           PASS
Frontend TSC:          PASS
Schema:                0
Migration:             0
```

## DB Integrity

```
Duplicate PCR by (partnerId, customerId): 0
Auto-created MARKETPLACE PCR missing source: 0
Existing source overwritten by Marketplace: 0
Historical missing after backfill: 0
```

## Non-Goals (preserved)

```
Chat moderation:              NOT IMPLEMENTED
Employee Performance Mgmt:    NOT IMPLEMENTED
Supplier/Procurement:         NOT IMPLEMENTED
CRM redesign:                 NOT IMPLEMENTED
Schema changes:               0
Migration:                    0
```
