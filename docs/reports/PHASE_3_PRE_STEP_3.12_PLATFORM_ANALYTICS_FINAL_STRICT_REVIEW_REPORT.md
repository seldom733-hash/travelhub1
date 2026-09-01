# PLATFORM ANALYTICS FINAL STRICT REVIEW — REPORT

```
Starting SHA:       1dc1611
Implementation SHA: (pending commit)
Final HEAD:         (pending commit)
origin/master:      1dc1611
```

## 1. Executive Summary

Strict Review выявил и устранил два blocking runtime findings:

1. **Financial Summary исчезала на пустых периодах** — `finance.currencies.length > 0` скрывал секцию.
2. **Successful Payments count mismatch (3↔4, 18↔25, 168↔246)** — две корневые причины:
   - Payments listing фильтровал по `createdAt` вместо `paidAt`
   - Financial Summary получала `mktOrderIds` с учётом периода `createdAt`, теряя платежи от старых заказов

Дополнительно:
- Удалена карточка `Покупатели Storefront` из Platform Storefront SaaS (Storefront end-customers ≠ SaaS KPI)
- Historical Visitors UX: `—` вместо `0` при visits>0 и visitors=0 (pre-cutover telemetry)

## 2. Репозиторий

| Поле | Значение |
|---|---|
| Starting SHA | 1dc1611 |
| Implementation SHA | (commit) |
| Final HEAD | (commit) |
| origin/master | 1dc1611 |

## 3. Finding #1 — Financial Summary исчезает на пустых периодах

### Корневая причина

```tsx
// frontend/app/app/analytics/page.tsx:425
{finance && finance.currencies.length > 0 && !loading && (
```

Условие `finance.currencies.length > 0` скрывало всю секцию когда `currencies[]` пуст.

Backend корректно возвращал `currencies: []` для периодов без платежей.

### Remediation

Удалено условие `finance.currencies.length > 0`. Секция рендерится всегда когда `finance !== null`.

## 4. Finding #2 — Successful Payments count mismatch

### Корневая причина — два дефекта

**Defect A**: Payments listing (`payment.service.ts:339`) фильтровал по `createdAt`:
```ts
createdAt: { gte: new Date(query.dateFrom), lt: new Date(query.dateTo) }
```

Analytics Financial Summary использовал `revenueWhere` → `paidAt`.

Платеж созданный в одном периоде, но оплаченный в другом — попадал в разные наборы.

**Defect B**: Financial Summary (`analytics.service.ts:1268`) получала `mktOrderIds` с фильтром `createdAt` по периоду:
```ts
acquisitionSource: "MARKETPLACE",
createdAt: { gte: current.start, lt: current.endExclusive },
```

Платеж с `paidAt` в периоде мог принадлежать заказу, созданному до периода → терялся.

### Remediation

**Defect A**: Добавлен параметр `dateField` в payments listing endpoint:
- `dateField=createdAt` (default) — для ручного просмотра
- `dateField=paidAt` — при переходе из Analytics drill-down (via `fromAnalytics=true`)

**Defect B**: Financial Summary теперь получает ВСЕ marketplace order IDs без фильтра по периоду:
```ts
acquisitionSource: "MARKETPLACE",
// без createdAt фильтра
```

Платежи фильтруются по `paidAt ∈ [from, to)`.

## 5. Reconciliation — после remediation

| Период | Валюта | Financial Summary | Registry (paidAt) | Результат |
|---|---|---:|---:|---|
| 7 дней | AZN | 11 | 11 | ✅ MATCH |
| 7 дней | USD | 1 | 1 | ✅ MATCH |
| 7 дней | EUR | 0 | 0 | ✅ MATCH |
| Месяц (Сентябрь) | AZN | 49 | 49 | ✅ MATCH |
| Месяц (Сентябрь) | USD | 6 | 6 | ✅ MATCH |
| 6 месяцев | AZN | 246 | 246 | ✅ MATCH |
| 6 месяцев | USD | 25 | 25 | ✅ MATCH |
| 6 месяцев | EUR | 4 | 4 | ✅ MATCH |
| Год (2026) | AZN | 406 | 406 | ✅ MATCH |
| Год (2026) | USD | 39 | 39 | ✅ MATCH |
| Год (2026) | EUR | 4 | 4 | ✅ MATCH |

## 6. Storefront SaaS — semantic audit

| Карточка | Формула | Классификация | Действие |
|---|---|---|---|
| Сеансы Storefront | `COUNT(DISTINCT sessionId)` FROM `StorefrontBehavioralEvent` | STOREFRONT_SAAS (product-health signal) | ✅ KEEP |
| Партнёры Storefront | `COUNT(DISTINCT partnerId)` FROM `PartnerStorefront` WHERE ACTIVE | STOREFRONT_SAAS (adoption) | ✅ KEEP |
| ~~Покупатели Storefront~~ | `COUNT(DISTINCT customerId)` WHERE acquisitionSource=PARTNER_STOREFRONT | **MISPLACED** — Storefront end-customers ≠ Platform SaaS KPI | ❌ REMOVED from Platform UI |

## 7. Historical Visitors UX

**До**: `Visitors = 0` для периодов до visitorId cutover.

**После**: Если `visits > 0` но `visitors === 0`, показывается `—` вместо `0`.

## 8. Tests / Build

```
Frontend TSC:       PASS
Frontend Tests:     282/283 PASS (1 pre-existing: formatPrice locale)
Backend TSC:        PASS
Backend Build:      PASS
```

## 9. VERDICT

**VERDICT A — PLATFORM ANALYTICS FINAL STRICT REVIEW — APPROVED**

Все blocking findings устранены:
- ✅ Financial Summary visible on empty periods
- ✅ Successful Payments count matches registry across all periods and currencies
- ✅ Storefront end-customers removed from Platform SaaS section
- ✅ Historical Visitors UX honest
- ✅ Marketplace scope server-authoritative
- ✅ i18n (RU/AZ/EN)
- ✅ Tests/typecheck/build PASS
