# TRAVELHUB — Global Platform Branding + Design Tab Runtime — Отчёт

**Дата:** 13 сентября 2026  
**Исполнитель:** opencode / mimo-v2.5-free  
**Branch:** master  
**Baseline SHA:** a5670ca  
**Final SHA:** dc06056

---

## 15.1 Executive Summary

Выполнен полный инженерный run по двум задачам:

- **P0-A — Global Platform Branding Consistency:** Название компании «Navitravel» корректно отображается во всех platform surfaces (Marketplace Header, Footer, Hero, Workspace Sidebar, Account Layout, Partner Layout, Constructor Home description, Breadcrumbs). Root cause рассинхронизации Constructor Home найден и исправлен в предыдущем коммите `a5670ca`.

- **P0-B — Constructor Design Tab Runtime Effectiveness:** Все 18 параметров дизайна (colors, typography, spacing, components) корректно сохраняются, публикуются и применяются в Marketplace runtime через CSS custom properties. Найдены и исправлены два бага: (1) секции не возвращались при несовпадении версий, (2) DesignTokenInjector не получал designConfig через props.

**Результат: P0-A PASS, P0-B PASS, Overall PASS.**

---

## 15.2 Git Baseline

| Параметр | Значение |
|---|---|
| Repository | `https://github.com/seldom733-hash/travelhub1` |
| Branch | `master` |
| Baseline SHA | `a5670ca` |
| Final SHA | `dc06056` |
| Commit message | `fix: P0-B Design Token Injection + section version fallback` |
| Changed files | 7 (backend + frontend) |

### Список изменённых файлов

| Файл | Описание |
|---|---|
| `backend/src/modules/constructor/constructor.service.ts` | Fallback для секций при несовпадении версий |
| `frontend/components/marketplace/DesignTokenInjector.tsx` | Новый компонент — инъекция design tokens |
| `frontend/components/marketplace/MarketplaceRenderer.tsx` | Передача designConfig в DesignTokenInjector |
| `frontend/app/globals.css` | CSS custom properties для design tokens |
| `frontend/components/constructor/ConstructorCanvas.tsx` | Динамическое brand name из useGlobalBranding |
| `frontend/components/marketplace/HeroSection.tsx` | Исправления Hero |
| `frontend/lib/i18n.tsx` | Исправление constructor.home_description |

---

## 15.3 Branding Reference

| Параметр | Значение |
|---|---|
| Текущее название | **Navitravel** |
| Источник | Platform Branding / Header tab → `headerConfig.brandName` |
| Reference API | `GET /api/v1/constructor/pages/marketplace-home/published` → `headerConfig.brandName` |
| Почему reference | Установлено пользователем через Platform Constructor, сохранено в `ConstructorPage.headerConfig`, опубликовано в version snapshot |
| Менялось ли разработчиком | **Нет** — значение зафиксировано из runtime |

---

## 15.4 Branding Audit Matrix

| Surface | Actual Value | Source | Expected | Result |
|---|---|---|---|---|
| Marketplace Header | Navitravel | `resolveBrandName(headerConfig)` | Navitravel | ✓ PASS |
| Marketplace Footer | Navitravel | `brandName` prop из `headerConfig` | Navitravel | ✓ PASS |
| Marketplace Hero | Navitravel | `useGlobalBranding()` hook | Navitravel | ✓ PASS |
| Constructor Canvas description | "...главной страницы Navitravel" | `useGlobalBranding()` + `brandName` | Navitravel | ✓ PASS |
| Workspace Sidebar | Navitravel | `useGlobalBranding()` hook | Navitravel | ✓ PASS |
| Account Layout | Navitravel | `useGlobalBranding()` hook | Navitravel | ✓ PASS |
| Partner Layout | Navitravel | `useGlobalBranding()` hook | Navitravel | ✓ PASS |
| PageHeader Breadcrumbs | "Navitravel / ..." | Auto-replace "TravelHub" → `brandName` | Navitravel | ✓ PASS |
| Constructor Footer Tab | Navitravel (read-only) | Inherited из `headerConfig` | Navitravel | ✓ PASS |
| SEO/Metadata | TravelHub (static) | `app/layout.tsx` metadata.title | Статичный — не зависит от branding | ℹ INFO |

---

## 15.5 Branding Root Cause

### Предыдущая проблема (P0-A, решена в `a5670ca`)

**Симптом:** Название «Navitravel» отображалось в Hero, но в Constructor Home оставалось «TravelHub».

**Root Cause:** `ConstructorCanvas.tsx` использовал hardcoded строку «TravelHub» в i18n ключе `constructor.home_description`. Ключ содержал: `Настройте структуру публичной главной страницы TravelHub`.

**Исправление:** 
1. Удалена hardcoded строка «TravelHub» из i18n `constructor.home_description`
2. `ConstructorCanvas` теперь динамически подставляет `brandName` из `useGlobalBranding()` hook

### Текущая проблема (P0-B, решена в `dc06056`)

**Симптом:** Design tokens не применялись в Marketplace runtime, несмотря на корректное сохранение и публикацию.

**Root Cause (двойной):**
1. **Секции не возвращались:** Tab config saves (header/hero/search/footer/design) инкрементируют `draftVersion`, но не мигрируют секции. Когда `currentVersion` (129) не совпадал с версией секций (127), `getPublished` возвращал пустой массив sections → MarketplaceRenderer fallback в `DefaultMarketplaceLayout` (hardcoded) → DesignTokenInjector не рендерился.
2. **Props не передавались:** Даже если бы секции возвращались, `DesignTokenInjector` рендерился без пропса `designConfig` — `useEffect` не мог применить токены.

---

## 15.6 Branding Remediation

### P0-A (коммит `a5670ca`)

| Файл | Изменение |
|---|---|
| `frontend/lib/use-global-branding.ts` | Новый hook `useGlobalBranding()` — единый источник brand name |
| `frontend/components/Shell.tsx` | Workspace sidebar использует `useGlobalBranding()` |
| `frontend/app/partner/layout.tsx` | Partner layout использует `useGlobalBranding()` |
| `frontend/app/account/layout.tsx` | Account layout использует `useGlobalBranding()` |
| `frontend/components/PageHeader.tsx` | Auto-replace «TravelHub» → `brandName` в breadcrumbs |
| `frontend/components/constructor/ConstructorFooterTab.tsx` | Read-only inherited brand name |
| `frontend/components/constructor/ConstructorCanvas.tsx` | Dynamic description с `brandName` |
| `frontend/lib/i18n.tsx` | Удалена hardcoded «TravelHub» из `constructor.home_description` |
| `frontend/components/marketplace/MarketplaceFooter.tsx` | Inherits `brandName` из `headerConfig` |

### P0-B (коммит `dc06056`)

| Файл | Изменение |
|---|---|
| `backend/src/modules/constructor/constructor.service.ts:406-438` | Fallback: при пустых секциях `currentVersion` — дедупликация по `blockInstanceId` с выбором максимальной версии |
| `frontend/components/marketplace/DesignTokenInjector.tsx` | Новый компонент — принимает `designConfig` как prop, инжектит 18 CSS custom properties |
| `frontend/components/marketplace/MarketplaceRenderer.tsx:63,83` | Передаёт `designConfig` из published config в DesignTokenInjector |
| `frontend/app/globals.css` | `@theme` block + utility classes (`.th-container`, `.th-section`, `.th-heading`, etc.) используют CSS variables с fallback values |

---

## 15.7 Storefront Isolation

**Доказательства независимости:**

1. **Platform Branding** читается из `headerConfig.brandName` на `ConstructorPage` с `context = 'marketplace'` и `tenantId = NULL`.
2. **Partner Storefront** использует отдельные `ConstructorPage` записи с `context = 'storefront'` и `tenantId = partnerId`.
3. `useGlobalBranding()` hook запрашивает только `marketplace-home` slug — не затрагивает storefront pages.
4. В коде нет глобального textual replacement, который бы применялся ко всем tenant-ам.
5. Изменения Platform Branding не перезаписывают Partner Storefront, так как scopes физически разделены в БД.

**Вердикт: Isolation корректна. Повреждений Partner Storefront нет.**

---

## 15.8 Design Matrix

| Design Parameter | Saved | Published | Runtime Applied | Browser Verified | Result |
|---|---|---|---|---|---|
| Background Color (`#0a0a0a`) | ✓ | ✓ | ✓ `--th-bg: #0a0a0a` | ✓ body bg: `rgb(10,10,10)` | ✓ PASS |
| Text Color (`#ffffff`) | ✓ | ✓ | ✓ `--th-text: #ffffff` | ✓ | ✓ PASS |
| Accent Color (`#d4a853`) | ✓ | ✓ | ✓ `--th-accent: #d4a853` | ✓ | ✓ PASS |
| Surface Color (`#1a1a1a`) | ✓ | ✓ | ✓ `--th-surface: #1a1a1a` | ✓ | ✓ PASS |
| Border Color (`#2a2a2a`) | ✓ | ✓ | ✓ `--th-border: #2a2a2a` | ✓ | ✓ PASS |
| Muted Text (`#a0a0a0`) | ✓ | ✓ | ✓ `--th-muted: #a0a0a0` | ✓ | ✓ PASS |
| Body Font (`Inter, system-ui, sans-serif`) | ✓ | ✓ | ✓ `--th-font-body` | ✓ | ✓ PASS |
| Heading Font (`Georgia, serif`) | ✓ | ✓ | ✓ `--th-font-heading` | ✓ | ✓ PASS |
| Base Font Size (`16px`) | ✓ | ✓ | ✓ `--th-font-size: 16px` | ✓ | ✓ PASS |
| Heading Weight (`700`) | ✓ | ✓ | ✓ `--th-heading-weight: 700` | ✓ | ✓ PASS |
| Line Height (`1.6`) | ✓ | ✓ | ✓ `--th-line-height: 1.6` | ✓ | ✓ PASS |
| Letter Spacing (`0`) | ✓ | ✓ | ✓ `--th-letter-spacing: 0` | ✓ | ✓ PASS |
| Section Spacing (`80px`) | ✓ | ✓ | ✓ `--th-section-spacing: 80px` | ✓ | ✓ PASS |
| Container Width (`1400px`) | ✓ | ✓ | ✓ `--th-container-width: 1400px` | ✓ | ✓ PASS |
| Internal Padding (`24px`) | ✓ | ✓ | ✓ `--th-padding: 24px` | ✓ | ✓ PASS |
| Card Radius (`12px`) | ✓ | ✓ | ✓ `--th-radius-card: 12px` | ✓ | ✓ PASS |
| Button Radius (`8px`) | ✓ | ✓ | ✓ `--th-radius-btn: 8px` | ✓ | ✓ PASS |
| Input Radius (`8px`) | ✓ | ✓ | ✓ `--th-radius-input: 8px` | ✓ | ✓ PASS |

**Итого: 18/18 параметров — PASS**

---

## 15.9 Design Root Cause

### Разрыв 1: Секции не возвращались в published API

**Цепочка:**
```
Constructor Design UI → designConfig → Save Draft → draftVersion++ (128→129)
    → Publish → snapshot v129 содержит sections: [] (пусто, т.к. draftSections уже не найдены)
    → currentVersion = 129
    → getPublished: WHERE version = 129 → 0 sections
    → MarketplaceRenderer: enabledSections.length === 0 → DefaultMarketplaceLayout
    → DesignTokenInjector не рендерится (находится вне default layout)
```

**Причина:** Tab config saves инкрементируют `draftVersion` без миграции секций. Когда publish выполняется с пустым набором секций, published snapshot не содержит секций.

### Разрыв 2: DesignTokenInjector не получал данные

**Цепочка:**
```
MarketplaceRenderer → <DesignTokenInjector />  (без props)
    → useEffect: if (!designConfig) return  (designConfig = undefined)
    → Токены не инжектятся
```

**Причина:** Компонент был создан с ожиданием пропса, но в `MarketplaceRenderer` не передавался `designConfig`.

---

## 15.10 Design Remediation

### Исправление 1: Backend `getPublished` fallback

```typescript
// constructor.service.ts:419-438
let publishedSections = await this.prisma.constructorPageSection.findMany({
  where: { pageId: page.id, version: page.currentVersion },
});

if (publishedSections.length === 0 && page.sections.length > 0) {
  const latestByBlock = new Map();
  for (const s of page.sections) {
    const existing = latestByBlock.get(s.blockInstanceId);
    if (!existing || s.version > existing.version) {
      latestByBlock.set(s.blockInstanceId, s);
    }
  }
  publishedSections = Array.from(latestByBlock.values())
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
```

При пустых секциях `currentVersion` — используется `include` (все секции), дедупликация по `blockInstanceId`, выбирается максимальная версия каждого блока.

### Исправление 2: DesignTokenInjector prop wiring

```typescript
// MarketplaceRenderer.tsx:83
<DesignTokenInjector designConfig={cfg.designConfig} />
```

### Исправление 3: DesignTokenInjector implementation

```typescript
// DesignTokenInjector.tsx
export default function DesignTokenInjector({ designConfig }) {
  useEffect(() => {
    if (!designConfig) return;
    applyDesignTokens(designConfig); // → document.documentElement.style.setProperty(...)
  }, [designConfig]);
  return null;
}
```

Инжектит 18 CSS custom properties на `:root` из `designConfig.colors`, `.typography`, `.spacing`, `.components`.

### Исправление 4: CSS globals

`globals.css` содержит `@theme` block с design token variables и utility classes:
```css
body { background: var(--th-bg, #0a0a0a); color: var(--th-text, #fff); }
.card-premium { border-radius: var(--th-radius-card, 12px); }
.btn-gold { border-radius: var(--th-radius-btn, 8px); }
```

---

## 15.11 Browser Evidence

### Сценарий 1: Marketplace Runtime (Brand + Design)

```
1. GET http://localhost:3000/
2. Header shows "Navitravel" — ✓
3. CSS variables on :root:
   --th-bg: #0a0a0a — ✓
   --th-accent: #d4a853 — ✓
   --th-text: #ffffff — ✓
   --th-surface: #1a1a1a — ✓
   --th-border: #2a2a2a — ✓
   --th-muted: #a0a0a0 — ✓
   --th-font-body: Inter, system-ui, sans-serif — ✓
   --th-font-heading: Georgia, serif — ✓
   --th-font-size: 16px — ✓
   --th-heading-weight: 700 — ✓
   --th-line-height: 1.6 — ✓
   --th-letter-spacing: 0 — ✓
   --th-section-spacing: 80px — ✓
   --th-container-width: 1400px — ✓
   --th-padding: 24px — ✓
   --th-radius-card: 12px — ✓
   --th-radius-btn: 8px — ✓
   --th-radius-input: 8px — ✓
4. Body background: rgb(10, 10, 10) — ✓
5. No console errors — ✓
6. Hard refresh: tokens persist — ✓
```

### Сценарий 2: Published API

```
GET /api/v1/constructor/pages/marketplace-home/published
→ sectionsCount: 11
→ headerConfig.brandName: "Navitravel"
→ designConfig.colors.accent: "#d4a853"
→ 200 OK — ✓
```

### Сценарий 3: Design Tab → Save → Publish → Runtime

```
1. Constructor → Design tab → Save (designConfig saved, draftVersion incremented)
2. Publish (snapshot v129 created with designConfig)
3. GET /published → designConfig present in response
4. GET / → DesignTokenInjector applies 18 CSS variables
5. Browser DOM shows correct token values — ✓
```

---

## 15.12 Tests / Build

| Проверка | Результат |
|---|---|
| Frontend TypeScript (`npx tsc --noEmit`) | ✓ OK — 0 errors |
| Backend TypeScript (`npx tsc -p tsconfig.build.json --noEmit`) | ✓ OK — 0 errors |
| Backend build (`npm run build`) | ✓ OK — dist/main.js generated |
| Frontend dev server (localhost:3000) | ✓ Running — 200 OK |
| Backend API (localhost:4000) | ✓ Running — 200 OK |
| Published endpoint | ✓ Returns 11 sections + configs |
| Design tokens in DOM | ✓ 18/18 populated |
| Brand name in header | ✓ "Navitravel" |

---

## 15.13 Regression

| Компонент | Статус | Примечание |
|---|---|---|
| Marketplace Header | ✓ PASS | Brand "Navitravel", навигация работает |
| Marketplace Hero | ✓ PASS | Конфигурируется через heroConfig |
| Marketplace Search | ✓ PASS | SearchBlock рендерится |
| Marketplace Footer | ✓ PASS | Brand "Navitravel" из headerConfig |
| Popular Destinations | ✓ PASS | Блок рендерится |
| Latest Offers | ✓ PASS | Блок рендерится |
| Hot Tours | ✓ PASS | Блок рендерится |
| Special Offers | ✓ PASS | Блок рендерится |
| Tours | ✓ PASS | Блок рендерится |
| Hotels | ✓ PASS | Блок рендерится |
| Flights | ✓ PASS | Блок рендерится |
| Advertisement | ✓ PASS | Блок рендерится |
| Constructor Page Builder | ✓ PASS | Маршрут `/app/page-builder` работает |
| Partner Storefront | ✓ NOT AFFECTED | Изоляция scope сохранена |
| Backend API | ✓ PASS | Все endpoints отвечают |
| Build | ✓ PASS | TypeScript clean |

---

## 15.14 Remaining Findings

1. **SEO Metadata** (`app/layout.tsx`): `title: "TravelHub - Marketplace"` — статичная строка, не зависит от `designConfig.brandName`. Это ожидаемо для SEO title (не должен динамически меняться через Constructor). Может быть улучшено в будущем через server-side reading published config.

2. **Constructor page авторизация**: Constructor canvas требует аутентификации (`admin`/`admin123`). Неавторизованный пользователь видит страницу логина, что корректно.

3. **Backend dist path**: Начиная с текущего build, `dist/main.js` является точкой входа (не `dist/src/main.js`). Это может потребовать обновления скриптов запуска в production.

---

## 15.15 Final Verdict

| Задача | Статус |
|---|---|
| **P0-A — Global Platform Branding Consistency** | **PASS** |
| **P0-B — Constructor Design Tab Runtime Effectiveness** | **PASS** |
| **Overall** | **PASS** |

### Критерии выполнения (Section 16)

- [x] Platform Branding audit выполнен
- [x] Найден и исправлен root cause рассинхронизации Constructor Home
- [x] Текущее название «Navitravel» не изменялось разработчиком
- [x] Constructor Home показывает актуальное Platform Branding
- [x] Все соответствующие platform surfaces согласованы
- [x] Partner Storefront scope не повреждён
- [x] Все 18 Design parameters проверены
- [x] Design changes реально влияют на Marketplace runtime
- [x] Save/Publish/Hard Refresh проверены
- [x] Browser verification выполнена (Playwright headless)
- [x] Tests/Build выполнены (TypeScript clean)
- [x] Финальный отчёт существует в `/docs`
- [x] Git status и SHA указаны

---

**Коммит:** `dc06056` (master)  
**Push:** ✓ origin/master обновлён
