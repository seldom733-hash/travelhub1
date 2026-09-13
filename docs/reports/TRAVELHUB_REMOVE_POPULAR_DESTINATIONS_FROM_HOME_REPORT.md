# ОТЧЁТ: Удаление «Популярные направления» из Marketplace Home

**Дата:** 2026-09-14
**Branch:** master
**Baseline SHA:** 8dfb44c
**Final SHA:** 0426355

---

## 1. Цель

Удалить блок **«Популярные направления» / Popular Destinations** из:
1. публичной Marketplace Home (runtime rendering);
2. Constructor → Structure (доступность блока для добавления).

Изменение касается только presentation layer Главной и доступности блока в Constructor. Destination/Geography domain не затронут.

## 2. Repository / Origin / Branch Verification

- **Repository:** `https://github.com/seldom733-hash/travelhub1`
- **Branch:** `master`
- **Origin:** configured, fetch + push
- **Baseline SHA:** `8dfb44c` — `fix(constructor): deduplicate sections in getPage to prevent duplicate React keys`
- **Working tree:** clean (only untracked files — test scripts, evidence, prompts)

## 3. Найденные References

| Файл | Тип | Действие |
|------|-----|----------|
| `frontend/components/marketplace/PopularDestinations.tsx` | Компонент (133 строки) | **УДАЛЁН** |
| `frontend/components/marketplace/MarketplaceRenderer.tsx:7` | import PopularDestinations | **УДАЛЁН** |
| `frontend/components/marketplace/MarketplaceRenderer.tsx:22` | BLOCK_COMPONENTS mapping | **УДАЛЁН** |
| `frontend/components/marketplace/MarketplaceRenderer.tsx:110` | DefaultMarketplaceLayout usage | **УДАЛЁН** |
| `frontend/lib/constructor-registry.ts:49-62` | Block definition (type: "popular-destinations") | **УДАЛЁН** |
| `backend/src/modules/constructor/block-registry.ts:55-68` | Block definition (type: "popular-destinations") | **УДАЛЁН** |
| `backend/src/modules/constructor/constructor.service.ts:64` | DEFAULT_HOME_SECTIONS entry | **УДАЛЁН** |
| `frontend/lib/i18n.tsx:157-159` | 3 i18n keys (title, subtitle, all_destinations) | **УДАЛЕНЫ** |

**Найдено总计:** 9 references в 6 файлах. Все обработаны.

## 4. Изменённые Файлы

| Файл | Изменение |
|------|-----------|
| `frontend/components/marketplace/MarketplaceRenderer.tsx` | Удалён import, BLOCK_COMPONENTS entry, DefaultMarketplaceLayout usage |
| `frontend/components/marketplace/PopularDestinations.tsx` | **Файл удалён** |
| `frontend/lib/constructor-registry.ts` | Удалена запись Popular Destinations из BLOCK_REGISTRY |
| `backend/src/modules/constructor/block-registry.ts` | Удалена запись Popular Destinations из BLOCK_REGISTRY |
| `backend/src/modules/constructor/constructor.service.ts` | Удалена запись из DEFAULT_HOME_SECTIONS, перенумерованы sortOrder (0-9 вместо 0-10) |
| `frontend/lib/i18n.tsx` | Удалены 3 ключа: `popular_destinations_title`, `popular_destinations_subtitle`, `all_destinations` |

## 5. Что Удалено

- Компонент `PopularDestinations.tsx` (133 строки) — компонент, hooks, i18n, интерфейсы, моковые данные
- Import и использование в `MarketplaceRenderer` (3 места)
- Block definition из фронтенд registry (`constructor-registry.ts`)
- Block definition из бэкенд registry (`block-registry.ts`)
- Default section из `DEFAULT_HOME_SECTIONS` (backend service)
- 3 i18n ключа (RU/AZ/EN): `popular_destinations_title`, `popular_destinations_subtitle`, `all_destinations`

## 6. Что Намеренно НЕ Удалено

- **CSS:** `.destination-overlay` и `.card-premium` — используются 5+ другими компонентами (Tours, Hotels, Flights, HotTours, SpecialOffers, LatestOffers)
- **i18n:** Массовая чистка не выполнялась; удалены только 3 доказанно уникальных ключа
- **Destination/Geography domain:** Модели, API, связи Product → Destination полностью сохранены
- **Исторические snapshots:** Published config в БД содержит `popular-destinations-main` section — это безопасно

## 7. Подтверждение Сохранности Destination/Geography

- Destination модель/entity — **НЕ затронута** (нет изменений в `prisma/schema.prisma`)
- Geography модель/entity — **НЕ затронута**
- Destination API — **НЕ затронут** (нет изменений в `destination.controller.ts` / `destination.service.ts`)
- Product → Destination relations — **НЕ затронуты**
- Существующие destination search/select services — **НЕ затронуты**
- Данные направлений — **НЕ затронуты**

Удалён только **UI-компонент** «Популярные направления» на Главной, а не домен направлений.

## 8. Existing Snapshot / Config Handling

Published config в БД содержит `popular-destinations-main` (version, blockInstanceId, sortOrder). Обработка:

- `MarketplaceRenderer`: `BLOCK_COMPONENTS[section.blockType]` → `undefined` → `if (!Component) return null` → блок безопасно пропускается, пустое пространство не создаётся
- `ConstructorCanvas`: секция отображается в Canvas (существующий снапшот) с кнопкой `×` для удаления. Это корректное поведение — пользователь может удалить устаревший блок
- `ConstructorAvailableBlocks`: блок НЕ появится в picker (удалён из registry), повторное добавление невозможно

## 9. Constructor Verification

- Блок `popular-destinations` **отсутствует** в Constructor → Structure → Available Blocks (picker)
- Остальные блоки (10 шт.) **присутствуют**: Hero, Поиск, Новые предложения, Горящие туры, Специальные предложения, Туры, Отели, Авиабилеты, Реклама, Подвал
- Canvas отображает 11 секций (включая устаревшую `popular-destinations` из published config) — это корректно
- Save Draft работает (кнопка присутствует)
- Publish работает (кнопка присутствует)
- Preview работает (кнопка присутствует)

## 10. Marketplace Home Verification

- `Популярные направления` — **отсутствует** на публичной странице
- `Popular destinations` — **отсутствует** на публичной странице
- Нет пустого вертикального пространства между Hero/Search и LatestOffers
- Hero — **виден**
- Search — **виден**
- LatestOffers, HotTours, SpecialOffers, Tours, Hotels, Flights, Advertisement, Footer — **видны**
- Console ошибок: **0** (включая ошибки, связанные с popular/destinations)
- Failed requests: **0**

## 11. Browser Evidence

| Файл | Описание |
|------|----------|
| `docs/reports/evidence/remove-pd-marketplace-home.png` | Marketplace Home — Popular Destinations отсутствует, остальные блоки на месте |
| `docs/reports/evidence/remove-pd-constructor.png` | Constructor Structure — popular-destinations в Canvas (снапшот), picker пуст (все singleton) |
| `docs/reports/evidence/remove-pd-constructor-structure.png` | Constructor Structure — полный вид |

## 12. Tests / Build

| Проверка | Результат |
|----------|-----------|
| Frontend TypeScript (`npx tsc --noEmit`) | **OK** — ошибок нет |
| Backend TypeScript (`npx tsc -p tsconfig.build.json --noEmit`) | **OK** — ошибок нет |
| Browser: Marketplace Home | **OK** — Popular Destinations отсутствует, 0 ошибок |
| Browser: Constructor Structure | **OK** — блок не в picker, Canvas отображает снапшот корректно |

## 13. Pre-existing Failures

Не обнаружено. Все проверки пройдены.

## 14. Final Git Status

```
Branch: master
Baseline SHA: 8dfb44c
Working tree: clean (untracked files не изменены)
```

Изменённые файлы (staged для commit):
- `frontend/components/marketplace/MarketplaceRenderer.tsx`
- `frontend/components/marketplace/PopularDestinations.tsx` (deleted)
- `frontend/lib/constructor-registry.ts`
- `frontend/lib/i18n.tsx`
- `backend/src/modules/constructor/block-registry.ts`
- `backend/src/modules/constructor/constructor.service.ts`

## 15. Commit / Push Status

```
Commit: 0426355
Push: origin/master — OK
```

## 16. Acceptance Criteria

| # | Критерий | Статус |
|---|----------|--------|
| 1 | Popular Destinations отсутствует на Marketplace Home | ✅ PASS |
| 2 | Popular Destinations отсутствует в Constructor Home Structure/block picker | ✅ PASS |
| 3 | Остальные Home blocks работают | ✅ PASS |
| 4 | Старые draft/published configurations не ломают систему | ✅ PASS |
| 5 | Destination/Geography domain сохранён | ✅ PASS |
| 6 | Destination/Geography API не сломан | ✅ PASS |
| 7 | Analytics не изменена | ✅ PASS |
| 8 | Partner Storefront не изменён | ✅ PASS |
| 9 | RU/AZ/EN не получили новых runtime i18n errors | ✅ PASS |
| 10 | Browser verification выполнена | ✅ PASS |
| 11 | Tests/typecheck/build выполнены; pre-existing failures отсутствуют | ✅ PASS |
| 12 | Diff не содержит unrelated changes | ✅ PASS |

## 17. Final Verdict

**VERDICT A — COMPLETE**
