import "server-only";

import { getDb } from "@/lib/db";
import type { OrderStatus } from "@/lib/generated/prisma/client";
import { periodStarts } from "@/lib/report-periods";

// Figures for the admin dashboard. Callers check requireAdmin() first.

/** A published size with this many pieces or fewer is "running low". */
export const LOW_STOCK_AT = 2;

/** How many of those the dashboard lists (sold-out sizes first). */
export const LOW_STOCK_SHOWN = 10;

/** Statuses that wait for the admin to do something, in the order the work happens. */
export const WAITING_STATUSES = [
  "paid",
  "confirmed",
  "in_production",
  "shipped",
] as const satisfies readonly OrderStatus[];

export type Sales = { orders: number; revenueCents: number };

export async function getDashboard(now: Date = new Date()) {
  const db = getDb();
  const periods = periodStarts(now);

  // Paid orders in the period, without cancelled or refunded ones.
  const sales = async (from: Date): Promise<Sales> => {
    const result = await db.order.aggregate({
      where: { paidAt: { gte: from, lte: now }, status: { notIn: ["cancelled", "refunded"] } },
      _count: { _all: true },
      _sum: { totalCents: true },
    });
    return { orders: result._count._all, revenueCents: result._sum.totalCents ?? 0 };
  };

  const lowStockWhere = {
    stock: { not: null, lte: LOW_STOCK_AT },
    product: { status: "published" as const },
  };
  const [today, week, month, waitingRows, lowStock, lowStockTotal, latest] = await Promise.all([
    sales(periods.today),
    sales(periods.week),
    sales(periods.month),
    db.order.groupBy({
      by: ["status"],
      where: { status: { in: [...WAITING_STATUSES] } },
      _count: { _all: true },
    }),
    db.variant.findMany({
      where: lowStockWhere,
      orderBy: [{ stock: "asc" }, { product: { title: "asc" } }, { position: "asc" }],
      take: LOW_STOCK_SHOWN,
      select: { id: true, size: true, stock: true, product: { select: { id: true, title: true } } },
    }),
    db.variant.count({ where: lowStockWhere }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        status: true,
        customerName: true,
        totalCents: true,
        createdAt: true,
      },
    }),
  ]);

  const waitingCounts = new Map(waitingRows.map((row) => [row.status, row._count._all]));
  return {
    sales: { today, week, month },
    waiting: WAITING_STATUSES.map((status) => ({ status, count: waitingCounts.get(status) ?? 0 })),
    lowStock: lowStock.map((v) => ({
      variantId: v.id,
      productId: v.product.id,
      title: v.product.title,
      size: v.size,
      stock: v.stock ?? 0,
    })),
    lowStockTotal,
    latest,
  };
}
