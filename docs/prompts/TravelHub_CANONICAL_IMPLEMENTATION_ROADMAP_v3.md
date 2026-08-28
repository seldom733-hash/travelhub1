# TravelHub --- CANONICAL MASTER IMPLEMENTATION PLAN v3

**Статус документа:** канонический Master Plan на хранение\
**Дата актуализации:** 2026-08-28 (Phase 3 Command Center C→J — COMPLETE; Step 3.0 ✅; Stages A–J ✅ COMPLETE; Step 3.29D ✅ COMPLETE — Billing Foundation; Post-H ✅; Post-I V2 ✅; Stage J VERDICT A — FINAL CLOSURE; Post-Phase-3 Roadmap Reconciliation COMPLETED 2026-08-25; Step 3.2 ✅ DEPLOYED; Step 3.1 ✅ APPROVED; Step 3.3 ✅ APPROVED; Step 3.3E ✅ APPROVED; Step 2.17C ✅ APPROVED; Step 2.7 ✅ APPROVED; Step 2.8 ✅ APPROVED; Step 2.8A ✅ APPROVED; Step 2.9 ✅ APPROVED; Platform CRM Shared Table Controls ✅ CLOSED; Platform CRM Operational Notes ✅ FULLY CLOSED; Step 3.5.3 Activity Timeline R2A ✅ CLOSED; Step 3.5.3 Activity Timeline R2B ✅ CLOSED; Step 3.5.3 Activity Timeline R2C ✅ CLOSED; Step 3.5.3 Activity Timeline R2C.2R ✅ CLOSED; Step 3.5.3 Activity Timeline R2D ✅ CLOSED; Step 3.5.3 Activity Timeline R2E ✅ CLOSED; Step 3.5.3 R2E.2R ✅ SUPERSEDED; Step 3.5.3 R2E.2R.1 ✅ SUPERSEDED; Step 3.5.3 R2E.2R.2A ✅ CLOSED; Step 3.5.3 RE-CLOSED; Step 3.5A ✅ COMPLETE; Step 3.5B ✅ COMPLETE; Step 3.5C ✅ COMPLETE)\
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

· **Step 1.8A --- Service Template / Seller Commercial Structure Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-11; Roadmap Amendment: Service Templates / Period Pricing & Availability, post-baseline addition; реализовано: `ServiceUnit`/`SellerCommercialUnit` (catalog.*, префикс `UNI-*`, зарегистрирован в ID-registry), source+externalKey import identity, verbatim seller name + normalized attributes, schema snapshot, lifecycle create/list/get/update/publish/archive, own-scope PARTNER + internal; STRICT REVIEW FIXES: атомарные conditional updates по status (update/publish/archive — TOCTOU §34/§35), update-перевалидация по unit-снапшоту (не Product-снапшоту, §13), честная документация version/CAS и cascade-безопасности (§30/§31), e2e §49.30–32 (update-vs-publish race, product-state-vs-publish race, cascade/delete safety); регрессия 770/770 e2e + 395 unit + 135 frontend + build + migrate 37/37 drift 0; детали — `docs/architecture/service-unit-foundation.md`)\
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
**GATE RESOLVED (2026-08-11, DD-025):** требуется НОВАЯ Catalog-owned сущность
`ServiceUnit`/`SellerCommercialUnit` (CategorySchema — плоский JSON, без
unit-уровня); живёт в catalog.* (ADR не требуется); identity + code-prefix
регистрируются при реализации; `source+externalKey` для import-reconcile;
имя Seller-а verbatim; normalized unit-attributes из шаблона. См.
`docs/architecture/service-templates-decision-gates.md` §1.· **Step 1.8B --- Rate Plan / Commercial Variant Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; Roadmap Amendment: Service Templates / Period Pricing & Availability, post-baseline addition; **Universal Pricing Model Amendment INTEGRATED — 1.8B владеет Rate Plan foundation, см. `docs/architecture/universal-pricing-model.md`**; реализовано: `Tariff` = canonical Rate Plan (DD-024 extend) — `serviceUnitId` (аддитивная привязка к ServiceUnit, сервер-валидация product+ownership+не-ARCHIVED), `priceBasis` (одиночный тег, category-allowlist через `CategorySchema.tariffRules.allowedBases`), `refundability`, `pricingMode FIXED/PRICE_ON_REQUEST` (явное inquiry-only состояние, missing ≠ POR), `status ACTIVE/ARCHIVED` (soft commercial state; публикация наследуется из родительской цепочки), `inclusions`/`restrictions` (structured metadata whitelist, engine — 1.8D), `TariffHistory` (audit by default; **ON DELETE RESTRICT — §52**); permission `catalog.rate_plan.publish` (archive/activate, staff/ADMIN); PARTNER — own-scope reuse catalog.product.*, коммерческие правки только под DRAFT Product; legacy `Tariff.price/currency/validFrom/validTo` сохранены как legacy/base (STRICT REVIEW §50), Quote совместимость подтверждена e2e; STRICT REVIEW FIXES: §39 version-CAS (lost-update → 409), §52 delete-safety (история не стирается), §22 POR-видимость (inquiry-only price:null, не over-hiding), §42 unit-eligibility (DRAFT/ARCHIVED unit → план скрыт), §46 Quote gate (ARCHIVED/PRICE_ON_REQUEST не связывают числовой Quote — resolveEligibleTariff, e2e #26B); нет CommercialPeriod/calendar/overrides/resolver/availability (1.8C/1.8D); событий нет; регрессия 807/807 e2e + 415 unit + 135 frontend + build + migrate 38/38 drift 0; детали — `docs/architecture/rate-plan-foundation.md`)\
Коммерческий вариант единицы (рабочее имя `RatePlan` / `CommercialVariant`;
финальное имя НЕ заморожено): meal plan, refundable/non-refundable,
cancellation policy ref, included services, commercial restrictions,
price basis. Rate Plan принадлежит/ссылается на реальную коммерческую
единицу Seller-а; НЕ равен Product/Room/Quote/Checkout/Sale. Перед
реализацией решить (DD-024): является ли существующий `catalog.Tariff`
уже каноническим Rate Plan (тогда extend, без duplicate concepts под
новыми именами). Category-dependent extensibility; перечисление
значений НЕ frozen.
**GATE RESOLVED (2026-08-11, DD-024/DD-026/DD-029):** Tariff = канонический
Rate Plan (расширять: meal plan/refundability/cancellationPolicyId ref/
restrictions/priceBasis/occupancy; параллельная RatePlan-сущность запрещена).
Price basis — на уровне Tariff; одна валюта на Rate Plan (binding без
конверсии; display — same-currency «from N», FX deferred). source (MANUAL/
IMPORT/API_SUPPLIER/CHANNEL_MANAGER) ≠ rule (FIXED/PERIOD/DATE_OVERRIDE/
DAY_OF_WEEK/OCCUPANCY/PAX/…); PRICE_ON_REQUEST — типизированное состояние,
не ноль/маркетинг. См. `docs/architecture/service-templates-decision-gates.md` §2/§3/§6.
**UNIVERSAL PRICING (amendment, 2026-08-11) — 1.8B реализует:** привязку
`Tariff.serviceUnitId` (Rate Plan attach к ServiceUnit); Seller-defined
Rate Plan name verbatim; commercial currency (одна на план); price basis
(Rate Plan-level, enum-имена финализируются здесь); refundability;
cancellation-policy ref; inclusions/meal plan где категория поддерживает;
commercial restrictions; PRICE_ON_REQUEST как типизированное состояние
(inquiry-based, отличное от missing-price); совместимость с future
CommercialPeriod (1.8C). НЕ реализует periods/availability (1.8C) и
restrictions-engine (1.8D).
**UNIVERSAL PRICING STRICT REVIEW (2026-08-11) — legacy `Tariff.price` transition:**
существующие `Tariff.price/currency/validFrom/validTo` сохраняются как
**legacy/base price** (совместимость legacy Product/Tariff; Quote продолжает
снапшотить с Tariff). 1.8B расширяет Tariff **аддитивно** (НЕ удаляет, НЕ
переосмысляет legacy price); после ввода CommercialPeriod (1.8C): при наличии
релевантных period-фактов authoritative — period price; при отсутствии — legacy
`Tariff.price` = base/FIXED fallback. Никакой destructive migration;
legacy-safe реализация 1.8B не блокируется. Детали —
`docs/architecture/universal-pricing-model.md` §17.

· **Step 1.8C --- Period Pricing & Period Availability Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; `catalog.CommercialPeriod` CPR-*, deterministic resolver DATE_OVERRIDE>narrower PERIOD>DAY_OF_WEEK>base, period price freezes at Quote ISSUE (нет reprice из текущего Catalog после binding — FIX §44), public priceFrom period-aware UTC-consistent (FIX §50), QuoteItem.serviceDate provenance (FIX §41); регрессия 838/838 e2e + 430 unit + 135 frontend + build + migrate 40/40 drift 0; time-slot deferred до 2.8A; см. `docs/architecture/period-pricing-foundation.md`)\
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
**GATE RESOLVED (2026-08-11, DD-026/DD-027):** `CommercialPeriod` (catalog.*,
tariffId + [validFrom,validTo] date-only inclusive, price/currency/basis);
precedence детерминирована: DATE_OVERRIDE > явный PERIOD (уже диапазон
выигрывает) > DAY_OF_WEEK* > сезон/base PERIOD > FIXED; overlapping
same-priority → 422 на write; (*DAY_OF_WEEK — условие внутри периода, см.
Universal Pricing STRICT REVIEW ниже); missing price не фабрикуется (unavailable /
PRICE_ON_REQUEST). Multi-date: N ночей → N reservation-строк в одной tx
(существующий conditional-UPDATE механизм Step 2.4; второй hold engine НЕ
вводится); контракт `OrderRequested.reservationIds` ревизуется (cardinality =
все allocated units/dates); DATE_ONLY — безопасна для 1.8C, time-slot/
departure — гейт 2.8A; inventory unit category-dependent; price ≠
availability (stop-sell ≠ удаление цены). См. `docs/architecture/service-templates-decision-gates.md` §3/§4.
**Universal Pricing STRICT REVIEW (2026-08-11) — DAY_OF_WEEK semantics уточнена:**
DAY_OF_WEEK реализуется как **условие ВНУТРИ периода** (не отдельный глобальный
слой иерархии): период с day-of-week-условием специфичнее «голого» сезонного
периода того же диапазона; итоговый порядок ЭКВИВАЛЕНТЕН иерархии выше
(weekend-правило специфичнее base-сезона), но разрешается единым механизмом
специфичности, без двух интерпретаций. Overlap: одинаковый уровень
специфичности → 422; разный (narrower range / exact condition) → разрешён
(«Summer+occupancy ANY» и «Summer+occupancy 2» НЕ конфликтуют — второй
специфичнее). Детали — `docs/architecture/universal-pricing-model.md` §7.
**UNIVERSAL PRICING (amendment, 2026-08-11) — 1.8C реализует:** `CommercialPeriod`/date pricing; fixed/base price compatibility (FIXED как base); **annual/seasonal calendar как first-class workflow (commercial periods, НЕ 365 дат вручную; applicable всем категориям)**; date overrides (holidays/events, без правки base-сезона); deterministic precedence по amendment §7 (exact override > специфичное условное > PERIOD > DAY_OF_WEEK-условие > FIXED; same-priority overlap → 422); category-supported conditions (day-of-week/occupancy/PAX/duration/tier где категория позволяет, через CategorySchema); availability relationship (price ≠ availability; stop-sell ≠ удаление цены); multi-date atomic hold compat (N ночей → N holds, DD-027, единый Step 2.4 engine); date-only boundary до 2.8A. НЕ реализует restrictions-engine (1.8D), supplier/API/динамику, FX.

· **Step 1.8D --- Commercial Restrictions / Overrides Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; Roadmap Amendment: Service Templates / Period Pricing & Availability, post-baseline addition; реализовано: `catalog.CommercialRestriction` CRS-* — BASE факты остаются в `Tariff.restrictions` (1.8B), entity = scoped override PERIOD/DATE; typed `STOP_SELL` (DATE-only; периодный stop-sell = 1.8C sellable) / `MIN_STAY` / `ADVANCE_BOOKING` / `CLOSED_TO_ARRIVAL` / `CLOSED_TO_DEPARTURE`; precedence DATE > PERIOD-attached (resolved period 1.8C) > BASE, same-tier duplicate → 422; pure evaluator `restriction-evaluation.ts` (fail-closed: min-stay/CTD без durationDays → 422); Quote pre-binding 422 + `QuoteItem.restrictionSnapshot` (frozen provenance, §44 freeze сохранён — post-ISSUE Seller-edit не инвалидирует КП); priceFrom eligible-set (fully-stop-sold / advance-window исключены, JS+SQL согласованы); CategorySchema `allowedRestrictions` (DD-028) + гейт на base-метаданные; version-CAS + advisory lock; history Restrict; STRICT REVIEW FIXES: §42 range stop-sell (interior stop-sold дата блокирует multi-day Quote), §44/§51 activate parent-eligibility guard (ARCHIVED период/tariff → 409), §21 точная override-семантика (numeric replace vs presence-add; negative override — extension point), §18 default-all категорийная политика документирована, priceFrom base-boundary документирован; регрессия 859/859 e2e + 459 unit + 135 frontend + build + migrate 42/42 drift 0; детали — `docs/architecture/commercial-restrictions-overrides-foundation.md`)\
Минимальные stop-sell и override-модель; extension points для future
stay/advance-booking/closed-to-arrival/closed-to-departure restrictions;
НЕ revenue-management engine, НЕ channel-manager rules engine.
Overlap-резолюция overlapping periods и server precedence base period vs
date override — server-authoritative, детали deferred до реализации.
Audit/history для изменений sellable terms (price/availability/stop-sell/
commercial period/Rate Plan status) — по контракту Step-а.
**GATE RESOLVED (2026-08-11, DD-026/DD-028):** server-side resolver —
единственный authoritative (frontend НЕ считает binding price); precedence
как в §1.8C; gap/conflict — детерминированные (422, отсутствие цены →
unavailable/PRICE_ON_REQUEST); normalized словари — Catalog-owned (Reverse
2.2A только читает). См. `docs/architecture/service-templates-decision-gates.md` §3/§5.
**UNIVERSAL PRICING (amendment, 2026-08-11) — 1.8D совместим с:** resolved
server pricing (resolver §8 universal-pricing-model.md), Marketplace display
(«from N» server-side), Partner publication/consumption contract; stop-sell
≠ удаление цены; restrictions (min-stay/advance-booking/closed-to-arrival-
departure) — коммерческие ограничения Rate Plan, НЕ merged в Availability
counts и НЕ в price rows; не расширяется сверх необходимо о.

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
**Статус: APPROVED (ADR-0008; реализовано: StorefrontBehavioralEvent + MarketplaceBehavioralEvent, migrations `add_storefront_behavioral_events`/`add_marketplace_behavioral_events`; e2e storefront-behavioral/marketplace-behavioral; подтверждено Phase 1 Exit Audit (1.18) + Phase 2 Entry Audit (2.0); маркер отсутствовал — ROADMAP STATUS STALE, COMPLETION VERIFIED 2026-08-12).**

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
**Статус: APPROVED (2026-08-09; артефакт — docs/architecture/phase1-exit-audit.md; Verdict: READY FOR 1.18A; DoD-матрица, RBAC exit gate, fresh install proof, регрессия 28 suites/438 e2e + 230 unit; маркер «не начат» устарел — ROADMAP STATUS STALE, COMPLETION VERIFIED 2026-08-12).**

· **Step 1.18A --- Phase 1 Analytics Readiness Gate**\
Доказать, что Product/Moderation/Partner/Buyer/Seller/Storefront имеют
достаточные timestamps/events/history. Не переходить в Phase 2 с
невосстановимой историей lifecycle transitions.
**Статус: APPROVED (2026-08-10; артефакт — docs/architecture/analytics-readiness.md; Verdict: PASS; READY-матрица Product/Moderation/Partner/Buyer/Seller/Storefront/behavioral; legacy NULL сегментирован без фабрикаций; маркер отсутствовал — ROADMAP STATUS STALE, COMPLETION VERIFIED 2026-08-12).**

------------------------------------------------------------------------

# PHASE 2 --- CORE COMMERCIAL FLOW

**Цель:** Marketplace/Storefront → Sales → Order → Booking → Finance →
Documents.

· **Step 2.0 --- Phase 2 Entry Audit**\
Проверка Phase 1, migrations, RBAC, events, legacy endpoints и
готовности Sales/Order/Booking/Finance.
**Статус: APPROVED (2026-08-10; артефакт — docs/architecture/phase2-entry-audit.md; Verdict: PHASE 2 STEP 2.0 ENTRY AUDIT PASSED WITH STEP-LOCAL PREREQUISITES — READY FOR FIRST PHASE 2 IMPLEMENTATION STEP; e2e phase2-entry-audit; маркер отсутствовал — ROADMAP STATUS STALE, COMPLETION VERIFIED 2026-08-12).**

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
**Статус: ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; отчёт — PHASE_2_STEP_2.6_REMOVE_BOOTSTRAP_ORDER_CREATION_STRICT_REVIEW.md; единственный production writer — canonical OrderRequested consumer; `order.import` удалён; регрессия 863/863 e2e + 459 unit + 135 frontend + build + migrate 42/42; см. «Полная авторитетная последовательность после 2.5B» ниже).**

· **Step 2.7 --- Order Lifecycle Completion**\
Backend lifecycle, stable codes, guards, history, SLA,
`OrderReadyForBooking`, `BookingRequested`, `OrderFulfilled`,
`OrderClosed`.
**Статус: ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; независимый adversarial-аудит — отчёт `docs/prompts/PHASE_2_STEP_2.7_ORDER_LIFECYCLE_COMPLETION_STRICT_REVIEW_REPORT.md` (RETROSPECTIVE EVIDENCE RECONSTRUCTION: оригинальный отчёт-артефакт отсутствовал, результаты реконструированы из committed evidence, implementation/review-fixes верифицированы в commit `1bc19b7`); REVIEW FIXES: §28 forged server-owned поля → 422 (assertNoForbiddenKeys, order.validation.ts), §40/§29/§33/§37 добавлены e2e concurrent confirm / send-vs-cancel / fulfill race / BUYER_REQUEST / legacy null-acquisition / MODERATOR; §13 boundary подтверждён — pre-existing Phase 1 BookingRequested consumer канонизируется в 2.8; регрессия 895/895 e2e + 459 unit + 135 frontend + build + migrate 42/42 drift 0; детали — `docs/architecture/order-lifecycle-completion.md`).**

· **Step 2.8 --- BookingRequested → Booking Creation**\
Booking создаётся только по `BookingRequested`; связь OrderItem ↔
Booking без нарушения ownership.
**Статус: ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-12; независимый adversarial-аудит — отчёт PHASE_2_STEP_2.8_BOOKINGREQUESTED_TO_BOOKING_CREATION_STRICT_REVIEW.md; канонизация pre-existing Phase 1 consumer `booking.subscribers.ts` — ЕДИНСТВЕННЫЙ create-механизм (write-path audit: один `booking.create`, категория 5 = 0; POST /bookings не существует); кардинальность 1 OrderItem → 1 Booking (DB unique `Booking.orderItemId`, миграция 20260812140000_add_booking_order_item_link, аддитивная, nullable для legacy); frozen факты verbatim (acquisitionSource DIRECT/BUYER_REQUEST/null без fabrication, amount = item.amount Decimal без reprice); Passenger из COMPLETE OrderTraveler (non-traveler — без placeholder); идемпотентность Inbox + count-check + DB unique (P2002 no-op ТОЛЬКО для `Booking_orderItemId_key`/`InboxEvent_consumerId_eventId_key` через shared `uniqueConstraintNames` — оба Prisma shape; прочие unique-дефекты → FAILED); failure atomicity — весь OrderRequest в одной consumer-транзакции; BookingCreated ровно одно на обработку (без PII, correlation наследуется, causation = BookingRequested.eventId, actor SYSTEM); §28 forbidden-key 422 на PATCH /bookings (booking.validation.ts) + Order-команды (order.validation.ts); event authority — durable BookingRequested без live-state gate (race cancel после send → Booking остаётся, компенсация 2.9); legacy-совместимость (orderItemId NULL, null acquisition); 2.8A-boundary соблюдён (serviceStartsAt/EndsAt/Timezone — только forbidden keys); регрессия 909/909 e2e + 459 unit + 135 frontend + build + migrate 43/43 drift 0; детали — `docs/architecture/booking-requested-to-booking-creation.md`; e2e `booking-requested-consumer` (14 тестов); Step 2.8A НЕ начат).**

· **Step 2.8A --- Booking Service Date / Time Model**\
Отдельно entity creation time и время услуги: `serviceStartsAt`,
`serviceEndsAt`, `serviceTimezone`; `DATE_ONLY`, `TIME_SLOT`,
`DATE_RANGE`, `OPEN_DATE`; capacity/slot reservation. IANA timezone.\
**Статус: ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-13; имплементация: frozen service occurrence пропагируется цепочкой Catalog → Quote → CheckoutIntent → Sale → OrderRequested → Order → BookingRequested → Booking; authority timezone = `Product.serviceTimeZone` (IANA, Intl.supportedValuesOf) → frozen в CheckoutIntent при binding → verbatim дальше (никакого browser/locale/IP/offset authority; forged zone/instant → 422); temporal vocabulary `serviceDate` (date-only) + `serviceTime`/`serviceEndTime` (local HH:mm) + `serviceTimeZone` (IANA) + `serviceStartsAt`/`serviceEndsAt` (derived UTC instants, Intl-оффсеты БЕЗ ручной арифметики; DST ambiguous → ранний instant, nonexistent → сразу после разрыва; date-only → NULL, 00:00 НЕ фабрикуется §7); `serviceTimeType` DATE_ONLY (default, корректно классифицирует legacy)|TIME_SLOT|OPEN_DATE|DATE_RANGE (зарезервирован); деривация — ОДИН раз в consumer-е BookingRequested из frozen фактов (инвариант local↔UTC §13); миграции 20260812212139_add_booking_service_time_model + add_product_draft_service_time_zone (аддитивные, nullable; 45/45 drift 0); продакшн PATCH /orders|/bookings и checkout service-date — forbidden temporal keys → 422; OrderRequested +serviceTime/serviceEndTime/serviceTimeZone (валидация consumer-а: time требует zone + serviceDate, endTime требует time; дефект ленты → FAILED); BookingCreated НЕ расширен; TimeSlot/slot-capacity/reschedule — вне 2.8A (гейты); регрессия 949/949 e2e (54 suite, вкл. booking-service-time-model 40 тестов) + 475 unit + 135 frontend + build + drift 0; STRICT REVIEW 2026-08-13 — независимый adversarial-аудит: 0 дефектов (3 документационные уточнения: mixed/no-zone quote → order-level zone freeze; clear-time требует явный serviceEndTime:null; ±12h window — теоретический лимит); отчёт `docs/prompts/PHASE_2_STEP_2.8A_BOOKING_SERVICE_DATE_TIME_MODEL_STRICT_REVIEW.md`; детали — `docs/architecture/booking-service-time-model.md`; NEXT = Step 2.9).**

· **Step 2.9 --- Booking Lifecycle Completion** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-13; каноническое evidence: полная запись — раздел 29B, отчёт — `docs/prompts/PHASE_2_STEP_2.9_BOOKING_LIFECYCLE_COMPLETION_STRICT_REVIEW_REPORT.md` (RETROSPECTIVE EVIDENCE RECONSTRUCTION, verified commit `1bc19b7`), архитектура — `docs/architecture/booking-lifecycle-completion.md`; header-status repair 2026-08-15 — синхронизация с persisted canonical evidence; исторический датированный лог (2026-08-13 «WAITING FOR STRICT REVIEW») не переписан)\
Supplier processing, confirmation, clarification, rejection,
change/cancellation, fulfillment, обратные события Order.

· **Step 2.9A --- Booking Temporal Contract** ✅ APPROVED (STRICT REVIEW, 2026-08-13; 5 сервер-owned milestones `requestedAt/confirmedAt/rejectedAt/cancelledAt/completedAt` на Booking; first-only внутри той же CAS-transaction, что и переход статуса; born-CANCELLED `cancelledAt=createdAt`; компенсация Order-cancel пишет `cancelledAt` CAS; forged milestone PATCH → 422 (forbidden keys уже покрывали); UTC instants; `updatedAt` ≠ бизнес-дата; migration 46_booking_temporal_milestones (5 аддитивных DateTime?, backfill N/A); e2e booking-temporal-contract 18/18 (negative §41 + positive §42 + concurrency §38 + lifecycle matrix §40; гонки confirm/confirm, confirm/reject, confirm/cancel, complete/cancel, компенсация/confirm — один победитель, ровно один milestone, без raw 500; duplicate compensation replay идемпотентен; acquisition frozen; детали — `docs/architecture/booking-temporal-contract.md`; NEXT = STEP 2.10)\
`createdAt`, `requestedAt`, `confirmedAt`, `rejectedAt`, `cancelledAt`,
`completedAt`, history/SLA timestamps.

· **Step 2.10 --- Finance Domain Foundation** ✅ APPROVED (STRICT REVIEW, 2026-08-13; FIX 1: createCurrency race P2002 → controlled 409 вместо raw 500 (e2e 6A [201,409]); country-контракт alpha-2 доказан e2e (locale `az` → 422, alpha-3/locale-tag → 400); PaymentTerms boundary задокументирован в arch doc (SAFE PLACEHOLDER: источник — frozen 2.3B снапшот; материализация в 2.12 ТОЛЬКО как проекция, никогда пересчёт); остальное по implementation: модуль finance.*, 10 foundation-моделей (Currency/ExchangeRate/Tax/TaxRule + Payment/PaymentTerms/Refund/Invoice/Commission/CommissionAccrual schema-only), master-data CRUD (CUR-/FXR-/TAX-/TXR-), деньги = Decimal-строки, forged server-owned поля → 422 (raw-body), duplicate isoCode → 409, RBAC `finance.*.manage` (FINANCE/ADMIN; DIRECTOR read-only), write-пути Payment/Refund/Invoice/Settlement/Payout/LedgerTransaction → 404, события НЕ эмитятся, migration `add_finance_domain_foundation` (аддитивная, replay-proof), e2e finance-domain-foundation 12/12 + unit 15/15, полный serial e2e 1024/1024, unit 490, frontend 135, миграции 47/47 diff clean; детали — `docs/architecture/finance-domain-foundation.md`; NEXT = STEP 2.10A)\
Finance владеет Payment `PAY-*`, PaymentTerms `PMT-*`, ProviderFee
`PFE-*`, Refund `RFD-*`, Invoice `INV-*`, Commission `CMS-*`,
CommissionAccrual `CAA-*`, Settlement `STL-*`, Payout `POT-*`,
LedgerTransaction `LTX-*`, Currency `CUR-*`, ExchangeRate `FXR-*`, Tax
`TAX-*`, TaxRule `TXR-*`.

· **Step 2.10A --- Financial Ledger Foundation** ✅ APPROVED (STRICT REVIEW, 2026-08-13; FIX 1: duplicate key с РАЗНЫМ payload (amount/currency/sourceEventId/businessRef) → controlled 409 вместо молчаливого возврата существующего — first-write-wins + payload-верификация, e2e 9A; immutable append-only `finance.LedgerTransaction` `LTX-*`: amount>0 DECIMAL(12,2), currency-снапшот валидируется против finance.Currency, type/sourceType/sourceId/sourceEventId/businessRef/correlation/causation/actor, createdAt UTC; НЕТ updatedAt (append-only); единственный production writer — внутренний `LedgerService.create` (публичного POST нет; update/delete → 404); idempotency invariant @@unique(sourceType, sourceId, type) — replay/concurrent duplicate → существующий факт (no-op), неизвестный P2002 → controlled 409; read `finance.ledger.read` (FINANCE/DIRECTOR/ANALYST/ADMIN) — list (whitelist+пагинация) + detail; 0 доменных событий (нет consumer-ов); zero cross-domain writes (Order/Booking/Payment/Refund/Commission/availability не тронуты); migration `add_ledger_transaction_foundation` (аддитивная, replay-proof); e2e ledger-transaction-foundation 17/17 (RBAC/immutability/idempotency/concurrency/provenance/isolation/temporal/legacy); unit 492, serial e2e 1041/1041, frontend 135 + build; детали — `docs/architecture/ledger-transaction-foundation.md`; NEXT = STEP 2.10B)\
Append-only LedgerTransaction. Финансовая история не восстанавливается
из текущего Payment status.

· **Step 2.10B --- Settlement / Payout / Provider Fee Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-14; независимый adversarial-аудит — отчёт `docs/prompts/PHASE_2_STEP_2.10B_PROVIDER_FEE_SETTLEMENT_PAYOUT_FOUNDATION_STRICT_REVIEW_REPORT.md` (RETROSPECTIVE EVIDENCE RECONSTRUCTION: оригинальный отчёт-артефакт отсутствовал, результаты реконструированы из committed evidence, implementation/review-fixes верифицированы в commit `aeece37`); `finance.ProviderFee`/`Settlement`/`Payout` PFE-/STL-/POT-*, immutable факты без `updatedAt`, money DECIMAL(12,2) Decimal-строки, currency — ISO 4217 снапшот против `finance.Currency` (без FK), idempotency DB-unique (PFE: sourceType+sourceId+provider; STL/POT: sourceType+sourceId) first-write-wins + payload-верификация (divergent → 409), correlation/causation/actor server-authoritative (ADR-0010), единственный canonical writer — внутренний `SettlementService` (публичного POST нет; PATCH/DELETE → 404), read RBAC `finance.provider_fee.read`/`finance.settlement.read`/`finance.payout.read` (FINANCE/DIRECTOR/ANALYST/ADMIN), 0 доменных событий, ledger-автопостинг НЕ реализован (нет canonical engine; 2.10A append-only не нарушен), Payment Buyer vs Payout Partner — разные rails без связи, migration `add_provider_fee_settlement_payout_foundation` (аддитивная, replay-proof), e2e provider-fee-settlement-payout-foundation 13/13; REVIEW FIXES: audit action `finance.provider_fee.created` (snake_case, было `finance.providerfee.created` — конвенция finance.*), высокорисковые негативные тесты (divergent providerRef → 409 e2e #6b; concurrent divergent → один факт + 409 без raw 500 e2e #7b; unknown P2002 → controlled ConflictError unit; pagination whitelist pageSize>101/page=0/page=abc → 400), arch doc §5.1 — будущая эволюция idempotency-ключей (2.12G feeType-discriminator / 2.14A settlement version / 2.14B payout attempt — swap на пустых таблицах); 0 архитектурных блокеров (stop-conditions отрицательны; консервативные ключи при нуле producer-ов — эволюционируемы аддитивно); регрессия unit 495/495 + serial e2e 1055/1055 (59 suites) + frontend 135/135 + build + migrate 49/49 drift 0; детали — `docs/architecture/provider-fee-settlement-payout-foundation.md`; NEXT = STEP 2.10C — FINANCE TEMPORAL CONTRACT (не начинать в этом проходе)\

· **Step 2.10C --- Finance Temporal Contract** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-14; независимый adversarial-аудит — отчёт `docs/prompts/PHASE_2_STEP_2.10C_FINANCE_TEMPORAL_CONTRACT_STRICT_REVIEW_REPORT.md`; реализация — `docs/prompts/PHASE_2_STEP_2.10C_FINANCE_TEMPORAL_CONTRACT_IMPLEMENTATION_REPORT.md`; только Ledger `occurredAt` был обоснован и реализован: аддитивная nullable-колонка `LedgerTransaction.occurredAt` (business occurrence, UTC, отдельно от createdAt-персистенции; NULL = неизвестно, БЕЗ backfill; authority — server-валидированный ISO 8601; first-write-wins при identical replay — occurredAt вне replay payload-сравнения, §16; единственный writer — LedgerService.create; миграция `20260814090000_add_ledger_occurred_at` аддитивная; 0 доменных событий, 0 premature милстоунов, 0 cross-domain writes, 0 авто-постинга; REVIEW FIXES: (1) строгий ISO 8601 валидатор вместо lenient Date.parse — голый parse принимал date-only/locale/TZ-зависимые форматы (разные инстанты на разных машинах) и молча нормализовал невозможные даты (2026-02-30 → 03-02); теперь строгий regex + Date.parse range-check + round-trip проверка календарных компонентов (unit 16/16, e2e 3B расширен: offset Z/+02:00 → один instant после persistence, date-only/Feb 30 → reject, 0 строк); (2) concurrent temporal disagreement e2e 3D (same payload, разные occurredAt → один факт first-write-wins, без raw 500) и concurrent divergent amount e2e 3E (один факт + controlled ConflictError, без raw 500) — §14/§38; (3) api.md: документированы strict-ISO формы и future-time policy (occurredAt ≤ createdAt НЕ enforced — producer clock-skew легитимен); финальная регрессия unit 498/498, serial e2e 1059/1059 (59 suites), frontend 135/135 + production build, migrate 50/50 drift 0; арх-док `docs/architecture/finance-temporal-contract.md`; NEXT = STEP 2.11 — PRICING & FINANCIAL SNAPSHOT (не начинать в этом проходе))\
Roadmap-визион будущих милстоунов (producer-шаги 2.12–2.14, НЕ реализовано в 2.10C):
Payment: `createdAt/authorizedAt/capturedAt/failedAt/cancelledAt`;
Refund: `requestedAt/approvedAt/processedAt/failedAt`; Settlement:
`createdAt/eligibleAt/calculatedAt/settledAt`; Payout:
`createdAt/scheduledAt/processingAt/paidAt/failedAt`; Ledger:
`occurredAt` ✅ (реализован в 2.10C).

· **Step 2.11 --- Pricing & Financial Snapshot** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-14; независимый adversarial-аудит — отчёт `docs/prompts/PHASE_2_STEP_2.11_PRICING_FINANCIAL_SNAPSHOT_STRICT_REVIEW_REPORT.md`; реализация — `docs/prompts/PHASE_2_STEP_2.11_PRICING_FINANCIAL_SNAPSHOT_IMPLEMENTATION_REPORT.md`; HARD GATES PASS: единственный snapshot-owner — существующие агрегаты flow (freeze boundary = Quote ISSUE, downstream копирует verbatim), никакого money-god-object; единый money authority — sales.money.ts (finance.money переиспользует, payment-terms тот же ROUND_HALF_UP; 0 альтернативных rounding-helper-ов); quoteTotals (ISSUE) и validateFrozenSnapshot (binding) используют ОДНИ и те же функции — расхождение ISSUE↔gate математически невозможно; Booking.currency — аддитивная nullable-колонка, verbatim из OrderItem.currency (legacy NULL, без backfill, без re-lookup); миграция `20260814100000_add_booking_currency` аддитивная (fresh replay + drift 0); 0 новых событий/прав/cross-domain writes, 0 ledger-постинга, 0 premature Tax/FX/Commission/Payment/Refund/Invoice движков; REVIEW FIX (LOW, docs §44): арх-док §8/§12/§14 «пересчёт» → «верификация» (gate вычисляет expected и СРАВНИВАЕТ с frozen, не персистит пересчитанные суммы — нет второго money authority); зафиксированные наблюдения (без фикса, accepted risk / out-of-scope): Booking-consumer ISO-check может poison BookingRequested только для гипотетических pre-2.11 заказов с не-ISO валютой (новые flow блокируются ISO-гейтом checkout на 422; fail-loud — задуманное поведение), `.toFixed(2)` на входе Tariff.price (каталог 1.8B, вне scope 2.11); финальная регрессия: unit 508/508, serial e2e 1067/1067 (60 suites, +8 новых T1–T7), frontend 135/135 + production build, migrate 51/51 drift 0; NEXT = STEP 2.12 — PAYMENT FLOW (не начинать в этом проходе))\
Immutable snapshot: base price, taxes, discounts, commission policy,
currency/exchange rate, PaymentTerms. Product price changes не меняют
оформленную сделку (tax/FX/commission части — deferred до появления
canonical producer-ов, задокументировано в арх-доке).

· **Step 2.12 --- Payment Flow** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-14; независимый adversarial-аудит — `docs/prompts/PHASE_2_STEP_2.12_PAYMENT_FLOW_STRICT_REVIEW_REPORT.md` (55 секций): все hard gates PASS — единственный writer PaymentService (repo-wide 0 других payment update/upsert/delete), payable source frozen Order snapshot verbatim (0 reprice; T2 reprice-proof), cardinality isActivePayment + partial unique (attempt 2 после FAILED/CANCELLED, overpayment блокируется DB-level, concurrent duplicate → controlled 409), state machine PENDING → CAPTURED|FAILED|CANCELLED (CAS from-guard, AUTHORIZED/REFUNDED reserved unreachable), милстоуны first-only server-owned, PAID=CAPTURED (Order-owned projection на PaymentCaptured, Finance НЕ пишет order.*), 4 события PII-free, 0 Ledger/ProviderFee/Settlement/Payout/Refund/Invoice/Commission side-effects, 0 webhook/PSP-путей, миграция аддитивная (fresh replay, drift 0); REVIEW FIX (LOW, docs): RBAC-claim «OPERATOR read» исправлен на фактический (read — FINANCE/DIRECTOR/ANALYST/SALES_MANAGER/ADMIN; OPERATOR НЕ имеет finance.payment.*) в Roadmap/арх-док/отчёте; observations задокументированы (§18 no-op после CAPTURED — конвенция identical retry, DB backstop; §28 CAS-loss проекции — паттерн reconcile; §39 legacy DEFAULT true — таблица была пуста, 0 writer-ов до 2.12); регрессия unit 520/520 + serial e2e 1080/1080 (61 suites) + frontend 135/135 + build + migrate 52/52 drift 0; реализация — `docs/prompts/PHASE_2_STEP_2.12_PAYMENT_FLOW_IMPLEMENTATION_REPORT.md`; provider-neutral Payment runtime: Payment — Finance-owned (PAY-*, finance.payment.write; PSP/adapters/webhooks — 2.12A/2.12B, webhook-путей 0); payable source — frozen Order snapshot (amount/currency verbatim, 0 reprice из mutable Catalog/Tax/FX; Payment НЕ pricing authority); cardinality — один активный Payment на Order (managed boolean `isActivePayment` + partial unique `Payment_one_active_per_order`; overpayment protection; FAILED/CANCELLED → attempt 2 легален; concurrent duplicate → controlled 409, один факт; 2.12F переработает индекс — approved partial semantics не блокируются); единственный state-machine authority `PaymentService.transition` (CAS id+status+version, from-guard PENDING): PENDING → CAPTURED (paidAt) | FAILED (failedAt) | CANCELLED (cancelledAt); AUTHORIZED/REFUNDED — reserved vocabulary (2.12B/2.13); милстоуны paidAt/failedAt/cancelledAt (2.10C DEFER → 2.12), server-owned UTC, первый wins; PAID semantics = CAPTURED (деньги получены); Order projection — Order-owned subscriber на PaymentCaptured (paymentStatus=PAID, paidAmount=frozen; Finance НЕ пишет order.*); события PaymentCreated/Captured/Failed/Cancelled (outbox, correlation=server UUID, causation=null; payload refs+frozen money, без PII); mass assignment: forged money/status/milestones → 422; RBAC finance.payment.read/write (FINANCE/ADMIN write; read — FINANCE/DIRECTOR/ANALYST/SALES_MANAGER/ADMIN; OPERATOR НЕ имеет finance.payment.*; Buyer surface — 2.12B); миграция `20260814120000_add_payment_runtime` аддитивная (milestones + isActivePayment + PaymentHistory); 0 Ledger/ProviderFee/Settlement/Payout/Refund/Invoice/Commission/CommissionAccrual auto-post (boundaries), Booking/availability не тронуты; unit 520/520 (+12), serial e2e 1080/1080 (61 suites, +13 payment-flow T1–T13), frontend 135/135 + build, migrate 52/52 drift 0; арх-док `docs/architecture/payment-flow.md`; NEXT = STEP 2.13 — REFUND FLOW (не начинается в этом проходе))\
Payment intent/transaction lifecycle, связь с Order через Finance
contracts/events.

· **Step 2.12A --- Payment Provider Abstraction** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-15; независимый adversarial-аудит — отчёт `docs/prompts/PHASE_2_STEP_2.12A_PAYMENT_PROVIDER_ABSTRACTION_STRICT_REVIEW_REPORT.md`; HARD GATES PASS: single Payment lifecycle authority (PaymentService — единственный writer; provider/ 0 PaymentStatus/Prisma), AUTHORIZED unreachable (vocabulary «AUTHORIZE» — внешний факт, не доменный переход), frozen money authority (0 Decimal math в provider/), fake provider production isolation (DI-wiring proof: production registry пуст при boot), registry (unknown→404, duplicate→409, no fallback/default), provider-operation identity `deriveProviderOperationKey` pure/server-derived/retry-stable/divergent→409 (adversarial #18–21: insertion order, currency canonical, amount scale, payment/operation scoping), 2.12H boundary (0 HTTP idempotency runtime), 2.12B compatibility (race-матрица с инвариантами и владельцами), containment (0 webhook routes — route-graph audit T18; 0 SPLIT/Ledger/ProviderFee/Settlement/Payout/Refund/Dispute/Invoice; 0 events; 0 schema change), platform boundaries (0 RLS/schemaVersion/backup/load — ADR-0014/2.17A/2.17B); REVIEW FIXES (LOW, тесты/док): F1 e2e T19 runtime-code source audit (network/idempotency-runtime/PaymentStatus/PSP), F2 adversarial #21 — ключ ВСЕГДА server-derived (derive, не client-set), F3 T19 comment-stripped audit (runtime-only), OBS canonical representation («150.00»≠«150», «usd»≠«USD» — fail-loud; 2.12B adapter MUST canonicalize — задокументировано в arch doc); регрессия воспроизведена независимо: unit 619/619 (+4 adversarial), serial e2e 1153/1153 (66 suites, +T18/T19), frontend tsc + vitest 135/135 (0 изменений), backend tsc + build, migrate 56/56 drift 0; артефакт-интегрити 95 PASS / 0 WARN / 0 FAIL; детали — `docs/architecture/payment-provider-abstraction.md`; NEXT = STEP 2.12H — EXTERNAL API IDEMPOTENCY CONTRACT (2.12A → SR → 2.12H → SR → 2.12B); 2.12B/C НЕ начаты) — provider-neutral abstraction foundation: `PaymentProviderRegistry` (DI, explicit registration, unknown → 404, duplicate → 409, NO fallback/default), `KNOWN_PAYMENT_PROVIDER_CODES` = EMPTY (0 production PSP; 2.12B регистрирует адаптеры), capability model (AUTHORIZE/CAPTURE/DIRECT_CAPTURE/CANCEL/WEBHOOKS — 2.12B, REFUND — 2.13, NATIVE_SPLIT — 2.12C; capability ≠ behavior), normalized request/result/error contracts (frozen money verbatim, explicit retryability, DECLINED — бизнес-outcome не из internal exception, 0 raw SDK objects), provider-operation idempotency identity `deriveProviderOperationKey` (server-derived, stable, not client-forgeable, divergent params → controlled 409), PSP-local multi-instance race-контракт задокументирован (webhook dedup / create-payment race / callback reorder → 2.12B; system-wide outbox worker → 2.17), 2.12H handoff зафиксирован (external Idempotency-Key — hard prerequisite 2.12B, НЕ реализован здесь), FakePaymentProvider TEST-ONLY (недоступен в production конфигурации), 0 real network / 0 webhook routes / 0 SPLIT / 0 Ledger / 0 ProviderFee / 0 Settlement/Payout / 0 Refund/Dispute mutation / 0 secrets / 0 domain events / 0 schema change (migration N/A, drift 0); RBAC/public surface НЕ расширен; RLS НЕ реализован (ADR-0014); unit 615/615 (+17 payment-provider), serial e2e 1151/1151 (66 suites, +17 payment-provider-abstraction T1–T17), targeted finance e2e 119/119, frontend tsc + vitest 135/135 + build, backend tsc + build, migrate 56/56 drift 0; детали — `docs/architecture/payment-provider-abstraction.md`; отчёт — `docs/prompts/PHASE_2_STEP_2.12A_PAYMENT_PROVIDER_ABSTRACTION_IMPLEMENTATION_REPORT.md`; NEXT = STEP 2.12A STRICT REVIEW (отдельный промпт); dependency metadata: 2.12A → SR → 2.12H → SR → 2.12B)\
Provider-agnostic adapters;
Stripe/Adyen/Mangopay/Checkout.com/Rapyd/банки не являются domain model.
Capability matrix по country/currency/rail.
**RECONCILIATION 2026-08-15 (Critical Platform Risks):** MAY PROCEED as NEXT with embedded hard gates; границы зафиксированы: внешний клиентский `Idempotency-Key` — ВНЕ scope 2.12A (owner = Step 2.12H, HARD prerequisite of 2.12B); PSP-local multi-instance race-дизайн обязателен в 2.12A (stable TravelHub-side request identity — §14 уже требует; strategy для webhook dedup key / create-payment race / callback reorder фиксируется здесь, реализация — 2.12B); новые outbound event-типы не вводить до решения schemaVersion (owner = Step 2.17); RLS — НЕ блокер (ADR-0014: application isolation canonical); NO REAL NETWORK hard gate сохранён.

· **Step 2.12H --- External API Idempotency Contract** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-15; независимый adversarial-аудит — отчёт `docs/prompts/PHASE_2_STEP_2.12H_EXTERNAL_API_IDEMPOTENCY_CONTRACT_STRICT_REVIEW_REPORT.md` (57 секций); HARD GATES PASS: критический вопрос «retried payment.create → второй committed Payment?» — доказан ответом НЕТ исполняемо (двойная гарантия: HTTP-слот `ExternalIdempotencyRecord.slotKey` UNIQUE + Payment business invariant `Payment_one_active_per_order` partial unique + findFirst-check; fault-injection T20 crash-window C — Payment закоммичен, complete пропущен, stale recovery → ТОТ ЖЕ Payment, 0 дубликатов факта/события/истории, 0 raw 500), principal isolation (T10/T11/T12), auth/RBAC ordering (guards ДО interceptor-а, fingerprint на validated DTO), детерминированный fingerprint, raw key 0 в персистенции (digest slotKey, T23), DB uniqueness backstop (P2002 → classify), concurrent identical/divergent (T7/T8/T19), restart replay (T9 второй Nest instance), stale-CAS recovery (COMPLETED unreclaimable, active non-stale не крадётся, concurrent reclaim T22), Payment lifecycle authority (0 прямых Payment writes из idempotency; T17), provider-operation boundary 2.12A не тронута, inbox/outbox разделены, 0 domain events, 0 PSP/webhook/SPLIT/cross-domain (T18 route-graph + source audit), 57/57 migrate drift 0; REVIEW FIX 1 (LOW, pathological): complete-P2025 race — слот удалён конкурентным rollback-ом между business commit и complete → raw 500 заменён на возврат закоммиченного результата (unit #10, 0 raw 500 в T20/T22); REVIEW FIX 2/3 (тесты): +13 adversarial unit (duplicate-header, non-P2002 rethrow, generic-error, completed-unreclaimable, non-stale-not-stolen) + 5 fault-injection e2e T20–T24 (crash C, divergent hijack, concurrent stale reclaim, raw-key, no-duplicate event/history); OBS: app-clock staleness (skew>30s non-guarantee), duplicate-header Node join `,` → charset 400, deferred retention/cleanup (Step 2.17), status derivation (@Post 201 после interceptors); регрессия воспроизведена: unit 655/655 (51 suites, +13), idempotency e2e 24/24, targeted 8/8 suites, serial e2e 1177/1177 (67 suites, +5), frontend tsc + vitest 135/135 + build (0 файлов изменено), backend tsc + build, migrate 57/57 drift 0, artifact integrity PASS=<N> WARN=0 FAIL=0; арх-док `docs/architecture/external-api-idempotency-contract.md` (crash-window §12 обновлён P2025-поведением); NEXT = PHASE 2 — STEP 2.12B — BUYER CARD / WALLET PAYMENT (2.12B НЕ начат; dependency chain `2.12A APPROVED → 2.12H APPROVED → 2.12B`); external HTTP idempotency contract: V1 protected set = минимальный PSP-readiness set — payment-initiation boundary `POST /api/v1/finance/payments` (`payment.create`, explicit registry `IDEMPOTENT_OPERATIONS`, fail-closed); header `Idempotency-Key` required (opaque, ≤128, `[A-Za-z0-9._~-]`, missing/malformed → 400); principal/tenant scope из authenticated server context (`scopeType=USER` + `request.user.id`, никогда body/query — одинаковый literal key разных principals изолирован, T10); operation identity — стабильная server-derived metadata (не host/request-id/raw URL); fingerprint `sha256(canonical({params, validatedBody}))` — validated DTO тем же ValidationPipe, property-order independent, arrays order-preserved, path params включены, query вне входа (документировано), omitted≠null fail-loud, decimal/currency строки не нормализуются (2.12A canonical representation), volatile transport metadata excluded by construction; persistence `events.ExternalIdempotencyRecord` (digest storage `slotKey=sha256(scope+operation+key)` — raw key никогда не хранится; PostgreSQL = correctness authority, DB unique backstop, multi-instance); lifecycle IN_PROGRESS → COMPLETED, бизнес-ошибка/rollback → claim удалён (ключ не poisoning, T13); crash-окна явно проанализированы (5 окон, arch doc §12) — stale IN_PROGRESS → CAS takeover (30s technical bound), повторное выполнение безопасно (payment.create business-idempotent, 0 duplicate committed-side-effect; не exactly-once delivery — документировано); identical retry → DB-backed replay (status+body, T4/T9 — второй Nest instance, тот же DB); divergent reuse → controlled 409 (T5/T6); in-progress duplicate → bounded wait 2s → replay или 409 (T7/T8/T19 genuine DB concurrency); auth/RBAC не обходятся replay-ом (guards до interceptor-а: T11 401/T12 403); replay НЕ включает Set-Cookie/Authorization/tracing (T15); PaymentService остаётся единственным lifecycle authority (T16/T17: transitions без ключа работают, replay не транзишит Payment); границы: 0 PSP/network/webhook/SPLIT/cross-domain writes/domain events (T18 route-graph + source audit), provider-operation identity 2.12A не тронута (mapping `external request → canonical business fact → server-derived provider operation` сохранён); retention V1 no-auto-expiry/deferred cleanup (без выдуманных чисел); регрессия: unit 642/642 (+23 fingerprint/slot-key/service), serial e2e 1172/1172 (67 suites, +19 T1–T19), targeted finance/payment/RBAC e2e 80/80, frontend tsc + vitest 135/135 + build (0 файлов изменено), backend tsc + build, migrate 57/57 drift 0, artifact integrity PASS=100 WARN=0 FAIL=0; арх-док `docs/architecture/external-api-idempotency-contract.md`; отчёт `docs/prompts/PHASE_2_STEP_2.12H_EXTERNAL_API_IDEMPOTENCY_CONTRACT_IMPLEMENTATION_REPORT.md`; NEXT = PHASE 2 — STEP 2.12H — STRICT REVIEW (2.12B НЕ начат; dependency chain `2.12A APPROVED → 2.12H impl → 2.12H SR → 2.12B` сохранена)
Внешний клиентский `Idempotency-Key` header-контракт для money-changing POST (checkout, future payment create, refund, dispute): key format/length, principal/route scope, request fingerprint, storage authority, response snapshot/replay semantics, identical vs divergent replay, concurrent same-key, failed/in-progress, retention/TTL, provider idempotency-key mapping, PII/security. **HARD PREREQUISITE of Step 2.12B** (реальные деньги). Создан reconciliation-ом 2026-08-15 (доказательство отсутствия: 0 `Idempotency-Key` в backend/src; money-changing POST полагаются на business codes).

· **Step 2.12B --- Buyer Card / Wallet Payment** ⛔ BLOCKED — COMMERCIAL CONFIRMATION REQUIRED (2026-08-15 selection pass; evidence — `docs/adr/ADR-0015-payment-provider-selection.md`; AZN settlement → local CBA-licensed AZ acquiring (Millikart / Kapital Bank / Azericard / Goldenpay / Pashabank / Birbank / Payme.az — candidate set, NOT approved); global PSPs DISQUALIFIED for canonical V1: Stripe — нет onboarding в AZ; Adyen — AZN отсутствует в settlement currencies, AZ не acquiring region; Rapyd — AZN отсутствует в Collect presentment/payout, AZ → USD; Checkout.com — нет acquiring в AZ; Mangopay — EU; отчёт — `docs/prompts/PHASE_2_STEP_2.12B_PAYMENT_PROVIDER_SELECTION_DECISION_REPORT.md`; RFI-инструмент готов: sendable questionnaire — `docs/commercial/az-payment-provider-rfi.md`, internal scoring workbook — `docs/commercial/az-payment-provider-rfi-internal-workbook.md`, отчёт — `docs/prompts/TRAVELHUB_AZ_PAYMENT_PROVIDER_RFI_TECHNICAL_COMMERCIAL_QUESTIONNAIRE_REPORT.md`; получение ответов + evidence-reconciliation — единственный оставшийся blocker; 0 production-кода/schema/миграций/webhook/PSP — docs-only)\ 
Card, Apple Pay, Google Pay где поддерживается;
authorize/capture/fail/cancel, webhook signature, idempotency.
**RECONCILIATION 2026-08-15:** HARD prerequisites = Step 2.12A (provider abstraction) + Step 2.12H (external Idempotency-Key). PSP-local multi-instance гарантии проектируются в 2.12A и реализуются здесь: webhook dedup через DB unique на provider-event key, create-payment race, webhook-до-API-response, callback reorder, duplicate webhook storm. Webhook burst-robustness e2e обязателен (subset Load gate Step 2.17B).
**BLOCKED 2026-08-15 (implementation gate, prompt §4/§59):** канонический провайдер НЕ выбран — ни Roadmap, ни ADR, ни architecture-документы не называют PSP; `KNOWN_PAYMENT_PROVIDER_CODES` = EMPTY (единственный адаптер — `FakePaymentProvider`, TEST-ONLY); 2.12A SR: «no production PSP selected yet; Step 2.12B registers real adapters». Запрещено изобретать PSP или использовать fake как production (prompt §4 «No temporary provider choice just to complete the step»). Требуется решение authority (Product/Business): выбор канонического PSP (или approved provider set + selection критерии) → затем реализация 2.12B по зафиксированному контракту. Подробности — `docs/prompts/PHASE_2_STEP_2.12B_PROVIDER_SELECTION_BLOCKED_DECISION_REPORT.md`.

· **Step 2.12C --- SPLIT_AT_PAYMENT / Marketplace Commission**\
Предпочтительный режим при поддержке PSP:
`Buyer → PSP → Partner share + TravelHub fee`. Split должен быть
реальным native PSP split, не имитацией ledger-записью.

· **Step 2.12D --- PLATFORM_COLLECT Mode**\
Buyer платит platform-controlled rail → Ledger/Settlement → Payout
Partner.

· **Step 2.12E --- PARTNER_COLLECT / Post-Factum Commission** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-15; ADR-0013 D9/D10/D14/D19 материализован: признание Commission (CMS-*) + CommissionAccrual (CAA-*) на Order creation из frozen commissionSnapshot — Quote ISSUE freeze (policy selection через детерминированный resolver + Order.sellerPartnerId snapshot-at-event, verbatim Checkout→Sale→Order); recognition = Order creation (НЕ Payment CAPTURED/PSP); 0 live policy lookup; base = frozen Order.total; amount = round_half_up(base × rate) (Decimal, без JS float); fail-closed: NO_POLICY/AMBIGUOUS/multi-seller/без seller → 0 фактов (не «0%»); idempotency: inbox + Commission_orderId_key + CommissionAccrual_sourceCommissionId_key; divergent replay → ConflictError; CommissionAccrued (PUBLISHED, PII-free, causation chain OrderRequested→OrderCreated→CommissionAccrued); read API (list/detail, RBAC finance.commission.read — FINANCE/DIRECTOR/ANALYST; 403 SALES_MANAGER/OPERATOR/BUYER; 404 unknown); OrderCreated доставляется подписчикам (emit PENDING; order-requested consumer после коммита помечает OrderRequested PUBLISHED + publishPending — паттерн payment/booking; downstream failure → OrderCreated FAILED, не молчаливый 0-факт); миграция 20260814190000_add_partner_collect_commission_accrual аддитивная (56/56, drift 0); unit 596/596, serial e2e 1129/1129 (65 suites, +8 partner-collect T1–T8); арх-док docs/architecture/partner-collect-commission-accrual.md; отчёт docs/prompts/PHASE_2_STEP_2.12E_PARTNER_COLLECT_COMMISSION_ACCRUAL_FOUNDATION_IMPLEMENTATION_REPORT.md; NEXT = STRICT REVIEW (отдельный промпт; 2.12C SPLIT_AT_PAYMENT остаётся ⏳ NOT STARTED; Step 2.14 остаётся ⛔ BLOCKED) STRICT REVIEW (2026-08-15; независимый adversarial-аудит: имплементационный отчёт не принимался на веру; hard gates PASS — scope, policy authority (единственный finance.CommissionPolicy, 0 hardcoded ставок), freeze verbatim (T9: policy A заморожена → archive/activate B → Commission использует frozen A 0.15, не B 0.30), seller snapshot frozen (T10: product.partnerId мутирован после freeze → Commission остаётся у frozen seller), one-seller/multi-seller fail-closed (T4/T11), NO_POLICY/AMBIGUOUS fail-closed (T5 + resolver unit), money Decimal ROUND_HALF_UP (T2 + half-cent unit 1.00×0.015=0.02), corrupted snapshot fail-loud (T8 + unit matrix), single write-authority (repo-wide grep), atomicity (одна tx: Commission+Accrual+CommissionAccrued+inbox), idempotency тройная + divergent → ConflictError (unit), concurrency (T12: concurrent OrderCreated → ровно 1 факт, 0 raw 500), EventBus OrderCreated delivery (emit PENDING + consumer publish после коммита; rollback no-publish; attempts=1 regression sale-completion 29-30; narrow fix, НЕ redesign EventBus), RBAC по факту ROLE_PERMISSIONS (FINANCE/DIRECTOR/ANALYST read; ADMIN=ALL_PERMISSIONS; 403 SALES_MANAGER/OPERATOR/MODERATOR/MARKETER/PARTNER/BUYER), boundaries (T7: delta 0 по Ledger/ProviderFee/Settlement/Payout/Invoice/Payment/Refund/Dispute/Booking/Availability); НАЙДЕНО И ИСПРАВЛЕНО: 1) MEDIUM validation — malformed selectedAt проходил snapshot-валидацию (битый provenance) → ISO 8601 проверка (fail-loud); 2) MEDIUM raw 500 — invalid status-фильтр read API → Prisma enum error → @IsEnum на DTO → контролируемый 400 (латентный тот же паттерн у Payment/Refund list — задокументирован, вне scope 2.12E); 3) HIGH e2e-infra — fixture Order number выводился из ORD-счётчика вместо TH-2026 sequence → коллизия уникальности Order (OrderRequested FAILED) → канонический IdsService в fixture-ах; 4) LOW drift — Order.sellerPartnerId @@index отсутствовал в schema при наличии индекса в миграции → добавлен (live→schema diff 0); +5 review e2e (T9–T13: policy-after-freeze, catalog-after-freeze, multi-seller, concurrent duplicate, pagination/enum validation) + T3 RBAC matrix расширен + T7 Booking/Availability delta + unit +3 (half-cent, zero-amount, snapshot-матрица); РЕГРЕССИЯ (факт): unit 598/598, targeted EventBus e2e 122/122 (10 suites), serial e2e 1134/1134 (65 suites), frontend tsc + vitest 135/135 + build, backend build, migrate 56/56 up-to-date, live→schema drift 0 (после фикса); отчёт docs/prompts/PHASE_2_STEP_2.12E_PARTNER_COLLECT_COMMISSION_ACCRUAL_FOUNDATION_STRICT_REVIEW_REPORT.md; NEXT по dependency graph = STEP 2.12A — PAYMENT PROVIDER ABSTRACTION (2.12C SPLIT_AT_PAYMENT hard-depends на 2.12A+2.12B+2.14E policy — зафиксировано; 2.14 ⛔ BLOCKED остаётся; 2.14F UI ⏳ PLANNED))
Buyer платит Partner → `CommissionAccrual` фиксирует долг Partner перед
TravelHub → settlement/invoice/collection.

· **Step 2.12F --- Partial Payments / Installments**\
Deposit, 30/70 и другие разрешённые схемы; каждый фактический платёж ---
отдельный Payment/allocation; paid/outstanding/due/due dates.

· **Step 2.12G --- PSP / Provider Fees**\
ProviderFee ≠ TravelHub Commission. Processing/FX/cross-border/payout
fees --- отдельные факты и политика распределения расходов.

· **Step 2.12I --- PSP Contract, Provider Fees & Money-Flow Architecture Reconciliation** ⏳ PLANNED — DEFERRED UNTIL PSP/AGGREGATOR COMMERCIAL AGREEMENT (2026-08-15 documentation-only reconciliation — `docs/prompts/TRAVELHUB_STEP_2.12I_PSP_PROVIDER_FEES_MONEY_FLOW_ROADMAP_RECONCILIATION_REPORT.md`; реализация НЕ начата; REQUIRED post-selection gate перед downstream production money-flow)\
Card-data boundary: PSP-hosted/PSP-tokenized collection target; raw PAN/CVV/CVC persistence — NOT PLANNED (provider-safe refs/metadata only). ProviderFee ≠ TravelHub Commission — HARD INVARIANT: ProviderFee = external cost/fact (PSP/aggregator/acquiring/scheme/payout/FX), TravelHub Commission = TravelHub-owned revenue под `finance.CommissionPolicy`; PSP НЕ становится authority комиссионной политики. Provider commercial tariff — НЕ accounting truth; actual provider-reported fee/reconciliation evidence — PREFERRED accounting source; hardcoded provider rates as final truth (например `providerFee = amount × 2%`) — FORBIDDEN (tariff только estimate/UI/forecast/validation; supersede-контракт обязателен). Economic bearer ProviderFee — DEFERRED explicit business/accounting decision (модели A–E: TravelHub absorbs / reduces partner payable / split / buyer surcharge / native marketplace allocation; НЕ infer из API behavior). Money-flow: gross buyer payment / captured / refunded / provider acquiring / refund / chargeback / FX / settled gross / settled net / TravelHub Commission / partner payable / payout amount / payout provider fee / partner received — НЕ collapse в единый «commission». Native SPLIT_AT_PAYMENT — НЕ assumed; payout API ≠ native split; 2.12C silent replacement FORBIDDEN (native split unavailable → отдельная architecture/business ADR перед изменением 2.12C). Marketplace/legal gate: POST /payout ≠ authority; verify acceptance-for-partner-services, settlement receipt, commission deduction/retention, partner payable holding, payouts, sub-merchants, KYB/KYC delegation. Pay-in/payout/refund/chargeback/FX/settlement reconciliation обязательны; ProviderFee idempotency/identity — из selected provider contract (provider tx ID / settlement ID / fee line ID / payout ID / refund ID / dispute ID; dedup webhook+settlement, divergent-amount — не overwrite silently). HARD prerequisites: 1) ADR-0015 accepted/equivalent provider decision; 2) merchant onboarding confirmed; 3) provider API docs; 4) sandbox/test capability; 5) commercial tariff/quote; 6) contractual marketplace model; 7) settlement model; 8) actual fee/reconciliation evidence; 9) native split explicitly supported/rejected; 10) payout explicitly supported/rejected. Dependency: 2.12A APPROVED → 2.12H APPROVED → 2.12B provider/commercial selection → ADR-0015 ACCEPTED → provider-specific buyer-payment integration → 2.12I → explicit downstream decision (native SPLIT_AT_PAYMENT | separately approved settlement/ledger/payout architecture); existing steps НЕ перенумерованы.

· **Step 2.13 --- Refund Flow** ✅ STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED) (2026-08-14; реализация — `docs/prompts/PHASE_2_STEP_2.13_REFUND_FLOW_IMPLEMENTATION_REPORT.md`; provider-neutral Refund runtime: Refund — Finance-owned (RFD-*, finance.refund.write; PSP/chargeback — 2.13A+, webhook-путей 0); source authority — ТОЛЬКО CAPTURED Payment (currency/orderId server-derived verbatim; Payment НЕ мутируется — остаётся CAPTURED, REFUNDED reserved unreachable: partial refund делает одиночный Payment.REFUNDED семантически неверным); partial refund'ы в scope (разные суммы — независимые факты); refundable = payment.amount − Σ(non-FAILED), over-refund — serialized pg_advisory_xact_lock на paymentId (concurrent 70+70 на 100 → один факт, total ≤ amount, без raw 500); idempotency — managed isActiveRefund + partial unique `Refund_one_active_per_payment_amount` (identical retry → no-op; attempt 2 после FAILED); единственный state-machine authority `RefundService.transition` (CAS from-guard): REQUESTED → APPROVED → PROCESSED | FAILED (REQUESTED\|APPROVED → FAILED); милстоуны requestedAt/approvedAt/processedAt/failedAt (2.10C DEFER → 2.13, canonical Roadmap-визион; архивное refundedAt НЕ используется — канон processedAt); Order projection — Order-owned subscriber на RefundProcessed (refundedAmount += amount; полный возврат → paymentStatus REFUNDED, partial → PAID; paidAmount исторический НЕ переписывается; Finance НЕ пишет order.*); события RefundCreated/Approved/Processed/Failed (outbox, correlation=server UUID, causation=null; payload refs+frozen money, без PII); RBAC finance.refund.read (FINANCE/DIRECTOR/ANALYST/SALES_MANAGER) + finance.refund.write (FINANCE/ADMIN, добавлено) + finance.refund.approve (FINANCE/ADMIN); mass assignment: forged currency/status/orderId/version/milestones → 422; миграция `20260814150000_add_refund_runtime` аддитивная (milestones + isActiveRefund + RefundHistory + Order.refundedAmount); 0 Ledger/ProviderFee/Settlement/Payout/Invoice/Commission/CommissionAccrual auto-post, Booking/availability не тронуты; unit 534/534 (+14), serial e2e 1093/1093 (62 suites, +13 refund-flow T1–T13), frontend 135/135 + build, migrate 53/53 drift 0; арх-док `docs/architecture/refund-flow.md` (32 секции); REVIEW NOTE: api.md RBAC-claim OPERATOR исправлен (пропуск 2.12-review-fixa); NEXT = STRICT REVIEW (не выполняется в этом проходе))\

· **Step 2.13A --- Chargeback / Dispute Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-14; независимый adversarial-аудит — `docs/prompts/PHASE_2_STEP_2.13A_CHARGEBACK_DISPUTE_FOUNDATION_STRICT_REVIEW_REPORT.md`\
Dispute/chargeback, evidence, liability, ledger/commission/settlement
adjustments.
PREREQUISITES (Roadmap Reconciliation 2026-08-14): provider-neutral foundation
(dispute/evidence/liability факты) допустим после 2.13; real-PSP chargeback →
2.12A/2.12B; adjustments (ledger/commission/settlement) → 2.12D/2.12C/2.14A.
реализация — `docs/prompts/PHASE_2_STEP_2.13A_CHARGEBACK_DISPUTE_FOUNDATION_IMPLEMENTATION_REPORT.md`;
provider-neutral Dispute runtime: Dispute — Finance-owned (DSP-*, finance.dispute.write; chargeback —
vocabulary-категория reason, НЕ отдельная сущность — Roadmap не различает; real-PSP chargeback — 2.12A/2.12B,
webhook-путей 0); source authority — ТОЛЬКО CAPTURED Payment (currency/orderId server-derived verbatim;
Payment НЕ мутируется — остаётся CAPTURED, никакого Payment.status=DISPUTED); amount server-validated
0 < amount ≤ payment.amount (frozen captured; НЕ netting с Refund — monetary netting deferred до
2.12D/2.14A, explicit restriction e2e T10); cardinality — один активный Dispute на Payment (managed
isActiveDispute + partial unique `Dispute_one_active_per_payment`; identical retry → no-op; RESOLVED/
CANCELLED освобождают слот — attempt 2 легален; concurrent duplicate → controlled 409, один факт);
единственный state-machine authority `DisputeService.transition` (CAS from-guard OPENED): OPENED →
RESOLVED | CANCELLED; милстоуны openedAt/resolvedAt/cancelledAt (server-owned UTC, first-only); события
DisputeOpened/Resolved/Cancelled (outbox, correlation=server UUID, causation=null; payload refs+frozen
money, без PII; consumer-ов НЕТ — 0 cross-domain projections, Roadmap 2.13A их не требует); RBAC
finance.dispute.read (FINANCE/DIRECTOR/ANALYST/SALES_MANAGER) + finance.dispute.write (FINANCE/ADMIN,
добавлено); mass assignment: forged currency/status/orderId/version/milestones → 422; миграция
`20260814170000_add_chargeback_dispute_foundation` аддитивная (enum + Dispute + DisputeHistory +
isActiveDispute partial unique); 0 PSP/webhook/Ledger/ProviderFee/Settlement/Payout/Invoice/Commission/
CommissionAccrual auto-post (e2e T9), Payment/Refund/Booking/availability не тронуты; won/lost
liability-исход — deferred; unit 547/547 (+13), serial e2e 1105/1105 (63 suites, +12 chargeback-dispute
T1–T12), frontend 135/135 + build, migrate 54/54 drift 0; арх-док
`docs/architecture/chargeback-dispute-foundation.md` (27 секций); NEXT = STRICT REVIEW (не выполняется
в этом проходе))
STRICT REVIEW: все hard gates PASS — единственный writer DisputeService (repo-wide 0 других
dispute create/update/upsert/delete; 0 raw SQL; 0 cross-domain writes), source authority — ТОЛЬКО
CAPTURED Payment (currency/orderId verbatim, 0 reprice), frozen money amount ≤ captured (без netting
с Refund — explicit restriction e2e T10), cardinality один активный Dispute на Payment (partial unique
DB-level; attempt 2 после RESOLVED/CANCELLED), state machine OPENED → RESOLVED|CANCELLED (CAS
from-guard, milestones first-only), 3 события PII-free (0 consumer-ов — 0 cross-domain projections),
RBAC finance.dispute.read/write (OPERATOR не имеет — проверено ROLE_PERMISSIONS), mass assignment →
422, 0 PSP/webhook/Ledger/Commission/Settlement/Payout/Invoice (e2e T9), Payment/Refund/Booking/
availability не тронуты, миграция аддитивная (54/54, drift 0, fresh replay); REVIEW FIX (HIGH,
class «silent divergent idempotency success», Ledger 2.10A FIX 1 прецедент): divergent amount при
активном Dispute возвращал существующий факт (no-op 200 с чужой суммой) — теперь controlled 409
(identical retry — тот же amount — no-op; e2e T5 + unit); регрессия unit 548/548 + serial e2e
1105/1105 (63 suites) + frontend 135/135 + build + migrate 54/54 drift 0))

· **Step 2.14 --- Invoice / Commission Flow** ⛔ BLOCKED — ARCHITECTURE DECISION REQUIRED (2026-08-14; stop-condition §58 #4 — Commission formula/rate/base/source authority НЕ определена: 0 rate/policy-моделей в схеме (только TaxRule/ExchangeRate), 0 ставок в legacy-коде, 0 commission-данных в frozen Order snapshot (2.11 — «commission части deferred до появления canonical producer-ов»); семантика комиссии канонически принадлежит 2.12C (SPLIT_AT_PAYMENT — native PSP split), 2.12E (PARTNER_COLLECT → CommissionAccrual) и 2.14E (Channel-Based Commission Rules, «Никаких hardcoded ставок») — все ⏳ NOT STARTED; промпт §9 «if commission trigger or base is undefined: STOP», §10 «не изобретать процент/базу», §58 #4 → BLOCKED; 0 production-кода 2.14 внесено, НЕ маркируется IMPLEMENTATION COMPLETED; Invoice-часть доказуемо независима от Commission (frozen Order snapshot — источник), НО НЕ реализована (решение: весь Step 2.14 незавершён); итог — `docs/prompts/PHASE_2_STEP_2.14_BLOCKED_ARCHITECTURE_DECISION_REQUIRED.md`; NEXT = COMMISSION DEPENDENCY RECONCILIATION (2.12C/2.12E/2.14E) — отдельный prompt, НЕ начинается в этом проходе; 2.14A и самостоятельная реализация 2.12C/2.12E запрещены)\
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

· **Step 2.14E --- Channel-Based Commission Rules** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-14; ADR-0013 материализован: Finance-owned `finance.CommissionPolicy` (CMP-*) — ЕДИНСТВЕННЫЙ policy authority; V1 channel-only (MARKETPLACE — create-гейт; PARTNER_STOREFRONT/DIRECT/BUYER_REQUEST no-commission → 422); rateType PERCENTAGE; rate = десятичная доля 0<r<1 ≤6 знаков (DECIMAL(18,6)); lifecycle DRAFT → ACTIVE → ARCHIVED (CAS, update только в DRAFT, ACTIVE immutable); overlap-инвариант pg_advisory_xact_lock(hashtext('commission-policy:'||channel)) + activate-проверка → 409 (concurrent → один 201 + 409, 0 raw 500); resolver `resolveCommissionPolicy(channel, instant)` fail-closed (NO_COMMISSION_CHANNEL/NO_POLICY/AMBIGUOUS), half-open [effectiveFrom, effectiveTo); CommissionPolicyHistory (полный state на версию — future frozen snapshot репродукция); RBAC `finance.commission.manage` (FINANCE/ADMIN) + read finance.commission.read (FINANCE/DIRECTOR/ANALYST — фактический ROLE_PERMISSIONS; SALES_MANAGER НЕ имеет); mass assignment → 422; AuditLog snake_case; 0 доменных событий; 0 Commission/CommissionAccrual/ledger/settlement/payout/invoice фактов (e2e T12), 0 cross-domain (T13); миграция `20260814180000_add_commission_policy_foundation` аддитивная (55/55, drift 0); unit 567/567 (+19), serial e2e 1120/1120 (64 suites, +15 commission-policy-foundation T1–T15), frontend 135/135 + build; арх-док `docs/architecture/commission-policy-foundation.md`; отчёт `docs/prompts/PHASE_2_STEP_2.14E_CHANNEL_BASED_COMMISSION_RULES_FOUNDATION_IMPLEMENTATION_REPORT.md`; ADR-0013 D18 read-set уточнён по факту (SALES_MANAGER без commission.read); seller-атрибуция (Order.sellerPartnerId) — следующий freeze-шаг, НЕ 2.14E; STRICT REVIEW: найден и исправлен HIGH-дефект валидации rate — научная нотация («1e-7» = 0.0000001 → Postgres DECIMAL(18,6) округлял до 0.000000, молчаливая 0%-policy) и whitespace (« 0.15 » → Prisma.Decimal DecimalError → raw 500); фикс: каноническая форма /^0\.(?!0+$)\d{1,6}$/ (regex-authority, без JS float arithmetic); unit 583/583 (+16 adversarial), e2e T5 расширен + T5b (границы 0.000001/0.999999), serial e2e 1121/1121 (64 suites); stale-комментарий контроллера (SALES_MANAGER read) исправлен по факту ROLE_PERMISSIONS; api.md/арх-док фиксируют каноническую форму; live DB drift 0 (55/55); отчёт `docs/prompts/PHASE_2_STEP_2.14E_COMMISSION_POLICY_FOUNDATION_STRICT_REVIEW_REPORT.md`; NEXT = STEP 2.12E — PARTNER_COLLECT / COMMISSION ACCRUAL FOUNDATION (по dependency graph 2.14E→2.12E→2.12C; не начинается в этом проходе; Step 2.14 остаётся BLOCKED до закрытия prerequisites))\
Разные commission policies для Marketplace, Storefront, Custom Domain,
API/Manual. Никаких hardcoded ставок. Storefront SaaS subscription и
Marketplace commission --- разные механизмы.

· **Step 2.14F --- Commission Policy Management UI** 🚧 PLANNED — НЕ реализован
(2026-08-14; UI/roadmap-реконсиляция — `docs/prompts/PHASE_2_FINANCE_COMMISSION_POLICY_UI_ROADMAP_RECONCILIATION_REPORT.md`;
ранее UI-шаг отсутствовал: Phase 3 имеет Analytics/CRM/Marketing/Support/Users/
Documents/Calendar/Reports/Integrations/AI Center UI, но НЕ Finance Center UI;
Screen Design §7 перечисляет «Commissions» в навигации Finance Center, но без
контракта экрана Commission Policies).
Цель: `Finance Center → Commissions → Commission Policies` — управление
canonical `finance.CommissionPolicy` (master data 2.14E, НЕ Commission-факты).
Минимальный scope (§17 реконсиляции): list (CMP-*/channel/rateType/rate
отображение 15%/status/effectiveFrom/effectiveTo/version/createdAt,
current/effective indicator если безопасно выводим), whitelist-фильтры
(status/channel), detail + version history (read-only, backend-owned
CommissionPolicyHistory; НЕ реконструкция на клиенте), create DRAFT / edit
DRAFT / activate / archive (только по факт. status backend), effective period
[from,to) + open-ended, overlap/validation conflict — контролируемые состояния,
rate-ввод «15» ↔ API «0.15» (display-конверсия ТОЛЬКО; frontend НЕ второй
policy/расчётный authority, 0 float-арифметики как authority), RBAC-aware
(read — FINANCE/DIRECTOR/ANALYST; manage — FINANCE/ADMIN; SALES_MANAGER/
OPERATOR/PARTNER → 403 + скрытие меню ≠ security), permission-denied/empty/
loading/error states, responsive как internal centers.
Табы `Policies | Commission Facts | Accruals`: Policies активна (backend 2.14E
approved); Commission Facts — gated на future backend runtime (2.12C/2.14),
Accruals — gated на 2.12E backend runtime; НЕ маркировать их UI реализованным.
НЕ редактирует исторические Commission/снапшоты/Refund/Dispute-суммы (ручное
управление = master data policy, НЕ финансовый override; корректировка истории —
append-only компенсирующие факты в будущих approved шагах). Settings/Catalog/
PSP НЕ дублируют authority (Settings → Commission Rate запрещён; Catalog —
read-only reference при необходимости).
**API-гэп (prerequisite, задокументирован в реконсиляции):** read endpoint
версионной истории `GET /api/v1/finance/commission-policies/:code/history`
отсутствует в 2.14E (CommissionPolicyHistory пишется, но не читается через API;
прецедент: `/service-units/:id/history`, `/tariffs/:id/history`). Реализовать
как backend-подготовку 2.14F.
Зависимости: 2.14E API (approved, 2026-08-14) → 2.14F (UI); 2.14F НЕ требует
2.12C/2.12E. Step 2.14 (backend Invoice/Commission runtime) остаётся
⛔ BLOCKED — 2.14F его не разблокирует и не маркирует реализованным.

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

· **Step 2.17 --- Phase 2 Hardening** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-16; отчёт — `docs/prompts/PHASE_2_STEP_2.17_PLATFORM_HARDENING_STRICT_REVIEW_REPORT.md`; независимый adversarial-аудит полного persisted state incl. stabilization; HARD GATES PASS: CI/CD, PostgreSQL multi-schema CI, legacy isolation, token storage, logout revocation, /auth/session, login throttling, PermissionsGuard fail-closed, CORS allowlist, durable retry, durable PENDING publisher, multi-instance outbox, stabilization fix, event schemaVersion (additive v1), ADMIN SoD assessment, visibility/auditability; delivery semantics = at-least-once + authoritative Inbox/consumer idempotency (НЕ exactly-once); 6 REVIEW FIXES: FIX 1 (HIGH) legacy/missing-tv claim обходил revocation → fail-safe 401; FIX 2 (MEDIUM) CORS prod unset-allowlist → fail-closed; FIX 3 (MEDIUM) login-throttle bounded cleanup + spec; FIX 4 (LOW) vestigial localStorage в frontend-тесте; FIX 5 (LOW) stale docstrings (eventbus/proxy); FIX 6 (MEDIUM) adversarial e2e — T-A два genuine worker-инстанса (10/10 стабильно), T-B crash-window, T-G/T-H nested chain, concurrent logout, legacy-tv fail-safe; deferred-gate решения: multi-instance rate limiter = ALLOWED (контракт описывает in-memory throttle), ADMIN SoD decomposition = ALLOWED (контракт требовал assessment — доставлен); регрессия воспроизведена: unit 672/672 (+6 login-throttle), serial e2e 1194/1194 (69 suites: 592+602), auth-hardening + outbox-durable-worker adversarial green, frontend tsc 0 + vitest 135/135 + build, backend tsc + build, migrate 58/58 drift 0, artifact integrity PASS=120 WARN=0 FAIL=0 (regression 13/13); NEXT = Step 2.17A/2.17B pre-exit gates; 2.17C/2.18 НЕ начаты; payment branch (2.12B/ADR-0015/2.12I/2.12C) не тронут). Исходный implementation отчёт — `docs/prompts/PHASE_2_STEP_2.17_PLATFORM_HARDENING_IMPLEMENTATION_REPORT.md`; все 10 findings закрыты кодом: CI repair (backend/frontend roots, PostgreSQL 15 service, `prisma migrate deploy`, full serial e2e — root npm ci + legacy SQLite устранены), durable event delivery (`OutboxWorkerService` — bounded цикл retryFailed→publishPending, pg advisory xact lock multi-instance, controlled errors, `status()` observability; PENDING без HTTP-traffic восстанавливается, retryable FAILED auto-retry, exhausted poison, Inbox dedup authoritative — 0 duplicate side effect), envelope `version:1` additive (обратная совместимость legacy v1), auth hardening (серверная HttpOnly cookie `travelhub.auth` Secure/SameSite=Lax/path=/ + Authorization dual-path; `GET /auth/session` public проба; logout → `User.tokenVersion` increment — все ранее выданные JWT мгновенно 401; PermissionsGuard fail-closed — required+missing user → 403; login throttle in-memory 10/15min → controlled 429; CORS allowlist из CORS_ORIGINS вместо origin:true + credentials), legacy isolation (вне CI/build/imports, не удалён), README синхронизирован, ADMIN=ALL_PERMISSIONS классифицирован как controlled super-admin bootstrap policy (права не тронуты; детальная SoD — будущий шаг); дефекты закрыты с доказательствами: outbox-durable-worker e2e 5/5, auth-hardening e2e 7/7 (вкл. cookie-auth, revocation, fail-closed, audit без секретов, brute-force 429), cors.spec 5 + permissions-guard.spec 6; регрессия: unit 666/666 (51 suites), полный serial e2e 1188/1188 (69 suites), frontend tsc 0 + vitest 135/135 + production build, backend tsc + build, migrate 58/58 drift 0; арх-док — `docs/architecture/platform-hardening-2.17.md`; NEXT = STEP 2.17 STRICT REVIEW (отдельный промпт); 2.17A/2.17B/2.17C/2.18 НЕ начаты; payment branch (2.12B/ADR-0015/2.12I/2.12C) не тронут) — platform hardening gate: CI/CD repair, durable event delivery (outbox worker + auto-retry), event schemaVersion (additive), auth/session hardening (HttpOnly cookie, tokenVersion revocation, fail-closed PermissionsGuard, login rate limiting, CORS allowlist), legacy isolation, README sync, ADMIN SoD assessment. **STABILIZATION NOTE (2026-08-16, status НЕ изменён — остаётся WAITING FOR STRICT REVIEW):** flaky e2e root-cause = worker lifecycle (B): `publishPending` исполнял consumer-ов (OrderRequested→Order→CommissionAccrual) ВНУТРИ advisory-lock-транзакции → превышение 5s interactive-transaction timeout → „expired transaction“ → лишний retryable-FAILED в общей БД → глобальный `retryFailed()` в sale-completion видел 2 вместо 1. Фикс: lock-tx покрывает ТОЛЬКО атомарный flip retryable-FAILED→PENDING; доставка — вне lock-tx (Inbox dedup authoritative, идемпотентно). Отчёт — `docs/prompts/PHASE_2_STEP_2.17_FLAKY_E2E_AND_TEST_ISOLATION_STABILIZATION_REPORT.md`; регрессия: unit 666/666, serial e2e 1189/1189 (522+667), chunk2 4/4 зелёный (до фикса 1/2 flaky), frontend tsc 0 + vitest 135/135 + build, migrate 58/58 drift 0, artifact integrity PASS=119 WARN=0 FAIL=0 (regression 13/13).
**RECONCILIATION 2026-08-15 (Critical Platform Risks):** scope уточнён, системно-широкие items получают явных владельцев: event schema versioning decision + envelope `version` (additive default v1; evidence: ADR-0010 envelope v1 БЕЗ version, только OrderRequestedPayload.version=1, consumers без version-check) → ЗДЕСЬ; outbox publisher atomic claim / single-delivery worker (publishPending = findMany PENDING без SKIP LOCKED/claim; duplicate-safe consumers ЕСТЬ, single-delivery publisher НЕТ) → ЗДЕСЬ; durable retry scheduler (retryFailed БЕЗ production caller) → ЗДЕСЬ CRITICAL HARD GATE; CI repair / legacy isolation / auth hardening / ADMIN SoD / operational visibility → ЗДЕСЬ (per prepared 2.17 prompt). **Backup/DR и Load/Performance НЕ входят в 2.17** — независимые pre-exit gates Step 2.17A / Step 2.17B.
**NEXT RECONCILIATION 2026-08-15 (Phase 2 Next Executable Step):** канонический NEXT = **Step 2.17 — Phase 2 Hardening** (VERDICT A, отчёт — `docs/prompts/PHASE_2_NEXT_EXECUTABLE_STEP_RECONCILIATION_REPORT.md`). Payment branch (2.12B/ADR-0015/2.12I/2.12C) внешне заблокирован (PSP commercial confirmation) и НЕ блокирует 2.17: весь scope 2.17 — platform-level (event schemaVersion, outbox claim/single-delivery, durable retry CRITICAL HARD GATE, CI repair, legacy isolation, auth hardening, ADMIN SoD, operational visibility), 0 зависимостей от незавершённого PSP runtime или поздних Phase 2 domain contracts (верифицировано кодом: retryFailed без production caller, publishPending без SKIP LOCKED/claim, CI сломан — root npm ci + legacy SQLite, envelope без schemaVersion); prepared prompt — `docs/prompts/PHASE_2_STEP_2.17_PLATFORM_HARDENING_GATE_IMPLEMENTATION_WITH_PROVENANCE.md`. Parallel-safe secondary: 2.14F (Commission Policy UI, backend 2.14E APPROVED), 2.17A (Backup/DR, RPO/RTO authority). Roadmap gaps (НЕ исправлены здесь): sales.service decomposition НЕ owned (рекомендуется отдельный reconciliation); 2.9 header status stale (line 552 без статуса; line 1641 + committed SR reports — APPROVED WITH REVIEW FIXES; checker PASS). 2.12B/2.14 остаются BLOCKED; 2.12C/2.12I не начинаются.

· **Step 2.17A --- Backup & Disaster Recovery Readiness** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-16; отчёт — `docs/prompts/PHASE_2_STEP_2.17A_BACKUP_DISASTER_RECOVERY_READINESS_IMPLEMENTATION_REPORT.md`; PostgreSQL backup contract `backend/scripts/dr-backup.mjs` — pg_dump -Fc whole multi-schema, sha256 sidecar, fail-fast, env-only credentials, gitignored artifacts; isolated restore drill `backend/scripts/dr-restore-drill.mjs` — fail-closed guards (protected/canonical target refusal, --yes required, bare-name check, checksum sidecar required — guards run BEFORE backup handling), 10-step drill proven live: 11 schemas restored, all 58 canonical migrations present, outbox/inbox/finance/order/booking/security verbatim, smoke PASS, cleanup PASS, ~4–6s total; unit tests `backend/src/ops/dr-scripts.spec.ts` 4/4; runbook `docs/operations/backup-disaster-recovery-runbook.md`; arch/decision record `docs/architecture/backup-disaster-recovery-2.17A.md`; RPO/RTO/retention/PITR = TBD — BUSINESS/OPERATIONS AUTHORITY REQUIRED (classification B — authority absent, не выдумано); state inventory complete (PostgreSQL AUTHORITATIVE, media objects AUTHORITATIVE non-reconstructable → DB-only backup insufficient, Redis NOT USED, secrets gap documented); EventBus recovery = at-least-once + inbox idempotency verbatim (никогда не удалять inbox/outbox как cleanup); finance verbatim не regenerated; DR-1…DR-12 matrix; DR-12 fail-closed proven; миграции/дрейф без изменений (58/58, drift 0); Step 2.17 остаётся APPROVED; 2.17B/2.17C/2.18/RLS/PSP не начаты; **AUTHORITY DECISION (2026-08-16, отдельный проход — отчёт `docs/prompts/PHASE_2_STEP_2.17A_RPO_RTO_RETENTION_AUTHORITY_DECISION_REPORT.md`):** Business/Operations authority записан: PostgreSQL RPO ≤1h / RTO ≤4h, Authoritative Media/Object Storage RPO ≤24h / RTO ≤8h, retention daily=30d / monthly=12mo — всё как APPROVED TARGETS (не evidence production capability); PITR = NOT VERIFIED / provider-dependent; production PostgreSQL MUST use verified mechanism capable of RPO≤1h (dump-only недостаточен); RTO≤4h — local drill ~4–6s = TEST EVIDENCE, не RTO proof; media DB-only DR insufficient (non-reconstructable); DB↔object non-atomic + reconciliation; retention = backup retention, не legal/accounting/PSP/immutable retention; EventBus at-least-once + inbox idempotency preserved (не exactly-once, не удалять inbox/outbox); PSP/card boundary неизменен (ADR-0015); secrets не в backup (gap документирован); immutability = production requirement (provider-dependent); capability-gap matrix в runbook §16b; правильная запись: техническая реализация COMPLETED + authority APPROVED + strict review NOT STARTED — Step НЕ помечен APPROVED; NEXT = STEP 2.17A STRICT REVIEW; 2.17B/2.17C/2.18/RLS/PSP не начаты). **STRICT REVIEW (2026-08-16; отчёт — `docs/prompts/PHASE_2_STEP_2.17A_BACKUP_DISASTER_RECOVERY_READINESS_STRICT_REVIEW_REPORT.md`):** VERDICT = APPROVED WITH REVIEW FIXES; независимый adversarial-аудит (код/скрипты/БД/runtime — не отчёты): 11 схем независимо перечислены и восстановлены verbatim; fresh drill-эвиденс (не цифры из отчёта): backup 410 649 B, restore ~2s, verify ~1.4s, 58/58 канонических миграций, seed round-trip ТОЧНЫЙ — finance.Payment 1234.56 USD AUTHORIZED + unique code, OutboxEvent PENDING exact + poison FAILED/5/false/error verbatim, ExternalIdempotencyRecord verbatim + unique slotKey, tokenVersion 52/52; 15/15 adversarial cases (protected/production-like/template/postgres/malformed/--yes/checksum missing/corrupt/backup-fail/restore-fail/cleanup-after-fail/Decimal/tokenVersion/idempotency/outbox-inbox/no-git-artifacts); HARD GATES PASS (whole-DB backup, multi-schema, checksum, target safety, isolated drill, migration, finance, EventBus, security, idempotency, object-storage contract, non-atomicity, runbook, RPO/RTO/retention authority); Option A выбран по каноническому Roadmap-тексту (2.17A = readiness/contract ДО 2.12B go-live, не proof production capability) — production capability НЕ VERIFIED остаётся explicit (PITR/media/immutability/monitoring — later infrastructure gates); 5 REVIEW FIXES: FIX 1 (MEDIUM) failure-пути drill оставляли orphan target DB + 0 FAILED evidence → cleanupIsolatedTarget() + writeEvidence(FAILED) на exit 5/6/7/8 (live-доказано: exit 6 → target dropped, orphan=0); FIX 2 (LOW) pg_dump оставлял partial artifact при failure → rmSync partial (live-доказано); FIX 3 (LOW) guard только статический список → derived-canonical refusal (target == canonicalDb из DATABASE_URL) + unit; FIX 4 (LOW) --backup missing/empty → явный exit 2; FIX 5 (LOW) unit 4→11 adversarial; OBSERVATION: schema.prisma 164 @@schema на 93 модели (28 моделей с дублированными атрибутами — без DR-влияния), dev DB 61 migration row vs 58 folders (3 legacy — documented); регрессия независимо: unit 683/683, serial e2e 1194/1194 (69 suites, 611+583), frontend tsc 0 + vitest 135/135 + build, backend tsc + build, migrate 58/58 drift 0 („No difference detected“), artifact integrity PASS=130 WARN=0 FAIL=0 (regression 13/13); release NOT PERFORMED; NEXT = Step 2.17B (Load & Performance Qualification); 2.17C/2.18/RLS/PSP не начаты)
Независимый pre-Phase-2-Exit operational gate (НЕ часть scope Step 2.17): PostgreSQL logical backup + restore runbook + **tested restore drill**, object/media (MinIO/S3) versioning/replication, secrets/config recovery, migration-state recovery, outbox/inbox/audit/finance recovery. RPO/RTO — без фабрикации, требуют authority. Рекомендовано завершить ДО 2.12B real-money go-live. Owner: reconciliation 2026-08-15 (доказательство отсутствия: 0 backup/restore скриптов, 0 pg_dump/PITR упоминаний, compose содержит только MinIO).

· **Step 2.17B --- Load & Performance Qualification** ⏸ BLOCKED — FINAL QUALIFICATION ENVIRONMENT REQUIRED — NOT APPROVED (2026-08-18; **QUALIFICATION ENVIRONMENT BLOCKER & PHASE 2 CONTINUATION RECONCILIATION — VERDICT A — SAFE TO CONTINUE INDEPENDENT PHASE 2 WORK — отчёт `docs/prompts/PHASE_2_STEP_2.17B_QUALIFICATION_ENVIRONMENT_BLOCKER_AND_CONTINUATION_RECONCILIATION_REPORT.md`:** Step 2.17B = ⏸ BLOCKED — FINAL QUALIFICATION ENVIRONMENT REQUIRED — NOT APPROVED; внешний блокер: подходящий dedicated квалификационный host/VM НЕДОСТУПЕН (Round 3 VERDICT C сохранён verbatim, 0 system PASS/FAIL claim из Round 3); harness IMPLEMENTED/REMEDIATED (0 изменений с fe5c586), quantitative authority APPROVED/FROZEN (0 target changes), Strict Review NOT STARTED; сохранённые evidence: EventBus F-2 FAIL→remediated (Round 2 backlog 171>100 → follow-up пробы ≤19 ≤100 / oldest ≤10s / drain ≤1s), Payment conc-50 Class E tail FAIL→remediated (Round 2 p95 4,337ms → пробы p95 544–601ms / p99 1,642ms), Booking steady 6 chains/s PASS, correctness-under-load PRESERVED (0 duplicate Payment/Order, 1:1 convergence, exact idempotency slots, 0 raw 500, 0 lost PENDING, poison isolated), warmup/idempotency-slot harness defect FIXED+validated (non-zero warmup, 0 --warmup=0); Booking burst 20 chains/s = FINAL VALID QUALIFICATION PENDING (не атрибуцируем ни на одном доступном окружении — НЕ доказанный application failure, НЕ waiver); residual: полная frozen-матрица должна быть перезапущена ВМЕСТЕ на admitted окружении (conservative canonical rule по quantitative authority); Phase 2: независимая работа МОЖЕТ продолжаться — NEXT = STEP 2.17C — SALES STRUCTURAL DEBT — DESIGN/IMPLEMENTATION PREPARATION (отдельный design-промпт; реализация НЕ в этом pass; каноническая запись 2.17C не зависит от 2.17B final qualification / PSP / RLS / deploy); PHASE 2 EXIT BLOCKED (2.17B = обязательный pre-exit gate; 2.18/2.18A Exit Audit зависит от 2.17B, остаётся NOT STARTED; continuing 2.17C не waives 2.17B); payment branch: 2.12A/2.12H APPROVED, 2.12B BLOCKED (provider/commercial), ADR-0015 PROPOSED — BLOCKED (коммерческое подтверждение, 0 provider approved), 2.12I DEFERRED, PSP subset DEFERRED; RLS DEFERRED (ADR-0014 ACCEPTED, verification at 2.18); 2.17A UNCHANGED (APPROVED with review fixes); negative checks все 0 (0 production/frontend/schema/migrations/CI/harness/tuning/targets, 0 fake PASS/FAIL, 0 2.17B approval, 0 Strict Review, 0 2.17C/2.18/RLS/PSP implementation, 0 release); artifact integrity PASS=… WARN=0 FAIL=0 regression 13/13; DEFERRED RETURN = STEP 2.17B final frozen-matrix qualification на admitted dedicated environment перед Phase 2 exit; 2.17C/2.18/RLS/PSP не начаты). Предшествующий **FINAL RE-QUALIFICATION ROUND 3 (DEDICATED ENVIRONMENT) — VERDICT C — QUALIFICATION INVALID / INCOMPLETE — отчёт `docs/prompts/PHASE_2_STEP_2.17B_FINAL_REQUALIFICATION_ROUND_3_DEDICATED_ENVIRONMENT_REPORT.md`:** dedicated Linux container environment `thq-r3` (thq-r3-backend node:22-alpine == HEAD 3ec8629, 325/325 src+prisma файлов SHA-identical; thq-pg postgres:16-alpine dedicated isolated network; travelhub_r3 58/58 миграций) ПРОВАЛИЛ обязательную admission-суиту §7 (fail-closed): **L1** Linux→thq-pg autocommit p50 120.4→400.8ms и explicit tx 27.8→262.0ms (N=20→50) — commit-bound writes сериализуются с конкуренцией; **pgbench server-side** ceiling 280 tps@c20 / **237 tps@c50** (НЕ масштабируется — WSL2 virtual disk fsync, не CPU: loadavg 0.67, 12 vCPU, 2.4GB free); **L1 differential** Linux client→native Windows PG 18.4: autocommit 937.1ms vs tx 130.9ms @N=50 — та же autocommit-сериализация node-postgres воспроизводится и с Linux-клиентом (не Windows-client артефакт; ни на одном клиентском расположении на этой физической машине гейт не спасти); **L2** dispatch 300/300 @20 chains/s ±0.00% VALID (клиент НЕ bottleneck); **L3** quote POST client p50 1,312ms / handler 147ms / trivial 186ms @conc 50 (gap ~1,165ms) — ХУЖЕ dispositioned host (733/119/78, gap 614ms); **REPRESENTATIVE seed** >16 мин не завершился (prepareDataset sequential: 1,000 chains × ~10 API calls при ~1.3s/step → часы; aborted per §7); Booking burst 20 chains/s требует ≈240–500 committed tx/s при измеренных ~125–190 tps (Node client) / 237–280 tps (server ceiling) → гейт не может быть валидно атрибуцирован; per §7 („Do not spend hours on a known-invalid environment“) multi-hour frozen matrix НЕ запускался → **VERDICT C** (Q1–Q15: NOT EXECUTED, 0 system PASS/FAIL claim); harness byte-identical HEAD (0 изменений); полная регрессия зелёная (backend tsc 0/build/unit 756/756/serial e2e 1194/1194 69 suites, frontend tsc 0/vitest 135/135/build, migrate 58/58 drift 0 „No difference detected“, artifact integrity PASS=149 WARN=0 FAIL=0 regression 13/13); negative checks все 0 (0 targets/SLO/production/query/index/schema/migration/pool/PG/worker/retry/timeout/cache changes, 0 --warmup=0, 0 hidden runs, 0 PSP network); cleanup: travelhub_r3 + l1probe (thq-pg) + l1probe_w (native PG) DROPPED, orphans 0; Step 2.17B НЕ APPROVED; strict review NOT STARTED; PSP subset DEFERRED; NEXT = ROUND 3 на genuinely dedicated Linux x86_64 host/VM с NATIVE (не-WSL2-virtualized) storage, admission-пробы обязаны пройти ДО матрицы (L1 autocommit И tx single-digit ms @N=50, L3 client≈handler @conc 50, REPRESENTATIVE seed bounded) — или authority-решение по qualification-environment стандарту; 2.17C/2.18/RLS/PSP не начаты). Предшествующий **BOOKING BURST QUALIFICATION ENVIRONMENT/BOTTLENECK DISPOSITION — отчёт `docs/prompts/PHASE_2_STEP_2.17B_BOOKING_BURST_QUALIFICATION_ENVIRONMENT_BOTTLENECK_DISPOSITION_REPORT.md`:** DISPOSITION = B — QUALIFICATION HOST/ENVIRONMENT BOTTLENECK PROVEN (controlled layered differential evidence: raw pg autocommit сериализуется линейно с конкуренцией N=5→79ms…N=50→621ms p50, а explicit tx параллельны 2–22ms — клиентская сериализация node-postgres на Windows; PostgreSQL server-side: 0 statements ≥10ms даже под 50-way burst (log_min_duration_statement=10 + калибровка pg_sleep 53ms) — сервер НЕ bottleneck; load client может валидно расписать frozen 20 chains/s: 300/300 ±0.00% против trivial no-DB сервера (chain p50 7ms) — клиент НЕ bottleneck; app handler p50 119ms @ conc 50 — НЕ bottleneck; conn-sampler: 21 conns / ~6 active / 0 locks / client-wait 21 — сервер ждёт клиента; booking burst fresh на committed HEAD (3 прогона): 131–155/300 started, achieved 8.6–9.9 chains/s, chain p50 5.4–6.3s / p95 6.1–7.3s, 0 failures/0 dup/1:1 convergence, correctness PASS — гейт FAIL только по load application (environment); **PAYMENT WARMUP/IDEMPOTENCY HARNESS DEFECT — FIXED** (root cause: runPacedWindow использовал window-local `n` от 0 для каждого окна, iteration.n не продвигался в paced-режиме → warmup и measurement генерировали ОДИНАКОВЫЕ Idempotency-Keys; фикс: единый монотонный identity stream iteration.n++ в loader.ts + явный учёт warmup/measurement слотов в run.ts + 2 новых unit-теста; live: payment-steady 2 RPS --warmup=5000 PASS (slots 50=40+10), payment-burst 10 RPS --warmup=3000 PASS (slots 180=150+30) — БЕЗ --warmup=0); regression probes (final code): EventBus steady 100 ev/s PASS (maxBacklog 19≤100, oldest 142ms≤10s, drain 504ms), burst 1000 PASS (drain 3.3s), recovery 5000/2 PASS (drain 10.3s≤120s), multi-instance 2+2 PASS (6000/6000, 3150/3150 per app), Payment 2/10 RPS PASS (p95 61/42ms), Payment conc-50 PASS 9/9 (p95 544ms≤1000, p99 1642ms≤2000); full regression зелёная (backend tsc 0/build/unit 756/serial e2e 1194/1194 69 suites, frontend tsc 0/vitest 135/build, migrate 58/58 drift 0, artifact integrity PASS=148 WARN=0 FAIL=0); negative checks: 0 production/query/index/migration/pool/worker/transaction-boundary/cache/Sales changes, 0 target changes, 0 frozen criteria ослабления, 0 --warmup=0 workaround, full Round 3 НЕ запускался; Step 2.17B НЕ APPROVED; strict review NOT STARTED; PSP subset DEFERRED; NEXT = FINAL RE-QUALIFICATION ROUND 3 на чистой/dedicated квалификационной машине (или authority-решение по окружению §9/§10); 2.17C/2.18/RLS/PSP не начаты). Предшествующий **PERFORMANCE REMEDIATION — отчёт `docs/prompts/PHASE_2_STEP_2.17B_PERFORMANCE_REMEDIATION_REPORT.md`:** REMEDIATION PARTIAL — NOT READY FOR ROUND 3 (Step НЕ APPROVED); root causes доказаны живыми пробами на isolated `travelhub_perf_rem3_233605` (PG 18.4, Node v24.18.0): **F-2 EventBus backlog 171>100** = sawtooth polling floor (canonical 2000ms интервал при 100 ev/s накапливает ~200 событий между циклами — гейт ≤100 математически невыполним) → канонический интервал воркера 2000→500ms + адаптивный self-scheduling drain (первый цикл немедленно, busy→100ms backoff, idle→500ms) + первый-цикл-без-задержки: maxBacklog 171→**16** (60s/6000 ev, 2 workers; ≤100 PASS), oldest PENDING 1.7s→**~150ms** (≤10s PASS), drain 514ms, 0 FAILED/0 duplicates, burst/recovery не регрессировали (PASS); **Class E payment.create tail p95 4,337ms @ conc 50 > 1,000ms** = pg.Pool default max=10 (Prisma driver adapter; пул насыщен 10 соединениями при 50 concurrent — connection-sampler 23/23 pinned) + BusinessSequence PAY row-lock convoy (50-way nextCode p50 257ms) → конфигурируемый пул `DATABASE_POOL_SIZE` (default 20 + выделенный seqClient 3; бюджет 2+2 топологии 4×23=92 < PG max_connections=100) + Hi/Lo блочная аллокация BusinessSequence (блок 100, пери-процессный claim-gate, 0 row-lock конвоя: 50-way nextCode 257→**5ms**): p95 4,337→**553–601ms** (два финальных прогона rem4-payc2/payc3; correctness 9/9, 0 dup, one-active invariant) ≤ 1,000 PASS; **Booking/Order burst 20 chains/s 103/300 (p95 14.2s) > frozen gate** = составной root cause (пул 10 + BusinessSequence конвой + publishPending herd + per-request overhead под конкуренцией): после фиксов **134/300, chain p95 6.9s** — улучшено 2×, гейт ОСТАЁТСЯ FAIL по load application (55% off ±5%) (цепочка = 10 последовательных HTTP round-trips; при conc 50 каждый шаг ~336–446ms (handler 76–113ms, guards 4–7ms, trivial-route 43ms — остаточный overhead под конкуренцией не сводится к пулу: 20/40/60/80 pool → 639/1203/1173/1247ms, т.е. окружение/DB-сервер-эффекты shared Windows-box с запущенным dev server — доказано raw pg + raw-node-http пробами, НЕ app defect); steady 6 chains/s остаётся PASS (120/120, load validity 0.00%, p95 550ms); duplicates=0, Booking↔Order 1:1 convergence везде; multi-instance 2+2 PASS (с block-аллокацией); полная регрессия зелёная (backend tsc 0/build/unit 754/serial e2e 1194/1194 69 suites, frontend tsc 0/vitest 135/build, migrate 58/58 drift 0, artifact integrity PASS=147 WARN=0 FAIL=0 regression 13/13); known harness bookkeeping defect задокументирован: paced-payment warm-up slots не учитываются (reproducible; `--warmup=0` → полностью green, max-effort → green — НЕ system failure, НЕ причина изменений); Round-2 footer приведён к новому формату чекера (0 history rewrite); negative checks: 0 production tuning для PASS-гейтов, 0 target changes, 0 frozen criteria ослабления, 0 schema/migration/CI changes, Step НЕ APPROVED, final qualification Round 3 НЕ запускался (отдельный промпт), strict review NOT STARTED, PSP subset DEFERRED; NEXT = AUTHORITY/ENVIRONMENT DECISION по §J.1 (чистая квалификационная машина / альтернативный клиент / authority) → FINAL RE-QUALIFICATION ROUND 3 AGAINST UNCHANGED FROZEN TARGETS. REMEDIATION PARTIAL — NOT READY FOR ROUND 3 (Step НЕ APPROVED); root causes доказаны живыми пробами на isolated `travelhub_perf_rem3_233605` (PG 18.4, Node v24.18.0): **F-2 EventBus backlog 171>100** = sawtooth polling floor (canonical 2000ms интервал при 100 ev/s накапливает ~200 событий между циклами — гейт ≤100 математически невыполним) → канонический интервал воркера 2000→500ms + адаптивный self-scheduling drain (первый цикл немедленно, busy→100ms backoff, idle→500ms) + первый-цикл-без-задержки: maxBacklog 171→**16** (60s/6000 ev, 2 workers; ≤100 PASS), oldest PENDING 1.7s→**~150ms** (≤10s PASS), drain 514ms, 0 FAILED/0 duplicates, burst/recovery не регрессировали (PASS); **Class E payment.create tail p95 4,337ms @ conc 50 > 1,000ms** = pg.Pool default max=10 (Prisma driver adapter; пул насыщен 10 соединениями при 50 concurrent — connection-sampler 23/23 pinned) + BusinessSequence PAY row-lock convoy (50-way nextCode p50 257ms) → конфигурируемый пул `DATABASE_POOL_SIZE` (default 20 + выделенный seqClient 3; бюджет 2+2 топологии 4×23=92 < PG max_connections=100) + Hi/Lo блочная аллокация BusinessSequence (блок 100, пери-процессный claim-gate, 0 row-lock конвоя: 50-way nextCode 257→**5ms**): p95 4,337→**553–601ms** (два финальных прогона rem4-payc2/payc3; correctness 9/9, 0 dup, one-active invariant) ≤ 1,000 PASS; **Booking/Order burst 20 chains/s 103/300 (p95 14.2s) > frozen gate** = составной root cause (пул 10 + BusinessSequence конвой + publishPending herd + per-request overhead под конкуренцией): после фиксов **134/300, chain p95 6.9s** — улучшено 2×, гейт ОСТАЁТСЯ FAIL по load application (55% off ±5%) (цепочка = 10 последовательных HTTP round-trips; при conc 50 каждый шаг ~336–446ms (handler 76–113ms, guards 4–7ms, trivial-route 43ms — остаточный overhead под конкуренцией не сводится к пулу: 20/40/60/80 pool → 639/1203/1173/1247ms, т.е. окружение/DB-сервер-эффекты shared Windows-box с запущенным dev server — доказано raw pg + raw-node-http пробами, НЕ app defect); steady 6 chains/s остаётся PASS (120/120, load validity 0.00%, p95 550ms); duplicates=0, Booking↔Order 1:1 convergence везде; multi-instance 2+2 PASS (с block-аллокацией); полная регрессия зелёная (backend tsc 0/build/unit 754/serial e2e 1194/1194 69 suites, frontend tsc 0/vitest 135/build, migrate 58/58 drift 0, artifact integrity PASS=147 WARN=0 FAIL=0 regression 13/13); known harness bookkeeping defect задокументирован: paced-payment warm-up slots не учитываются (reproducible; `--warmup=0` → полностью green, max-effort → green — НЕ system failure, НЕ причина изменений); Round-2 footer приведён к новому формату чекера (0 history rewrite); negative checks: 0 production tuning для PASS-гейтов, 0 target changes, 0 frozen criteria ослабления, 0 schema/migration/CI changes, Step НЕ APPROVED, final qualification Round 3 НЕ запускался (отдельный промпт), strict review NOT STARTED, PSP subset DEFERRED; NEXT = AUTHORITY/ENVIRONMENT DECISION по §J.1 (чистая квалификационная машина / альтернативный клиент / authority) → FINAL RE-QUALIFICATION ROUND 3 AGAINST UNCHANGED FROZEN TARGETS. **HARNESS/ENVIRONMENT REMEDIATION — отчёт `docs/prompts/PHASE_2_STEP_2.17B_QUALIFICATION_HARNESS_ENVIRONMENT_REMEDIATION_REPORT.md`:** VERDICT A — READY FOR RE-QUALIFICATION; 11/11 блокеров (H1–H11) воспроизведены и исправлены ТОЛЬКО в харнесе (0 production tuning, 0 target changes, frozen targets неизменны): H1 arrival-rate pacing — новый `backend/src/perf/lib/pacer.ts` (monotonic `scheduled_start(n)=phase_start+n/rate`, НЕ completion-rate pacing, concurrency ceiling, ±5% load-validity `LOAD_APPLICATION_VALID`, lag/start/complete метрики) — live 50/100/200 RPS ±0% valid, негатив concurrency-starved 300 RPS → valid:false; H2 `--warmup` реально проводён (paced warm-up на целевой rate, отделён от measurement, 5-min manifest `warmupMs:300_000`, validation на 2 s); H3 dataset-профили SMALL/REPRESENTATIVE/STRESS (`qualification.ts datasetCountsFor`; REPRESENTATIVE = authority counts users ≥1k/products ≥500/customers ≥1k/quotes ≥1k/order-chains ≥1k/payment-orders ≥500/ledger ≥5k/EventBus-seed ≥5k, синтетика run-prefixed, без schema change); H4 payment 2/10 RPS + concurrency 50 (pay-s 30 facts/0 dup, pay-b 80 facts/0 dup, pay-c 100 facts/0 dup, slots=measurement+warmup 226=176+50); H5 Booking/Order 6/20 RPS (steady 48/48 @6/s valid chain p95 576 ms PASS; burst 20 RPS EXPRESSIBLE + честное наблюдение: 61/200 started, 50 chain-abort на 15 s/call timeout в single-instance exploratory, 11 orders 1:1 convergence, 0 dup — записано, НЕ тюнинговано; финальная re-qualification в 2+2 топологии рассудит gate); H6 login 2/5 RPS distinct-users throttle-respected (24/24, 40/40, 0 unexpected); H7 EventBus steady 100 ev/s generation-under-processing (1,500 emitted/published, backlog max 172, oldest PENDING max 1.7 s); H8 burst конфигурируем (1,000: seeded→published, drain 11.3 s, poison isolated); H9 recovery 5,000/2 workers CANONICAL config (interval 2000 ms/batch 100, override fail-closed `QUALIFICATION_CONFIG_VALID=false` exit 2; drain 51.3 s ≤ 120 s, poison isolated; chunked seeding 500/tx); H10 2 app + 2 worker реальная HTTP-топология (round-robin 1,100/1,100, probes 200/200 drained, per-instance counts; boot-role seam `OUTBOX_WORKER_ENABLED` explicit fail-closed, production default неизменен); H11 soak 50 RPS/250 expressible (25 s validation 1,250/1,250 @ 49.98/s valid; полный 30-min НЕ запускался). Харнес-баги, найденные и исправленные в этом pass: loader POST без Content-Type → 415; max-effort race iteration.n (дубль order+key) → increment до await; exit-code баг (`process.exitCode===0` никогда не матчился) → FAIL→exit 1; idempotency-slots check игнорировал warm-up requests → reached=started+warmup; booking «1 Order per completed chain» считал aborted chains → successful chains; booking convergence считал OrderCreated глобально → scenario-scoped; OBS-2 классифицирован (24 PUBLISHED = harness-owned residue sale/checkout/quote/customer aggregateIds — cleanup scope расширен, canonical history не удаляется); OBS-3 resolved (override fail-closed); OBS-4 resolved (лог+exit-marker+поллинг, in-process boot/close, orphans=0; два invalidated прогона остаются записаны); OBS-1 sales.list НЕ тюнингован (root cause NOT YET PROVEN, судьба gate — на paced re-qualification; новое наблюдение того же класса: booking-burst chain abort). Полная регрессия: backend tsc 0/build PASS/unit 740, serial e2e 1194/1194 (69 suites), frontend tsc 0/vitest 135/build PASS, migrate 58/58 drift 0, artifact integrity PASS=142 WARN=0 FAIL=0 (regression 13/13); negative checks все 0 (0 SLO/load changes, 0 production/query/index/schema/pool/worker/retry/auth/idempotency/payment tuning, 0 skipped/weakened tests, 0 hidden failures, final qualification NOT executed, Step НЕ APPROVED, strict review NOT STARTED, PSP subset DEFERRED, 2.17C/2.18/RLS/PSP не начаты); Step 2.17B = HARNESS REMEDIATION COMPLETED — READY FOR FINAL RE-QUALIFICATION — NOT APPROVED; NEXT = FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS). Предшествующий **FINAL QUALIFICATION — отчёт `docs/prompts/PHASE_2_STEP_2.17B_FINAL_QUALIFICATION_REPORT.md`:** VERDICT C — INVALID/INCOMPLETE; baseline regression зелёная (backend tsc 0/build PASS/unit 714, serial e2e 1194/1194 69 suites; frontend tsc 0/vitest 135/build PASS; migrate 58/58 drift 0; checker PASS=141 WARN=0 FAIL=0); dedicated isolated perf DB (PG 18.4, Node v24.18.0, 12 vCPU, localhost, dropped after audit); ИСПОЛНИМОЕ подмножество прогнано честно против frozen targets: STEADY 15 min max-effort 225,270 req / 250 r/s / 0 unexpected / correctness PASS, PEAK 15 min 330,656 req / 367 r/s / 0 unexpected / PASS, BURST 60 s 51,766 req / 863 r/s / 0 unexpected / PASS, SOAK 30 min 558,609 req / 310 r/s / 0 unexpected / PASS, PAYCREATE one-shot 7 facts + 5 business no-ops / 0 duplicate / 0 raw 500 / nested chain inbox 8/8, EVENTBUS recovery 250→250 / drain 1.3 s / poison isolated / 2-instance 100/100; НО валидный verdict против approved matrix НЕВОЗМОЖЕН из-за доказанных harness capability gaps (харнес НЕ изменён per §34): (1) нет arrival-rate pacing — loader max-effort concurrency («@ 50/100/200 RPS» нельзя задать), (2) `--warmup` парсится но не применяется (warm-up фиксирован ≤2 s, 5-min недоступен), (3) dataset generator только SMALL (authority-scale >=1k users и т.д. не поддержан), (4) payment.create sustained 2/10 RPS — только one-shot, (5) Booking/Order 6/20 RPS — нет write-профиля, (6) login 2/5 RPS — 5 one-shot probes, (7) EventBus steady 100 ev/s — нет generation-сценария, (8) EventBus burst 1,000 — SEED_COUNT=250 hardcoded, (9) recovery 5,000/2 workers/canonical config — 250 seed + hardcoded OUTBOX_WORKER_INTERVAL_MS=200/500 override (нарушает «do not tune»), (10) multi-instance 2 app+2 worker с HTTP — только 2 worker в eventbus-фазе, (11) soak 30 min @ 50 RPS — duration executed, pacing отсутствует; OBSERVATIONS (не фиксы): OBS-1 Class B sales.list p95 деградирует с нагрузкой (428 ms @ 250 r/s → 1,533 ms @ 367 → 2,427 ms @ 310/conc 250; classification DATABASE QUERY/CONNECTION POOL CONTENTION, ROOT CAUSE NOT YET PROVEN, routed to remediation), OBS-2 paycreate cleanup оставляет 24 PUBLISHED event rows, OBS-3 worker-interval override → canonical-config, OBS-4 два прогона invalidated по orchestration/session (recorded, не скрыты); rerun history documented; memory NOT MEASURED — OBSERVABILITY LIMITATION; negative checks все 0 (targets/tuning/schema/worker/production/PSP/2.12B/2.12I/2.17C/2.18/RLS); Step НЕ APPROVED; strict review NOT STARTED; PSP subset DEFERRED; NEXT = QUALIFICATION HARNESS/ENVIRONMENT REMEDIATION (отдельный промпт), затем re-qualification против неизменных frozen targets; 2.17C/2.18/RLS/PSP не начаты). Предшествующий authority pass — **QUANTITATIVE TARGETS AUTHORITY DECISION — отчёт `docs/prompts/PHASE_2_STEP_2.17B_QUANTITATIVE_TARGETS_AUTHORITY_DECISION_REPORT.md`:** VERDICT A — Business/Product/Operations authority supplied explicit owner-approved V1 planning/qualification targets (НЕ из localhost-бенчмарков, НЕ production capacity claims): V1 envelope registered 100k / MAU 25k / DAU 5k; concurrency normal 100 / V1 peak 250 / qualification 500 / burst 1,000; read/write mix 80/20 (login ≤5%, booking/order ≤5%, payment ≤2%, other writes ≤8%); load normal 25 / V1 peak 50 / qual sustained 100 / qual burst 200 RPS, headroom 2.0x, future planning 1,000 RPS (НЕ Phase 2 gate); latency p95/p99 public reads 300/750 ms, authenticated 500/1000 ms, ordinary writes 750/1500 ms, concurrency-sensitive 1000/2000 ms, payment.create 1000/2000 ms (internal only), login 750/1500 ms; reliability unexpected 5xx/timeout/transport = 0 (qualification gates, не production SLA); domain rates payment.create 1/2/10 RPS (peak/qual/burst, concurrency 50), Booking/Order 3/6/20 RPS, login 1/2/5 RPS (per-instance throttle соблюдается, distinct users, не обходится); EventBus steady 25 / peak 50 / qual 100 ev/s, burst 1,000 events, normal backlog ≤100, oldest PENDING ≤10 s, recovery 5,000 events / 2 workers / max drain ≤120 s (at-least-once + Inbox idempotency, никогда exactly-once); qualification 2 app + 2 worker, dedicated isolated env, warm-up 5 min → steady 15 min @ 50 RPS → peak 15 min @ 100 RPS → burst 60 s @ 200 RPS → soak 30 min @ 50 RPS / concurrency 250, burst p99 ceilings A/B 2000 ms / C–F 3000 ms; regression tolerance p95 >20% / p99 >25% / throughput >20% (warn; correctness regression = FAIL); stress characterization ceiling 500 RPS / 2,000 concurrent (НЕ gate); dataset synthetic (users ≥1k, products ≥500, CRM ≥1k, sales ≥1k, booking/order ≥1k, payment-orders ≥500, finance/ledger ≥5k, EventBus seed ≥5k); противоречий с утверждёнными инвариантами НЕ найдено (login throttle, EventBus worker batch 100/2s × 2 ≈ 100 ev/s ≥ 5,000/120 s, payment.create per-order idempotency, 2.0x = 100/50 внутренне согласованы); Step НЕ APPROVED; final qualification NOT STARTED — UNBLOCKED; strict review NOT STARTED; PSP subset DEFERRED (ADR-0015 + 2.12B); 0 code/frontend/schema/migration/CI/harness/tuning changes; negative checks все 0; artifact integrity PASS=… WARN=0 FAIL=0; NEXT = FINAL QUALIFICATION AGAINST APPROVED TARGETS; 2.17C/2.18/RLS/PSP не начаты). Предшествующий Verdict B (PARTIAL) — отчёт `docs/prompts/PHASE_2_STEP_2.17B_SLO_LOAD_AUTHORITY_DECISION_REPORT.md`: repo-wide verified 0 approved quantitative targets (0 SLO numbers, 0 demand documents, 0 traffic model — engineering НЕ выдумывает business demand); APPROVED только contract-level gates: correctness-under-load (0 duplicate Payment/Order/Commission/Accrual, 0 wrong/divergent replay, 0 lost committed PENDING, 0 poison-blocking, 0 raw 500 из controlled races, Decimal exact, 0 invalid terminal transition — fast-but-wrong FAILS) + HTTP reliability (unexpected 5xx/timeout/transport = 0, repo-wide gate); ВСЕ количественные таргеты TBD с именованными владельцами: expected V1 peak RPS / concurrency / read-write mix / booking-order-payment-login rates (Business/Product), p95/p99 latency per route class A–F (Business/Product), headroom factor (Business/Product + Operations), EventBus steady/peak/burst/backlog-age/max-drain (Operations/Engineering), soak duration (Operations), release regression tolerance (Engineering/Operations), qualification environment/instance counts (Operations); четыре концепта разделены жёстко: V1 LAUNCH ≠ QUALIFICATION ≠ FUTURE SCALING (planning-only, non-blocking) ≠ OBSERVED MEASUREMENT (localhost harness evidence ~367/235/1544/320 req/s, ~187 ev/s — НЕ authority); canonical authority table 25 rows (APPROVED|TBD + owner + rationale + measurement method); final qualification BLOCKED где material — не waived; Step НЕ APPROVED; PSP subset DEFERRED (ADR-0015 + 2.12B); 0 code/frontend/schema/migration/CI/harness/tuning/index/worker changes; negative checks все 0; artifact integrity PASS=… WARN=0 FAIL=0; NEXT = FINAL QUALIFICATION AGAINST APPROVED TARGETS после authority; 2.17C/2.18/RLS/PSP не начаты). harness implementation — отчёт `docs/prompts/PHASE_2_STEP_2.17B_LOAD_PERFORMANCE_HARNESS_IMPLEMENTATION_REPORT.md`; dependency-free Node harness `backend/src/perf/` — run.ts + lib/{config,guard,loader,classify,percentile,redact,env,artifacts,seed,correctness}.ts + 31 unit/integration tests; TOOL DECISION: 0 третьесторонних зависимостей (k6/autocannon/Artillery rejected — нужен оркестратор для auth/idempotency-сценариев, k6 = Go binary; критерии из дизайна все покрыты), lockfile НЕ изменён; SAFE-TARGET GUARD fail-closed (NODE_ENV=production refuse, canonical/prod-like DB names refuse, non-local требует --allow-non-local, stress требует --stress; live: canonical DB → exit 2, exec-fail → exit 1); профили SMOKE/BASELINE/STEADY/PEAK/BURST/SOAK/STRESS + paycreate (external idempotency) + eventbus-recovery (burst PENDING → drain, poison isolation, multi-instance); LIVE EXPLORATORY ВАЛИДАЦИЯ (isolated travelhub_perf_* DB, 58/58 migrate, localhost): SMOKE 3669 req 367 r/s 0 unexpected, BASELINE 2351 req 235 r/s 0 unexpected (вкл. /api/v1/customers — CRM-контроллер смонтирован на /customers, НЕ /crm/customers), PAYCREATE 7 facts/8 orders 0 raw 500 (10 unique keys → 5 facts + 5 canonical business no-ops — PaymentService idempotent retry, verify code; concurrent identical 4×201 → 1 fact; divergent 1×201+1×409; COMPLETED slots = 12 = facts 7 + no-op 5; nested chain OrderRequested→Order→OrderCreated→consumed inbox 8/8), EVENTBUS 250 seeded → 250 published drain 1335ms ~187 ev/s poison isolated multi-instance 100/100, BURST 7720 req ~1544 r/s 0 unexpected, SOAK(30s) 9591 req ~320 r/s 0 unexpected; correctness-under-load HARD GATE PASS везде; findings F1–F4 = harness-фиксы (crm path; paycreate expectation model per canonical business idempotency; commission-accrual требует policy — nested-chain proof через inbox rows; exit-code/verdict wiring); регрессия: unit 714/714 (+31 perf), serial e2e 1194/1194 (69 suites, 592+602), frontend tsc 0 + vitest 135/135 + build, backend tsc + build, migrate 58/58 drift 0 („No difference detected“), artifact integrity PASS=135 WARN=0 FAIL=0 (regression 13/13); артефакты — per-run JSON под `backend/artifacts/performance/` (gitignored); Step НЕ APPROVED; PSP subset deferred; NEXT = STEP 2.17B SLO/LOAD AUTHORITY DECISION → FINAL QUALIFICATION → STRICT REVIEW). Предшествующий authority/design reconciliation (2026-08-16; отчёт — `docs/prompts/PHASE_2_STEP_2.17B_LOAD_PERFORMANCE_AUTHORITY_DESIGN_RECONCILIATION_REPORT.md`; дизайн — `docs/architecture/load-performance-qualification-2.17B.md`, runbook-design — `docs/operations/load-performance-qualification-runbook.md`): независимый pre-Phase-2-Exit gate (НЕ часть scope Step 2.17): load/стресс сценарии (auth/API baseline, catalog/search, checkout, payment initiation, PSP webhook burst + duplicate storm, refund concurrency, outbox backlog drain, inbox contention, advisory-lock hot keys, DB pool saturation, Finance reads). **DECOMPOSITION (repository-backed):** A. PLATFORM BASELINE QUALIFICATION — executable now (29 контроллеров / ~280 routes инвентаризированы; workload-матрица на реальных routes; EventBus worker interval 2000ms/batch 100; login throttle 10/15min in-memory per-instance; Prisma pool default; 0 load-tooling/0 metrics/0 SLO — verified repo-wide); B. PSP/WEBHOOK PERFORMANCE SUBSET (`STEP 2.17B-PSP`) — DEFERRED until ADR-0015 ACCEPTED + реальный провайдер + 2.12B runtime + sandbox/contract evidence (webhook burst/duplicate storm, provider latency/rate limits/timeout-retry, callback reorder, signature cost, convergence, outage — НЕ реализовывать сейчас). **SLO/SLI числа требуют authority (не выдумывать; сейчас SLO нет — каждая строка `TBD — BUSINESS/PRODUCT/OPERATIONS AUTHORITY REQUIRED`); никакое SLO не изобретено; production capacity НЕ claimed.** **VERDICT A (из канонического текста Roadmap, не по удобству):** harness/measurement implementation может идти с exploratory (non-authoritative) профилями; FINAL QUALIFICATION против approved targets требует authority; финальный APPROVED статус Step 2.17B ЗАПРЕЩЁН до (1) approved targets, (2) platform baseline measured, (3) correctness-under-load hard gates PASS, (4) dispositioning production-like qualification, (5) PSP subset остаётся deferred. **Correctness-under-load = HARD GATE:** 0 duplicate Payment/Order/Commission/Accrual, 0 invalid Booking transition, 0 broken availability invariant, 0 divergent idempotency replay, 0 lost PENDING, 0 raw 500 из controlled races, Decimal exact; fast-but-wrong FAILS. Workload classes smoke/baseline/steady/peak/burst/soak/stress/recovery; latency p50/p95/p99/max; throughput ops/sec + EventBus/backlog; ошибки: expected 4xx/409/429 vs unexpected 5xx. Tool НЕ выбран (критерии зафиксированы, зависимость НЕ установлена). Результаты — per-run `summary.json` в отдельной директории результатов (env metadata обязательна; local/CI ≠ production capacity proof). PSP webhook burst subset — обязателен в 2.12B. Owner: reconciliation 2026-08-15 (доказательство отсутствия: 0 load-тулинг в package.json, 0 perf-docs) + authority/design reconciliation 2026-08-16. NEXT = STEP 2.17B HARNESS IMPLEMENTATION или SLO/LOAD AUTHORITY DECISION; 2.17C/2.18/RLS/PSP не начаты). **2026-08-16 HARNESS REMEDIATION — см. сегмент выше**. **FINAL RE-QUALIFICATION (2026-08-17; отчёт — `docs/prompts/PHASE_2_STEP_2.17B_FINAL_REQUALIFICATION_REPORT.md`):** VERDICT C — INVALID/INCOMPLETE; baseline regression зелёная (backend tsc 0 / build PASS / unit PASS / serial e2e 1194/1194 69 suites; frontend tsc 0 / vitest 135/135 (1 env-flake rerun документирован) / build PASS; migrate 58/58 drift 0; artifact integrity PASS=144 WARN=0 FAIL=0, regression 13/13); isolated DB travelhub_perf_000741 (PG 18.4, Node v24.18.0, 12 vCPU, localhost, dropped after evidence); **проявленный harness-блокер (F-1, HIGH):** REPRESENTATIVE dataset НЕ подготовляем — `seed.ts drainOutbox()` bound = 20 раундов × publishPending(200) = 4,000 событий < REPRESENTATIVE EventBus seed 5,000 (+ ~2–3k chain-событий); live: `qual-steady` (rq-steady) упал на сидинге через ~12.3 мин «outbox did not drain within bound» (dataset=null; успело: 1003 users / 1253 products / 1000 customers / 1753 quotes / ~752 sales); REPRESENTATIVE никогда не валидировался живьём (ремедиация — только SMALL) → dataset-гейт (§7) и все dataset-зависимые гейты (steady/peak/burst/soak 15m/15m/60s/30m, payment 2/10/50, Booking/Order 6/20, login 2/5) = BLOCKED/INVALID; харнесс НЕ изменён (per §1/§27); **независимые гейты исполнены с валидным evidence:** EventBus steady 100 ev/s (rq-ebs) 3000/3000 emitted/published @100 ev/s, drain 506 ms, oldest PENDING 1.77 s ≤ 10 s PASS, **max backlog 178 > 100 → гейт FAIL (F-2, HIGH — формальный FAIL per §16, не реинтерпретирован, не тюнингован; сходится к 0 после генерации)**, EventBus burst 1,000 (rq-ebb) 1000/1000 drain 11.3 s poison isolated PASS, EventBus recovery 5,000/2 workers (rq-ebr) 5000/5000 drain 51.1 s ≤ 120 s poison isolated PASS, multi-instance 2 app + 2 worker (rq-topo) 3150/3150 round-robin @100 RPS ±0.00% load-valid, probes 200/200 drained PASS; smoke/baseline/paycreate (SMALL, correctness-only) PASS (0 unexpected 5xx/timeout/transport везде; paycreate 7 facts + no-ops, 0 duplicate, 0 raw 500, 1×409 expected; 0 lost PENDING; poison isolation PASS); OBS-1 sales.list NOT JUDGED (paced qual заблокирован, root cause NOT YET PROVEN, 0 tuning); Booking/Order burst NOT JUDGED; memory: seed-ран peak 1,357 MB RSS (информативно, без SLO); cleanup PASS (perf DB dropped, orphans 0, residue 1550 PUBLISHED удалён с DB); пост-ран регрессия зелёная (0 production/harness/schema/migration/CI изменений); negative checks все 0; Step НЕ APPROVED; strict review NOT STARTED; PSP subset DEFERRED; NEXT = QUALIFICATION HARNESS REMEDIATION (round 2) — drainOutbox bound + live REPRESENTATIVE validation + EventBus backlog gate решение; 2.17C/2.18/RLS/PSP не начаты). **HARNESS REMEDIATION ROUND 2 (2026-08-17; отчёт — `docs/prompts/PHASE_2_STEP_2.17B_QUALIFICATION_HARNESS_REMEDIATION_ROUND_2_REPORT.md`):** VERDICT A — ROUND 2 PASS; F-1 (HIGH harness-дефект seed-drain) воспроизведён по коду (bound `20 раундов × publishPending(200) = 4,000` событий < REPRESENTATIVE EventBus seed 5,000 + ~2–3k chain-событий; live rq-steady «outbox did not drain within bound») и ИСПРАВЛЕН ТОЛЬКО в харнессе: `drainOutbox()` — bounded state-driven (завершение по состоянию: PENDING===0 && retryable FAILED===0, либо явный safety bound; `batchSize` 200 / `maxIterations` 2,000 / `maxDurationMs` 10 мин; retryFailed+publishPending — ПРОИЗВОДСТВЕННЫЕ методы, не переписаны; poison/exhausted retained+isolated; fail-closed с диагностикой pending/retryable/iterations/elapsed/batch; без unbounded loop; без удаления outbox/inbox history); nested-события доказаны (unit тест 5 + live chains 1,000 orders); **live-валидация REPRESENTATIVE — MANDATORY (§9) — PASS ×2** (r2-repr, r2-repr2; isolated `travelhub_perf_010830`, 58/58, drift 0; profile smoke --dataset=REPRESENTATIVE): фактические counts users 1,000 / products 500 / customers 1,000 / quotes 1,000 / orderChains 1,000 / paymentCapableOrders 1,000 / ledger 5,000 / eventBusSeed 5,000 — все authority-минимумы достигнуты; drain afterProbes: 25 итераций / 5,000 published / 7,706 ms / remainingPending 0 / retryableFailed 0 (старый cap 4,000 обойдён); drain afterChains: 1 итерация / 0 published (HTTP-путь публикует синхронно) / 0 remaining; smoke после сида PASS (1,151 req, 0 unexpected); cleanup-скоуп расширен на ProductCreated outbox/inbox (round-1 F-4: было 1,500 PUBLISHED residue → стало 0; outbox 0 / inbox 0 / доменные таблицы 0 после cleanup, только 1 untracked bootstrap-admin, удалён с DB); perf DB dropped, orphans 0; **F-2 (HIGH, valid system FAIL: EventBus steady 100 ev/s max backlog 178 > 100, oldest 1.77 s ≤ 10 s) СОХРАНЁН verbatim** — 0 production EventBus изменений, 0 worker interval/batch изменений, 0 target-изменений, 0 переклассификаций (свежий суд по backlog-гейту — на следующей полной re-qualification; если снова >100 → Step 2.17B FAIL → отдельный Performance Remediation); 0 sales/booking/query/index/pool/PG tuning; production code 0 / schema 0 / migrations 0 / CI 0; тесты: perf-harness 13 новых (12 §13 + contract REPRESENTATIVE ≥5,000), unit 753/753, serial e2e 1194/1194 (69 suites), frontend tsc 0 / vitest 135/135 / build, migrate 58/58 drift 0, artifact integrity PASS=145 WARN=0 FAIL=0 (regression 13/13); negative checks все 0; Step НЕ APPROVED; strict review NOT STARTED; PSP subset DEFERRED; NEXT = FINAL RE-QUALIFICATION AGAINST UNCHANGED APPROVED TARGETS (REPRESENTATIVE теперь поднимается); 2.17C/2.18/RLS/PSP не начаты **FINAL RE-QUALIFICATION ROUND 2 (2026-08-17; отчёт — `docs/prompts/PHASE_2_STEP_2.17B_FINAL_REQUALIFICATION_ROUND_2_REPORT.md`):** VERDICT B — VALID SYSTEM FAIL; полная frozen-матрица исполнена на REPRESENTATIVE dataset (isolated `travelhub_perf_r2fq_095905`, PG 18.4, Node v24.18.0, 12 vCPU, SHA d9f25bb, 58/58 drift 0, dropped after evidence): STEADY 45,000 @50.00/s ±0% VALID PASS (A p95 20.0 / B 34.8 ms), PEAK 90,000 @100.00/s PASS (A 20.3 / B 37.6), BURST 12,000 @199.8/s PASS (A p95 55.3 / B 448.4, p99 96.8/717.2), SOAK 30min 90,000 @50.0/s/250 PASS (0 unexpected), payment 2 RPS 120/120 PASS (Class E p95 243 ms) / 10 RPS 200/200 PASS (p95 432 ms) / concurrency 50 correctness PASS (0 dup, slots exact 1,345=1,345) но Class E tail p95 4,337 ms > 1,000 → valid failure (root cause NOT YET PROVEN, 0 tuning), Booking/Order 6 chains/s 348/360 (3.33%) PASS (chain p95 2.5 s) но burst 20 chains/s **VALID FAIL** — 103/300 started при concurrency 50 (load-validity 65.7% off; chain p95 14.2 s; 0 dup, 1:1 convergence; classification UNKNOWN — ROOT CAUSE NOT YET PROVEN, согласуется с prior single-instance 20 chains/s abort observation, 0 production/timeout/query/index/pool tuning), login 2 RPS 120/120 PASS (F p95 112.6) / 5 RPS 100/100 PASS (p95 100.0; throttle 0×429 respected), EventBus steady 100 ev/s 3,000/3,000 @100 ev/s drain 516 ms oldest PENDING 1.7 s ≤ 10 s PASS но **max backlog 171 > 100 → F-2 VALID FAIL ПОДТВЕРЖДЁН FRESH** (исторический 178 → 171; canonical 2-worker config interval 2000/batch 100; 0 tuning; сходится к 0 после генерации), EventBus burst 1,000 PASS (drain 11.2 s, poison isolated), recovery 5,000/2 workers PASS (drain 51.1 s ≤ 120 s, poison isolated), multi-instance 2 app+2 worker PASS (6,000/6,000, per-app 3,149/3,150, probes 200/200, drain 8 ms); correctness-under-load HARD GATE PASS везде (0 duplicate Payment/Order, exact idempotency slots, 0 raw 500, 0 lost PENDING, poison isolated); known harness bookkeeping artifact документирован: paced warm-up окно повторяет iteration indices measurement → одинаковые Idempotency-Keys → check `completedSlots === started+warmup` невыполним даже при 100% корректности (payment-steady/burst executed с `--warmup=0` → completedSlots===started exact 120/120, 200/200 PASS — параметр харнесса, не изменение); invalid/superseded runs записаны не скрыты (r2fq3-* SMALL — не authority dataset; r2fq4-* прерванная серия + тот же warmup-артефакт — superseded r2fq5-*); Class C target не упражнялся ни одним frozen-профилем — NOT JUDGED (не waived); PSP subset DEFERRED; регрессия: backend tsc 0 / build PASS / unit 753/753 / serial e2e 1194/1194 (69 suites), frontend tsc 0 / vitest 135/135 / build, migrate 58/58 drift 0 (`migrate diff --from-config-datasource --to-schema` empty), artifact integrity PASS 0 WARN 0 FAIL (regression 13/13); cleanup: perf DBs dropped, travelhub_perf* осталось 0, orphans 0; negative checks все 0 (0 targets/SLO/EventBus-rate/duration/dataset changes, 0 production/query/index/schema/migration/pool/PG/worker/retry/timeout/cache tuning, 0 skipped/weakened tests, 0 hidden failures); Step 2.17B остаётся NOT APPROVED (VERDICT B — не APPROVED); strict review NOT STARTED; NEXT = STEP 2.17B PERFORMANCE REMEDIATION (EventBus backlog gate + Booking burst 20 chains/s + Class E payment.create tail @ conc 50 — root-cause и remediation только, frozen targets неизменны); 2.17C/2.18/RLS/PSP не начаты

· **Step 2.17C --- Sales Domain Structural Decomposition** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-18; strict review — `docs/prompts/PHASE_2_STEP_2.17C_SALES_STRUCTURAL_DEBT_STRICT_REVIEW_REPORT.md`; implementation — `docs/prompts/PHASE_2_STEP_2.17C_SALES_STRUCTURAL_DEBT_BEHAVIOR_PRESERVING_IMPLEMENTATION_REPORT.md`; design — `docs/architecture/sales-structural-decomposition-2.17C.md`; VERDICT A — APPROVED; 66/66 methods reconciled, facade 2,527→440 lines, sole-writer invariant PASS, 22 tx roots PASS, completeSale atomicity PASS, reverse in-tx contract PASS, event/outbox PASS, money/freeze PASS, RBAC/ownership PASS, idempotency/concurrency PASS, error contracts PASS, 0 circular deps, 0 CRITICAL/HIGH findings, 0 review fixes; regression: backend tsc 0 / build PASS / unit 780/780 / e2e 1194/1194, frontend tsc 0 / vitest 135/135 / build PASS, migrate 58/58 drift 0, artifact integrity PASS=153 WARN=0 FAIL=0; Step 2.17B BLOCKED unchanged, 2.18 NOT STARTED, Phase 2 exit BLOCKED). Предшествующий (implementation — `docs/prompts/PHASE_2_STEP_2.17C_SALES_STRUCTURAL_DEBT_BEHAVIOR_PRESERVING_IMPLEMENTATION_REPORT.md`; design — `docs/prompts/PHASE_2_STEP_2.17C_SALES_STRUCTURAL_DEBT_DESIGN_AND_DECOMPOSITION_REPORT.md`; ownership reconciliation — `docs/prompts/TRAVELHUB_STEP_2.17C_SALES_STRUCTURAL_DEBT_OWNERSHIP_AND_STEP_2.9_STATUS_RECONCILIATION_REPORT.md`)\
Владелец структурного долга `backend/src/modules/sales/sales.service.ts` (на дату reconciliation: 2522 строки, 74 async-метода, 52 объявленных метода; совмещены Quote/Checkout/Sale lifecycle, pricing/freeze asserts, idempotency asserts, availability, list-query builders, validation — god-service debt). Цель: декомпозиция на когезивные internal-компоненты БЕЗ изменения внешне наблюдаемого поведения. **HARD INVARIANTS будущей реализации:** API behavior, HTTP contracts, RBAC, domain ownership, schema (если отдельно не обосновано), transaction atomicity, idempotency, outbox/inbox semantics, event names/payload contracts, causation/correlation, Quote/Checkout/Sale/Order freeze semantics, money calculations, Commission/Payment/Booking boundaries, error/status semantics, concurrency behavior — сохранение обязательно; поведенческое изменение — только отдельный approved bugfix/architecture decision, не инцидентный побочный результат. Перед реализацией ОБЯЗАТЕЛЕН repository-first decomposition/design pass (методы, call-graph, transaction boundaries, Prisma writes, cross-domain reads/writes, events, idempotency, concurrency-sensitive sections, frozen snapshot propagation, circular deps, test coverage). Линия-метрика НЕ критерий завершённости: success = explicit owners, понятная dependency direction, нет дублирования domain authority, нет circular graph, нет hidden cross-domain writer, транзакции корректны, tests доказывают behavior preservation, event/idempotency/concurrency contracts целы. Regression при будущей реализации: Sales unit, Quote/Checkout/Sale/Order e2e, event/outbox/inbox, idempotency, concurrency, Booking/Payment/Commission boundary, full serial backend e2e, frontend при изменении public API, migrate/drift verification даже без migration. **Placement:** после 2.17 (platform hardening стабилизирует CI/event retry/multi-instance/security guardrails → затем крупный Sales refactor под усиленными автоматизированными защитами; Phase exit не оставляет known high-risk structural debt unowned); НЕ зависит от PSP selection. Отделен от 2.17A (Backup/DR) и 2.17B (Load/Perf) — не переносить между ними. **НЕ сложен в Step 2.17** (см. отчёт §5 rationale).

· **Step 2.18 --- Phase 2 Exit Audit** 🚧 BOUNDED FINAL AUDIT COMPLETED — ALL EXECUTABLE GATES PASS — FINAL APPROVAL BLOCKED BY STEP 2.17B (2026-08-18; reconciliation — `docs/prompts/PHASE_2_POST_2.18A_EXIT_GATE_RECONCILIATION_REPORT.md`; VERDICT B — BOUNDED AUDIT MAY PROCEED; 12 exit gates inventoried: 6 APPROVED/reusable, 5 executable now (ADR-0014 verification, security source reinspection, fresh regression, drift, CI, frontend, artifacts), 1 blocked externally (2.17B); 2.18A Financial Integrity now APPROVED → audit may execute all non-blocked gates; 2.18 cannot reach APPROVAL/completion until 2.17B resolves; ADR-0014 tenant-isolation verification executable now; Phase 2 exit BLOCKED on 2.17B; NEXT = STEP 2.18 — PHASE 2 EXIT AUDIT — BOUNDED FINAL AUDIT).\
Сверка с Master/Baseline и DoD.
**RECONCILIATION 2026-08-15:** включает verification application-isolation / RLS-deferral решения (ADR-0014) и завершённость независимых gates Step 2.17A / Step 2.17B.

· **Step 2.18A --- Financial Integrity Exit Gate** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-18; strict review — `docs/prompts/PHASE_2_STEP_2.18A_FINANCIAL_INTEGRITY_EXIT_GATE_STRICT_REVIEW_REPORT.md`; implementation — `docs/prompts/PHASE_2_STEP_2.18A_FINANCIAL_INTEGRITY_EXIT_GATE_IMPLEMENTATION_REPORT.md`; architecture — `docs/architecture/financial-integrity-exit-gate-2.18A.md`; VERDICT A — APPROVED; 0 CRITICAL/HIGH findings, 0 review fixes; independent adversarial verification: sole-writer invariants verified (Payment/Commission/Accrual/Ledger), no JS float contamination, no frozen-fact regeneration, checker read-only, DB constraints verified; regression: backend tsc 0 / build PASS / unit 816/816 / full serial e2e 69 suites 1248/1248, frontend tsc 0 / vitest 135/135 / build PASS, migrate 58/58 drift 0, artifact integrity PASS=162 WARN=0 FAIL=0; Step 2.17B BLOCKED unchanged, Phase 2 exit BLOCKED).\
Monetary precision, webhook replay, duplicate capture/refund, ledger
balance, settlement reconciliation, temporal integrity.

------------------------------------------------------------------------

# PHASE 3 --- COMPLETE PLATFORM

## Управление и аналитика

· **Step 3.0 --- Phase 3 Entry Audit** ✅ COMPLETE (2026-08-19; Phase 3 Entry Reconciliation — VERDICT A — canonical Phase 3 exists with 50+ steps; Phase 2 formal exit BLOCKED on 2.17B but independent Phase 3 work may begin; steps 3.0–3.41, 3.43–3.47 independent of 2.17B; only production/perf steps 3.42, 3.48–3.49 depend on qualification env; report — `docs/prompts/PHASE_3_ENTRY_AND_CANONICAL_ROADMAP_RECONCILIATION_REPORT.md`; Post-Phase-3 Roadmap Reconciliation — report `docs/prompts/POST_PHASE_3_CANONICAL_ROADMAP_RECONCILIATION_AND_NEXT_STAGE_REPORT.md`).

· **Step 3.1 --- Dashboard / Command Center Backend** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-19; aggregated KPI/read models без владения operational entities; Command Center + Trends endpoints; 21 KPI across executive/operational/financial/marketplace sections; RBAC analytics.read; e2e dashboard-command-center 9/9; unit 921/921; frontend 150/150; backend tsc/build PASS; migrate 59/59 drift 0; отчёт — `docs/prompts/PHASE_3_STEP_3.1_DASHBOARD_COMMAND_CENTER_BACKEND_STRICT_REVIEW_REPORT.md`; NEXT = REPOSITORY-FIRST PHASE 3 SEQUENCING AFTER STEP 3.1 APPROVAL).
Aggregated KPI/read models без владения operational entities.

· **Step 3.2 --- Dashboard UI** ✅ IMPLEMENTATION COMPLETED — 8-SECTION MODEL DEPLOYED (2026-08-24; Stage A server-side section authority + RBAC + granular section permissions + V3 8-section model + storefront revenue + i18n + CI stabilization — 6 remediation rounds; Decision Intelligence stages A–B.2 built on top; отчёт — `docs/prompts/PHASE_3_STEP_3.2_STAGE_A_SERVER_SIDE_SECTION_AUTHORITY_IMPLEMENTATION_REPORT.md`, `docs/prompts/PHASE_3_STEP_3.2_STAGE_B_PLATFORM_COMMAND_CENTER_UI_IMPLEMENTATION_REPORT.md`; runtime evidence — 7×₼, 0×$; NEXT = Decision Intelligence Stage C).\
KPI, alerts, queues, shortcuts, AI insights.

## Decision Intelligence — Command Center

· **Stage A --- RBAC Remediation** ✅ VERDICT A — COMPLETE (2026-08-24; 8 granular section permissions: `dashboard.executive.read`, `dashboard.operational.read`, `dashboard.financial.read`, `dashboard.marketplace.read`, `dashboard.catalog.read`, `dashboard.channels.read`, `dashboard.attention.read`, `dashboard.insights.read`; migration + e2e; отчёт — `docs/prompts/PHASE_3_COMMAND_CENTER_DECISION_INTELLIGENCE_STAGE_A_RBAC_REMEDIATION_REPORT.md`; commits `1cbb9e3` (report), `13aa5ea` (code)).

· **Stage B --- Decision Signal Foundation** ✅ VERDICT A — COMPLETE (2026-08-24; `DecisionSignal` entity with lifecycle, dedup, RBAC-aware list/get; `PendingBookingsDetector`; `decision-signals` API; отчёт — `docs/prompts/PHASE_3_COMMAND_CENTER_DECISION_INTELLIGENCE_STAGE_B_DECISION_SIGNAL_FOUNDATION_REPORT.md`; commit `1ce1eb4`).

· **Stage B.1 --- Business Model & Financial Metrics Authority Reconciliation** ✅ FULLY CLOSED (3 sub-stages: B.1 Original → VERDICT B; B.1 Remediation → VERDICT A; B.1 Policy Closure — Refund Commission Reversal → VERDICT A; authoritative decisions: ADR-PLATFORM-BUSINESS-PERSPECTIVE-SEPARATION §1–§17; reports — `docs/prompts/PHASE_3_STAGE_B1_BUSINESS_MODEL_FINANCIAL_METRICS_AUTHORITY_RECONCILIATION_REPORT.md`, `docs/prompts/PHASE_3_STAGE_B1_REMEDIATION_REPORT.md`, `docs/prompts/PHASE_3_STAGE_B1_POLICY_CLOSURE_REFUND_COMMISSION_REVERSAL_REPORT.md`).

· **Stage B.2 --- Executive Financial KPI Semantic Hotfix** ✅ FULLY CLOSED (2 sub-stages: B.2 Initial → VERDICT A reported → runtime acceptance FAILED; B.2 Remediation — Runtime AZN Currency Authority Closure → VERDICT A; runtime evidence — 7×₼, 0×$; reports — `docs/prompts/PHASE_3_STAGE_B2_EXECUTIVE_FINANCIAL_KPI_SEMANTIC_HOTFIX_REPORT.md`, `docs/prompts/PHASE_3_STAGE_B2_REMEDIATION_RUNTIME_AZN_CURRENCY_AUTHORITY_CLOSURE_REPORT.md`).

· **Stage C --- Needs Attention → Decision Queue** ✅ VERDICT A — COMPLETE (2026-08-24; 6 detectors (PendingBookings, FailedPayments, RecentCancellations, PendingRefunds, UpcomingBookings, ServicesWithoutSales); DecisionQueue UI with lifecycle actions (acknowledge/resolve/dismiss); Active/History filter tabs; human-readable signal titles (RU/AZ/EN); structured evidence display; multi-status API filter; RBAC server-side; 7×₼, 0×$ runtime evidence; tests 50 backend + 213 frontend; report — `docs/prompts/PHASE_3_STAGE_C_NEEDS_ATTENTION_DECISION_QUEUE_IMPLEMENTATION_REPORT.md`).

· **Stage D --- WHY Attribution (Deterministic)** ✅ COMPLETE (deterministic, evidence-based WHY attribution from structured domain facts; 6 signal types; 4 WHY statuses; report — `docs/prompts/PHASE_3_STAGE_D_WHY_ATTRIBUTION_DETERMINISTIC_IMPLEMENTATION_REPORT.md`; commit — see Phase 3 closure `0858147`).

· **Stage E --- Impact Scoring** ✅ COMPLETE (evidence-based impact scoring; 4 statuses: PROVEN / PARTIALLY_PROVEN / INFORMATIONAL / INSUFFICIENT_EVIDENCE; 0 fabricated pseudo-economics; report — `docs/prompts/PHASE_3_STAGE_E_IMPACT_SCORING_EVIDENCE_BASED_IMPLEMENTATION_REPORT.md`; commit — see Phase 3 closure `0858147`).

· **Stage F --- Action Routing** ✅ COMPLETE (NAVIGATION_ONLY boundary enforced; 6 signals → 6 destinations; RBAC-aware action routing; no lifecycle mutation from navigation; report — `docs/prompts/PHASE_3_STAGE_F_ACTION_ROUTING_NAVIGATION_ONLY_IMPLEMENTATION_REPORT.md`; commit — see Phase 3 closure `0858147`).

· **Stage G --- AI Decision Feed Reconciliation** ✅ COMPLETE (Category B informational insights; separate from DecisionSignal authority; no executable actions; no fabricated financial uplift; RU/AZ/EN localized; report — `docs/prompts/PHASE_3_STAGE_G_AI_DECISION_FEED_RECONCILIATION_IMPLEMENTATION_REPORT.md`; commit — see Phase 3 closure `0858147`).

· **Stage H --- Executive/Operational/Financial Decision Enrichment** ✅ COMPLETE (financial enrichment of Decision Signals; widget registry reconciliation; Post-H reconciliation COMPLETE; report — `docs/prompts/PHASE_3_POST_STAGE_H_COMMAND_CENTER_WIDGET_REGISTRY_MARKETPLACE_ENRICHMENT_RECONCILIATION_REPORT.md`; commit `caed3c9`).

· **Stage I --- Storefront Revenue Semantic Fix** ✅ COMPLETE (MRR/ARR/Collected/Outstanding from SubscriptionContract/SubscriponInvoice/SubscriptionPayment; List ≠ Contract enforced; Post-I V2 Widget Registry Reconciliation COMPLETE; report — `docs/prompts/PHASE_3_STAGE_I_STOREFRONT_REVENUE_SEMANTIC_FIX_IMPLEMENTATION_REPORT.md`; commit `59228eb`).

· **Stage J --- Regression / Security / Evidence Closure** ✅ VERDICT A — COMPLETE (final trust gate for Phase 3; 161/161 backend + 81/81 frontend + TSC clean; financial semantic dictionary frozen; RBAC/tenant isolation verified; localization RU/AZ/EN clean; 1 P2 accepted — Channel Health priceUsd deferred; report — `docs/prompts/PHASE_3_STAGE_J_FINAL_REGRESSION_SECURITY_EVIDENCE_CLOSURE_REPORT.md`; commit `0858147`; **Phase 3 Command Center C→J CLOSED**).

· **Step 3.3 --- Analytics Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-19; period/comparison/granularity resolvers, Company KPI/Partner Performance/Conversion Funnel/Time Series read models, AnalyticsController with RBAC; unit 853/853, frontend 135/135, migrate 58/58, artifact PASS=163; FINAL STRICT RE-REVIEW APPROVED — 0 defects; отчёт — `docs/prompts/PHASE_3_STEP_3.3_ANALYTICS_FOUNDATION_FINAL_STRICT_RE_REVIEW_REPORT.md`; NEXT = REPOSITORY-FIRST PHASE 3 SEQUENCING AFTER STEP 3.3 APPROVAL).
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

· **Step 3.3E --- Global Workspace Constructor Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-19; architecture addendum commit `26e1d9c`; canonical Page Registry (6 pages) + Widget Registry (29 widgets); Effective Layout Resolver (System Default → Role Default → User Override); `UserWorkspaceLayout` persistence (Prisma JSON, unique (userId, pageId), migration 20260819121404); 4 API endpoints (GET layout, GET widgets, PUT save, DELETE reset); RBAC filtering, required widget restoration, config sanitization, versioning; frontend foundation (workspace-api.ts, use-workspace.ts hooks); backend unit 35 workspace tests + 921/921 total; frontend vitest 150/150; backend tsc/build PASS; frontend tsc/build PASS; migrate 59/59 drift 0; отчёт — `docs/prompts/PHASE_3_GLOBAL_WORKSPACE_CONSTRUCTOR_FOUNDATION_IMPLEMENTATION_REPORT.md`; NEXT = GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION — STRICT REVIEW).
Общий backend/frontend foundation для кастомизации layout страниц (Command Center, Analytics, CRM, Orders, Bookings, Catalog). Page-agnostic, widget-registry driven. Не реализует полноценный Dashboard UI (Step 3.2 станет первым visual consumer).

· **Step 3.4 --- Analytics Center UI**\
Sales, Orders, Bookings, Finance, Products, Partners,
Marketplace/Storefront performance.

· **Step 3.4A --- Time-Based Analytics**\
По часу/дню/неделе/месяцу/сезону; lead time, confirmation time,
processing time, payout delay; Product publication, Order creation,
Booking request/confirm, Payment capture, Refund, Settlement/Payout.

## CRM

· **Step 3.5 --- CRM Completion** ✅ COMPLETE (2026-08-25; CRM workspace with Customers/Partners tabs; PartnerCustomerRelation schema (Step 3.5B); Partner list/detail endpoints; Customer detail with orders/bookings/payments aggregation; full i18n RU/AZ/EN; backend 1042/1042 + frontend 72/72 tests; migration 20260824214302; report — `docs/prompts/PHASE_3_STEP_3_5_CRM_COMPLETION_REPORT.md`; commit `17f66cd`).\
Customer `CUS-*`, Contact `CNT-*`, Company `COM-*`, Partner `PAR-*`,
Supplier `SUP-*`.

· **Step 3.5 --- Shared Table Controls** ✅ FINAL CLOSED (2026-08-26; project-wide shared table sorting + filtering + URL state + structural parity; SortableHeader wired to all tables; server-authoritative single-column sorting; complete filter coverage across all entity lists; Bookings search + 360 authority closure; 243 frontend tests; report — `docs/prompts/PHASE_3_SHARED_TABLE_CONTROLS_ROUND_2C_FINAL_URL_STATE_BOOKINGS_SEARCH_360_AUTHORITY_CLOSURE_REPORT.md`; commit `ec2e65c`).

· **Step 3.5 --- Operational Notes** ✅ FULLY CLOSED (2026-08-26; internal CRM notes on all 11 entity types; data model + migration + backend authority; Notes API with RBAC + audit + edit/delete lifecycle; Customer 360 / Partner 360 Notes UI; create-form initial note integration with atomic entity-note transactions; Payment/Refund create-flow coverage closure; 99 backend unit tests + 243 frontend tests; reports — `docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_OPERATIONAL_NOTES_ROUND_2D.1_MISSING_CREATE_FLOW_COVERAGE_CLOSURE_REPORT.md`; commit chain `e0fe7bb→a13e280→8b9999f→64c6563→88af625→b6b0365`).

· **Step 3.5.3 --- CRM Communications + Activity Timeline**

  · Round 1 — Architecture + Current-State + Data-Source + RBAC / Tenant Authority Reconciliation ✅ CLOSED (2026-08-27; denormalized CrmActivity read model selected; 10 source types; ~20 activity types; cursor pagination; two-level RBAC; report — `docs/prompts/PHASE_3_STEP_3.5.3_CRM_COMMUNICATIONS_ACTIVITY_TIMELINE_ARCHITECTURE_RECONCILIATION_REPORT.md`; commit `2b0438a`).

  · Round 2A — Activity Read Model + Data Model + Migration + Source Adapters + Backfill/Rebuild Foundation ✅ CLOSED (2026-08-27; CrmActivity schema with 3 enums; unique dedup constraint + 4 query indexes; 10 source adapters; idempotent projector; cursor pagination foundation; backfill/rebuild service; 36 unit tests; report — `docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2A_READ_MODEL_MIGRATION_SOURCE_ADAPTERS_BACKFILL_FOUNDATION_REPORT.md`; commit `227c9e6`).

  · Round 2B — Activity API + RBAC + Cursor Pagination + Server-Side Filtering + Subject Authority ✅ CLOSED (2026-08-27; Customer/Partner Activity API endpoints; two-level RBAC (crm.activity.read page gate + 10 source-specific item gates); cursor pagination (occurredAt DESC, id DESC); server-side filters (sourceType, activityType, dateFrom, dateTo); subject authority; safe DTO projection; 49 controller tests; 85 CrmActivity tests total; report — `docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2B_API_RBAC_CURSOR_FILTERING_SUBJECT_AUTHORITY_REPORT.md`; commit `b13f06d`).

  · Round 2C — Customer 360 Activity UI + Existing History Migration/Replacement + i18n + Live Projection ✅ CLOSED (2026-08-27; CustomerActivity.tsx + PartnerActivity.tsx; source/date filters; cursor pagination UI; deep links; RU/AZ/EN i18n; History tab removed; live projection; backfill hardening; reports — multiple; commits through `2ac80b6`).

  · Round 2C.2R — Payment Customer Ownership Remediation ✅ CLOSED (2026-08-27; canonical Payment ownership: source.customerId → order.customerId chain; 816/816 Activities with customerId; null customerId: 0; report — `PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2C_2R_PAYMENT_CUSTOMER_OWNERSHIP_AUTHORITY_REMEDIATION.md`; commit `990e599`).

  · Round 2D — Partner 360 Activity UI + Communications / Deep Links ✅ CLOSED (2026-08-27; PartnerActivity.tsx; 1964 items Baku Tours Pro; subject authority; i18n RU/AZ/EN; report — `PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2D_PARTNER_360_ACTIVITY_UI.md`; commit `2ac80b6`).

  · Round 2E — Runtime + Security + Backfill/Rebuild Closure ✅ CLOSED (2026-08-28; VERDICT A — end-to-end runtime + subject security + RBAC + rebuild safety + data consistency fully qualified; 0 production code changes; Customer 40 items, Partner 1964 items; rebuild 4257→3416 projected, 0 errors; concurrency 403 lock; idempotent; cross-subject leakage = 0; report — `PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2E_RUNTIME_SECURITY_BACKFILL_REBUILD_CLOSURE_REPORT.md`).

  · Round 2E.1 — Final Test Fixture + Live Projection Evidence Closure ✅ CLOSED (2026-08-28; VERDICT A — 2 stale Source Adapter fixtures reconciled (OrderAdapter + BookingAdapter: added `sellerPartnerId` to match canonical authority); 1236 PASS / 0 FAIL; deterministic live projection proved (Operational Note → Activity without rebuild); cross-subject leakage = 0; RBAC 401/401/200; Customer Payment + Partner Activity regression PASS; report — `PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2E_1_FINAL_TEST_FIXTURE_LIVE_PROJECTION_EVIDENCE_CLOSURE_REPORT.md`).

  · Round 2E.2R — Filter + I18N + Related-Entity Display Integrity Remediation ✅ SUPERSEDED (2026-08-28; initially VERDICT A at bdd8e62; post-report browser validation found unresolved selected-record UUID leakage in Order/Booking detail views; superseded by Round 2E.2R.1; filter/i18n fixes preserved).

  · Round 2E.2R.1 — Selected-Record Related-Entity Resolution ✅ SUPERSEDED (2026-08-28; initially VERDICT A at 85511ec; backend dist was never rebuilt after code changes (dist from Aug 25, code from Aug 28); user browser runtime confirmed UUIDs still visible; superseded by Round 2E.2R.2).

  · Round 2E.2R.2 — CRM 360 Global Related-Entity Display Integrity Remediation ✅ VERIFIED (2026-08-28; implementation at a297932; root cause: backend dist stale; fix: rebuild + restart; Order/Booking/Product detail enriched; frontend uses display names).

  · Round 2E.2R.2A — Final Visual Runtime Evidence Closure ✅ CLOSED (2026-08-28; VERDICT A — evidence-only closure; backend rebuilt from current checkout; all 3 detail endpoints return display names; Customer 360 (8 tabs) + Partner 360 (8 tabs) audited; 0 UUID visible labels; table/detail parity PASS; deep links PASS; RU/AZ/EN PASS; 1236 PASS / 0 FAIL; 243 PASS / 0 FAIL; 0 production code changes; report — `PHASE_3_STEP_3.5.3_POST_CLOSURE_ROUND_2E_2R_2A_FINAL_VISUAL_RUNTIME_EVIDENCE_CLOSURE_REPORT.md`).

**Step 3.5.3 — CRM Communications + Activity Timeline — RE-CLOSED**

· **Step 3.5A --- Partner CRM Foundation** ✅ COMPLETE (2026-08-28; VERDICT A — foundation already exists in repository; Partner entity + PartnerCustomerRelation + CrmActivity + Operational Notes + RBAC + Partner 360 (8 tabs) + server-side filters/pagination/sorting + i18n RU/AZ/EN + human-readable display names; 0 production code changes; 0 schema/migration; 1236 PASS / 0 FAIL; 243 PASS / 0 FAIL; report — `PHASE_3_STEP_3.5A_PARTNER_CRM_FOUNDATION_IMPLEMENTATION_REPORT.md`; commit `27b2653`).\
Paid Storefront получает отдельный Partner-scoped CRM, не внутренний
`/app/crm`. Возможности: customers, leads, notes, tags,
lifecycle/stages, tasks/reminders, communication history, permitted
documents, repeat-customer history, segmentation, assigned manager/team,
acquisition source, CRM analytics. Marketplace-only Partner получает
только необходимые Marketplace operational customer/order/booking views
согласно entitlement/policy.

· **Step 3.5B --- Customer Identity ↔ Partner CRM Relationship** ✅ COMPLETE (2026-08-28; VERDICT A — canonical identity/relationship architecture already exists; PartnerCustomerRelation with @@unique([partnerId, customerId]); lifecycle/tags/source/manager Partner-scoped; User↔Customer mapping documented; multi-partner isolation proven; 0 production code changes; 0 schema/migration; 1236 PASS / 0 FAIL; 243 PASS / 0 FAIL; report — `PHASE_3_STEP_3.5B_CUSTOMER_IDENTITY_PARTNER_CRM_RELATIONSHIP_IMPLEMENTATION_REPORT.md`; commit `737de35`).\
Глобальная TravelHub Customer identity и Partner-specific CRM
relationship --- разные сущности/понятия. Ввести
`PartnerCustomerRelationship` или архитектурный эквивалент. Один
Customer может иметь отношения с несколькими Partner. Partner-specific
notes/tags/lifecycle/lead status/manager/tasks/source/history не
являются глобальными Customer fields. Strict tenant/object isolation:
Partner A не видит Partner B relationship data.

· **Step 3.5C --- Partner CRM Lead & Direct Customer Intake** ✅ COMPLETE (2026-08-28; VERDICT A — canonical intake flow implemented; intakePartnerCustomer PCR reuse (ConflictError removed); Platform CRM admin intake POST /partners/:id/intake; identity resolution by email; Customer reuse + PCR ensure; scenarios A-E verified; 11 intake tests; 1247/1247 backend + 243/243 frontend PASS; i18n RU/AZ/EN; report — `PHASE_3_STEP_3.5C_PARTNER_CRM_LEAD_DIRECT_CUSTOMER_INTAKE_IMPLEMENTATION_REPORT.md`; commit TBD).\
Storefront/phone/office/manual/direct lead intake; возможность Partner
создавать CRM lead/customer relationship без создания дубликата
глобальной identity. Source: Direct/Phone/Office/Email/Marketplace/Referral/Other.
Platform CRM admin intake (POST /partners/:id/intake) + Partner-context intake
(POST /partner/customers/intake). Deterministic identity by email. PCR reuse.

· **Step 3.5D --- Partner CRM Entitlement & Capability Model** \
NEW CANONICAL NEXT — CRM capabilities зависят от Storefront SaaS plan/entitlement. Не
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

· **Step 3.29D --- Storefront SaaS Plans / Entitlements** ✅ COMPLETE — STOREFRONT SUBSCRIPTION BILLING FOUNDATION (2026-08-25; SubscriptionContract / SubscriptionInvoice / SubscriptionPayment models; AZN billing; List Price ≠ Contracted Price enforced; host-count pricing; invoice idempotency; overpayment rejection; currency mismatch rejection; trial→paid deterministic conversion; 8 contracts seeded; MRR/ARR/Collected/Outstanding computed from billing authority; 15/15 billing unit tests; report — `docs/prompts/PHASE_3_STEP_3_29D_STOREFRONT_SUBSCRIPTION_BILLING_FOUNDATION_IMPLEMENTATION_REPORT.md`; commit `9d659ef`).\
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

· **Step 3.29I --- Partner Commercial Calendar / Bulk Management UI** ⏳ NOT IMPLEMENTED (Roadmap Amendment: Service Templates / Period Pricing & Availability, post-baseline addition; **Universal Pricing Model Amendment INTEGRATED — UX-контракт annual calendar, см. `docs/architecture/universal-pricing-model.md` §14**)\
Calendar/period view; bulk price editing; bulk availability editing;
stop sell; create/copy periods (copy season/year где безопасно);
import/mapping UX; исходное Seller-
название + нормализованные атрибуты; full period availability.
**Universal Pricing UX-контракт:** Seller workflow Product → ServiceUnit →
Rate Plan → pricing method → basis/currency → base/period → seasonal →
holiday/date overrides → day-of-week/PAX/duration/tier conditions →
overlap-validation → calendar preview resolved price → availability отдельно
→ publish; annual calendar (year/month), bulk price entry, copy period/season,
weekday/weekend rules, occupancy/PAX matrix где категория позволяет,
preview resolved price, validation errors до publish; import (CSV/XLS/supplier/
API/channel manager) → тот же canonical Rate Plan + CommercialPeriod model
(никакого «Excel pricing engine»).
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

## Booking Commercial Terms & Agreement Foundation (Phase 3 Additive Reconciliation)

**Статус: PLANNED — NOT STARTED**
**Дата записи:** 2026-08-25
**Тип:** Future capability — documentation reconciliation (НЕ production implementation)
**Архитектурный документ:** `docs/architecture/booking-commercial-terms-agreement-versioning-audit.md`
**Prompt:** `docs/prompts/PHASE_3_BOOKING_COMMERCIAL_TERMS_AGREEMENT_ARCHITECTURE_ROADMAP_RECONCILIATION.md`

Данный capability фиксирует новые согласованные бизнес-требования TravelHub,
которые необходимо реализовать в будущих implementation steps. Domain ownership
распределяется между Catalog, Order, Booking, Finance и Agreement/Document.
CRM остаётся read-only consumer.

· **Step F.1 --- Service Commercial Policy Model** ⏳ PLANNED
Supplier определяет коммерческие условия при публикации услуги: payment
timing policy (PAY_AFTER_CONFIRMATION, PAY_IMMEDIATELY), full/partial payment
options, deposit/installment amounts, payment deadlines, grace period,
missed-payment policy (AUTO_CANCEL_AFTER_GRACE, MANUAL_REVIEW,
PLATFORM_APPROVED), cancellation policy, refund policy. TravelHub валидирует
system boundaries, но не изобретает supplier deadlines.
Зависимости: Service lifecycle (1.8A–1.8D).

· **Step F.2 --- Service Terms Versioning** ⏳ PLANNED
Service commercial terms версионируются. Перезапись текущих terms без
сохранения предыдущего состояния запрещена. Versioned fields: price, currency,
payment policy, installment schedule template, deadlines, grace period,
missed-payment, cancellation, refund, availability terms.
Invariant: supplier changes Service after customer booking ≠ existing
Booking terms change.
Зависимости: F.1, Product.version (существует).

· **Step F.3 --- Payment Schedule Templates** ⏳ PLANNED
Supplier определяет templates: deposit amount/%, deadline for deposit,
remaining balance, final payment deadline (conceptually N hours/days before
service start; invariant: final deadline < service start), intermediate
installments (optional), grace period, missed-payment policy.
System constraints: min/max deadlines, allowed units, validation against
service start time.
Зависимости: F.1.

· **Step F.4 --- Customer Payment Option Selection** ⏳ PLANNED
При booking flow клиент выбирает из разрешённых supplier вариантов:
full payment или partial payment по опубликованному графику. Selection
становится частью immutable commercial snapshot.
Зависимости: F.1, F.3.

· **Step F.5 --- Booking Commercial Snapshot** ⏳ PLANNED
При бронировании создаётся immutable snapshot (BookingCommercialTermsSnapshot):
serviceId, serviceVersion, supplierId, customer/order/booking ref, price,
currency, quantity/participants, selected payment option, payment schedule,
deadlines, grace period, missed-payment policy, cancellation policy,
refund policy, other material terms, createdAt.
Invariant: downstream Service edits НЕ мутируют frozen snapshot.
Зависимости: F.2, F.4.

· **Step F.6 --- Installment Schedule Instantiation** ⏳ PLANNED
При partial payment создаётся concrete Payment Plan:
total amount → installment 1 (amount, due rule/dueAt, status) →
installment 2… → final dueAt. Changes to Service payment policy после
booking НЕ изменяют instantiated plan.
Зависимости: F.5, Finance (2.12 Payment exists).

· **Step F.7 --- Customer Acceptance** ⏳ PLANNED
Перед final booking submission клиент явно подтверждает terms:
acceptedAt, acceptedTermsVersion, acceptedDocumentId, acceptedDocumentHash,
customer identity/reference. Additional metadata — privacy/legal policy dependent.
Зависимости: F.5.

· **Step F.8 --- Supplier Confirmation Separation** ⏳ PLANNED
Различать Supplier published service terms и Supplier confirmed concrete
booking — разные юридические/операционные события. Two-stage document flow
dля PAY_AFTER_CONFIRMATION: (1) Booking Request Terms (customer accepted at
submission), (2) Confirmed Booking Agreement (supplier confirmed →
paymentDeadlineAt finalized). Второй документ НЕ изменяет условия первого.
Зависимости: F.5, Booking lifecycle (2.9 exists).

· **Step F.9 --- Agreement Generation & Versioning** ⏳ PLANNED
При бронировании формируется immutable agreement document
(BookingTermsAgreement): agreement/document ID, Order/Booking/Service IDs,
service version, Supplier, Customer, service date/time, price, currency,
quantity, selected payment policy, schedule, deadlines, grace period,
missed-payment consequences, cancellation/refund policies, supplier
confirmation terms, document version, createdAt, language.
Same canonical version для Customer + Supplier + TravelHub audit.
Document hash (content hash) для immutability proof.
Доставка: Customer account, Supplier workspace, email/notification,
downloadable document.
Зависимости: F.7, F.8, Document delivery capability.

· **Step F.10 --- Amendments** ⏳ PLANNED
После бронирования: DO NOT overwrite original agreement. Создать
Amendment (или новую agreement version) linked to previous.
Хранить: previousVersion, newVersion, reason, changed terms,
accepted/confirmed by parties, timestamps.
Зависимости: F.9.

· **Step F.11 --- Audit Trail Extension** ⏳ PLANNED
Расширить audit trail: Service terms changed, Service version published,
Booking request created, Terms accepted by customer, Supplier confirmed/rejected,
Payment schedule instantiated, Payment received/overdue, Booking
expired/cancelled, Refund events, Supplier settlement events, Agreement
generated/delivered, Amendment created/accepted.
Зависимости: F.1–F.10, Events infrastructure (1.15A exists).

· **Step F.12 --- CRM Consumption** ⏳ PLANNED
CRM отображает агрегированные состояния: Order status, Booking status,
Supplier confirmation, Customer payment status, amount paid/outstanding,
next payment deadline, overdue state, Supplier settlement, Service terms
version, Agreement status/link, Customer acceptance, Supplier confirmation
timestamp. CRM НЕ становится authority этих данных.
Зависимости: F.1–F.11, CRM Step 3.5 exists.

· **Step F.13 --- Operational / Command Center Integration** ⏳ PLANNED
Future operational filters: Customer paid + supplier not confirmed,
Supplier confirmed + customer not paid, Partially paid, Payment deadline
approaching, Payment overdue, Completed service + supplier not paid,
Customer refunded + supplier already paid, Agreement not accepted,
Agreement amendment pending.
Future command center signals: Confirmed bookings awaiting customer payment,
Payment deadline approaching, Overdue installment, Paid booking awaiting
supplier confirmation, Completed service awaiting supplier settlement.
Каждый signal — evidence-based authority.
Зависимости: F.1–F.12, Decision Queue infrastructure (Stages A–J exist).

**Data Authority Map:**
- Service commercial terms → Catalog (Product/Tariff) — PARTIAL EXISTS
- Service versioning → Catalog (Product.version) — EXISTS
- Booking commercial snapshot → future (Booking) — NOT STARTED
- Customer payment → Finance (Payment exists, 2.12) — PARTIAL
- Supplier settlement → Finance (Settlement exists, 2.10B) — PARTIAL
- Agreement → future (Order/Booking) — NOT STARTED
- CRM → read-only consumer — EXISTS (Step 3.5)

**Domain ownership:**
- Catalog: service terms, versioning
- Order: order-level snapshot, acquisition propagation
- Booking: booking-level snapshot, service-time model
- Finance: Payment, Refund, Settlement, Payout, Commission
- Agreement/Document: agreement generation, versioning, hash, delivery
- Communication: notification delivery
- Partner workspace: service term editing UI
- Customer storefront: service card display, booking acceptance
- CRM: read-only consumer

**PSP relationship:** Actual collection, payment processing, refund
execution — deferred до canonical PSP selection (Step 2.12B BLOCKED).
Domain foundation может быть реализована частично до реального PSP.

**CRM relationship:** CRM Step 3.5 и последующие iterations должны
учитывать будущее отображение, но НЕ вводить локальный payment/contract
truth. CRM fields must consume canonical authorities.

**Deferred design decisions:** exact payment-policy enums, min/max
deadlines, number of installments, grace-period rules, legal acceptance
metadata, document format, signature requirements, amendment rules,
jurisdiction-specific wording, canonical base/list price for mixed
pricing.

**Implementation status:** NOT STARTED (PLANNED).
Production code НЕ изменён. Runtime НЕ реализован.

## Supplier Settlement, Balance & Payout Transparency Foundation (Phase 3 Additive Amendment)

**Статус: PLANNED — NOT STARTED**
**Дата записи:** 2026-08-25
**Тип:** Future capability — documentation-only reconciliation (НЕ production implementation)
**Архитектурный документ:** `docs/architecture/supplier-settlement-balance-payout-transparency-audit.md`
**Prompt:** `docs/prompts/PHASE_3_SUPPLIER_SETTLEMENT_BALANCE_PAYOUT_TRUST_ARCHITECTURE_RECONCILIATION.md`

Canonical invariant: Customer Payment Terms ≠ Supplier Settlement Terms ≠ Supplier Payout.
Two immutable snapshots per booking. Settlement policy versioned.
Customer installments do NOT automatically define supplier payouts.
Supplier Trust & Transparency Contract: no hidden balances, no unexplained holds.

· **Step S.1 --- Supplier Settlement Policy Model** ⏳ PLANNED
Supplier settlement policy: release conditions, commission rules, reserve rules,
payout cadence, refund/chargeback responsibility, adjustment rules.
Business-defined per partner contract/category/tier.
Зависимости: Finance (2.10B exists).

· **Step S.2 --- Settlement Policy Versioning** ⏳ PLANNED
Settlement policy versioned. Future policy changes do NOT rewrite historical bookings.
Snapshot at booking time.
Зависимости: S.1.

· **Step S.3 --- Booking Settlement Terms Snapshot** ⏳ PLANNED
Immutable snapshot (SupplierSettlementTermsSnapshot): bookingId, orderId, supplierId,
partnerAgreementVersion, settlementPolicyVersion, commission rule, entitlement rule,
release conditions, reserve rule, payout cadence, refund/chargeback responsibility,
currency, effectiveAt.
Зависимости: S.2, Booking Commercial Snapshot (F.5).

· **Step S.4 --- Supplier Entitlement Engine** ⏳ PLANNED
Gross → Commission → Refund/Chargeback adjustments → Net Entitlement.
Append-only ledger entries. Balance = projection from ledger.
Зависимости: S.3, Finance (2.12 Payment, 2.12E Commission).

· **Step S.5 --- Release Conditions / Milestones** ⏳ PLANNED
Configurable release conditions: supplier confirmed, customer paid, service milestone,
service completed, refund window passed, manual review, contract-specific.
Early release / working capital support.
Зависимости: S.4.

· **Step S.6 --- Reserve / Holdback** ⏳ PLANNED
Reserve/holdback: refund exposure, chargeback exposure, risk policy, contractual.
Every hold: amount, reason, source, releaseCondition, expectedReleaseAt, policy.
Зависимости: S.5.

· **Step S.7 --- Settlement Financial Ledger** ⏳ PLANNED
Append-only supplier financial ledger: accrual, commission, reserve, release,
adjustment, payout. Balance = projection. No manual balance mutations.
Зависимости: S.4, Ledger (2.10A exists).

· **Step S.8 --- Supplier Balance Projection** ⏳ PLANNED
Outstanding balance = Awaiting + Available + Reserve + Processing.
Multi-currency: native currency + canonical FX conversion.
Negative balance / receivable / future payout offset.
Зависимости: S.7.

· **Step S.9 --- Payout Eligibility** ⏳ PLANNED
Payout eligibility: release conditions satisfied, no active holds, eligible amount > 0.
Authoritative payout-eligibility computation from ledger.
Зависимости: S.5, S.7.

· **Step S.10 --- Payout Lifecycle** ⏳ PLANNED
Payout lifecycle: ELIGIBLE → INITIATED → PROCESSING → COMPLETED | FAILED.
Actual PSP execution deferred to PSP integration (2.12B).
Logical payout can be designed before real PSP.
Зависимости: S.9, PSP (2.12B — BLOCKED).

· **Step S.11 --- Adjustments / Negative Balance** ⏳ PLANNED
Refund/chargeback/commission corrections/authorized manual adjustments.
Negative balance: future payout offset. Historical payout immutable.
Зависимости: S.7, S.10.

· **Step S.12 --- Supplier Settlement Statement** ⏳ PLANNED
Period statement: opening balance, accruals, commissions, reserves, releases,
adjustments, payouts, closing balance. Generated from canonical ledger.
Export/download capability.
Зависимости: S.7, S.8.

· **Step S.13 --- Supplier Payout Forecast** ⏳ PLANNED
Forecast: available now, expected 7 days, 8–30 days, depends on conditions.
Unknown dates: show condition, not false precise date.
Зависимости: S.8, S.9.

· **Step S.14 --- Partner Finance Visibility** ⏳ PLANNED
Partner Finance center: balance, upcoming payouts, payout history, settlement ledger,
statements, adjustments, reserve, booking/order drill-down.
Supplier Trust & Transparency: no hidden balances, every hold explained.
Зависимости: S.8–S.13, Partner workspace.

· **Step S.15 --- Platform Settlement Monitoring** ⏳ PLANNED
Platform Command Center: Outstanding Supplier Balance, Available for Payout,
Awaiting Release, Reserve, Payout Processing, Accrued/Paid (flow).
Reconciliation: PIT components sum to Outstanding.
Зависимости: S.8, S.14.

· **Step S.16 --- Platform Payout Aging / Liquidity View** ⏳ PLANNED
Aging buckets: Today/1–3/4–7/8–30/>30/Overdue.
Liquidity: supplier liabilities, payable, upcoming, overdue.
Operational liquidity planning ≠ free cash.
Зависимости: S.15.

· **Step S.17 --- CRM / Order / Booking Read Models** ⏳ PLANNED
CRM summary: settlement status, available, paid, outstanding.
Order/Booking detail: customer payment + supplier settlement dual blocks.
CRM = consumer, NOT authority.
Зависимости: S.14, CRM Step 3.5.

· **Step S.18 --- Decision Signals** ⏳ PLANNED
Future signals: payout overdue, reserve high, payout failure, negative balance,
reconciliation mismatch, liquidity concentration.
Evidence-based authority.
Зависимости: S.15, Decision Queue infrastructure.

· **Step S.19 --- Security / Audit / Reconciliation Closure** ⏳ PLANNED
RBAC: PLATFORM Finance/Admin, PARTNER own-scope only.
No cross-partner visibility. No IDOR. No frontend-only financial authority.
Audit: all settlement events traceable. Reconciliation invariants proven.
Зависимости: S.1–S.18.

**Implementation status:** NOT STARTED (PLANNED).
Production code НЕ изменён. DB schema НЕ изменён. Runtime НЕ реализован.

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

· **Step 3.50 --- Workforce / Employee Performance Management --- CANONICAL ROADMAP ARCHITECTURE UPDATE (2026-08-28; roadmap/architecture definition — НЕ implementation; отчёт — `docs/prompts/WORKFORCE_EMPLOYEE_PERFORMANCE_MANAGEMENT_CANONICAL_ROADMAP_UPDATE_REPORT.md`):** Отдельный analytics/read-model layer для объективной оценки качества и эффективности подразделений и сотрудников по неделям, месяцам и произвольным периодам. Архитектурный принцип: Operational Events / Domain State → Employee/Department Attribution → Performance Metrics Engine → Period Aggregation → Performance Scorecards → Department/Employee Drill-down → Command Center / Analytics / Workforce UI. Не превращать в CrmActivity extension / простой Orders counter / leaderboard-only feature / часть Booking-Order entity / часть RBAC. CrmActivity может быть источником evidence, но не универсальным Performance datastore.

  **Business Scopes:** PLATFORM (TravelHub оценивает собственные подразделения/сотрудников: Booking Operations, Sales/Orders, Finance, CRM/Support, Moderation, Marketing, other internal departments) + PARTNER / STOREFRONT PRO — FUTURE (Storefront Pro сможет оценивать собственных сотрудников; PLATFORM performance != PARTNER performance; Partner A != Partner B; Marketplace Basic != automatic Full Workforce Performance; entitlement и RBAC — разные axes).

  **Organizational Hierarchy:** Workspace → Department → Team (future/optional) → Employee. Drill-down: Workspace → Department → Employee → Metric → Source records/events. Score должен быть объясним.

  **Periods:** TODAY, CURRENT_WEEK, PREVIOUS_WEEK, CURRENT_MONTH, PREVIOUS_MONTH, CUSTOM_RANGE. Weekly/monthly boundaries — по canonical workspace/business timezone. Для каждой KPI: current, previous comparable period, absolute delta, percentage delta, trend. Не сравнивать периоды разной длительности без нормализации.

  **Department Performance:** Dimensions: Productivity, Quality, SLA/Speed, Business Result, Reliability, Workload, Trend. KPI и веса зависят от department type. Одна universal formula запрещена. Department Score не вычислять простым average Employee Scores — учитывать department aggregate metrics, workload weighting, coverage, quality, SLA, outcomes.

  **Department-Specific Metrics:** Booking Operations (bookings assigned/processed/confirmed/cancelled/completed, confirmation/cancellation rate, average handling/confirmation time, SLA compliance, overdue, rework/errors, customer-impacting errors, GMV handled/influenced); Sales/Orders (orders assigned/processed/completed/cancelled, conversion, GMV, Revenue, AOV, handling time, SLA, refund/cancellation impact, quality/errors); Finance (payments processed, successful/problem payments handled, refunds processed, refund processing time, financial exceptions, SLA, error rate, reconciliation issues, handled amount); CRM/Support (customers/cases handled, response time, resolution time, SLA, reopened issues, escalations, follow-up, operational actions, quality/errors). Architecture должна поддерживать department-specific metric profiles (Moderation/Marketing). Конкретные формулы — отдельный design stage.

  **Employee Performance Score:** Explainable score 0–100. Conceptual dimensions: Productivity, Quality, SLA/Speed, Business Result, Reliability. Пример Booking Operator (design example): Productivity 25%, Quality 30%, SLA/Speed 20%, Business Result 15%, Reliability 10%. Requirements: formula role/department-specific, weights configurable/versioned, score explainable.

  **Anti-Gaming / Fairness:** Система не должна стимулировать гонку за количеством, искусственное закрытие объектов, отказ от сложных кейсов, переброс сложных задач, лишние Notes/messages, скорость в ущерб качеству. Учитывать volume + quality + SLA + business outcome + reliability + complexity where available. Количество обработанных заказов не может быть единственным критерием. Количество Notes/messages само по себе не является quality score.

  **Attribution — Critical:** Не использовать lastUpdatedBy = вся работа сотрудника / assignedTo = 100% credit. Один объект может обрабатываться несколькими сотрудниками. Предусмотреть event/action attribution: ORDER_CREATED → Employee A, ORDER_CONFIRMED → Employee B, PAYMENT_VERIFIED → Employee C, REFUND_APPROVED → Employee D, BOOKING_CONFIRMED → Employee E. Будущий attribution contract минимум для Order, Booking, Payment, Refund, CRM/Support, Operational Note, Moderation. Performance event должен уметь связывать: workspaceId, departmentId, employeeId, role/context, entityType/entityId, eventType/actionType, occurredAt, business value, quality outcome, SLA context, source/audit reference. Не добавлять поля/schema сейчас.

  **Assignment vs Action vs Outcome:** ASSIGNMENT — кто получил; ACTION — кто реально сделал; OUTCOME — чем закончился процесс. Пример: Employee B подтвердил Booking, который позже отменил Customer — cancellation нельзя автоматически считать ошибкой B.

  **Complexity / Workload (Future Normalization):** case complexity, workload, shift duration, part/full time, leave/absence, assignment volume, manual vs automatic, team handoff. 100 simple cases != 100 complex cases.

  **Explainability:** Employee detail: Performance Score 88.7, Productivity 92, Quality 84, SLA 91, Business Result 87, Reliability 89. С drill-down до конкретных Orders/Bookings/etc., если RBAC позволяет.

  **Weekly Scorecard:** Employee | Processed | Success | Avg Time | SLA | Quality | Score | Trend. Department weekly scorecard: overall score, volume, SLA, quality, business result, trend vs previous week.

  **Monthly Scorecard:** Аналогично current month vs previous month. Monthly score нельзя вычислять простой средней weekly scores — использовать canonical components/weighted aggregates.

  **History and Workload:** Weekly/monthly score history, department/employee/metric trend. Workload context: assigned, in progress, completed, overdue, average active workload, distribution by employee.

  **Formula Versioning:** Formula должна иметь version identity: BookingOperatorScore/v1, SalesManagerScore/v2, effectiveFrom/effectiveTo, calculation provenance. Исторические scores нельзя silently пересчитывать новой формулой.

  **Manual Overrides:** Если manual adjustment разрешён: original score, adjusted score, who/when/reason, before/after.

  **Snapshot Strategy:** На design stage выбрать: live/on-demand, period snapshots, hybrid. Weekly/monthly history должна быть immutable/traceable либо reproducible.

  **Data Quality:** Data completeness, unattributed events, unknown employee, missing department, invalid period, duplicate attribution. Различать 0 activity и insufficient/unavailable data.

  **Automation vs Employee:** SYSTEM, AUTOMATION, EMPLOYEE, PARTNER_EMPLOYEE. Автоматическое действие не засчитывать сотруднику без attribution rule.

  **Source Authority Matrix (Future Requirement):** | Domain | Volume | Quality | SLA | Outcome | Employee Attribution | Orders (required/required/required/required/required), Bookings (required/required/required/required/required), Payments (required/required/required/required/required), Refunds (required/required/required/required/required), CRM/Support (required/required/required/where applicable/required), Moderation (required/required/required/where applicable/required). Exact event list — design stage.

  **Timezone:** Weekly/monthly boundaries — по canonical workspace/business timezone, а не неявному server/browser time.

  **RBAC / Privacy (Future):** performance.read.self, performance.read.team, performance.read.department, performance.read.all, performance.manage, performance.configure. Performance data — sensitive internal data: server-side authorization, workspace isolation, department/team scope, audit trail, score configuration history, override audit. Frontend-hidden != security.

  **Command Center Integration:** Command Center получает high-level Team Performance summary + deep link. Разделять Business Analytics vs Workforce Performance Analytics. Не дублировать весь Performance Center в Command Center.

  **Analytics Integration:** Performance data интегрируется с существующим Analytics Foundation (Step 3.3) через read-model layer.

  **Future UI IA:** Employees / Workforce → Overview, Departments, Employees, Performance, Workload, Roles & Permissions. Performance Center: department selector, period selector, week/month comparison, overall score, metric cards, trends, department/employee tables, drill-down, filters. Не внедрять UI сейчас.

  **Dependencies:** Employees, Departments, Roles & Permissions, Orders, Bookings, Payments, Refunds, CRM, Audit/Event model, Analytics, Partner Workspace, Storefront Pro entitlements. Performance implementation должен идти после необходимых foundations.

  **Out of Scope (Now):** DB tables, APIs, score engine, attribution migrations, UI/navigation, permissions/entitlements, scheduled jobs, weekly/monthly workers, exports, notifications, AI scoring, salary/bonus logic, HR disciplinary workflows. AI не должен быть authority официального employee score — в будущем AI может только объяснять trends/anomalies.

  **Acceptance Direction:** Верификация department-specific metrics, event/action attribution, explainable versioned score, workload/fairness/timezone/data-quality/RBAC/privacy/override requirements, Command Center/Analytics integration, CrmActivity не превращён в Performance datastore, no implementation/schema/migrations started.

  **Статус: ROADMAP ARCHITECTURE UPDATE — NOT STARTED (implementation).**

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

## Universal Pricing Model (Roadmap Amendment — integrated 2026-08-11; детали — `docs/architecture/universal-pricing-model.md`)

-   **Commercial graph:** `Product → ServiceUnit → Tariff/Rate Plan → CommercialPeriod/Pricing Rule → resolved authoritative price`. Product НЕ финальный universal price authority при наличии ServiceUnits; ServiceUnit НЕ price row; Rate Plan — commercial offer/rules; period/rule — date/condition-sensitive price facts.
-   **Universal, НЕ Hotel-specific:** room/night/adult-child/vehicle — category rules через CategorySchema, не глобальные mandatory поля core.
-   **Pricing modes — first-class Seller workflows:** FIXED; **annual/seasonal calendar (REQUIRED first-class mode — commercial periods, не 365 дат вручную; applicable всем категориям)**; DATE_OVERRIDE (holidays/events, не требует правки base-сезона); DAY_OF_WEEK; OCCUPANCY/PAX; DURATION; TIER/VOLUME; package/inclusion (каждый Rate Plan — свои periods); advance-purchase/last-minute — extension point.
-   **Source ≠ method:** price source (MANUAL/IMPORT/API_SUPPLIER/CHANNEL_MANAGER/future) — ОТКУДА факт; pricing method/rule (FIXED/PERIOD/DATE_OVERRIDE/DAY_OF_WEEK/OCCUPANCY/DURATION_TIER/future LEAD_TIME/DYNAMIC) — КАК устроена цена. Не концентрировать. CSV/XLS — input method, НЕ pricing authority.
-   **Price basis** — Rate Plan-level commercial semantic (PER_UNIT/PER_ROOM/PER_PERSON/PER_NIGHT/PER_DAY/PER_HOUR/PER_TRIP/PER_SERVICE/PACKAGE_TOTAL; enum-имена финализируются 1.8B); quantity/basis arithmetic — explicit (unit amount, quantity, duration, total; без implicit arithmetic).
-   **Temporal:** `validFrom`/`validTo` — date-only inclusive (1.8C; UTC date-only midnight — модель `Availability.date`); **timezone authority НЕ существует до Step 2.8A** (у Product/ServiceUnit нет канонического commercial timezone; поле не выдумывается; 1.8C — UTC date-only); гейт Step 2.8A сохраняется (date-based может идти до 2.8A; time-slot/exact departure/timezone-aware — после 2.8A).
-   **Deterministic precedence (HARD):** 1) exact/specific DATE_OVERRIDE; 2) более специфичное условное override; 3) применимый seasonal/PERIOD; 4) DAY_OF_WEEK (как условие внутри периода, не глобальный ранг); 5) base/FIXED. Same-priority overlap, матчащий один context → 422 на write (никаких row-order/createdAt/frontend-order). Specificity — механическая, server-testable.
-   **Server resolver:** единый authoritative `resolvePrice(serviceUnit, ratePlan, serviceDate/range, occupancy/PAX, quantity, duration, currency)`; explainable (matched rule/period, basis, currency, unit price, quantity/duration, total, provenance, rule/period identity). Frontend не authoritative.
-   **No fabricated future price (HARD GATE):** нет авторитетной цены на даты → нет экстраполяции/stale-fallback/fake zero/авто-текущей цены; not instant-bindable. PRICE_ON_REQUEST — только intentional inquiry-based offer (не каждая missing price).
-   **Currency:** одна canonical валюта на Rate Plan (DD-029); смена валюты внутри периодов одного плана — не casually; multi-currency — отдельные Rate Plans. Display-конверсия ≠ binding price.
-   **Pricing ≠ Availability:** price row не несёт inventory counters; stop-sell ≠ удаление цены; multi-date stay — price per night + атомарные holds каждой ночи (DD-027, единый Step 2.4 engine).
-   **Quote/Checkout/Sale freeze:** Catalog pricing — authoritative до binding; после freeze — никакого reprice из правок календаря; Order не реконструирует историческую сумму. Future Quote snapshot: serviceUnit ref, Rate Plan ref, rule/period ref, basis, currency, unit price, quantity/duration, total, service date/range.
-   **Marketplace «from N»:** только server-side из authoritative eligible periods по документированной политике; после выбора дат — серверная резолюция + отдельная оценка availability (никакого frontend-пересчёта из скачанного календаря).
-   **Partner Cabinet workflow (3.29I):** Product → ServiceUnit → Rate Plan → method → basis/currency → base/period → seasonal → overrides → conditions → валидация overlap → preview → availability отдельно → publish; annual calendar UX (bulk/copy/override/stop-sell/preview); import UX → тот же canonical model (никакого «Excel pricing engine»).
-   **Future automation:** supplier/API pricing — trusted source → canonical future prices (provenance, idempotent reconcile, no spoofing, conflict policy, frozen snapshots); dynamic/RM — обязана резолвить authoritative Catalog price под тем же binding contract (никакого второго price authority); manual override supersedes automated в scope с provenance/audit.
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

**Currently active item (исторический снапшот на 2026-08-10; актуальная последовательность — раздел «Полная авторитетная последовательность после 2.5B» ниже):** Step 2.2C — STRICT REVIEW COMPLETED
(APPROVED WITH REVIEW FIXES; Matching & Distribution: reverse.
BuyerRequestDistribution, system matching command, Seller inbox,
strict containment coverage).

**Exact NEXT item (исторический снапшот на 2026-08-10):** `PHASE 2 — STEP 2.2D — SELLER PROPOSAL FOUNDATION`
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
16. **Service Templates return point (conditional)** ✅ DECISION GATES RESOLVED (2026-08-11; DD-024…DD-029 → DECIDED; решения — `docs/architecture/service-templates-decision-gates.md`; DDM и Roadmap 1.8A–1.8D синхронизированы; ADR НЕ требуется; Universal Pricing Model Amendment — отдельный pre-prepared prompt, исполняется как самостоятельный pass в рамках этого return point перед 1.8B/1.8C)
17. **Step 1.8A — Service Template / Seller Commercial Structure Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-11; ServiceUnit `UNI-*`, catalog.*; 26 e2e + 15 unit green; регрессия 770/770 e2e + 395 unit + 135 frontend)
18. **Step 1.8A — STRICT REVIEW** ✅ DONE (APPROVED WITH REVIEW FIXES)
18A. **Universal Pricing Model Amendment** ✅ IMPLEMENTATION/DOCUMENTATION COMPLETED — WAITING FOR STRICT REVIEW (2026-08-11; documentation-only: `docs/architecture/universal-pricing-model.md` интегрирован в Roadmap — invariants, pricing modes, annual/seasonal calendar first-class, source≠method, price basis, deterministic precedence, missing-price, currency, pricing≠availability, Quote freeze, Marketplace «from N», Partner Cabinet annual-calendar UX, import/API/dynamic extension points, cross-category applicability; контракты 1.8B/1.8C/1.8D/3.29I обновлены; код НЕ менялся)
18B. **Universal Pricing Model Amendment — STRICT REVIEW** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-11; FIXES: §28 timezone authority явно deferred до 2.8A (UTC date-only для 1.8C, поле НЕ выдумывается); §17/§31 DAY_OF_WEEK согласован как условие внутри периода с DD-026 §3.6 (единый механизм специфичности, без двух интерпретаций); §30 overlap — различены invalid ambiguous (422) vs valid specificity-resolved («Summer+ANY» vs «Summer+occupancy2»); §22 basis — одиночный тег + quantity/duration dimensions (без compound-строки); §35 PRICE_ON_REQUEST — Rate Plan-level (1.8B) vs period-level (1.8C) vs gap=missing-price; §41 multi-date — N-rows подтверждены решением DD-027 (не надморозка); §50 legacy `Tariff.price` transition заморожен (аддитивный 1.8B, base/FIXED fallback до 1.8C, без destructive migration); документация-only, код НЕ менялся)
19. **Step 1.8B — Tariff / Commercial Variant (Rate Plan) Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; Tariff = canonical Rate Plan; `serviceUnitId`/`priceBasis`/`refundability`/`pricingMode`/`status`/`inclusions`/`restrictions`/`TariffHistory`; permission `catalog.rate_plan.publish`; legacy `Tariff.price` frozen; §46 Quote gate; регрессия 807/807 e2e + 415 unit + 135 frontend + build + migrate drift 0)
20. **Step 1.8B — STRICT REVIEW** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; FIXES: §39 lost-update — version-CAS в update (parallel PATCH → 409, никакого last-write-wins); §52 delete-safety — TariffHistory ON DELETE RESTRICT + legacy tariffs-replacement гейт → 409 (история не стирается); §22 public POR — POR-план видим inquiry-only (price:null, pricingMode в DTO), исключён из priceFrom/sort (не over-hiding); §42 unit-eligibility — план на DRAFT/ARCHIVED unit публично скрыт; e2e +3 (31B/31C/32B) + unit +2)
21. **Step 1.8C — Period Pricing & Period Availability Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; `catalog.CommercialPeriod` CPR-* — tariffId, kind PERIOD/DATE_OVERRIDE, date-only UTC inclusive, dayOfWeek условие, price Decimal(12,2) наследует валюту Tariff, sellable stop-sell, ACTIVE/ARCHIVED, version-CAS, CommercialPeriodHistory RESTRICT; deterministic resolver DD-026 precedence DATE_OVERRIDE > narrower PERIOD > DAY_OF_WEEK > base (same-priority overlap → 422); bulk annual calendar atomic + advisory lock; Quote item `serviceDate` → period price резолвится pre-binding и замораживается; POR/ARCHIVED/stop-sell → 422; public priceFrom = min(base FIXED ∪ future sellable periods), UTC-consistent; регрессия 838/838 e2e + 430 unit + 135 frontend + build + migrate 40/40 drift 0; time-slot deferred до 2.8A; STRICT REVIEW FIXES: §44 freeze semantics — completeSale/setCheckoutServiceDate НЕ пере-резолвят текущий календарь (frozen Quote binding после ISSUE; Seller-edit не инвалидирует КП), §50 priceFrom SQL CURRENT_DATE→UTC (sort=display), §41 QuoteItem.serviceDate provenance snapshot, §23/§24 occupancy/PAX/duration/tier = 1.8D (не 1.8C); детали — `docs/architecture/period-pricing-foundation.md`)
22. **Step 1.8C — STRICT REVIEW** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; независимая проверка кода/миграции/runtime; FIX 1 §44 freeze — verifyCheckoutPeriodPrices удалён (binding = Quote ISSUE), FIX 2 §50 priceFrom SQL timezone UTC, FIX 3 §41 QuoteItem.serviceDate, FIX 4 docs minNights/productId/currency/Decimal overclaims исправлены; e2e #20-22 переписан (200 вместо 422); 1.8B test-evolution — легитимная (модель появилась в 1.8C), НЕ ослабление)
23. **Step 1.8D — Commercial Restrictions / Overrides Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; STRICT REVIEW FIXES: §42 range stop-sell, §44/§51 activate parent guard, §21 override-семантика, §18 default-all, priceFrom boundary; 859/859 e2e + 459 unit + 135 frontend + build + migrate 42/42 drift 0; детали — `docs/architecture/commercial-restrictions-overrides-foundation.md`)
24. **STEP 2.6 — REMOVE BOOTSTRAP ORDER CREATION** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; независимая проверка: единственный production writer `createOrderFromRequested` (аудит writes — категория 4 = 0), consumer diff vs HEAD = только комментарий, fixture test-only (не в src/модулях/build), `order.import` удалён + seed-реконсиляция role-scoped, mass-assignment закрыт (PATCH только action/travelers), Step 2.7/Booking/Payment/availability не тронуты (git scope), legacy Order читаем/управляем; REVIEW FIX: canonical journey усилен нетривиальной Decimal-суммой 123.45 (§15/§33.13) — frozen money от Quote до OrderCreated без float-drift; регрессия воспроизведена независимо: 863/863 serial e2e + 459 unit + 135 frontend + build + migrate 42/42; детали — отчёт STRICT REVIEW)
25. **STEP 2.7 — ORDER LIFECYCLE COMPLETION** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; STRICT REVIEW FIXES: §28 forbidden-key 422 (order.validation.ts), §40/§29/§33/§37 новые e2e (concurrent confirm, send-vs-cancel, fulfill race, BUYER_REQUEST, legacy null-acquisition, MODERATOR); регрессия 895/895 e2e + 459 unit + 135 frontend; единственная авторитетная машина состояний (12 кодов, Screen Design), `OrderReadyForBooking`/`BookingRequested`/`OrderFulfilled`/`OrderClosed` атомарно с state+history, `confirm` guard (travelers COMPLETE), explicit send→`BookingRequested` (только из READY_FOR_BOOKING), CAS/идемпотентность, milestone-времена 2.5A immutable, SLA = детерминизм из milestones/history, READY_TO_CLOSE = резервный код без producer-а, Step 2.8 boundary сохранён (Booking создаёт ТОЛЬКО consumer BookingRequested); детали — `docs/architecture/order-lifecycle-completion.md`; e2e order-lifecycle-completion)
26. **STEP 2.7 — STRICT REVIEW** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; отчёт — `docs/prompts/PHASE_2_STEP_2.7_ORDER_LIFECYCLE_COMPLETION_STRICT_REVIEW_REPORT.md` (RETROSPECTIVE EVIDENCE RECONSTRUCTION: оригинальный отчёт-артефакт отсутствовал; результаты реконструированы из committed evidence, верифицировано в commit `1bc19b7`))
27. **STEP 2.8 — BOOKINGREQUESTED → BOOKING CREATION** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-12; канонизация pre-existing Phase 1 consumer; кардинальность 1:1 `orderItemId` @unique; §28 booking PATCH 422; регрессия 909/909 e2e + 459 unit + 135 frontend + migrate 43/43; e2e booking-requested-consumer 14 тестов)
28. **STEP 2.8 — STRICT REVIEW** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-12; отчёт — PHASE_2_STEP_2.8_BOOKINGREQUESTED_TO_BOOKING_CREATION_STRICT_REVIEW.md)
29. **STEP 2.8A — BOOKING SERVICE DATE / TIME MODEL** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-13; см. секцию Step 2.8A выше; регрессия 949/949 e2e + 475 unit + 135 frontend + build + migrate 45/45 drift 0)
29A. **PHASE 2 — STEP 2.8A — STRICT REVIEW** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-13; отчёт PHASE_2_STEP_2.8A_BOOKING_SERVICE_DATE_TIME_MODEL_STRICT_REVIEW.md; 0 дефектов)
29B. **PHASE 2 — STEP 2.9 — BOOKING LIFECYCLE COMPLETION** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-13; независимый adversarial-аудит: write-path (ровно 3 Booking-owned writer-а, категория 4 = 0), единая state-machine authority, compensation OrderCancelled (CAS + history + BookingCancelled, терминальные не трогаются), born-CANCELLED (§15 — создание сразу в CANCELLED при OrderCancelled-раньше-BookingRequested, `created_cancelled`, без BookingCancelled — перехода не было), BookingCompleted vs BookingStatusChanged (canonical факт + технический reconcile-контракт 2.5A, не конкурируют — BookingCompleted без consumer-а), AWAITING_CONFIRMATION — резервный код без producer-а (как READY_TO_CLOSE), §46 Order reconciliation matrix M1–M8 (все 8 комбинаций e2e; cancelled-only/rejected-only НЕ → FULFILLED; PROBLEM не перезаписывается reconcile), Availability release ownership — schema явно фиксирует owner-step, release нигде не реализован (системно), 2.9 не освобождает — OK; REVIEW FIXES: (1) order-status guard в bookingAction — lifecycle-команды (кроме cancel) на брони заказа CANCELLED/CLOSED → 409 (инвариант §15 детерминирован; компенсация-vs-command race закрыта для последовательного сценария), (2) `problem` self-transition исключён (alignment с Order), (3) race-тесты compensation-vs-confirm/complete; регрессия воспроизведена независимо: 994/994 serial e2e (55 suite) + 475 unit + 135 frontend + build + migrate 45/45; детали — `docs/architecture/booking-lifecycle-completion.md` (§16/§16A); отчёт — `docs/prompts/PHASE_2_STEP_2.9_BOOKING_LIFECYCLE_COMPLETION_STRICT_REVIEW_REPORT.md` (RETROSPECTIVE EVIDENCE RECONSTRUCTION: оригинальный отчёт-артефакт отсутствовал; результаты реконструированы из committed evidence, implementation/review-fixes верифицированы в commit `1bc19b7`); NEXT = Step 2.9A) полный канонический Booking lifecycle: единственный authority `BookingService.bookingAction` + CAS (`updateMany id+status+version`, как Order 1.14 §19); producer-ы для Screen Design статусов (prepare→PREPARING_REQUEST, requestClarification/resume→NEEDS_CLARIFICATION, requestChange/resolveChange→CHANGE_REQUESTED, requestCancellation→CANCELLATION_REQUESTED; AWAITING_CONFIRMATION — резервный без producer-а); canonical `BookingCompleted` (ровно одно на реальный complete; BookingStatusChanged остаётся техническим для approved reconcile-контракта 2.5A); **компенсация Step 2.8-race §15** — `OrderCancelled` → booking-order-cancelled-consumer отменяет активные брони (CAS + history `cancelled_order` + result BookingCancelled), гонка Order-cancel vs Booking-create в обоих порядках детерминирована (создание сразу в CANCELLED при уже отменённом заказе, `created_cancelled`); терминальные не перезаписываются; Order-cancel после Booking exists — компенсируется (никакого delete/refund/Finance/availability-release — ownership не определён); frozen факты immutable (money/acquisition/service occurrence 2.8A), никакого второго hold; Order feedback без изменений (Order-owned reconcile); RBAC/IDOR/mass-assignment (новые actions → существующие permissions booking.send_supplier/confirm/request_change/cancel); e2e booking-lifecycle-completion 34 теста (negative §41 + positive/race §42) + rbac-actions расширен; регрессия: см. отчёт; Migration N/A (все статусы уже в enum); детали — `docs/architecture/booking-lifecycle-completion.md`; NEXT = STEP 2.9 STRICT REVIEW)

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

**Finance-блок (2.10–2.13) — выполнено по body NEXT markers (Roadmap Reconciliation 2026-08-14):**
2.10 → 2.10A → 2.10B → 2.10C → 2.11 → 2.12 → 2.13 (все ✅ STRICT REVIEW APPROVED;
отчёт — `docs/prompts/PHASE_2_ROADMAP_RECONCILIATION_2.12A_TO_2.13A_REPORT.md`).
Принцип (как 2.2A–2.2F / 1.8A–1.8D): Steps 2.12A–2.12G — **логические расширения
2.12 core, НЕ обязательные prerequisites**; порядок реализации НЕ выводится из
документной нумерации (Dependency Analysis прецедент выше). Доказано 2.12/2.13
strict reviews: 2.13 provider-neutral (source = CAPTURED Payment, 0 PSP/webhook/
AUTHORIZED/Commission/Ledger/partial/feeType side-effects). 2.13A (Chargeback/
Dispute Foundation) — **MIXED DEPENDENCY**: foundation (dispute/evidence/liability
факты, provider-neutral) может идти после 2.13; real-PSP chargeback требует
2.12A/2.12B; ledger/commission/settlement adjustments требуют 2.12D/2.12C/2.14A.
2.13A ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (см. запись body выше).
NEXT (актуальный): Step 2.14 — Invoice / Commission Flow — ⛔ BLOCKED — ARCHITECTURE
DECISION REQUIRED (stop-condition §58 #4: Commission formula/rate/base/source authority
не определена; 2.12C/2.12E/2.14E NOT STARTED — итог:
`docs/prompts/PHASE_2_STEP_2.14_BLOCKED_ARCHITECTURE_DECISION_REQUIRED.md`).
Следующий проход — Commission Dependency Reconciliation (2.12C/2.12E/2.14E) отдельным
prompt-ом; НЕ начинать 2.14A и НЕ реализовывать 2.12C/2.12E самостоятельно.
**Commission Dependency Reconciliation (2026-08-14) — итог:
`PHASE 2 COMMISSION DEPENDENCY RECONCILIATION COMPLETED — ARCHITECTURE DECISION REQUIRED`
(отчёт — `docs/prompts/PHASE_2_COMMISSION_DEPENDENCY_RECONCILIATION_2.12C_2.12E_2.14E_REPORT.md`).**
Выводы из фактического репозитория: (1) Commission policy authority НЕ существует
(ADR-0006: «Никаких fee %, plan prices, ... commission engine»; 0 rate/policy-моделей —
только TaxRule/ExchangeRate; 0 ставок в legacy; 0 commission в frozen snapshot);
(2) PREREQUISITE EDGES: 2.12C (SPLIT_AT_PAYMENT, native PSP split) → HARD requires
2.12A/2.12B (PSP/adapters/webhooks) + требует frozen commission policy/base до split;
2.14E (Channel-Based Commission Rules) → policy-фундамент ДОЛЖЕН предшествовать 2.12C/2.12E
(«Никаких hardcoded ставок» — ставки = master data, не константы), несмотря на более поздний
номер; 2.12E (PARTNER_COLLECT → CommissionAccrual) — provider-neutral, НО trigger/base
не определены; 2.14 остаётся BLOCKED; 2.14A/2.14B — NOT STARTED, commission — input для
Settlement Engine; (3) Invoice (buyer, customerId) доказуемо независима — frozen Order
snapshot; (4) ARCHITECTURE DECISIONS REQUIRED до любого commission-кода: policy dimensions,
base (gross/net/tax/discount), rate type, freeze boundary, collection model per channel,
adjustment strategy (Refund/Dispute).
**Commission Policy Contract ADR-0013 (2026-08-14) — DECIDED (архитектурное решение,
0 кода; ADR — `docs/adr/ADR-0013-commission-policy-contract.md`, отчёт —
`docs/prompts/PHASE_2_COMMISSION_POLICY_CONTRACT_ARCHITECTURE_DECISION_REPORT.md`):**
Finance-owned `finance.CommissionPolicy` (master data, НЕ проценты в коде);
V1-дименсия = channel (MARKETPLACE; PARTNER_STOREFRONT — SaaS no-commission;
DIRECT/BUYER_REQUEST — none; CUSTOM_DOMAIN/API — deferred 2.5B); rateType PERCENTAGE
(fixed/tiered — deferred); base = frozen discounted Order.total (tax-exclusive by
construction, order-level); rounding ROUND_HALF_UP scale 2; selection+freeze = Quote
ISSUE (frozen commissionSnapshot verbatim Checkout→Sale→Order); collection: SPLIT_AT_PAYMENT
(Payment CAPTURED trigger; PSP получает предвычисленный amount, НЕ владеет policy) /
PARTNER_COLLECT (Order creation trigger; CommissionAccrual receivable); Commission =
earned fact, CommissionAccrual = receivable-представление; refund adjustment = immutable
+ компенсирующий факт (пропорциональный, deferred); dispute adjustment = DEFER до
liability-исхода; invoice: buyer + partner-commission (два концепта); seller атрибуция —
`Order.sellerPartnerId` frozen (one-seller invariant, multi-seller fail-closed);
RBAC `finance.commission.manage` (FINANCE/ADMIN) — добавить в 2.14E; событие
CommissionAccrued (consumer-ы 2.12D/2.14A/2.14); 14 инвариантов. NEXT = STEP 2.14E —
CHANNEL-BASED COMMISSION RULES FOUNDATION (не начинается в этом проходе).

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
