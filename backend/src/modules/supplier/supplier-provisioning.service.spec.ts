import { SupplierProvisioningService } from "./supplier-provisioning.service";
import type { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";
import type { FlightSupplierRegistry } from "./flight-supplier.registry";
import type { CrmService } from "../crm/crm.service";
import type { PrismaService } from "../../prisma/prisma.service";

/**
 * Supplier CRM auto-provisioning tests (§Партнёры/§Курсы поставщиков).
 *
 * Contract under test:
 *  - every registered adapter code gets a CRM Partner by its canonical name
 *    from SUPPLIER_TOKEN_CRM_NAMES (case-insensitive match, suppliers of one
 *    provider share ONE partner);
 *  - existing partners (any status, incl. INACTIVE FSTravel) are untouched;
 *  - a missing partner is created via CrmService.createPartner (PRN code +
 *    default FX rates in one transaction);
 *  - CRM/DB failures never break the boot (warn only).
 */

interface MockDeps {
  registry: { getEntries: jest.Mock };
  flightRegistry: { list: jest.Mock };
  crm: { createPartner: jest.Mock };
  prisma: { partner: { findFirst: jest.Mock } };
}

function makeDeps(entries: Array<{ code: string }> = [], flightCodes: string[] = []): MockDeps {
  return {
    registry: {
      getEntries: jest.fn().mockReturnValue(entries.map((e) => ({ adapter: { code: e.code }, config: {} }))),
    },
    flightRegistry: { list: jest.fn().mockReturnValue(flightCodes) },
    crm: { createPartner: jest.fn() },
    prisma: { partner: { findFirst: jest.fn().mockResolvedValue(null) } },
  };
}

function makeService(deps: MockDeps): SupplierProvisioningService {
  return new SupplierProvisioningService(
    deps.registry as unknown as SupplierAdapterRegistry,
    deps.flightRegistry as unknown as FlightSupplierRegistry,
    deps.crm as unknown as CrmService,
    deps.prisma as unknown as PrismaService,
  );
}

/** Cheap logger stub so Nest's Logger doesn't print during tests. */
function silenceLogger(service: SupplierProvisioningService): void {
  (service as unknown as { logger: { log: jest.Mock; warn: jest.Mock; debug: jest.Mock } }).logger = {
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
}

describe("SupplierProvisioningService", () => {
  it("creates a partner for a missing supplier via canonical CRM name", async () => {
    const deps = makeDeps([{ code: "VOYAGER" }]);
    deps.crm.createPartner.mockResolvedValue({ code: "PRN-00000012", name: "Voyager", status: "ACTIVE" });

    const svc = makeService(deps);
    silenceLogger(svc);
    await svc.onModuleInit();

    expect(deps.prisma.partner.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { equals: "Voyager", mode: "insensitive" } },
      }),
    );
    expect(deps.crm.createPartner).toHaveBeenCalledTimes(1);
    expect(deps.crm.createPartner).toHaveBeenCalledWith("Voyager");
  });

  it("skips an existing partner regardless of status (INACTIVE stays inactive)", async () => {
    const deps = makeDeps([{ code: "FSTRAVEL" }]);
    deps.prisma.partner.findFirst.mockResolvedValue({
      id: "p5",
      code: "PRN-00000005",
      name: "FSTravel",
      status: "INACTIVE",
    });

    const svc = makeService(deps);
    silenceLogger(svc);
    await svc.onModuleInit();

    expect(deps.crm.createPartner).not.toHaveBeenCalled();
  });

  it("matches the partner case-insensitively («kompastour» vs «Kompastour»)", async () => {
    const deps = makeDeps([{ code: "KOMPAS" }]);
    deps.prisma.partner.findFirst.mockResolvedValue({
      id: "p4",
      code: "PRN-00000003",
      name: "Kompastour",
      status: "ACTIVE",
    });

    const svc = makeService(deps);
    silenceLogger(svc);
    await svc.onModuleInit();

    expect(deps.prisma.partner.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { equals: "Kompastour", mode: "insensitive" } },
      }),
    );
    expect(deps.crm.createPartner).not.toHaveBeenCalled();
  });

  it("registers one partner per UNIQUE code (tours + hotels adapters share it)", async () => {
    const deps = makeDeps([{ code: "KOMPAS" }, { code: "KOMPAS" }, { code: "VOYAGER" }]);
    deps.crm.createPartner.mockResolvedValue({ code: "PRN-X", name: "Voyager" });

    const svc = makeService(deps);
    silenceLogger(svc);
    await svc.onModuleInit();

    // 3 entries → 2 unique codes (KOMPAS, VOYAGER) → exactly 2 creates:
    // one per provider, never per category adapter.
    expect(deps.crm.createPartner).toHaveBeenCalledTimes(2);
    const names = deps.crm.createPartner.mock.calls.map((c) => c[0]);
    expect(names).toEqual(["Kompastour", "Voyager"]);
  });

  it("also provisions flight suppliers from the flight registry", async () => {
    const deps = makeDeps([{ code: "VOYAGER" }], ["AZAL", "AVIASALES"]);
    deps.crm.createPartner.mockResolvedValue({ code: "PRN-X", name: "Azal" });

    const svc = makeService(deps);
    silenceLogger(svc);
    await svc.onModuleInit();

    const names = deps.crm.createPartner.mock.calls.map((c) => c[0]);
    expect(names).toContain("AZAL");
    expect(names).toContain("Aviasales");
    expect(names).toContain("Voyager");
  });

  it("falls back to the adapter code when no canonical name is mapped", async () => {
    const deps = makeDeps([{ code: "MYNEW" }]);
    deps.crm.createPartner.mockResolvedValue({ code: "PRN-X", name: "MYNEW" });

    const svc = makeService(deps);
    silenceLogger(svc);
    await svc.onModuleInit();

    expect(deps.crm.createPartner).toHaveBeenCalledWith("MYNEW");
  });

  it("does NOT fail the boot when the CRM lookup throws (warn only)", async () => {
    const deps = makeDeps([{ code: "VOYAGER" }]);
    deps.prisma.partner.findFirst.mockRejectedValue(new Error("DB down"));

    const svc = makeService(deps);
    const logger = silenceLoggerSilently(svc);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("DB down"));
    expect(deps.crm.createPartner).not.toHaveBeenCalled();
  });

  it("does NOT fail the boot when createPartner throws (warn only)", async () => {
    const deps = makeDeps([{ code: "VOYAGER" }]);
    deps.crm.createPartner.mockRejectedValue(new Error("unique violation"));

    const svc = makeService(deps);
    const logger = silenceLoggerSilently(svc);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("unique violation"));
  });

  it("no-ops cleanly when nothing is registered", async () => {
    const deps = makeDeps();
    const svc = makeService(deps);
    silenceLogger(svc);
    await svc.onModuleInit();
    expect(deps.crm.createPartner).not.toHaveBeenCalled();
  });
});

type LoggerLike = { log: jest.Mock; warn: jest.Mock; debug: jest.Mock };

function silenceLoggerSilently(service: SupplierProvisioningService): LoggerLike {
  const logger: LoggerLike = { log: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  (service as unknown as { logger: LoggerLike }).logger = logger;
  return logger;
}
