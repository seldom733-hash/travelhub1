Ты работаешь как Staff/Principal Full-Stack Engineer + Payments/FinTech Architect + Enterprise SaaS Architect + Security Engineer + QA/Release Engineer.

# TRAVELHUB — FIX PARTNER REGISTRATION FORM INPUT TEXT CONTRAST

## Цель

Исправить конкретный UI-дефект на странице регистрации партнёра:

`/become-a-partner`

На карточке регистрации партнёра введённые пользователем символы отображаются белым/почти белым цветом на очень светлом фоне input, из-за чего введённый текст практически не читается.

По предоставленному browser screenshot дефект визуально затрагивает поля карточки регистрации партнёра, включая уже заполненные поля. Необходимо исправить именно контраст вводимого значения, не меняя бизнес-логику регистрации.

---

## 1. ОБЯЗАТЕЛЬНЫЙ LOCAL ↔ GITHUB SYNC GATE

До любых изменений:

1. Определи локальную папку проекта и проверь Git repository.
2. Проверь `git remote -v`, текущую ветку, local HEAD и `origin/master`.
3. Проверь последние коммиты, working tree, staged/unstaged/untracked и ahead/behind.
4. Безопасно синхронизируй локальный проект с GitHub.
5. Если локально есть легитимные изменения, которых нет в GitHub, не удаляй их.
6. Если remote новее — безопасно синхронизируй локальное состояние.
7. При divergence выполни безопасное reconciliation.
8. ЗАПРЕЩЕНО: `git reset --hard`, force push, destructive overwrite, удаление пользовательских изменений, фиктивные commit/push.
9. После синхронизации повторно проверь Git state.

GitHub/current code и синхронизированное локальное состояние — источник истины.

---

## 2. НАЙТИ РЕАЛЬНЫЙ ROOT CAUSE

Найди фактическую реализацию `/become-a-partner` и карточки регистрации партнёра.

Исследуй:

- page/component;
- shared form/input components;
- Tailwind/CSS;
- design tokens;
- global input styles;
- light/dark rules;
- placeholder;
- focus;
- disabled;
- select;
- textarea;
- password;
- autofill.

Особенно проверь `text-white`, `color: white/#fff`, наследование цвета от dark theme, CSS variables, `WebkitTextFillColor` и глобальные selectors.

Не предполагай имена компонентов и не исправляй симптом случайным inline-style, если есть canonical design-token/class.

---

## 3. КАНОНИЧЕСКОЕ ИСПРАВЛЕНИЕ

Для input/textarea/select карточки регистрации:

- введённый текст — тёмный, контрастный на светлом фоне;
- placeholder — отдельный, приглушённый серый;
- focus не должен превращать текст в белый;
- выбранное значение select должно быть читаемым;
- password bullets должны быть читаемыми;
- textarea должен использовать тот же корректный foreground.

Используй существующий canonical foreground token проекта, если он есть. Не привязывай решение к случайному hex-коду без необходимости.

Проверь Chrome autofill (`:-webkit-autofill`, `-webkit-text-fill-color`) и исправь его только если он является частью root cause.

---

## 4. SCOPE

Не менять без необходимости:

- API/DTO/database;
- validation;
- authentication/authorization;
- registration flow;
- layout;
- spacing;
- typography;
- buttons;
- localization;
- routing.

Если root cause находится в shared input component, допускается исправление shared component только при подтверждении, что это не создаст регрессию в других темах/формах.

Не использовать opacity, overlays, delays, animations, JS color hacks или другие маскирующие решения.

---

## 5. BROWSER VERIFICATION — ОБЯЗАТЕЛЬНО

После исправления проверь в реальном browser runtime:

`http://localhost:3000/become-a-partner`

Проверить:

1. пустое поле;
2. ввод текста;
3. имя;
4. фамилию;
5. email;
6. password;
7. confirm password;
8. brand/name;
9. contact email;
10. phone;
11. website;
12. address;
13. description;
14. `Тип заявителя`;
15. `Страна`;
16. focus;
17. уже заполненные значения;
18. reload;
19. autofill, если доступен;
20. Console;
21. Network.

Acceptance criterion:

> Пользователь вводит символы в любое поле карточки регистрации партнёра и ясно видит введённый текст на светлом фоне.

---

## 6. REGRESSION

Определи другие формы, использующие тот же component/style.

Если изменение shared — проверь минимум одну светлую и одну тёмную форму, если они существуют.

Не допускай:

`light background → white text`

и не создавай обратную регрессию:

`dark background → dark text`.

---

## 7. TESTS

Выполни доступные релевантные:

- TypeScript/typecheck;
- frontend lint, если существует;
- targeted tests;
- frontend build.

Предсуществующие ошибки отдели от новых.

---

## 8. FINAL REPORT — ОБЯЗАТЕЛЬНО

Финальный отчёт на русском языке физически сохранить:

`/reports/TRAVELHUB_PARTNER_REGISTRATION_INPUT_TEXT_CONTRAST_FIX_REPORT.md`

Отчёт должен содержать:

### 1. Итог
Что исправлено.

### 2. Root Cause
Почему текст был белым/нечитаемым.

### 3. Изменённые файлы
Точные пути.

### 4. Изменение
Какой style/token/class исправлен.

### 5. Browser Verification
URL, browser, проверенные поля, typing, focus, select, password, autofill, Console, Network.

### 6. Regression
Проверенные связанные компоненты/формы.

### 7. Tests
Команды и результаты.

### 8. Git
Branch, HEAD до/после, commit SHA, origin/master, ahead/behind, working tree.

### 9. Verdict
`PASS`, `PASS WITH LIMITATIONS` или `BLOCKED`.

---

## 9. HARD COMPLETION GATE

Работа не считается завершённой, пока:

- дефект реально исправлен;
- browser verification выполнена;
- tests выполнены;
- отчёт существует в `/reports`;
- Git status проверен.

Если workflow допускает commit/push:

1. commit;
2. push в `origin/master`;
3. fetch;
4. подтвердить local HEAD == origin/master;
5. ahead/behind = 0;
6. working tree clean.

Не делать force push, destructive reset или фиктивный commit.

Финальный ответ дать на русском языке и указать:

- что исправлено;
- root cause;
- изменённые файлы;
- tests;
- browser verification;
- путь к отчёту;
- commit SHA;
- Git status;
- verdict.

Не задавать пользователю вопрос «продолжать ли». Выполнить задачу полностью.
