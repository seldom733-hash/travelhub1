# Navitravel — проверка оставшихся пунктов E2E

Дата: 2026-11-02  
Режим: production `travelhub`, тестовые данные не очищались.

## 1. Cancelled-штраф после начисления — PASS

Реализовано и проверено:

- `POST /orders/:id/financial-settlement/cancel-penalty`;
- кнопки «Отменить штраф клиента/поставщика» в settlement;
- reversal-проводка `PLATFORM_PENALTY_SHARE_REVERSAL` / `SUPPLIER_PENALTY_SHARE_REVERSAL`;
- автоматический возврат удержанного штрафа клиенту.

Проверка на `MKT-REQ-00000015`:

```text
clientPenalty 30 WITHHELD
→ отмена штрафа
→ RFD-00000026 PROCESSED 30.00
→ clientRefunded 300.00
→ clientPenalty 0.00
→ financialStatus FINANCIALLY_SETTLED
```

## 2. Конкурентное подтверждение Refund — BLOCKED

В UI нет отдельного действия подтверждения Refund: create/approve/process выполняются одной кнопкой. Конкурентное создание проверено (один `RFD-00000025`), конкурентное подтверждение — нет.

## 3. Повторный webhook — BLOCKED

Webhook-endpoint платёжного провайдера отсутствует, повторную доставку отправить некуда.

## 4. Отели, авиа, круизы, трансферы, страховка, экскурсии — BLOCKED

В каталоге 11 135 продуктов, все типа `TOUR`. Отдельных тестовых продуктов других типов нет.

## 5. Что уже проверено

- универсальный поиск туров: PASS, `MKT-REQ-00000020`;
- конкурентное создание Refund: PASS, один `RFD-00000025`;
- конкурентный платёж и settlement: PASS;
- роли ADMIN/FINANCE/MANAGER/BUYER: PASS;
- Ledger и денежные остатки: PASS;
- отмена начисленного штрафа: PASS.

## 6. Рекомендации

1. Добавить отдельное UI-действие подтверждения Refund.
2. Добавить webhook-endpoint и идемпотентную обработку повторной доставки.
3. Добавить тестовые продукты остальных типов услуг.
4. После этого повторить только BLOCKED-сценарии.
