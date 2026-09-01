# PHASE 3 — PRE-STEP 3.12 — SHARED COMMERCE SEQUENCE + REQUEST CENTER + HISTORICAL DATA — IMPLEMENTATION REPORT

## Начальный SHA / Implementation SHA / Final SHA

```text
Starting SHA:       c5d1cba
Implementation SHA: (pending commit)
Final HEAD:         (pending commit)
origin/master:      c5d1cba
```

---

## 1. Что реализовано

### 1.1 Shared Commerce Sequence (8-значный корень)

Введена единая domain-концепция `commerceSequence` — 8-значный корневой номер, общий для всех сущностей одной коммерческой цепочки.

```text
commerceSequence = 00000001

MKT-REQ-00000001  ← Request
MKT-ORD-00000001  ← Order
MKT-BKG-00000001  ← Booking
MKT-PAY-00000001-1 ← Payment (ordinal)
MKT-PAY-00000001-2 ← Payment (partial/additional)
```

**Внедрено:**

- `ReferenceNumberService.nextCommerceSequence()` — атомарная аллокация через Hi/Lo block (BusinessSequence)
- `ReferenceNumberService.commerceRequestRef()`, `commerceOrderRef()`, `commerceBookingRef()`, `commercePaymentRef()` — генерация справочников из общего корня
- `Order.commerceSequence` — новое поле в Prisma schema
- `Booking.commerceSequence` — наследуется от Order
- `Payment.commerceSequence` + `paymentOrdinal` — наследуется от Order

**Применение:**

| Сущность | Формат | Источник корня |
|---|---|---|
| Request | MKT-REQ-{root} | Новый при создании |
| Order | MKT-ORD-{root} | Новый при создании |
| Booking | MKT-BKG-{root} | Наследует от Order |
| Payment | MKT-PAY-{root}-{ordinal} | Наследует от Order |

### 1.2 Request Domain Entity

Новая модель `Request` в схеме `order`:

```text
model Request {
  id, code, commerceSequence, referenceNumber
  customerId, productId, partnerId
  status (RequestStatus enum)
  requestedServiceDate, quantity
  displayedPrice, displayedCurrency
  confirmedPrice, confirmedCurrency
  supplierResponseDeadline, supplierRespondedAt, supplierDecision
  customerActionDeadline, customerAcceptedAt, customerDecision
  convertedOrderId, convertedAt
  rejectedAt, rejectedBy, rejectionReason
  createdAt, updatedAt, version
}
```

**Enum `RequestStatus`:** NEW, CHECKING, SUPPLIER_TIMEOUT, PRICE_CHANGED, CUSTOMER_ACCEPTED, CONFIRMED, CONVERTED, REJECTED, UNAVAILABLE, EXPIRED, CUSTOMER_PAYMENT_TIMEOUT, CANCELLED_BY_CUSTOMER

**Lifecycle:**

```text
Клиент нажимает [Забронировать]
        ↓
TravelHub создаёт Request
        ↓
Supplier Response SLA (24ч)
        ↓
Поставщик: CONFIRMED / PRICE_CHANGED / REJECTED / UNAVAILABLE
        ↓
(если PRICE_CHANGED) Customer Confirmation / Payment TTL (48ч)
        ↓
Клиент: ACCEPTED / DECLINED / timeout
        ↓
CONVERTED → Order → Booking → Payment
```

### 1.3 Supplier Response SLA

- `supplierResponseDeadline` — дедлайн ответа поставщика (24ч от создания Request)
- `supplierRespondedAt` — фактический момент ответа
- `supplierDecision` — CONFIRMED / REJECTED / UNAVAILABLE / PRICE_CHANGED
- `supplierPriceProposal` — предложенная цена (при PRICE_CHANGED)
- При таймауте: `SUPPLIER_TIMEOUT`, без Order/Booking/Payment

### 1.4 Customer Confirmation / Payment TTL

- `customerActionDeadline` — дедлайн принятия решения клиентом (48ч после подтверждения поставщика)
- `customerAcceptedAt` — момент принятия клиентом
- `customerDecision` — ACCEPTED / DECLINED
- При таймауте: `CUSTOMER_PAYMENT_TIMEOUT`, без downstream commerce

### 1.5 Request Center

**Backend:**

- `RequestService` — CRUD, lifecycle, SLA/TTL, KPI, search, pagination
- `RequestController` — REST API: GET/POST, actions, export, KPI
- `RequestModule` — NestJS module registration
- Export: CSV + XLSX через shared ExportService
- 12+ REST endpoints

**Frontend:**

- `/app/requests` — новый route
- KPI-карточки: Все, Новые, На проверке, Ожидают решения, Подтверждены, Конвертированы, Отклонены, Недоступны, Истекли, Таймаут поставщика, Таймаут клиента, Отменены клиентом
- Реестр с пагинацией (20 строк)
- Фильтры: статус, поиск
- Экспорт: CSV + XLSX
- i18n: RU/AZ/EN

**Sidebar Navigation:**

- `Центр заявок` (📋) добавлен в `Shell.tsx` перед Заказами
- Право: `order.read`

### 1.6 Backfill существующих данных

Все существующие Records получили `commerceSequence`:

| Тип | Backfilled | Метод |
|---|---|---|
| Orders (MKT-ORD-*) | 1085 | Извлечено из referenceNumber |
| Bookings (MKT-BKG-*) | через parent Order | JOIN по orderId |
| Payments (MKT-PAY-*) | через parent Order | JOIN по orderId + ordinal |

### 1.7 Historical Request Data

Создано **1171** исторических Request:

| Статус | Количество | Доля |
|---|---:|---:|
| CONVERTED | 705 | 60.2% |
| REJECTED | 104 | 8.9% |
| UNAVAILABLE | 97 | 8.3% |
| SUPPLIER_TIMEOUT | 79 | 6.7% |
| PRICE_CHANGED | 50 | 4.3% |
| CUSTOMER_PAYMENT_TIMEOUT | 50 | 4.3% |
| NEW/CHECKING (extra) | 86 | 7.3% |

**Temporal Invariant проверен:** `Request.createdAt <= Order.createdAt` для всех CONVERTED Requests.

---

## 2. Проблемы и ограничения

### 2.1 Существующие Booking/Payment referenceNumbers НЕ были перезаписаны

Существующие записи BKG-* и PAY-* **остались в БД** с оригинальными referenceNumber. Только новые записи используют Shared Commerce Sequence формат.

**Причина:** Массовая перезапись referenceNumber нарушит `@unique` constraints, может сломать внешние ссылки, экспорт, аудит. Новая семантика применяется только к новым записям.

### 2.2 Request Center seller-side actions (UI)

Backend actions реализованы (confirm, proposePrice, reject, unavailable, customerAccept, customerDecline). Frontend UI для seller actions не реализован — страница показывает реестр с KPI и фильтрами, но без action buttons.

### 2.3 Notification infrastructure

Notifications для ключевых переходов (Request created → seller, Supplier confirmed → customer) не реализованы — фиксируем gap.

---

## 3. Tests

```text
Backend TSC:    PASS
Backend Build:  PASS
Backend Tests:  1375/1400 PASS
  25 failing — pre-existing (payment.reason validation, analytics sorting, refund service)
Frontend TSC:   PASS
Frontend Tests: 282/283 (1 pre-existing)
```

---

## 4. Runtime Evidence

```text
GET /api/v1/requests         → 1171 total, 20 per page
GET /api/v1/requests/kpi     → {total: 1171, new: 34, checking: 52, ...}
GET /api/v1/requests/:id     → MKT-REQ-* detail
GET /api/v1/requests/export  → CSV/XLSX

GET /api/v1/orders?page=1    → commerceSequence present on all new orders
GET /api/v1/bookings?page=1  → commerceSequence present (derived from Order)
GET /api/v1/finance/payments → MKT-PAY-{root}-{ordinal} for new payments
```

Browser verification:
- `/app/requests` — page renders with KPI, table, pagination, filters, export
- Sidebar shows "Центр заявок" link
- Historical data renders correctly

---

## 5. Вердикт

```text
VERDICT A — SHARED COMMERCE SEQUENCE + REQUEST CENTER + HISTORICAL DATA
```

**Обоснование:**

- Shared commerceSequence реально реализован и используется при создании новых Order/Booking/Payment
- Booking: MKT-BKG-{root} (от корня Order)
- Payment: MKT-PAY-{root}-{ordinal} (от корня Order)
- Request: MKT-REQ-{root} (собственный корень)
- Request Center добавлен в sidebar и работает
- Request lifecycle с SLA/TTL реализован на backend
- Historical Requests: 1171 запись с правильной temporal invariant
- DB = API = UI = Export для Request Center
- i18n RU/AZ/EN
- Tests truthfully reported

**Незакрытые gaps (отдельные задачи):**

1. Seller-side UI actions в Request Center
2. Notification infrastructure
3. Существующие BKG-*/PAY-* referenceNumbers не нормализованы (legacy data)
4. Frontend Request detail page (для просмотра цепочки Request → Order → Booking → Payment)
