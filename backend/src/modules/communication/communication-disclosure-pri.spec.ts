/**
 * Step 3.7B.3 — sanitizeBodyForBasic precision tests.
 *
 * Tests the protect-sanitize-restore pattern that ensures canonical
 * business identifiers survive contact sanitization.
 *
 * Since sanitizeBodyForBasic is private, we test via toDto() which
 * applies it when partnerTier="BASIC".
 */
import { CommunicationParticipantType } from "../../generated/prisma/enums";
import { CommunicationService } from "./communication.service";

// Minimal Prisma-like stub (only methods under test are called)
const stubPrisma: any = {};
const stubIds: any = { nextCode: async () => "CML-TEST" };
const stubSecurity: any = { audit: async () => {} };

// Create service with minimal constructor deps
const svc = new CommunicationService(stubPrisma as any, stubIds as any, stubSecurity as any);

// Access the private method via prototype for unit testing
const sanitize = (svc as any).sanitizeBodyForBasic.bind(svc) as (body: string) => string;

// Minimal Communication row for toDto testing
const baseRow = {
  id: "id",
  code: "CML-00000001",
  type: "MESSAGE" as any,
  channel: "PLATFORM" as any,
  direction: "INBOUND" as any,
  status: "ACTIVE" as any,
  subject: null,
  body: "",
  contextType: "ORDER" as any,
  contextId: "ctx-id",
  senderType: CommunicationParticipantType.SYSTEM,
  senderId: null,
  recipientType: CommunicationParticipantType.PARTNER,
  recipientId: "partner-id",
  occurredAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Step 3.7B.3 — sanitizeBodyForBasic precision", () => {
  // ── Business code preservation ──────────────────────────────────────────

  it("preserves canonical business code ORD-XXXXXXXX", () => {
    const result = sanitize("Order ORD-00000001 confirmed");
    expect(result).toContain("ORD-00000001");
  });

  it("preserves canonical business code BKG-XXXXXXXX", () => {
    const result = sanitize("Booking BKG-00000001 assigned");
    expect(result).toContain("BKG-00000001");
  });

  it("preserves TH-YYYY-###### order number", () => {
    const result = sanitize("Order TH-2026-000001 confirmed");
    expect(result).toContain("TH-2026-000001");
  });

  it("preserves PAY-XXXXXXXX payment code", () => {
    const result = sanitize("Payment PAY-00000001 processing");
    expect(result).toContain("PAY-00000001");
  });

  it("preserves CUS-XXXXXXXX customer code", () => {
    const result = sanitize("Customer CUS-00000001 linked");
    expect(result).toContain("CUS-00000001");
  });

  it("preserves LED-XXXXXXXX lead code", () => {
    const result = sanitize("Lead LED-00000001 created");
    expect(result).toContain("LED-00000001");
  });

  it("preserves OPP-XXXXXXXX opportunity code", () => {
    const result = sanitize("Opportunity OPP-00000001 opened");
    expect(result).toContain("OPP-00000001");
  });

  it("preserves QTE-XXXXXXXX quote code", () => {
    const result = sanitize("Quote QTE-00000001 sent");
    expect(result).toContain("QTE-00000001");
  });

  it("preserves SAL-XXXXXXXX sale code", () => {
    const result = sanitize("Sale SAL-00000001 closed");
    expect(result).toContain("SAL-00000001");
  });

  it("preserves multiple business codes in same body", () => {
    const result = sanitize(
      "Order TH-2026-000001 (ORD-00000001) confirmed. Booking BKG-00000001 assigned. Payment PAY-00000001 processing."
    );
    expect(result).toContain("TH-2026-000001");
    expect(result).toContain("ORD-00000001");
    expect(result).toContain("BKG-00000001");
    expect(result).toContain("PAY-00000001");
  });

  it("preserves business codes adjacent to punctuation", () => {
    const result = sanitize("(ORD-00000001), [BKG-00000001], TH-2026-000001.");
    expect(result).toContain("ORD-00000001");
    expect(result).toContain("BKG-00000001");
    expect(result).toContain("TH-2026-000001");
  });

  // ── Contact blocking ────────────────────────────────────────────────────

  it("hides email addresses", () => {
    const result = sanitize("Contact user@example.com for details");
    expect(result).not.toContain("user@example.com");
    expect(result).toContain("[contact hidden]");
  });

  it("hides phone numbers", () => {
    const result = sanitize("Call +994500000001 for info");
    expect(result).not.toContain("+994500000001");
    expect(result).toContain("[contact hidden]");
  });

  it("hides URLs", () => {
    const result = sanitize("Visit https://example.invalid/contact");
    expect(result).not.toContain("https://example.invalid");
    expect(result).toContain("[contact hidden]");
  });

  it("hides social/contact handles", () => {
    const result = sanitize("Telegram t.me/username for contact");
    expect(result).not.toContain("t.me/username");
    expect(result).toContain("[contact hidden]");
  });

  // ── Mixed content (codes + contacts) ────────────────────────────────────

  it("business code + phone in same string: code preserved, phone hidden", () => {
    const result = sanitize("Order TH-2026-000001, contact +994500000001");
    expect(result).toContain("TH-2026-000001");
    expect(result).not.toContain("+994500000001");
    expect(result).toContain("[contact hidden]");
  });

  it("business code + email in same string: code preserved, email hidden", () => {
    const result = sanitize("Payment PAY-00000001, email test@example.invalid");
    expect(result).toContain("PAY-00000001");
    expect(result).not.toContain("test@example.invalid");
  });

  it("business code + URL in same string: code preserved, URL hidden", () => {
    const result = sanitize("See BKG-00000001, details at https://example.invalid");
    expect(result).toContain("BKG-00000001");
    expect(result).not.toContain("https://example.invalid");
  });

  it("full mixed content: all codes preserved, all contacts hidden", () => {
    const result = sanitize(
      "Order TH-2026-000001 (ORD-00000001) confirmed. Booking BKG-00000001. Contact: precision-test@example.invalid. Phone: +994500000001. Details: https://example.invalid/contact. Payment PAY-00000001 processing. Lead LED-00000001 created."
    );
    // All business codes preserved
    expect(result).toContain("TH-2026-000001");
    expect(result).toContain("ORD-00000001");
    expect(result).toContain("BKG-00000001");
    expect(result).toContain("PAY-00000001");
    expect(result).toContain("LED-00000001");
    // All contacts hidden
    expect(result).not.toContain("precision-test@example.invalid");
    expect(result).not.toContain("+994500000001");
    expect(result).not.toContain("https://example.invalid");
    // Prose preserved
    expect(result).toContain("confirmed");
    expect(result).toContain("processing");
    expect(result).toContain("created");
  });

  // ── Ordinary text preservation ───────────────────────────────────────────

  it("ordinary prose is unchanged", () => {
    const input = "Your order has been confirmed. The tour starts at 10:00 AM.";
    expect(sanitize(input)).toBe(input);
  });

  it("date-like values are not falsely blocked", () => {
    const input = "Travel dates: 2026-09-01 to 2026-09-07. Price: 1500 AZN.";
    expect(sanitize(input)).toBe(input);
  });

  // ── toDto integration ───────────────────────────────────────────────────

  it("toDto with partnerTier BASIC sanitizes body", () => {
    const row = { ...baseRow, body: "Order TH-2026-000001, email test@example.com" };
    const dto = (svc as any).toDto(row, { redactUserIds: false, partnerTier: "BASIC" });
    expect(dto.body).toContain("TH-2026-000001");
    expect(dto.body).not.toContain("test@example.com");
    expect(dto.body).toContain("[contact hidden]");
  });

  it("toDto with partnerTier PRO preserves body", () => {
    const row = { ...baseRow, body: "Order TH-2026-000001, email test@example.com" };
    const dto = (svc as any).toDto(row, { redactUserIds: false, partnerTier: "PRO" });
    expect(dto.body).toBe("Order TH-2026-000001, email test@example.com");
  });

  it("toDto without partnerTier preserves body", () => {
    const row = { ...baseRow, body: "Order TH-2026-000001, email test@example.com" };
    const dto = (svc as any).toDto(row, { redactUserIds: false });
    expect(dto.body).toBe("Order TH-2026-000001, email test@example.com");
  });
});
