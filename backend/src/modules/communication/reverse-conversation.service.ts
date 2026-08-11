import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ForbiddenError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { uniqueConstraintNames } from "../../shared/prisma-errors";
import { getRequestContext } from "../../shared/request-context";
import { isoUtc } from "../../shared/temporal";
import type { AuthUser } from "../../security/auth/auth.service";
import {
  CommunicationContextType,
  CommunicationParticipantType,
  CommunicationStatus,
  CommunicationType,
  RoleCode,
} from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import {
  assertValidPreSaleBody,
  assertValidPreSaleSubject,
  preSaleMessageDirection,
} from "./communication.validation";
import type {
  PreSaleSellerIdentity,
  ReverseMessageDto,
  ReverseMessageListResult,
  ReverseThreadDto,
  ReverseThreadListResult,
} from "./communication.contracts";

const PAGE_SIZE_MAX = 50;
const PAGE_SIZE_DEFAULT = 20;
const THREAD_ID_MAX = 64;

/**
 * PHASE 2 STEP 2.2E — Buyer Request / Proposal Communication (pre-sale chat).
 *
 * Владелец — communication.* (ADR-0011): CommunicationThread (room, CML-*) +
 * сообщения = строки communication.Communication (contextType=BUYER_REQUEST,
 * threadId). reverse.* остаётся владельцем BuyerRequest/Distribution/
 * SellerProposal (ADR-0012); чат — ТОЛЬКО trusted context refs, НЕ владеет
 * reverse lifecycle (никаких cross-context writes).
 *
 * Инварианты:
 *  - ровно один канонический разговор на (buyerRequestId, sellerPartnerId) —
 *    DB unique + get-or-create (retry/concurrent open → один поток, §19/§21);
 *  - membership НЕ таблица: ровно 2 участника — server-derived колонки
 *    (buyerCustomerId из request.buyerId; sellerPartnerId из distribution);
 *    клиент НЕ передаёт sellerId/buyerId/memberIds/ownerIds (§22/§27);
 *  - eligibility: Distribution prerequisite (open только для реально
 *    распределённого Seller-а); unmatched Seller → neutral 422 (анти-
 *    enumeration, §6); Buyer — только СВОИ request (neutral 404, §8);
 *  - cross-Seller isolation: thread пер-селлер; Seller A не видит/не пишет
 *    в thread B (neutral 404), не может вывести существование (§7);
 *  - request state: open/send re-read ЖИВОЙ reverse.BuyerRequest.status
 *    (FOR UPDATE внутри tx, §31): CANCELLED блокирует новые сообщения,
 *    история durable (§11); DRAFT — не open (нет distribution);
 *  - Proposal WITHDRAWN НЕ блокирует переписку (request — primary context),
 *    CML-история не удаляется (§12); Proposal НЕ мутируется чатом (§37);
 *  - CONTACT DISCLOSED остаётся недостижимым через чат: body/subject —
 *    anti-disintermediation (shared/anti-disintermediation.ts), §13/§14;
 *  - message authorship — строго из actor (senderType/senderId server-derived,
 *    §28); IDOR: каждый read/send проверяет membership (neutral 404, §29/§30);
 *  - zero fan-out: open/send не создают Lead/Opportunity/Quote/Sale/Order/
 *    Booking/Product/Payment/Availability (§38/§41); acquisition source не
 *    меняется (§40); события НЕ эмитятся (конвенция ADR-0011 §19/§34);
 *  - аудит: security.AuditLog (без body — PII minimization, §35).
 */
@Injectable()
export class ReverseConversationService {
  private readonly logger = new Logger(ReverseConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  // ── Gates ─────────────────────────────────────────────────────────────

  /** Gate: строго BUYER + customerId. Возвращает канонический customerId. */
  private async assertBuyer(actor: AuthUser): Promise<string> {
    if (actor.role !== RoleCode.BUYER) {
      throw new ForbiddenError("Only BUYER can open pre-sale conversations as the request owner");
    }
    if (!actor.customerId) {
      throw new ForbiddenError("Buyer is not mapped to a CRM customer; pre-sale conversations are not allowed");
    }
    return actor.customerId;
  }

  /** Gate: строго PARTNER + partnerId + CRM Partner ACTIVE. Возвращает partnerId. */
  private async assertSeller(actor: AuthUser): Promise<string> {
    if (actor.role !== RoleCode.PARTNER) {
      throw new ForbiddenError("Only PARTNER (Seller) can open pre-sale conversations for distributed requests");
    }
    if (!actor.partnerId) {
      throw new ForbiddenError("Partner onboarding is not approved: pre-sale conversations are not available");
    }
    const partner = await this.prisma.partner.findUnique({
      where: { id: actor.partnerId },
      select: { status: true },
    });
    if (!partner || partner.status !== "ACTIVE") {
      throw new ForbiddenError("CRM partner is not ACTIVE; pre-sale conversations denied");
    }
    return actor.partnerId;
  }

  /** Сторона actor (BUYER | SELLER); другие роли сюда не попадают (permission gate). */
  private async assertPeer(actor: AuthUser): Promise<{ side: "BUYER" | "SELLER"; id: string }> {
    if (actor.role === RoleCode.BUYER) {
      return { side: "BUYER", id: await this.assertBuyer(actor) };
    }
    if (actor.role === RoleCode.PARTNER) {
      return { side: "SELLER", id: await this.assertSeller(actor) };
    }
    throw new ForbiddenError("Pre-sale conversations are available only to BUYER and PARTNER");
  }

  /**
   * Buyer-путь: sellerPublicId (SELL-*) → crm.Partner id через
   * catalog.PublicSellerProfile (read-only, ADR-0001). HIDDEN/отсутствующий
   * профиль → 422 нейтрально (не раскрываем request/distribution).
   */
  private async resolveSellerByPublicId(publicId: string): Promise<string> {
    if (typeof publicId !== "string" || publicId.trim().length === 0 || publicId.length > 32) {
      throw new ValidationDomainError("sellerPublicId must be a valid SELL-* public seller id");
    }
    const profile = await this.prisma.publicSellerProfile.findUnique({
      where: { publicId: publicId.trim() },
      select: { partnerId: true, status: true },
    });
    if (!profile || profile.status !== "APPROVED") {
      // HIDDEN/unknown — идентичность не раскрывается, чат невозможен.
      throw new ValidationDomainError("Unknown seller identity; conversation cannot be opened");
    }
    return profile.partnerId;
  }

  /** Own-scope thread lookup по membership (neutral 404, §29). */
  private async findThreadForMember(threadId: string, actor: { side: "BUYER" | "SELLER"; id: string }) {
    const thread = await this.prisma.communicationThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundError("Conversation not found");
    const isMember =
      actor.side === "BUYER" ? thread.buyerCustomerId === actor.id : thread.sellerPartnerId === actor.id;
    if (!isMember) throw new NotFoundError("Conversation not found");
    return thread;
  }

  /** Сериализация cancel-vs-open/send: FOR UPDATE на reverse.BuyerRequest. */
  private async lockRequestStatus(tx: Prisma.TransactionClient, buyerRequestId: string): Promise<string> {
    const rows = await tx.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT status FROM reverse."BuyerRequest" WHERE id = $1 FOR UPDATE`,
      buyerRequestId,
    );
    return rows[0]?.status ?? "MISSING";
  }

  // ── Projections ───────────────────────────────────────────────────────

  /** Seller-safe identity (ADR-0005): та же семантика, что proposals.service. */
  private toPublicSeller(p: {
    publicId: string;
    status: string;
    visibilityMode: string;
    publicDisplayName: string | null;
    countryCode: string | null;
    cityCode: string | null;
    verified: boolean;
    memberSince: Date;
  }): PreSaleSellerIdentity {
    const mode = (["ANONYMOUS", "VERIFIED_ALIAS", "PUBLIC_BRAND"] as const).includes(
      p.visibilityMode as "ANONYMOUS" | "VERIFIED_ALIAS" | "PUBLIC_BRAND",
    )
      ? (p.visibilityMode as "ANONYMOUS" | "VERIFIED_ALIAS" | "PUBLIC_BRAND")
      : "ANONYMOUS";
    return {
      publicId: p.publicId,
      displayName: mode === "ANONYMOUS" ? null : (p.publicDisplayName ?? null),
      visibilityMode: mode,
      verified: p.verified,
      memberSince: isoUtc(p.memberSince),
      countryCode: p.countryCode,
      cityCode: p.cityCode,
    };
  }

  private toThreadDto(
    thread: { id: string; code: string; buyerRequestId: string; proposalId: string | null; createdAt: Date; updatedAt: Date },
    requestCode: string,
    seller: PreSaleSellerIdentity | null,
  ): ReverseThreadDto {
    return {
      id: thread.id,
      code: thread.code,
      buyerRequestId: thread.buyerRequestId,
      requestCode,
      proposalId: thread.proposalId,
      seller,
      createdAt: isoUtc(thread.createdAt),
      updatedAt: isoUtc(thread.updatedAt),
    };
  }

  private toMessageDto(row: {
    id: string;
    code: string;
    body: string;
    subject: string | null;
    senderType: string | null;
    occurredAt: Date;
  }): ReverseMessageDto {
    return {
      id: row.id,
      code: row.code,
      body: row.body,
      subject: row.subject,
      side: row.senderType === CommunicationParticipantType.CUSTOMER ? "BUYER" : "SELLER",
      occurredAt: isoUtc(row.occurredAt),
    };
  }

  // ── Open (get-or-create) ──────────────────────────────────────────────

  /**
   * Открывает канонический pre-sale conversation (BuyerRequest + Buyer +
   * Seller [+ Proposal]). Idempotent: повторный/конкурентный open сходится к
   * тому же потоку (DB unique + P2002 → re-read, §21/§32).
   * Trigger: явная команда Buyer-а или Seller-а (НЕ auto-создание при
   * distribution/proposal — никаких ретроактивных side effects, §20).
   */
  async open(actor: AuthUser, input: { buyerRequestId: string; sellerPublicId?: string }): Promise<ReverseThreadDto> {
    const peer = await this.assertPeer(actor);
    let sellerPartnerId: string;
    if (peer.side === "BUYER") {
      if (input.sellerPublicId === undefined) {
        throw new ValidationDomainError("sellerPublicId is required to open a conversation with a specific Seller");
      }
      sellerPartnerId = await this.resolveSellerByPublicId(input.sellerPublicId);
    } else {
      if (input.sellerPublicId !== undefined) {
        throw new ValidationDomainError("sellerPublicId is not allowed for a Seller (identity is server-derived)");
      }
      sellerPartnerId = peer.id;
    }

    if (typeof input.buyerRequestId !== "string" || input.buyerRequestId.trim().length === 0 || input.buyerRequestId.length > THREAD_ID_MAX) {
      throw new ValidationDomainError("buyerRequestId must be a canonical id");
    }

    // Buyer: request обязан принадлежать actor (neutral 404, §8).
    // Seller: несуществующий request → neutral 422 (та же анти-enumeration
    // конвенция, что resolveDistribution в 2.2D: 404/422 не различают «UUID не
    // существует» и «не распределён мне» для внешнего Seller-а).
    const request = await this.prisma.buyerRequest.findUnique({
      where: { id: input.buyerRequestId },
      select: { id: true, code: true, buyerId: true, status: true },
    });
    if (!request) {
      if (peer.side === "BUYER") throw new NotFoundError("Buyer request not found");
      throw new ValidationDomainError(
        "This BuyerRequest was not distributed to your seller account; conversation cannot be opened",
      );
    }
    if (peer.side === "BUYER" && request.buyerId !== peer.id) {
      throw new NotFoundError("Buyer request not found");
    }
    if (request.status !== "SUBMITTED") {
      throw new ValidationDomainError(
        `BuyerRequest is not open for conversation (current: ${request.status}); only SUBMITTED requests are open`,
      );
    }

    // Distribution prerequisite (анти-enumeration: отсутствие → 422 нейтрально, §6).
    // Предусловие проверяется до транзакции (в 2.2C flow revocation отсутствует —
    // распределения не отзываются; поток создаётся только на распределённый
    // request, а send пере-проверяет ЖИВОЙ request.status в транзакции).
    const dist = await this.prisma.buyerRequestDistribution.findFirst({
      where: { buyerRequestId: request.id, sellerId: sellerPartnerId },
      select: { id: true },
    });
    if (!dist) {
      throw new ValidationDomainError(
        "This BuyerRequest was not distributed to this Seller; conversation cannot be opened",
      );
    }

    // Proposal ref (optional, trusted): auto-attach если Proposal уже есть
    // (тот же request + тот же seller; только направленные — SUBMITTED/WITHDRAWN).
    const proposal = await this.prisma.sellerProposal.findFirst({
      where: { buyerRequestId: request.id, sellerId: sellerPartnerId, status: { in: ["SUBMITTED", "WITHDRAWN"] } },
      select: { id: true },
      orderBy: { submittedAt: "desc" },
    });

    // Idempotent get-or-create с retry: DB unique гарантирует один поток.
    //  - фор-чек существования ВНУТРИ tx (до create) — обычный повторный open;
    //  - конкурентный create всё же может дать P2002 → PostgreSQL абортит
    //    транзакцию (25P02), поэтому ПРОДОЛЖАТЬ tx после P2002 нельзя — вместо
    //    этого внешний retry-цикл запускает НОВУЮ транзакцию (сходится к уже
    //    созданному потоку на следующей итерации, §21/§32);
    //  - FOR UPDATE на request сериализует cancel-vs-open (та же техника, что
    //    2.2C/2.2D): cancel до нас → 422; open первый → поток durable.
    let created = false;
    let thread: {
      id: string;
      code: string;
      buyerRequestId: string;
      sellerPartnerId: string;
      proposalId: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    for (let attempt = 0; ; attempt++) {
      try {
        thread = await this.prisma.$transaction(async (tx) => {
          const status = await this.lockRequestStatus(tx, request.id);
          if (status !== "SUBMITTED") {
            throw new ValidationDomainError(
              `BuyerRequest is no longer open for conversation (${status}); no conversation committed`,
            );
          }
          const existing = await tx.communicationThread.findFirst({
            where: { buyerRequestId: request.id, sellerPartnerId },
          });
          if (existing) return existing;
          const code = await this.ids.nextCode(tx, "CML");
          const row = await tx.communicationThread.create({
            data: {
              code,
              buyerRequestId: request.id,
              buyerCustomerId: request.buyerId,
              sellerPartnerId,
              proposalId: proposal?.id ?? null,
            },
          });
          created = true;
          await this.security.audit(tx, {
            userId: actor.id,
            username: actor.username,
            action: "conversation.opened",
            resource: "CommunicationThread",
            resourceId: row.id,
            details: { code: row.code, buyerRequestId: request.id, sellerId: sellerPartnerId, openedBy: peer.side },
          });
          return row;
        });
        break;
      } catch (err) {
        const names = uniqueConstraintNames(err);
        if (attempt < 2 && names.some((n) => n.toLowerCase().includes("buyerrequestid"))) {
          continue; // конкурентный create — retry новой транзакцией (сходится к существующему)
        }
        throw err;
      }
    }

    if (created) {
      this.logger.log(`CommunicationThread ${thread.code} opened for buyer request ${request.id} (${peer.side})`);
    }
    const sellerIdentity = peer.side === "BUYER" ? await this.sellerIdentityFor(thread.sellerPartnerId) : null;
    return this.toThreadDto(thread, request.code, sellerIdentity);
  }

  // ── List (own-scope) ──────────────────────────────────────────────────

  async list(actor: AuthUser, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<ReverseThreadListResult> {
    const peer = await this.assertPeer(actor);
    const p = Math.max(1, page);
    const ps = Math.min(PAGE_SIZE_MAX, Math.max(1, pageSize));
    const where =
      peer.side === "BUYER" ? { buyerCustomerId: peer.id } : { sellerPartnerId: peer.id };

    const [items, total] = await Promise.all([
      this.prisma.communicationThread.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], // deterministic (§43)
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.communicationThread.count({ where }),
    ]);
    if (items.length === 0) {
      return { items: [], total, page: p, pageSize: ps, hasMore: false };
    }
    const codes = await this.requestCodes(items.map((t) => t.buyerRequestId));
    const sellers =
      peer.side === "BUYER"
        ? await this.sellerIdentityMap(items.map((t) => t.sellerPartnerId))
        : new Map<string, PreSaleSellerIdentity>();
    return {
      items: items.map((t) => this.toThreadDto(t, codes.get(t.buyerRequestId) ?? "", sellers.get(t.sellerPartnerId) ?? null)),
      total,
      page: p,
      pageSize: ps,
      hasMore: p * ps < total,
    };
  }

  // ── Detail ────────────────────────────────────────────────────────────

  async get(actor: AuthUser, threadId: string): Promise<ReverseThreadDto> {
    const peer = await this.assertPeer(actor);
    const thread = await this.findThreadForMember(threadId, peer);
    const request = await this.prisma.buyerRequest.findUnique({
      where: { id: thread.buyerRequestId },
      select: { code: true },
    });
    const sellerIdentity = peer.side === "BUYER" ? await this.sellerIdentityFor(thread.sellerPartnerId) : null;
    return this.toThreadDto(thread, request?.code ?? "", sellerIdentity);
  }

  // ── Messages ──────────────────────────────────────────────────────────

  async listMessages(actor: AuthUser, threadId: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<ReverseMessageListResult> {
    const peer = await this.assertPeer(actor);
    await this.findThreadForMember(threadId, peer); // membership gate (neutral 404)
    const p = Math.max(1, page);
    const ps = Math.min(PAGE_SIZE_MAX, Math.max(1, pageSize));
    const where = { threadId };
    const [items, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        orderBy: [{ occurredAt: "asc" }, { code: "asc" }], // хронология чата (§43)
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.communication.count({ where }),
    ]);
    return {
      items: items.map((m) => this.toMessageDto(m)),
      total,
      page: p,
      pageSize: ps,
      hasMore: p * ps < total,
    };
  }

  async send(
    actor: AuthUser,
    threadId: string,
    input: { body: string; subject?: string },
  ): Promise<ReverseMessageDto> {
    const peer = await this.assertPeer(actor);
    const thread = await this.findThreadForMember(threadId, peer);

    // Контент: plain text + анти-disintermediation (CHAT EXISTS ≠ CONTACT DISCLOSED).
    assertValidPreSaleBody(input.body);
    assertValidPreSaleSubject(input.subject);

    const senderType =
      peer.side === "BUYER" ? CommunicationParticipantType.CUSTOMER : CommunicationParticipantType.PARTNER;
    const senderId = peer.id;
    const recipientType =
      peer.side === "BUYER" ? CommunicationParticipantType.PARTNER : CommunicationParticipantType.CUSTOMER;
    const recipientId =
      peer.side === "BUYER" ? thread.sellerPartnerId : thread.buyerCustomerId;

    const row = await this.prisma.$transaction(async (tx) => {
      // Serialize cancel-vs-send (§31): re-read ЖИВОЙ reverse state. Если cancel
      // закоммичен — CANCELLED → 422 (нет новых сообщений, история durable).
      const status = await this.lockRequestStatus(tx, thread.buyerRequestId);
      if (status !== "SUBMITTED") {
        throw new ValidationDomainError(
          `BuyerRequest is no longer open for messaging (${status}); message not committed`,
        );
      }
      const ctx = getRequestContext();
      const now = new Date();
      const code = await this.ids.nextCode(tx, "CML");
      const message = await tx.communication.create({
        data: {
          code,
          type: CommunicationType.MESSAGE,
          channel: "PLATFORM",
          direction: preSaleMessageDirection(peer.side),
          status: CommunicationStatus.ACTIVE,
          subject: input.subject ?? null,
          body: input.body,
          contextType: CommunicationContextType.BUYER_REQUEST,
          contextId: thread.buyerRequestId,
          threadId: thread.id,
          actorUserId: actor.id,
          senderType,
          senderId,
          recipientType,
          recipientId,
          occurredAt: now,
          createdAt: now,
          requestId: ctx?.requestId ?? null,
          correlationId: ctx?.correlationId ?? null,
        },
        select: { id: true, code: true, body: true, subject: true, senderType: true, occurredAt: true },
      });
      // Audit БЕЗ body (PII minimization, §35).
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "conversation.message.sent",
        resource: "Communication",
        resourceId: message.id,
        details: { code: message.code, threadId: thread.id, buyerRequestId: thread.buyerRequestId, side: peer.side },
      });
      return message;
    });

    return this.toMessageDto(row);
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private async requestCodes(ids: string[]): Promise<Map<string, string>> {
    const rows = await this.prisma.buyerRequest.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, code: true },
    });
    return new Map(rows.map((r) => [r.id, r.code]));
  }

  /** Seller identity для одного partnerId (APPROVED only; HIDDEN → null). */
  private async sellerIdentityFor(partnerId: string): Promise<PreSaleSellerIdentity | null> {
    return (await this.sellerIdentityMap([partnerId])).get(partnerId) ?? null;
  }

  private async sellerIdentityMap(partnerIds: string[]): Promise<Map<string, PreSaleSellerIdentity>> {
    const unique = [...new Set(partnerIds)];
    if (unique.length === 0) return new Map();
    const profiles = await this.prisma.publicSellerProfile.findMany({ where: { partnerId: { in: unique } } });
    const out = new Map<string, PreSaleSellerIdentity>();
    for (const p of profiles) {
      if (p.status !== "APPROVED") continue; // HIDDEN — идентичность не показывается
      out.set(p.partnerId, this.toPublicSeller(p));
    }
    return out;
  }
}
