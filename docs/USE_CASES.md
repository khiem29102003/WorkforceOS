# Use Cases

## Use Case: Leave Approval

1. Employee submits a leave request.
2. API stores the request and manager approval step in one transaction.
3. Manager receives a real-time notification.
4. Manager approves or rejects with optimistic locking.
5. If approved, HR receives the next approval step.
6. HR approves or rejects.
7. Final approval writes an outbox event.
8. BullMQ syncs approved leave to payroll with an idempotency key.
9. WebSocket updates keep the dashboard timeline current.

## Use Case: Salary Change

1. HR opens an employee profile.
2. HR submits a salary change with an expected employee version.
3. Current salary history row is closed with `effectiveTo`.
4. New salary history row is inserted.
5. Existing salary values are never overwritten.
6. Audit log stores before and after snapshots.

## Use Case: Burnout Risk Detection

1. PM requests an AI insight for a project.
2. API loads team allocation, recent workload, project health, and employment status from the database.
3. Input is normalized into structured arrays: `teamPerformance` and `workload`.
4. Redis cache is checked by hash of the structured input.
5. If cache is cold, BullMQ queues AI processing.
6. Result returns structured output: `burnoutRisk`, `suggestion`, `drivers`, and `confidence`.

## Use Case: Probation Restrictions

1. Employee status is set to `PROBATION`.
2. Rule engine detects probation constraints.
3. RBAC and policy checks restrict sensitive actions.
4. Dashboard surfaces the policy signal for HR follow-up.

