# TravelHub — Channel Health: GMV / Revenue Audit & Correction

## OBJECTIVE

Audit and correct the **Channel Health** section of Command Center.

The key requirement is to correctly distinguish:

1. **GMV Marketplace**
2. **GMV Storefront**
3. **Выручка Marketplace**
4. **Выручка Storefront**

Do not confuse GMV with TravelHub revenue.

---

## 1. BUSINESS MODEL

### Marketplace

A customer buys a partner service through the common TravelHub Marketplace.

Example:

```text
Customer purchase       ₼1,000
Marketplace GMV         ₼1,000
TravelHub commission    ₼100
Partner share           ₼900
```

Therefore:

```text
GMV Marketplace
= total value of services sold through Marketplace

Выручка Marketplace
= commission income earned by TravelHub from Marketplace sales
```

Do not use a hardcoded commission rate. Use the existing commission architecture.

---

### Storefront

A partner sells services through their own branded TravelHub Storefront.

Storefront monetization is **subscription-based**, not Marketplace-commission-based.

Therefore:

```text
GMV Storefront
= total value of services sold through Partner Storefronts

Выручка Storefront
= valid paid Storefront subscription revenue received by TravelHub
```

Example:

```text
20 Premium subscriptions × ₼199
= ₼3,980 Storefront Revenue
```

The customer purchase amount is **Storefront GMV**, not automatically TravelHub Storefront Revenue.

---

## 2. TERMINOLOGY — MANDATORY

Use these names consistently in frontend, backend, API, widgets, i18n, seed/demo data and documentation:

### Correct

- GMV Marketplace
- GMV Storefront
- Выручка Marketplace
- Выручка Storefront
- Total Platform Revenue / Общая выручка TravelHub

### Incorrect

Do NOT use:

- Выручка Витрины
- Revenue of Витрина
- Storefront GMV as Storefront Revenue
- Marketplace GMV as Marketplace Revenue

**Storefront must remain Storefront. Do not translate it as «Витрина» in KPI names.**

---

## 3. AUDIT CURRENT CHANNEL HEALTH

Locate the current implementation of:

```text
Channel Health
```

Inspect:

- frontend component;
- Dashboard/V3 service;
- API;
- database queries;
- widget/KPI registry;
- DTO/types;
- i18n;
- seed/demo data;
- date filtering;
- channel identification;
- commission calculation;
- subscription calculation.

For the current fields labelled:

```text
Marketplace Revenue
Storefront Revenue
```

determine exactly what they represent.

Report:

```text
Current label:
Actual meaning:
Database source:
Formula:
Date field:
Channel filter:
```

Do not guess.

---

## 4. CORRECT CHANNEL HEALTH

Channel Health must distinguish sales volume from TravelHub revenue.

### Marketplace

```text
GMV Marketplace
Orders Marketplace
Conversion Marketplace
Выручка Marketplace
```

Where:

```text
GMV Marketplace
= sum of applicable sales value for Marketplace orders
```

and:

```text
Выручка Marketplace
= sum of valid commission amounts earned by TravelHub
from Marketplace sales
```

### Storefront

```text
GMV Storefront
Orders Storefront
Conversion Storefront
Выручка Storefront
```

Where:

```text
GMV Storefront
= sum of applicable sales value for Storefront orders
```

and:

```text
Выручка Storefront
= sum of valid paid Storefront subscription charges
attributable to the selected period
```

Do NOT calculate:

```text
Storefront Revenue = Storefront GMV × Marketplace commission
```

---

## 5. MARKETPLACE REVENUE

Inspect the existing commission model.

Use existing:

- Commission records;
- commission amount;
- commission rate;
- order-level commission;
- partner-level commission;
- applicable commission rules.

Preferred conceptual calculation:

```text
Marketplace Revenue
= SUM(valid commission amounts attributable to Marketplace sales)
```

Do not replace the project's existing commission architecture with a hardcoded percentage.

---

## 6. STOREFRONT REVENUE

Inspect the existing Storefront subscription model.

Check:

- subscription plan;
- subscription price;
- billing period;
- active/inactive status;
- start/end dates;
- payment status;
- renewals;
- cancellations;
- refunds.

Preferred calculation:

```text
Storefront Revenue
= SUM(valid paid Storefront subscription charges
attributable to selected period)
```

Do not count unpaid or failed charges as revenue.

Apply existing refund logic consistently.

Do not create a new subscription model if the project already has one.

---

## 7. GMV MUST NOT BE CALLED REVENUE

If current values such as:

```text
Marketplace = ₼148,049
Storefront = ₼48,527
```

represent total service sales, they must be labelled:

```text
GMV Marketplace
GMV Storefront
```

not:

```text
Выручка Marketplace
Выручка Витрины
```

Do not alter data merely to make labels fit. First determine what the values actually represent.

---

## 8. TOTAL PLATFORM REVENUE

Audit the Financial section.

Where applicable:

```text
Total Platform Revenue
= Marketplace Revenue
+ Storefront Revenue
+ other valid TravelHub revenue sources
```

Do not include partner sales volume / GMV as TravelHub revenue.

Do not double-count commissions or subscriptions.

---

## 9. PERIOD FILTER INTEGRITY

A suspicious issue was observed: a smaller selected period can show a higher Channel Health value than a larger period containing it.

Audit specifically:

- GMV Marketplace;
- GMV Storefront;
- Marketplace Revenue;
- Storefront Revenue;
- Marketplace Orders;
- Storefront Orders.

Trace:

```text
Frontend selected period
↓
API parameters
↓
Dashboard service
↓
Database query
↓
Aggregation
```

For each metric identify the authoritative date field, such as:

- order date;
- payment date;
- commission date;
- subscription payment date;
- booking date;
- service date.

Use the date field appropriate to the existing accounting/data model.

Do not silently change the accounting basis.

---

## 10. REQUIRED NESTED-PERIOD TEST

Run:

### Period A

```text
01.08.2026 – 31.08.2026
```

### Period B

```text
01.01.2026 – 31.08.2026
```

Period B contains Period A.

For cumulative sales metrics:

```text
GMV(B) >= GMV(A)
Orders(B) >= Orders(A)
```

For revenue metrics, verify that aggregation is logically consistent with the selected accounting date.

If the relationship fails, find the exact root cause.

Do NOT modify seed data to hide the problem.

---

## 11. CHANNEL IDENTIFICATION

Verify the authoritative channel field.

Expected conceptual separation:

```text
MARKETPLACE
PARTNER_STOREFRONT
```

Do not infer channel from partner type or URL if the project already has a channel/publication field.

Use the existing authoritative source, such as:

- PublicationChannel;
- Order channel;
- storefront relation;
- publication;
- transaction source.

Ensure one transaction cannot accidentally be counted in both channels.

---

## 12. UI

Do not redesign Command Center.

Only correct:

- labels;
- metric meaning;
- formulas;
- data source;
- rendering;
- i18n;
- period filtering;

where required.

The resulting Channel Health should clearly distinguish:

```text
MARKETPLACE
GMV
Orders
Conversion
Revenue

STOREFRONT
GMV
Orders
Conversion
Revenue
```

Preserve the existing visual language.

---

## 13. I18N

Check RU / AZ / EN.

Russian terminology must use:

```text
GMV Marketplace
GMV Storefront
Выручка Marketplace
Выручка Storefront
```

Never use:

```text
Выручка Витрины
```

Do not translate Storefront into «Витрина» in KPI names.

Azerbaijani and English must preserve the distinction between GMV and TravelHub revenue.

---

## 14. DO NOT MODIFY UNRELATED SYSTEMS

Do NOT change:

- Sidebar;
- other Dashboard sections;
- Catalog Health;
- Needs Attention;
- AI Decision Feed;
- CRM;
- Booking Center;
- Analytics;
- unrelated Finance architecture.

Do not change the database schema unless a genuine missing field is discovered and absolutely required. Report such a limitation first.

---

## 15. FINAL REPORT

Return:

### A. Current Implementation Audit

| Metric | Current Label | Actual Meaning | Correct Label | Source | Formula |
|---|---|---|---|---|---|
| Marketplace | | | | | |
| Storefront | | | | | |

### B. Revenue Model

```text
Marketplace Revenue =
...

Storefront Revenue =
...

Total Platform Revenue =
...
```

### C. Period Filter Audit

For each:

- GMV Marketplace
- GMV Storefront
- Marketplace Revenue
- Storefront Revenue
- Marketplace Orders
- Storefront Orders

report:

```text
Date field:
Filter:
Aggregation:
Nested-period test:
Result:
```

### D. Changes Made

List exact files and actual changes.

### E. Tests

```text
Backend TSC:
Backend Build:
Frontend TSC:
Frontend Tests:
Frontend Build:
```

### F. Final Confirmation

Explicitly confirm:

- Marketplace GMV is not called Marketplace Revenue.
- Storefront GMV is not called Storefront Revenue.
- Marketplace Revenue is based on TravelHub commission.
- Storefront Revenue is based on TravelHub Storefront subscriptions.
- “Выручка Витрины” is not used.
- Marketplace and Storefront are correctly separated.
- Period filtering is correct.

## STOP

After completing this audit and correction, STOP.

Do not redesign Channel Health or the Command Center.
Do not add new KPIs beyond those required to correctly separate GMV and TravelHub Revenue.
