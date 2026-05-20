"use client";

// 短信验证码输入弹窗。
//
// 触发：PublishJob.status=awaiting_user。父组件 PublishJobList 在该状态出现时
// 自动弹起一次（用户主动关闭后不再自动弹，避免轮询每秒重弹）。
//
// 流程：
//   1. 显示平台 + 手机号尾号 + 提示文案（来自 server interactionRequired）
//   2. 倒计时显示用户剩余可输入时长（基于 createdAt + 5 分钟超时）
//   3. 用户输入 6 位验证码 → 提交 → 调 PublishJobApi.submitPublishJobInteraction
//   4. 提交成功 server 转给 sau-service，弹窗关闭；轮询会看到 status 变化

import * as React from "react";
import { Loader2, X, KeyRound, AlertCircle } from "lucide-react";
import { PublishJobApi } from "@ai-star-eco/api-client";
import type { PublishJob } from "@ai-star-eco/types/publish-job";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

// 与 sau-service SAU_INTERACTION_USER_TIMEOUT_S 对齐 — 必须一致，否则前端倒计时
// 走到 0 时 server 端可能还认 awaiting_user，反之亦然。改一边的时候记得同步。
const USER_INPUT_TIMEOUT_S = 300;

interface Props {
  job: PublishJob;
  onClose: () => void;
  onSubmitted: () => void;
}

export function SmsInteractionDialog({ job, onClose, onSubmitted }: Props) {
  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const interaction = job.interactionRequired;
  const createdAt = interaction?.createdAt;
  const deadlineMs = React.useMemo(() => {
    if (!createdAt) return Date.now() + USER_INPUT_TIMEOUT_S * 1000;
    return new Date(createdAt).getTime() + USER_INPUT_TIMEOUT_S * 1000;
  }, [createdAt]);

  const [remainingS, setRemainingS] = React.useState(() =>
    Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000)),
  );
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingS(Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadlineMs]);

  const handleSubmit = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("请输入验证码");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await PublishJobApi.submitPublishJobInteraction(job.id, { code: trimmed });
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const platformLabel = job.platformName || job.platformId;
  const phoneMasked = interaction?.phoneMasked;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
        <button
          type="button"
          className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600"
          onClick={onClose}
          disabled={submitting}
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-100 p-2 text-amber-700">
            <KeyRound className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">需要输入短信验证码</h3>
            <p className="text-xs text-zinc-500">
              {platformLabel} 平台触发了二次验证，输入收到的验证码后任务自动继续。
            </p>
          </div>
        </div>

        {phoneMasked && (
          <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            短信已发送至 <span className="font-mono text-zinc-800">{phoneMasked}</span>
          </div>
        )}

        {interaction?.prompt && !phoneMasked && (
          <p className="mt-4 text-xs text-zinc-600">{interaction.prompt}</p>
        )}

        <div className="mt-4">
          <label className="text-xs text-zinc-500">验证码</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
            placeholder="6 位数字"
            maxLength={8}
            autoFocus
            disabled={submitting}
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-lg font-mono tracking-widest text-center focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting) {
                void handleSubmit();
              }
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
          <span>
            剩余时间{" "}
            <span className={cn(
              "font-mono",
              remainingS <= 30 ? "text-rose-600 font-semibold" : "text-zinc-700",
            )}>
              {Math.floor(remainingS / 60)}:{String(remainingS % 60).padStart(2, "0")}
            </span>
          </span>
          <span>超时后任务自动失败，请重新派单</span>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className={cn(CTA_SECONDARY, "px-3 py-1.5 text-xs")}
            onClick={onClose}
            disabled={submitting}
          >
            稍后再说
          </button>
          <button
            type="button"
            className={cn(CTA_PRIMARY, "px-4 py-1.5 text-xs")}
            onClick={() => void handleSubmit()}
            disabled={submitting || code.trim().length === 0 || remainingS === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> 提交中
              </>
            ) : (
              "提交验证码"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
