# HOTEL IDENTITY FIX — FINAL IMPLEMENTATION REPORT

Source of truth: `HOTEL_IDENTITY_AUDIT_REPORT.md` (read-only, не менялся).
Implementation prompt: `HOTEL_IDENTITY_FIX_STRICT_IMPLEMENTATION_PROMPT_V2.md`.

---

## 19.1 Changed files

| File | Purpose |
|---|---|
| [backend/src/modules/supplier/tour-request.service.ts](../../backend/src/modules/supplier/tour-request.service.ts) | **FIX A**: Product lookup — supplier-scoped OR(`hotelExternalId`, `hotelKey`) по платформенному transport-id |
| [backend/src/modules/supplier/tour-request.service.spec.ts](../../backend/src/modules/supplier/tour-request.service.spec.ts) | Переписан false-confidence тест + матрица lookup-тестов A–F (§10) |
| [backend/src/modules/order/request.service.ts](../../backend/src/modules/order/request.service.ts) | **FIX B**: проекция convert — precedence live Product → frozen `Request.productSnapshot` |
| [backend/src/modules/order/request.service.dto.spec.ts](../../backend/src/modules/order/request.service.dto.spec.ts) | Проекционная матрица §11: 1 positive + 1 precedence + 6 negative |
| [backend/src/modules/supplier/kompas/kompas.adapter.spec.ts](../../backend/src/modules/supplier/kompas/kompas.adapter.spec.ts) | Контракт-комментарий §9.2: adapter владеет маппингом hotelKey→hotelExternalId (уже покрыто тестом) |
| [backend/src/modules/supplier/anex/anex.adapter.spec.ts](../../backend/src/modules/supplier/anex/anex.adapter.spec.ts) | Новые тесты §9.4: raw.hotelInc → hotelExternalId и обратный hotelInc-фильтр |

Адаптеры и sync-сервисы **не менялись** (маппинг уже реализован корректно — предусловие §15 выполнено).
Файлы изменялись только точечными hunk'ами; существовавшая несвязанная dirty-work в них сохранена.

## 19.2 Identity architecture

```text
transport = hotelExternalId          (generic DTO/HTTP/Request)
storage   = supplier-native identity (SAMO: attributes.hotelKey; ANEX: hotelInc — только в адаптерном слое)
mapping   = supplier adapter / lookup boundary
            - normalize: raw.hotelKey|hotelInc → SupplierOffer.hotelExternalId (адаптеры, без изменений)
            - read-side lookup: dto.hotelExternalId → attributes.hotelExternalId OR attributes.hotelKey (FIX A)
```

Никаких supplier-specific `if/else` в generic-коде: OR-lookup ключается по хранимым формам, а не по имени поставщика. Future-supplier acceptance criterion (§17) выполнен: новый поставщик с native-именем `objectId` реализуется только в его адаптере + одна запись в каталоге (`attributes.objectId`) — для его резолва lookup расширяется одним OR-членом в той же точке, DTO/HTTP/контракт не меняются.

## 19.3 Supplier matrix

| Supplier | Native ID | Platform ID | Изменения |
|---|---|---|---|
| SUMMERTOUR | hotelKey | hotelExternalId | нет |
| KOMPAS | hotelKey | hotelExternalId | нет |
| KAZUNION | hotelKey | hotelExternalId | нет |
| ANEX | hotelInc | hotelExternalId | нет |

Других поставщиков с hotel-identity в ходе имплементации не обнаружено.

## 19.4 Fix A — Product lookup

- **Логика** ([tour-request.service.ts:151–194](../../backend/src/modules/supplier/tour-request.service.ts)):

```ts
where = dto.supplierCode
  ? { AND: [
      { attributes: { path: ["supplierCode"], equals: dto.supplierCode } },
      { OR: [
        { attributes: { path: ["hotelExternalId"], equals: dto.hotelExternalId } },
        { attributes: { path: ["hotelKey"],         equals: dto.hotelExternalId } },
      ]},
    ] }
  : { OR: [ hotelExternalId, hotelKey ] }   // dto.supplierCode опционален в DTO
```

- **supplierCode guard**: обязателен при наличии supplierCode в запросе (перекрёстная коллизия числовых id разных поставщиков исключена — тест D).
- **productId resolution**: матрица A–F — все случаи дают ожидаемый productId (см. 19.6, Gate D/E/F).

## 19.5 Fix B — conversion projection

- **Fallback** ([request.service.ts:449–478](../../backend/src/modules/order/request.service.ts)):

```ts
projectionProductSnapshot =
  buildRequestProjectionProductSnapshot(liveProduct)   // 1. live Product
  ?? (request.productSnapshot ?? null);                // 2. frozen Request.productSnapshot
```

- **Сохранённые гейты** (не ослаблены, проверены negative-тестами): статус `CUSTOMER_ACCEPTED`, `customerAcceptedAt`, `pinnedRequirements`, `travelerCount`, money-gate (confirmed ?? displayed > 0 + валюта), `convertedOrderId === null`, permission `order.edit_noncritical`. Idempotency/CAS execution-пути не тронуты.
- **Product-less conversion**: заявка с `productId=NULL` + валидный frozen snapshot + валидные деньги теперь получает `convert=true`; execution по-прежнему авторитарен и читает тот же frozen snapshot.

## 19.6 Test results

Typecheck: **`npx tsc --noEmit` → exit 0** (Gate A).

| Suite | Tests | Result | Gate |
|---|---|---|---|
| `tour-request.service.spec.ts` (incl. lookup matrix A–F) | 21 | 21 passed | B, D, E, F |
| `request.service.dto.spec.ts` (incl. projection matrix §11) | 12 | 12 passed | G, H |
| `kompas.adapter.spec.ts` + `anex.adapter.spec.ts` (incl. новые identity-тесты) | 51 | 51 passed | C, E |
| `kazunion.adapter.spec.ts` + summertour specs | 21 | 21 passed | C, D |
| Все `src/modules/order` | 111 | 111 passed | I, J |
| Все `src/modules/pricing` + `src/modules/supplier` | 411 | 411 passed | K |

Итого: **627 passed, 0 failed** (пре-существующих падений не обнаружено в затронутых областях). E2E (`backend/test/*.e2e-spec.ts`) не запускались: требуют поднятой инфраструктуры (Postgres-фикстуры/моки на месте, серверы после рестарта Freebuff не поднимались) — помечаю как не выполненный шаг, а не как pass.

## 19.7 Data safety

```text
Product data changed: NO   (verify: hotelKey=3009, hotelExternalId=0 — как до имплементации)
Migration:             NO
Schema changed:        NO  (git status по schema.prisma/migrations пуст)
```

## 19.8 Git safety

```text
Commit: NO
Push:   NO
```

Существовавшая несвязанная dirty-work (199 записей git status до начала) не тронута: правки — только точечные hunk'и в 6 перечисленных файлах (Gate N).

---

## 20. FINAL VERDICT

```text
PASS — READY FOR OWNER REVIEW
```

Единственное замечание: E2E-набор не прогонялся (инфраструктура не поднята после рестарта Freebuff) — это не провал гейта, а невыполненный опциональный шаг; все unit-гейты A–N зелёные.

## 21. STOP CONDITION

Соблюдён: никаких последующих рефакторингов, новых поставщиков, lifecycle-изменений, коммитов и push-ей. Следующие шаги — решения владельца (review диффа, затем опционально: конвертация MKT-REQ-00000301, запуск e2e, commit).
