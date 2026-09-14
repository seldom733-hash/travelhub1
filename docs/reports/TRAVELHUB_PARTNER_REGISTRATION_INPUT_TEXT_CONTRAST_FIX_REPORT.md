# TRAVELHUB — Partner Registration Input Text Contrast Fix Report

**Date:** 2026-09-14  
**Status:** ✅ PASS  
**Branch:** `master`

---

## 1. Итог

Исправлен дефект контраста вводимого текста на странице `/become-a-partner` и 6 других светлых формах. Введённые пользователем символы теперь отображаются тёмным цветом (`text-slate-900` = `#0f172a`) на светлом фоне (`bg-slate-50` ≈ `#f8fafc`).

## 2. Root Cause

`globals.css:25` устанавливает глобальный цвет текста body:
```css
body { color: var(--th-text, #e8e8e8); }  /* светлый для тёмной темы */
```

Страница `/become-a-partner` использует светлую карточку (`bg-white`) с input на `bg-slate-50`, но **не задаёт явный цвет текста**. Input наследует `#e8e8e8` (почти белый) от body → белый текст на светлом фоне = нечитаемо.

## 3. Изменённые файлы

| File | Change |
|---|---|
| `frontend/app/become-a-partner/page.tsx` | `inputCls`: добавлен `text-slate-900 placeholder:text-slate-400` |
| `frontend/app/register/page.tsx` | 5 input: добавлен `text-slate-900 placeholder:text-slate-400` |
| `frontend/app/account/profile/page.tsx` | 5 input: добавлен `text-slate-900 placeholder:text-slate-400` |
| `frontend/app/partner/onboarding/edit/page.tsx` | inputCls: добавлен `text-slate-900 placeholder:text-slate-400` |
| `frontend/app/partner/seller-profile/page.tsx` | 3 input: добавлен `text-slate-900 placeholder:text-slate-400` |
| `frontend/app/app/seller-profiles/page.tsx` | textarea: добавлен `text-slate-900 placeholder:text-slate-400` |
| `frontend/app/app/partners/onboarding/page.tsx` | textarea: добавлен `text-slate-900 placeholder:text-slate-400` |
| `frontend/components/PublicLayout.tsx` | header search input: добавлен `text-slate-900 placeholder:text-slate-400` |

## 4. Изменение стиля

До:
```
bg-slate-50 px-3 py-2.5 text-sm outline-none ...
```
После:
```
bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none ... placeholder:text-slate-400
```

- `text-slate-900` = `#0f172a` — тёмный, контрастный на светлом фоне
- `placeholder:text-slate-400` = `#94a3b8` — приглушённый серый для placeholder

## 5. Browser Verification

| Check | Result |
|---|---|
| URL | `http://localhost:3000/become-a-partner` |
| Input text color (computed) | `lab(7.8)` ≈ `#0f172a` (slate-900) ✅ |
| Input background (computed) | `lab(98.1)` ≈ `#f8fafc` (slate-50) ✅ |
| Placeholder color | `lab(65.5)` ≈ `#94a3b8` (slate-400) ✅ |
| Поля: First Name, Last Name, Email, Password, Confirm | ✅ Тёмный текст |
| Поля: Brand, Country, Contact Email, Phone, Website, Address | ✅ Тёмный текст |
| Textarea: Business Description | ✅ Тёмный текст |
| `/register` page | ✅ Тёмный текст (подтверждено) |
| Console errors | ✅ Нет |

## 6. Regression

Проверены 7 светлых форм:
- `/become-a-partner` — ✅ исправлено
- `/register` — ✅ исправлено
- `/account/profile` — ✅ исправлено
- `/partner/onboarding/edit` — ✅ исправлено
- `/partner/seller-profile` — ✅ исправлено
- `/app/seller-profiles` — ✅ исправлено
- `/app/partners/onboarding` — ✅ исправлено

Тёмные формы (Marketplace, Constructor) не затронуты — там `text-white` задан явно на компонентах.

## 7. Tests

```
frontend TypeScript (tsc --noEmit): ✅ OK (no errors)
```

## 8. Git

| Metric | Value |
|---|---|
| Branch | `master` |
| HEAD до | `bd22e8e` |
| HEAD после | `ce498be` |
| origin/master | `ce498be` |
| ahead/behind | 0/0 |
| Working tree | 8 modified files |

## 9. Verdict

**PASS**
