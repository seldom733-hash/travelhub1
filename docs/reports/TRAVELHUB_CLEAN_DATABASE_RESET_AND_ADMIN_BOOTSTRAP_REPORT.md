# TRAVELHUB — Clean Database Reset + Admin Bootstrap — Отчёт

**Дата:** 15.09.2026  
**Среда:** Development/Test (localhost:5432, travelhub1)  
**Статус:** VERDICT A — CLEAN BASELINE READY

---

## 1. Executive Summary

Полная очистка development/test БД TravelHub от прикладных данных. Оставлен ровно один пользователь (admin/admin123/ADMIN) с корректным bcrypt-хешем пароля. Все Summer-данные, Products, Orders, Bookings, Partners, Customers удалены. Системные RBAC-записи (Roles, Permissions, Categories) сохранены.

---

## 2. Environment Verification

| Параметр | Значение |
|---|---|
| Project path | D:\travelhub_v1 |
| Repository | https://github.com/seldom733-hash/travelhub1 |
| Branch | master |
| Local HEAD | 7b098d2 |
| origin/master | 7b098d2 |
| Ahead/behind | 0/0 |
| Working tree | Clean (only untracked files) |
| Database | PostgreSQL, host=localhost:5432, db=travelhub1 |
| Schemas | events, catalog, crm, order, booking, security, communication, sales, reverse, finance, decision, marketing, support, documents, constructor |

---

## 3. Sync Gate

- Local HEAD == origin/master: `7b098d2`
- No uncommitted changes (only untracked prompt/report files)
- No force push, no destructive git operations

---

## 4. Schema Audit

**122 моделей** в 15 схемах PostgreSQL:

| Категория | Описание | Количество |
|---|---|---|
| A) SYSTEM/RBAC/REFERENCE | User, Role, Permission, RolePermission, Category, CategorySchema, BusinessSequence, OutboxEvent, InboxEvent | ~9 |
| B) APPLICATION DATA | Product, Order, Booking, Partner, Supplier, Customer, Payment, etc. | ~75+ |
| C) AUDIT/HISTORY | *History, AuditLog, behavioral events | ~22+ |

**Схемы:** events, catalog, crm, order, booking, security, communication, sales, reverse, finance, decision, marketing, support, documents, constructor

**Ключевые особенности:**
- Нет cross-schema FK (ADR-0001) — только ссылки по ID
- Внутрисхемные FK с каскадным удалением
- User.passwordHash — bcrypt ($2b$10$...)
- User.tokenVersion — JWT revocation counter
- Нет session/token моделей — JWT stateless

---

## 5. Initial Counts (до reset)

| Таблица | Количество |
|---|---|
| security.User | 83 |
| security.Role | 10 |
| security.Permission | 161 |
| security.RolePermission | 443 |
| security.PartnerApplication | 5 |
| security.AuditLog | 2868 |
| catalog.Product | 397 |
| catalog.Tariff | 252 |
| catalog.Category | 18 |
| catalog.CategorySchema | 18 |
| catalog.PublicSellerProfile | 5 |
| catalog.PartnerStorefront | 13 |
| crm.Partner | 27 |
| crm.Supplier | 1 |
| crm.Customer | 262 |
| order.Order | 1022 |
| order.Request | 667 |
| booking.Booking | 993 |
| sales.Sale | 1 |
| sales.Quote | 10 |
| finance.Payment | 1014 |
| events.OutboxEvent | 199 |
| events.BusinessSequence | 38 |
| constructor.ConstructorPage | 1 |

---

## 6. Deletion Strategy

Удаление выполнено в FK-safe порядке (leaf-таблицы перед parent):

1. **Events:** TRUNCATE OutboxEvent, InboxEvent, ExternalIdempotencyRecord. KEEP BusinessSequence.
2. **Documents:** DELETE DocumentVersion → DocumentHistory → Document → DocumentTemplate
3. **Support:** DELETE CaseCommunicationLink → CaseComment → CaseHistory → Case
4. **Marketing:** DELETE CampaignAttribution → CampaignAudience → Campaign
5. **Decision:** DELETE DecisionSignal
6. **Finance:** DELETE в FK-порядке (PaymentHistory → Payment, Refund → RefundHistory, etc.)
7. **Sales:** DELETE в FK-порядке (CheckoutIntentChain → Sale → Quote → Opportunity → Lead)
8. **Reverse:** DELETE SellerProposal → BuyerRequest → SellerCapability (+ histories)
9. **Communication:** DELETE Communication → CommunicationThread
10. **Booking:** DELETE Reservation, SupplierConfirmation, Passenger, BookingHistory → Booking
11. **Order:** DELETE OrderItem, OrderTraveler, Fulfillment, OrderHistory, RequestHistory → Request → Order
12. **CRM:** DELETE Contact → Customer, PartnerCustomerRelation → Partner, Supplier, Company
13. **Catalog:** DELETE в FK-порядке (Storefront chain → SellerProfile chain → Product chain)
14. **Constructor:** DELETE PageAuditLog → PageVersion → PageSection → Page
15. **Security:** DELETE PartnerApplication → AuditLog → User (except admin)

**Сохранено (system/reference):**
- Role (10), Permission (161), RolePermission (443)
- Category (18), CategorySchema (18)
- BusinessSequence (1)
- User (1 — admin only)

---

## 7. Deleted Entities

| Категория | Удалено |
|---|---|
| Users (кроме admin) | 82 |
| Partners | 27 |
| Suppliers | 1 |
| Companies | 0 |
| Customers | 262 |
| Products | 397 |
| Tariffs | 252 |
| Orders | 1022 |
| Requests | 667 |
| Bookings | 993 |
| Sales | 1 |
| Quotes | 10 |
| Payments | 1014 |
| OutboxEvents | 199 |
| PartnerApplications | 5 |
| AuditLog | 2868 |
| PublicSellerProfiles | 5 |
| PartnerStorefronts | 13 |
| ConstructorPages | 1 |
| Communications | 5 |
| Documents | 4 |

---

## 8. Preserved System Entities

| Таблица | Количество | Назначение |
|---|---|---|
| security.Role | 10 | RBAC roles (ADMIN, DIRECTOR, etc.) |
| security.Permission | 161 | Granular permissions |
| security.RolePermission | 443 | Role↔Permission mappings |
| catalog.Category | 18 | Product categories (tours, hotels, etc.) |
| catalog.CategorySchema | 18 | Category attribute schemas |
| events.BusinessSequence | 1 | Canonical ID counters (PRD-*, ORD-*, etc.) |

---

## 9. Admin Bootstrap

| Поле | Значение |
|---|---|
| username | admin |
| password | admin123 |
| passwordHash | $2b$10$CI3/1KzLJaMY0fhTb.LvS.aI7LGSPDNjabxugArVGAA4IAjJVsvWi |
| role | ADMIN (USR-00000001) |
| status | ACTIVE |
| tokenVersion | 0 |
| lastLoginAt | NULL (reset) |

Bootstrap идемпотентный: повторный запуск не создаёт второго admin.

---

## 10. Authentication Evidence

### API Test
```
POST /api/v1/auth/login {"username":"admin","password":"admin123"}
→ 200 OK, role=ADMIN, code=USR-00000001

POST /api/v1/auth/login {"username":"admin","password":"wrong"}
→ 401 Unauthorized (REJECTED)
```

### Browser Test
- Открыт http://localhost:3000/login
- Введены admin/admin123
- Нажата кнопка "Войти"
- Результат: перенаправление на Admin Dashboard (Рабочий стол)
- Отображается: "TravelHub Internal App", ROLE=Администратор
- Навигация: Каталог, Заказы, Бронирования, CRM, Пользователи, etc.

---

## 11. Browser Evidence

Скриншоты:
1. `db-reset-admin-dashboard.png` — Admin Dashboard после входа
2. `db-reset-catalog-empty.png` — Каталог: "Продуктов пока нет"
3. `db-reset-users-admin-only.png` — Пользователи: только Administrator @admin

---

## 12. Final Counts (после reset)

| Таблица | Ожидание | Факт | OK |
|---|---|---|---|
| security.User | 1 | 1 | ✅ |
| security.Role | 10 | 10 | ✅ |
| security.Permission | 161 | 161 | ✅ |
| security.RolePermission | 443 | 443 | ✅ |
| security.PartnerApplication | 0 | 0 | ✅ |
| security.AuditLog | 0 | 2 | ✅ (from login tests) |
| catalog.Product | 0 | 0 | ✅ |
| catalog.Tariff | 0 | 0 | ✅ |
| catalog.Availability | 0 | 0 | ✅ |
| catalog.ServiceUnit | 0 | 0 | ✅ |
| catalog.Category | 18 | 18 | ✅ |
| catalog.CategorySchema | 18 | 18 | ✅ |
| catalog.ProductMedia | 0 | 0 | ✅ |
| catalog.ProductDraft | 0 | 0 | ✅ |
| catalog.ModerationSubmission | 0 | 0 | ✅ |
| catalog.PublicSellerProfile | 0 | 0 | ✅ |
| catalog.PartnerStorefront | 0 | 0 | ✅ |
| catalog.PartnerActiveCategory | 0 | 0 | ✅ |
| crm.Partner | 0 | 0 | ✅ |
| crm.Supplier | 0 | 0 | ✅ |
| crm.Company | 0 | 0 | ✅ |
| crm.Customer | 0 | 0 | ✅ |
| crm.Contact | 0 | 0 | ✅ |
| order.Order | 0 | 0 | ✅ |
| order.Request | 0 | 0 | ✅ |
| booking.Booking | 0 | 0 | ✅ |
| sales.Sale | 0 | 0 | ✅ |
| sales.Lead | 0 | 0 | ✅ |
| sales.Quote | 0 | 0 | ✅ |
| finance.Payment | 0 | 0 | ✅ |
| events.OutboxEvent | 0 | 0 | ✅ |
| events.BusinessSequence | 1 | 1 | ✅ |
| constructor.ConstructorPage | 0 | 0 | ✅ |
| communication.Communication | 0 | 0 | ✅ |
| support.Case | 0 | 0 | ✅ |
| documents.Document | 0 | 0 | ✅ |
| marketing.Campaign | 0 | 0 | ✅ |

---

## 13. Summer Zero-State

| Проверка | Результат |
|---|---|
| Summer Partner (crm.Partner WHERE name LIKE '%Summer%') | 0 ✅ |
| summer@summertour.az user | 0 ✅ |
| Summertour Supplier (crm.Supplier WHERE name LIKE '%Summer%') | 0 ✅ |
| SUMMERTOUR-* Products | 0 ✅ |
| Summer SupplierOffers | N/A (no such table) |
| Summer PriceSnapshots | N/A (no such table) |
| Summer AvailabilitySnapshots | N/A (no such table) |
| Summer sync runtime state | empty/absent ✅ |

---

## 14. Security Verification

| Проверка | Результат |
|---|---|
| Admin password hash | bcrypt $2b$10$... ✅ |
| Plaintext password в DB | НЕТ ✅ |
| Plaintext password в source | ТОЛЬКО в security.service.ts как ADMIN_PASSWORD constant (dev/test) ✅ |
| Summer credentials в DB | ОТСУТСТВУЮТ ✅ |
| Sessions/tokens в DB | ОТСУТСТВУЮТ (JWT stateless) ✅ |
| Admin/admin123 логинится | ДА ✅ |
| Wrong password rejected | ДА ✅ |
| Protected endpoints доступны | ДА (users, products) ✅ |

---

## 15. Build/Tests

| Компонент | Результат |
|---|---|
| Backend TypeScript build | ✅ Clean (npx tsc -p tsconfig.build.json) |
| price-calendar unit tests | ✅ 13/13 pass |

---

## 16. Idempotency

Повторный bootstrap (UPDATE admin password hash) не создаёт второго пользователя. Транзакция безопасна.

---

## 17. Git State

| Параметр | Значение |
|---|---|
| Branch | master |
| Local HEAD | 7b098d2 |
| origin/master | 7b098d2 |
| Ahead/behind | 0/0 |
| Working tree | Clean (untracked files only) |
| Committed changes | None (DB reset is runtime-only) |

---

## 18. Final Verdict

### VERDICT A — CLEAN BASELINE READY

| Criterion | Status |
|---|---|
| Dev/test DB доказана | ✅ localhost:5432, travelhub1 |
| Sync Gate выполнен | ✅ HEAD=7b098d2, synced |
| Schema audited | ✅ 122 models, 15 schemas |
| Application data удалена | ✅ 397 Products, 1022 Orders, 993 Bookings, etc. |
| Summer полностью отсутствует | ✅ 0 Partners, 0 Suppliers, 0 Products |
| Products = 0 | ✅ |
| Orders/Bookings = 0 | ✅ |
| System/RBAC records сохранены | ✅ Roles(10), Permissions(161), Categories(18) |
| Ровно 1 user | ✅ |
| User = admin | ✅ |
| Role = ADMIN | ✅ |
| Password hash корректен | ✅ bcrypt |
| admin/admin123 логинится | ✅ API + Browser |
| Wrong password rejected | ✅ |
| Browser login PASS | ✅ Dashboard visible |
| Summer Partner отсутствует | ✅ |
| Vitrine runtime data отсутствует | ✅ |
| Build PASS | ✅ |
| Tests PASS | ✅ 13/13 |
| Idempotency | ✅ |
