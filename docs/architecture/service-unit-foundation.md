# PHASE 1 — STEP 1.8A — SERVICE TEMPLATE / SELLER COMMERCIAL STRUCTURE FOUNDATION — ARCHITECTURE

**Project:** TravelHub
**Step:** 1.8A (STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES, 2026-08-11)
**Status:** structure-and-identity foundation — DONE (implementation 2026-08-11; STRICT REVIEW FIXES 2026-08-11)
**Predecessor gate:** `SERVICE TEMPLATES RETURN POINT DECISION GATES COMPLETED — APPROVED FOR IMPLEMENTATION` (DD-024…DD-029 → DECIDED)
**Canonical sources:** DD-025 (decision gates §1), `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (Step 1.8A), ADR-0001/0005, Catalog ownership docs, `schema.prisma`.

---

## 1. Final entity name

**`ServiceUnit`** (canonical; cross-category, НЕ hotel-specific). Префикс бизнес-кода — **`UNI-`** (зарегистрирован в `docs/contracts/ids.md`, реализован через `IdsService.nextCode`).

Альтернатива `SellerCommercialUnit` отклонена: длиннее, без выигрыша в точности; оба имени — DD-025 эквиваленты, выбрано одно.

## 2. Catalog ownership — HARD GATE ✅

`ServiceUnit` — **catalog.*** (та же bounded context, что Product/Tariff). Никакого нового bounded context; никакого cross-domain writer (ADR-0001 owner-service contract): Sales/Order/Booking/CRM/Reverse НЕ пишут в `catalog.ServiceUnit`. Единственный writer — `ServiceUnitService` (Catalog owner).

## 3. Product vs Service Unit semantics

- **Product** — marketplace/catalog offering container Seller-а (`Grand Caspian Hotel`, `Baku Airport Transfer`, тур).
- **ServiceUnit** — Seller-определённый bookable/commercial structural variant ВНУТРИ Product (`Standard Double`, `Sedan`, `Standard Package`).

`Product ≠ ServiceUnit`; НЕ создан второй Product-like aggregate. Product-level: title/slug/type/category/tariffs/availability/media/lifecycle/moderation. Unit-level: name (verbatim), normalized attributes (CategorySchema-validated), import identity (source/externalKey), own lifecycle (DRAFT→PUBLISHED→ARCHIVED).

## 4. CategorySchema / template authority

`CategorySchema` остаётся platform-owned template/schema authority (§9): unit хранит Seller-предоставленные values, валидированные по схеме-снапшоту. Seller не мутирует schema при создании unit. CategorySchema НЕ конвертирован в Seller data.

## 5. Business ID strategy

`UNI-00000001` — server-generated через `IdsService.nextCode` (атомарный upsert-инкремент `events.BusinessSequence`). Client не контролирует code (forbidden key → 422); коллизий с реестром нет; один идентификатор на бизнес-объект.

## 6. Core schema / relationships

```prisma
model ServiceUnit {
  id               String           @id @default(uuid())
  code             String           @unique   // UNI-*
  productId        String                     // FK → catalog.Product (Cascade)
  name             String                     // verbatim
  categoryId       String?                    // снапшот из Product
  categorySchemaId String?                    // schema-версия валидации (снапшот)
  attributes       Json?                      // normalized, whitelist CategorySchema
  source           String?                    // import identity (trusted)
  externalKey      String?                    // import identity (seller-scoped)
  partnerId        String?                    // ownership, trusted ref без FK
  status           ServiceUnitStatus          // DRAFT|PUBLISHED|ARCHIVED
  version          Int                        // CAS
  publishedAt      DateTime?
  createdAt/updatedAt/createdBy/updatedBy
  history          ServiceUnitHistory[]
  @@unique([partnerId, productId, source, externalKey])
}
```

- Tariff → unit FK: НЕ добавлен в 1.8A (Step 1.8B — approved место). Структура юнита аддитивна, 1.8B прикрепит Tariff без redesign.
- Product relation: `serviceUnits ServiceUnit[]` (аддитивно; legacy Product без юнитов валиден).

## 7. Seller-defined name invariant

Name — обязательное поле, сохраняется **verbatim** (trim-only; case/порядок слов/пунктуация не нормализуются, не переводятся). Примеры: `Deluxe Room Sea View`, `Premium Double Ocean Side`, `Superior Sea Facing Room` остаются исходными. TravelHub нормализует атрибуты, не имена.

## 8. Normalized attributes

Schema-driven (канонический `validateAttributes` из `category-schema.validation`): whitelist-ключи CategorySchema, enum/min/max/pattern/required. Нет глобальной hotel-таблицы атрибутов. Атрибуты без schema-контекста (Product без категории) запрещены (нет authority → 422).

## 9. Original vs normalized values

`attributes` — валидированные Seller-предоставленные значения (normalized по схеме: enum-опции, диапазоны, типы). Источник/original value НЕ перезаписывается таксономией. DD-028 (normalized taxonomy как отдельный Catalog-owned словарь) — будущий шаг, здесь НЕ дублируется.

## 10. Schema version semantics

Unit хранит `categorySchemaId` — снапшот версии, по которой валидированы attributes (та же конвенция §5-контракта Product).

- **create:** attributes валидируются по снапшоту Product на момент создания.
- **update:** attributes перевалидируются по снапшоту **САМОГО юнита** (`unit.categoryId`/`unit.categorySchemaId`), а не по текущему Product-снапшоту (STRICT REVIEW FIX §13): изменение CategorySchema или перевалидация Product НЕ переинтерпретирует исторические unit-данные. Fallback на Product-контекст — только если у юнита нет снапшота (легаси-юнит без category).
- Будущие изменения CategorySchema НЕ переинтерпретируют исторические unit-данные; published units остаются читаемыми.
- Явный миграционный upgrade (переиздание attributes под новую схему) — future work (1.8B+), НЕ выполняется молча в 1.8A.

## 11. Lifecycle / moderation

`DRAFT → PUBLISHED → ARCHIVED`. **Второй moderation engine НЕ создан** (§14): юниты не проходят ModerationSubmission. Публикация — Catalog publication authority: staff/ADMIN команда с правом `catalog.service_unit.publish` (PARTNER не имеет — как и `catalog.product.publish`).

## 12. Publication dependency

- Unit PUBLISHED разрешён **только** если родительский Product **PUBLISHED** (гейт §15); иначе 409.
- Unit visibility следует Product visibility: публикация юнита не может сделать неопубликованный Product публично bookable.
- Draft units приватны (только Seller own-scope / staff).
- Frontend/public read юнитов НЕ добавлены в 1.8A (§19/§21: «Add only the minimum…»; общедоступный read — будущие UI-шаги).

## 13. Mutability rules

- name/attributes: PARTNER правит СВОЙ DRAFT (`catalog.product.update_own_draft`); staff/ADMIN — любые не-ARCHIVED (`catalog.product.write`).
- Immutable: productId, categoryId/categorySchemaId (server-derived), partnerId, code, status (только lifecycle command), source/externalKey (смена import identity = delete + create), temporal/audit.
- Import identity не может быть hijacked: source/externalKey immutable на update (forbidden → 422).
- **Stale-state защита (STRICT REVIEW FIX §34/§35):** все мутации (update/publish/archive) выполняются **атомарными conditional update** (`updateMany` с `where` по статусу внутри tx): PARTNER update — `status = DRAFT`; staff update — `status != ARCHIVED`; publish — `status in (DRAFT, ARCHIVED)` (re-publish из ARCHIVED разрешён — конвенция re-publish Product); archive — `status != ARCHIVED`. Concurrent publish/archive/update НЕ могут обойти гейты через stale read (TOCTOU); count=0 → детерминированный 409 или idempotent no-op (без duplicate history/audit).
- `version` — informational (инкремент на каждое изменение, конвенция Product.version); НЕ expectedVersion/CAS-механизм (у Catalog нет CAS-конвенции; stale-защита — status-conditional updates, см. выше).

## 14. Import identity / reconciliation foundation

- `(source, externalKey)` — server/trusted (staff/ADMIN provisioning); PARTNER → 422.
- externalKey без source → 422 (no fabricated key for manual records).
- Уникальность в реальном ownership scope: `@@unique([partnerId, productId, source, externalKey])` — два Seller не коллидят; в пределах Seller+Product+source ключ уникален; repeated imports reconcile (409), никогда не дублируют; concurrency-safe (DB unique → один победитель).
- manual units (source=NULL, externalKey=NULL) законно без ключа — NULL в unique index Postgres не конфликтует.
- CSV/XLS/API/channel-manager import НЕ реализован (§17) — только identity foundation.

## 15. API surface

| Метод | Route | Scope |
|---|---|---|
| POST | `/products/:productId/service-units` | PARTNER create_own / staff write |
| GET | `/products/:productId/service-units` | PARTNER read_own / staff read |
| GET | `/service-units/:id` | PARTNER read_own / staff read |
| GET | `/service-units/:id/history` | PARTNER read_own / staff read |
| PATCH | `/service-units/:id` | PARTNER update_own_draft / staff write |
| POST | `/service-units/:id/publish` | `catalog.service_unit.publish` (staff/ADMIN) |
| POST | `/service-units/:id/archive` | `catalog.service_unit.publish` (staff/ADMIN) |

Без generic unrestricted CRUD; без pricing/availability endpoints.

## 16. Concurrency contract

- Import identity (source+externalKey): DB-level `@@unique` — конкурентные импорты дают ровно одного победителя (остальные 409), e2e §49.17.
- update vs publish: атомарный status gate — PATCH не применится к PUBLISHED (409); e2e §49.30.
- product-state vs unit publish: publish re-read'ит статус Product ВНУТРИ tx (гейт §16); архивированный/не-PUBLISHED Product → 409; e2e §49.31.
- Повторный publish/archive — idempotent no-op без duplicate history/audit (e2e §19/§49.30).

## 17. Seller own-scope / IDOR

- Create: PARTNER — только СВОИ Product (partnerId из Product == actor.partnerId); чужой → 403.
- Read/update: PARTNER чужого unit → 403 (managed deny, как Product); MODERATOR/BUYER → 403 (нет прав).
- Forged ownership/schema/status/version/identity в body → 422 (forbidden keys, loud).

## 18. Buyer/public scope

Draft/private units публично НЕ раскрываются. Public read юнитов в 1.8A отсутствует (без frontend-изменений; §21).

## 19. RBAC

Reuse `catalog.product.*` own-scope для CRUD (child-entity Product, §22 — без дублирования прав). Новое право — одно: `catalog.service_unit.publish` (отдельная publication authority, документирована в `permissions.constants.ts`). ADMIN — ALL_PERMISSIONS; PARTNER/MODERATOR/BUYER — не имеют.

## 20. Mass assignment / validation

Forbidden keys create/update — `service-unit.validation.ts`. Валидация: name (обязательно, ≤200, verbatim, без control-символов), attributes (CategorySchema whitelist), source (enum-like trusted token ≤50), externalKey (safe charset ≤100, без пробелов), JSON shape (no unbounded JSON), import identity consistency.

## 21. Tariff / Universal Pricing / Availability boundaries

- Tariff → unit relation НЕ добавлен (1.8B — Rate Plan extension: meal plan, refundability, cancellation ref, priceBasis, occupancy/PAX).
- Universal Pricing (fixed/period/calendar/overrides/PRICE_ON_REQUEST) НЕ реализован (отдельный amendment, 1.8B/1.8C).
- Availability/holds: НЕ создаётся вторая availability-таблица; Step 2.4 hold engine остаётся каноническим; multi-date holds — 1.8C.

## 22. Migration

`20260811190825_add_service_unit` — аддитивная, legacy-safe, replayable (e2e globalSetup — чистый replay), drift 0. Нет backfill; legacy Product без units валиден; `db push` не используется.

## 23. Constraints / indexes

`code @unique`; `@@unique([partnerId, productId, source, externalKey])` (import reconcile); `@@index([productId])`, `@@index([status])`, `@@index([partnerId])` (lookup/filter). Без избыточных индексов.

## 24. Delete / archive / cascade safety (STRICT REVIEW §30/§31/§49.32)

Нет hard delete ни для Product, ни для ServiceUnit (API не содержит DELETE-маршрутов; e2e §49.32 доказывает 404 на DELETE). Архивация — soft (как Product): данные/история сохраняются; будущие Tariff/Quote history не обрываются.

`onDelete: Cascade` (Product → ServiceUnit) — CRITICAL-ревизия: продукт **физически не удаляется в production domain flow** (только soft archive через `archiveProduct`; hard-delete API отсутствует), поэтому каскад недостижим через доменные операции и не может уничтожить canonical commercial/history facts. Семантика Cascade — конвенция Catalog для Product children (ProductMedia/ProductHistory/ModerationSubmission также Cascade) и обслуживает только теоретический DB-level cleanup. STRICT REVIEW-вердикт: Cascade сохранён как безопасный при отсутствии hard-delete; будущая привязка Tariff (1.8B) НЕ создаёт риск: Product по-прежнему не удаляется, а unit-история (ServiceUnitHistory, Cascade под unit) сохраняется до тех пор, пока не удалён сам unit (тоже невозможен через API).

## 25. Audit / history

`ServiceUnitHistory` (created/updated/published/archived; version/action/from/to/fields/actor/comment) + `SecurityService.audit` (`service_unit.created/updated/published/archived`). PII/attributes в security audit НЕ dump-ятся (только refs: code/productId/partnerId/source).

## 26. Events / outbox

**Событий НЕТ** (§37): нет реального canonical consumer для `ServiceUnitCreated` — спекулятивные события запрещены. Public projection юнитов появится с UI-шагами (3.29+), тогда же — событие по конвенции Product.

## 27. Cross-category validation

- **Hotel:** `Grand Caspian Hotel` → `Standard Double` / `Premium Double Ocean Side` / `Family Suite` — без глобальных имён Room/RoomType ✅.
- **Tour:** package/service variants без hotel-предположений ✅.
- **Transfer:** `Sedan` / `Minivan` / `Business Van` как юниты; Tariff/pricing отдельно (1.8B) ✅.
- **Excursion / Car rental:** activity/ticket/vehicle-class variants — без pricing в юните; будущие per-day/seasonal цены — через Tariff/CommercialPeriod ✅.

## 28. Files

- `backend/prisma/schema.prisma` (enum `ServiceUnitStatus`, `ServiceUnit`, `ServiceUnitHistory`, Product relation)
- `backend/prisma/migrations/20260811190825_add_service_unit/migration.sql`
- `backend/src/modules/catalog/service-unit.validation.ts` (+ `.spec.ts`)
- `backend/src/modules/catalog/service-unit.service.ts`
- `backend/src/modules/catalog/service-units.controller.ts`
- `backend/src/modules/catalog/catalog.module.ts`
- `backend/src/security/permissions.constants.ts`, `backend/src/security/security.service.ts` (`catalog.service_unit.publish`)
- `backend/test/service-unit.e2e-spec.ts`
- `docs/contracts/ids.md`, `docs/contracts/api.md` (Step 1.8A endpoint contract)

## 29. Test coverage (STRICT REVIEW §49)

E2E `service-unit.e2e-spec.ts` — 27 сценариев: create/verbatim name/attributes/code/forged keys (§49.1–6), cross-Seller IDOR (§49.7–9), schema validation + version persisted (§49.10–11), multiple units + similar names (§49.12–13), import identity + manual + PARTNER-forge-422 + concurrent dedup (§49.14–17), legacy Product (§49.18), publish gate + visibility (§49.19–20), archive (§49.21), no side effects (pricing/availability/Sales/Order/Booking/Reverse §49.22–25), cross-category Hotel/Transfer/Tour (§49.26–28), deterministic pagination (§49.29), update-vs-publish race (§49.30), product-state-vs-publish race (§49.31), cascade/delete safety (§49.32), re-publish из ARCHIVED (§15 resurrection), RBAC MODERATOR/BUYER/staff, update/immutability, history+audit без PII. Unit `service-unit.validation.spec.ts` — 15 тестов валидаторов.

## 30. Boundaries (out of scope — §46)

Universal Pricing amendment (следующий обязательный pass), 1.8B/1.8C/1.8D, CommercialPeriod, calendar/period pricing, occupancy/PAX pricing, Rate Plan extensions, multi-date holds, 2.8A time-slot, Partner Cabinet UI, Marketplace UI, CSV import engine, supplier/channel-manager API, FX, dynamic pricing, contact disclosure, 2.6.
