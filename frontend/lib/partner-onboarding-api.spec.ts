import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { partnerOnboardingApi } from "./partner-onboarding-api";

/** Лёгкий mock fetch: возвращает { json: async () => body } и запоминает вызовы. */
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

describe("partnerOnboardingApi (Step 1.10)", () => {
  it("register: POST /auth/partner-register с полями заявки, БЕЗ role/partnerId/status", async () => {
    await partnerOnboardingApi.register({
      email: "p@test.local",
      password: "partnerpass123",
      applicantType: "COMPANY",
      brandName: "Travel Co",
      country: "AZ",
      registrationNumber: "REG-1",
      termsAccepted: true,
    });
    expect(lastRequest?.url).toBe("/api/v1/auth/partner-register");
    expect(lastRequest?.init?.method).toBe("POST");
    const body = bodyOf();
    expect(body.email).toBe("p@test.local");
    expect(body.applicantType).toBe("COMPANY");
    expect(body.termsAccepted).toBe(true);
    expect(body).not.toHaveProperty("role");
    expect(body).not.toHaveProperty("partnerId");
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("customerId");
  });

  it("own application: GET/PATCH/submit на правильных путях", async () => {
    await partnerOnboardingApi.getOwnApplication();
    expect(lastRequest?.url).toBe("/api/v1/partner/application");

    await partnerOnboardingApi.updateOwnApplication({ brandName: "New Brand", country: "GE", version: 3 });
    expect(lastRequest?.url).toBe("/api/v1/partner/application");
    expect(lastRequest?.init?.method).toBe("PATCH");
    expect(bodyOf().version).toBe(3);
    expect(bodyOf().brandName).toBe("New Brand");
    expect(bodyOf()).not.toHaveProperty("partnerId");
    expect(bodyOf()).not.toHaveProperty("status");

    await partnerOnboardingApi.submitOwnApplication();
    expect(lastRequest?.url).toBe("/api/v1/partner/application/submit");
  });

  it("review queue: фильтры попадают в query; action-эндпоинты с id", async () => {
    await partnerOnboardingApi.listReviewQueue({ status: "SUBMITTED", search: "travel", page: 2 });
    expect(lastRequest?.url).toContain("/api/v1/partner/onboarding/review?");
    expect(lastRequest?.url).toContain("status=SUBMITTED");
    expect(lastRequest?.url).toContain("search=travel");
    expect(lastRequest?.url).toContain("page=2");

    await partnerOnboardingApi.startReview("app-1");
    expect(lastRequest?.url).toBe("/api/v1/partner/onboarding/review/app-1/start");

    await partnerOnboardingApi.approve("app-1", "Документы ок");
    expect(lastRequest?.url).toBe("/api/v1/partner/onboarding/review/app-1/approve");
    expect(bodyOf().reason).toBe("Документы ок");

    await partnerOnboardingApi.reject("app-1", "Нет лицензии");
    expect(lastRequest?.url).toBe("/api/v1/partner/onboarding/review/app-1/reject");

    await partnerOnboardingApi.requestChanges("app-1", "Уточните страну");
    expect(lastRequest?.url).toBe("/api/v1/partner/onboarding/review/app-1/request-changes");
  });
});
