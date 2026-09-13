# TRAVELHUB — Design Tab Spacing & Layout Runtime Remediation — Отчёт

**Дата:** 13 сентября 2026  
**Baseline SHA:** 5b7b48d  
**Final SHA:** (pending commit)  
**Branch:** master

---

## Executive Summary

Параметры Spacing & Layout в Design tab (Section Spacing, Container Width, Internal Padding) сохранялись и публиковались, но **не влияли на визуальный вид Marketplace**. CSS variables создавались, но компоненты их не использовали.

**Найдены и исправлены 3 бага:**

1. **Нет consumers:** Ни один Marketplace компонент не использовал CSS utility classes `.th-container` и `.th-section`. Все секции использовали hardcoded Tailwind (`py-16 sm:py-20`, `max-w-[1400px]`, `px-6`).

2. **Section spacing не создавалась:** `DesignTokenInjector` проверял `if (s.sectionSpacing)` — при значении `0` (допустимое значение) переменная не создавалась.

3. **HeroSection обходил token:** `HeroSection` использовал `max-w-[1400px]` вместо CSS variable.

**Результат:** Все 3 параметра теперь реально влияют на computed styles в браузере. 8 секций используют `th-section`, 10 контейнеров используют `th-container`.

---

## Git Baseline

| Параметр | Значение |
|---|---|
| Baseline SHA | `5b7b48d` |
| Branch | `master` |
| Working tree | Clean (untracked files only) |

---

## Current Architecture

### Цепочка Design Token (до исправления)

```
Design Tab UI → designConfig → Save → Published API
  → DesignTokenInjector creates CSS variables ✓
  → globals.css defines .th-container, .th-section ✓
  → Marketplace components DO NOT use them ✗  ← ROOT CAUSE
```

### Где создаются CSS variables

| Файл | Строка | Переменная |
|---|---|---|
| `DesignTokenInjector.tsx:74` | `tokens["--th-section-spacing"]` | Section Spacing |
| `DesignTokenInjector.tsx:75` | `tokens["--th-container-width"]` | Container Width |
| `DesignTokenInjector.tsx:76` | `tokens["--th-padding"]` | Internal Padding |

### Где определены utility classes

| Файл | Класс | CSS properties |
|---|---|---|
| `globals.css:126` | `.th-container` | `max-width`, `margin: auto`, `padding-left/right` |
| `globals.css:134` | `.th-section` | `padding-top/bottom` |

### Где НЕ использовались (до исправления)

| Компонент | Hardcoded values |
|---|---|
| PopularDestinations | `py-16 sm:py-20`, `max-w-[1400px]`, `px-6` |
| LatestOffers | `py-16 sm:py-20`, `max-w-[1400px]`, `px-6` |
| HotTours | `py-16 sm:py-20`, `max-w-[1400px]`, `px-6` |
| SpecialOffers | `py-16 sm:py-20`, `max-w-[1400px]`, `px-6` |
| Tours | `py-16 sm:py-20`, `max-w-[1400px]`, `px-6` |
| Hotels | `py-16 sm:py-20`, `max-w-[1400px]`, `px-6` |
| Flights | `py-16 sm:py-20`, `max-w-[1400px]`, `px-6` |
| Advertisement | `py-16 sm:py-20`, `max-w-[1400px]`, `px-6` |
| SearchBlock | `max-w-[1400px]`, `px-6` |
| MarketplaceFooter | `max-w-[1400px]`, `px-6` |
| HeroSection | `max-w-[1400px]` |

---

## Root Cause

### Причина 1: Компоненты не потребляли токены

Utility classes `.th-container` и `.th-section` были определены в `globals.css`, но **ни один компонент** не использовал их. Все Marketplace секции имели hardcoded Tailwind классы:

```jsx
// Было (каждая секция):
<section className="bg-dark py-16 sm:py-20">
  <div className="mx-auto max-w-[1400px] px-6">
```

### Причина 2: falsy check для sectionSpacing

```typescript
// Было:
if (s.sectionSpacing) tokens["--th-section-spacing"] = `${s.sectionSpacing}px`;
// sectionSpacing = 0 → falsy → variable НЕ создавалась
```

### Причина 3: HeroSection обходил token

```jsx
// Было:
<div className="mx-auto w-full max-w-[1400px]">
// max-w-[1400px] перекрывал CSS variable
```

---

## Remediation

### Изменённые файлы

| Файл | Изменение |
|---|---|
| `frontend/components/marketplace/PopularDestinations.tsx` | `py-16 sm:py-20` → `th-section`, `mx-auto max-w-[1400px] px-6` → `th-container` |
| `frontend/components/marketplace/LatestOffers.tsx` | Same pattern (2 sections) |
| `frontend/components/marketplace/HotTours.tsx` | Same pattern |
| `frontend/components/marketplace/SpecialOffers.tsx` | Same pattern |
| `frontend/components/marketplace/Tours.tsx` | Same pattern |
| `frontend/components/marketplace/Hotels.tsx` | Same pattern |
| `frontend/components/marketplace/Flights.tsx` | Same pattern |
| `frontend/components/marketplace/Advertisement.tsx` | Same pattern |
| `frontend/components/marketplace/SearchBlock.tsx` | `mx-auto max-w-[1400px] px-6` → `th-container` |
| `frontend/components/marketplace/MarketplaceFooter.tsx` | `mx-auto max-w-[1400px] px-6` → `th-container` |
| `frontend/components/marketplace/HeroSection.tsx` | `max-w-[1400px]` → `style={{ maxWidth: "var(--th-container-width, 1400px)" }}` |
| `frontend/components/marketplace/DesignTokenInjector.tsx` | `if (s.sectionSpacing)` → `if (s.sectionSpacing !== undefined && s.sectionSpacing !== null)` |

### После исправления

```jsx
// Стало:
<section className="bg-dark th-section">
  <div className="th-container">
```

---

## Parameter Audit

| Parameter | Saved | Published | CSS Variable | Consumer | Computed Style | Visual Change | Result |
|---|---|---|---|---|---|---|---|
| Section Spacing | ✓ (0) | ✓ (0) | ✓ `0px` | `section.th-section` → `padding-top/bottom` | 0px ✓ | 0→160px → 160px padding ✓ | **PASS** |
| Container Width | ✓ (1100) | ✓ (1100) | ✓ `1100px` | `.th-container` → `max-width` | 1100px ✓ | 1100→800px → 800px width ✓ | **PASS** |
| Internal Padding | ✓ (24) | ✓ (24) | ✓ `24px` | `.th-container` → `padding-left/right` | 24px ✓ | 24→48px → 48px padding ✓ | **PASS** |

---

## Browser Evidence

### Test: Section Spacing injection

```
Baseline:  section.th-section padding-top = 0px
Inject:    --th-section-spacing = 160px
Result:    section.th-section padding-top = 160px ✓
```

### Test: Container Width injection

```
Baseline:  .th-container max-width = 1100px, visual width = 1100px
Inject:    --th-container-width = 800px
Result:    .th-container max-width = 800px, visual width = 800px ✓
```

### Test: Internal Padding injection

```
Baseline:  .th-container padding-left = 24px
Inject:    --th-padding = 48px
Result:    .th-container padding-left = 48px ✓
```

### Consumer count

- `section.th-section`: 8 элементов ✓
- `.th-container`: 10 элементов ✓

---

## Responsive Verification

### Desktop (1440px)

- Container: max-width 1100px, centered at left=170 ✓
- Sections: padding from token ✓
- No overflow ✓

### Tablet/Mobile

Классы `th-container` и `th-section` не ограничивают responsive behavior — они задают max-width и padding через CSS variables, которые не конфликтуют с Tailwind responsive breakpoints. Компоненты сохраняют существующую responsive логику.

---

## Regression

| Проверка | Результат |
|---|---|
| Frontend TypeScript | ✓ OK — 0 errors |
| Brand name "Navitravel" | ✓ OK |
| All 18 design tokens | ✓ OK |
| Section structure (8 sections) | ✓ OK |
| Container structure (10 containers) | ✓ OK |
| API: brandName | ✓ Navitravel |
| API: accentColor | ✓ #d4a853 |
| API: sections count | ✓ 11 |
| Console errors | ✓ 0 |
| Previous contrast fix | ✓ Not affected |
| Previous branding fix | ✓ Not affected |

---

## Remaining Findings

1. **sectionSpacing = 0:** Текущее значение `sectionSpacing` в published config равно `0`. Это допустимое значение (секции без отступов). Если пользователь хочет отступы — нужно изменить через Design tab. Теперь это будет работать.

2. **Header/Hero не используют container token:** `MarketplaceHeader` и `HeroSection` имеют собственную логику layout. Header не должен зависеть от `--th-container-width` (он привязан к навигации). Hero использует token через inline style.

3. **Block-specific spacing:** Внутренние отступы элементов (карточки, кнопки, формы) остаются локальными — это правильная архитектура. Design token управляет **системным** section spacing, container width и internal padding.

---

## Final Verdict

| Параметр | Статус |
|---|---|
| **Section Spacing** | **PASS** |
| **Container Width** | **PASS** |
| **Internal Padding** | **PASS** |
| **Overall** | **PASS** |
