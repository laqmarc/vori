import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const sounds = sqliteTable('sounds', {
  ownerId: text('owner_id').notNull(),
  id: text('id').notNull(),
  name: text('name').notNull(),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.id] })]);
