"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Compass, Gem, ListChecks, LogOut, Settings, Smartphone, UserRound } from "lucide-react";
import { auth, USE_MOCK, useIdentity } from "@/proto/api";
import { setLayout } from "./layout-mode";
import { useStudioHash } from "./account-workspace";
import { WalletBadge } from "./wallet-badge";
import { studioNavigation, studioNavigationCurrent } from "./studio-navigation";
import { studioNavigationIcon } from "./studio-navigation-icons";
import { RailSceneFlyout } from "./rail-scene-flyout";
import { AccountAvatar } from "./account-avatar";

/** The canvas keeps its native tools. 登录后是左侧一列，没登录的公开落地页（publicMode）是顶栏。 */
export function DesktopTopBar({ publicMode = false }: { publicMode?: boolean }) {
  const pathname = usePathname() ?? "";
  const hash = useStudioHash();
  const identity = useIdentity();
  const [authed, setAuthed] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };
  useEffect(() => { setAuthed(USE_MOCK || auth.isAuthed()); }, [pathname]);
  useEffect(() => { closeMenu(); }, [pathname, hash]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) closeMenu();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuRef.current?.open) {
        closeMenu();
        menuRef.current?.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const name = identity?.displayName || "我的账号";
  const accountMenu = <details ref={menuRef} className="ip-account-menu"><summary aria-label={name + "，打开账号菜单"} title={name}><AccountAvatar identity={identity} size="100%" /></summary><div onClick={closeMenu}>
    <strong>{name}</strong>
    {/* 2026-11-10：菜单只放账号区最常用的几项，其余从「我的账号」的标签进入。 */}
    <Link href="/me"><UserRound size={16} />我的账号</Link>
    <Link href="/me/tasks"><ListChecks size={16} />任务历史</Link>
    <Link href="/me/credits"><Gem size={16} />积分</Link>
    {process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED === "1" && <Link href="/me/enterprise"><Building2 size={16} />企业</Link>}
    <Link href="/me/settings"><Settings size={16} />设置</Link>
    <Link href="/discover"><Compass size={16} />发现</Link>
    <button onClick={() => setLayout("mobile")}><Smartphone size={16} />切换到手机版</button>
    <button onClick={() => auth.logout()}><LogOut size={16} />退出登录</button>
  </div></details>;
  // 登录后的工作台：左侧一列图标 + 文字（参考 docs/studio-scene-creation.md §2）。
  if (!publicMode) return <header className="desktop-top-bar desktop-rail ip-surface ip-brand-surface">
    <Link href={authed ? "/dashboard" : "/"} className="desktop-rail-logo" aria-label="IP Studio · 声量引擎旗下首页" title="IP Studio · 声量引擎旗下"><img src="/brand/ip-studio-logo.png" width={32} height={32} alt="" /></Link>
    <nav className="desktop-rail-navigation" aria-label="主导航">{studioNavigation.map(n => {
      const current = studioNavigationCurrent(n.href, pathname);
      const Icon = studioNavigationIcon(n.href);
      const link = <Link key={n.href} href={n.href} aria-current={current ? "page" : undefined}><span><Icon size={17} strokeWidth={1.4} aria-hidden="true" /></span>{n.label}</Link>;
      // AI 视频 / AI 图片：鼠标停上去就弹出全部场景（rail-scene-flyout.tsx）。
      return n.href === "/video" || n.href === "/image"
        ? <RailSceneFlyout key={n.href} kind={n.href === "/video" ? "video" : "image"} label={n.label} enabled={authed}>{link}</RailSceneFlyout>
        : link;
    })}</nav>
    <div className="desktop-rail-account">
      {authed ? <><WalletBadge account={identity?.uid ?? null} location={pathname + hash} />{accountMenu}</> : <Link className="ip-brand-button" href="/login?next=%2Fdashboard">登录</Link>}
    </div>
  </header>;
  return <header className="desktop-top-bar ip-surface ip-brand-surface ip-public-top-bar">
    <Link href="/" className="ip-brand-logo" aria-label="IP Studio · 声量引擎旗下首页"><img src="/brand/ip-studio-logo.png" width={38} height={38} alt="" /><strong>IP Studio <small>· 声量引擎旗下</small></strong></Link>
    <nav className="ip-top-navigation" aria-label="主导航">{studioNavigation.map(n => {
      const current = studioNavigationCurrent(n.href, pathname);
      return <Link key={n.href} href={n.href} aria-current={current ? "page" : undefined}>{n.label}</Link>;
    })}</nav>
    <div className="ip-top-account"><Link className="ip-brand-button ip-top-login" href="/login?next=%2Fdashboard">登录 / 注册</Link></div>
  </header>;
}
