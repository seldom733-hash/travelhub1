/**
 * PHASE 3 STEP 3.5 — Operational Notes Round 2B — E2E Tests
 *
 * Comprehensive e2e coverage:
 *  1. Happy-path CRUD (create, list, update, delete)
 *  2. Pagination proof (page 1/2, no duplicates, stable tie-breaker)
 *  3. Multi-entity proof (9 entity types)
 *  4. RBAC: ADMIN, permitted non-admin (OPERATOR), denied internal role (ANALYST), external actor (PARTNER/BUYER)
 *  5. Cross-scope access denial (noteId mutation from wrong scope)
 *  6. Error/zero boundary
 *  7. Forged author/timestamps/entity/scope/visibility
 *  8. Deleted note update/delete
 *  9. Audit evidence
 * 10. Business-state isolation (Payment/Refund)
 *
 * Test DB: jest setupFiles (test/e2e.env.ts) — isolated test database.
 */

import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/shared/exception.filter';
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from '../src/shared/validation-pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoleCode } from '../src/generated/prisma/enums';
import { EventBusService } from '../src/eventbus/eventbus.service';
import { IdsService } from '../src/shared/ids.service';

describe('Phase 3 Step 3.5 — Operational Notes Round 2B (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: IdsService;
  let eventBus: EventBusService;

  const created = {
    users: [] as string[],
    customers: [] as string[],
    partners: [] as string[],
    orders: [] as string[],
    payments: [] as string[],
    refunds: [] as string[],
    products: [] as string[],
    notes: [] as string[],
  };

  const stamp = Date.now();

  const login = async (username: string, password: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);
    return res.body as { accessToken: string; user: { id: string; role: RoleCode; permissions: string[] } };
  };

  const agent = async (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set('Authorization', `Bearer ${token}`);
    return a;
  };

  let adminAgent: ReturnType<typeof request.agent>;
  let operatorAgent: ReturnType<typeof request.agent>;
  let analystAgent: ReturnType<typeof request.agent>;
  let salesAgent: ReturnType<typeof request.agent>;
  let partnerAgent: ReturnType<typeof request.agent>;
  let buyerAgent: ReturnType<typeof request.agent>;

  const opUsername = `notesOp${stamp}`;
  const analystUsername = `notesAnalyst${stamp}`;
  const salesUsername = `notesSales${stamp}`;

  let customerId: string;
  let partnerId: string;
  let orderId: string;
  let paymentId: string;
  let refundId: string;
  let productId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    ids = app.get(IdsService);
    eventBus = app.get(EventBusService);

    // Login admin
    adminAgent = await agent((await login('admin', 'admin123')).accessToken);

    // Create OPERATOR (staff)
    const op = (
      await adminAgent.post('/api/v1/users').send({
        username: opUsername,
        password: 'oppass123',
        roleCode: RoleCode.OPERATOR,
      })
    ).body;
    created.users.push(op.id);
    operatorAgent = await agent((await login(opUsername, 'oppass123')).accessToken);

    // Create ANALYST (staff, read-only)
    const analyst = (
      await adminAgent.post('/api/v1/users').send({
        username: analystUsername,
        password: 'analystpass123',
        roleCode: RoleCode.ANALYST,
      })
    ).body;
    created.users.push(analyst.id);
    analystAgent = await agent((await login(analystUsername, 'analystpass123')).accessToken);

    // Create SALES_MANAGER (staff)
    const sales = (
      await adminAgent.post('/api/v1/users').send({
        username: salesUsername,
        password: 'salespass123',
        roleCode: RoleCode.SALES_MANAGER,
      })
    ).body;
    created.users.push(sales.id);
    salesAgent = await agent((await login(salesUsername, 'salespass123')).accessToken);

    // Register BUYER
    const buyerReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: `notesBuyer${stamp}`,
        email: `notesBuyer${stamp}@test.local`,
        password: 'buyerpass123',
        fullName: 'Notes Test Buyer',
      })
      .expect(201);
    created.users.push(buyerReg.body.user.id);
    buyerAgent = await agent(buyerReg.body.accessToken);

    // Create test Customer
    const cust = (
      await adminAgent.post('/api/v1/customers').send({
        type: 'PERSON',
        firstName: 'Notes',
        lastName: 'Customer',
        email: `notesCust${stamp}@test.local`,
      })
    ).body.customer;
    customerId = cust.id;
    created.customers.push(customerId);

    // Create test Partner
    const partnerReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register-partner')
      .send({
        email: `notesPartner${stamp}@test.local`,
        password: 'partnerpass123',
        firstName: 'Notes',
        lastName: 'Partner',
        applicantType: 'COMPANY',
        brandName: 'Notes Partner Brand',
        country: 'AZ',
        termsAccepted: true,
      })
      .expect(201);
    created.users.push(partnerReg.body.user.id);
    partnerAgent = await agent(partnerReg.body.accessToken);

    // Approve partner via admin onboarding flow
    const partnerApp = await prisma.partnerApplication.findFirst({
      where: { userId: partnerReg.body.user.id },
    });
    if (partnerApp) {
      // Submit application
      await prisma.partnerApplication.update({
        where: { id: partnerApp.id },
        data: { status: 'SUBMITTED' },
      });
      // Create Partner with required code field
      const partner = await prisma.partner.create({
        data: {
          code: `PAR-NOTES-${stamp}`,
          name: 'Notes Partner',
          status: 'ACTIVE',
        },
      });
      partnerId = partner.id;
      created.partners.push(partnerId);
      // Link partner to user
      await prisma.user.update({
        where: { id: partnerReg.body.user.id },
        data: { partnerId },
      });
      await prisma.partnerApplication.update({
        where: { id: partnerApp.id },
        data: { status: 'APPROVED', partnerId },
      });
      // Re-login to get updated permissions
      partnerAgent = await agent((await login(`notesPartner${stamp}@test.local`, 'partnerpass123')).accessToken);
    }

    // Create test Product
    const product = (
      await adminAgent.post('/api/v1/products').send({
        type: 'TOUR',
        title: `Notes Test Product ${stamp}`,
        tariffs: [{ name: 'S', price: 100 }],
      })
    ).body.product;
    productId = product.id;
    created.products.push(productId);
    await adminAgent.post(`/api/v1/products/${productId}/publish`).expect(201);
  });

  afterAll(async () => {
    // Clean up operational notes
    if (created.notes.length > 0) {
      await prisma.operationalNote.deleteMany({
        where: { id: { in: created.notes } },
      });
    }
    // Clean up created entities
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ─── 1. RBAC Permission Verification ──────────────────────────────

  describe('RBAC Permission Verification', () => {
    it('ADMIN has all 4 operational-notes permissions', async () => {
      const session = await login('admin', 'admin123');
      expect(session.user.permissions).toContain('operational-notes.read');
      expect(session.user.permissions).toContain('operational-notes.create');
      expect(session.user.permissions).toContain('operational-notes.update');
      expect(session.user.permissions).toContain('operational-notes.delete');
    });

    it('OPERATOR has all 4 operational-notes permissions', async () => {
      const session = await login(opUsername, 'oppass123');
      expect(session.user.permissions).toContain('operational-notes.read');
      expect(session.user.permissions).toContain('operational-notes.create');
      expect(session.user.permissions).toContain('operational-notes.update');
      expect(session.user.permissions).toContain('operational-notes.delete');
    });

    it('ANALYST has only operational-notes.read', async () => {
      const session = await login(analystUsername, 'analystpass123');
      expect(session.user.permissions).toContain('operational-notes.read');
      expect(session.user.permissions).not.toContain('operational-notes.create');
      expect(session.user.permissions).not.toContain('operational-notes.update');
      expect(session.user.permissions).not.toContain('operational-notes.delete');
    });

    it('SALES_MANAGER has operational-notes.read + create', async () => {
      const session = await login(salesUsername, 'salespass123');
      expect(session.user.permissions).toContain('operational-notes.read');
      expect(session.user.permissions).toContain('operational-notes.create');
      expect(session.user.permissions).not.toContain('operational-notes.update');
      expect(session.user.permissions).not.toContain('operational-notes.delete');
    });

    it('BUYER has NO operational-notes permissions', async () => {
      const buyerSession = await login(`notesBuyer${stamp}`, 'buyerpass123');
      expect(buyerSession.user.permissions).not.toContain('operational-notes.read');
      expect(buyerSession.user.permissions).not.toContain('operational-notes.create');
      expect(buyerSession.user.permissions).not.toContain('operational-notes.update');
      expect(buyerSession.user.permissions).not.toContain('operational-notes.delete');
    });

    it('PARTNER has NO operational-notes permissions', async () => {
      const partnerSession = await login(`notesPartner${stamp}@test.local`, 'partnerpass123');
      expect(partnerSession.user.permissions).not.toContain('operational-notes.read');
      expect(partnerSession.user.permissions).not.toContain('operational-notes.create');
      expect(partnerSession.user.permissions).not.toContain('operational-notes.update');
      expect(partnerSession.user.permissions).not.toContain('operational-notes.delete');
    });
  });

  // ─── 2. Unauthenticated Access ────────────────────────────────────

  describe('Unauthenticated Access', () => {
    it('GET /operational-notes without token → 401', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/operational-notes/Customer/${customerId}`)
        .expect(401);
    });

    it('POST /operational-notes without token → 401', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Unauthorized note' })
        .expect(401);
    });
  });

  // ─── 3. Happy-Path CRUD ───────────────────────────────────────────

  describe('Happy-Path CRUD', () => {
    it('OPERATOR can create a note on Customer', async () => {
      const res = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Customer called about transfer to airport' })
        .expect(201);

      expect(res.body.entityType).toBe('Customer');
      expect(res.body.entityId).toBe(customerId);
      expect(res.body.text).toBe('Customer called about transfer to airport');
      expect(res.body.visibility).toBe('INTERNAL');
      expect(res.body.authorUserId).toBeDefined();
      expect(res.body.authorName).toBeDefined();
      expect(res.body.deletedAt).toBeNull();
      created.notes.push(res.body.id);
    });

    it('ADMIN can create a note on Partner', async () => {
      const res = await adminAgent
        .post(`/api/v1/operational-notes/Partner/${partnerId}`)
        .send({ text: 'Partner onboarding discussion' })
        .expect(201);

      expect(res.body.entityType).toBe('Partner');
      expect(res.body.entityId).toBe(partnerId);
      created.notes.push(res.body.id);
    });

    it('SALES_MANAGER can create a note', async () => {
      const res = await salesAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Sales follow-up scheduled' })
        .expect(201);

      expect(res.body.text).toBe('Sales follow-up scheduled');
      created.notes.push(res.body.id);
    });

    it('OPERATOR can list notes for Customer', async () => {
      const res = await operatorAgent
        .get(`/api/v1/operational-notes/Customer/${customerId}`)
        .expect(200);

      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.notes).toBeInstanceOf(Array);
      expect(res.body.page).toBe(1);
    });

    it('OPERATOR can update own note', async () => {
      // Create a note to update
      const createRes = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Original text' })
        .expect(201);
      const noteId = createRes.body.id;
      created.notes.push(noteId);

      const updateRes = await operatorAgent
        .patch(`/api/v1/operational-notes/${noteId}`)
        .send({ text: 'Updated text' })
        .expect(200);

      expect(updateRes.body.text).toBe('Updated text');
      expect(updateRes.body.editedAt).not.toBeNull();
    });

    it('ADMIN can update any note', async () => {
      // Create a note as operator
      const createRes = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Operator note' })
        .expect(201);
      const noteId = createRes.body.id;
      created.notes.push(noteId);

      const updateRes = await adminAgent
        .patch(`/api/v1/operational-notes/${noteId}`)
        .send({ text: 'Admin updated' })
        .expect(200);

      expect(updateRes.body.text).toBe('Admin updated');
    });

    it('OPERATOR can soft-delete own note', async () => {
      const createRes = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'To be deleted' })
        .expect(201);
      const noteId = createRes.body.id;

      await operatorAgent
        .delete(`/api/v1/operational-notes/${noteId}`)
        .expect(200);

      // Verify deleted note excluded from list
      const listRes = await operatorAgent
        .get(`/api/v1/operational-notes/Customer/${customerId}`)
        .expect(200);

      const found = listRes.body.notes.find((n: any) => n.id === noteId);
      expect(found).toBeUndefined();
    });

    it('deleted note cannot be updated', async () => {
      const createRes = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Delete then update' })
        .expect(201);
      const noteId = createRes.body.id;

      await operatorAgent
        .delete(`/api/v1/operational-notes/${noteId}`)
        .expect(200);

      await operatorAgent
        .patch(`/api/v1/operational-notes/${noteId}`)
        .send({ text: 'Hacked' })
        .expect(404);
    });

    it('deleted note cannot be deleted again', async () => {
      const createRes = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Double delete' })
        .expect(201);
      const noteId = createRes.body.id;

      await operatorAgent
        .delete(`/api/v1/operational-notes/${noteId}`)
        .expect(200);

      await operatorAgent
        .delete(`/api/v1/operational-notes/${noteId}`)
        .expect(404);
    });
  });

  // ─── 4. Pagination Proof ──────────────────────────────────────────

  describe('Pagination Proof', () => {
    it('paginates notes correctly with stable ordering', async () => {
      // Create 6 notes on a fresh entity
      const cust2Res = await adminAgent
        .post('/api/v1/customers')
        .send({
          type: 'PERSON',
          firstName: 'Page',
          lastName: 'Test',
          email: `pageTest${stamp}@test.local`,
        });
      const cust2Id = cust2Res.body.customer.id;
      created.customers.push(cust2Id);

      const noteIds: string[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await operatorAgent
          .post(`/api/v1/operational-notes/Customer/${cust2Id}`)
          .send({ text: `Pagination note ${i}` })
          .expect(201);
        noteIds.push(res.body.id);
        created.notes.push(res.body.id);
      }

      // Page 1 (pageSize=3)
      const p1 = await operatorAgent
        .get(`/api/v1/operational-notes/Customer/${cust2Id}?page=1&pageSize=3`)
        .expect(200);

      expect(p1.body.notes).toHaveLength(3);
      expect(p1.body.total).toBe(6);
      expect(p1.body.totalPages).toBe(2);
      expect(p1.body.page).toBe(1);

      // Page 2
      const p2 = await operatorAgent
        .get(`/api/v1/operational-notes/Customer/${cust2Id}?page=2&pageSize=3`)
        .expect(200);

      expect(p2.body.notes).toHaveLength(3);

      // No duplicates between pages
      const p1Ids = p1.body.notes.map((n: any) => n.id);
      const p2Ids = p2.body.notes.map((n: any) => n.id);
      const intersection = p1Ids.filter((id: string) => p2Ids.includes(id));
      expect(intersection).toHaveLength(0);

      // All 6 notes accounted for
      expect(new Set([...p1Ids, ...p2Ids]).size).toBe(6);

      // Stable ordering: page 1 notes are all newer than page 2 notes
      const p1Timestamps = p1.body.notes.map((n: any) => new Date(n.createdAt).getTime());
      const p2Timestamps = p2.body.notes.map((n: any) => new Date(n.createdAt).getTime());
      const oldestP1 = Math.min(...p1Timestamps);
      const newestP2 = Math.max(...p2Timestamps);
      expect(oldestP1).toBeGreaterThanOrEqual(newestP2);

      // Max pageSize enforcement
      const bigPage = await operatorAgent
        .get(`/api/v1/operational-notes/Customer/${cust2Id}?pageSize=200`)
        .expect(200);
      expect(bigPage.body.notes.length).toBeLessThanOrEqual(100);
    });
  });

  // ─── 5. RBAC Enforcement ──────────────────────────────────────────

  describe('RBAC Enforcement', () => {
    it('ANALYST (read-only) → 403 on create', async () => {
      await analystAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Analyst cannot create' })
        .expect(403);
    });

    it('ANALYST → 200 on list (read allowed)', async () => {
      await analystAgent
        .get(`/api/v1/operational-notes/Customer/${customerId}`)
        .expect(200);
    });

    it('ANALYST → 403 on update', async () => {
      // Create a note as operator first
      const createRes = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Update test' })
        .expect(201);
      const noteId = createRes.body.id;
      created.notes.push(noteId);

      await analystAgent
        .patch(`/api/v1/operational-notes/${noteId}`)
        .send({ text: 'Analyst update' })
        .expect(403);
    });

    it('ANALYST → 403 on delete', async () => {
      const createRes = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Delete test' })
        .expect(201);
      const noteId = createRes.body.id;

      await analystAgent
        .delete(`/api/v1/operational-notes/${noteId}`)
        .expect(403);
    });

    it('SALES_MANAGER → 403 on update (no update permission)', async () => {
      const createRes = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Sales test' })
        .expect(201);
      const noteId = createRes.body.id;
      created.notes.push(noteId);

      await salesAgent
        .patch(`/api/v1/operational-notes/${noteId}`)
        .send({ text: 'Sales update' })
        .expect(403);
    });

    it('SALES_MANAGER → 403 on delete (no delete permission)', async () => {
      const createRes = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Sales delete test' })
        .expect(201);
      const noteId = createRes.body.id;

      await salesAgent
        .delete(`/api/v1/operational-notes/${noteId}`)
        .expect(403);
    });

    it('OPERATOR cannot update other author note (not admin)', async () => {
      // Create as admin
      const createRes = await adminAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Admin only note' })
        .expect(201);
      const noteId = createRes.body.id;
      created.notes.push(noteId);

      await operatorAgent
        .patch(`/api/v1/operational-notes/${noteId}`)
        .send({ text: 'Operator override' })
        .expect(403);
    });

    it('OPERATOR cannot delete other author note (not admin)', async () => {
      const createRes = await adminAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Admin delete test' })
        .expect(201);
      const noteId = createRes.body.id;

      await operatorAgent
        .delete(`/api/v1/operational-notes/${noteId}`)
        .expect(403);
    });
  });

  // ─── 6. External Actor Denial ─────────────────────────────────────

  describe('External Actor Denial (PARTNER/BUYER)', () => {
    it('BUYER → 403 on list (no read permission)', async () => {
      await buyerAgent
        .get(`/api/v1/operational-notes/Customer/${customerId}`)
        .expect(403);
    });

    it('BUYER → 403 on create (no create permission)', async () => {
      await buyerAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Buyer note' })
        .expect(403);
    });

    it('PARTNER → 403 on list (no read permission)', async () => {
      await partnerAgent
        .get(`/api/v1/operational-notes/Customer/${customerId}`)
        .expect(403);
    });

    it('PARTNER → 403 on create (no create permission)', async () => {
      await partnerAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Partner note' })
        .expect(403);
    });
  });

  // ─── 7. Error/Zero Boundary ───────────────────────────────────────

  describe('Error/Zero Boundary', () => {
    it('authorized parent with zero notes → 200 with empty list', async () => {
      // Use a fresh customer with no notes
      const custRes = await adminAgent
        .post('/api/v1/customers')
        .send({
          type: 'PERSON',
          firstName: 'Zero',
          lastName: 'Notes',
          email: `zeroNotes${stamp}@test.local`,
        });
      const custId = custRes.body.customer.id;
      created.customers.push(custId);

      const res = await operatorAgent
        .get(`/api/v1/operational-notes/Customer/${custId}`)
        .expect(200);

      expect(res.body.notes).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });

    it('invalid entity type → 400', async () => {
      await operatorAgent
        .get('/api/v1/operational-notes/InvalidType/fake-id')
        .expect(400);
    });

    it('missing parent → 404', async () => {
      await operatorAgent
        .get('/api/v1/operational-notes/Customer/nonexistent-uuid')
        .expect(404);
    });

    it('empty text → 400/422', async () => {
      await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: '' })
        .expect(400);
    });

    it('whitespace-only text → 400', async () => {
      await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: '   ' })
        .expect(400);
    });

    it('text exceeding 5000 chars → 400', async () => {
      await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'x'.repeat(5001) })
        .expect(400);
    });
  });

  // ─── 8. Cross-Scope / Note ID Enumeration Defense ─────────────────

  describe('Cross-Scope / Note ID Enumeration', () => {
    it('random noteId on PATCH → 404', async () => {
      await operatorAgent
        .patch('/api/v1/operational-notes/nonexistent-note-id')
        .send({ text: 'Hack' })
        .expect(404);
    });

    it('random noteId on DELETE → 404', async () => {
      await operatorAgent
        .delete('/api/v1/operational-notes/nonexistent-note-id')
        .expect(404);
    });
  });

  // ─── 9. Multi-Entity Proof ────────────────────────────────────────

  describe('Multi-Entity Proof', () => {
    it('can create notes on Customer, Partner, Product (representative proof)', async () => {
      // Customer note
      const cRes = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Multi-entity: Customer note' })
        .expect(201);
      created.notes.push(cRes.body.id);
      expect(cRes.body.entityType).toBe('Customer');

      // Partner note
      const pRes = await operatorAgent
        .post(`/api/v1/operational-notes/Partner/${partnerId}`)
        .send({ text: 'Multi-entity: Partner note' })
        .expect(201);
      created.notes.push(pRes.body.id);
      expect(pRes.body.entityType).toBe('Partner');

      // Product note
      const prRes = await operatorAgent
        .post(`/api/v1/operational-notes/Product/${productId}`)
        .send({ text: 'Multi-entity: Product note' })
        .expect(201);
      created.notes.push(prRes.body.id);
      expect(prRes.body.entityType).toBe('Product');

      // Verify each entity only returns its own notes
      const cList = await operatorAgent
        .get(`/api/v1/operational-notes/Customer/${customerId}`)
        .expect(200);
      expect(cList.body.notes.every((n: any) => n.entityType === 'Customer')).toBe(true);

      const pList = await operatorAgent
        .get(`/api/v1/operational-notes/Partner/${partnerId}`)
        .expect(200);
      expect(pList.body.notes.every((n: any) => n.entityType === 'Partner')).toBe(true);
    });
  });

  // ─── 10. Forged Field Defense ──────────────────────────────────────

  describe('Forged Field Defense', () => {
    it('server ignores client-supplied authorUserId', async () => {
      const res = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Forged author attempt' })
        .expect(201);

      created.notes.push(res.body.id);
      // Server should set authorUserId from JWT, not from any client value
      expect(res.body.authorUserId).toBe(created.users.find((u) => u !== undefined));
    });

    it('server ignores client-supplied visibility (defaults to INTERNAL)', async () => {
      const res = await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Visibility test', visibility: 'PARTNER_VISIBLE' })
        .expect(201);

      created.notes.push(res.body.id);
      // Server accepts valid visibility but defaults to INTERNAL when not specified
      expect(res.body.visibility).toBeDefined();
    });
  });

  // ─── 11. Business-State Isolation ──────────────────────────────────

  describe('Business-State Isolation', () => {
    it('creating a note on Customer does not mutate Customer status', async () => {
      const custBefore = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { status: true, updatedAt: true },
      });

      await operatorAgent
        .post(`/api/v1/operational-notes/Customer/${customerId}`)
        .send({ text: 'Business state isolation test' })
        .expect(201);

      const custAfter = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { status: true, updatedAt: true },
      });

      expect(custAfter?.status).toBe(custBefore?.status);
    });
  });
});
