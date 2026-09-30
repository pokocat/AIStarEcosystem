// ─────────────────────────────────────────────────────────────────────────────
// canvas/assets/traits.ts —— 「角色设计」的纯函数（v0.198，有单测 traits.test.ts）。
//
// look.traits：key = 组名（「性别表达」「年龄」…，见 constants/canvas-traits.ts），value = 选中的标签（或自定义的那句）。
// 保存时拼成一行「角色设计：女性，23–28 岁，东亚，……」写进 look.prompt：
//   · 外貌描述里已经有这一行（以「角色设计：」开头的行）→ 原地替换（多出来的同类行删掉）；
//   · 没有 → 追加在末尾；
//   · 一个标签都没选 → 删掉这一行；
//   · 用户写的其它段落一个字不动。
// ─────────────────────────────────────────────────────────────────────────────

import { CANVAS_TRAIT_TABS, TRAITS_LINE_PREFIX, type TraitGroup } from "@/constants/canvas-traits";

export type Traits = Record<string, string[]>;

const ALL_GROUPS: TraitGroup[] = CANVAS_TRAIT_TABS.flatMap((t) => t.groups);
const GROUP_BY_NAME = new Map(ALL_GROUPS.map((g) => [g.name, g]));

/**
 * 读 look.traits，整理成「组名 → 标签」：
 *   · 认识的组名原样保留（单选组只留第一个）；
 *   · 旧写法（key 是页签名，如 mock 里的 `{ 基础: ["男性", "36–45"] }`）按标签找回它属于哪一组；
 *     找不到组的值，归到这个页签里允许自定义的那一组（没有就丢掉）；
 *   · 空值、重复值去掉；认不得的 key 丢掉。
 */
export function normalizeTraits(raw: Traits | undefined | null): Traits {
  const out: Traits = {};
  if (!raw) return out;
  const push = (group: TraitGroup, value: string) => {
    const v = value.trim();
    if (!v) return;
    const cur = out[group.name] ?? [];
    if (cur.includes(v)) return;
    out[group.name] = group.multi ? [...cur, v] : cur.length ? cur : [v];
  };
  for (const [key, values] of Object.entries(raw)) {
    if (!Array.isArray(values)) continue;
    const group = GROUP_BY_NAME.get(key);
    if (group) {
      for (const v of values) if (typeof v === "string") push(group, v);
      continue;
    }
    const tab = CANVAS_TRAIT_TABS.find((t) => t.name === key);
    if (!tab) continue;
    for (const v of values) {
      if (typeof v !== "string") continue;
      const owner = tab.groups.find((g) => g.options.some((o) => o.label === v)) ?? tab.groups.find((g) => g.custom);
      if (owner) push(owner, v);
    }
  }
  return out;
}

/** 点一下某个标签：单选组换成它（再点一次取消），多选组加上 / 去掉。返回新对象，不改入参。 */
export function toggleTrait(traits: Traits, groupName: string, value: string): Traits {
  const group = GROUP_BY_NAME.get(groupName);
  const v = value.trim();
  if (!group || !v) return traits;
  const cur = traits[groupName] ?? [];
  let next: string[];
  if (cur.includes(v)) next = cur.filter((x) => x !== v);
  else next = group.multi ? [...cur, v] : [v];
  const out = { ...traits };
  if (next.length) out[groupName] = next;
  else delete out[groupName];
  return out;
}

/** 某个值拼进那一行时怎么说。 */
function phraseOf(group: TraitGroup, value: string): string {
  const opt = group.options.find((o) => o.label === value);
  if (opt?.phrase) return opt.phrase;
  return group.phrase ? group.phrase.replace("{v}", value) : value;
}

/** 选中了几个标签。 */
export function traitCount(traits: Traits): number {
  return Object.values(normalizeTraits(traits)).reduce((n, v) => n + v.length, 0);
}

/** 拼出「角色设计：女性，23–28 岁，东亚，……」（按页签 / 组的顺序）；一个都没选返回 null。 */
export function traitsLine(traits: Traits | undefined | null): string | null {
  const t = normalizeTraits(traits);
  const parts: string[] = [];
  for (const group of ALL_GROUPS) {
    for (const v of t[group.name] ?? []) parts.push(phraseOf(group, v));
  }
  return parts.length ? `${TRAITS_LINE_PREFIX}${parts.join("，")}` : null;
}

const isTraitsLine = (line: string) => line.trimStart().startsWith(TRAITS_LINE_PREFIX);

/**
 * 把受管理的那一行写进外貌描述：有就原地替换、没有就追加在末尾、line 为空就删掉那一行。
 * 其它行一个字不动。
 */
export function applyTraitsLine(prompt: string, line: string | null): string {
  const lines = prompt.split("\n");
  const at = lines.findIndex(isTraitsLine);
  if (at < 0) {
    if (!line) return prompt;
    if (!prompt.trim()) return line;
    return prompt.endsWith("\n") ? `${prompt}${line}` : `${prompt}\n${line}`;
  }
  const kept: string[] = [];
  lines.forEach((l, i) => {
    if (i === at) {
      if (line) kept.push(line);
    } else if (!isTraitsLine(l)) {
      kept.push(l);
    }
  });
  return kept.join("\n");
}

/** 保存角色设计：一次算出新的 traits 和新的外貌描述。 */
export function applyTraits(look: { prompt: string }, traits: Traits): { traits: Traits; prompt: string } {
  const t = normalizeTraits(traits);
  return { traits: t, prompt: applyTraitsLine(look.prompt, traitsLine(t)) };
}
