# Navitravel — ручной E2E-аудит бизнес-процессов

**Дата:** 2026-11-02  
**Среда:** production `travelhub` (по прямому подтверждению пользователя)  
**Backup до очистки:** `reports/backups/travelhub_before_full_e2e_clear_20261102.dump`

## 1. Подготовка среды

Транзакционные данные очищены: Request, Order, Booking, Payment, Refund, SupplierObligation, SupplierPayout, Ledger и связанные истории. Master data сохранены.

После очистки все счётчики и KPI реестра были нулевыми.

## 2. Тестовое предложение

```text
Product:  PRD-TEST-E2E
URL:      /products/11111111-1111-4111-8111-111111111111
Supplier: TEST
Название: Navitravel E2E Test Tour
Дата:     2026-11-03
Ночей:    7
Цена:     1000 AZN
```

Календарь и повторная проверка цены обслуживаются тестовым адаптером `TEST`, внешние системы не вызываются.

## 3. Сквозной сценарий

| Шаг | Действие в UI | Результат |
|---|---|---|
| 1 | Подача заявки через витрину | PASS — MKT-REQ-00000001 |
| 2 | Данные путешественника: имя, фамилия, телефон, email | PASS |
| 3 | Подтверждение цены поставщиком | PASS |
| 4 | Добавление 2 туристов | PASS |
| 5 | Подтверждение клиентом | PASS |
| 6 | Request → Order | PASS — MKT-ORD-00000001 |
| 7 | Паспортные данные 2 туристов | PASS |
| 8 | Финальное подтверждение заказа | PASS |
| 9 | Заказ взят в работу | PASS |
| 10 | Заказ подготовлен к бронированию | PASS |
| 11 | Order → Booking | PASS — MKT-BKG-00000001 |
| 12 | Заказ исполнен | PASS — FULFILLED |
| 13 | Booking подготовлен, отправлен, подтверждён | PASS — CONFIRMED |
| 14 | SupplierObligation создан | PASS — SBO-00000010 |
| 15 | Частичная оплата клиента 300 AZN | PASS — CAPTURED |
| 16 | Частичная выплата поставщику 300 AZN | PASS — CONFIRMED |

## 4. Фактическое состояние сделки

```text
Request:  MKT-REQ-00000001
Order:    MKT-ORD-00000001  FULFILLED
Booking:  MKT-BKG-00000001  CONFIRMED

Customer: Aysel Mammadova
Supplier: TEST
Service:  Navitravel E2E Test Tour
Amount:   1000.00 AZN
```

Финансовый реестр:

```text
salesAmount      1000.00
costAmount       1000.00
clientReceived    300.00
clientDebt        700.00
supplierPaid      300.00
supplierDebt      700.00
expectedIncome      0.00
currentIncome       0.00
stage            BOOKING
```

SupplierObligation:

```text
SBO-00000010
amount 1000.00
remaining 700.00
status PARTIALLY_PAID
```

Client payment:

```text
MKT-PAY-00000001-1
300.00 AZN
CAPTURED
```

Supplier payout:

```text
SPO-00000001
300.00 AZN
CONFIRMED
```

## 5. Исправленные дефекты

| ID | Дефект | Исправление |
|---|---|---|
| DEF-001 | Клиент с заявкой не отображался в CRM | Marketplace scope теперь учитывает Request.customerId |
| DEF-002 | Поставщик не сохранялся в snapshot заявки | supplierCode добавлен в productSnapshot |
| DEF-003 | Карточка Request не показывала поставщика без Partner | fallback на snapshot supplierCode |
| DEF-004 | SupplierPayout не связывался с Order/Booking | payout пишет orderId/bookingId из obligation; старые строки backfill |
| DEF-005 | Форма туров разрешала отправку без имени/email | обязательные поля и inline-ошибки |

## 6. Ограничения

1. Доход 0, потому что тестовое предложение имеет sales = cost = 1000 AZN. Нужен второй тестовый офер с base 800 и наценкой 25%.
2. Полная оплата клиента и поставщика, переплата, отмена, штрафы и возвраты ещё не выполнены.
3. Универсальный поиск авиабилетов остаётся BLOCKED из-за внешних источников.
4. Роли, конкурентные операции и полная матрица услуг не завершены.

## 7. Следующий этап

1. Второй тестовый офер: supplier base 800 AZN, markup 25% → storefront 1000 AZN.
2. Полная оплата клиента 1000 AZN и поставщика 800 AZN, проверка дохода 200 AZN.
3. Отмена без штрафа, со штрафом, возвраты клиенту и поставщику.
4. Проверка ролей и защиты от дублирования.
