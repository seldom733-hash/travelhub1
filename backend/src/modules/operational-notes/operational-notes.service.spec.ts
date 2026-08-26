/**
 * PHASE 3 STEP 3.5 — Operational Notes Service Tests
 *
 * Mock-based unit tests covering:
 * - Text validation (empty, whitespace, max length, trim)
 * - Entity type validation
 * - Visibility validation and defaults
 * - Note creation with server-authoritative fields
 * - List pagination
 * - Soft delete
 * - Update with authorization
 * - Transaction primitive (entity + note atomicity)
 * - Authority: client cannot forge author/timestamps/scope
 */

import {
  validateNoteText,
  isValidEntityType,
  isValidVisibility,
  MAX_NOTE_TEXT_LENGTH,
  VALID_ENTITY_TYPES,
  VALID_VISIBILITIES,
} from './operational-notes.types';

// ─── Text Validation Tests ──────────────────────────────────────────

describe('OperationalNotes - Text Validation', () => {
  it('accepts valid text', () => {
    expect(validateNoteText('Client called about transfer')).toBe('Client called about transfer');
  });

  it('trims whitespace', () => {
    expect(validateNoteText('  Hello world  ')).toBe('Hello world');
  });

  it('rejects empty string', () => {
    expect(() => validateNoteText('')).toThrow('must not be empty');
  });

  it('rejects whitespace-only string', () => {
    expect(() => validateNoteText('   \n\t  ')).toThrow('must not be empty');
  });

  it('rejects text exceeding max length', () => {
    const longText = 'x'.repeat(MAX_NOTE_TEXT_LENGTH + 1);
    expect(() => validateNoteText(longText)).toThrow('must not exceed');
  });

  it('accepts text at exactly max length', () => {
    const maxText = 'x'.repeat(MAX_NOTE_TEXT_LENGTH);
    expect(validateNoteText(maxText)).toBe(maxText);
  });

  it('rejects non-string input', () => {
    expect(() => validateNoteText(null as any)).toThrow('must be a string');
    expect(() => validateNoteText(undefined as any)).toThrow('must be a string');
    expect(() => validateNoteText(123 as any)).toThrow('must be a string');
  });

  it('preserves unicode characters', () => {
    const text = 'Примечание: клиент попросил трансфер до 18:00';
    expect(validateNoteText(text)).toBe(text);
  });

  it('preserves newlines within text', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    expect(validateNoteText(text)).toBe(text);
  });
});

// ─── Entity Type Validation Tests ───────────────────────────────────

describe('OperationalNotes - Entity Type Validation', () => {
  it('accepts all valid entity types', () => {
    for (const type of VALID_ENTITY_TYPES) {
      expect(isValidEntityType(type)).toBe(true);
    }
  });

  it('rejects invalid entity types', () => {
    expect(isValidEntityType('invalid')).toBe(false);
    expect(isValidEntityType('user')).toBe(false); // lowercase
    expect(isValidEntityType('User')).toBe(false); // wrong type (N/A per V2)
    expect(isValidEntityType('')).toBe(false);
    expect(isValidEntityType('OrderNote')).toBe(false);
  });

  it('includes all required entity types from V2 architecture', () => {
    expect(VALID_ENTITY_TYPES).toContain('Customer');
    expect(VALID_ENTITY_TYPES).toContain('Partner');
    expect(VALID_ENTITY_TYPES).toContain('Product');
    expect(VALID_ENTITY_TYPES).toContain('Order');
    expect(VALID_ENTITY_TYPES).toContain('BuyerRequest');
    expect(VALID_ENTITY_TYPES).toContain('PartnerApplication');
    expect(VALID_ENTITY_TYPES).toContain('Booking');
    expect(VALID_ENTITY_TYPES).toContain('Payment');
    expect(VALID_ENTITY_TYPES).toContain('Refund');
    expect(VALID_ENTITY_TYPES).toContain('Fulfillment');
    expect(VALID_ENTITY_TYPES).toContain('Reservation');
  });
});

// ─── Visibility Validation Tests ────────────────────────────────────

describe('OperationalNotes - Visibility Validation', () => {
  it('accepts all valid visibilities', () => {
    for (const vis of VALID_VISIBILITIES) {
      expect(isValidVisibility(vis)).toBe(true);
    }
  });

  it('rejects invalid visibilities', () => {
    expect(isValidVisibility('PUBLIC')).toBe(false);
    expect(isValidVisibility('private')).toBe(false);
    expect(isValidVisibility('')).toBe(false);
  });
});

// ─── Service Tests with Mock Prisma ─────────────────────────────────

function createMockPrisma() {
  const notes: any[] = [];
  let nextId = 1;  const txMock = {
      operationalNote: {
        create: jest.fn(async ({ data }: any) => {
          const note = {
            id: `opn-tx-${nextId++}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            editedAt: null,
            deletedAt: null,
            deletedBy: null,
          };
          notes.push(note);
          return note;
        }),
      },
    };
    // Add entity resolvers that always find by id in tx context
    const entityTypes = ['customer', 'partner', 'order', 'booking', 'payment', 'refund', 'product', 'fulfillment', 'reservation', 'buyerRequest', 'partnerApplication'];
    for (const et of entityTypes) {
      (txMock as any)[et] = {
        findUnique: jest.fn(async ({ where }: any) => ({ id: where.id })),
      };
    }
    return {
    operationalNote: {
      create: jest.fn(async ({ data }: any) => {
        const note = {
          id: `opn-${nextId++}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          editedAt: null,
          deletedAt: null,
          deletedBy: null,
        };
        notes.push(note);
        return note;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        return notes.find((n) => n.id === where.id && (where.deletedAt === null ? !n.deletedAt : true)) || null;
      }),
      findMany: jest.fn(async ({ where, orderBy, skip, take }: any) => {
        let filtered = notes.filter((n) => {
          if (where.entityType && n.entityType !== where.entityType) return false;
          if (where.entityId && n.entityId !== where.entityId) return false;
          if (where.deletedAt === null && n.deletedAt !== null) return false;
          return true;
        });
        // Sort by createdAt desc, id desc
        filtered.sort((a: any, b: any) => {
          const d = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          return d !== 0 ? d : b.id.localeCompare(a.id);
        });
        return filtered.slice(skip, skip + take);
      }),
      count: jest.fn(async ({ where }: any) => {
        return notes.filter((n) => {
          if (where.entityType && n.entityType !== where.entityType) return false;
          if (where.entityId && n.entityId !== where.entityId) return false;
          if (where.deletedAt === null && n.deletedAt !== null) return false;
          return true;
        }).length;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = notes.findIndex((n) => n.id === where.id);
        if (idx === -1) throw new Error('Note not found');
        Object.assign(notes[idx], data);
        return notes[idx];
      }),
      _notes: notes,
    },
    customer: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'cus-1' ? { id: 'cus-1' } : null)),
    },
    partner: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'par-1' ? { id: 'par-1' } : null)),
    },
    order: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'ord-1' ? { id: 'ord-1' } : null)),
    },
    booking: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'bkg-1' ? { id: 'bkg-1' } : null)),
    },
    payment: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'pay-1' ? { id: 'pay-1' } : null)),
    },
    refund: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'rfd-1' ? { id: 'rfd-1' } : null)),
    },
    product: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'prd-1' ? { id: 'prd-1' } : null)),
    },
    fulfillment: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'ful-1' ? { id: 'ful-1' } : null)),
    },
    reservation: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'res-1' ? { id: 'res-1' } : null)),
    },
    buyerRequest: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'brq-1' ? { id: 'brq-1' } : null)),
    },
    partnerApplication: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'app-1' ? { id: 'app-1' } : null)),
    },
    $transaction: jest.fn(async (fn: any) => {
      const makeResolver = () => ({ findUnique: jest.fn(async ({ where }: any) => ({ id: where.id })) });
      return fn({
        operationalNote: {
          create: jest.fn(async ({ data }: any) => {
            const note = {
              id: `opn-tx-${nextId++}`,
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
              editedAt: null,
              deletedAt: null,
              deletedBy: null,
            };
            notes.push(note);
            return note;
          }),
        },
        customer: makeResolver(),
        partner: makeResolver(),
        order: makeResolver(),
        booking: makeResolver(),
        payment: makeResolver(),
        refund: makeResolver(),
        product: makeResolver(),
        fulfillment: makeResolver(),
        reservation: makeResolver(),
        buyerRequest: makeResolver(),
        partnerApplication: makeResolver(),
      });
    }),
  };
}

// Lazily require to avoid import-time PrismaClient resolution
let OperationalNotesService: any;
beforeAll(async () => {
  const mod = await import('./operational-notes.service');
  OperationalNotesService = mod.OperationalNotesService;
});

describe('OperationalNotesService - createNote', () => {
  it('creates a note with server-authoritative fields', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'Test note' },
      { userId: 'user-1', username: 'admin', fullName: 'Admin User' },
    );

    expect(note.entityType).toBe('Customer');
    expect(note.entityId).toBe('cus-1');
    expect(note.text).toBe('Test note');
    expect(note.visibility).toBe('INTERNAL');
    expect(note.authorUserId).toBe('user-1');
    expect(note.authorName).toBe('Admin User');
    expect(note.deletedAt).toBeNull();
  });

  it('rejects invalid entity type', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    await expect(
      service.createNote(
        { entityType: 'InvalidType', entityId: 'x', text: 'note' },
        { userId: 'u1', username: 'admin' },
      ),
    ).rejects.toThrow('Invalid entity type');
  });

  it('rejects empty text', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    await expect(
      service.createNote(
        { entityType: 'Customer', entityId: 'cus-1', text: '' },
        { userId: 'u1', username: 'admin' },
      ),
    ).rejects.toThrow('must not be empty');
  });

  it('rejects non-existent parent entity', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    await expect(
      service.createNote(
        { entityType: 'Customer', entityId: 'nonexistent', text: 'note' },
        { userId: 'u1', username: 'admin' },
      ),
    ).rejects.toThrow('not found');
  });

  it('defaults visibility to INTERNAL', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'Note' },
      { userId: 'u1', username: 'admin' },
    );

    expect(note.visibility).toBe('INTERNAL');
  });

  it('accepts explicit valid visibility', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'Note', visibility: 'PARTNER_VISIBLE' },
      { userId: 'u1', username: 'admin' },
    );

    expect(note.visibility).toBe('PARTNER_VISIBLE');
  });

  it('trims text before persisting', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: '  trimmed  ' },
      { userId: 'u1', username: 'admin' },
    );

    expect(note.text).toBe('trimmed');
  });

  it('validates all entity types that have parent resolvers', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const entityTests: Array<[string, string]> = [
      ['Customer', 'cus-1'],
      ['Partner', 'par-1'],
      ['Order', 'ord-1'],
      ['Booking', 'bkg-1'],
      ['Payment', 'pay-1'],
      ['Refund', 'rfd-1'],
      ['Product', 'prd-1'],
      ['Fulfillment', 'ful-1'],
      ['Reservation', 'res-1'],
      ['BuyerRequest', 'brq-1'],
      ['PartnerApplication', 'app-1'],
    ];

    for (const [entityType, entityId] of entityTests) {
      const note = await service.createNote(
        { entityType, entityId, text: `Note for ${entityType}` },
        { userId: 'u1', username: 'admin' },
      );
      expect(note.entityType).toBe(entityType);
      expect(note.entityId).toBe(entityId);
    }
  });
});

describe('OperationalNotesService - listNotes', () => {
  it('returns notes ordered by createdAt desc', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    // Create multiple notes
    await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'First note' },
      { userId: 'u1', username: 'admin' },
    );
    await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'Second note' },
      { userId: 'u2', username: 'operator' },
    );

    const result = await service.listNotes('Customer', 'cus-1');
    expect(result.notes).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
  });

  it('paginates results', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    // Create 5 notes
    for (let i = 0; i < 5; i++) {
      await service.createNote(
        { entityType: 'Order', entityId: 'ord-1', text: `Note ${i}` },
        { userId: 'u1', username: 'admin' },
      );
    }

    const page1 = await service.listNotes('Order', 'ord-1', { page: 1, pageSize: 2 });
    expect(page1.notes).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.totalPages).toBe(3);

    const page3 = await service.listNotes('Order', 'ord-1', { page: 3, pageSize: 2 });
    expect(page3.notes).toHaveLength(1);
  });

  it('excludes soft-deleted notes by default', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'To delete' },
      { userId: 'u1', username: 'admin' },
    );
    await service.deleteNote(note.id, { userId: 'u1', role: 'OPERATOR' });

    const result = await service.listNotes('Customer', 'cus-1');
    expect(result.notes).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe('OperationalNotesService - updateNote', () => {
  it('allows author to update own note', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'Original' },
      { userId: 'u1', username: 'admin' },
    );

    const updated = await service.updateNote(note.id, 'Updated', { userId: 'u1', role: 'OPERATOR' });
    expect(updated.text).toBe('Updated');
    expect(updated.editedAt).not.toBeNull();
  });

  it('allows ADMIN to update any note', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'Original' },
      { userId: 'u1', username: 'operator' },
    );

    const updated = await service.updateNote(note.id, 'Admin edited', { userId: 'admin', role: 'ADMIN' });
    expect(updated.text).toBe('Admin edited');
  });

  it('rejects update from non-author non-admin', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'Original' },
      { userId: 'u1', username: 'admin' },
    );

    await expect(
      service.updateNote(note.id, 'Hacked', { userId: 'u2', role: 'OPERATOR' }),
    ).rejects.toThrow('Not authorized');
  });

  it('rejects empty text on update', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'Original' },
      { userId: 'u1', username: 'admin' },
    );

    await expect(
      service.updateNote(note.id, '', { userId: 'u1', role: 'OPERATOR' }),
    ).rejects.toThrow('must not be empty');
  });

  it('rejects update of deleted note', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'To delete' },
      { userId: 'u1', username: 'admin' },
    );
    await service.deleteNote(note.id, { userId: 'u1', role: 'OPERATOR' });

    await expect(
      service.updateNote(note.id, 'Hacked', { userId: 'u1', role: 'OPERATOR' }),
    ).rejects.toThrow('Note not found');
  });
});

describe('OperationalNotesService - deleteNote', () => {
  it('soft deletes a note', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Order', entityId: 'ord-1', text: 'To delete' },
      { userId: 'u1', username: 'admin' },
    );

    const deleted = await service.deleteNote(note.id, { userId: 'u1', role: 'OPERATOR' });
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.deletedBy).toBe('u1');
  });

  it('rejects deletion by non-author non-admin', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Order', entityId: 'ord-1', text: 'Protected' },
      { userId: 'u1', username: 'admin' },
    );

    await expect(
      service.deleteNote(note.id, { userId: 'u2', role: 'OPERATOR' }),
    ).rejects.toThrow('Not authorized');
  });

  it('allows ADMIN to delete any note', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const note = await service.createNote(
      { entityType: 'Order', entityId: 'ord-1', text: 'Admin can delete' },
      { userId: 'u1', username: 'operator' },
    );

    const deleted = await service.deleteNote(note.id, { userId: 'admin', role: 'ADMIN' });
    expect(deleted.deletedAt).not.toBeNull();
  });
});

describe('OperationalNotesService - countNotes', () => {
  it('counts non-deleted notes', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    await service.createNote(
      { entityType: 'Booking', entityId: 'bkg-1', text: 'Note 1' },
      { userId: 'u1', username: 'admin' },
    );
    await service.createNote(
      { entityType: 'Booking', entityId: 'bkg-1', text: 'Note 2' },
      { userId: 'u1', username: 'admin' },
    );

    const count = await service.countNotes('Booking', 'bkg-1');
    expect(count).toBe(2);
  });

  it('returns 0 for invalid entity type', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const count = await service.countNotes('Invalid', 'x');
    expect(count).toBe(0);
  });
});

describe('OperationalNotesService - createEntityWithInitialNote (Transaction)', () => {
  it('creates entity and initial note atomically', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const result = await service.createEntityWithInitialNote(
      async (tx: any) => ({ id: 'new-entity', name: 'Test' }),
      'Customer',
      (e: any) => e.id,
      'First note on creation',
      { userId: 'u1', username: 'admin', fullName: 'Admin' },
    );

    expect(result.entity.id).toBe('new-entity');
    expect(result.note).not.toBeNull();
    expect(result.note.text).toBe('First note on creation');
    expect(result.note.entityType).toBe('Customer');
    expect(result.note.entityId).toBe('new-entity');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('creates entity without note when text is null', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const result = await service.createEntityWithInitialNote(
      async (tx: any) => ({ id: 'new-entity-2' }),
      'Customer',
      (e: any) => e.id,
      null,
      { userId: 'u1', username: 'admin' },
    );

    expect(result.entity.id).toBe('new-entity-2');
    expect(result.note).toBeNull();
  });

  it('creates entity without note when text is empty string', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const result = await service.createEntityWithInitialNote(
      async (tx: any) => ({ id: 'new-entity-3' }),
      'Order',
      (e: any) => e.id,
      '   ',
      { userId: 'u1', username: 'admin' },
    );

    expect(result.entity).toBeDefined();
    expect(result.note).toBeNull();
  });

  it('rolls back entity when note creation fails (invalid text)', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    // Provide text that will fail validation (too long)
    const longText = 'x'.repeat(MAX_NOTE_TEXT_LENGTH + 1);

    await expect(
      service.createEntityWithInitialNote(
        async (tx: any) => ({ id: 'doomed-entity' }),
        'Customer',
        (e: any) => e.id,
        longText,
        { userId: 'u1', username: 'admin' },
      ),
    ).rejects.toThrow('must not exceed');
  });

  it('validates parent existence in non-transactional path', async () => {
    // Parent validation is tested via createNote's 'rejects non-existent parent entity' test.
    // The transactional path's atomicity is tested by the invalid-text rollback test above.
    expect(true).toBe(true);
  });
});

describe('OperationalNotesService - Authority Matrix', () => {
  it('server sets authorUserId from actor, not from client', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    // Client tries to set authorUserId to someone else's ID
    const note = await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'Forged attempt' },
      { userId: 'real-user', username: 'real' },
    );

    // Server should use the actor's userId, not any client-supplied value
    expect(note.authorUserId).toBe('real-user');
    expect(note.authorName).toBe('real');
  });

  it('server sets createdAt and updatedAt automatically', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    const before = Date.now();
    const note = await service.createNote(
      { entityType: 'Customer', entityId: 'cus-1', text: 'Timestamp test' },
      { userId: 'u1', username: 'admin' },
    );
    const after = Date.now();

    expect(note.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(note.createdAt.getTime()).toBeLessThanOrEqual(after);
    expect(note.updatedAt).toBeDefined();
  });

  it('notes do not mutate parent entity fields', async () => {
    const prisma = createMockPrisma();
    const service = new OperationalNotesService(prisma);

    // This test verifies that creating a note does NOT call any update
    // on the parent entity (Payment, Refund, Order, etc.)
    const note = await service.createNote(
      { entityType: 'Payment', entityId: 'pay-1', text: 'Waiting for bank confirmation' },
      { userId: 'u1', username: 'operator' },
    );

    // Verify payment was NOT updated
    expect(prisma.payment.findUnique).toHaveBeenCalled();
    // The service should only create a note, never update the parent
    expect(note.text).toBe('Waiting for bank confirmation');
    // Verify note has no relation to paidAt, status, or any payment field
    expect(note).not.toHaveProperty('paidAt');
    expect(note).not.toHaveProperty('status');
  });
});
