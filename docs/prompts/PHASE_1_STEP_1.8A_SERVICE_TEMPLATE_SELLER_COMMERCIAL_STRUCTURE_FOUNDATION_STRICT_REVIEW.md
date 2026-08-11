# PHASE 1 — STEP 1.8A — SERVICE TEMPLATE / SELLER COMMERCIAL STRUCTURE FOUNDATION — STRICT REVIEW

**Project:** TravelHub  
**Phase:** 1  
**Step:** 1.8A  
**Mode:** STRICT REVIEW / REVIEW FIXES ONLY  
**Entering status:** `PHASE 1 STEP 1.8A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`  
**Canonical entity:** `ServiceUnit` (`catalog.*`, business code `UNI-*`)  
**Next only if APPROVED:** Universal Pricing Model Amendment pass, then Step 1.8B

---

## 1. Mission

Perform an adversarial STRICT REVIEW of the actual Step 1.8A implementation.

Do not approve from the implementation report alone.

Verify from repository truth that TravelHub now has a correct, cross-category, Catalog-owned Seller Commercial/Service Unit foundation that:

- remains distinct from Product;
- preserves Seller-defined names verbatim;
- uses CategorySchema as template authority;
- stores normalized attributes without replacing Seller wording;
- is legacy-safe;
- supports future Tariff/Rate Plan attachment;
- supports future import reconciliation;
- creates no pricing/availability authority;
- creates no second moderation/catalog pipeline;
- creates no Reverse/Sales/Order side effects.

Final verdict must be one of:

- `PHASE 1 STEP 1.8A STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 1 STEP 1.8A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 1 STEP 1.8A STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `ARCHITECTURE DECISION REQUIRED`

---

## 2. Execution-sequence gate

Current sequence:

`1.8A implementation → 1.8A STRICT REVIEW → Universal Pricing Model Amendment → amendment STRICT REVIEW → 1.8B`

During this pass:

- DO NOT execute Universal Pricing Model Amendment;
- DO NOT start 1.8B;
- DO NOT implement pricing;
- DO NOT implement CommercialPeriod;
- DO NOT implement period/annual calendar pricing;
- DO NOT implement multi-date availability;
- DO NOT implement Partner Cabinet UI;
- DO NOT start Step 2.6.

If 1.8A passes:
- mark 1.8A APPROVED/DONE according to canonical status semantics;
- set exact NEXT to the Universal Pricing Model Amendment pass;
- STOP.

---

## 3. Baseline

Inspect:

- branch / HEAD;
- `git status`;
- tracked/untracked files;
- migration count;
- migration status;
- drift;
- current Roadmap active item;
- DD-025 state;
- whether 1.8A implementation is committed.

Separate:
1. pre-existing unrelated files;
2. Step 1.8A implementation;
3. review fixes in this pass.

Do not reset/delete unrelated user work.

---

## 4. Canonical sources

Inspect latest:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- `CURRENT CANONICAL EXECUTION SEQUENCE`;
- `TRAVELHUB_DEFERRED_DECISIONS_MAP.md`;
- DD-025;
- `docs/architecture/service-templates-decision-gates.md`;
- Step 1.8A architecture doc;
- ADR-0001;
- ADR-0005 where public Seller identity matters;
- Category;
- CategorySchema;
- Product;
- ServiceUnit;
- Tariff;
- Availability;
- AvailabilityReservation;
- Catalog moderation/publication code;
- Partner/Product ownership logic;
- IdsService / BusinessSequence;
- permissions/RBAC;
- field validation;
- API/ID contracts;
- Step 1.8A unit/E2E tests.

Roadmap and accepted DD decisions are authoritative.

---

# PART A — OWNERSHIP / DOMAIN MODEL

## 5. Catalog ownership — HARD GATE

Verify:

`ServiceUnit → catalog.*`

No writes into:
- Reverse;
- CRM;
- Sales;
- Communication;
- Order;
- Booking.

ServiceUnit must not introduce a new bounded context.

Cross-context Partner identity reads must follow ADR-0001 conventions.

---

## 6. Final entity name

Implementation chose:

`ServiceUnit`

Review whether this name is genuinely cross-category and does not encode Hotel-only semantics.

PASS only if examples such as Hotel room variant, Tour package variant, Transfer vehicle/service variant, Excursion ticket/service variant, Car Rental class all fit naturally.

Do not add a parallel `SellerCommercialUnit` entity.

---

## 7. Product ≠ ServiceUnit

Hard invariant.

Verify Product remains the marketplace/catalog offering container and ServiceUnit is a structural/bookable commercial variant under Product.

Check for duplicated Product fields.

ServiceUnit must not become a second Product aggregate containing:
- publication channels;
- full Product merchandising;
- Product pricing authority;
- Product inventory authority.

Document exact parent/child semantics.

---

## 8. CategorySchema authority

Verify:

- CategorySchema remains platform-owned;
- Seller cannot alter schema definitions through ServiceUnit API;
- unit attributes validate against authoritative schema;
- schema refs/version are server-derived where appropriate;
- no Seller-defined arbitrary schema injection.

---

# PART B — SELLER NAME / ATTRIBUTES

## 9. Seller-defined name invariant — HARD GATE

Reported behavior:

> Seller name is preserved verbatim, only trimmed.

Verify actual implementation.

Test names such as:

- `Premium Double Ocean Side`
- `premium DOUBLE Ocean Side`
- `Superior Sea Facing Room`
- names with repeated internal spaces if policy allows
- Unicode Seller names

Ensure:
- case is not changed;
- words are not reordered;
- seller wording is not replaced by taxonomy;
- automatic translation does not occur;
- title is not normalized into canonical enum.

If trimming is performed, document exactly what “verbatim” means.

---

## 10. Original vs normalized values

Verify original Seller wording and normalized structured attributes remain conceptually distinct.

Do not overwrite source/original attribute text with normalized taxonomy values unless the schema itself defines only normalized typed values.

If implementation stores only normalized values and loses Seller original wording where original is materially needed, flag it.

---

## 11. Normalized attributes

Verify the implementation is schema-driven, not hotel-hardcoded.

Inspect validation logic and fixtures.

Must support at least:
- Hotel;
- Transfer;
- Tour.

Review whether model can extend to:
- Excursion;
- Car Rental

without schema changes to ServiceUnit.

---

## 12. JSON safety

If attributes are JSON/JSONB:

Review:
- size limits;
- nesting depth;
- key validation;
- prototype-pollution/dangerous keys;
- unexpected object types;
- arrays;
- null semantics;
- unknown attributes;
- schema-required fields.

Do not accept arbitrary unbounded JSON solely because CategorySchema exists.

---

# PART C — SCHEMA VERSION

## 13. Schema-version semantics — CRITICAL

The implementation report claims unit attributes are validated against the Product's CategorySchema snapshot and historical data is not reinterpreted after schema changes.

Verify actual persistence.

Questions:

1. Does ServiceUnit store the schema version/ref used at validation?
2. Is it immutable or intentionally updateable?
3. If Product schema version changes, does an existing ServiceUnit retain old validated semantics?
4. On unit update, which schema version is used?
5. Can an old unit be edited without silently migrating attributes?
6. Is explicit migration/version upgrade required?

Do not accept only a runtime lookup of the current schema if that would reinterpret historical units.

---

## 14. Product schema snapshot relationship

Verify Product and ServiceUnit schema refs cannot drift inconsistently.

If ServiceUnit inherits Product schema version, prove:
- creation uses Product snapshot;
- updates remain consistent;
- Product category/schema cannot be changed in a way that invalidates child units silently.

If Product category is immutable after publication, confirm existing safeguards.

---

# PART D — LIFECYCLE / PUBLICATION

## 15. ServiceUnitStatus

Reported enum:

- DRAFT
- PUBLISHED
- ARCHIVED

Verify this matches Catalog conventions and does not create a parallel moderation lifecycle.

Review:
- allowed transitions;
- invalid transitions;
- repeat publish/archive semantics;
- archived mutability;
- resurrection behavior;
- timestamps/history.

---

## 16. Publish gate

Reported:

> parent Product must be PUBLISHED.

Verify:
- authoritative Product status re-read at mutation time;
- product owner matches unit owner;
- concurrent Product unpublish/archive vs unit publish is safe;
- no published child beneath non-public parent after race.

If Product lifecycle changes after Unit publication, determine visibility behavior.

---

## 17. Parent Product unpublish/archive

Critical review.

If a Product becomes:
- DRAFT/unpublished;
- SUSPENDED;
- ARCHIVED;
- deleted/soft-deleted

after ServiceUnit is PUBLISHED:

- does public visibility of unit automatically disappear through query scoping?
- does unit remain historical PUBLISHED but effectively not public?
- is this documented?

Do not require cascading status rewrite if query authority already derives parent visibility, but public leakage must be impossible.

---

## 18. Archive semantics

Reported archive is soft.

Verify:
- no hard deletion;
- archived unit not publicly visible;
- Seller cannot accidentally mutate archived commercial identity;
- history preserved;
- future Tariff/Quote references will remain resolvable.

---

# PART E — OWNERSHIP / IDOR

## 19. Partner ownership

Verify ServiceUnit.partnerId is server-derived from Product and immutable.

No client authority.

Seller A cannot:
- create under Seller B Product;
- list draft units of B;
- get B unit;
- update B unit;
- publish/archive B unit;
- access history.

Neutral IDOR semantics must match project conventions.

---

## 20. `productId` IDOR

Implementation report says this was a code-review fix.

Inspect the exact fix.

Verify all endpoints correctly validate:
- route product;
- unit's actual product;
- partner ownership.

No endpoint should fetch Product by ID then operate on unrelated unit ID.

---

## 21. Staff / ADMIN / MODERATOR semantics

Reported MODERATOR → 403.

Review current Catalog permission model.

Determine whether:
- ADMIN global access is intended;
- staff `product.write` access is intended;
- MODERATOR should truly be denied from unit mutation;
- publish permission matches existing Product moderation authority.

Do not change merely for aesthetic symmetry.

Document actual canonical semantics.

---

# PART F — IMPORT IDENTITY

## 22. Import identity foundation

Reported:

- `source`
- `externalKey`
- only staff/ADMIN trusted provisioning
- PARTNER cannot set
- immutable after create
- unique `(partnerId, productId, source, externalKey)`
- externalKey without source rejected.

Review whether this uniqueness scope is correct.

Question:

If one external supplier assigns a stable unit key across Product re-import/reconciliation, including `productId` in the unique key may allow duplicate logical units when Product association changes.

Determine actual intended import semantics.

Do not redesign without evidence, but verify the chosen scope matches DD-025.

---

## 23. NULL-in-unique semantics

Report says manual units intentionally have NULL import fields.

Verify PostgreSQL unique behavior means multiple manual rows with NULL are valid.

Ensure application does not falsely claim manual duplicate prevention via this index.

This design is acceptable only if documented honestly.

---

## 24. Trusted source authority

Verify PARTNER cannot forge:
- source;
- externalKey;
- integration identity.

Review staff/ADMIN API path.

If generic create endpoint accepts these fields conditionally based on actor, ensure permission checks happen before persistence and cannot be bypassed through DTO shape.

---

## 25. Import identity immutability

Verify update APIs reject:
- source;
- externalKey;
- external owner scope.

No reassignment/hijacking.

If import reconciliation is not implemented yet, document that identity foundation exists without import engine.

---

# PART G — ID STRATEGY

## 26. UNI-* contract

Verify:
- `UNI-*` registered once in `docs/contracts/ids.md`;
- atomic IdsService/BusinessSequence;
- DB unique;
- no client authority;
- no collision-retry loop;
- format consistent with project conventions.

No other ServiceUnit prefix should exist.

---

# PART H — TARIFF / PRICING / AVAILABILITY BOUNDARY

## 27. No pricing implementation

Hard out-of-scope proof.

ServiceUnit must contain no:
- price;
- currency;
- CommercialPeriod;
- priceBasis;
- period rules;
- date override;
- day-of-week pricing;
- occupancy price matrix;
- annual pricing calendar.

Search schema/service/API.

Any such implementation is premature.

---

## 28. Tariff compatibility

DD-024 says existing Tariff is the future Rate Plan foundation.

Review whether 1.8A creates enough structural compatibility for 1.8B.

Determine:
- whether Tariff currently remains Product-scoped;
- whether future attachment to ServiceUnit is feasible;
- whether a nullable `serviceUnitId` foundation was added or deliberately deferred.

Either can be acceptable if Roadmap says 1.8B owns the relationship.

Do not force 1.8B implementation into review.

---

## 29. No availability authority

ServiceUnit must not create a second Availability/Reservation engine.

Verify:
- no new inventory fields;
- no unit-level slots hidden in JSON;
- no Reservation rows on create/publish;
- no Step 2.4 behavior altered.

Structural compatibility for future 1.8C may be documented only.

---

# PART I — DELETE / CASCADE RISK

## 30. `Product → ServiceUnit onDelete: Cascade` — CRITICAL REVIEW

The implementation report explicitly says:

> ServiceUnit belongs to Product (`onDelete: Cascade`)

This requires strict review.

Potential future problem:

- ServiceUnit will later be referenced by Tariff;
- Tariff/Quote/Order snapshots may depend on historical ServiceUnit identity;
- deleting Product could cascade-delete ServiceUnit and ServiceUnitHistory.

Inspect current Product deletion semantics.

Determine:

1. Is Product ever physically deleted in production domain flow?
2. Is Product delete already forbidden once commercial history exists?
3. Is `onDelete: Cascade` only cleanup for truly transient/unpublished Products?
4. Does ServiceUnitHistory also cascade?
5. Could future published/commercial units be erased?

If cascade can destroy canonical commercial/history facts, this is a review defect.

Prefer repository-standard soft archive/restrict semantics where required.

Do not defer a known destructive referential-integrity flaw simply because Tariff attachment is future work.

---

## 31. ServiceUnitHistory deletion

Review whether history survives unit deletion.

If history cascades on hard delete, determine whether hard delete is truly impossible for published units.

Audit/history must not be destructively erasable through normal Seller actions.

---

# PART J — API / MASS ASSIGNMENT / VALIDATION

## 32. API contract

Review all reported endpoints:

- POST `/products/:productId/service-units`
- GET list
- GET unit
- GET history
- PATCH unit
- publish
- archive

Verify:
- documented in `docs/contracts/api.md`;
- pagination;
- deterministic ordering;
- status codes;
- permissions;
- own-scope;
- no pricing fields.

---

## 33. Forbidden keys

Implementation report mentions single-source forbidden-key fix.

Inspect create/update/lifecycle validation.

Attempt forged:
- id;
- code;
- partnerId;
- ownerId;
- productId on update;
- categoryId;
- schemaId/schemaVersion;
- status;
- createdAt/updatedAt;
- source/externalKey from PARTNER;
- price;
- currency;
- tariffId;
- availability;
- moderation fields;
- audit fields.

Ensure unknown server-owned fields fail loudly according to project convention.

---

## 34. Update semantics

Reported PARTNER may update only own DRAFT.

Verify:
- PUBLISHED update blocked unless canonical staff flow exists;
- ARCHIVED update blocked;
- stale state race safe;
- name/attributes update validation atomic;
- history records actual changed fields;
- no lost update if concurrent PATCH exists.

If existing Catalog uses expectedVersion/CAS, ServiceUnit should follow it. If not, document why.

---

## 35. Concurrency

Test meaningful races:

- two import creates same `(source, externalKey)`;
- two publishes;
- update vs publish;
- Product archived/unpublished vs ServiceUnit publish;
- archive vs update.

No duplicate import identity.
No impossible lifecycle state.
No duplicate history/audit success facts.

---

# PART K — CROSS-CATEGORY MODEL

## 36. Hotel

Verify Product can hold multiple Seller-defined room/service units with different names and attributes without Hotel-specific schema fields on ServiceUnit.

---

## 37. Transfer

Verify:
- Sedan
- Minivan
- Business Van

can be modeled through the same ServiceUnit entity and CategorySchema-driven attributes.

No room-only assumptions.

---

## 38. Tour

Verify package/service variants fit.

No forced room occupancy fields globally.

---

## 39. Excursion / Activity

Even if no E2E fixture exists, inspect model to prove activity/ticket/service variants fit without schema changes to ServiceUnit.

---

## 40. Car Rental

Inspect whether vehicle-class/service variants fit and future per-day pricing can live on Tariff/CommercialPeriod rather than ServiceUnit.

---

# PART L — SIDE-EFFECT ISOLATION

## 41. Reverse isolation

ServiceUnit create/update/publish must not mutate:
- SellerCapability;
- BuyerRequest;
- Distribution;
- Proposal.

Capability ≠ Product/unit/inventory remains invariant.

---

## 42. Sales isolation

No:
- Lead;
- Opportunity;
- Quote;
- Checkout;
- Sale.

---

## 43. Order/Booking isolation

No Order/Booking/Payment side effects.

---

## 44. Events / outbox

Implementation emits no events.

Verify:
- no hidden outbox;
- no public projection consumer requires event now;
- Product publication architecture does not mandate a ServiceUnit event.

No speculative event needed.

---

# PART M — HISTORY / AUDIT

## 45. ServiceUnitHistory

Review:
- created;
- updated;
- published;
- archived

facts as applicable.

Check:
- actor;
- timestamp;
- from/to;
- changed fields;
- no giant attribute dump if policy avoids it;
- failed actions no history;
- duplicate no-op no duplicate fact.

---

## 46. Security audit

Verify SecurityService:
- action naming;
- object refs;
- no raw attribute payload dump;
- no Seller PII;
- success-only semantics.

---

# PART N — MIGRATION / LEGACY

## 47. Migration review

Inspect `20260811190825_add_service_unit`.

Verify:
- additive;
- clean replay;
- drift 0;
- no fabricated ServiceUnits for legacy Products;
- legacy Product with zero units remains valid;
- FK/delete behavior safe;
- indexes/unique constraints correct;
- no `db push`.

---

## 48. Indexes / pagination

Review:
- Product lookup;
- partner scope;
- status;
- UNI code;
- import identity;
- deterministic list order.

Avoid redundant/unjustified indexes.

---

# PART O — TEST QUALITY

## 49. Targeted coverage audit

Implementation reports 23 E2E scenarios and 15 unit tests.

Do not approve by count alone.

At minimum prove:

1. create under own Product;
2. Seller name preservation;
3. case/order not normalized;
4. normalized attrs validated;
5. business code server-generated;
6. forged code/owner/schema/status rejected;
7. cross-Seller create denied;
8. cross-Seller read denied;
9. cross-Seller update denied;
10. invalid schema attrs rejected;
11. schema version persisted;
12. multiple units under Product;
13. same/similar names allowed;
14. manual unit without import identity;
15. trusted import identity;
16. PARTNER cannot forge import identity;
17. concurrent duplicate import → one unit;
18. legacy Product zero units remains valid;
19. publish requires Product PUBLISHED;
20. Product visibility prevents public child leak;
21. archive semantics;
22. no pricing side effects;
23. no Availability/Reservation side effects;
24. no Sales/Order/Booking side effects;
25. no Reverse side effects;
26. Hotel fixture;
27. Transfer fixture;
28. Tour fixture;
29. pagination deterministic;
30. update-vs-publish race;
31. product-state-vs-publish race;
32. cascade/delete safety proof.

Add tests where current suite does not prove a critical invariant.

---

## 50. Shared-DB hygiene

Inspect cleanup for:
- ServiceUnit;
- ServiceUnitHistory;
- AuditLog;
- Products;
- CategorySchemas;
- Partner fixtures.

No global destructive cleanup.
No suite-order dependence.
No absolute counts that break shared DB.

---

# PART P — FULL REGRESSION

## 51. Full regression

After review fixes run exact current counts.

### Backend

- tsc
- unit
- Step 1.8A targeted E2E
- Catalog Product/Category/CategorySchema
- Tariff
- Availability / Step 2.4
- Quote/Checkout
- Reverse 2.2A–2.2F
- Step 2.5 / 2.5A / 2.5B
- RBAC/security
- full serial E2E

### Frontend

- tsc
- vitest
- production build

### DB

- migrate status
- clean replay
- drift

Report exact counts.

---

## 52. Runtime verification

Use real AppModule/E2E runtime.

Prove:

`Seller → own Product → create ServiceUnit → read/update → publish/archive`

and at least one non-Hotel category.

No pricing/availability/downstream side effects.

---

# PART Q — DOCUMENTATION / ROADMAP

## 53. Documentation review

Inspect:
- `docs/architecture/service-unit-foundation.md`
- `docs/contracts/api.md`
- `docs/contracts/ids.md`
- Roadmap v3
- Deferred Decisions Map if factual sync needed

Docs must describe:
- ServiceUnit ownership;
- Product distinction;
- Seller-name invariant;
- normalized attributes;
- schema version;
- lifecycle;
- import identity;
- no pricing/availability yet;
- future Tariff relation.

---

## 54. Roadmap update

If approved:

- mark 1.8A `STRICT REVIEW COMPLETED — APPROVED` or `APPROVED WITH REVIEW FIXES`;
- update `CURRENT CANONICAL EXECUTION SEQUENCE`;
- set the exact NEXT item to the **Universal Pricing Model Amendment pass**;
- do not start the amendment in this review.

Do not jump directly to 1.8B.

---

## 55. Architecture stop conditions

Return `ARCHITECTURE DECISION REQUIRED` if review proves:

- ServiceUnit cannot safely remain Catalog-owned;
- Product vs ServiceUnit cannot be separated;
- CategorySchema cannot validate unit attributes without ownership redesign;
- destructive Product cascade cannot be reconciled with future commercial history within existing architecture;
- 1.8A requires a new pricing/availability authority;
- legacy compatibility requires destructive migration.

Do not use architecture stop for ordinary code bugs.

---

## 56. Allowed review fixes

Allowed:
- ServiceUnit correctness/security/IDOR fixes;
- lifecycle/concurrency fixes;
- cascade/delete safety fixes;
- import uniqueness fixes;
- validation;
- migration/index fixes;
- tests;
- docs/API/ID synchronization;
- Roadmap status update.

Forbidden:
- Universal Pricing amendment execution;
- 1.8B implementation;
- 1.8C;
- CommercialPeriod;
- pricing;
- multi-date holds;
- frontend ServiceUnit UI;
- import engine;
- FX/dynamic pricing.

---

## 57. Required final report

# PHASE 1 — STEP 1.8A — STRICT REVIEW — ОТЧЁТ

1. Verdict  
2. Repository baseline  
3. Sources inspected  
4. Catalog ownership  
5. Final entity name  
6. Product vs ServiceUnit  
7. CategorySchema authority  
8. Seller-defined name invariant  
9. Original vs normalized values  
10. Normalized attributes  
11. JSON safety  
12. Schema-version semantics  
13. Product/schema relationship  
14. Lifecycle  
15. Publish gate  
16. Parent Product visibility behavior  
17. Archive semantics  
18. Partner own-scope / IDOR  
19. productId IDOR review  
20. Staff/ADMIN/MODERATOR semantics  
21. Import identity foundation  
22. Import uniqueness scope  
23. NULL-in-unique semantics  
24. Trusted import authority  
25. Import immutability  
26. UNI-* ID strategy  
27. Tariff compatibility  
28. Pricing boundary  
29. Availability/hold boundary  
30. Product→ServiceUnit cascade review  
31. ServiceUnitHistory delete safety  
32. API contract  
33. Mass assignment  
34. Update semantics  
35. Concurrency  
36. Hotel validation  
37. Transfer validation  
38. Tour validation  
39. Excursion validation  
40. Car Rental validation  
41. Reverse isolation  
42. Sales/Order/Booking isolation  
43. Events/outbox  
44. History/audit  
45. Migration  
46. Indexes/pagination  
47. Targeted coverage audit  
48. Shared-DB hygiene  
49. Full regression  
50. Runtime verification  
51. Issues found/fixed  
52. Documentation review  
53. Roadmap update  
54. Architecture decision status  
55. Out-of-scope confirmation  
56. Exact files changed  
57. **Exact NEXT item**

Final line repeats verdict.

---

## 58. STOP

After STRICT REVIEW:

**STOP.**

If approved, exact NEXT must be the Universal Pricing Model Amendment pass according to synchronized Roadmap.

Do not execute it in the same pass.
