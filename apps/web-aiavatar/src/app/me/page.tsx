"use client";
// ============================================================
// 我的（五 Tab 定案）：账号 + 授权中心 + 任务中心 + 算力/存储/设置。
// 最近动态归首页，这里不再重复一份。
// 算力 / 存储 / 设置等管理页仍在 /studio（P3 逐屏迁出）。
// ============================================================
import React from "react";
import { useRouter } from "next/navigation";
import { auth, ID_MODE, USE_MOCK, useIdentity } from "@/proto/api";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { studioHref } from "@/components/hub/data";
import { Badge, Card, HubScreen, ListRow, NavBar } from "@/components/hub/ui";
import { setLayout, useLayoutMode } from "@/shell/layout-mode";

export default function MePage() {
  const router = useRouter();
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const noPlatform = authState === "no-platform";
  // 「我是谁」的真源是 /api/me（hook 必须在早退之前调用）。
  const identity = useIdentity();
  if (noPlatform) return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  const displayName = identity?.displayName || "我的账号";
  const initial = String(displayName).trim().slice(0, 1) || "我";

  return (
    <HubScreen tabBar>
      <NavBar title="我的" />

      <div style={{ margin: "6px 16px 0" }}>
        <Card radius={22} pad={16} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 999,
              background: "var(--grad)",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontFamily: "var(--font-serif)",
              fontSize: 24,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 17, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName}
            </span>
            {identity?.phoneMasked && (
              <span style={{ fontSize: 12, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {identity.phoneMasked}
              </span>
            )}
            {(USE_MOCK || identity?.demo) && <Badge tone="mute">演示数据</Badge>}
          </div>
        </Card>
      </div>

      <div className="hub-section" style={{ margin: "16px 16px 0" }}>
        <Card pad={0}>
          <ListRow href="/cards" title="我的名片" sub="对外发布面 · 扫码即看" divider />
          <ListRow href="/licenses" title="授权中心" sub="授权证书 · 待补确认" divider />
          <ListRow href={studioHref("#/tasks")} title="任务中心" sub="生成任务的进度与历史" divider />
          <ListRow href={studioHref("#/realmaterials")} title="真人授权素材库" sub="素材录制 · 审核状态" />
        </Card>
      </div>

      <div style={{ margin: "12px 16px 0" }}>
        <Card pad={0}>
          <ListRow href={studioHref("#/membership")} title="会员与算力" divider />
          <ListRow href={studioHref("#/storage")} title="存储用量" divider />
          <ListRow href={studioHref("#/trash")} title="回收站" divider />
          <ListRow href={studioHref("#/settings")} title="设置" />
        </Card>
      </div>

      {/* 形态切换：宽度只是**默认**判据，不是唯一判据 —— 竖持平板、手机浏览器的
          「请求桌面版网站」（布局视口约 980）都可能想要桌面版。见 shell/layout-mode.ts。 */}
      <div style={{ margin: "12px 16px 0" }}>
        <Card pad={0}>
          <LayoutSwitchRow />
        </Card>
      </div>

      {!USE_MOCK && (
        <div className="hub-section" style={{ margin: "20px 16px 0" }}>
          <button
            onClick={() => {
              // v0.149：id 模式下 auth.logout() 会整页跳账号中心统一登出，
              // 不会走到下面的 router.replace。
              auth.logout();
              if (!ID_MODE) router.replace("/login");
            }}
            style={{
              width: "100%",
              height: 44,
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--err)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            退出登录
          </button>
        </div>
      )}
    </HubScreen>
  );
}

/**
 * 「切换到桌面版」。
 *
 * 挂在「我的」而不是弹窗：这是个偶尔用一次的设置，不该在每个页面上抢注意力。
 * 切完整页重载 —— 两套形态的差别不只在 CSS（画布的 chunk 下不下、老 SPA 的定位），
 * 就地切会留下一半旧一半新的中间态。
 */
function LayoutSwitchRow() {
  // 服务端渲染不知道当前形态，挂载后再读，避免 hydration 前后文案不一致
  const mode = useLayoutMode();
  if (mode === null) return null;
  const next = mode === "desktop" ? "mobile" : "desktop";
  return (
    <button
      onClick={() => setLayout(next)}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, padding: "13px 16px", border: "none", background: "transparent",
        cursor: "pointer", textAlign: "left", font: "inherit",
      }}
    >
      <span style={{ fontSize: 14, color: "var(--ink)" }}>
        {next === "desktop" ? "切换到电脑版" : "切换到手机版"}
      </span>
      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
        {next === "desktop" ? "画布和宽表格更好用" : "回到竖排界面"}
      </span>
    </button>
  );
}
