// ─────────────────────────────────────────────────────────────────────────────
// mocks/ip-studio.ts — NEXT_PUBLIC_USE_MOCK=1 时的内存实现（无网络）。
//
// 提供：2 套内置工作流模板 / 6 套风格预设 / 2 个样例项目 / 一个本地运行模拟器
// （约 3 秒推完进度，产出占位候选图）。占位图会在界面上打「示例」角标，
// 绝不与真产物混淆（AGENTS.md §8.0 (c)）。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  IpCandidate, IpProject, IpProjectDoc, IpPricing, IpRun, IpRunInputs,
  IpStylePreset, IpTemplate, IpPromptGroup,
} from "@ai-star-eco/types";
import { collectGenerateInputs, identitySource } from "@/lib/graph";
import { SERVER_TEMPLATES } from "./templates";

// ── 风格预设 ─────────────────────────────────────────────────────────────────

/** 内置提示词模板 —— 与 server `resources/ipstudio/prompt-presets.json` 保持一致。 */
export const MOCK_PROMPT_GROUPS: IpPromptGroup[] = [
  {
    id: "outfit", name: "装扮", summary: "同一个人的几套穿搭。跑之前主形象必须先定，它是参考图第一顺位。",
    presets: [
      { id: "outfit-daily-f", name: "日常潮玩", gender: "female", prompt: "戴米白色贴布冷帽、圆形金边墨镜架在帽子上，嘴里叼着棒棒糖，穿浅驼色露肩针织衫和高腰破洞浅色牛仔裤，配复古厚底老爹鞋。略侧身站立，重心落在一侧，肩线自然放松。纯色干净的棚拍背景，专业柔和的三点式摄影灯光。" },
      { id: "outfit-work-f", name: "商务通勤", gender: "female", prompt: "合身西装外套内搭真丝衬衫，下身直筒西裤，配简约乐福鞋。正面站立，肩线放松，一只手自然垂放于身侧。纯色干净的棚拍背景，专业柔和的三点式摄影灯光。" },
      { id: "outfit-sport-f", name: "运动休闲", gender: "female", prompt: "宽松连帽卫衣配阔腿运动裤与厚底板鞋，袖口自然挽起。重心偏移的放松站姿，一只手插在卫衣口袋里。纯色干净的棚拍背景，专业柔和的三点式摄影灯光。" },
      { id: "outfit-winter-f", name: "季节厚织", gender: "female", prompt: "长款羊毛大衣内搭高领毛衣，配同色系围巾与短靴。双手插在大衣口袋，肩部微收。纯色干净的棚拍背景，专业柔和的三点式摄影灯光。" },
      { id: "outfit-daily-m", name: "日常潮玩", gender: "male", prompt: "戴棒球帽，穿宽松卫衣与工装长裤，脚踩高帮板鞋。正面站立，肩线平直，重心居中，一只手随意插在裤袋里。纯色干净的棚拍背景，专业柔和的三点式摄影灯光。" },
      { id: "outfit-work-m", name: "商务通勤", gender: "male", prompt: "剪裁利落的西装外套内搭素色衬衫，直筒西裤配德比鞋。正面站立，双手自然垂放于身侧，肩线平直。纯色干净的棚拍背景，专业柔和的三点式摄影灯光。" },
      { id: "outfit-sport-m", name: "运动休闲", gender: "male", prompt: "宽松运动卫衣配束脚运动裤与跑鞋，外搭一件轻薄防风外套。正面站立，一只手扶着肩带。纯色干净的棚拍背景，专业柔和的三点式摄影灯光。" },
      { id: "outfit-winter-m", name: "季节厚织", gender: "male", prompt: "厚织高领毛衣外搭羊毛大衣，配深色直筒裤与切尔西靴。正面站立，双手插在大衣口袋。纯色干净的棚拍背景，专业柔和的三点式摄影灯光。" },
      { id: "outfit-neutral", name: "中性单品", gender: "any", prompt: "宽松素色卫衣配直筒长裤与白色板鞋，整体无明显性别指向。正面站立，双手自然垂放。纯色干净的棚拍背景，专业柔和的三点式摄影灯光。" },
    ],
  },
  {
    id: "expression", name: "表情", summary: "男女共用同一套。每条都锁死服装、机位与光线 —— 这是能成套用的前提。",
    presets: [
      { id: "expr-laugh", name: "开心大笑", gender: "any", prompt: "面部表情为开怀大笑，双眼弯成月牙，嘴角大幅上扬露出牙齿，肩膀微微上耸。服装、机位、光线与主形象完全一致，只改表情。" },
      { id: "expr-surprise", name: "惊讶", gender: "any", prompt: "双眼睁大，眉毛高高扬起，嘴巴张成小圆形，一只手轻抬到脸颊旁。服装、机位、光线与主形象完全一致，只改表情与这一个手部动作。" },
      { id: "expr-think", name: "思考", gender: "any", prompt: "眼神向上方偏移，眉头轻皱，一只手托着下巴。服装、机位、光线与主形象完全一致，只改表情与这一个手部动作。" },
      { id: "expr-helpless", name: "无奈", gender: "any", prompt: "嘴角向一侧撇，眉毛一高一低，双手摊开做出无奈的手势。服装、机位、光线与主形象完全一致，只改表情与手势。" },
      { id: "expr-smug", name: "得意", gender: "any", prompt: "下巴微抬，单侧嘴角上扬，眼神带笑地斜看镜头。服装、机位、光线与主形象完全一致，只改表情。" },
      { id: "expr-sleepy", name: "犯困", gender: "any", prompt: "眼皮半垂，嘴巴微张打哈欠，一只手抬起揉眼睛。服装、机位、光线与主形象完全一致，只改表情与这一个手部动作。" },
    ],
  },
  {
    id: "motion", name: "短动作", summary: "男女共用。每段 2–3 秒循环，产出带透明通道的动图，名片的「微动」档直接用。注意：短动作走数字资产的视频衍生链路，必须在工作台发布之后才能跑。",
    presets: [
      { id: "motion-wave", name: "打招呼挥手", gender: "any", prompt: "2 秒循环。抬起一只手向镜头方向自然挥动两下，脸上带轻松微笑，其余身体保持静止。服装、机位、光线与主形象完全一致。循环的首帧与末帧必须完全一致，不得跳变。", durationSec: 2 },
      { id: "motion-nod", name: "点头认可", gender: "any", prompt: "1.5–2 秒循环。头部自然向下点两次，幅度轻微，视线始终看向镜头，肩部不动。服装、机位、光线与主形象完全一致。循环的首帧与末帧必须完全一致。", durationSec: 2 },
      { id: "motion-point-down", name: "指向下方", gender: "any", prompt: "2 秒。抬起手臂伸出食指，动作自然、明确地向下方指一下，随后收回。用于引导访客向下滑动。服装、机位、光线与主形象完全一致，身体不得瞬移或跳帧。", durationSec: 2 },
    ],
  },
];

export const MOCK_STYLES: IpStylePreset[] = [
  {
    id: "bjd",
    name: "3D 潮玩娃娃",
    summary: "光滑树脂质感的收藏级潮玩娃娃，大眼、细腻高光，摆在展示台上的感觉",
    promptEn:
      "3D BJD collectible doll figure, glossy resin skin, oversized glossy eyes, delicate specular highlights, studio softbox lighting, shallow depth of field, product photography of a designer toy",
    negativeEn: "flat illustration, harsh shadows, plastic seams, text, watermark",
  },
  {
    id: "chibi",
    name: "Q 版厚涂",
    summary: "两头身的圆润 Q 版，厚涂笔触与柔和描边，适合表情包与贴纸",
    promptEn:
      "chibi character, two-head-tall proportions, thick painted brush strokes, soft outline, rounded shapes, warm ambient light, sticker-friendly clean background",
    negativeEn: "realistic proportions, gritty texture, text, watermark",
  },
  {
    id: "pixar3d",
    name: "三维动画电影",
    summary: "动画长片主角质感，柔和次表面散射与电影级打光",
    promptEn:
      "stylized 3D animated feature film character, subsurface scattering skin, cinematic three point lighting, soft global illumination, high detail hair strands",
    negativeEn: "photorealistic pores, uncanny valley, text, watermark",
  },
  {
    id: "flat-vector",
    name: "扁平矢量",
    summary: "干净的扁平色块与几何造型，做品牌形象与图标最省事",
    promptEn:
      "flat vector illustration, clean geometric shapes, limited palette, crisp edges, no gradients, brand mascot style, plain background",
    negativeEn: "photographic texture, noise, gradient mesh, text, watermark",
  },
  {
    id: "guochao-ink",
    name: "国潮水墨",
    summary: "水墨笔触与朱红点缀的东方感，衣饰纹样考究",
    promptEn:
      "Chinese ink painting style character, flowing brush strokes, rice paper texture, vermilion accent seals, traditional pattern details on garments",
    negativeEn: "western cartoon, neon colors, text, watermark",
  },
  {
    id: "clay",
    name: "黏土定格",
    summary: "手捏黏土定格动画质感，指纹与颗粒都留着",
    promptEn:
      "handmade clay stop-motion character, visible fingerprint texture, matte plasticine surface, miniature set lighting, tilt shift",
    negativeEn: "smooth cg render, glossy plastic, text, watermark",
  },
];

// ── 内置工作流模板 ───────────────────────────────────────────────────────────
//
// 直接用服务端那两份模板 JSON 的副本（见 mocks/templates/index.ts 的说明）。
// mock 与真后端必须是同一张图，否则输入闸门这类缺陷会被 mock 掩盖。

export const MOCK_TEMPLATES: IpTemplate[] = SERVER_TEMPLATES;

export const MOCK_PRICING: IpPricing = { identityCredits: 2, imageCredits: 8 };

// ── 占位图（示例产物，界面上会打「示例」角标） ───────────────────────────────

export function mockPlaceholderImage(caption: string, seed: number): string {
  const hue = (198 + seed * 41) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="512" viewBox="0 0 384 512">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="hsl(${hue},58%,90%)"/>
    <stop offset="1" stop-color="hsl(${hue},38%,70%)"/>
  </linearGradient>
  <linearGradient id="fig" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue},30%,99%)"/>
    <stop offset="1" stop-color="hsl(${hue},28%,80%)"/>
  </linearGradient>
</defs>
<rect width="384" height="512" fill="url(#bg)"/>
<ellipse cx="192" cy="470" rx="96" ry="16" fill="hsl(${hue},30%,55%)" opacity="0.22"/>
<path d="M112 470 Q112 330 192 322 Q272 330 272 470 Z" fill="url(#fig)"/>
<circle cx="192" cy="248" r="82" fill="url(#fig)"/>
<circle cx="164" cy="244" r="13" fill="hsl(${hue},34%,26%)"/>
<circle cx="220" cy="244" r="13" fill="hsl(${hue},34%,26%)"/>
<circle cx="159" cy="239" r="4" fill="#fff"/>
<circle cx="215" cy="239" r="4" fill="#fff"/>
<path d="M176 282 Q192 296 208 282" stroke="hsl(${hue},34%,32%)" stroke-width="6" fill="none" stroke-linecap="round"/>
<text x="192" y="70" text-anchor="middle" font-family="monospace" font-size="17" letter-spacing="3" fill="hsl(${hue},32%,32%)">MOCK · 示例图</text>
<text x="192" y="98" text-anchor="middle" font-family="sans-serif" font-size="15" fill="hsl(${hue},28%,38%)">${caption}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ── 内存 store ───────────────────────────────────────────────────────────────

interface MockRunEntry {
  run: IpRun;
  startedAtMs: number;
  durationMs: number;
  caption: string;
  cancelled: boolean;
}

interface MockStore {
  projects: Map<string, IpProject>;
  runs: Map<string, MockRunEntry>;
  seq: number;
}

let store: MockStore | null = null;

function nowIso() {
  return new Date().toISOString();
}

function shortId(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(4, "0")}${Math.random().toString(36).slice(2, 6)}`;
}

/** 已完成的样例主形象运行（让样例项目一进去就能看到候选与选图交互）。 */
function seedMasterRun(projectId: string, nodeId: string): IpRun {
  const candidates: IpCandidate[] = Array.from({ length: 4 }, (_, i) => ({
    key: `ipstudio/gen/${projectId}/${nodeId}/${i}.png`,
    url: mockPlaceholderImage(`主形象候选 ${i + 1}`, i),
  }));
  return {
    id: "IPR-0001seed",
    projectId,
    nodeId,
    kind: "generate",
    status: "done",
    stage: "done",
    pct: 100,
    cost: MOCK_PRICING.imageCredits * 4,
    inputs: {
      prompt:
        "3D BJD collectible doll figure, glossy resin skin, oversized glossy eyes, delicate specular highlights, studio softbox lighting || a young woman with a soft oval face, straight shoulder-length dark hair with bangs, warm almond eyes || full body, neutral standing pose, plain studio backdrop || same person, same face, exactly one character, no multi-view grid, no text",
      refs: [{ role: "source", applied: true }],
      size: "768x1024",
      count: 4,
    },
    output: { candidates },
    createdAt: nowIso(),
    finishedAt: nowIso(),
  };
}

function seedStore(): MockStore {
  const s: MockStore = { projects: new Map(), runs: new Map(), seq: 10 };

  // 样例一：从潮玩三连模板建的草稿，照片与特征卡已填、主形象已出候选待选。
  const draftDoc: IpProjectDoc = JSON.parse(JSON.stringify(MOCK_TEMPLATES[0]!.doc)) as IpProjectDoc;
  for (const n of draftDoc.nodes) {
    if (n.type === "source") {
      n.data.imageUrl = mockPlaceholderImage("原始照片", 9);
      n.data.assetKey = "ipstudio/source/mock/portrait.jpg";
      n.data.fileName = "我的照片.jpg";
    }
    if (n.type === "identity") {
      n.data.text =
        "核心气质：亲和、干净的都市感\n脸型：柔和的鹅蛋脸，下颌线条不锋利\n眼睛：温暖的杏眼，双眼皮，眼神平和\n发型：齐肩直发，有薄刘海，发色深棕\n肤色：偏白的暖调\n识别特征：右眼下方一颗小痣";
      n.data.promptEn =
        "a young woman with a soft oval face, warm almond eyes with double eyelids, straight shoulder-length dark brown hair with thin bangs, fair warm skin tone, a small mole under the right eye, approachable clean urban vibe";
      n.data.locked = true;
      n.data.fromRunId = "IPR-0000seed";
    }
    if (n.type === "publish") n.data.avatarName = "";
  }
  const seedRun = seedMasterRun("IPP-0001mock", "n-master");
  const draft: IpProject = {
    id: "IPP-0001mock",
    name: "我的潮玩 IP",
    templateId: "portrait-bjd-trio",
    status: "draft",
    coverUrl: seedRun.output.candidates?.[0]?.url,
    createdAt: "2026-09-04T09:12:00Z",
    updatedAt: "2026-09-06T02:41:00Z",
    doc: draftDoc,
    runs: { "n-master": seedRun },
    runsById: { [seedRun.id]: seedRun },
  };
  s.projects.set(draft.id, draft);

  // 样例二：已发布的表情包项目（只读展示发布态）。
  const publishedDoc = JSON.parse(JSON.stringify(MOCK_TEMPLATES[1]!.doc)) as IpProjectDoc;
  const published: IpProject = {
    id: "IPP-0002mock",
    name: "小柚表情包",
    templateId: "portrait-sticker-six",
    status: "published",
    coverUrl: mockPlaceholderImage("小柚 · 主形象", 3),
    publishedAvatarId: "DH-2087",
    createdAt: "2026-08-22T06:00:00Z",
    updatedAt: "2026-08-29T11:20:00Z",
    doc: publishedDoc,
    runs: {},
    runsById: {},
  };
  s.projects.set(published.id, published);

  return s;
}

export function mockStore(): MockStore {
  if (!store) store = seedStore();
  return store;
}

export function mockNextId(prefix: string): string {
  const s = mockStore();
  s.seq += 1;
  return shortId(prefix, s.seq);
}

// ── 提示词编译（与服务端模板同形，供「本次实际提示词」展示） ────────────────

export function mockCompilePrompt(doc: IpProjectDoc, nodeId: string): { prompt: string; inputs: IpRunInputs; caption: string } {
  const node = doc.nodes.find((n) => n.id === nodeId);
  if (!node || node.type !== "generate") {
    return { prompt: "", inputs: {}, caption: "示例" };
  }
  const { identity, style, look, source, master, references } = collectGenerateInputs(doc, nodeId);
  const parts = [
    style?.data.promptEn ?? "",
    identity?.data.promptEn ?? "",
    look ? [look.data.outfit, look.data.pose, look.data.expression, look.data.details, look.data.props].filter(Boolean).join(", ") : "full body, neutral standing pose",
    references.map((r, i) => `Reference image ${i + 1}: ${r.data.note || "style reference only"}`).join("; "),
    "same person, same face as the reference, exactly one character, no multi-view grid, no text, no watermark",
  ].filter((p) => p && p.trim());

  const refs: NonNullable<IpRunInputs["refs"]> = [];
  const maxRefs = 4;
  const candidates: Array<{ role: "master" | "source" | "reference"; present: boolean }> = [
    { role: "master", present: Boolean(master && master.data.selectedRunId) },
    { role: "source", present: Boolean(source && (source.data.imageUrl || source.data.assetKey)) },
    ...references.map((r) => ({ role: "reference" as const, present: Boolean(r.data.imageUrl || r.data.assetKey) })),
  ];
  let applied = 0;
  for (const c of candidates) {
    if (!c.present) continue;
    if (applied < maxRefs) {
      refs.push({ role: c.role, applied: true });
      applied += 1;
    } else {
      refs.push({ role: c.role, applied: false, reason: "over_max_refs" });
    }
  }

  return {
    prompt: parts.join(" || "),
    inputs: { prompt: parts.join(" || "), refs, size: node.data.size, count: node.data.count },
    caption: look?.data.title ?? (node.data.isMaster ? "主形象" : node.label ?? "形象"),
  };
}

const IDENTITY_SAMPLE_TEXT =
  "核心气质：干净、有亲和力\n脸型：柔和的鹅蛋脸\n眼睛：杏眼，双眼皮，眼神平和\n发型：齐肩直发，薄刘海，深棕色\n肤色：偏白暖调\n识别特征：右眼下方一颗小痣";
const IDENTITY_SAMPLE_EN =
  "a young person with a soft oval face, almond eyes with double eyelids, straight shoulder-length dark brown hair with thin bangs, fair warm skin, a small mole under the right eye, clean approachable vibe";

// ── 运行模拟器 ───────────────────────────────────────────────────────────────

export function mockStartRun(projectId: string, nodeId: string, doc: IpProjectDoc): IpRun {
  const s = mockStore();
  const project = s.projects.get(projectId);
  if (project) project.doc = doc;
  const node = doc.nodes.find((n) => n.id === nodeId);
  const kind: IpRun["kind"] = node?.type === "identity" ? "identity" : "generate";
  const runId = mockNextId("IPR");

  let inputs: IpRunInputs = {};
  let caption = "示例";
  let cost = MOCK_PRICING.identityCredits;
  if (kind === "generate" && node?.type === "generate") {
    const compiled = mockCompilePrompt(doc, nodeId);
    inputs = compiled.inputs;
    caption = compiled.caption;
    cost = MOCK_PRICING.imageCredits * node.data.count;
  } else if (kind === "identity") {
    const src = identitySource(doc, nodeId);
    inputs = { refs: src ? [{ role: "source", applied: true }] : [] };
  }

  const run: IpRun = {
    id: runId,
    projectId,
    nodeId,
    kind,
    status: "running",
    stage: "queued",
    pct: 2,
    cost,
    inputs,
    output: {},
    createdAt: nowIso(),
  };
  s.runs.set(runId, { run, startedAtMs: Date.now(), durationMs: 3000, caption, cancelled: false });
  return { ...run };
}

export function mockReadRun(runId: string): IpRun {
  const s = mockStore();
  const entry = s.runs.get(runId);
  if (!entry) {
    // 样例项目里的 seed run 是 done 状态、不进模拟器
    for (const p of s.projects.values()) {
      const found = p.runsById?.[runId] ?? Object.values(p.runs).find((r) => r.id === runId);
      if (found) return { ...found };
    }
    throw new Error("找不到这次运行记录");
  }
  const { run } = entry;
  if (run.status !== "running") return { ...run };

  if (entry.cancelled) {
    run.status = "failed";
    run.stage = "cancelled";
    run.pct = 100;
    run.cost = 0;
    run.errorCode = "IP_RUN_CANCELLED";
    run.errorMessage = "这次生成已被你取消，积分已退回。";
    run.finishedAt = nowIso();
    return { ...run };
  }

  const elapsed = Date.now() - entry.startedAtMs;
  const ratio = Math.min(1, elapsed / entry.durationMs);
  run.pct = Math.round(Math.min(99, ratio * 100));
  const count = run.inputs.count ?? 1;
  if (ratio < 0.15) run.stage = "queued";
  else if (ratio < 0.3) run.stage = "prompt.compile";
  else if (ratio < 0.9) run.stage = `image.generate.${Math.max(1, Math.ceil((ratio - 0.3) / 0.6 * count))}`;
  else run.stage = "storage.persist";

  if (ratio >= 1) {
    run.status = "done";
    run.stage = "done";
    run.pct = 100;
    run.finishedAt = nowIso();
    if (run.kind === "generate") {
      run.output = {
        candidates: Array.from({ length: count }, (_, i) => ({
          key: `ipstudio/gen/${run.projectId}/${run.nodeId}/${run.id}-${i}.png`,
          url: mockPlaceholderImage(`${entry.caption} 候选 ${i + 1}`, i + run.id.length),
        })),
      };
    } else {
      run.output = { text: IDENTITY_SAMPLE_TEXT, promptEn: IDENTITY_SAMPLE_EN };
    }
    // 把最新一次运行投影回项目（与服务端 runs 投影同语义）
    const project = s.projects.get(run.projectId);
    if (project) {
      project.runs = { ...project.runs, [run.nodeId]: { ...run } };
      project.runsById = { ...project.runsById, [run.id]: { ...run } };
    }
  }
  return { ...run };
}

export function mockCancelRun(runId: string): IpRun {
  const entry = mockStore().runs.get(runId);
  if (entry) entry.cancelled = true;
  return mockReadRun(runId);
}
