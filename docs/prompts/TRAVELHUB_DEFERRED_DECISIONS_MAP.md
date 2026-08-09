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

-   Total: **20**
-   DEFERRED: **20**
-   IN_REVIEW: **0**
-   DECIDED: **0**
-   SUPERSEDED: **0**
-   Next ID: **DD-021**

------------------------------------------------------------------------

**END OF TRAVELHUB DEFERRED DECISIONS MAP**
