# TRAVELHUB — CONSTRUCTOR CURRENT STATE VERIFICATION + NEXT-STEP AUDIT — ОТЧЁТ

## 1. Git Baseline

```text
Repository:  https://github.com/seldom733-hash/travelhub1 (master)
HEAD:        e38668d7fd1c429a24277c50e0dac8b2a5775bf0
ORIGIN:      e38668d7fd1c429a24277c50e0dac8b2a5775bf0  (HEAD == origin/master)
Последние:   e38668d feat(constructor): restore canonical Hero texts + per-tab Default layer
             1763fbd fix(constructor): media upload FormData
             63f45c0 fix(constructor): P0 remediation (published configs → renderer)
Working tree: ЧИСТЫЙ (0 изменённых файлов; только pre-existing untracked-скрипты)
```

## 2. Выполненные проверки

Browser E2E (реальный UI через Preview): hard refresh Marketplace ×3, вкладки Constructor
(Branding/Header, Hero, Search, Контент, Подвал, Дизайн, Структура), Save Hero → reload,
Save Draft → Publish → published API, Default/Restore API-verification + ранее задокументированные
browser-сценарии. Network/Console-инспекция. TSC ×2, jest, vitest.

## 3. Branding / Header — результат

### Finding F1 (главный): Brand Name — по-прежнему ТРИ поля RU/AZ/EN

Фактическое состояние UI (`ConstructorHeaderTab.tsx:104-120`):

```text
«Название компании» → три инпута с лейблами ru / az / en
companyName: Record<string,string> ({ru, az, en})
```

Ожидаемая модель «Brand Name = ОДНО поле» **не реализована**. Это последнее изменение из
краткого списка пользователя, которое ещё не сделано.

Backward-compat цепочка работает корректно:

```text
MarketplaceHeader.tsx:76
  const companyName = (cfg.companyName?.[locale] || cfg.companyName?.ru || "TravelHub").trim();
→ Marketplace показывает «TravelHUB» (значение .ru) — фактический браузер-verify
```

**Не менять данные без normalization**:published v78 содержит `companyName: {ru:"TravelHUB", ...}` —
при переводе на одно поле потребуется безопасная миграция (single value ← ru ?? first non-empty).

Дополнительно зафиксировано: i18n-ключи `constructor.default_restored` / `default_saved`
добавлены, но `DefaultConfigActions` пока не показывает after-action уведомление (только confirm
перед restore). Мелкий UX-gap, не блокер.

## 4. Hero — результат

### Hero texts: PASS

Published v78 (проверено через public API + браузер):

```text
slide1: «Единая экосистема» / «для путешествий» + user-uploaded image (constructor-media, 1956×804)
slide2: «Для партнёров» / «Развивайте бизнес» (/hero2.png)
slide3: «TravelHub Storefront» / «Создайте свою витрину» (/hero3.png)
CTA: /search на всех слайдах; ctaLabel = канонические описания RU/AZ/EN
```

Точные старые тексты и источник (зафиксированы в предыдущем отчёте, подтверждены):
`frontend/lib/i18n.tsx`, ключи `marketplace.hero_title_1|2`, `marketplace.hero_description`,
`marketplace.hero_slide_2_*`, `marketplace.hero_slide_3_*` — продублированы в backend
`DEFAULT_HERO_CONFIG` (constructor.service.ts).

### Hero hydration: PASS (симптом исчезновения отсутствует)

Сценарий ×3: `reload → h1 immediate → h1 after hydration`:

```text
reload #1: immediate «TravelHub Storefront…» (autoplay уже на слайде 3) → после hydration тексты остаются
reload #2: immediate «Единая экосистема…» → осталось «Единая экосистема…» + description «Отели, туры…»
reload #3: immediate «TravelHub Storefront…» → 7.5s спустя autoplay вернулся на slide1: «Единая экосистема…»
```

Disappearance между immediate и after-hydration **ни разу не воспроизведён**: текст теперь
стабилен (фикс `buildConfiguredSlides` — textless slide → canonical i18n copy). Появление текстов
в initial HTML с последующей перезаписью отсутствует: initial render = тот же фолбэк-текст,
published config содержит теперь непустые строки. Console: чисто (только HMR-логи dev).

### Hero config: тексты в slide-конфигурации — PASS

Hero Title/Subtitle/CTA хранятся в `heroConfig.slides[]` (RU/AZ/EN + ctaUrl + imageUrl +
imageMeta + порядок) — подтверждено published API v78 и формами Hero-таба (9 текстовых инпутов:
3 слайда × ru/az/en). React-fallback (SLIDES/i18n) — только резервный путь при config=null или
textless slide. Carousel settings (autoplay/interval/arrows/indicators) — в конфигурации.

## 5. Default / Restore Default / Make Current Default — результат

Фактическая реализация (e38668d):

```text
Backend:  defaultConfigs JSONB + DEFAULT_*_CONFIG (5 вкладок) +
          GET/PUT /pages/:slug/default/:tab + POST /pages/:slug/default/:tab/restore
UI:       DefaultConfigActions на 5 вкладках: Header, Hero, Search, Footer, Design
          (Восстановить по умолчанию [с confirm] + Сделать текущим состоянием по умолчанию)
```

Применимость: Структура/Контент — без кнопок (architecturally meaningless: sections — draft-данные,
не page-config). Это соответствует критерию «не требовать кнопки там, где бессмысленны».

### Restore Default: PASS

```text
API: POST .../default/hero/restore → 201, working slide1.title.ru = канонический текст
Browser (пред. run + подтверждено): «Единая экосистема EDIT» → Restore → «Единая экосистема»
```

### Make Current Default: PASS

```text
API: PUT .../default/hero {config} → isCustom:true; GET → возвращает сохранённое
Browser (пред. run): «…EDIT» → Make Default → изменить на «ПРОВЕРКА ВОССТАНОВЛЕНИЯ»
                     → Restore → вернулось ровно «…EDIT»
Текущее состояние: isCustom=true со slide1.title.ru «Единая экосистема1» (остаток
пользовательских экспериментов в default-override — не влияет на Published)
```

### Изоляция Default-операций от Published: PASS

```text
restore ×N → GET /published: без изменений до явного POST /publish (проверено)
```

## 6. Structure vs Content — результат: PASS

Вкладки физически разные (браузер-verify):

```text
Структура:  heading «Canvas (10)», 16 строк списка блоков, 0 <pre> — только порядок/видимость/
            add/remove. Нет редакторов контента.
Контент:    10 раскрывающихся блок-редакторов («Hero-баннер hero ▼» …). Expand «Hero-баннер» →
            «Параметры блока» (settings JSON), «Источник данных», «Локализованное содержимое»,
            «Стиль». Нет Canvas-heading.
```

Два одинаковых Canvas отсутствуют. Content — per-block редактор (settings/dataSource/
localeContent/style viewer + updateSection), Structure — block list. (Ограничение: Content
редактирует section-уровень; Hero-тексты редактируются на вкладке Hero — это осознанное
разделение page-config vs section-config.)

## 7. Save / Publish regression — результат: PASS

```text
Browser: Hero title → «Единая экосистема VERIFY» → Сохранить Hero (PUT /hero → 200)
         → reload Constructor → поле = «Единая экосистема VERIFY»  ✓ (draft persistence)
Network: POST /publish → 201; published API: v77 = «Единая экосистема VERIFY»  ✓
```

### Finding F2 (не блокер, semantics): Publish disabled после save-config без Save Draft

```text
draftVersion == currentVersion → POST /publish → 400 "Nothing to publish"
Publish-кнопка disabled, пока не нажат «Сохранить черновик» (bump draftVersion 77→78 → 201)
```

Это существующая versioning-архитектура (publish публикует version snapshot, а не live-конфиг).
Поведение согласованное, но пользователь должен знать: после правки Hero нужно нажать
«Сохранить черновик» перед «Опубликовать». Не регресс — задокументировано как UX-семантика.

Финальное состояние: v78 = канонические тексты + user image + brand «TravelHUB».

## 8. Browser evidence (сводка)

```text
Marketplace ×3 hard refresh  → тексты стабильны, autoplay циклит 3 слайда, console чист
published API v78            → slide1 канон + userImg:true, brand TravelHUB
Constructor Hero-таб         → 9 локализованных инпутов заполнены каноническими текстами
Сохранить Hero → reload      → значение сохранилось
Save Draft → Publish         → 201, v78
Default buttons              → присутствуют на 5 вкладках
```

## 9. Network / Console evidence

```text
GET  /api/v1/constructor/pages/marketplace-home            → 200 (Constructor)
GET  /api/v1/constructor/blocks/marketplace                → 200
PUT  /api/v1/constructor/pages/marketplace-home/hero       → 200 (Save Hero)
PUT  /api/v1/constructor/pages/marketplace-home/sections   → 200 (Save Draft, 77→78)
POST /api/v1/constructor/pages/marketplace-home/publish    → 201 (v78)
GET  /api/v1/constructor/pages/marketplace-home/published  → 200 (public, v78)
GET  media: constructor-media → 302 → signed MinIO URL → 200 (image/png)
Console: 0 errors; hydration mismatch отсутствует
```

## 10. Tests / Build

```text
backend tsc --noEmit    PASS
frontend tsc --noEmit   PASS
backend jest (auth|security)  13/13 PASS
frontend vitest i18n    8/9 (1 failed = formatPrice NBSP — pre-existing, ICU U+00A0 vs narrow NBSP)
next build              /search prerender FAIL — pre-existing (fbb707a, задокументирован)
Constructor-spec тестов в backend нет (91 spec, 0 constructor) — coverage gap, см. next step
```

## 11. Pre-existing failures

```text
1. vitest i18n formatPrice NBSP — известен, вне scope
2. next build /search Suspense   — известен, вне scope
Оба не созданы данной проверкой; regression-статус не изменён.
```

## 12. Findings

```text
F1  Brand Name: UI всё ещё показывает 3 поля RU/AZ/EN (ожидание: одно поле).
    Backward-compat рендер работает (Marketplace берёт .ru). Требует:
    UI single-field + миграция companyName{ru,az,en} → single value + рендер-путь.
    → это и есть TRUE NEXT.
F2  Publish-семантика: page-config save (hero/header/...) НЕ поднимает draftVersion;
    для публикации нужен «Сохранить черновик». Согласованно, но стоит унифицировать
    (config-save должен bump'ать draftVersion) — UX-улучшение, не блокер.
F3  constructor.default_restored/default_saved i18n-ключи существуют, но после-action
    уведомление в DefaultConfigActions не показывается. Мелкий UX-gap.
F4  Backend: 0 constructor spec-тестов (registry/publish/default endpoints не покрыты).
```

## 13. TRUE NEXT IMPLEMENTATION STEP

**Единственный следующий шаг (без нового Phase/D-number):**

```text
BRAND NAME SINGLE-FIELD NORMALIZATION
1. ConstructorHeaderTab: Brand Name = одно поле (string)
2. Миграция данных: companyName {ru,az,en} → single value (ru ?? first non-empty ?? "TravelHub"),
   с сохранением backward-compat чтения (MarketplaceHeader принимает и string, и record)
3. Marketplace/рендер и default (DEFAULT_HEADER_CONFIG) — обновить на single value
4. Browser E2E: edit → save → publish → marketplace hard refresh → brand виден
```

Это закрывает последний явный пункт ожиданий пользователя; F2–F4 — последующие (не смешивать).

## 14. Git Status

```text
Working tree: CLEAN (проверка без изменений production-кода)
HEAD == origin/master: e38668d
Отчёт добавлен отдельным documentation commit (см. §15)
```

## 15. Commit SHA

```text
COMMIT: docs-only commit с данным отчётом (SHA в git log)
PUSH:   origin/master
```

## 16. Итоговая таблица

| Область | Статус | Evidence |
|---|---|---|
| Branding / Brand Name | **FAIL** (3 поля RU/AZ/EN вместо одного) | ConstructorHeaderTab.tsx:104-120; browser: 3 инпута ru/az/en; Marketplace корректно показывает .ru «TravelHUB» |
| Hero texts | **PASS** | published v78: канонические тексты RU/AZ/EN ×3 слайда; источник i18n.tsx marketplace.hero_* |
| Hero hydration | **PASS** | 3× hard refresh: тексты стабильны, console чист, flash/disappear не воспроизводится |
| Hero Default | **PASS** | DEFAULT_HERO_CONFIG = канонические тексты + slides/carousel; restore возвращает оригиналы |
| Restore Default | **PASS** | API 201 → canonical в working config; browser-подтверждение в пред. run |
| Make Current Default | **PASS** | PUT → isCustom:true; restore возвращает ровно сохранённое состояние |
| Structure vs Content | **PASS** | Структура: Canvas(10)/block-list; Контент: per-block редакторы (settings/dataSource/localeContent/style) |
| Save / Publish | **PASS** | Save Hero → reload сохранил; Save Draft → Publish 201 → v78 в published API (F2: см. семантику) |
