"use client";
// The four opening cards of a new conversation and their fill-in cards (docs/ip-studio-new-canvas-and-threads.md §5).
// A card names what it makes; its fill-in card collects the material (from the canvas through the composer's @, or an
// upload through the composer's attachments), a few option buttons with their defaults chosen, and a line or two of
// the user's own words, and writes one sentence into the composer as they go. Sending stays the composer's own button.
// Pure client guidance: the server routes, quotes and charges as for any typed message; the card only names the skill.
// The old 「复刻一条短视频」 checklist is the recreation card here.
import type { ChangeEvent, KeyboardEvent } from "react";
import { ArrowLeft, Check, Clapperboard, Repeat2, ScanFace, ScrollText, X, type LucideIcon } from "lucide-react";
import type { CanvasNodeData } from "@/canvas/types/canvas";

export type StarterKey = "ip" | "script" | "video" | "recreation";
/** Material taken from the message's references by node type. `min` 0 is optional. */
export type StarterSlot = { kind: "slot"; id: string; label: string; type: "image" | "video"; min: number; max: number;
  /** What the slot takes, shown while it is empty: 「1–3 张图片」. */
  need: string; hint?: string; missing: string; tooMany: string };
export type StarterChoice = { value: string; label: string; phrase?: string };
export type StarterOptions = { kind: "option"; id: string; label: string; choices: StarterChoice[]; defaultValue: string };
export type StarterField = { kind: "field"; id: string; label: string; placeholder: string; required: boolean; missing?: string };
export type StarterItem = StarterSlot | StarterOptions | StarterField;
type Titled = Pick<CanvasNodeData, "title">;
export type StarterValues = { slots: Record<string, Titled[]>; options: Record<string, string>; fields: Record<string, string> };
/** `slot`: material the skill needs, whatever the composer says. `field`: words that only feed the sentence. */
export type StarterMissing = { reason: string; kind: "slot" | "field" };
export type StarterConfig = {
  key: StarterKey; title: string; gets: string; needs: string; skill: string; Icon: LucideIcon; tone: "ip" | "text" | "video" | "copy";
  items: StarterItem[];
  /** The sentence, from resolved values: every option has a value, slots and fields are what the user gave. */
  compose: (v: StarterValues) => string;
};

/** `@A、@B`, the way a manual @ names a canvas node. */
const tags = (nodes: Titled[]) => nodes.map(n => `@${n.title}`).join("、");
/** What the user typed, without the closing punctuation the sentence adds itself. */
export const starterClause = (text = "") => text.replace(/\s+/g, " ").trim().replace(/[。.！!？?；;，,、：:\s]+$/u, "");
/** A value that starts with a digit gets a space after the Chinese before it: 「写一个 60 秒」, 「做一条 5 秒」. */
const spaced = (value: string) => /^\d/.test(value) ? ` ${value}` : value;
const option = (items: StarterItem[], v: StarterValues, id: string) => {
  const group = items.find((i): i is StarterOptions => i.kind === "option" && i.id === id)!;
  const choice = group.choices.find(c => c.value === v.options[id]) || group.choices.find(c => c.value === group.defaultValue)!;
  return choice.phrase ?? choice.label;
};

const IP_ITEMS: StarterItem[] = [
  { kind: "slot", id: "photos", label: "你的照片", type: "image", min: 1, max: 3, need: "1–3 张照片", missing: "还差照片", tooMany: "照片最多 3 张",
    hint: "正脸清晰、光线均匀、只有一个人，效果最好。只用本人或已获授权的照片。" },
  { kind: "option", id: "style", label: "风格", defaultValue: "写实", choices: ["写实", "3D 卡通", "日系动漫", "国潮插画", "Q 版"].map(value => ({ value, label: value })) },
  { kind: "option", id: "output", label: "要出的图", defaultValue: "sheet", choices: [
    { value: "sheet", label: "多视角设定图", phrase: "多视角设定图（正面、侧面、背面加几个表情）" },
    { value: "turnaround", label: "只要三视图", phrase: "三视图（正面、侧面、背面）" },
    { value: "avatar", label: "头像", phrase: "头像" }] },
];
const SCRIPT_ITEMS: StarterItem[] = [
  { kind: "field", id: "synopsis", label: "一句梗概", placeholder: "比如：外卖员送错一单，意外救了老板的女儿", required: true, missing: "先写一句梗概" },
  { kind: "option", id: "type", label: "类型", defaultValue: "短剧", choices: ["短剧", "广告片", "口播", "微电影"].map(value => ({ value, label: value })) },
  { kind: "option", id: "length", label: "时长", defaultValue: "60 秒", choices: ["30 秒", "60 秒", "3 分钟", "分 3 集"].map(value => ({ value, label: value })) },
  { kind: "option", id: "tone", label: "基调", defaultValue: "有反转", choices: ["有反转", "搞笑", "温情", "悬疑"].map(value => ({ value, label: value })) },
];
const VIDEO_ITEMS: StarterItem[] = [
  { kind: "field", id: "description", label: "画面描述", placeholder: "比如：女孩在海边回头微笑，风吹起围巾", required: true, missing: "先写画面描述" },
  { kind: "slot", id: "frame", label: "首帧图", type: "image", min: 0, max: 1, need: "1 张图片", missing: "", tooMany: "首帧图只要 1 张" },
  { kind: "option", id: "ratio", label: "画幅", defaultValue: "9:16", choices: ["9:16", "16:9", "1:1"].map(value => ({ value, label: value })) },
  { kind: "option", id: "length", label: "时长", defaultValue: "5 秒", choices: ["5 秒", "10 秒"].map(value => ({ value, label: value })) },
  { kind: "option", id: "camera", label: "镜头", defaultValue: "自动", choices: ["自动", "缓慢推近", "环绕", "跟拍"].map(value => ({ value, label: value })) },
];
const RECREATION_ITEMS: StarterItem[] = [
  { kind: "slot", id: "reference", label: "参考视频", type: "video", min: 1, max: 1, need: "1 条视频", missing: "还差参考视频", tooMany: "参考视频只要 1 条" },
  { kind: "slot", id: "subject", label: "换进去的商品或人物", type: "image", min: 1, max: 3, need: "1–3 张图片", missing: "还差商品或人物图", tooMany: "商品或人物图最多 3 张" },
  { kind: "option", id: "keep", label: "保留", defaultValue: "shots", choices: [
    { value: "shots", label: "节奏和镜头", phrase: "保留节奏和镜头" },
    { value: "voice", label: "节奏、镜头和口播", phrase: "保留节奏、镜头和口播" },
    { value: "rhythm", label: "只保留节奏", phrase: "只保留节奏" }] },
  { kind: "field", id: "points", label: "要讲的卖点", placeholder: "比如：保温 12 小时，一键开盖", required: false },
];

export const STUDIO_STARTERS: StarterConfig[] = [{
  key: "ip", title: "制作个人 IP", gets: "真人照片变成数字形象，出多角度设定图", needs: "1–3 张照片", skill: "image-generation", Icon: ScanFace, tone: "ip", items: IP_ITEMS,
  compose: v => {
    const photos = v.slots.photos || [];
    return `用${photos.length ? ` ${tags(photos)} ` : "我的照片"}做一个我的数字 IP 形象，保留脸型、发型和主要特征，${option(IP_ITEMS, v, "style")}风格，出一张${option(IP_ITEMS, v, "output")}。`;
  },
}, {
  key: "script", title: "写剧本", gets: "一句梗概写成能拍的分场剧本", needs: "一句梗概", skill: "script-writing", Icon: ScrollText, tone: "text", items: SCRIPT_ITEMS,
  compose: v => {
    const synopsis = starterClause(v.fields.synopsis);
    return `写一个${spaced(option(SCRIPT_ITEMS, v, "length"))}的${option(SCRIPT_ITEMS, v, "type")}剧本${synopsis ? `：${synopsis}` : ""}。${option(SCRIPT_ITEMS, v, "tone")}，分场写清画面、台词和时长。`;
  },
}, {
  key: "video", title: "做个短视频", gets: "一句描述出视频，也可以从一张图动起来", needs: "画面描述", skill: "video-generation", Icon: Clapperboard, tone: "video", items: VIDEO_ITEMS,
  compose: v => {
    const description = starterClause(v.fields.description), frame = v.slots.frame || [], camera = option(VIDEO_ITEMS, v, "camera");
    return `做一条${spaced(option(VIDEO_ITEMS, v, "length"))}、${option(VIDEO_ITEMS, v, "ratio")} 的短视频${description ? `：${description}` : ""}。`
      + (frame.length ? `从 ${tags(frame)} 开始动起来。` : "") + (camera !== "自动" ? `镜头${camera}。` : "");
  },
}, {
  key: "recreation", title: "复刻视频", gets: "照爆款的节奏和镜头，换成你的商品或人物", needs: "参考视频 + 你的素材", skill: "reference-video-recreation", Icon: Repeat2, tone: "copy", items: RECREATION_ITEMS,
  compose: v => {
    const reference = v.slots.reference || [], subject = v.slots.subject || [], points = starterClause(v.fields.points);
    return `${reference.length ? `照 ${tags(reference)} 的拍法` : "照参考视频的拍法"}，把里面的商品或人物换成${subject.length ? ` ${tags(subject)}` : "我的"}，${option(RECREATION_ITEMS, v, "keep")}${points ? `，口播改成介绍：${points}` : ""}。`;
  },
}];
export const studioStarter = (key: StarterKey) => STUDIO_STARTERS.find(s => s.key === key)!;
export const starterSlots = (config: StarterConfig) => config.items.filter((i): i is StarterSlot => i.kind === "slot");
/** Every option group on its default: what a card starts with. */
export const starterDefaults = (config: StarterConfig) =>
  Object.fromEntries(config.items.filter((i): i is StarterOptions => i.kind === "option").map(i => [i.id, i.defaultValue]));
/** Which of the message's references fill which slot: by node type (no card has two slots of one type). */
export function starterSlotNodes<T extends Pick<CanvasNodeData, "type" | "title">>(config: StarterConfig, referenced: T[]): Record<string, T[]> {
  return Object.fromEntries(starterSlots(config).map(slot => [slot.id, referenced.filter(n => n.type === slot.type)]));
}

/**
 * The composer text a card writes and what is still missing, in the order the card shows its parts. Options left
 * unset (or set to something the card does not offer) take their defaults; an empty optional part leaves no fragment.
 */
export function composeStarter(key: StarterKey, input: Partial<StarterValues>): { text: string; missing: StarterMissing[] } {
  const config = studioStarter(key);
  const values: StarterValues = { slots: input.slots || {}, options: { ...starterDefaults(config), ...input.options }, fields: input.fields || {} };
  const missing: StarterMissing[] = [];
  for (const item of config.items) {
    if (item.kind === "slot") {
      const count = (values.slots[item.id] || []).length;
      if (count < item.min) missing.push({ reason: item.missing, kind: "slot" });
      else if (count > item.max) missing.push({ reason: item.tooMany, kind: "slot" });
    } else if (item.kind === "field" && item.required && !starterClause(values.fields[item.id])) missing.push({ reason: item.missing || `先写${item.label}`, kind: "field" });
  }
  return { text: config.compose(values), missing };
}

/**
 * The composer still holds a card's sentence while the @ list that 「从画布选」 opened is in use: the sentence plus a
 * trailing `@`, `@query` or the `@title ` a pick leaves. The next sentence replaces it; only other edits are the user's.
 */
export function isMentionResidue(text: string, base?: string) {
  if (base === undefined || !text.startsWith(base)) return false;
  return /^\s*@[^@\n]*$/.test(text.slice(base.length));
}

// ── Views ────────────────────────────────────────────────────────────────────

export function StudioAssistantStarterCards({ onPick }: { onPick: (key: StarterKey) => void }) {
  return <div className="studio-assistant-starters is-grid">
    {STUDIO_STARTERS.map(card => <button key={card.key} type="button" data-tone={card.tone} onClick={() => onPick(card.key)}>
      <span className="studio-assistant-starter-icon"><card.Icon size={18} aria-hidden="true"/></span>
      <strong>{card.title}</strong>
      <span>{card.gets}</span>
      <small>需要：{card.needs}</small>
    </button>)}
  </div>;
}

type FormProps = {
  config: StarterConfig;
  slots: Record<string, CanvasNodeData[]>; options: Record<string, string>; fields: Record<string, string>;
  /** The composer text is the user's own now: options no longer rewrite it, and 「按选项重写」 brings the sentence back. */
  edited: boolean;
  onBack: () => void; onOption: (id: string, value: string) => void; onField: (id: string, value: string) => void;
  onPick: () => void; onUpload: () => void; onRemove: (node: CanvasNodeData) => void; onRewrite: () => void;
  /** Enter in a text line sends, like Enter in the composer. */
  onSubmit: () => void;
};

export function StudioAssistantStarterForm({ config, slots, options, fields, edited, onBack, onOption, onField, onPick, onUpload, onRemove, onRewrite, onSubmit }: FormProps) {
  const enter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault(); onSubmit();
  };
  return <section className="studio-assistant-starter-form" aria-label={config.title}>
    <button type="button" className="studio-assistant-starter-back" onClick={onBack}><ArrowLeft size={14} aria-hidden="true"/>换一个</button>
    <header><h3>{config.title}</h3><p>{config.gets}</p></header>
    {config.items.map((item, index) => {
      if (item.kind === "slot") {
        const chosen = slots[item.id] || [];
        const state = chosen.length > item.max ? "over" : chosen.length >= Math.max(1, item.min) ? "done" : item.min ? "missing" : "optional";
        return <div key={item.id} className="studio-assistant-starter-slot" data-state={state} role="group" aria-label={item.label}>
          <div className="studio-assistant-starter-slot-main">
            <div className="studio-assistant-starter-slot-head">
              <strong>{item.label}</strong>
              {state === "done" ? <span className="studio-assistant-starter-slot-state" aria-label="已选好"><Check size={14} aria-hidden="true"/></span>
                : <span className="studio-assistant-starter-slot-state">{state === "over" ? item.tooMany : state === "missing" ? "还缺" : "选填"}</span>}
            </div>
            {chosen.length ? <ul className="studio-assistant-starter-chosen">{chosen.map(node => <li key={node.id}>
              <span title={node.title}>{node.title}</span>
              <button type="button" aria-label={`去掉 ${node.title}`} title="去掉" onClick={() => onRemove(node)}><X size={12} aria-hidden="true"/></button>
            </li>)}</ul> : <p className="studio-assistant-starter-need">{item.need}</p>}
          </div>
          <div className="studio-assistant-starter-slot-actions">
            <button type="button" onClick={onPick}>从画布选</button>
            <button type="button" onClick={onUpload}>上传</button>
          </div>
          {item.hint && <p className="studio-assistant-starter-hint">{item.hint}</p>}
        </div>;
      }
      if (item.kind === "option") {
        const selected = item.choices.some(c => c.value === options[item.id]) ? options[item.id] : item.defaultValue;
        return <div key={item.id} className="studio-assistant-starter-option" role="group" aria-label={item.label}>
          <span className="studio-assistant-starter-label">{item.label}</span>
          <div>{item.choices.map(choice => <button key={choice.value} type="button" aria-pressed={choice.value === selected} onClick={() => onOption(item.id, choice.value)}>{choice.label}</button>)}</div>
        </div>;
      }
      return <label key={item.id} className="studio-assistant-starter-field">
        {/* Like a slot it says when it is still missing (on a phone the reason beside the send button has no room); not once
            the message is the user's own, which no longer needs it. */}
        <span className="studio-assistant-starter-label">{item.label}{!item.required ? <em>选填</em> : !edited && !starterClause(fields[item.id]) && <em className="is-missing">还缺</em>}</span>
        {/* A card that starts with a line of text (写剧本, 做个短视频) puts the cursor there. */}
        <input type="text" aria-label={item.label} value={fields[item.id] || ""} placeholder={item.placeholder} maxLength={300} autoFocus={index === 0}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onField(item.id, e.target.value)} onKeyDown={enter}/>
      </label>;
    })}
    {edited && <p className="studio-assistant-starter-rewrite"><button type="button" className="studio-dialogue-link" title="用上面的选项重新写输入框里的话" onClick={onRewrite}>按选项重写</button></p>}
  </section>;
}
