import { ForbiddenException } from "@nestjs/common";
import { CatalogAccessPolicy } from "./catalog-access.policy";
import { RoleCode } from "../../generated/prisma/enums";
import type { AuthUser } from "../../security/auth/auth.service";

const PARTNER: AuthUser = {
  id: "u-partner",
  code: "USR-00000009",
  username: "partner1",
  email: null,
  fullName: null,
  status: "ACTIVE",
  role: RoleCode.PARTNER,
  roleTitle: "Партнёр",
  partnerId: "par-1",
  customerId: null,
  permissions: [
    "catalog.product.read_own",
    "catalog.product.create_own",
    "catalog.product.update_own_draft",
    "catalog.media.upload_own",
    "catalog.media.update_own",
    "catalog.media.delete_own",
    "catalog.media.reorder_own",
    "catalog.media.set_primary_own",
  ],
};

const OTHER_PARTNER: AuthUser = { ...PARTNER, id: "u-partner-2", username: "partner2", partnerId: "par-2" };
const MODERATOR: AuthUser = {
  id: "u-mod",
  code: "USR-00000006",
  username: "mod1",
  email: null,
  fullName: null,
  status: "ACTIVE",
  role: RoleCode.MODERATOR,
  roleTitle: "Модератор",
  partnerId: null,
  customerId: null,
  permissions: ["catalog.product.read_for_moderation", "catalog.media.read_for_moderation"],
};
const ADMIN: AuthUser = {
  id: "u-admin",
  code: "USR-00000001",
  username: "admin",
  email: null,
  fullName: null,
  status: "ACTIVE",
  role: RoleCode.ADMIN,
  roleTitle: "Администратор",
  partnerId: null,
  customerId: null,
  permissions: ["catalog.product.write", "catalog.media.upload_own"],
};
/** Staff роль без прав PARTNER/media и без read_for_moderation. */
const STAFF_NO_PERM: AuthUser = { ...ADMIN, id: "u-op", username: "operator", role: RoleCode.OPERATOR, permissions: [] };

const policy = new CatalogAccessPolicy();

describe("CatalogAccessPolicy — PARTNER object scope (Step 1.3)", () => {
  describe("partnerScopeOf", () => {
    it("PARTNER возвращает свой partnerId", () => {
      expect(policy.partnerScopeOf(PARTNER)).toBe("par-1");
    });
    it("PARTNER без partnerId → null (missing partner context → нет scope)", () => {
      expect(policy.partnerScopeOf({ ...PARTNER, partnerId: null })).toBeNull();
    });
    it("staff/ADMIN/undefined → null (без object scope)", () => {
      expect(policy.partnerScopeOf(MODERATOR)).toBeNull();
      expect(policy.partnerScopeOf(ADMIN)).toBeNull();
      expect(policy.partnerScopeOf(undefined)).toBeNull();
    });
  });

  describe("isOwner", () => {
    it("PARTNER own product → true", () => {
      expect(policy.isOwner(PARTNER, "par-1")).toBe(true);
    });
    it("PARTNER чужой product → false", () => {
      expect(policy.isOwner(PARTNER, "par-2")).toBe(false);
    });
    it("unowned product (partnerId null) не принадлежит PARTNER", () => {
      expect(policy.isOwner(PARTNER, null)).toBe(false);
    });
  });

  describe("manage (write)", () => {
    it("PARTNER own → allow", () => {
      expect(() => policy.assertCanManage(PARTNER, "par-1", "catalog.media.upload_own")).not.toThrow();
    });
    it("PARTNER other → deny (403)", () => {
      expect(() => policy.assertCanManage(PARTNER, "par-2", "catalog.media.upload_own")).toThrow(ForbiddenException);
    });
    it("PARTNER без permission → deny, даже для своего продукта", () => {
      expect(() => policy.assertCanManage(PARTNER, "par-1", "catalog.product.publish")).toThrow(ForbiddenException);
    });
    it("MODERATOR write → deny (даже с moderation read)", () => {
      expect(() => policy.assertCanManage(MODERATOR, "par-1", "catalog.media.upload_own")).toThrow(ForbiddenException);
      expect(policy.canManage(MODERATOR, "par-1")).toBe(false);
    });
    it("ADMIN с explicit permission → allow; без permission → deny", () => {
      expect(() => policy.assertCanManage(ADMIN, "par-2", "catalog.media.upload_own")).not.toThrow();
      expect(() => policy.assertCanManage(ADMIN, "par-2", "catalog.media.delete_own")).toThrow(ForbiddenException);
    });
    it("staff без прав → deny", () => {
      expect(() => policy.assertCanManage(STAFF_NO_PERM, "par-1", "catalog.media.upload_own")).toThrow(ForbiddenException);
    });
  });

  describe("read", () => {
    it("PARTNER own → allow", () => {
      expect(policy.canRead(PARTNER, "par-1")).toBe(true);
    });
    it("PARTNER other → deny", () => {
      expect(policy.canRead(PARTNER, "par-2")).toBe(false);
      expect(() => policy.assertCanRead(PARTNER, "par-2")).toThrow(ForbiddenException);
    });
    it("MODERATOR moderation read → allow", () => {
      expect(policy.canRead(MODERATOR, "par-1")).toBe(true);
      expect(policy.canRead(MODERATOR, "par-2")).toBe(true);
    });
    it("MODERATOR без read_for_moderation → deny", () => {
      const noModRead: AuthUser = { ...MODERATOR, permissions: [] };
      expect(policy.canRead(noModRead, "par-1")).toBe(false);
    });
    it("staff с catalog.product.read → allow", () => {
      const staff: AuthUser = { ...STAFF_NO_PERM, permissions: ["catalog.product.read"] };
      expect(policy.canRead(staff, "par-1")).toBe(true);
    });
    it("missing partner context (PARTNER без partnerId) → deny чужой", () => {
      const noCtx: AuthUser = { ...PARTNER, partnerId: null };
      expect(policy.canRead(noCtx, "par-1")).toBe(false);
    });
    it("actor undefined (внутренний вызов) → read разрешён", () => {
      expect(() => policy.assertCanRead(undefined, "par-1")).not.toThrow();
    });
  });

  describe("productListScope", () => {
    it("PARTNER → WHERE partnerId = actor.partnerId (server-side)", () => {
      expect(policy.productListScope(PARTNER)).toEqual({ partnerId: "par-1" });
    });
    it("staff/ADMIN/MODERATOR → без scope (полный внутренний read)", () => {
      expect(policy.productListScope(ADMIN)).toEqual({});
      expect(policy.productListScope(MODERATOR)).toEqual({});
    });
    it("undefined → без scope", () => {
      expect(policy.productListScope(undefined)).toEqual({});
    });
  });
});
