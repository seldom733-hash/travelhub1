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

// ── Step 2.2E — pre-sale conversations (communication.CommunicationThread) ──

/**
 * Seller-safe identity для buyer-view (ADR-0005): НИКОГДА raw crm.Partner
 * UUID/legal/private. Та же семантика, что PublicSellerProfile projection.
 * HIDDEN/отсутствующий профиль → seller: null (консервативно).
 */
export interface PreSaleSellerIdentity {
  publicId: string;
  displayName: string | null;
  visibilityMode: "ANONYMOUS" | "VERIFIED_ALIAS" | "PUBLIC_BRAND";
  verified: boolean;
  memberSince: string;
  countryCode: string | null;
  cityCode: string | null;
}

/**
 * Step 2.2E — thread DTO.
 *  - Buyer-view: seller = PreSaleSellerIdentity (SELL-*), НЕ partnerId;
 *  - Seller-view: seller = null; контекст = requestCode (BRQ-*) — безопасный
 *    request-контекст БЕЗ buyer CRM PII (§16/§17/§42).
 * Никогда: buyerCustomerId/sellerPartnerId/memberIds/contact disclosure.
 */
export interface ReverseThreadDto {
  id: string;
  /** Канонический код потока (CML-*, тот же ID-домен, §18). */
  code: string;
  buyerRequestId: string;
  /** Код запроса (BRQ-*) — безопасный request-контекст. */
  requestCode: string;
  /** Trusted ref на reverse.SellerProposal (auto-attach; optional). */
  proposalId: string | null;
  /** Buyer-view: seller-safe identity; Seller-view: null (нет seller PII). */
  seller: PreSaleSellerIdentity | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReverseThreadListResult {
  items: ReverseThreadDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Step 2.2E — сообщение pre-sale чата (строки communication.Communication).
 * НИКАКИХ raw internal ids: sender/recipient заменены на side (BUYER/SELLER),
 * чтобы ни одна сторона не получала внутренние UUID другой (§16/§17).
 */
export interface ReverseMessageDto {
  id: string;
  /** Канонический код сообщения (CML-*). */
  code: string;
  body: string;
  subject: string | null;
  side: "BUYER" | "SELLER";
  occurredAt: string;
}

export interface ReverseMessageListResult {
  items: ReverseMessageDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
