# TRAVELHUB Home / Витрина / Catalog Search Reconciliation Report

**Date:** 2026-09-14  
**Status:** ✅ COMPLETED  
**Branch:** `master`

---

## 1. Проблема

Маркетплейс Home содержал Search Block (поисковая форма) и Header имел отдельные entry `Направления` и `Предложения`, что нарушало canonical UX model:

- Home — prelude/landing, НЕ должен содержать полноценный Catalog Search/Filter
- `Направления` — НЕ отдельный Header entry (география часть фильтра Витрины)
- `Предложения` — НЕ отдельный Header entry (содержимое Витрины)
- `Витрина` — единственный пользовательский entry в Header

## 2. Решение

### 2.1. Home Search Block Removal

| Component | Change |
|---|---|
| `constructor.service.ts` | `"search"` добавлен в `DEPRECATED_BLOCK_TYPES` alongside `"popular-destinations"` |
| `MarketplaceRenderer.tsx` | SearchBlock удалён из `BLOCK_COMPONENTS` и `DefaultMarketplaceLayout` |
| API `/constructor/home/:locale` | Возвращает 9 секций без `search` (Service Layer фильтрация) |

### 2.2. Header Navigation Update

| Component | Change |
|---|---|
| `MarketplaceHeader.tsx` (desktop) | `Направления` + `Предложения` → single `Витрина` link to `/search` |
| `MarketplaceHeader.tsx` (mobile) | Same change in mobile hamburger menu |
| `lib/i18n.tsx` | Добавлен ключ `nav.storefront` (RU=Витрина, AZ=Vitrin, EN=Storefront) |

### 2.3. Architecture Documentation

Раздел 30 добавлен в `docs/architecture/MASTER_GEOGRAPHY_DIRECTORY.md` с полным описанием canonical UX model для Home / Витрина / Catalog Search reconciliation.

## 3. Что НЕ изменено

- `SearchBlock.tsx` — component сохранён (shared between Header autocomplete and future Catalog Search)
- `GlobalSearchAutocomplete.tsx` — preserved in Header
- `SearchBlock` backend saveDraft handlers — preserved for backward compatibility
- `ConstructorPageVersion` search blocks in DB — preserved (historical snapshots)
- Admin Shell `nav.catalog` key — preserved for admin navigation

## 4. Доказательства

- `docs/reports/evidence/reconcile-home.png` — Home page: Header показывает "Витрина", Search Block отсутствует
- `docs/reports/evidence/reconcile-constructor.png` — Constructor: 9 секций в Canvas и Content (was 11)

## 5. Результаты

| Metric | Before | After |
|---|---|---|
| Home sections (API) | 11 | 9 |
| Constructor Canvas | 11 sections | 9 sections |
| Constructor Content editors | 11 | 9 |
| Header user entries | Направления, Предложения, Услуги, Для партнёров | Витрина, Услуги, Для партнёров |
| Search Block active on Home | Yes | No |
| Global Search in Header | Yes | Yes |
| TypeScript compilation | OK | OK |

## 6. Commits

| Commit | Message |
|---|---|
| `TBD (code)` | `fix(marketplace): remove Search Block from Home, replace Направления/Предложения with Витрина in Header` |
| `TBD (docs)` | `docs: Home/Vitrina/Catalog Search reconciliation architecture + report` |
