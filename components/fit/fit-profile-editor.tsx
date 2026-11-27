"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveMyFitProfile } from "@/app/(shop)/account/fit-profiles/actions";
import { RadioGroup } from "@/components/ui/choice";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { en } from "@/lib/i18n/en";
import { MEASUREMENT_KINDS, type MeasurementKind, type MeasurementSet } from "@/lib/measurements";

import { MeasurementForm } from "./measurement-form";

const t = en.fit.profiles;

/** Add or edit a fit profile on the account pages. */
export function FitProfileEditor({
  profile,
}: {
  profile: { id: string; name: string; kind: MeasurementKind; set: MeasurementSet | null } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<MeasurementKind>(profile?.kind ?? "women");
  const [name, setName] = useState(profile?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);

  function validateName(): boolean {
    const trimmed = name.trim();
    const ok = trimmed.length > 0 && trimmed.length <= 40;
    setNameError(ok ? null : t.errors.name);
    return ok;
  }

  async function submit(set: MeasurementSet): Promise<string | null> {
    const result = await saveMyFitProfile({ id: profile?.id, name: name.trim(), set });
    if (!result.ok) {
      if (result.error === "name_taken") {
        setNameError(t.errors.nameTaken);
        return t.errors.nameTaken;
      }
      if (result.error === "too_many") return t.errors.tooMany;
      if (result.error === "signed_out") return t.errors.signedOut;
      if (result.error === "not_found") return t.notFound;
      return t.errors.failed;
    }
    toast({ title: t.saved, description: result.profile.name, tone: "success" });
    router.push("/account");
    router.refresh();
    return null;
  }

  return (
    <MeasurementForm
      key={kind}
      kind={kind}
      initial={profile?.set ?? null}
      submitLabel={en.fit.save}
      onSubmit={submit}
      onCancel={() => router.push("/account")}
      validateExtra={validateName}
      top={
        <div className="flex flex-col gap-5">
          <Input
            label={en.fit.profileName}
            help={en.fit.profileNameHelp}
            value={name}
            maxLength={40}
            required
            error={nameError ?? undefined}
            onChange={(event) => setName(event.target.value)}
            className="sm:max-w-sm"
          />
          {profile ? null : (
            <RadioGroup
              legend={t.kindLegend}
              name="kind"
              value={kind}
              onChange={(value) => setKind(value as MeasurementKind)}
              options={MEASUREMENT_KINDS.map((value) => ({
                value,
                label: t.kindOptions[value],
              }))}
            />
          )}
        </div>
      }
    />
  );
}
