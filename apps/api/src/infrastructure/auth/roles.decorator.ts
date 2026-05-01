import { SetMetadata } from "@nestjs/common";
import type { RoleCode } from "@prisma/client";

export const REQUIRED_ROLES_KEY = "required_roles";

export const Roles = (...roles: RoleCode[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);

