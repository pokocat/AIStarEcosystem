"use client";
// ============================================================
// 我的（五 Tab 定案）：账号 + 授权中心 + 任务中心 + 算力/存储/设置。
// 最近动态归首页，这里不再重复一份。
// 算力 / 存储 / 设置等管理页仍在 /studio（P3 逐屏迁出）。
// ============================================================
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Clapperboard, Compass, FolderOpen, Gem, HardDrive, IdCard, Layers, Lightbulb, ListChecks, Monitor, ScanFace, Settings, ShieldCheck, Trash2, UserPlus, type LucideIcon } from "lucide-react";
import { auth, ID_MODE, USE_MOCK, useIdentity } from "@/proto/api";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { studioHref } from "@/components/hub/data";
import { HubScreen, HubTabBar } from "@/components/hub/ui";
import { setLayout, useLayoutMode } from "@/shell/layout-mode";
import { AccountOverview } from "@/account/account-overview";
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
  return <MeMobile name={displayName} phone={identity?.phoneMasked} demo={USE_MOCK || !!identity?.demo} identity={identity} onLogout={logout} />;
}

type MeRowProps = { icon: LucideIcon; title: string; sub?: string } & ({ href: string } | { onClick: () => void });
function MeRow(props: MeRowProps) {
  const Icon = props.icon;
  const body = <><Icon size={18} strokeWidth={1.5} aria-hidden /><span><strong>{props.title}</strong>{props.sub && <small>{props.sub}</small>}</span><ChevronRight size={16} strokeWidth={1.5} aria-hidden /></>;
  return "href" in props ? <Link className="studio-me-row" href={props.href}>{body}</Link> : <button type="button" className="studio-me-row" onClick={props.onClick}>{body}</button>;
}

/**
 * 手机「我的」（2026-11-02）：和 AI 视频、AI 图片同一套设计语言，白底细线、细图标、字不加粗。
 * 底栏是 AI 视频 / AI 图片，灵感、项目、资产、短剧导演台、发现从这里进。
 */
function MeMobile({ name, phone, demo, identity, onLogout }: { name: string; phone?: string; demo: boolean; identity: ReturnType<typeof useIdentity>; onLogout: () => void }) {
  const layout = useLayoutMode();
  // 手机上没有电脑版那块余额，生成按钮也只写这次花多少：余额放在个人卡上（和电脑版同一个接口）。
  const { balance, error } = useWalletBalance(identity?.uid ?? null, true, "/me");
  const credit = error ? "—" : balance === undefined ? "…" : new Intl.NumberFormat("zh-CN").format(balance);
  return <main className="ip-brand-surface studio-next-page studio-me">
    <h1>我的</h1>
    <section className="studio-me-profile" aria-label="账号">
      <EditableAccountAvatar identity={identity} size={48} />
      <div><strong>{name}</strong>{phone && <span>{phone}</span>}{demo && <small>演示数据</small>}</div>
      <Link className="studio-me-credit" href={studioHref("#/membership")} aria-label={error ? "积分加载失败，查看积分" : `可用积分 ${credit}，查看积分`} title="可用积分，点击查看积分">
        <strong>{credit}</strong><span>可用积分</span>
      </Link>
    </section>
    <nav className="studio-me-group" aria-label="创作">
      <MeRow href="/templates" icon={Lightbulb} title="灵感" sub="官方案例和模板，可以直接做同款" />
      <MeRow href="/projects" icon={FolderOpen} title="项目" sub="画布与场景草稿，可继续编辑" />
      <MeRow href="/assets" icon={Layers} title="资产" sub="人物、声音与创作素材" />
      <MeRow href="/director" icon={Clapperboard} title="短剧导演台" sub="写剧本、拆分镜、生成视频" />
      <MeRow href="/discover" icon={Compass} title="发现" sub="官方可授权的形象" />
    </nav>
    <nav className="studio-me-group" aria-label="名片与授权">
      <MeRow href="/cards" icon={IdCard} title="我的名片" sub="对外发布面 · 扫码即看" />
      <MeRow href="/licenses" icon={ShieldCheck} title="授权中心" sub="人物和 IP 的授权证书" />
      <MeRow href={studioHref("#/tasks")} icon={ListChecks} title="任务历史" sub="生成记录和消耗的积分" />
      <MeRow href={studioHref("#/realmaterials")} icon={ScanFace} title="真人授权素材库" sub="素材录制 · 审核状态" />
    </nav>
    <nav className="studio-me-group" aria-label="账号与设置">
      {ID_MODE && <MeRow href="/invitations" icon={UserPlus} title="邀请朋友" sub="管理邀请链接 · 查看邀请记录" />}
      <MeRow href={studioHref("#/membership")} icon={Gem} title="会员与积分" />
      {process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED === "1" && <MeRow href="/enterprise" icon={Building2} title="企业积分" sub="企业余额 · 积分分配 · 充值记录" />}
      <MeRow href={studioHref("#/storage")} icon={HardDrive} title="存储用量" />
      <MeRow href={studioHref("#/trash")} icon={Trash2} title="回收站" />
      <MeRow href={studioHref("#/settings")} icon={Settings} title="设置" />
    </nav>
    {/* 宽度只是默认判据：竖持平板、手机浏览器的「请求桌面版网站」都可能想要电脑版（shell/layout-mode.ts）。
        电脑版的「我的」是 AccountOverview，到这里一定是手机版；挂载前不知道形态，先不画这一组。 */}
    {layout === "mobile" && <div className="studio-me-group"><MeRow icon={Monitor} title="切换到电脑版" sub="画布和宽表格更好用" onClick={() => setLayout("desktop")} /></div>}
    {!USE_MOCK && <button type="button" className="studio-me-logout" onClick={onLogout}>退出登录</button>}
    <HubTabBar />
  </main>;
}
