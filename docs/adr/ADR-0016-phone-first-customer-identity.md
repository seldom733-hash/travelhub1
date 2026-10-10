# ADR-0016 — Phone-First Customer Identity (supersedes ADR-0003 identity-key clause)

- **Status:** Принят · **Дата:** 2026-10-04
- **Домен:** security.* (Auth/Users) ↔ crm.* (Customer) ↔ integrations.whatsapp
- **Основание:** `docs/prompts/M4_PRE_CODING_ARCHITECTURE_DECISION.md` (решение владельца), `M4-PRE-IMPLEMENTATION-AUDIT.md` (verdict: READY WITH REQUIRED CHANGES)
- **Связанные:** ADR-0001 (ownership), ADR-0002 (auth/RBAC), **ADR-0003 (частично superseded — см. §1)**

## 1. Суперсессия ADR-0003

ADR-0003 утверждал:

> «канонический ключ — нормализованный email (`Customer.email` UNIQUE)» …
> «Имя/телефон — НЕ ключ связи» (ADR-0003, п. 2–3 «Решение»)

Настоящий ADR **явно изменяет этот пункт** с даты принятия:

```text
БЫЛО (ADR-0003):      email = канонический ключ идентичности Customer
СТАЛО (ADR-0016):     phone (E.164) = основной ключ резолюции идентичности Customer
                      email = контактный/профильный атрибут
```

Всё остальное ADR-0003 **сохраняет силу без изменений**:

- инвариант `ACTIVE BUYER ⇒ valid User.customerId ⇒ existing CRM Customer`;
- синхронная registration orchestration в одной транзакции (узкое исключение из ADR-0001, п. 1–5);
- CRM — единственный владелец `crm.Customer` (Auth пишет через `CrmService`);
- `CustomerCreated` → outbox; отсутствие startup backfill; явная repair-команда;
- forged `customerId` → 422; deactivation не удаляет Customer.

**Совместимость:** `Customer.email @unique` в M4 **сохраняется** (не ослабляется и не удаляется) — это временная мера совместимости, зафиксированная ниже. Уникальность email и первенство phone в резолюции не конфликтуют: email остаётся запретом на дубль, phone становится ключом поиска/связи.

## 2. Решение

### 2.1 Идентичность аутентификации

```text
User
 ├── loginPhone      ← основной login identity (E.164, nullable до миграции)
 ├── username        ← legacy compatibility identifier (НЕ удалять, НЕ репурпозить)
 ├── email           ← контакт/профиль (nullable, unique — как сейчас)
 ├── passwordHash
 └── customerId
```

- `loginPhone` — новая колонка `security.User`, `@unique`, nullable.
- Существующие пользователи продолжают входить по `username`.
- Новые аккаунты обязаны установить `loginPhone`.
- `username` не удаляется и не переиспользуется под телефон до отдельного deprecation-решения.

### 2.2 Резолюция идентичности Customer (общий Customer Resolver)

```text
Website | Guest Checkout | WhatsApp | Future channels
                    ↓
          Customer Resolver (channel-independent)
                    ↓
   0 phone matches → UNMATCHED
   1 phone match   → MATCHED
  >1 phone match   → AMBIGUOUS  (никогда не auto-link/auto-merge)
```

- Каноническое представление — один E.164 (`backend/src/shared/phone/phone.ts`, уже существует).
- **FIO — только verification/candidate signal.** Одинаковый FIO при разных phone НИКОГДА не вызывает автоматический merge.
- WhatsApp M3 извлекает resolver-логику из `backend/src/integrations/whatsapp/inbound/inbound.service.ts:77-108,463-488` с сохранением поведения 0/1/>1; M3 e2e (`backend/test/whatsapp-m3.e2e-spec.ts:369-440`) остаётся зелёным.
- Резолюция заканчивается на `customerId`; **phone сам по себе не становится owner'ом commerce** — `Request/Order/Booking.customerId` остаются единственным ownership-полем.

### 2.3 Предотвращение дублей Customer

```text
same canonical phone → same Customer identity candidate
```

- **НЕ** делать `Customer.phone @unique` вслепую — существующие данные содержат null/raw/разные форматы/дубли (аудит §3.2, D-фиксы).
- Допустимая стратегия (выбор по инспекции реальных данных перед миграцией): нормализованная колонка `Customer.phoneCanonical` + partial unique index, либо resolver-side dedup до записи.
- Существующие Customer'ы **не выдумывать и не merge'ить** автоматически; ambiguous — manual reconciliation path (как в ADR-0003 repair).

### 2.4 Регистрация (registered website)

Целевой состав: `country, phone, firstName, lastName, email, password`.

```text
Registration → normalize phone → Customer Resolver → Customer → User/BUYER
                                                          loginPhone = phone
```

- Существующие Customer/User переиспользуются, когда идентичность установлена — **без тихого дубля**.
- **Без тихого сброса пароля.**

### 2.5 Activation / OTP — решение владельца: **вариант B**

Инфраструктуры доставки нет (почта/SMS — аудит §12 D6). M4 реализует **механику идентичности/аккаунта activation-ready** и **явно откладывает доставку**:

- документируется как deferred;
- никаких небезопасных «фейковых» activation-кодов;
- никаких выдаваемых оператором постоянных временных паролей оператором клиентам;
- операторы **никогда** не создают/не хранят постоянные паролей клиентов (WhatsApp-first onboarding: предпочтительный activation — secure activation link, когда канал появится);
- остаёмся OTP/activation-ready (модель токена/эндпоинты без delivery-провайдера).

### 2.6 WhatsApp-first контакт

```text
WhatsApp phone → Customer Resolver → existing Customer?
   ├─ yes → verify FIO/reuse
   └─ no  → collect required data → re-check → Customer (+ опционально User)
```

- WhatsApp-first клиентов **не принуждать** к website-регистрации ради создания Customer.
- Account use — опционально.

### 2.7 Границы (не меняются)

```text
Customer ≠ User ≠ Traveler ≠ Payer      (ADR-0016 не изменяет)
```

- Traveler/Passenger существующей архитектуры не редизайнить.
- `Request/Order/Booking.customerId` — остаётся; phone в commerce-владение не переносится.
- Communication-история остаётся непрерывной; identity resolution ведёт к тому же Customer/context, а не к channel-specific потокам.
- Нотификационный слой остаётся channel-agnostic; `*Service` не связываются напрямую с WhatsApp.

### 2.8 Смена телефона (future-safe, не в M4-core)

```text
current auth → new phone verification → uniqueness check → update loginPhone
→ invalidate affected sessions/tokens → audit
```

Прямая незащищённая замена телефона запрещена.

### 2.9 Миграция существующих User (M4.1)

Учёт: legacy `username`; email-регистрации; admin (`username=admin`, `email=null`); User без Customer; `Customer.phone=null`; дубли/форматы телефонов.

- **Phone не выдумывать.**
- **Без merge по FIO.**
- Не каждый Customer получает `loginPhone` автоматически — только однозначный нормализуемый и уникальный phone.

## 3. M3 baseline (предусловие M4 — выполнено)

```text
M3 FINAL PASS → commit baseline → чистое рабочее дерево → M4
```

Коммит M3-базлайна выполнен 2026-10-04 с явной авторизацией владельца
(`2c75467 feat(whatsapp): M1-M3 Baileys integration with inbound chat` + 6
сопутствующих коммитов; рабочее дерево чистое). M4 не стакается на грязный baseline.

## 4. Последствия

- Новый ADR **обязателен** перед M4-кодом — конфликт A-29 ↔ ADR-0003 разрешён явно здесь, не в коде.
- M4 scope (core): phone-first identity, `User.loginPhone`, E.164-нормализация, общий resolver, phone-first onboarding, legacy login compatibility, duplicate prevention, WhatsApp на общем resolver, стратегия миграции, security/audit, regression tests.
- Sub-scopes (не предполагают существующей инфраструктуры): guest checkout, WhatsApp onboarding, activation/OTP delivery (deferred, §2.5), commerce Notification Layer.
- Порядок: M4.1 identity foundation → M4.2 resolver → M4.3 auth/registration → M4.4 WhatsApp → M4.5 guest checkout → M4.6 hardening.

## Альтернативы

- **Оставить email-канонику ADR-0003** — отклонено решением владельца (M4 target = phone-first).
- **Удалить email-уникальность в M4** — отклонено: ослабление `Customer.email @unique` требует отдельной миграционной оценки (см. §1 совместимость).
- **Сделать `Customer.phone` unique сразу** — отклонено: существующие multi-format дубли ломают миграцию (§2.3).
