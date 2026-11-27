"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { AlertCircleIcon } from "@/components/ui/icons";
import { authClient, withTurnstile } from "@/lib/auth-client";
import { en } from "@/lib/i18n/en";
import type { LoginOptions } from "@/lib/login-config";

import { Turnstile } from "./turnstile";

const t = en.login;

type AuthError = { status: number; code?: string } | null;

function sendError(error: NonNullable<AuthError>): string {
  if (error.status === 429) return t.tooMany;
  if (error.code === "VERIFICATION_FAILED" || error.code === "MISSING_RESPONSE")
    return t.turnstileFailed;
  if (error.code === "INVALID_EMAIL" || error.status === 400) return t.invalidEmail;
  return t.failed;
}

function verifyError(error: NonNullable<AuthError>): string {
  if (error.status === 429) return t.tooMany;
  switch (error.code) {
    case "INVALID_OTP":
      return t.wrongCode;
    case "OTP_EXPIRED":
      return t.expiredCode;
    case "TOO_MANY_ATTEMPTS":
      return t.tooManyAttempts;
    case "ADMIN_SIGN_IN_REQUIRED":
      return t.teamAccount;
    default:
      return t.failed;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Customer sign-in: an email code (no passwords), or Google when it's set up. */
export function LoginForm({
  next,
  options,
  googleFailed,
}: {
  next: string;
  options: LoginOptions;
  googleFailed: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(googleFailed ? t.googleFailed : null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const welcome = (via: "email" | "google") =>
    `/login/welcome?via=${via}&next=${encodeURIComponent(next)}`;

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const address = String(new FormData(event.currentTarget).get("email") ?? "")
      .trim()
      .toLowerCase();
    setEmail(address);
    if (!EMAIL_PATTERN.test(address)) {
      setError(t.invalidEmail);
      return;
    }
    if (options.turnstileSiteKey && !token) {
      setError(t.turnstileNeeded);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: sendFailed } = await authClient.emailOtp.sendVerificationOtp(
      { email: address, type: "sign-in" },
      withTurnstile(token),
    );
    setBusy(false);
    // A Turnstile token works once: get a fresh one for the next attempt.
    if (options.turnstileSiteKey) {
      setToken(null);
      setTurnstileReset((n) => n + 1);
    }
    if (sendFailed) {
      setError(sendError(sendFailed));
      return;
    }
    setStep("code");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const otp = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s+/g, "");
    if (!/^\d{6}$/.test(otp)) {
      setError(t.codeFormat);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: signInFailed } = await authClient.signIn.emailOtp({ email, otp });
    if (signInFailed) {
      setBusy(false);
      setError(verifyError(signInFailed));
      return;
    }
    router.replace(welcome("email"));
  }

  async function continueWithGoogle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: googleError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: welcome("google"),
      errorCallbackURL: `/login?error=google&next=${encodeURIComponent(next)}`,
    });
    // On success the browser is already on its way to Google.
    if (googleError) {
      setBusy(false);
      setError(t.googleFailed);
    }
  }

  const errorBox = error ? (
    <p role="alert" className="flex items-start gap-2 text-body-sm text-error">
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      {error}
    </p>
  ) : null;

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-h3">{t.codeTitle}</h2>
          <p className="text-body-sm text-stone-700">{t.codeIntro(email)}</p>
        </div>
        <Input
          label={t.code}
          name="code"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoFocus
        />
        {errorBox}
        <Button type="submit" fullWidth loading={busy}>
          {t.signIn}
        </Button>
        <div className="flex flex-col items-start gap-1">
          <p className="text-body-sm text-stone-700">{t.noCode}</p>
          <Button
            variant="link"
            onClick={() => {
              setError(null);
              setStep("email");
            }}
          >
            {t.sendNewCode}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={sendCode} className="flex flex-col gap-5" noValidate>
        <Input
          label={t.email}
          help={t.emailHelp}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          required
          autoFocus
        />
        {options.turnstileSiteKey ? (
          <Turnstile
            siteKey={options.turnstileSiteKey}
            action="customer-login"
            resetKey={turnstileReset}
            onToken={setToken}
          />
        ) : null}
        {errorBox}
        <Button type="submit" fullWidth loading={busy}>
          {t.sendCode}
        </Button>
      </form>

      {options.google ? (
        <>
          <div className="flex items-center gap-3 text-body-sm text-stone-700" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            {t.or}
            <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="secondary" fullWidth onClick={continueWithGoogle}>
            <GoogleLogo />
            {t.google}
          </Button>
        </>
      ) : null}
    </div>
  );
}

/** Google's "G" mark, as Google's sign-in branding rules ask for. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
