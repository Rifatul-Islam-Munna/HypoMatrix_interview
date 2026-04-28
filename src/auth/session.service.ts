import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { AuthenticatedUser, SessionValue } from './auth.types';

const SESSION_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class SessionService {
  constructor(private readonly redis: RedisService) {}

  async create(user: AuthenticatedUser): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const value: SessionValue = {
      ...user,
      createdAt: new Date().toISOString(),
    };

    await this.redis
      .getClient()
      .set(this.key(token), JSON.stringify(value), { EX: SESSION_TTL_SECONDS });

    return token;
  }

  async get(token: string): Promise<AuthenticatedUser | null> {
    const raw = await this.redis.getClient().get(this.key(token));

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SessionValue>;

      if (!parsed.id || !parsed.username) {
        return null;
      }

      return { id: parsed.id, username: parsed.username };
    } catch {
      return null;
    }
  }

  private key(token: string): string {
    return `session:${token}`;
  }
}
