import { describe, expect, it } from "@jest/globals";
import {
  PROFILE_FORBIDDEN_KEYS,
  REGISTER_FORBIDDEN_KEYS,
  assertNoForbiddenKeys,
  findForbiddenKeys,
  normalizeEmail,
} from "./field-validation";
import { ValidationDomainError } from "./errors";

describe("field-validation (Step 1.9 — anti mass-assignment / role injection)", () => {
  it("normalizeEmail: trim + lowercase (deterministic CRM link key)", () => {
    expect(normalizeEmail("  Buyer@Example.COM ")).toBe("buyer@example.com");
    expect(normalizeEmail("test@test.local")).toBe("test@test.local");
  });

  it("register: role/partnerId/customerId/status/permissions запрещены", () => {
    expect(findForbiddenKeys({ email: "b@t.local", password: "x".repeat(8) }, REGISTER_FORBIDDEN_KEYS)).toEqual([]);
    expect(findForbiddenKeys({ role: "ADMIN" }, REGISTER_FORBIDDEN_KEYS)).toEqual(["role"]);
    expect(findForbiddenKeys({ roleCode: "PARTNER" }, REGISTER_FORBIDDEN_KEYS)).toEqual(["roleCode"]);
    expect(findForbiddenKeys({ partnerId: "PAR-123" }, REGISTER_FORBIDDEN_KEYS)).toEqual(["partnerId"]);
    expect(findForbiddenKeys({ customerId: "CUS-123" }, REGISTER_FORBIDDEN_KEYS)).toEqual(["customerId"]);
    expect(findForbiddenKeys({ status: "ACTIVE" }, REGISTER_FORBIDDEN_KEYS)).toEqual(["status"]);
    expect(findForbiddenKeys({ permissions: ["admin"] }, REGISTER_FORBIDDEN_KEYS)).toEqual(["permissions"]);
    // null/скалярное тело — не объект → нет запрещённых ключей.
    expect(findForbiddenKeys(null, REGISTER_FORBIDDEN_KEYS)).toEqual([]);
    expect(findForbiddenKeys("str", REGISTER_FORBIDDEN_KEYS)).toEqual([]);
    expect(findForbiddenKeys([1, 2], REGISTER_FORBIDDEN_KEYS)).toEqual([]);
  });

  it("profile: role/permissions/partnerId/customerId/status/userId/username/password запрещены", () => {
    expect(findForbiddenKeys({ fullName: "New Name" }, PROFILE_FORBIDDEN_KEYS)).toEqual([]);
    expect(findForbiddenKeys({ customerId: "CUS-999" }, PROFILE_FORBIDDEN_KEYS)).toEqual(["customerId"]);
    expect(findForbiddenKeys({ partnerId: "PAR-999" }, PROFILE_FORBIDDEN_KEYS)).toEqual(["partnerId"]);
    expect(findForbiddenKeys({ userId: "u-1" }, PROFILE_FORBIDDEN_KEYS)).toEqual(["userId"]);
    expect(findForbiddenKeys({ username: "hacker" }, PROFILE_FORBIDDEN_KEYS)).toEqual(["username"]);
    expect(findForbiddenKeys({ password: "hacked" }, PROFILE_FORBIDDEN_KEYS)).toEqual(["password"]);
    expect(findForbiddenKeys({ role: "ADMIN", status: "ACTIVE" }, PROFILE_FORBIDDEN_KEYS)).toEqual(["role", "status"]);
  });

  it("assertNoForbiddenKeys бросает ValidationDomainError (422) при запрещённых полях", () => {
    expect(() => assertNoForbiddenKeys({ role: "ADMIN" }, REGISTER_FORBIDDEN_KEYS)).toThrow(ValidationDomainError);
    expect(() => assertNoForbiddenKeys({ fullName: "ok" }, PROFILE_FORBIDDEN_KEYS)).not.toThrow();
  });
});
