# TRAVELHUB GLOBAL BRANDING — SINGLE SOURCE OF TRUTH

**Дата:** 2026-09-13  
**Статус:** ✅ ВЫПОЛНЕНО  
**Коммит:** (-stage)

---

## Цель

Hero/Branding является единственной UI-точкой изменения platform company name. Все потребители (Marketplace Header, Marketplace Footer, Workspace Shell, Partner Cabinet, Buyer Account, breadcrumbs) должны использовать единственный источник истины — `headerConfig.brandName` из опубликованного конфига конструктора.

## Результат

| Потребитель | До | После | Источник |
|-------------|-----|-------|----------|
| Marketplace Header | `headerConfig.brandName` ✅ | `headerConfig.brandName` ✅ | Уже было корректно |
| Marketplace Footer | Собственное `name: {ru,az,en}` ❌ | `headerConfig.brandName` ✅ | Наследует из Header |
| Workspace Sidebar | Хардкод `"TravelHub"` ❌ | `useGlobalBranding()` ✅ | Published config |
| Partner Cabinet Header | Хардкод `"TravelHub"` ❌ | `useGlobalBranding()` ✅ | Published config |
| Partner Cabinet Footer | Хардкод `"TravelHub"` ❌ | `useGlobalBranding()` ✅ | Published config |
| Buyer Account Header | Хардкод `"TravelHub"` ❌ | `useGlobalBranding()` ✅ | Published config |
| Buyer Account Footer | Хардкод `"TravelHub"` ❌ | `useGlobalBranding()` ✅ | Published config |
| Workspace Breadcrumbs (15+ страниц) | Хардкод `"TravelHub"` ❌ | `PageHeader` + `useGlobalBranding()` ✅ | Published config |
| Constructor Footer Tab | Отдельный редактор имени ❌ | Read-only наследуемое значение ✅ | Из Header tab |

## Изменённые файлы

### Новые файлы
- `frontend/lib/use-global-branding.ts` — React-хук + async-хелпер для получения глобального брендинга

### Изменённые файлы

| Файл | Изменение |
|------|-----------|
| `frontend/components/marketplace/MarketplaceFooter.tsx` | Принимает проп `brandName`, наследует из `headerConfig.brandName` вместо собственного `name` |
| `frontend/components/marketplace/MarketplaceRenderer.tsx` | Извлекает `canonicalBrandName` из `headerConfig` через `resolveBrandName()`, передаёт в Footer |
| `frontend/components/constructor/ConstructorFooterTab.tsx` | Убран редактор имени бренда; показывает read-only значение из Header tab |
| `frontend/components/constructor/ConstructorCanvas.tsx` | Передаёт `headerConfig` в `ConstructorFooterTab` |
| `frontend/components/Shell.tsx` | Sidebar использует `useGlobalBranding()` вместо хардкода |
| `frontend/app/partner/layout.tsx` | Header + Footer используют `useGlobalBranding()` |
| `frontend/app/account/layout.tsx` | Header + Footer используют `useGlobalBranding()` |
| `frontend/components/PageHeader.tsx` | Автоматически заменяет хардкод `"TravelHub"` в breadcrumbs на динамическое имя |

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│  CONSTRUCTOR (единая UI-точка изменения)                     │
│                                                             │
│  Header Tab → brandName: "Navitravel"  ← ЕДИНСТВЕННЫЙ ИСТОЧНИК│
│  Logo Tab   → logo: { url, ... }       ← ЕДИНСТВЕННЫЙ ИСТОЧНИК│
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         saveHeaderConfig() → Prisma → ConstructorPage.headerConfig
                       │
                       ▼
         publish() → ConstructorPageVersion.snapshot
                       │
                       ▼
         GET /constructor/pages/marketplace-home/published (@Public)
                       │
        ┌──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
  Marketplace    Marketplace    useGlobalBranding()  PageHeader
  Header         Footer         (Shell, Partner,    (breadcrumbs)
  (resolveBrand  (brandName     Account layouts)
   Name)         prop)
```

## Как работает

1. **Единая точка изменения:** Администратор меняет `brandName` в Header Tab конструктора
2. **Публикация:** При публикации конфиг сохраняется в `ConstructorPageVersion.snapshot`
3. **Потребление:**
   - Marketplace Header читает `headerConfig.brandName` через `resolveBrandName()`
   - Marketplace Footer наследует `brandName` из Header (проп)
   - Workspace Shell, Partner Cabinet, Buyer Account используют `useGlobalBranding()` хук
   - Breadcrumbs автоматически заменяют `"TravelHub"` в `PageHeader`

## Проверка (Playwright)

| Страница | Результат |
|----------|-----------|
| Marketplace Home Header | ✅ "Navitravel" |
| Marketplace Home Footer | ✅ "Navitravel" |
| Workspace Sidebar | ✅ "Navitravel" |
| Users Page Breadcrumbs | ✅ "Navitravel / Пользователи" |
| TypeScript compile (frontend) | ✅ Clean |
| TypeScript compile (backend) | ✅ Clean |

## Что НЕ изменено (по design)

- **Partner Storefront `businessName`** — отдельный домен (имя магазина партнёра)
- **i18n строки** с упоминанием "TravelHub" как названия продукта — это контент, не брендинг
- **SEO metadata** (`layout.tsx`, store pages) — отдельная задача
- **Hero CTA копия** в `DEFAULT_HERO_SLIDES` — содержит "TravelHub" как название продукта

## Следующие шаги

1. SEO metadata — динамические title/description из published config
2. Hero CTA копия — замена "TravelHub" на dynamic brand name в слайдах
3. i18n строки — параметризация через interpolation для.brand name
