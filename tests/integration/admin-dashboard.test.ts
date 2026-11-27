import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getDashboard } from "@/lib/admin-dashboard";
import { listAdminLog, writeAdminLog, type AdminActor } from "@/lib/admin-log";
import { getDb } from "@/lib/db";
import type { OrderStatus } from "@/lib/generated/prisma/client";
import { periodStarts } from "@/lib/report-periods";

// The admin dashboard and admin log against the real database. Figures are compared before
// and after adding test orders, so other orders in the database don't matter. Everything
// made here is deleted afterwards and stock is put back.

const db = getDb();
const PREFIX = "cs_test_dash_";
const DOMAIN = "@it-dashboard.example.com";
let admin: AdminActor;
let variant: { id: string; stock: number | null };

beforeAll(async () => {
  const user = await db.user.create({
    data: {
      email: `admin-${randomUUID().slice(0, 8)}${DOMAIN}`,
      name: "Dash Admin",
      role: "admin",
    },
  });
  admin = { adminId: user.id, ip: null };
  const product = await db.product.findUniqueOrThrow({
    where: { slug: "ruby-banarasi-silk-saree" },
    include: { variants: { take: 1, orderBy: { position: "asc" } } },
  });
  variant = { id: product.variants[0].id, stock: product.variants[0].stock };
});

afterEach(async () => {
  await db.adminLog.deleteMany({ where: { adminUserId: admin.adminId } });
  await db.order.deleteMany({ where: { stripeSessionId: { startsWith: PREFIX } } });
  await db.variant.update({ where: { id: variant.id }, data: { stock: variant.stock } });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  await db.$disconnect();
});

async function makeOrder(status: OrderStatus, paidAt: Date, totalCents = 68000) {
  const id = randomUUID().replaceAll("-", "");
  return db.order.create({
    data: {
      email: `buyer-${id.slice(0, 8)}${DOMAIN}`,
      customerName: "Asha Rao",
      shippingAddress: {
        line1: "1 Main St",
        line2: null,
        city: "Edison",
        state: "NJ",
        postalCode: "08817",
        country: "US",
      },
      subtotalCents: totalCents,
      totalCents,
      status,
      paidAt,
      ...(status === "cancelled" ? { cancelledAt: paidAt } : {}),
      // Shipped and delivered orders always record the courier (database rule).
      ...(status === "shipped" || status === "delivered"
        ? { courier: "dhl", trackingNumber: "JD014600006281" }
        : {}),
      stripeSessionId: `${PREFIX}${id}`,
      accessToken: id,
    },
  });
}

describe("dashboard", () => {
  it("adds up paid orders by period, without cancelled ones or older orders", async () => {
    const now = new Date();
    const before = await getDashboard(now);

    await makeOrder("paid", new Date(now.getTime() - 60_000), 68000);
    await makeOrder("confirmed", new Date(now.getTime() - 120_000), 12000);
    await makeOrder("cancelled", new Date(now.getTime() - 60_000), 99000);
    const lastMonth = new Date(periodStarts(now).month.getTime() - 24 * 60 * 60 * 1000);
    await makeOrder("delivered", lastMonth, 45000);

    const after = await getDashboard(now);
    for (const period of ["today", "week", "month"] as const) {
      expect(after.sales[period].orders - before.sales[period].orders).toBe(2);
      expect(after.sales[period].revenueCents - before.sales[period].revenueCents).toBe(80000);
    }

    const waiting = (data: typeof after, status: string) =>
      data.waiting.find((row) => row.status === status)!.count;
    expect(after.waiting.map((row) => row.status)).toEqual([
      "paid",
      "confirmed",
      "in_production",
      "shipped",
    ]);
    expect(waiting(after, "paid") - waiting(before, "paid")).toBe(1);
    expect(waiting(after, "confirmed") - waiting(before, "confirmed")).toBe(1);
    expect(after.latest.length).toBeGreaterThan(0);
  });

  it("lists published sizes that are running low, sold-out ones first", async () => {
    await db.variant.update({ where: { id: variant.id }, data: { stock: 50 } });
    const before = await getDashboard();
    expect(before.lowStock.some((row) => row.variantId === variant.id)).toBe(false);

    await db.variant.update({ where: { id: variant.id }, data: { stock: 0 } });
    const after = await getDashboard();
    expect(after.lowStockTotal - before.lowStockTotal).toBe(1);
    expect(after.lowStock.length).toBeLessThanOrEqual(10);
    expect(after.lowStock.find((row) => row.variantId === variant.id)).toMatchObject({
      title: "Ruby Banarasi silk saree",
      stock: 0,
    });
    // Sold-out sizes come first.
    const stocks = after.lowStock.map((row) => row.stock);
    expect(stocks).toEqual([...stocks].sort((a, b) => a - b));
  });
});

describe("admin log", () => {
  it("lists changes newest first, with what they were about", async () => {
    const order = await makeOrder("paid", new Date());
    const product = await db.product.findUniqueOrThrow({
      where: { slug: "ruby-banarasi-silk-saree" },
    });
    await db.$transaction((tx) =>
      writeAdminLog(tx, admin, {
        action: "product.update",
        entity: "product",
        entityId: product.id,
        before: { priceCents: 1 },
        after: { priceCents: 2 },
      }),
    );
    await db.$transaction((tx) =>
      writeAdminLog(tx, admin, {
        action: "order.note",
        entity: "order",
        entityId: order.id,
        after: { note: "Call her" },
      }),
    );

    const mine = (entries: Awaited<ReturnType<typeof listAdminLog>>["entries"]) =>
      entries.filter((entry) => entry.adminName === "Dash Admin");
    const all = mine((await listAdminLog({ page: 1 })).entries);
    expect(all.map((entry) => entry.action)).toEqual(["order.note", "product.update"]);
    expect(all[0].target).toEqual({ name: order.number, href: `/admin/orders/${order.number}` });
    expect(all[1].target).toEqual({
      name: "Ruby Banarasi silk saree",
      href: `/admin/products/${product.id}`,
    });

    const productsOnly = mine((await listAdminLog({ entity: "product", page: 1 })).entries);
    expect(productsOnly.map((entry) => entry.action)).toEqual(["product.update"]);

    // A deleted order is still in the log, just without a link.
    await db.order.delete({ where: { id: order.id } });
    expect(mine((await listAdminLog({ page: 1 })).entries)[0].target).toBeNull();
  });
});
