import { AssignmentService } from "./assignment.service";

function makeTx() {
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: "r1", assignedManagerId: null }]),
    salesManagerProfile: {
      findMany: jest.fn().mockResolvedValue([
        { userId: "u1", participatesInAutoDistribution: true, availability: "AVAILABLE", maxActiveRequests: 5, lastAssignedAt: new Date("2026-01-01") },
        { userId: "u2", participatesInAutoDistribution: true, availability: "AVAILABLE", maxActiveRequests: 5, lastAssignedAt: null },
      ]),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: "u1", fullName: "One", username: "one" },
        { id: "u2", fullName: "Two", username: "two" },
      ]),
    },
    request: {
      groupBy: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    requestHistory: { create: jest.fn().mockResolvedValue({}) },
    userNotification: { create: jest.fn().mockResolvedValue({}) },
  };
  return tx;
}

describe("AssignmentService", () => {
  it("assigns the manager with the oldest lastAssignedAt (Round Robin) and creates notification", async () => {
    const tx = makeTx();
    const prisma: any = { $transaction: (fn: any) => fn(tx) };
    const service = new AssignmentService(prisma);
    const result = await service.assign("r1");
    expect(result.assigned).toBe(true);
    expect((result as any).managerId).toBe("u2");
    expect(tx.request.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assignedManagerId: "u2", assignmentState: "ASSIGNED" }) }));
    expect(tx.requestHistory.create).toHaveBeenCalled();
    expect(tx.userNotification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ recipientId: "u2", type: "REQUEST_ASSIGNED" }) }));
  });

  it("does not reassign an already assigned request", async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([{ id: "r1", assignedManagerId: "u1" }]);
    const prisma: any = { $transaction: (fn: any) => fn(tx) };
    const service = new AssignmentService(prisma);
    await expect(service.assign("r1")).resolves.toEqual({ assigned: false, managerId: "u1" });
    expect(tx.request.update).not.toHaveBeenCalled();
    expect(tx.userNotification.create).not.toHaveBeenCalled();
  });

  it("queues the request and notifies supervisors when no manager is eligible", async () => {
    const tx = makeTx();
    tx.salesManagerProfile.findMany.mockResolvedValue([]);
    tx.userNotification = { create: jest.fn(), upsert: jest.fn().mockResolvedValue({}) };
    const prisma: any = { $transaction: (fn: any) => fn(tx) };
    const service = new AssignmentService(prisma);
    const result = await service.assign("r1");
    expect(result).toEqual({ assigned: false, queued: true, reason: "NO_AVAILABLE_MANAGERS" });
    expect(tx.request.update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { assignmentState: "QUEUED" } });
    expect(tx.userNotification.upsert).toHaveBeenCalled();
  });

  it("reassigns, records history and notifies the new manager", async () => {
    const tx = makeTx();
    tx.request.findUnique = jest.fn().mockResolvedValue({ id: "r1", assignedManagerId: "u1" });
    tx.user.findFirst = jest.fn().mockResolvedValue({ id: "u2", fullName: "Two", username: "two" });
    tx.salesManagerProfile.updateMany = jest.fn().mockResolvedValue({});
    const prisma: any = { $transaction: (fn: any) => fn(tx) };
    const service = new AssignmentService(prisma);
    const result = await service.reassign("r1", "u2", "Перегрузка", { id: "admin", username: "admin" });
    expect(result).toEqual({ ok: true, manager: "Two" });
    expect(tx.request.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assignedManagerId: "u2", assignmentType: "MANUAL" }) }));
    expect(tx.requestHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "REASSIGNED", from: "u1", to: "u2" }) }));
    expect(tx.userNotification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ recipientId: "u2", type: "REQUEST_REASSIGNED" }) }));
  });

  it("queues when every manager reached maxActiveRequests", async () => {
    const tx = makeTx();
    tx.salesManagerProfile.findMany.mockResolvedValue([
      { userId: "u1", participatesInAutoDistribution: true, availability: "AVAILABLE", maxActiveRequests: 1, lastAssignedAt: null },
      { userId: "u2", participatesInAutoDistribution: true, availability: "AVAILABLE", maxActiveRequests: 1, lastAssignedAt: null },
    ]);
    tx.request.groupBy.mockResolvedValue([
      { assignedManagerId: "u1", _count: { _all: 1 } },
      { assignedManagerId: "u2", _count: { _all: 1 } },
    ]);
    tx.userNotification = { create: jest.fn(), upsert: jest.fn().mockResolvedValue({}) };
    const prisma: any = { $transaction: (fn: any) => fn(tx) };
    const service = new AssignmentService(prisma);
    await expect(service.assign("r1")).resolves.toEqual({ assigned: false, queued: true, reason: "ALL_MANAGERS_AT_LIMIT" });
    expect(tx.request.update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { assignmentState: "QUEUED" } });
  });

  it("marks only the current user's unread notification for the opened request", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const requestUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma: any = { userNotification: { updateMany }, request: { updateMany: requestUpdateMany } };
    const service = new AssignmentService(prisma);
    await service.markByEntity("u1", "Request", "r1");
    expect(updateMany).toHaveBeenCalledWith({
      where: { recipientId: "u1", entityType: "Request", entityId: "r1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
