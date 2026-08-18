/**
 * STEP 2.17C — Wave 1: History read/write + pagination helpers.
 *
 * Extracted from SalesService private methods. Module-level functions that
 * are shared across all write/query paths. Behavior-preserving: exact same
 * logic, just moved out of the class.
 */
import { Prisma } from "../../generated/prisma/client";
import { isoUtc } from "../../shared/temporal";
import type { SalesListResult, SalesHistoryItemDto } from "./sales.contracts";

export const PAGE_SIZE_MAX = 50;
export const PAGE_SIZE_DEFAULT = 20;

/* ── Pagination ──────────────────────────────────────────────────────────── */

export function pagination(page?: number, pageSize?: number): { p: number; ps: number } {
  return { p: Math.max(1, page ?? 1), ps: Math.min(PAGE_SIZE_MAX, Math.max(1, pageSize ?? PAGE_SIZE_DEFAULT)) };
}

/* ── Entity-scoped history read model ────────────────────────────────────── */

export type HistoryModel = "leadHistory" | "opportunityHistory" | "quoteHistory" | "saleHistory" | "checkoutIntentHistory";

const HISTORY_ID_FIELD: Record<HistoryModel, string> = {
  leadHistory: "leadId",
  opportunityHistory: "opportunityId",
  quoteHistory: "quoteId",
  saleHistory: "saleId",
  checkoutIntentHistory: "checkoutIntentId",
};

export async function entityHistory(
  prisma: any,
  model: HistoryModel,
  entityId: string,
  page: number,
  pageSize: number,
): Promise<SalesListResult<SalesHistoryItemDto>> {
  const { p, ps } = pagination(page, pageSize);
  const idField = HISTORY_ID_FIELD[model];
  const client = prisma as any;
  const [rows, total] = await Promise.all([
    client[model].findMany({ where: { [idField]: entityId }, orderBy: { createdAt: "asc" }, skip: (p - 1) * ps, take: ps }),
    client[model].count({ where: { [idField]: entityId } }),
  ]);
  return {
    items: rows.map((r: { id: string; action: string; from: string | null; to: string | null; actorId: string | null; actorName: string | null; createdAt: Date }) => ({
      id: r.id,
      action: r.action,
      from: r.from,
      to: r.to,
      actorId: r.actorId,
      actorName: r.actorName,
      createdAt: isoUtc(r.createdAt),
    })),
    total,
    page: p,
    pageSize: ps,
    hasMore: p * ps < total,
  };
}

/* ── History write (audit by default) — без PII и без полного sensitive snapshot ── */

interface HistoryActor {
  id: string;
  username: string;
}

export async function writeHistory(
  tx: Prisma.TransactionClient,
  model: HistoryModel,
  entityId: string,
  action: string,
  from: string | null,
  to: string | null,
  actor: HistoryActor,
  fields: Record<string, unknown>,
): Promise<void> {
  await (tx[model] as any).create({
    data: {
      ...(model === "leadHistory"
        ? { leadId: entityId }
        : model === "opportunityHistory"
          ? { opportunityId: entityId }
          : model === "quoteHistory"
            ? { quoteId: entityId }
            : model === "saleHistory"
              ? { saleId: entityId }
              : { checkoutIntentId: entityId }),
      action,
      from,
      to,
      fields: (Object.keys(fields).length > 0 ? fields : null) as Prisma.InputJsonValue | null,
      actorId: actor.id,
      actorName: actor.username,
    },
  });
}
