# Автоматическое распределение заявок — итоговый отчёт

## Архитектура

- `Request.assignedManagerId` + assignment/SLA поля.
- `sales.SalesManagerProfile` — участие, доступность, лимит.
- `security.UserNotification` — единый слой заявок и платежей.
- `AssignmentService` — выбор наименее загруженного, Round Robin, очередь.
- `GET /sales/assignment/load`, `/unassigned`, `/notifications`.
- `POST /sales/assignment/:id/assign`, `/:id/reassign`, `/managers/:id/settings`.
- `UserNotification` для `REQUEST_ASSIGNED`, `REQUEST_REASSIGNED`, `PAYMENT_CONFIRMATION`.

## Алгоритм

```text
activeLoad = NEW + CHECKING + CONFIRMED + CUSTOMER_ACCEPTED + CUSTOMER_PAYMENT_TIMEOUT + SUPPLIER_TIMEOUT
```

- только ACTIVE SALES_MANAGER;
- только AVAILABLE и participates=true;
- лимит maxActiveRequests;
- минимальная нагрузка;
- Round Robin по lastAssignedAt NULLS FIRST;
- транзакция + FOR UPDATE;
- при отсутствии — QUEUED + уведомление ADMIN/DIRECTOR.

## Подтверждено

```text
AssignmentService: 6 passed
permission-labels: 6 passed

Параллельные назначения: PASS
Одна заявка двумя запросами: PASS (одно назначение)
RBAC: admin 30 / Elvira 2
Очередь и назначение: PASS
Переназначение: PASS
Read-on-open: PASS
Доступность TEMP_UNAVAILABLE: PASS
SLA overdue/soon/opened: API PASS
Платёжный бейдж: PENDING=1 → CAPTURED=0
Две сессии: 1/1 → 0/0
```

## Не подтверждено

- часть из 38 ручных сценариев (reconnect, повторный вход, отдельные роли);
- SLA-границы в реальном времени;
- полный визуальный прогон всех состояний.

## Ограничения

- `SALES_MANAGER` видит только свои заявки; ADMIN/DIRECTOR — все.
- Прочтение уведомления не меняет статус заявки.
- Платёжные уведомления создаются на PENDING и читаются при confirm.
