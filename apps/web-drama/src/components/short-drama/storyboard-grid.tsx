"use client";

// 分镜板（v0.7）：把脚本的 scenes[] 以 9:16 竖屏画格可视化。
// 只读展示（编辑在「剧本」步的 SceneEditor 完成），帮用户在生成前确认镜头节奏。
import * as React from "react";
import { Clapperboard } from "lucide-react";
import { EmptyState } from "@/components/common";
import type { DramaScene, ShotType, CameraMove } from "@/api/short-drama";

const SHOT_LABEL: Record<ShotType, string> = { wide: "远景", medium: "中景", close: "近景", extreme_close: "特写" };
const MOVE_LABEL: Record<CameraMove, string> = { static: "固定", push: "推镜", pull: "拉镜", pan: "摇镜", handheld: "手持" };

export function StoryboardGrid({ scenes }: { scenes: DramaScene[] }) {
  if (!scenes || scenes.length === 0) {
    return (
      <EmptyState
        icon={<Clapperboard size={26} />}
        title="还没有分镜"
        description="先在「剧本」步添加分镜（每镜含景别 / 运镜 / 时长 / 画面），这里会按竖屏画格预览镜头节奏。"
      />
    );
  }
  const total = scenes.reduce((s, sc) => s + (sc.duration_sec || 0), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 12.5, color: "var(--fg-2)" }}>
        共 <b style={{ color: "var(--fg-0)" }}>{scenes.length}</b> 镜 · 总时长约 <b style={{ color: "var(--fg-0)" }}>{total}s</b> · 9:16 竖屏
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))", gap: 14 }}>
        {scenes.map((sc, i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              background: "var(--bg-1)",
            }}
          >
            <div
              style={{
                aspectRatio: "9 / 16",
                background: "var(--surface-2)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent)" }}>
                  镜 {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mono" style={{ fontSize: 10, color: "var(--fg-2)" }}>{sc.duration_sec ?? 0}s</span>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <span style={chipStyle}>{SHOT_LABEL[sc.shot_type ?? "medium"]}</span>
                <span style={chipStyle}>{MOVE_LABEL[sc.camera_move ?? "static"]}</span>
                {sc.gen_voice !== false && <span style={chipStyle}>配音</span>}
              </div>
            </div>
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-0)", marginBottom: 4 }}>
                {sc.heading || "未命名场景"}
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-2)", lineHeight: 1.5, maxHeight: 54, overflow: "hidden" }}>
                {sc.shot || sc.summary || "（暂无画面描述）"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontFamily: "var(--font-mono)",
  letterSpacing: 0.4,
  padding: "2px 6px",
  borderRadius: "var(--radius-pill)",
  background: "color-mix(in srgb, var(--accent) 14%, transparent)",
  color: "var(--accent)",
  border: "1px solid color-mix(in srgb, var(--accent) 26%, transparent)",
};
