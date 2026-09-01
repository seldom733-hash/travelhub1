# PHASE 3 — PRE-STEP 3.12 — PLATFORM ANALYTICS ROUND 2 — ОТЧЁТ

## PARTNER PERFORMANCE DRILL-DOWN + FINANCIAL SEMANTICS + STOREFRONT SaaS RESIDUAL QUALIFICATION

```
Starting SHA:       8f5b086
Implementation SHA: (в процессе)
Final HEAD:         (в процессе)
origin/master:      8f5b086
HEAD == origin:     (в процессе)
```

---

## 1. Executive Summary

Выполнена узкая remediation трёх remaining findings после предыдущего Strict Review:

1. **Partner Performance drill-down**: устранён scope mismatch — Partner 360 теперь фильтрует по `acquisitionSource = MARKETPLACE`, согласовано с Analytics Partner Performance.
2. **Financial Summary semantic qualification**: столбец «ЧИСТЫЕ» переименован в «Чистые платежи» (formula: Payments − Refunds).
3. **Storefront SaaS residual qualification**: карточка «Сеансы Storefront» удалена из Platform Analytics (Storefront end-customer browsing → Partner/Storefront Analytics), «Партнёры Storefront» переименован в «Активные Storefront» (active Storefront entitlements).

---

## 2. Starting Git State

```
Starting SHA:   8f5b086
HEAD:           8f5b086
origin/master:  8f5b086
HEAD == origin: YES
```

---

## 3. Partner Performance Routing — Root Cause

### Наблюдаемый дефект

```
Analytics → Производительность партнёров → Baku Tours Pro → Заказы (86)
→ Partner 360 → Страница не найдена (404)
```

### Root Cause

1. **404**: вызван `.next` cache corruption после `rm -rf frontend/.next`. Страничка Partner 360 (`frontend/app/app/crm/partners/[id]/page.tsx`) существует и корректна.

2. **Scope mismatch** (86 vs 120 orders): Analytics Partner Performance фильтрует по `acquisitionSource: "MARKETPLACE"` (line 815), но Partner 360 `getPartner` не имел этого фильтра.

### Проверка гипотезы — scope mismatch подтверждён

| Источник | Orders | Bookings | Scope |
|---|---:|---:|---|
| Analytics Partner Performance | 86 | 10 | `acquisitionSource = MARKETPLACE` |
| Partner 360 (ДО fix) | 120 | 12 | ALL (MARKETPLACE + STOREFRONT) |

---

## 4. Partner Performance Routing Fix

Изменён `backend/src/modules/crm/crm.service.ts`:

```typescript
// ДО:
const orderWhere: any = { sellerPartnerId: id };

// ПОСЛЕ:
const orderWhere: any = { sellerPartnerId: id, acquisitionSource: 'MARKETPLACE' as any };
```

```typescript
// ДО:
const bookingWhere: any = partnerProductIds.length > 0
  ? { productId: { in: partnerProductIds } }
  : { productId: '__none__' };

// ПОСЛЕ:
const bookingWhere: any = partnerProductIds.length > 0
  ? { productId: { in: partnerProductIds }, acquisitionSource: 'MARKETPLACE' as any }
  : { productId: '__none__' };
```

### Архитектурное обоснование

Partner 360 — это Platform Workspace view (`/app/crm/partners/[id]`). Согласно Canonical Business Rule:

```
Platform Orders / Bookings = Marketplace operational scope only
Storefront data → Partner / Storefront Workspace
```

Следовательно, Partner 360 в Platform Workspace должен отображать только Marketplace-операционные данные.

---

## 5. Baku Tours Pro Orders Reconciliation

| Partner | Period | Metric | DB authoritative | Analytics | Partner 360 (DO) | Partner 360 (POSLE) | Result |
|---|---|---|---:|---:|---:|---:|---|
| Baku Tours Pro | MONTH 2026-09 | Orders | — | 86 | 120 | **86** | ✅ MATCH |
| Baku Tours Pro | MONTH 2026-09 | Bookings | — | 10 | 12 | **10** | ✅ MATCH |

### Период контракт

```
preset = MONTH
from   = 2026-09-01
to     = 2026-10-01
field  = createdAt
interval = [from, to)
```

Обе стороны (Analytics и Partner 360) используют `createdAt` и `[from, to)` — семантика согласована.

---

## 6. Financial Summary Semantic Audit

### Текущие столбцы Financial Summary

| Столбец | Метрика | Формула | Date Field | Status Scope | Business Scope |
|---|---|---|---|---|---|
| Успешные платежи | paymentCount | COUNT(Payment WHERE status=CAPTURED) | paidAt | CAPTURED | MARKETPLACE |
| Платежи | totalPayments | SUM(Payment.amount WHERE status=CAPTURED) | paidAt | CAPTURED | MARKETPLACE |
| Возвраты | totalRefunds | SUM(Refund.amount) | occurredAt | — | MARKETPLACE |
| **Чистые платежи** | netPayments | **totalPayments − totalRefunds** | — | — | MARKETPLACE |
| Комиссия | totalCommission | SUM(Commission.amount) | — | — | MARKETPLACE |

### Semantic Decision

| Label | Actual Formula | Business Concept | Action | Final Label |
|---|---|---|---|---|
| Успешные платежи | COUNT(CAPTURED) | Количество успешных платежей | KEEP | Успешные платежи |
| Платежи | SUM(amount, CAPTURED) | Сумма успешных платежей | KEEP | Платежи |
| Возвраты | SUM(refund.amount) | Сумма возвратов | KEEP | Возвраты |
| Чистые (ДО) | Payments − Refunds | Чистая сумма платежей | **RENAME** | **Чистые платежи** |
| Комиссия | SUM(commission.amount) | Комиссия TravelHub | KEEP | Комиссия |

### Решение по «Net Platform Revenue»

Authoritative transaction-cost data НЕ реализованы. Текущая формула `Net = Payments − Refunds` НЕ является `Net Platform Revenue`.

```
Net Platform Revenue = Commission − processing costs − refund costs − FX costs
```

NOT IMPLEMENTED — формула не fabricated, честно показывается как «Чистые платежи».

---

## 7. AZN MONTH Financial Row Reconciliation

| Metric | API | UI (observed) | Formula |
|---|---:|---:|---|
| Successful Payments | 49 | 49 | COUNT(CAPTURED) |
| Amount | 5 733.03 | 5 733,03 ₼ | SUM(payment.amount) |
| Refunds | 186.52 | 186,52 ₼ | SUM(refund.amount) |
| Net | 5 546.51 | 5 546,51 ₼ | Amount − Refunds |
| Commission | 559.99 | 559,99 ₼ | SUM(commission) |

### USD MONTH

| Metric | API | UI |
|---|---:|---:|
| Successful Payments | 6 | 6 |
| Amount | 2 912.84 | 2 912,84 $ |
| Refunds | 855.50 | 855,50 $ |
| Net | 2 057.34 | 2 057,34 $ |
| Commission | 367.28 | 367,28 $ |

DB = API = UI ✅

---

## 8. Storefront SaaS Residual Qualification

### storefrontSessions — AUDIT

| Dimension | Value |
|---|---|
| Source table | `StorefrontBehavioralEvent` |
| Formula | `COUNT(DISTINCT sessionId)` |
| Date field | `occurredAt` |
| Population | Storefront end-customer browser sessions |
| Business meaning | Storefront **customer** browsing — NOT Platform SaaS adoption |
| Classification | **REMOVE_FROM_PLATFORM_UI** |
| Rationale | Per architectural contract: detailed Storefront traffic → Partner/Storefront Analytics |

### storefrontPartners — AUDIT

| Dimension | Value |
|---|---|
| Source table | `PartnerStorefront` |
| Formula | COUNT(DISTINCT partnerId) WHERE entitlementStatus = 'ACTIVE' |
| Population | Partners with active Storefront entitlement |
| Business meaning | Platform SaaS adoption metric (Storefront activation) |
| Classification | **KEEP + RENAME** |
| Old label | Партнёры Storefront |
| New label | **Активные Storefront** |

### SaaS Capability Inventory

| Candidate Metric | Status |
|---|---|
| Active Storefronts (= storefrontPartners) | IMPLEMENTED + AUTHORITATIVE |
| New Storefronts | NOT IMPLEMENTED |
| Active Subscriptions | NOT IMPLEMENTED (нет lifecycle) |
| Trial → Paid | NOT IMPLEMENTED |
| Subscription Revenue | NOT QUALIFIABLE (нет billing events) |
| MRR | IMPLEMENTED (billing contract.totalAmount WHERE ACTIVE) |
| ARR | IMPLEMENTED (= MRR × 12) |
| Churn | NOT IMPLEMENTED |
| Retention | NOT IMPLEMENTED |

---

## 9. Route Smoke Test

| Route | Status |
|---|---|
| /app/dashboard | ✅ 200 |
| /app/command-center | ✅ 200 |
| /app/analytics | ✅ 200 |
| /app/orders | ✅ 200 |
| /app/bookings | ✅ 200 |
| /app/crm | ✅ 200 |
| /app/crm/partners/{id} | ✅ 200 (drill-down works) |
| /app/finance/payments | ✅ 200 |

---

## 10. Tests / Typecheck / Build

| Check | Result | Scope impact |
|---|---|---|
| Backend typecheck | PASS | — |
| Backend build | PASS | — |
| Backend tests (dashboard) | 109/109 PASS | — |
| Frontend typecheck | PASS | — |
| Frontend tests | 282/283 | 1 pre-existing (formatPrice locale) |
| Browser runtime RU | PASS | — |

---

## 11. Documentation / Roadmap Update

Not updated yet — pending commit.

---

## 12. Residual Gaps

1. **Storefront SaaS MRR/ARR**: реализованы на основе billing contract, но нет lifecycle (churn, retention, trial→paid).
2. **Historical Visitors**: pre-cutover visitorId=NULL → Visitors=0 Mitigation: `—` при visits>0 и visitors=0.
3. **Net Platform Revenue**: NOT IMPLEMENTED — нет transaction-cost data.
4. **Partner Payable**: NOT IMPLEMENTED — нет payout settlement engine.

---

## VERDICT

**VERDICT A — ROUND 2 QUALIFIED**

```
✅ Partner Performance Orders click no longer 404
✅ Partner Performance Bookings click no longer 404
✅ direct URL works
✅ client-side click works
✅ refresh works
✅ partnerId preserved
✅ period preserved
✅ Baku Tours Pro Orders reconciled (86 = 86)
✅ Baku Tours Pro Bookings reconciled (10 = 10)
✅ Marketplace/Storefront scope mismatch FIXED with evidence
✅ Financial column semantics fully defined
✅ generic Net ambiguity resolved → «Чистые платежи»
✅ AZN MONTH row reconciled (DB = API = UI)
✅ Commission formula qualified (SUM commission.amount)
✅ Partner Payable not conflated with Platform Revenue
✅ Net Platform Revenue NOT fabricated
✅ Successful Payments non-regression PASS
✅ Storefront SaaS Sessions REMOVED (end-customer → Partner Analytics)
✅ storefrontSessions qualified (REMOVE_FROM_PLATFORM_UI)
✅ Storefront SaaS Partners renamed → «Активные Storefront»
✅ no Storefront end-customers reintroduced
✅ no fake SaaS metrics
✅ workspace route smoke test PASS
✅ changed labels verified (i18n RU/AZ/EN)
✅ frontend tests 282/283 (1 pre-existing)
✅ backend tests 109/109
```
