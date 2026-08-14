# PHASE 2 — FINANCE COMMISSION POLICY UI — ROADMAP RECONCILIATION REPORT

## 1. Verdict

`FINANCE COMMISSION POLICY UI ROADMAP RECONCILIATION COMPLETED — MISSING UI STEP ADDED`

Repository-first реконсиляция (0 production-кода). Будущий экран ручного
управления Commission Policy **не был гарантирован** ни одним Roadmap-шагом
(Phase 3 содержит Analytics/CRM/Marketing/Support/Users/Documents/Calendar/
Reports/Integrations/AI Center UI, но НЕ Finance Center UI; Screen Design §7
перечисляет «Commissions» в навигации Finance Center, но без контракта экрана).
**Добавлен** `PHASE 2 — STEP 2.14F — COMMISSION POLICY MANAGEMENT UI` в Roadmap v3
+ контракт экрана в Screen Design Brief. Канонический owner подтверждён
единственным (Finance; 0 конфликтов Catalog/Settings/PSP). Stop-conditions §29 —
все отрицательны.

## 2. Sources inspected

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (Phase 2 Finance
  блок, Phase 3 Center UI шаги, dependency edges, 2.14 BLOCKED metadata)
- `docs/prompts/TravelHub_Screen_Design_Brief_Baseline_1.6_PAYMENTS_FINAL.md`
  (§7 Finance Center, «Finance Marketplace Settlement UI — Baseline 1.6»)
- `docs/adr/ADR-0013-commission-policy-contract.md` (canonical Commission Policy contract)
- `docs/architecture/commission-policy-foundation.md`, имплементационный отчёт 2.14E,
  strict review отчёт 2.14E
- `docs/prompts/PHASE_2_COMMISSION_DEPENDENCY_RECONCILIATION_2.12C_2.12E_2.14E_REPORT.md`
- `docs/architecture/phase2-entry-audit.md`, `docs/architecture/finance-domain-foundation.md`
- `docs/contracts/api.md` (commission-policies endpoints), `docs/contracts/ids.md` (CMP-)
- `backend/src/security/permissions.constants.ts` (фактический ROLE_PERMISSIONS)
- `backend/src/modules/finance/finance.controller.ts` (фактические endpoints 2.14E)
- `frontend/app/app/layout.tsx`, `frontend/components/Shell.tsx`, `frontend/app/app/*` (routes)
- Legacy: `PHASE_1_STEP_1.12.1_CLARIFICATION_STOREFRONT_COMMERCIAL_MODEL.md`,
  `TRAVELHUB_DEFERRED_DECISIONS_MAP.md` (DD-012), `PHASE_1_STEP_1.12.1_REVIEW_FIXES.md`

## 3. Current Finance Center UI coverage

- **Frontend (факт):** внутренние employee Work Centers живут под `/app/*`; Shell
  навигация содержит только: Рабочий стол, Catalog Center, Order Center, Booking
  Center, CRM mini, Partner onboarding, Seller profiles, Пользователи.
  **Finance Center отсутствует полностью** (нет `/app/finance`, нет пункта
  навигации, 0 finance/commission компонентов).
- **Screen Design Brief §7:** Finance Center navigation перечисляет Payments,
  Refunds, Invoices, Commissions, Currency, Exchange Rates, Tax/Tax Rules,
  Exceptions; «Finance Marketplace Settlement UI» добавляет Provider Fees,
  Settlements, Payouts, Commission Accruals, Reconciliation/Exceptions.
  «Commissions» — только пункт навигации; контракт экрана Commission Policies
  отсутствует (до этого прохода).

## 4. Current Commission Policy backend capability (2.14E, approved)

- `finance.CommissionPolicy` (CMP-*): channel (V1 MARKETPLACE), rateType
  PERCENTAGE, rate DECIMAL(18,6) десятичная доля 0<r<1 (каноническая форма
  `/^0\.(?!0+$)\d{1,6}$/`), lifecycle DRAFT → ACTIVE → ARCHIVED, version,
  effectiveFrom/effectiveTo [from,to) + open-ended, overlap-инвариант (409),
  resolver fail-closed; `CommissionPolicyHistory` (полный state на версию).
- API: `GET /commission-policies`, `GET /commission-policies/:code`,
  `GET /commission-policies/resolve`, `POST /commission-policies`,
  `PATCH /commission-policies/:code`, `POST /:code/activate`, `POST /:code/archive`.
- RBAC: read `finance.commission.read` (FINANCE/DIRECTOR/ANALYST);
  manage `finance.commission.manage` (FINANCE/ADMIN).
- **API-гэп (prerequisite 2.14F):** read endpoint версионной истории
  `GET /commission-policies/:code/history` **отсутствует** (history пишется, но
  не читается через API; прецедент — `/service-units/:id/history`,
  `/tariffs/:id/history`). Задокументирован как prerequisite, НЕ реализован
  в этом проходе (§21 промпта).

## 5. Current roadmap coverage

- **Phase 2 Finance блок:** 2.10–2.14E (backend). Шаги 2.14A–D — NOT STARTED;
  2.14 — ⛔ BLOCKED; 2.12C/2.12E — NOT STARTED. **UI-шага нет.**
- **Phase 3 Center UIs:** Dashboard (3.2), Analytics (3.4), CRM (3.6), Marketing
  (3.9), Support (3.11), Users & Access (3.13), Documents (3.16), Calendar (3.18),
  Reports (3.20), Integrations (3.23), AI (3.26), Partner Finance Dashboard
  (3.29G — partner-facing, не internal). **Finance Center UI (internal) — отсутствует.**
- Вердикт §16: **C. NOT COVERED** — ни один шаг не гарантирует Commission Policy
  management UI. → добавлен Step 2.14F.

## 6. Current Screen Design coverage

§7 Finance Center — навигация с «Commissions»; «Finance Marketplace Settlement
UI» — Settlement/Commission Accruals концепты. Контракта экрана Commission
Policies (list/create/edit/activate/archive/history/rate-репрезентация/RBAC)
не было. → добавлен раздел «Commission Policies — Finance Center (Step 2.14F)».

## 7. Current frontend implementation state

0 production UI: нет `/app/finance`, нет Finance Center в Shell, 0 commission
компонентов/страниц/тестов. Frontend 135/135 — без Finance-покрытия.

## 8. Canonical UI owner

**Finance Center → Commissions → Commission Policies** (единственный канонический
owner). Доказательства: ADR-0013 D1 (Finance-owned), 2.14E реализация (единственный
backend authority), phase2-entry-audit (Commission → Finance), Screen Design §7
(Commissions в Finance Center). Другие домены — read-only reference при
необходимости, НЕ policy authority. 0 противоречий → ARCHITECTURE DECISION
REQUIRED не требуется.

## 9. Finance navigation target

`Finance Center` содержит (по §6, с учётом canonical backend): Overview (когда
будут canonical read-данные), Payments (2.12), Refunds (2.13), Disputes (2.13A),
Invoices (2.14 — backend BLOCKED), **Commissions (2.14F Policies; Facts/Accruals
gated)**, Settlements (2.10B foundation), Payouts (2.10B foundation), Ledger
(2.10A), Finance master data / reference data (Currency/Exchange Rates/Tax/Tax
Rules — не в Settings, Screen Design §7). Экран «включается» только при
canonical backend; НЕ форсировать нереализованные домены.

## 10. Commission Policies screen contract (2.14F)

См. Screen Design Brief (новый раздел) + Roadmap 2.14F. List: CMP-*/channel/
rateType/rate (15%)/status/effectiveFrom/effectiveTo/version/createdAt +
current/effective indicator (если безопасно выводим). Фильтры: status/channel
(backend vocabulary). Pagination: фактическая backend (page/pageSize ≤ 100).

## 11. Manual create/edit contract

Create → DRAFT: channel MARKETPLACE (V1), rate-ввод «15» ↔ API «0.15»
(display-конверсия ТОЛЬКО), effectiveFrom/effectiveTo (open-ended). Edit —
DRAFT only. Frontend НЕ второй authority; 0 JS float как финансовый authority.

## 12. Lifecycle actions (по фактическому backend)

| Status | Allowed UI actions |
|---|---|
| DRAFT | Edit, Activate, Archive |
| ACTIVE | Archive (Edit — НЕ показывать: backend 422) |
| ARCHIVED | — (терминальный, View history) |
Repeated activate/archive — idempotent no-op (200); UI показывает состояние.
Overlap → контролируемое сообщение 409 (не «первая строка»).

## 13. Version/history UX

Detail page/drawer + read-only version history из backend-owned
`CommissionPolicyHistory` (version/action/fields-снапшот/actor/timestamp).
НЕ реконструкция на клиенте; редактирование исторических версий запрещено.
**Prerequisite:** backend read endpoint `GET /commission-policies/:code/history`
(гэп 2.14E, документирован; прецеденты других entities).

## 14. RBAC mapping (фактический ROLE_PERMISSIONS)

| Роль | read (finance.commission.read) | manage (finance.commission.manage) |
|---|---|---|
| FINANCE | ✓ | ✓ |
| ADMIN | ✓ (ALL_PERMISSIONS) | ✓ |
| DIRECTOR | ✓ | — |
| ANALYST | ✓ | — |
| SALES_MANAGER | — | — |
| OPERATOR | — | — |
| PARTNER | — | — |
UI скрытие меню ≠ security; backend 403 авторитетен. (Подтверждено 2.14E strict review.)

## 15. API/UI action mapping

| UI action | API | Permission | Allowed state | Result |
|---|---|---|---|---|
| List policies | GET /finance/commission-policies | read | — | 200 items |
| View policy | GET /finance/commission-policies/:code | read | — | 200 detail |
| Resolve current | GET /finance/commission-policies/resolve | read | — | found/no-policy/no-commission/ambiguous |
| Create draft | POST /finance/commission-policies | manage | — | 201 DRAFT v1 |
| Edit draft | PATCH /finance/commission-policies/:code | manage | DRAFT | 200 version+1 |
| Activate | POST /finance/commission-policies/:code/activate | manage | DRAFT | 201 ACTIVE (overlap → 409) |
| Archive | POST /finance/commission-policies/:code/archive | manage | DRAFT\|ACTIVE | 201 ARCHIVED |
| View history | **GET /finance/commission-policies/:code/history — ГЭП** | read | — | prerequisite 2.14F |
0 выдуманных endpoints; гэп задокументирован.

## 16. Rate representation contract

`15% UI ↔ "0.15" API`. Stored/API authoritative: десятичная дробь-строка
0<r<1, ≤6 знаков, каноническая форма (regex-authority 2.14E strict review fix).
Frontend: ввод «15» → конверсия в «0.15»; НЕ принимать «1500%», «10» как
дробь, unsupported precision, scientific notation, whitespace. Без silent
rounding сверх backend-контракта.

## 17. Effective-period UX

effectiveFrom/effectiveTo [from,to) half-open; open-ended (null) — «без срока»;
future policy — видима, НЕ current; currently effective — indicator; archived —
терминальный. Overlap → UI не «разрешает» сам (не молча модифицирует другую
policy) — только controlled backend-ошибка 409.

## 18. Catalog legacy commission conflict

Аудит legacy: **0 модели agency/manager/partner/supplier commission в текущем
репозитории** (поиск по docs/prompts + docs/architecture + schema: только
TaxRule/ExchangeRate, НЕ commission). Классификация по §12:
- DD-012 «Marketplace Commission Rules» — DEFERRED (ставки/fixed/percentage/
  tiers/base открыты; «не хардкодить commission rate») → **superseded по ставкам
  ADR-0013/2.14E** (канал = matching key; ставка = master data).
- 1.12.1 Clarification: «Коммерческая модель НЕ хранится в Product»; «Marketplace →
  MARKETPLACE_COMMISSION; Storefront → STOREFRONT_SUBSCRIPTION» → концепт Catalog
  **не является commission authority** (категория 3: Catalog commercial input,
  НЕ TravelHub Commission authority).
- Agency/manager/partner/supplier commission с fixed/percentage/combined — в
  репозитории **отсутствуют** (категория 5: obsolete/не-материализованный legacy
  дизайн; если появится в будущем — отдельная ADR).
Hard gate: **не существует двух mutable authorities для одной TravelHub
commission rate** — единственный authority Finance (ADR-0013/2.14E) ✓.
Catalog display (если понадобится) — read-only/reference.

## 19. Settings boundary

Screen Design §7: «Currency/Tax не размещать как master CRUD в Settings».
Finance master data (Commission Policy) НЕ дублируется в Settings;
`Settings → Commission Rate` запрещён (категорически). Будущий Settings-шорткат —
только route на Finance-owned screen/API.

## 20. Policy vs Commission fact separation

Commission Policy (mutable master data, freeze boundary) ≠ Frozen Commission
Snapshot (future, Quote ISSUE freeze) ≠ Commission (immutable факт, future
runtime 2.12C/2.14) ≠ CommissionAccrual (PARTNER_COLLECT receivable, future
2.12E). Изменение policy 15% → 18% НЕ переписывает исторические
Orders/Payments/Commission/Accruals. UI не должен намекать на обратное.

## 21. Commission Facts future screen

`Commissions → Commission Facts` — только при canonical backend runtime
(2.12C/2.14). Зарезервирован в навигации (tab disabled/placeholder); НЕ
маркируется реализованным. Prerequisite edge: 2.12C/2.14 backend → Facts UI.

## 22. CommissionAccrual future screen

`Commissions → Accruals` — только при 2.12E backend runtime (PARTNER_COLLECT).
Tab disabled/placeholder до тех пор. Prerequisite edge: 2.12E backend → Accruals UI.

## 23. Refund/Dispute boundary

0 ручной мутации исторических Commission сумм из Policy screen. Refund/Dispute
commission adjustments — future canonical adjustment flow (deferred). UI не
изобретает «recalculate old commissions», «apply new rate to existing orders»,
manual overwrite, mutation frozen snapshots. Historical correction — append-only
compensating-fact архитектура (будущие approved шаги).

## 24. Required roadmap changes (внесено)

1. **Step 2.14F — Commission Policy Management UI** добавлен в Phase 2 Finance
   блок (после 2.14E, перед 2.15): полный scope (list/filters/detail/create/
   edit/activate/archive/history/RBAC/conflict states/rate-конверсия/tabs
   Policies|Facts|Accruals), dependency на approved 2.14E API, API-гэп history
   endpoint как prerequisite, Commission Facts/Accruals gated на 2.12C/2.12E,
   Step 2.14 остаётся BLOCKED (2.14F не разблокирует backend).
2. Статусы backend НЕ тронуты: 2.14E ✅ APPROVED, 2.14 ⛔ BLOCKED, 2.12C/2.12E ⏳
   NOT STARTED. Frontend НЕ маркирован реализованным.

## 25. Required Screen Design changes (внесено)

Новый раздел «Commission Policies — Finance Center (Step 2.14F, UI-реконсиляция
2026-08-14)» в Screen Design Brief: навигация/breadcrumbs, tabs, list-колонки,
фильтры, row actions, create/edit контракт (rate 15↔0.15), detail + version
history, rate-репрезентация, RBAC, границы (master data ≠ финансовый override).
Без выдуманных KPI.

## 26. Dependency edges

- 2.14E (approved) → 2.14F (UI) — hard (API).
- 2.14F → backend history read endpoint `GET /commission-policies/:code/history`
  — prerequisite (гэп).
- 2.14F НЕ зависит от 2.12C/2.12E.
- Commission Facts UI → 2.12C/2.14 backend runtime.
- CommissionAccruals UI → 2.12E backend runtime.
- 2.14 (backend) остаётся BLOCKED — UI не разблокирует.

## 27. Negative checks (все PASS)

1. 0 production frontend code changed ✓
2. 0 production backend code changed ✓
3. 0 schema/migration changed ✓
4. 0 hardcoded commission rate added ✓
5. 0 duplicate Settings-owned commission authority ✓
6. 0 duplicate Catalog-owned TravelHub Commission Policy ✓
7. 0 PSP-owned policy logic ✓
8. 0 historical Commission mutation semantics invented ✓
9. 0 Refund/Dispute adjustment semantics invented ✓
10. 0 Commission/CommissionAccrual runtime falsely marked implemented ✓
11. 0 approved backend step reopened ✓
12. 0 UI step falsely marked completed (2.14F = 🚧 PLANNED, НЕ реализован) ✓
(Проверено: `git status`/`git diff --name-only` — только docs.)

## 28. Files changed

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (+Step 2.14F)
- `docs/prompts/TravelHub_Screen_Design_Brief_Baseline_1.6_PAYMENTS_FINAL.md`
  (+Commission Policies screen contract)
- `docs/prompts/PHASE_2_FINANCE_COMMISSION_POLICY_UI_ROADMAP_RECONCILIATION_REPORT.md`
  (этот отчёт)
- (промпт `PHASE_2_FINANCE_COMMISSION_POLICY_UI_ROADMAP_RECONCILIATION.md` — уже в дереве)

## 29. Exact NEXT

`PHASE 2 — STEP 2.14F — COMMISSION POLICY MANAGEMENT UI` (реализация UI по
контракту Screen Design Brief; НЕ начинается в этом проходе — ждёт отдельный
имплементационный промпт). Backend-подготовка 2.14F: read endpoint версионной
истории. Параллельно по dependency graph остаётся `PHASE 2 — STEP 2.12E —
PARTNER_COLLECT / COMMISSION ACCRUAL FOUNDATION` (backend, NEXT после 2.14E).

## 30. Final canonical status line

`PHASE 2 FINANCE COMMISSION POLICY UI ROADMAP RECONCILIATION COMPLETED —
MISSING UI STEP ADDED` — канонический owner: **Finance Center → Commissions →
Commission Policies** (Step 2.14F, PLANNED, НЕ реализован); единственный
policy authority: Finance (ADR-0013/2.14E); 0 second-authority (Catalog/
Settings/PSP); 0 production-кода изменено; Step 2.14 (backend) остаётся
⛔ BLOCKED; Commission Facts/Accruals UI — gated на будущие backend шаги
(2.12C/2.14, 2.12E). NEXT = Step 2.14F (UI) / Step 2.12E (backend) — по
отдельности, после соответствующих имплементационных промптов.
