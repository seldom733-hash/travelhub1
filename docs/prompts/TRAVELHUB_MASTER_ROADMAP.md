# TravelHub — MASTER ROADMAP
## Canonical Project Roadmap & Current State

**Repository:** `seldom733-hash/travelhub1`  
**Canonical local repository:** `D:\travelhub_v1`  
**Document type:** Master Roadmap / Current State  
**Purpose:** единый текущий источник истины по последовательности работ, статусам, зависимостям и TRUE NEXT.

> **GOVERNANCE NOTE (Documentation Governance Cleanup, 2026-09-09):** этот документ — consolidation current-state roadmap. Последовательность стадий (stage ordering, D-track, TRUE NEXT) канонически определяется `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (canonical Master Plan v3) + принятыми requalification reports. При конфликте — по Authority order §1.1 этого документа. См. `docs/reports/PHASE_3_DOCUMENTATION_GOVERNANCE_CLEANUP_REPORT.md`.

> **Правило:** исторические prompts и reports не являются roadmap. Они являются evidence/history. Этот документ отражает только актуальное состояние проекта и принятую последовательность.

---

# 1. ROADMAP GOVERNANCE

## 1.1 Authority order

При конфликте использовать:

1. текущий source tree и фактический Git;
2. текущие тесты, security contracts и реализованную архитектуру;
3. schema/API/domain contracts;
4. принятые architecture/governance decisions;
5. текущий Debt Register;
6. этот Master Roadmap;
7. исторические reports/prompts;
8. предположения агента.

Если источники расходятся — конфликт должен быть явно зафиксирован и разрешён по более высокому источнику.

---

# 2. PRODUCT / ARCHITECTURE TRACKS

TravelHub развивается несколькими связанными, но не тождественными треками:

```text
A — Foundation / Platform
B — Commerce / Operations
C — Commerce UI / Presentation
D — Cross-cutting architecture
F — Finance
P — Product / Service Model
S — Storefront / Subscription
```

Наличие capability в одном треке не означает завершение другого.

Критический пример:

```text
Operations Center
└── Payments = CURRENT capability

Finance Center
├── Payments
├── Refunds
├── Commissions
├── Settlements
├── Payouts
├── Reconciliation
└── Finance Analytics
= NOT STARTED
```

Payments не означает, что Finance Center реализован.

---

# 3. PHASE 3 — COMMERCE CENTER

## 3.1 Canonical current C-track

Фактически принятая и выполненная последовательность была уточнена в ходе многочисленных governance/requalification stages.

Исторические ранние схемы с другим смыслом UI-C3/UI-C4/UI-C5 считаются historical/obsolete mappings, если они противоречат принятым stage reports и governance decisions.

Текущая фактическая цепочка:

```text
UI-C1 / Commerce Center foundations
        ↓
UI-C1.1
        ↓
UI-C1.2A … UI-C1.2H.2
        ↓
UI-C2 — Commerce Relation Chain
        ↓
UI-C3 — absorbed / already covered by accepted implementation
        ↓
UI-C4/C5 historical semantics reconciled
        ↓
UI-C5 — Operational Notes unification
        ↓
UI-C6 — Request Server-Authority Remediation
        ↓
UI-C7 — Request UI Migration
        ↓
UI-C8 — Order UI Migration
        ↓
UI-C9 — Booking UI Migration
        ↓
future C-track stages / governance gates
        ↓
UI-C17 — Final RBAC Full-Matrix Re-qualification
        ↓
UI-C18 — Git Hard Closure
```

Важно: номера C-stage нельзя трактовать независимо от accepted stage reports. Часть ранних C-stage была absorbed/resequenced.

---

# 4. ACCEPTED / CLOSED PHASE 3 STAGES

## UI-C1 — Commerce Center foundations

**Status:** CLOSED / ACCEPTED

Основание: shared Commerce Center/detail architecture and previously accepted implementation stages.

---

## UI-C1.1 — Detail-system foundations / canonical presentation

**Status:** CLOSED / ACCEPTED

Подтверждены shared primitives и canonical detail presentation.

---

## UI-C1.2 — Operations Center

### UI-C1.2A — Shared Operations Center Shell
**Status:** CLOSED  
**Final SHA:** `485436a55912d77e58a37e8c87132762a08caa27`

### UI-C1.2B — Requests tab
**Status:** CLOSED  
**Final SHA:** `ec85deb963d1ba9943ecb1ef890a66b45cda2460`

### UI-C1.2C — Orders tab
**Status:** CLOSED  
**Final SHA:** `3b12d16def817bf4c91124adf692d7aa6c`

### UI-C1.2D — Bookings tab
**Status:** CLOSED  
**Final SHA:** `be683831dda0343190fa4b2ca78ff7f658995f53`

### UI-C1.2E — Payments backend/read model prerequisites
**Status:** CLOSED  
**Final SHA:** `d842339090ed80e3d2b65a6be3189a1fbef73774`

### UI-C1.2F — Payments tab
**Status:** CLOSED  
**Final SHA:** `cbbdedba5589f4d036ac97a4fe8f00c5dc2da8a9`

### UI-C1.2F.1 — Header Period / Table Header Filtering
**Status:** CLOSED  
**Final reconciliation SHA:** `5258ed728aed0a122bdff7e1285c583f41729779`

### UI-C1.2G — KPI Semantic Grouping / Lifecycle Flow
**Status:** CLOSED  
**Final SHA:** `16df72`  
> Short SHA retained only because that is how the accepted stage was historically recorded; use full Git SHA when resolving directly in Git.

### UI-C1.2H / H.1 / H.2 — Help / i18n / accessibility / Business Dictionary
**Status:** CLOSED  
**Final H.2 SHA:** `db83c448d73b9015efed173446a6edf252af2aec`

---

# 5. COMMERCE RELATION / DETAIL SEMANTICS

## UI-C2 — Commerce Relation Chain

**Status:** CLOSED / ACCEPTED

**Final SHA:** `586ffe739855b4e29514126abfe5e95e74b398a3`

Canonical relation:

```text
Request → Order → Booking
```

Important separation:

```text
Relation Chain ≠ Timeline ≠ Audit History
```

Server remains authoritative for relation truth.

---

# 6. NOTES / AUDIT / TIMELINE RECONCILIATION

The historical roadmap contained multiple competing names for C3/C4/C5. These were reconciled against actual accepted implementation.

## Timeline

**Status:** IMPLEMENTED / ACCEPTED as shared `EntityTimeline` capability.

It must not be treated as an unimplemented historical C-stage merely because an old roadmap used another number.

## Audit History

**Status:** ACCEPTED as canonical `EntityAuditHistory` capability.

## UI-C5 — Operational Notes Unification

**Status:** CLOSED / ACCEPTED

**Final Git closure SHA:** `d6aebb90182e54f45d1dd8090318542fcc7f26c0`

Canonical Notes:

```text
crm.OperationalNote
+
shared <OperationalNotes/>
+
Request / Order / Booking / relevant CRM/Product integrations
```

Request received the required minimal backend allowlist/enrichment without schema migration.

---

# 7. UI-C6 — REQUEST SERVER-AUTHORITY REMEDIATION

**Status:** CLOSED / ACCEPTED

Purpose:

```text
server-authoritative Request availableActions
```

Canonical Request projection:

```text
availableActions: {
  confirmPrice: boolean;
  proposePrice: boolean;
  reject: boolean;
  unavailable: boolean;
  customerAccept: boolean;
  customerDecline: boolean;
  convert: boolean;
}
```

The implementation preserved existing permissions and execution rules.

**SEC-UI-01:** CLOSED.

Live browser verification and final qualification were completed.

Final accepted lineage was closed through documentation/reconciliation commits; use the actual Git HEAD when exact commit identification is required.

---

# 8. UI-C7 — REQUEST UI MIGRATION

**Status:** CLOSED / ACCEPTED

Purpose:

```text
Request Detail
→ canonical detail shell
→ server-authoritative Request availableActions
→ canonical RequestActionBar
```

Completed:

- all seven Request actions consume server projection;
- no local lifecycle authorization matrix;
- action bar moved to canonical header slot;
- loading/error/not-found parity;
- i18n;
- accessibility;
- responsive/browser qualification;
- RBAC/security regression.

**Final SHA:**

`dfd0558f50b5af57f047eb7ed7036ad5c189a080`

---

# 9. UI-C8 — ORDER UI MIGRATION

**Status:** ACCEPTED / PUBLISHED

Functional implementation was accepted first, then separately published during UI-C18 closure.

Accepted changes:

```text
frontend/components/order/OrderActionBar.tsx
frontend/lib/commerce-detail-system.spec.tsx
frontend/lib/i18n.tsx
```

Server-authoritative `availableActions` was preserved.

Localized labels, confirmation text, busy state and accessibility were qualified.

Focused tests, D5 regression, TSC/build and browser qualification passed within the defined C8 boundary.

**Publication SHA:**

`fc727d1`

UI-C8 publication is part of the final Phase-3 Git lineage but is not UI-C18 production logic.

---

# 10. UI-C9 — BOOKING UI MIGRATION

**Status:** CLOSED / ACCEPTED

Purpose:

```text
Booking Detail
→ canonical header action bar
→ server-authoritative actions
→ shared detail presentation
```

The accepted C9 report explicitly recorded that C8 publication had initially remained isolated, and C9 was committed independently.

**Implementation SHA:**

`f9e7c41eefc9e797605cf2f720012df6f82ff12b`

C9 qualification included:

- focused tests;
- targeted regression;
- security/RBAC;
- i18n;
- accessibility;
- build/TSC;
- C8 isolation verification.

After C9, the roadmap required another TRUE NEXT requalification rather than assuming the next stage from numbering alone.

---

# 11. LATE-PHASE GOVERNANCE GATES

## UI-C15 — Card / spacing / responsive / loading / error polish

**Status:** historical roadmap stage / incorporated into late-stage Commerce UI qualification.

No separate current implementation task should be invented solely from the old number.

---

## UI-C16 — Security / Regression / Browser Qualification

**Status:** CLOSED / incorporated into final Commerce qualification history.

Meaning:

```text
validate implemented product/stage security,
runtime contracts,
browser behavior and regression boundaries
```

It is distinct from the final all-role/all-permission RBAC matrix gate.

---

# 12. UI-C17 — FINAL RBAC FULL-MATRIX RE-QUALIFICATION

**Status:** CLOSED

Purpose:

```text
FINAL SECURITY / AUTHORIZATION QUALIFICATION
```

Not RBAC implementation.

Required matrix:

```text
ALL CURRENT ROLES × ALL CURRENT PERMISSIONS
```

Verified:

- expected vs actual grants/denies;
- missing/excess grants;
- effective authorization;
- backend guards;
- endpoint authority;
- action authority;
- server-authoritative UI projections;
- positive and negative authorization;
- cross-role isolation;
- tenant/workspace isolation.

Canonical RBAC result:

```text
10 roles
156 canonical permissions
1560 matrix cells
1560/1560 MATCH
```

Operator model:

```text
Requests / Orders / Bookings = operational mutation authority
Finance / Payments mutation = NOT granted
```

Full-access-by-default was disproven.

Known `order.import` DB-only/stale permission remained outside canonical 156 and was not promoted.

**Final evidence/Git reconciliation SHA:**

`69cdaa6b47f8f6039ec90f6d8fc0ba184ef33efb`

Later documentation reconciliation commits preserved the evidence and did not alter RBAC behavior.

---

# 13. UI-C18 — GIT HARD CLOSURE

**Status:** CLOSED

Purpose:

```text
accepted implementation
+
accepted evidence
+
correct Git lineage
+
no unintended production changes
+
remote synchronization
```

UI-C8 publication was verified as a dedicated production-bearing commit.

The remaining closure/reconciliation commits were documentation/evidence metadata.

Final reconciliation established:

```text
UI-C17 = CLOSED
UI-C8 = ACCEPTED / PUBLISHED
UI-C18 = CLOSED
PHASE 3 GIT = CLOSED
HEAD == origin/master
tracked working tree = CLEAN
untracked = 0
unexpected production changes = NO
```

UI-C18 is the final Git closure of the current Phase-3 implementation lineage.

---

# 14. RBAC / DEPARTMENTAL MODEL — CANONICAL

TravelHub does NOT use full-access-by-default.

Canonical relationship:

```text
User
├── Role
├── Department / business responsibility
└── Permissions
```

Operational model is departmental-by-responsibility, with granular server-side permissions.

Current roles identified:

```text
ADMIN
DIRECTOR
FINANCE
MARKETER
ANALYST
MODERATOR
SALES_MANAGER
OPERATOR
PARTNER
BUYER
```

Operator is not expected to have platform-wide access.

Canonical Operator responsibility:

```text
Requests
Orders
Bookings
```

with no Finance/Payments authority.

This model must be preserved by future stages.

---

# 15. OPERATIONS / FINANCE BOUNDARY

## Current

```text
OPERATIONS
├── Requests
├── Orders
└── Bookings

FINANCE OWNERSHIP
└── Payments
```

## Future Finance Center

```text
FINANCE CENTER
├── Payments
├── Refunds
├── Commissions
├── Settlements
├── Payouts
├── Reconciliation
└── Finance Analytics
```

**Status:** NOT STARTED / DEFERRED.

Do not promote Payments into Finance Center.

---

# 16. D-TRACK

## D8 — Global Temporal Visibility

**Status:** ✅ ACCEPTED / CLOSED (implementation VERDICT A; final closure 2026-09-10, see `docs/reports/PHASE_3_D8_FINAL_CLOSURE_REPORT.md`).

**Reconciliation (2026-09-10, D8 Final Closure / Roadmap Reconciliation):** D8 implementation closed via commit chain `73cd732` (implementation + focused suites) → `a52c476`/`882adf4` (requalification + scoped CRM Activity validation fix) → `48471cb`/`af5b075`/`272b0fe` (security/tenant requalification: VERDICT B → positive tenant-isolation evidence EVIDENCE READY → full matrix VERDICT A, 57/57 runtime API cases + authenticated browser evidence). No schema/migration/RBAC changes; D11 boundary preserved. TRUE NEXT moves to **D9 — Export Framework Requalification** (do not start D9 inside D8 closure; select it in a separate TRUE NEXT requalification pass).

**Reconciliation (2026-09-09, Documentation Governance Cleanup):** независимая TRUE NEXT requalification, требуемая этим разделом, выполнена и принята: `docs/reports/PHASE_3_TRUE_NEXT_REQUALIFICATION_AFTER_UI_C18_REPORT.md` (VERDICT A, commit f41bd6a) — TRUE NEXT = D8. Причина «deferred from immediate C-track execution» устарела: C-track закрыт (UI-C9 → UI-C17 → UI-C18). Состояние D8-ветки: audit-first mapping report + evidence/scope reconciliation выполнены (docs/reports/PHASE_3_D8_*, VERDICT A); implementation prompt = NOT APPROVED до завершения documentation governance cleanup. *(Historical — superseded by the 2026-09-10 closure above.)*

Purpose:

```text
global temporal invariants / visibility
```

D8 is a separate architectural track.

The existence of D8 does not automatically make it TRUE NEXT.

It requires an independent TRUE NEXT decision after the current closed C-track state.

---

# 17. FINANCE TRACK

## FIN-01 — Finance Center

**Status:** DEFERRED / FUTURE PHASE

Prerequisites include canonical financial authority and related finance contracts.

## FIN-02 — PSP / Provider Integration

**Status:** DEFERRED / FUTURE PHASE

## FIN-03 — Payout

**Status:** DEFERRED / FUTURE PHASE

Existing Payments capability must not be confused with completion of this track.

---

# 18. PRODUCT / SERVICE MODEL

## PROD-01 — Seller Service Cards / Product Model / Service Category Reporting

**Status:** OPEN / DEFERRED

**Registered SHA:** `a481048966c7ac788f8381069715d1b61032921f`

Required architectural resolution before implementation includes:

```text
Service / Product model
Category catalog
Seller Service Card
Common + category-specific attributes
Package / composite services
Multi-supplier ownership
Inventory / availability / capacity
Pricing / tariff / commission
Historical snapshots
Product
→ Request
→ OrderItem
→ Booking
→ Payment
```

Reporting must preserve distinctions:

```text
Marketplace GMV
Storefront Commerce Volume
TravelHub Revenue
```

Expected future category reporting includes:

```text
GMV / Commerce Volume
Revenue
Orders
Bookings
AOV
Conversion
Refund / Cancellation Rate
```

with drill-down:

```text
Category
→ Service Type
→ Supplier
→ Product
```

Do not start PROD-01 until the service/product model and reporting contract are architecturally resolved.

---

# 19. HELP / BUSINESS DICTIONARY

Help is a global Business Dictionary, not merely KPI tooltips.

Canonical authority:

```text
Backend domain/query services
= business calculation authority

Shared typed Metric/Help Registry
= metric/status metadata authority

i18n
= localized presentation authority

Help UI
= consumer
```

Stable IDs use:

```text
{domain}.{metric}
```

Current implemented coverage:

```text
Requests
Orders
Bookings
Payments
```

Future areas must not be invented prematurely.

---

# 20. DEBT REGISTER — CURRENT GOVERNANCE

The Debt Register remains the canonical source for open/deferred debts.

Important known classes:

### Security
- SEC-UI-01 — CLOSED
- SEC-TENANT-01 — later/context-aware UI

### Data / semantic
- DATA-01 — KPI consistency
- DATA-02 — Marketplace vs Storefront financial metric separation

### Finance
- FIN-01..03 — DEFERRED

### Product
- PROD-01 — OPEN / DEFERRED

### Subscription
- SUB-01..06 — DEFERRED

### Agreement
- AGR-01 — DEFERRED

### Performance
- PERF-01 — LATER
- PERF-02 — LATER

Known validation debts such as malformed dates / invalid enums remain technical validation debt unless separately closed.

Do not invent new closure stages simply because an old prompt mentions one.

---

# 21. HISTORICAL DOCUMENT POLICY

The repository/Library may contain many historical:

```text
*_PROMPT.md
*_AUDIT*.md
*_QUALIFICATION*.md
*_RECONCILIATION*.md
```

They are **not competing roadmaps**.

Classification:

```text
MASTER ROADMAP
    ↓
current governance / sequence

REPORTS
    ↓
evidence of completed decisions

PROMPTS
    ↓
instructions for historical execution

RECONCILIATION REPORTS
    ↓
evidence that inconsistencies were resolved
```

Do not modify historical reports merely to make them look current.

---

# 22. TRUE NEXT RULE

After a major closure gate, especially UI-C18, the next stage must NOT be selected merely by numeric sequence.

Before starting any new implementation:

```text
TRUE NEXT REQUALIFICATION
```

must inspect:

1. current source;
2. current Git;
3. accepted stage history;
4. canonical architecture;
5. Debt Register;
6. dependencies;
7. open security/data/finance/product blockers;
8. D-track;
9. Finance track;
10. Product/Service Model;
11. any newer governance decisions.

The result must select exactly **one** TRUE NEXT.

Do not invent:

```text
UI-C19
```

unless a current canonical governance decision actually defines it.

---

# 23. CURRENT PROJECT STATE

At the end of UI-C18:

```text
Phase 3 implementation lineage
= GIT CLOSED

Commerce Center
= substantially implemented through the accepted C-track stages

Request
= canonical + server-authoritative

Order
= canonical + published UI migration

Booking
= canonical + published UI migration

Operations Center
= Requests / Orders / Bookings / Payments current

Help
= Business Dictionary current for implemented domains

RBAC
= final full matrix qualified

Finance Center
= NOT STARTED / DEFERRED

D8
= NOT STARTED

PROD-01
= OPEN / DEFERRED
```

---

# 24. NEXT ACTION

**✅ EXECUTED (2026-09-09 reconciliation).**

Required stage `PHASE 3 — TRUE NEXT REQUALIFICATION AFTER UI-C18` выполнена и принята: `docs/reports/PHASE_3_TRUE_NEXT_REQUALIFICATION_AFTER_UI_C18_REPORT.md` — VERDICT A, **TRUE NEXT = D8 — GLOBAL TEMPORAL VISIBILITY** (commit f41bd6a).

Historical text of this section (kept as history):

**Do not start implementation immediately.**

First perform:

```text
PHASE 3 — TRUE NEXT REQUALIFICATION AFTER UI-C18
```

The purpose is to identify exactly one next canonical stage from current repository truth.

Candidate classes to audit:

```text
1. remaining C-track stage, if one is actually canonical/open
2. D8
3. specific Finance Center prerequisite/stage, only if canonical and ready
4. PROD-01 design/model stage, only if prerequisites are now satisfied
5. another already-defined canonical stage
```

No new stage may be invented during this requalification.

---

# 25. MASTER ROADMAP STATUS

```text
┌─────────────────────────────────────────────────────────────┐
│ TRAVELHUB MASTER ROADMAP                                    │
├─────────────────────────────────────────────────────────────┤
│ Phase 3 accepted implementation = CLOSED                    │
│ UI-C17 RBAC = CLOSED                                        │
│ UI-C18 Git = CLOSED                                         │
│ Finance Center = NOT STARTED / DEFERRED                     │
│ D8  = CLOSED / APPROVED (2026-09-10, VERDICT A)             │
│ D9  = CLOSED / APPROVED (2026-09-10, VERDICT A)             │
│ D10 = CLOSED / APPROVED (79ef1fc, 2026-09-10)               │
│ D11 = CLOSED / APPROVED (0172fb4, 2026-09-10)               │
│ D12 = CLOSED / APPROVED (40e2f5b, 2026-09-10)               │
│ D13 = CLOSED / APPROVED (2616cc6, D13_VOUCHER tag)          │
│ D14 = CLOSED / APPROVED (D14 requalification, 2026-09-11)   │
│ STEP 3.12 = READY                                           │
│ PROD-01 = OPEN / DEFERRED                                   │
│ UI-DOC-ADMIN = PLANNED / TARGET TBD                         │
│ TRUE NEXT = STEP 3.12                                       │
└─────────────────────────────────────────────────────────────┘
```

---

# 26. GOVERNANCE PRINCIPLE

The project must maintain:

```text
ONE MASTER ROADMAP
        +
HISTORICAL EVIDENCE
        +
ONE TRUE-NEXT DECISION AT A TIME
```

Never create another roadmap merely because a qualification prompt or historical report contains an older sequence.

If the roadmap changes, update this Master Roadmap through an explicit governance decision and preserve the previous decision as history.

---

# 27. FINAL RULE

Before any new implementation prompt:

```text
CURRENT MASTER ROADMAP
        ↓
TRUE NEXT REQUALIFICATION
        ↓
AUDIT-FIRST
        ↓
APPROVAL
        ↓
IMPLEMENTATION
        ↓
QUALIFICATION
        ↓
GIT CLOSURE
        ↓
MASTER ROADMAP UPDATE
```

This is the canonical project workflow going forward.

---

# 28. CLOSURE SYNC RULE (MANDATORY)

**Closure Sync Rule:** A governed stage is not governance-complete until its accepted closure is reflected in the Master Roadmap. Every accepted closure MUST update, at minimum:

- stage status (CLOSED / APPROVED / VERDICT);
- closure evidence / SHA;
- current state / result;
- TRUE NEXT;
- blockers / dependencies;
- any newly registered debt items.

```text
closure evidence
    ≠
roadmap synchronization
```

Both are required. A stage is not fully closed until the canonical Master Roadmap has been synchronized with the accepted evidence.

This rule is mandatory for D14 and all subsequent governed stages.
