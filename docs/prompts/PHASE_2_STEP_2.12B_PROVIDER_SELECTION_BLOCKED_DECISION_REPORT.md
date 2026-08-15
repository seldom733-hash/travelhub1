# PHASE 2 — STEP 2.12B — PROVIDER SELECTION BLOCKED — DECISION REPORT

## Verdict

`PHASE 2 STEP 2.12B BLOCKED — PROVIDER SELECTION REQUIRED`

Step 2.12B (Buyer Card / Wallet Payment) не может быть реализован в текущем
проходе: **канонический PSP не выбран**. Реализация adapter/webhook/runtime
запрещена до решения authority (Product/Business) о провайдере — изобретать
PSP или использовать test-only fake как production контракт нельзя (prompt
§4: «Do not invent a PSP», «No temporary provider choice just to complete
the step»; §59 stop condition #1).

## Repository-first evidence (2026-08-15)

- **Roadmap v3, 2.12B entry:** «Card, Apple Pay, Google Pay где
  поддерживается; authorize/capture/fail/cancel, webhook signature,
  idempotency» — НИ ОДНОГО имени провайдера. RECONCILIATION 2026-08-15
  фиксирует только hard prerequisites (2.12A + 2.12H) и PSP-local
  multi-instance задачи — не выбор PSP.
- **Roadmap line 593 (2.12A entry):** «Stripe/Adyen/Mangopay/Checkout.com/
  Rapyd/банки не являются domain model» — провайдеры упомянуты только как
  НЕ domain model, не как selection.
- **ADR-0010/0013/0014:** PSP упоминается как boundary (не владелец policy,
  не domain model, split → 2.12C) — выбора нет.
- **Архитектура:** `docs/architecture/payment-provider-abstraction.md` —
  `KNOWN_PAYMENT_PROVIDER_CODES` is EMPTY: «no production PSP selected yet.
  Step 2.12B registers real adapters».
- **Код:** `provider.types.ts` — `KNOWN_PAYMENT_PROVIDER_CODES = [] as const`;
  `payment-provider.spec.ts` #214 — assert `toHaveLength(0)`. Единственный
  адаптер — `FakePaymentProvider` (TEST-ONLY, не регистрируется production
  конфигурацией; `has("FAKE") === false` на production registry).
- **Промпты/документы:** ни одного provider-selection документа/промпта.

## Что уже готово (prerequisites APPROVED, persistence подтверждён)

- 2.12A Payment Provider Abstraction — ✅ APPROVED WITH REVIEW FIXES
  (registry, capability model, provider-operation identity, fake isolation);
- 2.12H External API Idempotency Contract — ✅ APPROVED WITH REVIEW FIXES
  (header contract, digest slots, DB backstop, crash-window C fault
  injection, 1177/1177 serial e2e);
- Roadmap NEXT = 2.12B; artifact integrity PASS=102 WARN=0 FAIL=0;
  migrations 57/57; HEAD == upstream == `94a2d0e`.

## Требуемое решение authority

Выбор одного канонического провайдера ИЛИ approved provider set + критерии
выбора. Кандидаты, запрещённые к самовольному выбору: Stripe, Adyen,
Checkout.com, Rapyd, YooKassa/СБП, банковские PSP и т.п. — любой выбор
должен быть зафиксирован в Roadmap/ADR (provider choice decision), включая
хотя бы: юрисдикция/валюты (AZN/USD/RUB), карты + Apple Pay/Google Pay,
sandbox-доступ для CI-независимых контрактных тестов, webhook-события и
signature scheme, provider-native idempotency key support, стоимость/сроки.

## После решения (последовательность)

1. Зафиксировать provider choice в Roadmap/ADR;
2. Реализация 2.12B по существующему контракту (2.12A adapter boundary +
   2.12H idempotency + PaymentService authority + webhook dedup/reorder/
   multi-instance + PCI tokenized-only);
3. Strict Review 2.12B;
4. 2.12C (SPLIT) — НЕ начинать до approval 2.12B.

## Scope discipline в этом проходе

0 файлов production-кода изменено; 0 schema-изменений; 0 адаптеров;
0 webhook-роутов. Изменены только: Roadmap 2.12B entry (⛔ BLOCKED —
PROVIDER SELECTION REQUIRED, BLOCKED 2026-08-15 note) + этот decision
report. Регрессия не требуется (документация-only); artifact checker
перепроверен.

REPOSITORY EVIDENCE
repository: travelhub_v1 (local canonical identity)
branch: master
head: <после первого коммита>
origin: <после push>
worktree_clean: false (unrelated untracked prompts)
migration_count: 57
reviewed_state: COMMIT
reviewed_diff_base: 94a2d0e
reviewed_diff_head: <decision-коммит>
persistence_status: NOT_PERSISTED
persistence_sha: N/A
