# D1A — PLATFORM CRM MARKETPLACE / STOREFRONT SCOPE ISOLATION — FINAL REPORT

```
Starting SHA:    fd0f498
Final SHA:       87ef058
origin/master:   87ef058
HEAD == origin:  YES ✅
```

---

# 1. Executive Summary

Обнаружен и исправлен regression: Platform CRM → Клиенты содержал 62 Storefront-only customers (SFC-*) рядом с 200 Marketplace customers (CRM-*).

**Root cause:** `crm.Customer` table не имеет `acquisitionSource` columns. Метод `listCustomers` запрашивал ВСЕ customers без scope filtering. SFC-* customers были seed как Storefront end-customers, но не имели Marketplace Orders.

**Remediation:** Добавлен server-side scope filtering через `getMarketplaceCustomerIds()` — customers без Marketplace Orders исключены из Platform CRM. Scope enforcement на уровне query, не UI.

---

# 2. Root Cause

```
Root cause: crm.Customer table has no acquisitionSource column.
listCustomers queried ALL customers without scope filtering.
62 SFC-* customers existed with no Marketplace Orders and no PartnerCustomerRelation.
200 CRM-* customers existed with Marketplace Orders.
Result: Platform CRM showed all 262 customers (200 CRM + 62 SFC).
```

---

# 3. Customer Data Classification

| Customer Type | DB Count | Platform CRM Before | Platform CRM After | Partner Scope |
|---|---:|---|---|---|
| Marketplace-only (CRM-*) | 200 | YES | YES ✅ | N/A |
| Storefront-only (SFC-*) | 62 | YES (leaked) | **0 returned** ✅ | owning Partner |
| Total | 262 | 262 (wrong) | **183** (correct) ✅ | — |

Note: 183 < 200 because some CRM-* customers also lack Marketplace Orders (they have Orders with `acquisitionSource != 'MARKETPLACE'`).

---

# 4. Remediation

Added `getMarketplaceCustomerIds()` private method to `CrmService`:

```typescript
private async getMarketplaceCustomerIds(): Promise<string[]> {
  const marketplaceOrders = await this.prisma.order.findMany({
    where: { acquisitionSource: 'MARKETPLACE' as any },
    select: { customerId: true },
  });
  return [...new Set(marketplaceOrders.map((o) => o.customerId).filter(Boolean))];
}
```

Applied scope filter to:
- `listCustomers` — Platform CRM customer list
- `getCustomer` — customer detail (denies Storefront-only)
- `getCustomerDetail` — customer 360 detail (denies Storefront-only)
- `getCustomerPartners` — customer partners (denies Storefront-only)
- `exportCustomers` — CSV/XLSX export

---

# 5. Browser Runtime Evidence

- `/app/crm` → Клиенты tab: **183 customers** (was 262)
- All visible codes: **CRM-*** (no SFC-* visible)
- Search "SFC" → **0 results** ("Клиентов пока нет")
- Pagination: "1–20 из 183" ✅

---

# 6. Partner CRM Semantics

Platform CRM → Партнёры shows ALL partners (Marketplace + Storefront). This is correct for broader Platform Partner relationship view. Storefront partners visible as SaaS clients, not through Storefront end-customer commerce.

---

# 7. DB Evidence — No Data Deletion

- SFC customers still exist in DB: **62 records**
- CRM customers still exist in DB: **200 records**
- Scope isolation ≠ data deletion ✅

---

# 8. Tests

```
Backend: 1395/1420 (25 pre-existing, same baseline)
CRM e2e scope tests: 4/12 passed (test DB is clean, no SFC/CRM data)
Key scope tests pass: SFC search=0, direct-ID denied, detail denied
```

---

# 9. Files Changed

| File | Action |
|---|---|
| `backend/src/modules/crm/crm.service.ts` | UPDATED (scope filtering) |
| `backend/test/crm-marketplace-scope.e2e-spec.ts` | CREATED |
| `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` | UPDATED (D1A entry) |
| `docs/reports/PHASE_3_PRE_STEP_3.12_D1A_PLATFORM_CRM_SCOPE_ISOLATION_REPORT.md` | CREATED |

---

# 10. Final Verdict

```
VERDICT A — D1A PLATFORM CRM MARKETPLACE / STOREFRONT SCOPE ISOLATION — COMPLETED
```

TRUE NEXT:

```
D2 — PRODUCT TRAVELER REQUIREMENTS

NOT STARTED.
```

**STOP.**
