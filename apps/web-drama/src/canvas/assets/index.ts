// ─────────────────────────────────────────────────────────────────────────────
// canvas/assets —— 角色和场景（v0.198，真源 docs/drama-canvas-plan.md §2.4）。画布（board）从这里 import 共享组件。
//
//   AssetGenPanel({ target, variant: "docked"|"inline", onClose?, onReferenceAdded? })
//                         出图面板（props 见 core/contract.ts AssetGenPanelProps）。docked = position:absolute
//                         停在所在容器底部中间（放进画布的 .cv-fill 里），最宽 820；inline = 普通块。
//                         「上传参考」会建一张素材图并连一条 素材图 → 目标 的线，然后回调 onReferenceAdded(materialId)
//                         （画布拿它把新素材摆到目标旁边；面板自己不管位置）。
//   LookDetailDialog({ lookId, open, onClose })
//                         造型详情（props 见 contract.ts LookDetailDialogProps）：挑定妆照 / 上传一张、改挂到别的角色、
//                         造型名、出现集数、外貌描述、删除。
//   TraitsDialog({ lookId, open, onClose })
//                         角色设计标签选择器（出图面板里已经挂好；画布一般不用直接挂）。
//   AssetListView({ tab, onTabChange, onLocate? })
//                         列表视图（page 用）。
//   纯函数：traits.ts（角色设计那一行）、list-ops.ts（过滤 / 批量出图 / 造型挪角色）、references.ts（参考连线）。
// 弹窗、抽屉都挂到 body 上（React Flow 容器带 transform，里面的 position:fixed 会被困住）。
// ─────────────────────────────────────────────────────────────────────────────

export { AssetGenPanel, IMAGE_RATIOS, IMAGE_COUNTS } from "./asset-gen-panel";
export { LookDetailDialog } from "./look-detail-dialog";
export { TraitsDialog, type TraitsDialogProps } from "./traits-dialog";
export { AssetListView, ASSET_TABS, type AssetTab, type AssetListViewProps } from "./asset-list-view";
export { assetRunView, withSubmitting, useNarrow, NARROW_QUERY, ROLE_LABEL, ROLE_ORDER, RolePicker, type AssetRunView } from "./bits";
export { applyTraits, applyTraitsLine, normalizeTraits, toggleTrait, traitCount, traitsLine, type Traits } from "./traits";
export {
  BATCH_MAX_IMAGES,
  BATCH_MAX_ITEMS,
  batchLimitReason,
  episodeOptions,
  episodesText,
  filterCharacters,
  filterMaterials,
  filterScenes,
  moveEmptiesCharacter,
  moveLook,
  planBatch,
  skippedText,
  toggleEpisode,
  type AssetFilter,
  type BatchPick,
  type BatchPlan,
} from "./list-ops";
export { addUploadedReference, disconnectReference, referencesOf, type ReferenceItem } from "./references";
