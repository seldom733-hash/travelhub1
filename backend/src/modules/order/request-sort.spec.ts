/**
 * UI-C1.2F.1G — Requests backend sorting tests.
 *
 * Two layers:
 *  1. request-sort contract (real module): allowlist mapping, default sort,
 *     `id` tie-breaker, strict validation of disallowed sortBy / malformed
 *     sortDirection.
 *  2. RequestService.listRequests scope combos with a fake Prisma: proves the
 *     list endpoint really composes sorting with status / period / search /
 *     pagination into one server query (no DB connection required).
 *
 * Requests HTTP convention: malformed sort params → BadRequestException (400),
 * the same canonical validation failure Requests dates use (UI-C1.2F.1A).
 */

import { RequestService } from "./request.service";
import {
  REQUEST_SORT_ALLOWLIST,
  REQUEST_DEFAULT_SORT,
  assertValidRequestSort,
  buildRequestOrderBy,
} from "./request-sort";
import { BadRequestException } from "@nestjs/common";

/** Canonical sortable fields from the UI-C1.2F.1G spec (section 10). */
const EXPECTED_ALLOWLIST = {
  referenceNumber: "referenceNumber",
  displayedPrice: "displayedPrice",
  confirmedPrice: "confirmedPrice",
  serviceDate: "requestedServiceDate", // URL key → actual Prisma field
  status: "status",
  createdAt: "createdAt",
  slaDeadline: "supplierResponseDeadline", // URL key → actual Prisma field
};

/** Deterministic tie-breaker appended to every primary sort. */
const TIE_BREAKER = { id: "desc" as const };

function createService(capture: { findManyArgs?: unknown; countWhere?: unknown }) {
  const prisma = {
    request: {
      findMany: jest.fn(async (args: unknown) => {
        capture.findManyArgs = args;
        return [];
      }),
      count: jest.fn(async (args: unknown) => {
        capture.countWhere = (args as { where?: unknown })?.where;
        return 0;
      }),
    },
    customer: { findMany: jest.fn(async () => []) },
    product: { findMany: jest.fn(async () => []) },
    partner: { findMany: jest.fn(async () => []) },
  };
  // RequestService listRequests touches only prisma.request (plus customer/
  // product/partner name resolution when a search term is present); the other
  // constructor deps (ids/refNum/security/eventBus/orders) are not used here.
  const service = new RequestService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, prisma };
}

describe("UI-C1.2F.1G — Requests sort contract", () => {
  it("allowlist contains exactly the 7 canonical sortable fields mapped to Prisma fields", () => {
    expect(REQUEST_SORT_ALLOWLIST).toEqual(EXPECTED_ALLOWLIST);
    // Explicit URL-key → Prisma-field mapping is required for every entry —
    // no raw URL key can be forwarded to Prisma (spec §10/§30).
    for (const [urlKey, prismaField] of Object.entries(REQUEST_SORT_ALLOWLIST)) {
      expect(typeof urlKey).toBe("string");
      expect(typeof prismaField).toBe("string");
    }
  });

  it("T1 — default sort is createdAt desc with id tie-breaker", () => {
    expect(REQUEST_DEFAULT_SORT).toEqual({ createdAt: "desc" });
    expect(buildRequestOrderBy(undefined, undefined)).toEqual([
      { createdAt: "desc" },
      TIE_BREAKER,
    ]);
    // empty strings behave like absent params (URL normalization) — same default
    expect(buildRequestOrderBy("", "")).toEqual([{ createdAt: "desc" }, TIE_BREAKER]);
  });

  it("T2 — referenceNumber asc/desc", () => {
    expect(buildRequestOrderBy("referenceNumber", "asc")).toEqual([
      { referenceNumber: "asc" },
      TIE_BREAKER,
    ]);
    expect(buildRequestOrderBy("referenceNumber", "desc")).toEqual([
      { referenceNumber: "desc" },
      TIE_BREAKER,
    ]);
  });

  it("T3 — displayedPrice asc/desc", () => {
    expect(buildRequestOrderBy("displayedPrice", "asc")).toEqual([
      { displayedPrice: "asc" },
      TIE_BREAKER,
    ]);
    expect(buildRequestOrderBy("displayedPrice", "desc")).toEqual([
      { displayedPrice: "desc" },
      TIE_BREAKER,
    ]);
  });

  it("T4 — confirmedPrice asc/desc", () => {
    expect(buildRequestOrderBy("confirmedPrice", "asc")).toEqual([
      { confirmedPrice: "asc" },
      TIE_BREAKER,
    ]);
    expect(buildRequestOrderBy("confirmedPrice", "desc")).toEqual([
      { confirmedPrice: "desc" },
      TIE_BREAKER,
    ]);
  });

  it("T5 — serviceDate maps to the actual Prisma field requestedServiceDate", () => {
    expect(buildRequestOrderBy("serviceDate", "asc")).toEqual([
      { requestedServiceDate: "asc" },
      TIE_BREAKER,
    ]);
    expect(buildRequestOrderBy("serviceDate", "desc")).toEqual([
      { requestedServiceDate: "desc" },
      TIE_BREAKER,
    ]);
  });

  it("T6 — status asc/desc", () => {
    expect(buildRequestOrderBy("status", "asc")).toEqual([{ status: "asc" }, TIE_BREAKER]);
    expect(buildRequestOrderBy("status", "desc")).toEqual([{ status: "desc" }, TIE_BREAKER]);
  });

  it("T7 — createdAt asc/desc", () => {
    expect(buildRequestOrderBy("createdAt", "asc")).toEqual([{ createdAt: "asc" }, TIE_BREAKER]);
    expect(buildRequestOrderBy("createdAt", "desc")).toEqual([
      { createdAt: "desc" },
      TIE_BREAKER,
    ]);
  });

  it("T8 — slaDeadline maps to the actual Prisma field supplierResponseDeadline", () => {
    expect(buildRequestOrderBy("slaDeadline", "asc")).toEqual([
      { supplierResponseDeadline: "asc" },
      TIE_BREAKER,
    ]);
    expect(buildRequestOrderBy("slaDeadline", "desc")).toEqual([
      { supplierResponseDeadline: "desc" },
      TIE_BREAKER,
    ]);
  });

  it("T9 — every sort mode appends the id tie-breaker (stable pagination)", () => {
    for (const field of Object.keys(EXPECTED_ALLOWLIST)) {
      for (const dir of ["asc", "desc"] as const) {
        const orderBy = buildRequestOrderBy(field, dir);
        expect(orderBy).toHaveLength(2);
        expect(orderBy[orderBy.length - 1]).toEqual(TIE_BREAKER);
      }
    }
  });

  it("T10 — a directionless sort defaults to desc (parseSortDirection shared rule)", () => {
    expect(buildRequestOrderBy("createdAt", undefined)).toEqual([
      { createdAt: "desc" },
      TIE_BREAKER,
    ]);
  });

  it("T11 — case-insensitive directions are accepted (ASC/Desc)", () => {
    expect(() => assertValidRequestSort("referenceNumber", "ASC")).not.toThrow();
    expect(() => assertValidRequestSort("referenceNumber", "Desc")).not.toThrow();
    expect(buildRequestOrderBy("referenceNumber", "ASC")).toEqual([
      { referenceNumber: "asc" },
      TIE_BREAKER,
    ]);
  });

  it("T12 — disallowed sortBy raises the canonical validation failure (400)", () => {
    // customer/product/supplier are NOT backend-safe sort keys per the stage audit
    for (const bad of [
      "customer",
      "product",
      "supplier",
      "customerName",
      "productName",
      "partnerName",
      "id",
      "code",
    ]) {
      expect(() => assertValidRequestSort(bad, "asc")).toThrow(BadRequestException);
    }
  });

  it("T13 — injection/security attempts never pass validation (spec §30)", () => {
    for (const raw of [
      "__proto__",
      "constructor",
      "tenantId",
      "customerId",
      "partnerId",
      'status; DROP TABLE "order"."Request"',
      "ORDER BY (SELECT 1)",
    ]) {
      expect(() => assertValidRequestSort(raw, "asc")).toThrow(BadRequestException);
    }
    for (const raw of ["DROP", "DROP TABLE requests", "asc; SELECT 1", "none"]) {
      expect(() => assertValidRequestSort("createdAt", raw)).toThrow(BadRequestException);
    }
  });

  it("T14 — invalid sortBy cannot reach the query builder even if asserted twice", () => {
    // The service calls assertValidRequestSort BEFORE buildRequestOrderBy, but the
    // builder itself stays injection-safe as the shared fallback defense-in-depth.
    expect(() => assertValidRequestSort("tenantId", "asc")).toThrow(BadRequestException);
    // Unvalidated input still degrades to the default (shared buildSortClause fallback)
    expect(buildRequestOrderBy("tenantId", "asc")).toEqual([{ createdAt: "desc" }, TIE_BREAKER]);
  });

  it("T15 — nullable column sorts emit no explicit nulls clause (DB-default ordering documented)", () => {
    // displayedPrice/confirmedPrice/requestedServiceDate/supplierResponseDeadline
    // are nullable; no `nulls` instruction is added — PostgreSQL defaults apply
    // (ASC → NULLs last, DESC → NULLs first). Documented, not silently asserted.
    for (const field of ["displayedPrice", "confirmedPrice", "serviceDate", "slaDeadline"]) {
      for (const dir of ["asc", "desc"] as const) {
        const json = JSON.stringify(buildRequestOrderBy(field, dir));
        expect(json).not.toContain("nulls");
      }
    }
  });
});

describe("UI-C1.2F.1G — listRequests composes sorting with the active scope", () => {
  function capturedOrderBy(capture: { findManyArgs?: unknown }) {
    return (capture.findManyArgs as { orderBy?: unknown })?.orderBy;
  }
  function capturedWhere(capture: { findManyArgs?: unknown }) {
    return (capture.findManyArgs as { where?: unknown })?.where;
  }

  it("no sort params → server query keeps default createdAt desc + id tie-breaker", async () => {
    const capture: { findManyArgs?: unknown } = {};
    const { service } = createService(capture);
    await service.listRequests({ page: 1, pageSize: 20 });
    expect(capturedOrderBy(capture)).toEqual([{ createdAt: "desc" }, TIE_BREAKER]);
  });

  it("sort + status → one query with both status filter and sort order", async () => {
    const capture: { findManyArgs?: unknown } = {};
    const { service } = createService(capture);
    await service.listRequests({ status: "CHECKING", sortBy: "referenceNumber", sortDirection: "asc", page: 1, pageSize: 20 });
    const where = capturedWhere(capture) as Record<string, unknown>;
    expect(where.status).toBe("CHECKING");
    expect(capturedOrderBy(capture)).toEqual([{ referenceNumber: "asc" }, TIE_BREAKER]);
  });

  it("sort + date period → createdAt [from, to) filter coexists with the sort", async () => {
    const capture: { findManyArgs?: unknown } = {};
    const { service } = createService(capture);
    await service.listRequests({ dateFrom: "2026-09-01", dateTo: "2026-10-01", sortBy: "createdAt", sortDirection: "asc", page: 1, pageSize: 20 });
    const where = capturedWhere(capture) as { createdAt?: { gte?: Date; lt?: Date } };
    expect(where.createdAt?.gte).toEqual(new Date("2026-09-01"));
    expect(where.createdAt?.lt).toEqual(new Date("2026-10-01"));
    expect(capturedOrderBy(capture)).toEqual([{ createdAt: "asc" }, TIE_BREAKER]);
  });

  it("sort + search → search OR conditions coexist with the sort", async () => {
    const capture: { findManyArgs?: unknown } = {};
    const { service } = createService(capture);
    await service.listRequests({ search: "MKT-REQ-00000001", sortBy: "status", sortDirection: "desc", page: 1, pageSize: 20 });
    const where = capturedWhere(capture) as { OR?: unknown[] };
    expect(Array.isArray(where.OR)).toBe(true);
    expect(capturedOrderBy(capture)).toEqual([{ status: "desc" }, TIE_BREAKER]);
  });

  it("pagination with sort → skip/take derived from page/pageSize on the sorted query", async () => {
    const capture: { findManyArgs?: unknown } = {};
    const { service } = createService(capture);
    await service.listRequests({ status: "CONVERTED", sortBy: "displayedPrice", sortDirection: "asc", page: 3, pageSize: 20 });
    const args = capture.findManyArgs as { skip?: number; take?: number; orderBy?: unknown };
    expect(args.skip).toBe(40);
    expect(args.take).toBe(20);
    expect(args.orderBy).toEqual([{ displayedPrice: "asc" }, TIE_BREAKER]);
  });

  it("full combination: period + search + status + sort + page in one server query", async () => {
    const capture: { findManyArgs?: unknown } = {};
    const { service } = createService(capture);
    await service.listRequests({
      status: "CHECKING",
      search: "TH-2026",
      dateFrom: "2026-09-01",
      dateTo: "2026-10-01",
      sortBy: "serviceDate",
      sortDirection: "asc",
      page: 2,
      pageSize: 20,
    });
    const where = capturedWhere(capture) as {
      status?: string;
      createdAt?: { gte?: Date; lt?: Date };
      OR?: unknown[];
    };
    expect(where.status).toBe("CHECKING");
    expect(where.createdAt?.gte).toEqual(new Date("2026-09-01"));
    expect(where.createdAt?.lt).toEqual(new Date("2026-10-01"));
    expect(Array.isArray(where.OR)).toBe(true);
    const args = capture.findManyArgs as { skip?: number; take?: number; orderBy?: unknown };
    expect(args.skip).toBe(20);
    expect(capturedOrderBy(capture)).toEqual([{ requestedServiceDate: "asc" }, TIE_BREAKER]);
  });

  it("invalid sortBy through the service raises BadRequestException (canonical 400)", async () => {
    const capture: { findManyArgs?: unknown } = {};
    const { service } = createService(capture);
    await expect(
      service.listRequests({ sortBy: "tenantId", sortDirection: "asc", page: 1, pageSize: 20 }),
    ).rejects.toThrow(BadRequestException);
    expect(capture.findManyArgs).toBeUndefined(); // nothing reached the query builder
  });

  it("invalid sortDirection through the service raises BadRequestException (canonical 400)", async () => {
    const capture: { findManyArgs?: unknown } = {};
    const { service } = createService(capture);
    await expect(
      service.listRequests({ sortBy: "createdAt", sortDirection: "DROP", page: 1, pageSize: 20 }),
    ).rejects.toThrow(BadRequestException);
    expect(capture.findManyArgs).toBeUndefined();
  });

  it("export-sized call (pageSize 10000) keeps the default createdAt desc ordering", async () => {
    const capture: { findManyArgs?: unknown } = {};
    const { service } = createService(capture);
    await service.listRequests({ status: "CHECKING", page: 1, pageSize: 10000 });
    const args = capture.findManyArgs as { skip?: number; take?: number; orderBy?: unknown };
    expect(args.take).toBe(10000);
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, TIE_BREAKER]);
  });
});
