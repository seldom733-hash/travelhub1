import { Test, TestingModule } from '@nestjs/testing';
import { MarketingService } from './marketing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IdsService } from '../../shared/ids.service';
import { CampaignStatus } from '../../generated/prisma/enums';

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
  });

  describe('Attribution', () => {
    it('should create attribution for own campaign', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });
      prisma.campaignAttribution.create.mockResolvedValue({ id: '1', entityType: 'CUSTOMER', entityId: 'cust-1' });

      const result = await service.createAttribution(mockActor, {
        campaignId: 'camp-1',
        entityType: 'CUSTOMER',
        entityId: 'cust-1',
      });
      expect(result.entityType).toBe('CUSTOMER');
    });

    it('should reject invalid entityType', async () => {
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1', partnerId: null });

      await expect(service.createAttribution(mockActor, {
        campaignId: 'camp-1',
        entityType: 'INVALID',
        entityId: 'cust-1',
      })).rejects.toThrow('entityType must be one of');
    });
  });
});
