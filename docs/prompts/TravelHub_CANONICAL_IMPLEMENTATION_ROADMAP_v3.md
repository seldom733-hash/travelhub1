# TravelHub --- CANONICAL MASTER IMPLEMENTATION PLAN v3

**Статус документа:** канонический Master Plan на хранение\
**Дата актуализации:** 2026-08-09\
**Принцип:** существующие шаги не удаляются и не перенумеровываются.
Новые решения добавляются подшагами `A/B/C...` либо
clarification/review-fix.\
**Источники:** Canonical Roadmap v2, Architecture Master Baseline 1.6
Marketplace Payments & Settlement, выполненные Phase 1
implementation/review reports и утверждённые решения по Storefront
SaaS/Partner CRM.\
**Использование:** источник истины для implementation prompts,
review-fixes, exit audits, architecture reconciliation и Go-Live
readiness.

------------------------------------------------------------------------

# PHASE 1 --- FOUNDATION, MARKETPLACE, IDENTITY & PLATFORM BASE

· **Step 1.0 --- E2E Test Database Isolation**\
Изолированная PostgreSQL test DB, реальные migrations, guards от
destructive-run, воспроизводимый e2e.\
**Статус: APPROVED.**

· **Step 1.1 --- Category Schema Foundation**\
Универсальный Catalog.Product, category schema, category-specific
attributes/filters/availability/tariff/media/PDP configuration.\
**Статус: APPROVED.**

· **Step 1.2 --- Product Media Foundation**\
ProductMedia, S3-compatible storage, MinIO, Sharp, original/large/thumb,
private-by-default, media API, test bucket isolation.\
**Статус: APPROVED после review-fixes.**

· **Step 1.3 --- Product Ownership & PARTNER Object Scope**\
Product.partnerId, server-side scope, IDOR protection, PARTNER only-own
access, ProductMedia ownership inheritance, MODERATOR read-only.\
**Статус: APPROVED после review-fixes.**

· **Step 1.4 --- Moderation Workflow**\
submit → review → approve / reject / request changes, moderation queue,
snapshot/version review, controlled publish, полноценный change proposal
для PUBLISHED Product, запрет MODERATOR менять Product за PARTNER,
repeat moderation after material changes.\
**Статус: APPROVED после review-fixes.**

· **Step 1.5 --- Public Catalog Read Foundation**\
Anonymous API только для published Product/media, public
search/category/list/PDP backend contracts, stable media delivery,
server-side filtering/sorting/pagination, отсутствие утечки
draft/internal данных.\
**Статус: APPROVED после review-fixes.**

· **Step 1.6 --- Public Marketplace Routing & Frontend Split**\
`/` → Public Marketplace, `/products/:slug` → PDP, `/app/*` → внутренние
центры, разделение Public/Internal layouts и API boundaries, role-aware
routing.\
**Статус: APPROVED.**

· **Step 1.7 --- Public Marketplace Home / Search / Category / PDP**\
Витрина, карточки услуг, цены, описание, динамические фильтры,
категории, PDP, media gallery, tariffs/options/availability, RU/AZ/EN.\
**Статус: APPROVED.**

· **Step 1.8 --- Partner Cabinet Foundation**\
Кабинет PARTNER: свои Product, создание/редактирование, dynamic Category
Schema form, attributes, tariffs, availability, media, submit to
moderation, moderation feedback; Partner-safe Active Category Schema
contract.\
**Статус: APPROVED.**

· **Step 1.9 --- Buyer Identity / Public-to-Authenticated Transition**\
Регистрация/login BUYER, обязательный Buyer ↔ CRM Customer mapping, own
account/profile, public-to-authenticated transition, подготовка Buyer
Cabinet. ADR-0003 --- узкая Security ↔ CRM orchestration.\
**Статус: APPROVED после review-fixes.**

· **Step 1.10 --- Partner Registration & Onboarding**\
Public registration PARTNER, PartnerApplication lifecycle, internal
review, approve/reject/request changes, CRM Partner create/link,
controlled `User.partnerId`, selling access только после approval.
ADR-0004.\
**Статус: APPROVED.**

· **Step 1.11 --- Public Seller Identity & Anti-Disintermediation**\
CRM Partner Identity отделена от Marketplace Public Seller Identity.
`PublicSellerProfile`, `ANONYMOUS / VERIFIED_ALIAS / PUBLIC_BRAND`,
moderator-controlled visibility, seller-safe Card/PDP projection, защита
от утечки контактов и обхода платформы; geography хранится кодами,
legacy repair --- explicit command, не startup backfill.\
**Статус: APPROVED после review-fixes.**

· **Step 1.12 --- Partner Storefront Foundation**\
Персональная витрина/мини-сайт PARTNER на TravelHub. Один canonical
Product используется Marketplace и Storefront без копирования.
Storefront --- отдельный коммерческий SaaS-контур, а не просто seller
page.

· **Step 1.12.1 --- Storefront Domain & Backend Foundation**\
`PartnerStorefront (SF-*)`, lifecycle, slug, explicit provisioning,
own-scope API, public API, product scope, audit, concurrency.\
**Статус: APPROVED после REVIEW FIXES.**

· **Step 1.12.1A --- Storefront Commercial Model / Entitlement**\
Marketplace = бесплатное присутствие + transaction/platform commission.
Storefront = paid SaaS subscription/plan/entitlement.
`NONE / ACTIVE / SUSPENDED / EXPIRED`; public Storefront требует
lifecycle ACTIVE + entitlement ACTIVE. Billing позже становится
authoritative, Catalog entitlement --- projection/read state.
**Статус: APPROVED (реализовано в Step 1.12.1/1.12.2, ADR-0006, DD-003…DD-014).**

· **Step 1.12.1B --- Product Publication Channel Foundation**\
`ProductPublicationChannel`: `MARKETPLACE`, `PARTNER_STOREFRONT`.
Publication channel отделён от Product lifecycle и от будущего
acquisition/sales channel. Один Product может быть Marketplace-only,
Storefront-only, BOTH или ни в одном канале.
**Статус: APPROVED (реализовано в Step 1.12.1, REVIEW FIX 3/4; e2e storefront).**

· **Step 1.12.2 --- Partner Storefront Frontend, Business Identity &
Public Experience**\
`/partner/storefront`, `/store/:slug`, Storefront-owned business
identity, structured business contacts только в Storefront context,
logo/hero/branding, preview, entitlement UX, Product distribution UX,
RU/AZ/EN, SEO/accessibility baseline. Marketplace contact leakage = 0.\
**Статус: APPROVED после REVIEW FIXES (FIX 1 ValidationPipe, FIX 2 PDP metadata).**

· **Step 1.12.2A --- Storefront Business Identity Boundary**\
`PublicSellerProfile` остаётся Marketplace identity. Storefront получает
собственную business projection: businessName, tagline, description,
geography, structured contacts, branding. Raw CRM Partner не
публикуется.
**Статус: APPROVED (реализовано в Step 1.12.2; ADR-0006, ADR-0005 не затронута).**

· **Step 1.12.2B --- Storefront Contact Disclosure Policy**\
Storefront может показывать phone/email/website/WhatsApp/social links
как структурированные Storefront-owned поля при ACTIVE entitlement.
Product text не становится каналом для контактов. Marketplace
anti-disintermediation не ослабляется.
**Статус: APPROVED (реализовано в Step 1.12.2; Marketplace leakage = 0, e2e).**

· **Step 1.12.3 --- Storefront / Marketplace Channel & Analytics
Instrumentation Foundation**\
Стабильная instrumentation для `StorefrontViewed`,
`StorefrontProductImpression`, `StorefrontProductViewed`, Marketplace
behavioral events, anonymous/authenticated session context,
`occurredAt`, storefrontId/productId, source/channel, trace context.
Подготовить неизменяемую передачу будущего acquisition context, но не
создавать Order/Sale преждевременно.

· **Step 1.13 --- Buyer Cabinet Foundation**\
Свои будущие Orders/Bookings/Documents/Payments/Support read models;
безопасный BUYER own-scope. Без преждевременной Finance/Sales логики.
**Статус: APPROVED (e2e buyer-cabinet; own read models, controlled-empty, IDOR закрыт).**

· **Step 1.13A --- Temporal & Analytics Readiness Foundation**\
Аудит всех существующих models/tables на `createdAt`, `updatedAt`,
lifecycle timestamps и history/events. Добавить отсутствующие
`publishedAt`, `submittedAt`, `reviewStartedAt`, `approvedAt`,
`rejectedAt`, `archivedAt`, `cancelledAt`, `completedAt` там, где они
имеют реальный lifecycle-смысл. `updatedAt` не заменяет историю.
**Статус: APPROVED (temporal-readiness.md + e2e temporal-readiness; legacy NULL без фабрикаций).**

· **Step 1.13B --- Marketplace Behavioral Events Foundation**\
`MarketplaceViewed`, `SearchPerformed`, `CategoryViewed`,
`ProductImpression`, `ProductViewed`, `StorefrontViewed`; `occurredAt`,
actor/anonymousSession, entity context, source/channel, trace context.
**Статус: APPROVED (MarketplaceBehavioralEvent, ADR-0008; e2e marketplace-behavioral).**

· **Step 1.14 --- Canonical Order Events**\
`OrderReadyForBooking`, `OrderFulfilled`, `OrderClosed`,
cleanup/deprecation generic `OrderStatusChanged` там, где он подменяет
канонические события.\
**Статус: APPROVED (e2e order-canonical-events; generic `OrderStatusChanged` не подменяет канонические).**

· **Step 1.15 --- Correlation / Request ID Infrastructure**\
`correlationId`, `causationId`, HTTP request-id middleware, propagation
в events/audit/logs.\
**Статус: APPROVED (ADR-0009; request-context middleware + e2e; ALS без cross-request leak).**

· **Step 1.15A --- Business Event Temporal Contract**\
Event envelope: `eventId`, `eventType`, `occurredAt`, `correlationId`,
`causationId`, actor/system actor, `entityId`, source/channel,
version/metadata.
**Статус: APPROVED (ADR-0010; envelope + e2e business-event-envelope; occurredAt = createdAt, actor SYSTEM/USER/UNKNOWN).**

· **Step 1.16 --- Communication Foundation**\
`Communication = CML-*`, cross-domain communication model для
CRM/Order/Booking/Support вместо legacy message fragments.\
**Статус: APPROVED после STRICT REVIEW FIXES (ADR-0011; CML-*, participant↔context, 20-way concurrency).**

· **Step 1.17 --- Phase 1 Hardening / Security / Regression**\
Полный regression, RBAC/object-scope/IDOR, public/private boundaries,
pagination/filter/sort, error model, migration safety, observability,
performance/security; Partner/Seller/Storefront включены.\
**Статус: APPROVED после STRICT REVIEW FIXES (FIX 1 PARTNER internal-read revoke; RBAC staff-scope audit; PII redaction).**

· **Step 1.18 --- Phase 1 Exit Audit**\
GAP-анализ против актуального Master/Baseline, Phase 1 DoD,
ADR/migration/security debt, готовность к Phase 2.\
**Статус: не начат.**

· **Step 1.18A --- Phase 1 Analytics Readiness Gate**\
Доказать, что Product/Moderation/Partner/Buyer/Seller/Storefront имеют
достаточные timestamps/events/history. Не переходить в Phase 2 с
невосстановимой историей lifecycle transitions.

------------------------------------------------------------------------

# PHASE 2 --- CORE COMMERCIAL FLOW

**Цель:** Marketplace/Storefront → Sales → Order → Booking → Finance →
Documents.

· **Step 2.0 --- Phase 2 Entry Audit**\
Проверка Phase 1, migrations, RBAC, events, legacy endpoints и
готовности Sales/Order/Booking/Finance.

· **Step 2.1 --- Sales Domain Foundation**\
Lead `LED-*`, Opportunity `OPP-*`, Quote `QTE-*`, Sale `SAL-*`;
ownership/lifecycle.

· **Step 2.2 --- Sales Center Backend**\
API, queues, filters, KPI/read models, actions, audit, RBAC. Sales не
владеет Order/Booking logic.

· **Step 2.3 --- Quote & Commercial Offer Flow**\
Product/Tariff snapshot, price, discounts, currency, validity,
customer/travelers context.

· **Step 2.3A --- Checkout / Commercial Intent Foundation**\
Authoritative checkout context: Product/Tariff, travelers, options,
service date/time, payment terms, publication/acquisition context.
Frontend не источник цены.

· **Step 2.3B --- Payment Terms Foundation**\
`FULL_PREPAYMENT`, `PARTIAL_PREPAYMENT`, `DEPOSIT`, `PAY_LATER`,
`PAY_AT_SERVICE`. Partner выбирает только разрешённые платформой
схемы/параметры; Sale/Order хранит immutable financial snapshot.

· **Step 2.4 --- Sale Completion → OrderRequested**\
Sale публикует canonical `OrderRequested`; никаких прямых Sales writes в
Order tables.

· **Step 2.5 --- Order Creation Consumer**\
Order consumer создаёт `ORD-*`, пользовательский `TH-YYYY-######`,
OrderItems/OrderTraveler, публикует `OrderCreated`.

· **Step 2.5A --- Order Temporal Contract**\
`createdAt`, `submittedAt`, `confirmedAt`, `cancelledAt`, `fulfilledAt`,
`closedAt` по фактическим переходам. History/events сохраняют
`occurredAt`.

· **Step 2.5B --- Sales / Acquisition Channel Propagation**\
Неизменяемый transaction context минимум: `MARKETPLACE`,
`PARTNER_STOREFRONT`, позднее `PARTNER_CUSTOM_DOMAIN`, `API`,
`MANUAL/DIRECT`. Entry → Quote/Sale → Order → Booking → Payment →
Settlement → Analytics. Channel/source нельзя угадывать постфактум по
Product/URL.

· **Step 2.6 --- Remove Bootstrap Order Creation**\
Удалить временный `/orders/bootstrap`; обычный Order только canonical
flow.

· **Step 2.7 --- Order Lifecycle Completion**\
Backend lifecycle, stable codes, guards, history, SLA,
`OrderReadyForBooking`, `BookingRequested`, `OrderFulfilled`,
`OrderClosed`.

· **Step 2.8 --- BookingRequested → Booking Creation**\
Booking создаётся только по `BookingRequested`; связь OrderItem ↔
Booking без нарушения ownership.

· **Step 2.8A --- Booking Service Date / Time Model**\
Отдельно entity creation time и время услуги: `serviceStartsAt`,
`serviceEndsAt`, `serviceTimezone`; `DATE_ONLY`, `TIME_SLOT`,
`DATE_RANGE`, `OPEN_DATE`; capacity/slot reservation. IANA timezone.

· **Step 2.9 --- Booking Lifecycle Completion**\
Supplier processing, confirmation, clarification, rejection,
change/cancellation, fulfillment, обратные события Order.

· **Step 2.9A --- Booking Temporal Contract**\
`createdAt`, `requestedAt`, `confirmedAt`, `rejectedAt`, `cancelledAt`,
`completedAt`, history/SLA timestamps.

· **Step 2.10 --- Finance Domain Foundation**\
Finance владеет Payment `PAY-*`, PaymentTerms `PMT-*`, ProviderFee
`PFE-*`, Refund `RFD-*`, Invoice `INV-*`, Commission `CMS-*`,
CommissionAccrual `CAA-*`, Settlement `STL-*`, Payout `POT-*`,
LedgerTransaction `LTX-*`, Currency `CUR-*`, ExchangeRate `FXR-*`, Tax
`TAX-*`, TaxRule `TXR-*`.

· **Step 2.10A --- Financial Ledger Foundation**\
Append-only LedgerTransaction. Финансовая история не восстанавливается
из текущего Payment status.

· **Step 2.10B --- Settlement / Payout / Provider Fee Foundation**\
ProviderFee отдельно от TravelHub Commission. Settlement и Payout ---
разные сущности. Payment Buyer и Payout Partner --- разные rails.

· **Step 2.10C --- Finance Temporal Contract**\
Payment: `createdAt/authorizedAt/capturedAt/failedAt/cancelledAt`;
Refund: `requestedAt/approvedAt/processedAt/failedAt`; Settlement:
`createdAt/eligibleAt/calculatedAt/settledAt`; Payout:
`createdAt/scheduledAt/processingAt/paidAt/failedAt`; Ledger:
`occurredAt`.

· **Step 2.11 --- Pricing & Financial Snapshot**\
Immutable snapshot: base price, taxes, discounts, commission policy,
currency/exchange rate, PaymentTerms. Product price changes не меняют
оформленную сделку.

· **Step 2.12 --- Payment Flow**\
Payment intent/transaction lifecycle, связь с Order через Finance
contracts/events.

· **Step 2.12A --- Payment Provider Abstraction**\
Provider-agnostic adapters;
Stripe/Adyen/Mangopay/Checkout.com/Rapyd/банки не являются domain model.
Capability matrix по country/currency/rail.

· **Step 2.12B --- Buyer Card / Wallet Payment**\
Card, Apple Pay, Google Pay где поддерживается;
authorize/capture/fail/cancel, webhook signature, idempotency.

· **Step 2.12C --- SPLIT_AT_PAYMENT / Marketplace Commission**\
Предпочтительный режим при поддержке PSP:
`Buyer → PSP → Partner share + TravelHub fee`. Split должен быть
реальным native PSP split, не имитацией ledger-записью.

· **Step 2.12D --- PLATFORM_COLLECT Mode**\
Buyer платит platform-controlled rail → Ledger/Settlement → Payout
Partner.

· **Step 2.12E --- PARTNER_COLLECT / Post-Factum Commission**\
Buyer платит Partner → `CommissionAccrual` фиксирует долг Partner перед
TravelHub → settlement/invoice/collection.

· **Step 2.12F --- Partial Payments / Installments**\
Deposit, 30/70 и другие разрешённые схемы; каждый фактический платёж ---
отдельный Payment/allocation; paid/outstanding/due/due dates.

· **Step 2.12G --- PSP / Provider Fees**\
ProviderFee ≠ TravelHub Commission. Processing/FX/cross-border/payout
fees --- отдельные факты и политика распределения расходов.

· **Step 2.13 --- Refund Flow**\
Полный/частичный refund, reason, permission, audit/events; reverse
allocations вместо переписывания истории.

· **Step 2.13A --- Chargeback / Dispute Foundation**\
Dispute/chargeback, evidence, liability, ledger/commission/settlement
adjustments.

· **Step 2.14 --- Invoice / Commission Flow**\
Invoice lifecycle, platform/partner commission facts.

· **Step 2.14A --- Settlement Engine**\
Gross → ProviderFee → TravelHub Commission → Tax → Refund/Adjustments →
Partner Payable.

· **Step 2.14B --- Partner Payout Foundation**\
Payout lifecycle; bank transfer/local rail/SEPA/SWIFT по рынку.

· **Step 2.14C --- Partner Payout Account Foundation**\
Безопасная payout destination/token/reference; минимизация хранения
банковских секретов.

· **Step 2.14D --- Payment / Settlement / Payout Reconciliation**\
PSP transaction → Payment → Ledger → Commission → Settlement → Payout →
bank result.

· **Step 2.14E --- Channel-Based Commission Rules**\
Разные commission policies для Marketplace, Storefront, Custom Domain,
API/Manual. Никаких hardcoded ставок. Storefront SaaS subscription и
Marketplace commission --- разные механизмы.

· **Step 2.15 --- Documents Commercial Flow**\
Contract, invoice/receipt/voucher, immutable snapshots,
Order/Booking/Finance links.

· **Step 2.16 --- Commercial Flow E2E**\
`Product → Quote → Sale → OrderRequested → Order → BookingRequested → Booking → Payment → Documents → Fulfillment → OrderClosed`.

· **Step 2.16A --- Buyer Purchase Timeline**\
Chronological timeline из реальных events/timestamps: Order created,
Payment initiated/captured, Booking confirmed, service completed, refund
и др.

· **Step 2.16B --- Partner Sales Read Model**\
GMV, Orders, Bookings, products, average check, periods/categories,
Marketplace vs Storefront/Custom Domain.

· **Step 2.16C --- Partner Finance Read Model**\
Gross, paid, outstanding, TravelHub commission, ProviderFee, refund,
settlement, payout, net revenue, debt to TravelHub. Sales ≠ cash.

· **Step 2.17 --- Phase 2 Hardening**\
Idempotency, Outbox, retries, duplicate events, concurrency,
compensation, security, audit, performance.

· **Step 2.18 --- Phase 2 Exit Audit**\
Сверка с Master/Baseline и DoD.

· **Step 2.18A --- Financial Integrity Exit Gate**\
Monetary precision, webhook replay, duplicate capture/refund, ledger
balance, settlement reconciliation, temporal integrity.

------------------------------------------------------------------------

# PHASE 3 --- COMPLETE PLATFORM

## Управление и аналитика

· **Step 3.0 --- Phase 3 Entry Audit**

· **Step 3.1 --- Dashboard / Command Center Backend**\
Aggregated KPI/read models без владения operational entities.

· **Step 3.2 --- Dashboard UI**\
KPI, alerts, queues, shortcuts, AI insights.

· **Step 3.3 --- Analytics Foundation**\
Metrics, dimensions, aggregation/read models.

· **Step 3.3A --- Analytics Source-of-Truth & Fact Model**\
Business entities + lifecycle timestamps + canonical events + behavioral
events + financial ledger + audit/history. Current status/updatedAt
недостаточны.

· **Step 3.3B --- Canonical KPI Dictionary**\
GMV, Revenue, Net Revenue, Commission, Conversion, Cancellation Rate,
Refund Rate, Booking Confirmation Time, Payment Conversion, Partner SLA
и др.

· **Step 3.3C --- Marketplace Conversion Funnel**\
`ProductImpression → ProductViewed → CheckoutStarted → OrderCreated → PaymentSucceeded → BookingConfirmed → ServiceCompleted`.

· **Step 3.3D --- Attribution Analytics**\
Marketplace / Partner Storefront / Custom Domain / API / Manual/Direct,
campaign/source, Partner/Product/category.

· **Step 3.4 --- Analytics Center UI**\
Sales, Orders, Bookings, Finance, Products, Partners,
Marketplace/Storefront performance.

· **Step 3.4A --- Time-Based Analytics**\
По часу/дню/неделе/месяцу/сезону; lead time, confirmation time,
processing time, payout delay; Product publication, Order creation,
Booking request/confirm, Payment capture, Refund, Settlement/Payout.

## CRM

· **Step 3.5 --- CRM Completion**\
Customer `CUS-*`, Contact `CNT-*`, Company `COM-*`, Partner `PAR-*`,
Supplier `SUP-*`.

· **Step 3.5A --- Partner CRM Foundation --- NEW CANONICAL
REQUIREMENT**\
Paid Storefront получает отдельный Partner-scoped CRM, не внутренний
`/app/crm`. Возможности: customers, leads, notes, tags,
lifecycle/stages, tasks/reminders, communication history, permitted
documents, repeat-customer history, segmentation, assigned manager/team,
acquisition source, CRM analytics. Marketplace-only Partner получает
только необходимые Marketplace operational customer/order/booking views
согласно entitlement/policy.

· **Step 3.5B --- Customer Identity ↔ Partner CRM Relationship**\
Глобальная TravelHub Customer identity и Partner-specific CRM
relationship --- разные сущности/понятия. Ввести
`PartnerCustomerRelationship` или архитектурный эквивалент. Один
Customer может иметь отношения с несколькими Partner. Partner-specific
notes/tags/lifecycle/lead status/manager/tasks/source/history не
являются глобальными Customer fields. Strict tenant/object isolation:
Partner A не видит Partner B relationship data.

· **Step 3.5C --- Partner CRM Lead & Direct Customer Intake**\
Storefront/phone/office/manual/direct lead intake; возможность Partner
создавать CRM lead/customer relationship без создания дубликата
глобальной identity. Source минимум Storefront/Direct/Manual CRM, с
безопасным matching/dedup policy.

· **Step 3.5D --- Partner CRM Entitlement & Capability Model**\
CRM capabilities зависят от Storefront SaaS plan/entitlement. Не
связывать доступ только с наличием Storefront record. Подготовить
Basic/Pro/Business capability matrix без hardcoded commercial prices.

· **Step 3.5E --- Partner CRM Analytics Read Model**\
Leads, conversion, repeat rate, LTV, segments, acquisition source,
manager/team performance, Marketplace vs Storefront vs Direct --- только
из canonical facts/events/timestamps.

· **Step 3.6 --- CRM Center UI**\
Internal TravelHub 360° customer/partner/company view, history,
relations, activities.

· **Step 3.6A --- Partner CRM UI**\
Отдельный `/partner/*` CRM workspace; никогда не выдавать PARTNER
внутренний `/app/crm`.

· **Step 3.7 --- Communication Integration**\
`CML-*`, email/message/contact history, CRM/Sales/Order/Support links.

## Marketing

· **Step 3.8 --- Marketing Domain**\
Campaign, audience, channel, attribution, lifecycle.

· **Step 3.9 --- Marketing Center UI**

## Support

· **Step 3.10 --- Support Domain**\
Ticket/Case, priority, SLA, assignment, escalation.

· **Step 3.11 --- Support Center UI**\
Customer/Order/Booking context без ownership transfer.

## Users & Security

· **Step 3.12 --- Users & Access Completion**\
Roles, permissions, lifecycle, sessions, Partner/Buyer accounts.

· **Step 3.12A --- Partner Multi-User Teams**\
Partner owner/admin/manager/content/finance/support roles, invitations,
granular partner-scoped permissions.

· **Step 3.12B --- Partner KYC/KYB Foundation**\
Business verification/legal/compliance.

· **Step 3.12C --- Partner Payment Capability**\
`canSell`, `canAcceptPayments`, `canReceivePayouts`; Marketplace
approval ≠ payout-ready.

· **Step 3.12D --- Notifications Foundation**\
Email/SMS/in-app events, templates, preferences, retry/delivery.

· **Step 3.12E --- Organization Capability & Navigation Access Model**\
Зафиксировано в Step 2.2 (Sales Center review): роли = permission presets,
не постоянные organizational job boundaries. Один internal user архитектурно
может совмещать capabilities нескольких work centers (Customers/Sales/Suppliers/
Orders/Bookings/Communications/Finance) — особенно для малых организаций.
Backend authority — permission/capability-based (системные роли — пресеты),
per-user capability assignment поддерживается архитектурно (permissions
независимы от role names; DB-маппинг user→permission возможен без правки
доменного кода; guards проверяют permissions). Sidebar/navigation —
permission-driven (backend authoritative; скрытие меню ≠ security).
Admin UI управления ролями/капабилити — в Step 3.13 Users & Access Center UI.

· **Step 3.13 --- Users & Access Center UI**

· **Step 3.14 --- Security Hardening**\
Rate limiting, session/token security, object-scope audit, sensitive
operations/security events.

## Documents

· **Step 3.15 --- Documents Domain Completion**\
Document/Template/Voucher, versioning, storage, generation, permissions.

· **Step 3.16 --- Documents Center UI**

## Calendar

· **Step 3.17 --- Calendar Domain**\
Events/tasks/deadlines, Order/Booking/Sales/Support references.

· **Step 3.18 --- Calendar Center UI**

## Reports

· **Step 3.19 --- Reports Domain**\
Definitions, parameters, schedules, exports.

· **Step 3.19A --- Scheduled Partner / Buyer Reports**\
Только canonical read models/facts/timestamps.

· **Step 3.20 --- Reports Center UI**

## Integrations

· **Step 3.21 --- Integration Platform**\
Connector model, credentials/secrets abstraction, inbound/outbound
integrations.

· **Step 3.21A --- PSP Integration Management**\
Multiple PSP, capabilities/countries/currencies/status/credentials.

· **Step 3.21B --- Banking / Payout Rail Integrations**\
Bank transfer/local rails/SEPA/SWIFT abstraction.

· **Step 3.22 --- Webhooks & External API**\
Signing, retries, idempotency, rate limits, delivery log.

· **Step 3.22A --- Financial Webhook Inbox**\
Durable ingestion, signature verification, idempotency,
replay/reconciliation.

· **Step 3.23 --- Integrations Center UI**

## AI

· **Step 3.24 --- AI Center Foundation**\
Recommendations, insights, risk detection, assistance contracts.

· **Step 3.24A --- AI Catalog Assistance**\
Descriptions, attributes, classification, quality; Partner confirms.

· **Step 3.24B --- AI Translation Pipeline**\
RU/AZ/EN stored/versioned translations с fallback/moderation вместо
uncontrolled live translation.

· **Step 3.24C --- AI Moderation Assistance**\
Text/image/QR/contact detection; human moderator remains authoritative.

· **Step 3.24D --- Recommendation Foundation**\
Ranking/recommendations после реальных behavioral data.

· **Step 3.25 --- AI Governance**\
No autonomous critical actions; permissions/audit/human approval.

· **Step 3.26 --- AI Center UI**

## System & Settings

· **Step 3.27 --- System Center**\
Health, queues, jobs, events, errors, audit, diagnostics.

· **Step 3.28 --- Settings Center**\
Organization/localization/business policies/references. Currency/Tax
остаются Finance-owned.

## Marketplace / Storefront completion

· **Step 3.29 --- Partner Cabinet Full**\
Products/media/tariffs/availability/moderation + permitted
sales/orders/bookings/finance views.

· **Step 3.29A --- Partner Storefront Advanced**\
Themes, configurable sections, richer branding/navigation/settings.

· **Step 3.29B --- Partner Subdomain Foundation**\
`partner.travelhub.com`, tenant resolution, routing/security.

· **Step 3.29C --- Partner Custom Domain Foundation**\
DNS verification, TLS/CDN/provisioning.

· **Step 3.29D --- Storefront SaaS Plans / Entitlements**\
Configurable plans (working labels may be START/BUSINESS/PRO): product
limits, branding, custom domain, analytics, Partner CRM and other
feature entitlements. Prices are commercial configuration, not hardcoded
architecture.

· **Step 3.29E --- Storefront Analytics**\
Marketplace vs Storefront vs Custom Domain traffic/sales, views,
conversion, GMV, commission, net revenue; Storefront SaaS value metrics.

· **Step 3.29F --- Partner Sales Dashboard Full**\
Sales/products/categories/periods/channels/funnel/conversion.

· **Step 3.29G --- Partner Finance Dashboard Full**\
Payments, commissions, ProviderFees, refunds, settlements, payouts,
balances, net revenue.

· **Step 3.29H --- Storefront Business Tools Integration**\
Связать Storefront с Partner CRM, leads, tasks, communications,
analytics и future marketing automation без смешения с Marketplace
identity/disclosure.

· **Step 3.30 --- Buyer Cabinet Full**\
Profile, Orders, Bookings, Payments, Documents, Support.

· **Step 3.30A --- Buyer Purchase History Full**\
Order/Booking/Payment/Refund/Document/Support + chronological timeline.

· **Step 3.31 --- Marketplace Checkout**\
Service/tariff/date/travelers → commercial flow; frontend не создаёт
Booking напрямую.

· **Step 3.32 --- Marketplace Search & Discovery**\
Full-text, category filters, sort/pagination, availability/price.

· **Step 3.33 --- Product Detail Page Full**\
Description/gallery/price/tariffs/availability/terms/seller/CTA.

· **Step 3.34 --- Reviews & Ratings**\
Ownership, eligibility, moderation, rating aggregation.

· **Step 3.34A --- Verified Purchase Review Eligibility**\
Только BUYER с eligible/completed Booking/Order.

· **Step 3.34B --- Seller Rating Aggregation**\
Product rating и Seller rating отдельно.

· **Step 3.35 --- Marketplace SEO / Localization**\
RU/AZ/EN metadata, canonical URLs, sitemap, structured data.

## Moderation / Communication

· **Step 3.36 --- Moderation Center Full**\
Queues/SLA/filters/Product versions/decisions/history/workload/KPI.

· **Step 3.37 --- Extended Content Moderation**\
Product text/media/reviews/future objects.

· **Step 3.37A --- Communication / Chat Completion**\
Buyer↔Partner messaging с Order/Booking context, attachments, audit.

· **Step 3.37B --- Chat Anti-Disintermediation**\
Detect/flag/block contact/external booking attempts до разрешённого
disclosure stage.

· **Step 3.37C --- Post-Purchase Contact Disclosure Policy**\
Когда BUYER получает operational/contact/legal Partner data по
Order/Payment/Booking/service type.

## Legacy reconciliation

· **Step 3.38 --- Legacy Payout Resolution**

· **Step 3.39 --- Legacy Chat Resolution**

· **Step 3.40 --- Legacy TourMedia Resolution**

· **Step 3.41 --- StripeEvent Resolution**\
Перевести legacy provider-specific event в Finance/Integration webhook
architecture.

## Production

· **Step 3.42 --- Performance & Scalability**\
Indexes/query plans/cache/queues/media/CDN/pagination/load.

· **Step 3.42A --- Public Marketplace Load Test**\
Catalog/search/PDP/media/storefront.

· **Step 3.42B --- Checkout / Payment Concurrency Load Test**\
Duplicate checkout/payment/webhook/refund/booking races.

· **Step 3.43 --- Observability**\
Structured logs, metrics, traces, correlation/causation, alerts.

· **Step 3.44 --- Backup / Recovery / Operations**\
PostgreSQL/object storage restore, migration recovery.

· **Step 3.44A --- Disaster Recovery Drill**\
RPO/RTO validation.

· **Step 3.45 --- Production Security Audit**

· **Step 3.45A --- Privacy / Data Retention Audit**\
Retention/anonymization/deletion, financial/document/audit preservation,
personal/contact/payment data.

· **Step 3.45B --- Payment Security Audit**\
Secrets, webhook signatures, PCI boundary, payment exposure, payout
access, Finance RBAC.

· **Step 3.46 --- Complete Platform E2E**\
`PARTNER → Product → Media → Moderation → Marketplace/Storefront → BUYER → Sale/Checkout → Order → Booking → Payment → Documents → Fulfillment → Support/Review`.

· **Step 3.46A --- Full Money Journey E2E**\
`BUYER → Checkout → Order → Payment → Split/Platform Collect/Partner Collect → Booking → Service → Commission → Settlement → Partner Payout/Receivable`.

· **Step 3.46B --- Refund / Dispute Journey E2E**\
Refund/commission reversal/settlement/payout adjustments +
chargeback/dispute ledger.

· **Step 3.46C --- Storefront Journey E2E**\
`PARTNER → Storefront → Product → BUYER → Checkout → Order → Payment → Booking`
с доказанным Storefront acquisition attribution.

· **Step 3.46D --- Storefront CRM Journey E2E --- NEW**\
`Storefront visitor/direct lead → Partner CRM relationship → Quote/Sale → Order/Booking/Payment → repeat customer/analytics`
с tenant isolation и сохранённым acquisition source.

· **Step 3.47 --- Final Architecture Audit**\
Все центры/домены, IDs, RBAC, events, ownership, lifecycle, API/UI vs
Master/Baseline.

· **Step 3.48 --- Production Release Candidate**

· **Step 3.49 --- Production Readiness / Final DoD**

· **Step 3.49A --- Financial Reconciliation Go-Live Gate**\
`PSP ↔ Payments ↔ Ledger ↔ Commissions ↔ Refunds ↔ Settlements ↔ Payouts`.

· **Step 3.49B --- Temporal / Analytics Go-Live Gate**\
Восстанавливается фактическая хронология: Product published → viewed →
Checkout → Sale/Order → Payment → Booking → Service → Settlement →
Payout с actor/source/channel/trace.

· **Step 3.49C --- Partner Tenant Isolation Go-Live Gate --- NEW**\
Storefront/Partner CRM/Partner teams/finance/sales/customer
relationships проходят cross-tenant IDOR/privacy audit; ни один Partner
не получает данные другого Partner.

------------------------------------------------------------------------

# ОБЯЗАТЕЛЬНЫЕ СКВОЗНЫЕ ТРЕБОВАНИЯ

Каждое существенное business action должно отвечать:

-   **WHAT** --- что произошло;
-   **WHEN** --- когда;
-   **WHO** --- кто;
-   **ENTITY** --- с каким объектом;
-   **CHANNEL/SOURCE** --- Marketplace / Storefront / Custom Domain /
    API / Manual / Direct;
-   **CONTEXT** --- Product / Sale / Order / Booking / Payment /
    Customer Relationship / ...;
-   **TRACE** --- requestId / correlationId / causationId.

## Temporal / Date-Time

-   `createdAt` = время создания entity.
-   `updatedAt` не заменяет lifecycle history.
-   Каждый существенный lifecycle transition имеет собственный timestamp
    или immutable history/event.
-   Events/history имеют `occurredAt`.
-   System timestamps хранятся в UTC.
-   Время туристической услуги отделено от времени создания
    Booking/Order.
-   Service timezone хранится как IANA timezone.
-   Product publication/moderation timestamps сохраняются.
-   Order creation/submission/confirmation/fulfillment/closure
    timestamps сохраняются.
-   Booking request/confirmation/rejection/cancellation/completion
    timestamps сохраняются.
-   Payment authorization/capture/failure/cancellation timestamps
    сохраняются.
-   Refund/Settlement/Payout timestamps сохраняются.
-   Исторические timestamps не перезаписываются для «удобства».

## Traceability

-   requestId → command → event → outbox → consumer → audit/log.
-   correlationId/causationId обязательны для cross-domain flows.
-   Retry/duplicate delivery не создают duplicate business facts.

## Publication vs Acquisition

-   Publication channel отвечает «где Product показан».
-   Acquisition/sales channel отвечает «откуда пришла конкретная
    коммерческая операция».
-   Эти понятия не смешиваются.
-   Acquisition source фиксируется при входе в commercial context и
    переносится неизменяемо.
-   Нельзя вычислять source постфактум по текущему Product, Storefront
    status или URL.

## Analytics readiness

-   KPI строятся из canonical facts/events/timestamps/ledger.
-   Behavioral events ≠ business events ≠ AuditLog.
-   Нельзя восстанавливать аналитику только по current status/updatedAt.
-   Marketplace, Storefront, Direct и будущие Custom Domain/API должны
    быть сравнимы по attribution.

## Auditability

Для Product, Moderation, Partner, Buyer, Customer Relationship, Sale,
Order, Booking, Payment, Refund, Settlement, Payout и других критических
объектов должна восстанавливаться история:
`что → когда → кто → объект → source/channel → trace`.

## Security / Ownership

-   Каждый домен пишет только в owned schema, кроме явно утверждённых
    ADR orchestration scenarios.
-   Public DTO никогда не сериализует raw internal ORM/entity.
-   Object scope enforced backend-side.
-   PARTNER/BUYER/internal roles не смешиваются.
-   Partner CRM строго tenant-scoped.
-   `/app/crm` --- внутренний CRM TravelHub; Partner CRM --- отдельный
    контур.
-   Partner A никогда не видит Partner B CRM
    notes/tags/tasks/relationships/finance/private data.

## Customer / Partner CRM

-   Global Customer identity ≠ Partner-specific CRM relationship.
-   Один Customer может взаимодействовать с несколькими Partner.
-   Partner-specific metadata живёт в relationship/context, а не
    глобально на Customer без основания.
-   Manual/direct lead intake не должен бесконтрольно создавать
    duplicate global Customers.
-   Storefront SaaS entitlement определяет расширенные CRM capabilities.

## Money

-   Safe monetary precision.
-   ProviderFee ≠ TravelHub Commission.
-   Sales ≠ cash received.
-   Payment ≠ Payout.
-   Settlement ≠ Payout.
-   Refund/chargeback/FX/provider adjustment/payout reversal ---
    отдельные immutable financial facts.
-   Ledger append-only.
-   `SPLIT_AT_PAYMENT`, `PLATFORM_COLLECT`, `PARTNER_COLLECT` ---
    поддерживаемые settlement modes.
-   Native PSP split обязателен для заявления фактического split.
-   PARTNER_COLLECT создаёт receivable/CommissionAccrual, а не фиктивный
    split.
-   Partner может задавать только разрешённые PaymentTerms.
-   Partial payment = несколько фактических Payment/allocation records.
-   Комиссии PSP и банков учитываются отдельно и входят в аналитику/net
    revenue.

## Marketplace / Storefront SaaS

-   Один Catalog.Product может участвовать в нескольких publication
    channels.
-   Product не дублируется для Storefront.
-   Marketplace seller identity защищена anti-disintermediation policy.
-   Marketplace Partner: commission model + базовый operational
    cabinet/analytics.
-   Storefront Partner: paid SaaS + собственный сайт/business
    identity/structured contacts + расширенная analytics + будущий
    Partner CRM/business tools.
-   Storefront subscription fee и Marketplace transaction commission ---
    разные коммерческие механизмы.
-   Наличие Storefront не должно раскрывать contacts в Marketplace.
-   Storefront business identity не становится автоматически Marketplace
    identity.
-   Custom domain в будущем остаётся тем же Storefront tenant/channel, а
    не новым Product domain.

------------------------------------------------------------------------

# CANONICAL STATUS

Этот Master Plan является **канонической версией v3**.

Правила дальнейшего изменения:

1.  Существующие Step не удаляются.
2.  Существующие Step не перенумеровываются из-за новых требований.
3.  Новые требования добавляются `Step X.YA / X.YB / ...` либо
    clarification/review-fix.
4.  Каждый implementation prompt сверяется с этим Master Plan.
5.  Каждый Exit Audit проверяет не только current-state, но
    timestamps/events/history, attribution, ownership, tenant isolation
    и financial integrity.
6.  После утверждения нового архитектурного решения этот файл должен
    обновляться, чтобы решение не оставалось только в переписке.
