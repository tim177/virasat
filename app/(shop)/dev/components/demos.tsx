"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

// Interactive examples for the /dev/components preview page.

export function LoadingButtonDemo() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      loading={loading}
      onClick={() => {
        setLoading(true);
        window.setTimeout(() => setLoading(false), 2000);
      }}
    >
      Place order
    </Button>
  );
}

export function DialogDemo() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => setModalOpen(true)}>
        Open modal
      </Button>
      <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
        Open drawer
      </Button>

      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Size guide"
        footer={
          <Button fullWidth onClick={() => setModalOpen(false)}>
            Got it
          </Button>
        }
      >
        <p>Measure around the fullest part of your bust, keeping the tape level.</p>
      </Dialog>

      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filters"
        variant="drawer"
      >
        <p>Filters will appear here on category pages.</p>
      </Dialog>
    </div>
  );
}

export function ToastDemo() {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        onClick={() =>
          toast({
            title: "Added to bag",
            description: "Crimson silk lehenga, size M",
            tone: "success",
          })
        }
      >
        Show success toast
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast({ title: "Payment failed", description: "Please try another card.", tone: "error" })
        }
      >
        Show error toast
      </Button>
    </div>
  );
}
