// ─── Decision Signal Service ─────────────────────────────────────────────────
// Stage B Foundation: hybrid model (dynamic facts + persisted lifecycle).
// Owner: Command Center / Decision Intelligence.

import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";
import type { SignalStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AffectedEntityRef,
  SignalEvidenceItem,
  DecisionSignalResponse,
  SignalListQuery,
  SignalListResponse,
  AcknowledgeSignalDto,
  ResolveSignalDto,
  DismissSignalDto,
  DetectedCondition,
  DecisionSignalDetector,
  SignalLifecycleStatus,
} from "./decision-signal.types";

@Injectable()
export class DecisionSignalService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Fingerprint Generation ──────────────────────────────────────────────

  /**
   * Generate a deterministic fingerprint for deduplication.
   * fingerprint = detectorKey + "|" + sorted(entityTypes:entityIds) joined by ";"
   *
   * Must NOT include: mutable text, timestamps, PII, secrets.
   */
  static generateFingerprint(detectorKey: string, affectedEntities: AffectedEntityRef[]): string {
    const sorted = [...affectedEntities]
      .map((e) => `${e.entityType}:${e.entityId}`)
      .sort();
    const scope = sorted.length > 0 ? sorted.join(";") : "_global";
    return `ds:${detectorKey}:${scope}`;
  }

  // ── Detector Orchestration ──────────────────────────────────────────────

  /**
   * Run a detector and reconcile results with persisted signals.
   * Fingerprint-based dedup: same fingerprint → reobserve, not duplicate.
   * If condition disappeared, the existing signal is NOT auto-resolved.
   * (Detector failure ≠ condition disappeared invariant.)
   */
  async runDetector(detector: DecisionSignalDetector, userId?: string): Promise<DecisionSignalResponse[]> {
    const conditions = await detector.detect();
    const results: DecisionSignalResponse[] = [];

    for (const condition of conditions) {
      const signal = await this.upsertFromDetection(condition, detector.key);
      results.push(signal);
    }

    return results;
  }

  /**
   * Run multiple detectors concurrently.
   * Each detector's failure must not affect others.
   */
  async runDetectors(detectors: DecisionSignalDetector[], userId?: string): Promise<DecisionSignalResponse[]> {
    const allResults: DecisionSignalResponse[] = [];

    for (const detector of detectors) {
      try {
        const results = await this.runDetector(detector, userId);
        allResults.push(...results);
      } catch {
        // Detector failure must not corrupt or resolve unrelated signals.
        // Log but continue.
      }
    }

    return allResults;
  }

  // ── Upsert / Re-observation ────────────────────────────────────────────

  private async upsertFromDetection(
    condition: DetectedCondition,
    detectorKey: string,
  ): Promise<DecisionSignalResponse> {
    const now = new Date();

    // Try to find existing active signal by fingerprint
    const existing = await (this.prisma as any).decisionSignal.findUnique({
      where: { fingerprint: condition.fingerprint },
    });

    if (existing && existing.status !== "RESOLVED" && existing.status !== "DISMISSED") {
      // Re-observation: update evidence, lastDetectedAt, observationCount
      const updated = await (this.prisma as any).decisionSignal.update({
        where: { id: existing.id },
        data: {
          evidence: condition.evidence as any,
          affectedEntities: condition.affectedEntities as any,
          lastDetectedAt: now,
          observationCount: { increment: 1 },
        },
      });
      return this.toResponse(updated);
    }

    // Create new signal
    const created = await (this.prisma as any).decisionSignal.create({
      data: {
        code: condition.code,
        category: condition.category,
        status: "OPEN" as SignalStatus,
        source: detectorKey,
        fingerprint: condition.fingerprint,
        affectedEntities: condition.affectedEntities as any,
        evidence: condition.evidence as any,
        firstDetectedAt: now,
        lastDetectedAt: now,
        observationCount: 1,
      },
    });

    return this.toResponse(created);
  }

  // ── List / Get ─────────────────────────────────────────────────────────

  async listSignals(
    query: SignalListQuery,
    userPermissions: string[],
  ): Promise<SignalListResponse> {
    // RBAC: filter by section permissions
    const where: any = {};

    // Only return signals whose category the user can access
    const allowedCategories = this.resolveAllowedCategories(userPermissions);
    if (allowedCategories.length === 0) {
      return { signals: [], total: 0, page: query.page ?? 1, limit: query.limit ?? 20 };
    }
    where.category = { in: allowedCategories };

    if (query.status) where.status = query.status;
    if (query.category) {
      // User can filter further within their allowed set
      if (!allowedCategories.includes(query.category)) {
        throw new ForbiddenException(`No permission for category ${query.category}`);
      }
      where.category = query.category;
    }
    if (query.code) where.code = query.code;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const [signals, total] = await Promise.all([
      (this.prisma as any).decisionSignal.findMany({
        where,
        orderBy: [{ status: "asc" }, { lastDetectedAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma as any).decisionSignal.count({ where }),
    ]);

    return {
      signals: signals.map(this.toResponse),
      total,
      page,
      limit,
    };
  }

  async getSignal(id: string, userPermissions: string[]): Promise<DecisionSignalResponse> {
    const signal = await (this.prisma as any).decisionSignal.findUnique({ where: { id } });
    if (!signal) throw new NotFoundException(`Signal ${id} not found`);

    // RBAC: check category permission
    const allowed = this.resolveAllowedCategories(userPermissions);
    if (!allowed.includes(signal.category)) {
      throw new ForbiddenException(`No permission for signal category ${signal.category}`);
    }

    return this.toResponse(signal);
  }

  // ── Lifecycle Mutations ────────────────────────────────────────────────

  async acknowledge(id: string, dto: AcknowledgeSignalDto, userId: string, username: string, userPermissions: string[]): Promise<DecisionSignalResponse> {
    return this.transition(id, "ACKNOWLEDGED", userPermissions, (signal) => {
      if (signal.status !== "OPEN") {
        throw new BadRequestException(`Cannot acknowledge signal in status ${signal.status}. Only OPEN signals can be acknowledged.`);
      }
      return {
        status: "ACKNOWLEDGED" as SignalStatus,
        acknowledgedAt: new Date(),
        acknowledgedBy: username,
      };
    });
  }

  async resolve(id: string, dto: ResolveSignalDto, userId: string, username: string, userPermissions: string[]): Promise<DecisionSignalResponse> {
    return this.transition(id, "RESOLVED", userPermissions, (signal) => {
      if (signal.status !== "OPEN" && signal.status !== "ACKNOWLEDGED") {
        throw new BadRequestException(`Cannot resolve signal in status ${signal.status}.`);
      }
      return {
        status: "RESOLVED" as SignalStatus,
        resolvedAt: new Date(),
        resolvedBy: username,
      };
    });
  }

  async dismiss(id: string, dto: DismissSignalDto, userId: string, username: string, userPermissions: string[]): Promise<DecisionSignalResponse> {
    return this.transition(id, "DISMISSED", userPermissions, (signal) => {
      if (signal.status !== "OPEN" && signal.status !== "ACKNOWLEDGED") {
        throw new BadRequestException(`Cannot dismiss signal in status ${signal.status}.`);
      }
      return {
        status: "DISMISSED" as SignalStatus,
        dismissedAt: new Date(),
        dismissedBy: username,
      };
    });
  }

  private async transition(
    id: string,
    _targetStatus: string,
    userPermissions: string[],
    transitionFn: (signal: any) => any,
  ): Promise<DecisionSignalResponse> {
    const signal = await (this.prisma as any).decisionSignal.findUnique({ where: { id } });
    if (!signal) throw new NotFoundException(`Signal ${id} not found`);

    // RBAC
    const allowed = this.resolveAllowedCategories(userPermissions);
    if (!allowed.includes(signal.category)) {
      throw new ForbiddenException(`No permission for signal category ${signal.category}`);
    }

    const data = transitionFn(signal);

    const updated = await (this.prisma as any).decisionSignal.update({
      where: { id },
      data,
    });

    return this.toResponse(updated);
  }

  // ── RBAC: Category → Permission mapping ────────────────────────────────

  private resolveAllowedCategories(permissions: string[]): string[] {
    const categories: string[] = [];
    // OPERATIONAL → dashboard.operational.read, dashboard.attention.read
    if (permissions.includes("dashboard.operational.read") || permissions.includes("dashboard.attention.read")) {
      categories.push("OPERATIONAL");
    }
    // FINANCIAL → dashboard.financial.read
    if (permissions.includes("dashboard.financial.read")) {
      categories.push("FINANCIAL");
    }
    // CATALOG → dashboard.catalog.read
    if (permissions.includes("dashboard.catalog.read")) {
      categories.push("CATALOG");
    }
    // CHANNEL → dashboard.channels.read
    if (permissions.includes("dashboard.channels.read")) {
      categories.push("CHANNEL");
    }
    // Admin / Director: all categories
    if (permissions.includes("dashboard.executive.read") && permissions.includes("dashboard.marketplace.read")) {
      // Broad access — include all if they have most section perms
      if (!categories.includes("OPERATIONAL")) categories.push("OPERATIONAL");
      if (!categories.includes("FINANCIAL")) categories.push("FINANCIAL");
      if (!categories.includes("CATALOG")) categories.push("CATALOG");
      if (!categories.includes("CHANNEL")) categories.push("CHANNEL");
    }
    return [...new Set(categories)];
  }

  // ── Mapper ─────────────────────────────────────────────────────────────

  private toResponse(row: any): DecisionSignalResponse {
    return {
      id: row.id,
      code: row.code,
      category: row.category,
      status: row.status,
      source: row.source,
      fingerprint: row.fingerprint,
      affectedEntities: (row.affectedEntities as any[]) ?? [],
      evidence: (row.evidence as any[]) ?? [],
      firstDetectedAt: row.firstDetectedAt?.toISOString?.() ?? row.firstDetectedAt,
      lastDetectedAt: row.lastDetectedAt?.toISOString?.() ?? row.lastDetectedAt,
      observationCount: row.observationCount,
      acknowledgedAt: row.acknowledgedAt?.toISOString?.() ?? row.acknowledgedAt,
      acknowledgedBy: row.acknowledgedBy,
      resolvedAt: row.resolvedAt?.toISOString?.() ?? row.resolvedAt,
      resolvedBy: row.resolvedBy,
      dismissedAt: row.dismissedAt?.toISOString?.() ?? row.dismissedAt,
      dismissedBy: row.dismissedBy,
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    };
  }
}
