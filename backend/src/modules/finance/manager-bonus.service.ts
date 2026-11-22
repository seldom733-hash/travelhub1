import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DealsService } from "./deals.service";

export interface BonusPeriod {
  period: string;
  start: Date;
  end: Date;
}

function periodBounds(raw?: string): BonusPeriod {
  const value = raw ?? new Date().toISOString().slice(0, 7);
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) throw new BadRequestException("period must be YYYY-MM");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new BadRequestException("period month must be 01..12");
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { period: `${year}-${String(month).padStart(2, "0")}`, start, end };
}

@Injectable()
export class ManagerBonusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deals: DealsService,
  ) {}

  async list(rawPeriod?: string) {
    const bounds = periodBounds(rawPeriod);
    const [base, saved, managers] = await Promise.all([
      this.deals.closedMarginsByManager(bounds.start, bounds.end),
      this.prisma.managerBonus.findMany({ where: { periodStart: bounds.start, periodEnd: bounds.end } }),
      this.prisma.user.findMany({ where: { status: "ACTIVE", role: { code: "SALES_MANAGER" } }, select: { id: true, fullName: true, username: true } }),
    ]);
    const baseById = new Map(base.map((row) => [row.managerId, row]));
    const savedById = new Map(saved.map((row) => [row.managerId, row]));
    const ids = new Set<string>([...base.map((row) => row.managerId), ...managers.map((user) => user.id), ...saved.map((row) => row.managerId)]);
    const nameById = new Map(managers.map((user) => [user.id, user.fullName ?? user.username]));
    const items = [...ids].map((managerId) => {
      const aggregate = baseById.get(managerId);
      const rate = savedById.get(managerId);
      const percent = Number(rate?.percent ?? 0);
      const marginBase = aggregate?.marginBase ?? 0;
      return {
        managerId,
        manager: aggregate?.manager ?? nameById.get(managerId) ?? rate?.managerName ?? "—",
        closedDeals: aggregate?.closedDeals ?? 0,
        closedServices: aggregate?.closedServices ?? 0,
        marginBase,
        percent,
        bonusAmount: Math.round(marginBase * percent) / 100,
        saved: Boolean(rate),
      };
    }).sort((a, b) => b.marginBase - a.marginBase || a.manager.localeCompare(b.manager));

    return {
      period: bounds.period,
      start: bounds.start.toISOString().slice(0, 10),
      end: new Date(bounds.end.getTime() - 1).toISOString().slice(0, 10),
      formula: "bonus = sum(grossMargin of closed deals in period) × percent / 100",
      items,
    };
  }

  async save(input: { managerId?: string; period?: string; percent?: number | string }) {
    const managerId = String(input.managerId ?? "").trim();
    if (!managerId) throw new BadRequestException("managerId is required");
    const percent = Number(input.percent ?? 0);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new BadRequestException("percent must be between 0 and 100");
    const bounds = periodBounds(input.period);
    const user = await this.prisma.user.findUnique({ where: { id: managerId }, select: { fullName: true, username: true } });
    if (!user) throw new BadRequestException("manager not found");
    const base = (await this.deals.closedMarginsByManager(bounds.start, bounds.end)).find((row) => row.managerId === managerId);
    const marginBase = base?.marginBase ?? 0;
    const bonusAmount = Math.round(marginBase * percent) / 100;
    const managerName = base?.manager ?? user.fullName ?? user.username;
    const row = await this.prisma.managerBonus.upsert({
      where: { managerId_periodStart_periodEnd: { managerId, periodStart: bounds.start, periodEnd: bounds.end } },
      create: {
        managerId,
        managerName,
        periodStart: bounds.start,
        periodEnd: bounds.end,
        percent,
        closedDeals: base?.closedDeals ?? 0,
        closedServices: base?.closedServices ?? 0,
        marginBase,
        bonusAmount,
      },
      update: {
        managerName,
        percent,
        closedDeals: base?.closedDeals ?? 0,
        closedServices: base?.closedServices ?? 0,
        marginBase,
        bonusAmount,
      },
    });
    return {
      managerId,
      manager: managerName,
      closedDeals: row.closedDeals,
      closedServices: row.closedServices,
      marginBase: Number(row.marginBase),
      percent: Number(row.percent),
      bonusAmount: Number(row.bonusAmount),
      saved: true,
    };
  }
}
