"use client";
// ============================================================
// 可交互媒体预览 — VideoPlayer（运镜短视频）/ Viewer3D（可旋转 3D）。
// 从原型 screens-output.jsx 的 VideoPlayer / Viewer3D 移植；支持真实图片 poster。
// ============================================================
import * as React from "react";
import { Portrait } from "@/components/ui/primitives";
import { IconBtn } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";

// ── 运镜短视频播放器 ──────────────────────────────────────────────────────────
export function VideoPlayer({
  hue = 340,
  dur = 20,
  scene = "直播间",
  sub,
  posterSrc,
}: {
  hue?: number;
  dur?: number;
  scene?: string;
  sub?: string;
  posterSrc?: string | null;
}) {
  const total = dur || 20;
  const [playing, setPlaying] = React.useState(false);
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setT((x) => {
      const n = x + 0.1;
      if (n >= total) {
        setPlaying(false);
        return total;
      }
      return n;
    }), 100);
    return () => window.clearInterval(id);
  }, [playing, total]);
  const pct = (t / total) * 100;
  const fmt = (s: number) => "0:" + String(Math.floor(s)).padStart(2, "0");
  return (
    <div style={{ position: "relative", borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--line-2)" }}>
      <div style={{ overflow: "hidden" }}>
        <Portrait
          hue={hue}
          src={posterSrc}
          label={playing ? null : "场景：" + scene}
          sub={playing ? undefined : sub || "1080P · 25fps"}
          ratio="16/9"
          style={{ borderRadius: 0, border: "none", transform: playing ? `scale(${1.04 + pct / 1000}) translateX(${-pct / 40}%)` : "none", transition: "transform .12s linear" }}
        />
      </div>
      <button
        onClick={() => setPlaying((p) => !p)}
        style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 54, height: 54, borderRadius: 999, background: "var(--accent)", color: "#1a1205", border: "none", display: "grid", placeItems: "center", fontSize: 20, cursor: "pointer", boxShadow: "var(--glow-accent)", opacity: playing ? 0 : 1, transition: "opacity .2s" }}
      >
        ▶
      </button>
      {playing && (
        <div style={{ position: "absolute", top: 10, left: 10, fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(10,11,14,0.7)", color: "var(--signal)", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--signal)", animation: "pulse 1.4s infinite" }} />
          缓慢运镜
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 12px 10px", background: "linear-gradient(transparent, rgba(10,11,14,0.85))", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setPlaying((p) => !p)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, width: 18 }}>
          {playing ? "❚❚" : "▶"}
        </button>
        <div
          onClick={(e) => {
            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            setT(((e.clientX - r.left) / r.width) * total);
          }}
          style={{ flex: 1, height: 4, borderRadius: 9, background: "rgba(255,255,255,0.2)", cursor: "pointer" }}
        >
          <div style={{ width: pct + "%", height: "100%", borderRadius: 9, background: "var(--accent)" }} />
        </div>
        <span className="mono" style={{ fontSize: 10.5, color: "#fff" }}>{fmt(t) + " / " + fmt(total)}</span>
      </div>
    </div>
  );
}

// ── 可旋转 3D 预览 ────────────────────────────────────────────────────────────
export function Viewer3D({
  hue = 200,
  precision = "high",
  ratio = "4/3",
  posterSrc,
}: {
  hue?: number;
  precision?: "low" | "high";
  ratio?: string;
  posterSrc?: string | null;
}) {
  const [ang, setAng] = React.useState(0);
  const [auto, setAuto] = React.useState(false);
  React.useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => setAng((a) => (a + 2) % 360), 40);
    return () => window.clearInterval(id);
  }, [auto]);
  const drag = (e0: React.MouseEvent) => {
    const sx = e0.clientX;
    const a0 = ang;
    setAuto(false);
    const mv = (e: MouseEvent) => setAng((a0 + (e.clientX - sx)) % 360);
    const up = () => {
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
  };
  const norm = ((ang % 360) + 360) % 360;
  return (
    <div style={{ position: "relative", borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--line-2)" }}>
      <div onMouseDown={drag} style={{ cursor: "grab", background: `radial-gradient(120% 90% at ${50 + Math.sin((norm * Math.PI) / 180) * 30}% 40%, oklch(0.4 0.08 ${hue}), var(--bg-2))` }}>
        <Portrait
          hue={hue}
          src={posterSrc}
          label={null}
          ratio={ratio}
          style={{ borderRadius: 0, border: "none", background: "transparent", transform: `perspective(700px) rotateY(${Math.sin((norm * Math.PI) / 180) * 26}deg)`, transition: auto ? "none" : "transform .05s" }}
        />
      </div>
      <div style={{ position: "absolute", top: 10, left: 10, fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(10,11,14,0.7)", color: "var(--ink-1)" }}>
        {(precision === "high" ? "FLAME+3DGS" : "TripoSR GLB") + " · " + norm.toFixed(0) + "°"}
      </div>
      <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, padding: 7, background: "var(--bg-glass)", backdropFilter: "blur(10px)", borderRadius: 11, border: "1px solid var(--line-2)" }}>
        <IconBtn icon={Icons.chevL} size={30} onClick={() => setAng((a) => a - 30)} />
        <IconBtn icon={auto ? Icons.dim : Icons.cube} size={30} active={auto} title="自动旋转" onClick={() => setAuto((v) => !v)} />
        <IconBtn icon={Icons.chevR} size={30} onClick={() => setAng((a) => a + 30)} />
      </div>
      <div style={{ position: "absolute", bottom: 12, right: 12, fontSize: 10.5, color: "var(--ink-2)" }}>拖拽旋转</div>
    </div>
  );
}
