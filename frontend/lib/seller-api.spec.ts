import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sellerApi } from "./seller-api";

const fetchMock = vi.fn();
let lastRequest: { url: string; init: RequestInit | undefined } | null = null;

beforeEach(() => {
  lastRequest = null;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    lastRequest = { url, init };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const bodyOf = () => (lastRequest?.init?.body ? JSON.parse(String(lastRequest.init.body)) : undefined);

describe("sellerApi (Step 1.11)", () => {
  it("own profile: GET /partner/seller-profile", async () => {
    await sellerApi.getOwnProfile();
    expect(lastRequest?.url).toBe("/api/v1/partner/seller-profile");
  });

  it("proposal: create/submit НЕ отправляют visibilityMode (сервер контролирует)", async () => {
    await sellerApi.createProposal({ publicDisplayName: "Alias", publicDescription: "Описание" });
    expect(lastRequest?.url).toBe("/api/v1/partner/seller-profile/proposals");
    expect(lastRequest?.init?.method).toBe("POST");
    const body = bodyOf();
    expect(body.publicDisplayName).toBe("Alias");
    expect(body).not.toHaveProperty("visibilityMode");
    expect(body).not.toHaveProperty("requestedVisibilityMode");
    expect(body).not.toHaveProperty("status");

    await sellerApi.submitProposal("prop-1");
    expect(lastRequest?.url).toBe("/api/v1/partner/seller-profile/proposals/prop-1/submit");
  });

  it("moderator: queue + approve alias/brand + reject + hide на правильных путях", async () => {
    await sellerApi.listProposals({ status: "SUBMITTED" });
    expect(lastRequest?.url).toContain("/api/v1/seller-profiles/proposals?");
    expect(lastRequest?.url).toContain("status=SUBMITTED");

    await sellerApi.approve("prop-1", "PUBLIC_BRAND");
    expect(lastRequest?.url).toBe("/api/v1/seller-profiles/proposals/prop-1/approve");
    expect(bodyOf().approvedVisibilityMode).toBe("PUBLIC_BRAND");

    await sellerApi.reject("prop-1", "DISINTERMEDIATION_ATTEMPT", "контакт");
    expect(lastRequest?.url).toBe("/api/v1/seller-profiles/proposals/prop-1/reject");
    expect(bodyOf().reasonCode).toBe("DISINTERMEDIATION_ATTEMPT");

    await sellerApi.requestChanges("prop-1", "INSUFFICIENT_INFO");
    expect(lastRequest?.url).toBe("/api/v1/seller-profiles/proposals/prop-1/request-changes");

    await sellerApi.hide("par-1");
    expect(lastRequest?.url).toBe("/api/v1/seller-profiles/par-1/hide");
    await sellerApi.unhide("par-1");
    expect(lastRequest?.url).toBe("/api/v1/seller-profiles/par-1/unhide");
  });
});
