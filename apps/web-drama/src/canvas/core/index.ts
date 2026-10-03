// ─────────────────────────────────────────────────────────────────────────────
// canvas/core —— 画布前端底座的统一出口（v0.198）。接口定义在 contract.ts（主模型定的），实现分在：
//
//   use-canvas-doc.tsx      CanvasDocProvider / useCanvasDoc          文档唯一真值、防抖保存、409、flush
//   use-canvas-runs.tsx     CanvasRunsProvider / useCanvasRuns        所有生成的唯一入口（连点去重、先存再发、轮询、合并、接回）
//   pending-requests.ts     未确认请求表（按画布存 localStorage）：重试沿用原键、离页 / 响应丢了下次进页接回
//   use-canvas-pricing.tsx  useCanvasPricing                          按钮上的价格、视频 / 出图模型选择（按画布记）
//   refs.ts                 parseRefs / formatRef / stripRefs / parseShots / totalDuration   片段文本
//   merge.ts                applyRunRef / applyRunResult / pushScriptHistory（+ restoreScriptVersion）
//   doc-ops.ts              emptyDoc / pickedImage / find* / add* / remove* / setPicked / 片段增删改 / episodeProgress / lookLabel
//   ids.ts                  newId / newClientRequestId
//
// 页面只从这里 import（`@/canvas/core`），不要伸手进各文件。
// 不导出：useCanvasDocControl（core 内部用）。
// ─────────────────────────────────────────────────────────────────────────────

export * from "./contract";

export { CanvasDocProvider, useCanvasDoc, useOptionalCanvasDoc, pendingSaveFor, CANVAS_SAVE_DEBOUNCE_MS } from "./use-canvas-doc";
export { CanvasRunsProvider, useCanvasRuns, RUN_POLL_MS, RUN_POLL_HIDDEN_MS, RECONNECT_DELAYS_MS, PENDING_RETRY_DELAYS_MS } from "./use-canvas-runs";
export { PENDING_MAX_ITEMS, PENDING_LOOKUP_GRACE_MS, readPending, targetsOf, slotOf } from "./pending-requests";
export { useCanvasPricing, DEFAULT_MAX_SEGMENT_SEC, DEFAULT_MIN_SEGMENT_SEC } from "./use-canvas-pricing";

export { REF_PATTERN, parseRefs, formatRef, stripRefs, parseShots, totalDuration, cleanRefLabel } from "./refs";

export {
  applyRunRef,
  applyRunResult,
  pushScriptHistory,
  restoreScriptVersion,
  collectRunRefs,
  runRefAt,
  isTerminalStatus,
  SCRIPT_HISTORY_LIMIT,
} from "./merge";

export {
  BASE_LOOK_NAME,
  SCENES_GROUP_ID,
  characterGroupId,
  emptyDoc,
  canvasStep,
  pickedImage,
  pickedVideo,
  findCharacter,
  findLook,
  findScene,
  findMaterial,
  findEpisode,
  findSegment,
  parseRunTarget,
  type ParsedRunTarget,
  mapLook,
  mapScene,
  mapMaterial,
  mapEpisode,
  mapSegment,
  addCharacter,
  addLook,
  addScene,
  addMaterial,
  removeLook,
  removeCharacter,
  removeScene,
  removeMaterial,
  setPicked,
  ensureEpisode,
  emptySegment,
  insertSegment,
  removeSegment,
  updateSegment,
  episodeProgress,
  lookLabel,
  stripAssetUrls,
} from "./doc-ops";

export { newId, newClientRequestId, isValidId, ID_PATTERN } from "./ids";
