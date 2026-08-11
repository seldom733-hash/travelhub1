import {
  CommunicationContextType,
  CommunicationDirection,
  CommunicationParticipantType,
  CommunicationType,
} from "../../generated/prisma/enums";
import { ValidationDomainError } from "../../shared/errors";
import { assertNoContactText } from "../../shared/anti-disintermediation";

/**
 * PHASE 1 STEP 1.16 — чистые валидаторы Communication (unit-testable, без Nest).
 *
 * Правила:
 *  - body: plain text, 1..4000, БЕЗ arbitrary HTML/control chars (§14/§50);
 *  - subject: ≤200, без HTML;
 *  - NOTE ⇒ direction=INTERNAL (внутренняя заметка персонала, §36);
 *  - MESSAGE ⇒ direction INBOUND/OUTBOUND (не INTERNAL);
 *  - contextType/contextId обязательны (server-side existence check в сервисе);
 *  - participants: typed refs, SYSTEM без id, USER/CUSTOMER/PARTNER с id;
 *    NOTE не может иметь recipient (INTERNAL — без внешней стороны).
 */

export const COMMUNICATION_BODY_MAX = 4000;
export const COMMUNICATION_SUBJECT_MAX = 200;
export const COMMUNICATION_ID_MAX = 64;

/** Поля, которые клиент НИКОГДА не может передать при create (§4/§26/§35). */
export const COMMUNICATION_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "status",
  "actorUserId",
  "actorId",
  "createdBy",
  "createdById",
  "senderUserId",
  "recipientUserId",
  "createdAt",
  "updatedAt",
  "occurredAt",
  "requestId",
  "correlationId",
  "version",
  "ownerId",
  "customerId",
  "partnerId",
  "system",
  "isSystem",
] as const;

/** Запрещён ли контент (HTML/JS/control chars) — XSS-safe (§14/§50). */
export function hasForbiddenContent(text: string): boolean {
  // Arbitrary HTML/JS: любые теги. Плюс control chars (кроме \n\r\t — переносы
  // строк допустимы в plain text) и невидимые zero-width манипуляции.
  return (
    /<[a-zA-Z/][^>]*>/.test(text) ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)
  );
}

/** Проверка body: throws ValidationDomainError при нарушении. */
export function assertValidCommunicationBody(body: string): void {
  if (typeof body !== "string" || body.trim().length === 0) {
    throw new ValidationDomainError("Communication body must be a non-empty string");
  }
  if (body.length > COMMUNICATION_BODY_MAX) {
    throw new ValidationDomainError(`Communication body must be at most ${COMMUNICATION_BODY_MAX} characters`);
  }
  if (hasForbiddenContent(body)) {
    throw new ValidationDomainError("Communication body must be plain text without HTML or control characters");
  }
}

/** Проверка subject (optional): ≤200, без HTML/control chars. */
export function assertValidCommunicationSubject(subject: string | undefined): void {
  if (subject === undefined) return;
  if (typeof subject !== "string" || subject.length > COMMUNICATION_SUBJECT_MAX) {
    throw new ValidationDomainError(`Communication subject must be at most ${COMMUNICATION_SUBJECT_MAX} characters`);
  }
  if (hasForbiddenContent(subject)) {
    throw new ValidationDomainError("Communication subject must be plain text without HTML or control characters");
  }
}

/**
 * Семантические правила type/direction (§6/§8/§36):
 *  - NOTE → INTERNAL (и только);
 *  - MESSAGE → INBOUND/OUTBOUND;
 *  - SUPPORT_MESSAGE не вводится (Support domain не реализован, §30).
 */
export function assertDirectionMatchesType(type: CommunicationType, direction: CommunicationDirection): void {
  if (type === CommunicationType.NOTE && direction !== CommunicationDirection.INTERNAL) {
    throw new ValidationDomainError("NOTE communication must have direction INTERNAL");
  }
  if (type === CommunicationType.MESSAGE && direction === CommunicationDirection.INTERNAL) {
    throw new ValidationDomainError("MESSAGE communication cannot have direction INTERNAL");
  }
}

/** Participant shape (§12): SYSTEM без id; USER/CUSTOMER/PARTNER — с non-empty id. */
export function assertValidParticipant(participant: { type: CommunicationParticipantType; id?: string } | undefined): void {
  if (!participant) return;
  const { type, id } = participant;
  if (!Object.values(CommunicationParticipantType).includes(type)) {
    throw new ValidationDomainError(`Unsupported participant type: ${String(type)}`);
  }
  if (type === CommunicationParticipantType.SYSTEM) return; // без id
  if (typeof id !== "string" || id.trim().length === 0 || id.length > COMMUNICATION_ID_MAX) {
    throw new ValidationDomainError(`Participant of type ${type} requires a canonical id`);
  }
}

/** NOTE не может иметь recipient (INTERNAL — без внешней стороны). */
export function assertNoteHasNoRecipient(
  type: CommunicationType,
  recipient: { type: CommunicationParticipantType; id?: string } | undefined,
): void {
  if (type === CommunicationType.NOTE && recipient) {
    throw new ValidationDomainError("NOTE communication cannot have a recipient");
  }
}

/**
 * STRICT REVIEW FIX (impersonation policy, §7/§24): явный policy direction ↔
 * participants. Internal staff фиксируют внешние факты «от имени» Customer/
 * Partner ТОЛЬКО с сохранением actor (audit) и direction-валидацией:
 *
 *  - NOTE (INTERNAL): sender — внутренний USER (по умолчанию actor); recipient
 *    отсутствует;
 *  - MESSAGE INBOUND: sender — внешняя сторона (CUSTOMER|PARTNER), recipient —
 *    внутренний USER (по умолчанию actor). Нельзя «входящее от персонала»;
 *  - MESSAGE OUTBOUND: sender — внутренний USER (по умолчанию actor), recipient
 *    — внешняя сторона (CUSTOMER|PARTNER). Нельзя «исходящее от клиента»;
 *  - SYSTEM участник НЕ может быть задан через HTTP create (системные факты
 *    пока не создаются; SYSTEM — reserved, §7 матрица #23).
 */
export function assertDirectionParticipantPolicy(input: {
  type: CommunicationType;
  direction: CommunicationDirection;
  sender?: { type: CommunicationParticipantType; id?: string };
  recipient?: { type: CommunicationParticipantType; id?: string };
}): void {
  const { type, direction, sender, recipient } = input;

  if (type === CommunicationType.NOTE) {
    if (sender && sender.type !== CommunicationParticipantType.USER) {
      throw new ValidationDomainError("NOTE sender must be an internal USER");
    }
    return;
  }

  if (direction === CommunicationDirection.INBOUND) {
    if (!sender) {
      throw new ValidationDomainError("INBOUND MESSAGE requires an external sender (CUSTOMER or PARTNER)");
    }
    if (sender.type !== CommunicationParticipantType.CUSTOMER && sender.type !== CommunicationParticipantType.PARTNER) {
      throw new ValidationDomainError("INBOUND MESSAGE sender must be CUSTOMER or PARTNER");
    }
    if (recipient && recipient.type !== CommunicationParticipantType.USER) {
      throw new ValidationDomainError("INBOUND MESSAGE recipient must be an internal USER");
    }
    return;
  }

  // OUTBOUND
  if (sender && sender.type !== CommunicationParticipantType.USER) {
    throw new ValidationDomainError("OUTBOUND MESSAGE sender must be an internal USER");
  }
  if (!recipient) {
    throw new ValidationDomainError("OUTBOUND MESSAGE requires a recipient (CUSTOMER or PARTNER)");
  }
  if (recipient.type !== CommunicationParticipantType.CUSTOMER && recipient.type !== CommunicationParticipantType.PARTNER) {
    throw new ValidationDomainError("OUTBOUND MESSAGE recipient must be CUSTOMER or PARTNER");
  }
}

/** STRICT REVIEW FIX: SYSTEM participant нельзя задать через HTTP create. */
export function assertNoSystemParticipantFromHttp(participants: Array<{ type: CommunicationParticipantType; id?: string } | undefined>): void {
  for (const p of participants) {
    if (p && p.type === CommunicationParticipantType.SYSTEM) {
      throw new ValidationDomainError("SYSTEM participant cannot be set via API (reserved for system-originated facts)");
    }
  }
}

/**
 * Step 2.2E — pre-sale chat: направление сообщения по стороне автора.
 * Для BUYER_REQUEST thread-сообщений direction отражает платформенный поток
 * от requester-стороны (НЕ staff-семантику create-эндпоинта):
 *  - автор BUYER (CUSTOMER) → INBOUND;
 *  - автор SELLER (PARTNER) → OUTBOUND.
 * Детерминированное server-side правило; клиент не передаёт direction.
 */
export function preSaleMessageDirection(senderSide: "BUYER" | "SELLER"): CommunicationDirection {
  return senderSide === "BUYER" ? CommunicationDirection.INBOUND : CommunicationDirection.OUTBOUND;
}

/**
 * Step 2.2E — pre-sale chat body: reuse base-валидатора (1..4000, plain text,
 * без HTML/control chars) ПЛЮС анти-disintermediation — CHAT EXISTS ≠ CONTACT
 * DISCLOSED (Roadmap Amend 3.37B). Обнаружение контакта/URL → 422 (loud).
 * НЕ DLP: базовая regex-защита, ограничение документировано.
 */
export function assertValidPreSaleBody(body: string): void {
  assertValidCommunicationBody(body);
  assertNoContactText("message body", body);
}

/** Step 2.2E — pre-sale chat subject (optional): ≤200, plain text, анти-disintermediation. */
export function assertValidPreSaleSubject(subject: string | undefined): void {
  if (subject === undefined) return;
  assertValidCommunicationSubject(subject);
  assertNoContactText("message subject", subject);
}

/** Context: обязателен на foundation (каждая Communication привязана к business context). */
export function assertValidContext(contextType: CommunicationContextType, contextId: string): void {
  if (!Object.values(CommunicationContextType).includes(contextType)) {
    throw new ValidationDomainError(`Unsupported context type: ${String(contextType)}`);
  }
  if (typeof contextId !== "string" || contextId.trim().length === 0 || contextId.length > COMMUNICATION_ID_MAX) {
    throw new ValidationDomainError("Context id must be a non-empty canonical id");
  }
}

/** Context id строка (для query-фильтра внутреннего списка). */
export function isValidContextId(id: string): boolean {
  return typeof id === "string" && id.trim().length > 0 && id.length <= COMMUNICATION_ID_MAX;
}
