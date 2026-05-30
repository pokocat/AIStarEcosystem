"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Loader2, Sparkles, X } from "lucide-react";
import type { CelebrityEngine } from "@ai-star-eco/types/celebrity-zone";
import { ENGINE_META } from "@/constants/celebrity-zone-ui";
import { formatCredits } from "@ai-star-eco/api-client/format";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  star: { name: string; avatar: string };
  engine: CelebrityEngine;
  productName: string;
  /** 计费扣除积分（用于 callout 文案） */
  creditPrice: number;
  /** 进度锚点：UTC ms（来自 PendingJobRecord.startedAt 的 Date.parse），保证刷新后仍能续算。 */
  startedAtMs: number;
  /** 估算耗时（秒）；默认按引擎档位推算 */
  estimatedSeconds?: number;
  onComplete: () => void;
}

const STAGES = [
  { key: "queued", label: "准备就绪", hint: "马上就开始…", weight: 0.05 },
  { key: "compose", label: "撰写脚本", hint: "AI 撰写口播脚本中…", weight: 0.2 },
  { key: "synth", label: "合成明星", hint: "对齐明星形象与口型…", weight: 0.4 },
  { key: "render", label: "生成画面", hint: "高清画面生成中…", weight: 0.25 },
  { key: "polish", label: "后期合成", hint: "加字幕、配乐、水印…", weight: 0.1 },
] as const;

/**
 * 生成中悬浮卡：右下角浮窗，**不阻断页面操作**。用户可继续浏览侧栏 / tabs。
 *   - 默认展开为大卡（详细阶段）
 *   - 「最小化」收为右下角胶囊
 *   - 没有"取消生成"按钮：任务已扣积分 + 已发到大模型，业务上不可中断
 */
export function CelebrityGenerationProgress({
  star,
  engine,
  productName,
  creditPrice,
  startedAtMs,
  estimatedSeconds,
  onComplete,
}: Props) {
  const totalMs = (estimatedSeconds ?? defaultSeconds(engine)) * 1000;
  const [progress, setProgress] = React.useState(() =>
    Math.min(1, Math.max(0, (Date.now() - startedAtMs) / totalMs)),
  );
  const [minimized, setMinimized] = React.useState(false);
  const completeFiredRef = React.useRef(false);

  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - startedAtMs;
      const next = Math.min(1, elapsed / totalMs);
      setProgress(next);
      if (next >= 1) {
        if (!completeFiredRef.current) {
          completeFiredRef.current = true;
          window.setTimeout(onComplete, 380);
        }
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [startedAtMs, totalMs, onComplete]);

  const stage = React.useMemo(() => {
    let acc = 0;
    for (let i = 0; i < STAGES.length; i++) {
      acc += STAGES[i].weight;
      if (progress <= acc) return i;
    }
    return STAGES.length - 1;
  }, [progress]);

  const meta = ENGINE_META[engine];
  const pct = Math.round(progress * 100);

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-white/95 px-4 py-2 text-xs text-violet-700 shadow-[var(--shadow-pop)] backdrop-blur transition hover:border-violet-500"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="tabular-nums">{pct}%</span>
        <span className="text-zinc-400">·</span>
        <span className="max-w-[120px] truncate text-zinc-700">{productName || "新视频"}</span>
        <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[95vw] overflow-hidden rounded-2xl border border-violet-400/30 bg-white/95 shadow-[var(--shadow-pop)] backdrop-blur">
      {/* 顶部光效 */}
      <div className="pointer-events-none absolute -top-10 left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />

      <div className="relative p-5">
        {/* 头条 */}
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <span
              className="absolute inset-0 -m-1 rounded-full border-2 border-violet-400/30 border-t-violet-300"
              style={{ animation: "spin 1.6s linear infinite" }}
              aria-hidden
            />
            {star.avatar ? (
              <img
                src={star.avatar}
                alt={star.name}
                className="h-10 w-10 rounded-full border border-violet-400/40 object-cover"
              />
            ) : (
              <span
                aria-label={star.name}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-400/40 bg-zinc-100 text-sm font-semibold text-zinc-500"
              >
                {star.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[10px] text-violet-600">
              <Sparkles className="h-3 w-3" /> AI 视频生成中
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-zinc-800">
              {star.name} · {productName || "新商品"}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              {meta.name} · {meta.level} · 预计 {meta.speed}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            title="最小化（视频会在后台继续生成）"
            className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* 进度条 */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span className="truncate">{STAGES[stage].hint}</span>
            <span className="tabular-nums text-violet-600">{pct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-violet-400 to-violet-300 transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* 阶段步骤 */}
        <ol className="mt-3 grid grid-cols-5 gap-1">
          {STAGES.map((s, i) => {
            const done = i < stage;
            const active = i === stage;
            return (
              <li key={s.key} className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums",
                    done
                      ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-600"
                      : active
                        ? "border-violet-400/60 bg-violet-500/15 text-violet-600"
                        : "border-zinc-200 bg-zinc-50 text-zinc-500",
                  )}
                >
                  {done ? "✓" : active ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-center text-[9px] leading-tight",
                    active ? "text-violet-600" : done ? "text-emerald-600/80" : "text-zinc-500",
                  )}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>

        {/* 不可取消 callout */}
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/[0.06] p-2.5 text-[11px] text-amber-700">
          <X className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
          <div className="leading-relaxed">
            已扣除 <span className="font-semibold text-amber-600">✦{formatCredits(creditPrice)}</span> 积分，{meta.name} 正在为你生成视频。
            <span className="text-amber-700">生成中无法取消</span>，可以先去做别的事，完成后会在顶部「进行中任务」徽章提醒你。
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
          >
            放后台 · 继续浏览
          </button>
        </div>
      </div>
    </div>
  );
}

function defaultSeconds(engine: CelebrityEngine): number {
  switch (engine) {
    case "KeLing":
      return 6;
    case "MiniMax":
      return 10;
    default:
      return 8;
  }
}
