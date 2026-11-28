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

Restaurant users sign in with a WhatsApp OTP; only `SUPER_ADMIN` can use email/password, and that
login also requires a time-based MFA code. Configure the WhatsApp Cloud API credentials and an
approved OTP template whose body includes one `{{1}}` parameter. Set `WHATSAPP_OTP_TEMPLATE_NAME`
to its name and `WHATSAPP_OTP_TEMPLATE_LANGUAGE` to its language.

For inbound messages, configure Meta's webhook callback as
`https://<public-api-host>/api/v1/webhooks/whatsapp` and use `WHATSAPP_VERIFY_TOKEN` as the
verification token. Set `WHATSAPP_APP_SECRET` in production so webhook signatures are verified.
New inbound text messages are stored and receive a fixed welcome reply; status notifications are
acknowledged without a reply.

To bootstrap the technical administrator, configure `SEED_SUPER_ADMIN_*` and run
`npm run seed:super-admin` from `backend`. Add the configured Base32 MFA secret to an authenticator
app and keep it in a secrets manager. For the first restaurant, configure `SEED_RESTAURANT_*`,
`SEED_WHATSAPP_NUMBER`, and `SEED_OWNER_FIRST_NAME`, `SEED_OWNER_LAST_NAME`, and
`SEED_OWNER_PHONE_NUMBER`, then run `npm run seed:owner`. The owner is invited and must verify the
WhatsApp code before signing in. If `SEED_OWNER_EMAIL` matches a legacy owner, the script migrates
that account to WhatsApp sign-in and removes its password hash. Restaurant sign-in uses
`POST /api/v1/auth/request-otp` and `POST /api/v1/auth/verify-otp`; super-admin login uses
`POST /api/v1/auth/login` with email, password, and MFA code. Both flows use
`POST /api/v1/auth/refresh` to rotate refresh tokens.

Run `npm run db:indexes` before restarting against an existing database. It migrates the former
unique email index to a partial unique index so restaurant users can omit email, then creates the
declared indexes. Configure `MONGODB_DATABASE=RestoPilot` for the API, seeders and index command.

## Web portal

The Angular 20 portal provides WhatsApp OTP sign-in for restaurant users, MFA sign-in for super
administrators, and separate guarded business and technical administration areas. Start it with:

```powershell
cd frontend
npm ci
npm start
```

In development it expects the API at `http://localhost:3000`. Container deployment serves the SPA
on port 8080 and proxies `/api` to the backend.

## Implementation status

The current backend slice includes WhatsApp OTP, super-admin MFA, invited owner provisioning,
platform restaurant/user endpoints, access audit logging and review, JWT access/refresh
authentication, and tenant/branch-scoped business operations. Campaigns, reservations,
subscriptions, analytics, queue monitoring and provider dashboards remain unimplemented.

The target architecture is not yet a running agentic system: WhatsApp ordering, AI providers and
orchestration, agent tools, BullMQ workers, voice processing, knowledge retrieval, long-term memory,
agent action audits, reservations, campaigns and analytics remain implementation work. Restaurant
password recovery is intentionally not provided; restaurant users authenticate with WhatsApp OTP.
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