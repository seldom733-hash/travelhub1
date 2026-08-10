import { ValidationDomainError } from "../../shared/errors";
import { LeadStatus, OpportunityStatus, QuoteStatus, SaleStatus } from "../../generated/prisma/enums";
import {
  buildLeadListWhere,
  buildOpportunityListWhere,
  buildQuoteListWhere,
  buildSaleListWhere,
  containsSearch,
  createdAtRange,
  SALES_QUEUES,
  SALES_QUEUE_KEYS,
  salesOrderBy,
} from "./sales.filters";

describe("Sales Center — createdAtRange", () => {
  it("без from/to → {} (без фильтра)", () => {
    expect(createdAtRange()).toEqual({});
    expect(createdAtRange(undefined, undefined)).toEqual({});
  });

  it("валидный диапазон → inclusive gte/lte (UTC instants)", () => {
    const r = createdAtRange("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z");
    expect(r).toEqual({ createdAt: { gte: new Date("2026-01-01T00:00:00.000Z"), lte: new Date("2026-02-01T00:00:00.000Z") } });
    expect(createdAtRange("2026-01-01T00:00:00.000Z")).toEqual({ createdAt: { gte: new Date("2026-01-01T00:00:00.000Z") } });
  });

  it("from > to → 422 (ValidationDomainError)", () => {
    expect(() => createdAtRange("2026-02-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toThrow(ValidationDomainError);
  });
});

describe("Sales Center — containsSearch", () => {
  it("undefined/пустой → {}; trim; cap 80", () => {
    expect(containsSearch("name", undefined)).toEqual({});
    expect(containsSearch("name", "   ")).toEqual({});
    const r = containsSearch("name", "  Иван  ") as { name: { contains: string; mode: string } };
    expect(r.name.contains).toBe("Иван");
    expect(r.name.mode).toBe("insensitive");
    const long = containsSearch("name", "x".repeat(200)) as { name: { contains: string } };
    expect(long.name.contains).toHaveLength(80);
  });
});

describe("Sales Center — salesOrderBy", () => {
  it("default: createdAt desc + code asc tie-breaker; невалидное поле → fallback на createdAt, направление сохраняется", () => {
    expect(salesOrderBy()).toEqual([{ createdAt: "desc" }, { code: "asc" }]);
    expect(salesOrderBy("zzz")).toEqual([{ createdAt: "desc" }, { code: "asc" }]);
    expect(salesOrderBy("zzz", "asc")).toEqual([{ createdAt: "asc" }, { code: "asc" }]);
  });
  it("code sort → только code (без дублирующего tie-breaker)", () => {
    expect(salesOrderBy("code", "asc")).toEqual([{ code: "asc" }]);
    expect(salesOrderBy("code", "desc")).toEqual([{ code: "desc" }]);
  });
  it("status/createdAt сортировка + направление", () => {
    expect(salesOrderBy("status", "asc")).toEqual([{ status: "asc" }, { code: "asc" }]);
    expect(salesOrderBy("createdAt", "asc")).toEqual([{ createdAt: "asc" }, { code: "asc" }]);
  });
});

describe("Sales Center — whitelist where-builders", () => {
  it("Lead: status/assignedToId/customerId/code/range/search", () => {
    const w = buildLeadListWhere({
      status: LeadStatus.NEW,
      assignedToId: "u1",
      customerId: "c1",
      code: "LED-00000001",
      from: "2026-01-01T00:00:00.000Z",
      search: "  кавказ ",
    });
    expect(w.status).toBe(LeadStatus.NEW);
    expect(w.assignedToId).toBe("u1");
    expect(w.customerId).toBe("c1");
    expect(w.code).toBe("LED-00000001");
    expect((w.createdAt as { gte?: Date }).gte).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect((w as { name?: { contains: string } }).name?.contains).toBe("кавказ");
    // Неизвестные поля игнорируются (whitelist).
    const empty = buildLeadListWhere({});
    expect(Object.keys(empty)).toHaveLength(0);
  });

  it("Opportunity/Quote/Sale: релевантные refs без money/order/booking полей", () => {
    const opp = buildOpportunityListWhere({ status: OpportunityStatus.OPEN, leadId: "led1", customerId: "c1" });
    expect(opp).toMatchObject({ status: OpportunityStatus.OPEN, leadId: "led1", customerId: "c1" });
    expect(opp).not.toHaveProperty("amount");

    const quote = buildQuoteListWhere({ status: QuoteStatus.DRAFT, productId: "prd1", opportunityId: "opp1" });
    expect(quote).toMatchObject({ status: QuoteStatus.DRAFT, productId: "prd1", opportunityId: "opp1" });
    expect(quote).not.toHaveProperty("price");

    const sale = buildSaleListWhere({ quoteId: "qte1", customerId: "c1" });
    expect(sale).toMatchObject({ quoteId: "qte1", customerId: "c1" });
    expect(sale).not.toHaveProperty("paidAmount");
  });
});

describe("Sales Center — queues", () => {
  it("9 operational queue-ключей, статусные predicates из canonical lifecycle", () => {
    expect(SALES_QUEUE_KEYS).toHaveLength(9);
    expect(SALES_QUEUES.NEW_LEADS).toMatchObject({ entity: "lead", status: LeadStatus.NEW, permission: "sales.lead.read" });
    expect(SALES_QUEUES.UNASSIGNED_LEADS).toMatchObject({ entity: "lead", status: LeadStatus.NEW, unassigned: true });
    expect(SALES_QUEUES.OPEN_SALES).toMatchObject({ entity: "sale", status: SaleStatus.OPEN, permission: "sales.sale.read" });
    expect(SALES_QUEUES.ISSUED_QUOTES).toMatchObject({ entity: "quote", status: QuoteStatus.ISSUED });
    // Никаких awaiting-payment/booking/fulfillment очередей (фактов нет).
    expect(SALES_QUEUE_KEYS.some((k) => k.toLowerCase().includes("payment") || k.toLowerCase().includes("booking") || k.toLowerCase().includes("fulfill"))).toBe(false);
  });
});
