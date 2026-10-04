# M0-05. Решение по нейтральному статусу Communication до отправки (D6)

Обязательный артефакт M0 (§8, п.5). Проверено по коду:

```prisma
// backend/prisma/schema.prisma:2684-2689
enum CommunicationStatus {
  ACTIVE
  ARCHIVED
  @@schema("communication")
}
```

- Статуса «создано, ожидает отправки» / «в очереди» / «отправлено» **нет**.
- `ARCHIVED` зарезервирован под retention/privacy flow (ADR-0011 Amendment §5,
  комментарий `:2681-2683`), `READ/DELIVERED` сознательно не объявлены («нет фактических
  receipts», `:2680`).
- `Communication.status` default `ACTIVE` (`schema.prisma:2729`), индекс
  `@@index([direction, status])` (`:2774`) — значение читается существующими клиентами.

## Решение

1. **`CommunicationStatus` не расширять** (I11: канонический enum менять только с
   архитектурным обоснованием; I6: WhatsApp-специфика не должна протекать в canonical-модель).
2. **Нейтральный pre-send статус = `ACTIVE`.** `Communication` создаётся **до**
   вызова `provider.send()` с `channel=WHATSAPP`, `direction=OUTBOUND`, `status=ACTIVE` —
   это «факт коммуникации записан», а не «сообщение отправлено». Семантика
   ACTIVE/ARCHIVED = «живая/архивная переписка», что не утверждает доставки.
3. **Полный outbound-lifecycle хранится только в integration-слое** —
   `whatsapp.WhatsAppOutboundMessage.status` (CREATED → QUEUED → SENDING → SENT →
   (DELIVERED | READ) / FAILED_RETRYABLE / FAILED_PERMANENT / UNKNOWN),
   модель описана в M0-02 «Модель данных».
4. **`SENT/DELIVERED/READ` в `Communication` не пишутся никогда** — только по подтверждению
   провайдера, и то лишь в `whatsapp.*` providerStatus (I11: не выдумывать receipts;
   UI-индикатор статуса читает integration-метаданные, а не `CommunicationStatus`).
5. Запись `Communication` + outbound-lifecycle происходит **атомарно в одной транзакции с
   operation key до provider call**, чтобы попытка отправки не существовала только в
   памяти процесса (D6). Crash в `SENDING` → при восстановлении `UNKNOWN` (автоповтор
   запрещён), recovery — `Reconcile | Mark failed | Retry anyway`.

## Альтернативы (отклонены)

| Альтернатива | Почему отклонена |
|---|---|
| Добавить `PENDING/SENDING/SENT` в `CommunicationStatus` | меняет канонический enum без необходимости; ломает контракт «статус = lifecycle переписки» (ADR-0011 §9) и существующих потребителей/индексов; смешивает provider-состояние с бизнес-фактом (§6.2 «состояние соединения не смешивается со статусом Communication») |
| Не создавать `Communication` до подтверждения отправки | нарушает D6 (canonical факт + snapshot должны быть до `send()`), ретрай не сможет отправить сохранённый текст, возможна потеря попытки при crash |
| Новый `CommunicationType = WHATSAPP_MESSAGE` | тип ≠ статус; канал уже адресуется полем `channel` |

## Последствия

- `whatsapp.*` — единственный источник истины по доставке; `Communication` остаётся
  каноническим фактом (I2: текст/бизнес-контекст — только там, metadata — в `whatsapp.*`).
- UI индикатора статуса сообщения читает данные, отдаваемые whatsapp-API/Communication-extension,
  не `Communication.status`.
- Существующие тесты/код, полагающиеся на `ACTIVE`, не затрагиваются (значение не меняется).

Статус: предложено, утверждается Gate M0 вместе с остальными решениями (M0-02 §D6).
