# Supplier Settlement Terms / Balance / Payout Release / Trust & Transparency / Platform Liquidity Monitoring

**Статус документа:** PHASE 3 — Architecture Additive Amendment
**Дата актуализации:** 2026-08-25
**Тип:** Documentation-only reconciliation (НЕ production implementation)

------------------------------------------------------------------------

# 1. НАЗНАЧЕНИЕ

Canonical authority для supplier-side финансового контура TravelHub.
Дополняет уже закрытую архитектуру:

``` text
Booking Commercial Terms
Customer Payment Schedules
Agreement Versioning & Audit
Customer Payment ≠ Supplier Settlement
```

------------------------------------------------------------------------

# 2. ГЛАВНЫЙ АРХИТЕКТУРНЫЙ ИНВАРИАНТ

В одной booking/order lifecycle существуют ДВА независимых финансовых контракта:

``` text
A. Customer Payment Terms       — Как и когда клиент платит
B. Supplier Settlement Terms    — Когда и какую часть можно высвободить поставщику
C. Supplier Payout              — Фактическое перечисление
```

Canonical invariant:

``` text
Customer Payment Terms
≠
Supplier Settlement Terms
≠
Supplier Payout
```

------------------------------------------------------------------------

# 3. ДВА IMMUTABLE SNAPSHOTS PER BOOKING

``` text
Booking
├── BookingCommercialTermsSnapshot
│   └── Customer Payment Terms
│
└── SupplierSettlementTermsSnapshot
    └── TravelHub ↔ Supplier Settlement Terms
```

Оба snapshot versioned/auditable. Изменение future policy не меняет исторические bookings.

------------------------------------------------------------------------

# 4. SUPPLIER SETTLEMENT TERMS — CONCEPTUAL CONTENT

``` text
bookingId / orderId / supplierId
partnerAgreementVersion / settlementPolicyVersion
commissionRule/version
supplier entitlement rule
release conditions
release schedule
reserve/holdback rule
payout cadence
refund responsibility / chargeback responsibility
adjustment rules / negative-balance rules
currency / effectiveAt / createdAt
```

------------------------------------------------------------------------

# 5. SUPPLIER FINANCIAL LIFECYCLE

``` text
Customer Funds Collected
→ Supplier Gross Entitlement
→ Supplier Net Entitlement
→ Awaiting Release Condition
→ Available for Payout
→ Reserve / Holdback
→ Payout Processing
→ Paid
→ Adjustments
→ Negative Supplier Balance / Supplier Receivable
```

------------------------------------------------------------------------

# 6. SUPPLIER ENTITLEMENT

``` text
Supplier Net Entitlement
=
Supplier Gross Entitlement
- TravelHub Commission
- Refund Adjustments
- Chargeback Adjustments
± Other Canonical Contractual Adjustments
```

------------------------------------------------------------------------

# 7. RELEASE CONDITIONS

Supplier settlement policy поддерживает release conditions:

``` text
supplier confirmed booking
customer installment collected
customer fully paid
service milestone reached
service started
service completed
refund/dispute window passed
manual risk review completed
contract-specific milestone
```

------------------------------------------------------------------------

# 8. RESERVE / HOLDBACK

Временно удерживаемая supplier-related сумма:

``` text
refund exposure / chargeback exposure / service incomplete
partner risk policy / contractual reserve / dispute
```

Каждый hold обязан иметь:

``` text
amount / reason / source booking/order / createdAt
releaseCondition / expectedReleaseAt (если deterministically known)
policy/version
```

------------------------------------------------------------------------

# 9. ADJUSTMENTS

``` text
refund adjustment / chargeback adjustment / commission correction
authorized manual correction / contractual adjustment
```

Каждый: amount, reason, source, actor/system, timestamp, audit trail.

------------------------------------------------------------------------

# 10. NEGATIVE SUPPLIER BALANCE

Если payout выполнен, а позже refund/chargeback:

``` text
Negative Supplier Balance / Supplier Receivable / Future Payout Offset
```

Исторический payout нельзя переписывать/удалять.

------------------------------------------------------------------------

# 11. SETTLEMENT ≠ PAYOUT

``` text
Settlement  → сколько экономически причитается
Release     → сколько разрешено к выплате
Payout      → фактическое перечисление / payment instruction
```

------------------------------------------------------------------------

# 12. TRUST & TRANSPARENCY CONTRACT

**No hidden balances:** Supplier обязан видеть breakdown:

``` text
Начислено / Доступно к выплате / Ожидает условий / В резерве
В обработке / Выплачено / Корректировки / Итоговый баланс
```

**No unexplained holds:** Каждая удерживаемая сумма отвечает:

``` text
Почему удерживается? Policy/version? Booking/order?
Условие release? Когда release?
```

**Traceability:** Каждая supplier-facing сумма traceable до Booking/Order/Payment/Commission/Settlement/Reserve/Adjustment/Payout.

**Every deduction has reason:** type, reason, source, date, policy/contract basis.

**Policy version visible:** Settlement Policy v3, Partner Agreement v5, Effective snapshot at booking.

**Historical immutability:** Новая settlement policy не rewrite старую booking.

**Independent reconciliation:** Opening → accruals → commission → adjustments → payouts → closing.

------------------------------------------------------------------------

# 13. SUPPLIER VISIBLE LEDGER

``` text
date/time / booking/order / event type
customer-payment fact / supplier accrual / commission
reserve / release / adjustment / payout / running balance
```

------------------------------------------------------------------------

# 14. SUPPLIER BALANCE

``` text
Начислено / Доступно к выплате / Ожидает условий
В резерве / В обработке / Выплачено / Корректировки / Итоговый баланс
```

------------------------------------------------------------------------

# 15. SETTLEMENT STATEMENT

``` text
opening balance / supplier accruals / commissions
reserves added/released / refund/chargeback adjustments
other adjustments / payouts initiated/completed
closing balance
```

------------------------------------------------------------------------

# 16. PAYOUT FORECAST

``` text
Доступно сейчас / Ожидается 7 дней / 8–30 дней / Зависит от условий
```

Unknown dates: показывать условие, а не false precise date.

------------------------------------------------------------------------

# 17. PLATFORM KPI — POINT-IN-TIME

| KPI | Type | Meaning | Reconciliation |
|---|---|---|---|
| Outstanding Supplier Balance | PIT | Supplier liability at moment | = Available + Awaiting + Reserve + Processing |
| Available for Payout | PIT | Release conditions satisfied | Reconciled |
| Awaiting Release | PIT | Entitlement exists, conditions pending | Reconciled |
| Reserve / Holdback | PIT | Retained under policy | Reconciled |
| Payout Processing | PIT | Initiated, not confirmed | Reconciled |

# 18. PLATFORM KPI — FLOW

| KPI | Type | Meaning |
|---|---|---|
| Accrued to Suppliers | Flow | Entitlement accrued during period |
| Paid to Suppliers | Flow | Successful payouts during period |
| Upcoming Payouts | Forward | Expected within horizon |
| Overdue Payouts | PIT/Aging | Payout due, not completed |

------------------------------------------------------------------------

# 19. PAYOUT AGING

``` text
Today / 1–3 days / 4–7 days / 8–30 days / >30 days / Overdue
```

------------------------------------------------------------------------

# 20. PLATFORM LIQUIDITY VISIBILITY

``` text
Supplier liabilities / Payable / Awaiting release / Reserve
Payout processing / Required upcoming / Overdue
```

Operational liquidity planning, НЕ free cash.

------------------------------------------------------------------------

# 21. PSP / LEGAL CUSTODY BOUNDARY

``` text
Funds are held/controlled by the canonical payment authority
(TravelHub and/or PSP according to the implemented payment architecture)
until settlement release conditions are satisfied.
```

------------------------------------------------------------------------

# 22. SHARED SOURCE OF TRUTH

Canonical: Settlement / Payout / Financial Ledger authority

Consumers: Partner Finance, Platform Command Center, Platform Finance, CRM summary, Statements, Decision Signals

CRM = consumer, NOT authority. Frontend НЕ пересчитывает canonical balance.

------------------------------------------------------------------------

# 23. FUTURE DECISION SIGNAL CANDIDATES

``` text
Supplier payout overdue / Reserve unusually high / Payout failure
Negative supplier balance / Settlement reconciliation mismatch
Upcoming payout liquidity concentration
```

------------------------------------------------------------------------

# 24. FUTURE PARTNER FINANCE BLOCKS

``` text
Balance / Upcoming payouts / Payout history / Settlement ledger
Settlement statements / Adjustments / Reserve / Booking/order drill-down
```

------------------------------------------------------------------------

# 25. INVARANTS SUMMARY

``` text
1.  Customer Payment ≠ Supplier Settlement ≠ Payout
2.  Two immutable snapshots per booking
3.  Settlement policy versioned
4.  Customer installments do NOT automatically define supplier payouts
5.  Every hold has reason + release condition
6.  Every deduction has reason
7.  Historical snapshots immutable
8.  Supplier can independently reconcile
9.  Platform and Supplier use same canonical authority
10. CRM is consumer, not authority
11. No hidden balances
12. No unexplained holds
13. Ledger is append-only/balance is projection
14. Multi-currency: native currency + canonical FX conversion
15. PSP boundary documented
```

------------------------------------------------------------------------

# 26. RELATION TO EXISTING DOMAINS

``` text
Finance: Payment, Refund, Settlement, Payout, Commission, Ledger (EXISTS)
Booking: booking snapshot (F.5 exists in roadmap)
Order: order snapshot (EXISTS)
Catalog: service terms (1.8A–1.8D EXISTS)
CRM: read-only consumer (Step 3.5 EXISTS)
Partner workspace: future finance UI (NOT STARTED)
Platform Command Center: future KPI cards (NOT STARTED)
```

------------------------------------------------------------------------

# 27. DEFERRED DESIGN DECISIONS

| Decision | Why deferred | Must be decided before |
|---|---|---|
| Exact settlement policy dimensions | Business authority | S.1 implementation |
| Default release conditions per category | Business + risk | S.5 implementation |
| Reserve/holdback default rules | Risk authority | S.6 implementation |
| Payout cadence options | Business + PSP | S.10 implementation |
| Negative balance resolution rules | Finance authority | S.11 implementation |
| Settlement statement format | Implementation stage | S.12 implementation |
| Multi-currency FX authority | PSP + Finance | S.8 implementation |
| Payout aging thresholds | Business decision | S.16 implementation |
