// hot-topic-label.ts — 把整句选题压成 chip 上能显示的短标签。
//
// 「近期热点」一条有两个字段：`label` 上 chip、`idea` 点了填进输入框（也做 hover 提示）。
// 运营在「内容目录」页点「AI 生成一批」时拿到的是整句钩子，早期直接 label=idea=整句，
// chip 于是变成一整句话、几条就铺满好几行。这里统一取第一个分句做标签，整句仍然完整保留。
const CLAUSE_BREAK = /[，,。；;！!？?、\n]/;

/** 取整句的第一个分句做短标签；仍然过长则硬截断加省略号。空串原样返回。 */
export function hotTopicLabel(text: string, max = 12): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  const head = t.split(CLAUSE_BREAK)[0]?.trim() || t;
  return head.length > max ? head.slice(0, max) + "…" : head;
}
