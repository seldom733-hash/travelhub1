# PHASE 2 — STEP 2.14 — INVOICE / COMMISSION FLOW — BLOCKED — ARCHITECTURE DECISION REQUIRED

## 1. VERDICT

`PHASE 2 STEP 2.14 BLOCKED — ARCHITECTURE DECISION REQUIRED`

Step 2.14 **не завершён** и **не маркирован** как `IMPLEMENTATION COMPLETED`.
0 production-кода внесено. Commission-половина не реализована и не изобретена.
Invoice-половина **не реализована** (решение: весь Step 2.14 незавершён).

---

## 2. SUMMARY

Roadmap body Step 2.14: «Invoice lifecycle, platform/partner commission facts».

При repo-first reconciliation выявлен **hard stop-condition §58 #4**: Commission
formula / rate / base / source authority **не определена**. Семантика комиссии
канонически принадлежит шагам, которые **⏳ NOT STARTED** (2.12C, 2.12E, 2.14E).
Промпт §9 («if commission trigger or base is undefined: STOP»), §10 («не изобретать
процент/базу; формула — только из approved contracts») и §58 #4 требуют
**BLOCKED — ARCHITECTURE DECISION REQUIRED**.

Invoice-часть доказуемо независима от Commission (источник — frozen Order snapshot),
НО реализация не начата: пользовательское решение — считать весь Step 2.14 незавершённым
и дождаться отдельного reconciliation prompt по Commission dependencies.

---

## 3. REPO-FIRST EVIDENCE — COMMISSION FORMULA / RATE / BASE / SOURCE AUTHORITY ОТСУТСТВУЕТ

### 3.1 Schema (backend/prisma/schema.prisma)
- Существуют только foundation-модели без производственной логики:
  - `Commission` (CMS-*): `orderId`, `partnerId`, `amount`, `currency`, `status`
    (ACCRUED/INVOICED/PAID), `version` — **0 rate-полей**, 0 source-полей, 0 formula.
  - `CommissionAccrual` (CAA-*): `partnerId`, `amount`, `currency`, `period`,
    `status` (ACCRUED/INVOICED/COLLECTED) — 0 rate-полей.
  - Комментарии в схеме: `Commission` — «расчёт — 2.12C/2.14»;
    `CommissionAccrual` — «агрегация/списание — 2.12E/2.14».
- **0 rule/rate/policy-моделей** для комиссии: единственные rule-модели —
  `TaxRule`, `ExchangeRate`. `grep -n "^model .*Rule|^model .*Rate|^model .*Policy"`
  → 0 commission-кандидатов.
- `acquisitionSource` (enum: MARKETPLACE / PARTNER_STOREFRONT / ...) — **channel
  discriminator**, не rate/base.
- `Partner` (CRM) — 0 commission rate-полей.

### 3.2 Frozen Order snapshot (Step 2.11)
- Frozen коммерческий снапшот: `subtotal`, `discountType`, `discountValue`,
  `discountAmount`, `total`, `currency`, `paymentScheme`, `prepayment*`,
  `acquisitionSource` — **0 commission-сумм**.
- Roadmap 2.11: «Immutable snapshot: base price, taxes, discounts, commission
  policy, currency/exchange rate, PaymentTerms… **tax/FX/commission части —
  deferred до появления canonical producer-ов**».
- `sales.contracts.ts`: «Никаких revenue/GMV/payment/commission/order/booking
  facts» — Sales НЕ производит commission.

### 3.3 Legacy / Screen Design
- `legacy/` — 0 commission rate/percent/fee (grep по ts/tsx/js/json).
- Screen Design Brief 1.6 — только concept: Finance center «Commissions»,
  «Commission Accruals — задолженность Partner перед TravelHub для
  PARTNER_COLLECT». 0 ставок/формул.

### 3.4 Итог доказательства
Ни один approved-контракт (schema, snapshot, legacy, Screen Design, Roadmap body)
не определяет:
- когда комиссия заработана/аккруена (trigger/event);
- gross base;
- rate (fixed/percentage);
- net vs gross базу;
- partner/category/channel-специфичные ставки;
- producer события, создающего accrual;
- reversal-политику при Refund/Dispute.

→ Промпт §10: «model presence alone is not authority»; §58 #4:
`commission formula/rate/base undefined` → **BLOCKED**.

---

## 4. КАНОНИЧЕСКАЯ СОБСТВЕННОСТЬ COMMISSION-СЕМАНТИКИ — ВСЕ NOT STARTED

| Step | Scope (Roadmap body) | Статус |
|---|---|---|
| 2.12C | SPLIT_AT_PAYMENT / Marketplace Commission — native PSP split (`Buyer → PSP → Partner share + TravelHub fee`; «Split должен быть реальным native PSP split, не имитацией ledger-записью») | ⏳ NOT STARTED (later extension) |
| 2.12E | PARTNER_COLLECT / Post-Factum Commission — `CommissionAccrual` фиксирует долг Partner → settlement/invoice/collection | ⏳ NOT STARTED (later extension) |
| 2.14E | Channel-Based Commission Rules — разные policies для Marketplace/Storefront/Custom Domain/API; «Никаких hardcoded ставок» | ⏳ NOT STARTED |

Вывод: Commission-факты не могут быть произведены безопасно без решения по этим
зависимостям. Реализация Commission в 2.14 = изобретение policy = нарушение §10.

---

## 5. STOP-CONDITIONS (промпт 2.14 §58, подтверждены)

- **#4 — commission formula/rate/base undefined** → BLOCKED. ✅ подтверждён.
- §9 — «If commission trigger or base is undefined: STOP». ✅ подтверждён.
- §10 — «Do not invent commission percentage/fixed fee/net vs gross base/
  partner-specific rates/tiering». ✅ соблюдено (0 изобретений).
- §48 (2.12C boundary) — «Do not silently mark 2.12C complete». ✅ соблюдено
  (2.12C остаётся NOT STARTED).

---

## 6. INVOICE-ЧАСТЬ — АНАЛИЗ НЕЗАВИСИМОСТИ (НЕ РЕАЛИЗОВАНА)

Invoice **доказуемо независима** от Commission:
- источник amount/currency — frozen Order snapshot (`total`/`currency` verbatim,
  Step 2.11), без live Product/Tax/FX re-read;
- `customerId` — из Order (`nullable`, internal-assisted flow);
- lifecycle DRAFT→ISSUED→PAID|VOID + милстоуны (issuedAt/paidAt/voidedAt —
  аддитивные колонки); PAID — проекция на PaymentCaptured (single-active Payment
  2.12 делает это безопасным без partial-payment политики);
- 0 зависимостей от Commission/CommissionAccrual.

**Однако по пользовательскому решению Invoice-часть НЕ реализована:**
- Step 2.14 как целое считается незавершённым (BLOCKED);
- частичная реализация не выполнялась — чтобы не создавать «полушаг», чей scope
  может измениться после Commission Dependency Reconciliation.

---

## 7. ЧТО НЕ СДЕЛАНО (ЯВНО)

- ❌ НЕ реализован Commission runtime (0 Commission/CommissionAccrual writer-ов).
- ❌ НЕ изобретена commission policy (ставка/база/процент/партнёрские правила).
- ❌ НЕ реализован Invoice runtime.
- ❌ НЕ маркирован Step 2.14 как IMPLEMENTATION COMPLETED.
- ❌ НЕ начат Step 2.14A (Settlement Engine).
- ❌ НЕ реализованы 2.12C/2.12E самостоятельно.
- ❌ НЕ созданы миграции/события/RBAC/тесты для 2.14.
- ❌ НЕ изменён production-код: backend, frontend, schema, миграции — без изменений 2.14.

---

## 8. ИЗМЕНЁННЫЕ ФАЙЛЫ (ТОЛЬКО ДОКУМЕНТАЦИЯ)

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`:
  - body-запись Step 2.14 → `⛔ BLOCKED — ARCHITECTURE DECISION REQUIRED`
    (с доказательствами stop-condition #4);
  - execution sequence Finance-блок: 2.13A APPROVED + NEXT = Commission
    Dependency Reconciliation (2.12C/2.12E/2.14E);
- `docs/prompts/PHASE_2_STEP_2.14_BLOCKED_ARCHITECTURE_DECISION_REQUIRED.md` — этот
  итоговый record.

Production-код, схема, миграции, тесты, frontend — **не тронуты**.

---

## 9. NEXT (зафиксировано в Roadmap)

**COMMISSION DEPENDENCY RECONCILIATION (2.12C / 2.12E / 2.14E)** — отдельный prompt:
определить канонический producer/формулу/базу/trigger комиссии и зависимость
2.14 от 2.12C/2.12E/2.14E, прежде чем 2.14 сможет продолжиться.

Ограничения (пользовательское решение):
- НЕ начинать 2.14A (Settlement Engine) до разблокировки 2.14;
- НЕ реализовывать 2.12C/2.12E самостоятельно;
- дождаться отдельного reconciliation prompt по Commission dependencies.

---

## 10. РЕГРЕССИЯ

Не выполнялась и не требуется: production-код не изменён. Бейзлайн без изменений:
unit `548/548`, serial e2e `1105/1105` (63 suites), frontend `135/135`,
migrations `54/54`, drift 0.
