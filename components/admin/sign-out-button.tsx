"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { en } from "@/lib/i18n/en";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await authClient.signOut();
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      {en.admin.signOut}
    </Button>
  );
}
