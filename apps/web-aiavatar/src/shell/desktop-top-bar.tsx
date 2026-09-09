"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 桌面顶栏 —— 合并之后 PC 端的全局导航（手机走底部 tab 栏，见 hub/ui.tsx）。
//
// 导航是**超集**，不是照搬原 ipstudio 那三个。原来的顶栏只有「项目 · 资产 · 名片」，
// 而「发现 / 我的 / 授权」只存在于 aiavatar 的底部 tab 栏 —— 合并后如果照搬三个，
// 桌面用户就再也点不到那三处了。所以：
//   主导航 = 项目 · 资产 · 名片 · 发现（这条链 + 一个逛的入口）
//   账号块 = 我的 / 授权 / 退出（低频，收进右上角）
//
// 只在**桌面形态**显示（`.desktop-top-bar` 由 html[data-layout="desktop"] 打开，
// 见 shell/layout-mode.ts）。公开名片页 /card/p/*
// 与登录页不挂它 —— 见 app-chrome.tsx。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, IdCard, Layers, LogOut, Shield, Smartphone, Sparkles, User } from "lucide-react";
import { auth, useIdentity } from "@/proto/api";
import { setLayout } from "./layout-mode";

const NAV = [
  // 「主页」而不是「首页」：根目录 `/` 现在是公开落地页，登录后的门户在 /dashboard。
  { href: "/dashboard", label: "主页", icon: Home },
  // 「自由画布」而不是「项目」：这里点进去是无限画布本身，不是一张项目管理表。
  { href: "/projects", label: "自由画布", icon: Sparkles },
  { href: "/assets",   label: "资产", icon: Layers },
  { href: "/cards",    label: "名片", icon: IdCard },
  { href: "/discover", label: "发现", icon: Compass },
];

// 账号块里的低频入口 —— 这三处原本只有手机端进得去
const ACCOUNT = [
  { href: "/me",       label: "我的",   icon: User },
  { href: "/licenses", label: "授权",   icon: Shield },
];

export function DesktopTopBar() {
  const pathname = usePathname() ?? "";
  const identity = useIdentity();
  const name = identity?.displayName ?? "";

  return (
    <header
      className="desktop-top-bar ip-surface"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 40,
        height: "var(--desktop-bar-h)",
        alignItems: "center", justifyContent: "space-between",
        padding: "0 20px",
        // 用户可以在窄屏上强选桌面版（见 shell/layout-mode.ts）—— 那时这一行放不下。
        // 让它横向滚动，而不是让 logo、导航和账号块互相压在一起（实测 375px 下是叠字）。
        gap: 16, overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none",
        background: "var(--blue-800)",
        borderBottom: "1px solid var(--on-blue-line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "baseline", gap: 10, textDecoration: "none", flexShrink: 0 }}>
          <span className="asset-name" style={{ fontSize: 17, color: "var(--on-blue)" }}>数字资产平台</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".12em", fontFamily: "var(--font-mono)", color: "var(--action)" }}>
            AIAVATAR
          </span>
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {NAV.map(({ href, label, icon: Icon }) => {
            // 前缀匹配：/projects/<id> 的画布页也算在「项目」下
            const on = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                style={{
                  height: 32, padding: "0 12px", borderRadius: 9,
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 600, textDecoration: "none", flexShrink: 0,
                  background: on ? "var(--on-blue-fill)" : "transparent",
                  color: on ? "var(--on-blue)" : "var(--on-blue-2)",
                }}
              >
                <Icon size={14} style={{ flexShrink: 0 }} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {ACCOUNT.map(({ href, label, icon: Icon }) => {
          const on = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              title={label}
              style={{
                height: 30, padding: "0 10px", borderRadius: 8,
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 12.5, fontWeight: 600, textDecoration: "none",
                background: on ? "var(--on-blue-fill)" : "transparent",
                color: on ? "var(--on-blue)" : "var(--on-blue-2)",
              }}
            >
              <Icon size={13} />
              <span>{label}</span>
            </Link>
          );
        })}
        {name ? (
          <span style={{ fontSize: 12, color: "var(--on-blue-2)", maxWidth: "10rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </span>
        ) : null}
        {/* 形态切换：手机浏览器选「请求桌面版网站」进来的人，需要一条回得去的路
            （见 shell/layout-mode.ts）。宽屏用户点它也没坏处 —— 是他自己要看手机版。 */}
        <button
          onClick={() => setLayout("mobile")}
          title="切换到手机版"
          aria-label="切换到手机版"
          style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", lineHeight: 0 }}
        >
          <Smartphone size={15} style={{ color: "var(--on-blue-2)" }} />
        </button>
        <button
          onClick={() => auth.logout()}
          title="退出登录"
          aria-label="退出登录"
          style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", lineHeight: 0 }}
        >
          <LogOut size={15} style={{ color: "var(--on-blue)" }} />
        </button>
      </div>
    </header>
  );
}
