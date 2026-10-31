/**
 * 编导写完脚本后、出片前的零成本核对（2026-10-30 审查 F05：脚本只验格式，JSON 对了、没有团购价也算成功）。
 * 只做确定的事：编导自己说「还缺」的那一行、脚本里留着的【待补】、用户写过的数字有没有进脚本。不打分，不调模型。
 */

/**
 * 编导按场景要求，缺必填信息时单独一行写「还缺：……」。要求它写在最前面，但真模型（2026-10-31 本地 Agnes）写在了最后，
 * 所以哪一行都认，认到就从脚本里拿掉，并去掉它后面附带的解释（「正文中已按规范……」）。
 */
export function scriptMissing(content: string): { missing?: string; body: string } {
  const lines = content.split("\n");
  const at = lines.findIndex(l => /^\s*还缺[:：]/.test(l));
  if (at < 0) return { body: content };
  const missing = lines[at].replace(/^\s*还缺[:：]\s*/, "").split(/[。.]/)[0].trim();
  const body = [...lines.slice(0, at), ...lines.slice(at + 1)].join("\n").replace(/^\s+|\s+$/g, "");
  return { missing, body };
}

/** 脚本里还没填的【待补：……】。 */
export const scriptPlaceholders = (content: string) => [...content.matchAll(/【待补[:：]?([^】]*)】/g)].map(m => m[1].trim() || "待补");

/**
 * 留空的地方分成必须补的和可以不补的：对得上场景里「有就写」的那几条（原价、使用限制）算可以不补，其余都算必须补。
 * 场景要求里写了「选填的不要写待补」，真模型（2026-10-31 本地 Agnes）照样写，所以页面自己分（2026-10-30 界面评审）。
 */
export function classifyBlanks(blanks: string[], facts: { label: string; required: boolean }[] = []) {
  const optional = facts.filter(f => !f.required).map(f => f.label);
  const isOptional = (b: string) => optional.some(l => b.includes(l) || l.includes(b));
  const unique = [...new Set(blanks)];
  return { required: unique.filter(b => !isOptional(b)), optional: unique.filter(isOptional) };
}

/** 脚本里用 <mark> 标出【待补】，好找。 */
export function splitBlanks(content: string): { text: string; blank: boolean }[] {
  const out: { text: string; blank: boolean }[] = [];
  let at = 0;
  for (const m of content.matchAll(/【待补[^】]*】/g)) {
    if (m.index! > at) out.push({ text: content.slice(at, m.index), blank: false });
    out.push({ text: m[0], blank: true });
    at = m.index! + m[0].length;
  }
  if (at < content.length) out.push({ text: content.slice(at), blank: false });
  return out;
}

const DIGIT: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const UNIT: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000 };

/** 「九十九」「一百五十八」「一百零八」「两千」「三点五」→ 数字；认不出返回 undefined。 */
export function chineseNumber(text: string): number | undefined {
  const [int, frac] = text.split("点");
  let total = 0, section = 0, digit = -1;
  for (const ch of int) {
    if (ch in DIGIT) { digit = DIGIT[ch]; continue; }
    const unit = UNIT[ch];
    if (!unit) return undefined;
    if (unit === 10000) { total = (total + section + Math.max(digit, 0)) * unit; section = 0; }
    else section += (digit < 0 ? 1 : digit) * unit;
    digit = -1;
  }
  let value = total + section + Math.max(digit, 0);
  if (!int) value = 0;
  if (frac) {
    if (![...frac].every(ch => ch in DIGIT)) return undefined;
    value = Number(`${value}.${[...frac].map(ch => DIGIT[ch]).join("")}`);
  }
  return value;
}

const FIGURE = /\d+(?:\.\d+)?/g;
/** 用户写的数字里算「业务信息」的：两位以上，或一位但后面跟着单位（9 折、2 人、3 份）。 */
function figuresIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(FIGURE)) {
    const after = text.slice(m.index! + m[0].length).trimStart().charAt(0);
    if (m[0].replace(".", "").length >= 2 || /[折人份位元块]/.test(after)) out.push(String(Number(m[0])));
  }
  return [...new Set(out)];
}

/** 脚本里出现的所有数字（阿拉伯数字和中文数字都算，台词里常写成「九十九」）。 */
function numbersInScript(script: string): Set<string> {
  // 镜头编号和时间（「第2镜（2–4 秒）」）不算：不然用户写的「2 人」会被它们顶上（2026-10-30 界面评审）。
  script = script.replace(/第\s*\d+\s*镜/g, "").replace(/[（(]\s*[\d.]+\s*[–\-~～至到]\s*[\d.]+\s*秒\s*[）)]/g, "");
  const found = new Set<string>();
  for (const m of script.matchAll(FIGURE)) found.add(String(Number(m[0])));
  for (const m of script.matchAll(/[零〇一二两三四五六七八九十百千万]+(?:点[零〇一二两三四五六七八九]+)?/g)) {
    const n = chineseNumber(m[0]);
    if (n !== undefined) found.add(String(n));
  }
  return found;
}

/** 用户写过、脚本里没有的数字（价格、份数、人数……）。只提示，不拦出片：可能是用户自己不想放进口播。 */
export function missingFigures(given: string[], script: string): string[] {
  const inScript = numbersInScript(script);
  return [...new Set(given.flatMap(figuresIn))].filter(n => !inScript.has(n));
}
