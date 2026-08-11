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

**Status:** DECIDED (2026-08-11, Service Templates decision gates)

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

**Final Decision (2026-08-11):** **A — Tariff IS канонический Rate Plan, расширять**
(подтверждено). Параллельная RatePlan-сущность ЗАПРЕЩЕНА (пересекающиеся
authorities). 1.8B расширяет `catalog.Tariff`: meal plan, refundability,
`cancellationPolicyId` ref (политика — отдельный owner), included services,
restrictions, `priceBasis`, occupancy/PAX applicability; сохраняются
identity/`TRF-*`, price/currency, validity window (price/booking window, НЕ
stay period), роль ключа Availability, version/CAS. Полное обоснование —
`docs/architecture/service-templates-decision-gates.md` §2.

------------------------------------------------------------------------

## DD-025 --- Seller Commercial Unit Identity & CategorySchema Nesting

**Status:** DECIDED (2026-08-11, Service Templates decision gates)

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

**Final Decision (2026-08-11):** **B — требуется НОВАЯ Catalog-owned сущность
`ServiceUnit`/`SellerCommercialUnit`** (categorySchema-шаблон НЕ может дать
unit-уровневую identity/lifecycle/availability-relation: `attributes` — плоский
JSON, конфиг-блоки — одиночные JSON). Единица живёт в catalog.* (тот же
bounded context, что Product/Tariff) → **ADR НЕ требуется** (ADR-0001 покрывает;
ADR лишь если 1.8A докажет невозможность проживания в catalog.*). Identity +
канонический code-prefix регистрируется при 1.8A; `source + externalKey` для
import-reconcile; имя Seller-а verbatim; normalized unit-attributes из шаблона.
Полное обоснование — `docs/architecture/service-templates-decision-gates.md` §1.

------------------------------------------------------------------------

## DD-026 --- Commercial Period Temporal Semantics, Price Basis & Occupancy

**Status:** DECIDED (2026-08-11, Service Templates decision gates)

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

**Final Decision (2026-08-11):** периодная сущность `CommercialPeriod`
(catalog.*, ключ tariffId + [validFrom,validTo] date-only inclusive, price,
currency, basis); разделение source (MANUAL/IMPORT/API_SUPPLIER/
CHANNEL_MANAGER/future DYNAMIC_RULE) vs rule (FIXED/PERIOD/DATE_OVERRIDE/
DAY_OF_WEEK/OCCUPANCY/PAX/AGE_BAND/DURATION/ROUTE/PACKAGE/PRICE_ON_REQUEST);
price basis на уровне Tariff (PER_UNIT/PER_ROOM/PER_PERSON/PER_NIGHT/PER_DAY/
PER_HOUR/PER_TRIP/PACKAGE_TOTAL); occupancy/PAX/age/duration/route —
price-identity-измерения (category-configurable, не frozen глобально);
детерминированная precedence: DATE_OVERRIDE > явный PERIOD (уже диапазон
выигрывает) > DAY_OF_WEEK > сезон/base PERIOD > FIXED; overlapping
same-priority PERIOD-ы — запрещены на write (422); missing price — не
фабрикуется (unavailable для binding или PRICE_ON_REQUEST); 1.8C — date-only
(Step 2.8A gate сохраняется). Полное обоснование —
`docs/architecture/service-templates-decision-gates.md` §3.

------------------------------------------------------------------------

## DD-027 --- Period Availability Granularity & Multi-Date Holds

**Status:** DECIDED (2026-08-11, Service Templates decision gates)

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

**Final Decision (2026-08-11):** **A — существующие Availability +
AvailabilityReservation расширяются/переиспользуются** для атомарных
multi-date hold-ов: N ночей → N reservation-строк (по дате) в ОДНОЙ
PostgreSQL-транзакции через существующий conditional-UPDATE механизм
(CatalogService.reserveAvailability; любой failure → полный rollback, без
partial holds). Второй hold engine не вводится. Контракт
`OrderRequested.reservationIds.length === items.length` (Step 2.5, один hold на
item) ревизуется при 1.8C: cardinality = «все allocated units/dates» (НЕ
дефект APPROVED Step 2.5; `Order.reservationIds` Json уже хранит все holds).
Granularity: DATE_ONLY безопасна для 1.8C; TIME_SLOT/DEPARTURE — гейт 2.8A.
Inventory unit — category-dependent (rooms/seats/vehicles/units), НЕ всегда
«people». Price ≠ Availability (независимые состояния; stop-sell ≠ удаление
цены). Полное обоснование — `docs/architecture/service-templates-decision-gates.md` §4.

------------------------------------------------------------------------

## DD-028 --- Normalized Taxonomy Ownership (Catalog dictionaries)

**Status:** DECIDED (2026-08-11, Service Templates decision gates)

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

**Final Decision (2026-08-11):** owner нормализованных коммерческих словарей
(meal plan, bed type, view, amenities, service class, vehicle class) —
**Catalog** (CategorySchema/template — платформенные определения). Reverse
Marketplace (2.2A) ЧИТАЕТ normalized attributes/capabilities для matching,
НЕ владеет (без прав записи чужих словарей). Без duplicated taxonomy per UI;
без controlled global enums для маркетинговых терминов;
source/original + normalized value сохраняется; taxonomy extensible. Полное
обоснование — `docs/architecture/service-templates-decision-gates.md` §5.

------------------------------------------------------------------------

## DD-029 --- Marketplace "from N" Multi-Currency Display Rule

**Status:** DECIDED (2026-08-11, Service Templates decision gates)

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

**Final Decision (2026-08-11):** каждая period price row несёт явную валюту;
**одна валюта на Rate Plan/Tariff**; binding authority неизменен (Quote/
Checkout/Sale биндят в валюте tariff/period). Marketplace display —
**same-currency «from N» правило** (минимум в display/buyer-валюте только если
цена существует в этой валюте); cross-currency сравнение запрещено до
канонического FX-домена. FX engine НЕ реализуется (deferred); display-
конверсия (когда появится) — display-only, НЕ мутирует binding price
(`display conversion ≠ binding commercial price mutation`). 1.8B/1.8C
продолжают с single-currency-per-RatePlan. Полное обоснование —
`docs/architecture/service-templates-decision-gates.md` §6.

------------------------------------------------------------------------

## DD-030 --- Reverse Marketplace: Proposal → Sales conversion point

**Status:** DECIDED (2026-08-11) — `Opportunity` (OPP-*) — `docs/prompts/DD-030_PROPOSAL_TO_CANONICAL_SALES_CONVERSION_POINT_ARCHITECTURE_DECISION.md`

**Decision (2026-08-11, репозиторная истина sales.*):**

Выбранная каноническая точка конвертации принятого Seller Proposal —
**`Opportunity` (`OPP-*`, sales.*)**. Канонический путь:

`BuyerRequest (SUBMITTED) → selected SellerProposal (SUBMITTED) →
Opportunity (NEW) → Quote (DRAFT → ISSUED) → CheckoutIntent → Sale →
OrderRequested → Order → Booking → Finance`

**Почему Opportunity (repository-backed):**

- `Opportunity.leadId` nullable — Opportunity может существовать БЕЗ
  Lead (`createOpportunity` принимает title без leadId);
- Opportunity НЕ требует Product/Tariff (поля: title, customerId,
  assignedToId; статус NEW→OPEN→WON/LOST) — совместимо с Proposal,
  который может существовать без опубликованного Product
  (capability ≠ inventory);
- Opportunity — первый Sales-owned «qualified deal» после выбора
  Buyer-ом одного Seller-а; формальный binding Quote создаётся Sales-ом
  позже из trusted/revalidated фактов (Proposal остаётся non-binding);
- Acquisition source `BUYER_REQUEST` уже зарегистрирован в
  `SalesAcquisitionSource` (Step 2.5B) и валидатор Order consumer-а
  принимает его; CheckoutIntent в 2.2F будет получать server-derived
  `BUYER_REQUEST` (gap текущей реализации: сейчас hardcoded DIRECT).

**Почему Lead отклонён:** BuyerRequest уже является acquired demand
record (инвариант 3: BuyerRequest ≠ Lead). Lead — необработанный
интерес до квалификации; создание Lead после выбора Proposal
дублирует demand-сущность и откатывает уже Seller-specific qualified
journey назад в воронку (Lead duplication test FAIL).

**Почему Quote отклонён как первая точка:** Quote.ISSUE невозможен без
QuoteItem, а QuoteItem требует productId+tariffId+unitPrice из Catalog
Tariff (`resolveEligibleTariff`). Proposal может существовать без
Product → прямой Proposal→Quote создал бы shadow Product/pricing
authority; кроме того, Proposal money — non-binding индикация, и
прямая конвертация неправомерно возвела бы её в binding authority
(инвариант Proposal ≠ canonical Quote). Quote остаётся ВТОРЫМ шагом
после Opportunity (Direct Quote skip test PASS — не выбран).

**Proposal selection ownership:** selection — факт reverse.*
(BuyerRequest/Proposal — reverse-owned); conversion-команда пересекает
boundary в Sales через OWNER service (Sales создаёт Opportunity;
Reverse не пишет sales.*; Sales не пишет reverse.*; Prisma не hidden
cross-domain writer).

**Binding commercial authority:** начинается в canonical Quote
(ISSUE — frozen totals) и CheckoutIntent (server-copied, immutable);
Proposal amount — не-binding, никогда не становится молчаливой ценой
Quote/Sale.

**Idempotency/cardinality invariant (для 2.2F):** один selected
Proposal → максимум один канонический Sales-path; только selected
Proposal может инициировать конверсию; non-selected Proposals остаются
историей; matching/submission не fan-out-ят Sales entities; reselection
и retry — idempotent на уровне DB/domain (Opportunity с уникальным ref
на Proposal).

**Provenance (требование к 2.2F):** canonical Sales обязан сохранять
buyerRequestId, proposalId, sellerId (partner), acquisitionSource
(BUYER_REQUEST), correlation/causation. Текущая схема Opportunity НЕ
содержит этих refs → аддитивные поля/refs документируются как
implementation implications Step 2.2F (runtime schema НЕ изменяется
этим решением).

**Contact disclosure:** конверсия НЕ меняет disclosure policy
(MATCHED ≠ CONTACT DISCLOSED; CHAT EXISTS ≠ CONTACT DISCLOSED —
остаются true). PublicSellerProfile — presentation, не commercial
authority.

**Eventing:** отдельные события (ProposalSelected/Converted/Opportunity-
Created/QuoteCreated) НЕ добавляются без реального consumer-а;
прямая owner-service orchestration (модульный монолит) достаточна.

**Already Decided (ADR-0012):** reverse.* — отдельный bounded context
без параллельного pipeline; Seller Proposal переходит в canonical Sales
ТОЛЬКО через согласованный conversion point; 2.2A–2.2E реализуемы без
premature conversion-решения; никакой дублирующей модели конверсии в
reverse.*.

**Do Not Implement Yet:** Proposal→Sales конверсия, Lead/Opportunity/
Quote автосоздание из BuyerRequest/Proposal, конверсионные метрики,
contact disclosure.

**Return Point:** Step 2.2F (Seller Proposal → Canonical Sales
Conversion) — конверсия в Opportunity (gate DD-030 разрешён).

**Resolution trigger:** РАЗРЕШЁН 2026-08-11 отдельным архитектурным
решением (см. документ выше); реконсиляция с существующими
Sales-стадиями (Opportunity), без дублирующей модели.

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
-   DEFERRED: **22**
-   IN_REVIEW: **0**
-   DECIDED: **8** (DD-022, DD-024, DD-025, DD-026, DD-027, DD-028, DD-029, DD-030)
-   SUPERSEDED: **0**
-   Next ID: **DD-031**

------------------------------------------------------------------------

**END OF TRAVELHUB DEFERRED DECISIONS MAP**
