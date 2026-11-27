# Backend API Design

## Conventions

- Base path: `/api/v1`
- JSON request and response bodies
- JWT bearer authentication
- Restaurant scope is derived server-side
- Mutating requests use domain DTO validation
- Swagger is published at `/docs`
- Webhooks are exposed as `/webhooks/whatsapp`

## Implemented authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/login` | Authenticate user |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke refresh token |

Initial owner provisioning is an operator-only `npm run seed:owner` command. There is no public
registration or password-recovery endpoint yet.

## Implemented tenant resources

| Resource | Base endpoint |
|---|---|
| Branches | `/branches` |
| Categories | `/menu/categories` |
| Menu items | `/menu/items` |
| Orders | `/orders` |
| Customers | `/customers` |

Tenant endpoints require a bearer access token. Restaurant scope is derived from signed token
claims, never from a caller-supplied `restaurantId`. Branch managers are limited to assigned
branch IDs.

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

Conversation, loyalty, campaigns, reservations, reporting and WhatsApp endpoints in the
architecture plan are not implemented yet.

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
