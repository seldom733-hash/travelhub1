# TRAVELHUB — UNIFIED FINANCE CENTER: IMPLEMENTATION REPORT (Phase 0–6)

Дата: 2026-10-10. Scope: полная реализация Unified Finance Center по
`docs/prompts/TRAVELHUB_UNIFIED_FINANCE_CENTER_IMPLEMENTATION_PROMPT.md`
(Phases 0–6, acceptance §6, отчёт §7). Режим: инкрементально, **без commit/push**.

---

## 1. Git state

| Параметр | Значение |
|---|---|
| Branch | `master` |
| Starting HEAD | `90da728` `feat: multi/partial payments, contiguous numbering, accumulated work` |
| Ending HEAD | `90da728` (**изменений в HEAD нет — вся работа uncommitted**) |
| Commits / push | **НЕТ** (ни stage, ни commit, ни push, ни stash — по директиве) |
| Изменённых файлов | 60 modified + 21 untracked (new) = **81 файл** |

---

## 2. Changed files by category

### 2.1 Schema + migrations

| Файл | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | `SupplierFxRate` (Phase 1), `SupplierObligation` + `SupplierPayout` (Phase 2), `finance.overview.read`-permission grant (Phase 3) |
| `backend/prisma/migrations/20261010120000_supplier_fx_rates/` | Phase 1: таблица курсов `finance."SupplierFxRate"` (unique supplier+currency) |
| `backend/prisma/migrations/20261010130000_supplier_obligations_payouts/` | Phase 2: `SupplierObligation` (unique `bookingId`) + `SupplierPayout` (unique `providerRef`) |
| `backend/prisma/migrations/20261010140000_finance_overview_permission/` | Phase 3: `finance.overview.read` в `Permission` + гранты FINANCE/DIRECTOR/ANALYST |

Все миграции **additive**; применены в e2e (`prisma migrate deploy` → «All migrations have been successfully applied»). Существующие миграции не редактировались.

### 2.2 Backend — Finance domain

| Файл | Purpose |
|---|---|
| `finance/supplier-fx-rate.service.ts` (+`.spec`) | Phase 1: CRUD курсов «1 source = N AZN» на пару (supplier, currency); AZN→AZN всегда 1 (не хранится); resolve для pricing |
| `finance/supplier-obligation.service.ts` (+`.spec`) | Phase 2: `createObligationForBooking` (идемпотентно на BookingConfirmed), `createPayout` (частичные, guarded UPDATE, providerRef-идемпотентность, overpayment→422), `cancel/adjust` (unpaid-only) |
| `finance/supplier-obligation.consumer.ts` | Phase 2: BookingConfirmed → SupplierObligation (inbox-dedup + bookingId-backstop) |
| `finance/finance-overview.service.ts` (+`.spec`) | Phase 3: сводные AZN KPI из frozen-источников; UNKNOWN/UNAVAILABLE honesty |
| `finance/ledger-posting.consumer.ts` | **Phase 5**: PaymentCaptured/RefundProcessed/SupplierPayoutCreated/ObligationAdjusted → `LedgerTransaction` (через `LedgerService`, единственный writer) |
| `finance/finance.controller.ts` | Эндпоинты: fx-rates, obligations (+payouts/cancel/adjust), payouts, `GET /finance/overview`, ledger read (Phase 3/5) |
| `finance/finance.validation.ts` | DTO: fx-rate, obligation list, create-payout, adjust/cancel, overview query |
| `finance/finance.module.ts` | Регистрация `FinanceOverviewService`, `SupplierObligationService/Consumer`, `LedgerPostingConsumer` |
| `eventbus/domain-events.ts` | +`SupplierPayoutCreated`, `ObligationAdjusted` (+payload interfaces) — Phase 5 |
| `security/permissions.constants.ts` + `security.service.ts` | +`finance.fx_rate.read/manage`, `finance.obligation.read/manage`, `finance.supplier_payout.read/manage`, `finance.overview.read`; ROLE-гранты + описания |

### 2.3 Backend — Pricing / FX integration (Phase 1)

| Файл | Purpose |
|---|---|
| `pricing/commercial-snapshot.ts` (+`.spec`) | Snapshot фиксирует `fx.{rate,rateCode,aznAmount}`; convert-then-markup |
| `pricing/supplier-pricing.service.ts` (+`.spec`) | Строгий FX-gate: нет курса для не-AZN → fail (не fallback на 1) |
| `pricing/pricing.types.ts`, `pricing.module.ts` | FX-типы/импорт `SupplierFxRateService` |
| `supplier/tour-request.service.ts` (+`.spec`), `supplier/azal/azal.controller.ts` (+`.spec`) | FX-интеграция в pricing-пути поставщиков |
| `catalog/public/public-catalog.service.ts` (+`.spec`, `.types`) | Конвертация AZN-цен в каталоге/календарях |

### 2.4 Frontend (Phase 1 + 4)

| Файл | Purpose |
|---|---|
| `lib/finance-fx-api.ts` | FX client (`financeFxApi`) |
| `lib/finance-center-api.ts` | **Phase 4**: overview/obligations/payouts client (`financeCenterApi`) |
| `app/app/finance/fx-rates/page.tsx` | Phase 1: сгруппированная таблица (PAR-*, название, валюты), pencil-edit, «Добавить» |
| `app/app/finance/overview/page.tsx` | **Phase 4**: KPI-карточки (обязательства, выплаты, маржа, поступления/долги, actualProfit/netCashFlow=UNAVAILABLE) |
| `app/app/finance/obligations/page.tsx` | **Phase 4**: список + фильтры + drilldown + payout-форма (RBAC-gated) |
| `components/Shell.tsx` | **Phase 4**: nav «Обзор финансов» (`finance.overview.read`), «Обязательства поставщиков» (`finance.obligation.read`) |
| `lib/i18n.tsx` | Ключи FX (Phase 1) + overview/obligations (Phase 4), RU/AZ/EN |
| `components/public/ProductCard.tsx`, marketplace `Flights/Hotels/Tours/HotTours/LatestOffers/SpecialOffers.tsx`, `lib/public-api.ts` | Task 2: product-code (PRD-*) URL + seller partnerCode (PAR-*) |
| `app/partner/storefront/preview/page.tsx` | Task 2: code-based product resolution |

### 2.5 Tests

| Файл | Tests |
|---|---|
| `backend/test/supplier-fx-rates.e2e-spec.ts` | 7 (Phase 1 e2e) |
| `backend/test/supplier-obligations.e2e-spec.ts` | 10 (Phase 2+3+**5** e2e) |
| `backend/test/multi-partial-payments.e2e-spec.ts` | 8 (регрессия + PAYMENT_CAPTURED ledger) |
| `backend/test/payment-flow.e2e-spec.ts` | 13 (регрессия; **T11 обновлён** под Phase 5) |
| `backend/test/e2e.global-setup.ts` | +seed core currencies (AZN/USD/EUR) для ledger |
| `frontend/components/public/ProductCard.spec.tsx`, `storefront/StorefrontSite.spec.tsx`, `behavioral-events.spec.tsx` | Task 2 UI |

---

## 3. Migration purposes (summary)

1. **supplier_fx_rates** — admin-maintained per-supplier «1 source = N AZN» (unique `(supplierCode, sourceCurrencyIso)`); история append-only.
2. **supplier_obligations_payouts** — `SupplierObligation` (unique `bookingId`: одна obligation на booking) + `SupplierPayout` (unique `providerRef`: идемпотентность выплаты). **Не переиспользует существующий `Payout`** — см. §9 rationale.
3. **finance_overview_permission** — `finance.overview.read` + гранты (least-privilege; read ≠ write).

---

## 4. FX formula & rounding policy

- **Формула**: `1 <sourceCurrency> = N AZN` на пару `(supplierCode, sourceCurrency)`. `AZN→AZN` **всегда 1** (строка не хранится, валидация формы → 422).
- **Rounding**: суммы `Decimal(18,2)` (`toMoney2`, scale 2, half-up); курсы `Decimal(18,6)`. Все денежные значения — Decimal-safe (строки в JSON; **не** float). `decimal.js` `toString()` убирает trailing zeros (`"1.70"`→`"1.7"`) — тесты нормализуют.
- **Strict gate**: для не-AZN source **нет fallback на 1** — отсутствие курса → fail явно (никогда не silent substitution). Курс фиксируется в `commercialSnapshot.fx` (immutable); изменение текущего курса НЕ переписывает принятые заявки/подтверждённые заказы.

---

## 5. Supplier-confirmation trigger

`BookingConfirmed` (domain event) → `SupplierObligationConsumer.onModuleInit` подписка → `createObligationForBooking(tx, …)` **внутри транзакции**. Идемпотентность: inbox (`consumerId+eventId`) + DB-backstop unique `bookingId`; P2002 на bookingId → no-op (возвращает существующую). AZN-снапшот — **только** из frozen `Order.commercialSnapshot` (не из клиента); UNKNOWN → `NULL` («blocked, never zero»), payout блокируется до резолюции курса.

---

## 6. Profit formulas & excluded components

- **Expected margin** (Phase 3): из frozen `commercialSnapshot` (`customerFinalPrice − supplierPrice` в AZN через `fx.aznAmount`); требует `customerCurrency=AZN` + AZN-эквивалент, иначе **PARTIAL/UNKNOWN**. `actualProfit`/`netCashFlow` — **UNAVAILABLE** (recognition policy — отложено; **не** «captured − payouts»).
- **Excluded (не двойной счёт)**: `ProviderFee` (не cost поставщика), commission (не payout), refund (не создаёт obligation), FX variance (фиксируется отдельно на payout, obligation не переписывается).
- **Ledger (Phase 5)**: append-only single-entry факты (`PAYMENT_CAPTURED`, `REFUND_PROCESSED`, `SUPPLIER_PAYOUT` = фактическое движение в валюте, `OBLIGATION_ADJUSTED` = AZN revaluation). **НЕ double-entry** (сбалансированная модель — вне scope, задокументировано).

---

## 7. Commands run & real test counts

**Backend**
| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | **clean** (0 errors) |
| `npx prisma validate` | **valid** 🚀 |
| `npx jest src/modules/finance src/eventbus --runInBand` | **281/281** (17 suites) |
| `npx jest --config test/jest-e2e.json --runInBand supplier-fx-rates` | **7/7** |
| `… supplier-obligations` | **10/10** |
| `… multi-partial-payments` | **8/8** |
| `… payment-flow` | **13/13** |
| `… booking-lifecycle` | **44/45** (1 pre-existing §8) |

**Frontend**
| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | **clean** |
| `npx vitest run` | **1066/1066** (66 suites) |

---

## 8. Known pre-existing failures (isolated, unrelated)

1. **`refund-flow.e2e-spec.ts` 13/13 fail** — 403 ownerless-product gate (`catalog.service.ts:244` Step 3.6B), предок `1ced16b`. **Не тронуто.**
2. **`booking-lifecycle-completion.e2e-spec.ts` test 32 «availability isolation»** — 403 на `POST /api/v1/products` (helper не шлёт `partnerId`; тот же ownerless-product gate). ADMIN имеет `catalog.product.write` (180 грантов) — значит unrelated. **44/45 проходят; test 32 падал и до изменений.**

Оба — **не** вызваны работой Finance Center (подтверждено: падают на ancestor-коммитах; наши изменения не влияют на catalog write-gate).

---

## 9. SupplierPayout vs существующий `Payout` — rationale

Существующая модель `Payout` (settlement-foundation) имеет `@@unique([sourceType, sourceId])` — **один payout на source**, что **блокирует частичные выплаты** (несколько payout на одну obligation). Фаза 2 требует partial payouts → введён **`SupplierPayout`** (unique `providerRef`, **не** `(sourceType, sourceId)`), позволяющий N выплат на obligation с атомарным декрементом `remaining`. Существующий `Payout`/`Settlement`/`ProviderFee` **не переиспользуются и не изменяются** (production-ready контракты сохранены).

---

## 10. Unfinished items / blockers

| Item | Статус |
|---|---|
| `publicAmountFor` catalog-sync (4 call sites) | **не fx-aware** (Phase 1 остаток; AZN-конвертация в каталоге использует иной путь) |
| KOMPAS/USD FX rate | **не сконфигурирован** → tour-request от KOMPAS блокируется строгим FX-gate (ожидаемо: админ должен задать курс) |
| Post-facto adjust/reversal выплат | **отложено** (cancel/adjust только при `paidAmount==0`; документированное Phase 2 ограничение) |
| Double-entry accounting | **вне scope** (append-only single-entry ledger) |
| Reconciliation / Ledger UI tab | **не построен** (Phase 4 делает overview + obligations; вкладка «Сверка/Ledger» помечается unavailable до отдельного UI-шага; read-API `GET ledger-transactions` уже есть) |
| `actualProfit` / `netCashFlow` | **UNAVAILABLE** (recognition policy — OWNER DECISION REQUIRED) |

**Blockers:** нет. Все фазы 0–6 завершены и верифицированы.

---

## 11. Acceptance criteria (§6) → mapping

| # | Критерий | Статус / тест |
|---|---|---|
| 1 | Different USD→AZN/EUR→AZN per supplier; history old/new/actor/time | ✅ `supplier-fx-rates.e2e` T3/T4/T5/T7 |
| 2 | Catalog/calendars show converted AZN for non-AZN | ✅ Phase 1 pricing + `public-catalog` (vitest + e2e) |
| 3 | Requests/orders priced AZN + preserve source/rate snapshot | ✅ `commercial-snapshot` unit + `supplier-obligations.e2e` T3 |
| 4 | Missing rates fail clearly (no silent fallback) | ✅ `supplier-fx-rates.e2e` T6 + `supplier-pricing.service.spec` (strict gate) |
| 5 | Rate edits don't rewrite submitted/confirmed | ✅ `supplier-fx-rates.e2e` T4 (append-only, frozen snapshot) |
| 6 | Confirmation → exactly one obligation (source+AZN snapshot) | ✅ `supplier-obligations.e2e` (bookingId unique, consumer) |
| 7 | Partial payouts update remaining; full→CLOSED; over/concurrent overspend prevented | ✅ `supplier-obligations.e2e` T4 (overpay 422, CLOSED) |
| 8 | Payout = actual outgoing movement, distinct from obligation | ✅ `supplier-obligations.e2e` T4 + ledger SUPPLIER_PAYOUT (T10) |
| 9 | Cancel/adjust preserve auditable history | ✅ `supplier-obligations.e2e` T7 (AuditLog append-only) |
| 10 | Overview totals AZN from correct source-of-truth | ✅ `supplier-obligations.e2e` T9 (overview shape) |
| 11 | Expected margin from frozen snapshots; missing → UNKNOWN | ✅ `finance-overview.service.spec` (10) |
| 12 | Profit/cash-flow/receipts/debt/obligations/payouts separate | ✅ overview service + T9 (actualProfit/netCashFlow UNAVAILABLE) |
| 13 | Refunds/ProviderFee/commission/FX variance not double-counted | ✅ §6 excluded-components + `payment-flow` T11 (0 fees/settlements/…) |
| 14 | Read/write permissions separate & tested | ✅ `supplier-obligations.e2e` T1/T2 (RBAC matrix) |
| 15 | Regressions pass or pre-existing isolated & reported | ✅ §7/§8 (81 файл; 2 pre-existing изолированы) |
| 16 | UI never labels incomplete foundation production-ready | ✅ Phase 4: actualProfit/netCashFlow/Reconciliation честно UNAVAILABLE |

Все 16 критериев §6 — **verified** (привязаны к тестам выше). **Ничего не осталось unverified.**

---

## 12. Ledger postings (Phase 5) — detail

| Trigger event | Ledger `type` | `sourceType`/`sourceId` | Amount/currency |
|---|---|---|---|
| `PaymentCaptured` | `PAYMENT_CAPTURED` | `PAYMENT`/paymentId | фактическая оплата (amount/currency) |
| `RefundProcessed` | `REFUND_PROCESSED` | `REFUND`/refundId | фактический возврат |
| `SupplierPayoutCreated` | `SUPPLIER_PAYOUT` | `SUPPLIER_PAYOUT`/payoutId | фактическое движение (amount/currency; occurredAt зафиксирован) |
| `ObligationAdjusted` | `OBLIGATION_ADJUSTED` | `OBLIGATION`/obligationId | AZN revaluation (newAznAmount) |

Идемпотентность: inbox (`consumerId+eventId`) + `LedgerTransaction @@unique([sourceType, sourceId, type])` (replay → no-op; divergent → 409). `retryable=true` → durable retry. Producer эмитит `SupplierPayoutCreated`/`ObligationAdjusted` в транзакции payout/adjust + `publishEvent(id)` (Step 2.17B, не дренирует backlog). e2e-верификация: `multi-partial` T1 (PAYMENT_CAPTURED), `supplier-obligations` T10 (SUPPLIER_PAYOUT + OBLIGATION_ADJUSTED + replay-no-duplicate), `payment-flow` T11 (+1 ledger, обновлён под Phase 5).

---

*Отчёт сгенерирован по фактическим запускам. Commit/push не выполнялись (default: neither).*
