# PHASE 3 — STEP 3.8 — MARKETING DOMAIN
## GAP-FIRST ARCHITECTURE / REPOSITORY AUDIT + IMPLEMENTATION PROMPT

**Project:** TravelHub  
**Canonical source of truth:** `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`  
**Canonical NEXT:** `PHASE 3 — STEP 3.8 — MARKETING DOMAIN`  
**Canonical scope:** Campaign, Audience, Channel, Attribution, Lifecycle  

---

## 0. EXECUTION MODE

This is the next canonical implementation step after **Step 3.7B — Communication Business-Context Integration — CLOSED / STRICT REVIEW APPROVED**.

Execute **gap-first**:

1. inspect the canonical roadmap and repository;
2. establish the actual existing Marketing-related capabilities and authorities;
3. identify reusable foundations and missing domain pieces;
4. define the minimum coherent Step 3.8 boundary;
5. implement only the confirmed gap;
6. prove behavior with tests and runtime evidence;
7. stop at `IMPLEMENTATION COMPLETE — READY FOR STRICT REVIEW`.

Do **not** mark Step 3.8 CLOSED. A separate Strict Review is mandatory.

### Hard rule

Do not create a parallel marketing truth if equivalent canonical concepts already exist elsewhere.

Reuse existing authorities wherever possible.

---

# 1. PRECONDITIONS / REPOSITORY BASELINE

Before modifying anything, record:

```text
git status --short
git rev-parse HEAD
git rev-parse origin/master
```

Confirm:

- Step 3.7B is recorded as CLOSED / STRICT REVIEW APPROVED;
- roadmap declares Step 3.8 as the unique canonical NEXT;
- unrelated dirty working-tree state is identified and left untouched;
- no later implementation Step is started in parallel.

If the canonical roadmap no longer says Step 3.8 is NEXT, **STOP** and report the discrepancy.

---

# 2. CANONICAL STEP 3.8 CONTRACT

The roadmap defines Step 3.8 as:

```text
MARKETING DOMAIN
Campaign
Audience
Channel
Attribution
Lifecycle
```

Treat these as the required domain concerns, but **do not assume** that each requires a new database model.

First determine what the repository already provides.

The implementation must preserve TravelHub's business-context architecture:

```text
IDENTITY
    ↓
WORKSPACE CONTEXT
    ↓
TENANT / PARTNER SCOPE
    ↓
PLAN / ENTITLEMENT
    ↓
BUSINESS CAPABILITY
    ↓
ROLE / PERMISSION
    ↓
AVAILABLE MARKETING ACTION / DATA / UI
```

Hard invariants:

```text
Platform Marketing ≠ Partner Marketing
Marketplace relationship ≠ Storefront direct relationship
Entitlement ≠ Business Capability ≠ Permission
Marketing ≠ Communication transport
Marketing ≠ CRM source of truth
Marketing ≠ Analytics source of truth
```

---

# 3. MANDATORY GAP-FIRST REPOSITORY AUDIT

Before implementation, inspect at minimum:

## 3.1 Schema / persistence

Search Prisma/schema/migrations for concepts resembling:

- Campaign
- MarketingCampaign
- Audience
- Segment
- CustomerSegment
- Channel
- MarketingChannel
- Attribution
- Source / acquisition source
- UTM
- Lead source
- lifecycle stage
- customer lifecycle
- campaign membership
- campaign recipient
- consent / subscription / opt-out
- communication preference
- marketing event
- conversion attribution

Do not infer absence from naming alone. Inspect semantics and relationships.

## 3.2 CRM

Inspect Platform CRM and Partner CRM for:

- customer identity authority;
- PartnerCustomerRelationship;
- lead/source fields;
- lifecycle/state fields;
- segmentation/filtering primitives;
- Basic vs Pro disclosure boundaries;
- customer ownership and tenant isolation;
- activity timeline;
- contact fields and contact-policy enforcement.

Marketing must consume CRM/customer authority; it must not duplicate customer identity.

## 3.3 Communication

Inspect Step 3.7/3.7A/3.7B implementation for:

- canonical `Communication` / CML domain;
- channels/types/statuses;
- sender/recipient authority;
- context links;
- Marketplace anti-disintermediation/contact policy;
- Storefront direct-contact allowance;
- future/unimplemented transports.

Marketing campaigns must **not** introduce a second message-history domain.

If actual outbound email/SMS/push providers are absent, do not fake delivery infrastructure merely to satisfy Marketing.

## 3.4 Sales / Orders / Bookings

Inspect canonical acquisition/source/context data that can support attribution:

- Order source;
- Booking source;
- Partner/source attribution;
- Marketplace vs Storefront origin;
- conversion/business identifiers;
- immutable historical source fields where present.

Do not create marketing-owned copies of Order/Booking truth.

## 3.5 Analytics

Inspect existing Analytics Engine and metrics infrastructure.

Determine whether Marketing should emit/record facts consumed by Analytics rather than creating a second analytics engine.

## 3.6 Storefront / Partner entitlement

Inspect:

- Marketplace Basic;
- Storefront Pro;
- subscription/entitlement resolver;
- Partner Workspace permissions;
- future Marketing menu/feature assumptions;
- Storefront direct-customer relationship rules.

Do not expose full direct marketing capability to Marketplace Basic merely because the Marketing domain exists.

## 3.7 Existing frontend

Search for:

- `/marketing`
- campaign pages/components
- audience/segment UI
- CRM filters usable as audiences
- channel selectors
- attribution widgets
- lifecycle controls
- sidebar entries/manifests

Do not build duplicate UI if an existing shell/page can be extended coherently.

---

# 4. REQUIRED GAP MATRIX BEFORE CODING

Produce a matrix in the implementation report before describing changes:

| Concern | Existing authority | Existing implementation | Gap | Step 3.8 action |
|---|---|---|---|---|
| Campaign | ? | ? | ? | REUSE / EXTEND / CREATE / DEFER |
| Audience | ? | ? | ? | ... |
| Channel | ? | ? | ? | ... |
| Attribution | ? | ? | ? | ... |
| Lifecycle | ? | ? | ? | ... |
| Customer identity | CRM | ? | ? | ... |
| Communication history | Communication/CML | ? | ? | ... |
| Order/Booking conversion | Order/Booking | ? | ? | ... |
| Analytics | Analytics Engine | ? | ? | ... |
| Consent/preferences | ? | ? | ? | ... |
| Partner entitlement | Entitlement authority | ? | ? | ... |

Every new model/table/service must be justified by this matrix.

---

# 5. DOMAIN OWNERSHIP

The intended ownership boundary is:

```text
CRM
→ customer / relationship / lead identity and relationship facts

MARKETING
→ campaign definition
→ audience definition/snapshot or rule reference
→ marketing channel intent
→ campaign lifecycle
→ attribution linkage/policy where genuinely marketing-owned

COMMUNICATION
→ canonical communication/message fact and delivery/history context

ORDER / BOOKING
→ transaction and conversion truth

ANALYTICS
→ aggregation/reporting/metrics

ENTITLEMENT
→ whether workspace may use marketing capability

AUTH/RBAC
→ whether actor may perform specific marketing action
```

Marketing must not take ownership of data belonging to another bounded context.

---

# 6. CAMPAIGN FOUNDATION

If no canonical campaign entity exists and the audit confirms it is required, implement a minimal production-grade Campaign aggregate.

Expected conceptual fields — adapt to existing conventions rather than copying blindly:

```text
id
businessCode / human-readable identifier
workspace/business owner context
partnerId when partner-owned
name
description optional
status
objective/type if justified
startAt optional
endAt optional
createdBy
createdAt
updatedAt
```

Lifecycle must be explicit and controlled.

A reasonable lifecycle may resemble:

```text
DRAFT
SCHEDULED
ACTIVE
PAUSED
COMPLETED
CANCELLED
```

But use only states supported by actual Step 3.8 behavior. Do not add decorative states with no transition contract.

Define allowed transitions server-side.

Invalid transitions must return controlled 4xx, never raw 500.

---

# 7. AUDIENCE / SEGMENT AUTHORITY

An Audience is **not another Customer table**.

Determine whether the correct implementation is:

1. reusable CRM query/filter definition;
2. persisted audience rule definition;
3. immutable recipient snapshot at activation/send time;
4. combination of rule + snapshot.

The report must explicitly explain the chosen model.

Minimum security rules:

- Partner can target only customers/relationships within own tenant scope;
- Platform audiences cannot accidentally expose cross-partner private CRM data;
- Marketplace Basic cannot obtain forbidden direct contact data through audience endpoints;
- Storefront Pro direct-customer capability must remain entitlement-aware;
- audience counts must not become a cross-tenant enumeration oracle.

If actual campaign dispatch is deferred, audience definition can still be implemented without pretending recipients were contacted.

---

# 8. CHANNEL MODEL

Audit existing `Communication` channel/type enums before adding anything.

Marketing channel represents campaign intent/routing, while Communication represents actual communication facts.

Do not create duplicate enums/taxonomies without justification.

Potential channels may include only those already supported or explicitly modeled, e.g.:

```text
IN_APP
EMAIL
SMS
PUSH
```

A channel with no transport provider may be represented as unsupported/deferred configuration, but must not report successful delivery.

No fake provider integration.

No fake sent/delivered/opened metrics.

---

# 9. ATTRIBUTION

Attribution must reuse canonical acquisition/source facts wherever they exist.

Audit at least:

- CRM lead/customer source;
- Order source;
- Booking source;
- Marketplace vs Storefront source;
- existing analytics dimensions;
- UTM/referrer fields if present.

Hard invariant:

```text
Marketing attribution reference ≠ rewriting canonical transaction source
```

If Step 3.8 introduces campaign attribution links, they must be additive and auditable.

Example conceptual relation:

```text
Campaign
   ↓
marketing attribution reference
   ↓
Lead / Customer relationship / Order / Booking
```

Do not mutate historical Order/Booking acquisition source just because a Campaign association changes.

If multi-touch attribution is not specified by the roadmap, do not invent a complex attribution engine. Document it as future work if necessary.

---

# 10. CUSTOMER LIFECYCLE

Audit existing CRM states before creating lifecycle state.

Marketing lifecycle must not conflict with operational Customer/Lead status.

Determine whether lifecycle is:

- a CRM-owned fact consumed by Marketing;
- a Marketing classification derived from CRM/transaction behavior;
- or genuinely missing shared authority requiring explicit architecture.

Possible concepts such as:

```text
LEAD
PROSPECT
FIRST_TIME_CUSTOMER
ACTIVE_CUSTOMER
REPEAT_CUSTOMER
AT_RISK
INACTIVE
```

must **not** be implemented merely because they are common marketing terms.

Only introduce lifecycle states if repository/roadmap semantics justify them and the transition/derivation authority is defined.

Otherwise record the lifecycle gap/defer decision precisely.

---

# 11. MARKETPLACE BASIC VS STOREFRONT PRO

This is a hard security/business boundary.

## Marketplace Basic

Marketplace customer relationship remains TravelHub-mediated.

Step 3.8 must not create a bypass around Step 3.7A contact policy.

Basic must not gain forbidden raw:

- email;
- phone;
- direct URL/contact handle;
- other protected direct-contact data

through:

- Campaign endpoints;
- Audience endpoints;
- recipient previews;
- export endpoints;
- attribution payloads;
- nested relations;
- errors/logs.

## Storefront Pro

Storefront Pro may use direct customer relationships where current entitlement and relationship rules permit them.

Effective tier must be resolved server-side.

Never trust a frontend flag such as:

```text
isPro=true
workspace=storefront
```

as authority.

---

# 12. CONSENT / COMMUNICATION PREFERENCES

Marketing contact authorization is a potential compliance boundary.

Audit whether consent, subscription, opt-out or communication preferences already exist.

If they exist:

- reuse them;
- enforce them server-side where Step 3.8 performs a contact action.

If they do **not** exist and actual outbound marketing cannot be safely implemented without them:

- do not fabricate implicit consent;
- implement only the safe domain foundation supported by current architecture;
- explicitly mark outbound execution as deferred/blocking on consent/preference authority.

Never equate possession of email/phone with permission to market to that customer.

---

# 13. PERMISSIONS / RBAC

Audit existing permission naming conventions.

Use granular permissions consistent with the repository, conceptually such as:

```text
marketing.read
marketing.campaign.create
marketing.campaign.update
marketing.campaign.activate
marketing.audience.read
marketing.audience.manage
marketing.attribution.read
```

Do not invent these exact strings if repository conventions differ.

Requirements:

- server-side authorization;
- Platform and Partner scope separated;
- unauthorized staff controlled 403;
- anonymous controlled 401;
- partner cross-tenant access denied;
- UI hiding alone is insufficient.

---

# 14. API CONTRACT

Implement only endpoints justified by the gap audit.

If Campaign CRUD/lifecycle is created, API behavior must include at minimum:

- list in authorized scope;
- detail in authorized scope;
- create;
- update while lifecycle permits;
- controlled lifecycle transition(s);
- audience association/configuration where implemented;
- no foreign tenant access;
- no forged owner/partner/workspace fields.

Server-owned fields must be derived from authenticated context.

Unknown IDs, invalid state transitions, invalid audience references and foreign resources must produce controlled errors.

No Prisma/raw stack leakage.

---

# 15. HUMAN-READABLE IDENTIFIERS

Follow existing TravelHub conventions.

If Marketing introduces user-visible entities, provide human-readable business identifiers if repository patterns require them.

Do not expose UUIDs as the primary visible Campaign/Audience label in UI or business-context links.

---

# 16. FRONTEND SCOPE

Perform the frontend audit first.

If Step 3.8 roadmap/repository architecture clearly expects Marketing Center UI now, implement only the minimum coherent UI supported by the new backend.

If frontend is not yet justified, a backend/domain foundation is acceptable **only if the report explicitly proves why**.

Do not prematurely implement future Storefront visual-alignment work from Step 3.29N.

Do not redesign the public Storefront.

Do not start future marketing automation merely because Marketing domain now exists.

---

# 17. REQUIRED SECURITY TEST MATRIX

At minimum test relevant implemented endpoints for:

| Actor/context | Own | Foreign | Expected |
|---|---:|---:|---|
| Platform authorized role | YES | according to Platform authority | controlled |
| Platform unauthorized role | — | — | 403 |
| Marketplace Basic Partner | own scope | foreign partner | allow limited / deny |
| Storefront Pro Partner | own scope | foreign partner | allow entitled / deny |
| Anonymous | — | — | 401 |

Also test forged ownership/context fields if create/update accepts body data that could attempt impersonation.

---

# 18. REQUIRED CONTACT-POLICY REGRESSION

Because Marketing is a likely disclosure surface, explicitly prove that Step 3.7A protections remain intact.

For Marketplace Basic, use fixtures containing recognizable:

```text
email
phone
URL
social/contact handle where detector supports it
business codes such as ORD-/CML-/TH-
normal dates and monetary values
```

Verify protected contacts cannot leak through newly introduced Marketing responses while harmless business identifiers remain intact.

Do not weaken or duplicate the canonical sanitizer/contact-policy authority.

---

# 19. REQUIRED ATTRIBUTION TESTS

If attribution is implemented, prove at least:

1. valid own-scope Campaign association;
2. foreign Campaign association denied;
3. foreign Order/Booking/Customer relation denied;
4. nonexistent target controlled 404/422;
5. canonical Order/Booking source is not overwritten unexpectedly;
6. repeated/idempotent association behavior is deterministic;
7. historical association is auditable if updates are allowed.

---

# 20. REQUIRED CAMPAIGN LIFECYCLE TESTS

If Campaign lifecycle is implemented, prove:

- valid transition(s);
- invalid transition → controlled 4xx;
- repeated transition behavior deterministic;
- foreign tenant transition denied;
- unauthorized role denied;
- no partial persistence after rejected transition;
- concurrency behavior reviewed for conflicting transitions.

Where concurrency is meaningful, test competing transitions and ensure state remains valid.

---

# 21. RUNTIME EVIDENCE

Unit tests alone are insufficient for implementation readiness.

Provide actual runtime/API evidence for the implemented surface.

At minimum, where applicable:

```text
1. create Campaign in authorized scope
2. read/list own Campaign
3. foreign Partner access denied
4. unauthorized staff denied
5. anonymous denied
6. valid lifecycle transition
7. invalid lifecycle transition
8. audience own-scope behavior
9. audience foreign-scope denial
10. Marketplace Basic contact-policy protection
11. Storefront Pro entitlement behavior
12. attribution relation behavior
13. invalid/foreign context behavior
14. DB persistence verification for accepted writes
15. DB zero-persistence verification for rejected writes
```

Record exact HTTP status and relevant response fields.

Do not claim a runtime gate based solely on source inspection or Jest output.

---

# 22. DATABASE / MIGRATION REQUIREMENTS

If schema changes are necessary:

- additive migration;
- deterministic migration name;
- no destructive rewrite of existing CRM/Communication/Order/Booking data;
- indexes/unique constraints justified;
- foreign keys follow existing ownership patterns;
- migration replay/clean-db path tested according to repository conventions;
- schema drift checked if project tooling supports it.

If no schema change is needed, explicitly state why.

---

# 23. TESTS / REGRESSION

Run targeted tests for every modified bounded context.

At minimum:

```text
Marketing tests
relevant CRM tests
relevant Communication/contact-policy tests
relevant Order/Booking tests if attribution/context touched
backend TypeScript compile/typecheck
```

Run broader regression only if practical/required by repository convention, and report exactly what was actually run.

Never report a suite as PASS if it was not executed.

---

# 24. OUT-OF-SCOPE / DO NOT IMPLEMENT

Unless the repository audit proves they are already part of the Step 3.8 contract, do **not** expand scope into:

- full email provider integration;
- SMS provider integration;
- push infrastructure;
- marketing automation workflows/journeys;
- AI campaign generation;
- bulk contact export;
- ad-network integrations;
- Meta/Google Ads APIs;
- complex multi-touch attribution engine;
- recommendation engine;
- loyalty program;
- coupon/promo domain unless already canonical dependency;
- Support Domain;
- Storefront Business Capability Step 3.29J;
- Storefront visual alignment Step 3.29N;
- public Storefront redesign;
- next roadmap Step.

Document legitimate future gaps rather than silently implementing them.

---

# 25. IMPLEMENTATION REPORT

Create/update:

```text
docs/prompts/PHASE_3_STEP_3.8_MARKETING_DOMAIN_IMPLEMENTATION_REPORT.md
```

Report must contain:

## A. Baseline

```text
Starting HEAD
Starting origin/master
working-tree state
canonical NEXT verification
```

## B. Gap audit

Mandatory matrix from Section 4.

## C. Architecture decisions

Explain:

- Campaign authority;
- Audience authority;
- Channel reuse/new model decision;
- Attribution authority;
- Lifecycle authority;
- CRM boundary;
- Communication boundary;
- Analytics boundary;
- Basic vs Pro boundary;
- consent/preference status.

## D. Files changed

Exact production/test/schema/migration/docs files.

## E. Schema/migration

What changed and why, or explicit `NONE`.

## F. API/RBAC matrix

Endpoints × roles/workspaces/tiers.

## G. Runtime evidence

Exact requests/results/persistence checks.

## H. Security evidence

Tenant isolation, forged ownership, contact leakage, entitlement and permission enforcement.

## I. Tests

Exact commands and exact counts/results.

## J. Deferred items

Explicit future work, with no false implication that it was implemented.

## K. Cleanup

Remove all synthetic runtime fixtures created specifically for evidence, unless repository conventions intentionally preserve seeded fixtures.

## L. Git closure

After all implementation/report changes:

```text
git status --short
git add <only Step 3.8 files>
git commit -m "feat(marketing): implement phase 3 step 3.8 marketing domain"
git push origin master
git rev-parse HEAD
git rev-parse origin/master
```

Record real SHA values.

Do not include unrelated dirty files.

---

# 26. IMPLEMENTATION VERDICT

This task is an **implementation**, not the Strict Review.

The strongest allowed successful final status is:

```text
VERDICT A — STEP 3.8 MARKETING DOMAIN — IMPLEMENTATION COMPLETE
STEP 3.8 READY FOR STRICT REVIEW
```

Use this only if:

- gap audit is complete;
- implemented scope satisfies the canonical Step 3.8 contract;
- no unresolved P0/P1 implementation defect exists;
- security/tenant/contact-policy boundaries pass;
- runtime evidence is complete for implemented behavior;
- tests/typecheck pass;
- fixtures are cleaned;
- implementation report is complete;
- real commit SHA is recorded;
- `HEAD == origin/master`.

If an architecture blocker or system defect prevents completion, use:

```text
VERDICT B — STEP 3.8 MARKETING DOMAIN — IMPLEMENTATION NOT READY
STEP 3.8 NOT READY FOR STRICT REVIEW
```

State blockers as one of:

```text
P0 SYSTEM DEFECT
P1 SYSTEM DEFECT
ARCHITECTURE DECISION REQUIRED
PREREQUISITE BLOCKED
EVIDENCE GAP
```

Do not disguise missing evidence as PASS.

---

# 27. STOP CONDITION

After a successful Step 3.8 implementation:

**STOP.**

Do not:

- perform Step 3.8 Strict Review in the same task;
- mark Step 3.8 CLOSED;
- update canonical NEXT to another implementation Step;
- begin the next implementation;
- begin Storefront 3.29J–3.29O;
- begin Support;
- begin future Marketing Automation.

The next action must be a **separate Step 3.8 Strict Review**.
