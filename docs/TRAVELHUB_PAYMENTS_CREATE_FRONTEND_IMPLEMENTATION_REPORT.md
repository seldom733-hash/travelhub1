# TravelHUB — Create Payment (Frontend) Implementation Report

Дата: 2026-10-09
Промпт: `docs/prompts/TRAVELHUB_PAYMENTS_CREATE_FRONTEND_IMPLEMENTATION_PROMPT.md`
Аудит (предпосылка): `docs/TRAVELHUB_PAYMENTS_CREATE_READ_ONLY_AUDIT_REPORT.md` (вердикты §20: YES — FRONTEND ONLY для обоих сценариев)

---

## 1. Verdict

```text
PASS
```

Блокеры PASS отсутствуют:

- amount НЕ редактируемый — `readOnly disabled`, ввод невозможен (unit + live);
- frontend НЕ отправляет amount/currency — whitelist `buildCreatePaymentPayload` + тест на 15 forbidden-ключей;
- frontend НЕ отправляет bookingId — booking-сценарий резолвит `booking.linkedOrder.id` → `orderId`; тесты на отсутствие `bookingId` (payload + source);
- permission bypass невозможен — кнопка гейтится `useCan("finance.payment.create")`, backend авторитетен (403 → локализованная ошибка), ничего не обходится;
- Analytics payment cards/navigation не сломаны — файлы не изменялись, закреплено тестами;
- Order/Booking context работает — оба рендерят форму с preset и обновляются после 201 (unit + live);
- backend/schema НЕ изменялись этой задачей (см. §12, §13).

---

## 2. Files changed

Изменённые (frontend):

| File | Change |
|---|---|
| `frontend/lib/api.ts` | `export class HttpError extends Error { readonly status: number }`; `handle()` бросает `HttpError(message, res.status)` (обратносовместимо: extends Error) |
| `frontend/lib/i18n.tsx` | +24 ключа `payments.create.*` (ru/az/en) после `payments.table.empty` |
| `frontend/app/app/payments/page.tsx` | кнопка в `OperationsToolbarSlot`, `createOpen`/`canCreatePayment`, `handlePaymentCreated` → `load()`, `<CreatePaymentForm>` |
| `frontend/app/app/orders/[id]/page.tsx` | кнопка в Finance-секции, `presetOrder` от `order.*`, `onCreated` → `loadFinHistory()+loadOrder()` |
| `frontend/app/app/bookings/[id]/page.tsx` | кнопка в Finance-секции, `presetOrder` от `booking.linkedOrder?.id ?? booking.orderId`, `onCreated` → `loadBooking()` |

Новые (frontend):

| File | Purpose |
|---|---|
| `frontend/lib/payments.ts` | `PAYMENT_METHODS`, `CreatePaymentInput`, `buildCreatePaymentPayload` (whitelist), `createPayment()` → `POST /finance/payments`, `fetchPayableOrdersForSelect(100)`, `paymentCreateErrorKey` |
| `frontend/components/finance/CreatePaymentForm.tsx` | modal-форма (role=dialog), states idle/submitting/success, preset-режим, Esc-close, error/success-панели |
| `frontend/lib/payments-create.spec.ts` | unit: payload whitelist, allowlist, error-mapping, i18n RU/AZ/EN (9 tests) |
| `frontend/components/finance/CreatePaymentForm.spec.tsx` | unit: рендер, заказы, readonly amount, reason, preset, POST, double-click, 403/404/409/422 (12 tests) |
| `frontend/app/app/payments/page.spec.tsx` | unit: гейт по праву, открытие, refresh после 201, 403 (4 tests) |
| `frontend/lib/payment-create-contexts.spec.tsx` | source-контракт: AC-10…AC-14 (11 tests) |

Backend/schema: изменений нет (см. §12/§13).

---

## 3. Payments UI

- Кнопка `+ Создать платеж` (`data-testid="payments-create-button"`) первой в `OperationsToolbarSlot`, рендерится только при `useCan("finance.payment.create")` (`page.tsx:436-445`).
- Modal `CreatePaymentForm`: `<div role="dialog">` с заголовком «Создать платеж», клик по backdrop не закрывает (только Cancel/Esc/success).
- Order-селект: `fetchPayableOrdersForSelect(100)` → `GET /orders?pageSize=100`, клиентская фильтрация `CANCELLED/CLOSED` (backend на них → 422 `ORDER_NOT_PAYABLE`). Без preset — селект обязателен.
- Сумма/валюта: `readOnly disabled`, значение из выбранного заказа (`fmtMoney`, `toLocaleString(LOCALE_TAGS)`), подпись `readonly_hint` («сумма определяется сервером»).
- Payment method: select `cash | card | bank_transfer | other` (default `cash`), 4 i18n-опции.
- Reason: обязательный, `maxLength=255`, кнопка `Создать` disabled пока не заполнен заказ (или preset) и reason; guard от двойного submit (`phase !== "submitting"`).
- Note: опциональный, `maxLength=5000`.
- Успех (201): `role="status"` панель «Платёж успешно создан», авто-закрытие через 900мс, `onCreated` → `load()` (рефреш registry с сохранением фильтров/страницы).
- Ошибки: `role="alert"`, локализованные ключи по HTTP-статусу из `HttpError.status` (403/404/409/422), fallback — raw message сервера.
- Live smoke (Chrome CDP, сессия админа): кнопка видна; modal открывается; селект заказов загрузил реальные заказы `MKT-ORD-00000803 · 1 720,00 USD`, `MKT-ORD-00000501 · 3 659,00 USD` (GET /orders 200); после выбора заказа amount = `1 720,00 USD`, disabled=true; submit включается только после reason; Esc закрывает; **0 POST на `/finance/payments`** (оплату не создавали — данные dev-БД не тронуты).

---

## 4. Order UI

- Кнопка `+ Создать платеж` (`data-testid="order-create-payment-button"`) в Finance-секции detail-страницы, тот же `useCan`-гейт.
- Preset: `presetOrder={{ id: order.id, label: order.referenceNumber, amount: order.amount, currency: order.currency }}` → селект заказа заменён на readonly-инпут с `order.referenceNumber`.
- `onCreated` → `void loadFinHistory(); void loadOrder();` (AC-9 для контекста заказа).
- Live smoke: на `/app/orders/4dedb0f6-…` (MKT-ORD-00000803) кнопка найдена (`count=1`).

---

## 5. Booking UI

- Кнопка `+ Создать платеж` (`data-testid="booking-create-payment-button"`) в Finance-секции.
- Preset-Order: `booking.linkedOrder?.id ?? booking.orderId` — `Payment.bookingId` не существует (аудит §4), серверный контракт требует `orderId`; для порядка фоллбека `booking.orderId` закреплён комментарием AC-13.
- Label preset: `linkedOrder.referenceNumber ?? orderReference ?? orderCode`; amount/currency: `financialSummary?.totalAmount/currency ?? booking.amount/currency`.
- `onCreated` → `void loadBooking();` — booking detail перезагружает бронь (включая `financialSummary`/связанные платежи) после 201.
- Live smoke: на `/app/bookings/d61ada19-…` кнопка найдена (`count=1`); открытие формы даёт readonly `MKT-ORD-00000803` + readonly `1 720,00 USD` (linkedOrder того же заказа) — preset работает.

---

## 6. Analytics verification

Файлы Analytics НЕ изменялись. Закреплено тестами `lib/payment-create-contexts.spec.tsx`:

- `lib/metric-drilldown.ts`: `analytics.finance.payment_count` / `analytics.finance.payments` → `destination: "/app/payments"`;
- `components/command-center/SectionGrid.tsx`: `"payments-captured"` → `/app/payments?paymentStatus=CAPTURED`, `"refunds-processed"` → `/app/payments?refundStatus=PROCESSED`;
- `app/app/analytics/page.tsx`: использует `resolveDrilldownUrl(METRIC_CONFIGS["analytics.finance.payment_count"])`; не содержит `CreatePaymentForm`/`finance/payments`.

---

## 7. API integration

- `createPayment()` → `api.post("/finance/payments", payload)` (зафиксировано тестом: точный URL `http://localhost:3000/api/v1/finance/payments`).
- `buildCreatePaymentPayload` — whitelist: `orderId`, `reason`, `paymentMethod?`, `initialNote?`; `reason.trim()`; пустые `paymentMethod/initialNote` отбрасываются; **никогда** не включает amount/currency/bookingId/status и 15 прочих forbidden-ключей (тест-список).
- `paymentCreateErrorKey`: `HttpError.status` 403→`error.forbidden`, 404→`error.not_found`, 409→`error.conflict`, 422→`error.validation`, иначе→`null` (generic).
- Order-селект: `GET /orders?pageSize=100` (нужен `order.read` — FINANCE/ADMIN/DIRECTOR/ANALYST/SALES_MANAGER имеют), клиентский фильтр непригодных статусов.
- Backend-контракт (аудит §4): amount/currency server-owned из `order.amount`, RBAC `finance.payment.create`, 201 на успех — frontend под него подстроен, ничего не дублируется на клиенте.

---

## 8. Permission handling

- Все три кнопки гейтятся `useCan("finance.payment.create")` (Payments/Order/Booking) — без права кнопка не рендерится (unit: `payments/page.spec.tsx`, тест «без права кнопка отсутствует»).
- Backend авторитетен: даже при обходе UI POST вернёт 403 → форма показывает локализованный «Нет прав…» (unit-тест 403 + generic mapping).
- Никаких обходов/имитаций прав на клиенте; `useUser` в тестах замокан только для рендера.
- Live smoke: ADMIN (role `ADMIN`) кнопку видит.

---

## 9. i18n

- 24 ключа блока `payments.create.*` в `lib/i18n.tsx` (ru/az/en): button, title, order, amount, method(+4 значения), reason, reason_hint, note, submit, cancel, success, error.{forbidden,not_found,conflict,validation,generic}, select_order, loading_orders, no_orders, readonly_hint.
- Тест (`payments-create.spec.ts`): каждый ключ для каждого локали существует, непуст, не равен ключу и не содержит `payments.create.`; ru ≠ en (переводы не-заглушки).
- Live smoke: RU-лейаут формы («Заказ/Сумма/Способ оплаты/Причина», «Наличные/Банковская карта/Банковский перевод/Другое») — без raw-ключей.

---

## 10. Tests

Новые (все зелёные):

- `lib/payments-create.spec.ts` — 9 tests (payload whitelist/forbidden keys, allowlist ровно cash/card/bank_transfer/other, trim/опциональность, error-mapping, i18n RU/AZ/EN);
- `components/finance/CreatePaymentForm.spec.tsx` — 12 tests (рендер+загрузка заказов, closed→null, readonly amount, reason required, preset-фиксация, точный POST payload, double-click→1 POST, 403/404/409/422 кейсы, generic 400);
- `app/app/payments/page.spec.tsx` — 4 tests (кнопка видима/скрыта по праву, открытие, POST→refresh, 403);
- `lib/payment-create-contexts.spec.tsx` — 11 tests (AC-10…AC-14 source-контракт).

Полный прогон frontend: **65 test files / 1031 tests — PASSED** (затронутые прежние: `payments-registry` 35, `operations-center-shell` 19, `i18n` 9, `api` 5 — не сломаны).

Live smoke (Chrome CDP :9333, реальный backend :4000, логин `admin`): AC-1/3/4/6/7/10/11/12 подтверждены на живом UI; оплата НЕ создавалась (0 POST `/finance/payments`, dev-данные не изменялись).

---

## 11. Typecheck

- `npx tsc --noEmit` (frontend) → **0 ошибок** (прогнан после всех правок).
- ESLint: в frontend отсутствует eslint-конфиг (`npm run lint` → `eslint` без config; единственная конфигурация — `legacy/eslint.config.mjs`, вне frontend) — существующее состояние проекта, не связано с этой задачей.

---

## 12. Backend untouched confirmation

- Эта задача не выполняла ни одного write-действия в `backend/`: только чтение (`Read`/`Grep`) для сверки контракта.
- `git status`: в `backend/src/modules/finance/**` изменений нет; `backend/prisma/schema.prisma` имеет **предсуществующее** изменение (M4 `phoneCanonical`, `OrderTraveler.passportSeries`) от предыдущих задач — этой задачей не трогалось (проверено `git diff`: только M4/traveler-ханки).
- Live smoke — строго read-only (GET/POST не отправлялось).

---

## 13. Schema untouched confirmation

- Миграции не создавались/не изменялись; `prisma/schema.prisma` не редактировался (см. §12 — diff полностью приписывается предыдущим задачам M4/traveler).
- Контракт `Payment`/`Order`/`Booking` (в т.ч. отсутствие `Payment.bookingId`) взят из существующей схемы без изменений.

---

## 14. Git status

- HEAD: `75c6bea` — не менялся; staged изменений нет; **commit/push не выполнялись** (NO COMMIT / NO PUSH по §12).
- Изменённые frontend-файлы (10): `lib/api.ts`, `lib/i18n.tsx`, `app/app/payments/page.tsx`, `app/app/orders/[id]/page.tsx`, `app/app/bookings/[id]/page.tsx` + новые `lib/payments.ts`, `components/finance/` (2 файла), `lib/payments-create.spec.ts`, `lib/payment-create-contexts.spec.tsx`, `app/app/payments/page.spec.tsx`.
- Остальной dirty-worktree (whatsapp/login/register/…) — предсуществующие изменения прошлых задач, не тронуты.

---

## 15. Known limitations

1. Order-селект загружает первые 100 заказов (`pageSize=100`) без поиска внутри селекта — на очень больших датасетах потребуется combobox; клиентски отфильтровываются `CANCELLED/CLOSED` (сервер на них отвечает 422 по design).
2. Allowlist методов — строчные `cash/card/bank_transfer/other` (AC-7); стандартизированных значений для этого набора в проекте нет, demo-seed использует UPPER_CASE (`CARD/BANK_TRANSFER/MOBILE_PAYMENT`) — legacy-строки в реестре отображаются как есть (fallback на raw value), это косметика существующих данных, а не ошибки создания.
3. Success-фидбек — внутри модалки (панель + авто-закрытие 900мс), затем refresh контекста; отдельного toast-хаба в проекте нет.
4. Live- smoke не создавал платёж (намеренно: без мутации dev-данных); полный 201-путь покрыт существующими backend-e2e (`payment-flow.e2e`) и unit-тестом точного payload; UI-путь до отправки проверен live.
5. ESLint недоступен в frontend (нет конфига) — pre-existing.

---

## 16. Final acceptance matrix

| AC | Описание | Статус | Evidence |
|---|---|---|---|
| AC-1 | `+ Создать платеж` в Центре управления → Платежи | YES | `page.spec.tsx` (тест 1) + live: кнопка на `/app/payments` |
| AC-2 | Без `finance.payment.create` кнопки нет | YES | `page.spec.tsx` (тест 2, мок `useCan`→false) |
| AC-3 | Можно выбрать Order | YES | `CreatePaymentForm.spec` (загрузка заказов) + live: 2 реальных заказа в селекте |
| AC-4 | Amount/currency read-only | YES | spec (readonly+disabled) + live: `1 720,00 USD`, disabled=true |
| AC-5 | Amount/currency не отправляются | YES | `payments-create.spec`: whitelist + отсутствие 15 forbidden-ключей в payload |
| AC-6 | Reason обязателен | YES | spec (submit disabled до reason) + live |
| AC-7 | Методы cash/card/bank_transfer/other | YES | spec (allowlist ровно 4) + live: 4 опции |
| AC-8 | POST `/api/v1/finance/payments` | YES | spec (точный URL+payload); live: отправка не выполнялась (сознательно, §15.4) |
| AC-9 | После 201 registry обновляется | YES | `page.spec.tsx` (POST→`load()`≥2 вызова) |
| AC-10 | Order detail: кнопка + авто-выбранный Order | YES | contexts-spec (preset `order.id`) + live: кнопка `count=1` |
| AC-11 | Booking detail: кнопка + `booking.linkedOrder.id` | YES | contexts-spec (preset `linkedOrder.id ?? orderId`) + live: preset `MKT-ORD-00000803` |
| AC-12 | `bookingId` не отправляется | YES | `payments-create.spec` (нет в payload) + contexts-spec (нет в booking-строке) |
| AC-13 | Booking обновляет financialSummary/activePayment | YES | contexts-spec (`onCreated` → `void loadBooking()`); live не создавал платёж (§15.4) |
| AC-14 | Analytics payment cards/navigation не сломаны | YES | contexts-spec (11 тестов: destinations, query-params, analytics-страница не тронута) |
| AC-15 | RU/AZ/EN работают | YES | `payments-create.spec` (24 ключа × 3 локали) + live RU |
| AC-16 | Frontend typecheck | YES | `npx tsc --noEmit` → 0 errors |
| AC-17 | Все новые/затронутые тесты | YES | 65 files / 1031 tests PASSED (36 новых) |
| AC-18 | Backend/schema не изменены | YES | §12, §13 |

Git policy (§12): соблюдена — NO COMMIT, NO PUSH; изменены только frontend-файлы.
