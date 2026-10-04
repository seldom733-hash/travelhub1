import { WhatsAppInboundService, detectStopKeyword, extractCanonicalPhone } from "./inbound.service";
import type { WhatsAppConfig } from "../whatsapp.config";
import type { WhatsAppInboundProviderMessage, WhatsAppProvider } from "../provider/whatsapp-provider";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

/**
 * Unit (M3 §5–§10, §22): чистые helper'ы, валидация входа, dedup-gate §7
 * (P2002 → duplicate, в т.ч. constraint-specific) и подписка на провайдер.
 * Сквозной pipeline (matching/continuity) доказывается real-DB e2e (§29).
 */

function makeMessage(overrides: Partial<WhatsAppInboundProviderMessage> = {}): WhatsAppInboundProviderMessage {
  return {
    providerMessageId: "IN-1",
    remoteJid: "994501234567@s.whatsapp.net",
    fromMe: false,
    participant: null,
    occurredAt: new Date("2026-10-02T10:00:00Z"),
    type: "text",
    text: "hello",
    lid: null,
    senderPn: null,
    ...overrides,
  };
}

describe("detectStopKeyword (M3 §22)", () => {
  it("STOP / СТОП / UNSUBSCRIBE (регистр + trim) → ключевое слово", () => {
    expect(detectStopKeyword("STOP")).toBe("STOP");
    expect(detectStopKeyword("  stop  ")).toBe("STOP");
    expect(detectStopKeyword("СТОП")).toBe("СТОП");
    expect(detectStopKeyword("стоп")).toBe("СТОП");
    expect(detectStopKeyword("unsubscribe")).toBe("UNSUBSCRIBE");
  });

  it("произвольный текст / пустой / null → null (не угадываем)", () => {
    expect(detectStopKeyword("STOP PLEASE")).toBeNull();
    expect(detectStopKeyword("остановите")).toBeNull();
    expect(detectStopKeyword("")).toBeNull();
    expect(detectStopKeyword(null)).toBeNull();
  });
});

describe("extractCanonicalPhone (M3 §10, read-only)", () => {
  it("личный JID → canonical E.164 (defaultRegion AZ)", () => {
    expect(extractCanonicalPhone({ remoteJid: "994501234567@s.whatsapp.net", senderPn: null }, "AZ")).toBe(
      "+994501234567",
    );
  });

  it("lid → fallback на senderPn; группа/broadcast → null даже с senderPn", () => {
    expect(
      extractCanonicalPhone({ remoteJid: "123456789@lid", senderPn: "994501234567@s.whatsapp.net" }, "AZ"),
    ).toBe("+994501234567");
    expect(extractCanonicalPhone({ remoteJid: "123456789@lid", senderPn: null }, "AZ")).toBeNull();
    expect(
      extractCanonicalPhone({ remoteJid: "120363000000000000@g.us", senderPn: null }, "AZ"),
    ).toBeNull();
    expect(
      extractCanonicalPhone(
        { remoteJid: "120363000000000000@g.us", senderPn: "994501234567@s.whatsapp.net" },
        "AZ",
      ),
    ).toBeNull();
  });

  it("device-суффиксы (:12) в senderPn/remoteJid отбрасываются → E.164", () => {
    expect(
      extractCanonicalPhone(
        { remoteJid: "178322948505677@lid", senderPn: "994501234567:12@s.whatsapp.net" },
        "AZ",
      ),
    ).toBe("+994501234567");
    expect(extractCanonicalPhone({ remoteJid: "994501234567:4@s.whatsapp.net", senderPn: null }, "AZ")).toBe(
      "+994501234567",
    );
  });

  it("невалидный номер → null (без угадывания)", () => {
    expect(extractCanonicalPhone({ remoteJid: "12@s.whatsapp.net", senderPn: null }, "AZ")).toBeNull();
  });
});

describe("WhatsAppInboundService (M3)", () => {
  function makeService(options: {
    enabled?: boolean;
    process?: jest.Mock;
    onInbound?: jest.Mock;
    findPhoneByLid?: jest.Mock;
    customers?: Array<{ phone: string | null }>;
  } = {}) {
    const onInbound =
      options.onInbound ?? jest.fn(() => jest.fn());
    const provider = {
      onInbound,
      ...(options.findPhoneByLid ? { findPhoneByLid: options.findPhoneByLid } : {}),
    } as unknown as WhatsAppProvider;
    const config = {
      enabled: options.enabled ?? true,
      provider: "mock",
      defaultPhoneRegion: "AZ",
    } as unknown as WhatsAppConfig;
    const prisma = {
      $transaction: jest.fn(),
      whatsAppAccount: {
        findFirst: jest.fn(async () => ({ id: "acc-1" })),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "acc-1",
          ...data,
        })),
      },
      customer: {
        findMany: jest.fn(async () => options.customers ?? []),
      },
    };
    const service = new WhatsAppInboundService(
      prisma as never,
      { nextCode: jest.fn() } as never,
      { audit: jest.fn() } as never,
      config,
      provider,
    );
    if (options.process) {
      jest.spyOn(service, "processInbound").mockImplementation(options.process);
    }
    return { service, onInbound, prisma };
  }

  it("§5: подписка на provider.onInbound при enabled; unsubscribe при shutdown", async () => {
    const { service, onInbound } = makeService();
    const unsubscribe = jest.fn();
    onInbound.mockReturnValueOnce(unsubscribe);

    service.onApplicationBootstrap();
    expect(onInbound).toHaveBeenCalledTimes(1);

    service.onApplicationShutdown();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("kill-switch: WHATSAPP_ENABLED=false → без подписки (никакого inbound)", () => {
    const { service, onInbound } = makeService({ enabled: false });
    service.onApplicationBootstrap();
    expect(onInbound).not.toHaveBeenCalled();
  });

  it("валидация входа: без providerMessageId/remoteJid → invalid, без записи", async () => {
    const { service } = makeService();
    await expect(
      service.processInbound(makeMessage({ providerMessageId: "" })),
    ).resolves.toEqual({ outcome: "invalid" });
    await expect(
      service.processInbound(makeMessage({ remoteJid: "  " })),
    ).resolves.toEqual({ outcome: "invalid" });
  });

  it("§7 dedup: P2002 по canonical unique → { outcome: duplicate } (не ошибка)", async () => {
    const { service, prisma } = makeService();
    (prisma.$transaction as jest.Mock).mockRejectedValue(
      Object.assign(new Error("unique"), {
        code: "P2002",
        meta: { target: ["WhatsAppInboundMessage_accountId_providerMessageId_key"] },
      }),
    );
    await expect(service.processInbound(makeMessage())).resolves.toEqual({ outcome: "duplicate" });
  });

  it("§7 dedup: P2002 без meta (driver adapter shape) → тоже duplicate", async () => {
    const { service, prisma } = makeService();
    (prisma.$transaction as jest.Mock).mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );
    await expect(service.processInbound(makeMessage())).resolves.toEqual({ outcome: "duplicate" });
  });

  it("не-P2002 ошибка транзакции ПРОБРАСЫВАЕТСЯ (не маскируем)", async () => {
    const { service, prisma } = makeService();
    const boom = new Error("connection lost");
    (prisma.$transaction as jest.Mock).mockRejectedValue(boom);
    await expect(service.processInbound(makeMessage())).rejects.toBe(boom);
  });

  it("P2002 по чужой constraints → ПРОБРАСЫВАЕТСЯ (не чужой dedup)", async () => {
    const { service, prisma } = makeService();
    (prisma.$transaction as jest.Mock).mockRejectedValue(
      Object.assign(new Error("unique"), {
        code: "P2002",
        meta: { target: ["Communication_code_key"] },
      }),
    );
    await expect(service.processInbound(makeMessage())).rejects.toThrow();
  });

  describe("resolveLidViaCrm (§10, lid→pn по CRM-кандидатам)", () => {
    type LidService = {
      resolveLidViaCrm(remoteJid: string): Promise<string | null>;
    };
    const asLid = (service: unknown): LidService => service as LidService;

    it("lid + capability → нормализованные CRM-кандидаты уходят в findPhoneByLid, результат возвращается", async () => {
      const findPhoneByLid = jest.fn(async (_lid: string, candidates: string[]) =>
        candidates.includes("+994506844086") ? "+994506844086" : null,
      );
      const { service, prisma } = makeService({
        findPhoneByLid,
        customers: [{ phone: "994506844086" }, { phone: "+994506844086" }, { phone: "994501111111" }],
      });

      await expect(asLid(service).resolveLidViaCrm("178322948505677@lid")).resolves.toBe("+994506844086");
      expect(findPhoneByLid).toHaveBeenCalledTimes(1);
      const [lid, candidates] = findPhoneByLid.mock.calls[0] as [string, string[]];
      expect(lid).toBe("178322948505677@lid");
      expect(candidates).toEqual(["+994506844086", "+994501111111"]); // дедуп + нормализация
      expect(prisma.customer.findMany).toHaveBeenCalledTimes(1);
    });

    it("не-lid remoteJid → null без проба (pn-чаты не трогаем)", async () => {
      const findPhoneByLid = jest.fn();
      const { service, prisma } = makeService({ findPhoneByLid });
      await expect(
        asLid(service).resolveLidViaCrm("994501234567@s.whatsapp.net"),
      ).resolves.toBeNull();
      expect(findPhoneByLid).not.toHaveBeenCalled();
      expect(prisma.customer.findMany).not.toHaveBeenCalled();
    });

    it("провайдер без findPhoneByLid (mock/Cloud API) → null без запроса к CRM", async () => {
      const { service, prisma } = makeService();
      await expect(asLid(service).resolveLidViaCrm("178322948505677@lid")).resolves.toBeNull();
      expect(prisma.customer.findMany).not.toHaveBeenCalled();
    });

    it("в CRM нет телефонов → null, провайдер не вызывается", async () => {
      const findPhoneByLid = jest.fn();
      const { service } = makeService({ findPhoneByLid, customers: [{ phone: null }] });
      await expect(asLid(service).resolveLidViaCrm("178322948505677@lid")).resolves.toBeNull();
      expect(findPhoneByLid).not.toHaveBeenCalled();
    });
  });
});

describe("WhatsAppInboundService M3: media (файл WA→local)", () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    while (tmpDirs.length > 0) {
      await fsp.rm(tmpDirs.pop()!, { recursive: true, force: true });
    }
  });

  function makePipeline(mediaDir: string) {
    const created: Array<Record<string, unknown>> = [];
    const comms: Array<Record<string, unknown>> = [];
    const convUpdates: Array<Record<string, unknown>> = [];
    let inboundRow: Record<string, unknown> | null = null;
    const tx = {
      whatsAppInboundMessage: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: "in-1" };
        }),
        update: jest.fn(async () => ({ id: "in-1" })),
      },
      whatsAppConversation: {
        upsert: jest.fn(async () => ({ id: "conv-1", customerId: null, matchingStatus: "UNMATCHED" })),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          convUpdates.push(data);
          return { id: "conv-1" };
        }),
      },
      whatsAppContact: { findUnique: jest.fn(async () => null) },
      customer: { findMany: jest.fn(async () => []) },
      communication: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          comms.push(data);
          return { id: "comm-1" };
        }),
      },
      whatsAppSuppression: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => ({ id: "sup-1" })),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      whatsAppAccount: {
        findFirst: jest.fn(async () => ({ id: "acc-1" })),
        create: jest.fn(async () => ({ id: "acc-1" })),
      },
      customer: { findMany: jest.fn(async () => []) },
      whatsAppInboundMessage: {
        findUnique: jest.fn(async () => inboundRow),
      },
    };
    const provider = { onInbound: jest.fn(() => jest.fn()) } as unknown as WhatsAppProvider;
    const config = {
      enabled: true,
      provider: "mock",
      defaultPhoneRegion: "AZ",
      mediaDir,
    } as unknown as WhatsAppConfig;
    const service = new WhatsAppInboundService(
      prisma as never,
      { nextCode: jest.fn(async () => "CML-1") } as never,
      { audit: jest.fn() } as never,
      config,
      provider,
    );
    return {
      service,
      created,
      comms,
      convUpdates,
      setInboundRow(row: Record<string, unknown> | null) {
        inboundRow = row;
      },
    };
  }

  function freshMediaDir(): string {
    const dir = path.join(os.tmpdir(), `wa-media-in-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tmpDirs.push(dir);
    return dir;
  }

  it("document с байтами → файл на диске + media-поля в create + PROCESSED + Communication c caption", async () => {
    const mediaDir = freshMediaDir();
    const h = makePipeline(mediaDir);

    const result = await h.service.processInbound(
      makeMessage({
        type: "document",
        text: "вот файл",
        media: { filename: "report.pdf", mimetype: "application/pdf", size: 1024, bytes: new Uint8Array([1, 2, 3]) },
      }),
    );

    expect(result).toMatchObject({ outcome: "persisted", processingStatus: "PROCESSED" });
    expect(h.created[0]).toMatchObject({
      mediaFilename: "report.pdf",
      mediaMime: "application/pdf",
      mediaSize: 1024,
      messageType: "document",
      text: "вот файл",
    });
    expect(h.created[0]!["mediaPath"]).toBe(path.posix.join("inbound", "IN-1", "report.pdf"));
    const onDisk = await fsp.readFile(path.join(mediaDir, "inbound", "IN-1", "report.pdf"));
    expect(Array.from(onDisk)).toEqual([1, 2, 3]);
    expect(h.comms[0]!["body"]).toBe("вот файл");
    expect(h.convUpdates[0]!["lastMessagePreview"]).toBe("вот файл");
  });

  it("image без байт (download упал) → mediaPath null, метаданные stanza сохраняются, PROCESSED", async () => {
    const mediaDir = freshMediaDir();
    const h = makePipeline(mediaDir);

    const result = await h.service.processInbound(
      makeMessage({
        type: "image",
        text: null,
        media: { filename: null, mimetype: "image/jpeg", size: 2048, bytes: null },
      }),
    );

    expect(result).toMatchObject({ outcome: "persisted", processingStatus: "PROCESSED" });
    expect(h.created[0]).toMatchObject({
      mediaFilename: null,
      mediaMime: "image/jpeg",
      mediaSize: 2048,
      mediaPath: null,
    });
    expect(h.comms[0]!["body"]).toBe("");
    expect(h.convUpdates[0]!["lastMessagePreview"]).toBe("image");
    await expect(fsp.access(path.join(mediaDir, "inbound"))).rejects.toThrow();
  });

  it("getMedia: строка с mediaPath → {filename,mimetype,mediaPath}; строка без файла → null", async () => {
    const h = makePipeline(freshMediaDir());
    h.setInboundRow({
      mediaFilename: "a.pdf",
      mediaMime: "application/pdf",
      mediaPath: path.posix.join("inbound", "IN-1", "a.pdf"),
    });
    await expect(h.service.getMedia("in-9")).resolves.toEqual({
      filename: "a.pdf",
      mimetype: "application/pdf",
      mediaPath: path.posix.join("inbound", "IN-1", "a.pdf"),
    });

    h.setInboundRow({ mediaFilename: null, mediaMime: null, mediaPath: null });
    await expect(h.service.getMedia("in-10")).resolves.toEqual({
      filename: "file",
      mimetype: null,
      mediaPath: null,
    });

    h.setInboundRow(null);
    await expect(h.service.getMedia("missing")).resolves.toBeNull();
  });
});
