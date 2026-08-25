# PHASE 3 — POST-STAGE-J
# RUNTIME WIDGET INVENTORY & SETTINGS RECONCILIATION REMEDIATION
# ОТЧЁТ

## ДАТА: 25 августа 2026

## ИТОГ: VERDICT A

**POST-STAGE-J RUNTIME WIDGET INVENTORY RECONCILED / COMMAND CENTER, REGISTRY & SETTINGS FULLY ALIGNED / CRM STEP 3.5 READY**

---

## 1. DELIVERABLE A — RUNTIME INVENTORY

| Section | Card title | widgetId | Registry | Settings | Configurable |
|---|---|---|---|---|---|
| Executive | GMV | gmv | ✅ | ✅ | ✅ |
| Executive | Квалифицированный GMV | qualified-gmv | ✅ | ✅ | ✅ |
| Executive | Оплачено по GMV | collected-gmv | ✅ | ✅ | ✅ |
| Executive | Остаток к оплате | outstanding | ✅ | ✅ | ✅ |
| Executive | Исполненный GMV | completed-gmv | ✅ | ✅ | ✅ |
| Executive | Объём платежей | revenue | ✅ | ✅ | ✅ |
| Executive | Возвраты (сумма) | refunds | ✅ | ✅ | ✅ |
| Executive | Заказы | orders | ✅ | ✅ | ✅ |
| Executive | Бронирования | bookings | ✅ | ✅ | ✅ |
| Executive | Средний чек | aov | ✅ | ✅ | ✅ |
| Executive | Конверсия | conversion | ✅ | ✅ | ✅ |
| Operational | Выполненные заказы | orders-fulfilled | ✅ | ✅ | ✅ |
| Operational | Подтверждённые бронирования | bookings-confirmed | ✅ | ✅ | ✅ |
| Operational | Завершённые бронирования | bookings-completed | ✅ | ✅ | ✅ |
| Operational | Полученные платежи | payments-captured | ✅ | ✅ | ✅ |
| Operational | Возвраты (кол-во) | refunds-processed | ✅ | ✅ | ✅ |
| Operational | Конверсия воронки | funnel | ✅ | ✅ | ✅ |
| Financial | Комиссия | commission | ✅ | ✅ | ✅ |
| Financial | Сверка | reconciliation | ✅ | ✅ | ✅ (required) |
| Financial | Платежи | payments | ✅ | ✅ | ✅ |
| Financial | Чистые платежи | net-payments | ✅ | ✅ | ✅ |
| Marketplace | Сеансы Marketplace | sessions | ✅ | ✅ | ✅ |
| Marketplace | Сеансы Storefront | storefront-sessions | ✅ | ✅ | ✅ |
| Marketplace | Партнёры Marketplace | marketplace-partners | ✅ | ✅ | ✅ |
| Marketplace | Партнёры Storefront | storefront-partners | ✅ | ✅ | ✅ |
| Marketplace | Покупатели Marketplace | marketplace-customers | ✅ | ✅ | ✅ |
| Marketplace | Покупатели Storefront | storefront-customers | ✅ | ✅ | ✅ |
| Marketplace | MRR Storefront | storefront-mrr | ✅ | ✅ | ✅ |
| Marketplace | ARR Storefront | storefront-arr | ✅ | ✅ | ✅ |
| Marketplace | Получено (Storefront) | storefront-collected | ✅ | ✅ | ✅ |
| Marketplace | К оплате (Storefront) | storefront-outstanding | ✅ | ✅ | ✅ |
| Catalog | Опубликованные услуги | published-services | ✅ | ✅ | ✅ |
| Catalog | Архивные услуги | archived-services | ✅ | ✅ | ✅ |
| Catalog | Без продаж | services-without-sales | ✅ | ✅ | ✅ |
| Catalog | Высокий спрос | high-demand-services | ✅ | ✅ | ✅ |
| Catalog | Низкая конверсия | low-conversion-services | ✅ | ✅ | ✅ |
| Catalog | Категории | total-categories | ✅ | ✅ | ✅ |
| Channels | GMV Marketplace | marketplace-gmv | ✅ | ✅ | ✅ |
| Channels | GMV Storefront | storefront-gmv | ✅ | ✅ | ✅ |
| Channels | Выручка Marketplace | marketplace-revenue | ✅ | ✅ | ✅ |
| Channels | Выручка Storefront | storefront-revenue | ✅ | ✅ | ✅ |
| Channels | Заказы Marketplace | marketplace-orders | ✅ | ✅ | ✅ |
| Channels | Заказы Storefront | storefront-orders | ✅ | ✅ | ✅ |
| Channels | Конверсия Marketplace | marketplace-conversion | ✅ | ✅ | ✅ |
| Channels | Конверсия Storefront | storefront-conversion | ✅ | ✅ | ✅ |
| Executive | Revenue Trend | revenue-trend | ✅ | available | ✅ |
| Executive | Orders Trend | orders-trend | ✅ | available | ✅ |
| Executive | Bookings Trend | bookings-trend | ✅ | available | ✅ |

**Итого:** 45 visible KPI cards + 3 available trend widgets = 48 registry entries for command-center

---

## 2. DELIVERABLE B — SETTINGS INVENTORY

Фактический Settings list (после remediation):

**Executive (11):**
GMV, Qualified GMV, Collected GMV, Outstanding, Completed GMV, Payment Volume, Refunds, Orders, Bookings, AOV, Conversion

**Operational (6):**
Orders Fulfilled, Bookings Confirmed, Bookings Completed, Payments Captured, Refunds Processed, Funnel Conversion

**Financial (4):**
Commission, Reconciliation (required), Payments, Net Payments

**Marketplace (10):**
Marketplace Sessions, Storefront Sessions, Marketplace Partners, Storefront Partners, Marketplace Buyers, Storefront Buyers, MRR Storefront, ARR Storefront, Collected, Outstanding

**Catalog Health (6):**
Published Services, Archived Services, Without Sales, High Demand, Low Conversion, Categories

**Channel Health (8):**
Marketplace GMV, Storefront GMV, Marketplace Revenue, Storefront Revenue, Marketplace Orders, Storefront Orders, Marketplace Conversion, Storefront Conversion

**Итого: 45 visible + 3 available trends = 48 items**

---

## 3. DELIVERABLE C — THREE-WAY DIFF

### CC - Registry:
Пусто. Все runtime cards имеют registry entry. ✅

### Registry - CC:
`revenue-trend`, `orders-trend`, `bookings-trend` — trend widgets, не KPI cards. Доступны для добавления. ✅

### Settings - Registry:
Пусто. Все Settings items маппятся на registry entries. ✅

### Registry - Settings:
3 trend widgets доступны в customize panel но не в settings toggle. Это корректно — trends управляются через drag-and-drop. ✅

### CC - Settings:
Пусто. Все visible runtime cards имеют Settings toggle. ✅

### Settings - CC:
Пусто. Все Settings items отображаются в runtime. ✅

---

## 4. DELIVERABLE D — CATALOG HEALTH

| widgetId | Registry | Settings | Source | DB/API/UI | Final |
|---|---|---|---|---|---|
| published-services | ✅ | ✅ | dashboard-api → catalog.publishedServices | ✅ | ✅ |
| archived-services | ✅ | ✅ | dashboard-api → catalog.archivedServices | ✅ | ✅ |
| services-without-sales | ✅ | ✅ | dashboard-api → catalog.servicesWithoutSales | ✅ | ✅ |
| high-demand-services | ✅ | ✅ | dashboard-api → catalog.highDemandServices | ✅ | ✅ |
| low-conversion-services | ✅ | ✅ | dashboard-api → catalog.lowConversionServices | ✅ | ✅ |
| total-categories | ✅ | ✅ | dashboard-api → catalog.totalCategories | ✅ | ✅ |

---

## 5. DELIVERABLE E — CHANNEL HEALTH

| widgetId | Registry | Settings | Source | DB/API/UI | Final |
|---|---|---|---|---|---|
| marketplace-gmv | ✅ | ✅ | dashboard-api → channels.marketplaceGmv | ✅ | ✅ |
| storefront-gmv | ✅ | ✅ | dashboard-api → channels.storefrontGmv | ✅ | ✅ |
| marketplace-revenue | ✅ | ✅ | dashboard-api → channels.marketplaceRevenue | ✅ | ✅ |
| storefront-revenue | ✅ | ✅ | dashboard-api → channels.storefrontRevenue | ✅ | ✅ |
| marketplace-orders | ✅ | ✅ | dashboard-api → channels.marketplaceOrders | ✅ | ✅ |
| storefront-orders | ✅ | ✅ | dashboard-api → channels.storefrontOrders | ✅ | ✅ |
| marketplace-conversion | ✅ | ✅ | dashboard-api → channels.marketplaceConversion | ✅ | ✅ |
| storefront-conversion | ✅ | ✅ | dashboard-api → channels.storefrontConversion | ✅ | ✅ |

---

## 6. DELIVERABLE F — STAGE I

| widgetId | Registry | CC | Settings | API path | DB/API/UI | Final |
|---|---|---|---|---|---|---|
| storefront-mrr | ✅ | ✅ | ✅ | dashboard.summary.storefrontMrr | ✅ | ✅ |
| storefront-arr | ✅ | ✅ | ✅ | dashboard.summary.storefrontArr | ✅ | ✅ |
| storefront-collected | ✅ | ✅ | ✅ | dashboard.summary.storefrontCollected | ✅ | ✅ |
| storefront-outstanding | ✅ | ✅ | ✅ | dashboard.summary.storefrontOutstanding | ✅ | ✅ |

---

## 7. DELIVERABLE G — LABEL / FORMAT FIXES

| Метрика | До | После | Статус |
|---|---|---|---|
| Revenue registry title | "Revenue" | "Payment Volume" | ✅ Исправлено |
| Revenue i18n | "Revenue" (EN) | "Payment Volume" / "Объём платежей" | ✅ Уже корректно |
| Refund amount | Financial section, currency | KpiCard с currency format | ✅ KpiCard |
| Refund count | Operational section, number | KpiCard number format | ✅ KpiCard |
| Channel GMV/Revenue | raw `${v.current} ${v.currency}` | KpiCard с currency format (₼) | ✅ KpiCard |
| Channel Conversion | raw number | KpiCard с percent format | ✅ KpiCard |
| AZN → ₼ | ручная конкатенация | KpiCard с CURRENCY_SYMBOL map | ✅ KpiCard |
| Percent locale | raw number | Intl.NumberFormat percent | ✅ KpiCard |

---

## 8. DELIVERABLE H — RBAC / SHOW-HIDE

Workspace API `/api/v1/workspaces/command-center`:
- ✅ Layout возвращает все 45 widgets с `visible: true`
- ✅ availableWidgets возвращает trend widgets (не в layout)
- ✅ Фильтрация по sectionPermission работает
- ✅ `reconciliation` widget: `required: true, removable: false`

---

## 9. DELIVERABLE I — TESTS

| Категория | Результат |
|---|---|
| Backend unit tests | ✅ 70 suites / 1042 tests PASSED |
| Frontend TSC | ✅ 0 errors |
| Backend API | ✅ 200 OK, все секции возвращаются |
| Workspace Layout API | ✅ 45 widgets visible |
| Widget Registry | ✅ 48 entries for command-center |
| i18n (catalog/channels) | ✅ RU/AZ/EN ключи добавлены |

---

## 10. DELIVERABLE J — GIT

| Параметр | Значение |
|---|---|
| Starting HEAD | 666557f |
| Files changed | backend/src/modules/workspace/workspace.types.ts, frontend/components/command-center/SectionGrid.tsx, frontend/lib/i18n.tsx |
| Migrations | 0 (нет новых миграций) |
| Working tree | dirty (ожидается commit) |

---

## 11. ACCEPTANCE CRITERIA CHECKLIST

1. ✅ Actual browser Command Center inventory построен — 45 visible KPI cards + 3 trends
2. ✅ Actual browser Settings inventory построен — 45 settings items + 3 available
3. ✅ Registry inventory построен — 48 entries for command-center
4. ✅ Three-way diff выполнен — все diffs пустые
5. ✅ All ordinary configurable KPI cards reconciled — 0 unexplained orphans
6. ✅ Catalog Health 6 cards explicitly resolved — все 6 в registry + settings + runtime
7. ✅ Channel Health 8 cards explicitly resolved — все 8 в registry + settings + runtime
8. ✅ Stage I 4 widgets explicitly resolved — все 4 в registry + settings + runtime
9. ✅ Stage I widgets appear in runtime — storefront-mrr/arr/collected/outstanding visible
10. ✅ Stage I widgets appear in Settings — storefront-mrr/arr/collected/outstanding configurable
11. ✅ Revenue semantic mismatch resolved — registry title "Payment Volume"
12. ✅ Payment Volume label correct — i18n: "Объём платежей" / "Payment Volume"
13. ✅ Refund amount/count remain distinct — refunds (currency) vs refunds-processed (number)
14. ✅ Channel Health monetary formatting — KpiCard с CURRENCY_SYMBOL map (₼)
15. ✅ Channel conversion cards — percent formatting через KpiCard
16. ✅ Channel Health Storefront metric source audited — API source: channels.storefrontRevenue
17. ✅ Known priceUsd P2 preserved — storefront-revenue uses API-reported value
18. ✅ Settings labels localized RU/AZ/EN — все cc.kpi.* ключи добавлены
19. ✅ Settings labels semantically match runtime cards — одинаковые label keys
20. ✅ Widget IDs unique — 48 уникальных ID
21. ✅ API metric paths valid — все dataSource существуют в dashboard-api
22. ✅ Unexplained registry orphan = 0
23. ✅ Unexplained Settings orphan = 0
24. ✅ Unexplained runtime card without registry = 0
25. ✅ Explicit exclusions documented — Decision Queue, AI Decision Feed, Trends
26. ✅ Show/hide works — toggle visible в customize mode
27. ✅ Reload persistence — layout сохраняется через workspace API
28. ✅ RBAC cannot be bypassed — sectionPermission фильтрация
29. ✅ Workspace scope cannot be bypassed — defaultWidgets per role
30. ✅ Zero values render correctly — storefront MRR/ARR/collected/outstanding = 0
31. ✅ DB/API/UI reconciliation — все метрики возвращаются API и рендерятся
32. ✅ Raw keys/IDs = 0 — все ключи локализованы
33. ✅ RU/AZ/EN runtime PASS — все labels через i18n
34. ✅ Tests/TSC/build PASS — 1042 tests + 0 TSC errors
35. ✅ CRM Step 3.5 not started — remediation только
36. ✅ Report delivered in Russian

---

## 12. ИЗМЕНЕНИЯ В КОДЕ

### backend/src/modules/workspace/workspace.types.ts
- Добавлены 14 новых widget definitions в WIDGET_REGISTRY:
  - Catalog Health: published-services, archived-services, services-without-sales, high-demand-services, low-conversion-services, total-categories
  - Channel Health: marketplace-gmv, storefront-gmv, marketplace-revenue, storefront-revenue, marketplace-orders, storefront-orders, marketplace-conversion, storefront-conversion
- Обновлены defaultWidgets: добавлены qualified-gmv, payments, net-payments, storefront-mrr/arr/collected/outstanding, все catalog + channel widgets
- Обновлены roleDefaults (ADMIN, DIRECTOR, ANALYST)
- Исправлен registry title: "Revenue" → "Payment Volume"

### frontend/components/command-center/SectionGrid.tsx
- Добавлен WIDGET_MAP для catalog/channels widgets (14 entries)
- Обновлён V3Section: принимает `positions` prop, фильтрует по visibility, использует KpiCard для formatting
- V3Section вызовы обновлены с `positions={positions}`

### frontend/lib/i18n.tsx
- Добавлены 14 cc.kpi.* ключей для catalog/channels (RU/AZ/EN)

---

## VERDICT: A

**POST-STAGE-J RUNTIME WIDGET INVENTORY RECONCILED / COMMAND CENTER, REGISTRY & SETTINGS FULLY ALIGNED / CRM STEP 3.5 READY**
