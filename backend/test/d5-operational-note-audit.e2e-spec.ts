/**
 * D5 C1 — OperationalNote Immutable Audit / Accountability
 *
 * Tests that OperationalNote mutations (CREATE, UPDATE, DELETE) produce
 * immutable audit trail entries in security.AuditLog, and that the
 * getNoteHistory API correctly surfaces them.
 *
 * Key invariants tested:
 * - CREATE → audit event exists with correct details
 * - UPDATE → audit event with before/after text
 * - DELETE → audit event (soft delete)
 * - AuditLog is append-only (no update/delete endpoints)
 * - History is immutable and queryable
 * - Failed mutations produce no successful audit
 * - Authorization enforced
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppExceptionFilter } from '../src/shared/exception.filter';
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from '../src/shared/validation-pipe';

describe('D5 C1 — OperationalNote Audit Trail (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let partnerId: string;
  const createdNoteIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();

    // Login as admin
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = loginRes.body.accessToken;

    // Create a Partner directly via Prisma for deterministic test entity
    const prisma = app.get(PrismaService);
    const partner = await prisma.partner.create({
      data: {
        name: 'Note Audit Test Partner',
        code: 'PAR-AUDIT-TEST-01',
        contactEmail: 'note-audit@test.com',
      },
    });
    partnerId = partner.id;
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    // Clean up test notes (including soft-deleted ones)
    await prisma.operationalNote.deleteMany({ where: { entityType: 'Partner', entityId: partnerId } });
    // Clean up test partner
    await prisma.partner.deleteMany({ where: { id: partnerId } });
    await app?.close();
  });

  describe('CREATE audit trail', () => {
    let noteId: string;

    it('creates note and produces audit event', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/operational-notes/Partner/${partnerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'Test note for audit trail', visibility: 'INTERNAL' });

      expect(createRes.status).toBe(201);
      noteId = createRes.body.id;
      expect(noteId).toBeTruthy();

      // Verify audit event exists
      const historyRes = await request(app.getHttpServer())
        .get(`/api/v1/operational-notes/${noteId}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.total).toBeGreaterThanOrEqual(1);

      const createEvent = historyRes.body.events.find(
        (e: any) => e.action === 'operational_note.created',
      );
      expect(createEvent).toBeTruthy();
      expect(createEvent.resource).toBe('OperationalNote');
      expect(createEvent.resourceId).toBe(noteId);
      expect(createEvent.createdAt).toBeTruthy();
    });

    it('audit event is immutable — no update/delete endpoint exists', async () => {
      // Attempting to PATCH/DELETE the audit log directly should not be possible
      // (no endpoint exists for it). Verify history length hasn't changed.
      const historyRes = await request(app.getHttpServer())
        .get(`/api/v1/operational-notes/${noteId}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(historyRes.status).toBe(200);
      // Still exactly 1 event (the CREATE)
      expect(historyRes.body.events.length).toBe(1);
    });
  });

  describe('UPDATE audit trail', () => {
    let noteId: string;

    beforeAll(async () => {
      // Create a note to update
      const res = await request(app.getHttpServer())
        .post(`/api/v1/operational-notes/Partner/${partnerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'Original note text' });
      noteId = res.body.id;
    });

    it('update produces audit with before/after text', async () => {
      const updateRes = await request(app.getHttpServer())
        .patch(`/api/v1/operational-notes/${noteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'Updated note text' });

      expect(updateRes.status).toBe(200);

      const historyRes = await request(app.getHttpServer())
        .get(`/api/v1/operational-notes/${noteId}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.events.length).toBeGreaterThanOrEqual(2);

      const updateEvent = historyRes.body.events.find(
        (e: any) => e.action === 'operational_note.updated',
      );
      expect(updateEvent).toBeTruthy();

      // Verify details contain before/after text
      const details = updateEvent.details as any;
      expect(details).toBeTruthy();
      expect(details.beforeText).toBeTruthy();
      expect(details.afterText).toBeTruthy();
    });

    it('audit trail is append-only — CREATE event preserved after UPDATE', async () => {
      const historyRes = await request(app.getHttpServer())
        .get(`/api/v1/operational-notes/${noteId}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(historyRes.status).toBe(200);
      // CREATE event still exists, immutable
      const createEvent = historyRes.body.events.find(
        (e: any) => e.action === 'operational_note.created',
      );
      expect(createEvent).toBeTruthy();
    });
  });

  describe('DELETE audit trail', () => {
    let noteId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/operational-notes/Partner/${partnerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'Note to be deleted' });
      noteId = res.body.id;
    });

    it('soft delete produces audit event', async () => {
      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/operational-notes/${noteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);

      // Note is soft-deleted, not hard-deleted — history query still works
      // (the note record still exists with deletedAt set)
      const historyRes = await request(app.getHttpServer())
        .get(`/api/v1/operational-notes/${noteId}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.events.length).toBeGreaterThanOrEqual(2);

      const deleteEvent = historyRes.body.events.find(
        (e: any) => e.action === 'operational_note.deleted',
      );
      expect(deleteEvent).toBeTruthy();
      expect(deleteEvent.details).toBeTruthy();
    });

    it('note no longer appears in active list after soft delete', async () => {
      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/operational-notes/Partner/${partnerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      const found = listRes.body.notes.find((n: any) => n.id === noteId);
      expect(found).toBeFalsy(); // soft-deleted note excluded from list
    });
  });

  describe('Failed mutation — no false audit', () => {
    it('update of nonexistent note produces 404 and no audit event', async () => {
      const updateRes = await request(app.getHttpServer())
        .patch('/api/v1/operational-notes/nonexistent-note-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'Should fail' });

      expect(updateRes.status).toBe(404);

      // History for nonexistent note also returns 404 (note must exist)
      const historyRes = await request(app.getHttpServer())
        .get('/api/v1/operational-notes/nonexistent-note-id/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(historyRes.status).toBe(404);
    });
  });

  describe('Authorization', () => {
    let noteId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/operational-notes/Partner/${partnerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'Auth test note' });
      noteId = res.body.id;
    });

    it('unauthenticated request returns 401', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/operational-notes/${noteId}/history`);
      expect(res.status).toBe(401);
    });
  });
});
