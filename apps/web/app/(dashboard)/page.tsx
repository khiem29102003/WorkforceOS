import { AlertTriangle, CheckCircle2, Clock3, Circle, XCircle, Users } from "lucide-react";
import { getDashboardSummary } from "@/lib/api";

const metricIcons = [Users, Clock3, CheckCircle2, AlertTriangle] as const;
const timelineClass = {
  done: "border-primary bg-primary text-primary-foreground",
  current: "border-accent bg-accent text-accent-foreground",
  waiting: "border-border bg-background text-muted-foreground",
  rejected: "border-destructive bg-destructive text-destructive-foreground"
} as const;

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <div className="space-y-6">
      {summary.degraded ? (
        <div className="rounded-md border border-accent bg-accent/10 p-4" role="status">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-medium">Backend unavailable, showing demo fallback data</p>
              <p className="mt-1 text-sm text-muted-foreground">The dashboard keeps a graceful UI while API, Redis, or database services recover.</p>
            </div>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="metrics-title">
        <h2 id="metrics-title" className="sr-only">
          Workforce metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.metrics.map((metric, index) => {
            const Icon = metricIcons[index] ?? Users;
            return (
              <article key={metric.label} className="rounded-md border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
                <p className="mt-3 text-2xl font-semibold">{metric.value}</p>
                <p className={metric.tone === "warn" ? "mt-1 text-sm text-accent" : "mt-1 text-sm text-muted-foreground"}>{metric.delta}</p>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section aria-labelledby="leave-title" className="rounded-md border bg-background">
          <div className="border-b p-4">
            <h2 id="leave-title" className="font-semibold">
              Leave approval queue
            </h2>
          </div>
          <div className="divide-y">
            {summary.leaveQueue.length === 0 ? (
              <div className="flex items-start gap-3 p-6">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
                <div>
                  <p className="font-medium">No pending approvals</p>
                  <p className="mt-1 text-sm text-muted-foreground">All leave requests are fully approved, rejected, or synced.</p>
                </div>
              </div>
            ) : (
              summary.leaveQueue.map((item) => (
                <div key={item.id} className="grid gap-4 p-4 xl:grid-cols-[120px_1fr] xl:items-center">
                  <div>
                    <span className="font-mono text-sm text-muted-foreground">{item.id}</span>
                    <p className="mt-1 w-fit rounded-md bg-secondary px-2 py-1 text-xs font-medium">{item.status}</p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.employee}</p>
                        <p className="text-sm text-muted-foreground">{item.step}</p>
                      </div>
                    </div>
                    <ol className="mt-4 grid gap-2 sm:grid-cols-4" aria-label={`Approval timeline for ${item.employee}`}>
                      {item.timeline.map((step, index) => (
                        <li key={step.label} className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${timelineClass[step.status]}`}>
                              {step.status === "done" ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : step.status === "rejected" ? <XCircle className="h-4 w-4" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{step.label}</p>
                              <p className="text-xs capitalize text-muted-foreground">{step.status}</p>
                            </div>
                          </div>
                          {index < item.timeline.length - 1 ? <div className="ml-4 mt-2 hidden h-px bg-border sm:block" aria-hidden /> : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section aria-labelledby="signals-title" className="rounded-md border bg-background">
          <div className="border-b p-4">
            <h2 id="signals-title" className="font-semibold">
              Policy and AI signals
            </h2>
          </div>
          <div className="divide-y">
            {summary.riskSignals.map((signal) => (
              <div key={signal.id} className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={signal.severity === "critical" ? "mt-0.5 h-4 w-4 text-destructive" : "mt-0.5 h-4 w-4 text-accent"} aria-hidden />
                  <p className="text-sm">{signal.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
