"use client";

// 扫码绑定第三方社交账号的 modal。
//   步骤 1: 选平台 + accountName → POST /me/social-accounts/bind-init
//   步骤 2: 显示 QR + 轮询 /bind-poll；status===success → 关闭并通知父组件
//   步骤 3: 5min 内无扫码 → status===expired → 用户可重试
//
// storage_state 全程不出现在前端代码 —— 这里的所有交互只看 SocialAccount DTO。

import * as React from "react";
import { X, RefreshCw, Loader2 } from "lucide-react";
import { SocialAccountApi } from "@ai-star-eco/api-client";
import type {
  SocialAccount,
  SocialAccountBindInit,
  SocialPlatform,
} from "@ai-star-eco/types/social-account";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

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
}

export function BindAccountDialog({ open, onClose, onBound }: Props) {
  const [platform, setPlatform] = React.useState<SocialPlatform>("douyin");
  const [accountName, setAccountName] = React.useState("");
  const [init, setInit] = React.useState<SocialAccountBindInit | null>(null);
  const [pollStatus, setPollStatus] = React.useState<"idle" | "pending" | "expired" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  // submitting：「开始扫码」按钮按下到 /bind-init 返回的中间态。
  // 没有该 flag 时按钮看起来"没反应"——sau-service 调 playwright 抓 QR 可能耗 3-8s。
  const [submitting, setSubmitting] = React.useState(false);

  // reset all state when modal toggles
  React.useEffect(() => {
    if (!open) {
      setPlatform("douyin");
      setAccountName("");
      setInit(null);
      setPollStatus("idle");
      setErrorMsg(null);
      setSubmitting(false);
    }
  }, [open]);

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
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => {
    setInit(null);
    setPollStatus("idle");
    setErrorMsg(null);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-[var(--shadow-soft)]">
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold text-zinc-800">绑定社交账号</h2>
        <p className="mt-1 text-xs text-zinc-500">
          只能绑定本人持有的账号；扫码后 cookie 加密存储，前端永远不接触明文。
        </p>

        {!init ? (
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-zinc-600">
              平台
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
                disabled={submitting}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
              >
                {ENABLED_PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
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
                onClick={onClose}
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
              <button type="button" className={CTA_SECONDARY} onClick={onClose}>
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
