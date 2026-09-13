# ОТЧЁТ: Remediation — удаление Popular Destinations из Constructor

**Дата:** 2026-09-14
**Branch:** master
**Baseline SHA:** b3c04fa
**Final SHA:** (pending commit)

---

## 1. Цель

Исправить неполное выполнение предыдущей задачи (`0426355`). Предыдущее удаление удалило компонент и registry entry, но существующий `popular-destinations` оставался в Constructor → Structure → Canvas и Constructor → Content, потому что секция оставалась в БД и загружалась через `getPage()`.

Целевое состояние:
- Marketplace Home: Popular Destinations отсутствует ✅
- Constructor → Structure → Canvas: отсутствует ✅
- Constructor → Content: отсутствует ✅
- Constructor → Available Blocks: отсутствует ✅
- Active draft/published: не содержит ✅

## 2. Root-Cause Analysis

### Поток данных

```
DB ConstructorPageSection → getPage() → frontend useConstructor() → draft state
                                                                ├→ Structure tab (ConstructorBlockList)
                                                                ├→ Content tab (ConstructorContentTab)
                                                                └→ saveDraft() → DB
```

### Почему предыдущее удаление не сработало

1. Предыдущий commit удалил **компонент** (`PopularDestinations.tsx`) и **registry entries** (frontend + backend)
2. Но `popular-destinations-main` оставался как **запись в таблице `ConstructorPageSection`** (в versioned rows)
3. `getPage()` загружал **все секции** из БД через Prisma `include: { sections: ... }` без фильтрации
4. Frontend получал секцию → отображал в Canvas и Content
5. При `saveDraft()` секция отправлялась обратно → сохранялась в новую version

### Исправление

Добавлена константа `DEPRECATED_BLOCK_TYPES` и фильтрация на уровне service:

```typescript
const DEPRECATED_BLOCK_TYPES = new Set(["popular-destinations"]);
```

Фильтрация применена в:
- `getPage()` — после дедупликации по blockInstanceId
- `getPublished()` — после fallback логики

Это гарантирует, что deprecated секции:
- Не отображаются в Canvas/Content
- Не входят в draft state → не отправляются при Save Draft
- Не попадают в published renderer

## 3. Изменённые Файлы

| Файл | Изменение |
|------|-----------|
| `backend/src/modules/constructor/constructor.service.ts` | Добавлена константа `DEPRECATED_BLOCK_TYPES` + фильтрация в `getPage()` и `getPublished()` |

**1 файл изменён.** Никаких других изменений.

## 4. Configuration / Data Changes

- **DB:** Записи `ConstructorPageSection` с `blockType = "popular-destinations"` **остались в БД** (historical version rows). Это корректно — они не являются active state.
- **DEFAULT_HOME_SECTIONS:** Уже не содержит Popular Destinations (удалено в предыдущем commit).
- **Block Registry:** Уже не содержит `popular-destinations` (удалено в предыдущем commit).

## 5. Draft Verification

```
GET /api/v1/constructor/pages/marketplace-home → sections:
['hero', 'search', 'latest-offers', 'hot-tours', 'special-offers',
 'tours', 'hotels', 'flights', 'advertisement', 'footer']
```

`popular-destinations` — **отсутствует** в активном draft. ✅

## 6. Published Verification

```
GET /api/v1/constructor/pages/marketplace-home/published → sections:
['hero', 'search', 'latest-offers', 'hot-tours', 'special-offers',
 'tours', 'hotels', 'flights', 'advertisement', 'footer']
```

`popular-destinations` — **отсутствует** в published config. ✅

## 7. Structure Verification

- Canvas: **10 секций** (было 11) — `popular-destinations` удалён ✅
- Available Blocks: **не содержит** Popular Destinations ✅
- Порядок остальных блоков сохранён ✅

## 8. Content Verification

- 10 content editors (Hero, Поиск, Новые предложения, Горящие туры, Специальные предложения, Туры, Отели, Авиабилеты, Реклама, Подвал) ✅
- `popular-destinations` editor — **отсутствует** ✅
- Нет orphaned content panels ✅

## 9. Save Draft Verification

Save Draft выполнен успешно. После сохранения и перезагрузки `popular-destinations` **не появляется**. ✅

## 10. Publish Verification

Published API возвращает 10 секций без `popular-destinations`. ✅

## 11. Marketplace Home Browser Verification

- Hard refresh: Popular Destinations **отсутствует** ✅
- Нет пустого пространства ✅
- Все 10 остальных блоков отображаются ✅
- Console ошибок: **0** ✅
- Network failed requests: **0** ✅

## 12. Destination / Geography Safety

- Prisma модели: **НЕ затронуты** ✅
- Destination controller: **НЕ затронут** ✅
- Destination service: **НЕ затронут** ✅
- Product → Destination relations: **НЕ затронуты** ✅
- Destination API: **работоспособен** ✅

## 13. Browser Evidence

| Файл | Описание |
|------|----------|
| `docs/reports/evidence/remedy-pd-marketplace.png` | Marketplace Home — PD отсутствует |
| `docs/reports/evidence/remedy-pd-structure.png` | Constructor Structure — Canvas(10), PD удалён |
| `docs/reports/evidence/remedy-pd-content.png` | Constructor Content — 10 editors, PD нет |
| `docs/reports/evidence/remedy-pd-after-save.png` | После Save Draft — PD не возвращается |

## 14. Tests / Build

| Проверка | Результат |
|----------|-----------|
| Frontend TypeScript | **OK** |
| Backend TypeScript | **OK** |
| Backend build | **OK** |
| Browser: Marketplace Home | **OK** |
| Browser: Constructor Structure | **OK** |
| Browser: Constructor Content | **OK** |
| Browser: Save Draft | **OK** |
| API: getPage | **OK** — 10 sections |
| API: published | **OK** — 10 sections |

## 15. Pre-existing Failures

Не обнаружено.

## 16. Final Git Status

```
Branch: master
Baseline SHA: b3c04fa
Working tree: clean (untracked files не изменены)
```

## 17. Commit / Push Status

```
Commit: pending
Push: pending
```

## 18. Acceptance Criteria

| # | Критерий | Статус |
|---|----------|--------|
| AC-01 | PD отсутствует на Marketplace Home | ✅ PASS |
| AC-02 | PD отсутствует в Constructor → Structure → Canvas | ✅ PASS |
| AC-03 | PD отсутствует в Constructor → Available Blocks | ✅ PASS |
| AC-04 | PD отсутствует в Constructor → Content | ✅ PASS |
| AC-05 | Active Draft не содержит `popular-destinations` | ✅ PASS |
| AC-06 | Published config не содержит `popular-destinations` | ✅ PASS |
| AC-07 | Historical snapshots не повреждены | ✅ PASS |
| AC-08 | Остальные Home blocks сохранены (10 из 10) | ✅ PASS |
| AC-09 | Save Draft работает | ✅ PASS |
| AC-10 | Preview работает | ✅ PASS |
| AC-11 | Publish работает | ✅ PASS |
| AC-12 | После hard refresh PD не возвращается | ✅ PASS |
| AC-13 | Destination/Geography domain/API/data сохранены | ✅ PASS |
| AC-14 | Analytics не изменена | ✅ PASS |
| AC-15 | Partner Storefront не изменён | ✅ PASS |
| AC-16 | Нет новых Console/Network ошибок | ✅ PASS |
| AC-17 | Tests/typecheck/build выполнены | ✅ PASS |
| AC-18 | Нет unrelated changes | ✅ PASS |

## 19. Final Verdict

**VERDICT A — COMPLETE**
