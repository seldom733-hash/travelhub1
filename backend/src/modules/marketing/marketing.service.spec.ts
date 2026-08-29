import { Test, TestingModule } from '@nestjs/testing';
import { MarketingService } from './marketing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IdsService } from '../../shared/ids.service';
import { CampaignStatus } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';

describe('MarketingService', () => {
  let service: MarketingService;
  let prisma: any;

  const mockActor = {
    id: 'user-1',
    code: 'USR-00000001',
    username: 'admin',
    email: null,
    fullName: 'Admin',
    status: 'ACTIVE' as any,
    role: 'ADMIN' as any,
    roleTitle: 'Administrator',
    partnerId: null,
    customerId: null,
    permissions: [] as string[],
  };

  const mockPartnerActor = {
    id: 'user-2',
    code: 'USR-00000002',
    username: 'partner',
    email: null,
    fullName: 'Partner',
    status: 'ACTIVE' as any,
    role: 'PARTNER' as any,
    roleTitle: 'Partner',
    partnerId: 'partner-1',
    customerId: null,
    permissions: [] as string[],
  };

  const mockPartnerActor2 = {
    id: 'user-3',
    code: 'USR-00000003',
    username: 'partner2',
    email: null,
    fullName: 'Partner 2',
    status: 'ACTIVE' as any,
    role: 'PARTNER' as any,
    roleTitle: 'Partner',
    partnerId: 'partner-2',
    customerId: null,
    permissions: [] as string[],
  };

  beforeEach(async () => {
    prisma = {
      campaign: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      campaignAudience: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      campaignAttribution: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
      partnerCustomerRelation: {
        findUnique: jest.fn(),
      },
      lead: {
        findUnique: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
      booking: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingService,
        { provide: PrismaService, useValue: prisma },
        { provide: IdsService, useValue: { nextCode: jest.fn().mockResolvedValue('MKT-00000001') } },
      ],
    }).compile();

    service = module.get<MarketingService>(MarketingService);
  });

  describe('Campaign CRUD', () => {
    it('should create a campaign', async () => {
      prisma.campaign.create.mockResolvedValue({ id: '1', code: 'MKT-00000001', name: 'Test', status: 'DRAFT' });

      const result = await service.createCampaign(mockActor, { name: 'Test' });
      expect(result.code).toBe('MKT-00000001');
      expect(prisma.campaign.create).toHaveBeenCalled();
    });

    it('should list campaigns in authorized scope', async () => {
      prisma.campaign.findMany.mockResolvedValue([]);
      prisma.campaign.count.mockResolvedValue(0);

      const result = await service.listCampaigns(mockActor);
      expect(result.items).toEqual([]);
    });

    it('should get campaign by id', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: '1', partnerId: null });

      const result = await service.getCampaign(mockActor, '1');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundError for nonexistent campaign', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.getCampaign(mockActor, 'nonexistent')).rejects.toThrow('Campaign not found');
    });

    it('should update DRAFT campaign', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: '1', status: 'DRAFT', partnerId: null });
      prisma.campaign.update.mockResolvedValue({ id: '1', name: 'Updated' });

      const result = await service.updateCampaign(mockActor, '1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should reject update of non-DRAFT campaign', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: '1', status: 'ACTIVE', partnerId: null });

      await expect(service.updateCampaign(mockActor, '1', { name: 'Updated' })).rejects.toThrow('Only DRAFT campaigns can be updated');
    });
  });

  describe('Campaign Lifecycle', () => {
    it('should transition DRAFT to SCHEDULED', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: '1', status: 'DRAFT', partnerId: null });
      prisma.campaign.update.mockResolvedValue({ id: '1', status: 'SCHEDULED' });

      const result = await service.transitionCampaign(mockActor, '1', { status: 'SCHEDULED' as any });
      expect(result.status).toBe('SCHEDULED');
    });

    it('should reject invalid transition DRAFT to ACTIVE', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: '1', status: 'DRAFT', partnerId: null });

      await expect(service.transitionCampaign(mockActor, '1', { status: 'ACTIVE' as any })).rejects.toThrow('Cannot transition');
    });

    it('should transition ACTIVE to COMPLETED', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: '1', status: 'ACTIVE', partnerId: null });
      prisma.campaign.update.mockResolvedValue({ id: '1', status: 'COMPLETED' });

      const result = await service.transitionCampaign(mockActor, '1', { status: 'COMPLETED' as any });
      expect(result.status).toBe('COMPLETED');
    });

    it('should reject transition from COMPLETED', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: '1', status: 'COMPLETED', partnerId: null });

      await expect(service.transitionCampaign(mockActor, '1', { status: 'ACTIVE' as any })).rejects.toThrow('Cannot transition');
    });
  });

  describe('Tenant Isolation', () => {
    it('should allow partner to access own campaign', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: '1', partnerId: 'partner-1' });

      const result = await service.getCampaign(mockPartnerActor, '1');
      expect(result).toBeDefined();
    });

    it('should hide foreign partner campaign (neutral 404)', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: '1', partnerId: 'partner-2' });

      await expect(service.getCampaign(mockPartnerActor, '1')).rejects.toThrow('Campaign not found');
    });

    it('should allow platform to access any campaign', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: '1', partnerId: 'partner-2' });

      const result = await service.getCampaign(mockActor, '1');
      expect(result).toBeDefined();
    });
  });

  describe('Audience', () => {
    it('should create audience for own campaign', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.campaignAudience.create.mockResolvedValue({ id: '1', code: 'MKA-00000001', name: 'Test Audience' });

      const result = await service.createAudience(mockActor, { name: 'Test Audience', campaignId: 'camp-1' });
      expect(result.code).toBe('MKA-00000001');
    });

    it('should reject audience creation for foreign campaign', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: 'partner-2' });

      await expect(service.createAudience(mockPartnerActor, { name: 'Test', campaignId: 'camp-1' })).rejects.toThrow('Campaign not found');
    });

    // ── Step 3.8.2 — Defect D: Audience criteria contract ──────
    it('should accept valid CRM criteria fields', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.campaignAudience.create.mockResolvedValue({ id: '1', code: 'MKA-00000001', name: 'Valid' });

      const result = await service.createAudience(mockActor, {
        name: 'Valid',
        campaignId: 'camp-1',
        criteria: { lifecycle: 'LEAD', leadSource: 'Marketplace', tags: ['vip'] },
      });
      expect(result).toBeDefined();
    });

    it('should reject criteria with email field', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });

      await expect(service.createAudience(mockActor, {
        name: 'Bad',
        campaignId: 'camp-1',
        criteria: { email: 'test@example.com' },
      })).rejects.toThrow('not allowed');
    });

    it('should reject criteria with phone field', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });

      await expect(service.createAudience(mockActor, {
        name: 'Bad',
        campaignId: 'camp-1',
        criteria: { phone: '+1234567890' },
      })).rejects.toThrow('not allowed');
    });

    it('should reject criteria with partnerId field', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });

      await expect(service.createAudience(mockActor, {
        name: 'Bad',
        campaignId: 'camp-1',
        criteria: { partnerId: 'partner-2' },
      })).rejects.toThrow('not allowed');
    });

    it('should reject criteria with unknown field', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });

      await expect(service.createAudience(mockActor, {
        name: 'Bad',
        campaignId: 'camp-1',
        criteria: { arbitraryField: 'value' },
      })).rejects.toThrow('not recognized');
    });

    it('should reject criteria with rawSql field', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });

      await expect(service.createAudience(mockActor, {
        name: 'Bad',
        campaignId: 'camp-1',
        criteria: { rawSql: 'SELECT * FROM users' },
      })).rejects.toThrow('not allowed');
    });

    it('should reject criteria with nested object', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });

      await expect(service.createAudience(mockActor, {
        name: 'Bad',
        campaignId: 'camp-1',
        criteria: { lifecycle: { nested: 'object' } },
      })).rejects.toThrow('must be a string, number, boolean, or string array');
    });

    it('should accept criteria with string array', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.campaignAudience.create.mockResolvedValue({ id: '1', code: 'MKA-00000001', name: 'Valid' });

      const result = await service.createAudience(mockActor, {
        name: 'Valid',
        campaignId: 'camp-1',
        criteria: { tags: ['vip', 'enterprise'] },
      });
      expect(result).toBeDefined();
    });
  });

  describe('Attribution — Step 3.8.2 Defects A+B (Entity Validation)', () => {
    it('should create valid CUSTOMER attribution', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', code: 'CUS-00000001' });
      prisma.campaignAttribution.create.mockResolvedValue({ id: '1', entityType: 'CUSTOMER', entityId: 'cust-1' });

      const result = await service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'CUSTOMER', entityId: 'cust-1',
      });
      expect(result.entityType).toBe('CUSTOMER');
    });

    it('should create valid ORDER attribution', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.order.findUnique.mockResolvedValue({ id: 'ord-1', sellerPartnerId: null });
      prisma.campaignAttribution.create.mockResolvedValue({ id: '1', entityType: 'ORDER', entityId: 'ord-1' });

      const result = await service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'ORDER', entityId: 'ord-1',
      });
      expect(result.entityType).toBe('ORDER');
    });

    it('should create valid BOOKING attribution', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.booking.findUnique.mockResolvedValue({ id: 'bkg-1', orderId: 'ord-1' });
      prisma.order.findUnique.mockResolvedValue({ id: 'ord-1', sellerPartnerId: null });
      prisma.campaignAttribution.create.mockResolvedValue({ id: '1', entityType: 'BOOKING', entityId: 'bkg-1' });

      const result = await service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'BOOKING', entityId: 'bkg-1',
      });
      expect(result.entityType).toBe('BOOKING');
    });

    it('should reject nonexistent CUSTOMER', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'CUSTOMER', entityId: 'nonexistent',
      })).rejects.toThrow('Customer nonexistent not found');
    });

    it('should reject nonexistent ORDER', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'ORDER', entityId: 'nonexistent',
      })).rejects.toThrow('Order nonexistent not found');
    });

    it('should reject nonexistent BOOKING', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'BOOKING', entityId: 'nonexistent',
      })).rejects.toThrow('Booking nonexistent not found');
    });

    it('should reject nonexistent LEAD', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'LEAD', entityId: 'nonexistent',
      })).rejects.toThrow('Lead nonexistent not found');
    });

    it('should reject invalid entityType', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });

      await expect(service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'INVALID', entityId: 'cust-1',
      })).rejects.toThrow('entityType must be one of');
    });

    // ── Step 3.8.2 — Defect B: Type confusion ──────────────────
    it('should reject ORDER + Booking ID (type confusion)', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      // Order lookup with a booking ID returns null
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'ORDER', entityId: 'booking-uuid-here',
      })).rejects.toThrow('Order booking-uuid-here not found');
    });

    it('should reject BOOKING + Order ID (type confusion)', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      // Booking lookup with an order ID returns null
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'BOOKING', entityId: 'order-uuid-here',
      })).rejects.toThrow('Booking order-uuid-here not found');
    });

    it('should reject CUSTOMER + unrelated entity ID', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'CUSTOMER', entityId: 'unrelated-uuid',
      })).rejects.toThrow('Customer unrelated-uuid not found');
    });
  });

  describe('Attribution — Partner Tenant Isolation', () => {
    it('should create attribution for Partner A own ORDER', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: 'partner-1' });
      prisma.order.findUnique.mockResolvedValue({ id: 'ord-1', sellerPartnerId: 'partner-1' });
      prisma.campaignAttribution.create.mockResolvedValue({ id: '1', entityType: 'ORDER', entityId: 'ord-1' });

      const result = await service.createAttribution(mockPartnerActor, {
        campaignId: 'camp-1', entityType: 'ORDER', entityId: 'ord-1',
      });
      expect(result.entityType).toBe('ORDER');
    });

    it('should reject Partner A → Partner B ORDER (foreign tenant)', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: 'partner-1' });
      prisma.order.findUnique.mockResolvedValue({ id: 'ord-1', sellerPartnerId: 'partner-2' });

      await expect(service.createAttribution(mockPartnerActor, {
        campaignId: 'camp-1', entityType: 'ORDER', entityId: 'ord-1',
      })).rejects.toThrow('not found in partner scope');
    });

    it('should reject Partner A → Partner B BOOKING (foreign tenant)', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: 'partner-1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'bkg-1', orderId: 'ord-1' });
      prisma.order.findUnique.mockResolvedValue({ id: 'ord-1', sellerPartnerId: 'partner-2' });

      await expect(service.createAttribution(mockPartnerActor, {
        campaignId: 'camp-1', entityType: 'BOOKING', entityId: 'bkg-1',
      })).rejects.toThrow('not found in partner scope');
    });

    it('should reject Partner A → Partner B CUSTOMER (no relation)', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: 'partner-1' });
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', code: 'CUS-00000001' });
      prisma.partnerCustomerRelation.findUnique.mockResolvedValue(null);

      await expect(service.createAttribution(mockPartnerActor, {
        campaignId: 'camp-1', entityType: 'CUSTOMER', entityId: 'cust-1',
      })).rejects.toThrow('not found in partner scope');
    });

    it('should accept Partner A → Partner A CUSTOMER (own relation)', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: 'partner-1' });
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', code: 'CUS-00000001' });
      prisma.partnerCustomerRelation.findUnique.mockResolvedValue({ id: 'rel-1', partnerId: 'partner-1', customerId: 'cust-1' });
      prisma.campaignAttribution.create.mockResolvedValue({ id: '1', entityType: 'CUSTOMER', entityId: 'cust-1' });

      const result = await service.createAttribution(mockPartnerActor, {
        campaignId: 'camp-1', entityType: 'CUSTOMER', entityId: 'cust-1',
      });
      expect(result.entityType).toBe('CUSTOMER');
    });

    it('should reject Partner A → unlinked LEAD (no customer link)', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: 'partner-1' });
      prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1', customerId: null });

      await expect(service.createAttribution(mockPartnerActor, {
        campaignId: 'camp-1', entityType: 'LEAD', entityId: 'lead-1',
      })).rejects.toThrow('has no customer link');
    });

    it('should reject Partner A → LEAD linked to Partner B customer', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: 'partner-1' });
      prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1', customerId: 'cust-2' });
      prisma.partnerCustomerRelation.findUnique.mockResolvedValue(null);

      await expect(service.createAttribution(mockPartnerActor, {
        campaignId: 'camp-1', entityType: 'LEAD', entityId: 'lead-1',
      })).rejects.toThrow('not found in partner scope');
    });
  });

  describe('Attribution — Defect C: Duplicate Handling', () => {
    it('should map duplicate attribution to ConflictError (not raw 500)', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', code: 'CUS-00000001' });

      // Simulate Prisma P2002 unique violation
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5',
        meta: { target: ['CampaignAttribution_campaignId_entityType_entityId_key'] },
      });
      prisma.campaignAttribution.create.mockRejectedValue(p2002Error);

      await expect(service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'CUSTOMER', entityId: 'cust-1',
      })).rejects.toThrow('already exists');
    });

    it('should rethrow unrelated Prisma errors', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', code: 'CUS-00000001' });

      const otherError = new Prisma.PrismaClientKnownRequestError('Connection refused', {
        code: 'P1001',
        clientVersion: '5',
      });
      prisma.campaignAttribution.create.mockRejectedValue(otherError);

      await expect(service.createAttribution(mockActor, {
        campaignId: 'camp-1', entityType: 'CUSTOMER', entityId: 'cust-1',
      })).rejects.toThrow('Connection refused');
    });
  });

  describe('Attribution — List and Entity Lookup', () => {
    it('should list attributions by campaign', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.campaignAttribution.findMany.mockResolvedValue([{ id: '1', entityType: 'CUSTOMER' }]);

      const result = await service.listAttributions(mockActor, 'camp-1');
      expect(result).toHaveLength(1);
    });

    it('should list attributions by entity', async () => {
      prisma.campaignAttribution.findMany.mockResolvedValue([{ id: '1', entityType: 'ORDER', entityId: 'ord-1' }]);

      const result = await service.listAttributionsByEntity(mockActor, 'ORDER', 'ord-1');
      expect(result).toHaveLength(1);
    });
  });
});
