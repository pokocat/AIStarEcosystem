"use client";
// ============================================================
// Sidebar — 从原型 shell.jsx 的 Sidebar 1:1 移植。
// 导航：资产总库 / 模板中心 / 任务中心(红点=进行中) / 授权管理 / 能力健康。
// ============================================================
import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@ai-star-eco/api-client";
import { Icons, type IconComponent } from "@/components/ui/icons";
import { Avatar, Btn, IconBtn, Progress } from "@/components/ui/primitives";
import { useApi } from "@/lib/hooks";
import { listJobs, dataSourceMode } from "@/api/ai-avatar";

interface NavItem {
  key: string;
  href: string;
  icon: IconComponent;
  label: string;
}

const NAV: NavItem[] = [
  { key: "library", href: "/library", icon: Icons.layers, label: "资产总库" },
  { key: "templates", href: "/templates", icon: Icons.palette, label: "模板中心" },
  { key: "tasks", href: "/tasks", icon: Icons.bolt, label: "任务中心" },
  { key: "licenses", href: "/licenses", icon: Icons.shield, label: "授权管理" },
  { key: "health", href: "/health", icon: Icons.activity, label: "能力健康" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { data: jobs } = useApi(() => listJobs(), []);
  const running = (jobs ?? []).filter((j) => j.status === "running" || j.status === "queued").length;

  const isActive = (href: string) => pathname === href || (href !== "/library" && pathname.startsWith(href));

  return (
    <aside style={{ width: 232, flexShrink: 0, background: "var(--bg-1)", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", height: "100%" }}>
      {/* logo */}
      <Link href="/library" style={{ padding: "22px 20px 18px", display: "flex", alignItems: "center", gap: 11, borderBottom: "1px solid var(--line)" }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(140deg, var(--accent) 0%, var(--accent-dim) 100%)", display: "grid", placeItems: "center", color: "#1a1205", boxShadow: "var(--glow-accent)" }}>
          <Icons.sparkle size={18} stroke={2} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.01em" }}>数字人资产</div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-2)", letterSpacing: "0.14em" }}>AVATAR STUDIO</div>
        </div>
      </Link>

      {/* 新建 */}
      <div style={{ padding: "16px 16px 8px" }}>
        <Btn variant="pri" full icon={Icons.plus} onClick={() => router.push("/create")}>新建数字人</Btn>
      </div>

      {/* nav */}
      <nav style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.key}
              href={n.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "10px 12px",
                borderRadius: "var(--r-md)",
                transition: "all .15s",
                background: active ? "var(--bg-3)" : "transparent",
                color: active ? "var(--ink-0)" : "var(--ink-1)",
                fontSize: 13.5,
                fontWeight: active ? 600 : 400,
                position: "relative",
              }}
            >
              {active && <span style={{ position: "absolute", left: -12, top: 12, bottom: 12, width: 3, borderRadius: 999, background: "var(--accent)" }} />}
              <n.icon size={18} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.key === "tasks" && running > 0 && (
                <span className="mono" style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: "var(--signal-soft)", color: "var(--signal)", border: "1px solid var(--signal-line)" }}>{running}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* 存储用量 */}
      <div style={{ padding: "0 18px 14px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-2)", display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
          <span>资产库存储</span>
          <span>64%</span>
        </div>
        <Progress pct={64} tone="accent" />
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 6 }}>128.4 / 200 GB</div>
      </div>

      {/* user */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={user?.displayName || "用户"} size={32} hue={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.displayName || "资产管理员"}</div>
          <div style={{ fontSize: 11, color: "var(--ink-2)" }}>{dataSourceMode() === "mock" ? "DEV · 演示" : "已登录"}</div>
        </div>
        <IconBtn icon={Icons.logout} size={30} title="退出登录" onClick={logout} />
      </div>
    </aside>
  );
}
