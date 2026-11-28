# System Architecture

## Status

This document describes the target architecture. The implemented backend currently provides NestJS APIs for WhatsApp OTP authentication,
super-admin MFA, platform tenant provisioning, access audit, and tenant-scoped branch, menu,
customer and order functionality backed by MongoDB. WhatsApp OTP uses the Cloud API template
endpoint. Redis is present in local deployment configuration, and BullMQ is a backend dependency,
but no queue workers are wired. AI orchestration, provider clients, RAG, voice, reservations and
proactive processing are not implemented yet.

## Target deployment architecture

```text
Customers / Restaurant Staff
          |
 WhatsApp Cloud API          Angular Business Portal
          |                         |
          +-----------+-------------+
                      |
                 Nginx + TLS
                      |
       NestJS REST API and webhook ingress
          |          |             |
          |          |             +-- OpenAI / Gemini provider adapters
          |          +-- MongoDB Atlas
          +-- Redis / BullMQ
                 |           |
           AI/voice workers   campaign/reporting workers (later)
```

The API and workers are stateless and can scale independently. The provider is never given direct
database access. WhatsApp webhook ingress verifies the request, persists/deduplicates the event,
and queues work before acknowledging it.

## Target request and agent flow

```text
HTTP request: JWT -> tenant/role/branch guards -> controller -> application service -> repository

WhatsApp event: signature -> phone/tenant/actor resolution -> persisted message -> queue
  -> AgentOrchestratorService -> Customer or Operations Agent
  -> validated tool -> authorized application service -> tenant-scoped repository
  -> append-only audit -> response queue -> WhatsApp Cloud API

WhatsApp audio: verified media reference -> voice-jobs -> media validation/transcription
  -> normalized text message -> same AgentOrchestratorService flow
```

The authenticated context—not model output—determines tenant and actor permissions. Every tool
call is schema-validated, tenant/branch-scoped, authorized and audited. See
[AI Agent Architecture](AI_AGENT_ARCHITECTURE.md) for orchestration, agent boundaries, voice,
knowledge, memory and rollout details.

## Target services

| Service | Responsibility |
|---|---|
| Identity | users, JWT, refresh tokens, roles and permissions |
| Tenant | restaurant lifecycle and tenant context |
| Branch | branch configuration and branch-level operating context |
| Menu | categories, items, availability and menu changes |
| Order | order creation, status transitions and totals |
| Customer | customer profile and order relationship |
| Conversation | persisted inbound/outbound conversation history |
| WhatsApp | webhook verification, media retrieval and outbound messaging |
| Agent Orchestrator | intent routing, step budgets, tool coordination and response handling |
| Customer / Operations Agents | specialized, permission-bound restaurant workflows |
| Knowledge Base | versioned tenant/branch knowledge and filtered retrieval |
| Agent Memory | structured customer preferences and retention controls |
| Reservation | capacity-safe reservation lifecycle |
| Voice Processing | bounded audio validation, transcription and normalized message handoff |
| Agent Audit | append-only trace of AI proposals, authorization, tools and outcomes |
| Campaign / Reporting | later-phase marketing and analytics workloads |

This is a target service map; several listed services do not exist in the current code.

## Tenant isolation

For dashboard requests, tenant and role context come from validated JWT claims and server-side
authorization. For webhooks, map the verified WhatsApp business/phone-number ID to a tenant, then
resolve the sender as a customer or authorized staff member. A request may never choose a tenant
by submitting `restaurantId` itself.

Every tenant-owned document includes `restaurantId` and tenant-aware indexes. Branch-scoped reads
also filter by a resolved, authorized `branchId`. Repositories require trusted tenant context and
apply these filters themselves. Knowledge/vector search must filter by tenant and branch before
returning candidates. Cross-tenant technical administration is a separate privileged path with
explicit audit.

## Application boundaries

Use the existing Nest application-service layer as the business boundary. AI tools call application
services, which validate rules and use repositories/adapters. Agents must not import Mongoose
models, construct database filters or bypass service authorization. The current menu/order/customer
services use Mongoose directly; repository extraction is a prerequisite for the stricter
repository-port architecture, not a feature already completed.

## Reliability and governance

- Use provider-message IDs and idempotency keys to deduplicate webhook and write operations.
- Separate `ai-jobs` and `voice-jobs` from later `campaign-jobs` and `reporting-jobs`; define bounded
  concurrency, retries, dead-letter handling and queue monitoring.
- Queue payloads carry persisted record IDs and correlation/tenant identifiers, not full histories
  or credentials.
- Use an outbox for business events that must reliably trigger background processing.
- Apply provider timeouts, tool-step budgets, rate limits and safe fallback/handoff behavior.
- Keep secrets in deployment configuration. Redact personal data from logs and audit payloads.
- Require confirmation for bulk, destructive or externally visible actions; do not auto-broadcast
  campaigns in the MVP.

## Admin separation

Business admins manage one restaurant's branches, menu, orders, customers and reservations.
Technical admins manage platform-level tenant/subscription operations and aggregate system/AI
health. Cross-tenant technical access is explicitly authorized and audited.
