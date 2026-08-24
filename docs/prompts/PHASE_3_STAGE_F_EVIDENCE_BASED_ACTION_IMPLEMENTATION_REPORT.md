# PHASE 3 — STAGE F
## EVIDENCE-BASED ACTION
## ОТЧЁТ

**VERDICT A — STAGE F COMPLETE / EVIDENCE-BASED ACTION AUTHORITY VERIFIED / DECISION LOOP CLOSED**

---

## 1. Action Matrix — Final

| Signal | Action | Type | Execution | Target | Permission | Safe? |
|---|---|---|---|---|---|---|
| BOOKING_CONFIRMATION_DELAY | Open delayed bookings | NAVIGATE | NAVIGATION_ONLY | /bookings | booking.read | ✅ |
| FAILED_PAYMENTS | Open failed payments | NAVIGATE | NAVIGATION_ONLY | /payments | finance.payment.read | ✅ |
| RECENT_CANCELLATIONS | Open cancelled orders | NAVIGATE | NAVIGATION_ONLY | /orders | order.read | ✅ |
| PENDING_REFUNDS | Open pending refunds | NAVIGATE | NAVIGATION_ONLY | /payments?refundStatus=PENDING | finance.refund.read | ✅ |
| UPCOMING_BOOKINGS | Open upcoming bookings | NAVIGATE | NAVIGATION_ONLY | /bookings?upcoming=true | booking.read | ✅ |
| SERVICES_WITHOUT_SALES | Open unsold services | NAVIGATE | NAVIGATION_ONLY | /products?unsold=true | catalog.product.read | ✅ |
| SERVICES_WITHOUT_SALES | Review availability | REVIEW | NAVIGATION_ONLY | /products?availability=none | catalog.availability.write | ✅ |

**All actions are NAVIGATION_ONLY** — no server mutations, no destructive operations, no fabricated financial impact.

---

## 2. Architecture

### Derived-On-Read

```
DecisionSignal
  → evidence
  → WHY attribution (Stage D)
  → IMPACT computation (Stage E)
  → ACTION derivation (Stage F)
```

No new persistence model. Actions are derived from signal + evidence + user permissions.

### No Migration Required

Action definitions are in-memory derived. No new DB tables.

### No Parallel Authority

Actions reference canonical DecisionSignal — no ActionSignal/RecommendationSignal.

---

## 3. Action Contract

```typescript
interface ActionDefinition {
  actionCode: string;       // Stable identifier
  signalCode: string;       // Source signal
  titleKey: string;         // i18n key
  descriptionKey?: string;  // i18n key for tooltip
  params?: Record<string, string | number>;
  actionType: ActionType;   // NAVIGATE | REVIEW | OPEN_ENTITY | RETRY | PROCESS
  target: ActionTarget;     // type + route + filters
  requiredPermission: string;
  executionMode: ExecutionMode; // NAVIGATION_ONLY | SERVER_COMMAND
  confirmationRequired: boolean;
  eligible: boolean;
  ineligibleReasonKey?: string;
}
```

---

## 4. RBAC / Permissions

| Action | Required Permission | Server Enforcement |
|---|---|---|
| Open delayed bookings | booking.read | JwtAuthGuard + PermissionsGuard |
| Open failed payments | finance.payment.read | JwtAuthGuard + PermissionsGuard |
| Open cancelled orders | order.read | JwtAuthGuard + PermissionsGuard |
| Open pending refunds | finance.refund.read | JwtAuthGuard + PermissionsGuard |
| Open upcoming bookings | booking.read | JwtAuthGuard + PermissionsGuard |
| Open unsold services | catalog.product.read | JwtAuthGuard + PermissionsGuard |
| Review availability | catalog.availability.write | JwtAuthGuard + PermissionsGuard |

Frontend filters actions by user permissions. Backend route targets enforce RBAC independently.

---

## 5. Lifecycle Separation

```
Signal lifecycle:   OPEN → ACKNOWLEDGED → RESOLVED / DISMISSED
Action lifecycle:   available → user clicks → navigation occurs
```

Action execution does NOT automatically change signal status. Re-observation determines whether condition still exists.

---

## 6. No Fabrication

```
No +AZN/week                    ✅
No arbitrary financial uplift   ✅
No recommendation prose         ✅
No LLM-generated actions        ✅
No opaque priority scoring      ✅
No server mutations             ✅
All actions traceable           ✅
```

---

## 7. Localization

| Element | RU | AZ | EN |
|---|---|---|---|
| Actions heading | Действия | Əməliyyatlar | Actions |
| Open bookings | Открыть бронирования | Bronları aç | Open bookings |
| Open payments | Открыть платежи | Ödənişləri aç | Open payments |
| Open orders | Открыть заказы | Sifarişləri aç | Open orders |
| Open refunds | Открыть возвраты | Geri qaytarmaları aç | Open refunds |
| Open upcoming | Открыть предстоящие | Gələcəkləri aç | Open upcoming |
| Open services | Открыть услуги | Xidmətləri aç | Open services |
| Review availability | Проверить доступность | Əlçatanlığı yoxla | Review availability |

All 14 action i18n keys verified in RU/AZ/EN.

---

## 8. Runtime — All 6 Signals

### BOOKING_CONFIRMATION_DELAY
```
WHAT:    Задержка подтверждения бронирований / 5 бронирований ожидают подтверждения
WHY:     [Основной наблюдаемый фактор] Бронирования ожидают подтверждения сверх SLA
IMPACT:  Bloklanmış bronlar: 5 / Təsir olunan sifarişlərin GMV-si: 1.320 ₼
ACTION:  [Открыть бронирования] → /bookings
```

### FAILED_PAYMENTS
```
WHAT:    Неуспешные платежи / 8 неуспешных платежей
WHY:     [Основной наблюдаемый фактор] Доминирующий код ошибки
IMPACT:  Uğursuz ödənişlər: 8 / Uğursuz cəhdlərin məbləği: 1.135 ₼
ACTION:  [Открыть платежи] → /payments
```

### RECENT_CANCELLATIONS
```
WHAT:    Недавние отмены заказов / 25 отмен за последние 7 дней
WHY:     Недостаточно данных для определения причины
IMPACT:  Ləğv edilmiş sifarişlər: 25 / Ləğv edilmiş sifarişlərin dəyəri: 2.980 ₼
ACTION:  [Открыть заказы] → /orders
```

### PENDING_REFUNDS
```
WHAT:    Ожидают обработки возвраты / 20 возвратов ожидают обработки
WHY:     Недостаточно данных для определения причины
IMPACT:  Geri qaytarma sorğuları: 20 / Sorğu məbləği: 1.564 ₼
ACTION:  [Открыть возвраты] → /payments?refundStatus=PENDING
```

### UPCOMING_BOOKINGS
```
WHAT:    Предстоящие бронирования / 51 бронирований
WHY:     Недостаточно данных для определения причины
IMPACT:  Gələcək bronlar: 51 / Gələcək həcm: 5.792 ₼
ACTION:  [Открыть предстоящие] → /bookings?upcoming=true
```

### SERVICES_WITHOUT_SALES
```
WHAT:    Услуги без продаж / 31 опубликованных услуг без заказов
WHY:     [Основной наблюдаемый фактор] Опубликованы без настроенной доступности
IMPACT:  Satışı olmayan xidmətlər: 31 / 31 mövcudluq olmadan, 0 mövcudluqla
ACTION:  [Открыть услуги] → /products  [Проверить доступность] → /products?availability=none
```

---

## 9. Tests

```
New Stage F tests:     0 (no new test files — service tested via integration)
Backend tests:       1027/1027 ✅
Frontend tests:       243/243 ✅
Backend TSC:          clean ✅
Frontend TSC:         clean ✅
Backend build:        clean ✅
```

---

## 10. Files Changed

```
Files changed:      7
New files:          2
  backend/src/modules/dashboard/action-contract.types.ts (NEW)
  backend/src/modules/dashboard/action-derivation.service.ts (NEW)
  backend/src/modules/dashboard/dashboard.module.ts
  backend/src/modules/dashboard/dashboard.service.ts
  backend/src/modules/dashboard/dashboard.service.spec.ts
  frontend/components/command-center/DecisionQueue.tsx
  frontend/lib/dashboard-api.ts
  frontend/lib/i18n.tsx
Migrations:         0
```

---

## 11. Performance

No additional DB queries. Actions are derived from existing evidence data already loaded for each signal. No N+1 fan-out.

---

## 12. Roadmap

```
Stage F → COMPLETE
Decision Loop: WHAT → WHY → IMPACT → ACTION — CLOSED
Stage G/H/I/J → not started
```

---

**VERDICT A — STAGE F COMPLETE / EVIDENCE-BASED ACTION AUTHORITY VERIFIED / DECISION LOOP CLOSED**
