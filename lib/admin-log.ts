import "server-only";

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
