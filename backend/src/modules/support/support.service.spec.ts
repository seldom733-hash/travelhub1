import { Test, TestingModule } from '@nestjs/testing';
import { SupportService } from './support.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IdsService } from '../../shared/ids.service';
import { NotFoundException } from '@nestjs/common';
import { ValidationDomainError } from '../../shared/errors';

/**
 * PHASE 3 STEP 3.10 — Support Domain Service Tests.
 *
 * Covers: create, read, list, lifecycle, assignment, escalation,
 * comments, communication links, audit history, related entity validation.
 */

describe('SupportService', () => {
  let service: SupportService;
  let prisma: any;
  let ids: any;

  const mockActor = {
    id: 'user-001',
    code: 'USR-00000001',
    username: 'admin',
    email: 'admin@test.com',
    fullName: 'Admin User',
    status: 'ACTIVE' as any,
    role: 'ADMIN' as any,
    roleTitle: 'Administrator',
    partnerId: null,
    customerId: null,
    permissions: ['support.case.create', 'support.case.read', 'support.case.update', 'support.case.assign'],
  };

  const mockCase = {
    id: 'case-001',
    code: 'SUP-00000001',
    title: 'Test support case',
    description: 'Description',
    caseType: 'GENERAL',
    priority: 'MEDIUM',
    status: 'OPEN',
    source: 'email',
    customerId: null,
    orderId: null,
    bookingId: null,
    assignedToId: null,
    slaDeadline: null,
    slaBreached: false,
    escalatedAt: null,
    escalatedById: null,
    escalationReason: null,
    createdById: 'user-001',
    createdAt: new Date(),
    updatedAt: new Date(),
    resolvedAt: null,
    closedAt: null,
    version: 1,
  };

  beforeEach(async () => {
    prisma = {
      case: {
        create: jest.fn().mockResolvedValue(mockCase),
        findUnique: jest.fn().mockResolvedValue(mockCase),
        findMany: jest.fn().mockResolvedValue([mockCase]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({ ...mockCase, status: 'IN_PROGRESS' }),
      },
      caseComment: {
        create: jest.fn().mockResolvedValue({ id: 'comment-001', caseId: 'case-001', body: 'test', isInternal: false }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      caseCommunicationLink: {
        upsert: jest.fn().mockResolvedValue({ id: 'link-001' }),
        count: jest.fn().mockResolvedValue(0),
      },
      caseHistory: {
        create: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      // F3: Related entities
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'cust-001' }) },
      order: { findUnique: jest.fn().mockResolvedValue({ id: 'ord-001' }) },
      booking: { findUnique: jest.fn().mockResolvedValue({ id: 'bk-001' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-002', role: 'OPERATOR' }) },
      // F5: Communication entity
      communication: { findUnique: jest.fn().mockResolvedValue({ id: 'comm-001' }) },
    };

    ids = {
      nextCode: jest.fn().mockResolvedValue('SUP-00000001'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: prisma },
        { provide: IdsService, useValue: ids },
      ],
    }).compile();

    service = module.get<SupportService>(SupportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCase', () => {
    it('should create a case with generated code', async () => {
      const result = await service.createCase(mockActor, { title: 'Test case' });
      expect(result.code).toBe('SUP-00000001');
      expect(prisma.case.create).toHaveBeenCalled();
      expect(ids.nextCode).toHaveBeenCalledWith(prisma, 'SUP');
    });

    it('should create audit history on creation', async () => {
      await service.createCase(mockActor, { title: 'Test case' });
      expect(prisma.caseHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'created' }),
        }),
      );
    });

    // F3: Negative matrix tests
    it('should reject nonexistent customer', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.createCase(mockActor, { title: 'Test', customerId: 'bad-id' })).rejects.toThrow();
    });

    it('should reject nonexistent order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.createCase(mockActor, { title: 'Test', orderId: 'bad-id' })).rejects.toThrow();
    });

    it('should reject nonexistent booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.createCase(mockActor, { title: 'Test', bookingId: 'bad-id' })).rejects.toThrow();
    });
  });

  describe('listCases', () => {
    it('should list cases with pagination', async () => {
      const result = await service.listCases(mockActor, 1, 20);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by status', async () => {
      await service.listCases(mockActor, 1, 20, { status: 'OPEN' });
      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'OPEN' }),
        }),
      );
    });

    it('should filter by priority', async () => {
      await service.listCases(mockActor, 1, 20, { priority: 'HIGH' });
      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: 'HIGH' }),
        }),
      );
    });
  });

  describe('getCase', () => {
    it('should return case by id', async () => {
      const result = await service.getCase(mockActor, 'case-001');
      expect(result.code).toBe('SUP-00000001');
    });

    it('should throw NotFoundException for nonexistent case', async () => {
      prisma.case.findUnique.mockResolvedValue(null);
      await expect(service.getCase(mockActor, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCase', () => {
    it('should update case fields', async () => {
      const result = await service.updateCase(mockActor, 'case-001', { title: 'Updated' });
      expect(result).toBeDefined();
      expect(prisma.case.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException for nonexistent case', async () => {
      prisma.case.findUnique.mockResolvedValue(null);
      await expect(service.updateCase(mockActor, 'nonexistent', { title: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('should reject update of closed case', async () => {
      prisma.case.findUnique.mockResolvedValue({ ...mockCase, status: 'CLOSED' });
      await expect(service.updateCase(mockActor, 'case-001', { title: 'x' })).rejects.toThrow();
    });
  });

  describe('transitionCase', () => {
    it('should transition OPEN → IN_PROGRESS', async () => {
      const result = await service.transitionCase(mockActor, 'case-001', { status: 'IN_PROGRESS' });
      expect(result).toBeDefined();
      expect(prisma.case.update).toHaveBeenCalled();
    });

    it('should transition OPEN → CLOSED', async () => {
      const result = await service.transitionCase(mockActor, 'case-001', { status: 'CLOSED' });
      expect(result).toBeDefined();
    });

    it('should reject invalid transition OPEN → RESOLVED', async () => {
      await expect(
        service.transitionCase(mockActor, 'case-001', { status: 'RESOLVED' }),
      ).rejects.toThrow();
    });

    it('should reject transition from CLOSED (terminal)', async () => {
      prisma.case.findUnique.mockResolvedValue({ ...mockCase, status: 'CLOSED' });
      await expect(
        service.transitionCase(mockActor, 'case-001', { status: 'OPEN' }),
      ).rejects.toThrow();
    });

    it('should set resolvedAt on RESOLVED transition', async () => {
      prisma.case.findUnique.mockResolvedValue({ ...mockCase, status: 'IN_PROGRESS' });
      await service.transitionCase(mockActor, 'case-001', { status: 'RESOLVED' });
      expect(prisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ resolvedAt: expect.any(Date) }),
        }),
      );
    });

    it('should set closedAt on CLOSED transition', async () => {
      await service.transitionCase(mockActor, 'case-001', { status: 'CLOSED' });
      expect(prisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ closedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('assignCase', () => {
    it('should assign case to a user', async () => {
      const result = await service.assignCase(mockActor, 'case-001', { assignedToId: 'user-002' });
      expect(result).toBeDefined();
      expect(prisma.case.update).toHaveBeenCalled();
    });

    it('should create assignment audit history', async () => {
      await service.assignCase(mockActor, 'case-001', { assignedToId: 'user-002' });
      expect(prisma.caseHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'assigned' }),
        }),
      );
    });

    // F3: Negative matrix tests
    it('should reject nonexistent assignee', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.assignCase(mockActor, 'case-001', { assignedToId: 'bad-id' })).rejects.toThrow();
    });

    it('should reject ineligible assignee (BUYER)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'bad-user', role: 'BUYER' });
      await expect(service.assignCase(mockActor, 'case-001', { assignedToId: 'bad-user' })).rejects.toThrow();
    });
  });

  describe('escalateCase', () => {
    it('should escalate case', async () => {
      const result = await service.escalateCase(mockActor, 'case-001', { escalationReason: 'Urgent issue' });
      expect(result).toBeDefined();
      expect(prisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ESCALATED',
            escalatedAt: expect.any(Date),
            escalationReason: 'Urgent issue',
          }),
        }),
      );
    });

    it('should reject escalation of closed case', async () => {
      prisma.case.findUnique.mockResolvedValue({ ...mockCase, status: 'CLOSED' });
      await expect(
        service.escalateCase(mockActor, 'case-001', { escalationReason: 'test' }),
      ).rejects.toThrow();
    });
  });

  describe('addComment', () => {
    it('should add comment to case', async () => {
      const result = await service.addComment(mockActor, 'case-001', { body: 'Internal note', isInternal: true });
      expect(result.id).toBe('comment-001');
      expect(prisma.caseComment.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException for nonexistent case', async () => {
      prisma.case.findUnique.mockResolvedValue(null);
      await expect(service.addComment(mockActor, 'nonexistent', { body: 'test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('linkCommunication', () => {
    // F5: Negative matrix tests
    it('should reject nonexistent communication', async () => {
      prisma.communication.findUnique.mockResolvedValue(null);
      await expect(service.linkCommunication(mockActor, 'case-001', 'bad-comm')).rejects.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return case statistics', async () => {
      const result = await service.getStats();
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('open');
      expect(result).toHaveProperty('escalated');
    });

    // R10: WAITING aggregate
    it('should include waiting count (sum of WAITING_CUSTOMER + WAITING_PARTNER + WAITING_INTERNAL)', async () => {
      prisma.case.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3)  // open
        .mockResolvedValueOnce(2)  // inProgress
        .mockResolvedValueOnce(1)  // waitingCustomer
        .mockResolvedValueOnce(1)  // waitingPartner
        .mockResolvedValueOnce(0)  // waitingInternal
        .mockResolvedValueOnce(1)  // escalated
        .mockResolvedValueOnce(2)  // resolved
        .mockResolvedValueOnce(0); // closed
      const result = await service.getStats();
      expect(result.waiting).toBe(2);
      expect(result.total).toBe(10);
    });

    // R10: KPI excludes soft-deleted
    it('should exclude soft-deleted cases from stats', async () => {
      await service.getStats();
      expect(prisma.case.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });
  });

  // R13: Soft delete tests
  describe('softDeleteCase', () => {
    it('should soft-delete an accidental case', async () => {
      prisma.caseComment.count.mockResolvedValue(0);
      prisma.caseHistory.count.mockResolvedValue(0);
      prisma.caseCommunicationLink.count.mockResolvedValue(0);
      const result = await service.softDeleteCase(mockActor, 'case-001', 'Created by mistake');
      expect(result).toBeDefined();
      expect(prisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            deletedBy: 'user-001',
            deletionReason: 'Created by mistake',
          }),
        }),
      );
    });

    it('should create case_deleted audit history', async () => {
      prisma.caseComment.count.mockResolvedValue(0);
      prisma.caseHistory.count.mockResolvedValue(0);
      prisma.caseCommunicationLink.count.mockResolvedValue(0);
      await service.softDeleteCase(mockActor, 'case-001', 'mistake');
      expect(prisma.caseHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'case_deleted' }),
        }),
      );
    });

    it('should block deletion of materially worked case', async () => {
      prisma.caseComment.count.mockResolvedValue(2);
      await expect(
        service.softDeleteCase(mockActor, 'case-001', 'test'),
      ).rejects.toThrow(ValidationDomainError);
    });

    it('should reject deletion of already-deleted case', async () => {
      prisma.case.findUnique.mockResolvedValue({ ...mockCase, deletedAt: new Date() });
      await expect(
        service.softDeleteCase(mockActor, 'case-001', 'test'),
      ).rejects.toThrow(ValidationDomainError);
    });

    it('should reject deletion of nonexistent case', async () => {
      prisma.case.findUnique.mockResolvedValue(null);
      await expect(
        service.softDeleteCase(mockActor, 'nonexistent', 'test'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // R14: Title/description history events
  describe('updateCase history (R14)', () => {
    it('should audit title change', async () => {
      await service.updateCase(mockActor, 'case-001', { title: 'New Title' });
      expect(prisma.caseHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'title', previousValue: 'Test support case', newValue: 'New Title' }),
        }),
      );
    });

    it('should audit description change', async () => {
      await service.updateCase(mockActor, 'case-001', { description: 'Updated desc' });
      expect(prisma.caseHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'description' }),
        }),
      );
    });

    it('should audit priority change', async () => {
      await service.updateCase(mockActor, 'case-001', { priority: 'HIGH' });
      expect(prisma.caseHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'priority', previousValue: 'MEDIUM', newValue: 'HIGH' }),
        }),
      );
    });
  });
});
