"use client";
// ============================================================
// 我的（五 Tab 定案）：账号 + 授权中心 + 任务中心 + 算力/存储/设置。
// 最近动态归首页，这里不再重复一份。
// 算力 / 存储 / 设置等管理页仍在 /studio（P3 逐屏迁出）。
// ============================================================
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Clapperboard, FolderOpen, Gem, HardDrive, IdCard, Layers, Lightbulb, ListChecks, Monitor, RotateCcw, ScanFace, Settings, ShieldCheck, Trash2, UserPlus, type LucideIcon } from "lucide-react";
import { auth, ID_MODE, USE_MOCK, useIdentity } from "@/proto/api";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { studioHref } from "@/components/hub/data";
import { Badge, Card, HubScreen, HubTabBar, ListRow, NavBar } from "@/components/hub/ui";
import { setLayout, useLayoutMode } from "@/shell/layout-mode";
import { setUiVersion, useUiVersion } from "@/shell/ui-version";
import { AccountOverview } from "@/shell/account-workspace";
import { EditableAccountAvatar } from "@/shell/account-avatar";
import { useWalletBalance } from "@/shell/wallet-balance";

export default function MePage() {
  const router = useRouter();
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const noPlatform = authState === "no-platform";
  // 「我是谁」的真源是 /api/me（hook 必须在早退之前调用）。
  const identity = useIdentity();
  const layout = useLayoutMode();
  const version = useUiVersion();
  if (noPlatform) return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  const displayName = identity?.displayName || "我的账号";
  if (layout === "desktop") return <AccountOverview name={displayName} phone={identity?.phoneMasked} demo={USE_MOCK || identity?.demo} identity={identity} />;
  const logout = () => {
    // v0.149：id 模式下 auth.logout() 会整页跳账号中心统一登出，
    // 不会走到下面的 router.replace。
    auth.logout();
    if (!ID_MODE) router.replace("/login");
  };
  if (version === "next") return <MeNext name={displayName} phone={identity?.phoneMasked} demo={USE_MOCK || !!identity?.demo} identity={identity} onLogout={logout} />;

  return (
    <HubScreen tabBar>
      <NavBar title="我的" />

      <div style={{ margin: "6px 16px 0" }}>
        <Card radius={22} pad={16} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <EditableAccountAvatar identity={identity} />
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
          {ID_MODE && <ListRow href="/invitations" title="邀请朋友" sub="管理邀请链接 · 查看邀请记录" divider />}
          <ListRow href={studioHref("#/membership")} title="会员与算力" divider />
          {process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED === "1" && <ListRow href="/enterprise" title="企业积分" sub="企业余额 · 积分分配 · 充值记录" divider />}
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
          <UiVersionRow />
        </Card>
      </div>

      {!USE_MOCK && (
        <div className="hub-section" style={{ margin: "20px 16px 0" }}>
          <button
            onClick={logout}
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

/** 新旧版切换（见 shell/ui-version.ts）。电脑上在右上角，手机上没有顶栏，放在这里。 */
function UiVersionRow() {
  const next = useUiVersion() === "next";
  return (
    <button
      onClick={() => setUiVersion(next ? "classic" : "next")}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, padding: "13px 16px", border: "none", borderTop: "1px solid var(--line)", background: "transparent",
        cursor: "pointer", textAlign: "left", font: "inherit",
      }}
    >
      <span style={{ fontSize: 14, color: "var(--ink)" }}>{next ? "回到旧版" : "体验新版"}</span>
      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{next ? "换回原来的首页和导航" : "按场景创作的新首页"}</span>
    </button>
  );
}

type MeRowProps = { icon: LucideIcon; title: string; sub?: string } & ({ href: string } | { onClick: () => void });
function MeRow(props: MeRowProps) {
  const Icon = props.icon;
  const body = <><Icon size={18} strokeWidth={1.5} aria-hidden /><span><strong>{props.title}</strong>{props.sub && <small>{props.sub}</small>}</span><ChevronRight size={16} strokeWidth={1.5} aria-hidden /></>;
  return "href" in props ? <Link className="studio-me-row" href={props.href}>{body}</Link> : <button type="button" className="studio-me-row" onClick={props.onClick}>{body}</button>;
}

/**
 * 新版的手机「我的」（2026-11-02）：和 AI 视频、AI 图片同一套设计语言，白底细线、细图标、字不加粗。
 * 内容与旧版一样，只多了灵感、项目、资产、短剧导演台四行（新版底栏换成了 AI 视频 / AI 图片，它们从这里进）。
 */
function MeNext({ name, phone, demo, identity, onLogout }: { name: string; phone?: string; demo: boolean; identity: ReturnType<typeof useIdentity>; onLogout: () => void }) {
  const layout = useLayoutMode();
  // 手机上没有电脑版顶栏那块余额，生成按钮也只写这次花多少：余额放在个人卡上（和电脑版同一个接口、同样不含冻结积分）。
  const { balance, error } = useWalletBalance(identity?.uid ?? null, true, "/me");
  const credit = error ? "—" : balance === undefined ? "…" : new Intl.NumberFormat("zh-CN").format(balance);
  return <main className="ip-brand-surface studio-next-page studio-me">
    <h1>我的</h1>
    <section className="studio-me-profile" aria-label="账号">
      <EditableAccountAvatar identity={identity} size={48} />
      <div><strong>{name}</strong>{phone && <span>{phone}</span>}{demo && <small>演示数据</small>}</div>
      <Link className="studio-me-credit" href={studioHref("#/membership")} aria-label={error ? "积分暂时读不出来，查看积分" : `可用积分 ${credit}，查看积分`} title="可用积分，不含冻结的；点击查看积分">
        <strong>{credit}</strong><span>可用积分</span>
      </Link>
    </section>
    <nav className="studio-me-group" aria-label="创作">
      <MeRow href="/templates" icon={Lightbulb} title="灵感" sub="官方案例和模板，可以直接做同款" />
      <MeRow href="/projects" icon={FolderOpen} title="项目" sub="画布与场景草稿，可继续编辑" />
      <MeRow href="/assets" icon={Layers} title="资产" sub="人物、声音与创作素材" />
      <MeRow href="/director" icon={Clapperboard} title="短剧导演台" sub="写剧本、拆分镜、出片" />
    </nav>
    <nav className="studio-me-group" aria-label="名片与授权">
      <MeRow href="/cards" icon={IdCard} title="我的名片" sub="对外发布面 · 扫码即看" />
      <MeRow href="/licenses" icon={ShieldCheck} title="授权中心" sub="人物和 IP 的授权证书" />
      <MeRow href={studioHref("#/tasks")} icon={ListChecks} title="任务中心" sub="生成任务的进度与历史" />
      <MeRow href={studioHref("#/realmaterials")} icon={ScanFace} title="真人授权素材库" sub="素材录制 · 审核状态" />
    </nav>
    <nav className="studio-me-group" aria-label="账号与设置">
      {ID_MODE && <MeRow href="/invitations" icon={UserPlus} title="邀请朋友" sub="管理邀请链接 · 查看邀请记录" />}
      <MeRow href={studioHref("#/membership")} icon={Gem} title="会员与算力" />
      {process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED === "1" && <MeRow href="/enterprise" icon={Building2} title="企业积分" sub="企业余额 · 积分分配 · 充值记录" />}
      <MeRow href={studioHref("#/storage")} icon={HardDrive} title="存储用量" />
      <MeRow href={studioHref("#/trash")} icon={Trash2} title="回收站" />
      <MeRow href={studioHref("#/settings")} icon={Settings} title="设置" />
    </nav>
    {/* 形态切换与新旧版切换：手机上没有顶栏，放在这里（见 LayoutSwitchRow / UiVersionRow 的说明）。 */}
    <div className="studio-me-group">
      {/* 电脑版的「我的」是 AccountOverview，到这里一定是手机版；挂载前不知道形态，先不画这一行。 */}
      {layout === "mobile" && <MeRow icon={Monitor} title="切换到电脑版" sub="画布和宽表格更好用" onClick={() => setLayout("desktop")} />}
      <MeRow icon={RotateCcw} title="回到旧版" sub="换回原来的首页和导航" onClick={() => setUiVersion("classic")} />
    </div>
    {!USE_MOCK && <button type="button" className="studio-me-logout" onClick={onLogout}>退出登录</button>}
    <HubTabBar />
  </main>;
}
