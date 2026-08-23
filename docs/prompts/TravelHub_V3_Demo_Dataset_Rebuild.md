# TravelHub — V3 Demo Dataset Rebuild & Business Integrity

## OBJECTIVE

Rebuild the current demo dataset so that it represents a realistic operational TravelHub environment and fully supports the existing V3 Dashboard / Command Center.

The current architecture is considered READY.

Do **not** redesign the architecture.

The primary task is to replace the insufficient demo data with a large, internally consistent, time-distributed, multi-channel, multi-currency business dataset.

The resulting dataset must allow the Command Center to answer meaningful business questions using real database-derived values.

---

## 1. ARCHITECTURAL CONSTRAINTS

DO NOT:

- change the left Sidebar;
- create new Sidebar modules;
- redesign the Command Center UI;
- implement clickable KPI cards;
- implement Drill-down navigation;
- implement WHAT → WHY → IMPACT → ACTION intelligence yet;
- replace existing Prisma models;
- duplicate existing Order / Booking / Payment / Refund / Commission / Storefront models;
- hardcode KPI values in Dashboard components;
- generate fake KPI values directly in the UI.

Use the existing architecture and existing models.

The task is:

**DATA FOUNDATION + BUSINESS RELATIONSHIPS + TEMPORAL REALISM + INTEGRITY**

---

## 2. EXISTING ARCHITECTURE TO PRESERVE

The audit confirmed:

- Prisma schema contains Order
- Booking
- Payment
- Refund
- Commission
- Storefront
- PublicationChannel
- Dashboard service
- 4 Dashboard sections
- 21 KPIs
- trends
- 24 widgets
- section RBAC
- RU/AZ/EN i18n
- unified KpiCard renderer

Do not recreate these systems.

Use the existing schema and services.

---

## 3. DATASET SIZE

Create approximately:

### Partners
**20–40**, recommended 28–30.

Use different profiles:

- Marketplace-only;
- Premium Storefront;
- high-performing;
- average;
- new;
- declining;
- high cancellation;
- strong historical sales;
- low conversion;
- products with low/no sales.

### Products / Services
**200–300**, recommended about 250.

Separate:

- current services: about 170–190;
- historical / archived services: about 50–80.

Historical products must remain linked to historical Orders.

---

## 4. PARTNER TYPES

Where supported by the existing schema, use realistic categories:

- Tour Operator
- Hotel
- Sanatorium
- Excursion Provider
- Guide
- Photographer / Videographer
- Transfer Provider
- Ticket / Transport Provider
- Activity / Experience Provider

Do not add a new schema solely for these categories if an existing field is suitable.

---

## 5. CURRENT VS HISTORICAL CATALOG

The system must distinguish:

### Current catalog
What can be purchased now.

### Historical catalog
What was available and/or sold in the past.

Do not delete historical products.

Create:

- archived products with historical sales;
- archived products without sales;
- current products with sales;
- current products without sales.

Expected lifecycle:

```text
Current:
Published → Active → Current sales

Historical:
Previously Published → Previously Sold → Archived
```

Historical Orders must remain valid after archival.

---

## 6. PUBLICATIONS

Populate the existing Publication / PublicationChannel structure.

Current products need valid current publication records.

Historical products need historical publication records.

Use the existing lifecycle where supported:

```text
Published → Active → Unpublished / Archived
```

Create realistic publication dates.

If the schema supports multiple publication periods, create some realistic examples.

Do not overwrite historical publication information merely to make a product current.

---

## 7. STOREFRONTS

Create **10–15 Partner Storefronts** using the existing Storefront model.

Not every Partner should have a Storefront.

Recommended profile:

```text
30 Partners
18 Marketplace-only
12 Premium Partners
12 Storefronts
```

Each Storefront must belong to a valid Partner.

Use realistic branded names and slugs.

Storefronts must use the Partner's existing products.

Do not duplicate Products solely for Storefronts.

The same Product may be sold through:

- Marketplace;
- Partner Storefront.

---

## 8. SALES CHANNELS

The dataset MUST contain both:

### MARKETPLACE
Sales through the main TravelHub marketplace.

### PARTNER_STOREFRONT
Sales through branded Partner storefronts.

Use the existing PublicationChannel enum/model.

Do not create a parallel channel system.

Recommended approximate distribution:

```text
Marketplace: 65–75%
Partner Storefront: 25–35%
```

Do not force an exact ratio.

---

## 9. ORDERS

Create approximately **500–1500 Orders**, recommended 1000–1200.

Orders must be distributed throughout:

**01.01.2026 → 31.12.2026**

Do NOT create all Orders in August 2026.

Use realistic seasonality:

- Q1: lower/moderate;
- Q2: increasing;
- Q3: high / peak;
- Q4: moderate with seasonal variation.

Do not distribute perfectly uniformly.

---

## 10. ORDER STATUSES

Use only existing valid statuses.

Create meaningful quantities of:

- NEW;
- SENT_TO_BOOKING;
- CLOSED / COMPLETED / FULFILLED equivalent;
- CANCELLED;
- other existing valid statuses.

There MUST be a significant number of completed / fulfilled Orders.

Do not leave completed Orders at zero.

---

## 11. BOOKINGS

Bookings must be logically related to Orders.

Include, where supported:

- NEW;
- SENT_TO_SUPPLIER;
- CONFIRMED;
- PARTIALLY_CONFIRMED;
- CANCELLED;
- COMPLETED / FULFILLED.

Use the actual project enum values.

The dataset must contain:

- completed bookings;
- upcoming bookings;
- pending confirmations;
- partially processed bookings;
- cancelled bookings.

---

## 12. CROSS-YEAR BOOKINGS

Mandatory.

Create Orders/Bookings created during 2026 whose service/travel dates occur in 2027.

Example:

```text
Order created: 31.12.2026
Booking: Confirmed / Pending
Service date: 05.01.2027
```

Also create additional 2027 service dates.

This allows Command Center to distinguish historical business, current workload, and future booking value.

---

## 13. DATE SEPARATION

Where supported by the schema, use separate realistic dates for:

- order created;
- booking;
- payment;
- confirmation;
- service/travel;
- completion;
- cancellation;
- refund.

Example:

```text
Order created: 15.12.2026
Payment: 15.12.2026
Booking confirmed: 16.12.2026
Service date: 05.01.2027
Completion: 05.01.2027
```

This is critical for future analytics.

---

## 14. PAYMENTS

Current dataset has **0 Payments**. Fix this.

Create Payments linked to real Orders.

Use all valid existing scenarios:

- PAID;
- PARTIALLY_PAID;
- PENDING;
- FAILED;
- REFUNDED;
- PARTIALLY_REFUNDED.

Do not invent statuses.

Amounts must be mathematically consistent.

Example:

```text
Order total: 1200 AZN
Paid: 600 AZN
Remaining: 600 AZN
Status: PARTIALLY_PAID
```

Do not create Paid > Order Total unless explicitly supported by existing business rules.

---

## 15. MULTI-CURRENCY

The current dataset contains only USD/RUB.

Add meaningful AZN transactions.

AZN must be the dominant local business currency.

Keep other currencies where supported.

Ensure Order currency, Payment currency, Refund currency, and Commission calculations remain internally consistent.

Do not introduce uncontrolled currency conversion in seed logic.

If existing exchange-rate handling exists, use it.

---

## 16. COMMISSIONS

Current dataset has **0 Commissions**.

Create real Commission records linked to valid Orders.

Commission must derive from Order economics.

Example:

```text
Order: 1000 AZN
Commission rate: 10%
Platform commission: 100 AZN
Partner amount: 900 AZN
```

Use realistic variation if the existing model supports it.

Do not create disconnected commission records.

Ensure totals reconcile with existing Finance metrics.

---

## 17. REFUNDS

Current dataset has **0 Refunds**.

Create realistic scenarios where supported:

- full refund;
- partial refund;
- refund requested;
- refund approved;
- refund completed;
- refund delayed/pending.

Every Refund must correspond to a valid Order and/or Payment according to the existing schema.

Examples:

```text
Order: 1000 AZN
Full refund: 1000 AZN
```

or:

```text
Order: 1000 AZN
Partial refund: 350 AZN
```

Do not create Refund > eligible paid amount unless existing business rules explicitly support it.

---

## 18. CANCELLATIONS

Create realistic cancelled Orders and Bookings.

Cancellations must occur at different stages:

- shortly after creation;
- before supplier confirmation;
- after confirmation;
- close to service date.

Do not make all cancellations identical.

---

## 19. CUSTOMERS

Create a realistic customer population.

Customers must not map one-to-one to Orders.

Include customers with:

- one order;
- multiple orders;
- multiple bookings;
- high spend;
- cancelled orders;
- repeat purchases.

This supports future CRM analytics.

---

## 20. PRODUCT PERFORMANCE PROFILES

Create product groups:

### HIGH DEMAND
High views / booking activity / sales.

### LOW CONVERSION
Meaningful exposure but low bookings.

### NO SALES
Currently published but no completed sales.

### SEASONAL
Strong performance during particular periods.

### HISTORICAL HIGH PERFORMERS
Archived products with significant historical sales.

### NORMAL
Average performance.

Do not distribute performance randomly.

---

## 21. HISTORICAL HIGH-PERFORMING SERVICES

Create several historical services that were:

```text
Published
→ Sold
→ Generated meaningful revenue
→ Archived
```

Example:

```text
Historical Service A
Orders: 120
Revenue: 48,000 AZN
Archived: 30.06.2026
```

The service must remain available for historical analytics.

---

## 22. CURRENT SERVICES WITHOUT SALES

Create a meaningful group of current published services with:

- views/exposure;
- no completed sales.

These should contribute to:

**Catalog Health → Services Without Sales**

Do not count archived historical products as current Without Sales unless the existing Dashboard definition explicitly does so.

---

## 23. REPLACEMENT PRODUCTS

Create several lifecycle replacement scenarios:

```text
Old Product
→ Published Jan–Jun
→ Strong historical sales
→ Archived

Replacement Product
→ Published Jul
→ Current
→ Strong sales
```

This supports future lifecycle analytics.

---

## 24. BUSINESS REALISM

The dataset must not look random.

Use realistic relationships:

- strong Partners have more Products;
- Marketplace-only Partners have no Storefront;
- Premium Partners have Storefronts;
- high-demand Products receive more Orders;
- low-conversion Products receive exposure but fewer Orders;
- some Partners have higher cancellation rates;
- some Partners improve;
- some decline;
- some are new;
- some historical Products performed strongly.

Do not make all entities statistically identical.

---

## 25. COMMAND CENTER COMPATIBILITY

The dataset must support the existing V3 Dashboard.

### Catalog Health

Meaningful values for:

- Published Services;
- Archived Services;
- Without Sales;
- High Demand;
- Low Conversion;
- Categories.

### Channel Health

Meaningful values for:

- Marketplace Revenue;
- Storefront Revenue;
- Marketplace Orders;
- Storefront Orders;
- Conversion metrics.

### Needs Attention

Meaningful values for:

- Pending Confirmations;
- Cancellations;
- Upcoming Bookings;
- Services Without Sales.

### AI Decision Feed

The existing feed must retrieve real underlying data.

Do not hardcode AI insight values in the UI.

---

## 26. CONVERSION DATA INTEGRITY

Previous audit showed:

```text
Marketplace Conversion: 99.08%
Storefront Conversion: 99.26%
```

These values require investigation.

Do NOT simply change the numbers.

Audit:

- impressions/views;
- product views;
- booking starts;
- Orders;
- confirmed Bookings;
- completed Orders.

Document the exact existing formula:

- numerator;
- denominator;
- source fields;
- sample calculation.

Determine whether the metric is:

```text
Views → Booking
```

or:

```text
Booking → Order
```

or another existing definition.

Do not modify architecture merely to make percentages look plausible.

---

## 27. DATA INTEGRITY RULES

Validate all existing relationships.

Expected:

```text
Every Order
→ valid Customer
→ valid Product
→ valid Partner
→ valid Channel where applicable

Every Booking
→ valid Order

Every Payment
→ valid Order

Every Commission
→ valid Order

Every Refund
→ valid Order and/or Payment

Every Storefront
→ valid Partner

Every Publication
→ valid Product / Partner
```

Also validate:

```text
Refund <= eligible paid amount
Payment <= order total where applicable
Commission <= order economics
Service date >= order creation date
Completion date >= service date where applicable
```

Respect stricter existing business rules.

---

## 28. SEEDING REQUIREMENTS

Use the existing seed mechanism if available.

Do not create a parallel seed system.

Seed should be:

- deterministic/reproducible where practical;
- idempotent where expected;
- safe for demo/test environments;
- compatible with Prisma migrations/schema.

Do not modify production data.

---

## 29. POST-SEED AUTOMATED AUDIT

After generating the dataset, run an automated validation report.

Include:

```text
Partners
Products
Current Products
Historical Products
Archived Products
Orders
Bookings
Payments
Commissions
Refunds
Customers
Storefronts
Publications
```

Also:

```text
Marketplace Orders
Storefront Orders

Completed Orders
Upcoming Orders
Pending Orders
Cancelled Orders
Partially Confirmed Orders

AZN Transactions
Other Currency Transactions

2026 Orders
2027 Service Dates

Archived Products With Historical Sales
Archived Products Without Sales
Current Products Without Sales
High Demand Products
Low Conversion Products
```

---

## 30. RELATIONSHIP INTEGRITY AUDIT

Report invalid relationship counts.

Expected:

```text
Orders without Customer:              0
Orders without Product:               0
Orders without Partner:               0
Bookings without Order:               0
Payments without Order:               0
Commissions without Order:            0
Refunds without valid parent:         0
Storefronts without Partner:          0
Publications without valid Product:   0
```

Financial/date validation:

```text
Refund > eligible payment:            0
Invalid commission amount:             0
Invalid payment amount:                0
Invalid service dates:                 0
```

---

## 31. REQUIRED FINAL REPORT

Do NOT simply respond "Done".

Return a structured report containing:

### Dataset Summary
Actual generated counts.

### Channel Distribution
Marketplace vs Storefront:

- Orders;
- Revenue;
- percentage.

### Temporal Distribution
Orders by:

- Q1;
- Q2;
- Q3;
- Q4.

### Status Distribution
Orders / Bookings / Payments / Refunds by status.

### Currency Distribution
AZN and other currencies.

### Catalog Distribution
Current vs Historical vs Archived.

### Storefront Distribution
Marketplace-only vs Premium Storefront Partners.

### Integrity Audit
All validation checks and results.

### Conversion Audit
Explicitly state:

- formula;
- numerator;
- denominator;
- sample calculation;
- resulting values.

### Build / Test Status
Run and report:

- Backend TSC;
- Backend Build;
- Frontend TSC;
- Frontend Tests;
- Frontend Build.

---

## 32. STOP CONDITION

After completing the dataset rebuild and integrity audit:

**STOP.**

Do NOT proceed to:

- WHAT → WHY → IMPACT → ACTION;
- AI intelligence redesign;
- clickable cards;
- Drill-down;
- Sidebar changes;
- new modules;
- Analytics redesign.

The next step will be a separate review of the generated dataset and Command Center behavior.

---

## FINAL PRINCIPLE

The purpose is NOT merely to make Dashboard numbers look realistic.

The purpose is to create a connected synthetic business environment:

```text
Partner
↓
Product
↓
Publication
↓
Marketplace / Storefront
↓
Customer
↓
Order
↓
Booking
↓
Payment
↓
Commission
↓
Fulfillment
↓
Cancellation / Refund
```

This must form a coherent and historically consistent business history.

Only after this foundation is correct should the Command Center be taught to answer:

**WHAT → WHY → IMPACT → ACTION**
