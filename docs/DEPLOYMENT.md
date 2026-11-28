# Deployment Guide

## Local development

The root `docker-compose.yml` runs MongoDB, Redis, the API container and the Angular/Nginx web
container. It is a development stack: MongoDB and Redis use no authentication, and the API runs
with schema auto-indexing enabled.

1. Copy `.env.example` to `.env`, set `MONGODB_DATABASE=RestoPilot`, and replace both JWT secrets
   with different random values of at least 32 characters. To use Atlas from the API running
   directly on the host, replace `MONGODB_URI` with the Atlas URI in the ignored local `.env`.
   With Docker Compose, set `MONGODB_ATLAS_URI` instead; leaving it empty uses the local Mongo
   service. `MONGODB_DATABASE` selects `RestoPilot` even if the URI contains another database path.
2. Run `docker compose up --build`.
3. The web portal is at `http://localhost:8080`, API at `http://localhost:3000`, Swagger at
   `http://localhost:3000/docs`.
4. Configure WhatsApp Cloud API credentials and an approved OTP template. For inbound message
   webhooks, configure Meta's callback URL as `https://<public-api-host>/api/v1/webhooks/whatsapp`,
   set `WHATSAPP_VERIFY_TOKEN`, and configure `WHATSAPP_APP_SECRET`. Seed the platform
   administrator with `SEED_SUPER_ADMIN_*` and `docker compose exec api npm run seed:super-admin`.
   Set `SEED_OWNER_*` and `SEED_RESTAURANT_*`, then run `docker compose exec api npm run seed:owner`
   to invite the first restaurant owner.

Do not expose the Compose MongoDB or Redis ports to the public internet.

## Google Cloud VM production outline

Use the VM for the stateless API/web containers only. Use MongoDB Atlas and a managed Redis
deployment with TLS and authentication; do not use the unauthenticated local Compose databases.

1. Create a Google Cloud VM in a restricted VPC. Allow inbound 80/443 only through a load balancer
   or reverse proxy; restrict SSH using IAP or an approved administrative range.
2. Provision Atlas with private networking/IP allowlisting, least-privilege database credentials,
   automated backups and point-in-time recovery.
3. Provision Redis with TLS, authentication, persistence policy and private network access.
4. Store JWT/OTP secrets, the super-admin password and MFA secret, Mongo URI, Redis credentials
   and WhatsApp/provider keys in Secret Manager.
   Inject them into the container runtime; never bake them into images or commit them.
5. Set `NODE_ENV=production`, `MONGODB_URI`, `MONGODB_DATABASE=RestoPilot`, JWT secrets and
   `CORS_ORIGINS`. The explicit database setting overrides the database path in the MongoDB URI;
   do not store Atlas credentials in source control. The web container
   proxies `/api` to the API service; terminate TLS at a Google HTTPS load balancer with managed
   certificates or an independently maintained TLS reverse proxy.
6. Run `npm run db:indexes` from the backend release job before rolling out the API. This migrates
   the legacy users email index and creates the auth/audit/WhatsApp indexes. Run
   `npm run seed:super-admin` and `npm run seed:owner` only for initial provisioning; remove
   bootstrap credentials afterward.
7. Deploy stateless API replicas behind the load balancer. Monitor health, error rates, Mongo
   connection pool, queue depth, WhatsApp webhook failures and provider latency.

WhatsApp OTP delivery uses the Cloud API message endpoint and the configured approved template.
The inbound webhook stores messages and sends a fixed welcome reply; it does not yet execute
orders or call AI providers. BullMQ workers and AI provider integrations are not implemented.

## SSL and Nginx

`frontend/nginx.conf` serves the Angular SPA, applies baseline response headers, and reverse
proxies API paths. It does not terminate TLS. In production, terminate TLS at a managed Google
Cloud HTTPS load balancer (recommended) or place a separately managed TLS reverse proxy in front
of the web container. Redirect HTTP to HTTPS and renew certificates automatically.

## CI/CD strategy

For each pull request, install using lockfiles, run backend/frontend tests and production builds,
run production dependency audits, and build both Docker images. On release, publish immutable
image tags, apply additive database indexes, deploy to a staging VM, run health/smoke checks, then
roll out production with rollback to the previous image. Keep schema changes backward-compatible
across the rollout window.
