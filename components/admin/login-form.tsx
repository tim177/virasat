"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { AlertCircleIcon } from "@/components/ui/icons";
import { authClient } from "@/lib/auth-client";
import { en } from "@/lib/i18n/en";

const t = en.admin.login;

type Step = "password" | "app" | "backup";
type AuthError = { status: number; code?: string } | null;

function messageFor(error: NonNullable<AuthError>, step: Step): string {
  if (error.status === 429) return t.tooMany;
  if (error.code === "ACCOUNT_TEMPORARILY_LOCKED") return t.locked;
  if (error.code === "INVALID_TWO_FACTOR_COOKIE") return t.expired;
  // 400 = not an email address, 401 = wrong email or password: the same answer for both.
  if (step === "password")
    return error.status === 400 || error.status === 401 ? t.wrongPassword : t.failed;
  if (step === "backup") return t.wrongBackupCode;
  return error.status === 401 || error.code === "INVALID_CODE" ? t.wrongCode : t.failed;
}

/** Admin sign-in: email and password, then a code from the authenticator app. */
export function AdminLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const { data, error: signInError } = await authClient.signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    setBusy(false);
    if (signInError) {
      setError(messageFor(signInError, "password"));
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setStep("app");
      return;
    }
    // Signed in without a second step: not an admin account. Don't keep that session.
    await authClient.signOut();
    setError(t.notAdmin);
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s+/g, "");
    setBusy(true);
    setError(null);
    const { error: verifyError } =
      step === "backup"
        ? await authClient.twoFactor.verifyBackupCode({ code })
        : await authClient.twoFactor.verifyTotp({ code });
    if (verifyError) {
      setBusy(false);
      if (verifyError.code === "INVALID_TWO_FACTOR_COOKIE") {
        setStep("password");
        setError(t.expired);
        return;
      }
      setError(messageFor(verifyError, step));
      return;
    }
    router.replace("/admin");
  }

  const errorBox = error ? (
    <p role="alert" className="flex items-start gap-2 text-body-sm text-error">
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      {error}
    </p>
  ) : null;

  if (step === "password") {
    return (
      <form onSubmit={submitPassword} className="flex flex-col gap-5" noValidate>
        <Input
          label={t.email}
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
        <Input
          label={t.password}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {errorBox}
        <Button type="submit" fullWidth loading={busy}>
          {t.continue}
        </Button>
      </form>
    );
  }

  const backup = step === "backup";
  return (
    <form onSubmit={submitCode} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-h3">{t.codeTitle}</h2>
        <p className="text-body-sm text-stone-700">{backup ? t.backupIntro : t.codeIntro}</p>
      </div>
      <Input
        key={step}
        label={backup ? t.backupCode : t.code}
        name="code"
        autoComplete="one-time-code"
        inputMode={backup ? "text" : "numeric"}
        pattern={backup ? undefined : "[0-9]*"}
        maxLength={backup ? 20 : 6}
        required
        autoFocus
      />
      {errorBox}
      <Button type="submit" fullWidth loading={busy}>
        {t.verify}
      </Button>
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="link"
          onClick={() => {
            setError(null);
            setStep(backup ? "app" : "backup");
          }}
        >
          {backup ? t.useApp : t.useBackup}
        </Button>
        <Button
          variant="link"
          onClick={() => {
            setError(null);
            setStep("password");
          }}
        >
          {t.startAgain}
        </Button>
      </div>
    </form>
  );
}
