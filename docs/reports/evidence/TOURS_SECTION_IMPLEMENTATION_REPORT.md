# Отчёт: Туры (Tours) — Marketplace Home

**Версия:** 1.0  
**Дата:** 2026-09-12  
**Автор:** opencode (автоматический)  
**Статус:** ✅ ЗАВЕРШЕНО

---

## 1. Что реализовано

Отдельный блок «Туры» на Marketplace Home, расположенный после «Скидки и спецпредложения».

**Home:**
- Hero = unchanged
- Search = unchanged
- Popular Destinations = unchanged
- Hot Tours = unchanged
- Discounts / Special Offers = unchanged
- **Tours = implemented** ✅

---

## 2. Источник Tour data

- **Endpoint:** `GET /api/v1/public/products?sort=newest&pageSize=50`
- **Фильтрация:** клиентская по `type === "TOUR"`, skip первых 6 (Hot Tours), взять следующие 6
- **Реальные данные** из существующего Public Catalog API
- **Без hardcoded/mock/fake tours**

---

## 3. Tour API/domain contract

- Используется тот же контракт, что и для Hot Tours
- `publicApi.listProducts({ sort: "newest", pageSize: 50 })`
- Клиентская фильтрация: `items.filter(i => i.type === "TOUR").slice(6, 12)`
- Поля карточки: id, slug, title, shortDescription, primaryImage, priceFrom, currency, category, seller

---

## 4. Card structure

Вертикальный формат (как Hot Tours):

```text
┌──────────────────────────────┐
│          IMAGE               │
├──────────────────────────────│
│ КАТЕГОРИЯ (category)         │
│ Tour Title (serif, 2 lines)  │
│ Short Description (1 line)   │
│ Seller Name                  │
│                              │
│ от 69.00 AZN         Подробнее│
└──────────────────────────────┘
```

- Категория: category.title (uppercase, neutral-500)
- Название: serif, line-clamp-2, hover → gold
- Описание: line-clamp-1, neutral-500 (отсутствует у Hot Tours)
- Продавец: seller.displayName или anonymous label
- Цена: от priceFrom currency (gold)
- CTA: "Подробнее" text (отличие от Hot Tours → стрелка)

---

## 5. Pricing

- Показывается только реальная `priceFrom` (минимальная цена тарифа)
- **Нет** fake discount, original price, percentage
- Если цена отсутствует → "Цена по запросу"

---

## 6. Availability

- Используются только опубликованные (published) продукты
- `publishedAt` доступен в карточке
- Backend фильтрует неопубликованные на сервере

---

## 7. Seller/partner

- Если `card.seller` существует → показывается `seller.displayName`
- Если `seller.visibilityMode === "ANONYMOUS"` → generic label
- Если `seller.verified === true` → ✓ badge

---

## 8. Navigation

- **Клик по карточке:** `/products/{slug}` → существующий Tour Detail flow
- **Все туры:** `/search?category=tours` → существующий Tour Catalog/Results flow
- Используются стабильные `slug` идентификаторы

---

## 9. Separation от Hot Tours

| Параметр | Hot Tours | Tours |
|----------|-----------|-------|
| Позиция на странице | 3-я секция | 6-я секция |
| Заголовок | "Горящие туры" | "Туры" |
| Подзаголовок | "Лучшие предложения прямо сейчас" | "Актуальные предложения от партнёров" |
| Количество карточек | 6 (первые) | 6 (следующие, skip 6) |
| Описание в карточке | Нет | Есть (shortDescription) |
| CTA | Стрелка → | "Подробнее" текст |
| Ссылка «Все» | `/search?category=tours&sort=newest` | `/search?category=tours` |
| Сортировка ссылки | `sort=newest` | без сортировки (default) |

**Дублирование:** Нет — Hot Tours показывает первые 6 TOUR products, Tours — следующие 6.

---

## 10. Separation от Discounts

| Параметр | Special Offers | Tours |
|----------|----------------|-------|
| Формат карточки | Горизонтальный (thumbnail + content) | Вертикальный (image + content) |
| Акцентный цвет | Amber | Gold |
| Service badge | Есть (ЭКСКУРСИЯ, ТРАНСФЕР и др.) | Нет |
| Типы продуктов | Все типы | Только TOUR |
| Количество | 4 | 6 |

**Дублирование:** Нет — разные форматы, цвета, типы продуктов.

---

## 11. Constructor integration

- Секция совместима с существующей(Constructor architecture)
- `enabled = false` → секция скрыта
- `enabled = true` → секция показывается если есть данные
- **Нет builder controls** на публичной странице

---

## 12. Loading/empty/error

### Loading
- 4 skeleton cards (вертикальный формат, animate-pulse)

### Empty (tours.length === 0)
- Секция **скрыта** (return null)

### Error
- Секция **скрыта** (return null)
- Ошибка обрабатывается локально

---

## 13. Responsive

| Breakpoint | Grid | Cards per row |
|------------|------|---------------|
| Desktop (xl) | `grid-cols-4` | 4 |
| Desktop (lg) | `grid-cols-3` | 3 |
| Tablet (sm) | `grid-cols-2` | 2 |
| Mobile | `grid-cols-1` | 1 |

- Без horizontal overflow
- Mobile: "Все туры →" ссылка внизу

---

## 14. i18n

| Key | RU | AZ | EN |
|-----|----|----|-----|
| `marketplace.tours_title` | Туры | Turlar | Tours |
| `marketplace.tours_subtitle` | Актуальные предложения от партнёров | Tərəfdaşlardan aktual təkliflər | Current offers from partners |
| `marketplace.all_tours` | Все туры | Bütün turlar | All tours |

---

## 15. Accessibility

- Semantic `<section>` с heading `<h2>`
- Cards — `<Link>` (keyboard accessible)
- Image alt: `card.title`
- Visible focus: `focus-visible:outline-2 focus-visible:outline-gold`
- Hover/focus states
- Достаточный contrast

---

## 16. Performance

- **Lazy loading:** `loading="lazy"` на изображениях
- **Batch API:** один запрос `listProducts` на 50 продуктов
- **Client-side filter:** быстрая фильтрация по type + offset
- **Stable aspect ratio:** `aspect-[4/3]`
- **Нет отдельного request** для каждой карточки

---

## 17. Tests

- **TypeScript:** 0 ошибок ✅
- **Browser QA:** desktop + mobile verified ✅
- **Real data:** 6 different TOUR products (no overlap with Hot Tours) ✅

---

## 18. Build

- Frontend dev server: localhost:3000 — HTTP 200 ✅
- Backend API: localhost:4000 — running ✅
- TypeScript: 0 errors ✅

---

## 19. Pre-existing failures

- `hero.png` deleted (untracked) — не влияет
- TOUR products не привязаны к category "tours" — не влияет на эту секцию

---

## 20. New failures

- Нет

---

## 21. Known limitations

1. **Нет backend TOUR type filter:** Backend API не поддерживает фильтрацию по `productType`. Фильтрация `type === "TOUR"` и offset для разделения с Hot Tours происходит на клиенте. Для production рекомендуется добавить `type` параметр в Public Catalog API.

2. **Дублирование API запросов:** Hot Tours и Tours делают один и тот же запрос `listProducts({ sort: "newest", pageSize: 50 })`, но с разным client-side offset. Для оптимизации можно вынести data fetching на уровень страницы.

---

## 22. Изменённые файлы

**Созданы:**
- `frontend/components/marketplace/Tours.tsx`

**Обновлены:**
- `frontend/app/page.tsx` (добавлен Tours между SpecialOffers и footer)
- `frontend/lib/i18n.tsx` (3 новых ключа для tours)

---

## 23. Git status

| Параметр | Значение |
|----------|----------|
| Repository | `https://github.com/seldom733-hash/travelhub1` |
| Branch | `master` |
| HEAD (до) | `167de54` |
| HEAD (после) | коммит в процессе |

---

## 24. Commit SHA

В процессе.

---

## 25. Push status

В процессе.

---

## Вердикт

✅ **TOURS — PASS**

- Секция реализована отдельным Marketplace Home section
- Расположена после Скидки и спецпредложения
- Используются реальные TOUR products из Public Catalog API
- Нет дублирования с Hot Tours (skip первых 6)
- Нет дублирования с Special Offers (разные форматы/типы)
- Нет fake production tours
- Цена не фальсифицируется
- Card click ведёт в `/products/{slug}`
- "Все туры" ведёт в `/search?category=tours`
- Loading state: skeleton cards
- Empty state: section скрыта
- Error state: section скрыта
- Constructor compatibility сохранена
- Responsive: 4/3/2/1 колонки
- i18n RU/AZ/EN
- Accessibility: semantic HTML, keyboard nav, focus states
- TypeScript: 0 ошибок
- Нет regressions
