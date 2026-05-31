"use client";
// ============================================================
// 标准分视角出图（STEP 06）— 使用固定 6 镜头提示词生成标准数字人视角图集。
// 美颜 / 妆造 / 五官微调全部在上一步「精调」完成；本步统一人物变量与环境氛围，批量生成一致性标准视角。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { Btn, Panel, Portrait, Seg, Tag, StatusPill } from "@/components/ui/primitives";
import { SourceBadge } from "@/components/common/source-badge";
import { Icons } from "@/components/ui/icons";
import { usePolling } from "@/lib/hooks";
import { templateBeautify } from "@/api/ai-avatar";
import { STYLE_TEMPLATES, styleHue } from "@/constants/aiavatar-ui";
import { toast } from "@/components/ui/toast";
import type { AiAvatarStandardShot } from "@ai-star-eco/types/ai-avatar";
import { USE_MOCK } from "@ai-star-eco/api-client";

type SixViewVariables = Record<string, string>;
type SpecialAngle = "overhead" | "low";

interface SixViewShotDef {
  id: string;
  name: string;
  usage: string;
  standardShot: AiAvatarStandardShot;
  ratio: string;
  main?: boolean;
  template: string;
}

interface SixViewShotPrompt extends Omit<SixViewShotDef, "template"> {
  prompt: string;
}

const SIX_VIEW_NEGATIVE_PROMPT =
  "畸形五官，面部扭曲，五官变形，多余肢体，水印，文字，logo，模糊，低画质，马赛克，画面裁切不全，透视畸变，浓妆，夸张表情，多人入镜，杂乱背景，涂鸦，阴影过重，脸部反光油腻";

const SIX_VIEW_VARIABLES = [
  { key: "人物颜值气质", label: "人物颜值气质", fallback: "超高颜值中国少女，肤白貌美，骨感美，高冷松弛，神态娇俏" },
  { key: "妆容风格", label: "妆容风格", fallback: "清透甜酷妆容，自然精致" },
  { key: "发型细节", label: "发型细节", fallback: "浅棕色发丝，自然散落，凌乱氛围感秀发" },
  { key: "人物肤质", label: "人物肤质", fallback: "肌肤细腻通透，肌理质感高级" },
  { key: "整体风格", label: "整体风格", fallback: "英伦写真、ins极简风、复古柔焦、艺术人像高级感" },
  { key: "画面氛围", label: "画面氛围", fallback: "慵懒迷人、柔和舒适、极简高级" },
  { key: "滤镜效果", label: "滤镜效果", fallback: "复古暧昧滤镜、柔焦美学" },
  { key: "光影模式", label: "光影模式", fallback: "单侧斜射伦勃朗光，明暗层次柔和，光影对比细腻" },
  { key: "背景效果", label: "背景效果", fallback: "大光圈浅景深，干净简约虚化背景，无杂乱元素" },
  { key: "画质参数", label: "画质参数", fallback: "8K超高清，电影柔光，无畸变，画质通透" },
] as const;

const SIX_VIEW_SHOTS: SixViewShotDef[] = [
  {
    id: "wide-full",
    name: "全景远景",
    usage: "开场 / 整体形象展示",
    standardShot: "front_full",
    ratio: "9:16",
    template: "9:16竖版，居中构图，【画质参数】，写实数字人，全景远景全身镜头，完整人物轮廓，面部五官自然。【整体风格】，【人物颜值气质】，【妆容风格】，【发型细节】。【光影模式】，【人物肤质】。【背景效果】，整体【画面氛围】，极具艺术人像高级感",
  },
  {
    id: "medium-half",
    name: "半身中景",
    usage: "主口播 / 常态展示",
    standardShot: "front_bust",
    ratio: "9:16",
    main: true,
    template: "9:16竖版，居中构图，【画质参数】，写实数字人，半身中景镜头，人物腰腹以上入镜，完整人物轮廓，面部五官自然。【整体风格】，【人物颜值气质】，【妆容风格】，【发型细节】。【光影模式】，【人物肤质】。【背景效果】，整体【画面氛围】，极具艺术人像高级感",
  },
  {
    id: "close-bust",
    name: "胸像近景",
    usage: "神态 / 卖点强调",
    standardShot: "front_bust",
    ratio: "9:16",
    template: "9:16竖版，居中构图，【画质参数】，写实数字人，胸像近景镜头，人物胸口以上入镜，聚焦面部神态，完整人物轮廓，面部五官自然。【整体风格】，【人物颜值气质】，【妆容风格】，【发型细节】。【光影模式】，【人物肤质】。【背景效果】，整体【画面氛围】，极具艺术人像高级感",
  },
  {
    id: "detail",
    name: "细节特写",
    usage: "细节 / 产品切换",
    standardShot: "expression",
    ratio: "9:16",
    template: "9:16竖版，居中构图，【画质参数】，写实数字人，细节特写镜头，聚焦面部五官与发丝纹理，面部五官自然无畸变。【整体风格】，【人物颜值气质】，【妆容风格】，【发型细节】。【光影模式】，光影层次极致细腻，【人物肤质】纹理清晰可见。超大光圈极致虚化背景，背景干净简约，整体【画面氛围】，极具艺术人像高级感",
  },
  {
    id: "side-45",
    name: "45度侧颜",
    usage: "氛围 / 转场",
    standardShot: "left_profile",
    ratio: "9:16",
    template: "9:16竖版，居中构图，【画质参数】，写实数字人，45度侧颜视角镜头，人物侧身站立，完整侧脸轮廓，完整人物轮廓，面部五官自然。【整体风格】，【人物颜值气质】，【妆容风格】，【发型细节】。【光影模式】，【人物肤质】。【背景效果】，整体【画面氛围】，极具艺术人像高级感",
  },
  {
    id: "angle-special",
    name: "特殊视角",
    usage: "俯拍 / 仰拍",
    standardShot: "right_profile",
    ratio: "9:16",
    template: "9:16竖版，居中构图，【画质参数】，写实数字人，【特殊视角】镜头，【特殊视角描述】，完整人物轮廓，面部五官自然。【整体风格】，【人物颜值气质】，【妆容风格】，【发型细节】。【光影模式】，【人物肤质】。【背景效果】，整体【画面氛围】，极具艺术人像高级感",
  },
];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = url;
  });
}

// 仅按构图比例裁切出图（不做美颜/编辑）。不同视角用不同裁切位移模拟「分视角」。
async function renderShot(img: HTMLImageElement, ratio: number, shot: string): Promise<string> {
  const W = 480;
  const H = Math.round(W / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  // 视角偏移：左/右侧脸水平偏移裁切窗口，全身略微下移，半身/表情居中。
  const shiftX = shot === "left_profile" ? -0.12 : shot === "right_profile" ? 0.12 : 0;
  const shiftY = shot === "front_full" ? 0.06 : -0.04;
  ctx.drawImage(img, (W - dw) / 2 + dw * shiftX, (H - dh) / 2 + dh * shiftY, dw, dh);
  return canvas.toDataURL("image/jpeg", 0.9);
}

const RATIO: Record<string, number> = { "3:4": 3 / 4, "9:16": 9 / 16, "1:1": 1 };
const previewGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 };

export function OutputStep({ detail, reload }: { detail: AiAvatarDetail; reload: () => void }) {
  const router = useRouter();
  const { avatar } = detail;
  const [selectedIds, setSelectedIds] = React.useState<string[]>(() => SIX_VIEW_SHOTS.map((s) => s.id));
  const [vars, setVars] = React.useState<SixViewVariables>(() => defaultSixViewVars(avatar));
  const [specialAngle, setSpecialAngle] = React.useState<SpecialAngle>("overhead");
  const [negativePrompt, setNegativePrompt] = React.useState(SIX_VIEW_NEGATIVE_PROMPT);
  const [editorView, setEditorView] = React.useState<"vars" | "prompts">("vars");
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const storyboard = React.useMemo(
    () => buildSixViewStoryboard(vars, specialAngle, negativePrompt),
    [vars, specialAngle, negativePrompt],
  );

  const job = detail.recentJobs.find((j) => (j.input as { kind?: string } | null)?.kind === "beautify");
  const liveShotAssets = React.useMemo(() => {
    const jobVersionAssetIds = new Set(
      detail.versions
        .filter((v) => !job?.id || v.jobId === job.id)
        .flatMap((v) => v.assetIds),
    );
    const pairs = detail.assets
      .filter((a) => a.standardShot && (jobVersionAssetIds.size === 0 || jobVersionAssetIds.has(a.id)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return new Map(pairs.map((a) => [a.standardShot, a]));
  }, [detail.assets, detail.versions, job?.id]);
  const running = !!job && (job.status === "running" || job.status === "queued");
  const done = !!job && job.status === "succeeded" && (
    USE_MOCK ? Object.keys(previews).length > 0 : selHasLiveAssets(storyboard.shots, selectedIds, liveShotAssets)
  );
  const phase: "config" | "gen" | "done" = running ? "gen" : done ? "done" : "config";
  usePolling(reload, 700, running);

  const toggle = (id: string) => setSelectedIds((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const selComps = storyboard.shots.filter((c) => selectedIds.includes(c.id));

  const run = async () => {
    if (!selectedIds.length) return;
    try {
      if (USE_MOCK && avatar.coverUrl) {
        const img = await loadImage(avatar.coverUrl);
        const next: Record<string, string> = {};
        for (const c of selComps) next[c.id] = await renderShot(img, RATIO[c.ratio] ?? 0.75, c.standardShot);
        setPreviews(next);
      } else {
        setPreviews({});
      }
      const selectedStoryboard = { ...storyboard, shots: selComps };
      await templateBeautify(avatar.id, {
        params: {
          shots: selectedIds,
          multiView: true,
          storyboard: selectedStoryboard,
          negativePrompt,
        },
      });
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "出图失败", { icon: "!", tone: "var(--err)" });
    }
  };

  const hue = styleHue(avatar.styleCategory);
  const copyPrompts = async () => {
    const text = selComps.map((s, i) => `${i + 1}. ${s.name}\n${s.prompt}`).join("\n\n") + `\n\n负向提示词\n${negativePrompt}`;
    await navigator.clipboard?.writeText(text);
    toast("已复制 6 个标准视角提示词");
  };

  return (
    <div style={{ padding: "28px 36px 60px", maxWidth: 1340, margin: "0 auto" }}>
      <PageHead no="STEP 06 · 标准素材图集" title="数字人 6 视角标准出图" status="pending_finalize" sub="基于前期定好的人设特点与环境氛围，按固定 6 镜头提示词生成标准数字人视角图集，用于后续保持形象一致性。"
        right={phase === "done" && <Btn variant="pri" size="lg" iconR={Icons.arrowR} onClick={() => router.push(`/avatars/${avatar.id}/finalize`)}>前往定稿</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 28, alignItems: "start" }}>
        {/* 左控制：标准 6 视角 + 统一变量 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Panel title="标准数字人 6 视角" right={<Tag>{selectedIds.length} / {SIX_VIEW_SHOTS.length}</Tag>}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {storyboard.shots.map((c, i) => {
                const on = selectedIds.includes(c.id);
                return (
                  <label key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "10px 11px", borderRadius: "var(--r-md)", cursor: "pointer", background: on ? "var(--bg-3)" : "var(--bg-2)", border: "1px solid " + (on ? "var(--line-2)" : "var(--line)") }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(c.id)} style={{ accentColor: "var(--accent)", width: 15, height: 15 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, color: "var(--ink-0)" }}>{String(i + 1).padStart(2, "0")} · {c.name}{c.main && <span style={{ marginLeft: 8 }}><Tag on>主力</Tag></span>}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-2)", marginTop: 3 }}>{c.usage}</span>
                    </span>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)", flexShrink: 0 }}>{c.ratio}</span>
                  </label>
                );
              })}
            </div>
          </Panel>
          <Panel
            title="统一变量替换"
            right={
              <Seg
                size="sm"
                value={editorView}
                onChange={setEditorView}
                options={[{ value: "vars", label: "变量" }, { value: "prompts", label: "提示词" }]}
              />
            }
            pad={14}
          >
            {editorView === "vars" && (
              <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {SIX_VIEW_VARIABLES.map((v) => (
                  <label key={v.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{v.label}</span>
                    <input
                      value={vars[v.key] ?? ""}
                      onChange={(e) => setVars((cur) => ({ ...cur, [v.key]: e.target.value }))}
                      style={sixViewInputStyle}
                    />
                  </label>
                ))}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 2 }}>
                  <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>特殊视角</span>
                  <Seg
                    size="sm"
                    value={specialAngle}
                    onChange={setSpecialAngle}
                    options={[{ value: "overhead", label: "俯拍" }, { value: "low", label: "仰拍" }]}
                  />
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>固定负向提示词</span>
                  <textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    rows={3}
                    style={{ ...sixViewInputStyle, resize: "vertical", lineHeight: 1.55 }}
                  />
                </label>
              </div>
            )}
            {editorView === "prompts" && (
              <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <Btn variant="line" size="sm" icon={Icons.copy} onClick={copyPrompts}>复制当前提示词</Btn>
                {selComps.map((shot, i) => (
                  <details key={shot.id} open={i < 1} style={{ padding: "9px 10px", borderRadius: 8, background: "var(--bg-2)", border: "1px solid var(--line)" }}>
                    <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--ink-0)" }}>
                      {String(i + 1).padStart(2, "0")} · {shot.name}
                      <span style={{ marginLeft: 8, color: "var(--ink-2)" }}>{shot.usage}</span>
                    </summary>
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)", lineHeight: 1.65 }}>{shot.prompt}</div>
                  </details>
                ))}
              </div>
            )}
          </Panel>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: 14, borderRadius: "var(--r-md)", background: "var(--bg-1)", border: "1px solid var(--line)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 }}>
            <Icons.wand size={15} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
            <span>这 6 个分镜用于生成数字人标准视角图集，不属于衍生视频。需要改妆容 / 美颜 / 脸型请回到<b style={{ color: "var(--ink-1)" }}>「精调」</b>。</span>
          </div>
          <Btn variant="pri" size="lg" full icon={Icons.layers} onClick={run} disabled={phase === "gen" || !selectedIds.length}>{phase === "gen" ? "批量出图中…" : "生成标准 6 视角图"}</Btn>
        </div>

        {/* 右预览 */}
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            <span>OUTPUT · 数字人标准 6 视角图集</span>
            <span>{phase === "done" ? "✓ 固定提示词 · PNG/JPG" : "全景 / 半身 / 胸像 / 特写 / 侧颜 / 特殊视角"}</span>
          </div>
          {phase === "config" && (
            <div style={previewGridStyle}>
              {selComps.map((c) => <Portrait key={c.id} hue={hue} src={avatar.coverUrl} ratio="9/16" label={c.name} sub={c.ratio + " · " + c.usage} dim />)}
            </div>
          )}
          {phase === "gen" && (
            <div style={previewGridStyle}>
              {selComps.map((c, i) => (
                <div key={c.id} style={{ aspectRatio: "9/16", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "linear-gradient(100deg, var(--bg-2) 30%, var(--bg-3) 50%, var(--bg-2) 70%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", animationDelay: i * 0.12 + "s", display: "grid", placeItems: "center" }}>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--signal)" }}>出图中</span>
                </div>
              ))}
            </div>
          )}
          {phase === "done" && (
            <div className="fade-up" style={previewGridStyle}>
              {selComps.map((c) => {
                const asset = liveShotAssets.get(c.standardShot);
                const src = USE_MOCK ? previews[c.id] : asset?.fileUrl;
                return (
                  <Portrait key={c.id} hue={hue} src={src} ratio="9/16" label={c.name} sub={c.ratio + " · 1080P"}
                    badge={<SourceBadge mode={USE_MOCK ? "mock" : asset?.providerMode} engine={USE_MOCK ? "多视角出图 (client)" : asset?.engine} />} />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function selHasLiveAssets(
  shots: Array<{ id: string; standardShot: AiAvatarStandardShot }>,
  selectedIds: string[],
  assets: Map<AiAvatarStandardShot | null | undefined, AiAvatarDetail["assets"][number]>,
) {
  return shots.some((s) => selectedIds.includes(s.id) && assets.has(s.standardShot));
}

const sixViewInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--line-2)",
  borderRadius: 8,
  background: "var(--bg-2)",
  color: "var(--ink-0)",
  padding: "8px 10px",
  fontSize: 12.5,
  outline: "none",
  fontFamily: "var(--font-ui)",
};

function defaultSixViewVars(avatar: AiAvatarDetail["avatar"]): SixViewVariables {
  const vars: SixViewVariables = Object.fromEntries(SIX_VIEW_VARIABLES.map((v) => [v.key, v.fallback]));
  if (avatar.persona) vars["人物颜值气质"] = avatar.persona;
  const styleName = STYLE_TEMPLATES.find((s) => s.id === avatar.styleCategory)?.name ?? avatar.styleCategory;
  if (styleName) vars["整体风格"] = `${styleName}，艺术人像高级感`;
  if (avatar.tags?.length) vars["画面氛围"] = `${avatar.tags.join("、")}，柔和舒适，极简高级`;
  return vars;
}

function buildSixViewStoryboard(variables: SixViewVariables, specialAngle: SpecialAngle, negativePrompt: string) {
  const angleVars = specialAngle === "overhead"
    ? { "特殊视角": "俯拍视角", "特殊视角描述": "从上往下拍摄人物上半身" }
    : { "特殊视角": "仰拍视角", "特殊视角描述": "从下往上拍摄人物，强化人物气场" };
  const allVars = { ...variables, ...angleVars };
  return {
    schema: "aiavatar-six-view-v1",
    aspectRatio: "9:16",
    negativePrompt,
    variables,
    specialAngle,
    shots: SIX_VIEW_SHOTS.map<SixViewShotPrompt>((shot) => ({
      id: shot.id,
      name: shot.name,
      usage: shot.usage,
      standardShot: shot.standardShot,
      ratio: shot.ratio,
      main: shot.main,
      prompt: replaceTemplateVars(shot.template, allVars),
    })),
  };
}

function replaceTemplateVars(template: string, variables: Record<string, string>) {
  return template.replace(/【([^】]+)】/g, (_, key: string) => variables[key] || "");
}

export function PageHead({ no, title, status, sub, right }: { no: string; title: string; status?: string; sub: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", color: "var(--accent)", marginBottom: 8 }}>{no}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>{title}</h1>
          {status && <StatusPill status={status} />}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--ink-1)", marginTop: 8 }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}
