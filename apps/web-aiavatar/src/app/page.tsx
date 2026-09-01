"use client";
// ============================================================
// 首页（M3 导航合并后）：
//   旧 hash → 转发 /studio（七牛刷脸回调红线，/studio 迁完前不得移除）
//   访客     → 公开宣传页
//   已登录   → 首页门户（总览 + 待办 + 快捷创作 + 最近更新 + 官方精选）
// dev 预览宣传页：任意模式加 ?landing=1。
// ============================================================
import React, { useEffect, useState } from "react";
import { auth, AuthApi, onAuthExpired, USE_MOCK } from "@/proto/api";
import { Landing } from "@/components/hub/landing";
import { HubHome } from "@/components/hub/home";
import { PlatformGateScreen } from "@/components/hub/auth";
import { HubScreen } from "@/components/hub/ui";

/** 旧链接 / 刷脸回调的 hash 前缀 → 整体转发 /studio。 */
function isLegacyHash(hash: string): boolean {
  return /^#\/?(avatar|ip|scene|product|style|compose|create|real-auth|home|library|apps|me|tasks|licenses|realmaterials|voice|settings|security|membership|storage|trash|voiceclone)(\/|$)/.test(hash);
}

export default function HomePage() {
  // 三态：checking（旧 hash 检测中，什么都不下结论）/ landing（访客）/ app（已登录）
  const [mode, setMode] = useState<"checking" | "landing" | "app">("checking");
  useEffect(() => {
    const hash = window.location.hash || "";
    if (hash && isLegacyHash(hash)) {
      window.location.replace(`/studio${hash}`);
      return; // 保持 checking（空白）直到跳转完成
    }
    if (new URLSearchParams(window.location.search).get("landing") === "1") {
      setMode("landing");
      return;
    }
    setMode(USE_MOCK || auth.isAuthed() ? "app" : "landing");
  }, []);

  useEffect(() => {
    if (USE_MOCK) return;
    return onAuthExpired(() => setMode("landing"));
  }, []);

  // 平台门禁：已登录但没开通数字资产 → 引导开通，而不是空货架
  const [noPlatform, setNoPlatform] = useState(false);
  useEffect(() => {
    if (USE_MOCK || mode !== "app") return;
    let cancelled = false;
    AuthApi.me()
      .then((me: { platforms?: string[] } | null) => {
        if (cancelled) return;
        const ps = me?.platforms;
        if (Array.isArray(ps) && ps.length > 0 && !ps.includes("aiavatar")) setNoPlatform(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode]);

  if (mode === "landing") return <Landing />;
  if (noPlatform) return <PlatformGateScreen />;
  if (mode !== "app") return <HubScreen tabBar={false}>{null}</HubScreen>;
  return <HubHome />;
}
