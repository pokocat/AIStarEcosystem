"use client";

// 当前用户已绑定的社交账号列表 + 行操作（验证 / 解绑）+ 新增按钮。
//
// 数据源：GET /me/social-accounts。useEffect 拉一次；BindAccountDialog 成功后通过
// onBound 回调插入头部，避免再次拉网络。

import * as React from "react";
import { Trash2, ShieldCheck, Plus, RefreshCw } from "lucide-react";
import { SocialAccountApi } from "@ai-star-eco/api-client";
import type { SocialAccount, SocialAccountStatus } from "@ai-star-eco/types/social-account";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { BindAccountDialog } from "./BindAccountDialog";

const PLATFORM_LABEL: Record<string, string> = {
  douyin: "抖音",
  kuaishou: "快手",
  xiaohongshu: "小红书",
  shipinhao: "视频号",
  bilibili: "B站",
  tiktok: "TikTok",
  youtube: "YouTube",
  baijiahao: "百家号",
};

const STATUS_META: Record<SocialAccountStatus, { label: string; cls: string }> = {
  active: { label: "可用", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { label: "绑定中", cls: "bg-zinc-50 text-zinc-600 border-zinc-200" },
  expired: { label: "已失效", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  banned: { label: "被封禁", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

interface Props {
  /** 父组件 (DistributionPage) 把当前账号列表共享给 PublishJobList — selectable */
  onAccountsChange?: (accounts: SocialAccount[]) => void;
}

export function SocialAccountList({ onAccountsChange }: Props) {
  const [accounts, setAccounts] = React.useState<SocialAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await SocialAccountApi.listSocialAccounts();
      setAccounts(list);
      onAccountsChange?.(list);
    } finally {
      setLoading(false);
    }
  }, [onAccountsChange]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleBound = (account: SocialAccount) => {
    const next = [account, ...accounts.filter((a) => a.id !== account.id)];
    setAccounts(next);
    onAccountsChange?.(next);
  };

  const verify = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await SocialAccountApi.verifySocialAccount(id);
      const next = accounts.map((a) => (a.id === id ? updated : a));
      setAccounts(next);
      onAccountsChange?.(next);
    } finally {
      setBusyId(null);
    }
  };

  const unbind = async (id: string) => {
    if (!window.confirm("解绑后将无法用此账号继续发布，确定继续？")) return;
    setBusyId(id);
    try {
      await SocialAccountApi.unbindSocialAccount(id);
      const next = accounts.filter((a) => a.id !== id);
      setAccounts(next);
      onAccountsChange?.(next);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[var(--shadow-soft)]">
      <header className="flex items-center justify-between border-b border-zinc-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-800">已绑定账号</h2>
          <p className="text-xs text-zinc-500">
            仅绑定本人持有的账号；cookie 在服务端加密存储，前端永远不接触明文。
          </p>
        </div>
        <button type="button" className={CTA_PRIMARY} onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> 新增绑定
        </button>
      </header>

      {loading ? (
        <div className="py-8 text-center text-sm text-zinc-400">加载中……</div>
      ) : accounts.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-400">
          还没有绑定任何账号，点右上「新增绑定」开始。
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {accounts.map((a) => {
            const meta = STATUS_META[a.status] ?? STATUS_META.pending;
            const platform = PLATFORM_LABEL[a.platform] ?? a.platform;
            return (
              <li key={a.id} className="flex items-center gap-3 py-3">
                {a.avatarUrl ? (
                  <img
                    src={a.avatarUrl}
                    alt={a.accountName}
                    className="h-9 w-9 rounded-full border border-zinc-200 object-cover"
                  />
                ) : (
                  <div className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
                    {platform.slice(0, 1)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm text-zinc-800">
                    <span className="truncate font-medium">{a.accountName}</span>
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                        meta.cls,
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {platform}
                    {a.displayName ? ` · ${a.displayName}` : ""}
                    {a.lastVerifiedAt
                      ? ` · 上次验证 ${new Date(a.lastVerifiedAt).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="验证"
                    title="验证 cookie 是否仍有效"
                    disabled={busyId === a.id}
                    className={cn(CTA_SECONDARY, "px-2.5 py-1.5 text-xs")}
                    onClick={() => verify(a.id)}
                  >
                    {busyId === a.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="解绑"
                    title="解绑账号 (密文 cookie 一并删除)"
                    disabled={busyId === a.id}
                    className={cn(CTA_SECONDARY, "px-2.5 py-1.5 text-xs hover:border-rose-300 hover:text-rose-600")}
                    onClick={() => unbind(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <BindAccountDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onBound={handleBound} />
    </section>
  );
}
