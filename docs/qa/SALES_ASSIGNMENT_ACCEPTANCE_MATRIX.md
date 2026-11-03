# Sales assignment — матрица приёмки 38

Дата: 2026-11-03. PASS только при фактической проверке.

| # | Сценарий | Статус | Доказательство |
|---:|---|---|---|
| 1 | Один доступный менеджер | PASS | Natalya/Ulviyye TEMP_UNAVAILABLE → Elvira |
| 2 | Одинаковая нагрузка, Round Robin | PASS | unit + concurrent test |
| 3 | Разная нагрузка, least-loaded | PASS | Ulviyye выбрана при load 1 |
| 4 | Одновременно несколько заявок | PASS | 00000006→Ulviyye, 00000019→Natalya |
| 5 | Менеджер временно недоступен | PASS | TEMP_UNAVAILABLE исключена |
| 6 | Менеджер исключён из распределения | PASS | participates=false → Natalya |
| 7 | Достигнут maxActiveRequests | PASS | unit test |
| 8 | Все достигли максимума | PASS | unit test ALL_MANAGERS_AT_LIMIT |
| 9 | Нет доступных менеджеров | PASS | unit test NO_AVAILABLE_MANAGERS |
| 10 | Заявка с витрины | NOT TESTED | нужен полный UI-прогон создания |
| 11 | Заявка из универсального поиска | NOT TESTED | нужен полный UI-прогон |
| 12 | Другой тип услуги | PASS | MKT-REQ-00000031 создана и назначена Ulviyye |
| 13 | Уведомление назначенному | PASS | unread requests=1 |
| 14 | Пункт «Заявки» мигает | PASS | badge animate-pulse |
| 15 | Счётчик увеличивается | PASS | reconnect 4→5 |
| 16 | Открытие одной из новых | PASS | read-entity |
| 17 | Уведомление прочитано | PASS | unread → 0 |
| 18 | Остались непрочитанные — мигание | PASS | unread 2→1, бейдж остаётся |
| 19 | Непрочитанных нет — мигание стоп | PASS | badge 0 |
| 20 | Прочитано, но не начато | PASS | MKT-REQ-00000026: NEW + firstOpenedAt |
| 21 | Остаётся NEW | PASS | status NEW |
| 22 | Начало обработки | PASS | MKT-REQ-00000021 → CHECKING |
| 23 | Мигание/счётчики после старта | PASS | кнопка «Начать обработку» → Yoxlanılır; badge retained |
| 24 | Ручное переназначение новой | PASS | director reassign OK |
| 25 | Переназначение в обработке | PASS | MKT-REQ-00000021 CHECKING → Natalya |
| 26 | Новый менеджер получает уведомление | PASS | REQUEST_REASSIGNED |
| 27 | Список старого менеджера обновляется | PASS | Elvira search 00000021 = 0 после reassign |
| 28 | Нагрузка пересчитывается | PASS | /load изменился |
| 29 | История сохраняется | PASS | ASSIGNED/REASSIGNED/PROCESSING_STARTED |
| 30 | Два директора одновременно | PASS | первый OK, второй 409 |
| 31 | Доступ к чужим заявкам | PASS | admin 30 / Elvira 2 |
| 32 | Расчёт нагрузки | PASS | /load counts |
| 33 | Нет двойных уведомлений | PASS | unit no duplicate |
| 34 | Нет потери заявок | PASS | QUEUED + reassign |
| 35 | Обновление/повторный вход | PASS | relogin unread=2 |
| 36 | Несколько сессий | PASS | 1/1 → 0/0 |
| 37 | Потеря соединения | PASS | 4→4→5 |
| 38 | Архитектура уведомлений | PASS | docs + unified UserNotification |

## Итог

```text
PASS:        36
PARTIAL:      0
NOT TESTED:   2
FAIL:         0
```

Не отмечены PASS: 10, 11. Публичный `create-request` теперь вызывает AssignmentService, но фактический UI-прогон создания с витрины/поиска не выполнен.
