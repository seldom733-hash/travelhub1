# TRAVELHUB — Partner Cabinet Form Text Contrast Fix Report

**Date:** 2026-09-14
**Status:** ✅ PASS
**Branch:** `master`

---

## 1. Итог

Исправлен системный дефект контраста текста в Partner Cabinet (`/partner/*`): введённые пользователем значения во всех полях форм (input, textarea, select, динамические поля Category Schema, тарифы, медиа) теперь отображаются тёмным цветом (`text-slate-900` = `#0f172a`) на светлом фоне, placeholders — приглушённым серым (`text-slate-400` = `#94a3b8`). Исправление выполнено на уровне корня `PartnerLayout` (системно, для всего кабинета) + canonical placeholder-классы в shared-компонентах форм. Dark Marketplace не затронут.

## 2. Root Cause

`frontend/app/globals.css`:

```css
:root { color-scheme: dark; }
body { color: var(--th-text, #e8e8e8); }   /* светлый текст для тёмной витрины */
```

Tailwind preflight делает form controls (`input/select/textarea`) наследующими `color`. Partner Cabinet (`/partner/*`) — светлая тема (`bg-slate-50`/`bg-white`), но **нигде не задаёт явный цвет текста** → все поля форм наследовали почти белый `#e8e8e8` от body → белый текст на белом фоне = нечитаемо.

Дополнительно `color-scheme: dark` в корне документа заставляла нативные контролы (date/time pickers, select dropdown) рендериться в тёмной палитре внутри светлого кабинета.

Прошлый аналогичный фикс (report `TRAVELHUB_PARTNER_REGISTRATION_INPUT_TEXT_CONTRAST_FIX_REPORT.md`) правил цвет **по-полю на каждой странице** — дефект воспроизводился в каждой новой форме кабинета, потому что корневая причина (наследование от body на светлом контуре) не была устранена.

## 3. Scope

| Затронуто | Детали |
|---|---|
| `/partner/products/new` | Basic Info (title/category/description), динамические поля Category Schema (10 полей при выборе категории), Tariffs, Traveler Requirements |
| `/partner/products/[id]/edit` | тот же shared `ProductEditorForm` |
| `/partner/products` | поиск + фильтры (`PartnerProductsList`) |
| `/partner/products/[id]` | MediaManager (alt-text поля) |
| `/partner`, `/partner/seller-profile`, `/partner/storefront`, `/partner/customers` | наследуют системный фикс от layout |

Не затронуто: Marketplace/витрина (тёмная тема — `text-white` задан явно на компонентах), `/app/*` (внутренний кабинет — проверка не входила в scope, полей с наследованным цветом там не меняли).

## 4. Изменённые файлы

| File | Change |
|---|---|
| `frontend/app/partner/layout.tsx` | Корень кабинета: `bg-slate-50` → `bg-slate-50 text-slate-900 [color-scheme:light]` + inline `style={{ colorScheme: "light" }}` (Tailwind arbitrary может быть перекрыт специфичностью — дублируем инлайн-стилем) |
| `frontend/components/partner/ProductEditorForm.tsx` | input title, select category, textarea description: + `text-slate-900 placeholder:text-slate-400` |
| `frontend/components/partner/DynamicSchemaForm.tsx` | `inputClass()` (все типы полей схемы: text/number/date/time/enum/textarea): + `text-slate-900 placeholder:text-slate-400` |
| `frontend/components/partner/TariffList.tsx` | 3 input (name/price/currency): + `text-slate-900 placeholder:text-slate-400` |
| `frontend/components/partner/PartnerProductsList.tsx` | search input + 2 select фильтра: + `text-slate-900` (search: + `placeholder:text-slate-400`) |
| `frontend/components/partner/MediaManager.tsx` | alt/caption input: + `text-slate-900 placeholder:text-slate-400` |

## 5. Исправление

**Системный уровень (root cause):**

```tsx
// frontend/app/partner/layout.tsx — корень PartnerLayout
- <div className="flex min-h-screen flex-col bg-slate-50">
+ <div
+   className="flex min-h-screen flex-col bg-slate-50 text-slate-900 [color-scheme:light]"
+   style={{ colorScheme: "light" }}
+ >
```

`text-slate-900` на корне кабинета → каждый form control внутри наследует тёмный цвет через CSS inheritance (тот же механизм, который раньше приносил `#e8e8e8` от body). `color-scheme: light` скоупится на кабинет и не влияет на `:root` документа → нативные контролы рендерятся светло-тематно внутри кабинета, тёмная витрина не затронута.

**Canonical placeholder-классы в shared-компонентах:** placeholders наследуют цвет input; в местах с placeholder добавлен явный `placeholder:text-slate-400` (приглушённый серый, чётко отличимый от введённого текста) — соответствует канону из предыдущего отчёта.

Соответствие спецификации промпта §4: введённый текст — `#0f172a` на `#ffffff`/`#f8fafc` (контраст ≈ 15.7:1, WCAG AAA); placeholder — `#94a3b8` (≈ 3.0:1 на белом — допустимо для placeholder по WCAG для крупного/несущественного текста, канон проекта); labels уже были `text-slate-700`/`text-slate-900`; error-тексты уже были `text-rose-600`; disabled — `bg-slate-50` + наследуемый тёмный цвет. Opacity hacks / overlay / JS-манипуляции не применялись.

## 6. Browser Verification

- **URL:** `http://localhost:3000/partner/products/new`
- **Browser:** Chromium (Playwright headless, 1440×900)
- **Actor:** `step18_partner` (PARTNER, approved) — login → redirect `/partner` ✅

| Check | Result |
|---|---|
| Пустое поле: цвет текста `#pef-title` | `lab(7.79 …)` = slate-900 ✅ |
| Placeholder `#pef-title` | `lab(65.53 …)` = slate-400 ✅ |
| Background input | `rgb(255,255,255)` ✅ |
| `color-scheme` корня кабинета | `light` ✅ |
| Ввод текста (fill + focus, мгновенно при вводе) | `lab(7.79 …)` slate-900, без вспышки белого ✅ |
| Select «Категория» | slate-900 ✅ |
| Textarea «Описание» | text slate-900 + placeholder slate-400 ✅ |
| Динамические поля Category Schema (10 шт., категория Accommodation) | input: slate-900; validation error: rose-600 `lab(49.19 81.58 36.03)` ✅ |
| Tariff inputs (name/price/currency) | slate-900 + placeholder slate-400 ✅ |
| Scroll до конца формы + full-page screenshot | ✅ (evidence `contrast_fix_03_form_bottom.png`) |
| Reload | цвет сохраняется ✅ |
| Console errors | 0 ✅ |
| Network 4xx/5xx | 0 ✅ |

Chrome сериализует computed color как `lab()`: `lab(7.78673 1.82346 -15.0537)` ≈ `#0f172a` (slate-900), `lab(65.5349 -2.25151 -14.5072)` ≈ `#94a3b8` (slate-400) — значения идентичны зафиксированным в предыдущем отчёте по `/become-a-partner`.

Evidence: `backend/docs_evidence/contrast_fix_01_form_top.png`, `contrast_fix_02_dynamic_fields.png`, `contrast_fix_03_form_bottom.png`.

## 7. Regression

| Форма / контекст | Проверка |
|---|---|
| `/partner/products` (поиск) | input slate-900, scheme light ✅ |
| `/partner` (overview) | scheme light ✅ |
| `/partner/seller-profile` | input slate-900, scheme light ✅ |
| Marketplace `/` (тёмная витрина) | `color-scheme: dark` body не изменён ✅ (белый цвет body — runtime branding `--th-text`, вне scope) |
| Тёмные контексты внутри кабинета | loading-экраны и кнопки задают цвет явно (`text-slate-400`/`text-white`) — наследование не используется, не затронуты ✅ |
| `TravelerRequirementsEditor` | radio-кнопки с явным `text-slate-700` — изменений не требовалось ✅ |

## 8. Tests

| Команда | Результат |
|---|---|
| `npx tsc --noEmit` (frontend) | ✅ 0 ошибок |
| `npm run lint` (frontend) | ⚠️ eslint не установлен в окружении (pre-existing, не связано с фиксом) |
| `npm test` (frontend, vitest) | 881/882 ✅; 1 pre-existing failure `lib/i18n.spec.ts` (Intl currency `U+00A0` vs `U+202F` — ICU/Node, не связано с фиксом) |
| `npm run build` (frontend) | ⚠️ pre-existing failure `/search` (`useSearchParams` без Suspense boundary при prerender). Проверено на чистом дереве (`git stash` → тот же error) — **не вызвано данным фиксом** |

## 9. Git

| Metric | Value |
|---|---|
| Branch | `master` |
| HEAD до | `64ebd9d` |
| Commit (fix) | `55265b3` |
| Commit (report SHA update) | см. `git log -- docs/reports/TRAVELHUB_PARTNER_CABINET_FORM_TEXT_CONTRAST_FIX_REPORT.md` |
| origin/master | = local HEAD, ahead/behind **0/0** |
| Working tree | только pre-existing изменения других задач (backend и др.), файлы данного фикса чистые |

## 10. Verdict

**PASS**

Системный дефект устранён на корневом уровне (PartnerLayout): любая текущая и будущая форма в `/partner/*` наследует читаемый тёмный текст и светлую color-scheme. Полная форма `/partner/products/new` (включая динамические поля после выбора категории) проверена в реальном браузере; dark mode витрины не сломан.
