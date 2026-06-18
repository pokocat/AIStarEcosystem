"use client";

// 阶段 3 角色与资产 — 角色卡格栅 + 数字人选择器 + 场景锁参考。
// 设计真源:screens-project.jsx `CastStage`。
import * as React from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Lock, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { aiErrorMessage } from "@/lib/ai-error";
import { CreditButton, Thumb } from "@/components/drama-ui";
import { StageHeader } from "../../workbench";
import { STAGE_BY_KEY } from "../../stages-config";
import type { WorkshopAction, WorkshopState } from "../../workbench";
import type { CharacterDef, Material, ProjectData, ScriptScene } from "@/mocks/drama-workshop";
import { MATERIALS, setMaterials } from "@/mocks/drama-workshop";
import { useDramaConfig } from "@/lib/use-drama-config";
import { CharCard } from "./char-card";
import { AvatarPicker, ScenePicker } from "./avatar-picker";
import { ProjectsApi, RenderApi } from "@/api";
import type { StageContext } from "../stage-context";

/** 场景锁：纯参考库选取只有渐变（from/to），AI 生成的有真实 url。 */
type SceneLock = { name: string; url?: string; from?: string; to?: string };

interface CastStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  ctx?: StageContext;
}

const SCENE_LIB = [
  { id: "r1", name: "冷调公寓夜", from: "#64748b", to: "#1e293b" },
  { id: "r2", name: "霓虹雨夜",   from: "#7c3aed", to: "#2563eb" },
  { id: "r3", name: "暖黄室内",   from: "#f59e0b", to: "#b45309" },
  { id: "r4", name: "金属电梯",   from: "#94a3b8", to: "#475569" },
  { id: "r5", name: "落地窗景",   from: "#22d3ee", to: "#0e7490" },
  { id: "r6", name: "空镜街道",   from: "#a78bfa", to: "#6366f1" },
];

export function CastStage({ state, dispatch, data, ctx }: CastStageProps) {
  const cfg = useDramaConfig();
  const [binding, setBinding] = React.useState<CharacterDef | null>(null);
  const [scenePick, setScenePick] = React.useState<{ id: string; name: string } | null>(null);
  const [sceneLocks, setSceneLocks] = React.useState<Record<string, SceneLock>>({});
  const [drafting, setDrafting] = React.useState(false);
  const [portraitBusy, setPortraitBusy] = React.useState<Record<string, boolean>>({});
  const [sceneBusy, setSceneBusy] = React.useState<Record<string, boolean>>({});

  const unbound = state.chars.filter((c) => c.role === "key" && !c.bound).length;

  /** AI 生成角色定妆三视图 → 落 CharacterDef.portraits + 保存。出图时作人物一致性参考注入。 */
  const genPortraits = async (c: CharacterDef) => {
    if (portraitBusy[c.id]) return;
    setPortraitBusy((m) => ({ ...m, [c.id]: true }));
    try {
      const { portraits, cost } = await RenderApi.generatePortraits({
        name: c.name,
        features: c.desc,
        style: `${data.projectInfo.type}风格`,
      });
      const next = state.chars.map((x) =>
        x.id === c.id
          ? {
              ...x,
              portraits: { front: portraits.front?.url, side: portraits.side?.url, back: portraits.back?.url },
              refCount: 3,
            }
          : x,
      );
      dispatch({ type: "setChars", chars: next });
      if (ctx) await ctx.saveData({ ...data, characters: next });
      if (cost) dispatch({ type: "spend", n: cost });
      toast.success(`已生成「${c.name}」定妆三视图，出图会自动锁人物长相`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "定妆图生成失败，请稍后重试"));
    } finally {
      setPortraitBusy((m) => ({ ...m, [c.id]: false }));
    }
  };

  /** AI 生成场景参考图 → 存进素材场景库（cat=场景, 带真实 url）+ 锁定本场。出图时可在工厂 @素材参考 选用。 */
  const genSceneRef = async (sceneId: string, s: ScriptScene, name: string) => {
    if (sceneBusy[sceneId]) return;
    setSceneBusy((m) => ({ ...m, [sceneId]: true }));
    try {
      const frames = await RenderApi.renderFrame({
        kind: "shot",
        vars: {
          visual: `场景建立镜头（空镜，无人物）：${s.place}。${s.mood}。${s.action}`.slice(0, 280),
          size: "全景/远景",
          move: "固定",
          lineClause: "",
          castClause: "",
          styleSuffix: `${data.projectInfo.type}风格。`,
        },
        ratio: "16:9",
        count: 1,
      });
      const url = frames[0]?.url;
      if (!url) throw new Error("未生成图像");
      const mat: Material = {
        id: `scn_${Date.now().toString(36)}`,
        name: `${name} · 场景参考`,
        cat: "场景",
        kind: "image",
        from: "#64748b",
        to: "#1e293b",
        tags: ["场景参考", "AI 生成"],
        url,
        cdnKey: frames[0]?.cdnKey,
      };
      setMaterials([...MATERIALS, mat]);
      setSceneLocks((m) => ({ ...m, [sceneId]: { name, url } }));
      dispatch({ type: "spend", n: cfg.prices.frame });
      toast.success("已生成场景参考图并存入素材场景库");
    } catch (e) {
      toast.error(aiErrorMessage(e, "场景参考图生成失败，请稍后重试"));
    } finally {
      setSceneBusy((m) => ({ ...m, [sceneId]: false }));
    }
  };

  /** 真实 AI 重抽角色阵容 → 更新工作台 + 落库。 */
  const redraftCast = async () => {
    if (drafting) return;
    setDrafting(true);
    try {
      if (!ctx) {
        toast.success("已按大纲重新抽取角色");
        return;
      }
      const chars = await ProjectsApi.castAiDraft(ctx.projectId);
      dispatch({ type: "setChars", chars });
      await ctx.saveData({ ...data, characters: chars });
      dispatch({ type: "spend", n: cfg.prices.cast });
      toast.success(`已按大纲重新抽取 ${chars.length} 个角色`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "角色生成失败，请稍后重试"));
    } finally {
      setDrafting(false);
    }
  };

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
              <CreditButton
                cost={cfg.prices.cast}
                onConfirm={() => void redraftCast()}
                confirmTitle="重抽角色"
                confirmBody="AI 会按当前大纲重新抽取角色阵容（会替换现有角色列表）。"
                className="btn btn-primary btn-sm"
                disabled={drafting}
              >
                <Wand2 size={15} /> {drafting ? "正在重抽…" : "从大纲重抽角色"}
              </CreditButton>
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
              onGeneratePortraits={() => void genPortraits(c)}
              generating={portraitBusy[c.id]}
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
              const lock = sceneLocks[sceneId];
              const busy = sceneBusy[sceneId];
              return (
                <div
                  key={sceneId}
                  className="card col"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  {lock ? (
                    <div style={{ position: "relative" }}>
                      <Thumb
                        from={lock.from ?? "#64748b"}
                        to={lock.to ?? "#1e293b"}
                        src={lock.url}
                        ratio="16/9"
                        radius={0}
                        label={lock.url ? undefined : lock.name}
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
                      <div className="row gap-2">
                        <button
                          type="button"
                          className="btn btn-line btn-sm"
                          onClick={() => setScenePick({ id: sceneId, name })}
                        >
                          <ImageIcon size={14} /> 选参考
                        </button>
                        <button
                          type="button"
                          className="btn btn-grad btn-sm"
                          onClick={() => void genSceneRef(sceneId, s, name)}
                          disabled={busy}
                        >
                          <Sparkles size={13} fill="currentColor" strokeWidth={0} /> {busy ? "生成中…" : "AI 生成"}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="col gap-1" style={{ padding: 13 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
                    <div className="faint" style={{ fontSize: 12 }}>{s.mood}</div>
                    {lock && (
                      <div className="row gap-2" style={{ marginTop: 4 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setScenePick({ id: sceneId, name })}
                        >
                          <RefreshCw size={13} /> 换参考
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void genSceneRef(sceneId, s, name)}
                          disabled={busy}
                        >
                          <Sparkles size={13} /> {busy ? "生成中…" : "AI 重生成"}
                        </button>
                      </div>
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
            const a = SCENE_LIB.find((x) => x.id === assetId);
            setSceneLocks((m) => ({
              ...m,
              [scenePick.id]: { name: a?.name ?? scenePick.name, from: a?.from, to: a?.to },
            }));
            setScenePick(null);
            toast.success("已锁定场景参考,跨集一致");
          }}
        />
      )}
    </div>
  );
}
