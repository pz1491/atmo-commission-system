"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-secondary-text hover:text-foreground"
      aria-label="Sign out"
    >
      <LogOut size={18} />
    </button>
  );
}
