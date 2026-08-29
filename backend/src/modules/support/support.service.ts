import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IdsService } from '../../shared/ids.service';
import { NotFoundError, ValidationDomainError } from '../../shared/errors';
import type { AuthUser } from '../../security/auth/auth.service';

/**
 * PHASE 3 STEP 3.10 — Support Domain Service.
 *
 * Canonical support case/ticket management:
 *   - create, read, list, update
 *   - lifecycle transitions (server-authoritative)
 *   - assignment
 *   - comments (internal + customer-facing)
 *   - escalation
 *   - SLA tracking
 *   - audit history
 *
 * References canonical entities (Order/Booking/Customer/Partner) by ID.
 * Does NOT own their lifecycle.
 */

// ── DTOs ──────────────────────────────────────────────────────────────

export interface CreateCaseDto {
  title: string;
  description?: string;
  caseType?: string;
  priority?: string;
  source?: string;
  customerId?: string;
  orderId?: string;
  bookingId?: string;
}

export interface UpdateCaseDto {
  title?: string;
  description?: string;
  caseType?: string;
  priority?: string;
  source?: string;
}

export interface TransitionCaseDto {
  status: string;
  escalationReason?: string;
}

export interface AssignCaseDto {
  assignedToId: string;
}

export interface EscalateCaseDto {
  escalationReason: string;
}

export interface CreateCommentDto {
  body: string;
  isInternal?: boolean;
}

// ── Valid transitions ──────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_PARTNER', 'WAITING_INTERNAL', 'ESCALATED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_CUSTOMER', 'WAITING_PARTNER', 'WAITING_INTERNAL', 'ESCALATED', 'RESOLVED', 'CLOSED'],
  WAITING_CUSTOMER: ['IN_PROGRESS', 'ESCALATED', 'CLOSED'],
  WAITING_PARTNER: ['IN_PROGRESS', 'ESCALATED', 'CLOSED'],
  WAITING_INTERNAL: ['IN_PROGRESS', 'ESCALATED', 'CLOSED'],
  ESCALATED: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_PARTNER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: [], // terminal
};

const TERMINAL_STATUSES = new Set(['CLOSED']);

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
  ) {}

  // ── CRUD ───────────────────────────────────────────────────────────

  async createCase(actor: AuthUser, dto: CreateCaseDto) {
    // F3: Validate related entity existence
    if (dto.customerId) {
      const customer = await (this.prisma as any).customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) throw new ValidationDomainError('Referenced customer does not exist');
    }
    if (dto.orderId) {
      const order = await (this.prisma as any).order.findUnique({ where: { id: dto.orderId } });
      if (!order) throw new ValidationDomainError('Referenced order does not exist');
    }
    if (dto.bookingId) {
      const booking = await (this.prisma as any).booking.findUnique({ where: { id: dto.bookingId } });
      if (!booking) throw new ValidationDomainError('Referenced booking does not exist');
    }

    const code = await this.ids.nextCode(this.prisma, 'SUP');

    const caseRecord = await (this.prisma as any).case.create({
      data: {
        code,
        title: dto.title,
        description: dto.description,
        caseType: dto.caseType as any ?? 'GENERAL',
        priority: dto.priority as any ?? 'MEDIUM',
        source: dto.source,
        customerId: dto.customerId,
        orderId: dto.orderId,
        bookingId: dto.bookingId,
        createdById: actor.id,
      },
    });

    // Audit history
    await this.addHistory(caseRecord.id, 'created', actor.id, actor.username, null, caseRecord.code);

    this.logger.log(`Support case ${caseRecord.code} created by ${actor.username}`);
    return caseRecord;
  }

  async listCases(actor: AuthUser, page = 1, pageSize = 20, filters?: {
    status?: string;
    priority?: string;
    caseType?: string;
    assignedToId?: string;
    customerId?: string;
  }) {
    const p = Math.max(1, page);
    const ps = Math.min(50, Math.max(1, pageSize));

    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.caseType) where.caseType = filters.caseType;
    if (filters?.assignedToId) where.assignedToId = filters.assignedToId;
    if (filters?.customerId) where.customerId = filters.customerId;

    const [items, total] = await Promise.all([
      (this.prisma as any).case.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip: (p - 1) * ps,
        take: ps,
        include: {
          comments: {
            where: {
              deletedAt: null,
              isInternal: (actor.role === 'BUYER' || actor.role === 'PARTNER') ? false : undefined,
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
      }),
      (this.prisma as any).case.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  async getCase(actor: AuthUser, id: string) {
    const caseRecord = await (this.prisma as any).case.findUnique({
      where: { id },
      include: {
        comments: {
          where: {
            deletedAt: null,
            // Server-authoritative filtering: internal comments only for internal staff
            isInternal: (actor.role === 'BUYER' || actor.role === 'PARTNER') ? false : undefined,
          },
          orderBy: { createdAt: 'desc' },
        },
        caseLinks: true,
        history: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!caseRecord) throw new NotFoundException('Support case not found');
    return caseRecord;
  }

  async getCaseByCode(actor: AuthUser, code: string) {
    const caseRecord = await (this.prisma as any).case.findUnique({
      where: { code },
      include: {
        comments: {
          where: {
            deletedAt: null,
            isInternal: (actor.role === 'BUYER' || actor.role === 'PARTNER') ? false : undefined,
          },
          orderBy: { createdAt: 'desc' },
        },
        caseLinks: true,
        history: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!caseRecord) throw new NotFoundException('Support case not found');
    return caseRecord;
  }

  async updateCase(actor: AuthUser, id: string, dto: UpdateCaseDto) {
    const existing = await (this.prisma as any).case.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Support case not found');
    if (TERMINAL_STATUSES.has(existing.status)) {
      throw new ValidationDomainError('Cannot update a closed support case');
    }

    const updated = await (this.prisma as any).case.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.caseType !== undefined && { caseType: dto.caseType }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.source !== undefined && { source: dto.source }),
      },
    });

    // Audit significant changes
    if (dto.priority && dto.priority !== existing.priority) {
      await this.addHistory(id, 'priority', actor.id, actor.username, existing.priority, dto.priority);
    }
    if (dto.caseType && dto.caseType !== existing.caseType) {
      await this.addHistory(id, 'caseType', actor.id, actor.username, existing.caseType, dto.caseType);
    }

    return updated;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  async transitionCase(actor: AuthUser, id: string, dto: TransitionCaseDto) {
    const existing = await (this.prisma as any).case.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Support case not found');

    const allowed = VALID_TRANSITIONS[existing.status];
    if (!allowed || !allowed.includes(dto.status)) {
      throw new ValidationDomainError(
        `Cannot transition from ${existing.status} to ${dto.status}. Allowed: ${(allowed ?? []).join(', ')}`,
      );
    }

    const data: any = { status: dto.status };
    if (dto.status === 'RESOLVED') data.resolvedAt = new Date();
    if (dto.status === 'CLOSED') data.closedAt = new Date();
    if (dto.status === 'OPEN' && existing.status === 'RESOLVED') {
      data.resolvedAt = null;
      data.closedAt = null;
    }
    if (dto.status === 'ESCALATED') {
      data.escalatedAt = new Date();
      data.escalatedById = actor.id;
      if (dto.escalationReason) data.escalationReason = dto.escalationReason;
    }

    const updated = await (this.prisma as any).case.update({ where: { id }, data });

    await this.addHistory(id, `status:${dto.status}`, actor.id, actor.username, existing.status, dto.status, dto.escalationReason);

    this.logger.log(`Case ${existing.code}: ${existing.status} → ${dto.status} by ${actor.username}`);
    return updated;
  }

  // ── Assignment ─────────────────────────────────────────────────────

  async assignCase(actor: AuthUser, id: string, dto: AssignCaseDto) {
    const existing = await (this.prisma as any).case.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Support case not found');

    // F3: Validate assignee existence and eligibility
    const assignee = await (this.prisma as any).user.findUnique({ where: { id: dto.assignedToId } });
    if (!assignee) throw new ValidationDomainError('Assignee user does not exist');
    if (assignee.role === 'BUYER' || assignee.role === 'PARTNER') {
      throw new ValidationDomainError('Cannot assign case to external roles (BUYER/PARTNER)');
    }

    const updated = await (this.prisma as any).case.update({
      where: { id },
      data: { assignedToId: dto.assignedToId },
    });

    await this.addHistory(id, 'assigned', actor.id, actor.username, existing.assignedToId, dto.assignedToId);

    return updated;
  }

  // ── Escalation ─────────────────────────────────────────────────────

  async escalateCase(actor: AuthUser, id: string, dto: EscalateCaseDto) {
    // F4: Delegate to canonical transition authority
    return this.transitionCase(actor, id, { status: 'ESCALATED', escalationReason: dto.escalationReason });
  }

  // ── Comments ───────────────────────────────────────────────────────

  async addComment(actor: AuthUser, caseId: string, dto: CreateCommentDto) {
    const existing = await (this.prisma as any).case.findUnique({ where: { id: caseId } });
    if (!existing) throw new NotFoundException('Support case not found');

    const comment = await (this.prisma as any).caseComment.create({
      data: {
        caseId,
        authorId: actor.id,
        body: dto.body,
        isInternal: dto.isInternal ?? false,
      },
    });

    await this.addHistory(caseId, 'comment', actor.id, actor.username, null, `comment:${comment.id}`);

    return comment;
  }

  async listComments(caseId: string, includeInternal = false) {
    const where: any = { caseId, deletedAt: null };
    if (!includeInternal) where.isInternal = false;

    return (this.prisma as any).caseComment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Communication Links ────────────────────────────────────────────

  async linkCommunication(actor: AuthUser, caseId: string, communicationId: string) {
    const existing = await (this.prisma as any).case.findUnique({ where: { id: caseId } });
    if (!existing) throw new NotFoundException('Support case not found');

    // F5: Validate communication existence
    const communication = await (this.prisma as any).communication.findUnique({ where: { id: communicationId } });
    if (!communication) throw new ValidationDomainError('Referenced communication does not exist');

    return (this.prisma as any).caseCommunicationLink.upsert({
      where: { caseId_communicationId: { caseId, communicationId } },
      create: { caseId, communicationId, createdById: actor.id },
      update: {},
    });
  }

  // ── SLA ────────────────────────────────────────────────────────────

  async updateSLA(id: string, deadline: Date | null) {
    return (this.prisma as any).case.update({
      where: { id },
      data: { slaDeadline: deadline, slaBreached: false },
    });
  }

  // ── History (append-only) ──────────────────────────────────────────

  private async addHistory(
    caseId: string,
    action: string,
    actorId: string | null,
    actorName: string | null,
    previousValue: string | null,
    newValue: string | null,
    details?: string,
  ) {
    return (this.prisma as any).caseHistory.create({
      data: { caseId, action, actorId, actorName, previousValue, newValue, details },
    });
  }

  // ── Stats ──────────────────────────────────────────────────────────

  async getStats() {
    const [total, open, inProgress, escalated, resolved, closed] = await Promise.all([
      (this.prisma as any).case.count(),
      (this.prisma as any).case.count({ where: { status: 'OPEN' } }),
      (this.prisma as any).case.count({ where: { status: 'IN_PROGRESS' } }),
      (this.prisma as any).case.count({ where: { status: 'ESCALATED' } }),
      (this.prisma as any).case.count({ where: { status: 'RESOLVED' } }),
      (this.prisma as any).case.count({ where: { status: 'CLOSED' } }),
    ]);

    return { total, open, inProgress, escalated, resolved, closed };
  }
}
