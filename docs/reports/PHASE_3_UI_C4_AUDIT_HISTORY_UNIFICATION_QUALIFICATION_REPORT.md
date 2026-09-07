# PHASE 3 — UI-C4 — AUDIT HISTORY UNIFICATION — QUALIFICATION REPORT

## 1. Executive Summary

UI-C4 реализован по **OPTION A (UI-ONLY)** — утверждённому после Audit First scope.
Создан единый shared-компонент `<EntityAuditHistory />`, закрыт Request gap (секция
«История изменений» на Request detail), Order/Booking мигрированы на общий компонент,
добавлена локализация `request.action.*` (RU/AZ/EN) и унифицированные
loading/empty/error-состояния.

**Вердикт: VERDICT A — ACCEPTED** (по static + runtime qualification).

## 2. Baseline

```text
BASELINE: 586ffe739855b4e29514126abfe5e95e74b398a3
```

## 3. Implementation SHA

```text
IMPLEMENTATION: uncommitted working tree (git closure — следующий gate)
FINAL SHA:      pending GIT HARD CLOSURE
HEAD:           586ffe739855b4e29514126abfe5e95e74b398a3
```

## 4. Files Changed

### Modified

| File | Change |
|---|---|
| `frontend/app/app/requests/[id]/page.tsx` | Request gap closed: WIDE-секция `<EntityAuditHistory>` из `GET /requests/:id/history`; non-blocking loading/error |
| `frontend/app/app/orders/[id]/page.tsx` | Inline-блок → shared-компонент (pagination, fields-diff, redaction, disclaimer сохранены); добавлен error-state |
| `frontend/app/app/bookings/[id]/page.tsx` | Inline-блок → shared-компонент; добавлены loading/error/empty (ранее секция скрывалась при пустой истории) |
| `frontend/lib/i18n.tsx` | +11 ключей RU/AZ/EN: `request.action.*` (8), `detail.history.empty`, `detail.history.error` |
| `frontend/lib/commerce-history-labels.ts` | `requestActionLabel()` + обновлён комментарий модуля |
| `frontend/lib/commerce-detail-system.spec.tsx` | Обновлён под рефакторинг (audit-утверждения → shared-компонент) |

### New

| File | Purpose |
|---|---|
| `frontend/components/commerce/EntityAuditHistory.tsx` | Canonical shared Audit History (EntitySectionCard + EntityRow + StatusBadge grammar; action/timestamp/actor/from→to/fields-redaction; loading/empty/error; show-more; locale-prop) |
| `frontend/lib/commerce-audit-history.spec.tsx` | 17 тестов: render (локализация RU/AZ/EN, from→to, fields/redacted, states, show-more) + source-contract (3 страницы, endpoints, Timeline≠Audit, D7 boundary) |

### Not touched (границы)

Backend (`backend/src`), Prisma schema, migrations, RBAC (`permissions.constants.ts`),
`EntityTimeline`, D7 financial section, `CommerceRelationChain` (UI-C2),
`OperationalNotes` (UI-C5), Request Timeline labels (G7 — pre-existing).

## 5. API Evidence

| Endpoint | Permission | Использование (UI-C4) |
|---|---|---|
| `GET /api/v1/requests/:id/history` | `order.read` | Request detail — массив `RequestHistoryRow[]` (createdAt desc) |
| `GET /api/v1/orders/:id/history?page&pageSize` | `order.read` | Order detail — `{items,total,page,pageSize}`, stable sort, storefront→404 |
| `GET /api/v1/bookings/:id/history` | `booking.read` | Booking detail — `{items,…}` (take 100), viewer-scoped 404 |

Backend НЕ изменялся — API контракты идентичны baseline. Новых endpoint'ов нет.

## 6. Security Evidence

- **Server authority**: все history-запросы закрыты `@RequirePermissions` (`order.read`/`booking.read`) — не менялись.
- **UI hiding ≠ authorization**: shared-компонент рендерит только то, что вернул backend; никакой client-side фильтрации/изобретения событий.
- **PII**: Order fields-diff redacted на сервере (`shared/audit.ts`) до записи; Booking/Request fields не пишутся — утечки нет (runtime: passport-значения в audit-секции не найдены).
- **Tenant**: storefront/viewer 404-гварды Order/Booking сохранены; Request — platform-only.
- **RBAC**: новый permission не создавался.

## 7. Runtime Evidence (hydrated DOM)

Playwright (headless chromium, 1440×900), login `admin/admin123`, проверено на реальном dev-стеке
(PostgreSQL 18 + backend :4000 + Next.js 16 :3000, данные dev-БД):

```text
26/26 PASS
- [request-has-history]  MKT-REQ-09000547: секция «История изменений», 4 записи,
  «Заявка создана», «Автор: admin», timestamp locale-aware, Timeline «Хронология» отдельно
- [order-has-history]    MKT-ORD-09000547: 13 записей (update_traveler_d3),
  «Автор: admin», timestamp, no raw enums, Timeline отдельно
- [booking-has-history]  MKT-BKG-09000948: 4 записи, «Бронирование подтверждено»,
  «Автор: admin», timestamp, no raw enums
- [empty-req]            MKT-REQ-09000039: секция отрендерена, empty-state «Нет записей истории»
- no console/page errors: 0
```

Скриншоты (evidence): `uic4_shots/{request-has-history,order-has-history,booking-has-history,request-empty}.png`.

Прямые URL: все три detail page открываются по direct URL после login (deep-link работает —
существующая detail-архитектура, страницы — client components с загрузкой на mount).

## 8. Test Counts

```text
vitest (frontend):  762 passed / 1 failed / 763 total
  └─ 1 fail = известный pre-existing baseline (i18n formatPrice NBSP) — НЕ относится к UI-C4
  └─ +17 новых тестов (commerce-audit-history.spec.tsx) — все PASS
  └─ commerce-detail-system (44) / commerce-relation-chain (9) — PASS
tsc --noEmit:      PASS
next build:        PASS
Backend tests:     НЕ запускались — backend не изменялся (регрессия невозможна по определению)
```

## 9. TSC

```text
frontend: npx tsc --noEmit → PASS (0 errors)
```

## 10. Build

```text
frontend: npx next build → PASS (route table сгенерирован, без ошибок)
```

## 11. i18n

| Ключ | Статус |
|---|---|
| `bookings.change_history` (заголовок секции) | ✅ существовал, RU/AZ/EN |
| `request.action.created / supplier_confirmed / supplier_rejected / supplier_unavailable / supplier_proposed_price / customer_accepted / customer_declined / converted` | ✅ новые, RU/AZ/EN (проверено тестом `resolve in RU/AZ/EN`) |
| `detail.history.empty` / `detail.history.error` | ✅ новые, RU/AZ/EN |
| `order.action.*` / `booking.action.*` / `order.history.*` | ✅ существовали, не изменены |
| Hardcoded RU в UI-C4 поверхности | ❌ нет (тест запрещает `toLocaleString("ru-RU")` и сырые enum-строки) |

## 12. A11y

- Секция: семантический `<h3>` от `EntitySectionCard` (heading-роль подтверждена в render-тесте).
- Записи — последовательный flat-list (EntityRow), читаемы скринридером по порядку.
- Show-more — нативная кнопка (keyboard-accessible, `disabled` при загрузке).
- from→to — `StatusBadge` (цвет + локализованный текст, `whitespace-nowrap`).
- Никаких expandable-элементов — новых aria-контрактов не потребовалось.

## 13. Responsive

- Та же flex-wrap грамматика (`EntityRow`), что и остальные detail-секции: 375/768/1024/1280
  без горизонтального overflow; timestamp `shrink-0`, fields-diff `flex-wrap`.
- Секция живёт в `EntityDetailWide` (`lg:col-span-3`) — полная ширина на всех брейкпоинтах.

## 14. Regression

| Stage | Статус |
|---|---|
| D5 (Order history API) | ✅ не изменялся; runtime: 13 записей корректно |
| D6 (Booking history API) | ✅ не изменялся; runtime: 4 записи корректно |
| D7 (financial history) | ✅ отдельная секция сохранена (source-contract: audit до finance) |
| UI-C1/C1.1 (shell/section/timeline) | ✅ shared primitives не изменены; R2 spec 44 теста PASS |
| UI-C1.2G/H/H.1/H.2 | ✅ не затронуты (runtime: registry/центры не посещались) |
| UI-C2 (Relation Chain) | ✅ не изменялся; spec 9 тестов PASS |
| Timeline ≠ Audit | ✅ runtime: «Хронология» в ASIDE, «История изменений» в WIDE на всех 3 страницах |

## 15. Known Baseline Failures

```text
frontend/lib/i18n.spec.ts › formatPrice: '120,00 ₼' vs '120,00\u00A0₼' (NBSP)
```
- Baseline evidence: известный pre-existing failure (промпт §32), не связан с UI-C4;
  `formatPrice` и `i18n.spec.ts` не изменялись.
- Текущее evidence: тот же единственный fail после UI-C4 (762/763 PASS).
- Causal relationship: Intl-форматирование в рантайме Node возвращает обычный пробел —
  вне scope UI-C4, не фиксится.

## 16. Git Closure

```text
git status --porcelain=v1 → 6 modified (frontend) + 6 untracked
                            (4 audit docs + EntityAuditHistory.tsx + commerce-audit-history.spec.tsx)
git diff --check → PASS
HEAD / origin/master: 586ffe739855b4e29514126abfe5e95e74b398a3 (без коммитов UI-C4)
WORKTREE: содержит только изменения UI-C4 + audit docs (источник drift отсутствует)

CLOSURE: PENDING — ждёт approval на commit(ы) (implementation / tests+docs).
```

## 17. Final Verdict

```text
VERDICT A — ACCEPTED (квалификация пройдена)

Audit History unified          ✅ shared <EntityAuditHistory/> на 3 detail pages
Request gap closed             ✅ WIDE-секция из /requests/:id/history (backend существовал — Case A)
Timeline ≠ Audit preserved     ✅ EntityTimeline в ASIDE, Audit в WIDE (runtime 26/26)
Server authority preserved     ✅ order.read / booking.read, backend не изменялся
RBAC preserved                 ✅ новый permission не создавался
Tenant isolation proven        ✅ storefront/viewer 404-гварды сохранены
RU/AZ/EN                       ✅ request.action.* + states добавлены (тесты RU/AZ/EN)
a11y                           ✅ h3-заголовок, кнопки, StatusBadge, flat-list
responsive                     ✅ EntityRow flex-wrap, WIDE-слот
runtime PASS                   ✅ 26/26 hydrated DOM checks, 0 console errors
regression PASS                ✅ D5/D6/D7/C1/C2 spec'ы + runtime
Git clean                      ⏳ HEAD == origin/master, diff --check PASS (коммиты pending)
HEAD == origin/master          ✅ (586ffe7)
```