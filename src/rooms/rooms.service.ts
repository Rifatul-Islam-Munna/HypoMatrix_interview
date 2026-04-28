import { HttpStatus, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { AuthenticatedUser } from '../auth/auth.types';
import { ActiveUsersService } from '../chat/active-users.service';
import { ChatEventsService } from '../chat/chat-events.service';
import { ApiException } from '../common/api-exception';
import { toIsoDate } from '../common/date';
import { createId } from '../common/ids';
import { DatabaseService } from '../database/database.service';
import { messages, rooms, users } from '../database/schema';

const ROOM_NAME_PATTERN = /^[A-Za-z0-9-]+$/;

@Injectable()
export class RoomsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly activeUsers: ActiveUsersService,
    private readonly chatEvents: ChatEventsService,
  ) {}

  async listRooms() {
    const rows = await this.database.db
      .select({
        id: rooms.id,
        name: rooms.name,
        createdBy: users.username,
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .innerJoin(users, eq(rooms.createdById, users.id))
      .orderBy(rooms.createdAt);

    const withActiveUsers = await Promise.all(
      rows.map(async (room) => ({
        ...room,
        activeUsers: await this.activeUsers.countActiveUsers(room.id),
        createdAt: toIsoDate(room.createdAt),
      })),
    );

    return { rooms: withActiveUsers };
  }

  async createRoom(nameInput: unknown, user: AuthenticatedUser) {
    const name = this.validateRoomName(nameInput);
    const [room] = await this.database.db
      .insert(rooms)
      .values({ id: createId('room'), name, createdById: user.id })
      .onConflictDoNothing({ target: rooms.name })
      .returning();

    if (!room) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'ROOM_NAME_TAKEN',
        'A room with this name already exists',
      );
    }

    return {
      id: room.id,
      name: room.name,
      createdBy: user.username,
      createdAt: toIsoDate(room.createdAt),
    };
  }

  async getRoom(roomId: string) {
    const room = await this.findRoom(roomId);

    if (!room) {
      throw this.roomNotFound(roomId);
    }

    return {
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      activeUsers: await this.activeUsers.countActiveUsers(room.id),
      createdAt: toIsoDate(room.createdAt),
    };
  }

  async deleteRoom(roomId: string, user: AuthenticatedUser) {
    const room = await this.findRoom(roomId);

    if (!room) {
      throw this.roomNotFound(roomId);
    }

    if (room.createdById !== user.id) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        'Only the room creator can delete this room',
      );
    }

    await this.chatEvents.publishRoomDeleted(roomId);
    await this.database.db.delete(rooms).where(eq(rooms.id, roomId));
    await this.activeUsers.clearRoom(roomId);

    return { deleted: true };
  }

  async listMessages(roomId: string, limitInput?: unknown, before?: unknown) {
    await this.ensureRoomExists(roomId);

    const limit = this.validateLimit(limitInput);
    const cursor =
      typeof before === 'string' && before.trim()
        ? await this.findMessageCursor(roomId, before.trim())
        : null;

    if (before && !cursor) {
      return { messages: [], hasMore: false, nextCursor: null };
    }

    const roomCondition = eq(messages.roomId, roomId);
    const cursorCondition = cursor
      ? or(
          lt(messages.createdAt, cursor.createdAt),
          and(
            eq(messages.createdAt, cursor.createdAt),
            lt(messages.id, cursor.id),
          ),
        )
      : undefined;

    const rows = await this.database.db
      .select({
        id: messages.id,
        roomId: messages.roomId,
        username: users.username,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(
        cursorCondition ? and(roomCondition, cursorCondition) : roomCondition,
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;

    return {
      messages: page.map((message) => ({
        ...message,
        createdAt: toIsoDate(message.createdAt),
      })),
      hasMore,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async sendMessage(
    roomId: string,
    contentInput: unknown,
    user: AuthenticatedUser,
  ) {
    await this.ensureRoomExists(roomId);
    const content = this.validateMessageContent(contentInput);

    const [message] = await this.database.db
      .insert(messages)
      .values({
        id: createId('msg'),
        roomId,
        userId: user.id,
        content,
      })
      .returning();

    const response = {
      id: message.id,
      roomId: message.roomId,
      username: user.username,
      content: message.content,
      createdAt: toIsoDate(message.createdAt),
    };

    await this.chatEvents.publishMessage({
      roomId,
      message: {
        id: response.id,
        username: response.username,
        content: response.content,
        createdAt: response.createdAt,
      },
    });

    return response;
  }

  private async findRoom(roomId: string) {
    const [room] = await this.database.db
      .select({
        id: rooms.id,
        name: rooms.name,
        createdById: rooms.createdById,
        createdBy: users.username,
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .innerJoin(users, eq(rooms.createdById, users.id))
      .where(eq(rooms.id, roomId))
      .limit(1);

    return room;
  }

  private async ensureRoomExists(roomId: string) {
    const room = await this.database.db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      columns: { id: true },
    });

    if (!room) {
      throw this.roomNotFound(roomId);
    }
  }

  private async findMessageCursor(roomId: string, messageId: string) {
    return this.database.db.query.messages.findFirst({
      where: and(eq(messages.roomId, roomId), eq(messages.id, messageId)),
      columns: { id: true, createdAt: true },
    });
  }

  private validateRoomName(value: unknown): string {
    if (typeof value !== 'string') {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'room name is required',
      );
    }

    const name = value.trim();

    if (name.length < 3 || name.length > 32) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'room name must be between 3 and 32 characters',
      );
    }

    if (!ROOM_NAME_PATTERN.test(name)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'room name may contain only letters, numbers, and hyphens',
      );
    }

    return name;
  }

  private validateMessageContent(value: unknown): string {
    if (typeof value !== 'string') {
      throw new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'MESSAGE_EMPTY',
        'Message content must not be empty',
      );
    }

    const content = value.trim();

    if (!content) {
      throw new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'MESSAGE_EMPTY',
        'Message content must not be empty',
      );
    }

    if (content.length > 1000) {
      throw new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'MESSAGE_TOO_LONG',
        'Message content must not exceed 1000 characters',
      );
    }

    return content;
  }

  private validateLimit(value: unknown): number {
    if (value === undefined) {
      return 50;
    }

    const limit = Number(value);

    if (!Number.isInteger(limit) || limit < 1) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'limit must be a positive integer',
      );
    }

    return Math.min(limit, 100);
  }

  private roomNotFound(roomId: string) {
    return new ApiException(
      HttpStatus.NOT_FOUND,
      'ROOM_NOT_FOUND',
      `Room with id ${roomId} does not exist`,
    );
  }
}
