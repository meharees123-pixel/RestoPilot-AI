# Agentic Restaurant Operating System

## Status and scope

This is the target architecture. The current repository has authenticated tenant-scoped
branch/menu/customer/order APIs and a small Angular shell. It does **not** yet have WhatsApp
webhooks, an LLM provider, agent orchestration, BullMQ workers, RAG, voice transcription,
reservations, proactive insights, or agent audit persistence.

The MVP should validate one restaurant's real workflow before adding autonomous marketing or
analytics:

1. Customer Agent: menu discovery, order tracking/creation, branch discovery and reservations.
2. Operations Agent: item availability, menu edits, price changes and order operations.
3. Voice: WhatsApp audio -> transcription -> the same orchestrator used by text.
4. Shared foundations: tenant-safe tool execution, knowledge retrieval, explicit AI audit and
   asynchronous processing.

Marketing and Analytics Agents are deliberately deferred. Do not silently execute unsupported
marketing/analytics requests in the MVP.

## Target topology

```text
WhatsApp text/audio                         Admin API
       |                                         |
       +---- webhook verification / auth --------+
                            |
                 normalized inbound envelope
                            |
             tenant + actor + branch resolution
                            |
            AI ingress (idempotency and limits)
                            |
                 AI task queue (BullMQ)
                            |
               AgentOrchestratorService
             intent -> plan -> agent selection
                  /                 \
        Customer Agent          Operations Agent
          |       |                |       |
    Knowledge  Customer         Menu    Order / Branch
    retrieval  /Order/           application services
              Reservation                |
                  \                      /
                   validated tool runner
                            |
                     repositories
                            |
                    MongoDB / Atlas
                            |
              audit + memory + event outbox
                            |
           response queue -> WhatsApp Cloud API
```

Voice is an input adapter, not another agent: it produces a normalized transcript and enters this
same flow. A shared Knowledge capability can serve both MVP agents. It does not get unrestricted
write tools.

## Orchestrator contract and flow

`AgentOrchestratorService` owns orchestration but not restaurant business rules:

1. Accept a normalized message ID and load the tenant-scoped conversation/message.
2. Resolve a verified actor: customer, owner, manager or branch manager. Unknown senders receive no
   write-capable context.
3. Load bounded recent context, relevant structured memory and restaurant/branch knowledge.
4. Classify intent and create a small plan. Route by both intent and actor permissions; role alone
   must never authorize a tool.
5. Ask the selected specialist agent for a response or typed tool call.
6. Validate tool name, JSON schema, tenant, branch, actor permission and confirmation policy.
7. Execute tools through application services only. Never pass a Mongoose model or raw query to a
   model or agent.
8. Append tool results and continue the provider loop up to a configured step/time/token budget.
9. Persist the final response and append-only audit records before enqueueing outbound delivery.
10. On timeout, policy failure, provider failure or unsupported intent, return a safe handoff or
    clarification; never report an unexecuted action as successful.

Use an `AgentProvider` port with OpenAI GPT-5 and Gemini 2.x adapters behind it. Provider selection,
timeouts and model names are configuration, not business logic. Provider responses are untrusted
input and must be schema-validated. The provider may suggest a tool; the application authorizes and
executes it.

## Agents

### Customer Agent — MVP

Read tools: menu/category search, branch lookup, order status and reservation availability.
Write tools: create an order and create/update/cancel a reservation after collecting required
fields and obtaining any required customer confirmation.

It uses the verified customer identity/phone, restaurant policies and branch context. It cannot
change prices, availability, campaigns or staff data.

### Operations Agent — MVP

Read tools: menu, branches, pending orders and operational context.
Write tools: mark an item unavailable/available, add/update menu items, update prices and perform
allowed order/branch operations.

Manager identity must map to an active user and tenant. Branch managers are limited to assigned
branches. Bulk or destructive changes require a confirmation summary showing the affected records
before execution.

### Knowledge capability — MVP shared service

Answers policy, menu, opening-hour and branch questions using tenant-filtered retrieval. It cites
the source document internally and declines when evidence is missing or stale. It cannot mutate
business data.

### Marketing and Analytics Agents — later phases

Marketing adds segmentation, campaign drafts, consent checks, template validation, send limits and
approval before broadcast. Analytics adds deterministic reporting tools and explanations over
tenant-scoped aggregates. Both remain disabled until their domain services, audit rules and tests
exist.

## Tool boundary

```ts
interface AgentTool<Input, Output> {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  authorize(context: AgentContext, input: Input): Promise<void>;
  execute(context: AgentContext, input: Input): Promise<Output>;
}
```

Execution path:

```text
Agent -> ToolRegistry -> authorization + DTO validation
      -> application service -> tenant-scoped repository -> MongoDB
```

`AgentContext` is created by trusted ingress code and contains `restaurantId`, actor ID/type,
branch grants, customer ID, channel, conversation ID and correlation ID. Never derive tenant scope
or role from model output or user-supplied tool arguments.

MVP tools should include:

- Customer: `findMenuItem`, `findCategory`, `findNearestBranch`, `createOrder`, `trackOrder`,
  `checkReservationAvailability`, `createReservation`, `updateReservation`, `cancelReservation`.
- Operations: `markUnavailable`, `markAvailable`, `addMenuItem`, `updateMenuItem`,
  `updateMenuPrice`, `listPendingOrders`, `updateOrder`.
- Knowledge: `retrieveRestaurantKnowledge`.

Each tool has strict input bounds, idempotency where writes can be retried, a defined permission
set, and audit metadata. Tool implementations invoke existing or new application services; they
must not duplicate business logic.

## Queues and reliability

Use BullMQ queues with separate concurrency and retry policies:

| Queue | MVP use |
|---|---|
| `ai-jobs` | Intent planning and bounded agent/tool orchestration |
| `voice-jobs` | Media fetch, format validation and speech transcription |
| `campaign-jobs` | Reserved for later Marketing Agent rollout |
| `reporting-jobs` | Reserved for later Analytics Agent rollout |

Queue payloads should contain tenant ID, persisted message/media ID, correlation ID and idempotency
key—not full conversation history or secrets. Workers reload scoped records from repositories.
Use bounded exponential retries, dead-letter handling, queue-age monitoring and deduplication by
provider message ID. Do not retry non-idempotent tools without an idempotency key.

The webhook should verify provider signatures, persist/deduplicate inbound events and enqueue work
before acknowledging. Outbound send failures are retried separately from agent execution.

## Voice processing — MVP

```text
Verified WhatsApp audio message
 -> tenant/message persistence
 -> voice-jobs queue
 -> fetch media from the configured WhatsApp Graph API host
 -> validate size, MIME and file signature
 -> speech-to-text provider
 -> transcript with detected language and confidence
 -> common AgentOrchestratorService
 -> tool audit and response queue
```

Support English, Arabic, Hindi, Urdu and Malayalam through provider language detection and
restaurant-aware terminology hints. Low-confidence or empty transcripts require clarification.
Never fetch an arbitrary URL supplied by a user/model. Apply upload/download size limits, timeout,
retention and deletion policies. Store transcript metadata and a media reference; avoid retaining
raw audio longer than required.

## Knowledge base and RAG

Ingestion sources: menus, branch details, opening hours, FAQs, policies, offers and approved
business rules. Normalize, chunk, version and embed documents asynchronously. Preserve source ID,
document version, branch scope, language and update timestamp.

Every query must include `restaurantId`; branch-specific requests must include the resolved
`branchId` filter. Enforce these filters inside the repository, not in prompt text. Reject chunks
whose tenant or branch metadata does not match the request. Return citations and use a confidence
threshold; do not invent policy details from model priors.

Use MongoDB Atlas Vector Search or an explicitly selected vector store. Keep lexical fallback
tenant-scoped. Re-indexing is idempotent and removes superseded chunks only within the same tenant.

## Long-term memory

Do not replay entire conversations as memory. Store compact, structured, attributable facts:
favorite products, dietary preferences, usual spend band, preferred branch and ordering habits.
Each fact includes `restaurantId`, `customerId`, provenance, confidence, last confirmed time and
optional expiry. Distinguish customer-provided facts from inferred facts; inferred facts require
confidence thresholds and must not be used for sensitive decisions.

Memory reads/writes use a tenant-scoped repository. Support correction, deletion and retention
controls. Memory supplements, but never overrides, current customer instructions or restaurant
policies.

## Reservations

Reservation is a first-class domain module used by the Customer Agent and REST API. Availability
checks must be race-safe: reserve a time/table using a unique tenant/branch/time/table constraint or
an atomic capacity allocation. Confirm date, timezone, branch and guest count before booking.
Cancellation and modification use explicit state transitions and are audited.

## Proactive AI and insights — later phases

Business events (`SalesDropped`, `OutOfStock`, `CampaignCompleted`, `CustomerInactive`) are
published through an outbox so database writes and event publication cannot silently diverge.
Consumers calculate deterministic metrics first; AI explains them and proposes actions second.

Store recommendations with evidence window, metric values, explanation, confidence, expiry and
status. Owners approve actions such as campaigns or price changes. MVP may emit out-of-stock
operational alerts; it must not autonomously send promotional broadcasts or change prices.

## Audit and governance

Append an `agent_audits` record for every model tool proposal, authorization decision, tool
execution and final outcome. Capture tenant, actor, channel, conversation/message IDs, selected
agent, provider/model/prompt version, tool name, redacted input/output, result, duration, status and
timestamp. Do not store API keys, raw secrets, unnecessary personal data or full hidden reasoning.

Use append-only access for application code. Provide tenant-scoped audit reads for business admins
and platform-level monitoring for technical admins. Retention and deletion rules must comply with
the product's privacy obligations.

## Admin separation

- Business Admin: restaurant/branch users, menu, orders, customers, reservations and approved AI
  recommendations; always tenant-scoped.
- Technical Admin: platform operators, subscription/tenant status, queue/provider health and
  aggregate AI usage. Cross-tenant access is privileged, explicit and audited.

## Implementation sequence

1. Establish actor/tenant context and the application-service tool boundary.
2. Add webhook ingress, message persistence, idempotent `ai-jobs`, Customer/Operations agents and
   tool audit; launch text-only with one restaurant.
3. Add reservation service and tenant-filtered knowledge ingestion/retrieval.
4. Add voice media/transcription through `voice-jobs`, reusing the text orchestrator.
5. Validate success rate, safe clarifications, latency and operator handoffs with a real restaurant.
6. Add proactive out-of-stock and sales events after reliable instrumentation.
7. Add Marketing and Analytics agents only after consent, campaign governance and reporting
   correctness have been validated.

## Current implementation boundary

Current code does not yet implement any AI provider, orchestrator, specialist agent, WhatsApp
adapter, BullMQ integration, voice transcription, RAG, memory, audit collection, proactive events
or reservation module. Existing `MenuService` and `OrderService` are application-level services that
can be wrapped by tools; their HTTP APIs are not themselves an agentic AI system.
