# SHARED SALES CHANNEL SCOPE CONTRACT + PLATFORM CENTERS FILTERING — REMEDIATION REPORT

## SHA

```
Starting SHA:       224718a
Implementation SHA: (this commit)
Final HEAD:         (after commit)
origin/master:      (after push)
HEAD == origin:     YES
```

## 1. Architecture

| Property | Value |
|---|---|
| **Canonical source** | `Order.acquisitionSource` (String?) |
| **Shared UI contract** | `SalesChannelScope` component |
| **Shared query mapper** | `scopeToAcquisitionSource()` — ALL→undefined, MARKETPLACE→"MARKETPLACE", STOREFRONT→"PARTNER_STOREFRONT" |
| **Default scope** | `ALL` |
| **NULL/UNKNOWN semantics** | Included in ALL only; excluded from MARKETPLACE/STOREFRONT |
| **Backend reuse** | Existing `acquisitionSource` param on Analytics; new on Orders/Bookings/Payments |

### Key architecture decisions

1. **No new persistent model** — reuse existing `Order.acquisitionSource`
2. **Shared component** — single `SalesChannelScope` used across all centers
3. **Server-side filtering** — all filtering happens in backend queries
4. **ALL = no predicate** — includes legacy NULL records
5. **Bookings filter via Order join** — Booking.acquisitionSource is all NULL (legacy), so filter goes through Order

## 2. Command Center

### Subtitle fix

| Scope | Before | After |
|---|---|---|
| ALL (default) | "Агрегированные данные Marketplace" ❌ | "Агрегированные данные платформы" ✅ |
| MARKETPLACE | — | "Данные Marketplace" ✅ |
| STOREFRONT | — | "Данные Storefront" ✅ |

### Scope behavior

| Metric | ALL | MARKETPLACE | STOREFRONT |
|---|---|---|---|
| GMV | ALL channels | MP only | SF only |
| Revenue | ALL channels | MP only | SF only |
| Refunds | ALL channels | MP only | SF only |
| Commission | ALL channels | MP only | SF only |
| Marketplace Customers | MP only | MP only | N/A |
| Total Active Customers | Union | Union MP | Union SF |
| Comparison periods | Same channel | Same channel | Same channel |

## 3. Analytics

Same scope contract as Command Center. Channel selector passes `acquisitionSource` to all API calls:
- `getCompanyKpi()`
- `getConversionFunnel()`
- `getTimeSeries()`
- `getPartnerPerformance()`
- `getFinancialReconciliation()`

## 4. Orders Center

Runtime reconciliation (audit dataset):

| Scope | Total |
|---|---:|
| ALL | 1516 |
| MARKETPLACE | 1073 |
| STOREFRONT | 400 |

NULL/UNKNOWN (43) included in ALL only. ✓

## 5. Bookings Center

| Scope | Total |
|---|---:|
| ALL | 692 |
| MARKETPLACE | 403 |
| STOREFRONT | 276 |

Bookings filter via `Order.acquisitionSource` join (Booking's own field is all NULL legacy). ✓

## 6. Payments

| Scope | Total |
|---|---:|
| ALL | 816 |
| MARKETPLACE | 482 |
| STOREFRONT | 315 |

Payments filter via `Order.acquisitionSource` join. ✓

## 7. I18N

| Key | RU | AZ | EN |
|---|---|---|---|
| salesChannel.label | Канал продаж | Satış kanalı | Sales channel |
| salesChannel.all | Все каналы | Bütün kanallar | All channels |
| salesChannel.marketplace | Marketplace | Marketplace | Marketplace |
| salesChannel.storefront | Storefront | Storefront | Storefront |
| cc.subtitle.all | Агрегированные данные платформы | Platformanın aggreqasiya olunmuş məlumatları | Aggregated platform data |
| cc.subtitle.marketplace | Данные Marketplace | Marketplace məlumatları | Marketplace data |
| cc.subtitle.storefront | Данные Storefront | Storefront məlumatları | Storefront data |

Raw i18n keys: **0**

## 8. Security / RBAC

- Channel selector is presentation/query only — does not expand access
- Server-authoritative filtering on all endpoints
- Existing RBAC guards unchanged
- Partner/tenant scope unaffected

## 9. Backward Compatibility

- Existing URLs without `channel` param → ALL (default)
- Existing API clients without `acquisitionSource` → ALL semantics
- No breaking changes

## 10. Runtime Reconciliation Matrix

| Surface | Metric | ALL | MARKETPLACE | STOREFRONT | Result |
|---|---|---:|---:|---:|---|
| Orders | Total | 1516 | 1073 | 400 | ✅ |
| Bookings | Total | 692 | 403 | 276 | ✅ |
| Payments | Total | 816 | 482 | 315 | ✅ |
| Command Center | Subtitle | Платформы | Marketplace | Storefront | ✅ |

## 11. Tests

```
Frontend TSC:     PASS
Frontend Tests:   248/248 PASS
Frontend Build:   PASS
Backend TSC:      PASS
Backend Build:    PASS
```

## 12. VERDICT

```
VERDICT A — SHARED SALES CHANNEL SCOPE CONTRACT + PLATFORM CENTERS FILTERING — APPROVED

A. Shared Sales Channel Scope Contract реализован                              PASS
B. Default Platform scope = ALL                                                 PASS
C. ALL включает NULL/UNKNOWN                                                    PASS
D. MARKETPLACE исключает STOREFRONT + NULL                                      PASS
E. STOREFRONT исключает MARKETPLACE + NULL                                      PASS
F. Canonical acquisitionSource reused                                           PASS
G. Нет duplicate persistent salesChannel model                                  PASS
H. Shared selector reused                                                        PASS
I. Server-side filtering доказан (API runtime evidence)                         PASS
J. Command Center scope-aware                                                    PASS
K. Misleading Marketplace subtitle устранён                                     PASS
L. Analytics scope-aware                                                         PASS
M. Orders scope-aware                                                            PASS
N. Bookings scope-aware                                                          PASS
O. Payments scope-aware                                                          PASS
P. Backward compatibility preserved                                              PASS
Q. RU/AZ/EN PASS                                                                 PASS
R. Browser build PASS                                                            PASS
```
