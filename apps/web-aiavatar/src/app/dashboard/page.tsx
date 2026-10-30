"use client";
import { HubHome } from "@/components/hub/home";
import { IpHome } from "@/components/landing/ip-home";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { HubTabBar } from "@/components/hub/ui";
import { useLayoutMode } from "@/shell/layout-mode";
import { useUiVersion } from "@/shell/ui-version";

export default function DashboardPage() {
  const layout = useLayoutMode();
  const version = useUiVersion();
  const state = useRequireAuth();
  if (state === "no-platform") return <PlatformGateScreen />;
  if (!layout || state !== "ok") return null;
  if (layout === "desktop") return <IpHome header={false} />;
  // 新版手机上也是场景首页（2026-10-30 线上走查：手机还是旧首页，场景入口只剩一行小字）。
  return version === "next" ? <div className="studio-mobile-home"><IpHome header={false} /><HubTabBar /></div> : <HubHome />;
}
