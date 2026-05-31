"use client";
// ============================================================
// 模板中心 — 美颜 / 风格模板管理（预览 / 收藏 / 复制）。
// ============================================================
import * as React from "react";
import type { AiAvatarTemplate } from "@ai-star-eco/types/ai-avatar";
import { Btn, IconBtn, Portrait, Seg, Tag } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { useApi } from "@/lib/hooks";
import { listTemplates } from "@/api/ai-avatar";
import { toast } from "@/components/ui/toast";

const hueOf = (t: AiAvatarTemplate) => 28 + (t.id.charCodeAt(t.id.length - 1) % 8) * 38;

export default function TemplatesPage() {
  const { data } = useApi(() => listTemplates(), []);
  const [cat, setCat] = React.useState<"beauty" | "style">("beauty");
  const [fav, setFav] = React.useState<string[]>(["b1"]);
  const [preview, setPreview] = React.useState<AiAvatarTemplate | null>(null);

  const all = data ?? [];
  const list = all.filter((t) => (cat === "beauty" ? t.category === "beauty" || t.category === "retouch" : t.category === "style"));

  return (
    <div className="fade-up" style={{ padding: "28px 36px 60px", maxWidth: 1400, margin: "0 auto" }}>
      <Head kicker="TEMPLATE CENTER" title="模板中心" sub="统一管理可复用的美颜与风格模板，支持组合、收藏、置顶。"
        right={<Btn variant="pri" icon={Icons.plus} onClick={() => toast("新建自定义模板", { icon: "＋" })}>自定义模板</Btn>} />
      <div style={{ display: "flex", gap: 14, marginBottom: 24, alignItems: "center" }}>
        <Seg value={cat} onChange={setCat} options={[{ value: "beauty", icon: Icons.wand, label: "人像美颜 / 美化" }, { value: "style", icon: Icons.palette, label: "风格模板" }]} />
        <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{cat === "beauty" ? "滤镜 · 磨皮 · 肤色 · 妆容 · 质感（通用所有数字人）" : "穿搭 · 场景 · 镜头（打样 / 渲染视频专用）"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
        {list.map((t) => {
          const isFav = fav.includes(t.id);
          const hue = hueOf(t);
          return (
            <div key={t.id} style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", transition: "all .18s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--line-3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.transform = "none"; }}>
              <div style={{ position: "relative", aspectRatio: "4/3", background: `linear-gradient(140deg, oklch(0.5 0.12 ${hue}), oklch(0.26 0.06 ${hue}))` }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0 12px, transparent 12px 24px)" }} />
                <button onClick={() => setFav((f) => (isFav ? f.filter((x) => x !== t.id) : [...f, t.id]))} style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 999, border: "none", cursor: "pointer", background: "rgba(10,11,14,0.6)", color: isFav ? "var(--accent)" : "var(--ink-1)", display: "grid", placeItems: "center" }}>
                  <Icons.star size={16} fill={isFav ? "var(--accent)" : "none"} />
                </button>
                <span style={{ position: "absolute", bottom: 10, left: 12, fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.7)" }}>PREVIEW</span>
                <span style={{ position: "absolute", top: 10, left: 12 }}><Tag>{t.official ? "官方" : "自定义"}</Tag></span>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{t.name}</div>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)" }}>{t.usageCount}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 4, minHeight: 17 }}>{t.description}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Btn size="sm" variant="line" full icon={Icons.eye} onClick={() => setPreview(t)}>预览</Btn>
                  <Btn size="sm" variant="ghost" icon={Icons.copy} onClick={() => toast(`已复制模板「${t.name}」`, { icon: "⎘" })} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {preview && <TplPreview t={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function TplPreview({ t, onClose }: { t: AiAvatarTemplate; onClose: () => void }) {
  const hue = hueOf(t);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,11,14,0.7)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 200 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 720, maxWidth: "90%", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{t.name} · 效果预览</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 3 }}>左：原图　右：套用模板（GFPGAN + 调色 / 妆容迁移）</div>
          </div>
          <IconBtn icon={Icons.x} size={32} onClick={onClose} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, padding: 20 }}>
          <div style={{ position: "relative" }}>
            <Portrait hue={hue} ratio="3/4" label="原图" dim />
            <span style={{ position: "absolute", top: 8, left: 8, fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "2px 7px", borderRadius: 4, background: "rgba(10,11,14,0.7)", color: "var(--ink-1)" }}>BEFORE</span>
          </div>
          <div style={{ position: "relative" }}>
            <Portrait hue={hue} ratio="3/4" label={t.name} />
            <span style={{ position: "absolute", top: 8, left: 8, fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "2px 7px", borderRadius: 4, background: "var(--accent)", color: "#1a1205" }}>AFTER</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, padding: "0 20px 20px" }}>
          <Btn variant="line" full onClick={onClose}>关闭</Btn>
          <Btn variant="pri" full icon={Icons.check} onClick={() => { toast(`已应用模板「${t.name}」`); onClose(); }}>应用此模板</Btn>
        </div>
      </div>
    </div>
  );
}

export function Head({ kicker, title, sub, right }: { kicker: string; title: string; sub: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 26, gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--accent)", marginBottom: 8 }}>{kicker}</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>{title}</h1>
        <div style={{ fontSize: 13.5, color: "var(--ink-1)", marginTop: 6 }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}
