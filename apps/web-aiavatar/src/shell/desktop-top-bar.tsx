"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IdCard, LogOut, Search, Shield, Smartphone, UserRound, Compass } from "lucide-react";
import { auth, USE_MOCK, useIdentity } from "@/proto/api";
import { setLayout } from "./layout-mode";
import { useStudioHash } from "./account-workspace";
import { WalletBadge } from "./wallet-badge";

const navigation = [
  { href: "/dashboard", label: "首页" },
  { href: "/create", label: "创作" },
  { href: "/ips", label: "IP 管理" },
  { href: "/templates", label: "模板管理" },
  { href: "/assets", label: "素材库" },
];

/** The canvas keeps its native tools; this shared product navigation uses the approved light shell. */
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
  return <header className={"desktop-top-bar ip-surface ip-brand-surface" + (publicMode ? " ip-public-top-bar" : "")}>
    <Link href={authed ? "/dashboard" : "/"} className="ip-brand-logo" aria-label="AI IP 画布首页"><span aria-hidden="true">A</span><strong>AI IP 画布</strong></Link>
    <nav className="ip-top-navigation" aria-label="主导航">{navigation.map(n => {
      const current = n.href === "/dashboard" ? pathname === "/" || pathname === "/dashboard" : n.href === "/create" ? pathname === "/create" || (pathname.startsWith("/projects") && !pathname.startsWith("/projects/demos")) : n.href === "/templates" ? pathname.startsWith("/templates") || pathname.startsWith("/projects/demos") : pathname.startsWith(n.href);
      return <Link key={n.href} href={n.href} aria-current={current ? "page" : undefined}>{n.label}</Link>;
    })}</nav>
    <div className="ip-top-account">
      <Link href="/ips?focus=search" className="ip-top-icon" aria-label="搜索 IP" title="搜索 IP"><Search size={21} aria-hidden="true" /></Link>
      {authed ? <><WalletBadge account={identity?.uid ?? null} location={pathname + hash} />
        <details ref={menuRef} className="ip-account-menu"><summary aria-label={name + "，打开账号菜单"} title={name}><span>{name.charAt(0)}</span></summary><div onClick={closeMenu}>
          <strong>{name}</strong>
          <Link href="/me"><UserRound size={16} />我的账号</Link>
          <Link href="/licenses"><Shield size={16} />授权管理</Link>
          <Link href="/cards"><IdCard size={16} />名片</Link>
          <Link href="/discover"><Compass size={16} />发现</Link>
          <button onClick={() => setLayout("mobile")}><Smartphone size={16} />切换到手机版</button>
          <button onClick={() => auth.logout()}><LogOut size={16} />退出登录</button>
        </div></details></> : <Link className="ip-brand-button ip-top-login" href="/login?next=%2Fdashboard">登录 / 注册</Link>}
    </div>
  </header>;
}
