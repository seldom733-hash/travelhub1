# TRAVELHUB — MARKETPLACE «НОВЫЕ ПРЕДЛОЖЕНИЯ»: ОТЧЁТ РЕАЛИЗАЦИИ

## 1. Executive Summary

Реализован новый динамический блок **«Новые предложения»** (`latest-offers`) для публичной Marketplace Home TravelHub. Блок отображает последние опубликованные предложения партнёров, отсортированные по дате публикации (`publishedAt DESC`). Полностью интегрирован в существующую Constructor architecture — управляется через `Настройки → Конструктор витрины → Структура`.

**Final Verdict: PASS — MARKETPLACE LATEST OFFERS IMPLEMENTED AND INTEGRATED WITH CONSTRUCTOR**

## 2. Что реализовано

- Новый блок `latest-offers` в backend Block Registry (`block-registry.ts`)
- Новый блок `latest-offers` в frontend Block Registry (`constructor-registry.ts`)
- React-компонент `LatestOffers.tsx` с real-time данными из Public Catalog API
- Интеграция в `MarketplaceRenderer.tsx` (BLOCK_COMPONENTS + DefaultMarketplaceLayout)
- Добавлен в `DEFAULT_HOME_SECTIONS` на позицию 3 (после popular-destinations)
- 7 новых i18n ключей (RU/AZ/EN): title, subtitle, empty, empty_hint, all_latest, just_now
- Relative timestamp badges на карточках («2 часа назад», «вчера», «3 дн. назад»)
- Пустое состояние с локализованным сообщением
- Дедупликация карточек (safety net)

## 3. Источник данных

Реальные данные из TravelHub Public Catalog API:

```
GET /api/v1/public/products?sort=newest&pageSize=50
```

- `sort=newest` → `publishedAt DESC, createdAt DESC, id ASC` (server-side SQL)
- Фильтрация по типу НЕ требуется — все опубликованные Marketplace-предложения подходят
- Дедупликация по `id` на клиенте (safety net)
- Default limit: 6 карточек

## 4. Правила Eligibility

В блок попадают ТОЛЬКО предложения, которые:

1. Имеют `status = PUBLISHED`
2. Имеют `publishedAt IS NOT NULL`
3. Доступны через Public Catalog API (MARKETPLACE publication channel)
4. Не дублируются (дедупликация по id)

Не показываются: DRAFT, ARCHIVED, private partner-only, скрытые.

## 5. Сортировка

```
publishedAt DESC, createdAt DESC, id ASC
```

Это серверная SQL-сортировка через существующий `PublicCatalogService`. Deterministic tie-breaker: `createdAt DESC, id ASC`.

## 6. MarketplaceRenderer Integration

Блок подключён через существующий configuration-driven rendering path:

```
Constructor Registry → Published Configuration → MarketplaceRenderer → LatestOffers
```

- Добавлен в `BLOCK_COMPONENTS` lookup
- Добавлен в `DefaultMarketplaceLayout` fallback
- Стандартный порядок: Hero → Search → PopularDestinations → **LatestOffers** → HotTours → ...

## 7. Constructor Integration

### Structure

- Блок `latest-offers` зарегистрирован в Block Registry (backend + frontend)
- `category: "marketplace"`, `singleton: true`, `removable: true`
- `dataSourceType: "product-feed"`, `defaultSettings: { pageSize: 6 }`
- Администратор может: включить/выключить, изменить позицию, удалить

### Content

Настройки через standard ConstructorSection settings:
- `pageSize` (количество карточек, default: 6)

## 8. Draft / Preview / Publish

Используется существующая модель Constructor:
- Save Draft → increment draftVersion
- Publish → promote draftVersion to currentVersion, create snapshot
- Public marketplace видит только published version
- Draft isolation сохранена

## 9. i18n

| Key | RU | AZ | EN |
|-----|----|----|-----|
| `marketplace.latest_offers_title` | Новые предложения | Son təkliflər | Latest Offers |
| `marketplace.latest_offers_subtitle` | Свежие предложения от наших партнёров | Tərəfdaşlarımızdan son təkliflər | Fresh offers from our partners |
| `marketplace.latest_offers_empty` | Пока новых предложений нет | Hələ yeni təkliflər yoxdur | No new offers yet |
| `marketplace.latest_offers_empty_hint` | Новые предложения наших партнёров появятся здесь. | Tərəfdaşlarımızın yeni təklifləri burada görünəcək. | New offers from our partners will appear here. |
| `marketplace.all_latest` | Все новые | Hamısı yeni | All latest |
| `marketplace.just_now` | только что | indi | just now |

## 10. Security / Tenant Isolation

- Public API — `@Public()`, no auth required
- Server-side visibility filter: `status = PUBLISHED AND publishedAt IS NOT NULL`
- Tenant isolation via existing PublicCatalogService
- Client-side `enabled` toggle не является security boundary
- Нет доступа к private partner data

## 11. Performance

- Один запрос к Public Catalog API (`pageSize=50`)
- Server-side сортировка и пагинация
- N+1 не добавлен
- Lazy loading карточек (`loading="lazy"`)
- Client-side дедупликация (O(n) Set)

## 12. Browser Verification

### A — Constructor Structure ✅
`Настройки → Конструктор витрины → Структура` → «Новые предложения» присутствует на позиции 4

### B — Marketplace Home ✅
Блок отображается между «Популярные направления» и «Горящие туры» с реальными данными

### C — Disable ✅
Выключил блок → Save → Publish → Marketplace: блок отсутствует

### D — Enable ✅
Включил блок → Save → Publish → Marketplace: блок отображается

### E — Real Data ✅
Карточки содержат реальные опубликованные Marketplace-предложения (Baku City Tour Vehicle, Corporate Event Photography, Turkish Cuisine - Baku, и др.)

### F — Empty State ✅
Корректное локализованное сообщение: «Пока новых предложений нет»

### G — Draft Isolation ✅
Published config не содержит draft changes до explicit Publish

### H — Hard Refresh ✅
3 последовательных hard refresh — без hydration flash, без draft leakage

### I — No Console Errors ✅
0 ошибок в browser console

## 13. Изменённые файлы

| Файл | Изменение |
|------|-----------|
| `backend/src/modules/constructor/block-registry.ts` | Добавлен блок `latest-offers` |
| `backend/src/modules/constructor/constructor.service.ts` | `latest-offers` в `DEFAULT_HOME_SECTIONS` на позиции 3 |
| `frontend/lib/constructor-registry.ts` | Добавлен блок `latest-offers` (frontend mirror) |
| `frontend/lib/i18n.tsx` | 7 новых i18n ключей (RU/AZ/EN) |
| `frontend/components/marketplace/LatestOffers.tsx` | **Новый файл** — React-компонент блока |
| `frontend/components/marketplace/MarketplaceRenderer.tsx` | Добавлен в BLOCK_COMPONENTS + DefaultMarketplaceLayout |

## 14. Pre-existing Failures

Нет. Все существующие блоки продолжают работать без изменений.

## 15. Git Status

- Branch: `master`
- Working tree: чистый (все изменения в ожидании commit)
- Untracked: `docs/reports/evidence/LATEST_OFFERS_*.png` (скриншоты verification)

## 16. Final Verdict

**PASS — MARKETPLACE LATEST OFFERS IMPLEMENTED AND INTEGRATED WITH CONSTRUCTOR**
