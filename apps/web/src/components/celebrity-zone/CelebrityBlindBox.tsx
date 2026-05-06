"use client";

import * as React from "react";
import Link from "next/link";
import { Dice5, Pencil, RefreshCcw, Sparkles, Target, Wallet } from "lucide-react";
import { CelebrityVideoPlayer } from "./CelebrityVideoPlayer";
import { CelebrityProductForm } from "./CelebrityProductForm";
import { CelebrityEngineSelect } from "./CelebrityEngineSelect";
import { CREATIVE_TENDENCIES, ENGINE_META } from "@/constants/celebrity-zone-ui";
import { formatCredits } from "@/lib/format";
import { useProducerShell } from "@/lib/producer-shell-context";
import type {
  CelebrityEngine,
  CelebrityProductInput,
  CelebrityProject,
  CelebrityShowcase,
  CelebrityStar,
  CreativeTendency,
} from "@/types/celebrity-zone";
import { cn } from "@/components/ui/utils";

interface Props {
  star: CelebrityStar;
  projects: CelebrityProject[];
  showcases: CelebrityShowcase[];
  onGenerate: (payload: {
    product: CelebrityProductInput;
    engine: CelebrityEngine;
    creativeTendency: CreativeTendency;
    projectId: string;
  }) => void;
}

const FEATURES: Array<{ icon: React.ReactNode; title: string; desc: string }> = [
  {
    icon: <Target className="h-4 w-4 text-purple-300" />,
    title: "AI 选风格",
    desc: "系统根据明星气质和商品属性自动匹配最佳风格",
  },
  {
    icon: <Pencil className="h-4 w-4 text-purple-300" />,
    title: "AI 写脚本",
    desc: "自动生成带货口播文案，融合明星说话特点",
  },
  {
    icon: <Sparkles className="h-4 w-4 text-purple-300" />,
    title: "AI 编排",
    desc: "自动决定镜头切换、节奏和产品展示时机",
  },
  {
    icon: <RefreshCcw className="h-4 w-4 text-purple-300" />,
    title: "不满意可重抽",
    desc: "每次生成结果不同，可多次尝试找到最佳",
  },
];

/** Step 2b：盲盒模式（AI 自主创作）。 */
export function CelebrityBlindBox({ star, projects, showcases, onGenerate }: Props) {
  const [product, setProduct] = React.useState<CelebrityProductInput>({
    name: "",
    link: "",
    sellingPoints: "",
  });
  const [engine, setEngine] = React.useState<CelebrityEngine>("HiGen");
  const [tendency, setTendency] = React.useState<CreativeTendency>("不限制");
  const [projectId, setProjectId] = React.useState<string>(projects[0]?.id ?? "");

  const meta = ENGINE_META[engine];
  const cost = meta.cost;
  const creditPrice = meta.creditPrice;
  const quotaUsed = star.quotaUsed ?? 0;
  const quotaTotal = star.quotaTotal ?? 0;
  const remaining = quotaTotal - quotaUsed;
  const { wallet } = useProducerShell();
  const walletBalance = wallet?.totalBalance ?? 0;
  const insufficientCredits = creditPrice > walletBalance;
  const insufficientQuota = cost > remaining && quotaTotal > 0;
  const cannotGenerate = !product.name.trim() || !projectId || insufficientCredits;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* 左：配置 */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-purple-500/25 bg-gradient-to-br from-purple-500/[0.08] to-pink-500/[0.04] p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-purple-200">
            <Dice5 className="h-4 w-4" /> AI 自主创作模式
          </div>
          <p className="text-[12px] leading-relaxed text-white/55">
            只需提供商品信息，AI 将自主决定脚本创意、拍摄风格、节奏编排。
            每次生成结果不同，可能产出惊喜内容！
          </p>
        </div>

        <CelebrityProductForm
          value={product}
          onChange={setProduct}
          sellingPointsOptional
          title="商品信息（必填）"
        />

        <CelebrityEngineSelect value={engine} onChange={setEngine} compact />

        {/* 创意倾向 */}
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4">
          <div className="mb-2 text-sm font-medium text-white/70">创意倾向（选填）</div>
          <div className="flex flex-wrap gap-2">
            {CREATIVE_TENDENCIES.map((t) => (
              <button
                key={t}
                onClick={() => setTendency(t)}
                className={cn(
                  "rounded-md border px-3 py-1 text-xs transition",
                  tendency === t
                    ? "border-purple-400/60 bg-purple-500/15 text-purple-200"
                    : "border-white/10 text-white/45 hover:border-white/30 hover:text-white/80",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/30">
            仅作为 AI 创作参考，不保证完全遵循
          </p>
        </div>

        {/* 归属项目 */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="mb-2 text-sm font-medium text-white/70">归属项目</div>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-purple-400/60"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#0a0a14]">
                {p.name} · {p.status}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={cannotGenerate}
          onClick={() => onGenerate({ product, engine, creativeTendency: tendency, projectId })}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-purple-400/50 bg-gradient-to-r from-purple-500/40 via-fuchsia-500/30 to-pink-500/30 px-5 py-3 text-base font-semibold text-white shadow-[0_0_30px_rgba(168,85,247,0.35)] transition hover:shadow-[0_0_40px_rgba(168,85,247,0.55)] disabled:cursor-not-allowed disabled:border-white/10 disabled:from-white/10 disabled:via-white/10 disabled:to-white/10 disabled:text-white/30 disabled:shadow-none"
        >
          <Dice5 className="h-4 w-4" /> 开盲盒生成
        </button>
        <div className="flex flex-col gap-1.5 text-[11px]">
          <div className="text-center text-white/45 tabular-nums">
            消耗 <span className="text-purple-200">✦{formatCredits(creditPrice)}</span> 积分
            <span className="text-white/30"> · 占套餐 {cost} 条额度 · 预计 {meta.speed}</span>
          </div>
          {insufficientCredits && (
            <Link
              href="/producer/finance"
              className="inline-flex items-center gap-1 self-center rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-amber-200 hover:border-amber-300"
            >
              <Wallet className="h-3 w-3" /> 积分不足（需 ✦{formatCredits(creditPrice)}）→ 立即充值
            </Link>
          )}
          {!insufficientCredits && insufficientQuota && (
            <span className="self-center text-rose-300">⚠ 套餐额度不足，将使用积分扣费</span>
          )}
        </div>
      </div>

      {/* 右：说明 + 往期作品 */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="mb-3 text-sm font-medium text-white/70">盲盒模式说明</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-3"
              >
                <div className="mt-0.5">{f.icon}</div>
                <div>
                  <div className="text-sm font-semibold text-white/80">{f.title}</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="mb-3 text-sm font-medium text-white/70">盲盒往期作品</div>
          <div className="grid grid-cols-3 gap-3">
            {showcases.map((s) => (
              <div key={s.id}>
                <CelebrityVideoPlayer
                  src={s.videoUrl ?? ""}
                  poster={s.thumb}
                  aspect="9/16"
                />
                <p className="mt-1.5 text-[11px] text-white/45">{s.caption}</p>
                <p className="text-[10px] text-white/30">{s.approval}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
