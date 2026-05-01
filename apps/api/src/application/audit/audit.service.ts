import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditContext, AuditWrite, JsonSnapshot } from "../../core/domain/audit.types";

@Injectable()
export class AuditService {
  async write(tx: Prisma.TransactionClient, context: AuditContext, entry: AuditWrite): Promise<void> {
    await tx.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.actorUserId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        beforeSnapshot: this.snapshot(entry.beforeSnapshot),
        afterSnapshot: this.snapshot(entry.afterSnapshot),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        traceId: context.traceId
      }
    });
  }

  private snapshot(value: unknown): JsonSnapshot {
    if (value === undefined || value === null) {
      return Prisma.JsonNull;
    }
    const json = JSON.stringify(value, (_key: string, nested: unknown) => (typeof nested === "bigint" ? nested.toString() : nested));
    return JSON.parse(json) as Prisma.InputJsonValue;
  }
}
