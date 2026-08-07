import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { DomainError } from "./errors";

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof DomainError) {
      res.status(exception.httpStatus).json({
        statusCode: exception.httpStatus,
        message: exception.message,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        res.status(status).json({ statusCode: status, message: body });
      } else {
        res.status(status).json(body);
      }
      return;
    }

    // Неизвестная ошибка — логируем, клиенту отдаём 500 без деталей.
    console.error("[Unhandled]", exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
}
