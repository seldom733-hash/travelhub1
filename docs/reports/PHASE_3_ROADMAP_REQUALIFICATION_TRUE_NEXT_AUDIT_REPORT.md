# PHASE 3 — ROADMAP RE-QUALIFICATION / TRUE NEXT AUDIT — REPORT

## 1. Executive Summary

После `UI-C2 — ACCEPTED` проведён read-only audit всех канонических roadmap-источников
(архитектура, дизайн-контракт Commerce Center, Debt Register, accepted stage reports).

**TRUE NEXT = `UI-C4 — Audit History Unification`**

обоснован approved Commerce Center UI roadmap и Debt Register (`UI-05 → UI-C4`):
Request detail не имеет секции аудита/«Истории изменений» (Order и Booking имеют), и этот
gap указан в принятом дизайн-контракте как UI-C4. Депенденции удовлетворены, scope не
реализован, не superseded.

`UI-C3 (Business Timeline extraction)` — уже реализован/поглощён UI-C1.1 R2
(общий `<EntityTimeline/>` на всех трёх detail pages), поэтому НЕ является TRUE NEXT
(критерий C — scope уже закрыт). `D8` и `Finance Center` остаются `NOT STARTED`/`DEFERRED`,
но не являются непосредственным продолжением активного C-трека.

Вердикт: **VERDICT A — TRUE NEXT PROVEN (UI-C4)**.

## 2. Audit Baseline

```bash
git rev-parse HEAD          → 586ffe739855b4e29514126abfe5e95e74b398a3
git rev-parse origin/master → 586ffe739855b4e29514126abfe5e95e74b398a3
git status --porcelain=v1   → только untracked audit prompt (docs/prompts/…_TRUE_NEXT_AUDIT_PROMPT.md)
git diff --check            → PASS
WORKTREE                    → CLEAN (кроме untracked prompt)
```

## 3. Canonical Roadmap Sources

| Path | Статус | Authority | Суперсид |
|---|---|---|---|
| `docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md` | Reconciliation (D0-era) | High (архитектура) | D-последовательность историческая; C-трек поверх |
| `docs/architecture/COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md` | Canonical contract | High | определяет D8 = Global Temporal Visibility, `Partial` |
| `docs/reports/PHASE_3_COMMERCE_CENTER_UI_CONSISTENCY_DESIGN_ARCHITECTURE_RECONCILIATION_REPORT.md` | **VERDICT A — design contract ACCEPTED** | **Highest для C-трека** | определяет UI-C1..C10 roadmap |
| `docs/TRAVELHUB_DEBT_REGISTER.md` (2026-09-04) | Canonical debt register | High | маппит debt → UI-C stage (UI-05 → UI-C4 и т.д.) |
| Accepted stage reports (C1.1 R2, UI-C2) | Accepted | High | подтверждают реализованный scope |

## 4. Accepted Stage Chain

```text
D5 → D6 (parallel) → D7 → UI-C1 → UI-C1.1 → UI-C1.2 → UI-C1.2A…F →
UI-C1.2F.1 → UI-C1.2G → UI-C1.2H → UI-C1.2H.1 → UI-C1.2H.2 → UI-C2
```

| Stage | Verdict | Final SHA (пример) | TRUE NEXT, заявленный в отчёте |
|---|---|---|---|
| D7 | ACCEPTED | … | D8 — NOT STARTED |
| UI-C1.2G | ACCEPTED | … | UI-C1.2H |
| UI-C1.2H.2 | ACCEPTED | … | UI-C2 |
| UI-C2 | ACCEPTED | 586ffe7 (HEAD) | UI-C3+ — по утверждённому roadmap |

## 5. Current Project State

Реализовано: Command/Operations Center (Requests/Orders/Bookings/Payments реестры + Header
Period + KPI), Commerce Center UI (C1/C1.1/C1.2 + G/H), Help Center (C1.2H.1/H.2), Commerce
Relation Chain (UI-C2). Detail pages (Request/Order/Booking) разделяют `EntityDetailShell`,
`EntitySectionCard`, `EntityField`, `EntityTimeline`, `EntityLink`, `StatusBadge`.

NOT STARTED: D8 (Global Temporal Visibility), Finance Center, Sales/Analytics/CRM/Marketing/
Marketplace центры (UI-треки), UI-C4/C5+.

## 6. Candidate Matrix

| Candidate | Source | Status | Dependencies | Dependency state | Ready? | Reason |
|---|---|---|---|---|---|---|
| **UI-C3** (Business Timeline) | design roadmap + debt UI-04 | scope реализован (EntityTimeline, C1.1 R2) | C1/C2 | OK | **NO** | уже реализован/поглощён (критерий C) |
| **UI-C4** (Audit History unification) | design roadmap + debt UI-05 | NOT IMPLEMENTED (Request без аудита) | C1..C3 semantics | OK | **YES → TRUE NEXT** | roadmap-approved, gap real, deps satisfied |
| UI-C5 (Notes unification) | design roadmap | NOT IMPLEMENTED (Request без OperationalNotes) | C4 (predecessor) | не выполнен | NO | упорядочение C4 → C5 |
| D8 (Global Temporal Visibility) | canonical arch + lifecycle contract | NOT STARTED | D7 | OK | NO (не immediate) | D-трек deferred в пользу C-трека; «Partial» |
| Finance Center | debt FIN-01 | NOT STARTED (Payments=CURRENT capability) | canonical financial authority | блокировано/deferred | NO | FIN-01 DEFERRED; Payments ≠ Finance Center |
| UI-C7/10/11/12/13, SEC-UI-01 | debt register | OPEN | поздние | — | NO | будущие этапы / debt-owned |

## 7. Dependency Graph

```text
D5 ─┐
D6 ─┴→ D7 → [UI-C1 → UI-C1.1 → UI-C1.2 → …G/H/H.1/H.2 → UI-C2]
                                          ↓ (semantics: shell/section/timeline/chain)
                                       UI-C3 (done) → UI-C4 (TRUE NEXT) → UI-C5 → …
```

UI-C4 зависит от уже принятых C1..C3 представлений (shell, section card, timeline, chain,
status grammar) — все закрыты.

## 8. D8 Analysis

- Title: **Global Temporal Visibility** (`COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md` L798/L828).
- Purpose: temporal invariants/visibility по §21 lifecycle-контракта; сейчас `Partial`.
- Dependencies: D7 ACCEPTED (satisfied).
- Отношение к UI-C2: независимая ось (D-трек vs C-трек); UI-C2 — presentation.
- Status: NOT STARTED; в активном roadmap с момента D7 идёт C-трек, D8 не является его
  непосредственным продолжением.
- Readiness: архитектура temporal-контрактов существует (order/booking/finance-temporal-contract,
  temporal-readiness, analytics time-actor), но «Global temporal visibility | Partial».

**Вывод:** D8 — approved, но не immediate TRUE NEXT по активному C-треку.

## 9. Finance Analysis

- Canonical state: **Finance Center = NOT STARTED; Payments = CURRENT capability; Payments ≠ Finance Center**.
- Roadmap position: `FIN-01 — Full Finance Center` → `DEFERRED — future phase` (debt register);
  FIN-02/03 (provider/webhook, payout) → DEFERRED.
- Dependencies/authority: финансовый домен частично заложен (finance-domain-foundation, ledger,
  commission, settlement/payout docs), но canonical business authority для комиссий/расчётов/
  выплат не закрыта; D7-финансы (payments/refunds) — только capability, не центр.
- Не начинать Finance; Payments не считать Finance Center.

## 10. UI-C3 / Future UI Analysis

- UI-C3 = Business Timeline extraction — **реализован**: `<EntityTimeline/>` создан и сделан
  locale-aware в `UI-C1.1 R2` (`frontend/components/commerce/EntityTimeline.tsx`), и используется
  всеми тремя detail pages (Request: backend milestone events; Order: created→…→closed; Booking:
  created→…→completed). «Timeline vs Audit» разделение сохранено (C1.1 R2 §14). → не кандидат.
- UI-C4 = Audit History unification — открыт (см. §6).
- UI-C5 = Notes unification — открыт, но следует после C4; Request не имеет `<OperationalNotes/>`.
- UI-C10…C13, SEC-UI-01 (→UI-C7) — будущие этапы по roadmap/debt.

## 11. Debt Register Impact

Классификация релевантных позиций:

| Debt ID | Title | Planned closure stage | Влияние на TRUE NEXT |
|---|---|---|---|
| UI-04 | Unified Business Timeline | UI-C3 | закрыто (C3 реализован) |
| UI-05 | Unified Audit History | **UI-C4** | **подтверждает UI-C4** |
| UI-06 | Commerce Relation Chain | UI-C2 | закрыто |
| SEC-UI-01 | Request actions server-authority (P1) | UI-C7 | не блокирует C4 (отдельный stage) |
| FIN-01/02/03 | Finance Center / provider / payout | DEFERRED | блокирует Finance, не C4 |
| HELP-* | Help items | UI-C12 / C3 | не блокирует C4 |
| DATA-01 | KPI read-model | UI-C10/11 | не блокирует C4 |

PROD-01: не влияет на UI-C4 (presentation-этап; PROD-01 остаётся OPEN, в Debt Register не
найден как блокер C4).

## 12. Architecture Dependencies

```text
Commerce UI (Requests/Orders/Bookings)  ← UI-C4 scope
      ↓ использует
EntityDetailShell / EntitySectionCard / EntityTimeline / StatusBadge / i18n / RBAC(backend)
Order history + Booking change-history + D7 financial-history contracts (существуют)
Request detail — НЕТ аудита (gap)
```

UI-C4 не требует backend/domain/schema/RBAC изменений (audit — presentation-консолидация,
данные уже доступны).

## 13. Roadmap Conflicts

| Conflict | Sources | Authority | Resolution |
|---|---|---|---|
| D-последовательность (D7→D8) vs C-трек (C1..C10) | canonical arch (D) vs design contract (C) | design contract = активный C-трек | C-трек актуален; D8 deferred |
| Нумерация debt (UI-05→C4, HELP-03→C3) vs факт (Help реализован в C1.2H) | debt register vs stage reports | stage reports (accepted) | debt mapping частично устарел; C4 подтверждён обоими |

Precedence: принятые stage reports + дизайн-контракт имеют высший authority; противоречий по
UI-C4 нет.

## 14. TRUE NEXT Determination

**TRUE NEXT = `UI-C4 — Audit History Unification`**

Основание (все критерии §6 промпта):
- A. Roadmap authority: дизайн-контракт (UI-C4) + Debt Register (`UI-05 → UI-C4`).
- B. Dependency satisfied: UI-C1…UI-C3 semantics приняты/реализованы.
- C. Scope не реализован: Request detail не имеет секции аудита/«Истории изменений».
- D. Не superseded: нет более поздней отмены.
- E. Блокеров нет.
- F. Coherence: presentation-консолидация трёх detail pages, продолжает C-трек
  (аналогично EntityTimeline-унификации в C1.1 R2).

## 15. Why Other Candidates Are Not TRUE NEXT

| Candidate | Why not TRUE NEXT | Evidence |
|---|---|---|
| UI-C3 (Business Timeline) | scope уже реализован (общий EntityTimeline на 3 pages) | C1.1 R2 §14/§changed-files; grep EntityTimeline в 3 page.tsx |
| UI-C5 (Notes unification) | predecessor C4 не выполнен (упорядочение C4→C5) | design roadmap C4 перед C5 |
| D8 (Global Temporal Visibility) | D-трек deferred в пользу активного C-трека; «Partial» | lifecycle contract L798; TRUE NEXT отчётов → C-трек |
| Finance Center | FIN-01 DEFERRED; Payments ≠ Finance Center | debt register FIN-01 |

## 16. Blockers

- Для UI-C4: **нет**. (Существующий Vitest-failure `i18n formatPrice NBSP` — известный
  pre-existing, не связан с UI-C4.)
- Отложенные: Finance (FIN-01 deferred), D8 (Partial), SEC-UI-01 (P1 → UI-C7).

## 17. Recommended Next Stage Prompt Scope (UI-C4)

После approval UI-C4 prompt должен покрыть:

1. Unified Audit/«История изменений» для Request/Order/Booking (общий компонент/грамматика,
   по аналогии с EntityTimeline).
2. **Request detail: добавить секцию аудита** (server-authoritative `…/requests/:id/history`,
   если endpoint существует; иначе — фиксировать backend gap, не выдумывать).
3. НЕ сливать Audit с Timeline (сохранить C1.1 R2 §14 separation) и НЕ трогать D7
   «Финансовая история» Order.
4. i18n RU/AZ/EN; a11y; deep-link; responsive.
5. Регрессия D5/D6/D7/UI-C1.2G/H/H.2/UI-C2.
6. `AUDIT FIRST → APPROVAL → IMPLEMENTATION → QUALIFICATION → GIT CLOSURE`.

> Prompt НЕ создаётся автоматически — только после явного approval пользователя.

## 18. Git Evidence

```text
BASELINE:      586ffe739855b4e29514126abfe5e95e74b398a3
HEAD:          586ffe739855b4e29514126abfe5e95e74b398a3
origin/master: 586ffe739855b4e29514126abfe5e95e74b398a3
WORKTREE:      CLEAN (только untracked audit prompt + этот отчёт)
Изменения:     NO production code / tests / schema / API / UI / commits (этот audit)
```

## 19. Final Audit Verdict

```text
VERDICT A — TRUE NEXT PROVEN

TRUE NEXT:
UI-C4 — Audit History Unification

(UI-C3 Business Timeline — уже реализован/поглощён UI-C1.1 R2)
(D8 — NOT STARTED; Finance Center — NOT STARTED / DEFERRED)

STOP — ждём approval пользователя; следующий stage НЕ начинать в этом run.
```