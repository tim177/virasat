"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteMyFitProfile } from "@/app/(shop)/account/fit-profiles/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { en } from "@/lib/i18n/en";

const t = en.fit.profiles;

/** "Delete" on a fit profile, with a confirmation step. */
export function DeleteProfileButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setBusy(true);
    setFailed(false);
    const { ok } = await deleteMyFitProfile(id);
    setBusy(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    setOpen(false);
    toast({ title: t.deleted, description: name, tone: "success" });
    router.refresh();
  }

  return (
    <>
      <Button variant="link" onClick={() => setOpen(true)}>
        {t.deleteShort}
        <span className="sr-only"> {name}</span>
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.deleteTitle(name)}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t.keep}
            </Button>
            <Button loading={busy} onClick={confirm}>
              {t.deleteShort}
            </Button>
          </div>
        }
      >
        <p>{t.deleteText}</p>
        {failed ? (
          <p role="alert" className="mt-3 text-body-sm text-error">
            {t.errors.failed}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
