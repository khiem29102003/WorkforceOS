import { describe, expect, it } from "vitest";
import { submitLeaveRequestSchema } from "./leave";

const validRequest = {
  tenantId: "4e7b8d80-03c7-4dbf-bd0b-7614e3e7827d",
  employeeId: "2e31f7ea-39a5-41a9-9af3-d9d79ceafec4",
  actorUserId: "50b44d5b-2778-460d-bd06-af401a895c51",
  traceId: "11111111-1111-4111-8111-111111111111",
  reason: "Planned annual leave",
  startsAt: "2026-05-10T00:00:00.000Z",
  endsAt: "2026-05-12T00:00:00.000Z"
};

describe("submitLeaveRequestSchema", () => {
  it("accepts a valid leave request window", () => {
    expect(submitLeaveRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("rejects an inverted leave request window", () => {
    const parsed = submitLeaveRequestSchema.safeParse({
      ...validRequest,
      startsAt: "2026-05-12T00:00:00.000Z",
      endsAt: "2026-05-10T00:00:00.000Z"
    });
    expect(parsed.success).toBe(false);
  });
});

