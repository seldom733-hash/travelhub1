# PHASE 2 — COMMISSION POLICY CONTRACT — ARCHITECTURE DECISION REPORT

## 1. VERDICT

`PHASE 2 COMMISSION POLICY CONTRACT — ARCHITECTURE DECISION COMPLETED`

Все **структурные** решения Commission Policy Contract разрешены из фактической
архитектуры (ADR-0013). Коммерческие значения (проценты/ставки) — НЕ предмет этого
прохода (master data, никогда константы). Отложенные business-опции (fixed-форма,
partner-специфичные ставки, tax-inclusive база) — аддитивны и не блокируют V1.

0 production-кода / схемы / миграций / ставок. 2.14E / 2.12C / 2.12E НЕ реализованы.
2.14 остаётся BLOCKED.

---

## 2. REPOSITORY BASELINE

- master @ `3ba2e70` (коммит 2.13+2.13A+reconciliation); worktree clean;
- migrations 54/54; 2.14 BLOCKED; 2.12C/2.12E/2.14E NOT STARTED;
- ADR нумерация: ADR-0001…ADR-0012 → создан **ADR-0013**.

## 3. SOURCES INSPECTED

Roadmap v3 (1.12.1A, 2.10–2.14E, execution sequence); ADR-0006, ADR-0001, ADR-0010;
арх-доки 2.10–2.13A (включая finance-temporal-contract 2.10C); Reconciliation report;
blocked-2.14 record; schema.prisma (Commission/CommissionAccrual/Invoice/Quote/
CheckoutIntent/Sale/Order/OrderItem/Payment/Product/Partner); permissions.constants.ts;
sales.money.ts (ROUND_HALF_UP/MONEY_SCALE); api.md/events.md/ids.md; Screen Design 1.6;
legacy (0 ставок).

## 4. EXISTING FACTS PRESERVED

Все §3-факты промпта подтверждены репозиторием и сохранены: ProviderFee = внешняя
стоимость; Commission = platform revenue; CommissionAccrual = receivable (PARTNER_COLLECT);
Storefront = SaaS; Payment/Settlement/Payout/Invoice ≠ Commission; 0 commission в frozen
snapshot; 0 commission в Payment/Refund/Dispute flow; «never rewrite history»; 0 hardcoded
rates; 2.12C требует 2.12A/2.12B; 2.14E владеет policy-слоем (подтверждено ADR-0013 D1).

## 5. POLICY OWNER — D1

**Finance-owned dedicated model** (`finance.CommissionPolicy`). Sales/Order читают
policy только при freeze (Quote ISSUE) и копируют frozen snapshot verbatim.
Rejected: Finance-on-facts (config/fact смешение), Catalog (Tariff ≠ fee %),
Sales (не пишет Finance). Evidence: Finance — владелец finance.* master-data;
ADR-0001 cross-schema writes; ADR-0006 Catalog = entitlement projection.

## 6. POLICY DIMENSIONS — D2

**V1 REQUIRED: channel** (единственный matching key). **DEFERRED:** partner (rate-selector;
атрибуция обязательна), product/category/geography/currency/customer-segment. **FORBIDDEN:
payment method/PSP.** V1 precedence тривиален (одна дименсия) — partner-дименсия
появится аддитивно с явным precedence-контрактом (D17).

## 7. RATE TYPES — D3

**V1: PERCENTAGE only.** FIXED/hybrid/tiered/min-max — DEFERRED (additive; 0 evidence в
репозитории; «do not over-model»). rate — Decimal(18,6) прецедент ExchangeRate (rate ≠ amount).

## 8. CALCULATION BASE — D4

**V1: frozen discounted Order.total** (subtotal − discountAmount, verbatim), tax-exclusive
by construction (в снапшоте tax нет), до refund; **order-level**; multi-seller → fail-closed
(0 фактов) до line-level allocation. Live Catalog lookup — запрещён.

## 9. ROUNDING — D5

Decimal authority; **ROUND_HALF_UP**; scale 2 (DECIMAL(12,2)); округление один раз на
агрегат (order-level). 0 JS float.

## 10. POLICY SELECTION BOUNDARY — D6

**Quote ISSUE** (server-side; channel = acquisitionSource Quote, Step 2.2F; клиент не передаёт).

## 11. FREEZE BOUNDARY — D6/D7

**Quote ISSUE** — frozen commission snapshot замораживается с остальным commercial
snapshot (2.11) и копируется verbatim Checkout → Sale → Order. Поздняя смена policy не
влияет на замороженные сделки.

## 12. FROZEN SNAPSHOT CONTRACT — D7

`commissionSnapshot Json?` (policyCode/version, rateType, rate, baseAmount, baseCurrency,
channel, sellerPartnerId, selectedAt, roundingContractVersion) — nullable, verbatim,
без копии mutable policy body; прецедент `QuoteItem.restrictionSnapshot`.

## 13. COLLECTION MODEL — D8

Одна policy/rate/base для обеих моделей (invariant 11); различие — только механизм:
SPLIT (PSP native split, предвычисленный frozen amount; PSP НЕ владеет policy) /
PARTNER_COLLECT (CommissionAccrual receivable). Commission-факт существует до collection.

## 14. COMMISSION vs ACCRUAL — D9

Commission = канонический earned-факт (обе модели); CommissionAccrual = receivable-
представление только PARTNER_COLLECT (sourceCommissionId). Не две правды.

## 15. RECOGNITION TRIGGERS — D10

SPLIT: **Payment CAPTURED** (FAILED/CANCELLED → 0 фактов). PARTNER_COLLECT: **Order creation**
(сделка завершена). Оба из frozen snapshot (без re-lookup).

## 16. REFUND ADJUSTMENT — D11

Immutable original + **компенсирующий CommissionAdjustment** (пропорциональный:
frozen rate × refunded amount). Оригинал не мутируется. Владелец: 2.12E/resume 2.14.
Recalculated — rejected (меняет историю).

## 17. DISPUTE ADJUSTMENT — D12

**DEFER UNTIL LIABILITY OUTCOME.** OPENED Dispute не трогает Commission (нет won/lost;
chargeback PSP-specific 2.13A+). Hold/adjustment — спекулятивно, запрещено.

## 18. INVOICE CONCEPT SET — D13

**Два концепта:** (1) buyer transaction invoice (customerId; frozen Order/Payment;
0 commission-зависимости; Step 2.14); (2) partner commission invoice (partnerId;
source = Commission/CommissionAccrual; 2.12E/2.14). Не мержить — разные обязательства.

## 19. MULTI-SELLER / PARTNER SNAPSHOT — D14

V1 требует `Order.sellerPartnerId` (server-frozen при Order creation из Product.partnerId
на момент создания — snapshot-at-event); one seller per order инвариант; multi-partner →
NULL → 0 commission-фактов (fail-closed). Per-line seller — deferred.

## 20. CHANNEL AUTHORITY — D15

Отдельный `CommissionChannel`: **MARKETPLACE** (V1 активный); PARTNER_STOREFRONT —
no commission (SaaS); DIRECT/BUYER_REQUEST — no commission; CUSTOM_DOMAIN/API — deferred
(Roadmap 2.5B). Mapping из Order.acquisitionSource на freeze-time. AcquisitionSource не
переиспользуется как есть (семантика разная).

## 21. EFFECTIVE-DATE / VERSIONING — D16

effectiveFrom (обязателен), effectiveTo (nullable), version, status (DRAFT/ACTIVE/
ARCHIVED), PolicyHistory (audit). Одна активная policy на (channel, момент); перекрытие
→ fail-closed; createdAt НЕ precedence.

## 22. POLICY PRECEDENCE — D17

V1: channel-only → тривиально. Same-tier конфликт → fail-closed. Partner-override/default
— deferred (с явным precedence-аmendment при появлении дименсии).

## 23. RBAC — D18

Новое право `finance.commission.manage` (FINANCE/ADMIN) для policy CRUD; read —
FINANCE/DIRECTOR/ANALYST/SALES_MANAGER; факты — существующие finance.commission.read/write.
OPERATOR/PARTNER — нет (partner statements — будущая read-surface, не policy management).

## 24. EVENT CONTRACT — D19

`CommissionAccrued` (producer Finance; payload refs+frozen money+PII-free; consumers:
Ledger 2.12D / Settlement 2.14A / Invoice 2.14) — REQUIRED. `CommissionAdjusted` — DEFERRED.
Policy-событий нет (master data + AuditLog, конвенция Currency/ExchangeRate).

## 25. LEDGER BOUNDARY — D20

Commission creation независим от ledger; 2.12D потребляет CommissionAccrued (consumer);
Commission-факт ≠ LedgerTransaction; двойная запись вне ADR.

## 26. SETTLEMENT / PAYOUT BOUNDARY — D21

Commission = platform entitlement; Settlement (2.14A) потребляет Commission/Accrual как
вход; Payout (2.14B) = перевод Partner. Settlement-формула — 2.14A.

## 27. PROVIDER FEE BOUNDARY — D22

ProviderFee = внешняя стоимость; не меняет rate/base; V1 не неттит; net-of-provider-fee — deferred.

## 28. TAX / FX BOUNDARY — D23

V1 base tax-exclusive by construction (tax-фактов нет); Commission currency = transaction
currency; FX запрещён до canonical frozen FX-контракта; V1 same-currency only.

## 29. TARGET DATA MODEL — см. ADR-0013 §TARGET (design only)

CommissionPolicy (+History), CommissionChannel, CommissionRateType, frozen
commissionSnapshot Json, Order.sellerPartnerId, Commission.collectionModel,
CommissionAccrual.sourceCommissionId (OPTIONAL), CommissionAdjustment (DEFERRED),
Invoice.partnerId (DEFERRED). 0 лишних моделей.

## 30. MIGRATION / COMPATIBILITY PLAN

Аддитивные nullable-first колонки; 0 backfill; 0 live-lookup backfill; legacy-строки
валидны (NULL = no commission context); unique-индексы на пустых таблицах — безопасно.

## 31. ADR INVARIANTS

14 инвариантов §28 зафиксированы в ADR-0013 (0 hardcoded rates; один policy authority;
история не зависит от текущей policy; 0 JS float; frozen attribution; детерминизм;
fail-closed; Commission ≠ ProviderFee/Settlement/Payout; never rewrite; общая policy
для SPLIT/PARTNER_COLLECT; PSP не владеет rules; 0 cross-domain writes; additive-first).

## 32. HUMAN DECISIONS REQUIRED

**Минимум — 0 блокирующих.** V1-дефолты (percentage-only, channel-only, discounted-
tax-free base, Quote ISSUE freeze) следуют из архитектуры + additive-first. Необязательные
business-опции — deferred и аддитивны (не блокируют 2.14E):
- fixed-форма / hybrid / tiered — появятся как новые rateType (аддитивно);
- partner-специфичные ставки — появятся с partner-дименсией и multi-seller freeze;
- tax-inclusive база — отдельное решение при появлении tax-движка;
- partner commission invoice форма (Invoice.partnerId vs отдельная модель) — деталь 2.12E/2.14.
Проценты/ставки — всегда master data, никогда не спрашиваются у архитектора.

## 33. EXACT IMPLEMENTATION ORDER

`ADR-0013 (этот) → 2.14E (CommissionPolicy foundation + finance.commission.manage, strict review) → freeze-шаг (frozen commissionSnapshot + Order.sellerPartnerId в pipeline, strict review) → 2.12E (PARTNER_COLLECT CommissionAccrual + CommissionAccrued, strict review) → 2.12A/2.12B (PSP) → 2.12C (SPLIT_AT_PAYMENT + Commission.collectionModel) → resume 2.14 (buyer Invoice + commission-факты) → 2.14A → 2.14B → 2.14D`.

Нумерация ≠ порядок (Dependency Analysis прецедент): policy-фундамент и freeze-шаг
предшествуют fact-производителям.

## 34. ROADMAP CHANGES PROPOSED/APPLIED

- 2.14 остаётся BLOCKED ✅ (до реализации prerequisites);
- 2.14E/2.12C/2.12E НЕ маркированы реализованными ✅;
- **Applied (metadata only):** execution sequence Finance-блок — добавлен итог
  ADR-0013 (decided), зависимость «2.14E → freeze-шаг → 2.12E → 2.12A/2.12B → 2.12C →
  resume 2.14», NEXT = Step 2.14E (не начинать в этом проходе);
- APPROVED шаги 2.12/2.13/2.13A не тронуты (реальных несовместимостей нет).

## 35. ARCHITECTURE DECISION STATUS

**DECIDED** — ADR-0013 (Accepted). Структурные решения: 23/23 разрешены из архитектуры;
дефер-опции явно перечислены (additive). «REQUIRES PRODUCT/ARCHITECT APPROVAL» — нет
блокирующих пунктов.

## 36. EXACT NEXT ITEM

**STEP 2.14E — CHANNEL-BASED COMMISSION RULES (FOUNDATION)** — реализация
`finance.CommissionPolicy` (+History, CommissionChannel, CommissionRateType, validation,
RBAC finance.commission.manage, read API, unit/e2e, docs) — отдельным prompt-ом, НЕ в
этом проходе. Затем freeze-шаг → 2.12E → 2.12A/B → 2.12C → resume 2.14.

## 37. FINAL CANONICAL STATEMENT

`PHASE 2 COMMISSION POLICY CONTRACT — ARCHITECTURE DECISION COMPLETED`

- ADR-0013 принят (структура/владение/семантика/границы/инварианты Commission Policy
  Contract); ставки — master data;
- 0 production/схема/миграции/ставок; negative checks 12/12 PASS;
- 2.14 ⛔ BLOCKED; 2.14E/2.12C/2.12E ⏳ NOT STARTED;
- NEXT = Step 2.14E (Commission Policy foundation) — не начинается в этом проходе.
