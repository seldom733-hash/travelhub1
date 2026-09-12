# TRAVELHUB — PAGE BUILDER / CONSTRUCTOR
## Архитектурная спецификация

**Версия:** 1.0  
**Дата:** 2026-09-12  
**Статус:** Architecture / Specification Only  
**Production code changes:** НЕТ

---

## Содержание

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Findings](#2-current-architecture-findings)
3. [Existing Components Reuse Map](#3-existing-components-reuse-map)
4. [Target Architecture](#4-target-architecture)
5. [Context Model: Marketplace vs Partner Storefront](#5-context-model)
6. [Block Registry](#6-block-registry)
7. [Page Model](#7-page-model)
8. [Version Model](#8-version-model)
9. [Data Source Model](#9-data-source-model)
10. [Layout Model](#10-layout-model)
11. [Theme / Design Tokens](#11-theme--design-tokens)
12. [Typography](#12-typography)
13. [Media](#13-media)
14. [Visibility Rules](#14-visibility-rules)
15. [Renderer](#15-renderer)
16. [Draft / Preview / Publish](#16-draft--preview--publish)
17. [Templates](#17-templates)
18. [Reusable Sections](#18-reusable-sections)
19. [API Contract](#19-api-contract)
20. [Admin UX](#20-admin-ux)
21. [RBAC / Tenant Isolation](#21-rbac--tenant-isolation)
22. [Security](#22-security)
23. [SEO](#23-seo)
24. [i18n](#24-i18n)
25. [Responsive](#25-responsive)
26. [Performance](#26-performance)
27. [Testing](#27-testing)
28. [Migration Strategy](#28-migration-strategy)
29. [MVP / Future](#29-mvp--future)
30. [Risks](#30-risks)
31. [Open Questions](#31-open-questions)
32. [Acceptance Criteria](#32-acceptance-criteria)

---

## 1. Executive Summary

### Что такое Constructor / Page Builder

Constructor — это **Presentation / Composition Layer**, который позволяет управлять структурой страниц TravelHub без изменения исходного React-кода. Constructor НЕ управляет бизнес-логикой: бронированиями, платежами, селлерами, тенантами, авторизацией, ценообразованием.

### Два контекста

| Контекст | Описание | Пример использования |
|----------|----------|---------------------|
| **Marketplace** | Публичная витрина TravelHub | `/` — HomePage |
| **Partner Storefront** | Channel 2 — партнёрский магазин | `/store/[slug]` — StorefrontSite |

Оба контекста используют единый Page Builder Engine, но имеют разные: permissions, tenant scope, block allowlist, data sources, themes, templates, ownership.

### Ключевая архитектурная проблема

Текущий Home страница зашит в React-коде (`page.tsx`). Constructor позволит перейти от hardcoded layout к конфигурационной модели, где Admin может:
- включать/выключать блоки;
- менять порядок секций;
- настраивать data source;
- управлять visibility;
- переключать темы.

---

## 2. Current Architecture Findings

### VERIFIED IN REPOSITORY

#### 2.1 Database Schema (Prisma)

**Файл:** `backend/prisma/schema.prisma` (5134 строки, 14 bounded contexts)

**Существующие модели, релевантные Constructor:**

| Модель | Схема | Назначение |
|--------|-------|-----------|
| `Product` | catalog | Товары (Tour/Hotel/Flight/etc.) |
| `Category` | catalog | Иерархические категории |
| `CategorySchema` | catalog | Конфигурация категорий (attributes, availability, tariffRules, mediaRequirements, **pdpSections** JSON) |
| `PartnerStorefront` | catalog | Партнёрские витрины (slug, branding, **themePreset**, heroHeading, heroSubheading) |
| `ProductMedia` | catalog | Медиафайлы (original/large/thumb) |
| `StorefrontMedia` | catalog | Медиа витрин (LOGO/HERO) |
| `UserWorkspaceLayout` | security | Виджетные layout пользователей (widgets JSON) |
| `AuditLog` | security | Централизованный аудит |
| `*History` (20+ таблиц) | все | Domain-level аудит по сущностям |

**Что НЕ существует (подтверждено):**
- ❌ Нет моделей `Page`, `PageSection`, `PageBlock`, `PageTemplate`, `PageTheme`
- ❌ Нет CMS/content management
- ❌ Нет rich-text / WYSIWYG хранения
- ❌ Нет моделей навигации/меню
- ❌ Нет SEO metadata моделей
- ❌ Нет тематической системы для Marketplace

#### 2.2 Существующий Widget-Based Workspace Constructor

**Уже реализован pattern для admin dashboard:**

| Файл | Назначение |
|------|-----------|
| `backend/src/modules/workspace/workspace.types.ts` | `PAGE_REGISTRY`, `WIDGET_REGISTRY`, типы |
| `backend/src/modules/workspace/workspace.service.ts` | Layout resolver, persistence, validation |
| `backend/src/modules/workspace/workspace.controller.ts` | 4 endpoint'а |
| `frontend/lib/workspace-api.ts` | Shared types + API client |
| `frontend/lib/use-workspace.ts` | React hooks |

**WidgetDefinition interface:**
```typescript
{
  widgetId: string;           // Стабильный ID
  pageIds: string[];          // Совместимые страницы
  type: WidgetType;           // "kpi-card" | "chart" | ...
  category: string;           // "KPI" | "chart" | ...
  title: string;
  permission: string | null;  // RBAC permission
  sectionPermission: string | null;
  minW/minH/maxW/maxH: number;
  defaultW/defaultH: number;
  movable/removable/resizable/required: boolean;
  dataSource: string;         // Data source ID
  version: number;
}
```

**EffectiveLayout (3-tier merge):**
```
System Default → Role Default → User Override
```

**Важно:** Этот pattern является **primary reference architecture** для Page Builder. Constructor должен **REUSE / EXTEND** этот подход, а не дублировать.

#### 2.3 Существующие API Routes

| Префикс | Контроллер | Доступ |
|---------|-----------|--------|
| `/api/v1/public/*` | PublicCatalogController, PublicSuggestController | Анонимный |
| `/api/v1/partner/*` | StorefrontController, PartnerCatalogController | PARTNER role |
| `/api/v1/products/*` | CatalogController | Staff roles |
| `/api/v1/workspaces/*` | WorkspaceController | Staff (analytics.read) |
| `/api/v1/*` (остальные) | 30+ controllers | Staff roles |

**API conventions:**
- Все маршруты: `/api/v1/`
- Пагинация: `page` + `pageSize`
- Сортировка: `sortBy` + `sortDirection`
- Request ID: `X-Request-Id` header
- Формат ответа: JSON

#### 2.4 RBAC System

**10 canonical roles:** ADMIN, DIRECTOR, FINANCE, MARKETER, ANALYST, MODERATOR, SALES_MANAGER, OPERATOR, PARTNER, BUYER

**100+ granular permissions** (не domain:write паттерн, а конкретные коды)

**Tenant isolation:**
- PARTNER scope: `user.partnerId` (server-derived from JWT)
- BUYER scope: `user.customerId` (server-derived)
- Cross-schema: нет FK между схемами — только ID references
- Object-level: `@RequirePermissions` decorator на каждом endpoint

#### 2.5 Текущая Marketplace Home

**Файл:** `frontend/app/page.tsx`

```
HEADER → HERO → SEARCH BLOCK → POPULAR DESTINATIONS → HOT TOURS → SPECIAL OFFERS → TOURS → HOTELS → FLIGHTS → ADVERTISEMENT → FOOTER
```

Каждый блок — отдельный React-компонент:
- `HeroSection.tsx` — hero carousel (3 слайда, autoplau 7s)
- `SearchBlock.tsx` — standalone search
- `PopularDestinations.tsx` — static destinations
- `HotTours.tsx` — TOUR products (newest, 6 items)
- `SpecialOffers.tsx` — price_asc mixed (4 items)
- `Tours.tsx` — TOUR products (skip 6, 6 items)
- `Hotels.tsx` — HOTEL type (client-side filter, 6 items)
- `Flights.tsx` — FLIGHT type (empty state)
- `Advertisement.tsx` — premium ad placement
- `MarketplaceFooter.tsx` — 4-column footer

**Все данные** берутся из `publicApi.listProducts()` с клиентской фильтрацией по типу.

#### 2.6 Существующий Storefront

**Двухуровневая архитектура:**
1. **Server Layer** — RSC fetches data → прокидывает как props
2. **Client Layer** — StorefrontSite.tsx рендерит standalone сайт

**Темы:** 5 пресетов (default, forest, ocean, sunset, mono)

**Кастомизация:** businessName, tagline, description, heroHeading, heroSubheading, themePreset, contacts, media

**Channel model:** Product → `ProductPublicationChannel` (MARKETPLACE / PARTNER_STOREFRONT)

#### 2.7 i18n System

**Клиент-side only** (не URL prefix)

**3 словаря:**
- Main DICT (`i18n.tsx`): 500+ ключей
- PARTNER_DICT (`partner-i18n.ts`): 442+ ключа
- HELP_DICT (`help-i18n.ts`): 130+ ключей

**Паттерн:** `t("key", locale)` — простой lookup из Record<Locale, string>

#### 2.8 Медиа система

**Pipeline:** Upload → Multer → Sharp → S3Storage → ProductMedia

**3 производных:** original, large.webp (1600px), thumb.webp (480px)

**Security:** Private by default, signed URLs (5min TTL), public delivery через 302 redirect

#### 2.9 Design System

**Tailwind CSS v4** с кастомными токенами:
```css
--color-brand: #2563eb;
--color-gold: #c9a96e;
--color-dark: #0d0d0d;
--color-dark-surface: #1a1a1a;
--color-dark-card: #242424;
--color-dark-border: #333333;
```

**Кастомные CSS классы:** `.card-premium`, `.btn-gold`, `.search-glass`, `.hero-overlay`

**Drag & Drop:** `@dnd-kit/core` + `@dnd-kit/sortable` (уже в dependencies)

---

## 3. Existing Components Reuse Map

### Mapping: Current Home → Future Block Registry

| Current Component | Block Type | Data Source | Route | Reusable | Refactoring Needed |
|-------------------|-----------|-------------|-------|----------|-------------------|
| `HeroSection.tsx` | `hero` | static config | `/` | ✅ Yes | Extract carousel config to block settings |
| `SearchBlock.tsx` | `search` | static config | `/` | ✅ Yes | Already standalone |
| `PopularDestinations.tsx` | `popular-destinations` | static config | `/` | ✅ Yes | Already standalone |
| `HotTours.tsx` | `hot-tours` | `publicApi.listProducts({sort:"newest"})` + client filter | `/` | ✅ Yes | Data source abstraction needed |
| `SpecialOffers.tsx` | `special-offers` | `publicApi.listProducts({sort:"price_asc"})` + client filter | `/` | ✅ Yes | Data source abstraction needed |
| `Tours.tsx` | `tours` | `publicApi.listProducts({sort:"newest"})` + client filter | `/` | ✅ Yes | Data source abstraction needed |
| `Hotels.tsx` | `hotels` | `publicApi.listProducts({sort:"newest"})` + client filter | `/` | ✅ Yes | Data source abstraction needed |
| `Flights.tsx` | `flights` | `publicApi.listProducts({sort:"newest"})` + client filter | `/` | ✅ Yes | Empty state already implemented |
| `Advertisement.tsx` | `advertisement` | static config | `/` | ✅ Yes | Already standalone |
| `MarketplaceHeader.tsx` | `header` (system) | auth context | `/` | ⚠️ Singleton | Must remain singleton |
| `MarketplaceFooter.tsx` | `footer` (system) | static config | `/` | ⚠️ Singleton | Must remain singleton |

### Storefront Components (Channel 2)

| Component | Reusable | Notes |
|-----------|----------|-------|
| `StorefrontSite.tsx` | ⚠️ Separate engine | Storefront has own rendering pipeline |
| `StorefrontPdp.tsx` | ⚠️ Separate engine | Product detail within storefront |
| `storefront-theme.ts` | ✅ Extend | 5 presets, extendable |

---

## 4. Target Architecture

### 4.1 High-Level Flow

```
Admin UI (Constructor)
        ↓
Page Configuration (JSON)
        ↓
Validation (server-side)
        ↓
Block Registry (allowlist)
        ↓
Data Sources (resolved per block)
        ↓
Renderer (SSR/CSR)
        ↓
Rendered Page
```

### 4.2 Key Principles

1. **Configuration-driven:** Page structure = JSON config, not React code
2. **Allowlist-based:** Only registered blocks can be used
3. **Server-validated:** All configuration validated backend-side
4. **Tenant-isolated:** Marketplace ≠ Storefront, never mixed
5. **Gradual migration:** No big-bang rewrite
6. **Single renderer:** Preview and Published use same rendering contract

### 4.3 Architecture Layers

```
┌─────────────────────────────────────────┐
│           Admin Constructor UI          │
│   (Drag & Drop, Settings, Preview)      │
├─────────────────────────────────────────┤
│         Page Configuration API          │
│   (CRUD, Version, Draft/Publish)        │
├─────────────────────────────────────────┤
│          Block Registry Service         │
│   (Allowlist, Validation, Schema)       │
├─────────────────────────────────────────┤
│          Data Source Service            │
│   (Resolution, Caching, Aggregation)    │
├─────────────────────────────────────────┤
│          Page Renderer Service          │
│   (SSR, CSR, Block Composition)         │
├─────────────────────────────────────────┤
│         Existing TravelHub Core         │
│   (Products, Catalog, Auth, RBAC)       │
└─────────────────────────────────────────┘
```

---

## 5. Context Model: Marketplace vs Partner Storefront

### 5.1 Context Separation

| Dimension | Marketplace | Partner Storefront |
|-----------|------------|-------------------|
| **Scope** | Global (entire platform) | Per-tenant (one partner) |
| **Ownership** | Platform admin | Partner |
| **Blocks** | Full marketplace block set | Limited storefront blocks |
| **Data Sources** | All products, categories, destinations | Own products only |
| **Theme** | Global marketplace theme | Partner's theme preset |
| **Templates** | Marketplace templates | Storefront templates |
| **Permissions** | `marketplace.*` | `storefront.*_own` |
| **Route** | `/` | `/store/[slug]` |
| **i18n** | Platform-wide | Partner's defaultLocale |

### 5.2 Terminology (STRICT)

| Term | Definition |
|------|-----------|
| **Marketplace** | Публичная витрина TravelHub. Channel 1. Никогда не Storefront. |
| **Storefront** | Partner Storefront / Channel 2. Никогда не Marketplace. |
| **Constructor** | Admin UI для управления структурой страниц |
| **Page Builder** | Движок для сборки страниц из блоков |

### 5.3 Tenant Boundary

```
Marketplace (global)
    │
    ├── Block Registry: ALL blocks allowed
    ├── Data Sources: ALL products, ALL categories
    ├── Theme: marketplace-global
    └── Ownership: platform admin

Partner Storefront (per-tenant)
    │
    ├── Block Registry: storefront-only blocks
    ├── Data Sources: own products only
    ├── Theme: partner's themePreset
    └── Ownership: partner (via user.partnerId)
```

**Enforcement:**
- Server-side: `user.partnerId` from JWT, never from request body
- Cross-tenant: NO foreign keys between schemas
- Object-level: `@RequirePermissions` on every endpoint

---

## 6. Block Registry

### 6.1 BlockDefinition Interface

```typescript
interface BlockDefinition {
  type: string;                    // Уникальный ID блока
  version: number;                 // Contract version
  category: BlockCategory;         // "system" | "marketplace" | "content" | "commerce"
  displayName: string;             // Локализованное имя
  description: string;             // Описание
  allowedContexts: Context[];      // ["marketplace"] | ["storefront"] | ["marketplace", "storefront"]
  allowedDataSources: string[];    // Разрешённые data source types
  allowedLayouts: LayoutType[];    // Разрешённые layout'ы
  settingsSchema: JSONSchema;      // Валидация настроек блока
  styleSchema: JSONSchema;         // Валидация стилей
  responsiveSchema: JSONSchema;    // Валидация responsive config
  permissions: string[];           // RBAC permissions для доступа
  singleton: boolean;              // Только один экземпляр на страницу
  renderer: string;                // Имя React-компонента для рендера
}
```

### 6.2 Block Categories

#### System Blocks (singleton, always present)

| Type | Renderer | Singleton | Notes |
|------|----------|-----------|-------|
| `header` | `MarketplaceHeader` | ✅ | Системный, не удаляемый |
| `footer` | `MarketplaceFooter` | ✅ | Системный, не удаляемый |
| `search` | `SearchBlock` | ✅ | Глобальный поиск |

#### Marketplace Service Blocks

| Type | Renderer | Data Source | Allowed Contexts |
|------|----------|-------------|-----------------|
| `hero` | `HeroSection` | static config | marketplace |
| `popular-destinations` | `PopularDestinations` | static config | marketplace |
| `hot-tours` | `HotTours` | `product-feed?type=TOUR&sort=newest` | marketplace |
| `special-offers` | `SpecialOffers` | `product-feed?sort=price_asc` | marketplace |
| `tours` | `Tours` | `product-feed?type=TOUR&sort=newest&offset=6` | marketplace |
| `hotels` | `Hotels` | `product-feed?type=HOTEL` | marketplace |
| `flights` | `Flights` | `product-feed?type=FLIGHT` | marketplace |
| `sanatoriums` | `Sanatoriums` | `product-feed?type=SANATORIUM` | marketplace |
| `excursions` | `Excursions` | `product-feed?type=EXCURSION` | marketplace |
| `transfers` | `Transfers` | `product-feed?type=TRANSFER` | marketplace |
| `guides` | `Guides` | `product-feed?type=GUIDE` | marketplace |
| `car-rental` | `CarRental` | `product-feed?type=CAR_RENTAL` | marketplace |
| `cruises` | `Cruises` | `product-feed?type=CRUISE` | marketplace |
| `railway` | `Railway` | `product-feed?type=TRAIN` | marketplace |
| `advertisement` | `Advertisement` | static config | marketplace |

#### Content / Design Blocks

| Type | Renderer | Data Source | Allowed Contexts |
|------|----------|-------------|-----------------|
| `hero-banner` | `HeroBanner` | media + text | marketplace, storefront |
| `image-text` | `ImageText` | media + rich text | marketplace, storefront |
| `gallery` | `Gallery` | media array | marketplace, storefront |
| `reviews` | `Reviews` | review feed | marketplace, storefront |
| `about` | `About` | rich text | marketplace, storefront |
| `benefits` | `Benefits` | structured list | marketplace, storefront |
| `faq` | `Faq` | structured list | marketplace, storefront |
| `contact` | `Contact` | contact info | marketplace, storefront |
| `cta` | `Cta` | text + action | marketplace, storefront |
| `video` | `Video` | media URL | marketplace, storefront |
| `blog` | `Blog` | article feed | marketplace, storefront |
| `promo-section` | `PromoSection` | campaign data | marketplace, storefront |
| `divider` | `Divider` | none | marketplace, storefront |
| `spacer` | `Spacer` | none | marketplace, storefront |
| `rich-content` | `RichContent` | structured content | marketplace, storefront |

### 6.3 Block Registry Storage

**Backend:** Static `BLOCK_REGISTRY` array in `backend/src/modules/constructor/block-registry.ts` (analogous to `WIDGET_REGISTRY` in workspace)

**Frontend:** Shared types in `frontend/lib/constructor-api.ts` (analogous to `workspace-api.ts`)

**Runtime:** Registry loaded at startup, cached in memory, validated against schema

### 6.4 Adding New Blocks

1. Define `BlockDefinition` in registry
2. Create React renderer component
3. Define data source adapter
4. Define settings/style schemas
5. Register in `BLOCK_REGISTRY`
6. No database migration needed for block definition itself

---

## 7. Page Model

### 7.1 Domain Model

```typescript
// Core entities
interface Page {
  id: string;                    // UUID
  slug: string;                  // URL identifier ("marketplace-home", "storefront-{partnerId}")
  context: Context;              // "marketplace" | "storefront"
  tenantId: string | null;       // partnerId for storefront, null for marketplace
  status: PageStatus;            // "DRAFT" | "PUBLISHED" | "ARCHIVED"
  currentVersion: number;        // Текущая опубликованная версия
  draftVersion: number | null;   // Черновик версия
  themeId: string | null;        // Ссылка на тему
  templateId: string | null;     // Ссылка на шаблон
  seo: SeoConfig;                // SEO metadata
  createdAt: DateTime;
  updatedAt: DateTime;
  publishedAt: DateTime | null;
}

interface PageSection {
  id: string;                    // UUID
  pageId: string;                // FK → Page
  version: number;               // Версия страницы
  blockType: string;             // Тип блока из registry
  blockInstanceId: string;       // Уникальный ID экземпляра блока
  sortOrder: number;             // Порядок (0-based)
  enabled: boolean;              // Включён/выключён
  settings: Record<string, unknown>;  // Настройки блока (validated against settingsSchema)
  style: BlockStyle;             // Визуальные настройки
  responsive: ResponsiveConfig;  // Responsive настройки
  dataSource: DataSourceConfig;  // Конфигурация источника данных
  visibility: VisibilityRule | null;  // Правило видимости
  localeContent: LocaleContent;  // Локализованный контент
  createdAt: DateTime;
  updatedAt: DateTime;
}

interface BlockStyle {
  backgroundColor: string | null;
  textColor: string | null;
  borderColor: string | null;
  borderRadius: string | null;
  padding: string | null;
  margin: string | null;
  customTokens: Record<string, string>;  // Design tokens (controlled values only)
}

interface ResponsiveConfig {
  desktop: BreakpointConfig;
  tablet: BreakpointConfig;
  mobile: BreakpointConfig;
}

interface BreakpointConfig {
  columns: number | null;
  spacing: string | null;
  typographyScale: number | null;
  visibility: boolean;
  imageAspectRatio: string | null;
}

interface DataSourceConfig {
  type: string;                  // "product-feed" | "static" | "manual" | "campaign" | ...
  params: Record<string, unknown>;  // Параметры запроса
  cacheTtl: number;             // Время кеширования (seconds)
}

interface SeoConfig {
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  canonical: string | null;
  robots: string;                // "index" | "noindex"
  ogImage: string | null;
}

interface LocaleContent {
  [locale: string]: {
    title: string | null;
    subtitle: string | null;
    description: string | null;
    cta: string | null;
    media: MediaReference[];
    items: ContentItem[];        // Structured content items
  };
}
```

### 7.2 Database Tables (Proposed)

```sql
-- Core page configuration
CREATE TABLE constructor.pages (
  id UUID PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  context VARCHAR(50) NOT NULL,  -- "marketplace" | "storefront"
  tenant_id UUID,                -- NULL for marketplace, partnerId for storefront
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  current_version INT,
  draft_version INT,
  theme_id UUID,
  template_id UUID,
  seo JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);

-- Page sections (blocks)
CREATE TABLE constructor.page_sections (
  id UUID PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  version INT NOT NULL,
  block_type VARCHAR(100) NOT NULL,
  block_instance_id VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  style JSONB DEFAULT '{}',
  responsive JSONB DEFAULT '{}',
  data_source JSONB DEFAULT '{}',
  visibility JSONB,
  locale_content JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  UNIQUE(page_id, version, block_instance_id)
);

-- Version history
CREATE TABLE constructor.page_versions (
  id UUID PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  version INT NOT NULL,
  status VARCHAR(50) NOT NULL,  -- "draft" | "published" | "archived"
  snapshot JSONB NOT NULL,      -- Полный снимок конфигурации
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE(page_id, version)
);

-- Audit trail
CREATE TABLE constructor.page_audit_log (
  id UUID PRIMARY KEY,
  page_id UUID NOT NULL,
  version INT,
  action VARCHAR(100) NOT NULL,  -- "create" | "update" | "publish" | "rollback" | ...
  actor_id UUID NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.3 Tenant Scope

| Context | tenantId | Enforcement |
|---------|----------|-------------|
| Marketplace | NULL | Server-side: only ADMIN can modify |
| Storefront | partnerId | Server-side: `user.partnerId` from JWT |

---

## 8. Version Model

### 8.1 Lifecycle

```
Draft (auto-saved)
   ↓
Manual Save → Draft (explicit)
   ↓
Preview (read-only, noindex)
   ↓
Publish → Published (public)
   ↓
Unpublish → Archived
   ↓
Rollback → Published (previous version)
```

### 8.2 Version States

| State | Public Visible | Preview Access | Editable |
|-------|---------------|----------------|----------|
| `draft` | ❌ | ✅ (auth only) | ✅ |
| `published` | ✅ | ✅ | ⚠️ (creates new draft) |
| `archived` | ❌ | ❌ | ❌ |

### 8.3 Rollback Strategy

```typescript
// Publish = snapshot current draft as new published version
async function publish(pageId: string, actorId: string) {
  const draft = await getDraft(pageId);
  const snapshot = await buildSnapshot(draft);
  
  await prisma.$transaction([
    // Archive current published
    prisma.pageVersions.update({
      where: { pageId_version: { pageId, version: currentPage.currentVersion } },
      data: { status: 'archived' }
    }),
    // Create new published version
    prisma.pageVersions.create({
      data: { pageId, version: nextPageVersion, status: 'published', snapshot, publishedAt: new Date() }
    }),
    // Update page
    prisma.pages.update({
      where: { id: pageId },
      data: { currentVersion: nextPageVersion, status: 'PUBLISHED', publishedAt: new Date() }
    }),
    // Audit log
    prisma.pageAuditLog.create({
      data: { pageId, version: nextPageVersion, action: 'publish', actorId, after: snapshot }
    })
  ]);
}

// Rollback = re-activate a previous published version
async function rollback(pageId: string, targetVersion: number, actorId: string) {
  const target = await prisma.pageVersions.findUnique({
    where: { pageId_version: { pageId, version: targetVersion } }
  });
  // ... similar to publish, but using target.snapshot
}
```

### 8.4 MVP Scope

| Feature | MVP | Future |
|---------|-----|--------|
| Save draft | ✅ | — |
| Preview | ✅ | — |
| Publish | ✅ | — |
| Rollback | ✅ | — |
| Version history | ✅ (list) | ✅ (diff viewer) |
| Scheduled publish | ❌ | ✅ |
| Auto-save | ❌ | ✅ |

---

## 9. Data Source Model

### 9.1 DataSourceDefinition

```typescript
interface DataSourceDefinition {
  type: string;                  // Уникальный ID
  displayName: string;
  description: string;
  allowedBlockTypes: string[];   // Какие блоки могут использовать
  paramsSchema: JSONSchema;      // Валидация параметров
  resolver: string;              // Имя resolver function
  cacheable: boolean;
  defaultTtl: number;
}
```

### 9.2 Registered Data Sources

| Type | Resolver | Description | Cache |
|------|----------|-------------|-------|
| `product-feed` | `resolveProductFeed` | Продукты с фильтрами (type, sort, category) | 60s |
| `static-config` | `resolveStaticConfig` | Статическая конфигурация (hero slides, destinations) | Page cache |
| `manual-content` | `resolveManualContent` | Ручной контент из localeContent | Page cache |
| `campaign-feed` | `resolveCampaignFeed` | Marketing campaigns | 300s |
| `promotion-feed` | `resolvePromotionFeed` | Будущие promotion/hot flags | 120s |
| `advertisement-feed` | `resolveAdvertisementFeed` | Ad campaigns | 300s |
| `review-feed` | `resolveReviewFeed` | Отзывы | 300s |

### 9.3 Product Feed Resolver (Current Implementation Mapping)

```typescript
// How current hardcoded data fetching maps to data source config:
HotTours → {
  type: "product-feed",
  params: { type: "TOUR", sort: "newest", pageSize: 6 },
  cacheTtl: 60
}

SpecialOffers → {
  type: "product-feed",
  params: { sort: "price_asc", pageSize: 4 },
  cacheTtl: 60
}

Tours → {
  type: "product-feed",
  params: { type: "TOUR", sort: "newest", pageSize: 6, offset: 6 },
  cacheTtl: 60
}

Hotels → {
  type: "product-feed",
  params: { type: "HOTEL", sort: "newest", pageSize: 6 },
  cacheTtl: 60
}

Flights → {
  type: "product-feed",
  params: { type: "FLIGHT", sort: "newest", pageSize: 6 },
  cacheTtl: 60
}
```

### 9.4 Hot Tours / Special Offers — Architecture Note

**Текущее ограничение (документировано):**
- Hot Tours = TOUR products (newest) — нет backend hot/promotion flags
- Special Offers = price_asc mixed — нет backend discount mechanism

**Constructor approach:**
- Block registered с текущим data source
- Data source resolver использует существующий `publicApi.listProducts()`
- Future: когда backend добавит promotion/hot flags, data source обновляется без изменения block

---

## 10. Layout Model

### 10.1 Layout Types

```typescript
type LayoutType =
  | "full-width"         // Полная ширина
  | "grid-2"             // 2 колонки
  | "grid-3"             // 3 колонки
  | "grid-4"             // 4 колонки
  | "split"              // 50/50
  | "sidebar-left"       // Sidebar слева
  | "sidebar-right"      // Sidebar справа
  | "hero"               // Hero section
  | "carousel"           // Карусель
  | "horizontal-list"    // Горизонтальный список
  | "vertical-list"      // Вертикальный список
  | "masonry";           // Masonry grid
```

### 10.2 Block Layout Configuration

```typescript
interface BlockLayout {
  type: LayoutType;
  columns: number;
  gap: string;              // Tailwind spacing token
  maxWidth: string | null;
  alignment: "start" | "center" | "end" | "stretch";
}
```

### 10.3 Responsive Behavior

Layout adapts per breakpoint:
- Desktop: full layout as configured
- Tablet: may reduce columns (grid-4 → grid-2)
- Mobile: always single column

---

## 11. Theme / Design Tokens

### 11.1 Theme Model

```typescript
interface Theme {
  id: string;
  name: string;
  tokens: DesignTokens;
  isGlobal: boolean;          // true for marketplace, false for storefront
  tenantId: string | null;    // null for global themes
}

interface DesignTokens {
  // Colors
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  
  // Typography
  headingFont: string;
  bodyFont: string;
  buttonFont: string;
  
  // Borders
  borderColor: string;
  borderRadius: string;
  
  // Spacing
  sectionPadding: string;
  blockGap: string;
}
```

### 11.2 Existing Storefront Themes (REUSE)

| Preset | Accent | Header | Hero |
|--------|--------|--------|------|
| `default` | `blue-600` | `slate-900` | `blue-700→indigo-700` |
| `forest` | `emerald-600` | `slate-900` | `emerald-800→teal-700` |
| `ocean` | `cyan-600` | `slate-900` | `cyan-800→blue-800` |
| `sunset` | `orange-600` | `slate-900` | `orange-700→rose-600` |
| `mono` | `slate-800` | `slate-900` | `slate-800→slate-600` |

### 11.3 Marketplace Global Theme

Текущий dark luxury marketplace (`--color-dark: #0d0d0d`, gold accent `#c9a96e`) становится default marketplace theme.

---

## 12. Typography

### 12.1 Controlled Typography Controls

| Control | Type | Allowed Values |
|---------|------|----------------|
| fontFamily | enum | `"inter"`, `"serif"`, `"display"` |
| fontSize | token | `"xs"`, `"sm"`, `"base"`, `"lg"`, `"xl"`, `"2xl"`, `"3xl"` |
| fontWeight | token | `"normal"`, `"medium"`, `"semibold"`, `"bold"` |
| fontStyle | enum | `"normal"`, `"italic"` |
| lineHeight | token | `"tight"`, `"normal"`, `"relaxed"` |
| letterSpacing | token | `"tight"`, `"normal"`, `"wide"` |
| textAlign | enum | `"left"`, `"center"`, `"right"` |
| textColor | token | Theme color reference |

### 12.2禁止

- ❌ Arbitrary CSS values
- ❌ Custom font uploads
- ❌ Raw CSS injection
- ❌ Media queries (управляются через responsive schema)

---

## 13. Media

### 13.1 MediaAsset Model (Extension of Existing)

```typescript
interface MediaAsset {
  id: string;                    // UUID (existing ProductMedia/StorefrontMedia pattern)
  url: string;                   // Public or signed URL
  thumbUrl: string;              // Thumbnail
  largeUrl: string;              // Large version
  type: MediaType;               // "IMAGE" | "VIDEO"
  mimeType: string;
  alt: Record<Locale, string>;   // Localized alt text
  width: number;
  height: number;
  focalPoint: { x: number; y: number } | null;
  caption: Record<Locale, string> | null;
}
```

### 13.2 Media Upload (REUSE Existing Pipeline)

```
Upload → Multer (15MB) → Sharp → S3Storage → Media record
```

**Existing infrastructure:**
- `ProductMedia` for product images
- `StorefrontMedia` for storefront logo/hero
- S3 storage service (`S3StorageService`)
- Signed URL generation
- 3 derivative sizes (original, large, thumb)

**Constructor extension:**
- New model `ConstructorMedia` for page-level media
- Same upload pipeline, different ownership scope
- Tenant isolation: partner media → partner scope only

---

## 14. Visibility Rules

### 14.1 Manual Visibility

```typescript
interface ManualVisibility {
  enabled: boolean;              // Простой вкл/выкл
}
```

### 14.2 Conditional Visibility

```typescript
interface ConditionalVisibility {
  operator: "GT" | "LT" | "EQ" | "GTE" | "LTE" | "AND" | "OR" | "NOT";
  rules: VisibilityRule[];
}

interface VisibilityCondition {
  field: string;                 // "products.count" | "campaign.active" | ...
  operator: "GT" | "LT" | "EQ" | "GTE" | "LTE";
  value: string | number | boolean;
}
```

### 14.3 Example

```json
{
  "operator": "GT",
  "field": "products.count",
  "value": 0
}
```

### 14.4 Safety

- ❌ No arbitrary JavaScript expressions
- ❌ No user-supplied code execution
- ✅ Declarative rule schema only
- ✅ Server-side evaluation
- ✅ Whitelist of allowed fields

---

## 15. Renderer

### 15.1 Rendering Pipeline

```
Page Configuration (from DB/cache)
        ↓
Validation (against Block Registry)
        ↓
Data Source Resolution (per block, parallel)
        ↓
Block Rendering (ordered by sortOrder)
        ↓
Composition (header + sections + footer)
        ↓
Rendered HTML
```

### 15.2 Single Renderer Principle

Preview and Published use the **same rendering code**:

| State | Renderer | Difference |
|-------|----------|-----------|
| Draft | `PageRenderer` | Only accessible via `/preview` (auth) |
| Published | `PageRenderer` | Accessible via public route |
| Preview | `PageRenderer` | Adds `noindex`, preview banner |

### 15.3 Block Renderer Interface

```typescript
interface BlockRenderer {
  type: string;                  // Block type
  component: React.ComponentType<BlockRendererProps>;
}

interface BlockRendererProps {
  block: PageSection;            // Block configuration
  dataSource: DataSourceResult;  // Resolved data
  isPreview: boolean;
  locale: Locale;
}
```

### 15.4 SSR / CSR Strategy

| Block Type | Rendering | Rationale |
|------------|-----------|-----------|
| System (header, footer) | SSR | SEO, fast paint |
| Service (hot-tours, hotels) | SSR + client hydrate | SEO + interactivity |
| Content (hero, about) | SSR | SEO |
| Interactive (search, forms) | CSR | User interaction |

---

## 16. Draft / Preview / Publish

### 16.1 Draft

- Auto-saved on every change (debounced 2s)
- Stored in `page_sections` with `status=draft`
- Only visible to authenticated editors
- Never indexed by search engines

### 16.2 Preview

- Route: `/preview/marketplace-home` (admin) or `/partner/storefront/preview` (partner)
- Fetches draft version
- Renders with same `PageRenderer`
- Adds `noindex, nofollow` meta tag
- Shows preview banner (conditional)
- Protected by auth + RBAC

### 16.3 Publish

- Snapshot current draft → create `page_versions` entry with `status=published`
- Update `pages.current_version` and `pages.status='PUBLISHED'`
- Public route now serves new version
- Audit log entry created

### 16.4 Unpublish

- Set `pages.status='ARCHIVED'`
- Public route returns 404
- Draft preserved for future edits

### 16.5 SEO Protection

| State | robots | Sitemap | Crawlable |
|-------|--------|---------|-----------|
| Draft | noindex | ❌ | ❌ |
| Preview | noindex | ❌ | ❌ |
| Published | index (configurable) | ✅ | ✅ |
| Archived | noindex | ❌ | ❌ |

---

## 17. Templates

### 17.1 Template Model

```typescript
interface Template {
  id: string;
  name: string;
  description: string;
  context: Context;              // "marketplace" | "storefront"
  blocks: TemplateBlock[];       // Default block configuration
  themeId: string | null;
  isDefault: boolean;
}

interface TemplateBlock {
  blockType: string;
  sortOrder: number;
  enabled: boolean;
  settings: Record<string, unknown>;
  dataSource: DataSourceConfig;
}
```

### 17.2 Default Templates

| Template | Context | Blocks |
|----------|---------|--------|
| `marketplace-premium` | marketplace | hero, search, popular-destinations, hot-tours, special-offers, tours, hotels, flights, advertisement |
| `marketplace-minimal` | marketplace | hero, search, tours, hotels |
| `storefront-default` | storefront | hero-banner, about, products, contact |
| `storefront-premium` | storefront | hero-banner, benefits, products, gallery, reviews, contact |

### 17.3 Template Application

Template = default `PageSection[]` configuration. Applying template:
1. Clear current draft sections
2. Insert template blocks as new draft
3. Preserve existing media/localeContent where possible

---

## 18. Reusable Sections

### 18.1 Save as Reusable

Any block configuration can be saved as a reusable section:

```typescript
interface ReusableSection {
  id: string;
  name: string;
  blockType: string;
  settings: Record<string, unknown>;
  style: BlockStyle;
  responsive: ResponsiveConfig;
  localeContent: LocaleContent;
  createdBy: string;
  tenantId: string | null;      // NULL = platform-wide, partnerId = partner-only
  createdAt: DateTime;
}
```

### 18.2 Constraints

- Reusable sections respect tenant isolation
- Partner can only use/reuse sections within own scope
- Platform admin can create global reusable sections
- Reusable section = template, not live link (changes don't propagate)

---

## 19. API Contract

### 19.1 API Surface

| Method | Route | Permission | Description |
|--------|-------|-----------|-------------|
| `GET` | `/api/v1/constructor/pages` | `marketplace.page.read` | List pages |
| `GET` | `/api/v1/constructor/pages/:id` | `marketplace.page.read` | Get page |
| `POST` | `/api/v1/constructor/pages` | `marketplace.page.create` | Create page |
| `PATCH` | `/api/v1/constructor/pages/:id` | `marketplace.page.update` | Update page metadata |
| `DELETE` | `/api/v1/constructor/pages/:id` | `marketplace.page.delete` | Delete page |
| `GET` | `/api/v1/constructor/pages/:id/sections` | `marketplace.page.read` | Get sections |
| `PUT` | `/api/v1/constructor/pages/:id/sections` | `marketplace.page.update` | Replace all sections |
| `PATCH` | `/api/v1/constructor/pages/:id/sections/:sectionId` | `marketplace.page.update` | Update single section |
| `POST` | `/api/v1/constructor/pages/:id/publish` | `marketplace.page.publish` | Publish draft |
| `POST` | `/api/v1/constructor/pages/:id/unpublish` | `marketplace.page.unpublish` | Unpublish |
| `POST` | `/api/v1/constructor/pages/:id/rollback` | `marketplace.page.rollback` | Rollback to version |
| `GET` | `/api/v1/constructor/pages/:id/versions` | `marketplace.page.read` | List versions |
| `GET` | `/api/v1/constructor/pages/:id/preview` | `marketplace.page.preview` | Preview draft |
| `GET` | `/api/v1/constructor/blocks` | `marketplace.page.read` | List available blocks |
| `GET` | `/api/v1/constructor/templates` | `marketplace.page.read` | List templates |
| `GET` | `/api/v1/constructor/themes` | `marketplace.page.read` | List themes |

**Partner Storefront equivalents:**
| Method | Route | Permission |
|--------|-------|-----------|
| `GET` | `/api/v1/partner/constructor/pages` | `storefront.page.read_own` |
| `GET` | `/api/v1/partner/constructor/pages/:id` | `storefront.page.read_own` |
| `PATCH` | `/api/v1/partner/constructor/pages/:id` | `storefront.page.update_own` |
| `PUT` | `/api/v1/partner/constructor/pages/:id/sections` | `storefront.page.update_own` |
| `POST` | `/api/v1/partner/constructor/pages/:id/publish` | `storefront.page.publish_own` |

### 19.2 API Conventions (REUSE Existing)

- Prefix: `/api/v1/`
- Pagination: `page` + `pageSize`
- Sorting: `sortBy` + `sortDirection`
- Request ID: `X-Request-Id`
- Validation: class-validator DTOs
- Response: JSON

---

## 20. Admin UX

### 20.1 Navigation Structure

```
Admin (Shell)
└── Витрина
    ├── Главная (page view)
    └── Конструктор (constructor)
```

### 20.2 Constructor Screen Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Витрина → Конструктор                                  [···]│
│                                                              │
│  [Draft]  [Preview]  [Publish]                               │
├────────────────┬────────────────────────────────────────────┤
│ Blocks Panel   │ Canvas                                      │
│                │                                              │
│ ▸ System       │ ┌──────────────────────────────────────┐   │
│   Header       │ │ [☰] Hero Banner                 [···]│   │
│   Footer       │ ├──────────────────────────────────────┤   │
│   Search       │ │ [☰] Search Block                [···]│   │
│                │ ├──────────────────────────────────────┤   │
│ ▸ Marketplace  │ │ [☰] Popular Destinations         [···]│   │
│   Hot Tours    │ ├──────────────────────────────────────┤   │
│   Tours        │ │ [☰] Hot Tours                   [···]│   │
│   Hotels       │ ├──────────────────────────────────────┤   │
│   Flights      │ │ [☰] Special Offers              [···]│   │
│   ...          │ ├──────────────────────────────────────┤   │
│                │ │ [☰] Tours                       [···]│   │
│ ▸ Content      │ ├──────────────────────────────────────┤   │
│   Hero Banner  │ │ [☰] Hotels                      [···]│   │
│   Gallery      │ ├──────────────────────────────────────┤   │
│   Reviews      │ │ [☰] Flights                     [···]│   │
│   ...          │ ├──────────────────────────────────────┤   │
│                │ │ [☰] Advertisement               [···]│   │
│ ▸ Templates    │ └──────────────────────────────────────┘   │
│   Premium      │                                              │
│   Minimal      │                                              │
└────────────────┴────────────────────────────────────────────┘

[···] = Block actions menu:
  - Settings
  - Duplicate
  - Visibility
  - Data Source
  - Layout
  - Style
  - Responsive
  - I18n
  - Delete
```

### 20.3 Block Settings Panel

When a block is selected, a settings panel slides in:

```
┌─────────────────────────────────────────┐
│ Hot Tours — Settings                     │
├─────────────────────────────────────────┤
│ Data Source                              │
│   Type: [Product Feed ▾]                │
│   Product Type: [Tour ▾]                │
│   Sort: [Newest ▾]                      │
│   Page Size: [6]                        │
│                                         │
│ Layout                                  │
│   Type: [Grid 4-col ▾]                 │
│   Gap: [4 ▾]                            │
│                                         │
│ Visibility                              │
│   [x] Enabled                           │
│   Condition: products.count > 0         │
│                                         │
│ Style                                   │
│   Background: [Dark ▾]                  │
│   Accent: [Gold ▾]                      │
│                                         │
│ I18n                                    │
│   Title (RU): Горящие туры              │
│   Title (AZ): Günəş tur                   │
│   Title (EN): Hot Tours                 │
│   Subtitle: ...                         │
└─────────────────────────────────────────┘
```

---

## 21. RBAC / Tenant Isolation

### 21.1 Permissions (Proposed Extension)

| Permission | Role | Scope |
|-----------|------|-------|
| `marketplace.page.read` | ADMIN, DIRECTOR, MARKETER | Global |
| `marketplace.page.create` | ADMIN | Global |
| `marketplace.page.update` | ADMIN | Global |
| `marketplace.page.delete` | ADMIN | Global |
| `marketplace.page.publish` | ADMIN, DIRECTOR | Global |
| `marketplace.page.preview` | ADMIN, DIRECTOR, MARKETER | Global |
| `storefront.page.read_own` | PARTNER | Own tenant |
| `storefront.page.update_own` | PARTNER | Own tenant |
| `storefront.page.publish_own` | PARTNER | Own tenant |

### 21.2 Tenant Isolation Enforcement

```typescript
// Middleware/guard pattern
@Injectable()
export class ConstructorTenantGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const pageSlug = request.params.slug || request.params.id;
    
    // Marketplace pages: only ADMIN
    if (pageSlug.startsWith('marketplace')) {
      return user.role === 'ADMIN';
    }
    
    // Storefront pages: only owner partner
    if (pageSlug.startsWith('storefront')) {
      return user.partnerId === extractPartnerId(pageSlug);
    }
    
    return false;
  }
}
```

### 21.3 Cross-Tenant Safety

- ❌ Partner A cannot see Partner B's page configuration
- ❌ Partner cannot modify Marketplace Home
- ❌ Partner cannot use platform-wide reusable sections
- ✅ Partner can only manage own storefront pages
- ✅ Admin can manage all pages

---

## 22. Security

### 22.1 Input Validation

| Risk | Mitigation |
|------|-----------|
| Arbitrary JS injection | ❌ No JS allowed in block settings/content |
| Arbitrary HTML injection | ❌ Structured content only, no raw HTML |
| Arbitrary CSS injection | ❌ Design tokens only, no raw CSS |
| XSS via locale content | Server-side sanitization, CSP headers |
| Image upload abuse | MIME validation (JPEG/PNG/WebP only), size limits (15MB), magic-byte detection |
| URL validation | Whitelist allowed protocols (https only for external) |
| Config tampering | Server-side validation against JSON schemas |

### 22.2 Content Security

```typescript
// Sanitization pipeline for locale content
function sanitizeLocaleContent(content: LocaleContent): LocaleContent {
  return {
    title: sanitizeText(content.title),           // Strip HTML tags
    subtitle: sanitizeText(content.subtitle),
    description: sanitizeRichText(content.description),  // Allow safe HTML subset
    cta: sanitizeText(content.cta),
    media: content.media.map(sanitizeMediaRef),   // Validate media references
    items: content.items.map(sanitizeContentItem), // Validate structure
  };
}
```

### 22.3 Preview Access Control

- Preview routes require authentication + RBAC
- Preview adds `noindex, nofollow` to prevent indexing
- Preview uses signed URLs (short TTL)
- Preview banner visible only to authenticated users

### 22.4 Audit Trail

Every Constructor action logged:

```typescript
interface ConstructorAuditEntry {
  pageId: string;
  version: number | null;
  action: "create" | "update" | "publish" | "unpublish" | "rollback" | "delete";
  actorId: string;
  actorRole: string;
  tenantId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: DateTime;
}
```

---

## 23. SEO

### 23.1 SEO Configuration Per Page

```typescript
interface SeoConfig {
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  canonical: string | null;
  robots: "index" | "noindex";
  ogImage: string | null;
  structuredData: Record<string, unknown> | null;  // JSON-LD
}
```

### 23.2 SEO Hierarchy

| Element | Source | Priority |
|---------|--------|----------|
| `<title>` | Page.seo.title[locale] | High |
| `<meta description>` | Page.seo.description[locale] | High |
| `<link rel="canonical">` | Page.seo.canonical | High |
| `<meta robots>` | Page.seo.robots | Critical |
| `<h1>` | First block localeContent.title | High |
| OpenGraph | Page.seo.ogImage + title | Medium |
| Structured Data | Page.seo.structuredData | Medium |

### 23.3 Draft/Preview SEO

- Draft: `noindex, nofollow`
- Preview: `noindex, nofollow`
- Published: configurable (default: `index`)
- Archived: `noindex`

---

## 24. i18n

### 24.1 Locale Content Model

```typescript
interface LocaleContent {
  [locale: string]: {
    title: string | null;
    subtitle: string | null;
    description: string | null;
    cta: string | null;
    media: MediaReference[];
    items: ContentItem[];
  };
}
```

### 24.2 Fallback Strategy

```
Requested locale → Content[locale] → Content["ru"] → Block default → Empty
```

### 24.3 Validation

- All locale content validated against schema
- Missing translation indicated in admin UI (warning)
- Required locales enforced: at least `ru` must be present
- No mixed-language content (RU title + AZ subtitle) unless explicitly configured

---

## 25. Responsive

### 25.1 Breakpoints

| Name | Width | Columns |
|------|-------|---------|
| Desktop | ≥1024px | As configured |
| Tablet | 640-1023px | Reduced (grid-4 → grid-2) |
| Mobile | <640px | Single column |

### 25.2 Responsive Configuration Per Block

```typescript
interface ResponsiveConfig {
  desktop: { columns: number; spacing: string; visibility: boolean };
  tablet:  { columns: number; spacing: string; visibility: boolean };
  mobile:  { columns: number; spacing: string; visibility: boolean };
}
```

### 25.3禁止

- ❌ Arbitrary media queries
- ❌ Custom breakpoint values
- ❌ Raw responsive CSS

---

## 26. Performance

### 26.1 Caching Strategy

| Layer | TTL | Invalidation |
|-------|-----|-------------|
| Page config (DB) | — | On publish |
| Block registry | Server startup | On code deploy |
| Data source results | 60-300s | Configurable per source |
| Rendered HTML (CDN) | 60s | On publish |
| Client-side cache | Session | On navigation |

### 26.2 SSR / CSR Split

| Component | Rendering | Bundle |
|-----------|-----------|--------|
| Page shell | SSR | Main bundle |
| System blocks (header, footer) | SSR | Main bundle |
| Service blocks | SSR + hydrate | Lazy-loaded |
| Content blocks | SSR | Main bundle |
| Interactive blocks | CSR | Lazy-loaded |

### 26.3 Avoiding N+1

- Data source resolution: parallel per block (Promise.all)
- Block rendering: sequential for correct ordering
- Media: lazy loading (native `loading="lazy"`)
- Images: existing 3-derivative system (thumb/large/original)

### 26.4 Code Splitting

```typescript
// Dynamic import per block type
const blockComponents = {
  "hero": () => import("./blocks/Hero"),
  "hot-tours": () => import("./blocks/HotTours"),
  "search": () => import("./blocks/Search"),
  // ...
};
```

---

## 27. Testing

### 27.1 Unit Tests

| Area | What to Test |
|------|-------------|
| Block Registry | Schema validation, allowlist enforcement |
| Page Config | Section ordering, required blocks |
| Visibility Rules | Rule evaluation, safety (no code execution) |
| Data Source | Resolver correctness, caching |
| Permissions | RBAC enforcement, tenant isolation |
| Serializer | Config → JSON, JSON → Config |

### 27.2 Integration Tests

| Area | What to Test |
|------|-------------|
| Page CRUD | Create, read, update, delete pages |
| Section CRUD | Add, remove, reorder sections |
| Publish Flow | Draft → Publish → Public visible |
| Rollback | Publish → Rollback → Previous version visible |
| Tenant Isolation | Partner A ≠ Partner B |
| Template Apply | Template → Default sections |

### 27.3 E2E Tests

| Scenario | Steps |
|----------|-------|
| Admin creates Marketplace Home | Login → Constructor → Add blocks → Configure → Publish → Public sees page |
| Partner customizes Storefront | Login → Storefront Constructor → Add blocks → Publish → Public sees storefront |
| Cross-tenant blocked | Partner A tries to access Partner B's config → 403 |
| Draft not public | Create draft → Not visible at public URL |
| Rollback works | Publish v1 → Edit → Publish v2 → Rollback to v1 → v1 visible |

### 27.4 Security Tests

| Test | Expected |
|------|----------|
| Arbitrary JS in block settings | Rejected by validation |
| Raw HTML in locale content | Sanitized |
| Cross-tenant page access | 403 |
| Preview without auth | Redirect to login |
| Publish without permission | 403 |

---

## 28. Migration Strategy

### 28.1 Phase Sequence

```
Phase A: Architecture / Contracts
    ↓
Phase B: Block Registry (backend + frontend types)
    ↓
Phase C: Configuration Model (DB schema + API)
    ↓
Phase D: Renderer (PageRenderer component)
    ↓
Phase E: Admin Constructor (UI)
    ↓
Phase F: Draft / Preview / Publish
    ↓
Phase G: Marketplace Migration (current Home → config)
    ↓
Phase H: Partner Storefront Integration
```

### 28.2 Detailed Phase Description

#### Phase A — Architecture / Contracts (CURRENT)
- Define all interfaces and types
- Create architecture document (THIS DOCUMENT)
- No production code changes
- Validate with team

#### Phase B — Block Registry
- Create `BlockDefinition` interface
- Register existing blocks (hero, search, hot-tours, etc.)
- Create `BLOCK_REGISTRY` constant
- Backend validation service
- Frontend shared types

#### Phase C — Configuration Model
- Create Prisma schema (pages, page_sections, page_versions, page_audit_log)
- Create NestJS module (constructor module)
- Create CRUD API endpoints
- Create data source resolvers

#### Phase D — Renderer
- Create `PageRenderer` component
- Create block renderer wrappers
- Integrate with data source service
- SSR support

#### Phase E — Admin Constructor
- Create `/app/constructor` route
- Drag-and-drop block reordering (@dnd-kit)
- Block settings panel
- Data source configuration
- Theme selection
- Template application

#### Phase F — Draft / Preview / Publish
- Draft auto-save
- Preview route (`/preview/marketplace-home`)
- Publish/unpublish endpoints
- Rollback endpoint
- Version history list

#### Phase G — Marketplace Migration
- Create "marketplace-home" page config from current hardcoded layout
- Wrap existing components as block renderers
- A/B test: config-driven vs hardcoded
- Cutover when stable
- Keep hardcoded fallback for rollback

#### Phase H — Partner Storefront Integration
- Extend constructor for storefront context
- Partner-scoped block allowlist
- Partner-scoped data sources
- Partner permission checks
- Storefront-specific templates

### 28.3 Each Phase Preserves Current Functionality

```
Phase A-C: No visible changes (infrastructure only)
Phase D: Renderer available but not used
Phase E: Admin UI available, current Home still hardcoded
Phase F: Draft/Preview working, current Home still published
Phase G: Config-driven Home goes live (backward compatible)
Phase H: Storefront constructor available
```

**Critical rule:** At no point does the public website break.

---

## 29. MVP / Future

### 29.1 MVP (Phase A-G)

| Feature | Status |
|---------|--------|
| Block Registry | ✅ MVP |
| Page Configuration (DB) | ✅ MVP |
| Section CRUD | ✅ MVP |
| Reorder (drag & drop) | ✅ MVP |
| Enable/disable blocks | ✅ MVP |
| Block settings | ✅ MVP |
| Data source selection | ✅ MVP |
| Layouts | ✅ MVP |
| Theme (3 presets) | ✅ MVP |
| Typography controls | ✅ MVP |
| i18n (RU/AZ/EN) | ✅ MVP |
| Responsive | ✅ MVP |
| Draft | ✅ MVP |
| Preview | ✅ MVP |
| Publish | ✅ MVP |
| Rollback | ✅ MVP |
| RBAC | ✅ MVP |
| Tenant isolation | ✅ MVP |
| Audit log | ✅ MVP |
| Marketplace migration | ✅ MVP |

### 29.2 Future (Post-MVP)

| Feature | Phase |
|---------|-------|
| Scheduled publishing | Future |
| Auto-save | Future |
| Version diff viewer | Future |
| A/B testing | Future |
| Personalization | Future |
| Analytics-driven blocks | Future |
| Advanced conditional rules | Future |
| Visual focal-point editor | Future |
| Reusable block marketplace | Future |
| Multi-page templates | Future |
| Rich content editor (WYSIWYG) | Future |
| Custom CSS tokens (safe subset) | Future |
| More theme presets | Future |
| Storefront integration (Phase H) | Future |

---

## 30. Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| Performance degradation from dynamic rendering | High | Medium | SSR caching, block-level code splitting |
| Migration breaks current Home | High | Low | Keep hardcoded fallback, gradual cutover |
| Tenant isolation bypass | Critical | Low | Server-side enforcement, security testing |
| Arbitrary content injection | Critical | Low | Structured content only, validation, sanitization |
| Complexity creep | Medium | Medium | Strict MVP boundary, phase gating |
| Block registry becomes outdated | Low | Medium | Versioning, registry validation at startup |

---

## 31. Open Questions

| # | Question | Impact | Decision Needed |
|---|----------|--------|-----------------|
| 1 | Constructor namespace: `/app/constructor` or separate admin section? | Admin UX | Product decision |
| 2 | Auto-save frequency for drafts? | UX + DB load | Product + engineering |
| 3 | Should storefront partner have constructor access or just theme preset? | Feature scope | Product decision |
| 4 | How many theme presets for MVP? | Design scope | Design decision |
| 5 | Rich content: structured-content model or markdown? | Content flexibility | Engineering decision |
| 6 | Should system blocks (header/footer) be configurable via constructor? | Feature scope | Product decision |
| 7 | Database schema: new `constructor` schema or extend `catalog`? | Architecture | Engineering decision |
| 8 | CDN caching strategy for published pages? | Performance | Infrastructure decision |

---

## 32. Acceptance Criteria

| # | Criterion | Verified |
|---|-----------|----------|
| 1 | Как хранится page configuration? | ✅ `constructor.pages` + `constructor.page_sections` tables |
| 2 | Как хранится version? | ✅ `constructor.page_versions` table with JSON snapshot |
| 3 | Как определяется block? | ✅ `BlockDefinition` in `BLOCK_REGISTRY` (allowlist) |
| 4 | Как block получает data? | ✅ `DataSourceConfig` → resolver function → cached result |
| 5 | Как меняется порядок? | ✅ `sort_order` field, drag-and-drop reorder via API |
| 6 | Как block включается/выключается? | ✅ `enabled` boolean field |
| 7 | Как работают conditional visibility? | ✅ Declarative `VisibilityRule` schema, server-side evaluation |
| 8 | Как работает Draft? | ✅ Auto-saved sections with `status=draft`, not publicly visible |
| 9 | Как работает Preview? | ✅ `/preview` route, same renderer, `noindex` |
| 10 | Как работает Publish? | ✅ Snapshot → `page_versions` → `pages.current_version` update |
| 11 | Как работает Rollback? | ✅ Re-activate previous `page_versions` entry |
| 12 | Как обеспечивается tenant isolation? | ✅ `tenantId` field + server-side guard + `user.partnerId` from JWT |
| 13 | Как ограничиваются permissions? | ✅ `@RequirePermissions` + RBAC matrix extension |
| 14 | Как работает i18n? | ✅ `LocaleContent` per block, fallback to `ru` |
| 15 | Как работает responsive? | ✅ `ResponsiveConfig` per block, 3 breakpoints |
| 16 | Как работает Theme? | ✅ `DesignTokens` model, 3+ presets |
| 17 | Как настраивается typography? | ✅ Controlled token values (font, size, weight, etc.) |
| 18 | Как защищается от arbitrary CSS/JS/HTML? | ✅ Schema validation, sanitization, no raw input |
| 19 | Как используются существующие TravelHub components? | ✅ Block renderers = existing components wrapped |
| 20 | Как Home мигрирует без big-bang rewrite? | ✅ Gradual phases, hardcoded fallback preserved |
| 21 | Как Partner Storefront использует тот же engine? | ✅ Same renderer, different context/allowlist/data sources |
| 22 | Как исключается конфликт Marketplace и Storefront semantics? | ✅ Separate contexts, strict terminology, tenant boundary |
| 23 | Как добавляется новый block в будущем? | ✅ Define in registry + create renderer + register |
| 24 | Как добавляется новый service block? | ✅ Same as #23 + data source adapter |
| 25 | Как Constructor взаимодействует с Advertisement? | ✅ Advertisement block type registered, static data source |
| 26 | Как Constructor управляет Flights visibility? | ✅ Block `enabled` flag + `VisibilityRule` |
| 27 | Как Preview отличается от Published? | ✅ Same renderer, `noindex`, auth-gated |
| 28 | Как audit trail хранит изменения? | ✅ `page_audit_log` with before/after snapshots |
| 29 | Как тестируется security? | ✅ Unit + integration + E2E security test plan |
| 30 | Как происходит rollback? | ✅ `POST /pages/:id/rollback` → re-activate previous version |

---

## Appendix A: Configuration JSON Example

```json
{
  "page": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "marketplace-home",
    "context": "marketplace",
    "tenantId": null,
    "status": "PUBLISHED",
    "currentVersion": 12,
    "themeId": "marketplace-dark-gold",
    "templateId": "marketplace-premium",
    "seo": {
      "title": {
        "ru": "TravelHub — Туристический маркетплейс",
        "az": "TravelHub — Turizm marketpleysi",
        "en": "TravelHub — Travel Marketplace"
      },
      "description": {
        "ru": "Найдите лучшие туры, отели и авиабилеты в Азербайджане",
        "az": "Azərbaycanda ən yaxşı turlar, otellər və aviabiletləri tapın",
        "en": "Find the best tours, hotels and flights in Azerbaijan"
      },
      "canonical": "https://travelhub.az",
      "robots": "index",
      "ogImage": null
    }
  },
  "sections": [
    {
      "id": "sec-hero-1",
      "blockType": "hero",
      "blockInstanceId": "hero-main",
      "sortOrder": 0,
      "enabled": true,
      "settings": {
        "autoplay": true,
        "interval": 7000,
        "showIndicators": true,
        "showArrows": true
      },
      "style": {
        "backgroundColor": null,
        "textColor": null,
        "borderColor": null,
        "borderRadius": null,
        "padding": null,
        "margin": null,
        "customTokens": {}
      },
      "responsive": {
        "desktop": { "columns": null, "spacing": null, "typographyScale": null, "visibility": true, "imageAspectRatio": "16/9" },
        "tablet": { "columns": null, "spacing": null, "typographyScale": null, "visibility": true, "imageAspectRatio": "16/9" },
        "mobile": { "columns": null, "spacing": null, "typographyScale": null, "visibility": true, "imageAspectRatio": "16/9" }
      },
      "dataSource": {
        "type": "static-config",
        "params": { "slides": ["hero1", "hero2", "hero3"] },
        "cacheTtl": 86400
      },
      "visibility": null,
      "localeContent": {
        "ru": { "title": "Исследуйте", "subtitle": "Азербайджан", "description": null, "cta": null, "media": [], "items": [] },
        "az": { "title": "Kəşf edin", "subtitle": "Azərbaycan", "description": null, "cta": null, "media": [], "items": [] },
        "en": { "title": "Discover", "subtitle": "Azerbaijan", "description": null, "cta": null, "media": [], "items": [] }
      }
    },
    {
      "id": "sec-search-1",
      "blockType": "search",
      "blockInstanceId": "search-main",
      "sortOrder": 1,
      "enabled": true,
      "settings": { "tabs": ["accommodation", "tours", "excursions", "transfers", "car-rental", "cruise", "railway", "sanatorium", "guide", "flight"] },
      "style": { "backgroundColor": null, "textColor": null, "borderColor": null, "borderRadius": null, "padding": null, "margin": null, "customTokens": {} },
      "responsive": {
        "desktop": { "columns": null, "spacing": null, "typographyScale": null, "visibility": true, "imageAspectRatio": null },
        "tablet": { "columns": null, "spacing": null, "typographyScale": null, "visibility": true, "imageAspectRatio": null },
        "mobile": { "columns": null, "spacing": null, "typographyScale": null, "visibility": true, "imageAspectRatio": null }
      },
      "dataSource": { "type": "static-config", "params": {}, "cacheTtl": 86400 },
      "visibility": null,
      "localeContent": {}
    },
    {
      "id": "sec-hot-tours-1",
      "blockType": "hot-tours",
      "blockInstanceId": "hot-tours-main",
      "sortOrder": 2,
      "enabled": true,
      "settings": { "pageSize": 6 },
      "style": { "backgroundColor": null, "textColor": null, "borderColor": null, "borderRadius": null, "padding": null, "margin": null, "customTokens": {} },
      "responsive": {
        "desktop": { "columns": 4, "spacing": "4", "typographyScale": null, "visibility": true, "imageAspectRatio": "4/3" },
        "tablet": { "columns": 3, "spacing": "4", "typographyScale": null, "visibility": true, "imageAspectRatio": "4/3" },
        "mobile": { "columns": 1, "spacing": "4", "typographyScale": null, "visibility": true, "imageAspectRatio": "4/3" }
      },
      "dataSource": {
        "type": "product-feed",
        "params": { "productType": "TOUR", "sort": "newest", "pageSize": 6 },
        "cacheTtl": 60
      },
      "visibility": { "operator": "GT", "field": "products.count", "value": 0 },
      "localeContent": {
        "ru": { "title": "Горящие туры", "subtitle": "Лучшие предложения прямо сейчас", "description": null, "cta": "Смотреть все", "media": [], "items": [] },
        "az": { "title": "Günəş turları", "subtitle": "Ən yaxşı təkliflər indi", "description": null, "cta": "Hamısına bax", "media": [], "items": [] },
        "en": { "title": "Hot Tours", "subtitle": "Best offers right now", "description": null, "cta": "View all", "media": [], "items": [] }
      }
    },
    {
      "id": "sec-flights-1",
      "blockType": "flights",
      "blockInstanceId": "flights-main",
      "sortOrder": 3,
      "enabled": false,
      "settings": { "pageSize": 6 },
      "style": { "backgroundColor": null, "textColor": null, "borderColor": null, "borderRadius": null, "padding": null, "margin": null, "customTokens": {} },
      "responsive": {
        "desktop": { "columns": 4, "spacing": "4", "typographyScale": null, "visibility": true, "imageAspectRatio": "4/3" },
        "tablet": { "columns": 3, "spacing": "4", "typographyScale": null, "visibility": true, "imageAspectRatio": "4/3" },
        "mobile": { "columns": 1, "spacing": "4", "typographyScale": null, "visibility": true, "imageAspectRatio": "4/3" }
      },
      "dataSource": {
        "type": "product-feed",
        "params": { "productType": "FLIGHT", "sort": "newest", "pageSize": 6 },
        "cacheTtl": 60
      },
      "visibility": { "operator": "GT", "field": "products.count", "value": 0 },
      "localeContent": {
        "ru": { "title": "Авиабилеты", "subtitle": "Поиск авиабилетов", "description": null, "cta": "Помочь найти", "media": [], "items": [] },
        "az": { "title": "Aviabiletlər", "subtitle": "Aviabilet axtarışı", "description": null, "cta": "Tapmağa kömək et", "media": [], "items": [] },
        "en": { "title": "Flights", "subtitle": "Flight search", "description": null, "cta": "Help find", "media": [], "items": [] }
      }
    }
  ]
}
```

---

## Appendix B: Git Closure

| Параметр | Значение |
|----------|----------|
| Repository | `https://github.com/seldom733-hash/travelhub1` |
| Branch | `master` |
| HEAD | `b6e22a05ba6e678c37ae99d99b608060a27e1790` |
| Remote HEAD | `b6e22a05ba6e678c37ae99d99b608060a27e1790` |
| Production code changes | **НЕТ** |
| Architecture document | `/docs/architecture/TRAVELHUB_PAGE_BUILDER_CONSTRUCTOR_ARCHITECTURE.md` |

---

**VERDICT: ARCHITECTURE SPECIFICATION COMPLETE**
