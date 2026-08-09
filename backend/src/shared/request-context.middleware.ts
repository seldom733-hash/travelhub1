import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { createRequestId, isValidRequestId, runWithRequestContext } from "./request-context";

/**
 * PHASE 1 STEP 1.15 §5 — HTTP boundary.
 *
 * Каждый HTTP request получает server-authoritative request context ДО
 * controller/service execution:
 *
 *  - requestId: принимаем заголовок `X-Request-Id` ТОЛЬКО если это валидный
 *    UUID v4 (ограничение длины/символов исключает log injection, oversized,
 *    control characters). Валидный client UUID — documented diagnostic contract
 *    (см. ADR-0009, api.md): он ЭХО-отражается как requestId запроса (клиент
 *    может связать свои логи с серверными). При отсутствии/невалидности/дубликате —
 *    генерируем server-side UUID.
 *  - correlationId: для корневого HTTP flow — ВСЕГДА server-authoritative UUID,
 *    НЕ client-supplied. Это гарантирует: повтор одного client `X-Request-Id` в
 *    двух независимых requests НЕ сливает их в одну causal chain (ADR-0009 §2).
 *    Без client X-Request-Id correlationId == requestId (один server UUID).
 *    Произвольный client `X-Correlation-Id` НЕ принимается (Step 1.15 §5):
 *    сервер сам назначает correlation.
 *  - causationId: null (корневой HTTP flow не является child-операцией).
 *
 * Response: канонический заголовок `X-Request-Id` (diagnostic ID контракт).
 * Public anonymous endpoints тоже получают requestId.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const clientRequestId = req.headers["x-request-id"];
    // Дубликат/массив заголовков (или невалидный) → не доверяем, генерируем сами.
    const acceptedClientId = typeof clientRequestId === "string" && isValidRequestId(clientRequestId) ? clientRequestId : null;
    const serverCorrelationId = createRequestId();
    // requestId: client UUID эхо (diagnostic) ИЛИ server UUID.
    // correlationId: ВСЕГДА server-generated (инвариант: client UUID НИКОГДА
    // не становится correlation). Без client ID requestId == serverCorrelationId.
    const requestId = acceptedClientId ?? serverCorrelationId;

    res.setHeader("X-Request-Id", requestId);

    // actor: null до аутентификации — JwtAuthGuard (внутри ALS-scope запроса)
    // выставит {type:"USER", id} через setRequestActor (Step 1.15A §10);
    // public-эндпоинты остаются с actor=null (UNKNOWN — честно, без backfill).
    runWithRequestContext(
      { requestId, correlationId: serverCorrelationId, causationId: null, actor: null },
      () => {
        next();
      },
    );
  }
}
