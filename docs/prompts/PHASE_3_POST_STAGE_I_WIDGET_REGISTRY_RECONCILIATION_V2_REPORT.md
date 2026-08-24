# PHASE 3 — POST-STAGE-I WIDGET REGISTRY RECONCILIATION V2 — ОТЧЁТ

## Язык: русский

---

## EXECUTIVE SUMMARY

Полная сверка Command Center ↔ WIDGET_REGISTRY ↔ Settings после Stage I.

**Production code changed: NO** — verification only. One legacy orphan identified (`qualified-gmv`), documented for future cleanup.

**VERDICT A** — все agreed candidates сохранены/enabled, Stage I widgets согласованы, single source of truth подтверждён.

---

## INTERRUPTED RUN AUDIT

```
HEAD before V2: 59228eb
origin/master: 59228eb
dirty files: 0 (only untracked prompt files)
previous-run changes: 1 untracked report file (from interrupted V1)
KEEP: report content (already on disk)
REWORK: none
DISCARD: none
```

No correct prior work was lost. The previous V1 run completed all verification work but was interrupted before commit. All findings are preserved in this V2 report.

---

## FULL INVENTORIES

### A. Command Center (34 rendered widgets + 1 registry-only)

| Section | Widgets | Count |
|---|---|---|
| Executive | gmv, collected-gmv, outstanding, completed-gmv, revenue, refunds, orders, bookings, aov, conversion | 10 |
| Operational | orders-fulfilled, bookings-confirmed, bookings-completed, payments-captured, refunds-processed, funnel | 6 |
| Financial | commission, reconciliation, payments, net-payments | 4 |
| Marketplace | sessions, storefront-sessions, marketplace-partners, storefront-partners, marketplace-customers, storefront-customers, storefront-mrr, storefront-arr, storefront-collected, storefront-outstanding | 10 |
| Trends | orders-trend, bookings-trend, revenue-trend (unsupported) | 3 |
| **Total rendered** | | **33 + 1 unsupported** |

### B. WIDGET_REGISTRY (34 command-center entries)

All 34 entries have: widgetId, pageIds=["command-center"], sectionPermission, permission="analytics.read".

### C. Settings

Settings uses `getAvailableWidgets()` → `WIDGET_REGISTRY` filtered by RBAC.
Settings inventory = WIDGET_REGISTRY entries filtered by permissions.
**Same source** — no separate hardcoded list.

---

## SETTINGS-ONLY USEFULNESS/AUTHORITY REVIEW

### All agreed candidates — ALREADY IN COMMAND CENTER

| Candidate | Registry | WIDGET_MAP | Section | Authority | Status |
|---|---|---|---|---|---|
| Sessions | ✅ | ✅ | marketplace | BehavioralEvent (801 records) | **ACTIVE — already in CC** |
| Storefront Sessions | ✅ | ✅ | marketplace | BehavioralEvent (0 records) | **ACTIVE — already in CC** |
| Marketplace Partners | ✅ | ✅ | marketplace | crm.Partner + Product (28) | **ACTIVE — already in CC** |
| Storefront Partners | ✅ | ✅ | marketplace | PartnerStorefront (6-13) | **ACTIVE — already in CC** |
| Marketplace Customers | ✅ | ✅ | marketplace | unique buyers (79) | **ACTIVE — already in CC** |
| Storefront Customers | ✅ | ✅ | marketplace | unique buyers (50) | **ACTIVE — already in CC** |
| Refunds amount | ✅ | ✅ | financial | SubscriptionPayment / Order refund | **ACTIVE — already in CC** |
| Refunds Processed count | ✅ | ✅ | operational | processed refund count | **ACTIVE — already in CC** |

**All 8 agreed candidates were already surfaced in Command Center. No additions needed.**

---

## FOUR-WAY CLASSIFICATION

| widgetId | Classification | Reason |
|---|---|---|
| **Executive** | | |
| gmv | A — ACTIVE_CANONICAL | Shows qualifiedGmv, real data |
| collected-gmv | A | Real GMV lifecycle metric |
| outstanding | A | Real GMV lifecycle metric |
| completed-gmv | A | Real GMV lifecycle metric |
| revenue | A | Payment Volume (i18n correct) |
| refunds | A | Financial refund amount (fixed in Post-H) |
| orders | A | Real order count |
| bookings | A | Real booking count |
| aov | A | Real average order value |
| conversion | A | Real conversion rate |
| **Operational** | | |
| orders-fulfilled | A | Real operational count |
| bookings-confirmed | A | Real operational count |
| bookings-completed | A | Real operational count |
| payments-captured | A | Real operational count |
| refunds-processed | A | Real operational count (distinct from refunds amount) |
| funnel | A | Real conversion funnel |
| **Financial** | | |
| commission | A | Real commission metric |
| reconciliation | G — REQUIRED_MANDATORY | required=true, removable=false |
| payments | A | Real payment volume |
| net-payments | A | Real net payment metric |
| **Marketplace** | | |
| sessions | A | Real BehavioralEvent data |
| storefront-sessions | A | Real BehavioralEvent data (0 = legitimate) |
| marketplace-partners | A | Real CRM + Catalog data |
| storefront-partners | A | Real PartnerStorefront data |
| marketplace-customers | A | Real unique buyers |
| storefront-customers | A | Real unique buyers |
| storefront-mrr | A — STAGE I | MRR from SubscriptionContract |
| storefront-arr | A — STAGE I | ARR = MRR × 12 |
| storefront-collected | A — STAGE I | Collected from SubscriptionPayment |
| storefront-outstanding | A — STAGE I | Outstanding from SubscriptionInvoice |
| **Trends** | | |
| orders-trend | A | Time-series chart |
| bookings-trend | A | Time-series chart |
| revenue-trend | A | Time-series (unsupported flag) |
| **Registry-only** | | |
| qualified-gmv | E — LEGACY_OBSOLETE | Superseded by `gmv` (which shows qualifiedGmv) |

---

## ORPHAN DETECTION

```
Registry entries with no runtime widget: 1 (qualified-gmv — legacy obsolete)
Settings items with no runtime widget: 0
Runtime widgets with no registry: 0
Legacy widget IDs (backward-compat aliases): 4 (partners, customers, total-refunds, net-revenue) — intentional
Duplicate semantic widgets: 0
```

### qualified-gmv — Legacy Orphan

The `gmv` widget already renders `qualifiedGmv` field. The separate `qualified-gmv` registry entry is redundant. **Recommendation:** remove from registry in future cleanup. No action needed in this gate since it causes no harm (user can add it from Settings but it would show same value as GMV).

---

## DUPLICATE SEMANTICS CHECK

| Potential Duplicate | Resolution |
|---|---|
| GMV variants | `gmv` = qualified GMV. `collected-gmv`, `outstanding`, `completed-gmv` = distinct lifecycle stages. No duplication. |
| Payments | `payments` (financial) = payment volume. `payments-captured` (operational) = count. Distinct. |
| Refunds | `refunds` (financial) = monetary amount. `refunds-processed` (operational) = count. **Distinct.** |
| Commission | Single widget. No duplication. |
| Partners | `marketplace-partners` + `storefront-partners` = channel-separated. **Distinct.** |
| Customers | `marketplace-customers` + `storefront-customers` = channel-separated. **Distinct.** |
| Sessions | `sessions` + `storefront-sessions` = channel-separated. **Distinct.** |
| MRR vs Collected | `storefront-mrr` = run-rate. `storefront-collected` = actual payments. **Distinct** (even if values coincide). |

**No unintended semantic duplicates found.**

---

## STAGE I WIDGETS — FULL AUDIT

| Widget | Registry | WIDGET_MAP | API field | i18n RU | i18n AZ | i18n EN | Permission | Section |
|---|---|---|---|---|---|---|---|---|
| storefront-mrr | ✅ | ✅ | storefrontMrr | ✅ MRR Storefront | ✅ | ✅ | dashboard.marketplace.read | marketplace |
| storefront-arr | ✅ | ✅ | storefrontArr | ✅ ARR Storefront | ✅ | ✅ | dashboard.marketplace.read | marketplace |
| storefront-collected | ✅ | ✅ | storefrontCollected | ✅ Получено | ✅ Toplanmış | ✅ Collected | dashboard.marketplace.read | marketplace |
| storefront-outstanding | ✅ | ✅ | storefrontOutstanding | ✅ К оплате | ✅ Ödənilməmiş | ✅ Outstanding | dashboard.marketplace.read | marketplace |

**All 4 Stage I widgets: ✅ in all layers. MRR ≠ Collected semantics preserved.**

---

## RECONCILIATION MANDATORY

```
reconciliation: required=true, removable=false ✅
Stage I did not break this ✅
```

---

## SESSIONS AUTHORITY

```
source table: catalog."MarketplaceBehavioralEvent" / catalog."StorefrontBehavioralEvent"
event filter: COUNT(DISTINCT sessionId)
marketplace/storefront attribution: separate tables
period: event-period (createdAt)
DB: marketplace=801, storefront=0
API: ✅
UI: ✅
No synthetic data ✅
```

---

## RBAC / SCOPE

```
Role defaults preserved: ✅ (Stage A matrix intact)
Platform scope: aggregate metrics visible to platform roles ✅
Partner scope: partner cannot see platform-wide MRR/ARR ✅
Settings bypass: impossible (Settings uses same registry filtered by RBAC) ✅
Unknown IDs: rejected by workspace service validation ✅
```

---

## PERSISTENCE

```
Existing widgets: show/hide works via WIDGET_REGISTRY ✅
Stage I widgets: show/hide works (same mechanism) ✅
Reload: preference persists via workspace layout API ✅
Old preferences: backward-compat aliases (partners, customers) handle old IDs ✅
Ordering: drag-and-drop via @dnd-kit ✅
```

---

## LOCALIZATION

```
RU: all labels present, no raw keys ✅
AZ: all labels present ✅
EN: all labels present ✅
Raw cc.kpi.* keys: 0 ✅
Raw widget IDs: 0 ✅
CJK: 0 ✅
Mixed locale: 0 ✅
USD/$ in Stage I labels: 0 ✅
```

---

## ZERO VALUES

```
storefront-outstanding = 0 ₼ → renders correctly ✅
Storefront Sessions = 0 → renders correctly ✅
```

---

## DB/API/UI RECONCILIATION

```
MRR: DB=1930, API=1930, UI=1930 ₼ ✅
ARR: DB=23160, API=23160, UI=23160 ₼ ✅
Collected: DB=1930, API=1930, UI=1930 ₼ ✅
Outstanding: DB=0, API=0, UI=0 ₼ ✅
```

---

## TESTS

| Gate | Result |
|---|---|
| Frontend i18n | 9/9 ✅ |
| Frontend command-center | 52/52 ✅ |
| Backend billing unit | 15/15 ✅ |
| Backend dashboard unit | 25/25 ✅ |
| Backend workspace | 10/10 ✅ |
| Backend TSC | ✅ |
| Backend build | ✅ |
| Frontend TSC | ✅ |
| Frontend build | ✅ |

---

## GIT

```
Starting HEAD: 59228eb
Final HEAD: 59228eb
Production code changed: NO
Files changed: 1 (report only)
```

---

## VERDICT

### VERDICT A — POST-STAGE-I WIDGET REGISTRY V2 RECONCILED / USEFUL SETTINGS WIDGETS PRESERVED OR SURFACED / COMMAND CENTER & SETTINGS CONSISTENT / STAGE J READY

Все acceptance criteria выполнены:
1. ✅ Interrupted-run worktree audited — no code changes lost
2. ✅ Full CC inventory: 34 widgets (33 rendered + 1 unsupported trend)
3. ✅ Full Registry inventory: 34 command-center entries
4. ✅ Runtime Settings inventory: same source as registry
5. ✅ Every Settings-only widget reviewed for usefulness — all 8 agreed candidates already in CC
6. ✅ Settings-only NOT treated as automatic orphan
7. ✅ Useful + authoritative + unique candidates already surfaced
8. ✅ Sessions explicitly resolved — real BehavioralEvent data
9. ✅ Storefront Sessions explicitly resolved — zero is legitimate
10. ✅ Marketplace Partners resolved — real CRM + Catalog data
11. ✅ Storefront Partners resolved — real PartnerStorefront data
12. ✅ Marketplace Customers/Buyers resolved — unique buyers with orders
13. ✅ Storefront Customers/Buyers resolved — unique buyers with orders
14. ✅ Refund amount preserved as financial metric
15. ✅ Refund processed count preserved as distinct operational metric
16. ✅ Revenue/Net Revenue legacy status: revenue = Payment Volume (correct), Net Revenue = alias to net-payments
17. ✅ All 4 Stage I widgets aligned across layers
18. ✅ MRR ≠ Collected semantics preserved
19. ✅ Registry remains single source
20. ✅ Command Center orphans: 0 (1 legacy registry-only: qualified-gmv — documented)
21. ✅ Settings orphans: 0
22. ✅ Duplicate IDs: 0
23. ✅ Unintended semantic duplicates: 0
24. ✅ All active metric paths valid
25. ✅ Reconciliation mandatory preserved
26. ✅ Zero values render
27. ✅ Role defaults preserved
28. ✅ RBAC server-side preserved
29. ✅ Settings cannot bypass RBAC
30. ✅ Platform/Partner scope preserved
31. ✅ Settings cannot bypass workspace scope
32. ✅ Show/hide works
33. ✅ Reload persistence works
34. ✅ Old preferences handled
35. ✅ New widget defaults explicit
36. ✅ RU/AZ/EN PASS
37. ✅ Raw keys/IDs = 0
38. ✅ Stage I USD/$ leakage = 0
39. ✅ DB/API/UI reconciliation PASS
40. ✅ No synthetic data
41. ✅ No fabricated metrics
42. ✅ Tests/TSC/build PASS
43. ✅ Stage J not started
