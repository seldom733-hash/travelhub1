import { Controller, Get, Param, Query, UseGuards, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, IsDateString } from 'class-validator';
import { CrmActivitySourceType, CrmActivityActivityType } from '../../generated/prisma/enums';
import { CrmActivityService } from './crm-activity.service';
import { JwtAuthGuard } from '../../security/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../security/auth/permissions.guard';
import { CurrentUser, RequirePermissions } from '../../security/auth/decorators';
import type { AuthUser } from '../../security/auth/auth.service';
import { SOURCE_READ_PERMISSIONS } from './crm-activity.constants';
import { PrismaService } from '../../prisma/prisma.service';

// ─── DTOs ────────────────────────────────────────────────────────────────────

class ActivityQueryDto {
  @IsOptional()
  @IsString()
  sourceType?: CrmActivitySourceType;

  @IsOptional()
  @IsString()
  activityType?: CrmActivityActivityType;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  cursor?: string; // opaque: base64(JSON({ occurredAt, id }))

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ─── Source-Specific Item Authorization ──────────────────────────────────────

interface ActorContext {
  userId: string;
  role: string;
  partnerId: string | null;
  customerId: string | null;
  permissions: string[];
}

/**
 * LEVEL 2: Source-specific item authorization.
 * Returns true if the actor is authorized to see this activity item.
 */
function isSourceAuthorized(sourceType: string, actor: ActorContext): boolean {
  // Admin always sees everything
  if (actor.role === 'ADMIN') return true;

  // Source type comes from DB as a string; SOURCE_READ_PERMISSIONS keys are also strings
  const requiredPerm = (SOURCE_READ_PERMISSIONS as Record<string, string>)[sourceType];
  if (!requiredPerm) return false; // unknown source → deny
  return actor.permissions.includes(requiredPerm);
}

// ─── Cursor helpers ─────────────────────────────────────────────────────────

function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ occurredAt: occurredAt.toISOString(), id })).toString('base64url');
}

function decodeCursor(cursor: string): { occurredAt: Date; id: string } {
  try {
    const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!raw.occurredAt || !raw.id) throw new Error('missing fields');
    const date = new Date(raw.occurredAt);
    if (isNaN(date.getTime())) throw new Error('invalid timestamp');
    return { occurredAt: date, id: raw.id };
  } catch {
    throw new Error('Invalid cursor');
  }
}

// ─── Controller ─────────────────────────────────────────────────────────────

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CrmActivityController {
  constructor(
    private readonly activityService: CrmActivityService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /customers/:customerId/activity
   *
   * Two-level RBAC:
   *   LEVEL 1: crm.activity.read (page gate)
   *   LEVEL 2: source-specific per-item authorization
   *
   * Subject authority: customerId comes from route, cannot be overridden.
   */
  @Get('customers/:customerId/activity')
  @RequirePermissions('crm.activity.read')
  async listCustomerActivity(
    @Param('customerId') customerId: string,
    @Query() query: ActivityQueryDto,
    @CurrentUser() actor: AuthUser,
  ) {
    // ── Subject existence ──────────────────────────────────────────────────
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    // ── Cursor validation ──────────────────────────────────────────────────
    let decodedCursor: { occurredAt: Date; id: string } | undefined;
    if (query.cursor) {
      try {
        decodedCursor = decodeCursor(query.cursor);
      } catch {
        throw new NotFoundException('Invalid cursor');
      }
    }

    // ── Date validation ────────────────────────────────────────────────────
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    if (query.dateFrom) {
      dateFrom = new Date(query.dateFrom);
      if (isNaN(dateFrom.getTime())) throw new NotFoundException('Invalid dateFrom');
    }
    if (query.dateTo) {
      dateTo = new Date(query.dateTo);
      if (isNaN(dateTo.getTime())) throw new NotFoundException('Invalid dateTo');
    }

    // ── Enum validation ────────────────────────────────────────────────────
    if (query.sourceType && !Object.values(CrmActivitySourceType).includes(query.sourceType)) {
      throw new NotFoundException('Invalid sourceType');
    }
    if (query.activityType && !Object.values(CrmActivityActivityType).includes(query.activityType)) {
      throw new NotFoundException('Invalid activityType');
    }

    // ── Fetch candidates from DB with over-fetch for authorization ─────────
    const pageSize = Math.min(query.limit ?? 20, 100);
    const OVER_FETCH_FACTOR = 3; // fetch 3x to account for hidden items
    const maxCandidates = pageSize * OVER_FETCH_FACTOR;

    const where: any = { customerId };
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.activityType) where.activityType = query.activityType;
    if (dateFrom || dateTo) {
      where.occurredAt = {};
      if (dateFrom) where.occurredAt.gte = dateFrom;
      if (dateTo) where.occurredAt.lte = dateTo;
    }
    if (decodedCursor) {
      where.OR = [
        { occurredAt: { lt: decodedCursor.occurredAt } },
        { occurredAt: decodedCursor.occurredAt, id: { lt: decodedCursor.id } },
      ];
    }

    const candidates = await this.prisma.crmActivity.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: maxCandidates + 1, // +1 for hasMore detection
    });

    // ── LEVEL 2: Source-specific item authorization ────────────────────────
    const actorCtx: ActorContext = {
      userId: actor.id,
      role: actor.role,
      partnerId: actor.partnerId,
      customerId: actor.customerId,
      permissions: actor.permissions,
    };

    const authorized = candidates
      .filter((item) => isSourceAuthorized(item.sourceType, actorCtx))
      .slice(0, pageSize + 1);

    const hasMore = authorized.length > pageSize;
    const pageItems = hasMore ? authorized.slice(0, pageSize) : authorized;

    // ── Safe DTO projection ────────────────────────────────────────────────
    const items = pageItems.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      activityType: item.activityType,
      occurredAt: item.occurredAt,
      actor: item.actorUserId
        ? { userId: item.actorUserId, name: item.actorName }
        : null,
      title: item.title,
      summary: item.summary,
      deepLink: item.deepLink,
    }));

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const last = pageItems[pageItems.length - 1];
      nextCursor = encodeCursor(last.occurredAt, last.id);
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * GET /partners/:partnerId/activity
   *
   * Two-level RBAC:
   *   LEVEL 1: crm.activity.read (page gate)
   *   LEVEL 2: source-specific per-item authorization
   *
   * Subject authority: partnerId comes from route, cannot be overridden.
   */
  @Get('partners/:partnerId/activity')
  @RequirePermissions('crm.activity.read')
  async listPartnerActivity(
    @Param('partnerId') partnerId: string,
    @Query() query: ActivityQueryDto,
    @CurrentUser() actor: AuthUser,
  ) {
    // ── Subject existence ──────────────────────────────────────────────────
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true },
    });
    if (!partner) {
      throw new NotFoundException(`Partner ${partnerId} not found`);
    }

    // ── Cursor validation ──────────────────────────────────────────────────
    let decodedCursor: { occurredAt: Date; id: string } | undefined;
    if (query.cursor) {
      try {
        decodedCursor = decodeCursor(query.cursor);
      } catch {
        throw new NotFoundException('Invalid cursor');
      }
    }

    // ── Date validation ────────────────────────────────────────────────────
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    if (query.dateFrom) {
      dateFrom = new Date(query.dateFrom);
      if (isNaN(dateFrom.getTime())) throw new NotFoundException('Invalid dateFrom');
    }
    if (query.dateTo) {
      dateTo = new Date(query.dateTo);
      if (isNaN(dateTo.getTime())) throw new NotFoundException('Invalid dateTo');
    }

    // ── Enum validation ────────────────────────────────────────────────────
    if (query.sourceType && !Object.values(CrmActivitySourceType).includes(query.sourceType)) {
      throw new NotFoundException('Invalid sourceType');
    }
    if (query.activityType && !Object.values(CrmActivityActivityType).includes(query.activityType)) {
      throw new NotFoundException('Invalid activityType');
    }

    // ── Fetch candidates from DB with over-fetch for authorization ─────────
    const pageSize = Math.min(query.limit ?? 20, 100);
    const OVER_FETCH_FACTOR = 3;
    const maxCandidates = pageSize * OVER_FETCH_FACTOR;

    const where: any = { partnerId };
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.activityType) where.activityType = query.activityType;
    if (dateFrom || dateTo) {
      where.occurredAt = {};
      if (dateFrom) where.occurredAt.gte = dateFrom;
      if (dateTo) where.occurredAt.lte = dateTo;
    }
    if (decodedCursor) {
      where.OR = [
        { occurredAt: { lt: decodedCursor.occurredAt } },
        { occurredAt: decodedCursor.occurredAt, id: { lt: decodedCursor.id } },
      ];
    }

    const candidates = await this.prisma.crmActivity.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: maxCandidates + 1,
    });

    // ── LEVEL 2: Source-specific item authorization ────────────────────────
    const actorCtx: ActorContext = {
      userId: actor.id,
      role: actor.role,
      partnerId: actor.partnerId,
      customerId: actor.customerId,
      permissions: actor.permissions,
    };

    const authorized = candidates
      .filter((item) => isSourceAuthorized(item.sourceType, actorCtx))
      .slice(0, pageSize + 1);

    const hasMore = authorized.length > pageSize;
    const pageItems = hasMore ? authorized.slice(0, pageSize) : authorized;

    // ── Safe DTO projection ────────────────────────────────────────────────
    const items = pageItems.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      activityType: item.activityType,
      occurredAt: item.occurredAt,
      actor: item.actorUserId
        ? { userId: item.actorUserId, name: item.actorName }
        : null,
      title: item.title,
      summary: item.summary,
      deepLink: item.deepLink,
    }));

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const last = pageItems[pageItems.length - 1];
      nextCursor = encodeCursor(last.occurredAt, last.id);
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }
}
