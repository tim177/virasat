"use client";

import { useActionState, useState } from "react";

import {
  markFitCallBookedAction,
  saveItemMeasurements,
  type ActionState,
} from "@/app/admin/(panel)/orders/[number]/actions";
import { MeasurementForm } from "@/components/fit/measurement-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { en } from "@/lib/i18n/en";
import type { MeasurementKind, MeasurementSet } from "@/lib/measurements";

import { ActionMessage } from "./order-actions";

const t = en.admin.order;

/** "Mark fit call as booked": stops the reminder and records it in the history and admin log. */
export function MarkFitCallBookedForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(markFitCallBookedAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" variant="secondary" loading={pending} className="self-start">
        {t.markFitCallBooked}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}

/** Corrects a custom-fit piece's measurements after the fit call (logged with before/after). */
export function EditMeasurementsButton({
  orderId,
  itemId,
  title,
  kind,
  measurements,
}: {
  orderId: string;
  itemId: string;
  title: string;
  kind: MeasurementKind;
  measurements: MeasurementSet | null;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionState>(null);

  async function save(set: MeasurementSet): Promise<string | null> {
    const saved = await saveItemMeasurements({ orderId, itemId, set });
    if (!saved?.ok) return saved?.message ?? t.errors.invalid;
    setResult(saved);
    setOpen(false);
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="link"
        className="self-start"
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
      >
        {t.editMeasurements}
        <span className="sr-only"> {en.bag.measurementsFor(title)}</span>
      </Button>
      <ActionMessage state={result} />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.editMeasurementsFor(title)}
        size="wide"
      >
        <MeasurementForm
          kind={kind}
          initial={measurements}
          submitLabel={en.fit.save}
          onSubmit={save}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </div>
  );
}
