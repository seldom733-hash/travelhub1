import {
  assertValidPreSaleBody,
  assertValidPreSaleSubject,
  preSaleMessageDirection,
} from "./communication.validation";
import { CONVERSATION_OPEN_FORBIDDEN_KEYS, CONVERSATION_SEND_FORBIDDEN_KEYS } from "../../shared/field-validation";
import { hasForbiddenText } from "../../shared/anti-disintermediation";
import { ValidationDomainError } from "../../shared/errors";
import { CommunicationDirection } from "../../generated/prisma/enums";

describe("Step 2.2E — pre-sale conversation validation", () => {
  // ── Direction mapping ───────────────────────────────────────────────────

  it("direction: автор BUYER → INBOUND, автор SELLER → OUTBOUND (server-derived)", () => {
    expect(preSaleMessageDirection("BUYER")).toBe(CommunicationDirection.INBOUND);
    expect(preSaleMessageDirection("SELLER")).toBe(CommunicationDirection.OUTBOUND);
  });

  // ── Body ────────────────────────────────────────────────────────────────

  it("body: непустой, ≤4000, plain text (reuse base-валидатора)", () => {
    expect(() => assertValidPreSaleBody("Здравствуйте! Могу предложить тур по Анталье.")).not.toThrow();
    expect(() => assertValidPreSaleBody("x".repeat(4000))).not.toThrow();
    expect(() => assertValidPreSaleBody("")).toThrow(ValidationDomainError);
    expect(() => assertValidPreSaleBody("   ")).toThrow(ValidationDomainError);
    expect(() => assertValidPreSaleBody("x".repeat(4001))).toThrow(ValidationDomainError);
    expect(() => assertValidPreSaleBody("<b>bold</b>")).toThrow(ValidationDomainError);
    expect(() => assertValidPreSaleBody("a\u0000b")).toThrow(ValidationDomainError);
  });

  it("body: анти-disintermediation — CHAT EXISTS ≠ CONTACT DISCLOSED (email/phone/URL/мессенджеры/соцсети → 422)", () => {
    expect(() => assertValidPreSaleBody("Пишите на partner@example.com")).toThrow(ValidationDomainError);
    expect(() => assertValidPreSaleBody("Позвоните +7 900 123-45-67")).toThrow(ValidationDomainError);
    expect(() => assertValidPreSaleBody("Смотрите https://example.com/tour")).toThrow(ValidationDomainError);
    expect(() => assertValidPreSaleBody("Напишите в t.me/hub")).toThrow(ValidationDomainError);
    expect(() => assertValidPreSaleBody("Инстаграм instagram.com/otdyh")).toThrow(ValidationDomainError);
    expect(() => assertValidPreSaleBody("Наш Telegram @otdyh_tours")).toThrow(ValidationDomainError);
  });

  it("body: ISO-даты и обычный текст НЕ считаются контактом (без ложных срабатываний)", () => {
    expect(() => assertValidPreSaleBody("Предлагаю даты: 2026-09-01 по 2026-09-07.")).not.toThrow();
    expect(() => assertValidPreSaleBody("Отель 5* с завтраками, трансфер включён")).not.toThrow();
    expect(hasForbiddenText("заезд 2026-12-31")).toBeNull();
    expect(hasForbiddenText("даты: 2026-09-01, звоните +994 50 123 45 67")).not.toBeNull();
  });

  it("subject: optional, ≤200, plain text, анти-disintermediation", () => {
    expect(() => assertValidPreSaleSubject(undefined)).not.toThrow();
    expect(() => assertValidPreSaleSubject("Обсуждение тура")).not.toThrow();
    expect(() => assertValidPreSaleSubject("x".repeat(201))).toThrow(ValidationDomainError);
    expect(() => assertValidPreSaleSubject("мой@email.com")).toThrow(ValidationDomainError);
    expect(() => assertValidPreSaleSubject("<script>")).toThrow(ValidationDomainError);
  });

  // ── Forbidden keys (mass assignment) ───────────────────────────────────

  it("open-команда: ownership/membership/context/sales/actor ключи запрещены (§27)", () => {
    for (const key of [
      "id",
      "code",
      "threadId",
      "buyerId",
      "customerId",
      "sellerId",
      "partnerId",
      "memberIds",
      "members",
      "buyerCustomerId",
      "sellerPartnerId",
      "proposalId",
      "distributionId",
      "status",
      "version",
      "createdAt",
      "createdBy",
      "acquisitionSource",
      "contactDisclosed",
      "quoteId",
      "saleId",
      "correlationId",
    ]) {
      expect(CONVERSATION_OPEN_FORBIDDEN_KEYS).toContain(key);
    }
    // Легитимные client-входы НЕ запрещены.
    expect(CONVERSATION_OPEN_FORBIDDEN_KEYS).not.toContain("buyerRequestId");
    expect(CONVERSATION_OPEN_FORBIDDEN_KEYS).not.toContain("sellerPublicId");
  });

  it("send-команда: ТОЛЬКО body/subject; авторство/direction/ownership → 422 (§28)", () => {
    for (const key of [
      "id",
      "code",
      "threadId",
      "conversationId",
      "buyerRequestId",
      "buyerId",
      "customerId",
      "sellerId",
      "partnerId",
      "memberIds",
      "sender",
      "senderId",
      "senderType",
      "senderName",
      "recipient",
      "recipientId",
      "recipientType",
      "direction",
      "status",
      "version",
      "occurredAt",
      "createdAt",
      "contactDisclosed",
      "correlationId",
    ]) {
      expect(CONVERSATION_SEND_FORBIDDEN_KEYS).toContain(key);
    }
    expect(CONVERSATION_SEND_FORBIDDEN_KEYS).not.toContain("body");
    expect(CONVERSATION_SEND_FORBIDDEN_KEYS).not.toContain("subject");
  });
});
