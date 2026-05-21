"use client";

// 扫码绑定第三方社交账号的 modal。
//   步骤 1: 选平台 + accountName → POST /me/social-accounts/bind-init
//   步骤 2: 显示 QR + 轮询 /bind-poll；status===success → 关闭并通知父组件
//   步骤 3: 5min 内无扫码 → status===expired → 用户可重试
//
// storage_state 全程不出现在前端代码 —— 这里的所有交互只看 SocialAccount DTO。

import * as React from "react";
import { X, RefreshCw, Loader2 } from "lucide-react";
import { SocialAccountApi, ApiError } from "@ai-star-eco/api-client";
import type {
  SocialAccount,
  SocialAccountBindInit,
  SocialPlatform,
} from "@ai-star-eco/types/social-account";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ai-star-eco/ui/ui/select";

const ENABLED_PLATFORMS: Array<{ id: SocialPlatform; label: string }> = [
  { id: "douyin", label: "抖音" },
  { id: "kuaishou", label: "快手" },
  { id: "xiaohongshu", label: "小红书" },
  { id: "shipinhao", label: "视频号" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onBound: (account: SocialAccount) => void;
  /**
   * 续绑模式：用户对一条 PENDING 行点了"验证"按钮 → 我们带着原平台 + 别名
   * 重开 dialog，让他直接点"开始扫码"补完流程，不用手动重选。
   *
   * 行为：dialog 打开时 platform + accountName 用 prefill 初始化（用户仍可改）。
   */
  prefill?: { platform: SocialPlatform; accountName: string } | null;
}

export function BindAccountDialog({ open, onClose, onBound, prefill }: Props) {
  const [platform, setPlatform] = React.useState<SocialPlatform>("douyin");
  const [accountName, setAccountName] = React.useState("");
  const [init, setInit] = React.useState<SocialAccountBindInit | null>(null);
  const [pollStatus, setPollStatus] = React.useState<"idle" | "pending" | "expired" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  // submitting：「开始扫码」按钮按下到 /bind-init 返回的中间态。
  // 没有该 flag 时按钮看起来"没反应"——sau-service 调 playwright 抓 QR 可能耗 3-8s。
  const [submitting, setSubmitting] = React.useState(false);

  // succeededRef = 当前 ticket 已经扫码成功 (poll 拿到 status=success)。
  // 关闭路径若发现此 flag 仍为 false → 视为「用户中途取消」→ 触发 cancelBind 杀
  // playwright 进程 + 删 PENDING 行。setState 是异步的，所以用 ref 在闭包里稳读。
  const succeededRef = React.useRef(false);

  // fire-and-forget bind-cancel：调用方不等响应，dialog 立即关；后端幂等。
  const fireCancel = React.useCallback((ticket: string) => {
    SocialAccountApi.cancelBind(ticket).catch(() => {
      /* 用户已经离开界面，悄悄吞掉错误；ticket TTL 也会兜底 sweep。 */
    });
  }, []);

  // reset all state when modal toggles。打开时若带 prefill 就用它初始化表单，
  // 让用户从 PENDING 行点验证 → 弹出已经填好 platform/accountName 的 dialog。
  React.useEffect(() => {
    if (open) {
      setPlatform(prefill?.platform ?? "douyin");
      setAccountName(prefill?.accountName ?? "");
      setInit(null);
      setPollStatus("idle");
      setErrorMsg(null);
      setSubmitting(false);
      succeededRef.current = false;
    } else {
      setPlatform("douyin");
      setAccountName("");
      setInit(null);
      setPollStatus("idle");
      setErrorMsg(null);
      setSubmitting(false);
      succeededRef.current = false;
    }
  }, [open, prefill]);

  // poll loop: while init exists and status pending, hit /bind-poll every 2s
  React.useEffect(() => {
    if (!init) return;
    let cancelled = false;
    setPollStatus("pending");
    const tick = async () => {
      try {
        const res = await SocialAccountApi.pollBind(init.sessionTicket);
        if (cancelled) return;
        if (res.status === "success" && res.account) {
          succeededRef.current = true;
          onBound(res.account);
          onClose();
        } else if (res.status === "expired") {
          setPollStatus("expired");
        } else {
          setPollStatus("pending");
        }
      } catch (e) {
        if (cancelled) return;
        setPollStatus("error");
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    };
    const id = window.setInterval(tick, 2000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [init, onBound, onClose]);

  // 离开页面 / 刷新：如果还在扫码中，用 sendBeacon 兜底通知后端清理。
  // 普通关闭 (X / 取消) 由 handleClose 走正常 fetch；这里只为关浏览器/刷新场景。
  React.useEffect(() => {
    if (!init || succeededRef.current) return;
    const ticket = init.sessionTicket;
    const onUnload = () => {
      try {
        const url = `/api/me/social-accounts/bind-cancel?ticket=${encodeURIComponent(ticket)}`;
        // sendBeacon 不带 cookie/header 自定义；后端 /api/me/* 走 JWT，会 401。
        // 但 401 也能让 sau-service 那边触发 ticket TTL sweep — 至少 fire 一次。
        navigator.sendBeacon?.(url);
      } catch {
        /* noop */
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [init]);

  const startBind = async () => {
    if (submitting) return;
    if (!accountName.trim()) {
      setErrorMsg("请填写账号别名");
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await SocialAccountApi.initBind({ platform, accountName: accountName.trim() });
      setInit(res);
    } catch (e) {
      // 几类典型错误映射成人话；其他保持原样。
      let friendly: string;
      if (e instanceof ApiError) {
        if (e.code === "SAU_HTTP_ERROR" && /timed out|timeout/i.test(e.message)) {
          friendly =
            "扫码服务响应超时（patchright 首次启动可能慢，请重试一次；若仍失败请检查 sau-service 状态）。";
        } else if (e.code === "PLATFORM_NOT_IMPLEMENTED") {
          friendly = "该平台暂未启用扫码登录，请换一个平台或联系运营。";
        } else if (e.code === "ACCOUNT_ALREADY_ACTIVE") {
          friendly = "该账号别名已被一个有效账号占用，请先解绑或换一个别名。";
        } else if (e.code === "PARSE_ERROR") {
          friendly = `后端响应解析失败：${e.message}`;
        } else {
          friendly = e.message;
        }
      } else {
        friendly = e instanceof Error ? e.message : String(e);
      }
      setErrorMsg(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  // 重新生成 QR：先取消旧 ticket（避免 playwright 残留），再重置本地 state 让用户点「开始扫码」。
  const retry = () => {
    if (init && !succeededRef.current) fireCancel(init.sessionTicket);
    setInit(null);
    setPollStatus("idle");
    setErrorMsg(null);
  };

  // 关闭路径：用户主动关 dialog 时，如果有未完成的 ticket，先杀 playwright + 清 PENDING 行再关。
  const handleClose = React.useCallback(() => {
    if (init && !succeededRef.current) fireCancel(init.sessionTicket);
    onClose();
  }, [init, fireCancel, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-[var(--shadow-soft)]">
        <button
          type="button"
          aria-label="关闭"
          onClick={handleClose}
          className="absolute right-3 top-3 rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold text-zinc-800">绑定社交账号</h2>
        <p className="mt-1 text-xs text-zinc-500">
          只能绑定本人持有的账号；扫码后凭据已加密存储，平台密码全程不接触。
        </p>

        {!init ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1 text-xs text-zinc-600">
              <span>平台</span>
              <Select
                value={platform}
                onValueChange={(v) => setPlatform(v as SocialPlatform)}
                disabled={submitting}
              >
                <SelectTrigger className="h-9 rounded-lg border-zinc-200 bg-white text-sm text-zinc-800 focus:border-[var(--accent)] focus:ring-0 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400">
                  <SelectValue placeholder="选择平台" />
                </SelectTrigger>
                <SelectContent>
                  {ENABLED_PLATFORMS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex flex-col gap-1 text-xs text-zinc-600">
              账号别名
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="例如：公司主号-抖音"
                maxLength={64}
                disabled={submitting}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
              />
            </label>
            {errorMsg && <p className="text-xs text-rose-600">{errorMsg}</p>}
            {submitting && (
              <p className="text-xs text-zinc-500 leading-relaxed">
                正在拉起浏览器抓 QR 码，首次启动通常需要 3-8 秒…
              </p>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className={CTA_SECONDARY}
                onClick={handleClose}
                disabled={submitting}
              >
                取消
              </button>
              <button
                type="button"
                className={cn(CTA_PRIMARY, submitting && "cursor-wait")}
                onClick={startBind}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    获取 QR 中…
                  </>
                ) : (
                  "开始扫码"
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3">
            {init.qrImageDataUrl ? (
              <img
                src={init.qrImageDataUrl}
                alt="扫码登录"
                className="h-48 w-48 rounded-lg border border-zinc-200 bg-white p-2"
                style={{ imageRendering: "pixelated" }}
              />
            ) : init.qrUrl ? (
              <a
                href={init.qrUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-[var(--accent)] underline"
              >
                打开平台 App 完成扫码
              </a>
            ) : (
              <p className="text-sm text-zinc-500">未获得 QR；请重试</p>
            )}
            <p
              className={cn(
                "text-xs",
                pollStatus === "expired" ? "text-amber-600" : "text-zinc-500",
              )}
            >
              {pollStatus === "pending" && "等待扫码……"}
              {pollStatus === "expired" && "扫码已超时，可以重试"}
              {pollStatus === "error" && (errorMsg ?? "网络异常，重试一下")}
            </p>
            <div className="flex gap-2">
              <button type="button" className={CTA_SECONDARY} onClick={handleClose}>
                取消
              </button>
              <button type="button" className={CTA_PRIMARY} onClick={retry}>
                <RefreshCw className="h-3.5 w-3.5" /> 重新生成 QR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
