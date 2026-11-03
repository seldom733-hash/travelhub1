# Sales assignment — результаты проверок

Дата: 2026-11-03.

## Автотесты

```text
AssignmentService: 6 passed
permission-labels: 6 passed
```

## Параллельные назначения (реальная БД)

Две разные заявки, два одновременных запроса:

```text
MKT-REQ-00000006 → Ulviyye
MKT-REQ-00000019 → Natalya
```

Результат: обе назначены, разным менеджерам, Round Robin соблюдён.

Две одновременные попытки назначить одну заявку:

```text
первая:  assigned=true,  Elvira
вторая:  assigned=false, Elvira
```

Итог: ровно одно назначение, повторная попытка возвращает существующего менеджера.

## RBAC scope

```text
admin  → 30 заявок
Elvira → 1 заявка
```

## UI

```text
/app/sales/assignment — открывается
бейдж «Заявки» — Elvira видит 1
```

## Ещё не проверено

- индикатор «прочитано, но не взято в работу»;
- платежный бейдж на UserNotification;
- полный ручной прогон 38 сценариев.

## Ручной прогон 2026-11-03

- Elvira видит 2 назначенные заявки в `/app/requests` (scope работает).
- Бейдж «Заявки» показывает 1 непрочитанное уведомление.
- Открытие заявки без непрочитанного уведомления не меняет счётчик — корректно.
- `POST /sales/assignment/notifications/read-entity` для заявки с уведомлением уменьшил счётчик:
  `{ total: 1 } → { total: 0 }`.
- Повторное назначение одной заявки двумя параллельными запросами: одно назначение.
- Две разные заявки параллельно: назначены разным менеджерам.
- Elvira переведена в `TEMP_UNAVAILABLE`; новая заявка назначена Ulviyye (Elvira исключена). После проверки Elvira возвращена в `AVAILABLE`.
- SLA-поля загрузки возвращаются: `overdue`, `slaSoon`, `openedNotStarted`.
- Платёжный бейдж: создан `PAY-00000036` (`PENDING`) → `payments=1`; после `confirm` → `CAPTURED`, `payments=0`.
- Две сессии Elvira: после reassign бейдж `1` в обеих; после открытия заявки в первой сессии через polling бейдж `0` в обеих.
- Роли: `director` — load 200, reassign OK, 30 заявок; `finance` — load 403, reassign 403; `admin` — load 200; `operator` — load 403, reassign 403, 30 заявок.
- Повторный вход: после reassign Elvira повторно вошла и получила `unread-count requests=2` — уведомления сохраняются между сессиями.
- SLA-граница: `slaDueAt = UTC now + 5 минут`, `firstContactAt = null` → `slaSoon=1`; значение восстановлено на +30 минут.


- Reconnect numeric: badge 4 -> offline 4 -> online 5; no reset, polling recovered.


- Один доступный менеджер: Natalya/Ulviyye TEMP_UNAVAILABLE, заявка назначена Elvira.
- participates=false у Elvira: заявка назначена Natalya; участие восстановлено.
- Read-on-open: MKT-REQ-00000026 осталась NEW, firstOpenedAt установлен.

- Start processing: MKT-REQ-00000021 → CHECKING, processingStartedAt установлен, история PROCESSING_STARTED.
- Два директора: первый reassign с expectedManagerId OK, второй со старым expected → 409, потерянного обновления нет.

- Статусы менеджера: Elvira BUSY → автоназначение новой заявки ушло Ulviyye; ручное назначение BUSY-менеджеру разрешено; ABSENT → ручное назначение 400; статус восстановлен FREE.
- Ручной режим: settings MANUAL → новая заявка QUEUED без менеджера; назначение вручную выполнено; режим возвращён AUTO.
