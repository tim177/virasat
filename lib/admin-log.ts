import "server-only";

import { getDb } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";

// admin_log: one row per admin change, written inside the same transaction as the change, so
// a change and its log entry are saved together or not at all (CLAUDE.md rule 7).

/** Who made a change, and from which IP address. */
export type AdminActor = { adminId: string; ip: string | null };

export type AdminLogEntry = {
  action: string;
  entity: "order" | "product";
  entityId: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
};

export async function writeAdminLog(
  tx: Prisma.TransactionClient,
  actor: AdminActor,
  entry: AdminLogEntry,
): Promise<void> {
  await tx.adminLog.create({
    data: {
      adminUserId: actor.adminId,
      ip: actor.ip,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: entry.before ?? Prisma.JsonNull,
      after: entry.after ?? Prisma.JsonNull,
    },
  });
}

export const ADMIN_LOG_PAGE_SIZE = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One page of the admin log, newest first, with the admin's name and a link to what changed
 * (the order number or the product name). Callers check requireAdmin() first.
 */
export async function listAdminLog(params: { entity?: "order" | "product"; page: number }) {
  const db = getDb();
  const where = params.entity ? { entity: params.entity } : {};
  const [rows, total] = await Promise.all([
    db.adminLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (params.page - 1) * ADMIN_LOG_PAGE_SIZE,
      take: ADMIN_LOG_PAGE_SIZE,
      include: { admin: { select: { name: true, email: true } } },
    }),
    db.adminLog.count({ where }),
  ]);

  const idsOf = (entity: string) =>
    rows.filter((row) => row.entity === entity && UUID.test(row.entityId)).map((r) => r.entityId);
  const [orders, products] = await Promise.all([
    db.order.findMany({
      where: { id: { in: idsOf("order") } },
      select: { id: true, number: true },
    }),
    db.product.findMany({
      where: { id: { in: idsOf("product") } },
      select: { id: true, title: true },
    }),
  ]);
  const orderNumbers = new Map(orders.map((o) => [o.id, o.number]));
  const productTitles = new Map(products.map((p) => [p.id, p.title]));

  /** What the entry is about, as a link; null if it no longer exists. */
  const targetOf = (entity: string, id: string) => {
    if (entity === "order") {
      const number = orderNumbers.get(id);
      return number ? { name: number, href: `/admin/orders/${number}` } : null;
    }
    const title = productTitles.get(id);
    return title ? { name: title, href: `/admin/products/${id}` } : null;
  };

  return {
    entries: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      adminName: row.admin.name,
      adminEmail: row.admin.email,
      action: row.action,
      entity: row.entity,
      target: targetOf(row.entity, row.entityId),
      before: row.before,
      after: row.after,
      ip: row.ip,
    })),
    total,
    pages: Math.max(1, Math.ceil(total / ADMIN_LOG_PAGE_SIZE)),
  };
}

export type AdminLogEntryView = Awaited<ReturnType<typeof listAdminLog>>["entries"][number];
