# Database Design

## MongoDB tenant strategy

Use MongoDB Atlas with one database and tenant-scoped collections. Records in tenant collections
contain `restaurantId: ObjectId`. Shared identity records may omit it where explicitly defined.

Indexes begin with `restaurantId` for tenant isolation. A compound unique index prevents cross
tenant and within tenant duplicates.

Production schema auto-indexing is disabled. Run the backend `db:indexes` command during deployment
to create declared indexes; it does not drop existing indexes.

## Restaurant

```text
Restaurant
- _id
- name
- logo
- slug unique
- status
- email
- phone
- restaurantWhatsappNumber
- phoneNumberId
- subscriptionPlan
- timestamps
```

## Branch

```text
Branch
- restaurantId
- name
- address
- location GeoJSON Point
- latitude
- longitude
- deliveryRadius
- googleMapUrl
- status
- timestamps
```

Index: `{ restaurantId: 1, status: 1 }`; Geo: `{ location: "2dsphere" }`.

## Menu

```text
Category
- restaurantId
- name
- image
- displayOrder

MenuItem
- restaurantId
- branchId
- categoryId
- name
- description
- image
- price Decimal128
- salePrice Decimal128
- isAvailable
- availableFrom
- availableTo
- tags[]
- preparationTime
- timestamps
```

Indexes:

- Category: `{ restaurantId: 1, displayOrder: 1 }`
- Menu item: `{ restaurantId: 1, branchId: 1, categoryId: 1, isAvailable: 1 }`
- Text search: `{ name: "text", description: "text", tags: "text" }`

## Order

```text
Order
- restaurantId
- branchId
- customerId
- orderNumber
- status
- items[{menuItemId, name, quantity, unitPrice, total}]
- subtotal
- deliveryCharge
- discount
- tax
- grandTotal
- paymentMethod
- deliveryType
- notes
- timestamps
```

Index: `{ restaurantId: 1, branchId: 1, createdAt: -1 }`.
Unique: `{ restaurantId: 1, orderNumber: 1 }`.

## Conversation

```text
Conversation
- restaurantId
- customerPhone
- lastMessage
- lastMessageTime
- timestamps

Message
- conversationId
- restaurantId
- sender customer|manager|ai|system
- content
- messageType text|image|audio|interactive|template
- providerMessageId unique per restaurant
- timestamp
```

## Existing and planned collections

The current backend includes schemas for Restaurant, Branch, Category, MenuItem, Customer, Order,
User and OrderCounter. The collections below are target design unless stated otherwise; do not
assume a documented schema is already deployed.

Recommended collection names (snake_case) for the agentic data model are `agent_memories`,
`knowledge_chunks`, `agent_audits`, `reservations`, `campaign_jobs`, `voice_transcriptions`,
`ai_recommendations` and `event_history`. Bind these names explicitly in Mongoose schemas so model
renames do not silently create parallel collections.

Existing tenant-owned business records:

- `Customer`: restaurantId, WhatsApp number, spend and tags
- `User`: restaurantId nullable for platform admin, roles and permissions

Other product collections such as loyalty accounts, rewards, campaigns and audit logs are future
work. The agentic MVP adds the following tenant-scoped collections:

### AgentMemory

```text
AgentMemory
- restaurantId: ObjectId (required)
- customerId: ObjectId (required)
- key: string (e.g. favoriteProduct, preferredBranch)
- value: bounded structured value
- provenance: customer_stated | inferred
- confidence: number [0, 1]
- sourceMessageId: ObjectId (optional)
- lastConfirmedAt
- expiresAt (optional)
- timestamps
```

Unique index: `{ restaurantId: 1, customerId: 1, key: 1 }`.
Retrieval always requires restaurantId and customerId. Keep compact facts, not full conversation
history; provide correction/deletion and retention operations.

### KnowledgeChunk

```text
KnowledgeChunk
- restaurantId: ObjectId (required)
- branchId: ObjectId | null (null means restaurant-wide)
- sourceId: ObjectId (required)
- sourceType: menu | policy | faq | hours | offer | business_rule
- sourceVersion: string
- chunkIndex: number
- language: string
- content: string
- embedding: number[] (or provider/vector-store reference)
- metadata: object
- updatedAt
```

Indexes: `{ restaurantId: 1, branchId: 1, sourceId: 1, sourceVersion: 1, chunkIndex: 1 }`
(unique), plus the vector index configured for the chosen vector store. Every vector and lexical
query must filter by restaurantId and resolved branch scope before results are returned.

### AgentAudit

```text
AgentAudit
- restaurantId: ObjectId (required)
- actorId: ObjectId | null
- actorType: customer | owner | manager | branch_manager | system
- conversationId: ObjectId | null
- messageId: ObjectId | null
- correlationId: string
- agent: customer | operations | knowledge | system
- provider: string | null
- model: string | null
- promptVersion: string | null
- tool: string | null
- action: proposal | authorization | execution | response
- input: redacted bounded object
- output: redacted bounded object
- status: proposed | denied | succeeded | failed
- durationMs: number | null
- createdAt
```

Indexes: `{ restaurantId: 1, createdAt: -1 }` and `{ restaurantId: 1, correlationId: 1 }`.
Application access is append-only. Never store credentials or unnecessary hidden reasoning.

### Reservation

```text
Reservation
- restaurantId: ObjectId (required)
- branchId: ObjectId (required)
- customerId: ObjectId
- customerName
- customerPhone
- tableNumber: string | null
- guestCount: number
- reservationDate: date
- reservationTime: string (branch-local time)
- timezone: string
- status: pending | confirmed | cancelled | completed | no_show
- notes: string | null
- source: whatsapp | admin | api
- idempotencyKey: string | null
- timestamps
```

Indexes: `{ restaurantId: 1, branchId: 1, reservationDate: 1, status: 1 }`,
`{ restaurantId: 1, customerId: 1, reservationDate: -1 }`, and a scoped unique idempotency index
where a key is present. If reservations allocate physical tables, use a unique constraint for
active table/time slots and transactional allocation; otherwise use an atomic capacity counter.
Availability checks alone are not sufficient to prevent overbooking.

### VoiceTranscription

```text
VoiceTranscription
- restaurantId: ObjectId (required)
- branchId: ObjectId | null
- conversationId: ObjectId (required)
- messageId: ObjectId (required)
- providerMediaId: string
- mediaType: string
- mediaSizeBytes: number
- detectedLanguage: string | null
- transcript: string | null
- confidence: number | null
- status: queued | processing | completed | failed | expired
- errorCode: string | null
- expiresAt: date
- timestamps
```

Unique index: `{ restaurantId: 1, messageId: 1 }`. TTL index on `expiresAt` for transient records;
retention must comply with transcript/audio deletion policy. Do not retain raw audio by default.

### CampaignJob (later phase)

`CampaignJob` stores `restaurantId`, campaign ID, audience/snapshot reference, status, progress,
idempotency key, retry/error metadata and timestamps. Index by tenant/status/creation time and a
scoped unique idempotency key. A persisted job is not permission to send; consent, template,
approval, opt-out and rate-limit checks still run at execution time.

### AIRecommendation (later phase)

Store `restaurantId`, optional `branchId`, recommendation type, explanation, evidence window and
metrics, confidence, suggested action, status (`suggested`, `approved`, `dismissed`, `expired`),
expiry and timestamps. Index by tenant/status/creation time. Recommendations are proposals, not
automatically executed actions.

### EventHistory

Store `restaurantId`, optional `branchId`, event type, aggregate ID, event ID, bounded payload,
occurredAt, processedAt and status. Unique index on `{ restaurantId: 1, eventId: 1 }`; index
`{ restaurantId: 1, eventType: 1, occurredAt: -1 }`. Publish through an outbox/transactional
mechanism where possible to avoid losing events between a business write and queue publication.

## Repository pattern

```ts
interface Repository<T> {
  findById(context: TenantContext, id: string): Promise<T | null>;
  find(context: TenantContext, filter: FilterQuery<T>): Promise<T[]>;
  create(context: TenantContext, data: Partial<T>): Promise<T>;
  update(context: TenantContext, id: string, data: Partial<T>): Promise<T | null>;
  delete(context: TenantContext, id: string): Promise<boolean>;
}
```
