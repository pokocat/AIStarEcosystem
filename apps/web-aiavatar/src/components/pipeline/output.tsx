"use client";
// ============================================================
// 模板美化 + 标准出图（STEP 06）— 美颜模板可叠加（真实客户端 beauty 算法预览）+ 标准构图批量出图。
// 真实算法：beauty.ts（磨皮 / 美白 / 暖色 / 亮度，确定性）。后台 templateBeautify 任务记录版本 + 推状态机。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { Btn, Panel, Portrait, Tag, StatusPill } from "@/components/ui/primitives";
import { SourceBadge } from "@/components/common/source-badge";
import { Icons } from "@/components/ui/icons";
import { useApi, usePolling } from "@/lib/hooks";
import { listTemplates, templateBeautify } from "@/api/ai-avatar";
import { COMPOSITIONS, styleHue } from "@/constants/aiavatar-ui";
import { applyBeauty, type BeautyParams, BEAUTY_NEUTRAL } from "@/lib/beauty";
import { toast } from "@/components/ui/toast";

// 美颜模板 → 真实 beauty 参数（warmth 可负=偏冷）。
const BEAUTY_PRESETS: Record<string, BeautyParams> = {
  b1: { smooth: 55, whiten: 30, warmth: 12, brightness: 56 },
  b2: { smooth: 30, whiten: 8, warmth: 0, brightness: 54 },
  b3: { smooth: 42, whiten: 70, warmth: -22, brightness: 60 },
  b4: { smooth: 35, whiten: 12, warmth: 38, brightness: 48 },
  b5: { smooth: 60, whiten: 30, warmth: 18, brightness: 58 },
  b6: { smooth: 38, whiten: 22, warmth: 6, brightness: 55 },
};

function combine(ids: string[]): BeautyParams {
  const ps = ids.map((id) => BEAUTY_PRESETS[id]).filter(Boolean);
  if (!ps.length) return BEAUTY_NEUTRAL;
  const avg = (k: keyof BeautyParams) => ps.reduce((s, p) => s + p[k], 0) / ps.length;
  return { smooth: avg("smooth"), whiten: avg("whiten"), warmth: avg("warmth"), brightness: avg("brightness") };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = url;
  });
}

async function beautifyShot(img: HTMLImageElement, params: BeautyParams, ratio: number): Promise<string> {
  // 按构图比例裁切后做 beauty。
  const W = 480;
  const H = Math.round(W / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  // cover 裁切
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2 - dh * 0.04, dw, dh);
  const data = ctx.getImageData(0, 0, W, H);
  ctx.putImageData(applyBeauty(data, params), 0, 0);
  return canvas.toDataURL("image/jpeg", 0.9);
}

const RATIO: Record<string, number> = { "3:4": 3 / 4, "9:16": 9 / 16, "1:1": 1 };

export function OutputStep({ detail, reload }: { detail: AiAvatarDetail; reload: () => void }) {
  const router = useRouter();
  const { avatar } = detail;
  const { data: templates } = useApi(() => listTemplates(), []);
  const beautyTemplates = (templates ?? []).filter((t) => t.category === "beauty" || t.category === "retouch");
  const [beauty, setBeauty] = React.useState<string[]>(["b1", "b3"]);
  const [comps, setComps] = React.useState<string[]>(COMPOSITIONS.map((c) => c.id));
  const [previews, setPreviews] = React.useState<Record<string, string>>({});

  const job = detail.recentJobs.find((j) => (j.input as { kind?: string } | null)?.kind === "beautify");
  const running = !!job && (job.status === "running" || job.status === "queued");
  const done = !!job && job.status === "succeeded" && Object.keys(previews).length > 0;
  const phase: "config" | "gen" | "done" = running ? "gen" : done ? "done" : "config";
  usePolling(reload, 700, running);

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const selComps = COMPOSITIONS.filter((c) => comps.includes(c.id));

  const run = async () => {
    if (!comps.length) return;
    try {
      // 真实 beauty 预览（客户端确定性算法）
      if (avatar.coverUrl) {
        const img = await loadImage(avatar.coverUrl);
        const params = combine(beauty);
        const next: Record<string, string> = {};
        for (const c of selComps) {
          next[c.id] = await beautifyShot(img, params, RATIO[c.ratio] ?? 0.75);
        }
        setPreviews(next);
      }
      // 后台任务（记录版本 + 推状态机 pending_finalize）
      await templateBeautify(avatar.id, { params: { templateIds: beauty, shots: comps } });
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "出图失败", { icon: "!", tone: "var(--err)" });
    }
  };

  const hue = styleHue(avatar.styleCategory);

  return (
    <div style={{ padding: "28px 36px 60px", maxWidth: 1340, margin: "0 auto" }}>
      <PageHead no="STEP 06 · 标准素材图集" title="模板美化 · 标准出图" status="pending_finalize" sub="统一风格与构图，产出下游通用标准底图（固定规格）。"
        right={phase === "done" && <Btn variant="pri" size="lg" iconR={Icons.arrowR} onClick={() => router.push(`/avatars/${avatar.id}/finalize`)}>前往定稿</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 28, alignItems: "start" }}>
        {/* 左控制 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Panel title="美颜 / 美化模板" right={<Tag on>可叠加 · {beauty.length}</Tag>}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {beautyTemplates.map((b) => {
                const on = beauty.includes(b.id);
                const hueB = 28 + (b.id.charCodeAt(1) % 6) * 40;
                return (
                  <button key={b.id} onClick={() => toggle(beauty, setBeauty, b.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: "var(--r-md)", cursor: "pointer", textAlign: "left", background: on ? "var(--accent-soft)" : "var(--bg-2)", border: "1px solid " + (on ? "var(--accent-line)" : "var(--line)") }}>
                    <div style={{ width: 34, height: 34, borderRadius: 7, flexShrink: 0, background: `linear-gradient(140deg, oklch(0.55 0.1 ${hueB}), oklch(0.32 0.07 ${hueB}))`, position: "relative" }}>
                      {on && <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff" }}><Icons.check size={16} stroke={3} /></span>}
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: on ? "var(--accent-hi)" : "var(--ink-0)" }}>{b.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--ink-2)" }}>{b.category === "retouch" ? "细节" : "美颜"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel title="标准构图（系统预设规格）" right={<Tag>{comps.length} / 6</Tag>}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {COMPOSITIONS.map((c) => {
                const on = comps.includes(c.id);
                return (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: "var(--r-md)", cursor: "pointer", background: on ? "var(--bg-3)" : "var(--bg-2)", border: "1px solid " + (on ? "var(--line-2)" : "var(--line)") }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(comps, setComps, c.id)} style={{ accentColor: "var(--accent)", width: 15, height: 15 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--ink-0)" }}>{c.name}{c.main && <span style={{ marginLeft: 8 }}><Tag on>主图</Tag></span>}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)" }}>{c.ratio}</span>
                  </label>
                );
              })}
            </div>
          </Panel>
          <Btn variant="pri" size="lg" full icon={Icons.layers} onClick={run} disabled={phase === "gen" || !comps.length}>{phase === "gen" ? "批量生成中…" : "批量出标准图"}</Btn>
        </div>

        {/* 右预览 */}
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            <span>OUTPUT · 标准形象图集</span>
            <span>{phase === "done" ? "✓ 风格统一 · 固定规格 · GFPGAN + beauty" : "GFPGAN 修复 + 客户端 beauty · PNG/JPG"}</span>
          </div>
          {phase === "config" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {selComps.map((c) => <Portrait key={c.id} hue={hue} src={avatar.coverUrl} ratio="3/4" label={c.name} sub={c.ratio} dim />)}
            </div>
          )}
          {phase === "gen" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {selComps.map((c, i) => (
                <div key={c.id} style={{ aspectRatio: "3/4", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "linear-gradient(100deg, var(--bg-2) 30%, var(--bg-3) 50%, var(--bg-2) 70%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", animationDelay: i * 0.12 + "s", display: "grid", placeItems: "center" }}>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--signal)" }}>生成中</span>
                </div>
              ))}
            </div>
          )}
          {phase === "done" && (
            <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {selComps.map((c) => (
                <Portrait key={c.id} hue={hue} src={previews[c.id]} ratio="3/4" label={c.name} sub={c.ratio + " · 1080P"}
                  badge={<SourceBadge mode="mock" engine="GFPGAN + beauty (client)" />} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PageHead({ no, title, status, sub, right }: { no: string; title: string; status?: string; sub: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", color: "var(--accent)", marginBottom: 8 }}>{no}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>{title}</h1>
          {status && <StatusPill status={status} />}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--ink-1)", marginTop: 8 }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}
