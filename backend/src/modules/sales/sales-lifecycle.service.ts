/**
 * Sales structural decomposition — SalesLifecycleService (Wave 3 / Step 2.17C).
 *
 * Extracts Lead/Opportunity lifecycle writes from SalesService:
 *   - createLead, transitionLead
 *   - createOpportunity, transitionOpportunity
 *   - assignLead, assignOpportunity
 *
 * Invariants preserved:
 *   - Each method owns its own $transaction boundary (no cross-service tx leaking).
 *   - CAS version check preserved in every transition/assign (concurrent edit → 409).
 *   - History + audit preserved identically (same model, same action, same fields).
 *   - Lead/Opportunity code generation via IdsService.nextCode (no behavior change).
 *   - createOpportunityFromBuyerRequestSelection stays in SalesService facade
 *     (in-tx boundary with Reverse module — see ADR-0001, §DD-030).
 *   - No authority duplication: Sales remains sole-writer for lead.*, opportunity.* tables.
 *
 * Behavior-preserving: zero API, contract, or authorization changes.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { LeadStatus, OpportunityStatus } from "../../generated/prisma/enums";
import { assertLeadTransition, assertOpportunityTransition } from "./sales.validation";
import { writeHistory } from "./sales.history";
import { toLeadDto, toOpportunityDto } from "./sales.projection";
import { assertOptionalCustomer, assertOptionalUser } from "./sales-helpers";

interface Actor {
  id: string;
  username: string;
}

@Injectable()
export class SalesLifecycleService {
  private readonly logger = new Logger(SalesLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly ids: IdsService,
  ) {}

  /* ── Lead ──────────────────────────────────────────────────────────────── */

  async createLead(
    input: { name: string; customerId?: string | null; assignedToId?: string | null },
    actor: Actor,
  ): Promise<ReturnType<typeof toLeadDto>> {
    const name = input.name.trim();
    if (name.length === 0) throw new ValidationDomainError("Lead name is required");
    if (name.length > 200) throw new ValidationDomainError("Lead name is too long (max 200)");

    await assertOptionalCustomer(this.prisma, input.customerId);
    await assertOptionalUser(this.prisma, input.assignedToId);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "LED");
      const row = await tx.lead.create({
        data: {
          code,
          name,
          customerId: input.customerId ?? null,
          assignedToId: input.assignedToId ?? null,
          status: LeadStatus.NEW,
          createdById: actor.id,
        },
      });
      await writeHistory(tx, "leadHistory", row.id, "created", null, row.status, actor, { name });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.lead.created",
        resource: "Lead",
        resourceId: row.id,
        details: { code: row.code, status: row.status },
      });
      return row;
    });
    this.logger.log(`Lead ${created.code} created by ${actor.username}`);
    return toLeadDto(created);
  }

  async transitionLead(code: string, to: LeadStatus, actor: Actor): Promise<ReturnType<typeof toLeadDto>> {
    const row = await this.prisma.lead.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Lead ${code} not found`);
    assertLeadTransition(row.status, to);

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.lead.updateMany({
        where: { id: row.id, version: row.version },
        data: { status: to, version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError(`Lead ${code} was modified concurrently; retry`);
      const fresh = await tx.lead.findUniqueOrThrow({ where: { id: row.id } });
      await writeHistory(tx, "leadHistory", row.id, "status_changed", row.status, to, actor, {});
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.lead.status_changed",
        resource: "Lead",
        resourceId: row.id,
        details: { code: row.code, from: row.status, to },
      });
      return fresh;
    });
    return toLeadDto(updated);
  }

  async assignLead(code: string, assignedToId: string | null, actor: Actor): Promise<ReturnType<typeof toLeadDto>> {
    if (assignedToId !== null) await assertOptionalUser(this.prisma, assignedToId);
    const row = await this.prisma.lead.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Lead ${code} not found`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.lead.updateMany({
        where: { id: row.id, version: row.version },
        data: { assignedToId, version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError(`Lead ${code} was modified concurrently; retry`);
      const fresh = await tx.lead.findUniqueOrThrow({ where: { id: row.id } });
      await writeHistory(tx, "leadHistory", row.id, "assigned", row.assignedToId, assignedToId, actor, {});
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.lead.assigned",
        resource: "Lead",
        resourceId: row.id,
        details: { code: row.code, from: row.assignedToId, to: assignedToId },
      });
      return fresh;
    });
    return toLeadDto(updated);
  }

  /* ── Opportunity ────────────────────────────────────────────────────────── */

  async createOpportunity(
    input: { title: string; leadId?: string | null; customerId?: string | null; assignedToId?: string | null },
    actor: Actor,
  ): Promise<ReturnType<typeof toOpportunityDto>> {
    const title = input.title.trim();
    if (title.length === 0) throw new ValidationDomainError("Opportunity title is required");
    if (title.length > 200) throw new ValidationDomainError("Opportunity title is too long (max 200)");

    if (input.leadId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true } });
      if (!lead) throw new ValidationDomainError(`Lead ${input.leadId} does not exist`);
    }
    await assertOptionalCustomer(this.prisma, input.customerId);
    await assertOptionalUser(this.prisma, input.assignedToId);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "OPP");
      const row = await tx.opportunity.create({
        data: {
          code,
          title,
          leadId: input.leadId ?? null,
          customerId: input.customerId ?? null,
          assignedToId: input.assignedToId ?? null,
          status: OpportunityStatus.NEW,
          createdById: actor.id,
        },
      });
      await writeHistory(tx, "opportunityHistory", row.id, "created", null, row.status, actor, { title });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.opportunity.created",
        resource: "Opportunity",
        resourceId: row.id,
        details: { code: row.code, status: row.status },
      });
      return row;
    });
    return toOpportunityDto(created);
  }

  async transitionOpportunity(code: string, to: OpportunityStatus, actor: Actor): Promise<ReturnType<typeof toOpportunityDto>> {
    const row = await this.prisma.opportunity.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Opportunity ${code} not found`);
    assertOpportunityTransition(row.status, to);

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.opportunity.updateMany({
        where: { id: row.id, version: row.version },
        data: { status: to, version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError(`Opportunity ${code} was modified concurrently; retry`);
      const fresh = await tx.opportunity.findUniqueOrThrow({ where: { id: row.id } });
      await writeHistory(tx, "opportunityHistory", row.id, "status_changed", row.status, to, actor, {});
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.opportunity.status_changed",
        resource: "Opportunity",
        resourceId: row.id,
        details: { code: row.code, from: row.status, to },
      });
      return fresh;
    });
    return toOpportunityDto(updated);
  }

  async assignOpportunity(code: string, assignedToId: string | null, actor: Actor): Promise<ReturnType<typeof toOpportunityDto>> {
    if (assignedToId !== null) await assertOptionalUser(this.prisma, assignedToId);
    const row = await this.prisma.opportunity.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Opportunity ${code} not found`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.opportunity.updateMany({
        where: { id: row.id, version: row.version },
        data: { assignedToId, version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError(`Opportunity ${code} was modified concurrently; retry`);
      const fresh = await tx.opportunity.findUniqueOrThrow({ where: { id: row.id } });
      await writeHistory(tx, "opportunityHistory", row.id, "assigned", row.assignedToId, assignedToId, actor, {});
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.opportunity.assigned",
        resource: "Opportunity",
        resourceId: row.id,
        details: { code: row.code, from: row.assignedToId, to: assignedToId },
      });
      return fresh;
    });
    return toOpportunityDto(updated);
  }
}
