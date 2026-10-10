import { describe, expect, it, jest } from "@jest/globals";
import { ArgumentsHost, HttpStatus } from "@nestjs/common";
import { AppExceptionFilter } from "./exception.filter";
import { ConflictError, DomainError } from "./errors";

function hostMock(): { res: { setHeader: jest.Mock; status: jest.Mock; json: jest.Mock }; host: ArgumentsHost } {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const setHeader = jest.fn();
  const res = { setHeader, status, json };
  const host = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { res, host };
}

describe("AppExceptionFilter", () => {
  it("DomainError → его httpStatus", () => {
    const { res, host } = hostMock();
    new AppExceptionFilter().catch(new ConflictError("nope"), host);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, message: "nope" }));
  });

  it("M5: WhatsAppLeaseError (по name) → 409, не 500", () => {
    const { res, host } = hostMock();
    const error = Object.assign(new Error("lease lost — self-fencing"), {
      name: "WhatsAppLeaseError",
    });
    new AppExceptionFilter().catch(error, host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, message: expect.stringContaining("lease lost") }),
    );
  });

  it("неизвестная ошибка → 500 без деталей", () => {
    const { res, host } = hostMock();
    new AppExceptionFilter().catch(new Error("boom"), host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: "Internal server error" }),
    );
  });

  it("DomainError с кастомным статусом сохраняет статус", () => {
    const { res, host } = hostMock();
    new AppExceptionFilter().catch(new DomainError("disabled", 503), host);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
