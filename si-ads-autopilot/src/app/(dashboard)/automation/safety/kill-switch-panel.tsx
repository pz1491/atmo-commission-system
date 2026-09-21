"use client";

import { useState, useTransition } from "react";
import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setKillSwitch } from "./actions";

export function KillSwitchPanel({ active, pausesAds }: { active: boolean; pausesAds: boolean }) {
  const [pending, startTransition] = useTransition();
  const [pauseOnActivate, setPauseOnActivate] = useState(pausesAds);

  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary-text">
        Stops every rule, budget scaling, and duplication immediately. It does not
        pause currently running ads unless you check the box below.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={pauseOnActivate}
          onChange={(e) => setPauseOnActivate(e.target.checked)}
          disabled={active}
        />
        Also pause all active ads when I hit the kill switch
      </label>

      {active ? (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => startTransition(() => setKillSwitch(false, pauseOnActivate))}
        >
          <Power size={16} /> Resume Automation
        </Button>
      ) : (
        <Button
          variant="danger"
          size="lg"
          disabled={pending}
          onClick={() => startTransition(() => setKillSwitch(true, pauseOnActivate))}
        >
          <Power size={18} /> STOP ALL AUTOMATION
        </Button>
      )}
    </div>
  );
}
