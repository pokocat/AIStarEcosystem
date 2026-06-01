"use client";

// 人像精调工作台：
//  ① 几何微调 = MediaPipe 关键点 + 液化形变（真实！前端 canvas 实时滑块）
//  ② 外观编辑 = 妆容/发型/肤质/服饰（迁移 / SD inpainting，异步任务）
//  ③ 自然语言整体微调  ④ 局部框选（SAM mask）
//  三栏：左缩略 | 中画布(前后对比) | 右工具。从某个 AiAvatar 的当前阶段进入。
import * as React from "react";
import { Brush, Eye, GitCompare, Loader2, RotateCcw, Save, Scan, SlidersHorizontal, Sparkles } from "lucide-react";
import type { AiAvatarAsset, AiAvatar, AiAvatarCapability } from "@ai-star-eco/types/ai-avatar";
import { useSearchParams } from "next/navigation";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { warpImageData, heuristicAnchors, NEUTRAL, type FaceAnchors, type FaceSliders } from "@/lib/face-warp";
import { detectFaceAnchors, warmupLandmarker } from "@/lib/face-landmarks";
import { APPEARANCE_CAPS } from "@/constants/aiavatar-ui";
import { SourceBadge } from "@/components/common/source-badge";

type Mode = "geometry" | "appearance" | "nl" | "region";
type DetectState = "idle" | "detecting" | "detected" | "fallback";

const SLIDERS: { key: keyof FaceSliders; label: string }[] = [
  { key: "slimFace", label: "瘦脸" }, { key: "eyeSize", label: "眼睛" },
  { key: "noseBridge", label: "鼻梁" }, { key: "faceShape", label: "脸型" }, { key: "mouthShape", label: "嘴型" },
];

export function RefineWorkbenchClient() {
  const search = useSearchParams();
  const preAvatar = search.get("avatar");

  const [avatars, setAvatars] = React.useState<AiAvatar[]>([]);
  const [avatarId, setAvatarId] = React.useState<string | null>(preAvatar);
  const [baseAsset, setBaseAsset] = React.useState<AiAvatarAsset | null>(null);
  const [assets, setAssets] = React.useState<AiAvatarAsset[]>([]);
  const [mode, setMode] = React.useState<Mode>("geometry");
  const [sliders, setSliders] = React.useState<FaceSliders>(NEUTRAL);
  const [compare, setCompare] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const [detect, setDetect] = React.useState<DetectState>("idle");
  const [landmarkCount, setLandmarkCount] = React.useState(0);

  const baseCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const outCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const srcImageData = React.useRef<ImageData | null>(null);
  const anchorsRef = React.useRef<FaceAnchors | null>(null);

  React.useEffect(() => { warmupLandmarker(); }, []);

  React.useEffect(() => { AiAvatarApi.listAvatars().then((l) => { setAvatars(l); if (!avatarId && l[0]) setAvatarId(l[0].id); }).catch(() => setAvatars([])); }, [avatarId]);

  React.useEffect(() => {
    if (!avatarId) return;
    AiAvatarApi.getDetail(avatarId).then((d) => {
      const imgs = d.assets.filter((a) => (a.kind === "image_2d" || a.kind === "draft_image" || a.kind === "expression_image") && a.fileUrl && !a.fileUrl.startsWith("#"));
      setAssets(imgs);
      setBaseAsset(imgs[0] ?? null);
    }).catch(() => { setAssets([]); setBaseAsset(null); });
  }, [avatarId]);

  React.useEffect(() => {
    if (!baseAsset) { srcImageData.current = null; anchorsRef.current = null; setDetect("idle"); return; }
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      if (!alive) return;
      const W = 384, H = Math.round((img.height / img.width) * 384) || 512;
      for (const c of [baseCanvasRef.current, outCanvasRef.current]) {
        if (!c) continue; c.width = W; c.height = H;
        c.getContext("2d")!.drawImage(img, 0, 0, W, H);
      }
      const bctx = baseCanvasRef.current?.getContext("2d");
      if (bctx) srcImageData.current = bctx.getImageData(0, 0, W, H);
      setSliders(NEUTRAL);

      setDetect("detecting");
      anchorsRef.current = heuristicAnchors(W, H);
      try {
        const { anchors, landmarks } = await detectFaceAnchors(img, W, H);
        if (!alive) return;
        anchorsRef.current = anchors;
        setLandmarkCount(landmarks.length);
        setDetect("detected");
        redraw(sliders);
      } catch {
        if (!alive) return;
        setDetect("fallback");
      }
    };
    img.onerror = () => { srcImageData.current = null; setDetect("idle"); };
    img.src = baseAsset.fileUrl;
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseAsset]);

  const redraw = React.useCallback((s: FaceSliders) => {
    const src = srcImageData.current; const out = outCanvasRef.current;
    if (!src || !out) return;
    const ctx = out.getContext("2d")!;
    const warped = warpImageData(src, s, anchorsRef.current ?? undefined);
    ctx.putImageData(warped, 0, 0);
  }, []);

  React.useEffect(() => { redraw(sliders); }, [sliders, redraw]);

  const resetSliders = () => setSliders(NEUTRAL);

  const saveGeometry = async () => {
    if (!avatarId || !outCanvasRef.current) return;
    setSaving(true); setMsg(null);
    try {
      const afterDataUri = outCanvasRef.current.toDataURL("image/png");
      await AiAvatarApi.recordGeometryRefine(avatarId, {
        afterAssetId: "", afterDataUri,
        params: {
          ...sliders,
          landmarkEngine: detect === "detected" ? "mediapipe-facemesh-478" : "heuristic-center",
          landmarkCount: detect === "detected" ? landmarkCount : 0,
        },
        note: detect === "detected" ? "几何微调（MediaPipe 关键点）" : "几何微调（启发式）",
      });
      setMsg("已保存为新版本");
      const d = await AiAvatarApi.getDetail(avatarId);
      const imgs = d.assets.filter((a) => a.kind === "image_2d" && !a.fileUrl.startsWith("#"));
      setAssets(imgs);
    } catch (e) { setMsg(e instanceof Error ? e.message : "保存失败"); }
    finally { setSaving(false); }
  };

  const submitAppearance = async (cap: AiAvatarCapability, prompt?: string) => {
    if (!avatarId) return;
    setSaving(true); setMsg(null);
    try {
      await AiAvatarApi.startAppearanceRefine(avatarId, cap, { prompt, baseAssetId: baseAsset?.id });
      setMsg(`已提交「${APPEARANCE_CAPS.find((c) => c.cap === cap)?.label ?? cap}」生成任务，前往任务中心查看进度`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "提交失败"); }
    finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">人像精调工作台</h1>
          <p className="mt-0.5 text-sm text-[var(--fg-2)]">几何微调为真实确定性算法（前端实时）；外观编辑走异步生成任务</p>
        </div>
        <select value={avatarId ?? ""} onChange={(e) => setAvatarId(e.target.value)} className="aa-select w-auto">
          {avatars.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[120px_1fr_300px]">
        {/* 左：资产缩略 */}
        <div className="flex gap-2 overflow-x-auto lg:flex-col">
          {assets.map((a) => (
            <button key={a.id} onClick={() => setBaseAsset(a)}
              className={cn("shrink-0 overflow-hidden rounded-lg border transition", baseAsset?.id === a.id ? "border-[var(--brand)] ring-2 ring-[var(--brand-soft)]" : "border-[var(--line)] hover:border-[var(--line-strong)]")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.thumbnailUrl ?? a.fileUrl} alt="" className="h-20 w-16 object-cover lg:h-24 lg:w-full" />
            </button>
          ))}
          {assets.length === 0 && <div className="text-xs text-[var(--fg-3)]">该 AiAvatar 暂无可编辑图片，请先打样</div>}
        </div>

        {/* 中：画布（前/后对比） */}
        <div className="flex items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg-2)] p-4">
          {baseAsset ? (
            <div className="relative">
              <div className={cn("grid gap-3", compare ? "grid-cols-2" : "grid-cols-1")}>
                <div className={compare ? "" : "hidden"}>
                  <canvas ref={baseCanvasRef} className="w-full max-w-[300px] rounded-lg border border-[var(--line)]" />
                  <div className="meta mt-1 text-center">原图</div>
                </div>
                <div>
                  <canvas ref={outCanvasRef} className="w-full max-w-[300px] rounded-lg border border-[var(--brand-line)]" />
                  <div className="meta mt-1 text-center">{mode === "geometry" ? "实时形变预览" : "当前底图"}</div>
                </div>
              </div>
              <button onClick={() => setCompare((c) => !c)}
                className="absolute right-0 top-0 flex items-center gap-1 rounded-md bg-black/45 px-2 py-1 text-[11px] text-white backdrop-blur-sm hover:bg-black/60">
                <GitCompare className="h-3 w-3" /> {compare ? "单图" : "前后对比"}
              </button>
            </div>
          ) : (
            <div className="ph flex h-72 w-56 items-center justify-center rounded-lg"><span className="num text-xs text-[var(--fg-3)]">无底图</span></div>
          )}
        </div>

        {/* 右：工具 */}
        <div className="space-y-3">
          <div className="seg w-full">
            <button onClick={() => setMode("geometry")} data-on={mode === "geometry"} className="seg-item flex-1"><SlidersHorizontal className="h-3.5 w-3.5" /> 几何</button>
            <button onClick={() => setMode("appearance")} data-on={mode === "appearance"} className="seg-item flex-1"><Brush className="h-3.5 w-3.5" /> 外观</button>
            <button onClick={() => setMode("nl")} data-on={mode === "nl"} className="seg-item flex-1"><Sparkles className="h-3.5 w-3.5" /> 语言</button>
            <button onClick={() => setMode("region")} data-on={mode === "region"} className="seg-item flex-1"><Scan className="h-3.5 w-3.5" /> 局部</button>
          </div>

          {mode === "geometry" && (
            <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--fg-1)]">几何微调（确定性液化）</span>
                <SourceBadge engine="liquify-canvas" mode="selfhost" />
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-1.5 text-[11px]">
                {detect === "detecting" && <><Loader2 className="h-3 w-3 animate-spin text-[var(--info)]" /><span className="text-[var(--fg-2)]">MediaPipe 人脸关键点识别中…</span></>}
                {detect === "detected" && <><Eye className="h-3 w-3 text-[var(--success)]" /><span className="text-[var(--success)]">已识别 <span className="num">{landmarkCount}</span> 个关键点</span><span className="text-[var(--fg-3)]">· 按真实位置形变</span></>}
                {detect === "fallback" && <><Scan className="h-3 w-3 text-[var(--warning)]" /><span className="text-[var(--warning)]">未检测到人脸 · 回退居中估计</span></>}
                {detect === "idle" && <span className="text-[var(--fg-3)]">选择底图后自动识别关键点</span>}
              </div>
              {SLIDERS.map((s) => (
                <label key={s.key} className="block">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--fg-2)]">{s.label}</span>
                    <span className="num font-medium text-[var(--brand-strong)]">{sliders[s.key] > 0 ? "+" : ""}{sliders[s.key]}</span>
                  </div>
                  <input type="range" min={-100} max={100} value={sliders[s.key]}
                    onChange={(e) => setSliders((v) => ({ ...v, [s.key]: Number(e.target.value) }))}
                    className="w-full" style={{ accentColor: "var(--brand)" }} />
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={resetSliders} className="btn btn-ghost btn-sm flex-1"><RotateCcw className="h-3.5 w-3.5" /> 复位</button>
                <button onClick={saveGeometry} disabled={saving || !baseAsset} className="btn btn-primary btn-sm flex-[2]">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} 保存为新版本
                </button>
              </div>
            </div>
          )}

          {mode === "appearance" && (
            <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-3">
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-[var(--fg-1)]">外观编辑（异步生成）</span><SourceBadge engine="MOCK" mode="mock" /></div>
              {APPEARANCE_CAPS.map((c) => (
                <button key={c.cap} onClick={() => submitAppearance(c.cap)} disabled={saving}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-left transition hover:border-[var(--brand-line)] hover:bg-[var(--bg-2)] disabled:opacity-60">
                  <div>
                    <div className="text-sm text-[var(--fg-0)]">{c.label}</div>
                    <div className="text-[11px] text-[var(--fg-3)]">{c.hint}</div>
                  </div>
                  <Sparkles className="h-4 w-4 text-[var(--brand-strong)]" />
                </button>
              ))}
            </div>
          )}

          {mode === "nl" && <NlPanel onSubmit={(p) => submitAppearance("img2img", p)} saving={saving} />}
          {mode === "region" && <RegionPanel onSubmit={(p) => { if (avatarId) AiAvatarApi.startRegionInpaint(avatarId, { prompt: p, baseAssetId: baseAsset?.id }).then(() => setMsg("已提交局部重绘任务")).catch((e) => setMsg(e instanceof Error ? e.message : "提交失败")); }} saving={saving} />}

          {msg && <p className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-xs text-[var(--fg-1)]">{msg}</p>}
          <a href="/jobs" className="block text-center text-xs text-[var(--fg-2)] transition hover:text-[var(--brand-strong)]">查看异步任务进度 →</a>
        </div>
      </div>

      {/* 实现方式说明 */}
      <details className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-3 py-2 text-xs text-[var(--fg-2)]">
        <summary className="cursor-pointer select-none font-medium text-[var(--fg-1)]">实现方式说明</summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>· 几何微调：<b className="text-[var(--success)]">真实接入 MediaPipe FaceLandmarker（478 关键点，浏览器 WASM/CPU）</b>。眼睛 / 脸型 / 鼻梁 / 嘴 按检测到的真实关键点位置做确定性径向液化（前端 canvas 实时），与后端 AiAvatarGeometryWarp 同族，<b className="text-[var(--fg-0)]">非 mock</b>。检测不可用时回退居中估计，仍可用。</p>
          <p>· 外观 / 局部：妆容(EleGANt)/发型(HairCLIP)/服饰(SD inpaint + SAM mask)，提交异步生成任务（dev 为 mock，可一键切真实 provider）。</p>
        </div>
      </details>
    </div>
  );
}

function NlPanel({ onSubmit, saving }: { onSubmit: (p: string) => void; saving: boolean }) {
  const [p, setP] = React.useState("");
  return (
    <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-3">
      <span className="text-xs font-medium text-[var(--fg-1)]">自然语言整体微调（img2img）</span>
      <textarea value={p} onChange={(e) => setP(e.target.value)} rows={3} placeholder="描述整体调整方向…" className="aa-textarea" />
      <button onClick={() => onSubmit(p)} disabled={saving || !p.trim()} className="btn btn-primary btn-sm w-full">提交微调</button>
    </div>
  );
}

function RegionPanel({ onSubmit, saving }: { onSubmit: (p: string) => void; saving: boolean }) {
  const [p, setP] = React.useState("");
  return (
    <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-3">
      <span className="text-xs font-medium text-[var(--fg-1)]">局部框选重绘（SAM mask + inpaint）</span>
      <p className="text-[11px] text-[var(--fg-3)]">SAM 自动分割面部区域生成蒙版，描述该区域要怎么改：</p>
      <textarea value={p} onChange={(e) => setP(e.target.value)} rows={2} placeholder="如：把领口换成高领…" className="aa-textarea" />
      <button onClick={() => onSubmit(p)} disabled={saving || !p.trim()} className="btn btn-primary btn-sm w-full">提交局部重绘</button>
    </div>
  );
}
