"use client";
// ============================================================
// /studio —— 老 SPA（hash 路由）的宿主。
//   内嵌模式：隐藏它自带的 tab 栏，底部统一用新版 HubTabBar。
//   ?start=real|ai|compose|sheet：由「创作」页发起具体流程
//   （这些流程冷启动不按 hash 还原，所以不能用 #/create/real 这类深链）。
// ============================================================
import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Smartphone } from "lucide-react";
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

/**
 * 桌面上给老 SPA 一个取景框 + 一句说明。
 *
 * 这一片是「分步流程」——声音、真人素材、任务、会员算力、存储、回收站、设置
 * 都还在这里（26 屏 / 约 11k 行，按既有双轨逐屏迁出）。它按 480 宽写死，
 * 桌面上必然是一条窄列；不加说明的话看起来就是「这页没做响应式」。
 * 加上取景与这句话之后，它读起来是「一个专注的流程面板」——这是实话，
 * 分步表单本来就该窄。
 */
function StudioDesktopFrame() {
  React.useEffect(() => {
    document.body.classList.add("studio-desktop");
    return () => document.body.classList.remove("studio-desktop");
  }, []);
  return (
    <div
      className="studio-hint"
      style={{
        position: "fixed", top: "calc(var(--desktop-bar-h) + 26px)", left: 28, zIndex: 5,
        maxWidth: 260, flexDirection: "column", gap: 10,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>
        <Smartphone size={14} /> 分步流程
      </span>
      <p style={{ fontSize: 12.5, lineHeight: 1.75, color: "var(--ink-3)", margin: 0 }}>
        声音、真人素材、任务、算力与设置这些一步一步走的流程放在这一栏里。
        它保持手机上的宽度 —— 表单一行太宽反而难填。
      </p>
      <Link href="/dashboard" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--primary-700)", textDecoration: "none" }}>
        ‹ 回主页
      </Link>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioDesktopFrame />
      <StudioInner />
    </Suspense>
  );
}
