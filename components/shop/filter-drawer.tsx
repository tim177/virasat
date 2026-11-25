"use client";

import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { en } from "@/lib/i18n/en";

/** Small screens: a "Filters" button that opens the filter form in a drawer. */
export function FilterDrawer({
  activeCount,
  children,
}: {
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Close once the new results are in the URL. (Closing on submit would remove the form
  // before Next.js reads it, because the dialog only renders its contents while open.)
  const query = useSearchParams().toString();
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <Button
        variant="secondary"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {en.listing.filtersWithCount(activeCount)}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={en.listing.filters}
        variant="drawer"
      >
        {children}
      </Dialog>
    </div>
  );
}
