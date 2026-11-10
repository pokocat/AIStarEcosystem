"use client";

import Link from "next/link";
import { Building2, Coins, RefreshCw } from "lucide-react";
import { useEnterpriseCredits, useWalletBalance } from "./wallet-balance";
import { useLayoutMode } from "./layout-mode";

const format = (value: number) => new Intl.NumberFormat("zh-CN").format(value);

/** `enterprise` adds the member's enterprise credits next to their own, for places that pay for generation. */
export function WalletBadge({ account, location, enterprise = false }: { account: string | null; location: string; enterprise?: boolean }) {
  const layout = useLayoutMode();
  const { balance, error, refresh } = useWalletBalance(account, layout === "desktop", location);
  const company = useEnterpriseCredits(account, enterprise && layout === "desktop", location);
  const amount = balance === undefined ? "—" : format(balance);
  const label = company ? "个人积分" : "积分";
  return <div className="desktop-credit">
    <Link href="/me/credits" className="desktop-credit-link" aria-label={error ? "积分暂不可用，查看积分" : `可用${label}：${amount}，查看积分`} title={error ? "余额加载失败，可重试或进入积分页面" : `可用${label}，点击查看明细`}>
      <Coins size={15} aria-hidden="true" />{error ? <span>积分暂不可用</span> : <><strong>{amount}</strong><span>{label}</span></>}
    </Link>
    {error && <button type="button" onClick={refresh} className="desktop-credit-retry" aria-label="重试加载积分" title="重试加载积分"><RefreshCw size={14} aria-hidden="true" /></button>}
    {company && <Link href="/me/enterprise" className="desktop-credit-link" aria-label={`${company.name} 分配给你的企业积分：${format(company.balance)}，查看企业`} title={`${company.name} 分配给你的企业积分，点击查看企业`}>
      <Building2 size={15} aria-hidden="true" /><strong>{format(company.balance)}</strong><span>企业积分</span>
    </Link>}
  </div>;
}
