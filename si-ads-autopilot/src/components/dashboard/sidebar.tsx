"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Bot,
  Megaphone,
  Zap,
  Image as ImageIcon,
  Users,
  Wallet,
  BarChart3,
  FileText,
  Bell,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/ai-command-center", label: "AI Command Center", icon: Bot },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/automation", label: "Automation", icon: Zap },
  { href: "/creative", label: "Creative", icon: ImageIcon },
  { href: "/audience", label: "Audience", icon: Users },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/activity-log", label: "Activity Log", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  organizationName,
  userName,
}: {
  organizationName: string;
  userName: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-200",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className="flex items-center justify-between px-4 py-5">
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight text-primary-deep">
            SI Ads Autopilot
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto rounded-md p-1.5 text-secondary-text hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-light text-primary-deep"
                  : "text-secondary-text hover:bg-slate-100 dark:hover:bg-slate-800",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-4">
        {!collapsed && (
          <div className="mb-2 truncate text-xs text-secondary-text">
            {organizationName}
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          {!collapsed && <span className="truncate text-sm">{userName}</span>}
        </div>
      </div>
    </aside>
  );
}
