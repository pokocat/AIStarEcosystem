"use client";

// 当前用户已绑定的社交账号列表 + 行操作（验证 / 解绑）+ 新增按钮。
//
// 数据源：GET /me/social-accounts。useEffect 拉一次；BindAccountDialog 成功后通过
// onBound 回调插入头部，避免再次拉网络。

import * as React from "react";
import { Trash2, ShieldCheck, Plus, RefreshCw, QrCode } from "lucide-react";
import { SocialAccountApi, ApiError } from "@ai-star-eco/api-client";
import type { SocialAccount, SocialAccountStatus, SocialPlatform } from "@ai-star-eco/types/social-account";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { BindAccountDialog } from "./BindAccountDialog";
import { SocialPlatformLogo } from "./SocialPlatformLogo";
import { platformAccountLabel, platformDisplayName } from "./social-account-labels";
import { useConfirm } from "@/components/common/confirm-dialog";

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

/** 自动轮询间隔：只拉 DB 快照（不调 /verify），90s 一次即可。
 *  状态翻转主要靠用户主动点「重新验证」或 server 后台 sweep。 */
const AUTO_REFRESH_MS = 90_000;

/** 手动「重新验证」时，距上次 verify 不足这个时间的账号会被跳过，
 *  避免重复 burn 一次 playwright；用户想强制重验单个账号可点行内 ShieldCheck 按钮。 */
const VERIFY_TTL_MS = 10 * 60_000;

export function SocialAccountList({ onAccountsChange }: Props) {
  const [accounts, setAccounts] = React.useState<SocialAccount[]>([]);
  /** 首次加载：列表渲染骨架文案；后续刷新只让按钮图标转，不破坏行 UI */
  const [initialLoading, setInitialLoading] = React.useState(true);
  /** 当前是否正在拉网络 — 主动点刷新或自动轮询都置 true，但仅主动点会显式停按钮 */
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = React.useState<number | null>(null);
  const [lastListedAt, setLastListedAt] = React.useState<number | null>(null);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  /** 串行 verify 进度：null = 没在跑；非 null = 「正在验证 current/total: name」 */
  const [verifyProgress, setVerifyProgress] = React.useState<{
    current: number;
    total: number;
    accountName: string;
  } | null>(null);
  /** 用户切走 / unmount 时打断 in-flight 的串行 verify 循环。 */
  const cancelledRef = React.useRef(false);
  /** 同时只允许一个 fetch 在飞；避免点按钮的瞬间撞上自动 tick 导致两次同时拉。 */
  const inFlightRef = React.useRef(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  /** 续绑模式：从 PENDING 行点验证 → 带原 platform/accountName 重开 dialog。
   *  null 即新建绑定。dialog 关闭时清空，下次新建从空表单开始。 */
  const [dialogPrefill, setDialogPrefill] = React.useState<{
    platform: SocialPlatform;
    accountName: string;
  } | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const { confirm, ConfirmHost } = useConfirm();

  /**
   * 静默列表拉取：只 listSocialAccounts，拿 DB 当前快照（不触发 sau-service / playwright）。
   * 首次挂载 + 自动轮询 + 后台→前台都走这条。
   */
  const refreshList = React.useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const list = await SocialAccountApi.listSocialAccounts();
        setAccounts(list);
        onAccountsChange?.(list);
        setLastListedAt(Date.now());
        if (!opts.silent) setRefreshError(null);
      } catch (e) {
        if (!opts.silent) setRefreshError(e instanceof Error ? e.message : "刷新失败");
      } finally {
        inFlightRef.current = false;
        setInitialLoading(false);
      }
    },
    [onAccountsChange],
  );

  /**
   * 用户主动点「重新验证」：**串行**逐个 active 账号调 /verify。
   * 每个 verify 在 server 端会 spawn 一次 playwright（详见 sau-service /accounts/verify），
   * 所以一次只跑一个 chromium，避免并发压垮宿主机。
   * 已在 TTL 内（10min）验证过的账号自动跳过；想强制重验单个账号点行内 ShieldCheck 按钮。
   */
  const runVerifySerial = React.useCallback(async () => {
    if (refreshing) return;
    cancelledRef.current = false;
    setRefreshing(true);
    setRefreshError(null);
    try {
      // 先拉最新列表，再决定要验哪些
      const list = await SocialAccountApi.listSocialAccounts();
      setAccounts(list);
      onAccountsChange?.(list);
      setLastListedAt(Date.now());

      const now = Date.now();
      const todo = list.filter((a) => {
        if (a.status !== "active") return false;
        if (!a.lastVerifiedAt) return true;
        const last = new Date(a.lastVerifiedAt).getTime();
        return Number.isFinite(last) && now - last >= VERIFY_TTL_MS;
      });

      if (todo.length === 0) {
        setRefreshError(null);
        setLastRefreshedAt(Date.now());
        return;
      }

      let accumulated = list;
      for (let i = 0; i < todo.length; i++) {
        if (cancelledRef.current) break;
        const acc = todo[i];
        setVerifyProgress({ current: i + 1, total: todo.length, accountName: acc.accountName });
        try {
          const updated = await SocialAccountApi.verifySocialAccount(acc.id);
          accumulated = accumulated.map((a) => (a.id === updated.id ? updated : a));
          setAccounts(accumulated);
          onAccountsChange?.(accumulated);
        } catch (e) {
          // 单条失败不阻塞其他；记下最后一个错让用户知道，但继续跑下一个
          if (e instanceof ApiError) {
            setRefreshError(`${acc.accountName}：${e.message}`);
          } else if (e instanceof Error) {
            setRefreshError(`${acc.accountName}：${e.message}`);
          }
        }
      }
      setLastRefreshedAt(Date.now());
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : "刷新失败");
    } finally {
      setVerifyProgress(null);
      setRefreshing(false);
    }
  }, [refreshing, onAccountsChange]);

  // 首次挂载：只拉列表，不 auto-verify。验证由用户主动触发或后台 sweep 完成。
  React.useEffect(() => {
    void refreshList({ silent: false });
  }, [refreshList]);

  // 自动轮询 90s（只 list，不 verify）；切到后台 tab 时暂停，回到前台时立即拉一次再续
  React.useEffect(() => {
    let intervalId: number | undefined;
    const start = () => {
      if (intervalId != null) return;
      intervalId = window.setInterval(() => {
        void refreshList({ silent: true });
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
        void refreshList({ silent: true });
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
      cancelledRef.current = true;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [refreshList]);

  const handleBound = (account: SocialAccount) => {
    const next = [account, ...accounts.filter((a) => a.id !== account.id)];
    setAccounts(next);
    onAccountsChange?.(next);
  };

  /** 打开续绑 dialog：把原 platform + accountName 带过去。 */
  const openResumeBind = React.useCallback((acc: SocialAccount) => {
    setDialogPrefill({ platform: acc.platform, accountName: acc.accountName });
    setDialogOpen(true);
  }, []);

  /**
   * 处理"账号操作"按钮：
   *   - active   → 调 /verify 刷新 lastVerifiedAt（或翻 expired）
   *   - pending  → 直接重开 BindAccountDialog（之前的 PENDING 行无 cookie，验证只会报错）
   *   - expired / banned → 同样重开 BindAccountDialog 引导重新扫码
   *
   * Server 仍可能因为竞态返回 ACCOUNT_NOT_BOUND (409)；defensively 兜底也走重绑。
   */
  const handleAccountAction = async (acc: SocialAccount) => {
    if (acc.status !== "active") {
      openResumeBind(acc);
      return;
    }
    setBusyId(acc.id);
    try {
      const updated = await SocialAccountApi.verifySocialAccount(acc.id);
      const next = accounts.map((a) => (a.id === acc.id ? updated : a));
      setAccounts(next);
      onAccountsChange?.(next);
    } catch (e) {
      if (e instanceof ApiError && e.code === "ACCOUNT_NOT_BOUND") {
        // 列表上看着是 active 但后端已经清了 cookie —— 引导用户重绑。
        openResumeBind(acc);
      } else {
        throw e;
      }
    } finally {
      setBusyId(null);
    }
  };

  const unbind = async (id: string) => {
    const target = accounts.find((a) => a.id === id);
    const accLabel = target ? target.accountName : "该账号";
    const ok = await confirm({
      title: `解绑${accLabel}？`,
      description: "解绑后将无法用此账号继续发布；已发布的视频不受影响。",
      confirmText: "解绑",
      tone: "danger",
    });
    if (!ok) return;
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
            <span
              className="text-[10px] font-mono text-zinc-400"
              title={lastListedAt ? new Date(lastListedAt).toLocaleString() : undefined}
            >
              {lastListedAt ? `· 列表 ${formatRelativeSeconds(lastListedAt)}更新` : ""}
            </span>
            {lastRefreshedAt && (
              <span
                className="text-[10px] font-mono text-zinc-400"
                title={new Date(lastRefreshedAt).toLocaleString()}
              >
                · 上次验证 {formatRelativeSeconds(lastRefreshedAt)}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            仅绑定本人持有的账号；账号凭据已加密存储，平台密码全程不接触。
            重新验证一次一个账号串行进行，不会并发压宿主机。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void runVerifySerial()}
            disabled={refreshing}
            aria-label="串行重新验证所有 active 账号"
            aria-busy={refreshing}
            title="对每个活跃账号串行跑一次平台请求验证 cookie。10 分钟内已验证过的会自动跳过；想强制重验单个账号请点该行的图标。"
            className={cn(
              CTA_SECONDARY,
              "px-3 py-1.5 text-xs",
              refreshing && "cursor-wait opacity-80",
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {verifyProgress
              ? `验证中 ${verifyProgress.current}/${verifyProgress.total}…`
              : refreshing
              ? "验证中…"
              : "重新验证"}
          </button>
          <button
            type="button"
            className={CTA_PRIMARY}
            onClick={() => {
              setDialogPrefill(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> 新增绑定
          </button>
        </div>
      </header>

      {verifyProgress && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>
            正在验证 {verifyProgress.current}/{verifyProgress.total}：
            <span className="font-medium">{verifyProgress.accountName}</span>
          </span>
        </div>
      )}

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
            const platform = platformDisplayName(a.platform);
            const identityParts = [
              platform,
              a.displayName || null,
              a.platformAccountId
                ? `${platformAccountLabel(a.platform)} ${a.platformAccountId}`
                : null,
            ].filter(Boolean);
            return (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <div className="relative h-9 w-9 shrink-0">
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
                  <SocialPlatformLogo
                    platform={a.platform}
                    size="xs"
                    className="absolute -bottom-0.5 -right-0.5 ring-2 ring-white"
                  />
                </div>
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
                  {a.status === "active" ? (
                    <button
                      type="button"
                      aria-label="验证"
                      title="重新验证账号登录是否仍然有效"
                      disabled={busyId === a.id}
                      className={cn(CTA_SECONDARY, "px-2.5 py-1.5 text-xs")}
                      onClick={() => void handleAccountAction(a)}
                    >
                      {busyId === a.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="重新扫码绑定"
                      title="该账号尚未完成绑定 / 已失效；点此重新扫码"
                      disabled={busyId === a.id}
                      className={cn(CTA_SECONDARY, "px-2.5 py-1.5 text-xs")}
                      onClick={() => openResumeBind(a)}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="解绑"
                    title="解绑账号（凭据将一并清除）"
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

      <BindAccountDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setDialogPrefill(null);
        }}
        onBound={handleBound}
        prefill={dialogPrefill}
      />
      <ConfirmHost />
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
