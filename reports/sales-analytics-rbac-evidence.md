# Sales Analytics — RBAC evidence

Проверка выполнена прямыми запросами к API с подписанными тестовыми токенами существующих пользователей.

## DIRECTOR

```text
GET /sales-analytics/dashboard?preset=LAST_30_DAYS
→ 200
→ scope.restricted = false
→ managers = 3
→ requestsTotal = 4
```

Директор видит весь отдел.

## SALES_MANAGER

Запрос с `managerId` другого менеджера:

```text
GET /sales-analytics/dashboard?...&managerId=b726a8f0-...
→ 200
→ scope.restricted = true
→ scope.managerId = 920a8a35-... (собственный id)
→ managers = 1
→ requestsTotal = 2
```

Чужой `managerId` проигнорирован backend-ом.

## ADMIN

```text
GET /sales-analytics/dashboard
→ 200
→ полный отдел
```

## База RBAC

```text
ADMIN         → sales.kpi.read
DIRECTOR      → sales.kpi.read
SALES_MANAGER → sales.kpi.read
SALES_HEAD    → sales.kpi.read
FINANCE       → нет sales.kpi.read
```

Новые роли не создавались.
