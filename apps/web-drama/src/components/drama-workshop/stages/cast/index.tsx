"use client";

// 阶段 3 角色与场景 — 角色卡格栅 + 数字人选择器 + 项目级场景设定（v0.88 真后端落库）。
// 设计真源:screens-project.jsx `CastStage` + AI短剧工作台.dc.html「角色与场景设定」。
// v0.88：场景从 ProjectData.scenes（后端）渲染，name/mood 行内可编辑、生成参考图、加/删 —— 全部落库。
import * as React from "react";
import { toast } from "sonner";
import { Image as ImageIcon, ImagePlus, Plus, RefreshCw, Sparkles, Trash2, Users, Wand2 } from "lucide-react";
import { aiErrorMessage } from "@/lib/ai-error";
import { CreditButton, Editable, Thumb } from "@/components/drama-ui";
import { StageHeader } from "../../workbench";
import type { WorkshopAction, WorkshopState } from "../../workbench";
import type { CharacterDef, ProjectData, SceneAsset } from "@/mocks/drama-workshop";
import { addLibraryMaterial } from "@/mocks/drama-workshop";
import { useDramaConfig } from "@/lib/use-drama-config";
import { CharCard } from "./char-card";
import { AvatarPicker } from "./avatar-picker";
import { MediaLightbox, type LightboxMedia } from "../../media-lightbox";
import { AiImageEditModal } from "../../ai-image-edit-modal";
import { ProjectsApi, RenderApi, DramaAssetsApi } from "@/api";
import type { StageContext } from "../stage-context";

interface CastStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  ctx?: StageContext;
  /** v0.87：内嵌进「短剧设定」单页时去掉自己的滚动壳/标题（由 SetupStage 统一提供）。 */
  embedded?: boolean;
}

const SCENE_GRAD: [string, string][] = [
  ["#f59e0b", "#ea580c"], ["#64748b", "#1e293b"], ["#7c3aed", "#2563eb"],
  ["#22d3ee", "#0e7490"], ["#a78bfa", "#6366f1"], ["#fb7185", "#e11d48"],
];

export function CastStage({ state, dispatch, data, ctx, embedded }: CastStageProps) {
  const cfg = useDramaConfig();
  const [drafting, setDrafting] = React.useState(false);
  const [sceneBusy, setSceneBusy] = React.useState<Record<string, boolean>>({});
  const [charBusy, setCharBusy] = React.useState<Record<string, boolean>>({});
  const [lb, setLb] = React.useState<LightboxMedia | null>(null); // 看大图
  const [aiEditScene, setAiEditScene] = React.useState<SceneAsset | null>(null); // 场景 AI 修图
  const [binding, setBinding] = React.useState<CharacterDef | null>(null); // 正在绑定数字人的角色

  const scenes = data.scenes ?? [];
  const unbound = state.chars.filter((c) => c.role === "key" && !c.bound).length;

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

  // 绑定真实数字人（AiAvatar「我的数字人」）：存 avatarId + 展示图到角色，跨集复用形象。
  // 与 uploadCharRef 同惯例（dispatch setChars 落工作台态 + 自动保存）。
  const confirmBind = (charId: string, picked: { id: string; name: string; image: string }) => {
    dispatch({
      type: "setChars",
      chars: state.chars.map((x) =>
        x.id === charId
          ? { ...x, bound: true, avatarId: picked.id, avatarImage: picked.image, refCount: x.refCount ?? 3 }
          : x,
      ),
    });
    setBinding(null);
    toast.success("已绑定数字人，跨集复用形象");
  };

  // ── 角色：加一个（落库经 reducer 的 setChars effect） ──────────────────────────
  const addChar = () => {
    const id = "ch_" + Math.random().toString(36).slice(2, 8);
    dispatch({ type: "setChars", chars: [...state.chars, { id, name: "新角色", role: "extra", cast: "", desc: "", avatar: "a1", bound: false }] });
  };

  // 上传角色真人参考图 → OSS + 落角色 ref + 收进素材库（cat=人物）。
  const uploadCharRef = async (c: CharacterDef, file: File) => {
    if (charBusy[c.id]) return;
    setCharBusy((m) => ({ ...m, [c.id]: true }));
    try {
      const r = await DramaAssetsApi.uploadAssetRef(file, "人物");
      dispatch({
        type: "setChars",
        chars: state.chars.map((x) => (x.id === c.id ? { ...x, refUrl: r.url, refCdnKey: r.cdnKey } : x)),
      });
      addLibraryMaterial({
        id: "asset_" + Math.random().toString(36).slice(2, 10),
        name: `${c.name || "角色"}·参考图`,
        cat: "人物",
        kind: "image",
        from: "#f472b6",
        to: "#fb7185",
        url: r.url,
        cdnKey: r.cdnKey,
        tags: ["角色参考"],
      });
      toast.success("参考图已上传,并加入素材库");
    } catch (e) {
      toast.error(aiErrorMessage(e, "上传失败,请稍后重试"));
    } finally {
      setCharBusy((m) => ({ ...m, [c.id]: false }));
    }
  };

  // ── 场景：全部落库到 ProjectData.scenes ─────────────────────────────────────
  // 函数式合并保存：按最新 scenes 更新，异步出图/上传回写不会被并发保存或陈旧闭包覆盖（修「刷新就没了」）。
  const saveScenes = (updater: (prev: SceneAsset[]) => SceneAsset[]) => {
    if (!ctx) return;
    ctx.notifyEditing?.();
    void ctx.patchData((prev) => ({ ...prev, scenes: updater(prev.scenes ?? []) })).catch(() => {});
  };
  const editScene = (id: string, patch: Partial<SceneAsset>) =>
    saveScenes((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addScene = () =>
    saveScenes((list) => [...list, { id: "scn_" + Math.random().toString(36).slice(2, 8), name: "新场景", mood: "" }]);
  const delScene = (id: string) => saveScenes((list) => list.filter((s) => s.id !== id));
  const genSceneRef = async (s: SceneAsset) => {
    if (!ctx || sceneBusy[s.id]) return;
    setSceneBusy((m) => ({ ...m, [s.id]: true }));
    try {
      const frames = await RenderApi.renderFrame({
        // v0.98：场景参考图用专用 scene 提示词（干净空景 establishing plate，无人物），
        // 传作品风格 + 项目画幅，匹配剧集脚本取景（原来误用 shot 首帧提示词 → 塞人脸/比例不符）。
        kind: "scene",
        vars: {
          place: s.name,
          moodClause: s.mood ? `氛围：${s.mood}。` : "",
          styleSuffix: `${data.projectInfo.type}风格。`,
        },
        ratio: data.projectInfo.ratio,
        count: 1,
      });
      const f = frames[0];
      if (f?.url) {
        editScene(s.id, { refUrl: f.url, refCdnKey: f.cdnKey });
        toast.success("场景参考图已生成");
      } else {
        toast.error("没拿到参考图，请重试");
      }
    } catch (e) {
      toast.error(aiErrorMessage(e, "生成参考图失败，请稍后重试"));
    } finally {
      setSceneBusy((m) => ({ ...m, [s.id]: false }));
    }
  };

  // 上传场景参考图 → OSS + 落场景 ref + 收进素材库（cat=场景）。
  const uploadSceneRef = async (s: SceneAsset, file: File) => {
    if (sceneBusy[s.id]) return;
    setSceneBusy((m) => ({ ...m, [s.id]: true }));
    try {
      const r = await DramaAssetsApi.uploadAssetRef(file, "场景");
      editScene(s.id, { refUrl: r.url, refCdnKey: r.cdnKey });
      addLibraryMaterial({
        id: "asset_" + Math.random().toString(36).slice(2, 10),
        name: `${s.name || "场景"}·参考图`,
        cat: "场景",
        kind: "image",
        from: "#64748b",
        to: "#1e293b",
        url: r.url,
        cdnKey: r.cdnKey,
        tags: ["场景参考"],
      });
      toast.success("场景参考图已上传,并加入素材库");
    } catch (e) {
      toast.error(aiErrorMessage(e, "上传失败,请稍后重试"));
    } finally {
      setSceneBusy((m) => ({ ...m, [s.id]: false }));
    }
  };

  const redraftBtn = (
    <CreditButton
      cost={cfg.prices.cast}
      onConfirm={() => void redraftCast()}
      confirmTitle="重抽角色"
      confirmBody="AI 会按当前大纲重新抽取角色阵容（会替换现有角色列表）。"
      className="btn btn-primary btn-sm"
      disabled={drafting}
    >
      <Wand2 size={15} /> {drafting ? "正在重新抽取…" : "按大纲重新抽取"}
    </CreditButton>
  );

  const inner = (
    <>
        {embedded ? (
          <div className="row gap-2" style={{ alignItems: "center", margin: "26px 0 14px" }}>
            <Users size={15} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-.01em" }}>角色与场景设定</span>
            <span className="faint" style={{ fontSize: 11.5 }}>绑定数字人形象，全剧跨集复用</span>
            <span className="grow" />
            {redraftBtn}
          </div>
        ) : (
        <StageHeader
          no={3}
          scope="项目"
          title="角色与资产"
          desc="为关键角色绑定数字人分身以锁定形象，是跨集一致性与真人脸效果的基础。"
          right={<div className="row gap-2">{redraftBtn}</div>}
        />
        )}

        {unbound > 0 && (
          <div
            className="row gap-3 fade-up"
            style={{ padding: "12px 16px", background: "var(--accent-soft)", borderRadius: 14, marginBottom: 20, color: "var(--accent)" }}
          >
            <Sparkles size={18} fill="currentColor" strokeWidth={0} />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>
              还有 {unbound} 个关键角色未绑定数字人。绑定后角色在每一集的形象保持一致，出场镜头会自动使用数字人出镜。
            </span>
          </div>
        )}

        {/* 角色 */}
        <div className="row gap-2" style={{ alignItems: "center", marginBottom: 10 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flex: "none" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--ink-3)" }}>角色</span>
          <span className="faint" style={{ fontSize: 11 }}>主演阵容 · 绑定数字人跨集复用</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
          {state.chars.map((c, i) => (
            <CharCard
              key={c.id}
              c={c}
              delay={i * 40}
              onBind={() => setBinding(c)}
              onToggleRole={() => dispatch({ type: "toggleRole", charId: c.id })}
              onUploadRef={(f) => void uploadCharRef(c, f)}
              onViewRef={() => c.refUrl && setLb({ src: c.refUrl, kind: "image" })}
              uploading={!!charBusy[c.id]}
            />
          ))}
          <button
            type="button"
            onClick={addChar}
            className="col center"
            style={{ minHeight: 160, borderRadius: "var(--radius-sm)", border: "1.5px dashed var(--line)", background: "var(--surface-2)", cursor: "pointer", color: "var(--ink-3)", gap: 6 }}
          >
            <Plus size={20} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>添加角色</span>
          </button>
        </div>

        {/* 场景 */}
        <div className="row gap-2" style={{ alignItems: "center", margin: "22px 0 10px" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flex: "none" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--ink-3)" }}>场景</span>
          <span className="faint" style={{ fontSize: 11 }}>主要取景地 · 生成时统一风格（点击文字可编辑）</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
          {scenes.map((s, i) => {
            const [from, to] = SCENE_GRAD[i % SCENE_GRAD.length];
            const busy = !!sceneBusy[s.id];
            return (
              <div key={s.id} className="card col" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
                <button
                  type="button"
                  title="删除场景"
                  onClick={() => delScene(s.id)}
                  style={{ position: "absolute", top: 6, right: 6, zIndex: 2, width: 24, height: 24, borderRadius: 7, border: "none", cursor: "pointer", background: "rgba(0,0,0,.42)", color: "#fff", display: "grid", placeItems: "center" }}
                >
                  <Trash2 size={12} />
                </button>
                {s.refUrl ? (
                  <button
                    type="button"
                    onClick={() => setLb({ src: s.refUrl!, kind: "image" })}
                    title="点开看大图"
                    style={{ border: "none", padding: 0, cursor: "zoom-in", display: "block", width: "100%", background: "transparent" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.refUrl} alt={s.name} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                  </button>
                ) : busy ? (
                  <div className="skel" style={{ width: "100%", aspectRatio: "16/9" }} />
                ) : (
                  <Thumb from={from} to={to} ratio="16/9" radius={0} stripes style={{ width: "100%" }} />
                )}
                <div className="col gap-2" style={{ padding: 13 }}>
                  <Editable value={s.name} onCommit={(v) => editScene(s.id, { name: v })} style={{ fontWeight: 800, fontSize: 13.5 }} />
                  <Editable value={s.mood} placeholder="氛围基调…" onCommit={(v) => editScene(s.id, { mood: v })} style={{ fontSize: 12, color: "var(--ink-3)" }} />
                  {s.refUrl ? (
                    <div className="row gap-2">
                      <button
                        type="button"
                        className="btn btn-grad btn-sm grow"
                        style={{ justifyContent: "center" }}
                        onClick={() => setAiEditScene(s)}
                      >
                        <Wand2 size={13} /> AI 修图
                      </button>
                      <button type="button" className="btn btn-line btn-sm btn-icon" title="重新生成" disabled={busy} onClick={() => void genSceneRef(s)}>
                        <RefreshCw size={14} />
                      </button>
                      <label className="btn btn-line btn-sm btn-icon" title="上传参考图" style={{ cursor: busy ? "default" : "pointer" }}>
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          disabled={busy}
                          onChange={(e) => {
                            const f = e.currentTarget.files?.[0];
                            e.currentTarget.value = "";
                            if (f) void uploadSceneRef(s, f);
                          }}
                        />
                        <ImagePlus size={14} />
                      </label>
                    </div>
                  ) : (
                    <div className="row gap-2">
                      <button
                        type="button"
                        className="btn btn-line btn-sm grow"
                        style={{ justifyContent: "center" }}
                        disabled={busy}
                        onClick={() => void genSceneRef(s)}
                      >
                        {busy ? "生成中…" : (<><ImageIcon size={13} /> 生成参考图</>)}
                      </button>
                      <label className="btn btn-line btn-sm btn-icon" title="上传参考图" style={{ cursor: busy ? "default" : "pointer" }}>
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          disabled={busy}
                          onChange={(e) => {
                            const f = e.currentTarget.files?.[0];
                            e.currentTarget.value = "";
                            if (f) void uploadSceneRef(s, f);
                          }}
                        />
                        <ImagePlus size={14} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addScene}
            className="col center"
            style={{ minHeight: 160, borderRadius: "var(--radius-sm)", border: "1.5px dashed var(--line)", background: "var(--surface-2)", cursor: "pointer", color: "var(--ink-3)", gap: 6 }}
          >
            <ImagePlus size={20} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>加场景</span>
          </button>
        </div>
    </>
  );
  return (
    <>
      {embedded ? (
        inner
      ) : (
        <div className="scroll" style={{ height: "100%" }}>
          <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 32px 64px" }}>
            {inner}
          </div>
        </div>
      )}

      {binding && (
        <AvatarPicker char={binding} onClose={() => setBinding(null)} onConfirm={confirmBind} />
      )}

      {aiEditScene && (
        <AiImageEditModal
          tag="场景"
          openingText={`这是「${aiEditScene.name || "场景"}」的参考图。想怎么改？比如「换成夜景」「冷色调」「加点雾气」。`}
          baseDesc={`${aiEditScene.name}${aiEditScene.mood ? "，" + aiEditScene.mood : ""}，场景空镜参考图`}
          sceneName={aiEditScene.name}
          initialUrl={aiEditScene.refUrl}
          ratio="16:9"
          chips={["换成夜景", "冷色调", "加点雾气", "更明亮", "换个机位"]}
          onClose={() => setAiEditScene(null)}
          onCommit={(f) => editScene(aiEditScene.id, { refUrl: f.url, refCdnKey: f.cdnKey })}
        />
      )}
      <MediaLightbox media={lb} onClose={() => setLb(null)} />
    </>
  );
}
