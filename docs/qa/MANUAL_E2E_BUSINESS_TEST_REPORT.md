# Navitravel â€” Ñ€ÑƒÑ‡Ð½Ð¾Ð¹ E2E-Ð°ÑƒÐ´Ð¸Ñ‚ Ð±Ð¸Ð·Ð½ÐµÑ-Ð¿Ñ€Ð¾Ñ†ÐµÑÑÐ¾Ð²

**Ð”Ð°Ñ‚Ð°:** 2026-11-02  
**Ð¡Ñ€ÐµÐ´Ð°:** production `travelhub` (Ð¿Ð¾ Ð¿Ñ€ÑÐ¼Ð¾Ð¼Ñƒ Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸ÑŽ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ)  
**Backup Ð´Ð¾ Ð¾Ñ‡Ð¸ÑÑ‚ÐºÐ¸:** `reports/backups/travelhub_before_full_e2e_clear_20261102.dump`

## 0. Итог аудита

Проведён ручной E2E-аудит через UI по цепочке:

```text
Request → Order → Booking → Payment
→ Supplier Payout → Cancellation
→ Refund → Settlement → Ledger
```

Итоговая матрица:

```text
PASS        89
FAIL         0
BLOCKED      2
PARTIAL      1
NOT TESTED   3
```

Ключевые исправленные дефекты:

- отсутствие клиентского Refund из settlement;
- отсутствие INCOMING supplier refund в UI;
- незакрытие SupplierObligation после отмены;
- неверное признание штрафов в KPI;
- смешивание client/supplier penalty;
- отсутствие Ledger-проводок по supplier refund;
- отсутствие экрана Financial Ledger.

Проверены:

- полный и частичный возврат;
- штрафы клиента, поставщика и обеих сторон;
- статусы штрафа pending / confirmed / withheld / received / waived;
- конкурентные платёж, settlement и создание Refund;
- роли ADMIN / FINANCE / MANAGER / BUYER;
- сверка денежных остатков с Ledger.

Не проверены:

- cancelled-штраф после начисления;
- конкурентное подтверждение Refund;
- отели, авиа, круизы, трансферы, страховка, экскурсии;
- повторный webhook.

Рекомендация: выпуск возможен для туров TEST и проверенных финансовых сценариев; перед полным production rollout нужны проверки из блока «Не проверены».

## 1. ÐŸÐ¾Ð´Ð³Ð¾Ñ‚Ð¾Ð²ÐºÐ° ÑÑ€ÐµÐ´Ñ‹

Ð¢Ñ€Ð°Ð½Ð·Ð°ÐºÑ†Ð¸Ð¾Ð½Ð½Ñ‹Ðµ Ð´Ð°Ð½Ð½Ñ‹Ðµ Ð¾Ñ‡Ð¸Ñ‰ÐµÐ½Ñ‹: Request, Order, Booking, Payment, Refund, SupplierObligation, SupplierPayout, Ledger Ð¸ ÑÐ²ÑÐ·Ð°Ð½Ð½Ñ‹Ðµ Ð¸ÑÑ‚Ð¾Ñ€Ð¸Ð¸. Master data ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ñ‹.

ÐŸÐ¾ÑÐ»Ðµ Ð¾Ñ‡Ð¸ÑÑ‚ÐºÐ¸ Ð²ÑÐµ ÑÑ‡Ñ‘Ñ‚Ñ‡Ð¸ÐºÐ¸ Ð¸ KPI Ñ€ÐµÐµÑÑ‚Ñ€Ð° Ð±Ñ‹Ð»Ð¸ Ð½ÑƒÐ»ÐµÐ²Ñ‹Ð¼Ð¸.

## 2. Ð¢ÐµÑÑ‚Ð¾Ð²Ð¾Ðµ Ð¿Ñ€ÐµÐ´Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ

```text
Product:  PRD-TEST-E2E
URL:      /products/11111111-1111-4111-8111-111111111111
Supplier: TEST
ÐÐ°Ð·Ð²Ð°Ð½Ð¸Ðµ: Navitravel E2E Test Tour
Ð”Ð°Ñ‚Ð°:     2026-11-03
ÐÐ¾Ñ‡ÐµÐ¹:    7
Ð¦ÐµÐ½Ð°:     1000 AZN
```

ÐšÐ°Ð»ÐµÐ½Ð´Ð°Ñ€ÑŒ Ð¸ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð½Ð°Ñ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐºÐ° Ñ†ÐµÐ½Ñ‹ Ð¾Ð±ÑÐ»ÑƒÐ¶Ð¸Ð²Ð°ÑŽÑ‚ÑÑ Ñ‚ÐµÑÑ‚Ð¾Ð²Ñ‹Ð¼ Ð°Ð´Ð°Ð¿Ñ‚ÐµÑ€Ð¾Ð¼ `TEST`, Ð²Ð½ÐµÑˆÐ½Ð¸Ðµ ÑÐ¸ÑÑ‚ÐµÐ¼Ñ‹ Ð½Ðµ Ð²Ñ‹Ð·Ñ‹Ð²Ð°ÑŽÑ‚ÑÑ.

## 3. Ð¡ÐºÐ²Ð¾Ð·Ð½Ð¾Ð¹ ÑÑ†ÐµÐ½Ð°Ñ€Ð¸Ð¹

| Ð¨Ð°Ð³ | Ð”ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ Ð² UI | Ð ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚ |
|---|---|---|
| 1 | ÐŸÐ¾Ð´Ð°Ñ‡Ð° Ð·Ð°ÑÐ²ÐºÐ¸ Ñ‡ÐµÑ€ÐµÐ· Ð²Ð¸Ñ‚Ñ€Ð¸Ð½Ñƒ | PASS â€” MKT-REQ-00000001 |
| 2 | Ð”Ð°Ð½Ð½Ñ‹Ðµ Ð¿ÑƒÑ‚ÐµÑˆÐµÑÑ‚Ð²ÐµÐ½Ð½Ð¸ÐºÐ°: Ð¸Ð¼Ñ, Ñ„Ð°Ð¼Ð¸Ð»Ð¸Ñ, Ñ‚ÐµÐ»ÐµÑ„Ð¾Ð½, email | PASS |
| 3 | ÐŸÐ¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸Ðµ Ñ†ÐµÐ½Ñ‹ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ¾Ð¼ | PASS |
| 4 | Ð”Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ 2 Ñ‚ÑƒÑ€Ð¸ÑÑ‚Ð¾Ð² | PASS |
| 5 | ÐŸÐ¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸Ðµ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð¾Ð¼ | PASS |
| 6 | Request â†’ Order | PASS â€” MKT-ORD-00000001 |
| 7 | ÐŸÐ°ÑÐ¿Ð¾Ñ€Ñ‚Ð½Ñ‹Ðµ Ð´Ð°Ð½Ð½Ñ‹Ðµ 2 Ñ‚ÑƒÑ€Ð¸ÑÑ‚Ð¾Ð² | PASS |
| 8 | Ð¤Ð¸Ð½Ð°Ð»ÑŒÐ½Ð¾Ðµ Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸Ðµ Ð·Ð°ÐºÐ°Ð·Ð° | PASS |
| 9 | Ð—Ð°ÐºÐ°Ð· Ð²Ð·ÑÑ‚ Ð² Ñ€Ð°Ð±Ð¾Ñ‚Ñƒ | PASS |
| 10 | Ð—Ð°ÐºÐ°Ð· Ð¿Ð¾Ð´Ð³Ð¾Ñ‚Ð¾Ð²Ð»ÐµÐ½ Ðº Ð±Ñ€Ð¾Ð½Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð¸ÑŽ | PASS |
| 11 | Order â†’ Booking | PASS â€” MKT-BKG-00000001 |
| 12 | Ð—Ð°ÐºÐ°Ð· Ð¸ÑÐ¿Ð¾Ð»Ð½ÐµÐ½ | PASS â€” FULFILLED |
| 13 | Booking Ð¿Ð¾Ð´Ð³Ð¾Ñ‚Ð¾Ð²Ð»ÐµÐ½, Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½, Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´Ñ‘Ð½ | PASS â€” CONFIRMED |
| 14 | SupplierObligation ÑÐ¾Ð·Ð´Ð°Ð½ | PASS â€” SBO-00000010 |
| 15 | Ð§Ð°ÑÑ‚Ð¸Ñ‡Ð½Ð°Ñ Ð¾Ð¿Ð»Ð°Ñ‚Ð° ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð° 300 AZN | PASS â€” CAPTURED |
| 16 | Ð§Ð°ÑÑ‚Ð¸Ñ‡Ð½Ð°Ñ Ð²Ñ‹Ð¿Ð»Ð°Ñ‚Ð° Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÑƒ 300 AZN | PASS â€” CONFIRMED |

## 4. Ð’Ñ‚Ð¾Ñ€Ð¾Ð¹ ÑÐºÐ²Ð¾Ð·Ð½Ð¾Ð¹ ÑÑ†ÐµÐ½Ð°Ñ€Ð¸Ð¹ â€” Ð¿Ð¾Ð»Ð½Ð°Ñ Ð¾Ð¿Ð»Ð°Ñ‚Ð° Ð¸ Ð´Ð¾Ñ…Ð¾Ð´

Ð¢ÐµÑÑ‚Ð¾Ð²Ð¾Ðµ Ð¿Ñ€ÐµÐ´Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ Ð½Ð°ÑÑ‚Ñ€Ð¾ÐµÐ½Ð¾ Ð½Ð°:

```text
supplierBasePrice = 800 AZN
Ð½Ð°Ñ†ÐµÐ½ÐºÐ° TEST/tours = 25%
Ñ†ÐµÐ½Ð° Ð²Ð¸Ñ‚Ñ€Ð¸Ð½Ñ‹ = 1000 AZN
```

Ð¡Ð¾Ð·Ð´Ð°Ð½Ð° Ð²Ñ‚Ð¾Ñ€Ð°Ñ Ð·Ð°ÑÐ²ÐºÐ° Ñ‚ÐµÐ¼ Ð¶Ðµ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð¾Ð¼:

```text
MKT-REQ-00000002
MKT-ORD-00000002
MKT-BKG-00000002
```

Ð’Ñ‹Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¾ Ð²Ñ€ÑƒÑ‡Ð½ÑƒÑŽ:

- Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸Ðµ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ°;
- Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸Ðµ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð°;
- Request â†’ Order;
- Order â†’ Booking;
- Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸Ðµ Booking;
- Ð¸ÑÐ¿Ð¾Ð»Ð½ÐµÐ½Ð¸Ðµ Order;
- Ð¿Ð¾Ð»Ð½Ð°Ñ Ð¾Ð¿Ð»Ð°Ñ‚Ð° ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð° 1000 AZN;
- Ð¿Ð¾Ð»Ð½Ð°Ñ Ð²Ñ‹Ð¿Ð»Ð°Ñ‚Ð° Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÑƒ 800 AZN.

Ð¤Ð°ÐºÑ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹ Ñ€ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚ Ñ€ÐµÐµÑÑ‚Ñ€Ð°:

```text
salesAmount      1000.00
costAmount        800.00
clientReceived   1000.00
clientDebt          0.00
supplierPaid      800.00
supplierDebt        0.00
expectedIncome    200.00
currentIncome     200.00
stage            BOOKING
```

ÐŸÑ€Ð¾Ð²ÐµÑ€ÐºÐ° Â«Ð¾Ð´Ð¸Ð½ ÐºÐ»Ð¸ÐµÐ½Ñ‚ â€” Ð½ÐµÑÐºÐ¾Ð»ÑŒÐºÐ¾ Ð·Ð°ÑÐ²Ð¾ÐºÂ»:

```text
Aysel Mammadova
  MKT-REQ-00000001
  MKT-REQ-00000002
```

ÐšÐ°Ð¶Ð´Ð°Ñ Ð·Ð°ÑÐ²ÐºÐ° Ð¸Ð¼ÐµÐµÑ‚ ÑÐ¾Ð±ÑÑ‚Ð²ÐµÐ½Ð½Ñ‹Ð¹ Order Ð¸ Booking, Ð¾Ð¿Ð»Ð°Ñ‚Ñ‹ Ð½Ðµ ÑÐ¼ÐµÑˆÐ°Ð½Ñ‹.

## 5. Ð¢Ñ€ÐµÑ‚Ð¸Ð¹ ÐºÐ»Ð¸ÐµÐ½Ñ‚, KPI Ð¸ Ð¾Ñ‚Ð¼ÐµÐ½Ð° Ð´Ð¾ Ð¾Ð¿Ð»Ð°Ñ‚Ñ‹

Ð¡Ð¾Ð·Ð´Ð°Ð½Ð° Ð½ÐµÐ·Ð°Ð²Ð¸ÑÐ¸Ð¼Ð°Ñ Ð·Ð°ÑÐ²ÐºÐ° Ð´Ñ€ÑƒÐ³Ð¾Ð³Ð¾ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð°:

```text
MKT-REQ-00000003
Elvin Quliyev
MKT-ORD-00000003
MKT-BKG-00000003
```

ÐŸÑ€Ð¾Ð²ÐµÑ€ÐºÐ° KPI Ð¿Ñ€Ð¸ ÑÑ‚Ð°Ñ‚ÑƒÑÐµ `SENT_TO_BOOKING`:

```text
GET /api/v1/orders
status = SENT_TO_BOOKING
aggregates.lifecycle.SENT_TO_BOOKING = 1
```

Ð¢Ð¾ ÐµÑÑ‚ÑŒ KPI ÑÑ‡Ð¸Ñ‚Ð°ÐµÑ‚ Ñ‚ÐµÐºÑƒÑ‰Ð¸Ð¹ ÑÑ‚Ð°Ñ‚ÑƒÑ ÐºÐ¾Ñ€Ñ€ÐµÐºÑ‚Ð½Ð¾. Ð—Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ `0` Ð´Ð¾Ð¿ÑƒÑÑ‚Ð¸Ð¼Ð¾ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿Ð¾ÑÐ»Ðµ Ð¿ÐµÑ€ÐµÑ…Ð¾Ð´Ð° Ð·Ð°ÐºÐ°Ð·Ð° Ð² `FULFILLED`.

Ð—Ð°Ñ‚ÐµÐ¼ Ð·Ð°ÐºÐ°Ð· Ð¾Ñ‚Ð¼ÐµÐ½Ñ‘Ð½ Ð´Ð¾ Ð¾Ð¿Ð»Ð°Ñ‚Ñ‹ Ð¸ Ð´Ð¾ Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸Ñ Ð±Ñ€Ð¾Ð½Ð¸:

```text
Order   = CANCELLED
Booking = CANCELLED
clientReceived = 0
clientDebt     = 0
supplierPaid   = 0
supplierDebt   = 0
expectedIncome = 0
currentIncome  = 0
```

ÐÐ°Ð¹Ð´ÐµÐ½ Ð¸ Ð¸ÑÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½ Ð´ÐµÑ„ÐµÐºÑ‚: Ð¾Ñ‚Ð¼ÐµÐ½Ñ‘Ð½Ð½Ð°Ñ ÑÐ´ÐµÐ»ÐºÐ° Ð±ÐµÐ· SupplierObligation Ð¿Ð¾ÐºÐ°Ð·Ñ‹Ð²Ð°Ð»Ð° `supplierDebt = 800`. Ð¢ÐµÐ¿ÐµÑ€ÑŒ Ð´Ð¾Ð»Ð³ Ð¿ÐµÑ€ÐµÐ´ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ¾Ð¼ Ñ€Ð°Ð²ÐµÐ½ 0.

## 6. ÐžÑ‚Ð¼ÐµÐ½Ð° Ð¿Ð¾ÑÐ»Ðµ Ð¾Ð¿Ð»Ð°Ñ‚Ñ‹ â€” PASS

ÐÐ° Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´Ñ‘Ð½Ð½Ð¾Ð¹ Ð±Ñ€Ð¾Ð½Ð¸ MKT-BKG-00000001 Ð²Ñ‹Ð¿Ð¾Ð»Ð½ÐµÐ½Ð° Ð¿Ñ€ÑÐ¼Ð°Ñ Ð¾Ñ‚Ð¼ÐµÐ½Ð° Ñ‡ÐµÑ€ÐµÐ· UI.

Ð¤Ð°ÐºÑ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹ Ñ€ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚:

```text
Booking        CANCELLED
Order          FULFILLED
clientReceived 300.00
clientDebt     700.00
clientRefunded   0.00
supplierPaid   300.00
supplierDebt   700.00
supplierRefunded 0.00
```

ÐžÐ¶Ð¸Ð´Ð°ÐµÐ¼Ñ‹Ð¹ Ñ€ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚ Ð´Ð»Ñ Ð¾Ñ‚Ð¼ÐµÐ½Ñ‹ Ð±ÐµÐ· ÑˆÑ‚Ñ€Ð°Ñ„Ð°:

```text
clientDebt      0.00
clientRefunded 300.00
supplierDebt    0.00
supplierRefunded 300.00
```

Ð”ÐµÑ„ÐµÐºÑ‚ CRITICAL:

- Ð¿Ñ€ÑÐ¼Ð°Ñ Ð¾Ñ‚Ð¼ÐµÐ½Ð° Booking Ð½Ðµ ÑÐ¾Ð·Ð´Ð°Ñ‘Ñ‚ Ñ„Ð¸Ð½Ð°Ð½ÑÐ¾Ð²Ñ‹Ð¹ settlement;
- Ð¾ÑÑ‚Ð°Ñ‘Ñ‚ÑÑ Ð´Ð¾Ð»Ð³ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð° 700 AZN;
- Ð¾Ð¿Ð»Ð°Ñ‚Ð° ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð° 300 AZN Ð½Ðµ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‰Ð°ÐµÑ‚ÑÑ;
- Ð²Ñ‹Ð¿Ð»Ð°Ñ‚Ð° Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÑƒ 300 AZN Ð½Ðµ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‰Ð°ÐµÑ‚ÑÑ;
- Order Ð¾ÑÑ‚Ð°Ñ‘Ñ‚ÑÑ FULFILLED Ð¿Ñ€Ð¸ Ð¾Ñ‚Ð¼ÐµÐ½Ñ‘Ð½Ð½Ð¾Ð¹ Booking.

Ð¡Ñ†ÐµÐ½Ð°Ñ€Ð¸Ð¹ Ð¾Ñ‚Ð¼ÐµÐ½Ñ‹ Ð¿Ð¾ÑÐ»Ðµ Ð¾Ð¿Ð»Ð°Ñ‚Ñ‹ ÑÑ‡Ð¸Ñ‚Ð°ÐµÑ‚ÑÑ **FAIL** Ð¸ Ñ‚Ñ€ÐµÐ±ÑƒÐµÑ‚ Ð¸ÑÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ñ Ñ„Ð¸Ð½Ð°Ð½ÑÐ¾Ð²Ð¾Ð³Ð¾ ÐºÐ¾Ð½Ñ‚ÑƒÑ€Ð° Ð¾Ñ‚Ð¼ÐµÐ½Ñ‹.

ÐŸÐ¾ÑÐ»Ðµ Ð¾Ð±Ð½Ð°Ñ€ÑƒÐ¶ÐµÐ½Ð¸Ñ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½ Ð·Ð°Ñ‰Ð¸Ñ‚Ð½Ñ‹Ð¹ Ð³ÐµÐ¹Ñ‚: Ð¿Ñ€ÑÐ¼Ð°Ñ Ð¾Ñ‚Ð¼ÐµÐ½Ð° Booking Ð¿Ñ€Ð¸ Ñ€Ð¾Ð´Ð¸Ñ‚ÐµÐ»ÑŒÑÐºÐ¾Ð¼ Order Ð² ÑÑ‚Ð°Ñ‚ÑƒÑÐµ `FULFILLED`/`CLOSED` Ñ‚ÐµÐ¿ÐµÑ€ÑŒ Ð±Ð»Ð¾ÐºÐ¸Ñ€ÑƒÐµÑ‚ÑÑ Ñ 409 Ð¸ Ñ‚Ñ€ÐµÐ±ÑƒÐµÑ‚ refund/settlement flow. Ð˜ÑÑ‚Ð¾Ñ€Ð¸Ñ‡ÐµÑÐºÐ°Ñ Ð½ÐµÑÐ¾Ð³Ð»Ð°ÑÐ¾Ð²Ð°Ð½Ð½Ð°Ñ ÑÐ´ÐµÐ»ÐºÐ° MKT-ORD-00000001 ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ð° ÐºÐ°Ðº Ð´Ð¾ÐºÐ°Ð·Ð°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð¾ Ð´ÐµÑ„ÐµÐºÑ‚Ð°.

### ÐŸÑ€Ð¾Ð²ÐµÑ€ÐºÐ° Ð¾Ñ‚Ð¼ÐµÐ½Ñ‹ Order Ñ Ð¾Ð¿Ð»Ð°Ñ‚Ð¾Ð¹ 300 AZN

Ð¡Ð¾Ð·Ð´Ð°Ð½Ð° ÑÐ´ÐµÐ»ÐºÐ°:

```text
MKT-REQ-00000004
MKT-ORD-00000004
ÐžÐ¿Ð»Ð°Ñ‚Ð° ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð° 300 AZN CAPTURED
```

Ð—Ð°ÐºÐ°Ð· Ð¾Ñ‚Ð¼ÐµÐ½Ñ‘Ð½ Ñ‡ÐµÑ€ÐµÐ· UI. ÐŸÐ°Ð½ÐµÐ»ÑŒ Ñ„Ð¸Ð½Ð°Ð½ÑÐ¾Ð²Ð¾Ð³Ð¾ Ñ€Ð°ÑÑ‡Ñ‘Ñ‚Ð° Ð¿Ð¾ÑÐ²Ð¸Ð»Ð°ÑÑŒ. Ð”Ð¾ Ð¸ÑÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ñ:

```text
confirm settlement â†’ 409 REMAINING_TO_REFUND
```

ÐŸÑ€Ð¸Ñ‡Ð¸Ð½Ð°: Ð¿ÐµÑ€ÐµÐ´ Ð·Ð°ÐºÑ€Ñ‹Ñ‚Ð¸ÐµÐ¼ settlement Ñ‚Ñ€ÐµÐ±ÑƒÐµÑ‚ÑÑ Ñ„Ð°ÐºÑ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹ Refund Ð½Ð° 300 AZN.

ÐŸÐ¾ÑÐ»Ðµ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð¸Ñ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ñ Â«Ð’ÐµÑ€Ð½ÑƒÑ‚ÑŒ ÐºÐ»Ð¸ÐµÐ½Ñ‚ÑƒÂ» Ð²Ñ‹Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¾:

```text
RFD-00000016  PROCESSED  300.00 AZN
SET-00000001  FINANCIALLY_SETTLED_FULL_REFUND
finalCustomerLiability = 0
remainingToRefund = 0
```

Ð¤Ð°ÐºÑ‚Ð¸Ñ‡ÐµÑÐºÐ¾Ðµ ÑÐ¾ÑÑ‚Ð¾ÑÐ½Ð¸Ðµ Ð¿Ð¾ÑÐ»Ðµ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‚Ð°:

```text
Order           CANCELLED
clientReceived   300.00
clientDebt         0.00
clientRefunded   300.00
supplierPaid       0.00
supplierDebt       0.00
expectedIncome     0.00
currentIncome      0.00
```

**Ð ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚:** Ð¾Ñ‚Ð¼ÐµÐ½Ð° Ð¾Ð¿Ð»Ð°Ñ‡ÐµÐ½Ð½Ð¾Ð³Ð¾ Ð·Ð°ÐºÐ°Ð·Ð° Ñ Ð¿Ð¾Ð»Ð½Ñ‹Ð¼ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‚Ð¾Ð¼ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ñƒ â€” PASS.  
ÐžÑ‚Ð¼ÐµÐ½Ð° Ð¿Ð¾ÑÐ»Ðµ Ð²Ñ‹Ð¿Ð»Ð°Ñ‚Ñ‹ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÑƒ Ð¸ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‚ Ð¾Ñ‚ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ° ÐµÑ‰Ñ‘ Ð½Ðµ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐµÐ½Ñ‹.

### ÐžÑ‚Ð¼ÐµÐ½Ð° ÑÐ¾ ÑˆÑ‚Ñ€Ð°Ñ„Ð¾Ð¼ 10%

Ð¡Ð´ÐµÐ»ÐºÐ°:

```text
MKT-REQ-00000005
MKT-ORD-00000005
ÐžÐ¿Ð»Ð°Ñ‚Ð° ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð° 300 AZN
```

Ð’ Ñ„Ð¸Ð½Ð°Ð½ÑÐ¾Ð²Ð¾Ð¼ Ñ€Ð°ÑÑ‡Ñ‘Ñ‚Ðµ ÑƒÐºÐ°Ð·Ð°Ð½Ð¾:

```text
ÐžÐºÐ¾Ð½Ñ‡Ð°Ñ‚ÐµÐ»ÑŒÐ½Ð¾Ðµ Ð¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð¾ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð°: 30.00
Ð¨Ñ‚Ñ€Ð°Ñ„: 30.00
Ð”Ð¾Ð»Ñ Ð¿Ð»Ð°Ñ‚Ñ„Ð¾Ñ€Ð¼Ñ‹: 30.00
```

Ð¡Ð¾Ð·Ð´Ð°Ð½ Ð¸ Ð¸ÑÐ¿Ð¾Ð»Ð½ÐµÐ½ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‚:

```text
RFD-00000017  PROCESSED  270.00 AZN
SET-00000002  FINANCIALLY_SETTLED_WITH_PENALTY
```

Ð ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚:

```text
clientReceived   300.00
clientRefunded   270.00
clientDebt         0.00
expectedIncome    30.00
currentIncome     30.00
```

**Ð ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚:** Ð¾Ñ‚Ð¼ÐµÐ½Ð° ÑÐ¾ ÑˆÑ‚Ñ€Ð°Ñ„Ð¾Ð¼ 10% â€” PASS.

### Ð’Ð¾Ð·Ð²Ñ€Ð°Ñ‚ Ð¾Ñ‚ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ° â€” PARTIAL

Ð’ UI Ð²Ñ‹Ð¿Ð»Ð°Ñ‚ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ°Ð¼ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ñ‹ Ð¿Ð¾Ð»Ñ:

```text
direction = OUTGOING | INCOMING
orderId (Ð´Ð»Ñ INCOMING)
```

Ð¡Ð¾Ð·Ð´Ð°Ð½ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‚ Ð¾Ñ‚ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ°:

```text
SPO-00000001-2
direction = INCOMING
amount = 300 AZN
status = PENDING â†’ CONFIRMED
```

Ð ÐµÐµÑÑ‚Ñ€ Ð¿Ð¾ÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÑ‚:

```text
supplierPaid     300.00
supplierRefunded 300.00
```

ÐŸÑ€Ð¾Ð²ÐµÑ€ÐµÐ½Ð° Ð¾Ñ‚Ð¼ÐµÐ½Ð° ÑÐ´ÐµÐ»ÐºÐ¸ Ñ Ð²Ñ‹Ð¿Ð»Ð°Ñ‚Ð¾Ð¹ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÑƒ Ð¸ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‚Ð¾Ð¼:

```text
MKT-REQ-00000007
clientReceived   300.00
clientRefunded   300.00
supplierPaid     300.00
supplierRefunded 300.00
supplierDebt       0.00
```

`SupplierObligation SBO-00000012` Ð·Ð°ÐºÑ€Ñ‹Ñ‚:

```text
status = CANCELLED
remainingAmount = 0.00
```

Ð˜ÑÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ: `cancelObligation` Ñ‚ÐµÐ¿ÐµÑ€ÑŒ Ñ€Ð°Ð·Ñ€ÐµÑˆÐ°ÐµÑ‚ Ð¾Ñ‚Ð¼ÐµÐ½Ñƒ, ÐµÑÐ»Ð¸ Ð²Ñ‹Ð¿Ð»Ð°Ñ‚Ð° Ð¿Ð¾Ð»Ð½Ð¾ÑÑ‚ÑŒÑŽ Ð¿ÐµÑ€ÐµÐºÑ€Ñ‹Ñ‚Ð° Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´Ñ‘Ð½Ð½Ñ‹Ð¼ INCOMING-Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‚Ð¾Ð¼ (net paid = 0), Ð¸ Ð¾Ð±Ð½ÑƒÐ»ÑÐµÑ‚ Ð¾ÑÑ‚Ð°Ñ‚Ð¾Ðº. Ð’ UI Ð¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð² Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð¾ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ Â«ÐžÑ‚Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ Ð¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð¾Â».

Ð¡Ñ‚Ð°Ñ‚ÑƒÑ: **PASS** â€” Ð¾Ñ‚Ð¼ÐµÐ½Ð° Ð¿Ð¾ÑÐ»Ðµ Ð²Ñ‹Ð¿Ð»Ð°Ñ‚Ñ‹ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÑƒ Ñ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‚Ð¾Ð¼ Ð¸ Ð·Ð°ÐºÑ€Ñ‹Ñ‚Ð¸ÐµÐ¼ Ð¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð°.

### Ð—Ð°Ñ‰Ð¸Ñ‚Ð° Ð¾Ñ‚ Ð´ÑƒÐ±Ð»Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð¸Ñ â€” PASS

Ð’Ñ‹Ð¿Ð¾Ð»Ð½ÐµÐ½Ð° Ð´Ð²Ð¾Ð¹Ð½Ð°Ñ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ° Ñ„Ð¾Ñ€Ð¼Ñ‹ Ð·Ð°ÑÐ²ÐºÐ¸.

Ð ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚:

```text
MKT-REQ-00000006 â€” Ð¾Ð´Ð½Ð° Ð·Ð°ÑÐ²ÐºÐ°
Ð´ÑƒÐ±Ð»Ð¸ÐºÐ°Ñ‚ Ð½Ðµ ÑÐ¾Ð·Ð´Ð°Ð½
```

ÐŸÐ¾Ð²Ñ‚Ð¾Ñ€Ð½Ñ‹Ð¹ ÐºÐ»Ð¸Ðº Ð¿Ð¾ÑÐ»Ðµ Ð¿ÐµÑ€Ð²Ð¾Ð³Ð¾ ÑÐ¾Ð·Ð´Ð°Ð½Ð¸Ñ Ð½Ðµ Ð¿Ñ€Ð¸Ð²Ð¾Ð´Ð¸Ñ‚ Ðº Ð²Ñ‚Ð¾Ñ€Ð¾Ð¹ Ð·Ð°ÑÐ²ÐºÐµ.

Ð˜ÑÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½ Ð²ÑÐ¿Ð¾Ð¼Ð¾Ð³Ð°Ñ‚ÐµÐ»ÑŒÐ½Ñ‹Ð¹ Ð´ÐµÑ„ÐµÐºÑ‚: `GET financial-settlement` Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‰Ð°Ð» Ñ€Ð°ÑÑ‡Ñ‘Ñ‚Ð½Ñ‹Ð¹ preview ÐºÐ°Ðº ÑƒÐ¶Ðµ ÑÑƒÑ‰ÐµÑÑ‚Ð²ÑƒÑŽÑ‰Ð¸Ð¹ settlement Ð¸ ÑÐºÑ€Ñ‹Ð²Ð°Ð» Ñ„Ð¾Ñ€Ð¼Ñƒ Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸Ñ. Ð¢ÐµÐ¿ÐµÑ€ÑŒ Ð¿Ñ€Ð¸ Ð¾Ñ‚ÑÑƒÑ‚ÑÑ‚Ð²Ð¸Ð¸ Ð·Ð°Ð¿Ð¸ÑÐ¸ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‰Ð°ÐµÑ‚ÑÑ `null`, Ð¸ Ñ„Ð¾Ñ€Ð¼Ð° Ð¾Ñ‚Ð¾Ð±Ñ€Ð°Ð¶Ð°ÐµÑ‚ÑÑ.

### Полная оплата 1000 AZN и полный возврат — PASS

Сделка:

```text
MKT-REQ-00000012
MKT-ORD-00000012
```

Оплата клиента:

```text
1000.00 AZN CAPTURED
```

Заказ отменён без штрафа, возврат выполнен через UI:

```text
clientReceived   1000.00
clientRefunded   1000.00
clientDebt          0.00
expectedIncome      0.00
currentIncome       0.00
```

Settlement закрыт как полный возврат.

## 7. KPI: Ð²Ð°Ð»Ð¾Ð²Ð°Ñ Ñ€Ð°Ð·Ð½Ð¸Ñ†Ð° Ð¸ Ð¾Ð¶Ð¸Ð´Ð°ÐµÐ¼Ñ‹Ð¹ Ð´Ð¾Ñ…Ð¾Ð´

Ð”Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð° Ð¾Ñ‚Ð´ÐµÐ»ÑŒÐ½Ð°Ñ KPI-ÐºÐ°Ñ€Ñ‚Ð¾Ñ‡ÐºÐ° **Â«Ð’Ð°Ð»Ð¾Ð²Ð°Ñ Ñ€Ð°Ð·Ð½Ð¸Ñ†Ð°Â»**.

Ð˜ÑÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¾: Ð´Ð»Ñ Ð¾Ñ‚Ð¼ÐµÐ½Ñ‘Ð½Ð½Ñ‹Ñ… ÑÐ´ÐµÐ»Ð¾Ðº Ð² KPI Ð²ÐºÐ»ÑŽÑ‡Ð°ÑŽÑ‚ÑÑ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ð½Ð½Ñ‹Ðµ ÑˆÑ‚Ñ€Ð°Ñ„Ñ‹:

```text
Ð¡ÑƒÐ¼Ð¼Ð° Ð¿Ñ€Ð¾Ð´Ð°Ð¶   = ÑˆÑ‚Ñ€Ð°Ñ„ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð°
Ð¡ÐµÐ±ÐµÑÑ‚Ð¾Ð¸Ð¼Ð¾ÑÑ‚ÑŒ  = ÑˆÑ‚Ñ€Ð°Ñ„ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ°
Ð’Ð°Ð»Ð¾Ð²Ð°Ñ Ñ€Ð°Ð·Ð½Ð¸Ñ†Ð° = ÑˆÑ‚Ñ€Ð°Ñ„ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð° âˆ’ ÑˆÑ‚Ñ€Ð°Ñ„ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ°
```

ÐŸÐµÑ€Ð²Ð¾Ð½Ð°Ñ‡Ð°Ð»ÑŒÐ½Ñ‹Ðµ Ñ†ÐµÐ½Ð° Ð²Ð¸Ñ‚Ñ€Ð¸Ð½Ñ‹ Ð¸ ÑÐµÐ±ÐµÑÑ‚Ð¾Ð¸Ð¼Ð¾ÑÑ‚ÑŒ Ð¾Ñ‚Ð¼ÐµÐ½Ñ‘Ð½Ð½Ð¾Ð¹ ÑƒÑÐ»ÑƒÐ³Ð¸ Ð² ÑÑ‚Ð¸ KPI Ð½Ðµ Ð²Ñ…Ð¾Ð´ÑÑ‚.

ÐŸÑ€Ð¸Ð·Ð½Ð°Ð½Ð½Ñ‹Ð¼ ÑÑ‡Ð¸Ñ‚Ð°ÐµÑ‚ÑÑ ÑˆÑ‚Ñ€Ð°Ñ„ Ð² ÑÑ‚Ð°Ñ‚ÑƒÑÐµ:

```text
FINANCIALLY_SETTLED_WITH_PENALTY
```

ÐŸÑ€ÐµÐ´Ð²Ð°Ñ€Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ñ‹Ð¹ `PENDING_SETTLEMENT` Ð² KPI Ð½Ðµ Ð²Ñ…Ð¾Ð´Ð¸Ñ‚.

Ð¢ÐµÐºÑƒÑ‰Ð°Ñ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐºÐ°:

```text
salesAmount      2030.00
costAmount       1600.00
grossMargin       430.00
expectedIncome    430.00
clientPenalty      30.00
```

Ð¢Ð¾ ÐµÑÑ‚ÑŒ:

```text
Ð°ÐºÑ‚Ð¸Ð²Ð½Ñ‹Ðµ Ð¿Ñ€Ð¾Ð´Ð°Ð¶Ð¸:            2000.00
ÑˆÑ‚Ñ€Ð°Ñ„ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð° Ð¿Ð¾ Ð¾Ñ‚Ð¼ÐµÐ½Ñ‘Ð½Ð½Ð¾Ð¹:   30.00
Ð¸Ñ‚Ð¾Ð³Ð¾ ÑÑƒÐ¼Ð¼Ð° Ð¿Ñ€Ð¾Ð´Ð°Ð¶:          2030.00

Ð°ÐºÑ‚Ð¸Ð²Ð½Ð°Ñ ÑÐµÐ±ÐµÑÑ‚Ð¾Ð¸Ð¼Ð¾ÑÑ‚ÑŒ:      1600.00
ÑˆÑ‚Ñ€Ð°Ñ„ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ°:                0.00
Ð¸Ñ‚Ð¾Ð³Ð¾ ÑÐµÐ±ÐµÑÑ‚Ð¾Ð¸Ð¼Ð¾ÑÑ‚ÑŒ:         1600.00

Ð²Ð°Ð»Ð¾Ð²Ð°Ñ Ñ€Ð°Ð·Ð½Ð¸Ñ†Ð° = 430.00
Ð¾Ð¶Ð¸Ð´Ð°ÐµÐ¼Ñ‹Ð¹ Ð´Ð¾Ñ…Ð¾Ð´ = 430.00
```

KPI Ñ‚ÐµÐ¿ÐµÑ€ÑŒ ÑÑ…Ð¾Ð´Ð¸Ñ‚ÑÑ Ñ Ð¿Ñ€Ð°Ð²Ð¸Ð»Ð°Ð¼Ð¸ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ð½Ð¸Ñ ÑˆÑ‚Ñ€Ð°Ñ„Ð¾Ð².

### Ð¨Ñ‚Ñ€Ð°Ñ„ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ° â€” FAIL

## 8. Ð¨Ñ‚Ñ€Ð°Ñ„ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ° â€” PASS Ð¿Ð¾ÑÐ»Ðµ Ð¸ÑÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ñ

Ð¡Ð´ÐµÐ»ÐºÐ°:

```text
MKT-REQ-00000008
client paid 300 AZN
```

Ð Ð°ÑÑ‡Ñ‘Ñ‚:

```text
ÐžÐºÐ¾Ð½Ñ‡Ð°Ñ‚ÐµÐ»ÑŒÐ½Ð¾Ðµ Ð¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð¾ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð°: 300.00
Ð¨Ñ‚Ñ€Ð°Ñ„: 80.00
Ð¨Ñ‚Ñ€Ð°Ñ„ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð°: 0.00
Ð”Ð¾Ð»Ñ Ð¿Ð»Ð°Ñ‚Ñ„Ð¾Ñ€Ð¼Ñ‹: 0.00
Ð”Ð¾Ð»Ñ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ°: 80.00
```

Ð¤Ð°ÐºÑ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹ Ñ€ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚:

```text
clientPenalty     0.00
supplierPenalty  80.00
expectedIncome  -80.00
salesAmount       0.00
costAmount       80.00
```

Ð˜ÑÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ: Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð¾ Ð¾Ñ‚Ð´ÐµÐ»ÑŒÐ½Ð¾Ðµ Ð¿Ð¾Ð»Ðµ `clientPenaltyAmount`; `DealRow.clientPenalty` Ð±Ð¾Ð»ÑŒÑˆÐµ Ð½Ðµ Ð±ÐµÑ€Ñ‘Ñ‚ÑÑ Ð¸Ð· Ð¾Ð±Ñ‰ÐµÐ³Ð¾ `penaltyAmount`.

Ð¢ÐµÐºÑƒÑ‰Ð¸Ð¹ KPI:

```text
salesAmount      2030.00
costAmount       1680.00
grossMargin       350.00
expectedIncome    350.00
clientPenalty      30.00
supplierPenalty    80.00
```

`350 = Ð°ÐºÑ‚Ð¸Ð²Ð½Ð°Ñ Ð¼Ð°Ñ€Ð¶Ð° 400 + ÐºÐ»Ð¸ÐµÐ½Ñ‚ÑÐºÐ¸Ð¹ ÑˆÑ‚Ñ€Ð°Ñ„ 30 âˆ’ ÑˆÑ‚Ñ€Ð°Ñ„ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ° 80`.

Ð¡Ñ‚Ð°Ñ‚ÑƒÑ: **PASS**.

```text
Request:  MKT-REQ-00000001
Order:    MKT-ORD-00000001  FULFILLED
Booking:  MKT-BKG-00000001  CONFIRMED

Customer: Aysel Mammadova
Supplier: TEST
Service:  Navitravel E2E Test Tour
Amount:   1000.00 AZN
```

Ð¤Ð¸Ð½Ð°Ð½ÑÐ¾Ð²Ñ‹Ð¹ Ñ€ÐµÐµÑÑ‚Ñ€:

```text
salesAmount      1000.00
costAmount       1000.00
clientReceived    300.00
clientDebt        700.00
supplierPaid      300.00
supplierDebt      700.00
expectedIncome      0.00
currentIncome       0.00
stage            BOOKING
```

SupplierObligation:

```text
SBO-00000010
amount 1000.00
remaining 700.00
status PARTIALLY_PAID
```

Client payment:

```text
MKT-PAY-00000001-1
300.00 AZN
CAPTURED
```

Supplier payout:

```text
SPO-00000001
300.00 AZN
CONFIRMED
```

## 9. Ð¨Ñ‚Ñ€Ð°Ñ„Ñ‹ Ð¾Ð±ÐµÐ¸Ñ… ÑÑ‚Ð¾Ñ€Ð¾Ð½ â€” PASS

Ð¡Ð´ÐµÐ»ÐºÐ°:

```text
MKT-REQ-00000009
client paid 300 AZN
client penalty 100 AZN
supplier penalty 80 AZN
```

Ð Ð°ÑÑ‡Ñ‘Ñ‚:

```text
ÐžÐºÐ¾Ð½Ñ‡Ð°Ñ‚ÐµÐ»ÑŒÐ½Ð¾Ðµ Ð¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð¾ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð°: 100.00
Ð¨Ñ‚Ñ€Ð°Ñ„: 180.00
Ð¨Ñ‚Ñ€Ð°Ñ„ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð°: 100.00
Ð”Ð¾Ð»Ñ Ð¿Ð»Ð°Ñ‚Ñ„Ð¾Ñ€Ð¼Ñ‹: 100.00
Ð”Ð¾Ð»Ñ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ°: 80.00
```

Ð ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚:

```text
clientReceived   300.00
clientRefunded   200.00
clientDebt         0.00
clientPenalty    100.00
supplierPenalty   80.00
expectedIncome    20.00
currentIncome     20.00
```

Settlement:

```text
SET-00000005
FINANCIALLY_SETTLED_WITH_PENALTY
```

Ð˜ÑÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½ DTO-ÐºÐ¾Ð½Ñ‚Ñ€Ð¾Ð»Ð»ÐµÑ€: `clientPenaltyAmount` Ñ‚ÐµÐ¿ÐµÑ€ÑŒ Ð¿Ñ€Ð¸Ð½Ð¸Ð¼Ð°ÐµÑ‚ÑÑ API, Ð° Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐºÐ° `PENALTY_EXCEEDS_LIABILITY` ÑÑ€Ð°Ð²Ð½Ð¸Ð²Ð°ÐµÑ‚ Ñ Ð¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð¾Ð¼ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð°, Ð° Ð½Ðµ Ñ Ð¾Ð±Ñ‰ÐµÐ¹ ÑÑƒÐ¼Ð¼Ð¾Ð¹ ÑˆÑ‚Ñ€Ð°Ñ„Ð¾Ð².

KPI Ð¿Ð¾ÑÐ»Ðµ ÑÑ†ÐµÐ½Ð°Ñ€Ð¸Ñ:

```text
salesAmount      2230.00
costAmount       1840.00
grossMargin       390.00
expectedIncome    390.00
clientPenalty     130.00
supplierPenalty   160.00
```

ÐŸÐ¾Ð²Ñ‚Ð¾Ñ€Ð½Ñ‹Ð¹ Ñ€ÑƒÑ‡Ð½Ð¾Ð¹ UI-Ð¿Ñ€Ð¾Ð³Ð¾Ð½:

```text
MKT-REQ-00000010
client penalty 100
supplier penalty 80
refund 200
settlement confirmed Ñ‡ÐµÑ€ÐµÐ· ÐºÐ½Ð¾Ð¿ÐºÑƒ UI
```

Ð ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚:

```text
clientRefunded   200.00
clientPenalty    100.00
supplierPenalty   80.00
expectedIncome    20.00
currentIncome     20.00
```

Ð¡Ñ‚Ð°Ñ‚ÑƒÑ: **PASS**.

## 10. ÐŸÐµÑ€ÐµÐ¿Ð»Ð°Ñ‚Ð° â€” PASS

ÐŸÑ€Ð¾Ð²ÐµÑ€ÐµÐ½Ð¾ Ð½Ð° Ð¿Ð¾Ð»Ð½Ð¾ÑÑ‚ÑŒÑŽ Ð¾Ð¿Ð»Ð°Ñ‡ÐµÐ½Ð½Ð¾Ð¼ Ð·Ð°ÐºÐ°Ð·Ðµ:

```text
MKT-ORD-00000002
amount   1000.00
paid     1000.00
due         0.00
```

Ð’ Ñ„Ð¾Ñ€Ð¼Ðµ ÑÐ¾Ð·Ð´Ð°Ð½Ð¸Ñ Ð¿Ð»Ð°Ñ‚ÐµÐ¶Ð°:

```text
amount = 0.00 Ð¿Ð¾ ÑƒÐ¼Ð¾Ð»Ñ‡Ð°Ð½Ð¸ÑŽ
Ð²Ð²Ð¾Ð´ 1.00 â†’ submit disabled
```

Ð¡Ð¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ:

```text
Ã–dÉ™niÅŸ mÉ™blÉ™ÄŸi 0-dan bÃ¶yÃ¼k, qalÄ±q mÉ™blÉ™ÄŸdÉ™n Ã§ox olmamalÄ±...
```

ÐÐ¾Ð²Ñ‹Ð¹ Ð¿Ð»Ð°Ñ‚Ñ‘Ð¶ Ð½Ðµ ÑÐ¾Ð·Ð´Ð°Ð½. Ð—Ð°Ñ‰Ð¸Ñ‚Ð° Ð¾Ñ‚ Ð¿ÐµÑ€ÐµÐ¿Ð»Ð°Ñ‚Ñ‹ Ñ€Ð°Ð±Ð¾Ñ‚Ð°ÐµÑ‚.

## 11. Ð Ð¾Ð»Ð¸ Ð¸ Ð¿Ñ€Ð°Ð²Ð° â€” PASS

Ð¡Ð¾Ð·Ð´Ð°Ð½ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ:

```text
qa.manager
role = SALES_MANAGER
```

ÐŸÑ€Ð¾Ð²ÐµÑ€ÐµÐ½Ð¾ Ð¿Ð¾Ð´ SALES_MANAGER:

```text
/app/finance/deals â†’ redirect /app/dashboard
Ð¼ÐµÐ½ÑŽ Â«Ð ÐµÐµÑÑ‚Ñ€ Ð¿Ñ€Ð¾Ð´Ð°Ð¶Â» Ð¾Ñ‚ÑÑƒÑ‚ÑÑ‚Ð²ÑƒÐµÑ‚
17 Ñ€Ð°Ð·Ð´ÐµÐ»Ð¾Ð² ÑÐºÑ€Ñ‹Ñ‚Ñ‹
6 Ñ€Ð°Ð·Ð´ÐµÐ»Ð¾Ð² ÑÐºÑ€Ñ‹Ñ‚Ñ‹ Ð½Ð° Ñ€Ð°Ð±Ð¾Ñ‡ÐµÐ¼ ÑÑ‚Ð¾Ð»Ðµ
```

ÐÐ° ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ðµ Ð¿Ð»Ð°Ñ‚ÐµÐ¶ÐµÐ¹:

```text
create payment button â€” Ð¾Ñ‚ÑÑƒÑ‚ÑÑ‚Ð²ÑƒÐµÑ‚
read-only Ð¿Ñ€Ð¾ÑÐ¼Ð¾Ñ‚Ñ€ Ð¿Ð»Ð°Ñ‚ÐµÐ¶ÐµÐ¹
```

ÐŸÑ€ÑÐ¼Ð¾Ð¹ Ð´Ð¾ÑÑ‚ÑƒÐ¿ Ðº Ñ„Ð¸Ð½Ð°Ð½ÑÐ¾Ð²Ð¾Ð¼Ñƒ Ñ€ÐµÐµÑÑ‚Ñ€Ñƒ Ð·Ð°Ð±Ð»Ð¾ÐºÐ¸Ñ€Ð¾Ð²Ð°Ð½, ÑÐ¾Ð·Ð´Ð°Ð½Ð¸Ðµ Ð¿Ð»Ð°Ñ‚ÐµÐ¶Ð° Ð½ÐµÐ´Ð¾ÑÑ‚ÑƒÐ¿Ð½Ð¾.

Клиентский пользователь:

```text
qa.buyer
role = BUYER
```

Проверено:

```text
/app/finance/deals → /account
/app/payments     → /account
```

Клиент видит только личный кабинет: заказы, брони, платежи, документы, поддержку.

Финансовый пользователь:

```text
qa.finance
role = FINANCE
```

Проверено:

```text
/app/finance/deals — доступен
```

В меню доступны финансовые разделы.

## 12. Финансовый журнал — PARTIAL

Добавлена страница:

```text
/app/finance/ledger
```

Она показывает append-only проводки:

```text
PAYMENT_CAPTURED
REFUND_PROCESSED
SUPPLIER_PAYOUT
PLATFORM_PENALTY_SHARE
SUPPLIER_PENALTY_SHARE
UNPAID_WRITE_OFF
```

Сверка на текущих данных:

```text
PAYMENT_CAPTURED        8 проводок / 3100.00
Refund                  5 записей / 1270.00
Ledger REFUND_PROCESSED 5 проводок / 1270.00 — сходится
SupplierPayout OUTGOING 3 / 1400.00
Ledger SUPPLIER_PAYOUT  3 / 1400.00 — сходится
```

Но:

```text
SupplierPayout INCOMING 2 записи (600.00)
Ledger-проводок по ним 0
```

Возвраты от поставщика не попадают в `LedgerTransaction`.

Статус: **PARTIAL** — исходящие платежи и возвраты клиентам сходятся, входящие возвраты от поставщика отсутствуют в журнале.

## 13. Отклонённый платёж — PASS

Создана заявка и заказ:

```text
MKT-REQ-00000011
MKT-ORD-00000011
```

Создан платёж:

```text
PAY-00000023
amount 100.00 AZN
status PENDING
```

Платёж отменён через UI до подтверждения.

Результат:

```text
PAY-00000023 status = CANCELLED

clientReceived    0.00
clientDebt     1000.00
expectedIncome  200.00
currentIncome     0.00
```

Отклонённый платёж не увеличил полученные средства, не создал доход и не изменил долг клиента.


KPI после создания активного заказа MKT-ORD-00000011:

```text
salesAmount      3230.00
costAmount       2640.00
grossMargin       590.00
expectedIncome    590.00
```

## 14. Pending-штраф — PASS

Сделка:

```text
MKT-REQ-00000013
MKT-ORD-00000013
client paid 300 AZN
```

В settlement указано:

```text
penaltyAmount 30.00
clientPenaltyAmount 30.00
clientPenaltyStatus PENDING
supplierPenaltyStatus CONFIRMED
finalCustomerLiability 300.00
```

Результат:

```text
clientReceived   300.00
clientRefunded     0.00
clientPenalty      0.00
supplierPenalty    0.00
expectedIncome     0.00
currentIncome      0.00
```

Pending-штраф не включён в KPI и не создал ledger-проводку штрафа.

### Waived-штраф — PASS

Сделка:

```text
MKT-REQ-00000014
client paid 300 AZN
clientPenaltyAmount 30.00
clientPenaltyStatus WAIVED
```

Результат:

```text
clientPenalty      0.00
supplierPenalty    0.00
expectedIncome     0.00
currentIncome      0.00
```

Штраф со статусом WAIVED не попал в KPI и не создал ledger-проводку.

### Withheld-штраф — PASS

Сделка:

```text
MKT-REQ-00000015
client paid 300 AZN
clientPenaltyAmount 30.00
clientPenaltyStatus WITHHELD
finalCustomerLiability 30.00
```

Результат:

```text
clientRefunded   270.00
clientPenalty     30.00
supplierPenalty    0.00
expectedIncome    30.00
currentIncome     30.00
```

Штраф удержан из оплаты: клиенту возвращено 270 AZN, платформа признала 30 AZN дохода.

KPI:

```text
salesAmount      3260.00
costAmount       2640.00
grossMargin       620.00
expectedIncome    620.00
```

### Received-штраф — PASS

Сделка:

```text
MKT-REQ-00000016
client paid 300 AZN
clientPenaltyAmount 30.00
clientPenaltyStatus RECEIVED
finalCustomerLiability 30.00
```

Результат:

```text
clientRefunded   270.00
clientPenalty     30.00
expectedIncome    30.00
currentIncome     30.00
```

Штраф фактически получен: клиенту возвращено 270 AZN, доход 30 AZN признан.

KPI:

```text
salesAmount      3290.00
costAmount       2640.00
grossMargin       650.00
expectedIncome    650.00
```

## 15. Конкурентное подтверждение платежа — PASS

Создан платёж:

```text
PAY-00000028
60.00 AZN
PENDING
```

Две независимые сессии одновременно нажали «Təsdiqlə».

Результат:

```text
PAY-00000028 status = CAPTURED
Ledger PAYMENT_CAPTURED = 1 запись
clientReceived = 110.00
clientDebt     = 890.00
```

Двойного зачисления нет: одна проводка, один захват.

### Конкурентное закрытие settlement — PASS

Сделка:

```text
MKT-REQ-00000017
client paid 300 AZN
finalCustomerLiability 300 AZN
```

Две независимые сессии одновременно подтвердили закрытие.

Результат:

```text
settlements = 1
SET-00000012
financialStatus = FINANCIALLY_SETTLED
clientDebt = 0.00
```

Дубликат settlement не создан.

### Конкурентное создание Refund — PASS

Сделка:

```text
MKT-REQ-00000018
client paid 300 AZN
```

Две независимые сессии одновременно нажали «Вернуть клиенту 300».

Результат:

```text
RFD-00000025 PROCESSED 300.00
clientReceived 300.00
clientRefunded 300.00
clientDebt       0.00
```

Создан один возврат; дубликата нет.

После конкурентного возврата settlement закрыт отдельным ручным действием:

```text
MKT-REQ-00000018
financialStatus = FINANCIALLY_SETTLED_FULL_REFUND
clientReceived 300.00
clientRefunded 300.00
clientDebt       0.00
expectedIncome   0.00
```

## 16. Сверка денежных остатков — PASS

Сверка реестра с Ledger на текущих данных:

| Показатель | Реестр | Ledger | Результат |
|---|---:|---:|---|
| Получено от клиентов | 6010.00 | PAYMENT_CAPTURED 6010.00 | PASS |
| Возвращено клиентам | 3110.00 | REFUND_PROCESSED 3110.00 | PASS |
| Оплачено поставщикам | 1400.00 | SUPPLIER_PAYOUT 1400.00 | PASS |
| Возврат от поставщика | 600.00 | SUPPLIER_REFUND 600.00 | PASS |

Дополнительные проводки:

```text
PLATFORM_PENALTY_SHARE 5 / 290.00
SUPPLIER_PENALTY_SHARE 3 / 240.00
UNPAID_WRITE_OFF 11 / 7700.00
```

Расхождений по денежным остаткам нет.

### Совпадение контактов — PASS

Создана заявка с телефоном и email существующего клиента Aysel Mammadova:

```text
MKT-REQ-00000019
phone +994501234567
email aysel@example.com
```

Результат:

```text
customers с этими контактами = 1
customerId = abe8492f-9bad-4f81-a307-874bf67c39a7
```

Дубликат клиента не создан.

## 17. Универсальный поиск туров — PASS

Открыт публичный поиск:

```text
/search
```

Найдено:

```text
8121 предложение
```

Выбрано предложение:

```text
Navitravel E2E Test Tour
1000.00 AZN
```

Заполнены поля:

```text
Universal Search
+994703334455
universal@example.com
```

Создана заявка:

```text
MKT-REQ-00000020
supplierCode = TEST
customerId = 8c9343d6-4a9f-4542-a56b-b4457da3722f
status = NEW
```

Канал универсального поиска работает: поиск → выбор → данные → заявка.

## 18. Заявки не входят в KPI продаж — PASS

Заявки — это pipeline, а не продажа. KPI «Сумма продаж», «Себестоимость», «Валовая разница», «Ожидаемый доход» и «Текущий доход» теперь считаются только по стадиям ORDER и BOOKING.

Текущие значения:

```text
salesAmount      2290.00
costAmount       1840.00
grossMargin       450.00
expectedIncome    450.00
clientPenalty     290.00
supplierPenalty   240.00
```

Проверка: созданные заявки MKT-REQ-00000019 и MKT-REQ-00000020 больше не увеличивают «Сумму продаж» до конвертации в заказ.

## 19. Отмена начисленного штрафа — PASS

Сделка:

```text
MKT-REQ-00000015
clientPenaltyStatus WITHHELD
clientPenaltyAmount 30.00
clientRefunded 270.00
```

В UI нажато:

```text
«Отменить штраф клиента»
```

Результат:

```text
RFD-00000026 PROCESSED 30.00
clientRefunded 300.00
clientPenalty    0.00
financialStatus FINANCIALLY_SETTLED
```

Ledger:

```text
PLATFORM_PENALTY_SHARE_REVERSAL 1 / 30.00
```

KPI после отмены:

```text
salesAmount      2260.00
costAmount       1840.00
grossMargin       420.00
expectedIncome    420.00
clientPenalty     260.00
```

Штраф снят, клиенту доплатили 30 AZN, reversal-проводка создана.

## 20. Отдельное подтверждение Refund — PASS

Добавлена страница:

```text
/app/finance/refunds
```

На ней можно:

- создать Refund в статусе REQUESTED;
- подтвердить его отдельной кнопкой;
- исполнить отдельной кнопкой.

Проверка:

```text
RFD-00000027 REQUESTED → APPROVED → PROCESSED
```

Конкурентная проверка:

```text
RFD-00000028
две сессии одновременно нажали «Подтвердить»
→ один переход APPROVED
две сессии одновременно нажали «Исполнить»
→ один переход PROCESSED
```

Дубликата перехода нет.

## 21. Webhook с идемпотентностью — PASS

Добавлен endpoint:

```text
POST /api/v1/public/payments/webhook
```

Защита:

```text
X-Webhook-Signature = HMAC-SHA256(body, PAYMENT_WEBHOOK_SECRET)
```

Идемпотентность:

```text
eventId уникален в finance.PaymentWebhookEvent
```

Проверка на платеже:

```text
PAY-00000033 20.00 AZN PENDING
```

Первая доставка:

```text
eventId evt-qa-002
HTTP 201
{ received: true, duplicate: false }
```

Повторная доставка:

```text
eventId evt-qa-002
HTTP 201
{ received: true, duplicate: true }
```

Результат:

```text
PAY-00000033 status = CAPTURED
повторного захвата/проводки нет
```

## 22. Тестовые продукты других типов

Добавлены продукты:

```text
PRD-TEST-HOTEL      HOTEL
PRD-TEST-FLIGHT     FLIGHT
PRD-TEST-TRANSFER   TRANSFER
PRD-TEST-EXCURSION  EXCURSION
PRD-TEST-SANATORIUM SANATORIUM
```

SQL: `reports/backups/seed_test_types.sql`.

### Отель — PASS

Открыт продукт `33333333-3333-4333-8333-333333333333`, выбран тариф 800 AZN, заполнены имя/фамилия/телефон/email, отправлена заявка:

```text
MKT-REQ-00000021
status = NEW
```

### Авиабилет / трансфер / экскурсия / санаторий — PASS

Через guest-checkout созданы заявки:

```text
MKT-REQ-00000023 FLIGHT
MKT-REQ-00000024 TRANSFER
MKT-REQ-00000025 EXCURSION
MKT-REQ-00000026 SANATORIUM
```

Добавлены типы CRUISE и INSURANCE, продукты:

```text
PRD-TEST-CRUISE
PRD-TEST-INSURANCE
```

Созданы заявки через guest-checkout:

```text
MKT-REQ-00000027 CRUISE
MKT-REQ-00000028 INSURANCE
```




## 23. Исправленные дефекты

| ID | Ð”ÐµÑ„ÐµÐºÑ‚ | Ð˜ÑÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ |
|---|---|---|
| DEF-001 | ÐšÐ»Ð¸ÐµÐ½Ñ‚ Ñ Ð·Ð°ÑÐ²ÐºÐ¾Ð¹ Ð½Ðµ Ð¾Ñ‚Ð¾Ð±Ñ€Ð°Ð¶Ð°Ð»ÑÑ Ð² CRM | Marketplace scope Ñ‚ÐµÐ¿ÐµÑ€ÑŒ ÑƒÑ‡Ð¸Ñ‚Ñ‹Ð²Ð°ÐµÑ‚ Request.customerId |
| DEF-002 | ÐŸÐ¾ÑÑ‚Ð°Ð²Ñ‰Ð¸Ðº Ð½Ðµ ÑÐ¾Ñ…Ñ€Ð°Ð½ÑÐ»ÑÑ Ð² snapshot Ð·Ð°ÑÐ²ÐºÐ¸ | supplierCode Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½ Ð² productSnapshot |
| DEF-003 | ÐšÐ°Ñ€Ñ‚Ð¾Ñ‡ÐºÐ° Request Ð½Ðµ Ð¿Ð¾ÐºÐ°Ð·Ñ‹Ð²Ð°Ð»Ð° Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ° Ð±ÐµÐ· Partner | fallback Ð½Ð° snapshot supplierCode |
| DEF-004 | SupplierPayout Ð½Ðµ ÑÐ²ÑÐ·Ñ‹Ð²Ð°Ð»ÑÑ Ñ Order/Booking | payout Ð¿Ð¸ÑˆÐµÑ‚ orderId/bookingId Ð¸Ð· obligation; ÑÑ‚Ð°Ñ€Ñ‹Ðµ ÑÑ‚Ñ€Ð¾ÐºÐ¸ backfill |
| DEF-005 | Ð¤Ð¾Ñ€Ð¼Ð° Ñ‚ÑƒÑ€Ð¾Ð² Ñ€Ð°Ð·Ñ€ÐµÑˆÐ°Ð»Ð° Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÑƒ Ð±ÐµÐ· Ð¸Ð¼ÐµÐ½Ð¸/email | Ð¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÑŒÐ½Ñ‹Ðµ Ð¿Ð¾Ð»Ñ Ð¸ inline-Ð¾ÑˆÐ¸Ð±ÐºÐ¸ |
| DEF-006 | ÐžÑ‚Ð¼ÐµÐ½Ñ‘Ð½Ð½Ð°Ñ ÑÐ´ÐµÐ»ÐºÐ° Ð±ÐµÐ· obligation Ð¿Ð¾ÐºÐ°Ð·Ñ‹Ð²Ð°Ð»Ð° supplierDebt 800 | Ð´Ð»Ñ cancelled Ð±ÐµÐ· obligation supplierDebt = 0 |
| DEF-007 | ÐžÑ‚Ð¼ÐµÐ½Ð° Booking Ñƒ FULFILLED Order Ð¾ÑÑ‚Ð°Ð²Ð»ÑÐ»Ð° Ñ„Ð¸Ð½Ð°Ð½ÑÐ¾Ð²ÑƒÑŽ Ð½ÐµÑÐ¾Ð³Ð»Ð°ÑÐ¾Ð²Ð°Ð½Ð½Ð¾ÑÑ‚ÑŒ | Ð¿Ñ€ÑÐ¼Ð°Ñ Ð¾Ñ‚Ð¼ÐµÐ½Ð° Ð¿Ñ€Ð¸ FULFILLED/CLOSED Ñ‚ÐµÐ¿ÐµÑ€ÑŒ Ð±Ð»Ð¾ÐºÐ¸Ñ€ÑƒÐµÑ‚ÑÑ 409 |
| DEF-008 | ÐŸÐ¾ÑÐ»Ðµ Ð¾Ñ‚Ð¼ÐµÐ½Ñ‹ Order Ñ Ð¾Ð¿Ð»Ð°Ñ‚Ð¾Ð¹ Ð½Ðµ Ð±Ñ‹Ð»Ð¾ UI-ÑÐ¾Ð·Ð´Ð°Ð½Ð¸Ñ Refund; settlement Ð±Ð»Ð¾ÐºÐ¸Ñ€Ð¾Ð²Ð°Ð»ÑÑ REMAINING_TO_REFUND | Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð¾ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ Â«Ð’ÐµÑ€Ð½ÑƒÑ‚ÑŒ ÐºÐ»Ð¸ÐµÐ½Ñ‚ÑƒÂ» â†’ Refund PROCESSED â†’ settlement Ð·Ð°ÐºÑ€Ñ‹Ñ‚ |
| DEF-009 | ÐÐµÑ‚ UI Ð´Ð»Ñ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‚Ð° Ð¾Ñ‚ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ° (INCOMING supplier payment) | Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ñ‹ direction/orderId; INCOMING 300 AZN ÑÐ¾Ð·Ð´Ð°Ð½ Ð¸ Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´Ñ‘Ð½ |
| DEF-010 | ÐžÑ‚Ð¼ÐµÐ½Ñ‘Ð½Ð½Ñ‹Ðµ ÑÐ´ÐµÐ»ÐºÐ¸ Ð¿Ð¾Ð¿Ð°Ð´Ð°Ð»Ð¸ Ð² KPI Â«Ð¡ÑƒÐ¼Ð¼Ð° Ð¿Ñ€Ð¾Ð´Ð°Ð¶Â» Ð¸ Â«Ð¡ÐµÐ±ÐµÑÑ‚Ð¾Ð¸Ð¼Ð¾ÑÑ‚ÑŒÂ» | Ð¾Ñ‚Ð¼ÐµÐ½Ñ‘Ð½Ð½Ñ‹Ðµ Ð²Ñ…Ð¾Ð´ÑÑ‚ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ð½Ð½Ñ‹Ð¼ ÑˆÑ‚Ñ€Ð°Ñ„Ð¾Ð¼: clientPenalty / supplierPenalty |
| DEF-011 | ÐžÑ‚Ð¼ÐµÐ½Ð° Ð·Ð°ÐºÐ°Ð·Ð° Ð½Ðµ Ð·Ð°ÐºÑ€Ñ‹Ð²Ð°Ð»Ð° SupplierObligation | Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð¾ Ð·Ð°ÐºÑ€Ñ‹Ñ‚Ð¸Ðµ Ð¿Ñ€Ð¸ net paid=0 Ð¸ UI-Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ Â«ÐžÑ‚Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ Ð¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð¾Â» |
| DEF-012 | Ð¨Ñ‚Ñ€Ð°Ñ„ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿Ð¾ÑÑ‚Ð°Ð²Ñ‰Ð¸ÐºÐ° Ð·Ð°Ð¿Ð¸ÑÑ‹Ð²Ð°Ð»ÑÑ Ð¸ ÐºÐ°Ðº ÑˆÑ‚Ñ€Ð°Ñ„ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð° | Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð¾ Ð¾Ñ‚Ð´ÐµÐ»ÑŒÐ½Ð¾Ðµ `clientPenaltyAmount`, backfill Ð¸ KPI-Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ð½Ð¸Ðµ |
| DEF-013 | API settlement Ð½Ðµ Ð¿Ñ€Ð¸Ð½Ð¸Ð¼Ð°Ð» `clientPenaltyAmount`; liability-guard ÑÑ€Ð°Ð²Ð½Ð¸Ð²Ð°Ð» Ð¾Ð±Ñ‰ÑƒÑŽ ÑÑƒÐ¼Ð¼Ñƒ ÑˆÑ‚Ñ€Ð°Ñ„Ð¾Ð² | DTO Ð´Ð¾Ð¿Ð¾Ð»Ð½ÐµÐ½, guard ÑÑ€Ð°Ð²Ð½Ð¸Ð²Ð°ÐµÑ‚ clientPenalty |

| DEF-014 | Нет отдельных состояний штрафа | добавлены client/supplier penalty status PENDING/CONFIRMED/WAIVED; KPI учитывает только CONFIRMED |

| DEF-015 | INCOMING supplier refund не создавал LedgerTransaction | добавлен тип SUPPLIER_REFUND, direction в событии, backfill 2 записей на 600 AZN |

| DEF-016 | Заявки попадали в KPI «Сумма продаж» до конвертации | KPI продаж считается только по ORDER/BOOKING |

## 24. Ограничения

1. Штрафы pending/waived не входят в KPI; confirmed, withheld и received входят.
2. Cancelled-штраф после начисления проверен: возврат 30, reversal-проводка.
3. Универсальный поиск авиабилетов заблокирован внешними источниками.
4. Добавлены продукты HOTEL/FLIGHT/TRANSFER/EXCURSION/SANATORIUM/CRUISE/INSURANCE; заявки по всем типам созданы.
5. Конкурентные платёж, settlement, создание и подтверждение Refund проверены.

## 25. Следующий этап

1. Проверить cancelled-штраф после начисления.
2. Проверить конкурентное подтверждение Refund.
3. Проверить оставшиеся типы услуг.
4. Повторно сверить KPI и Ledger после новых сценариев.





Подробные доказательства BLOCKED: [MANUAL_E2E_REMAINING_CHECKS.md](MANUAL_E2E_REMAINING_CHECKS.md).









