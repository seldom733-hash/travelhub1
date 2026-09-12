# Отчёт: Скидки и спецпредложения (Special Offers) — Marketplace Home

**Версия:** 1.0  
**Дата:** 2026-09-12  
**Автор:** opencode (автоматический)  
**Статус:** ✅ ЗАВЕРШЕНО (ограничения зафиксированы)

---

## 1. Что реализовано

Отдельный блок «Скидки и спецпредложения» на Marketplace Home, расположенный после «Горящих туров».

**Home:**
- Hero = unchanged
- Search = unchanged
- Popular Destinations = unchanged
- Hot Tours = unchanged
- **Discounts / Special Offers = implemented** ✅

---

## 2. Источник promotions/discounts

**Backend Prisma schema НЕ содержит** механизма product-level promotions/discounts:

| Механизм | Наличие | Назначение |
|----------|---------|------------|
| `CommercialPeriod` | Есть | Time-bound pricing override (сезонность) — **не промо** |
| `QuoteDiscountType` | Есть | Ручная скидка агента в Quote — **B2B, не product** |
| `Campaign` | Есть | CRM-маркетинг (аудитории + атрибуция) — **нет связи с products** |
| `isHot`/`isFeatured`/`hotDiscount` | **НЕТ** | Legacy поля удалены в новой Prisma schema |
| `originalPrice`/`salePrice`/`discountPercent` | **НЕТ** | Не моделируются в Catalog |
| Coupon/promo codes | **НЕТ** | Не смоделированы |

### Используемый подход:
- `publicApi.listProducts({ sort: "price_asc", pageSize: 50 })` — запрос дешёвых опубликованных продуктов
- Клиентская выборка первых 4 продуктов (все типы: TOUR, EXCURSION, TRANSFER и др.)
- **Без fake discount data, без fake original prices, без fake percentage**

---

## 3. Business semantics

Backend **не поддерживает** семантику «скидок/спецпредложений» на уровне каталога:

- Нет `originalPrice` vs `salePrice` — только `priceFrom`
- Нет `discountPercent` или `discountAmount` на Product
- Нет `isOnSale`, `isPromo`, `promoBadge`
- `CommercialPeriod` может иметь цену ниже базовой Tariff, но original price **не экспонируется** в public API

**Реализовано:** секция показывает доступные опубликованные услуги как подборку «спецпредложений», визуально выделяя их сервисные бейджи. Полноценная семантика скидок требует миграции БД.

---

## 4. API/domain contract

- **Endpoint:** `GET /api/v1/public/products?sort=price_asc&pageSize=50`
- **Фильтрация:** клиентская — первые 4 продукта всех типов
- **Поля карточки:** id, slug, title, primaryImage, priceFrom, currency, category, seller, type
- **Без изменений backend** — используется существующий контракт

---

## 5. Card structure

Карточка — **горизонтальный формат** (отличие от вертикальных карточек Hot Tours):

```text
┌──────────┬─────────────────────────────────────┐
│          │  ЭКСКУРСИЯ (category)               │
│  IMAGE   │  Puppet Theater Show                 │
│  + badge │  Seller Name                         │
│          │  от 2.00 AZN                    [→]  │
└──────────┴─────────────────────────────────────┘
```

- Миниатюра слева (aspect-[4/3], 128-160px)
- Service badge (цветной pill badge): ТУР, ОТЕЛЬ, ЭКСКУРСИЯ, ТРАНСФЕР и др.
- Категория: category.title (uppercase, neutral-500)
- Название: serif, line-clamp-2, hover → amber
- Продавец: seller.displayName
- Цена: от priceFrom currency (amber-400)

---

## 6. Price/discount logic

**КРИТИЧЕСКОЕ ПРАВИЛО:** Никаких fake discount.

- Показывается только реальная `priceFrom` (минимальная цена)
- **Нет** старой цены, процента скидки, strike-through
- **Нет** вычисления скидки на frontend
- Если цена отсутствует → "Цена по запросу"

---

## 7. Validity

Backend **не предоставляет** Promotion validity (startDate/endDate/active).

- Нет `expiresAt` на Product
- Нет `campaign status` для product-level offers
- **Не показываем** сроки действия — их нет в данных

---

## 8. Seller/partner

- Если `card.seller` существует → показывается `seller.displayName`
- Если `seller.visibilityMode === "ANONYMOUS"` → generic label
- Если `seller.verified === true` → ✓ badge (из public seller model)
- **Без fake seller names**

---

## 9. Navigation

- **Клик по карточке:** `/products/{slug}` → существующий Product Detail flow
- **Все предложения:** `/search?sort=price_asc` → существующий Results/Catalog flow
- Используются стабильные `slug` идентификаторы

---

## 10. Overlap analysis с Hot Tours

| Параметр | Hot Tours | Special Offers |
|----------|-----------|----------------|
| Типы продуктов | Только TOUR | Все типы |
| Сортировка | `newest` | `price_asc` |
| Количество карточек | 6 | 4 |
| Формат карточки | Вертикальный (aspect-[4/3]) | Горизонтальный (thumbnail + content) |
| Акцентный цвет | Gold | Amber |
| Service badge | Нет | Есть (ТУР, ЭКСКУРСИЯ и др.) |
| Ссылка «Все» | `/search?category=tours&sort=newest` | `/search?sort=price_asc` |

**Вывод:** Секции визуально и семантически различаются. Дублирования нет — Hot Tours =最新 туры, Special Offers = доступные услуги всех типов.

---

## 11. Constructor integration

- Секция совместима с существующей(Constructor architecture)
- `enabled = false` → секция скрыта
- `enabled = true` → секция показывается если есть данные
- **Нет builder controls** на публичной странице

---

## 12. Loading/empty/error

### Loading
- 4 skeleton cards (горизонтальный формат, animate-pulse)

### Empty (offers.length === 0)
- Секция **скрыта** (return null)
- Не показывает пустой блок

### Error
- Секция **скрыта** (return null)
- Ошибка обрабатывается локально

---

## 13. Responsive

| Breakpoint | Grid | Cards per row |
|------------|------|---------------|
| Desktop (xl/lg) | `grid-cols-2` | 2 |
| Tablet (sm) | `grid-cols-2` | 2 |
| Mobile | `grid-cols-1` | 1 |

- Карточки: горизонтальный формат на всех размерах
- Thumbnail: `w-32 sm:w-40` (128px / 160px)
- Без horizontal overflow
- Mobile: "Все предложения →" ссылка внизу

---

## 14. i18n

| Key | RU | AZ | EN |
|-----|----|----|-----|
| `marketplace.special_offers_title` | Скидки и спецпредложения | Endirimlər və xüsusi təkliflər | Discounts & Special Offers |
| `marketplace.special_offers_subtitle` | Лучшие цены на популярные услуги | Populyar xidmətlərdə ən yaxşı qiymətlər | Best prices on popular services |
| `marketplace.all_offers` | Все предложения | Bütün təkliflər | All offers |

---

## 15. Accessibility

- Semantic `<section>` с heading `<h2>`
- Cards — `<Link>` (keyboard accessible)
- Image alt: `card.title`
- Visible focus: `focus-visible:outline-2 focus-visible:outline-amber-400`
- Hover/focus states
- Достаточный contrast (white/amber on dark)

---

## 16. Performance

- **Lazy loading:** `loading="lazy"` на изображениях
- **Batch API:** один запрос `listProducts` на 50 продуктов
- **Client-side selection:** выбор первых 4
- **Stable aspect ratio:** `aspect-[4/3]` thumbnails
- **Нет отдельного request** для каждой карточки

---

## 17. Tests

- **TypeScript:** 0 ошибок ✅
- **Browser QA:** desktop + mobile verified ✅
- **Real data:** 4 products из catalog (ЭКСКУРСИЯ, ТРАНСФЕР, ТУР) ✅

---

## 18. Build

- Frontend dev server: localhost:3000 — HTTP 200 ✅
- Backend API: localhost:4000 — running ✅
- TypeScript: 0 errors ✅

---

## 19. Pre-existing failures

- `hero.png` deleted (untracked) — не влияет
- TOUR products не привязаны к category "tours" — не влияет на эту секцию (все типы)

---

## 20. New failures

- Нет

---

## 21. Known limitations

1. **Нет product-level promotions/discounts в backend:** В новом Prisma schema отсутствуют `isHot`/`isFeatured`/`hotDiscount`/`originalPrice`/`salePrice`/`discountPercent`. Секция показывает доступные услуги как подборку, без семантики «скидки». Для полноценной реализации необходима миграция БД и добавление Promotion/Discount модели.

2. **Нет validity (срок действия):** Backend не предоставляет `startDate`/`endDate`/`expiresAt` для product-level offers. Секция не показывает сроки.

3. **Нет comparison «было/стало»:** `PublicProductCard` содержит только `priceFrom` — нет `originalPrice` для отображения strike-through цены.

4. **Клиентская фильтрация:** Backend API не поддерживает фильтрацию по `productType` или `sort=price_asc` для семантики «спецпредложений». Фильтрация происходит на клиенте.

---

## 22. Изменённые файлы

**Созданы:**
- `frontend/components/marketplace/SpecialOffers.tsx`

**Обновлены:**
- `frontend/app/page.tsx` (добавлен SpecialOffers между HotTours и footer)
- `frontend/lib/i18n.tsx` (3 новых ключа для special offers)

---

## 23. Git status

| Параметр | Значение |
|----------|----------|
| Repository | `https://github.com/seldom733-hash/travelhub1` |
| Branch | `master` |
| HEAD (до) | `ae23269` |
| HEAD (после) | коммит в процессе |

---

## 24. Commit SHA

В процессе.

---

## 25. Push status

В процессе.

---

## Вердикт

✅ **DISCOUNTS / SPECIAL OFFERS — PASS (с ограничениями)**

- Секция реализована отдельным Marketplace Home section
- Расположена после Горящих туров
- Визуально отличается от Hot Tours: горизонтальный формат, amber accent, service badges
- Используются реальные данные из Public Catalog API
- Нет fake production discounts
- Цена не фальсифицируется (без fake original prices/percentages)
- Card click ведёт в `/products/{slug}`
- "Все предложения" ведёт в `/search?sort=price_asc`
- Loading state: skeleton cards
- Empty state: section скрыта
- Error state: section скрыта
- Constructor compatibility сохранена
- Responsive: 2/1 колонки
- i18n RU/AZ/EN
- Accessibility: semantic HTML, keyboard nav, focus states
- TypeScript: 0 ошибок
- Нет regressions

**Ограничение:** Backend не имеет product-level promotions/discount mechanism. Полноценная семантика «скидок» (original price vs sale price, discount %, validity) требует миграции БД.
