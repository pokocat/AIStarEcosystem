"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useSidebarBadges } from "@/lib/useSidebarBadges";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isLoginPage = pathname === "/login" || pathname === "/admin/login";
  const badges = useSidebarBadges(!isLoginPage);
  const unread = Object.values(badges).reduce<number>((s, v) => s + (v ?? 0), 0);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileOpen]);

  return isLoginPage ? (
    <>{children}</>
  ) : (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        badges={badges}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 min-w-0 flex-col">
        <Topbar unread={unread} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 min-w-0 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
