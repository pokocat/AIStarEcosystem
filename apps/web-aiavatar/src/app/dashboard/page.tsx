"use client";
import { IpHome } from "@/components/landing/ip-home";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { HubTabBar } from "@/components/hub/ui";
import { useLayoutMode } from "@/shell/layout-mode";

export default function DashboardPage() {
  const layout = useLayoutMode();
  const state = useRequireAuth();
  if (state === "no-platform") return <PlatformGateScreen />;
  if (!layout || state !== "ok") return null;
  if (layout === "desktop") return <IpHome header={false} />;
  return <div className="studio-mobile-home"><IpHome header={false} /><HubTabBar /></div>;
}
