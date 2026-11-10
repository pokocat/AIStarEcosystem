"use client";

// /studio：旧工作室。账号区的旧哈希（#/membership、#/tasks、#/storage、#/trash、#/realmaterials、#/licenses、#/settings、#/security）
// 2026-11-10 起转到 /me 下的新地址（带上原来的查询参数，支付回跳的 rechargeOrder 不丢）；
// 其余哈希（数字人详情、创建向导、真人确认回跳…）仍交给旧 SPA。
import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { App, type StudioStart } from "@/proto/app";
import { HubTabBar } from "@/components/hub/ui";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { useStudioHash } from "@/shell/account-workspace";
import { accountPageKey, studioEntryDestination, studioReturnPath } from "@/shell/account-navigation";

const STARTS: StudioStart[] = ["sheet", "real", "ai", "compose"];

function StudioInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const hash = useStudioHash();
  const raw = sp.get("start") || (sp.get("create") === "1" ? "sheet" : null);
  const start = STARTS.find(s => s === raw);
  const from = studioReturnPath(sp.get("from"));
  const auth = useRequireAuth();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const destination = studioEntryDestination(window.location.hash, window.location.search);
    if (destination) { router.replace(accountPageKey(window.location.hash) ? destination + window.location.search : destination); return; }
    setReady(true);
  }, [router, hash, start]);
  if (auth === "no-platform") return <PlatformGateScreen />;
  if (!ready || auth !== "ok") return null;
  // 旧 SPA 的流程页沿用原来的外框（.account-workspace 带旧组件的颜色映射，.account-legacy-content 给 .app-root 定位）。
  return <div className="account-workspace ip-brand-surface">
    <main className="account-legacy-content">
      <App embedded start={start} tabBar={<HubTabBar />} onRootBack={from ? () => router.push(from) : undefined} />
    </main>
  </div>;
}

export default function StudioPage() {
  return <Suspense fallback={null}><StudioInner /></Suspense>;
}
