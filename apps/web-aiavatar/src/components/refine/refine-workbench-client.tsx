"use client";

// 人像精调工作台（任务书 §7）：
//  ① 几何微调 = MediaPipe 关键点 + 液化形变（真实！前端 canvas 实时滑块，±中性值）
//  ② 外观编辑 = 妆容/发型/肤质/服饰（迁移 / SD inpainting，提交异步任务）
//  ③ 自然语言整体微调  ④ 局部框选（SAM mask）
//  三栏布局 + 前后对比 + 版本回退 + 实现方式说明面板。
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brush, Eye, GitCompare, Loader2, RotateCcw, Save, Scan, SlidersHorizontal, Sparkles } from "lucide-react";
import type { AiAvatarAsset, AiAvatar, AiAvatarCapability } from "@ai-star-eco/types/ai-avatar";
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
  const router = useRouter();
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

  // 挂载即预热 MediaPipe（拉 WASM + 模型），避免首次形变卡顿；失败静默回退启发式。
  React.useEffect(() => { warmupLandmarker(); }, []);

  React.useEffect(() => { AiAvatarApi.listAvatars().then((l) => { setAvatars(l); if (!avatarId && l[0]) setAvatarId(l[0].id); }).catch(() => setAvatars([])); }, [avatarId]);

  // 载入选中 avatar 的图片资产
  React.useEffect(() => {
    if (!avatarId) return;
    AiAvatarApi.getDetail(avatarId).then((d) => {
      const imgs = d.assets.filter((a) => (a.kind === "image_2d" || a.kind === "draft_image" || a.kind === "expression_image") && a.fileUrl && !a.fileUrl.startsWith("#"));
      setAssets(imgs);
      setBaseAsset(imgs[0] ?? null);
    }).catch(() => { setAssets([]); setBaseAsset(null); });
  }, [avatarId]);

  // 把 baseAsset 画到 canvas + 取 ImageData + MediaPipe 真实关键点检测
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

      // 真实关键点检测（任务书 §4 MediaPipe FaceMesh）；失败回退启发式锚点。
      setDetect("detecting");
      anchorsRef.current = heuristicAnchors(W, H); // 先放回退锚点，保证拖滑块即时可用
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

  // 滑块变化 → 实时液化（真实算法 + 真实关键点锚点，前端 canvas）
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
          <h1 className="text-xl font-semibold">人像精调工作台</h1>
          <p className="mt-0.5 text-sm text-zinc-500">几何微调为真实确定性算法（前端实时）；外观编辑走异步生成任务</p>
        </div>
        <select value={avatarId ?? ""} onChange={(e) => setAvatarId(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-[var(--bg-1)] px-3 py-1.5 text-sm text-zinc-200">
          {avatars.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* 三栏：左缩略 | 中画布 | 右工具 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[120px_1fr_300px]">
        {/* 左：资产缩略 */}
        <div className="flex gap-2 overflow-x-auto lg:flex-col">
          {assets.map((a) => (
            <button key={a.id} onClick={() => setBaseAsset(a)}
              className={cn("shrink-0 overflow-hidden rounded-lg border", baseAsset?.id === a.id ? "border-amber-500" : "border-zinc-800")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.thumbnailUrl ?? a.fileUrl} alt="" className="h-20 w-16 object-cover lg:h-24 lg:w-full" />
            </button>
          ))}
          {assets.length === 0 && <div className="text-xs text-zinc-500">该AiAvatar暂无可编辑图片，请先打样</div>}
        </div>

        {/* 中：画布（前/后对比） */}
        <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-[var(--bg-2)] p-4">
          {baseAsset ? (
            <div className="relative">
              <div className={cn("grid gap-3", compare ? "grid-cols-2" : "grid-cols-1")}>
                <div className={compare ? "" : "hidden"}>
                  <canvas ref={baseCanvasRef} className="w-full max-w-[300px] rounded-lg border border-zinc-700" />
                  <div className="meta mt-1 text-center">原图</div>
                </div>
                <div>
                  <canvas ref={outCanvasRef} className="w-full max-w-[300px] rounded-lg border border-amber-500/40" />
                  <div className="meta mt-1 text-center">{mode === "geometry" ? "实时形变预览" : "当前底图"}</div>
                </div>
              </div>
              <button onClick={() => setCompare((c) => !c)}
                className="absolute right-0 top-0 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[11px] text-zinc-200">
                <GitCompare className="h-3 w-3" /> {compare ? "单图" : "前后对比"}
              </button>
            </div>
          ) : (
            <div className="ph flex h-72 w-56 items-center justify-center rounded-lg"><span className="meta">无底图</span></div>
          )}
        </div>

        {/* 右：工具 */}
        <div className="space-y-3">
          <div className="flex gap-1 rounded-lg bg-zinc-800 p-1">
            <ModeTab active={mode === "geometry"} onClick={() => setMode("geometry")} icon={SlidersHorizontal}>几何</ModeTab>
            <ModeTab active={mode === "appearance"} onClick={() => setMode("appearance")} icon={Brush}>外观</ModeTab>
            <ModeTab active={mode === "nl"} onClick={() => setMode("nl")} icon={Sparkles}>语言</ModeTab>
            <ModeTab active={mode === "region"} onClick={() => setMode("region")} icon={Scan}>局部</ModeTab>
          </div>

          {mode === "geometry" && (
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-[var(--bg-1)] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">几何微调（确定性液化）</span>
                <SourceBadge engine="liquify-canvas" mode="selfhost" />
              </div>
              {/* 真实关键点检测状态：眼睛/脸型按检测位置形变，任意构图都准 */}
              <div className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-2)] px-2.5 py-1.5 text-[11px]">
                {detect === "detecting" && <><Loader2 className="h-3 w-3 animate-spin text-amber-400" /><span className="text-zinc-400">MediaPipe 人脸关键点识别中…</span></>}
                {detect === "detected" && <><Eye className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">已识别 {landmarkCount} 个关键点</span><span className="text-zinc-500">· 眼睛/脸型按真实位置形变</span></>}
                {detect === "fallback" && <><Scan className="h-3 w-3 text-amber-400" /><span className="text-amber-400">未检测到人脸 · 回退居中估计</span></>}
                {detect === "idle" && <span className="text-zinc-500">选择底图后自动识别关键点</span>}
              </div>
              {SLIDERS.map((s) => (
                <label key={s.key} className="block">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">{s.label}</span>
                    <span className="font-mono text-amber-400">{sliders[s.key] > 0 ? "+" : ""}{sliders[s.key]}</span>
                  </div>
                  <input type="range" min={-100} max={100} value={sliders[s.key]}
                    onChange={(e) => setSliders((v) => ({ ...v, [s.key]: Number(e.target.value) }))}
                    className="w-full accent-amber-500" />
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={resetSliders} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-300">
                  <RotateCcw className="h-3.5 w-3.5" /> 复位
                </button>
                <button onClick={saveGeometry} disabled={saving || !baseAsset}
                  className="flex flex-[2] items-center justify-center gap-1 rounded-lg bg-amber-500 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-60">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} 保存为新版本
                </button>
              </div>
            </div>
          )}

          {mode === "appearance" && (
            <div className="space-y-2 rounded-xl border border-zinc-800 bg-[var(--bg-1)] p-3">
              <div className="flex items-center justify-between"><span className="text-xs text-zinc-400">外观编辑（异步生成）</span><SourceBadge engine="MOCK" mode="mock" /></div>
              {APPEARANCE_CAPS.map((c) => (
                <button key={c.cap} onClick={() => submitAppearance(c.cap)} disabled={saving}
                  className="flex w-full items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-left hover:border-amber-500/50 disabled:opacity-60">
                  <div>
                    <div className="text-sm text-zinc-100">{c.label}</div>
                    <div className="text-[11px] text-zinc-500">{c.hint}</div>
                  </div>
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </button>
              ))}
            </div>
          )}

          {mode === "nl" && <NlPanel onSubmit={(p) => submitAppearance("img2img", p)} saving={saving} />}
          {mode === "region" && <RegionPanel onSubmit={(p) => { if (avatarId) AiAvatarApi.startRegionInpaint(avatarId, { prompt: p, baseAssetId: baseAsset?.id }).then(() => setMsg("已提交局部重绘任务")).catch((e) => setMsg(e instanceof Error ? e.message : "提交失败")); }} saving={saving} />}

          {msg && <p className="rounded-lg bg-zinc-800/60 px-3 py-2 text-xs text-amber-300">{msg}</p>}
          <a href="/jobs" className="block text-center text-xs text-zinc-500 hover:text-amber-400">查看异步任务进度 →</a>
        </div>
      </div>

      {/* 实现方式说明 */}
      <details className="rounded-lg border border-zinc-800 bg-[var(--bg-2)] px-3 py-2 text-xs text-zinc-400">
        <summary className="cursor-pointer text-zinc-300">实现方式说明</summary>
        <div className="mt-2 space-y-1">
          <p>· 几何微调：<b className="text-emerald-400">真实接入 MediaPipe FaceLandmarker（478 关键点，@mediapipe/tasks-vision，Apache-2.0，浏览器 WASM/CPU）</b>。眼睛 / 脸型 / 鼻梁 / 嘴 按检测到的真实关键点位置做确定性径向液化（前端 canvas 实时），与后端 AiAvatarGeometryWarp 同族，<b className="text-amber-400">非 mock</b>。检测不可用（无网络/无脸）时回退居中估计，仍可用。</p>
          <p>· 外观/局部：妆容(EleGANt)/发型(HairCLIP)/服饰(SD inpaint + SAM mask)，提交异步生成任务（dev 为 mock，可一键切真实 provider）。</p>
        </div>
      </details>
    </div>
  );
}

function ModeTab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs", active ? "bg-amber-500 text-zinc-950" : "text-zinc-400")}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function NlPanel({ onSubmit, saving }: { onSubmit: (p: string) => void; saving: boolean }) {
  const [p, setP] = React.useState("");
  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-[var(--bg-1)] p-3">
      <span className="text-xs text-zinc-400">自然语言整体微调（img2img）</span>
      <textarea value={p} onChange={(e) => setP(e.target.value)} rows={3} placeholder="描述整体调整方向…"
        className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none" />
      <button onClick={() => onSubmit(p)} disabled={saving || !p.trim()}
        className="w-full rounded-lg bg-amber-500 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-60">提交微调</button>
    </div>
  );
}

function RegionPanel({ onSubmit, saving }: { onSubmit: (p: string) => void; saving: boolean }) {
  const [p, setP] = React.useState("");
  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-[var(--bg-1)] p-3">
      <span className="text-xs text-zinc-400">局部框选重绘（SAM mask + inpaint）</span>
      <p className="text-[11px] text-zinc-500">SAM 自动分割面部区域生成蒙版，描述该区域要怎么改：</p>
      <textarea value={p} onChange={(e) => setP(e.target.value)} rows={2} placeholder="如：把领口换成高领…"
        className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none" />
      <button onClick={() => onSubmit(p)} disabled={saving || !p.trim()}
        className="w-full rounded-lg bg-amber-500 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-60">提交局部重绘</button>
    </div>
  );
}
