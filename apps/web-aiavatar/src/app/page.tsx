"use client";
// ============================================================
// 域名根目录（v0.191 起）= **公开落地页**，登录与否都是它。
//   旧 hash → 转发 /studio（七牛刷脸回调红线，/studio 迁完前不得移除）
//   其余     → AI IP 工作台落地页（登录了 CTA 指 /dashboard，没登录指 /login）
//
// 原来「已登录 → 首页门户」那一支搬去了 `/dashboard`。这样根域名对外是一张
// 讲清楚产品的页面，而不是一进来就看见别人的工作台空壳。
// ============================================================
import React, { useEffect, useState } from "react";
import { IpLanding } from "@/components/landing/ip-landing";

/** 旧链接 / 刷脸回调的 hash 前缀 → 整体转发 /studio。 */
function isLegacyHash(hash: string): boolean {
  return /^#\/?(avatar|ip|scene|product|style|compose|create|real-auth|home|library|apps|me|tasks|licenses|realmaterials|voice|settings|security|membership|storage|trash|voiceclone)(\/|$)/.test(hash);
}

export default function HomePage() {
  // 只保留旧 hash 转发这一件事：七牛刷脸回调会带着 `#/real-auth/{sessionId}`
  // 落到根目录，必须原样转给 /studio 去恢复会话（红线，/studio 迁完前不得移除）。
  const [forwarding, setForwarding] = useState(true);
  useEffect(() => {
    const hash = window.location.hash || "";
    if (hash && isLegacyHash(hash)) {
      window.location.replace(`/studio${hash}`);
      return; // 保持空白直到跳转完成，别闪一下落地页
    }
    setForwarding(false);
  }, []);

  if (forwarding) return null;
  return <IpLanding />;
}
