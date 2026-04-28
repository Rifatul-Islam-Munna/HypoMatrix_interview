import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  public db: NodePgDatabase<typeof schema>;

  async onModuleInit() {
    const connectionString =
      process.env.DATABASE_URL ??
      'postgres://postgres:admin@localhost:5432/group_chat';

    this.pool = new Pool({
      connectionString,
      connectionTimeoutMillis: Number(
        process.env.PG_CONNECTION_TIMEOUT_MS ?? 5000,
      ),
    });
    this.db = drizzle(this.pool, { schema });

    if (process.env.DB_AUTO_MIGRATE !== 'false') {
      await this.ensureSchema();
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private async ensureSchema() {
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id varchar(32) PRIMARY KEY,
        username varchar(24) UNIQUE NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id varchar(32) PRIMARY KEY,
        name varchar(32) UNIQUE NOT NULL,
        created_by_id varchar(32) NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id varchar(32) PRIMARY KEY,
        room_id varchar(32) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        user_id varchar(32) NOT NULL REFERENCES users(id),
        content varchar(1000) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS rooms_name_idx ON rooms(name)
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS messages_room_created_idx
      ON messages(room_id, created_at DESC, id DESC)
    `);
  }
}
