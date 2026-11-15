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

В `travelhub1_test` перенесены существующие записи:

```text
Request             = 4
Order               = 5
Customer            = 1
Payment             = 3
SupplierObligation  = 6
Refund              = 1 (E2E seed)
```

## Запуск

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\reports\sales-analytics-e2e.ps1 `
  -Api http://127.0.0.1:4001/api/v1
```

## Результат

```text
OK E2E requests=4 managers=3 sales=3624,21 profit=145,8 issueCount=0
```

Финансовая проверка на изолированной БД:

```text
salesAmount     = 3 624.21
capturedRevenue = 1 262.62
refunds         = 19.00
obligationCost  = 2 886.28
financials      = 4
```

Проверено на изолированной БД:

- login/admin;
- dashboard;
- period;
- KPI;
- reconciliation;
- distribution;
- funnel;
- activity;
- orders;
- drilldown;
- frontend routes.

## Ограничение

Seed содержит Request/Order/Booking/Payment/SupplierObligation/Refund, но не содержит полного набора всех финансовых сценариев (частичные оплаты, несколько возвратов, корректировки, закрытые расчёты).

Для полного финансового E2E нужен расширенный seed этих сценариев.


