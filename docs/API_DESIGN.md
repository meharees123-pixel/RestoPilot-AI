# Backend API Design

## Conventions

- Base path: `/api/v1`
- JSON request and response bodies
- JWT bearer authentication
- Restaurant scope is derived server-side
- Mutating requests use domain DTO validation
- Swagger is published at `/docs`
- WhatsApp webhooks are exposed at `/api/v1/webhooks/whatsapp`

## Authentication and platform administration

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/request-otp` | Request a WhatsApp OTP for an invited restaurant user |
| POST | `/auth/verify-otp` | Verify OTP and issue a restaurant-user session |
| POST | `/auth/login` | Super-admin email/password/MFA login only |
| POST | `/auth/refresh` | Rotate refresh token and return the user profile |
| POST | `/auth/logout` | Revoke refresh token |
| GET | `/platform/overview` | Super-admin platform counts |
| GET, POST | `/platform/restaurants` | List tenants or create a tenant and invited owner |
| GET | `/platform/users` | List platform users (super admin only) |
| GET | `/platform/access-audits` | List recent API access audit events |
| POST | `/platform/users/:id/invite` | Send a WhatsApp OTP invitation |

Restaurant OTPs are HMAC-hashed, expire after five minutes, allow at most five attempts, and are
rate-limited before resending. Delivery uses a configured WhatsApp Cloud API template. Restaurant
users cannot authenticate with email/password. Super-admin password login requires a valid TOTP
MFA code. Initial identities are provisioned by the operator-only `seed:super-admin` and
`seed:owner` scripts; there is no public registration or password-recovery endpoint.

Restaurant login bodies:

```json
{ "phoneNumber": "+97455112233" }
```

```json
{ "phoneNumber": "+97455112233", "otp": "123456" }
```

Super-admin login adds an `mfaCode` six-digit TOTP field to the `email` and `password` fields.
Successful login and refresh responses include `accessToken`, `refreshToken`, `expiresIn` and a
safe `user` profile; secret hashes are never returned.

## Implemented tenant resources

| Resource | Base endpoint |
|---|---|
| Branches | `/branches` |
| Categories | `/menu/categories` |
| Menu items | `/menu/items` |
| Orders | `/orders` |
| Customers | `/customers` |

Tenant endpoints require a bearer access token and a restaurant role. Restaurant scope is derived
from signed token claims, never from a caller-supplied `restaurantId`. Branch managers are limited
to assigned branch IDs. Platform endpoints require `SUPER_ADMIN` and do not use tenant context.
API requests are recorded in the `access_audits` collection without request bodies.

| Method | Endpoint | Purpose |
|---|---|---|
| GET, POST | `/branches` | List or create branches |
| PATCH | `/branches/:id/status` | Activate/deactivate branch |
| GET, POST | `/menu/categories` | List or create categories |
| GET, POST | `/menu/items` | List or create branch menu items |
| PATCH | `/menu/items/:id/availability` | Update item availability |
| GET, POST | `/customers` | List or create customers |
| GET, POST | `/orders` | List or create orders |
| PATCH | `/orders/:id/status` | Advance/cancel order status |

Order totals are calculated from stored menu prices; callers cannot submit prices or totals.
Availability, branch assignment and legal order-state transitions are checked server-side.

## WhatsApp webhooks

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/webhooks/whatsapp` | Verify Meta subscription using `hub.verify_token` |
| POST | `/webhooks/whatsapp` | Persist incoming messages and send a fixed text auto-reply |
| GET | `/webhooks/whatsapp/debug` | Return WhatsApp configuration readiness flags |
| POST | `/webhooks/whatsapp/test` | Log a development-only test message |

Configure Meta's callback URL as `https://<public-api-host>/api/v1/webhooks/whatsapp` and set
its verification token to match `WHATSAPP_VERIFY_TOKEN`. In production, set `WHATSAPP_APP_SECRET`;
POST requests are checked against Meta's `X-Hub-Signature-256` header using the original raw body.
The POST handler stores each message once by its unique provider message ID, acknowledges
status-only notifications, and replies to new text messages with `Welcome to RestoPilot AI 🚀`.
Provider send failures are logged and recorded as `REPLY_FAILED` while the webhook is still
acknowledged, preventing Meta retries from producing duplicate replies.
Detailed request bodies and message text are logged outside production by default; set
`WHATSAPP_DEBUG_LOGGING=false` to suppress them. `WHATSAPP_DEBUG_BYPASS_SIGNATURE=true` is a
local-only diagnostic switch and prevents startup in production. Set `WHATSAPP_WEBHOOK_URL` if
startup diagnostics should display the public tunnel URL instead of localhost.

Conversation, loyalty, campaigns, reservations and reporting endpoints in the architecture plan
are not implemented yet. WhatsApp ordering and AI-driven message handling are also not connected;
the current webhook only stores inbound events and sends the fixed acknowledgement above.

## Response

Successful endpoints currently return their resource JSON directly.

Errors use:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Order was not found",
    "details": []
  }
}
```
