"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Loader2, Sparkles, X } from "lucide-react";
import type { CelebrityEngine } from "@/types/celebrity-zone";
import { ENGINE_META } from "@/constants/celebrity-zone-ui";
import { formatCredits } from "@/lib/format";
import { cn } from "@/components/ui/utils";

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
  { key: "queued", label: "提交任务", hint: "正在排队", weight: 0.05 },
  { key: "compose", label: "脚本生成", hint: "AI 撰写口播脚本中…", weight: 0.2 },
  { key: "synth", label: "明星合成", hint: "驱动明星形象与口型对齐…", weight: 0.4 },
  { key: "render", label: "画面渲染", hint: "高清视频渲染中…", weight: 0.25 },
  { key: "polish", label: "后期合成", hint: "添加字幕/配乐/水印…", weight: 0.1 },
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
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-[#0d0d18]/95 px-4 py-2 text-xs text-cyan-200 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur transition hover:border-cyan-300"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="tabular-nums">{pct}%</span>
        <span className="text-white/60">·</span>
        <span className="max-w-[120px] truncate text-white/75">{productName || "新视频"}</span>
        <ChevronUp className="h-3.5 w-3.5 text-white/45" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#0d0d18]/95 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur">
      {/* 顶部光效 */}
      <div className="pointer-events-none absolute -top-10 left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-cyan-500/15 blur-3xl" />

      <div className="relative p-5">
        {/* 头条 */}
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <span
              className="absolute inset-0 -m-1 rounded-full border-2 border-cyan-400/30 border-t-cyan-300"
              style={{ animation: "spin 1.6s linear infinite" }}
              aria-hidden
            />
            <img
              src={star.avatar}
              alt={star.name}
              className="h-10 w-10 rounded-full border border-cyan-400/40 object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[10px] text-cyan-200">
              <Sparkles className="h-3 w-3" /> AI 视频生成中
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-white/90">
              {star.name} · {productName || "新商品"}
            </div>
            <div className="mt-0.5 text-[10px] text-white/45">
              {meta.name} · {meta.level} · 预计 {meta.speed}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            title="最小化（任务后台继续运行）"
            className="rounded-md p-1 text-white/40 transition hover:bg-white/[0.05] hover:text-white/70"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* 进度条 */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-white/45">
            <span className="truncate">{STAGES[stage].hint}</span>
            <span className="tabular-nums text-cyan-200">{pct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-purple-500 transition-[width] duration-150"
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
                      ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                      : active
                        ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
                        : "border-white/10 bg-white/[0.03] text-white/35",
                  )}
                >
                  {done ? "✓" : active ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-center text-[9px] leading-tight",
                    active ? "text-cyan-200" : done ? "text-emerald-200/70" : "text-white/35",
                  )}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>

        {/* 不可取消 callout */}
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/[0.06] p-2.5 text-[11px] text-amber-100/85">
          <X className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
          <div className="leading-relaxed">
            已扣除 <span className="font-semibold text-amber-200">✦{formatCredits(creditPrice)}</span> 积分，请求已发到{meta.name}队列。
            <span className="text-amber-300/90">异步执行不可中途取消</span>，可继续浏览其他页面，完成后会在顶部「我的进行中任务」徽章提醒。
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/65 transition hover:border-white/30 hover:text-white"
          >
            后台运行 · 继续浏览
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
