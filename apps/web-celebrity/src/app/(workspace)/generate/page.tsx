"use client";

// v0.132：「快速生成」→「生成中心」——一级入口聚合三种生成方式 + 进行中任务。
// 背景：此前唯一一级"生成"入口通向 mock 的明星模板链路，而唯一真实出片的
// 脚本带货视频线埋在「素材运营 → 脚本工坊」三级之下。生成中心把真实生产线提为主推：
//   1) 脚本带货视频（真实出片：AI 起稿 → 分镜编辑 → 视频大模型）
//   2) 模板混剪（真实 ffmpeg 渲染）
//   3) 明星形象生成：live 模式为「能力建设中」禁用态（§8.0：不再展示假出片/假价格）；
//      仅 USE_MOCK=1 下可进并带「演示」标。

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, ScrollText, Scissors, Star, Loader2, TriangleAlert, CheckCircle2, Clapperboard } from "lucide-react";
import { USE_MOCK } from "@/api/_client";
import { useGenerationJobs } from "@/lib/use-generation-jobs";

export default function GenerateCenterPage() {
  const router = useRouter();
  const { jobs, runningCount, loaded, sourceErrors } = useGenerationJobs({ pollMs: 6000 });
  const recent = jobs.slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <h1 className="text-xl font-semibold text-zinc-900">生成中心</h1>
        </div>
        <p className="text-sm text-zinc-500">选一种方式开始生成带货短视频；进行中的任务在下方实时汇总。</p>
      </header>

      {/* 三种生成方式 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MethodCard
          icon={<ScrollText className="h-5 w-5" />}
          tone="teal"
          badge="主推 · 真实出片"
          title="脚本带货视频"
          desc="选商品或直接写脚本：AI 起稿 → 分镜编辑 → 视频大模型出片，支持批量派生变体。"
          ctaLabel="去写脚本出片"
          onClick={() => router.push("/material/workshop")}
          secondary={{ label: "从商品库选品开始", href: "/products" }}
        />
        <MethodCard
          icon={<Scissors className="h-5 w-5" />}
          tone="violet"
          title="模板混剪"
          desc="用官方/自建模板 + 素材槽批量混剪出片，自动扰动去重，适合已有实拍素材。"
          ctaLabel="挑选混剪模板"
          onClick={() => router.push("/mixcut/templates")}
          secondary={{ label: "混剪工作台", href: "/mixcut" }}
        />
        {USE_MOCK ? (
          <MethodCard
            icon={<Star className="h-5 w-5" />}
            tone="amber"
            badge="演示"
            title="明星形象生成"
            desc="用已授权明星形象生成带货视频（当前为演示流程，产出为示例内容，不代表真实能力）。"
            ctaLabel="进入演示流程"
            onClick={() => router.push("/generate/star")}
          />
        ) : (
          <MethodCard
            icon={<Star className="h-5 w-5" />}
            tone="zinc"
            badge="能力建设中"
            title="明星形象生成"
            desc="用已授权明星形象直接生成带货视频。真实生成引擎接入中，上线后在此开放。"
            disabled
          />
        )}
      </div>

      {/* 进行中 / 最近任务 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-800">进行中 / 最近任务</h2>
          {runningCount > 0 && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              {runningCount} 个进行中
            </span>
          )}
        </div>
        {sourceErrors.map((msg) => (
          <div key={msg} className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {msg}（列表可能不完整）
          </div>
        ))}
        {!loaded ? (
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> 任务加载中…
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
            还没有生成任务。从上方选一种方式开始你的第一条带货视频。
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {recent.map((j, i) => (
              <Link
                key={`${j.source}-${j.id}`}
                href={j.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-zinc-50 ${i > 0 ? "border-t border-zinc-100" : ""}`}
              >
                {j.status === "running" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" />
                ) : j.status === "failed" ? (
                  <TriangleAlert className="h-4 w-4 shrink-0 text-red-500" />
                ) : j.status === "partial" ? (
                  <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                )}
                <span className="min-w-0 flex-1 truncate text-zinc-800">{j.name}</span>
                <span className="shrink-0 rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500">
                  {j.source === "material" ? "脚本视频" : "混剪"}
                </span>
                <span className={`w-16 shrink-0 text-right text-xs tabular-nums ${j.status === "failed" ? "text-red-500" : j.status === "partial" ? "text-amber-600" : "text-zinc-500"}`}>
                  {j.status === "running"
                    ? (j.progressPct != null ? `${j.progressPct}%` : "生成中")
                    : j.status === "failed" ? "失败" : j.status === "partial" ? "部分失败" : "已完成"}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const TONES: Record<string, { border: string; iconBg: string; icon: string; badge: string }> = {
  teal: { border: "hover:border-emerald-400/60", iconBg: "bg-emerald-50", icon: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  violet: { border: "hover:border-violet-400/60", iconBg: "bg-violet-50", icon: "text-violet-600", badge: "bg-violet-100 text-violet-700" },
  amber: { border: "hover:border-amber-400/60", iconBg: "bg-amber-50", icon: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  zinc: { border: "", iconBg: "bg-zinc-100", icon: "text-zinc-400", badge: "bg-zinc-100 text-zinc-500" },
};

function MethodCard({
  icon,
  tone,
  badge,
  title,
  desc,
  ctaLabel,
  onClick,
  secondary,
  disabled,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  badge?: string;
  title: string;
  desc: string;
  ctaLabel?: string;
  onClick?: () => void;
  secondary?: { label: string; href: string };
  disabled?: boolean;
}) {
  const t = TONES[tone];
  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 transition ${disabled ? "opacity-70" : `hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] ${t.border}`}`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.iconBg} ${t.icon}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-zinc-800">{title}</h3>
            {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${t.badge}`}>{badge}</span>}
          </div>
        </div>
      </div>
      <p className="flex-1 text-xs leading-relaxed text-zinc-600">{desc}</p>
      {disabled ? (
        <div className="inline-flex cursor-not-allowed items-center justify-center gap-1 rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-400">
          <Clapperboard className="h-3.5 w-3.5" /> 敬请期待
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={onClick}
            className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-violet-700"
          >
            {ctaLabel} <ArrowRight className="h-3 w-3" />
          </button>
          {secondary && (
            <Link href={secondary.href} className="text-xs text-zinc-500 hover:text-violet-600">
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
