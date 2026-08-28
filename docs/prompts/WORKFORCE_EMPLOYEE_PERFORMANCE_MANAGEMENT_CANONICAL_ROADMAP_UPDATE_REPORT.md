# WORKFORCE / EMPLOYEE PERFORMANCE MANAGEMENT — CANONICAL ROADMAP ARCHITECTURE UPDATE — REPORT

## 1. REPOSITORY

| Поле | Значение |
|---|---|
| Starting HEAD | `1a3aa23` |
| Final HEAD | (pending commit) |
| origin/master | `1a3aa23` |
| HEAD == origin/master | ✓ |

## 2. CANONICAL ROADMAP

| Поле | Значение |
|---|---|
| Section changed | Phase 3 — new Step 3.50 |
| New stage/entry | Step 3.50 — Workforce / Employee Performance Management |
| Why this location | После Step 3.49C (Partner Tenant Isolation Go-Live Gate) — последний существующий step в Phase 3. Workforce Performance — отдельный analytics/read-model layer, зависящий от Employees, Departments, Orders, Bookings, Payments, Refunds, CRM, Audit/Event model, Analytics, Partner Workspace, Storefront Pro entitlements. Размещён после production readiness steps (3.42–3.49C), т.к. требует operational data foundations. Не вытесняет Step 3.5A (Partner CRM Foundation) — текущий canonical NEXT. |
| Dependencies | Employees, Departments, Roles & Permissions, Orders, Bookings, Payments, Refunds, CRM, Audit/Event model, Analytics (Step 3.3), Partner Workspace, Storefront Pro entitlements |
| Existing stages renumbered | 0 — ни один существующий step не перенумерован |
| Current NEXT | `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` (UNCHANGED) |

## 3. PERFORMANCE ARCHITECTURE

| Поле | Значение |
|---|---|
| Platform scope | TravelHub оценивает собственные подразделения/сотрудников: Booking Operations, Sales/Orders, Finance, CRM/Support, Moderation, Marketing, other internal departments |
| Storefront Pro future scope | Storefront Pro сможет оценивать собственных сотрудников; PLATFORM != PARTNER; Partner A != Partner B; Marketplace Basic != automatic Full Workforce Performance; entitlement и RBAC — разные axes |
| Department model | Workspace → Department → Team (future/optional) → Employee. KPI и веса зависят от department type. Одна universal formula запрещена. Department Score ≠ average Employee Scores |
| Employee model | Explainable score 0–100; dimensions: Productivity, Quality, SLA/Speed, Business Result, Reliability; formula role/department-specific, weights configurable/versioned |
| Weekly model | Weekly scorecard: Employee | Processed | Success | Avg Time | SLA | Quality | Score | Trend; Department weekly: overall score, volume, SLA, quality, business result, trend vs previous week |
| Monthly model | Monthly scorecard: current month vs previous month; monthly score ≠ simple average of weekly scores — canonical components/weighted aggregates |
| Period comparison | TODAY, CURRENT_WEEK, PREVIOUS_WEEK, CURRENT_MONTH, PREVIOUS_MONTH, CUSTOM_RANGE; boundaries по canonical workspace/business timezone; для каждой KPI: current, previous, absolute delta, percentage delta, trend; не сравнивать периоды разной длительности без нормализации |
| Score dimensions | Productivity, Quality, SLA/Speed, Business Result, Reliability (пример Booking Operator: 25/30/20/15/10%) |
| Formula versioning | Formula identity: BookingOperatorScore/v1, SalesManagerScore/v2; effectiveFrom/effectiveTo; calculation provenance; исторические scores нельзя silent пересчитывать |
| Attribution model | Event/action attribution: ORDER_CREATED → Employee A, ORDER_CONFIRMED → Employee B, etc.; min for Order, Booking, Payment, Refund, CRM/Support, Operational Note, Moderation; performance event links: workspaceId, departmentId, employeeId, role/context, entityType/entityId, eventType/actionType, occurredAt, business value, quality outcome, SLA context, source/audit reference |
| Assignment/action/outcome | ASSIGNMENT — кто получил; ACTION — кто реально сделал; OUTCOME — чем закончился; cancellation нельзя автоматически считать ошибкой подтверждающего |
| Workload | case complexity, workload, shift duration, part/full time, leave/absence, assignment volume, manual vs automatic, team handoff; 100 simple cases ≠ 100 complex cases |
| Fairness/complexity | Anti-gaming: гонка за количеством, искусственное закрытие, отказ от сложных кейсов, переброс, лишние Notes/messages, скорость в ущерб качеству; volume + quality + SLA + business outcome + reliability + complexity |
| Explainability | Score + dimension breakdown + drill-down до конкретных entities (если RBAC позволяет) |
| Data quality | Data completeness, unattributed events, unknown employee, missing department, invalid period, duplicate attribution; различать 0 activity и insufficient/unavailable data |
| Timezone | Weekly/monthly boundaries по canonical workspace/business timezone |
| RBAC/privacy | performance.read.self/team/department/all, performance.manage, performance.configure; server-side authorization, workspace isolation, department/team scope, audit trail, score configuration history, override audit; frontend-hidden ≠ security |
| Command Center integration | High-level Team Performance summary + deep link; разделять Business Analytics vs Workforce Performance Analytics; не дублировать весь Performance Center |
| Analytics integration | Read-model layer интегрируется с Analytics Foundation (Step 3.3) |

## 4. SOURCE AUTHORITY MATRIX (FUTURE REQUIREMENT)

| Domain | Volume | Quality | SLA | Outcome | Employee Attribution |
|---|---|---|---|---|---|
| Orders | required | required | required | required | required |
| Bookings | required | required | required | required | required |
| Payments | required | required | required | required | required |
| Refunds | required | required | required | required | required |
| CRM/Support | required | required | required | where applicable | required |
| Moderation | required | required | required | where applicable | required |

Exact event list — design stage.

## 5. OUT OF SCOPE

DB tables, APIs, score engine, attribution migrations, UI/navigation, permissions/entitlements, scheduled jobs, weekly/monthly workers, exports, notifications, AI scoring, salary/bonus logic, HR disciplinary workflows. AI ≠ authority official employee score — в будущем AI может только объяснять trends/anomalies.

## 6. PRODUCTION CODE

| Поле | Значение |
|---|---|
| Changed | 0 |
| Schema | 0 |
| Migration | 0 |
| Frontend | 0 |
| Backend | 0 |

## 7. FILES CHANGED

| File | Change |
|---|---|
| `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` | Added Step 3.50 — Workforce / Employee Performance Management |

## 8. REPORT

Created: `docs/prompts/WORKFORCE_EMPLOYEE_PERFORMANCE_MANAGEMENT_CANONICAL_ROADMAP_UPDATE_REPORT.md`

## 9. COMMIT

Pending —将在所有变更完成后提交。

## 10. ACCEPTANCE

| Criterion | Status |
|---|---|
| Actual roadmap inspected | ✓ |
| Current NEXT reverified | ✓ — Step 3.5A unchanged |
| Future Workforce Performance added without silent renumbering | ✓ |
| Platform + future Storefront Pro scopes and isolation defined | ✓ |
| Weekly/monthly comparison defined | ✓ |
| Department/employee models defined | ✓ |
| Event/action attribution and assignment/action/outcome separation defined | ✓ |
| Explainable role/department-specific versioned score defined | ✓ |
| Workload/fairness/timezone/data-quality/RBAC/privacy/override requirements recorded | ✓ |
| Command Center/Analytics integration defined | ✓ |
| CrmActivity not turned into Performance datastore | ✓ |
| No implementation/schema/migrations started | ✓ |
| Report created | ✓ |
| Exact NEXT reported | ✓ — Step 3.5A |
| Docs committed/pushed | Pending |
| HEAD==origin | Pending |

---

*Отчёт создан: 2026-08-28*
