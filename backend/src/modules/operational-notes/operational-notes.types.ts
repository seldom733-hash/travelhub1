/**
 * PHASE 3 STEP 3.5 — Operational Notes — Types & Constants
 *
 * Canonical entity types for polymorphic reference (entityType).
 * Server-controlled: never arbitrary free text.
 */
export const VALID_ENTITY_TYPES = [
  'Customer',
  'Partner',
  'Order',
  'Booking',
  'Payment',
  'Refund',
  'Product',
  'Fulfillment',
  'Reservation',
  'BuyerRequest',
  'PartnerApplication',
] as const;

export type OperationalEntityType = (typeof VALID_ENTITY_TYPES)[number];

export const VALID_VISIBILITIES = ['INTERNAL', 'PARTNER_VISIBLE', 'CUSTOMER_VISIBLE'] as const;
export type OperationalNoteVisibility = (typeof VALID_VISIBILITIES)[number];

export const DEFAULT_VISIBILITY: OperationalNoteVisibility = 'INTERNAL';

export const MAX_NOTE_TEXT_LENGTH = 5000;
export const MIN_NOTE_TEXT_LENGTH = 1;

export interface CreateOperationalNoteInput {
  entityType: string;
  entityId: string;
  text: string;
  visibility?: string;
  authorUserId?: string;
  authorName?: string;
}

export interface OperationalNoteRecord {
  id: string;
  entityType: string;
  entityId: string;
  text: string;
  visibility: string;
  authorUserId: string | null;
  authorName: string | null;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
}

/**
 * Validate entityType against canonical allowed values.
 */
export function isValidEntityType(value: string): value is OperationalEntityType {
  return (VALID_ENTITY_TYPES as readonly string[]).includes(value);
}

/**
 * Validate visibility against canonical allowed values.
 */
export function isValidVisibility(value: string): value is OperationalNoteVisibility {
  return (VALID_VISIBILITIES as readonly string[]).includes(value);
}

/**
 * Validate and trim note text. Returns trimmed text or throws on invalid.
 */
export function validateNoteText(text: string): string {
  if (typeof text !== 'string') {
    throw new Error('Note text must be a string');
  }
  const trimmed = text.trim();
  if (trimmed.length < MIN_NOTE_TEXT_LENGTH) {
    throw new Error('Note text must not be empty or whitespace only');
  }
  if (trimmed.length > MAX_NOTE_TEXT_LENGTH) {
    throw new Error(`Note text must not exceed ${MAX_NOTE_TEXT_LENGTH} characters`);
  }
  return trimmed;
}
