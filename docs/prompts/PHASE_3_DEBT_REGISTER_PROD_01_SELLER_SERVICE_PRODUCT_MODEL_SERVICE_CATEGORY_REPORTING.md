# PHASE 3 — ARCHITECTURE DEBT REGISTER MICRO-UPDATE
## PROD-01 — Seller Service Cards / Product Model / Service Category Reporting

---

# 0. Purpose

Register a newly identified unresolved architecture question in the canonical TravelHub Debt Register.

This is a **documentation-only architecture debt registration**.

Do not implement the Product/Service model, seller cards, service-category analytics, or any application functionality in this task.

---

# 1. Baseline

Current accepted repository baseline after closure of `UI-C1.2F.1`:

```text
b98a31dc6f27d1c93e9c7d4cf356480c28409d54
```

Current stage state:

```text
UI-C1.2F.1 — CLOSED

UI-C1.2G — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

Canonical Debt Register:

```text
docs/TRAVELHUB_DEBT_REGISTER.md
```

---

# 2. Strict Scope

Allowed:

```text
inspect current Debt Register structure/conventions
add one new architecture debt item
update Debt Register indexes/counts if required by its existing structure
create a short documentation report if repository conventions require it
commit/push documentation-only changes
Git hard closure
```

Forbidden:

```text
frontend changes
backend changes
database/schema changes
Prisma changes
API changes
analytics implementation
seller-card implementation
Product/Service implementation
service-category implementation
UI-C1.2G implementation
UI-C2
D8
```

Functional source changes are a blocker.

---

# 3. Audit First

Before editing, inspect:

```text
docs/TRAVELHUB_DEBT_REGISTER.md
```

Determine and preserve its actual:

```text
heading hierarchy
ID convention
status vocabulary
priority vocabulary
table/index structure
cross-reference convention
resolution/closure format
```

Do not reformat unrelated debt items.

Do not renumber existing IDs.

If `PROD-01` already exists, STOP and report the collision instead of overwriting it.

---

# 4. New Debt

Add:

```text
PROD-01 — Seller Service Cards / Product Model / Service Category Reporting
```

Canonical status:

```text
OPEN
```

Canonical intent:

The TravelHub seller-facing service/product model has not yet been fully designed. Consequently, final Service Category Reporting cannot yet be considered architecturally defined.

This debt is deliberately deferred until Seller Service Cards / Product Model design.

---

# 5. Problem Statement

The entry must make clear that the following remain unresolved:

```text
full supported service-category catalog
common Seller Service Card fields
category-specific Seller Service Card fields
required vs optional attributes
service variants/options
capacity / occupancy
availability / inventory
pricing / tariffs
cancellation conditions
media
localization
package/composite services
multi-supplier package ownership
commercial snapshots
service-category attribution through commerce lifecycle
service-category analytics/reporting contract
```

Do not claim these capabilities are absent from the codebase unless actually audited.

The debt concerns the **canonical architecture/model not yet being finalized**.

---

# 6. Domain Examples

Include examples to explain why a single generic card cannot be assumed sufficient.

## Accommodation

Potential domain attributes include:

```text
property / accommodation type
category / star rating
location
amenities

room types
room capacity
adults
children
bed configuration
room size
room amenities
media

meal plan
rate / tariff
cancellation policy
refundable / non-refundable
availability / inventory
```

These are architectural examples, not an implementation schema.

## Tour with Accommodation

Potential attributes include:

```text
destination / itinerary
dates
duration
traveler count
traveler composition / age categories
program

hotel / accommodation option
hotel category
room type
occupancy
meal plan

transport
transfer
excursions
additional services
included services
excluded services
pricing
```

Again, do not convert these examples into database fields in this task.

---

# 7. Major Open Architecture Question — Composite Services

Explicitly record the unresolved question:

```text
Is a tour/package with accommodation represented as:

A) one sellable service/product of category Tour/Package

or

B) a composite product containing multiple service components?
```

Example:

```text
TOUR PACKAGE
├── Accommodation
├── Transfer
├── Excursion
├── Guide
├── Meal
└── Insurance
```

Also record that individual components may potentially belong to different suppliers.

The canonical ownership/booking/pricing/refund model for that case is not yet finalized.

---

# 8. Downstream Dependencies

Record that resolution can affect:

```text
Seller Service Cards
Product / Service Catalog
Search / Filters
Inventory
Availability
Capacity / Occupancy
Pricing
Tariffs
Commission
Request
Order / OrderItem
Booking
Payment attribution
Refund attribution
Supplier attribution
Localization
Analytics
Service Category Reporting
```

This dependency list must not be interpreted as authorization to modify those domains now.

---

# 9. Commerce Attribution Question

Record that the future architecture must determine how service/category identity propagates through:

```text
Product / Service
        ↓
Request
        ↓
Order / OrderItem
        ↓
Booking
        ↓
Payment / Refund attribution
        ↓
Analytics
```

Do not assume frontend-derived category inference.

Future reporting must use server-authoritative domain data.

---

# 10. Historical Snapshot Requirement

Record the architectural requirement that future historical commerce reporting must not silently change merely because the seller later edits/reclassifies the current service/product.

The eventual design therefore needs explicit snapshot/version semantics for the commercial transaction.

Do not prescribe a specific database implementation in this debt-registration task.

---

# 11. Service Category Reporting — Deferred

Explicitly record:

```text
SERVICE CATEGORY REPORTING — DEFERRED
```

Reason:

```text
Final reporting dimensions must be derived from the accepted Seller Service /
Product domain model, not designed independently and then imposed on commerce data.
```

Future reporting is expected to evaluate, where applicable:

```text
GMV / Commerce Volume by Service Category
TravelHub Revenue by Service Category
Orders by Service Category
Bookings by Service Category
AOV by Service Category
Conversion by Service Category
Refund / Cancellation Rate by Service Category
trend by Service Category
```

Potential drill-down:

```text
All Services
→ Service Category
→ Service Type / Subcategory
→ Supplier
→ Product / Service
→ Order / Booking
```

These are future reporting requirements/targets, not current implemented claims.

---

# 12. Platform vs Partner Financial Semantics

Preserve the existing TravelHub architecture distinction.

Future category reporting must not collapse:

```text
Marketplace GMV
Storefront Commerce Volume
TravelHub Revenue
```

into one ambiguous metric.

The exact reporting contract remains deferred until the underlying Product/Service model is accepted.

---

# 13. Resolution Gate

`PROD-01` must remain OPEN until the architecture has resolved at least:

```text
1. supported TravelHub service-category catalog
2. common Seller Service Card contract
3. category-specific card contracts
4. required/optional attribute rules
5. variants/options model
6. package/composite-service model
7. multi-supplier component ownership
8. inventory / availability / capacity semantics
9. pricing / tariff semantics
10. commission attribution implications
11. historical snapshot/version semantics
12. Product → Request → OrderItem → Booking → Payment/Refund attribution
13. analytics dimensions
14. Service Category Reporting contract
```

Do not mark the debt resolved merely because it has been documented.

---

# 14. Current Decision

The entry must clearly state:

```text
STATUS: OPEN

DECISION:
DEFERRED until Seller Service Cards / Product Model architecture stage.

DO NOT:
finalize Service Category Reporting before the underlying Product/Service
domain model is accepted.
```

---

# 15. Cross-References

Where the Debt Register format supports cross-references, link `PROD-01` conceptually to existing relevant debt areas such as:

```text
DATA-*
FIN-*
analytics/help metadata where applicable
future commission/pricing architecture
```

Do not invent dependency IDs that do not exist.

Audit the register first and reference only real IDs.

---

# 16. Preserve Existing Debt

No unrelated debt may be:

```text
renamed
renumbered
closed
reprioritized
rewritten
deleted
```

Any count/index/summary adjustment must be mechanical and caused only by adding `PROD-01`.

---

# 17. Verification

After edit, verify:

```bash
git diff -- docs/TRAVELHUB_DEBT_REGISTER.md
git diff --check
git status --porcelain=v1
```

Review the actual diff.

Required:

```text
PROD-01 exists exactly once
PROD-01 status = OPEN
Service Category Reporting = DEFERRED
Seller Service Cards/Product Model is identified as prerequisite
composite/package question is explicitly OPEN
historical snapshot requirement recorded
no unrelated debt semantics changed
```

---

# 18. Documentation-Only Guard

Before commit:

```bash
git diff --name-only
```

Expected only:

```text
docs/TRAVELHUB_DEBT_REGISTER.md
```

plus, if repository conventions require it:

```text
docs/prompts/<this prompt>
docs/reports/<micro-update report>
```

No functional source files.

If functional files appear:

```text
STOP
VERDICT B
```

---

# 19. Git Hard Closure

Commit documentation only.

Suggested commit message:

```text
docs: register PROD-01 seller service product model debt
```

Then:

```bash
git push origin master
git fetch origin
```

Final literal proof:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git log -5 --oneline --decorate
git merge-base --is-ancestor b98a31dc6f27d1c93e9c7d4cf356480c28409d54 HEAD
echo $LASTEXITCODE
```

Required:

```text
working tree clean
HEAD == origin/master
branch = master
baseline ancestry = 0
```

---

# 20. Required Final Report

Use actual evidence only.

```text
PHASE 3 — ARCHITECTURE DEBT REGISTER MICRO-UPDATE
PROD-01 — Seller Service Cards / Product Model / Service Category Reporting

BASELINE SHA:
b98a31dc6f27d1c93e9c7d4cf356480c28409d54

FINAL SHA:
<actual full SHA>

DEBT REGISTER AUDITED                 — PASS
ID COLLISION                          — NONE
PROD-01 ADDED                         — PASS
PROD-01 STATUS                        — OPEN

SELLER SERVICE CARDS UNRESOLVED       — RECORDED
CATEGORY-SPECIFIC MODEL               — RECORDED
COMPOSITE/PACKAGE QUESTION            — RECORDED
MULTI-SUPPLIER QUESTION               — RECORDED
HISTORICAL SNAPSHOT REQUIREMENT       — RECORDED
COMMERCE ATTRIBUTION                  — RECORDED

SERVICE CATEGORY REPORTING            — DEFERRED
PLATFORM/PARTNER METRIC DISTINCTION   — RECORDED
RESOLUTION GATE                       — RECORDED

UNRELATED DEBT CHANGES                — NONE
FUNCTIONAL SOURCE CHANGES             — NONE
DIFF CHECK                            — PASS

WORKING TREE CLEAN                    — PASS
HEAD == origin/master                 — PASS
BASELINE ANCESTRY                     — PASS
GIT HARD CLOSURE                      — PASS

VERDICT A — PROD-01 REGISTERED / REMAINS OPEN
```

---

# 21. STOP

After this micro-update:

```text
STOP
```

Do not start:

```text
PROD-01 implementation
Seller Service Card design
Service Category Reporting implementation
UI-C1.2G
UI-C2
D8
```

Wait for independent review.
