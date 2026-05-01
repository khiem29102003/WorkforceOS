import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Job, Worker } from "bullmq";
import { createStructuredLogger } from "../../observability/logger";
import { RedisService } from "../../cache/redis.service";
import type { EmailNotificationJob } from "../queue.types";

@Injectable()
export class EmailNotificationProcessor implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<EmailNotificationJob>;
  private readonly logger = createStructuredLogger();

  constructor(private readonly redis: RedisService) {}

  onModuleInit(): void {
    this.worker = new Worker<EmailNotificationJob>(
      "email-notifications",
      async (job: Job<EmailNotificationJob>) => {
        this.logger.info("email.queued", {
          jobId: job.id,
          tenantId: job.data.tenantId,
          recipientUserId: job.data.recipientUserId,
          template: job.data.template
        });
      },
      { connection: this.redis.connection, concurrency: 10 }
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}

