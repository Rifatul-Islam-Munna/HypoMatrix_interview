# Anonymous Chat API Architecture

## Overview

```text
REST clients -> Nest controllers -> services -> Drizzle ORM -> PostgreSQL
                                 -> Redis sessions / active users / pub-sub

Socket.io clients -> /chat gateway -> Redis active-user keys
                                 -> Socket.io Redis adapter for cross-instance events

POST message -> DB insert -> Redis publish -> every gateway subscriber -> local sockets
DELETE room  -> Redis publish -> clients receive room:deleted -> DB cascade delete
```

The app is one NestJS service with REST controllers under `/api/v1`, Swagger at `/docs`, and a Socket.io namespace at `/chat`. PostgreSQL stores durable users, rooms, and messages. Redis stores short-lived session and connection state, tracks active room users, carries app-level chat events, and backs the Socket.io Redis adapter.

DTOs with `class-validator` document and validate request bodies. A global interceptor wraps all REST success responses. A global exception filter wraps all REST errors.

## Session Strategy

`POST /api/v1/login` validates the username, gets or creates a PostgreSQL user, then generates a 32-byte random opaque token. Redis stores it as `session:<token>` with a 24 hour TTL. The value contains the user id and username.

REST routes require `Authorization: Bearer <sessionToken>` except `/login`. Expired or missing tokens return the required `UNAUTHORIZED` envelope. WebSocket connections pass the same token as `?token=...`; invalid tokens fail the Socket.io handshake with code `401`.

## Redis Pub/Sub Fan-Out

Messages are not emitted directly from REST controllers. `POST /rooms/:id/messages` writes the message through Drizzle, then publishes a `chat:message:new` payload to Redis. Every server instance has a gateway subscriber. Each gateway emits the resulting `message:new` event only to its local sockets in that room, preventing duplicate cross-instance broadcasts.

Room deletion works through `chat:room:deleted`; gateways emit `room:deleted` locally and disconnect clients shortly after delivery.

Socket.io also uses `@socket.io/redis-adapter`, so gateway-originated events such as `room:user_joined` and `room:user_left` reach clients connected to other instances.

## Active Users And Connection State

Active room users live in Redis:

- `room:<roomId>:users`
- `room:<roomId>:user:<username>:sockets`
- `socket:<socketId>`

This avoids in-memory JS maps for connection state. Multiple tabs from one username count as one active user. A username leaves the active set only after its last socket disconnects or emits `room:leave`.

## Single-Instance Capacity Estimate

A modest 1 vCPU / 512 MB instance should handle roughly 1,000 to 3,000 concurrent idle WebSocket clients, assuming Redis and PostgreSQL run outside the app instance. Actual message throughput depends on write volume because every message is one PostgreSQL insert plus one Redis publish. With short messages and indexed room history, a safe starting target is about 100 to 300 messages per second before tuning.

Main constraints are Node.js event-loop pressure, Socket.io connection memory, PostgreSQL write latency, Redis latency, and adapter traffic.

## Scaling To 10x

To scale 10x:

- Run multiple stateless NestJS instances behind a load balancer.
- Use managed Redis sized for Socket.io adapter traffic and pub/sub fan-out.
- Use managed PostgreSQL with connection pooling such as PgBouncer.
- Add read replicas or cache room lists if `/rooms` becomes hot.
- Partition message history by room or time when message volume grows.
- Add metrics for event-loop lag, Redis latency, DB pool saturation, WebSocket connection count, and message publish lag.

## Limitations And Trade-Offs

- Startup can auto-create tables for fast local setup. Production should use explicit Drizzle migrations.
- Active-user keys have TTLs to reduce stale state after crashes; a hard process kill can leave active users visible until TTL cleanup.
- Cursor pagination uses `(createdAt, id)` ordering. This is good enough for the generated ids and indexed query shape here.
- Usernames are identity. Anyone can claim an existing username and receive a fresh session token, per task requirements.

