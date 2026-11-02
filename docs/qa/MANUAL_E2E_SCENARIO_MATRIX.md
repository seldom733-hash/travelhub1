# Матрица ручного E2E-тестирования Navitravel

**Дата:** 2026-11-02  
**Статусы:** PASS — выполнено вручную; FAIL — есть дефект; BLOCKED — внешняя зависимость; NOT TESTED — не проверялось.

## Каналы и услуги

| Канал | Услуга | Поиск | Выбор | Данные | Заявка | Статус |
|---|---|---|---|---|---|---|
| Витрина | Туры (TEST) | PASS | PASS | PASS | PASS | PASS |
| Витрина | Отели | PASS | BLOCKED | NOT TESTED | NOT TESTED | BLOCKED |
| Витрина | Авиабилеты | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Витрина | Круизы / трансферы / страховка | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Универсальный поиск | Туры | PASS | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED |
| Универсальный поиск | Авиабилеты | BLOCKED | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED |

## Клиенты

| Сценарий | Статус |
|---|---|
| Гость | PASS |
| Авторизованный клиент | PARTIAL — prefill имени; профиль admin без телефона/email |
| Один клиент — несколько заявок | NOT TESTED |
| Разные клиенты | NOT TESTED |
| Совпадение контактов | NOT TESTED |

## Жизненный цикл

| Сценарий | Статус |
|---|---|
| Заявка подана | PASS |
| Подтверждение поставщика | PASS |
| Подтверждение клиента | PASS |
| Request → Order | PASS |
| Order → Booking | PASS |
| Booking подтверждён | PASS |
| Order исполнен | PASS |

## Оплаты

| Сценарий | Статус |
|---|---|
| Частичная оплата клиента 300 AZN | PASS |
| Частичная выплата поставщику 300 AZN | PASS |
| Полная оплата клиента | NOT TESTED |
| Полная выплата поставщику | NOT TESTED |
| Переплата / отклонённый платёж | NOT TESTED |

## Отмены и возвраты

| Сценарий | Статус |
|---|---|
| Отмена без штрафа | NOT TESTED |
| Отмена со штрафом | NOT TESTED |
| Частичный / полный возврат | NOT TESTED |
| Возврат от поставщика | NOT TESTED |

## Финансы

| Проверка | Статус |
|---|---|
| Очистка данных | PASS |
| KPI после очистки = 0 | PASS |
| Клиент в реестре | PASS |
| Услуга в реестре | PASS |
| Поставщик TEST в реестре | PASS |
| clientReceived / clientDebt | PASS |
| supplierPaid / supplierDebt | PASS |
| SupplierObligation | PASS |
| Expected/current income | PASS (0 из-за sales=cost) |
| Полная сверка с Ledger | NOT TESTED |

## Роли и защита

| Проверка | Статус |
|---|---|
| Клиент / менеджер / финик / админ | NOT TESTED |
| Двойное нажатие «Подать заявку» | NOT TESTED |
| Повторный платёж / webhook | NOT TESTED |
| Конкурентное изменение | NOT TESTED |
