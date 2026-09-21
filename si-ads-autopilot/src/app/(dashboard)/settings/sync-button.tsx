"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { triggerSync } from "./actions";

export function SyncButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => triggerSync())}
    >
      {pending ? "Syncing..." : "Sync now"}
    </Button>
  );
}
