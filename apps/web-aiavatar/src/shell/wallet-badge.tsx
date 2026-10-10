"use client";

import Link from "next/link";
import { Coins, RefreshCw } from "lucide-react";
import { useWalletBalance } from "./wallet-balance";
import { useLayoutMode } from "./layout-mode";

export function WalletBadge({ account, location }: { account: string | null; location: string }) {
  const layout = useLayoutMode();
  const { balance, error, refresh } = useWalletBalance(account, layout === "desktop", location);
  const amount = balance === undefined ? "—" : new Intl.NumberFormat("zh-CN").format(balance);
  return <div className="desktop-credit">
    <Link href="/studio#/membership" className="desktop-credit-link" aria-label={error ? "积分暂不可用，查看积分" : `可用积分：${amount}，查看积分`} title={error ? "余额加载失败，可重试或进入积分页面" : "可用积分，不含冻结积分；点击查看积分"}>
      <Coins size={15} aria-hidden="true" />{error ? <span>积分暂不可用</span> : <><strong>{amount}</strong><span>积分</span></>}
    </Link>
    {error && <button type="button" onClick={refresh} className="desktop-credit-retry" aria-label="重试加载积分" title="重试加载积分"><RefreshCw size={14} aria-hidden="true" /></button>}
  </div>;
}
