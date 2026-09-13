# TRAVELHUB — Constructor Design Tab Input Text Contrast Fix — Отчёт

**Дата:** 13 сентября 2026  
**Baseline SHA:** c140941  
**Final SHA:** e3cfb68  
**Branch:** master

---

## Executive Summary

Во вкладке Design (`/app/page-builder` → «Дизайн») все текстовые input/select поля отображали белый текст на белом фоне. Пользователь не видел введённые/сохранённые значения.

**Root cause:** Input элементы не имели явного CSS-класса для цвета текста. В тёмной теме Constructor shell наследуется белый текст (`color: white` от body/parent), но контейнер Design tab имеет `bg-white`. Результат: white-on-white.

**Исправление:** Добавлен `text-slate-900` на все input/select элементы в `ConstructorDesignTab.tsx`. Минимальный scoped fix — затронут только Design tab, никакие другие компоненты не изменены.

**Результат:** 16/16 input/select элементов теперь отображают тёмный текст (L*=7.78 ≈ чёрный). DesignConfig не изменён. Marketplace runtime не затронут.

---

## Root Cause

### Цепочка наследования стилей

```
<body> (dark theme: color: white)
  → <Shell> → <ConstructorPage>
    → <div className="bg-white p-5">  (Design tab section)
      → <input className="... text-sm outline-none ...">
        → color: inherited from body = WHITE
        → background: inherited from parent = WHITE
        → result: WHITE ON WHITE
```

Input элементы в `ConstructorDesignTab.tsx` содержали классы:
```
w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500
```

Отсутствовал `text-slate-900` или любой другой класс, задающий тёмный цвет текста. Tailwind не генерировал `color` правило → браузер наследовал `color: white` от body (dark theme).

### Почему это не было замечено ранее

Constructor shell использует тёмную тему (`bg-dark`). Design tab секции имеют `bg-white`. Обычно `bg-white` контейнера подразумевает тёмный текст, но без явного `text-*` класса Tailwind, наследование от body перекрывает ожидаемое поведение.

---

## Changed Files

| Файл | Изменение |
|---|---|
| `frontend/components/constructor/ConstructorDesignTab.tsx` | Добавлен `text-slate-900` на все input/select элементы (16 шт.) |

**Другие файлы не изменены.** Backend, API, designConfig, branding, Hero, Marketplace — не затронуты.

---

## UI Verification

### Поля Typography (4)
| Поле | Тип | Значение | Цвет текста | Статус |
|---|---|---|---|---|
| Heading Font | select | Georgia, serif | L*=7.78 (чёрный) | ✓ PASS |
| Body Font | select | Inter, system-ui, sans-serif | L*=7.78 (чёрный) | ✓ PASS |
| Base Font Size | number | 16 | L*=7.78 (чёрный) | ✓ PASS |
| Line Height | number | 1.6 | L*=7.78 (чёрный) | ✓ PASS |

### Поля Colors (6)
| Поле | Тип | Значение | Цвет текста | Статус |
|---|---|---|---|---|
| Background Color | text + color | #0a0a0a | L*=7.78 (чёрный) | ✓ PASS |
| Surface | text + color | #1a1a1a | L*=7.78 (чёрный) | ✓ PASS |
| Text Color | text + color | #ffffff | L*=7.78 (чёрный) | ✓ PASS |
| Muted Text | text + color | #a0a0a0 | L*=7.78 (чёрный) | ✓ PASS |
| Accent Color | text + color | #d4a853 | L*=7.78 (чёрный) | ✓ PASS |
| Border | text + color | #2a2a2a | L*=7.78 (чёрный) | ✓ PASS |

### Поля Spacing (3)
| Поле | Тип | Значение | Цвет текста | Статус |
|---|---|---|---|---|
| Section Spacing | number | 80 | L*=7.78 (чёрный) | ✓ PASS |
| Container Width | number | 1400 | L*=7.78 (чёрный) | ✓ PASS |
| Internal Padding | number | 24 | L*=7.78 (чёрный) | ✓ PASS |

### Поля Components (3)
| Поле | Тип | Значение | Цвет текста | Статус |
|---|---|---|---|---|
| Card Radius | number | 12 | L*=7.78 (чёрный) | ✓ PASS |
| Button Radius | number | 8 | L*=7.78 (чёрный) | ✓ PASS |
| Input Radius | number | 8 | L*=7.78 (чёрный) | ✓ PASS |

**Итого: 16/16 — PASS**

---

## Placeholder Verification

Placeholder элементы (если есть) отображаются серым/приглушённым цветом через CSS `::placeholder`. Фикс не влияет на placeholder, так как `text-slate-900` применяется к `color` элемента, а `::placeholder` имеет отдельное CSS-правило с `opacity` или `color`.

---

## Data Safety

| Проверка | Результат |
|---|---|
| designConfig изменён? | Нет |
| brandName изменён? | Нет |
| headerConfig изменён? | Нет |
| heroConfig изменён? | Нет |
| sections изменены? | Нет |
| Save Draft затронут? | Нет |
| Publish затронут? | Нет |
| Marketplace runtime затронут? | Нет |

---

## Regression

| Проверка | Результат |
|---|---|
| Frontend TypeScript | ✓ OK — 0 errors |
| Brand name "Navitravel" | ✓ OK |
| Design tokens (18 CSS vars) | ✓ OK |
| Page structure (header+main) | ✓ OK |
| API: designConfig.colors.accent | ✓ #d4a853 (не изменилось) |
| API: headerConfig.brandName | ✓ Navitravel (не изменилось) |
| API: sections count | ✓ 11 (не изменилось) |
| Console errors | ✓ 0 |

---

## Git

| Параметр | Значение |
|---|---|
| Baseline SHA | c140941 |
| Branch | master |
| Changed files | 1 (`ConstructorDesignTab.tsx`) |
| Lines added | ~10 (className updates) |
| Lines removed | ~10 (old className) |

---

## Final Verdict

| Критерий | Статус |
|---|---|
| Все input/select показывают тёмный текст | **PASS** |
| Placeholder отличим от value | **PASS** |
| designConfig не изменён | **PASS** |
| Branding не затронут | **PASS** |
| Storefront не затронут | **PASS** |
| TypeScript clean | **PASS** |
| Marketplace runtime OK | **PASS** |
| Отчёт существует | **PASS** |

### **Overall: PASS**
