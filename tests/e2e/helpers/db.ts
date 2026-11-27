import "dotenv/config";

import { randomUUID } from "node:crypto";
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

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

/**
 * A paid order for one lehenga, as the Stripe webhook would save it. Returns its number.
 * With `measurements`, the lehenga is a custom-fit piece made to them.
 */
export async function insertTestOrder(
  email: string,
  options: { measurements?: unknown } = {},
): Promise<string> {
  const id = randomUUID().replaceAll("-", "");
  const address = {
    line1: "1 Main St",
    line2: null,
    city: "Edison",
    state: "NJ",
    postalCode: "08817",
    country: "US",
  };
  const { rows } = await db().query<{ number: string }>(
    `WITH o AS (
       INSERT INTO orders (id, email, customer_name, shipping_address, subtotal_cents, total_cents,
                           stripe_session_id, access_token, updated_at)
       VALUES (gen_random_uuid(), $1, 'Asha Rao', $2::jsonb, 68000, 68000, $3, $4, now())
       RETURNING id, number
     ), items AS (
       INSERT INTO order_items (id, order_id, title_snapshot, size, is_custom, measurements,
                                unit_price_cents, quantity, production_days)
       SELECT gen_random_uuid(), id, 'Blush organza lehenga',
              CASE WHEN $5::jsonb IS NULL THEN 'S (US 4–6)' END, $5::jsonb IS NOT NULL, $5::jsonb,
              68000, 1, 3
       FROM o
     ), events AS (
       INSERT INTO order_events (id, order_id, to_status, actor, note)
       SELECT gen_random_uuid(), id, 'paid', 'stripe', 'Paid $680.00' FROM o
     )
     SELECT number FROM o`,
    [
      email,
      JSON.stringify(address),
      `cs_test_e2e_${id}`,
      id,
      options.measurements ? JSON.stringify(options.measurements) : null,
    ],
  );
  return rows[0].number;
}

/** The secret in an order's email link (/orders/VRS-1001?t=...). */
export async function accessTokenFor(number: string): Promise<string> {
  const { rows } = await db().query<{ access_token: string }>(
    `SELECT access_token FROM orders WHERE number = $1`,
    [number],
  );
  return rows[0].access_token;
}

/** Removes products made by a test run, and their photos saved in the local uploads folder. */
export async function deleteProductsMatching(slugFragment: string): Promise<void> {
  const { rows } = await db().query<{ url: string }>(
    `SELECT i.url FROM product_images i JOIN products p ON p.id = i.product_id
     WHERE p.slug LIKE $1 AND i.url LIKE '/uploads/products/%'`,
    [`%${slugFragment}%`],
  );
  await db().query(`DELETE FROM products WHERE slug LIKE $1`, [`%${slugFragment}%`]);
  const dir = path.resolve(process.env.UPLOADS_DIR || "uploads");
  for (const { url } of rows) {
    await rm(path.join(dir, url.replace(/^\/uploads\//, "")), { force: true });
  }
}

/**
 * Removes photos uploaded during a test run that no product uses: an upload from an attempt
 * that failed before saving. Photos older than the run, or still used, are left alone.
 */
export async function deleteUnusedUploadsSince(since: Date): Promise<void> {
  const dir = path.join(path.resolve(process.env.UPLOADS_DIR || "uploads"), "products");
  const names = await readdir(dir).catch(() => [] as string[]);
  const { rows } = await db().query<{ url: string }>(
    `SELECT url FROM product_images WHERE url LIKE '/uploads/products/%'`,
  );
  const used = new Set(rows.map((row) => row.url.replace("/uploads/products/", "")));
  for (const name of names) {
    if (used.has(name)) continue;
    const info = await stat(path.join(dir, name)).catch(() => null);
    if (info && info.mtime >= since) await rm(path.join(dir, name), { force: true });
  }
}

export async function userByEmail(email: string) {
  const { rows } = await db().query<{ id: string; role: string; email_verified: boolean }>(
    `SELECT id, role, email_verified FROM users WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

/** Removes users made by a test run, with their sessions, logins and pending sign-ins. */
export async function deleteUsersMatching(emailFragment: string): Promise<void> {
  const pattern = `%${emailFragment}%`;
  await db().query(
    `WITH u AS (SELECT id::text AS id FROM users WHERE email LIKE $1),
          p AS (SELECT identifier FROM verifications WHERE value IN (SELECT id FROM u))
     DELETE FROM verifications
     WHERE value IN (SELECT id FROM u)
        OR identifier IN (SELECT '2fa-attempts-' || identifier FROM p)`,
    [pattern],
  );
  // Test admins' log rows go too (admin_log keeps real admins from being deleted).
  await db().query(
    `DELETE FROM admin_log WHERE admin_user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
    [pattern],
  );
  await db().query(`DELETE FROM users WHERE email LIKE $1`, [pattern]);
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
