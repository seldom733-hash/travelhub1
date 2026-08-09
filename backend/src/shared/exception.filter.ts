import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { DomainError } from "./errors";
import { getRequestContext } from "./request-context";

/**
 * Step 1.15 §10 — error boundary: каждый ответ (включая ошибки) несёт
 * канонический `X-Request-Id` header + requestId в теле, чтобы клиент мог
 * связать ошибку с server logs без stack/internal leakage. Логи НЕ содержат
 * Authorization/cookies/password/tokens/contact values/raw body/traveler PII.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const requestId = getRequestContext()?.requestId ?? null;
    if (requestId) res.setHeader("X-Request-Id", requestId);

    const withRequestId = (payload: Record<string, unknown>) =>
      requestId ? { ...payload, requestId } : payload;

    if (exception instanceof DomainError) {
      res.status(exception.httpStatus).json(
        withRequestId({
          statusCode: exception.httpStatus,
          message: exception.message,
        }),
      );
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        res.status(status).json(withRequestId({ statusCode: status, message: body }));
      } else {
        res.status(status).json(withRequestId(body as Record<string, unknown>));
      }
      return;
    }

    // Неизвестная ошибка — логируем (только message, без raw exception/data),
    // клиенту отдаём 500 без деталей.
    const message = exception instanceof Error ? exception.message : String(exception);
    console.error("[Unhandled]", requestId ? `requestId=${requestId}` : "", message);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      withRequestId({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      }),
    );
  }
}
