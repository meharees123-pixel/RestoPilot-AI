# NestJS Module and Folder Structure

## Current implementation

```text
backend/src/
  common/
    parse-object-id.pipe.ts
    roles.decorator.ts
    roles.guard.ts
    tenant-context.guard.ts
  modules/
    auth/
    branch/
    customer/
    health/
    menu/
    order/
    tenant/
frontend/src/
  app/
    core/auth/
    features/auth/
    features/dashboard/
```

The backend has no WhatsApp, AI-agent, queue-worker, knowledge, memory, voice, audit or reservation
modules yet. Redis and BullMQ dependencies/configuration do not imply that workers are implemented.

## Target MVP structure

```text
backend/src/
  common/
    auth/
    tenant/
    validation/
    observability/
  integrations/
    ai-provider/
      agent-provider.port.ts
      openai/
      gemini/
    whatsapp/
      whatsapp-cloud.client.ts
      webhook-signature.service.ts
  modules/
    auth/
    tenant/
    branch/
    menu/
    order/
    customer/
    conversation/
    reservation/
    knowledge-base/
    agent-memory/
    agent-audit/
    ai-agent/
      application/
        agent-orchestrator.service.ts
        tool-registry.service.ts
        agent-context.factory.ts
      agents/
        customer.agent.ts
        operations.agent.ts
      tools/
        customer/
        operations/
        knowledge/
    whatsapp/
    voice-processing/
  queues/
    ai-jobs/
    voice-jobs/
  events/
  workers/
```

Defer `marketing.agent.ts`, campaign execution and analytics/reporting agent modules until the
Customer + Operations + Voice workflow has been validated. Queue names for future campaign and
reporting jobs may be reserved, but must not be presented as working features.

## Feature layout

Keep HTTP and queue adapters at the edge, agent tools in application code, and persistence behind
repository ports:

```text
menu/
  presentation/
    menu.controller.ts
    dto/
  application/
    menu.service.ts
    menu.repository.port.ts
  domain/
    entities/
    menu.rules.ts
  infrastructure/
    menu.schema.ts
    mongoose-menu.repository.ts
  menu.module.ts
```

Agent tools depend on application services, not Mongoose schemas or repository implementations.
The current services access Mongoose directly, so repository-port extraction should happen
incrementally as those modules are touched.

## Queue layout

```text
queues/
  ai-jobs/
    ai-jobs.constants.ts
    ai-jobs.producer.ts
    ai-jobs.processor.ts
  voice-jobs/
    voice-jobs.constants.ts
    voice-jobs.producer.ts
    voice-jobs.processor.ts
```

Workers receive persisted message/media identifiers and trusted tenant/correlation identifiers,
reload records through scoped services, and use idempotent handlers. Keep future
`campaign-jobs/` and `reporting-jobs/` disabled until their features are implemented.

## Frontend evolution

```text
frontend/src/app/
  core/
    auth/
    tenant/
    api/
  shared/
  features/
    dashboard/
    branches/
    menus/
    orders/
    customers/
    conversations/
    reservations/
    reports/          # later
    campaigns/        # later
    subscriptions/    # later
    settings/
    technical-admin/  # separate privileged routes
```

Business-admin routes remain tenant-scoped. Technical-admin routes use separate authorization and
auditing; they must not be added as a client-side-only role check.
