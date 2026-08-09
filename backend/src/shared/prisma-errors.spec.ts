/**
 * Unit — shared Prisma P2002 normalization (Phase 1 Step 1.12.1 REVIEW FIX 10).
 * Покрывает оба shape: классический meta.target и driver-adapter
 * driverAdapterError.cause.originalMessage.
 */
import { isUniqueViolation, parseUniqueError, uniqueConstraintNames } from "./prisma-errors";

describe("prisma-errors", () => {
  it("классический shape: meta.target = [constraintName]", () => {
    const err = { code: "P2002", meta: { target: ["PartnerStorefront_slug_key"] } };
    expect(uniqueConstraintNames(err)).toEqual(["PartnerStorefront_slug_key"]);
    expect(isUniqueViolation(err)).toBe(true);
  });

  it("классический shape с несколькими target", () => {
    const err = { code: "P2002", meta: { target: ["PartnerStorefront_partnerId_key", "PartnerStorefront_slug_key"] } };
    expect(uniqueConstraintNames(err)).toEqual(["PartnerStorefront_partnerId_key", "PartnerStorefront_slug_key"]);
  });

  it("driver-adapter shape: имя constraint'а в originalMessage (RU-локализация БД)", () => {
    const err = {
      code: "P2002",
      meta: {
        modelName: "PartnerStorefront",
        driverAdapterError: {
          cause: { originalCode: "23505", originalMessage: 'повторяющееся значение ключа нарушает ограничение уникальности "PartnerStorefront_partnerId_key"' },
        },
      },
    };
    expect(uniqueConstraintNames(err)).toEqual(["PartnerStorefront_partnerId_key"]);
  });

  it("driver-adapter shape с slug-constraint", () => {
    const err = {
      code: "P2002",
      meta: {
        driverAdapterError: {
          cause: { originalMessage: 'duplicate key value violates unique constraint "ProductPublicationChannel_productId_channel_key"' },
        },
      },
    };
    expect(uniqueConstraintNames(err)).toEqual(["ProductPublicationChannel_productId_channel_key"]);
  });

  it("не-P2002 ошибка → пустой список (не маскируем другие ошибки)", () => {
    const err = { code: "P2034", meta: { target: ["x"] } };
    expect(uniqueConstraintNames(err)).toEqual([]);
    expect(isUniqueViolation(err)).toBe(false);
    expect(parseUniqueError(err).code).toBe("P2034");
  });

  it("P2002 без meta → пустой список (безопасный fallback)", () => {
    expect(uniqueConstraintNames({ code: "P2002" })).toEqual([]);
    expect(uniqueConstraintNames(null)).toEqual([]);
    expect(uniqueConstraintNames(undefined)).toEqual([]);
    expect(uniqueConstraintNames("string")).toEqual([]);
  });

  it("P2002 с нестандартным meta (строковый target) → извлекается", () => {
    expect(uniqueConstraintNames({ code: "P2002", meta: { target: "PartnerStorefront_slug_key" } })).toEqual(["PartnerStorefront_slug_key"]);
  });

  it("parseUniqueError возвращает структурированный вид", () => {
    const parsed = parseUniqueError({ code: "P2002", meta: { target: ["Category_slug_key"] } });
    expect(parsed).toEqual({ code: "P2002", constraintNames: ["Category_slug_key"] });
  });
});
