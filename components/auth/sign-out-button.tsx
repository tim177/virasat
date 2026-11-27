"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ButtonStyleOptions } from "@/components/ui/button-styles";
import { authClient } from "@/lib/auth-client";

/** Ends the session, then opens `redirectTo` (admin: /admin/login, customers: the home page). */
export function SignOutButton({
  label,
  redirectTo,
  variant = "ghost",
}: {
  label: string;
  redirectTo: string;
  variant?: ButtonStyleOptions["variant"];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await authClient.signOut();
        router.replace(redirectTo);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
