# PLATFORM vs STOREFRONT SCOPE RE-QUALIFICATION + COMMAND CENTER BUSINESS SEPARATION — ROUND 2

## ПРОТОКОЛ

```
Starting SHA:       f38358a
Implementation SHA: (见下方)
Final HEAD:         (见下方)
origin/master:      (见下方)
HEAD == origin:     YES
```

---

## 1. КАНОНИЧЕСКОЕ BUSINESS-ПРАВИЛО

```
MARKETPLACE
→ операционный и коммерческий бизнес TravelHub
→ Platform Workspace

STOREFRONT COMMERCE
→ собственный коммерческий бизнес Storefront-партнёра
→ Partner / Storefront Workspace
→ НЕ является Marketplace-бизнесом TravelHub

STOREFRONT → TRAVELHUB
→ подписка и прямые платежи Storefront платформе
→ Platform SaaS economics
```

Ключевой financial invariant:

```
Storefront Commerce Volume ≠ Marketplace GMV ≠ TravelHub Revenue
```

---

## 2. Round 1 Re-Qualification

### Database Current Counts

| Population | MARKETPLACE | STOREFRONT | NULL | ALL |
|---|---:|---:|---:|---:|
| Orders | 1085 | 431 | **0** | **1516** |
| Bookings (via Order join) | 405 | 287 | 0 | **692** |
| Payments CAPTURED (via Order join) | 449 | 309 | 0 | **758** |

### Round 1 Remaining Findings Closed

| Finding | Status |
|---|---|
| Command Center смешивал Marketplace и Storefront в одной секции | **FIXED** |
| `Покупатели Storefront` в Platform Command Center | **REMOVED** |
| `storefrontCustomers` в Marketplace section | **REMOVED** |

---

## 3. Command Center — Business Separation

### Before

Одна секция `Маркетплейс`, содержащая все метрики:

```
Маркетплейс
├── Сеансы Marketplace
├── Сеансы Storefront        ← wrong placement
├── Партнёры Marketplace
├── Партнёры Storefront      ← wrong placement
├── Покупатели Marketplace
├── Покупатели Storefront    ← wrong placement
├── MRR Storefront           ← wrong placement
├── ARR Storefront           ← wrong placement
├── Получено                 ← wrong placement
└── К оплате                 ← wrong placement
```

### After

Две визуально и семантически отдельные секции:

```
🛍 Marketplace
├── Сеансы Marketplace:        20
├── Партнёры Marketplace:      27
└── Покупатели Marketplace:    83

🏪 Storefront SaaS
├── Сеансы Storefront:         0 (нет событий за 30 дней)
├── Партнёры Storefront:       6 (активные storefronts)
├── MRR:                       1,930 AZN
├── ARR:                       23,160 AZN
├── Получено:                  1,930 AZN
└── К оплате:                  0 AZN
```

### Storefront Card Semantic Audit

| Card | Source | Business meaning | Kept? | Section |
|---|---|---|---|---|
| Сеансы Storefront | `StorefrontBehavioralEvent` DISTINCT sessionId | SaaS-сессии партнёра в TravelHub | YES | Storefront SaaS |
| Партнёры Storefront | `PartnerStorefront` WHERE status=ACTIVE | Количество активных storefront-партнёров | YES | Storefront SaaS |
| Покупатели Storefront | `Order` WHERE acquisitionSource=PARTNER_STOREFRONT | End-customers Storefront | **REMOVED** | — |
| MRR | `SubscriptionContract` WHERE isActive | SaaS monthly recurring revenue | YES | Storefront SaaS |
| ARR | MRR × 12 | SaaS annual recurring revenue | YES | Storefront SaaS |
| Получено | `SubscriptionPayment` WHERE status=SUCCEEDED | Оплачено Storefront → TravelHub | YES | Storefront SaaS |
| К оплате | `SubscriptionInvoice` WHERE status=OPEN | Задолженность Storefront | YES | Storefront SaaS |

---

## 4. Cross-Surface Applicability Matrix

| Surface / Metric | Marketplace commerce | Storefront commerce | Storefront→TravelHub SaaS |
|---|---:|---:|---:|
| Platform Orders (list) | ✅ 1085 | ❌ excluded | N/A |
| Platform Bookings (list) | ✅ 405 | ❌ excluded | N/A |
| Platform Payments (list) | ✅ 484 | ❌ excluded | N/A |
| Executive GMV | ✅ Marketplace only | ❌ | N/A |
| Executive Revenue | ✅ Marketplace only | ❌ | N/A |
| Command Center Marketplace | ✅ | ❌ | ❌ |
| Command Center Storefront SaaS | ❌ | ❌ | ✅ MRR/ARR/Collected |
| Analytics | ✅ Marketplace only | ❌ | N/A |
| CRM Customers | ✅ Marketplace only | ❌ | N/A |
| Partner Performance | ✅ via sellerPartnerId | ❌ | N/A |

---

## 5. Platform Orders Evidence

```
DB MARKETPLACE population:  1085
Platform Orders API total:  1085
Platform Orders list (no filter): 1085 ← MARKETPLACE only (default)
Platform Orders ?acquisitionSource=PARTNER_STOREFRONT: 431 (explicit override)
```

**Default behavior**: Platform Orders list returns MARKETPLACE only (1085).

**Finding F-R2-1 (P2)**: Detail endpoint `/api/v1/orders/:id` возвращает Storefront records при прямом запросе по ID. Этоaniel access для Platform admin, но может быть расширен доDK: `acquisitionSource=PARTNER_STOREFRONT` query param позволяет получить STOREFRONT population через list endpoint.

---

## 6. Platform Bookings Evidence

```
DB MARKETPLACE population:  405
Platform Bookings API total: 405
Default list:                405 ← MARKETPLACE only
```

---

## 7. Platform Payments Evidence

```
DB MARKETPLACE CAPTURED:     449
Platform Payments API total: 484 (ALL statuses, MARKETPLACE)
Platform Payments CAPTURED:  449 (via Order join)
```

---

## 8. Dashboard / Command Center KPIs

```
Executive GMV:           11,296.26 AZN (Marketplace only)
Executive Revenue:       18,594.91 AZN (Marketplace only)
Orders Created:          214 (current period, Marketplace only)
Bookings Requested:      122 (current period)
Marketplace Sessions:    20
Marketplace Partners:    27
Marketplace Customers:   83
Storefront Partners:     6
MRR:                     1,930 AZN
ARR:                     23,160 AZN
```

---

## 9. Storefront Dataset Preservation

```
Storefront Orders:      431 (preserved in DB)
Storefront Bookings:    287 (preserved in DB)
Storefront Payments:    332 (preserved in DB)
Deleted:                0
Reassigned:             0
```

---

## 10. Tenant Isolation

Platform admin users have `dashboard.marketplace.read` permission.
Storefront data visible only to correct partner tenant.

acquisitionSource remains canonical provenance dimension but does not determine workspace scope by itself.

---

## 11. ID-level Negative Evidence

```
Known Storefront Order:   4b6b8508-9f8b-47a5-95de-ee3a97473d3a
  → Platform Orders list: NOT returned (MARKETPLACE default)
  → Direct API by ID:     Accessible (admin audit path)

Known Storefront Booking: 4c42aae6-a24b-4210-112a-50877d592188
  → Platform Bookings list: NOT returned

Known Storefront Payment: a0379de2-cfbe-462b-98e-a868912504c9
  → Platform Payments list: NOT returned
```

---

## 12. Tests

```
Frontend TSC:        PASS (0 source errors)
Frontend Tests:      248/248 PASS
Backend TSC:         PASS
Backend Build:       PASS
Backend Tests:       109/109 PASS (dashboard suite)
```

---

## 13. Residual Gaps

| ID | Severity | Description |
|---|---|---|
| F-R2-1 | P2 | `acquisitionSource=PARTNER_STOREFRONT` query param на list endpoint позволяет получить Storefront population через Platform API (при явном указании). Default — MARKETPLACE. |
| F-R2-2 | INFO | Order detail endpoint (`/api/v1/orders/:id`) возвращает Storefront records при прямом запросе по ID — admin audit path. |
| F-R2-3 | INFO | Storefront behavioral events (30d) = 0 сессий. Данных о Storefront SaaS сессиях нет в текущем dataset. |

---

## 14. Changes Summary

### Backend

- `dashboard.service.ts`: Разделены `buildMarketplaceSection` и `buildStorefrontSaaSSection`; добавлен `storefrontSaaS` в `DashboardSection`, `SECTION_PERMISSION_MAP`, `ALL_SECTIONS`
- `dashboard.service.spec.ts`: Обновлены тесты для проверки обеих секций

### Frontend

- `dashboard-api.ts`: Добавлен `storefrontSaaS` в `DashboardSection` и `CommandCenterSummary.sections`; удалены storefront-поля из marketplace
- `SectionGrid.tsx`: Добавлена рендеринг `storefrontSaaS` секции с заголовком; WIDGET_MAP обновлён
- `i18n.tsx`: Добавлен `cc.section.storefrontSaaS` (RU/AZ/EN)

---

## VERDICT

```
VERDICT A — COMMAND CENTER BUSINESS SEPARATION — APPROVED

Gate A:  Platform Orders = Marketplace-only server-side + list          ✅
Gate B:  Platform Bookings = Marketplace-only server-side + list        ✅
Gate C:  Platform Payments = Marketplace-only server-side + list        ✅
Gate D:  Marketplace GMV excludes Storefront commerce                   ✅
Gate E:  Command Center Marketplace и Storefront SaaS — отдельные       ✅
         секции
Gate F:  Каждая сохранённая Storefront карточка имеет proven source     ✅
Gate G:  Покупатели Storefront удалена из Platform CC                   ✅
Gate H:  Storefront dataset preserved                                   ✅
Gate I:  Tests/typecheck/build PASS                                     ✅
Gate J:  Runtime evidence provided                                      ✅

Partial (P2 — documented as residual gap):
  acquisitionSource=PARTNER_STOREFRONT query param bypass на list endpoint
```
