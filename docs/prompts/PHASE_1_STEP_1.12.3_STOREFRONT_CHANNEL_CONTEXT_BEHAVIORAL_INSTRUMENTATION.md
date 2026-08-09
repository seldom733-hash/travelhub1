# PHASE 1 --- STEP 1.12.3: STOREFRONT CHANNEL CONTEXT & BEHAVIORAL INSTRUMENTATION FOUNDATION

## Роль и цель

Реализуй **только PHASE 1 --- STEP 1.12.3**.

Цель шага --- заложить минимальную, каноническую и privacy-safe основу
для будущей Storefront analytics и дальнейшей propagation acquisition
context, **не реализуя саму аналитику, CRM, Lead, Checkout, Order,
Payment, Billing или коммерческие расчёты**.

После Step 1.12.1/1.12.2 уже существуют: - canonical `Product`; -
`ProductPublicationChannel` с `MARKETPLACE` / `PARTNER_STOREFRONT`; -
`PartnerStorefront` (`SF-*`); - Storefront lifecycle; -
entitlement-ready state; - Storefront-owned business identity; - public
Storefront `/store/:slug`; - Storefront PDP; - Marketplace ↔ Storefront
isolation; - ADR-0005, ADR-0006, ADR-0007.

Этот Step **не переопределяет** эти решения.

------------------------------------------------------------------------

# 1. Ключевое архитектурное разделение

Не смешивать:

## Publication channel

Отвечает на вопрос:

> Где Product разрешено публиковать?

Существующий authoritative contract:

-   `MARKETPLACE`
-   `PARTNER_STOREFRONT`

Publication channel остаётся Catalog-owned distribution state.

## Acquisition/source context

Отвечает на вопрос:

> Через какой пользовательский канал/контекст возникло конкретное
> посещение, взаимодействие или в будущем коммерческая операция?

Step 1.12.3 должен определить **стабильный shared contract** для
acquisition/source context, пригодный для дальнейшей propagation, но
**не добавлять его преждевременно в Order/Sale/Payment**, если эти flows
ещё не входят в текущий scope.

Минимально поддержать:

-   `MARKETPLACE`
-   `PARTNER_STOREFRONT`
-   `DIRECT`

Дополнительные future values (`CUSTOM_DOMAIN`, `MANUAL_CRM`, `API`,
etc.) не вводить без реальной необходимости. Не хардкодить будущую
коммерческую модель.

В коде и документации должно быть явно видно:

`publicationChannel != acquisitionSource`

Наличие Product в `PARTNER_STOREFRONT` не доказывает, что будущая сделка
была acquired через Storefront.

------------------------------------------------------------------------

# 2. Architecture decision gate

Перед реализацией определи owner behavioral instrumentation.

Нужно выбрать минимальную архитектуру, совместимую с существующими
bounded contexts и будущим Step 1.13B.

Не создавать полноценный Analytics domain только ради этого шага, если
он ещё не предусмотрен архитектурой.

Если для durable behavioral-event storage требуется новый bounded
context / новая ownership-модель, которую существующие ADR не определяют
однозначно, остановись и выдай:

`ARCHITECTURE DECISION REQUIRED`

с вариантами, последствиями и рекомендуемым минимальным решением.

Нельзя молча сделать Catalog владельцем всей будущей analytics только
потому, что Storefront сейчас Catalog-owned.

------------------------------------------------------------------------

# 3. Storefront behavioral event contract

Создай canonical contracts минимум для:

-   `StorefrontViewed`
-   `StorefrontProductImpression`
-   `StorefrontProductViewed`
-   `StorefrontContactClicked`

Допустимо добавить:

-   `StorefrontCtaClicked`

только если существует реальный CTA, который нельзя корректно выразить
одним из обязательных событий.

Не создавать speculative events без реального producer.

------------------------------------------------------------------------

# 4. Минимальный event envelope

Каждое behavioral event должно иметь как минимум:

-   `eventId` --- globally unique;
-   `eventType`;
-   `occurredAt` --- фактическое UTC-время пользовательского действия;
-   `storefrontId` --- стабильный internal/public-safe identifier `SF-*`
    или canonical id согласно существующему контракту;
-   `productId?` --- только для product-related events;
-   `sessionId` / privacy-safe anonymous visitor-session context;
-   `authenticatedUserId?` --- только если пользователь уже
    authenticated; anonymous tracking не требует login;
-   `acquisitionSource`;
-   `locale`;
-   `path` / page context;
-   минимальный event-specific payload.

Не включать без необходимости: - email; - phone; - WhatsApp number; -
contact value; - raw IP; - User profile; - CRM Partner object; -
legal/tax data; - free-form request dump; -
Authorization/cookies/tokens; - storage credentials; - arbitrary
headers.

`StorefrontContactClicked` должен хранить, например:

`contactType = PHONE | EMAIL | WHATSAPP | WEBSITE | SOCIAL`

но **не само контактное значение**, если оно не требуется доказанной
бизнес-задачей.

------------------------------------------------------------------------

# 5. Event time semantics

`occurredAt` --- время фактического действия пользователя, а не время
batch processing или чтения события.

Использовать согласованную UTC temporal model.

Если вводятся дополнительно: - `receivedAt`; - `processedAt`;

они должны иметь отдельную семантику и не подменять `occurredAt`.

Не использовать `updatedAt` сущности Storefront/Product как время
behavioral action.

Основа должна быть пригодна для будущих: - traffic; - visitors; -
views; - funnel; - conversion; - product performance; -
geography/seasonality; - attribution.

Саму аналитику сейчас не строить.

------------------------------------------------------------------------

# 6. Anonymous session / visitor foundation

Нужен минимальный privacy-safe anonymous context.

Требования:

-   anonymous visitor может генерировать события без регистрации;
-   несколько page views одной browser session можно связать;
-   `sessionId` не должен содержать PII;
-   не использовать browser fingerprinting;
-   не строить cross-device identity graph;
-   не пытаться deanonymize visitor;
-   не сохранять raw IP в behavioral payload;
-   identifier должен быть opaque/random;
-   rotation/expiry должны быть разумными;
-   malformed client-supplied identifiers валидируются/заменяются;
-   нельзя позволять клиенту подделывать privileged identity
    (`authenticatedUserId`, partnerId и т.п.).

Если нужен persistent visitorId сверх sessionId --- обоснуй. Не добавляй
его автоматически.

Privacy/CMP/cookie-consent platform в этом Step не реализовывать. Если
выбранный transport/storage юридически требует отдельного consent
decision, зафиксировать это как deferred/product/privacy decision, а не
придумывать политику самостоятельно.

------------------------------------------------------------------------

# 7. Trusted vs client-supplied fields

Сервер должен сам выводить или проверять authoritative context, где это
возможно.

Клиент не должен иметь возможность произвольно forged:

-   `storefrontId`;
-   `partnerId`;
-   `productId` вне текущего storefront context;
-   `authenticatedUserId`;
-   publication state;
-   entitlement;
-   Product ownership;
-   event timestamps далеко в прошлом/будущем;
-   internal actor/audit fields.

Если event endpoint принимает `storefrontSlug` / `productSlug`, сервер
должен резолвить canonical IDs и проверять public context.

Не доверять клиентскому `partnerId`.

------------------------------------------------------------------------

# 8. Public availability и event validity

Behavioral instrumentation не должна становиться side-channel для
скрытых данных.

Для событий public Storefront:

-   DRAFT Storefront → нельзя трекать как публично просмотренный;
-   INACTIVE → нельзя;
-   entitlement NONE/SUSPENDED/EXPIRED → нельзя;
-   Product не принадлежит Storefront → нельзя;
-   MARKETPLACE-only Product → нельзя считать Storefront product view;
-   DRAFT/ARCHIVED/unpublished Product → нельзя;
-   staged/private media → не участвуют.

Используй те же authoritative public predicates, что Step 1.12.2, либо
общий shared resolver. Не создавай расходящуюся копию business logic.

Для invalid/non-public resource предпочтительно neutral behavior без
раскрытия скрытого состояния.

------------------------------------------------------------------------

# 9. Event ingestion API

Если нужен HTTP ingestion endpoint, он должен быть узким и публично
безопасным.

Требования:

-   строгий DTO whitelist;
-   enum validation;
-   payload size limit;
-   controlled errors;
-   никакого arbitrary JSON event dump;
-   никакого generic `eventType: string` с бесконтрольным payload;
-   защита от очевидного event spam/abuse должна быть рассмотрена;
-   ingestion не должен требовать Authorization для anonymous Storefront
    visitor;
-   если Authorization присутствует, она не должна быть обязательна для
    public event;
-   authenticated identity определяется сервером, а не client body;
-   endpoint не раскрывает внутренние данные в response.

Не строить тяжёлую anti-fraud платформу. Минимальные rate/abuse controls
--- если инфраструктура уже есть или это необходимо для безопасного
public endpoint.

------------------------------------------------------------------------

# 10. Delivery / durability / idempotency

Определи ожидаемую семантику behavioral events.

Минимальные требования:

-   `eventId` позволяет deduplication;
-   повторная доставка одного `eventId` не должна искусственно удваивать
    future metrics;
-   ingestion failure не должен ломать public Storefront navigation;
-   analytics instrumentation не должна делать страницу недоступной
    из-за временного сбоя;
-   клиентский retry должен быть bounded;
-   не создавать бесконечный retry loop;
-   event persistence/delivery failure должен быть observable.

Если используется outbox/event bus, не смешивать behavioral events с
business domain events семантически.

Если используется отдельное durable event store/table --- owner должен
быть архитектурно определён согласно §2.

------------------------------------------------------------------------

# 11. AuditLog ≠ behavioral analytics

Строго разделить:

## AuditLog

Кто из authenticated actors изменил бизнес-состояние.

Примеры: - storefront.updated; - storefront.activated; -
entitlement_changed.

## Behavioral event

Что посетитель сделал на public Storefront.

Примеры: - StorefrontViewed; - StorefrontProductViewed; -
StorefrontContactClicked.

Не писать page views/clicks в AuditLog.

Не использовать AuditLog как будущий analytics event store.

------------------------------------------------------------------------

# 12. StorefrontViewed

Событие должно фиксировать реальное посещение публичной Storefront page.

Минимум: - eventId; - occurredAt; - storefrontId; - sessionId; -
acquisitionSource; - locale; - path.

Не считать preview как public `StorefrontViewed`.

Если нужен preview telemetry для engineering --- это отдельная telemetry
concern, не Storefront business analytics.

------------------------------------------------------------------------

# 13. StorefrontProductImpression

Импрессия означает, что Product реально был представлен пользователю в
Storefront product list/grid.

Не генерировать impression просто потому, что Product присутствует в API
response, если UI его фактически не отобразил.

Если точная viewport visibility сейчас неоправданно сложна, выбери и
задокументируй минимальную семантику (например rendered card
impression), но не называй API-fetch «impression» без оговорки.

Минимум: - storefrontId; - productId; - sessionId; - occurredAt; -
locale; - acquisitionSource; - placement/context при необходимости.

Не включать Product title/description snapshot без необходимости.

------------------------------------------------------------------------

# 14. StorefrontProductViewed

Генерируется при фактическом открытии public Storefront PDP.

Проверить: - Product принадлежит Storefront; - Product public; -
`PARTNER_STOREFRONT` enabled; - Storefront ACTIVE + entitlement ACTIVE.

Не путать с Marketplace `ProductViewed`, который относится к будущему
Step 1.13B.

------------------------------------------------------------------------

# 15. StorefrontContactClicked

Обязательное событие для structured Storefront contacts.

Минимальные типы: - PHONE; - EMAIL; - WHATSAPP; - WEBSITE; - SOCIAL.

Событие фиксирует **намерение/клик**, а не доказанную коммуникацию или
продажу.

Не называть его: - LeadCreated; - ContactEstablished; - Conversion; -
Sale.

Не сохранять contact value.

Если social link имеет platform, допустимо сохранить нормализованный
`platform` как non-sensitive event dimension.

------------------------------------------------------------------------

# 16. Acquisition source semantics

Для Storefront public interactions базовый source обычно:

`PARTNER_STOREFRONT`

Но не хардкодить коммерческий вывод «значит Storefront-originated sale».

`DIRECT` использовать только при чётко определённой семантике. Если
текущий Step не может надёжно отличить DIRECT от PARTNER_STOREFRONT без
referral/entry-context contract, не симулировать точность.

Если source определяется по entry context/referrer/URL,
задокументировать: - trusted/untrusted fields; - fallback; -
normalization; - privacy behavior.

Не строить full attribution model.

------------------------------------------------------------------------

# 17. Publication vs acquisition tests

Обязательные proofs:

1.  Product `MARKETPLACE` only:
    -   Marketplace publication существует;
    -   Storefront behavioral product event для него отвергается/не
        принимается.
2.  Product `PARTNER_STOREFRONT` only:
    -   Storefront event допустим;
    -   это не изменяет publication state.
3.  Product BOTH:
    -   Storefront interaction получает Storefront acquisition context;
    -   существование MARKETPLACE channel не меняет источник текущего
        Storefront interaction.
4.  Product без channel:
    -   public Storefront product event недопустим.

Ни одно behavioral event не должно изменять `ProductPublicationChannel`.

------------------------------------------------------------------------

# 18. Marketplace boundary / Step 1.13B

Step 1.12.3 **не должен реализовывать полный Marketplace behavioral
tracking**.

Не реализовывать сейчас: - MarketplaceViewed; - SearchPerformed; -
CategoryViewed; - Marketplace ProductImpression; - Marketplace
ProductViewed; - Marketplace funnel.

Это scope будущего **Step 1.13B --- Marketplace Behavioral Events
Foundation**.

Но shared envelope/session/source infrastructure Step 1.12.3 должна быть
переиспользуемой Step 1.13B без второй несовместимой event system.

Storefront-specific event names не должны конфликтовать с будущими
Marketplace events.

------------------------------------------------------------------------

# 19. Correlation / request IDs boundary

Не создавать параллельную tracing architecture.

Если `requestId`, `correlationId`, `causationId` уже существуют ---
корректно использовать существующие contracts.

Если ещё нет --- не реализовывать весь будущий correlation
infrastructure внутри 1.12.3.

Для этого Step обязательны: - eventId; - occurredAt; - session
context; - storefront/product/source context.

Будущая общая correlation/causation propagation должна иметь возможность
дополнить envelope без breaking redesign.

------------------------------------------------------------------------

# 20. Frontend instrumentation

Добавить минимальную instrumentation только в public Storefront:

-   `/store/:slug`;
-   `/store/:slug/products/:productSlug`;
-   product cards/impressions;
-   structured contact clicks.

Требования: - public API client; - не отправлять Authorization
специально ради analytics; - tracking failure не ломает UI/navigation; -
отсутствие duplicate fire из-за React rerender/StrictMode; - page
refresh создаёт корректное новое событие действия, но retry того же
eventId deduplicated; - click event отправляется до/параллельно
navigation без заметной задержки; - не блокировать
phone/mailto/WhatsApp/external website action из-за analytics failure; -
не отправлять PII из DOM/contact href.

Рассмотреть `sendBeacon`/`keepalive` или существующий безопасный
механизм, если это соответствует стеку. Не вводить новую тяжёлую
frontend analytics dependency без необходимости.

------------------------------------------------------------------------

# 21. Security / privacy abuse cases

Проверить минимум:

1.  forged storefrontId;
2.  forged productId;
3.  Product другого Partner;
4.  MARKETPLACE-only Product как Storefront event;
5.  DRAFT Product;
6.  DRAFT Storefront;
7.  INACTIVE Storefront;
8.  NONE/SUSPENDED/EXPIRED entitlement;
9.  forged authenticatedUserId;
10. forged partnerId;
11. malformed sessionId;
12. duplicate eventId;
13. arbitrary eventType;
14. oversized payload;
15. arbitrary nested JSON;
16. raw contact value в payload;
17. raw email/phone leakage;
18. raw IP persisted in event payload;
19. Authorization/token leakage;
20. event ingestion response leaking internal state;
21. spam/replay behavior;
22. event failure breaking public page;
23. React rerender duplicate event;
24. preview counted as public Storefront view.

------------------------------------------------------------------------

# 22. Temporal requirements

Добавить tests, доказывающие: - `occurredAt` присутствует; - UTC
semantics; - event order не выводится из auto-increment ID; - duplicate
retry не создаёт вторую logical event; - future/past timestamp abuse
контролируется, если timestamp принимается от клиента.

Предпочтительно authoritative server timestamp для событий, где точность
client timestamp не нужна.

Если client timestamp нужен для корректного occurredAt --- определить
допустимое clock-skew окно.

------------------------------------------------------------------------

# 23. Data model / indexes / retention readiness

Если события сохраняются в БД:

обязательны разумные indexes для будущих запросов по: - eventType; -
occurredAt; - storefrontId; - productId; - sessionId; -
acquisitionSource.

Не создавать десятки speculative indexes.

Не реализовывать окончательную retention policy, если она не утверждена.
Но модель не должна требовать вечного хранения PII.

Не создавать FK между bounded contexts, если это нарушает ADR-0001.

------------------------------------------------------------------------

# 24. Observability

Instrumentation pipeline должен иметь техническую наблюдаемость:

-   ingestion errors;
-   persistence/delivery failures;
-   rejected invalid events;
-   deduplication behavior.

Но не логировать: - contact values; - tokens; - cookies; - raw
Authorization; - sensitive request bodies.

Behavioral event ≠ application log.

------------------------------------------------------------------------

# 25. Deferred Decisions --- не реализовывать

Не реализовывать решения из Deferred Decisions Map, включая:

-   DD-001 multilingual Product Content;
-   DD-002 AI Translation;
-   DD-003 Storefront Free Trial;
-   DD-004 SaaS Plans;
-   DD-005 Pricing;
-   DD-006 Recurring Billing;
-   DD-007 Trial → Paid;
-   DD-008 Failed Payment / Grace Period;
-   DD-009 Storefront Partner CRM Entitlements;
-   DD-010 Marketplace vs Storefront Analytics capability matrix;
-   DD-011 Custom Domain/Subdomain;
-   DD-012 Marketplace Commission Rules;
-   DD-013 Storefront Transaction Economics;
-   DD-014 Subscription Authoritative Domain;
-   DD-015 Storefront Public Business Contacts --- не расширять текущую
    утверждённую модель без решения;
-   DD-016 Professional Translation;
-   DD-017 Trial Anti-Abuse;
-   DD-018 Trial Data Retention;
-   DD-019 Subscription Cancellation;
-   DD-020 SaaS Capability Matrix.

Step 1.12.3 создаёт **data/event foundation**, а не принимает эти
product/commercial decisions.

------------------------------------------------------------------------

# 26. Explicit out of scope

Не начинать:

-   Partner CRM persistence;
-   PartnerCustomerRelationship;
-   Lead;
-   pipeline/stages;
-   Checkout;
-   Cart;
-   Sale;
-   Order;
-   Booking;
-   Payment;
-   PSP;
-   fee/commission engine;
-   Settlement;
-   Payout;
-   subscription checkout;
-   recurring billing;
-   pricing;
-   trial;
-   revenue analytics;
-   dashboards/charts;
-   analytics aggregation engine;
-   data warehouse;
-   BI;
-   custom domain/subdomain;
-   SEO redesign;
-   Marketplace-wide behavioral tracking;
-   AI/OCR/translation.

------------------------------------------------------------------------

# 27. Required tests

## Backend

Добавить unit/e2e для: - event DTO validation; - event envelope; -
session validation; - deduplication; - Storefront public predicate; -
Product ownership/channel predicate; - contactType; - no contact-value
persistence; - forged identity; - invalid event type; - temporal
semantics; - acquisitionSource; - publication != acquisition; - AuditLog
isolation.

Повторить: - `tsc --noEmit`; - unit; - Storefront e2e; - Public
Catalog; - Seller Identity; - Partner Cabinet; - Partner Onboarding; -
Product Scope; - Product Media; - Auth/RBAC; - полный serial backend
regression; - clean migration replay, если добавлена migration.

## Frontend

Добавить tests: - StorefrontViewed fires once per intended page
action; - StorefrontProductViewed; - ProductImpression semantics; -
ContactClicked without contact value; - tracking failure does not break
navigation; - no Authorization in public analytics request; - no
duplicate due to rerender; - RU/AZ/EN locale propagated correctly.

Повторить: - frontend `tsc --noEmit`; - vitest; - `next build`.

------------------------------------------------------------------------

# 28. Browser/runtime verification

На live/preview production-equivalent runtime проверить:

A. anonymous Storefront open → StorefrontViewed;\
B. Product card render → ProductImpression по выбранной семантике;\
C. PDP open → StorefrontProductViewed;\
D. phone click → ContactClicked PHONE;\
E. WhatsApp → WHATSAPP;\
F. website → WEBSITE;\
G. событие не содержит фактический phone/email/URL;\
H. DRAFT Storefront → public event не создаётся;\
I. suspended/expired → event не создаётся;\
J. MARKETPLACE-only Product → Storefront product event не принимается;\
K. tracking endpoint failure → Storefront продолжает работать;\
L. duplicate eventId → одна logical запись;\
M. public request не отправляет Authorization;\
N. preview не учитывается как public StorefrontViewed;\
O. RU/AZ/EN → locale context корректен;\
P. console errors = 0 на happy path.

После smoke удалить созданные test/dev artifacts.

------------------------------------------------------------------------

# 29. Documentation

Обновить архитектурную документацию так, чтобы явно были зафиксированы:

-   publication channel vs acquisition source;
-   behavioral events vs business domain events;
-   behavioral events vs AuditLog;
-   anonymous session privacy boundary;
-   Storefront events текущего Step;
-   Marketplace events остаются Step 1.13B;
-   analytics aggregation/dashboard out of scope;
-   Order/Sale/Payment propagation out of scope;
-   Billing/commission logic out of scope.

Если существующего ADR достаточно --- обновить/сослаться без создания
лишнего ADR.

Если появляется новая ownership-архитектура behavioral event store ---
см. §2: `ARCHITECTURE DECISION REQUIRED`.

------------------------------------------------------------------------

# 30. Финальный отчёт

Отчёт должен содержать:

1.  Current → Target mapping.
2.  Architecture/ownership decision.
3.  Publication vs acquisition contract.
4.  Event envelope.
5.  Anonymous session model.
6.  Storefront event list и точную семантику каждого.
7.  Trusted vs client-supplied fields.
8.  Ingestion/deduplication/durability.
9.  Public predicate reuse.
10. Privacy/PII handling.
11. Frontend instrumentation.
12. AuditLog separation.
13. Temporal semantics.
14. Security/abuse results.
15. Data model/migration/indexes, если есть.
16. Unit results.
17. E2E results.
18. Full regression.
19. Frontend tests/build.
20. Browser verification.
21. Issues found/fixed.
22. ADR/docs changes.
23. Deferred Decisions compliance.
24. Out-of-scope confirmation.
25. `ARCHITECTURE DECISION REQUIRED`, если возник.

Финальная строка при успешном завершении:

`PHASE 1 STEP 1.12.3 COMPLETED — WAITING FOR REVIEW`

**Не переходить к Step 1.13 / 1.13B или любому следующему Step.**
