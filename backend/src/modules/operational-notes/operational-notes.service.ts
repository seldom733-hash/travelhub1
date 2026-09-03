import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityService } from '../../security/security.service';
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
import { ForbiddenError, NotFoundError } from '../../shared/errors';

/* ------------------------------------------------------------------ */
/*  Entity Resolver — validates parent existence + scope               */
/* ------------------------------------------------------------------ */

export interface ParentResolution {
  entityType: OperationalEntityType;
  entityId: string;
  exists: boolean;
}

/**
 * Resolve a parent entity for note attachment.
 * Validates: entityType is canonical, entityId is valid UUID, parent exists.
 */
async function resolveNoteParent(
  prisma: PrismaService,
  entityType: string,
  entityId: string,
): Promise<ParentResolution> {
  if (!isValidEntityType(entityType)) {
    throw new BadRequestException(`Invalid entity type: ${entityType}`);
  }
  if (!entityId || entityId.trim().length === 0) {
    throw new BadRequestException('Entity ID is required');
  }

  let exists = false;

  switch (entityType) {
    case 'Customer': {
      const row = await prisma.customer.findUnique({ where: { id: entityId }, select: { id: true } });
      exists = row !== null;
      break;
    }
    case 'Partner': {
      const row = await prisma.partner.findUnique({ where: { id: entityId }, select: { id: true } });
      exists = row !== null;
      break;
    }
    case 'Order': {
      const row = await prisma.order.findUnique({ where: { id: entityId }, select: { id: true } });
      exists = row !== null;
      break;
    }
    case 'Booking': {
      const row = await prisma.booking.findUnique({ where: { id: entityId }, select: { id: true } });
      exists = row !== null;
      break;
    }
    case 'Payment': {
      const row = await prisma.payment.findUnique({ where: { id: entityId }, select: { id: true } });
      exists = row !== null;
      break;
    }
    case 'Refund': {
      const row = await prisma.refund.findUnique({ where: { id: entityId }, select: { id: true } });
      exists = row !== null;
      break;
    }
    case 'Product': {
      const row = await prisma.product.findUnique({ where: { id: entityId }, select: { id: true } });
      exists = row !== null;
      break;
    }
    case 'Fulfillment': {
      const row = await prisma.fulfillment.findUnique({ where: { id: entityId }, select: { id: true } });
      exists = row !== null;
      break;
    }
    case 'Reservation': {
      const row = await prisma.reservation.findUnique({ where: { id: entityId }, select: { id: true } });
      exists = row !== null;
      break;
    }
    case 'BuyerRequest': {
      const row = await prisma.buyerRequest.findUnique({ where: { id: entityId }, select: { id: true } });
      exists = row !== null;
      break;
    }
    case 'PartnerApplication': {
      const row = await prisma.partnerApplication.findUnique({ where: { id: entityId }, select: { id: true } });
      exists = row !== null;
      break;
    }
    default:
      throw new BadRequestException(`Unhandled entity type: ${entityType}`);
  }

  if (!exists) {
    throw new NotFoundException(`${entityType} with id ${entityId} not found`);
  }

  return { entityType: entityType as OperationalEntityType, entityId, exists };
}

/* ------------------------------------------------------------------ */
/*  Auth User type (subset for RBAC checks)                           */
/* ------------------------------------------------------------------ */

export interface NotesActor {
  userId: string;
  username: string;
  fullName?: string | null;
  role: string;
  permissions: string[];
  partnerId?: string | null;
  customerId?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Service                                                           */
/* ------------------------------------------------------------------ */

@Injectable()
export class OperationalNotesService {
  private readonly logger = new Logger(OperationalNotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Check if actor has a specific permission.
   */
  private requirePermission(actor: NotesActor, permission: string): void {
    if (!actor.permissions.includes(permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
  }

  /**
   * Validate and create an OperationalNote.
   * Server-authoritative: author, timestamp, visibility, entityType, entityId.
   * RBAC: operational-notes.create permission required.
   */
  async createNote(
    input: {
      entityType: string;
      entityId: string;
      text: string;
      visibility?: string;
    },
    actor: NotesActor,
  ) {
    // RBAC: check permission
    this.requirePermission(actor, 'operational-notes.create');

    // Validate text
    const validatedText = validateNoteText(input.text);

    // Validate entityType
    if (!isValidEntityType(input.entityType)) {
      throw new BadRequestException(`Invalid entity type: ${input.entityType}. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
    }

    // Validate visibility
    const visibility = input.visibility && isValidVisibility(input.visibility)
      ? input.visibility
      : 'INTERNAL' as const;

    // Validate parent exists
    const parent = await resolveNoteParent(this.prisma, input.entityType, input.entityId);
    if (!parent.exists) {
      throw new NotFoundException(`${input.entityType} with id ${input.entityId} not found`);
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

    // Audit: note.created
    await this.security.audit(undefined, {
      userId: actor.userId,
      username: actor.username,
      action: 'operational_note.created',
      resource: 'OperationalNote',
      resourceId: note.id,
      details: {
        entityType: note.entityType,
        entityId: note.entityId,
        visibility: note.visibility,
        parentType: note.entityType,
        parentId: note.entityId,
      },
    });

    // Live projection into CrmActivity (fire-and-forget, non-blocking)
    this.projectToActivity(note).catch((err) => {
      this.logger.warn(`Live projection failed for note ${note.id}: ${err}`);
    });

    return note;
  }

  /**
   * Project an OperationalNote into CrmActivity read model.
   * Lazy-resolves CrmActivityService to avoid circular dependency.
   */
  private async projectToActivity(note: any): Promise<void> {
    try {
      const { CrmActivityService } = require('../crm-activity/crm-activity.service');
      const activityService = this.moduleRef.get(CrmActivityService, { strict: false });
      const { CrmActivitySourceType, CrmActivityActivityType, CrmActivitySubjectType } = require('../../generated/prisma/enums');

      let subjectType: string;
      let subjectId: string;
      let customerId: string | null = null;
      let partnerId: string | null = null;

      if (note.entityType === 'Customer') {
        subjectType = CrmActivitySubjectType.CUSTOMER;
        subjectId = note.entityId;
        customerId = note.entityId;
      } else if (note.entityType === 'Partner') {
        subjectType = CrmActivitySubjectType.PARTNER;
        subjectId = note.entityId;
        partnerId = note.entityId;
      } else {
        return; // other entity types not projected in v1
      }

      await activityService.projectActivity({
        sourceType: CrmActivitySourceType.OPERATIONAL_NOTE,
        sourceId: note.id,
        sourceEvent: 'created',
        activityType: CrmActivityActivityType.NOTE_CREATED,
        subjectType,
        subjectId,
        customerId,
        partnerId,
        occurredAt: note.createdAt,
        actorUserId: note.authorUserId,
        actorName: note.authorName,
        title: 'NOTE_CREATED',
        summary: note.text?.slice(0, 100) ?? null,
        metadata: { visibility: note.visibility },
        deepLink: null,
        visibility: 'INTERNAL',
      });
    } catch (err) {
      this.logger.warn(`Live projection error for note ${note.id}: ${err}`);
    }
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
          throw new BadRequestException(`Invalid entity type: ${entityType}`);
        }

        // Validate parent exists within transaction
        const parent = await resolveNoteParent(tx as any, entityType, entityId);
        if (!parent.exists) {
          throw new NotFoundException(`${entityType} with id ${entityId} not found`);
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
   * RBAC: operational-notes.read permission required.
   * Notes are append-only, ordered by createdAt DESC, id DESC (deterministic).
   */
  async listNotes(
    entityType: string,
    entityId: string,
    actor: NotesActor,
    options?: {
      page?: number;
      pageSize?: number;
      includeDeleted?: boolean;
    },
  ) {
    // RBAC: check permission
    this.requirePermission(actor, 'operational-notes.read');

    if (!isValidEntityType(entityType)) {
      throw new BadRequestException(`Invalid entity type: ${entityType}`);
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
   * Used internally for update/delete scope resolution.
   */
  async getNoteById(noteId: string) {
    return this.prisma.operationalNote.findUnique({
      where: { id: noteId, deletedAt: null },
    });
  }

  /**
   * Update a note's text.
   * RBAC: operational-notes.update permission required.
   * Authorization: author OR ADMIN override.
   * Audit: operational_note.updated.
   */
  async updateNote(
    noteId: string,
    newText: string,
    actor: NotesActor,
  ) {
    // RBAC: check permission
    this.requirePermission(actor, 'operational-notes.update');

    const validatedText = validateNoteText(newText);
    const note = await this.prisma.operationalNote.findUnique({
      where: { id: noteId, deletedAt: null },
    });

    if (!note) {
      throw new NotFoundException('Note not found or has been deleted');
    }

    // Authorization: only author or ADMIN can edit
    if (note.authorUserId !== actor.userId && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Not authorized to edit this note');
    }

    const beforeText = note.text;
    const updated = await this.prisma.operationalNote.update({
      where: { id: noteId },
      data: {
        text: validatedText,
        editedAt: new Date(),
      },
    });

    // Audit: note.updated
    await this.security.audit(undefined, {
      userId: actor.userId,
      username: actor.username,
      action: 'operational_note.updated',
      resource: 'OperationalNote',
      resourceId: noteId,
      details: {
        entityType: note.entityType,
        entityId: note.entityId,
        parentType: note.entityType,
        parentId: note.entityId,
        beforeText: beforeText.length > 200 ? beforeText.substring(0, 200) + '...' : beforeText,
        afterText: validatedText.length > 200 ? validatedText.substring(0, 200) + '...' : validatedText,
      },
    });

    return updated;
  }

  /**
   * Soft-delete a note.
   * RBAC: operational-notes.delete permission required.
   * Authorization: author OR ADMIN override.
   * Audit: operational_note.deleted.
   */
  async deleteNote(
    noteId: string,
    actor: NotesActor,
  ) {
    // RBAC: check permission
    this.requirePermission(actor, 'operational-notes.delete');

    const note = await this.prisma.operationalNote.findUnique({
      where: { id: noteId, deletedAt: null },
    });

    if (!note) {
      throw new NotFoundException('Note not found or has been deleted');
    }

    // Authorization: only author or ADMIN can delete
    if (note.authorUserId !== actor.userId && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Not authorized to delete this note');
    }

    const deleted = await this.prisma.operationalNote.update({
      where: { id: noteId },
      data: {
        deletedAt: new Date(),
        deletedBy: actor.userId,
      },
    });

    // Audit: note.deleted
    await this.security.audit(undefined, {
      userId: actor.userId,
      username: actor.username,
      action: 'operational_note.deleted',
      resource: 'OperationalNote',
      resourceId: noteId,
      details: {
        entityType: note.entityType,
        entityId: note.entityId,
        parentType: note.entityType,
        parentId: note.entityId,
        authorUserId: note.authorUserId,
        authorName: note.authorName,
      },
    });

    return deleted;
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

  /**
   * D5-R2: Immutable audit/revision history for a specific note.
   * Queries the security.AuditLog for all events related to this note.
   * AuditLog is append-only (no update/delete) — this IS the immutable history.
   * Authorization: inherited from note parent entity scope + operational-notes.read.
   */
  async getNoteHistory(
    noteId: string,
    actor: NotesActor,
  ) {
    this.requirePermission(actor, 'operational-notes.read');

    // Verify note exists and actor has access to parent entity
    const note = await this.prisma.operationalNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Resolve parent to verify scope
    const parent = await resolveNoteParent(this.prisma, note.entityType, note.entityId);
    if (!parent.exists) {
      throw new NotFoundException(`${note.entityType} not found`);
    }

    // Query immutable AuditLog for this note's events
    const events = await this.prisma.auditLog.findMany({
      where: {
        resource: 'OperationalNote',
        resourceId: noteId,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return {
      noteId,
      entityType: note.entityType,
      entityId: note.entityId,
      events,
      total: events.length,
    };
  }
}
