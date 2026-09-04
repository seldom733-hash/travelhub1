# TRAVELHUB — CANONICAL DEBT REGISTER

Established: 2026-09-04
Last updated: 2026-09-04

---

## Debt Classification Legend

| Category | Description |
|---|---|
| SECURITY | Authorization, isolation, data protection gaps |
| ARCHITECTURE | Structural coupling, god-service, missing abstractions |
| UX CONSISTENCY | UI fragmentation, missing components, visual drift |
| DATA/SEMANTIC | KPI semantics, status mapping, formula gaps |
| DOCUMENTATION/HELP | Missing help, business dictionary, user guidance |
| DEFERRED PRODUCT | Planned features awaiting business/technical prerequisites |
| PERFORMANCE | Load, concurrency, backlog gates |
| REGRESSION | Known test failures, flaky tests |

---

## PRIORITY ORDERING

```
NOW    — Blocking current phase or security-critical
NEXT   — Required before next major release
LATER  — Required before Phase 3 completion
DEFERRED — Future phase, awaiting prerequisites
```

---

## DEBT ITEMS

### SEC-UI-01 — Request Actions Server-Authority Gap

| Field | Value |
|---|---|
| ID | SEC-UI-01 |
| Title | Request actions are frontend-gated, not server-authoritative |
| Category | SECURITY |
| Severity | P1 |
| Origin | Commerce UI Design Reconciliation (2026-09-04) |
| Description | Request detail page computes available actions in frontend based on status, rather than consuming server-authoritative `availableActions` from API. This means action availability is not RBAC-checked and could be spoofed. |
| Why it matters | Security: frontend hiding ≠ authorization. A malicious user could invoke forbidden Request actions via direct API calls. |
| Canonical authority affected | D5/D6 pattern (server-authoritative actions) |
| Dependencies | Request controller must expose `availableActions` |
| Planned closure stage | UI-C7 (Request migration) |
| Status | OPEN |
| Acceptance condition | Request API returns `availableActions`; frontend consumes only this list |
| Closure SHA | — |
| Notes | Do not simply wrap frontend-derived actions in `<EntityActionBar />` |

---

### UI-01 — Unified Request/Order/Booking Detail Shell

| Field | Value |
|---|---|
| ID | UI-01 |
| Title | Three detail pages use inconsistent layout patterns |
| Category | UX CONSISTENCY |
| Severity | P2 |
| Origin | Commerce UI Design Reconciliation (2026-09-04) |
| Description | Request uses single-column max-w-5xl with custom statusColor/btn/TONES. Order/Booking use full-height flex-col with PageHeader/StatusBadge. No shared shell component. |
| Why it matters | User confusion when switching between entity types. Inconsistent spacing, typography, card styling. |
| Dependencies | None |
| Planned closure stage | UI-C1 |
| Status | OPEN |
| Acceptance condition | All 3 detail pages use same canonical shell layout |
| Closure SHA | — |
| Notes | Request is the outlier — needs PageHeader, StatusBadge, breadcrumbs |

---

### UI-02 — Unified Header with Breadcrumbs

| Field | Value |
|---|---|
| ID | UI-02 |
| Title | Request lacks PageHeader/breadcrumbs |
| Category | UX CONSISTENCY |
| Severity | P2 |
| Origin | Commerce UI Design Reconciliation (2026-09-04) |
| Description | Request uses raw `h1` + manual back button. Order/Booking use `<PageHeader>` with 3-level breadcrumbs. |
| Dependencies | UI-01 |
| Planned closure stage | UI-C1 |
| Status | OPEN |
| Acceptance condition | All 3 pages use PageHeader with TravelHub / Registry / Reference breadcrumbs |
| Closure SHA | — |

---

### UI-03 — Unified Status/Payment/Refund Visual Language

| Field | Value |
|---|---|
| ID | UI-03 |
| Title | Request uses custom statusColor() instead of StatusBadge |
| Category | UX CONSISTENCY |
| Severity | P2 |
| Origin | Commerce UI Design Reconciliation (2026-09-04) |
| Description | Request has hardcoded Tailwind status classes in `statusColor()`. Order/Booking use `<StatusBadge>` component. |
| Dependencies | None |
| Planned closure stage | UI-C1 |
| Status | OPEN |
| Acceptance condition | All entities use StatusBadge with consistent visual contract |
| Closure SHA | — |

---

### UI-04 — Unified Business Timeline

| Field | Value |
|---|---|
| ID | UI-04 |
| Title | Business Timeline not separated from Audit on Order |
| Category | UX CONSISTENCY |
| Severity | P2 |
| Origin | Commerce UI Design Reconciliation (2026-09-04) |
| Description | Order merges milestones into lifecycle audit history. Booking correctly separates ХРОНОЛОГИЯ from ИСТОРИЯ ИЗМЕНЕНИЙ. Request has optional timeline. |
| Dependencies | None |
| Planned closure stage | UI-C3 |
| Status | OPEN |
| Acceptance condition | All 3 pages have separate Business Timeline + Audit History |
| Closure SHA | — |

---

### UI-05 — Unified Audit History

| Field | Value |
|---|---|
| ID | UI-05 |
| Title | Request lacks audit history section |
| Category | UX CONSISTENCY |
| Severity | P3 |
| Origin | Commerce UI Design Reconciliation (2026-09-04) |
| Description | Request has no audit/change history. Order/Booking have lifecycle audit sections. |
| Dependencies | None |
| Planned closure stage | UI-C4 |
| Status | OPEN |
| Acceptance condition | All 3 pages display immutable audit history |
| Closure SHA | — |

---

### UI-06 — Commerce Relation Chain

| Field | Value |
|---|---|
| ID | UI-06 |
| Title | No visual Request→Order→Booking chain component |
| Category | UX CONSISTENCY |
| Severity | P2 |
| Origin | Commerce UI Design Reconciliation (2026-09-04) |
| Description | Request has inline purple card. Order has inline links. Booking has order link. No unified `<CommerceRelationChain />` component. |
| Dependencies | None |
| Planned closure stage | UI-C2 |
| Status | OPEN |
| Acceptance condition | All 3 pages show server-authoritative Request→Order→Booking chain |
| Closure SHA | — |

---

### UI-07 — Orders KPI Semantic Reconciliation

| Field | Value |
|---|---|
| ID | UI-07 |
| Title | Orders KPI overlap/missing states |
| Category | DATA/SEMANTIC |
| Severity | P2 |
| Origin | Commerce UI Design Reconciliation (2026-09-04) |
| Description | "Активные" (5 states) includes "Готовы к бронированию" (1 state) — overlap. PARTIALLY_FULFILLED, FULFILLED, READY_FOR_CLOSURE, PROBLEM, SUSPENDED not represented in KPI cards. |
| Dependencies | None |
| Planned closure stage | UI-C10 |
| Status | OPEN |
| Acceptance condition | KPI overlap documented, missing states classified (separate KPI / filter-only / excluded) |
| Closure SHA | — |

---

### UI-08 — Bookings KPI Restoration/Reconciliation

| Field | Value |
|---|---|
| ID | UI-08 |
| Title | Bookings KPI groups semantically different stages |
| Category | DATA/SEMANTIC |
| Severity | P2 |
| Origin | Commerce UI Design Reconciliation (2026-09-04) |
| Description | CONFIRMED + IN_SERVICE + COMPLETED grouped as "Подтверждено". Different lifecycle stages with different operational meaning. |
| Dependencies | None |
| Planned closure stage | UI-C11 |
| Status | OPEN |
| Acceptance condition | KPI grouping reconciled with actual lifecycle semantics |
| Closure SHA | — |

---

### UI-09 — Unified Cards/Spacing/Typography/Responsive

| Field | Value |
|---|---|
| ID | UI-09 |
| Title | Inconsistent card classes, spacing, typography across pages |
| Category | UX CONSISTENCY |
| Severity | P3 |
| Origin | Commerce UI Design Reconciliation (2026-09-04) |
| Description | Request uses text-sm/text-xs mix. Order/Booking use text-xs. Card borders/padding inconsistent. |
| Dependencies | UI-01 |
| Planned closure stage | UI-C13 |
| Status | OPEN |
| Acceptance condition | Unified card/spacing/typography system across all 3 pages |
| Closure SHA | — |

---

### HELP-01 — Left Menu Help Entry

| Field | Value |
|---|---|
| ID | HELP-01 |
| Title | No Help entry in left navigation |
| Category | DOCUMENTATION/HELP |
| Severity | P2 |
| Origin | Help Architecture Addendum (2026-09-04) |
| Description | Left menu has Поддержка but no Помощь (Help) entry. Users cannot discover business dictionary or contextual help. |
| Dependencies | HELP-02 |
| Planned closure stage | UI-C12 |
| Status | OPEN |
| Acceptance condition | `/app/help` route accessible from left navigation under СЕРВИС |
| Closure SHA | — |

---

### HELP-02 — /app/help Business Dictionary

| Field | Value |
|---|---|
| ID | HELP-02 |
| Title | No Help Center / Business Dictionary page |
| Category | DOCUMENTATION/HELP |
| Severity | P2 |
| Origin | Help Architecture Addendum (2026-09-04) |
| Description | No `/app/help` page exists. No business dictionary, status definitions, KPI explanations, or formula documentation. |
| Dependencies | None |
| Planned closure stage | UI-C12 |
| Status | OPEN |
| Acceptance condition | `/app/help` renders with categorized business dictionary entries |
| Closure SHA | — |

---

### HELP-03 — KPI Contextual Help (ⓘ)

| Field | Value |
|---|---|
| ID | HELP-03 |
| Title | KPI cards lack contextual help tooltips |
| Category | DOCUMENTATION/HELP |
| Severity | P3 |
| Origin | Help Architecture Addendum (2026-09-04) |
| Description | KPI cards on Orders/Bookings/Command Center have no ⓘ tooltip explaining meaning, formula, or period semantics. |
| Dependencies | HELP-02 |
| Planned closure stage | UI-C3 |
| Status | OPEN |
| Acceptance condition | Every KPI card has contextual tooltip with definition + formula + link to full help |
| Closure SHA | — |

---

### HELP-04 — Status Dictionary

| Field | Value |
|---|---|
| ID | HELP-04 |
| Title | No documented status definitions for Lifecycle/Payment/Refund |
| Category | DOCUMENTATION/HELP |
| Severity | P3 |
| Origin | Help Architecture Addendum (2026-09-04) |
| Description | Users cannot look up what each status means, when it's entered, what actions are available, or what the financial implications are. |
| Dependencies | HELP-02 |
| Planned closure stage | UI-C12 |
| Status | OPEN |
| Acceptance condition | All Lifecycle/Payment/Refund statuses documented with transitions and financial implications |
| Closure SHA | — |

---

### HELP-05 — Formula Drift Prevention

| Field | Value |
|---|---|
| ID | HELP-05 |
| Title | Help formulas may drift from backend calculations |
| Category | DOCUMENTATION/HELP |
| Severity | P3 |
| Origin | Help Architecture Addendum (2026-09-04) |
| Description | If Help text documents formulas independently from backend code, they can diverge over time. No reconciliation mechanism exists. |
| Dependencies | HELP-02 |
| Planned closure stage | UI-C12 |
| Status | OPEN |
| Acceptance condition | Stable metric IDs link Help definitions to backend calculations; automated contract test or review gate |
| Closure SHA | — |

---

### HELP-06 — Workspace-Aware Help

| Field | Value |
|---|---|
| ID | HELP-06 |
| Title | Help content not differentiated by Platform/Partner workspace |
| Category | DOCUMENTATION/HELP |
| Severity | P3 |
| Origin | Help Architecture Addendum (2026-09-04) |
| Description | Platform-only operational docs could be visible to Partners. Entitlement-specific features shown as if universally available. |
| Dependencies | HELP-02 |
| Planned closure stage | UI-C12 |
| Status | OPEN |
| Acceptance condition | Help navigation reflects available capabilities per workspace/entitlement |
| Closure SHA | — |

---

### DATA-01 — Canonical KPI Read-Model Consistency

| Field | Value |
|---|---|
| ID | DATA-01 |
| Title | KPI counts may not reconcile with registry filters |
| Category | DATA/SEMANTIC |
| Severity | P2 |
| Origin | Commerce UI Design Reconciliation (2026-09-04) |
| Description | KPI aggregate counts must use the same canonical server-side filters as the registry. Currently unverified that clickable KPI → deterministic filter produces identical count. |
| Dependencies | UI-07, UI-08 |
| Planned closure stage | UI-C10, UI-C11 |
| Status | OPEN |
| Acceptance condition | Every KPI count reconciles with the same filter applied to the registry |
| Closure SHA | — |

---

### FIN-01 — Full Finance Center

| Field | Value |
|---|---|
| ID | FIN-01 |
| Title | No dedicated Finance Center / Finance Dashboard |
| Category | DEFERRED PRODUCT |
| Severity | P3 |
| Origin | D7 (2026-09-04) |
| Description | D7 implemented financial presentation on Order/Booking detail, but no standalone Finance Center with aggregate financial views, reconciliation, or reporting. |
| Dependencies | FIN-02 (provider integration) |
| Planned closure stage | DEFERRED — future phase |
| Status | DEFERRED |
| Acceptance condition | Finance Center with payment/refund aggregation, reconciliation, export |
| Closure SHA | — |

---

### FIN-02 — Payment Provider/Webhook Integration

| Field | Value |
|---|---|
| ID | FIN-02 |
| Title | No real PSP webhook/production payment integration |
| Category | DEFERRED PRODUCT |
| Severity | P1 |
| Origin | D7 + Roadmap (Step 2.12B blocked) |
| Description | Payment status is managed manually (ADMIN confirms/fails). No Stripe/PSP webhook integration. Blocked on ADR-0015 provider selection + AZ acquiring commercial agreement. |
| Dependencies | ADR-0015 accepted, merchant onboarding, provider API docs |
| Planned closure stage | DEFERRED — Step 2.12B |
| Status | DEFERRED |
| Acceptance condition | Real PSP webhook processes payment status transitions |
| Closure SHA | — |

---

### FIN-03 — Payout Implementation

| Field | Value |
|---|---|
| ID | FIN-03 |
| Title | No partner payout execution |
| Category | DEFERRED PRODUCT |
| Severity | P3 |
| Origin | Roadmap (Step 2.10B foundation exists, execution deferred) |
| Description | `finance.Payout` schema exists but no real payout execution. Depends on PSP integration. |
| Dependencies | FIN-02 |
| Planned closure stage | DEFERRED |
| Status | DEFERRED |
| Acceptance condition | Partner payout executed via provider |
| Closure SHA | — |

---

### SUB-01 — Storefront Subscription Implementation

| Field | Value |
|---|---|
| ID | SUB-01 |
| Title | Storefront partner subscription/plan not implemented |
| Category | DEFERRED PRODUCT |
| Severity | P2 |
| Origin | Roadmap (Step 3.5D entitlement model exists, runtime deferred) |
| Description | `PartnerStorefront.entitlementStatus` and `getCrmTier()` exist but no subscription selection, payment, or enforcement UI. |
| Dependencies | FIN-02 (payment), SUB-04 (onboarding page) |
| Planned closure stage | DEFERRED |
| Status | DEFERRED |
| Acceptance condition | Partner can select/subscribe to Storefront plan |
| Closure SHA | — |

---

### SUB-02 — Host-Count Subscription Variants

| Field | Value |
|---|---|
| ID | SUB-02 |
| Title | Subscription pricing depends on number of hosts |
| Category | DEFERRED PRODUCT |
| Severity | P3 |
| Origin | Storefront future scope (2026-09-04) |
| Description | Subscription variants should depend on number of hosts. Pricing model not yet defined. |
| Dependencies | SUB-01 |
| Planned closure stage | DEFERRED |
| Status | DEFERRED |
| Acceptance condition | Host-count-based subscription pricing operational |
| Closure SHA | — |

---

### SUB-03 — Single Simultaneous Host Login

| Field | Value |
|---|---|
| ID | SUB-03 |
| Title | One simultaneous host login per shared credentials |
| Category | DEFERRED PRODUCT |
| Severity | P3 |
| Origin | Storefront future scope (2026-09-04) |
| Description | Second login should invalidate first active session for shared Storefront credentials. |
| Dependencies | SUB-01 |
| Planned closure stage | DEFERRED |
| Status | DEFERRED |
| Acceptance condition | Concurrent login enforcement operational |
| Closure SHA | — |

---

### SEC-TENANT-01 — Platform/Partner Context-Aware UI

| Field | Value |
|---|---|
| ID | SEC-TENANT-01 |
| Title | UI navigation/modules not fully context-aware for Platform vs Partner |
| Category | SECURITY |
| Severity | P2 |
| Origin | Commerce UI Design Reconciliation (2026-09-04) |
| Description | Left menu and available modules should reflect workspace context (Platform vs Partner) and entitlements (Basic vs Pro). Currently not fully differentiated. |
| Dependencies | SUB-01 |
| Planned closure stage | LATER |
| Status | OPEN |
| Acceptance condition | Menu/modules reflect actual workspace + entitlement scope |
| Closure SHA | — |

---

### PERF-01 — EventBus Backlog Gate

| Field | Value |
|---|---|
| ID | PERF-01 |
| Title | EventBus max backlog > 100 during steady load |
| Category | PERFORMANCE |
| Severity | P2 |
| Origin | Step 2.17B Final Re-qualification Round 2 (2026-08-17) |
| Description | Under 100 ev/s steady load, EventBus max backlog reaches 171-178 (target ≤100). Oldest PENDING within 10s target. Backlog converges to 0 after generation stops. |
| Dependencies | None |
| Planned closure stage | LATER (Performance Remediation) |
| Status | OPEN |
| Acceptance condition | Max backlog ≤ 100 under 100 ev/s sustained load |
| Closure SHA | — |
| Notes | 0 production EventBus changes. Root cause not yet proven. |

---

### PERF-02 — Booking Burst 20 Chains/s Incomplete

| Field | Value |
|---|---|
| ID | PERF-02 |
| Title | Booking/Order chain burst at 20 chains/s only 34% complete |
| Category | PERFORMANCE |
| Severity | P2 |
| Origin | Step 2.17B Final Re-qualification Round 2 (2026-08-17) |
| Description | At concurrency 50, burst 20 chains/s started only 103/300. Root cause unknown. |
| Dependencies | None |
| Planned closure stage | LATER (Performance Remediation) |
| Status | OPEN |
| Acceptance condition | Burst 20 chains/s completes ≥95% at concurrency 50 |
| Closure SHA | — |
| Notes | 0 production query/index/pool tuning |

---
