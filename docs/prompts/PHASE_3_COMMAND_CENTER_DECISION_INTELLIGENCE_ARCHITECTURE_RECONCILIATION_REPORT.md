# PHASE 3 — COMMAND CENTER DECISION INTELLIGENCE — ARCHITECTURE RECONCILIATION REPORT

**Статус:** AUDIT COMPLETED — AWAITING ARCHITECTURE APPROVAL  
**Дата:** 23.08.2026  
**HEAD:** `93591ad`

---

## DELIVERABLE A — CURRENT STATE AUDIT

### Current Route
`/app/command-center` → `GET /api/v1/dashboard/command-center`

### Current Sections (8)
1. Executive Summary
2. Operational Activity
3. Financial
4. Marketplace
5. Catalog Health (V3)
6. Channel Health (V3)
7. Needs Attention (V3)
8. AI Decision Feed (V3)

### Current Backend Authority
- `DashboardService` — оркестрация, консьюмер Step 3.3
- 4 первых секции — через `AnalyticsService` (Step 3.3 read models)
- 4 V3 секции — прямые Prisma-запросы к DB (Командный центр-specific)

### Current API
```
GET  /api/v1/dashboard/command-center
GET  /api/v1/dashboard/command-center/trends
```

### Current RBAC
```
analytics.read → page gate (все 8 секций)
```
Гранулярные permissions НЕ применяются сервером (см. §E).

### Current Decision Logic
**Отсутствует.** Все 8 секций — KPI-карточки без WHY/IMPACT/ACTION.

### Current AI Logic
Хардкод SQL-запросов + строковые шаблоны в `buildAiDecisionFeed()`:
- `delayedBookings` → фиксированный текст
- `highDemand` → фиксированный текст с `+${n*15} AZN/week`
- `lowConversion` → фиксированный текст
- `archivedStrong` → фиксированный текст

Нет LLM. Нет динамического анализа. Нет доказательной базы.

### Current Action Routing
**Отсутствует.** Нет ни одного ACTION в API-ответе.

### Decision Loop Maturity Matrix

| Section | WHAT | WHY | IMPACT | ACTION | Evidence | Maturity |
|---------|------|-----|--------|--------|----------|----------|
| Executive Summary | PARTIAL | MISSING | MISSING | MISSING | MISSING | **WHAT-only** |
| Operational Activity | PARTIAL | MISSING | MISSING | MISSING | MISSING | **WHAT-only** |
| Financial | PARTIAL | MISSING | MISSING | MISSING | MISSING | **WHAT-only** |
| Marketplace | PARTIAL | MISSING | MISSING | MISSING | MISSING | **WHAT-only** |
| Catalog Health | WHAT-only | MISSING | MISSING | MISSING | MISSING | **WHAT-only** |
| Channel Health | WHAT-only | MISSING | MISSING | MISSING | MISSING | **WHAT-only** |
| Needs Attention | PARTIAL | MISSING | MISSING | MISSING | MISSING | **Counter-only** |
| AI Decision Feed | PARTIAL | HARDCODED | HARDCODED | MISSING | HARDCODED | **Pseudo-AI** |

**Executive Summary PARTIAL** — содержит comparison (delta/deltaPercent), что даёт базовый direction-change. Но нет context, affected entities, time context.

**Needs Attention PARTIAL** — содержит counts без context. Нет severity, нет entities, нет SLA.

**AI Decision Feed HARDCODED** — severity и potential — фиксированные формулы, не evidence-based.

---

## DELIVERABLE B — GAP ANALYSIS

### Executive Summary

```
Existing:    7 KPI cards с comparison (delta/deltaPercent)
Missing:     WHY (driver attribution), IMPACT (financial exposure), ACTION (navigation)
Business:    Директор видит "GMV 4,423 $, ↓66%" но не знает ПОЧЕМУ и ЧТО ДЕЛАТЬ
Data:        ✅ CAN — есть commission, payments, orders, bookings, comparison
```

### Operational Activity

```
Existing:    6 KPI cards + funnel conversion
Missing:     WHY (какие партнёры/услуги проблемные), IMPACT (SLA breach), ACTION (review bookings)
Business:    Оператор видит "Pending confirmations: 218" но не знает КАКИЕ именно и ЧТО ДЕЛАТЬ
Data:        ✅ CAN — есть orders, bookings, payments, partners, time data
```

### Financial

```
Existing:    4 KPI cards (commission, reconciliation, payments, net)
Missing:     WHY (отклонения в сверке), IMPACT (revenue risk), ACTION (investigate)
Business:    Финансист видит "✓ Баланс" но не знает ДЕТАЛИ расхождений
Data:        ✅ CAN — есть ledger entries, payments, commissions, refunds
```

### Marketplace

```
Existing:    6 KPI cards (sessions, partners, customers × MP/SF)
Missing:     WHY (почему storefront sessions = 0?), IMPACT (market share shift), ACTION (upsell)
Business:    Видит 0 storefront sessions но не знает — это нормально или проблема?
Data:        ⚠️ PARTIAL — sessions приходят из behavioral events, может быть 0 если нет данных
```

### Catalog Health

```
Existing:    6 KPI cards (published, archived, without sales, high demand, low conv, categories)
Missing:     WHY (why 83 services without sales?), IMPACT (GMV opportunity), ACTION (review/fix)
Business:    Видит "83 без продаж" но не знает ПОЧЕМУ и НАСКОЛЬКО это важно
Data:        ✅ CAN — есть products, orders, availability data
```

### Channel Health

```
Existing:    8 KPI cards (GMV, revenue, orders, conversion × MP/SF)
Missing:     WHY (growth drivers), IMPACT (market share), ACTION (upsell/restrict)
Business:    Видит "Storefront GMV 7,002 AZN" но не знает тренд и action
Data:        ✅ CAN — есть orders, commissions, subscriptions, periods
```

### Needs Attention

```
Existing:    6 raw counts (pending, failed, cancellations, refunds, upcoming, without sales)
Missing:     Severity, entities, SLA, WHY, IMPACT (financial exposure), ACTION
Business:    Очередь без приоритета — 218 pending = "надо смотреть" без "что именно"
Data:        ✅ CAN — есть orders, payments, bookings, products, partners, amounts, dates
```

### AI Decision Feed

```
Existing:    3 категории (risks, opportunities, catalog insights) с хардкод-текстом
Missing:     Evidence-based WHY, actual IMPACT, real ACTION routing, dedup, lifecycle
Business:    "162 bookings delayed — Potential value: 27,071.76 AZN" — хардкод, не traceable
Data:        ⚠️ PARTIAL — SQL queries существуют, но формулировки не evidence-based
```

---

## DELIVERABLE C — TARGET DECISION ARCHITECTURE

### Decision Signal Model

```ts
DecisionSignal {
  id: string                    // uuid
  type: SignalType              // ALERT | OPPORTUNITY | INSIGHT
  category: SignalCategory      // BOOKING | PAYMENT | PARTNER | CATALOG | CHANNEL | FINANCIAL
  severity: Severity            // CRITICAL | HIGH | MEDIUM | LOW
  
  what: {
    headline: string            // "218 bookings await confirmation"
    metric: string              // "pendingConfirmations"
    value: number | string
    comparison?: { value, delta, deltaPercent, period }
    affectedCount: number       // сколько объектов затронуто
  }
  
  reasons: Array<{              // WHY — доказательная база
    type: string                // "sla_breach" | "partner_inactivity" | "payment_failure" | ...
    description: string
    evidence: EvidenceRef
    confidence: number          // 0-1, deterministic = 1.0
  }>
  
  impact: {                     // IMPACT — бизнес-значимость
    gmvAtRisk?: number
    revenueAtRisk?: number
    ordersAffected?: number
    bookingsAffected?: number
    customersAffected?: number
    partnersAffected?: number
    slaBreaches?: number
    financialExposure: number   // aggregate
  }
  
  actions: Array<{              // ACTION — следующий шаг
    type: ActionType            // NAVIGATE | REVIEW | ASSIGN | CONTACT | ESCALATE | ...
    target: string              // "booking-center" | "analytics" | "partner"
    label: string
    route?: string              // deep link
    permission?: string         // required permission
  }>
  
  evidence: EvidenceRef[]       // traceable data sources
  confidence: number            // overall confidence
  lifecycle: SignalLifecycle    // OPEN | ACKNOWLEDGED | IN_PROGRESS | RESOLVED | DISMISSED
  createdAt: Date
  updatedAt: Date
  detectedAt: Date
}

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
type SignalType = "ALERT" | "OPPORTUNITY" | "INSIGHT"
type SignalLifecycle = "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED"
type ActionType = "NAVIGATE" | "REVIEW" | "ASSIGN" | "CONTACT" | "ESCALATE" | "RETRY" | "RESOLVE" | "INVESTIGATE"
```

### Evidence Contract

```ts
EvidenceRef {
  metric: string                // "orders.pendingConfirmation"
  period: string                // "2026-08-01/2026-08-23"
  comparisonPeriod?: string
  source: string                // "order.Order WHERE status=SENT_TO_BOOKING"
  affectedEntityIds?: string[]  // ["order-123", "order-456"]
  computedAt: Date
  confidence: number
}
```

### Severity Scoring Model

```
Impact Score =
  Financial Impact (weight: 0.35)
  + Customer Impact (weight: 0.20)
  + Partner Impact (weight: 0.15)
  + SLA/Urgency (weight: 0.20)
  + Operational Risk (weight: 0.10)

Thresholds:
  CRITICAL: score >= 0.80
  HIGH:     score >= 0.55
  MEDIUM:   score >= 0.30
  LOW:      score < 0.30
```

### Signal Lifecycle

```
                    ┌─────────────┐
                    │  DETECTED   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
               ┌───►│    OPEN     │◄───┐
               │    └──────┬──────┘    │
               │           │           │
         dismiss      acknowledge   re-open
               │           │           │
         ┌─────▼──┐  ┌────▼─────┐     │
         │DISMISSED│  │ACKNOWLEDGED│───┘
         └────────┘  └────┬─────┘
                           │
                    ┌──────▼──────┐
                    │ IN_PROGRESS │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   RESOLVED  │
                    └─────────────┘
```

### AI Trust Boundary

```
ALLOWED:
  ✅ summarize evidence
  ✅ phrase human-readable descriptions
  ✅ prioritize within deterministic constraints
  ✅ help formulate recommended actions from approved templates
  ✅ extract patterns from evidence arrays

FORBIDDEN:
  ❌ fabricate causal attribution
  ❌ invent financial figures
  ❌ create severity scores without deterministic input
  ❌ generate "WHY" without evidence references
  ❌ modify canonical metric definitions
```

---

## DELIVERABLE D — COMMAND CENTER vs ANALYTICS MATRIX

| Capability | Command Center | Analytics | Shared/Canonical |
|---|---|---|---|
| GMV definition | CONSUMER | **AUTHORITY** | — |
| Revenue definition | CONSUMER | **AUTHORITY** | — |
| Orders | CONSUMER | **AUTHORITY** | — |
| Bookings | CONSUMER | **AUTHORITY** | — |
| Customers | CONSUMER | **AUTHORITY** | — |
| Conversion | CONSUMER | **AUTHORITY** | — |
| Period resolver | CONSUMER | **AUTHORITY** | — |
| Currency normalization | CONSUMER | **AUTHORITY** | — |
| Commission | CONSUMER | **AUTHORITY** | — |
| Refunds | CONSUMER | **AUTHORITY** | — |
| Trend analysis | CONSUMER | **AUTHORITY** | — |
| Segmentation | — | **AUTHORITY** | — |
| **Driver attribution** | **AUTHORITY** | SUPPORT | — |
| **Anomaly detection** | **AUTHORITY** | SUPPORT | — |
| **Severity scoring** | **AUTHORITY** | — | — |
| **Impact scoring** | **AUTHORITY** | — | — |
| **Recommended action** | **AUTHORITY** | — | — |
| **Operational queue** | **AUTHORITY** | — | — |
| Drill-down | — | **AUTHORITY** | — |
| Exploratory reporting | — | **AUTHORITY** | — |
| **Signal lifecycle** | **AUTHORITY** | — | — |
| **Action routing** | **AUTHORITY** | — | — |

**Classification:**
- `SAFE` — Все 10.metric consumer'ов (CC использует Analytics как authority)
- `SAFE` — CC-specific decision logic (WHY/IMPACT/ACTION) — не дублирует Analytics
- `RISK` — Driver attribution в AI Decision Feed (хардкод, не evidence-based)

**Нет CONFLICT.** Command Center НЕ изобретает параллельные определения метрик.

---

## DELIVERABLE E — RBAC FINDINGS

### Current Permission Mappings

```ts
// dashboard.service.ts — SECTION_PERMISSION_MAP
SECTION_PERMISSION_MAP = {
  executive:   "analytics.read",
  operational: "analytics.read",
  financial:   "analytics.read",
  marketplace: "analytics.read",
  catalog:     "analytics.read",
  channels:    "analytics.read",
  attention:   "analytics.read",
  insights:    "analytics.read",
}
```

### Repository History (permissions.constants.ts)

```ts
// Существуют гранулярные permissions:
"dashboard.executive.read"
"dashboard.operational.read"
"dashboard.financial.read"
"dashboard.marketplace.read"

// НО в SECTION_PERMISSION_MAP все 8 секций маппятся на "analytics.read"
```

### Finding

```
Regression:  YES
Type:        Granular section authority weakened
Security:    ALL sections accessible to ANY user с analytics.read
             BEFORE:   sections were filtered по dashboard.* permissions
             NOW:      sections only filtered по analytics.read (page-level gate)
Impact:      FINANCE role без dashboard.financial.read → ВИДИТ Financial
             MARKETER без dashboard.financial.read → ВИДИТ Financial
             Any analytics.read user → ВИДИТ ВСЕ 8 секций
```

### Required Remediation

```
1. Добавить permissions для V3 секций:
   dashboard.catalog.read
   dashboard.channels.read
   dashboard.attention.read
   dashboard.insights.read

2. Восстановить granular mapping в SECTION_PERMISSION_MAP

3. Обновить role definitions:
   FINANCE → dashboard.financial.read, dashboard.attention.read
   MARKETER → dashboard.marketplace.read, dashboard.catalog.read, dashboard.channels.read
   ANALYST → dashboard.executive.read, dashboard.operational.read, dashboard.catalog.read
   OPERATOR → dashboard.operational.read, dashboard.attention.read
```

---

## DELIVERABLE F — STOREFRONT REVENUE FINDINGS

### Current State

```
Canonical Premium price:   $199/month
Source of truth:           catalog.StorefrontSubscriptionPlan.priceUsd = 199.00
Seed value:                8 subscriptions × $199 = $1,592
Dashboard formula:         SUM(SubscriptionPlan.priceUsd) WHERE active AND priceUsd > 0
Does it represent actual paid revenue?  NO
```

### Problem

Текущая формула считает **contracted subscription value** (MRR), а не **paid revenue**:

```sql
-- Текущая формула:
SELECT SUM(sp."priceUsd") 
FROM catalog."StorefrontSubscription" s
JOIN catalog."StorefrontSubscriptionPlan" sp ON sp.id = s."planId"
WHERE s.status = 'ACTIVE' AND sp."priceUsd" > 0

-- Это НЕ считает:
-- - фактические платежи
-- - инвойсы
-- - статус оплаты
-- - возвраты подписок
```

### Conflicting Values

```
Plan authority:       $199 (schema) — ЕДИНСТВЕННОЕ значение
Seed value:           $199 — совпадает
Dashboard assumption: $199 — совпадает
Нет конфликтов цен.
```

### Classification

```
NOT PROVABLE — current data model lacks:
  - StorefrontPayment / Charge table
  - Invoice records
  - Payment status per subscription period
  - Billing history

Current formula = MRR (Monthly Recurring Revenue) approximation
NOT = actual paid revenue
```

### Required Architecture

```
STAGE X (future) — Subscription Billing Foundation:
  - StorefrontInvoice (invoice per period)
  - StorefrontPayment (payment per invoice)
  - Payment status: PAID / PENDING / FAILED / REFUNDED
  - Revenue = SUM(StorefrontPayment.amount) WHERE status = 'PAID'

UNTIL THEN:
  - Label as "MRR Storefront" (not "Revenue Storefront")
  - OR add disclaimer: "Contracted, not verified as paid"
```

---

## DELIVERABLE G — STAGED IMPLEMENTATION ROADMAP

### Stage A — RBAC Remediation (REQUIRED FIRST)

```
Scope:            Восстановить granular section permissions
Dependencies:     None
Files:            dashboard.service.ts, permissions.constants.ts
Acceptance:       Every section filtered by correct permission
Regression:       Unit tests, E2E auth tests
STOP:             All 8 sections have granular permissions
```

### Stage B — Decision Signal Foundation

```
Scope:            Introduce DecisionSignal type, storage, lifecycle
Dependencies:     Stage A
Files:            New: decision-signal.model.ts, decision-signal.service.ts, migration
Acceptance:       Signals can be created, stored, retrieved with lifecycle
Regression:       Unit tests for signal CRUD + lifecycle
STOP:             Signal model operational
```

### Stage C — Needs Attention → Decision Queue

```
Scope:            Convert Needs Attention from raw counts to prioritized signal queue
Dependencies:     Stage B
Files:            dashboard.service.ts, SectionGrid.tsx, i18n.tsx
Acceptance:       Needs Attention shows prioritized signals with severity, entities, actions
Regression:       Visual verification, RBAC, period filtering
STOP:             Needs Attention = operational queue
```

### Stage D — WHY Attribution (Deterministic)

```
Scope:            Add evidence-based driver attribution to signals
Dependencies:     Stage B
Files:            decision-signal.service.ts, new attribution queries
Acceptance:       Every HIGH/CRITICAL signal has at least one evidence-backed reason
Regression:       Unit tests for attribution logic
STOP:             WHY = evidence-based, not hardcoded
```

### Stage E — Impact Scoring

```
Scope:            Add impact model to signals (financial, customer, partner, SLA)
Dependencies:     Stage D
Files:            decision-signal.service.ts, scoring logic
Acceptance:       Impact scores are deterministic and reproducible
Regression:       Unit tests for scoring, edge cases (zero, overflow)
STOP:             Impact = deterministic score
```

### Stage F — Action Routing

```
Scope:            Add action contracts to signals with navigation
Dependencies:     Stage C
Files:            decision-signal.service.ts, SectionGrid.tsx, deep-link targets
Acceptance:       Actions route to correct domain (Booking Center, Finance, etc.)
Regression:       Permission check per action type
STOP:             Actions = functional navigation
```

### Stage G — AI Decision Feed Reconciliation

```
Scope:            Convert AI Decision Feed from hardcoded to evidence-based
Dependencies:     Stage D, Stage E
Files:            dashboard.service.ts, AI trust boundary
Acceptance:       Feed items reference evidence, not hardcoded text
Regression:       Verify no AI-generated financial facts
STOP:             Feed = evidence-based, AI trust boundary enforced
```

### Stage H — Executive/Operational/Financial Decision Enrichment

```
Scope:            Add WHY/IMPACT/ACTION to original 4 sections
Dependencies:     Stage C, Stage D, Stage E
Files:            dashboard.service.ts, SectionGrid.tsx
Acceptance:       Key KPIs (GMV drop, conversion drop, payment failures) generate signals
Regression:       Full regression, visual verification
STOP:             Original sections have decision intelligence
```

### Stage I — Storefront Revenue Semantic Fix

```
Scope:            Relabel or architect subscription revenue correctly
Dependencies:     None (independent)
Files:            i18n.tsx, dashboard.service.ts
Acceptance:       "Storefront Revenue" correctly represents what is measured
Regression:       Period filtering, Channel Health consistency
STOP:             No misleading revenue claims
```

### Stage J — Regression / Security / Evidence Closure

```
Scope:            Full regression, security audit, evidence traceability
Dependencies:     All previous stages
Files:            All changed files
Acceptance:       All sections traceable, all permissions enforced, all signals evidence-based
Regression:       Full backend + frontend regression
STOP:             Decision Intelligence = production-ready
```

---

## DELIVERABLE H — FINAL VERDICT

### VERDICT B — ARCHITECTURE REMEDIATION REQUIRED

**Обоснование:**

1. **RBAC Regression — CONFIRMED.** Granular section permissions ослаблены. Все 8 секций доступны через `analytics.read`. Это必须 исправить ДО任何 decision intelligence.

2. **Decision Loop — MISSING.** Ни одна секция не имеет WHY/IMPACT/ACTION. Command Center = KPI Dashboard, не Decision Intelligence Center.

3. **Storefront Revenue — NOT PROVABLE.** Current formula считает MRR, не paid revenue. Data model не подтверждает факт оплаты.

4. **AI Decision Feed — HARDCODED.** Severity, potential, text — фиксированные формулы. Нет evidence-based attribution. AI trust boundary не определён.

5. **Needs Attention — COUNTERS ONLY.** 6 raw counts без severity, entities, SLA, actions. Не operational queue.

**Что РАБОТАЕТ:**
- ✅ Command Center = orchestration, НЕ second analytics engine
- ✅ Analytics boundary清晰
- ✅ Period/currency/comparison delegation to Step 3.3
- ✅ RBAC infrastructure exists (permissions.constants.ts)
- ✅ Signal model типы определены (AiDecisionFeedResponse)
- ✅ 8 sections все возвращают данные

**Blocking Ambiguity:**
- Нет. Все неопределённости разрешимы архитектурно.

**Step 3.1 Status:** `IMPLEMENTATION COMPLETED — APPROVED`  
**Step 3.2 Status:** `STAGE A COMPLETED`  
**Current Task:** `DECISION INTELLIGENCE ARCHITECTURE — VERDICT B — AWAITING APPROVAL`

**NEXT:** After architecture approval → Stage A (RBAC Remediation)
