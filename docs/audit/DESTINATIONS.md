# Направления и меню услуг

Дата: 2026-10-27.

## 1. Меню «Услуги»

В `MarketplaceHeader` временно отключены все подразделы, кроме:

- **Проживание** → `/search?category=hotels`;
- **Туры** → `/search?category=tours`.

Отключены: экскурсии, трансферы, впечатления, wellness, гастрономия. Они
остаются видны в меню, но не кликабельны (`aria-disabled`, приглушённый стиль,
бейдж «скоро»). Чтобы вернуть раздел, достаточно убрать `disabled: true` в
массиве `SERVICES` (`frontend/components/marketplace/MarketplaceHeader.tsx`).

## 2. Footer → «Направления»

Ссылка ведёт на `/destinations` (раньше вела на
`/search?category=destinations`).

### Страница стран

`GET /api/v1/public/destinations` — новый public endpoint. Он агрегирует только
PUBLISHED + MARKETPLACE продукты и возвращает страны, где есть **и туры, и
отели**:

```json
{ "code": "TH", "names": { "ru": "Таиланд", "az": "Tayland", "en": "Thailand" }, "tours": 2804, "hotels": 593 }
```

Страница `/destinations` показывает список стран с флагами и количеством
туров/отелей. Флаги — `flagcdn.com/w160/<iso>.png` (не зависят от наличия
emoji-шрифта в ОС).

### Страница страны

`/destinations/[code]`, например `/destinations/TH`:

- заголовок страны и флаг;
- переключатель **Туры / Отели**;
- по умолчанию открываются **Туры**;
- «Отели» запрашивают `category=accommodation&geoCountry=TH`;
- «Туры» — `category=tours&geoCountry=TH`;
- карточки — общий `ProductCard`, ссылки на `/products/<code>`.

## 3. Проверки

- Backend unit: `public-catalog.service.spec.ts` — 28 tests PASS, включая
  `listDestinations`.
- Frontend: `lib/destinations.spec.ts` — 3 tests PASS.
- Typecheck + production build — PASS.
- Playwright smoke: footer → `/destinations`, 21 страна, страна TH, табы
  «Туры»/«Отели», 5 disabled пунктов меню, 0 page errors.
- Скриншоты: `reports/demo/14-destinations.png`,
  `reports/demo/15-country-tours.png`,
  `reports/demo/16-country-hotels.png`,
  `reports/demo/17-services-menu.png`.

## Ограничение

Список стран ограничен первыми 250 странами по количеству карточек; для
маркетплейса этого достаточно. Флаги загружаются с внешнего CDN — при
полностью офлайн-деплое нужно положить их в `frontend/public/flags`.
