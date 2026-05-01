import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EmployeeController } from "./employee.controller";
import { EmployeeService } from "./employee.service";

@Module({
  imports: [AuditModule],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService]
})
export class EmployeeModule {}

