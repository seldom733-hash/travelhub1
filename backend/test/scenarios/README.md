# Automated Scenario Runner (Sales Register)

Постоянный инструмент обхода бизнес-сценариев реестра продаж Navitravel.

## Что делает

- создаёт независимую тестовую заявку для каждой ветви;
- получает реальные доступные действия из backend;
- выполняет каждое действие через настоящий API;
- после действия получает новый статус и новые действия;
- рекурсивно проходит все ветви до терминального состояния;
- сохраняет карту сценариев и отчёт;
- умеет повторно проигрывать сохранённые сценарии (regression).

## Тестовые данные

Каждый fixture маркируется:

```text
Customer: SCENARIO TEST <run-id>
Email:    scenario.<run-id>@test.local
Note:     AUTOMATED SCENARIO TEST — safe to clean up
```

Реальные платежи не создаются: используется внутренний API `finance/payments`
с синтетическим методом `CASH` и пометкой в reason. Внешние поставщики не
вызываются.

## Команды

Из каталога `backend`:

```powershell
npm run scenarios:discovery   # полный обход
npm run scenarios:regression  # повтор сохранённой карты
npm run scenarios:change      # обход + diff с предыдущей картой
```

Параметры окружения:

```text
SCENARIO_BASE_URL       default http://127.0.0.1:4000/api/v1
SCENARIO_MAX_DEPTH      default 12
SCENARIO_MAX_SCENARIOS  default 120
SCENARIO_MAP            default reports/scenario-runner/scenario-map.json
```

## Результаты

```text
reports/scenario-runner/scenario-map.json
reports/scenario-runner/run-<timestamp>.json
reports/scenario-runner/report-<timestamp>.md
```

## Ограничения

- Обход ограничен `SCENARIO_MAX_DEPTH` и `SCENARIO_MAX_SCENARIOS`; ветви,
  не пройденные из-за лимита, помечаются в отчёте.
- Действия, требующие внешнего поставщика или реальных денег, проверяются
  только до границы безопасного внутреннего вызова.
- Тестовые fixtures не удаляются автоматически: их id перечислены в отчёте,
  очистка выполняется через `npm run reset:business` или отдельный скрипт.
