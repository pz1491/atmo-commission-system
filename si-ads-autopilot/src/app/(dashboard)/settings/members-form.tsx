"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addMemberByEmail } from "./actions";

export function AddMemberForm() {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => startTransition(async () => {
        await addMemberByEmail(fd);
      })}
      className="flex flex-wrap items-end gap-2"
    >
      <div>
        <label className="text-xs text-secondary-text">Email (must already have an account)</label>
        <input name="email" type="email" required className="mt-1 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm" />
      </div>
      <div>
        <label className="text-xs text-secondary-text">Role</label>
        <select name="role" defaultValue="VIEWER" className="mt-1 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm">
          <option value="ADMIN">Admin</option>
          <option value="MEDIA_BUYER">Media Buyer</option>
          <option value="ANALYST">Analyst</option>
          <option value="VIEWER">Viewer</option>
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding..." : "Add member"}
      </Button>
    </form>
  );
}
