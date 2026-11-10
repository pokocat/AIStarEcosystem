"use client";

// 账号区外壳（2026-11-09 新版，设计稿「账号页新版设计稿」）：电脑版是账号卡 + 页内标签，手机版是返回栏 + 标题。
// 左边的全站导航栏由根布局给，这里不再画第二列菜单。

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ModelBillingApi } from "@ai-star-eco/api-client";
import { USE_MOCK, useIdentity, type MeIdentity } from "@/proto/api";
import { STUDIO_NAVIGATION_EVENT, visibleAccountPages } from "./account-navigation";
import { useLayoutMode } from "./layout-mode";
import { AccountAvatar } from "./account-avatar";
import { useWalletBalance } from "./wallet-balance";

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

const number = new Intl.NumberFormat("zh-CN");

/** 模型赠款里现在还能用的合计（活动有效、没过期）。只用于账号卡展示，不并入可用积分。 */
export function useGrantTotal(uid: string | null | undefined) {
  const [total, setTotal] = useState<number>();
  useEffect(() => {
    if (!uid || USE_MOCK) return; // 演示模式没有赠款数据，不去请求真接口
    let live = true;
    ModelBillingApi.myGrants({ page: 0, size: 50 }).then(result => {
      if (!live) return;
      const now = Date.now();
      setTotal(result.data.filter(g => g.campaignActive && (!g.expiresAt || Date.parse(g.expiresAt) > now)).reduce((sum, g) => sum + g.available, 0));
    }).catch(() => { if (live) setTotal(undefined); });
    return () => { live = false; };
  }, [uid]);
  return total;
}

function AccountHero({ identity, active }: { identity: MeIdentity | null | undefined; active?: string }) {
  const { balance, error } = useWalletBalance(identity?.uid ?? null, true, "/me");
  const grants = useGrantTotal(identity?.uid);
  const credit = error ? "—" : balance === undefined ? "…" : number.format(balance);
  return <section className="account-hero" aria-label="账号">
    <span className="account-hero-avatar"><AccountAvatar identity={identity} size={56} /></span>
    <div className="account-hero-who">
      <small>我的账号</small>
      <h1 title={identity?.displayName}>{identity?.displayName || "我的账号"}</h1>
      <p>{[identity?.phoneMasked, identity?.uid ? `ID ${identity.uid}` : null].filter(Boolean).join(" · ")}</p>
      {(USE_MOCK || identity?.demo) && <span className="account-tag account-demo">演示数据</span>}
    </div>
    <div className="account-hero-balance">
      <div><small>可用积分</small><strong>{credit}</strong></div>
      {grants !== undefined && grants > 0 && <div><small>模型赠款</small><strong className="is-grant">{number.format(grants)}</strong></div>}
      {active !== "credits" && <Link className="account-go" href="/me/credits">充值</Link>}
    </div>
  </section>;
}

/**
 * 账号区页面的外壳。{@code active} 是当前标签；{@code subTabs} 是「存储」「授权」这类页内子标签，按当前地址高亮。
 * 手机版只给返回栏，返回「我的」。
 */
export function AccountShell({ active, title, subTabs, children }: {
  active?: string; title: string; subTabs?: readonly { href: string; label: string }[]; children: ReactNode;
}) {
  const layout = useLayoutMode();
  const identity = useIdentity();
  const pathname = usePathname();
  return <main className="ip-brand-surface studio-next-page account-page">
    {layout === "desktop" ? <>
      <AccountHero identity={identity} active={active} />
      <nav className="account-tabs" aria-label="账号">
        {visibleAccountPages().map(page => <Link key={page.key} href={page.href} aria-current={active === page.key ? "page" : undefined}>{page.label}</Link>)}
      </nav>
    </> : <header className="account-mobile-bar">
      <Link href="/me" aria-label="返回"><ChevronLeft size={20} strokeWidth={1.6} /></Link>
      <h1>{title}</h1><span />
    </header>}
    {subTabs && <nav className="account-subtabs" aria-label={title}>
      {subTabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined}>{tab.label}</Link>)}
    </nav>}
    {children}
  </main>;
}
