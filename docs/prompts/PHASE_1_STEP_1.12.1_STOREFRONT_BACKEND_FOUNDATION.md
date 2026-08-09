# PHASE 1 --- STEP 1.12.1: PARTNER STOREFRONT DOMAIN & BACKEND FOUNDATION

## 0. Контекст

PHASE 1 STEP 1.11 и его review-fixes считаются APPROVED.

Step 1.12 реализуется несколькими контролируемыми проходами:

-   Step 1.12.1 --- Storefront Domain & Backend Foundation --- ТЕКУЩИЙ;
-   Step 1.12.2 --- Storefront Frontend & Branding;
-   Step 1.12.3 --- Sales Channel, Disclosure & Analytics Foundation;
-   Step 1.12.4 --- Integration Review & Hardening.

Не переходить к 1.12.2 самостоятельно.

Текущий проход должен создать только надёжный backend/domain фундамент
Partner Storefront.

## 1. Перед реализацией

Сначала изучить фактическое состояние проекта: Prisma schema и
migrations; Catalog; Public Catalog; Product/ProductDraft; ProductMedia;
PublicSellerProfile; Partner onboarding; Partner Cabinet; moderation;
RBAC; AuditLog; Outbox/domain events; существующие public/internal API
contracts; e2e test DB isolation.

Перед изменениями показать краткий **Current State → Target State
implementation plan**.

Не переписывать утверждённые Step 1.0--1.11.

Если реализация требует изменения domain ownership, нарушения
существующего ADR, нового cross-domain write или другого существенного
архитектурного решения --- выдать `ARCHITECTURE DECISION REQUIRED` и
остановиться до реализации конфликтующей части.

## 2. Цель

Создать backend/domain foundation для персональной публичной витрины
PARTNER.

Целевая модель:

PARTNER → PublicSellerProfile → PartnerStorefront → published
Catalog.Product этого Partner.

Storefront НЕ является вторым Catalog, копией Marketplace, копией
Product или Order/Booking/Payment domain.

Главный инвариант: **один Catalog.Product используется и Marketplace, и
Partner Storefront.** Никаких storefront-specific копий Product.

## 3. Domain ownership

Предпочтительный owner `PartnerStorefront` --- Catalog domain. Перед
реализацией подтвердить это по фактической архитектуре.

CRM Partner остаётся CRM-owned entity. Storefront может хранить
reference `partnerId`, но не должен превращаться в копию `crm.Partner`.

Не создавать FK между схемами, если это противоречит действующему ADR.
Не выполнять прямые Catalog writes в CRM. Cross-domain reads --- только
согласно существующим ADR.

## 4. Prisma model

После проверки текущей schema создать минимальную модель storefront,
предпочтительно `catalog.PartnerStorefront`.

Минимально требуется:

-   `id`;
-   stable public code/identifier согласно conventions проекта;
-   `partnerId`;
-   `slug`;
-   `status`;
-   `displayName`;
-   `tagline` nullable;
-   `description` nullable;
-   `defaultLocale`;
-   `createdAt`;
-   `updatedAt`;
-   `activatedAt` nullable;
-   `deactivatedAt` nullable.

`partnerId` должен быть UNIQUE при одной storefront на Partner. `slug`
должен быть UNIQUE.

Не добавлять сейчас Product copies, prices, tariffs, availability
copies, Order, Booking, Payment, Settlement, bank information, CRM
contacts, arbitrary HTML/CSS/JS, custom domain/subdomain.

Logo/hero/media implementation оставить для Step 1.12.2, если сейчас не
требуется исключительно schema foundation.

## 5. Lifecycle

Определить простой явный lifecycle, предпочтительно
`DRAFT → ACTIVE → INACTIVE` или эквивалент по conventions проекта.

Требования:

-   создание storefront не делает её публичной автоматически;
-   только approved/linked PARTNER может создать storefront;
-   pending PARTNER не может создать/активировать storefront;
-   ACTIVE storefront публична;
-   DRAFT/INACTIVE storefront публично не существует;
-   deactivate не удаляет storefront;
-   повторные activate/deactivate имеют детерминированное поведение;
-   lifecycle timestamps отражают реальные business transitions;
-   не использовать `updatedAt` вместо `activatedAt/deactivatedAt`;
-   timestamps --- UTC.

## 6. Provisioning

Storefront --- optional capability. Не создавать storefront
автоматически каждому Partner на startup. Не делать startup backfill.

Предпочтительный flow: PARTNER → explicit backend create command →
DRAFT.

Legacy Partner без storefront --- нормальное состояние.

## 7. Slug policy

Slug должен быть normalized, unique, URL-safe, case-normalized,
ограниченной длины, без path traversal/encoded routing tricks и reserved
system slugs.

Минимальный reserved set: `app`, `api`, `login`, `register`, `search`,
`products`, `categories`, `store`, `partner`, `account`, `admin` плюс
реальные конфликты проекта.

Race на одинаковый slug → controlled 409/422, не raw Prisma/500.

Для Step 1.12.1 slug предпочтительно immutable после создания. Не делать
silent slug mutation через PATCH.

## 8. Partner management API

Предпочтительный contract:

-   `GET /api/v1/partner/storefront`
-   `POST /api/v1/partner/storefront`
-   `PATCH /api/v1/partner/storefront`
-   `POST /api/v1/partner/storefront/activate`
-   `POST /api/v1/partner/storefront/deactivate`

Названия можно адаптировать к conventions проекта.

Ownership source: `actor.partnerId`. Body/query не является security
source. Не доверять `partnerId`, `ownerId`, PublicSellerProfile ID или
CRM Partner ID из body.

## 9. Eligibility

PARTNER управляет storefront только если authenticated, role=PARTNER,
User ACTIVE, `partnerId != null`, onboarding/Partner state соответствует
approved selling access, CRM Partner reference валиден.

Pending Partner → 403. Legacy PARTNER без partnerId → controlled deny.
BUYER → 403. Anonymous → 401. MODERATOR не получает PARTNER-own write.
ADMIN behaviour определить явно.

## 10. RBAC

Не выдавать PARTNER широкие internal Catalog permissions.

При необходимости использовать узкие capabilities, например:

-   `storefront.read_own`
-   `storefront.create_own`
-   `storefront.update_own`
-   `storefront.activate_own`

Названия привести к текущим conventions. Проверить permission registry,
role matrix, descriptions, seed/reconciliation, stale cleanup,
ADMIN/MODERATOR/BUYER.

## 11. Public read API

Минимум:

`GET /api/v1/public/storefronts/:slug`

Anonymous route с whitelist DTO:

-   public storefront id/code;
-   slug;
-   displayName;
-   tagline;
-   description;
-   defaultLocale;
-   seller только через Step 1.11 safe projection;
-   activatedAt.

Не возвращать partnerId, CRM Partner ID, User ID, email, phone, website,
messenger, social links, tax/legal data, CRM notes, internal status,
audit/moderation identifiers.

## 12. Public product scope

Добавить:

-   `GET /api/v1/public/storefronts/:slug/products`
-   при компактной реализации
    `GET /api/v1/public/storefronts/:slug/products/:productSlug`

Predicate: Storefront ACTIVE AND Product.partnerId =
Storefront.partnerId AND Product public/published по Step 1.5.

Переиспользовать существующий safe Public Catalog projection.

List: server-side pagination, total, deterministic sort, только Product
конкретного Partner.

Detail: чужой/DRAFT/COMPLETE/REVIEWED/ARCHIVED → neutral 404;
ProductDraft N+1 и staged ProductMedia не видны.

## 13. Public seller identity

Step 1.11 authoritative. Storefront не может обходить
`PublicSellerProfile.visibilityMode`.

Не создавать второй seller identity.

ANONYMOUS не должен раскрывать CRM brand/name; VERIFIED_ALIAS использует
approved alias; PUBLIC_BRAND --- approved brand.

`displayName` не должен быть лазейкой обхода seller moderation. Если
безопасное правило невозможно без нового moderation workflow ---
`ARCHITECTURE DECISION REQUIRED`.

## 14. Anti-disintermediation

Step 1.11 policy применяется к `displayName`, `tagline`, `description`
до публичной активации.

Запретить email, phone, URL/domain, WhatsApp/Telegram, social handle,
direct booking instruction, QR/contact instruction. OCR/AI не
реализовывать. Private contacts не публиковать.

## 15. Audit

Аудировать:

-   `storefront.created`
-   `storefront.updated`
-   `storefront.activated`
-   `storefront.deactivated`

Metadata: actor, storefrontId, partnerId, timestamp, status transition,
безопасные changed fields. Public page views не писать в AuditLog.

## 16. Domain events

Проверить existing event/outbox architecture. Если lifecycle имеет
downstream business meaning, минимально рассмотреть
`PartnerStorefrontCreated`, `PartnerStorefrontActivated`,
`PartnerStorefrontDeactivated`.

Не создавать события без consumer/business meaning. Если создаются ---
через Outbox и transaction pattern проекта. Analytics не реализовывать
здесь.

## 17. Transactions / concurrency

Concurrent duplicate create одного Partner не создаёт две storefront. DB
unique invariant обязателен. Slug race защищён DB constraint и
controlled domain error.

Activate/deactivate --- безопасные guards/CAS согласно архитектуре.
Concurrent transitions не создают contradictory history/events.

## 18. Temporal readiness

Различать `createdAt`, `updatedAt`, `activatedAt`, `deactivatedAt`.

Audit/history должен отвечать: когда создана, кем, когда
активирована/деактивирована и кем.

## 19. Performance

Public product list без N+1, с server-side pagination, корректным total
по полному dataset, без artificial scan ceiling, с использованием
performant Public Catalog patterns.

Проверить необходимость индексов для partnerId, slug, status.
Product.partnerId уже существует из Step 1.3.

## 20. Migration

Если schema меняется: отдельная migration; `prisma migrate diff`
соответствует migration.sql; никаких `db push`; test DB получает
migration штатно; dev/prod вручную не менять.

## 21. Unit/integration tests

Минимум:

1.  slug normalization;
2.  reserved slug rejection;
3.  invalid slug rejection;
4.  public DTO whitelist;
5.  ownership из actor;
6.  pending Partner denied;
7.  seller visibility respected;
8.  anti-disintermediation validation;
9.  lifecycle guards;
10. temporal fields.

## 22. E2E proofs

Минимум:

1.  approved PARTNER создаёт DRAFT storefront;
2.  ownership = actor.partnerId;
3.  forged partnerId не работает;
4.  второй storefront того же Partner невозможен;
5.  duplicate slug → controlled conflict;
6.  reserved slug → validation error;
7.  pending PARTNER → 403;
8.  PARTNER без partnerId → controlled deny;
9.  BUYER → 403;
10. anonymous → 401 management;
11. PARTNER A не читает private state B;
12. PARTNER A не PATCH B;
13. owner PATCH own storefront;
14. activate → ACTIVE + activatedAt;
15. public GET ACTIVE → 200;
16. public GET DRAFT → neutral 404;
17. deactivate → public 404 + deactivatedAt;
18. public DTO без partnerId/CRM/User/private contacts;
19. ANONYMOUS seller не обходится;
20. VERIFIED_ALIAS projection корректен;
21. PUBLIC_BRAND projection корректен;
22. contact в tagline/description → reject;
23. products = только owner;
24. чужой Product → 404;
25. DRAFT Product → 404;
26. ARCHIVED Product → 404;
27. ProductDraft N+1 не утёк;
28. staged media не утекла;
29. pagination total корректен;
30. concurrent create/slug race безопасен;
31. audit lifecycle присутствует;
32. lifecycle timestamps корректны;
33. Public Marketplace contracts не изменились;
34. Partner Cabinet object scope не сломан.

Если реализованы domain events --- дополнительно доказать outbox/event
transactional consistency/idempotency.

## 23. Regression

Backend:

-   `npx tsc --noEmit`;
-   unit/integration;
-   storefront e2e;
-   полный serial backend e2e.

Особенно проверить public-catalog, seller-identity, partner-onboarding,
partner-cabinet, product-scope, moderation, change-proposal,
product-media, buyer-identity, auth/RBAC.

Frontend в этом проходе не изменять, кроме строго необходимого shared
compatibility fix. Если frontend не изменён --- явно указать.

## 24. Вне scope

Не начинать Storefront frontend, logo/hero UI, themes, subdomains/custom
domains, Checkout, Cart, Sale, Order, Booking, Payment/PSP, TravelHub
fee, split payment, Settlement/Payout, Partner Finance, Buyer Cabinet
expansion, Reviews, Chat, behavioral analytics, sales-channel
propagation, SEO implementation, SaaS billing/plans.

## 25. Definition of Done

Step 1.12.1 COMPLETED только если:

-   canonical PartnerStorefront model существует;
-   максимум одна storefront на Partner;
-   Product не дублируется;
-   explicit provisioning;
-   lifecycle/timestamps;
-   PARTNER own-scope;
-   pending/BUYER/anonymous denied;
-   IDOR закрыт;
-   public storefront contract;
-   public product scope;
-   только published own Product;
-   ProductDraft/staged media не утекли;
-   Step 1.11 seller visibility не обходится;
-   CRM/private contacts не утекли;
-   anti-disintermediation применяется;
-   audit присутствует;
-   concurrency/slug races безопасны;
-   migration корректна;
-   unit/e2e/regression green;
-   dev/prod DB/storage вручную не менялись;
-   frontend/Checkout/Order/Booking/Payment не начаты.

## 26. Формат отчёта

Вернуть:

### PHASE 1 --- STEP 1.12.1: STOREFRONT DOMAIN & BACKEND FOUNDATION --- ОТЧЁТ

1.  Current → Target mapping
2.  Architecture/domain ownership
3.  Prisma model + migration
4.  Lifecycle
5.  Provisioning
6.  Slug policy
7.  Partner management API
8.  Public API
9.  Product scope/reuse
10. PublicSellerProfile integration
11. Anti-disintermediation
12. RBAC/object scope/IDOR
13. Audit/events
14. Temporal model
15. Concurrency/idempotency
16. Performance/indexes
17. Unit results
18. E2E results
19. Full regression
20. Dev/prod impact
21. Issues found
22. Out of scope confirmation
23. ARCHITECTURE DECISION REQUIRED

Не переходить к Step 1.12.2.

Финальная строка:

`PHASE 1 STEP 1.12.1 COMPLETED — WAITING FOR REVIEW`
