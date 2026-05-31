"use client";

// 公开 landing —— 深色琥珀，自托管视觉。引导登录进入 /library。
import Link from "next/link";
import { ArrowRight, Boxes, Camera, Cuboid, Sparkles, Wand2 } from "lucide-react";

const FEATURES = [
  { icon: Camera, title: "真人授权复刻", desc: "多图上传 + 人脸合规检测 + 电子肖像授权，InstantID 单图免训练复刻。" },
  { icon: Sparkles, title: "纯 AI 原创", desc: "人设文案大模型解析 + 风格参考，SDXL/FLUX 文生图打样。" },
  { icon: Wand2, title: "几何精调", desc: "MediaPipe + 液化的真实确定性形变：瘦脸 / 眼睛 / 鼻梁 / 脸型 / 嘴型，实时滑块。" },
  { icon: Cuboid, title: "衍生 3D / 视频", desc: "TripoSR 单图重建可旋转 3D；SVD 缓慢运镜短视频，定稿后一键衍生。" },
];

const STEPS = ["打样", "草稿迭代", "精细化精调", "模板美化出图", "定稿", "衍生 3D/视频", "入库归档"];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-0)] text-[var(--fg-0)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950">
            <Boxes className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="font-semibold">AiAvatar 形象资产管理中心</div>
            <div className="font-mono text-[10px] text-zinc-500">AIAVATAR ASSET HUB</div>
          </div>
        </div>
        <Link href="/login" className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
          进入工作台 <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-12 pb-8">
        <div className="ph absolute" aria-hidden style={{ display: "none" }} />
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-xs text-amber-400">
          <Sparkles className="h-3.5 w-3.5" /> 真人复刻 × AI 原创 · 全链路资产化
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
          从一张照片或一句人设，<br />
          到<span className="text-amber-400">可定稿、可衍生、可入库</span>的AiAvatar形象资产。
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-400">
          7 步标准链路 · 版本可回溯 · 真人授权加密存档 · 异步任务实时进度。能力优先接真实开源方案（几何形变、文生图、人脸合规、图生视频），dev 全 mock 可离线整跑。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/login" className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
            开始创建 <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-200 hover:border-zinc-500">
            查看资产总库
          </Link>
        </div>

        {/* 7 步链路 */}
        <div className="mt-10 flex flex-wrap items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                <span className="mr-1.5 font-mono text-amber-400">{i + 1}</span>{s}
              </span>
              {i < STEPS.length - 1 && <span className="text-zinc-700">→</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="rounded-xl border border-zinc-800 bg-[var(--bg-1)] p-5">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-zinc-400">{f.desc}</p>
            </div>
          );
        })}
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-xs text-zinc-600">
        AI Star Eco · AiAvatar 形象资产管理中心 — 复用统一账户体系，独立部署（port 3013）
      </footer>
    </div>
  );
}
