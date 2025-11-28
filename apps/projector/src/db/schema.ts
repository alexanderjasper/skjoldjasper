import {integer, pgTable, text, timestamp} from 'drizzle-orm/pg-core';

export const gameRoomView = pgTable('game_room_view', {
    streamId: text('stream_id').primaryKey(),
    counter: integer('counter').notNull().default(0),
    updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow()
});


