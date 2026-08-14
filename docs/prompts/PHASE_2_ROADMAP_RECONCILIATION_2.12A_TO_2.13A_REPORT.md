# PHASE 2 — ROADMAP RECONCILIATION AUDIT — STEPS 2.12A–2.12G vs 2.13 / 2.13A — REPORT

## 1. Verdict
`ROADMAP RECONCILIATION COMPLETED — MIXED DEPENDENCY ORDER ESTABLISHED`

**Суть:** Steps 2.12A–2.12G НЕ были «ошибочно пропущены» перед 2.13 — они являются
интентными later extensions (логические расширения 2.12 core), что явно
документировано в body Roadmap и арх-доках. Step 2.13 корректен и остаётся
APPROVED. Step 2.13A — MIXED DEPENDENCY: provider-neutral foundation допустим
после 2.13; real-PSP chargeback и ledger/commission/settlement adjustments имеют
явные prerequisites (2.12A/2.12B и 2.12D/2.12C/2.14A), зафиксированные в Roadmap.

## 2. Repository baseline
- Branch `master`, HEAD `3e89387`; рабочее дерево содержит артефакты 2.13 (implementation + strict review).
- Migrations 53/53, drift 0; unit 534/534; serial e2e 1093/1093 (62 suites); frontend 135/135.
- Certified state: Step 2.12 ✅ APPROVED WITH REVIEW FIXES; Step 2.13 ✅ APPROVED (NO REVIEW FIXES); Steps 2.12A–2.12G — NOT STARTED (⏳ PLANNED); Roadmap NEXT до реконсиляции — Step 2.13A.
- Roadmap v3 `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (1683 строки) + 10 отчётов/арх-доков 2.10–2.13.

## 3. Sources inspected
- Roadmap v3: body Steps 2.12/2.12A–G/2.13/2.13A (строки 587–623), «CURRENT CANONICAL EXECUTION SEQUENCE» (1414+), «Полная авторитетная последовательность после 2.5B» (1506+), Dependency Analysis (2.2A–F/1.8A–D прецедент).
- Промпты/отчёты: 2.12 implementation + strict review, 2.13 implementation + strict review.
- Арх-доки: `payment-flow.md`, `refund-flow.md`, `finance-temporal-contract.md`, `provider-fee-settlement-payout-foundation.md`, `finance-domain-foundation.md`.
- Код: `payment.service.ts`, `refund.service.ts`, `settlement.service.ts`, `finance.validation.ts`, `finance.controller.ts`, `order.subscribers.ts`, `schema.prisma` (Payment/Refund/ProviderFee/Commission/CommissionAccrual/LedgerTransaction), `permissions.constants.ts`, `domain-events.ts`.
- Тесты: `payment-flow.e2e-spec.ts`, `refund-flow.e2e-spec.ts`, foundation e2e (boundaries), phase2-entry-audit.
- Repo-wide search: `2.12A–G`, `PSP`, `webhook`, `authorizedAt`, `capturedAt`, `Commission`, `CommissionAccrual`, `LedgerTransaction`, `partial`, `ProviderFee`, `feeType`, `Chargeback`, `Dispute`, `Settlement`, `Payout`.

## 4. Canonical Roadmap step table
| Step | Exact canonical title | Declared purpose | Declared predecessor | Declared successor | Current status |
|---|---|---|---|---|---|
| 2.12 | Payment Flow | provider-neutral Payment runtime (PENDING → CAPTURED\|FAILED\|CANCELLED) | 2.11 (Pricing & Financial Snapshot) | 2.13 (NEXT = STEP 2.13 в записи 2.12) | ✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES |
| 2.12A | Payment Provider Abstraction | provider-agnostic adapters; Stripe/Adyen/Mangopay/... не domain model; capability matrix | 2.12 core | 2.12B | ⏳ NOT STARTED (later extension) |
| 2.12B | Buyer Card / Wallet Payment | card/Apple/Google Pay; authorize/capture/fail/cancel; webhook signature; idempotency | 2.12A | 2.12C | ⏳ NOT STARTED (later extension) |
| 2.12C | SPLIT_AT_PAYMENT / Marketplace Commission | native PSP split: Buyer → PSP → Partner share + TravelHub fee | 2.12B | 2.12D | ⏳ NOT STARTED (later extension) |
| 2.12D | PLATFORM_COLLECT Mode | Buyer → platform rail → Ledger/Settlement → Payout Partner | 2.12C | 2.12E | ⏳ NOT STARTED (later extension) |
| 2.12E | PARTNER_COLLECT / Post-Factum Commission | CommissionAccrual фиксирует долг Partner; settlement/invoice/collection | 2.12D | 2.12F | ⏳ NOT STARTED (later extension) |
| 2.12F | Partial Payments / Installments | deposit 30/70; каждый платёж — отдельный Payment/allocation; paid/outstanding/due | 2.12E | 2.12G | ⏳ NOT STARTED (later extension) |
| 2.12G | PSP / Provider Fees | ProviderFee ≠ Commission; processing/FX/cross-border/payout fees — отдельные факты | 2.12F | 2.13 | ⏳ NOT STARTED (later extension) |
| 2.13 | Refund Flow | provider-neutral Refund runtime (REQUESTED → APPROVED → PROCESSED\|FAILED) | 2.12 | 2.13A | ✅ STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES) |
| 2.13A | Chargeback / Dispute Foundation | dispute/chargeback, evidence, liability, ledger/commission/settlement adjustments | 2.13 | 2.14 (Invoice / Commission Flow) | ⏳ PLANNED (после реконсиляции — с явными prerequisites) |

## 5. Body vs execution-sequence reconciliation
**Находка (stale execution sequence):** раздел «CURRENT CANONICAL EXECUTION SEQUENCE»
(1414+) и «Полная авторитетная последовательность после 2.5B» (1506+) НЕ содержат
шагов 2.10–2.13 вообще (0 упоминаний; последовательность обрывается на
`2.9 → 2.9A → … → 3.29`). Это исторический снапшот 2026-08-10, не обновлённый
после Finance-блока. При этом body Roadmap (строки 560–621) содержит полные
записи 2.10–2.13 с ✅ APPROVED и NEXT-цепочками. Финансовый блок выполнялся по
body NEXT markers (2.10 → 2.10A → 2.10B → 2.10C → 2.11 → 2.12 → 2.13),
корректно и последовательно.

**Разрешение:** не противоречие по существу (порядок исполнения Finance-блока
доказанно верен и approved), но metadata-дефект: execution sequence должна
отражать Finance-блок. **Исправлено (metadata-only, §23):** в «Полную
авторитетную последовательность» добавлен блок «Finance-блок (2.10–2.13)» с
фактической цепочкой и принципом «2.12A–G — логические расширения, НЕ
prerequisites» (прецедент 2.2A–F/1.8A–D из Dependency Analysis).

**Отсутствие конфликтов:** body vs summary — согласованы; stale NEXT — нет
(последний NEXT до реконсиляции = 2.13A, подтверждён); accidental skip — нет
(см. §7–§13); intentional deferred semantics — да, документировано.

## 6. Dependency graph
| Step | Depends on 2.12 core | Required before 2.13? | Required before 2.13A? | Safe after 2.13? | Evidence |
|---|---:|---:|---:|---:|---|
| 2.12A Provider Abstraction | Да (расширяет 2.12) | Нет | Частично (real-PSP chargeback) | Да (аддитивно) | 2.13 source = CAPTURED Payment; 0 PSP-путей (e2e T11, repo audit) |
| 2.12B Buyer Card/Wallet | Да (authorize/capture lifecycle) | Нет | Частично (real-PSP chargeback) | Да (аддитивно) | AUTHORIZED reserved unreachable; authorizedAt/capturedAt deferred; 2.13 не требует |
| 2.12C SPLIT/Commission | Да (native split) | Нет | Частично (commission adjustments) | Да (аддитивно) | 0 Commission/CommissionAccrual в Refund (e2e T11) |
| 2.12D PLATFORM_COLLECT/Ledger | Да (ledger posting) | Нет | Частично (ledger adjustments) | Да (аддитивно) | 0 LedgerTransaction в Payment/Refund (e2e T11; 2.12D defer документирован) |
| 2.12E PARTNER_COLLECT/CommissionAccrual | Да | Нет | Частично | Да (аддитивно) | 0 CommissionAccrual writer-ов prod |
| 2.12F Partial Payments | Да (ломает one-active-per-order) | Нет | Нет | Да (аддитивная переработка индекса; документировано в миграции 2.12) | Refund partial в scope независимо; isActivePayment эволюционируем |
| 2.12G PSP Fees | Да (feeType-discriminator) | Нет | Нет | Да (swap на пустых таблицах, документировано 2.10B review) | 0 feeType в schema/code; ProviderFee без discriminator |

**Вывод:** ни один 2.12A–G не является обязательным prerequisite для 2.13
(2.13 — provider-neutral, source = CAPTURED Payment, 0 чужих side-effects,
доказано e2e T11 и repo-wide write-path audit). Все 2.12A–G безопасны как later
extensions после уже-approved 2.13 (аддитивные миграции, эволюционируемые
idempotency-ключи, 0 destructive rewrite).

## 7. Step 2.12A assessment
- Canonical scope: provider-agnostic adapters (Stripe/Adyen/Mangopay/Checkout.com/
  Rapyd/банки — не domain model), capability matrix по country/currency/rail.
- 1. Нужен ли для 2.13? **Нет.** Refund 2.13 работает на внутреннем CAPTURED
  Payment (manual/provider-neutral), 0 внешних вызовов.
- 2. Использует ли Refund provider-specific behavior? **Нет** (repo-wide 0
  PSP/webhook/adapters; providerRef nullable, forbidden at create).
- 3. Был ли 2.13 provider-neutral intentionally? **Да** — зафиксировано в
  записи 2.13 («PSP/chargeback — 2.13A+») и refund-flow.md §PSP-boundary.
- 4. Можно ли добавить 2.12A после 2.13 additive-only? **Да** — новые модули/
  adapters, 0 изменений существующего Payment/Refund runtime.
- **Вывод:** later extension, не блокирует 2.13; prerequisite только для
  real-PSP части 2.13A (chargeback от провайдера).

## 8. Step 2.12B assessment
- Canonical scope: Buyer card/wallet, authorize/capture/fail/cancel, webhook
  signature, idempotency.
- Сопоставление с текущим: PENDING → CAPTURED|FAILED|CANCELLED (2.12 core);
  paidAt на CAPTURED; AUTHORIZED — reserved vocabulary (unreachable);
  authorizedAt/capturedAt — deferred (2.12B), зафиксировано в payment-flow.md
  §Temporal и в 2.12 strict review §12.
- 2.13 не требует AUTHORIZED/capturedAt: Refund source = CAPTURED (после
  подтверждения Finance), 0 зависимости от PSP authorize.
- **Вывод:** later extension; temporal-совместимость подтверждена (paidAt vs
  будущий capturedAt — разные факты: paidAt = деньги получены, capturedAt =
  PSP capture; конфликта нет, документировано 2.12 review §12). Prerequisite
  для real-PSP chargeback 2.13A.

## 9. Step 2.12C assessment
- Canonical scope: SPLIT_AT_PAYMENT native PSP split (Buyer → PSP → Partner
  share + TravelHub fee). Явное требование Roadmap: «Split должен быть реальным
  native PSP split, не имитацией ledger-записью».
- Refund 2.13 НЕ зависит от Commission: 0 Commission/CommissionAccrual
  reversal/netting (e2e T11, refund-flow.md §Commission boundary).
- Commission reversal перед Refund не требуется (Refund — операционный факт
  возврата денег, не комиссионная математика).
- **Вывод:** later extension; prerequisite для commission adjustments 2.13A
  (при их включении в scope 2.13A).

## 10. Step 2.12D assessment
- Canonical scope: PLATFORM_COLLECT — Buyer → platform-controlled rail →
  Ledger/Settlement → Payout Partner.
- Payment 2.12 / Refund 2.13 подтверждённо держат Ledger count 0 (e2e T11
  payment-flow и refund-flow: ledger/пауты/прочие fact-счётчики не меняются;
  2.12D defer документирован в payment-flow.md §Ledger boundary).
- Required до Chargeback? **Частично:** ledger adjustments в 2.13A (Roadmap
  scope «ledger/commission/settlement adjustments») требуют ledger posting,
  который определён в 2.12D.
- Safe после 2.13: **Да** (аддитивно).
- **Вывод:** later extension; prerequisite для ledger-adjustment-части 2.13A.

## 11. Step 2.12E assessment
- Canonical scope: PARTNER_COLLECT — Buyer платит Partner → CommissionAccrual
  фиксирует долг → settlement/invoice/collection.
- Связь с 2.12C (SPLIT) и Settlement/Payout: 2.12C — native split на PSP;
  2.12E — post-factum accrual. Обе — commission-механики, НЕ используются
  Refund 2.13 (0 writer-ов CommissionAccrual в prod; schema-only foundation).
- **Вывод:** later extension; prerequisite только для commission-adjustment-
  части 2.13A.

## 12. Step 2.12F assessment
- Canonical scope: partial payments/installments — deposit/30-70; каждый платёж
  — отдельный Payment/allocation; paid/outstanding/due.
- Текущее: `isActivePayment` + partial unique `Payment_one_active_per_order`
  (≤1 активный Payment на Order); 2.12F снимет/переработает индекс в своей
  аддитивной миграции — зафиксировано в миграции 2.12 и 2.12 strict review §7.
- Partial Refund (2.13) НЕ зависит от partial Payment: refund-частичность —
  несколько Refund-фактов на один CAPTURED Payment (разные суммы), что
  независимо от того, как будущие partial payments лягут на Order.
- Required до 2.13A? **Нет** (chargeback — полный возврат по dispute, не
  частичная разбивка).
- **Вывод:** later extension; эволюция аддитивная, approved partial semantics
  не блокируются (документировано).

## 13. Step 2.12G assessment
- Canonical scope: PSP/provider fees — processing/FX/cross-border/payout,
  отдельные факты от TravelHub Commission; ProviderFee ≠ Commission.
- Текущее: ProviderFee — foundation-модель (2.10B) БЕЗ feeType-discriminator
  (repo-wide 0 упоминаний feeType); 2.10B strict review документировал эволюцию
  «2.12G feeType-discriminator — swap на пустых таблицах».
- Prerequisite relation к Payment/Refund/Chargeback: НЕ требуется для 2.13;
  для 2.13A — только если dispute fees в scope.
- **Вывод:** later extension; безопасен аддитивно.

## 14. Current 2.13 compatibility — HARD GATE
`COMPATIBLE — NO ROLLBACK REQUIRED`

Для каждого missing 2.12A–G:
- Refund использует семантику, которой нет? **Нет** — source = CAPTURED
  Payment (существует с 2.12), milestones canonical (2.10C), partial refunds —
  собственные факты (не partial payments).
- Fake placeholder semantics? **Нет** — 0 PSP/webhook/AUTHORIZED/Commission/
  Ledger/partial/feeType в Refund-пути (repo audit + e2e T11).
- Schema-поле, чей смысл изменится? **Нет** — `isActiveRefund`/milestones
  остаются; будущие 2.12A–G добавляют новые поля/факты.
- Idempotency-ключ с destructive replacement? **Нет** — `Refund_one_active_
  per_payment_amount` (paymentId+amount) не пересекается с будущими
  Payment-ключами (2.12F) — разные таблицы/агрегаты.
- Event contract с break? **Нет** — Payment*/Refund* события расширяемы
  аддитивно (новые типы, без переименования/версионирования).
- Миграции остаются валидными: 2.12 + 2.13 аддитивные, drift 0, fresh replay
  доказан.

## 15. Current 2.13A readiness — HARD GATE
Prerequisites по scope 2.13A («dispute/chargeback, evidence, liability,
ledger/commission/settlement adjustments»):
- real PSP/provider identity → **2.12A/2.12B** (не выполнены);
- Payment authorization/capture → частично (2.12 core CAPTURED есть; PSP
  capture — 2.12B);
- provider transaction IDs → 2.12A/2.12B;
- Refund interaction → ✅ 2.13 (выполнен);
- Ledger posting → 2.12D (не выполнен);
- dispute callbacks/webhook → 2.12A/2.12B;
- commission/fee reversals → 2.12C/2.12E/2.12G (не выполнены).

**Вывод:** 2.13A **может начаться** как provider-neutral Chargeback/Dispute
FOUNDATION (dispute/evidence/liability факты, как 2.12/2.13 были provider-
neutral), НО полный scope («ledger/commission/settlement adjustments» и
real-PSP chargeback) имеет невыполненные prerequisites. Это НЕ «2.13A MUST
NOT START» целиком — это mixed dependency, зафиксированная в Roadmap:
foundation допустим, real-PSP/adjustments — после 2.12A/B и 2.12D/2.12C/2.14A.
Промпт 2.13A обязан явно определить foundation-vs-real-PSP scope перед началом.

## 16. Migration compatibility
- 2.12 `20260814120000_add_payment_runtime`: аддитивная (milestones +
  isActivePayment + PaymentHistory + partial unique).
- 2.13 `20260814150000_add_refund_runtime`: аддитивная (milestones +
  isActiveRefund + RefundHistory + Order.refundedAmount).
- 2.12A–G добавляемы без destructive rewrite: новые таблицы/колонки/индексы;
  единственный будущий «swap» — `Payment_one_active_per_order` → 2.12F
  (переработка на пустых/частичных данных, документировано) и ProviderFee
  feeType (2.12G, пустые таблицы). 0 конфликтов с Refund-инвариантами.

## 17. Event compatibility
- Payment*/Refund* события (4+4): аддитивно расширяемы новыми типами
  (AuthorizationCaptured, RefundRequested от PSP и т.п.) без переименования
  существующих; envelope стабилен (BusinessEventEnvelope, ADR-0010).
- Breaking rename/version change отсутствует. 2.12A–G не требуют модификации
  существующих payload.

## 18. Temporal compatibility
- Текущие milestones: Payment paidAt/failedAt/cancelledAt; Refund
  requestedAt/approvedAt/processedAt/failedAt; Ledger occurredAt.
- Deferred: authorizedAt/capturedAt (2.12B), refundedAt (архивное, канон —
  processedAt).
- paidAt (деньги получены) vs будущий capturedAt (PSP capture): разные факты,
  конфликта нет (2.12 strict review §12 оценил и зафиксировал). Chargeback
  (2.13A) добавит dispute-милстоуны аддитивно.
- Stop-condition «paidAt/capturedAt conflict» — НЕ сработал.

## 19. Money compatibility
- 2.12A–G не могут ретроспективно reprice: frozen Order snapshot (2.11/2.12),
  Payment.amount immutable, Refund.amount immutable; PSP/commission/ledger/
  partial features — новые факты, 0 мутаций существующих денег (boundary
  доказан e2e T11 + write-path audits 2.12/2.13).

## 20. Current status of every 2.12A–G
| Step | Status | Обоснование |
|---|---|---|
| 2.12A | NOT STARTED (⏳ PLANNED) | 0 PSP-адаптеров/вызовов в prod |
| 2.12B | NOT STARTED (⏳ PLANNED) | AUTHORIZED reserved, authorizedAt/capturedAt отсутствуют |
| 2.12C | NOT STARTED (⏳ PLANNED) | 0 Commission writer-ов; split не реализован |
| 2.12D | NOT STARTED (⏳ PLANNED) | 0 LedgerTransaction авто-постинга |
| 2.12E | NOT STARTED (⏳ PLANNED) | 0 CommissionAccrual writer-ов |
| 2.12F | NOT STARTED (⏳ PLANNED) | PARTIALLY_PAID в enum OrderPaymentStatus, 0 runtime |
| 2.12G | NOT STARTED (⏳ PLANNED) | 0 feeType в schema/code |

НЕ маркированы completed: наличие schema-полей (AUTHORIZED/REFUNDED/
PARTIALLY_PAID/providerRef/CommissionAccrual) — foundation-словарь, не runtime
(подтверждено 2.10 foundation: «создание — 2.12–2.14»).

## 21. Negative checks (все PASS)
1. 0 PSP/webhook — repo-wide grep: только комментарии «2.12A/2.12B» в
   payment.service/controller; 0 вызовов/маршрутов (prod).
2. AUTHORIZED unreachable — payment.service transition: только
   PENDING → CAPTURED|FAILED|CANCELLED; AUTHORIZED/REFUNDED в комментариях.
3. 0 CommissionAccrual — 0 writer-ов (schema-only; e2e T11 counts 0).
4. 0 Payment→Ledger — 0 LedgerTransaction create в Payment/Refund (e2e T11).
5. 0 partial Payment — PARTIALLY_PAID только в enum (OrderPaymentStatus),
   0 runtime-переходов.
6. 0 feeType — grep: 0 упоминаний вне docs.
7. Refund не реализовал чужие scope-ы — refund-flow: только Refund-факты +
  Order-owned projection; 0 PSP/commission/ledger/partial/feeType.
8. Chargeback/Dispute не начат — 0 dispute-кода; 2.13A ⏳ PLANNED.
9. Нет false approved markers — 2.12/2.13 APPROVED по своим scopes (strict
  reviews проверили boundaries); 2.12A–G корректно NOT STARTED.

## 22. Positive checks (все PASS)
1. 2.12 core работает независимо — provider-neutral Payment runtime,
   self-contained (frozen Order source).
2. 2.13 работает независимо — Refund на CAPTURED Payment, 0 чужих зависимостей.
3. Будущая эволюция аддитивна — 2.12A–G добавляют новые модули/факты/поля.
4. Миграции валидны — 53/53, drift 0, fresh replay.
5. События расширяемы — новые типы без break.
6. Rollback не требуется — последовательность исправлена metadata-only,
  approved работа не откатывается.

## 23. Rollback/reopen assessment
- Step 2.13: **leave approved** — корректен (provider-neutral, dependencies
  satisfied, 0 чужого scope). Выполнен «вне документной позиции 2.12A–G», но
  это интентная later-extension семантика (прецедент 2.2A–F/1.8A–D), явно
  отмечено в Roadmap (execution sequence Finance-блок).
- Reopen implementation/strict review: НЕ требуется.
- Rollback: НЕ требуется.

## 24. Exact recommended execution order
`2.13A (provider-neutral Chargeback/Dispute FOUNDATION) → 2.12A → 2.12B →
2.12C → 2.12D → 2.12E → 2.12F → 2.12G → 2.14 (Invoice/Commission) → 2.14A
(Settlement Engine)` — с явным условием: real-PSP chargeback и
ledger/commission/settlement adjustments в 2.13A требуют 2.12A/2.12B и
2.12D/2.12C/2.14A соответственно; если промпт 2.13A включает их — порядок
меняется (2.12A/2.12B перед 2.13A).

**Канонический NEXT:** Step 2.13A — Chargeback / Dispute Foundation
(provider-neutral foundation scope; реальный PSP — после 2.12A/2.12B).

## 25. Roadmap corrections applied (metadata-only, §23)
1. **Execution sequence (полная последовательность после 2.5B):** добавлен
   блок «Finance-блок (2.10–2.13) — выполнено по body NEXT markers
   (Roadmap Reconciliation 2026-08-14)» — цепочка 2.10→…→2.13 (все APPROVED),
   принцип «2.12A–G — логические расширения, НЕ prerequisites» (прецедент
   Dependency Analysis), mixed-dependency 2.13A, актуальный NEXT.
2. **Body Step 2.13A:** статус-маркер `⏳ PLANNED` + блок PREREQUISITES
   (provider-neutral foundation допустим после 2.13; real-PSP chargeback →
   2.12A/2.12B; adjustments → 2.12D/2.12C/2.14A).
Canonical scope НЕ переписан; historical truth сохранена (2.13 approved,
выполнен до 2.12A–G — интентно, отмечено).

## 26. Architecture decision status
Архитектурных блокеров НЕТ (stop-conditions §26 промпта отрицательны:
Roadmap body и sequence согласованы после коррекции; scopes 2.12A–G ясны;
2.13 корректность не зависит от skipped-семантики; 2.13A зависимости
зафиксированы; destructive rework отсутствует; paidAt/capturedAt конфликта
нет; Refund/Payment проекции совместимы с future partial; Chargeback
foundation не требует real PSP).

## 27. Follow-up implementation requirements
- Промпт 2.13A обязан явно определить: foundation-only (dispute/evidence/
  liability) vs real-PSP chargeback; при real-PSP — добавить 2.12A/2.12B
  prerequisites; при adjustments — 2.12D/2.12C/2.14A.
- Никакого production-патча в рамках этого audit (0 изменений кода/схемы/
  миграций — подтверждено).

## 28. Exact NEXT item
`PHASE 2 — STEP 2.13A — CHARGEBACK / DISPUTE FOUNDATION` (provider-neutral
foundation scope; prerequisites зафиксированы; не начинается в этом проходе).

## 29. Final conclusion
`ROADMAP RECONCILIATION COMPLETED — MIXED DEPENDENCY ORDER ESTABLISHED`

- 2.12A–2.12G — интентные later extensions, НЕ ошибочный пропуск; ни один не
  является prerequisite для 2.13 (доказано кодом + e2e + strict reviews).
- 2.13 остаётся APPROVED (NO ROLLBACK REQUIRED).
- 2.13A — mixed dependency: foundation допустим, real-PSP/adjustments имеют
  prerequisites (2.12A/2.12B, 2.12D/2.12C/2.14A), зафиксированные в Roadmap.
- Metadata-коррекции: execution sequence дополнен Finance-блоком; 2.13A
  помечен ⏳ PLANNED + PREREQUISITES. Код/схема/миграции не тронуты.
