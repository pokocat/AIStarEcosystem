"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ClipboardList, Coins, HardDrive, Image, Settings, Trash2, UserRound } from "lucide-react";
import { ACCOUNT_PAGES, accountPageKey, STUDIO_NAVIGATION_EVENT } from "./account-navigation";
import { useLayoutMode } from "./layout-mode";

const icons = { user: UserRound, tasks: ClipboardList, credits: Coins, storage: HardDrive, materials: Image, trash: Trash2, settings: Settings };

export function useStudioHash() {
  const [hash, setHash] = useState("");
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    for (const event of ["hashchange", "popstate", STUDIO_NAVIGATION_EVENT]) window.addEventListener(event, read);
    return () => { for (const event of ["hashchange", "popstate", STUDIO_NAVIGATION_EVENT]) window.removeEventListener(event, read); };
  }, []);
  return hash;
}

export function AccountWorkspace({ children, tool = false }: { children: ReactNode; tool?: boolean }) {
  const hash = useStudioHash();
  const layout = useLayoutMode();
  const active = tool ? accountPageKey(hash) : "me";
  return <div className={`account-workspace${layout === "desktop" ? " ip-surface" : ""}${tool ? " account-workspace--tool" : ""}`}>
    <aside className="account-navigation">
      <Link href="/projects" className="account-return"><ArrowLeft size={16} />返回自由画布</Link>
      <nav aria-label="账号中心">
        {ACCOUNT_PAGES.map(page => { const Icon = icons[page.icon]; return <a key={page.key} href={page.href} aria-current={active === page.key ? "page" : undefined}>
          <Icon size={18} /><span>{page.label}</span>
        </a>; })}
      </nav>
    </aside>
    <main className={tool ? "account-legacy-content" : "account-overview"}>{children}</main>
  </div>;
}

export function AccountOverview({ name, phone, demo }: { name: string; phone?: string; demo?: boolean }) {
  return <AccountWorkspace>
    <header className="account-overview-header"><div><h1>我的账号</h1><p>管理账号、积分和创作资源</p></div><Link href="/projects" className="account-create-link">回到自由画布<ArrowRight size={16}/></Link></header>
    <section className="account-profile" aria-label="账号信息">
      <span className="account-avatar" aria-hidden="true">{Array.from(name.trim())[0] || "我"}</span>
      <div><h2 title={name}>{name}</h2><p>{phone || "手机号与登录方式可在账号与安全中管理"}{demo && <span className="account-demo">演示数据</span>}</p></div>
      <Link href="/studio#/security">账号与安全</Link>
    </section>
    <section className="account-overview-section" aria-labelledby="account-management-title">
      <h2 id="account-management-title">账号管理</h2>
      <div className="account-action-list">
        {[{ href: "/studio#/membership", title: "会员与积分", text: "查看权益、积分余额与充值套餐" }, { href: "/studio#/storage", title: "存储用量", text: "查看各类资产的空间占用" }, { href: "/studio#/tasks", title: "任务中心", text: "查看资产生成任务的进度与历史" }].map(item => <Link href={item.href} key={item.href}><span><strong>{item.title}</strong><small>{item.text}</small></span><ArrowRight size={16} aria-hidden="true"/></Link>)}
      </div>
    </section>
    <section className="account-overview-section" aria-labelledby="account-assets-title">
      <h2 id="account-assets-title">创作与资产</h2>
      <div className="account-resource-links"><Link href="/assets">我的资产</Link><Link href="/cards">我的名片</Link><Link href="/licenses">授权中心</Link><Link href="/studio#/realmaterials">真人授权素材</Link><Link href="/studio#/trash">回收站</Link></div>
    </section>
  </AccountWorkspace>;
}
