"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { CelebrityEngine } from "@/types/celebrity-zone";
import { ENGINE_META } from "@/constants/celebrity-zone-ui";
import { cn } from "@/components/ui/utils";

interface Props {
  star: { name: string; avatar: string };
  engine: CelebrityEngine;
  /** 商品名（用于状态文案） */
  productName: string;
  /** 估算耗时（秒）；默认按引擎档位推算 */
  estimatedSeconds?: number;
  onComplete: () => void;
  onCancel: () => void;
}

const STAGES = [
  { key: "queued", label: "提交任务", hint: "正在排队", weight: 0.05 },
  { key: "compose", label: "脚本生成", hint: "AI 撰写口播脚本中…", weight: 0.2 },
  { key: "synth", label: "明星合成", hint: "驱动明星形象与口型对齐…", weight: 0.4 },
  { key: "render", label: "画面渲染", hint: "高清视频渲染中…", weight: 0.25 },
  { key: "polish", label: "后期合成", hint: "添加字幕/配乐/水印…", weight: 0.1 },
] as const;

/** 生成中冻结操作过渡：模拟分阶段进度，到 100% 后回调 onComplete。 */
export function CelebrityGenerationProgress({
  star,
  engine,
  productName,
  estimatedSeconds,
  onComplete,
  onCancel,
}: Props) {
  // 演示用估时：经济 6s / 标准 8s / 高级 10s（每个 stage 等比拆分）
  const totalMs = (estimatedSeconds ?? defaultSeconds(engine)) * 1000;
  const [progress, setProgress] = React.useState(0);
  const startedRef = React.useRef<number>(Date.now());
  const completeFiredRef = React.useRef(false);

  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - startedRef.current;
      const next = Math.min(1, elapsed / totalMs);
      setProgress(next);
      if (next >= 1) {
        if (!completeFiredRef.current) {
          completeFiredRef.current = true;
          // 给最后一个 stage 一点呼吸时间
          window.setTimeout(onComplete, 380);
        }
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMs]);

  // 计算当前 stage
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-xl overflow-hidden rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#0f0f1a] via-[#0c0c18] to-[#0a0a14] p-7 shadow-[0_0_60px_rgba(6,182,212,0.25)]">
        {/* 顶部光效 */}
        <div className="absolute -top-20 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -bottom-24 right-12 h-48 w-72 rounded-full bg-purple-500/15 blur-3xl" />

        <div className="relative flex flex-col items-center gap-5 text-center">
          {/* 头像 + 旋转环 */}
          <div className="relative">
            <span
              className="absolute inset-0 -m-2 rounded-full border-2 border-cyan-400/30 border-t-cyan-300"
              style={{ animation: "spin 1.6s linear infinite" }}
              aria-hidden
            />
            <img
              src={star.avatar}
              alt={star.name}
              className="h-16 w-16 rounded-full border border-cyan-400/40 object-cover"
            />
          </div>

          <div>
            <div className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200">
              <Sparkles className="h-3 w-3" /> AI 视频生成中
            </div>
            <h3 className="mt-3 text-lg font-semibold text-white/95">
              {star.name} · {productName || "新商品"}
            </h3>
            <p className="mt-1 text-xs text-white/45">
              引擎：{meta.name} · {meta.level} · 预计 {meta.speed}
            </p>
          </div>

          {/* 进度条 */}
          <div className="w-full">
            <div className="flex items-center justify-between text-[11px] text-white/45">
              <span>{STAGES[stage].hint}</span>
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
          <ol className="grid w-full grid-cols-5 gap-1.5">
            {STAGES.map((s, i) => {
              const done = i < stage;
              const active = i === stage;
              return (
                <li key={s.key} className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums",
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
                      "text-[10px]",
                      active ? "text-cyan-200" : done ? "text-emerald-200/70" : "text-white/35",
                    )}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="flex items-center gap-3 text-[11px] text-white/35">
            <span>该过程不可中断；关闭弹窗将放弃当前生成任务</span>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-white/50 transition hover:border-rose-400/30 hover:text-rose-200"
          >
            取消生成
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
