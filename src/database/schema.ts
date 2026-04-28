import { index, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 32 }).primaryKey(),
  username: varchar('username', { length: 24 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const rooms = pgTable(
  'rooms',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    name: varchar('name', { length: 32 }).notNull().unique(),
    createdById: varchar('created_by_id', { length: 32 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameIdx: index('rooms_name_idx').on(table.name),
  }),
);

export const messages = pgTable(
  'messages',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    roomId: varchar('room_id', { length: 32 })
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 32 })
      .notNull()
      .references(() => users.id),
    content: varchar('content', { length: 1000 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    roomCreatedIdx: index('messages_room_created_idx').on(
      table.roomId,
      table.createdAt,
      table.id,
    ),
  }),
);

export type UserRow = typeof users.$inferSelect;
