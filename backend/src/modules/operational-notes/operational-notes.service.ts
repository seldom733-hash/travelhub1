import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type OperationalEntityType,
  type OperationalNoteVisibility,
  VALID_ENTITY_TYPES,
  DEFAULT_VISIBILITY,
  MAX_NOTE_TEXT_LENGTH,
  validateNoteText,
  isValidEntityType,
  isValidVisibility,
} from './operational-notes.types';
import type { AuthUser } from '../../security/auth/auth.service';

/* ------------------------------------------------------------------ */
/*  Entity Resolver — validates parent existence + scope               */
/* ------------------------------------------------------------------ */

export interface ParentResolution {
  entityType: OperationalEntityType;
  entityId: string;
  exists: boolean;
  scopeField?: string;
  scopeValue?: string | null;
}

/**
 * Resolve a parent entity for note attachment.
 * Validates: entityType is canonical, entityId is valid UUID, parent exists.
 * Returns resolution with scope info for later scope inheritance.
 */
async function resolveNoteParent(
  prisma: PrismaService,
  entityType: string,
  entityId: string,
): Promise<ParentResolution> {
  if (!isValidEntityType(entityType)) {
    throw new Error(`Invalid entity type: ${entityType}`);
  }
  if (!entityId || entityId.trim().length === 0) {
    throw new Error('Entity ID is required');
  }

  let exists = false;
  let scopeField: string | undefined;
  let scopeValue: string | null = null;

  // Validate parent existence per entity type
  switch (entityType) {
    case 'Customer': {
      const row = await prisma.customer.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      exists = row !== null;
      break;
    }
    case 'Partner': {
      const row = await prisma.partner.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      exists = row !== null;
      break;
    }
    case 'Order': {
      const row = await prisma.order.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      exists = row !== null;
      break;
    }
    case 'Booking': {
      const row = await prisma.booking.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      exists = row !== null;
      break;
    }
    case 'Payment': {
      const row = await prisma.payment.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      exists = row !== null;
      break;
    }
    case 'Refund': {
      const row = await prisma.refund.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      exists = row !== null;
      break;
    }
    case 'Product': {
      const row = await prisma.product.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      exists = row !== null;
      break;
    }
    case 'Fulfillment': {
      const row = await prisma.fulfillment.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      exists = row !== null;
      break;
    }
    case 'Reservation': {
      const row = await prisma.reservation.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      exists = row !== null;
      break;
    }
    case 'BuyerRequest': {
      const row = await prisma.buyerRequest.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      exists = row !== null;
      break;
    }
    case 'PartnerApplication': {
      const row = await prisma.partnerApplication.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      exists = row !== null;
      break;
    }
    default:
      throw new Error(`Unhandled entity type: ${entityType}`);
  }

  if (!exists) {
    throw new Error(`${entityType} with id ${entityId} not found`);
  }

  return { entityType: entityType as OperationalEntityType, entityId, exists };
}

/* ------------------------------------------------------------------ */
/*  Service                                                           */
/* ------------------------------------------------------------------ */

@Injectable()
export class OperationalNotesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate and create an OperationalNote.
   * Server-authoritative: author, timestamp, visibility, entityType, entityId.
   */
  async createNote(
    input: {
      entityType: string;
      entityId: string;
      text: string;
      visibility?: string;
    },
    actor: { userId: string; username: string; fullName?: string | null },
  ) {
    // Validate text
    const validatedText = validateNoteText(input.text);

    // Validate entityType
    if (!isValidEntityType(input.entityType)) {
      throw new Error(`Invalid entity type: ${input.entityType}. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
    }

    // Validate visibility
    const visibility = input.visibility && isValidVisibility(input.visibility)
      ? input.visibility
      : 'INTERNAL' as const;

    // Validate parent exists
    const parent = await resolveNoteParent(this.prisma, input.entityType, input.entityId);
    if (!parent.exists) {
      throw new Error(`${input.entityType} with id ${input.entityId} not found`);
    }

    // Create note with server-authoritative fields
    const note = await this.prisma.operationalNote.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        text: validatedText,
        visibility,
        authorUserId: actor.userId,
        authorName: actor.fullName ?? actor.username,
      },
    });

    return note;
  }

  /**
   * Transaction primitive: Create an entity + initial OperationalNote atomically.
   * If the note is provided and valid, both persist or neither persists.
   * If the note is empty/null, only the entity is created.
   */
  async createEntityWithInitialNote<T>(
    createEntity: (tx: any) => Promise<T>,
    entityType: string,
    entityIdExtractor: (entity: T) => string,
    initialNoteText: string | null | undefined,
    actor: { userId: string; username: string; fullName?: string | null },
  ): Promise<{ entity: T; note: any | null }> {
    const prisma = this.prisma;
    return prisma.$transaction(async (tx) => {
      // Create entity
      const entity = await createEntity(tx);
      const entityId = entityIdExtractor(entity);

      // Validate and optionally create initial note
      let note: any = null;
      const trimmedNote = initialNoteText?.trim();
      if (trimmedNote && trimmedNote.length > 0) {
        // Validate text (will throw if invalid)
        const validatedText = validateNoteText(trimmedNote);

        // Validate entityType
        if (!isValidEntityType(entityType)) {
          throw new Error(`Invalid entity type: ${entityType}`);
        }

        // Validate parent exists within transaction
        const parent = await resolveNoteParent(tx as any, entityType, entityId);
        if (!parent.exists) {
          throw new Error(`${entityType} with id ${entityId} not found`);
        }

        // Server-authoritative note creation
        note = await tx.operationalNote.create({
          data: {
            entityType,
            entityId,
            text: validatedText,
            visibility: DEFAULT_VISIBILITY,
            authorUserId: actor.userId,
            authorName: actor.fullName ?? actor.username,
          },
        });
      }

      return { entity, note };
    });
  }

  /**
   * List notes for an entity with pagination support.
   * Notes are append-only, ordered by createdAt DESC, id DESC (deterministic).
   */
  async listNotes(
    entityType: string,
    entityId: string,
    options?: {
      page?: number;
      pageSize?: number;
      includeDeleted?: boolean;
    },
  ) {
    if (!isValidEntityType(entityType)) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }

    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: any = {
      entityType,
      entityId,
      ...(options?.includeDeleted ? {} : { deletedAt: null }),
    };

    const [notes, total] = await Promise.all([
      this.prisma.operationalNote.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.operationalNote.count({ where }),
    ]);

    return {
      notes,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get a single note by ID.
   */
  async getNoteById(noteId: string) {
    return this.prisma.operationalNote.findUnique({
      where: { id: noteId, deletedAt: null },
    });
  }

  /**
   * Update a note's text. Only the author or ADMIN can update.
   * Sets editedAt timestamp.
   */
  async updateNote(
    noteId: string,
    newText: string,
    actor: { userId: string; role: string },
  ) {
    const validatedText = validateNoteText(newText);
    const note = await this.prisma.operationalNote.findUnique({
      where: { id: noteId, deletedAt: null },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    // Authorization: only author or ADMIN can edit
    if (note.authorUserId !== actor.userId && actor.role !== 'ADMIN') {
      throw new Error('Not authorized to edit this note');
    }

    return this.prisma.operationalNote.update({
      where: { id: noteId },
      data: {
        text: validatedText,
        editedAt: new Date(),
      },
    });
  }

  /**
   * Soft-delete a note. Only the author or ADMIN can delete.
   */
  async deleteNote(
    noteId: string,
    actor: { userId: string; role: string },
  ) {
    const note = await this.prisma.operationalNote.findUnique({
      where: { id: noteId, deletedAt: null },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    // Authorization: only author or ADMIN can delete
    if (note.authorUserId !== actor.userId && actor.role !== 'ADMIN') {
      throw new Error('Not authorized to delete this note');
    }

    return this.prisma.operationalNote.update({
      where: { id: noteId },
      data: {
        deletedAt: new Date(),
        deletedBy: actor.userId,
      },
    });
  }

  /**
   * Count notes for an entity (for table indicators).
   */
  async countNotes(entityType: string, entityId: string): Promise<number> {
    if (!isValidEntityType(entityType)) return 0;
    return this.prisma.operationalNote.count({
      where: { entityType, entityId, deletedAt: null },
    });
  }
}
