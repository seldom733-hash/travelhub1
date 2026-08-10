# CANONICAL ROADMAP — SERVICE TEMPLATES / PERIOD PRICING & AVAILABILITY AMENDMENT
## STRICT REVIEW PROMPT

**Project:** TravelHub
**Mode:** STRICT REVIEW / DOCUMENTATION REVIEW FIXES ONLY
**Implementation:** MUST NOT START

# 1. MISSION

Independently review the completed Service Templates / Period Pricing & Availability canonical Roadmap amendment against the actual repository, schema, ADRs, completed Phase 2 foundations and Reverse Marketplace amendment. Do not trust the implementation report as evidence.

Only documentation review fixes are allowed. Do not change schema, migrations, backend, frontend, APIs, events, permissions or implement any roadmap step.

# 2. BASELINE

Report branch, HEAD, dirty/untracked files, pre-existing uncommitted Step 2.5 files, exact amendment documentation diff, and user prompt files. Do not modify pre-existing Step 2.5 code.

# 3. SOURCES

Inspect at minimum:
- canonical Roadmap v3;
- Deferred Decisions Map;
- ADR-0001, ADR-0005, ADR-0007, ADR-0011;
- Category / CategorySchema;
- Product;
- Tariff and all meaningful usages;
- Availability and AvailabilityReservation;
- Catalog reserveAvailability;
- Quote 2.3;
- Checkout 2.3A;
- Payment Terms 2.3B;
- Sale completion 2.4;
- Order consumer/snapshot 2.5;
- Partner Storefront / public catalog;
- Reverse Marketplace amendment and strict-review fixes;
- IDs/events contracts.

# 4. ROADMAP INTEGRITY

Verify no existing steps were deleted/renumbered, statuses remain truthful, 1.8A–1.8D are clearly post-baseline additions, logical placement is not confused with execution order, 3.29I does not conflict, Reverse Marketplace fixes remain intact, and there is only one canonical Roadmap.

# 5. CATEGORYSCHEMA — CRITICAL

Determine what CategorySchema actually models: product attributes, nesting/repeatability, validation, category-specific availability/tariff rules, versioning and lifecycle.

Do not assume that arbitrary JSON means it can safely model:
Hotel → repeated Seller Rooms → structured room attributes → multiple commercial variants.

Assess querying, filtering, stable identity and indexing. If CategorySchema is only a Product-attribute schema and Seller commercial units require first-class identity/lifecycle, state this explicitly and update DD-025. If unresolved: `ARCHITECTURE DECISION REQUIRED`.

# 6. SELLER COMMERCIAL UNIT IDENTITY — CRITICAL

Review whether Room/service-unit needs stable first-class identity. Consider:
- multiple Tariffs referencing one Room;
- Seller rename;
- stable Marketplace references;
- availability relation;
- import/source IDs;
- history/snapshot behavior.

Do not prematurely invent one universal ServiceUnit for all categories. But do not imply repeatable JSON is necessarily sufficient.

# 7. TARIFF VS RATE PLAN — PRIMARY GATE

Inspect actual Tariff model/usages and produce a matrix comparing:
identity/code, Product relation, ownership, name, price/currency, validFrom/validTo, meal plan, refundability, cancellation policy, included services, restrictions, price basis, occupancy, availability relation, lifecycle, history/audit.

Verdict must be one of:
A. Tariff is canonical commercial variant and should be extended.
B. Tariff is only a primitive price row and a separate higher-level Rate Plan is justified.
C. Architecture is ambiguous and needs ADR.

The Roadmap must never permit overlapping Tariff and RatePlan authorities. Update DD-024 if evidence resolves it.

# 8. PRICE AUTHORITY

Trace actual authority:
Catalog/Tariff → Quote → Checkout → Sale → Order.

Required invariant unless repository evidence contradicts it:
Catalog owns mutable sellable price before binding; canonical Quote owns binding price after issue/binding. No frontend price authority, no Checkout reprice, no Order reprice, no Sales write into Catalog price.

# 9. TARIFF VALIDITY SEMANTICS

Determine actual meaning of Tariff.validFrom/validTo. Do not silently reinterpret them as stay/service periods if they currently mean sales/booking validity.

Roadmap/DD-026 must distinguish where needed:
- booking/sales window;
- service/stay/departure period;
- publication validity.

# 10. PERIOD PRICE MODEL

Review whether seasonal/date pricing should eventually be:
- multiple Tariffs;
- price periods under a Tariff;
- date overrides;
- another Catalog-owned structure.

Evaluate hotel seasons, tour departures, transfer slots, overlapping periods, future API/channel-manager sources, bulk editing, Quote resolution and auditability. Final schema may remain deferred, but implementation prerequisites must be explicit.

# 11. AVAILABILITY MODEL

Inspect actual uniqueness/cardinality and determine whether Availability is date-, range-, slot- or mode-based and how tariff/product references work.

Review category needs:
- Hotel: capacity for every night of stay.
- Tour: departure capacity.
- Transfer: slot/vehicle capacity.
- Open-date: possibly no dated capacity at purchase.

Do not force one category model onto all categories.

# 12. MULTI-DATE HOTEL HOLD — BLOCKER CHECK

This is a major review gate.

Step 2.5 Strict Review approved an invariant where Step 2.4 creates one hold per commercial item and OrderRequested/Order preserve `reservationIds`, with current validation tied to item cardinality.

A hotel stay may require one commercial item but N nightly capacity allocations.

Determine whether current AvailabilityReservation can represent this safely.

Explicitly answer:
- one reservation per Availability date?
- one room stay → N reservation rows?
- if yes, current `reservationIds.length === items.length` becomes invalid;
- can one reservation aggregate multiple dates?
- what must change in future 2.4/2.5 contracts?

Document any required future compatibility migration in 1.8C/1.8D or appropriate dependency section. Do NOT treat this automatically as a current Step 2.5 defect.

# 13. PRICE ≠ AVAILABILITY ≠ HOLD

Confirm three distinct authorities:
1. commercial price/terms;
2. sellable capacity;
3. reservation/hold.

Do not introduce duplicate counters or a second hold engine.

# 14. OVERLAP / PRECEDENCE

Roadmap must require deterministic server-side resolution for overlapping periods/overrides. No two equally authoritative active prices may be chosen nondeterministically. Extend DD-026 if needed.

# 15. PRICE BASIS / OCCUPANCY

Review current Quote assumptions and ensure future model explicitly handles category-appropriate price basis (room/night, person, package, vehicle, group/service) without prematurely freezing an inflexible global enum.

Occupancy/PAX can affect price identity, not just filtering. DD-026 must cover this distinction.

# 16. SELLER NAME / NORMALIZATION

Verify invariant:
Seller-defined commercial names are preserved verbatim; TravelHub standardizes attributes, not names.

Normalization must not rewrite source identity. Historical Quote/Order display must not depend on current taxonomy values.

# 17. NORMALIZED TAXONOMY OWNERSHIP

Determine who owns normalized dictionaries. Reverse Marketplace may consume taxonomy for matching but must not become Catalog taxonomy owner. If unresolved, extend an existing DD or create a new one with deadline.

# 18. CATEGORY EXTENSIBILITY

Ensure Hotel concepts do not become universal assumptions. Review Tour, Transfer, Activity/Excursion and other category semantics. Do not require every category to have a Room-like child.

# 19. REVERSE MARKETPLACE

Strictly verify whether 1.8A–D truly do not block 2.2A–F.

Preserve:
Seller Capability ≠ Product ≠ live inventory.

If matching only requires category + destination coverage + Seller capabilities, Reverse Marketplace may proceed independently. If normalized commercial-unit attributes are required, document an explicit dependency.

# 20. CANONICAL SALES CONVERGENCE

No parallel pipeline may emerge. Marketplace and Reverse Marketplace must converge into existing:
Opportunity/Quote → Checkout → Sale → OrderRequested → Order → Booking/Finance.

Proposal remains non-binding until canonical Quote.

# 21. STEP 2.5 COMPATIBILITY

Step 2.5 is already Strict Review APPROVED. Determine whether future commercial-period/multi-date work will require changes to:
- OrderRequested item structure;
- reservationIds cardinality;
- Order reservation snapshot;
- serviceDate semantics;
- tariff refs.

Document future compatibility migrations. Do not reopen 2.5 without actual current evidence.

# 22. STEP 2.8A DEPENDENCY

Inspect actual Roadmap service-date semantics. Determine whether 2.8A is a hard prerequisite for 1.8C period availability/pricing, especially hotel date ranges, tour departures, transfer timestamps and open-date products.

If it is a hard dependency, state it explicitly rather than saying only “first safe point”.

# 23. MARKETPLACE DISPLAY / CURRENCY

Review `from N` pricing.

It must be server-derived from eligible authoritative commercial periods and truthful about availability.

Critical multi-currency question:
TravelHub must not compare `100 USD` and `90 EUR` numerically without an FX/display-price rule.

Either constrain same-currency comparisons or explicitly defer FX normalization. Add/extend a DD if needed.

# 24. PARTNER CABINET / 3.29I

Verify placement and avoid duplication with existing Partner Product editor steps. UI must follow backend authority and may include calendar/bulk price/availability/stop-sell/copy/import-mapping UX, but CSV/API/channel-manager integrations remain future extensions.

# 25. STOP SELL / RESTRICTIONS

Keep 1.8D minimal. Stop-sell is commercial sellability, not necessarily physical capacity=0. Do not build a revenue-management/rules engine.

# 26. AUDIT / IMPORT FUTURE COMPATIBILITY

Roadmap should anticipate enough history for meaningful price, availability, stop-sell and commercial-term changes. Do not publish events without consumers merely for audit.

DD-025 should consider stable source/external IDs so future repeated imports can reconcile instead of duplicate Seller units.

# 27. OWNERSHIP MAP

Produce/review ownership for:
Category, CategorySchema, Product, Seller commercial unit, Tariff/RatePlan, price period, Availability, AvailabilityReservation, normalized taxonomy, Seller capability, BuyerRequest, Proposal, Quote, Checkout, Sale, Order.

No two bounded contexts may own the same mutable fact.

# 28. DEFERRED DECISIONS

Review DD-024–DD-027 for question, owner, dependency, deadline and resolution trigger.

Consider whether existing DDs should be extended for:
- taxonomy ownership;
- multi-currency Marketplace `from` price;
- import/source identity.

Keep register counts and next ID correct.

# 29. EXECUTION SEQUENCE — REQUIRED VERDICT

Strictly answer:
1. Can 2.5A proceed next?
2. Can 2.5B proceed after 2.5A?
3. Must Reverse Marketplace ADR occur before 2.2A or before 2.2B?
4. Do any 1.8A–D decisions block 2.2A–F?
5. Does 2.8A block 1.8C?
6. At what latest point must DD-024–027 be resolved?

Do not preserve the amendment's proposed order without evidence.

# 30. APPROVAL GATES

Approve only if:
- Seller names are preserved;
- CategorySchema reuse is not falsely assumed;
- commercial-unit identity is resolved/deferred safely;
- Tariff/RatePlan duplication is prevented;
- Catalog remains pre-binding price owner;
- Quote remains binding authority;
- temporal semantics and overlap rules are explicit/deferred;
- price basis and occupancy are recognized;
- Availability and holds remain Catalog-owned;
- no second reservation engine exists;
- multi-date hold compatibility with 2.4/2.5 is explicit;
- Capability ≠ inventory remains intact;
- canonical Sales convergence remains intact;
- Marketplace `from` price is currency-safe;
- Partner UI is downstream;
- DDs have deadlines;
- sequence is evidence-based;
- completed steps are not retroactively invalidated;
- no implementation occurs.

# 31. REVIEW FIX POLICY

Documentation-only fixes are allowed and expected when required. Examples:
- Tariff/RatePlan clarification;
- multi-date reservation warning;
- service-date dependency;
- currency caveat;
- ownership correction;
- DD deadlines;
- numbering/status corrections.

If a decision cannot be derived safely: `ARCHITECTURE DECISION REQUIRED`.

# 32. VALIDATION

Inspect `git diff` and prove only allowed docs changed during this amendment/review. Pre-existing dirty Step 2.5 files must remain untouched. Full code regression is not required for docs-only review unless production code is accidentally changed.

# 33. REQUIRED FINAL REPORT

Return:

## 1. Verdict
One of:
`CANONICAL ROADMAP SERVICE TEMPLATES / PERIOD PRICING & AVAILABILITY STRICT REVIEW COMPLETED — APPROVED`
`CANONICAL ROADMAP SERVICE TEMPLATES / PERIOD PRICING & AVAILABILITY STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
`CANONICAL ROADMAP SERVICE TEMPLATES / PERIOD PRICING & AVAILABILITY STRICT REVIEW COMPLETED — CHANGES REQUIRED`
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Roadmap integrity
## 5. CategorySchema review
## 6. Seller commercial-unit identity
## 7. Tariff vs RatePlan matrix and verdict
## 8. Price authority
## 9. Period temporal semantics
## 10. Period price model
## 11. Availability model
## 12. Multi-date hold compatibility
## 13. Price / availability / hold separation
## 14. Overlap / precedence
## 15. Price basis / occupancy
## 16. Seller name / normalization
## 17. Taxonomy ownership
## 18. Category extensibility
## 19. Reverse Marketplace compatibility
## 20. Canonical Sales convergence
## 21. Step 2.5 compatibility
## 22. Step 2.8A dependency
## 23. Marketplace display / currency
## 24. Partner Cabinet / 3.29I
## 25. Audit/import compatibility
## 26. Ownership map
## 27. Deferred decisions review
## 28. Execution sequence verdict
## 29. Review findings
For each: severity, evidence, roadmap issue, review fix.
## 30. Files changed during review
## 31. Architecture decision status
## 32. Out-of-scope confirmation

Final line repeats the verdict.

# 34. STOP CONDITION

After Strict Review and documentation-only fixes: STOP.

Do NOT start 2.5A, 2.5B, Reverse Marketplace ADR, 2.2A–2.2F, 1.8A–1.8D or 3.29I. Wait for explicit next instruction.
