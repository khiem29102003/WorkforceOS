import { PrismaClient, RoleCode } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

const connectionString = process.env["DATABASE_URL"] ?? "postgresql://ewos:ewos@localhost:5432/workforce_os?schema=public";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const permissions = [
  "employees:read",
  "employees:write",
  "salary:write",
  "leave:approve:manager",
  "leave:approve:hr",
  "ai:insights:read",
  "ai:insights:write",
  "audit:read"
] as const;

const rolePermissions: Record<RoleCode, readonly (typeof permissions)[number][]> = {
  ADMIN: permissions,
  HR: ["employees:read", "employees:write", "salary:write", "leave:approve:hr", "audit:read", "ai:insights:read"],
  PM: ["employees:read", "leave:approve:manager", "ai:insights:read"],
  EMPLOYEE: ["employees:read"]
};

async function main(): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Demo Enterprise", slug: "demo" }
  });

  const permissionRecords = await Promise.all(
    permissions.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: `Allows ${key}` }
      })
    )
  );

  const roles = await Promise.all(
    Object.values(RoleCode).map((code) =>
      prisma.role.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code } },
        update: { name: code },
        create: { tenantId: tenant.id, code, name: code }
      })
    )
  );

  for (const role of roles) {
    const permissionKeys = rolePermissions[role.code];
    const permissionKeySet = new Set<string>(permissionKeys);
    const matchedPermissions = permissionRecords.filter((permission) => permissionKeySet.has(permission.key));
    await Promise.all(
      matchedPermissions.map((permission) =>
        prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id }
        })
      )
    );
  }

  const passwordHash = await argon2.hash("123456");
  const demoUsers = [
    { email: "admin@demo.com", name: "Avery Admin", role: RoleCode.ADMIN, employeeNumber: "E-0001", title: "Platform Owner", department: "Operations" },
    { email: "hr@demo.com", name: "Harper HR", role: RoleCode.HR, employeeNumber: "E-0002", title: "People Partner", department: "People" },
    { email: "pm@demo.com", name: "Parker PM", role: RoleCode.PM, employeeNumber: "E-0003", title: "Engineering Manager", department: "Engineering" },
    { email: "employee@demo.com", name: "Emery Employee", role: RoleCode.EMPLOYEE, employeeNumber: "E-0004", title: "Software Engineer", department: "Engineering" }
  ] as const;

  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: demoUser.email } },
      update: { name: demoUser.name },
      create: {
        tenantId: tenant.id,
        email: demoUser.email,
        name: demoUser.name,
        passwordHash
      }
    });

    const role = roles.find((candidate) => candidate.code === demoUser.role);
    if (!role) {
      throw new Error(`Missing role ${demoUser.role}`);
    }

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { tenantId: tenant.id, userId: user.id, roleId: role.id }
    });

    const employee = await prisma.employee.upsert({
      where: { userId: user.id },
      update: {
        title: demoUser.title,
        department: demoUser.department,
        employmentStatus: demoUser.role === RoleCode.EMPLOYEE ? "PROBATION" : "ACTIVE"
      },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        employeeNumber: demoUser.employeeNumber,
        title: demoUser.title,
        department: demoUser.department,
        employmentStatus: demoUser.role === RoleCode.EMPLOYEE ? "PROBATION" : "ACTIVE",
        startDate: new Date("2025-01-06T00:00:00.000Z"),
        probationEndsAt: demoUser.role === RoleCode.EMPLOYEE ? new Date("2026-07-06T00:00:00.000Z") : null
      }
    });

    await prisma.salaryHistory.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee.id,
        annualSalaryCents: BigInt(demoUser.role === RoleCode.ADMIN ? 18000000 : 12000000),
        currency: "USD",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        reason: "Initial compensation baseline"
      }
    });
  }

  const engineeringProject = await prisma.project.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: "CORE" } },
    update: { status: "ACTIVE", healthScore: 78 },
    create: {
      tenantId: tenant.id,
      key: "CORE",
      name: "Workforce Core Platform",
      status: "ACTIVE",
      healthScore: 78,
      startsAt: new Date("2026-01-01T00:00:00.000Z")
    }
  });

  const employees = await prisma.employee.findMany({ where: { tenantId: tenant.id, deletedAt: null } });
  await Promise.all(
    employees.map((employee) =>
      prisma.projectAssignment.upsert({
        where: { projectId_employeeId_startsAt: { projectId: engineeringProject.id, employeeId: employee.id, startsAt: new Date("2026-01-01T00:00:00.000Z") } },
        update: {},
        create: {
          tenantId: tenant.id,
          projectId: engineeringProject.id,
          employeeId: employee.id,
          allocationPercent: employee.department === "Engineering" ? 80 : 20,
          startsAt: new Date("2026-01-01T00:00:00.000Z")
        }
      })
    )
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
