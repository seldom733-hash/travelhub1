import { describe, expect, it } from "@jest/globals";
import {
  WhatsAppAuthenticationError,
  WhatsAppInvalidRecipientError,
  WhatsAppMessageSendError,
  WhatsAppNotConnectedError,
  WhatsAppProviderError,
  WhatsAppRateLimitError,
  WhatsAppSessionError,
} from "./whatsapp-errors";

describe("WhatsApp typed errors (D7 retryable semantics)", () => {
  it("retryable-семантика по умолчанию", () => {
    expect(new WhatsAppNotConnectedError().retryable).toBe(true);
    expect(new WhatsAppRateLimitError().retryable).toBe(true);
    expect(new WhatsAppAuthenticationError().retryable).toBe(false);
    expect(new WhatsAppSessionError().retryable).toBe(false);
    expect(new WhatsAppInvalidRecipientError().retryable).toBe(false);
    expect(new WhatsAppMessageSendError("boom", true).retryable).toBe(true);
    expect(new WhatsAppMessageSendError("boom", false).retryable).toBe(false);
  });

  it("kind и name различимы; все — наследники WhatsAppProviderError", () => {
    const errors: WhatsAppProviderError[] = [
      new WhatsAppNotConnectedError(),
      new WhatsAppAuthenticationError(),
      new WhatsAppSessionError(),
      new WhatsAppRateLimitError(),
      new WhatsAppInvalidRecipientError(),
      new WhatsAppMessageSendError("x", true),
    ];
    const kinds = errors.map((error) => error.kind);
    expect(kinds).toEqual([
      "not_connected",
      "authentication",
      "session",
      "rate_limit",
      "invalid_recipient",
      "message_send",
    ]);
    for (const error of errors) {
      expect(error).toBeInstanceOf(WhatsAppProviderError);
      expect(error).toBeInstanceOf(Error);
      expect(typeof error.message).toBe("string");
    }
  });

  it("cause пробрасывается (диагностика без утечки в API-ответы)", () => {
    const cause = new Error("socket hang up");
    const error = new WhatsAppProviderError("provider", "provider down", {
      retryable: true,
      cause,
    });
    expect(error.cause).toBe(cause);
    expect(error.kind).toBe("provider");
  });
});
