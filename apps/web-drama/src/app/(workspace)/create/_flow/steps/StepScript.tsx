"use client";

// 脚本步：剧本与分镜不分开 —— 每个场景的故事/画面/台词就是分镜，本质都是 prompt，渲染时按场景脚本驱动。
// 「编辑」是结构化场景编辑；「分镜预览」是同一份场景数据的竖屏画格视图。长文本编剧室并行存在。
import * as React from "react";
import { FileText, LayoutGrid, List } from "lucide-react";
import { Card } from "@/components/premium";
import { Field, TextInput, SectionHeader, EmptyState } from "@/components/common";
import { SceneEditor } from "@/components/short-drama/scene-editor";
import { StoryboardGrid } from "@/components/short-drama/storyboard-grid";
import { ScriptProsePanel } from "@/components/short-drama/script-prose-panel";
import type { DramaDraftController } from "../useDramaDraft";

type View = "edit" | "board";

export function StepScript({ ctrl }: { ctrl: DramaDraftController }) {
  const [view, setView] = React.useState<View>("edit");
  const s = ctrl.activeScript;
  if (!s) {
    return (
      <Card style={{ padding: "22px 24px" }}>
        <EmptyState icon={<FileText size={26} />} title="还没有脚本" description="回到「选题」步用 AI 生成，或手动新建空白脚本。" />
      </Card>
    );
  }
  const epHint = s.series_id ? `第 ${s.episode_no ?? 1} 集 · ` : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <SectionHeader eyebrow="脚本 = 分镜" title={<span>{epHint}场景脚本</span>} />
          <div style={{ display: "inline-flex", gap: 4, padding: 3, background: "var(--surface-1)", borderRadius: "var(--radius-pill)", border: "1px solid var(--line)" }}>
            <Toggle active={view === "edit"} onClick={() => setView("edit")} icon={<List size={13} />} label="编辑" />
            <Toggle active={view === "board"} onClick={() => setView("board")} icon={<LayoutGrid size={13} />} label="分镜预览" />
          </div>
        </div>

        <Field label="一句话简介（logline）">
          <TextInput value={s.logline ?? ""} onChange={(e) => ctrl.update({ logline: e.target.value })} placeholder="一句话钩子，统领全剧" />
        </Field>

        {view === "edit" ? (
          <>
            <SceneEditor scenes={s.scenes ?? []} onChange={(scenes) => ctrl.update({ scenes })} canRewrite={ctrl.persisted} onRewrite={ctrl.handleRewrite} />
            {!ctrl.persisted && <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 8 }}>提示：保存脚本后可对单镜使用「AI 重写」。</div>}
            <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 8 }}>
              每个场景的「剧情 / 画面 / 台词」即分镜提示词；渲染时按各场景脚本逐镜驱动生成。
            </div>
          </>
        ) : (
          <StoryboardGrid scenes={s.scenes ?? []} />
        )}
      </Card>

      <ScriptProsePanel defaultTitle={s.title} />
    </div>
  );
}

function Toggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: "var(--radius-pill)",
        border: "none",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        fontFamily: "var(--font-sans)",
        background: active ? "var(--bg-1)" : "transparent",
        color: active ? "var(--accent)" : "var(--fg-2)",
        boxShadow: active ? "var(--shadow-sm)" : "none",
      }}
    >
      {icon} {label}
    </button>
  );
}
