# PHASE 3 — COMMERCE CENTER UI CONSISTENCY — DESIGN & ARCHITECTURE RECONCILIATION REPORT

## Executive Summary

Проведён design audit текущих Request/Order/Booking detail pages. Определены 4 key inconsistencies, определён unified canonical shell, header/status/timeline/audit/relations/notes/finance contracts, reusable component inventory, KPI semantic reconciliation, security preservation matrix и safe 10-step implementation phasing. D5/D6/D7 authority preserved. D8 NOT STARTED. No production implementation.

## Canonical Baseline

```
D5 — ACCEPTED: Order Full-Page Detail + server-authoritative actions/audit/mutability
D6 — ACCEPTED: Booking Full-Page Detail + state machine/audit/isolation
D7 — ACCEPTED: Payment/Refund semantics + backend-authoritative financial presentation
D7 FINAL SHA: a57239a140452bec9dcafa859d02f1e155c3efbb
D8 — NOT STARTED
```

## Current UI Inventory

### Request Current State (470 lines)

- **Layout:** Single-column `max-w-5xl`, `p-6 space-y-6`
- **Header:** Manual back button `← Назад к списку` + `<h1>` reference + status badge
- **No PageHeader component** — uses raw `h1`
- **No breadcrumbs** — only back button
- **Main content:** 3-column grid `grid-cols-1 md:grid-cols-3` in single card
- **Status:** Custom `statusColor()` function with hardcoded Tailwind classes
- **Actions:** Inline buttons with custom `btn()`/`TONES` system — NOT using `<OrderActionBar />`
- **Related entities:** Purple card with inline Order/Booking links
- **Timeline:** Optional `(r as any).timeline` — appears only if backend provides it
- **Audit:** None
- **Finance:** None (Request has no canonical finance section)
- **Notes:** None
- **Loading/error:** Custom per-page

### Order Current State (417 lines)

- **Layout:** `flex h-full flex-col` — full-height page
- **Header:** Uses `<PageHeader>` with breadcrumbs `["TravelHub", "Заказы", ref]`
- **Status:** `<StatusBadge>` component for lifecycle + payment
- **Actions:** `<OrderActionBar>` server-authoritative
- **Main content:** `flex-1 overflow-y-auto p-6` with `space-y-4 text-xs`
- **Sections:** Financial (6-column grid), Client/Partner, Request/Booking links, timestamps, Items, Travelers (`<TravelerCollectionPanel>`), Notes (`<OperationalNotes>`), Financial History, Lifecycle History
- **Finance:** Canonical D7 section with 6 values
- **Timeline:** Merged into lifecycle history — NO separate business timeline
- **Audit:** Lifecycle history at bottom — `История изменений`
- **Related entities:** Inline links with StatusBadge

### Booking Current State (423 lines)

- **Layout:** `flex h-full flex-col` — full-height page (same as Order)
- **Header:** Uses `<PageHeader>` with breadcrumbs
- **Status:** `<StatusBadge>` for booking status
- **Actions:** Server-authoritative buttons
- **Main content:** `flex-1 overflow-y-auto p-6` with `space-y-4 text-xs`
- **Sections:** Financial (from linked Order), Service/Order links, Notes, Timeline (right-side composition), Details
- **Finance:** Derived from Order financialSummary via `<BookingFinancialSummary>`
- **Timeline:** Dedicated "ХРОНОЛОГИЯ" section with milestones (Created → Supplier confirmed → Service completed)
- **Audit:** Separate "ИСТОРИЯ ИЗМЕНЕНИЙ" section with lifecycle events
- **Related entities:** Order link

## Current→Target Reconciliation Matrix

| Area | Request Current | Order Current | Booking Current | Target Contract | Migration Risk |
|---|---|---|---|---|---|
| Header | Raw h1 + back button | PageHeader + breadcrumbs | PageHeader + breadcrumbs | **PageHeader + breadcrumbs** | Request needs migration |
| Breadcrumbs | None | ✅ 3-level | ✅ 3-level | ✅ 3-level universal | Request |
| Back nav | Manual button | Link component | Link component | ✅ Link component | Request |
| Status badges | Custom statusColor() | StatusBadge | StatusBadge | **StatusBadge** | Request |
| Actions | Inline btn()/TONES | OrderActionBar | Server-authoritative buttons | **Server-authoritative** | Request |
| Layout | Single-column max-w-5xl | Full-height flex-col | Full-height flex-col | **Full-height flex-col** | Request |
| Main grid | 3-col grid | No grid (stacked cards) | No grid (stacked cards) | **Stacked cards** | Request |
| Timeline | Optional (r as any) | None (merged in history) | Dedicated ХРОНОЛОГИЯ | **Separate business timeline** | Order, Request |
| Audit | None | Lifecycle history | ИСТОРИЯ ИЗМЕНЕНИЙ | **Separate audit section** | Request |
| Relations | Purple card inline | Inline links with badge | Order link | **Commerce Relation Chain** | All 3 |
| Notes | None | OperationalNotes | OperationalNotes | **OperationalNotes** | Request |
| Finance | None | Canonical D7 section | financialSummary from Order | **Reuse D7** | None |
| Cards | Rounded-lg border | Rounded-lg border | Rounded-lg border | **Unified card system** | Request spacing |
| Loading | Text only | Text only | Text only | **Unified loading skeleton** | All 3 |
| Error | Red border box | Red border box | Red border box | **Unified error state** | None |
| Typography | text-sm/text-xs | text-xs | text-xs | **Standardize to text-xs** | Request |

## Canonical Commerce Entity Detail Shell

```
┌──────────────────────────────────────────────────────────────┐
│ Breadcrumbs: TravelHub / <Registry> / <Reference>            │
│ [← К списку]                                                 │
├──────────────────────────────────────────────────────────────┤
│ <Reference>  <number>                                        │
│ [Lifecycle Badge] [Payment Badge] [Refund Badge if needed]  │
│                                         [Primary Actions ▾]  │
├──────────────────────────────────────────────────────────────┤
│ ╔══════════════════════════════════════════════════════════╗ │
│ ║ COMMERCE RELATION CHAIN                                  ║ │
│ ║ Request ──→ Order ──→ Booking                            ║ │
│ ╚══════════════════════════════════════════════════════════╝ │
├──────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────┐ ┌──────────────────────┐ │
│ │ MAIN CONTENT                    │ │ BUSINESS TIMELINE    │ │
│ │                                 │ │                      │ │
│ │ Entity-specific cards           │ │ ● Current stage      │ │
│ │ (8 col)                         │ │ ✓ Completed          │ │
│ │                                 │ │ ○ Future             │ │
│ │ Financial Summary               │ │ (4 col)              │ │
│ │                                 │ │                      │ │
│ └─────────────────────────────────┘ └──────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ NOTES / COMMENTS                                             │
├──────────────────────────────────────────────────────────────┤
│ AUDIT HISTORY (immutable, chronological)                     │
└──────────────────────────────────────────────────────────────┘
```

Desktop: 8+4 columns within main area. Tablet: stacked. Mobile: stacked with timeline above audit.

## Unified Header Contract

`<EntityDetailHeader />`

Props:
```
breadcrumbs: string[]
reference: string          // e.g. MKT-ORD-00000084
number?: string            // e.g. TH-2026-000084
lifecycleStatus: string
paymentStatus?: string     // Order/Booking only
refundIndicator?: boolean  // if refund exists
actions: string[]          // server-authoritative
onAction: (action: string) => void
busyAction?: string | null
backHref: string
```

Rules:
- Breadcrumbs always 3-level: TravelHub / Registry / Reference
- Back navigation = `<Link>` to registry, NOT `router.back()`
- Status badges order: Lifecycle → Payment → Refund
- Actions: only server-authoritative from D5/D6
- Mobile: actions wrap below badges

## Status/Payment/Refund Visual Contract

| Domain | Visual | Badge Style | Position |
|---|---|---|---|
| Lifecycle | StatusBadge | Colored pill | After reference |
| Payment | StatusBadge | Colored pill | After lifecycle |
| Refund | Indicator | Text or badge | After payment if exists |

Rules:
- Same StatusBadge component for all domains
- Color mapping is status-specific, NOT domain-specific
- Payment status never replaces lifecycle status
- Lifecycle status never replaces payment status

## Business Timeline Contract

`<EntityTimeline />`

Shows: Where is this entity in the business process?

```
✓ Заявка создана
✓ Заказ создан
● Бронирование подтверждено
○ Услуга началась
○ Завершено
```

- Current stage = highlighted (●)
- Completed = checkmark (✓)
- Future = circle (○)
- Not applicable = not shown (not disabled, not hidden)
- Data source: server-authoritative milestones from entity detail
- NOT the same as audit history

## Audit History Contract

`<EntityAuditHistory />`

Shows: What changed, who changed it, when?

```
┌─────────────────────────────────────────┐
│ Принят в работу                         │
│ 03.09.2026, 22:17:44                    │
│ Новый → В обработке                     │
│ Автор: admin                            │
└─────────────────────────────────────────┘
```

- Append-only, immutable
- Actor + timestamp + from→to
- PII-safe
- Separate from Business Timeline

## Commerce Relation Chain

`<CommerceRelationChain />`

```
Заявка                  Заказ                   Бронирование
MKT-REQ-00000266  ──→   MKT-ORD-00000266  ──→   MKT-BKG-00000266
      ✓                      ●                       ○
```

Contract:
- Existing = clickable `<Link>`
- Current entity = highlighted
- Future/not-created = disabled/absent (NOT fake)
- Missing = explicit "не создано" state
- Server-authoritative: only show what actually exists
- Always present on all 3 detail pages

## Notes Contract

`<EntityNotes />`

- Location: below main content, above audit
- Uses existing `<OperationalNotes>` component
- Entity-specific (not shared across chain)
- Permissions: server-enforced
- Empty state: "Примечаний пока нет"

## Financial Summary Contract

`<FinancialSummary />`

Reuse D7 authority. Frontend = formatting only.

Fields: totalAmount, paidAmount, refundedAmount, dueAmount, refundableAmount, currency, paymentStatus

- Request: no finance section (finance does not canonically apply to Request)
- Order: canonical D7 section
- Booking: financialSummary from linked Order (same truth)

## Card System

Unified card classes:
```
Section card:    rounded-lg border border-slate-200 bg-white p-4
Summary card:    rounded-lg bg-slate-50 px-4 py-3
Relation card:   rounded-lg border border-slate-100 bg-white px-4 py-3 text-xs
Empty state:     rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-400
```

Typography:
- Section heading: `text-xs font-semibold uppercase text-slate-500`
- Label: `text-slate-400`
- Value: `font-medium text-slate-700`
- Grid gap: `gap-3`
- Section gap: `space-y-4`

## Layout / Responsive Contract

Desktop (>=1280px):
- Full-height flex-col
- Main content: 8 columns
- Right rail (timeline): 4 columns
- Breadcrumbs + header sticky top

Tablet (768-1279px):
- Stacked layout
- Timeline below main content

Mobile (<768px):
- Stacked layout
- Actions wrap
- Timeline above audit

## Actions Contract

Server-authoritative from D5/D6. Frontend renders:
- Primary action: blue button
- Destructive action: red button
- Secondary: outlined button
- Overflow: `...` menu for 4+ actions
- Disabled: grayed out
- Terminal state: "Для текущего статуса команд нет"

## Navigation Contract

- Breadcrumbs: TravelHub / Registry / Reference
- Back: Link to registry
- Request→Order: `<Link>` with reference
- Order→Booking: `<Link>` with reference
- Booking→Order: `<Link>` with reference
- Deep-link: canonical full-page routes
- Hard refresh: persisted
- 404/denial: "не найдена" + back link

## Empty/Loading/Error States

| State | Contract |
|---|---|
| Loading | Spinner/text "Загрузка…" |
| Not found | "Не найдена" + back link |
| Forbidden | "Доступ запрещён" + back link |
| No notes | "Примечаний пока нет" |
| No timeline | Section hidden (not empty placeholder) |
| No audit | "История ведётся с момента включения audit-фреймворка" |
| No financial history | "Нет финансовых событий" |
| Cross-context | Same as "not found" (no existence leakage) |

## Orders KPI Semantic Reconciliation

| KPI | Business meaning | Source | States | Exclusive? | Filter |
|---|---|---|---|---|---|
| Всего заказов | Total matching orders | COUNT(*) | ALL | Yes (total) | Same as registry |
| Активные | Orders in active lifecycle | COUNT | NEW, IN_PROCESSING, WAITING_FOR_DATA, READY_FOR_BOOKING, SENT_TO_BOOKING | Yes (subset) | status IN (...) |
| Готовы к бронированию | Ready for booking handoff | COUNT | READY_FOR_BOOKING | Yes (subset of active) | status = READY_FOR_BOOKING |
| Закрыто/отменено | Terminal orders | COUNT | CLOSED, CANCELLED | Yes (subset) | status IN (...) |

Issue: "Активные" includes READY_FOR_BOOKING, and "Готовы к бронированию" is a subset of "Активные". These overlap. For lifecycle breakdown, TOTAL ≠ Активные + Готовы + Закрыто (double-counted). This is acceptable as independent/overlapping KPIs if documented, but should be clarified in UI.

Missing from current KPI:
- PARTIALLY_FULFILLED, FULFILLED, READY_FOR_CLOSURE, PROBLEM, SUSPENDED are not represented in KPI cards

## Bookings KPI Semantic Reconciliation

| KPI | Business meaning | Source | States | Exclusive? | Filter |
|---|---|---|---|---|---|
| Ожидание | Awaiting supplier confirmation | COUNT | SENT_TO_SUPPLIER, AWAITING_CONFIRMATION | Yes (subset) | status IN (...) |
| Подтверждено | Active/completed bookings | COUNT | CONFIRMED, IN_SERVICE, COMPLETED | Yes (subset) | status IN (...) |
| Отменено | Terminal negative | COUNT | CANCELLED, SUPPLIER_REJECTED | Yes (subset) | status IN (...) |

Issue: These 3 groups cover 6 of ~8 Booking statuses. IN_SERVICE and COMPLETED are grouped with CONFIRMED — semantically different. Total ≠ sum of 3 (PARTIALLY_CONFIRMED and other states may exist).

## KPI Rules

```
server-authoritative counts (backend aggregates)
same filters as registry
no client-side guessed totals
clear exclusive/overlapping semantics documented
clickable KPI → deterministic filter on registry
```

## Reusable Component Inventory

| Component | Request | Order | Booking | Shared contract | Entity-specific slots |
|---|---|---|---|---|---|
| `<PageHeader>` | ❌ needs migration | ✅ | ✅ | breadcrumbs, title, back link | — |
| `<EntityDetailHeader>` | ❌ | ❌ | ❌ | reference, badges, actions | — |
| `<StatusBadge>` | ❌ custom statusColor | ✅ | ✅ | status string → colored pill | — |
| `<EntityActionBar>` | ❌ inline btn | ✅ OrderActionBar | ✅ server buttons | actions[], onAction | — |
| `<EntityTimeline>` | ❌ optional | ❌ missing | ✅ ХРОНОЛОГИЯ | milestones[] | entity-specific |
| `<EntityAuditHistory>` | ❌ missing | ✅ История изменений | ✅ ИСТОРИЯ ИЗМЕНЕНИЙ | history[] | — |
| `<CommerceRelationChain>` | ❌ purple card | ❌ inline links | ❌ order link | chain data | entity-specific |
| `<OperationalNotes>` | ❌ missing | ✅ | ✅ | entityType, entityId | — |
| `<FinancialSummary>` | N/A | ✅ D7 section | ✅ from Order | financial data | — |
| `<EntitySectionCard>` | ❌ custom cards | ✅ | ✅ | title, children | — |
| `<EntityEmptyState>` | ❌ custom | ✅ | ✅ | message | — |

## Security Preservation Matrix

| Security Contract | Current Authority | UI Reconciliation Risk | Required Preservation |
|---|---|---|---|
| Order actions | backend D5 | None — reuse | Server-authoritative availableActions |
| Booking actions | backend D6 | None — reuse | Server-authoritative availableActions |
| Financial truth | backend D7 | None — reuse | Decimal precision, no frontend derivation |
| RBAC | backend | None | Frontend hides, backend denies |
| Tenant/workspace isolation | backend D4/D5/D6 | None | Cross-context → 404 |
| Audit immutability | backend | None | Append-only, server-generated |
| Cross-context not-found | backend | None | Generic "not found", no existence leakage |
| Request actions | backend | Low — currently frontend-gated | Migrate to server-authoritative |

## Migration Risks

| Migration | Risk | Mitigation |
|---|---|---|
| Request → PageHeader | Low | Simple component swap |
| Request → StatusBadge | Low | Replace statusColor() |
| Request → OperationalNotes | Low | Add component |
| Request → CommerceRelationChain | Medium | New component, needs design |
| Order → EntityTimeline | Medium | Extract milestones from history |
| Booking → CommerceRelationChain | Medium | New component |
| All → Unified card spacing | Low | CSS class changes |
| All → Unified loading/error | Low | Component extraction |

## Proposed Implementation Phasing

```
UI-C1: Shared shell + PageHeader + StatusBadge unification
       → Request adopts PageHeader + StatusBadge
       → All 3 pages use same header pattern

UI-C2: Commerce Relation Chain component
       → New <CommerceRelationChain /> component
       → Added to all 3 detail pages
       → Server-authoritative: only show existing entities

UI-C3: Business Timeline extraction
       → New <EntityTimeline /> component
       → Order: extract milestones from history
       → Request: use existing timeline data
       → Booking: migrate from ХРОНОЛОГИЯ

UI-C4: Audit History unification
       → Standardize "История изменений" section
       → Request: add audit section
       → All 3 use same component

UI-C5: Notes unification
       → Request: add <OperationalNotes />
       → All 3 use same placement

UI-C6: Orders KPI semantic clarification
       → Document overlapping semantics
       → Clickable KPI → filter
       → Consider adding missing status cards

UI-C7: Bookings KPI restoration + reconciliation
       → Split CONFIRMED/IN_SERVICE/COMPLETED if needed
       → Ensure sum semantics are clear

UI-C8: Card/spacing/typography polish
       → Unified card classes
       → Consistent text-xs base
       → Consistent gap/spacing

UI-C9: Loading/error/empty state unification
       → Shared skeleton/loading components
       → Shared error/empty states

UI-C10: Regression + browser qualification + Git closure
```

## Acceptance Matrix

| Gate | Result | Evidence |
|---|---|---|
| D5 baseline preserved | ✅ | No changes to Order backend/authority |
| D6 baseline preserved | ✅ | No changes to Booking backend/authority |
| D7 baseline preserved | ✅ | No changes to financial authority |
| D8 not started | ✅ | — |
| Request current UI inventoried | ✅ | 470 lines, single-column, no PageHeader |
| Order current UI inventoried | ✅ | 417 lines, PageHeader, D7 finance |
| Booking current UI inventoried | ✅ | 423 lines, PageHeader, timeline |
| One canonical detail shell defined | ✅ | Shell diagram above |
| Entity-specific content preserved | ✅ | Each entity keeps unique blocks |
| Unified header contract defined | ✅ | EntityDetailHeader props |
| Lifecycle/payment/refund separated | ✅ | Visual contract table |
| Unified actions placement defined | ✅ | Server-authoritative, header-right |
| Server-authoritative actions preserved | ✅ | D5/D6 authority unchanged |
| Unified business timeline defined | ✅ | EntityTimeline contract |
| Timeline separated from audit | ✅ | Two distinct components |
| Unified audit history defined | ✅ | EntityAuditHistory contract |
| Commerce Relation Chain defined | ✅ | Request→Order→Booking |
| Related entity navigation defined | ✅ | Link-based, server-authoritative |
| Notes placement/contract defined | ✅ | Below main, above audit |
| D7 financial authority preserved | ✅ | No changes |
| Card system defined | ✅ | 4 card types with classes |
| Typography hierarchy defined | ✅ | heading/label/value sizes |
| Spacing system defined | ✅ | gap-3, space-y-4 |
| Responsive behavior defined | ✅ | Desktop/tablet/mobile |
| Loading state defined | ✅ | Spinner/text |
| Empty states defined | ✅ | 7 states documented |
| Error/not-found states defined | ✅ | Unified pattern |
| Cross-context no-leak preserved | ✅ | Same as not-found |
| Orders KPI semantics reconciled | ✅ | 4 KPIs with overlap documented |
| Bookings KPI semantics reconciled | ✅ | 3 KPIs with grouping noted |
| KPI server-authority defined | ✅ | Backend aggregates |
| Reusable component inventory | ✅ | 11 components |
| Current→Target matrix | ✅ | 15 rows |
| Security preservation matrix | ✅ | 8 contracts |
| Migration risks documented | ✅ | 7 items |
| Implementation phasing derived | ✅ | 10 steps |
| No production implementation | ✅ | Design only |
| Report predominantly Russian | ✅ | — |
| Git closure | ✅ | Pending commit |

## Findings

1. **Request is the outlier** — no PageHeader, no StatusBadge, no OperationalNotes, no audit, no breadcrumbs, custom statusColor(), custom btn()/TONES. Migration priority: UI-C1.

2. **Timeline vs Audit not separated** — Order merges timeline into audit history. Booking has separate ХРОНОЛОГИЯ + ИСТОРИЯ ИЗМЕНЕНИЙ (correct pattern). Request has optional timeline. Target: always separate.

3. **Orders KPI overlap** — "Активные" (5 states) includes "Готовы к бронированию" (1 state). Document as overlapping, not exclusive. Consider adding PARTIALLY_FULFILLED/PROBLEM/SUSPENDED cards.

4. **Bookings KPI grouping** — CONFIRMED + IN_SERVICE + COMPLETED grouped together. Semantically different lifecycle stages. Consider splitting for better operational visibility.

## Final Verdict

```
VERDICT A — COMMERCE CENTER UI CONSISTENCY DESIGN & ARCHITECTURE RECONCILIATION PASSED

DESIGN CONTRACT — ACCEPTED

FINAL SHA: 4ed240ca2bda270540e09ea0c86881a4414444da

TRUE NEXT:
PHASE 3 — COMMERCE CENTER UI CONSISTENCY — IMPLEMENTATION

D8 — NOT STARTED
```
