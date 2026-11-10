// AI 视频页：编导写的六段脚本里，哪些发给视频模型、哪些只给人看（2026-11-10，用户定的分层）。
// 脚本只有一份，用户看、改、采用的都是它；出片时由这里挑出和画面有关的部分。判断只在这一处（§8.0.1 ④），
// 页面上的「仅参考」标注、字数上限、直接生成、视频裂变用的都是这里的结果；H3 的提示词优化收到的也是挑过的内容。
//
// 一、剧情概述：不发（编导的思路）。
// 二、素材与职责：压成一行对照「素材：图1 牛杂煲参考；图2 …」，Seedance 靠它知道哪张图是谁。
// 三、主体与关系、四、场景与视觉设定：原样发。
// 五、镜头时间轴：原样发，去掉每镜的「这一镜的作用：…」。
// 六、全片保持与禁止：只发「始终禁止」那一行，放在最后（官方指南：约束写在最后，能减少文字、水印和畸变）。
//
// 认不出结构（没有镜头段，或者镜头段里没有「第N镜」）就整份原样发：用户贴进来的别家提示词不能被删。
import { halfWidthAlnum } from "./scene-script-check";

type Kind = "summary" | "materials" | "subjects" | "scene" | "shots" | "constraints";

/** 编辑框里不发给视频模型的一段：第 line 行的 [from, to)。tag 为真时在这行末尾标「仅参考」。 */
export type SceneScriptHidden = { line: number; from: number; to: number; tag?: boolean };
export type SceneScriptLayers = { prompt: string; hidden: SceneScriptHidden[] };

const KINDS: [Kind, RegExp][] = [
  ["summary", /剧情|概述|概要/], ["materials", /素材/], ["subjects", /主体|人物|角色/],
  ["scene", /场景|视觉/], ["shots", /镜头|时间轴|分镜/], ["constraints", /保持|禁止|约束/],
];
// 「一、剧情概述：…」「### 五、镜头时间轴」「**3. 主体与关系**」：编号 + 标题，冒号后面可以直接接正文。
const HEADING = /^\s*(?:#{1,4}\s*)?(?:\*\*)?\s*([一二三四五六]|[1-6])\s*[、.．]\s*(?:\*\*)?\s*([^：:\n*]{2,12}?)\s*(?:\*\*)?\s*(?:[：:]\s*(.*))?$/;
const SHOT = /^\s*第\s*\d+\s*镜/;
const PURPOSE = /这一镜的作用\s*[：:]/;
const MARK = /[（(]\s*((?:图|视频|音频|声音)\s*\d+)\s*[)）]/;

function heading(line: string): { kind: Kind; rest: string; restAt: number } | undefined {
  const m = HEADING.exec(halfWidthAlnum(line));
  if (!m) return undefined;
  const kind = KINDS.find(([, re]) => re.test(m[2]))?.[0];
  if (!kind) return undefined;
  const rest = m[3] ?? "";
  return { kind, rest: rest.trim(), restAt: line.length - rest.length };
}

/** 素材一行压成「图1 牛杂煲参考」：标记（没有就用名字）+ 说明里第一句。 */
function material(line: string): string | undefined {
  const text = line.trim();
  if (!text) return undefined;
  const mark = MARK.exec(halfWidthAlnum(text))?.[1].replace(/\s+/g, "");
  const colon = text.search(/[：:]/), is = text.indexOf("是");
  const cut = colon >= 0 ? colon : is >= 0 ? is : -1;
  const name = (cut >= 0 ? text.slice(0, cut) : text).replace(MARK, "").replace(/[「」]/g, "").trim();
  const desc = (cut >= 0 ? text.slice(cut + 1) : "").split(/[，,；;。]/)[0].trim();
  const label = mark ?? name;
  return desc ? `${label} ${desc}` : label;
}

/** 认得出六段结构就给出分层结果，认不出返回 undefined（整份原样发）。 */
export function sceneScriptLayers(text: string): SceneScriptLayers | undefined {
  const lines = text.split("\n");
  const sections: { kind: Kind; lines: { no: number; text: string; at: number }[]; head: number }[] = [];
  let current: (typeof sections)[number] | undefined;
  const preamble: number[] = [];
  lines.forEach((line, no) => {
    const h = heading(line);
    if (h && !sections.some(s => s.kind === h.kind)) {
      current = { kind: h.kind, lines: h.rest ? [{ no, text: h.rest, at: h.restAt }] : [], head: no };
      sections.push(current);
      return;
    }
    if (current) current.lines.push({ no, text: line, at: 0 });
    else if (line.trim()) preamble.push(no);
  });
  const shots = sections.find(s => s.kind === "shots");
  if (!shots || !shots.lines.some(l => SHOT.test(halfWidthAlnum(l.text))) || sections.length < 2) return undefined;

  const hidden: SceneScriptHidden[] = [];
  const hide = (no: number, from: number, tag?: boolean) => {
    if (lines[no].length > from) hidden.push({ line: no, from, to: lines[no].length, ...(tag ? { tag } : {}) });
  };
  const blocks: string[] = preamble.map(no => lines[no].trim());
  const of = (kind: Kind) => sections.find(s => s.kind === kind);
  const body = (kind: Kind) => (of(kind)?.lines ?? []).map(l => l.text.trimEnd()).join("\n").trim();

  const summary = of("summary");
  if (summary) {
    hide(summary.head, 0, true);
    summary.lines.forEach(l => { if (l.no !== summary.head) hide(l.no, 0); });
  }
  const pairs = (of("materials")?.lines ?? []).map(l => material(l.text)).filter((m): m is string => !!m);
  if (pairs.length) blocks.push(`素材：${pairs.join("；")}`);
  for (const kind of ["subjects", "scene"] as const) { const b = body(kind); if (b) blocks.push(b); }
  const timeline = shots.lines.flatMap(l => {
    const at = PURPOSE.exec(l.text);
    if (!at) return [l.text.trimEnd()];
    hide(l.no, l.at + at.index);
    const kept = l.text.slice(0, at.index).trimEnd();
    return kept.trim() ? [kept] : [];
  }).join("\n").trim();
  blocks.push(timeline);
  const constraints = of("constraints");
  if (constraints) {
    const banned: string[] = [];
    constraints.lines.forEach(l => {
      const m = /^\s*(?:始终)?禁止\s*[：:]\s*(.+)$/.exec(l.text);
      if (m) banned.push(m[1].trim());
      else if (l.text.trim()) hide(l.no, l.at);
    });
    if (banned.length) blocks.push(`画面中不要出现：${banned.join("；")}`);
  }
  // 数字字母写成全角的（terra 常这样）发出去换回半角：H3 认镜头、厂商读秒数都按半角。
  return { prompt: halfWidthAlnum(blocks.filter(Boolean).join("\n\n")), hidden };
}

/** 发给视频模型的内容：认得出六段结构就挑过，认不出就是原文。 */
export function sceneVideoPrompt(text: string): string {
  return sceneScriptLayers(text)?.prompt ?? text.trim();
}
