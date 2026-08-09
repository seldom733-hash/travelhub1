# TravelHub --- PHASE 1 / STEP 1.12

# PARTNER STOREFRONT FOUNDATION

**Назначение документа:** готовое техническое задание / implementation
prompt для разработчика.\
**Предыдущий шаг:** PHASE 1 STEP 1.11 --- APPROVED.\
**Следующий канонический шаг:** PHASE 1 STEP 1.12 --- Partner Storefront
Foundation.\
**Обязательные подшаги в scope:** Step 1.12A, Step 1.12B, Step 1.12C.\
**Не переходить к Step 1.13 и Phase 2 до review/approval этого шага.**

------------------------------------------------------------------------

## 0. ОБЯЗАТЕЛЬНЫЙ РЕЖИМ РАБОТЫ

Перед реализацией:

1.  Изучи фактическое текущее состояние backend/frontend, Prisma schema,
    migrations, RBAC, Catalog, Public Catalog, Partner Cabinet, Partner
    Onboarding, PublicSellerProfile, moderation, public routing, i18n,
    AuditLog, Outbox/domain events и тестовую инфраструктуру.
2.  Не исходи только из этого задания --- сначала сопоставь его с
    реально существующим кодом.
3.  Не ломай и не переписывай уже утверждённые Step 1.0--1.11.
4.  Не удаляй существующую бизнес-логику, если это прямо не требуется
    данным Step.
5.  Не создавай второй Product, отдельную storefront-копию Product или
    параллельный каталог.
6.  Не начинай Checkout, Order, Booking, Payment/PSP, Settlement/Payout,
    Finance или Phase 2 commercial flow.
7.  Не меняй dev/prod данные вручную для прохождения тестов. Все
    destructive/e2e операции --- только в изолированной test DB/test
    storage.
8.  Не добавляй скрытые startup backfill/reconciliation. Legacy repair,
    если объективно нужен, --- только явная idempotent repair command с
    dry-run/report/audit.
9.  Если фактическая архитектура проекта конфликтует с этим заданием и
    решение требует изменения domain ownership, cross-domain write, ID
    policy, security boundary или уже принятого ADR --- остановись до
    конфликтующей реализации и выдай:

`ARCHITECTURE DECISION REQUIRED`

с точным описанием проблемы, вариантами и рекомендацией.

Перед изменениями покажи краткий **Current State → Target State
implementation plan**.

------------------------------------------------------------------------

# 1. ЦЕЛЬ STEP 1.12

Дать одобренному PARTNER возможность получить публичную персональную
витрину на инфраструктуре TravelHub, которая визуально и функционально
может использоваться как простой собственный сайт малобюджетного
турагентства/поставщика услуг.

Storefront должен:

-   показывать только продукты конкретного PARTNER;
-   использовать те же canonical `Catalog.Product`, что и общий
    Marketplace;
-   не создавать копии Product;
-   использовать только опубликованные и публично допустимые версии
    Product/media;
-   иметь собственный branding/presentation layer;
-   поддерживать RU/AZ/EN;
-   иметь стабильный публичный URL;
-   быть пригодным для будущего subdomain/custom domain;
-   различать продажи/трафик Marketplace и Storefront уже на уровне
    foundation;
-   не раскрывать private CRM Partner data;
-   соблюдать anti-disintermediation/security policy;
-   не реализовывать пока сам коммерческий Checkout/Payment flow.

Ключевой принцип:

**One Product → multiple presentation/sales channels.**

`Catalog.Product` остаётся единственным источником истины услуги.

------------------------------------------------------------------------

# 2. НЕИЗМЕНЯЕМЫЕ АРХИТЕКТУРНЫЕ ГРАНИЦЫ

## 2.1 Catalog ownership

Catalog владеет:

-   Product;
-   ProductMedia;
-   Category/CategorySchema;
-   ProductDraft/change proposal;
-   PublicSellerProfile;
-   storefront presentation configuration, если после анализа не выявлен
    уже существующий более подходящий owner.

CRM Partner НЕ становится public storefront DTO.

Storefront не должен напрямую сериализовать `crm.Partner`.

## 2.2 Public Seller Identity

Step 1.11 остаётся обязательным.

Marketplace и Storefront не должны автоматически публиковать:

-   email;
-   phone;
-   WhatsApp/Telegram;
-   website;
-   social links;
-   legal/tax identifiers;
-   CRM notes;
-   точный private address;
-   внутренние CRM identifiers.

`PublicSellerProfile` остаётся seller-safe identity projection.

Storefront disclosure рассматривается отдельно в Step 1.12B и не
означает автоматическое раскрытие CRM Partner.

## 2.3 Moderation

Storefront не является способом обхода moderation.

Публично отображаются только:

-   `Product.status = PUBLISHED`;
-   approved published version;
-   `ProductMedia.status = PUBLISHED`;
-   разрешённая seller identity;
-   approved storefront configuration, если moderation для отдельных
    storefront fields требуется текущей policy.

ProductDraft N+1, staged media и unapproved seller/profile data не
должны утекать.

## 2.4 Public/Internal API boundary

Public Storefront должен использовать отдельный public read-contract.

Он НЕ должен вызывать:

-   internal `/products`;
-   Partner Cabinet API;
-   CRM API;
-   moderation API;
-   internal Category Schema API.

Даже если посетитель авторизован и браузер содержит JWT/token, public
storefront requests не должны превращаться во внутренние authenticated
Catalog requests.

------------------------------------------------------------------------

# 3. STORE­FRONT DOMAIN MODEL / DATA MODEL

Сначала проверь существующую schema. Не создавай сущность только ради
названия, если эквивалент уже существует.

Целевая концепция --- **одна storefront-конфигурация на Partner**.

Предпочтительная модель:

`PartnerStorefront`

Минимальные поля/семантика:

-   `id` --- внутренний immutable ID;
-   `partnerId` --- unique reference на Partner;
-   `slug` --- публичный стабильный unique slug;
-   `status` --- lifecycle storefront;
-   `displayName`;
-   `tagline` nullable;
-   `description` nullable;
-   `logoMediaId`/safe branding asset reference nullable;
-   `heroMediaId`/safe branding asset reference nullable;
-   `theme/config` --- только если действительно нужен foundation; не
    строить page-builder;
-   `defaultLocale` --- RU/AZ/EN;
-   `createdAt`;
-   `updatedAt`;
-   `publishedAt` nullable;
-   `disabledAt` nullable;
-   version/revision --- если необходимо для безопасного редактирования.

Не хранить в storefront:

-   копии Product;
-   Product price snapshot;
-   Booking;
-   Order;
-   Payment;
-   CRM contacts;
-   bank/payout data.

### Lifecycle

Минимально определить безопасный lifecycle, например:

`DRAFT → ACTIVE → SUSPENDED`

или другой эквивалент, согласованный с текущими lifecycle conventions.

Обязательно:

-   storefront не становится публичным только потому, что Partner
    существует;
-   pending/unapproved PARTNER не может активировать storefront;
-   deactivated/suspended Partner/storefront не должен публично
    отображаться;
-   повторные операции должны быть идемпотентны там, где это уместно;
-   lifecycle transitions должны иметь business
    timestamps/history/audit.

Если для storefront branding нужен moderation lifecycle, не придумывай
параллельный универсальный moderation engine без необходимости.
Используй существующие patterns либо зафиксируй ограниченный workflow.

------------------------------------------------------------------------

# 4. STORE­FRONT CREATION POLICY

Storefront доступен только:

-   authenticated PARTNER;
-   с валидным `partnerId`;
-   после approved onboarding;
-   при ACTIVE Partner/User согласно существующим security rules.

Определи один канонический способ provisioning.

Предпочтительно:

-   Partner явно нажимает «Создать витрину»;
-   backend создаёт storefront idempotently;
-   никаких массовых startup backfill.

Если продуктовые требования/существующая архитектура явно делают
event-driven provisioning лучше --- покажи это в implementation plan. Не
добавляй скрытый reconciliation.

Legacy PARTNER без storefront не является ошибкой: storefront ---
optional capability.

------------------------------------------------------------------------

# 5. PUBLIC ROUTING

Foundation URL:

`/store/:slug`

Нужны как минимум:

-   `/store/:slug` --- storefront home;
-   `/store/:slug/products/:productSlug` --- storefront product page
    либо безопасная storefront-aware ссылка на canonical PDP.

Предпочтительно storefront product route сохраняет storefront context,
чтобы будущие attribution/checkout могли определить канал.

Не вводить custom domains сейчас.

Не вводить production subdomains сейчас.

Но routing/data model должны позволять позже добавить:

-   `partner.travelhub.com`;
-   `www.partner.az`.

Не зашивать бизнес-логику в предположение, что storefront всегда
находится только под `/store/`.

------------------------------------------------------------------------

# 6. PUBLIC STOREFRONT READ CONTRACT

Создай отдельный provider-independent public contract.

Примерно:

`GET /api/v1/public/storefronts/:slug`

Возвращает только public-safe storefront presentation:

-   public storefront ID;
-   slug;
-   displayName;
-   tagline/description;
-   branding media stable URLs;
-   locale/config;
-   public seller projection при необходимости;
-   category/navigation summary, если нужно;
-   никаких CRM/private/internal fields.

Продукты:

`GET /api/v1/public/storefronts/:slug/products`

Server-side:

-   только продукты владельца storefront;
-   только `PUBLISHED`;
-   только public published media;
-   pagination;
-   q/search при необходимости;
-   category;
-   sort;
-   total.

Не копируй Product Card DTO без необходимости --- переиспользуй safe
mapper/contract Step 1.5 там, где семантика совпадает.

Detail:

`GET /api/v1/public/storefronts/:slug/products/:productSlug`

Должен гарантировать:

-   Product принадлежит именно storefront Partner;
-   Product public/published;
-   neutral 404 для чужого/draft/archived/non-public Product;
-   никакой утечки факта существования private Product.

Public media delivery --- использовать stable media contract Step 1.5,
не возвращать raw storage keys/signed S3 URL в storefront JSON.

------------------------------------------------------------------------

# 7. PARTNER MANAGEMENT API

Добавь own-scope API для Partner.

Примерный contract:

-   `GET /api/v1/partner/storefront`
-   `POST /api/v1/partner/storefront`
-   `PATCH /api/v1/partner/storefront`
-   `POST /api/v1/partner/storefront/activate`
-   `POST /api/v1/partner/storefront/deactivate` / suspend equivalent

Названия адаптировать к существующим conventions.

Обязательные правила:

-   Partner видит/меняет только свой storefront;
-   `partnerId` берётся из actor context, не из frontend;
-   forged `partnerId`, seller IDs, owner IDs → reject/ignore согласно
    общей forbidden-field policy;
-   IDOR tests обязательны;
-   BUYER → deny;
-   MODERATOR/internal role не должен случайно получить Partner-own
    write через широкое permission;
-   ADMIN capabilities должны быть явно определены, а не возникать
    случайно.

------------------------------------------------------------------------

# 8. BRANDING

Foundation branding:

-   display name;
-   logo;
-   hero/banner;
-   short tagline;
-   description;
-   optional simple theme settings только если это не превращается в
    page builder.

Не реализовывать сейчас:

-   drag-and-drop constructor;
-   arbitrary HTML;
-   arbitrary JS;
-   arbitrary CSS;
-   arbitrary external embeds.

Branding assets должны идти через controlled media/storage path.

Никаких произвольных внешних image URL.

Для uploaded storefront media:

-   private-by-default storage;
-   validation MIME/size;
-   safe derivatives;
-   stable public delivery;
-   no storage-key leakage;
-   ownership checks.

Если текущий ProductMedia нельзя корректно переиспользовать для
storefront branding без нарушения ownership/semantics --- создай
отдельную storefront media model, но объясни решение.

------------------------------------------------------------------------

# 9. STEP 1.12A --- STOREFRONT SALES CHANNEL FOUNDATION

Это обязательная часть Step 1.12.

Ввести каноническое понятие **sales/discovery channel**, минимум:

-   `MARKETPLACE`
-   `PARTNER_STOREFRONT`

Архитектура должна быть расширяема позже:

-   `PARTNER_CUSTOM_DOMAIN`
-   `API`
-   `MANUAL`

На Step 1.12 НЕЛЬЗЯ реализовывать Order/Booking/Payment только ради
channel.

Нужно создать foundation, чтобы будущий коммерческий flow мог принять
authoritative channel context.

### Требование

Когда пользователь находится на `/store/:slug` и взаимодействует с
Product, система должна иметь стабильный storefront/channel context.

Не определять channel постфактум из referer.

Не считать URL единственным источником бизнес-атрибуции.

Подготовить canonical type/contract, который позже сможет пройти:

`Entry → Checkout → Sale → Order → Booking → Payment → Settlement → Analytics`

без изменения значения.

Если пока нет сущности Checkout/Sale --- channel фиксируется в
storefront behavioral context/event и в будущем должен передаваться
explicit input в коммерческий entry point.

------------------------------------------------------------------------

# 10. STEP 1.12B --- STOREFRONT IDENTITY & DISCLOSURE POLICY

Это обязательная часть Step 1.12.

Marketplace identity и Storefront identity --- связанные, но не
идентичные concepts.

Необходимо явно определить policy.

### Базовое правило

Storefront может выглядеть как сайт Partner, но это не означает
публикацию raw CRM Partner.

Публичные поля должны формироваться только из:

-   approved `PublicSellerProfile`;
-   approved storefront branding/config;
-   system-safe geography codes;
-   специально разрешённых public fields.

### Контакты

До отдельного утверждённого disclosure policy НЕ публиковать
автоматически:

-   phone;
-   email;
-   messenger;
-   social;
-   direct booking links;
-   external website;
-   legal/private address.

Не ослаблять Step 1.11 anti-disintermediation policy молча.

Если business requirement «собственный сайт партнёра» требует контактов
уже сейчас --- это отдельное архитектурно-продуктовое решение. В таком
случае:

`ARCHITECTURE DECISION REQUIRED`

до публикации таких полей.

### Moderator/Admin control

Не давать PARTNER возможность самовольно обойти approved seller
visibility.

Storefront не должен превращать `ANONYMOUS` в `PUBLIC_BRAND`.

Seller visibility Step 1.11 остаётся authoritative.

------------------------------------------------------------------------

# 11. STEP 1.12C --- STOREFRONT ANALYTICS INSTRUMENTATION FOUNDATION

Это обязательная часть Step 1.12.

Добавить canonical behavioral events минимум:

-   `StorefrontViewed`
-   `StorefrontProductImpression`
-   `StorefrontProductViewed`

Допустимо добавить `StorefrontSearchPerformed` /
`StorefrontCategoryViewed`, если соответствующий UI реально существует.

Каждое событие должно содержать:

-   `eventId`;
-   `eventType`;
-   `occurredAt`;
-   `storefrontId`;
-   `partnerId` или safe internal reference для analytics;
-   `productId` где применимо;
-   `salesChannel = PARTNER_STOREFRONT`;
-   actorId, если authenticated;
-   anonymousSessionId/session context, если anonymous;
-   locale;
-   requestId;
-   correlationId/causationId, если infrastructure Step 1.15 ещё
    отсутствует --- не строить фальшивую реализацию; предусмотреть
    совместимый envelope/nullable migration path;
-   source/path context без хранения секретов/PII.

### Важно

Behavioral event ≠ AuditLog.

Не записывать page views как administrative AuditLog.

Не использовать `updatedAt` как время просмотра.

`occurredAt` --- фактическое время события.

Нужна защита от очевидного двойного fire при hydration/re-render.

Не строить Analytics Center в этом Step.

------------------------------------------------------------------------

# 12. TEMPORAL REQUIREMENTS

С учётом принятого canonical roadmap этот Step обязан быть
analytics-ready.

Для storefront:

-   `createdAt`;
-   `updatedAt`;
-   `publishedAt/activatedAt`;
-   `disabledAt/suspendedAt`, если применимо.

Для lifecycle/history:

-   отдельный `occurredAt`/business timestamp;
-   actor;
-   action;
-   storefrontId;
-   old/new status where applicable.

Не считать `updatedAt` доказательством даты активации/деактивации.

Все system timestamps --- UTC.

UI форматирует их по locale.

------------------------------------------------------------------------

# 13. FRONTEND --- PARTNER CABINET

Добавить раздел Partner Cabinet:

**«Моя витрина» / Storefront**

Минимальный UX:

-   состояние «витрина ещё не создана»;
-   Create Storefront;
-   edit branding;
-   slug preview;
-   status;
-   public URL;
-   preview/open storefront;
-   activate/deactivate, если lifecycle это предусматривает;
-   validation/error/loading/empty states;
-   RU/AZ/EN.

PARTNER не должен вводить:

-   partnerId;
-   CRM IDs;
-   countryCode, если это системная identity;
-   seller visibility mode;
-   moderator approval fields.

Если geography отображается --- использовать Step 1.11 canonical codes +
client localization.

------------------------------------------------------------------------

# 14. FRONTEND --- PUBLIC STOREFRONT

`/store/:slug`

Должен визуально отличаться от обычной Marketplace home настолько, чтобы
восприниматься как персональная витрина Partner, но оставаться частью
TravelHub infrastructure.

Минимально:

-   storefront header/brand;
-   logo;
-   hero;
-   description;
-   список опубликованных услуг Partner;
-   ProductCard;
-   category/search/sort --- если это оправдано количеством Product и
    public contract;
-   locale selector;
-   responsive desktop/mobile;
-   loading/error/404/empty states.

Нельзя:

-   показывать internal Partner ID;
-   показывать CRM Partner raw fields;
-   показывать draft count;
-   показывать moderation status;
-   показывать staged media;
-   показывать private contacts.

### TravelHub attribution

Не скрывать факт использования TravelHub инфраструктуры так, чтобы
создавалось ложное впечатление независимого оператора платформы.

Предусмотреть нейтральный `Powered by TravelHub` / эквивалентный
элемент, локализованный RU/AZ/EN.

Не превращать это в рекламный баннер.

------------------------------------------------------------------------

# 15. PRODUCT PAGE IN STOREFRONT CONTEXT

Если используется storefront-specific PDP route:

`/store/:storeSlug/products/:productSlug`

он должен:

-   использовать тот же published Product;
-   использовать тот же canonical price/tariff/availability contract;
-   сохранить storefront visual context;
-   сохранить `PARTNER_STOREFRONT` attribution;
-   показывать seller identity только по approved disclosure policy;
-   не копировать Product в storefront schema.

Если переиспользуется общий `/products/:slug`, необходимо передавать
storefront context безопасным явным способом, а не доверять
произвольному query param как authoritative business source.

Выбери архитектурно чистый вариант и зафиксируй его.

------------------------------------------------------------------------

# 16. I18N

RU/AZ/EN обязательны.

Локализуются:

-   UI;
-   status labels;
-   geography labels;
-   buttons;
-   errors;
-   empty states;
-   Powered by TravelHub.

Не локализуются/не подменяются locale:

-   `countryCode`;
-   `cityCode`;
-   storefront ID;
-   partnerId;
-   productId;
-   salesChannel.

Не смешивать UI locale и business identity.

------------------------------------------------------------------------

# 17. SLUG POLICY

Storefront slug:

-   unique;
-   normalized;
-   stable;
-   безопасен для URL;
-   case policy определена;
-   reserved slugs запрещены (`app`, `api`, `login`, `search`,
    `products`, `categories`, `store`, `admin` и другие фактически
    конфликтующие);
-   изменение slug, если разрешено, должно быть явным business action.

Определи policy изменения slug.

Предпочтительно foundation: slug задаётся при создании и затем либо
immutable, либо меняется через контролируемую операцию с audit.

Не реализовывать сложную redirect-history без необходимости, но не
допускать silent takeover старого slug.

Race на unique slug должен возвращать управляемый 409/422, а не 500.

------------------------------------------------------------------------

# 18. SECURITY

Обязательные проверки:

1.  Anonymous может читать только ACTIVE public storefront.
2.  Anonymous не может читать Partner management API.
3.  BUYER не может управлять storefront.
4.  PARTNER A не может читать private management state PARTNER B.
5.  PARTNER A не может PATCH/activate/deactivate storefront B.
6.  forged `partnerId` не меняет owner.
7.  pending/unapproved Partner не создаёт/активирует storefront.
8.  suspended/deactivated Partner/storefront исчезает из public read.
9.  чужой Product нельзя получить через storefront route.
10. DRAFT/COMPLETE/REVIEWED/ARCHIVED Product не виден.
11. ProductDraft N+1 не виден.
12. staged ProductMedia не виден.
13. raw CRM Partner не сериализуется.
14. storage keys/signed storage URL/bucket/credentials не попадают в
    JSON.
15. seller visibility нельзя обойти через storefront.
16. arbitrary HTML/JS/CSS injection отсутствует.
17. slug validation защищает routing.
18. public storefront не отправляет Authorization во внутренние API.
19. public API не раскрывает lifecycle через разные ошибки --- neutral
    404 where appropriate.
20. rate/performance guards соответствуют public catalog patterns.

------------------------------------------------------------------------

# 19. RBAC

Не расширяй PARTNER широкими internal permissions.

Если нужны новые права, используй узкие capabilities, например:

-   `storefront.read_own`
-   `storefront.create_own`
-   `storefront.update_own`
-   `storefront.activate_own`

Названия адаптировать к текущему permission convention.

ADMIN получает только то, что действительно требуется.

MODERATOR не должен автоматически получить storefront write.

Если появляется moderation storefront branding --- отдельные moderation
permissions.

BUYER --- без storefront management permissions.

Проверь reconciliation seed permissions и stale permission cleanup.

------------------------------------------------------------------------

# 20. AUDIT

Administrative/business actions:

-   storefront created;
-   storefront updated;
-   storefront activated;
-   storefront suspended/deactivated;
-   slug changed, если разрешено;
-   branding changed.

Audit должен содержать:

-   actor;
-   storefrontId;
-   partnerId;
-   action;
-   occurredAt;
-   relevant before/after metadata без sensitive data.

Public page views НЕ писать в AuditLog --- они идут в behavioral
analytics events.

------------------------------------------------------------------------

# 21. EVENTS / OUTBOX

Если storefront lifecycle требует domain events, использовать existing
Outbox/event conventions.

Минимально рассмотреть:

-   `PartnerStorefrontCreated`
-   `PartnerStorefrontActivated`
-   `PartnerStorefrontDeactivated`
-   `PartnerStorefrontUpdated`

Не плодить events без consumer/business meaning.

Behavioral events Step 1.12C могут использовать отдельный analytics
event path, если это соответствует текущей архитектуре.

Не делать прямые cross-domain writes.

------------------------------------------------------------------------

# 22. PERFORMANCE

Public storefront list не должен делать N+1:

-   Product;
-   media;
-   tariffs/price;
-   category;
-   seller projection.

Pagination --- server-side.

`total` должен соответствовать полному matching dataset.

Не вводить искусственный scan ceiling вроде старого public catalog 5000.

Использовать существующие performant public catalog patterns.

Добавить индексы только при доказанной необходимости и через migration.

------------------------------------------------------------------------

# 23. SEO FOUNDATION

Не реализовывать полный Step 3.35, но storefront должен быть технически
совместим с будущим SEO.

Минимально:

-   стабильный slug route;
-   page title/description;
-   canonical URL strategy для `/store/:slug`;
-   product route не должен создавать очевидные duplicate-content
    ловушки без canonical policy.

Если полноценная metadata/localized SEO требует отдельного большого
объёма --- оставить documented follow-up Step 3.35.

------------------------------------------------------------------------

# 24. НЕ ВХОДИТ В STEP 1.12

Строго не начинать:

-   Checkout;
-   Cart;
-   Sale;
-   Order creation;
-   Booking creation;
-   Payment/PSP;
-   split payment;
-   TravelHub commission calculation;
-   Settlement;
-   Payout;
-   Partner bank account;
-   Buyer Cabinet expansion;
-   Reviews;
-   Chat;
-   custom domain;
-   subdomain provisioning;
-   Storefront SaaS billing/plans;
-   AI page builder;
-   full Analytics dashboards;
-   contact disclosure after purchase.

Foundation для будущих channel/analytics contracts --- да.

Реализация коммерческого flow --- нет.

------------------------------------------------------------------------

# 25. ОБЯЗАТЕЛЬНЫЕ UNIT / INTEGRATION TESTS

Покрыть минимум:

1.  slug normalization/validation/reserved slugs;
2.  own-scope storefront mapping;
3.  public DTO whitelist;
4.  seller disclosure mapping;
5.  Product filtering only published/owner;
6.  no ProductDraft/staged media;
7.  channel = PARTNER_STOREFRONT;
8.  behavioral event payload + occurredAt;
9.  localization не меняет countryCode/cityCode/channel;
10. status/lifecycle guards;
11. pending Partner denied;
12. branding input sanitization/whitelist.

------------------------------------------------------------------------

# 26. ОБЯЗАТЕЛЬНЫЕ E2E PROOFS

Создай отдельный storefront e2e suite.

Минимум доказать:

1.  approved PARTNER создаёт storefront;
2.  pending PARTNER → 403;
3.  BUYER → 403 management;
4.  anonymous → 401 management;
5.  owner получает own storefront;
6.  PARTNER A не получает/не меняет B;
7.  forged partnerId не работает;
8.  unique/reserved slug validation;
9.  activate storefront;
10. anonymous `/public/storefronts/:slug` → 200;
11. inactive storefront → neutral 404;
12. public products = только published products owner;
13. Product другого Partner → 404;
14. draft Product → 404;
15. archived Product → 404;
16. ProductDraft N+1 не утёк;
17. staged media не утекла;
18. public JSON без CRM/private contacts;
19. public JSON без storage keys/signed S3 URLs;
20. seller ANONYMOUS не превращается в PUBLIC_BRAND;
21. VERIFIED_ALIAS/PUBLIC_BRAND projection следует Step 1.11;
22. RU/AZ/EN меняют presentation, но не identity codes;
23. `StorefrontViewed` содержит occurredAt + PARTNER_STOREFRONT;
24. Product impression/view содержит storefrontId/productId/channel;
25. repeated render не создаёт очевидные duplicate events;
26. public storefront использует только public API;
27. authorized BUYER/PARTNER, открыв public storefront, не вызывает
    internal Catalog API;
28. deactivate/suspend скрывает storefront;
29. reactivation, если предусмотрена, возвращает его;
30. existing Marketplace `/`, `/search`, `/products/:slug` не сломан.

------------------------------------------------------------------------

# 27. BROWSER VERIFICATION

Провести реальный browser smoke на production build/Preview, а не только
unit mocks.

Сценарий:

1.  зарегистрировать/использовать approved PARTNER;
2.  открыть Partner Cabinet;
3.  создать storefront;
4.  настроить displayName/logo/hero/tagline;
5.  активировать;
6.  открыть `/store/:slug` anonymous;
7.  проверить branding;
8.  проверить список только его published Product;
9.  открыть Product;
10. переключить RU → AZ → EN;
11. убедиться, что geography identity не меняется;
12. убедиться, что seller visibility соответствует Step 1.11;
13. убедиться, что private contacts отсутствуют;
14. проверить mobile;
15. проверить console errors;
16. проверить Network: public storefront → только public contracts;
17. проверить analytics events/channel.

После smoke удалить созданные test/smoke данные из dev DB только
контролируемым способом и перечислить, что удалено. Не трогать реальные
legacy records.

------------------------------------------------------------------------

# 28. REGRESSION

После Step 1.12 обязательно прогнать:

### Backend

-   typecheck;
-   unit/integration;
-   полный serial e2e;
-   public catalog;
-   moderation;
-   change proposal;
-   product scope;
-   media;
-   Partner Cabinet;
-   Partner onboarding;
-   seller identity;
-   buyer identity;
-   RBAC/auth.

### Frontend

-   typecheck;
-   unit/component tests;
-   production build;
-   public Marketplace smoke;
-   Partner Cabinet smoke;
-   Storefront smoke;
-   role-gates;
-   RU/AZ/EN.

Step считается завершённым только при полном regression green либо при
явно задокументированном независимом pre-existing failure.

------------------------------------------------------------------------

# 29. MIGRATION SAFETY

Если добавляется Prisma model/fields/index:

-   отдельная migration;
-   проверить `prisma migrate diff`;
-   migration должна соответствовать schema;
-   никаких destructive operations без необходимости;
-   test DB получает migration штатно;
-   dev/prod DB не менять вручную;
-   никаких `db push` вместо migration для канонической схемы.

------------------------------------------------------------------------

# 30. DEFINITION OF DONE

Step 1.12 завершён только если одновременно выполнено:

-   Partner может создать/manage собственную storefront;
-   storefront имеет stable public route;
-   storefront показывает только canonical published Product Partner;
-   Product не дублируется;
-   public/private API boundary сохранён;
-   Step 1.11 seller identity policy не обходится;
-   private CRM contacts не утекли;
-   branding безопасен;
-   RU/AZ/EN работают;
-   lifecycle timestamps/audit присутствуют;
-   `PARTNER_STOREFRONT` channel foundation реализован;
-   storefront behavioral events реализованы;
-   events имеют фактический `occurredAt`;
-   Marketplace regression не сломан;
-   Partner Cabinet regression не сломан;
-   IDOR/security tests green;
-   backend/frontend tests/typecheck/build green;
-   browser verification green;
-   никаких Checkout/Order/Booking/Payment реализаций не начато;
-   dev/prod data/storage не повреждены.

------------------------------------------------------------------------

# 31. ФОРМАТ ИТОГОВОГО ОТЧЁТА РАЗРАБОТЧИКА

Верни отчёт строго по структуре:

## PHASE 1 --- STEP 1.12: PARTNER STOREFRONT FOUNDATION --- ОТЧЁТ

### 1. Current → Target mapping

Что было и что стало.

### 2. Architecture

Domain owner, data model, lifecycle, public/private boundaries.

### 3. Prisma / migrations

Models, fields, indexes, migration.

### 4. Partner Storefront management

API, own scope, lifecycle.

### 5. Public Storefront contract

Routes, DTO, products, media.

### 6. Branding/media

Как реализованы logo/hero/theme и storage safety.

### 7. Step 1.12A --- Sales Channel

Как зафиксирован `PARTNER_STOREFRONT`, где хранится/передаётся context,
как подготовлен будущий propagation.

### 8. Step 1.12B --- Identity & Disclosure

Какие seller/storefront fields публичны, какие запрещены, как Step 1.11
policy сохранена.

### 9. Step 1.12C --- Analytics Instrumentation

События, payload, `occurredAt`, anonymous/auth actor, duplicate
protection.

### 10. Temporal/Audit

Lifecycle timestamps, history/audit.

### 11. RBAC / IDOR / Security

Permissions и proof.

### 12. Frontend

Partner Cabinet + public storefront + responsive + RU/AZ/EN.

### 13. Performance

Queries, pagination, N+1, indexes.

### 14. Tests

Unit/integration/e2e counts.

### 15. Browser verification

Фактический flow и network/console verification.

### 16. Full regression

Backend/frontend.

### 17. Dev/prod impact

DB/storage/smoke cleanup.

### 18. Issues found

Что обнаружено и как исправлено.

### 19. Out of scope

Явно подтвердить, что
Checkout/Order/Booking/Payment/Settlement/Payout/custom domain/subdomain
не начинались.

### 20. ARCHITECTURE DECISION REQUIRED

`нет` либо точное описание решения, которое необходимо принять.

Финальная строка:

`PHASE 1 STEP 1.12 COMPLETED — WAITING FOR REVIEW`

------------------------------------------------------------------------

# 32. КРИТИЧЕСКОЕ НАПОМИНАНИЕ

Storefront --- **не второй Marketplace и не второй Catalog**.

Целевая модель:

`PARTNER` → `PublicSellerProfile` → `PartnerStorefront` → presentation
of the same `Catalog.Product`

и:

`Catalog.Product` → Marketplace channel

тот же:

`Catalog.Product` → Partner Storefront channel

Будущий коммерческий flow обязан различать эти каналы, но
Order/Booking/Payment пока не реализовывать.

Начни с анализа фактического кода и Current → Target plan.
