# Scaling Strategy

## API

- Stateless NestJS API instances can scale horizontally.
- JWT validation plus Redis session cache avoids sticky sessions.
- PostgreSQL transactions protect critical workflows.
- Optimistic locking prevents concurrent human edits from overwriting each other.

## Database

- PostgreSQL is the source of truth.
- Tenant-scoped indexes support multi-tenant access patterns.
- Audit logs and outbox events can be partitioned later by tenant or time.
- Reporting workloads should move to read replicas when query volume grows.

## Redis

- Redis can scale to a managed cluster for cache, rate limit, and BullMQ throughput.
- Cache keys include tenant ID to avoid cross-tenant leakage.
- Cache TTLs are short for operational data and longer for AI results.

## Workers

- BullMQ workers scale independently from API instances.
- Email, payroll, and AI queues can have different concurrency limits.
- Payroll sync remains idempotent so retries and duplicate delivery are safe.

## Frontend

- Next.js App Router supports server-rendered dashboard entry points.
- Client state uses TanStack Query with retry and stale-time defaults.
- Loading, empty, degraded, and error states are explicit.

