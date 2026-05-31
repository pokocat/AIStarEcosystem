"use client";
// ============================================================
// 创建选择（STEP 01）— 真人授权复刻 / 纯 AI 原创。
// 选定后即建草稿 avatar（draft），进入素材准备步（avatar 作用域）。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarCreationMode } from "@ai-star-eco/types/ai-avatar";
import { Btn, Tag } from "@/components/ui/primitives";
import { Icons, type IconComponent } from "@/components/ui/icons";
import { createAvatar } from "@/api/ai-avatar";
import { toast } from "@/components/ui/toast";

interface ModeCard {
  key: AiAvatarCreationMode;
  icon: IconComponent;
  title: string;
  en: string;
  desc: string;
  points: string[];
  note: string;
  hue: number;
}

const CARDS: ModeCard[] = [
  { key: "real_clone", icon: Icons.camera, title: "真人授权复刻", en: "REAL-PERSON CLONE", desc: "基于真人参考照片复刻形象。适合主播复刻、个人虚拟分身、真人 IP。", points: ["上传 3+ 张多角度照片", "在线签署电子肖像授权", "人像图生图大模型复刻"], note: "强合规 · 需肖像授权", hue: 28 },
  { key: "ai_original", icon: Icons.sparkle, title: "纯 AI 原创生成", en: "AI ORIGINAL", desc: "无需真人素材，文字描述直接生成原创形象。适合虚拟角色、二次元、品牌 IP。", points: ["输入人设文案描述词", "可选上传风格参考图", "文生图大模型原创生成"], note: "无肖像风险 · 版权归平台", hue: 268 },
];

const backLink: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", color: "var(--ink-2)", cursor: "pointer", fontSize: 13, fontFamily: "var(--font-mono)" };

export default function CreateSelect() {
  const router = useRouter();
  const [mode, setMode] = React.useState<AiAvatarCreationMode | null>(null);
  const [busy, setBusy] = React.useState(false);

  const next = async () => {
    if (!mode) return;
    setBusy(true);
    try {
      const a = await createAvatar({ mode, name: "" });
      router.push(`/avatars/${a.id}/material`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "创建失败", { icon: "!", tone: "var(--err)" });
      setBusy(false);
    }
  };

  return (
    <div className="fade-up" style={{ maxWidth: 1080, margin: "0 auto", padding: "60px 36px" }}>
      <button onClick={() => router.push("/library")} style={backLink}><Icons.back size={15} />返回资产库</button>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--accent)", margin: "24px 0 10px" }}>STEP 01 · 选择创建模式</div>
      <h1 style={{ margin: "0 0 12px", fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" }}>你想如何创建数字人？</h1>
      <p style={{ color: "var(--ink-1)", fontSize: 15, margin: "0 0 40px", maxWidth: "52ch", lineHeight: 1.6 }}>
        两条路径的后段流程（草稿 → 精调 → 美化 → 定稿 → 衍生）完全一致，仅前期素材准备不同。
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        {CARDS.map((c) => {
          const on = mode === c.key;
          return (
            <div
              key={c.key}
              onClick={() => setMode(c.key)}
              style={{ position: "relative", padding: 28, borderRadius: "var(--r-xl)", cursor: "pointer", transition: "all .2s", overflow: "hidden", background: on ? "var(--bg-2)" : "var(--bg-1)", border: "1px solid " + (on ? "var(--accent)" : "var(--line)"), boxShadow: on ? "var(--glow-accent)" : "none" }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.borderColor = "var(--line-3)"; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.borderColor = "var(--line)"; }}
            >
              <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: 999, background: `radial-gradient(circle, oklch(0.5 0.12 ${c.hue} / 0.18), transparent 70%)` }} />
              <div style={{ width: 52, height: 52, borderRadius: 14, background: `oklch(0.3 0.08 ${c.hue})`, border: `1px solid oklch(0.5 0.1 ${c.hue} / 0.5)`, display: "grid", placeItems: "center", color: `oklch(0.8 0.12 ${c.hue})`, marginBottom: 18 }}>
                <c.icon size={26} />
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", color: "var(--ink-2)", marginBottom: 6 }}>{c.en}</div>
              <h3 style={{ margin: "0 0 10px", fontSize: 21, fontWeight: 600 }}>{c.title}</h3>
              <p style={{ color: "var(--ink-1)", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 18px", minHeight: 62 }}>{c.desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
                {c.points.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--ink-1)" }}>
                    <span style={{ color: `oklch(0.8 0.12 ${c.hue})`, display: "flex" }}><Icons.check size={14} stroke={2.4} /></span>
                    {p}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                <Tag>{c.note}</Tag>
                <span style={{ width: 22, height: 22, borderRadius: 999, border: "1px solid " + (on ? "var(--accent)" : "var(--line-3)"), display: "grid", placeItems: "center", background: on ? "var(--accent)" : "transparent", color: "#1a1205" }}>
                  {on && <Icons.check size={13} stroke={3} />}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 30 }}>
        <Btn variant="pri" size="lg" iconR={Icons.arrowR} disabled={!mode || busy} onClick={next}>{busy ? "创建中…" : "下一步 · 素材准备"}</Btn>
      </div>
    </div>
  );
}
