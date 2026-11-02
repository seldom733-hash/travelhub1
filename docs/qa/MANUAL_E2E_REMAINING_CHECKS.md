# Navitravel — оставшиеся пункты E2E

Дата: 2026-11-02

## 1. Отмена начисленного штрафа — PASS

Проверено на `MKT-REQ-00000015`: штраф 30 AZN со статусом WITHHELD отменён через UI, создан возврат `RFD-00000026` на 30 AZN, `clientRefunded = 300`, `clientPenalty = 0`, settlement закрыт как `FINANCIALLY_SETTLED`. Создана reversal-проводка `PLATFORM_PENALTY_SHARE_REVERSAL`.

## 2. Отдельное подтверждение Refund — PASS

Добавлена страница `/app/finance/refunds`:

- создание Refund в статусе REQUESTED;
- отдельное действие «Подтвердить»;
- отдельное действие «Исполнить».

Проверено: `RFD-00000027` прошёл REQUESTED → APPROVED → PROCESSED. На `RFD-00000028` два одновременных подтверждения и два одновременных исполнения дали по одному переходу, без дубликата.

## 3. Повторный webhook — PASS

Добавлен `POST /api/v1/public/payments/webhook` с HMAC-подписью и уникальным `eventId` в `finance.PaymentWebhookEvent`.

Проверено на `PAY-00000033`:

```text
eventId evt-qa-002 → CAPTURED, duplicate=false
повтор evt-qa-002 → duplicate=true
```

Повторной проводки/захвата нет.

## 4. Тестовые продукты других типов — PARTIAL

Добавлены продукты `HOTEL`, `FLIGHT`, `TRANSFER`, `EXCURSION`, `SANATORIUM` (SQL в `reports/backups/seed_test_types.sql`).

- отель: PASS, создана `MKT-REQ-00000021`;
- авиабилет / трансфер / экскурсия / санаторий: страницы продуктов открываются, но заявка не завершена — для авиабилета кнопка ведёт на login;
- круизы и страховка: продуктов нет, BLOCKED.
