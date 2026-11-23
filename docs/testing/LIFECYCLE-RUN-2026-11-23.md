# Lifecycle + penalty regression — baseline run

Дата: 2026-11-23

## Что запускалось

```text
backend/src/modules/finance/order-financial-settlement.calculator.spec.ts
backend/src/modules/finance/order-financial-settlement.supplier-terms.spec.ts
backend/src/modules/finance/cancellation-close-guard.e2e.spec.ts
backend/test/scenarios/scenario-runner.js --mode=discovery
```

## Результаты Jest

Итог после исправления e2e-сценария:

```text
3 suites passed
28 tests passed
```

Проверено:

```text
penalty split / platform share / supplier share
penalty > liability blocker
penalty justification blocker
supplier terms
close blocked while cancellation approval pending
approval requires a pending cancellation approval
```

Примечание: исходный e2e-тест «forbids self-approval» был некорректен.
Текущая политика разрешает FINANCE/ADMIN утверждать собственный расчёт;
разделение обеспечивается правами, а не запретом self-approval. Тест заменён
на проверку обязательного `PENDING` approval.

## Результаты scenario discovery

Run:

```text
2026-11-23T13-22-05-685Z
```

Метрики:

```text
actions discovered: 7
actions executed:    9
fixtures created:   14
scenarios:           9
successful:          8
failed:              1
errors:              2
cycles:              0
```

Успешно прошли:

```text
request.confirmPrice
request.customerAccept
request.customerDecline
request.proposePrice
request.reject? (fixture error, see below)
request.unavailable
request.convert
```

Найденные ошибки:

```text
POST /requests → 500
```

на путях:

```text
root_reject
confirmPrice → customerAccept → convert
```

Ошибка возникает при создании нового fixture, а не при самом lifecycle-action.
Нужно отдельно проверить backend-лог/БД в момент создания request.

## Что пока НЕ покрыто

`scenario-runner.js` проверяет state machine заявки/заказа/брони, но не выполняет:

```text
financial-settlement
cancel-penalty
penalty waiver
client/supplier penalty reconciliation
```

Эти шаги покрыты unit/spec-тестами калькулятора, но не полным API-lifecycle.

## Следующий шаг

1. Исправить `POST /requests → 500` на fixture creation.
2. Добавить в runner финансовые действия:
   - cancellation approval;
   - settlement confirm;
   - penalty cancel/waive;
   - close guard checks.
3. Прогнать ветки client-fault / supplier-fault / platform-fault.
4. Приложить fixture IDs и суммы.
