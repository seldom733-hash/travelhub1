/**
 * PHASE 2 STEP 2.14E — CommissionPolicyService (Channel-Based Commission Rules
 * Foundation, ADR-0013).
 *
 * Scope: mutable Commission policy master data (finance.CommissionPolicy, CMP-*)
 * — ЕДИНСТВЕННЫЙ authority (D1: Finance-owned; Settings/Catalog/Sales/PSP НЕ
 * дублируют). V1 matching key — channel only (D2); rateType PERCENTAGE (D3);
 * ставки — master data, НЕ константы (invariant 1).
 *
 * Инварианты / hard gates:
 *  - lifecycle DRAFT → ACTIVE → ARCHIVED (CAS from-guard): update ТОЛЬКО в DRAFT
 *    (ACTIVE/ARCHIVED immutable — изменение = новая policy); activate проверяет
 *    overlap-инвариант (≤1 ACTIVE policy на channel в точке времени) под
 *    pg_advisory_xact_lock(hashtext('commission-policy:'||channel)) — concurrent
 *    conflicting activate → контролируемый 409, без raw 500 (T10);
 *  - resolver: детерминированный, fail-closed (AMBIGUOUS → no policy), НЕ
 *    считает amount, НЕ читает Catalog, НЕ пишет Sales/Order/Payment, НЕ
 *    эмитит Commission-факты (T12/T13);
 *  - V1 create-гейт: только MARKETPLACE (no-commission каналы
 *    PARTNER_STOREFRONT/DIRECT/BUYER_REQUEST — 422, T6);
 *  - rate: десятичная доля 0 < rate < 1, ≤ 6 знаков (DECIMAL(18,6)); version
 *    server-owned (инкремент на draft-итерацию); createdAt НЕ precedence;
 *  - 0 Commission/CommissionAccrual/LedgerTransaction/ProviderFee/Settlement/
 *    Payout/Invoice side-effects (T12); 0 доменных событий (D19);
 *  - каждая мутация — CommissionPolicyHistory (полный state snapshot на версию,
 *    future frozen snapshot репродукция) + AuditLog (snake_case, PII-free).
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { CommissionChannel, CommissionPolicyStatus, CommissionRateType } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { isUniqueViolation } from "../../shared/prisma-errors";
import {
  assertCommissionPolicyCreateChannel,
  assertValidRange,
  validateCommissionChannel,
  validateCommissionRate,
} from "./finance.validation";

interface Actor {
  id: string;
  username: string;
}

/** Resolution-результат (детерминированный, fail-closed). */
export type CommissionPolicyResolution =
  | { found: true; reason: "POLICY_FOUND"; policy: Record<string, unknown> }
  | { found: false; reason: "NO_COMMISSION_CHANNEL" | "NO_POLICY" | "AMBIGUOUS" };

@Injectable()
export class CommissionPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  // ── Create (DRAFT) ─────────────────────────────────────────────────────────

  /**
   * Создание CommissionPolicy (DRAFT, version 1). Client передаёт channel +
   * rate + effectiveFrom/effectiveTo. V1: channel = MARKETPLACE only.
   * DRAFT не селектируема → overlap на create не проверяется (инвариант — на
   * activate). Concurrent create разных policy — безопасен (разные code).
   */
  async create(input: { channel: string; rate: string; effectiveFrom: string; effectiveTo?: string }, actor: Actor): Promise<Record<string, unknown>> {
    const channel = validateCommissionChannel(input.channel);
    assertCommissionPolicyCreateChannel(channel);
    const rate = validateCommissionRate(input.rate);
    // effectiveTo: null = open-ended — assertValidRange принимает только undefined
    // (new Date(null) = epoch → ложный «to <= from»).
    assertValidRange(input.effectiveFrom, input.effectiveTo ?? undefined, "commission policy effective period");

    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "CMP");
      try {
        const row = await tx.commissionPolicy.create({
          data: {
            code,
            channel: channel as CommissionChannel,
            rateType: CommissionRateType.PERCENTAGE,
            rate: new Prisma.Decimal(rate),
            status: CommissionPolicyStatus.DRAFT,
            version: 1,
            effectiveFrom: new Date(input.effectiveFrom),
            effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
          },
        });
        await this.writeHistory(tx, row, "created", actor, `Policy создана (DRAFT v1) для канала ${channel}`);
        await this.security.audit(tx, { action: "finance.commission_policy.created", resource: "CommissionPolicy", resourceId: row.id, details: { code, channel, rate } });
        return this.policyDto(row);
      } catch (err) {
        // Race: nextCode/unique code — P2002 → контролируемый 409 (не raw 500).
        if (isUniqueViolation(err)) throw new ConflictError(`CommissionPolicy code collision — retry`);
        throw err;
      }
    });
  }

  // ── Update (DRAFT only, version bump) ──────────────────────────────────────

  /**
   * Изменение policy: ТОЛЬКО в DRAFT (ACTIVE/ARCHIVED immutable — новая ставка
   * = новая policy, ADR D16 «новая запись с новым effectiveFrom»). version
   * server-owned +1. Сериализация по channel (advisory lock) — защита от
   * concurrent activate во время update.
   */
  async update(code: string, input: { rate?: string; effectiveFrom?: string; effectiveTo?: string | null }, actor: Actor): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.commissionPolicy.findUnique({ where: { code } });
      if (!existing) throw new NotFoundError(`CommissionPolicy ${code} not found`);
      await this.lockChannel(tx, existing.channel);
      const fresh = await tx.commissionPolicy.findUniqueOrThrow({ where: { id: existing.id } });
      if (fresh.status !== CommissionPolicyStatus.DRAFT) {
        throw new ValidationDomainError(`CommissionPolicy ${code} is ${fresh.status} — update allowed only in DRAFT (create a new policy for changes)`);
      }

      const rate = input.rate !== undefined ? validateCommissionRate(input.rate) : undefined;
      const effectiveFrom = input.effectiveFrom !== undefined ? new Date(input.effectiveFrom) : undefined;
      const effectiveTo = input.effectiveTo !== undefined ? (input.effectiveTo ? new Date(input.effectiveTo) : null) : undefined;
      const from = effectiveFrom ?? fresh.effectiveFrom;
      const to = effectiveTo !== undefined ? effectiveTo : fresh.effectiveTo;
      if (to !== null && to <= from) {
        throw new ValidationDomainError("commission policy effective period: effectiveTo must be after effectiveFrom");
      }

      const row = await tx.commissionPolicy.update({
        where: { id: fresh.id },
        data: {
          ...(rate !== undefined ? { rate: new Prisma.Decimal(rate) } : {}),
          ...(effectiveFrom !== undefined ? { effectiveFrom } : {}),
          ...(effectiveTo !== undefined ? { effectiveTo } : {}),
          version: { increment: 1 },
        },
      });
      await this.writeHistory(tx, row, "updated", actor, `Policy обновлена (DRAFT v${row.version})`);
      await this.security.audit(tx, { action: "finance.commission_policy.updated", resource: "CommissionPolicy", resourceId: row.id, details: { code, version: row.version } });
      return this.policyDto(row);
    });
  }

  // ── Activate (DRAFT → ACTIVE, overlap-checked) ─────────────────────────────

  /**
   * Активация (CAS DRAFT → ACTIVE): единственная точка overlap-инварианта.
   * Под advisory lock на channel проверяется: НЕ существует другой ACTIVE
   * policy этого channel с пересекающимся effective-окном [from, to) —
   * пересечение → контролируемый 409 (fail-closed, не «первая строка»).
   */
  async activate(code: string, actor: Actor): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.commissionPolicy.findUnique({ where: { code } });
      if (!existing) throw new NotFoundError(`CommissionPolicy ${code} not found`);
      await this.lockChannel(tx, existing.channel);
      const fresh = await tx.commissionPolicy.findUniqueOrThrow({ where: { id: existing.id } });
      if (fresh.status === CommissionPolicyStatus.ACTIVE) return this.policyDto(fresh); // idempotent no-op
      if (fresh.status !== CommissionPolicyStatus.DRAFT) {
        throw new ValidationDomainError(`CommissionPolicy ${code} is ${fresh.status} — cannot activate`);
      }

      await this.assertNoOverlap(tx, fresh);
      const row = await tx.commissionPolicy.update({ where: { id: fresh.id }, data: { status: CommissionPolicyStatus.ACTIVE } });
      await this.writeHistory(tx, row, "activated", actor, `Policy активирована (ACTIVE v${row.version})`);
      await this.security.audit(tx, { action: "finance.commission_policy.activated", resource: "CommissionPolicy", resourceId: row.id, details: { code, version: row.version } });
      return this.policyDto(row);
    });
  }

  // ── Archive (→ ARCHIVED, terminal) ─────────────────────────────────────────

  /** Архивация (CAS): DRAFT|ACTIVE → ARCHIVED (терминальный, не селектируема). */
  async archive(code: string, actor: Actor): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.commissionPolicy.findUnique({ where: { code } });
      if (!existing) throw new NotFoundError(`CommissionPolicy ${code} not found`);
      await this.lockChannel(tx, existing.channel);
      const fresh = await tx.commissionPolicy.findUniqueOrThrow({ where: { id: existing.id } });
      if (fresh.status === CommissionPolicyStatus.ARCHIVED) return this.policyDto(fresh); // idempotent no-op
      if (fresh.status === CommissionPolicyStatus.DRAFT) {
        // Draft можно просто удалить из ротации — archive тоже валиден (audit trail).
        await tx.commissionPolicy.update({ where: { id: fresh.id }, data: { status: CommissionPolicyStatus.ARCHIVED } });
      } else {
        await tx.commissionPolicy.update({ where: { id: fresh.id }, data: { status: CommissionPolicyStatus.ARCHIVED } });
      }
      const row = await tx.commissionPolicy.findUniqueOrThrow({ where: { id: fresh.id } });
      await this.writeHistory(tx, row, "archived", actor, `Policy архивирована (ARCHIVED)`);
      await this.security.audit(tx, { action: "finance.commission_policy.archived", resource: "CommissionPolicy", resourceId: row.id, details: { code } });
      return this.policyDto(row);
    });
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async list(query: { channel?: string; status?: string; page?: number; pageSize?: number }): Promise<Record<string, unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.CommissionPolicyWhereInput = {};
    if (query.channel !== undefined) {
      validateCommissionChannel(query.channel);
      where.channel = query.channel as CommissionChannel;
    }
    if (query.status !== undefined) {
      if (!Object.values(CommissionPolicyStatus).includes(query.status as CommissionPolicyStatus)) {
        throw new ValidationDomainError(`status must be one of: ${Object.values(CommissionPolicyStatus).join(", ")}`);
      }
      where.status = query.status as CommissionPolicyStatus;
    }
    const [rows, total] = await Promise.all([
      this.prisma.commissionPolicy.findMany({ where, orderBy: [{ channel: "asc" }, { effectiveFrom: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.commissionPolicy.count({ where }),
    ]);
    return { items: rows.map((r) => this.policyDto(r)), page, pageSize, total };
  }

  async getByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.commissionPolicy.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`CommissionPolicy ${code} not found`);
    return this.policyDto(row);
  }

  /**
   * Канонический детерминированный resolver (ADR-0013 D13 §13) — read path для
   * future consumer-ов (freeze-шаг / 2.12E / 2.12C). НЕ считает amount; НЕ
   * читает Catalog; НЕ пишет. Fail-closed: AMBIGUOUS → no policy.
   */
  async resolve(channel: string, at: string): Promise<CommissionPolicyResolution> {
    const ch = validateCommissionChannel(channel);
    if (ch !== CommissionChannel.MARKETPLACE) {
      return { found: false, reason: "NO_COMMISSION_CHANNEL" };
    }
    const instant = new Date(at);
    const rows = await this.prisma.commissionPolicy.findMany({
      where: {
        channel: ch as CommissionChannel,
        status: CommissionPolicyStatus.ACTIVE,
        effectiveFrom: { lte: instant },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: instant } }],
      },
      orderBy: { effectiveFrom: "asc" },
    });
    if (rows.length === 0) return { found: false, reason: "NO_POLICY" };
    if (rows.length > 1) return { found: false, reason: "AMBIGUOUS" }; // fail-closed backstop
    return { found: true, reason: "POLICY_FOUND", policy: this.policyDto(rows[0]) };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async lockChannel(tx: Prisma.TransactionClient, channel: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`commission-policy:${channel}`}))`;
  }

  /** Overlap-инвариант: пересечение [aFrom, aTo) с [bFrom, bTo) ⇔ aFrom < bTo AND bFrom < aTo. */
  private async assertNoOverlap(tx: Prisma.TransactionClient, policy: { id: string; channel: CommissionChannel; effectiveFrom: Date; effectiveTo: Date | null }): Promise<void> {
    const to = policy.effectiveTo ?? new Date("9999-12-31T23:59:59.999Z");
    const conflicting = await tx.commissionPolicy.findFirst({
      where: {
        id: { not: policy.id },
        channel: policy.channel,
        status: CommissionPolicyStatus.ACTIVE,
        effectiveFrom: { lt: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: policy.effectiveFrom } }],
      },
    });
    if (conflicting) {
      throw new ConflictError(`ACTIVE CommissionPolicy ${conflicting.code} already covers channel ${policy.channel} at this effective period — archive it first or choose a non-overlapping period`);
    }
  }

  private async writeHistory(
    tx: Prisma.TransactionClient,
    policy: { id: string; code: string; channel: CommissionChannel; rateType: CommissionRateType; rate: Prisma.Decimal; status: CommissionPolicyStatus; version: number; effectiveFrom: Date; effectiveTo: Date | null },
    action: string,
    actor: Actor,
    comment: string,
  ): Promise<void> {
    await tx.commissionPolicyHistory.create({
      data: {
        policyId: policy.id,
        action,
        version: policy.version,
        fields: {
          code: policy.code,
          channel: policy.channel,
          rateType: policy.rateType,
          rate: policy.rate.toString(),
          status: policy.status,
          effectiveFrom: policy.effectiveFrom.toISOString(),
          effectiveTo: policy.effectiveTo ? policy.effectiveTo.toISOString() : null,
        },
        actorId: actor.id,
        actorName: actor.username,
        comment,
      },
    });
  }

  private policyDto(p: {
    id: string;
    code: string;
    channel: CommissionChannel;
    rateType: CommissionRateType;
    rate: Prisma.Decimal;
    status: CommissionPolicyStatus;
    version: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Record<string, unknown> {
    return {
      id: p.id,
      code: p.code,
      channel: p.channel,
      rateType: p.rateType,
      rate: p.rate.toString(),
      status: p.status,
      version: p.version,
      effectiveFrom: p.effectiveFrom.toISOString(),
      effectiveTo: p.effectiveTo ? p.effectiveTo.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
