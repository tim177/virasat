import "server-only";

import { type AdminOrderListParams, orderSearch } from "@/lib/admin-orders-input";
import { getDb } from "@/lib/db";
import type { OrderStatus, Prisma } from "@/lib/generated/prisma/client";

// Reads for the admin orders screens. Callers check requireAdmin() first.

export const ADMIN_ORDERS_PAGE_SIZE = 50;

function searchWhere(q: string | undefined): Prisma.OrderWhereInput {
  if (!q) return {};
  const match = orderSearch(q);
  return "number" in match
    ? { number: match.number }
    : { email: { contains: match.emailContains, mode: "insensitive" } };
}

/** One page of orders, newest first, plus how many there are per status (for the tabs). */
export async function listAdminOrders(params: AdminOrderListParams) {
  const db = getDb();
  const search = searchWhere(params.q);
  const where: Prisma.OrderWhereInput = {
    ...search,
    ...(params.status ? { status: params.status } : {}),
  };

  const [orders, total, byStatus] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * ADMIN_ORDERS_PAGE_SIZE,
      take: ADMIN_ORDERS_PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        customerName: true,
        email: true,
        totalCents: true,
        createdAt: true,
        items: { select: { quantity: true, isCustom: true } },
      },
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: search, _count: { _all: true } }),
  ]);

  const counts = Object.fromEntries(
    byStatus.map((row) => [row.status, row._count._all]),
  ) as Partial<Record<OrderStatus, number>>;
  return {
    orders: orders.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      customerName: order.customerName,
      email: order.email,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      pieces: order.items.reduce((sum, item) => sum + item.quantity, 0),
      hasCustom: order.items.some((item) => item.isCustom),
    })),
    total,
    pages: Math.max(1, Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE)),
    counts,
    countAll: Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0),
  };
}

export type AdminOrderSummary = Awaited<ReturnType<typeof listAdminOrders>>["orders"][number];

/** Everything the order page shows, or null. Event actors are resolved to admin names. */
export async function getAdminOrder(number: string) {
  const db = getDb();
  const order = await db.order.findUnique({
    where: { number },
    include: {
      items: { orderBy: { id: "asc" }, include: { product: { select: { gender: true } } } },
      events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });
  if (!order) return null;

  const adminIds = [
    ...new Set(order.events.map((event) => event.actor).filter((actor) => isUuid(actor))),
  ];
  const admins = adminIds.length
    ? await db.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } })
    : [];
  const adminNames = new Map(admins.map((admin) => [admin.id, admin.name]));

  return {
    ...order,
    events: order.events.map((event) => ({
      ...event,
      actorName: adminNames.get(event.actor) ?? null,
    })),
  };
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
