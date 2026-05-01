const apiUrl = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

export interface DashboardMetric {
  label: string;
  value: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
}

export interface DashboardSummary {
  degraded: boolean;
  metrics: DashboardMetric[];
  leaveQueue: Array<{
    id: string;
    employee: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    step: string;
    timeline: Array<{
      label: "Employee" | "Manager" | "HR" | "Done";
      status: "done" | "current" | "waiting" | "rejected";
    }>;
  }>;
  riskSignals: Array<{
    id: string;
    label: string;
    severity: "info" | "warning" | "critical";
  }>;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    const response = await fetch(`${apiUrl}/dashboard`, {
      next: { revalidate: 30 },
      headers: { accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`Dashboard request failed: ${response.status}`);
    }
    return (await response.json()) as DashboardSummary;
  } catch {
    return {
      degraded: true,
      metrics: [
        { label: "Active employees", value: "248", delta: "+6 this month", tone: "good" },
        { label: "Pending approvals", value: "17", delta: "5 aging", tone: "warn" },
        { label: "Payroll sync SLA", value: "99.4%", delta: "last 30 days", tone: "neutral" },
        { label: "Burnout risk", value: "Medium", delta: "3 teams flagged", tone: "warn" }
      ],
      leaveQueue: [
        {
          id: "LR-1042",
          employee: "Emery Employee",
          status: "PENDING",
          step: "Manager approval",
          timeline: [
            { label: "Employee", status: "done" },
            { label: "Manager", status: "current" },
            { label: "HR", status: "waiting" },
            { label: "Done", status: "waiting" }
          ]
        },
        {
          id: "LR-1041",
          employee: "Nolan Nguyen",
          status: "PENDING",
          step: "HR approval",
          timeline: [
            { label: "Employee", status: "done" },
            { label: "Manager", status: "done" },
            { label: "HR", status: "current" },
            { label: "Done", status: "waiting" }
          ]
        }
      ],
      riskSignals: [
        { id: "RS-1", label: "Engineering weekly load above 42h average", severity: "warning" },
        { id: "RS-2", label: "Payroll outbox retry backlog is empty", severity: "info" }
      ]
    };
  }
}
