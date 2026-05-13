"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AppearanceGallery.tsx — 艺人详情页 AI 形象画廊（只读）。
//
// - 左：当前选中形象的大图 + 提示词 + 状态 / 模式 / 使用次数 / 上架信息。
// - 右：同一艺人的其它形象缩略图矩阵；点击切换左侧大图（纯本地预览，不会写库）。
// - Header 右侧："前往 AI 形象锻造炉"按钮 —— 生成 / 删除 / 设为官方形象 / 上架均在该页完成。
//
// 数据来源：ApparanceForgeApi.listForgeHistory(artistId)，mock 下由 MOCK_APPEARANCES 回落。
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Sparkles, Wand2, Lock, Tag as TagIcon, Image as ImageIcon, ArrowRight,
  Play, Pause, RotateCcw, Box,
} from "lucide-react";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import type { Artist } from "@ai-star-eco/types/artist";
import type { ForgeMode, ForgeResult, AppearanceStatus } from "@ai-star-eco/types/appearance-forge";
import { AppearanceForgeApi } from "@/api";
import { DEMO_FORGE_VIDEO_POOL } from "@/lib/forge-video";
import { formatCredits, formatCompactNumber } from "@/lib/format";

interface Props {
  artist: Artist;
  /** 点击"前往锻造炉"时触发；父组件决定路由。 */
  onGoToForge: () => void;
  /**
   * 'full'（默认）：含左侧 BioColumn（艺人简介 + 当前形象元数据）+ 右侧 3D hero + 底部缩略条。
   * 'compact'：隐藏 BioColumn，hero 占满主区；用于宿主页面已自带身份/简介的场景（如艺人视图双列布局）。
   */
  variant?: "full" | "compact";
}

const MODE_LABEL: Record<ForgeMode, string> = {
  template_photo: "模版 + 照片",
  prompt_only: "文本指令",
  template_prompt: "模版 + 文本",
  random: "随机",
};

const STATUS_META: Record<AppearanceStatus, { label: string; cls: string }> = {
  draft:    { label: "草稿",   cls: "bg-gray-500/15 text-gray-300 border-gray-500/25" },
  official: { label: "官方形象", cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  listed:   { label: "已上架",  cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  sold:     { label: "已售出",  cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AppearanceGallery({ artist, onGoToForge, variant = "full" }: Props) {
  const compact = variant === "compact";
  const [items, setItems] = useState<ForgeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    AppearanceForgeApi.listForgeHistory(artist.id)
      .then(list => {
        if (cancelled) return;
        setItems(list);
        // 默认选中官方形象；否则选 artist.officialAppearanceId；否则选第一个。
        const official = list.find(a => a.status === "official");
        setSelectedId(official?.id ?? artist.officialAppearanceId ?? list[0]?.id ?? null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [artist.id, artist.officialAppearanceId]);

  const selected = useMemo(
    () => items.find(a => a.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const counts = useMemo(() => {
    const by: Record<AppearanceStatus, number> = { draft: 0, official: 0, listed: 0, sold: 0 };
    for (const a of items) if (a.status) by[a.status]++;
    return by;
  }, [items]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-gray-900/70 via-gray-900/50 to-gray-900/70"
    >
      {/* 顶栏 */}
      <div className="flex items-start md:items-center justify-between gap-3 p-5 border-b border-white/5 flex-col md:flex-row">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              AI 形象画廊
            </h2>
            <p className="text-[11px] text-gray-500 font-light">
              共 {items.length} 张 · 官方 {counts.official} · 草稿 {counts.draft} · 已上架 {counts.listed} · 已售出 {counts.sold}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-gray-500 font-light hidden md:inline">此视图为只读</span>
          <Button onClick={onGoToForge} size="sm"
            className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white shadow-lg shadow-cyan-500/20">
            <Wand2 className="w-3.5 h-3.5 mr-1.5" />
            前往 AI 形象锻造炉
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </div>

      {/* 主体 */}
      {loading ? (
        <GallerySkeleton />
      ) : items.length === 0 ? (
        <EmptyState onGoToForge={onGoToForge} />
      ) : (
        <div className="p-5 space-y-4">
          {/* 上：艺人简介（左 2/5） + 形象主视频（右 3/5）；compact 模式隐藏 BioColumn */}
          {compact ? (
            selected ? <HeroCard appearance={selected} /> : null
          ) : (
            <div className="grid lg:grid-cols-5 gap-5">
              <div className="lg:col-span-2">
                <BioColumn artist={artist} appearance={selected} onGoToForge={onGoToForge} />
              </div>
              <div className="lg:col-span-3">
                {selected ? <HeroCard appearance={selected} /> : null}
              </div>
            </div>
          )}

          {/* 下：历史形象缩小展示 —— 横向 strip，可溢出滚动 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-gray-500 font-light">历史形象（{items.length}）</div>
              <div className="text-[11px] text-gray-500 font-light hidden md:block">
                点击切换预览 · 生成 / 删除 / 上架请前往锻造炉
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1
              [&::-webkit-scrollbar]:h-1
              [&::-webkit-scrollbar-thumb]:bg-white/10
              [&::-webkit-scrollbar-thumb]:rounded-full">
              {items.map(a => (
                <ThumbCard
                  key={a.id}
                  appearance={a}
                  active={a.id === selected?.id}
                  onSelect={() => setSelectedId(a.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
}

// ── Bio column（左列：艺人简介 + 当前形象元数据 + 跳转锻造炉） ─────────────────
function BioColumn({
  artist,
  appearance,
  onGoToForge,
}: {
  artist: Artist;
  appearance: ForgeResult | null;
  onGoToForge: () => void;
}) {
  const meta = appearance ? STATUS_META[appearance.status ?? "draft"] : null;
  return (
    <div className="h-full bg-black/30 border border-white/10 rounded-xl p-5 flex flex-col gap-4">
      <div>
        <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">艺人简介</div>
        <p className="text-sm text-gray-200 leading-relaxed">{artist.bio || "该艺人尚未填写简介。"}</p>
      </div>

      {artist.domains?.length ? (
        <div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">主营领域</div>
          <div className="flex flex-wrap gap-1.5">
            {artist.domains.map(d => (
              <Badge key={d} className="text-[10px] bg-white/[0.06] text-gray-200 border-0">{d}</Badge>
            ))}
          </div>
        </div>
      ) : null}

      {appearance && meta && (
        <div className="mt-auto pt-4 border-t border-white/5 space-y-2.5">
          <div className="text-[11px] text-gray-500 uppercase tracking-wider">当前展示形象</div>
          <p className="text-sm text-gray-200 leading-relaxed line-clamp-3">{appearance.prompt}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${meta.cls} text-[10px] border`}>{meta.label}</Badge>
            <Badge className="bg-black/40 text-gray-200 border-white/10 text-[10px] border">
              {MODE_LABEL[appearance.mode]}
            </Badge>
            {(appearance.usageCount ?? 0) > 0 && (
              <span className="text-[10px] text-cyan-300">已使用 {appearance.usageCount} 次</span>
            )}
            {appearance.locked.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                <Lock className="w-3 h-3" />锁定 {appearance.locked.length}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-500">
            <span>{fmtDate(appearance.createdAt)}</span>
            {appearance.marketplace && (
              <span className="inline-flex items-center gap-1 text-amber-300">
                <TagIcon className="w-3 h-3" />
                <span className="font-semibold tabular-nums">{formatCredits(appearance.marketplace.price)}</span>
                <span className="text-gray-500">· 售 {formatCompactNumber(appearance.marketplace.soldCount)}</span>
              </span>
            )}
          </div>
          <Button
            onClick={onGoToForge}
            variant="ghost"
            size="sm"
            className="w-full justify-between text-cyan-300 hover:bg-cyan-500/10 text-xs mt-2"
          >
            <span className="inline-flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5" /> 去锻造新形象</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Hero card —— 形象主体 = 短视频 + 3D tilt。 ────────────────────────────────
// 视频为共享静态资源：`/static/videos/showreel-0X.mp4`，按 appearance.id 哈希落位。
// prompt / 状态 / 日期 / 锁定信息已上移到 BioColumn，避免重复。
// 后端 ForgeResult.videoUrl（或 model3dUrl）上线后，在 Frame3D 内替换 src 即可。
function HeroCard({ appearance }: { appearance: ForgeResult }) {
  const status = appearance.status ?? "draft";
  const meta = STATUS_META[status];
  return (
    <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden h-full">
      <Frame3D appearance={appearance} statusMeta={meta} />
    </div>
  );
}

// 视频资产源：优先使用保存后由后端（或 mock save 层）写入的 `appearance.videoUrl`。
// 未保存形象（草稿 / 历史种子数据没有视频）走哈希回退池，确保预览总有画面。
// 接入真实 AI 后，所有已保存形象都应具备 videoUrl，该回退仅为 demo 期兜底。
function pickVideoFor(appearance: ForgeResult): string {
  if (appearance.videoUrl) return appearance.videoUrl;
  const id = appearance.id;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return DEMO_FORGE_VIDEO_POOL[Math.abs(h) % DEMO_FORGE_VIDEO_POOL.length];
}

// ── 3D preview frame ─────────────────────────────────────────────────────────
function Frame3D({ appearance, statusMeta }: { appearance: ForgeResult; statusMeta: { label: string; cls: string } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const gizmoRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);

  // 切换形象时重置变换并停止播放。
  useEffect(() => {
    setPlaying(false);
    applyTransform(cardRef.current, glareRef.current, gizmoRef.current, 0, 0);
  }, [appearance.id]);

  // 自动"悬浮摇摆"。
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const rotY = Math.sin(t * 0.9) * 30;
      const rotX = Math.sin(t * 0.55) * 6;
      applyTransform(cardRef.current, glareRef.current, gizmoRef.current, rotX, rotY);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing]);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (playing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;   // 0..1
    const ny = (e.clientY - rect.top) / rect.height;   // 0..1
    const rotY = (nx - 0.5) * 36;   // ±18°
    const rotX = (0.5 - ny) * 36;   // ±18°
    applyTransform(cardRef.current, glareRef.current, gizmoRef.current, rotX, rotY);
  };

  const handleLeave = () => {
    if (playing) return;
    applyTransform(cardRef.current, glareRef.current, gizmoRef.current, 0, 0);
  };

  const handleReset = () => {
    setPlaying(false);
    applyTransform(cardRef.current, glareRef.current, gizmoRef.current, 0, 0);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="relative aspect-[3/4] bg-gradient-to-br from-black/50 via-black/40 to-black/60 select-none"
      style={{ perspective: "1400px" }}
    >
      {/* 网格背板（远景参考系，强化 3D 舱感） */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(6,182,212,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(6,182,212,0.15) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(circle at center, black 45%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 45%, transparent 75%)",
        }}
      />

      {/* 3D 主体（只作倾斜；真模型上线后替换此块） */}
      <div
        ref={cardRef}
        className="absolute inset-0 will-change-transform"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 120ms ease-out",
        }}
      >
        <video
          key={appearance.id}
          src={pickVideoFor(appearance)}
          poster={appearance.image}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          draggable={false}
          className="w-full h-full object-cover pointer-events-none bg-black"
          style={{ transform: "translateZ(40px)" }}
        />
        {/* 光泽扫过 — 跟随倾斜 */}
        <div
          ref={glareRef}
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-screen opacity-60"
          style={{
            background:
              "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)",
            transform: "translateZ(60px)",
            transition: "background-position 120ms ease-out",
            backgroundSize: "200% 200%",
            backgroundPosition: "50% 50%",
          }}
        />
      </div>

      {/* 顶栏：状态 / 模式 / 3D 徽章 */}
      <div className="absolute top-3 left-3 flex gap-2 z-10">
        <Badge className={`${statusMeta.cls} text-[10px] border`}>{statusMeta.label}</Badge>
        <Badge className="bg-black/50 text-gray-200 border-white/10 text-[10px] border">
          {MODE_LABEL[appearance.mode]}
        </Badge>
        <Badge className="bg-cyan-500/15 text-cyan-200 border-cyan-400/30 text-[10px] border inline-flex items-center gap-1">
          <Box className="w-3 h-3" /> 3D
        </Badge>
      </div>

      {(appearance.usageCount ?? 0) > 0 && (
        <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-cyan-200">
          已使用 {appearance.usageCount}
        </div>
      )}

      {/* 轴向 gizmo — 模拟 3D viewport */}
      <div
        ref={gizmoRef}
        className="absolute bottom-14 right-3 w-10 h-10 pointer-events-none z-10"
        style={{ perspective: "300px" }}
      >
        <div className="relative w-full h-full" style={{ transformStyle: "preserve-3d", transition: "transform 120ms ease-out" }}>
          <span className="absolute top-1/2 left-1/2 w-px h-5 -translate-x-1/2 -translate-y-1/2 bg-green-400/80"
            style={{ transform: "rotateZ(0deg) translateY(-50%)", transformOrigin: "bottom center" }} />
          <span className="absolute top-1/2 left-1/2 w-5 h-px -translate-x-1/2 -translate-y-1/2 bg-red-400/80" />
          <span className="absolute top-1/2 left-1/2 w-px h-5 -translate-x-1/2 -translate-y-1/2 bg-cyan-400/80"
            style={{ transform: "rotateX(90deg) translateY(-50%)", transformOrigin: "bottom center" }} />
          <span className="absolute top-[-2px] left-1/2 -translate-x-1/2 text-[8px] text-green-300">Y</span>
          <span className="absolute top-1/2 right-[-4px] -translate-y-1/2 text-[8px] text-red-300">X</span>
        </div>
      </div>

      {/* 控件栏 */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 bg-black/55 backdrop-blur-sm rounded-full border border-white/10 px-1 py-1">
        <button
          type="button"
          onClick={() => setPlaying(p => !p)}
          title={playing ? "暂停旋转" : "自动旋转"}
          className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-cyan-200"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={handleReset}
          title="重置视角"
          className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-300"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* marketplace 信息保留在底部渐变 */}
      {appearance.marketplace && (
        <div className="absolute bottom-0 inset-x-0 p-3 pr-28 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-0">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-amber-300">
              <TagIcon className="w-3 h-3" />
              <span className="font-semibold tabular-nums">{formatCredits(appearance.marketplace.price)}</span>
            </div>
            <div className="text-gray-300">
              累计售出 <span className="text-emerald-300 font-semibold tabular-nums">{formatCompactNumber(appearance.marketplace.soldCount)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 左下角提示：只读 + 3D 占位 */}
      <div className="absolute bottom-3 left-3 z-10 text-[10px] text-gray-400 font-light pointer-events-none">
        拖动鼠标预览 · 3D 模型占位
      </div>
    </div>
  );
}

/** 统一应用倾斜到主体 / 光泽 / 轴向 gizmo。 */
function applyTransform(
  card: HTMLDivElement | null,
  glare: HTMLDivElement | null,
  gizmo: HTMLDivElement | null,
  rotX: number,
  rotY: number,
) {
  if (card) card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  if (glare) {
    // 光泽随 Y 旋转角左右流动。
    const pos = 50 + (rotY / 18) * 30;
    glare.style.backgroundPosition = `${pos}% 50%`;
  }
  if (gizmo) {
    const inner = gizmo.firstElementChild as HTMLElement | null;
    if (inner) inner.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  }
}

// ── Thumbnail card ───────────────────────────────────────────────────────────
function ThumbCard({ appearance, active, onSelect }: {
  appearance: ForgeResult;
  active: boolean;
  onSelect: () => void;
}) {
  const status = appearance.status ?? "draft";
  const meta = STATUS_META[status];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative shrink-0 w-20 aspect-[3/4] rounded-md overflow-hidden border transition
        ${active
          ? "border-cyan-400/70 ring-2 ring-cyan-400/40"
          : "border-white/10 hover:border-cyan-500/40"}`}
      title={appearance.prompt}
    >
      <img src={appearance.thumbnail ?? appearance.image} alt={appearance.prompt}
        className="w-full h-full object-cover group-hover:scale-105 transition" />
      {/* 仅 official / listed / sold 状态显示角标，draft 默认不贴角标减轻视觉负担 */}
      {status !== "draft" && (
        <div className="absolute top-1 left-1">
          <span className={`px-1 py-px rounded text-[8px] border leading-tight ${meta.cls}`}>{meta.label}</span>
        </div>
      )}
      {appearance.marketplace && (
        <div className="absolute bottom-1 right-1 px-1 py-px rounded bg-black/70 text-[8px] text-amber-300 tabular-nums">
          {formatCredits(appearance.marketplace.price)}
        </div>
      )}
    </button>
  );
}

// ── Empty + loading ──────────────────────────────────────────────────────────
function EmptyState({ onGoToForge }: { onGoToForge: () => void }) {
  return (
    <div className="py-14 flex flex-col items-center text-center">
      <ImageIcon className="w-8 h-8 text-gray-600 mb-3" />
      <div className="text-sm text-gray-300 mb-1">还没有生成过形象</div>
      <div className="text-xs text-gray-500 font-light mb-4">前往 AI 形象锻造炉，生成这位艺人的第一张形象。</div>
      <Button onClick={onGoToForge} size="sm"
        className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white">
        <Wand2 className="w-3.5 h-3.5 mr-1.5" /> 前往锻造炉
      </Button>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="p-5 space-y-4">
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 h-80 rounded-xl bg-white/[0.04] animate-pulse" />
        <div className="lg:col-span-3 aspect-[4/3] rounded-xl bg-white/[0.04] animate-pulse" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shrink-0 w-20 aspect-[3/4] rounded-md bg-white/[0.04] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
