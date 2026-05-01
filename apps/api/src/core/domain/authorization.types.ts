import type { RoleCode } from "@prisma/client";

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  employeeId?: string;
  roles: RoleCode[];
  permissions: string[];
}

