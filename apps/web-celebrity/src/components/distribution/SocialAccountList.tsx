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
import { platformAccountLabel } from "./social-account-labels";

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

/** 自动轮询间隔：账号被异步验证 / 失效的状态可能在 server 端被后台扫描器更新，
 *  前端 30s 拉一次足够新但不密集；与 mixcut 侧栏的 4s 轮询定位不同（那里靠近实时）。 */
const AUTO_REFRESH_MS = 30_000;

export function SocialAccountList({ onAccountsChange }: Props) {
  const [accounts, setAccounts] = React.useState<SocialAccount[]>([]);
  /** 首次加载：列表渲染骨架文案；后续刷新只让按钮图标转，不破坏行 UI */
  const [initialLoading, setInitialLoading] = React.useState(true);
  /** 当前是否正在拉网络 — 主动点刷新或自动轮询都置 true，但仅主动点会显式停按钮 */
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = React.useState<number | null>(null);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  /** 同时只允许一个 fetch 在飞；避免点按钮的瞬间撞上自动 tick 导致两次同时拉。 */
  const inFlightRef = React.useRef(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  /**
   * silent=true → 自动轮询走的路径：不闪按钮 spinner、错误吞掉（避免页面飘红）。
   * silent=false → 用户主动点刷新：按钮转图标 + 失败提示。
   */
  const refresh = React.useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (!opts.silent) setRefreshing(true);
      try {
        const list = await SocialAccountApi.listSocialAccounts();
        setAccounts(list);
        onAccountsChange?.(list);
        setLastRefreshedAt(Date.now());
        setRefreshError(null);
      } catch (e) {
        if (!opts.silent) {
          setRefreshError(e instanceof Error ? e.message : "刷新失败");
        }
        // silent 模式下吞错；下一个 tick 会再试，不打扰用户
      } finally {
        inFlightRef.current = false;
        if (!opts.silent) setRefreshing(false);
        setInitialLoading(false);
      }
    },
    [onAccountsChange],
  );

  // 首次挂载拉一次
  React.useEffect(() => {
    void refresh({ silent: false });
  }, [refresh]);

  // 自动轮询 30s；切到后台 tab 时暂停，回到前台时立即拉一次再续
  React.useEffect(() => {
    let intervalId: number | undefined;
    const start = () => {
      if (intervalId != null) return;
      intervalId = window.setInterval(() => {
        void refresh({ silent: true });
      }, AUTO_REFRESH_MS);
    };
    const stop = () => {
      if (intervalId != null) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh({ silent: true });
        start();
      } else {
        stop();
      }
    };
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      start();
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
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
      <header className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-zinc-800">已绑定账号</h2>
            <span className="text-[10px] font-mono text-zinc-400" title={lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleString() : undefined}>
              {lastRefreshedAt
                ? `· 刚刷新于 ${formatRelativeSeconds(lastRefreshedAt)}`
                : ""}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            仅绑定本人持有的账号；cookie 在服务端加密存储，前端永远不接触明文。每 30 秒自动同步一次。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh({ silent: false })}
            disabled={refreshing}
            aria-label="刷新账号列表"
            aria-busy={refreshing}
            title={
              lastRefreshedAt
                ? `上次刷新：${new Date(lastRefreshedAt).toLocaleString()}`
                : "刷新列表"
            }
            className={cn(
              CTA_SECONDARY,
              "px-3 py-1.5 text-xs",
              refreshing && "cursor-wait opacity-80",
            )}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
            {refreshing ? "刷新中…" : "刷新"}
          </button>
          <button type="button" className={CTA_PRIMARY} onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> 新增绑定
          </button>
        </div>
      </header>

      {refreshError && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
          {refreshError}
        </div>
      )}

      {initialLoading ? (
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
            const identityParts = [
              platform,
              a.displayName || null,
              a.platformAccountId
                ? `${platformAccountLabel(a.platform)} ${a.platformAccountId}`
                : null,
            ].filter(Boolean);
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
                    {identityParts.join(" · ")}
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

/** 把毫秒时间戳格式化为「刚刚 / Ns 前 / Nmin 前」。30s 内显示秒，超过 1h 走绝对时间. */
function formatRelativeSeconds(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "刚刚";
  if (sec < 60) return `${sec} 秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  return new Date(ts).toLocaleTimeString();
}
