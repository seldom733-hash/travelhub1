/**
 * D1A — Platform CRM Marketplace/Storefront Scope Isolation — Targeted Tests
 *
 * Verifies that Platform CRM Customers list/search/detail/export
 * exclude Storefront-only end-customers while preserving Marketplace customers.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from '../src/app.module';

describe('D1A — CRM Marketplace Scope Isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Login as admin
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@travelhub.local', password: 'admin123' });
    adminToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Customer scope isolation', () => {
    it('Platform CRM list should not contain SFC-* customers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const sfcCustomers = res.body.items.filter((c: any) => c.code?.startsWith('SFC'));
      expect(sfcCustomers).toHaveLength(0);
    });

    it('Platform CRM total should exclude Storefront-only customers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // DB has 262 total customers (200 CRM + 62 SFC)
      // Platform CRM should return only Marketplace customers
      const totalSfcInDb = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM crm."Customer" WHERE code LIKE 'SFC%'`
      );
      const totalInDb = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM crm."Customer"`
      );
      const sfcCount = Number(totalSfcInDb[0].count);
      const totalCount = Number(totalInDb[0].count);

      // List total should be less than total DB count (SFC excluded)
      expect(res.body.total).toBeLessThan(totalCount);
      // List total should equal total minus SFC customers (if all SFC are Storefront-only)
      expect(res.body.total).toBe(totalCount - sfcCount);
    });

    it('Platform CRM search by SFC code should return 0 results', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/customers?search=SFC-00000001')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });

    it('Platform CRM search by SFC customer name should return 0 results', async () => {
      // Find a known SFC customer name
      const sfcCustomer = await prisma.$queryRawUnsafe<{ firstName: string }[]>(
        `SELECT "firstName" FROM crm."Customer" WHERE code LIKE 'SFC%' LIMIT 1`
      );
      if (sfcCustomer.length > 0) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/crm/customers?search=${sfcCustomer[0].firstName}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Should not return SFC customers
        const sfcResults = res.body.items.filter((c: any) => c.code?.startsWith('SFC'));
        expect(sfcResults).toHaveLength(0);
      }
    });

    it('Platform CRM direct-ID should deny Storefront-only customer', async () => {
      // Get a known SFC customer ID
      const sfcCustomer = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM crm."Customer" WHERE code LIKE 'SFC%' LIMIT 1`
      );
      if (sfcCustomer.length > 0) {
        await request(app.getHttpServer())
          .get(`/api/v1/crm/customers/${sfcCustomer[0].id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      }
    });

    it('Platform CRM detail should deny Storefront-only customer', async () => {
      const sfcCustomer = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM crm."Customer" WHERE code LIKE 'SFC%' LIMIT 1`
      );
      if (sfcCustomer.length > 0) {
        await request(app.getHttpServer())
          .get(`/api/v1/crm/customers/${sfcCustomer[0].id}/detail`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      }
    });

    it('Platform CRM export should not contain SFC-* customers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/customers/export?format=csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Export should be CSV content
      const csv = res.text || '';
      const lines = csv.split('\n').filter((l: string) => l.trim());
      // Check no SFC codes in data rows
      const sfcLines = lines.filter((l: string) => l.includes('SFC-'));
      expect(sfcLines).toHaveLength(0);
    });

    it('Marketplace CRM customers should remain visible', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const crmCustomers = res.body.items.filter((c: any) => c.code?.startsWith('CRM'));
      expect(crmCustomers.length).toBeGreaterThan(0);
    });

    it('Marketplace customer detail should work', async () => {
      const crmCustomer = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM crm."Customer" WHERE code LIKE 'CRM%' LIMIT 1`
      );
      if (crmCustomer.length > 0) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/crm/customers/${crmCustomer[0].id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.code).toMatch(/^CRM/);
      }
    });
  });

  describe('Partner scope semantics', () => {
    it('Platform CRM Partners list should return partners', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/crm/partners')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThan(0);
    });
  });

  describe('DB evidence — Storefront data preserved', () => {
    it('SFC customers should still exist in database', async () => {
      const count = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM crm."Customer" WHERE code LIKE 'SFC%'`
      );
      expect(Number(count[0].count)).toBeGreaterThan(0);
    });

    it('CRM customers should still exist in database', async () => {
      const count = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM crm."Customer" WHERE code LIKE 'CRM%'`
      );
      expect(Number(count[0].count)).toBeGreaterThan(0);
    });
  });
});
