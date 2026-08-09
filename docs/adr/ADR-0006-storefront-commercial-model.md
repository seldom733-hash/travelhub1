# ADR-0006: Partner Storefront — Commercial Model, Entitlement & Channel Boundary

- **Status:** Accepted (Phase 1 Step 1.12.1 REVIEW FIXES)
- **Date:** 2026-08-09
- **Related:** ADR-0001 (modular monolith), ADR-0002 (auth/RBAC), ADR-0003 (Buyer↔Customer mapping), ADR-0004 (Partner approval orchestration), ADR-0005 (Public Seller Identity)

## Context

После принятия Step 1.12.1 (Storefront domain foundation) принято продуктовое решение:
Marketplace и Partner Storefront — **разные коммерческие модели**. Marketplace —
основная комиссионная модель (бесплатное присутствие PARTNER, TravelHub приводит
buyer, transaction commission). Storefront — **отдельный платный SaaS-продукт**
(subscription/plan/entitlement, НЕ обязательная Marketplace commission с собственных
Storefront leads). Один Partner может использовать обе модели одновременно; один
canonical `Catalog.Product` может публиковаться в обоих каналах без копий.

Требуется: entitlement boundary для публичной активации Storefront; явные publication
channels Product, отделённые от lifecycle; Marketplace и Storefront как отдельные
public identities; граница раскрытия контактов; publication channel ≠ acquisition
channel; analytics capability boundary.

## Decision

1. **Две коммерческие модели фиксируются в архитектуре, но billing/PSP/commission
   НЕ реализуются.** Marketplace = commission model; Storefront = subscription model.
   Никаких fee %, plan prices, recurring billing, invoice charging, commission engine
   на Step 1.12.1. Коммерческие правила НЕ хранятся в Product.

2. **Entitlement — обязательное условие публичной активации Storefront.**
   `PartnerStorefront.entitlementStatus` (`NONE` default / `ACTIVE` / `SUSPENDED` /
   `EXPIRED`) живёт в Catalog как минимальный entitlement-ready контракт. Публичный
   инвариант: `Storefront.status = ACTIVE AND entitlementStatus = ACTIVE`. Это НЕ
   фиктивный платёж и НЕ новый Billing domain: статус управляется ЯВНОЙ операционной
   командой `POST /api/v1/storefronts/:partnerId/entitlement` (ADMIN,
   `storefront.entitlement.manage`) и в будущем станет authoritative от Billing domain
   (через события). `User.status`, `crm.Partner.status`, `Product.status` и наличие
   Storefront НЕ заменяют entitlement. `SUSPENDED`/`EXPIRED` скрывают публичную
   витрину (public predicate → neutral 404) без удаления Partner/Product/history.

3. **Publication channels — отдельный контракт от lifecycle Product.**
   Таблица `catalog.ProductPublicationChannel` (unique `[productId, channel]`), каналы
   `MARKETPLACE` / `PARTNER_STOREFRONT`. Один canonical Product может быть включён в
   любое подмножество (или ни в один). Default при создании Product — `MARKETPLACE`
   (обратная совместимость; legacy Product получили `MARKETPLACE` backfill'ом в
   миграции). Управление — own-scope: `PUT /api/v1/products/:id/channels`
   (`catalog.product.channels_own` для PARTNER, только свои Product; аудит через
   `ProductHistory`). `PUBLISHED` не переосмысляется: канал влияет только на публичную
   видимость.

4. **Публичные предикаты учитывают канал.**
   Marketplace: `Product publicly publishable AND MARKETPLACE enabled` (list, search,
   category, PDP, media). Storefront: `Storefront ACTIVE AND entitlement ACTIVE AND
   Product.partnerId = Storefront.partnerId AND Product publicly publishable AND
   PARTNER_STOREFRONT enabled`. Neutral 404, ProductDraft N+1 isolation и staged-media
   isolation сохраняются. Marketplace regression защищён (default MARKETPLACE).

5. **PublicSellerProfile остаётся Marketplace identity; Storefront business identity —
   отдельная projection.** Step 1.11 authoritative для Marketplace; контакты скрыты.
   Storefront identity — storefront-owned (в будущем structured business fields: name,
   phone, email, website, address, WhatsApp, social links, branding), только в
   Storefront context, никогда не автоматически в Marketplace projection. Текущая
   привязка `displayName` витрины к approved seller identity — **временный fallback**
   (безопасный, не bypass), НЕ архитектурное правило; ADR это фиксирует. Backend design
   не запрещает будущие structured contact fields.

6. **Anti-disintermediation boundary.** Marketplace Product и Marketplace seller
   projection полностью защищены Step 1.11 (не ослабляются наличием Storefront у
   Partner). Storefront как платный SaaS в будущем МОЖЕТ раскрывать business contacts
   в специально предназначенных structured fields, но: не через `Product.title/
   description` (canonical Product moderation не ослабляется); без arbitrary HTML/
   contact dumps; contacts не утекают в Marketplace. Пока fields не реализованы —
   boundary зафиксирован контрактом (этот ADR) и e2e-изоляцией.

7. **Publication channel ≠ acquisition/transaction channel.** Publication — где Product
   показывается (`MARKETPLACE`/`PARTNER_STOREFRONT`); acquisition — откуда пришла
   конкретная будущая сделка. На Step 1.12.1 поля в Order/Sale/Payment НЕ добавляются;
   комиссия не вычисляется по Product/plan/наличию Storefront — потребуется
   transaction context (полная propagation — Step 1.12.3). Стабильные идентификаторы
   (SF-*, slug, PublicationChannel) уже существуют для future analytics/attribution.

8. **Analytics capability boundary.** Marketplace Partner → базовые operational metrics
   (sales/revenue/bookings/payouts/KPIs); Storefront paid Partner → расширенная SaaS
   analytics (visitors, funnel, conversion, product performance, geography, seasonality,
   exports и т.д.). Analytics на Step 1.12.1 не реализуется; стабильные
   storefront/channel идентификаторы готовы (Step 1.12.3).

9. **Migration hygiene (FIX 9).** Миграционные файлы после применения НЕ редактируются.
   Причина прежнего checksum mismatch: файл `add_public_seller_profile` был изменён в
   рабочем дереве ПОСЛЕ применения к dev DB (исторический шаг); schema при этом
   совпадала (migrate status: up to date). Remediation (dev-only, не prod): пересчёт
   checksum + `migrate resolve --applied` для `add_seller_geography` (применена raw SQL
   ранее). Чистый replay с нуля доказывается e2e globalSetup (drop+recreate+deploy).
   Подобные bookkeeping-фиксы в prod автоматически не выполняются.

## Consequences

- Storefront — entitlement-gated SaaS capability; DRAFT возможна без entitlement, public
  activation — только с `ACTIVE`.
- Канал Product отделён от lifecycle; Marketplace и Storefront distribution могут
  различаться без копий Product.
- Marketplace identity/контакты/модерация не ослаблены наличием Storefront.
- Комиссия/аналитика не реализованы преждевременно; модель готова к Step 1.12.2/1.12.3
  без переделки Product ownership.

## Alternatives considered

- **Entitlement как поле User/Partner status** — отклонено: подменяет коммерческий
  статус идентичностью аккаунта (запрещено FIX 2).
- **Полный Billing domain в Catalog** — отклонено: преждевременный неверный домен;
  минимальный entitlement-ready state + будущие события Billing.
- **Channels как два boolean-колонки на Product** — отклонено: таблица каналов —
  канонический контракт (новые каналы без миграции колонок), «ни один канал» = пустое
  множество.
- **Storefront business identity = PublicSellerProfile** — отклонено: разные контексты;
  identity separation — FIX 5.
