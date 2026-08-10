import { ValidationDomainError } from "../../shared/errors";
import { LeadStatus, OpportunityStatus, QuoteStatus } from "../../generated/prisma/enums";
import {
  assertLeadTransition,
  assertOpportunityTransition,
  assertQuoteTransition,
  isTerminalLead,
  isTerminalOpportunity,
  isTerminalQuote,
  SALES_CREATE_FORBIDDEN_KEYS,
  SALES_TRANSITION_FORBIDDEN_KEYS,
} from "./sales.validation";
import * as SalesValidation from "./sales.validation";

describe("Sales Domain Foundation — lifecycle transition guards", () => {
  it("Lead: NEW → QUALIFIED / DISQUALIFIED; терминал DISQUALIFIED не принимает переходов", () => {
    expect(() => assertLeadTransition(LeadStatus.NEW, LeadStatus.QUALIFIED)).not.toThrow();
    expect(() => assertLeadTransition(LeadStatus.NEW, LeadStatus.DISQUALIFIED)).not.toThrow();
    expect(() => assertLeadTransition(LeadStatus.QUALIFIED, LeadStatus.DISQUALIFIED)).toThrow(ValidationDomainError);
    expect(() => assertLeadTransition(LeadStatus.DISQUALIFIED, LeadStatus.NEW)).toThrow(ValidationDomainError);
    expect(() => assertLeadTransition(LeadStatus.DISQUALIFIED, LeadStatus.QUALIFIED)).toThrow(ValidationDomainError);
    expect(isTerminalLead(LeadStatus.DISQUALIFIED)).toBe(true);
    expect(isTerminalLead(LeadStatus.NEW)).toBe(false);
  });

  it("Opportunity: NEW → OPEN → WON|LOST; терминалы не принимают переходов", () => {
    expect(() => assertOpportunityTransition(OpportunityStatus.NEW, OpportunityStatus.OPEN)).not.toThrow();
    expect(() => assertOpportunityTransition(OpportunityStatus.OPEN, OpportunityStatus.WON)).not.toThrow();
    expect(() => assertOpportunityTransition(OpportunityStatus.OPEN, OpportunityStatus.LOST)).not.toThrow();
    expect(() => assertOpportunityTransition(OpportunityStatus.NEW, OpportunityStatus.WON)).toThrow(ValidationDomainError);
    expect(() => assertOpportunityTransition(OpportunityStatus.WON, OpportunityStatus.LOST)).toThrow(ValidationDomainError);
    expect(() => assertOpportunityTransition(OpportunityStatus.LOST, OpportunityStatus.OPEN)).toThrow(ValidationDomainError);
    expect(isTerminalOpportunity(OpportunityStatus.WON)).toBe(true);
    expect(isTerminalOpportunity(OpportunityStatus.LOST)).toBe(true);
    expect(isTerminalOpportunity(OpportunityStatus.OPEN)).toBe(false);
  });

  it("Quote: DRAFT → ISSUED; ISSUED — терминал (acceptance/conversion — Step 2.3)", () => {
    expect(() => assertQuoteTransition(QuoteStatus.DRAFT, QuoteStatus.ISSUED)).not.toThrow();
    expect(() => assertQuoteTransition(QuoteStatus.ISSUED, QuoteStatus.DRAFT)).toThrow(ValidationDomainError);
    expect(isTerminalQuote(QuoteStatus.ISSUED)).toBe(true);
  });

  it("Sale: рабочие переходы в Step 2.1 отсутствуют (completion → OrderRequested — Step 2.4)", () => {
    // REVIEW FIX 1 (strict review): transition-команды Sale в Step 2.1 нет —
    // семантика «Sale completion → OrderRequested» принадлежит Step 2.4, чтобы
    // не зафиксировать неоднозначный terminal CLOSED до события.
    const salesExports = Object.keys(SalesValidation);
    expect(salesExports).not.toContain("assertSaleTransition");
    expect(salesExports).not.toContain("isTerminalSale");
    expect(salesExports).toContain("assertLeadTransition");
  });
});

describe("Sales Domain Foundation — forbidden-key policy (mass assignment)", () => {
  it("create-контракт запрещает id/code/status/version/temporal/actor/history/correlation", () => {
    for (const k of ["id", "code", "status", "version", "createdAt", "updatedAt", "createdById", "actorId", "actor", "userId", "username", "history", "requestId", "correlationId", "causationId"]) {
      expect(SALES_CREATE_FORBIDDEN_KEYS).toContain(k);
    }
  });

  it("transition-контракт запрещает все business-поля (только status разрешён)", () => {
    for (const k of ["id", "code", "name", "title", "customerId", "assignedToId", "leadId", "opportunityId", "quoteId", "productId", "version", "createdAt", "actorId"]) {
      expect(SALES_TRANSITION_FORBIDDEN_KEYS).toContain(k);
    }
    expect(SALES_TRANSITION_FORBIDDEN_KEYS).not.toContain("status");
  });
});
