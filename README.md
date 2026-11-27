# RestoPilot AI

RestoPilot AI is being built as an AI-powered, WhatsApp-first restaurant operating system.
The target architecture treats AI as a permission-bound operations layer, not a chatbot with
unrestricted database access.

## Repository layout

```text
backend/        NestJS API, tenant-scoped MVP modules and MongoDB persistence
docs/           Architecture, database, API and AI design
docker-compose.yml   Local MongoDB and Redis services
```

## Target principles

- Every tenant-scoped record contains `restaurantId`.
- A request is authorized for one resolved tenant context.
- WhatsApp and dashboard operations should use the same application services.
- Agents should call validated tools; application services enforce business rules and permissions.
- Repositories should encapsulate persistence and apply trusted tenant scope.
- MVP focus: Customer Agent, Operations Agent and voice-to-agent processing. Marketing and
  Analytics Agents are deferred until the core restaurant workflow is validated.

## Backend quick start

Requires Node.js 20.19 or newer. Copy `.env.example` to `.env`, set a real `MONGODB_URI`,
`MONGODB_DATABASE` (defaults to `RestoPilot`) and development secrets. `MONGODB_DATABASE` explicitly
selects the database even when the URI path names a different database. Start local MongoDB and
Redis with `docker compose up -d`, then run:

```powershell
cd backend
npm ci
npm run build
npm run start
```

The API listens on port 3000 by default, Swagger is at `/docs`, and the database readiness check
is at `/api/v1/health`. Add allowed browser origins to `CORS_ORIGINS` as a comma-separated list.
Do not use the example secrets in a deployed environment.

To provision the initial restaurant owner, set the `SEED_*` values and run `npm run seed:owner`
once against the target database. Treat `SEED_OWNER_PASSWORD` as a secret and remove it from the
environment after seeding. Login is at `POST /api/v1/auth/login`; refresh tokens rotate at
`POST /api/v1/auth/refresh`.

In production, build the backend first, then run `npm run db:indexes` before deploying application
instances. It creates declared indexes without dropping existing indexes; schema auto-indexing is
disabled in production. Configure `MONGODB_DATABASE=RestoPilot` for the API, owner-seeding command
and index-creation command so they all use the same database.

## Web portal

The Angular 20 portal currently provides sign-in, session refresh, a responsive overview dashboard,
recent orders/branches, and a light/dark theme. Start it with:

```powershell
cd frontend
npm ci
npm start
```

In development it expects the API at `http://localhost:3000`. Container deployment serves the SPA
on port 8080 and proxies `/api` to the backend.

## Implementation status

The current backend slice includes application bootstrap, Swagger, health/readiness, Mongo
connection configuration, owner provisioning, JWT access/refresh authentication, and guarded
tenant-scoped branch, menu, customer and order operations. Unit tests cover tenant isolation,
order totals and state transitions. The Angular app has sign-in and an overview shell; feature pages
remain incomplete.

The target architecture is not yet a running agentic system: WhatsApp integration, AI providers and
orchestration, agent tools, BullMQ workers, voice processing, knowledge retrieval, long-term memory,
agent audits, reservations, campaigns, password recovery and analytics remain implementation work.
Redis is configured for local development and BullMQ is listed as a backend dependency, but queue
processors are not wired. Order tax, discounts, delivery charges and online payment capture are not
configured in this MVP slice. The local Compose stack is for development only.

## Documentation

- [System Architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Database Design](docs/DATABASE_DESIGN.md)
- [NestJS Module and Folder Structure](docs/FOLDER_STRUCTURE.md)
- [Backend API Design](docs/API_DESIGN.md)
- [AI Agent Architecture](docs/AI_AGENT_ARCHITECTURE.md)
- [Frontend UX Architecture](docs/FRONTEND_UX_ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)