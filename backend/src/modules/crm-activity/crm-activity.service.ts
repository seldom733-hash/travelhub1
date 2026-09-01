import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrmActivitySourceType, CrmActivitySubjectType } from '../../generated/prisma/enums';
import { ActivityProjection, ActivityQueryParams, ActivityPage, BackfillReport } from './crm-activity.types';
import { getAllAdapters } from './crm-activity.adapters';
import { BACKFILL_BATCH_SIZE } from './crm-activity.constants';

@Injectable()
export class CrmActivityService {
  private readonly logger = new Logger(CrmActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Idempotent Projection ──────────────────────────────────────────────

  /**
   * Project a single activity into the read model. Idempotent:
   * same sourceType+sourceId+sourceEvent always produces one row.
   */
  async projectActivity(projection: ActivityProjection): Promise<string> {
    const result = await (this.prisma as any).crmActivity.upsert({
      where: {
        CrmActivity_dedupe_key: {
          sourceType: projection.sourceType,
          sourceId: projection.sourceId,
          sourceEvent: projection.sourceEvent,
        },
      },
      create: {
        sourceType: projection.sourceType,
        sourceId: projection.sourceId,
        sourceEvent: projection.sourceEvent,
        activityType: projection.activityType,
        subjectType: projection.subjectType,
        subjectId: projection.subjectId,
        customerId: projection.customerId,
        partnerId: projection.partnerId,
        occurredAt: projection.occurredAt,
        actorUserId: projection.actorUserId,
        actorName: projection.actorName,
        title: projection.title,
        summary: projection.summary,
        metadata: projection.metadata ?? undefined,
        deepLink: projection.deepLink,
        visibility: projection.visibility,
      },
      update: {
        // Update all fields on replay (source may have changed)
        activityType: projection.activityType,
        subjectType: projection.subjectType,
        subjectId: projection.subjectId,
        customerId: projection.customerId,
        partnerId: projection.partnerId,
        occurredAt: projection.occurredAt,
        actorUserId: projection.actorUserId,
        actorName: projection.actorName,
        title: projection.title,
        summary: projection.summary,
        metadata: projection.metadata ?? undefined,
        deepLink: projection.deepLink,
        visibility: projection.visibility,
      },
    });
    return result.id;
  }

  /**
   * Project multiple activities in a transaction (batch).
   * Each projection is idempotent.
   */
  async projectActivitiesBatch(projections: ActivityProjection[]): Promise<number> {
    let count = 0;
    // Process in chunks to avoid oversized transactions
    for (let i = 0; i < projections.length; i += BACKFILL_BATCH_SIZE) {
      const chunk = projections.slice(i, i + BACKFILL_BATCH_SIZE);
      await (this.prisma as any).$transaction(
        chunk.map((p) =>
          (this.prisma as any).crmActivity.upsert({
            where: {
              CrmActivity_dedupe_key: {
                sourceType: p.sourceType,
                sourceId: p.sourceId,
                sourceEvent: p.sourceEvent,
              },
            },
            create: {
              sourceType: p.sourceType,
              sourceId: p.sourceId,
              sourceEvent: p.sourceEvent,
              activityType: p.activityType,
              subjectType: p.subjectType,
              subjectId: p.subjectId,
              customerId: p.customerId,
              partnerId: p.partnerId,
              occurredAt: p.occurredAt,
              actorUserId: p.actorUserId,
              actorName: p.actorName,
              title: p.title,
              summary: p.summary,
              metadata: p.metadata ?? undefined,
              deepLink: p.deepLink,
              visibility: p.visibility,
            },
            update: {
              activityType: p.activityType,
              subjectType: p.subjectType,
              subjectId: p.subjectId,
              customerId: p.customerId,
              partnerId: p.partnerId,
              occurredAt: p.occurredAt,
              actorUserId: p.actorUserId,
              actorName: p.actorName,
              title: p.title,
              summary: p.summary,
              metadata: p.metadata ?? undefined,
              deepLink: p.deepLink,
              visibility: p.visibility,
            },
          }),
        ),
      );
      count += chunk.length;
    }
    return count;
  }

  // ─── Query: Cursor Pagination ──────────────────────────────────────────

  /**
   * Query activity items for a subject (Customer or Partner) with cursor pagination.
   * Uses stable ordering: occurredAt DESC, id DESC.
   */
  async queryActivity(params: ActivityQueryParams): Promise<ActivityPage> {
    const pageSize = Math.min(params.pageSize ?? 20, 50);

    const where: any = {
      subjectType: params.subjectType,
      subjectId: params.subjectId,
    };

    if (params.activityType) {
      where.activityType = params.activityType;
    }
    if (params.sourceType) {
      where.sourceType = params.sourceType;
    }
    if (params.dateFrom || params.dateTo) {
      where.occurredAt = {};
      if (params.dateFrom) where.occurredAt.gte = params.dateFrom;
      if (params.dateTo) where.occurredAt.lte = params.dateTo;
    }

    // Cursor: {occurredAt, id} — items before cursor
    if (params.cursor) {
      where.OR = [
        { occurredAt: { lt: params.cursor.occurredAt } },
        {
          occurredAt: params.cursor.occurredAt,
          id: { lt: params.cursor.id },
        },
      ];
    }

    const items = await (this.prisma as any).crmActivity.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1, // fetch one extra to determine hasMore
    });

    const hasMore = items.length > pageSize;
    const pageItems = hasMore ? items.slice(0, pageSize) : items;

    let nextCursor: { occurredAt: Date; id: string } | null = null;
    if (hasMore && pageItems.length > 0) {
      const last = pageItems[pageItems.length - 1];
      nextCursor = { occurredAt: last.occurredAt, id: last.id };
    }

    return {
      items: pageItems.map((item: any) => ({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceEvent: item.sourceEvent,
        activityType: item.activityType,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        customerId: item.customerId,
        partnerId: item.partnerId,
        occurredAt: item.occurredAt,
        actorUserId: item.actorUserId,
        actorName: item.actorName,
        title: item.title,
        summary: item.summary,
        metadata: item.metadata,
        deepLink: item.deepLink,
        visibility: item.visibility,
      })),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Query by customerId (Customer 360) — includes all dual-subject events.
   */
  async queryCustomerActivity(
    customerId: string,
    filters: Partial<Omit<ActivityQueryParams, 'subjectType' | 'subjectId'>> = {},
  ): Promise<ActivityPage> {
    const where: any = { customerId };

    // Platform Marketplace scope: exclude Storefront end-customer commerce events.
    // ORDER/BOOKING/PAYMENT events with acquisitionSource=PARTNER_STOREFRONT are
    // excluded; all other source types (notes, messages, audits, etc.) pass through.
    where.NOT = [
      { sourceType: 'ORDER', metadata: { path: ['acquisitionSource'], equals: 'PARTNER_STOREFRONT' } },
      { sourceType: 'BOOKING', metadata: { path: ['acquisitionSource'], equals: 'PARTNER_STOREFRONT' } },
      { sourceType: 'PAYMENT', metadata: { path: ['acquisitionSource'], equals: 'PARTNER_STOREFRONT' } },
    ];

    if (filters.activityType) where.activityType = filters.activityType;
    if (filters.sourceType) where.sourceType = filters.sourceType;
    if (filters.dateFrom || filters.dateTo) {
      where.occurredAt = {};
      if (filters.dateFrom) where.occurredAt.gte = filters.dateFrom;
      if (filters.dateTo) where.occurredAt.lte = filters.dateTo;
    }
    if (filters.cursor) {
      where.OR = [
        { occurredAt: { lt: filters.cursor.occurredAt } },
        {
          occurredAt: filters.cursor.occurredAt,
          id: { lt: filters.cursor.id },
        },
      ];
    }

    const pageSize = Math.min(filters.pageSize ?? 20, 50);

    const items = await (this.prisma as any).crmActivity.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
    });

    const hasMore = items.length > pageSize;
    const pageItems = hasMore ? items.slice(0, pageSize) : items;
    let nextCursor: { occurredAt: Date; id: string } | null = null;
    if (hasMore && pageItems.length > 0) {
      const last = pageItems[pageItems.length - 1];
      nextCursor = { occurredAt: last.occurredAt, id: last.id };
    }

    return {
      items: pageItems.map((item: any) => ({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceEvent: item.sourceEvent,
        activityType: item.activityType,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        customerId: item.customerId,
        partnerId: item.partnerId,
        occurredAt: item.occurredAt,
        actorUserId: item.actorUserId,
        actorName: item.actorName,
        title: item.title,
        summary: item.summary,
        metadata: item.metadata,
        deepLink: item.deepLink,
        visibility: item.visibility,
      })),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Query by partnerId (Partner 360) — includes all dual-subject events.
   */
  async queryPartnerActivity(
    partnerId: string,
    filters: Partial<Omit<ActivityQueryParams, 'subjectType' | 'subjectId'>> = {},
  ): Promise<ActivityPage> {
    const where: any = { partnerId };

    if (filters.activityType) where.activityType = filters.activityType;
    if (filters.sourceType) where.sourceType = filters.sourceType;
    if (filters.dateFrom || filters.dateTo) {
      where.occurredAt = {};
      if (filters.dateFrom) where.occurredAt.gte = filters.dateFrom;
      if (filters.dateTo) where.occurredAt.lte = filters.dateTo;
    }
    if (filters.cursor) {
      where.OR = [
        { occurredAt: { lt: filters.cursor.occurredAt } },
        {
          occurredAt: filters.cursor.occurredAt,
          id: { lt: filters.cursor.id },
        },
      ];
    }

    const pageSize = Math.min(filters.pageSize ?? 20, 50);

    const items = await (this.prisma as any).crmActivity.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
    });

    const hasMore = items.length > pageSize;
    const pageItems = hasMore ? items.slice(0, pageSize) : items;
    let nextCursor: { occurredAt: Date; id: string } | null = null;
    if (hasMore && pageItems.length > 0) {
      const last = pageItems[pageItems.length - 1];
      nextCursor = { occurredAt: last.occurredAt, id: last.id };
    }

    return {
      items: pageItems.map((item: any) => ({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceEvent: item.sourceEvent,
        activityType: item.activityType,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        customerId: item.customerId,
        partnerId: item.partnerId,
        occurredAt: item.occurredAt,
        actorUserId: item.actorUserId,
        actorName: item.actorName,
        title: item.title,
        summary: item.summary,
        metadata: item.metadata,
        deepLink: item.deepLink,
        visibility: item.visibility,
      })),
      nextCursor,
      hasMore,
    };
  }

  // ─── Backfill / Rebuild ────────────────────────────────────────────────

  /**
   * Full backfill/rebuild: clear all activity rows and reproject from canonical sources.
   * Idempotent: safe to run multiple times.
   */
  async rebuildAll(): Promise<BackfillReport> {
    this.logger.log('Starting full CrmActivity rebuild...');

    // Truncate existing activity
    await (this.prisma as any).crmActivity.deleteMany({});

    const adapters = getAllAdapters();
    const results = [];
    let totalScanned = 0;
    let totalProjected = 0;
    let totalDuplicates = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const startTime = Date.now();

    for (const adapter of adapters) {
      const result = await this.backfillSource(adapter.sourceType);
      results.push(result);
      totalScanned += result.rowsScanned;
      totalProjected += result.rowsProjected;
      totalDuplicates += result.duplicatesSuppressed;
      totalSkipped += result.rowsSkipped;
      totalErrors += result.errors;
    }

    const totalDurationMs = Date.now() - startTime;
    this.logger.log(
      `Rebuild complete: ${totalProjected} projected, ${totalDuplicates} deduped, ${totalSkipped} skipped, ${totalErrors} errors in ${totalDurationMs}ms`,
    );

    return {
      results,
      totalScanned,
      totalProjected,
      totalDuplicates,
      totalSkipped,
      totalErrors,
      totalDurationMs,
    };
  }

  /**
   * Backfill a single source type. Idempotent: dedup key prevents duplicates.
   */
  async backfillSource(sourceType: CrmActivitySourceType): Promise<{
    sourceType: CrmActivitySourceType;
    rowsScanned: number;
    rowsProjected: number;
    duplicatesSuppressed: number;
    rowsSkipped: number;
    errors: number;
    durationMs: number;
  }> {
    const adapter = getAllAdapters().find((a) => a.sourceType === sourceType);
    if (!adapter) {
      throw new Error(`No adapter found for source type: ${sourceType}`);
    }

    const startTime = Date.now();
    let rowsScanned = 0;
    let rowsProjected = 0;
    let duplicatesSuppressed = 0;
    let rowsSkipped = 0;
    let errors = 0;

    try {
      const projections = await adapter.backfill(this.prisma);
      rowsScanned = projections.length; // approximate: projections returned = rows scanned

      // Dedupe in-memory before upsert (reduces DB round-trips)
      const seen = new Set<string>();
      const uniqueProjections: ActivityProjection[] = [];
      for (const p of projections) {
        const key = `${p.sourceType}|${p.sourceId}|${p.sourceEvent}`;
        if (seen.has(key)) {
          duplicatesSuppressed++;
        } else {
          seen.add(key);
          uniqueProjections.push(p);
        }
      }

      // Batch upsert
      for (let i = 0; i < uniqueProjections.length; i += BACKFILL_BATCH_SIZE) {
        const chunk = uniqueProjections.slice(i, i + BACKFILL_BATCH_SIZE);
        try {
          await (this.prisma as any).$transaction(
            chunk.map((p) =>
              (this.prisma as any).crmActivity.upsert({
                where: {
                  CrmActivity_dedupe_key: {
                    sourceType: p.sourceType,
                    sourceId: p.sourceId,
                    sourceEvent: p.sourceEvent,
                  },
                },
                create: {
                  sourceType: p.sourceType,
                  sourceId: p.sourceId,
                  sourceEvent: p.sourceEvent,
                  activityType: p.activityType,
                  subjectType: p.subjectType,
                  subjectId: p.subjectId,
                  customerId: p.customerId,
                  partnerId: p.partnerId,
                  occurredAt: p.occurredAt,
                  actorUserId: p.actorUserId,
                  actorName: p.actorName,
                  title: p.title,
                  summary: p.summary,
                  metadata: p.metadata ?? undefined,
                  deepLink: p.deepLink,
                  visibility: p.visibility,
                },
                update: {
                  activityType: p.activityType,
                  subjectType: p.subjectType,
                  subjectId: p.subjectId,
                  customerId: p.customerId,
                  partnerId: p.partnerId,
                  occurredAt: p.occurredAt,
                  actorUserId: p.actorUserId,
                  actorName: p.actorName,
                  title: p.title,
                  summary: p.summary,
                  metadata: p.metadata ?? undefined,
                  deepLink: p.deepLink,
                  visibility: p.visibility,
                },
              }),
            ),
          );
          rowsProjected += chunk.length;
        } catch (err) {
          this.logger.error(`Backfill batch error for ${sourceType}: ${err}`);
          errors += chunk.length;
        }
      }
    } catch (err) {
      this.logger.error(`Backfill error for ${sourceType}: ${err}`);
      errors++;
    }

    return {
      sourceType,
      rowsScanned,
      rowsProjected,
      duplicatesSuppressed,
      rowsSkipped,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  // ─── Utility ───────────────────────────────────────────────────────────

  /**
   * Get activity count for a subject (useful for UI badges).
   */
  async getActivityCount(
    subjectType: CrmActivitySubjectType,
    subjectId: string,
  ): Promise<number> {
    return (this.prisma as any).crmActivity.count({
      where: { subjectType, subjectId },
    });
  }

  /**
   * Remove activity items for a deleted source.
   */
  async removeActivityForSource(
    sourceType: CrmActivitySourceType,
    sourceId: string,
  ): Promise<number> {
    const result = await (this.prisma as any).crmActivity.deleteMany({
      where: { sourceType, sourceId },
    });
    return result.count;
  }

  /**
   * Get all activity items (for testing/debugging).
   */
  async findAll(limit = 100): Promise<any[]> {
    return (this.prisma as any).crmActivity.findMany({
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }
}
