# PHASE 2 — STEP 2.11 — PRICING & FINANCIAL SNAPSHOT — STRICT REVIEW REPORT

## 1. Verdict

**`PHASE 2 STEP 2.11 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`**

Независимый adversarial-аудит по промпту `PHASE_2_STEP_2.11_PRICING_FINANCIAL_SNAPSHOT_STRICT_REVIEW.md`: implementation-отчёт не принимался на веру — проверялся фактический код, SQL миграции, write-paths, consumers, repo-wide денежная арифметика, тесты и документация, с реальными прогонами.

Все hard gates PASS. Найден 1 review-fix (LOW, документация — §44): арх-док описывал binding gate как «пересчёт» вместо «верификация». 2 наблюдения зафиксированы без фикса (accepted risk / out-of-scope).

## 2. Repository baseline

- Branch: `master`, HEAD `e6f0cc5` (2.10C commit), синхронна с origin (push не выполнялся).
- Working tree: только файлы Step 2.11 (schema, booking.subscribers, sales.money.ts/spec, sales.service, api.md, Roadmap, migration `20260814100000_add_booking_currency`, e2e `pricing-financial-snapshot`, арх-док, implementation/review промпты + отчёт).
- Reported baseline — verified: unit **508/508**; serial E2E **1067/1067** (60 suites); frontend **135/135** + build; migrations **51/51**; drift **0**.
- Roadmap 2.11 статус до ревью: `🚧 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`; NEXT = Step 2.12 — Payment Flow (фактический).

## 3. Sources inspected

- `docs/prompts/PHASE_2_STEP_2.11_PRICING_FINANCIAL_SNAPSHOT_IMPLEMENTATION.md` + `_REPORT.md` + `_STRICT_REVIEW.md`.
- `backend/prisma/schema.prisma` — модели Quote/QuoteItem/CheckoutIntent/Sale/Order/OrderItem/Booking + комментарии контрактов.
- Migration `20260814100000_add_booking_currency/migration.sql`.
- `backend/src/modules/sales/sales.money.ts` (+ spec), `finance.money.ts` (+ spec), `sales.payment-terms.ts`, `sales.service.ts` (issueQuote/addQuoteItem/completeSale/createCheckoutIntent/quoteTotals), `sales.validation.ts` (forbidden keys).
- `backend/src/modules/order/order.service.ts` (assertValidOrderRequestedPayload + createOrderFromRequested).
- `backend/src/modules/booking/booking.subscribers.ts` (BookingRequested consumer + compensation).
- `backend/src/modules/booking/booking.service.ts` + `booking.validation.ts` (lifecycle writers, forbidden keys).
- `backend/src/modules/catalog/rate-plan.validation.ts`, `rate-plan.service.ts`, `catalog.controller.ts` (TariffDto), `commercial-period.service.ts` — источники Tariff.currency.
- `backend/src/modules/reverse/proposal.validation.ts` — Reverse money (non-binding).
- `backend/test/pricing-financial-snapshot.e2e-spec.ts` (T1–T7) + затронутые suite'ы.
- `docs/contracts/api.md`, `docs/contracts/events.md`, `docs/architecture/pricing-financial-snapshot.md`, `docs/architecture/checkout-commercial-intent.md`, Roadmap v3.
- Harness: `backend/test/e2e.global-setup.ts` (drop+recreate + `migrate deploy`).

## 4. Current → Target

| Объект | Monetary fields | Currency | Freeze point | Mutable after freeze | Source authority |
|---|---|---|---|---|---|
| QuoteItem | unitPrice/amount | currency (единая) | Quote ISSUE (2.3) | нет (compose blocked) | Sales (resolveEligibleTariff) |
| Quote | subtotal/discountAmount/total | currency | Quote ISSUE | нет (immutable snapshot) | Sales (quoteTotals) |
| CheckoutIntent | subtotal/discount*/total | currency | create (binding) | нет (server-copied; money forbidden keys) | Sales (verbatim из Quote) |
| Sale | subtotal/discount*/total/payment terms | currency | completeSale (CAS) | нет | Sales (verbatim из Checkout) |
| Order | amount/subtotal/discount* | currency | OrderRequested consumer | нет (lifecycle не трогает money) | Order (verbatim из payload) |
| OrderItem | price/amount | currency | OrderRequested consumer | нет | Order (verbatim) |
| Booking | amount | **currency (Step 2.11, было NULL-gap)** | BookingRequested consumer | нет (lifecycle не трогает money) | Booking (verbatim из OrderItem) |
| Reverse Proposal/BuyerRequest | amount (non-binding) | currency | proposal create | — | Reverse (2.2D; НЕ входит в chain, 2.2F §18) |

**Вывод:** `Booking.currency` — действительно единственный исторический money-gap в цепочке (у всех остальных сущностей валюта уже была frozen). Reverse money — non-binding inquiry-факт, не часть snapshot chain.

## 5. Snapshot owner / freeze boundary — HARD GATE PASS

- Freeze boundary = **Quote ISSUE** (первый канонический freeze: unitPrice/amount/currency на QuoteItem; subtotal/discountAmount/total на Quote; compose-команды заблокированы после ISSUE — assertQuoteComposable).
- Checkout binding НЕ меняет authority: копирует frozen Quote verbatim (frontend не источник цены; money-поля — forbidden keys → 422).
- Sale/Order/Booking — копируют, не пересчитывают (READ-only, ADR-0001).
- **Критическая сверка ISSUE↔gate:** `quoteTotals` (sales.service) и re-деривация в `validateFrozenSnapshot` используют ОДНИ И ТЕ ЖЕ функции (`lineAmount`/`subtotalOf`/`discountAmountOf`/`totalOf`) — математическое расхождение между ISSUE-значениями и gate-проверкой невозможно для канонически выпущенных КП. Нет конкурирующего money authority.

## 6. Booking.currency — HARD GATE PASS

- Schema: `Booking.currency String?` (nullable, аддитивно).
- Новые строки: consumer копирует `currency: item.currency` verbatim из OrderItem (в той же create-команде, что и amount — один frozen source).
- Legacy: NULL, без backfill (e2e T3: raw legacy insert → currency NULL, читаем).
- Без re-lookup: Booking consumer НЕ читает Product/Tariff/Finance Currency (READ-only Order/OrderItem).
- Defensive: `validateFrozenMoneyFact(item.amount, item.currency)` для ВСЕХ items ДО создания (атомарно; невалидный факт → событие FAILED, без partial Booking).
- Read-проекции: Booking read (raw Prisma rows) теперь включают currency; lifecycle-команды не трогают money/currency.

## 7. Migration — PASS

```sql
ALTER TABLE "booking"."Booking" ADD COLUMN "currency" TEXT;
```

Только аддитивная nullable-колонка; 0 unrelated ALTER/backfill/db push. Fresh replay — доказан harness-ом (drop+recreate + `migrate deploy`) в составе полного serial e2e (все 51 миграции применены с нуля). `migrate status` — «Database schema is up to date!» (51/51). Drift: `migrate diff --from-config-datasource --to-schema` → **«No difference detected»** (0).

## 8. Money authority — HARD GATE PASS

- `sales.money.ts` — canonical: DECIMAL(12,2), ROUND_HALF_UP 2dp, decimal.js, overflow guard (MONEY_MAX 9999999999.99), строгие discount-семантики.
- `finance.money.ts` — РЕЭКСПОРТ из sales.money (single source of truth), не дублирует.
- `sales.payment-terms.ts` — тот же ROUND_HALF_UP/MONEY_SCALE (2.3B, консистентно).
- Repo-wide поиск `toDecimalPlaces/ROUND_*`: 0 альтернативных helper-ов с другим rounding в canonical chain.
- `Number(...)`/`parseFloat` как authority — 0 в backend money flow (finance.validation `Number()` — только finite-guard валидации; Reverse proposal `Number()` — non-binding inquiry figure, не в chain).

## 9. Decimal precision/scale — PASS

DECIMAL(12,2) на всех money-колонках chain (QuoteItem/Quote/Checkout/Sale/Order/OrderItem/Booking). Все вычисления — Prisma.Decimal, без binary float intermediate. Overflow guard: line/subtotal/discount > 9999999999.99 → 422 (unit: `9999999999.99 × 2`, `9999999999.99 + 0.01`, `toMoney2("9999999999.995")` → 422). API-сериализация — Decimal-строки (e2e T1/T4: `typeof subtotal === "string"`).

## 10. Rounding — HARD GATE PASS

ROUND_HALF_UP 2dp единый: unitPrice → 2dp; line = round_half_up(unitPrice×quantity); subtotal = Σ (2dp, round no-op); PERCENTAGE discount = round_half_up(subtotal×pct/100); payment terms (2.3B) тот же. Boundary unit-тесты: `99.999 → 100`, `99.994 → 99.99`, `309.97 × 10% = 30.997 → 31`, `99.99 × 12.5% = 12.49875 → 12.5`. quoteTotals == gate re-деривация (те же функции).

## 11. validateFrozenSnapshot audit — PASS

Инварианты (все unit-покрыты, adversarial):
- line == round_half_up(unitPrice×quantity) (reject: 199.98 vs 200.00);
- subtotal == Σ lines (reject: 200.00 vs 209.98);
- discountAmount == NONE→0 | PERCENTAGE→round_half_up | FIXED→value ≤ subtotal (reject: 20 vs 21; PERCENTAGE без value; NONE с value);
- total == subtotal − discountAmount ≥ 0 (reject: 188.00; -1);
- currency ISO 4217 (reject: "usd"); overflow (reject: Σ > MONEY_MAX); empty lines (reject);
- NONE-with-value и required-value симметричны `validateDiscountValue` (строгий контракт 2.3, без new discount policy).

## 12. Discount semantics — PASS

Step 2.11 НЕ изобретает discount: тип/значение/строгие границы (PERCENTAGE 0..100, FIXED ≤ subtotal, NONE без value) — существующая каноническая семантика 2.3; gate лишь верифицирует frozen факт.

## 13. Tax boundary — PASS

Tax/TaxRule master data существует (2.10), но в pricing flow налогового расчёта НЕТ (нет producer-а; inclusive/exclusive не определена — stop-condition задокументирован). 0 taxAmount в snapshot; e2e T2b: изменение Tax rate после freeze не мутирует snapshot.

## 14. FX boundary — PASS

ExchangeRate master data существует (2.10, «НЕ выполняет FX-конверсию»). В flow конверсии НЕТ (одна валюта на транзакцию). 0 FX-провенанса в snapshot; e2e T2b: изменение rate не мутирует snapshot.

## 15. Currency master-data mutation — PASS

E2E T2b: `Currency.isActive = false` для USD после freeze → frozen snapshot (Sale/Order) не тронут; `ExchangeRate.rate` и `Tax.rate` изменены → 0 historical mutation. Frozen currency остаётся "USD".

## 16. Product price mutation — PASS (CRITICAL)

E2E T2: create flow at 150 → ISSUE freeze → `Tariff.price = 250` (изменение подтверждено в Catalog) → Checkout/Sale/Order/OrderItem/Booking сохраняют 150. Код: completeSale читает только frozen QuoteItem/Checkout (никакого re-resolve из Catalog после ISSUE; комментарий в коде явно фиксирует запрет reprice).

## 17. Quote freeze — PASS

После ISSUE: addQuoteItem/updateQuoteItem/removeQuoteItem/setQuoteCommercial/setQuoteTravelers — все заблокированы (assertQuoteComposable → 422/409). Аlternate mutation path отсутствует (нет generic PATCH Quote). Повторный ISSUE → 422 (terminal protection).

## 18. Checkout binding — PASS (CRITICAL)

- `createCheckoutIntent`: gate `validateFrozenSnapshot` ПЕРЕД созданием CheckoutIntent — невалидный snapshot → controlled 422, 0 partial CheckoutIntent/outbox эффектов (та же транзакция; валидация до insert).
- Forged server-owned money/currency в body → 422 (e2e T4: `subtotal/total/currency/discountAmount` в payload → 422; forbidden keys в sales.validation).
- Bypass-пути: альтернативных checkout create-команд нет (один endpoint).

## 19. Sale propagation — PASS

completeSale копирует checkout frozen snapshot verbatim (currency/subtotal/discount*/total/payment terms) в CAS-апдейте OPEN→CLOSED; 0 Catalog/Tax/FX re-read; OrderRequested payload — из frozen QuoteItem + snapshot (unitPrice/amount строки).

## 20. Order propagation — PASS

OrderRequested payload: items (unitPrice/amount) + currency/subtotal/total — server-сгенерирован в completeSale; consumer `assertValidOrderRequestedPayload` валидирует money (Decimal строки, ≥ 0, обязательные) и персистит verbatim (Order.amount = total, OrderItem.price/amount, currency на Order И каждый OrderItem). 0 Catalog re-read.

## 21. Booking propagation — HARD GATE PASS

BookingRequested consumer: читает Order + items (READ-only), валидирует ВСЕ money-факты ДО создания, копирует `amount` + `currency` из ОДНОГО OrderItem (multi-item — по per-item паре, e2e T5: 2 bookings, каждый со своей amount+currency из своего item, без bleed).

## 22. Multi-currency assessment — PASS

Mixed-currency Quote невозможен: addQuoteItem блокирует добавление item другой валюты (422); issueQuote дополнительно проверяет единую валюту по всем items (422 при расхождении). Цепочка несёт одну валюту (Quote → Checkout → Sale → Order → OrderItem → Booking). Агрегатная семантика multi-currency не требуется — не определена, потому что недостижима.

## 23. Reverse marketplace — PASS

BUYER_REQUEST: Opportunity/Quote наследуют acquisitionSource; money path — тот же resolveEligibleTariff/addQuoteItem/checkout (никакого пересчёта от Proposal). E2E T6: snapshot идентичен DIRECT при BUYER_REQUEST (total/currency/Sale/Order/Booking); acquisitionSource ортогонален цене. Proposal amount — non-binding (2.2F §18: не копируется, нет shadow pricing).

## 24. Idempotency — PASS

Без изменений: Sale completion CAS (двойной complete → Conflict), OrderRequested inbox+@unique, BookingRequested inbox+Booking_orderItemId_key. Snapshot-поля не стали частью replay-сравнения там, где это ломало бы идентичный логический replay (поведение 2.4/2.5/2.8 сохранено; e2e регрессии зелёные). Unknown P2002 не глотается (booking isUniqueViolation — только inbox/orderItemId).

## 25. Concurrency — PASS

Новые races 2.11 не вводит: gate — read-only валидация перед insert; money копируется атомарно одним insert. Race Product-update vs freeze — невозможен после ISSUE (frozen). Duplicate OrderRequested/BookingRequested — покрыты существующими suite'ами (2.5/2.8, inbox+unique). Mixed old/new price components — 0 (каждая сущность копирует единый frozen snapshot).

## 26. Atomicity — HARD GATE PASS

Binding gate + CheckoutIntent create — в одной транзакции сервиса (валидация до insert; ошибка → rollback, 0 partial rows/events). Sale completion — CAS + snapshot + reservation + OrderRequested outbox в одной tx. Booking create — одна tx (валидация всех items до создания; inbox/outbox атомарно).

## 27. Mass assignment — HARD GATE PASS

Forbidden keys: checkout create (currency/subtotal/discount*/total — sales.validation §2.3A), Sale completion, Order lifecycle (amount/currency), Booking lifecycle (amount/currency/acquationSource — booking.validation). E2E T4 доказательство для checkout. Booking consumer — server-side verbatim (клиент не передаёт money).

## 28. RBAC / IDOR

0 изменений RBAC в 2.11. Write-пути chain — существующие права (SALES_MANAGER и др.), read — существующие scope'ы. Neutral 404 для unknown сущностей сохранён.

## 29. PII

Snapshot — только money/currency/refs; 0 traveler/customer PII, банковских/карточных данных, PSP-секретов. Travelers в checkout — имя+дата рождения (не passport; passport — только OrderTraveler/Passenger, свои домены, redaction 1.17).

## 30. Events

0 изменений event payloads (OrderRequested/BookingRequested — как в 2.5/2.8; 2.11 только consumer-поведение). 0 новых событий. Correlation/causation не тронуты.

## 31. Ledger boundary — PASS

E2E T7: цепочка (включая Booking creation) создаёт 0 `LedgerTransaction` (count до/после идентичен). 0 auto-posting в коде.

## 32. ProviderFee/Settlement/Payout boundary — PASS

E2E T7: 0 новых `ProviderFee/Settlement/Payout`. 2.10B foundations не тронуты (immutable факты, создаются только LedgerService-подобными internal-путями).

## 33. Payment/Refund/Invoice/Commission boundary — PASS

E2E T7: 0 новых `Payment/Refund/Invoice/Commission/CommissionAccrual`; `Order.paymentStatus` остаётся `UNPAID`. 0 runtime side effects/milestones/accruals.

## 34. Legacy compatibility — PASS

Legacy Booking.currency = NULL читаем (T3); никакого read/startup repair с использованием текущего Product price/Currency. Quote без frozen totals (legacy pre-2.3) → checkout отклонялся и до 2.11 (поведение не изменилось).

## 35. Write-path audit — PASS (Unsafe = 0)

| Writer | Поле | Классификация |
|---|---|---|
| `SalesService.createCheckoutIntent` | Checkout frozen snapshot | canonical owner (Sales), verbatim из ISSUED Quote + gate |
| `SalesService.completeSale` | Sale frozen snapshot | canonical owner (Sales), verbatim из Checkout |
| `OrderService.createOrderFromRequested` | Order/OrderItem money+currency | canonical consumer (Order), verbatim из payload |
| `BookingSubscribers.onBookingRequested` | Booking amount+currency | canonical consumer (Booking), verbatim из OrderItem + defensive |
| `BookingService.orderAction` / compensation `updateMany` | status/version/milestones | НЕ трогают money/currency |
| e2e/raw inserts (T3) | legacy simulation | test-only |

## 36. Reprice audit — PASS

Все Product/Tariff/price lookup'и ПОСЛЕ freeze: 0. resolveEligibleTariff — только addQuoteItem (pre-freeze). completeSale/Order consumer/Booking consumer — только frozen факты. Any downstream lookup affecting frozen money — не найден.

## 37. Negative coverage — PASS

E2E + unit: forged money/currency → 422 (T4 + forbidden keys); malformed/negative/overflow Decimal → 422 (unit); unsupported currency (unit validateFrozenMoneyFact); inconsistent line/subtotal/discount/total → 422 (unit); Product/Tax/FX/Currency mutations → 0 historical rewrite (T2/T2b); divergent replay conflict — существующие suite'ы 2.4/2.5; unknown P2002 — существующие; failed binding → 0 partial writes (T4 контрольный create); 0 Ledger/ProviderFee/Settlement/Payout/Payment/Refund/Invoice/Commission (T7); legacy NULL (T3); raw 500 = 0 (все controlled).

## 38. Positive coverage — PASS

T1 direct chain verbatim (amount+currency до Booking); T2 Product X→Y mutation при Sale/Order/Booking X; T2b master-data mutation; T3 legacy read; T4 decimal string serialization; T5 multi-item; T6 Reverse/BUYER_REQUEST; T7 boundary; unit: deterministic rounding, overflow, discount boundaries, snapshot consistency, replay — существующие suite'ы, fresh migration replay — harness.

## 39. Backend regression — PASS (verified by run)

- `npx tsc --noEmit` ✓ · `npm run build` ✓
- Unit: **508/508** (42 suites) — соответствует baseline.
- Targeted E2E (10 затронутых suite'ов: pricing-financial-snapshot, checkout-commercial-intent, quote-commercial-offer, sale-completion-order-requested, booking-requested-consumer, booking-lifecycle-completion, order-lifecycle-completion, reverse-conversion, finance-domain-foundation, ledger-transaction-foundation): **203/203**.
- Full serial E2E: **1067/1067, 60 suites** — соответствует baseline (+8 новых T1–T7).

## 40. Frontend regression — PASS (verified by run)

`tsc --noEmit` ✓ · Vitest **135/135** ✓ · `next build` ✓ (Compiled successfully; frontend не менялся).

## 41. DB regression — PASS (verified by run)

`migrate status`: 51 migrations, «Database schema is up to date!» ✓; fresh replay: harness drop+recreate + `migrate deploy` (полный serial e2e с нуля) ✓; drift: `migrate diff --from-config-datasource --to-schema` → **No difference detected** (0) ✓. Harness использует migrations, не db push.

## 42. Issues found

1. **LOW (docs, §44)** — `docs/architecture/pricing-financial-snapshot.md` §8/§12/§14: binding gate описан как «пересчёт/пересчитывает lines/subtotal/discount/total». Фактическое поведение — ВЕРИФИКАЦИЯ: gate вычисляет expected и сравнивает с frozen, НИЧЕГО не персистит (единственный authority — ISSUE-значения). Формулировка могла быть прочитана как второй money calculation authority.
2. **LOW (observation, accepted risk — no fix)** — Booking consumer `validateFrozenMoneyFact` (ISO 4217) строже producer-ов: legacy catalog-пути (TariffDto.currency @IsString без ISO) и Order consumer (currency non-empty) допускают не-ISO валюту. Для НОВЫХ flow недостижимо: binding gate блокирует не-ISO валюту на checkout (422) → до Order/Booking не доходит. Только гипотетические pre-2.11 заказы с не-ISO валютой дали бы FAILED BookingRequested (fail-loud — задуманное поведение; консистентно с гейтом). В greenfield-репо таких данных нет.
3. **LOW (observation, out-of-scope — no fix)** — pre-existing `.toFixed(2)` на JS number при вводе `Tariff.price` (rate-plan/commercial-period, каталог 1.8B/1.8C — апрувлены своими ревью). Потенциальная float-coercion на входе money-цепи; вне scope 2.11 (после QuoteItem — денежная арифметика исключительно Decimal).

## 43. Review fixes

1. Документация (арх-док §8/§12/§14): «пересчёт» → «верификация» с явным пояснением «gate НЕ персистит пересчитанные суммы — никакого второго money authority». (Docs-only; регрессия не требуется — прогон уже прошёл до и после правки кода не менялся.)

## 44. Architecture decision status

0 unresolved architecture decisions. Stop conditions §45 (1–14): все закрыты — owner/freeze boundary однозначен (ISSUE); Booking amount+currency из одного источника; multi-currency Order недостижим (ISSUE-гейт); discount семантика канонична (2.3); tax/FX inclusive-exclusive не требуются (движков нет, deferred задокументирован); historical correction не требуется; auto-ledger не требуется; Payment runtime не требуется; Commission/Settlement/Payout не требуются; legacy backfill не требуется (честный NULL); cross-domain write authority не требуется (READ-only копии); breaking events нет; Order/Booking money contracts не конфликтуют.

## 45. Documentation status

`pricing-financial-snapshot.md` — исправлен (review fix §43); `api.md` Booking-секция — корректен (frozen money fact, ISO, NULL=legacy, no backfill, master-data immunity); `events.md` — актуален (0 изменений); Roadmap — обновлён. Арх-док до фикса содержал 1 вводящее в заблуждение слово — устранено.

## 46. Roadmap update

Step 2.11 → `✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES` (2026-08-14). NEXT = **STEP 2.12 — PAYMENT FLOW** (не начинается в этом проходе).

## 47. Deferred / out-of-scope

Tax engine (2.12+), FX conversion/provenance (2.12A/2.14D), Commission policy/расчёт (2.12C/E), Payment runtime (2.12), ledger auto-posting (2.12+), Settlement/Payout lifecycle (2.14), reprice/reschedule engine, `Tariff.price` float-input (1.8B). Все задокументированы в арх-доке §2/§10–§13.

## 48. Exact files changed

Review fix (docs): `docs/architecture/pricing-financial-snapshot.md` (§8/§12/§14 wording).
Roadmap: `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (2.11 → APPROVED WITH REVIEW FIXES; NEXT = Step 2.12).
Отчёт: `docs/prompts/PHASE_2_STEP_2.11_PRICING_FINANCIAL_SNAPSHOT_STRICT_REVIEW_REPORT.md` (этот файл).

## 49. Exact NEXT item

**STEP 2.12 — PAYMENT FLOW** (Payment intent/transaction lifecycle, связь с Order через Finance contracts/events) — по Roadmap v3.

## 50. Final certification

**`PHASE 2 STEP 2.11 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`**

Все hard gates пройдены независимо (код + SQL + write-paths + прогоны): единый snapshot-owner и freeze boundary (Quote ISSUE), единственный money authority (sales.money.ts; finance reuses; 0 альтернативных rounding-helper-ов; ISSUE↔gate математически идентичны), Booking.currency — единственный закрытый gap (verbatim, legacy NULL, без backfill/re-lookup), миграция аддитивная (fresh replay + drift 0), 0 новых событий/прав/cross-domain writes/ledger-постинга, 0 premature Tax/FX/Commission/Payment движков. Регрессия: unit 508/508, serial e2e 1067/1067 (60 suites), frontend 135/135 + build, migrate 51/51 drift 0.
