import { afterEach, describe, expect, it, vi } from "vitest";
import {
  newIdempotencyKey,
  sendWhatsAppMessage,
  uploadWhatsAppFile,
  whatsappMediaUrl,
  WhatsAppApiError,
  IDEMPOTENCY_KEY_RE,
} from "./whatsapp";

/** Backend IDEMPOTENCY_KEY_RE: ^[A-Za-z0-9._~-]+$ (макс. 128). */
const KEY_RE = /^[A-Za-z0-9._~-]+$/;

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("whatsapp.send (M3 §19/§26 — Idempotency-Key + получатель диалога)", () => {
  it("POST /whatsapp/messages: Idempotency-Key (regex, ≤128), conversationId, текст trimmed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        outboundId: "o1",
        communicationCode: "CML-1",
        status: "SENT",
        providerMessageId: "p1",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendWhatsAppMessage({
      conversationId: "c1",
      text: "  Здравствуйте  ",
      phone: "+994501112233",
    });

    expect(res.status).toBe("SENT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/whatsapp/messages");
    expect(init.credentials).toBe("include");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Idempotency-Key"]).toMatch(KEY_RE);
    expect(headers["Idempotency-Key"].length).toBeLessThanOrEqual(128);
    expect(JSON.parse(init.body as string)).toEqual({
      conversationId: "c1",
      text: "Здравствуйте",
      phone: "+994501112233",
    });
  });

  it("customerId в body; 422 (телефон Customer ≠ диалогу) → retry по телефону диалога с НОВЫМ ключом", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(422, {
          message: "conversationId does not match the resolved recipient (customerId/phone)",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          outboundId: "o2",
          communicationCode: "CML-2",
          status: "SENT",
          providerMessageId: "p2",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendWhatsAppMessage({
      conversationId: "c2",
      text: "hi",
      customerId: "cu1",
      phone: "+994502223344",
    });

    expect(res.outboundId).toBe("o2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(firstBody).toEqual({ conversationId: "c2", text: "hi", customerId: "cu1" });
    const secondInit = (fetchMock.mock.calls[1] as any)[1];
    expect(JSON.parse(secondInit.body)).toEqual({
      conversationId: "c2",
      text: "hi",
      phone: "+994502223344",
    });
    const firstKey = (fetchMock.mock.calls[0] as any)[1].headers["Idempotency-Key"];
    expect(secondInit.headers["Idempotency-Key"]).not.toBe(firstKey);
    expect(secondInit.headers["Idempotency-Key"]).toMatch(KEY_RE);
  });

  it("409 suppressed (§22) → WhatsAppApiError(status=409), без retry-попыток", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(409, { message: "Recipient opted out of WhatsApp messages (suppressed)" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendWhatsAppMessage({ conversationId: "c3", text: "x", phone: "+994503334455" }),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("opted out"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("422 без customerId (валидация текста/получателя) → пробрасывается как есть, без retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(422, { message: "Either customerId or phone is required" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendWhatsAppMessage({ conversationId: "c4", text: "x", phone: "" }),
    ).rejects.toBeInstanceOf(WhatsAppApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("newIdempotencyKey: ключи всегда в формате backend-regex и ≤128 (50 итераций)", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const key = newIdempotencyKey();
      expect(key).toMatch(IDEMPOTENCY_KEY_RE);
      expect(key.length).toBeLessThanOrEqual(128);
      keys.add(key);
    }
    expect(keys.size).toBe(50);
  });
});

describe("whatsapp media (M3+: файл local→local)", () => {
  it("sendWhatsAppMessage с uploadId: body содержит uploadId, пустой текст допустим", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        outboundId: "o9",
        communicationCode: "CML-9",
        status: "SENT",
        providerMessageId: "p9",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendWhatsAppMessage({
      conversationId: "c9",
      text: "   ",
      phone: "+994501112233",
      uploadId: "11111111-2222-3333-4444-555555555555",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/whatsapp/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toMatch(KEY_RE);
    expect(JSON.parse(init.body as string)).toEqual({
      conversationId: "c9",
      text: "",
      phone: "+994501112233",
      uploadId: "11111111-2222-3333-4444-555555555555",
    });
  });

  it("sendWhatsAppMessage без uploadId: ключ uploadId в body не появляется", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, { outboundId: "o10", communicationCode: "CML-10", status: "SENT", providerMessageId: "p10" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendWhatsAppMessage({ conversationId: "c10", text: "hi", phone: "+994501112233" });

    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(body).not.toHaveProperty("uploadId");
  });

  it("uploadWhatsAppFile: multipart POST /uploads c полем file, без Idempotency-Key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        uploadId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        filename: "report.pdf",
        mimetype: "application/pdf",
        size: 12,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await uploadWhatsAppFile(new File(["hello world!"], "report.pdf", { type: "application/pdf" }));

    expect(res.uploadId).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(res.filename).toBe("report.pdf");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/whatsapp/uploads");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers["Idempotency-Key"]).toBeUndefined();
  });

  it("uploadWhatsAppFile: ошибка HTTP → WhatsAppApiError со статусом", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(413, { message: "File too large" })));

    await expect(uploadWhatsAppFile(new File(["x"], "big.bin"))).rejects.toMatchObject({
      status: 413,
      message: "File too large",
    });
  });

  it("whatsappMediaUrl: origin/id в пути (id экранируется)", () => {
    expect(whatsappMediaUrl("inbound", "abc-123")).toBe("/api/v1/whatsapp/media/inbound/abc-123");
    expect(whatsappMediaUrl("outbound", "a/b")).toBe("/api/v1/whatsapp/media/outbound/a%2Fb");
  });
});
