import "dotenv/config";

import pg from "pg";

// Direct, read-mostly database access for browser tests that check what the app saved.
// (Playwright can't load Prisma 7's ES-module client, so tests use plain SQL here.)

let pool: pg.Pool | undefined;

function db(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  return pool;
}

export type TestOrder = {
  id: string;
  number: string;
  status: string;
  currency: string;
  subtotal_cents: number;
  total_cents: number;
  customer_name: string;
  stripe_payment_intent_id: string | null;
  confirmation_sent_at: Date | null;
};

export async function ordersByEmail(email: string): Promise<TestOrder[]> {
  const { rows } = await db().query<TestOrder>(
    `SELECT id, number, status, currency, subtotal_cents, total_cents, customer_name,
            stripe_payment_intent_id, confirmation_sent_at
     FROM orders WHERE email = $1 ORDER BY created_at`,
    [email],
  );
  return rows;
}

export async function orderItems(orderId: string) {
  const { rows } = await db().query<{
    title_snapshot: string;
    size: string | null;
    unit_price_cents: number;
    quantity: number;
  }>(
    `SELECT title_snapshot, size, unit_price_cents, quantity FROM order_items WHERE order_id = $1`,
    [orderId],
  );
  return rows;
}

/** Removes orders created by a test run (items and events go with them). */
export async function deleteOrdersMatching(emailFragment: string): Promise<void> {
  await db().query(`DELETE FROM orders WHERE email LIKE $1`, [`%${emailFragment}%`]);
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
