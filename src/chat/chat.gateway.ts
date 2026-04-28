import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { eq } from 'drizzle-orm';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { rooms } from '../database/schema';
import type { AppRedisClient } from '../redis/redis.service';
import { RedisService } from '../redis/redis.service';
import { ActiveUsersService } from './active-users.service';
import {
  MESSAGE_NEW_CHANNEL,
  MessageNewPayload,
  ROOM_DELETED_CHANNEL,
} from './chat-events.service';

type ChatSocketData = {
  user: AuthenticatedUser;
  roomId: string;
};

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;

  private subscriber: AppRedisClient;

  constructor(
    private readonly auth: AuthService,
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly activeUsers: ActiveUsersService,
  ) {}

  async afterInit(server: Server) {
    server.use((socket, next) => {
      void this.authenticateSocket(socket, next);
    });

    this.subscriber = await this.redis.duplicate();
    await this.subscriber.subscribe(MESSAGE_NEW_CHANNEL, (raw) =>
      this.handleMessage(raw),
    );
    await this.subscriber.subscribe(ROOM_DELETED_CHANNEL, (raw) =>
      this.handleRoomDeleted(raw),
    );
  }

  async handleConnection(client: Socket) {
    const data = client.data as ChatSocketData;
    const roomId = data.roomId;
    const username = data.user.username;

    await client.join(roomId);

    const joined = await this.activeUsers.addConnection(
      roomId,
      username,
      client.id,
    );

    client.emit('room:joined', { activeUsers: joined.activeUsers });

    if (joined.isNewUser) {
      client.to(roomId).emit('room:user_joined', {
        username,
        activeUsers: joined.activeUsers,
      });
    }
  }

  async handleDisconnect(client: Socket) {
    await this.removeClient(client, true);
  }

  @SubscribeMessage('room:leave')
  async handleLeave(@ConnectedSocket() client: Socket) {
    await this.removeClient(client, true);
    client.disconnect(true);
  }

  private async authenticateSocket(
    socket: Socket,
    next: (error?: Error) => void,
  ) {
    const token = this.firstQueryValue(socket.handshake.query.token);
    const roomId = this.firstQueryValue(socket.handshake.query.roomId);
    const user = token ? await this.auth.validateSession(token) : null;

    if (!user) {
      next(this.connectionError(401, 'Missing or expired session token'));
      return;
    }

    if (!roomId || !(await this.roomExists(roomId))) {
      next(
        this.connectionError(
          404,
          `Room with id ${roomId ?? ''} does not exist`,
        ),
      );
      return;
    }

    (socket as Socket & { data: ChatSocketData }).data = { user, roomId };
    next();
  }

  private async removeClient(client: Socket, broadcast: boolean) {
    const removed = await this.activeUsers.removeConnection(client.id);

    if (!removed) {
      return;
    }

    await client.leave(removed.roomId);

    if (broadcast && !removed.userStillActive) {
      client.to(removed.roomId).emit('room:user_left', {
        username: removed.username,
        activeUsers: removed.activeUsers,
      });
    }
  }

  private handleMessage(raw: string) {
    const payload = this.parseJson<MessageNewPayload>(raw);

    if (!payload?.roomId || !payload.message) {
      return;
    }

    this.server.local.to(payload.roomId).emit('message:new', payload.message);
  }

  private handleRoomDeleted(raw: string) {
    const payload = this.parseJson<{ roomId?: string }>(raw);

    if (!payload?.roomId) {
      return;
    }

    const roomId = payload.roomId;

    this.server.local.to(roomId).emit('room:deleted', { roomId });

    setTimeout(() => {
      this.server.local.in(roomId).disconnectSockets(true);
    }, 100);
  }

  private async roomExists(roomId: string): Promise<boolean> {
    const room = await this.database.db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      columns: { id: true },
    });

    return Boolean(room);
  }

  private connectionError(code: 401 | 404, message: string): Error {
    const error = new Error(message);
    (error as Error & { data: { code: number; message: string } }).data = {
      code,
      message,
    };

    return error;
  }

  private firstQueryValue(value: string | string[] | undefined): string {
    return Array.isArray(value) ? value[0] : (value ?? '');
  }

  private parseJson<T>(raw: string): T | null {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
