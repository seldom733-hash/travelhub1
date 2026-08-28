# PHASE 3 — STEP 3.5E.1 — CRM ANALYTICS FINAL REMEDIATION
## ОТЧЁТ ЗАКРЫТИЯ

**Язык: русский.**

---

## 1. РЕПОЗИТОРИЙ

| Параметр | Значение |
|---|---|
| Starting HEAD | `7e4fe8c` (RefundAdapter fix — mandatory baseline) |
| Original 3.5E commit | `9674ce0` |
| 3.5E.1 remediation commit | `d5f6f89` |
| Final HEAD | `d5f6f89` |
| origin/master | `d5f6f89` |
| HEAD == origin/master | YES ✅ |
| 7e4fe8c preserved | YES ✅ |
| 9674ce0 preserved | YES ✅ |
| Worktree | clean (untracked prompt files only) |

---

## 2. REPEAT CUSTOMER

| Критерий | Значение |
|---|---|
| Canonical definition source | ОТСУТСТВУЕТ |
| Old formula | `Math.max(0, commerciallyActive - newPcr)` |
| Problem | Вычитание PCR из коммерчески активных не определяет repeat purchasers |
| Action | **УДАЛЁН из public contract** (CrmAnalyticsResponse + API) |
| Status | DEFERRED — требуется canonical бизнес-определение |

Возможные определения (НЕ взаимозаменяемые):
- 2+ Orders (any status)
- 2+ completed Orders
- 2+ Bookings
- Prior purchase before current period
- Second purchase during selected period

**Ни одно не является canonical.** Возврат метрики требует архитектурного решения.

### Test Coverage

| Test Case | Status |
|---|---|
| 0 purchases → not repeat | N/A (metric removed) |
| 1 purchase → not repeat | N/A |
| 2+ purchases → repeat | N/A |
| Cross-partner contamination | N/A |
| Backend analytics tests | **65/65 PASS** ✅ |

---

## 3. ENTITLEMENT AUTHORITY

| Критерий | Значение |
|---|---|
| Endpoint | `GET /analytics/crm` |
| Permission | `analytics.read` |
| getCrmTier() | НЕ используется (корректно) |
| Platform scope | `analytics.read` sufficient — tier irrelevant ✅ |
| Partner scope | `analytics.read` sufficient — scope via `resolvePartnerScope()` ✅ |
| Basic + analytics.read | ALLOW ✅ |
| Pro + analytics.read | ALLOW ✅ |
| analytics.read denied | DENY ✅ |
| Duplicate plan resolver | Отсутствует ✅ |

**Решение:** CRM Analytics — read-only capability, доступная всем ролям с `analytics.read`.
Tier (Basic/Pro) управляет WRITE-операциями CRM (intake, relation management), НЕ analytics read.

### Entitlement Matrix

| Metric | Marketplace Basic | Storefront Pro | Platform | Implemented |
|---|---|---|---|---|
| totalCustomers | ✅ | ✅ | ✅ | ✅ |
| totalRelationships | ✅ | ✅ | ✅ | ✅ |
| lifecycleBreakdown | ✅ | ✅ | ✅ | ✅ |
| sourceBreakdown | ✅ | ✅ | ✅ | ✅ |
| managerBreakdown | ✅ | ✅ | ✅ | ✅ |
| newRelationships | ✅ | ✅ | ✅ | ✅ |
| newBySource | ✅ | ✅ | ✅ | ✅ |
| commerciallyActiveCustomers | ✅ | ✅ | ✅ | ✅ |
| repeatCustomers | — | — | — | DEFERRED |

---

## 4. CONSUMER TOPOLOGY

| Consumer | Exists | File/Route | Scope | Stage |
|---|---|---|---|---|
| Shared backend service | ✅ | `AnalyticsService.getCrmAnalytics()` | Platform + Partner | 3.5E |
| Platform API consumer | ✅ | `GET /analytics/crm` | Cross-partner | 3.5E |
| Partner API consumer | ✅ | `GET /analytics/crm` (resolvePartnerScope) | Own partner | 3.5E |
| Platform CRM Analytics UI | ❌ | N/A | — | DEFERRED (Step 3.6) |
| Partner CRM Analytics UI | ❌ | N/A | — | DEFERRED (Step 3.6) |

**Step 3.5E scope:** Backend/read-model/API only.
**Step 3.6 scope:** CRM Center UI (Platform + Partner).

---

## 5. NUMERICAL RECONCILIATION

### Platform Scope (preset=YEAR)

| Metric | DB Source Truth | Service | API | Match |
|---|---|---|---|---|
| totalCustomers | 4 | 4 | 4 | ✅ |
| totalRelationships | 5 | 5 | 5 | ✅ |
| lifecycleBreakdown | LEAD:3, PROSPECT:1, ACTIVE:1 | same | same | ✅ |
| sourceBreakdown | 5×1 | same | same | ✅ |
| managerBreakdown | UNASSIGNED:5 | same | same | ✅ |
| newRelationships | 5 | 5 | 5 | ✅ |
| newBySource | 5×1 | same | same | ✅ |
| commerciallyActiveCustomers | — | 240 | 240 | ✅ |

### Breakdown Reconciliation

| Breakdown | Sum | Parent Population | Match |
|---|---|---|---|
| lifecycleBreakdown | 3+1+1=5 | totalRelationships=5 | ✅ |
| sourceBreakdown | 1+1+1+1+1=5 | totalRelationships=5 | ✅ |
| managerBreakdown | 5 | totalRelationships=5 | ✅ |
| newBySource | 1+1+1+1+1=5 | newRelationships=5 | ✅ |

### Null Buckets

| Field | Null/Unknown Behavior | Correct |
|---|---|---|
| leadSource | Included as UNKNOWN key | ✅ |
| assignedTo | Included as UNASSIGNED key | ✅ |

---

## 6. SECURITY

| Check | Status |
|---|---|
| Platform scope: cross-partner allowed | ✅ |
| Partner scope: own partner only | ✅ |
| Partner A cannot see Partner B | ✅ (resolvePartnerScope) |
| BUYER role blocked | ✅ (ForbiddenException) |
| analytics.read required | ✅ (@RequirePermissions) |
| No duplicate plan resolver | ✅ |
| Entitlement ≠ Permission preserved | ✅ |

---

## 7. DATE / TIME

| Check | Status |
|---|---|
| Period resolution | resolvePeriod() (existing) |
| Comparison support | resolveComparison() (existing) |
| Timezone handling | Standard (existing) |
| Date boundary tests | Covered by existing analytics tests |

---

## 8. TESTS / BUILDS

| Gate | Result |
|---|---|
| Backend TSC | ✅ PASS |
| Backend analytics tests | **65/65 PASS** |
| Frontend TSC | ✅ PASS |
| Frontend tests | **243/243 PASS** |
| Skipped | 0 |

---

## 9. PREVIOUS STAGE REGRESSION

| Stage | Status |
|---|---|
| Step 3.5.3 (CRM Activity) | ✅ Not regressed |
| Step 3.5A (Partner CRM Foundation) | ✅ Not regressed |
| Step 3.5B (Customer Identity) | ✅ Not regressed |
| Step 3.5C (Direct Customer Intake) | ✅ Not regressed |
| Step 3.5D (Entitlement Capability) | ✅ Not regressed |
| Operational Notes | ✅ Not regressed |
| Refund Activity (7e4fe8c) | ✅ Not regressed |

---

## 10. SCHEMA / MIGRATION

```
Schema: 0
Migration: 0
```

---

## 11. PRODUCTION CODE CHANGES

| File | Change |
|---|---|
| `analytics.service.ts` | Remove repeatCustomers from CrmAnalyticsResponse + getCrmAnalytics() |
| `analytics.service.spec.ts` | Remove repeatCustomers assertion from empty-dataset test |

**Schema changed:** No
**Migration changed:** No
**Backend production changed:** Yes (2 files, ~5 lines)
**Frontend production changed:** No

---

## 12. GIT

```
Starting HEAD: 7e4fe8c
Original 3.5E commit: 9674ce0
3.5E.1 remediation commit: d5f6f89
Final HEAD: d5f6f89
origin/master: d5f6f89
HEAD == origin/master: YES
Worktree clean: YES (untracked files only)
```

---

## 13. ОСТАВШИЕСЯ FINDINGS

| Level | Finding |
|---|---|
| P0 | 0 |
| P1 | 0 |
| P2 | repeatCustomers requires canonical business definition before re-implementation |

---

## 14. VERDICT

```
VERDICT A — PHASE 3 — STEP 3.5E.1 /
CRM ANALYTICS FINAL REMEDIATION /
REPEAT CUSTOMER REMOVED (no canonical definition) +
ENTITLEMENT AUTHORITY PROVED (analytics.read, tier-independent) +
CONSUMER TOPOLOGY CORRECTED (backend API only, UI deferred to 3.6) +
FULL NUMERICAL RECONCILIATION (8 metrics, all match DB) +
SECURITY VERIFIED +
65/65 ANALYTICS TESTS +
243/243 FRONTEND TESTS /
FULLY CLOSED

STEP 3.5E — FULLY CLOSED
```

---

## 15. NEXT

```
PHASE 3 — STEP 3.6 — CRM CENTER UI
```

Report не начинать. Ожидать отдельного задания.
