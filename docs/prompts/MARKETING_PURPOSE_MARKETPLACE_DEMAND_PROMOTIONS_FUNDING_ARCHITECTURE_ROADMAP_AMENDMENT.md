# MARKETING PURPOSE / MARKETPLACE DEMAND / PROMOTIONS & FUNDING — ARCHITECTURE & ROADMAP AMENDMENT

**Дата:** 2026-08-29  
**Режим:** ARCHITECTURE / DOCUMENTATION / ROADMAP AMENDMENT ONLY  
**Production code:** НЕ ИЗМЕНЯЕТСЯ

---

## 1. Контекст

Step 3.8 (Marketing Domain) и Step 3.9 (Marketing Center UI) закрыты с VERDICT A.

Цепочка:
```
Step 3.8 implementation:       541fe4b
Step 3.8.1 evidence:           8b32e34
Step 3.8.2 remediation:        38d88fd
Final evidence closure:        b8627b7
Strict Review:                 4135025
Roadmap/lifecycle amendment:   0f950c8
Step 3.9 implementation:       c539e51
Step 3.9 runtime remediation:  e8d54ad
Step 3.9 Strict Review:        5cf9066
Step 3.9 findings remediation: cb3fef1
```

Текущая Marketing Domain включает:
- `Campaign` (MKT-*) с `CampaignObjective` enum: AWARENESS/ENGAGEMENT/CONVERSION/RETENTION/REACTIVATION
- `CampaignAudience` (MKA-*) с JSONB criteria (whitelist: lifecycle/leadSource/tags/status/customerType)
- `CampaignAttribution` с entity types: CUSTOMER/LEAD/ORDER/BOOKING
- Lifecycle: DRAFT→SCHEDULED→ACTIVE→PAUSED/COMPLETED/CANCELLED
- Platform-only RBAC: ADMIN/DIRECTOR/MARKETER/OPERATOR

Настоящий amendment фиксирует архитектурные решения для будущего Marketing evolution.

---

## 2. Repository Gap Audit

| Capability | Current state | Canonical authority | Gap | Future action |
|---|---|---|---|---|
| Campaign | EXISTS (marketing.Campaign) | marketing.* | OK | Extensions in future steps |
| CampaignObjective | EXISTS (5-value enum) | marketing.* | OK | Semantics below §3 |
| CampaignPurpose | MISSING | — | NEW CONCEPT | §3 below |
| Audience | EXISTS (CampaignAudience + criteria) | marketing.* | OK | Criteria expansion deferred |
| Attribution | EXISTS (CUSTOMER/LEAD/ORDER/BOOKING) | marketing.* | OK | Product/Partner attribution gap §26 |
| Promotion | MISSING | — | NEW DOMAIN | §9 below |
| Discount | QuoteDiscountType exists (NONE/PERCENTAGE/FIXED) | sales.* | Sales-owned, frozen at ISSUE | Promotion must not mutate |
| Funding Source | MISSING | — | NEW CONCEPT | §10 below |
| Commission | EXISTS (CommissionPolicy + CommissionAccrual) | finance.* | OK | Commission waiver §15 |
| Settlement/Payout | EXISTS (Settlement/Payout/ProviderFee) | finance.* | OK | Refund implications §20 |
| Budget | MISSING | — | NEW CONCEPT | §22 below |
| Approval | MISSING | — | NEW CONCEPT | §23 below |
| Audit | Partial (AuditLog exists) | security.* | OK | Promotion-specific audit §24 |
| Marketing Analytics | MISSING | — | DEFERRED | §25 below |
| Ledger | EXISTS (LedgerTransaction) | finance.* | OK | Marketing cost ledger entry future |

---

## 3. Campaign Objective vs Campaign Purpose

### CampaignObjective (существующий)

Отвечает на вопрос: **"Какова маркетинговая тактика кампании?"**

```text
AWARENESS      — узнаваемость бренда/маркетплейса
ENGAGEMENT     — вовлечение аудитории
CONVERSION     — конверсия в покупку/бронирование
RETENTION      — удержание существующих клиентов
REACTIVATION   — реактивация ушедших клиентов
```

### CampaignPurpose (новый концепт)

Отвечает на вопрос: **"Какую бизнес-функцию TravelHub выполняет этой кампанией?"**

```text
CUSTOMER_ACQUISITION       — привлечение покупателей на маркетплейс
PARTNER_ACQUISITION        — привлечение продавцов/поставщиков
MARKETPLACE_DEMAND         — генерация спроса на предложения продавцов
SPONSORED_PARTNER_PROMOTION — платное продвижение конкретного Partner (будущее)
```

### Разделение

`Objective` и `Purpose` — это НЕ одно и то же:

```text
Purpose: MARKETPLACE_DEMAND
Objective: CONVERSION
→ кампания направлена на генерацию спроса с целью конверсии

Purpose: CUSTOMER_ACQUISITION
Objective: AWARENESS
→ кампания направлена на привлечение через узнаваемость
```

Текущий `CampaignObjective` НЕ покрывает `Purpose`. Purpose — отдельный additive field/capability.

### Правила

```text
1. CampaignPurpose НЕ заменяет CampaignObjective
2. Campaign может иметь Purpose + Objective одновременно
3. Purpose определяет target business outcome
4. Objective определяет marketing tactic
5. Валидация: Platform Purpose (CUSTOMER/PARTNER/MARKETPLACE) только для Platform campaigns
6. SPONSORED_PARTNER_PROMOTION — future, deferred до отдельного architectural decision
```

---

## 4. Platform Marketing Purpose Model

### 4.1 CUSTOMER_ACQUISITION

**Назначение:** Привлечь покупателей на TravelHub.

```text
Marketing Campaign
→ Customer segment (из Audience criteria)
→ Buyer account creation / activation
→ First Order / Booking
→ Repeat Orders / Bookings
→ GMV → Commission → Revenue
```

**Цепочка ценности:**
```text
Campaign spend → Customer acquired → Order → Booking → GMV → Commission revenue
```

**Attribution chain:**
```text
Campaign → CUSTOMER → ORDER → BOOKING
```

**Budget consideration:** Platform-funded (Investment in acquisition). Acquisition cost ≤ expected LTV over defined horizon.

### 4.2 PARTNER_ACQUISITION

**Назначение:** Привлечь продавцов/поставщиков на TravelHub.

```text
Marketing Campaign
→ Partner Lead / Outreach
→ Onboarding process
→ Partner activation (Marketplace Basic / Storefront Pro)
→ Product listing
→ First sale
→ Commission revenue
```

**Audit requirement:** Существующий canonical `sales.Lead` используется для Buyer request reverse marketplace. Partner acquisition lead — отдельная семантика (B2B). Требуется gap analysis при реализации:

```text
DEFERRED DECISION: использовать ли sales.Lead для Partner acquisition
или создать отдельный PartnerLead concept.
```

**Attribution chain:**
```text
Campaign → Partner Lead → Partner → Activation → Order → GMV
```

### 4.3 MARKETPLACE_DEMAND

**Назначение:** TravelHub продвигает marketplace supply для генерации buyer demand.

```text
Platform Marketing Campaign
→ Promoted Product/Offer/Service selection
→ Buyer demand generation
→ Customer → Order → Booking
→ GMV → TravelHub commission
```

Это нормальная функция Platform Marketing, а не private Partner Marketing.

```text
Platform выбирает какие Product/Offer/Service продвигает
на основе: availability, price, conversion, rating, quality,
destination, customer relevance, commission economics
```

**Hard boundary:**
```text
MARKETPLACE_DEMAND ≠ SPONSORED_PARTNER_PROMOTION
MARKETPLACE_DEMAND = Platform decides/funds
SPONSORED_PARTNER_PROMOTION = Partner funds/purchases
```

### 4.4 SPONSORED_PARTNER_PROMOTION (Future, Deferred)

**Назначение:** Конкретный Partner платит TravelHub за дополнительное продвижение.

```text
Partner pays → Sponsored promotion activation
→ Partner's Product/Offer/Service gets additional visibility
→ Measurable attribution to Partner
→ Billing/invoicing to Partner
```

**DEFERRED:** Не реализовывать до отдельного architectural decision:
- commercial product definition
- sponsored labeling / disclosure
- eligibility rules
- billing model
- measurement/reporting
- conflict of interest safeguards

---

## 5. Campaign vs Promotion

### Разделение ответственности

```text
Campaign
  ├── marketing orchestration (purpose, audience, channels)
  ├── lifecycle management (DRAFT→SCHEDULED→ACTIVE→...)
  ├── attribution tracking
  └── budget allocation (future)

Promotion
  ├── economic discount rule
  ├── funding source specification
  ├── eligibility constraints
  ├── redemption/cap tracking
  └── settlement/financial impact
```

### Relation

```text
Campaign (marketing)
   └── may own/reference 0..N Promotions (economic)

Promotion (financial)
   └── applies discount to Order/Booking
   └── records funding source
   └── impacts Settlement/Payout
```

**Hard rule:**
```text
Campaign ≠ Promotion
Campaign не является financial ledger
Promotion не является marketing orchestration tool
```

---

## 6. Promotion Funding Model

### 6.1 Funding Sources

```text
PARTNER_FUNDED
  → скидка финансирует Partner
  → partner entitlement уменьшается

PLATFORM_FUNDED
  → скидка финансирует TravelHub
  → partner entitlement НЕ уменьшается из-за platform-funded portion

CO_FUNDED
  → discount cost разделяется между Platform и Partner
  → по явно сохранённому allocation
```

### 6.2 Hard Invariant

```text
Discount amount ≠ Funding source
```

Нельзя определить, кто оплатил скидку, только из итоговой цены.

---

## 7. Platform-Funded Promotion Economics

### 7.1 Commission Waiver Scenario

```text
Base service value:             1 000 AZN
Contractual commission:           100 AZN
Normal partner entitlement:       900 AZN

Platform-funded discount:         100 AZN
Customer paid:                    900 AZN
Partner entitlement:              900 AZN
Commission waived:                100 AZN
Additional platform subsidy:        0 AZN
```

Экономический смысл: TravelHub отдаёт покупателю свою комиссию для acquisition/conversion.

### 7.2 Negative Unit Economics Scenario

```text
Base service value:             1 000 AZN
Contractual commission:           100 AZN
Normal partner entitlement:       900 AZN

Platform-funded discount:         150 AZN
Customer paid:                    850 AZN
Partner entitlement:              900 AZN

Commission waived:                100 AZN
Additional platform subsidy:       50 AZN
```

TravelHub получает отрицательную unit economics: **-50 AZN** на конкретной продаже.

Это допустимая marketing acquisition subsidy, ТОЛЬКО под:
```text
separate governance approval
budget authority
explicit time/budget limits
audit trail
```

### 7.3 Co-Funded Example

```text
Base service value:              1 000
Total customer discount:           200

Partner-funded portion:            100
Platform-funded portion:           100

Customer paid:                      800
```

Точный Partner entitlement и commission base определяются canonical commercial/settlement policy.

---

## 8. Economic Dimensions

### 8.1 Required Economic Dimensions

Canonical representation для promotion economics:

```text
baseServiceValue / grossServiceValue
partnerFundedDiscount
platformFundedDiscount
customerPaid

contractualCommission
commissionWaived
platformSubsidy

partnerEntitlement

providerFees
refundAmount

marketingPromotionCost
realizedPlatformRevenue
```

### 8.2 Stored vs Derived

```text
STORED (immutable facts):
  baseServiceValue — frozen at Order/Booking snapshot
  customerPaid — frozen at Payment capture
  contractualCommission — frozen from CommissionPolicy
  fundingAllocation — frozen at Promotion activation

DERIVED (calculated):
  partnerEntitlement = baseServiceValue - platformFundedDiscount - contractualCommission + commissionWaived
  platformSubsidy = platformFundedDiscount - commissionWaived (if negative)
  realizedPlatformRevenue = contractualCommission - commissionWaived - platformSubsidy
```

### 8.3 Ownership

```text
baseServiceValue       → order.* (frozen snapshot)
customerPaid           → payment.* (frozen snapshot)
contractualCommission  → finance.Commission (frozen policy)
fundingAllocation      → promotion.* (new domain)
partnerEntitlement     → derived from settlement calculation
```

---

## 9. Order/Booking Snapshot Authority

### 9.1 Snapshot Freeze Point

```text
Freeze boundary: Order creation (from frozen Quote ISSUE snapshot)
Downstream: verbatim copy (Order → Booking → Payment)
```

Promotion economics must be frozen BEFORE or AT Order creation:

```text
Promotion applied at Quote/CheckoutIntent level
→ frozen in Order snapshot
→ verbatim through Booking → Payment → Settlement
```

### 9.2 Historical Reconstruction

Hard invariant:
```text
Promotion must not overwrite historical/base Product price
in a way that destroys economic provenance.

Order/Booking financial snapshot must allow reconstruction months later:
  original/base value
  customer discount
  funding split
  customer paid
  contractual commission
  commission waived
  platform subsidy
  partner entitlement
  refund consequences
```

Не полагаться на current Product price для historical transaction reconstruction.

---

## 10. Payment Impact

Payment должен отражать фактически взимаемую с Customer сумму.

```text
Payment.amount = customerPaid (post-promotion)
```

Payment НЕ должен成为 единственным source of truth для:
```text
base value — order.*
discount funding — promotion.*
commission waiver — finance.*
partner entitlement — settlement.*
```

---

## 11. Settlement/Payout Impact

### 11.1 Platform-Funded Discount

```text
Platform-funded discount НЕ должен автоматически уменьшать Partner payout.
```

Hard invariant:
```text
Platform-funded portion
≠
automatic reduction of Partner entitlement
```

Settlement/Payout должен использовать canonical funding allocation:

```text
partnerEntitlement = baseServiceValue - partnerFundedDiscount - commission
commissionWaived = contractualCommission (if platform covers full commission)
platformSubsidy = max(0, platformFundedDiscount - commissionWaived)
```

### 11.2 Refund Implications

```text
refund customer amount → reverse customerPaid
reverse commission → reverse commissionWaived (if applicable)
reverse platform subsidy → reverse platformSubsidy (if applicable)
reverse partner-funded discount → reverse partnerFundedDiscount
settlement adjustment → recalculate partnerEntitlement
```

**DEFERRED:** Точная refund formula зависит от settlement policy.

---

## 12. Eligibility

### 12.1 Bounded Eligibility Rules

```text
date/time window
service/business capability
Product/Offer/Service
destination
Partner
customer segment
new customer only
minimum order value
maximum discount/order
usage/customer
total redemption limit
budget limit
```

### 12.2 Marketplace Supply Selection

Platform может продвигать marketplace supply для MARKETPLACE_DEMAND:

```text
availability
price
conversion
rating
quality
destination
customer relevance
promotion eligibility
commission/margin economics
```

### 12.3 Organic vs Paid

```text
organic marketplace promotion = natural ranking/visibility
paid sponsored placement = additional visibility for payment

Hard rule:
Paid influence не должен скрытно маскироваться под neutral ranking.
```

---

## 13. Budget

### 13.1 Budget Concept

```text
campaign/promotion budget
currency
reserved/committed/spent
max discount per order
redemption cap
period
funding source
approval status
approvedBy
approvedAt
reason/comment where required
```

### 13.2 Separation from Marketing Permission

Hard invariant:
```text
marketing.campaign.manage
≠
unlimited authority to spend Platform money
```

Маркетолог может создать/подготовить Campaign/Promotion, но activation platform-funded promotion требует budget/financial authority.

---

## 14. Approval/Governance

### 14.1 Approval Model

```text
Promotion Draft
→ budget/funding validation
→ approval if required
→ Scheduled
→ Active
→ Completed/Cancelled
```

### 14.2 Strict Gate

```text
platformSubsidy > 0
→意味着 real cash/economic marketing spend сверх отказа от revenue
→requires explicit approval
→requires budget allocation
→requires audit trail
```

### 14.3 Approval Policy (Conceptual)

```text
PARTNER_FUNDED promotion:
  → Partner authorizes own discount
  → Platform validates eligibility
  → Activation gate: Partner consent + Platform validation

PLATFORM_FUNDED promotion (≤ commission):
  → Marketing team prepares
  → Budget validation (within approved budget)
  → Activation: Campaign manager approval

PLATFORM_FUNDED promotion (> commission = negative unit economics):
  → Marketing team prepares
  → Budget validation (within approved budget)
  → Finance approval
  → Executive approval (threshold-based)
  → Activation: documented governance gate
```

---

## 15. Audit

### 15.1 Financially Material Audit

```text
who created
who changed
who approved
what changed
previous value
new value
reason
timestamp
campaign/promotion
```

### 15.2 Post-Activation Immutability

```text
After activation нельзя бесследно менять funding economics
уже созданных transactions.
Changes require versioning + audit trail.
```

---

## 16. Marketing Analytics Implications

### 16.1 Required Analytics Questions

```text
Сколько покупателей привлекли? (CUSTOMER_ACQUISITION)
Сколько новых партнёров привлекли? (PARTNER_ACQUISITION)
Сколько Orders/Bookings создала Campaign?
Какой attributed GMV?
Какую contractual commission создали продажи?
Сколько commission было waived?
Сколько Platform subsidy потрачено?
Каков total promotion cost?
Каков realized revenue?
Каков incremental contribution?
Какие кампании окупаются?
```

### 16.2 Take Rate Implications

```text
Gross/Contractual Take Rate
= contractual commission / qualified GMV

Realized Take Rate
= actually retained commission/revenue / qualified GMV

Platform-funded promotion может привести к расхождению.
```

**DEFERRED:** Не менять существующий KPI без отдельного implementation.

---

## 17. Attribution Implications

### 17.1 Current Attribution

```text
CUSTOMER / LEAD / ORDER / BOOKING
```

### 17.2 Expected Future Chains

```text
CUSTOMER_ACQUISITION:
  Campaign → Customer → Order → Booking → GMV

PARTNER_ACQUISITION:
  Campaign → Partner Lead → Partner → Activation

MARKETPLACE_DEMAND:
  Campaign → promoted supply → Customer → Order → Booking → GMV

SPONSORED_PARTNER_PROMOTION:
  Campaign/Promotion → Partner/Product → engagement → Booking → attributed GMV
```

### 17.3 Gap

Current Attribution может не иметь Product/Offer/Partner relation. При реализации Promotion domain нужно расширить Attribution capabilities.

---

## 18. Platform vs Storefront Marketing Boundary

```text
Platform Marketing Center = PLATFORM WORKSPACE (existing)
  → ADMIN/DIRECTOR/MARKETER/OPERATOR access
  → Marketing.* permissions
  → No Partner access

Storefront Pro Marketing = FUTURE (deferred)
  → Partner's own direct customers
  → Partner's own Storefront
  → Partner-funded campaigns/promotions
  → No Platform-level authority

Hard rule:
No Partner actor gets Platform Marketing authority
No Platform Marketing extends to Partner workspace
```

---

## 19. Security Invariants

```text
1. Campaign ≠ Promotion
2. Objective ≠ Purpose (unless audit proves equivalence)
3. Discount ≠ Funding Source
4. Platform-funded discount must not reduce Partner entitlement by accident
5. Marketing permission ≠ financial spending authority
6. Frontend-hidden ≠ server denial
7. Historical transaction economics must be reconstructable
8. Activated promotion changes must be audited
9. No arbitrary negative pricing
10. No customer payout below/above canonical payment rules
11. No cross-partner funding leakage
12. No Partner actor gets Platform Marketing authority
13. No promotion can bypass Product/Offer eligibility
14. No fake Marketing Analytics from incomplete data
```

---

## 20. Deferred Decisions

```text
1. Partner Acquisition Lead — использовать ли sales.Lead или создать PartnerLead
2. Promotion Domain schema — полная Prisma schema для Promotion
3. Financial snapshot integration — точная точка freeze в Order lifecycle
4. Refund formula — точная refund policy при promotion involvement
5. Budget schema — canonical Budget/Approval domain
6. Sponsored Partner Promotion — commercial product definition
7. Marketing Analytics — derived KPIs from promotion + attribution data
8. Channel delivery — EMAIL/SMS/PUSH implementation
9. Consent/Preferences — marketing consent architecture
10. Automation/Journeys — workflow engine for marketing automation
```

---

## 21. Roadmap Placement

Architecture amendment добавляется как post-Step 3.9 documentation artifact.

```text
Post-Step 3.9 Marketing Architecture Amendment = COMPLETED
```

Future implementation stages определяются roadmap sequencing:

```text
A. Marketing Purpose domain authority (extends Campaign with Purpose field)
B. Promotion domain / funding authority (new Prisma models + service)
C. Promotion financial snapshot integration (Order/Booking freeze)
D. Approval / budget authority (governance gate)
E. Platform Promotion Management UI (extends Marketing Center)
F. Marketplace offer eligibility/projection (supply selection)
G. Promotion attribution (extends CampaignAttribution)
H. Marketing Analytics (derived KPIs)
I. Sponsored Partner Promotion — separate future decision
```

---

## 22. Acceptance Gates for Future Implementation

### Promotion Domain Implementation

```text
1. Promotion model persisted with funding source
2. Discount applied at Order/Booking creation
3. Customer paid reflects post-promotion amount
4. Partner entitlement correctly computed
5. Commission waiver correctly handled
6. Platform subsidy correctly tracked
7. Refund reversal handles all economic components
8. Historical transaction reconstructable
9. Approval gate enforced for platform-funded
10. Audit trail for all financial changes
11. Cross-partner isolation
12. No raw 500 on invalid promotion input
13. RBAC separation: marketing manage ≠ financial spending
```
