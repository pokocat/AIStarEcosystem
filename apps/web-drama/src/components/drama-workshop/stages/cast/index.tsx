"use client";

// 短剧设定 · 角色与场景 — 角色卡格栅 + 数字人选择器 + 项目级场景设定（v0.88 真后端落库）。
// v0.197：只作为「短剧设定」单页的一块（独立阶段页已退役）；会覆盖已有内容 / 扣积分的操作一律先确认。
// 设计真源:screens-project.jsx `CastStage` + AI短剧工作台.dc.html「角色与场景设定」。
// v0.88：场景从 ProjectData.scenes（后端）渲染，name/mood 行内可编辑、生成参考图、加/删 —— 全部落库。
import * as React from "react";
import { toast } from "sonner";
import { Image as ImageIcon, ImagePlus, Plus, RefreshCw, Sparkles, Trash2, Users, Wand2 } from "lucide-react";
import { aiErrorMessage } from "@/lib/ai-error";
import { CreditButton, Editable, GenFramePlaceholder, dramaConfirm } from "@/components/drama-ui";
import { acquireActionLock, useActionLock } from "@/components/drama-ui/action-lock";
import { dispatchToWorkbench } from "../../workbench/live-dispatch";
import type { WorkshopAction, WorkshopState } from "../../workbench";
import type { CharacterDef, ProjectData, SceneAsset } from "@/mocks/drama-workshop";
import { addLibraryMaterial } from "@/mocks/drama-workshop";
import { useDramaConfig } from "@/lib/use-drama-config";
import { CharCard } from "./char-card";
import { AvatarPicker, bindAvatarToChars } from "./avatar-picker";
import { MediaLightbox, type LightboxMedia } from "../../media-lightbox";
import { AiImageEditModal } from "../../ai-image-edit-modal";
import { ProjectsApi, RenderApi, DramaAssetsApi } from "@/api";
import type { StageContext } from "../stage-context";

interface CastStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  ctx?: StageContext;
}

// 场景名常写成「地点：环境 + 人物动作」（如「深夜办公室：凌乱的桌面…只有林萧一人对着电脑发呆」）。
// 场景参考图要「空镜无人」，故出图前只取地点 + 环境从句，剔除含角色名或「人/独自」的从句，避免出人。
function scenePlaceForGen(name: string, charNames: string[]): string {
  const [locPart, ...restParts] = (name || "").split(/[：:]/);
  const location = (locPart || name || "").trim();
  const envClauses = restParts
    .join("：")
    .split(/[，,。;；、]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .filter((c) => !charNames.some((n) => c.includes(n)) && !/[人独]/.test(c));
  return [location, ...envClauses].filter(Boolean).join("，");
}

/**
 * 「角色与场景」这一块的锚点。别处 jump 到 "cast"（如分镜表「还没有场景图 · 去添加」）时，
 * 设定页（setup.tsx）按它滚过来 —— 否则只是切回设定页顶部，用户还得自己往下找。
 */
export const CAST_SECTION_ID = "wb-cast-section";

// 扣积分按钮的跨实例在途锁 key（action-lock.ts 约定 `<动作>:<对象 id>`）。
// 生成中切去逐集制作再切回来，本组件是新实例、busy state 全是空的，不传 lockKey 就能再点一次、再扣一份。
export const castDraftLockKey = (projectId: string) => `cast-draft:${projectId}`;
/**
 * 「按大纲重新生成角色」请求在途期间占住的锁（只在确认之后、请求期间持有）。
 * 按钮的 lockKey 从点击就占着、确认框开着时也算，拿它显示「正在生成」会在确认框还没点时就变字、变禁用。
 */
export const castDraftRequestKey = (projectId: string) => `cast-draft-request:${projectId}`;
export const charRefLockKey = (projectId: string, charId: string) => `char-ref:${projectId}:${charId}`;
export const charSheetLockKey = (projectId: string, charId: string) => `char-sheet:${projectId}:${charId}`;
export const sceneRefLockKey = (projectId: string, sceneId: string) => `scene-ref:${projectId}:${sceneId}`;

/** 在最新文档的角色表里只改一个角色（找不到就原样返回）。 */
export function patchCharInDoc(prev: ProjectData, charId: string, patch: Partial<CharacterDef>): ProjectData {
  const list = prev.characters ?? [];
  if (!list.some((c) => c.id === charId)) return prev;
  return { ...prev, characters: list.map((c) => (c.id === charId ? { ...c, ...patch } : c)) };
}

export function CastStage({ state, dispatch, data, ctx }: CastStageProps) {
  const cfg = useDramaConfig();
  const [drafting, setDrafting] = React.useState(false);
  const [sceneBusy, setSceneBusy] = React.useState<Record<string, boolean>>({});
  const [charBusy, setCharBusy] = React.useState<Record<string, boolean>>({});
  const [sheetBusy, setSheetBusy] = React.useState<Record<string, boolean>>({}); // C-2 三视图生成中
  const [lb, setLb] = React.useState<LightboxMedia | null>(null); // 看大图
  const [aiEditScene, setAiEditScene] = React.useState<SceneAsset | null>(null); // 场景 AI 改图
  const [binding, setBinding] = React.useState<CharacterDef | null>(null); // 正在绑定数字人的角色

  const draftLockKey = ctx ? castDraftLockKey(ctx.projectId) : undefined;
  // 生成中切走再切回来（新实例，drafting 是 false）：上一个实例的请求还在跑，照样显示「正在生成」。
  const draftRunning = useActionLock(ctx ? castDraftRequestKey(ctx.projectId) : null);
  const redrafting = drafting || draftRunning;

  const scenes = data.scenes ?? [];
  // 「没定长相」= 既没绑数字人、也没有定妆照 / 多角度参考图（之前只看数字人，传了照片也照样提示）。
  const unbound = state.chars.filter(
    (c) => c.role === "key" && !c.bound && !c.refUrl && !(c.refImages?.length),
  ).length;

  /**
   * 要等几秒才回来的结果：发给现在挂着的工作台（不一定是发起时那个，见 live-dispatch.ts），并直接按最新文档落库。
   * 只 dispatch 不够 —— 结果回来时用户可能已经离开工作台，reducer 和角色自动保存都已卸载，花了积分的结果就丢了
   *（这几个接口都不写项目文档，结果只在返回值里）。ctx.patchData 按保存那一刻的最新文档合并（doc-store.ts），
   * 只换这一个角色的这几个字段，不会盖掉别的；工作台还在时角色表的自动保存随后再存一次同样的内容，无害。
   */
  const toWorkbench = (action: WorkshopAction) => dispatchToWorkbench(ctx?.projectId, action, dispatch);
  const persistCharPatch = (charId: string, patch: Partial<CharacterDef>) => {
    toWorkbench({ type: "patchChar", charId, patch });
    void ctx?.patchData((prev) => patchCharInDoc(prev, charId, patch)).catch(() => {
      /* saveData 已提示「保存失败」 */
    });
  };

  /** 真实 AI 重抽角色阵容 → 更新工作台 + 落库。 */
  const redraftCast = async () => {
    if (drafting || !ctx) return;
    const release = acquireActionLock(castDraftRequestKey(ctx.projectId));
    if (!release) return; // 上一个实例发的请求还没回来
    setDrafting(true);
    try {
      let chars: CharacterDef[];
      try {
        chars = await ProjectsApi.castAiDraft(ctx.projectId);
      } catch (e) {
        toast.error(aiErrorMessage(e, "角色没生成出来，请稍后重试"));
        return;
      }
      toWorkbench({ type: "setChars", chars });
      // 直接落库，不只靠角色表的自动保存：生成要等几秒，结果回来时用户可能已经回到短剧列表，
      // 那时 reducer 和自动保存都卸载了，dispatch 落空、这次扣的积分白花（castAiDraft 只扣费不写文档）。
      // patchData 按最新文档合并、只换 characters，生成期间写进来的分集剧情 / 场景图不会被盖掉。
      try {
        await ctx.patchData((prev) => ({ ...prev, characters: chars }));
      } catch {
        // saveData 已提示「保存失败」；角色已经换到工作台上，角色表的自动保存稍后会再存一次。
        return;
      }
      toast.success(`已按大纲重新生成 ${chars.length} 个角色`);
    } finally {
      release();
      setDrafting(false);
    }
  };

  // 绑定真实数字人（AiAvatar「我的数字人」）：存 avatarId + 展示图到角色，每一集都用这张脸。
  // 与角色面板共用 bindAvatarToChars（dispatch setChars 落工作台态 + 自动保存）。
  const confirmBind = (charId: string, picked: { id: string; name: string; image: string }) => {
    dispatch({ type: "setChars", chars: bindAvatarToChars(state.chars, charId, picked) });
    setBinding(null);
    toast.success("已绑定，之后每一集都用这个数字人");
  };

  // 主要角色 ⇄ 配角：主要角色改成配角会解绑数字人（reducer 里的规则），先说清楚。
  const toggleRole = async (c: CharacterDef) => {
    if (c.role === "key" && c.bound) {
      const ok = await dramaConfirm({
        title: `把「${c.name}」改成配角？`,
        body: "配角不绑数字人，改完会解绑现在这个数字人，定妆照和多角度参考图会留着。",
        confirmLabel: "改成配角",
        cancelLabel: "先不改",
      });
      if (!ok) return;
    }
    dispatch({ type: "toggleRole", charId: c.id });
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
      // 按最新角色表只改这一个角色（上传期间改过别的角色不会被盖掉），并直接落库（见 persistCharPatch）。
      persistCharPatch(c.id, { refUrl: r.url, refCdnKey: r.cdnKey });
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
      toast.success("定妆照已上传，也存进了素材库");
    } catch (e) {
      toast.error(aiErrorMessage(e, "上传失败，请稍后重试"));
    } finally {
      setCharBusy((m) => ({ ...m, [c.id]: false }));
    }
  };

  // AI 生成角色定妆参考图（锁脸用）：专用 character 提示词（单人肖像）+ 项目画幅/风格，落角色 refUrl。
  const genCharRef = async (c: CharacterDef) => {
    if (charBusy[c.id]) return;
    setCharBusy((m) => ({ ...m, [c.id]: true }));
    try {
      const { frames } = await RenderApi.renderFrame({
        kind: "character",
        vars: {
          name: c.name,
          descClause: c.desc ? `外貌/设定：${c.desc}。` : "",
          styleSuffix: `${data.projectInfo.type}风格。`,
        },
        ratio: data.projectInfo.ratio,
        count: 1,
      });
      const f = frames[0];
      if (f?.url) {
        persistCharPatch(c.id, { refUrl: f.url, refCdnKey: f.cdnKey });
        toast.success("定妆照画好了");
      } else {
        toast.error("定妆照没生成出来，请重试");
      }
    } catch (e) {
      toast.error(aiErrorMessage(e, "定妆照没生成出来，请稍后重试"));
    } finally {
      setCharBusy((m) => ({ ...m, [c.id]: false }));
    }
  };

  // C-2：一键生成 正/侧/全身 三视图参考图集（后端 hold→逐角度 commit，产物落实体表）。
  // 与 genCharRef 同惯例：persistCharPatch 落工作台态 + 直接按最新文档落库（refImages round-trip）。
  const genSheet = async (c: CharacterDef) => {
    if (!ctx || sheetBusy[c.id]) return;
    setSheetBusy((m) => ({ ...m, [c.id]: true }));
    try {
      const res = await ProjectsApi.generateReferenceSheet(ctx.projectId, c.id, {
        ratio: data.projectInfo.ratio,
        appearanceHint: c.desc || undefined,
      });
      persistCharPatch(c.id, { refImages: res.refImages });
      toast.success(`多角度参考图生成好了，共 ${res.refImages.length} 张`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "多角度参考图没生成出来，请稍后重试"));
    } finally {
      setSheetBusy((m) => ({ ...m, [c.id]: false }));
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
  const delScene = async (s: SceneAsset) => {
    // 有场景图时删掉会一起丢，先确认；空场景直接删。
    if (s.refUrl) {
      const ok = await dramaConfirm({
        title: `删除「${s.name || "这个场景"}」？`,
        body: "场景图会一起删掉。素材库里存过的那张还在。",
        confirmLabel: "删除",
        cancelLabel: "先保留",
        tone: "danger",
      });
      if (!ok) return;
    }
    saveScenes((list) => list.filter((x) => x.id !== s.id));
  };
  const genSceneRef = async (s: SceneAsset) => {
    if (!ctx || sceneBusy[s.id]) return;
    setSceneBusy((m) => ({ ...m, [s.id]: true }));
    try {
      const { frames } = await RenderApi.renderFrame({
        // v0.98：场景参考图用专用 scene 提示词（干净空景 establishing plate，无人物），
        // 传作品风格 + 项目画幅，匹配剧集脚本取景（原来误用 shot 首帧提示词 → 塞人脸/比例不符）。
        kind: "scene",
        vars: {
          // 只取地点+环境、剔除人物动作从句 → 空镜无人（详见 scenePlaceForGen）。
          place: scenePlaceForGen(s.name, data.characters.map((c) => c.name).filter((n) => n && n.length >= 2)),
          moodClause: s.mood ? `氛围：${s.mood}。` : "",
          styleSuffix: `${data.projectInfo.type}风格。`,
        },
        ratio: data.projectInfo.ratio,
        count: 1,
      });
      const f = frames[0];
      if (f?.url) {
        editScene(s.id, { refUrl: f.url, refCdnKey: f.cdnKey });
        toast.success("场景图生成好了");
      } else {
        toast.error("场景图没生成出来，请重试");
      }
    } catch (e) {
      toast.error(aiErrorMessage(e, "场景图没生成出来，请稍后重试"));
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
        name: `${s.name || "场景"}·场景图`,
        cat: "场景",
        kind: "image",
        from: "#64748b",
        to: "#1e293b",
        url: r.url,
        cdnKey: r.cdnKey,
        tags: ["场景参考"],
      });
      toast.success("场景图已上传，也存进了素材库");
    } catch (e) {
      toast.error(aiErrorMessage(e, "上传失败，请稍后重试"));
    } finally {
      setSceneBusy((m) => ({ ...m, [s.id]: false }));
    }
  };

  const charCount = state.chars.length;
  const boundCount = state.chars.filter((c) => c.bound).length;
  const redraftBtn = (
    <CreditButton
      cost={cfg.prices.cast}
      alwaysConfirm
      onConfirm={() => redraftCast()}
      confirmTitle="按大纲重新生成角色？"
      confirmBody={
        charCount > 0
          ? `AI 按现在的故事大纲重新列一遍角色。现有 ${charCount} 个角色会被替换${
              boundCount > 0 ? `，已绑定的 ${boundCount} 个数字人` : ""
            }、定妆照和多角度参考图都会清掉。已花的积分不退。`
          : "AI 按现在的故事大纲列出主要角色和配角。"
      }
      confirmLabel={charCount > 0 ? "替换角色" : "开始生成"}
      className="btn btn-primary btn-sm"
      disabled={redrafting || !ctx}
      lockKey={draftLockKey}
      data-testid="cast-redraft"
      style={{ flex: "none" }}
    >
      <Wand2 size={15} /> {redrafting ? "正在生成角色…" : "按大纲重新生成角色"}
    </CreditButton>
  );

  const replaceSceneInput = (s: SceneAsset, busy: boolean) => (
    <label className="btn btn-line btn-sm btn-icon" title="上传场景图" aria-label="上传场景图" style={{ cursor: busy ? "default" : "pointer", flex: "none" }}>
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
  );

  return (
    <>
      <div id={CAST_SECTION_ID} className="row gap-2" style={{ alignItems: "center", margin: "26px 0 14px", flexWrap: "wrap", scrollMarginTop: 16 }}>
        <Users size={15} style={{ color: "var(--accent)", flex: "none" }} />
        <span style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-.01em" }}>角色与场景</span>
        <span className="faint" style={{ fontSize: 11.5, minWidth: 0 }}>长相定好，每一集都照这个出</span>
        <span className="grow" />
        {redraftBtn}
      </div>

      {unbound > 0 && (
        <div
          className="row gap-3 fade-up"
          style={{ padding: "12px 16px", background: "var(--accent-soft)", borderRadius: 14, marginBottom: 20, color: "var(--accent)", alignItems: "flex-start" }}
        >
          <Sparkles size={18} fill="currentColor" strokeWidth={0} style={{ flex: "none", marginTop: 1 }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0 }}>
            还有 {unbound} 个主要角色没固定长相。绑一个数字人，或者上传照片、让 AI 画一张定妆照，每一集出来才是同一张脸。
          </span>
        </div>
      )}

      {/* 角色 */}
      <div className="row gap-2" style={{ alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flex: "none" }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--ink-3)" }}>角色</span>
        <span className="faint" style={{ fontSize: 11, minWidth: 0 }}>
          有数字人就绑数字人；没有就上传照片或让 AI 画定妆照；想让每个镜头更稳，再生成多角度参考图。配角写一句长相描述就行
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(280px,100%),1fr))", gap: 18 }}>
        {state.chars.map((c, i) => (
          <CharCard
            key={c.id}
            c={c}
            delay={i * 40}
            onBind={() => setBinding(c)}
            onToggleRole={() => void toggleRole(c)}
            onUploadRef={(f) => void uploadCharRef(c, f)}
            onGenRef={() => genCharRef(c)}
            refCost={cfg.prices.frame}
            onViewRef={() => c.refUrl && setLb({ src: c.refUrl, kind: "image" })}
            uploading={!!charBusy[c.id]}
            onGenSheet={ctx ? () => genSheet(c) : undefined}
            sheetCost={cfg.prices.frame * 3}
            sheetBusy={!!sheetBusy[c.id]}
            refLockKey={ctx ? charRefLockKey(ctx.projectId, c.id) : undefined}
            sheetLockKey={ctx ? charSheetLockKey(ctx.projectId, c.id) : undefined}
            onViewImage={(url) => setLb({ src: url, kind: "image" })}
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
      <div className="row gap-2" style={{ alignItems: "center", margin: "22px 0 10px", flexWrap: "wrap" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flex: "none" }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--ink-3)" }}>场景</span>
        <span className="faint" style={{ fontSize: 11, minWidth: 0 }}>常用的拍摄地点，所有集通用，点文字可以改</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(220px,100%),1fr))", gap: 14 }}>
        {scenes.map((s) => {
          const busy = !!sceneBusy[s.id];
          return (
            <div key={s.id} className="card col" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
              <button
                type="button"
                title="删除场景"
                aria-label="删除场景"
                className="wb-scene-del"
                onClick={() => void delScene(s)}
                style={{ position: "absolute", top: 6, right: 6, zIndex: 2, width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(0,0,0,.42)", color: "#fff", display: "grid", placeItems: "center" }}
              >
                <Trash2 size={13} />
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
                <div style={{ width: "100%", aspectRatio: "16/9" }}>
                  <GenFramePlaceholder width="100%" height="100%" radius={0} />
                </div>
              ) : (
                <div className="col center" style={{ width: "100%", aspectRatio: "16/9", background: "var(--surface-2)", border: "1.5px dashed var(--line)", color: "var(--ink-3)", gap: 7 }}>
                  <ImageIcon size={22} />
                  <span style={{ fontSize: 11.5, fontWeight: 600 }}>还没有场景图</span>
                  <span className="faint" style={{ fontSize: 10 }}>可以生成一张，或者上传照片</span>
                </div>
              )}
              <div className="col gap-2" style={{ padding: 13 }}>
                <Editable value={s.name} onCommit={(v) => editScene(s.id, { name: v })} style={{ fontWeight: 800, fontSize: 13.5 }} />
                <Editable value={s.mood} placeholder="氛围，比如：压抑、冷清" onCommit={(v) => editScene(s.id, { mood: v })} style={{ fontSize: 12, color: "var(--ink-3)" }} />
                {s.refUrl ? (
                  <div className="row gap-2">
                    <button
                      type="button"
                      className="btn btn-grad btn-sm grow"
                      style={{ justifyContent: "center" }}
                      onClick={() => setAiEditScene(s)}
                    >
                      <Wand2 size={13} /> AI 改图
                    </button>
                    <CreditButton
                      cost={cfg.prices.frame}
                      lockKey={ctx ? sceneRefLockKey(ctx.projectId, s.id) : undefined}
                      alwaysConfirm
                      onConfirm={() => genSceneRef(s)}
                      confirmTitle="重新生成场景图？"
                      confirmBody="现在这张场景图会被换掉，已花的积分不退。"
                      confirmLabel="重新生成"
                      className="btn btn-line btn-sm"
                      title="重新生成场景图（扣积分）"
                      aria-label="重新生成场景图"
                      disabled={busy}
                      markSize={11}
                      style={{ flex: "none" }}
                    >
                      <RefreshCw size={14} />
                    </CreditButton>
                    {replaceSceneInput(s, busy)}
                  </div>
                ) : (
                  <div className="row gap-2">
                    <CreditButton
                      cost={cfg.prices.frame}
                      lockKey={ctx ? sceneRefLockKey(ctx.projectId, s.id) : undefined}
                      onConfirm={() => genSceneRef(s)}
                      confirmTitle="生成场景图"
                      confirmBody="AI 按场景名和氛围画一张没有人物的空景图，出分镜时参考它。"
                      className="btn btn-line btn-sm grow"
                      style={{ justifyContent: "center" }}
                      disabled={busy || !ctx}
                      mark={!busy}
                    >
                      {busy ? "生成中…" : (<><ImageIcon size={13} /> 生成场景图</>)}
                    </CreditButton>
                    {replaceSceneInput(s, busy)}
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
          <span style={{ fontSize: 12, fontWeight: 600 }}>添加场景</span>
        </button>
      </div>

      {binding && (
        <AvatarPicker char={binding} onClose={() => setBinding(null)} onConfirm={confirmBind} />
      )}

      {aiEditScene && (
        <AiImageEditModal
          kind="scene"
          tag="场景"
          openingText={`这是「${aiEditScene.name || "场景"}」的场景图。想怎么改？比如「换成夜景」「冷色调」「加点雾气」。`}
          baseDesc={`${aiEditScene.name}${aiEditScene.mood ? "，" + aiEditScene.mood : ""}，场景空镜参考图`}
          sceneName={aiEditScene.name}
          initialUrl={aiEditScene.refUrl}
          ratio="16:9"
          cost={cfg.prices.frame}
          chips={["换成夜景", "冷色调", "加点雾气", "更明亮", "换个机位"]}
          onClose={() => setAiEditScene(null)}
          onCommit={(f) => editScene(aiEditScene.id, { refUrl: f.url, refCdnKey: f.cdnKey })}
        />
      )}
      <MediaLightbox media={lb} onClose={() => setLb(null)} />
    </>
  );
}
