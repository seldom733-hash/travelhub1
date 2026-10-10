# TRAVELHUB — REQUEST TRAVELERS → ORDER TRAVELER EXPANSION — IMPLEMENTATION REPORT (§31)

Status: **DONE — NO COMMIT / NO PUSH.**
HEAD: `75c6bea` (`fix(request): keep convert action for product-less requests (Hotel Identity Fix B)`) — не изменён, не добавлялись коммиты, не выполнялся `git push`.

---

## 1. Scope delivered

| Этап | Результат |
|---|---|
| Модель данных | `order.RequestTraveler` (id/requestId/position/firstName/lastName/birthDate, FK→`order.Request`, уникальность `(requestId, position)`) + связь `Request.travelers`; Request-стадия хранит **только FIO + birthDate** (§2.2) |
| Request CRUD | `GET/POST/PATCH/DELETE /api/v1/requests/:id/travelers` (`order.read` / `order.edit_noncritical`), `REQUEST_TRAVELER_FORBIDDEN_KEYS` (anti-mass-assignment) |
| Readiness / conversion | `computeRequestTravelersReadiness` (§6) в `availableActions`, `assertRequestTravelersMatchCount` (§10) — точное соответствие состава и `travelerCount` перед конверсией |
| Копирование в Order | `RequestTraveler → OrderTraveler` (§10) в точке создания заказа: FIO+DOB префиллятся в D3-панель, дальше расширяются passport-полями (§2.3) |
| §3 requirements | TOUR: `firstName/lastName/birthDate/citizenship/passportSeries/passportNumber/passportExpiry = REQUIRED`, `gender = NOT_REQUESTED` (`traveler-requirements.ts`) |
| §14 expiry-слой | `backend/src/modules/order/passport-expiry.ts` (`DEFAULT_PASSPORT_EXPIRY_MARGIN_DAYS = 183`, коды `OK/EXPIRED/EXPIRING_WITHIN_MARGIN/MISSING_PASSPORT_EXPIRY/TRIP_DATES_UNKNOWN`) в 3 точках: (1) `updateTravelerD3`/bulk `updateTravelers` — `requireExpiry:false` (блокируем только присутствующий, но негодный срок; частичный save остаётся возможным), (2) `finalConfirm` — `requireExpiry` из pinned, (3) `booking.subscribers.onBookingRequested` — throw до записей → outbox `FAILED` |
| §15 data source | `getPinnedRequirements` (`GET /orders/:id/travelers`) возвращает additive `passportExpiry: {status, verdicts[]}` с PII-gate (`canViewTravelerPii` → иначе `null`); `validateTravelerCompletion` — additive `passportExpiry` |
| §15 UI | `TravelerCollectionPanel`: `FIELD_ORDER += passportSeries`, рендер предупреждений `EXPIRED` (красный, блок) / `EXPIRING_WITHIN_MARGIN` (янтарный) |
| Request UI блок | `frontend/app/app/requests/[id]/page.tsx`: секция «ДАННЫЕ ТУРИСТОВ» — add/edit/delete, прогресс «Заполнено X из Y», заморозка при `CONVERTED/REJECTED` (server-authoritative: клиентские права НЕ считаются — требование UI-C7) |

---

## 2. Changed files (этап, относящийся к задаче)

Backend (tracked): `backend/prisma/schema.prisma`, `backend/src/modules/order/{request.service.ts,request.controller.ts,order.service.ts,order.controller.ts,order.validation.ts,request-customer-accept.spec.ts,request.service.dto.spec.ts}`, `backend/src/modules/booking/booking.subscribers.ts`, `backend/src/modules/catalog/traveler-requirements{,.spec}.ts`, `backend/src/eventbus/domain-events.ts`, `backend/test/{d3-traveler-collection,d3-request-flow,ui-c6-request-server-authority}.e2e-spec.ts`.

Backend (новые, untracked): `backend/src/modules/order/request-travelers{,.spec}.ts`, `backend/src/modules/order/passport-expiry{,.spec}.ts`, `backend/test/tour-offer-traveler-pin.e2e-spec.ts`, `backend/prisma/migrations/20261007120000_traveler_two_stage_request_traveler/`.

Frontend (tracked): `frontend/app/app/requests/[id]/page.tsx` (+208), `frontend/components/order/TravelerCollectionPanel{,.spec}.tsx` (+39/+64), `frontend/lib/i18n.tsx` (+153), `frontend/components/order/OrderActionBar.tsx`.

Diffstat по этим файлам: **19 tracked files, +1839 / −92** (плюс 6 untracked файлов/каталогов выше).

---

## 3. Migration

- `backend/prisma/migrations/20261007120000_traveler_two_stage_request_traveler/` — **применён** (additive SQL → `prisma migrate resolve --applied` → `prisma generate`).
- `npx prisma migrate status`: **«118 migrations found … Database schema is up to date!»** — все миграции применены.
- `npx prisma migrate dev` в этом окружении отклонён (существующий drift + reset prompt) — дрейф **pre-existing** и не исправлялся: отсутствуют локально `20260926125000_roomtype_aliases`, `20260926130000_room_view`; diff пытается DROP `catalog.RoomView`, `catalog.PartnerActiveCategory`, DROP COLUMN `catalog.RoomType.aliases`.

---

## 4. Tests

| Прогон | Команда | Результат |
|---|---|---|
| Backend typecheck | `npm run typecheck` | **exit 0** |
| Backend unit | `npm test` (jest `--runInBand`) | **156 suites / 2497 tests — ALL PASS** |
| Frontend typecheck | `npx tsc --noEmit` | **exit 0** |
| Frontend unit | `npm test` (vitest) | **61 files / 992 tests — ALL PASS** |

Новые спеки в этом этапе: `passport-expiry.spec.ts` (15 тестов, §14), `request-travelers.spec.ts` (17 тестов, §6/§10/позиции/readiness + инвариант §2.2 «только FIO+birthDate на выходе»), +3 теста в `TravelerCollectionPanel.spec.tsx` (passportSeries-save, EXPIRED/EXPIRING-рендер, отсутствие вердикта), + e2e-тест §14 в `d3-traveler-collection.e2e-spec.ts`.

### E2E (чанками — полный `npm run test:e2e` нестабилен, heap OOM exit=134)

- Этот этап (6 сьютов): `d3-traveler-collection`, `ui-c6-request-server-authority`, `d4-traveler-security`, `tour-offer-traveler-pin`, `d3-request-flow`, `d5-order-fullpage-audit` → **Tests: 72 passed / 72 total**.
- Ранее в workstream PASS: `d4-remediation-closure`, `order-to-request`, `request-discount-grant`, `m4-guest-checkout`, `d4-representative-chain` (4/4 после ручного рестарта MinIO), `order-lifecycle-*`-смежные части, см. логи `%TEMP%\e2e-*.txt`.

---

## 5. Browser E2E (§25–§26)

Окружение: backend перезапущен (`ts-node src/main.ts`, PID 17368, :4000), frontend :3000 (dev), Chrome headless `--remote-debugging-port=9223` + `agent-browser connect 9223`, сессия `AGENT_BROWSER_SESSION=uiaudit-5ed8e5d58bc3`, вход `admin/admin123`.

| # | Сценарий | Результат |
|---|---|---|
| 1 | Request `MKT-REQ-00000401` → «ДАННЫЕ ТУРИСТОВ»: добавление туриста (FIO+DOB), прогресс | PASS — «Заполнено 1 из 2», строка `#1` отрендерена, БД: `count=1, ready=false` |
| 2 | Edit туриста (prefill формы, смена фамилии) | PASS — БД `lastName=Updated`, `updatedAt` изменился |
| 3 | Delete туриста → восстановление исходного состояния | PASS — БД `count=0`, UI «Ожидаются данные туристов», «Заполнено 0 из 2» |
| 4 | Закрытая заявка (`CONVERTED`) → нет кнопок редактирования | PASS — «Заявка закрыта — состав туристов изменить нельзя» |
| 5 | Новая заявка `MKT-REQ-00000602` (accept → convert) → Order `ORD-00000101` | PASS — pin канонический §3: `firstName/lastName/birthDate/citizenship/passportSeries/passportNumber/passportExpiry = REQUIRED`, `gender = NOT_REQUESTED`; §15 verdict `BLOCK / MISSING_PASSPORT_EXPIRY` |
| 6 | Order-панель: все7 полей §3 + префилл FIO+DOB из Request | PASS — «Турист 1 из 2: Browser / Check / 02.02.1990 …» |
| 7 | Сохранение полного состава с валидным сроком (2030-01-01) | PASS — БД все поля, `dataCompleteness=COMPLETE`, verdict `OK` |
| 8 | §14 point 1 в браузере: попытка сохранить просроченный паспорт (2020-01-01) | PASS — UI: «Ошибка сохранения: Order ORD-00000101: passport validation failed — Passport expires (2020-01-01) before trip end (2026-11-20)» (422), БД не изменилась (`2030-01-01`) |

Скриншоты: `%TEMP%\opencode\ord-1-fields.png` (поля §3), `%TEMP%\opencode\ord-2-gate-blocked.png` (422-гейт §14), `%TEMP%\opencode\req-3-complete-frozen.png` (заявка: «Заполнено 2 из 2» + freeze).

§14 point 2 (`finalConfirm`) и §14 point 3 (outbox `FAILED`) в браузере не воспроизводились (требуют манипуляции данными) — покрыты e2e `d3-traveler-collection` (12/12). §15-подсказки `EXPIRED/EXPIRING` покрыты юнит-тестами панели.

---

## 6. Browser/e2e fixture data (создано для проверки, НЕ относится к FIX B)

- `MKT-REQ-00000601` (`b97cfd8b-d072-47a9-978b-525c2d703d06`) — осталась в `CONFIRMED` (customer-accept отклонён: нет money; откат невозможен через API) — residue.
- `MKT-REQ-00000602` (`7b9e751d-4db8-4877-ab3c-e3603874ca6e`) + Order `ORD-00000101` (`c6b844c7-dc7d-4196-8a69-6bfbba42474e`, турист1 COMPLETE, турист2 INCOMPLETE) — browser fixture.
- Записи FIX B (`MKT-REQ-00000301`, `MKT-REQ-00000401`, `MKT-REQ-00000402`, `TH-2026-000101`) **не изменялись**: после теста `MKT-REQ-00000401` возвращено исходное состояние (`count=0`).

---

## 7. Known failures / pre-existing (не чинились, задокументированы)

1. **403 на `POST /api/v1/products`** (`catalog-access.policy.ts`, `Missing permission`) — падают `booking-lifecycle-completion`, `order-lifecycle-completion`, `order-creation-consumer`, `booking-requested-consumer` и ещё ~30 сьютов. Доказано pre-existing: baseline-прогон через `git stash push`/`git stash pop` дал **идентичные** падения на HEAD.
2. **422 на `POST /api/v1/buyer/requests`** — `buyer-requests`, `reverse-proposal`, `request-context`, `moderation`: на HEAD **62 failed / 42 passed (из 104)** — идентично рабочему дереву.
3. **`rate-plan.e2e-spec`**: на HEAD = 3 failed / 33 passed (идентично рабочему дереву); временный DEBUG-патч откачен — `git status` по файлу чист.
4. **`src/perf/perf-harness.spec.ts`** падает только при параллельном `npx jest` (227s под нагрузкой), в изоляции 72/72 PASS — флак.
5. **Полный `npm run test:e2e`** — heap OOM (exit=134) даже при `--max-old-space-size=6144` → только чанки по файлам.
6. **MinIO**: media-сьюты убивают процесс на :19000 (`killPortListener`) → после них MinIO перезапускать вручную (иначе `d4-representative-chain` падает с ECONNREFUSED).

---

## 8. Запреты соблюдены

Lifecycle Request⇄Order⇄Booking, Payment/CommissionPolicy/Supplier Markup/Storefront commission/WhatsApp, supplier passenger submission, новая pricing/visa engine, frontend fallback для битого pin, fake PII для записей FIX B — **не тронуты**; `gender` не удалялся и не заменялся на `passportSeries`; visa-rules engine и duration-aware trip end не реализовывались; никакого `git commit` / `git push`.
