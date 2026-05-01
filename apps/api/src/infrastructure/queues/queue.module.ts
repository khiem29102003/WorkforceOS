import { Global, Module } from "@nestjs/common";
import { EmailNotificationProcessor } from "./processors/email-notification.processor";
import { PayrollSyncProcessor } from "./processors/payroll-sync.processor";
import { QueueService } from "./queue.service";

@Global()
@Module({
  providers: [QueueService, EmailNotificationProcessor, PayrollSyncProcessor],
  exports: [QueueService]
})
export class QueueInfrastructureModule {}

