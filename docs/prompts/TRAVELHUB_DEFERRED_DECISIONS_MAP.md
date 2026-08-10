# TRAVELHUB --- DEFERRED DECISIONS MAP

**Document status:** CANONICAL / LIVING DOCUMENT\
**Purpose:** единая карта архитектурных, продуктовых и коммерческих
решений TravelHub, которые сознательно отложены до более подходящего
этапа реализации.\
**Relationship to Roadmap:** документ не заменяет Canonical
Implementation Roadmap, не меняет нумерацию Step и не разрешает
преждевременную реализацию.

## Правило ведения

Каждый новый вопрос, по которому принято решение «вернуться позже»,
получает `DD-XXX`. Закрытые записи не удаляются:
`DEFERRED → IN_REVIEW → DECIDED` либо `SUPERSEDED`.

Для каждой записи фиксируются: Context, Already Decided, Still Open, Do
Not Implement Yet, Trigger / Return Point, Related Roadmap Steps,
Related ADRs, Decision Deadline, Final Decision, Decision Date.

**Ключевое правило:** `DEFERRED` не означает «разработчик выбирает сам».
Если отложенный вопрос блокирует текущий Step, он поднимается как
`ARCHITECTURE DECISION REQUIRED` или `PRODUCT DECISION REQUIRED`.

------------------------------------------------------------------------

## DD-001 --- Multilingual Product Content

**Status:** DEFERRED

**Already Decided:** UI платформы RU/AZ/EN; один Product остаётся одним
объектом; в будущем контент услуги должен переключаться по locale.

**Still Open:** модель хранения RU/AZ/EN; sourceLocale; fallback;
обязательность переводов; права PARTNER/MODERATOR; moderation; localized
search; локализация тарифов, itinerary, captions/altText.

**Do Not Implement Yet:** не добавлять поспешно
`titleRu/titleAz/titleEn`; не блокировать публикацию из-за отсутствия
переводов.

**Return Point:** перед полноценным localized Search/SEO либо раньше,
если это станет блокером Public Catalog.

**Related ADRs:** TBD.\
**Final Decision / Date:** TBD.

------------------------------------------------------------------------

## DD-002 --- Automatic / AI Translation

**Status:** DEFERRED

**Already Decided:** сейчас не реализуется из-за стоимости; будущая
multilingual-модель не должна блокировать автоматизацию.

**Still Open:** provider/API, стоимость, quotas, кто платит, Storefront
entitlement, moderation машинного перевода.

**Do Not Implement Yet:** не подключать платные translation API и
обязательные AI dependencies.

**Return Point:** после multilingual foundation и оценки unit economics.

------------------------------------------------------------------------

## DD-003 --- Storefront Free Trial

**Status:** DEFERRED

**Already Decided:** Storefront должен предусматривать trial; текущая
целевая модель --- 7 дней полного функционала; предпочтительно явный
запуск PARTNER и без карты; Marketplace после окончания trial продолжает
работать; Storefront/CRM/settings/analytics не удаляются.

**Still Open:** окончательная длительность, card-on-file, reminders,
grace period, capability behavior после expiration, anti-abuse,
повторный trial, conversion flow, state machine.

**Do Not Implement Yet:** не создавать временную Billing-модель, fake
Invoice/Payment или recurring billing в Catalog.

**Return Point:** Storefront Subscription/Billing design.

**Related ADRs:** ADR-0006 + будущий Billing/Subscription ADR.

------------------------------------------------------------------------

## DD-004 --- Storefront SaaS Plans

**Status:** DEFERRED

**Already Decided:** Storefront --- paid SaaS; должен иметь
plan/subscription/entitlement model.

**Still Open:** количество и названия тарифов, CRM/analytics
capabilities, staff seats, domains, exports, automation, limits.

**Do Not Implement Yet:** не хардкодить START/BUSINESS/PRO как
окончательную модель.

**Return Point:** Storefront Subscription/Billing design.

------------------------------------------------------------------------

## DD-005 --- Storefront Pricing

**Status:** DEFERRED

**Already Decided:** Storefront оплачивается как SaaS, а не просто
второй commission Marketplace.

**Still Open:** monthly/annual price, currency, regional pricing,
discounts, taxes/VAT.

**Do Not Implement Yet:** не фиксировать канонические цены в domain
logic/UI.

**Return Point:** перед production Subscription Checkout.

------------------------------------------------------------------------

## DD-006 --- Storefront Recurring Billing

**Status:** DEFERRED

**Already Decided:** recurring billing должен быть полноценным
Billing-механизмом, а не ручным entitlement switch.

**Still Open:** PSP, periods, retries/dunning, invoices, tax, webhooks,
idempotency.

**Do Not Implement Yet:** Catalog не становится Billing source of truth.

**Return Point:** Billing domain implementation.

------------------------------------------------------------------------

## DD-007 --- Trial → Paid Subscription

**Status:** DEFERRED

**Already Decided:** переход не создаёт новый Storefront и не теряет
данные.

**Still Open:** checkout timing, activation, proration, failure
handling.

**Do Not Implement Yet:** не моделировать переход ручным
Product/Storefront status.

**Return Point:** Subscription lifecycle design.

------------------------------------------------------------------------

## DD-008 --- Failed Payment / Grace Period

**Status:** DEFERRED

**Already Decided:** желательно не отключать Storefront мгновенно после
первой неудачной оплаты.

**Still Open:** grace duration, retries, PAST_DUE, notifications,
read-only behavior.

**Do Not Implement Yet:** не хардкодить сроки.

**Return Point:** Subscription/dunning design.

------------------------------------------------------------------------

## DD-009 --- Storefront Partner CRM Entitlements

**Status:** DEFERRED

**Already Decided:** Storefront должен иметь расширенный Partner-scoped
CRM; Marketplace-only PARTNER --- более ограниченные возможности; tenant
isolation обязательно.

**Still Open:** CRM capabilities по plan, limits, staff, pipelines,
automation, imports/exports.

**Do Not Implement Yet:** не привязывать полный CRM к конкретному тарифу
до capability matrix.

**Return Point:** Partner CRM + SaaS Plans design.

------------------------------------------------------------------------

## DD-010 --- Marketplace vs Storefront Analytics

**Status:** DEFERRED

**Already Decided:** Marketplace PARTNER получает базовую operational
analytics; Storefront --- расширенную SaaS analytics: traffic, visitors,
views, funnel, conversion, product performance, geography, seasonality,
exports.

**Still Open:** точная capability matrix, retention, attribution depth,
exports.

**Do Not Implement Yet:** наличие Storefront само по себе не является
implicit permission на всю аналитику.

**Return Point:** Analytics + Storefront Plans design.

------------------------------------------------------------------------

## DD-011 --- Storefront Custom Domain / Subdomain

**Status:** DEFERRED

**Already Decided:** Storefront развивается как собственный сайт
PARTNER; custom domain/subdomain концептуально допустим.

**Still Open:** DNS verification, TLS, plan eligibility, canonical URL,
SEO, ownership.

**Do Not Implement Yet:** не строить domain infrastructure в foundation.

**Return Point:** Storefront Advanced / SEO / Infrastructure.

------------------------------------------------------------------------

## DD-012 --- Marketplace Commission Rules

**Status:** DEFERRED

**Already Decided:** Marketplace --- commission model; TravelHub
приводит buyer; anti-disintermediation сохраняется.

**Still Open:** ставки, fixed/percentage, категории, tiers, refunds,
taxes, commission base.

**Do Not Implement Yet:** не хардкодить commission rate.

**Return Point:** Commission Engine / Payment architecture.

------------------------------------------------------------------------

## DD-013 --- Storefront Transaction Economics

**Status:** DEFERRED

**Already Decided:** Storefront --- paid SaaS и не наследует
автоматически обязательную Marketplace commission для собственных leads.

**Still Open:** payment rails, optional transaction fee, PSP cost
allocation, off-platform payments.

**Do Not Implement Yet:** не определять комиссию по факту наличия
Storefront/Product channel.

**Return Point:** Payment + acquisition-channel commercial design.

------------------------------------------------------------------------

## DD-014 --- Subscription Authoritative Domain

**Status:** DEFERRED

**Already Decided:** текущий `PartnerStorefront.entitlementStatus` ---
entitlement-ready Catalog state, не полноценный Billing source of truth.

**Still Open:** Billing bounded context, Subscription aggregate,
entitlement events, reconciliation.

**Do Not Implement Yet:** не расширять Catalog до Billing domain.

**Return Point:** до Subscription/Billing implementation.

------------------------------------------------------------------------

## DD-015 --- Storefront Public Business Contacts

**Status:** DEFERRED

**Already Decided:** Marketplace seller projection контакты не
раскрывает; Storefront может раскрывать structured storefront-owned
business contacts; они не должны утекать в Marketplace.

**Still Open:** набор полей, verification/moderation, visibility,
social/website policies.

**Do Not Implement Yet:** не ослаблять Step 1.11 anti-disintermediation
Marketplace.

**Return Point:** Storefront Business Identity/frontend.

**Related ADRs:** ADR-0005, ADR-0006.

------------------------------------------------------------------------

## DD-016 --- Professional Translation Service

**Status:** DEFERRED

**Already Decided:** потенциальная будущая дополнительная услуга, не
core сейчас.

**Still Open:** internal/external translators, pricing, SLA, moderation.

**Do Not Implement Yet:** не создавать translation service сейчас.

**Return Point:** после multilingual foundation и анализа спроса.

------------------------------------------------------------------------

## DD-017 --- Trial Anti-Abuse

**Status:** DEFERRED

**Already Decided:** бесконечный trial через удаление/создание
Storefront недопустим; eligibility должна относиться к Partner/Billing
Account.

**Still Open:** identity key, legal-entity matching, admin override,
promotional second trials.

**Do Not Implement Yet:** не использовать storefront row как
единственный trial eligibility key.

**Return Point:** Trial/Subscription implementation.

------------------------------------------------------------------------

## DD-018 --- Trial Data Retention

**Status:** DEFERRED

**Already Decided:** после expiration Storefront settings, CRM и
накопленная analytics автоматически не удаляются.

**Still Open:** retention period, read-only access, privacy/deletion
rules, reactivation window.

**Do Not Implement Yet:** не удалять данные только из-за trial
expiration.

**Return Point:** Billing + Data Retention/Privacy design.

------------------------------------------------------------------------

## DD-019 --- Storefront Subscription Cancellation

**Status:** DEFERRED

**Already Decided:** предпочтительно Storefront работает до конца
оплаченного периода; Marketplace независим; данные не удаляются при
cancel.

**Still Open:** immediate cancel, refunds, reactivation, downgrade.

**Do Not Implement Yet:** не удалять Storefront/Product при
cancellation.

**Return Point:** Subscription lifecycle design.

------------------------------------------------------------------------

## DD-020 --- Storefront SaaS Capability Matrix

**Status:** DEFERRED

**Already Decided:** планы могут управлять CRM, analytics, custom
domain, staff и другими SaaS-возможностями.

**Still Open:** полная feature/limit matrix.

**Do Not Implement Yet:** не размазывать проверки конкретных plan names
по доменной логике; использовать будущие capabilities/entitlements.

**Return Point:** Storefront Plans design.

------------------------------------------------------------------------

## DD-021 --- Per-User Capability Assignment & Admin Management UI

**Status:** DEFERRED

**Already Decided (Step 2.2 review):** backend authority —
permission/capability-based; system roles = presets (не постоянные
organizational job boundaries); один internal user может совмещать
capabilities нескольких work centers (Customers/Sales/Suppliers/Orders/
Bookings/Communications/Finance) — особенно для малых организаций.
Permissions существуют независимо от role names; DB-маппинг user→permission
архитектурно возможен без правки доменного кода; guards проверяют
permissions; sidebar — permission-driven (backend authoritative).

**Still Open:** admin UI назначения per-user capabilities (сверх роли),
organization-defined access, UX совмещения work centers, дедупликация
роль vs per-user grants.

**Do Not Implement Yet:** без UI и без изменения существующей матрицы
(роли остаются единственным активным механизмом назначения).

**Return Point:** Step 3.12E (Organization Capability & Navigation Access
Model) + Step 3.13 (Users & Access Center UI).

------------------------------------------------------------------------

## DD-022 --- Availability Reservation / Locking Owner & Contract

**Status:** DECIDED

**Decision (Step 2.4):** владелец capacity hold — **Catalog** (owner of
`catalog.Availability`). Новый `AvailabilityReservation` (catalog.*, статусы
HELD/RELEASED, код `RSR-*`) — capacity hold в рамках canonical owner
contract (ADR-0001: Sales вызывает **owner service**, не пишет в catalog.*
напрямую). Команда `CatalogService.reserveAvailability(tx, ...)` выполняет
**атомарный conditional UPDATE** (`available >= requested` → декремент) и
создаёт reservation-строку в **одной** PostgreSQL-транзакции вместе с
персистом Sale (CLOSED) + history + outbox-event (честный atomic last-slot,
capacity никогда не уходит в минус). Каждый Sale-hold привязан к конкретному
item (productId/tariffId/date/quantity); `OrderRequested` несёт id резервации
(без FK, canonical ref) — release/expiry/cleanup — граница Step 2.5/2.8A
(Order consumer / Booking), здесь hold остаётся HELD после публикации.

**Superseded (Step 2.3A read-only):** `CHECKED_NOT_RESERVED` остаётся
семантикой для CheckoutIntent (чтение без hold); hold вводится только на
финальном шаге Sale completion (2.4).

**Deferred remainder:** server-owned TTL/expiry job, partial unique index
(один активный hold на item), release-команда и cleanup — Step 2.5 (Order
Creation Consumer) / Step 2.8A (Booking service date/time, capacity/slot).

**Return Point:** Step 2.5 (Order Creation Consumer — release на ошибке
order creation) / Step 2.8A (Booking capacity/slot reservation).

------------------------------------------------------------------------

## DD-023 --- Canonical Product Options Model & Option Pricing

**Status:** DEFERRED

**Already Decided (Step 2.3A):** каноническая catalog options entity
(selectable priced options: экскурсии, доп. услуги, страховки и т.п.)
отсутствует. Roadmap 2.3A упоминает options в checkout context, но invent
arbitrary JSON options или выдумывать option pricing запрещено (Step 2.3A
§21/§22). CheckoutIntent опции НЕ вводит; попытка передать `options` в
запросе → явный 422 (forbidden key), не молчаливый ignore. Client может
передавать только canonical option IDs с server-resolved pricing — когда
такая модель появится.

**Still Open:** Catalog-owned options entity (тип/цена/доступность),
Category Schema option definitions, option price authority (Decimal(12,2),
half-up), snapshot option selection в Checkout/Quote, capacity для опций.

**Do Not Implement Yet:** options в CheckoutIntent/Quote до появления
canonical Catalog options модели.

**Return Point:** Step 2.7/3.31 (Marketplace Checkout composition) при
наличии канонической options-модели в Catalog.

------------------------------------------------------------------------

## DD-024 --- Rate Plan vs Existing Tariff (Canonical Commercial Variant)

**Status:** DEFERRED

**Already Decided (existing model):** `catalog.Tariff` — name/price/
currency/validFrom/validTo, привязан к Product; `Availability` — на
(productId, tariffId, date); QuoteItem снэпшотит tariff
(price/currency/name); OrderItem хранит productId/code (без tariff ref);
Step 2.4 — AvailabilityReservation per (productId, tariffId, date,
quantity), один hold на item.

**Evidence (STRICT REVIEW):** матрица «Tariff vs RatePlan»:
identity/code — Tariff имеет `id` + canonical `TRF-*` (code unique);
Product relation — `productId` (Cascade); ownership — Catalog;
name — да; price/currency — `Decimal(12,2)` + `currency`;
validFrom/validTo — да (семантика: sales/booking price validity window,
см. `SalesService.resolveEligibleTariff`: validFrom>now → не активен,
validTo<now → expired; НЕ service/stay period); meal plan / refundability /
cancellation policy / included services / restrictions / price basis /
occupancy — **отсутствуют** (нужно расширение); availability relation —
`Availability` unique (productId, tariffId, date) и
`AvailabilityReservation` per (productId, tariffId, date, quantity) —
Tariff уже ключ availability; lifecycle — версионность
(`version`), без статусного lifecycle; history/audit — НЕ является
владельцем отдельного history-журнала.

**Verdict (STRICT REVIEW): вариант A** — Tariff уже является
каноническим коммерческим вариантом (identity, price, currency,
validity, availability-ключ): расширять (meal plan/refundability/
cancellation ref/included services/restrictions/price basis/occupancy),
НЕ вводить параллельную RatePlan-сущность с пересекающейся authority.
Только если расширение Tariff окажется невозможным (нет evidence),
вернуться к вопросу. Пересечение authorities Tariff+RatePlan запрещено
(Roadmap must never permit overlapping authorities).

**Still Open (Roadmap Amendment §28/§29 Q1):** финальная форма расширения
Tariff (колонки vs child-таблица vs JSON-контракт), price basis модель,
категорийные расширения.

**Do Not Implement Yet:** Rate Plan сущность, периодная привязка,
price basis enum.

**Return Point:** Step 1.8B (Rate Plan / Commercial Variant Foundation).

**Resolution trigger:** решение подтверждается при implementation-design
Step 1.8B (зафиксировано в Roadmap §1.8B: «если Tariff — правильный
owner, extend»).

------------------------------------------------------------------------

## DD-025 --- Seller Commercial Unit Identity & CategorySchema Nesting

**Status:** DEFERRED

**Evidence (STRICT REVIEW):** `CategorySchema` — это schema **атрибутов
Product**: плоский `attributes` Json (`[{key,label,type,required,
searchable,filterable,options?,min?,max?,pattern?}]`), валидируемый
против конкретного Product (`validateAttributes`), + конфиг-блоки
(availability/tariffRules/mediaRequirements/pdpSections), версии
DRAFT→ACTIVE→DEPRECATED. **Nesting/repeatable Seller commercial units
(Hotel → Rooms) НЕ моделируется**: нет unit-уровневого identity,
lifecycle, собственных атрибутов единицы, запросов «все Rooms отеля».
Повторяемый JSON внутри attributes — НЕ достаточен для стабильной
identity/lifecycle/availability-relation.

**Still Open (Roadmap Amendment §29 Q2-Q3):** нужен ли first-class
Seller commercial unit (Room/service-unit) как отдельная Catalog-
сущность с identity/code/lifecycle (не Product, не attributes-JSON);
если да — расширение CategorySchema НЕдостаточно →
`ARCHITECTURE DECISION REQUIRED` при Step 1.8A implementation-design
(зафиксировано в Roadmap §1.8A). Нормализованные unit-атрибуты
(view/maxAdults/area/...) без замены исходного Seller-названия
(invariant: names preserved verbatim). Для импорта: unit-сущность
обязана иметь **стабильный source/external ID** (source + externalKey),
чтобы повторные импорты reconcile-ились, а не дублировали единицы
(§26 review).

**Do Not Implement Yet:** Room/unit entity, nesting в CategorySchema,
unit-level attributes.

**Return Point:** Step 1.8A (Service Template / Seller Commercial
Structure Foundation).

**Resolution trigger:** при implementation-design Step 1.8A; если
CategorySchema-расширение признано недостаточным — оформляется ADR до
реализации.

------------------------------------------------------------------------

## DD-026 --- Commercial Period Temporal Semantics, Price Basis & Occupancy

**Status:** DEFERRED

**Still Open (Roadmap Amendment §13-15/§29 Q4, Q6-Q9):** к чему крепятся
commercial periods (Tariff? Product variant? другая Catalog-owned
сущность); sales validity period vs service/stay period vs booking
window — раздельные концепции (не конвейерить молча; evidence:
`Tariff.validFrom/validTo` = price/booking validity window, НЕ
service/stay period); price basis модель (per room/night, per person,
per package, per vehicle, per service, per group — category-
appropriate); **occupancy/PAX влияет на price identity, а не только на
filtering** (single/double/triple/2A+1C/child age bands могут менять
базовую цену, а не быть просто атрибутом); overlap-резолюция
overlapping periods — детерминированная server-side (никаких двух
равнозначно-authoritative активных цен с недетерминированным выбором);
server precedence base period vs date override — явный детерминированный
порядок.

**Do Not Implement Yet:** period entity, price basis, occupancy matrix.

**Return Point:** Steps 1.8B/1.8C (Rate Plan / Period Pricing &
Availability Foundation).

**Resolution trigger:** перед implementation-design Step 1.8C (period
pricing/availability), чтобы schema не зафиксировала конвейерация
концепций.

------------------------------------------------------------------------

## DD-027 --- Period Availability Granularity & Multi-Date Holds

**Status:** DEFERRED

**Still Open (Roadmap Amendment §17/§32):** category-dependent
availability granularity (date / date range / departure / time slot /
open date) — reconcile с существующими `DATE_ONLY`/`TIME_SLOT`/
`DATE_RANGE`/`OPEN_DATE` концепциями; multi-date hotel stays —
атомарная резервация ВСЕХ дат (last-slot invariant Step 2.4:
conditional UPDATE, capacity никогда в минус; две конкурирующие
покупки последней единицы не могут обе зарезервировать); base period vs
date override precedence.

**Contract impact (STRICT REVIEW, future-compat):** текущий Step 2.4/2.5
контракт — `AvailabilityReservation` per (productId, tariffId, date),
ОДИН hold на commercial item; `OrderRequested.reservationIds` =
все holds, consumer валидирует `reservationIds.length === items.length`.
Multi-date stay (1 коммерческий item → N ночей) создаст N holds →
`reservationIds.length ≠ items.length` — контракт 2.4/2.5 должен быть
ревизован при введении multi-date периодов (Step 1.8C): cardinality
hold-ов = «все allocated units/dates», НЕ «число items»; детализация —
Step 1.8C implementation. Это НЕ дефект текущего Step 2.5 (он APPROVED
для one-hold-per-item), а документированная future compatibility
migration.

**Do Not Implement Yet:** period availability entity, multi-date hold
логика.

**Return Point:** Step 1.8C (Period Pricing & Period Availability
Foundation) + Step 2.8A.

**Resolution trigger:** перед implementation-design Step 1.8C; схема
multi-date hold согласуется с 2.4/2.5 contract change.

------------------------------------------------------------------------

## DD-028 --- Normalized Taxonomy Ownership (Catalog dictionaries)

**Status:** DEFERRED

**Already Decided (existing model):** `CategorySchema` (catalog.*) уже
владеет category-specific attribute definitions (options/enums/validation
в schema). Step 2.2A (Reverse Marketplace) использует extensible service
taxonomy (Accommodation/Tours/Transport/Activities) для matching — НО это
потребление, не владение.

**Still Open (Roadmap Amendment §23/§17):** кто владеет normalized
dictionaries (meal plan, bed type, view, amenities, service class,
vehicle class) и кто их модифицирует. Кандидат-owner — **Catalog**
(категорийные schema-контракты уже там; ADR-0005: Catalog владеет
public seller projection). Reverse Marketplace потребляет taxonomy для
matching, но НЕ становится владельцем (не расширять права 2.2A на
запись чужих словарей). Без controlled global enums для маркетинговых
терминов; taxonomy extensible; source/original + normalized value.

**Do Not Implement Yet:** словарные сущности/CRUD, taxonomy admin UI.

**Return Point:** Step 1.8A (Service Template) / Step 2.2A
(consumption contract).

**Resolution trigger:** перед implementation-design Step 1.8A (чтобы
schema не создала второй словарь в другом домене).

------------------------------------------------------------------------

## DD-029 --- Marketplace "from N" Multi-Currency Display Rule

**Status:** DEFERRED

**Still Open (Roadmap Amendment §19/§23):** period/date-aware «from N
USD» на Card/search/PDP — server-derived из действующих authoritative
commercial periods. Критично: **нельзя численно сравнивать `100 USD` и
`90 EUR` без FX/display-price правила** (нет FX-домена). Либо
same-currency выбор (минимум в валюте Buyer-а, если цена существует в
этой валюте), либо явное deferred FX-нормализация — но правило обязано
быть детерминированным и server-side.

**Already Decided (Step 2.3):** один Quote/Checkout — одна валюта
(mixed currency → 422); привязка цены — в валюте tariff.

**Do Not Implement Yet:** FX engine, конвертация, «from»-логика в
frontend.

**Return Point:** Step 1.8C (period pricing) + Marketplace display
step (period-aware price display).

**Resolution trigger:** перед period-aware Marketplace display
(после 1.8C backend); до FX-домена — same-currency правило.

------------------------------------------------------------------------

## DD-030 --- Reverse Marketplace: Proposal → Sales conversion point

**Status:** DEFERRED (ADR-0012 §5/§14)

**Still Open (ADR-0012):** в какой canonical Sales stage конвертируется
принятый Seller Proposal — Lead vs Opportunity vs Quote (или иной
существующий stage). ADR-0012 фиксирует границы reverse.* и инвариант
«Distribution ≠ Lead creation» (6 meaningful-engagement ответов НЕ
создают 70/25 Leads), но сам conversion point сознательно НЕ
резолвится в ADR: он должен быть решён отдельным Proposal→Sales
architecture decision ДО Step 2.2F (gate DD-030).

**Already Decided (ADR-0012):** reverse.* — отдельный bounded context
без параллельного pipeline; Seller Proposal переходит в canonical Sales
ТОЛЬКО через согласованный conversion point; 2.2A–2.2E реализуемы без
premature conversion-решения; никакой дублирующей модели конверсии в
reverse.*.

**Do Not Implement Yet:** Proposal→Sales конверсия, Lead/Opportunity/
Quote автосоздание из BuyerRequest/Proposal, конверсионные метрики.

**Return Point:** Step 2.2F (Seller Proposal → Canonical Sales
Conversion).

**Resolution trigger:** отдельный архитектурный decision ДО начала
2.2F; реконсиляция с существующими Sales-стадиями (Lead/Opportunity/
Quote), а не изобретение дублирующей модели.

------------------------------------------------------------------------

# Правило пополнения

1.  Новый отложенный вопрос → следующий `DD-XXX`.
2.  Если вопрос уже покрыт записью → обновляется существующий DD.
3.  Если вопрос блокирует текущий Step → `DEFERRED → IN_REVIEW`.
4.  После решения запись не удаляется → `DECIDED` + ссылка на
    ADR/Step/contract + дата.
5.  Если решение заменено → `SUPERSEDED` + ссылка на новое решение.

# Приоритет документов

1.  Утверждённые ADR / Architecture contracts.
2.  Canonical Implementation Roadmap.
3.  Deferred Decisions Map для сознательно нерешённых вопросов.
4.  Implementation prompts конкретных Step.

Deferred Decisions Map не отменяет действующий ADR.

# Current Register State

-   Total: **30**
-   DEFERRED: **29**
-   IN_REVIEW: **0**
-   DECIDED: **1**
-   SUPERSEDED: **0**
-   Next ID: **DD-031**

------------------------------------------------------------------------

**END OF TRAVELHUB DEFERRED DECISIONS MAP**
