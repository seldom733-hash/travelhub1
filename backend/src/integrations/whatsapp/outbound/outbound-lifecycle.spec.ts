import { describe, expect, it } from "@jest/globals";
import {
  WHATSAPP_OUTBOUND_TRANSITIONS,
  WhatsAppOutboundTransitionError,
  assertOutboundTransition,
  canOutboundTransition,
  isStaleSending,
  receiptEligibleTarget,
  receiptEvidenceField,
  reconcileTargetFromEvidence,
} from "./outbound-lifecycle";

describe("WhatsApp outbound lifecycle (M2)", () => {
  it("полный happy-path: CREATED → QUEUED → SENDING → SENT → DELIVERED → READ", () => {
    const path = ["CREATED", "QUEUED", "SENDING", "SENT", "DELIVERED", "READ"] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canOutboundTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it("SENDING: отказы и crash-исход", () => {
    expect(canOutboundTransition("SENDING", "FAILED_RETRYABLE")).toBe(true);
    expect(canOutboundTransition("SENDING", "FAILED_PERMANENT")).toBe(true);
    expect(canOutboundTransition("SENDING", "UNKNOWN")).toBe(true);
    expect(canOutboundTransition("SENDING", "SENT")).toBe(true);
    expect(canOutboundTransition("SENDING", "QUEUED")).toBe(false);
  });

  it("UNKNOWN: только явные recovery-переходы, автоповторов нет", () => {
    // Reconcile (evidence).
    expect(canOutboundTransition("UNKNOWN", "SENT")).toBe(true);
    expect(canOutboundTransition("UNKNOWN", "DELIVERED")).toBe(true);
    expect(canOutboundTransition("UNKNOWN", "READ")).toBe(true);
    // Mark failed.
    expect(canOutboundTransition("UNKNOWN", "FAILED_PERMANENT")).toBe(true);
    // Retry anyway.
    expect(canOutboundTransition("UNKNOWN", "QUEUED")).toBe(true);
    // Запрещено: self и прямой повтор SENDING.
    expect(canOutboundTransition("UNKNOWN", "UNKNOWN")).toBe(false);
    expect(canOutboundTransition("UNKNOWN", "SENDING")).toBe(false);
  });

  it("READ — терминальный статус; FAILED_PERMANENT терминален", () => {
    expect(WHATSAPP_OUTBOUND_TRANSITIONS.READ).toEqual([]);
    expect(WHATSAPP_OUTBOUND_TRANSITIONS.FAILED_PERMANENT).toEqual([]);
  });

  it("недопустимый переход бросает WhatsAppOutboundTransitionError", () => {
    expect(() => assertOutboundTransition("CREATED", "SENT")).toThrow(WhatsAppOutboundTransitionError);
    expect(() => assertOutboundTransition("READ", "SENT")).toThrow(WhatsAppOutboundTransitionError);
    expect(() => assertOutboundTransition("SENT", "SENT")).toThrow(WhatsAppOutboundTransitionError);
    expect(() => assertOutboundTransition("SENT", "DELIVERED")).not.toThrow();
  });

  it("receipt: монотонно вперёд только из SENT/DELIVERED; дубликаты игнорируются", () => {
    expect(receiptEligibleTarget("SENT", "delivered")).toBe("DELIVERED");
    expect(receiptEligibleTarget("SENT", "read")).toBe("READ");
    expect(receiptEligibleTarget("DELIVERED", "read")).toBe("READ");
    expect(receiptEligibleTarget("DELIVERED", "delivered")).toBeNull();
    expect(receiptEligibleTarget("SENT", "sent")).toBeNull();
    expect(receiptEligibleTarget("READ", "delivered")).toBeNull(); // назад нельзя
    // НЕ отправленные статусы receipt не двигают.
    expect(receiptEligibleTarget("CREATED", "delivered")).toBeNull();
    expect(receiptEligibleTarget("SENDING", "delivered")).toBeNull();
    expect(receiptEligibleTarget("UNKNOWN", "delivered")).toBeNull();
  });

  it("receipt evidence-колонки", () => {
    expect(receiptEvidenceField("sent")).toBe("sentAt");
    expect(receiptEvidenceField("delivered")).toBe("deliveredAt");
    expect(receiptEvidenceField("read")).toBe("readAt");
  });

  it("isStaleSending: только старше sendTimeout+grace", () => {
    const now = new Date("2026-10-02T12:00:00Z");
    const timeout = 30_000;
    expect(isStaleSending(new Date(now.getTime() - 60_001), now, timeout)).toBe(true);
    expect(isStaleSending(new Date(now.getTime() - 59_000), now, timeout)).toBe(false);
    expect(isStaleSending(now, now, timeout)).toBe(false);
  });

  it("reconcileTargetFromEvidence: READ > DELIVERED > SENT; нет evidence → null", () => {
    const now = new Date();
    expect(
      reconcileTargetFromEvidence({ sentAt: now, deliveredAt: now, readAt: now }),
    ).toBe("READ");
    expect(
      reconcileTargetFromEvidence({ sentAt: now, deliveredAt: now, readAt: null }),
    ).toBe("DELIVERED");
    expect(
      reconcileTargetFromEvidence({ sentAt: now, deliveredAt: null, readAt: null }),
    ).toBe("SENT");
    expect(
      reconcileTargetFromEvidence({ sentAt: null, deliveredAt: null, readAt: null }),
    ).toBeNull();
  });
});
