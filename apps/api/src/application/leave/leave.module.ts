import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { LeaveController } from "./leave.controller";
import { LeaveWorkflowService } from "./leave-workflow.service";

@Module({
  imports: [AuditModule],
  controllers: [LeaveController],
  providers: [LeaveWorkflowService]
})
export class LeaveModule {}

