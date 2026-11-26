"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";

import type { AdminActor } from "@/lib/admin-log";
import { requireAdmin } from "@/lib/admin-auth";
import {
  firstIssue,
  formFields,
  orderIdSchema,
  orderNoteSchema,
  statusChangeSchema,
} from "@/lib/admin-orders-input";
import { refreshShop } from "@/lib/cache-refresh";
import { en } from "@/lib/i18n/en";
import { resendConfirmation, sendStatusEmail } from "@/lib/order-emails";
import { InvalidTransitionError, sendsStatusEmail } from "@/lib/order-status";
import {
  addOrderNote,
  OrderChangedError,
  recordConfirmationResent,
  transitionOrder,
} from "@/lib/orders";
import { clientIpFromHeaders } from "@/lib/rate-limit";

// Admin actions on one order. Each checks the admin first (rule 7), validates with Zod (rule 8),
// changes the order through lib/orders (rule 3) and sends emails only afterwards (rule 4).

export type ActionState = { ok: boolean; message: string } | null;

const t = en.admin.order;

async function adminActor(): Promise<AdminActor> {
  const admin = await requireAdmin();
  return { adminId: admin.id, ip: clientIpFromHeaders(await headers()) };
}

export async function changeOrderStatus(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await adminActor();
  const parsed = statusChangeSchema.safeParse(formFields(formData));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const input = parsed.data;

  try {
    const result = await transitionOrder(input.orderId, input.to, actor.adminId, {
      expectedFrom: input.expectedFrom,
      note: input.note,
      shipment:
        input.to === "shipped"
          ? { courier: input.courier, trackingNumber: input.trackingNumber }
          : undefined,
      restock: input.to === "cancelled" ? input.restock : false,
      admin: actor,
    });
    if (result.restocked > 0) refreshShop();
  } catch (error) {
    if (error instanceof OrderChangedError) {
      refresh();
      return { ok: false, message: t.errors.stale };
    }
    if (error instanceof InvalidTransitionError) return { ok: false, message: t.errors.notAllowed };
    throw error;
  }

  if (sendsStatusEmail(input.to)) after(() => sendStatusEmail(input.orderId));
  refresh();
  return { ok: true, message: t.changed(en.orderStatus[input.to]) };
}

export async function saveOrderNote(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await adminActor();
  const parsed = orderNoteSchema.safeParse(formFields(formData));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  await addOrderNote(parsed.data.orderId, parsed.data.note, actor);
  refresh();
  return { ok: true, message: t.noteSaved };
}

export async function resendConfirmationEmail(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await adminActor();
  const parsed = orderIdSchema.safeParse(formFields(formData));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  try {
    await resendConfirmation(parsed.data.orderId);
  } catch (error) {
    console.error(`[admin] resend confirmation for ${parsed.data.orderId} failed`, error);
    return { ok: false, message: t.resendFailed };
  }
  await recordConfirmationResent(parsed.data.orderId, actor);
  refresh();
  return { ok: true, message: t.resent };
}
