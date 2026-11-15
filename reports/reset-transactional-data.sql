BEGIN;

TRUNCATE TABLE
  "order"."Fulfillment",
  "order"."Order",
  "order"."OrderHistory",
  "order"."OrderItem",
  "order"."OrderTraveler",
  "order"."Request",
  "order"."RequestHistory",
  "order"."RequestService",
  "order"."RequestTraveler",
  "booking"."Booking",
  "booking"."BookingHistory",
  "booking"."Passenger",
  "booking"."Reservation",
  "booking"."SupplierConfirmation",
  "communication"."Communication",
  "communication"."CommunicationThread",
  "documents"."Document",
  "documents"."DocumentHistory",
  "documents"."DocumentVersion",
  "finance"."CancellationApproval",
  "finance"."ClientDebtWriteOff",
  "finance"."Commission",
  "finance"."CommissionAccrual",
  "finance"."Dispute",
  "finance"."DisputeHistory",
  "finance"."Invoice",
  "finance"."LedgerTransaction",
  "finance"."OrderCancellationSupplierTerm",
  "finance"."OrderFinancialAdjustment",
  "finance"."OrderFinancialSettlement",
  "finance"."OrderPaymentSchedule",
  "finance"."Payment",
  "finance"."PaymentHistory",
  "finance"."PaymentWebhookEvent",
  "finance"."Payout",
  "finance"."ProviderFee",
  "finance"."Refund",
  "finance"."RefundHistory",
  "finance"."Settlement",
  "finance"."SupplierDebtWriteOff",
  "finance"."SupplierObligation",
  "finance"."SupplierObligationEvent",
  "finance"."SupplierPaymentEvidence",
  "finance"."SupplierPayout",
  "finance"."SupplierPayoutAllocation",
  "marketing"."CampaignAttribution",
  "marketing"."CampaignAudience",
  "sales"."CheckoutIntent",
  "sales"."CheckoutIntentHistory",
  "sales"."CheckoutIntentTraveler",
  "sales"."Lead",
  "sales"."LeadHistory",
  "sales"."Opportunity",
  "sales"."OpportunityHistory",
  "sales"."Quote",
  "sales"."QuoteHistory",
  "sales"."QuoteItem",
  "sales"."QuoteTraveler",
  "sales"."Sale",
  "sales"."SaleHistory",
  "support"."CaseComment",
  "support"."CaseCommunicationLink",
  "support"."CaseHistory",
  "support"."Case",
  "whatsapp"."WhatsAppAccount",
  "whatsapp"."WhatsAppContact",
  "whatsapp"."WhatsAppConversation",
  "whatsapp"."WhatsAppInboundMessage",
  "whatsapp"."WhatsAppOutboundMessage",
  "whatsapp"."WhatsAppSessionLease",
  "whatsapp"."WhatsAppSuppression"
RESTART IDENTITY CASCADE;

DELETE FROM crm."Contact" WHERE "customerId" IS NOT NULL;
TRUNCATE TABLE
  crm."Customer",
  crm."CustomerHistory",
  crm."PartnerCustomerRelation",
  crm."PartnerCustomerRelationHistory",
  crm."CrmActivity",
  crm."OperationalNote"
RESTART IDENTITY CASCADE;

-- Reset transactional human-readable counters, keeping catalog/pricing config
-- (CMR/MKR/PRD) intact.
UPDATE events."BusinessSequence"
SET value = 0
WHERE prefix IN (
  'BKG', 'CML', 'CUS', 'LTX', 'ORD', 'PAY', 'REQ', 'SBO', 'TH-2026',
  'REFSEQ:REFSEQ:COMMERCE:ROOT'
);

COMMIT;
