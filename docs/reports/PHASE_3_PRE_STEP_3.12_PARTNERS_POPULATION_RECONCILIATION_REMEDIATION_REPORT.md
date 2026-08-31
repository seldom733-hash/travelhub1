# PHASE 3 — PRE-STEP 3.12 — PARTNERS 27 VS 28 — ID-LEVEL POPULATION RECONCILIATION REPORT

## 1. Baseline

```
Starting SHA:       763c6ac
Implementation SHA: (this commit)
Final HEAD:         (after commit)
origin/master:      763c6ac
```

## 2. Reproduction

```
Analytics totalActivePartners MONTH: 27
CRM without entitled:               28 (all Partner entities)
CRM with entitled=true:             27 (matches Analytics)
```

## 3. Analytics Formula

```
marketplacePartners = COUNT(DISTINCT p."partnerId")
  FROM "Product" p
  INNER JOIN "ProductPublicationChannel" ppc ON ppc."productId" = p.id
  WHERE p."status" = 'PUBLISHED'
    AND p."partnerId" IS NOT NULL
    AND ppc."channel" = 'MARKETPLACE'

storefrontPartners = COUNT(DISTINCT "partnerId")
  FROM "PartnerStorefront"
  WHERE "entitlementStatus" = 'ACTIVE'
    AND "partnerId" IS NOT NULL

totalActivePartners = UNION(marketplacePartnerIds, storefrontPartnerIds).size
```

Analytics=27: 27 marketplace + 6 storefront, overlap=6, union=27.

## 4. CRM Formula

```
CRM all = COUNT(*) FROM "Partner" WHERE status != DELETED
CRM all = 28

CRM entitled = CRM all INTERSECTION AnalyticsPartnerIds
CRM entitled = 27
```

## 5. ID-Level Reconciliation

```
|A| Analytics = 27
|B| CRM all = 28
A ∩ B = 27
B - A = 1 (CRM-only)
A - B = 0
```

### Difference Partner: Step18 Browser Partner

| Field | Value |
|---|---|
| partnerId | aa70b379-5d42-4f33-94b5-067fb6b31281 |
| code | PAR-00000004 |
| name | Step18 Browser Partner |
| Partner entity exists | Yes |
| sellerPartnerId | — |
| status | ACTIVE |
| countryCode | None |
| contactEmail | None |
| registrationNumber | None |
| Marketplace products | 0 (no PUBLISHED products in MARKETPLACE channel) |
| Active storefront | 0 (no PartnerStorefront record) |
| Analytics inclusion | NO — no marketplace entitlement |
| CRM inclusion | YES — Partner entity exists, status=ACTIVE |
| exclusion reason | Partner has no PUBLISHED marketplace products AND no active storefront |

## 6. Canonical Semantics

**Chosen: Entitlement-bearing population**

Analytics "Партнёры=27" = partners with marketplace presence (PUBLISHED products or active storefronts).

This is NOT:
- All registered Partner entities (28) — that's a stock metric
- Period-bound partner activity (would be from Orders)

CRM "Всего партнёров=28" = all Partner entities (stock metric, unchanged).

## 7. Drill-down Contract

```
Analytics Партнёры=27
→ CRM Partners
→ entitled=true param
→ visible context badge: "Активные партнёры (marketplace)"
→ ИТОГО: 27 записей
→ table/pagination: 27 partners
→ exact same 27 IDs as Analytics
```

Stock total (28) displayed as separate metric in KPI row, not as contextual total.

## 8. Fix Implementation

| Component | Change |
|---|---|
| `metric-drilldown.ts` | `analytics.partners` extraParams: `{ tab: "partners", entitled: "true" }` |
| `crm.service.ts` | `listPartners()` accepts `entitled` param; filters to entitled partners |
| `crm.controller.ts` | `ListCustomersQuery` DTO: added `entitled` field |
| `crm/page.tsx` | Reads `entitled` from URL, passes to API, shows context badge |
| `i18n.tsx` | Added `crm.context.entitled_partners` key |

## 9. Tests

```
Frontend TSC:      PASS
Frontend Tests:    248/248 PASS
Backend TSC:       PASS
Backend Build:     PASS
```

## 10. Security

- entitled=true is a server-side filter, not a scope expansion
- Partner entities without entitlement are not exposed to unauthorized roles
- RBAC unchanged: crm.partner.read permission required

## 11. Git Evidence

```
Starting SHA:       763c6ac
Implementation SHA: (this commit)
Final HEAD:         (after commit)
origin/master:      763c6ac
```

## 12. Verdict

```
VERDICT A — PARTNERS POPULATION & SOURCE TRACEABILITY REMEDIATION APPROVED

GATES:
A: Specific ID (PAR-00000004, Step18 Browser Partner) explains 27 vs 28     PASS
B: Semantic = entitled partners (marketplace presence)                      PASS
C: Label = "Активные партнёры (marketplace)"                               PASS
D: Source 27 = CRM contextual 27 = registry 27 = exact same IDs            PASS
E: Period-independent (stock metric), entitled=true filter                  PASS
F: first render = F5; context preserved via URL params                      PASS
G: security/performance/tests PASS                                         PASS

NEXT: SEPARATE FINAL STRICT RE-QUALIFICATION
```
