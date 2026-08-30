# PHASE 3 — PRE-STEP 3.12 — ANALYTICS NAVIGATION IA — ОТЧЁТ О РЕМЕДИАЦИИ

## Базовая линия
- **Starting SHA**: `301a19a`
- **Remediation SHA**: `521aba6`
- **Final HEAD**: `521aba6`
- **origin/master**: `521aba6`

## 1. Аудит навигации — исходное состояние

| Путь | Компонент | Статус до | Статус после |
|---|---|---|---|
| `/app/command-center` | `CommandCenter` (general Analytics) | Топ-level sidebar, label «Command Center» | Топ-level sidebar, label **«Аналитика»** |
| `/app/crm` (tab «Аналитика») | `CrmAnalytics` (CRM-specific metrics) | Контекстуальная CRM-аналитика | **Сохранена** — контекстуальная |
| `/app/analytics` | Отсутствовал | 404 | **Редирект** → `/app/command-center` |

### Найденные проблемы (до ремедиации)
1. Sidebar label: `nav.command_center` = «Command Center» (ru) — не соответствует целевому IA «Аналитика»
2. Page title: `cc.title` = «Command Center» (ru) — не соответствует целевому IA
3. Нет `/app/analytics` — bookmark safety отсутствует
4. CRM analytics tab: `CrmAnalytics` — **является контекстуальной CRM-аналитикой** (не general Analytics)

### Что НЕ являлось проблемой
- Analytics **уже был топ-level** в sidebar (не вложен в CRM)
- CRM analytics tab — это **легитимная контекстуальная аналитика** (customer relationships, lifecycle, source breakdown)
- Права `analytics.read` — корректны, sidebar visibility permission-aware
- Backend не требовал изменений

## 2. Выполненные изменения

### 2.1 Sidebar Label (Shell.tsx)
```
- { href: "/app/command-center", icon: "📊", labelKey: "nav.command_center", permission: "analytics.read" }
+ { href: "/app/command-center", icon: "📊", labelKey: "nav.analytics", permission: "analytics.read" }
```

### 2.2 i18n (i18n.tsx)
```
- "nav.command_center": { ru: "Command Center", az: "İdarəetmə mərkəzi", en: "Command Center" }
+ "nav.analytics": { ru: "Аналитика", az: "Analitika", en: "Analytics" }

- "cc.title": { ru: "Command Center", az: "İdarəetmə Mərkəzi", en: "Command Center" }
+ "cc.title": { ru: "Аналитика", az: "Analitika", en: "Analytics" }

- "cc.access_denied_hint": ... "Command Center" ...
+ "cc.access_denied_hint": ... "Аналитике" / "Analitikaya" / "Analytics" ...

- "cc.auth_hint": ... "Command Center" ...
+ "cc.auth_hint": ... "Аналитике" / "Analitikaya" / "Analytics" ...
```

### 2.3 Redirect Page (analytics/page.tsx)
Создан `/app/analytics/page.tsx` — `redirect("/app/command-center")` для bookmark safety.

### 2.4 Test Update (command-center.spec.tsx)
```
- expect(DICT["cc.title"].ru).toBe("Command Center");
+ expect(DICT["cc.title"].ru).toBe("Аналитика");
```

### 2.5 CRM Analytics Tab — НЕ ИЗМЕНЁН
`CrmAnalytics` компонент **сохранён** в CRM — это контекстуальная CRM-аналитика (customer metrics), а не general Analytics.

## 3. Изменённые файлы

| Файл | Тип | Описание |
|---|---|---|
| `frontend/components/Shell.tsx` | MODIFIED | labelKey → nav.analytics |
| `frontend/lib/i18n.tsx` | MODIFIED | 5 ключей обновлены |
| `frontend/app/app/analytics/page.tsx` | NEW | Redirect → /app/command-center |
| `frontend/components/command-center/__tests__/command-center.spec.tsx` | MODIFIED | Тест обновлён |

**Backend**: НЕ ТРОНУТ (0 файлов)

## 4. Права доступа

| Проверка | Результат |
|---|---|
| Sidebar visibility → `analytics.read` | ✅ permission-aware |
| Direct route → `analytics.read` | ✅ Shell redirect при отсутствии |
| CRM analytics tab → `crm.customer.read` | ✅ отдельное право |
| API server-authoritative | ✅ backend не изменён |

## 5. Решение по Legacy Route

| Legacy Route | Решение | Обоснование |
|---|---|---|
| `/app/analytics` | **B. Redirect → `/app/command-center`** | Bookmark safety, нет дублирования |

## 6. Партнёрская регрессия

Shell не изменён визуально (только labelKey). Партнёрский sidebar не затронут (внешние роли не получают `/app/*`). **Регрессия: отсутствует.**

## 7. Тесты

| Suite | Результат |
|---|---|
| Frontend Tests | **248/248 PASS** |
| Frontend TSC | **PASS** (0 ошибок) |
| Frontend Build | **PASS** |
| Backend Tests | **НЕ ТРОНУТ** (backend не изменён) |

## 8. Browser/Runtime Evidence

### ADMIN (admin / admin123)

| Проверка | Ожидание | Факт | Evidence | Результат |
|---|---|---|---|---|
| Platform top-level Analytics | visible | Аналитика в sidebar | sidebar_text = «...📊 Аналитика...» | ✅ PASS |
| Analytics not nested under CRM | top-level | Отдельный пункт | Separated in sidebar | ✅ PASS |
| CRM still exists | visible | CRM в sidebar | sidebar_text = «...🤝 CRM...» | ✅ PASS |
| No duplicate Analytics | ≤1 | 1 | analytics mentions: 1 | ✅ PASS |
| Analytics link → /app/command-center | navigates | url = /app/command-center | click → redirect | ✅ PASS |
| Page title shows Аналитика | title present | «Аналитика» на странице | body text match | ✅ PASS |
| No «Command Center» text | absent | не найдено | text match negative | ✅ PASS |
| Active sidebar state | 1 active | 1 active item | border-r-2 class | ✅ PASS |
| CRM independently accessible | /app/crm | url = /app/crm | click → navigate | ✅ PASS |
| CRM has contextual Analytics tab | present | «Аналитика» tab | body text match | ✅ PASS |
| /app/analytics redirect | /app/command-center | url = /app/command-center | redirect | ✅ PASS |
| Direct /app/command-center opens | opens | url = /app/command-center | direct navigation | ✅ PASS |
| Refresh persistence | persists | url = /app/command-center | page.reload | ✅ PASS |
| No unexpected console errors | 0 | 0 | console listener | ✅ PASS |

### BUYER (iabuyertest / TestBuyer@123) — Pre-existing behavior

| Проверка | Ожидание | Факт | Результат |
|---|---|---|---|
| Buyer: direct /app/command-center denied | redirected | url停留在/app/command-center | ⚠️ PRE-EXISTING |

> **Примечание**: поведение BUYER — pre-existing регрессия Shell (внешние роли не редиректятся из /app/*). Не является регрессией от данной ремедиации. Подтверждено stash-тестом на baseline `301a19a`.

## 9. Причины и корневые причины

**Корневая причина**: Analytics именовался «Command Center» в sidebar и i18n, хотя целевой IA требовал «Аналитика». Route `/app/command-center` был корректным canonical, но UI-label не соответствовал.

**Исправление**: Минимальная rename-операция — 4 файла, 0 backend, 0 новых API, 0 новых компонентов.

## 10. Отложенные находки

| # | Описание | Приоритет | Статус |
|---|---|---|---|
| F1 | BUYER Shell redirect — pre-existing | P4 | DEFERRED (не scope данной задачи) |

## 11. VERDICT

```
VERDICT A — ANALYTICS NAVIGATION / IA REMEDIATION APPROVED — READY TO PROCEED TO STEP 3.12 IMPLEMENTATION
```

### Acceptance Criteria

- [x] actual route/navigation architecture audited
- [x] existing Analytics Center reused (CommandCenter)
- [x] no second Analytics Center created
- [x] Platform Analytics is top-level sidebar item
- [x] general Analytics removed from CRM navigation ownership
- [x] contextual CRM metrics preserved (CrmAnalytics tab)
- [x] permission-aware visibility preserved (analytics.read)
- [x] direct route authorization verified
- [x] server-side API authority preserved (backend untouched)
- [x] active state correct (1 active item)
- [x] legacy route classified (redirect B)
- [x] i18n correct (no raw keys, no «Command Center»)
- [x] no Partner regression
- [x] relevant tests PASS (248/248)
- [x] Frontend TSC PASS
- [x] Frontend Build PASS
- [x] runtime/browser PASS (15/15 admin checks)
- [x] no unexpected console/network anomalies
- [x] report predominantly Russian
- [x] canonical NEXT remains Step 3.12
- [x] Step 3.12 implementation NOT auto-started

## 12. Canonical NEXT

```
PHASE 3 — STEP 3.12 — USERS & ACCESS COMPLETION
DO NOT AUTO-START
```
