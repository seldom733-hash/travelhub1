# TRAVELHUB — STOREFRONT BUSINESS CAPABILITY MODEL — ARCHITECTURE & ROADMAP AMENDMENT

## MODE

**ARCHITECTURE / CANONICAL ROADMAP AMENDMENT ONLY.**

Do **not** implement production code in this step.

Do not interrupt or merge this work with the current Step 3.7B Communication Integration closure / Strict Review sequence.

The purpose of this task is to formally capture the Storefront business model in TravelHub architecture and the canonical roadmap so it cannot be lost or later implemented as ad-hoc UI hiding.

---

# 1. Business decision to canonicalize

TravelHub Storefront is a SaaS capability that allows a partner to create and operate its **own public travel website/storefront on top of the TravelHub platform**.

The Storefront Partner can distribute the public Storefront URL through:

- social networks;
- advertising;
- messengers;
- search engines;
- QR codes;
- other acquisition channels;

and attract **its own direct customers**.

Therefore Storefront is not merely a seller profile inside TravelHub Marketplace.

It consists of two distinct but connected surfaces:

```text
STOREFRONT PARTNER
│
├── PUBLIC STOREFRONT / OWN WEBSITE
│   ├── own homepage
│   ├── own brand
│   ├── own catalog
│   ├── enabled services only
│   ├── customer search / filters
│   ├── booking / purchase flows
│   └── partner-owned acquisition channel
│
└── PARTNER WORKSPACE / BACK OFFICE
    ├── Рабочий стол
    ├── Аналитика
    ├── Продажи
    ├── Бронирования / Заказы
    ├── CRM
    ├── Финансы
    ├── Маркетинг
    ├── Сотрудники
    ├── Управление витриной
    └── Настройки
```

The Storefront public website and Partner Back Office MUST NOT be treated as the same UI surface.

---

# 2. Homepage contract

For a Storefront Partner:

```text
Главная = public homepage of that partner's own Storefront
```

It is analogous in product role to the public TravelHub platform homepage.

It is NOT the internal operational Dashboard.

Maintain the semantic separation:

```text
Главная
= public Storefront / customer-facing website

Рабочий стол
= internal operational dashboard

Аналитика
= separate analytics center / top-level Back Office section
```

Do not use “Главная” and “Рабочий стол” as synonyms.

---

# 3. Storefront design boundary

The Partner Back Office should use the common TravelHub Workspace design language and shared Workspace Shell.

Future Storefront Pro Dashboard visual alignment should bring the internal workspace into visual/system consistency with Platform Workspace:

```text
shared:
- Workspace Shell
- sidebar mechanics
- header patterns
- KPI component language
- grid/layout principles
- chart design system
- filters/period controls
- loading/empty/error states
- responsive behavior
```

However:

```text
Platform Back Office design alignment
        ≠
forcing the public Storefront to visually copy TravelHub
```

The public Storefront belongs to the partner-facing brand experience and may have:

- partner logo;
- partner colors/theme;
- partner banners/media;
- partner content;
- partner navigation configuration;
- partner domain/subdomain;
- future presentation/template options.

This is a hard architectural boundary.

---

# 4. Storefront Business Capability Model

A Storefront Partner is NOT required to sell every TravelHub service category.

A Storefront may be narrowly specialized:

```text
HOTEL only
TOUR only
FLIGHT only
TRANSFER only
```

or combined:

```text
HOTEL + TOUR
HOTEL + TOUR + TRANSFER
FLIGHT + HOTEL
...
```

The partner must explicitly choose which supported business/service capabilities are enabled for its Storefront.

New capabilities can be enabled later.

This selection is a first-class domain/business configuration, not merely a frontend preference.

---

# 5. Canonical hierarchy

Preserve and extend the existing TravelHub workspace authority model:

```text
IDENTITY
    ↓
WORKSPACE CONTEXT
    ↓
TENANT / PARTNER SCOPE
    ↓
PLAN / ENTITLEMENT
    ↓
BUSINESS CAPABILITIES
    ↓
ROLE / PERMISSIONS
    ↓
AVAILABLE ACTION / DATA / UI
```

For Storefront:

```text
Workspace = PARTNER
Tier/Entitlement = STOREFRONT PRO
Business Capabilities = HOTEL | TOUR | FLIGHT | TRANSFER | ...
Permissions = actor-specific permissions
```

Hard invariant:

```text
Entitlement ≠ Business Capability ≠ Permission
```

Definitions:

**Entitlement**
answers:

> Which TravelHub product/features has the partner subscribed to?

**Business Capability**
answers:

> Which categories of travel services does this Storefront operate/sell?

**Permission**
answers:

> What may this specific user/employee do inside the enabled business capabilities?

A permission MUST NOT activate a business capability that the Storefront has not enabled.

Example:

```text
employee has hotel.manage
Storefront HOTEL capability = disabled

=> hotel management operation is unavailable
```

---

# 6. Capability registry — gap-first

Do NOT invent a second taxonomy if TravelHub already has canonical product/service/category/capability identifiers.

Audit the repository and canonical documentation for the existing service/product type registry.

Determine the authoritative existing identifiers for concepts such as:

```text
Accommodation / Hotel
Tours
Flights / Tickets
Transfers
Excursions / Activities
Car Rental
and any other already-supported TravelHub service types
```

Reuse canonical identifiers wherever possible.

If no sufficient canonical registry exists, document the gap and propose the smallest extensible capability registry.

Do not silently create duplicate concepts such as:

```text
HOTEL
ACCOMMODATION
LODGING
```

for the same domain.

---

# 7. Capability lifecycle

At minimum architecture must support:

```text
ACTIVE
DISABLED
```

Evaluate whether an intermediate state such as `SUSPENDED` is already justified by existing platform concepts.

Do not add lifecycle states without a defined business meaning.

Core behavior:

### ACTIVE

```text
new listings/offers allowed
new sales/bookings allowed
public Storefront visibility allowed
relevant search/filter/navigation enabled
Back Office operational modules enabled
```

### DISABLED

```text
new selling through this capability prohibited
new public discovery prohibited
capability removed from active Storefront navigation/search/filter surfaces
historical business records preserved
historical financial records preserved
historical CRM/activity records preserved
existing audit history preserved
```

Disabling a capability MUST NOT delete its historical data.

---

# 8. Storefront Settings

The future Partner Workspace should expose capability management under Storefront settings.

Conceptual IA:

```text
Настройки
└── Storefront
    ├── Общие
    ├── Брендинг
    ├── Услуги бизнеса
    ├── Навигация
    ├── Домен
    ├── SEO
    └── ...
```

`Услуги бизнеса` / Business Services is where the partner can:

```text
view available supported capabilities
see currently active capabilities
enable a new capability
disable an active capability
see consequences/warnings before disabling
```

Exact labels are UX-level and may be refined later.

---

# 9. Public Storefront projection

Enabled Business Capabilities must determine the customer-facing Storefront composition.

If:

```text
HOTEL = ACTIVE
TOUR = ACTIVE
FLIGHT = DISABLED
TRANSFER = DISABLED
```

then the public Storefront must not expose inactive service categories through:

```text
main navigation
homepage service blocks
catalog category navigation
search tabs
search scopes
filters
landing-page links
create/purchase entry points
cross-sell widgets
other customer-visible discovery surfaces
```

Expected conceptual projection:

```text
STOREFRONT
├── Главная
├── Отели
├── Туры
└── Search / Filters
    ├── Hotel-relevant controls
    └── Tour-relevant controls
```

There should be no empty Flights/Transfers UI merely because the global TravelHub platform supports those services.

---

# 10. Back Office projection

Business Capabilities must also affect Partner Back Office composition where the business domain is capability-specific.

Evaluate and document capability effects on:

```text
Рабочий стол
Аналитика
Продажи
Заказы
Бронирования
Каталог / предложения
Маркетинг
CRM context/views where relevant
Finance context/views where relevant
forms/actions
sidebar children
filters
KPI cards
charts
reports
```

Example:

A HOTEL-only Storefront should not receive meaningless Flight-specific KPI cards, filters or operational actions.

However, capability projection MUST NOT hide historical records that the partner is legally/operationally allowed to inspect after disabling a capability.

---

# 11. Analytics contract

Analytics remains a **separate top-level Partner Workspace section**, not a CRM subsection and not a replacement for Dashboard.

Conceptually:

```text
PARTNER WORKSPACE
├── Рабочий стол
├── Аналитика
├── Продажи
├── Бронирования / Заказы
├── CRM
└── ...
```

Storefront Analytics is both:

```text
entitlement-aware
AND
business-capability-aware
```

Example:

```text
Storefront Pro
Capabilities = HOTEL + TOUR

=> full Pro analytics depth
=> Hotel + Tour relevant dimensions/views
=> no active Flight/Transfer analytics UI
```

Historical analytics must remain accessible according to retention/business rules after a capability is disabled.

Do not create a second Analytics Engine.

---

# 12. Dashboard contract

The Storefront internal Dashboard (`Рабочий стол`) is an operational Back Office surface.

It should eventually be visually aligned with Platform Dashboard through the shared TravelHub design system, while showing Storefront-specific business data.

Business Capabilities determine which domain-specific dashboard sections/KPIs can appear.

Example:

```text
HOTEL-only Storefront

allowed:
- hotel sales
- hotel bookings
- hotel revenue
- occupancy-related metrics if supported
- relevant customer/CRM KPIs

not applicable:
- flight sales KPI
- transfer booking KPI
- tour conversion KPI
```

Do not hardcode capability-specific Dashboard variants if the existing widget/manifest architecture can project them dynamically.

---

# 13. Navigation contract

Storefront navigation should be capability-derived.

Conceptual authority flow:

```text
available TravelHub capabilities
        ↓
Storefront enabled capabilities
        ↓
public navigation eligibility
        ↓
partner navigation configuration/order
        ↓
rendered Storefront navigation
```

A partner must not be able to manually add an active sales/navigation entry for a capability that is disabled.

Example:

```text
FLIGHT = DISABLED

=> "Авиабилеты" cannot be activated in Storefront navigation
```

This rule must eventually be enforced server-side, not only hidden by frontend.

---

# 14. Search and filters contract

Search and filtering must be capability-aware.

Inactive capabilities must not appear as:

```text
search tabs
category selectors
filter groups
service-type options
homepage search modes
```

Do not merely return zero results for a disabled category while still advertising the category in UI.

The effective searchable universe for a Storefront is constrained by its enabled Business Capabilities.

---

# 15. API / server authority principle

Future implementation MUST NOT rely on:

```text
display:none
frontend-only feature flags
hidden menu items
client-supplied capability claims
```

The server must be authoritative for whether the Storefront can perform capability-specific operations.

Future access evaluation should conceptually include:

```text
workspace authority
AND tenant/partner ownership
AND entitlement
AND business capability
AND actor permission
```

Exact integration must reuse existing authorization architecture and avoid parallel policy systems.

---

# 16. Customer/source attribution boundary

Preserve the established distinction:

```text
Customer acquired through TravelHub Marketplace
→ MARKETPLACE source/context
→ TravelHub-mediated relationship rules

Customer acquired through Partner's public Storefront
→ STOREFRONT source/context
→ direct Storefront Partner customer relationship
→ Storefront Pro CRM capabilities
```

Business Capability selection does not change source attribution semantics.

Example:

A customer booking HOTEL through the partner's own Storefront is still a STOREFRONT-acquired customer, not a Marketplace customer merely because TravelHub infrastructure processes the booking.

---

# 17. Existing records when capability is disabled

This is a hard data-integrity requirement.

Disabling a service must not delete or corrupt:

```text
Orders
Bookings
Payments
Refunds
Invoices
CRM customer history
Communication history
CrmActivity/history
Analytics facts
Audit records
other historical references
```

Separate:

```text
ability to create/sell new business
```

from:

```text
ability to read legitimate historical business records
```

The future implementation design must define this explicitly before coding.

---

# 18. Enable-new-capability flow

Architecture should support later expansion:

```text
Storefront Settings
    ↓
Business Services
    ↓
select supported capability
    ↓
eligibility/entitlement validation
    ↓
activate
    ↓
configure capability-specific business settings
    ↓
publish to Storefront
```

Do not assume that every capability can be activated without prerequisites.

Audit whether individual service domains require onboarding/configuration such as:

```text
supplier credentials
inventory configuration
commercial terms
legal/compliance information
payment configuration
content/listings
```

Record such requirements as capability-specific activation prerequisites rather than hardcoding them into the generic capability model.

---

# 19. Initial Storefront onboarding

Evaluate the best integration with existing Storefront subscription/onboarding architecture.

The target business behavior is:

```text
choose Storefront subscription
        ↓
partner/company onboarding
        ↓
choose initial Business Capabilities
        ↓
complete capability prerequisites
        ↓
configure Storefront
        ↓
publish own Storefront URL
```

Do not silently alter existing subscription/payment flows in this architecture-only task.

Document the required future integration point.

---

# 20. Public URL / distribution model

Canonical architecture should state that a Storefront has a public URL intended for external distribution by the partner.

The partner may use this URL for customer acquisition through social networks and other channels.

Do not invent the final URL/domain routing scheme in this task.

Audit current routing/domain architecture and record:

```text
existing mechanism
gap
future decision required
```

Custom domain support may remain future scope unless already canonical.

---

# 21. Repository audit required

Before modifying architecture/roadmap, inspect at minimum:

```text
canonical roadmap
workspace architecture
Partner / Storefront models
entitlement/tier implementation
product/service/catalog models
sidebar/workspace manifests
Partner Dashboard
Partner Analytics
public Storefront routes/components
Storefront settings
customer source attribution
authorization/capability infrastructure
```

For each relevant area classify:

```text
EXISTS
PARTIAL
MISSING
CONFLICT
DEFERRED
```

Do not assume the architecture from this prompt already exists in code.

---

# 22. Gap analysis

Produce an explicit matrix:

| Concern | Existing authority | Current state | Gap | Future implementation stage |
|---|---|---|---|---|
| Storefront public site boundary | ... | ... | ... | ... |
| Storefront homepage semantics | ... | ... | ... | ... |
| Business Capability registry | ... | ... | ... | ... |
| Capability persistence | ... | ... | ... | ... |
| Capability lifecycle | ... | ... | ... | ... |
| Storefront Settings | ... | ... | ... | ... |
| Public nav projection | ... | ... | ... | ... |
| Search/filter projection | ... | ... | ... | ... |
| Dashboard projection | ... | ... | ... | ... |
| Analytics projection | ... | ... | ... | ... |
| API enforcement | ... | ... | ... | ... |
| Historical data behavior | ... | ... | ... | ... |
| Capability onboarding | ... | ... | ... | ... |
| Public URL/domain | ... | ... | ... | ... |

Use real repository evidence.

---

# 23. Canonical roadmap amendment

Update:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Rules:

- additive update;
- preserve historical completed stages;
- do not silently renumber completed steps;
- do not change the current canonical NEXT merely to insert this architecture decision;
- do not mark unimplemented functionality as implemented;
- place the Storefront Business Capability work at the correct future implementation point;
- preserve the implementation → Strict Review pairing rule;
- include Storefront Visual Alignment as a concrete future concern/stage if not already represented;
- explicitly preserve the Public Storefront ↔ Partner Back Office boundary;
- explicitly preserve Analytics as a top-level Back Office section.

If the roadmap already contains the correct future stage, enrich it instead of creating a duplicate stage.

---

# 24. Required future implementation decomposition

Based on the actual roadmap/repository, propose a minimal staged decomposition.

The decomposition should cover, where gaps exist:

```text
A. Business Capability domain/server authority
B. Storefront Settings capability management
C. Public Storefront navigation/search/filter projection
D. Partner Back Office capability projection
E. Dashboard + Analytics capability projection
F. Storefront Pro Back Office visual alignment with Platform design system
G. onboarding / enable-new-capability integration
```

Do not force these exact letters/numbers into the roadmap if existing stage numbering provides a better canonical location.

Every implementation stage must have a separate Strict Review before the next implementation stage.

---

# 25. Explicit non-goals

Do NOT implement now:

```text
new database schema
new capability tables
new API endpoints
new Storefront Settings UI
new public Storefront UI
Dashboard redesign
Analytics redesign
sidebar redesign
search/filter changes
custom domain
new subscription logic
new CRM behavior
new authorization middleware
```

This task is architecture + repository gap audit + roadmap canonicalization only.

---

# 26. Required deliverables

Produce:

## A. Architecture decision

A concise canonical statement covering:

```text
Storefront = own public website + TravelHub Back Office
Главная = own public Storefront homepage
Рабочий стол = internal operational Dashboard
Аналитика = separate top-level Back Office section
Storefront can select service capabilities
inactive capabilities absent from active public discovery/UI
inactive capabilities absent from irrelevant Back Office operational UI
historical data preserved
Entitlement ≠ Business Capability ≠ Permission
server is authoritative
```

## B. Repository evidence

Real paths/files/classes/models/routes demonstrating current state.

## C. Gap matrix

As defined above.

## D. Roadmap diff

Show exactly what was added/changed in the canonical roadmap.

## E. Future stage sequence

Show where implementation will occur without disturbing the current Step 3.7B sequence.

## F. Git evidence

After documentation-only changes:

```bash
git status
git diff --stat
git diff
git rev-parse HEAD
```

Commit only intended architecture/roadmap documentation changes.

Push.

Then report:

```text
Architecture/Roadmap amendment SHA:
Final HEAD:
origin/master:
HEAD == origin/master:
production code changes: NONE
test code changes: NONE
schema changes: NONE
```

---

# 27. Verdict rules

Allowed PASS verdict:

```text
VERDICT A — STOREFRONT BUSINESS CAPABILITY MODEL ARCHITECTURE & ROADMAP AMENDMENT COMPLETE
```

only if:

```text
[ ] repository audited
[ ] existing canonical concepts reused
[ ] Storefront public-site boundary documented
[ ] homepage/dashboard/analytics semantics documented
[ ] Business Capability model documented
[ ] Entitlement ≠ Capability ≠ Permission preserved
[ ] capability lifecycle documented
[ ] public Storefront projection documented
[ ] Back Office projection documented
[ ] Dashboard/Analytics implications documented
[ ] navigation/search/filter implications documented
[ ] historical-data preservation documented
[ ] source-attribution boundary preserved
[ ] server-authority requirement documented
[ ] gap matrix produced
[ ] future implementation stages placed in roadmap
[ ] current canonical NEXT not improperly changed
[ ] no production code changed
[ ] no test code changed
[ ] no schema changed
[ ] documentation committed and pushed
[ ] exact Git SHA reported
[ ] HEAD == origin/master proven
```

Otherwise:

```text
VERDICT B — STOREFRONT BUSINESS CAPABILITY MODEL ARCHITECTURE / ROADMAP AMENDMENT INCOMPLETE
```

---

# 28. Stop condition

After the architecture/roadmap amendment:

- do not implement the capability model;
- do not start Storefront Visual Alignment;
- do not change the current 3.7B closure/Strict Review sequence;
- do not start another roadmap implementation step automatically.

Return the report and stop.

The implementation must begin later from the canonical roadmap through a dedicated implementation prompt followed by a separate Strict Review.
