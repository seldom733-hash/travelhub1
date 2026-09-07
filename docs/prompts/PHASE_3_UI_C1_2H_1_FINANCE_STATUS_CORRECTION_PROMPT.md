# PHASE 3 — UI-C1.2H.1 — FINANCE STATUS DOCUMENTATION CORRECTION

**Purpose:** корректировка архитектурной документации после принятия H.1  
**Type:** Documentation / Architecture Micro-Update  
**Baseline:** `93456452dcd4dec69b76d4d487d75fd67eabc63c`  
**Production code:** НЕ менять  
**Business logic:** НЕ менять  
**Tests:** НЕ менять, если только документационный change не требует обновления snapshot/metadata test — по умолчанию не требуется

---

## 1. ПРОБЛЕМА

В H.1 Global Help Architecture Finance описан как:

```text
CURRENT (payments); FUTURE (шире finance)
```

Это может создавать неверное впечатление, что раздел/центр **Finance уже реализован**.

Это неверно.

Каноническое различие:

```text
FINANCE CENTER / РАЗДЕЛ ФИНАНСЫ
        ↓
NOT STARTED

Payments
        ↓
CURRENT capability / Operations Center tab
        ↓
Finance ownership
```

**Payments ≠ Finance Center.**

Наличие реализованной вкладки Payments в Operations Center не означает, что начат полноценный раздел Finance.

---

# 2. ЧТО СЧИТАТЬ CANONICAL

Зафиксировать:

### Operations Center

```text
ОПЕРАЦИИ
├── Заявки
├── Заказы
└── Бронирования
```

### Finance ownership

Payments относится к финансовой ответственности:

```text
FINANCE OWNERSHIP
└── Payments
```

но пользовательский раздел/центр Finance ещё не реализован.

### Finance Center

```text
FINANCE
├── Payments
├── Refunds
├── Commissions
├── Settlements
├── Payouts
├── Reconciliation
└── Finance Analytics
```

Полноценный Finance Center:

```text
NOT STARTED
```

Не считать существующие Payments UI/endpoint полноценной реализацией Finance Center.

---

# 3. ДОКУМЕНТАЦИОННАЯ КОРРЕКТИРОВКА

Исправить формулировки в H.1 Architecture Map и связанных H.1 qualification/report artifacts, где создаётся двусмысленность.

Вместо:

```text
Finance — CURRENT (payments); FUTURE (шире finance)
```

использовать смысл:

```text
Finance — NOT STARTED
Payments — CURRENT financial capability / Payments tab,
           with Finance ownership,
           but NOT Finance Center.
```

На русском в основном тексте:

> **Финансы — NOT STARTED. Функциональность Payments реализована как текущая финансовая capability/вкладка Operations Center и находится в зоне ответственности Finance, однако полноценный раздел/центр «Финансы» ещё не начат.**

---

# 4. GLOBAL HELP TAXONOMY

В Global Help taxonomy сохранить область:

```text
finance
```

но её статус должен быть:

```text
NOT STARTED
```

При этом current Help content:

```text
payments
```

может оставаться доступным как текущая реализованная capability.

Целевая модель:

```text
Finance
│
├── Payments
│   └── CURRENT — реализованная capability
│
├── Refunds
│   └── FUTURE
├── Commissions
│   └── FUTURE
├── Settlements
│   └── FUTURE
├── Payouts
│   └── FUTURE
├── Reconciliation
│   └── FUTURE
└── Finance Center / Finance Analytics
    └── NOT STARTED / FUTURE
```

Не создавать Help content для будущих Finance capabilities без canonical business authority.

---

# 5. НЕ МЕНЯТЬ

Запрещено в рамках этого micro-update:

- менять `help-registry.ts`;
- менять `/app/help`;
- менять Payments UI;
- менять Payments API;
- менять Finance backend;
- менять RBAC;
- менять tenant isolation;
- менять PaymentStatus;
- менять RefundStatus;
- менять KPI semantics;
- менять Operations Center;
- создавать Finance Center;
- создавать Finance KPI;
- создавать financial formulas;
- создавать ledger/commission/settlement semantics;
- менять PROD-01.

---

# 6. HELP CONTENT BOUNDARY

Зафиксировать принцип:

> Help может описывать только уже канонически существующую бизнес-семантику.

Поэтому:

```text
Payments
    → CURRENT Help coverage

Finance Center
    → NO production Help content yet

Refunds / Commissions / Settlements / Payouts /
Reconciliation / Finance Analytics
    → FUTURE / NOT YET CANONICAL
```

Если соответствующая бизнес-семантика появится в будущей Finance implementation stage, Help content создаётся отдельным этапом после authority audit.

---

# 7. АРХИТЕКТУРНОЕ ОТЛИЧИЕ

Обязательно сохранить:

```text
Payment
    =
финансовая транзакция

Payments tab
    =
реализованный UI/read model для управления/просмотра платежей

Finance
    =
полноценный бизнес-центр финансов
```

Следовательно:

```text
Payments tab ≠ Finance Center
Payments ownership ≠ Finance Center implementation
```

---

# 8. REPORT UPDATE

Обновить соответствующие места:

```text
docs/reports/PHASE_3_UI_C1_2H_1_HELP_GLOBAL_ARCHITECTURE_MAP.md
docs/reports/PHASE_3_UI_C1_2H_1_HELP_GLOBAL_ARCHITECTURE_QUALIFICATION_REPORT.md
```

Если изменение требует отдельной фиксации, создать:

```text
docs/reports/PHASE_3_UI_C1_2H_1_FINANCE_STATUS_CORRECTION_REPORT.md
```

Отдельный report предпочтителен, если предыдущие H.1 artifacts уже committed и используются как immutable qualification evidence.

---

# 9. GIT POLICY

Это документационный correction.

Не изменять production source.

Перед изменением:

```bash
git status --short
git rev-parse HEAD
```

После:

```bash
git diff --check
git diff
git status --short
```

Commit должен содержать только:

- documentation correction;
- optional report.

Не включать функциональный код.

---

# 10. VERIFICATION

Проверить grep/search по H.1 documentation:

```text
Finance
CURRENT
NOT STARTED
Payments
Finance Center
```

Не должно остаться формулировок, из которых следует, что полноценный Finance Center уже реализован.

Допустимо и желательно:

```text
Payments — CURRENT
Finance — NOT STARTED
```

---

# 11. FINAL REPORT

В финальном report указать:

```text
Previous wording:
Finance — CURRENT (payments); FUTURE (шире finance)

Corrected wording:
Finance — NOT STARTED.
Payments — CURRENT financial capability / Payments tab with Finance ownership,
but not Finance Center.
```

Также указать:

```text
Production code changed: NO
Business logic changed: NO
API changed: NO
RBAC changed: NO
Status universes changed: NO
PROD-01 changed: NO
```

---

# 12. FINAL VERDICT

Ожидаемый:

```text
VERDICT A — DOCUMENTATION CORRECTION ACCEPTED
```

при условии:

- документация однозначно различает Finance и Payments;
- Finance Center обозначен NOT STARTED;
- Payments сохранён как CURRENT capability;
- production code не изменён;
- Git clean после closure.

---

# 13. FINAL RESPONSE

```text
PHASE 3 — UI-C1.2H.1 — FINANCE STATUS CORRECTION

VERDICT: A

Finance Center:
NOT STARTED

Payments:
CURRENT capability / Finance ownership

Production code:
UNCHANGED

Business logic:
UNCHANGED

API:
UNCHANGED

RBAC:
UNCHANGED

PROD-01:
UNCHANGED

Documentation:
CORRECTED

FINAL SHA:
<actual sha>

WORKTREE:
CLEAN
```
