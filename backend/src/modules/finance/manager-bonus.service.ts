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

function parsePeriods(rawPeriods?: string | string[], rawPeriod?: string): BonusPeriod[] {
  const values = Array.isArray(rawPeriods)
    ? rawPeriods
    : rawPeriods
      ? rawPeriods.split(",")
      : rawPeriod
        ? [rawPeriod]
        : [new Date().toISOString().slice(0, 7)];
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
  if (unique.length === 0) unique.push(new Date().toISOString().slice(0, 7));
  return unique.map(periodBounds);
}

@Injectable()
export class ManagerBonusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deals: DealsService,
  ) {}

  private basis(raw?: string): "closed_at" | "service_completed" {
    if (!raw || raw === "closed_at") return "closed_at";
    if (raw === "service_completed") return "service_completed";
    throw new BadRequestException("basis must be closed_at or service_completed");
  }

  async list(rawPeriods?: string | string[], rawBasis?: string, rawPeriod?: string) {
    const periods = parsePeriods(rawPeriods, rawPeriod);
    const basis = this.basis(rawBasis);
    const bases = await Promise.all(periods.map((period) => this.deals.bonusMarginsByManager(period.start, period.end, basis)));
    const merged = new Map<string, { managerId: string; manager: string; closedDeals: number; closedServices: number; marginBase: number }>();
    for (const rows of bases) {
      for (const row of rows) {
        const current = merged.get(row.managerId) ?? { ...row, closedDeals: 0, closedServices: 0, marginBase: 0 };
        current.closedDeals += row.closedDeals;
        current.closedServices += row.closedServices;
        current.marginBase += row.marginBase;
        merged.set(row.managerId, current);
      }
    }
    const [saved, managers] = await Promise.all([
      this.prisma.managerBonus.findMany({
        where: { basis, OR: periods.map((period) => ({ periodStart: period.start, periodEnd: period.end })) },
        orderBy: { updatedAt: "asc" },
      }),
      this.prisma.user.findMany({ where: { status: "ACTIVE", role: { code: "SALES_MANAGER" } }, select: { id: true, fullName: true, username: true } }),
    ]);
    const savedById = new Map(saved.map((row) => [row.managerId, row]));
    const ids = new Set<string>([...merged.keys(), ...managers.map((user) => user.id), ...saved.map((row) => row.managerId)]);
    const nameById = new Map(managers.map((user) => [user.id, user.fullName ?? user.username]));
    const items = [...ids].map((managerId) => {
      const aggregate = merged.get(managerId);
      const rate = savedById.get(managerId);
      const percent = Number(rate?.percent ?? 0);
      const marginBase = Math.round((aggregate?.marginBase ?? 0) * 100) / 100;
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
      period: periods.map((period) => period.period).join(","),
      periods: periods.map((period) => period.period),
      basis,
      start: periods[0].start.toISOString().slice(0, 10),
      end: new Date(periods[periods.length - 1].end.getTime() - 1).toISOString().slice(0, 10),
      formula: "bonus = sum(margin of selected periods) × percent / 100",
      items,
    };
  }

  async save(input: { managerId?: string; period?: string; periods?: string[] | string; percent?: number | string; basis?: string }) {
    const managerId = String(input.managerId ?? "").trim();
    if (!managerId) throw new BadRequestException("managerId is required");
    const percent = Number(input.percent ?? 0);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new BadRequestException("percent must be between 0 and 100");
    const periods = parsePeriods(input.periods, input.period);
    const basis = this.basis(input.basis);
    const user = await this.prisma.user.findUnique({ where: { id: managerId }, select: { fullName: true, username: true } });
    if (!user) throw new BadRequestException("manager not found");
    let totalDeals = 0;
    let totalServices = 0;
    let totalMargin = 0;
    let managerName = user.fullName ?? user.username;
    for (const period of periods) {
      const base = (await this.deals.bonusMarginsByManager(period.start, period.end, basis)).find((row) => row.managerId === managerId);
      const marginBase = base?.marginBase ?? 0;
      managerName = base?.manager ?? managerName;
      totalDeals += base?.closedDeals ?? 0;
      totalServices += base?.closedServices ?? 0;
      totalMargin += marginBase;
      await this.prisma.managerBonus.upsert({
        where: { managerId_periodStart_periodEnd_basis: { managerId, periodStart: period.start, periodEnd: period.end, basis } },
        create: { managerId, managerName, periodStart: period.start, periodEnd: period.end, basis, percent, closedDeals: base?.closedDeals ?? 0, closedServices: base?.closedServices ?? 0, marginBase, bonusAmount: Math.round(marginBase * percent) / 100 },
        update: { managerName, basis, percent, closedDeals: base?.closedDeals ?? 0, closedServices: base?.closedServices ?? 0, marginBase, bonusAmount: Math.round(marginBase * percent) / 100 },
      });
    }
    const marginBase = Math.round(totalMargin * 100) / 100;
    return {
      managerId,
      basis,
      periods: periods.map((period) => period.period),
      manager: managerName,
      closedDeals: totalDeals,
      closedServices: totalServices,
      marginBase,
      percent,
      bonusAmount: Math.round(marginBase * percent) / 100,
      saved: true,
    };
  }
}
