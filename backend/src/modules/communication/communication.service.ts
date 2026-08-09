import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { NotFoundError, ValidationDomainError } from "../../shared/errors";
import { getRequestContext } from "../../shared/request-context";
import { isoUtc } from "../../shared/temporal";
import {
  CommunicationContextType,
  CommunicationDirection,
  CommunicationParticipantType,
  CommunicationStatus,
  CommunicationType,
  RoleCode,
} from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
import type { Communication } from "../../generated/prisma/client";
import type {
  CommunicationDto,
  CommunicationListQuery,
  CommunicationListResult,
  CreateCommunicationInput,
} from "./communication.contracts";
import {
  assertDirectionMatchesType,
  assertDirectionParticipantPolicy,
  assertNoSystemParticipantFromHttp,
  assertNoteHasNoRecipient,
  assertValidCommunicationBody,
  assertValidCommunicationSubject,
  assertValidContext,
  assertValidParticipant,
} from "./communication.validation";

const PAGE_SIZE_MAX = 50;
const PAGE_SIZE_DEFAULT = 20;

/**
 * PHASE 1 STEP 1.16 — Communication foundation service.
 *
 * Владелец Communication — communication.* (новый bounded context, ADR-0011).
 *  - create: internal staff (permission communication.create); context existence
 *    и participants проверяются server-side (cross-domain READ по ID, ADR-0001);
 *  - объектный scope: BUYER — context CUSTOMER == actor.customerId, PARTNER —
 *    context PARTNER == actor.partnerId; только не-NOTE/не-INTERNAL (§31/§32);
 *  - NOTE (внутренняя заметка) никогда не отдаётся BUYER/PARTNER (§36);
 *  - audit create без body (§20/§21); бизнес-событие НЕ создаётся (нет
 *    consumer-а, §19); occurredAt = server now (client-supplied не принимается,
 *    §16/§17); requestId/correlationId — reference из request context (§18).
 */
@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  /* ── Create ─────────────────────────────────────────────────────────────── */

  async create(input: CreateCommunicationInput, actor: { id: string; username: string }): Promise<CommunicationDto> {
    // ── Content validation (pure, unit-tested) ─────────────────────────────
    assertValidCommunicationBody(input.body);
    assertValidCommunicationSubject(input.subject);
    assertDirectionMatchesType(input.type, input.direction);
    assertValidContext(input.contextType, input.contextId);
    assertValidParticipant(input.sender);
    assertValidParticipant(input.recipient);
    assertNoteHasNoRecipient(input.type, input.recipient);
    // STRICT REVIEW FIX (§7): SYSTEM нельзя задать из HTTP; direction↔participant
    // policy закрывает impersonation (INBOUND от внешней стороны, OUTBOUND к
    // внешней стороне, NOTE от внутреннего USER).
    assertNoSystemParticipantFromHttp([input.sender, input.recipient]);
    assertDirectionParticipantPolicy(input);

    // ── Cross-domain context existence (READ by ID, ADR-0001) ──────────────
    await this.assertContextExists(input.contextType, input.contextId);

    // ── Participant resolution (§12/§13): server-side defaults + existence ──
    // STRICT REVIEW FIX (§38): participant↔context consistency (CUSTOMER/PARTNER
    // refs должны соответствовать context; для ORDER/BOOKING — владельцу заказа).
    await this.assertParticipantContextConsistency(input.contextType, input.contextId, input.sender, input.recipient);

    const senderType = input.sender?.type ?? CommunicationParticipantType.USER;
    const senderId = input.sender?.id ?? actor.id;
    // NOTE/без recipient — recipient отсутствует (NULL), НЕ искусственный SYSTEM.
    const recipient = input.recipient ? { type: input.recipient.type, id: input.recipient.id ?? null } : null;
    await this.assertParticipantExists(senderType, senderId);
    if (input.recipient) {
      await this.assertParticipantExists(input.recipient.type, input.recipient.id);
    }

    // ── Correlation reference (§18) + честное время факта (§16/§17) ────────
    const ctx = getRequestContext();
    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "CML");
      const row = await tx.communication.create({
        data: {
          code,
          type: input.type,
          channel: "PLATFORM",
          direction: input.direction,
          status: CommunicationStatus.ACTIVE,
          subject: input.subject ?? null,
          body: input.body,
          contextType: input.contextType,
          contextId: input.contextId,
          actorUserId: actor.id,
          senderType,
          senderId,
          recipientType: recipient?.type ?? null,
          recipientId: recipient?.id ?? null,
          occurredAt: now,
          createdAt: now,
          requestId: ctx?.requestId ?? null,
          correlationId: ctx?.correlationId ?? null,
        },
        select: { id: true, code: true },
      });

      // Audit БЕЗ body (§20/§21): только references/minimal metadata.
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "communication.created",
        resource: "Communication",
        resourceId: row.id,
        details: {
          code: row.code,
          type: input.type,
          direction: input.direction,
          contextType: input.contextType,
          contextId: input.contextId,
        },
      });

      const full = await tx.communication.findUniqueOrThrow({ where: { id: row.id } });
      return full;
    });

    return this.toDto(created, { redactUserIds: false });
  }

  /* ── Internal list (staff) ──────────────────────────────────────────────── */

  async list(query: CommunicationListQuery): Promise<CommunicationListResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, query.pageSize ?? PAGE_SIZE_DEFAULT));

    const where: Prisma.CommunicationWhereInput = {
      ...(query.contextType ? { contextType: query.contextType } : {}),
      ...(query.contextId ? { contextId: query.contextId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { code: "asc" }], // deterministic tie-breaker (§39)
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.communication.count({ where }),
    ]);

    return {
      items: items.map((r) => this.toDto(r, { redactUserIds: false })),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  /* ── Own-scope (BUYER / PARTNER) ───────────────────────────────────────── */

  async getOwn(actor: { id: string; role: RoleCode; customerId: string | null; partnerId: string | null }, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<CommunicationListResult> {
    const p = Math.max(1, page);
    const ps = Math.min(PAGE_SIZE_MAX, Math.max(1, pageSize));

    const scope = this.ownScope(actor);
    if (!scope) return { items: [], total: 0, page: p, pageSize: ps, hasMore: false };

    const where: Prisma.CommunicationWhereInput = {
      contextType: scope.contextType,
      contextId: scope.contextId,
      type: { not: CommunicationType.NOTE }, // внутренние заметки — никогда (§36)
      direction: { not: CommunicationDirection.INTERNAL }, // INTERNAL — не внешняя
    };

    const [items, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { code: "asc" }],
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.communication.count({ where }),
    ]);

    return {
      items: items.map((r) => this.toDto(r, { redactUserIds: true })),
      total,
      page: p,
      pageSize: ps,
      hasMore: p * ps < total,
    };
  }

  /* ── Detail by code (staff → any; buyer/partner → own-scope only) ──────── */

  async getByCode(code: string, actor: { id: string; role: RoleCode; customerId: string | null; partnerId: string | null }): Promise<CommunicationDto> {
    const row = await this.prisma.communication.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Communication ${code} not found`);

    const isInternalStaff = actor.role !== RoleCode.BUYER && actor.role !== RoleCode.PARTNER;
    if (!isInternalStaff) {
      // Own-scope + visibility predicate. Несуществующее/чужое → neutral 404
      // (не раскрываем существование, §35).
      const scope = this.ownScope(actor);
      const visible =
        !!scope &&
        row.contextType === scope.contextType &&
        row.contextId === scope.contextId &&
        row.type !== CommunicationType.NOTE &&
        row.direction !== CommunicationDirection.INTERNAL;
      if (!visible) throw new NotFoundError(`Communication ${code} not found`);
      return this.toDto(row, { redactUserIds: true });
    }
    return this.toDto(row, { redactUserIds: false });
  }

  /* ── Internals ─────────────────────────────────────────────────────────── */

  /** Own-scope predicate (§31/§32): только доказанная linkage через actor. */
  private ownScope(actor: { role: RoleCode; customerId: string | null; partnerId: string | null }): { contextType: CommunicationContextType; contextId: string } | null {
    if (actor.role === RoleCode.BUYER && actor.customerId) {
      return { contextType: CommunicationContextType.CUSTOMER, contextId: actor.customerId };
    }
    if (actor.role === RoleCode.PARTNER && actor.partnerId) {
      return { contextType: CommunicationContextType.PARTNER, contextId: actor.partnerId };
    }
    return null;
  }

  private async assertContextExists(contextType: CommunicationContextType, contextId: string): Promise<void> {
    const exists =
      contextType === CommunicationContextType.CUSTOMER
        ? await this.prisma.customer.findUnique({ where: { id: contextId }, select: { id: true } })
        : contextType === CommunicationContextType.PARTNER
          ? await this.prisma.partner.findUnique({ where: { id: contextId }, select: { id: true } })
          : contextType === CommunicationContextType.ORDER
            ? await this.prisma.order.findUnique({ where: { id: contextId }, select: { id: true } })
            : await this.prisma.booking.findUnique({ where: { id: contextId }, select: { id: true } });
    if (!exists) {
      throw new ValidationDomainError(`Context ${contextType} ${contextId} does not exist`);
    }
  }

  private async assertParticipantExists(type: CommunicationParticipantType, id: string | undefined): Promise<void> {
    if (type === CommunicationParticipantType.SYSTEM) return;
    if (!id || id.trim().length === 0) {
      throw new ValidationDomainError(`Participant of type ${type} requires a canonical id`);
    }
    const exists =
      type === CommunicationParticipantType.USER
        ? await this.prisma.user.findUnique({ where: { id }, select: { id: true } })
        : type === CommunicationParticipantType.CUSTOMER
          ? await this.prisma.customer.findUnique({ where: { id }, select: { id: true } })
          : await this.prisma.partner.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new ValidationDomainError(`Participant ${type} ${id} does not exist`);
    }
  }

  /**
   * STRICT REVIEW FIX (§6/§38): existence ≠ authorization. CUSTOMER/PARTNER
   * participants должны быть КОНСИСТЕНТНЫ контексту:
   *  - context CUSTOMER: CUSTOMER participant == contextId (PARTNER participant
   *    на CUSTOMER-контексте — mismatch);
   *  - context PARTNER: PARTNER participant == contextId (CUSTOMER — mismatch);
   *  - context ORDER: CUSTOMER participant == order.customerId; PARTNER
   *    participant — один из владельцев продуктов заказа (items→product.partnerId);
   *  - context BOOKING: CUSTOMER == booking→order.customerId; PARTNER — владелец
   *    booking.productId. Для ORDER/BOOKING без продуктов/товаров — skip
   *    (нет authoritative linkage — не угадываем).
   */
  private async assertParticipantContextConsistency(
    contextType: CommunicationContextType,
    contextId: string,
    sender: { type: CommunicationParticipantType; id?: string } | undefined,
    recipient: { type: CommunicationParticipantType; id?: string } | undefined,
  ): Promise<void> {
    const refs = [sender, recipient].filter(Boolean) as Array<{ type: CommunicationParticipantType; id?: string }>;
    for (const p of refs) {
      if (p.type === CommunicationParticipantType.SYSTEM) continue; // уже запрещён из HTTP
      if (p.type === CommunicationParticipantType.USER) continue; // internal staff — без context constraint

      if (p.type === CommunicationParticipantType.CUSTOMER) {
        if (contextType === CommunicationContextType.CUSTOMER) {
          if (p.id !== contextId) throw new ValidationDomainError("CUSTOMER participant must match the CUSTOMER context");
        } else if (contextType === CommunicationContextType.PARTNER) {
          throw new ValidationDomainError("CUSTOMER participant is not allowed on a PARTNER context");
        } else if (contextType === CommunicationContextType.ORDER) {
          const order = await this.prisma.order.findUnique({ where: { id: contextId }, select: { customerId: true } });
          if (order && p.id !== order.customerId) throw new ValidationDomainError("CUSTOMER participant must be the owner of the ORDER context");
        } else {
          const booking = await this.prisma.booking.findUnique({ where: { id: contextId }, select: { orderId: true } });
          if (booking) {
            const order = await this.prisma.order.findUnique({ where: { id: booking.orderId }, select: { customerId: true } });
            if (order && p.id !== order.customerId) throw new ValidationDomainError("CUSTOMER participant must be the owner of the BOOKING context");
          }
        }
      }

      if (p.type === CommunicationParticipantType.PARTNER) {
        if (contextType === CommunicationContextType.PARTNER) {
          if (p.id !== contextId) throw new ValidationDomainError("PARTNER participant must match the PARTNER context");
        } else if (contextType === CommunicationContextType.CUSTOMER) {
          throw new ValidationDomainError("PARTNER participant is not allowed on a CUSTOMER context");
        } else if (contextType === CommunicationContextType.ORDER) {
          const partnerIds = await this.orderPartnerIds(contextId);
          if (partnerIds.length > 0 && !partnerIds.includes(p.id!)) {
            throw new ValidationDomainError("PARTNER participant is not associated with the ORDER context");
          }
        } else {
          const booking = await this.prisma.booking.findUnique({ where: { id: contextId }, select: { productId: true } });
          if (booking?.productId) {
            const product = await this.prisma.product.findUnique({ where: { id: booking.productId }, select: { partnerId: true } });
            if (product?.partnerId && p.id !== product.partnerId) {
              throw new ValidationDomainError("PARTNER participant is not associated with the BOOKING context");
            }
          }
        }
      }
    }
  }

  /** Владельцы-партнёры продуктов заказа (items → product.partnerId). */
  private async orderPartnerIds(orderId: string): Promise<string[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { items: { select: { productId: true } } },
    });
    if (!order || order.items.length === 0) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: order.items.map((i) => i.productId) } },
      select: { partnerId: true },
    });
    return products.map((p) => p.partnerId).filter((v): v is string => Boolean(v));
  }

  /**
   * DTO whitelist (§38). `redactUserIds` (own-view): internal USER ids не
   * нужны BUYER/PARTNER — тип остаётся, id → null. CUSTOMER/PARTNER refs
   * сохраняются (это собственный scope читающего).
   */
  private toDto(row: Communication, opts: { redactUserIds: boolean }): CommunicationDto {
    const redact = (type: CommunicationParticipantType | null, id: string | null): { type: CommunicationParticipantType; id: string | null } | null => {
      if (!type) return null;
      if (opts.redactUserIds && type === CommunicationParticipantType.USER) {
        return { type, id: null };
      }
      return { type, id };
    };
    return {
      id: row.id,
      code: row.code,
      type: row.type,
      channel: row.channel,
      direction: row.direction,
      status: row.status,
      subject: row.subject,
      body: row.body,
      contextType: row.contextType,
      contextId: row.contextId,
      sender: redact(row.senderType, row.senderId),
      recipient: redact(row.recipientType, row.recipientId),
      occurredAt: isoUtc(row.occurredAt),
      createdAt: isoUtc(row.createdAt),
    };
  }
}
