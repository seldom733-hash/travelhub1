# TravelHub — CANONICAL IMPLEMENTATION ROADMAP v2

**Статус документа:** канонический roadmap на хранение  
**Принцип:** исходные Step из базового roadmap не удаляются и не перенумеровываются. Новые решения добавляются как `A/B/C...` подшаги.  
**Использование:** этот файл является источником истины для planning, implementation prompts, review-fixes, exit audits и Go-Live readiness.

---

# PHASE 1 — FOUNDATION, MARKETPLACE, IDENTITY & PLATFORM BASE

· **Step 1.0 — E2E Test Database Isolation**  
Изолированная PostgreSQL test DB, реальные migrations, guards от destructive-run, воспроизводимый e2e.  
**Статус: APPROVED.**

· **Step 1.1 — Category Schema Foundation**  
Универсальный Catalog.Product, category schema, category-specific attributes/filters/availability/tariff/media/PDP configuration.  
**Статус: APPROVED.**

· **Step 1.2 — Product Media Foundation**  
ProductMedia, S3-compatible storage, MinIO, Sharp, original/large/thumb, private-by-default, media API, test bucket isolation.  
**Статус: APPROVED после review-fixes.**

· **Step 1.3 — Product Ownership & PARTNER Object Scope**  
Product.partnerId, server-side scope, IDOR protection, PARTNER only-own access, ProductMedia ownership inheritance, MODERATOR read-only.  
**Статус: APPROVED после review-fixes.**

· **Step 1.4 — Moderation Workflow**  
submit → review → approve / reject / request changes, moderation queue, snapshot/version review, controlled publish, полноценный change proposal для PUBLISHED Product, запрет MODERATOR менять Product за PARTNER, repeat moderation after material changes.  
**Статус: APPROVED после review-fixes.**

· **Step 1.5 — Public Catalog Read Foundation**  
Anonymous API только для published Product/media, public search/category/list/PDP backend contracts, stable media delivery, server-side filtering/sorting/pagination, отсутствие утечки draft/internal данных.  
**Статус: APPROVED после review-fixes.**

· **Step 1.6 — Public Marketplace Routing & Frontend Split**  
`/` → Public Marketplace, `/products/:slug` → PDP, `/app/*` → внутренние центры, разделение Public и Internal layouts/API boundaries, role-aware routing.  
**Статус: APPROVED.**

· **Step 1.7 — Public Marketplace Home / Search / Category / PDP**  
Витрина, карточки услуг, цены, краткое описание, динамические фильтры, категории, PDP, media gallery, tariffs/options/availability, RU/AZ/EN.  
**Статус: APPROVED.**

· **Step 1.8 — Partner Cabinet Foundation**  
Кабинет PARTNER: свои Product, создание/редактирование, dynamic Category Schema form, attributes, tariffs, availability, media, submit to moderation, moderation feedback. Partner-safe Active Category Schema contract.  
**Статус: APPROVED.**

· **Step 1.9 — Buyer Identity / Public-to-Authenticated Transition**  
Регистрация/login BUYER, обязательный Buyer ↔ CRM Customer mapping, own account/profile, public-to-authenticated transition, подготовка Buyer Cabinet. ADR-0003 для узкой Security ↔ CRM orchestration.  
**Статус: APPROVED после review-fixes.**

· **Step 1.10 — Partner Registration & Onboarding**  
Public registration PARTNER, PartnerApplication lifecycle, internal review queue, approve/reject/request changes, CRM Partner create/link, controlled `User.partnerId`, запрет selling access до approval, Partner Cabinet activation. ADR-0004 для approve orchestration.  
**Статус: APPROVED.**

· **Step 1.11 — Public Seller Identity & Anti-Disintermediation**  
Разделение CRM Partner Identity и Marketplace Public Seller Identity, `PublicSellerProfile`, ANONYMOUS / VERIFIED_ALIAS / PUBLIC_BRAND, moderator-controlled visibility, seller-safe Card/PDP projection, защита от утечки контактов и попыток продажи в обход TravelHub.  
**Статус: выполнен, закрываются review-fixes перед APPROVAL.**

· **Step 1.12 — Partner Storefront Foundation**  
Персональная витрина/мини-сайт PARTNER на инфраструктуре TravelHub: branding, собственный каталог опубликованных Product, RU/AZ/EN, storefront public contract, URL вида `/store/:slug`, архитектурная подготовка subdomain/custom domain. Один Product используется одновременно Marketplace и Storefront без дублирования.  
**Статус: следующий после APPROVAL Step 1.11.**

· **Step 1.12A — Storefront Sales Channel Foundation**  
Ввести канонический источник продажи минимум `MARKETPLACE` / `PARTNER_STOREFRONT`; подготовить propagation в будущий Checkout/Order/Payment/Analytics. Источник нельзя вычислять постфактум по URL или Product.

· **Step 1.12B — Storefront Identity & Disclosure Policy**  
Marketplace использует seller-safe `PublicSellerProfile`; Storefront получает отдельную controlled disclosure policy. CRM/private Partner data не публикуются автоматически.

· **Step 1.12C — Storefront Analytics Instrumentation Foundation**  
События `StorefrontViewed`, `StorefrontProductImpression`, `StorefrontProductViewed`, anonymous/authenticated visitor context, `occurredAt`, storefrontId/productId, channel/source.

· **Step 1.13 — Buyer Cabinet Foundation**  
Свои будущие Orders/Bookings/Documents/Payments/Support read models; личный кабинет BUYER и безопасный own-scope. Пока без преждевременной реализации Finance/Sales логики.  
**Статус: не начат.**

· **Step 1.13A — Temporal & Analytics Readiness Foundation**  
Аудит всех существующих Prisma models/tables на `createdAt`, `updatedAt`, business lifecycle timestamps и history/events. Добавить отсутствующие `publishedAt`, `submittedAt`, `reviewStartedAt`, `approvedAt`, `rejectedAt`, `archivedAt`, `cancelledAt`, `completedAt` и другие бизнес-времена только там, где они имеют реальный lifecycle-смысл.  
Правила: `createdAt ≠ occurredAt`, `updatedAt ≠ lifecycle history`; системные timestamps UTC; время туристической услуги в будущем хранится с IANA timezone.

· **Step 1.13B — Marketplace Behavioral Events Foundation**  
Canonical instrumentation: `MarketplaceViewed`, `SearchPerformed`, `CategoryViewed`, `ProductImpression`, `ProductViewed`, `StorefrontViewed`. Для каждого: `occurredAt`, actor/anonymousSession, entity context, source/channel, trace context.

· **Step 1.14 — Canonical Order Events**  
`OrderReadyForBooking`, `OrderFulfilled`, `OrderClosed`, cleanup/deprecation generic `OrderStatusChanged` там, где он подменяет канонические события. Подготовка надёжного взаимодействия Order с Booking и другими доменами.  
**Статус: не начат.**

· **Step 1.15 — Correlation / Request ID Infrastructure**  
`correlationId`, `causationId`, HTTP request-id middleware, propagation в events/audit/logs и сквозная трассировка операций между доменами.  
**Статус: не начат.**

· **Step 1.15A — Business Event Temporal Contract**  
Обязательный event envelope: `eventId`, `eventType`, `occurredAt`, `correlationId`, `causationId`, actor/system actor, `entityId`, `source/channel`, version/metadata where applicable.

· **Step 1.16 — Communication Foundation**  
`Communication = CML-*`, базовый cross-domain communication model для CRM/Order/Booking/Support вместо legacy message fragments.  
**Статус: не начат.**

· **Step 1.17 — Phase 1 Hardening / Security / Regression**  
Полный regression, RBAC/object-scope/IDOR review, public/private boundaries, pagination/filter/sort consistency, error model, migration safety, observability, performance и security checks. Включает проверку новых Partner/Seller/Storefront контуров.  
**Статус: не начат.**

· **Step 1.18 — Phase 1 Exit Audit**  
Повторный GAP-анализ против актуального Master/Baseline, подтверждение Phase 1 DoD, проверка ADR, migration debt, security debt, незакрытых архитектурных решений и готовности к Phase 2.  
**Статус: не начат.**

· **Step 1.18A — Phase 1 Analytics Readiness Gate**  
Доказать, что Product/Moderation/Partner/Buyer/Seller/Storefront данные пригодны для Analytics и все необходимые исторические timestamps/events присутствуют. Запрещается переходить в Phase 2 с невосстановимой историей критичных lifecycle transitions.

---

# PHASE 2 — CORE COMMERCIAL FLOW

**Цель Phase 2:** Marketplace → Sales → Order → Booking → Finance → Documents

· **Step 2.0 — Phase 2 Entry Audit**  
Проверка результатов Phase 1, migrations, RBAC, событий, legacy endpoints и готовности Sales/Order/Booking/Finance.

· **Step 2.1 — Sales Domain Foundation**  
Канонические Lead, Opportunity, Quote, Sale; ID `LED-* / OPP-* / QTE-* / SAL-*`; ownership и lifecycle.

· **Step 2.2 — Sales Center Backend**  
API, очереди, фильтры, KPI/read models, actions, audit, RBAC. Sales не содержит Order/Booking logic.

· **Step 2.3 — Quote & Commercial Offer Flow**  
Состав предложения, Product/Tariff snapshot, цена, скидки, валюта, сроки действия, customer/travelers context.

· **Step 2.3A — Checkout / Commercial Intent Foundation**  
Authoritative checkout context: Product/Tariff, travelers, options, service date/time, payment terms, channel/source. Frontend не является источником цены.

· **Step 2.3B — Payment Terms Foundation**  
`FULL_PREPAYMENT`, `PARTIAL_PREPAYMENT`, `DEPOSIT`, `PAY_LATER`, `PAY_AT_SERVICE`; Partner выбирает из разрешённых TravelHub схем и задаёт параметры.

· **Step 2.4 — Sale Completion → OrderRequested**  
Завершённая Sale публикует каноническое `OrderRequested`. Никаких прямых записей Sales → Order tables.

· **Step 2.5 — Order Creation Consumer**  
Order принимает `OrderRequested`, создаёт собственный `ORD-*`, пользовательский номер `TH-YYYY-######`, OrderItems/OrderTraveler и публикует `OrderCreated`.

· **Step 2.5A — Order Temporal Contract**  
Канонические business timestamps: `createdAt`, `submittedAt`, `confirmedAt`, `cancelledAt`, `fulfilledAt`, `closedAt` — только по фактическим lifecycle transitions. `updatedAt` не заменяет историю.

· **Step 2.5B — Sales Channel Propagation**  
Канонический `salesChannel`: `MARKETPLACE`, `PARTNER_STOREFRONT`, `PARTNER_CUSTOM_DOMAIN`, `API`, `MANUAL`. Неизменяемая propagation: Entry → Quote/Sale → Order → Booking → Payment → Settlement → Analytics.

· **Step 2.6 — Remove Bootstrap Order Creation**  
Удаление/закрытие временного `/orders/bootstrap`. После этого обычный Order создаётся только canonical flow.

· **Step 2.7 — Order Lifecycle Completion**  
Полный backend lifecycle Order, стабильные backend codes, guards, history, SLA и события `OrderReadyForBooking`, `BookingRequested`, `OrderFulfilled`, `OrderClosed`.

· **Step 2.8 — BookingRequested → Booking Creation**  
Booking создаётся только по `BookingRequested`, а не по `OrderApproved`. Связь OrderItem ↔ Booking без нарушения domain ownership.

· **Step 2.8A — Booking Service Date / Time Model**  
Хранить отдельно время создания Booking и время самой услуги: `serviceStartsAt`, `serviceEndsAt`, `serviceTimezone`; модели `DATE_ONLY`, `TIME_SLOT`, `DATE_RANGE`, `OPEN_DATE`; capacity/slot reservation.

· **Step 2.9 — Booking Lifecycle Completion**  
Supplier processing, confirmation, clarification, rejection, change/cancellation requests, fulfillment и обратные события Order.

· **Step 2.9A — Booking Temporal Contract**  
`createdAt`, `requestedAt`, `confirmedAt`, `rejectedAt`, `cancelledAt`, `completedAt`, history переходов и SLA timestamps.

· **Step 2.10 — Finance Domain Foundation**  
Payment `PAY-*`, Refund `RFD-*`, Invoice `INV-*`, Commission `CMS-*`, Currency `CUR-*`, ExchangeRate `FXR-*`, Tax `TAX-*`, TaxRule `TXR-*`.

· **Step 2.10A — Financial Ledger Foundation**  
Append-only `LedgerTransaction`; финансовая история не восстанавливается только из текущих статусов.

· **Step 2.10B — Settlement / Payout / Provider Fee Foundation**  
Finance-owned `ProviderFee`, `Settlement`, `Payout`, `CommissionAccrual`, `LedgerTransaction`. Legacy Payout не объявлять каноническим без Step 3.38 reconciliation.

· **Step 2.10C — Finance Temporal Contract**  
Payment: `createdAt/authorizedAt/capturedAt/failedAt/cancelledAt`; Refund: `requestedAt/approvedAt/processedAt/failedAt`; Settlement: `createdAt/eligibleAt/calculatedAt/settledAt`; Payout: `createdAt/scheduledAt/processingAt/paidAt/failedAt`; Ledger: `occurredAt`.

· **Step 2.11 — Pricing & Financial Snapshot**  
Фиксация цены сделки/заказа: base price, taxes, discount, commission, currency/exchange rate. Изменение Product price не изменяет уже оформленный Order.

· **Step 2.12 — Payment Flow**  
Payment intent/transaction lifecycle, связь с Order без передачи ownership Finance-сущностей Order Center.

· **Step 2.12A — Payment Provider Abstraction**  
Provider-agnostic `PaymentProvider`; Finance не зависит напрямую от Stripe/Adyen/другого PSP.

· **Step 2.12B — Buyer Card Payment**  
Card/Apple Pay/Google Pay через PSP; authorize/capture/fail/cancel, webhook verification, idempotency.

· **Step 2.12C — Split Payment / Marketplace Commission**  
Предпочтительный flow: `Buyer → PSP → Partner share + TravelHub commission`, когда marketplace split поддерживается PSP/рынком.

· **Step 2.12D — Platform Collect Mode**  
`Buyer → platform-controlled payment → Ledger/Settlement → Payout Partner`.

· **Step 2.12E — Partner Collect / Post-Factum Commission Mode**  
`Buyer → Partner → CommissionAccrual → Partner owes TravelHub`; reconciliation/invoice.

· **Step 2.12F — Partial Payments / Installments**  
Deposit, 30/70 и другие схемы; несколько Payment на один Order/Booking; paid/outstanding/due amounts и due dates.

· **Step 2.12G — PSP / Provider Fees**  
ProviderFee отдельно от TravelHub Commission; processing, FX, cross-border, payout fees учитываются как отдельные факты.

· **Step 2.13 — Refund Flow**  
Полный/частичный refund, причины, permissions, audit и события.

· **Step 2.13A — Chargeback / Dispute Foundation**  
Dispute/chargeback lifecycle, evidence, liability, ledger adjustments и Partner liability.

· **Step 2.14 — Invoice / Commission Flow**  
Invoice lifecycle и partner/platform commissions.

· **Step 2.14A — Settlement Engine**  
Gross → ProviderFee → TravelHub Commission → Tax → Refund/Adjustments → Partner Payable.

· **Step 2.14B — Partner Payout Foundation**  
Канонический Payout lifecycle; bank transfer/local rail/SEPA/SWIFT в зависимости от рынка.

· **Step 2.14C — Partner Payout Account Foundation**  
Безопасная payout destination model/token/reference; минимизация хранения банковских секретов.

· **Step 2.14D — Payment / Settlement / Payout Reconciliation**  
PSP transaction → Payment → Ledger → Commission → Settlement → Payout → bank result.

· **Step 2.14E — Channel-Based Commission Rules**  
Разные commission policies для `MARKETPLACE`, `PARTNER_STOREFRONT`, `PARTNER_CUSTOM_DOMAIN`, API/MANUAL. Никаких hardcoded ставок.

· **Step 2.15 — Documents Commercial Flow**  
Contract, invoice/receipt/voucher как типы Document; генерация, immutable snapshots, связи с Order/Booking/Finance.

· **Step 2.16 — Commercial Flow E2E**  
`Product → Quote → Sale → OrderRequested → Order → BookingRequested → Booking → Payment → Documents → Fulfillment → OrderClosed`.

· **Step 2.16A — Buyer Purchase Timeline**  
Buyer timeline из реальных events/timestamps: Order created, Payment initiated/captured, Booking confirmed, Service completed, Refund processed и т. д.

· **Step 2.16B — Partner Sales Read Model**  
GMV, Orders, Bookings, products, average check, periods, categories, Marketplace vs Storefront/Custom Domain.

· **Step 2.16C — Partner Finance Read Model**  
Gross, paid, outstanding, TravelHub commission, ProviderFee, refund, settlement, payout, net revenue, debt to TravelHub. Продажи и деньги — разные read models.

· **Step 2.17 — Phase 2 Hardening**  
Idempotency, Outbox, retries, duplicate events, concurrency, compensation, security, audit, performance.

· **Step 2.18 — Phase 2 Exit Audit**  
Полная сверка с Master/Baseline и DoD Phase 2.

· **Step 2.18A — Financial Integrity Exit Gate**  
Monetary precision, idempotency, webhook replay, duplicate capture/refund, ledger balance, settlement reconciliation, temporal integrity.

---

# PHASE 3 — COMPLETE PLATFORM

## Управление и аналитика

· **Step 3.0 — Phase 3 Entry Audit**

· **Step 3.1 — Dashboard / Command Center Backend**  
Агрегированные KPI/read models без владения операционными сущностями.

· **Step 3.2 — Dashboard UI**  
Главный внутренний рабочий экран, KPI, alerts, queues, shortcuts, AI insights.

· **Step 3.3 — Analytics Foundation**  
Метрики, dimensions, aggregation/read models.

· **Step 3.3A — Analytics Source-of-Truth & Fact Model**  
Analytics строится из business entities + lifecycle timestamps + canonical domain events + behavioral events + financial ledger + audit/history. Запрещено реконструировать историю только из current status/updatedAt.

· **Step 3.3B — Canonical KPI Dictionary**  
Единые определения GMV, Revenue, Net Revenue, Commission, Conversion, Cancellation Rate, Refund Rate, Booking Confirmation Time, Payment Conversion, Partner SLA и др.

· **Step 3.3C — Marketplace Conversion Funnel**  
`ProductImpression → ProductViewed → CheckoutStarted → OrderCreated → PaymentSucceeded → BookingConfirmed → ServiceCompleted`, conversion/drop-off/time-to-convert.

· **Step 3.3D — Attribution Analytics**  
Marketplace / Partner Storefront / Custom Domain / API / Manual, campaign/source, Partner/Product/category.

· **Step 3.4 — Analytics Center UI**  
Продажи, заказы, бронирования, финансы, продукты, партнёры, marketplace performance.

· **Step 3.4A — Time-Based Analytics**  
Продажи/Orders/Bookings/Payments/Refunds/publications по часу/дню/неделе/месяцу/сезону, lead time, confirmation time, processing time, payout delay.

## CRM

· **Step 3.5 — CRM Completion**  
Customer `CUS-*`, Contact `CNT-*`, Company `COM-*`, Partner `PAR-*`, Supplier `SUP-*`.

· **Step 3.6 — CRM Center UI**  
360° customer/partner/company view, history, relations, activities.

· **Step 3.7 — Communication Integration**  
`CML-*`, email/message/contact history и связи с CRM/Sales/Order/Support.

## Marketing

· **Step 3.8 — Marketing Domain**  
Campaign, audience, channel, attribution и lifecycle.

· **Step 3.9 — Marketing Center UI**

## Support

· **Step 3.10 — Support Domain**  
Ticket/Case, priority, SLA, assignment, escalation.

· **Step 3.11 — Support Center UI**  
Customer/Order/Booking context без передачи ownership.

## Users & Security

· **Step 3.12 — Users & Access Completion**  
Канонические роли, permissions, user lifecycle, sessions, partner/buyer accounts.

· **Step 3.12A — Partner Multi-User Teams**  
Partner owner/admin/manager/content/finance/support roles, invitations, granular partner-scoped permissions.

· **Step 3.12B — Partner KYC/KYB Foundation**  
Business verification, legal/compliance status.

· **Step 3.12C — Partner Payment Capability**  
Отдельные capabilities `canSell`, `canAcceptPayments`, `canReceivePayouts`; marketplace approval ≠ payout-ready.

· **Step 3.12D — Notifications Foundation**  
Email/SMS/in-app notification events, templates, preferences, retry/delivery tracking.

· **Step 3.13 — Users & Access Center UI**

· **Step 3.14 — Security Hardening**  
Rate limiting, session/token security, object-scope audit, sensitive operations, security events.

## Documents

· **Step 3.15 — Documents Domain Completion**  
Document/Template/Voucher, versioning, storage, generation, permissions.

· **Step 3.16 — Documents Center UI**

## Calendar

· **Step 3.17 — Calendar Domain**  
Events/tasks/deadlines, Order/Booking/Sales/Support references.

· **Step 3.18 — Calendar Center UI**

## Reports

· **Step 3.19 — Reports Domain**  
Report definitions, parameters, schedules, exports.

· **Step 3.19A — Scheduled Partner / Buyer Reports**  
Scheduled reports только из canonical read models/facts/timestamps, без реконструкции из mutable current-state.

· **Step 3.20 — Reports Center UI**

## Integrations

· **Step 3.21 — Integration Platform**  
Connector model, credentials/secrets abstraction, inbound/outbound integrations.

· **Step 3.21A — PSP Integration Management**  
Несколько PSP через provider abstraction: capabilities/countries/currencies/status/credentials.

· **Step 3.21B — Banking / Payout Rail Integrations**  
Bank transfer/local rails/SEPA/SWIFT provider abstraction.

· **Step 3.22 — Webhooks & External API**  
Signing, retries, idempotency, rate limits, delivery log.

· **Step 3.22A — Financial Webhook Inbox**  
Durable ingestion, signature verification, idempotency, replay, reconciliation.

· **Step 3.23 — Integrations Center UI**

## AI

· **Step 3.24 — AI Center Foundation**  
AI recommendations, insights, risk detection, assistance contracts.

· **Step 3.24A — AI Catalog Assistance**  
Product descriptions, attribute suggestions, classification, quality assistance. Partner подтверждает изменения.

· **Step 3.24B — AI Translation Pipeline**  
RU/AZ/EN stored/versioned translations с fallback/moderation вместо бесконтрольного live translation.

· **Step 3.24C — AI Moderation Assistance**  
Text/image/QR/contact detection; AI помогает MODERATOR, но не принимает критические решения самостоятельно.

· **Step 3.24D — Recommendation Foundation**  
Recommendations/ranking после накопления реальных behavioral данных.

· **Step 3.25 — AI Governance**  
AI не выполняет критические действия самостоятельно; permissions, audit, human approval.

· **Step 3.26 — AI Center UI**

## System & Settings

· **Step 3.27 — System Center**  
Health, queues, jobs, events, errors, audit, operational diagnostics.

· **Step 3.28 — Settings Center**  
Organization settings, localization, business policies, references. Currency/Tax ownership остаётся Finance.

## Marketplace completion

· **Step 3.29 — Partner Cabinet Full**  
Product management, media, tariffs, availability, moderation, sales/orders/bookings/finance views в разрешённых границах.

· **Step 3.29A — Partner Storefront Advanced**  
Themes, configurable sections, richer branding, navigation, storefront settings.

· **Step 3.29B — Partner Subdomain Foundation**  
`partner.travelhub.com`, tenant resolution, routing/security.

· **Step 3.29C — Partner Custom Domain Foundation**  
`www.partner.az → TravelHub Storefront`, DNS verification, TLS/CDN/provisioning.

· **Step 3.29D — Storefront SaaS Plans / Entitlements**  
START/BUSINESS/PRO или configurable plans; product limits, branding, custom domain, analytics и feature entitlements.

· **Step 3.29E — Storefront Analytics**  
Marketplace vs Storefront vs Custom Domain traffic/sales, views, conversion, GMV, commission, net revenue.

· **Step 3.29F — Partner Sales Dashboard Full**  
Продажи, продукты, категории, периоды, channels, funnel/conversion.

· **Step 3.29G — Partner Finance Dashboard Full**  
Payments, commissions, ProviderFees, refunds, settlements, payouts, balances, net revenue.

· **Step 3.30 — Buyer Cabinet Full**  
Profile, Orders, Bookings, Payments, Documents, Support.

· **Step 3.30A — Buyer Purchase History Full**  
Order/Booking/Payment/Refund/Document/Support + единый chronological timeline.

· **Step 3.31 — Marketplace Checkout**  
Выбор услуги/tariff/date/travelers → commercial flow. Никакого прямого создания Booking из frontend.

· **Step 3.32 — Marketplace Search & Discovery**  
Full-text search, category-specific filters, sorting, pagination, availability/price filters.

· **Step 3.33 — Product Detail Page Full**  
Подробное описание услуги, фото-галерея, цена, варианты/tariffs, availability, условия, provider/seller information, CTA.

· **Step 3.34 — Reviews & Ratings**  
Закрывается legacy Review: ownership, eligibility, moderation, rating aggregation.

· **Step 3.34A — Verified Purchase Review Eligibility**  
Review только BUYER с реальной eligible/completed Booking/Order.

· **Step 3.34B — Seller Rating Aggregation**  
Product rating и Seller rating считаются раздельно и воспроизводимо из canonical reviews.

· **Step 3.35 — Marketplace SEO / Localization**  
RU/AZ/EN, localized metadata, canonical URLs, sitemap, structured data.

## Moderation

· **Step 3.36 — Moderation Center Full**  
Очереди, SLA, filters, Product versions, decisions, history, moderator workload/KPI.

· **Step 3.37 — Extended Content Moderation**  
Product text/media/reviews и future moderation objects без смешения domain ownership.

· **Step 3.37A — Communication / Chat Completion**  
Buyer↔Partner messaging с Order/Booking context, attachments, audit.

· **Step 3.37B — Chat Anti-Disintermediation**  
Detection/flag/block email, phone, WhatsApp/Telegram, social handles, external booking attempts до разрешённого disclosure stage.

· **Step 3.37C — Post-Purchase Contact Disclosure Policy**  
Когда BUYER получает реальные operational/contact/legal данные PARTNER в зависимости от Order/Payment/Booking/service type.

## Legacy reconciliation

· **Step 3.38 — Legacy Payout Resolution**  
Определить окончательное место существующего Payout в Finance architecture.

· **Step 3.39 — Legacy Chat Resolution**  
ChatRoom / ChatMember / Message → Communication/Support architecture либо controlled migration.

· **Step 3.40 — Legacy TourMedia Resolution**  
Migration в Catalog ProductMedia.

· **Step 3.41 — StripeEvent Resolution**  
Перевод в Finance/Integration webhook-event architecture.

## Production

· **Step 3.42 — Performance & Scalability**  
Indexes, query plans, cache, queues, media/CDN, pagination, load tests.

· **Step 3.42A — Public Marketplace Load Test**  
Catalog/search/PDP/media/storefront под production-like нагрузкой.

· **Step 3.42B — Checkout / Payment Concurrency Load Test**  
Duplicate checkout, concurrent payment, duplicate webhook, refund/booking races.

· **Step 3.43 — Observability**  
Structured logs, metrics, traces, correlation/causation, alerts.

· **Step 3.44 — Backup / Recovery / Operations**  
PostgreSQL, object storage, restore tests, migration rollback/recovery procedures.

· **Step 3.44A — Disaster Recovery Drill**  
Реальное восстановление PostgreSQL + object storage, проверка RPO/RTO.

· **Step 3.45 — Production Security Audit**

· **Step 3.45A — Privacy / Data Retention Audit**  
Retention, anonymization/deletion, financial/document retention, audit preservation, personal/contact/payment data.

· **Step 3.45B — Payment Security Audit**  
Secrets, webhook signatures, PCI boundary, payment-data exposure, payout access, Finance RBAC.

· **Step 3.46 — Complete Platform E2E**  
`PARTNER → Product → Media → Moderation → Published Marketplace → BUYER → Service → Sale/Checkout → Order → Booking → Payment → Documents → Fulfillment → Support/Review`

· **Step 3.46A — Full Money Journey E2E**  
`BUYER → Checkout → Order → Payment → Split/Platform Collect → Booking → Service → Commission → Settlement → Partner Payout`

· **Step 3.46B — Refund / Dispute Journey E2E**  
`Payment → Cancellation → Refund → Commission reversal → Settlement adjustment → Payout adjustment` и `Payment → Chargeback → Dispute → Ledger adjustment`.

· **Step 3.46C — Storefront Journey E2E**  
`PARTNER → Storefront → Product → BUYER → Checkout → Order → Payment → Booking` с доказанным `PARTNER_STOREFRONT` attribution.

· **Step 3.47 — Final Architecture Audit**  
Все 20 центров/доменов, ID Policy, RBAC, events, ownership, lifecycle, API и UI сверяются с Master/Baseline.

· **Step 3.48 — Production Release Candidate**

· **Step 3.49 — Production Readiness / Final DoD**

· **Step 3.49A — Financial Reconciliation Go-Live Gate**  
Production запрещён, пока тестовый финансовый период не сходится: `PSP ↔ Payments ↔ Ledger ↔ Commissions ↔ Refunds ↔ Settlements ↔ Payouts`.

· **Step 3.49B — Temporal / Analytics Go-Live Gate**  
Для полного E2E должна восстанавливаться фактическая хронология: Product published → Product viewed → Checkout started → Sale/Order created → Payment captured → Booking confirmed → Service completed → Settlement → Payout с actor/source/channel/trace.

---

# ОБЯЗАТЕЛЬНЫЕ СКВОЗНЫЕ ТРЕБОВАНИЯ

Каждый существенный business action должен позволять ответить:

WHAT — что произошло  
WHEN — когда произошло  
WHO — кто сделал  
ENTITY — с каким объектом  
CHANNEL — Marketplace / Storefront / Custom Domain / API / Manual  
CONTEXT — Product / Sale / Order / Booking / Payment / ...  
TRACE — requestId / correlationId / causationId

## Temporal
- `updatedAt` не заменяет business lifecycle history.
- Business transitions имеют собственные timestamps.
- Events/history имеют `occurredAt`.
- System timestamps — UTC.
- Service date/time отдельно от entity creation time.
- Service timezone — IANA timezone.

## Traceability
- requestId → command → event → outbox → consumer → audit/log.
- correlationId/causationId обязательны для cross-domain flows.

## Attribution
- salesChannel/source фиксируется в начале коммерческого контекста и переносится неизменяемо.
- Нельзя угадывать channel постфактум.

## Analytics readiness
- KPI строятся из canonical facts/events/timestamps/ledger, а не из догадок по current status.
- Behavioral events и business events не смешиваются с AuditLog.

## Auditability
- Для Product, Moderation, Partner, Buyer, Sale, Order, Booking, Payment, Refund, Settlement, Payout и других критических объектов должна восстанавливаться история: что → когда → кто → объект → канал → trace.

## Security / Ownership
- Каждый домен пишет только в свою owned schema, кроме явно разрешённых ADR orchestration scenarios.
- Public DTO никогда не сериализует raw internal ORM/entity object.
- Object scope проверяется backend, frontend не является security boundary.
- PARTNER/BUYER/internal roles не смешиваются.

## Money
- Monetary amounts хранятся с безопасной precision policy.
- ProviderFee ≠ TravelHub Commission.
- Sales ≠ Cash received.
- Refund/chargeback/settlement/payout отражаются отдельными финансовыми фактами.
- Ledger append-only.

## Marketplace / Storefront
- Один Catalog.Product — несколько presentation/sales channels.
- Product не дублируется для Partner Storefront.
- Marketplace seller identity защищена anti-disintermediation policy.
- Storefront disclosure governed отдельно.

---

# CANONICAL STATUS

Этот roadmap считается **замороженной канонической нумерацией**.

Новые требования:
- не сдвигают существующие Step;
- добавляются как `Step X.YA / X.YB / ...`;
- либо идут как clarification/review-fix соответствующего Step.

Никакой исходный Step из baseline roadmap не удалён.
