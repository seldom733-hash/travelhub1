import { describe, expect, it } from "@jest/globals";
import { WhatsAppConnectionState } from "../../../generated/prisma/enums";
import {
  WHATSAPP_ALLOWED_TRANSITIONS,
  WhatsAppStateTransitionError,
  assertTransition,
  canAutoReconnect,
  canTransition,
  stateAfterDisconnect,
} from "./connection-state.machine";

const ALL_STATES = Object.values(WhatsAppConnectionState) as WhatsAppConnectionState[];

describe("§6.2 - connection state machine", () => {
  it("таблица покрывает все состояния enum WhatsAppConnectionState (паритет со схемой)", () => {
    expect(Object.keys(WHATSAPP_ALLOWED_TRANSITIONS).sort()).toEqual([...ALL_STATES].sort());
  });

  it("допустимые переходы из таблицы разрешены; все остальные запрещены (включая self)", () => {
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        const allowed = (WHATSAPP_ALLOWED_TRANSITIONS[from] as readonly string[]).includes(to);
        expect(canTransition(from, to)).toBe(allowed && from !== to);
        if (allowed && from !== to) {
          expect(() => assertTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to)).toThrow(WhatsAppStateTransitionError);
        }
      }
    }
  });

  it("базовая цепочка §6.2 проходит по шагам", () => {
    const chain: WhatsAppConnectionState[] = [
      "DISCONNECTED",
      "INITIALIZING",
      "QR_REQUIRED",
      "CONNECTING",
      "CONNECTED",
      "RECONNECTING",
      "CONNECTED",
      "LOGGING_OUT",
      "DISCONNECTED",
    ];
    for (let i = 1; i < chain.length; i++) {
      expect(() => assertTransition(chain[i - 1], chain[i])).not.toThrow();
    }
  });

  it("CONNECTED → ERROR допустим (auth failure), CONNECTED → CONNECTING — нет", () => {
    expect(canTransition("CONNECTED", "ERROR")).toBe(true);
    expect(canTransition("CONNECTED", "CONNECTING")).toBe(false);
    expect(canTransition("CONNECTED", "DISCONNECTED")).toBe(false); // только через LOGGING_OUT/ERROR/RECONNECTING
  });

  it("LOGGING_OUT доступен из любого состояния, кроме самого себя, и ведёт только в DISCONNECTED", () => {
    for (const from of ALL_STATES) {
      expect(canTransition(from, "LOGGING_OUT")).toBe(from !== "LOGGING_OUT");
    }
    expect(WHATSAPP_ALLOWED_TRANSITIONS.LOGGING_OUT).toEqual(["DISCONNECTED"]);
  });

  it("stateAfterDisconnect разбирает причины по правилам §6.2 (+M2 LOGGED_OUT)", () => {
    expect(stateAfterDisconnect("loggedOut")).toBe("LOGGED_OUT"); // M2-амендмент владельца
    expect(stateAfterDisconnect("connectionReplaced")).toBe("ERROR");
    expect(stateAfterDisconnect("authFailure")).toBe("ERROR");
    expect(stateAfterDisconnect("network")).toBe("RECONNECTING");
    expect(stateAfterDisconnect("restartRequired")).toBe("RECONNECTING");
    expect(stateAfterDisconnect("shutdown")).toBe("LOGGING_OUT");
    expect(stateAfterDisconnect("unknown")).toBe("ERROR");
  });

  it("M2: удалённый logout → LOGGED_OUT; повторная пара возможна", () => {
    expect(canTransition("CONNECTED", "LOGGED_OUT")).toBe(true);
    expect(canTransition("RECONNECTING", "LOGGED_OUT")).toBe(true);
    expect(canTransition("DISCONNECTED", "LOGGED_OUT")).toBe(false);
    expect(canTransition("LOGGED_OUT", "LOGGED_OUT")).toBe(false);
    expect(WHATSAPP_ALLOWED_TRANSITIONS.LOGGED_OUT).toContain("DISCONNECTED");
    expect(WHATSAPP_ALLOWED_TRANSITIONS.LOGGED_OUT).toContain("INITIALIZING");
    // LOGGED_OUT → CONNECTED напрямую нельзя (только через новую инициализацию).
    expect(canTransition("LOGGED_OUT", "CONNECTED")).toBe(false);
    expect(() => assertTransition("LOGGED_OUT", "INITIALIZING")).not.toThrow();
  });

  it("auto-reconnect только для транзиентных причин", () => {
    expect(canAutoReconnect("network")).toBe(true);
    expect(canAutoReconnect("restartRequired")).toBe(true);
    expect(canAutoReconnect("loggedOut")).toBe(false);
    expect(canAutoReconnect("connectionReplaced")).toBe(false);
    expect(canAutoReconnect("authFailure")).toBe(false);
    expect(canAutoReconnect("unknown")).toBe(false);
  });

  it("WhatsAppStateTransitionError несёт from/to и понятный текст", () => {
    try {
      assertTransition("DISCONNECTED", "CONNECTED");
      throw new Error("should have thrown");
    } catch (error) {
      const err = error as WhatsAppStateTransitionError;
      expect(err.name).toBe("WhatsAppStateTransitionError");
      expect(err.from).toBe("DISCONNECTED");
      expect(err.to).toBe("CONNECTED");
      expect(err.message).toContain("DISCONNECTED → CONNECTED");
    }
  });
});
