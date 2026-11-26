"use client";

import { useActionState, useId, useState } from "react";

import {
  changeOrderStatus,
  resendConfirmationEmail,
  saveOrderNote,
  type ActionState,
} from "@/app/admin/(panel)/orders/[number]/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/field";
import { AlertCircleIcon, CheckIcon } from "@/components/ui/icons";
import { COURIER_IDS } from "@/lib/couriers";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";

const t = en.admin.order;
const courierOptions = COURIER_IDS.map((id) => ({ value: id, label: en.couriers[id] }));

/** Result of the last action: a status message, or an alert for errors. */
function ActionMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  return state.ok ? (
    <p role="status" className="flex items-start gap-2 text-body-sm text-emerald-700">
      <CheckIcon className="mt-0.5 size-4 shrink-0" />
      {state.message}
    </p>
  ) : (
    <p role="alert" className="flex items-start gap-2 text-body-sm text-error">
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      {state.message}
    </p>
  );
}

function HiddenFields({
  orderId,
  status,
  to,
}: {
  orderId: string;
  status: OrderStatus;
  to: OrderStatus;
}) {
  return (
    <>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="expectedFrom" value={status} />
      <input type="hidden" name="to" value={to} />
    </>
  );
}

/** The buttons for the order's allowed next statuses (lib/order-status adminNextStatuses). */
export function OrderStatusActions({
  orderId,
  status,
  next,
}: {
  orderId: string;
  status: OrderStatus;
  next: OrderStatus[];
}) {
  const [dialog, setDialog] = useState<"shipped" | "cancelled" | null>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await changeOrderStatus(previous, formData);
      // Close the dialog once its change has gone through.
      if (result?.ok) setDialog(null);
      return result;
    },
    null,
  );
  const shipFormId = useId();
  const cancelFormId = useId();

  if (next.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <ActionMessage state={state} />
        <p className="text-body-sm text-stone-700">{t.noNextStep}</p>
      </div>
    );
  }

  const simple = next.filter((to) => to !== "shipped" && to !== "cancelled");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {simple.map((to) => (
          <form key={to} action={formAction}>
            <HiddenFields orderId={orderId} status={status} to={to} />
            <Button type="submit" loading={pending}>
              {t.moveTo[to as keyof typeof t.moveTo]}
            </Button>
          </form>
        ))}
        {next.includes("shipped") ? (
          <Button onClick={() => setDialog("shipped")}>{t.moveTo.shipped}</Button>
        ) : null}
        {next.includes("cancelled") ? (
          <Button variant="secondary" onClick={() => setDialog("cancelled")}>
            {t.moveTo.cancelled}
          </Button>
        ) : null}
      </div>
      {dialog === null ? <ActionMessage state={state} /> : null}

      <Dialog
        open={dialog === "shipped"}
        onClose={() => setDialog(null)}
        title={t.moveTo.shipped}
        footer={
          <Button type="submit" form={shipFormId} fullWidth loading={pending}>
            {t.moveTo.shipped}
          </Button>
        }
      >
        <form id={shipFormId} action={formAction} className="flex flex-col gap-4">
          <HiddenFields orderId={orderId} status={status} to="shipped" />
          <p className="text-body-sm text-stone-700">{t.shipIntro}</p>
          <Select
            label={t.courier}
            name="courier"
            options={courierOptions}
            placeholder={t.chooseCourier}
            required
            defaultValue=""
          />
          <Input label={t.trackingNumber} name="trackingNumber" autoComplete="off" required />
          <ActionMessage state={state} />
        </form>
      </Dialog>

      <Dialog
        open={dialog === "cancelled"}
        onClose={() => setDialog(null)}
        title={t.cancelTitle}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {t.keepOrder}
            </Button>
            <Button type="submit" form={cancelFormId} loading={pending}>
              {t.moveTo.cancelled}
            </Button>
          </div>
        }
      >
        <form id={cancelFormId} action={formAction} className="flex flex-col gap-4">
          <HiddenFields orderId={orderId} status={status} to="cancelled" />
          <p className="text-body-sm">{t.cancelIntro}</p>
          <Checkbox label={t.restock} name="restock" defaultChecked />
          <Textarea label={t.reason} help={t.reasonHelp} name="note" optional maxLength={1000} />
          <ActionMessage state={state} />
        </form>
      </Dialog>
    </div>
  );
}

export function OrderNoteForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(saveOrderNote, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Textarea label={t.noteLabel} help={t.noteHelp} name="note" required maxLength={1000} />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="secondary" loading={pending}>
          {t.saveNote}
        </Button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function ResendConfirmationForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(resendConfirmationEmail, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" variant="link" loading={pending} className="self-start">
        {t.resend}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}
