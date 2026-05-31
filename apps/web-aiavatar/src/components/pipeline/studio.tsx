"use client";
// ============================================================
// 精细化精调（STEP 05）— 两种模式：
//   A. 五官微调（tune）= MediaPipe 478 关键点 + 网格液化形变（client，确定性、实时；face-warp.ts）
//      + 外观编辑（妆容/发型/肤质/服饰，异步任务）+ 自然语言 + 局部重绘 + 前后对比 + 三布局。
//   B. 模版套用（template）= 美颜/美化模板（真实 canvas beauty，实时预览即时套用）
//      + 风格/妆造模板（职业妆/古风…样片 → img2img 图生图，异步任务）。
//   编辑能力集中在本步；下一步「分视角出图」只按标准构图出图、不做编辑。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { Btn, IconBtn, Portrait, Seg, StatusPill, Tag } from "@/components/ui/primitives";
import { Icons, type IconComponent } from "@/components/ui/icons";
import { usePolling } from "@/lib/hooks";
import { refineAppearance, refineRegion, commitGeometryRefine, commitBeautyRefine } from "@/api/ai-avatar";
import { GEO_PARAMS, type GeoParamDef, APPEARANCE_EDITS, CAPABILITY_ENGINE, CAPABILITY_KIND, CAPABILITY_LABEL, styleHue, BEAUTY_TEMPLATES, STYLE_LOOK_TEMPLATES, combineBeauty } from "@/constants/aiavatar-ui";
import { fmtDateTime } from "@/lib/format";
import { toast } from "@/components/ui/toast";
import { warpImageToDataUrl, heuristicAnchors, isNeutral, NEUTRAL, type FaceAnchors, type FaceSliders } from "@/lib/face-warp";
import { beautifyToDataUrl } from "@/lib/beauty";
import { detectFaceAnchors, warmupLandmarker, type LM } from "@/lib/face-landmarks";

type Tool = "move" | "geo" | "region" | "compare";
type Layout = "split" | "island" | "tri";
type Mode = "tune" | "template";

const WARP_SIDE = 512;

function paramsToSliders(params: GeoParamDef[]): FaceSliders {
  const s: FaceSliders = { ...NEUTRAL };
  for (const p of params) if (p.sliderKey) s[p.sliderKey] = (p.v - 50) * 2;
  return s;
}

export function StudioStep({ detail, reload }: { detail: AiAvatarDetail; reload: () => void }) {
  const router = useRouter();
  const { avatar } = detail;
  const [params, setParams] = React.useState<GeoParamDef[]>(GEO_PARAMS.map((p) => ({ ...p })));
  const [tool, setTool] = React.useState<Tool>("geo");
  const [layout, setLayout] = React.useState<Layout>("split");
  const [mode, setMode] = React.useState<Mode>("tune");
  const [info, setInfo] = React.useState(false);
  const [activeVer, setActiveVer] = React.useState(detail.versions[0]?.id ?? "");

  // 模版套用模式状态
  const [selBeauty, setSelBeauty] = React.useState<string[]>([]);
  const [selStyle, setSelStyle] = React.useState<string | null>(null);
  const [tplPreview, setTplPreview] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);

  // 真实形变状态
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const [anchors, setAnchors] = React.useState<FaceAnchors | null>(null);
  const [landmarks, setLandmarks] = React.useState<LM[]>([]);
  const [engine, setEngine] = React.useState<{ name: string; count: number }>({ name: "heuristic-center", count: 0 });
  const [warpedUrl, setWarpedUrl] = React.useState<string | null>(avatar.coverUrl ?? null);
  const [saving, setSaving] = React.useState(false);

  const refineRunning = detail.recentJobs.some((j) => (j.input as { kind?: string } | null)?.kind === "refine" && (j.status === "running" || j.status === "queued"));
  usePolling(reload, 700, refineRunning);

  // 加载封面图 + 检测关键点
  React.useEffect(() => {
    warmupLandmarker();
    if (!avatar.coverUrl) return;
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      setImg(im);
      // 关键：检测尺寸必须与 warpImageToDataUrl 内部「按长边缩放到 WARP_SIDE」一致，
      // 否则锚点落在不同像素空间，竖图形变会整体错位（「不准」的根因之一）。
      const scale = Math.min(1, WARP_SIDE / Math.max(im.naturalWidth, im.naturalHeight));
      const w = Math.max(1, Math.round(im.naturalWidth * scale));
      const h = Math.max(1, Math.round(im.naturalHeight * scale));
      detectFaceAnchors(im, w, h)
        .then((r) => {
          setAnchors(r.anchors);
          setLandmarks(r.landmarks);
          setEngine({ name: "mediapipe-facemesh-478", count: r.landmarks.length });
        })
        .catch(() => {
          setAnchors(heuristicAnchors(w, h));
          setEngine({ name: "heuristic-center", count: 0 });
        });
    };
    im.src = avatar.coverUrl;
  }, [avatar.coverUrl]);

  // 滑块变化 → 实时形变（debounce）
  const sliders = React.useMemo(() => paramsToSliders(params), [params]);
  React.useEffect(() => {
    if (!img) return;
    if (isNeutral(sliders)) {
      setWarpedUrl(avatar.coverUrl ?? null);
      return;
    }
    const id = window.setTimeout(async () => {
      try {
        const url = await warpImageToDataUrl(img, sliders, WARP_SIDE, anchors ?? undefined);
        setWarpedUrl(url);
      } catch {
        /* 形变失败保持原图 */
      }
    }, 110);
    return () => window.clearTimeout(id);
  }, [sliders, img, anchors, avatar.coverUrl]);

  const resetGeo = () => setParams((ps) => ps.map((p) => ({ ...p, v: 50 })));

  const applyAppearance = async (capability: Parameters<typeof refineAppearance>[1], label: string) => {
    try {
      await refineAppearance(avatar.id, capability, { note: label });
      reload();
      toast(`已提交「${label}」生成任务`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "提交失败", { icon: "!", tone: "var(--err)" });
    }
  };
  const applyNL = async (text: string) => {
    try {
      await refineAppearance(avatar.id, "img2img", { prompt: text, note: text });
      reload();
      toast(`已提交整体微调：${text}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "提交失败", { icon: "!", tone: "var(--err)" });
    }
  };
  const applyRegion = async () => {
    try {
      await refineRegion(avatar.id, { prompt: "服饰区域重绘" });
      reload();
      toast("已提交局部重绘任务");
    } catch (e) {
      toast(e instanceof Error ? e.message : "提交失败", { icon: "!", tone: "var(--err)" });
    }
  };

  const saveSnapshot = async () => {
    if (!warpedUrl) return;
    setSaving(true);
    try {
      await commitGeometryRefine(
        avatar.id,
        warpedUrl,
        { ...sliders, landmarkEngine: engine.name, landmarkCount: engine.count },
        isNeutral(sliders) ? "保存当前版本" : "几何微调快照",
      );
      reload();
      resetGeo();
      toast("已保存为新版本快照");
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setSaving(false);
    }
  };

  const compare = tool === "compare";
  const hue = styleHue(avatar.styleCategory);

  // 模版套用：美颜模板实时预览（客户端 beauty）。
  React.useEffect(() => {
    if (mode !== "template" || !img) return;
    if (selBeauty.length === 0) {
      setTplPreview(null);
      return;
    }
    const id = window.setTimeout(async () => {
      try {
        setTplPreview(await beautifyToDataUrl(img, combineBeauty(selBeauty)));
      } catch {
        /* keep */
      }
    }, 90);
    return () => window.clearTimeout(id);
  }, [mode, selBeauty, img]);

  const applyBeautyTemplates = async () => {
    if (!img || selBeauty.length === 0) return;
    setApplying(true);
    try {
      const url = tplPreview ?? (await beautifyToDataUrl(img, combineBeauty(selBeauty)));
      const names = BEAUTY_TEMPLATES.filter((b) => selBeauty.includes(b.id)).map((b) => b.name).join(" + ");
      await commitBeautyRefine(avatar.id, url, { templateIds: selBeauty, ...combineBeauty(selBeauty) }, names, "精调 · 美颜模版");
      setSelBeauty([]);
      setTplPreview(null);
      reload();
      toast(`已套用美颜模版：${names}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "套用失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setApplying(false);
    }
  };

  const applyStyleTemplate = async () => {
    if (!selStyle) return;
    const tpl = STYLE_LOOK_TEMPLATES.find((t) => t.id === selStyle);
    if (!tpl) return;
    try {
      await refineAppearance(avatar.id, "img2img", { prompt: tpl.prompt, note: tpl.name });
      setSelStyle(null);
      reload();
      toast(`已提交「${tpl.name}」图生图任务`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "提交失败", { icon: "!", tone: "var(--err)" });
    }
  };

  const topbar = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: "1px solid var(--line)", background: "var(--bg-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push(`/avatars/${avatar.id}/drafting`)} style={{ background: "none", border: "none", color: "var(--ink-2)", cursor: "pointer", display: "flex" }}><Icons.back size={18} /></button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>精细化精调</div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)" }}>{avatar.name} · {avatar.id} · {detail.versions[0]?.label ?? "v"}</div>
        </div>
        <span style={{ marginLeft: 6 }}><StatusPill status="refining" /></span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Seg<Mode> size="sm" value={mode} onChange={setMode} options={[{ value: "tune", label: "五官微调" }, { value: "template", label: "模版套用" }]} />
        {mode === "tune" && (
          <>
            <IconBtn icon={Icons.doc} size={36} active={info} title="实现方式" onClick={() => setInfo((v) => !v)} />
            <span style={{ fontSize: 11.5, color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}>布局</span>
            <Seg<Layout> size="sm" value={layout} onChange={setLayout} options={[{ value: "split", label: "双栏" }, { value: "island", label: "工具岛" }, { value: "tri", label: "三栏" }]} />
          </>
        )}
        <Btn variant="pri" size="sm" iconR={Icons.arrowR} onClick={() => router.push(`/avatars/${avatar.id}/output`)}>进入分视角出图</Btn>
      </div>
    </div>
  );

  const canvas = <Canvas hue={hue} tool={tool} compare={compare} busy={refineRunning} warpedUrl={warpedUrl} beforeUrl={avatar.coverUrl ?? null} landmarks={landmarks} engine={engine} avatarLabel={`${avatar.id} · ${detail.versions[0]?.label ?? "v"}`} />;
  const right = <RightControls params={params} setParams={setParams} apply={applyAppearance} applyNL={applyNL} applyRegion={applyRegion} busy={refineRunning} resetGeo={resetGeo} onSave={saveSnapshot} saving={saving} engine={engine} />;

  let body: React.ReactNode;
  if (layout === "split") {
    body = (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", flex: 1, minHeight: 0 }}>
        <div style={{ padding: 24, position: "relative" }}>
          <div style={{ position: "absolute", top: 20, left: 20, zIndex: 5 }}><ToolGroup tool={tool} setTool={setTool} vertical /></div>
          {canvas}
        </div>
        {right}
      </div>
    );
  } else if (layout === "island") {
    body = (
      <div style={{ flex: 1, position: "relative", padding: 24, minHeight: 0 }}>
        {canvas}
        <div style={{ position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, padding: 8, background: "var(--bg-glass)", backdropFilter: "blur(14px)", border: "1px solid var(--line-2)", borderRadius: 14, boxShadow: "var(--shadow-2)" }}>
          <ToolGroup tool={tool} setTool={setTool} />
        </div>
        <div style={{ position: "absolute", top: 80, right: 24, bottom: 24, width: 290, padding: 18, background: "var(--bg-glass)", backdropFilter: "blur(14px)", border: "1px solid var(--line-2)", borderRadius: 16, boxShadow: "var(--shadow-2)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          <div><div style={secLbl}>几何微调</div><GeoPanel params={params} setParams={setParams} onReset={resetGeo} engine={engine} /></div>
          <div><div style={secLbl}>外观编辑</div><AppearancePanel onApply={applyAppearance} busy={refineRunning} /></div>
        </div>
        <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", width: "min(560px, 58%)", padding: 12, background: "var(--bg-glass)", backdropFilter: "blur(14px)", border: "1px solid var(--line-2)", borderRadius: 16, boxShadow: "var(--shadow-2)" }}>
          <NLPanel onApply={applyNL} busy={refineRunning} />
        </div>
      </div>
    );
  } else {
    body = (
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 340px", flex: 1, minHeight: 0 }}>
        <div style={{ borderRight: "1px solid var(--line)", background: "var(--bg-1)", overflowY: "auto" }}>
          <Section title="版本历史"><HistoryList versions={detail.versions} active={activeVer} onPick={setActiveVer} /></Section>
        </div>
        <div style={{ padding: 24, position: "relative" }}>
          <div style={{ position: "absolute", top: 20, left: 20, zIndex: 5 }}><ToolGroup tool={tool} setTool={setTool} vertical /></div>
          {canvas}
        </div>
        {right}
      </div>
    );
  }

  const templateBody = (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", flex: 1, minHeight: 0 }}>
      <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ position: "relative", height: "72%", aspectRatio: "3/4" }}>
          <Portrait hue={hue} src={tplPreview ?? avatar.coverUrl} label={tplPreview ? "美颜预览" : refineRunning ? "图生图生成中…" : "当前形象"} sub={avatar.id} style={{ height: "100%" }} dim={refineRunning} />
          {tplPreview && <span style={cmpTag}>PREVIEW</span>}
          {refineRunning && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <span style={{ width: 26, height: 26, border: "2.5px solid var(--signal)", borderTopColor: "transparent", borderRadius: 999, animation: "spin .8s linear infinite" }} />
            </div>
          )}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", textAlign: "center" }}>
          {selBeauty.length ? "GFPGAN + beauty (client) · 实时预览" : selStyle ? "img2img + 样片参考 · 图生图（提交生成）" : "选择美颜模板（实时）或风格妆造模板（样片图生图）套用"}
        </div>
      </div>
      <TemplateApplyPanel
        selBeauty={selBeauty}
        setSelBeauty={setSelBeauty}
        selStyle={selStyle}
        setSelStyle={setSelStyle}
        onApplyBeauty={applyBeautyTemplates}
        onApplyStyle={applyStyleTemplate}
        applying={applying}
        busy={refineRunning}
      />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 53px)", position: "relative" }}>
      {topbar}
      {mode === "template" ? templateBody : body}
      {info && mode === "tune" && <InfoOverlay onClose={() => setInfo(false)} />}
    </div>
  );
}

const secLbl: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 12 };
const cmpTag: React.CSSProperties = { position: "absolute", top: 8, left: 8, fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "3px 7px", borderRadius: 4, background: "var(--accent)", color: "#1a1205" };

function Canvas({ hue, tool, compare, busy, warpedUrl, beforeUrl, landmarks, engine, avatarLabel }: { hue: number; tool: Tool; compare: boolean; busy: boolean; warpedUrl: string | null; beforeUrl: string | null; landmarks: LM[]; engine: { name: string; count: number }; avatarLabel: string }) {
  const cap = tool === "region" ? CAPABILITY_ENGINE.inpaint : tool === "geo" ? `${engine.name === "mediapipe-facemesh-478" ? `MediaPipe · ${engine.count} 关键点已对齐` : "启发式锚点（未检测到人脸，回退）"} · 网格液化形变` : "人脸关键点已对齐";
  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
      <div style={{ position: "relative", height: "72%", aspectRatio: "3/4" }}>
        {compare ? (
          <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", gap: 2, borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--line-2)" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Portrait hue={hue} src={warpedUrl} label="当前版本" style={{ height: "100%", borderRadius: 0, border: "none" }} />
              <span style={cmpTag}>AFTER</span>
            </div>
            <div style={{ flex: 1, position: "relative" }}>
              <Portrait hue={hue + 18} src={beforeUrl} label="原始" dim style={{ height: "100%", borderRadius: 0, border: "none" }} />
              <span style={{ ...cmpTag, background: "rgba(10,11,14,0.8)", color: "var(--ink-0)" }}>BEFORE</span>
            </div>
          </div>
        ) : (
          <Portrait hue={hue} src={busy ? beforeUrl : warpedUrl} label={busy ? "重绘生成中…" : "精调画布 · 实时形变"} sub={avatarLabel} style={{ height: "100%" }} dim={busy} />
        )}
        {/* 真实关键点叠加（geo 工具） */}
        {tool === "geo" && !compare && landmarks.length > 0 && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.55, pointerEvents: "none" }}>
            {landmarks.filter((_, i) => i % 3 === 0).map((p, i) => (
              <circle key={i} cx={p.x * 100} cy={p.y * 100} r={0.45} fill="var(--accent)" />
            ))}
          </svg>
        )}
        {tool === "geo" && !compare && landmarks.length === 0 && (
          <svg viewBox="0 0 100 133" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5, pointerEvents: "none" }}>
            {[[50, 38], [38, 34], [62, 34], [42, 50], [58, 50], [50, 56], [44, 64], [56, 64], [50, 70]].map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={0.9} fill="var(--accent)" />)}
            <path d="M30 40 Q50 78 70 40" stroke="var(--accent-line)" strokeWidth={0.5} fill="none" />
          </svg>
        )}
        {/* 局部重绘框选 */}
        {tool === "region" && !compare && (
          <div style={{ position: "absolute", left: "24%", top: "52%", width: "52%", height: "40%", border: "1.5px dashed var(--signal)", borderRadius: 4, background: "var(--signal-soft)", boxShadow: "0 0 0 9999px rgba(10,11,14,0.45)" }}>
            <span style={{ position: "absolute", top: -22, left: 0, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--signal)" }}>inpaint mask · 服饰区域</span>
          </div>
        )}
        {busy && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span style={{ width: 26, height: 26, border: "2.5px solid var(--signal)", borderTopColor: "transparent", borderRadius: 999, animation: "spin .8s linear infinite" }} />
          </div>
        )}
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", textAlign: "center" }}>{cap}</div>
    </div>
  );
}

function GeoPanel({ params, setParams, onReset, engine }: { params: GeoParamDef[]; setParams: React.Dispatch<React.SetStateAction<GeoParamDef[]>>; onReset: () => void; engine: { name: string; count: number } }) {
  return (
    <div>
      <EngineNote icon={Icons.scan} text={engine.name === "mediapipe-facemesh-478" ? `MediaPipe ${engine.count} 关键点` : "启发式锚点（回退）"} badge="实时" />
      <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 14 }}>
        {params.map((p) => (
          <div key={p.key}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--ink-1)" }}>{p.label}{p.sliderKey === null && <span style={{ color: "var(--ink-3)", marginLeft: 5, fontSize: 10 }}>（记录）</span>}</span>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--accent-hi)" }}>{(p.v - 50 > 0 ? "+" : "") + (p.v - 50)}</span>
            </div>
            <input type="range" min={0} max={100} value={p.v} onChange={(e) => setParams((ps) => ps.map((x) => (x.key === p.key ? { ...x, v: +e.target.value } : x)))} style={{ width: "100%" }} />
          </div>
        ))}
      </div>
      <button onClick={onReset} style={{ marginTop: 12, background: "none", border: "none", color: "var(--ink-2)", fontSize: 11.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
        <Icons.retry size={13} />复位中性值
      </button>
    </div>
  );
}

function AppearancePanel({ onApply, busy }: { onApply: (cap: Parameters<typeof refineAppearance>[1], label: string) => void; busy: boolean }) {
  return (
    <div>
      <EngineNote icon={Icons.wand} text="迁移 / 局部重绘" badge="需生成" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {APPEARANCE_EDITS.map((a) => (
          <div key={a.key} style={{ padding: 11, borderRadius: "var(--r-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{a.label}</span>
              <Btn size="sm" variant="signal" icon={Icons.wand} onClick={() => onApply(a.capability, a.label)} disabled={busy}>重绘</Btn>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 5 }}>{a.desc}</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", marginTop: 4 }}>{a.engine}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NLPanel({ onApply, busy }: { onApply: (text: string) => void; busy: boolean }) {
  const [v, setV] = React.useState("");
  const presets = ["表情更自然", "光影更柔和", "背景虚化", "气质更亲和"];
  return (
    <div>
      <EngineNote icon={Icons.sparkle} text={CAPABILITY_ENGINE.img2img} badge="需生成" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, margin: "14px 0 12px" }}>
        {presets.map((p) => <button key={p} onClick={() => onApply(p)} disabled={busy} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 999, border: "1px solid var(--line-2)", background: "var(--bg-2)", color: "var(--ink-1)", cursor: "pointer" }}>{p}</button>)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="整体指令微调（保留五官结构）" style={{ flex: 1, padding: "10px 12px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", color: "var(--ink-0)", fontSize: 13, outline: "none" }} />
        <IconBtn icon={Icons.wand} active onClick={() => { if (v.trim()) { onApply(v); setV(""); } }} />
      </div>
    </div>
  );
}

function EngineNote({ icon: I, text, badge }: { icon: IconComponent; text: string; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
      <span style={{ color: "var(--ink-2)" }}><I size={14} /></span>
      <span className="mono" style={{ fontSize: 10, color: "var(--ink-1)", flex: 1, lineHeight: 1.3 }}>{text}</span>
      {badge && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 6px", borderRadius: 4, color: badge === "实时" ? "var(--ok)" : "var(--signal)", border: "1px solid " + (badge === "实时" ? "rgba(86,214,160,0.3)" : "var(--signal-line)") }}>{badge}</span>}
    </div>
  );
}

function HistoryList({ versions, active, onPick }: { versions: AiAvatarDetail["versions"]; active: string; onPick: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {versions.slice(0, 8).map((v) => (
        <button key={v.id} onClick={() => onPick(v.id)} style={{ display: "flex", gap: 11, alignItems: "center", padding: "9px 10px", borderRadius: "var(--r-md)", cursor: "pointer", textAlign: "left", width: "100%", background: active === v.id ? "var(--accent-soft)" : "transparent", border: "1px solid " + (active === v.id ? "var(--accent-line)" : "transparent") }}>
          <Portrait hue={28} src={v.previewUrl} ratio="1/1" label="" style={{ width: 38, height: 38, borderRadius: 7, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: active === v.id ? "var(--accent-hi)" : "var(--ink-0)" }}>{v.label}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtDateTime(v.createdAt)} · {v.note}</div>
          </div>
          {v.sourceStatus && <StatusPill status={v.sourceStatus} />}
        </button>
      ))}
    </div>
  );
}

function ToolGroup({ tool, setTool, vertical }: { tool: Tool; setTool: (t: Tool) => void; vertical?: boolean }) {
  const tools: [Tool, IconComponent, string][] = [["move", Icons.scan, "移动"], ["geo", Icons.dim, "关键点形变"], ["region", Icons.sliders, "局部重绘框选"], ["compare", Icons.compare, "前后对比"]];
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: 6 }}>
      {tools.map(([k, I, t]) => <IconBtn key={k} icon={I} title={t} active={tool === k} onClick={() => setTool(tool === k ? "move" : k)} />)}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line)" }}>
      <div style={secLbl}>{title}</div>
      {children}
    </div>
  );
}

function RightControls({ params, setParams, apply, applyNL, applyRegion, busy, resetGeo, onSave, saving, engine }: { params: GeoParamDef[]; setParams: React.Dispatch<React.SetStateAction<GeoParamDef[]>>; apply: (cap: Parameters<typeof refineAppearance>[1], label: string) => void; applyNL: (t: string) => void; applyRegion: () => void; busy: boolean; resetGeo: () => void; onSave: () => void; saving: boolean; engine: { name: string; count: number } }) {
  return (
    <div style={{ borderLeft: "1px solid var(--line)", background: "var(--bg-1)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <Section title="几何微调 · 关键点形变"><GeoPanel params={params} setParams={setParams} onReset={resetGeo} engine={engine} /></Section>
      <Section title="外观编辑 · 生成式"><AppearancePanel onApply={apply} busy={busy} /></Section>
      <Section title="局部重绘"><div><EngineNote icon={Icons.sliders} text={CAPABILITY_ENGINE.inpaint} badge="需生成" /><Btn variant="signal" full icon={Icons.wand} onClick={applyRegion} disabled={busy} style={{ marginTop: 12 }}>重绘框选区域</Btn></div></Section>
      <Section title="自然语言精调"><NLPanel onApply={applyNL} busy={busy} /></Section>
      <div style={{ padding: 18, marginTop: "auto", position: "sticky", bottom: 0, background: "var(--bg-1)", borderTop: "1px solid var(--line)" }}>
        <div style={{ fontSize: 11, color: "var(--ink-2)", marginBottom: 10, lineHeight: 1.5 }}>几何调整实时生效（客户端形变）；外观/语言编辑提交后台任务并保存为新版本快照。</div>
        <Btn variant="pri" full icon={Icons.history} onClick={onSave} disabled={busy || saving}>{saving ? "保存中…" : "保存为新版本快照"}</Btn>
      </div>
    </div>
  );
}

// ── 模版套用面板：美颜模板（真实 canvas beauty，实时）+ 风格妆造模板（样片→图生图）──────
function TemplateApplyPanel({
  selBeauty,
  setSelBeauty,
  selStyle,
  setSelStyle,
  onApplyBeauty,
  onApplyStyle,
  applying,
  busy,
}: {
  selBeauty: string[];
  setSelBeauty: React.Dispatch<React.SetStateAction<string[]>>;
  selStyle: string | null;
  setSelStyle: React.Dispatch<React.SetStateAction<string | null>>;
  onApplyBeauty: () => void;
  onApplyStyle: () => void;
  applying: boolean;
  busy: boolean;
}) {
  const toggleBeauty = (id: string) => setSelBeauty((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div style={{ borderLeft: "1px solid var(--line)", background: "var(--bg-1)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <Section title="美颜 / 美化模板 · 可叠加">
        <EngineNote icon={Icons.wand} text="GFPGAN + beauty · 客户端实时" badge="实时" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
          {BEAUTY_TEMPLATES.map((b) => {
            const on = selBeauty.includes(b.id);
            return (
              <button key={b.id} onClick={() => toggleBeauty(b.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: "var(--r-md)", cursor: "pointer", textAlign: "left", background: on ? "var(--accent-soft)" : "var(--bg-2)", border: "1px solid " + (on ? "var(--accent-line)" : "var(--line)") }}>
                <div style={{ width: 34, height: 34, borderRadius: 7, flexShrink: 0, background: `linear-gradient(140deg, oklch(0.55 0.1 ${b.hue}), oklch(0.32 0.07 ${b.hue}))`, position: "relative" }}>
                  {on && <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff" }}><Icons.check size={16} stroke={3} /></span>}
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: on ? "var(--accent-hi)" : "var(--ink-0)" }}>{b.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-2)" }}>{b.tag}</div>
                </div>
              </button>
            );
          })}
        </div>
        <Btn variant="pri" full icon={Icons.check} disabled={!selBeauty.length || applying} onClick={onApplyBeauty} style={{ marginTop: 12 }}>
          {applying ? "套用中…" : `套用美颜模版${selBeauty.length ? ` (${selBeauty.length})` : ""}`}
        </Btn>
      </Section>

      <Section title="风格 / 妆造模板 · 样片图生图">
        <EngineNote icon={Icons.sparkle} text="img2img + 样片参考（职业妆 / 古风…）" badge="需生成" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
          {STYLE_LOOK_TEMPLATES.map((t) => {
            const on = selStyle === t.id;
            return (
              <button key={t.id} onClick={() => setSelStyle(on ? null : t.id)} style={{ padding: 8, borderRadius: "var(--r-md)", cursor: "pointer", textAlign: "left", background: on ? "var(--accent-soft)" : "var(--bg-2)", border: "1px solid " + (on ? "var(--accent)" : "var(--line)") }}>
                <Portrait hue={t.hue} ratio="3/4" label="样片" selected={on} style={{ borderRadius: 7 }} />
                <div style={{ marginTop: 7 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: on ? "var(--accent-hi)" : "var(--ink-0)" }}>{t.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-2)" }}>{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
        <Btn variant="signal" full icon={Icons.wand} disabled={!selStyle || busy} onClick={onApplyStyle} style={{ marginTop: 12 }}>套用此模版（图生图）</Btn>
      </Section>

      <div style={{ padding: 18, marginTop: "auto", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-2)", lineHeight: 1.6 }}>
        美颜模板客户端实时套用并存为新版本；风格妆造模板用样片做图生图，提交后台任务生成新版本。下一步「分视角出图」只按标准构图批量出图，不再做编辑。
      </div>
    </div>
  );
}

function InfoOverlay({ onClose }: { onClose: () => void }) {
  const E = CAPABILITY_ENGINE;
  const rows: [string, string, string][] = [
    ["真人复刻打样", E.faceClone, CAPABILITY_KIND.faceClone],
    ["AI 原创打样", E.txt2img, CAPABILITY_KIND.txt2img],
    ["草稿指令调整", E.img2img, CAPABILITY_KIND.img2img],
    ["几何微调（瘦脸/五官）", E.faceWarp, CAPABILITY_KIND.faceWarp],
    ["妆容 / 发型 / 服饰", `${E.makeup} / ${E.inpaint}`, "扩散 / 迁移"],
    ["美颜质感", E.restore, CAPABILITY_KIND.restore],
    ["2D → 3D", `${E.img23d} / FLAME+3DGS`, CAPABILITY_KIND.img23d],
    ["渲染短视频", E.img2video, CAPABILITY_KIND.img2video],
  ];
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,11,14,0.6)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxHeight: "80%", overflowY: "auto", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>实现方式 · 真实能力对齐</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 3 }}>每项能力对应的真实模型 / 开源 SDK</div>
          </div>
          <IconBtn icon={Icons.x} size={32} onClick={onClose} />
        </div>
        <div style={{ padding: "8px 20px 18px" }}>
          {rows.map(([cap, eng, kind]) => (
            <div key={cap} style={{ display: "grid", gridTemplateColumns: "1.1fr 1.6fr auto", gap: 12, alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontSize: 13, color: "var(--ink-0)" }}>{cap}</span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-1)" }}>{eng}</span>
              <Tag on={kind === "关键点算法"}>{kind}</Tag>
            </div>
          ))}
          <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
            注：「瘦脸 / 眼睛大小 / 鼻梁」等几何调整为人脸关键点 + 网格液化形变，确定性、实时、可连续滑块，<b style={{ color: "var(--ink-1)" }}>本应用即为真实客户端算法</b>（MediaPipe FaceMesh + face-warp 液化）；「妆容 / 发型 / 服饰」需模型推理，提交后台任务生成。
          </div>
        </div>
      </div>
    </div>
  );
}
