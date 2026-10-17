import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
  uuid,
} from 'drizzle-orm/pg-core';
import { products } from './products';

export const naverOrderSyncState = pgTable('naver_order_sync_state', {
  mode: text('mode').primaryKey(),
  identity: text('identity').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  cursor: timestamp('cursor', { withTimezone: true }).notNull(),
  inventoryEnabled: boolean('inventory_enabled').notNull(),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastError: text('last_error'),
});

export const naverOrderInventory = pgTable(
  'naver_order_inventory',
  {
    mode: text('mode').notNull(),
    productOrderId: text('product_order_id').notNull(),
    orderId: text('order_id').notNull(),
    payProductId: text('pay_product_id').notNull(),
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    quantity: integer('quantity').notNull(),
    cancelledQuantity: integer('cancelled_quantity').notNull(),
    consumed: integer('consumed').notNull(),
    appliedConsumed: integer('applied_consumed').notNull(),
    status: text('status').notNull(),
    paymentDate: timestamp('payment_date', { withTimezone: true }),
    lastChangedDate: timestamp('last_changed_date', {
      withTimezone: true,
    }).notNull(),
    manualReview: boolean('manual_review').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.mode, table.productOrderId] })],
);
