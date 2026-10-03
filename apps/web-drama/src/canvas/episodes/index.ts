// ─────────────────────────────────────────────────────────────────────────────
// canvas/episodes —— 逐集制作页与单集编辑器（v0.198，docs/drama-canvas-plan.md §2.5 / §2.6）。
//
//   episode-list.tsx         EpisodeListView        /canvas/<id>/episodes：每集一张横卡、价格说明、多选批量生成分镜脚本
//   episode-editor.tsx       EpisodeEditor          /canvas/<id>/episodes/<no>：本集素材 | 片段编辑 | 预览 + 片段轴
//   segment-text-editor.tsx  SegmentTextEditor      片段文本（@ 标签、@ 浮层、只读排版）
//   segment-text.ts                                 片段文本 ⇄ 编辑框 DOM 的序列化、光标位置、@ 查找（纯函数 + DOM）
//   derive.ts                                       卡片 / 格子状态、价格文案、时长、本集素材、用上一片段最后一帧（纯函数）
//   actions.tsx              useStoryboardAction    生成分镜脚本（两屏共用）、确认 + 提交的小工具
//   asset-panel / preview-panel / segment-timeline / ref-picker / bits
//
// 页面只 import 这里。样式在 styles/pages/canvas-episodes.css（`.cve-*`）。
// ─────────────────────────────────────────────────────────────────────────────

export { EpisodeListView } from "./episode-list";
export { EpisodeEditor } from "./episode-editor";
