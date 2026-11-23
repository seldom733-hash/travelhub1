/**
 * E2E close-guard test on the main database.
 * Requires backend on http://127.0.0.1:4000 and admin credentials.
 */
const API = process.env.E2E_API ?? "http://127.0.0.1:4000/api/v1";
const ADMIN = process.env.E2E_ADMIN ?? "admin";
const PASSWORD = process.env.E2E_PASSWORD ?? "admin123";

async function token() {
  const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: ADMIN, password: PASSWORD }) });
  const body: any = await res.json();
  if (!res.ok) throw new Error(`login failed: ${JSON.stringify(body)}`);
  return body.accessToken as string;
}

async function api(path: string, init: RequestInit = {}) {
  const t = await token();
  return fetch(`${API}${path}`, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${t}`, ...(init.headers ?? {}) } });
}

describe("cancellation close guard (main DB e2e)", () => {
  jest.setTimeout(30000);

  it("blocks closing a cancelled order while approval is pending", async () => {
    const list = await api("/finance/deals?state=cancelled&pageSize=20");
    const deals: any = await list.json();
    const deal = (deals.items ?? []).find((d: any) => d.orderId);
    if (!deal) return;

    const pending = await api(`/orders/${deal.orderId}/cancellation/approval`);
    const pendingText = await pending.text();
    const approval: any = pendingText ? JSON.parse(pendingText) : null;
    if (!approval || approval.status !== "PENDING") {
      const submitted = await api(`/orders/${deal.orderId}/cancellation/submit`, {
        method: "POST",
        body: JSON.stringify({
          cancellationReason: "CUSTOMER_FAULT",
          clientPenaltyAmount: "0",
          supplierPenaltyAmount: "0",
          penaltyAmount: "0",
          platformPenaltyShare: "0",
          supplierPenaltyShare: "0",
          reason: "E2E close guard",
        }),
      });
      expect(submitted.ok).toBe(true);
    }

    const close = await api(`/orders/${deal.orderId}`, { method: "PATCH", body: JSON.stringify({ action: "close" }) });
    expect(close.status).toBe(409);
    const body: any = await close.json();
    expect(body.message).toMatch(/cannot be completed\/closed/i);
    expect(body.message).toMatch(/approval=PENDING|debt|refund/i);
  });

  it("requires a pending cancellation approval", async () => {
    const list = await api("/finance/deals?state=cancelled&pageSize=20");
    const deals: any = await list.json();
    const candidate = (deals.items ?? []).find((d: any) => d.orderId);
    if (!candidate) return;

    const approval = await api(`/orders/${candidate.orderId}/cancellation/approval`);
    if (approval.ok) {
      const body: any = await approval.json();
      if (body?.status === "PENDING") return; // already covered by another fixture
    }

    const res = await api(`/orders/${candidate.orderId}/cancellation/approve`, { method: "POST", body: "{}" });
    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body.message).toMatch(/pending cancellation approval/i);
  });
});
