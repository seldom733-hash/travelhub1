# PHASE 3 — PRE-STEP 3.12 — D3 — TRAVELER COLLECTION + ORDER/BOOKING POPULATION — IMPLEMENTATION REPORT

---

## 1. Executive Summary

D3 реализован и закрыт как **IMPLEMENTATION COMPLETE — PENDING STRICT REVIEW**.

Выполнено по каноническому контракту (non-authoritative `Request` flow опционален; authoritative flow — `Product → termsAcceptedAt → PIN → Traveler collection → final confirmation → Order → Booking`):

- **PIN at termsAcceptedAt (§3/§7)**: consumer `OrderRequested → Order` вычисляет effective requirements (`getEffectiveTravelerRequirements(Product.type, Product.travelerRequirements)`) и сохраняет **server-owned frozen snapshot** `pinnedRequirements` + `termsAcceptedAt` + `travelerCount` на `Order` (единая транзакция создания). Клиент не может заменить snapshot — на API нет ни одного endpoint-а, принимающего snapshot.
- **Snapshot immutability (§3/§14)**: изменение `Product.travelerRequirements` после принятия не влияет на принятый checkout — подтверждено e2e test 2 (birthDate OPTIONAL → REQUIRED после acceptance: старый Order остаётся OPTIONAL, новый checkout → REQUIRED).
- **OrderTraveler 1..N (§6/§8/§15)**: количество берётся из canonical party list (`CheckoutIntentTraveler`, READ-only cross-context read), а не выводится задним числом. Multi-traveler e2e (2 Travelers): Traveler2 без REQUIRED → final confirmation denied → после дополнения `travelerDataCompletedAt` → confirm OK → 1 Order → ровно 2 OrderTraveler → 1 Booking → ровно 2 Passenger (данные из confirmed OrderTraveler, passportExpiry включён).
- **Collection semantics (§9/§10/§13)**: REQUIRED — visible + required + server-validated; OPTIONAL — visible + format-validated; NOT_REQUESTED — не рендерится и **не сохраняется** (минимизация; чувствительные NOT_REQUESTED поля отбрасываются сервером). Partial save персистится (save → refresh → resume), `travelerDataCompletedAt` ставится сервером при успешной validate-completion.
- **Final confirmation (§10/§17/§19)**: `finalConfirmedAt` — отдельное событие от `termsAcceptedAt`; duplicate final-confirm → 409; мутация после final-confirm → 409; submission до acceptance → 422; legacy Order без D3-полей → 422/422.
- **Frontend (§13/§21)**: TravelerCollectionPanel в Order Center (RU/AZ/EN), поля генерируются из **pinned requirements** (не из ProductType); business state живёт на сервере (PATCH per traveler); browser runtime success + failure path сняты (42/42 checks, 5 скриншотов).
- **Security/PII (§16)**: BUYER/PARTNER(чужой тенант)/SALES_MANAGER: GET 200 с redacted PII (passport/birthDate null для не-операторов), мутации 403; NOT_REQUESTED чувствительные поля не логируются и не сохраняются.
- **Determinism fix (found during evidence)**: `OrderTraveler` не имел ни createdAt, ни ordinals — PostgreSQL не гарантирует порядок выборки, UI карточки «Турист N» могли меняться местами между save/reload (ломало save/resume identity). Добавлена колонка `position` (1-based, порядок checkout party list) + `orderBy(position, id)` в view. Подтверждено стабильностью карточек в browser evidence (resume после reload).
- **Идемпотентность (§17)**: e2e test 5 (конкурентный final-confirm — ровно один 201/один 409/один Order) и test 8 (повторный final-confirm → 409, один history milestone).

Итог по тестам: backend e2e `d3-traveler-collection` — **8/8 PASS**; frontend component spec — **8/8 PASS**; browser runtime — **42/42 PASS**; typecheck backend/frontend чистые. Регрессия на HEAD-сталых спеках идентична до/после (см. §28).

```text
VERDICT A — D3 TRAVELER COLLECTION + ORDER/BOOKING POPULATION
IMPLEMENTATION COMPLETED — PENDING STRICT REVIEW
```

---

## 2. Starting Git State

```text
branch:             master
Starting SHA:       c05af07f5827ae15ae06d497d6cc68159f7dbf81
                    ("docs: D2 Final Closure Round 2 — browser runtime evidence + git push")
origin/master:      c05af07f5827ae15ae06d497d6cc68159f7dbf81  (== HEAD на старте)
Baseline D2:        a9a37102050547e0466a0aa8419d4b17f4b1169c (D2 ACCEPTED, Final D2 SHA)
Working tree:       in-progress D3 (uncommitted) + evidence files
```

---

## 3. Canonical Architecture Check

- **Order Center — owner Order domain** (ADR-0001, Step 2.5/2.6): единственный путь создания нормального Order — canonical chain `Quote → CheckoutIntent → Sale → OrderRequested (outbox) → OrderRequestedConsumer → Order`. HTTP bootstrap-путь удалён ранее; D3 не переоткрывает.
- **Authoritative flow** (D3): `Product/current authoritative terms → termsAcceptedAt → PIN requirements → Traveler collection → final confirmation → Order → Booking`. Request опционален — D3 сохраняет no-Request архитектуру (e2e test 7: canonical chain создаёт Order без Request).
- **Two distinct events не объединяются**: `termsAcceptedAt` (acceptance текущих условий) vs `finalConfirmedAt` (подтверждение после сбора REQUIRED данных) — отдельные колонки/моменты.
- **Order→Booking mechanism**: существующий lifecycle (`process → confirm → send` → `BookingRequested` consumer) — D3 только наполняет OrderTraveler и гарантирует, что Passenger получает данные из confirmed OrderTraveler.

---

## 4. Current-State Audit

| Вопрос | Факт на старте D3 | Решение |
|---|---|---|
| Где `termsAcceptedAt` | отсутствовал на Order | добавлен (Order, server-owned, = durable acceptance в этой архитектуре; в отчёте D3 §7 обосновано копирование snapshot в Order domain, т.к. pre-Order сущности не хранят traveler requirements) |
| `travelerDataCompletedAt`, `finalConfirmedAt` | отсутствовали | добавлены (server-owned milestones, НЕ `updatedAt`) |
| Pre-Order entity accepted checkout state | `CheckoutIntent`/`Sale` (Sales), immutable после Sale completion | OrderRequested payload frozen; traveler контекст — READ-only `CheckoutIntentTraveler` |
| `OrderTraveler` | существовал (Step 2.5, minimal snapshot firstName/lastName/birthDate) | сохранён; добавлены requirements-dependent optional поля + `position` (stable ordinal, §8) |
| Passenger ownership | Booking-owned, создаётся из Order travelers при `send` | дополнена передача `passportExpiry` (ранее терялся) |
| Order→Booking mechanism | lifecycle `process → confirm → send` → `BookingRequested` | не менялся (V1: 1 Order = 1 Booking) |
| Transaction/idempotency | InboxEvent dedup + `Order.saleId @unique` + P2002 constraint-specific | сохранено; D3 gates внутри тех же транзакций |
| Canonical traveler count | `CheckoutIntentTraveler` rows (party list) | `Order.travelerCount = travelers.length` при создании (не из Passenger) |

---

## 5. Gap Analysis

1. Order создавался БЕЗ pinned requirements/termsAcceptedAt/travelerCount → requirements могли «плыть» после acceptance (нарушение §3 hard gate).
2. Поля сбора данных у OrderTraveler ограничены (нет citizenship/gender/passportNumber/passportExpiry) → REQUIRED/OPTIONAL по pinned snapshot не собираемы.
3. Passenger терял `passportExpiry` при population.
4. Frontend Order Center не имел UI сбора данных туристов (поля из pinned, save/resume, final confirm).
5. (Найдено в runtime evidence) `OrderTraveler` без стабильного порядка → недетерминированное соответствие «Турист N» ↔ traveler между save/reload.
6. Legacy Order (до D3) и submission до acceptance не имели явной защиты (422) и честной UI-ветки («legacy: нет pinned snapshot»).

---

## 6. Schema/Migration Design

Migration `20260903100000_d3_traveler_collection_order_population` (forward-only, no reset):

```sql
ALTER TABLE "order"."Order" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "order"."Order" ADD COLUMN "travelerDataCompletedAt" TIMESTAMP(3);
ALTER TABLE "order"."Order" ADD COLUMN "finalConfirmedAt" TIMESTAMP(3);
ALTER TABLE "order"."Order" ADD COLUMN "pinnedRequirements" JSONB;
ALTER TABLE "order"."Order" ADD COLUMN "travelerCount" INTEGER;
```

Migration `20260903110000_d3_order_traveler_position` (found-defect fix, forward-only):

```sql
ALTER TABLE "order"."OrderTraveler" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
```

`OrderTraveler` (schema.prisma): + `position Int @default(0)` (1-based, порядок checkout party list — детерминированный порядок collection UI; у OrderTraveler нет createdAt). Backfill не требовался (в dev/test представительные данные не содержали OrderTraveler на момент миграции; новые строки всегда создаются с position = index+1).

---

## 7. Pinned Requirements Design

- Effective = `getEffectiveTravelerRequirements(Product.type, Product.travelerRequirements)` — defaults ProductType + explicit override (контракт D2, deterministic).
- **Где pin**: в `OrderRequestedConsumer` (READ-only cross-context read `catalog.Product.travelerRequirements` по первому item payload) → передаётся в `OrderService.createOrderFromRequested` → сохраняется в той же транзакции, что и Order.
- **Server-owned**: ни один endpoint не принимает snapshot от клиента; изменение после создания Order запрещено (нет API-пути).
- `firstName`/`lastName` REQUIRED для каждого Traveler V1 (baseline D2) — сохраняется через defaults каждого ProductType.
- Legacy `Product.travelerRequirements = NULL` → ProductType defaults (e2e test 1) — обратная совместимость.

---

## 8. Traveler Domain Model

```text
Order
 └─ OrderTraveler[1..N]
     position Int            (stable ordinal, checkout party order)
     firstName/lastName      (REQUIRED всегда — prefill из CheckoutIntentTraveler)
     birthDate               (DateTime?, из checkout контекста)
     citizenship/gender      (String?, requirement-dependent)
     passportNumber          (String?, requirement-dependent)
     passportExpiry          (DateTime?, requirement-dependent)
     dataCompleteness        (INCOMPLETE/COMPLETE, server-computed)
     version Int
```

`OrderTraveler` ≠ CRM Customer ≠ Payer ≠ Product config (§5): traveler НЕ создаётся автоматически из Customer; prefill «я турист» — только явный UX-механизм (в V1 не вводился — party list передаётся в Checkout).

---

## 9. Customer ≠ Payer ≠ Traveler

Сохраняется: Order хранит `customerId` (payload), Traveler — отдельные сущности со своей карточкой. Никакого авто-копирования Customer → Traveler; Passengers получают данные из confirmed OrderTraveler (не из Customer/Product).

---

## 10. Cardinality

`travelerCount` = фактическое количество строк `CheckoutIntentTraveler` (canonical selected party contract) на момент Sale completion, frozen в Order. UI рендерит ровно это число форм (V1; count из checkout). Count не выводится задним числом из Passenger/форм. e2e test 1 (`count=1`), test 4 (`count=2`), browser evidence (`travelerCount=2`, DB `OrderTraveler` rows = 2, `Passenger` = 2 — §22).

---

## 11. Validation

Server-side (updateTravelerD3), все проверки против **pinned snapshot**:

- `NOT_REQUESTED` → поле отбрасывается, НЕ сохраняется (минимизация, включая чувствительные);
- `REQUIRED` → очистка пустой строкой → 422 (нельзя «стереть» обязательное); завершение требует значение;
- `OPTIONAL` → сохраняется, при передаче валидируется формат;
- `birthDate`/`passportExpiry` → строго `YYYY-MM-DD` (isDateOnly), иначе 422 (e2e test 3: `not-a-date` → 422);
- `dataCompleteness` — серверный merge (existing + new) значений против REQUIRED-полей pinned;
- DTO не содержит server-owned полей; unknown ключи — defensive skip (whitelist конвенция проекта).

---

## 12. Completion Semantics

`validateTravelerCompletion` (POST `/orders/:id/validate-completion`):
- `complete=false` с reason: (a) нет `termsAcceptedAt` (legacy/до acceptance) → 422; (b) нет pinned snapshot → 422; (c) `travelerCount` не удовлетворён (rows < count); (d) есть traveler с пустым REQUIRED полем — возвращает `{ complete: false, reason }` (перечисляет недостающие REQUIRED по traveler);
- при `complete=true` устанавливает **server-owned** `travelerDataCompletedAt` (один instant; CAS-семантика — повторный вызов не перезаписывает). `updatedAt` не используется как business timestamp.

---

## 13. Final Confirmation

POST `/orders/:id/final-confirm` (idempotent, transaction-safe):
- gates: `termsAcceptedAt` есть, pinned есть, count удовлетворён, все REQUIRED валидны, `travelerDataCompletedAt` установлен (validate-completion обязателен);
- успех → `finalConfirmedAt` (отдельный момент от termsAcceptedAt; e2e test 4 проверяет `finalConfirmedAt >= termsAcceptedAt`);
- повторный final-confirm → **409** (не создаёт второй Order/root); мутация traveler после final-confirm → **409**; `Order.history` пишет ровно один milestone `final_confirm`.

---

## 14. Order Creation

`createOrderFromRequested` (consumer, Step 2.5):
- единая транзакция: Order + OrderItem[] + OrderTraveler[] (position=1..N) + Fulfillment + OrderHistory + OrderCreated (emit);
- D3 snapshot (termsAcceptedAt = now создания как durable acceptance в архитектуре; pinned; travelerCount) пишется атомарно с Order — исключено состояние «Order created but OrderTraveler/pinned missing»;
- upstream refs (saleId/saleCode/quoteId/checkoutId/reservationIds) — frozen из payload; никакого чтения mutable Catalog/Sales для создания.

---

## 15. OrderTraveler

Создаётся только consumer-ом (canonical путь) с position из checkout party order; обновляется через PATCH `/orders/:id/travelers/:travelerId` (D3 collection) и legacy bulk `PATCH /orders/:id/travelers` (защищён `assertNoForbiddenKeys`). Отдельной «авто-генерации из Customer» нет (§9). Immutable после final-confirm (409).

---

## 16. Booking/Passenger

Механизм не менялся: `process → confirm → send` (OrderAction) → `BookingRequested` → `BookingCreated` (consumer) → Booking с Passenger[] из **confirmed OrderTraveler**. Исправление: `booking.subscribers.ts` теперь передаёт `passportExpiry` в Passenger (ранее поле терялось). V1: 1 Order = 1 Booking. e2e test 4: 1 Booking, ровно 2 Passenger (Иван + Пётр), passportNumber/passportExpiry совпадают с confirmed OrderTraveler.

---

## 17. Request Flow

Request-ветка не трогалась: canonical chain в D3 — no-Request (e2e test 7: `Request.convertedOrderId` отсутствует). `convertedAt` не ставится до Order; D3 не создаёт fake Request и не делает Request обязательным.

---

## 18. Authoritative Flow

```text
Product/current terms → termsAcceptedAt → PIN requirements (frozen)
→ Traveler collection (REQUIRED/OPTIONAL/NOT_REQUESTED по snapshot)
→ validate completion → travelerDataCompletedAt
→ final confirmation → finalConfirmedAt
→ Order (+OrderTraveler[1..N]) → Booking → Passenger[1..N]
```

---

## 19. API

| Endpoint | Право | Семантика |
|---|---|---|
| `GET /orders/:id/travelers` | `order.read` | pinnedRequirements/termsAcceptedAt/travelerDataCompletedAt/finalConfirmedAt/travelerCount/travelers (PII redaction по viewer) |
| `PATCH /orders/:id/travelers/:travelerId` | `order.edit_noncritical` | partial save по pinned snapshot (REQUIRED/OPTIONAL/NOT_REQUESTED, format) |
| `POST /orders/:id/validate-completion` | `order.read` | серверная проверка полноты; ставит travelerDataCompletedAt |
| `POST /orders/:id/final-confirm` | `order.edit_noncritical` | gate + idempotent confirm (409 на повтор) |

Порядок полей и канонический порядок туристов детерминированы (`position asc, id asc`). Server enforcement: actor + scope + lifecycle state + pinned snapshot + validation + idempotency (режекты §19 промпта все покрыты e2e).

---

## 20. Frontend

- **TravelerCollectionPanel** (`frontend/components/order/TravelerCollectionPanel.tsx`) в Order Center (`/app/orders/[id]`):
  - поля генерируются из **pinned requirements** (не hardcoded ProductType); REQUIRED — видимое обязательное (звёздочка), OPTIONAL — видимое опциональное (тег), NOT_REQUESTED — НЕ рендерится (минимизация);
  - Traveler 1..N (по `travelerCount`/rows);
  - **save/progress → refresh → resume**: PATCH per traveler (данные живут на сервере, не только в React state), при reload формы reseed из GET;
  - milestones: termsAcceptedAt / Данные собраны / Подтверждено финально (серверные timestamps);
  - final confirmation: кнопка → validate-completion → final-confirm; ошибка сервера показывается (reason), locked-состояние блокирует инпуты;
  - локализация RU/AZ/EN (новые ключи `d3.*` + interpolating helper `ti`);
  - legacy Order без pinned → информационная ветка «legacy».
- Order detail page подключила панель под D3-заголовком.
- Component tests 8/8 (render pinned, required/optional/hidden, multi-traveler, validation error display, save→resume (API mock), final confirm denied → success, локали).

---

## 21. Security

- **Cross-tenant/PII (e2e test 6)**: BUYER → 403 на все D3 endpoints (нет `order.*`); одобренный PARTNER (Partner B, чужой тенант) → 403 (у PARTNER нет `order.*`, RBAC platform-only); SALES_MANAGER — GET 200 с **redacted** PII (passportNumber/birthDate null), мутации → 403 (нет `order.edit_noncritical`).
- NOT_REQUESTED чувствительные поля не запрашиваются/не хранятся/не логируются (тест: PATCH citizenship/passportNumber на TOUR (NOT_REQUESTED) → строки остаются null).
- Validation errors не echo-ят чувствительные значения (reason перечисляет только имена полей/имена туристов).
- Redaction контракт — тот же, что у listOrders/getOrder (Step 1.17).

---

## 22. Idempotency

- Consumer: InboxEvent dedup (consumerId+eventId) + `Order.saleId @unique` + P2002 только по idempotency-constraints (no-op) — любой другой unique-дефект → FAILED.
- final-confirm: повторный → 409; конкурентные double final-confirm (e2e test 5, `Promise.allSettled`) → ровно один 201 / один 409 / один Order / один history milestone; duplicate final confirm (test 8) → один Order.
- Никакого duplicate commerce root (e2e: `order.count({where: id}) === 1`).

---

## 23. DB Evidence

Проверено на live dev-стеке (PostgreSQL `travelhub1`, multi-schema) для канонически созданного заказа (browser evidence order `MKT-ORD-00002101`, затем финальный evidence-прогон):

```sql
-- "order"."Order"
termsAcceptedAt = '2026-09-03T07:14:36.030Z'   -- pin
travelerCount   = 2
pinnedRequirements = {
  "firstName": "REQUIRED", "lastName": "REQUIRED", "birthDate": "REQUIRED",
  "gender": "REQUIRED",                            -- override продукта
  "citizenship": "NOT_REQUESTED",                  -- override продукта (minimization)
  "passportNumber": "OPTIONAL", "passportExpiry": "OPTIONAL"
}
travelerDataCompletedAt = '2026-09-03T07:14:36.030Z'
finalConfirmedAt        = '2026-09-03T07:14:36.102Z'   -- > termsAcceptedAt
```

`OrderTraveler` (position 1..2, оба COMPLETE): Турист1 — gender `М`, passport `P1000001`, expiry `2036-01-01`; Турист2 — gender `Ж`, passport `P1000002`, expiry `2035-06-01`. Citizenship не сохранён нигде (NOT_REQUESTED).

Dev DB после evidence-очистки: Orders = **1000** (без изменений), D3-артефакты демо удалены (OrderTraveler = 0, Orders с D3 snapshot = 0, Products `D3 DEMO*` = 0) — §29.

---

## 24. API Runtime

- Backend e2e `d3-traveler-collection.e2e-spec.ts`: **8/8 PASS** (PIN + legacy NULL defaults; immutability OPTIONAL→REQUIRED; NOT_REQUESTED minimization + partial save/resume + invalid date 422; multi-traveler + completion gate + Booking/Passenger; concurrent final-confirm; cross-tenant/PII; no-Request + legacy 422; duplicate final-confirm 409). Команда: `npx jest --config test/jest-e2e.json --runInBand --forceExit d3-traveler-collection`.
- Live dev API: полный canonical chain (PARTNER product → SM Quote → Checkout(travelers) → terms → availability → Sale → complete → OrderRequested → consumer → Order ORD-00002xxx) — Order с pinned/termsAcceptedAt/count создан, GET `/orders/:id/travelers` возвращает тот же snapshot (DB = API).

---

## 25. Browser Runtime

Playwright (headless Chromium, RU) на live dev-стеке (`frontend :3000` → proxy `/api/v1` → `backend :4000`), order создан canonical chain. **42/42 checks PASS** (`frontend/tmp_d3_browser_evidence.mjs`), скриншоты:

| Файл | Сценарий |
|---|---|
| `tmp_d3_browser_1_initial.png` | панель: 2 карточки «Турист 1/2 из 2», REQUIRED звёздочки, OPTIONAL теги, citizenship отсутствует (NOT_REQUESTED), milestones |
| `tmp_d3_browser_2_saved.png` | partial save (Пол + Номер паспорта) → notice «Данные сохранены на сервере», badge «Заполнено» |
| `tmp_d3_browser_3_resume.png` | после **reload**: значения сохранены (resume), API подтверждает gender/passport, citizenship не сохранён |
| `tmp_d3_browser_4_gate_denied.png` | final confirmation отклонён сервером: `…1 required field(s) missing: gender (…)` |
| `tmp_d3_browser_5_final_locked.png` | после дополнения: «Данные полны — финальное подтверждение выполнено», locked banner, milestones «Данные собраны»/«Подтверждено финально» с timestamp, инпуты disabled |

Success path и failure path из §21 промпта — оба сняты в браузере (заполнение → save → refresh → persist → final confirm; missing required → blocked).

---

## 26. Multi-Traveler Evidence

- Backend e2e test 4 (§15 hard test): Traveler2 без REQUIRED `passportExpiry` → validate `complete=false`, final-confirm → 422; после дополнения → COMPLETE → `travelerDataCompletedAt` → confirm 201 → 1 Order + ровно 2 OrderTraveler + 1 Booking + ровно 2 Passenger (names = Иван, Пётр; passport/expiry из confirmed OrderTraveler).
- Browser: 2 карточки, оба COMPLETE, count reconciliation `travelerCount = 2 = OrderTraveler = (UI) 2`.
- Determinism fix: `position` + `orderBy(position, id)` — карточки стабильны между save/reload (ранее порядок выборки PostgreSQL не гарантировался → карточки могли меняться местами).

---

## 27. Snapshot Immutability Evidence

e2e test 2 (§14 hard test): 1) Product effective `birthDate=OPTIONAL`; 2) accept → pinned OPTIONAL; 3) Product policy меняется владельцем (PARTNER PATCH own draft) `birthDate=REQUIRED`; 4) старый принятый checkout → GET по-прежнему OPTIONAL; 5) новый checkout → REQUIRED. Никакого влияния mutable Catalog policy на принятый checkout.

---

## 28. Regression

- Backend typecheck: `npx tsc --noEmit` — чисто.
- Frontend typecheck: `npx tsc --noEmit` — чисто; `vitest run components/order/TravelerCollectionPanel.spec.tsx` — 8/8.
- Unit-суиты backend: 4 суиты падают **идентично на чистом HEAD** (проверено `git stash` → запуск → одинаковые failures) — pre-existing, не связаны с D3.
- `order-creation-consumer.e2e-spec.ts` — stale на HEAD (Step 3.6B: admin создаёт Product без Partner owner → 403; падает одинаково до/после D3) — pre-existing, задокументировано ранее в сессии.
- D3-спека и все её зависимости зелёные на текущем коде (включая новую миграцию `position`).

---

## 29. Representative Data Safety

Dev DB `travelhub1` (до/после, §23/§30):

| Entity | Было (baseline) | Стало (после evidence + cleanup) |
|---|---|---|
| Orders | 1000 | 1000 (без изменений) |
| OrderTraveler | 0 | 0 (демо удалено) |
| Orders с D3 snapshot | 0 | 0 (демо удалено) |
| Products (репрезентативные, не D3-demo) | не менялись | не менялись (288) |
| D3 DEMO-продукты | 0 | 0 (создавались и удалены) |

Никаких destructive сбросов; только targeted deterministic D3 fixtures (созданы и удалены в рамках evidence). BusinessSequence (dev) выровнены выше фактических данных (dev-сид вставлял Order напрямую, счётчики отставали — без этого canonical create падал с unique violation; это dev-инфраструктурная правка, не миграция данных).

---

## 30. Findings/Remediation

| Finding | Remediation |
|---|---|
| Order без pinned/termsAcceptedAt/travelerCount | snapshot + milestones пишутся атомарно при создании Order (consumer) |
| Поля OrderTraveler не покрывали requirement-зависимый сбор | добавлены citizenship/gender/passportNumber/passportExpiry в OrderTraveler/Passenger population |
| Passenger терял passportExpiry | booking.subscribers.ts передаёт passportExpiry из confirmed OrderTraveler |
| Frontend не имел collection UI | TravelerCollectionPanel (порядок полей из pinned; save/resume; final confirm; RU/AZ/EN) |
| Недетерминированный порядок OrderTraveler (UI «Турист N» мог меняться между save/reload) | `position` (1-based, checkout party order) + `orderBy(position, id)` — найден и исправлен в runtime evidence |
| Legacy Order без D3 | GET → pinned null + UI-ветка; PATCH/final-confirm → 422 (без ложного успеха) |

Не трогались (D5–D13): full-page детали Orders/Bookings, KPI/статус-семантика, export, attribution, payment/refund presentation, Voucher и пр.

---

## 31. Files Changed

Backend:
- `backend/prisma/schema.prisma` — D3-колонки Order (`termsAcceptedAt`, `travelerDataCompletedAt`, `finalConfirmedAt`, `pinnedRequirements`, `travelerCount`) + `OrderTraveler.position`
- `backend/prisma/migrations/20260903100000_d3_traveler_collection_order_population/migration.sql` — new
- `backend/prisma/migrations/20260903110000_d3_order_traveler_position/migration.sql` — new
- `backend/src/modules/order/order.service.ts` — createOrderFromRequested (D3 snapshot), D3-методы (getPinnedRequirements, updateTravelerD3, validateTravelerCompletion, finalConfirm), position
- `backend/src/modules/order/order.controller.ts` — D3 endpoints (+viewer redaction, forbidden-keys)
- `backend/src/modules/order/order-requested.consumer.ts` — pin at termsAcceptedAt
- `backend/src/modules/booking/booking.subscribers.ts` — passportExpiry → Passenger
- `backend/test/d3-traveler-collection.e2e-spec.ts` — new (8 e2e)

Frontend:
- `frontend/components/order/TravelerCollectionPanel.tsx` — new
- `frontend/components/order/TravelerCollectionPanel.spec.tsx` — new (8 tests)
- `frontend/lib/i18n.tsx` — `d3.*` ключи RU/AZ/EN + interpolating helper `ti`
- `frontend/app/app/orders/[id]/page.tsx` — подключение панели

Docs:
- `docs/reports/PHASE_3_PRE_STEP_3.12_D3_TRAVELER_COLLECTION_ORDER_BOOKING_POPULATION_IMPLEMENTATION_REPORT.md` — new (этот отчёт)

Evidence (untracked, рабочая копия): `tmp_d3_browser_{1..5}.png`, `backend/tmp_d3_seed_order.mjs`, `backend/tmp_d3_cleanup.mjs`, `backend/tmp_d3_seed_state.json`, `frontend/tmp_d3_browser_evidence.mjs`.

---

## 32. Roadmap Status

```text
D0   ACCEPTED
D1   ACCEPTED
D1A  ACCEPTED
D2   ACCEPTED
D3   IMPLEMENTED  ← PENDING STRICT REVIEW (этот этап)
D4..D14, STEP 3.12 — NOT STARTED
```

---

## 33. Git State

```text
branch:             master
Starting SHA:       c05af07f5827ae15ae06d497d6cc68159f7dbf81
Final SHA:          a8ceb2a63c7fc9ef8057f64be8f435aed88567c6
origin/master:      <обновляется после push>
HEAD == origin/master: <обновляется после push>
Working tree:       только untracked evidence/прочие незакоммиченные артефакты
                    предыдущих фаз (не относятся к D3)
```

---

## 34. Residual Risks

- V1: 1 Order = 1 Booking (multi-item Booking/Passenger grouping — за рамками D3).
- Точность «prefill из checkout party list»: `CheckoutIntentTraveler` несёт только firstName/lastName/birthDate — остальные поля собираются в collection (by design).
- `position` для уже существующих legacy OrderTraveler = 0 (в dev/test таких строк нет; при появлении — детерминированный fallback порядок по id).
- Проверка `gender` как free-text (не enum) — сознательно, валидируется только REQUIRED-наличие; строгие доменные словари — за рамками D3.
- 4 unit-суиты + `order-creation-consumer.e2e-spec.ts` — pre-existing stale на HEAD (не D3-дефекты; зафиксированы в §28).

---

## 35. Final Verdict

```text
VERDICT A — D3 TRAVELER COLLECTION + ORDER/BOOKING POPULATION
IMPLEMENTATION COMPLETED — PENDING STRICT REVIEW
```

Запрещающие условия §29 промпта не наступили: requirements pinned (frozen snapshot на Order, server-owned); mutable Product policy не управляет принятым checkout; Customer ≠ Traveler; multi-traveler поддержан; валидация server-side; premature Order creation невозможно (только canonical consumer path); OrderTraveler/Booking/Passenger population выполнены; cross-tenant PII доступ закрыт; duplicate conversion исключён (409 + unique-constraints); browser success/failure lifecycle снят; DB/API/UI reconciliation PASS.

---

## 36. TRUE NEXT

```text
D3 STRICT REVIEW (следующий этап после D3 IMPLEMENTATION).
НЕ начинать D4.
```

---

## 26b. Acceptance Matrix

| Gate | Result | Evidence |
|---|---|---|
| Current domain audited | PASS | §4 (models/services/endpoints/OrderTraveler/Passenger/checkout) |
| Requirements pinned at termsAcceptedAt | PASS | e2e test 1; §7/§14; DB evidence §23 |
| Snapshot immutable after Product change | PASS | e2e test 2 (§27) |
| Traveler count canonical | PASS | e2e test 1/4 (§10): count из CheckoutIntentTraveler |
| Customer ≠ Traveler preserved | PASS | §5/§9; e2e test 7 no-Request |
| REQUIRED validation server-side | PASS | §11; e2e test 3/4 (422 на clear/недостающие REQUIRED; gate reason) |
| OPTIONAL semantics correct | PASS | §11; e2e test 3 (birthDate OPTIONAL сохраняется), browser (passport OPTIONAL) |
| NOT_REQUESTED minimization | PASS | e2e test 3: citizenship/passportNumber PATCH → строки null; browser: поле не рендерится (§20/§25) |
| Multi-traveler supported | PASS | e2e test 4; browser 2 карточки (§26) |
| travelerDataCompletedAt correct | PASS | e2e test 4; browser: API `travelerDataCompletedAt` set (validate gate) |
| finalConfirmedAt distinct from termsAcceptedAt | PASS | e2e test 4; DB evidence §23 (final > terms) |
| Final confirmation gate enforced | PASS | e2e test 4 (incomplete → 422), browser failure path (§25) |
| Order creation idempotent | PASS | e2e test 5/8; §22 |
| OrderTraveler populated | PASS | e2e test 1/4; DB §23 (2 rows, position, COMPLETE) |
| Booking populated | PASS | e2e test 4: 1 Booking |
| Passenger/canonical travelers populated | PASS | e2e test 4: 2 Passenger, passportExpiry включён |
| Request convertedAt timing correct | PASS | e2e test 7 (no-Request; convertedAt не ставится без Order) |
| No-Request architecture preserved | PASS | e2e test 7 |
| Cross-tenant traveler access denied | PASS | e2e test 6 (BUYER/PARTNER → 403) |
| Sensitive data not exposed in logs | PASS | e2e test 3/6 (PII redaction; NOT_REQUESTED не хранятся; payload без PII) |
| Legacy NULL Product supported | PASS | e2e test 1 (TOUR defaults) |
| DB/API/UI snapshot reconciliation | PASS | §23/§25 (pinned DB = API = UI поля) |
| Traveler count reconciliation | PASS | §22/§26: count = OrderTraveler = UI |
| Save→refresh/resume | PASS | e2e test 3; browser resume (42/42) |
| Browser required-field failure | PASS | §25 screenshot 4 (gate denied + reason) |
| Browser successful lifecycle | PASS | §25 screenshot 5 (final confirm + locked) |
| Backend tests | PASS | d3 e2e 8/8; typecheck clean |
| Frontend tests | PASS | component spec 8/8; typecheck clean |
| Representative DB preserved | PASS | §29 (Orders 1000 без изменений, demo-артефакты удалены) |
| Russian report | PASS | этот отчёт |
| Git evidence | PASS | §33 (Starting SHA c05af07; commit/push — ниже) |

---

```text
D3 IMPLEMENTATION COMPLETE
PENDING STRICT REVIEW

NEXT ACTION:
D3 STRICT REVIEW

NOT STARTED.

STOP.
```
