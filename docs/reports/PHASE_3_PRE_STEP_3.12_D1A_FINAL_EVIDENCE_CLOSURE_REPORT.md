# D1A — PLATFORM CRM MARKETPLACE / STOREFRONT SCOPE ISOLATION — FINAL EVIDENCE CLOSURE REPORT

```
Starting SHA:    329c56a
Final SHA:       f610def
origin/master:   f610def
HEAD == origin:  YES ✅
```

---

# 1. Executive Summary

Независимо перепроверены: root cause, canonical Marketplace Customer definition, классификация 17 исключённых CRM-* customers, Partner semantics, E2E tests (14/14), runtime/export/security evidence.

**Key findings:**
- 17 excluded CRM-* customers: 16 = STOREFRONT_ONLY, 1 = SEED_INCONSISTENCY, 0 = UNCLASSIFIED
- Root cause confirmed: `crm.Customer` has no `acquisitionSource`; scope via `Order.acquisitionSource = 'MARKETPLACE'`
- Partners: 16 Hybrid + 9 Marketplace-only, 0 Storefront-only
- E2E: 14/14 PASS with deterministic fixtures
- D11 expanded to project-wide KPI/Status Semantics

---

# 2. Root Cause Re-verification

Confirmed:
- `crm.Customer` table has NO `acquisitionSource` column
- `listCustomers` queried ALL customers without scope filtering
- `getMarketplaceCustomerIds()` correctly identifies customers via `Order.acquisitionSource = 'MARKETPLACE'`
- All 49 excluded orders have `acquisitionSource = 'PARTNER_STOREFRONT'`

---

# 3. Canonical Marketplace Customer Definition

```text
Platform Marketplace CRM Customer
IFF
Customer has ≥1 Order with acquisitionSource = 'MARKETPLACE'
```

**Limitation documented:** A legitimate Marketplace Customer could exist before first Marketplace Order. Current schema does not store sufficient provenance. Documented as data-model gap.

---

# 4. 17 Excluded CRM-* Classification

| Code | Name | MP Orders | Other | Classification |
|---|---|---:|---:|---|
| CRM-00000036 | Sarah Wagner | 0 | 1 | STOREFRONT_ONLY |
| CRM-00000041 | Ahmed Rossi | 0 | 1 | STOREFRONT_ONLY |
| CRM-00000054 | Wang Kuznetsov | 0 | 3 | STOREFRONT_ONLY |
| CRM-00000058 | Tanaka Morozov | 0 | 2 | STOREFRONT_ONLY |
| CRM-00000065 | Lucas Takahashi | 0 | 4 | STOREFRONT_ONLY |
| CRM-00000134 | Khalid Bianchi | 0 | 5 | STOREFRONT_ONLY |
| CRM-00000135 | Yusuf Romano | 0 | 4 | STOREFRONT_ONLY |
| CRM-00000148 | Tanaka Morozov | 0 | 3 | STOREFRONT_ONLY |
| CRM-00000151 | Carlos Tanaka | 0 | 4 | STOREFRONT_ONLY |
| CRM-00000157 | Marie Park | 0 | 1 | STOREFRONT_ONLY |
| CRM-00000162 | Klaus Levy | 0 | 3 | STOREFRONT_ONLY |
| CRM-00000163 | Anna Mizrahi | 0 | 4 | STOREFRONT_ONLY |
| CRM-00000173 | Alexei Bergström | 0 | 3 | STOREFRONT_ONLY |
| CRM-00000176 | Elena Nielsen | 0 | 5 | STOREFRONT_ONLY |
| CRM-00000188 | Elvin Gasimov | 0 | 0 | SEED_INCONSISTENCY |
| CRM-00000191 | Farid Bagirova | 0 | 3 | STOREFRONT_ONLY |
| CRM-00000199 | Aygul Rustamova | 0 | 3 | STOREFRONT_ONLY |

**UNCLASSIFIED = 0** ✅

---

# 5. E2E Tests — 14/14 PASS

| # | Test | Result |
|---|---|---|
| 1 | Platform CRM list includes Marketplace customer | ✅ |
| 2 | Platform CRM list excludes Storefront-only | ✅ |
| 3 | Platform CRM total excludes Storefront-only | ✅ |
| 4 | Search finds Marketplace customer | ✅ |
| 5 | Search does not find Storefront-only | ✅ |
| 6 | Filters cannot surface Storefront-only | ✅ |
| 7 | Pagination cannot surface Storefront-only | ✅ |
| 8 | Direct-ID denies Storefront-only | ✅ |
| 9 | Customer 360/detail denies Storefront-only | ✅ |
| 10 | CSV excludes Storefront-only | ✅ |
| 11 | XLSX excludes Storefront-only | ✅ |
| 12 | Storefront-only record still exists in DB | ✅ |
| 13 | Partners list returns data or requires permission | ✅ |
| 14 | Unauthorized request is denied | ✅ |

---

# 6. Regression

```
Backend: 1395/1420 (25 pre-existing, same baseline)
CRM scope E2E: 14/14 PASS
No new regressions
```

---

# 7. D11 Expansion

D11 expanded to: **Project-Wide KPI/Status Semantics + Total Reconciliation**

---

# 8. Final Verdict

```
VERDICT A — D1A PLATFORM CRM MARKETPLACE / STOREFRONT SCOPE ISOLATION — FINAL EVIDENCE CLOSURE COMPLETED
```

TRUE NEXT:

```
D2 — PRODUCT TRAVELER REQUIREMENTS
NOT STARTED.
```

**STOP.**
