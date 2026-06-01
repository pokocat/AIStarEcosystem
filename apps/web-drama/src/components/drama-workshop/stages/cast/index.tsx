"use client";

// 阶段 3 角色与资产 — 角色卡格栅 + 数字人选择器 + 场景锁参考。
// 设计真源:screens-project.jsx `CastStage`。
import * as React from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Lock, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { Cost, Thumb } from "@/components/drama-ui";
import { StageHeader } from "../../workbench";
import { STAGE_BY_KEY } from "../../stages-config";
import type { WorkshopAction, WorkshopState } from "../../workbench";
import type { CharacterDef, ProjectData } from "@/mocks/drama-workshop";
import { CharCard } from "./char-card";
import { AvatarPicker, ScenePicker } from "./avatar-picker";

interface CastStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
}

const SCENE_LIB = [
  { id: "r1", name: "冷调公寓夜", from: "#64748b", to: "#1e293b" },
  { id: "r2", name: "霓虹雨夜",   from: "#7c3aed", to: "#2563eb" },
  { id: "r3", name: "暖黄室内",   from: "#f59e0b", to: "#b45309" },
  { id: "r4", name: "金属电梯",   from: "#94a3b8", to: "#475569" },
  { id: "r5", name: "落地窗景",   from: "#22d3ee", to: "#0e7490" },
  { id: "r6", name: "空镜街道",   from: "#a78bfa", to: "#6366f1" },
];

export function CastStage({ state, dispatch, data }: CastStageProps) {
  const [binding, setBinding] = React.useState<CharacterDef | null>(null);
  const [scenePick, setScenePick] = React.useState<{ id: string; name: string } | null>(null);
  const [sceneLocks, setSceneLocks] = React.useState<Record<string, string>>({});

  const unbound = state.chars.filter((c) => c.role === "key" && !c.bound).length;

  const confirmBind = (charId: string, avatar: string) => {
    dispatch({ type: "bindAvatar", charId, avatar });
    setBinding(null);
    toast.success("已锁定数字人形象,跨集一致");
  };

  return (
    <div className="scroll" style={{ height: "100%" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 32px 64px" }}>
        <StageHeader
          no={3}
          scope="项目"
          title="角色与资产"
          desc="给关键角色绑定一个数字人分身锁住形象 —— 这是跨集一致性和真人脸的地基。"
          right={
            <div className="row gap-2">
              <button type="button" className="btn btn-primary btn-sm">
                <Wand2 size={15} /> 从大纲重抽角色 <Cost n={STAGE_BY_KEY.cast.cost} />
              </button>
            </div>
          }
        />

        {unbound > 0 && (
          <div
            className="row gap-3 fade-up"
            style={{
              padding: "12px 16px",
              background: "var(--accent-soft)",
              borderRadius: 14,
              marginBottom: 20,
              color: "var(--accent)",
            }}
          >
            <Sparkles size={18} fill="currentColor" strokeWidth={0} />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>
              还有 {unbound} 个关键角色没绑数字人 —— 绑定后 TA 在每一集的脸都一样,出场镜头会自动走数字人出镜。
            </span>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
            gap: 18,
          }}
        >
          {state.chars.map((c, i) => (
            <CharCard
              key={c.id}
              c={c}
              delay={i * 40}
              onBind={() => setBinding(c)}
              onToggleRole={() => dispatch({ type: "toggleRole", charId: c.id })}
            />
          ))}
        </div>

        {/* 场景与参考 */}
        <div style={{ marginTop: 28 }}>
          <div className="row gap-2" style={{ marginBottom: 12 }}>
            <ImageIcon size={17} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>场景与参考</span>
            <span className="faint" style={{ fontSize: 12.5 }}>
              像锁角色一样锁住关键场景的视觉 —— 让每集的「那间公寓」长得一样
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
              gap: 14,
            }}
          >
            {data.script.scenes.map((s, i) => {
              const sceneId = "scn" + i;
              const name = s.place.replace(/^(内景|外景)\s*·\s*/, "");
              const lockId = sceneLocks[sceneId];
              const asset = lockId ? SCENE_LIB.find((a) => a.id === lockId) ?? null : null;
              return (
                <div
                  key={sceneId}
                  className="card col"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  {asset ? (
                    <div style={{ position: "relative" }}>
                      <Thumb
                        from={asset.from}
                        to={asset.to}
                        ratio="16/9"
                        radius={0}
                        label={asset.name}
                        style={{ width: "100%" }}
                      />
                      <span
                        style={{ position: "absolute", top: 8, right: 8 }}
                        className="tag tag-accent"
                      >
                        <Lock size={11} /> 已锁
                      </span>
                    </div>
                  ) : (
                    <div
                      className="col center"
                      style={{
                        aspectRatio: "16/9",
                        background: "var(--surface-2)",
                        gap: 8,
                        borderBottom: "1px dashed var(--line)",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-line btn-sm"
                        onClick={() => setScenePick({ id: sceneId, name })}
                      >
                        <ImageIcon size={14} /> 锁定参考图
                      </button>
                    </div>
                  )}
                  <div className="col gap-1" style={{ padding: 13 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
                    <div className="faint" style={{ fontSize: 12 }}>{s.mood}</div>
                    {asset && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ alignSelf: "flex-start", marginTop: 4 }}
                        onClick={() => setScenePick({ id: sceneId, name })}
                      >
                        <RefreshCw size={13} /> 换参考
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {binding && (
        <AvatarPicker
          char={binding}
          onClose={() => setBinding(null)}
          onConfirm={confirmBind}
        />
      )}
      {scenePick && (
        <ScenePicker
          sceneName={scenePick.name}
          onClose={() => setScenePick(null)}
          onConfirm={(assetId) => {
            setSceneLocks((m) => ({ ...m, [scenePick.id]: assetId }));
            setScenePick(null);
            toast.success("已锁定场景参考,跨集一致");
          }}
        />
      )}
    </div>
  );
}
