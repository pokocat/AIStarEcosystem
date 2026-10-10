"use client";
import { HubHome } from "@/components/hub/home";
import { IpHome } from "@/components/landing/ip-home";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { useLayoutMode } from "@/shell/layout-mode";

export default function DashboardPage() {
  const layout = useLayoutMode();
  const state = useRequireAuth();
  if (state === "no-platform") return <PlatformGateScreen />;
  if (!layout || state !== "ok") return null;
  return layout === "desktop" ? <IpHome header={false} /> : <HubHome />;
}
