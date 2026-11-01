// 提示词里的「图1」「@图2」（参考图3 里的「图3」也算）：编号是这次交给视频模型的第几张图，
// 和素材格上的「图1」角标、编导写脚本时的编号是同一套（scene-video-studio 的 plan.used）。
// 编辑框把它显示成缩略图标签、编导的脚本卡片同样显示；存下来、交给模型的始终是原来的字。
// 下游怎么认它：H3 改写把「图N / 参考图N / @图N」当 <Picture N>（H3PromptRewrite 的 REF 说明）。

export type PromptPiece = { text: string } | { ref: number; raw: string };

const REF = /@?图(\d{1,2})(?!\d)/g;

/** 按「图N」切开；N 不在 1..count 之间的（这次没交给模型的图）原样当文字。 */
export function splitPromptRefs(text: string, count: number): PromptPiece[] {
  const pieces: PromptPiece[] = [];
  let at = 0;
  for (const m of text.matchAll(REF)) {
    const n = Number(m[1]);
    if (n < 1 || n > count) continue;
    if (m.index! > at) pieces.push({ text: text.slice(at, m.index) });
    pieces.push({ ref: n, raw: m[0] });
    at = m.index! + m[0].length;
  }
  if (at < text.length) pieces.push({ text: text.slice(at) });
  return pieces;
}
