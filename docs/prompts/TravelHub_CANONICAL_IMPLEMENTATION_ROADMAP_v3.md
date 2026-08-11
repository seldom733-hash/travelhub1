# TravelHub --- CANONICAL MASTER IMPLEMENTATION PLAN v3

**Статус документа:** канонический Master Plan на хранение\
**Дата актуализации:** 2026-08-10\
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

· **Step 1.8A --- Service Template / Seller Commercial Structure Foundation** ⏳ NOT IMPLEMENTED (Roadmap Amendment: Service Templates / Period Pricing & Availability, post-baseline addition)\
Канонический service template foundation: extend/reconcile существующий
`CategorySchema` как структуру service templates; Seller mapping/import
собственной коммерческой единицы; исходные Seller-названия сохраняются
verbatim; нормализованные сопоставимые атрибуты (accommodation type,
room class, view, occupancy, bed configuration, area, balcony,
accessibility, meal plan, amenities) — для filter/search/comparison/
matching/analytics/validation, НЕ заменяют Seller-название;
category-specific schemas (Hotel/Room, Tour, Transfer, Excursion, Car
Rental — без hardcoded Hotel-допущений в generic model); физическая/
service единица ≠ Rate Plan; БЕЗ pricing engine. Инварианты:
«Template defines structure; Seller provides values», «Seller-defined
commercial names preserved verbatim; TravelHub standardizes attributes,
not names», «Room/service unit и Rate Plan — разные концепции». Если
расширение `CategorySchema` безопасно невозможно —
`ARCHITECTURE DECISION REQUIRED` до реализации.

· **Step 1.8B --- Rate Plan / Commercial Variant Foundation** ⏳ NOT IMPLEMENTED (Roadmap Amendment: Service Templates / Period Pricing & Availability, post-baseline addition)\
Коммерческий вариант единицы (рабочее имя `RatePlan` / `CommercialVariant`;
финальное имя НЕ заморожено): meal plan, refundable/non-refundable,
cancellation policy ref, included services, commercial restrictions,
price basis. Rate Plan принадлежит/ссылается на реальную коммерческую
единицу Seller-а; НЕ равен Product/Room/Quote/Checkout/Sale. Перед
реализацией решить (DD-024): является ли существующий `catalog.Tariff`
уже каноническим Rate Plan (тогда extend, без duplicate concepts под
новыми именами). Category-dependent extensibility; перечисление
значений НЕ frozen.

· **Step 1.8C --- Period Pricing & Period Availability Foundation** ⏳ NOT IMPLEMENTED (Roadmap Amendment: Service Templates / Period Pricing & Availability, post-baseline addition)\
Ограниченные commercial periods: authoritative period price
(первичный source — эквивалент `MANUAL_PERIOD`; финальное имя/
перечисление source — deferred до реализации, future extension points:
`DATE_OVERRIDE`/`API_SUPPLIER`/`CHANNEL_MANAGER`/`DYNAMIC_RULE` —
иллюстративные, НЕ frozen); period/date/departure/slot availability;
reconcile с Catalog-owned `Availability`/`AvailabilityReservation`
(Step 2.4); БЕЗ speculative future pricing, БЕЗ обязательного
long-range forecast, БЕЗ требования, чтобы каждый Product был sellable
на все будущие даты, БЕЗ второго hold engine. Инварианты: «Pricing
answers how much; Availability answers how much can be sold;
Reservation/Hold answers how much has been committed/held»; «price basis
explicit & deterministic — Quote может рассчитать binding amount»;
«sales validity period ≠ service/stay/departure period ≠ booking
window — не конвейерить молча». Если существующая Availability-модель
не может безопасно поддержать period/date inventory —
`ARCHITECTURE DECISION REQUIRED`. **Future-compat (STRICT REVIEW):**
multi-date stay (1 коммерческий item → N ночей) создаст N
AvailabilityReservation hold-ов (одна строка на дату, модель Step 2.4) →
контракт `OrderRequested.reservationIds.length === items.length`
(Step 2.5, one hold per item) должен быть ревизован при введении
multi-date периодов: cardinality = «все allocated units/dates», не
«число items»; migration детализируется в 1.8C implementation (НЕ
дефект текущего APPROVED Step 2.5; DD-027).

· **Step 1.8D --- Commercial Restrictions / Overrides Foundation** ⏳ NOT IMPLEMENTED (Roadmap Amendment: Service Templates / Period Pricing & Availability, post-baseline addition)\
Минимальные stop-sell и override-модель; extension points для future
stay/advance-booking/closed-to-arrival/closed-to-departure restrictions;
НЕ revenue-management engine, НЕ channel-manager rules engine.
Overlap-резолюция overlapping periods и server precedence base period vs
date override — server-authoritative, детали deferred до реализации.
Audit/history для изменений sellable terms (price/availability/stop-sell/
commercial period/Rate Plan status) — по контракту Step-а.

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

· **Step 2.1 --- Sales Domain Foundation** ✅ DONE\
Lead `LED-*`, Opportunity `OPP-*`, Quote `QTE-*`, Sale `SAL-*`;
ownership/lifecycle.

· **Step 2.2 --- Sales Center Backend** ✅ DONE\
API, queues, filters, KPI/read models, actions, audit, RBAC. Sales не
владеет Order/Booking logic.

· **Step 2.2A --- Seller Commercial Capabilities & Destination Coverage** ✅ STRICT REVIEW COMPLETED — APPROVED (WITH REVIEW FIXES; Roadmap Amendment: Reverse Marketplace, post-baseline addition; reverse.*, ADR-0012)\
Независимый capability-профиль Seller-а: сервисные категории/типы, которые Seller может продавать и на
которые отвечать; покрываемые дестинации; приём Buyer Requests
ON/OFF; active/lifecycle state; entitlement/capability eligibility;
auditability; управление в own-scope Partner-а и internal-управление.
Страна регистрации юридического лица НЕ определяет коммерческое
покрытие (инвариант 1). Начальное покрытие — country-level +
`WORLDWIDE`, но архитектура обязана допускать
`Country → Region → City/Destination`. Capabilities НЕ выводятся только
из опубликованных Catalog Products (инвариант 2). Сервисная таксономия
extensible (Accommodation/Hotel/Apartment/Villa; Tours/Packages;
Transport/Transfer/Car Rental; Activities/Excursion/Guide) — без
hardcoded cross-category исключений; Seller явно декларирует, на какие
Buyer Request сервисные типы он может отвечать. STRICT REVIEW:
Capabilities описывают коммерческую способность/готовность отвечать на
demand — НЕ shadow Catalog: они НЕ являются inventory authority,
pricing authority или availability authority (не заменяют Product/
Tariff/Availability; заказы через них не создают capacity-резервации вне
canonical flows).

· **Step 2.2B --- Buyer Request / Reverse Marketplace Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (Roadmap Amendment, post-baseline addition; reverse.*, ADR-0012)\
Каноническая buyer-demand сущность, финальное имя `BuyerRequest`, префикс `BRQ-*` (зарегистрирован в ID-registry при
реализации 2.2B). Может содержать category-dependent: service type/category;
destination; dates/range/flexibility; travelers; budget/currency;
preferences/requirements; безопасный free-form requirements; lifecycle /
timestamps; buyer own-scope; privacy; audit/history; source/acquisition
context. Точный lifecycle enum в amendment НЕ замораживается. BuyerRequest
НЕ является Lead/Opportunity/Quote/Sale/Order/Booking/Communication
(инвариант 3) — это отдельная entity; НО связанные разговоры по нему
ведутся в существующем Communication (`CML-*`, Step 2.2E), т.е. entity ≠
communication context.

· **Step 2.2C --- Buyer Request Matching & Distribution** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (Roadmap Amendment, post-baseline addition; reverse.*, ADR-0012; server-authoritative run + Seller inbox; FIX 1: fresh re-read пересчитывает destinations/coverage в tx; FIX 2–5: e2e BUYER-403 / inactive-category / duplicate-capability-409 / destinations-race; doc: индексы, seller-race контракт, worldwide/OR-семантика, audit-on-noop)\
Базовая концептуальная eligibility: `active/approved Seller` AND `eligible to receive Buyer Requests` AND
`service capability matches` AND `destination coverage matches` AND
`required entitlement/capability permits participation`. Локация Buyer-а
и страна регистрации Seller-а НЕ authoritative destination-matching
критерии (инвариант: пример — Buyer в Азербайджане запрашивает HOTEL /
Antalya / Турция; eligible Seller может быть зарегистрирован в
Азербайджане, Турции, ОАЭ, Грузии, Германии и т.д., если capability/coverage
совпадают). Matching/distribution — server-authoritative (инвариант 10),
auditable. Ranking/SLA/rating/AI — будущая работа. Distribution НЕ создаёт
Leads автоматически: `1 BuyerRequest → 70 matched → 25 delivered →
6 responses` НЕ создаёт 70/25 Leads (инвариант 4; conversion point —
Step 2.2F, reconcile Lead vs Opportunity, не дублируя модель).
MATCHED ≠ CONTACT DISCLOSED (инвариант 5).

· **Step 2.2D --- Seller Proposal Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (Roadmap Amendment, post-baseline addition)\
Один BuyerRequest может получать `0..N` Seller-specific proposals. Proposal — competitive/pre-commercial ответ,
НЕ автоматический канонический Quote (никакого второго Quote engine).
Позже может содержать offered configuration, dates, description,
amount/currency, inclusions/exclusions, validity, conditions, notes,
structured service details. STRICT REVIEW: Proposal amount/currency —
competitive/pre-commercial indication, НЕ binding-price контракт; binding
price authority остаётся canonical Quote (Step 2.3) — никакого второго
price contract (см. Ownership map). Строгая изоляция: Seller A не видит
proposal/price/conversation Seller B; Buyer видит только proposal своего
request; internal доступ — по permissions (инвариант 6).

· **Step 2.2E --- Buyer Request / Proposal Communication** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (Roadmap Amendment, post-baseline addition)\
Переиспользование существующего `Communication = CML-*`; НЕ создаётся второй messaging domain. Context:
`BuyerRequest + Buyer + Seller [+ Proposal]`. Один Buyer может иметь
независимые разговоры с несколькими Sellers по одному request. Enforce:
Buyer own-scope, Partner own-scope, participant/context consistency,
нейтральный IDOR, anti-disintermediation, audit/history,
cross-Seller isolation, совместимость с future attachments/notifications.
Amend 3.37A (Chat Completion поддерживает BuyerRequest/Proposal, не
только Order/Booking) и 3.37B (anti-disintermediation распространяется
на pre-sale request chat). IMPLEMENTATION: `communication.CommunicationThread`
(room, CML-*, unique (buyerRequestId, sellerPartnerId)) + сообщения = строки
communication.Communication (contextType=BUYER_REQUEST, threadId); membership =
2 server-derived колонки; distribution prerequisite + SUBMITTED gate (FOR UPDATE);
cancel блокирует send, история durable; WITHDRAWN proposal не блокирует чат;
CHAT EXISTS ≠ CONTACT DISCLOSED (единый anti-disintermediation helper);
PublicSellerProfile проекция (ADR-0005), без raw partnerId; buyer-view без
customer PII; zero Sales/Catalog fan-out; e2e 36/36 (все пункты §45).
STRICT REVIEW: APPROVED WITH REVIEW FIXES (2.2E target: reverse-conversation +
communication e2e; FIX 1 — afterAll чистит ВСЕ BUYER_REQUEST-сообщения (FK
ON DELETE SET NULL оставлял 10 осиротевших строк → флейк 727/728 при
нестабильном порядке спеков на Windows); FIX 2 — boot backfill проверяется
ДЕЛЬТОЙ (count до/после init), а не абсолютным 0; FIX 3-4 — аналогичная
хрупкость count==0 закрыта в sales-domain-foundation (дельта) и sales-center
(wipe sales-таблиц в beforeAll); полная регрессия 728/728 e2e + 380 unit +
135 frontend vitest + build green).· **Step 2.2F --- Proposal → Canonical Sales Conversion** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-11; Roadmap Amendment, post-baseline addition; gate DD-030 RESOLVED: target = `Opportunity` (`OPP-*`); см. `docs/prompts/DD-030_PROPOSAL_TO_CANONICAL_SALES_CONVERSION_POINT_ARCHITECTURE_DECISION.md`; контракт ниже; детали — `docs/architecture/reverse-proposal-to-sales-conversion.md`)\
  Реализовано (2.2F): `POST /buyer/requests/:requestId/proposals/:proposalId/select` (BUYER own-scope, `reverse.proposal.select_own`);
  атомарная owner-service конверсия в ОДНОЙ tx: selection-факт (reverse.BuyerRequest.selectedProposalId @unique,
  reverse.SellerProposal.selectedAt/convertedOpportunityId @unique/convertedAt) + `sales.Opportunity` через
  SalesService.createOpportunityFromBuyerRequestSelection (leadId=NULL, status=NEW, acquisitionSource=BUYER_REQUEST,
  provenance buyerRequestId/proposalId/sellerId). Проверен Checkout DIRECT-hardcode-gap: Checkout выводит source
  server-side из Quote (`quote.acquisitionSource ?? DIRECT`), Quote наследует из Opportunity — request-led путь
  BUYER_REQUEST, direct путь DIRECT (legacy сохранён). Регрессия: 744/744 e2e (вкл. reverse-conversion 16), 380 unit,
  135 frontend vitest, build green, migrate 36/36 drift 0.
  STRICT REVIEW APPROVED WITH REVIEW FIXES: FIX 1 (§22/§33) SALES_CREATE_FORBIDDEN_KEYS
  усилен (acquisitionSource/buyerRequestId/proposalId/sellerId/partnerId/selected/converted/
  convertedOpportunityId/selectedProposalId → loud 422 — generic Sales create НЕ silent-strip
  forged source/provenance); FIX 2 (§51) select-эндпоинт задокументирован в docs/contracts/api.md
  (endpoint/permission/own-scope/request/response/idempotency/errors/privacy-boundary);
  FIX 3 (§37) e2e: idempotent retry со СТАРОЙ expectedVersion (response-loss) → тот же результат,
  без дублирования history/audit; FIX 4 (§10) e2e: проигравший concurrent A/B — без success
  history/audit; FIX 5 (§25/§47/§50) e2e: полная цепочка select → Sale → OrderRequested →
  Order → Booking сохраняет BUYER_REQUEST (frozen; DIRECT-пути не задеты). При выборе Buyer-ом proposal НЕ создаются
BuyerRequestOrder/ProposalOrder/ReverseMarketplaceOrder/отдельные
Checkout/Payment/Booking (инвариант 8). Канонический путь:
`BuyerRequest → Matching → Proposal → Buyer selection → Opportunity (OPP-*) → Quote (QTE-*) → Checkout → Sale → OrderRequested → Order → Booking → Finance`.
Конверсия начинается с **Opportunity** (первый Sales-owned qualified deal после
выбора одного Seller-а; `Opportunity.leadId` nullable — Lead не обязателен;
Opportunity не требует Product/Tariff — совместимо с Proposal без
опубликованного Product). Каноническое правило: **Reverse Marketplace — ещё
один commercial acquisition path, а не отдельная transaction system**
(инвариант 7). Sales создаёт новый canonical Quote из trusted/revalidated
фактов (Proposal никогда не переклассифицируется в Quote; Proposal money
не-binding); CheckoutIntent получает server-derived `BUYER_REQUEST`;
provenance refs (buyerRequestId/proposalId/sellerId) — аддитивные
implementation implications; один selected Proposal → один Sales-path
(idempotent); события без реального consumer-а не добавляются.

· **Step 2.3 --- Quote & Commercial Offer Flow** ✅ DONE\
Product/Tariff snapshot, price, discounts, currency, validity,
customer/travelers context.

· **Step 2.3A --- Checkout / Commercial Intent Foundation** ✅ DONE\
Authoritative checkout context: Product/Tariff, travelers, options,
service date/time, payment terms, publication/acquisition context.
Frontend не источник цены.

· **Step 2.3B --- Payment Terms Foundation** ✅ DONE\
`FULL_PREPAYMENT`, `PARTIAL_PREPAYMENT`, `DEPOSIT`, `PAY_LATER`,
`PAY_AT_SERVICE`. Partner выбирает только разрешённые платформой
схемы/параметры; Sale/Order хранит immutable financial snapshot.

· **Step 2.4 --- Sale Completion → OrderRequested** ✅ DONE\
Sale публикует canonical `OrderRequested`; никаких прямых Sales writes в
Order tables. Реализовано: `POST /sales/sales/:code/complete` (RBAC
`sales.sale.complete`), immutable commercial snapshot на Sale, atomic
capacity hold через Catalog owner service (`AvailabilityReservation`, RSR-*),
`OrderRequested` в outbox + durable retry (`retryFailed`, nextAttemptAt/backoff),
CAS/CLOSED терминал + один OrderRequested (idempotency). Order consumer — Step 2.5.

· **Step 2.5 --- Order Creation Consumer** ✅ DONE\
Order consumer создаёт `ORD-*`, пользовательский `TH-YYYY-######`,
OrderItems/OrderTraveler, публикует `OrderCreated`.\
Реализовано: consumer `OrderRequested` (`OrderRequestedConsumer`, InboxEvent\
dedup + `Order.saleId @unique` — один Sale → один Order), domain-owned\
`OrderService.createOrderFromRequested` (атомарный граф Order + items +\
travelers + fulfillment + history + OrderCreated result-event), frozen\
commercial snapshot на Order (subtotal/discount/payment terms/acquisition\
source, без reprice), OrderTraveler-снапшот из CheckoutIntent (READ-only, без\
PII), correlation/causation lineage из OrderRequested, bootstrap coexistence\
(Step 2.6 удалит). 2.6/2.7 НЕ реализованы. Миграция\
`add_order_creation_consumer` (Order.customerId nullable + snapshot/refs).

· **Step 2.5A --- Order Temporal Contract** ✅ DONE\
`createdAt`, `submittedAt`, `confirmedAt`, `cancelledAt`, `fulfilledAt`,
`closedAt` по фактическим переходам. History/events сохраняют
`occurredAt`.\
Реализовано: 5 milestone-колонок (additive, без backfill, миграция\
`add_order_temporal_contract`), `submittedAt` на обоих create-путях (consumer\
+ bootstrap), `confirmedAt/fulfilledAt/closedAt/cancelledAt` на переходах\
+ reconcile через booking-события, e2e `order-temporal-contract` (10).\
2.6/2.7 НЕ реализованы.

· **Step 2.5B --- Sales / Acquisition Channel Propagation** ✅ DONE\
Неизменяемый transaction context минимум: `MARKETPLACE`,
`PARTNER_STOREFRONT`, позднее `PARTNER_CUSTOM_DOMAIN`, `API`,
`MANUAL/DIRECT` + **`BUYER_REQUEST`** (Roadmap Amendment, рабочее имя;
финальное наименование реконсилируется с текущими конвенциями).
`BUYER_REQUEST` распространяется immutably, где применимо:
`BuyerRequest/Proposal → Quote/Sale → Order → Booking → Payment →
Settlement → Analytics` (инвариант 9). Publication channel остаётся
отличным от acquisition channel.\
Реализовано: `SalesAcquisitionSource` + `BUYER_REQUEST` (аддитивно),
bootstrap → server-derived DIRECT, `Booking.acquisitionSource` (frozen ref из\
Order, READ-only ADR-0001), миграция `add_acquisition_source_propagation`,\
e2e `acquisition-source-propagation` (10). Payment/Settlement/Analytics\
propagation — будущие owner-steps; 2.6/2.7/2.8 НЕ реализованы.

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
(Roadmap Amendment) Плюс reconstructable request-led funnel из
canonical facts/events/timestamps:
`BuyerRequestCreated → Matched → Delivered → SellerResponded →
ProposalViewed → ProposalSelected → Quote → Checkout → Sale → Order`.
Имена событий не финализируются в amendment (финализация — при
реальных facts/consumers).

· **Step 3.3D --- Attribution Analytics**\
Marketplace / Partner Storefront / Custom Domain / API / Manual/Direct,
campaign/source, Partner/Product/category. (Roadmap Amendment) Сравнимость
Product-led Marketplace, Storefront, Buyer Request, Direct/Manual, будущих
Custom Domain/API. Future metrics: request count, matching/delivery rate,
seller response rate, time-to-first-proposal, proposals/request, selection
rate, Request→Quote/Sale/Order conversion.

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
sales/orders/bookings/finance views. (Roadmap Amendment: Reverse
Marketplace) Полное управление: **Commercial Capabilities**, **Destination
Coverage**, **Buyer Request Inbox**, **Seller Proposals**,
request-related communications. Onboarding (Step 1.10) может
первоначально захватывать: services sold; countries/destinations served;
accepts Buyer Requests — остаются редактируемыми после регистрации;
страна регистрации НИКОГДА не переиспользуется как coverage. STRICT
REVIEW: это опциональный capture, НЕ делает завершённый Step 1.10
ретроспективно неполным; canonical management живёт в Partner capability
flow (2.2A); approval/Partner status НЕ автоматически выдаёт все Buyer
Request entitlements. Access — capability/permission-driven, совместимый
с small organizations (один сотрудник выполняет несколько функций).

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

· **Step 3.29I --- Partner Commercial Calendar / Bulk Management UI** ⏳ NOT IMPLEMENTED (Roadmap Amendment: Service Templates / Period Pricing & Availability, post-baseline addition)\
Calendar/period view; bulk price editing; bulk availability editing;
stop sell; create/copy periods; import/mapping UX; исходное Seller-
название + нормализованные атрибуты; full period availability.
Backend-зависимости — Steps 1.8A–1.8D (Service Templates / Rate Plan /
Period Pricing & Availability); НЕ начинать до реализации
соответствующих backend-шагов.

· **Step 3.30 --- Buyer Cabinet Full**\
Profile, Orders, Bookings, Payments, Documents, Support. (Roadmap
Amendment: Reverse Marketplace) + **My Requests**; request
lifecycle/status; **Received Proposals**; selected proposal;
request-related conversations. Строгий BUYER own-scope.

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
(Roadmap Amendment) Поддержка также BuyerRequest/Proposal context
(`BuyerRequest + Buyer + Seller [+ Proposal]`) — pre-sale request chat.

· **Step 3.37B --- Chat Anti-Disintermediation**\
Detect/flag/block contact/external booking attempts до разрешённого
disclosure stage. (Roadmap Amendment) Распространяется на pre-sale
BuyerRequest chat (BuyerRequest/Proposal context) — не только Order/Booking.

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

· **Step 3.46E --- Reverse Marketplace Journey E2E --- NEW (Roadmap Amendment)**\
`BUYER → BuyerRequest → matching → несколько изолированных Seller
proposals → контекстная коммуникация → selection → каноническая Sales
→ Quote → Checkout → Sale → OrderRequested → Order → Booking →
Payment/Documents → Fulfillment`. Доказательства: legal country НЕ
определяет destination eligibility (capability/coverage — определяют);
unmatched Seller не может получить доступ к request; Seller A не может
получить доступ к proposal/conversation Seller B; Buyer PII не
раскрывается одним фактом matching (MATCHED ≠ CONTACT DISCLOSED);
никакого параллельного transaction pipeline (инвариант 8); acquisition
source `BUYER_REQUEST` сохраняется end-to-end.

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

## Catalog Commercial Modeling (Roadmap Amendment: Service Templates / Period Pricing & Availability)

-   Seller-defined commercial names preserve verbatim; TravelHub
    standardizes attributes, not names.
-   Template defines structure; Seller provides values.
-   Physical/service unit ≠ commercial Rate Plan (Room ≠ Rate Plan).
-   Pricing answers «how much»; Availability answers «how much can be
    sold»; Reservation/Hold answers «how much has been committed/held».
-   Начальный price source — эквивалент `MANUAL_PERIOD` (НЕ
algorithmic dynamic-pricing engine); финальное имя/перечисление
    source — deferred до реализации.
-   Seller публикует authoritative commercial terms для определённого
    validity/service period; no fabricated future price, no mandatory
    long-range forecast, не каждый Product обязан быть sellable на все
    будущие даты.
-   Sales validity period ≠ service/stay/departure period ≠ booking
    window — не предполагаются одинаковыми без явного контракта.
-   Price basis explicit & deterministic (per room/night, per person,
    per package, per vehicle, per service, per group —
    category-appropriate; НЕ frozen list), чтобы Quote мог рассчитать
    binding amount.
-   Occupancy/PAX composition — признаётся как измерение
    (single/double/triple/2A+1C/child bands); минимальная каноническая
    модель определяется при реализации категорий; НЕ кодировать
    occupancy только в свободном Seller-названии.
-   Availability granularity — category-dependent (date / date range /
    departure / time slot / open date); reconcile с существующими
    `DATE_ONLY`/`TIME_SLOT`/`DATE_RANGE`/`OPEN_DATE` концепциями, не
    дублировать.
-   Catalog owns availability AND availability reservation mechanics
    (Step 2.4); никакого Sales/Order/Booking-owned inventory и второго
    hold/reservation engine.
-   Marketplace price display — date/period-aware: «from N USD» только
    по server-side правилу из действующих authoritative commercial
    periods; frontend-only price calculation запрещён.
-   Quote binding authority сохраняется (Step 2.3/2.3A/2.4): после
    binding — никакого reprice из текущего Catalog; later Seller price
    /Product text changes не мутируют frozen commercial facts.
-   Normalization не уничтожает Seller source values
    (source/original value + normalized TravelHub value); никаких
    uncontrolled global enums для маркетинговых терминов; taxonomy
    extensible.
-   Seller Commercial Capabilities (Reverse Marketplace) ≠
    Product/RatePlan/Availability (capability ≠ inventory; Seller может
    быть capable даже если конкретный product/period не опубликован).

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

## Reverse Marketplace / Commercial Capabilities (Roadmap Amendment)

Не-negotiable инварианты request-led demand path (полный текст также в
Step 2.2A–2.2F):

1.  `Partner legal location ≠ Seller commercial destination coverage`.
2.  `Published Products ≠ Seller Commercial Capabilities`.
3.  BuyerRequest — demand, НЕ автоматический
    Lead/Opportunity/Quote/Sale/Order/Booking.
4.  Matching/delivery не создаёт Sales entities автоматически.
5.  `MATCHED ≠ CONTACT DISCLOSED`.
6.  Seller proposals/conversations изолированы per Seller.
7.  Selected Proposal сходится в каноническую Sales.
8.  Reverse Marketplace НЕ создаёт параллельные
    Checkout/Order/Booking/Payment pipeline.
9.  Acquisition source (`BUYER_REQUEST`) сохраняется end-to-end.
10. Capability/destination matching — server-authoritative.

-   Capabilities/destination coverage — editable и auditable; страна
    регистрации НИКОГДА не переиспользуется как coverage.
-   Matching/distribution auditable; ranking/SLA/rating/AI — future work.
-   Distribution ≠ Lead creation; meaningful-engagement conversion point
    реконсилируется с существующими Sales-стадиями (Lead vs Opportunity
    vs Quote), без дублирования модели.
-   Service taxonomy extensible (Accommodation/Hotel/Apartment/Villa;
    Tours/Packages; Transport/Transfer/Car Rental;
    Activities/Excursion/Guide), без hardcoded cross-category исключений.
-   Communication reuse `CML-*`; никакого второго messaging domain.
-   Никакого второго Quote engine; Proposal ≠ canonical Quote.
-   Future platform management: service capability taxonomy,
    destination/reference taxonomy, eligibility/moderation, entitlement
    rules для Buyer Requests — без hardcoded commercial prices/plans и
    без опоры только на фиксированные role names.
-   STRICT REVIEW (small-org): никаких hardcoded role gates вроде «только
    SALES_MANAGER получает Buyer Requests»; доступ — permissions/
    capabilities/entitlements/admin-managed, с сохранением tenant/object
    scope (Step 3.12E модель ролей как пресетов сохраняется).
-   STRICT REVIEW (matching security): Seller НЕ может forge
    destination/service capabilities через request payloads; distribution
    state НЕ может self-promote Seller-ом; eligibility — server-authoritative.
-   Buyer PII не раскрывается фактом matching; matched Seller получает
    только коммерчески необходимые request facts; anti-disintermediation
    остаётся authoritative.

### Ownership map (Reverse Marketplace, Roadmap Amendment)

| Концепт | Owner | Замечание |
|---|---|---|
| Partner identity | Security / CRM (Partner) | существующий owner, не меняется |
| Seller Commercial Capabilities | **Reverse Marketplace** (рекомендуемый новый bounded context `reverse.*`, по прецеденту ADR-0011; формальный ADR — prerequisite до 2.2B) | edit — Partner own-scope + internal; НЕ в Catalog; страна регистрации ≠ coverage. Отличать от `PublicSellerProfile` (catalog.*, marketplace identity projection, ADR-0005) — разные сущности |
| Catalog Product | Catalog | существующий owner, не меняется |
| BuyerRequest | **Reverse Marketplace** (`reverse.*`, тот же новый bounded context) | lifecycle enum не заморожен; physical schema name — deferred |
| matching/distribution | **Reverse Marketplace** (`reverse.*`); matching-результаты — домен-факт reverse-домена (не hidden cross-domain writer; ADR-0001 соблюдён) | auditable; ranking/AI — future |
| Seller Proposal | **Reverse Marketplace** (`reverse.*`); per-Seller изоляция — object scope внутри reverse-домена | НЕ второй Quote engine; money authority — deferred (см. ниже) |
| Communication | Communication (`CML-*`) | context `BuyerRequest+Buyer+Seller[+Proposal]`; без второго messaging domain |
| Sales Quote/Sale | Sales | conversion target (2.2F) |
| Order | Order | consumer Step 2.5; единственный pipeline |
| Booking | Booking | единственный pipeline |
| Finance | Finance | единственный pipeline |

**Вывод владельца (STRICT REVIEW fix):** ни один существующий bounded
context не может владеть BuyerRequest/Seller Capabilities/Proposal без
владения чужим lifecycle (ADR-0001). По прецеденту ADR-0011 (Communication:
cross-domain модель → новый домен `communication.*`) **рекомендуемый owner
— новый bounded context `reverse.*` (Reverse Marketplace)**; Sales остаётся
conversion target, Communication — context-only refs, Catalog —
product/inventory. STRICT REVIEW: новый bounded context = новое
PostgreSQL-схема-домен (ADR-0001), т.е. фундаментальное архитектурное
добавление — **формальный ADR требуется ДО реализации 2.2B**
(прецедент: ADR-0011 для `communication.*`; Master Plan rule #6). В
Deferred Decisions это зафиксировано как explicit prerequisite (см. §26).
До ADR владельческий статус — RECOMMENDED, не closed verdict.

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
    и финансовую целостность.
6.  После утверждения нового архитектурного решения этот файл должен
    обновляться, чтобы решение не оставалось только в переписке.

## CURRENT CANONICAL EXECUTION SEQUENCE (Roadmap Amendment: Execution Sequence)

Этот раздел — **авторитетная операционная последовательность реализации**.
Логическая нумерация Steps и фактический порядок выполнения — разные
понятия. Следующий implementation-шаг определяется ТОЛЬКО из этого раздела,
не из истории чата/памяти/числовой нумерации/предположений агента.

**Single Source of Truth rule:** при конфликте истории чата, старого prompt-а,
отчёта агента, числовой нумерации или памяти с `CURRENT CANONICAL
EXECUTION SEQUENCE` — канонический Roadmap побеждает. Перед генерацией
каждого implementation prompt-а агент обязан прочитать этот раздел; перед
каждым STRICT REVIEW prompt-ом — сверить, что цель является текущим
активным элементом последовательности.

**SSOT nuance (не override инвариантов):** execution sequence определяет
ХРОНОЛОГИЮ, но не отменяет архитектурные инварианты/зависимости,
зафиксированные в этом же Roadmap (ownership, ADR-gates, canonical pipeline
rules). Если execution sequence конфликтует с явной канонической
зависимостью/инвариантом — это ПРОТИВОРЕЧИЕ Roadmap, требующее
исправления, а не разрешение игнорировать зависимость.

**Prompt-generation rule:** перед генерацией/исполнением любого будущего
implementation prompt-а агент обязан: (1) прочитать канонический Roadmap;
(2) прочитать этот раздел; (3) сверить approval требуемых prerequisite-ов;
(4) сверить, что цель — уникальный NEXT item. Перед генерацией STRICT
REVIEW — сверить, что цель соответствует только что завершённому активному
implementation/documentation item-у. Старые prompt-ы не выполняются вне
последовательности.

**Parallel execution rule:** по умолчанию может начинаться ТОЛЬКО уникальный
NEXT item. Параллельность не подразумевается; если позднее разрешена —
Roadmap обязан явно пометить набор как `PARALLEL-ALLOWED`. В текущей
последовательности после approval этого amendment единственный NEXT —
Reverse Marketplace ADR.

**Strict Review pairing rule:** каждый implementation Step требует
ОТДЕЛЬНОГО STRICT REVIEW перед началом следующего implementation Step,
если Step явно не помечен как documentation-only с иным механизмом
approval. Последовательность: `Implementation → Strict Review → APPROVED →
next item`. `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW` — НЕ
достаточно для продвижения; `CHANGES REQUIRED` / `ARCHITECTURE DECISION
REQUIRED` блокируют продвижение.

**Amendment rule:** любой будущий Roadmap Amendment, меняющий зависимости
или порядок выполнения (новые Steps, изменённые prerequisites, ADR-gate,
смена return point), ОБЯЗАН в том же amendment обновить этот раздел.
Amendment неполон, если добавляет Steps/меняет prerequisites/создаёт
ADR-gate/меняет return point без обновления последовательности. STRICT
REVIEW такого amendment обязан проверить, что обновление последовательности
выполнено и согласовано.

**Status semantics (операционные статусы):**
- ✅ APPROVED / DONE — только после требуемого STRICT REVIEW approval;
  реализация сама по себе НЕ означает DONE;
- 🔍 STRICT REVIEW IN PROGRESS / PENDING;
- ▶ NEXT;
- ⏳ PLANNED;
- ⛔ BLOCKED BY PREREQUISITE;
- ⚠ ARCHITECTURE DECISION REQUIRED.

DONE-семантика применяется с этого amendment (prospective); исторические
✅ DONE-маркеры (Steps 2.1–2.5B) установлены в рамках той же конвенции
implementation → strict review → approval и остаются валидными.

### Текущее состояние (verified 2026-08-10)

| Item | Status |
|---|---|
| Step 2.5 — Order Creation Consumer | ✅ DONE (committed 3afefc8) |
| Step 2.5A — Order Temporal Contract | ✅ DONE (committed 3afefc8) |
| Service Templates / Period Pricing & Availability Amendment | ✅ APPROVED WITH REVIEW FIXES (docs) |
| Step 2.5B — Acquisition Source Propagation | ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (реализация не коммичена, dirty tree) |
| Reverse Marketplace ADR (ADR-0012) | ✅ APPROVED (ADR-0012 STRICT REVIEW, docs/adr/ADR-0012) |

**Current completed boundary:** Steps 2.5 / 2.5A / 2.5B (2.5B — review
approved; commit ожидает явной команды) + Reverse Marketplace ADR-0012
✅ APPROVED (STRICT REVIEW) + Step 2.2A ✅ STRICT REVIEW COMPLETED —
APPROVED + Step 2.2B ✅ STRICT REVIEW COMPLETED — APPROVED WITH
REVIEW FIXES (BuyerRequest foundation; FIX 1: recursive preferences
PII-скан; FIX 2: lifecycle-команды loud-422 на forged keys; FIX 3–5:
race final-state/category-snapshot/nested-PII e2e; doc: PAX
category-neutrality + destination source).

**Currently active item:** Step 2.2C — STRICT REVIEW COMPLETED
(APPROVED WITH REVIEW FIXES; Matching & Distribution: reverse.
BuyerRequestDistribution, system matching command, Seller inbox,
strict containment coverage).

**Exact NEXT item:** `PHASE 2 — STEP 2.2D — SELLER PROPOSAL FOUNDATION`
(читает reverse.BuyerRequestDistribution напрямую; 2.2C одобрена;
2.2D запускается отдельным implementation prompt).

### Полная авторитетная последовательность после 2.5B

1.  **Reverse Marketplace ADR** — ✅ DONE (ADR-0012 создан; hard
    prerequisite: `Reverse Marketplace ADR APPROVED` — обязательное условие
    ДЛЯ НАЧАЛА Step 2.2A (не только перед 2.2B). Никакая реализация
    `reverse.*` (schema/module/entity) до approval ADR.)
2.  **Reverse Marketplace ADR — STRICT REVIEW** — ✅ DONE (APPROVED WITH
    REVIEW FIXES; ADR-0012 → Accepted)
3.  **Step 2.2A — Seller Commercial Capabilities & Destination Coverage** ✅ STRICT REVIEW COMPLETED — APPROVED
    (limited-scope rule: capabilities — легковесные seller-declared
    декларации (destination coverage + service categories); capability ≠
    inventory; matching НЕ зависит от live Product/inventory и НЕ требует
    нормализованных unit/tariff/period структур 1.8A–D; DD-028 может
    обеспечить словарь destinations при design 2.2A — не блокер)
4.  **Step 2.2A — STRICT REVIEW** — ✅ DONE (APPROVED WITH REVIEW FIXES)
5.  **Step 2.2B — Buyer Request / Reverse Marketplace Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES
6.  **Step 2.2B — STRICT REVIEW** ✅ DONE (APPROVED WITH REVIEW FIXES)
7.  **Step 2.2C — Buyer Request Matching & Distribution** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES
8.  **Step 2.2C — STRICT REVIEW** ✅ DONE (APPROVED WITH REVIEW FIXES)
9.  **Step 2.2D — Seller Proposal Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES
10. **Step 2.2D — STRICT REVIEW** ✅ DONE (APPROVED WITH REVIEW FIXES)
11. **Step 2.2E — Buyer Request / Proposal Communication** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES
12. **Step 2.2E — STRICT REVIEW** ✅ DONE (APPROVED WITH REVIEW FIXES)
13. **DD-030 — Proposal → Canonical Sales Conversion Point (Architecture Decision)** ✅ RESOLVED (2026-08-11): target = **Opportunity (OPP-*)** — Lead отклонён (дубликат BuyerRequest-demand; шаг назад в воронке), Quote отклонён как первая точка (требует Product/Tariff → shadow product; Proposal non-binding), Opportunity подтверждён (leadId nullable, без Product, first qualified deal). Решение: `docs/prompts/DD-030_PROPOSAL_TO_CANONICAL_SALES_CONVERSION_POINT_ARCHITECTURE_DECISION.md`
14. **Step 2.2F — Proposal → Canonical Sales Conversion** ✅ DONE (2026-08-11; target = **Opportunity (OPP-*)**, затем Quote → Checkout → Sale → OrderRequested → Order → Booking; регрессия 744/744 e2e + 380 unit + 135 frontend + build + migrate drift 0)
15. **Step 2.2F — STRICT REVIEW** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-11; FIX 1–5 — см. Step 2.2F)
16. **Service Templates return point (conditional):** ▶ NEXT (active item) — разрешить
    implementation-time gates DD-025/Step 1.8A, DD-024/Step 1.8B,
    DD-026/Step 1.8C, DD-027/Step 1.8C (multi-date holds → 2.4/2.5
    contract), DD-028 taxonomy ownership, DD-029 multi-currency display.
17. **Step 1.8A — Service Template / Seller Commercial Structure Foundation**
18. **Step 1.8A — STRICT REVIEW**
19. **Step 1.8B — Tariff / Commercial Variant Foundation**
20. **Step 1.8B — STRICT REVIEW**
21. **Step 1.8C — Period Pricing & Period Availability Foundation**
22. **Step 1.8C — STRICT REVIEW**
23. **Step 1.8D — Commercial Restrictions / Overrides Foundation**
24. **Step 1.8D — STRICT REVIEW**

**Step 2.8A conditional dependency (детерминированный дефолт):** date-based
period pricing/availability НЕ требует Step 2.8A; time-slot / exact
departure / timezone-aware availability ЗАВИСИТ от Step 2.8A time model.
**Детерминированное поведение:** на этом этапе Step 1.8C ОГРАНИЧЕН
date-based семантикой; time-slot-часть явно отложена и реализуется только
после выполнения Step 2.8A (в основной последовательности после возврата).
Никакого перехода к 2.8A раньше времени по усмотрению агента — если дизайн
1.8C всё же потребует time-slot, это БЛОКИРУЕТ продвижение и требует
отдельного решения (не «молчаливого jump»).

**Return to original Phase 2 sequence:** после блоков Reverse Marketplace
(2.2A–2.2F) и Commercial Modeling (1.8A–1.8D) —

`RETURN TO ORIGINAL SEQUENCE AT: Step 2.6 (Remove Bootstrap Order Creation)`

Rationale: 2.6 зависит только от 2.5/2.5A/2.5B (canonical Order creation +
propagation — complete) и НЕ имеет зависимостей на 2.2A–2.2F / 1.8A–1.8D
(Reverse Marketplace dependency analysis: 2.2A–F не блокируют Order consumer;
Service Templates analysis: 1.8A–D требуются до 3.29/3.29I UI, что
удовлетворяется независимо от позиции). Далее основная последовательность
продолжается: 2.6 → 2.7 → 2.8 → 2.8A (time model) → 2.9 → 2.9A → … →
3.29 серия (Partner Cabinet Full).

## Dependency Analysis (Roadmap Amendment: Reverse Marketplace)

Текущее состояние на момент amendment:

-   2.1 completed; 2.2 completed; 2.3 completed; 2.3A completed;
    2.3B completed; 2.4 completed; **2.5 НЕ начат**.

Порядок реализации НЕ выводится из нумерации (§4 STRICT REVIEW):
2.2A–2.2F — **логическая архитектурная позиция** (request-led upstream
acquisition path), НЕ индикатор последовательности реализации; они
вставлены после 2.2 документно, но не реализованы (NOT IMPLEMENTED) и
НЕ делают завершённые 2.3/2.3A/2.3B/2.4 ретроспективно неполными — те
остаются completed.

-   2.2A–2.2F — логически upstream acquisition/Sales capabilities
    (request-led demand path).
-   Step 2.5 — downstream completion уже активного `OrderRequested`
    flow (product-led path).

**Явное решение:** если не обнаружится реальная жёсткая зависимость,
сохраняется возможность выполнить Step 2.5 ПЕРЕД реализацией Reverse
Marketplace. 2.2A–2.2F не блокируют Order consumer. Единственная точка
соприкосновения на момент amendment — Step 2.5B (acquisition channel
`BUYER_REQUEST`): он добавляется аддитивно в существующий список
channel-значений и не требует изменения 2.5/2.5A. Жёсткие зависимости,
требующие переупорядочивания, на текущий момент НЕ выявлены.

**Prerequisite для 2.2A–2.2F (STRICT REVIEW):** перед началом реализации
Reverse Marketplace требуется **формальный ADR** о введении нового
bounded context `reverse.*` (новое PostgreSQL-схема-домен по ADR-0001;
прецедент — ADR-0011 для `communication.*`). **Создан и утверждён:
`docs/adr/ADR-0012-reverse-marketplace-bounded-context.md`** (✅ APPROVED
— ADR-0012 STRICT REVIEW). Ownership Reverse Marketplace сущностей закрыт
решением ADR-0012 (не «recommended»); prerequisite выполнен. Это
единственный блокирующий prerequisite для 2.2A–2.2F; Step 2.5 он НЕ
затрагивает.

## Dependency Analysis (Roadmap Amendment: Service Templates / Period Pricing & Availability)

Логическое размещение Steps 1.8A–1.8D — рядом с Catalog foundation
(документно после Step 1.8), НО это НЕ индикатор последовательности
реализации: добавления аддитивны, не отменяют завершённую Phase 1, НЕ
блокируют Step 2.5 (Order Creation Consumer) и не делают
2.3/2.3A/2.3B/2.4/2.5 ретроспективно неполными.

Рекомендуемый порядок реализации: `2.5 → 2.5A → 2.5B → Reverse
Marketplace ADR → 2.2A–2.2F →` затем коммерческий template/rate-plan/
period work в первой безопасной точке расширения Catalog/Partner —
ДО того, как Marketplace/Partner UI начнёт зависеть от period-aware
price/availability (в частности, до 3.29/3.29I Partner Cabinet UI-шагов
и period-aware Marketplace display).

**Dependency review (проведено):**

-   `CategorySchema` — целевой кандидат расширения (template structure;
    вложенность/repeatable Seller units — вопрос DD-025);
-   `Product` — не дублируется; коммерческая единица/unit identity —
    отдельный вопрос (DD-025);
-   `Tariff` — кандидат на канонический Rate Plan (DD-024); никаких
    duplicate concepts под новыми именами;
-   `Availability`/`AvailabilityReservation` — period inventory
    reconcile с Step 2.4 foundation; второй hold engine запрещён;
-   Quote/CheckoutIntent/Sale snapshot — binding authority без reprice
    (Step 2.3/2.3A/2.4) сохраняется;
-   Order/Booking — только canonical pipeline (2.5/2.8);
-   Step 2.8A — service-date semantics совместимы (date-only UTC);
-   Partner Cabinet — workflow Seller-а (select template → create/import
    own commercial entity → preserve original name → fill normalized
    attributes → Rate Plans → periods → price → availability → publish
    via existing moderation/lifecycle → update future periods);
-   Marketplace search/PDP — period-aware display («from N USD» по
    server-side правилу);
-   Reverse Marketplace capabilities/matching — capability ≠ inventory;
    matching использует normalized attributes/capabilities, НЕ live
    period inventory.

**Явное решение:** жёсткой зависимости, требующей переупорядочивания
1.8A–1.8D перед 2.2A–2.2F, на текущий момент НЕ выявлено. Если при
реализации 2.2A–2.2F потребуются normalized коммерческие атрибуты,
отсутствующие в текущей модели, — зафиксировать как explicit
prerequisite соответствующего шага (DD-025/DD-026 связка). 1.8A–1.8D
НЕ блокируют 2.5/2.5A/2.5B.

**Step 2.8A dependency (STRICT REVIEW):** date-based period
pricing/availability (1.8C) НЕ блокируется Step 2.8A (date-only UTC,
существующая семантика serviceDate совместима). Время-зависимая
granularity (time slot для Transfer, точное время departure,
timezone-семантика) ЗАВИСИТ от time-модели Step 2.8A (IANA timezone) —
это не «первая безопасная точка», а явная зависимость: time-slot
granularity 1.8C реализуется ПОСЛЕ/совместно с 2.8A.

**Ownership map (Roadmap Amendment: Service Templates / Period
Pricing & Availability):**

| Концепт | Owner | Замечание |
|---|---|---|
| Category / CategorySchema | Catalog | существующий owner; расширение для service templates — 1.8A; nesting/repeatable Seller units — DD-025 |
| Product | Catalog | существующий owner, не меняется |
| Seller commercial unit (Room/service-unit) | Catalog (кандидат) | first-class identity/lifecycle — DD-025; НЕ Product, НЕ attributes-JSON; source/external ID для импорта |
| Tariff / Rate Plan | Catalog | **Tariff = канонический коммерческий вариант (DD-024 verdict A), расширяется; никакой параллельной RatePlan-authority** |
| Commercial period / price | Catalog | периодная привязка — DD-026; price authority до binding — Catalog |
| Availability / AvailabilityReservation | Catalog | Step 2.4 foundation; multi-date hold future-compat — DD-027 |
| Normalized taxonomy | Catalog | словари — DD-028; Reverse Marketplace — consumer, не owner |
| Seller Commercial Capabilities | Reverse Marketplace (`reverse.*`) | существующий amendment; capability ≠ inventory |
| BuyerRequest / Proposal | Reverse Marketplace (`reverse.*`) | существующий amendment |
| Quote / Checkout / Sale | Sales | binding authority (2.3/2.3A/2.4); никакого reprice |
| Order / Booking | Order / Booking | canonical pipeline (2.5/2.8) |
| Finance | Finance | canonical pipeline |

Никакие два bounded context не владеют одним mutable fact.
