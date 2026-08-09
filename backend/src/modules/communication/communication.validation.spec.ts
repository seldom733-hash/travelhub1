import {
  COMMUNICATION_CREATE_FORBIDDEN_KEYS,
  assertDirectionMatchesType,
  assertDirectionParticipantPolicy,
  assertNoSystemParticipantFromHttp,
  assertNoteHasNoRecipient,
  assertValidCommunicationBody,
  assertValidCommunicationSubject,
  assertValidContext,
  assertValidParticipant,
  hasForbiddenContent,
} from "./communication.validation";
import { ValidationDomainError } from "../../shared/errors";
import {
  CommunicationContextType,
  CommunicationDirection,
  CommunicationParticipantType,
  CommunicationType,
} from "../../generated/prisma/enums";

describe("Step 1.16 — Communication validation (§55 model/domain)", () => {
  // ── CML identity / content ────────────────────────────────────────────────

  it("CML code: формат серверный — code/id клиент не вводит (forbidden keys)", () => {
    for (const key of ["id", "code", "status", "actorUserId", "occurredAt", "requestId", "correlationId"]) {
      expect(COMMUNICATION_CREATE_FORBIDDEN_KEYS).toContain(key);
    }
  });

  it("body: непустой, ≤4000, plain text", () => {
    expect(() => assertValidCommunicationBody("Привет, покупатель!")).not.toThrow();
    expect(() => assertValidCommunicationBody("   ")).toThrow(ValidationDomainError);
    expect(() => assertValidCommunicationBody("")).toThrow(ValidationDomainError);
    expect(() => assertValidCommunicationBody("x".repeat(4001))).toThrow(ValidationDomainError);
    expect(() => assertValidCommunicationBody("x".repeat(4000))).not.toThrow();
    // Unicode RU/AZ/EN допустим.
    expect(() => assertValidCommunicationBody("Salam, Azərbaycan! Hello world.")).not.toThrow();
  });

  it("body: arbitrary HTML / script / control chars запрещены (§14/§50)", () => {
    expect(hasForbiddenContent("<script>alert(1)</script>")).toBe(true);
    expect(hasForbiddenContent("<b>bold</b>")).toBe(true);
    expect(hasForbiddenContent('onclick="x"')).toBe(false); // нет тега — plain text
    expect(hasForbiddenContent("a\u0000b")).toBe(true);
    expect(hasForbiddenContent("line1\nline2\ttab")).toBe(false); // \n\t допустимы
    expect(() => assertValidCommunicationBody("<img src=x onerror=alert(1)>")).toThrow(ValidationDomainError);
  });

  it("subject: ≤200, без HTML", () => {
    expect(() => assertValidCommunicationSubject(undefined)).not.toThrow();
    expect(() => assertValidCommunicationSubject("Заголовок")).not.toThrow();
    expect(() => assertValidCommunicationSubject("x".repeat(201))).toThrow(ValidationDomainError);
    expect(() => assertValidCommunicationSubject("<a href='x'>")).toThrow(ValidationDomainError);
  });

  // ── type/direction/channel (§6/§7/§8) ─────────────────────────────────────

  it("NOTE ⇒ INTERNAL; MESSAGE ⇒ INBOUND/OUTBOUND (не INTERNAL)", () => {
    expect(() => assertDirectionMatchesType(CommunicationType.NOTE, CommunicationDirection.INTERNAL)).not.toThrow();
    expect(() => assertDirectionMatchesType(CommunicationType.NOTE, CommunicationDirection.OUTBOUND)).toThrow(ValidationDomainError);
    expect(() => assertDirectionMatchesType(CommunicationType.MESSAGE, CommunicationDirection.INBOUND)).not.toThrow();
    expect(() => assertDirectionMatchesType(CommunicationType.MESSAGE, CommunicationDirection.OUTBOUND)).not.toThrow();
    expect(() => assertDirectionMatchesType(CommunicationType.MESSAGE, CommunicationDirection.INTERNAL)).toThrow(ValidationDomainError);
  });

  it("NOTE не может иметь recipient (§36)", () => {
    expect(() =>
      assertNoteHasNoRecipient(CommunicationType.NOTE, { type: CommunicationParticipantType.CUSTOMER, id: "cus-1" }),
    ).toThrow(ValidationDomainError);
    expect(() => assertNoteHasNoRecipient(CommunicationType.MESSAGE, { type: CommunicationParticipantType.CUSTOMER, id: "cus-1" })).not.toThrow();
  });

  // ── context (§10/§11) ──────────────────────────────────────────────────────

  it("context: только канонические типы; id обязателен (без FK — typed ref)", () => {
    expect(() => assertValidContext(CommunicationContextType.CUSTOMER, "cus-1")).not.toThrow();
    expect(() => assertValidContext(CommunicationContextType.ORDER, "ord-1")).not.toThrow();
    expect(() => assertValidContext(CommunicationContextType.BOOKING, "bkg-1")).not.toThrow();
    expect(() => assertValidContext(CommunicationContextType.PARTNER, "par-1")).not.toThrow();
    expect(() => assertValidContext("SUPPORT" as CommunicationContextType, "x")).toThrow(ValidationDomainError);
    expect(() => assertValidContext(CommunicationContextType.CUSTOMER, "")).toThrow(ValidationDomainError);
    expect(() => assertValidContext(CommunicationContextType.CUSTOMER, "x".repeat(65))).toThrow(ValidationDomainError);
  });

  // ── participant (§12/§13) ─────────────────────────────────────────────────

  it("participant: SYSTEM без id; USER/CUSTOMER/PARTNER — с id", () => {
    expect(() => assertValidParticipant({ type: CommunicationParticipantType.SYSTEM })).not.toThrow();
    expect(() => assertValidParticipant({ type: CommunicationParticipantType.USER, id: "usr-1" })).not.toThrow();
    expect(() => assertValidParticipant({ type: CommunicationParticipantType.CUSTOMER, id: "cus-1" })).not.toThrow();
    expect(() => assertValidParticipant({ type: CommunicationParticipantType.PARTNER, id: "par-1" })).not.toThrow();
    expect(() => assertValidParticipant({ type: CommunicationParticipantType.USER })).toThrow(ValidationDomainError);
    expect(() => assertValidParticipant({ type: CommunicationParticipantType.CUSTOMER, id: "" })).toThrow(ValidationDomainError);
    expect(() => assertValidParticipant({ type: "BOT" as CommunicationParticipantType, id: "b" })).toThrow(ValidationDomainError);
  });

  // ── STRICT REVIEW FIX: direction↔participant impersonation policy (§7) ────

  it("policy: NOTE — sender только USER, recipient отсутствует", () => {
    expect(() => assertDirectionParticipantPolicy({ type: CommunicationType.NOTE, direction: CommunicationDirection.INTERNAL })).not.toThrow();
    expect(() =>
      assertDirectionParticipantPolicy({ type: CommunicationType.NOTE, direction: CommunicationDirection.INTERNAL, sender: { type: CommunicationParticipantType.USER, id: "u1" } }),
    ).not.toThrow();
    expect(() =>
      assertDirectionParticipantPolicy({ type: CommunicationType.NOTE, direction: CommunicationDirection.INTERNAL, sender: { type: CommunicationParticipantType.CUSTOMER, id: "c1" } }),
    ).toThrow(ValidationDomainError);
  });

  it("policy: INBOUND — внешний sender (CUSTOMER/PARTNER), recipient внутренний USER", () => {
    expect(() =>
      assertDirectionParticipantPolicy({ type: CommunicationType.MESSAGE, direction: CommunicationDirection.INBOUND, sender: { type: CommunicationParticipantType.CUSTOMER, id: "c1" } }),
    ).not.toThrow();
    expect(() =>
      assertDirectionParticipantPolicy({
        type: CommunicationType.MESSAGE,
        direction: CommunicationDirection.INBOUND,
        sender: { type: CommunicationParticipantType.PARTNER, id: "p1" },
        recipient: { type: CommunicationParticipantType.USER, id: "u1" },
      }),
    ).not.toThrow();
    // Нет внешнего sender / sender внутренний / recipient внешний — запрещено.
    expect(() => assertDirectionParticipantPolicy({ type: CommunicationType.MESSAGE, direction: CommunicationDirection.INBOUND })).toThrow(ValidationDomainError);
    expect(() =>
      assertDirectionParticipantPolicy({ type: CommunicationType.MESSAGE, direction: CommunicationDirection.INBOUND, sender: { type: CommunicationParticipantType.USER, id: "u1" } }),
    ).toThrow(ValidationDomainError);
    expect(() =>
      assertDirectionParticipantPolicy({
        type: CommunicationType.MESSAGE,
        direction: CommunicationDirection.INBOUND,
        sender: { type: CommunicationParticipantType.CUSTOMER, id: "c1" },
        recipient: { type: CommunicationParticipantType.CUSTOMER, id: "c2" },
      }),
    ).toThrow(ValidationDomainError);
  });

  it("policy: OUTBOUND — sender внутренний USER, recipient внешний (CUSTOMER/PARTNER)", () => {
    expect(() =>
      assertDirectionParticipantPolicy({
        type: CommunicationType.MESSAGE,
        direction: CommunicationDirection.OUTBOUND,
        recipient: { type: CommunicationParticipantType.CUSTOMER, id: "c1" },
      }),
    ).not.toThrow();
    expect(() =>
      assertDirectionParticipantPolicy({
        type: CommunicationType.MESSAGE,
        direction: CommunicationDirection.OUTBOUND,
        recipient: { type: CommunicationParticipantType.PARTNER, id: "p1" },
      }),
    ).not.toThrow();
    // Без recipient / sender внешний / recipient внутренний — запрещено.
    expect(() => assertDirectionParticipantPolicy({ type: CommunicationType.MESSAGE, direction: CommunicationDirection.OUTBOUND })).toThrow(ValidationDomainError);
    expect(() =>
      assertDirectionParticipantPolicy({
        type: CommunicationType.MESSAGE,
        direction: CommunicationDirection.OUTBOUND,
        sender: { type: CommunicationParticipantType.CUSTOMER, id: "c1" },
        recipient: { type: CommunicationParticipantType.CUSTOMER, id: "c1" },
      }),
    ).toThrow(ValidationDomainError);
    expect(() =>
      assertDirectionParticipantPolicy({
        type: CommunicationType.MESSAGE,
        direction: CommunicationDirection.OUTBOUND,
        recipient: { type: CommunicationParticipantType.USER, id: "u1" },
      }),
    ).toThrow(ValidationDomainError);
  });

  it("policy: SYSTEM participant нельзя задать через HTTP create", () => {
    expect(() =>
      assertNoSystemParticipantFromHttp([{ type: CommunicationParticipantType.SYSTEM }, { type: CommunicationParticipantType.USER, id: "u1" }]),
    ).toThrow(ValidationDomainError);
    expect(() =>
      assertNoSystemParticipantFromHttp([{ type: CommunicationParticipantType.USER, id: "u1" }, { type: CommunicationParticipantType.SYSTEM }]),
    ).toThrow(ValidationDomainError);
    expect(() =>
      assertNoSystemParticipantFromHttp([{ type: CommunicationParticipantType.USER, id: "u1" }, { type: CommunicationParticipantType.CUSTOMER, id: "c1" }]),
    ).not.toThrow();
  });

  // ── timestamps / immutability (§16/§17/§41) ───────────────────────────────

  it("temporal/immutability: occurredAt/код/статус/timestamps/actor не принимаются из клиента", () => {
    for (const key of ["occurredAt", "code", "status", "createdAt", "updatedAt", "actorUserId", "actorId", "createdBy", "customerId", "partnerId", "correlationId", "system"]) {
      expect(COMMUNICATION_CREATE_FORBIDDEN_KEYS).toContain(key);
    }
  });
});
