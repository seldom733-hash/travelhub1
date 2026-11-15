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
Request   = 4
Order     = 5
Customer  = 1
```

Финансовые Payment/Refund в seed не попали, поэтому выручка в этом прогоне равна `0`.

## Запуск

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\reports\sales-analytics-e2e.ps1 `
  -Api http://127.0.0.1:4001/api/v1
```

## Результат

```text
OK E2E requests=4 managers=3 sales=3624,21 profit=296,7 issueCount=0
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

Seed содержит Request/Order/Booking-связи, но не содержит Payment/Refund. Поэтому проверены ненулевые заявки, заказы, менеджеры, продажи и прибыль, но не проверены ненулевые поступления и возвраты.

Для полного финансового E2E нужен seed Payment/Refund.

