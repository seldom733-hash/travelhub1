# PHASE 1 --- STEP 1.12.1 CLARIFICATION

## STOREFRONT COMMERCIAL MODEL, ENTITLEMENT & DISCLOSURE BOUNDARY

### 0. Статус

Это CLARIFICATION к уже выданному:

`PHASE 1 — STEP 1.12.1: PARTNER STOREFRONT DOMAIN & BACKEND FOUNDATION`

Он НЕ заменяет основной Step 1.12.1 целиком. Все его требования остаются
в силе, кроме пунктов, которые прямо изменены ниже.

Не переходить к Step 1.12.2.

------------------------------------------------------------------------

## 1. Product decision

TravelHub поддерживает ДВЕ разные коммерческие модели для PARTNER.

### A. MARKETPLACE

Marketplace --- основная комиссионная модель TravelHub.

PARTNER:

-   может публиковать approved Product в общем Marketplace;
-   не обязан иметь Storefront;
-   получает покупателей, пришедших через TravelHub Marketplace;
-   платит TravelHub transaction/platform commission по правилам
    Marketplace;
-   не получает права раскрывать прямые контакты для обхода платформы;
-   получает только базовую операционную статистику/аналитику,
    необходимую для работы.

Marketplace public identity продолжает полностью подчиняться Step 1.11:

`PublicSellerProfile`

и его visibility policy.

Marketplace НЕ публикует:

-   phone;
-   email;
-   website;
-   WhatsApp/Telegram;
-   social links;
-   direct booking contacts;
-   иные данные, позволяющие вывести Marketplace lead за пределы
    TravelHub.

Anti-disintermediation Step 1.11 для Marketplace остаётся обязательным.

### B. PARTNER STOREFRONT

Storefront --- отдельный платный SaaS-продукт TravelHub.

PARTNER получает возможность использовать инфраструктуру TravelHub как
собственный сайт/витрину бизнеса.

Storefront в будущем может включать:

-   собственную публичную страницу;
-   собственный branding;
-   business contacts;
-   продукты/услуги;
-   расширенную статистику;
-   расширенную аналитику;
-   traffic/conversion reports;
-   marketing/SEO capabilities;
-   custom domain/subdomain;
-   другие SaaS-функции.

Storefront монетизируется через subscription/plan/entitlement, а НЕ
обязательной Marketplace-комиссией с каждой собственной
Storefront-продажи.

Billing/PSP/subscription charging сейчас НЕ реализовывать.

------------------------------------------------------------------------

## 2. Один Partner может использовать обе модели

Marketplace и Storefront НЕ взаимоисключающие.

Один PARTNER может одновременно:

-   продавать через общий TravelHub Marketplace;
-   иметь платный Storefront.

Один и тот же canonical `Catalog.Product` может быть опубликован в обоих
каналах.

НЕ создавать копии Product.

Целевая модель:

`Catalog.Product` → Marketplace publication → Storefront publication

Product identity, moderation, tariffs, availability, media и version
остаются canonical.

------------------------------------------------------------------------

## 3. Product distribution channels

Не считать автоматически, что каждый PUBLISHED Product PARTNER
обязательно показывается в его Storefront.

Архитектура должна быть готова к явному выбору каналов публикации
Product.

Минимальные canonical channels:

-   `MARKETPLACE`
-   `PARTNER_STOREFRONT`

Один Product может иметь:

-   MARKETPLACE only;
-   PARTNER_STOREFRONT only;
-   MARKETPLACE + PARTNER_STOREFRONT;
-   ни одного публичного канала, если бизнес-статус это допускает.

Не реализовывать storefront-specific Product copies.

Если текущая Product lifecycle модель не позволяет безопасно отделить
`PUBLISHED` от distribution channel без архитектурного изменения,
зафиксировать:

`ARCHITECTURE DECISION REQUIRED`

до изменения lifecycle semantics.

------------------------------------------------------------------------

## 4. Commercial model не хранить в Product

Не помещать commission rate, subscription price или payment policy
непосредственно в Product только ради Storefront.

Коммерческая модель определяется контекстом канала и действующими
коммерческими правилами.

Conceptually:

-   Marketplace → `MARKETPLACE_COMMISSION`;
-   Storefront → `STOREFRONT_SUBSCRIPTION`.

Конкретные fee %, plan prices, billing periods и PSP integration сейчас
вне scope.

------------------------------------------------------------------------

## 5. Storefront entitlement

Storefront не должен считаться бесплатной capability PARTNER.

Нужно заложить явный entitlement boundary.

Минимальная семантика:

PARTNER может создать/настроить DRAFT Storefront, но PUBLIC activation
должна требовать активного Storefront entitlement.

Conceptual states могут быть:

-   `NONE`
-   `TRIAL` --- только если действительно нужен;
-   `ACTIVE`
-   `SUSPENDED`
-   `EXPIRED`

Не вводить лишние states без необходимости.

ВАЖНО:

на Step 1.12.1 реальный subscription billing ещё отсутствует.

Поэтому не имитировать оплату и не создавать фиктивные Payment.

Допустимо создать минимальную plan/entitlement-ready модель или
boundary, который позже будет управляться Billing domain.

Если для корректной реализации entitlement сейчас требуется определить
ownership будущего Subscription/Billing domain:

`ARCHITECTURE DECISION REQUIRED`.

Не создавать неправильный billing domain внутри Catalog только ради
текущего Step.

------------------------------------------------------------------------

## 6. Activation invariant

Публичная Storefront должна удовлетворять минимум:

`Storefront.status = ACTIVE` AND
`Storefront entitlement permits publication`

Если entitlement становится SUSPENDED/EXPIRED в будущем, архитектура
должна позволять отключить публичную Storefront без удаления Partner,
Product или истории.

Не использовать `User.status`, `Partner.status` или `Product.status` как
замену subscription entitlement.

------------------------------------------------------------------------

## 7. Marketplace seller identity и Storefront business identity --- разные projections

Исправление к исходному Step 1.12.1:

Storefront НЕ должен полностью зависеть от `PublicSellerProfile` как от
единственного публичного business profile.

### Marketplace

Использует:

`PublicSellerProfile`

Step 1.11 остаётся authoritative.

Контакты скрыты.

### Storefront

Нужен отдельный Storefront-safe business identity/profile contract.

Он может быть частью `PartnerStorefront` либо отдельной storefront-owned
моделью, если это оправдано архитектурой.

В будущем Storefront profile может содержать:

-   public business name;
-   public phone;
-   public email;
-   website;
-   address;
-   WhatsApp;
-   social links;
-   business description;
-   logo/branding.

Но эти данные относятся ТОЛЬКО к Storefront context.

Они не должны автоматически попадать в Marketplace projection.

------------------------------------------------------------------------

## 8. Contact disclosure boundary

Это критический security/business invariant.

Контакты Storefront Partner могут быть публичны ТОЛЬКО:

-   через Storefront public API;
-   для ACTIVE Storefront;
-   при действующем entitlement;
-   в Storefront route/context.

Наличие Storefront не разрешает раскрывать контакты этого Partner:

-   в Marketplace Product Card;
-   Marketplace PDP;
-   Marketplace search;
-   Marketplace category;
-   PublicSellerProfile Marketplace projection.

Доказать e2e, что Partner с ACTIVE Storefront и заполненными business
contacts всё равно имеет скрытые контакты в Marketplace.

------------------------------------------------------------------------

## 9. Anti-disintermediation policy

Исправление к исходному Step 1.12.1:

Step 1.11 anti-disintermediation НЕ должен безусловно запрещать business
contacts внутри платного Storefront.

### MARKETPLACE content

Политика Step 1.11 действует полностью.

### STOREFRONT-owned business profile

Разрешены легитимные public business contacts в предназначенных для
этого структурированных полях.

Но нельзя превращать Product content в неконтролируемый HTML/contact
dump.

Storefront Product по-прежнему является canonical Catalog.Product.

Не ослаблять Marketplace moderation Product только потому, что Product
также опубликован в Storefront.

Business contacts Storefront должны находиться в Storefront business
profile/contact projection, а не внедряться в title/description Product
для обхода Marketplace rules.

------------------------------------------------------------------------

## 10. Storefront moderation / platform safety

Платный Storefront не означает отсутствие platform governance.

TravelHub должен иметь возможность:

-   suspend/deactivate Storefront;
-   блокировать запрещённый/мошеннический контент;
-   сохранять audit/history.

Но не создавать сейчас полный новый moderation workflow, если он не
нужен Step 1.12.1.

Если существующий MODERATOR workflow нельзя безопасно переиспользовать и
требуется отдельный Storefront moderation lifecycle --- отметить для
следующего controlled Step или:

`ARCHITECTURE DECISION REQUIRED`

если это блокирует безопасную activation.

------------------------------------------------------------------------

## 11. Analytics product boundary

Marketplace Partner и Storefront Partner должны иметь разные уровни
analytics capability.

### Marketplace Partner --- базовый уровень

В будущем минимум:

-   продажи;
-   revenue;
-   bookings/orders;
-   payouts;
-   основные operational KPIs.

Не давать автоматически полный platform analytics suite.

### Storefront Partner --- расширенный SaaS analytics

В будущем:

-   visitors;
-   unique visitors;
-   product views;
-   traffic sources;
-   conversion;
-   funnel;
-   top viewed products;
-   top selling products;
-   revenue analytics;
-   average order value;
-   cancellations;
-   geography;
-   repeat customers;
-   revenue by product/channel/period;
-   booking lead time;
-   seasonality;
-   availability/occupancy;
-   report export.

На Step 1.12.1 сами analytics НЕ реализовывать.

Но архитектура Storefront должна иметь стабильный identity/channel
context, чтобы Step 1.12.3 мог собирать эти данные.

------------------------------------------------------------------------

## 12. Sales/acquisition attribution

Не смешивать:

### Publication channel

Где Product разрешено показывать:

-   `MARKETPLACE`
-   `PARTNER_STOREFRONT`

### Acquisition / transaction channel

Откуда пришёл конкретный будущий buyer/order/sale:

-   `MARKETPLACE`
-   `PARTNER_STOREFRONT`

Эта информация позже должна сохраняться на коммерческой
транзакции/Order/Sale и не вычисляться задним числом по Product.

На Step 1.12.1 Order/Sale/Payment НЕ менять.

Подготовить только стабильные channel identifiers/contracts, если это не
требует преждевременного изменения Order domain.

Полная propagation --- Step 1.12.3.

------------------------------------------------------------------------

## 13. Commission boundary

Не реализовывать сейчас commission engine.

Но зафиксировать правило:

**наличие платного Storefront у Partner само по себе НЕ освобождает
Marketplace transaction от Marketplace commission.**

Пример:

тот же Product опубликован в Marketplace + Storefront.

Buyer пришёл и оформил сделку через Marketplace:

→ Marketplace commercial rules.

Buyer пришёл через Storefront:

→ Storefront commercial model.

Нельзя определять комиссию только по:

-   Partner plan;
-   наличию Storefront;
-   Product ID.

Нужен transaction/acquisition context.

------------------------------------------------------------------------

## 14. Изменение public storefront product predicate

Исходное правило:

`ACTIVE Storefront + Product.partnerId = Storefront.partnerId + Product PUBLISHED`

недостаточно.

Целевое правило должно учитывать publication channel:

`Storefront ACTIVE` AND `entitlement allows publication` AND
`Product.partnerId = Storefront.partnerId` AND
`Product is publicly publishable` AND
`Product is enabled for PARTNER_STOREFRONT channel`

Marketplace public API аналогично не должен случайно показывать Product,
предназначенный только для Storefront, если вводится channel-level
distribution.

Не менять существующий Marketplace contract без regression proof.

------------------------------------------------------------------------

## 15. Public Storefront contacts

На Step 1.12.1 НЕ обязательно реализовывать полный набор contact fields,
если это раздувает backend foundation.

Но schema/API design не должен запрещать их будущую реализацию через
Step 1.11 anti-disintermediation.

Если минимальные contact fields реализуются сейчас, обязательно:

-   structured whitelist DTO;
-   validation;
-   no secrets;
-   no CRM raw serialization;
-   no Marketplace leakage;
-   только ACTIVE + entitled Storefront.

Branding/logo/hero остаются Step 1.12.2.

------------------------------------------------------------------------

## 16. Обязательные дополнительные E2E proofs

Добавить к существующему Step 1.12.1 минимум:

1.  Partner без Storefront entitlement не может сделать Storefront
    публичной;
2.  entitlement boundary не подменён User/Partner status;
3.  Storefront не создаётся автоматически на startup;
4.  один Product не дублируется для Storefront;
5.  Product MARKETPLACE-only не появляется в Storefront;
6.  Product STOREFRONT-only не появляется в Marketplace;
7.  Product MARKETPLACE + STOREFRONT доступен в обоих контекстах;
8.  Marketplace projection Partner с Storefront по-прежнему не содержит
    business contacts;
9.  Storefront business identity не изменяет PublicSellerProfile
    Marketplace projection;
10. Storefront contacts, если реализованы, доступны только через
    entitled ACTIVE Storefront;
11. suspended/inactive entitlement делает Storefront public API
    недоступным;
12. Product contact-content moderation Marketplace не ослабляется из-за
    Storefront;
13. distribution channel нельзя forged изменить через чужой
    partner/product;
14. channel change проходит own-scope и audit;
15. Marketplace regression полностью зелёный.

Если entitlement пока представлен только архитектурным boundary без
persistence, объяснить, какие из proofs переносятся и почему. Не писать
фиктивные тесты.

------------------------------------------------------------------------

## 17. Out of scope --- дополнение

НЕ реализовывать сейчас:

-   subscription checkout;
-   recurring billing;
-   PSP;
-   invoice charging;
-   Storefront plan prices;
-   commission calculation;
-   fee collection;
-   Order/Sale attribution persistence;
-   full analytics;
-   custom domain;
-   advanced reports;
-   CRM marketing;
-   SEO tools.

Это не повод игнорировать соответствующие архитектурные boundaries.

------------------------------------------------------------------------

## 18. Обновлённый Definition of Done для 1.12.1

Дополнительно к основному DoD:

-   Marketplace и Storefront определены как разные commercial models;
-   Storefront является entitlement-gated SaaS capability;
-   activation готова зависеть от entitlement;
-   Product не копируется;
-   publication channels отделены от Product lifecycle;
-   Marketplace и Storefront distribution могут различаться;
-   PublicSellerProfile остаётся Marketplace-safe;
-   Storefront business identity не раскрывается в Marketplace;
-   Marketplace anti-disintermediation не ослаблен;
-   Storefront structured business contacts архитектурно разрешены;
-   acquisition channel отделён от publication channel;
-   commission engine не реализован преждевременно;
-   analytics не реализована преждевременно;
-   модель готова к Step 1.12.2/1.12.3 без переделки Product ownership.

------------------------------------------------------------------------

## 19. Отчёт

В отчёт Step 1.12.1 дополнительно включить:

-   Marketplace vs Storefront commercial model;
-   entitlement design;
-   Product distribution channel design;
-   Marketplace/Storefront disclosure boundary;
-   PublicSellerProfile vs Storefront business identity;
-   anti-disintermediation boundary;
-   будущую analytics capability boundary;
-   publication channel vs acquisition channel;
-   какие billing/payment элементы сознательно НЕ реализованы.

Если эти требования конфликтуют с уже начатой реализацией Step 1.12.1
--- не маскировать конфликт. Описать его и исправить фундамент до
завершения Step.

Не переходить к Step 1.12.2.

Финальная строка остаётся:

`PHASE 1 STEP 1.12.1 COMPLETED — WAITING FOR REVIEW`
