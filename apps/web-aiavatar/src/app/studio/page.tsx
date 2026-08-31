"use client";
// 工作室（双轨过渡期的老版整站宿主）：src/proto 的完整 SPA 承载所有"写"流程
// （创建链路 / 真人刷脸授权 / 合成工作台 / 声音克隆 / 设置等），hash 深链不变。
//
// 导航统一：老 SPA 自带的 5 tab 在这里隐藏（embedded），底部改用与新版页面
// 完全一致的 HubTabBar —— 整个 app 只有一套底部导航。
// P3 逐屏迁出后本页退役（见 docs/aiavatar-asset-hub-redesign.md §3.1 / §4）。
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { App } from "@/proto/app";
import { HubTabBar } from "@/components/hub/ui";

function StudioInner() {
  const sp = useSearchParams();
  return (
    <>
      <App embedded autoCreate={sp.get("create") === "1"} />
      <HubTabBar />
    </>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioInner />
    </Suspense>
  );
}
