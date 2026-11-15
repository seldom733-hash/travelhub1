# Sales Analytics — finance sign-off package

Коммит, на который выдаётся заключение:

```text
c5baa62 test: seed partial payments refunds and adjustments
```

## Артефакты и контрольные суммы

| Артефакт | SHA-256 |
|---|---|
| `backend/src/modules/sales-analytics/sales-analytics.service.ts` | `4621A7D1D748BCEF7FB5C03E3510EF9C289DCB66FC20091FD57209EAE851FE09` |
| `reports/sales-analytics-finance-signoff.md` | `A9D5FC2C5A899702D8E925E938616A825D9EB7647613776B39FE6A43CEB5F44C` |
| `reports/sales-analytics-finance-decisions.md` | `6525E80CFA09C9E817BE05494E492BC7C294A784992EBE028561F2944171B9A5` |

## Что проверяет FINANCE

```text
1. SupplierObligation.aznAmount — источник себестоимости.
2. Одна последняя obligation на OrderItem.
3. Payment.paidAt — дата выручки.
4. Refund.processedAt — дата возврата.
5. OrderFinancialAdjustment.occurredAt — дата корректировки.
6. OrderFinancialSettlement.finalCustomerLiability — база сверки.
7. Формула grossProfit = salesAmount − costAmount.
8. Исключение CANCELLED из продаж, себестоимости, завершённых и закрытых.
9. Распределение себестоимости по OrderItem.
10. Решения из sales-analytics-finance-decisions.md.
```

## Проверочный срез

```text
salesAmount          = 3 624.21
capturedRevenue      = 1 362.62
refunds              = 29.00
adjustments          = 20.00
obligationCost       = 2 886.28
grossProfit          = 145.80
closedDeals          = 1
closedSettlements    = 1
```

## Решение FINANCE

```text
[ ] APPROVED
[ ] APPROVED WITH CHANGES
[ ] REJECTED

Комментарий:
____________________________________________________________________

FINANCE: ____________________   Дата: __________

Разработка: __________________  Дата: __________
```

## После подписи

1. Обновить `reports/sales-analytics-finance-decisions.md`: статус `APPROVED`.
2. Зафиксировать в `reports/sales-analytics-acceptance.md` пункт 18 как ✅.
3. При изменениях — обновить SHA-256 и повторить проверку.
