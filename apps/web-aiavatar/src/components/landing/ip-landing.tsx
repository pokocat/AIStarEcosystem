"use client";

// 公开 landing —— 域名根目录（v0.191 从 web-ipstudio 取回，随并入一起搬来）。
//
// ⚠️ 品牌用**本 app 的**（AIAVATAR · 数字资产平台），不是原来的 IP STUDIO ——
// 页面是搬过来的，但它现在是 aiavatar.aibuzz.cn 的门面。字标写着另一个产品名
// 会让第一次来的人以为走错了地方。工作台是这个平台的一项能力，不是另一个产品，
// 所以副标写成「数字资产平台 · AI IP 工作台」。内容与视觉一个字没改。
//
// 整棵树套 `.ip-surface`：它用的是工作台那套令牌（--paper / --blue-700 / --action /
// --on-blue…），其中 52 个在 aiavatar 的 :root 里根本没有定义，不套作用域会直接
// 解析成空值（背景整条声明失效 → 白板）。
//
// 视觉：低饱和群青底 + 麦黄大标题 + 麦黄纸标签 + 墨色正文（真源 design.md）。
// 图：全部来自同一张 4×3 等格图集（生产真源在 OSS，地址见 components/landing/atlas.tsx），
//     经 AtlasFrame / AtlasPortrait 裁切；没有一张是 SVG / 色块伪造的「示意图」。
// 文案：只有产品定稿的那几句。**不讲工作流、不讲上传照片、不讲模型**（评审明确要求删除），
//     场景区是未来方向，必须显式标注「以下为场景示意，相关能力将分阶段推出」。

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { AtlasFrame, AtlasPortrait, type AtlasFrameKey } from "@/components/landing/atlas";
import { auth, USE_MOCK } from "@/proto/api";

const EMOTIONS: { frame: AtlasFrameKey; label: string; highlight?: boolean }[] = [
  { frame: "smile", label: "微笑" },
  { frame: "laugh", label: "放声笑", highlight: true },
  { frame: "surprised", label: "出乎意料" },
  { frame: "serious", label: "认真想" },
];

const SCENES: { no: string; frame: AtlasFrameKey; title: string; desc: string }[] = [
  { no: "01", frame: "card", title: "个人商务名片", desc: "让客户记住你的样子，也记住你做什么。" },
  { no: "02", frame: "drama", title: "AI 短剧", desc: "让你的角色走进故事，拥有自己的观众。" },
  { no: "03", frame: "goods", title: "带货视频", desc: "让产品有个熟悉的讲述者，让品牌更容易被记住。" },
  { no: "04", frame: "brand", title: "品牌合作", desc: "联名、代言、形象授权，让角色成为合作的起点。" },
];

/**
 * 竖幅纸卡：纸白托底 + 竖幅作品图，标签**定位在这张卡自己身上**
 * （所以不会像上一版那样挂在 grid 单元格底部悬空）。
 */
function PaperShot({
  frame,
  className = "",
  ratio,
  tags = [],
}: {
  frame: AtlasFrameKey;
  className?: string;
  ratio?: string;
  tags?: { text: string; place: string }[];
}) {
  return (
    // 外层不加 position —— 桌面端由 .hero-collage > * 绝对定位接管（app.css）
    <div className={className}>
      <div
        className="relative p-2 sm:p-2.5 rounded-[10px]"
        style={{ background: "var(--paper)", boxShadow: "var(--shadow-paper)" }}
      >
        <AtlasPortrait frame={frame} ratio={ratio} className="rounded-[6px] w-full" />
        {tags.map((t) => (
          <span key={t.text} className={`paper-tag absolute ${t.place}`}>
            {t.text}
          </span>
        ))}
      </div>
    </div>
  );
}

export function IpLanding() {
  // 登录态在挂载后才知道（与 app/page.tsx 同一套判定）。初值按访客，
  // 避免 SSR 输出「进入工作台」再跳回「登录」。
  const [authed, setAuthed] = React.useState(false);
  React.useEffect(() => { setAuthed(USE_MOCK || auth.isAuthed()); }, []);
  // 已登录进个人主页（v0.191 起 dashboard 才是「主页」，根目录是这张落地页）
  // 未登录带上 next：不带的话登录完会回到这张宣传页（默认落点虽已改成
  // /dashboard，但显式写出来更不容易在后续改动里被弄丢）。
  const entry = authed ? "/dashboard" : "/login?next=%2Fdashboard";

  return (
    <div className="ip-surface min-h-dvh overflow-x-hidden" style={{ background: "var(--paper)" }}>
      {/* ── 顶栏 ─────────────────────────────────────────────────────────── */}
      <header
        className="on-blue sticky top-0 z-40"
        style={{ background: "var(--blue-700)", borderBottom: "1px solid var(--on-blue-line)" }}
      >
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 h-[60px] flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 min-w-0" aria-label="数字资产平台 首页">
            <span
              className="text-[15px] font-extrabold tracking-[0.14em] shrink-0"
              style={{ color: "var(--action)" }}
            >
              AIAVATAR
            </span>
            <span aria-hidden className="hidden sm:block w-px h-4 shrink-0" style={{ background: "var(--on-blue-line)" }} />
            <span className="hidden sm:block text-[13px] truncate" style={{ color: "var(--paper)" }}>
              数字资产平台 · AI IP 工作台
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0" aria-label="页面导航">
            <a
              href="#gallery"
              className="hidden sm:inline-flex items-center px-3 h-9 rounded-lg text-[13.5px] font-semibold transition hover:bg-[var(--on-blue-hover)]"
              style={{ color: "var(--paper)" }}
            >
              灵感画廊
            </a>
            <a
              href="#about"
              className="hidden sm:inline-flex items-center px-3 h-9 rounded-lg text-[13.5px] font-semibold transition hover:bg-[var(--on-blue-hover)]"
              style={{ color: "var(--paper)" }}
            >
              关于工作台
            </a>
            <Link
              href={entry}
              className="inline-flex items-center gap-1 px-4 h-9 rounded-lg text-[13.5px] font-bold transition hover:brightness-95"
              style={{ background: "var(--action)", color: "var(--on-action)" }}
            >
              {authed ? "进入工作台" : "登录 / 注册"}
            </Link>
          </nav>
        </div>
      </header>

      {/* ── 英雄区 ───────────────────────────────────────────────────────── */}
      <section className="on-blue relative overflow-hidden" style={{ background: "var(--blue-700)" }}>
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24"
          style={{
            background: "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--blue-900) 55%, transparent))",
          }}
        />
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8 pt-8 pb-12 lg:pt-10 lg:pb-14 grid gap-10 lg:gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="min-w-0">
            <span className="paper-tag">你的个性，自有角色。</span>

            {/* 三行大标题（approved.png）：桌面 clamp 到 104px，窄屏保底 64px */}
            <h1
              className="mt-6 font-extrabold tracking-[-0.02em]"
              style={{ color: "var(--action)", fontSize: "clamp(64px, 6.5vw, 104px)", lineHeight: 1.06 }}
            >
              一个你，
              <br />
              不止一种
              <br />
              想象。
            </h1>

            <p className="mt-7 text-[15px] sm:text-[16px] leading-[1.9]" style={{ color: "var(--paper)" }}>
              日常里的你，脑海里的你，还没登场的你。
              <br />
              在这里，让每一种个性都有自己的角色。
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-5">
              <Link
                href={entry}
                className="inline-flex items-center gap-2 px-7 h-12 rounded-xl text-[15.5px] font-bold transition hover:brightness-95"
                style={{ background: "var(--action)", color: "var(--on-action)", boxShadow: "var(--shadow-lift)" }}
              >
                创作我的 IP
                <ArrowUpRight className="w-4 h-4" aria-hidden />
              </Link>
              <a
                href="#gallery"
                className="inline-flex items-center gap-1.5 px-3 h-12 rounded-xl text-[14.5px] font-semibold transition hover:bg-[var(--on-blue-hover)]"
                style={{ color: "var(--paper)" }}
              >
                逛逛灵感画廊
                <ArrowDown className="w-4 h-4" aria-hidden />
              </a>
            </div>
          </div>

          {/* 一张大竖主卡 + 两张小竖侧卡，桌面端重叠错落；布局在 app.css 的 .hero-collage */}
          <div className="hero-collage min-w-0">
            <PaperShot
              frame="mainLook"
              ratio="3 / 4.4"
              className="shot-main tilt-a"
              tags={[
                { text: "创作示例", place: "-top-3.5 left-4" },
                { text: "随性出场", place: "-bottom-3.5 left-3" },
              ]}
            />
            <PaperShot
              frame="outdoor"
              ratio="3 / 4"
              className="shot-side-a tilt-b"
              tags={[{ text: "去野一下", place: "-top-3.5 right-2" }]}
            />
            <PaperShot
              frame="suit"
              ratio="3 / 4"
              className="shot-side-b tilt-c"
              tags={[{ text: "自有风格", place: "-bottom-3.5 right-2" }]}
            />
          </div>
        </div>
      </section>

      {/* ── 表情：灵感画廊 ───────────────────────────────────────────────── */}
      <section id="gallery" className="scroll-mt-20" style={{ background: "var(--paper)" }}>
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 py-14 sm:py-20 grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] lg:items-center">
          <div className="min-w-0">
            <h2
              className="font-extrabold leading-[1.25] text-[30px] sm:text-[38px]"
              style={{ color: "var(--ink)" }}
            >
              今天，
              <br />
              想做哪一种你？
            </h2>
            <p className="mt-4 text-[15px] leading-[1.9]" style={{ color: "var(--ink-2)" }}>
              放声笑，认真想，偶尔也出乎意料。
            </p>
          </div>

          <ul className="min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 list-none p-0 m-0">
            {EMOTIONS.map((e) => (
              <li key={e.label} className="min-w-0">
                <div
                  className="p-1.5 rounded-[10px]"
                  style={{
                    background: e.highlight ? "var(--action)" : "var(--surface)",
                    border: `1px solid ${e.highlight ? "var(--action-line)" : "var(--line-2)"}`,
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  <AtlasFrame frame={e.frame} className="rounded-[6px] w-full" />
                </div>
                <p
                  className="mt-2 text-[13px] font-semibold text-center truncate"
                  style={{ color: "var(--ink-2)" }}
                  title={e.label}
                >
                  {e.label}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 未来应用方向 ─────────────────────────────────────────────────── */}
      <section id="scenes" className="scroll-mt-20" style={{ background: "var(--paper-2)" }}>
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 py-14 sm:py-20">
          <span className="paper-tag">未来应用方向</span>
          <h2
            className="mt-5 text-center font-extrabold leading-[1.3] text-[28px] sm:text-[38px]"
            style={{ color: "var(--ink)" }}
          >
            你的 IP，还能走进这些地方。
          </h2>
          <p className="mt-3 text-center text-[14.5px] leading-[1.9]" style={{ color: "var(--ink-2)" }}>
            以下为场景示意，相关能力将分阶段推出。
          </p>

          {/* 2×2（approved.png）；宽容器下限住栅格宽度，免得 1:1 的图被拉成巨幅 */}
          <ul className="mt-9 mx-auto max-w-[1040px] grid gap-5 sm:gap-6 sm:grid-cols-2 list-none p-0 m-0">
            {SCENES.map((s) => (
              <li
                key={s.no}
                className="min-w-0 overflow-hidden"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line-2)",
                  borderRadius: "var(--r-lg)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <AtlasFrame frame={s.frame} className="w-full" />
                <div className="p-4 sm:p-5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="shrink-0 px-1.5 py-0.5 rounded text-[11px] font-bold tabular"
                      style={{ background: "var(--action-soft)", color: "var(--action-700)" }}
                    >
                      {s.no}
                    </span>
                    <h3 className="text-[17px] font-bold truncate" style={{ color: "var(--ink)" }} title={s.title}>
                      {s.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-[14px] leading-[1.8]" style={{ color: "var(--ink-2)" }}>
                    {s.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* 商业化展望横幅 —— 顶栏「关于工作台」的锚点落在这里（不另起文案段） */}
          <div
            id="about"
            className="mt-10 sm:mt-12 scroll-mt-20 px-5 sm:px-10 py-9 sm:py-11"
            style={{
              background: "var(--action)",
              border: "1px solid var(--action-line)",
              borderRadius: "var(--r-xl)",
            }}
          >
            <span className="paper-tag paper-tag-light">商业化展望</span>
            <h2
              className="mt-4 font-extrabold leading-[1.3] text-[28px] sm:text-[42px]"
              style={{ color: "var(--ink)" }}
            >
              从被记住，到被选择。
            </h2>
            <p className="mt-3 text-[14.5px] sm:text-[16px] leading-[1.9] max-w-2xl" style={{ color: "var(--ink)" }}>
              围绕你的 IP，探索内容创作、商品推广与形象授权的合作机会。
            </p>
          </div>
        </div>
      </section>

      {/* ── 收尾 CTA ─────────────────────────────────────────────────────── */}
      <section className="on-blue" style={{ background: "var(--blue-800)" }}>
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 py-14 sm:py-16 flex justify-center">
          <Link
            href={entry}
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-[17px] font-bold transition hover:brightness-95"
            style={{ background: "var(--action)", color: "var(--on-action)", boxShadow: "var(--shadow-lift)" }}
          >
            创作我的 IP
            <ArrowUpRight className="w-4.5 h-4.5" aria-hidden style={{ width: 18, height: 18 }} />
          </Link>
        </div>
      </section>

      <footer className="on-blue" style={{ background: "var(--blue-900)" }}>
        <div
          className="mx-auto max-w-[1440px] px-5 sm:px-8 py-6 text-center text-[12px] tracking-[0.12em]"
          style={{ color: "var(--paper)" }}
        >
          AIAVATAR 数字资产平台 · AI IP 工作台
        </div>
      </footer>
    </div>
  );
}
