import { describe, expect, it } from "@jest/globals";
import { describeWhatsAppProviderContract } from "../whatsapp-provider.contract";
import { MockWhatsAppProvider, type MockWhatsAppProviderOptions } from "./mock-whatsapp.provider";
import { WhatsAppProviderError } from "../whatsapp-errors";

function harness(options: MockWhatsAppProviderOptions = {}) {
  const provider = new MockWhatsAppProvider(options);
  return {
    provider,
    driveState: async (state: Parameters<MockWhatsAppProvider["driveState"]>[0]) =>
      provider.driveState(state),
    driveInbound: async (partial = {}) => provider.driveInbound(partial),
    driveDelivery: async (partial = {}) => provider.driveDelivery(partial),
    failNextSend: async (kind: "retryable" | "permanent") => provider.failNextSend(kind),
    reset: async () => {
      await provider.stop().catch(() => undefined);
    },
  };
}

describeWhatsAppProviderContract("MockWhatsAppProvider", () => harness());

describe("MockWhatsAppProvider - mock-specific behaviour", () => {
  it("конкурентные start() выполняют ровно одну инициализацию", async () => {
    const provider = new MockWhatsAppProvider();
    await Promise.all([provider.start(), provider.start(), provider.start()]);
    expect(provider.getSnapshot().state).toBe("CONNECTED");
    expect(provider.initCount).toBe(1);
  });

  it("startFlow=qr: INITIALIZING → QR_REQUIRED с QR-строкой; после pairing → CONNECTED", async () => {
    const provider = new MockWhatsAppProvider({ startFlow: "qr" });
    await provider.start();
    const qrSnapshot = provider.getSnapshot();
    expect(qrSnapshot.state).toBe("QR_REQUIRED");
    expect(qrSnapshot.qr).toBe("mock-qr-1");
    provider.driveState("CONNECTING");
    provider.driveState("CONNECTED");
    const connected = provider.getSnapshot();
    expect(connected.state).toBe("CONNECTED");
    expect(connected.qr).toBeNull();
    expect(connected.phone).toBe("+994501234567");
    await provider.logout();
    expect(provider.getSnapshot().state).toBe("DISCONNECTED");
    expect(provider.getSnapshot().phone).toBeNull();
  });

  it("send() возвращает messageId, произведённый от operation key", async () => {
    const provider = new MockWhatsAppProvider();
    await provider.start();
    const result = await provider.send({
      recipientJid: "994501234567@s.whatsapp.net",
      text: "hi",
      messageId: "op-key-42",
    });
    expect(result.providerMessageId).toBe("mock-op-key-42");
  });

  it("rate_limit / invalid_recipient сохраняют семантику retryable", async () => {
    const provider = new MockWhatsAppProvider();
    await provider.start();

    provider.failNextSend("rate_limit");
    const rateLimited = await provider
      .send({ recipientJid: "x@s.whatsapp.net", text: "a", messageId: "m1" })
      .catch((error: unknown) => error);
    expect(rateLimited).toBeInstanceOf(WhatsAppProviderError);
    expect((rateLimited as WhatsAppProviderError).retryable).toBe(true);
    expect((rateLimited as WhatsAppProviderError).kind).toBe("rate_limit");

    provider.failNextSend("invalid_recipient");
    const invalid = await provider
      .send({ recipientJid: "x@s.whatsapp.net", text: "a", messageId: "m2" })
      .catch((error: unknown) => error);
    expect((invalid as WhatsAppProviderError).retryable).toBe(false);
    expect((invalid as WhatsAppProviderError).kind).toBe("invalid_recipient");
  });

  it("driveInbound сохраняет fromMe/lid/senderPn (provider metadata, I2)", async () => {
    const provider = new MockWhatsAppProvider();
    const seen: Array<{ fromMe: boolean; lid: string | null; senderPn: string | null }> = [];
    provider.onInbound((message) =>
      seen.push({ fromMe: message.fromMe, lid: message.lid, senderPn: message.senderPn }),
    );
    provider.driveInbound({
      providerMessageId: "lid-1",
      fromMe: true,
      lid: "123456789@lid",
      senderPn: "994501234567@s.whatsapp.net",
    });
    expect(seen).toEqual([
      { fromMe: true, lid: "123456789@lid", senderPn: "994501234567@s.whatsapp.net" },
    ]);
  });

  it("snapshot заморожен (мутация невозможна)", async () => {
    const provider = new MockWhatsAppProvider();
    const snapshot = provider.getSnapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});
