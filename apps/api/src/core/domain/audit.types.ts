import type { Prisma } from "@prisma/client";

export interface AuditContext {
  tenantId: string;
  actorUserId: string;
  traceId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditWrite {
  entityType: string;
  entityId: string;
  action: string;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
}

export type JsonSnapshot = Prisma.InputJsonValue | typeof Prisma.JsonNull;

