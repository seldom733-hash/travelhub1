# Commission Policy Foundation (Phase 2 Step 2.14E, ADR-0013)

## 1. Purpose

Материализация канонического **Commission policy authority** (ADR-0013): mutable
Finance-owned master data `finance.CommissionPolicy` — структура/владение/семантика/
границы/инварианты. Это **не** расчёт, не freeze, не accrual, не collection, не
invoice, не PSP-split.

## 2. Exact Roadmap/ADR scope

- Roadmap 2.14E: «Channel-Based Commission Rules — разные commission policies для
  Marketplace, Storefront, Custom Domain, API/Manual. **Никаких hardcoded ставок**»;
- ADR-0013 (DECIDED): D1 owner, D2 dimensions, D3 rate types, D15 channel,
  D16 effective/versioning, D17 precedence, D18 RBAC, D19 events;
- Step 2.14 остаётся ⛔ BLOCKED; 2.12C/2.12E/2.14A–D — NOT STARTED.

## 3. Ownership

Единственный владелец — **Finance** (`CommissionPolicyService`). Settings/Catalog/
Sales/PSP/frontend НЕ дублируют authority. Cross-domain writes запрещены (ADR-0001):
policy CRUD создаёт 0 фактов/0 side-effects в других доменах.

## 4. Channel contract (D15)

Отдельный vocabulary `CommissionChannel` (НЕ AcquisitionSource — семантика разная):

| Значение | Статус |
|---|---|
| `MARKETPLACE` | V1 commission-capable (единственный допустимый для create) |
| `PARTNER_STOREFRONT` | SaaS no-commission (ADR-0006) — create → 422 |
| `DIRECT` / `BUYER_REQUEST` | no-commission — create → 422 |
| `CUSTOM_DOMAIN` / `API` | deferred (Roadmap 2.5B, НЕ добавлены в enum) |

## 5. Policy schema (CMP-*)

- `code CMP-*` (IdsService, server-owned, в той же транзакции);
- `channel` (matching key V1, не меняется после создания — identity);
- `rateType` = `PERCENTAGE` (V1; server-derived, forged → 422);
- `rate DECIMAL(18,6)` — **десятичная доля** 0 < rate < 1 (0.15 = 15%; «10» НЕ
  валиден). Representation: прецедент ExchangeRate (rate ≠ amount);
  **каноническая форма «0.dddddd»** (строгий review fix 2.14E): scientific
  notation («1e-7» = 0.0000001 → DECIMAL(18,6) округлял до 0.000000 — молчаливая
  0%-policy), whitespace (« 0.15 » → DecimalError → raw 500), «+0.15»/«.15»/
  «0,15»/all-zero fraction — все → контролируемый 422; regex-authority без JS
  float arithmetic: `/^0\.(?!0+$)\d{1,6}$/`;
- `status` DRAFT → ACTIVE → ARCHIVED (CAS);
- `version` — server-owned, инкремент на draft-итерацию; `createdAt` НЕ precedence;
- `effectiveFrom`/`effectiveTo` — селекция [from, to), open-ended = NULL;
- `CommissionPolicyHistory` — audit by default + **полный state snapshot на версию**
  (future frozen snapshot воспроизводит (code, version) без текущего lookup).

## 6. Lifecycle & commands

| Команда | Transition | Overlap | Версия |
|---|---|---|---|
| `POST /commission-policies` | → DRAFT | — (DRAFT не селектируема) | 1 |
| `PATCH /commission-policies/:code` | DRAFT only (иначе 422) | — | +1 |
| `POST /commission-policies/:code/activate` | DRAFT → ACTIVE (idempotent no-op если ACTIVE) | **проверка overlap → 409** | без изменений |
| `POST /commission-policies/:code/archive` | DRAFT\|ACTIVE → ARCHIVED (idempotent no-op) | — | без изменений |

ACTIVE/ARCHIVED immutable: изменение ставки = новая policy (ADR D16 «новая запись
с новым effectiveFrom»).

## 7. Overlap/ambiguity invariant

- Сериализация: `pg_advisory_xact_lock(hashtext('commission-policy:'||channel))` на
  create/update/activate/archive — concurrent conflicting activate → один 201 + 409,
  0 raw 500 (e2e T10);
- activate: любой другой ACTIVE policy канала с пересечением [from, to) → **409**
  (никогда arbitrary first-row; half-open [from, to) — касающиеся границы не
  пересекаются);
- resolver backstop: >1 applicable ACTIVE → `AMBIGUOUS` → no policy (fail-closed).

## 8. Resolver

`resolveCommissionPolicy(channel, businessInstant)` — детерминированный read path для
future consumer-ов (freeze-шаг / 2.12E / 2.12C):
- channel ∉ {MARKETPLACE} → `{found:false, reason:"NO_COMMISSION_CHANNEL"}`;
- 0 ACTIVE в окне → `NO_POLICY`; ровно 1 → `POLICY_FOUND` + policy; >1 → `AMBIGUOUS`.
НЕ считает amount, НЕ читает Catalog, НЕ пишет, НЕ эмитит факты.

## 9. Money/rate contract

- Decimal (Prisma), строковый API; 0 JS float;
- rate: 0 < rate < 1, ≤ 6 знаков (DECIMAL(18,6)); scale-ошибки → 422;
- верхняя граница экономически осмыслена (rate < 1 = < 100%; «no commission» =
  отсутствие policy, НЕ rate=0).

## 10. RBAC

- `finance.commission.manage` — **новое** (FINANCE/ADMIN; ADMIN via ALL_PERMISSIONS):
  create/update/activate/archive;
- `finance.commission.read` — read (factual держатели: FINANCE/DIRECTOR/ANALYST;
  SALES_MANAGER/OPERATOR/BUYER/PARTNER → 403);
- anonymous → 401; без права → 403.

## 11. Mass assignment

`COMMISSION_POLICY_FORBIDDEN_KEYS` (raw-body, loud 422): id/code/version/createdAt/
updatedAt/status/rateType/actor*/correlation/causation.

## 12. Audit / events

- AuditLog (snake_case): `finance.commission_policy.created/updated/activated/archived`;
- `CommissionPolicyHistory` (per-version full state);
- **0 доменных событий** (ADR-0013 D19 — master data, нет consumer-ов);
- `CommissionAccrued` / `CommissionAdjusted` — НЕ эмитятся (2.12E/2.14+).

## 13. Boundaries (доказаны e2e T11/T12/T13)

- 0 Commission/CommissionAccrual/LedgerTransaction/ProviderFee/Settlement/Payout/
  Invoice/Payment/Refund/Dispute rows (T12);
- 0 Order/Booking/Availability writes (T13); 0 PSP/webhook; 0 tax/FX; 0 ledger;
- legacy-факты не backfill-ятся (T15); 0 live Catalog lookup.

## 14. Migration / compatibility

- `20260814180000_add_commission_policy_foundation` — аддитивная (3 enums +
  CommissionPolicy + CommissionPolicyHistory + индексы), fresh replay proof
  (serial e2e 64 suites с нуля), drift 0;
- 0 backfill; legacy строки валидны.

## 15. Seller/partner snapshot dependency

`Order.sellerPartnerId` (frozen атрибуция, ADR-0013 D14) **НЕ реализован в 2.14E** —
документированная зависимость следующего шага (freeze-шаг) ДО любого
commission-producer. Пока не удовлетворена — commission-факты не производятся.

## 16. Deferred 2.14A+ scope

Расчёт/заморозка на Quote ISSUE, Commission fact producer, CommissionAccrual (2.12E),
SPLIT (2.12C), buyer invoice (2.14), adjustments, tax/FX — НЕ в 2.14E.
