# Failure Handling

## If Redis Is Down

Behavior:

- Read paths continue using PostgreSQL.
- Query cache is bypassed.
- Session cache misses fall back to database lookup.
- Rate limiting falls back to a local in-memory window per API process.

Trade-off:

- Local fallback is not globally consistent across horizontally scaled API instances.
- This is acceptable as a temporary degradation because the database remains source of truth.

Recovery:

- Redis reconnects automatically through `ioredis`.
- Cache entries are rebuilt naturally on future reads.

## If Queue Processing Fails

Behavior:

- BullMQ retries jobs with exponential backoff.
- Payroll sync uses an idempotency key: `payroll:leave:{leaveRequestId}:approved`.
- Outbox events track `PENDING`, `PROCESSING`, `PROCESSED`, and `FAILED`.

Recovery:

- Workers can be scaled independently.
- Failed outbox events can be replayed safely because external sync uses idempotency.

## If Payroll Is Down

Behavior:

- Leave request remains approved in PostgreSQL.
- Payroll sync job retries.
- Dashboard can show outbox failures as operational risk.

Trade-off:

- HR sees correct workflow state immediately.
- Payroll consistency is eventual.

## If WebSocket Fails

Behavior:

- API workflow still succeeds.
- Dashboard falls back to normal data fetching.
- Notifications are best-effort and not source of truth.

## If AI Processing Fails

Behavior:

- Request can return `QUEUED`.
- Worker retry handles transient failures.
- Cached previous result may still be served if available.

Trade-off:

- AI insights are advisory and never block HR workflows.

