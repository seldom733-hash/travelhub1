# PHASE 2 — COMMISSION DEPENDENCY RECONCILIATION — 2.12C / 2.12E / 2.14E — REPORT

## 1. VERDICT

`PHASE 2 COMMISSION DEPENDENCY RECONCILIATION COMPLETED — ARCHITECTURE DECISION REQUIRED`

Repository-first reconciliation **не решает** commission-архитектуру: канонический
policy authority отсутствует, а все структурные решения (dimensions, base, rate type,
freeze boundary, collection model, adjustment strategy) не определены ни в одном
approved-контракте. До их принятия никакой commission-код начинать нельзя.
Одновременно установлены **жёсткие prerequisite edges** и **доказуемая независимость
Invoice** (buyer-половина), что даёт частичный порядок.

0 production-кода / схемы / миграций / ставок в этом проходе. 2.12C/2.12E/2.14E
**не маркированы** реализованными. 2.14 остаётся BLOCKED.

---

## 2. REPOSITORY BASELINE

- Branch: `master`; commit: `3e89387` (docs: Phase 2 Step 2.12 STRICT REVIEW);
- Worktree: dirty — только артефакты 2.13/2.13A (реализация + ревью, uncommitted)
  и Roadmap BLOCKED-маркер 2.14 (предыдущий проход);
- Latest applied migration: `20260814170000_add_chargeback_dispute_foundation` (54/54);
- Roadmap статусы (проверены по факту):
  - 2.10/2.10A/2.10B/2.10C/2.11/2.12/2.13/2.13A — ✅ STRICT REVIEW APPROVED (2.13A — WITH REVIEW FIXES);
  - 2.12A–2.12G — ⏳ NOT STARTED (later extensions, Reconciliation 2.12A–2.13A);
  - **2.14 — ⛔ BLOCKED — ARCHITECTURE DECISION REQUIRED** (stop-condition #4) ✅ подтверждено;
  - **2.12C / 2.12E / 2.14E — ⏳ NOT STARTED** ✅ подтверждено (0 writer-ов, 0 runtime, schema-only);
  - 2.14A/2.14B/2.14C/2.14D — NOT STARTED; 1.13B (Marketplace Behavioral Events) — APPROVED.

---

## 3. SOURCES INSPECTED

- Roadmap v3 (body 2.10–2.14E, execution sequence, Dependency Analysis);
- ADR-0006 (Storefront Commercial Model / Entitlement); ADR-0001 (cross-schema refs);
- Arch docs: finance-domain-foundation, provider-fee-settlement-payout-foundation,
  ledger-transaction-foundation, **finance-temporal-contract (2.10C)**,
  pricing-financial-snapshot (2.11), payment-flow (2.12), refund-flow (2.13),
  chargeback-dispute-foundation (2.13A), blocked-2.14 record;
- Contracts: api.md (RBAC), events.md, ids.md;
- Production: `prisma/schema.prisma` (Commission/CommissionAccrual/Invoice/ProviderFee/
  Settlement/Payout/Order/OrderItem/Quote/QuoteItem/Sale/CheckoutIntent/Payment/Refund/
  Dispute/Product/Partner/Storefront*), `permissions.constants.ts` (ROLE_PERMISSIONS),
  `src/` writers audit, legacy (grep — 0 ставок);
- Screen Design Brief 1.6 (Finance center concepts).

---

## 4. WHY STEP 2.14 BLOCKED

Roadmap body 2.14: «Invoice lifecycle, platform/partner commission facts». Stop-condition
§58 #4: **commission formula/rate/base/source authority не определена** — подтверждено
предыдущим проходом (0 rate/policy-моделей, 0 legacy ставок, 0 commission в frozen
snapshot; 2.12C/2.12E/2.14E NOT STARTED). Данный проход подтверждает и уточняет это
решением по зависимостям (см. §12–§14, §22).

---

## 5. TERMINOLOGY RECONCILIATION

| Concept | Meaning | Owner | Mutable policy / immutable fact | Existing runtime | Planned step |
|---|---|---|---|---|---|
| ProviderFee | Immutable факт комиссии **внешнего** провайдера (PSP/bank). НЕ вычисляется «по проценту» без canonical source fact (арх-док 2.10B) | Finance (`SettlementService`, единственный writer) | immutable fact (нет `updatedAt`) | ✅ 2.10B | 2.12G (гранулярность/политика распределения расходов) |
| Commission policy/rule | rate/base/formula конфигурация (channel-scoped: Marketplace / Storefront / Custom Domain / API) | **НЕ ОПРЕДЕЛЁН** | mutable configuration (концепт) | ❌ нет | **2.14E** («Никаких hardcoded ставок») |
| Commission | TravelHub platform revenue/share fact (CMS-*); отдельно от ProviderFee (2.10B) и от Subscription (ADR-0006) | Finance (планируется) | факт + lifecycle (ACCRUED/INVOICED/PAID) | ❌ schema-only | 2.12C (SPLIT) / 2.14 |
| CommissionAccrual | Задолженность **Partner перед TravelHub** (PARTNER_COLLECT, CAA-*); receivable | Finance (планируется) | факт + lifecycle (ACCRUED/INVOICED/COLLECTED) | ❌ schema-only | 2.12E |
| Settlement | Durable факт сведения денежных обязательств (STL-*); без net-payable/periods/status | Finance (`SettlementService`) | immutable fact | ✅ 2.10B (foundation) | 2.14A (engine: Gross → ProviderFee → Commission → Tax → Refund/Adj → Partner Payable) |
| Payout | Операционная запись выплаты Partner (POT-*, bank rail); без PSP calls/credentials | Finance (`SettlementService`) | immutable fact | ✅ 2.10B (foundation) | 2.14B |
| Invoice | Документ/claim (INV-*, `orderId` + `customerId` — **buyer-oriented**) | Finance (планируется) | mutable lifecycle (DRAFT/ISSUED/PAID/VOID) | ❌ schema-only | 2.14 |

**Hard gate §5 выполнен:** ProviderFee ≠ TravelHub Commission ≠ Subscription
(ADR-0006: две коммерческие модели — Marketplace commission / Storefront SaaS).
Конфликтов семантики в репозитории нет — семантика просто отсутствует.

---

## 6. CURRENT COMMISSION MODELS — SCHEMA FACTS

### Commission (CMS-*, `finance`)
| Поле | Класс |
|---|---|
| id / code (CMS-*) | identity |
| orderId | source/provenance (ref, без FK) |
| partnerId | source/provenance (ref, без FK) |
| amount / currency | frozen money fact (пока без источника!) |
| status (ACCRUED/INVOICED/PAID) | lifecycle |
| version / createdAt / updatedAt | audit/provenance metadata |

### CommissionAccrual (CAA-*, `finance`)
| Поле | Класс |
|---|---|
| id / code (CAA-*) | identity |
| partnerId | source/provenance |
| amount / currency | frozen money fact (пока без источника!) |
| periodStart / periodEnd | расчётный период (произвольный, без политики) |
| status (ACCRUED/INVOICED/COLLECTED) | lifecycle |
| version / createdAt / updatedAt | audit/provenance metadata |

**Отсутствует для воспроизводимого расчёта (факт, НЕ предложение полей):**
rate; rate type; fixed/percentage; base; rule/policy ID; channel; seller/partner
dimension freeze; product/category dimension; effectiveFrom/effectiveTo; priority;
currency-семантика; rounding-семантика; calculation version; source
payment/order/sale ref; gross/net base; refund/dispute adjustment semantics.
→ Модель не содержит ни одного расчётного входа — это чистый «факт-контейнер».

---

## 7. POLICY AUTHORITY AUDIT → **C. NO AUTHORITY**

| Локация | Найдено |
|---|---|
| Finance | 0 rate/policy-моделей (только `TaxRule`, `ExchangeRate` — не commission) |
| Sales | 0 (sales.contracts: «Никаких revenue/GMV/payment/**commission**/order/booking facts») |
| Catalog | 0 policy; есть **dimensions**: `PublicationChannel` (MARKETPLACE/PARTNER_STOREFRONT), `AcquisitionSource` (MARKETPLACE — «зарезервирован для Step 1.13B», PARTNER_STOREFRONT/DIRECT), `Product.partnerId` (seller), `RatePlan/Tariff` (цена, НЕ fee %) |
| Partner/Seller | `Partner` — 0 commission rate-полей |
| Settings | 0 (Finance master-data не дублируется в Settings — Screen Design) |
| Quote/Checkout/Sale/Order | frozen commercial snapshot — **0 commission** (2.11: «commission части deferred») |
| Payment/Refund/Dispute | 0 commission side-effects (доказано e2e T11/T9) |
| Legacy | 0 ставок (grep ts/tsx/js/json) |

**Решающее доказательство — ADR-0006 §1:** «Две коммерческие модели фиксируются в
архитектуре, но billing/PSP/commission **НЕ реализуются**. Marketplace = commission
model; Storefront = subscription model. **Никаких fee %, plan prices, recurring billing,
invoice charging, commission engine…**»; Roadmap 1.12.1A: «Billing позже становится
authoritative». → **C. NO AUTHORITY** (partially-supported dimensions ≠ policy).
B/C → A не апгрейдится.

---

## 8. COMMISSION BASE RECONCILIATION

Frozen money-кандидаты (все — Decimal(12,2), без tax — tax deferred 2.11):

| Кандидат | Заморожен? | Canonical? | Включает discount? | Включает tax? | Per-order/line | Multi-seller? | Reprice/lookup? |
|---|---|---|---|---|---|---|---|
| Quote.total (ISSUE) | ✅ | ✅ (2.3/2.11) | ✅ (subtotal−discount) | ❌ (нет tax в снапшоте) | order | нет | нет |
| CheckoutIntent.total (binding) | ✅ | ✅ (2.4) | ✅ | ❌ | order | нет | нет |
| Sale.total (completeSale) | ✅ | ✅ (2.4) | ✅ | ❌ | order | нет | нет |
| Order.total (OrderRequested) | ✅ | ✅ (2.5) | ✅ | ❌ | order | нет | нет |
| OrderItem.amount | ✅ | ✅ | ❌ (line до скидки? amount=unitPrice×qty) | ❌ | line | **нет seller-колонки** | нет |
| Payment.amount | ✅ | ✅ (2.12) | ✅ (= Order.total verbatim) | ❌ | order | нет | нет |

**Ключевые факты:**
- База «net vs gross vs tax-inclusive» **не определена** — снапшот не содержит tax;
  discount уже применён в total. → ADR REQUIRED.
- **Multi-seller НЕ заморожен:** Order/OrderItem не несут partnerId; seller живёт
  только в Catalog (`Product.partnerId`). Вывод seller'а per-line = **live Catalog
  lookup** = reprice-паттерн (запрещён 2.11). Per-line commission по seller требует
  frozen seller-проекции на линии — отсутствует.
- Payment.amount — валидный кандидат для SPLIT_AT_PAYMENT (факт денег получен),
  но 2.12F partial payments может менять ответ (документированная зависимость).

---

## 9. RATE / RULE SOURCE RECONCILIATION

| Dimension | Классификация |
|---|---|
| Channel / acquisition (Marketplace, Partner Storefront, Custom Domain, API/Manual) | **REQUIRED BY EXISTING CONTRACT** (1.12.1A, 2.14E body, ADR-0006; `PublicationChannel`/`AcquisitionSource`/`SalesAcquisitionSource` существуют) |
| Partner / seller | **SUPPORTED BY EVIDENCE BUT NOT YET CONTRACTED** (`Product.partnerId`, `Commission.partnerId` существуют; rate-дименсия по партнёру не контрактована) |
| Product / category | NOT SUPPORTED — DO NOT INVENT |
| Geography / currency / payment method / provider | NOT SUPPORTED — DO NOT INVENT |
| Contract / tariff | NOT SUPPORTED (Tariff = цена продукта, не fee %) |
| Effective dates / priority / fallback / min/max/cap | NOT SUPPORTED — DO NOT INVENT |

**2.14E «Никаких hardcoded ставок»** → ставки обязаны быть master data
(конфигурируемыми), не архитектурными константами и не дефолтами в коде.

---

## 10. POLICY VS FACT — REQUIRED SEPARATION

- Mutable configuration: commission policy/rule (channel-scoped) — **концепт, нет модели**;
- Frozen transaction fact: rate/base/formula/result, применённые к конкретной сделке.
- **Freeze boundary не определён нигде** (когда policy/res/base замораживаются;
  как историческая commission остаётся воспроизводимой после смены policy).
  Temporal contract 2.10C §4: `accruedAt` — «requires unresolved accounting
  recognition policy. **DEFER (2.12C/E) — stop-condition §39 triggered»**.
- Решение «читать текущий rate при репортинге» — **запрещено** (молчаливое
  нарушение историчности). → **ARCHITECTURE DECISION REQUIRED.**

---

## 11. LIFECYCLE BOUNDARY ANALYSIS

| Boundary | Policy selection | Policy freeze | Accrual/recognition | Invoicing |
|---|---|---|---|---|
| Quote ISSUE (2.3) | возможен (source/discount freeze есть) | не определено | нет | нет |
| Checkout binding (2.4) | возможен | не определено | нет | нет |
| Sale completion (2.4) | возможен | не определено | нет | нет |
| Order creation (2.5) | возможен | не определено | нет | нет |
| Payment CAPTURED (2.12) | возможен | не определено | **SPLIT_AT_PAYMENT** (2.12C); PARTNER_COLLECT — не доказано | нет |
| Settlement (2.14A) | нет | нет | нет (commission — вход engine) | нет |
| Invoice issuance (2.14) | нет | нет | нет | да (buyer) |

«Rate frozen» ≠ «commission accrued» — разделение не определено (не концлатировать).

---

## 12. STEP 2.12C — SPLIT_AT_PAYMENT / MARKETPLACE COMMISSION

Roadmap body: «Предпочтительный режим при поддержке PSP: `Buyer → PSP → Partner share +
TravelHub fee`. Split должен быть **реальным native PSP split**, не имитацией
ledger-записью».

Минимальная интентная ответственность:
- **collection mechanism** (native PSP split), НЕ policy engine;
- TravelHub share становится известным на payment time — но **как именно вычисляется
  share (rate/base) — вне 2.12C** (policy отсутствует; §9);
- PSP получает **предвычисленный frozen commission amount** (TravelHub share) —
  иначе PSP станет источником business policy (hard gate §12: запрещено);
- **HARD prerequisite: 2.12A/2.12B** (PSP adapters/authorize-capture/webhooks) —
  без них native split невозможен;
- provider-neutral seam: до PSP-логики должны существовать frozen commission policy +
  base + precomputed amount (→ 2.14E policy foundation).

---

## 13. STEP 2.12E — PARTNER_COLLECT / POST-FACTUM COMMISSION

Roadmap body: «Buyer платит Partner → `CommissionAccrual` фиксирует долг Partner перед
TravelHub → settlement/invoice/collection».

Минимальная интентная ответственность:
- `CommissionAccrual` = receivable (Partner должен TravelHub) — подтверждено схемой
  (CAA-*) и Screen Design («задолженность Partner перед TravelHub для PARTNER_COLLECT»);
- trigger (что порождает accrual) **не определён**: Payment CAPTURED? Sale/Order?
  commercial snapshot? → ADR REQUIRED;
- **может существовать без PSP split** (provider-neutral) — не зависит от 2.12C механик;
- нужна ли Invoice (partner-commission invoice) — зависит от invoice-концептов (§21);
- Settlement/Payout — НЕ в 2.12E (2.14A/2.14B);
- Refund/Dispute adjustment — не определён → defer (§16/§17);
- 0 accounting entries (не изобретать).

---

## 14. STEP 2.14E — CHANNEL-BASED COMMISSION RULES

Roadmap body: «Разные commission policies для Marketplace, Storefront, Custom Domain,
API/Manual. Никаких hardcoded ставок. Storefront SaaS subscription и Marketplace
commission — **разные механизмы**».

- **Интент: 2.14E — владелец channel-scoped commission policy master-data**
  (или его foundation), не просто selector над чужим движком (движка нет);
- 2.14E подчёркивает: Storefront — SaaS (subscription/entitlement, ADR-0006), НЕ
  commission; Marketplace — commission. **Два разных механизма** — не смешивать;
- **Центральный вопрос прохода — «должна ли 2.14E предшествовать 2.12C/2.12E?» —
  ДА (business-policy reasons):** без policy authority (channel-scoped rate/base)
  ни SPLIT-share (2.12C), ни accrual-amount (2.12E) невычислимы; ставки = master
  data (не константы) → policy-фундамент обязан существовать до fact-производителей.
  Номер шага позже — НЕ признак порядка (прецедент Dependency Analysis);
- 2.14E сама по себе **недостаточно специфицирована**: policy dimensions/base/rate
  type не определены → до полной реализации нужны ADR-решения (§24).

---

## 15. COMMISSION VS PAYMENT

- База: commission считается **с коммерческого снапшота** (Order/Quote/Checkout total)
  ИЛИ с Payment.amount — не определено; оба frozen-валидны (§8);
- Payment, вероятно, лишь **триггерит recognition** (SPLIT_AT_PAYMENT — момент денег);
- FAILED/CANCELLED Payment → 0 commission-фактов (очевидно; контракт не противоречит);
- SPLIT_AT_PAYMENT требует CAPTURED Payment (деньги разделены в момент capture);
- PARTNER_COLLECT: trigger не доказан (может быть sale/order-based);
- несколько payment attempts → 1 или N commission-фактов — не определено
  (2.12F partial — задокументированная зависимость, НЕ реализуется).

---

## 16. COMMISSION VS REFUND

- Refund (2.13) — 0 Commission/CommissionAccrual side-effects (e2e T11, refund-flow.md);
- Mutate/overwrite исторического Commission-факта — **запрещено** (hard gate §16:
  «Never rewrite historical financial facts»);
- Adjustment через отдельный компенсирующий факт — **не определён**, принадлежит
  будущему шагу (2.12E/2.14+); **явно defer**.

---

## 17. COMMISSION VS DISPUTE

- Dispute (2.13A) — 0 commission netting (e2e T9/T10; won/lost liability deferred);
- Dispute не должен ретроактивно получать financial netting-семантику;
- Policy/accrual/adjustment на Dispute — **не определено → defer** (до PSP chargeback
  2.13A+ и commission-контракта).

---

## 18. COMMISSION VS PROVIDER FEE

- ProviderFee (2.10B) = внешняя PSP/bank стоимость (immutable, `providerRef` provenance);
- TravelHub Commission = платформенный revenue/share — **подтверждено** (арх-док 2.10B,
  Roadmap 2.12G «ProviderFee ≠ TravelHub Commission»);
- Рассчитываются независимо; netting НЕ контрактован → не выполнять.

---

## 19. COMMISSION VS LEDGER

- 2.12D (PLATFORM_COLLECT → Ledger/Settlement) — NOT STARTED; ledger posting не активирован;
- Commission/CommissionAccrual создание НЕ должно автопостить LedgerTransaction;
- 2.14 может создавать commission-факты без ledger-постинга (как Payment/Refund/Dispute);
- 0 ledger writers в этом проходе (не добавляются).

---

## 20. COMMISSION VS SETTLEMENT / PAYOUT

- Settlement Engine (2.14A): «Gross → ProviderFee → TravelHub Commission → Tax →
  Refund/Adjustments → Partner Payable» — commission является **input** engine;
- Payout (2.14B) — операционный rail; net payout formula не изобретать;
- Без canonical commission-факта partner payable невыводим → commission-контракт
  предшествует полноценной 2.14A;
- 0 settlement/payout кода в этом проходе.

---

## 21. INVOICE INDEPENDENCE VERDICT

1. **Источник Invoice:** frozen Order snapshot (`total`/`currency` verbatim, 2.11) +
   Payment/Refund факты; `customerId` из Order (nullable) — источник определён;
2. **Концепты:** foundation-модель `Invoice` — **buyer-oriented** (`orderId`+`customerId`,
   без partnerId). Partner-commission invoice (INVOICED на Commission/CommissionAccrual) —
   отдельный концепт, требует `partnerId`-дименсии (additive, 2.12E/2.14E scope);
3. Invoice (buyer) **НЕ требует** commission amount;
4. PARTNER_COLLECT требует partner-invoice для accrued commission — да (2.12E
   «settlement/invoice/collection»), но это НЕ та же Invoice-модель без расширения;
5. Buyer-invoice выдаётся из frozen Order/Payment фактов **без commission** — да;
6. Реализация Invoice первой НЕ создаст неправильный концепт **при условии** явного
   разделения buyer vs partner-commission invoice.

**Классификация: `INVOICE CAN PROCEED INDEPENDENTLY`** (buyer-половина; frozen
Order/Payment факты, 0 commission-зависимостей) — с оговоркой: набор invoice-концептов
(buyer vs partner-commission) требует явного решения перед resume 2.14. Сама 2.14
остаётся BLOCKED до commission-контракта (решение пользователя: без «полушага»).

---

## 22. DEPENDENCY GRAPH

### Hard prerequisite (нельзя корректно реализовать без)
- **2.12C** → **2.12A + 2.12B** (PSP adapters/authorize-capture/webhooks; native split) → также **2.14E policy foundation** (frozen policy/base до precomputed share);
- **2.12E** → **2.14E policy foundation** (rate/base для accrual-amount); trigger-решение;
- **2.14 (commission-половина)** → **2.12C/2.12E** (commission-контракт);
- **2.14A (Settlement Engine)** → commission-контракт (commission — input) + 2.12D (ledger для PLATFORM_COLLECT);
- **2.14B (Payout)** → 2.14A (settlement);
- **2.13A real-PSP chargeback** → 2.12A/2.12B.

### Soft/future dependency (аддитивно позже)
- **2.12D** (PLATFORM_COLLECT ledger) — добавится аддитивно;
- **2.12F** (partial payments) — влияет на commission-базу/количество фактов (документировано), аддитивно;
- **2.12G** (ProviderFee гранулярность) — аддитивно, ≠ commission;
- **2.14D** (reconciliation) — после 2.14A/2.14B.

### Independent
- **2.13 (Refund)**, **2.13A (Dispute foundation)** — provider-neutral, 0 commission (доказано);
- **Invoice (buyer-половина 2.14)** — frozen Order/Payment факты;
- **2.10A/2.10B/2.11** — completed foundations.

**Вывод (не из нумерации):** `policy foundation (2.14E-образный) → 2.12E
(provider-neutral accrual) | 2.12C (после 2.12A/2.12B) → 2.14 (commission-факты +
buyer invoice) → 2.14A → 2.14B`.

---

## 23. DECISION MATRIX

| Вопрос | Репозиторный ответ | Evidence | Статус | Владелец |
|---|---|---|---|---|
| Commission policy owner | нет | ADR-0006 «commission engine НЕ реализуются»; 0 моделей | **ADR REQUIRED** | 2.14E (foundation) |
| Rate source | нет | 0 rate-полей/моделей; 0 legacy | **ADR REQUIRED** | 2.14E |
| Calculation base | не определено (кандидаты frozen total'ы, без tax) | §8 | **ADR REQUIRED** | 2.14E/2.14 |
| Rate type (fixed/%) | не определено | §9 | **ADR REQUIRED** | 2.14E |
| Discount/tax treatment | discount включён в total; tax отсутствует | снапшот 2.11 | **ADR REQUIRED** | 2.14E |
| Policy selection dimensions | channel — REQUIRED; partner — evidence-only | 1.12.1A/2.14E/ADR-0006 | **ADR REQUIRED** (partner/категории) | 2.14E |
| Freeze boundary | не определён | 2.10C §4 (`accruedAt` DEFER) | **ADR REQUIRED** | 2.14E/2.12C |
| SPLIT_AT_PAYMENT | collection mechanism; native PSP split; HARD: 2.12A/B | Roadmap 2.12C | PARTIAL (механика), **ADR** (share calc) | 2.12C |
| PARTNER_COLLECT | CommissionAccrual = receivable; trigger не определён | Roadmap 2.12E, схема | PARTIAL, **ADR** (trigger) | 2.12E |
| Refund adjustment | 0 reversal; overwrite запрещён; компенсирующий факт не определён | refund-flow, e2e T11 | **defer** | 2.12E/2.14+ |
| Dispute adjustment | 0 netting; won/lost deferred | dispute e2e T9/T10 | **defer** | 2.13A+/2.14+ |
| Ledger posting | 0; 2.12D NOT STARTED | 2.10A/2.12D | RESOLVED (defer) | 2.12D |
| Invoice dependency | buyer-invoice независима; partner-invoice — отдельный концепт | §21 | RESOLVED (buyer) / **ADR** (концепты) | 2.14 |

Все unresolved строки остаются unresolved — gap'ы не заполняются предпочтением.

---

## 24. UNRESOLVED ARCHITECTURE DECISIONS (минимальный набор)

1. **Commission policy owner & dimensions** — где живёт policy; channel обязателен
   (1.12.1A/2.14E); partner/product/category — включать или нет;
2. **Base definition** — gross vs net; tax-inclusive/exclusive (tax в снапшоте нет —
   чем станет база до появления tax-движка); per-order vs per-line;
3. **Rate type & rounding** — fixed/percentage; min/max/cap; rounding-конвенция;
4. **Freeze boundary** — когда policy/base замораживаются (кандидаты: Quote ISSUE /
   Checkout binding / Order creation / Payment CAPTURED); как обеспечить
   историческую воспроизводимость;
5. **Collection model per channel** — SPLIT_AT_PAYMENT vs PARTNER_COLLECT vs
   PLATFORM_COLLECT: кто за какой channel отвечает;
6. **Adjustment strategy** — refund/dispute clawback (отдельный компенсирующий факт;
   когда);
7. **Invoice concept set** — buyer invoice vs partner-commission invoice (расширение
   `Invoice.partnerId` или отдельная модель).

Формулировка решений — структурная (base/dimensions/rate type/freeze/collection/
adjustment), **НЕ «какой процент?»** (§25). Реальные ставки — master data, не константы.

---

## 25. ROADMAP CHANGES

- **2.14 остаётся BLOCKED** ✅ (не открыт, не завершён);
- **2.12C/2.12E/2.14E не маркированы реализованными** ✅;
- Execution sequence Finance-блок дополнен: итог реконсиляции + prerequisite edges
  (2.12C → HARD 2.12A/2.12B; 2.14E policy foundation → 2.12C/2.12E; 2.14 blocked;
  2.14A/2.14B NOT STARTED; Invoice независима; ADR-список) + ссылка на отчёт;
- APPROVED шаги (2.10–2.13A) не тронуты; 2.13/2.13A не переоткрыты (реальных
  несовместимостей не обнаружено).

---

## 26. NEGATIVE CHECKS (все PASS)

1. 0 production-кода добавлено (git diff — только Roadmap + отчёт + ранее созданный BLOCKED record);
2. 0 schema/migration изменений;
3. 0 hardcoded commission rate (не изобреталось);
4. ProviderFee НЕ переиспользован как Commission (терминология §5/§18);
5. mutable Catalog/Settings НЕ сделаны историческим authority (7: C. NO AUTHORITY);
6. 0 PSP-поведения изобретено;
7. 0 ledger auto-posting добавлено;
8. 0 Refund/Dispute исторических фактов мутировано;
9. 0 Settlement/Payout формулы изобретено;
10. 0 false completion markers (2.12C/2.12E/2.14E/2.14 не завершены);
11. 2.14 остаётся BLOCKED ✅;
12. ни один поздний шаг (2.14A+) не начат.

---

## 27. TESTS ACTUALLY EXECUTED

- Документационный проход: production-код/схема **byte-for-byte без изменений**
  (проверено `git status`/`git diff` — только docs);
- Запущенных тестов **нет** (регрессия не требуется и не декларируется);
- Бейзлайн (не выполнен в этом проходе, для справки): unit `548/548`, serial e2e
  `1105/1105` (63 suites), frontend Vitest `135/135`, migrations `54/54`, drift 0.

---

## 28. EXACT EXECUTION ORDER (РЕЗУЛЬТАТ C — С РЕШЕНИЯМИ; B — ЧАСТИЧНО)

### RESULT C — ARCHITECTURE DECISION REQUIRED FIRST (для commission)
До любого commission-кода обязательны решения §24 (policy owner/dimensions, base,
rate type, freeze boundary, collection model, adjustment, invoice concepts).
Решения оформляются ADR (структурные, не «проценты»).

### RESULT B — что может начаться безопасно (после решений или независимо)
- **Invoice (buyer-половина 2.14)** — независима (frozen Order/Payment), может идти
  сразу, НО по решению пользователя 2.14 целиком остаётся BLOCKED;
- Порядок commission после решений (установлен, не из нумерации):
  `2.14E (channel policy foundation) → strict review → 2.12E (PARTNER_COLLECT accrual,
  provider-neutral) → strict review → 2.12C (SPLIT; после 2.12A/2.12B) → strict review
  → 2.14 (commission-факты + buyer invoice) → 2.14A → 2.14B → 2.14D`.

---

## 29. EXACT NEXT ITEM

**«ARCHITECTURE DECISIONS: Commission Policy Contract (ADR)»** — один следующий шаг:
оформить ADR по §24 (policy owner/dimensions, base, rate type, freeze boundary,
collection model, adjustment, invoice concepts) → затем `2.14E foundation →
strict review → 2.12E → 2.12C (после 2.12A/2.12B) → resume 2.14`.

НЕ начинать: 2.14A/2.14B/2.14D; 2.12A/2.12B/2.12C/2.12D/2.12E/2.12F/2.12G;
реализацию commission/Invoice; hardcoded ставки.

---

## 30. FINAL CANONICAL STATUS LINE

`PHASE 2 COMMISSION DEPENDENCY RECONCILIATION COMPLETED — ARCHITECTURE DECISION REQUIRED`

- 2.14: ⛔ BLOCKED — ARCHITECTURE DECISION REQUIRED (остаётся);
- 2.12C / 2.12E / 2.14E: ⏳ NOT STARTED (остаются);
- Commission policy authority: **C. NO AUTHORITY** — доказано (ADR-0006, schema, legacy, snapshot);
- Prerequisite edges установлены; Invoice (buyer) независима; commission-порядок
  установлен условно (RESULT B/C); ADR-решения §24 — обязательное условие любого
  commission-кода; 0 production-изменений в этом проходе.
