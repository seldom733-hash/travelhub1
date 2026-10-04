import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { loadWhatsAppConfig, type WhatsAppConfig } from "../whatsapp.config";
import { WhatsAppLeaseError, WhatsAppSessionLeaseService, type LeaseHandle } from "../lease/session-lease.service";
import { WhatsAppSessionOwnershipService } from "./session-ownership.service";

type AnyFn = (...args: never[]) => Promise<unknown>;

interface FakeLease {
  instanceId: string;
  acquire: jest.Mock<AnyFn>;
  renew: jest.Mock<AnyFn>;
  release: jest.Mock<AnyFn>;
  getOwner: jest.Mock<AnyFn>;
  assertOwnership: jest.Mock<AnyFn>;
}

function createFakeLease(): FakeLease {
  return {
    instanceId: "fake-instance",
    acquire: jest.fn<AnyFn>(),
    renew: jest.fn<AnyFn>(),
    release: jest.fn<AnyFn>(),
    getOwner: jest.fn<AnyFn>(),
    assertOwnership: jest.fn<AnyFn>(),
  };
}

function leaseHandle(token = 1): LeaseHandle {
  return { instanceId: "fake-instance", fencingToken: token, expiresAt: new Date(Date.now() + 45_000) };
}

function config(heartbeatMs = 10_000): WhatsAppConfig {
  return loadWhatsAppConfig({ WHATSAPP_LEASE_HEARTBEAT_MS: String(heartbeatMs) });
}

describe("WhatsAppSessionOwnershipService (M2)", () => {
  let fake: FakeLease;
  let service: WhatsAppSessionOwnershipService;

  const asLease = (value: FakeLease): WhatsAppSessionLeaseService =>
    value as unknown as WhatsAppSessionLeaseService;

  beforeEach(() => {
    fake = createFakeLease();
    fake.acquire.mockResolvedValue(leaseHandle(1));
    fake.renew.mockResolvedValue(leaseHandle(1));
    fake.assertOwnership.mockResolvedValue(undefined);
    fake.release.mockResolvedValue(undefined);
    service = new WhatsAppSessionOwnershipService(asLease(fake), config());
  });

  afterEach(async () => {
    await service.onApplicationShutdown();
  });

  it("ensureOwnership: приобретает аренду и помечает активное владение", async () => {
    expect(service.isActive).toBe(false);
    const handle = await service.ensureOwnership();
    expect(handle.fencingToken).toBe(1);
    expect(service.isActive).toBe(true);
    expect(service.current?.fencingToken).toBe(1);
  });

  it("assertActive: без владения → lease_lost; с владением → сверяет токен с БД", async () => {
    await expect(service.assertActive()).rejects.toThrow(WhatsAppLeaseError);
    await service.ensureOwnership();
    await expect(service.assertActive()).resolves.toMatchObject({ fencingToken: 1 });
    expect(fake.assertOwnership).toHaveBeenCalledWith({
      instanceId: "fake-instance",
      fencingToken: 1,
      expiresAt: expect.any(Date),
    });
  });

  it("self-fencing: неудачный heartbeat → владение снято, assertActive падает", async () => {
    const shortService = new WhatsAppSessionOwnershipService(asLease(fake), config(5));
    try {
      await shortService.ensureOwnership();
      fake.renew.mockRejectedValueOnce(new WhatsAppLeaseError("lease_lost", "stolen"));
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(shortService.isActive).toBe(false);
      expect(shortService.isLost).toBe(true);
      await expect(shortService.assertActive()).rejects.toThrow(WhatsAppLeaseError);
    } finally {
      await shortService.onApplicationShutdown();
    }
    // Основной сервис не затронут.
    expect(service.isActive).toBe(false);
  });

  it("self-fencing событие: onLost получает причину ровно один раз", async () => {
    const shortService = new WhatsAppSessionOwnershipService(asLease(fake), config(5));
    const reasons: string[] = [];
    shortService.onLost((reason) => reasons.push(reason));
    try {
      await shortService.ensureOwnership();
      fake.renew.mockRejectedValueOnce(new WhatsAppLeaseError("lease_lost", "expired"));
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(reasons).toEqual(["expired"]);
      expect(shortService.isActive).toBe(false);
      // Последующие tick-и не спамят (tick выключен после markLost).
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(reasons).toEqual(["expired"]);
    } finally {
      await shortService.onApplicationShutdown();
    }
  });

  it("release: снимает владение, вызывает lease.release, идемпотентен", async () => {
    await service.ensureOwnership();
    await service.release();
    expect(fake.release).toHaveBeenCalledTimes(1);
    expect(service.isActive).toBe(false);
    expect(service.current).toBeNull();
    await service.release();
    expect(fake.release).toHaveBeenCalledTimes(1);
  });

  it("ensureOwnership после потери переприобретает аренду", async () => {
    const shortService = new WhatsAppSessionOwnershipService(asLease(fake), config(5));
    try {
      await shortService.ensureOwnership();
      fake.renew.mockRejectedValueOnce(new WhatsAppLeaseError("lease_lost", "stolen"));
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(shortService.isLost).toBe(true);
      fake.acquire.mockResolvedValueOnce(leaseHandle(2));
      const handle = await shortService.ensureOwnership();
      expect(handle.fencingToken).toBe(2);
      expect(shortService.isActive).toBe(true);
      expect(shortService.isLost).toBe(false);
    } finally {
      await shortService.onApplicationShutdown();
    }
  });
});
