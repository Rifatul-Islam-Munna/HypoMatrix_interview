import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export const MESSAGE_NEW_CHANNEL = 'chat:message:new';
export const ROOM_DELETED_CHANNEL = 'chat:room:deleted';

export type MessageNewPayload = {
  roomId: string;
  message: {
    id: string;
    username: string;
    content: string;
    createdAt: string;
  };
};

@Injectable()
export class ChatEventsService {
  constructor(private readonly redis: RedisService) {}

  async publishMessage(payload: MessageNewPayload) {
    await this.redis
      .getClient()
      .publish(MESSAGE_NEW_CHANNEL, JSON.stringify(payload));
  }

  async publishRoomDeleted(roomId: string) {
    await this.redis
      .getClient()
      .publish(ROOM_DELETED_CHANNEL, JSON.stringify({ roomId }));
  }
}
