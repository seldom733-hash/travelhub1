# USER / BUYER / PARTNER SUSPENSION & DEACTIVATION LIFECYCLE — ARCHITECTURE & ROADMAP AMENDMENT

## 1. Назначение

Документ фиксирует архитектурные требования и roadmap placement для будущей реализации lifecycle приостановки и деактивации:

```text
User Account
Buyer/customer-facing account
Partner business
Partner employee/user account
```

Это **не deletion model** и **не GDPR erasure model**.

Главный принцип:

```text
SUSPENSION / DEACTIVATION
≠
DELETION
≠
ANONYMIZATION
≠
GDPR ERASURE
```

Исторические бизнес-данные должны сохраняться.

---

## 2. Domain Boundaries

Не смешивать:

```text
User account status
Partner business status
Partner employee membership/status
Customer CRM history
```

Один физический User может участвовать в разных business contexts.

---

## 3. User Lifecycle

Минимальная модель:

```text
ACTIVE → нормальный доступ
SUSPENDED → временная административная/безопасностная блокировка; потенциально обратимо
DEACTIVATED → долгосрочно отключённый account; история сохраняется
```

### 3.1 SUSPENDED

Семантика:

```text
→ временная блокировка
→ login denied
→ existing sessions revoked/invalidated
→ refresh tokens invalidated
→ protected actions denied
→ потенциально обратимо через явный controlled process
```

### 3.2 DEACTIVATED

Семантика:

```text
→ долгосрочно отключён
→ новые действия запрещены
→ история сохраняется
→ восстановление ТОЛЬКО через явный controlled process, если policy разрешает
→ DEACTIVATED → ACTIVE не считать автоматически допустимым
```

---

## 4. Partner Business Lifecycle

Отдельный lifecycle:

```text
ACTIVE → нормальная работа
SUSPENDED → приостановка бизнеса
DEACTIVATED → деактивация бизнеса
```

Partner business status **не должен автоматически** означать:

```text
удаление Partner records
деактивацию всех employee accounts
удаление исторических данных
```

---

## 5. Partner Employee Lifecycle

Деактивация сотрудника:

```text
не деактивирует Partner business
не удаляет созданные им records
не ломает audit attribution
не меняет ownership исторических действий
```

---

## 6. Status Metadata

Для каждой server-authoritative status change:

```text
status              — текущий статус
statusReason        — структурированная причина (enum, расширяемый)
statusComment       — внутренний административный комментарий
statusChangedAt     — серверный timestamp
statusChangedBy     — сервер-derived actor
```

### 6.1 statusReason

Минимальные conceptual values:

```text
USER_REQUEST
FRAUD
SECURITY
POLICY_VIOLATION
LEGAL
INACTIVITY
BUSINESS_CLOSED
COMPLIANCE
OTHER
```

Не считать этот список окончательной Prisma enum спецификацией до implementation audit.

### 6.2 statusComment

Требования:

```text
free-text
internal only
audited
не возвращается в public/Buyer/Partner-facing API
не попадает в Communication payload
не показывается публично в CRM/customer-facing views
```

Для `statusReason = OTHER` комментарий должен быть обязательным.

---

## 7. Status History / Audit

Append-only/auditable история переходов обязательна.

Концептуальная модель:

```text
StatusHistory
  entityType      — USER | PARTNER | PARTNER_MEMBER
  entityId        — UUID
  previousStatus  — предыдущий статус
  newStatus       — новый статус
  reason          — statusReason
  comment         — statusComment
  changedBy       — actor UUID (server-derived)
  changedAt       — server timestamp
```

Не создавать generic polymorphic table автоматически, если repository architecture предпочитает domain-specific audit/event records.

Главное требование — неизменяемая история должна существовать в архитектуре.

---

## 8. Server Authority

Status НЕ frontend-only состояние.

Authority chain:

```text
Authenticated Actor
→ Workspace Context
→ Permission
→ Target Entity Scope
→ Allowed Transition
→ Reason/Comment Validation
→ Persist Current Status
→ Persist Audit/History
→ Enforce Runtime Restrictions
```

Запрещено:

```text
client-controlled statusChangedBy
client-controlled target partner scope
display:none как security enforcement
frontend-only login block
```

---

## 9. Transition Rules

Минимально:

```text
ACTIVE → SUSPENDED
ACTIVE → DEACTIVATED

SUSPENDED → ACTIVE
SUSPENDED → DEACTIVATED
```

`DEACTIVATED → ACTIVE` НЕ считать автоматически допустимым.

Требуется отдельная policy:

```text
reactivation allowed?
who can reactivate?
which reason required?
does user-requested deactivation differ from fraud/legal deactivation?
```

До этого — не фиксировать опасный automatic restore.

---

## 10. Business Data Preservation

Suspension/deactivation НЕ должны автоматически удалять:

```text
Orders, Bookings, Payments, Refunds, Settlements, Payouts
Products/Listings, Customers, PartnerCustomerRelation
CRM Activity, Operational Notes, Communications
Reviews, Marketing attribution, Audit/history
```

Особенно:

```text
DEACTIVATED Partner ≠ delete Partner
```

---

## 11. Active Transaction Safety

Future implementation должен определить поведение существующих обязательств.

Нельзя автоматически:

```text
cancel paid bookings
delete orders
void payments
erase refund obligations
erase payout rights
erase dispute evidence
```

Policy matrix по состоянию:

```text
new sales              → блокируются
existing unpaid orders → определить policy
confirmed bookings     → определить policy
paid bookings          → НЕ отменять автоматически
refunds                → продолжать processing
settlements            → продолжать processing
payouts                → продолжать processing
disputes               → продолжать processing
customer communication → определить policy
```

Если policy ещё не определена — roadmap помечает это как mandatory implementation-design gate.

---

## 12. Login / Session Effects

### User SUSPENDED

```text
new login denied
existing sessions revoked/invalidated
refresh tokens invalidated
protected actions denied
```

### User DEACTIVATED

Те же ограничения +:

```text
reactivation только через explicit controlled process
```

Не реализовывать сейчас. Зафиксировать необходимость server-authoritative session/token enforcement.

---

## 13. Partner Business Effects

При `Partner.status = SUSPENDED/DEACTIVATED`:

```text
Marketplace listings      → visibility определить
Storefront public site    → availability определить
new bookings/orders       → блокировать
Partner Workspace         → access определить
employees                 → НЕ деактивировать автоматически
payments/refunds          → продолжать existing obligations
payouts                   → продолжать existing obligations
communications            → определить policy
```

Не смешивать:

```text
business disabled ≠ все employee accounts deleted/deactivated
```

---

## 14. Marketplace / Storefront Projection

### Marketplace

При Partner suspension/deactivation:

```text
visibility of listings
new purchase/book restrictions
existing booking servicing
moderated communication
financial settlement
```

### Storefront

```text
public storefront availability
catalog visibility
new direct bookings/orders
back-office access
existing customer obligations
```

Storefront public site и Storefront Back Office — разные surfaces.

---

## 15. CRM / History Preservation

Customer/Buyer account deactivation НЕ должна уничтожать CRM history:

```text
Customer identity/history
PartnerCustomerRelation
Activity
Orders, Bookings, Payments
Communication history
Marketing attribution
```

Будущий implementation определит, какие персональные данные могут быть subject отдельной privacy/anonymization policy.

Не смешивать deactivation с anonymization.

---

## 16. Security / Permissions

Концептуальные permissions:

```text
user.status.read
user.status.manage
partner.status.read
partner.status.manage
partner.member.status.manage
```

Фактические permission names определить repository audit'ом.

Критические действия:

```text
SUSPEND → может потребовать elevated permission
DEACTIVATE → может потребовать elevated permission + audit
REACTIVATE → может потребовать elevated permission + policy gate
```

Для чувствительных причин (FRAUD, SECURITY, LEGAL, COMPLIANCE) рассмотреть более строгий permission/policy gate.

---

## 17. Privacy Boundary — statusComment

`statusComment` может содержать чувствительную служебную информацию.

Hard boundary:

```text
INTERNAL ADMIN DATA
```

Не должен попадать:

```text
Buyer API
Partner API
public profile
public storefront
Marketplace listing
Communication messages
general CRM response without explicit internal permission
analytics dimensions
logs with uncontrolled exposure
```

Future implementation должен иметь negative disclosure tests.

---

## 18. Deactivation vs Erasure

Явно выделить отдельный future privacy/compliance concern:

```text
Account Deactivation ≠ Personal Data Erasure / Anonymization
```

Если в будущем появится GDPR/privacy workflow:

```text
legal retention
financial retention
fraud/security retention
audit retention
anonymization
deletion eligibility
```

Не использовать deactivation endpoint как data deletion endpoint.

---

## 19. Repository Gap Audit (Prerequisite)

Перед кодированием lifecycle необходимо проверить:

```text
User.status / isActive / deletedAt
Partner.status
PartnerStorefront.status
membership/employee status
Auth guards
JWT/refresh/session revocation
soft-delete patterns
AuditLog/EventBus
CRM Customer status
Booking/Order financial obligations
Product/listing publication state
```

Нельзя создавать новые enums/tables до такого gap audit.

---

## 20. Runtime Acceptance Gates (Future Step)

Будущая implementation НЕ может быть закрыта без runtime evidence для:

```text
ACTIVE user login allowed
SUSPENDED user login denied (HTTP + session revoked)
DEACTIVATED user login denied

unauthorized actor cannot suspend user
authorized actor can suspend with reason
OTHER without comment rejected
OTHER with comment accepted

statusChangedBy server-derived
status history appended
history cannot be overwritten by ordinary API

Partner A admin cannot deactivate Partner B
Partner suspension blocks new prohibited operations
existing historical orders/bookings remain
paid booking not silently cancelled
financial records preserved

Partner employee deactivation does not deactivate Partner business

statusComment absent from Buyer/Partner/public payloads
statusComment accessible only to authorized internal context

reactivation follows explicit transition policy
```

---

## 21. Roadmap Placement

Amendment добавляется как отдельный future implementation item.

Рекомендуемое название:

```text
USER / BUYER / PARTNER SUSPENSION & DEACTIVATION LIFECYCLE
```

Placement rules:

1. не renumber существующие steps;
2. явно обозначить `PLANNED`, не `DONE`;
3. не сделать его canonical NEXT автоматически, если roadmap sequencing требует другого шага;
4. если lifecycle является prerequisite для уже существующего future step — записать dependency;
5. сохранить Strict Review pairing.

Рекомендуемый placement: после текущих Marketing/Support steps, перед Storefront Business Capability steps, как cross-cutting governance infrastructure.

---

## 22. Implementation Prerequisites

```text
1. Repository gap audit (§19)
2. Architecture decision: status enum values
3. Architecture decision: transition rules
4. Architecture decision: reactivation policy
5. Architecture decision: transaction safety policy
6. Architecture decision: permission model
7. Architecture decision: statusComment privacy boundaries
```

Все 7 prerequisites должны быть закрыты до начала кодирования.

---

## 23. Dependency Notes

Lifecycle amendment НЕ блокирует текущие roadmap steps.

Текущий canonical NEXT (Step 3.9 — Marketing Center UI) НЕ зависит от lifecycle amendment.

Lifecycle amendment может стать prerequisite для:

```text
future Partner suspension/management steps
future Admin governance steps
future compliance/audit steps
```
