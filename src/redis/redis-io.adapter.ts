import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server, ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (error) =>
      console.error('Redis adapter error', error),
    );
    subClient.on('error', (error) =>
      console.error('Redis adapter subscriber error', error),
    );

    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    server.adapter(this.adapterConstructor);

    return server;
  }
}
