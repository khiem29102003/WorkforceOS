import type { Request } from "express";
import type { AuthenticatedUser } from "../../core/domain/authorization.types";

export interface RequestWithAuth extends Request {
  user?: AuthenticatedUser;
  traceId?: string;
}

