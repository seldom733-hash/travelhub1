import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IdsService } from '../../shared/ids.service';
import { NotFoundError, ValidationDomainError, ConflictError } from '../../shared/errors';
import { uniqueConstraintNames } from '../../shared/prisma-errors';
import type { AuthUser } from '../../security/auth/auth.service';
import { CampaignStatus } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';

// ── Allowed lifecycle transitions ──────────────────────────────────
const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT:     [CampaignStatus.SCHEDULED, CampaignStatus.CANCELLED],
  SCHEDULED: [CampaignStatus.ACTIVE, CampaignStatus.CANCELLED],
  ACTIVE:    [CampaignStatus.PAUSED, CampaignStatus.COMPLETED, CampaignStatus.CANCELLED],
  PAUSED:    [CampaignStatus.ACTIVE, CampaignStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

/** Supported attribution entity types — each maps to a canonical domain authority. */
const VALID_ATTRIBUTION_ENTITY_TYPES = ['CUSTOMER', 'LEAD', 'ORDER', 'BOOKING'] as const;

// ── Audience criteria contract ────────────────────────────────────
// Whitelist: only CRM/segmentation-relevant fields.
// Blocked: contact fields, tenant selectors, auth/password, arbitrary queries.
const AUDIENCE_CRITERIA_ALLOWED_KEYS = new Set([
  'lifecycle',       // PartnerCustomerRelation.lifecycle (LEAD/PROSPECT/ACTIVE/CHURNED)
  'leadSource',      // PartnerCustomerRelation.leadSource
  'tags',            // PartnerCustomerRelation.tags[]
  'status',          // EntityStatus
  'customerType',    // Person/Company
]);

const AUDIENCE_CRITERIA_BLOCKED_KEYS = new Set([
  'email', 'phone', 'url', 'address', 'socialHandle',
  'partnerId', 'tenantId', 'ownerId', 'createdById',
  'password', 'auth', 'token', 'secret',
  'rawSql', 'query', '$where', '$expr',
]);

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

    // Validate audience criteria contract
    if (dto.criteria) {
      this.validateAudienceCriteria(dto.criteria);
    }

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

    // Validate entityType (Step 3.8.2 — Defect B)
    if (!(VALID_ATTRIBUTION_ENTITY_TYPES as readonly string[]).includes(dto.entityType)) {
      throw new ValidationDomainError(`entityType must be one of: ${VALID_ATTRIBUTION_ENTITY_TYPES.join(', ')}`);
    }

    // Validate entity exists and type integrity (Step 3.8.2 — Defect A+B)
    // Use campaign's partnerId for scope validation, not the actor's — Platform
    // creating on a Partner campaign must still enforce Partner entity scope.
    await this.validateEntityReference(dto.entityType, dto.entityId, campaign.partnerId);

    try {
      return await this.prisma.campaignAttribution.create({
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
    } catch (err) {
      // Step 3.8.2 — Defect C: map duplicate (P2002) to controlled 409
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const names = uniqueConstraintNames(err);
        if (names.some(n => n.includes('campaignId_entityType_entityId'))) {
          throw new ConflictError(
            `Attribution already exists for ${dto.entityType}:${dto.entityId} on this campaign`,
          );
        }
      }
      throw err;
    }
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

  // ── Entity reference validation (Step 3.8.2) ─────────────────

  /**
   * Validates that entityId exists in the canonical domain for entityType,
   * and for Partner-scoped campaigns, that the entity belongs to the partner.
   *
   * Defect A: nonexistent entity → controlled 404
   * Defect B: type confusion (ORDER+BookingId) → controlled 404
   * Defect:   foreign tenant entity → controlled 404
   */
  private async validateEntityReference(
    entityType: string,
    entityId: string,
    partnerId: string | null,
  ): Promise<void> {
    switch (entityType) {
      case 'CUSTOMER': {
        const customer = await this.prisma.customer.findUnique({ where: { id: entityId } });
        if (!customer) {
          throw new NotFoundError(`Customer ${entityId} not found`);
        }
        // Partner scope: must have active PartnerCustomerRelation
        if (partnerId) {
          const relation = await this.prisma.partnerCustomerRelation.findUnique({
            where: { partnerId_customerId: { partnerId, customerId: entityId } },
          });
          if (!relation) {
            throw new NotFoundError(`Customer ${entityId} not found in partner scope`);
          }
        }
        break;
      }

      case 'LEAD': {
        const lead = await this.prisma.lead.findUnique({ where: { id: entityId } });
        if (!lead) {
          throw new NotFoundError(`Lead ${entityId} not found`);
        }
        // Partner scope: Lead must be linked to a Customer in partner's scope
        if (partnerId && lead.customerId) {
          const relation = await this.prisma.partnerCustomerRelation.findUnique({
            where: { partnerId_customerId: { partnerId, customerId: lead.customerId } },
          });
          if (!relation) {
            throw new NotFoundError(`Lead ${entityId} not found in partner scope`);
          }
        } else if (partnerId && !lead.customerId) {
          // Unlinked Lead cannot be attributed to a Partner campaign
          throw new NotFoundError(`Lead ${entityId} has no customer link — cannot attribute to partner campaign`);
        }
        break;
      }

      case 'ORDER': {
        const order = await this.prisma.order.findUnique({ where: { id: entityId } });
        if (!order) {
          throw new NotFoundError(`Order ${entityId} not found`);
        }
        // Partner scope: must be seller of this order
        if (partnerId && order.sellerPartnerId !== partnerId) {
          throw new NotFoundError(`Order ${entityId} not found in partner scope`);
        }
        break;
      }

      case 'BOOKING': {
        const booking = await this.prisma.booking.findUnique({ where: { id: entityId } });
        if (!booking) {
          throw new NotFoundError(`Booking ${entityId} not found`);
        }
        // Partner scope: traverse Booking → Order → sellerPartnerId
        if (partnerId) {
          const order = await this.prisma.order.findUnique({ where: { id: booking.orderId } });
          if (!order || order.sellerPartnerId !== partnerId) {
            throw new NotFoundError(`Booking ${entityId} not found in partner scope`);
          }
        }
        break;
      }

      default:
        throw new ValidationDomainError(`entityType must be one of: ${VALID_ATTRIBUTION_ENTITY_TYPES.join(', ')}`);
    }
  }

  // ── Audience criteria validation (Step 3.8.2 — Defect D) ─────

  /**
   * Validates audience criteria against the whitelisted contract.
   * Only CRM/segmentation-relevant fields are allowed.
   * Contact fields, tenant selectors, auth/password, and arbitrary queries are blocked.
   */
  private validateAudienceCriteria(criteria: Record<string, unknown>): void {
    const keys = Object.keys(criteria);

    // Check for blocked keys (security/tenant boundary)
    for (const key of keys) {
      if (AUDIENCE_CRITERIA_BLOCKED_KEYS.has(key)) {
        throw new ValidationDomainError(
          `Audience criteria field "${key}" is not allowed`,
        );
      }
    }

    // Check all keys are in the whitelist (no unknown fields)
    for (const key of keys) {
      if (!AUDIENCE_CRITERIA_ALLOWED_KEYS.has(key)) {
        throw new ValidationDomainError(
          `Audience criteria field "${key}" is not recognized. Allowed: ${[...AUDIENCE_CRITERIA_ALLOWED_KEYS].join(', ')}`,
        );
      }
    }

    // Validate nested structure: values must be string, string[], or primitive
    for (const [key, value] of Object.entries(criteria)) {
      if (value !== null && value !== undefined && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
          throw new ValidationDomainError(
            `Audience criteria field "${key}" must be a string, number, boolean, or string array`,
          );
        }
      }
    }
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
