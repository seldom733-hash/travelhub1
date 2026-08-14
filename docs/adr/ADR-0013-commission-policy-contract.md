# ADR-0013: Commission Policy Contract (Phase 2 — unblocks 2.14E / 2.12E / 2.12C / 2.14)

- **Status:** Accepted (architecture decision pass, 2026-08-14; repository-first, 0 production code)
- **Date:** 2026-08-14
- **Related:** ADR-0006 (Storefront Commercial Model / Entitlement), ADR-0001 (modular monolith, cross-schema rules), ADR-0010 (business event envelope), Commission Dependency Reconciliation (2.12C/2.12E/2.14E), Step 2.14 BLOCKED record, Finance Temporal Contract (2.10C), Pricing & Financial Snapshot (2.11), Payment Flow (2.12), Refund Flow (2.13), Chargeback/Dispute Foundation (2.13A)

## Context

Step 2.14 (Invoice / Commission Flow) заблокирован stop-condition #4: Commission
formula/rate/base/source authority отсутствует. Reconciliation (2.12C/2.12E/2.14E)
доказал: policy authority = **C. NO AUTHORITY** (ADR-0006: «Никаких fee %, plan
prices, … commission engine»; 0 rate/policy-моделей; 0 ставок в legacy; 0 commission
в frozen snapshot), а семантика комиссии распределена по 2.12C / 2.12E / 2.14E,
все NOT STARTED. Данный ADR фиксирует **структуру, владение, семантику, lifecycle
boundaries и инварианты** Commission Policy Contract — НЕ коммерческие проценты.

Проверенные факты репозитория (не предполагаемые):
- `Commission` (CMS-*) / `CommissionAccrual` (CAA-*) — schema-only, 0 writer-ов, 0 rate/расчётных полей;
- ADR-0006: Marketplace = commission model; Storefront = SaaS subscription (entitlement NONE/ACTIVE/SUSPENDED/EXPIRED); billing/PSP/commission engine НЕ реализованы;
- Frozen commercial snapshot (Quote ISSUE → Checkout → Sale → Order, 2.11): `subtotal/discount/total/currency`, **без tax**; «commission policy» декларирован как часть immutable snapshot (deferred);
- Freeze boundary канон: Quote ISSUE (2.11), downstream копирует verbatim;
- money contract: `sales.money.ts`/`finance.money.ts` — Decimal, ROUND_HALF_UP, MONEY_SCALE=2, DECIMAL(12,2); rate ≠ amount (ExchangeRate — DECIMAL(18,6) прецедент);
- канал: `AcquisitionSource` (MARKETPLACE — reserved 1.13B; PARTNER_STOREFRONT; DIRECT), `SalesAcquisitionSource` (+BUYER_REQUEST); Custom Domain/API — «позднее» (Roadmap 2.5B, НЕ добавляются);
- seller-измерение: `Product.partnerId` (Catalog, mutable) — **не frozen** на Order/OrderItem;
- `finance.commission.read/write` существуют; `finance.commission.manage` — нет;
- Refund (2.13) / Dispute (2.13A): 0 commission side-effects; «never rewrite historical facts» (2.10A append-only).

## Terminology

- **Commission Policy** — mutable конфигурация (master data): какая ставка/форма применяется к каналу.
- **Commission** (CMS-*) — TravelHub platform revenue/share **факт** (frozen результат расчёта + collection-статус).
- **CommissionAccrual** (CAA-*) — receivable: долг Partner перед TravelHub (PARTNER_COLLECT).
- **ProviderFee** (PFE-*) — внешняя PSP/bank стоимость (отдельный факт, 2.10B).
- **Settlement / Payout / Invoice** — отдельные концепты (см. §Boundaries).

---

## D1 — POLICY OWNER (Decision 1)

**Decision:** **Option D — dedicated Finance-owned policy model** (`CommissionPolicy` в
`finance.*`), read by Sales/Order at freeze time (read-only cross-domain, как PaymentTerms 2.3B).

**Evidence:** Commission — Finance fact (Finance Domain Foundation: Finance — единственный
владелец finance master-data: Currency/ExchangeRate/Tax — `finance.*`); cross-schema **writes**
запрещены (ADR-0001) — Sales не может писать Finance policy; rate зависит от channel
(1.12.1A/2.14E), но channel-дименсия ≠ Catalog Tariff (цена продукта); ADR-0006: «Billing
позже становится authoritative, Catalog entitlement — projection» — Catalog НЕ владеет fee-полями.

**Alternatives rejected:** A (Finance owns but policy на фактах — смешивает config и fact);
B (Catalog-owned — Tariff = цена, не fee %; Catalog не владеет платформенной комиссией);
C (Sales-owned — Sales не пишет Finance, и policy живая, не frozen terms).

**Consequences:** policy живёт в `finance.*`; Sales/Order читают policy ТОЛЬКО при freeze
(selection boundary) и копируют frozen snapshot verbatim; позже Billing (будущий домен)
может стать authoritative (projection-паттерн ADR-0006) без ломки контракта.

**Extension point:** Billing-owned policy в будущем = additive projection; контракт полей не меняется.

---

## D2 — POLICY DIMENSIONS (Decision 2)

| Dimension | V1 status | Обоснование (evidence) |
|---|---|---|
| Channel / acquisition | **V1 REQUIRED** | 2.14E body: «Разные commission policies для Marketplace, Storefront, Custom Domain, API/Manual»; ADR-0006: Marketplace = commission; Shopfront = SaaS (отдельный механизм) |
| Partner / seller | **DEFERRED** (как rate-selector; атрибуция — обязательна, D14) | `Commission.partnerId`/`Product.partnerId` существуют, но partner-специфичные ставки не контрактованы; multi-seller freeze отсутствует; additive later |
| Product / service | DEFERRED | 0 evidence; additive |
| Category | DEFERRED | 0 evidence |
| Geography | DEFERRED | 0 evidence |
| Currency | DEFERRED (V1: единая валюта транзакции, D23) | FX-контракта нет |
| Payment method / PSP | **FORBIDDEN AS POLICY DIMENSION** | PSP не владеет business policy (hard gate 2.12C; invariant 12) |
| Customer segment | DEFERRED | 0 evidence |
| Effective date | **V1 REQUIRED** (effectiveFrom) | D16 |
| Priority / fallback | **V1 N/A** (единственная дименсия) | D17; добавление дименсий позже потребует precedence-контракт |

V1 matching key = **channel** только. Partner-дименсия — атрибуция факта (не rate-selector).

---

## D3 — RATE TYPES (Decision 3)

**Decision:** V1 = **PERCENTAGE of base** (единственная форма). FIXED, hybrid, tiered,
min/max caps — **DEFERRED** (additive).

**Evidence:** 0 evidence fixed-форм в репозитории (нет fee-контрактов); Marketplace
commission = «transaction/platform commission» (1.12.1A) — процентная форма естественна;
«do not over-model» + additive-first (§29). Расширение `CommissionRateType` enum —
аддитивно и безопасно на пустых таблицах.

**Consequences:** `CommissionPolicy.rateType` enum c единственным значением PERCENTAGE
(поле есть — расширение не ломает схему); `rate` хранится как Decimal-процент
(0.15 = 15%), точность rate — по прецеденту ExchangeRate `DECIMAL(18,6)` (rate ≠ amount).

---

## D4 — CALCULATION BASE (Decision 4)

**Decision:** V1 base = **frozen discounted Order total** (`Order.total` = subtotal −
discountAmount, verbatim из Quote ISSUE снапшота), **tax-exclusive by construction**
(в снапшоте нет tax-фактов, 2.11 deferred), **до refund** (refund не меняет исходную базу;
коррекция — отдельный компенсирующий факт, D11). Commission — **order-level** (V1),
не item-level.

- discount: **включён** (base = уже дисконтированный total);
- tax: **не входит** (в снапшоте отсутствует; когда появится tax-движок — tax-трактовка
  станет отдельным решением, D23/Tax boundary);
- refunds/disputes: **не меняют base** (immutable; adjustment — D11/D12);
- level: **order-level** (модель Commission order-scoped: `orderId`, нет orderItemId);
- multi-seller: требует frozen seller attribution (D14); multi-seller order → **fail-closed**:
  0 commission-фактов (документировано) до line-level allocation (deferred).

**Evidence:** все frozen снапшоты (Quote/CheckoutIntent/Sale/Order) содержат
`total = subtotal − discountAmount`, `currency`; Payment.amount = Order.total verbatim (2.12);
tax в снапшоте отсутствует (2.11: «tax/FX/commission части — deferred»).

**Live Catalog lookup для seller/rate — ЗАПРЕЩЁН** (invariant 5/3).

---

## D5 — ROUNDING (Decision 5)

**Decision:** Decimal authority (`sales.money.ts`/`finance.money.ts`); **ROUND_HALF_UP**;
scale **2** (MONEY_SCALE, DECIMAL(12,2)); расчёт на **order-level** base → округление
**один раз на агрегат** (не per-line); future per-line commission — округление per-line,
сумма округлённых строк (аддитивно).

**Evidence:** money contract 2.11/2.10B: `toMoney2`, `ROUND_HALF_UP`, MONEY_SCALE=2.
Никаких JS float (invariant 4).

---

## D6/D10 — POLICY SELECTION & FREEZE BOUNDARY (Decision 6)

Раздельно:

1. **Selection** — **Quote ISSUE** (server-side): channel = acquisitionSource Quote
   (Step 2.2F: server-derived из Opportunity; клиент НЕ передаёт); policy подбирается
   детерминированно по channel (D2/D17);
2. **Freeze** — **Quote ISSUE**: frozen commission snapshot (policyCode/version/rateType/
   rate/base-amount/currency/channel/seller) замораживается вместе с остальным
   commercial snapshot (2.11) и копируется verbatim Checkout → Sale → Order;
3. **Recognition** — отдельно: SPLIT_AT_PAYMENT — Payment CAPTURED; PARTNER_COLLECT —
   Order creation (D10).

**Evidence:** 2.11: «Immutable snapshot: base price, taxes, discounts, **commission
policy**, currency/exchange rate, PaymentTerms»; freeze boundary канон = Quote ISSUE,
downstream verbatim. Позднее изменение policy НЕ влияет на замороженные сделки
(invariant 3).

---

## D7 — FROZEN COMMISSION SNAPSHOT (Decision 7)

Минимальный immutable snapshot (достаточен для воспроизведения без lookup текущей policy):

- `policyCode` / `policyVersion` (ref на CommissionPolicy);
- `rateType` + `rate` (frozen значение ставки);
- `baseAmount` (frozen Order total) + `baseCurrency`;
- `channel` (frozen);
- `sellerPartnerId` (frozen атрибуция, D14);
- `selectedAt` (UTC, = Quote ISSUE время);
- `roundingContractVersion` (v1: ROUND_HALF_UP/scale 2).

**Где живёт (design):** аддитивный `commissionSnapshot Json?` на frozen commercial
снапшотах (Quote ISSUE → CheckoutIntent → Sale → Order), копируется verbatim
(прецедент — `QuoteItem.restrictionSnapshot Json`); НЕ копировать mutable policy body
(только ref + значения-пруфы). NULL = нет commission-контекста (DIRECT/BUYER_REQUEST/
legacy) — честно, без backfill.

---

## D8/D12 — COLLECTION MODEL (Decision 8)

- **SPLIT_AT_PAYMENT** (2.12C): TravelHub share собирается через PSP native split
  (Buyer → PSP → Partner share + TravelHub fee). PSP получает **предвычисленный frozen
  commission amount** — PSP НЕ вычисляет и НЕ владеет policy (invariant 12);
- **PARTNER_COLLECT** (2.12E): Partner собирает деньги покупателя; TravelHub получает
  receivable = `CommissionAccrual`.

**Оба используют ОДНУ и ту же policy/rate/base** (invariant 11); отличается только
collection mechanism. Commission-факт существует **до** collection (policy frozen на
ISSUE; факт признаётся на trigger D10). Commission (CMS-*) — канонический earned-факт
для обеих моделей; CommissionAccrual — receivable-представление ТОЛЬКО для
PARTNER_COLLECT (D9). PSP не решает business policy.

---

## D9/D13 — COMMISSION FACT vs COMMISSION ACCRUAL (Decision 9)

- **Commission (CMS-*)** — одна строка = **TravelHub earned commission факт** для сделки
  (frozen policy-результат): `orderId`, `partnerId` (seller атрибуция), `amount`,
  `currency`, `collectionModel` (SPLIT_AT_PAYMENT/PARTNER_COLLECT — аддитивное поле),
  `status` (ACCRUED/INVOICED/PAID), policy provenance refs (frozen snapshot).
- **CommissionAccrual (CAA-*)** — одна строка = **receivable Partner → TravelHub**
  (только PARTNER_COLLECT): `partnerId`, `amount`, `currency`, `periodStart/End`,
  `status` (ACCRUED/INVOICED/COLLECTED), `sourceCommissionId` (аддитивная ссылка на
  Commission-факт).

**Не две таблицы одной финансовой правды:** Commission — единственная правда
(earned fact); CommissionAccrual — collection-режимная проекция-обязательство.
Без PARTNER_COLLECT — 0 CommissionAccrual.

---

## D10 — RECOGNITION TRIGGERS (Decision 10)

- **SPLIT_AT_PAYMENT:** policy frozen (ISSUE) → **Commission факт признаётся на
  Payment CAPTURED** (деньги получены; сумма = rate × frozen base); PSP split позже
  исполняет collection. Payment FAILED/CANCELLED → 0 commission-фактов.
- **PARTNER_COLLECT:** policy frozen (ISSUE) → **CommissionAccrual признаётся на
  Order creation** (сделка завершена; Partner собрал деньги вне platform rail);
  источник — frozen snapshot verbatim (без re-lookup).

**Evidence:** Payment 2.12 single-active CAPTURED — единственный money-событие;
Order creation — каноническое завершение сделки (Sale completion → OrderRequested).
2.10C: `accruedAt` deferred (2.12C/E) — этот ADR определяет trigger; сама колонка
добавляется в реализующих шагах.

---

## D11 — REFUND ADJUSTMENT STRATEGY (Decision 11)

**Decision:** **Immutable original + компенсирующий adjustment-факт** (append-only;
прецедент 2.10A «never rewrite history»). Процессированный Refund (2.13) → отдельный
`CommissionAdjustment` (deferred-модель): **пропорциональная** сумма =
`frozen rate × refunded amount` (линейная, использует frozen rate — НЕ пересчёт
истории). Full refund → полный reversal; partial → пропорциональный.

- Оригинальный Commission/CommissionAccrual **никогда не мутируется** (invariant 10);
- Владелец реализации: **2.12E / resume 2.14** (отдельный шаг, НЕ сейчас);
- «Recalculated» (пересчёт на новом net-base) — rejected: меняет историю.

---

## D12 — DISPUTE / CHARGEBACK ADJUSTMENT STRATEGY (Decision 12)

**Decision: `DEFER UNTIL LIABILITY OUTCOME`.** OPENED Dispute НЕ меняет Commission
немедленно: current Dispute foundation не имеет won/lost liability-исхода (2.13A
deferred), chargeback = PSP-specific (2.13A+). Hold/adjustment на открытом dispute —
спекулятивно → запрещено (invariant: «original facts not rewritten»). Решение —
только после появления liability-семантики (2.13A+ real-PSP).

---

## D13 — INVOICE CONCEPT SET (Decision 13)

**Decision:** ДВА концепта, НЕ сливаются:

1. **Buyer transaction invoice/receipt** — issuer Finance, recipient Buyer (`customerId`),
   source = frozen Order/Payment факты, amount authority = frozen Order.total,
   trigger = 2.14; **0 commission-зависимости** (доказано Reconciliation §21);
2. **Partner commission invoice** — issuer Finance, recipient Partner (`partnerId`),
   source = Commission/CommissionAccrual факты, amount authority = commission amounts,
   trigger = invoicing (2.12E «settlement/invoice/collection»); требует аддитивную
   partner-дименсию (Invoice.partnerId или отдельная модель — деталь 2.14/2.12E).

Step 2.14 владеет buyer-инвойсом; partner-commission invoice — совместно 2.12E/2.14.
Мержить нельзя: разные обязательства (buyer обязан платить за услугу; partner обязан
комиссию TravelHub).

---

## D14 — MULTI-SELLER / PARTNER SNAPSHOT (Decision 14)

**Decision:** V1 Commission **требует frozen seller attribution**:
- аддитивный `Order.sellerPartnerId` (order-level), **server-frozen при Order creation**
  (из OrderItem products' `Product.partnerId` НА МОМЕНТ создания — snapshot-at-event,
  НЕ live lookup позже);
- **one selling partner per Order** — инвариант для commission-фактов;
  multi-partner order → `sellerPartnerId = NULL` → **0 commission-фактов** (fail-closed,
  документировано) до line-level allocation (deferred, 2.14E evolution/2.12F-adjacent);
- per-OrderItem seller freeze — deferred (line-level commission).

**Evidence:** Order/OrderItem не несут partnerId; `Product.partnerId` — единственный
источник (Catalog); live lookup после freeze запрещён (invariant 5).

---

## D15 — CHANNEL AUTHORITY (Decision 15)

**Decision:** **отдельный vocabulary `CommissionChannel`** (НЕ переиспользовать
`AcquisitionSource` как есть — семантика разная: acquisition = происхождение lead,
commission-channel = коммерческий контекст комиссии):

- `MARKETPLACE` — V1 активный (единственный channel с commission-механизмом);
- `PARTNER_STOREFRONT` — **no commission** (SaaS subscription, ADR-0006);
- `DIRECT` / `BUYER_REQUEST` — **no commission** (platform-internal / reverse);
- `CUSTOM_DOMAIN` / `API` — deferred (Roadmap 2.5B: «позднее», НЕ добавляются).

Mapping (freeze-time, server-side): `Order.acquisitionSource → CommissionChannel`
(MARKETPLACE→MARKETPLACE; остальные → NULL = no commission). Policy engine — channel-
дименсионный (rule.channel), но V1 политики создаются только для MARKETPLACE.

---

## D16 — EFFECTIVE-DATE / VERSIONING (Decision 16)

`CommissionPolicy`: `effectiveFrom` (обязателен, UTC), `effectiveTo` (nullable),
`version` (инкремент на каждое изменение), `status` (DRAFT/ACTIVE/ARCHIVED),
`createdAt/updatedAt` + `CommissionPolicyHistory` (audit-by-default конвенция).
Правила:
- активная политика на (channel, момент времени) — **максимум одна** (partial unique
  по effective-интервалу; fail-closed при перекрытии — операционная ошибка);
- `createdAt` **НЕ** является precedence (invariant 6);
- изменение policy = НОВАЯ версия (или новая запись с новым effectiveFrom) — история
  неизменна; замороженные сделки ссылаются на policyCode+version.

---

## D17 — POLICY PRECEDENCE (Decision 17)

**Decision:** V1 matching key = **channel ТОЛЬКО** (D2) → precedence тривиален:
`channel-rule → (нет fallback-слоя в V1)`. Same-tier конфликт (2 активные rule на один
channel+момент) → **fail-closed**: 0 commission, операционная ошибка (не «угадывать»).
Partner-specific override / platform default — **DEFERRED** (появится вместе с
partner-дименсией; тогда precedence-контракт: partner+channel → channel → default —
как explicit amendment).

---

## D18 — RBAC / POLICY MANAGEMENT (Decision 18)

- **Policy CRUD** (`CommissionPolicy`): НОВОЕ право `finance.commission.manage` —
  FINANCE/ADMIN (по конвенции finance.*.manage: Currency/ExchangeRate/Tax);
- **Policy read**: `finance.commission.read` — фактические держатели права в
  ROLE_PERMISSIONS: FINANCE / DIRECTOR / ANALYST (SALES_MANAGER НЕ имеет
  finance.commission.read — фактический реестр, подтверждено при 2.14E
  имплементации; read-набор эволюционирует вместе с правом);
- **Commission факты**: существующие `finance.commission.read` + `finance.commission.write`
  (FINANCE/ADMIN);
- **CommissionAccrual**: те же права (часть finance.commission.*);
- **OPERATOR / PARTNER: НЕ имеют** policy management и fact write. Partner-заявления
  (own commission statements) — future read-surface (НЕ policy management; отдельное
  право/граница позже).

**Evidence:** actual ROLE_PERMISSIONS (finance.commission.read — DIRECTOR/FINANCE/
ANALYST; write — FINANCE; manage — добавлено в 2.14E по прецеденту
finance.currency.manage; ADMIN — ALL_PERMISSIONS).

---

## D19 — EVENT CONTRACT (Decision 19)

Факт-события (durable, outbox, ADR-0010, PII-free, refs+frozen money):

- **`CommissionAccrued`** — producer: Finance (recognition trigger D10); payload:
  orderId, commissionId, partnerId, channel, collectionModel, amount/currency,
  policyCode+version, baseAmount, correlation/causation; consumers (future):
  Ledger (2.12D), Settlement (2.14A), Invoice (2.14). **REQUIRED** (для двух collection
  моделей);
- **`CommissionAdjusted`** — producer: Finance (D11); **DEFERRED** (реализуется вместе
  с CommissionAdjustment);
- Policy-события (selected/frozen) — **НЕ создаются**: selection/freeze — часть
  существующей event-цепи commercial snapshot (QuoteIssued → OrderRequested);
  CommissionPolicy активация — master-data команда + AuditLog/History (конвенция
  Currency/ExchangeRate: 0 событий master-data).

Спекулятивные события с 0 consumer-ов не создаются.

---

## D20 — LEDGER BOUNDARY (Decision 20)

- Commission/CommissionAccrual creation **независимо** от Ledger posting
  (как Payment/Refund/Dispute — 0 ledger auto-post);
- будущий ledger posting (2.12D, PLATFORM_COLLECT) **потребляет `CommissionAccrued`** —
  consumer-паттерн;
- оригинальный Commission-факт — **НЕ** LedgerTransaction (invariant 9);
- двойная запись — вне этого ADR (Roadmap не требует сейчас).

---

## D21 — SETTLEMENT / PAYOUT BOUNDARY (Decision 21)

- **Commission** определяет platform entitlement (что заработал TravelHub);
- **Settlement** (2.14A) определяет reconciliation обязательств и **потребляет**
  Commission/CommissionAccrual как вход (Roadmap 2.14A: «Gross → ProviderFee →
  TravelHub Commission → Tax → Refund/Adjustments → Partner Payable»);
- **Payout** (2.14B) определяет перевод денег Partner (bank rail);
- Полная settlement-формула — вне этого ADR (2.14A).

---

## D22 — PROVIDER FEE BOUNDARY (Decision 22)

- ProviderFee = внешняя PSP/bank стоимость (immutable, 2.10B);
- **не меняет** Commission rate/base; V1 **НЕ** неттит ProviderFee в Commission
  (invariant 8);
- net-of-provider-fee pricing — будущая политика → DEFERRED (явный amendment при появлении).

---

## D23 — TAX / FX BOUNDARY (Decision 23)

- V1 base — **tax-exclusive by construction** (в frozen снапшоте tax-фактов нет);
  когда появится tax-движок — tax-inclusive/exclusive станет отдельным решением
  (влияет на base и требует amendment);
- **Commission currency = transaction currency** (frozen Order.currency) — инвариант;
- **FX conversion ЗАПРЕЩЁН** до canonical frozen FX-контракта (2.12A/2.14D);
  V1 — **same-currency only** (cross-currency commission → deferred).

---

## ADR INVARIANTS (§28)

1. **0 hardcoded rates** — ставки только в CommissionPolicy master-data;
2. **один canonical mutable policy authority** — `finance.CommissionPolicy` (D1);
3. **историческая Commission никогда не зависит от текущего policy lookup** (frozen snapshot D7);
4. **0 JS float money authority** (Decimal, D5);
5. **frozen seller/partner/channel attribution** (D7/D14/D15);
6. **policy selection детерминирован** (D6/D17; createdAt не precedence);
7. **ambiguous policy resolution → fail-closed** (D16/D17);
8. **Commission ≠ ProviderFee** (D22);
9. **Commission ≠ Settlement/Payout** (D21/D20);
10. **оригинальные финансовые факты не переписываются** для Refund/Dispute-коррекций (D11/D12);
11. **SPLIT_AT_PAYMENT и PARTNER_COLLECT разделяют business policy** (D8);
12. **PSP не владеет commission business rules** (D8/D2);
13. **cross-domain writes запрещены** (D1: Finance пишет policy; Sales/Order читают и фризят);
14. **все будущие изменения — additive-first** (D2/D3/D11/D14).

---

## TARGET DATA MODEL (§29) — DESIGN ONLY, schema НЕ меняется

| Модель/поле | Статус |
|---|---|
| `CommissionPolicy` (finance): id, code, status(DRAFT/ACTIVE/ARCHIVED), version, channel, rateType, rate DECIMAL(18,6), currency?, effectiveFrom, effectiveTo?, createdAt/updatedAt | REQUIRED (2.14E) |
| `CommissionPolicyHistory` (audit) | REQUIRED (2.14E) |
| `CommissionChannel` enum: MARKETPLACE (+ будущие) | REQUIRED (2.14E) |
| `CommissionRateType` enum: PERCENTAGE | REQUIRED (2.14E; расширение аддитивно) |
| Frozen snapshot `commissionSnapshot Json?` (Quote ISSUE → Checkout → Sale → Order, verbatim): policyCode/version, rateType, rate, baseAmount, baseCurrency, channel, sellerPartnerId, selectedAt, roundingContractVersion | REQUIRED (freeze-шаг после 2.14E) |
| `Order.sellerPartnerId String?` (frozen атрибуция) | REQUIRED (freeze-шаг) |
| `Commission.collectionModel` (SPLIT_AT_PAYMENT/PARTNER_COLLECT) | REQUIRED (2.12C/2.12E) |
| `CommissionAccrual.sourceCommissionId` | OPTIONAL V1 (2.12E) |
| `CommissionAdjustment` (immutable компенсирующий факт) | DEFERRED (2.12E/2.14+) |
| `Invoice.partnerId` (или отдельная partner-invoice модель) | DEFERRED (2.12E/2.14) |

Не over-model: 0 лишних моделей (tiering/caps/balances/recognition — deferred).

---

## MIGRATION / COMPATIBILITY (§30) — DESIGN ONLY

- аддитивные nullable-first колонки (commissionSnapshot, sellerPartnerId, collectionModel);
- **0 fabricated backfill** — legacy Orders/Quotes без snapshot остаются валидными
  (NULL = no commission context);
- **0 live-lookup backfill** (никакой реконструкции seller/rate из текущего Catalog);
- foundation-таблицы Commission/CommissionAccrual (пустые) эволюционируют аддитивно
  (колонки + unique-индексы на пустых таблицах — безопасно);
- новые факты используют новый контракт; старые факты — без изменений.

---

## EXECUTION ORDER (§31)

`ADR-0013 (этот) → 2.14E (CommissionPolicy foundation: модель+RBAC finance.commission.manage+read API, strict review) → freeze-шаг (frozen commissionSnapshot + Order.sellerPartnerId в коммерческом pipeline, strict review) → 2.12E (PARTNER_COLLECT CommissionAccrual + CommissionAccrued, strict review) → 2.12A/2.12B (PSP, отдельные шаги) → 2.12C (SPLIT_AT_PAYMENT, native split; Commission.collectionModel) → resume 2.14 (buyer Invoice + commission-факты/события) → 2.14A → 2.14B → 2.14D`.

Нумерация НЕ определяет порядок (прецедент Dependency Analysis): policy-фундамент
(2.14E) и freeze-шаг предшествуют fact-производителям (2.12E/2.12C); 2.12C требует
2.12A/2.12B.
