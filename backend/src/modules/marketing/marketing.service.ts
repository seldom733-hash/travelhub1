import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IdsService } from '../../shared/ids.service';
import { NotFoundError, ValidationDomainError, ForbiddenError } from '../../shared/errors';
import { uniqueConstraintNames } from '../../shared/prisma-errors';
import type { AuthUser } from '../../security/auth/auth.service';
import { CampaignStatus, RoleCode } from '../../generated/prisma/enums';

// ── Allowed lifecycle transitions ──────────────────────────────────
const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT:     [CampaignStatus.SCHEDULED, CampaignStatus.CANCELLED],
  SCHEDULED: [CampaignStatus.ACTIVE, CampaignStatus.CANCELLED],
  ACTIVE:    [CampaignStatus.PAUSED, CampaignStatus.COMPLETED, CampaignStatus.CANCELLED],
  PAUSED:    [CampaignStatus.ACTIVE, CampaignStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

// ── DTOs ───────────────────────────────────────────────────────────

export interface CreateCampaignDto {
  name: string;
  description?: string;
  objective?: string;
  startAt?: string;
  endAt?: string;
}

export interface UpdateCampaignDto {
  name?: string;
  description?: string;
  objective?: string;
  startAt?: string;
  endAt?: string;
}

export interface TransitionCampaignDto {
  status: CampaignStatus;
}

export interface CreateAudienceDto {
  name: string;
  description?: string;
  criteria?: Record<string, unknown>;
  campaignId: string;
}

export interface CreateAttributionDto {
  campaignId: string;
  entityType: string;
  entityId: string;
  attributionType?: string;
  notes?: string;
}

// ── Service ────────────────────────────────────────────────────────

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
  ) {}

  // ── Campaign CRUD ──────────────────────────────────────────────

  async createCampaign(actor: AuthUser, dto: CreateCampaignDto) {
    const partnerId = this.resolvePartnerScope(actor);
    const code = await this.ids.nextCode(this.prisma, 'MKT');

    const campaign = await this.prisma.campaign.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        objective: dto.objective as any ?? null,
        partnerId,
        createdById: actor.id,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      },
    });

    this.logger.log(`Campaign ${campaign.code} created by ${actor.username}`);
    return campaign;
  }

  async listCampaigns(actor: AuthUser, page = 1, pageSize = 20) {
    const partnerId = this.resolvePartnerScope(actor);
    const where = partnerId ? { partnerId } : {};
    const p = Math.max(1, page);
    const ps = Math.min(50, Math.max(1, pageSize));

    const [items, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  async getCampaign(actor: AuthUser, id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    this.assertOwnScope(actor, campaign.partnerId);
    return campaign;
  }

  async getCampaignByCode(actor: AuthUser, code: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { code } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    this.assertOwnScope(actor, campaign.partnerId);
    return campaign;
  }

  async updateCampaign(actor: AuthUser, id: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    this.assertOwnScope(actor, campaign.partnerId);

    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new ValidationDomainError('Only DRAFT campaigns can be updated');
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.objective !== undefined && { objective: dto.objective as any }),
        ...(dto.startAt !== undefined && { startAt: dto.startAt ? new Date(dto.startAt) : null }),
        ...(dto.endAt !== undefined && { endAt: dto.endAt ? new Date(dto.endAt) : null }),
      },
    });
  }

  async transitionCampaign(actor: AuthUser, id: string, dto: TransitionCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    this.assertOwnScope(actor, campaign.partnerId);

    const allowed = ALLOWED_TRANSITIONS[campaign.status];
    if (!allowed.includes(dto.status)) {
      throw new ValidationDomainError(
        `Cannot transition from ${campaign.status} to ${dto.status}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    return this.prisma.campaign.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async deleteCampaign(actor: AuthUser, id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    this.assertOwnScope(actor, campaign.partnerId);

    if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.CANCELLED) {
      throw new ValidationDomainError('Only DRAFT or CANCELLED campaigns can be deleted');
    }

    await this.prisma.campaign.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Audience CRUD ──────────────────────────────────────────────

  async createAudience(actor: AuthUser, dto: CreateAudienceDto) {
    const partnerId = this.resolvePartnerScope(actor);

    // Verify campaign exists and is in scope
    const campaign = await this.prisma.campaign.findUnique({ where: { id: dto.campaignId } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    this.assertOwnScope(actor, campaign.partnerId);

    const code = await this.ids.nextCode(this.prisma, 'MKA');

    return this.prisma.campaignAudience.create({
      data: {
        code,
        campaignId: dto.campaignId,
        name: dto.name,
        description: dto.description,
        criteria: dto.criteria ? (dto.criteria as any) : undefined,
        partnerId,
        createdById: actor.id,
      },
    });
  }

  async listAudiences(actor: AuthUser, campaignId: string) {
    // Verify campaign exists and is in scope
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    this.assertOwnScope(actor, campaign.partnerId);

    return this.prisma.campaignAudience.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAudience(actor: AuthUser, id: string) {
    const audience = await this.prisma.campaignAudience.findUnique({ where: { id } });
    if (!audience) throw new NotFoundError('Audience not found');
    this.assertOwnScope(actor, audience.partnerId);
    return audience;
  }

  // ── Attribution CRUD ───────────────────────────────────────────

  async createAttribution(actor: AuthUser, dto: CreateAttributionDto) {
    const partnerId = this.resolvePartnerScope(actor);

    // Verify campaign exists and is in scope
    const campaign = await this.prisma.campaign.findUnique({ where: { id: dto.campaignId } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    this.assertOwnScope(actor, campaign.partnerId);

    // Validate entityType
    const validEntityTypes = ['CUSTOMER', 'LEAD', 'ORDER', 'BOOKING'];
    if (!validEntityTypes.includes(dto.entityType)) {
      throw new ValidationDomainError(`entityType must be one of: ${validEntityTypes.join(', ')}`);
    }

    return this.prisma.campaignAttribution.create({
      data: {
        campaignId: dto.campaignId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        attributionType: dto.attributionType ?? 'FIRST_TOUCH',
        notes: dto.notes,
        partnerId,
        createdById: actor.id,
      },
    });
  }

  async listAttributions(actor: AuthUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    this.assertOwnScope(actor, campaign.partnerId);

    return this.prisma.campaignAttribution.findMany({
      where: { campaignId },
      orderBy: { attributedAt: 'desc' },
    });
  }

  async listAttributionsByEntity(actor: AuthUser, entityType: string, entityId: string) {
    return this.prisma.campaignAttribution.findMany({
      where: { entityType, entityId },
      orderBy: { attributedAt: 'desc' },
    });
  }

  // ── Scope helpers ──────────────────────────────────────────────

  private resolvePartnerScope(actor: AuthUser): string | null {
    // Platform scope = no partnerId (admin/operator/director/marketer)
    if (!actor.partnerId) return null;
    return actor.partnerId;
  }

  private assertOwnScope(actor: AuthUser, entityPartnerId: string | null) {
    // Platform scope = no partnerId
    if (!actor.partnerId) return;
    if (entityPartnerId !== null && entityPartnerId !== actor.partnerId) {
      throw new NotFoundError('Campaign not found'); // neutral 404 for cross-tenant
    }
  }
}
