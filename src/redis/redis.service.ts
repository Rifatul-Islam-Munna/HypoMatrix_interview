import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient } from 'redis';

export type AppRedisClient = ReturnType<typeof createClient>;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: AppRedisClient;
  private connectPromise?: Promise<void>;

  async onModuleInit() {
    await this.ensureConnected();
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  getClient(): AppRedisClient {
    if (!this.client) {
      this.client = this.createRedisClient();
    }

    return this.client;
  }

  async duplicate(): Promise<AppRedisClient> {
    await this.ensureConnected();

    const duplicate = this.client.duplicate();
    duplicate.on('error', (error) => {
      console.error('Redis duplicate error', error);
    });
    await duplicate.connect();

    return duplicate;
  }

  private async ensureConnected() {
    if (this.client?.isOpen) {
      return;
    }

    if (!this.client) {
      this.client = this.createRedisClient();
    }

    this.connectPromise ??= this.client.connect().then(() => undefined);
    await this.connectPromise;
  }

  private createRedisClient(): AppRedisClient {
    const client = createClient({
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    });

    client.on('error', (error) => {
      console.error('Redis error', error);
    });

    return client;
  }
}
