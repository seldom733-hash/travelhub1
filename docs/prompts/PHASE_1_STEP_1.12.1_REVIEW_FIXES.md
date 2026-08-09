# PHASE 1 --- STEP 1.12.1 REVIEW FIXES

## STOREFRONT COMMERCIAL MODEL, ENTITLEMENT & CHANNEL BOUNDARY

### 0. Статус

Текущая реализация Step 1.12.1 технически качественная и
regression-green, но НЕ APPROVED из-за продуктового решения, принятого
после запуска исходного промпта.

Не откатывать рабочую реализацию. Выполнить точечные review-fixes поверх
неё.

Не переходить к Step 1.12.2.

------------------------------------------------------------------------

## FIX 1 --- Marketplace и Storefront являются разными коммерческими моделями

Зафиксировать в архитектуре:

### Marketplace

-   бесплатное присутствие PARTNER;
-   TravelHub приводит buyer;
-   transaction/platform commission применяется к Marketplace
    transaction;
-   прямые контакты продавца скрыты;
-   Step 1.11 `PublicSellerProfile` и anti-disintermediation остаются
    authoritative;
-   Partner получает базовую operational analytics (сама аналитика
    сейчас не реализуется).

### Storefront

-   отдельный платный SaaS-продукт TravelHub;
-   Partner использует TravelHub как собственный сайт/витрину;
-   Storefront в будущем может раскрывать business contacts;
-   расширенная analytics/statistics относится к SaaS-возможностям
    Storefront;
-   Storefront monetization = subscription/plan/entitlement, а не
    обязательная Marketplace commission с собственных Storefront leads.

Не реализовывать сейчас billing, PSP, recurring payments, prices или
commission engine.

Добавить ADR, если это необходимо для фиксации product/commercial
boundary.

------------------------------------------------------------------------

## FIX 2 --- Entitlement boundary обязателен для PUBLIC activation

Текущего `PartnerStorefront.status=ACTIVE` недостаточно.

Нельзя считать Storefront бесплатной capability любого approved PARTNER.

Нужно заложить entitlement boundary:

`Storefront ACTIVE` AND `Storefront entitlement permits publication`

Не использовать `User.status`, `crm.Partner.status`, `Product.status`
или наличие `PartnerStorefront` как замену entitlement.

Реального Billing domain пока нет. Не создавать фиктивные
Payment/Invoice.

Если корректный persistent entitlement требует определения ownership
будущего Billing/Subscription domain и это нельзя сделать без нового
решения --- выдать `ARCHITECTURE DECISION REQUIRED`.

Допустимо реализовать минимальный entitlement-ready contract/state,
который позднее станет authoritative от Billing domain.

Storefront может существовать как DRAFT без entitlement, но не должен
становиться публичным без разрешающего entitlement.

Будущие `SUSPENDED/EXPIRED` должны позволять скрыть Storefront без
удаления Partner/Product/history.

------------------------------------------------------------------------

## FIX 3 --- Product distribution channels

Текущая логика:

`ACTIVE storefront + Product.partnerId + Product PUBLISHED`

автоматически показывает все published Product партнёра в Storefront.
Это нужно изменить.

Один canonical `Catalog.Product` используется во всех каналах. Product
НЕ копировать.

Нужен явный distribution/publication channel contract минимум:

-   `MARKETPLACE`
-   `PARTNER_STOREFRONT`

Поддержать состояния: - Marketplace only; - Storefront only; -
Marketplace + Storefront; - ни один публичный канал, если lifecycle это
допускает.

Publication channel должен быть отделён от Product lifecycle/status.

Если изменение требует переосмысления значения `PUBLISHED`, сначала
описать решение; не ломать moderation/version model.

Partner может менять distribution только для own Product. Никакого
forged partnerId/product ownership bypass.

Изменение channels должно аудироваться.

------------------------------------------------------------------------

## FIX 4 --- Marketplace public predicate должен учитывать channel

После FIX 3 существующий Marketplace Public Catalog не должен
автоматически показывать каждый `PUBLISHED` Product.

Marketplace predicate:

`Product publicly publishable` AND `MARKETPLACE enabled`

Storefront predicate:

`Storefront ACTIVE` AND `entitlement permits publication` AND
`Product.partnerId = Storefront.partnerId` AND
`Product publicly publishable` AND `PARTNER_STOREFRONT enabled`

Обязательно сохранить neutral 404, ProductDraft N+1 isolation и
staged-media isolation.

Не допустить regression существующего Marketplace.

------------------------------------------------------------------------

## FIX 5 --- PublicSellerProfile остаётся Marketplace identity

Текущая реализация привязала Storefront `displayName` к Step 1.11
approved seller identity. Это допустимо как временный fallback, но НЕ
должно становиться архитектурным правилом Storefront.

Разделить concepts:

### Marketplace identity

`PublicSellerProfile` - controlled visibility; - no contacts; -
anti-disintermediation; - Marketplace-safe projection.

### Storefront business identity

Storefront-owned public business profile/projection. В будущем может
содержать: - business name; - phone; - email; - website; - address; -
WhatsApp; - social links; - branding.

Эти поля относятся только к Storefront context.

Не обязательно реализовывать полный contact model сейчас, но backend
design не должен запрещать его будущую реализацию.

Storefront identity НЕ должна автоматически изменять/расширять
Marketplace `PublicSellerProfile`.

------------------------------------------------------------------------

## FIX 6 --- Anti-disintermediation boundary

Исправить текущую концепцию, где Step 1.11 policy безусловно применяется
к Storefront displayName/tagline/description.

Marketplace Product и Marketplace seller projection по-прежнему
полностью защищены Step 1.11.

Storefront как платный SaaS в будущем МОЖЕТ раскрывать business contacts
в специально предназначенных structured contact fields.

Но: - не разрешать обход через Product.title/description; - canonical
Product moderation не ослаблять; - business contacts Storefront не
должны утекать в Marketplace; - arbitrary HTML/contact dump не нужен.

Если contacts ещё не реализуются --- зафиксировать boundary
контрактом/ADR и тестом архитектурной изоляции.

------------------------------------------------------------------------

## FIX 7 --- Publication channel ≠ acquisition/transaction channel

Зафиксировать два разных понятия.

### Publication channel

Где Product показывается: - `MARKETPLACE` - `PARTNER_STOREFRONT`

### Acquisition / transaction channel

Откуда пришла конкретная будущая сделка: - `MARKETPLACE` -
`PARTNER_STOREFRONT`

Не добавлять сейчас поля в Order/Sale/Payment без необходимости. Полная
propagation будет отдельным шагом.

Но не проектировать commission logic так, будто канал можно определить
только по Product или наличию Storefront.

Ключевой future invariant:

Partner может иметь Storefront и тот же Product в обоих каналах.

Marketplace transaction → Marketplace commercial rules/commission.

Storefront-origin transaction → Storefront commercial model.

------------------------------------------------------------------------

## FIX 8 --- Analytics capability boundary

Не реализовывать analytics сейчас.

Но зафиксировать product boundary:

Marketplace Partner → базовые operational metrics.

Storefront paid Partner → расширенная analytics/statistics capability:
traffic, visitors, views, sources, funnel, conversion, product
performance, revenue analysis, geography, repeat customers, seasonality,
booking lead time, exports и т.д.

Step 1.12.1 должен оставить стабильные storefront/channel identifiers,
чтобы analytics можно было построить позже без переделки Product.

------------------------------------------------------------------------

## FIX 9 --- Migration hygiene finding

В отчёте указано, что в dev DB вручную корректировались
`_prisma_migrations`: - `add_seller_geography` marked applied; -
checksum `add_public_seller_profile` пересчитан.

Это не считать нормальным migration workflow.

Нужно: 1. проверить историю migration files; 2. подтвердить, что уже
применённые migration files не редактируются постфактум; 3. убедиться,
что clean DB с нуля получает идентичную schema; 4.
`migrate deploy/status/diff` не показывают drift; 5. задокументировать
причину прежнего checksum mismatch; 6. не выполнять подобных bookkeeping
fixes в prod автоматически.

Если migration file предыдущего шага был изменён после применения,
определить безопасную remediation strategy без переписывания production
history.

------------------------------------------------------------------------

## FIX 10 --- Общий Prisma P2002 parser

В отчёте найден Prisma 7 driver-adapter bug/shape difference и отмечено,
что аналогичная потенциальная проблема остаётся в
`CatalogService.createCategory`.

Не оставлять известный error-normalization debt.

Вынести robust unique-constraint/P2002 parsing в общий helper и
использовать минимум в: - Storefront slug/partner unique handling; -
Catalog createCategory; - других очевидных местах, где тот же parser
pattern уже используется.

Добавить unit tests на обычный Prisma P2002 shape и driver-adapter
`cause.originalMessage` shape.

Цель: DB unique race никогда не превращается в raw 500.

------------------------------------------------------------------------

## Обязательные дополнительные E2E proofs

Добавить/обновить минимум:

1.  approved Partner без entitlement не может публично activate
    Storefront;
2.  entitlement не подменяется User/Partner/Product status;
3.  Storefront не auto-provisionится;
4.  Product не копируется;
5.  MARKETPLACE-only Product виден Marketplace и отсутствует Storefront;
6.  STOREFRONT-only Product виден Storefront и отсутствует Marketplace;
7.  BOTH Product виден в обоих;
8.  чужой Partner не меняет channels;
9.  channel mutation audited;
10. Marketplace ProductDraft N+1 не утёк после channel changes;
11. Storefront ProductDraft N+1 не утёк;
12. staged media не утекла;
13. Marketplace projection не раскрывает Storefront business
    identity/contact data;
14. ACTIVE entitled Storefront public; entitlement deny/suspend делает
    её public 404;
15. Marketplace anti-disintermediation остаётся green;
16. Marketplace list/search/category/PDP учитывают MARKETPLACE channel;
17. Marketplace total/pagination остаются корректными;
18. Storefront total/pagination учитывают STOREFRONT channel;
19. concurrent channel/storefront changes не нарушают invariants;
20. общий P2002 normalization возвращает controlled domain errors;
21. clean migration replay проходит с нуля без drift.

Если полноценный entitlement persistence блокируется архитектурным
решением, не подделывать proof --- вернуть
`ARCHITECTURE DECISION REQUIRED` с точным вопросом.

------------------------------------------------------------------------

## Regression

Обязательно:

-   backend `tsc --noEmit`;
-   unit/integration;
-   storefront e2e;
-   public-catalog e2e;
-   seller-identity;
-   moderation/change-proposal;
-   product-scope;
-   product-media;
-   partner-onboarding;
-   partner-cabinet;
-   buyer-identity;
-   auth/RBAC;
-   полный serial backend e2e;
-   clean test DB migration replay.

Frontend не менять, кроме необходимой contract compatibility. Если
изменён --- полный frontend typecheck/tests/build.

------------------------------------------------------------------------

## Out of scope

Не начинать: - subscription checkout; - PSP; - recurring billing; -
Storefront pricing; - commission engine; - Payment; - Order/Sale channel
persistence; - full analytics; - Storefront frontend; -
logo/hero/themes; - custom domain/subdomain; - SEO/marketing tools; -
Step 1.12.2.

------------------------------------------------------------------------

## Формат отчёта

Вернуть:

### PHASE 1 --- STEP 1.12.1 REVIEW FIXES --- ОТЧЁТ

1.  Marketplace vs Storefront commercial model
2.  Entitlement design
3.  Product distribution channel model
4.  Marketplace predicate changes
5.  Storefront predicate changes
6.  PublicSellerProfile vs Storefront identity
7.  Contact disclosure / anti-disintermediation boundary
8.  Publication vs acquisition channel
9.  Analytics capability boundary
10. Migration hygiene review
11. P2002 normalization
12. RBAC/object scope
13. Audit
14. Unit results
15. E2E results
16. Full regression
17. Clean migration replay
18. Dev/prod impact
19. Issues found
20. Out-of-scope confirmation
21. ARCHITECTURE DECISION REQUIRED

Не переходить к Step 1.12.2.

Финальная строка:

`PHASE 1 STEP 1.12.1 REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`
