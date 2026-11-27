import { randomUUID } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { AdminActor } from "@/lib/admin-log";
import { getAdminOrder, listAdminOrders } from "@/lib/admin-orders";
import { getDb } from "@/lib/db";
import { retryUnsentEmails, sendStatusEmail } from "@/lib/order-emails";
import { InvalidTransitionError } from "@/lib/order-status";
import {
  addOrderNote,
  OrderChangedError,
  recordConfirmationResent,
  transitionOrder,
} from "@/lib/orders";

// Processing orders in the admin, against the real database. Every order, log row and user
// made here is deleted afterwards, and stock is put back.

const db = getDb();
const PREFIX = "cs_test_adm_";
const DOMAIN = "@it-orders.example.com";
let admin: AdminActor & { name: string };
let variant: { id: string; stock: number | null };

beforeAll(async () => {
  const user = await db.user.create({
    data: {
      email: `admin-${randomUUID().slice(0, 8)}${DOMAIN}`,
      name: "Order Admin",
      role: "admin",
    },
  });
  admin = { adminId: user.id, ip: "203.0.113.7", name: user.name };
  const blush = await db.product.findUniqueOrThrow({
    where: { slug: "blush-organza-lehenga" },
    include: { variants: true },
  });
  const sizeS = blush.variants.find((v) => v.size.startsWith("S "))!;
  variant = { id: sizeS.id, stock: sizeS.stock };
});

afterEach(async () => {
  await db.adminLog.deleteMany({ where: { adminUserId: admin.adminId } });
  await db.order.deleteMany({ where: { stripeSessionId: { startsWith: PREFIX } } });
  await db.variant.update({ where: { id: variant.id }, data: { stock: variant.stock } });
});

afterAll(async () => {
  // The status emails these tests sent to .outbox/.
  for (const name of await readdir(".outbox").catch(() => [] as string[])) {
    if (name.includes("it_orders_example_com"))
      await rm(path.join(".outbox", name), { force: true });
  }
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  await db.$disconnect();
});

/** A paid order, as the Stripe webhook would have saved it. */
async function makeOrder(options: { email?: string; custom?: boolean; quantity?: number } = {}) {
  const id = randomUUID().replaceAll("-", "");
  return db.order.create({
    data: {
      email: options.email ?? `buyer-${id.slice(0, 8)}${DOMAIN}`,
      customerName: "Asha Rao",
      shippingAddress: {
        line1: "1 Main St",
        line2: null,
        city: "Edison",
        state: "NJ",
        postalCode: "08817",
        country: "US",
      },
      subtotalCents: 68000,
      totalCents: 68000,
      stripeSessionId: `${PREFIX}${id}`,
      stripePaymentIntentId: `pi_test_adm_${id}`,
      accessToken: id,
      items: {
        create: [
          {
            variantId: variant.id,
            titleSnapshot: "Blush organza lehenga",
            size: "S (US 4–6)",
            unitPriceCents: 68000,
            quantity: options.quantity ?? 1,
            productionDays: 3,
          },
          ...(options.custom
            ? [
                {
                  titleSnapshot: "Emerald velvet lehenga",
                  isCustom: true,
                  unitPriceCents: 98000,
                  quantity: 1,
                  productionDays: 28,
                },
              ]
            : []),
        ],
      },
      events: { create: { toStatus: "paid", actor: "stripe", note: "Paid $680.00" } },
    },
  });
}

const shipment = { courier: "dhl", trackingNumber: "JD014600006281" };

async function outboxFiles(tag: string, email: string) {
  const safe = email.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  const files = await readdir(".outbox").catch(() => [] as string[]);
  return files.filter((f) => f.includes(tag) && f.includes(safe));
}

describe("processing an order", () => {
  it("goes paid → confirmed → in production → shipped → delivered, logged at every step", async () => {
    const order = await makeOrder();
    const as = (to: Parameters<typeof transitionOrder>[1], extra = {}) =>
      transitionOrder(order.id, to, admin.adminId, { admin, ...extra });

    await as("confirmed", { expectedFrom: "paid", note: "Checked the address" });
    await as("in_production", { expectedFrom: "confirmed" });
    await as("shipped", { expectedFrom: "in_production", shipment });
    await as("delivered", { expectedFrom: "shipped" });

    const saved = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    expect(saved).toMatchObject({
      status: "delivered",
      courier: "dhl",
      trackingNumber: "JD014600006281",
    });
    for (const at of [
      saved.confirmedAt,
      saved.inProductionAt,
      saved.shippedAt,
      saved.deliveredAt,
    ]) {
      expect(at).toBeInstanceOf(Date);
    }
    expect(saved.events.map((e) => [e.fromStatus, e.toStatus])).toEqual([
      [null, "paid"],
      ["paid", "confirmed"],
      ["confirmed", "in_production"],
      ["in_production", "shipped"],
      ["shipped", "delivered"],
    ]);
    expect(saved.events[1]).toMatchObject({ actor: admin.adminId, note: "Checked the address" });
    expect(saved.events[3].note).toBe("DHL Express JD014600006281");

    const logs = await db.adminLog.findMany({
      where: { entityId: order.id },
      orderBy: { createdAt: "asc" },
    });
    expect(logs).toHaveLength(4);
    expect(logs[2]).toMatchObject({
      action: "order.status",
      entity: "order",
      ip: "203.0.113.7",
      before: { status: "in_production", courier: null, trackingNumber: null },
      after: { status: "shipped", courier: "dhl", trackingNumber: "JD014600006281" },
    });

    const page = await getAdminOrder(saved.number);
    expect(page?.events[1].actorName).toBe("Order Admin");
    expect(page?.events[0].actorName).toBeNull();
  });

  it("needs a courier and tracking number to ship (in code and in the database)", async () => {
    const order = await makeOrder();
    await transitionOrder(order.id, "confirmed", admin.adminId);
    await transitionOrder(order.id, "in_production", admin.adminId);
    await expect(transitionOrder(order.id, "shipped", admin.adminId)).rejects.toThrow(/tracking/);
    await expect(
      db.order.update({ where: { id: order.id }, data: { status: "shipped" } }),
    ).rejects.toThrow(/orders_shipment_recorded/);
  });

  it("a stale page can't move the order again", async () => {
    const order = await makeOrder();
    await transitionOrder(order.id, "confirmed", admin.adminId, { expectedFrom: "paid", admin });
    await expect(
      transitionOrder(order.id, "cancelled", admin.adminId, { expectedFrom: "paid", admin }),
    ).rejects.toThrow(OrderChangedError);
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.status).toBe("confirmed");
    expect(await db.adminLog.count({ where: { entityId: order.id } })).toBe(1);
  });

  it("refuses moves the rules don't allow", async () => {
    const order = await makeOrder({ custom: true });
    await expect(transitionOrder(order.id, "delivered", admin.adminId, { admin })).rejects.toThrow(
      InvalidTransitionError,
    );
    await transitionOrder(order.id, "confirmed", admin.adminId);
    await transitionOrder(order.id, "in_production", admin.adminId);
    // Custom-fit work has started: it can't be cancelled any more.
    await expect(transitionOrder(order.id, "cancelled", admin.adminId)).rejects.toThrow(
      InvalidTransitionError,
    );
    expect(await db.adminLog.count({ where: { entityId: order.id } })).toBe(0);
  });
});

describe("cancelling", () => {
  it("can put the ready-made pieces back in stock (not custom-fit ones)", async () => {
    const order = await makeOrder({ custom: true, quantity: 2 });
    const before = (await db.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock!;

    const result = await transitionOrder(order.id, "cancelled", admin.adminId, {
      expectedFrom: "paid",
      restock: true,
      note: "Customer asked",
      admin,
    });

    expect(result).toEqual({ from: "paid", to: "cancelled", restocked: 1 });
    expect((await db.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(
      before + 2,
    );
    const event = await db.orderEvent.findFirstOrThrow({
      where: { orderId: order.id, toStatus: "cancelled" },
    });
    expect(event.note).toBe("Ready-made pieces put back in stock · Customer asked");
    const log = await db.adminLog.findFirstOrThrow({ where: { entityId: order.id } });
    expect(log.after).toMatchObject({
      status: "cancelled",
      restockedLines: 1,
      note: "Customer asked",
    });
  });

  it("leaves stock alone without restock", async () => {
    const order = await makeOrder();
    const before = (await db.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock;
    const result = await transitionOrder(order.id, "cancelled", admin.adminId, { admin });
    expect(result.restocked).toBe(0);
    expect((await db.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(before);
  });
});

describe("notes and emails", () => {
  it("records internal notes and resent confirmations in the history and admin_log", async () => {
    const order = await makeOrder();
    await addOrderNote(order.id, "Customer wants it before 12 Dec", admin);
    await recordConfirmationResent(order.id, admin);

    const events = await db.orderEvent.findMany({
      where: { orderId: order.id, toStatus: null },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((e) => [e.actor, e.note])).toEqual([
      [admin.adminId, "Customer wants it before 12 Dec"],
      [admin.adminId, "Confirmation email sent again"],
    ]);
    const logs = await db.adminLog.findMany({
      where: { entityId: order.id },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.action)).toEqual(["order.note", "order.resend_confirmation"]);
  });

  it("sends each status email once", async () => {
    const order = await makeOrder();
    await transitionOrder(order.id, "confirmed", admin.adminId);
    await transitionOrder(order.id, "in_production", admin.adminId);
    await transitionOrder(order.id, "shipped", admin.adminId, { shipment });

    expect(await sendStatusEmail(order.id)).toBe(true);
    expect(await sendStatusEmail(order.id)).toBe(true);
    expect(await outboxFiles("order-shipped", order.email)).toHaveLength(1);
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.statusEmailSentFor).toBe("shipped");
  });

  it("the cron job sends status emails that failed, but not for old changes", async () => {
    const recent = await makeOrder();
    const old = await makeOrder();
    const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);
    // Cancelled without an email (as if sending had failed): 10 minutes ago and 5 days ago.
    for (const [order, at] of [
      [recent, minutesAgo(10)],
      [old, minutesAgo(5 * 24 * 60)],
    ] as const) {
      await transitionOrder(order.id, "cancelled", admin.adminId);
      await db.order.update({ where: { id: order.id }, data: { cancelledAt: at } });
    }

    await retryUnsentEmails();

    expect(
      (await db.order.findUniqueOrThrow({ where: { id: recent.id } })).statusEmailSentFor,
    ).toBe("cancelled");
    expect(await outboxFiles("order-cancelled", recent.email)).toHaveLength(1);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: old.id } })).statusEmailSentFor,
    ).toBeNull();
  });
});

describe("order list", () => {
  it("filters by status and searches by number or email, with counts per status", async () => {
    // Starts with a letter: an all-digit tag would be searched as an order number.
    const tag = `t${randomUUID().slice(0, 8)}`;
    const a = await makeOrder({ email: `priya-${tag}${DOMAIN}` });
    const b = await makeOrder({ email: `meera-${tag}${DOMAIN}` });
    await transitionOrder(b.id, "confirmed", admin.adminId);

    const all = await listAdminOrders({ q: tag, page: 1 });
    expect(all.orders.map((o) => o.number).sort()).toEqual([a.number, b.number].sort());
    expect(all.counts).toEqual({ paid: 1, confirmed: 1 });
    expect(all.countAll).toBe(2);
    expect(all.orders[0]).toMatchObject({ pieces: 1, hasCustom: false, customerName: "Asha Rao" });

    const confirmed = await listAdminOrders({ q: tag, status: "confirmed", page: 1 });
    expect(confirmed.orders.map((o) => o.number)).toEqual([b.number]);
    // Counts ignore the status tab, so every tab shows its own number.
    expect(confirmed.counts).toEqual({ paid: 1, confirmed: 1 });

    const byEmail = await listAdminOrders({ q: `PRIYA-${tag}`, page: 1 });
    expect(byEmail.orders.map((o) => o.number)).toEqual([a.number]);
    const byNumber = await listAdminOrders({ q: a.number.replace("VRS-", ""), page: 1 });
    expect(byNumber.orders.map((o) => o.number)).toEqual([a.number]);
  });
});
