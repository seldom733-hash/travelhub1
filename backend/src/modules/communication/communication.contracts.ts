import type {
  CommunicationChannel,
  CommunicationContextType,
  CommunicationDirection,
  CommunicationParticipantType,
  CommunicationStatus,
  CommunicationType,
} from "../../generated/prisma/enums";

/**
 * PHASE 1 STEP 1.16 — Communication foundation contracts.
 *
 * DTO whitelist (§38): сериализуются ТОЛЬКО необходимые поля. Не сериализуются
 * actorUserId, requestId/correlationId, updatedAt, version, internal storage
 * metadata. Sender/recipient — typed refs (canonical ID + тип), без raw
 * User/CRM snapshot (§12/§22).
 */

export interface CommunicationParticipantRef {
  type: CommunicationParticipantType;
  /** canonical ID (может быть null у SYSTEM). */
  id: string | null;
}

/** Own-view (BUYER/PARTNER) режет internal USER ids (§38). */
export interface CommunicationDto {
  id: string;
  code: string;
  type: CommunicationType;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  status: CommunicationStatus;
  subject: string | null;
  body: string;
  contextType: CommunicationContextType | null;
  contextId: string | null;
  sender: CommunicationParticipantRef | null;
  recipient: CommunicationParticipantRef | null;
  occurredAt: string;
  createdAt: string;
}

export interface CommunicationListResult {
  items: CommunicationDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Server-side create contract (вход после DTO-валидации контроллера). */
export interface CreateCommunicationInput {
  type: CommunicationType;
  direction: CommunicationDirection;
  subject?: string;
  body: string;
  contextType: CommunicationContextType;
  contextId: string;
  sender?: { type: CommunicationParticipantType; id?: string };
  recipient?: { type: CommunicationParticipantType; id?: string };
}

/** Internal list filters (§40) — только реально поддерживаемые моделью. */
export interface CommunicationListQuery {
  contextType?: CommunicationContextType;
  contextId?: string;
  type?: CommunicationType;
  direction?: CommunicationDirection;
  page?: number;
  pageSize?: number;
}
