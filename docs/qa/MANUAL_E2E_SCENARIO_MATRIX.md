# Матрица ручного E2E-тестирования Navitravel

**Дата:** 2026-11-02  
**Статусы:** PASS — выполнено вручную; FAIL — выполнено, есть дефект; BLOCKED — невозможно из-за внешней зависимости; NOT TESTED — не проверялось.

## Каналы и типы услуг

| Канал | Услуга | Поиск | Выбор предложения | Данные путешественника | Подача заявки | Статус |
|---|---|---|---|---|---|---|
| Витрина | Туры | PASS | BLOCKED | NOT TESTED | NOT TESTED | BLOCKED |
| Витрина | Отели | PASS | BLOCKED | NOT TESTED | NOT TESTED | BLOCKED |
| Витрина | Авиабилеты | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Витрина | Круизы | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Витрина | Трансферы | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Витрина | Страхование | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Универсальный поиск | Туры | PASS | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED |
| Универсальный поиск | Отели | PASS | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED |
| Универсальный поиск | Авиабилеты | BLOCKED | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED |

## Клиенты

| Сценарий | Статус |
|---|---|
| Гость | NOT TESTED |
| Авторизованный клиент | NOT TESTED |
| Один клиент — несколько заявок | NOT TESTED |
| Разные клиенты | NOT TESTED |
| Совпадение телефона/email | NOT TESTED |

## Жизненный цикл

| Сценарий | Статус |
|---|---|
| Заявка подана | BLOCKED |
| Клиент не подтвердил | NOT TESTED |
| Клиент подтвердил | NOT TESTED |
| Поставщик подтвердил | NOT TESTED |
| Request → Order | NOT TESTED |
| Order → Booking | NOT TESTED |

## Оплаты

| Сценарий | Статус |
|---|---|
| Без оплаты | NOT TESTED |
| Частичная оплата клиента | NOT TESTED |
| Несколько частичных оплат | NOT TESTED |
| Полная оплата клиента | NOT TESTED |
| Частичная выплата поставщику | NOT TESTED |
| Полная выплата поставщику | NOT TESTED |
| Переплата / отклонённый платёж | NOT TESTED |

## Отмены и возвраты

| Сценарий | Статус |
|---|---|
| Отмена до подтверждения | NOT TESTED |
| Отмена без штрафа | NOT TESTED |
| Отмена со штрафом | NOT TESTED |
| Частичный возврат | NOT TESTED |
| Полный возврат | NOT TESTED |
| Возврат от поставщика | NOT TESTED |
| Штраф поставщика | NOT TESTED |

## Финансы и реестр

| Проверка | Статус |
|---|---|
| Очистка Request/Order/Booking | PASS |
| Очистка платежей/возвратов/обязательств | PASS |
| KPI реестра = 0 | PASS |
| Finance Ledger = 0 | PASS |
| Сверка оплат | NOT TESTED |
| Сверка задолженностей | NOT TESTED |
| Сверка выплат поставщику | NOT TESTED |
| Единая карточка сделки | NOT TESTED |

## Роли и защита

| Проверка | Статус |
|---|---|
| Клиент | NOT TESTED |
| Менеджер | NOT TESTED |
| Старший менеджер | NOT TESTED |
| Финансовый сотрудник | NOT TESTED |
| Администратор | NOT TESTED |
| Двойное нажатие «Подать заявку» | NOT TESTED |
| Повторный платёж/webhook | NOT TESTED |
| Конкурентное изменение | NOT TESTED |
