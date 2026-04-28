import { HttpStatus, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ApiException } from '../common/api-exception';
import { toIsoDate } from '../common/date';
import { createId } from '../common/ids';
import { DatabaseService } from '../database/database.service';
import { UserRow, users } from '../database/schema';
import { AuthenticatedUser } from './auth.types';
import { SessionService } from './session.service';

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sessions: SessionService,
  ) {}

  async login(usernameInput: unknown) {
    const username = this.validateUsername(usernameInput);
    const user = await this.getOrCreateUser(username);
    const sessionToken = await this.sessions.create({
      id: user.id,
      username: user.username,
    });

    return {
      sessionToken,
      user: this.toUserDto(user),
    };
  }

  async validateSession(token: string): Promise<AuthenticatedUser | null> {
    if (!token) {
      return null;
    }

    return this.sessions.get(token);
  }

  private async getOrCreateUser(username: string): Promise<UserRow> {
    const existing = await this.database.db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existing) {
      return existing;
    }

    const [created] = await this.database.db
      .insert(users)
      .values({ id: createId('usr'), username })
      .onConflictDoNothing({ target: users.username })
      .returning();

    if (created) {
      return created;
    }

    const raced = await this.database.db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!raced) {
      throw new ApiException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'USER_CREATE_FAILED',
        'Could not create user',
      );
    }

    return raced;
  }

  private validateUsername(value: unknown): string {
    if (typeof value !== 'string') {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'username is required',
      );
    }

    const username = value.trim();

    if (username.length < 2 || username.length > 24) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'username must be between 2 and 24 characters',
      );
    }

    if (!USERNAME_PATTERN.test(username)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'username may contain only letters, numbers, and underscores',
      );
    }

    return username;
  }

  private toUserDto(user: UserRow) {
    return {
      id: user.id,
      username: user.username,
      createdAt: toIsoDate(user.createdAt),
    };
  }
}
