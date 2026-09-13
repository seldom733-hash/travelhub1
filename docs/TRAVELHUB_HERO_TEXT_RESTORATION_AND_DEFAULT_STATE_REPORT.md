# TRAVELHUB — HERO TEXT RESTORATION + CONSTRUCTOR DEFAULT STATE — ОТЧЁТ

## 1. Git Baseline

```text
Repository:  https://github.com/seldom733-hash/travelhub1 (master)
Baseline:    1763fbd4ef5acfb9a6c85a5072b5c4e61b858e72 (HEAD == origin/master до работ)
Статус:      чистое дерево (только pre-existing untracked-скрипты, не затронуты)
```

## 2. Найденные старые Hero-тексты

Канонический источник восстановлен: **`frontend/lib/i18n.tsx`**, ключи `marketplace.hero_*`
(существовали со времён коммита `5d335a3` «add hero carousel with 3 slides» и никогда не удалялись).

### Slide 1 — Единая экосистема

| Поле | RU | AZ | EN |
|---|---|---|---|
| Title | Единая экосистема | Vahid ekosistem | A unified ecosystem |
| Subtitle | для путешествий | səyahətlər üçün | for travel |
| Description | Отели, туры, экскурсии, трансферы и другие услуги для путешествий — в одном месте. Планируйте и бронируйте всё необходимое в TravelHub. | Otellər, turlar, ekskursiyalar, transferlər və digər səyahət xidmətləri — bir yerdə. … | Hotels, tours, excursions, transfers and other travel services — all in one place. … |

### Slide 2 — Для партнёров

| Поле | RU | AZ | EN |
|---|---|---|---|
| Title | Для партнёров | Tərəfdaşlar üçün | For partners |
| Subtitle | Развивайте бизнес | Biznesinizi inkişaf etdirin | Grow your business |
| Description | Размещайте свои услуги на платформе TravelHub и получайте доступ к тысячам путешественников. … | Xidmətlərinizi TravelHub platformasında yerləşdirin… | List your services on the TravelHub platform… |

### Slide 3 — TravelHub Storefront

| Поле | RU | AZ | EN |
|---|---|---|---|
| Title | TravelHub Storefront | TravelHub Storefront | TravelHub Storefront |
| Subtitle | Создайте свою витрину | Öz vitrininizi yaradın | Create your storefront |
| Description | Персональная витрина для ваших услуг. Представьте свой бизнес путешественникам в лучшем виде. | Xidmətləriniz üçün şəxsi vitrin… | A personal storefront for your services… |

Изображения по умолчанию: `/hero1.png`, `/hero2.png`, `/hero3.png` (существуют в `frontend/public`).
CTA по умолчанию: `/search`.

**Никакие новые тексты не придумывались** — все значения взяты дословно из канонического i18n-источника.

## 3. Точный источник каждого текста

```text
frontend/lib/i18n.tsx:
  marketplace.hero_title_1 / hero_title_2 / hero_description            (slide 1)
  marketplace.hero_slide_2_title_1 / _title_2 / _description            (slide 2)
  marketplace.hero_slide_3_title_1 / _title_2 / _description            (slide 3)
```

Эти же строки продублированы в backend-константе `DEFAULT_HERO_CONFIG`
(`backend/src/modules/constructor/constructor.service.ts`) как Default-слой — единый источник для
«Восстановить по умолчанию».

## 4. Почему тексты появлялись только на доли секунды (root cause)

Цепочка:

```text
1. Hard refresh → useConstructorPublished("marketplace-home"): loading=true
   → MarketplaceRenderer рендерит DefaultMarketplaceLayout
   → HeroSection БЕЗ config → рендерит i18n-тексты (старые Hero-тексты)  ← FLASH

2. Published API отвечает (~десятки–сотни мс)

3. HeroSection получает config → useConfigured=true
   → В БД published-версии все slide.title/subtitle/ctaLabel = "" (пустые строки)
   → buildConfiguredSlides отдавал пустые строки
   → Hero рендерит ПУСТОЙ текст                                          ← DISAPPEAR
```

История: раньше слайды правились в Constructor с пустыми текстовыми полями
(дефолтные `DEFAULT_SLIDES` таба Hero содержали `title: {ru:"",az:"",en:""}`), затем конфиг был
опубликован. Пустые строки в published-снапшоте затирали канонический i18n-фолбэк после hydration.

## 5. Root cause (формулировка)

**Пустые строки конфигурации не являются осмысленным контентом**, но код трактовал наличие
конфига как «текст задан пользователем». Фолбэк на канонические тексты существовал только на
уровне «config = null», а не на уровне «slide без текста».

## 6. Изменённые файлы

```text
backend/prisma/schema.prisma                                            (+defaultConfigs Json?)
backend/prisma/migrations/20260914000000_constructor_default_configs/   NEW
backend/src/modules/constructor/constructor.service.ts                  (+DEFAULT_*_CONFIG, +default-методы)
backend/src/modules/constructor/constructor.controller.ts               (+3 endpoint'а default-config)
frontend/components/marketplace/HeroSection.tsx                         (fix flash→disappear)
frontend/components/constructor/DefaultConfigActions.tsx                NEW (общие контролы Default)
frontend/components/constructor/ConstructorHeroTab.tsx                  (+Default controls)
frontend/components/constructor/ConstructorHeaderTab.tsx                (+Default controls)
frontend/components/constructor/ConstructorSearchTab.tsx                (+Default controls)
frontend/components/constructor/ConstructorFooterTab.tsx                (+Default controls)
frontend/components/constructor/ConstructorDesignTab.tsx                (+Default controls)
frontend/lib/constructor-api.ts                                         (+3 API-метода, +тип)
frontend/lib/i18n.tsx                                                   (+7 ключей constructor.default_*)
```

## 7. Исправление Hero (flash → disappear)

`frontend/components/marketplace/HeroSection.tsx` — `buildConfiguredSlides`:
если у слайда **все три текстовых поля пусты** (title/subtitle/ctaLabel), слайд получает
канонический i18n-текст своего индекса (`marketplace.hero_*`). Изображение из конфига сохраняется.

Результат: при hard refresh тексты совпадают ДО и ПОСЛЕ hydration → flash исчез физически,
пустой Hero невозможен. Server/client mismatch нет (оба источника рендерят одинаковый текст).

## 8. Реализация Default (слой по умолчанию)

**Схема БД** (миграция `20260914000000_constructor_default_configs`):

```sql
ALTER TABLE "constructor"."ConstructorPage" ADD COLUMN "defaultConfigs" JSONB;
-- { header?: cfg, hero?: cfg, search?: cfg, footer?: cfg, design?: cfg }
```

**Backend** (`constructor.service.ts`):

- `DEFAULT_HEADER_CONFIG`, `DEFAULT_HERO_CONFIG`, `DEFAULT_SEARCH_CONFIG`,
  `DEFAULT_FOOTER_CONFIG`, `DEFAULT_DESIGN_CONFIG` — built-in дефолты, идентичные
  дефолтам фронтовых табов (тексты Hero — канонические i18n-строки из §2);
- `getDefaultConfig(slug, tab)` → effective default (stored override ?? built-in) + `isCustom`;
- `setDefaultConfig(slug, tab, config)` → persist override; **пустой config `{}` сбрасывает
  override на built-in**;
- `restoreDefaultConfig(slug, tab)` → записывает effective default в рабочую конфигурацию вкладки
  через существующие save-методы (новый draft-версионный путь, status → DRAFT) + audit-log
  (`restore_default`, `set_default`).

**Endpoints** (все под `@RequirePermissions("catalog.product.read")` — тот же permission, что и
у остальных constructor config endpoint'ов):

```text
GET  /api/v1/constructor/pages/:slug/default/:tab            → { tab, config, isCustom }
PUT  /api/v1/constructor/pages/:slug/default/:tab            → set default ({} = reset to built-in)
POST /api/v1/constructor/pages/:slug/default/:tab/restore    → restore (новый draft, без публикации)
```

## 9. Вкладки с Default controls

Общий компонент `DefaultConfigActions` (две кнопки + подтверждение) добавлен на 5 вкладок с
редактируемой конфигурацией:

```text
Branding / Header   → tab="header"
Hero / Баннеры      → tab="hero"     (все слайды, изображения, тексты, CTA, carousel)
Поиск               → tab="search"   (сервисы, порядок, default service)
Подвал              → tab="footer"   (бренд, описание, контакты, copyright)
Дизайн              → tab="design"   (typography, colors, spacing, components)
```

Не добавлялись искусственно: **Структура** (порядок/видимость блоков — это draft-sections,
не page-config: restore к дефолтной структуре бессмыслен без отдельного решения) и **Контент**
(редакторы блоков не имеют собственной default-семантики).

## 10. Restore Default semantics

```text
Кнопка «Восстановить по умолчанию»
→ window.confirm (неразрушающее предупреждение с указанием, что публикация отдельна)
→ POST .../default/:tab/restore
→ effective default (custom override ?? built-in) записывается в рабочую конфигурацию вкладки
→ создаётся НОВЫЙ draft (draftVersion+1, status → DRAFT)
→ Published НЕ меняется
→ UI: onSaved() → refresh() — таб перезагружает конфигурацию из API
```

Restore возвращает ВСЮ конфигурацию вкладки (Hero: слайды + изображения + порядок + тексты +
CTA + carousel), а не только тексты.

## 11. Make Current Default semantics

```text
Кнопка «Сделать текущим состоянием по умолчанию»
→ PUT .../default/:tab  { config: <текущее состояние редактора вкладки> }
→ состояние сохраняется как default override (defaultConfigs[tab])
→ Draft и Published НЕ затрагиваются
→ последующий «Восстановить по умолчанию» возвращает именно это состояние
```

## 12. Default / Draft / Published — разделение

```text
Default      defaultConfigs JSONB + built-in константы. Не рендерится публично.
Draft        рабочая конфигурация вкладок на записи ConstructorPage (+draftVersion sections).
Published    снапшот ConstructorPageVersion (read getPublished → public renderer).

Restore      Default → Draft   (новый draft, публикация вручную)
MakeDefault  Draft(редактор) → Default
Publish      Draft → Published (существующий механизм, не изменялся)
```

Ни одна Default-операция не вызывает Publish автоматически. Автопубликации нет ни в одном пути.

## 13. Browser E2E evidence

**Test A — refresh, тексты остаются (RU):**

```text
GET / (hard reload) → h1: «Единая экосистема для путешествий»
                     p: «Отели, туры, экскурсии, трансферы…»
После hydration тексты сохраняются; carousel next → «TravelHub Storefront Создайте свою витрину».
Console: без runtime errors (только HMR/Fast Refresh логи dev-сервера).
Published API v70: ru/az/en все три локали заполнены каноническими текстами.
Скриншот: hero с user-uploaded изображением (constructor-media) + «Единая экосистема / для путешествий».
```

**Test B — Restore Default (built-in):**

```text
Constructor → Hero: изменить title → «Единая экосистема EDIT» → Сохранить Hero (200)
→ «Восстановить по умолчанию» → confirm → POST restore → 201
→ поле = «Единая экосистема» (канонический built-in текст) ✓
```

**Test C — Make Current Default → Restore:**

```text
1. «Сделать текущим состоянием по умолчанию» (title = «Единая экосистема EDIT») → 200, isCustom=true
2. Изменить title на «ПРОВЕРКА ВОССТАНОВЛЕНИЯ»
3. «Восстановить по умолчанию» → confirm → 201
4. Поле = «Единая экосистема EDIT» — ровно состояние из шага 1 ✓
   (GET default/hero: isCustom: true, slide1.title.ru: "Единая экосистема EDIT")
```

**Test D — isolation (Default ops не публикуют):**

```text
После каждого restore/set-default (в т.ч. трёх подряд в browser-сессии):
GET /published (без auth) → slide1.title.ru = "" (прежнее published-состояние, без изменений)
Итоговая публикация выполнена ЯВНЫМ POST /publish → v70.
```

**Финальное состояние (v70):** канонические тексты RU/AZ/EN + user-uploaded hero image
(1956×804 PNG, media pipeline) на slide 1, `/hero2.png`/`/hero3.png` на слайдах 2–3.

## 14. Network / Console evidence

```text
POST /api/v1/constructor/pages/marketplace-home/default/hero/restore → 201 (×3, каждый → 200 GET page)
GET  /api/v1/constructor/pages/marketplace-home                      → 200 (refresh после restore)
GET  /api/v1/constructor/blocks/marketplace                          → 200
PUT  /api/v1/constructor/pages/marketplace-home/hero                 → 200
POST /api/v1/constructor/pages/marketplace-home/publish              → 201/400(nothing-to-publish)
Console: hydration mismatch отсутствует; runtime errors отсутствуют.
```

## 15. Tests / Build

```text
backend tsc --noEmit   PASS
frontend tsc --noEmit  PASS
backend jest (auth|security)   13/13 PASS
frontend vitest i18n.spec      8/9 PASS, 1 FAIL — formatPrice NBSP (pre-existing,
                               задокументирован в UI-C17 qualification; не связан с Hero/Default)
next build             Compiled successfully; prerender /search FAIL — pre-existing
                       (Suspense/useSearchParams, внесён fbb707a; в предыдущем P0-отчёте;
                        наши изменения /search не затрагивают — проверено git diff)
```

## 16. Pre-existing failures

```text
1. vitest i18n formatPrice NBSP  — ICU/U+00A0 vs узкий NBSP; известен до этих работ.
2. next build /search prerender  — нужен <Suspense> вокруг useSearchParams; внесён fbb707a.
Оба вне scope данного prompt'а; изменения этой задачи их не создают и не маскируют.
```

## 17. Security / Tenant verification

```text
Default endpoints под @RequirePermissions("catalog.product.read") — как все constructor config API;
Public endpoint только GET published (без default-конфигов) — default-слой наружу не отдаётся;
defaultConfigs хранится на ConstructorPage (slug-уникальность) — cross-tenant доступ отсутствует;
Audit: set_default / restore_default пишутся в ConstructorPageAuditLog;
Медиа-references в default не подменяются: restore ссылается только на существующие
/media-URL или статические /hero*.png; media pipeline не затронут.
```

## 18. Git status

```text
Изменённые файлы:        11 modified + 2 new (DefaultConfigActions.tsx, migration)
Working tree до работ:   чистый (1763fbd, HEAD == origin/master)
Untracked temp-скрипты:  pre-existing, не затронуты; созданные задачей удалены после E2E
```

## 19. Commit SHA

```text
COMMIT:  см. финальный git log (закрытие отдельным focused commit)
PUSH:    origin/master
```

## 20. Final Verdict

```text
VERDICT: ЗАВЕРШЕНО

[✓] Старые Hero-тексты найдены (i18n.tsx marketplace.hero_*), восстановлены дословно RU/AZ/EN
[✓] Root cause flash→disappear устранён (текст-фолбэк на уровне слайда)
[✓] Default-слой реализован (migration + 3 endpoint'а + built-in константы)
[✓] Restore/Make Default на 5 вкладках, с confirm, изолированы от Published
[✓] Browser E2E A/B/C/D пройдены, скриншот-подтверждение
[✓] Регрессия: TSC ×2 PASS, jest 13/13, vitest 8/9 (1 pre-existing), build (1 pre-existing)
```
