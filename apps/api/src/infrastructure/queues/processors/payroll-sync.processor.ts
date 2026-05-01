import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Job, Worker } from "bullmq";
import { PrismaService } from "../../database/prisma.service";
import { createStructuredLogger } from "../../observability/logger";
import { RedisService } from "../../cache/redis.service";
import type { PayrollSyncJob } from "../queue.types";

@Injectable()
export class PayrollSyncProcessor implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<PayrollSyncJob>;
  private readonly logger = createStructuredLogger();

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<PayrollSyncJob>(
      "payroll-sync",
      async (job: Job<PayrollSyncJob>) => {
        const outbox = await this.prisma.outboxEvent.findUnique({ where: { id: job.data.outboxEventId } });
        if (!outbox || outbox.status === "PROCESSED") {
          return;
        }

        await this.prisma.outboxEvent.update({
          where: { id: job.data.outboxEventId },
          data: { status: "PROCESSING", attempts: { increment: 1 } }
        });

        this.logger.info("payroll.sync.requested", {
          jobId: job.id,
          tenantId: job.data.tenantId,
          leaveRequestId: job.data.leaveRequestId,
          idempotencyKey: job.data.idempotencyKey
        });

        await this.prisma.outboxEvent.update({
          where: { id: job.data.outboxEventId },
          data: { status: "PROCESSED", processedAt: new Date(), lastError: null }
        });
      },
      { connection: this.redis.connection, concurrency: 5 }
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}

