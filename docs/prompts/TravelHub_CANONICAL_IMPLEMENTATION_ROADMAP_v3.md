# TravelHub --- CANONICAL MASTER IMPLEMENTATION PLAN v3

**Статус документа:** канонический Master Plan на хранение\
**Дата актуализации:** 2026-08-13 (Service Templates decision gates DD-024…DD-029 RESOLVED; Universal Pricing Model Amendment INTEGRATED — docs/architecture/universal-pricing-model.md; Canonical Roadmap Gap & Status Reconciliation Audit COMPLETED 2026-08-12 — статусы 1.12.3/1.18/1.18A/2.0/2.6 синхронизированы; Step 2.7 ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES; Step 2.8 ✅ STRICT REVIEW COMPLETED — APPROVED; Step 2.8A ✅ STRICT REVIEW COMPLETED — APPROVED; Step 2.9 ◀ IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW (2026-08-13))\
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
**Статус: ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; независимый adversarial-аудит — отчёт PHASE_2_STEP_2.7_ORDER_LIFECYCLE_COMPLETION_STRICT_REVIEW.md; REVIEW FIXES: §28 forged server-owned поля → 422 (assertNoForbiddenKeys, order.validation.ts), §40/§29/§33/§37 добавлены e2e concurrent confirm / send-vs-cancel / fulfill race / BUYER_REQUEST / legacy null-acquisition / MODERATOR; §13 boundary подтверждён — pre-existing Phase 1 BookingRequested consumer канонизируется в 2.8; регрессия 895/895 e2e + 459 unit + 135 frontend + build + migrate 42/42 drift 0; детали — `docs/architecture/order-lifecycle-completion.md`).**

· **Step 2.8 --- BookingRequested → Booking Creation**\
Booking создаётся только по `BookingRequested`; связь OrderItem ↔
Booking без нарушения ownership.
**Статус: ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-12; независимый adversarial-аудит — отчёт PHASE_2_STEP_2.8_BOOKINGREQUESTED_TO_BOOKING_CREATION_STRICT_REVIEW.md; канонизация pre-existing Phase 1 consumer `booking.subscribers.ts` — ЕДИНСТВЕННЫЙ create-механизм (write-path audit: один `booking.create`, категория 5 = 0; POST /bookings не существует); кардинальность 1 OrderItem → 1 Booking (DB unique `Booking.orderItemId`, миграция 20260812140000_add_booking_order_item_link, аддитивная, nullable для legacy); frozen факты verbatim (acquisitionSource DIRECT/BUYER_REQUEST/null без fabrication, amount = item.amount Decimal без reprice); Passenger из COMPLETE OrderTraveler (non-traveler — без placeholder); идемпотентность Inbox + count-check + DB unique (P2002 no-op ТОЛЬКО для `Booking_orderItemId_key`/`InboxEvent_consumerId_eventId_key` через shared `uniqueConstraintNames` — оба Prisma shape; прочие unique-дефекты → FAILED); failure atomicity — весь OrderRequest в одной consumer-транзакции; BookingCreated ровно одно на обработку (без PII, correlation наследуется, causation = BookingRequested.eventId, actor SYSTEM); §28 forbidden-key 422 на PATCH /bookings (booking.validation.ts) + Order-команды (order.validation.ts); event authority — durable BookingRequested без live-state gate (race cancel после send → Booking остаётся, компенсация 2.9); legacy-совместимость (orderItemId NULL, null acquisition); 2.8A-boundary соблюдён (serviceStartsAt/EndsAt/Timezone — только forbidden keys); регрессия 909/909 e2e + 459 unit + 135 frontend + build + migrate 43/43 drift 0; детали — `docs/architecture/booking-requested-to-booking-creation.md`; e2e `booking-requested-consumer` (14 тестов); Step 2.8A НЕ начат).**

· **Step 2.8A --- Booking Service Date / Time Model**\
Отдельно entity creation time и время услуги: `serviceStartsAt`,
`serviceEndsAt`, `serviceTimezone`; `DATE_ONLY`, `TIME_SLOT`,
`DATE_RANGE`, `OPEN_DATE`; capacity/slot reservation. IANA timezone.\
**Статус: ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-13; имплементация: frozen service occurrence пропагируется цепочкой Catalog → Quote → CheckoutIntent → Sale → OrderRequested → Order → BookingRequested → Booking; authority timezone = `Product.serviceTimeZone` (IANA, Intl.supportedValuesOf) → frozen в CheckoutIntent при binding → verbatim дальше (никакого browser/locale/IP/offset authority; forged zone/instant → 422); temporal vocabulary `serviceDate` (date-only) + `serviceTime`/`serviceEndTime` (local HH:mm) + `serviceTimeZone` (IANA) + `serviceStartsAt`/`serviceEndsAt` (derived UTC instants, Intl-оффсеты БЕЗ ручной арифметики; DST ambiguous → ранний instant, nonexistent → сразу после разрыва; date-only → NULL, 00:00 НЕ фабрикуется §7); `serviceTimeType` DATE_ONLY (default, корректно классифицирует legacy)|TIME_SLOT|OPEN_DATE|DATE_RANGE (зарезервирован); деривация — ОДИН раз в consumer-е BookingRequested из frozen фактов (инвариант local↔UTC §13); миграции 20260812212139_add_booking_service_time_model + add_product_draft_service_time_zone (аддитивные, nullable; 45/45 drift 0); продакшн PATCH /orders|/bookings и checkout service-date — forbidden temporal keys → 422; OrderRequested +serviceTime/serviceEndTime/serviceTimeZone (валидация consumer-а: time требует zone + serviceDate, endTime требует time; дефект ленты → FAILED); BookingCreated НЕ расширен; TimeSlot/slot-capacity/reschedule — вне 2.8A (гейты); регрессия 949/949 e2e (54 suite, вкл. booking-service-time-model 40 тестов) + 475 unit + 135 frontend + build + drift 0; STRICT REVIEW 2026-08-13 — независимый adversarial-аудит: 0 дефектов (3 документационные уточнения: mixed/no-zone quote → order-level zone freeze; clear-time требует явный serviceEndTime:null; ±12h window — теоретический лимит); отчёт `docs/prompts/PHASE_2_STEP_2.8A_BOOKING_SERVICE_DATE_TIME_MODEL_STRICT_REVIEW.md`; детали — `docs/architecture/booking-service-time-model.md`; NEXT = Step 2.9).**

· **Step 2.9 --- Booking Lifecycle Completion**\
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

· **Step 2.10B --- Settlement / Payout / Provider Fee Foundation** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-14; независимый adversarial-аудит — отчёт `docs/prompts/PHASE_2_STEP_2.10B_PROVIDER_FEE_SETTLEMENT_PAYOUT_FOUNDATION_STRICT_REVIEW.md`; `finance.ProviderFee`/`Settlement`/`Payout` PFE-/STL-/POT-*, immutable факты без `updatedAt`, money DECIMAL(12,2) Decimal-строки, currency — ISO 4217 снапшот против `finance.Currency` (без FK), idempotency DB-unique (PFE: sourceType+sourceId+provider; STL/POT: sourceType+sourceId) first-write-wins + payload-верификация (divergent → 409), correlation/causation/actor server-authoritative (ADR-0010), единственный canonical writer — внутренний `SettlementService` (публичного POST нет; PATCH/DELETE → 404), read RBAC `finance.provider_fee.read`/`finance.settlement.read`/`finance.payout.read` (FINANCE/DIRECTOR/ANALYST/ADMIN), 0 доменных событий, ledger-автопостинг НЕ реализован (нет canonical engine; 2.10A append-only не нарушен), Payment Buyer vs Payout Partner — разные rails без связи, migration `add_provider_fee_settlement_payout_foundation` (аддитивная, replay-proof), e2e provider-fee-settlement-payout-foundation 13/13; REVIEW FIXES: audit action `finance.provider_fee.created` (snake_case, было `finance.providerfee.created` — конвенция finance.*), высокорисковые негативные тесты (divergent providerRef → 409 e2e #6b; concurrent divergent → один факт + 409 без raw 500 e2e #7b; unknown P2002 → controlled ConflictError unit; pagination whitelist pageSize>101/page=0/page=abc → 400), arch doc §5.1 — будущая эволюция idempotency-ключей (2.12G feeType-discriminator / 2.14A settlement version / 2.14B payout attempt — swap на пустых таблицах); 0 архитектурных блокеров (stop-conditions отрицательны; консервативные ключи при нуле producer-ов — эволюционируемы аддитивно); регрессия unit 495/495 + serial e2e 1055/1055 (59 suites) + frontend 135/135 + build + migrate 49/49 drift 0; детали — `docs/architecture/provider-fee-settlement-payout-foundation.md`; NEXT = STEP 2.10C — FINANCE TEMPORAL CONTRACT (не начинать в этом проходе)\

· **Step 2.10C --- Finance Temporal Contract** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-14; независимый adversarial-аудит — отчёт `docs/prompts/PHASE_2_STEP_2.10C_FINANCE_TEMPORAL_CONTRACT_STRICT_REVIEW_REPORT.md`; реализация — `docs/prompts/PHASE_2_STEP_2.10C_FINANCE_TEMPORAL_CONTRACT_IMPLEMENTATION_REPORT.md`; только Ledger `occurredAt` был обоснован и реализован: аддитивная nullable-колонка `LedgerTransaction.occurredAt` (business occurrence, UTC, отдельно от createdAt-персистенции; NULL = неизвестно, БЕЗ backfill; authority — server-валидированный ISO 8601; first-write-wins при identical replay — occurredAt вне replay payload-сравнения, §16; единственный writer — LedgerService.create; миграция `20260814090000_add_ledger_occurred_at` аддитивная; 0 доменных событий, 0 premature милстоунов, 0 cross-domain writes, 0 авто-постинга; REVIEW FIXES: (1) строгий ISO 8601 валидатор вместо lenient Date.parse — голый parse принимал date-only/locale/TZ-зависимые форматы (разные инстанты на разных машинах) и молча нормализовал невозможные даты (2026-02-30 → 03-02); теперь строгий regex + Date.parse range-check + round-trip проверка календарных компонентов (unit 16/16, e2e 3B расширен: offset Z/+02:00 → один instant после persistence, date-only/Feb 30 → reject, 0 строк); (2) concurrent temporal disagreement e2e 3D (same payload, разные occurredAt → один факт first-write-wins, без raw 500) и concurrent divergent amount e2e 3E (один факт + controlled ConflictError, без raw 500) — §14/§38; (3) api.md: документированы strict-ISO формы и future-time policy (occurredAt ≤ createdAt НЕ enforced — producer clock-skew легитимен); финальная регрессия unit 498/498, serial e2e 1059/1059 (59 suites), frontend 135/135 + production build, migrate 50/50 drift 0; арх-док `docs/architecture/finance-temporal-contract.md`; NEXT = STEP 2.11 — PRICING & FINANCIAL SNAPSHOT (не начинать в этом проходе))\
Roadmap-визион будущих милстоунов (producer-шаги 2.12–2.14, НЕ реализовано в 2.10C):
Payment: `createdAt/authorizedAt/capturedAt/failedAt/cancelledAt`;
Refund: `requestedAt/approvedAt/processedAt/failedAt`; Settlement:
`createdAt/eligibleAt/calculatedAt/settledAt`; Payout:
`createdAt/scheduledAt/processingAt/paidAt/failedAt`; Ledger:
`occurredAt` ✅ (реализован в 2.10C).

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
26. **STEP 2.7 — STRICT REVIEW** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-12; отчёт — PHASE_2_STEP_2.7_ORDER_LIFECYCLE_COMPLETION_STRICT_REVIEW.md)
27. **STEP 2.8 — BOOKINGREQUESTED → BOOKING CREATION** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-12; канонизация pre-existing Phase 1 consumer; кардинальность 1:1 `orderItemId` @unique; §28 booking PATCH 422; регрессия 909/909 e2e + 459 unit + 135 frontend + migrate 43/43; e2e booking-requested-consumer 14 тестов)
28. **STEP 2.8 — STRICT REVIEW** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-12; отчёт — PHASE_2_STEP_2.8_BOOKINGREQUESTED_TO_BOOKING_CREATION_STRICT_REVIEW.md)
29. **STEP 2.8A — BOOKING SERVICE DATE / TIME MODEL** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-13; см. секцию Step 2.8A выше; регрессия 949/949 e2e + 475 unit + 135 frontend + build + migrate 45/45 drift 0)
29A. **PHASE 2 — STEP 2.8A — STRICT REVIEW** ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-13; отчёт PHASE_2_STEP_2.8A_BOOKING_SERVICE_DATE_TIME_MODEL_STRICT_REVIEW.md; 0 дефектов)
29B. **PHASE 2 — STEP 2.9 — BOOKING LIFECYCLE COMPLETION** ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES (2026-08-13; независимый adversarial-аудит: write-path (ровно 3 Booking-owned writer-а, категория 4 = 0), единая state-machine authority, compensation OrderCancelled (CAS + history + BookingCancelled, терминальные не трогаются), born-CANCELLED (§15 — создание сразу в CANCELLED при OrderCancelled-раньше-BookingRequested, `created_cancelled`, без BookingCancelled — перехода не было), BookingCompleted vs BookingStatusChanged (canonical факт + технический reconcile-контракт 2.5A, не конкурируют — BookingCompleted без consumer-а), AWAITING_CONFIRMATION — резервный код без producer-а (как READY_TO_CLOSE), §46 Order reconciliation matrix M1–M8 (все 8 комбинаций e2e; cancelled-only/rejected-only НЕ → FULFILLED; PROBLEM не перезаписывается reconcile), Availability release ownership — schema явно фиксирует owner-step, release нигде не реализован (системно), 2.9 не освобождает — OK; REVIEW FIXES: (1) order-status guard в bookingAction — lifecycle-команды (кроме cancel) на брони заказа CANCELLED/CLOSED → 409 (инвариант §15 детерминирован; компенсация-vs-command race закрыта для последовательного сценария), (2) `problem` self-transition исключён (alignment с Order), (3) race-тесты compensation-vs-confirm/complete; регрессия воспроизведена независимо: 994/994 serial e2e (55 suite) + 475 unit + 135 frontend + build + migrate 45/45; детали — `docs/architecture/booking-lifecycle-completion.md` (§16/§16A); отчёт — PHASE_2_STEP_2.9_BOOKING_LIFECYCLE_COMPLETION_STRICT_REVIEW.md; NEXT = Step 2.9A) полный канонический Booking lifecycle: единственный authority `BookingService.bookingAction` + CAS (`updateMany id+status+version`, как Order 1.14 §19); producer-ы для Screen Design статусов (prepare→PREPARING_REQUEST, requestClarification/resume→NEEDS_CLARIFICATION, requestChange/resolveChange→CHANGE_REQUESTED, requestCancellation→CANCELLATION_REQUESTED; AWAITING_CONFIRMATION — резервный без producer-а); canonical `BookingCompleted` (ровно одно на реальный complete; BookingStatusChanged остаётся техническим для approved reconcile-контракта 2.5A); **компенсация Step 2.8-race §15** — `OrderCancelled` → booking-order-cancelled-consumer отменяет активные брони (CAS + history `cancelled_order` + result BookingCancelled), гонка Order-cancel vs Booking-create в обоих порядках детерминирована (создание сразу в CANCELLED при уже отменённом заказе, `created_cancelled`); терминальные не перезаписываются; Order-cancel после Booking exists — компенсируется (никакого delete/refund/Finance/availability-release — ownership не определён); frozen факты immutable (money/acquisition/service occurrence 2.8A), никакого второго hold; Order feedback без изменений (Order-owned reconcile); RBAC/IDOR/mass-assignment (новые actions → существующие permissions booking.send_supplier/confirm/request_change/cancel); e2e booking-lifecycle-completion 34 теста (negative §41 + positive/race §42) + rbac-actions расширен; регрессия: см. отчёт; Migration N/A (все статусы уже в enum); детали — `docs/architecture/booking-lifecycle-completion.md`; NEXT = STEP 2.9 STRICT REVIEW)

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
