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

## Запуск

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\reports\sales-analytics-e2e.ps1 `
  -Api http://127.0.0.1:4001/api/v1
```

## Результат

```text
OK E2E requests=0 managers=0 sales=0 profit=0 issueCount=0
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

БД пустая. Это проверка контрактов, RBAC-входа, маршрутов и устойчивости нулевых данных, а не проверка бизнес-сумм на наборе данных.

Для проверки цифр нужен отдельный seed-набор Request → Order → Booking → Payment → Refund.
