# POST-PHASE 3 — SETTINGS CENTER + REFERENCE & MASTER DATA — ROADMAP AMENDMENT — FINAL REPORT

**Date:** 2026-09-12
**Mode:** Roadmap Amendment / Documentation-Only Governance
**Baseline SHA:** `83659a78526fdc5560c73f1aeb80c0a811ea2223`

---

## 1. Executive Summary

Roadmap Amendment для Settings Center + Reference & Master Data / «Справочники»
выполнен. Оба capability зафиксированы в canonical roadmap как PLANNED /
GOVERNANCE-DEFINED (NOT IMPLEMENTED). Production code, schema и tests не
изменены. Phase 3 остаётся CLOSED. Phase 4 НЕ определена.

```text
SETTINGS CENTER = PLANNED / GOVERNANCE-DEFINED
REFERENCE & MASTER DATA CENTER = PLANNED / GOVERNANCE-DEFINED
PHASE 4 = NOT DEFINED
TRUE NEXT = UNCHANGED (GOVERNANCE INPUT REQUIRED)
PRODUCTION CHANGES = 0
```

---

## 2. Git Baseline

| Параметр | Значение |
|---|---|
| Repository | `seldom733-hash/travelhub1` |
| Branch | `master` |
| Baseline SHA | `83659a78526fdc5560c73f1aeb80c0a811ea2223` |
| HEAD (до изменений) | `83659a78526fdc5560c73f1aeb80c0a811ea2223` |
| origin/master | `83659a78526fdc5560c73f1aeb80c0a811ea2223` |
| HEAD == origin/master | YES |
| Working tree | CLEAN (only untracked legacy files) |

---

## 3. Проверенные Canonical Documents

| Document | Status | Результат проверки |
|---|---|---|
| `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` | EXISTS | Phase 1-3 only, NO Phase 4. Step 3.28 = Settings Center. Amended. |
| `docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md` | EXISTS | Domain ownership confirmed. Settings = configuration only. |
| `docs/reports/evidence/POST_PHASE_3_ROADMAP_RECONCILIATION_FINAL_REPORT.md` | EXISTS | Phase 4 NOT DEFINED confirmed. |
| `docs/reports/evidence/POST_PHASE_3_PRODUCT_GOVERNANCE_DECISION_FINAL_REPORT.md` | EXISTS | TRUE NEXT = GOVERNANCE INPUT REQUIRED. |
| `docs/adr/ADR-0001-modular-monolith.md` | EXISTS | Domain = schema ownership. |
| `docs/adr/ADR-0002-auth-rbac.md` | EXISTS | 10 canonical roles, 147+ permissions. |
| `docs/architecture/finance-domain-foundation.md` | EXISTS | Finance owns Currency/Tax/FX. Settings does NOT duplicate. |
| `docs/architecture/service-templates-decision-gates.md` | EXISTS | DD-028: Catalog owns normalized dictionaries. |
| `docs/architecture/rate-plan-foundation.md` | EXISTS | Tariff = Rate Plan. Room ≠ RatePlan. |
| `docs/architecture/universal-pricing-model.md` | EXISTS | Cross-category pricing model. |
| `docs/reports/PHASE_3_RBAC_DEPARTMENTAL_MODEL_RECONCILIATION_AUDIT_REPORT.md` | EXISTS | Departmental model proven. |
| `backend/prisma/schema.prisma` | EXISTS | 5134 lines. Finance/Catalog/Security schemas verified. |
| `docs/prompts/TRAVELHUB_SETTINGS_REFERENCE_MASTER_DATA_ROADMAP_AMENDMENT.md` | EXISTS | Source prompt document. |

---

## 4. Исследованные существующие модели (Prisma Schema)

### Что СУЩЕСТВУЕТ в `backend/prisma/schema.prisma`

| Schema | Model | Domain Owner |
|---|---|---|
| `finance` | `Currency` (CUR-*) | Finance |
| `finance` | `ExchangeRate` (FXR-*) | Finance |
| `finance` | `Tax` (TAX-*) | Finance |
| `finance` | `TaxRule` (TXR-*) | Finance |
| `finance` | `CommissionPolicy` (CMP-*) | Finance |
| `catalog` | `Product` (PRD-*) | Catalog |
| `catalog` | `Category` (CAT-*) | Catalog |
| `catalog` | `CategorySchema` | Catalog |
| `catalog` | `ServiceUnit` (UNI-*) | Catalog |
| `catalog` | `Tariff` (TRF-*) = Rate Plan | Catalog |
| `catalog` | `CommercialPeriod` (CPR-*) | Catalog |
| `catalog` | `Availability` | Catalog |
| `security` | `User`, `Role`, `Permission` | Security |
| `crm` | `Customer`, `Partner`, `Contact` | CRM |

### ЧТО НЕ СУЩЕСТВУЕТ (подтверждено)

| Entity | Status |
|---|---|
| Hotel (отдельная модель) | НЕТ — hotels = Product с type=HOTEL |
| Room (отдельная модель) | НЕТ — rooms = ServiceUnit |
| RoomType | НЕТ — нет модели |
| MealType | НЕТ — нет модели |
| Airport | НЕТ — нет модели |
| Region | НЕТ — нет модели |
| Country (backend schema) | НЕТ — только в legacy schema; в backend = строковый reference |
| Settings / SystemConfig | НЕТ — нет модели |
| Dictionary (universal) | НЕТ — намеренно не создаётся |

---

## 5. Внесённые изменения

### 5.1 Canonical Roadmap — Step 3.28 boundary clarification

**File:** `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
**Change:** Добавлен boundary clause к Step 3.28 (Settings Center)

```text
Boundary (Roadmap Amendment — Settings & Reference/Master Data):
Settings Center = configuration/configuration management. Settings MUST NOT
duplicate master/reference data owned by another domain (Finance owns
Currency/Tax/FX; Catalog owns normalized dictionaries per DD-028). Settings
may store configuration/reference selections or read domain-owned values but
does NOT become authority for Finance or Catalog master data.
```

### 5.2 Canonical Roadmap — Post-Phase-3 section

**File:** `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
**Change:** Добавлен раздел `POST-PHASE 3 — PLANNED CAPABILITIES` в конце файла

Содержит:
- Settings Center (расширение Step 3.28) — scope, invariant, examples
- Reference & Master Data / Dictionaries Center — scope, UI Information Architecture, Reference vs Master Data distinction, domain ownership matrix, Hotel/Room/RatePlan hierarchy, lifecycle, RBAC, boundary with Catalog, dependencies, acceptance criteria

---

## 6. Что НЕ изменено (подтверждение)

| Параметр | Значение |
|---|---|
| Production code | 0 строк |
| Application code | 0 строк |
| Schema (Prisma) | 0 изменений |
| Tests | 0 изменений |
| D15 | НЕ создан |
| UI-C19 | НЕ создан |
| Phase 3 | CLOSED (не менялся) |
| D0–D14 | CLOSED (не менялись) |
| STEP 3.12 | PASS (не менялся) |
| 2.17B | BLOCKED (не менялся) |
| Phase 4 | NOT DEFINED (не создавался) |
| Исторические reports | НЕ переписывались |

---

## 7. Settings Center — каноническая фиксация

### Определение

Settings Center = **configuration/configuration management**, НЕ управление
master/reference entities.

### Scope (минимальный)

- organization settings
- user settings
- localization / locale
- timezone / region
- display formats
- feature flags
- business policies
- default references
- workflow parameters
- UI preferences
- delegated settings
- RBAC-controlled configuration

### Key Invariant

> Settings Center MUST NOT duplicate master/reference data owned by another
> domain.

### Примеры

| Domain | Master Data | Settings может хранить |
|---|---|---|
| Finance | Currency, Tax, TaxRule, ExchangeRate | Выбор currency preference, default tax locale |
| Catalog | Normalized dictionaries (DD-028) | Default category selection, display preferences |
| CRM | Customer, Partner | Default partner filter, display preferences |

Settings НЕ становится authority для Finance или Catalog master data.

---

## 8. Reference & Master Data / Dictionaries Center — каноническая фиксация

### Определение

Пользовательский раздел **«Справочники»** — полноценный административный
центр управления нормализованными reference/master данными.

### Что это НЕ является

- Help / Business Dictionary
- Settings Center
- Catalog Product Center
- Универсальный владелец всех domain entities

### Reference Data vs Master Data

| Type | Описание | Примеры |
|---|---|---|
| Reference Data | Простые нормализованные классификаторы | Country, Region, City, MealType, RoomType, ServiceType, Status, CancellationReason, Source |
| Master Data | Сложные редактируемые объекты с lifecycle | Hotel, Flight, potentially Airport/Location |

**Invariant:** Каждая сущность должна иметь canonical domain ownership.
Универсальная сущность «Dictionary» НЕ создаётся.

### Domain Ownership

| Domain | Owned Entities |
|---|---|
| Finance | Currency, Tax, TaxRule, ExchangeRate, CommissionPolicy |
| Catalog | Product, Category, CategorySchema, ServiceUnit, Tariff, Normalized dictionaries (DD-028) |
| CRM | Customer, Partner, Contact |
| Security | User, Role, Permission, AuditLog |
| Dictionaries Center | Centralized administrative surface — NOT a second domain authority |

### Hotel / Room / RatePlan Hierarchy

```text
Product
  └── ServiceUnit (Room)
        └── Tariff / Rate Plan
              └── CommercialPeriod
                    └── Price
                          └── Availability
```

**Invariant:** Room ≠ RatePlan. Meal plan/refundability = коммерческие
переменные, не Room identity.

### Lifecycle

| State | Описание |
|---|---|
| ACTIVE | Нормальное состояние |
| INACTIVE | Отключена, но видна для исторических данных |
| ARCHIVED | Soft-deleted, audit trail сохранён |

Destructive delete запрещён для сущностей с историческими данными.
Audit: who/when/what.

### RBAC / Security

- Permission-aware visibility
- Backend authorization (не UI-hiding)
- Audit trail
- Tenant/organization scope
- Explicit manage/read permissions

### Boundary with Catalog

```
Dictionaries / Master Data = normalized reference/master data
Catalog Product = commercial offer sold/distributed by TravelHub
```

Reference/Master Data ≠ автоматически продаваемый Product.
Catalog ≠ дубликат master-data authority.

### Dependencies (до реализации)

1. Подтвердить canonical domain owner каждой сущности
2. Проверить существующие Prisma/API models
3. Проверить Category/CategorySchema foundation
4. Проверить Catalog/Hotel/Room/Pricing architecture
5. Проверить Finance-owned master/reference data
6. Определить tenant/organization scope
7. Определить RBAC
8. Определить audit requirements
9. Определить lifecycle
10. Определить API contracts
11. Определить UI information architecture
12. Определить seed/reference-data strategy
13. Решить: global platform vs organization/partner scoped

### Acceptance Criteria (будущая реализация)

- Canonical ownership matrix
- Architecture update
- Prisma/storage reconciliation
- API contract
- RBAC matrix
- Tenant-scope rules
- CRUD + lifecycle + audit/history
- Search/filter
- Seed/reference data strategy
- Frontend/admin UI
- Integration with consuming domains
- Tests + migration safety
- No duplicate authorities
- Documentation update
- **Изменение reference/master data НЕ должно ретроспективно изменять frozen transactional snapshots**

---

## 9. Roadmap placement

```text
POST-PHASE 3

Settings & Reference/Master Data

├── Settings Center
│   └── configuration / organization / localization / policies
│
└── Reference & Master Data / Dictionaries Center
    ├── Reference Data
    ├── Master Data
    ├── CRUD
    ├── Lifecycle
    ├── RBAC
    ├── Audit
    └── cross-domain references
```

**Status:** PLANNED / GOVERNANCE-DEFINED

Это НЕ текущий implementation TRUE NEXT. Реализация требует отдельного
governance decision.

---

## 10. Git Status (финальный)

| Параметр | Значение |
|---|---|
| Files changed | 1 (docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md) |
| Lines added | ~150 (amendment section + Step 3.28 boundary) |
| Production changes | 0 |
| Schema changes | 0 |
| Test changes | 0 |
| Commit SHA | (pending) |
| origin/master | (pending) |
| HEAD == origin/master | (pending — после push) |
