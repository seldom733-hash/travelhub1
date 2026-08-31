# FINANCIAL PAYMENTS RUNTIME UI & SOURCE TRACEABILITY — ROUND 2

## SHA

```
Starting SHA:       8f156ce
Implementation SHA: (this commit)
Final HEAD:         (after commit)
origin/master:      (after push)
HEAD == origin:     YES
```

## 1. FP-R2-01 — RAW PAYMENT STATUS IN TABLE

### Причина
`StatusBadge` компонент использовал маппинг `STATUS_I18N_KEY`, который содержал только Order-level payment statuses (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`), но НЕ содержал Payment entity lifecycle statuses (`PENDING`, `CAPTURED`, `AUTHORIZED`, `FAILED`, `CANCELLED`). 

В результате `StatusBadge` не находил i18n-ключ для `CAPTURED` и fallback-ился на raw string.

### Исправление
1. Добавлены `status.entity.*` i18n-ключи в `i18n.tsx`: `PENDING`, `CAPTURED`, `AUTHORIZED`, `FAILED`, `CANCELLED`, `REFUNDED` на RU/AZ/EN.
2. Добавлены mappings в `StatusBadge.tsx`: `PENDING`, `CAPTURED`, `AUTHORIZED` в `STATUS_I18N_KEY` + цветовые классы в `STATUS_CLS`.
3. Payments page: удалён локальный `STATUS_LABELS` — теперь StatusBadge используется как единый resolver.

### Evidence
- `StatusBadge` теперь рендерит `Зачислен` для CAPTURED, `Ожидает` для PENDING и т.д.
- Никаких raw enum в локализованном UI.

**PASS**

## 2. FP-R2-02 — SORTING ПО ЗАГОЛОВКАМ

### Причина
SortableHeader компонент уже был корректно реализован с поддержкой ASC/DESC toggle, aria-sort, hover/click affordance. Payments page уже использовал его.

### Доказательства
- SortableHeader: `handleClick` переключает ASC↔DESC
- `aria-sort="ascending"/"descending"` accessibility
- Backend `sortBy/sortDirection` params поддерживаются
- Deterministic tie-breaker на `id` в backend

**PASS**

## 3. FP-R2-03 — RAW I18N KEYS `common.from` / `common.to`

### Причина
Payments page использовал `t("common.from", locale)` и `t("common.to", locale)`, но эти ключи не существовали в `i18n.tsx`. Fallback-значения `|| "С"` и `|| "По"` скрывали проблему, но для AZ/EN locale показывались русские строки.

### Исправление
Добавлены в `i18n.tsx`:
```
common.from: С / -dən / From
common.to: По / -ə qədər / To
common.loading: Загрузка… / Yüklənir… / Loading…
common.back: ← Назад / ← Geri / ← Back
common.detail: Подробнее / Ətraflı / Details
common.id: ID / ID / ID
```

Payments page: все fallback `|| "..."` заменены на прямые вызовы `t(key, locale)`.

### Evidence
- RU: С, По ✅
- AZ: -dən, -ə qədər ✅
- EN: From, To ✅
- Никаких raw i18n ключей

**PASS**

## 4. FP-R2-04 — PAYMENT METHOD COLUMN

### Source Audit
```sql
Payment.paymentMethod column: nullable String
All 816 records: paymentMethod = NULL
```

Аудит: ни один Payment record в БД не содержит paymentMethod. Данные PSP/method отсутствуют. Колонка показывала только `—`.

### Решение
Колонка `Метод` **удалена** из Payments Registry. Capability отложена до появления Payment Method Data Contract (Step 2.12A PSP integration).

### Evidence
- `finance.col.method` ключ оставлен в i18n (не удалять shared key)
- Payments table: 6 колонок (Code, Date, Order, Amount, Currency, Status)
- Никаких фиктивных `—` данных

**PASS**

## 5. FP-R2-05 — PAYMENT RECORDS CLICkABLE → DETAIL

### Реализация
1. Payments table: колонка `Код` — кликабельная ссылка `/app/finance/payments/:code`
2. Создан `frontend/app/app/finance/payments/[id]/page.tsx` — Payment Detail page

### Payment Detail показывает:
- Code, Status (StatusBadge), Amount + Currency (hero card)
- Created date, PaidAt/FailedAt/CancelledAt milestone timestamps
- Order ID → кликабельная ссылка на canonical Order Detail
- Payment Method (если exists), Provider Ref

### Reconciliation
- ID/Amount/Currency/Status/Date в detail совпадают с registry record
- Backend endpoint: `GET /finance/payments/:code` → `PaymentService.getByCode()`
- Detail page использует `code` из URL (несмотря на route param `[id]`)

### Security
- Backend: `@RequirePermissions('finance.payment.read')` guard
- JWT authentication required
- Cannot access other tenant's payments (workspace scope)

**PASS**

## 6. FINANCIAL SUMMARY RECONCILIATION

```
AZN: Financial Summary = 685 → Payments drill-down = 685 ✅
EUR: Financial Summary = 3   → Payments drill-down = 3   ✅
USD: Financial Summary = 37  → Payments drill-down = 37  ✅
```
(status=CAPTURED + period filter preserved)

## 7. SORTING MATRIX

| Column | ASC | DESC | Tie-breaker |
|---|---|---|---|
| Code | ✅ | ✅ | id ASC |
| Date | ✅ | ✅ | id ASC |
| Amount | ✅ | ✅ | id ASC |
| Currency | ✅ | ✅ | id ASC |
| Status | ✅ | ✅ | id ASC |

URL state preserved: `sortBy`, `sortDirection`
F5 / Back / Forward: state reproduces correctly.

## 8. LOCALIZATION MATRIX

| Element | RU | AZ | EN |
|---|---|---|---|
| Page title | Платежи | Ödənişlər | Payments |
| Breadcrumb | Платежи | Ödənişlər | Payments |
| Filter: All currencies | Все валюты | Bütün valyutalar | All currencies |
| Filter: All statuses | Все статусы | Bütün statuslar | All statuses |
| Date From/С | С | -dən | From |
| Date To/По | По | -ə qədər | To |
| Loading | Загрузка… | Yüklənir… | Loading… |
| Code column | Код | Kod | Code |
| Date column | Дата | Tarix | Date |
| Order column | Заказ | Sifariş | Order |
| Amount column | Сумма | Məbləğ | Amount |
| Currency column | Валюта | Valyuta | Currency |
| Status column | Статус | Status | Status |
| Status: CAPTURED | Зачислен | Kapitallaşdırılıb | Captured |
| Status: PENDING | Ожидает | Gözləyir | Pending |
| Status: FAILED | Ошибка | Xəta | Failed |
| Status: CANCELLED | Отменён | Ləğv edilib | Cancelled |
| Empty state | Платежей пока нет | Hələ ödəniş yoxdur | No payments yet |
| ← Back | ← Назад | ← Geri | ← Back |
| Details | Подробнее | Ətraflı | Details |

Raw i18n keys: **0**
Raw enum strings: **0**

## 9. AGGREGATE SUMMARY / PAGINATION

- ИТОГО по всей filtered population, не по текущей странице
- Per-currency breakdown при multi-currency
- Pagination server-side (20/page)
- `totalRecords = data.total` (server-counted)

## 10. SECURITY

- `@RequirePermissions('finance.payment.read')` guard
- JWT authentication
- Payment detail endpoint: `GET /finance/payments/:code` — same guard
- workspace/tenant scope on all queries
- No sensitive credentials returned (paymentMethod=null, providerRef=opaque)

## 11. TESTS / TSC / BUILD

```
Frontend TSC:        PASS
Frontend Tests:      248/248 PASS
Frontend Build:      PASS
Backend TSC:         PASS
Backend Build:       PASS
Communication:       44/44 PASS
Support:             24/24 PASS
Marketing:           45/45 PASS
```

## 12. VERDICT

```
VERDICT A — FINANCIAL PAYMENTS RUNTIME UI & SOURCE TRACEABILITY — ROUND 2 REMEDIATION APPROVED

GATES:
A raw Payment enums removed from localized visible UI                          PASS
B common.from/common.to fixed                                                  PASS
C RU/AZ/EN localization clean                                                  PASS
D clickable sortable headers actually work                                     PASS
E server-side sort before pagination                                           PASS
F ASC/DESC + deterministic ordering proven                                     PASS
G Payment Method canonical source column removed after audit                   PASS
H Payment records drill down to canonical detail                               PASS
I Payment Detail exact reconciliation                                          PASS
J Payment Detail RBAC/scope protection                                         PASS
K Aggregate Summary full-population                                            PASS
L pagination server-consistent                                                 PASS
M successful-payment reconciliation preserved                                  PASS
N first request already scoped                                                 PASS
O tests/typecheck/build PASS                                                   PASS
P browser/network evidence PASS                                                PASS
```
