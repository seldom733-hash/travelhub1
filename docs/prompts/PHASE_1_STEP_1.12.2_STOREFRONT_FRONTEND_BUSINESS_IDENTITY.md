# PHASE 1 --- STEP 1.12.2: PARTNER STOREFRONT FRONTEND, BUSINESS IDENTITY & PUBLIC EXPERIENCE

## 0. Контекст и статус

Step 1.12.1 APPROVED.

Уже существуют и являются authoritative:

-   `catalog.PartnerStorefront` (`SF-*`);
-   lifecycle `DRAFT → ACTIVE → INACTIVE`;
-   explicit provisioning, без startup auto-provisioning;
-   entitlement states `NONE / ACTIVE / SUSPENDED / EXPIRED`;
-   public invariant:
    `Storefront.status = ACTIVE AND entitlementStatus = ACTIVE`;
-   Product publication channels:
    -   `MARKETPLACE`;
    -   `PARTNER_STOREFRONT`;
-   один canonical `Catalog.Product`, без Storefront-копий;
-   Marketplace и Storefront --- разные commercial models;
-   `PublicSellerProfile` --- Marketplace-safe identity;
-   Storefront --- paid SaaS capability;
-   publication channel ≠ future acquisition/transaction channel;
-   Marketplace anti-disintermediation Step 1.11 остаётся authoritative;
-   stable public Product/media contracts Step 1.5;
-   RU/AZ/EN i18n foundation;
-   Partner Cabinet foundation.

Этот Step строит frontend/public experience поверх утверждённого backend
foundation.

Не переопределять решения Step 1.12.1.

Не переходить к Step 1.12.3.

------------------------------------------------------------------------

# 1. Цель

Реализовать полноценный первый пользовательский Storefront experience:

1.  Partner управляет своей Storefront из Partner Cabinet.
2.  Partner выбирает, какие canonical Product публиковать:
    -   Marketplace;
    -   Storefront;
    -   оба канала.
3.  Public Storefront выглядит как самостоятельный сайт конкретного
    туристического бизнеса, а не как отфильтрованная страница общего
    Marketplace.
4.  Storefront получает собственную business identity projection.
5.  Business contacts могут публиковаться только в Storefront context и
    только при ACTIVE entitlement/public Storefront.
6.  Marketplace не получает Storefront contacts или расширенную
    Storefront identity.
7.  RU/AZ/EN поддерживаются.
8.  Архитектура готова к будущим:
    -   Partner CRM;
    -   analytics;
    -   custom domains;
    -   subscription plans;
    -   SEO/marketing;
    -   Storefront-origin transaction attribution.

Сам CRM, billing, checkout, analytics и custom domains сейчас НЕ
реализовывать.

------------------------------------------------------------------------

# 2. Product / commercial invariant

В UI должно быть понятно различие:

## Marketplace

-   общий TravelHub Marketplace;
-   TravelHub приводит Buyer;
-   прямые контакты Partner скрыты;
-   Marketplace transaction в будущем подчиняется commission rules;
-   Partner получает базовые operational capabilities.

## Storefront

-   отдельный SaaS-сайт Partner на инфраструктуре TravelHub;
-   доступен только при соответствующем entitlement;
-   Partner может публично раскрывать business contacts;
-   в будущем получает расширенную analytics и Partner-scoped CRM;
-   собственный Storefront lead не должен автоматически считаться
    Marketplace lead.

Не реализовывать monetary logic, но UI/контракты не должны смешивать эти
модели.

------------------------------------------------------------------------

# 3. Storefront business identity

Текущий `PublicSellerProfile` НЕ использовать как authoritative
Storefront business profile.

Нужна Storefront-owned business identity/projection.

Минимально поддержать:

-   `businessName`;
-   `tagline`;
-   `description`;
-   `countryCode`;
-   `cityCode`;
-   `publicPhone?`;
-   `publicEmail?`;
-   `websiteUrl?`;
-   `whatsapp?`;
-   social links как структурированные whitelist-поля, если реализуются;
-   business address/location text только если есть безопасная модель;
-   `defaultLocale`.

Не сериализовать raw `crm.Partner`.

Не публиковать:

-   legal/tax fields;
-   CRM notes;
-   internal Partner IDs;
-   User data;
-   private onboarding data;
-   moderation/internal fields;
-   entitlementStatus;
-   audit actor IDs.

Если для хранения Storefront business identity нужна новая catalog-owned
модель/колонки --- сделать migration штатно.

------------------------------------------------------------------------

# 4. Contact policy

Storefront structured contacts разрешены.

Это сознательное исключение из Marketplace anti-disintermediation policy
по КОНТЕКСТУ, а не ослабление Step 1.11.

Правила:

-   контакты хранятся в Storefront-owned structured fields;
-   Product title/description/captions не становятся каналом для
    контактов;
-   Marketplace Product moderation остаётся прежней;
-   Storefront contacts никогда не добавляются в `PublicSellerProfile`;
-   Storefront contacts никогда не попадают в Marketplace
    Card/PDP/search/category;
-   public Storefront contacts выдаются только если:
    -   Storefront ACTIVE;
    -   entitlement ACTIVE;
    -   public Storefront route/context.

DRAFT/INACTIVE/NONE/SUSPENDED/EXPIRED → public Storefront и contacts
neutral 404.

URL/email/phone validation обязательна.

Не разрешать arbitrary HTML.

------------------------------------------------------------------------

# 5. Storefront branding foundation

Реализовать первую branding-конфигурацию, достаточную для ощущения
«собственного сайта».

Минимум:

-   business/storefront name;
-   tagline;
-   description;
-   logo;
-   hero image;
-   optional short hero heading/subheading;
-   default locale;
-   theme preset из ограниченного whitelist;
-   базовые layout settings только если действительно нужны.

Не строить page-builder.

Не разрешать произвольный CSS/JS/HTML.

Theme --- безопасный enum/preset, например несколько системных
вариантов.

Если logo/hero используют существующий ProductMedia contract некорректно
по ownership/lifecycle --- создать Storefront-owned media contract, не
притворяться, что storefront branding asset является ProductMedia.

Storage остаётся private-by-default; public delivery должна использовать
стабильный provider-independent URL/redirect/proxy pattern, аналогичный
принципам Step 1.5.

------------------------------------------------------------------------

# 6. Storefront media security

Для logo/hero:

-   private bucket/storage;
-   controlled upload;
-   MIME/type/size validation;
-   derivative generation, если нужно;
-   stable public URL;
-   public bytes только для ACTIVE + entitled Storefront;
-   replacement не должен оставлять публично доступные staged/private
    assets;
-   storage key/bucket/credentials/signed URL не входят в JSON public
    contract;
-   no IDOR;
-   Partner управляет только media своей Storefront.

Если переиспользуется существующий storage infrastructure --- ownership
Storefront asset должен быть явным.

------------------------------------------------------------------------

# 7. Partner Cabinet --- Storefront management

Добавить полноценный раздел:

`/partner/storefront`

Он должен показывать:

-   текущий Storefront status;
-   entitlement state в понятном UI;
-   public URL/slug;
-   business identity;
-   contacts;
-   branding;
-   publication readiness;
-   действия activate/deactivate;
-   preview;
-   список/ссылку управления Product distribution.

Состояния:

### Storefront отсутствует

CTA создать Storefront.

### DRAFT + entitlement NONE

Можно настраивать. Нельзя публиковать. Показать, что публичный запуск
требует Storefront plan/entitlement.

Не создавать fake checkout.

### DRAFT + entitlement ACTIVE

Можно завершить настройку и activate.

### ACTIVE + entitlement ACTIVE

Показать public URL, preview/open site, deactivate.

### ACTIVE + SUSPENDED/EXPIRED

Public site недоступен. Показать entitlement problem. Не удалять
конфигурацию.

### INACTIVE

Можно редактировать; reactivation только если entitlement разрешает.

Не показывать пользователю технические internal enums без локализации.

------------------------------------------------------------------------

# 8. Product distribution UX

В Partner Product create/edit/detail добавить управление каналами
публикации.

Понятные controls:

-   «TravelHub Marketplace»
-   «Моя витрина»

Partner должен видеть, где Product опубликован.

Не путать: - moderation/lifecycle status; - publication channels.

Например:

`PUBLISHED` + `Marketplace: ON` + `Storefront: OFF`

--- валидное состояние.

Если Storefront ещё не создан или entitlement отсутствует, Partner может
подготовить channel selection только если backend semantics это
безопасно допускают; иначе UI должен корректно объяснить ограничение.

Не создавать Product duplicate.

------------------------------------------------------------------------

# 9. Public Storefront routes

Канонический frontend route первого этапа:

`/store/:slug`

Дополнительно:

`/store/:slug/products/:productSlug`

При необходимости: `/store/:slug/products`

Не использовать сейчас subdomain как canonical routing requirement.

Custom domain/subdomain --- future step.

Public Storefront routes:

-   anonymous;
-   только Storefront public API;
-   не вызывают internal API;
-   не отправляют Authorization даже если пользователь logged in;
-   neutral not-found для непубличной Storefront/Product.

------------------------------------------------------------------------

# 10. Public Storefront homepage

Страница должна визуально восприниматься как сайт Partner.

Минимальные блоки:

-   Header;
-   logo/business name;
-   hero;
-   tagline/description;
-   business location;
-   contacts;
-   Product/service section;
-   category/service grouping, если данные позволяют;
-   CTA к услугам;
-   Footer;
-   TravelHub attribution/«Powered by TravelHub» --- допускается и
    рекомендуется на первом этапе.

Не делать страницу копией `/search`.

Не показывать внутренние TravelHub sidebar/work-center элементы.

Marketplace navigation можно оставить минимальной и ненавязчивой.

------------------------------------------------------------------------

# 11. Storefront Product Card / PDP

Storefront Product использует canonical Product data и safe
media/tariff/availability contracts.

Но визуальный context --- Storefront Partner.

Storefront Card/PDP может показывать Storefront business identity и
Storefront contacts согласно policy.

Не показывать Marketplace seller alias как обязательную primary
identity, если Storefront business identity существует.

Не создавать отдельные Storefront Product
descriptions/tariffs/availability.

Canonical Product остаётся источником истины.

------------------------------------------------------------------------

# 12. RU / AZ / EN

Storefront UI должен работать с существующим i18n foundation.

Локализовать системные UI labels.

Не путать locale с identity/geography.

`countryCode/cityCode` остаются canonical codes, labels формируются
locale-aware на frontend.

Storefront business-entered content не переводить автоматически без
отдельной translation architecture.

`defaultLocale` определяет preferred initial Storefront locale, но
пользователь должен иметь возможность переключить RU/AZ/EN.

Существующая locale persistence не должна ломаться.

------------------------------------------------------------------------

# 13. Storefront preview

Partner должен иметь возможность preview своей DRAFT/INACTIVE Storefront
до публикации.

Preview:

-   authenticated PARTNER;
-   own-scope;
-   не делает Storefront публичной;
-   не индексируется;
-   не использует public activation predicate как способ обхода;
-   staged branding media может быть видна только owner preview через
    безопасный short-lived/private delivery contract.

Public anonymous route при этом остаётся 404.

------------------------------------------------------------------------

# 14. Entitlement UX

Frontend не должен изображать полноценный billing, которого ещё нет.

При `NONE`:

-   объяснить, что Storefront является платной возможностью;
-   показать состояние «требуется тариф/активация»;
-   не показывать fake price;
-   не создавать fake payment;
-   не давать Partner самому менять entitlement.

ADMIN operational entitlement command может оставаться
backend-only/internal на этом этапе.

Если нужен internal UI для тестирования entitlement --- делать только
если явно оправдано, под ADMIN permission, без имитации billing.

------------------------------------------------------------------------

# 15. Future Partner CRM boundary --- ОБЯЗАТЕЛЬНО ЗАФИКСИРОВАТЬ

Storefront является не только сайтом, но будущим SaaS workspace для
малого туристического бизнеса.

Paid Storefront в будущих фазах должен иметь Partner-scoped CRM.

Не реализовывать CRM сейчас.

Но зафиксировать architecture/product boundary:

### Marketplace Partner

Получает только необходимые Marketplace customer/order/booking views и
базовые operational capabilities.

### Storefront Partner

В будущем получает собственный CRM-контур:

-   customers;
-   leads;
-   notes;
-   tags;
-   lifecycle/stages;
-   tasks/reminders;
-   communication history;
-   customer documents where permitted;
-   repeat customer history;
-   segmentation;
-   assigned manager/team;
-   acquisition source;
-   CRM analytics.

КРИТИЧЕСКИ:

внутренний TravelHub `/app/crm` НЕ является Partner CRM.

PARTNER не получает доступ к общей CRM-базе TravelHub.

Нужна строгая tenant/object isolation.

------------------------------------------------------------------------

# 16. Customer identity vs Partner CRM relationship

Зафиксировать для будущей реализации:

глобальная TravelHub Customer identity и CRM-отношение конкретного
Partner с Customer --- разные понятия.

Один Customer может взаимодействовать с несколькими Partner.

Будущая модель должна позволять концепцию:

`Customer` ← `PartnerCustomerRelationship` → `Partner`

или архитектурно эквивалентную relationship entity.

Partner-specific данные:

-   notes;
-   tags;
-   lifecycle;
-   lead status;
-   assigned manager;
-   tasks;
-   communication metadata;
-   Partner-specific source/context

не должны храниться как глобальные поля Customer, если они относятся
только к одному Partner.

Partner A не видит Partner B relationship data.

Не реализовывать эту entity сейчас, если она не нужна Step 1.12.2.
Зафиксировать в ADR/roadmap.

------------------------------------------------------------------------

# 17. Future acquisition sources

Storefront/CRM architecture должна быть готова как минимум к:

-   `MARKETPLACE`;
-   `PARTNER_STOREFRONT`;
-   `DIRECT`;
-   возможно `MANUAL_CRM`/другим каналам позднее.

Не добавлять эти значения сейчас в Order/Sale без соответствующего
domain step.

Не вычислять source задним числом по Product.

------------------------------------------------------------------------

# 18. Analytics boundary

Не реализовывать analytics engine сейчас.

Но Storefront public/frontend architecture должна быть готова к будущим
событиям:

-   storefront viewed;
-   product viewed;
-   CTA clicked;
-   contact clicked;
-   funnel progression;
-   lead created;
-   conversion.

Не отправлять события в несуществующий backend и не создавать фиктивную
analytics persistence.

Step 1.12.3 должен иметь стабильные Storefront/Product/channel
identifiers.

------------------------------------------------------------------------

# 19. SEO foundation

Без полноценного SEO suite реализовать базовую корректность:

-   title;
-   meta description;
-   canonical URL для `/store/:slug`;
-   OpenGraph basics;
-   Product metadata;
-   robots/noindex для preview;
-   noindex/not-found для непубличных состояний.

Custom domains и advanced sitemap/SEO tooling --- позже.

Не индексировать private preview.

------------------------------------------------------------------------

# 20. Accessibility / responsive

Обязательно:

-   desktop;
-   tablet;
-   mobile;
-   keyboard navigation;
-   semantic headings;
-   labels;
-   alt text;
-   visible focus;
-   gallery keyboard controls;
-   reasonable contrast;
-   no horizontal overflow.

------------------------------------------------------------------------

# 21. Security

Проверить:

-   Partner own-scope;
-   no IDOR branding/media;
-   forged `partnerId`, `entitlementStatus`, lifecycle/audit fields →
    deny/422;
-   public DTO whitelist;
-   Marketplace contact leakage = 0;
-   Storefront internal-field leakage = 0;
-   no raw CRM Partner;
-   no signed storage URL in public JSON;
-   no storage keys;
-   no auth header on public Storefront API;
-   preview cannot make DRAFT public;
-   XSS-safe rendering;
-   URLs/contact fields validated;
-   arbitrary HTML disabled;
-   safe external links (`rel` etc.).

------------------------------------------------------------------------

# 22. Required backend tests

Если backend расширяется business identity/media:

1.  own Storefront business identity update;
2.  forged fields rejected;
3.  contacts public only ACTIVE + entitlement ACTIVE;
4.  contacts absent in Marketplace contracts;
5.  DRAFT/INACTIVE/NONE/SUSPENDED/EXPIRED contacts inaccessible;
6.  Storefront media own-scope;
7.  staged branding media public inaccessible;
8.  stable media delivery;
9.  storage details absent;
10. preview owner-only;
11. other Partner preview/media → deny;
12. channel predicates remain correct;
13. PublicSellerProfile unchanged;
14. full existing Storefront regression.

------------------------------------------------------------------------

# 23. Required frontend tests

Минимум:

1.  Storefront management states;
2.  create Storefront CTA;
3.  entitlement NONE UX;
4.  ACTIVE entitlement activation UX;
5.  suspended/expired UX;
6.  business identity form;
7.  contact validation;
8.  Product channel controls;
9.  Marketplace-only / Storefront-only / both representation;
10. public Storefront rendering;
11. Storefront PDP;
12. RU/AZ/EN;
13. geography localization;
14. public API no-auth behavior;
15. preview access;
16. preview noindex;
17. responsive/mobile controls;
18. error/loading/empty states;
19. Marketplace components do not render Storefront contacts;
20. safe external links.

------------------------------------------------------------------------

# 24. Browser verification

Провести live browser verification минимум по сценариям:

### A --- Partner without Storefront

login → `/partner/storefront` → create DRAFT → configuration visible.

### B --- No entitlement

DRAFT configurable → activate blocked → public `/store/:slug` = not
found.

### C --- Entitled Partner

ADMIN operational entitlement ACTIVE → Partner activate → public
Storefront opens.

### D --- Branding/business identity

business name + tagline + description + logo/hero + location + contacts
→ public Storefront отображает их.

### E --- Marketplace isolation

тот же Partner/Product в Marketplace → Marketplace Card/PDP НЕ
показывает Storefront phone/email/website/WhatsApp.

### F --- Distribution

Product 1 MARKETPLACE only; Product 2 STOREFRONT only; Product 3 BOTH.
Проверить обе поверхности.

### G --- Suspension

entitlement SUSPENDED → Storefront public unavailable; Marketplace
Product с MARKETPLACE channel остаётся доступен.

### H --- Preview

DRAFT/INACTIVE Storefront owner preview работает; anonymous public route
остаётся unavailable.

### I --- Locale

RU → AZ → EN; geography/system labels локализуются; identity не
меняется.

Console errors: 0.

------------------------------------------------------------------------

# 25. Regression

Обязательно:

Backend: - `tsc --noEmit`; - unit; - storefront e2e; - public-catalog; -
seller-identity; - moderation/change-proposal; - product-scope; -
product-media; - partner-onboarding; - partner-cabinet; -
buyer-identity; - auth/RBAC; - полный serial e2e; - migration
replay/status/diff, если есть migration.

Frontend: - `tsc --noEmit`; - vitest; - production build; - browser
verification.

------------------------------------------------------------------------

# 26. Out of scope

НЕ начинать:

-   Checkout;
-   Cart;
-   Sale;
-   Order changes;
-   Booking changes;
-   Payment/PSP;
-   split payment;
-   commission engine;
-   Settlement/Payout;
-   recurring billing;
-   subscription checkout;
-   plan pricing;
-   Partner Finance;
-   полноценный Partner CRM;
-   CRM relationship persistence;
-   analytics engine;
-   custom domain/subdomain;
-   advanced SEO;
-   marketing automation;
-   reviews/chat redesign;
-   Step 1.12.3.

------------------------------------------------------------------------

# 27. Architecture decisions

Если возникает необходимость:

-   публиковать raw CRM Partner;
-   использовать `PublicSellerProfile` как единственную Storefront
    identity;
-   хранить Storefront business contacts в Product;
-   давать PARTNER доступ к `/app/crm`;
-   создавать Product copy для Storefront;
-   смешивать publication и acquisition channel;
-   делать Catalog authoritative Billing domain;
-   вводить arbitrary HTML/CSS/JS;
-   менять Product moderation semantics;

НЕ делать молча.

Вернуть:

`ARCHITECTURE DECISION REQUIRED`

с: - вопросом; - вариантами; - trade-offs; - рекомендуемым вариантом.

------------------------------------------------------------------------

# 28. Definition of Done

Step считается завершённым, если:

-   Partner имеет рабочий `/partner/storefront`;
-   public `/store/:slug` выглядит как отдельный Partner site;
-   Storefront business identity отделена от Marketplace identity;
-   structured contacts разрешены только в Storefront context;
-   Marketplace contact leakage отсутствует;
-   branding/media безопасны;
-   Product distribution UX работает;
-   canonical Product не копируется;
-   entitlement UX соответствует backend invariant;
-   preview безопасен;
-   RU/AZ/EN работают;
-   responsive/accessibility smoke пройден;
-   SEO basics реализованы;
-   Partner CRM future boundary зафиксирован;
-   Customer identity vs Partner CRM relationship boundary зафиксирован;
-   analytics/acquisition future boundaries сохранены;
-   regression green;
-   Step 1.12.3 не начат.

------------------------------------------------------------------------

# 29. Формат отчёта

Вернуть:

## PHASE 1 --- STEP 1.12.2 --- ОТЧЁТ

1.  Changed files
2.  Storefront business identity model
3.  Contact disclosure model
4.  Branding/media model
5.  Partner Cabinet Storefront UX
6.  Product distribution UX
7.  Public routes
8.  Storefront Home/PDP
9.  Entitlement UX
10. Preview
11. RU/AZ/EN
12. SEO/accessibility/responsive
13. Marketplace isolation
14. Partner CRM future boundary
15. Customer identity vs Partner relationship boundary
16. Analytics/acquisition future boundary
17. RBAC/object scope/security
18. Backend tests
19. Frontend tests
20. Browser verification
21. Full regression
22. Migration status
23. Dev/prod impact
24. Issues found
25. Out-of-scope confirmation
26. ARCHITECTURE DECISION REQUIRED

Не переходить к Step 1.12.3.

Финальная строка:

`PHASE 1 STEP 1.12.2 COMPLETED — WAITING FOR REVIEW`
