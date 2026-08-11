# PHASE 1 --- STEP 1.8A --- SERVICE TEMPLATE / SELLER COMMERCIAL STRUCTURE FOUNDATION

**Project:** TravelHub\
**Phase:** 1 --- Catalog Foundation Extension\
**Step:** 1.8A\
**Mode:** IMPLEMENTATION\
**Previous gate:**
`SERVICE TEMPLATES RETURN POINT DECISION GATES COMPLETED — APPROVED FOR IMPLEMENTATION`\
**Canonical NEXT:**
`Step 1.8A — Service Template / Seller Commercial Structure Foundation`

------------------------------------------------------------------------

## 1. Mission

Implement the canonical foundation for Seller-defined commercial/service
units inside the existing `catalog.*` bounded context.

The implementation must realize the approved DD-025 decision:

> `CategorySchema` remains the template/schema authority, but a
> persistent Seller commercial/service unit requires a distinct
> Catalog-owned entity.

Conceptually:

`Category → CategorySchema(template) → Seller Product → Seller Commercial/Service Unit → Tariff (Rate Plan foundation)`

Examples:

-   Hotel Product → `Deluxe Room Sea View`
-   Hotel Product → `Premium Double Ocean Side`
-   Tour Product → seller-defined package/variant
-   Transfer Product → seller-defined vehicle/service variant
-   Excursion Product → ticket/service variant
-   Car Rental Product → vehicle class/service variant

Hard invariant:

> Seller-defined commercial names are preserved verbatim; TravelHub
> standardizes attributes, not names.

This step establishes **structure and identity only**.

Do not implement the Universal Pricing Model, CommercialPeriod, period
pricing, multi-date availability, Rate Plan extensions from 1.8B, or
Partner Cabinet UI.

------------------------------------------------------------------------

## 2. Mandatory baseline inspection

Before modifying code, record:

-   branch;
-   HEAD;
-   relation to `origin/master`;
-   `git status`;
-   tracked/untracked files;
-   migration count/status;
-   drift status;
-   current Roadmap active item;
-   DD-025 status;
-   Step 1.8A exact Roadmap contract.

The previous decision pass was documentation-only. Do not overwrite
unrelated dirty files.

------------------------------------------------------------------------

## 3. Mandatory sources

Inspect repository truth at minimum:

### Canonical planning

-   `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
-   `CURRENT CANONICAL EXECUTION SEQUENCE`
-   `docs/prompts/TRAVELHUB_DEFERRED_DECISIONS_MAP.md`
-   `docs/architecture/service-templates-decision-gates.md`
-   Service Templates / Period Pricing & Availability amendment
-   Universal Pricing amendment only for compatibility --- **do not
    implement it here**

### Architecture

-   ADR-0001
-   ADR-0005 where seller public identity matters
-   Catalog ownership documentation
-   moderation/publication architecture
-   existing Product architecture
-   Category / CategorySchema architecture

### Code/schema

Inspect actual:

-   `Category`
-   `CategorySchema`
-   `Product`
-   Product create/update/publish/moderation flow
-   `Tariff`
-   `Availability`
-   `AvailabilityReservation`
-   Catalog module/services/controllers/DTOs/validation
-   Partner ownership resolution
-   IDs service / business sequences
-   permissions/RBAC
-   audit/history conventions
-   contracts: IDs/API/events where applicable
-   Catalog E2E/unit tests.

Repository truth wins over this prompt where naming differs, but
approved architectural decisions win over implementation convenience.

------------------------------------------------------------------------

# PART A --- OWNERSHIP AND MODEL

## 4. Bounded-context ownership --- HARD GATE

The new Seller commercial/service unit is owned by:

`catalog.*`

It must **not** be owned by:

-   CRM;
-   Reverse Marketplace;
-   Sales;
-   Order;
-   Booking;
-   Communication.

No cross-domain writer may be introduced.

If repository reality proves that this cannot be implemented safely
inside Catalog, stop:

`ARCHITECTURE DECISION REQUIRED`

Do not silently create another bounded context.

------------------------------------------------------------------------

## 5. Canonical entity naming

DD-025 approved the semantic concept but intentionally did not freeze a
poor name.

Before implementation inspect existing naming conventions and choose one
canonical code/entity name equivalent to:

-   `ServiceUnit`, or
-   `SellerCommercialUnit`.

Choose **one**, not both.

The name must remain cross-category and must not be hotel-specific
(`Room`, `RoomType`, etc. are forbidden as the global entity name).

Document the final choice.

------------------------------------------------------------------------

## 6. Business identity

The entity requires:

-   UUID/internal DB identity according to repository convention;
-   canonical business code generated server-side through existing
    `IdsService` / `BusinessSequence`;
-   no client authority over code;
-   no random collision-retry strategy where atomic sequence convention
    exists.

Register exactly one new prefix in `docs/contracts/ids.md`.

Select the prefix from existing naming conventions and prove it does not
collide.

Do not invent multiple identifiers for the same business object.

------------------------------------------------------------------------

## 7. Core relationships

The entity must belong to the minimum authoritative Catalog graph.

Expected conceptual relationships:

-   Seller/Partner ownership --- according to existing Product ownership
    conventions;
-   Product → 0..N service units;
-   Category / CategorySchema context inherited or referenced in a way
    that permits deterministic validation;
-   schema version used for normalized attributes;
-   future Tariff → service unit relationship must be possible without
    redesign.

Do not yet migrate Tariff to the unit if Step 1.8B is the approved place
for that relationship, unless the Roadmap explicitly requires the
minimal FK foundation in 1.8A.

If a future FK is needed but not yet semantically active, prefer
additive schema that does not change existing Tariff behavior.

------------------------------------------------------------------------

## 8. Product vs Service Unit

Hard invariant:

`Product ≠ Service Unit`

Product is the seller's marketplace/catalog offering container.

Service Unit is a seller-defined bookable/commercial structural variant
within that Product.

Examples:

Hotel: - Product: `Grand Caspian Hotel` - Units: `Standard Double`,
`Premium Double Ocean Side`, `Family Suite`

Transfer: - Product: `Baku Airport Transfer` - Units: `Sedan`,
`Minivan`, `Business Van`

Do not clone Product into a second Product-like aggregate.

Define exactly which fields remain Product-level and which are
unit-level.

------------------------------------------------------------------------

## 9. CategorySchema role

Hard invariant:

> Template defines structure; Seller provides values.

`CategorySchema` remains platform-owned template/schema authority.

The Seller must not mutate CategorySchema definitions while creating a
unit.

The unit stores Seller-provided values validated against the relevant
active schema/template.

Do not convert CategorySchema itself into Seller data.

------------------------------------------------------------------------

# PART B --- SELLER NAME AND NORMALIZED ATTRIBUTES

## 10. Seller-defined name

The Seller-defined unit name must:

-   be required where business semantics require it;
-   be stored exactly as the Seller supplied it, subject only to safe
    text normalization that does not alter commercial wording;
-   not be automatically replaced by TravelHub taxonomy;
-   not be translated into a canonical name;
-   remain independently editable according to lifecycle rules.

Examples that must remain valid as original names:

-   `Deluxe Room Sea View`
-   `Premium Double Ocean Side`
-   `Superior Sea Facing Room`

TravelHub may normalize their **attributes**, not rename them.

------------------------------------------------------------------------

## 11. Normalized attributes

The unit must support normalized structured values according to
CategorySchema.

Examples:

Hotel: - occupancy; - bed type; - view; - size; - amenities.

Transfer: - vehicle class; - passenger capacity; - luggage capacity.

Tour: - package/service class; - capacity; - inclusion flags.

Do not hardcode a global Hotel attribute table.

Use the approved schema-driven approach.

------------------------------------------------------------------------

## 12. Original vs normalized value

Where an attribute has Seller wording plus canonical taxonomy, preserve
the distinction:

-   source/original value;
-   normalized canonical value/ref.

Do not overwrite Seller input with normalized taxonomy.

Do not create duplicate taxonomy ownership in this step.

DD-028 says normalized taxonomy remains Catalog-owned.

------------------------------------------------------------------------

## 13. Schema version

A unit must retain enough information to know which CategorySchema
version validated its attributes.

Required behavior:

-   future CategorySchema updates do not silently reinterpret historical
    unit data;
-   existing published units remain readable;
-   validation of new edits follows explicit compatibility/version
    rules;
-   no destructive rewrite of old unit attributes merely because schema
    changed.

Reuse existing Product/CategorySchema versioning conventions where
possible.

------------------------------------------------------------------------

# PART C --- LIFECYCLE / MODERATION

## 14. Lifecycle

Use the repository's existing Catalog lifecycle/moderation conventions
rather than inventing a parallel workflow.

The decision gate expects semantics equivalent to:

`DRAFT → PUBLISHED`

with moderation aligned to existing Product publication rules.

Inspect actual statuses before freezing implementation.

Do not create a second moderation engine.

------------------------------------------------------------------------

## 15. Publication dependency

Determine and enforce:

-   whether a unit may be published only when parent Product is
    eligible/published;
-   what happens when Product is unpublished/suspended;
-   whether unit visibility follows Product visibility;
-   whether draft units remain private to Seller/staff.

Use existing Catalog publication authority.

Do not allow a unit to make an otherwise unpublished Product publicly
bookable.

------------------------------------------------------------------------

## 16. Mutability

Define safe edit semantics.

At minimum:

-   Seller name may be changed through owner-scoped update;
-   attributes may be updated with validation;
-   immutable ownership IDs cannot be reassigned;
-   Product ID cannot be mass-assigned on update;
-   Category/schema authority cannot be forged;
-   business code cannot be changed;
-   import identity cannot be hijacked.

If published-unit changes require moderation according to existing
Product convention, enforce it.

------------------------------------------------------------------------

# PART D --- IMPORT / RECONCILIATION FOUNDATION

## 17. Import identity

DD-025 approved future import reconciliation using semantics equivalent
to:

`(source, externalKey)`

Implement only the **identity foundation** needed to avoid duplicate
units during future imports.

Do not implement CSV/XLS/API/channel-manager import itself.

Requirements:

-   source is server/trusted integration context, not arbitrary public
    client authority where unsafe;
-   external key is scoped so two Sellers cannot collide;
-   uniqueness reflects the real ownership scope;
-   manual units may legitimately have no external key;
-   no fabricated external key for manual records.

Review whether uniqueness must include Seller/Partner, Product, source,
externalKey.

Choose the smallest correct scope.

------------------------------------------------------------------------

## 18. Import source semantics

Do not conflate:

-   commercial pricing source;
-   service-unit import source;
-   acquisition source.

These are separate concepts.

If a new enum is premature because integrations are not implemented, use
a minimal future-safe representation consistent with project
conventions.

Do not import Universal Pricing source enums into 1.8A.

------------------------------------------------------------------------

# PART E --- API / RBAC / SECURITY

## 19. API surface

Add only the minimum Catalog/Partner API needed for Service Unit
management according to existing API style.

Expected capabilities:

-   create unit under own Product;
-   list units for own Product;
-   get unit;
-   update unit;
-   lifecycle/publish action only if Step 1.8A Roadmap explicitly
    requires it.

Avoid generic unrestricted CRUD.

Do not add pricing/availability endpoints here.

------------------------------------------------------------------------

## 20. Seller own-scope

Seller may create/manage units only under Products they own/control
according to existing Partner/Product ownership rules.

Prove:

-   Seller A cannot create unit under Seller B Product;
-   Seller A cannot read private draft unit of Seller B through guessed
    ID/code;
-   Seller A cannot update/publish Seller B unit;
-   neutral IDOR semantics follow existing project conventions.

------------------------------------------------------------------------

## 21. Buyer/public scope

Do not expose draft/private units publicly.

If public read is required by current Catalog architecture:

-   only eligible published units;
-   only under eligible Product;
-   only safe commercial fields;
-   no internal Partner IDs;
-   no import metadata;
-   no moderation internals.

Frontend changes are not required in this step.

------------------------------------------------------------------------

## 22. RBAC

Reuse/extend Catalog permissions coherently.

Do not create redundant permissions if existing `catalog.product.*`
scope cleanly covers child-unit management.

If a distinct permission is necessary, document why.

ADMIN/staff semantics must follow current Catalog conventions.

------------------------------------------------------------------------

## 23. Mass assignment

Explicitly protect server-owned fields.

Client must not control fields equivalent to:

-   id;
-   code;
-   sellerId/partnerId;
-   ownerId;
-   categoryId where derived from Product;
-   schemaVersion/schemaId where server-derived;
-   status/publication state outside lifecycle command;
-   moderation fields;
-   source/import authority;
-   external ownership scope;
-   createdAt/updatedAt;
-   audit actor;
-   pricing;
-   availability;
-   tariff ownership.

Use strict DTO/whitelist/forbidden-key conventions already used in
TravelHub.

------------------------------------------------------------------------

## 24. Validation

Validate:

-   business IDs;
-   unit name length/content;
-   structured attributes;
-   CategorySchema compatibility;
-   Product/category compatibility;
-   import external key length/format;
-   JSON shape/depth/size according to existing security conventions;
-   no prototype-pollution/object-injection path;
-   no arbitrary unbounded JSON.

Do not create category-specific hardcoded validators where
CategorySchema should be authoritative.

------------------------------------------------------------------------

# PART F --- TARIFF / PRICING / AVAILABILITY BOUNDARIES

## 25. Tariff boundary

DD-024 is decided:

> Existing Tariff is the canonical Rate Plan foundation.

But Rate Plan extension belongs to **Step 1.8B**.

Therefore Step 1.8A must not yet implement:

-   meal plan;
-   refundability;
-   cancellation policy;
-   price basis;
-   occupancy/PAX pricing;
-   CommercialPeriod;
-   pricing precedence.

Only add structural compatibility needed so 1.8B can attach Tariff to
Service Unit without redesign.

Document exactly what was deferred.

------------------------------------------------------------------------

## 26. Universal Pricing boundary

Do **not** implement:

-   fixed/period pricing model;
-   annual/seasonal price calendar;
-   date overrides;
-   day-of-week pricing;
-   occupancy/PAX pricing;
-   duration/tier pricing;
-   PRICE_ON_REQUEST;
-   pricing source/rule;
-   CommercialPeriod.

These belong to the separately prepared Universal Pricing amendment and
1.8B/1.8C.

However, do not design 1.8A in a way that prevents them.

------------------------------------------------------------------------

## 27. Availability boundary

Do not implement multi-date availability in 1.8A.

Existing Step 2.4 hold engine remains canonical.

Do not:

-   create second availability table solely for units unless Roadmap
    explicitly requires the structural FK;
-   create second reservation engine;
-   change OrderRequested reservation cardinality;
-   implement multi-night holds.

Those belong to 1.8C.

------------------------------------------------------------------------

# PART G --- CROSS-CATEGORY VALIDATION

## 28. Hotel scenario

Prove model supports:

Product: `Grand Caspian Hotel`

Units: - `Standard Double` - `Premium Double Ocean Side` -
`Family Suite`

without requiring global entity names `Room` or `RoomType`.

------------------------------------------------------------------------

## 29. Tour scenario

Prove one Tour Product may expose Seller-defined structural
variants/packages without hotel-specific assumptions.

------------------------------------------------------------------------

## 30. Transfer scenario

Prove one Transfer Product may expose:

-   Sedan
-   Minivan
-   Business Van

as units, while future Tariffs/pricing remain separate.

------------------------------------------------------------------------

## 31. Excursion scenario

Prove activity/ticket/service variants fit without introducing pricing
in the unit.

------------------------------------------------------------------------

## 32. Car rental scenario

Prove vehicle class/service variants fit and future per-day/seasonal
pricing can attach through Tariff/CommercialPeriod rather than being
embedded into the unit.

A model that works only for hotels fails Step 1.8A.

------------------------------------------------------------------------

# PART H --- DATA / MIGRATION

## 33. Migration

Migration must be:

-   additive;
-   legacy-safe;
-   replayable from clean DB;
-   no destructive Product rewrite;
-   no fabricated backfill;
-   no mandatory creation of units for existing Products unless Roadmap
    explicitly requires it;
-   no `db push`;
-   drift 0.

Legacy Product without units must remain valid unless canonical Roadmap
explicitly changes that invariant.

------------------------------------------------------------------------

## 34. Constraints and indexes

At minimum review:

-   unique business code;
-   parent Product lookup;
-   owner scope;
-   lifecycle/status filtering;
-   import reconciliation uniqueness;
-   deterministic list pagination.

Do not add redundant indexes without query justification.

------------------------------------------------------------------------

## 35. Delete behavior

Avoid destructive cascades that can erase commercial/history facts
unexpectedly.

Inspect existing Product deletion semantics.

Prefer the same soft-delete/archive/deprecation convention where
applicable.

Do not invent hard-delete behavior that will conflict with future
Tariff/Quote history.

------------------------------------------------------------------------

# PART I --- AUDIT / EVENTS / HISTORY

## 36. Audit/history

Follow existing Catalog conventions.

At minimum review whether the following require audit/history:

-   unit created;
-   unit updated;
-   unit published/unpublished if lifecycle exists;
-   import identity reconciled.

Do not store unnecessary PII.

Do not dump entire arbitrary attribute payload into security audit if
project conventions avoid it.

------------------------------------------------------------------------

## 37. Events/outbox

Do not invent domain events without an actual canonical need/consumer.

If existing Product publication architecture requires Catalog events for
public projections, reuse that pattern.

No speculative `ServiceUnitCreated` event merely for symmetry.

Document event decision.

------------------------------------------------------------------------

# PART J --- TESTS

## 38. Unit tests

Add targeted unit tests for:

-   validation;
-   seller name preservation;
-   normalized attribute validation;
-   schema version handling;
-   forbidden keys;
-   import identity validation.

Use repository conventions.

------------------------------------------------------------------------

## 39. E2E mandatory scenarios

Create a dedicated Step 1.8A E2E suite covering at minimum:

1.  Seller creates a unit under own Product.
2.  Seller-defined name is persisted verbatim.
3.  Normalized attributes persist separately from original/source values
    where applicable.
4.  Business code is server-generated.
5.  Client cannot forge code/owner/schema/status.
6.  Seller cannot create under another Seller Product.
7.  Cross-Seller read/update is denied neutrally.
8.  Invalid CategorySchema attributes are rejected.
9.  Schema-version reference is persisted correctly.
10. Multiple units under one Product are allowed.
11. Same Seller may use similar names; name is not global identity.
12. Import identity deduplicates/reconciles according to chosen
    uniqueness semantics.
13. Manual unit can exist without externalKey.
14. Legacy Product with zero units remains valid.
15. Unit creation creates no Tariff pricing periods.
16. Unit creation creates no Availability/Reservation.
17. Unit creation creates no Quote/Checkout/Sale/Order/Booking.
18. Reverse Marketplace data is not mutated.
19. Public/private visibility follows Catalog lifecycle.
20. Concurrency on import identity cannot create duplicates.
21. Pagination/order is deterministic.
22. Cross-category fixtures prove at least Hotel + Transfer + Tour
    semantics.

Add more tests where implementation introduces meaningful state
transitions.

------------------------------------------------------------------------

## 40. Regression

Run exact final counts.

### Backend

-   `tsc --noEmit`
-   unit
-   Step 1.8A targeted E2E
-   existing Catalog/Product/CategorySchema tests
-   Tariff tests
-   Availability / Step 2.4 tests
-   Quote/Checkout tests
-   Reverse 2.2A--2.2F tests
-   Step 2.5/2.5A/2.5B
-   RBAC/security
-   full serial E2E

### Frontend

Even though no UI is expected:

-   tsc
-   vitest
-   production build

### DB

-   migration status
-   clean replay
-   drift 0

Report exact counts.

------------------------------------------------------------------------

## 41. Runtime verification

Use the real AppModule/E2E runtime.

Demonstrate:

`Seller → own Product → create Service Unit → read/update → lifecycle visibility`

and at least one non-hotel category.

Verify no pricing/availability/downstream side effects.

------------------------------------------------------------------------

# PART K --- DOCUMENTATION / ROADMAP

## 42. Architecture document

Create/update a canonical architecture document for Step 1.8A covering:

-   final entity name;
-   ownership;
-   Product relationship;
-   CategorySchema relationship;
-   Seller-name invariant;
-   normalized attributes;
-   schema version;
-   lifecycle;
-   import identity;
-   security/RBAC;
-   future Tariff relationship;
-   explicit pricing/availability boundaries.

------------------------------------------------------------------------

## 43. Contracts

Update only if actually changed:

-   `docs/contracts/ids.md`
-   `docs/contracts/api.md`
-   events contract if a real event is introduced

Do not document endpoints/events that do not exist.

------------------------------------------------------------------------

## 44. Roadmap

On implementation completion:

-   mark Step 1.8A as
    `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`;
-   active item becomes `Step 1.8A STRICT REVIEW`;
-   do not mark 1.8A DONE before review;
-   do not start 1.8B;
-   preserve the note that the pre-prepared Universal Pricing Model
    Amendment is a separate pass before 1.8B/1.8C according to the
    synchronized execution sequence.

------------------------------------------------------------------------

# PART L --- STOP CONDITIONS

## 45. Architecture decision required

Stop with:

`ARCHITECTURE DECISION REQUIRED`

if implementation proves any of:

-   a Service Unit cannot remain inside Catalog ownership;
-   Product vs Service Unit semantics cannot be separated safely;
-   CategorySchema cannot authoritatively validate unit attributes
    without redesigning template ownership;
-   a new cross-domain writer is required;
-   Step 1.8A requires implementing a second pricing or availability
    authority;
-   legacy Product compatibility would require destructive migration.

Explain the exact decision required.

------------------------------------------------------------------------

## 46. Out of scope

Do not implement:

-   Step 1.8A STRICT REVIEW;
-   Universal Pricing amendment execution;
-   Step 1.8B;
-   Step 1.8C;
-   Step 1.8D;
-   CommercialPeriod;
-   annual pricing calendar;
-   period pricing;
-   occupancy/PAX pricing;
-   Rate Plan commercial extensions;
-   multi-date holds;
-   Step 2.8A time-slot model;
-   Partner Cabinet UI;
-   Marketplace UI;
-   CSV/XLS import engine;
-   supplier/channel-manager API;
-   FX;
-   dynamic/AI pricing;
-   contact disclosure;
-   Step 2.6.

------------------------------------------------------------------------

## 47. Required final report

# PHASE 1 --- STEP 1.8A --- SERVICE TEMPLATE / SELLER COMMERCIAL STRUCTURE FOUNDATION --- ОТЧЁТ

1.  Verdict\
2.  Repository baseline\
3.  Sources inspected\
4.  Final entity name\
5.  Catalog ownership\
6.  Product vs Service Unit semantics\
7.  CategorySchema/template authority\
8.  Business ID strategy\
9.  Core schema / relationships\
10. Seller-defined name invariant\
11. Normalized attributes\
12. Original vs normalized values\
13. Schema version semantics\
14. Lifecycle / moderation\
15. Publication dependency\
16. Mutability rules\
17. Import identity / reconciliation foundation\
18. API surface\
19. Seller own-scope / IDOR\
20. Buyer/public scope\
21. RBAC\
22. Mass assignment\
23. Validation/security\
24. Tariff/Rate Plan compatibility\
25. Universal Pricing boundary\
26. Availability/hold boundary\
27. Hotel validation\
28. Tour validation\
29. Transfer validation\
30. Excursion validation\
31. Car rental validation\
32. Migration\
33. Constraints/indexes\
34. Delete/archive semantics\
35. Audit/history\
36. Events/outbox\
37. Targeted tests\
38. Full regression\
39. Runtime verification\
40. Issues found/fixed\
41. Documentation changes\
42. Roadmap update\
43. Architecture decision status\
44. Out-of-scope confirmation\
45. Exact files changed\
46. Exact NEXT item

Final verdict must be exactly one of:

`PHASE 1 STEP 1.8A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

or

`ARCHITECTURE DECISION REQUIRED`

------------------------------------------------------------------------

## 48. STOP

After Step 1.8A implementation:

**STOP.**

Do not perform STRICT REVIEW in the same pass.

Do not execute the Universal Pricing amendment or Step 1.8B.

The final report must identify the exact NEXT item from the synchronized
canonical Roadmap.
