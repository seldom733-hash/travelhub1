# Матрица ручного E2E-тестирования Navitravel

**Дата:** 2026-11-02  
**Статусы:** PASS — выполнено вручную; FAIL — есть дефект; BLOCKED — внешняя зависимость; NOT TESTED — не проверялось.

## Каналы и услуги

| Канал | Услуга | Поиск | Выбор | Данные | Заявка | Статус |
|---|---|---|---|---|---|---|
| Витрина | Туры (TEST) | PASS | PASS | PASS | PASS | PASS |
| Витрина | Отели | PASS | PASS | PASS | PASS — MKT-REQ-00000021 | PASS — NEW |
| Витрина | Авиабилеты | PASS — страница продукта | PASS | PASS | NOT TESTED — требует login | NOT TESTED |
| Витрина | Трансферы / экскурсии / санатории | PASS — страницы продуктов | PASS | PASS | NOT TESTED | NOT TESTED |
| Витрина | Круизы / страховка | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| Универсальный поиск | Туры | PASS | PASS | PASS | PASS — MKT-REQ-00000020 | PASS — NEW |
| Универсальный поиск | Авиабилеты | BLOCKED | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED |

## Клиенты

| Сценарий | Статус |
|---|---|
| Гость | PASS |
| Авторизованный клиент | PARTIAL — prefill имени; профиль admin без телефона/email |
| Один клиент — несколько заявок | PASS — Aysel, REQ-1 и REQ-2 |
| Разные клиенты | PASS — Aysel Mammadova и Elvin Quliyev |
| Совпадение контактов | PASS — телефон/email Aysel совпали, создана одна карточка клиента |

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
| Полная оплата клиента 1000 AZN | PASS |
| Полная выплата поставщику 800 AZN | PASS |
| Переплата | PASS — submit disabled, новый платёж не создан |
| Отклонённый платёж | PASS — PAY-00000023 CANCELLED, clientReceived 0, долг 1000 |

## Отмены и возвраты

| Сценарий | Статус |
|---|---|
| Отмена без штрафа | PASS — до оплаты |
| Отмена после оплаты | PASS — клиентский возврат 300 AZN, settlement FULL_REFUND |
| Полная оплата 1000 AZN + полный возврат | PASS — clientRefunded 1000, долг 0 |
| Отмена после выплаты поставщику | PASS — клиентский и supplier refund, obligation закрыт |
| Отмена со штрафом | PASS — штраф 30 AZN, возврат 270 AZN |
| Штраф только поставщика | PASS — clientPenalty 0, supplierPenalty 80, expectedIncome −80 |
| Штрафы обеих сторон | PASS — client 100, supplier 80, возврат 200, доход 20, UI confirm |
| Штраф pending | PASS — clientPenalty 0, KPI не включает |
| Штраф waived | PASS — clientPenalty 0, KPI не включает |
| Штраф withheld | PASS — удержан 30, возврат 270, доход 30 |
| Штраф received | PASS — возврат 270, штраф 30, доход 30 |
| Штраф cancelled (полный цикл) | PASS — штраф 30 снят, возврат 30, reversal-проводка |
| Частичный / полный возврат | PASS — частичный 270/300, полный 300/300 и 1000/1000 |
| Возврат от поставщика | PASS — INCOMING 300 AZN CONFIRMED, obligation закрыт |

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
| Expected/current income | PASS — 200 AZN на второй сделке |
| KPI SENT_TO_BOOKING | PASS — 1 при статусе SENT_TO_BOOKING |
| Заявки не входят в KPI продаж | PASS — только ORDER/BOOKING |
| Полная сверка с Ledger | PASS — payments/refunds/payouts/supplier refunds сходятся |
| Денежные остатки | PASS — clientReceived 6010, refunded 3110, supplierPaid 1400, refunded 600 |

## Роли и защита

| Проверка | Статус |
|---|---|
| Менеджер: доступ к финансам | PASS — /app/finance/deals redirect, create payment скрыт |
| Клиент: доступ к финансам | PASS — /app/finance/deals и /app/payments → /account |
| Финансист: доступ к реестру | PASS — /app/finance/deals доступен |
| Двойное нажатие «Подать заявку» | PASS — создана одна MKT-REQ-00000006 |
| Двойная отправка заявки | PASS — создана одна MKT-REQ-00000006 |
| Повторный платёж / webhook | PASS — evt-qa-002: первый 201, повтор duplicate=true |
| Конкурентное изменение | PASS — два одновременных confirm, одна запись CAPTURED и одна проводка |
| Конкурентное закрытие settlement | PASS — два одновременных confirm, один SET-00000012 |
| Конкурентное создание Refund | PASS — два одновременных клика, один RFD-00000025 |
| Конкурентное подтверждение Refund | PASS — RFD-00000028: один APPROVED и один PROCESSED |
