/**
 * D5 R3-2 — OperationalNote Audit Failure Injection (e2e)
 *
 * Tests that if security.audit() throws INSIDE the $transaction,
 * the ENTIRE transaction rolls back — neither the note mutation
 * nor the audit event is persisted.
 *
 * This is NOT a theoretical guarantee — it is executed rollback evidence.
 *
 * FI-1: CREATE audit failure → note must NOT exist
 * FI-2: UPDATE audit failure → previous note value MUST remain
 * FI-3: DELETE audit failure → note MUST remain active
 * FI-4: Business mutation failure → no successful audit event
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SecurityService } from '../src/security/security.service';
import { AppExceptionFilter } from '../src/shared/exception.filter';
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from '../src/shared/validation-pipe';
import type { Prisma } from '../src/generated/prisma/client';

/**
 * Mock SecurityService that throws on audit() calls.
 * All other methods delegate to the real SecurityService
 * (authentication, authorization, user management).
 */
class ThrowingAuditSecurityService extends SecurityService {
  private throwOnAudit = false;

  enableThrow() {
    this.throwOnAudit = true;
  }

  disableThrow() {
    this.throwOnAudit = false;
  }

  override async audit(
    tx: Prisma.TransactionClient | undefined,
    entry: Parameters<SecurityService['audit']>[1],
  ): Promise<void> {
    if (this.throwOnAudit) {
      throw new Error('INJECTED AUDIT FAILURE — forced by test to verify $transaction rollback');
    }
    return super.audit(tx, entry);
  }
}

describe('D5 R3-2 — OperationalNote Audit Failure Injection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockSecurity: ThrowingAuditSecurityService;
  let adminToken: string;
  let partnerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SecurityService)
      .useClass(ThrowingAuditSecurityService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    mockSecurity = moduleFixture.get<ThrowingAuditSecurityService>(SecurityService);

    // Login as admin (uses real auth, not affected by audit mock)
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = loginRes.body.accessToken;

    // Create a Partner for note parent entity
    const partner = await prisma.partner.create({
      data: {
        name: 'FI Test Partner',
        code: 'PAR-FI-TEST-01',
        contactEmail: 'fi-test@test.com',
      },
    });
    partnerId = partner.id;
  });

  afterAll(async () => {
    // Cleanup: remove test partner
    await prisma.partner.delete({ where: { id: partnerId } }).catch(() => {});
    await app?.close();
  });

  // ── FI-1: CREATE with audit failure → note must NOT exist ──
  it('FI-1: CREATE note with audit failure → transaction rollback, note does NOT exist', async () => {
    const beforeNoteCount = await prisma.operationalNote.count({
      where: { entityType: 'Partner', entityId: partnerId },
    });
    const beforeAuditCount = await prisma.auditLog.count({
      where: { resource: 'OperationalNote' },
    });

    // Enable audit failure injection
    mockSecurity.enableThrow();

    // Attempt CREATE — should fail because audit() throws inside $transaction
    const res = await request(app.getHttpServer())
      .post(`/api/v1/operational-notes/Partner/${partnerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'This note should NOT be created' });

    // Request should fail (500 from injected error)
    expect(res.status).toBeGreaterThanOrEqual(400);

    // Disable throw for subsequent tests
    mockSecurity.disableThrow();

    // CRITICAL: note must NOT exist — $transaction rolled back
    const afterNoteCount = await prisma.operationalNote.count({
      where: { entityType: 'Partner', entityId: partnerId },
    });
    expect(afterNoteCount).toBe(beforeNoteCount);

    // CRITICAL: no successful CREATE audit event
    const afterAuditCount = await prisma.auditLog.count({
      where: { resource: 'OperationalNote' },
    });
    expect(afterAuditCount).toBe(beforeAuditCount);
  });

  // ── FI-2: UPDATE with audit failure → previous value MUST remain ──
  it('FI-2: UPDATE note with audit failure → transaction rollback, previous text preserved', async () => {
    // Seed a note first (with audit working)
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/operational-notes/Partner/${partnerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'BEFORE UPDATE VALUE' });
    expect(createRes.status).toBe(201);
    const noteId = createRes.body.id;

    const beforeAuditCount = await prisma.auditLog.count({
      where: { resource: 'OperationalNote', resourceId: noteId },
    });

    // Enable audit failure injection
    mockSecurity.enableThrow();

    // Attempt UPDATE — should fail
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/operational-notes/${noteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'AFTER UPDATE VALUE — SHOULD NOT PERSIST' });

    expect(res.status).toBeGreaterThanOrEqual(400);

    mockSecurity.disableThrow();

    // CRITICAL: note text must remain "BEFORE UPDATE VALUE"
    const note = await prisma.operationalNote.findUnique({ where: { id: noteId } });
    expect(note).toBeTruthy();
    expect(note!.text).toBe('BEFORE UPDATE VALUE');

    // CRITICAL: no successful UPDATE audit event
    const afterAuditCount = await prisma.auditLog.count({
      where: { resource: 'OperationalNote', resourceId: noteId },
    });
    expect(afterAuditCount).toBe(beforeAuditCount);

    // Cleanup
    await prisma.operationalNote.delete({ where: { id: noteId } }).catch(() => {});
  });

  // ── FI-3: DELETE with audit failure → note MUST remain active ──
  it('FI-3: DELETE note with audit failure → transaction rollback, note remains active', async () => {
    // Seed a note
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/operational-notes/Partner/${partnerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Note to attempt delete with failure' });
    expect(createRes.status).toBe(201);
    const noteId = createRes.body.id;

    const beforeAuditCount = await prisma.auditLog.count({
      where: { resource: 'OperationalNote', resourceId: noteId },
    });

    // Enable audit failure injection
    mockSecurity.enableThrow();

    // Attempt DELETE — should fail
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/operational-notes/${noteId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBeGreaterThanOrEqual(400);

    mockSecurity.disableThrow();

    // CRITICAL: note must remain active (deletedAt is null)
    const note = await prisma.operationalNote.findUnique({ where: { id: noteId } });
    expect(note).toBeTruthy();
    expect(note!.deletedAt).toBeNull();

    // CRITICAL: no successful DELETE audit event
    const afterAuditCount = await prisma.auditLog.count({
      where: { resource: 'OperationalNote', resourceId: noteId },
    });
    expect(afterAuditCount).toBe(beforeAuditCount);

    // Cleanup
    await prisma.operationalNote.delete({ where: { id: noteId } }).catch(() => {});
  });

  // ── FI-4: Business mutation failure → no successful audit ──
  it('FI-4: business mutation failure (nonexistent note) → no successful audit event', async () => {
    const beforeAuditCount = await prisma.auditLog.count({
      where: { resource: 'OperationalNote', resourceId: 'nonexistent-id-fi4' },
    });

    // Attempt UPDATE of nonexistent note → 404 (business failure)
    const res = await request(app.getHttpServer())
      .patch('/api/v1/operational-notes/nonexistent-id-fi4')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Should fail' });
    expect(res.status).toBe(404);

    // CRITICAL: no audit event for nonexistent resource
    const afterAuditCount = await prisma.auditLog.count({
      where: { resource: 'OperationalNote', resourceId: 'nonexistent-id-fi4' },
    });
    expect(afterAuditCount).toBe(beforeAuditCount);
  });

  // ── Positive invariant: when audit succeeds, note + audit co-exist ──
  it('positive invariant: successful CREATE → note + audit both exist atomically', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/operational-notes/Partner/${partnerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Atomicity positive invariant' });
    expect(createRes.status).toBe(201);
    const noteId = createRes.body.id;

    // Note must exist
    const note = await prisma.operationalNote.findUnique({ where: { id: noteId } });
    expect(note).toBeTruthy();

    // Audit must exist
    const audit = await prisma.auditLog.findFirst({
      where: { resource: 'OperationalNote', resourceId: noteId, action: 'operational_note.created' },
    });
    expect(audit).toBeTruthy();

    // Cleanup
    await prisma.operationalNote.delete({ where: { id: noteId } }).catch(() => {});
  });
});
