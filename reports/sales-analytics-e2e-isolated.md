# Sales Analytics — isolated E2E run

## Окружение

```text
DATABASE_URL = travelhub1_test
PORT         = 4001
schema       = 188 migrations
dataset      = empty (no requests/orders)
```

Перед запуском:

```powershell
$env:DATABASE_URL='postgresql://postgres:Nadir%40da7374%23@127.0.0.1:5432/travelhub1_test'
npx prisma migrate reset --force
$env:PORT='4001'
node dist/main.js
```

## Seed

В `travelhub1_test` перенесены существующие записи и добавлены E2E-сценарии:

```text
Request             = 4
Order               = 5
Customer            = 1
Payment             = 5 (из них 1 PENDING)
SupplierObligation  = 6
Refund              = 3 (2 PROCESSED, 1 REQUESTED)
Adjustment          = 1
Settlement          = 1
```

## Запуск

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\reports\sales-analytics-e2e.ps1 `
  -Api http://127.0.0.1:4001/api/v1
```

## Результат

```text
OK E2E requests=4 managers=3 sales=3624,21 profit=145,8 issueCount=1
```

Финансовая проверка:

```text
salesAmount          = 3 624.21
capturedRevenue      = 1 362.62
refunds              = 29.00
adjustments          = 20.00
obligationCost       = 2 886.28
closedDeals          = 1
closedSettlements    = 1
financials           = 7
```

`issueCount=1` — намеренная проверка видимости расхождения:

```text
MKT-ORD-00000002
SETTLEMENT
-356.38
```

Сценарий проверяет, что аналитика не скрывает расхождение между суммой заказа и `finalCustomerLiability`.

## Ограничение

Seed покрывает частичную оплату, PENDING-оплату, несколько возвратов, PENDING-возврат, корректировку и settlement. Не покрыты:

- несколько валют;
- возврат без payment;
- закрытие без settlement;
- сложные мультисервисные обязательства.



