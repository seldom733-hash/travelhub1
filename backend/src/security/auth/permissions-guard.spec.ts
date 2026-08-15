import { describe, expect, it } from "@jest/globals";
import { ForbiddenException } from "@nestjs/common";
import { PermissionsGuard } from "./permissions.guard";
import { PERMISSIONS_KEY } from "./decorators";
import type { AuthedRequest } from "./jwt-auth.guard";

/**
 * Step 2.17 §19 — PermissionsGuard FAIL-CLOSED:
 *  - required permission + missing user → deny (ранее тихий no-op);
 *  - public route без permission metadata → public (без изменений);
 *  - authenticated user без права → deny;
 *  - пустой список required → true.
 */
function makeGuard(metadata: unknown) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(metadata),
  } as unknown as { getAllAndOverride: (...args: unknown[]) => unknown };
  return new PermissionsGuard(reflector as never);
}

function makeContext(user: AuthedRequest["user"] | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;
}

describe("PermissionsGuard fail-closed (Step 2.17 §19)", () => {
  it("required permission + missing user → DENY (ForbiddenException), не тихий no-op", () => {
    const guard = makeGuard(["order.read"]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it("public route без permission metadata → true (public остаётся public)", () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it("authenticated user БЕЗ права → deny", () => {
    const guard = makeGuard(["order.read"]);
    const noRight = { permissions: ["catalog.product.read"] } as unknown as AuthedRequest["user"];
    expect(() => guard.canActivate(makeContext(noRight))).toThrow(ForbiddenException);
  });

  it("authenticated user С правом → true", () => {
    const guard = makeGuard(["order.read"]);
    const withRight = { permissions: ["order.read"] } as unknown as AuthedRequest["user"];
    expect(guard.canActivate(makeContext(withRight))).toBe(true);
  });

  it("пустой список required: authenticated → true; без user → deny (fail-closed: метаданные прав = permission-route)", () => {
    const guard = makeGuard([]);
    const withUser = { permissions: [] } as unknown as AuthedRequest["user"];
    expect(guard.canActivate(makeContext(withUser))).toBe(true);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it("resolver-метаданные вызываются с request (per-content проверки)", () => {
    const resolver = jest.fn().mockReturnValue(["order.read"]);
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(resolver),
    } as unknown as { getAllAndOverride: (...args: unknown[]) => unknown };
    const guard = new PermissionsGuard(reflector as never);
    const user = { permissions: ["order.read"] } as unknown as AuthedRequest["user"];
    expect(guard.canActivate(makeContext(user))).toBe(true);
    expect(resolver).toHaveBeenCalled();
  });
});
