import { WhatsAppOutboundService, generateProviderMessageId, type ActorRef } from "./outbound.service";
import type { WhatsAppConfig } from "../whatsapp.config";
import type { WhatsAppProvider, WhatsAppReconcileResult, WhatsAppDeliveryUpdate } from "../provider/whatsapp-provider";
import { WhatsAppMessageSendError } from "../provider/whatsapp-errors";
import { NotFoundError, ConflictError, ValidationDomainError, DomainError } from "../../../shared/errors";
import { WhatsAppMediaStorage } from "../media/whatsapp-media.storage";
import * as os from "os";
import * as path from "path";
import * as fsp from "fs/promises";

type Row = Record<string, unknown>;

function matchWhere(row: Row, where: Row): boolean {
  for (const [key, value] of Object.entries(where)) {
    if (value === null) {
      if (row[key] !== null && row[key] !== undefined) return false;
      continue;
    }
    if (value instanceof Date) {
      if (!(row[key] instanceof Date) || row[key].getTime() !== value.getTime()) return false;
      continue;
    }
    if (typeof value === "object") {
      const cond = value as { lt?: Date; gt?: Date };
      const current = row[key] as Date;
      if (cond.lt !== undefined && !(current.getTime() < cond.lt.getTime())) return false;
      if (cond.gt !== undefined && !(current.getTime() > cond.gt.getTime())) return false;
      continue;
    }
    if (row[key] !== value) return false;
  }
  return true;
}

function applyData(row: Row, data: Row): void {
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      const op = value as { increment?: number };
      if (typeof op.increment === "number") {
        row[key] = ((row[key] as number) ?? 0) + op.increment;
        continue;
      }
    }
    row[key] = value;
  }
  row["updatedAt"] = new Date();
}

function pick(row: Row, select?: Record<string, boolean>): Row {
  if (!select) return { ...row };
  const out: Row = {};
  for (const [key, include] of Object.entries(select)) if (include) out[key] = row[key];
  return out;
}

interface FakeDb {
  outbound: Row[];
  communications: Row[];
  customers: Row[];
  account: Row | null;
  audits: Array<Record<string, unknown>>;
  suppressions: Row[];
  conversations: Row[];
  outboundById(id: string): Row | undefined;
}

function createFakeDb(seed: Partial<{ customer: Row; account: Row; outbound: Row[]; suppressions: Row[] }> = {}): FakeDb {
  const db: FakeDb = {
    outbound: seed.outbound ? seed.outbound.map((r) => ({ ...r })) : [],
    communications: [],
    customers: seed.customer ? [{ ...seed.customer }] : [],
    account: seed.account ? { ...seed.account } : null,
    audits: [],
    suppressions: seed.suppressions ? seed.suppressions.map((r) => ({ ...r })) : [],
    conversations: [],
    outboundById(id: string) {
      return db.outbound.find((r) => r["id"] === id);
    },
  };
  return db;
}

let cmlSeq = 0;

function createFakePrisma(db: FakeDb) {
  const tx = {
    communication: {
      create: async ({ data, select }: { data: Row; select?: Record<string, boolean> }) => {
        const row = { id: `cml-${++cmlSeq}`, updatedAt: new Date(), occurredAt: new Date(), ...data };
        db.communications.push(row);
        return pick(row, select);
      },
      findUnique: async ({ where }: { where: Row }) => {
        const row = db.communications.find((r) => r["id"] === where["id"]);
        return row ? { ...row } : null;
      },
    },
    whatsAppOutboundMessage: {
      create: async ({ data }: { data: Row }) => {
        const row: Row = {
          id: `out-${++cmlSeq}`,
          attempts: 0,
          lastError: null,
          nextAttemptAt: null,
          sentAt: null,
          deliveredAt: null,
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        db.outbound.push(row);
        return { ...row };
      },
      findUnique: async ({ where }: { where: Row }) => {
        const row =
          where["id"] !== undefined
            ? db.outbound.find((r) => r["id"] === where["id"])
            : db.outbound.find((r) => r["providerMessageId"] === where["providerMessageId"]);
        return row ? { ...row } : null;
      },
      findMany: async ({ where }: { where: Row }) =>
        db.outbound.filter((r) => matchWhere(r, where)).map((r) => ({ ...r })),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        for (const row of db.outbound) {
          if (matchWhere(row, where)) {
            applyData(row, data);
            count += 1;
          }
        }
        return { count };
      },
    },
    customer: {
      findUnique: async ({ where }: { where: Row }) => {
        const row = db.customers.find((r) => r["id"] === where["id"]);
        return row ? { ...row } : null;
      },
    },
    whatsAppAccount: {
      findFirst: async () => (db.account ? { ...db.account } : null),
      create: async ({ data }: { data: Row }) => {
        db.account = { id: "acc-1", createdAt: new Date(), ...data };
        return { ...db.account };
      },
    },
    whatsAppSuppression: {
      findUnique: async ({ where }: { where: Row }) => {
        const row = db.suppressions.find((r) => r["canonicalPhone"] === where["canonicalPhone"]);
        return row ? { ...row } : null;
      },
      create: async ({ data }: { data: Row }) => {
        const row = { id: `sup-${++cmlSeq}`, createdAt: new Date(), ...data };
        db.suppressions.push(row);
        return { ...row };
      },
    },
    whatsAppConversation: {
      findUnique: async ({ where, select }: { where: Row; select?: Record<string, boolean> }) => {
        if (where["id"] !== undefined) {
          const row = db.conversations.find((r) => r["id"] === where["id"]);
          return row ? pick(row, select) : null;
        }
        const key = where["accountId_remoteJid"] as { accountId: string; remoteJid: string } | undefined;
        if (key) {
          const row = db.conversations.find(
            (r) => r["accountId"] === key.accountId && r["remoteJid"] === key.remoteJid,
          );
          return row ? pick(row, select) : null;
        }
        return null;
      },
      create: async ({ data, select }: { data: Row; select?: Record<string, boolean> }) => {
        const row: Row = {
          id: `conv-${++cmlSeq}`,
          canonicalPhone: null,
          customerId: null,
          matchingStatus: "UNMATCHED",
          matchedAt: null,
          lastMessageAt: null,
          lastMessagePreview: null,
          lastReadAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        db.conversations.push(row);
        return pick(row, select);
      },
      update: async ({ where, data, select }: { where: Row; data: Row; select?: Record<string, boolean> }) => {
        const row = db.conversations.find((r) => r["id"] === where["id"]);
        if (!row) throw new Error(`conversation ${String(where["id"])} not found`);
        applyData(row, data);
        return pick(row, select);
      },
    },
  };
  const prisma = {
    ...tx,
    $transaction: async <T>(cb: (t: typeof tx) => Promise<T>): Promise<T> => cb(tx),
  };
  return prisma;
}

class FakeProvider implements Partial<WhatsAppProvider> {
  state = "CONNECTED";
  sendBehavior: "ok" | "ambiguous" | "retryable" | "permanent" = "ok";
  capabilities = {
    qrPairing: true,
    deliveryReceipts: true,
    media: ["document"] as readonly ("image" | "video" | "audio" | "document" | "sticker")[],
    requiresSessionOwnership: true,
    requiresApprovedTemplates: false,
  };
  sent: Array<{
    recipientJid: string;
    text: string;
    messageId: string;
    media?: { filename: string; mimetype: string; bytes: Uint8Array } | null;
  }> = [];
  reconcileEvidence: WhatsAppReconcileResult | null = null;
  private listeners = new Set<(u: WhatsAppDeliveryUpdate) => void>();

  getSnapshot() {
    return { state: this.state, instanceId: "i1", connectedAt: new Date(), qr: null } as never;
  }
  async send(input: {
    recipientJid: string;
    text: string;
    messageId: string;
    media?: { filename: string; mimetype: string; bytes: Uint8Array } | null;
  }): Promise<{ providerMessageId: string; sentAt: Date }> {
    if (this.sendBehavior === "ok") {
      this.sent.push({ ...input });
      return { providerMessageId: input.messageId, sentAt: new Date() };
    }
    if (this.sendBehavior === "ambiguous") throw new WhatsAppMessageSendError("send timeout (outcome unknown)", false, undefined, true);
    if (this.sendBehavior === "retryable") throw new WhatsAppMessageSendError("network down", true);
    throw new WhatsAppMessageSendError("invalid jid", false);
  }
  async reconcile(): Promise<WhatsAppReconcileResult | null> {
    return this.reconcileEvidence;
  }
  onDeliveryUpdate(listener: (u: WhatsAppDeliveryUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(update: WhatsAppDeliveryUpdate): void {
    for (const l of this.listeners) l(update);
  }
}

const actor: ActorRef = { id: "user-1", username: "admin" };

function createService(
  db: FakeDb,
  options: { provider?: FakeProvider | null; ownership?: Record<string, unknown>; mediaDir?: string } = {},
) {
  const prisma = createFakePrisma(db);
  const ids = {
    nextCode: async () => `CML-${String(++cmlSeq).padStart(8, "0")}`,
  };
  const security = {
    audit: async (_tx: unknown, entry: Record<string, unknown>) => {
      db.audits.push(entry);
      return undefined;
    },
  };
  const ownership =
    options.ownership ??
    ({
      assertActive: jest.fn(async () => ({
        instanceId: "host:1:aaaa",
        fencingToken: 7,
        acquiredAt: new Date(),
        expiresAt: new Date(Date.now() + 45_000),
        ownerHostname: "host",
        ownerPid: 1,
      })),
    } as unknown);
  const config = {
    enabled: true,
    provider: "mock",
    defaultPhoneRegion: "AZ",
    sendTimeoutMs: 10_000,
    mediaDir:
      options.mediaDir ??
      path.join(os.tmpdir(), `wa-out-spec-${Date.now()}-${Math.random().toString(36).slice(2)}`),
  } as unknown as WhatsAppConfig;
  const provider = options.provider === undefined ? new FakeProvider() : options.provider;
  // M5: реестр-фейк — один primary-номер acc-1; provider: null = kill-switch
  // (реальный реестр бросает тот же DomainError 503 из ensureContext).
  const ctx = {
    accountId: "acc-1",
    provider,
    ownership,
    sessionPath: path.join(os.tmpdir(), "wa-out-spec-session"),
    placeholder: false,
  };
  const registry = {
    ensureContext: async (_accountId?: string) => {
      if (!provider) {
        throw new DomainError("WhatsApp integration is disabled (WHATSAPP_ENABLED=false)", 503);
      }
      return ctx;
    },
    get: () => (provider ? ctx : null),
    ensurePrimaryAccountId: async () => {
      if (db.account) return String(db.account["id"]);
      db.account = { id: "acc-1", provider: "mock", createdAt: new Date() };
      return "acc-1";
    },
    onDeliveryUpdate: (cb: (accountId: string, update: WhatsAppDeliveryUpdate) => void) => {
      if (!provider) return () => undefined;
      return provider.onDeliveryUpdate((update) => cb("acc-1", update));
    },
  };
  const service = new WhatsAppOutboundService(
    prisma as never,
    ids as never,
    security as never,
    config,
    registry as never,
  );
  return { service, provider: provider as FakeProvider | null, prisma };
}

const VALID_PHONE = "+994501234567";

describe("WhatsAppOutboundService (M2)", () => {
  beforeEach(() => {
    cmlSeq = 0;
  });

  describe("sendManual", () => {
    it("создаёт Communication+Outbound в одной транзакции ДО send (providerMessageId 3EB0…, 40 символов) и аудирует whatsapp.send", async () => {
      const db = createFakeDb({ customer: { id: "cust-1", phone: VALID_PHONE } });
      const { service, provider } = createService(db);

      const result = await service.sendManual({ customerId: "cust-1", text: "Привет!" }, actor, "op-key-1");

      expect(result.status).toBe("SENT");
      expect(result.providerMessageId).toMatch(/^3EB0[0-9A-F]{36}$/);
      expect(result.providerMessageId).toHaveLength(40);
      expect(generateProviderMessageId()).toMatch(/^3EB0[0-9A-F]{36}$/);

      // Communication (CML-*) создан с каноническим телефоном получателя.
      const communication = db.communications[0];
      expect(String(communication["code"])).toMatch(/^CML-/);
      expect(communication["channel"]).toBe("WHATSAPP");
      expect(communication["direction"]).toBe("OUTBOUND");
      expect(communication["body"]).toBe("Привет!");

      const outbound = db.outboundById(result.outboundId)!;
      expect(outbound["status"]).toBe("SENT");
      expect(outbound["providerMessageId"]).toBe(result.providerMessageId);
      expect(outbound["operationKey"]).toBe("op-key-1");
      expect(outbound["recipientPhone"]).toBe(VALID_PHONE);
      expect(outbound["recipientJid"]).toBe("994501234567@s.whatsapp.net");
      expect(outbound["attempts"]).toBe(1);
      expect(outbound["sentAt"]).toBeInstanceOf(Date);
      expect(outbound["fencingToken"]).toBe(7);

      // provider получил СОХРАНЁННЫЙ providerMessageId (D6).
      expect(provider!.sent[0].messageId).toBe(result.providerMessageId);

      // Audit в той же транзакции: без текста и без телефона.
      const audit = db.audits.find((a) => a["action"] === "whatsapp.send");
      expect(audit).toBeDefined();
      expect(audit!["userId"]).toBe("user-1");
      expect(JSON.stringify(audit!["details"])).not.toContain("Привет");
      expect(JSON.stringify(audit!["details"])).not.toContain(VALID_PHONE);
    });

    it("путь CREATE→QUEUED→SENDING проходит CAS-переходами (attempts=1, status=SENT)", async () => {
      const db = createFakeDb({ customer: { id: "cust-1", phone: VALID_PHONE } });
      const { service, provider } = createService(db);
      const seenStatuses: string[] = [];
      const original = provider!.send.bind(provider!);
      provider!.send = async (input) => {
        seenStatuses.push(String(db.outbound[0]["status"]));
        return original(input);
      };

      const result = await service.sendManual({ customerId: "cust-1", text: "hi" }, actor, "op-key-2");

      expect(seenStatuses).toEqual(["SENDING"]);
      expect(result.status).toBe("SENT");
      expect(db.outboundById(result.outboundId)!["status"]).toBe("SENT");
    });

    it("не-CONNECTED состояние → ConflictError 409 (вне зависимости от текста)", async () => {
      const db = createFakeDb({ customer: { id: "cust-1", phone: VALID_PHONE } });
      const { service, provider } = createService(db);
      provider!.state = "QR_REQUIRED";

      await expect(service.sendManual({ customerId: "cust-1", text: "hi" }, actor, "k1")).rejects.toThrow(ConflictError);
      expect(db.outbound).toHaveLength(0);
    });

    it("провайдер не сконфигурирован (kill-switch) → DomainError 503", async () => {
      const db = createFakeDb({ customer: { id: "cust-1", phone: VALID_PHONE } });
      const { service } = createService(db, { provider: null });

      await expect(service.sendManual({ customerId: "cust-1", text: "hi" }, actor, "k1")).rejects.toThrow(DomainError);
      try {
        await service.sendManual({ customerId: "cust-1", text: "hi" }, actor, "k1");
      } catch (e) {
        expect((e as DomainError).httpStatus).toBe(503);
      }
    });

    it("валидация: текст 1..4000, операция требует operationKey", async () => {
      const db = createFakeDb({ customer: { id: "cust-1", phone: VALID_PHONE } });
      const { service } = createService(db);

      await expect(service.sendManual({ customerId: "cust-1", text: "" }, actor, "k1")).rejects.toThrow(ValidationDomainError);
      await expect(service.sendManual({ customerId: "cust-1", text: "x".repeat(4001) }, actor, "k1")).rejects.toThrow(ValidationDomainError);
      await expect(service.sendManual({ customerId: "cust-1", text: "ok" }, actor, "  ")).rejects.toThrow(ValidationDomainError);
      expect(db.outbound).toHaveLength(0);
    });

    it("резолв получателя: Customer без телефона → 422; неизвестный Customer → 404; оба параметра → 422", async () => {
      const db = createFakeDb({ customer: { id: "cust-1", phone: null } });
      const { service } = createService(db);
      await expect(service.sendManual({ customerId: "cust-1", text: "hi" }, actor, "k1")).rejects.toThrow(ValidationDomainError);
      await expect(service.sendManual({ customerId: "missing", text: "hi" }, actor, "k1")).rejects.toThrow(NotFoundError);
      await expect(
        service.sendManual({ customerId: "cust-1", phone: VALID_PHONE, text: "hi" }, actor, "k1"),
      ).rejects.toThrow(ValidationDomainError);
      await expect(service.sendManual({ text: "hi" }, actor, "k1")).rejects.toThrow(ValidationDomainError);
    });

    it("raw телефон нормализуется в canonical E.164 (без угадывания)", async () => {
      const db = createFakeDb();
      const { service } = createService(db);

      const result = await service.sendManual({ phone: "+994 (50) 123 45 67", text: "hi" }, actor, "k3");
      expect(db.outboundById(result.outboundId)!["recipientPhone"]).toBe(VALID_PHONE);
      expect(db.communications[0]["contextType"]).toBeNull();

      await expect(service.sendManual({ phone: "12345", text: "hi" }, actor, "k4")).rejects.toThrow(ValidationDomainError);
    });

    it("ambiguous ошибка провайдера → UNKNOWN (at-most-once, без автоповтора)", async () => {
      const db = createFakeDb({ customer: { id: "cust-1", phone: VALID_PHONE } });
      const { service, provider } = createService(db);
      provider!.sendBehavior = "ambiguous";

      const result = await service.sendManual({ customerId: "cust-1", text: "hi" }, actor, "k5");
      expect(result.status).toBe("UNKNOWN");
      const row = db.outboundById(result.outboundId)!;
      expect(row["status"]).toBe("UNKNOWN");
      expect(row["attempts"]).toBe(1);
      expect(row["lastError"]).toContain("outcome unknown");
      // Автоповтора нет: send вызван ровно один раз.
      expect(provider!.sent).toHaveLength(0);
    });

    it("retryable ошибка → FAILED_RETRYABLE; permanent → FAILED_PERMANENT", async () => {
      const db1 = createFakeDb({ customer: { id: "cust-1", phone: VALID_PHONE } });
      const s1 = createService(db1);
      s1.provider!.sendBehavior = "retryable";
      const r1 = await s1.service.sendManual({ customerId: "cust-1", text: "hi" }, actor, "k6");
      expect(r1.status).toBe("FAILED_RETRYABLE");

      const db2 = createFakeDb({ customer: { id: "cust-1", phone: VALID_PHONE } });
      const s2 = createService(db2);
      s2.provider!.sendBehavior = "permanent";
      const r2 = await s2.service.sendManual({ customerId: "cust-1", text: "hi" }, actor, "k7");
      expect(r2.status).toBe("FAILED_PERMANENT");
      expect(db2.outboundById(r2.outboundId)!["status"]).toBe("FAILED_PERMANENT");
    });

    it("CAS-защита: статус строки меняется только через updateMany с ожидаемым текущим статусом", async () => {
      const db = createFakeDb({ customer: { id: "cust-1", phone: VALID_PHONE } });
      const { service } = createService(db);
      // Внешнее вмешательство ДО отправки: строка уже не в CREATED.
      db.outbound.push({
        id: "foreign-1",
        status: "FAILED_PERMANENT",
        providerMessageId: "3EB0" + "F".repeat(36),
        updatedAt: new Date(),
        createdAt: new Date(),
      });
      // executeSend стартует из CREATED → QUEUED: инородная строка не трогается.
      const result = await service.sendManual({ customerId: "cust-1", text: "hi" }, actor, "k8");
      expect(result.status).toBe("SENT");
      expect(db.outboundById("foreign-1")!["status"]).toBe("FAILED_PERMANENT");
    });
  });

  describe("crash-recovery (stale SENDING → UNKNOWN)", () => {
    function seedStale(db: FakeDb, ageMs: number): void {
      db.outbound.push({
        id: "stale-1",
        status: "SENDING",
        providerMessageId: "3EB0" + "A".repeat(36),
        communicationId: "comm-1",
        recipientJid: "994501234567@s.whatsapp.net",
        attempts: 1,
        lastError: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        createdAt: new Date(Date.now() - ageMs),
        updatedAt: new Date(Date.now() - ageMs),
      });
      db.communications.push({ id: "comm-1", body: "pending text" });
    }

    it("stale SENDING → UNKNOWN + audit; свежий SENDING не трогает", async () => {
      const db = createFakeDb();
      seedStale(db, 120_000);
      db.outbound.push({
        id: "fresh-1",
        status: "SENDING",
        providerMessageId: "3EB0" + "B".repeat(36),
        attempts: 1,
        updatedAt: new Date(),
        createdAt: new Date(),
        deliveredAt: null,
        readAt: null,
        sentAt: null,
      });
      const { service } = createService(db);

      const result = await service.recoverStaleSending();

      expect(result.count).toBe(1);
      expect(result.ids).toEqual(["stale-1"]);
      expect(db.outboundById("stale-1")!["status"]).toBe("UNKNOWN");
      expect(db.outboundById("fresh-1")!["status"]).toBe("SENDING");
      const audit = db.audits.find((a) => a["action"] === "whatsapp.send.crash_to_unknown");
      expect(audit).toBeDefined();
      expect((audit!["details"] as Record<string, unknown>)["autoRetry"]).toBe(false);
    });

    it("bootstrap подключает delivery-listener и запускает скан; shutdown отписывает", async () => {
      const db = createFakeDb();
      const { service, provider } = createService(db);
      service.onApplicationBootstrap();
      // Receipt до какой-либо строки — no-op без падения.
      provider!.emit({ providerMessageId: "unknown-id", status: "sent", occurredAt: new Date() } as WhatsAppDeliveryUpdate);
      service.onApplicationShutdown();
      // После shutdown listener отписан: emit не вызывает applyReceipt (db не растёт).
      provider!.emit({ providerMessageId: "unknown-id", status: "delivered", occurredAt: new Date() } as WhatsAppDeliveryUpdate);
      await new Promise((r) => setImmediate(r));
      expect(db.communications).toHaveLength(0);
    });
  });

  describe("receipt → статус/ evidence", () => {
    function seedSent(db: FakeDb, status: string): void {
      db.outbound.push({
        id: "rec-1",
        status,
        providerMessageId: "3EB0" + "C".repeat(36),
        communicationId: "comm-r",
        attempts: 1,
        sentAt: status === "CREATED" ? null : new Date(),
        deliveredAt: null,
        readAt: null,
        updatedAt: new Date(),
        createdAt: new Date(),
      });
    }

    it("SENT→delivered→DELIVERED, DELIVERED→read→READ (монотонность)", async () => {
      const db = createFakeDb();
      seedSent(db, "SENT");
      const { service, provider } = createService(db);
      service.onApplicationBootstrap();

      provider!.emit({ providerMessageId: "3EB0" + "C".repeat(36), status: "delivered", occurredAt: new Date() });
      await new Promise((r) => setImmediate(r));
      expect(db.outboundById("rec-1")!["status"]).toBe("DELIVERED");
      expect(db.outboundById("rec-1")!["deliveredAt"]).toBeInstanceOf(Date);

      provider!.emit({ providerMessageId: "3EB0" + "C".repeat(36), status: "read", occurredAt: new Date() });
      await new Promise((r) => setImmediate(r));
      expect(db.outboundById("rec-1")!["status"]).toBe("READ");
      expect(db.outboundById("rec-1")!["readAt"]).toBeInstanceOf(Date);
      service.onApplicationShutdown();
    });

    it("UNKNOWN: receipt пишет ТОЛЬКО evidence-колонку, статус остаётся UNKNOWN (at-most-once)", async () => {
      const db = createFakeDb();
      seedSent(db, "UNKNOWN");
      const { service, provider } = createService(db);
      service.onApplicationBootstrap();

      provider!.emit({ providerMessageId: "3EB0" + "C".repeat(36), status: "delivered", occurredAt: new Date() });
      await new Promise((r) => setImmediate(r));

      expect(db.outboundById("rec-1")!["status"]).toBe("UNKNOWN");
      expect(db.outboundById("rec-1")!["deliveredAt"]).toBeInstanceOf(Date);
      service.onApplicationShutdown();
    });

    it("FAILED_PERMANENT: receipt не меняет статус и не пишет evidence", async () => {
      const db = createFakeDb();
      seedSent(db, "FAILED_PERMANENT");
      const { service, provider } = createService(db);
      service.onApplicationBootstrap();

      provider!.emit({ providerMessageId: "3EB0" + "C".repeat(36), status: "delivered", occurredAt: new Date() });
      await new Promise((r) => setImmediate(r));

      expect(db.outboundById("rec-1")!["status"]).toBe("FAILED_PERMANENT");
      expect(db.outboundById("rec-1")!["deliveredAt"]).toBeNull();
      service.onApplicationShutdown();
    });
  });

  describe("recover (Reconcile / Mark failed / Retry anyway)", () => {
    function seedUnknown(db: FakeDb, evidence: Partial<Row> = {}): string {
      db.outbound.push({
        id: "unk-1",
        status: "UNKNOWN",
        providerMessageId: "3EB0" + "D".repeat(36),
        communicationId: "comm-u",
        recipientJid: "994501234567@s.whatsapp.net",
        attempts: 1,
        lastError: "timeout",
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        updatedAt: new Date(),
        createdAt: new Date(),
        ...evidence,
      });
      db.communications.push({ id: "comm-u", body: "recovery text" });
      return "unk-1";
    }

    it("reconcile: evidence в БД (deliveredAt) → DELIVERED + audit whatsapp.send.reconciled", async () => {
      const db = createFakeDb();
      seedUnknown(db, { deliveredAt: new Date() });
      const { service } = createService(db);

      const result = await service.recover("unk-1", "reconcile", {}, actor);

      expect(result).toMatchObject({ recovered: true, status: "DELIVERED", evidence: "db" });
      expect(db.outboundById("unk-1")!["status"]).toBe("DELIVERED");
      const audit = db.audits.find((a) => a["action"] === "whatsapp.send.reconciled");
      expect(audit).toBeDefined();
      expect(audit!["details"]).toMatchObject({ to: "DELIVERED", evidence: "db" });
    });

    it("reconcile: evidence от провайдера → статус из провайдерной сессии + audit", async () => {
      const db = createFakeDb();
      seedUnknown(db);
      const { service, provider } = createService(db);
      provider!.reconcileEvidence = { status: "sent", observedAt: new Date() } as WhatsAppReconcileResult;

      const result = await service.recover("unk-1", "reconcile", {}, actor);

      expect(result).toMatchObject({ recovered: true, status: "SENT", evidence: "provider" });
      const audit = db.audits.find((a) => a["action"] === "whatsapp.send.reconciled");
      expect(audit!["details"]).toMatchObject({ evidence: "provider" });
    });

    it("reconcile: нет никакого evidence → recovered=false, статус остаётся UNKNOWN, audit no_evidence", async () => {
      const db = createFakeDb();
      seedUnknown(db);
      const { service } = createService(db);

      const result = await service.recover("unk-1", "reconcile", {}, actor);

      expect(result).toMatchObject({ recovered: false, status: "UNKNOWN" });
      expect(db.outboundById("unk-1")!["status"]).toBe("UNKNOWN");
      const audit = db.audits.find((a) => a["action"] === "whatsapp.send.reconcile");
      expect(audit!["details"]).toMatchObject({ result: "no_evidence" });
    });

    it("mark-failed: UNKNOWN → FAILED_PERMANENT + audit whatsapp.send.mark_failed", async () => {
      const db = createFakeDb();
      seedUnknown(db);
      const { service } = createService(db);

      const result = await service.recover("unk-1", "mark-failed", {}, actor);

      expect(result).toMatchObject({ recovered: true, status: "FAILED_PERMANENT" });
      expect(db.outboundById("unk-1")!["status"]).toBe("FAILED_PERMANENT");
      const audit = db.audits.find((a) => a["action"] === "whatsapp.send.mark_failed");
      expect(audit).toBeDefined();
    });

    it("retry-anyway без confirm=true → 422 (явное подтверждение обязательно)", async () => {
      const db = createFakeDb();
      seedUnknown(db);
      const { service } = createService(db);

      await expect(service.recover("unk-1", "retry-anyway", {}, actor)).rejects.toThrow(ValidationDomainError);
      await expect(service.recover("unk-1", "retry-anyway", { confirm: false }, actor)).rejects.toThrow(ValidationDomainError);
      expect(db.outboundById("unk-1")!["status"]).toBe("UNKNOWN");
    });

    it("retry-anyway с confirm: новый providerMessageId, QUEUED→SENDING→SENT, audit с previous id", async () => {
      const db = createFakeDb();
      seedUnknown(db);
      const { service, provider } = createService(db);
      const previous = "3EB0" + "D".repeat(36);

      const result = await service.recover("unk-1", "retry-anyway", { confirm: true }, actor);

      expect(result.status).toBe("SENT");
      const row = db.outboundById("unk-1")!;
      expect(row["status"]).toBe("SENT");
      expect(row["providerMessageId"]).not.toBe(previous);
      expect(row["providerMessageId"]).toMatch(/^3EB0[0-9A-F]{36}$/);
      expect(provider!.sent[0].messageId).toBe(row["providerMessageId"]);
      expect(provider!.sent[0].text).toBe("recovery text");
      const audit = db.audits.find((a) => a["action"] === "whatsapp.send.retry_anyway");
      expect(audit!["details"]).toMatchObject({ confirm: true, previousProviderMessageId: previous, duplicateDeliveryPossible: true });
    });

    it("recovery действий только для UNKNOWN: статус SENT → ConflictError 409; неизвестная строка → 404", async () => {
      const db = createFakeDb({ outbound: [{ id: "sent-1", status: "SENT", providerMessageId: "3EB0" + "E".repeat(36) }] });
      const { service } = createService(db);
      await expect(service.recover("sent-1", "reconcile", {}, actor)).rejects.toThrow(ConflictError);
      await expect(service.recover("missing", "mark-failed", {}, actor)).rejects.toThrow(NotFoundError);
    });

    it("recovery проверяет lease (fencing): потерянный lease → ошибка до изменения статуса", async () => {
      const db = createFakeDb();
      seedUnknown(db);
      const { service } = createService(db, {
        ownership: {
          assertActive: async () => {
            throw new ConflictError("WhatsApp lease lost (fencing)");
          },
        },
      });

      await expect(service.recover("unk-1", "mark-failed", {}, actor)).rejects.toThrow(ConflictError);
      expect(db.outboundById("unk-1")!["status"]).toBe("UNKNOWN");
      expect(db.audits).toHaveLength(0);
    });
  });

  describe("M3: suppression gate + conversation wiring", () => {
    it("§22: подавленный номер → ConflictError + audit whatsapp.send.suppressed, provider.send НЕ вызывается", async () => {
      const db = createFakeDb({
        customer: { id: "cus-1", phone: VALID_PHONE },
        suppressions: [{ id: "sup-1", canonicalPhone: VALID_PHONE, scope: "ALL", reason: "STOP" }],
      });
      const provider = new FakeProvider();
      const { service } = createService(db, { provider });

      await expect(
        service.sendManual({ customerId: "cus-1", text: "hello" }, actor, "op-1"),
      ).rejects.toBeInstanceOf(ConflictError);

      expect(provider.sent).toHaveLength(0);
      expect(db.communications).toHaveLength(0);
      expect(db.outbound).toHaveLength(0);
      expect(db.audits.find((a) => a["action"] === "whatsapp.send.suppressed")).toBeTruthy();
    });

    it("§4/§19: создаётся WhatsAppConversation и outbound получает conversationId (общая история)", async () => {
      const db = createFakeDb({ customer: { id: "cus-1", phone: VALID_PHONE } });
      const { service } = createService(db);

      const result = await service.sendManual({ customerId: "cus-1", text: "hi" }, actor, "op-conv-1");

      expect(result.status).toBe("SENT");
      expect(db.conversations).toHaveLength(1);
      const conversation = db.conversations[0];
      expect(conversation["remoteJid"]).toBe("994501234567@s.whatsapp.net");
      expect(conversation["canonicalPhone"]).toBe(VALID_PHONE);
      expect(conversation["customerId"]).toBe("cus-1");
      expect(conversation["matchingStatus"]).toBe("MATCHED");
      expect(conversation["lastMessagePreview"]).toBe("hi");
      expect(db.outbound[0]["conversationId"]).toBe(conversation["id"]);
    });

    it("§19: существующий диалог не перепривязывается (customerId заполняется только если отсутствует)", async () => {
      const db = createFakeDb({ customer: { id: "cus-1", phone: VALID_PHONE } });
      db.conversations.push({
        id: "conv-existing",
        accountId: "acc-1",
        remoteJid: "994501234567@s.whatsapp.net",
        canonicalPhone: VALID_PHONE,
        customerId: "cus-other",
        matchingStatus: "MATCHED",
        matchedAt: new Date(),
        lastMessageAt: null,
        lastMessagePreview: null,
        lastReadAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const { service } = createService(db);

      await service.sendManual({ customerId: "cus-1", text: "hi" }, actor, "op-conv-2");

      expect(db.conversations).toHaveLength(1);
      expect(db.conversations[0]["customerId"]).toBe("cus-other");
      expect(db.outbound[0]["conversationId"]).toBe("conv-existing");
    });
  });

  describe("LID-адресация (§10): отправка без разрешённого номера", () => {
    const LID_JID = "157848755548268@lid";

    function seedConversation(db: FakeDb, overrides: Row = {}): void {
      db.conversations.push({
        id: "conv-lid",
        accountId: "acc-1",
        remoteJid: LID_JID,
        canonicalPhone: null,
        customerId: null,
        matchingStatus: "UNMATCHED",
        matchedAt: null,
        lastMessageAt: null,
        lastMessagePreview: null,
        lastReadAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      });
    }

    it("lid-диалог без customerId/phone → отправка по lid-JID самого диалога", async () => {
      const db = createFakeDb();
      seedConversation(db);
      const provider = new FakeProvider();
      const { service } = createService(db, { provider });

      const result = await service.sendManual(
        { conversationId: "conv-lid", text: "привет" },
        actor,
        "op-lid-1",
      );

      expect(result.status).toBe("SENT");
      expect(provider.sent).toHaveLength(1);
      expect(provider.sent[0]!.recipientJid).toBe(LID_JID);
      const row = db.outbound[0]!;
      expect(row["recipientJid"]).toBe(LID_JID);
      expect(row["recipientPhone"]).toBeNull(); // номер не угадывается
      expect(row["conversationId"]).toBe("conv-lid");
      const conv = db.conversations[0]!;
      expect(conv["canonicalPhone"]).toBeNull(); // fillConversation не затирает
      expect(conv["lastMessagePreview"]).toBe("привет");
      expect(db.communications[0]!["contextId"]).toBeNull();
      expect(db.audits.some((a) => a["action"] === "whatsapp.send")).toBe(true);
    });

    it("lid-диалог с привязанным customerId → контекст Communication = CUSTOMER, отправка всё равно по lid", async () => {
      const db = createFakeDb({ customer: { id: "cus-lid", phone: VALID_PHONE } });
      seedConversation(db, { customerId: "cus-lid", matchingStatus: "MATCHED" });
      const provider = new FakeProvider();
      const { service } = createService(db, { provider });

      const result = await service.sendManual(
        { conversationId: "conv-lid", text: "по делу" },
        actor,
        "op-lid-2",
      );

      expect(result.status).toBe("SENT");
      expect(provider.sent[0]!.recipientJid).toBe(LID_JID);
      expect(db.communications[0]!["contextType"]).toBe("CUSTOMER");
      expect(db.communications[0]!["contextId"]).toBe("cus-lid");
      expect(db.conversations[0]!["canonicalPhone"]).toBeNull();
    });

    it("обычный (не lid) диалог без customerId/phone → 422 «Either customerId or phone is required» — lid-ветка guard не обходит", async () => {
      const db = createFakeDb();
      seedConversation(db, { id: "conv-pn", remoteJid: "994501112233@s.whatsapp.net" });
      const provider = new FakeProvider();
      const { service } = createService(db, { provider });

      await expect(
        service.sendManual({ conversationId: "conv-pn", text: "x" }, actor, "op-lid-3"),
      ).rejects.toThrow("Either customerId or phone is required");
      expect(db.outbound).toHaveLength(0);
      expect(provider.sent).toHaveLength(0);
    });

    it("lid-диалог + явный phone → классический mismatch-422 (корректный путь — link диалога)", async () => {
      const db = createFakeDb();
      seedConversation(db);
      const provider = new FakeProvider();
      const { service } = createService(db, { provider });

      await expect(
        service.sendManual({ conversationId: "conv-lid", phone: VALID_PHONE, text: "x" }, actor, "op-lid-4"),
      ).rejects.toThrow("does not match");
      expect(db.outbound).toHaveLength(0);
    });
  });

  describe("M3: media send (файл local→WA через uploadId)", () => {
    const UPLOAD_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

    async function stageFile(mediaDir: string, filename = "report.pdf"): Promise<void> {
      const storage = new WhatsAppMediaStorage(mediaDir);
      await storage.stageUpload(
        { originalname: filename, mimetype: "application/pdf", size: 5, bytes: new Uint8Array([1, 2, 3, 4, 5]) },
        UPLOAD_ID,
      );
    }

    it("uploadId → staged→adopt: outbound получает media-поля, provider.send уходит с media {filename,mimetype,bytes}", async () => {
      const mediaDir = path.join(os.tmpdir(), `wa-media-out-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await stageFile(mediaDir);
      const db = createFakeDb({ customer: { id: "cus-1", phone: VALID_PHONE } });
      const provider = new FakeProvider();
      const { service } = createService(db, { provider, mediaDir });
      try {
        const result = await service.sendManual(
          { customerId: "cus-1", text: "в отчёт", uploadId: UPLOAD_ID },
          actor,
          "op-media-1",
        );

        expect(result.status).toBe("SENT");
        const row = db.outbound[0]!;
        expect(row["mediaFilename"]).toBe("report.pdf");
        expect(row["mediaMime"]).toBe("application/pdf");
        expect(row["mediaSize"]).toBe(5);
        expect(String(row["mediaPath"])).toMatch(/^outbound\//);

        expect(provider.sent).toHaveLength(1);
        expect(provider.sent[0]).toMatchObject({
          text: "в отчёт",
          media: { filename: "report.pdf", mimetype: "application/pdf", bytes: expect.anything() },
        });
        expect(Array.from(provider.sent[0]!.media!.bytes)).toEqual([1, 2, 3, 4, 5]);
        expect(db.communications[0]!["body"]).toBe("в отчёт");
        expect(db.conversations[0]!["lastMessagePreview"]).toBe("в отчёт");
        // staged-копия перенесена (adopt удаляет uploads/<id>)
        await expect(
          fsp.access(path.join(mediaDir, "uploads", UPLOAD_ID)),
        ).rejects.toThrow();
      } finally {
        await fsp.rm(mediaDir, { recursive: true, force: true });
      }
    });

    it("файл без caption: пустой text проходит валидацию; preview = имя файла", async () => {
      const mediaDir = path.join(os.tmpdir(), `wa-media-out-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await stageFile(mediaDir, "photo.png");
      const db = createFakeDb({ customer: { id: "cus-1", phone: VALID_PHONE } });
      const provider = new FakeProvider();
      const { service } = createService(db, { provider, mediaDir });
      try {
        const result = await service.sendManual(
          { customerId: "cus-1", text: "   ", uploadId: UPLOAD_ID },
          actor,
          "op-media-2",
        );

        expect(result.status).toBe("SENT");
        expect(provider.sent[0]!.text).toBe("");
        expect(db.communications[0]!["body"]).toBe("");
        expect(db.conversations[0]!["lastMessagePreview"]).toBe("photo.png");
      } finally {
        await fsp.rm(mediaDir, { recursive: true, force: true });
      }
    });

    it("неизвестный uploadId → NotFoundError ДО создания каких-либо записей", async () => {
      const mediaDir = path.join(os.tmpdir(), `wa-media-out-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const db = createFakeDb({ customer: { id: "cus-1", phone: VALID_PHONE } });
      const provider = new FakeProvider();
      const { service } = createService(db, { provider, mediaDir });
      try {
        await expect(
          service.sendManual({ customerId: "cus-1", text: "hi", uploadId: UPLOAD_ID }, actor, "op-media-3"),
        ).rejects.toBeInstanceOf(NotFoundError);

        expect(provider.sent).toHaveLength(0);
        expect(db.communications).toHaveLength(0);
        expect(db.outbound).toHaveLength(0);
      } finally {
        await fsp.rm(mediaDir, { recursive: true, force: true });
      }
    });

    it("провайдер без capabilities.media=document → DomainError 503, staged-файл не трогается", async () => {
      const mediaDir = path.join(os.tmpdir(), `wa-media-out-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await stageFile(mediaDir);
      const db = createFakeDb({ customer: { id: "cus-1", phone: VALID_PHONE } });
      const provider = new FakeProvider();
      (provider as { capabilities: { media: readonly string[] } }).capabilities = {
        ...(provider.capabilities as { media: readonly string[] }),
        media: [],
      };
      const { service } = createService(db, { provider, mediaDir });
      try {
        await expect(
          service.sendManual({ customerId: "cus-1", text: "hi", uploadId: UPLOAD_ID }, actor, "op-media-4"),
        ).rejects.toBeInstanceOf(DomainError);

        expect(provider.sent).toHaveLength(0);
        expect(db.outbound).toHaveLength(0);
        await expect(fsp.access(path.join(mediaDir, "uploads", UPLOAD_ID, "report.pdf"))).resolves.toBeUndefined();
      } finally {
        await fsp.rm(mediaDir, { recursive: true, force: true });
      }
    });

    it("retry-anyway UNKNOWN-файла → повторный send снова читает файл с диска (media в команде)", async () => {
      const mediaDir = path.join(os.tmpdir(), `wa-media-out-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await stageFile(mediaDir);
      const db = createFakeDb({ customer: { id: "cus-1", phone: VALID_PHONE } });
      const provider = new FakeProvider();
      provider.sendBehavior = "ambiguous";
      const { service } = createService(db, { provider, mediaDir });
      try {
        const first = await service.sendManual(
          { customerId: "cus-1", text: "в отчёт", uploadId: UPLOAD_ID },
          actor,
          "op-media-5",
        );
        expect(first.status).toBe("UNKNOWN");
        expect(provider.sent).toHaveLength(0);

        provider.sendBehavior = "ok";
        const recovered = await service.recover(first.outboundId, "retry-anyway", { confirm: true }, actor);
        expect(recovered.status).toBe("SENT");
        expect(provider.sent).toHaveLength(1);
        expect(provider.sent[0]).toMatchObject({
          text: "в отчёт",
          media: { filename: "report.pdf", mimetype: "application/pdf" },
        });
        expect(Array.from(provider.sent[0]!.media!.bytes)).toEqual([1, 2, 3, 4, 5]);
      } finally {
        await fsp.rm(mediaDir, { recursive: true, force: true });
      }
    });
  });
});
