import { randomUUID } from "node:crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import type { RequestWithAuth } from "../../interfaces/http/request-with-auth";
import { createStructuredLogger } from "./logger";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = createStructuredLogger();

  use(req: RequestWithAuth, res: Response, next: NextFunction): void {
    const startedAt = Date.now();
    const incomingTraceId = req.header("x-trace-id");
    const traceId = incomingTraceId && incomingTraceId.length <= 128 ? incomingTraceId : randomUUID();
    req.traceId = traceId;
    res.setHeader("x-trace-id", traceId);
    res.on("finish", () => {
      this.logger.info("http.request_completed", {
        traceId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        actorUserId: req.user?.userId,
        tenantId: req.user?.tenantId
      });
    });
    next();
  }
}
