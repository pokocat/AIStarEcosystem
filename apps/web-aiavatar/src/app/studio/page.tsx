"use client";
// ============================================================
// /studio —— 老 SPA（hash 路由）的宿主。
//   内嵌模式：隐藏它自带的 tab 栏，底部统一用新版 HubTabBar。
//   ?start=real|ai|compose|sheet：由「创作」页发起具体流程
//   （这些流程冷启动不按 hash 还原，所以不能用 #/create/real 这类深链）。
// ============================================================
import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { App, type StudioStart } from "@/proto/app";
import { HubTabBar } from "@/components/hub/ui";

const STARTS: StudioStart[] = ["sheet", "real", "ai", "compose"];

function StudioInner() {
  const sp = useSearchParams();
  const raw = sp.get("start") || (sp.get("create") === "1" ? "sheet" : null);
  const start = STARTS.find((s) => s === raw);
  // tabBar 交给 App 渲染：覆盖页 / 创建流程屏上它会自动收起，不挡主按钮
  return <App embedded start={start} tabBar={<HubTabBar />} />;
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioInner />
    </Suspense>
  );
}
