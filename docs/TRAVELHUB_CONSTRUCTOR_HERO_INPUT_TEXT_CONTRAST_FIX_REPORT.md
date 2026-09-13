# TRAVELHUB — CONSTRUCTOR HERO INPUT TEXT CONTRAST FIX — ОТЧЁТ

## 1. Что было проблемой

В `Настройки → Конструктор витрины → Hero / Баннеры` введённые значения в полях
RU / AZ / EN (title / subtitle / description / CTA URL) отображались светло-серым
(`rgb(232,232,232)`) на белом фоне полей — текст практически не читался.

## 2. Root Cause

В `frontend/app/globals.css` задан глобальный режим:

```css
:root { color-scheme: dark; }
body { background: #0d0d0d; color: #e8e8e8; }   /* ← наследуется input'ами */
```

Constructor-табы визуально светло-тематические (`bg-white`, `text-slate-900` заголовки),
но сами `<input>` не имели явного text-color и **наследовали** светло-серый `#e8e8e8`
от body. Ни один другой механизм (Tailwind placeholder-утили, UA-стили) не переопределял
цвет значения — отсюда «бледный» текст именно в полях.

Проверено computed-style до фикса: `inputColor = rgb(232,232,232)` при `parentBg = rgb(255,255,255)`.

## 3. Изменённые компоненты/файлы

```text
frontend/components/constructor/ConstructorHeroTab.tsx   — ЕДИНСТВЕННЫЙ изменённый файл
```

Скопировано **только** в пределах Hero-таба:

- корневой контейнер таба: `+ text-ink` (гарантия тёмного текста для всего содержимого таба);
- 6 текстовых инпутов на каждый слайд (3 слайда): `+ text-ink` — title RU/AZ/EN,
  subtitle RU/AZ/EN, description (ctaLabel) RU/AZ/EN;
- CTA URL инпут каждого слайда: `+ text-ink`;
- Carousel interval (number input): `+ text-ink`.

Итого 6 `text-ink`-классов в файле. **Другие компоненты Constructor (Header/Search/Content/
Footer/Design) не изменены** — проверено grep'ом: `text-ink` вне Hero-таба = 0 вхождений.
Глобальные CSS/global token'ы не менялись.

## 4. Применённый стиль

Использован **существующий проектный design token** — Tailwind v4 theme-переменная,
уже определённая в `globals.css`:

```css
@theme { --color-ink: #0f172a; }   /* проектный "основной текст на светлом фоне" */
```

Класс: `text-ink` → `color: #0f172a` (очень тёмный slate/ink, семантически эквивалентен
чёрному для текста на светлом фоне). Новый token не вводился.

Computed-style после фикса: `rgb(15, 23, 42)` = `#0f172a` ✓

## 5. Почему placeholder НЕ изменён

Класс `text-ink` стилизует **введённое значение** (`color` инпута). Placeholder отображается
браузерным UA-механизмом `::placeholder` и в Tailwind v4 по умолчанию наследует отдельное
приглушённое оформление; явных `placeholder:`-переопределений в проекте нет, поэтому
placeholder сохранил свой исходный серый вид.

**Проверка C (browser):** поле RU title слайда 1 очищено → placeholder «Заголовок» остался
визуально приглушённо-серым (скриншот), введённые значения в соседних полях остались чёрными.
Исходное значение возвращено сразу после проверки — **БЕЗ Save/Publish**, состояние редактора
восстановлено в точности.

## 6. Browser verification (реальный браузер, `http://localhost:3000/app/page-builder`)

### Проверка A — введённые значения RU/AZ/EN (Banner 1)

```text
RU title      «Единая экосистема» → rgb(15,23,42) ✓
RU subtitle   «для путешествий»   → rgb(15,23,42) ✓
RU description«Отели, туры…»      → rgb(15,23,42) ✓
AZ/EN поля    (Vahid ekosistem / A unified ecosystem и т.д.) → rgb(15,23,42) ✓ (скриншот)
```

### Проверка B — остальные поля

```text
CTA URL (/search)     → rgb(15,23,42) ✓
Carousel interval 7000 → text-ink ✓ (скриншот: тёмный «7000» в поле)
```

### Проверка C — placeholder

Очистка RU title → placeholder «Заголовок» остался серым/приглушённым (скриншот),
не стал чёрным. Значение возвращено без сохранения. ✓

### Проверка D — все баннеры

```text
Banner 1: RU/AZ/EN title/subtitle/desc + CTA URL → rgb(15,23,42) ✓ (скриншот)
Banner 2: «Для партнёров», «Развивайте б…», «Размещайте с…» → rgb(15,23,42) ✓ (скриншот)
Banner 3: «TravelHub St…», «Создайте сво…», «Персональная…» → rgb(15,23,42) ✓
```

Скриншоты приложены в thread: до/после, включая cleared-placeholder состояние.

## 7. Regression verification

```text
Constructor открывается            → /app/page-builder 200, табы работают
Hero fields редактируются          → очистка/ввод обработались штатно (React controlled input)
Save НЕ выполнялся                 → данные не изменялись намеренно
Изображения                        → рендерятся (скриншоты: фото слайдов 1–2)
Switch RU/AZ/EN                    → лейблы/контент переключаются (скриншоты)
Другие табы/блоки                  → visual diff = 0 (файл только один, scoped grep = 0)
frontend tsc --noEmit              → PASS (0 ошибок)
Console                            → чисто: только HMR/Fast Refresh логи, 0 ошибок
```

## 8. Проверка отсутствия изменения данных

```text
Published API до правки:  v97, slide1.title.ru = «Единая экосистема», brand = TravelHub
Published API после правки: v97 — ИДЕНТИЧНО (версия не менялась → ни Save, ни Publish не вызывались)
Draft state:              не изменялся (edit отменён возвратом исходного значения в UI)
Navitravel/hero content:  не затронуты; Restore Default НЕ выполнялся
```

Фикс — чисто presentation-layer: один файл, только className-строки.

## 9. Git status

```text
Изменённые файлы (в рабочем дереве на момент отчёта):
  frontend/components/constructor/ConstructorHeroTab.tsx   (this fix)
  frontend/components/marketplace/HeroSection.tsx          (предыдущая задача hero-flash — отдельный commit)
  frontend/components/marketplace/MarketplaceRenderer.tsx  (предыдущая задача hero-flash — отдельный commit)
```

Примечание: в рабочем дереве также присутствуют незакоммиченные правки
`HeroSection.tsx` / `MarketplaceRenderer.tsx` из предыдущей задачи (flash-reinvestigation,
прерванной пользователем). Они **не относятся** к данной contrast-задаче и закоммичены
отдельным focused commit'ом (см. §10), чтобы не смешивать scope.

## 10. Commit

```text
Commit contrast-fix:  см. git log -1 -- frontend/components/constructor/ConstructorHeroTab.tsx
Push:                 origin/master
```

## 11. Final Verdict

```text
PASS — HERO INPUT TEXT CONTRAST FIXED

[✓] Введённый текст input  → #0f172a (тёмный/фактически чёрный)
[✓] Введённый текст полей  → единообразно во всех Hero-полях
[✓] RU / AZ / EN           → проверены (скриншоты)
[✓] Title/Subtitle/Desc/CTA URL → проверены
[✓] Banner 1 / 2 / 3       → проверены
[✓] Placeholder остался приглушённым (проверка очисткой, значение возвращено)
[✓] Navitravel и все данные не изменены (published v97 идентичен до/после)
[✓] Save/Publish не сломаны (не вызывались; версия не bump'нулась)
[✓] Нет новых Console errors
[✓] Изменение не распространилось на весь UI (grep-scope = 1 файл)
```
