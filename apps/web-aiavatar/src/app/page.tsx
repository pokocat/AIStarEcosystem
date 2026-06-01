"use client";

// 公开 landing —— 精致浅色，克制琥珀。引导登录进入 /library。
import Link from "next/link";
import { ArrowRight, Boxes, Camera, Cuboid, Lock, Sparkles, Wand2 } from "lucide-react";

const FEATURES = [
  { icon: Camera, title: "真人授权复刻", desc: "多图上传 + 人脸合规检测 + 电子肖像授权，InstantID 单图免训练复刻。" },
  { icon: Sparkles, title: "纯 AI 原创", desc: "人设文案大模型解析 + 风格参考，SDXL/FLUX 文生图打样。" },
  { icon: Wand2, title: "几何精调", desc: "MediaPipe + 液化的真实确定性形变：瘦脸 / 眼睛 / 鼻梁 / 脸型 / 嘴型，实时滑块。" },
  { icon: Cuboid, title: "衍生 3D / 视频", desc: "TripoSR 单图重建可旋转 3D；SVD 缓慢运镜短视频，定稿后一键衍生。" },
];

const STEPS = ["打样", "草稿迭代", "精调", "模板美化", "定稿", "衍生", "归档"];

const SHOWCASE = [
  { src: "/samples/real-female.jpeg", name: "星瞳 Luna", tag: "已定稿" },
  { src: "/samples/real-male.jpeg", name: "墨砚", tag: "精调中" },
  { src: "/samples/face-3.svg", name: "Nova", tag: "已归档" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-0)] text-[var(--fg-0)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--brand-ink)] shadow-[var(--shadow-sm)]">
            <Boxes className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">AiAvatar 资产中心</div>
            <div className="num text-[10px] text-[var(--fg-3)]">ASSET HUB</div>
          </div>
        </div>
        <Link href="/login" className="btn btn-primary btn-sm">
          进入工作台 <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-10 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-1)] px-3 py-1 text-xs text-[var(--fg-2)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--brand-strong)]" /> 真人复刻 × AI 原创 · 全链路资产化
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.15] tracking-tight md:text-5xl">
            从一张照片或一句人设，到<span className="text-[var(--brand-strong)]">可定稿、可衍生、可入库</span>的形象资产。
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--fg-2)]">
            7 步标准链路，版本可回溯，真人授权加密存档，异步任务实时进度。能力优先接真实开源方案（几何形变、文生图、人脸合规、图生视频），dev 全 mock 可离线整跑。
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/login" className="btn btn-primary btn-lg">开始创建 <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/login" className="btn btn-ghost btn-lg">查看资产库</Link>
          </div>

          {/* 7 步链路 */}
          <div className="mt-9 flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg-1)] px-2.5 py-1 text-xs text-[var(--fg-1)]">
                  <span className="num text-[var(--brand-strong)]">{i + 1}</span>{s}
                </span>
                {i < STEPS.length - 1 && <span className="text-[var(--fg-3)]">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* 影像优先：展示真实资产卡片 */}
        <div className="grid grid-cols-3 gap-3">
          {SHOWCASE.map((a, i) => (
            <div key={a.name}
              className={`overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-1)] shadow-[var(--shadow-md)] ${i === 1 ? "translate-y-5" : ""}`}>
              <div className="relative aspect-[3/4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.src} alt={a.name} className="h-full w-full object-cover" />
                <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{a.tag}</span>
              </div>
              <div className="px-2.5 py-2 text-xs font-medium text-[var(--fg-1)]">{a.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 transition hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-md)]">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-2)] text-[var(--fg-1)]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-semibold text-[var(--fg-0)]">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--fg-2)]">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-center gap-2 border-t border-[var(--line)] px-6 py-8 text-xs text-[var(--fg-3)]">
        <Lock className="h-3 w-3" /> AI Star Eco · AiAvatar 形象资产管理中心 — 复用统一账户体系，独立部署
      </footer>
    </div>
  );
}
