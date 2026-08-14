# TRAVELHUB --- FINANCE CENTER COMMISSION UI ROADMAP RECONCILIATION PROMPT

## 0. MODE

**DOCUMENTATION / ROADMAP RECONCILIATION · REPOSITORY-FIRST · NO
PRODUCTION IMPLEMENTATION**

Perform a focused reconciliation of the future **Finance Center UI for
manual Commission Policy management**.

This pass exists because the backend architecture now has a canonical
Finance-owned `CommissionPolicy` authority from ADR-0013 / Step 2.14E,
while the earlier UI/Phase 2 material explicitly listed only Finance
screens such as Payments and Invoices and may not yet contain a
canonical manual Commission Policy management screen.

Do **not** implement frontend or backend production code in this pass.

Do **not** start another business step merely because a UI gap is found.

------------------------------------------------------------------------

# 1. PRIMARY OBJECTIVE

Determine exactly where the future TravelHub UI must expose manual
management of TravelHub commission policies and update the authoritative
roadmap/design documentation so this functionality cannot be lost during
later frontend implementation.

The target concept to reconcile is:

`Finance Center → Commissions → Commission Policies`

The screen must manage the **canonical Finance-owned CommissionPolicy**
created by Step 2.14E.

This is **master-data/policy management**, not a screen for manually
editing historical Commission facts.

------------------------------------------------------------------------

# 2. CURRENT CANONICAL BASELINE

Treat the following as evidence to verify against the actual repository,
not as a substitute for repository inspection:

-   ADR-0013 defines Commission Policy as Finance-owned canonical
    mutable policy authority.
-   Step 2.14E materializes `finance.CommissionPolicy`.
-   V1 policy matching is channel-based.
-   V1 rate type is percentage.
-   Rates must not be hardcoded.
-   Policy has lifecycle/version/effective-period semantics.
-   management is RBAC-controlled.
-   historical Commission must not depend on current mutable policy
    lookup.
-   Commission ≠ ProviderFee.
-   Commission ≠ Settlement/Payout.
-   Commission ≠ Invoice.
-   Commission ≠ Tax/Discount.
-   Settings must not become a duplicate owner of Finance master data.
-   PSP/provider must not own commission business rules.

Verify all of these from actual current files.

------------------------------------------------------------------------

# 3. SOURCES TO INSPECT --- HARD REQUIREMENT

Inspect at minimum:

## Roadmap / architecture

-   `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
-   current Architecture Master / Finance Center chapter
-   current Screen Design Brief
-   current frontend/UI roadmap or Phase 3 UI implementation plan
-   ADR-0013
-   Step 2.14E architecture/report/prompt
-   Commission dependency reconciliation report
-   current Step 2.14 blocked/resume metadata

## Contracts / security

-   `docs/contracts/api.md`
-   `docs/contracts/ids.md`
-   RBAC constants/matrix
-   actual `ROLE_PERMISSIONS`

## Production code/schema --- read only

Inspect actual:

-   `CommissionPolicy`
-   `CommissionPolicyHistory`
-   Commission policy enums
-   Finance controller/service/validation
-   current Commission Policy endpoints
-   current frontend routes/navigation/components, if any
-   current Finance Center UI, if any

## Legacy design

Search older architecture/screen documents for:

-   `Комиссии`
-   `Commission`
-   `commission`
-   Catalog commission settings
-   Finance Center commission settings
-   agent/partner/supplier/manager commission
-   service fee
-   fixed / percentage / combined commission rules

Do not automatically preserve legacy behavior. Classify it against
ADR-0013.

------------------------------------------------------------------------

# 4. FIRST DELIVERABLE --- CURRENT → TARGET MATRIX

Before changing documentation, create a compact matrix:

  ------------------------------------------------------------------------
  Concern           Current state     Canonical target   Gap / action
  ----------------- ----------------- ------------------ -----------------
  Finance           ...               Commissions entry  ...
  navigation                                             

  Commission        ...               Finance-owned      ...
  Policies screen                     management UI      

  Commission facts  ...               separate from      ...
  screen                              policy             

  Commission        ...               separate           ...
  Accruals screen                     operational/read   
                                      model              

  Catalog           ...               no duplicate       ...
  commission                          TravelHub policy   
  controls                            authority          

  Settings          ...               no duplicate       ...
  commission                          authority          
  controls                                               

  RBAC              ...               actual backend     ...
                                      permissions        

  API support       ...               reuse 2.14E API    ...

  Version history   ...               visible/readable   ...

  Effective periods ...               manageable         ...
  ------------------------------------------------------------------------

The matrix must be repository-derived.

------------------------------------------------------------------------

# 5. CANONICAL UI OWNERSHIP --- HARD GATE

Determine and document one canonical location for manual TravelHub
Commission Policy management.

Expected target unless repository evidence proves a contradiction:

**Finance Center → Commissions → Commission Policies**

Do not place canonical TravelHub Commission Policy ownership in:

-   Catalog Center;
-   Settings Center;
-   Sales Center;
-   Partner Cabinet;
-   PSP/integration settings;
-   generic system configuration.

Other domains may **read/display** frozen commission information when
appropriate, but they must not become policy authority.

If repository evidence materially contradicts this, stop and report:

`ARCHITECTURE DECISION REQUIRED`

Do not silently create two policy owners.

------------------------------------------------------------------------

# 6. FINANCE CENTER INFORMATION ARCHITECTURE

Reconcile the future Finance Center navigation.

Evaluate whether the canonical Finance Center should contain, at
minimum, concepts such as:

-   Overview;
-   Payments;
-   Refunds;
-   Disputes;
-   Invoices;
-   Commissions;
-   Settlements;
-   Payouts;
-   Ledger;
-   Finance master data / reference data.

Do not force screens for domains whose implementation is not yet
canonical.

For **Commissions**, determine whether the UI should use nested
tabs/subsections.

Expected conceptual separation:

### Commissions → Policies

Mutable master data:

-   `CommissionPolicy`
-   lifecycle
-   rate
-   channel
-   effective period
-   version/history

### Commissions → Commission Facts

Historical immutable financial facts.

Only expose when the corresponding backend Commission runtime exists.

### Commissions → Accruals

`CommissionAccrual` / PARTNER_COLLECT receivables.

Only expose when the corresponding backend runtime exists.

Do not merge these three concepts into one ambiguous table.

------------------------------------------------------------------------

# 7. COMMISSION POLICY LIST SCREEN

Define the future list screen contract.

At minimum evaluate/display:

-   business ID (`CMP-*`);
-   channel;
-   rate type;
-   human-readable rate;
-   status;
-   effectiveFrom;
-   effectiveTo;
-   version;
-   createdAt;
-   current/effective indicator if safely derivable;
-   actions allowed by RBAC.

Filters should be derived from actual backend vocabulary.

Potential filters to evaluate:

-   status;
-   channel;
-   effective date;
-   active/current policy.

Do not invent unsupported filter API.

Pagination must follow actual backend API behavior.

------------------------------------------------------------------------

# 8. MANUAL CREATE / EDIT UX

The UI must make clear that the rate is **manually configured master
data**, not a hardcoded application constant.

For V1, verify actual backend constraints and map them correctly to UI.

Expected behavior from current 2.14E contract:

-   rate type: `PERCENTAGE`;
-   API decimal fraction example: `0.15`;
-   UI display/input example: `15%`;
-   channel-based matching;
-   effective period;
-   DRAFT creation;
-   DRAFT editing;
-   activation;
-   archive;
-   deterministic overlap rejection;
-   fail-closed invalid/ambiguous policy behavior.

The frontend must perform display conversion only.

Example:

`15% UI ↔ "0.15" API`

The frontend must **not** become a second calculation or policy
authority.

Do not use JavaScript float arithmetic as financial/policy authority.

------------------------------------------------------------------------

# 9. POLICY LIFECYCLE UX

Derive lifecycle from actual backend code.

Document exact allowed UI actions by status.

Expected pattern to verify:

-   Create → DRAFT
-   Edit → DRAFT only
-   Activate
-   Archive
-   archived/terminal behavior

The UI must not show actions the backend contract forbids.

The UI must surface controlled validation/conflict errors, including
effective-period overlap.

Do not invent status transitions.

------------------------------------------------------------------------

# 10. VERSION HISTORY / AUDITABILITY

Because Commission Policy is mutable master data but historical
financial truth must remain reproducible, define how the UI exposes
policy history.

At minimum determine:

-   whether a Policy detail page/drawer shows version history;
-   which fields changed per version;
-   effective periods;
-   actor/timestamp if available from canonical history/audit sources;
-   current status/version;
-   read-only historical versions.

Do not reconstruct history client-side if the backend already owns
history.

Do not allow editing historical versions.

------------------------------------------------------------------------

# 11. RBAC --- HARD GATE

Read actual current `ROLE_PERMISSIONS`.

Do not trust stale documentation.

Map UI visibility and actions to actual permissions.

Verify at minimum:

-   who can read Commission Policies;
-   who can create/update/activate/archive;
-   whether ADMIN has management rights;
-   whether FINANCE has management rights;
-   whether DIRECTOR/ANALYST are read-only;
-   whether SALES_MANAGER has any current commission permission;
-   OPERATOR must not be granted access merely for convenience;
-   PARTNER must not receive internal policy-management authority unless
    a later explicit contract says so.

Frontend hiding is not security.

Backend RBAC remains authoritative.

------------------------------------------------------------------------

# 12. LEGACY CATALOG COMMISSION CONFLICT --- CRITICAL REVIEW

Older TravelHub architecture documents contain a Catalog section where a
service/product could define:

-   agency commission;
-   manager commission;
-   partner commission;
-   supplier commission;
-   service fee;
-   additional fees;

with:

-   fixed amount;
-   percentage;
-   combined scheme.

This must be reconciled explicitly with ADR-0013.

Do **not** silently implement this legacy Catalog section as canonical
TravelHub Commission Policy.

Classify each legacy concept as one of:

1.  superseded by ADR-0013 TravelHub Commission Policy;
2.  different business concept requiring future ADR;
3.  Catalog commercial input but not TravelHub Commission authority;
4.  service fee / provider commercial term distinct from TravelHub
    Commission;
5.  obsolete legacy design;
6.  unresolved --- architecture decision required.

Hard gate:

**There must not be two mutable authorities for the same TravelHub
commission rate.**

If Catalog still needs to display commission information, define it as
read-only/reference unless a later canonical architecture explicitly
gives Catalog ownership of a different concept.

------------------------------------------------------------------------

# 13. SETTINGS CENTER BOUNDARY

Verify current Settings architecture.

Canonical rule to preserve:

Settings may hold configuration/references, but must not become a
duplicate owner of Finance master entities.

Therefore do not create:

`Settings → Commission Rate`

as the canonical TravelHub Commission Policy editor.

If a Settings navigation shortcut is desired later, it must route to the
Finance-owned screen/API rather than store a second setting.

------------------------------------------------------------------------

# 14. POLICY vs HISTORICAL COMMISSION FACT --- HARD GATE

The UI documentation must distinguish:

### Commission Policy

Mutable master data used at the canonical freeze boundary.

### Frozen Commission Snapshot

Historical policy/rate/base provenance frozen into the commercial flow
when later implementation provides it.

### Commission

Immutable financial fact created by the future canonical commission
runtime.

### CommissionAccrual

Receivable/accrual fact for PARTNER_COLLECT.

A user changing a Commission Policy from 15% to 18% must **not** rewrite
historical Orders, Payments, Commission facts or Accruals.

The UI must not suggest otherwise.

------------------------------------------------------------------------

# 15. REFUND / DISPUTE UI BOUNDARY

Do not add manual mutation of historical Commission amounts from the
Policy screen.

Refund/Dispute commission adjustments belong to their future canonical
adjustment flow.

If those semantics are still deferred, UI must not invent:

-   "recalculate old commissions";
-   "apply new rate to existing orders";
-   manual overwrite of Commission amount;
-   manual mutation of frozen commission snapshots.

Historical correction must follow the approved
append-only/compensating-fact architecture when implemented.

------------------------------------------------------------------------

# 16. FRONTEND IMPLEMENTATION POSITION

Determine whether the current Roadmap already has an explicit frontend
step that would implement this screen.

Answer one of:

### A. EXPLICITLY COVERED

A roadmap step explicitly names Commission Policy management UI with
sufficient scope.

### B. IMPLICITLY COVERED BUT UNDER-SPECIFIED

A broader Finance Center/frontend step exists, but Commission Policy
management is not explicit enough.

Update it with a concrete sub-deliverable.

### C. NOT COVERED

No future UI step reliably guarantees implementation.

Add a planned roadmap item.

Preferred naming if a new item is needed:

`PHASE 2 — STEP 2.14F — COMMISSION POLICY MANAGEMENT UI`

However, **do not force this number** if the actual Roadmap numbering
makes another placement more canonical.

Repository authority wins.

------------------------------------------------------------------------

# 17. MINIMUM SCOPE OF FUTURE UI STEP

If a roadmap item must be added or expanded, its minimum scope should
explicitly include:

### Finance Center → Commissions → Commission Policies

-   list;
-   filters;
-   detail;
-   create DRAFT;
-   edit DRAFT;
-   activate;
-   archive;
-   effective period;
-   channel;
-   percentage rate input/display;
-   version history;
-   RBAC-aware actions;
-   controlled validation/conflict states;
-   empty/loading/error states;
-   audit/history visibility;
-   responsive layout consistent with TravelHub internal centers.

It must reuse the backend 2.14E API.

It must not create duplicate frontend-only business rules.

------------------------------------------------------------------------

# 18. DO NOT PREMATURELY IMPLEMENT COMMISSION FACT UI

If `Commission` / `CommissionAccrual` runtime is still not implemented,
do not falsely mark their UI complete.

The roadmap may reserve:

`Finance Center → Commissions → Commission Facts`

and:

`Finance Center → Commissions → Accruals`

but their implementation must depend on their canonical backend steps.

Document prerequisite edges.

------------------------------------------------------------------------

# 19. SCREEN DESIGN BRIEF UPDATE

If the Screen Design Brief lacks this screen, update it.

Use the same enterprise SaaS composition as other internal centers.

At minimum specify:

-   page title / breadcrumbs;
-   KPI/header area only if backed by canonical data;
-   filters;
-   main table;
-   row actions;
-   create/edit side panel or page;
-   policy detail;
-   version history;
-   status badges;
-   confirmation for activation/archive where appropriate;
-   validation/conflict/error states;
-   permission-denied state;
-   empty state.

Do not invent analytics KPIs merely to fill space.

------------------------------------------------------------------------

# 20. BREADCRUMBS / NAVIGATION

Preferred hierarchy to validate:

`Finance Center / Commissions / Commission Policies`

Detail:

`Finance Center / Commissions / Commission Policies / CMP-########`

If tabs are used:

`Policies | Commission Facts | Accruals`

Only enabled/visible according to implemented backend capabilities and
RBAC.

------------------------------------------------------------------------

# 21. API/UI CONTRACT CHECK

For every UI action, map the actual API operation.

Create a table:

  -----------------------------------------------------------------------------
  UI action      API               Permission     Allowed state  Result
                 endpoint/method                                 
  -------------- ----------------- -------------- -------------- --------------
  List policies  ...               ...            ...            ...

  View policy    ...               ...            ...            ...

  Create draft   ...               ...            ...            ...

  Edit draft     ...               ...            ...            ...

  Activate       ...               ...            ...            ...

  Archive        ...               ...            ...            ...

  View history   ...               ...            ...            ...
  -----------------------------------------------------------------------------

Do not invent an endpoint to make the UI design convenient.

If a required read endpoint is genuinely missing, document it as a
prerequisite/gap rather than implementing it in this pass.

------------------------------------------------------------------------

# 22. UX RATE REPRESENTATION --- REQUIRED

Explicitly document representation boundaries.

Example:

-   stored/API authoritative rate: decimal fraction string `"0.15"`;
-   UI: `15%`;
-   user enters `15`;
-   frontend converts presentation value to canonical API
    representation;
-   backend validates authority;
-   frontend must never silently accept `1500%`, `"10"` as canonical
    fraction, or unsupported precision.

Use actual backend validation limits.

Do not round silently beyond backend contract.

------------------------------------------------------------------------

# 23. EFFECTIVE PERIOD / OVERLAP UX

Because policy selection is temporal, define UX for:

-   effectiveFrom;
-   effectiveTo;
-   open-ended policy if supported;
-   half-open interval semantics if canonical;
-   overlap conflict;
-   future policy;
-   currently effective policy;
-   archived policy.

The UI must not attempt to "resolve" an overlap by silently modifying
another policy.

Backend remains authority.

------------------------------------------------------------------------

# 24. MANUAL MANAGEMENT DOES NOT MEAN MANUAL FINANCIAL OVERRIDE

Add an explicit architectural note:

**"Manual commission management" means authorized users manually
configure Commission Policy master data. It does not mean users manually
edit frozen historical commission amounts or financial facts.**

This distinction must appear in the roadmap/design documentation.

------------------------------------------------------------------------

# 25. ROADMAP UPDATE

Update the authoritative Roadmap only after the audit.

Required result:

-   preserve all already approved backend statuses;
-   do not reopen Step 2.14E merely because UI is absent;
-   do not mark frontend implemented;
-   add/clarify the future UI step;
-   add dependency on approved 2.14E API;
-   add dependency for Commission Facts/Accrual UI on their future
    backend runtime;
-   record the legacy Catalog commission conflict resolution;
-   keep execution order repository-derived.

------------------------------------------------------------------------

# 26. REQUIRED NEGATIVE CHECKS

Before final verdict prove:

1.  no production frontend code changed;
2.  no production backend code changed;
3.  no schema/migration changed;
4.  no hardcoded commission rate added;
5.  no duplicate Settings-owned commission authority added;
6.  no duplicate Catalog-owned TravelHub Commission Policy added;
7.  no PSP-owned policy logic added;
8.  no historical Commission mutation semantics invented;
9.  no Refund/Dispute adjustment semantics invented;
10. no Commission/CommissionAccrual runtime falsely marked implemented;
11. no approved backend step reopened without evidence;
12. no UI step falsely marked completed.

------------------------------------------------------------------------

# 27. REQUIRED DOCUMENTATION OUTPUT

Create a report:

`docs/prompts/PHASE_2_FINANCE_COMMISSION_POLICY_UI_ROADMAP_RECONCILIATION_REPORT.md`

The report must contain at minimum:

1.  Verdict
2.  Sources inspected
3.  Current Finance Center UI coverage
4.  Current Commission Policy backend capability
5.  Current roadmap coverage
6.  Current Screen Design coverage
7.  Current frontend implementation state
8.  Canonical UI owner
9.  Finance navigation target
10. Commission Policies screen contract
11. Manual create/edit contract
12. Lifecycle actions
13. Version/history UX
14. RBAC mapping
15. API/UI action mapping
16. Rate representation contract
17. Effective-period UX
18. Catalog legacy commission conflict
19. Settings boundary
20. Policy vs Commission fact separation
21. Commission Facts future screen
22. CommissionAccrual future screen
23. Refund/Dispute boundary
24. Required roadmap changes
25. Required Screen Design changes
26. Dependency edges
27. Negative checks
28. Files changed
29. Exact NEXT
30. Final canonical status line

------------------------------------------------------------------------

# 28. ACCEPTABLE VERDICTS

Use exactly one of these:

### If the screen is already explicitly and sufficiently planned

`FINANCE COMMISSION POLICY UI ROADMAP RECONCILIATION COMPLETED — EXISTING UI STEP CONFIRMED`

### If a broader UI step exists but must be clarified

`FINANCE COMMISSION POLICY UI ROADMAP RECONCILIATION COMPLETED — EXISTING UI STEP HARDENED`

### If no reliable UI step exists and one is added

`FINANCE COMMISSION POLICY UI ROADMAP RECONCILIATION COMPLETED — MISSING UI STEP ADDED`

### If canonical ownership conflicts cannot be resolved from repository evidence

`FINANCE COMMISSION POLICY UI ROADMAP RECONCILIATION BLOCKED — ARCHITECTURE DECISION REQUIRED`

------------------------------------------------------------------------

# 29. STOP CONDITIONS

Stop and report instead of inventing behavior if:

1.  current Roadmap gives Commission Policy ownership to two domains;
2.  ADR-0013 and current production implementation materially conflict;
3.  actual backend 2.14E API cannot support the proposed management UX;
4.  current Catalog commission model is still canonical and semantically
    identical to Finance CommissionPolicy;
5.  RBAC authority cannot be determined;
6.  roadmap numbering/ownership makes a new UI step ambiguous;
7.  implementing the requested documentation would require production
    code changes.

------------------------------------------------------------------------

# 30. EXPECTED CANONICAL RESULT

Unless repository evidence disproves it, the desired architecture after
reconciliation should be:

``` text
Finance Center
└── Commissions
    ├── Commission Policies
    │   ├── List
    │   ├── Create Draft
    │   ├── Edit Draft
    │   ├── Activate
    │   ├── Archive
    │   └── Version History
    │
    ├── Commission Facts       [future backend prerequisite]
    └── Commission Accruals    [future backend prerequisite]
```

Canonical authority:

``` text
FINANCE/ADMIN user
        ↓
Finance Center UI
        ↓
Commission Policy API
        ↓
finance.CommissionPolicy
        ↓
canonical freeze/commission flows in later approved steps
```

Forbidden authority paths:

``` text
Catalog → independent TravelHub commission rate
Settings → independent TravelHub commission rate
Frontend constant → commission rate
PSP/provider → commission business policy
```

------------------------------------------------------------------------

# 31. FINAL INSTRUCTION

This is a **roadmap/UI reconciliation pass**, not implementation.

The goal is to guarantee that the already-created Commission Policy
backend capability will later have a complete, explicit,
enterprise-grade manual management UI in Finance Center, while
eliminating the risk that legacy Catalog/Settings concepts create a
second commission authority.

Do not proceed to frontend implementation after the reconciliation.

Finish with the exact recommended next roadmap item and wait for a
separate implementation prompt.
