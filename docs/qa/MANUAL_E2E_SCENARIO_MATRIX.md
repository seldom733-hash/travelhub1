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
| Один клиент — несколько заявок | PASS — Aysel, REQ-1 и REQ-2 |
| Разные клиенты | PASS — Aysel Mammadova и Elvin Quliyev |
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
| Полная оплата клиента 1000 AZN | PASS |
| Полная выплата поставщику 800 AZN | PASS |
| Переплата | PASS — submit disabled, новый платёж не создан |
| Отклонённый платёж | NOT TESTED |

## Отмены и возвраты

| Сценарий | Статус |
|---|---|
| Отмена без штрафа | PASS — до оплаты |
| Отмена после оплаты | PASS — клиентский возврат 300 AZN, settlement FULL_REFUND |
| Отмена после выплаты поставщику | PASS — клиентский и supplier refund, obligation закрыт |
| Отмена со штрафом | PASS — штраф 30 AZN, возврат 270 AZN |
| Штраф только поставщика | PASS — clientPenalty 0, supplierPenalty 80, expectedIncome −80 |
| Штрафы обеих сторон | PASS — client 100, supplier 80, возврат 200, доход 20, UI confirm |
| Штраф pending / waived / cancelled | BLOCKED — нет отдельных состояний штрафа |
| Частичный / полный возврат | NOT TESTED |
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
| Полная сверка с Ledger | PASS — payments/refunds/payouts/supplier refunds сходятся |

## Роли и защита

| Проверка | Статус |
|---|---|
| Менеджер: доступ к финансам | PASS — /app/finance/deals redirect, create payment скрыт |
| Клиент / финансист / админ | NOT TESTED |
| Двойное нажатие «Подать заявку» | NOT TESTED |
| Двойная отправка заявки | PASS — создана одна MKT-REQ-00000006 |
| Повторный платёж / webhook | NOT TESTED |
| Конкурентное изменение | NOT TESTED |
