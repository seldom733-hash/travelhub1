import { describe, expect, it } from "@jest/globals";
import { loadWhatsAppConfig, type WhatsAppConfig } from "../whatsapp.config";
import {
  WhatsAppLeaseError,
  WhatsAppSessionLeaseService,
  whatsappLeaseKey,
  type LeasePrismaLike,
  type LeaseRow,
} from "./session-lease.service";

/** M5: тестовый ключ аренды (per-account формат). */
const KEY = "whatsapp:test-account";

/**
 * In-memory фейк Prisma с честной CAS-семантикой updateMany
 * (равенство полей + expiresAt.gt) для строк WhatsAppSessionLease.
 */
function createFakeLeasePrisma(): LeasePrismaLike & {
  row: LeaseRow | null;
  failNextCreateWith: unknown;
} {
  const state = { row: null as LeaseRow | null, failNextCreateWith: null as unknown };

  const matches = (row: LeaseRow, where: Record<string, unknown>): boolean => {
    for (const [field, condition] of Object.entries(where)) {
      const value = (row as unknown as Record<string, unknown>)[field];
      if (field === "expiresAt" && typeof condition === "object" && condition !== null) {
        const gt = (condition as { gt?: Date }).gt;
        if (gt && !(value instanceof Date) || (gt && value instanceof Date && value.getTime() <= gt.getTime())) return false;
      } else if (value !== condition) {
        return false;
      }
    }
    return true;
  };

  const api: LeasePrismaLike & { row: LeaseRow | null; failNextCreateWith: unknown } = {
    get row() {
      return state.row;
    },
    set row(value: LeaseRow | null) {
      state.row = value;
    },
    get failNextCreateWith() {
      return state.failNextCreateWith;
    },
    set failNextCreateWith(value: unknown) {
      state.failNextCreateWith = value;
    },
    async $transaction(fn) {
      return fn(api);
    },
    whatsAppSessionLease: {
      async findUnique({ where }) {
        if (state.row && state.row.key === where.key) return { ...state.row };
        return null;
      },
      async create({ data }) {
        if (state.failNextCreateWith) {
          const error = state.failNextCreateWith;
          state.failNextCreateWith = null;
          throw error;
        }
        if (state.row) throw Object.assign(new Error("unique"), { code: "P2002" });
        state.row = {
          key: String(data["key"]),
          instanceId: String(data["instanceId"]),
          fencingToken: Number(data["fencingToken"]),
          heartbeatAt: data["heartbeatAt"] as Date,
          expiresAt: data["expiresAt"] as Date,
        };
        return { ...state.row };
      },
      async updateMany({ where, data }) {
        if (!state.row || !matches(state.row, where)) return { count: 0 };
        state.row = {
          ...state.row,
          ...(data as Partial<LeaseRow>),
        };
        return { count: 1 };
      },
    },
  };
  return api;
}

function config(ttlMs = 45_000): WhatsAppConfig {
  return loadWhatsAppConfig({ WHATSAPP_LEASE_TTL_MS: String(ttlMs) });
}

describe("WhatsAppSessionLeaseService (M2)", () => {
  it("acquire: первая строка — токен 1, владелец = этот инстанс", async () => {
    const fake = createFakeLeasePrisma();
    const service = new WhatsAppSessionLeaseService(fake, config());
    const handle = await service.acquire(KEY);
    expect(handle.fencingToken).toBe(1);
    expect(handle.instanceId).toBe(service.instanceId);
    expect(fake.row?.instanceId).toBe(service.instanceId);
  });

  it("concurring instance: живая чужая аренда → not_owner", async () => {
    const fake = createFakeLeasePrisma();
    const a = new WhatsAppSessionLeasePrismaFactory(fake).service();
    await a.acquire(KEY);
    const b = new WhatsAppSessionLeasePrismaFactory(fake).service();
    const failure = await b.acquire(KEY).then(() => null, (error: unknown) => error);
    expect(failure).toBeInstanceOf(WhatsAppLeaseError);
    expect((failure as WhatsAppLeaseError).code).toBe("not_owner");
    // Токен прежнего владельца не изменился.
    expect(fake.row?.fencingToken).toBe(1);
    expect(fake.row?.instanceId).toBe(a.instanceId);
  });

  it("expiry: перехват истёкшей аренды → fencingToken+1 (монотонный рост)", async () => {
    const fake = createFakeLeasePrisma();
    const a = new WhatsAppSessionLeasePrismaFactory(fake).service();
    await a.acquire(KEY);
    // Истечение: подкручиваем строку напрямую.
    fake.row = { ...fake.row!, expiresAt: new Date(Date.now() - 1) };
    const b = new WhatsAppSessionLeasePrismaFactory(fake).service();
    const handle = await b.acquire(KEY);
    expect(handle.fencingToken).toBe(2);
    expect(fake.row?.instanceId).toBe(b.instanceId);
    expect(fake.row?.fencingToken).toBe(2);
  });

  it("renew: CAS-продление владельцем продлевает expiresAt; чужой токен → lease_lost", async () => {
    const fake = createFakeLeasePrisma();
    const a = new WhatsAppSessionLeasePrismaFactory(fake).service();
    const handle = await a.acquire(KEY);
    // Делаем текущий expiresAt заведомо малым, чтобы продление было видно.
    fake.row = { ...fake.row!, expiresAt: new Date(Date.now() + 1_000) };
    const before = fake.row.expiresAt.getTime();
    const renewed = await a.renew(KEY, handle);
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(before);
    expect(renewed.fencingToken).toBe(1);

    // Зомби-инстанс с прежним токеном после перехвата.
    fake.row = { ...fake.row!, instanceId: "other", fencingToken: 9, expiresAt: new Date(Date.now() + 60_000) };
    const failure = await a.renew(KEY, handle).then(() => null, (error: unknown) => error);
    expect((failure as WhatsAppLeaseError).code).toBe("lease_lost");
  });

  it("renew: истёкшая аренда не продлевается (CAS по expiresAt > now)", async () => {
    const fake = createFakeLeasePrisma();
    const a = new WhatsAppSessionLeasePrismaFactory(fake).service();
    const handle = await a.acquire(KEY);
    fake.row = { ...fake.row!, expiresAt: new Date(Date.now() - 1) };
    const failure = await a.renew(KEY, handle).then(() => null, (error: unknown) => error);
    expect((failure as WhatsAppLeaseError).code).toBe("lease_lost");
  });

  it("release: освобождает (истёкшее expiresAt), но НЕ удаляет токен; перехват → +1", async () => {
    const fake = createFakeLeasePrisma();
    const a = new WhatsAppSessionLeasePrismaFactory(fake).service();
    const handle = await a.acquire(KEY);
    await a.release(KEY, handle);
    expect(fake.row).not.toBeNull();
    expect(fake.row?.fencingToken).toBe(1);
    expect(fake.row!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
    const b = new WhatsAppSessionLeasePrismaFactory(fake).service();
    const next = await b.acquire(KEY);
    expect(next.fencingToken).toBe(2);
  });

  it("assertOwnership: валидный токен проходит; устаревший токен/истечение → отказ", async () => {
    const fake = createFakeLeasePrisma();
    const a = new WhatsAppSessionLeasePrismaFactory(fake).service();
    const handle = await a.acquire(KEY);
    await expect(a.assertOwnership(KEY, handle)).resolves.toBeUndefined();

    // Истёкшая аренда → self-fencing.
    fake.row = { ...fake.row!, expiresAt: new Date(Date.now() - 1) };
    const expired = await a.assertOwnership(KEY, handle).then(() => null, (error: unknown) => error);
    expect((expired as WhatsAppLeaseError).code).toBe("lease_lost");

    // Устаревший токен (аренда перехвачена) → отказ.
    fake.row = { ...fake.row!, instanceId: "other", fencingToken: 7, expiresAt: new Date(Date.now() + 60_000) };
    const stale = await a.assertOwnership(KEY, handle).then(() => null, (error: unknown) => error);
    expect((stale as WhatsAppLeaseError).code).toBe("lease_lost");
  });

  it("getOwner: отражает строку и флаг expired", async () => {
    const fake = createFakeLeasePrisma();
    expect(await new WhatsAppSessionLeasePrismaFactory(fake).service().getOwner(KEY)).toBeNull();
    const a = new WhatsAppSessionLeasePrismaFactory(fake).service();
    await a.acquire(KEY);
    const owner = await a.getOwner(KEY);
    expect(owner?.instanceId).toBe(a.instanceId);
    expect(owner?.expired).toBe(false);
    fake.row = { ...fake.row!, expiresAt: new Date(Date.now() - 1) };
    expect((await a.getOwner(KEY))?.expired).toBe(true);
  });

  it("contention: уникальный виолейшн при create → ретрай до победы", async () => {
    const fake = createFakeLeasePrisma();
    fake.failNextCreateWith = Object.assign(new Error("unique"), { code: "P2002" });
    const service = new WhatsAppSessionLeasePrismaFactory(fake).service();
    const handle = await service.acquire(KEY);
    expect(handle.fencingToken).toBe(1);
    expect(fake.row?.instanceId).toBe(service.instanceId);
  });

  it("монотонность токена: серия takeover-ов только растит токен", async () => {
    const fake = createFakeLeasePrisma();
    let previous = 0;
    for (let i = 0; i < 3; i++) {
      const service = new WhatsAppSessionLeasePrismaFactory(fake).service();
      fake.row = fake.row ? { ...fake.row, expiresAt: new Date(Date.now() - 1) } : fake.row;
      const handle = await service.acquire(KEY);
      expect(handle.fencingToken).toBeGreaterThan(previous);
      previous = handle.fencingToken;
    }
    expect(previous).toBe(3);
    expect(fake.row?.key).toBe(KEY);
    expect(whatsappLeaseKey("acc-1")).toBe("whatsapp:acc-1");
  });
});

/** Фабрика сервисов над общим фейком (каждый вызов = новый «инстанс»). */
class WhatsAppSessionLeasePrismaFactory {
  constructor(private readonly fake: LeasePrismaLike) {}
  service(): WhatsAppSessionLeaseService {
    return new WhatsAppSessionLeaseService(this.fake, config());
  }
}
