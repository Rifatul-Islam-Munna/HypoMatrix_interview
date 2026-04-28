# Anonymous Chat API

NestJS + PostgreSQL + Drizzle ORM + Redis + Socket.io backend for the interview contract.

## Requirements

- Node.js 22+
- PostgreSQL
- Redis at `redis://localhost:6379` or `REDIS_URL`

## Setup

```bash
npm install
cp .env.example .env
```

Create the PostgreSQL database from `DATABASE_URL`, then run:

```bash
npm run db:push
npm run start:dev
```

Docker helper:

```bash
# if Redis already runs locally, start only PostgreSQL
docker compose up -d postgres

# or start both
docker compose up -d postgres redis
```

By default the app also creates missing tables at startup (`DB_AUTO_MIGRATE=true`) for fast local runs.

## URLs

REST base:

```text
http://localhost:3000/api/v1
```

Swagger:

```text
http://localhost:3000/docs
```

WebSocket namespace:

```text
http://localhost:3000/chat?token=<sessionToken>&roomId=<roomId>
```

## Scripts

```bash
npm run build
npm run start
npm run start:dev
npm run start:prod
npm run db:generate
npm run db:migrate
npm run db:push
npm run lint
```

## Quick Check

Login:

```bash
curl -s -X POST http://localhost:3000/api/v1/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"ali_123\"}"
```

List rooms:

```bash
curl -s http://localhost:3000/api/v1/rooms \
  -H "Authorization: Bearer <sessionToken>"
```

Create room:

```bash
curl -s -X POST http://localhost:3000/api/v1/rooms \
  -H "Authorization: Bearer <sessionToken>" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"general\"}"
```

Send message:

```bash
curl -s -X POST http://localhost:3000/api/v1/rooms/<roomId>/messages \
  -H "Authorization: Bearer <sessionToken>" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"hello everyone\"}"
```

## Environment

- `PORT` default `3000`
- `DATABASE_URL` default `postgres://postgres:postgres@localhost:5432/group_chat`
- `REDIS_URL` default `redis://localhost:6379`
- `DB_AUTO_MIGRATE` default enabled; set `false` in production

## API Shape

## Example socket io

```
import io from 'socket.io-client';

const socket = io('/chat', {
query: {
token: '<sessionToken>', // Your auth token
roomId: '<roomId>' // The room ID
}
});

socket.on('room:joined', (data) => {
console.log('Joined room with active users:', data.activeUsers);
});

socket.on('message:new', (message) => {
console.log('New message:', message);
// message structure: { id, username, content, createdAt }
});

socket.on('room:user_joined', (data) => {
console.log(`${data.username} joined, active users:`, data.activeUsers);
});

socket.on('room:user_left', (data) => {
console.log(`${data.username} left, active users:`, data.activeUsers);
});

socket.on('room:deleted', (data) => {
console.log(`Room ${data.roomId} deleted`);
socket.disconnect();
});

socket.on('connect_error', (error) => {
console.error('Connection failed:', error.message);
});

```

Every REST success:

```json
{ "success": true, "data": {} }
```

Every REST error:

```json
{
  "success": false,
  "error": {
    "code": "SNAKE_CASE_ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

See `ARCHITECTURE.md` for design, Redis, scaling, and trade-offs.
