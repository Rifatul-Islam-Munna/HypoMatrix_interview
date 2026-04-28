import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

type SocketState = {
  roomId: string;
  username: string;
};

const SOCKET_STATE_TTL_SECONDS = 25 * 60 * 60;

@Injectable()
export class ActiveUsersService {
  constructor(private readonly redis: RedisService) {}

  async addConnection(roomId: string, username: string, socketId: string) {
    const client = this.redis.getClient();
    const userSocketsKey = this.userSocketsKey(roomId, username);

    await client.set(
      this.socketKey(socketId),
      JSON.stringify({ roomId, username } satisfies SocketState),
      { EX: SOCKET_STATE_TTL_SECONDS },
    );
    await client.sAdd(userSocketsKey, socketId);
    await client.expire(userSocketsKey, SOCKET_STATE_TTL_SECONDS);

    const socketCount = await client.sCard(userSocketsKey);
    const isNewUser = socketCount === 1;

    await client.sAdd(this.roomUsersKey(roomId), username);
    await client.expire(this.roomUsersKey(roomId), SOCKET_STATE_TTL_SECONDS);

    return {
      isNewUser,
      activeUsers: await this.getActiveUsers(roomId),
    };
  }

  async removeConnection(socketId: string) {
    const client = this.redis.getClient();
    const rawState = await client.get(this.socketKey(socketId));

    if (!rawState) {
      return null;
    }

    await client.del(this.socketKey(socketId));

    let state: SocketState;

    try {
      state = JSON.parse(rawState) as SocketState;
    } catch {
      return null;
    }

    const userSocketsKey = this.userSocketsKey(state.roomId, state.username);
    await client.sRem(userSocketsKey, socketId);

    const remainingSockets = await client.sCard(userSocketsKey);
    const userStillActive = remainingSockets > 0;

    if (userStillActive) {
      await client.expire(userSocketsKey, SOCKET_STATE_TTL_SECONDS);
    } else {
      await client.del(userSocketsKey);
      await client.sRem(this.roomUsersKey(state.roomId), state.username);
    }

    return {
      roomId: state.roomId,
      username: state.username,
      userStillActive,
      activeUsers: await this.getActiveUsers(state.roomId),
    };
  }

  async getActiveUsers(roomId: string): Promise<string[]> {
    const users = await this.redis
      .getClient()
      .sMembers(this.roomUsersKey(roomId));

    return users.sort((a, b) => a.localeCompare(b));
  }

  async countActiveUsers(roomId: string): Promise<number> {
    return this.redis.getClient().sCard(this.roomUsersKey(roomId));
  }

  async clearRoom(roomId: string) {
    const client = this.redis.getClient();
    const users = await this.getActiveUsers(roomId);
    const keys = [
      this.roomUsersKey(roomId),
      ...users.map((username) => this.userSocketsKey(roomId, username)),
    ];

    if (keys.length > 0) {
      await client.del(keys);
    }
  }

  private socketKey(socketId: string): string {
    return `socket:${socketId}`;
  }

  private roomUsersKey(roomId: string): string {
    return `room:${roomId}:users`;
  }

  private userSocketsKey(roomId: string, username: string): string {
    return `room:${roomId}:user:${username}:sockets`;
  }
}
