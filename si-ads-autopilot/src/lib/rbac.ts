import type { Role } from "@/generated/prisma/enums";

// Permission levels (spec section 29).
export type Permission =
  | "VIEW_DASHBOARD"
  | "MANAGE_ADS" // pause/resume/edit budget/duplicate
  | "MANAGE_AUTOMATION" // create/edit rules, safety settings, kill switch
  | "MANAGE_ORGANIZATION"; // members, billing, Meta connections

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ["VIEW_DASHBOARD", "MANAGE_ADS", "MANAGE_AUTOMATION", "MANAGE_ORGANIZATION"],
  ADMIN: ["VIEW_DASHBOARD", "MANAGE_ADS", "MANAGE_AUTOMATION", "MANAGE_ORGANIZATION"],
  MEDIA_BUYER: ["VIEW_DASHBOARD", "MANAGE_ADS"],
  ANALYST: ["VIEW_DASHBOARD"],
  VIEWER: ["VIEW_DASHBOARD"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Role ${role} does not have permission ${permission}.`);
  }
}
