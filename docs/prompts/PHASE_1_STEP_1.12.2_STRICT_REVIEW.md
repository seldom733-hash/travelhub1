# PHASE 1 --- STEP 1.12.2 --- STRICT IMPLEMENTATION REVIEW

## Роль

Ты выполняешь **строгий code/architecture/security review уже
реализованного PHASE 1 --- STEP 1.12.2 (Storefront Frontend / Public
Storefront / Business Identity)**.

Это **не следующий implementation step**. Не переходи к Step 1.12.3 и не
реализуй будущие функции.

Проверяй **фактический код, Prisma schema/migrations, API contracts,
frontend routes/components, RBAC, object scope, storage/media, tests,
ADR-0005/0006/0007 и реальные runtime predicates**. Не принимай отчёт
разработчика как доказательство сам по себе.

Исходный отчёт Step 1.12.2 заявляет: - storefront-owned business
identity; - structured public contacts только в Storefront; -
StorefrontMedia LOGO/HERO; - Partner Cabinet `/partner/storefront`; -
authenticated own-scope preview; - public `/store/:slug` и storefront
PDP; - independent publication channels MARKETPLACE /
PARTNER_STOREFRONT; - ACTIVE + entitlement ACTIVE как public gate; -
Marketplace isolation; - RU/AZ/EN system localization; -
SEO/noindex/accessibility/responsive; - ADR-0007 для Partner
CRM/acquisition boundary; - backend 290/290 e2e и frontend 91/91 tests.

Твоя задача --- независимо доказать или опровергнуть эти утверждения.

------------------------------------------------------------------------

# 1. Жёсткие ограничения review

1.  **Не переходить к Step 1.12.3.**
2.  **Не реализовывать** Checkout/Cart, Sale/Order/Booking changes,
    Payment/PSP, commission engine, Settlement/Payout, recurring
    billing, subscription checkout/pricing, Partner Finance, Partner CRM
    persistence, analytics engine, custom domains/subdomains, marketing
    automation.
3.  Не превращать review в redesign без доказанной проблемы.
4.  Не менять утверждённые ADR без `ARCHITECTURE DECISION REQUIRED`.
5.  Не использовать dev/prod данные для destructive tests.
6.  Все DB regression/e2e проверки --- через изолированную test DB.
7.  Не считать существующий тест доказательством, если он проверяет не
    тот security/runtime predicate.
8.  Если найден дефект --- воспроизвести его тестом или дать точное
    кодовое доказательство.
9.  Исправлять только подтверждённые review issues.
10. После fixes повторить затронутые тесты и полный regression.

------------------------------------------------------------------------

# 2. Storefront business identity

Проверь фактическую модель `PartnerStorefront`.

Должны быть storefront-owned business fields, заявленные Step 1.12.2: -
businessName; - tagline; - description; - countryCode; - cityCode; -
publicPhone; - publicEmail; - websiteUrl; - whatsapp; - socialLinks; -
defaultLocale.

Проверь:

-   эти поля принадлежат Catalog/Storefront, а не являются public
    serialization `crm.Partner`;
-   raw CRM Partner не возвращается public API;
-   legal name, tax data, registration data, notes, internal IDs,
    onboarding data, User data, entitlement/audit fields не протекают
    наружу;
-   `PublicSellerProfile` Step 1.11 остаётся Marketplace identity и не
    стал authoritative Storefront identity;
-   изменение Storefront business identity не изменяет Marketplace
    seller identity;
-   forged `partnerId`, entitlement, status, actor/audit/timestamp
    fields невозможно записать через Partner API;
-   PATCH действительно whitelist-based.

Если Storefront identity всё ещё неявно зависит от approved Marketplace
alias/brand там, где по ADR-0006/0007 должна быть независима, зафиксируй
это.

------------------------------------------------------------------------

# 3. Marketplace ↔ Storefront isolation --- критический блок

Докажи двустороннюю изоляцию.

## Marketplace

Marketplace Card/Search/Category/PDP не должны раскрывать: - Storefront
publicPhone; - publicEmail; - websiteUrl; - whatsapp; - socialLinks; -
Storefront businessName, если он не является отдельно разрешённой
Marketplace identity; - Storefront entitlement; - Storefront internal
IDs/configuration; - Storefront media/storage details.

Проверь не только JSON DTO, но и: - serializer/mappers; - raw
query/select/include; - frontend rendering; - accidental spreading
objects; - error responses; - media endpoints.

## Storefront

Storefront public API не должен раскрывать: - crm.Partner raw object; -
User; - legal/tax data; - onboarding/application data; - internal
moderation/audit fields; - entitlementStatus; - storage
key/bucket/credentials; - private/staged media metadata.

Добавь regression tests, если какой-либо boundary сейчас доказан
недостаточно.

------------------------------------------------------------------------

# 4. Public availability predicate

Проверь, что public Storefront существует **только** при одновременном
выполнении:

`Storefront.status = ACTIVE` AND `Storefront.entitlementStatus = ACTIVE`

Проверь минимум: - DRAFT + ACTIVE entitlement → public 404; - ACTIVE +
NONE → public 404; - ACTIVE + SUSPENDED → public 404; - ACTIVE + EXPIRED
→ public 404; - INACTIVE + ACTIVE → public 404; - ACTIVE + ACTIVE →
public 200.

Ответ для непубличных состояний должен быть neutral 404 без раскрытия
причины.

Проверь одинаковость predicate для: - Storefront home; - Storefront
PDP; - Storefront media; - logo; - hero; - product listing; - любых
public helper endpoints.

Не должно быть endpoint, через который suspended/draft Storefront можно
частично прочитать.

------------------------------------------------------------------------

# 5. Preview security

Проверь `/partner/storefront/preview` и backend preview contracts.

Требования: - authentication mandatory; - только PARTNER; - own-scope по
`actor.partnerId`; - нельзя передать forged partnerId; - Partner A не
видит Partner B; - ADMIN/MODERATOR/BUYER не получают Partner own-preview
через случайный ALL_PERMISSIONS bypass; - DRAFT preview не делает
Storefront public; - preview не меняет lifecycle; - preview не меняет
entitlement; - preview noindex; - staged/private logo/hero доступны
только владельцу через безопасный механизм; - preview URL/media URL не
превращаются в долговечный public bypass; - signed URL не должен давать
чрезмерно длинный или бессрочный доступ.

Особенно проверь возможность получить staged media напрямую после
копирования URL из preview.

------------------------------------------------------------------------

# 6. Product publication channels

Проверь canonical model:

`ProductPublicationChannel` - MARKETPLACE - PARTNER_STOREFRONT

Lifecycle Product и distribution должны оставаться независимыми.

Докажи четыре состояния:

1.  no channels;
2.  MARKETPLACE only;
3.  PARTNER_STOREFRONT only;
4.  BOTH.

Для опубликованного Product:

### MARKETPLACE only

-   есть в Marketplace;
-   нет в Storefront.

### STOREFRONT only

-   нет в Marketplace list/search/category/PDP;
-   есть только в Storefront своего Partner при ACTIVE+ACTIVE
    Storefront.

### BOTH

-   есть в обоих каналах;
-   используется один canonical Product;
-   нет Product copy/fork.

### no channels

-   нет ни в одном public channel.

Проверь: - own-scope update channels; - чужой Product нельзя
переключить; - forged product/partner ownership; -
audit/ProductHistory; - deterministic handling duplicate channel
values; - invalid enum → controlled validation error; - изменение
channels не должно само менять Product lifecycle/moderation status.

------------------------------------------------------------------------

# 7. Storefront product ownership

Критический predicate Storefront Product:

-   Product принадлежит `storefront.partnerId`;
-   Product публично publishable;
-   Product имеет `PARTNER_STOREFRONT`;
-   Storefront ACTIVE;
-   entitlement ACTIVE.

Попытайся получить: - чужой Partner Product через productSlug; -
MARKETPLACE-only Product через Storefront PDP; - DRAFT; -
archived/unpublished; - staged ProductDraft; - Product с тем же slug
другого Partner; - media чужого/непубличного Product.

Все должны завершаться neutral 404 там, где endpoint public.

------------------------------------------------------------------------

# 8. Storefront contacts / anti-disintermediation boundary

Step 1.11 Marketplace anti-disintermediation нельзя ослабить.

Проверь: - Product title/description/captions/altText по-прежнему
проходят Marketplace policy; - Storefront contacts разрешены только как
structured storefront-owned fields; - контакты нельзя протащить через
arbitrary HTML; - website/social URLs имеют allowlist schemes; -
`javascript:`, `data:`, unsafe protocols запрещены; - socialLinks имеют
ожидаемый shape и whitelist; - phone/email validation не допускает
очевидные malformed payloads; - external links используют безопасные
`rel`/`noopener` там, где это нужно; - Storefront contact policy не
становится обходом Marketplace projection.

Если один Product используется в обоих каналах, Storefront contacts не
должны требовать помещения контактов в Product content.

------------------------------------------------------------------------

# 9. XSS / injection / unsafe rendering

Проверь все Partner-entered поля: - businessName; - tagline; -
description; - contacts; - social links; - media metadata; - Product
data, отображаемые Storefront.

Ищи: - `dangerouslySetInnerHTML`; - raw HTML rendering; - unsafe URL
interpolation; - CSS injection; - JS injection; - malformed external
links; - open redirect-like behavior; - unsafe SVG/upload handling.

Theme preset должен быть whitelist-based. Произвольный CSS/JS/HTML
запрещён.

------------------------------------------------------------------------

# 10. Storefront media security

Проверь `StorefrontMedia` LOGO/HERO.

Требования: - private-by-default storage; - own-scope upload/delete; -
MIME validation; - actual file validation, а не доверие только
`Content-Type`; - size limits; - safe image processing; - stable public
endpoint не раскрывает storage internals; - public bytes только
ACTIVE+ACTIVE; - staged/private bytes только authenticated owner
preview; - delete/replacement не позволяет IDOR; - media ID другого
Storefront не резолвится; - presigned URL expiry разумный; - storage key
не user-controlled таким образом, чтобы получить path/key collision; -
удаление media не удаляет чужой объект; - orphan behavior понятен.

Если текущая реализация принимает SVG, отдельно проверить XSS-risk. Если
SVG не нужен --- предпочтительно reject.

------------------------------------------------------------------------

# 11. Entitlement boundary

Проверь, что PARTNER: - может видеть собственное entitlement state, если
это предусмотрено UX; - не может менять entitlement; - не может forged
PATCH/POST entitlementStatus; - не может активировать Storefront без
ACTIVE entitlement.

ADMIN operational entitlement command Step 1.12.1: -
permission-protected; - audit; - controlled transitions; - не является
fake Billing; - не создаёт Payment/Invoice/Subscription.

Убедись, что Catalog не превратился в Billing authority сверх уже
принятого ADR-0006.

------------------------------------------------------------------------

# 12. Partner Cabinet UX

Проверь реальные состояния `/partner/storefront`:

-   no Storefront → Create CTA;
-   DRAFT + NONE → configuration available, activation blocked;
-   DRAFT + ACTIVE → activation available;
-   ACTIVE + ACTIVE → public URL/open/preview/deactivate;
-   SUSPENDED/EXPIRED → public unavailable, configuration retained;
-   INACTIVE → editable, reactivation только при entitlement.

Проверь: - loading; - empty; - API error; - validation error; - 401; -
403; - 404; - double submit; - slow request; - refresh/deep link; -
stale cached user/storefront state.

Не должно быть ложного logout при AbortError/network error --- ранее
исправленный auth regression не должен вернуться.

------------------------------------------------------------------------

# 13. Public Storefront UX

Проверь `/store/:slug` и `/store/:slug/products/:productSlug`.

Public client: - не должен отправлять Authorization; - не должен
использовать internal API; - не должен зависеть от Partner token; -
logged-in пользователь должен получать тот же public projection.

Проверь: - home; - header/logo; - hero; - about; - location; - product
grid; - contacts; - footer; - PDP gallery; - tariffs; - availability; -
safe external links; - loading/error/404 states; - responsive behavior.

Storefront должен выглядеть как самостоятельный business site, а не как
internal cabinet или копия `/search`.

------------------------------------------------------------------------

# 14. RU / AZ / EN

Проверь: - system UI strings; - locale selector; - persistence; -
document language; - geography localization; - `countryCode/cityCode`
остаются canonical; - смена locale не изменяет business identity; -
`defaultLocale` не подменяет identity; - business-entered content сейчас
**не переводится автоматически**.

Не реализовывать DD-001/DD-002 в этом review.

Если отсутствие multilingual Product content создаёт UX limitation ---
документировать как deferred, не чинить самовольно.

------------------------------------------------------------------------

# 15. SEO / indexing

Проверь: - public ACTIVE+ACTIVE Storefront indexable; - preview
noindex; - DRAFT noindex/unavailable; - INACTIVE noindex/unavailable; -
suspended/expired noindex/unavailable; - canonical URL; - title/meta
description; - OpenGraph basics; - Product metadata; - отсутствуют
canonical collisions Marketplace vs Storefront PDP.

Если один canonical Product доступен одновременно в Marketplace и
Storefront, отдельно оцени SEO duplicate-content risk. Если для решения
нужен продуктовый/SEO ADR --- отметить, но не внедрять произвольную
стратегию без решения.

------------------------------------------------------------------------

# 16. Accessibility / responsive

Проверь минимум: - semantic headings; - labels; - alt text; - keyboard
gallery; - focus states; - buttons vs links semantics; - external link
indication при необходимости; - mobile/tablet/desktop; - long business
names; - long translated system labels RU/AZ/EN; - missing logo/hero; -
empty contacts; - large product count.

------------------------------------------------------------------------

# 17. Temporal data / audit readiness

С учётом будущей аналитики проверь, что Storefront lifecycle сохраняет
достаточные timestamps/audit:

-   createdAt;
-   updatedAt;
-   activatedAt;
-   deactivatedAt;
-   actors;
-   entitlement transition audit;
-   channel change history.

Не добавляй analytics engine.

Но если текущие действия перезаписывают исторически значимые timestamps
так, что невозможно определить реальное время
создания/активации/деактивации, это review issue.

Проверь timezone discipline: backend timestamps должны быть однозначными
(предпочтительно UTC/DB timestamptz или эквивалентная согласованная
модель).

------------------------------------------------------------------------

# 18. Performance / N+1

Проверь Storefront list/home/PDP: - seller/business identity; -
availability; - media; - tariffs; - products; - channels.

Ищи N+1 запросы и неограниченные выборки.

Проверь: - pagination; - deterministic sort; - total; - max page size; -
indexes для slug/status/partnerId/channels; - query plan очевидно
критических predicates, если необходимо.

Не проводить premature optimization, но очевидные N+1/unbounded queries
исправить.

------------------------------------------------------------------------

# 19. Migration review

Проверь все миграции Step 1.12.x, особенно: -
`add_partner_storefront`; - `add_storefront_channels_entitlement`; -
`add_storefront_business_identity`.

Требования: - migrations immutable после применения; - clean replay с
нуля; - `migrate deploy`; - no `db push`; - schema ↔ migrations без
drift; - constraints/indexes соответствуют Prisma; - defaults
безопасны; - legacy data backfill детерминирован; - data loss
отсутствует либо явно обоснован; - prod bookkeeping автоматически не
переписывается.

Повтори clean test DB migration replay.

------------------------------------------------------------------------

# 20. ValidationPipe issue --- обязательное расследование

В отчёте отмечено:

`enableImplicitConversion` в dev ValidationPipe ломает array-of-objects,
а e2e использует другой pipe `{ whitelist, transform }`.

Это потенциально опасное расхождение **production/dev runtime vs e2e
runtime**.

Обязательно:

1.  Найди фактическую конфигурацию ValidationPipe production/dev.
2.  Найди e2e bootstrap configuration.
3.  Докажи, одинаково ли обрабатываются реальные Storefront/Category
    Schema DTO.
4.  Воспроизведи проблему минимальным integration/e2e тестом с
    production-equivalent pipe.
5.  Если production API реально может ломать валидные array-of-objects
    --- это **REVIEW FIX REQUIRED**, а не «dev-only quirk».
6.  Исправление не должно ослаблять whitelist/forbid/transform
    validation.
7.  После исправления tests должны использовать максимально
    production-equivalent global pipe, если нет документированной
    причины иначе.

Не оставляй этот пункт без доказанного вывода.

------------------------------------------------------------------------

# 21. ADR consistency review

Сверь: - ADR-0005 Seller Identity Projection; - ADR-0006 Storefront
Commercial Model; - ADR-0007 Partner CRM and Acquisition Boundary; -
ADR-0001 cross-domain ownership, где применимо.

Проверь отсутствие противоречий по: - Marketplace identity; - Storefront
identity; - contacts; - Product canonical ownership; - publication vs
acquisition; - CRM ownership; - Billing authority; - cross-domain
reads/writes.

Если обнаружено реальное противоречие, выдай:

`ARCHITECTURE DECISION REQUIRED`

и точно опиши конфликт. Не переписывай ADR молча.

------------------------------------------------------------------------

# 22. Deferred Decisions Map

Проверь, что Step 1.12.2 не реализовал преждевременно отложенные
решения, включая:

-   multilingual Product Content;
-   AI translation;
-   Storefront trial;
-   SaaS plans;
-   Storefront pricing;
-   recurring billing;
-   Trial → Subscription;
-   failed-payment grace period;
-   Storefront CRM entitlements;
-   analytics capability matrix;
-   custom domain/subdomain;
-   Marketplace commission rates;
-   Storefront transaction economics;
-   Subscription authoritative domain;
-   professional translation;
-   trial anti-abuse/data retention;
-   subscription cancellation;
-   SaaS capability matrix.

Если foundation лишь оставляет extension point --- это нормально. Если
конкретное deferred product/commercial решение было самовольно
зафиксировано --- review issue.

------------------------------------------------------------------------

# 23. Required security abuse cases

Минимально попытайся доказать следующие deny-cases:

1.  anonymous → Partner Storefront management;
2.  BUYER → Partner Storefront management;
3.  MODERATOR → Partner own management;
4.  ADMIN → Partner own endpoint, если contract intentionally
    PARTNER-only;
5.  pending/unapproved PARTNER;
6.  PARTNER без partnerId;
7.  inactive CRM Partner;
8.  Partner A → Partner B Storefront/media/preview;
9.  forged partnerId;
10. forged entitlementStatus;
11. forged lifecycle status;
12. forged audit/timestamps;
13. public DRAFT Storefront;
14. public INACTIVE Storefront;
15. public SUSPENDED/EXPIRED entitlement;
16. Storefront-only Product через Marketplace;
17. Marketplace-only Product через Storefront;
18. чужой Product через Storefront slug/PDP;
19. staged media через public endpoint;
20. copied preview media URL anonymous access;
21. unsafe website/social protocol;
22. arbitrary HTML/script;
23. storage key/bucket leakage;
24. contacts leakage Marketplace;
25. Authorization accidentally sent from public Storefront frontend.

------------------------------------------------------------------------

# 24. Tests to run

Как минимум:

### Backend

-   `tsc --noEmit`;
-   unit;
-   Storefront e2e;
-   Public Catalog e2e;
-   Seller Identity e2e;
-   Partner Cabinet;
-   Partner Onboarding;
-   Product Scope;
-   Product Media;
-   Moderation / Change Proposal;
-   Auth/RBAC;
-   полный serial regression;
-   clean migration replay.

### Frontend

-   `tsc --noEmit`;
-   vitest;
-   production build;
-   Storefront component/page tests;
-   public-client no-auth tests.

### Browser/runtime

Проверить production-equivalent build/runtime:

A. no Storefront → create DRAFT\
B. NONE entitlement → configure yes / activate no / public 404\
C. entitlement ACTIVE → activate → public site\
D. identity/contact/logo/hero public\
E. Marketplace zero Storefront-contact leakage\
F. Marketplace-only / Storefront-only / BOTH\
G. SUSPENDED/EXPIRED → Storefront unavailable, Marketplace unaffected\
H. preview owner-only + noindex + anonymous deny\
I. RU/AZ/EN system labels/geography\
J. logged-in visitor Storefront → no Authorization/internal API\
K. unsafe contact URL rejected\
L. staged media cannot be reused as anonymous public URL\
M. production-equivalent ValidationPipe handles legitimate DTOs
correctly.

Console errors должны быть 0 для happy-path scenarios.

------------------------------------------------------------------------

# 25. Review outcome

После проверки возможны только два основных результата.

## Вариант A --- проблем нет

Выдать:

`PHASE 1 STEP 1.12.2 REVIEW PASSED`

И приложить краткую evidence matrix: - area; - code inspected; - tests
executed; - result.

Не переходить к Step 1.12.3.

## Вариант B --- найдены проблемы

Сначала исправить подтверждённые проблемы в рамках Step 1.12.2.

Каждый fix оформить:

`FIX N — <название>`

Для каждого: - проблема; - риск; - root cause; - изменённые файлы; -
исправление; - тест, который падал/добавлен; - результат.

После fixes повторить полный regression и выдать:

`PHASE 1 STEP 1.12.2 REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

Не переходить к Step 1.12.3.

Если проблема требует изменения утверждённой архитектуры:

`ARCHITECTURE DECISION REQUIRED`

с вариантами и последствиями --- без самовольного решения.

------------------------------------------------------------------------

# 26. Финальный отчёт review

Финальный отчёт должен содержать:

1.  Review verdict.
2.  Files/modules inspected.
3.  Marketplace isolation result.
4.  Storefront public predicate result.
5.  Preview security result.
6.  Publication channels result.
7.  Business identity/contact result.
8.  Media/storage security result.
9.  RBAC/object-scope result.
10. XSS/unsafe URL result.
11. Entitlement/Billing boundary result.
12. RU/AZ/EN result.
13. SEO/accessibility result.
14. Temporal/audit result.
15. Performance/N+1 result.
16. Migration replay/drift result.
17. ValidationPipe investigation result.
18. ADR consistency result.
19. Deferred Decisions compliance.
20. Unit/e2e/frontend/browser results.
21. Fixes made, если были.
22. Remaining issues/debt.
23. `ARCHITECTURE DECISION REQUIRED`, если есть.
24. Out-of-scope confirmation.

**Не доверяй количеству тестов из предыдущего отчёта --- запусти и
проверь фактический результат.**

------------------------------------------------------------------------

`PHASE 1 STEP 1.12.2 — STRICT REVIEW START`
