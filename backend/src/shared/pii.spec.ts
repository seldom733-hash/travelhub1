import { RoleCode } from "../generated/prisma/enums";
import { canViewTravelerPii, redactTravelerPii, redactTravelersPii, TRAVELER_PII_FIELDS } from "./pii";

describe("shared/pii — field-level redaction traveler/passenger", () => {
  const traveler = {
    id: "t1",
    firstName: "Иван",
    lastName: "Петров",
    birthDate: new Date("1990-05-01"),
    citizenship: "AZ",
    gender: "male",
    passportNumber: "AB1234567",
    passportExpiry: new Date("2030-01-01"),
    dataCompleteness: "COMPLETE",
  };

  it("OPERATOR и ADMIN видят полные PII", () => {
    expect(canViewTravelerPii(RoleCode.OPERATOR)).toBe(true);
    expect(canViewTravelerPii(RoleCode.ADMIN)).toBe(true);
    expect(redactTravelerPii(traveler, { role: RoleCode.OPERATOR })).toBe(traveler);
    expect(redactTravelerPii(traveler, { role: RoleCode.ADMIN })).toBe(traveler);
  });

  it("остальные staff-роли получают redacted projection (PII → null, имена сохранены)", () => {
    for (const role of [RoleCode.SALES_MANAGER, RoleCode.FINANCE, RoleCode.ANALYST, RoleCode.MARKETER, RoleCode.DIRECTOR, RoleCode.MODERATOR]) {
      const out = redactTravelerPii(traveler, { role });
      expect(out.passportNumber).toBeNull();
      expect(out.passportExpiry).toBeNull();
      expect(out.birthDate).toBeNull();
      expect(out.firstName).toBe("Иван");
      expect(out.lastName).toBe("Петров");
      expect(out.id).toBe("t1");
      expect(out.citizenship).toBe("AZ");
      expect(out.gender).toBe("male");
    }
  });

  it("без зрителя (internal trusted call) данные не трогаются", () => {
    expect(redactTravelerPii(traveler, null)).toBe(traveler);
    expect(redactTravelerPii(traveler, undefined)).toBe(traveler);
  });

  it("не мутирует входные данные", () => {
    const copy = { ...traveler };
    redactTravelerPii(traveler, { role: RoleCode.ANALYST });
    expect(traveler.passportNumber).toBe("AB1234567");
    expect(copy).toEqual(traveler);
  });

  it("redactTravelersPii применяет redaction к каждому элементу массива", () => {
    const rows = [traveler, { ...traveler, id: "t2" }];
    const out = redactTravelersPii(rows, { role: RoleCode.FINANCE });
    expect(out).toHaveLength(2);
    for (const r of out) {
      expect(r.passportNumber).toBeNull();
      expect(r.firstName).toBe("Иван");
    }
  });

  it("список PII-полей покрывает паспортные данные и DOB", () => {
    expect(TRAVELER_PII_FIELDS).toEqual(["passportNumber", "passportExpiry", "birthDate"]);
  });
});
