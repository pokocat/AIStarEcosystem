// Static design export only: one sample short drama so the director workbench has something to show.
import type { DirectorAsset, DirectorClip, DirectorMedia, DirectorMediaSlot, DirectorPipelineEstimate, DirectorQuote, DirectorShot, DirectorWork, DirectorWorkSummary } from "@ai-star-eco/types";

const AT = "2026-11-01T02:30:00Z";
const media = (id: string, url: string, prompt = ""): DirectorMedia => ({ id, key: `demo/${id}`, url, runId: null, source: "generated", createdAt: AT, prompt });
const adopted = (id: string, url: string, prompt = ""): DirectorMediaSlot => ({ candidates: [media(id, url, prompt)], adoptedId: id, adoptedBy: "user", error: null, adoptedCheck: "current", staleReasons: [] });
const empty = (): DirectorMediaSlot => ({ candidates: [], adoptedId: null, adoptedBy: null, error: null });

const ASSETS: DirectorAsset[] = [
  { id: "a-lin", kind: "character", name: "林晚", aliases: ["晚晚"], description: "二十六岁，便利店夜班店员。短发，常穿深绿色工装外套，说话慢，遇事先观察。", prompt: "角色设定集，二十六岁女性，短发，深绿色工装外套，全身三视图与表情。", promptCustom: false, episodeIds: ["e1", "e2"], image: adopted("m-lin", "/generated/avatar-previews/example-lin-xiaoman.jpg"), voice: null, voiceDesc: "女声，青年音色，语调偏低，语速慢", rev: 1 },
  { id: "a-he", kind: "character", name: "何屿", aliases: [], description: "三十岁，自称外卖员，每晚十一点来买同一种热牛奶。袖口有一道旧疤。", prompt: "角色设定集，三十岁男性，外卖骑手冲锋衣，袖口旧疤。", promptCustom: false, episodeIds: ["e1", "e2"], image: adopted("m-he", "/generated/avatar-previews/example-he-yu.jpg"), voice: null, voiceDesc: "男声，语调平，声音略哑", rev: 1 },
  { id: "a-store", kind: "scene", name: "雨夜便利店", aliases: ["便利店"], description: "老城区街角的 24 小时便利店。冷白灯管，玻璃门外下着雨，收银台旁有一台热饮柜。", prompt: "雨夜街角便利店内景，冷白灯光，玻璃门外雨水。", promptCustom: false, episodeIds: ["e1", "e2"], image: adopted("m-store", "/studio/scene-covers/drama-suspense.webp"), voice: null, rev: 1 },
  { id: "a-receipt", kind: "prop", name: "旧小票", aliases: [], description: "一张三年前的购物小票，背面写着一个电话号码。", prompt: "", promptCustom: false, episodeIds: ["e2"], image: empty(), voice: null, rev: 1 },
];

function shots(list: Array<[number, string, string, string, string, Array<[string | null, string]>]>): DirectorShot[] {
  let t = 0;
  return list.map(([durationSec, size, camera, action, still, lines], i) => {
    const s: DirectorShot = { id: `s${i + 1}`, durationSec, startSec: t, endSec: t + durationSec, size, camera, action, still, dialogue: lines.map(([speakerId, text]) => ({ speakerId, text })) };
    t += durationSec;
    return s;
  });
}

function clip(id: string, order: number, title: string, summary: string, cover: string | null, list: Parameters<typeof shots>[0], assetIds: string[], extra: Partial<DirectorClip> = {}): DirectorClip {
  const s = shots(list);
  return {
    id, episodeId: "e1", order, title, summary, durationSec: s.reduce((n, x) => n + x.durationSec, 0), assetIds, shots: s,
    boardPrompt: `竖版分镜图，${summary}`, boardPromptCustom: false,
    videoPrompt: `【人物】林晚、何屿\n【分镜参考】图1\n【画面】${s.map((x, i) => `第${i + 1}镜（${x.startSec}–${x.endSec} 秒）：${x.action}`).join("\n")}\n【声音】雨声，灯管低鸣\n【配乐】无`,
    videoPromptCustom: false, board: cover ? adopted(`m-${id}`, cover) : empty(), video: empty(), issues: [], warnings: [], unvoiced: ["林晚", "何屿"], voiced: [], videoPromptRewrite: "needed", videoPromptEn: null, sourceQuote: null, rev: 1, ...extra,
  };
}

const CLIPS: DirectorClip[] = [
  clip("c1", 1, "十一点的客人", "雨夜，何屿推门进来，照旧拿一瓶热牛奶。", "/studio/scene-covers/drama-suspense.webp", [
    [3, "全景", "固定机位", "玻璃门被推开，雨声涌进来，何屿收起雨衣帽子。", "门刚推开一半", []],
    [4, "中景", "缓慢推近", "林晚从收银台抬头，看一眼墙上的钟。", "林晚看向钟", [["a-lin", "又是十一点。"]]],
    [4, "近景", "正反打", "何屿把热牛奶放到台面上，袖口露出旧疤。", "牛奶落在台面", [["a-he", "老样子。"]]],
  ], ["a-lin", "a-he", "a-store"], { video: adopted("v-c1", "/sample-video.mp4") }),
  clip("c2", 2, "袖口的疤", "林晚注意到那道疤，想起三年前的事。", "/studio/scene-covers/drama-emotional.webp", [
    [4, "特写", "固定机位", "扫码枪的红光扫过牛奶，林晚的视线停在他袖口。", "视线落在袖口", []],
    [4, "近景", "轻微手持", "林晚抬眼，声音放得很轻。", "林晚抬眼", [["a-lin", "你手上这道疤，怎么来的？"]]],
    [4, "近景", "正反打", "何屿拉下袖口，没有看她。", "袖口被拉下", [["a-he", "送单摔的。"]]],
  ], ["a-lin", "a-he"]),
  clip("c3", 3, "没有付的钱", "何屿走后，林晚发现台面上多了一张旧小票。", null, [
    [4, "全景", "固定机位", "何屿推门离开，门铃响了一声。", "门铃晃动", []],
    [4, "特写", "缓慢下摇", "台面上压着一张泛黄的小票。", "小票一角翘起", []],
    [4, "近景", "缓慢推近", "林晚翻过小票，背面有一行手写的号码。", "手指捏住小票", [["a-lin", "这是我的字。"]]],
  ], ["a-lin", "a-store"], { warnings: ["第 2 镜和第 3 镜景别相近，可以换一个景别"] }),
];

function base(id: string, title: string, idea: string): DirectorWork {
  return {
    id, title, revision: 1, createdAt: AT, updatedAt: AT, idea, genre: null, tone: null, logline: "", outline: null,
    draft: "", draftRev: 0, draftEpisodeHeadings: 0, reference: "", referenceRev: 0, pendingSplit: null, canUndoSplit: false,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", textModel: null, videoModel: null, imageModel: null },
    episodes: [], assets: [], clips: [], exports: [], pipeline: null, notice: null, pendingExtract: null, scriptHistory: [], textError: null, brief: null, restoredAt: null, assistant: null, tasks: [],
    pricing: { textMax: 20, image: 16, mock: false, textChars: 24000 },
    imageModels: [{ id: "image-default", name: "默认图片模型", isDefault: true, creditCost: 16 }],
    imageModelState: { id: "image-default", name: "默认图片模型", explicit: false, available: true, creditCost: 16, missingRatios: [] },
    textModelMode: "fixed", textModels: [],
    videoModels: [{ id: "video-default", name: "H3", isDefault: true, minSec: 4, maxSec: 15, mode: "omni" }],
    videoLimits: { model: "video-default", name: "H3", minSec: 4, maxSec: 15, mock: false, mode: "omni", maxShots: 6 },
  };
}

const works = new Map<string, DirectorWork>();
function seed() {
  if (works.size) return;
  const w = base("DW-demo01", "雨夜便利店", "一个夜班店员发现，每晚来买牛奶的外卖员，和她三年前失踪的朋友有关。");
  w.logline = "夜班店员林晚从一张旧小票上，认出了自己三年前写下的号码。";
  w.outline = {
    world: "老城区街角，一家 24 小时便利店。", plot: "林晚发现常客何屿的旧疤，顺着小票追查三年前的旧事。", reversals: "小票上的字是林晚自己写的。", theme: "人会为了别人，忘掉自己。",
    characters: [
      { name: "林晚", age: "26", identity: "便利店夜班店员", secret: "三年前的记忆有缺口", flaw: "习惯旁观", arc: "从旁观到追问" },
      { name: "何屿", age: "30", identity: "外卖员", secret: "一直在确认林晚是否记得", flaw: "不肯开口", arc: "从回避到坦白" },
    ],
  };
  w.episodes = [
    { id: "e1", no: 1, title: "十一点的客人", summary: "林晚注意到常客袖口的疤，发现一张旧小票。", content: "【雨夜便利店·内·夜】\n\n玻璃门被推开，雨声涌进来。何屿收起雨衣帽子，径直走向热饮柜。\n\n林晚（看一眼墙上的钟）：又是十一点。\n\n何屿把热牛奶放到台面上。\n\n何屿：老样子。\n\n扫码枪的红光扫过牛奶，林晚的视线停在他袖口，那里有一道旧疤。\n\n林晚：你手上这道疤，怎么来的？\n\n何屿（拉下袖口）：送单摔的。\n\n他推门离开。台面上多了一张泛黄的小票。林晚翻过来，背面有一行手写的号码。\n\n林晚：这是我的字。", extracted: true, planStale: false, planError: null, pendingPlan: null, rev: 1 },
    { id: "e2", no: 2, title: "打不通的号码", summary: "林晚拨通小票上的号码，电话在店里响了起来。", content: "【雨夜便利店·内·夜】\n\n第二天夜里，林晚拿着小票，拨通了那个号码。\n\n货架后面，一部旧手机亮了起来。", extracted: true, planStale: false, planError: null, pendingPlan: null, rev: 1 },
  ];
  w.assets = structuredClone(ASSETS);
  w.clips = structuredClone(CLIPS);
  works.set(w.id, w);
}

export function fixtureSummaries(): DirectorWorkSummary[] {
  seed();
  return [...works.values()].map(w => ({
    id: w.id, title: w.title, episodeCount: w.episodes.length, assetCount: w.assets.length, clipCount: w.clips.length,
    boardCount: w.clips.filter(c => c.board.adoptedId).length, videoCount: w.clips.filter(c => c.video.adoptedId).length,
    hasScript: !!w.draft || w.episodes.length > 0, running: false, updatedAt: w.updatedAt,
    coverUrl: w.clips.find(c => c.board.adoptedId)?.board.candidates[0]?.url ?? null,
  }));
}

export function fixtureWork(id: string): DirectorWork | null { seed(); const w = works.get(id); return w ? structuredClone(w) : null; }

export function fixtureCreate(body: { title?: string; idea?: string; script?: string }): DirectorWork {
  seed();
  const w = base(`DW-${Date.now().toString(36)}`, body.title?.trim() || "未命名作品", body.idea ?? "");
  w.draft = body.script ?? "";
  works.set(w.id, w);
  return structuredClone(w);
}

export function fixturePatch(id: string, body: { title?: string; idea?: string; draft?: string; settings?: Partial<DirectorWork["settings"]> }): DirectorWork | null {
  const w = works.get(id);
  if (!w) return null;
  if (body.title !== undefined) w.title = body.title;
  if (body.idea !== undefined) w.idea = body.idea;
  if (body.draft !== undefined) { w.draft = body.draft; w.draftRev += 1; }
  if (body.settings) w.settings = { ...w.settings, ...body.settings };
  w.revision += 1;
  return structuredClone(w);
}

export const fixtureQuote = (targetIds: string[]): DirectorQuote => ({ items: targetIds.map(targetId => ({ targetId, credits: 480, error: null })) });

export const fixtureEstimate = (target: DirectorPipelineEstimate["target"]): DirectorPipelineEstimate => ({
  target, rough: false, total: 1560, recommended: 1800,
  text: { count: 2, credits: 40 }, images: { count: 4, credits: 64 }, videos: { included: true, clips: 3, seconds: 36, credits: 1440, error: null },
});
