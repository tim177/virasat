import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import type { AdminActor } from "@/lib/admin-log";
import { getAuth } from "@/lib/auth";
import type { Customer } from "@/lib/customer-auth";
import { getCustomerOrder, getOrderByToken, listCustomerOrders } from "@/lib/customer-orders";
import { getDb } from "@/lib/db";
import { sendFitCallReminders } from "@/lib/order-emails";
import {
  markFitCallBooked,
  MeasurementsLockedError,
  transitionOrder,
  updateItemMeasurements,
} from "@/lib/orders";

// Orders as customers see them (account and email link), fit-call reminders, and the admin's
// fit-call and measurement changes, against the real database. Everything made here is deleted.

const sendEmail = vi.hoisted(() =>
  vi.fn<(message: { to: string; subject: string; html: string }) => Promise<{ id: string }>>(
    async () => ({ id: "test" }),
  ),
);
vi.mock("@/lib/email/send", () => ({ sendEmail }));

const db = getDb();
const auth = getAuth();
const PREFIX = "cs_test_cust_";
const DOMAIN = "@it-account.example.com";
const DAY = 24 * 60 * 60 * 1000;
let admin: AdminActor;

const womens = {
  kind: "women" as const,
  unit: "in" as const,
  values: {
    bust: 36,
    underBust: 31,
    shoulder: 14.5,
    armhole: 16,
    upperArm: 11,
    waist: 29,
    hip: 39,
    shoulderToWaist: 15,
    sleeveLength: 8,
    waistToFloor: 41,
    height: 64,
  },
};

beforeAll(async () => {
  const user = await db.user.create({
    data: { email: `admin-${randomUUID().slice(0, 8)}${DOMAIN}`, name: "Fit Admin", role: "admin" },
  });
  admin = { adminId: user.id, ip: "203.0.113.9" };
});

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockImplementation(async () => ({ id: "test" }));
  vi.stubEnv("CALCOM_FIT_CALL_URL", "https://cal.com/virasat-test/fit-call");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await db.adminLog.deleteMany({ where: { adminUserId: admin.adminId } });
  await db.order.deleteMany({ where: { stripeSessionId: { startsWith: PREFIX } } });
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN }, role: "customer" } });
  await db.verification.deleteMany({ where: { identifier: { endsWith: DOMAIN } } });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  await db.$disconnect();
});

const newEmail = (label: string) => `${label}-${randomUUID().slice(0, 8)}${DOMAIN}`;

/** A paid order as the webhook saves it. `paidDaysAgo` moves its payment into the past. */
async function makeOrder(
  options: { email?: string; userId?: string; custom?: boolean; paidDaysAgo?: number } = {},
) {
  const id = randomUUID().replaceAll("-", "");
  const paidAt = new Date(Date.now() - (options.paidDaysAgo ?? 0) * DAY);
  return db.order.create({
    data: {
      email: options.email ?? newEmail("buyer"),
      userId: options.userId ?? null,
      customerName: "Asha Rao",
      shippingAddress: {
        line1: "1 Main St",
        line2: null,
        city: "Edison",
        state: "NJ",
        postalCode: "08817",
        country: "US",
      },
      subtotalCents: 98000,
      totalCents: 98000,
      stripeSessionId: `${PREFIX}${id}`,
      accessToken: `tok${id}`,
      paidAt,
      items: {
        create: [
          options.custom
            ? {
                titleSnapshot: "Emerald velvet lehenga",
                isCustom: true,
                measurements: womens,
                unitPriceCents: 98000,
                quantity: 1,
                productionDays: 28,
              }
            : {
                titleSnapshot: "Blush organza lehenga",
                size: "S (US 4–6)",
                unitPriceCents: 98000,
                quantity: 1,
                productionDays: 3,
              },
        ],
      },
      events: {
        create: [
          { toStatus: "paid", actor: "stripe", note: "Paid $980.00", createdAt: paidAt },
          { actor: admin.adminId, note: "Customer sounds lovely, VIP", createdAt: paidAt },
        ],
      },
    },
    include: { items: true },
  });
}

/** Signs in through the real email-code flow, like /login does. */
async function signIn(email: string): Promise<Customer> {
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
  const message = await vi.waitFor(() => {
    const call = sendEmail.mock.calls.find(([m]) => m.to === email.toLowerCase());
    if (!call) throw new Error("no code email yet");
    return call[0];
  });
  const otp = /^(\d{6}) /.exec(message.subject)?.[1] ?? "";
  const { user } = await auth.api.signInEmailOTP({ body: { email, otp } });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    createdAt: new Date(user.createdAt),
  };
}

describe("orders in the account", () => {
  it("shows a guest's past orders after they sign in with the same email", async () => {
    const email = newEmail("guest");
    // Bought as a guest, before having an account (Stripe kept the capitals they typed).
    const older = await makeOrder({ email: email.toUpperCase(), paidDaysAgo: 30 });
    const newer = await makeOrder({ email });
    const someoneElse = await makeOrder();

    vi.stubEnv("DEV_VERIFICATION_CODE", "");
    const customer = await signIn(email);
    expect(customer.emailVerified).toBe(true);

    const orders = await listCustomerOrders(customer);
    expect(orders.map((o) => o.number)).toEqual([newer.number, older.number]);
    expect(orders[0]).toMatchObject({ pieces: 1, hasCustom: false, totalCents: 98000 });

    expect((await getCustomerOrder(customer, older.number))?.number).toBe(older.number);
    expect(await getCustomerOrder(customer, someoneElse.number)).toBeNull();
  });

  it("includes orders placed while signed in with another email, and nothing for unverified emails", async () => {
    const user = await db.user.create({
      data: { email: newEmail("unverified"), name: "", emailVerified: false },
    });
    const customer: Customer = { ...user, emailVerified: false };
    const signedIn = await makeOrder({ email: newEmail("paid-as"), userId: user.id });
    await makeOrder({ email: user.email }); // same email, but the address was never proven

    expect((await listCustomerOrders(customer)).map((o) => o.number)).toEqual([signedIn.number]);
  });
});

describe("the order page from the email link", () => {
  it("opens with the right token only, and shows status changes but never notes", async () => {
    const order = await makeOrder({ custom: true });
    const found = await getOrderByToken(order.number, order.accessToken);
    expect(found?.number).toBe(order.number);
    expect(found).not.toHaveProperty("accessToken");
    expect(found?.events).toEqual([{ toStatus: "paid", createdAt: order.paidAt }]);
    expect(JSON.stringify(found)).not.toContain("VIP");
    expect(found?.items[0].measurements).toEqual(womens);

    expect(await getOrderByToken(order.number, `${order.accessToken}x`)).toBeNull();
    expect(await getOrderByToken(order.number, "tok-wrong-token-of-any-length")).toBeNull();
    expect(await getOrderByToken("VRS-999999999", order.accessToken)).toBeNull();
  });
});

describe("fit-call reminders", () => {
  it("emails a custom-fit order once, 2 days after payment, with the booking link", async () => {
    const due = await makeOrder({ custom: true, paidDaysAgo: 3 });
    const tooSoon = await makeOrder({ custom: true, paidDaysAgo: 1 });
    const tooOld = await makeOrder({ custom: true, paidDaysAgo: 20 });
    const notCustom = await makeOrder({ paidDaysAgo: 3 });
    const booked = await makeOrder({ custom: true, paidDaysAgo: 3 });
    await markFitCallBooked(booked.id, admin);
    const confirmed = await makeOrder({ custom: true, paidDaysAgo: 3 });
    await transitionOrder(confirmed.id, "confirmed", admin.adminId);

    await sendFitCallReminders();
    const reminders = sendEmail.mock.calls.filter(([m]) =>
      m.subject.startsWith("Book your fit call"),
    );
    const ours = new Set([due, tooSoon, tooOld, notCustom, booked, confirmed].map((o) => o.email));
    const sentTo = reminders.map(([m]) => m.to).filter((to) => ours.has(to));
    expect(sentTo).toEqual([due.email]);
    const html = reminders.find(([m]) => m.to === due.email)?.[0].html ?? "";
    expect(html).toContain("https://cal.com/virasat-test/fit-call?");
    expect(html).toContain(`/orders/${due.number}?t=`);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: due.id } })).fitCallReminderSentAt,
    ).not.toBeNull();

    sendEmail.mockClear();
    await sendFitCallReminders();
    expect(sendEmail.mock.calls.map(([m]) => m.to)).not.toContain(due.email);
  });

  it("tries again the next day when the email fails", async () => {
    const due = await makeOrder({ custom: true, paidDaysAgo: 3 });
    sendEmail.mockImplementation(async (message) => {
      if (message.to === due.email) throw new Error("Resend is down");
      return { id: "test" };
    });
    await sendFitCallReminders();
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: due.id } })).fitCallReminderSentAt,
    ).toBeNull();

    sendEmail.mockImplementation(async () => ({ id: "test" }));
    await sendFitCallReminders();
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: due.id } })).fitCallReminderSentAt,
    ).not.toBeNull();
  });
});

describe("admin: fit calls and measurements", () => {
  it("marks the fit call as booked once, with a log entry", async () => {
    const order = await makeOrder({ custom: true });
    expect(await markFitCallBooked(order.id, admin)).toBe(true);
    expect(await markFitCallBooked(order.id, admin)).toBe(false);
    expect(await markFitCallBooked((await makeOrder()).id, admin)).toBe(false);

    const log = await db.adminLog.findMany({ where: { entityId: order.id } });
    expect(log).toMatchObject([
      {
        action: "order.fit_call_booked",
        before: { fitCallBooked: false },
        after: { fitCallBooked: true },
      },
    ]);
  });

  it("corrects measurements until the order ships, logging before and after", async () => {
    const order = await makeOrder({ custom: true });
    const item = order.items[0];
    const corrected = {
      ...womens,
      values: { ...womens.values, waist: 30.5 },
      notes: "Checked on call",
    };
    await updateItemMeasurements(order.id, item.id, corrected, admin);
    expect((await db.orderItem.findUniqueOrThrow({ where: { id: item.id } })).measurements).toEqual(
      corrected,
    );
    const log = await db.adminLog.findFirstOrThrow({
      where: { entityId: order.id, action: "order.measurements" },
    });
    expect(log.before).toMatchObject({ piece: "Emerald velvet lehenga", "6. Waist": "29 in" });
    expect(log.after).toMatchObject({ "6. Waist": "30.5 in", note: "Checked on call" });

    await expect(
      updateItemMeasurements(
        order.id,
        item.id,
        { ...womens, values: { ...womens.values, waist: 3 } },
        admin,
      ),
    ).rejects.toBeInstanceOf(ZodError);

    await transitionOrder(order.id, "confirmed", admin.adminId);
    await transitionOrder(order.id, "in_production", admin.adminId);
    await transitionOrder(order.id, "shipped", admin.adminId, {
      shipment: { courier: "dhl", trackingNumber: "JD014600006281" },
    });
    await expect(updateItemMeasurements(order.id, item.id, womens, admin)).rejects.toBeInstanceOf(
      MeasurementsLockedError,
    );
  });
});
