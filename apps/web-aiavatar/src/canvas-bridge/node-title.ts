// ─────────────────────────────────────────────────────────────────────────────
// 节点自动标题。
//
// 上游的做法是 `prompt.slice(0, 32)` —— 它是单机工具，作者自己看得懂就行。
// 到我们这儿有两处不成立：
//   ① 卡片头放不下 32 个字，看到的是一句被腰斩的话，而不是一个名字；
//   ② 画布会被「存为官方内容」推给所有人。线上那条官方示例的 10 个标题里有 7 个是
//      提示词截断（「戴米白色针织冷帽（帽上缝着彩色小布标、笑脸刺绣、花朵徽章），戴复」），
//      别人点开看到的是每张卡都顶着一段话。v0.194 手工改了那一条数据，这里是根治。
//
// 仍然从提示词派生（换成「出图 1 / 出图 2」的话，作者自己就分不清哪张是哪张了），
// 但按**名字**的标准来：去掉小节标记、切到第一个自然停顿、限长。
// 标题本来就能双击改名，自动值只负责"别太难看"。
// ─────────────────────────────────────────────────────────────────────────────

/** 卡片头一行放得下的字数。超了截断加省略号。 */
const MAX = 12;

/** 提示词里常见的小节标记：`【主体与画风】`、`[Style]`、`1. `、`①` 开头。 */
const LEADING_MARKER = /^\s*(?:[【\[][^】\]]{0,12}[】\]]\s*|\d+[.、)]\s*)+/;

/**
 * 从提示词派生一个短标题。拿不到提示词就用 `fallback`（各调用方按节点类型给中文默认名）。
 */
export function autoNodeTitle(prompt: string | null | undefined, fallback: string): string {
  const raw = (prompt ?? "").replace(LEADING_MARKER, "").trim();
  if (!raw) return fallback;
  // 切到第一个**硬**停顿。刻意不切逗号顿号 —— 提示词里括号内常有「（…、…、…）」，
  // 按顿号切会从括号中间断开，比不切还难看。
  const head = raw.split(/[。．.！!？?；;\n]/)[0]!.trim() || raw;
  if (head.length <= MAX) return head;
  return trimToBracket(head.slice(0, MAX)) + "…";
}

/**
 * 截断点落在括号里就退到括号之前。
 *
 * 「戴米白色针织冷帽（帽上缝着彩色小布标、笑脸刺绣…」硬切 12 个字得到
 * 「戴米白色针织冷帽（帽上缝」—— 一个开着的括号比少几个字难看得多；退回去是「戴米白色针织冷帽」，
 * 反而正好是个名字。
 */
function trimToBracket(cut: string): string {
  const PAIRS: Array<[string, string]> = [["（", "）"], ["(", ")"], ["【", "】"], ["[", "]"], ["「", "」"]];
  let out = cut;
  for (const [open, close] of PAIRS) {
    const at = out.lastIndexOf(open);
    if (at >= 0 && out.indexOf(close, at) < 0) out = out.slice(0, at);
  }
  return out.trim() || cut;
}

/**
 * 这个标题看起来还是「没改过的自动标题」吗？
 *
 * 用在「存为官方内容」之前提醒运营改名 —— 只提醒，不拦（§2.4：给提示不给拦路）。
 * 判据是**标题就是提示词的开头**：作者手动改过的名字（「招牌形象」「吹泡泡」）不会命中，
 * 而 `slice(0, 32)` 那批老数据、以及本函数自己派生的值，都会命中。
 */
export function looksAutoTitled(title: string | null | undefined, prompt: string | null | undefined): boolean {
  const t = (title ?? "").replace(/…$/, "").trim();
  const p = (prompt ?? "").replace(LEADING_MARKER, "").trim();
  if (!t || !p) return false;
  if (t.length < 6) return false;   // 「吹泡泡」这种短名字一律放过，即使碰巧是开头
  return p.startsWith(t);
}
