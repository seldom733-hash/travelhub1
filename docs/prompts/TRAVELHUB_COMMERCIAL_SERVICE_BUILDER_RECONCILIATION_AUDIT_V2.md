# TRAVELHUB — COMMERCIAL SERVICE BUILDER / PRICING
# STRICT READ-ONLY RECONCILIATION AUDIT — V2

## 0. PURPOSE

Perform a strict read-only reconciliation audit of the CURRENT TravelHUB repository against the business and commercial architecture agreed by the owner.

The purpose is NOT to implement anything.

The purpose is to answer:

> What of the agreed model already exists in the repository, what exists partially, what is missing, and what contradicts the agreed architecture?

The audit must be based on the actual repository, current database/schema where read-only inspection is possible, existing tests, DTOs, services, controllers, frontend screens, and existing architecture terminology.

Do not infer implementation merely because an entity or field exists.

---

# 1. ABSOLUTE READ-ONLY RULE

During this audit:

- DO NOT modify production code.
- DO NOT modify frontend code.
- DO NOT modify backend code.
- DO NOT modify Prisma/schema.
- DO NOT create migrations.
- DO NOT modify database data.
- DO NOT create/update/delete test data.
- DO NOT modify tests.
- DO NOT commit.
- DO NOT push.
- DO NOT reformat files.
- DO NOT "fix" discovered defects.

Only inspect, trace, compare, and report.

---

# 2. IMPORTANT ARCHITECTURAL PRINCIPLE

Do not invent new entities merely because the target model uses a conceptual term.

First inspect whether the existing repository already contains an equivalent concept such as:

- Quote
- Sale
- Offer
- Order
- OrderItem
- Request
- Service
- Product
- Booking
- Payment
- Supplier Settlement
- Partner
- Supplier
- Commercial Snapshot

If an existing entity already represents the required concept, report the existing entity rather than proposing a duplicate.

The audit must preserve the repository's actual terminology.

---

# 3. AGREED TARGET BUSINESS MODEL

The agreed model is:

```text
REQUEST
   ↓
Commercial Service Builder / Offer
   ↓ customer accepts
ORDER
   ↓
Order Items
   ├── Bookings / fulfillment
   ├── Customer Payments
   └── Supplier Settlements
```

The Request represents the customer's demand and the manager's negotiable commercial proposal before acceptance.

The Order represents the accepted and frozen commercial truth.

---

# 4. FOUR REQUIRED COMMERCIAL ENTRY SCENARIOS

Audit all four scenarios independently.

## SCENARIO A — WEBSITE REQUEST / CATALOG PURCHASE

Customer:

```text
Create Request
→ Select service
→ Destination / dates / travelers / requirements
→ Submit / Buy
```

For a catalog service:

```text
Supplier Net Cost
        +
TravelHUB Markup
        =
CATALOG SELLING PRICE
```

The catalog selling price is already the TravelHUB customer price.

If the customer accepts this price through the website:

```text
Catalog
→ Customer accepts published price
→ Request
→ Order
```

There must be no second markup application.

Audit:

- where catalog price is calculated;
- where it is displayed;
- whether Request receives the catalog selling price;
- whether supplier cost is preserved;
- whether the customer is treated as accepting the catalog price;
- whether the conversion to Order freezes the accepted commercial values.

---

# 5. SCENARIO B — LIVE SALES FROM AN EXISTING CATALOG TOUR

Customer sees catalog price but does not accept it.

Example:

```text
Catalog Price = 1,100
Customer wants to negotiate
→ WhatsApp / phone / office / chat
→ Live Sales
```

Manager may provide an individual discount.

## CRITICAL OWNER RULE

There is NO percentage-based discount limit for the manager.

Do NOT assume or introduce:

- maximum discount percentage;
- role-based percentage thresholds;
- approval thresholds based on discount size;
- `ALLOW / REQUIRE APPROVAL / DENY` logic based on discount percentage.

The mandatory commercial rule is only:

```text
FINAL CUSTOMER PRICE >= SUPPLIER NET COST
```

A final price equal to supplier net cost is allowed:

```text
Supplier Net Cost = 1,000
Final Customer Price = 1,000
Gross Profit = 0
Gross Margin = 0%
```

A final price below supplier net cost is prohibited:

```text
Supplier Net Cost = 1,000
Final Customer Price = 950
→ BLOCK
```

The system must not reject a discount because it is "too large" as a percentage.

It must reject the resulting price only when:

```text
Final Customer Price < Supplier Net Cost
```

The manager must be able to see the commercial consequence of the discount:

```text
Catalog / Original Price
Individual Discount
Final Customer Price
Supplier Net Cost
Expected Gross Profit
Expected Gross Margin %
```

The original catalog price must remain preserved.

The public catalog price must NOT be changed for the individual customer.

Target:

```text
Catalog Price
      ↓
Individual Discount
      ↓
Final Customer Price
```

Audit:

- whether catalog price is preserved;
- whether discount is separate from catalog price;
- whether the system imposes any discount percentage limit;
- whether any role/approval threshold is tied to discount size;
- whether supplier-floor validation exists;
- whether final price can equal supplier cost;
- whether final price below supplier cost is blocked;
- whether reason/actor/timestamp are recorded where the existing architecture supports audit;
- whether expected profit changes visibly when discount changes.

Do not invent a discount policy if none exists.

---

# 6. SCENARIO C — LIVE SALES FOR A NON-CATALOG TOUR

A manager may sell a supplier service that has no TravelHUB Product.

Target model:

```text
Request
  └── Service Line
       ├── Product = NULL
       ├── Supplier / Partner
       ├── Supplier Cost
       └── Customer Price
```

Product is catalogization, not a mandatory prerequisite for selling a service.

Audit:

- can a Request contain a service without Product;
- can a manager select a Partner/Supplier without Product;
- can supplier cost be entered;
- can customer price be entered;
- can the commercial result be calculated;
- can such a service be accepted into Order;
- is the historical service snapshot preserved.

---

# 7. SCENARIO D — ASSEMBLED TOUR FROM MULTIPLE SUPPLIERS

The system must conceptually support one customer Request containing multiple service lines from different suppliers.

Example:

```text
REQUEST

Flight
  Supplier: AZAL
  Supplier Cost: 600
  Customer Price: 700

Hotel
  Supplier: KOMPAS
  Supplier Cost: 900
  Customer Price: 1,000

Transfer
  Supplier: Local Partner
  Supplier Cost: 80
  Customer Price: 100

Insurance
  Supplier: Insurance Partner
  Supplier Cost: 40
  Customer Price: 60

Visa
  Supplier: Visa Partner
  Supplier Cost: 30
  Customer Price: 50

Excursion
  Supplier: Local Partner
  Supplier Cost: 50
  Customer Price: 70
```

Expected totals:

```text
Supplier Cost = 1,700
Customer Price = 1,980
Expected Gross Profit = 280
Gross Margin = 280 / 1,980
```

Audit:

- whether multiple service lines are supported;
- whether each line can have a different supplier;
- whether each line can have a different Product or no Product;
- whether supplier cost is stored per line;
- whether customer price is stored per line;
- whether total cost and total customer price are calculated;
- whether expected gross profit and margin are visible;
- whether Order preserves every individual service line;
- whether Booking can refer to the specific OrderItem/service;
- whether customer payments and supplier settlements remain separate.

---

# 8. SERVICE BUILDER FORM

Audit the actual UI and backend model for the agreed:

```text
[ + Добавить услугу ]
```

Conceptually, a service line may contain:

```text
Service Type
Service Name / Description
Partner / Supplier
Supplier Reference
Product (optional)
Supplier Cost
Supplier Currency
Pricing Source
Markup information where applicable
Public/Catalog Price where applicable
Individual Discount where applicable
Final Customer Price
Customer Currency
Price calculated at
Price validity where applicable
Commercial Snapshot
```

Do not assume these exact fields exist.

Determine what actually exists.

For each field report:

```text
IMPLEMENTED
PARTIAL
MISSING
CONTRADICTORY
NOT APPLICABLE
```

---

# 9. SERVICE TYPES

Audit whether the current system supports or is architecturally ready for:

- TOUR
- HOTEL
- FLIGHT
- TRANSFER
- INSURANCE
- VISA
- EXCURSION
- CAR_RENTAL
- OTHER

Do not require these exact enum names if the repository uses another canonical representation.

Report the actual current representation.

---

# 10. PARTNER / SUPPLIER DIRECTORY

Audit the central Partner/Supplier model.

Target business requirement:

The manager selecting where a service was purchased should select the supplier/partner from a central extensible directory.

Not every Partner must be a catalog seller or API supplier.

Examples:

```text
KOMPAS
  Partner
  Catalog
  API
  Live Sales

Local Transfer Company
  Partner
  No catalog
  No API
  Live Sales

Direct Hotel
  Partner
  No catalog
  No API
  Live Sales
```

Audit:

- existing Partner/Supplier entities;
- roles/capabilities;
- ability to add partners;
- relationship to catalog suppliers;
- relationship to Live Sales;
- whether service lines can reference the central directory;
- whether supplier selection is hardcoded anywhere.

---

# 11. PRICING ARCHITECTURE

Audit the current Supplier Markup implementation against the agreed rule.

## Catalog

```text
Supplier Net Cost
+
TravelHUB Markup
=
Catalog Selling Price
```

The catalog selling price is the customer-facing price.

It must NOT receive a second markup when copied into a Request or Live Sales flow.

## Live Sales

```text
Catalog Price
-
Individual Discount
=
Final Customer Price
```

The manager discount has no percentage cap.

The only mandatory floor is:

```text
Final Customer Price >= Supplier Net Cost
```

Zero gross profit is allowed.

Negative gross profit is not allowed.

For non-catalog supplier quotes:

```text
Supplier Quote / Supplier Cost
→ Manager negotiated customer price
```

Do not silently apply a second markup if the manager is already entering a negotiated customer price.

Audit:

- MarkupRule;
- pricing service;
- public price;
- supplier net cost;
- individual discount;
- final customer price;
- price source/provenance;
- double-markup risks;
- supplier floor;
- price snapshots;
- price freshness.

---

# 12. SUPPLIER COST DEFINITION

Determine exactly what the repository currently treats as supplier cost.

The agreed concept is:

```text
Supplier price after applicable supplier-provided
discounts / commissions
=
Supplier Net Cost to TravelHUB
```

Do not assume every supplier exposes this decomposition.

Audit:

- what value is actually received from suppliers;
- whether supplier discounts/commissions are represented;
- whether the stored value is gross or net;
- whether TravelHUB markup is applied to the correct base;
- whether supplier cost is preserved in snapshots.

If the repository cannot distinguish supplier gross from supplier net, report that explicitly.

---

# 13. EXPECTED PROFIT / MARGIN

Audit whether the manager can see:

```text
Supplier Cost
Customer Price
Discount
Expected Gross Profit
Expected Gross Margin %
```

Expected gross profit:

```text
Customer Price - Supplier Cost
```

Expected gross margin:

```text
Gross Profit / Customer Price × 100
```

For multiple service lines:

```text
Σ Customer Prices
-
Σ Supplier Costs
=
Expected Gross Profit
```

Do not call this accounting net profit.

The manager may see zero expected profit.

The system must prevent negative expected profit caused by:

```text
Customer Price < Supplier Cost
```

Determine whether these values are:

- calculated;
- visible to the manager;
- persisted;
- snapshot-frozen at acceptance;
- recalculated after discount changes.

---

# 14. DISCOUNT RULE — NO MANAGER SIZE LIMIT

This section supersedes any earlier assumption about discount authority.

Audit only these mandatory rules:

1. Manager discount has no percentage cap.
2. Manager may reduce the customer price as commercially appropriate.
3. Final Customer Price may equal Supplier Net Cost.
4. Final Customer Price may NOT be below Supplier Net Cost.
5. Expected profit/margin must update accordingly.
6. The public catalog price remains unchanged.
7. Individual discount must be distinguishable from the public/catalog price.

Do NOT recommend or introduce percentage approval thresholds unless the repository already contains an independent business rule unrelated to this architecture. If such a rule exists, report it as existing behavior and flag it for owner review rather than silently changing it.

---

# 15. REQUEST → ORDER

Audit what happens when the customer accepts the commercial proposal.

Target:

```text
Request
  └── Service Lines
       ↓
Customer Accept
       ↓
Order
  └── Frozen Order Items / commercial snapshot
```

Check:

- whether the same Request context is preserved;
- whether the service lines become OrderItems or existing equivalent;
- whether supplier cost is frozen;
- whether customer price is frozen;
- whether discount is frozen;
- whether supplier identity is frozen;
- whether Product may be NULL;
- whether catalog/non-catalog/assembled services all survive conversion;
- whether conversion creates duplicate commercial entities.

---

# 16. ORDER / BOOKING / PAYMENTS

Audit the separation:

```text
ORDER
  ├── Commercial truth
  ├── Customer Payments
  ├── Supplier Settlements
  └── Order Items
        └── Bookings / fulfillment
```

Important:

Booking is an operational fulfillment record.

Booking is NOT equivalent to:

- customer payment;
- supplier payment;
- financial completion.

Audit existing implementation for:

### Customer Payments

- existing Payment model;
- manual/offline payments;
- status;
- actor;
- reason;
- order attribution.

### Supplier Settlements

- whether separate supplier settlement exists;
- whether supplier cost/obligation can be tracked separately from customer payment.

### Bookings

- whether Booking references a specific OrderItem/service;
- whether multiple suppliers can coexist under one Order.

---

# 17. WEBSITE REQUEST FORM

Audit the actual current website form.

Determine:

1. How does user start a Request?
2. Does user first choose a service?
3. Which destination fields exist?
4. Which dates exist?
5. Traveler fields?
6. Product/catalog selection?
7. Contact/customer resolution?
8. What price is shown?
9. What price is sent to backend?
10. What price is persisted?
11. What screen does user see after submission?
12. Does website submission create Request only or directly create Order in any scenario?
13. How is customer acceptance represented?

Do not redesign it.

Report the current state.

---

# 18. LIVE SALES FORM

Audit the actual current Live Sales UI.

Determine whether manager can:

- create/find customer;
- create/open Request;
- select catalog service;
- select non-catalog service;
- add service;
- select Partner/Supplier;
- select Product optionally;
- enter supplier cost;
- enter customer price;
- apply individual discount without a percentage cap;
- see supplier floor validation;
- see expected profit;
- see expected margin;
- add multiple services;
- mix suppliers;
- accept customer;
- convert to Order.

Report every missing capability.

---

# 19. SNAPSHOTS AND HISTORICAL INTEGRITY

Audit whether historical commercial data is frozen.

Required conceptual behavior:

```text
Catalog Price at negotiation
        ↓
Request commercial state
        ↓
Customer accepts
        ↓
Order commercial snapshot
```

Later:

- MarkupRule changes;
- supplier price changes;
- catalog price changes;
- Product changes;
- supplier mapping changes;

must NOT mutate the historical accepted Order.

Check actual implementation.

---

# 20. PRICE PROVENANCE

Audit whether the system can answer:

> Where did this customer price come from?

Possible conceptual sources include:

```text
CATALOG
CATALOG_LIVE_REPRICE
SUPPLIER_QUOTE
MANUAL_SUPPLIER_PRICE
NEGOTIATED
ASSEMBLED
```

Do not require these exact enum values.

Determine the actual repository implementation.

For every existing price source, document:

- source;
- supplier;
- supplier cost;
- markup;
- discount;
- customer price;
- timestamp;
- validity/freshness;
- snapshot behavior.

---

# 21. CATALOG PRICE MUST BE PROTECTED

The catalog price is the published TravelHUB selling price.

Manager negotiation must NOT mutate the public catalog price for one customer.

Instead:

```text
Catalog Price
+
Individual Discount
=
Customer Final Price
```

Audit whether current implementation follows this.

---

# 22. REPORT FORMAT

Produce a strict report with these sections.

## A. Executive Verdict

One of:

```text
READY
READY WITH GAPS
PARTIALLY IMPLEMENTED
MAJOR GAPS
ARCHITECTURE CONFLICT
```

Explain briefly.

## B. Current Architecture

Describe what actually exists today.

## C. Target Architecture

Restate the agreed target model.

## D. Reconciliation Matrix

Use:

| Area | Current Implementation | Target | Status | Evidence |
|---|---|---|---|---|
| Website Request | ... | ... | ... | file:line |
| Catalog Price | ... | ... | ... | ... |
| Live Sales | ... | ... | ... | ... |
| Service Builder | ... | ... | ... | ... |
| Supplier Cost | ... | ... | ... | ... |
| Customer Price | ... | ... | ... | ... |
| Discount | ... | ... | ... | ... |
| Supplier Floor | ... | ... | ... | ... |
| Expected Profit | ... | ... | ... | ... |
| Multi-supplier | ... | ... | ... | ... |
| Request → Order | ... | ... | ... | ... |
| Order Snapshot | ... | ... | ... | ... |
| Customer Payment | ... | ... | ... | ... |
| Supplier Settlement | ... | ... | ... | ... |
| Booking | ... | ... | ... | ... |

## E. Four Scenario Results

Explicitly evaluate:

1. Website catalog purchase.
2. Live Sales from catalog.
3. Live Sales non-catalog.
4. Multi-supplier assembled tour.

## F. Price Flow Diagram

Show actual current flow.

Then target flow.

## G. Profit Visibility

State exactly where and whether the manager sees:

- supplier cost;
- customer price;
- discount;
- expected gross profit;
- margin.

## H. Critical Gaps

Rank:

```text
P0 — blocks core business flow
P1 — major functional gap
P2 — important but non-blocking
P3 — enhancement
```

## I. Risks / Contradictions

Especially identify:

- double markup;
- supplier-cost ambiguity;
- missing Product support;
- missing multi-supplier support;
- catalog price mutation;
- supplier-floor bypass;
- missing snapshot;
- Booking/payment responsibility mixing;
- duplicate entity risk;
- hidden discount restrictions.

## J. Minimal Safe Implementation Scope

Describe what must be implemented next.

Do NOT implement it.

Prefer extending existing entities/services over creating duplicates.

## K. Regression Plan

List targeted tests required after implementation.

## L. Final Verdict

State:

```text
WHAT EXISTS
WHAT IS MISSING
WHAT MUST CHANGE
WHAT MUST NOT CHANGE
```

---

# 23. EVIDENCE STANDARD

Every important conclusion must have repository evidence:

- file path;
- class/function/component;
- line or symbol where possible;
- relevant test evidence.

Do not write:

> "The system probably supports..."

Instead write:

> "Implemented in X because Y calls Z..."

If evidence is unavailable:

```text
NOT VERIFIED
```

Do not convert absence of evidence into a definitive implementation claim.

---

# 24. FINAL SAFETY CHECK

At the end verify:

```text
Production code changed: NO
Schema changed: NO
Database data changed: NO
Tests changed: NO
Migration created: NO
Commit created: NO
Push performed: NO
```

If any accidental modification occurs, STOP and report it immediately.
