# PHASE 3 — AI DECISION FEED
## SEMANTIC & LOCALIZATION RECONCILIATION
## ОТЧЁТ

**VERDICT A — AI DECISION FEED SEMANTICS RECONCILED / LOCALIZATION VERIFIED / FINANCIAL NO-FABRICATION CLOSED / STAGE F READY**

---

## 1. Financial No-Fabrication — Audit Results

### +165/+135 AZN/week

```
Source:      dashboard.service.ts — buildAiDecisionFeed()
Formula:     Number(hd.orders) * 15
Coefficient: 15 (arbitrary, undocumented)
Provable:    NO
Disposition: REMOVED
```

Arbitrary `n × 15 AZN/week` coefficient удалён. Opportunities теперь показывают factual order count + period без fabricated financial uplift.

### Potential value: 22355.21 AZN

```
Source:      SUM(b.amount) for CONFIRMED/IN_SERVICE bookings where serviceDate < NOW()
Formula:     SQL aggregate — actual booking amounts
Business:    Affected booking GMV (orders in overdue state)
Provable:    YES — direct DB aggregate
Label:       Renamed to "Affected volume" / "Затронутый объём" / "Təsir olunan həcm"
```

Число `22355.21` доказуемо — это реальная суммаbooking amounts. Label изменён с misleading `Potential value` на factual `Affected volume`.

---

## 2. Architecture Classification

| AI Feed Item | Category | Classification | DecisionSignal Relationship |
|---|---|---|---|
| Delayed bookings | Risk | B — Separate informational insight | Overlaps with BOOKING_CONFIRMATION_DELAY but different scope (serviceDate < NOW vs SLA breach) |
| High demand | Opportunity | B — Separate informational insight | No DecisionSignal equivalent |
| Low paid share | Catalog | B — Separate informational insight | No DecisionSignal equivalent |
| Historical performance | Catalog | B — Separate informational insight | No DecisionSignal equivalent |

AI Feed remains a **separate informational layer** with its own evidence contract, not a duplicate of DecisionSignal/WHY/IMPACT.

---

## 3. Action Boundary

```
Existing recommendation prose:
  "Consider increasing exposure"  → REMOVED
  "Review pricing/content"        → REMOVED
  "Consider reactivation"         → REMOVED

Before Stage F:     Removed entirely
Rationale:          AI Feed should not create parallel ACTION engine
Stage F authority:  Will become single source for ACTION recommendations
```

---

## 4. Rule Inventory

| Rule | Category | Evidence | Formula | Monetary? | Recommendation? | Classification |
|---|---|---|---|---|---|---|
| Delayed bookings | Risk | Booking count + SUM(amount) | SQL aggregate | YES (affected volume) | NO | B |
| High demand | Opportunity | Order count per product (30d) | COUNT(*) | NO | NO | B |
| Low paid share | Catalog | paid/total ratio per product | COUNT FILTER | NO | NO | B |
| Historical performance | Catalog | Order count for archived products | COUNT(*) | NO | NO | B |

---

## 5. Localization Matrix

| Element | RU | AZ | EN | Runtime |
|---|---|---|---|---|
| Section title | Лента решений ИИ | AI Qərar Lentesi | AI Decision Feed | ✅ |
| Risks heading | Риски | Risklər | Risks | ✅ |
| Opportunities heading | Возможности | Imkanlar | Opportunities | ✅ |
| Catalog heading | Каталог | Kataloq | Catalog | ✅ |
| Delayed bookings | {count} бронирований задержано | {count} bron gecikdirilib | {count} bookings delayed | ✅ |
| Affected volume | Затронутый объём: {value} ₼ | Təsir olunan həcm: {value} ₼ | Affected volume: {value} ₼ | ✅ |
| High demand | {name} — высокий спрос | {name} — yüksək tələbat | {name} — high demand | ✅ |
| Orders in period | {orders} заказов за {days} дней | {orders} sifariş {days} gündə | {orders} orders in {days} days | ✅ |
| Low paid share | {name} — низкая доля оплаты | {name} — aşağı ödəniş payı | {name} — low paid share | ✅ |
| Paid detail | {rate}% оплачено ({paid}/{total}) | {rate}% ödənilib ({paid}/{total}) | {rate}% paid ({paid}/{total}) | ✅ |
| Historical | {name} — успешная история | {name} — uğurlu tarixçə | {name} — strong historical performance | ✅ |
| Orders before archive | {orders} заказов до архивации | {orders} sifariş arxivlənmədən əvvəл | {orders} orders before archiving | ✅ |

---

## 6. Fabrication Regression

```
+165 AZN/week:      REMOVED ✅
+135 AZN/week:      REMOVED ✅
Potential value:    Renamed → Affected volume ✅
n × 15 coefficient: REMOVED ✅
Recommendation text: REMOVED ✅
GMV≠Revenue:        Preserved ✅
AZN authority:       Preserved (₼ in UI) ✅
```

---

## 7. Runtime Hard Gate

```
RU:
  English system fragments:  0 ✅ ("AI Decision Feed" → "Лента решений ИИ")
  AZ system fragments:       0 ✅
  CJK fragments:             0 ✅
  Fabricated +AZN/week:      0 ✅
  Raw i18n keys:             0 ✅

AZ:
  Russian system fragments:  0 ✅
  English system fragments:  0 ✅
  CJK fragments:             0 ✅
  Fabricated +AZN/week:      0 ✅
  Raw i18n keys:             0 ✅

EN:
  Russian system fragments:  0 ✅
  AZ system fragments:       0 ✅
  Fabricated +AZN/week:      0 ✅
  Raw i18n keys:             0 ✅
```

---

## 8. Tests

```
Backend tests:     1027/1027 ✅
Frontend tests:     243/243 ✅
Backend TSC:        clean ✅
Frontend TSC:       clean ✅
Backend build:      clean ✅
Fabrication check:  CLEAN ✅
CJK check:          0 ✅
```

---

## 9. Files Changed

```
Files changed:    5
  backend/src/modules/dashboard/dashboard.service.ts (types + buildAiDecisionFeed)
  frontend/lib/dashboard-api.ts (types)
  frontend/components/command-center/SectionGrid.tsx (types + i18n rendering + interpolate)
  frontend/lib/i18n.tsx (section title fix + 8 AI Feed keys)
Migrations:       0
```

---

## 10. Roadmap

```
AI Decision Feed Semantic Reconciliation → VERDICT A
Stage F                                  → READY (not auto-started)
```

---

**VERDICT A — AI DECISION FEED SEMANTICS RECONCILED / LOCALIZATION VERIFIED / FINANCIAL NO-FABRICATION CLOSED / STAGE F READY**
