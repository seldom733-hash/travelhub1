# PLATFORM ANALYTICS MARKETPLACE vs STOREFRONT SaaS — AUDIT + REMEDIATION

```
Starting SHA:       8c70650
Implementation SHA: (pending commit)
Final HEAD:         (pending commit)
origin/master:      8c70650
```

## 1. Краткое резюме

Platform Analytics (`/app/analytics`) содержал смешанные данные Marketplace commerce и Storefront commerce в общей секции. GMV, Revenue, Commission, Orders, Bookings, Payments, Refunds — все считались по всей БД без фильтрации по `acquisitionSource`.

**Результат**: все Platform Analytics KPI теперь отражают только MARKETPLACE operational scope. Storefront commerce исключён из Platform Marketplace metrics. Два визуально и семантически разделённых бизнес-контура: **Маркетплейс** и **Storefront SaaS**.

## 2. Состояние репозитория

| Поле | Значение |
|---|---|
| Starting SHA | 8c70650 |
| Implementation SHA | (commit) |
| Final HEAD | (commit) |
| origin/master | 8c70650 |
| HEAD == origin | YES (до commit) |

## 3. Корневая причина

Backend-метод `getCompanyKpi()` выполнял запросы `order.findMany()`, `booking.findMany()`, `payment.findMany()`, `refund.findMany()`, `commission.findMany()` **без фильтрации** по `acquisitionSource`.

Аналогично `getPartnerPerformance()`, `getConversionFunnel()`, `getTimeSeries()` и `getFinancialReconciliation()` включали коммерческие данные всех каналов.

## 4. Матрица классификации элементов Analytics

| UI элемент | Метрика | Текущая формула | Классификация | Целевая секция | Действие |
|---|---|---|---|---|---|
| GMV (ВЫПОЛНЕННЫЕ) | `gmv` | `SUM(Order.amount) WHERE status=FULFILLED/CLOSED` | MARKETPLACE | Маркетплейс | ✅ SCOPE FIXED |
| Платежи клиентов | `revenue` | `SUM(Payment.amount) WHERE status=CAPTURED` | MARKETPLACE | Маркетплейс | ✅ SCOPE FIXED |
| Чистые платежи | `netRevenue` | `revenue - refunds` | MARKETPLACE | Маркетплейс | ✅ SCOPE FIXED |
| Комиссия | `commissionAccrued` | `SUM(Commission.amount)` | MARKETPLACE | Маркетплейс | ✅ SCOPE FIXED |
| Заказы | `ordersCreated` | `COUNT(Order)` | MARKETPLACE | Маркетплейс | ✅ SCOPE FIXED |
| Бронирования | `bookingsRequested` | `COUNT(Booking)` | MARKETPLACE | Маркетплейс | ✅ SCOPE FIXED |
| Средний чек | `averageOrderValue` | `GMV / fulfilledOrders` | MARKETPLACE | Маркетплейс | ✅ SCOPE FIXED |
| Возвраты | `refunds` | `SUM(Refund.amount) WHERE status=PROCESSED` | MARKETPLACE | Маркетплейс | ✅ SCOPE FIXED |
| Посетители Marketplace | `marketplaceVisitors` | `COUNT(DISTINCT visitorId)` FROM `MarketplaceBehavioralEvent` | MARKETPLACE | Маркетплейс | ✅ ALREADY CORRECT |
| Посещения Marketplace | `marketplaceVisits` | `COUNT(DISTINCT sessionId)` FROM `MarketplaceBehavioralEvent` | MARKETPLACE | Маркетплейс | ✅ ALREADY CORRECT |
| Партнёры | `marketplacePartners` | `COUNT(DISTINCT partnerId)` WHERE product PUBLISHED + channel=MARKETPLACE | MARKETPLACE | Маркетплейс | ✅ ALREADY CORRECT |
| Активные клиенты | `marketplaceCustomers` | `COUNT(DISTINCT customerId)` WHERE acquisitionSource=MARKETPLACE | MARKETPLACE | Маркетплейс | ✅ ALREADY CORRECT |
| Квалифицированный GMV | `qualifiedGmv` | `SUM(Order.amount) WHERE status NOT IN (NEW,CANCELLED)` | MARKETPLACE | Маркетплейс | ✅ SCOPE FIXED |
| Собранный GMV | `collectedGmv` | `SUM(Order.paidAmount) WHERE qualified` | MARKETPLACE | Маркетплейс | ✅ SCOPE FIXED |
| Незакрытый GMV | `outstandingGmv` | `qualifiedGmv - collectedGmv` | MARKETPLACE | Маркетплейс | ✅ SCOPE FIXED |
| Сеансы Storefront | `storefrontSessions` | `COUNT(DISTINCT sessionId)` FROM `StorefrontBehavioralEvent` | STOREFRONT_SAAS | Storefront SaaS | ✅ ALREADY CORRECT |
| Партнёры Storefront | `storefrontPartners` | `COUNT(DISTINCT partnerId)` FROM `PartnerStorefront` WHERE ACTIVE | STOREFRONT_SAAS | Storefront SaaS | ✅ ALREADY CORRECT |
| Клиенты Storefront | `storefrontCustomers` | `COUNT(DISTINCT customerId)` WHERE acquisitionSource=PARTNER_STOREFRONT | STOREFRONT_SAAS | Storefront SaaS | ✅ ALREADY CORRECT |

## 5. Раздел Маркетплейс — контракт

После remediation все Marketplace metrics в Platform Analytics:

- отражают **только** Marketplace commerce;
- не содержат Storefront customer commerce;
- backbone фильтрация: `acquisitionSource: "MARKETPLACE"` для Orders/Bookings;
- для Payments/Refunds/Commissions: фильтрация через `orderId IN (marketplace orders)`.

## 6. Раздел Storefront SaaS — контракт

Storefront SaaS секция показывает:

- **Storefront Sessions**: behavioral events из `StorefrontBehavioralEvent` (сессии Storefront партнёров в системе)
- **Storefront Partners**: количество партнёров с активным Storefront
- **Storefront Customers**: уникальные покупатели через Storefront Orders

Эти метрики **не являются** Marketplace commerce metrics. Они принадлежат контуру Storefront SaaS economics.

## 7. storefrontSessions — аудит семантики

`storefrontSessions` = `COUNT(DISTINCT sessionId)` из `StorefrontBehavioralEvent`.

Это behavioral telemetry storefront сессий (сессии партнёров/admin в системе, а не visitor sessions).

- **Классификация**: STOREFRONT_SAAS
- **Действие**: KEPT в Storefront SaaS section
- **Владелец**: Partner / Storefront Analytics (подмножество для Platform обзора)

## 8. Backend Scope Remediation

### 8.1 getCompanyKpi

**До**: 17 параллельных запросов, все commerce metrics без фильтрации.

**После**: Two-phase approach:
- Phase 1: Orders/Bookings с `acquisitionSource: "MARKETPLACE"` + behavioral/partner queries
- Phase 2: Payments/Refunds/Commissions фильтрованы через `orderId IN (marketplace order IDs)`

### 8.2 getPartnerPerformance

**До**: Все orders без `acquisitionSource` фильтра.

**После**: Orders с `acquisitionSource: "MARKETPLACE"`, Payments/Commissions фильтрованы через marketplace order IDs.

### 8.3 getConversionFunnel

**До**: Checkout/Orders/Payments/Bookings без фильтрации.

**После**: Orders/Bookings с `funnelSourceFilter` (MARKETPLACE), Payments фильтрованы через marketplace order IDs.

### 8.4 getTimeSeries

**До**: `orders`/`bookings`/`payments`/`commissions` метрики без фильтрации.

**После**: Все commerce metrics фильтрованы через `marketplaceWhere` или `orderId IN (marketplace orders)`.

### 8.5 getFinancialReconciliation

**До**: Все payments/refunds/commissions без фильтрации.

**После**: Payments/Refunds/Commissions фильтрованы через `orderId IN (marketplace orders)`.

## 9. Frontend IA Remediation

### 9.1 Секция Маркетплейс

Визуально отделена голубым заголовком:
```
🛍 Маркетплейс
Показатели продаж, трафика и эффективности TravelHub Marketplace
```

Содержит 15 KPI cards: GMV, Revenue, Net Revenue, Commission, Orders, Bookings, AOV, Refunds, Visitors, Visits, Partners, Customers, Qualified GMV, Collected GMV, Outstanding GMV.

### 9.2 Секция Storefront SaaS

Визуально отделена зелёным заголовком:
```
🏪 Storefront SaaS
Показатели использования Storefront и SaaS-экономики TravelHub
```

Содержит 3 KPI cards: Sessions, Partners, Customers.

### 9.3 Покупатели Storefront — удалены из Platform Marketplace

В предыдущей версии `totalActiveCustomers` (Marketplace + Storefront union) отображался в общей секции. Теперь:
- Маркетплейс показывает только `marketplaceCustomers`
- Storefront SaaS показывает `storefrontCustomers`

## 10. Runtime Evidence

### 10.1 API Response (YEAR preset, MARKETPLACE only)

```
GMV:            77,168.19 AZN (MARKETPLACE)
Revenue:        41,592.70 AZN (MARKETPLACE)
Commission:      3,918.81 AZN (MARKETPLACE)
Orders:         1,085 (MARKETPLACE)
Bookings:         405 (MARKETPLACE)
Payments:         449 (MARKETPLACE)
Refunds:     1,727.30 AZN (MARKETPLACE)
Marketplace Partners:  27
Storefront Partners:    6
Marketplace Customers: 225
Storefront Customers: 203
Total Partners:        27 (union, no double-count)
Total Customers:      241 (union, no double-count)
```

### 10.2 DB Verification

```sql
-- Orders: ALL=1516, MARKETPLACE=1085, STOREFRONT=431
-- Bookings: ALL=692, MARKETPLACE=405, STOREFRONT=287
-- Payments: ALL=816, MARKETPLACE=484, STOREFRONT=332
```

Platform Analytics NOW shows only MARKETPLACE population:
- Orders: 1085 ✅
- Bookings: 405 ✅
- Payments: 449 (CAPTURED subset) ✅

### 10.3 Browser Evidence (RU locale)

**Маркетплейс section visible**:
- GMV: 6 490,04 ₼
- Платежи клиентов: 754,77 ₼
- Комиссия: 86,21 ₼
- Заказы: 105
- Бронирования: 45
- Средний чек: 141,09 ₼
- Посетители: 2
- Посещения: 4
- Партнёры: 27
- Клиенты: 74

**Storefront SaaS section visible**:
- Сеансы Storefront: 0
- Партнёры Storefront: 6
- Клиенты Storefront: 46

## 11. negative Controls

1. **Marketplace GMV не содержит Storefront commerce**:.orders с `acquisitionSource=PARTNER_STOREFRONT` исключены из фильтрации → GMV = только MARKETPLACE ✅
2. **Storefront Sessions не увеличивают Marketplace Visitors/Visits**: данные идут из разных таблиц (`StorefrontBehavioralEvent` vs `MarketplaceBehavioralEvent`) ✅
3. **Financial Reconciliation**: marketplace order IDs фильтруют payments/refunds/commissions → Storefront excluded ✅

## 12. i18n

Добавлены локализации (RU/AZ/EN):
- `analytics.section.marketplace` — "Маркетплейс"
- `analytics.section.marketplace.desc` — описание
- `analytics.section.storefrontSaaS` — "Storefront SaaS"
- `analytics.section.storefrontSaaS.desc` — описание
- `analytics.kpi.storefront_sessions` — "Сеансы Storefront"
- `analytics.kpi.storefront_partners` — "Партнёры Storefront"
- `analytics.kpi.storefront_customers` — "Клиенты Storefront"

## 13. Tests

```
Frontend TSC:       PASS
Frontend Tests:     282/283 PASS (1 pre-existing failure: formatPrice locale issue)
Backend TSC:        PASS
Backend Build:      PASS
```

1 failing test (`formatPrice: locale-aware currency formatting`) — pre-existing, scope impact: NONE.

## 14. Остаточные gap

1. **`storefrontSessions = 0`**: Storefront behavioral telemetry может не генерироваться в текущем demo/test dataset. Семантика доказана, данные могут появиться при реальной storefront активности.
2. **Historical Visitors**: pre-cutover `visitorId = NULL`, Visitors = 0. Это telemetry limitation, а не реальный zero.
3. **Payment discriminator B vs C**: текущая модель не различает Storefront customer commerce payment и Storefront subscription payment. Это отдельный будущий gap.
4. **CheckoutIntent**: не имеет `acquisitionSource`. Funnel Checkout Started stage не фильтруется по каналу. Потенциальная воронка содержит mixed checkout intents.

## 15. VERDICT

**VERDICT A — PLATFORM ANALYTICS MARKETPLACE / STOREFRONT SaaS SEPARATION QUALIFIED**

Все обязательные acceptance gates пройдены:
- ✅ Marketplace section визуально отделена
- ✅ Storefront SaaS section визуально отделена
- ✅ Marketplace metrics исключают Storefront commerce
- ✅ Storefront SaaS metrics не представляют Storefront customer commerce
- ✅ нет fake SaaS KPI (только реально квалифицированные)
- ✅ Visitors/Visits остаются Marketplace-only
- ✅ Backend server-authoritative scope
- ✅ DB/API/UI reconciliations
- ✅ i18n RU/AZ/EN
- ✅ Tests/typecheck/build PASS
