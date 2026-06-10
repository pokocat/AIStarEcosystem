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
  const notificationUnread = badges.notif_unread ?? 0;

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
    <div className="flex min-h-screen bg-background text-foreground">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        跳到主内容
      </a>
      <Sidebar
        badges={badges}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar unread={notificationUnread} onMenuClick={() => setMobileOpen(true)} />
        <main id="admin-main" className="min-w-0 flex-1 px-4 py-5 sm:px-6 md:px-7 lg:px-8 2xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
