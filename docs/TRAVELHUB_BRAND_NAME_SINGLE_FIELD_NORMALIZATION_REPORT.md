# TRAVELHUB — F1 BRAND NAME SINGLE-FIELD NORMALIZATION — ОТЧЁТ

## 1. Git Baseline

```text
Repository:  https://github.com/seldom733-hash/travelhub1 (master)
Baseline:    cccc477fec3cb58678fe57f1e743242eaefe3a1f (HEAD == origin/master)
Работа от:   docs/TRAVELHUB_CONSTRUCTOR_CURRENT_STATE_VERIFICATION_REPORT.md (F1 = FAIL → TRUE NEXT)
Working tree до работ: чистый
```

## 2. Исходная модель `companyName`

```json
{ "companyName": { "ru": "Navitravel", "az": "Navitravel", "en": "Navitravel" } }
```

UI: три инпута ru/az/en (`ConstructorHeaderTab.tsx:104-120` — подтверждено verification report).
Render: `MarketplaceHeader.tsx:76` — `cfg.companyName?.[locale] || cfg.companyName?.ru || "TravelHub"`.
Backend default: `DEFAULT_HEADER_CONFIG.companyName = {ru:"TravelHub", az:..., en:...}`.

## 3. Новая canonical model

```json
{ "brandName": "Navitravel" }
```

Brand Name — единое значение, не является локализуемым интерфейсным текстом.
`companyName` сохранён как **@deprecated read-only fallback** — старые Draft/Published records
читаются без миграции и не ломаются.

## 4. UI changes

`ConstructorHeaderTab.tsx`:

```text
«Название бренда» — ОДИН инпут (canonical write: brandName: string)
hint: «Единое значение для всех языков (не переводится).»
RU/AZ/EN inputs для Brand Name — УДАЛЕНЫ (браузер-verify: ruAzEnLabels = 0)
```

Инициализация: `config.brandName?.trim() || normalizeLegacyCompanyName(config.companyName) || "TravelHub"`
— legacy-записи подхватываются автоматически при первом открытии.

i18n: `constructor.header_brand_name`, `constructor.header_brand_name_hint` (RU/AZ/EN).

## 5. Backend/config changes

`constructor.service.ts`:

```text
DEFAULT_HEADER_CONFIG = { logo: null, brandName: "TravelHub", phone: "", email: "", address: "", navVisible: true }
+ export function normalizeLegacyCompanyName(record): ru → az → en (trim, empty-safe) → undefined
```

Default mechanism не изменялся: brandName входит в полный Header default (Logo/Brand/Phone/Email/
Address/Navigation); Restore/Make Current Default работают через существующие endpoints.

## 6. Migration / normalization logic

SQL-миграция не требуется (JSON-конфиг). Правило нормализации (единое на фронте и бэкенде):

```text
brandName = trim(ru) || trim(az) || trim(en) || "TravelHub"
```

Живая нормализация выполнена до публикации:

```text
Страница:   companyName {ru:"Navitravel",...} → brandName: "Navitravel"   (canonical записан,
            legacy сохранён рядом — ничего не удалено)
default/header override: отсутствовал (isCustom:false) — built-in default теперь brandName.
```

Случаи с разными непустыми ru/az/en в БД: не обнаружены (все три локали = "Navitravel").

## 7. Backward compatibility

```text
Новый формат   { brandName: "Navitravel" }              → читается напрямую
Старый формат  { companyName: {ru,az,en} }              → normalizeLegacyCompanyName → ru→az→en
Оба формата    { brandName, companyName }               → brandName приоритетен
Пустые значения (empty/whitespace)                      → пропускаются по приоритету
"TravelHub"                                             → финальный fallback
```

Старые Draft/Published records не переписывались и остаются читаемыми.

## 8. Marketplace rendering

`MarketplaceHeader.tsx`:

```text
+ export function resolveBrandName(cfg): brandName → legacy(ru→az→en) → "TravelHub"
- const companyName = cfg.companyName?.[locale] || ...
+ const companyName = resolveBrandName(cfg);   // locale-INDEPENDENT
DEFAULT_HEADER_CONFIG (компонента): brandName: "TravelHub"
```

Brand Name больше не зависит от locale. Локализуемые nav labels и прочие UI-тексты работают
по-прежнему (проверено: `navSample` меняется по локали, brand — нет).

## 9. Default integration

```text
Restore Default (Header)     → brandName = "TravelHub" (built-in canonical default) — browser PASS
Make Current Default (Header) → brandName сохраняется в defaultConfigs.header — browser PASS
Default не смешан с Published: обе операции не публикуют (проверено ранее + в этом run)
Отдельного механизма для Brand Name НЕ создавалось — общий DefaultConfigActions.
```

## 10. Save / Publish verification

```text
Edit Brand Name («Navitravel TEST») → Сохранить Header (PUT /header → 200)
→ reload Constructor → поле = «Navitravel TEST»  ✓
→ Сохранить черновик (draft bump) → Опубликовать (POST /publish → 201, v86)
→ Marketplace hard refresh → header brand = «Navitravel TEST»  ✓
```

## 11. Locale verification

```text
RU: brand = «Navitravel TEST» (locale: ru)
AZ: brand = «Navitravel TEST» (locale: az, nav: «İstiqamətlər/Xidmətlər/Təkliflər» — локализованы)
EN: brand = «Navitravel TEST» (locale: en, nav: Discover more together…)
Brand Name идентичен во всех трёх локалях ✓
```

## 12. Browser E2E evidence

```text
A — UI:        Header/Branding: heading «Название бренда», ОДИН инпут, ruAzEnLabels=0          PASS
B — Edit/Save: «Navitravel TEST» → save → reload → «Navitravel TEST»                            PASS
C — Publish:   Save Draft → Publish 201 (v86) → Marketplace hard refresh → «Navitravel TEST»    PASS
D — Locale:    RU→AZ→EN: brand const, nav labels локализуются                                   PASS
E — Restore:   restore (confirm) → «TravelHub» (built-in default)                               PASS
F — MakeDef:   «TravelHUB CUSTOM DEFAULT» → Make Current Default → изменить на
               «ПОМЕНЯНО ДЛЯ ПРОВЕРКИ» → Restore → «TravelHUB CUSTOM DEFAULT»                   PASS
```

Cleanup после E2E: default override сброшен на built-in; бренд пользователя «Navitravel»
восстановлен и опубликован (v87); Hero-тексты не тронуты (slide1 «Единая экосистема» подтверждён).

## 13. Network / Console evidence

```text
GET  /api/v1/constructor/pages/marketplace-home              → 200
PUT  /api/v1/constructor/pages/marketplace-home/header       → 200 (payload содержит brandName)
PUT  /api/v1/constructor/pages/marketplace-home/sections     → 200 (Save Draft)
POST /api/v1/constructor/pages/marketplace-home/publish      → 201 (v86, v87)
GET  /api/v1/constructor/pages/marketplace-home/published    → 200: v86 brandName «Navitravel TEST»;
                                                               v87 brandName «Navitravel»
PUT/POST .../default/header (+restore)                       → 200/201
Console: 0 runtime errors, hydration mismatch отсутствует, неожиданного legacy overwrite нет
```

## 14. Tests / Build

```text
backend tsc --noEmit    PASS (0)
frontend tsc --noEmit   PASS (0)
backend jest (auth|security)  13/13 PASS
frontend vitest i18n    1 failed / 8 passed — formatPrice NBSP (pre-existing, не связан)
```

## 15. Pre-existing failures

```text
1. vitest i18n formatPrice NBSP — существовал до F1; F1 его не ухудшил и не исправлял (вне scope).
2. /search build failure (fbb707a) — не перепроверялся в этом run (не затронут изменениями F1;
   изменения касаются только Header-конфигурации).
```

## 16. Changed files

```text
frontend/components/constructor/ConstructorHeaderTab.tsx   — single Brand Name field, legacy read, canonical write
frontend/components/marketplace/MarketplaceHeader.tsx      — resolveBrandName(), canonical model, locale-independent render
backend/src/modules/constructor/constructor.service.ts     — DEFAULT_HEADER_CONFIG.brandName + normalizeLegacyCompanyName
frontend/lib/i18n.tsx                                      — +2 ключа (header_brand_name, header_brand_name_hint)
```

## 17. Security / tenant verification

```text
Изменения — presentation-layer конфигурации; auth/RBAC/tenant isolation не затронуты:
Header endpoints по-прежнему под @RequirePermissions("catalog.product.read");
published API — public read-only, default endpoints — auth-only (как были);
normalizeLegacyCompanyName работает с уже авторизованным payload, без прямого DB-доступа с клиента.
```

## 18. Final Verdict F1

```text
F1 = CLOSED

[✓] Constructor Header: одно поле Brand Name; RU/AZ/EN inputs удалены
[✓] Canonical format { brandName } используется в UI/defaults; legacy {ru,az,en} читается
[✓] Нормализация без потери данных (legacy сохранён рядом; brand = ru→az→en→"TravelHub")
[✓] Marketplace рендерит brandName; brand не переключается при смене локали
[✓] Save → reload → Publish → hard refresh — brand сохраняется (v86/v87)
[✓] Restore Default / Make Current Default работают с Brand Name; Default ≠ Published
[✓] Browser E2E A–F PASS; Hero и остальные PASS-области не тронуты
[✓] Тесты/build: новых регрессий нет
```

## 19. Git Status

```text
Изменения зафиксированы focused commit'ом; push → origin/master; HEAD == origin.
```

## 20. Commit SHA

```text
COMMIT: см. git log -1 (fix(constructor): F1 brand name single-field normalization…)
PUSH:   origin/master
```
