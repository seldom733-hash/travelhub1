# SOFT E2E — HOTEL IDENTITY VALIDATION

## 0. Цель

Провести мягкую E2E-проверку после реализации Hotel Identity Fix так, чтобы:

- ноутбук не зависал;
- не запускалась полная E2E-матрица проекта;
- тесты выполнялись последовательно, максимум одним worker;
- проверялись только затронутые бизнес-пути;
- при проблемах инфраструктуры выполнение останавливалось без бесконечных перезапусков.

Это validation run, а не полный regression run.

---

## 1. ЖЁСТКИЕ ОГРАНИЧЕНИЯ

### НЕ ДЕЛАТЬ

- не запускать все 107 E2E suites;
- не запускать E2E параллельно;
- не использовать coverage;
- не использовать watch mode;
- не увеличивать workers;
- не выполнять массовые DB reset/seed без существующей инфраструктурной необходимости;
- не менять production-код;
- не менять Prisma schema;
- не делать migration;
- не менять catalog data;
- не commit/push.

### Режим

Использовать:

```text
maxWorkers=1
runInBand
```

или эквивалентный режим Jest.

Если проект использует другой E2E runner — использовать его минимальный serial-режим.

---

# 2. PRE-FLIGHT

Перед запуском:

1. Зафиксировать текущий HEAD.
2. Зафиксировать dirty worktree.
3. Проверить состояние backend test infrastructure.
4. Проверить доступность тестовой БД.
5. Не выполнять destructive reset только ради запуска этой проверки.
6. Найти фактические Jest/E2E scripts в `package.json` и конфигурации проекта.

Нельзя придумывать имена тестовых файлов.

---

# 3. ПОРЯДОК ПРОВЕРКИ

Запускать тесты строго последовательно.

## E2E-A — Catalog → Supplier Offer → Request

Проверить минимальный путь:

```text
Product
  ↓
supplier-native identity
  ↓
SupplierOffer.hotelExternalId
  ↓
Request.pinnedRequirements.hotelExternalId
  ↓
Product resolution
```

Особенно проверить:

- SUMMERTOUR;
- KOMPAS;
- KAZUNION;
- ANEX, если существующий E2E infrastructure позволяет это проверить.

Ожидается:

```text
hotelKey / hotelInc
        ↓
adapter mapping
        ↓
hotelExternalId
        ↓
Request
        ↓
Product lookup
```

---

# 4. E2E-B — Request → Order

Проверить:

```text
Request
  ↓ customer acceptance
  ↓
Order
```

Проверить, что исправление Hotel Identity:

- не ломает customer acceptance;
- не ломает conversion;
- не требует обязательного `productId`, если Request имеет корректный frozen snapshot;
- не создаёт второй Request/Order вместо существующего lifecycle entity.

---

# 5. E2E-C — Product-less Request

Если в проекте уже существует изолированный E2E для product-less Request:

проверить:

```text
Request
productId = NULL
frozen product/service snapshot = valid
        ↓
customer acceptance
        ↓
Order
```

Ожидается PASS.

Если такого E2E нет — НЕ создавать новый production flow только ради этого запуска.

Зафиксировать:

```text
NOT AVAILABLE — no existing isolated E2E
```

---

# 6. E2E-D — Supplier Markup smoke regression

Запустить только минимальный существующий E2E/тестовый набор, который затрагивает:

```text
supplier price
  ↓
markup
  ↓
public price
  ↓
individual discount
  ↓
final customer price
  ↓
snapshot
  ↓
Order
```

Не запускать весь Supplier Markup E2E regression.

Цель:

```text
Hotel Identity Fix
        ↓
не должен ломать
        ↓
Supplier Markup commercial chain
```

---

# 7. RESOURCE SAFETY

Каждый suite запускать отдельно.

После каждого suite:

1. дождаться полного завершения;
2. проверить exit code;
3. не запускать следующий suite при явном infrastructure failure;
4. дать системе несколько секунд на освобождение ресурсов.

Если:

- CPU стабильно 100%;
- память быстро заполняется;
- Docker/DB перестаёт отвечать;
- Windows начинает зависать;
- тестовый процесс перестаёт прогрессировать;

немедленно остановить текущий suite.

Не пытаться несколько раз подряд перезапускать тот же зависший тест.

---

# 8. TIMEOUT

Использовать разумный timeout для одного изолированного suite.

Рекомендуемый предел:

```text
5–10 минут на suite
```

Если существующая инфраструктура имеет меньший официальный timeout — сохранить его.

Timeout не является основанием для бесконечных retry.

---

# 9. CLASSIFICATION

Каждый результат классифицировать:

### PASS

Тест завершился успешно.

### HOTEL_IDENTITY_REGRESSION

Ошибка относится к:

- hotelExternalId;
- hotelKey;
- hotelInc;
- adapter mapping;
- Product lookup;
- Request product resolution.

### SUPPLIER_MAPPING_REGRESSION

Ошибка относится к supplier adapter contract.

### SUPPLIER_MARKUP_REGRESSION

Ошибка ломает существующий Supplier Markup pricing chain.

### INFRA_BLOCKED

Инфраструктура не позволяет выполнить тест:

- DB unavailable;
- backend bootstrap failure;
- Docker unavailable;
- test environment unavailable;
- process hangs.

### PRE_EXISTING / UNRELATED

Ошибка не относится к изменениям Hotel Identity.

Не объявлять такую ошибку регрессией без доказательства связи.

---

# 10. STOP CONDITIONS

Немедленно остановить validation, если:

1. backend E2E infrastructure не поднимается;
2. тестовая БД недоступна;
3. первый targeted suite вызывает зависание ноутбука;
4. обнаружена реальная Hotel Identity regression;
5. требуется менять код для продолжения проверки.

В этих случаях:

```text
STOP
```

и подготовить отчёт.

Не выполнять бесконечные retries.

---

# 11. ACCEPTANCE CRITERIA

Soft E2E считается успешным, если:

- все доступные targeted E2E suites завершились PASS;
- нет `HOTEL_IDENTITY_REGRESSION`;
- нет `SUPPLIER_MAPPING_REGRESSION`;
- нет `SUPPLIER_MARKUP_REGRESSION`;
- ноутбук оставался стабильным;
- выполнение происходило serially;
- никаких production/data/schema изменений не сделано.

Полный E2E count проекта НЕ является критерием этого запуска.

---

# 12. ЕСЛИ E2E INFRASTRUCTURE НЕ РАБОТАЕТ

Если после одного контролируемого запуска infrastructure не работает:

НЕ:

- перезапускать инфраструктуру бесконечно;
- делать DB reset;
- менять Docker configuration;
- менять production code.

Зафиксировать:

```text
E2E = BLOCKED BY INFRASTRUCTURE
```

и завершить проверку.

Это не означает:

```text
E2E PASS
```

и не означает:

```text
Hotel Identity regression
```

---

# 13. FINAL REPORT

Отчёт должен содержать:

## A. Environment

- HEAD
- dirty worktree status
- backend status
- DB status

## B. Suites Executed

Таблица:

| Suite | Result | Duration | Classification |
|---|---|---:|---|
| Catalog → Request | PASS/FAIL/BLOCKED | ... | ... |
| Request → Order | PASS/FAIL/BLOCKED | ... | ... |
| Product-less Request | PASS/NOT AVAILABLE/BLOCKED | ... | ... |
| Supplier Markup smoke | PASS/FAIL/BLOCKED | ... | ... |

## C. Resource Safety

Указать:

- maxWorkers;
- serial/inBand;
- whether laptop remained responsive;
- whether any process was stopped.

## D. Regressions

Отдельно:

```text
Hotel Identity regressions: 0 / N
Supplier Mapping regressions: 0 / N
Supplier Markup regressions: 0 / N
Infrastructure blocks: 0 / N
Unrelated failures: 0 / N
```

## E. Final Verdict

Допустимые значения:

```text
PASS — TARGETED SOFT E2E GREEN
```

или

```text
PASS — TARGETED E2E GREEN; FULL E2E NOT RUN
```

или

```text
BLOCKED — E2E INFRASTRUCTURE UNAVAILABLE
```

или

```text
FAIL — REAL HOTEL IDENTITY REGRESSION
```

---

# 14. IMPORTANT

Этот запуск предназначен именно для безопасной проверки после Hotel Identity Fix.

Он НЕ заменяет полный E2E regression.

Цель:

```text
максимально релевантная проверка
+
минимальная нагрузка
+
нулевой риск зависания ноутбука
```

Никаких изменений кода, схемы, БД, каталога, миграций, commit или push.
