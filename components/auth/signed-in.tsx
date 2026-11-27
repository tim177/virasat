"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { track } from "@/lib/analytics";
import { en } from "@/lib/i18n/en";

/** After a sign-in: records login or sign_up, then opens the page the shopper came from. */
export function SignedIn({
  event,
  method,
  next,
}: {
  event: "login" | "sign_up";
  method: "email" | "google";
  next: string;
}) {
  const router = useRouter();
  useEffect(() => {
    track(event, { method });
    router.replace(next);
  }, [event, method, next, router]);
  return (
    <p role="status" className="text-center text-stone-700">
      {en.login.signingIn}
    </p>
  );
}
