import { afterEach, beforeEach, expect, it } from "@jest/globals";
import type {
  WhatsAppDeliveryUpdate,
  WhatsAppInboundProviderMessage,
  WhatsAppProvider,
} from "./whatsapp-provider";
import type { WhatsAppConnectionState } from "../../../generated/prisma/enums";
import {
  WhatsAppNotConnectedError,
  WhatsAppProviderError,
} from "./whatsapp-errors";

/**
 * Единый contract suite для всех реализаций WhatsAppProvider (M1: mock;
 * M2: Baileys). Провайдер обязан пройти его без изменений — это и есть
 * доказательство соответствия контракту (R3).
 */
export interface WhatsAppProviderContractHarness {
  readonly provider: WhatsAppProvider;
  /** Перевести провайдер в состояние (с проверкой таблицы §6.2). */
  driveState(state: WhatsAppConnectionState): Promise<void>;
  /** Смоделировать входящее сообщение провайдером. */
  driveInbound(partial?: Partial<WhatsAppInboundProviderMessage>): Promise<void>;
  /** Смоделировать delivery receipt. */
  driveDelivery(partial?: Partial<WhatsAppDeliveryUpdate>): Promise<void>;
  /** Следующий send() завершится ошибкой: retryable=true / permanent=false. */
  failNextSend(kind: "retryable" | "permanent"): Promise<void>;
  /** Полный сброс перед следующим тестом. */
  reset(): Promise<void>;
}

export function describeWhatsAppProviderContract(
  label: string,
  createHarness: () => WhatsAppProviderContractHarness | Promise<WhatsAppProviderContractHarness>,
): void {
  let harness: WhatsAppProviderContractHarness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(async () => {
    await harness.reset();
  });

  it("capabilities: структура контракта (qrPairing/deliveryReceipts/media/lease/templates)", () => {
    const caps = harness.provider.capabilities;
    expect(typeof caps.qrPairing).toBe("boolean");
    expect(typeof caps.deliveryReceipts).toBe("boolean");
    expect(typeof caps.requiresSessionOwnership).toBe("boolean");
    expect(typeof caps.requiresApprovedTemplates).toBe("boolean");
    expect(Array.isArray(caps.media)).toBe(true);
    for (const medium of caps.media) {
      expect(["image", "video", "audio", "document", "sticker"]).toContain(medium);
    }
  });

  it("начальный snapshot: DISCONNECTED, без QR, с instanceId", () => {
    const snapshot = harness.provider.getSnapshot();
    expect(snapshot.state).toBe("DISCONNECTED");
    expect(snapshot.qr).toBeNull();
    expect(snapshot.connectedAt).toBeNull();
    expect(typeof snapshot.instanceId).toBe("string");
    expect(snapshot.instanceId.length).toBeGreaterThan(0);
  });

  it("start() доводит до CONNECTED; конкурентные start() безопасны", async () => {
    await Promise.all([harness.provider.start(), harness.provider.start()]);
    expect(harness.provider.getSnapshot().state).toBe("CONNECTED");
    await harness.provider.start(); // идемпотентный повтор
    expect(harness.provider.getSnapshot().state).toBe("CONNECTED");
  });

  it("stop() → DISCONNECTED и идемпотентен", async () => {
    await harness.provider.start();
    await harness.provider.stop();
    expect(harness.provider.getSnapshot().state).toBe("DISCONNECTED");
    await harness.provider.stop();
    expect(harness.provider.getSnapshot().state).toBe("DISCONNECTED");
  });

  it("logout() → DISCONNECTED (явный выход, без QR-состояний)", async () => {
    await harness.provider.start();
    await harness.provider.logout();
    expect(harness.provider.getSnapshot().state).toBe("DISCONNECTED");
  });

  it("onStateChange: события при переходах + unsubscribe отписывает", async () => {
    const seen: WhatsAppConnectionState[] = [];
    const off = harness.provider.onStateChange((snapshot) => seen.push(snapshot.state));
    await harness.provider.start();
    expect(seen).toContain("CONNECTED");
    const countAfterStart = seen.length;
    off();
    await harness.provider.stop();
    expect(seen.length).toBe(countAfterStart);
  });

  it("onInbound: доставляет сообщение провайдера + unsubscribe отписывает", async () => {
    const seen: WhatsAppInboundProviderMessage[] = [];
    const off = harness.provider.onInbound((message) => seen.push(message));
    await harness.driveInbound({ providerMessageId: "contract-in-1", fromMe: false });
    expect(seen).toHaveLength(1);
    expect(seen[0].providerMessageId).toBe("contract-in-1");
    expect(typeof seen[0].occurredAt.getTime()).toBe("number");
    off();
    await harness.driveInbound({ providerMessageId: "contract-in-2" });
    expect(seen).toHaveLength(1);
  });

  it("onDeliveryUpdate: доставляет receipt + unsubscribe отписывает", async () => {
    const seen: WhatsAppDeliveryUpdate[] = [];
    const off = harness.provider.onDeliveryUpdate((update) => seen.push(update));
    await harness.driveDelivery({ providerMessageId: "contract-out-1", status: "delivered" });
    expect(seen).toHaveLength(1);
    expect(seen[0].status).toBe("delivered");
    off();
    await harness.driveDelivery({ providerMessageId: "contract-out-2" });
    expect(seen).toHaveLength(1);
  });

  it("send() без соединения → WhatsAppNotConnectedError, retryable=true", async () => {
    const failure = await harness.provider
      .send({ recipientJid: "994501234567@s.whatsapp.net", text: "hi", messageId: "op-1" })
      .then(() => null)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(WhatsAppNotConnectedError);
    expect((failure as WhatsAppProviderError).retryable).toBe(true);
  });

  it("send() после stop() снова отклоняется как not connected", async () => {
    await harness.provider.start();
    await harness.provider.stop();
    const failure = await harness.provider
      .send({ recipientJid: "994501234567@s.whatsapp.net", text: "hi", messageId: "op-2" })
      .then(() => null)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(WhatsAppNotConnectedError);
  });

  it("send() в CONNECTED → результат с providerMessageId и sentAt", async () => {
    await harness.provider.start();
    const result = await harness.provider.send({
      recipientJid: "994501234567@s.whatsapp.net",
      text: "hello",
      messageId: "op-3",
    });
    expect(typeof result.providerMessageId).toBe("string");
    expect(result.providerMessageId.length).toBeGreaterThan(0);
    expect(result.sentAt).toBeInstanceOf(Date);
  });

  it("send() retryable-failure → ошибка с retryable=true", async () => {
    await harness.provider.start();
    await harness.failNextSend("retryable");
    const failure = await harness.provider
      .send({ recipientJid: "994501234567@s.whatsapp.net", text: "hi", messageId: "op-4" })
      .then(() => null)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(WhatsAppProviderError);
    expect((failure as WhatsAppProviderError).retryable).toBe(true);
  });

  it("send() permanent-failure → ошибка с retryable=false", async () => {
    await harness.provider.start();
    await harness.failNextSend("permanent");
    const failure = await harness.provider
      .send({ recipientJid: "994501234567@s.whatsapp.net", text: "hi", messageId: "op-5" })
      .then(() => null)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(WhatsAppProviderError);
    expect((failure as WhatsAppProviderError).retryable).toBe(false);
  });

  it("reconcile: неизвестный providerMessageId → null (нет evidence)", async () => {
    expect(await harness.provider.reconcile("contract-unknown-id")).toBeNull();
  });

  it("reconcile: успешный send фиксирует evidence 'sent'", async () => {
    await harness.provider.start();
    const result = await harness.provider.send({
      recipientJid: "994501234567@s.whatsapp.net",
      text: "reconcile me",
      messageId: "op-rec-1",
    });
    const evidence = await harness.provider.reconcile(result.providerMessageId);
    expect(evidence).not.toBeNull();
    expect(evidence?.status).toBe("sent");
    expect(evidence?.observedAt).toBeInstanceOf(Date);
  });

  it("reconcile: delivery receipt фиксирует evidence 'delivered'", async () => {
    await harness.driveDelivery({ providerMessageId: "contract-rec-2", status: "delivered" });
    const evidence = await harness.provider.reconcile("contract-rec-2");
    expect(evidence?.status).toBe("delivered");
  });
}
