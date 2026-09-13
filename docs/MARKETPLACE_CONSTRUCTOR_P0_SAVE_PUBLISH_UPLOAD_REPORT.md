# TRAVELHUB — CONSTRUCTOR P0 REMEDIATION REPORT
## SAVE / PUBLISH + HERO IMAGE UPLOAD

> **Дата:** 13.09.2026
> **Repository:** `seldom733-hash/travelhub1`, branch `master`
> **Baseline HEAD:** `1ec98837eaca453598a836b9b0224513c417d10b`
> **Prompt:** `docs/prompts/TRAVELHUB_CONSTRUCTOR_P0_SAVE_PUBLISH_HERO_UPLOAD.md`

---

## 1. Initial Symptoms

1. **P0-A:** кнопка «Опубликовать» активна, но изменения Constructor не отображаются на публичной Marketplace после публикации.
2. **P0-B:** загрузка фото для Hero/Banner Carousel невозможна (HTTP 500 / изображение не отображается).

---

## 2. P0-A — Root Cause

Полный trace цепочки `UI → API → DB → Published API → Renderer → Browser` выявил **две независимые точки потери**:

### 2.1. Renderer игнорировал published конфигурацию (главная причина)

`frontend/app/page.tsx` рендерил **hardcoded** компоненты напрямую:

```tsx
<MarketplaceHeader />   ← без props, все значения захардкожены
<HeroSection />         ← SLIDES const, /hero1.png…
<MarketplaceFooter />   ← hardcoded phone/email/brand
```

`MarketplaceRenderer` существовал, но **не был подключён** к публичной странице, а подключённые компоненты не принимали конфигурацию. Публикация исправно писала данные в DB и отдавала их через `GET /constructor/pages/:slug/published` — но consumer'а не было.

### 2.2. `getPublished` читал page-level конфиги из живой записи (утечка draft)

`ConstructorService.getPublished()` возвращал `headerConfig/heroConfig/searchConfig/footerConfig/designConfig` из `ConstructorPage` (live record). Эти поля вкладки Constructor пишут **сразу при Save** (минуя версии), поэтому несохранённая-как-draft правка header'а **утекала бы** на публичный сайт до Publish.

**Fix:** `getPublished` теперь читает page-level конфиги из **published-снапшота** `ConstructorPageVersion.snapshot` (версия `currentVersion`). Publish уже атомарно снимает полный snapshot — единый источник опубликованного состояния.

## 3. P0-A — Fix

| Файл | Изменение |
|---|---|
| `frontend/app/page.tsx` | Подключён `<MarketplaceRenderer />` вместо hardcoded-разметки |
| `frontend/components/marketplace/MarketplaceRenderer.tsx` | Прокидывает `headerConfig/heroConfig/searchConfig/footerConfig` из published API в компоненты |
| `frontend/components/marketplace/MarketplaceHeader.tsx` | Принимает `config`: logo (upload URL), companyName (RU/AZ/EN по locale), phone, email, address, navVisible; fallback на дефолты |
| `frontend/components/marketplace/HeroSection.tsx` | Принимает `config`: slides (imageUrl + локализованные title/subtitle/CTA), carousel (autoplay/interval/showArrows/showIndicators, bounded 3–15s); fallback на дефолтные SLIDES |
| `frontend/components/marketplace/MarketplaceFooter.tsx` | Принимает `config`: name/description/copyright (RU/AZ/EN), phone, email; fallback на i18n-дефолты |
| `frontend/components/marketplace/SearchBlock.tsx` + `HeroSearch.tsx` | Принимают `enabledServices` (порядок + фильтр) и `defaultService` |
| `backend/.../constructor.service.ts` | `getPublished` — page-level конфиги из published-снапшота |

## 4. P0-A — Evidence

### 4.1. Save + persistence (DB proof)

```
LOGIN: 200
GET PAGE: 200 draft: 51 current: 51
SAVE HEADER: 200 marker: P0E2E-1789257022926
PAGE RECORD companyName.ru: P0E2E-1789257022926 ✅ PERSISTED
SAVE DRAFT: 200 draftVersion: 52
PUBLISH: 201 currentVersion: 52
PUBLISHED companyName.ru: P0E2E-1789257022926 ✅ PUBLISHED CONTAINS NEW VALUE
```

Скрипт: `backend/_p0_e2e.js` (login → save header marker → verify page record → saveDraft → publish → verify published API).

### 4.2. Published snapshot (SQL, после crash-recovery БД)

```
PAGE: {"slug":"marketplace-home","status":"PUBLISHED","currentVersion":57,"draftVersion":57}
PUBLISHED companyName.ru: TravelHUB        ← реальная правка пользователя
PUBLISHED hero slide-1: /api/v1/public/constructor-media?key=constructor%2F…jpeg
PUBLISHED sections: 10
```

Скрипт: `backend/_p0_dbcheck.js` (прямой SQL по `constructor."ConstructorPageVersion"`).

### 4.3. Browser proof

Скриншот после `Publish → reload`:
- Header: **«TravelHUB»** (значение из published конфигурации, не hardcoded «TravelHub»);
- Hero slide 1 — **загруженное изображение** через `constructor-media` URL;
- Network: `GET /api/v1/constructor/pages/marketplace-home/published → 200`, signed MinIO image → 200;
- Console: чисто (только HMR info).

```
edit → save draft → publish → reload public Marketplace → changed UI visible ✅
```

## 5. P0-B — Root Cause

Три слоя:

1. **Environment:** MinIO не был запущен (порт 9000 закрыт) → `putObject` падал → необъяснимый 500. Исправлено запуском MinIO + созданием bucket `travelhub-media` (idempotent bootstrap-скрипт, единоразово).
2. **Неверный media URL:** `uploadMedia` возвращал `/api/v1/public/media/{storageKey}`, но публичный маршрут `/api/v1/public/media/:mediaId/:derivative` обслуживает **только ProductMedia записи** (thumb|large) по mediaId. Constructor-объекты не имеют Media-записи → URL всегда 404 → изображение никогда не отображалось.
3. **Отсутствие error handling:** ошибки image-processing/S3 превращались в сырой 500.

## 6. P0-B — Fix

| Файл | Изменение |
|---|---|
| `backend/.../constructor.controller.ts` | Новый **prefix-less** `ConstructorPublicMediaController`: `GET /api/v1/public/constructor-media?key=…` (`@Public()`), 302 → short-lived signed URL приватного bucket (300s). Та же delivery-стратегия, что `/public/media/:mediaId/:derivative`. Защита: `key` обязан начинаться с `constructor/`, `..` запрещён |
| `backend/.../constructor.service.ts` | `uploadMedia` возвращает `url` (новый формат) + `storageKey`; try/catch вокруг `processImage` и `putObject` → `BadRequestException` (400, а не 500); добавлены `storageKeyExists()` / `getMediaReadUrl()` |
| `backend/.../constructor.module.ts` | Зарегистрирован `ConstructorPublicMediaController` |

Не создан второй upload/storage pipeline — используется существующий `S3ObjectStorageService` + `MediaProcessor` из catalog/media.

## 7. P0-B — Evidence

### 7.1. Upload E2E (реальный JPEG 1400×500)

```
LOGIN: 200
UPLOAD: 201 {"url":"/api/v1/public/constructor-media?key=constructor%2Fmarketplace-home%2Fhero-slide%2F…-7cos8v.jpeg",
             "storageKey":"constructor/marketplace-home/hero-slide/…-7cos8v.jpeg",
             "width":1400,"height":500,"size":4493,"format":"JPEG"}
SAVE HERO: 200
PUBLISH: 201 currentVersion: 57
PUBLISHED slide-1 image: /api/v1/public/constructor-media?key=…   USES UPLOADED URL: YES
MEDIA URL STATUS: 302
SIGNED URL host: localhost:9000
SIGNED FETCH: 200 image/jpeg 4493 bytes
JPEG MAGIC: VALID
RESULT: P0-B E2E PASS
```

Скрипт: `backend/_p0_upload_e2e2.js`; результат сохранён в `backend/_p0_upload_result.txt`.

### 7.2. Media pipeline chain (проверено)

```
multipart upload → FileInterceptor(10MB) → RBAC (catalog.product.read)
→ MIME whitelist (jpeg/png/webp) → size ≤ 10MB → processImage (dimensions)
→ hero-slide: ≥1200×400 → S3 putObject (private bucket)
→ stable storageKey в heroConfig (НЕ base64/blob)
→ publish → snapshot
→ public renderer <img src="/api/v1/public/constructor-media?key=…">
→ 302 signed URL → 200 image/jpeg ✅
```

Через frontend-прокси: `302 → 200 (image/jpeg, 4493 bytes)`.

### 7.3. Image validation

- MIME вне whitelist → 400 с указанием допустимых типов;
- >10MB → 400;
- hero-slide < 1200×400 → 400 с фактическими размерами;
- все validation-ответы — структурированный 400, не 500.

## 8. Combined E2E

Скриптом `backend/_p0_upload_e2e2.js` выполнен полный сценарий:
`upload image → set heroConfig slide-1 → save hero → saveDraft → publish → GET published → verify URL == uploaded → fetch media (302→200, JPEG magic)`. **PASS** (см. §7.1). Save/Publish-маркер (§4.1) — тот же шаблон. Browser-подтверждение — §4.3.

## 9. Structure vs Content (P1)

Подтверждено: Content tab рендерит `ConstructorContentTab` (per-block редакторы настроек/локализации, expand/collapse), Structure tab — `ConstructorBlockList` (order/visibility/DnD). Вкладки разделены ранее в этой remediation-серии; дефект «одинаковый Canvas» устранён.

## 10. Security Verification

- Все mutating endpoints: `@RequirePermissions("catalog.product.read")` + auth cookie;
- `getPublished` и `constructor-media` — единственные `@Public()` read-only маршруты;
- media key: whitelist-префикс `constructor/`, traversal (`..`) отклоняется 404;
- приватный bucket: наружу только 300s signed URL (никогда ключ);
- tenant scope: marketplace-page — singleton по slug, owner-проверки сохранены.

## 11. Tests / Build

| Проверка | Результат |
|---|---|
| Backend `tsc --noEmit` | **PASS** |
| Frontend `tsc --noEmit` | **PASS** |
| Backend jest `catalog/public` | **21/21 PASS** |
| Backend constructor specs | отсутствуют (0 spec-файлов в модуле; покрытие через E2E-скрипты) |
| Frontend `next build` | **FAIL — pre-existing**: `/search` `useSearchParams()` без Suspense boundary; `/search` не изменялся данным remediation (`git diff HEAD -- frontend/app/search/` пуст); деградация внесена коммитом `fbb707a` задолго до P0 |

## 12. Remaining Limitations

1. **`next build` /search** — pre-existing failure, вне scope P0 (требует отдельного микро-фикса Suspense).
2. **Draft-reloад вкладок Header/Hero/Footer** — конфиги живут в page record; после Save они корректно возвращаются через `getPage`, но не версионируются отдельно от publish-снапшота (документированная модель V1).
3. **`/hero2.png` mirror-класс** (`scale-x-[-1]`) применяется только к дефолтному ассету по URL-совпадению.
4. **Е2Е-скрипты** лежат в `backend/_p0_*.{js,jpg,txt}` — untracked, добавлены в commit как evidence.

## 13. Git Status

- **Baseline:** `1ec98837eaca453598a836b9b0224513c417d10b` (== origin/master)
- **Changed files (14):** см. §3/§6 таблицы + `frontend/public/hero.png` (удалён, заменён на hero1–3) + `backend/src/seed/demo-seed.ts` (`referenceNumber` для detector-triggers — требуется текущей схемой, предзаполнение падало без него)
- **Commit:** см. финальный SHA в commit message.
- **Environment:** PostgreSQL 18 (crash-recovery после жёсткого kill, WAL replay — данные целы), MinIO на :9000, bucket `travelhub-media`.

---

## FINAL VERDICT

```text
P0-A SAVE/PUBLISH:   CLOSED ✅ (marker E2E + SQL snapshot + browser screenshot)
P0-B HERO UPLOAD:    CLOSED ✅ (real JPEG → S3 → 302 → 200 + published + browser)
COMBINED E2E:        PASS ✅
STRUCTURE vs CONTENT: SEPARATED ✅
TESTS/TSC:           PASS (build /search — pre-existing, вне scope)
```
