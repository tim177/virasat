"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getMyFitProfiles,
  saveMyFitProfile,
  type ProfileView,
} from "@/app/(shop)/account/fit-profiles/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/field";
import { track } from "@/lib/analytics";
import { en } from "@/lib/i18n/en";
import type { MeasurementKind, MeasurementSet } from "@/lib/measurements";

import { MeasurementForm } from "./measurement-form";

const t = en.fit;

type Props = {
  open: boolean;
  onClose: () => void;
  kind: MeasurementKind;
  initial: MeasurementSet | null;
  title: string;
  submitLabel: string;
  /** Receives the checked measurements; the dialog then closes. */
  onDone: (set: MeasurementSet) => void;
  /** For analytics, e.g. the product slug. */
  source: string;
};

/**
 * The measurement form in a dialog (product page and bag). Signed-in shoppers can fill it from a
 * saved fit profile and save what they enter; guests just enter their measurements.
 */
export function MeasurementDialog(props: Props) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.title} size="wide">
      {/* Rendered only while open, so each opening starts fresh. */}
      <MeasurementDialogBody {...props} />
    </Dialog>
  );
}

function MeasurementDialogBody({ onClose, kind, initial, submitLabel, onDone, source }: Props) {
  const pathname = usePathname();
  // undefined = still loading, null = signed out.
  const [profiles, setProfiles] = useState<ProfileView[] | null | undefined>(undefined);
  const [chosenId, setChosenId] = useState("");
  const [loaded, setLoaded] = useState<ProfileView | null>(null);
  const [save, setSave] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    track("measurement_started", { kind, source });
    let cancelled = false;
    getMyFitProfiles()
      .then((list) => {
        if (!cancelled) setProfiles(list);
      })
      .catch(() => {
        if (!cancelled) setProfiles(null);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, source]);

  const usable = (profiles ?? []).filter((p) => p.kind === kind && p.set !== null);

  function validateName(): boolean {
    if (!save) return true;
    const trimmed = name.trim();
    const ok = trimmed.length > 0 && trimmed.length <= 40;
    setNameError(ok ? null : t.profiles.errors.name);
    return ok;
  }

  async function submit(set: MeasurementSet): Promise<string | null> {
    if (save) {
      const trimmed = name.trim();
      const existing = (profiles ?? []).find((p) => p.name === trimmed);
      const result = await saveMyFitProfile({ id: existing?.id, name: trimmed, set });
      if (!result.ok) {
        if (result.error === "name_taken") return t.profiles.errors.nameTaken;
        if (result.error === "too_many") return t.profiles.errors.tooMany;
        if (result.error === "signed_out") return t.profiles.errors.signedOut;
        return t.profileSaveFailed;
      }
    }
    track("measurement_completed", { kind, unit: set.unit, source, saved_profile: save });
    onDone(set);
    onClose();
    return null;
  }

  const top =
    profiles === null ? (
      <p className="text-body-sm">
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="inline-flex min-h-11 items-center text-crimson-700 underline"
        >
          {t.signInToSave}
        </Link>
      </p>
    ) : usable.length > 0 ? (
      <div className="flex flex-col gap-3 rounded-card bg-sand p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Select
            label={t.useProfile}
            placeholder={t.chooseProfile}
            options={usable.map((p) => ({ value: p.id, label: p.name }))}
            value={chosenId}
            onChange={(event) => setChosenId(event.target.value)}
            className="flex-1"
          />
          <Button
            variant="secondary"
            aria-disabled={!chosenId || undefined}
            onClick={() => {
              const profile = usable.find((p) => p.id === chosenId);
              if (!profile) return;
              setLoaded(profile);
              setName(profile.name);
            }}
          >
            {t.loadProfile}
          </Button>
        </div>
        {loaded ? (
          <p role="status" className="text-body-sm text-emerald-700">
            {t.profileLoaded(loaded.name)}
          </p>
        ) : null}
      </div>
    ) : null;

  const bottom = profiles ? (
    <div className="flex flex-col gap-2">
      <Checkbox
        label={t.saveProfile}
        checked={save}
        onChange={(event) => {
          setSave(event.target.checked);
          if (event.target.checked && !name) setName(loaded?.name ?? t.defaultProfileName);
        }}
      />
      {save ? (
        <Input
          label={t.profileName}
          help={t.profileNameHelp}
          value={name}
          maxLength={40}
          error={nameError ?? undefined}
          onChange={(event) => setName(event.target.value)}
          className="sm:max-w-xs"
        />
      ) : null}
    </div>
  ) : null;

  return (
    <MeasurementForm
      // A loaded profile refills the form.
      key={loaded?.id ?? "initial"}
      kind={kind}
      initial={loaded?.set ?? initial}
      submitLabel={submitLabel}
      onSubmit={submit}
      onCancel={onClose}
      top={top}
      bottom={bottom}
      validateExtra={validateName}
    />
  );
}
