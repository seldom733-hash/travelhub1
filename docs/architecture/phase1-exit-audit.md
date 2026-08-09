# PHASE 1 — EXIT AUDIT — ARTIFACT

**Дата:** 2026-08-09 · **Branch:** master @ 53ef183 (+ незакоммиченные review-fixes Step 1.17/Exit) · **Verdict:** READY FOR 1.18A

Этот документ — выходной артефакт Phase 1 Exit Audit (Step 1.18). Полный отчёт —
в переписке; здесь — DoD-матрица, debt register и ссылки на доказательства.

## Phase 1 DoD matrix (фактический)

| Требование | Evidence | Статус |
|---|---|---|
| Один domain-owner на сущность (catalog/crm/order/booking/communication/events) | schema + ADR-0001/0011; cross-schema FK отсутствуют | PASS |
| Домен пишет только в owned schema | аудит прямых write (1.17): все status-записи в domain-сервисах; ADR-0003/0004 — единственные orchestration-исключения | PASS |
| ID: домен-владелец, атомарный счётчик, immutable | `IdsService.nextCode` (BusinessSequence), ids.md синхронизирован (Exit Fix: добавлены SELL/SPP/SF/APP/USR) | PASS |
| Product → Order → Booking E2E, события синхронизируют статусы | phase1.e2e + order-canonical-events.e2e | PASS |
| Order без паспортов туристов не становится READY_FOR_BOOKING | order.service confirm-guard (422) | PASS |
| Повторный BookingRequested не создаёт второй Booking | InboxEvent dedup + consumer guard | PASS |
| BookingConfirmed обновляет Order (агрегат) | order.subscribers (reconcile) | PASS |
| Аудит Product/Customer/Order/Booking (history + события) | *_history таблицы + events + AuditLog | PASS |
| Трассировка correlationId/causationId | ADR-0009, request-context middleware, e2e | PASS |
| RBAC: PARTNER/BUYER без broad internal прав | 1.17 FIX 1 + staff-scope audit + rbac-partner-scope/rbac-catalog-crm e2e | PASS |
| Public DTO без raw internal/CRM/контактов | public-catalog/storefront e2e + runtime probes | PASS |
| Storefront: lifecycle/entitlement/каналы/контакты только в Storefront-контексте | storefront.e2e, Marketplace leakage = 0 | PASS |
| PII: traveler/passenger field-level redaction | pii-redaction.e2e (Exit Fix) | PASS |
| Миграции: clean replay + no drift | migrate status / deploy / diff — No difference | PASS |

## Debt register (консолидированный)

| Debt | Severity | Exploitable now? | Owner / Future step | Phase 2 blocker? |
|---|---|---|---|---|
| Outbox FAILED: нет автоматического retry/recovery (manual DB flip) | HIGH (reliability) | Только при transient consumer failure (bug-time); факт durable, не теряется | Step 2.17 (retry/recovery) | НЕТ (PASS-DEFERRED; рекомендовано до production commercial flow) |
| Communication PII/retention policy (purge/archive) | MEDIUM (privacy) | Нет — доступ только internal staff, no leak | Step 3.45A + DD | НЕТ |
| Marketplace PDP SEO metadata (client-side title/meta) | LOW (SEO) | Нет — backend predicates не раскрывают private state | Step 3.35 | НЕТ |
| `/orders/bootstrap` — temporary endpoint | LOW (contract) | Нет (admin-only, order.import) | Step 2.6 (удаление назначено) | НЕТ |
| ids.md/roadmap статусы — синхронизированы (Exit Fix) | LOW (docs) | Нет | — | НЕТ |
| Dev-BD: остаточные smoke-данные (`Step14 Smoke`, `Strict Smoke`) | LOW (hygiene) | Нет (test data) | Dev cleanup | НЕТ |

## Ключевые решения Exit Audit

- **Outbox retry (§22): PASS-DEFERRED** — durable outbox row, recovery = manual re-publish,
  Step 2.17 назначен; не блокер Phase 1 DoD, но перед reliance на события в commercial
  flow (2.4–2.8) требуется automated retry/repair command.
- **Step 1.18A boundary:** НЕ выполнялся. Вопросы для 1.18A: полнота lifecycle timestamps
  по Product/Moderation/Partner/Buyer/Seller/Storefront; отсутствие невосстановимых
  переходов; достаточность history/events для analytics.
- **Temporal:** legacy NULL остаётся NULL (без фабрикаций); `updatedAt` не используется
  как milestone; lifecycle timestamps реальные.

## Regression (Exit gate)

Backend: tsc 0; unit 230/230; e2e serial 28 suites / 438 passed. Frontend: tsc 0;
vitest 23 files / 135; production build PASS. DB: migrate status up to date (21);
clean replay — all applied; drift — No difference detected. Browser smoke: Marketplace
/search, PDP, RU locale, neutral 404, console 0 errors.
